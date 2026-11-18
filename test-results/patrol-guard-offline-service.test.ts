import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { stripLocalFields } from '../services/offline/syncEngine';
import { getItem, getAll } from '../services/offline/outbox';
import {
  fetchPatrolCheckpoints,
  savePatrolCheckpoint,
  logPatrolScan,
  fetchPatrolScans,
} from '../services/offline/patrolOfflineService';
import { getStorageRepository } from '../services/offline/storageRepository';

describe('Phase 3 Batch H: Security Patrol, Checkpoints & Incident Reporting Offline Service', () => {
  beforeEach(() => {
    m.stores = {};
    vi.clearAllMocks();
  });

  describe('Table Column Allowlist & CamelCase Normalization (Finding 05)', () => {
    it('normalizes gate_patrol_checkpoints camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d',
        organizationId: 'org-itowers-01',
        locationId: 'loc-basement-b2',
        checkpointCode: 'CHK-B2-PUMP',
        checkpointName: 'B2 Domestic Water Pump Room',
        qrHash: 'PARADIGM-PATROL:B2-PUMP:99812',
        nfcTagUid: 'NFC-TAG-B2-001',
        expectedLatitude: 12.9716,
        expectedLongitude: 77.5946,
        sequenceOrder: 1,
        active: true,
        _clientSyncToken: 'draft-token-123',
        tempState: 'local_only',
      };

      const cleaned = stripLocalFields('gate_patrol_checkpoints', rawPayload);

      expect(cleaned.id).toBe('1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d');
      expect(cleaned.organization_id).toBe('org-itowers-01');
      expect(cleaned.location_id).toBe('loc-basement-b2');
      expect(cleaned.checkpoint_code).toBe('CHK-B2-PUMP');
      expect(cleaned.checkpoint_name).toBe('B2 Domestic Water Pump Room');
      expect(cleaned.qr_hash).toBe('PARADIGM-PATROL:B2-PUMP:99812');
      expect(cleaned.nfc_tag_uid).toBe('NFC-TAG-B2-001');
      expect(cleaned.expected_latitude).toBe(12.9716);
      expect(cleaned.expected_longitude).toBe(77.5946);
      expect(cleaned.sequence_order).toBe(1);
      expect(cleaned.active).toBe(true);

      // Ephemeral fields stripped
      expect(cleaned._clientSyncToken).toBeUndefined();
      expect(cleaned.tempState).toBeUndefined();
      expect(cleaned.checkpointCode).toBeUndefined();
      expect(cleaned.checkpointName).toBeUndefined();
    });

    it('normalizes gate_patrol_scans camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '2b3c4d5e-6f7a-4b5c-9d0e-1f2a3b4c5d6e',
        organizationId: 'org-itowers-01',
        checkpointId: '1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d',
        guardId: 'guard-emp-101',
        scanTime: '2026-11-18T02:30:15.000Z',
        latitude: 12.97165,
        longitude: 77.59462,
        isWithinGeofence: true,
        remarks: 'Pump room door locked, no water leaks observed',
        _clientVersion: 'v4.2',
      };

      const cleaned = stripLocalFields('gate_patrol_scans', rawPayload);

      expect(cleaned.id).toBe('2b3c4d5e-6f7a-4b5c-9d0e-1f2a3b4c5d6e');
      expect(cleaned.organization_id).toBe('org-itowers-01');
      expect(cleaned.checkpoint_id).toBe('1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d');
      expect(cleaned.guard_id).toBe('guard-emp-101');
      expect(cleaned.scan_time).toBe('2026-11-18T02:30:15.000Z');
      expect(cleaned.latitude).toBe(12.97165);
      expect(cleaned.longitude).toBe(77.59462);
      expect(cleaned.is_within_geofence).toBe(true);
      expect(cleaned.remarks).toBe('Pump room door locked, no water leaks observed');

      expect(cleaned._clientVersion).toBeUndefined();
      expect(cleaned.checkpointId).toBeUndefined();
      expect(cleaned.guardId).toBeUndefined();
    });
  });

  describe('Patrol Checkpoints Offline Persistence & Retrieval', () => {
    it('serves cached checkpoints when offline', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const repo = getStorageRepository();
      const mockCheckpoints = [
        {
          id: 'cp-01',
          organization_id: 'org-itowers-01',
          checkpoint_code: 'CHK-01',
          checkpoint_name: 'North Gate Perimeter',
          qr_hash: 'QR-01',
          sequence_order: 1,
          active: true,
        },
        {
          id: 'cp-02',
          organization_id: 'org-itowers-01',
          checkpoint_code: 'CHK-02',
          checkpoint_name: 'Clubhouse Fencing',
          qr_hash: 'QR-02',
          sequence_order: 2,
          active: true,
        },
      ];
      await repo.putRecord('gate_patrol_checkpoints', 'org-itowers-01', mockCheckpoints);

      try {
        const result = await fetchPatrolCheckpoints('org-itowers-01');
        expect(result).toHaveLength(2);
        expect(result[0].checkpoint_name).toBe('North Gate Perimeter');
        expect(result[1].checkpoint_code).toBe('CHK-02');
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });

    it('enqueues newly configured checkpoint in outbox with stable UUID when offline', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      try {
        const saved = await savePatrolCheckpoint({
          organization_id: 'org-itowers-01',
          checkpoint_code: 'CHK-TERRACE-A',
          checkpoint_name: 'Tower A Terrace Solar Array',
          qr_hash: 'PARADIGM-PATROL:TERRACE-A:112233',
          sequence_order: 5,
        });

        expect(saved.id).toBeDefined();
        expect(saved.checkpoint_name).toBe('Tower A Terrace Solar Array');

        const outboxItem = await getItem(saved.id);
        expect(outboxItem).toBeDefined();
        expect(outboxItem?.tableName).toBe('gate_patrol_checkpoints');
        expect(outboxItem?.action).toBe('UPSERT');
        expect(outboxItem?.payload.checkpoint_code).toBe('CHK-TERRACE-A');
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });
  });

  describe('Patrol Scan Logging with Geofence & Topological Linkage', () => {
    it('enqueues patrol scan in outbox with stable UUID and dependsOn pointing to checkpoint', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const repo = getStorageRepository();
      const mockCheckpoint = {
        id: 'cp-b2-pump',
        organization_id: 'org-itowers-01',
        checkpoint_code: 'CHK-B2-PUMP',
        checkpoint_name: 'B2 Pump Room',
        qr_hash: 'QR-B2-PUMP',
        expected_latitude: 12.9716,
        expected_longitude: 77.5946,
        sequence_order: 1,
        active: true,
      };
      await repo.putRecord('gate_patrol_checkpoints', 'org-itowers-01', [mockCheckpoint]);

      try {
        const scan = await logPatrolScan({
          organizationId: 'org-itowers-01',
          checkpointId: 'cp-b2-pump',
          guardId: 'guard-emp-101',
          qrHash: 'QR-B2-PUMP',
          latitude: 12.97162,
          longitude: 77.59461,
          remarks: 'Round #3 complete, all clear',
        });

        expect(scan.id).toBeDefined();
        expect(scan.is_within_geofence).toBe(true);
        expect(scan.remarks).toBe('Round #3 complete, all clear');

        const outboxItem = await getItem(scan.id);
        expect(outboxItem).toBeDefined();
        expect(outboxItem?.tableName).toBe('gate_patrol_scans');
        expect(outboxItem?.action).toBe('INSERT');
        expect(outboxItem?.dependsOn).toBe('cp-b2-pump');
        expect(outboxItem?.userId).toBe('guard-emp-101');
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });

    it('detects when guard is outside geofence radius (>100m) while preserving scan record', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const repo = getStorageRepository();
      const mockCheckpoint = {
        id: 'cp-terrace-solar',
        organization_id: 'org-itowers-01',
        checkpoint_code: 'CHK-SOLAR',
        checkpoint_name: 'Terrace Solar Field',
        qr_hash: 'QR-SOLAR',
        expected_latitude: 12.9716,
        expected_longitude: 77.5946,
        sequence_order: 2,
        active: true,
      };
      await repo.putRecord('gate_patrol_checkpoints', 'org-itowers-01', [mockCheckpoint]);

      try {
        // Guard coordinates ~500 meters away
        const scan = await logPatrolScan({
          organizationId: 'org-itowers-01',
          checkpointId: 'cp-terrace-solar',
          guardId: 'guard-emp-101',
          qrHash: 'QR-SOLAR',
          latitude: 12.9760,
          longitude: 77.5946,
          remarks: 'Manual override scan',
        });

        expect(scan.id).toBeDefined();
        expect(scan.is_within_geofence).toBe(false);

        const outboxItem = await getItem(scan.id);
        expect(outboxItem).toBeDefined();
        expect(outboxItem?.payload.is_within_geofence).toBe(false);
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });

    it('serves cached patrol scans when offline', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const repo = getStorageRepository();
      const mockScans = [
        {
          id: 'scan-1',
          organization_id: 'org-itowers-01',
          checkpoint_id: 'cp-01',
          guard_id: 'guard-emp-101',
          scan_time: '2026-11-18T03:00:00.000Z',
          is_within_geofence: true,
        },
      ];
      await repo.putRecord('gate_patrol_scans', 'org-itowers-01', mockScans);

      try {
        const results = await fetchPatrolScans({ organizationId: 'org-itowers-01' });
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('scan-1');
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });
  });
});
