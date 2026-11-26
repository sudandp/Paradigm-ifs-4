/**
 * Defence in depth: a second, INDEPENDENT access layer under every data tool.
 *
 * Tools already filter by `ctx.scope`, but they run on the service-role client (RLS bypassed), so one buggy
 * tool could leak another employee's records. This wraps the client so that every `.from(<person table>).select()`
 * is automatically restricted, at query level, to the people the asker may see — whatever the tool does.
 *
 * - scope 'all' (admin / HR) → unchanged client.
 * - approvers keep seeing requests assigned to them (current_approver_id / manager_id / approver_id = asker).
 * - writes (insert/update/delete) and rpc() are not altered; tools that write still do their own checks.
 * - tables not listed (users, sites, finance, settings…) are not person activity data and pass through.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessScope } from './types.js';

const NOBODY = '00000000-0000-0000-0000-000000000000';
type Guard = (q: any, ids: string[], me: string) => any;

const inList = (ids: string[]) => `(${ids.join(',')})`;
const byUser = (col: string): Guard => (q, ids) => q.in(col, ids);
const byUserOr = (col: string, mineCol: string): Guard => (q, ids, me) => q.or(`${col}.in.${inList(ids)},${mineCol}.eq.${me}`);

export const GUARDED_TABLES: Record<string, Guard> = {
  attendance_events: byUser('user_id'),
  route_history: byUser('user_id'),
  attendance_daily_summary: byUser('user_id'),
  attendance_month_snapshots: byUser('employee_id'),
  attendance_violations: byUser('user_id'),
  field_attendance_violations: byUser('user_id'),
  field_reports: byUser('user_id'),
  employee_scores: byUser('user_id'),
  notifications: byUser('user_id'),
  automated_notification_logs: byUser('user_id'),
  user_documents: byUser('user_id'),
  user_holidays: byUser('user_id'),
  user_locations: byUser('user_id'),
  security_audit_logs: byUser('user_id'),
  leave_requests: byUserOr('user_id', 'current_approver_id'),
  attendance_unlock_requests: byUserOr('user_id', 'manager_id'),
  extra_work_logs: byUserOr('user_id', 'approver_id'),
  ops_approval_requests: byUserOr('requested_by', 'approver_id'),
  attendance_audit_logs: byUserOr('target_user_id', 'performed_by'),
  tracking_audit_logs: byUserOr('target_user_id', 'admin_id'),
  support_tickets: (q, ids) => q.or(`raised_by_id.in.${inList(ids)},assigned_to_id.in.${inList(ids)}`),
};

/** Returns a client whose reads of person tables are limited to `scope.userIds` (plus rows assigned to the asker). */
export function scopedClient(sb: SupabaseClient, scope: AccessScope, askerId: string): SupabaseClient {
  if (scope.level === 'all') return sb;
  const ids = scope.userIds.size ? [...scope.userIds] : [NOBODY];
  const me = askerId || NOBODY;
  const baseFrom = sb.from.bind(sb);                 // captured once: the shared client is never re-entered
  const overrides = new Map<PropertyKey, any>();     // assignments land on THIS wrapper, never on the shared client
  return new Proxy(sb, {
    set(_t, prop, value) { overrides.set(prop, value); return true; },
    defineProperty(_t, prop, desc) { overrides.set(prop, 'get' in desc && desc.get ? desc.get() : desc.value); return true; },
    get(target, prop) {
      if (overrides.has(prop)) return overrides.get(prop);
      if (prop !== 'from') {
        const v = Reflect.get(target, prop, target);
        return typeof v === 'function' ? v.bind(target) : v;
      }
      return (table: string) => {
        const qb: any = baseFrom(table);
        const guard = GUARDED_TABLES[table];
        if (!guard) return qb;
        return new Proxy(qb, {
          get(q, p) {
            const v = Reflect.get(q, p);
            if (p === 'select') return (...a: any[]) => guard(v.apply(q, a), ids, me);
            return typeof v === 'function' ? v.bind(q) : v;
          },
        });
      };
    },
  }) as SupabaseClient;
}
