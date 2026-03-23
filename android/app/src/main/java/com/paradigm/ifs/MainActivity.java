package com.paradigm.ifs;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
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
}
