import Foundation
import CoreLocation
import CoreMotion
import BackgroundTasks
import UserNotifications

/// iOS equivalent of Android TrackingService.java.
/// GPS + Steps + Supabase HTTP sync natively — no WebView/JS required.
@objc class BackgroundTrackingService: NSObject {

    @objc static let shared = BackgroundTrackingService()

    private var userId: String?
    private var supabaseUrl: String?
    private var supabaseAnonKey: String?
    private var supabaseAccessToken: String?
    private var supabaseRefreshToken: String?
    private var intervalMinutes: Int = 15

    private let locationManager = CLLocationManager()
    private var isLocationRunning = false

    private let pedometer = CMPedometer()
    private var pedometerStartDate: Date?
    private var stepsToday: Int = 0
    private var isPedometerRunning = false

    private var attendancePollTimer: Timer?
    private let attendancePollInterval: TimeInterval = 15 * 60

    static let bgTaskIdentifier = "com.paradigm.ifs.attendance-sync"

    private var isTracking = false
    private var isAuthPaused = false

    private let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 20
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true
    }

    @objc func startTracking(userId: String, supabaseUrl: String, supabaseKey: String,
                             accessToken: String, refreshToken: String, intervalMinutes: Int) {
        guard !isTracking else { return }
        self.userId = userId
        self.supabaseUrl = supabaseUrl
        self.supabaseAnonKey = supabaseKey
        self.supabaseAccessToken = accessToken
        self.supabaseRefreshToken = refreshToken
        self.intervalMinutes = intervalMinutes
        self.isAuthPaused = false
        self.isTracking = true

        let prefs = UserDefaults.standard
        prefs.set(userId, forKey: "tracking_user_id")
        prefs.set(supabaseUrl, forKey: "tracking_supabase_url")
        prefs.set(supabaseKey, forKey: "tracking_supabase_key")
        prefs.set(accessToken, forKey: "tracking_supabase_token")
        prefs.set(refreshToken, forKey: "tracking_supabase_refresh_token")
        prefs.set(intervalMinutes, forKey: "tracking_interval_mins")

        startLocationUpdates()
        startPedometerUpdates()
        startAttendancePoll()
        scheduleBackgroundTask()
        NSLog("[BGTracking] Started userId=\(userId)")
    }

    @objc func stopTracking() {
        isTracking = false
        stopLocationUpdates()
        stopPedometerUpdates()
        stopAttendancePoll()
        NSLog("[BGTracking] Stopped")
    }

    @objc func updateTokens(accessToken: String, refreshToken: String) {
        self.supabaseAccessToken = accessToken
        self.supabaseRefreshToken = refreshToken
        self.isAuthPaused = false
        UserDefaults.standard.set(accessToken, forKey: "tracking_supabase_token")
        UserDefaults.standard.set(refreshToken, forKey: "tracking_supabase_refresh_token")
    }

    @objc func restoreFromUserDefaults() {
        let prefs = UserDefaults.standard
        guard let uid = prefs.string(forKey: "tracking_user_id"),
              let url = prefs.string(forKey: "tracking_supabase_url"),
              let key = prefs.string(forKey: "tracking_supabase_key") else { return }
        let token   = prefs.string(forKey: "tracking_supabase_token") ?? ""
        let refresh = prefs.string(forKey: "tracking_supabase_refresh_token") ?? ""
        let interval = prefs.integer(forKey: "tracking_interval_mins")
        startTracking(userId: uid, supabaseUrl: url, supabaseKey: key,
                      accessToken: token, refreshToken: refresh,
                      intervalMinutes: interval > 0 ? interval : 15)
    }

    // MARK: - GPS
    private func startLocationUpdates() {
        let status = locationManager.authorizationStatus
        if status == .notDetermined { locationManager.requestAlwaysAuthorization(); return }
        guard status == .authorizedAlways || status == .authorizedWhenInUse else { return }
        locationManager.startUpdatingLocation()
        isLocationRunning = true
    }

    private func stopLocationUpdates() {
        locationManager.stopUpdatingLocation()
        isLocationRunning = false
    }

    // MARK: - Step Counter
    private func startPedometerUpdates() {
        guard CMPedometer.isStepCountingAvailable() else { return }
        pedometerStartDate = Calendar.current.startOfDay(for: Date())
        pedometer.startUpdates(from: pedometerStartDate!) { [weak self] data, error in
            guard let self = self, let data = data, error == nil else { return }
            self.stepsToday = data.numberOfSteps.intValue
        }
        isPedometerRunning = true
    }

    private func stopPedometerUpdates() {
        pedometer.stopUpdates()
        isPedometerRunning = false
    }

    // MARK: - Attendance Poll
    private func startAttendancePoll() {
        stopAttendancePoll()
        fetchAttendanceHoursAndPostNotification()
        attendancePollTimer = Timer.scheduledTimer(withTimeInterval: attendancePollInterval, repeats: true) { [weak self] _ in
            self?.fetchAttendanceHoursAndPostNotification()
        }
        if let t = attendancePollTimer { RunLoop.main.add(t, forMode: .common) }
    }

    private func stopAttendancePoll() {
        attendancePollTimer?.invalidate()
        attendancePollTimer = nil
    }

    // MARK: - BGTask
    @objc static func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: bgTaskIdentifier, using: nil) { task in
            guard let bgTask = task as? BGAppRefreshTask else { return }
            BackgroundTrackingService.shared.handleBackgroundTask(bgTask)
        }
    }

    private func scheduleBackgroundTask() {
        let request = BGAppRefreshTaskRequest(identifier: Self.bgTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: attendancePollInterval)
        try? BGTaskScheduler.shared.submit(request)
    }

    private func handleBackgroundTask(_ task: BGAppRefreshTask) {
        scheduleBackgroundTask()
        let work = DispatchWorkItem { [weak self] in
            self?.fetchAttendanceHoursAndPostNotification()
            task.setTaskCompleted(success: true)
        }
        task.expirationHandler = { work.cancel(); task.setTaskCompleted(success: false) }
        DispatchQueue.global(qos: .utility).async(execute: work)
    }

    // MARK: - Fetch Attendance & Notify
    private func fetchAttendanceHoursAndPostNotification() {
        guard let userId = userId, let supabaseUrl = supabaseUrl,
              let supabaseAnonKey = supabaseAnonKey, !isAuthPaused else { return }

        let dayFmt = DateFormatter()
        dayFmt.dateFormat = "yyyy-MM-dd"
        dayFmt.timeZone = TimeZone(identifier: "UTC")
        let today = dayFmt.string(from: Date())

        let base = supabaseUrl.hasSuffix("/") ? supabaseUrl : supabaseUrl + "/"
        let urlStr = base + "rest/v1/attendance_events"
            + "?user_id=eq.\(userId)"
            + "&timestamp=gte.\(today)T00:00:00.000Z"
            + "&timestamp=lte.\(today)T23:59:59.999Z"
            + "&order=timestamp.asc&select=type,timestamp,work_type"
        guard let url = URL(string: urlStr) else { return }

        var req = URLRequest(url: url)
        req.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(supabaseAccessToken ?? supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 10

        URLSession.shared.dataTask(with: req) { [weak self] data, response, error in
            guard let self = self else { return }
            if let http = response as? HTTPURLResponse, http.statusCode == 401 {
                self.attemptTokenRefresh { ok in
                    if ok { self.fetchAttendanceHoursAndPostNotification() } else { self.isAuthPaused = true }
                }
                return
            }
            guard let data = data, error == nil,
                  let events = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return }

            let mins = self.computeNetWorkMinutes(events: events)
            let body = "Working: \(mins/60)h \(mins%60)m  |  Steps: \(self.stepsToday)"
            NSLog("[BGTracking] \(body)")
            self.postLocalNotification(title: "Paradigm Services — Active", body: body)
        }.resume()
    }

    private func computeNetWorkMinutes(events: [[String: Any]]) -> Int {
        let maxMin = 30 * 60
        var net = 0; var isWorking = false; var isOnBreak = false; var lastMs: TimeInterval = 0
        let iso1 = ISO8601DateFormatter(); iso1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let iso2 = ISO8601DateFormatter(); iso2.formatOptions = [.withInternetDateTime]
        for ev in events {
            guard let type = ev["type"] as? String,
                  let ts = ev["timestamp"] as? String,
                  let date = iso1.date(from: ts) ?? iso2.date(from: ts) else { continue }
            let evMs = date.timeIntervalSince1970
            if lastMs > 0 {
                let elapsed = Int((evMs - lastMs) / 60)
                if isWorking && !isOnBreak { net += min(elapsed, maxMin) }
            }
            switch type {
            case "punch-in","site-in","site-ot-in": isWorking = true
            case "punch-out","site-out","site-ot-out": isWorking = false; isOnBreak = false
            case "break-in": isOnBreak = true
            case "break-out": isOnBreak = false
            default: break
            }
            lastMs = evMs
        }
        if isWorking && !isOnBreak && lastMs > 0 {
            let elapsed = Int((Date().timeIntervalSince1970 - lastMs) / 60)
            if elapsed <= maxMin { net += elapsed }
        }
        return net
    }

    private func attemptTokenRefresh(completion: @escaping (Bool) -> Void) {
        guard let rt = supabaseRefreshToken, let url0 = supabaseUrl, let key = supabaseAnonKey, !rt.isEmpty else { completion(false); return }
        let base = url0.hasSuffix("/") ? url0 : url0 + "/"
        guard let url = URL(string: base + "auth/v1/token?grant_type=refresh_token") else { completion(false); return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(key, forHTTPHeaderField: "apikey")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": rt])
        req.timeoutInterval = 15
        URLSession.shared.dataTask(with: req) { [weak self] data, _, _ in
            guard let self = self, let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let newToken = json["access_token"] as? String else { completion(false); return }
            self.supabaseAccessToken = newToken
            if let nr = json["refresh_token"] as? String { self.supabaseRefreshToken = nr; UserDefaults.standard.set(nr, forKey: "tracking_supabase_refresh_token") }
            UserDefaults.standard.set(newToken, forKey: "tracking_supabase_token")
            self.isAuthPaused = false
            completion(true)
        }.resume()
    }

    private func postLocalNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title; content.body = body; content.sound = nil
        let req = UNNotificationRequest(identifier: "paradigm-tracking-status", content: content, trigger: nil)
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ["paradigm-tracking-status"])
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }
}

// MARK: - CLLocationManagerDelegate
extension BackgroundTrackingService: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        uploadGPS(loc)
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if isTracking && !isLocationRunning { startLocationUpdates() }
    }

    private func uploadGPS(_ loc: CLLocation) {
        guard let userId = userId, let supabaseUrl = supabaseUrl,
              let anonKey = supabaseAnonKey, !isAuthPaused else { return }
        let base = supabaseUrl.hasSuffix("/") ? supabaseUrl : supabaseUrl + "/"
        guard let url = URL(string: base + "functions/v1/record-tracking-ping") else { return }
        let body: [String: Any] = [
            "requestId": UUID().uuidString, "userId": userId,
            "latitude": loc.coordinate.latitude, "longitude": loc.coordinate.longitude,
            "accuracy": loc.horizontalAccuracy,
            "timestamp": isoFormatter.string(from: loc.timestamp),
            "status": "successful", "source": "ios_background_service"
        ]
        guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(supabaseAccessToken ?? anonKey)", forHTTPHeaderField: "Authorization")
        req.httpBody = bodyData; req.timeoutInterval = 15
        URLSession.shared.dataTask(with: req) { [weak self] _, resp, _ in
            if let http = resp as? HTTPURLResponse, http.statusCode == 401 {
                self?.attemptTokenRefresh { ok in if ok { self?.uploadGPS(loc) } else { self?.isAuthPaused = true } }
            }
        }.resume()
    }
}
