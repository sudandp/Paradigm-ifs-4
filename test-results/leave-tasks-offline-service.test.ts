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

// Mock mockDb
const mockDb = {
  outbox: new Map<string, any>(),
  cache: new Map<string, any>(),
};

describe('Phase 3 Batch D: Leave, Tasks, Field Reports, Extra Work & Comp-Off Offline Service', () => {
  beforeEach(() => {
    m.stores = {};
    vi.clearAllMocks();
  });

  describe('Table Column Allowlist & CamelCase Normalization (Finding 05)', () => {
    it('normalizes leave_requests camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        userId: 'user-emp-101',
        userName: 'John Doe',
        leaveType: 'Casual',
        startDate: '2026-11-20',
        endDate: '2026-11-21',
        dayOption: 'full',
        reason: 'Family event',
        status: 'pending_manager_approval',
        currentApproverId: 'mgr-202',
        isHalfDay: false,
        halfDayPeriod: null,
        _clientMeta: 'ephemeral',
        localOnlyFlag: true,
      };

      const cleaned = stripLocalFields('leave_requests', rawPayload);

      // Verify camelCase was converted to snake_case
      expect(cleaned.id).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
      expect(cleaned.user_id).toBe('user-emp-101');
      expect(cleaned.leave_type).toBe('Casual');
      expect(cleaned.start_date).toBe('2026-11-20');
      expect(cleaned.end_date).toBe('2026-11-21');
      expect(cleaned.day_option).toBe('full');
      expect(cleaned.current_approver_id).toBe('mgr-202');
      expect(cleaned.status).toBe('pending_manager_approval');

      // Verify unmapped/local fields were stripped
      expect(cleaned._clientMeta).toBeUndefined();
      expect(cleaned.localOnlyFlag).toBeUndefined();
      expect(cleaned.startDate).toBeUndefined();
    });

    it('normalizes tasks camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        name: 'Check Fire Pump Pressure',
        description: 'Verify gauge pressure is at 7 bar',
        assignedToId: 'staff-404',
        createdById: 'sup-505',
        siteId: 'site-alpha',
        dueDate: '2026-11-25',
        priority: 'High',
        status: 'In Progress',
        estimatedHours: 2,
        completionNotes: null,
      };

      const cleaned = stripLocalFields('tasks', rawPayload);

      expect(cleaned.id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(cleaned.name).toBe('Check Fire Pump Pressure');
      expect(cleaned.assigned_to_id).toBe('staff-404');
      expect(cleaned.created_by_id).toBe('sup-505');
      expect(cleaned.site_id).toBe('site-alpha');
      expect(cleaned.due_date).toBe('2026-11-25');
      expect(cleaned.priority).toBe('High');
      expect(cleaned.status).toBe('In Progress');
      expect(cleaned.dueDate).toBeUndefined();
    });

    it('normalizes field_reports camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        userId: 'user-field-1',
        siteName: 'Site Beta',
        jobType: 'Shift Handover',
        summary: 'All systems normal during evening shift',
        userRemarks: 'Diesel tank refilled to 85%',
        _ephemeral: true,
      };

      const cleaned = stripLocalFields('field_reports', rawPayload);

      expect(cleaned.id).toBe('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      expect(cleaned.user_id).toBe('user-field-1');
      expect(cleaned.site_name).toBe('Site Beta');
      expect(cleaned.job_type).toBe('Shift Handover');
      expect(cleaned.summary).toBe('All systems normal during evening shift');
      expect(cleaned.user_remarks).toBe('Diesel tank refilled to 85%');
      expect(cleaned._ephemeral).toBeUndefined();
    });

    it('normalizes extra_work_logs camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        userId: 'user-tech-1',
        workDate: '2026-11-17',
        hoursWorked: 4,
        claimType: 'ot',
        reason: 'Emergency DG repair after power outage',
        status: 'pending',
        approvedBy: null,
      };

      const cleaned = stripLocalFields('extra_work_logs', rawPayload);

      expect(cleaned.id).toBe('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33');
      expect(cleaned.user_id).toBe('user-tech-1');
      expect(cleaned.work_date).toBe('2026-11-17');
      expect(cleaned.hours_worked).toBe(4);
      expect(cleaned.claim_type).toBe('ot');
      expect(cleaned.status).toBe('pending');
      expect(cleaned.workDate).toBeUndefined();
    });

    it('normalizes comp_off_logs camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        userId: 'user-ops-1',
        userName: 'Operator 1',
        dateEarned: '2026-11-15',
        reason: 'National Holiday coverage at Main Gate',
        status: 'earned',
        grantedByName: 'Site Manager',
      };

      const cleaned = stripLocalFields('comp_off_logs', rawPayload);

      expect(cleaned.id).toBe('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44');
      expect(cleaned.user_id).toBe('user-ops-1');
      expect(cleaned.user_name).toBe('Operator 1');
      expect(cleaned.date_earned).toBe('2026-11-15');
      expect(cleaned.status).toBe('earned');
      expect(cleaned.granted_by_name).toBe('Site Manager');
      expect(cleaned.dateEarned).toBeUndefined();
    });
  });

  describe('Stable UUID Validation & Outbox Persistence (Finding 01)', () => {
    it('verifies generated record IDs match RFC 4122 v4 UUID format', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const testUuid = crypto.randomUUID();

      expect(uuidRegex.test(testUuid)).toBe(true);
      expect(testUuid.startsWith('offline_')).toBe(false);
      expect(testUuid.startsWith('col_offline_')).toBe(false);
    });

    it('enqueues leave request in outbox with stable UUID and preserves client metadata', async () => {
      const leaveId = crypto.randomUUID();
      const item = {
        id: leaveId,
        userId: 'user-001',
        leaveType: 'Privilege',
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        dayOption: 'full',
        reason: 'Annual family holiday',
        status: 'pending_manager_approval',
      };

      await enqueue({
        id: leaveId,
        tableName: 'leave_requests',
        action: 'INSERT',
        payload: item,
        userId: 'user-001',
      });

      const queued = await getItem(leaveId);
      expect(queued).toBeDefined();
      expect(queued?.tableName).toBe('leave_requests');
      expect(queued?.id).toBe(leaveId);
      expect(queued?.payload.userId).toBe('user-001');
      expect(queued?.status).toBe('pending');
    });

    it('enqueues task with completion photo attachment reference intact', async () => {
      const taskId = crypto.randomUUID();
      const photoId = crypto.randomUUID();

      await enqueue({
        id: taskId,
        tableName: 'tasks',
        action: 'UPDATE',
        payload: {
          id: taskId,
          status: 'Done',
          completionNotes: 'Replaced air filters on FCU-3',
          completionPhoto: {
            name: 'filter_replaced.jpg',
            type: 'image/jpeg',
            size: 102400,
            path: `tasks/${taskId}/filter_replaced.jpg`,
          },
        },
        attachments: [
          {
            photoId,
            storagePath: `tasks/${taskId}/filter_replaced.jpg`,
            payloadPath: 'completionPhoto.path',
          },
        ],
      });

      const queued = await getItem(taskId);
      expect(queued).toBeDefined();
      expect(queued?.tableName).toBe('tasks');
      expect(queued?.attachments).toHaveLength(1);
      expect(queued?.attachments?.[0].photoId).toBe(photoId);
      expect(queued?.attachments?.[0].payloadPath).toBe('completionPhoto.path');
    });

    it('enqueues comp-off and extra work logs with stable UUIDs without crashing', async () => {
      const compOffId = crypto.randomUUID();
      const extraWorkId = crypto.randomUUID();

      await enqueue({
        id: compOffId,
        tableName: 'comp_off_logs',
        action: 'INSERT',
        payload: {
          id: compOffId,
          userId: 'user-ops-2',
          dateEarned: '2026-11-16',
          reason: 'Emergency DG night breakdown coverage',
          status: 'earned',
        },
      });

      await enqueue({
        id: extraWorkId,
        tableName: 'extra_work_logs',
        action: 'INSERT',
        payload: {
          id: extraWorkId,
          userId: 'user-ops-2',
          workDate: '2026-11-16',
          workType: 'Night Shift',
          claimType: 'Comp Off',
          hoursWorked: 8,
          status: 'Pending',
        },
      });

      const queuedCompOff = await getItem(compOffId);
      const queuedExtraWork = await getItem(extraWorkId);

      expect(queuedCompOff).toBeDefined();
      expect(queuedCompOff?.id).toBe(compOffId);
      expect(queuedExtraWork).toBeDefined();
      expect(queuedExtraWork?.id).toBe(extraWorkId);
    });
  });
});
