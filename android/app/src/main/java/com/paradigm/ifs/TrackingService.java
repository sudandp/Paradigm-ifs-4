package com.paradigm.ifs;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class TrackingService extends Service implements SensorEventListener {
    private static final String TAG = "TrackingService";
    private static final String CHANNEL_ID = "tracking_service_channel";
    private static final int NOTIFICATION_ID = 9999;

    // ── SharedPreference keys ──────────────────────────────────────────────
    private static final String PREF_NAME        = "StepCounterPrefs";
    private static final String KEY_STEPS_TODAY  = "steps_today";
    private static final String KEY_BASELINE_DATE = "baseline_date";
    private static final String KEY_STEP_BASELINE = "step_baseline";

    // Keys passed in via Intent from TrackingPlugin / JS
    public static final String EXTRA_USER_ID           = "userId";
    public static final String EXTRA_INTERVAL_MINUTES  = "intervalMinutes";
    public static final String EXTRA_SUPABASE_URL      = "supabaseUrl";
    public static final String EXTRA_SUPABASE_KEY      = "supabaseKey";

    // ── Step counter ───────────────────────────────────────────────────────
    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private SharedPreferences prefs;

    public static final String ACTION_STEP_UPDATE   = "com.paradigm.ifs.STEP_UPDATE";
    public static final String EXTRA_STEPS          = "steps";
    public static final String EXTRA_TOTAL_STEPS    = "totalCumulativeSteps";

    // ── GPS / location ─────────────────────────────────────────────────────
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private ExecutorService networkExecutor;

    // Runtime config (set from Intent or SharedPrefs fallback)
    private String userId           = null;
    private String supabaseUrl      = null;
    private String supabaseAnonKey  = null;
    private int    intervalMinutes  = 15;

    // ── Lifecycle ──────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);

        // Step counter setup
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }

        // GPS setup
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        networkExecutor     = Executors.newSingleThreadExecutor();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // ── Read config from Intent ───────────────────────────────────────
        if (intent != null) {
            if (intent.hasExtra(EXTRA_USER_ID))          userId          = intent.getStringExtra(EXTRA_USER_ID);
            if (intent.hasExtra(EXTRA_SUPABASE_URL))     supabaseUrl     = intent.getStringExtra(EXTRA_SUPABASE_URL);
            if (intent.hasExtra(EXTRA_SUPABASE_KEY))     supabaseAnonKey = intent.getStringExtra(EXTRA_SUPABASE_KEY);
            if (intent.hasExtra(EXTRA_INTERVAL_MINUTES)) intervalMinutes = intent.getIntExtra(EXTRA_INTERVAL_MINUTES, 15);
        }

        // Persist config so it survives service restart (START_STICKY)
        if (userId != null) {
            prefs.edit()
                .putString("tracking_user_id",      userId)
                .putString("tracking_supabase_url", supabaseUrl != null ? supabaseUrl : "")
                .putString("tracking_supabase_key", supabaseAnonKey != null ? supabaseAnonKey : "")
                .putInt("tracking_interval_mins",   intervalMinutes)
                .apply();
        } else {
            // Restore from prefs when service is restarted by OS
            userId          = prefs.getString("tracking_user_id",      null);
            supabaseUrl     = prefs.getString("tracking_supabase_url", null);
            supabaseAnonKey = prefs.getString("tracking_supabase_key", null);
            intervalMinutes = prefs.getInt("tracking_interval_mins",   15);
        }

        String title = intent != null ? intent.getStringExtra("title") : null;
        String text  = intent != null ? intent.getStringExtra("text")  : null;
        if (title == null) title = "Paradigm Services";
        if (text  == null) text  = "Field operations tracking is active.";

        // ── Start foreground notification ─────────────────────────────────
        startAsForeground(title, text);

        // ── Start step counting ───────────────────────────────────────────
        if (stepCounterSensor != null) {
            sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_UI);
        }

        // ── Start GPS location updates ────────────────────────────────────
        startLocationUpdates();

        Log.i(TAG, "TrackingService started — userId=" + userId + " interval=" + intervalMinutes + "m");
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopLocationUpdates();
        if (sensorManager != null) sensorManager.unregisterListener(this);
        if (networkExecutor != null) networkExecutor.shutdownNow();
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        // Auto-restart when the user swipes the app away from recents
        Intent restartIntent = new Intent(getApplicationContext(), TrackingService.class);
        restartIntent.putExtra("title", "Paradigm Services");
        restartIntent.putExtra("text",  "Field operations tracking is active.");
        PendingIntent pi = PendingIntent.getService(this, 1, restartIntent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 2000, pi);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── GPS ────────────────────────────────────────────────────────────────

    private void startLocationUpdates() {
        if (userId == null || supabaseUrl == null || supabaseAnonKey == null) {
            Log.w(TAG, "startLocationUpdates: missing config — skipping GPS");
            return;
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "startLocationUpdates: location permission not granted");
            return;
        }

        long intervalMs = (long) intervalMinutes * 60 * 1000L;

        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
                .setMinUpdateIntervalMillis(intervalMs / 2)
                .setMaxUpdateDelayMillis(intervalMs + 30_000L)  // allow slight delay batching
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;
                Location loc = result.getLastLocation();
                if (loc == null) return;
                Log.i(TAG, "GPS ping: " + loc.getLatitude() + ", " + loc.getLongitude());
                uploadLocationToSupabase(loc);
            }
        };

        try {
            fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
            Log.i(TAG, "GPS updates requested every " + intervalMinutes + " min(s)");
        } catch (SecurityException e) {
            Log.e(TAG, "GPS permission error", e);
        }
    }

    private void stopLocationUpdates() {
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
    }

    /**
     * POSTs a location row to Supabase `route_history` table via REST API.
     * Runs on a background thread so the main thread is never blocked.
     */
    private void uploadLocationToSupabase(Location loc) {
        if (userId == null || supabaseUrl == null || supabaseAnonKey == null) return;

        final double lat = loc.getLatitude();
        final double lng = loc.getLongitude();
        final float  acc = loc.getAccuracy();
        final String ts  = isoTimestamp();

        networkExecutor.execute(() -> {
            try {
                String endpoint = supabaseUrl.endsWith("/")
                        ? supabaseUrl + "rest/v1/route_history"
                        : supabaseUrl + "/rest/v1/route_history";

                JSONObject body = new JSONObject();
                body.put("user_id",   userId);
                body.put("latitude",  lat);
                body.put("longitude", lng);
                body.put("accuracy",  acc);
                body.put("timestamp", ts);

                URL url = new URL(endpoint);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type",  "application/json");
                conn.setRequestProperty("apikey",        supabaseAnonKey);
                conn.setRequestProperty("Authorization", "Bearer " + supabaseAnonKey);
                conn.setRequestProperty("Prefer",        "return=minimal");
                conn.setDoOutput(true);
                conn.setConnectTimeout(15_000);
                conn.setReadTimeout(15_000);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes("UTF-8"));
                }

                int code = conn.getResponseCode();
                if (code == 201 || code == 200) {
                    Log.i(TAG, "✅ Location uploaded: " + lat + "," + lng + " at " + ts);
                } else {
                    Log.w(TAG, "⚠️ Supabase returned HTTP " + code + " for location upload");
                }
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to upload location", e);
            }
        });
    }

    private static String isoTimestamp() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        return sdf.format(new Date());
    }

    // ── Foreground notification ────────────────────────────────────────────

    private void startAsForeground(String title, String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0,
                notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground", e);
            stopSelf();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Field Tracking Service", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Keeps GPS tracking active while app is in background");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    // ── Step counter ───────────────────────────────────────────────────────

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER) return;

        float rawCumulativeSteps = event.values[0];
        String todayDate   = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        String savedDate   = prefs.getString(KEY_BASELINE_DATE, "");
        float stepBaseline = prefs.getFloat(KEY_STEP_BASELINE, -1);
        int accumulatedSteps = prefs.getInt("accumulated_steps", 0);

        if (!todayDate.equals(savedDate) || stepBaseline < 0 || rawCumulativeSteps < stepBaseline) {
            stepBaseline = rawCumulativeSteps;
            if (!todayDate.equals(savedDate)) {
                accumulatedSteps = 0;
            } else {
                accumulatedSteps = prefs.getInt(KEY_STEPS_TODAY, 0);
            }
            prefs.edit()
                .putString(KEY_BASELINE_DATE,  todayDate)
                .putFloat(KEY_STEP_BASELINE,   stepBaseline)
                .putInt("accumulated_steps",   accumulatedSteps)
                .apply();
        }

        int delta            = (int) (rawCumulativeSteps - stepBaseline);
        int currentStepsToday = accumulatedSteps + delta;

        Intent broadcastIntent = new Intent(ACTION_STEP_UPDATE);
        broadcastIntent.putExtra(EXTRA_STEPS,       currentStepsToday);
        broadcastIntent.putExtra(EXTRA_TOTAL_STEPS, (int) rawCumulativeSteps);
        LocalBroadcastManager.getInstance(this).sendBroadcast(broadcastIntent);

        prefs.edit().putInt(KEY_STEPS_TODAY, currentStepsToday).apply();
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}
}
