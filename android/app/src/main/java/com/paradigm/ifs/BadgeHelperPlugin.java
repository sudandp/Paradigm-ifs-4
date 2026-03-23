package com.paradigm.ifs;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BadgeHelper")
public class BadgeHelperPlugin extends Plugin {

    private static final int NOTIFICATION_ID = 848923;
    private static final String CHANNEL_ID = "badge_sync_channel";

    @PluginMethod
    public void setBadgeWithNotification(PluginCall call) {
        int count = call.getInt("count", 0);
        Context context = getContext();

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);

        if (count <= 0) {
            notificationManager.cancel(NOTIFICATION_ID);
            call.resolve();
            return;
        }

        // Create channel if needed
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Pending Notifications", // Channel name shown in settings
                    NotificationManager.IMPORTANCE_LOW // Low importance, shows in shade but no sound
            );
            channel.setShowBadge(true); // Explicitly tell the system this channel supports badges
            channel.setDescription("Shows a summary of all pending items");
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);

        // Required icon. Normally ic_stat_icon_config_sample is the standard capacitor push icon.
        // We will try that, or fallback to the app icon.
        int iconId = context.getResources().getIdentifier("ic_stat_icon_config_sample", "drawable", context.getPackageName());
        if (iconId == 0) {
            iconId = context.getApplicationInfo().icon;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(iconId)
                .setContentTitle("Pending Items")
                .setContentText("You have " + count + " unread notifications or approvals.")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setNumber(count) // THE MAGIC BULLET FOR SAMSUNG
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setOngoing(false);

        try {
            notificationManager.notify(NOTIFICATION_ID, builder.build());
            call.resolve();
        } catch (SecurityException e) {
            call.reject("Permission denied", e);
        }
    }
}
