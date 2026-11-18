import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {

    var webView: WKWebView!
    var activityIndicator: UIActivityIndicatorView!
    let targetURL = URL(string: "https://app.paradigmfms.com")!

    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        setupActivityIndicator()
        loadWebsite()
    }

    func setupWebView() {
        let webConfiguration = WKWebViewConfiguration()
        
        // Inject JS bridge if needed
        let userController = WKUserContentController()
        userController.add(self, name: "iosBridge")
        webConfiguration.userContentController = userController
        
        // Initialize WebView
        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        
        view.addSubview(webView)
        
        // Layout Constraints - edge to edge for Dynamic Island & safe areas
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
    }

    func setupActivityIndicator() {
        activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.center = self.view.center
        activityIndicator.hidesWhenStopped = true
        view.addSubview(activityIndicator)
    }

    func loadWebsite() {
        let request = URLRequest(url: targetURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 8.0)
        webView.load(request)
    }

    /// Loads the locally bundled web application assets when offline on cold launch.
    /// Resolves Audit Finding 15.
    func loadLocalBundle() {
        if let localURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "public") {
            NSLog("[WebView] Loading offline local bundle from \(localURL.path)")
            webView.loadFileURL(localURL, allowingReadAccessTo: localURL.deletingLastPathComponent())
        } else if let localRoot = Bundle.main.url(forResource: "index", withExtension: "html") {
            NSLog("[WebView] Loading root offline local bundle from \(localRoot.path)")
            webView.loadFileURL(localRoot, allowingReadAccessTo: localRoot.deletingLastPathComponent())
        } else {
            NSLog("[WebView] Local offline bundle not found in application bundle")
        }
    }

    // MARK: - WKNavigationDelegate
    
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        activityIndicator.startAnimating()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        activityIndicator.stopAnimating()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        activityIndicator.stopAnimating()
        NSLog("[WebView] Navigation failed: \(error.localizedDescription) — falling back to local bundle")
        loadLocalBundle()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        activityIndicator.stopAnimating()
        NSLog("[WebView] Provisional navigation failed: \(error.localizedDescription) — falling back to local bundle")
        loadLocalBundle()
    }

    // MARK: - WKUIDelegate for Alerts & File Upload
    
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alertController = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alertController.addAction(UIAlertAction(title: "OK", style: .default, handler: { _ in completionHandler() }))
        present(alertController, animated: true, completion: nil)
    }
    
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alertController = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alertController.addAction(UIAlertAction(title: "OK", style: .default, handler: { _ in completionHandler(true) }))
        alertController.addAction(UIAlertAction(title: "Cancel", style: .cancel, handler: { _ in completionHandler(false) }))
        present(alertController, animated: true, completion: nil)
    }

    // MARK: - WKScriptMessageHandler
    
    /// Connects JavaScript application actions to native Swift background services.
    /// Resolves Audit Finding 16.
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "iosBridge" {
            guard let dict = message.body as? [String: Any],
                  let action = dict["action"] as? String else {
                NSLog("[iosBridge] Received non-dictionary message: \(message.body)")
                return
            }

            NSLog("[iosBridge] Received action: \(action)")
            switch action {
            case "startTracking":
                let userId = dict["userId"] as? String ?? ""
                let supabaseUrl = dict["supabaseUrl"] as? String ?? ""
                let supabaseKey = dict["supabaseKey"] as? String ?? ""
                let accessToken = dict["accessToken"] as? String ?? ""
                let refreshToken = dict["refreshToken"] as? String ?? ""
                let interval = dict["intervalMinutes"] as? Int ?? 15
                BackgroundTrackingService.shared.startTracking(
                    userId: userId,
                    supabaseUrl: supabaseUrl,
                    supabaseKey: supabaseKey,
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                    intervalMinutes: interval
                )
            case "stopTracking":
                BackgroundTrackingService.shared.stopTracking()
            case "sessionChanged":
                let newToken = dict["accessToken"] as? String ?? ""
                let newRefresh = dict["refreshToken"] as? String ?? ""
                UserDefaults.standard.set(newToken, forKey: "tracking_supabase_token")
                UserDefaults.standard.set(newRefresh, forKey: "tracking_supabase_refresh_token")
                NSLog("[iosBridge] Updated session tokens for native background tracking")
            default:
                NSLog("[iosBridge] Unhandled action: \(action)")
            }
        }
    }
}
