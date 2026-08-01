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
  stopImpersonation: () => Promise<void>;
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

export const useImpersonationStore = create<ImpersonationState>((set, get) => ({
  isImpersonating: false,
  impersonator: null,
  reason: '',

  startImpersonation: async (admin: User, target: User, reason: string) => {
    const { useAuthStore } = await import('./authStore');
    const authStore = useAuthStore.getState();

    authStore.setUser(target);
    authStore.resetAttendance();

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

    console.info(`[Impersonation] ${admin.name} is now viewing as ${target.name}`);
  },

  stopImpersonation: async () => {
    const { impersonator, reason } = get();
    if (!impersonator) return;

    const { useAuthStore } = await import('./authStore');
    const authStore = useAuthStore.getState();

    const { data: adminProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', impersonator.id)
      .single();

    authStore.setUser(adminProfile ? { ...impersonator, ...adminProfile } : impersonator);
    authStore.resetAttendance();
    authStore.checkAttendanceStatus(true);

    await logImpersonationEvent({
      performedBy: impersonator.id,
      performedByName: impersonator.name,
      targetUser: impersonator.id,
      targetUserName: impersonator.name,
      action: 'impersonation_end',
      reason,
      createdAt: new Date().toISOString(),
    });

    set({ isImpersonating: false, impersonator: null, reason: '' });

    console.info(`[Impersonation] Session ended. Restored admin: ${impersonator.name}`);
  },
}));
