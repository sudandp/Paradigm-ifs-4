// supabase/functions/delete-account/index.ts
//
// Self-service account deletion (Apple 5.1.1(v), Google Play account deletion policy).
// The caller can only delete THEIR OWN account: the user id comes from the verified JWT,
// never from the request body.
//
// Steps:
//   1. Verify the caller's access token.
//   2. Record the request in public.account_deletion_requests (audit).
//   3. Anonymise personal profile fields in public.users and block the profile.
//   4. Delete the auth user (soft delete keeps the UUID so retained statutory
//      attendance/payroll rows keep their foreign keys, but login and identity are gone).

declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1. Identify the caller from their own JWT.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in' }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Not signed in' }, 401);
  const user = userData.user;

  let reason: string | null = null;
  try {
    const body = await req.json();
    if (body?.confirm !== 'DELETE') return json({ error: 'Confirmation missing' }, 400);
    reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null;
  } catch {
    return json({ error: 'Confirmation missing' }, 400);
  }

  // 2. Audit record.
  const { data: reqRow } = await admin
    .from('account_deletion_requests')
    .insert({ user_id: user.id, email: user.email ?? null, reason })
    .select('id')
    .single();
  const requestId = reqRow?.id as string | undefined;

  const markRequest = async (status: 'completed' | 'failed', error?: string) => {
    if (!requestId) return;
    await admin
      .from('account_deletion_requests')
      .update({ status, error: error ?? null, completed_at: new Date().toISOString() })
      .eq('id', requestId);
  };

  try {
    // 3. Anonymise the profile. Fall back to just blocking if a column differs in this schema.
    const anonymised = {
      name: 'Deleted user',
      email: `deleted+${user.id}@deleted.invalid`,
      phone: null,
      photo_url: null,
      is_blocked: true,
    };
    const { error: anonErr } = await admin.from('users').update(anonymised).eq('id', user.id);
    if (anonErr) {
      console.error('[delete-account] full anonymise failed, blocking only:', anonErr.message);
      await admin.from('users').update({ is_blocked: true }).eq('id', user.id);
    }

    // 4. Remove the login. Soft delete strips identity and makes sign-in impossible.
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id, true);
    if (delErr) throw delErr;

    await markRequest('completed');
    return json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[delete-account] failed:', message);
    await markRequest('failed', message);
    return json({ error: 'Account deletion failed. Please contact support.' }, 500);
  }
});
