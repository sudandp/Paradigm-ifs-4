---
description: Daily Development & Android Build Procedure
---

Follow these steps to ensure your app is consistently built, synced, and backed up without breaking Google Sign-In.

### 1. Daily Development
When you are finished with your coding changes for the day:
1.  **Save all files** in your editor.
2.  Test the web version locally with `npm run dev`.

### 2. Versioning & Building
Run the automated build script:
```powershell
npm run build:apk
```
**What this does automatically:**
*   Bumps the version number (e.g. 10.3.0 -> 10.4.0).
*   Runs `vite build` to compile the web assets into the `dist` folder.
*   Runs `npx cap sync android` to copy those assets into the Android project.

### 3. Creating the Signed APK (Android Studio)
1.  Open your project in **Android Studio**.
2.  Go to **Build > Generate Signed Bundle / APK...**.
3.  Choose **APK** and click Next.
4.  Use your **existing Key Store Path** (the `.jks` file).
    *   *Warning: Never use a new keystore, or you will have to register its SHA-1 in Firebase again.*
5.  Select **release** build and V4 (Full APK Signature) if available.
6.  Click **Finish**.

### 4. Saving to GitHub
Once your build is successful and you are happy with the changes:
```powershell
git add .
git commit -m "Description of changes (e.g. Fixed notification spam and Google Auth)"
git push
```

### 5. Why the Google Sign-In remains fixed
*   **SHA-1 Persistence**: Now that you have registered your machine's SHA-1 in Firebase, Google recognizes your app.
*   **google-services.json**: The file you just replaced contains the whitelist for your machine. As long as you don't delete it or change signing keys, it will work forever on this machine.
