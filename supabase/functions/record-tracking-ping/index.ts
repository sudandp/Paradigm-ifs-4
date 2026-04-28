// @ts-nocheck: Supabase Edge Function using Deno.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * record-tracking-ping
 * Called by ParadigmFirebaseMessagingService.java from the Android background service.
 * Uses the SERVICE ROLE key so it bypasses RLS — the anon key in BuildConfig cannot
 * satisfy row-level security policies on route_history and tracking_audit_logs.
 *
 * Expected body:
 * {
 *   requestId: string,
 *   userId: string,
 *   latitude: number,
 *   longitude: number,
 *   accuracy: number,
 *   timestamp: string (ISO-8601),
 *   source: "background_fcm",
 *   deviceName?: string,
 *   batteryLevel?: number,
 *   networkType?: string,
 *   status: "successful" | "failed"
 * }
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      requestId,
      userId,
      latitude,
      longitude,
      accuracy,
      timestamp,
      source = "background_fcm",
      deviceName,
      batteryLevel,
      networkType,
      status = "successful",
    } = body;

    console.log(`[RecordTrackingPing] requestId=${requestId} userId=${userId} status=${status}`);

    if (!requestId || !userId) {
      return new Response(
        JSON.stringify({ error: "requestId and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Insert route_history point (if we have location data)
    if (status === "successful" && latitude != null && longitude != null) {
      const routePayload: Record<string, any> = {
        user_id: userId,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        timestamp: timestamp ?? new Date().toISOString(),
        source,
        request_id: requestId,
      };
      if (deviceName) routePayload.device_name = deviceName;
      if (batteryLevel != null) routePayload.battery_level = batteryLevel;
      if (networkType) routePayload.network_type = networkType;
      if (body.ipAddress) routePayload.ip_address = body.ipAddress;
      if (body.networkProvider) routePayload.network_provider = body.networkProvider;

      const { error: routeError } = await supabase
        .from("route_history")
        .insert(routePayload);

      if (routeError) {
        console.error("[RecordTrackingPing] route_history insert failed:", routeError.message);
        // Don't abort — still try to update the status below
      } else {
        console.log("[RecordTrackingPing] route_history insert OK");
      }
    }

    // 2. Update tracking_audit_logs status — filter by BOTH request_id AND target_user_id
    const { error: patchError } = await supabase
      .from("tracking_audit_logs")
      .update({ status })
      .eq("request_id", requestId)
      .eq("target_user_id", userId);

    if (patchError) {
      console.error("[RecordTrackingPing] tracking_audit_logs PATCH failed:", patchError.message);
      return new Response(
        JSON.stringify({ success: false, error: patchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[RecordTrackingPing] tracking_audit_logs updated to '${status}' for request=${requestId}`);

    return new Response(
      JSON.stringify({ success: true, requestId, status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[RecordTrackingPing] CRITICAL:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
