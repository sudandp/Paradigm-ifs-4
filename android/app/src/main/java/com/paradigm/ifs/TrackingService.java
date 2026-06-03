package com.paradigm.ifs;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class TrackingService extends Service implements SensorEventListener {
    private static final String CHANNEL_ID = "tracking_service_channel";
    private static final int NOTIFICATION_ID = 9999;

    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    
    private SharedPreferences prefs;
    private static final String PREF_NAME = "StepCounterPrefs";
    private static final String KEY_STEPS_TODAY = "steps_today";
    private static final String KEY_BASELINE_DATE = "baseline_date";
    private static final String KEY_STEP_BASELINE = "step_baseline";
    
    public static final String ACTION_STEP_UPDATE = "com.paradigm.ifs.STEP_UPDATE";
    public static final String EXTRA_STEPS = "steps";
    public static final String EXTRA_TOTAL_STEPS = "totalCumulativeSteps";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        
        prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent.getStringExtra("title");
        String text = intent.getStringExtra("text");
        if (title == null) title = "Paradigm Services";
        if (text == null) text = "Field operations tracking is active.";

        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this,
                0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW) // Minimal intrusion
                .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            e.printStackTrace();
            stopSelf(); // Stop service gracefully if it fails to start in foreground
        }

        // Start Step Counting
        if (stepCounterSensor != null) {
            sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_UI);
        }

        // START_STICKY ensures the service re-starts if it's killed by the OS
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        
        // Auto-restart the tracking service if the app is killed from recent apps
        Intent restartIntent = new Intent(getApplicationContext(), TrackingService.class);
        restartIntent.putExtra("title", "Paradigm Services");
        restartIntent.putExtra("text", "Field operations tracking is active.");
        
        PendingIntent pendingIntent = PendingIntent.getService(this, 1, restartIntent, PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 1000, pendingIntent);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Field Tracking Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Keeps the application alive for real-time field tracking");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            float rawCumulativeSteps = event.values[0];
            
            String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
            String savedDate = prefs.getString(KEY_BASELINE_DATE, "");
            float stepBaseline = prefs.getFloat(KEY_STEP_BASELINE, -1);
            
            // Read accumulated steps from previous sessions/reboots today
            int accumulatedSteps = prefs.getInt("accumulated_steps", 0);

            // Handle day rollover or first time tracking or reboot (sensor reset)
            if (!todayDate.equals(savedDate) || stepBaseline < 0 || rawCumulativeSteps < stepBaseline) {
                // It's a new day, or sensor was reset (reboot)
                stepBaseline = rawCumulativeSteps;
                if (!todayDate.equals(savedDate)) {
                    accumulatedSteps = 0;
                } else {
                    // Reboot happened mid-day. Save the steps tracked so far today into accumulatedSteps
                    accumulatedSteps = prefs.getInt(KEY_STEPS_TODAY, 0);
                }
                SharedPreferences.Editor editor = prefs.edit();
                editor.putString(KEY_BASELINE_DATE, todayDate);
                editor.putFloat(KEY_STEP_BASELINE, stepBaseline);
                editor.putInt("accumulated_steps", accumulatedSteps);
                editor.apply();
            }

            // Calculate new steps taken since baseline
            int delta = (int) (rawCumulativeSteps - stepBaseline);
            int currentStepsToday = accumulatedSteps + delta;

            // Broadcast the update
            Intent broadcastIntent = new Intent(ACTION_STEP_UPDATE);
            broadcastIntent.putExtra(EXTRA_STEPS, currentStepsToday);
            broadcastIntent.putExtra(EXTRA_TOTAL_STEPS, (int) rawCumulativeSteps);
            LocalBroadcastManager.getInstance(this).sendBroadcast(broadcastIntent);

            // Final write: ONLY update steps today. Baseline remains fixed until next day/reboot.
            SharedPreferences.Editor editor = prefs.edit();
            editor.putInt(KEY_STEPS_TODAY, currentStepsToday);
            editor.apply();
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }
}
