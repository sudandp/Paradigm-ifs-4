package com.paradigm.ifs;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

public class BreakAlarmReceiver extends BroadcastReceiver {
    
    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra("id", 1001);
        String soundUri = intent.getStringExtra("soundUri");
        String soundFilename = intent.getStringExtra("soundFilename");
        int elapsedSeconds = intent.getIntExtra("elapsedSeconds", 900); // Default 15m

        // 1. Wake the screen
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
            "Paradigm::BreakAlarmWakeLock"
        );
        wakeLock.acquire(3 * 60 * 1000L); // 3 minutes timeout

        // 2. Intent to open MainActivity on tap or full-screen
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        openIntent.putExtra("from_break_alarm", true);
        openIntent.putExtra("elapsedMinutes", (int)Math.round(elapsedSeconds / 60.0));
        openIntent.putExtra("notificationId", id);
        PendingIntent pendingOpen = PendingIntent.getActivity(context, id, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // 3. Action Buttons
        Intent resumeIntent = new Intent(context, MainActivity.class);
        resumeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        resumeIntent.putExtra("action", "RESUME_WORK");
        resumeIntent.putExtra("notificationId", id);
        PendingIntent pendingResume = PendingIntent.getActivity(context, id + 1, resumeIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent continueIntent = new Intent(context, MainActivity.class);
        continueIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        continueIntent.putExtra("action", "CONTINUE_BREAK");
        continueIntent.putExtra("notificationId", id);
        continueIntent.putExtra("elapsedMinutes", (int)Math.round(elapsedSeconds / 60.0));
        PendingIntent pendingContinue = PendingIntent.getActivity(context, id + 2, continueIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        // 4. Create Channel (Insistent Alarms)
        String channelId = "break_alarm_";
        if (soundUri != null && !soundUri.isEmpty()) {
            channelId += soundUri.hashCode();
        } else if (soundFilename != null && !soundFilename.isEmpty()) {
            channelId += soundFilename.hashCode();
        } else {
            channelId += "default";
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Urgent Break Alarms", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Full-screen insistent alarms for break limits.");
            
            Uri actualSoundUri = null;
            if (soundUri != null && !soundUri.isEmpty()) {
                actualSoundUri = Uri.parse(soundUri);
            } else if (soundFilename != null && !soundFilename.isEmpty()) {
                int resId = context.getResources().getIdentifier(soundFilename, "raw", context.getPackageName());
                if (resId != 0) {
                    actualSoundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + resId);
                }
            }
            
            if (actualSoundUri != null) {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build();
                channel.setSound(actualSoundUri, audioAttributes);
            }
            
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 500, 500, 500});
            nm.createNotificationChannel(channel);
        }

        // 5. Build the Notification
        int iconResId = context.getResources().getIdentifier("ic_stat_icon_config_sample", "drawable", context.getPackageName());
        if (iconResId == 0) {
            iconResId = context.getResources().getIdentifier("ic_launcher", "mipmap", context.getPackageName());
        }

        String displayTime = elapsedSeconds < 60 
            ? elapsedSeconds + " seconds" 
            : (elapsedSeconds / 60) + " minutes";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(iconResId)
                .setContentTitle("🔔 Break Reminder")
                .setContentText("You've been on break for " + displayTime + ". Still on break?")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setOngoing(true) // CANNOT SWIPE
                .setAutoCancel(false)
                .setFullScreenIntent(pendingOpen, true) // WAKES SCREEN
                .setContentIntent(pendingOpen)
                .addAction(0, "Resume Work 🏁", pendingResume)
                .addAction(0, "Still on Break ☕", pendingContinue);

        // Fallback for older Android versions
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            Uri actualSoundUri = null;
            if (soundUri != null && !soundUri.isEmpty()) {
                actualSoundUri = Uri.parse(soundUri);
            } else if (soundFilename != null && !soundFilename.isEmpty()) {
                int resId = context.getResources().getIdentifier(soundFilename, "raw", context.getPackageName());
                if (resId != 0) {
                    actualSoundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + resId);
                }
            }
            if (actualSoundUri != null) {
                builder.setSound(actualSoundUri);
            }
            builder.setVibrate(new long[]{0, 500, 500, 500});
        }

        Notification notification = builder.build();
        // INFINITE LOOPING SOUND
        notification.flags |= Notification.FLAG_INSISTENT; 

        nm.notify(id, notification);

        // Broadcast to MainActivity if the app is in the foreground
        Intent localIntent = new Intent("com.paradigm.ifs.FOREGROUND_ALARM");
        localIntent.setPackage(context.getPackageName());
        localIntent.putExtra("from_break_alarm", true);
        localIntent.putExtra("elapsedMinutes", (int)Math.round(elapsedSeconds / 60.0));
        localIntent.putExtra("notificationId", id);
        context.sendBroadcast(localIntent);

        wakeLock.release();
    }
}
