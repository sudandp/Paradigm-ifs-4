import UIKit
import UserNotifications
import BackgroundTasks
import CoreLocation

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Push notification setup
        UNUserNotificationCenter.current().delegate = self
        let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
        UNUserNotificationCenter.current().requestAuthorization(
            options: authOptions,
            completionHandler: { _, _ in }
        )
        application.registerForRemoteNotifications()

        // Register BGTaskScheduler identifier for background attendance sync.
        // MUST be called before app finishes launching.
        BackgroundTrackingService.registerBackgroundTasks()

        // Restore native tracking if the user was checked in before OS killed the app.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            BackgroundTrackingService.shared.restoreFromUserDefaults()
        }

        return true
    }

    // MARK: UISceneSession Lifecycle

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
    }
}
