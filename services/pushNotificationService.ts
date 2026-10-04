import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications, type Channel } from '@capacitor/local-notifications';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../config/firebase';
import { supabase } from './supabase';
import { APP_VERSION, APP_BUILD_NUMBER } from '../src/config/appVersion';

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

        if (data.type === 'SILENT_TRACKING_PING') {
          console.log('[Push] Silent tracking ping received on native');
          window.dispatchEvent(new CustomEvent('silent-tracking-ping', { detail: data }));
          return;
        }

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
      
      // Native push notification click listener (from FCM system notification tray)
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Native push notification action performed:', action);
        handleNotificationTap(action);
      });

      // Native local notification click listener (from foreground / local tray notifications)
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        console.log('[Push] Native local notification action performed:', action);
        handleNotificationTap(action);
      });
    } else if (messaging) {
      onMessage(messaging, (payload) => {
        console.log('[Push] Web message received:', payload);
        
        if (payload.data?.type === 'SILENT_TRACKING_PING') {
          console.log('[Push] Silent tracking ping received on web');
          window.dispatchEvent(new CustomEvent('silent-tracking-ping', { detail: payload.data }));
          return;
        }

        // Show browser notification for foreground messages
        if (Notification.permission === 'granted') {
          const title = payload.notification?.title || payload.data?.title || 'Paradigm Office';
          const body = payload.notification?.body || payload.data?.body || '';
          const notification = new Notification(title, {
            body,
            icon: '/icons/icon-192x192.png',
            data: payload.data, // Store data for click handler
          });

          notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            handleNotificationTap({
              notification: { title, body },
              data: payload.data,
            });
            notification.close();
          };
        }
      });
    }
  },
};

/**
 * Smart Router for Notification Click / Tap Events:
 * Handles incoming push notifications & local tray notifications when tapped.
 * Routes user to the exact target page (Approvals, Leaves, Unlocks, Tasks, etc.)
 * or opens the sliding NotificationPanel for general/summary notifications.
 */
export async function handleNotificationTap(actionPayload: any) {
  try {
    console.log('[NotificationRouter] Action performed with payload:', actionPayload);
    if (!actionPayload) return;

    // Delegate break action buttons directly to break alarm handler in App.tsx
    if (actionPayload.actionId === 'RESUME_WORK' || actionPayload.actionId === 'CONTINUE_BREAK') {
      console.log('[NotificationRouter] Delegating break action button:', actionPayload.actionId);
      return;
    }

    const notif = actionPayload.notification || {};
    const rawData = notif.data || notif.extra || actionPayload.data || actionPayload.extra || {};
    
    // 1. Silent tracking ping — never navigate or open UI
    if (rawData.type === 'SILENT_TRACKING_PING') {
      console.log('[NotificationRouter] Silent tracking ping tapped, dispatching...');
      window.dispatchEvent(new CustomEvent('silent-tracking-ping', { detail: rawData }));
      return;
    }

    // 2. Badge notification tap (e.g. "You have 870 unread notifications or approvals")
    if (rawData.from_badge_notification || rawData.notification_action === 'open_notifications') {
      const { useNotificationStore } = await import('../store/notificationStore');
      const { useAuthStore } = await import('../store/authStore');
      const user = useAuthStore.getState().user;
      const userRole = (user?.role || '').toLowerCase();
      const userPerms: string[] = (user as any)?.permissions || [];
      const hasEnterpriseAccess = ['admin', 'super_admin', 'director', 'general_manager'].includes(userRole) ||
        userPerms.includes('manage_approval_workflow');

      const approvals = Number(rawData.approvalsCount || 0);
      const unreads = Number(rawData.unreadCount || 0);
      const section = rawData.section || (approvals > 0 && unreads === 0 ? 'approvals' : 'general');
      let targetRoute = rawData.route;

      // Prevent unauthorized redirection to /enterprise/approvals
      if (targetRoute === '/enterprise/approvals' && !hasEnterpriseAccess) {
        targetRoute = '/notifications';
      } else if (!targetRoute && approvals > 0 && hasEnterpriseAccess) {
        targetRoute = '/enterprise/approvals';
      }
      
      console.log(`[NotificationRouter] Badge summary notification tapped. Section=${section}, route=${targetRoute}`);
      if (targetRoute && targetRoute !== '/notifications') {
        window.dispatchEvent(new CustomEvent('push-deeplink', { detail: { url: targetRoute } }));
      }
      useNotificationStore.getState().openWithSection(section);
      return;
    }

    // 3. Direct deep link URL specified in payload (e.g. link: "/hrm/letters/templates" or "https://...")
    const directUrl = rawData.link || rawData.url || rawData.route || rawData.path || rawData.action_url;
    if (directUrl && typeof directUrl === 'string') {
      console.log('[NotificationRouter] Routing to direct URL:', directUrl);
      window.dispatchEvent(new CustomEvent('push-deeplink', { detail: { url: directUrl } }));
      if (rawData.section) {
        const { useNotificationStore } = await import('../store/notificationStore');
        useNotificationStore.getState().openWithSection(rawData.section);
      }
      return;
    }

    // 3. Category/Type-based smart routing
    const type = String(rawData.type || rawData.category || rawData.tag || rawData.action || '').toLowerCase();
    const entityType = String(rawData.entity_type || rawData.entity || '').toLowerCase();
    const title = String(notif.title || rawData.title || '').toLowerCase();
    const body = String(notif.body || rawData.body || rawData.message || '').toLowerCase();

    // Lazy load stores to avoid circular dependencies
    const { useNotificationStore } = await import('../store/notificationStore');
    const { useAuthStore } = await import('../store/authStore');
    const user = useAuthStore.getState().user;
    const userRole = (user?.role || '').toLowerCase();
    const userPerms: string[] = (user as any)?.permissions || [];
    
    const canManageLeaves = userPerms.includes('manage_leave_requests') || 
      ['admin', 'super_admin', 'hr', 'hr_ops', 'management', 'developer', 'director', 'general_manager'].includes(userRole) ||
      (userRole.includes('manager') && !userRole.includes('field_officer'));

    const canManageUnlocks = userPerms.includes('manage_users') || 
      ['admin', 'super_admin', 'management', 'developer', 'operation_manager', 'director', 'general_manager'].includes(userRole);

    const canAccessEnterpriseApprovals = userPerms.includes('manage_approval_workflow') ||
      ['admin', 'super_admin', 'director', 'general_manager'].includes(userRole);

    // Case A: Attendance Unlock Request / Approval
    if (
      type.includes('unlock') || 
      entityType.includes('unlock') || 
      title.includes('unlock') || 
      body.includes('unlock') ||
      rawData.request_type === 'unlock'
    ) {
      console.log('[NotificationRouter] Routing to Attendance Unlock. CanManage:', canManageUnlocks);
      if (canManageUnlocks) {
        window.dispatchEvent(new CustomEvent('push-deeplink', { detail: { url: '/admin/device-approvals' } }));
      } else {
        window.dispatchEvent(new CustomEvent('push-deeplink', { detail: { url: '/attendance/request-unlock' } }));
      }
      useNotificationStore.getState().openWithSection('unlocks');
      return;
    }

    // Case B: Leave Request / Leave Approval
    if (
      type.includes('leave') || 
      entityType.includes('leave') || 
      title.includes('leave') || 
      body.includes('leave') ||
      rawData.request_type === 'leave'
    ) {
      console.log('[NotificationRouter] Routing to Leave Requests. CanManage:', canManageLeaves);
      if (canManageLeaves) {
        window.dispatchEvent(new CustomEvent('push-deeplink', { detail: { url: '/hr/leave-management' } }));
      } else {
        window.dispatchEvent(new CustomEvent('push-deeplink', { detail: { url: '/leaves/dashboard' } }));
      }
      useNotificationStore.getState().openWithSection('leaves');
      return;
    }

    // Case C: General Approvals (Claims, Finance, Invoices, Workflow)
    if (
      type.includes('approval') || 
      entityType.includes('approval') || 
      title.includes('approval') || 
      body.includes('approval')
    ) {
      console.log('[NotificationRouter] Routing to Approvals Inbox. CanManage:', canAccessEnterpriseApprovals);
      if (canAccessEnterpriseApprovals) {
        window.dispatchEvent(new CustomEvent('push-deeplink', { detail: { url: '/enterprise/approvals' } }));
      }
      useNotificationStore.getState().openWithSection('approvals');
      return;
    }

    // Case D: Tasks (Assigned, Escalated)
    if (
      type.includes('task') || 
      entityType.includes('task') || 
      title.includes('task') || 
      body.includes('task')
    ) {
      const taskId = rawData.task_id || rawData.taskId || rawData.id;
      const taskUrl = taskId ? `/tasks/edit/${taskId}` : '/tasks';
      console.log('[NotificationRouter] Routing to Tasks:', taskUrl);
      window.dispatchEvent(new CustomEvent('push-deeplink', { detail: { url: taskUrl } }));
      return;
    }

    // Case E: Support Tickets
    if (
      type.includes('ticket') || 
      entityType.includes('ticket') || 
      title.includes('ticket') || 
      body.includes('ticket') ||
      type.includes('support')
    ) {
      const ticketId = rawData.ticket_id || rawData.ticketId || rawData.id;
      const ticketUrl = ticketId ? `/support/ticket/${ticketId}` : '/support';
      console.log('[NotificationRouter] Routing to Support Ticket:', ticketUrl);
      window.dispatchEvent(new CustomEvent('push-deeplink', { detail: { url: ticketUrl } }));
      return;
    }

    // Case F: Attendance, Break Alerts, Punches
    if (
      type.includes('attendance') || 
      type.includes('break') || 
      type.includes('punch') || 
      title.includes('attendance') || 
      title.includes('punch') ||
      title.includes('break')
    ) {
      console.log('[NotificationRouter] Routing to Attendance Dashboard');
      window.dispatchEvent(new CustomEvent('push-deeplink', { detail: { url: '/attendance/dashboard' } }));
      return;
    }

    // Case G: Default / Unread Notifications / General Announcements
    // e.g. "You have 870 unread notifications"
    console.log('[NotificationRouter] Opening Notification drawer for general notifications');
    useNotificationStore.getState().openWithSection('general');

  } catch (routeErr) {
    console.error('[NotificationRouter] Error routing notification tap:', routeErr);
  }
}

/**
 * Native-specific initialization (Android/iOS)
 */
async function initNative() {
  // Create notification channels (required for Android 8+)
  // Each channel groups notifications by type with different priority levels
  const channels: Channel[] = [
    {
      id: 'alerts',
      name: 'Alerts & Security',
      description: 'Security alerts and emergency broadcasts',
      importance: 5 as Channel['importance'],
      visibility: 1,
      sound: 'beep.wav',
      vibration: true,
      lights: true,
    },
    {
      id: 'approvals',
      name: 'Approvals',
      description: 'Leave requests, device approvals, and workflow actions',
      importance: 4 as Channel['importance'],
      visibility: 1,
      sound: 'beep.wav',
      vibration: true,
      lights: true,
    },
    {
      id: 'default',
      name: 'General Notifications',
      description: 'General app notifications and updates',
      importance: 3 as Channel['importance'],
      visibility: 1,
      sound: 'beep.wav',
      vibration: true,
      lights: true,
    },
    {
      id: 'reminders',
      name: 'Reminders',
      description: 'Shift reminders, general alerts, and scheduled notifications',
      importance: 2 as Channel['importance'],
      visibility: 1,
      vibration: false,
      lights: false,
    },
    {
      id: 'break_reminders',
      name: 'Break Status Reminders',
      description: 'Periodic alerts during breaks to prevent loss of pay. User can customize sound in settings.',
      importance: 5 as Channel['importance'], // MAX importance for "Standard System Alert" + Peek
      visibility: 1,
      // Android: filename must be WITHOUT extension, referencing res/raw/beep.wav
      sound: 'beep',
      vibration: true,
      lights: true,
    },
  ];

  for (const channel of channels) {
    try {
      await LocalNotifications.createChannel(channel);
    } catch (err) {
      console.warn(`[Push] Channel "${channel.id}" creation failed:`, err);
    }
  }
  console.log('[Push] Notification channels created');

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
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
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
      app_version: APP_VERSION,
      build_number: APP_BUILD_NUMBER,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'token' });

  if (error) {
    console.error('[Push] Error saving token to database:', error);
  } else {
    console.log('[Push] Token saved successfully.');
  }
}

// ─── Native Notification Shade Tap Listener & Cold Boot Processor ──────────────
if (typeof window !== 'undefined') {
  window.addEventListener('native-notification-tap', (e: any) => {
    console.log('[Push] native-notification-tap event received:', e.detail);
    handleNotificationTap({ data: e.detail });
  });

  const checkPendingNotificationTap = () => {
    const pending = (window as any).__PENDING_NOTIFICATION_TAP__;
    if (pending) {
      (window as any).__PENDING_NOTIFICATION_TAP__ = null;
      console.log('[Push] Processing boot pending notification tap:', pending);
      handleNotificationTap({ data: pending });
    }
  };

  // Check immediately and with small delays to ensure React routing is ready
  setTimeout(checkPendingNotificationTap, 500);
  setTimeout(checkPendingNotificationTap, 1500);
}


