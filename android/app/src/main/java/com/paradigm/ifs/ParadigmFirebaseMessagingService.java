package com.paradigm.ifs;

import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.HandlerThread;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import java.util.TimeZone;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Handles FCM messages when the app is in the BACKGROUND or KILLED state.
 *
 * For SILENT_TRACKING_PING:
 *   1. Tries a fresh single GPS update (8s timeout), falls back to cached.
 *   2. Includes device telemetry (battery, device name) so Map shows "Android".
 *   3. Calls record-tracking-ping Edge Function (service role key, bypasses RLS).
 *   4. Edge function inserts route_history and patches tracking_audit_logs.
 *
 * NOTE: On Android 14+ (SDK 35), starting a foreground service with type "location"
 * from a background FCM handler throws SecurityException and crashes the app.
 * We use a WakeLock instead — FCM provides ~20s of execution time.
 *
 * ANDROID STUDIO DEBUG: Filter Logcat by tag "ParadigmFCM"
 */
public class ParadigmFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "ParadigmFCM";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String type = data.get("type");

        Log.d(TAG, "=== onMessageReceived === type=" + type + " | keys=" + data.keySet());

        if ("SILENT_TRACKING_PING".equals(type)) {
            String requestId = data.get("requestId");
            String userId = data.get("userId");
            Log.i(TAG, "Silent tracking ping | requestId=" + requestId + " | userId=" + userId);
            handleSilentTrackingPing(requestId, userId);
        } else {
            Log.d(TAG, "Non-tracking FCM type=" + type + " — default handling");
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        Log.d(TAG, "FCM token refreshed (handled by Capacitor plugin).");
    }

    // -------------------------------------------------------------------------

    private void handleSilentTrackingPing(String requestId, String userId) {
        // Acquire a WakeLock to keep the CPU alive during GPS fix + HTTP call.
        // On Android 14+ (SDK 35), starting a foreground service with type "location"
        // from a background FCM handler throws SecurityException and CRASHES the app.
        // FCM gives us ~20 seconds of execution time — a WakeLock is sufficient.
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK, "paradigm:tracking-ping");
        wakeLock.acquire(20000); // 20s max — matches FCM execution window
        Log.d(TAG, "handleSilentTrackingPing: WakeLock acquired (20s)");

        executor.execute(() -> {
            Log.d(TAG, "Background thread: starting location recording...");
            try {
                recordLocationViaSupabase(requestId, userId);
            } catch (Exception e) {
                Log.e(TAG, "CRITICAL: Failed to record location: " + e.getMessage(), e);
                String supabaseUrl = BuildConfig.SUPABASE_URL;
                String supabaseKey = BuildConfig.SUPABASE_ANON_KEY;
                callEdgeFunction(supabaseUrl, supabaseKey, requestId, userId, null, null, null, "failed");
            } finally {
                if (wakeLock.isHeld()) {
                    wakeLock.release();
                    Log.d(TAG, "WakeLock released");
                }
            }
        });
    }

    /**
     * Gets the best location using FusedLocationProviderClient (Google Play Services).
     * This is dramatically more reliable than raw LocationManager for background fixes —
     * it uses WiFi, cell towers, and sensors alongside GPS, responding in 1-3s even indoors.
     */
    @SuppressWarnings({"MissingPermission"})
    private void recordLocationViaSupabase(String requestId, String userId) throws Exception {
        Context ctx = getApplicationContext();
        Location location = null;

        // --- Strategy 1: FusedLocationProviderClient (requestLocationUpdates) ---
        // getCurrentLocation can return null immediately on fresh installs with no cache.
        // requestLocationUpdates forces GPS/WiFi/Cell hardware to power up and acquire a fix.
        try {
            Log.d(TAG, "Trying FusedLocation requestLocationUpdates (10s timeout)...");
            com.google.android.gms.location.FusedLocationProviderClient fusedClient =
                    com.google.android.gms.location.LocationServices.getFusedLocationProviderClient(ctx);

            AtomicReference<Location> fusedLoc = new AtomicReference<>(null);
            CountDownLatch latch = new CountDownLatch(1);

            com.google.android.gms.location.LocationRequest locReq =
                    new com.google.android.gms.location.LocationRequest.Builder(
                            com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY, 1000)
                            .setMaxUpdates(1)            // Stop after first fix
                            .setWaitForAccurateLocation(false) // Don't wait for GPS if WiFi/Cell is faster
                            .setMinUpdateIntervalMillis(500)
                            .build();

            com.google.android.gms.location.LocationCallback callback =
                    new com.google.android.gms.location.LocationCallback() {
                        @Override
                        public void onLocationResult(com.google.android.gms.location.LocationResult result) {
                            Location loc = result.getLastLocation();
                            if (loc != null) {
                                Log.i(TAG, "FusedLocation fix: " + loc.getLatitude() + "," + loc.getLongitude()
                                        + " acc=" + loc.getAccuracy() + "m provider=" + loc.getProvider());
                                fusedLoc.set(loc);
                            }
                            latch.countDown();
                        }
                    };

            // Use main looper for callback delivery — Play Services requires a looper
            fusedClient.requestLocationUpdates(locReq, callback, Looper.getMainLooper());

            try {
                latch.await(10, TimeUnit.SECONDS);
            } finally {
                fusedClient.removeLocationUpdates(callback);
            }

            location = fusedLoc.get();
        } catch (Exception e) {
            Log.w(TAG, "FusedLocationProvider error: " + e.getMessage());
        }

        // --- Strategy 2: Fallback to getLastLocation ---
        if (location == null) {
            try {
                Log.d(TAG, "Trying getLastLocation fallback...");
                com.google.android.gms.location.FusedLocationProviderClient fusedClient =
                        com.google.android.gms.location.LocationServices.getFusedLocationProviderClient(ctx);

                AtomicReference<Location> lastLoc = new AtomicReference<>(null);
                CountDownLatch latch2 = new CountDownLatch(1);

                fusedClient.getLastLocation()
                        .addOnSuccessListener(loc -> {
                            if (loc != null) {
                                Log.d(TAG, "getLastLocation: " + loc.getLatitude() + "," + loc.getLongitude()
                                        + " acc=" + loc.getAccuracy() + "m age="
                                        + ((System.currentTimeMillis() - loc.getTime()) / 1000) + "s");
                                lastLoc.set(loc);
                            } else {
                                Log.w(TAG, "getLastLocation returned null");
                            }
                            latch2.countDown();
                        })
                        .addOnFailureListener(e -> {
                            Log.w(TAG, "getLastLocation failed: " + e.getMessage());
                            latch2.countDown();
                        });

                latch2.await(5, TimeUnit.SECONDS);
                location = lastLoc.get();
            } catch (Exception e) {
                Log.w(TAG, "getLastLocation error: " + e.getMessage());
            }
        }

        // --- Strategy 3: Raw LocationManager cached (last resort) ---
        if (location == null) {
            Log.w(TAG, "No FusedLocation — falling back to raw LocationManager cache");
            LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
            if (lm != null) {
                Location gps = null;
                Location net = null;
                try { gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER); } catch (Exception ignored) {}
                try { net = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER); } catch (Exception ignored) {}

                if (gps != null && net != null) {
                    location = (gps.getAccuracy() <= net.getAccuracy()) ? gps : net;
                } else if (gps != null) {
                    location = gps;
                } else {
                    location = net;
                }

                if (location != null) {
                    Log.d(TAG, "Cached location: acc=" + location.getAccuracy() + "m age="
                            + ((System.currentTimeMillis() - location.getTime()) / 1000) + "s");
                }
            }
        }

        String supabaseUrl = BuildConfig.SUPABASE_URL;
        String supabaseKey = BuildConfig.SUPABASE_ANON_KEY;

        if (supabaseUrl == null || supabaseUrl.isEmpty()) {
            Log.e(TAG, "SUPABASE_URL not configured in BuildConfig!");
            callEdgeFunction(supabaseUrl, supabaseKey, requestId, userId, null, null, null, "failed");
            return;
        }

        if (location == null) {
            Log.e(TAG, "No location available (GPS+Network both null) for request=" + requestId);
            callEdgeFunction(supabaseUrl, supabaseKey, requestId, userId, null, null, null, "failed");
            return;
        }

        double lat = location.getLatitude();
        double lng = location.getLongitude();
        float accuracy = location.getAccuracy();
        Log.i(TAG, "Location confirmed: " + lat + ", " + lng + " acc=" + accuracy + "m");

        // --- Device Telemetry ---
        String deviceName = Build.MANUFACTURER + " " + Build.MODEL;
        float batteryLevel = -1f;
        try {
            BatteryManager bm = (BatteryManager) ctx.getSystemService(Context.BATTERY_SERVICE);
            if (bm != null) {
                int pct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                batteryLevel = pct / 100f;
            }
        } catch (Exception e) {
            Log.w(TAG, "Battery read failed: " + e.getMessage());
        }

        // --- Network & IP Telemetry ---
        String networkType = "offline";
        String ipAddress = "--";
        try {
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                Network activeNetwork = cm.getActiveNetwork();
                if (activeNetwork != null) {
                    NetworkCapabilities caps = cm.getNetworkCapabilities(activeNetwork);
                    if (caps != null) {
                        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) networkType = "wifi";
                        else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) networkType = "cellular";
                        else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) networkType = "ethernet";
                        else networkType = "active";
                    }
                }
            }
            
            // Basic IP fetch (Public IP)
            try {
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) new java.net.URL("https://api.ipify.org").openConnection();
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);
                java.io.BufferedReader in = new java.io.BufferedReader(new java.io.InputStreamReader(conn.getInputStream()));
                ipAddress = in.readLine();
                in.close();
            } catch (Exception ignored) {}
        } catch (Exception e) {
            Log.w(TAG, "Network telemetry failed: " + e.getMessage());
        }

        callEdgeFunction(supabaseUrl, supabaseKey, requestId, userId, lat, lng, accuracy,
                deviceName, batteryLevel, networkType, ipAddress, "successful");
    }

    /**
     * Calls the record-tracking-ping Edge Function which uses SERVICE ROLE KEY internally.
     * This bypasses RLS on route_history and tracking_audit_logs.
     *
     * FIX #1: Direct anon-key REST calls were blocked by Row Level Security.
     * FIX #2: Edge function filters PATCH by both request_id AND target_user_id.
     */
    private void callEdgeFunction(String supabaseUrl, String supabaseKey,
                                   String requestId, String userId,
                                   Double latitude, Double longitude, Float accuracy,
                                   String status) {
        callEdgeFunction(supabaseUrl, supabaseKey, requestId, userId,
                latitude, longitude, accuracy, null, -1f, null, null, status);
    }

    private void callEdgeFunction(String supabaseUrl, String supabaseKey,
                                   String requestId, String userId,
                                   Double latitude, Double longitude, Float accuracy,
                                   String deviceName, float batteryLevel, 
                                   String networkType, String ipAddress, String status) {
        if (requestId == null || requestId.isEmpty() || supabaseUrl == null || supabaseUrl.isEmpty()) return;
        Log.d(TAG, "callEdgeFunction: requestId=" + requestId + " status=" + status);

        try {
            JSONObject payload = new JSONObject();
            payload.put("requestId", requestId);
            payload.put("userId", userId != null ? userId : "");
            payload.put("status", status);
            payload.put("source", "background_fcm");
            
            // FIX: Use proper UTC timestamp to avoid 5.5h dashboard offset
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
            payload.put("timestamp", sdf.format(new Date()));

            if (latitude != null) payload.put("latitude", latitude);
            if (longitude != null) payload.put("longitude", longitude);
            if (accuracy != null) payload.put("accuracy", accuracy);
            if (deviceName != null) payload.put("deviceName", deviceName);
            if (batteryLevel >= 0) payload.put("batteryLevel", batteryLevel);
            if (networkType != null) payload.put("networkType", networkType);
            if (ipAddress != null && !ipAddress.equals("--")) payload.put("ipAddress", ipAddress);

            String endpoint = supabaseUrl + "/functions/v1/record-tracking-ping";
            Log.d(TAG, "POST to Edge Function: " + endpoint);
            Log.d(TAG, "Payload: " + payload);

            URL url = new URL(endpoint);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            // The anon key is used only for Edge Function auth (function checks its own service role key internally)
            conn.setRequestProperty("apikey", supabaseKey);
            conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(12000);

            byte[] input = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) { os.write(input); }

            int code = conn.getResponseCode();
            // Read response body for logging
            StringBuilder responseBody = new StringBuilder();
            try {
                BufferedReader br = new BufferedReader(new InputStreamReader(
                        code >= 400 ? conn.getErrorStream() : conn.getInputStream()));
                String line;
                while ((line = br.readLine()) != null) responseBody.append(line);
            } catch (Exception ignored) {}
            conn.disconnect();

            if (code >= 200 && code < 300) {
                Log.i(TAG, "Edge Function OK (HTTP " + code + ") for requestId=" + requestId + " status=" + status);
            } else {
                Log.e(TAG, "Edge Function FAILED (HTTP " + code + ") body=" + responseBody);
            }
        } catch (Exception e) {
            Log.e(TAG, "callEdgeFunction exception: " + e.getMessage(), e);
        }
    }
}
