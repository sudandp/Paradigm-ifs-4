package com.paradigm.ifs;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.BroadcastReceiver;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private BroadcastReceiver foregroundAlarmReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Prevent screen recording and screenshots system-wide
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        
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
        super.onCreate(savedInstanceState);
        createNotificationChannel();
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
        }
    }

    @Override
    public void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        handleAlarmIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        handleAlarmIntent(getIntent());

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

    private void handleAlarmIntent(android.content.Intent intent) {
        if (intent == null) return;
        
        final String action = intent.getStringExtra("action");
        final boolean fromAlarm = intent.getBooleanExtra("from_break_alarm", false);
        final int elapsedMinutes = intent.getIntExtra("elapsedMinutes", 15);
        final int notificationId = intent.getIntExtra("notificationId", 1001);

        if (action != null || fromAlarm) {
            // Cancel the notification that triggered this
            android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            if (notificationId > 0) {
                nm.cancel(notificationId - 1);
                nm.cancel(notificationId - 2);
                nm.cancel(notificationId);
            }
            // Broad cancel just in case
            nm.cancel(1001); 

            // Remove extras so we don't trigger it again on rotation
            intent.removeExtra("action");
            intent.removeExtra("from_break_alarm");

            // Dispatch to JS using evaluateJavascript on UI thread
            final String jsAction = action != null ? action : "OPEN_MODAL";
            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().post(new Runnable() {
                    @Override
                    public void run() {
                        String js = "window.dispatchEvent(new CustomEvent('breakAlarmAction', { detail: { action: '" + jsAction + "', elapsedMinutes: " + elapsedMinutes + " } }));";
                        bridge.getWebView().evaluateJavascript(js, null);
                    }
                });
            }
        }
    }
}
