import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.paradigm.ifs',
  appName: 'Paradigm IFS',
  webDir: 'dist',
  server: {
    // Mask the local bundle to look like the production domain
    // This allows Auth redirects to https://app.paradigmfms.com to be caught by the app
    androidScheme: 'https',
    url: 'https://app.paradigmfms.com',
    allowNavigation: [
      'app.paradigmfms.com',
      '*.supabase.co'
    ]
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Badge: {
      persist: true,
      autoClear: false
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      launchFadeOutDuration: 500,
      backgroundColor: "#041b0f",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#041b0f"
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true
    },
    CapacitorSocialLogin: {
      webClientId: "YOUR_WEB_CLIENT_ID",
      androidClientId: "YOUR_WEB_CLIENT_ID"
    }
  }
};

export default config;
