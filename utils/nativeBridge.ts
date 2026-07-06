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

let webTrackingIntervalId: any = null;

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
      if (webTrackingIntervalId) clearInterval(webTrackingIntervalId);
      
      const trackLocation = () => {
          if ('geolocation' in navigator) {
             navigator.geolocation.getCurrentPosition(
               async (position) => {
                  try {
                      const payload = {
                          user_id: userId,
                          type: 'TRACKING',
                          latitude: position.coords.latitude,
                          longitude: position.coords.longitude,
                          timestamp: new Date().toISOString()
                      };
                      
                      await fetch(`${supabaseUrl}/rest/v1/attendance_events`, {
                          method: 'POST',
                          headers: {
                              'apikey': supabaseAnonKey || '',
                              'Authorization': `Bearer ${supabaseAnonKey}`,
                              'Content-Type': 'application/json',
                              'Prefer': 'return=minimal'
                          },
                          body: JSON.stringify(payload)
                      });
                      console.log('Web tracking updated successfully');
                  } catch (e) {
                      console.error('Web tracking failed', e);
                  }
               },
               (err) => console.warn('Geolocation error:', err),
               { enableHighAccuracy: true }
             );
          }
      };
      
      // Call immediately once
      trackLocation();
      
      // Then set interval
      webTrackingIntervalId = setInterval(trackLocation, intervalMinutes * 60 * 1000);
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
    } else {
       if (webTrackingIntervalId) {
          clearInterval(webTrackingIntervalId);
          webTrackingIntervalId = null;
       }
    }
  }
};
