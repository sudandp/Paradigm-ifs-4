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
        String title = call.getString("title", "Paradigm Services");
        String text = call.getString("text", "Field operations tracking is active.");

        Intent intent = new Intent(getContext(), TrackingService.class);
        intent.putExtra("title", title);
        intent.putExtra("text", text);

        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            e.printStackTrace();
            // Resolve instead of reject to prevent crashing JS side if unhandled,
            // or reject safely.
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
