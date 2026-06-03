package com.paradigm.ifs;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {

            // 1. Restart TrackingService if the user was mid-shift
            // We check SharedPreferences for a baseline_date matching today.
            // If it matches, the user was active before the reboot and we must
            // restart the Foreground Service so step counting resumes automatically.
            SharedPreferences stepPrefs = context.getSharedPreferences("StepCounterPrefs", Context.MODE_PRIVATE);
            String baselineDate = stepPrefs.getString("baseline_date", "");
            String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());

            if (todayDate.equals(baselineDate)) {
                Intent serviceIntent = new Intent(context, TrackingService.class);
                serviceIntent.putExtra("title", "Paradigm Services");
                serviceIntent.putExtra("text", "Field operations tracking is active.");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            }

            // 2. Kiosk mode: relaunch MainActivity if active
            SharedPreferences kioskPrefs = context.getSharedPreferences("KioskPrefs", Context.MODE_PRIVATE);
            boolean isKioskModeActive = kioskPrefs.getBoolean("kiosk_mode_active", false);
            if (isKioskModeActive) {
                Intent launchIntent = new Intent(context, MainActivity.class);
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(launchIntent);
            }
        }
    }
}
