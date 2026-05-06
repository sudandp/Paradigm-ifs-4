// @ts-nocheck: Supabase Edge Function (Deno runtime)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_BREAK_LIMIT_MINUTES = 60; // fallback if not configured in settings
// Cooldown between repeat alerts for the same open break session (in minutes).
// Prevents spamming the user every 5 min once the threshold is crossed.
const ALERT_COOLDOWN_MINUTES = 30;

// ── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const now = new Date();

    // ── 1. Read break limit from admin settings ────────────────────────────
    let breakLimitMinutes = DEFAULT_BREAK_LIMIT_MINUTES;
    try {
      const { data: settingsRow } = await supabase
        .from('settings')
        .select('attendance_settings')
        .eq('id', 'singleton')
        .single();

      const lunchBreakDuration =
        settingsRow?.attendance_settings?.office?.lunchBreakDuration ||
        settingsRow?.attendance_settings?.field?.lunchBreakDuration;

      if (lunchBreakDuration && !isNaN(Number(lunchBreakDuration))) {
        breakLimitMinutes = Number(lunchBreakDuration);
      }
    } catch (e) {
      console.warn('[BreakOvertime] Could not read settings, using default:', e.message);
    }

    console.log(`[BreakOvertime] Break limit: ${breakLimitMinutes} min`);

    // ── 2. Find all open break-in events older than breakLimitMinutes ──────
    // We look back 24 hours to catch overnight stale breaks too.
    const lookbackStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const thresholdTime = new Date(now.getTime() - breakLimitMinutes * 60 * 1000).toISOString();

    const { data: openBreaks, error: breakError } = await supabase
      .from('attendance_events')
      .select('id, user_id, timestamp')
      .eq('type', 'break-in')
      .gte('timestamp', lookbackStart)
      .lte('timestamp', thresholdTime) // older than threshold = exceeded limit
      .order('timestamp', { ascending: false });

    if (breakError) throw new Error(`Failed to query break events: ${breakError.message}`);
    if (!openBreaks || openBreaks.length === 0) {
      console.log('[BreakOvertime] No open over-limit breaks found.');
      return new Response(JSON.stringify({ checked: 0, alerted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Deduplicate: one candidate per user (their most recent break-in) ─
    const userLatestBreak = new Map<string, { id: string; timestamp: string }>();
    for (const row of openBreaks) {
      if (!userLatestBreak.has(row.user_id)) {
        userLatestBreak.set(row.user_id, { id: row.id, timestamp: row.timestamp });
      }
    }

    const candidateUserIds = Array.from(userLatestBreak.keys());
    console.log(`[BreakOvertime] Candidate users (${candidateUserIds.length}):`, candidateUserIds);

    // ── 4. Verify each user has NO subsequent break-out event ────────────────
    const usersToAlert: string[] = [];

    for (const userId of candidateUserIds) {
      const breakInTime = userLatestBreak.get(userId)!.timestamp;

      const { data: breakOuts } = await supabase
        .from('attendance_events')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'break-out')
        .gt('timestamp', breakInTime)
        .limit(1);

      if (!breakOuts || breakOuts.length === 0) {
        // No break-out after the break-in → genuinely still on break
        usersToAlert.push(userId);
      }
    }

    console.log(`[BreakOvertime] Users with no break-out: ${usersToAlert.length}`);

    if (usersToAlert.length === 0) {
      return new Response(JSON.stringify({ checked: candidateUserIds.length, alerted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Dedup: skip if we already alerted this user recently ─────────────
    // We use the notifications table as a lightweight dedup store.
    const cooldownStart = new Date(now.getTime() - ALERT_COOLDOWN_MINUTES * 60 * 1000).toISOString();

    const { data: recentAlerts } = await supabase
      .from('notifications')
      .select('user_id')
      .in('user_id', usersToAlert)
      .eq('type', 'break_overtime')
      .gte('created_at', cooldownStart);

    const recentlyAlertedSet = new Set((recentAlerts || []).map((r: any) => r.user_id));
    const newAlerts = usersToAlert.filter(uid => !recentlyAlertedSet.has(uid));

    console.log(`[BreakOvertime] New alerts to send (after dedup): ${newAlerts.length}`);

    if (newAlerts.length === 0) {
      return new Response(JSON.stringify({ checked: candidateUserIds.length, alerted: 0, reason: 'cooldown' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 6. Fetch user names for personalized messages ───────────────────────
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
      .in('id', newAlerts);

    const userNameMap = new Map<string, string>(
      (usersData || []).map((u: any) => [u.id, u.name || 'there'])
    );

    // ── 7. Insert DB notifications ───────────────────────────────────────────
    const breakMins = breakLimitMinutes;
    const dbNotifications = newAlerts.map(uid => ({
      user_id: uid,
      message: `⏰ Heads up, ${userNameMap.get(uid) || 'there'}! Your break has exceeded ${breakMins} minutes. Please end your break to resume tracking your work hours.`,
      type: 'break_overtime',   // custom type used as dedup key above
      severity: 'Medium',
      is_read: false,
      link_to: '/profile',
      metadata: {
        break_limit_minutes: breakMins,
        alert_type: 'break_overtime',
      },
    }));

    const { error: insertError } = await supabase.from('notifications').insert(dbNotifications);
    if (insertError) {
      console.error('[BreakOvertime] Failed to insert notifications:', insertError.message);
    }

    // ── 8. Fire FCM push via send-notification edge function ─────────────────
    const fcmTitle = '⏰ Break Time Exceeded!';
    const fcmBody = `Your break has gone over ${breakMins} minutes. Tap here to end your break and resume work.`;

    try {
      const fcmRes = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''}`,
          },
          body: JSON.stringify({
            userIds: newAlerts,
            title: fcmTitle,
            message: fcmBody,
            data: {
              type: 'break_overtime',
              link: '/profile',
              break_limit_minutes: String(breakMins),
            },
          }),
        }
      );

      const fcmResult = await fcmRes.json();
      console.log('[BreakOvertime] FCM dispatch result:', JSON.stringify(fcmResult));
    } catch (fcmErr) {
      console.error('[BreakOvertime] FCM dispatch failed:', fcmErr.message);
    }

    return new Response(
      JSON.stringify({
        checked: candidateUserIds.length,
        alerted: newAlerts.length,
        users: newAlerts.map(uid => userNameMap.get(uid) || uid),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[BreakOvertime] CRITICAL ERROR:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
