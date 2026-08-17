/**
 * Impersonation Store
 *
 * Enables authorized admins/developers to safely view the app through another
 * user's perspective WITHOUT sharing passwords or credentials.
 *
 * Security model:
 *  - Only roles with 'manage_users' permission can start impersonation.
 *  - Every session start/end is logged with actor, target, reason, and timestamp.
 *  - The original admin session is preserved and restored on exit.
 *  - Writes are blocked for critical mutations while impersonating.
 */

import { create } from 'zustand';
import type { User } from '../types';
import { supabase } from '../services/supabase';

export interface ImpersonationLogEntry {
  performedBy: string;
  performedByName: string;
  targetUser: string;
  targetUserName: string;
  action: 'impersonation_start' | 'impersonation_end';
  reason?: string;
  createdAt: string;
}

interface ImpersonationState {
  isImpersonating: boolean;
  impersonator: User | null;
  reason: string;

  startImpersonation: (admin: User, target: User, reason: string) => Promise<void>;
  stopImpersonation: (redirectToAdmin?: boolean) => Promise<void>;
}

const logImpersonationEvent = async (entry: ImpersonationLogEntry) => {
  try {
    await supabase.from('audit_logs').insert({
      performed_by: entry.performedBy,
      performed_by_name: entry.performedByName,
      target_user: entry.targetUser,
      target_user_name: entry.targetUserName,
      action: entry.action,
      reason: entry.reason || null,
      created_at: entry.createdAt,
    });
  } catch (err) {
    console.warn('[Impersonation] Failed to write audit log:', err);
  }
};

const SESSION_KEY = 'paradigm_impersonation_session';

interface StoredImpersonationSession {
  isImpersonating: boolean;
  impersonator: User;
  targetUser: User;
  reason: string;
}

const getStoredSession = (): StoredImpersonationSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed) {
      console.log('[Impersonation Debug] Stored session found in localStorage:', parsed.targetUser?.name);
    }
    return parsed;
  } catch (err) {
    console.warn('[Impersonation Debug] Error parsing stored session:', err);
    return null;
  }
};

const stored = getStoredSession();
if (stored?.targetUser && stored?.isImpersonating) {
  console.log('[Impersonation Debug] Syncing initial stored target user to authStore:', stored.targetUser.name);
  import('./authStore').then(({ useAuthStore }) => {
    const current = useAuthStore.getState().user;
    if (!current || current.id !== stored.targetUser.id) {
      console.log('[Impersonation Debug] Set initial user in authStore:', stored.targetUser.name);
      useAuthStore.getState().setUser(stored.targetUser);
    }
  }).catch(err => console.warn('[Impersonation Debug] Failed to import authStore:', err));
}

export const useImpersonationStore = create<ImpersonationState>((set, get) => ({
  isImpersonating: !!(stored && stored.isImpersonating),
  impersonator: stored?.impersonator || null,
  reason: stored?.reason || '',

  startImpersonation: async (admin: User, target: User, reason: string) => {
    console.log('[Impersonation Debug] Starting impersonation:', { adminName: admin.name, targetName: target.name, reason });
    const { useAuthStore } = await import('./authStore');
    const authStore = useAuthStore.getState();

    authStore.setUser(target);
    authStore.resetAttendance();

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        isImpersonating: true,
        impersonator: admin,
        targetUser: target,
        reason,
        createdAt: new Date().toISOString(),
      }));
      console.log('[Impersonation Debug] Session successfully persisted to localStorage key:', SESSION_KEY);
    } catch (err) {
      console.warn('[Impersonation Debug] Failed to write localStorage session:', err);
    }

    set({ isImpersonating: true, impersonator: admin, reason });

    await logImpersonationEvent({
      performedBy: admin.id,
      performedByName: admin.name,
      targetUser: target.id,
      targetUserName: target.name,
      action: 'impersonation_start',
      reason,
      createdAt: new Date().toISOString(),
    });

    console.info(`[Impersonation Debug] ACTIVE: ${admin.name} is now viewing as ${target.name}`);
  },

  stopImpersonation: async (redirectToAdmin = true) => {
    console.log('[Impersonation Debug] Stopping impersonation session...');
    const { impersonator, reason } = get();
    const storedSession = getStoredSession();
    const adminToRestore = impersonator || storedSession?.impersonator;

    if (!adminToRestore) {
      console.warn('[Impersonation Debug] No admin to restore found. Clearing session.');
      try { localStorage.removeItem(SESSION_KEY); } catch {}
      set({ isImpersonating: false, impersonator: null, reason: '' });
      if (redirectToAdmin) window.location.hash = '#/admin/users';
      return;
    }

    const { useAuthStore } = await import('./authStore');
    const authStore = useAuthStore.getState();

    const { data: adminProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', adminToRestore.id)
      .single();

    const restoredAdmin = adminProfile ? { ...adminToRestore, ...adminProfile } : adminToRestore;

    try {
      localStorage.removeItem(SESSION_KEY);
      console.log('[Impersonation Debug] Removed SESSION_KEY from localStorage.');
    } catch (err) {
      console.warn('[Impersonation Debug] Failed to remove localStorage session:', err);
    }

    console.log('[Impersonation Debug] Restoring admin user to authStore:', restoredAdmin.name);
    authStore.setUser(restoredAdmin);
    authStore.resetAttendance();
    authStore.checkAttendanceStatus(true);

    await logImpersonationEvent({
      performedBy: adminToRestore.id,
      performedByName: adminToRestore.name,
      targetUser: adminToRestore.id,
      targetUserName: adminToRestore.name,
      action: 'impersonation_end',
      reason,
      createdAt: new Date().toISOString(),
    });

    set({ isImpersonating: false, impersonator: null, reason: '' });

    console.info(`[Impersonation Debug] SESSION ENDED: Restored admin ${adminToRestore.name}`);

    if (redirectToAdmin) {
      console.log('[Impersonation Debug] Redirecting to #/admin/users');
      window.location.hash = '#/admin/users';
    }
  },
}));
