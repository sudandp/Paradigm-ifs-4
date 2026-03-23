import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
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
      // When the app is in the FOREGROUND, Capacitor intercepts push notifications
      // and they do NOT appear in the system tray. We must manually post a local
      // notification so Samsung sees it and shows the launcher badge.
      PushNotifications.addListener('pushNotificationReceived', async (notification) => {
        console.log('[Push] Native notification received in foreground:', notification);
        
        const data = notification.data || {};
        const count = data.notification_count || data.badge;

        if (count) {
          try {
            const { Badge } = await import('@capawesome/capacitor-badge');
            const badgeCount = parseInt(count);
            if (!isNaN(badgeCount)) {
              console.log('[Push] Setting badge count from notification:', badgeCount);
              await Badge.set({ count: badgeCount });
              
              // Also update the store if possible
              try {
                const { useNotificationStore } = await import('../store/notificationStore');
                useNotificationStore.setState({ 
                  unreadCount: badgeCount, // This is a rough estimation, better to fetch
                  totalUnreadCount: badgeCount 
                });
                // Trigger a full fetch to be precise
                useNotificationStore.getState().fetchNotifications();
              } catch (e) {
                console.warn('[Push] Failed to update store from notification data:', e);
              }
            }
          } catch (err) {
            console.warn('[Push] Failed to set badge count:', err);
          }
        }

        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                title: notification.title || 'Paradigm IFS',
                body: notification.body || '',
                id: Math.floor(Math.random() * 100000),
                channelId: 'default',
                sound: 'beep.wav',
                extra: data,
              }
            ]
          });
        } catch (err) {
          console.error('[Push] Failed to post foreground notification to tray:', err);
        }
      });
      
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Native notification action performed:', action);
      });
    } else if (messaging) {
      onMessage(messaging, (payload) => {
        console.log('[Push] Web message received:', payload);
      });
    }
  },
};

/**
 * Native-specific initialization (Android/iOS)
 */
async function initNative() {
  // Create notification channel FIRST (required for Android 8+)
  // This ensures the "default" channel exists with badges enabled
  try {
    await LocalNotifications.createChannel({
      id: 'default',
      name: 'General Notifications',
      description: 'All app notifications',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1, // PUBLIC
      sound: 'beep.wav',
      vibration: true,
      lights: true,
    });
    console.log('[Push] Notification channel "default" created with badges enabled');
  } catch (err) {
    console.warn('[Push] Channel creation failed (may already exist):', err);
  }

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
    let registration;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=' + new Date().getTime());
      await navigator.serviceWorker.ready;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        console.log('[Push] Web registration token:', token);
        await saveTokenToDatabase(token, 'web');
      } else {
        console.warn('[Push] No registration token available.');
      }
    }
  } catch (err: any) {
    console.error('[Push] Web initialization error:', err);
  }
}

/**
 * Save the FCM token to the Supabase database
 */
async function saveTokenToDatabase(token: string, platform: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[Push] Save token failed: No user logged in.');
    return;
  }

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

