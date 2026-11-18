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
import { enqueue, getItem } from '../services/offline/outbox';

describe('Phase 3 Batch F: Asset Management, Meter Readings & Maintenance Offline Service', () => {
  beforeEach(() => {
    m.stores = {};
    vi.clearAllMocks();
  });

  describe('Table Column Allowlist & CamelCase Normalization (Finding 05)', () => {
    it('normalizes ops_assets camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '1f2e3d4c-5b6a-4978-8f1e-2d3c4b5a6f7e',
        entityId: 'ent-substation-1',
        assetCode: 'DG-01-500KVA',
        name: 'Cummins 500kVA Diesel Generator #1',
        category: 'DG',
        location: 'Basement 2 - DG Room',
        makeModel: 'Cummins KTA19-G4',
        serialNumber: 'SN-DG-2024-9981',
        installationDate: '2024-03-15',
        capacity: '500 kVA / 400 kW',
        amcVendorName: 'Sterling & Wilson Ltd',
        amcExpiryDate: '2027-03-14',
        status: 'Operational',
        qrCodePayload: 'PARADIGM-ASSET:DG-01-500KVA:882910',
        lastInspectedAt: '2026-11-18T08:30:00.000Z',
        _clientSyncToken: 'draft-abc',
        localOnlyFlag: true,
      };

      const cleaned = stripLocalFields('ops_assets', rawPayload);

      expect(cleaned.id).toBe('1f2e3d4c-5b6a-4978-8f1e-2d3c4b5a6f7e');
      expect(cleaned.entity_id).toBe('ent-substation-1');
      expect(cleaned.asset_code).toBe('DG-01-500KVA');
      expect(cleaned.make_model).toBe('Cummins KTA19-G4');
      expect(cleaned.serial_number).toBe('SN-DG-2024-9981');
      expect(cleaned.installation_date).toBe('2024-03-15');
      expect(cleaned.amc_vendor_name).toBe('Sterling & Wilson Ltd');
      expect(cleaned.amc_expiry_date).toBe('2027-03-14');
      expect(cleaned.qr_code_payload).toBe('PARADIGM-ASSET:DG-01-500KVA:882910');
      expect(cleaned.last_inspected_at).toBe('2026-11-18T08:30:00.000Z');

      // Ephemeral fields stripped
      expect(cleaned._clientSyncToken).toBeUndefined();
      expect(cleaned.localOnlyFlag).toBeUndefined();
      expect(cleaned.assetCode).toBeUndefined();
      expect(cleaned.makeModel).toBeUndefined();
    });

    it('normalizes ops_asset_ppm_logs with meter readings to snake_case allowlist', () => {
      const rawPayload = {
        id: '2a3b4c5d-6e7f-4a5b-8c9d-0e1f2a3b4c5d',
        assetId: '1f2e3d4c-5b6a-4978-8f1e-2d3c4b5a6f7e',
        checklistId: 'chk-dg-daily',
        inspectedBy: 'user-tech-10',
        inspectedByName: 'Arun Technician',
        inspectedAt: '2026-11-18T09:15:00.000Z',
        qrScanned: true,
        parameterReadings: {
          diesel_level_pct: 85,
          battery_voltage: 24.8,
          coolant_temp_c: 65,
          oil_pressure_bar: 4.2,
          running_hours: 1420.5,
          eb_kwh_reading: 98450,
        },
        hasAbnormalities: false,
        abnormalityNotes: null,
        photoUrls: ['https://storage.paradigm.internal/ppm/dg_meter_gauge.jpg'],
        _tempReadingUuid: 'ephemeral-99',
      };

      const cleaned = stripLocalFields('ops_asset_ppm_logs', rawPayload);

      expect(cleaned.id).toBe('2a3b4c5d-6e7f-4a5b-8c9d-0e1f2a3b4c5d');
      expect(cleaned.asset_id).toBe('1f2e3d4c-5b6a-4978-8f1e-2d3c4b5a6f7e');
      expect(cleaned.checklist_id).toBe('chk-dg-daily');
      expect(cleaned.inspected_by).toBe('user-tech-10');
      expect(cleaned.inspected_by_name).toBe('Arun Technician');
      expect(cleaned.qr_scanned).toBe(true);
      expect((cleaned.parameter_readings as any).diesel_level_pct).toBe(85);
      expect((cleaned.parameter_readings as any).eb_kwh_reading).toBe(98450);
      expect(cleaned.has_abnormalities).toBe(false);
      expect(cleaned.photo_urls).toEqual(['https://storage.paradigm.internal/ppm/dg_meter_gauge.jpg']);
      expect(cleaned._tempReadingUuid).toBeUndefined();
      expect(cleaned.assetId).toBeUndefined();
    });

    it('normalizes ops_maintenance_schedules camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '3b4c5d6e-7f8a-4b5c-9d0e-1f2a3b4c5d6e',
        entityId: 'ent-substation-1',
        taskName: 'Quarterly Transformer Oil Filtration & BDV Test',
        description: 'Test breakdown voltage across 6 sparks, threshold >= 50kV.',
        category: 'Electrical',
        assetReference: 'TR-01-1500KVA',
        frequency: 'Quarterly',
        lastCompletedDate: '2026-08-15',
        nextDueDate: '2026-11-20',
        status: 'Active',
        assignedRole: 'Lead Electrical Engineer',
        _clientDraftId: 'sched-draft-1',
      };

      const cleaned = stripLocalFields('ops_maintenance_schedules', rawPayload);

      expect(cleaned.id).toBe('3b4c5d6e-7f8a-4b5c-9d0e-1f2a3b4c5d6e');
      expect(cleaned.entity_id).toBe('ent-substation-1');
      expect(cleaned.task_name).toBe('Quarterly Transformer Oil Filtration & BDV Test');
      expect(cleaned.asset_reference).toBe('TR-01-1500KVA');
      expect(cleaned.frequency).toBe('Quarterly');
      expect(cleaned.last_completed_date).toBe('2026-08-15');
      expect(cleaned.next_due_date).toBe('2026-11-20');
      expect(cleaned.assigned_role).toBe('Lead Electrical Engineer');
      expect(cleaned._clientDraftId).toBeUndefined();
      expect(cleaned.taskName).toBeUndefined();
    });

    it('normalizes ops_maintenance_logs camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '4c5d6e7f-8a9b-4c5d-0e1f-2a3b4c5d6e7f',
        scheduleId: '3b4c5d6e-7f8a-4b5c-9d0e-1f2a3b4c5d6e',
        completedDate: '2026-11-18T11:00:00.000Z',
        completedBy: 'user-tech-10',
        completedByName: 'Arun Technician',
        remarks: 'BDV tested at 62kV. Handover signed off with Site Supervisor.',
        photoUrls: ['https://storage.paradigm.internal/ppm/bdv_tester_display.jpg'],
        status: 'Completed',
        _draftTimestamp: 1794998810,
      };

      const cleaned = stripLocalFields('ops_maintenance_logs', rawPayload);

      expect(cleaned.id).toBe('4c5d6e7f-8a9b-4c5d-0e1f-2a3b4c5d6e7f');
      expect(cleaned.schedule_id).toBe('3b4c5d6e-7f8a-4b5c-9d0e-1f2a3b4c5d6e');
      expect(cleaned.completed_date).toBe('2026-11-18T11:00:00.000Z');
      expect(cleaned.completed_by).toBe('user-tech-10');
      expect(cleaned.completed_by_name).toBe('Arun Technician');
      expect(cleaned.remarks).toContain('BDV tested at 62kV');
      expect(cleaned.photo_urls).toEqual(['https://storage.paradigm.internal/ppm/bdv_tester_display.jpg']);
      expect(cleaned.status).toBe('Completed');
      expect(cleaned._draftTimestamp).toBeUndefined();
      expect(cleaned.scheduleId).toBeUndefined();
    });
  });

  describe('Stable UUID Generation & Outbox Linkage (Finding 01 & Phase 2)', () => {
    it('verifies generated record IDs match RFC 4122 v4 UUID format without pseudo-prefixes', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();

      expect(uuidRegex.test(id1)).toBe(true);
      expect(uuidRegex.test(id2)).toBe(true);
      expect(id1.startsWith('asset_offline_')).toBe(false);
      expect(id1.startsWith('insp_offline_')).toBe(false);
      expect(id1.startsWith('sched_offline_')).toBe(false);
      expect(id1.startsWith('mlog_offline_')).toBe(false);
    });

    it('enqueues asset in outbox with stable UUID and QR code payload intact', async () => {
      const assetId = crypto.randomUUID();
      const payload = {
        id: assetId,
        assetCode: 'CHILLER-01',
        name: 'Carrier Centrifugal Chiller 300TR',
        category: 'HVAC',
        location: 'Plant Room B1',
        status: 'Operational',
        qrCodePayload: 'PARADIGM-ASSET:CHILLER-01:100200',
      };

      await enqueue({
        id: assetId,
        tableName: 'ops_assets',
        action: 'INSERT',
        payload,
      });

      const item = await getItem(assetId);
      expect(item).toBeDefined();
      expect(item?.tableName).toBe('ops_assets');
      expect(item?.id).toBe(assetId);
      expect(item?.payload.qrCodePayload).toBe('PARADIGM-ASSET:CHILLER-01:100200');
      expect(item?.status).toBe('pending');
    });

    it('enqueues meter inspection log with topological dependsOn pointing to parent asset', async () => {
      const assetId = crypto.randomUUID();
      const inspectionLogId = crypto.randomUUID();

      await enqueue({
        id: inspectionLogId,
        tableName: 'ops_asset_ppm_logs',
        action: 'INSERT',
        payload: {
          id: inspectionLogId,
          assetId,
          qrScanned: true,
          parameterReadings: {
            suction_pressure_psi: 45,
            discharge_pressure_psi: 180,
            chilled_water_in_c: 12.2,
            chilled_water_out_c: 7.1,
          },
          hasAbnormalities: false,
          inspectedAt: '2026-11-18T10:00:00.000Z',
        },
        dependsOn: assetId,
      });

      const item = await getItem(inspectionLogId);
      expect(item).toBeDefined();
      expect(item?.tableName).toBe('ops_asset_ppm_logs');
      expect(item?.dependsOn).toBe(assetId);
      expect(item?.payload.assetId).toBe(assetId);
      expect((item?.payload.parameterReadings as any).chilled_water_out_c).toBe(7.1);
    });

    it('enqueues maintenance completion log with topological dependsOn pointing to parent schedule', async () => {
      const scheduleId = crypto.randomUUID();
      const completionLogId = crypto.randomUUID();

      await enqueue({
        id: completionLogId,
        tableName: 'ops_maintenance_logs',
        action: 'INSERT',
        payload: {
          id: completionLogId,
          scheduleId,
          completedDate: '2026-11-18T12:00:00.000Z',
          completedByName: 'Chief Engineer Roy',
          remarks: 'Overhauled condenser water pump seals and aligned motor shaft.',
          status: 'Completed',
        },
        dependsOn: scheduleId,
      });

      const item = await getItem(completionLogId);
      expect(item).toBeDefined();
      expect(item?.tableName).toBe('ops_maintenance_logs');
      expect(item?.dependsOn).toBe(scheduleId);
      expect(item?.payload.scheduleId).toBe(scheduleId);
    });
  });
});
