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
import { enqueue, getItem, getAll } from '../services/offline/outbox';
import { GateKioskService } from '../services/offline/gateKioskService';
import { markGateAttendance, reportSecurityLog, getGateUserByUserId } from '../services/gateApi';

describe('Phase 3 Batch G: Community Gate & Visitor Management Offline Service', () => {
  beforeEach(() => {
    m.stores = {};
    vi.clearAllMocks();
  });

  describe('Table Column Allowlist & CamelCase Normalization (Finding 05)', () => {
    it('normalizes gate_entries camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
        organizationId: 'org-itowers-01',
        unitId: 'unit-t1-402',
        locationId: 'loc-gate-north',
        visitorType: 'delivery',
        visitorName: 'Rahul Verma',
        visitorPhone: '9876543210',
        vehicleNumber: 'KA 03 MZ 9812',
        companyName: 'Swiggy',
        visitorPhotoUrl: 'gate-captures/visitors/rahul.jpg',
        helperId: null,
        entryGateName: 'North Tower Gate',
        guardUserId: 'guard-emp-101',
        entryTime: '2026-11-18T10:15:00.000Z',
        exitTime: null,
        approvalStatus: 'pending',
        approvalChannel: 'app_push',
        offlineId: 'OFFLINE_1763460900_abc123',
        isSynced: false,
        _clientSyncToken: 'draft-xyz',
        localOnlyFlag: true,
      };

      const cleaned = stripLocalFields('gate_entries', rawPayload);

      expect(cleaned.id).toBe('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d');
      expect(cleaned.organization_id).toBe('org-itowers-01');
      expect(cleaned.unit_id).toBe('unit-t1-402');
      expect(cleaned.location_id).toBe('loc-gate-north');
      expect(cleaned.visitor_type).toBe('delivery');
      expect(cleaned.visitor_name).toBe('Rahul Verma');
      expect(cleaned.visitor_phone).toBe('9876543210');
      expect(cleaned.vehicle_number).toBe('KA 03 MZ 9812');
      expect(cleaned.company_name).toBe('Swiggy');
      expect(cleaned.visitor_photo_url).toBe('gate-captures/visitors/rahul.jpg');
      expect(cleaned.entry_gate_name).toBe('North Tower Gate');
      expect(cleaned.guard_user_id).toBe('guard-emp-101');
      expect(cleaned.entry_time).toBe('2026-11-18T10:15:00.000Z');
      expect(cleaned.approval_status).toBe('pending');
      expect(cleaned.approval_channel).toBe('app_push');
      expect(cleaned.offline_id).toBe('OFFLINE_1763460900_abc123');
      expect(cleaned.is_synced).toBe(false);

      // Ephemeral fields stripped
      expect(cleaned._clientSyncToken).toBeUndefined();
      expect(cleaned.localOnlyFlag).toBeUndefined();
      expect(cleaned.visitorName).toBeUndefined();
      expect(cleaned.vehicleNumber).toBeUndefined();
    });

    it('normalizes gate_attendance_logs camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '8b7c6d5e-4f3a-4b2c-9d1e-0f9a8b7c6d5e',
        userId: 'staff-tech-001',
        gateUserId: 'gate-user-rec-77',
        method: 'qr_code',
        confidence: 0.985,
        imageProofUrl: 'gate-captures/proof/punch_77.jpg',
        deviceInfo: { deviceName: 'Gate Tablet A', userAgent: 'Capacitor/Android' },
        markedAt: '2026-11-18T07:05:12.000Z',
        notes: 'Morning shift entry',
        _clientVersion: 4,
      };

      const cleaned = stripLocalFields('gate_attendance_logs', rawPayload);

      expect(cleaned.id).toBe('8b7c6d5e-4f3a-4b2c-9d1e-0f9a8b7c6d5e');
      expect(cleaned.user_id).toBe('staff-tech-001');
      expect(cleaned.gate_user_id).toBe('gate-user-rec-77');
      expect(cleaned.method).toBe('qr_code');
      expect(cleaned.confidence).toBe(0.985);
      expect(cleaned.image_proof_url).toBe('gate-captures/proof/punch_77.jpg');
      expect(cleaned.device_info).toEqual({ deviceName: 'Gate Tablet A', userAgent: 'Capacitor/Android' });
      expect(cleaned.marked_at).toBe('2026-11-18T07:05:12.000Z');
      expect(cleaned.notes).toBe('Morning shift entry');

      expect(cleaned._clientVersion).toBeUndefined();
      expect(cleaned.userId).toBeUndefined();
      expect(cleaned.gateUserId).toBeUndefined();
    });

    it('normalizes security_audit_logs camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '7c6d5e4f-3a2b-4c1d-8e0f-9a8b7c6d5e4f',
        eventType: 'tailgating_detected',
        severity: 'warning',
        details: { gateName: 'Main Gate', barrierCycle: 'force_open' },
        origin: 'kiosk-guard-01',
        userId: 'guard-user-09',
        userEmail: 'guard.09@paradigmfms.com',
        userAgent: 'Capacitor/Android/Samsung',
        _temporaryState: 'unprocessed',
      };

      const cleaned = stripLocalFields('security_audit_logs', rawPayload);

      expect(cleaned.id).toBe('7c6d5e4f-3a2b-4c1d-8e0f-9a8b7c6d5e4f');
      expect(cleaned.event_type).toBe('tailgating_detected');
      expect(cleaned.severity).toBe('warning');
      expect(cleaned.origin).toBe('kiosk-guard-01');
      expect(cleaned.user_id).toBe('guard-user-09');
      expect(cleaned.user_email).toBe('guard.09@paradigmfms.com');
      expect(cleaned.user_agent).toBe('Capacitor/Android/Samsung');

      expect(cleaned._temporaryState).toBeUndefined();
      expect(cleaned.eventType).toBeUndefined();
    });
  });

  describe('Audit Finding 11: Gate Kiosk Visitor Outbox Durability & Resident Approval Guard', () => {
    it('enqueues visitor entry in outbox with stable UUID before displaying confirmation', async () => {
      // Offline simulation
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      try {
        const result = await GateKioskService.logVisitorEntry({
          organization_id: 'org-itowers-01',
          unit_id: 'unit-t1-402',
          visitor_type: 'guest',
          visitor_name: 'Amit Sharma',
          visitor_phone: '9988776655',
          vehicle_number: 'KA 05 CD 5678',
          company_name: 'Personal',
          entry_gate_name: 'Main Gate',
          guard_user_id: 'guard-emp-101',
          entry_time: '2026-11-18T11:00:00.000Z',
          approval_status: 'pending',
          approval_channel: 'app_push',
        });

        expect(result.success).toBe(true);
        expect(result.isOffline).toBe(true);
        expect(result.entry.id).toBeDefined();
        expect(result.entry.offline_id).toMatch(/^OFFLINE_\d+_[a-z0-9]+/);

        // Verify outbox persistence
        const outboxItem = await getItem(result.entry.id);
        expect(outboxItem).toBeDefined();
        expect(outboxItem?.tableName).toBe('gate_entries');
        expect(outboxItem?.action).toBe('INSERT');
        expect(outboxItem?.payload.visitor_name).toBe('Amit Sharma');
        expect(outboxItem?.payload.approval_status).toBe('pending');
        expect(outboxItem?.payload.is_synced).toBe(false);
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });

    it('preserves pending approval status without fabricating resident approval offline', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      try {
        const result = await GateKioskService.logVisitorEntry({
          organization_id: 'org-itowers-01',
          unit_id: 'unit-t1-402',
          visitor_type: 'delivery',
          visitor_name: 'Zomato Delivery',
          entry_gate_name: 'Service Gate',
          guard_user_id: 'guard-emp-101',
          entry_time: '2026-11-18T11:30:00.000Z',
        });

        // Offline entry must remain strictly 'pending'
        expect(result.entry.approval_status).toBe('pending');
        expect(result.entry.is_synced).toBe(false);
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });
  });

  describe('Audit Finding 11: Face Profile & Gate User Offline Durability', () => {
    it('retrieves cached gate user with face descriptor intact when offline', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const testDescriptor = new Array(128).fill(0.123);
      const testUserId = 'user-emp-55';

      // Pre-seed storage repository
      const { getStorageRepository } = await import('../services/offline/storageRepository');
      const repo = getStorageRepository();
      await repo.putRecord('gate_users', testUserId, {
        id: 'gate-user-55',
        userId: testUserId,
        userName: 'Suresh Kumar',
        faceDescriptor: testDescriptor,
        isActive: true,
      });

      try {
        const user = await getGateUserByUserId(testUserId);
        expect(user).toBeDefined();
        expect(user?.userId).toBe(testUserId);
        expect(user?.faceDescriptor).toHaveLength(128);
        expect(user?.faceDescriptor?.[0]).toBeCloseTo(0.123);
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });

    it('rehydrates face descriptor from face_profiles store if descriptor was null in user cache', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const testDescriptor = new Array(128).fill(0.456);
      const testUserId = 'user-emp-99';

      const { getStorageRepository } = await import('../services/offline/storageRepository');
      const repo = getStorageRepository();
      // Seed gate_users with null descriptor
      await repo.putRecord('gate_users', testUserId, {
        id: 'gate-user-99',
        userId: testUserId,
        userName: 'Anand Verma',
        faceDescriptor: null,
        isActive: true,
      });
      // Seed face_profiles with real descriptor
      await repo.putRecord('face_profiles', testUserId, {
        userId: testUserId,
        descriptor: testDescriptor,
        updatedAt: Date.now(),
      });

      try {
        const user = await getGateUserByUserId(testUserId);
        expect(user).toBeDefined();
        expect(user?.faceDescriptor).toHaveLength(128);
        expect(user?.faceDescriptor?.[0]).toBeCloseTo(0.456);
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });
  });

  describe('Gate Attendance & Security Logs Offline Queueing', () => {
    it('enqueues gate attendance log with stable UUID and dependsOn pointing to gate_user', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      try {
        const log = await markGateAttendance({
          userId: 'staff-tech-001',
          gateUserId: 'gate-user-55',
          method: 'face_recognition',
          confidence: 0.965,
          imageProofUrl: 'proof-face-01.jpg',
          deviceName: 'Guard Station A',
        });

        expect(log.id).toBeDefined();
        expect(log.userId).toBe('staff-tech-001');

        const outboxItem = await getItem(log.id);
        expect(outboxItem).toBeDefined();
        expect(outboxItem?.tableName).toBe('gate_attendance_logs');
        expect(outboxItem?.action).toBe('INSERT');
        expect(outboxItem?.dependsOn).toBe('gate-user-55');
        expect(outboxItem?.payload.confidence).toBe(0.965);
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });

    it('enqueues security audit log in outbox when offline', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      try {
        await reportSecurityLog({
          eventType: 'unauthorized_gate_bypass',
          severity: 'critical',
          details: { gateName: 'East Pedestrian Gate' },
          userId: 'guard-01',
          userEmail: 'guard.01@paradigmfms.com',
        });

        const allItems = await getAll();
        const secItem = allItems.find((i) => i.tableName === 'security_audit_logs');
        expect(secItem).toBeDefined();
        expect(secItem?.payload.event_type).toBe('unauthorized_gate_bypass');
        expect(secItem?.payload.severity).toBe('critical');
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });
  });
});
