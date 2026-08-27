package com.paradigm.ifs;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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
}
