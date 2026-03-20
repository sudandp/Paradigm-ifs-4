import { Capacitor } from '@capacitor/core';
import { supabaseUrl, supabaseAnonKey } from '../services/supabase';

// Define the interface for our custom native plugin (if we were using a standard Capacitor plugin)
// But for a simple WebView interface, we often use window.Android or similar.
// However, sticking to Capacitor's approach is cleaner if we can, but since we are doing
// a "WebAppInterface" in Android, it typically exposes itself on the window object.

declare global {
  interface Window {
    Android?: {
      startTracking: (interval: number, url: string, key: string, userId: string) => void;
      stopTracking: () => void;
      showToast: (message: string) => void;
    };
    webkit?: {
      messageHandlers?: {
        startTracking: { postMessage: (data: any) => void };
        stopTracking: { postMessage: (data: any) => void };
      }
    };
  }
}

export const NativeBridge = {
  startTracking: (intervalMinutes: number, userId: string) => {
    console.log(`Starting tracking with interval: ${intervalMinutes} mins for user: ${userId}`);
    
    if (Capacitor.getPlatform() === 'android') {
      if (window.Android && window.Android.startTracking) {
        window.Android.startTracking(intervalMinutes, supabaseUrl || '', supabaseAnonKey || '', userId);
      } else {
        console.warn('Android Native Interface not found');
      }
    } else if (Capacitor.getPlatform() === 'ios') {
       // iOS implementation (Deferred)
       if (window.webkit?.messageHandlers?.startTracking) {
         window.webkit.messageHandlers.startTracking.postMessage({ 
             interval: intervalMinutes,
             url: supabaseUrl,
             key: supabaseAnonKey,
             userId: userId
         });
       }
    } else {
      console.log('Web platform: Tracking simulation started');
    }
  },

  stopTracking: () => {
    console.log('Stopping tracking');
    
    if (Capacitor.getPlatform() === 'android') {
      if (window.Android && window.Android.stopTracking) {
        window.Android.stopTracking();
      }
    } else if (Capacitor.getPlatform() === 'ios') {
      if (window.webkit?.messageHandlers?.stopTracking) {
        window.webkit.messageHandlers.stopTracking.postMessage({});
      }
    }
  }
};
