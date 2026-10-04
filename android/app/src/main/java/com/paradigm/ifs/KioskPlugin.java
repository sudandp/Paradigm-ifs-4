package com.paradigm.ifs;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.UUID;

@CapacitorPlugin(name = "KioskPlugin")
public class KioskPlugin extends Plugin {

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences("KioskPrefs", Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void startLockTask(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startLockTask();
                // [H3-FIXED] Only persist kiosk flag on actual success — not on SecurityException.
                // Previously, the flag was set even when startLockTask() failed, creating a false
                // belief that the device was locked.
                getPrefs().edit().putBoolean("kiosk_mode_active", true).apply();
                call.resolve();
            } catch (SecurityException e) {
                // [H3-FIXED] Do NOT set kiosk_mode_active=true here. The device is NOT locked.
                // Reject with a clear error so the caller can show a proper UI message.
                System.err.println("startLockTask failed (device not enrolled as owner): " + e.getMessage());
                call.reject("Kiosk mode requires the device to be enrolled as a managed device. Contact your administrator.", e.toString());
            } catch (Exception e) {
                call.reject("Error starting kiosk mode", e);
            }
        });
    }

    @PluginMethod
    public void stopLockTask(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().stopLockTask();
                getPrefs().edit().putBoolean("kiosk_mode_active", false).apply();
                call.resolve();
            } catch (Exception e) {
                call.reject("Error stopping kiosk mode", e);
            }
        });
    }

    @PluginMethod
    public void setKioskActive(PluginCall call) {
        Boolean active = call.getBoolean("active", false);
        SharedPreferences.Editor editor = getPrefs().edit();
        editor.putBoolean("kiosk_mode_active", active);
        editor.apply();
        call.resolve();
    }

    @PluginMethod
    public void isKioskActive(PluginCall call) {
        boolean active = getPrefs().getBoolean("kiosk_mode_active", false);
        JSObject ret = new JSObject();
        ret.put("active", active);
        call.resolve(ret);
    }

    @PluginMethod
    public void getDeviceId(PluginCall call) {
        SharedPreferences prefs = getPrefs();
        String deviceId = prefs.getString("kiosk_device_id", null);
        if (deviceId == null) {
            deviceId = UUID.randomUUID().toString();
            prefs.edit().putString("kiosk_device_id", deviceId).apply();
        }
        JSObject ret = new JSObject();
        ret.put("deviceId", deviceId);
        call.resolve(ret);
    }
}
