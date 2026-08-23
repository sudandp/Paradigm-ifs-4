/* eslint-disable */
// deno-lint-ignore-file
// supabase/functions/cctv-attendance-bridge/index.ts

declare const Deno: any;

// @ts-ignore: Deno URL import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface CctvLogPayload {
  id?: string;
  user_id?: string | null;
  user_name?: string | null;
  camera_name?: string;
  direction?: 'entry' | 'exit';
  confidence?: number;
  detected_at?: string;
  edge_device_id?: string | null;
  snapshot_url?: string | null;
  location_id?: string | null;
  bridged?: boolean;
}

interface BridgeRequest {
  record?: CctvLogPayload; // from DB webhook
  action?: 'bridge_single' | 'backfill' | 'status';
  logId?: string;
  limit?: number;
  minConfidence?: number;
  windowMinutes?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase environment variables' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    let body: BridgeRequest = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const minConfidence = body.minConfidence ?? 0.70;
    const windowMinutes = body.windowMinutes ?? 15;
    const windowMs = windowMinutes * 60 * 1000;

    // --- CASE A: Process Single Log from Record or logId ---
    let targetLog: CctvLogPayload | null = body.record || null;

    if (!targetLog && body.logId) {
      const { data: fetchedLog, error: fetchErr } = await supabase
        .from('cctv_attendance_logs')
        .select('*')
        .eq('id', body.logId)
        .single();
      if (fetchErr || !fetchedLog) {
        return new Response(JSON.stringify({ error: `Log ${body.logId} not found` }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      targetLog = fetchedLog;
    }

    // --- CASE B: Batch Backfill Unbridged Logs ---
    if (body.action === 'backfill' || (!targetLog && req.method === 'POST' && !body.record)) {
      const limit = body.limit || 200;
      const { data: unbridgedLogs, error: listErr } = await supabase
        .from('cctv_attendance_logs')
        .select('*, cctv_devices:edge_device_id(location_name, location_id)')
        .not('user_id', 'is', null)
        .or('bridged.is.null,bridged.eq.false')
        .order('detected_at', { ascending: true })
        .limit(limit);

      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let bridgedCount = 0;
      let mergedCount = 0;
      let skippedCount = 0;
      const errors: any[] = [];

      for (const log of (unbridgedLogs || [])) {
        try {
          const res = await processSingleLog(supabase, log, minConfidence, windowMs);
          if (res.status === 'bridged') bridgedCount++;
          else if (res.status === 'merged') mergedCount++;
          else skippedCount++;
        } catch (err: any) {
          errors.push({ id: log.id, error: err.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'backfill',
          total: unbridgedLogs?.length || 0,
          bridged: bridgedCount,
          merged: mergedCount,
          skipped: skippedCount,
          errors,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Process the single target log ---
    if (targetLog) {
      const result = await processSingleLog(supabase, targetLog, minConfidence, windowMs);
      return new Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default status check (GET or empty POST)
    const { count: unbridgedCount } = await supabase
      .from('cctv_attendance_logs')
      .select('*', { count: 'exact', head: true })
      .not('user_id', 'is', null)
      .or('bridged.is.null,bridged.eq.false');

    return new Response(
      JSON.stringify({
        service: 'cctv-attendance-bridge',
        status: 'alive',
        unbridgedLogsCount: unbridgedCount || 0,
        minConfidence,
        windowMinutes,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[cctv-attendance-bridge] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processSingleLog(
  supabase: any,
  log: CctvLogPayload,
  minConfidence: number,
  windowMs: number
): Promise<{ status: 'bridged' | 'merged' | 'skipped'; eventId?: string; reason?: string }> {
  if (!log.user_id) {
    return { status: 'skipped', reason: 'No user_id assigned' };
  }

  const confidence = log.confidence ?? 0.85;
  if (confidence < minConfidence) {
    if (log.id) {
      await supabase
        .from('cctv_attendance_logs')
        .update({
          bridge_error: `Skipped: Confidence ${Math.round(confidence * 100)}% < ${Math.round(minConfidence * 100)}% threshold`,
        })
        .eq('id', log.id);
    }
    return { status: 'skipped', reason: 'Low confidence' };
  }

  const eventType = log.direction === 'exit' ? 'punch-out' : 'punch-in';
  const detectedTime = log.detected_at ? new Date(log.detected_at) : new Date();
  const startWindow = new Date(detectedTime.getTime() - windowMs).toISOString();
  const endWindow = new Date(detectedTime.getTime() + windowMs).toISOString();

  // Deduplication check: Has the user already logged this event type within window?
  const { data: existingEvents } = await supabase
    .from('attendance_events')
    .select('id, timestamp, type, source')
    .eq('user_id', log.user_id)
    .eq('type', eventType)
    .gte('timestamp', startWindow)
    .lte('timestamp', endWindow)
    .order('timestamp', { ascending: true })
    .limit(1);

  if (existingEvents && existingEvents.length > 0) {
    const existingId = existingEvents[0].id;
    if (log.id) {
      await supabase
        .from('cctv_attendance_logs')
        .update({
          attendance_event_id: existingId,
          bridged: true,
          bridged_at: new Date().toISOString(),
          bridge_error: `Merged with existing ${existingEvents[0].source || 'app'} event ${existingId}`,
        })
        .eq('id', log.id);
    }
    return { status: 'merged', eventId: existingId, reason: 'Duplicate in time window' };
  }

  let locationName = log.camera_name || 'CCTV Gate';
  let locationId = log.location_id || null;
  let deviceUuid: string | null = null;

  if (log.edge_device_id) {
    const { data: device } = await supabase
      .from('cctv_devices')
      .select('id, location_name, location_id')
      .eq('edge_device_id', log.edge_device_id)
      .single();
    if (device) {
      deviceUuid = device.id || null;
      if (device.location_name) locationName = device.location_name;
      if (device.location_id) locationId = device.location_id;
    }
  }

  // Insert into attendance_events
  const { data: newEvent, error: insertErr } = await supabase
    .from('attendance_events')
    .insert({
      user_id: log.user_id,
      timestamp: log.detected_at || new Date().toISOString(),
      type: eventType,
      location_name: locationName,
      location_id: locationId,
      source: 'cctv',
      device_id: deviceUuid,
      device_name: log.edge_device_id || 'CCTV Edge Server',
      cctv_log_id: log.id || null,
      is_manual: false,
    })
    .select('id')
    .single();

  if (insertErr) {
    if (log.id) {
      await supabase
        .from('cctv_attendance_logs')
        .update({ bridge_error: `Insert error: ${insertErr.message}` })
        .eq('id', log.id);
    }
    throw insertErr;
  }

  if (log.id && newEvent) {
    await supabase
      .from('cctv_attendance_logs')
      .update({
        attendance_event_id: newEvent.id,
        bridged: true,
        bridged_at: new Date().toISOString(),
        bridge_error: null,
      })
      .eq('id', log.id);
  }

  return { status: 'bridged', eventId: newEvent?.id };
}
