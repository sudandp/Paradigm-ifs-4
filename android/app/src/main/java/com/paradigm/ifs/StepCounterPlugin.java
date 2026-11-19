package com.paradigm.ifs;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "StepCounter",
    permissions = {
        @Permission(
            alias = "activityRecognition",
            strings = { Manifest.permission.ACTIVITY_RECOGNITION }
        )
    }
)
public class StepCounterPlugin extends Plugin implements SensorEventListener {
    
    private BroadcastReceiver stepUpdateReceiver;
    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private boolean isSensorRegistered = false;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }

        stepUpdateReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (TrackingService.ACTION_STEP_UPDATE.equals(intent.getAction())) {
                    int steps = intent.getIntExtra(TrackingService.EXTRA_STEPS, 0);
                    int totalCumulativeSteps = intent.getIntExtra(TrackingService.EXTRA_TOTAL_STEPS, 0);

                    JSObject ret = new JSObject();
                    ret.put("steps", steps);
                    ret.put("totalCumulativeSteps", totalCumulativeSteps);
                    notifyListeners("stepCountChanged", ret);
                }
            }
        };
        LocalBroadcastManager.getInstance(getContext()).registerReceiver(
                stepUpdateReceiver, new IntentFilter(TrackingService.ACTION_STEP_UPDATE)
        );
    }
    
    @Override
    protected void handleOnDestroy() {
        if (stepUpdateReceiver != null) {
            LocalBroadcastManager.getInstance(getContext()).unregisterReceiver(stepUpdateReceiver);
        }
        if (sensorManager != null && isSensorRegistered) {
            sensorManager.unregisterListener(this);
            isSensorRegistered = false;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void isStepCountingSupported(PluginCall call) {
        if (sensorManager == null) {
            sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        }
        boolean supported = false;
        if (sensorManager != null) {
            supported = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
        }
        JSObject ret = new JSObject();
        ret.put("supported", supported);
        call.resolve(ret);
    }

    // -------------------------------------------------------------------------
    // SensorEventListener (direct hardware fallback)
    // -------------------------------------------------------------------------

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER) return;

        float rawCumulativeSteps = event.values[0];
        SharedPreferences prefs = getContext().getSharedPreferences("StepCounterPrefs", Context.MODE_PRIVATE);
        String todayDate   = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        String savedDate   = prefs.getString("baseline_date", "");
        float stepBaseline = prefs.getFloat("step_baseline", -1);
        int accumulatedSteps = prefs.getInt("accumulated_steps", 0);

        if (!todayDate.equals(savedDate) || stepBaseline < 0 || rawCumulativeSteps < stepBaseline) {
            stepBaseline = rawCumulativeSteps;
            if (!todayDate.equals(savedDate)) {
                accumulatedSteps = 0;
            } else {
                accumulatedSteps = prefs.getInt("steps_today", 0);
            }
            prefs.edit()
                .putString("baseline_date",  todayDate)
                .putFloat("step_baseline",   stepBaseline)
                .putInt("accumulated_steps", accumulatedSteps)
                .apply();
        }

        int delta = (int) (rawCumulativeSteps - stepBaseline);
        int currentStepsToday = accumulatedSteps + delta;

        prefs.edit()
            .putInt("steps_today", currentStepsToday)
            .putFloat("last_raw_steps", rawCumulativeSteps)
            .apply();

        JSObject ret = new JSObject();
        ret.put("steps", currentStepsToday);
        ret.put("totalCumulativeSteps", (int) rawCumulativeSteps);
        notifyListeners("stepCountChanged", ret);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    // -------------------------------------------------------------------------
    // Capacitor v5 standard permission API: checkPermissions + requestPermissions
    // These names are required by Capacitor's permission system to work correctly.
    // -------------------------------------------------------------------------

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            PermissionState state = getPermissionState("activityRecognition");
            // Map to JS-friendly string: "granted", "denied", "prompt"
            String stateStr;
            if (state == PermissionState.GRANTED) {
                stateStr = "granted";
            } else if (state == PermissionState.DENIED) {
                stateStr = "denied";
            } else {
                stateStr = "prompt";
            }
            ret.put("activityRecognition", stateStr);
        } else {
            // Below Android 10, ACTIVITY_RECOGNITION is not a dangerous permission
            ret.put("activityRecognition", "granted");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (getPermissionState("activityRecognition") != PermissionState.GRANTED) {
                requestPermissionForAlias("activityRecognition", call, "requestPermissionsCallback");
            } else {
                JSObject ret = new JSObject();
                ret.put("activityRecognition", "granted");
                call.resolve(ret);
            }
        } else {
            JSObject ret = new JSObject();
            ret.put("activityRecognition", "granted");
            call.resolve(ret);
        }
    }

    @PermissionCallback
    private void requestPermissionsCallback(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = getPermissionState("activityRecognition") == PermissionState.GRANTED;
        ret.put("activityRecognition", granted ? "granted" : "denied");
        call.resolve(ret);
    }

    // -------------------------------------------------------------------------
    // Legacy API kept for backward compatibility
    // -------------------------------------------------------------------------

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        JSObject ret = new JSObject();
        boolean hasPermission = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            hasPermission = getPermissionState("activityRecognition") == PermissionState.GRANTED;
        }
        ret.put("granted", hasPermission);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (getPermissionState("activityRecognition") != PermissionState.GRANTED) {
                requestPermissionForAlias("activityRecognition", call, "legacyPermissionCallback");
            } else {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                call.resolve(ret);
            }
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        }
    }

    @PermissionCallback
    private void legacyPermissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = getPermissionState("activityRecognition") == PermissionState.GRANTED;
        ret.put("granted", granted);
        call.resolve(ret);
    }

    // -------------------------------------------------------------------------
    // Step counting
    // -------------------------------------------------------------------------

    @PluginMethod
    public void startStepCount(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            getPermissionState("activityRecognition") != PermissionState.GRANTED) {
            call.reject("Activity recognition permission not granted.");
            return;
        }

        // Register hardware listener as direct sensor source or fallback
        if (sensorManager != null && stepCounterSensor != null && !isSensorRegistered) {
            sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_UI);
            isSensorRegistered = true;
        }

        // Deliver current values immediately
        SharedPreferences prefs = getContext().getSharedPreferences("StepCounterPrefs", Context.MODE_PRIVATE);
        int stepsToday = prefs.getInt("steps_today", 0);
        int totalCumulative = (int) prefs.getFloat("last_raw_steps", 0);
        JSObject ret = new JSObject();
        ret.put("steps", stepsToday);
        ret.put("totalCumulativeSteps", totalCumulative);
        notifyListeners("stepCountChanged", ret);

        call.resolve();
    }

    @PluginMethod
    public void stopStepCount(PluginCall call) {
        if (sensorManager != null && isSensorRegistered) {
            sensorManager.unregisterListener(this);
            isSensorRegistered = false;
        }
        call.resolve();
    }
    
    @PluginMethod
    public void getStepCount(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("StepCounterPrefs", Context.MODE_PRIVATE);
        int stepsToday = prefs.getInt("steps_today", 0);
        int totalCumulative = (int) prefs.getFloat("last_raw_steps", 0);
        
        JSObject ret = new JSObject();
        ret.put("steps", stepsToday);
        ret.put("totalCumulativeSteps", totalCumulative);
        call.resolve(ret);
    }
}
