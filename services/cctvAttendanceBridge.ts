/**
 * cctvAttendanceBridge.ts
 *
 * Client-side bridge and synchronization service for CCTV attendance logs.
 * Bridges detected CCTV face logs into official attendance_events.
 */

import { supabase } from './supabase';
import { api } from './api';

export interface BridgeResult {
  total: number;
  bridged: number;
  merged: number;
  skipped: number;
  errors?: string[];
}

export const cctvAttendanceBridgeService = {
  /**
   * Sync all pending / unbridged CCTV attendance logs to attendance_events.
   * Attempts RPC backfill first (instant in DB), falls back to Edge Function or client-side batching.
   */
  syncUnbridgedLogs: async (limit: number = 200, minConfidence: number = 0.70): Promise<BridgeResult> => {
    try {
      // 1. Try DB Stored Procedure (fastest, atomic)
      const { data: rpcData, error: rpcError } = await supabase.rpc('backfill_cctv_attendance_bridge', {
        p_limit: limit,
        p_min_confidence: minConfidence,
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const row = rpcData[0];
        return {
          total: row.processed_count || 0,
          bridged: row.bridged_count || 0,
          merged: row.merged_count || 0,
          skipped: row.skipped_count || 0,
        };
      }
    } catch (rpcErr) {
      console.warn('[CCTV Bridge] RPC backfill unavailable or not applied yet, falling back to edge/client sync:', rpcErr);
    }

    // 2. Fallback: Edge Function or direct client sync
    try {
      const { data: unbridgedLogs, error: fetchErr } = await supabase
        .from('cctv_attendance_logs')
        .select('*')
        .not('user_id', 'is', null)
        .or('bridged.is.null,bridged.eq.false')
        .order('detected_at', { ascending: true })
        .limit(limit);

      if (fetchErr || !unbridgedLogs || unbridgedLogs.length === 0) {
        return { total: 0, bridged: 0, merged: 0, skipped: 0 };
      }

      let bridged = 0;
      let merged = 0;
      let skipped = 0;
      const errors: string[] = [];
      const windowMs = 15 * 60 * 1000;

      for (const log of unbridgedLogs) {
        if (!log.user_id) {
          skipped++;
          continue;
        }

        const confidence = log.confidence ?? 0.85;
        if (confidence < minConfidence) {
          skipped++;
          await supabase
            .from('cctv_attendance_logs')
            .update({
              bridge_error: `Skipped: Confidence ${Math.round(confidence * 100)}% < ${Math.round(minConfidence * 100)}% threshold`,
            })
            .eq('id', log.id);
          continue;
        }

        const eventType = log.direction === 'exit' ? 'punch-out' : 'punch-in';
        const detectedTime = log.detected_at ? new Date(log.detected_at) : new Date();
        const startWindow = new Date(detectedTime.getTime() - windowMs).toISOString();
        const endWindow = new Date(detectedTime.getTime() + windowMs).toISOString();

        // Check for duplicates
        const { data: existingEvents } = await supabase
          .from('attendance_events')
          .select('id, timestamp, type')
          .eq('user_id', log.user_id)
          .eq('type', eventType)
          .gte('timestamp', startWindow)
          .lte('timestamp', endWindow)
          .order('timestamp', { ascending: true })
          .limit(1);

        if (existingEvents && existingEvents.length > 0) {
          const existingId = existingEvents[0].id;
          await supabase
            .from('cctv_attendance_logs')
            .update({
              attendance_event_id: existingId,
              bridged: true,
              bridged_at: new Date().toISOString(),
              bridge_error: `Merged with existing event ${existingId}`,
            })
            .eq('id', log.id);
          merged++;
          continue;
        }

        // Insert attendance event
        const { data: newEvent, error: insertErr } = await supabase
          .from('attendance_events')
          .insert({
            user_id: log.user_id,
            timestamp: log.detected_at || new Date().toISOString(),
            type: eventType,
            location_name: log.camera_name || 'CCTV Gate',
            location_id: log.location_id || null,
            source: 'cctv',
            device_id: null,
            device_name: log.edge_device_id || 'CCTV Edge Server',
            cctv_log_id: log.id,
            is_manual: false,
          })
          .select('id')
          .single();

        if (insertErr) {
          errors.push(`Log ${log.id}: ${insertErr.message}`);
          await supabase
            .from('cctv_attendance_logs')
            .update({ bridge_error: `Bridge insert error: ${insertErr.message}` })
            .eq('id', log.id);
          continue;
        }

        if (newEvent?.id) {
          await supabase
            .from('cctv_attendance_logs')
            .update({
              attendance_event_id: newEvent.id,
              bridged: true,
              bridged_at: new Date().toISOString(),
              bridge_error: null,
            })
            .eq('id', log.id);
          bridged++;
        }
      }

      return {
        total: unbridgedLogs.length,
        bridged,
        merged,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err: any) {
      console.error('[CCTV Bridge] Fallback sync error:', err);
      return { total: 0, bridged: 0, merged: 0, skipped: 0, errors: [err.message] };
    }
  },

  /**
   * Check status of unbridged logs
   */
  getBridgeStatus: async () => {
    try {
      const { count: unbridgedCount } = await supabase
        .from('cctv_attendance_logs')
        .select('*', { count: 'exact', head: true })
        .not('user_id', 'is', null)
        .or('bridged.is.null,bridged.eq.false');

      const { count: totalLogsCount } = await supabase
        .from('cctv_attendance_logs')
        .select('*', { count: 'exact', head: true });

      const { count: bridgedCount } = await supabase
        .from('cctv_attendance_logs')
        .select('*', { count: 'exact', head: true })
        .eq('bridged', true);

      return {
        total: totalLogsCount || 0,
        bridged: bridgedCount || 0,
        unbridged: unbridgedCount || 0,
      };
    } catch (err) {
      console.error('[CCTV Bridge] Status check error:', err);
      return { total: 0, bridged: 0, unbridged: 0 };
    }
  },
};
