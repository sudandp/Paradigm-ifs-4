import React from 'react';
import { create } from 'zustand';
import { api } from '../services/api';
import type { Notification } from '../types';
import { useAuthStore } from './authStore';
import { supabase } from '../services/supabase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';
import toast from 'react-hot-toast';

export interface BadgeHelperPlugin {
  setBadgeWithNotification(options: { count: number }): Promise<void>;
}
const BadgeHelper = registerPlugin<BadgeHelperPlugin>('BadgeHelper');

// ─── Singleton channel guard ──────────────────────────────────────────────────
// Supabase throws if you call .on() on a channel that has already been
// subscribed (same channel name, second call). This happens because the
// auth flow emits SIGNED_IN + INITIAL_SESSION + TOKEN_REFRESHED in quick
// succession, each updating `user` and re-triggering the subscription effect
// in App.tsx. We track the active channel and user ID at module level so we
// can skip duplicate subscriptions and remove stale ones between user sessions.
let _activeChannel: ReturnType<typeof supabase.channel> | null = null;
let _activeChannelUserId: string | null = null;

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  pendingApprovalsCount: number;
  totalUnreadCount: number;
  isLoading: boolean;
  error: string | null;
  isPanelOpen: boolean;
  setIsPanelOpen: (isOpen: boolean) => void;
  togglePanel: () => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  acknowledgeNotification: (notificationId: string) => Promise<void>;
  subscribeToNotifications: () => () => void;
  updateBadgeCount: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  pendingApprovalsCount: 0,
  totalUnreadCount: 0,
  isLoading: false,
  error: null,
  isPanelOpen: false,

  setIsPanelOpen: (isOpen: boolean) => set({ isPanelOpen: isOpen }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),

  fetchNotifications: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ isLoading: true, error: null });
    
    // Robust UUID check before calling API
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user.id || !uuidRegex.test(user.id)) {
      console.warn('[NotificationStore] Skipping fetch: Invalid user.id (UUID expected):', user.id);
      set({ isLoading: false, notifications: [], unreadCount: 0 });
      return;
    }

    try {
      const notifications = await api.getNotifications(user.id);
      const unreadCount = notifications.filter(n => !n.isRead).length;
      console.log(`[NotificationStore] Fetched ${notifications.length} notifications, ${unreadCount} unread.`);
      
      // Also fetch pending approvals count for admins/managers
      let pendingApprovalsCount = 0;
      const role = (user.role || '').toLowerCase();
      // Expanded manager roles list
      const isManagerRole = !['field_staff', 'unverified', 'office_staff', 'back_office_staff'].includes(role) || 
                            ['admin', 'super_admin', 'management', 'hr', 'hr_ops', 'finance', 'developer', 'operation_manager'].includes(role);

      console.log(`[NotificationStore] User role: ${role}, isManagerRole: ${isManagerRole}`);

      if (isManagerRole) {
        try {
          const isSuperAdmin = ['admin', 'super_admin', 'developer', 'management'].includes(role);
          const isHR = ['hr', 'hr_ops'].includes(role);
          
          let leavesPromise;
          if (isSuperAdmin) {
              leavesPromise = Promise.all([
                  api.getLeaveRequests({ status: 'pending_manager_approval' }),
                  api.getLeaveRequests({ status: 'pending_hr_confirmation' })
              ]).then(([res1, res2]) => ({ data: [...res1.data, ...res2.data] }));
          } else if (isHR) {
              leavesPromise = Promise.all([
                  api.getLeaveRequests({ status: 'pending_manager_approval', forApproverId: user.id }),
                  api.getLeaveRequests({ status: 'pending_hr_confirmation' })
              ]).then(([res1, res2]) => ({ data: [...res1.data, ...res2.data] }));
          } else {
              leavesPromise = api.getLeaveRequests({ 
                  status: 'pending_manager_approval',
                  forApproverId: user.id 
              });
          }

          const [unlocks, leaves, claims, finance, invoices] = await Promise.all([
              api.getAttendanceUnlockRequests(isSuperAdmin ? undefined : user.id).catch(() => []),
              leavesPromise.catch(() => ({ data: [] })),
              api.getExtraWorkLogs({ 
                  status: 'Pending', 
                  managerId: isSuperAdmin ? undefined : user.id 
              }).catch(() => ({ data: [] })),
              api.getPendingFinanceRecords(user.id).catch(() => []),
              api.getSiteInvoiceRecords(user.id).catch(() => [])
          ]);

          const today = new Date().toISOString().split('T')[0];
          
          const counts = [
            (unlocks || []).filter((r: any) => r.userId !== user.id).length,
            (leaves?.data || []).filter((r: any) => r.userId !== user.id).length,
            (claims?.data || []).filter((c: any) => c.userId !== user.id).length,
            (finance || []).filter((f: any) => f.createdBy !== user.id).length,
            (invoices || []).filter((inv: any) => 
                !inv.invoiceSentDate && inv.invoiceSharingTentativeDate && inv.invoiceSharingTentativeDate <= today
            ).length
          ];
          
          pendingApprovalsCount = counts.reduce((a, b) => a + b, 0);
          console.log(`[NotificationStore] Pending approvals count: ${pendingApprovalsCount} (Unlocks: ${counts[0]}, Leaves: ${counts[1]}, Claims: ${counts[2]}, Finance: ${counts[3]}, Invoices: ${counts[4]})`);
        } catch (approvalErr) {
          console.warn('[NotificationStore] Failed to fetch pending approvals count:', approvalErr);
        }
      }

      const totalUnreadCount = unreadCount + pendingApprovalsCount;
      console.log(`[NotificationStore] Final total unread count: ${totalUnreadCount}`);

      set({ 
        notifications, 
        unreadCount, 
        pendingApprovalsCount,
        totalUnreadCount,
        isLoading: false 
      });
      
      // Update global app icon badge count
      if (Capacitor.isNativePlatform()) {
        get().updateBadgeCount();
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      set({ error: 'Failed to fetch notifications.', isLoading: false });
    }
  },

  markAsRead: async (notificationId: string) => {
    const existing = get().notifications.find(n => n.id === notificationId);
    if (existing && existing.isRead) return;

    try {
      await api.markNotificationAsRead(notificationId);
      set((state) => {
        const newUnreadCount = Math.max(0, state.unreadCount - 1);
        return {
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
          ),
          unreadCount: newUnreadCount,
          totalUnreadCount: newUnreadCount + state.pendingApprovalsCount
        };
      });
      get().updateBadgeCount();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  },

  markAllAsRead: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    
    if (get().unreadCount === 0) return;

    try {
      await api.markAllNotificationsAsRead(user.id);
      set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
        totalUnreadCount: state.pendingApprovalsCount
      }));
      get().updateBadgeCount();
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  },
  
  acknowledgeNotification: async (notificationId: string) => {
    // Optimistic update
    const previousNotifications = get().notifications;
    const isCurrentlyUnread = !previousNotifications.find(n => n.id === notificationId)?.isRead;
    
    set((state) => {
      const newUnreadCount = Math.max(0, state.unreadCount - (isCurrentlyUnread ? 1 : 0));
      return {
        notifications: state.notifications.map(n =>
          n.id === notificationId ? { ...n, acknowledgedAt: new Date().toISOString(), isRead: true } : n
        ),
        unreadCount: newUnreadCount,
        totalUnreadCount: newUnreadCount + state.pendingApprovalsCount
      };
    });

    try {
      await api.acknowledgeNotification(notificationId);
      get().updateBadgeCount();
    } catch (err) {
      console.error("Failed to acknowledge notification:", err);
      // Rollback on failure
      set({ notifications: previousNotifications });
      toast.error('Failed to acknowledge request.');
    }
  },

  updateBadgeCount: async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const count = get().totalUnreadCount;
      const badgeCount = isNaN(count) ? 0 : Math.max(0, count);
      console.log(`[NotificationStore] Syncing system badge count: ${badgeCount}`);
      
      // Request permissions explicitly (required on many Android launchers to show the number)
      const perm = await Badge.requestPermissions();
      if (perm.display === 'granted') {
        await Badge.set({ count: badgeCount });
        console.log(`[NotificationStore] Badge.set({ count: ${badgeCount} }) called successfully`);
        
        // For strict Android launchers (like Samsung OneUI) that ignore Badge.set,
        // we use our custom BadgeHelper plugin to post a silent notification that holds the badge count.
        if (Capacitor.getPlatform() === 'android') {
          try {
            await BadgeHelper.setBadgeWithNotification({ count: badgeCount });
            console.log(`[NotificationStore] BadgeHelper setBadgeWithNotification called with count: ${badgeCount}`);
          } catch (e) {
            console.warn('[NotificationStore] BadgeHelper failed:', e);
          }
        }
      } else {
        console.warn(`[NotificationStore] Badge permission state: ${perm.display}`);
      }
    } catch (err) {
      console.warn('[NotificationStore] Badge update failed:', err);
    }
  },

  subscribeToNotifications: () => {
    const user = useAuthStore.getState().user;
    if (!user) return () => {};

    const channelName = `user-notifications-${user.id}`;

    // ── Singleton guard ────────────────────────────────────────────────────
    // The auth flow fires SIGNED_IN + INITIAL_SESSION + TOKEN_REFRESHED in quick
    // succession. Each event updates `user` → triggers the useEffect in App.tsx
    // → calls subscribeToNotifications() again. Supabase throws if you try to
    // add listeners to a channel that is already subscribed.
    //
    // STRATEGY: If the active channel is already for THIS user, skip creating
    // a new one and just return the cleanup function. If it's for a different
    // user (e.g. after logout + new login), remove the old one first.
    if (_activeChannelUserId === user.id && _activeChannel !== null) {
      console.log(`[NotificationStore] Realtime channel already active for user ${user.id} — skipping duplicate.`);
      // Return a cleanup that will properly tear down the channel
      return () => {
        if (_activeChannel) {
          supabase.removeChannel(_activeChannel);
          _activeChannel = null;
          _activeChannelUserId = null;
        }
      };
    }

    // Remove stale channel from a previous user session
    if (_activeChannel !== null) {
      console.log(`[NotificationStore] Removing stale realtime channel for previous user.`);
      supabase.removeChannel(_activeChannel);
      _activeChannel = null;
      _activeChannelUserId = null;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('[NotificationStore] Realtime event:', payload.eventType, payload);

          if (payload.eventType === 'INSERT') {
            const newNotif = api.toCamelCase(payload.new) as Notification;
          
          set((state) => {
            const newUnreadCount = state.unreadCount + 1;
            return {
              notifications: [newNotif, ...state.notifications],
              unreadCount: newUnreadCount,
              totalUnreadCount: newUnreadCount + state.pendingApprovalsCount
            };
          });
          
          // Trigger web toast for real-time feedback
          if (!Capacitor.isNativePlatform()) {
            const toastTitle = newNotif.title || newNotif.metadata?.title || 'New Alert';
            const isEmergency = newNotif.type === 'emergency' || newNotif.type === 'emergency_broadcast' || newNotif.severity === 'High';
            
            // Check for redundant device approval notifications to suppress toasts
            const isDeviceApprovalRedundant = 
              (newNotif.type === 'device_approval' || newNotif.type === 'approval_request') && 
              (newNotif.message?.toLowerCase().includes('submitted for approval') || 
               newNotif.message?.toLowerCase().includes('requested approval to add a new web device'));

            if (!isDeviceApprovalRedundant) {
              toast(
                (t) => (
                  <div className="flex flex-col gap-1 relative pr-6">
                    <div className="font-bold text-sm flex items-center gap-2">
                      {isEmergency && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                      {toastTitle}
                    </div>
                    <div className="text-xs opacity-90 line-clamp-2">{newNotif.message}</div>
                    <button 
                      onClick={() => toast.dismiss(t.id)}
                      className="absolute -top-1 -right-4 p-1 opacity-50 hover:opacity-100 transition-opacity"
                      aria-label="Close"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                ),
                {
                  duration: isEmergency ? 10000 : 5000,
                  position: 'top-right',
                  style: {
                    background: isEmergency ? '#7f1d1d' : '#1e293b',
                    color: '#fff',
                    border: isEmergency ? '1px solid #dc2626' : '1px solid #334155',
                    borderRadius: '12px',
                    padding: '12px'
                  },
                  icon: isEmergency ? '🚨' : '🔔'
                }
              );
            }
          }

          if (Capacitor.isNativePlatform()) {
            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title: newNotif.title || newNotif.metadata?.title || 'New Notification',
                    body: newNotif.message,
                    id: Math.floor(Math.random() * 100000),
                    channelId: 'default',
                    extra: { link: newNotif.linkTo },
                    sound: 'beep.wav'
                  }
                ]
              });
              get().updateBadgeCount();
            } catch (err) {
              console.error('Failed to schedule local notification:', err);
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedNotif = api.toCamelCase(payload.new) as Notification;
          console.log('[NotificationStore] Updating notification from realtime:', updatedNotif.id);
          
          set((state) => {
            const oldNotif = state.notifications.find(n => n.id === updatedNotif.id);
            if (!oldNotif) return state;

            const wasUnread = !oldNotif.isRead;
            const isNowRead = updatedNotif.isRead;
            
            let newUnreadCount = state.unreadCount;
            if (wasUnread && isNowRead) {
              newUnreadCount = Math.max(0, state.unreadCount - 1);
            }

            return {
              notifications: state.notifications.map(n => n.id === updatedNotif.id ? updatedNotif : n),
              unreadCount: newUnreadCount,
              totalUnreadCount: newUnreadCount + state.pendingApprovalsCount
            };
          });
          
          get().updateBadgeCount();
        } else if (payload.eventType === 'DELETE') {
           const deletedId = (payload.old as any).id;
           set((state) => {
              const deletedNotif = state.notifications.find(n => n.id === deletedId);
              const newUnreadCount = deletedNotif && !deletedNotif.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount;
              return {
                  notifications: state.notifications.filter(n => n.id !== deletedId),
                  unreadCount: newUnreadCount,
                  totalUnreadCount: newUnreadCount + state.pendingApprovalsCount
              };
           });
           get().updateBadgeCount();
        }
      }
      )
      .subscribe();

    // Track the active channel for deduplication
    _activeChannel = channel;
    _activeChannelUserId = user.id;

    return () => {
      supabase.removeChannel(channel);
      // Clear singleton refs only if this cleanup owns the current channel
      if (_activeChannel === channel) {
        _activeChannel = null;
        _activeChannelUserId = null;
      }
    };
  },
}));