// @ts-nocheck: This file is a Supabase Edge Function using Deno. 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

console.log("[ProcessAutomatedPings] Edge Function loaded.");

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // 1. Fetch settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('api_settings')
      .eq('id', 'singleton')
      .single()

    if (settingsError || !settingsData) {
      throw new Error("Failed to fetch settings: " + (settingsError?.message || "No data"));
    }

    const apiSettings = settingsData.api_settings || {};
    const trackingSettings = apiSettings.automatedTracking;

    if (!trackingSettings?.enabled) {
      return new Response(JSON.stringify({ message: "Automated tracking is disabled in settings." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    const intervalMinutes = trackingSettings.intervalMinutes || 15;
    
    // 2. Fetch Active Field Staff
    // An active field staff is someone whose latest attendance event for today is 'check_in'
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Get all attendance events for today (check-ins and check-outs of all types)
    const { data: events, error: eventsError } = await supabase
      .from('attendance_events')
      .select('user_id, type, timestamp')
      .gte('timestamp', `${todayStr}T00:00:00Z`)
      .order('timestamp', { ascending: false });

    if (eventsError) {
      throw new Error("Failed to fetch events: " + eventsError.message);
    }

    // Active event types: punch-in, site-in, site-ot-in (field staff / site staff)
    const ACTIVE_IN_TYPES = new Set(['punch-in', 'site-in', 'site-ot-in']);
    // Clocked-out event types
    const ACTIVE_OUT_TYPES = new Set(['punch-out', 'site-out', 'site-ot-out']);

    // Determine currently clocked-in users (take the LATEST event per user)
    const userStatus = new Map<string, string>(); // user_id -> latest event_type
    if (events) {
      for (const event of events) {
        // Only process the first occurrence per user (already sorted latest first)
        if (!userStatus.has(event.user_id)) {
          if (ACTIVE_IN_TYPES.has(event.type) || ACTIVE_OUT_TYPES.has(event.type)) {
            userStatus.set(event.user_id, event.type);
          }
        }
      }
    }

    const activeUserIds = [];
    for (const [userId, eventType] of userStatus.entries()) {
      if (ACTIVE_IN_TYPES.has(eventType)) {
        activeUserIds.push(userId);
      }
    }

    if (activeUserIds.length === 0) {
      return new Response(JSON.stringify({ message: "No active field staff found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Check tracking audit logs and route history for the last ping of active users
    // We want to avoid pinging if they were pinged within the interval
    const timeThreshold = new Date(Date.now() - intervalMinutes * 60000).toISOString();
    const recentlyPingedUsers = new Set();
    
    // Check tracking_audit_logs
    const { data: recentLogs, error: logsError } = await supabase
      .from('tracking_audit_logs')
      .select('target_user_id, requested_at')
      .in('target_user_id', activeUserIds)
      .gte('requested_at', timeThreshold)
      .order('requested_at', { ascending: false });

    if (logsError && logsError.code !== '42P01') { // Ignore if table doesn't exist
       console.warn("Could not fetch tracking_audit_logs:", logsError);
    }

    if (recentLogs) {
      for (const log of recentLogs) {
        recentlyPingedUsers.add(log.target_user_id);
      }
    }

    // Check route_history
    const { data: recentRoutes, error: routesError } = await supabase
      .from('route_history')
      .select('user_id, timestamp')
      .in('user_id', activeUserIds)
      .gte('timestamp', timeThreshold);

    if (recentRoutes) {
      for (const route of recentRoutes) {
        recentlyPingedUsers.add(route.user_id);
      }
    }

    const usersToPing = activeUserIds.filter(id => !recentlyPingedUsers.has(id));

    if (usersToPing.length === 0) {
      return new Response(JSON.stringify({ message: "All active staff were pinged recently." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`[ProcessAutomatedPings] Dispatching SILENT_TRACKING_PING to ${usersToPing.length} users...`);

    // 4. For each user: send FCM with requestId+userId in the data payload
    // The Android ParadigmFirebaseMessagingService.java reads data.get("requestId") and data.get("userId")
    // and uses them to call the record-tracking-ping edge function which saves to route_history.
    const results = [];
    for (const userId of usersToPing) {
      // Generate a unique requestId per user so the Android handler can correlate the response
      const requestId = crypto.randomUUID();

      const invokeRes = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userIds: [userId],
          title: "Location Ping",
          body: "Background ping request",
          data: {
            type: "SILENT_TRACKING_PING",
            requestId: requestId,   // ← Android reads via data.get("requestId")
            userId: userId,         // ← Android reads via data.get("userId")
            timestamp: Date.now().toString(),
            reason: "automated_interval"
          }
        })
      });

      const invokeData = await invokeRes.text();
      console.log(`[ProcessAutomatedPings] Sent ping to user=${userId} requestId=${requestId} result=${invokeData}`);
      results.push({ userId, requestId, result: invokeData });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      pingedUsersCount: usersToPing.length,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[ProcessAutomatedPings] CRITICAL ERROR:", errorMsg);

    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMsg
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500 
    })
  }
})
