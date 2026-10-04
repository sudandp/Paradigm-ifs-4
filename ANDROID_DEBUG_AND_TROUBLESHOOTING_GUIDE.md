# Android Debugging & Troubleshooting Guide (Play Store & Debug Builds)

This guide documents the root cause, fixes, and step-by-step procedures for debugging the Paradigm IFS Android application, including how to inspect live devices and simulate long-running session/storage issues.

---

## 📌 Summary of Root Causes & Permanent Fixes (1-Day Play Store Bug)

### The Issue
* **Symptom**: App downloaded from Google Play Store works fine for ~1 day after clearing storage/cache, but eventually breaks (frozen screens, 401 Unauthorized errors). Downloading/installing directly via Chrome (or direct APK) worked continuously.
* **Why Chrome / Direct APK worked**:
  1. Direct APK uses your local keystore SHA-1 (`paradigm-ifs-release.jks`), which was registered in Firebase.
  2. Direct builds did not have aggressive R8 minification or ran under standard browser storage rules.

### The 3 Core Root Causes Fixed in Code:

1. **LocalStorage Cleaner Wiped Auth Tokens (`App.tsx`)**:
   * *Problem*: After 1 day of duty, GPS route tracking logs (`local_route_points_`), cached tables, and attendance accumulated to >75% of localStorage quota. The proactive cleanup routine in `App.tsx` previously deleted keys matching `sb-` and `supabase.auth.`.
   * *Fix*: Protected `sb-`, `supabase.auth.`, `-auth-token`, `_sec_`, and `_app_enc_salt_` from ever being deleted during quota eviction.

2. **The Zombie Session Trap (`App.tsx`)**:
   * *Problem*: When the Supabase JWT token expired or was wiped, `App.tsx` fell back to `restoreFromOfflineCache()`, setting `user = cachedUser` in memory even though Supabase had no active JWT. The app loaded the dashboard, but every API call failed with `401 Unauthorized`. Users were locked out until they cleared Android storage.
   * *Fix*: If the device is online and the session cannot be restored/refreshed, `App.tsx` sets `user = null` and cleanly routes the user to `/auth/login` instead of trapping them in a zombie state.

3. **ProGuard / R8 Obfuscation (`android/app/proguard-rules.pro`)**:
   * *Problem*: In Release builds (used for Play Store `.aab`), R8 minification was enabled. The rules preserved `cap.go.**`, but the actual Java package for `@capgo/capacitor-social-login` and `@capgo/capacitor-updater` is `ee.forgr.**`.
   * *Fix*: Added explicit keep rules:
     ```proguard
     -keep class ee.forgr.** { *; }
     -keep class ee.forgr.capacitor.social.login.** { *; }
     -keep class ee.forgr.capacitor_updater.** { *; }
     ```

4. **Chrome Remote WebView Debugging (`MainActivity.java`)**:
   * *Security Fix (C1)*: Wrapped with `WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);`. This enables live Chrome DevTools inspection (`chrome://inspect`) on your debug builds over USB, while keeping production Play Store builds completely secure against unauthorized inspection.

---

## ⚡ How to Fast-Forward & Simulate "After a Few Hours" Right Now

Instead of waiting hours or days, use these tests to simulate long idle periods and token expirations on your connected phone:

### Test 1: Simulate Android Deep Sleep / Doze Mode
When a phone is left in a pocket or on a desk for hours, Android puts the device into Doze mode, killing TCP sockets and background timers.
```powershell
# 1. Put the app in background (press Home on phone)
# 2. Force Doze mode:
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" shell dumpsys deviceidle force-idle

# 3. Wait 10 seconds, then reopen the app on the phone.
# 4. Verify in logs: [AppState] Refreshing Supabase session... ✅ Session valid after resume.

# 5. Exit idle mode:
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" shell dumpsys deviceidle unforce
```

### Test 2: Simulate Token Expiry in Chrome DevTools
1. Open `chrome://inspect/#devices` on your PC Chrome and click **Inspect**.
2. Open the **Console** tab and execute:
   ```javascript
   // Corrupt the active access token to simulate expiration after hours
   supabase.auth.setSession({ 
     access_token: 'expired_simulated_token', 
     refresh_token: (await supabase.auth.getSession()).data.session?.refresh_token 
   });
   ```
3. Tap any button on your phone.
4. **Expected**: Supabase automatically refreshes the token in the background. If permanently revoked, it redirects cleanly to the login screen.

### Test 3: Simulate 1-Day Storage Quota Eviction
1. In the Chrome DevTools Console, paste:
   ```javascript
   for (let i = 0; i < 50; i++) {
     localStorage.setItem('paradigm_cache_dummy_' + i, 'X'.repeat(50000));
   }
   console.log('Storage filled. Reloading to test eviction...');
   window.location.reload();
   ```
2. **Expected**: The console will show:
   `[App] Evicted XX stale localStorage keys (auth tokens preserved).`
   Running `await supabase.auth.getSession()` will confirm the user is still logged in.

---

## 🩺 Live Debugging on Connected Device

### Method A: Chrome Remote Web Inspector (GUI)
1. Ensure **USB Debugging** is enabled on the phone (Settings → Developer Options → USB Debugging).
2. Connect phone via USB cable to PC.
3. In Chrome on PC, navigate to:
   ```
   chrome://inspect/#devices
   ```
4. Find `com.paradigm.ifs` under **Remote Target** and click **Inspect**.
5. Check:
   * **Console**: Look for red error messages.
   * **Network**: Filter by `Fetch/XHR` to view Supabase REST calls (`200` vs `401`).
   * **Application → Storage**: Inspect `Local Storage` and `Capacitor Preferences`.

### Method B: Pull Full Diagnostic Logcat via Terminal
Run this command from the project root:
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" logcat -d -s "Capacitor/Console" | Out-File -FilePath "mobile_issue.log"
```
Search `mobile_issue.log` for `[AuthEvent]`, `[AppState]`, `401`, or `Uncaught`.

---

## 🚀 Building & Deploying to Play Store

Whenever you make changes and want to publish an updated `.aab` to Google Play Store:

```powershell
# 1. Bump version, compile web bundle, and sync to Android
npm run build:apk
```

Then in **Android Studio**:
1. Open the `android` folder in Android Studio.
2. Go to **Build** → **Generate Signed Bundle / APK...**
3. Select **Android App Bundle** (`.aab`) and click **Next**.
4. Choose your release keystore (`paradigm-ifs-release.jks`).
5. Select build variant **release**.
6. Click **Finish**.
7. Upload the generated `.aab` file from `android/app/release/` to **Google Play Console**.
