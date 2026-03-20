import { create } from 'zustand';
import { api } from '../services/api';
import type { Notification } from '../types';
import { useAuthStore } from './authStore';
import { supabase } from '../services/supabase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  isPanelOpen: boolean;
  setIsPanelOpen: (isOpen: boolean) => void;
  togglePanel: () => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  subscribeToNotifications: () => () => void;
  updateBadgeCount: () => Promise<void>;
}

// Fix: Removed generic type argument from create() to avoid untyped function call error.
export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
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
      set({ notifications, unreadCount, isLoading: false });
      get().updateBadgeCount();
    } catch (err) {
      set({ error: 'Failed to fetch notifications.', isLoading: false });
    }
  },

  markAsRead: async (notificationId: string) => {
    const existing = get().notifications.find(n => n.id === notificationId);
    if (existing && existing.isRead) return; // Don't do anything if already read

    try {
      await api.markNotificationAsRead(notificationId);
      set((state) => ({
        notifications: state.notifications.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
      get().updateBadgeCount();
    } catch (err) {
      console.error("Failed to mark notification as read", err);
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
      }));
      get().updateBadgeCount();
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  },

  updateBadgeCount: async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const count = get().unreadCount;
      // Note: This requires @capacitor/badge plugin. 
      // Using @vite-ignore to allow the app to boot even if the plugin is not installed in the dev environment.
      // @ts-ignore - Module is installed by the user locally
      const { Badge } = await import(/* @vite-ignore */ '@capawesome/capacitor-badge').catch(() => ({ Badge: null }));
      if (Badge && typeof Badge.set === 'function') {
        await Badge.set({ count });
        console.log(`Updated app badge count to: ${count}`);
      }
    } catch (err) {
      console.warn('Badge plugin not available or failed:', err);
    }
  },

  subscribeToNotifications: () => {
    const user = useAuthStore.getState().user;
    if (!user) return () => {};

    console.log('Subscribing to notifications for user:', user.id);

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
          console.log('New notification received:', payload);
          const newNotif = api.toCamelCase(payload.new) as Notification;
          
          set((state) => ({
            notifications: [newNotif, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }));

          // Trigger local notification on mobile
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
      console.log('Unsubscribing from notifications');
      supabase.removeChannel(channel);
    };
  },
}));
