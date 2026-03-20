import { create } from 'zustand';
import { api } from '../services/api';
import type { Notification } from '../types';
import { useAuthStore } from './authStore';
import { supabase } from '../services/supabase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';

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
    try {
      const notifications = await api.getNotifications(user.id);
      const unreadCount = notifications.filter(n => !n.isRead).length;

      // Also fetch pending approvals count for admins/managers
      let pendingApprovalsCount = 0;
      const role = (user.role || '').toLowerCase();
      const isManagerRole = !['field_staff', 'unverified'].includes(role);

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
              api.getAttendanceUnlockRequests(isSuperAdmin ? undefined : user.id),
              leavesPromise,
              api.getExtraWorkLogs({ 
                  status: 'Pending', 
                  managerId: isSuperAdmin ? undefined : user.id 
              }),
              api.getPendingFinanceRecords(user.id),
              api.getSiteInvoiceRecords(user.id)
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
        } catch (approvalErr) {
          console.warn('Failed to fetch pending approvals count:', approvalErr);
        }
      }

      set({ 
        notifications, 
        unreadCount, 
        pendingApprovalsCount,
        totalUnreadCount: unreadCount + pendingApprovalsCount,
        isLoading: false 
      });
      get().updateBadgeCount();
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
    try {
      await api.acknowledgeNotification(notificationId);
      set((state) => {
        const isCurrentlyUnread = !state.notifications.find(n => n.id === notificationId)?.isRead;
        const newUnreadCount = Math.max(0, state.unreadCount - (isCurrentlyUnread ? 1 : 0));
        return {
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, acknowledgedAt: new Date().toISOString(), isRead: true } : n
          ),
          unreadCount: newUnreadCount,
          totalUnreadCount: newUnreadCount + state.pendingApprovalsCount
        };
      });
      get().updateBadgeCount();
    } catch (err) {
      console.error("Failed to acknowledge notification:", err);
    }
  },

  updateBadgeCount: async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const count = get().totalUnreadCount;
      console.log(`[NotificationStore] Updating badge count to: ${count}`);
      
      // Ensure the count is valid
      const badgeCount = isNaN(count) ? 0 : Math.max(0, count);
      await Badge.set({ count: badgeCount });
    } catch (err) {
      console.warn('[NotificationStore] Badge update failed:', err);
    }
  },

  subscribeToNotifications: () => {
    const user = useAuthStore.getState().user;
    if (!user) return () => {};

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newNotif = api.toCamelCase(payload.new) as Notification;
          
          set((state) => {
            const newUnreadCount = state.unreadCount + 1;
            return {
              notifications: [newNotif, ...state.notifications],
              unreadCount: newUnreadCount,
              totalUnreadCount: newUnreadCount + state.pendingApprovalsCount
            };
          });

          if (Capacitor.isNativePlatform()) {
            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title: newNotif.title || 'New Notification',
                    body: newNotif.message,
                    id: Math.floor(Math.random() * 10000),
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));