package com.paradigm.ifs;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;

@CapacitorPlugin(name = "Tracking")
public class TrackingPlugin extends Plugin {

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        String title                = call.getString("title",                "Paradigm Services");
        String text                 = call.getString("text",                 "Field operations tracking is active.");
        String userId               = call.getString("userId",               null);
        String supabaseUrl          = call.getString("supabaseUrl",          null);
        String supabaseKey          = call.getString("supabaseKey",          null);
        String supabaseToken        = call.getString("supabaseToken",        null); // user JWT access token
        String supabaseRefreshToken = call.getString("supabaseRefreshToken", null); // user JWT refresh token
        int    intervalMinutes      = call.getInt("intervalMinutes",         15);

        Intent intent = new Intent(getContext(), TrackingService.class);
        intent.putExtra("title",                                 title);
        intent.putExtra("text",                                  text);
        intent.putExtra(TrackingService.EXTRA_USER_ID,           userId);
        intent.putExtra(TrackingService.EXTRA_SUPABASE_URL,      supabaseUrl);
        intent.putExtra(TrackingService.EXTRA_SUPABASE_KEY,      supabaseKey);
        intent.putExtra(TrackingService.EXTRA_SUPABASE_TOKEN,    supabaseToken);
        intent.putExtra(TrackingService.EXTRA_SUPABASE_REFRESH_TOKEN, supabaseRefreshToken);
        intent.putExtra(TrackingService.EXTRA_INTERVAL_MINUTES,  intervalMinutes);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            e.printStackTrace();
            call.reject("Failed to start foreground service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void updateTokens(PluginCall call) {
        String supabaseToken        = call.getString("supabaseToken",        null);
        String supabaseRefreshToken = call.getString("supabaseRefreshToken", null);

        Intent intent = new Intent(getContext(), TrackingService.class);
        intent.setAction(TrackingService.ACTION_UPDATE_TOKENS);
        intent.putExtra(TrackingService.EXTRA_SUPABASE_TOKEN,         supabaseToken);
        if (supabaseRefreshToken != null) {
            intent.putExtra(TrackingService.EXTRA_SUPABASE_REFRESH_TOKEN, supabaseRefreshToken);
        }

        try {
            getContext().startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update tokens: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        Intent intent = new Intent(getContext(), TrackingService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void isBatteryOptimizationIgnored(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            boolean isIgnoring = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            JSObject ret = new JSObject();
            ret.put("isIgnored", isIgnoring);
            call.resolve(ret);
        } else {
            JSObject ret = new JSObject();
            ret.put("isIgnored", true);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent();
                String packageName = getContext().getPackageName();
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                }
                call.resolve();
            } catch (Exception e) {
                try {
                    Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    call.resolve();
                } catch (Exception ex) {
                    call.reject("Failed to open battery optimization settings: " + ex.getMessage());
                }
            }
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open app settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkLocationIntegrity(PluginCall call) {
        Context context = getContext();
        boolean isMock = false;
        String mockReason = "";

        try {
            LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
            if (lm != null) {
                boolean hasPerm = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                                  ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                if (hasPerm) {
                    Location gpsLoc = null;
                    Location netLoc = null;
                    try { gpsLoc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER); } catch (SecurityException ignored) {}
                    try { netLoc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER); } catch (SecurityException ignored) {}
                    Location bestLoc = gpsLoc != null ? gpsLoc : netLoc;

                    if (bestLoc != null) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            if (bestLoc.isMock()) {
                                isMock = true;
                                mockReason = "Location.isMock() true (" + bestLoc.getProvider() + ")";
                            }
                        } else {
                            if (bestLoc.isFromMockProvider()) {
                                isMock = true;
                                mockReason = "Location.isFromMockProvider() true (" + bestLoc.getProvider() + ")";
                            }
                        }
                    }
                }
            }

            if (!isMock && ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                try {
                    FusedLocationProviderClient fusedClient = LocationServices.getFusedLocationProviderClient(context);
                    fusedClient.getLastLocation().addOnSuccessListener(loc -> {
                        boolean fusedMock = false;
                        String reason = "";
                        if (loc != null) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                                fusedMock = loc.isMock();
                            } else {
                                fusedMock = loc.isFromMockProvider();
                            }
                            if (fusedMock) {
                                reason = "FusedLocation.isMock() true";
                            }
                        }
                        JSObject res = new JSObject();
                        res.put("isMock", fusedMock);
                        res.put("mockReason", reason);
                        call.resolve(res);
                    }).addOnFailureListener(e -> {
                        JSObject res = new JSObject();
                        res.put("isMock", false);
                        res.put("mockReason", "");
                        call.resolve(res);
                    });
                    return;
                } catch (Exception ignored) {}
            }

            JSObject res = new JSObject();
            res.put("isMock", isMock);
            res.put("mockReason", mockReason);
            call.resolve(res);
        } catch (Exception e) {
            JSObject res = new JSObject();
            res.put("isMock", false);
            res.put("error", e.getMessage());
            call.resolve(res);
        }
    }
}
