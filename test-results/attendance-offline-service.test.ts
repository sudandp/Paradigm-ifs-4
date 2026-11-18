import { describe, it, expect, beforeEach, vi } from 'vitest';

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
});

const m = vi.hoisted(() => ({
  stores: {} as Record<string, Record<string, any>>,
}));

vi.mock('../services/offline/db', () => ({
  getDb: async () => ({
    objectStoreNames: { contains: () => true },
    get: async (table: string, id: string) => structuredClone(m.stores[table]?.[id]),
    put: async (table: string, row: any) => {
      (m.stores[table] ??= {})[row.id] = structuredClone(row);
    },
    delete: async (table: string, id: string) => {
      delete m.stores[table]?.[id];
    },
    getAll: async (table: string) => structuredClone(Object.values(m.stores[table] ?? {})),
  }),
}));

import {
  recordOfflineAttendancePunch,
  getOfflineAttendanceEvents,
  calculateOfflineDutyStatus,
  determineShiftSlot,
  cacheFaceDescriptor,
  getCachedFaceDescriptor,
  deleteOldDescriptors,
  cacheAttendancePolicies,
  getCachedAttendancePolicies,
  cacheSiteGeofence,
  getCachedSiteGeofence,
} from '../services/offline/attendanceOfflineService';
import { isUuid } from '../services/offline/idGenerator';

describe('Phase 3 Batch A: Attendance & Face Offline Service', () => {
  beforeEach(() => {
    m.stores = {};
    localStorage.clear();
  });

  describe('Punch Recording & Stable UUIDs', () => {
    it('generates a valid RFC 4122 v4 UUID and enqueues in outbox', async () => {
      const punch = await recordOfflineAttendancePunch({
        userId: 'user-emp-101',
        type: 'check-in',
        latitude: 12.9716,
        longitude: 77.5946,
      });

      expect(punch.isDuplicate).toBe(false);
      expect(isUuid(punch.event.id)).toBe(true);
      expect(punch.event.type).toBe('check-in');
      expect(punch.event.isPending).toBe(true);

      // Verify outbox entry
      const outboxRows = Object.values(m.stores.outbox ?? {});
      expect(outboxRows.length).toBe(1);
      expect(outboxRows[0].id).toBe(punch.event.id);
      expect(outboxRows[0].tableName).toBe('attendance_events');
      expect(outboxRows[0].action).toBe('UPSERT');
    });

    it('debounces duplicate punches of the same type within 5 minutes', async () => {
      const t1 = new Date('2026-11-18T08:00:00.000Z').toISOString();
      const t2 = new Date('2026-11-18T08:02:00.000Z').toISOString(); // 2 mins later

      const first = await recordOfflineAttendancePunch({
        userId: 'user-emp-101',
        type: 'check-in',
        timestamp: t1,
      });

      const second = await recordOfflineAttendancePunch({
        userId: 'user-emp-101',
        type: 'check-in',
        timestamp: t2,
      });

      expect(first.isDuplicate).toBe(false);
      expect(second.isDuplicate).toBe(true);
      expect(second.event.id).toBe(first.event.id);

      // Only one item in outbox
      const outboxRows = Object.values(m.stores.outbox ?? {});
      expect(outboxRows.length).toBe(1);
    });
  });

  describe('Multi-Day Date Range Querying & Outbox Merging', () => {
    it('merges committed local records with pending outbox items', async () => {
      // 1. Record punch 1
      await recordOfflineAttendancePunch({
        userId: 'user-emp-202',
        type: 'check-in',
        timestamp: '2026-11-18T07:00:00.000Z',
      });

      // 2. Record punch 2
      await recordOfflineAttendancePunch({
        userId: 'user-emp-202',
        type: 'check-out',
        timestamp: '2026-11-18T16:00:00.000Z',
      });

      const events = await getOfflineAttendanceEvents(
        'user-emp-202',
        '2026-11-18T00:00:00.000Z',
        '2026-11-18T23:59:59.999Z'
      );

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('check-in');
      expect(events[1].type).toBe('check-out');
      expect(events[0].isPending).toBe(true);
    });
  });

  describe('Paradigm Dynamic Shift Engine Offline Calculation', () => {
    it('correctly classifies Shift A, Shift B, and Shift C based on arrival hour', () => {
      expect(determineShiftSlot(7, 30)).toBe('A'); // Morning
      expect(determineShiftSlot(11, 29)).toBe('A');
      expect(determineShiftSlot(11, 30)).toBe('B'); // Afternoon
      expect(determineShiftSlot(15, 0)).toBe('B');
      expect(determineShiftSlot(19, 0)).toBe('C'); // Night
      expect(determineShiftSlot(23, 0)).toBe('C');
      expect(determineShiftSlot(2, 0)).toBe('C'); // Midnight-early morning
    });

    it('calculates checked_in status and Shift A (1.0x multiplier)', async () => {
      await recordOfflineAttendancePunch({
        userId: 'user-shift-a',
        type: 'check-in',
        timestamp: '2026-11-18T07:30:00+05:30',
      });

      const status = await calculateOfflineDutyStatus('user-shift-a', new Date('2026-11-18T12:00:00+05:30'));

      expect(status.isCheckedIn).toBe(true);
      expect(status.isOnBreak).toBe(false);
      expect(status.activeShiftCode).toBe('A');
      expect(status.multiplier).toBe(1.0);
    });

    it('detects Double Duty (A+B, 2.0x multiplier) for spans >= 14 hours', async () => {
      await recordOfflineAttendancePunch({
        userId: 'user-double-duty',
        type: 'check-in',
        timestamp: '2026-11-18T06:00:00+05:30',
      });

      await recordOfflineAttendancePunch({
        userId: 'user-double-duty',
        type: 'check-out',
        timestamp: '2026-11-18T21:00:00+05:30', // 15 hours
      });

      const status = await calculateOfflineDutyStatus('user-double-duty', new Date('2026-11-18T22:00:00+05:30'));

      expect(status.isCheckedIn).toBe(false);
      expect(status.activeShiftCode).toBe('A+B');
      expect(status.multiplier).toBe(2.0);
      expect(status.totalWorkedMinutes).toBe(900); // 15 hours
    });

    it('tracks break states correctly', async () => {
      await recordOfflineAttendancePunch({
        userId: 'user-break',
        type: 'check-in',
        timestamp: '2026-11-18T08:00:00.000Z',
      });

      await recordOfflineAttendancePunch({
        userId: 'user-break',
        type: 'break-start',
        timestamp: '2026-11-18T13:00:00.000Z',
      });

      const onBreakStatus = await calculateOfflineDutyStatus('user-break', new Date('2026-11-18T13:15:00.000Z'));
      expect(onBreakStatus.isCheckedIn).toBe(true);
      expect(onBreakStatus.isOnBreak).toBe(true);

      await recordOfflineAttendancePunch({
        userId: 'user-break',
        type: 'break-end',
        timestamp: '2026-11-18T13:45:00.000Z',
      });

      const resumedStatus = await calculateOfflineDutyStatus('user-break', new Date('2026-11-18T14:00:00.000Z'));
      expect(resumedStatus.isCheckedIn).toBe(true);
      expect(resumedStatus.isOnBreak).toBe(false);
    });
  });

  describe('Offline Face-Profile Descriptor Caching', () => {
    it('persists and retrieves face descriptors offline', async () => {
      const mockDescriptor = new Float32Array(128).fill(0.12345);
      await cacheFaceDescriptor('user-face-1', mockDescriptor);

      const cached = await getCachedFaceDescriptor('user-face-1');
      expect(cached).not.toBeNull();
      expect(cached?.length).toBe(128);
      expect(cached?.[0]).toBeCloseTo(0.12345);
    });

    it('purges face descriptors when deleteOldDescriptors is called', async () => {
      const mockDescriptor = new Float32Array(128).fill(0.999);
      await cacheFaceDescriptor('user-face-del', mockDescriptor);

      await deleteOldDescriptors('user-face-del');

      const cached = await getCachedFaceDescriptor('user-face-del');
      expect(cached).toBeNull();
    });
  });

  describe('Attendance Policies & Geofence Retention', () => {
    it('retains attendance policies offline', async () => {
      const policies = {
        weeklyOffCap: 1,
        dutyCycleDays: 6,
        gracePeriodMinutes: 15,
      };

      await cacheAttendancePolicies(policies);
      const retrieved = await getCachedAttendancePolicies();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.weeklyOffCap).toBe(1);
      expect(retrieved?.dutyCycleDays).toBe(6);
    });

    it('retains site geofence coordinates offline', async () => {
      const geofence = {
        siteId: 'site-alpha',
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 250,
      };

      await cacheSiteGeofence('site-alpha', geofence);
      const retrieved = await getCachedSiteGeofence('site-alpha');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.radiusMeters).toBe(250);
      expect(retrieved?.latitude).toBe(12.9716);
    });
  });
});
