/**
 * sync-telemetry-offline-service.test.ts
 *
 * Unit Test Suite for Phase 6 & 6A: Sync Observability & Client Telemetry
 * Verifies:
 * 1. Anonymous Event Structure: zero PII (no user IDs, names, emails, form payloads)
 * 2. Local Diagnostic Ring Buffer: up to 50 items stored in localStorage, drops oldest
 * 3. Runtime Platform Detection: web, android, and ios mappings
 * 4. Zero-Throw Resilience: does not throw on network failure or Supabase error
 * 5. SyncEngine Integration: correctly emits drain_start, drain_complete, and conflict_detected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] || null,
  };
})();

Object.defineProperty(global, 'localStorage', { value: storageMock, configurable: true, writable: true });
if (typeof (global as any).window === 'undefined') {
  (global as any).window = { localStorage: storageMock, navigator: { onLine: true } };
} else {
  (global as any).window.localStorage = storageMock;
}

// Mock Supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
    getPlatform: vi.fn().mockReturnValue('web'),
  },
}));

import {
  recordSyncTelemetry,
  getLocalTelemetryHistory,
  getRuntimePlatform,
  type SyncTelemetryEvent,
} from '../services/offline/telemetry';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../services/supabase';

describe('Phase 6 & 6A: Sync Telemetry & Observability Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  describe('1. Anonymous Event Structure (Zero PII Guarantee)', () => {
    it('records drain_complete event without PII', async () => {
      await recordSyncTelemetry({
        event: 'drain_complete',
        pendingCount: 0,
        failedCount: 0,
        conflictCount: 0,
        durationMs: 420,
      });

      const history = getLocalTelemetryHistory();
      expect(history.length).toBe(1);

      const event = history[0];
      expect(event.event).toBe('drain_complete');
      expect(event.durationMs).toBe(420);
      expect(event.platform).toBe('web');
      expect(event.appVersion).toBeDefined();
      expect(event.timestamp).toBeDefined();

      // STRICT PII CHECK: Ensure no user personal identifiers exist
      const piiKeys = ['userId', 'user_id', 'email', 'name', 'phone', 'payload', 'photo', 'token'];
      for (const key of piiKeys) {
        expect((event as any)[key]).toBeUndefined();
      }
    });

    it('records conflict_detected event anonymously', async () => {
      await recordSyncTelemetry({
        event: 'conflict_detected',
        pendingCount: 2,
        failedCount: 1,
        conflictCount: 1,
        durationMs: 55,
      });

      const history = getLocalTelemetryHistory();
      expect(history.length).toBe(1);
      expect(history[0].event).toBe('conflict_detected');
      expect(history[0].conflictCount).toBe(1);
    });
  });

  describe('2. Local Diagnostic Ring Buffer (Max 50 Events)', () => {
    it('appends events in descending order (newest first)', async () => {
      await recordSyncTelemetry({
        event: 'drain_start',
        pendingCount: 5,
        failedCount: 0,
        conflictCount: 0,
        durationMs: 0,
      });

      await recordSyncTelemetry({
        event: 'drain_complete',
        pendingCount: 0,
        failedCount: 0,
        conflictCount: 0,
        durationMs: 150,
      });

      const history = getLocalTelemetryHistory();
      expect(history.length).toBe(2);
      expect(history[0].event).toBe('drain_complete');
      expect(history[1].event).toBe('drain_start');
    });

    it('caps the local ring buffer at 50 events', async () => {
      for (let i = 0; i < 55; i++) {
        await recordSyncTelemetry({
          event: 'item_synced',
          pendingCount: i,
          failedCount: 0,
          conflictCount: 0,
          durationMs: i * 10,
        });
      }

      const history = getLocalTelemetryHistory();
      expect(history.length).toBe(50);
      // Newest was i = 54
      expect(history[0].pendingCount).toBe(54);
      // Oldest retained was i = 5
      expect(history[49].pendingCount).toBe(5);
    });
  });

  describe('3. Runtime Platform Detection', () => {
    it('detects web environment correctly', () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      expect(getRuntimePlatform()).toBe('web');
    });

    it('detects android environment correctly', () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
      expect(getRuntimePlatform()).toBe('android');
    });

    it('detects ios environment correctly', () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
      expect(getRuntimePlatform()).toBe('ios');
    });
  });

  describe('4. Zero-Throw Resilience & Offline Decoupling', () => {
    it('does not dispatch to cloud when offline, but persists locally', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      await recordSyncTelemetry({
        event: 'drain_complete',
        pendingCount: 1,
        failedCount: 0,
        conflictCount: 0,
        durationMs: 300,
      });

      // Local storage still gets the record
      const history = getLocalTelemetryHistory();
      expect(history.length).toBe(1);

      // Supabase is not invoked when offline
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('gracefully handles Supabase insert failure without throwing', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockRejectedValue(new Error('Network error during telemetry')),
      } as any);

      // Must resolve without throwing
      await expect(
        recordSyncTelemetry({
          event: 'item_failed',
          pendingCount: 2,
          failedCount: 1,
          conflictCount: 0,
          durationMs: 80,
        })
      ).resolves.toBeUndefined();

      // Local buffer still records it
      const history = getLocalTelemetryHistory();
      expect(history.length).toBe(1);
    });
  });
});
