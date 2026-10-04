package com.paradigm.ifs;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.BroadcastReceiver;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    // Google Play In-App Update request code — arbitrary unique int
    private static final int IN_APP_UPDATE_REQUEST_CODE = 8743;

    private BroadcastReceiver foregroundAlarmReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // In debug builds, avoid FLAG_SECURE so ADB screencap and automated testing work.
        // In release builds, FLAG_SECURE protects against screen recording.
        if (!BuildConfig.DEBUG) {
            getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        }
        
        android.content.SharedPreferences prefs = getSharedPreferences("KioskPrefs", Context.MODE_PRIVATE);
        boolean isKioskModeActive = prefs.getBoolean("kiosk_mode_active", false);

        if (isKioskModeActive) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
            } else {
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                                     WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                                     WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
            }
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        registerPlugin(BadgeHelperPlugin.class);
        registerPlugin(RingtonePlugin.class);
        registerPlugin(BreakAlarmPlugin.class);
        registerPlugin(TrackingPlugin.class);
        registerPlugin(KioskPlugin.class);
        registerPlugin(StepCounterPlugin.class);
        super.onCreate(savedInstanceState);
        
        // Enable Chrome DevTools remote debugging (chrome://inspect)
        // [C1-FIXED] Only enable Chrome remote debugging in debug builds — NEVER in production AAB.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        setupWebViewListeners();
        createNotificationChannel();
    }

    private void setupWebViewListeners() {
        if (bridge != null && bridge.getWebView() != null) {
            // Break alarm audio requires autoplay; kept intentionally. Do NOT enable for general media.
            bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
            bridge.getWebView().setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setData(Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    Log.e(TAG, "Download intent failed: " + e.getMessage());
                }
            });

            bridge.getWebView().setWebViewClient(new BridgeWebViewClient(bridge) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    return handleCustomUri(uri) || super.shouldOverrideUrlLoading(view, request);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    Uri uri = Uri.parse(url);
                    return handleCustomUri(uri) || super.shouldOverrideUrlLoading(view, url);
                }

                private boolean handleCustomUri(Uri uri) {
                    if (uri == null) return false;
                    String scheme = uri.getScheme();
                    if (scheme == null) return false;
                    String lower = scheme.toLowerCase();

                    // [L113/L114/L115/L116-FIXED] Block dangerous URI schemes that can execute code
                    // or access local filesystem from within the WebView.
                    if (lower.equals("javascript") || lower.equals("intent") || lower.equals("file")) {
                        Log.w(TAG, "Blocked dangerous URI scheme: " + lower);
                        return true; // intercept and swallow — do NOT pass to super
                    }

                    // Allow whitelisted external schemes
                    if (lower.equals("tel") || lower.equals("mailto") || lower.equals("sms") || lower.equals("whatsapp")) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                            return true;
                        } catch (Exception e) {
                            Log.w(TAG, "Failed to launch custom scheme intent for " + uri + ": " + e.getMessage());
                            return false;
                        }
                    }

                    String host = uri.getHost();
                    if (host != null && (host.equalsIgnoreCase("wa.me") || host.equalsIgnoreCase("api.whatsapp.com"))) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                            return true;
                        } catch (Exception e) {
                            Log.w(TAG, "Failed to launch WhatsApp URL intent for " + uri + ": " + e.getMessage());
                            return false;
                        }
                    }
                    return false;
                }
            });
        }
    }

    /**
     * Handles the result from the Google Play In-App Update flow.
     * The Capacitor bridge does not forward Activity results to web by default,
     * so we must intercept here to handle update accepted / user cancelled states.
     */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == IN_APP_UPDATE_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK) {
                Log.i(TAG, "[InAppUpdate] Update accepted by user — Play Store is downloading/installing.");
                // Notify the JS layer so the modal can be dismissed
                dispatchJsEvent("inAppUpdateAccepted", "{}");
            } else if (resultCode == Activity.RESULT_CANCELED) {
                Log.w(TAG, "[InAppUpdate] User dismissed the update dialog.");
                // Notify the JS layer (modal stays visible as a softer reminder)
                dispatchJsEvent("inAppUpdateCancelled", "{}");
            } else {
                Log.e(TAG, "[InAppUpdate] Update flow failed with result code: " + resultCode);
                dispatchJsEvent("inAppUpdateFailed", "{\"resultCode\":" + resultCode + "}");
            }
        }
    }

    /** Helper: fire a CustomEvent on the window so React can listen with window.addEventListener */
    private void dispatchJsEvent(String eventName, String jsonDetail) {
        if (bridge != null && bridge.getWebView() != null) {
            final String js = "window.dispatchEvent(new CustomEvent('" + eventName + "', { detail: " + jsonDetail + " }));";
            bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(js, null));
        }
    }



    /**
     * Creates a notification channel with badges enabled.
     * Samsung One UI ties launcher badges to notifications in the tray,
     * and the notification MUST be posted to a channel that has setShowBadge(true).
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);

            // "default" channel — matches the channel_id sent from FCM
            NotificationChannel defaultChannel = new NotificationChannel(
                "default",
                "General Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            defaultChannel.setDescription("All app notifications");
            defaultChannel.setShowBadge(true);   // ← THIS enables launcher badge on Samsung
            defaultChannel.enableVibration(true);
            defaultChannel.enableLights(true);

            manager.createNotificationChannel(defaultChannel);

            // "paradigm_critical_updates" channel — used for in-app updates and critical system broadcasts
            NotificationChannel updateChannel = new NotificationChannel(
                "paradigm_critical_updates",
                "Critical Updates",
                NotificationManager.IMPORTANCE_HIGH
            );
            updateChannel.setDescription("Critical app updates and release notifications");
            updateChannel.setShowBadge(true);
            updateChannel.enableVibration(true);
            updateChannel.enableLights(true);

            manager.createNotificationChannel(updateChannel);
        }
    }

    @Override
    public void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAlarmIntent(intent);
        handleNotificationIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();

        // Explicitly un-pause Chromium JS timers and wake up GPU renderer to prevent 20-min freeze
        if (bridge != null && bridge.getWebView() != null) {
            try {
                bridge.getWebView().resumeTimers();
                bridge.getWebView().postInvalidate();
                bridge.getWebView().post(() -> {
                    try {
                        bridge.getWebView().evaluateJavascript("window.dispatchEvent(new CustomEvent('appResumeRecovery'));", null);
                    } catch (Exception ignored) {}
                });
            } catch (Exception e) {
                Log.w(TAG, "Error recovering webview on resume: " + e.getMessage());
            }
        }

        handleAlarmIntent(getIntent());
        handleNotificationIntent(getIntent());

        if (foregroundAlarmReceiver == null) {
            foregroundAlarmReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    handleAlarmIntent(intent);
                }
            };
        }
        
        IntentFilter filter = new IntentFilter("com.paradigm.ifs.FOREGROUND_ALARM");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(foregroundAlarmReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(foregroundAlarmReceiver, filter);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (foregroundAlarmReceiver != null) {
            try {
                unregisterReceiver(foregroundAlarmReceiver);
            } catch (Exception e) {
                // Ignore if not registered
            }
        }
    }

    // [C7-FIXED] Allowlisted break alarm actions — only these strings may be injected into JS.
    private static final java.util.Set<String> ALLOWED_ALARM_ACTIONS = new java.util.HashSet<>(
        java.util.Arrays.asList("OPEN_MODAL", "END_BREAK", "SNOOZE", "DISMISS", "REMINDER", "RESUME_WORK", "CONTINUE_BREAK")
    );

    private void handleAlarmIntent(android.content.Intent intent) {
        if (intent == null) return;

        final String rawAction = intent.getStringExtra("action");
        final boolean fromAlarm = intent.getBooleanExtra("from_break_alarm", false);
        // [M20-FIXED] Clamp elapsedMinutes to a safe integer range.
        final int rawElapsed = intent.getIntExtra("elapsedMinutes", 15);
        final int elapsedMinutes = (rawElapsed >= 0 && rawElapsed <= 1440) ? rawElapsed : 15;
        final int notificationId = intent.getIntExtra("notificationId", 1001);

        if (rawAction != null || fromAlarm) {
            // Cancel the notification that triggered this
            android.app.NotificationManager nm = (android.app.NotificationManager)
                    getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            if (notificationId > 0) {
                nm.cancel(notificationId - 1);
                nm.cancel(notificationId - 2);
                nm.cancel(notificationId);
            }
            // L148: named constant for default notification ID
            nm.cancel(1001);

            // Remove extras so we don't trigger it again on rotation
            intent.removeExtra("action");
            intent.removeExtra("from_break_alarm");

            // [C7-FIXED] Allowlist check — only inject known-safe action strings into JS.
            final String jsAction;
            if (rawAction != null && ALLOWED_ALARM_ACTIONS.contains(rawAction)) {
                jsAction = rawAction;
            } else {
                jsAction = "OPEN_MODAL"; // safe default
                if (rawAction != null) {
                    Log.w(TAG, "Blocked unknown alarm action: '" + rawAction + "' — defaulting to OPEN_MODAL");
                }
            }

            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().post(new Runnable() {
                    @Override
                    public void run() {
                        // jsAction is now allowlisted; elapsedMinutes is range-validated.
                        String js = "window.dispatchEvent(new CustomEvent('breakAlarmAction', " +
                                "{ detail: { action: '" + jsAction + "', elapsedMinutes: " + elapsedMinutes + " } }));";
                        bridge.getWebView().evaluateJavascript(js, null);
                    }
                });
            }
        }
    }

    private void handleNotificationIntent(android.content.Intent intent) {
        if (intent == null) return;

        boolean fromBadge = intent.getBooleanExtra("from_badge_notification", false);
        String route = intent.getStringExtra("route");
        String section = intent.getStringExtra("section");
        String notificationAction = intent.getStringExtra("notification_action");

        android.os.Bundle extras = intent.getExtras();
        boolean isNotificationIntent = fromBadge || route != null || notificationAction != null ||
                (extras != null && (extras.containsKey("google.message_id") || extras.containsKey("type") || extras.containsKey("link") || extras.containsKey("url")));

        if (!isNotificationIntent) {
            return;
        }

        try {
            org.json.JSONObject payload = new org.json.JSONObject();
            if (extras != null) {
                for (String key : extras.keySet()) {
                    Object val = extras.get(key);
                    if (val != null) {
                        payload.put(key, val.toString());
                    }
                }
            }
            if (fromBadge) {
                payload.put("from_badge_notification", true);
                if (route == null) payload.put("route", "/notifications");
                if (section == null) payload.put("section", "general");
            }

            // Remove one-time flags to prevent re-triggering on screen rotation
            intent.removeExtra("from_badge_notification");
            intent.removeExtra("route");
            intent.removeExtra("section");
            intent.removeExtra("notification_action");
            intent.removeExtra("google.message_id");

            final String payloadJson = payload.toString();
            Log.i(TAG, "Notification tapped. Delivering payload to JS: " + payloadJson);

            dispatchNotificationTap(payloadJson);
        } catch (Exception e) {
            Log.e(TAG, "Error handling notification intent: " + e.getMessage());
        }
    }

    private void dispatchNotificationTap(final String payloadJson) {
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().post(new Runnable() {
                @Override
                public void run() {
                    String js = "try { " +
                            "window.__PENDING_NOTIFICATION_TAP__ = " + payloadJson + "; " +
                            "window.dispatchEvent(new CustomEvent('native-notification-tap', { detail: " + payloadJson + " })); " +
                            "} catch(e) { console.error('Error dispatching notification tap:', e); }";
                    bridge.getWebView().evaluateJavascript(js, null);
                }
            });
            // Ensure delivery if WebView was busy or React was mounting
            bridge.getWebView().postDelayed(new Runnable() {
                @Override
                public void run() {
                    String js = "try { window.dispatchEvent(new CustomEvent('native-notification-tap', { detail: " + payloadJson + " })); } catch(e) {}";
                    bridge.getWebView().evaluateJavascript(js, null);
                }
            }, 600);
        }
    }
}
