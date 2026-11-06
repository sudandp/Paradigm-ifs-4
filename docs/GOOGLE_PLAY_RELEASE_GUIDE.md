# Google Play Console Release Guide (Option A: Android Studio Wizard)

This document provides the standard operating procedure for preparing, signing, and uploading production release updates of the **Paradigm IFS** mobile app to the Google Play Console.

---

## Overview of the Workflow

```
┌───────────────────────────────────────────────┐
│ 1. Terminal (Antigravity / VS Code)           │
│    Run: npm run build:android:sync            │
│    • Bumps versionCode & versionName          │
│    • Builds production Vite bundle            │
│    • Syncs assets to android/app/...          │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│ 2. Android Studio (Signing Wizard)            │
│    Run: npx cap open android                  │
│    • Build > Generate Signed Bundle / APK...  │
│    • Select Android App Bundle (.aab)         │
│    • Sign with Release Keystore (.jks)        │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│ 3. Google Play Console                        │
│    Upload: android/app/release/app-release.aab│
│    • Publish release to production / testing  │
│    • Client automatically cleans stale cache  │
└───────────────────────────────────────────────┘
```

---

## Step 1: Prepare & Sync the Code (Terminal)

Open your terminal in the project root and execute:

```bash
npm run build:android:sync
```

### What this automatically handles:
1. **Auto-Version Bump**:
   - `android/app/build.gradle`: Increments `versionCode` and `versionName`.
   - `src/config/appVersion.ts`: Updates `APP_VERSION` and `APP_BUILD_NUMBER`.
   - `package.json` & `public/version.json`: Keeps version identifiers unified.
2. **Production Bundle**:
   - Compiles optimized JavaScript, CSS, and assets via Vite.
3. **Capacitor Sync**:
   - Copies the compiled web bundle to `android/app/src/main/assets/public`.

---

## Step 2: Open Android Studio

From your terminal, run:

```bash
npx cap open android
```

*(Alternatively, open Android Studio manually and open the `android` folder in this repository).*

---

## Step 3: Generate the Signed App Bundle (.aab)

Inside Android Studio:

1. In the top application menu bar, go to:
   **Build** $\rightarrow$ **Generate Signed Bundle / APK...**
2. Choose **Android App Bundle** and click **Next**.
3. Fill in your release keystore credentials:
   - **Key store path**: Click *Choose existing...* and select your `.jks` file.
   - **Key store password**: Enter your keystore password.
   - **Key alias**: Select your key alias (e.g., `paradigm`).
   - **Key password**: Enter your key password.
   - Check ☑ **Remember passwords** (recommended for future releases).
4. Click **Next**.
5. Select destination build variant: **release**.
6. Ensure **V1 (Jar Signature)** and/or **V2 (Full APK Signature)** are checked if prompted.
7. Click **Create** (or **Finish**).

---

## Step 4: Upload to Google Play Console

1. When the build completes, Android Studio displays a notification:
   > *"App bundle(s) generated successfully for module 'app' with 1 build variant: [release]"*
2. Click **locate** in the notification to reveal `app-release.aab` in File Explorer:
   ```
   android/app/release/app-release.aab
   ```
3. Open [Google Play Console](https://play.google.com/console).
4. Navigate to your app: **Paradigm IFS**.
5. In the left navigation, choose your release track:
   - **Production** (for live users), or
   - **Testing** $\rightarrow$ **Internal testing** (for internal QA).
6. Click **Create new release**.
7. Drag and drop the `app-release.aab` file into the upload zone.
8. Enter release notes (these were auto-generated in `src/config/releaseNotes.ts`).
9. Click **Next** $\rightarrow$ **Save and publish**.

---

## Why This Eliminates Stale Cache Issues on User Devices

1. **Automatic Version Detection**:
   When users download the update from the Google Play Store, the native app detects that the installed `versionCode` is greater than the previously recorded version code.
2. **Selective Auto-Purge (`services/appUpgradeManager.ts`)**:
   On the very first launch after the update, the app executes `executeSafeCacheClearance()`:
   - Purges stale `paradigm_cache_*` keys (`organizations`, `users`, `site_responsibility_matrix`, etc.).
   - Unregisters old Service Workers and wipes `CacheStorage` (`supabase-api-cache`).
   - Resets outdated punch states while **preserving login credentials, session tokens, and offline mutation queues**.
3. **Instant Fresh Data**:
   The app immediately connects with clean memory, so users never see blank screens or stale data.

