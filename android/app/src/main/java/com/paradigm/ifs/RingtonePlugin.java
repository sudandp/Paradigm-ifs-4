package com.paradigm.ifs;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.app.NotificationChannel;
import android.app.NotificationManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * RingtonePlugin — Capacitor bridge for Android's RingtoneManager.
 *
 * Exposes three JS methods:
 *  - openRingtonePicker()  → opens the native Android ringtone picker
 *  - playRingtone(uri)     → plays any ringtone by content URI for preview
 *  - stopRingtone()        → stops the current preview playback
 *
 * When the user picks a ringtone, the plugin ALSO recreates the
 * "break_reminders" notification channel so background notifications
 * use the selected ringtone going forward.
 */
@CapacitorPlugin(name = "RingtonePlugin")
public class RingtonePlugin extends Plugin {

    private Ringtone currentRingtone = null;

    // ── openRingtonePicker ────────────────────────────────────────────────────

    @PluginMethod
    public void openRingtonePicker(PluginCall call) {
        // Get current selected URI to pre-highlight it in the picker
        String currentUriStr = call.getString("currentUri", null);
        Uri currentUri = currentUriStr != null ? Uri.parse(currentUriStr)
                : RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALL);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Select Break Alert Tone");
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, currentUri);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);

        startActivityForResult(call, intent, "onRingtonePicked");
    }

    @ActivityCallback
    public void onRingtonePicked(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK) {
            // User pressed "Cancel"
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }

        Intent intent = result.getData();
        if (intent == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }

        Uri ringtoneUri = intent.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        if (ringtoneUri == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }

        String uriStr = ringtoneUri.toString();

        // Attempt to take persistable read permission so the background alarm can access it
        try {
            getContext().getContentResolver().takePersistableUriPermission(ringtoneUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException e) {
            // Ignore: system URIs (content://settings/system...) often throw this and don't need it
        }

        // Fetch human-readable title
        String title = "Selected Ringtone";
        try {
            Ringtone r = RingtoneManager.getRingtone(getContext(), ringtoneUri);
            if (r != null) {
                title = r.getTitle(getContext());
            }
        } catch (Exception e) {
            // fallback title is fine
        }

        // Recreate the break_reminders channel with the new sound URI
        updateBreakReminderChannelSound(ringtoneUri);

        JSObject ret = new JSObject();
        ret.put("cancelled", false);
        ret.put("uri", uriStr);
        ret.put("title", title);
        call.resolve(ret);
    }

    // ── playRingtone ──────────────────────────────────────────────────────────

    @PluginMethod
    public void playRingtone(PluginCall call) {
        String uriStr = call.getString("uri", null);
        if (uriStr == null) {
            call.reject("uri is required");
            return;
        }

        boolean loop = call.getBoolean("loop", false);

        synchronized (this) {
            try {
                // Stop any currently playing preview
                if (currentRingtone != null && currentRingtone.isPlaying()) {
                    currentRingtone.stop();
                }

                Uri uri = Uri.parse(uriStr);
                currentRingtone = RingtoneManager.getRingtone(getContext(), uri);

                if (currentRingtone != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        currentRingtone.setLooping(loop);
                    }
                    currentRingtone.play();
                    call.resolve(new JSObject().put("playing", true));
                } else {
                    call.reject("Failed to load ringtone");
                }
            } catch (Exception e) {
                call.reject("Error playing ringtone: " + e.getMessage());
            }
        }
    }

    // ── stopRingtone ──────────────────────────────────────────────────────────

    @PluginMethod
    public void stopRingtone(PluginCall call) {
        synchronized (this) {
            if (currentRingtone != null && currentRingtone.isPlaying()) {
                currentRingtone.stop();
            }
        }
        call.resolve(new JSObject().put("stopped", true));
    }

    // ── Helper: recreate break_reminders channel with new sound URI ───────────

    private void updateBreakReminderChannelSound(Uri soundUri) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager)
                getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        // Android doesn't allow sound changes on existing channels — delete + recreate
        manager.deleteNotificationChannel("break_reminders");

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        NotificationChannel channel = new NotificationChannel(
                "break_reminders",
                "Break Status Reminders",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Periodic break reminder alerts. Customise via Profile settings.");
        channel.setSound(soundUri, audioAttributes);
        channel.enableVibration(true);
        channel.enableLights(true);
        channel.setShowBadge(true);

        manager.createNotificationChannel(channel);
    }
}
