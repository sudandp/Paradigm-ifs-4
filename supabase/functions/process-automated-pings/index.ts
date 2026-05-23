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
    
    // Get all check-ins and check-outs for today
    const { data: events, error: eventsError } = await supabase
      .from('attendance_events')
      .select('user_id, event_type, created_at')
      .gte('created_at', `${todayStr}T00:00:00Z`)
      .order('created_at', { ascending: false });

    if (eventsError) {
      throw new Error("Failed to fetch events: " + eventsError.message);
    }

    // Determine currently clocked-in users
    const userStatus = new Map<string, string>(); // user_id -> latest event_type
    if (events) {
      for (const event of events) {
        if (!userStatus.has(event.user_id)) {
          userStatus.set(event.user_id, event.event_type);
        }
      }
    }

    const activeUserIds = [];
    for (const [userId, eventType] of userStatus.entries()) {
      if (eventType === 'check_in') {
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
      .select('user_id, created_at')
      .in('user_id', activeUserIds)
      .gte('created_at', timeThreshold)
      .order('created_at', { ascending: false });

    if (logsError && logsError.code !== '42P01') { // Ignore if table doesn't exist
       console.warn("Could not fetch tracking_audit_logs:", logsError);
    }

    if (recentLogs) {
      for (const log of recentLogs) {
        recentlyPingedUsers.add(log.user_id);
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

    // 4. Send the push notification using the existing send-notification edge function logic
    // We will invoke the send-notification edge function directly.
    const invokeRes = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userIds: usersToPing,
        title: "Location Ping",
        body: "Background ping request",
        data: {
          type: "SILENT_TRACKING_PING",
          timestamp: Date.now().toString(),
          reason: "automated_interval"
        }
      })
    });

    const invokeData = await invokeRes.text();

    return new Response(JSON.stringify({ 
      success: true, 
      pingedUsersCount: usersToPing.length,
      usersPinged: usersToPing,
      sendNotificationResult: invokeData
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
