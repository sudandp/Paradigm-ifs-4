# Paradigm IFS - Capacitor Android App

This project now uses **Capacitor** to run the web app as a native Android
application. This approach handles the WebView complexity automatically,
preventing common crashes.

## How to Build & Run

1. **Open Android Studio**: Run the following command in your terminal VSCode:
   ```bash
   npx cap open android
   ```
   Or manually open the `android` folder in Android Studio.

2. **Wait for Sync**: Android Studio will import the project. Wait for Gradle
   sync to finish.

3. **Run**: Click the **Green Play Button** (▶) to run on your device.

## Updates

If you update your web code:

1. Run `npm run build`
2. Run `npx cap sync`
3. Re-run from Android Studio.

## Configuration

- **Permissions**: Managed in `android/app/src/main/AndroidManifest.xml`.
- **App Config**: `capacitor.config.ts`.
