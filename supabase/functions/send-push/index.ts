import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')?.replace(/['"]/g, '').trim();
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')?.replace(/['"]/g, '').trim();
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      userIds, 
      title, 
      message, 
      url, 
      broadcast, 
      type, 
      severity, 
      metadata, 
      link_to,
      enable_sms,
      sms_message
    } = body;

    console.log('[send-push] Request received:', { 
      userIdsCount: userIds?.length, 
      title, 
      broadcast,
      enable_sms
    });

    // ── Build OneSignal Payload ──────────────────────────────────────────

    const payload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: title },
      contents: { en: message },
      url: url || null,
      web_url: url || null,
      data: { url, ...metadata },
    };

    // SMS support
    if (enable_sms && (sms_message || message)) {
      payload.sms_from = Deno.env.get('ONESIGNAL_SMS_FROM') || undefined;
      payload.sms_contents = { en: sms_message || message };
    }

    // iOS Live Activities support
    if (metadata?.activity_id) {
      payload.event = metadata.event || 'update';
      payload.content_available = true;
    }

    // Priority
    if (severity === 'High') {
      payload.priority = 10;
      payload.android_visibility = 1;
    } else {
      payload.priority = 5;
    }

    // Targeting
    if (broadcast) {
      payload.included_segments = ["Subscribed Users"];
    } else {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return new Response(JSON.stringify({ error: 'No user IDs provided' }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        });
      }
      payload.include_aliases = { external_id: userIds };
      if (!enable_sms) {
        payload.target_channel = "push";
      }
    }

    // ── Badge Count (single-user targeted notifications) ────────────────

    const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    if (!broadcast && userIds?.length === 1 && supabase) {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userIds[0])
          .eq('is_read', false);

        if (count !== null) {
          payload.ios_badgeType = 'SetTo';
          payload.ios_badgeCount = count;
          payload.android_badge_type = 'SetTo';
          payload.android_badge_count = count;
          console.log(`[send-push] Badge count: ${count} for user ${userIds[0]}`);
        }
      } catch (err) {
        console.warn('[send-push] Failed to fetch badge count:', err);
      }
    }

    // ── Send to OneSignal ───────────────────────────────────────────────

    console.log('[send-push] Sending to OneSignal...');
    const osResponse = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const osResult = await osResponse.json();
    console.log('[send-push] OneSignal response:', JSON.stringify(osResult));

    // ── Persist to DB (targeted only) ───────────────────────────────────

    if (!broadcast && userIds?.length > 0 && supabase) {
      const dbNotifications = userIds.map((uid: string) => ({
        user_id: uid,
        message,
        type: type || 'info',
        severity: severity || 'Low',
        metadata: metadata || {},
        link_to: link_to || url || null,
      }));

      console.log(`[send-push] Persisting ${dbNotifications.length} notifications to DB...`);
      const { error: dbError } = await supabase
        .from('notifications')
        .insert(dbNotifications);

      if (dbError) {
        console.error('[send-push] DB insert error:', dbError);
      } else {
        console.log(`[send-push] Persisted ${dbNotifications.length} notifications.`);
      }
    }

    return new Response(JSON.stringify(osResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: osResponse.status,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[send-push] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
