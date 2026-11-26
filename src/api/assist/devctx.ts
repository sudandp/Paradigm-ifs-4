/**
 * DEV/TEST ONLY: build an AssistCtx for any user (by email or unique name fragment) to call tools directly.
 *   const ctx = await makeDevCtx('Sudhan M', 'how many days kavya works');
 *   console.log(await someTool.run(ctx, { person_name: 'kavya' }));
 * Uses the service-role key from .env.local. Read-only usage only.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import type { AssistCtx, AskerProfile } from './types.js';
import { resolveScope } from './scope.js';

dotenv.config({ path: '.env.local', quiet: true } as any);

export function serviceClient() {
  return createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { persistSession: false } });
}

export async function makeDevCtx(who: string, question = '', selectedSiteId: string | null = null): Promise<AssistCtx> {
  const sb = serviceClient();
  const { data, error } = await sb.from('users').select('id, name, email, role_id, location_id');
  if (error) throw new Error(error.message);
  const w = who.toLowerCase();
  const hits = (data ?? []).filter((u: any) => u.email?.toLowerCase() === w || u.name?.toLowerCase().includes(w));
  if (hits.length !== 1) throw new Error(`makeDevCtx("${who}") matched ${hits.length} users: ${hits.map((h: any) => h.name).join(', ')}`);
  const asker = hits[0] as AskerProfile;
  const scope = await resolveScope(sb, asker);
  return {
    sb, asker, scope, question, selectedSiteId, now: new Date(),
    audit: e => { if (process.env.ASSIST_DEBUG) console.log('[audit]', JSON.stringify(e)); },
  };
}

/** Handy test askers (real users, one per access level). */
export const TEST_ASKERS = {
  admin: 'Sudhan M',                         // admin → all
  hr: 'Udita Paul',                          // hr → all people, no GPS / finance
  opsManager: 'Sandeep B',                   // operation_manager → small team
  opsManagerNikoo: 'Isaac Roy',              // operation_manager (Nikoo ops in-charge per invoice tracker)
  fieldStaff: 'veerabhadra@paradigmfms.com', // field_staff → self only
  finance: 'Kavya Hegde',                    // accounts_excitative → finance all sites, self people
};
