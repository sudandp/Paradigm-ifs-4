import OneSignalNative from 'onesignal-cordova-plugin';
import { Capacitor } from '@capacitor/core';
import OneSignalWeb from 'react-onesignal';

/**
 * OneSignal Push Notification Service
 * 
 * Manages push notification subscriptions and user identification.
 * Uses `react-onesignal` v3.x for Web and `onesignal-cordova-plugin` v5.x for Native.
 * The external_user_id maps OneSignal subscriptions to Supabase user IDs.
 */

// ─── State ───────────────────────────────────────────────────────────────────

let _initialized = false;
let _initPromise: Promise<void> | null = null;

// ─── Service ─────────────────────────────────────────────────────────────────

export const oneSignalService = {

  /**
   * Initialize OneSignal SDK.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  init: (appId: string): Promise<void> => {
    if (!appId) {
      console.error('[OneSignal] No App ID provided.');
      return Promise.resolve();
    }

    // Deduplicate: if already initialized or in progress, return the existing promise
    if (_initialized || _initPromise) {
      return _initPromise || Promise.resolve();
    }

    const normalizedAppId = appId.toLowerCase().trim().replace(/['"]/g, '');
    console.log('[OneSignal] Initializing with App ID:', normalizedAppId);

    if (Capacitor.isNativePlatform()) {
      _initPromise = initNative(normalizedAppId);
    } else {
      _initPromise = initWeb(normalizedAppId);
    }

    return _initPromise;
  },

  /**
   * Associate this device/browser with a Supabase user ID.
   * Call after the user logs in.
   */
  login: (userId: string) => {
    if (!userId) return;

    try {
      if (Capacitor.isNativePlatform()) {
        console.log('[OneSignal] Native login:', userId);
        OneSignalNative.login(userId);
      } else {
        const canLoginNow = _initialized && typeof window !== 'undefined' && !!(window as any).OneSignal;
        
        if (canLoginNow) {
          console.log('[OneSignal] Web login:', userId);
          try {
            OneSignalWeb.login(userId).catch(err =>
              console.warn('[OneSignal] Web login failed:', err)
            );
          } catch (e) {
            console.warn('[OneSignal] Synchronous web login error:', e);
          }
        } else if (_initPromise) {
          // SDK is still initializing — wait for it, then login
          console.log('[OneSignal] Queuing login until init completes:', userId);
          _initPromise.then(() => {
            try {
              if (typeof window !== 'undefined' && !!(window as any).OneSignal) {
                OneSignalWeb.login(userId).catch(err =>
                  console.warn('[OneSignal] Deferred web login failed:', err)
                );
              } else {
                console.warn('[OneSignal] Deferred login cancelled: SDK still not found in window.');
              }
            } catch (e) {
              console.warn('[OneSignal] Deferred web login error:', e);
            }
          });
        } else {
          console.warn('[OneSignal] Cannot login — SDK not initialized.');
        }
      }
    } catch (error) {
      console.error('[OneSignal] Fatal login error:', error);
    }
  },

  /**
   * Disassociate the device from the current user.
   * Call on logout.
   */
  logout: () => {
    try {
      if (Capacitor.isNativePlatform()) {
        console.log('[OneSignal] Native logout');
        OneSignalNative.logout();
      } else if (_initialized) {
        console.log('[OneSignal] Web logout');
        OneSignalWeb.logout();
      }
    } catch (error) {
      console.error('[OneSignal] Logout error:', error);
    }
  },

  /**
   * Explicitly request notification permission.
   * On Web: shows the OneSignal Slidedown or falls back to browser prompt.
   * On Native: requests via the OS dialog.
   */
  requestPermission: async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        console.log('[OneSignal] Requesting native permission...');
        await OneSignalNative.Notifications.requestPermission(true);
        return;
      }

      // Web path
      if (_initialized) {
        console.log('[OneSignal] Requesting web permission...');
        try {
          // react-onesignal v3.x exposes Slidedown
          if (OneSignalWeb.Slidedown && typeof (OneSignalWeb.Slidedown as any).promptPush === 'function') {
            await (OneSignalWeb.Slidedown as any).promptPush();
          } else if (OneSignalWeb.Notifications && typeof OneSignalWeb.Notifications.requestPermission === 'function') {
            await OneSignalWeb.Notifications.requestPermission();
          } else {
            // Last resort: native browser API
            await Notification.requestPermission();
          }
        } catch (sdkErr) {
          console.warn('[OneSignal] SDK prompt failed, using browser fallback:', sdkErr);
          if (typeof Notification !== 'undefined') {
            await Notification.requestPermission();
          }
        }
      } else {
        // OneSignal not initialized (e.g. localhost restrictions) — use browser API
        console.warn('[OneSignal] Not initialized, using browser notification API.');
        if (typeof Notification !== 'undefined') {
          const result = await Notification.requestPermission();
          console.log('[OneSignal] Browser permission result:', result);
        }
      }
    } catch (error) {
      console.error('[OneSignal] requestPermission error:', error);
    }
  },

  /**
   * Get current subscription status for debugging.
   * Returns an object with permission, subscriptionId, and optedIn.
   */
  getSubscriptionStatus: async (): Promise<{
    permission: string;
    subscriptionId: string | null;
    optedIn: boolean | null;
    initialized: boolean;
  }> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const pushSub = OneSignalNative.User.pushSubscription;
        return {
          permission: 'native',
          subscriptionId: pushSub.id || null,
          optedIn: pushSub.optedIn ?? null,
          initialized: _initialized,
        };
      } catch {
        return { permission: 'unknown', subscriptionId: null, optedIn: null, initialized: _initialized };
      }
    }

    // Web
    if (!_initialized) {
      return {
        permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
        subscriptionId: null,
        optedIn: null,
        initialized: false,
      };
    }

    try {
      const notifications = (OneSignalWeb as any).Notifications;
      const pushSubscription = (OneSignalWeb as any).User?.PushSubscription;

      return {
        permission: (await notifications?.permission) || Notification.permission || 'unknown',
        subscriptionId: pushSubscription?.id || null,
        optedIn: pushSubscription?.optedIn ?? null,
        initialized: true,
      };
    } catch {
      return {
        permission: Notification.permission || 'unknown',
        subscriptionId: null,
        optedIn: null,
        initialized: true,
      };
    }
  },
};

// ─── Internal: Web Initialization ────────────────────────────────────────────

async function initWeb(appId: string): Promise<void> {
  try {
    await OneSignalWeb.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerParam: { scope: '/' },
      serviceWorkerPath: '/OneSignalSDKWorker.js',
      promptOptions: {
        slidedown: {
          prompts: [
            {
              type: 'push' as any,
              autoPrompt: true,
              text: {
                actionMessage: 'Subscribe to notifications for the latest news and updates. You can disable anytime.',
                acceptButton: 'Subscribe',
                cancelButton: 'Later',
              },
              delay: {
                pageViews: 1,
                timeDelay: 5,
              },
            },
          ],
        },
      },
      notifyButton: {
        enable: true,
        displayPredicate: () => {
          // Hide on mobile screens (less than 768px)
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            return Promise.resolve(false);
          }
          // Always show on desktop so users can check status or manage notifications
          return Promise.resolve(true);
        },
        size: 'small',
        theme: 'default',
        position: 'bottom-right',
        showCredit: false,
        prenotify: false,
        colors: {
          'circle.background': '#1e293b', // Slate-800 for a more integrated look
          'circle.foreground': 'white',
          'badge.background': '#059669', // Emerald-600
          'badge.foreground': 'white',
          'badge.bordercolor': 'white',
          'pulse.color': '#1e293b',
          'dialog.button.background.hover': '#005632',
          'dialog.button.background.active': '#005632',
          'dialog.button.background': '#006b3f',
          'dialog.button.foreground': 'white',
        },
        text: {
          'tip.state.unsubscribed': '',
          'tip.state.subscribed': '',
          'tip.state.blocked': '',
          'message.prenotify': '',
          'message.action.subscribed': 'Subscribed!',
          'message.action.resubscribed': "Subscribed!",
          'message.action.unsubscribed': "Unsubscribed",
          'dialog.main.title': 'Notifications (Click Bell to Close)',
          'dialog.main.button.subscribe': 'SUBSCRIBE',
          'dialog.main.button.unsubscribe': 'UNSUBSCRIBE',
          'dialog.blocked.title': 'Unblock Notifications',
          'dialog.blocked.message': 'Follow these steps to allow notifications:',
        },
      } as any,
    });

    _initialized = true;
    console.log('[OneSignal] Web initialized successfully.');

    // Attach event listeners
    const notifications = (OneSignalWeb as any).Notifications;
    const pushSubscription = (OneSignalWeb as any).User?.PushSubscription;

    if (notifications) {
      notifications.addEventListener('foregroundWillDisplay', (event: any) => {
        console.log('[OneSignal] Foreground notification:', event);
      });
      notifications.addEventListener('click', (event: any) => {
        console.log('[OneSignal] Notification clicked:', event);
      });
    }

    if (pushSubscription) {
      pushSubscription.addEventListener('change', (event: any) => {
        console.log('[OneSignal] Subscription changed:', {
          current: event.current,
          previous: event.previous,
        });
      });
    }

    // Log initial status
    const status = await oneSignalService.getSubscriptionStatus();
    console.log('[OneSignal] Initial status:', status);

  } catch (error) {
    console.error('[OneSignal] Web init failed:', error);
    _initialized = false;
  }
}

// ─── Internal: Native Initialization ─────────────────────────────────────────

async function initNative(appId: string): Promise<void> {
  try {
    // Request badge permissions early on native platforms
    try {
      const { Badge } = await import('@capawesome/capacitor-badge');
      const status = await Badge.checkPermissions();
      if (status.display !== 'granted') {
        await Badge.requestPermissions();
      }
    } catch (badgeErr) {
      console.warn('[OneSignal] Failed to initialize badge permissions:', badgeErr);
    }

    OneSignalNative.Debug.setLogLevel(6);
    OneSignalNative.initialize(appId);

    OneSignalNative.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      console.log('[OneSignal] Native foreground notification:', event);
      event.getNotification().display();
    });

    OneSignalNative.Notifications.addEventListener('click', (event) => {
      console.log('[OneSignal] Native notification clicked:', event);
      const data = event.notification.additionalData as any;
      if (data?.url) {
        window.location.href = data.url;
      }
    });

    _initialized = true;

    // Log subscription status
    const pushSub = OneSignalNative.User.pushSubscription;
    console.log('[OneSignal] Native initialized.', {
      appId,
      subscriptionId: pushSub.id,
      optedIn: pushSub.optedIn,
    });

  } catch (error) {
    console.error('[OneSignal] Native init failed:', error);
    _initialized = false;
  }
}
