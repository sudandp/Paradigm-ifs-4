/**
 * telemetry.ts — Paradigm Mobile Offline Sync Telemetry & Observability
 *
 * Implements Phase 6A client-side sync telemetry:
 * - Emits anonymous telemetry events (drain_start, drain_complete, item_synced, item_failed, conflict_detected)
 * - Zero PII: No user IDs, names, form contents, or file paths are ever transmitted in telemetry
 * - Dual persistence: Stores up to 50 recent events in local buffer for offline diagnostics,
 *   and streams events to Supabase sync_health_logs table when online.
 */

import { supabase } from '../supabase';
import { Capacitor } from '@capacitor/core';
import { APP_VERSION } from '../../src/config/appVersion';

export type SyncTelemetryEventType =
  | 'drain_start'
  | 'drain_complete'
  | 'item_synced'
  | 'item_failed'
  | 'conflict_detected'
  | 'migration_complete';

export interface SyncTelemetryEvent {
  event: SyncTelemetryEventType;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  durationMs: number;
  platform: 'web' | 'android' | 'ios';
  appVersion: string;
  timestamp?: string;
  metadata?: Record<string, string | number | boolean>;
}

const LOCAL_TELEMETRY_KEY = 'paradigm_sync_telemetry_history';
const MAX_LOCAL_EVENTS = 50;

/**
 * Returns the current runtime platform.
 */
export function getRuntimePlatform(): 'web' | 'android' | 'ios' {
  if (Capacitor.isNativePlatform()) {
    const p = Capacitor.getPlatform();
    return p === 'ios' ? 'ios' : 'android';
  }
  return 'web';
}

/**
 * Reads local telemetry events stored on the device.
 */
export function getLocalTelemetryHistory(): SyncTelemetryEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_TELEMETRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves an event into the local ring buffer for device-level diagnostics.
 */
function appendLocalTelemetry(event: SyncTelemetryEvent): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const history = getLocalTelemetryHistory();
    history.unshift(event);
    if (history.length > MAX_LOCAL_EVENTS) {
      history.length = MAX_LOCAL_EVENTS;
    }
    localStorage.setItem(LOCAL_TELEMETRY_KEY, JSON.stringify(history));
  } catch (err) {
    console.warn('[SyncTelemetry] Local storage warning:', err);
  }
}

/**
 * Records a sync telemetry event.
 * Dispatches to Supabase sync_health_logs best-effort without blocking the calling code.
 */
export async function recordSyncTelemetry(
  params: Omit<SyncTelemetryEvent, 'platform' | 'appVersion' | 'timestamp'>
): Promise<void> {
  const fullEvent: SyncTelemetryEvent = {
    ...params,
    platform: getRuntimePlatform(),
    appVersion: APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
  };

  // 1. Always append to local diagnostic ring buffer
  appendLocalTelemetry(fullEvent);

  // 2. Stream to Supabase sync_health_logs when online (best-effort)
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!isOnline) return;

  try {
    await supabase.from('sync_health_logs').insert({
      event: fullEvent.event,
      pending_count: fullEvent.pendingCount,
      failed_count: fullEvent.failedCount,
      conflict_count: fullEvent.conflictCount,
      duration_ms: fullEvent.durationMs,
      platform: fullEvent.platform,
      app_version: fullEvent.appVersion,
      created_at: fullEvent.timestamp,
    }).then(({ error }) => {
      if (error && error.code !== '42P01') {
        // Log non-fatal error only if not simply table-missing
        console.warn('[SyncTelemetry] Cloud log note:', error.message);
      }
    });
  } catch (err) {
    // Zero-throw guarantee: Telemetry failures must never disrupt core operations
    console.warn('[SyncTelemetry] Non-fatal telemetry dispatch error:', err);
  }
}
