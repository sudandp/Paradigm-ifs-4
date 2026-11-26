/**
 * Best-effort audit of Paradigm Assist data access → public.assist_data_access_log.
 * Never throws and never delays the answer. If the table does not exist yet (migration not applied),
 * a single warning is logged per process.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssistCtx } from './types.js';

let warned = false;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function makeAuditor(sb: SupabaseClient, askerId: string): AssistCtx['audit'] {
  return entry => {
    try {
      const subject = entry.subjectUserId && UUID.test(entry.subjectUserId) ? entry.subjectUserId : null;
      const row = {
        asked_by: UUID.test(askerId) ? askerId : null,
        subject_user_id: subject,
        subject_site: entry.subjectSite ?? null,
        tool: String(entry.tool || 'unknown').slice(0, 100),
        args: sanitize(entry.args),
        allowed: !!entry.allowed,
        note: entry.note ? String(entry.note).slice(0, 500) : null,
      };
      Promise.resolve(sb.from('assist_data_access_log').insert(row))
        .then(({ error }: any) => {
          if (error && !warned) { warned = true; console.warn('[Assist audit] insert failed (is the 20261126_assist_data_access_log migration applied?):', error.message); }
        })
        .catch((e: any) => { if (!warned) { warned = true; console.warn('[Assist audit] insert failed:', e?.message); } });
    } catch (e: any) {
      if (!warned) { warned = true; console.warn('[Assist audit] error:', e?.message); }
    }
  };
}

function sanitize(args: any) {
  try { return JSON.parse(JSON.stringify(args ?? {})); } catch { return {}; }
}
