package com.paradigm.ifs;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Tracking")
public class TrackingPlugin extends Plugin {

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        String title           = call.getString("title",           "Paradigm Services");
        String text            = call.getString("text",            "Field operations tracking is active.");
        String userId          = call.getString("userId",          null);
        String supabaseUrl     = call.getString("supabaseUrl",     null);
        String supabaseKey     = call.getString("supabaseKey",     null);
        int    intervalMinutes = call.getInt("intervalMinutes",    15);

        Intent intent = new Intent(getContext(), TrackingService.class);
        intent.putExtra("title",           title);
        intent.putExtra("text",            text);
        intent.putExtra(TrackingService.EXTRA_USER_ID,          userId);
        intent.putExtra(TrackingService.EXTRA_SUPABASE_URL,     supabaseUrl);
        intent.putExtra(TrackingService.EXTRA_SUPABASE_KEY,     supabaseKey);
        intent.putExtra(TrackingService.EXTRA_INTERVAL_MINUTES, intervalMinutes);

        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
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
    public void stopForegroundService(PluginCall call) {
        Intent intent = new Intent(getContext(), TrackingService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}
