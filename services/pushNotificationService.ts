import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../config/firebase';
import { supabase } from './supabase';

export const pushNotificationService = {
  /**
   * Request permission and initialize push notifications
   */
  init: async () => {
    if (Capacitor.isNativePlatform()) {
      return initNative();
    } else {
      return initWeb();
    }
  },

  /**
   * Listen for incoming messages
   */
  listen: () => {
    if (Capacitor.isNativePlatform()) {
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Native notification received:', notification);
      });
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Native notification action performed:', action);
      });
    } else if (messaging) {
      onMessage(messaging, (payload) => {
        console.log('[Push] Web message received:', payload);
        // You can use a custom notification library like react-hot-toast here
      });
    }
  },
};

/**
 * Native-specific initialization (Android/iOS)
 */
async function initNative() {
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    console.warn('[Push] Native notification permission not granted.');
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    console.log('[Push] Native registration token:', token.value);
    await saveTokenToDatabase(token.value, Capacitor.getPlatform());
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('[Push] Native registration error:', err.error);
  });
}

/**
 * Web-specific initialization
 */
async function initWeb() {
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });

      if (token) {
        console.log('[Push] Web registration token:', token);
        await saveTokenToDatabase(token, 'web');
      } else {
        console.warn('[Push] No registration token available. Request permission to generate one.');
      }
    }
  } catch (err) {
    console.error('[Push] Web initialization error:', err);
  }
}

/**
 * Save the FCM token to the Supabase database
 */
async function saveTokenToDatabase(token: string, platform: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('fcm_tokens')
    .upsert({
      user_id: user.id,
      token: token,
      platform: platform,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'token' });

  if (error) {
    console.error('[Push] Error saving token to database:', error);
  } else {
    console.log('[Push] Token saved successfully.');
  }
}
