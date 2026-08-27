package com.paradigm.ifs;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
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
import android.os.PowerManager;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.ActivityRecognitionClient;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionEvent;
import com.google.android.gms.location.ActivityTransitionRequest;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class TrackingService extends Service implements SensorEventListener {
    private static final String TAG = "TrackingService";
    private static final String CHANNEL_ID = "tracking_service_channel";
    private static final int NOTIFICATION_ID = 9999;

    private PowerManager.WakeLock wakeLock;

    // ── SharedPreference keys ──────────────────────────────────────────────
    private static final String PREF_NAME        = "StepCounterPrefs";
    private static final String KEY_STEPS_TODAY  = "steps_today";
    private static final String KEY_BASELINE_DATE = "baseline_date";
    private static final String KEY_STEP_BASELINE = "step_baseline";

    // Keys passed in via Intent from TrackingPlugin / JS
    public static final String EXTRA_USER_ID                = "userId";
    public static final String EXTRA_INTERVAL_MINUTES       = "intervalMinutes";
    public static final String EXTRA_SUPABASE_URL           = "supabaseUrl";
    public static final String EXTRA_SUPABASE_KEY           = "supabaseKey";
    public static final String EXTRA_SUPABASE_TOKEN         = "supabaseToken"; // user JWT access token
    public static final String EXTRA_SUPABASE_REFRESH_TOKEN = "supabaseRefreshToken"; // user JWT refresh token
    public static final String ACTION_UPDATE_TOKENS         = "com.paradigm.ifs.UPDATE_TOKENS";

    // ── Step counter ───────────────────────────────────────────────────────
    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private SharedPreferences prefs;

    public static final String ACTION_STEP_UPDATE   = "com.paradigm.ifs.STEP_UPDATE";
    public static final String EXTRA_STEPS          = "steps";
    public static final String EXTRA_TOTAL_STEPS    = "totalCumulativeSteps";

    // ── Activity Recognition ───────────────────────────────────────────────
    // isUserWalking gates step broadcasts: true = walking/running, false = vehicle/bike/still
    // Default true so steps count if Activity Recognition is unavailable (graceful fallback)
    private volatile boolean isUserWalking = true;
    private ActivityRecognitionClient activityRecognitionClient;
    private PendingIntent activityTransitionPendingIntent;
    private BroadcastReceiver activityTransitionReceiver;
    private static final String ACTION_ACTIVITY_TRANSITION = "com.paradigm.ifs.ACTIVITY_TRANSITION";

    // ── GPS / location ─────────────────────────────────────────────────────
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private ExecutorService networkExecutor;

    // Runtime config (set from Intent or SharedPrefs fallback)
    private String userId               = null;
    private String supabaseUrl          = null;
    private String supabaseAnonKey      = null;
    private String supabaseAccessToken  = null; // JWT Bearer token
    private String supabaseRefreshToken = null; // Refresh token for auto-renewal
    private volatile boolean isAuthPaused = false; // Circuit breaker when auth is invalid
    private int    intervalMinutes      = 15;


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

        // Activity Recognition setup
        activityRecognitionClient = ActivityRecognition.getClient(this);
        setupActivityTransitionReceiver();

        // Acquire partial wakelock so CPU executes background GPS and step batches in Doze mode
        acquireWakeLock();
    }

    private void acquireWakeLock() {
        if (wakeLock == null) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ParadigmIFS:TrackingWakeLock");
                    wakeLock.setReferenceCounted(false);
                    wakeLock.acquire(24 * 60 * 60 * 1000L); // 24-hour safeguard
                    Log.i(TAG, "Partial WakeLock acquired for background operations");
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to acquire WakeLock: " + e.getMessage());
            }
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null) {
            try {
                if (wakeLock.isHeld()) {
                    wakeLock.release();
                }
                wakeLock = null;
                Log.i(TAG, "Partial WakeLock released");
            } catch (Exception e) {
                Log.w(TAG, "Failed to release WakeLock: " + e.getMessage());
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Ensure wakelock is active
        acquireWakeLock();

        // ── Read config from Intent ───────────────────────────────────────
        if (intent != null) {
            if (intent.hasExtra(EXTRA_USER_ID))                userId               = intent.getStringExtra(EXTRA_USER_ID);
            if (intent.hasExtra(EXTRA_SUPABASE_URL))           supabaseUrl          = intent.getStringExtra(EXTRA_SUPABASE_URL);
            if (intent.hasExtra(EXTRA_SUPABASE_KEY))           supabaseAnonKey      = intent.getStringExtra(EXTRA_SUPABASE_KEY);
            if (intent.hasExtra(EXTRA_SUPABASE_TOKEN))         supabaseAccessToken  = intent.getStringExtra(EXTRA_SUPABASE_TOKEN);
            if (intent.hasExtra(EXTRA_SUPABASE_REFRESH_TOKEN)) supabaseRefreshToken = intent.getStringExtra(EXTRA_SUPABASE_REFRESH_TOKEN);
            if (intent.hasExtra(EXTRA_INTERVAL_MINUTES))       intervalMinutes      = intent.getIntExtra(EXTRA_INTERVAL_MINUTES, 15);

            if (supabaseAccessToken != null && !supabaseAccessToken.isEmpty()) {
                isAuthPaused = false; // Resume auth network requests when new token is received
            }
        }

        // Persist config so it survives service restart (START_STICKY)
        if (userId != null) {
            prefs.edit()
                .putString("tracking_user_id",               userId)
                .putString("tracking_supabase_url",          supabaseUrl != null ? supabaseUrl : "")
                .putString("tracking_supabase_key",          supabaseAnonKey != null ? supabaseAnonKey : "")
                .putString("tracking_supabase_token",        supabaseAccessToken != null ? supabaseAccessToken : "")
                .putString("tracking_supabase_refresh_token",supabaseRefreshToken != null ? supabaseRefreshToken : "")
                .putInt("tracking_interval_mins",            intervalMinutes)
                .apply();
        } else {
            // Restore from prefs when service is restarted by OS
            userId               = prefs.getString("tracking_user_id",               null);
            supabaseUrl          = prefs.getString("tracking_supabase_url",          null);
            supabaseAnonKey      = prefs.getString("tracking_supabase_key",          null);
            supabaseAccessToken  = prefs.getString("tracking_supabase_token",        null);
            supabaseRefreshToken = prefs.getString("tracking_supabase_refresh_token",null);
            intervalMinutes      = prefs.getInt("tracking_interval_mins",            15);
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
        stopActivityTransitionUpdates();
        if (sensorManager != null) sensorManager.unregisterListener(this);
        if (networkExecutor != null) networkExecutor.shutdownNow();
        if (activityTransitionReceiver != null) {
            try { unregisterReceiver(activityTransitionReceiver); } catch (Exception ignored) {}
        }
        releaseWakeLock();
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
                .setMinUpdateIntervalMillis(Math.min(intervalMs / 2, 30_000L))
                .setMaxUpdateDelayMillis(0)
                .setWaitForAccurateLocation(false)
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

            // Immediately capture initial location on service start
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener(location -> {
                    if (location != null) {
                        Log.i(TAG, "Initial GPS location acquired: " + location.getLatitude() + ", " + location.getLongitude());
                        uploadLocationToSupabase(location);
                    }
                });
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

        if (isAuthPaused) {
            Log.w(TAG, "uploadLocationToSupabase: Auth paused due to invalid token — deferring upload until session refreshed");
            return;
        }

        final double lat = loc.getLatitude();
        final double lng = loc.getLongitude();
        final float  acc = loc.getAccuracy();

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        final String ts = sdf.format(new Date(loc.getTime()));

        if (supabaseAccessToken == null || supabaseAccessToken.trim().isEmpty()) {
            Log.w(TAG, "[RouteTracking] Missing user JWT access token — deferring upload until session is refreshed");
            boolean refreshed = attemptTokenRefresh();
            if (!refreshed) {
                isAuthPaused = true;
                return;
            }
        }

        networkExecutor.execute(() -> {
            try {
                String endpoint = supabaseUrl.endsWith("/")
                        ? supabaseUrl + "functions/v1/record-tracking-ping"
                        : supabaseUrl + "/functions/v1/record-tracking-ping";

                String requestId = java.util.UUID.randomUUID().toString();

                JSONObject body = new JSONObject();
                body.put("requestId",  requestId);
                body.put("userId",     userId);
                body.put("latitude",   lat);
                body.put("longitude",  lng);
                body.put("accuracy",   acc);
                body.put("timestamp",  ts);
                body.put("status",     "successful");
                body.put("source",     "android_foreground_service");

                String bearer = supabaseAccessToken;

                Log.d(TAG, "[RouteTrackingDebug] Destination URL: " + endpoint);
                Log.d(TAG, "[RouteTrackingDebug] Authorization header present? " + (bearer != null && !bearer.isEmpty() ? "yes" : "no"));
                Log.d(TAG, "[RouteTrackingDebug] JWT length (>0)? " + (bearer != null ? bearer.length() : 0));
                Log.d(TAG, "[RouteTrackingDebug] apikey header present? " + (supabaseAnonKey != null && !supabaseAnonKey.isEmpty() ? "yes" : "no"));
                Log.d(TAG, "[RouteTrackingDebug] Tracking method: EDGE_FUNCTION");

                URL url = new URL(endpoint);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type",  "application/json");
                conn.setRequestProperty("apikey",        supabaseAnonKey);
                conn.setRequestProperty("Authorization", "Bearer " + bearer);
                conn.setDoOutput(true);
                conn.setConnectTimeout(15_000);
                conn.setReadTimeout(15_000);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes("UTF-8"));
                }

                int code = conn.getResponseCode();
                if (code == 201 || code == 200) {
                    Log.i(TAG, "✅ Location uploaded via Edge Function: " + lat + "," + lng + " at " + ts);
                    isAuthPaused = false;
                } else if (code == 401) {
                    Log.w(TAG, "⚠️ Edge Function returned HTTP 401 — attempting native token refresh");
                    conn.disconnect();
                    boolean refreshed = attemptTokenRefresh();
                    if (refreshed) {
                        Log.i(TAG, "Token refresh succeeded — retrying location upload via Edge Function");
                        uploadLocationToSupabase(loc);
                        return;
                    } else {
                        Log.e(TAG, "Token refresh failed. Pausing background auth retries to prevent 401 log spam.");
                        isAuthPaused = true;
                    }
                } else {
                    Log.w(TAG, "⚠️ Edge Function returned HTTP " + code + " for location upload");
                }
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to upload location", e);
            }
        });
    }

    /**
     * Attempts native token refresh via POST ${supabaseUrl}/auth/v1/token?grant_type=refresh_token
     */
    private boolean attemptTokenRefresh() {
        if (supabaseRefreshToken == null || supabaseRefreshToken.isEmpty() || supabaseUrl == null || supabaseAnonKey == null) {
            Log.w(TAG, "attemptTokenRefresh: Missing refresh token or URL/Key — cannot refresh");
            return false;
        }

        try {
            String refreshEndpoint = supabaseUrl.endsWith("/")
                    ? supabaseUrl + "auth/v1/token?grant_type=refresh_token"
                    : supabaseUrl + "/auth/v1/token?grant_type=refresh_token";

            JSONObject requestBody = new JSONObject();
            requestBody.put("refresh_token", supabaseRefreshToken);

            URL url = new URL(refreshEndpoint);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("apikey", supabaseAnonKey);
            conn.setDoOutput(true);
            conn.setConnectTimeout(15_000);
            conn.setReadTimeout(15_000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(requestBody.toString().getBytes("UTF-8"));
            }

            int code = conn.getResponseCode();
            if (code == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                StringBuilder responseBuilder = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    responseBuilder.append(line);
                }
                reader.close();

                JSONObject responseJson = new JSONObject(responseBuilder.toString());
                String newAccessToken  = responseJson.optString("access_token", null);
                String newRefreshToken = responseJson.optString("refresh_token", null);

                if (newAccessToken != null && !newAccessToken.isEmpty()) {
                    supabaseAccessToken = newAccessToken;
                    if (newRefreshToken != null && !newRefreshToken.isEmpty()) {
                        supabaseRefreshToken = newRefreshToken;
                    }
                    isAuthPaused = false;

                    // Persist updated tokens in SharedPreferences
                    if (prefs != null) {
                        prefs.edit()
                            .putString("tracking_supabase_token", supabaseAccessToken)
                            .putString("tracking_supabase_refresh_token", supabaseRefreshToken)
                            .apply();
                    }

                    Log.i(TAG, "✅ Native Supabase token refresh successful!");
                    conn.disconnect();
                    return true;
                }
            } else {
                Log.w(TAG, "⚠️ Token refresh endpoint returned HTTP " + code);
            }
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed during native token refresh", e);
        }

        return false;
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
            if (Build.VERSION.SDK_INT >= 34) { // Android 14+
                startForeground(NOTIFICATION_ID, notification,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION |
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start combined foreground service", e);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification,
                            android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }
            } catch (Exception ex) {
                Log.e(TAG, "Fallback startForeground also failed", ex);
                stopSelf();
            }
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

    // ── Activity Recognition ───────────────────────────────────────────────

    /**
     * Sets up the BroadcastReceiver that listens for activity transition events
     * delivered via PendingIntent. When the user enters/exits WALKING, RUNNING,
     * IN_VEHICLE, or ON_BICYCLE, we update the isUserWalking flag accordingly.
     */
    private void setupActivityTransitionReceiver() {
        activityTransitionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!ACTION_ACTIVITY_TRANSITION.equals(intent.getAction())) return;
                if (!ActivityTransitionResult.hasResult(intent)) return;

                ActivityTransitionResult result = ActivityTransitionResult.extractResult(intent);
                if (result == null) return;

                for (ActivityTransitionEvent event : result.getTransitionEvents()) {
                    int activityType = event.getActivityType();
                    int transitionType = event.getTransitionType();

                    String activityName = getActivityName(activityType);

                    if (transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER) {
                        // User just entered this activity
                        switch (activityType) {
                            case DetectedActivity.WALKING:
                            case DetectedActivity.RUNNING:
                            case DetectedActivity.ON_FOOT:
                                isUserWalking = true;
                                Log.i(TAG, "Activity detected: " + activityName + " — step counting ENABLED");
                                break;

                            case DetectedActivity.IN_VEHICLE:
                            case DetectedActivity.ON_BICYCLE:
                            case DetectedActivity.STILL:
                                isUserWalking = false;
                                Log.i(TAG, "Activity detected: " + activityName + " — step counting PAUSED");
                                break;

                            default:
                                // UNKNOWN or TILTING — keep current state
                                Log.d(TAG, "Activity detected (unhandled): " + activityName + " — keeping isUserWalking=" + isUserWalking);
                                break;
                        }
                    }
                }
            }
        };

        // Register receiver for the custom action
        IntentFilter filter = new IntentFilter(ACTION_ACTIVITY_TRANSITION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(activityTransitionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(activityTransitionReceiver, filter);
        }

        // Register activity transitions with Google Play Services
        startActivityTransitionUpdates();
    }

    private void startActivityTransitionUpdates() {
        // Check permission before requesting transitions (Android 10+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION)
                    != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "ACTIVITY_RECOGNITION permission not granted — steps will count for all activities (fallback mode)");
                // isUserWalking stays true (default) so steps still count — graceful fallback
                return;
            }
        }

        // Build the list of transitions we care about
        List<ActivityTransition> transitions = new ArrayList<>();

        int[] walkingTypes = {
            DetectedActivity.WALKING,
            DetectedActivity.RUNNING,
            DetectedActivity.ON_FOOT
        };
        int[] vehicleTypes = {
            DetectedActivity.IN_VEHICLE,
            DetectedActivity.ON_BICYCLE,
            DetectedActivity.STILL
        };

        for (int type : walkingTypes) {
            transitions.add(new ActivityTransition.Builder()
                .setActivityType(type)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                .build());
        }
        for (int type : vehicleTypes) {
            transitions.add(new ActivityTransition.Builder()
                .setActivityType(type)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                .build());
        }

        ActivityTransitionRequest request = new ActivityTransitionRequest(transitions);

        Intent intent = new Intent(ACTION_ACTIVITY_TRANSITION);
        activityTransitionPendingIntent = PendingIntent.getBroadcast(
                this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        activityRecognitionClient
            .requestActivityTransitionUpdates(request, activityTransitionPendingIntent)
            .addOnSuccessListener(aVoid ->
                Log.i(TAG, "Activity transition updates registered successfully"))
            .addOnFailureListener(e ->
                Log.w(TAG, "Failed to register activity transitions: " + e.getMessage() +
                        " — steps will count for all activities (fallback mode)"));
    }

    private void stopActivityTransitionUpdates() {
        if (activityRecognitionClient != null && activityTransitionPendingIntent != null) {
            activityRecognitionClient
                .removeActivityTransitionUpdates(activityTransitionPendingIntent)
                .addOnFailureListener(e -> Log.w(TAG, "Failed to remove activity transitions: " + e.getMessage()));
        }
    }

    private static String getActivityName(int activityType) {
        switch (activityType) {
            case DetectedActivity.WALKING:    return "WALKING";
            case DetectedActivity.RUNNING:    return "RUNNING";
            case DetectedActivity.ON_FOOT:    return "ON_FOOT";
            case DetectedActivity.IN_VEHICLE: return "IN_VEHICLE";
            case DetectedActivity.ON_BICYCLE: return "ON_BICYCLE";
            case DetectedActivity.STILL:      return "STILL";
            case DetectedActivity.TILTING:    return "TILTING";
            default:                          return "UNKNOWN(" + activityType + ")";
        }
    }
}
