package com.paradigm.ifs;

import android.Manifest;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
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
    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private boolean isListening = false;
    private float startSteps = -1;
    private float currentSteps = 0;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }
    }

    @PluginMethod
    public void isStepCountingSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", stepCounterSensor != null);
        call.resolve(ret);
    }

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
        if (stepCounterSensor == null) {
            call.reject("Step counter sensor not available on this device.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            getPermissionState("activityRecognition") != PermissionState.GRANTED) {
            call.reject("Activity recognition permission not granted.");
            return;
        }

        if (isListening) {
            call.resolve();
            return;
        }

        startSteps = -1;
        currentSteps = 0;

        boolean success = sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_UI);
        if (success) {
            isListening = true;
            call.resolve();
        } else {
            call.reject("Failed to register step counter sensor listener.");
        }
    }

    @PluginMethod
    public void stopStepCount(PluginCall call) {
        if (!isListening) {
            call.resolve();
            return;
        }
        sensorManager.unregisterListener(this);
        isListening = false;
        startSteps = -1;
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            float totalSteps = event.values[0];
            if (startSteps < 0) {
                startSteps = totalSteps;
            }
            currentSteps = totalSteps - startSteps;

            JSObject ret = new JSObject();
            ret.put("steps", (int) currentSteps);
            ret.put("totalCumulativeSteps", (int) totalSteps);
            notifyListeners("stepCountChanged", ret);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not used
    }
}
