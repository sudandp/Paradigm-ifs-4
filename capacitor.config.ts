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
      '*.supabase.co',
      '*.onesignal.com'
    ]
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    }
  }
};

export default config;
