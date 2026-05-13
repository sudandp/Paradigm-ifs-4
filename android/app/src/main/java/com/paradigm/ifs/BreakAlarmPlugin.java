package com.paradigm.ifs;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BreakAlarm")
public class BreakAlarmPlugin extends Plugin {

    @PluginMethod
    public void schedule(PluginCall call) {
        // Accept absolute epoch-ms trigger time from JS
        double triggerAtMsRaw = call.getDouble("triggerAtMs", 0.0);
        int notificationId = call.getInt("id", 1001);
        int elapsedMinutes = call.getInt("elapsedMinutes", 15);
        String soundFilename = call.getString("soundFilename", null);
        String soundUri = call.getString("soundUri", null);

        long triggerTime;
        if (triggerAtMsRaw > 0) {
            triggerTime = (long) triggerAtMsRaw;
        } else {
            // Legacy fallback: if no triggerAtMs, use intervalMinutes (shouldn't happen)
            double intervalMinutes = call.getDouble("intervalMinutes", 0.1666);
            triggerTime = System.currentTimeMillis() + (long)(intervalMinutes * 60 * 1000L);
        }

        // Don't schedule alarms in the past
        if (triggerTime <= System.currentTimeMillis()) {
            call.resolve();
            return;
        }

        AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(getContext(), BreakAlarmReceiver.class);
        intent.putExtra("id", notificationId);
        intent.putExtra("elapsedSeconds", elapsedMinutes * 60);
        if (soundUri != null) intent.putExtra("soundUri", soundUri);
        if (soundFilename != null) intent.putExtra("soundFilename", soundFilename);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getBroadcast(getContext(), notificationId, intent, flags);

        // Schedule exact alarm to fire even in Doze mode
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
                } else {
                    // Fallback if permission not granted
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent);
            }
        } catch (Exception e) {
            call.reject("Failed to schedule alarm", e);
            return;
        }

        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        int notificationId = call.getInt("id", 1001);
        Context context = getContext();

        // 1. Cancel the pending alarm
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, BreakAlarmReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, notificationId, intent, flags);
        alarmManager.cancel(pendingIntent);

        // 2. Cancel the active ringing notification
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(notificationId);

        call.resolve();
    }
}
