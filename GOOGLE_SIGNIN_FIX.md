## Step 1: Get your SHA-1 Fingerprint (Easiest Way)

Since I am an AI, I cannot access your private security keys directly. The easiest way for you to find the SHA-1 is inside **Android Studio**:

1. Open your project in **Android Studio**.
2. Click the **Gradle** tab on the **right edge** of the window.
3. Navigate to: `paradigm-onboarding-frontend-prototype` -> `Tasks` -> `android` -> `signingReport`.
4. **Double-click `signingReport`**.
5. Look at the **Run** window at the bottom. It will print the **SHA-1** for both `debug` and `release`.

---

## Alternative: Command Line (if you have the keystore file)
If you prefer the terminal, run this command:
```powershell
keytool -list -v -keystore YOUR_KEYSTORE_PATH -alias YOUR_ALIAS_NAME
```

When prompted for the password, enter it. Look for the **SHA1** line. It looks like this:
`SHA1: AA:BB:CC:DD:11:22:33...`

## Step 2: Add SHA-1 to Google Cloud Console

1. Go to the [Google Cloud Console Credentials page](https://console.cloud.google.com/apis/credentials).
2. Look for your **Android Client ID**. If you only have one for Debug, you must create a **NEW** one for Release.
3. Click **Create Credentials** -> **OAuth client ID**.
4. Select **Android** as the application type.
5. In the **Package name** field, enter: `com.paradigm.ifs` (Verify this in your `capacitor.config.ts`).
6. In the **SHA-1 certificate fingerprint** field, paste the SHA-1 you got from Step 1.
7. Click **Create**.

## Step 3: Verify Supabase (Optional but Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **Authentication** -> **Providers** -> **Google**.
3. Ensure the "Authorized Client IDs" list includes the **Web Client ID** you are using in the app.

## Why this happens
- **Emulator**: Uses `debug.keystore`.
- **Signed APK**: Uses your private production key.
- **Google Play**: If you use "Play App Signing", there is a **THIRD** SHA-1 (the App Signing certificate) found in the Google Play Console under **Setup -> App Signing**. You must add that one too!

After adding the new SHA-1 to Google Cloud, wait about 5 minutes for it to propagate, then try signing in again.
