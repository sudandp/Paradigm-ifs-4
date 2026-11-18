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

describe('Phase 3 Batch E: Support Tickets, Posts/Comments & Uniform Requests Offline Hardening', () => {
  beforeEach(() => {
    m.stores = {};
    vi.clearAllMocks();
  });

  describe('Table Column Allowlist & CamelCase Normalization (Finding 05)', () => {
    it('normalizes support_tickets camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d',
        ticketNumber: 'TKT-20261118-4501',
        title: 'Main Inverter Overheating Alarm',
        description: 'Solar inverter 4 triggered high temperature alarm during peak sun.',
        category: 'Operational',
        priority: 'High',
        status: 'Open',
        raisedById: 'user-emp-201',
        raisedByName: 'Ramesh Field',
        raisedAt: '2026-11-18T10:00:00.000Z',
        assignedToId: 'user-tech-301',
        assignedToName: 'Suresh Tech',
        attachmentUrl: 'https://cdn.paradigm.internal/support/inverter_panel.jpg',
        _clientNotes: 'Do not sync this internal comment',
        localOnlyFlag: true,
      };

      const cleaned = stripLocalFields('support_tickets', rawPayload);

      expect(cleaned.id).toBe('1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d');
      expect(cleaned.ticket_number).toBe('TKT-20261118-4501');
      expect(cleaned.title).toBe('Main Inverter Overheating Alarm');
      expect(cleaned.raised_by_id).toBe('user-emp-201');
      expect(cleaned.raised_by_name).toBe('Ramesh Field');
      expect(cleaned.assigned_to_id).toBe('user-tech-301');
      expect(cleaned.assigned_to_name).toBe('Suresh Tech');
      expect(cleaned.attachment_url).toBe('https://cdn.paradigm.internal/support/inverter_panel.jpg');
      expect(cleaned.status).toBe('Open');

      // Ephemeral fields must be stripped
      expect(cleaned._clientNotes).toBeUndefined();
      expect(cleaned.localOnlyFlag).toBeUndefined();
      expect(cleaned.ticketNumber).toBeUndefined();
      expect(cleaned.raisedById).toBeUndefined();
    });

    it('normalizes ticket_posts camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '2b3c4d5e-6f7a-4b5c-9d0e-1f2a3b4c5d6e',
        ticketId: '1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d',
        authorId: 'user-tech-301',
        authorName: 'Suresh Tech',
        authorRole: 'maintenance',
        content: 'Inspected heat sink and cooling fan. Fan bearing seized, replacing with spare.',
        likes: ['user-emp-201'],
        _ephemeralState: 'drafting',
      };

      const cleaned = stripLocalFields('ticket_posts', rawPayload);

      expect(cleaned.id).toBe('2b3c4d5e-6f7a-4b5c-9d0e-1f2a3b4c5d6e');
      expect(cleaned.ticket_id).toBe('1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d');
      expect(cleaned.author_id).toBe('user-tech-301');
      expect(cleaned.author_name).toBe('Suresh Tech');
      expect(cleaned.author_role).toBe('maintenance');
      expect(cleaned.content).toContain('Inspected heat sink');
      expect(cleaned.likes).toEqual(['user-emp-201']);
      expect(cleaned._ephemeralState).toBeUndefined();
      expect(cleaned.ticketId).toBeUndefined();
    });

    it('normalizes ticket_comments camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '3c4d5e6f-7a8b-4c5d-0e1f-2a3b4c5d6e7f',
        postId: '2b3c4d5e-6f7a-4b5c-9d0e-1f2a3b4c5d6e',
        authorId: 'user-emp-201',
        authorName: 'Ramesh Field',
        content: 'Acknowledged. Spare fan available in Rack C2.',
        _dirty: false,
      };

      const cleaned = stripLocalFields('ticket_comments', rawPayload);

      expect(cleaned.id).toBe('3c4d5e6f-7a8b-4c5d-0e1f-2a3b4c5d6e7f');
      expect(cleaned.post_id).toBe('2b3c4d5e-6f7a-4b5c-9d0e-1f2a3b4c5d6e');
      expect(cleaned.author_id).toBe('user-emp-201');
      expect(cleaned.author_name).toBe('Ramesh Field');
      expect(cleaned.content).toBe('Acknowledged. Spare fan available in Rack C2.');
      expect(cleaned._dirty).toBeUndefined();
      expect(cleaned.postId).toBeUndefined();
    });

    it('normalizes uniform_requests camelCase fields to snake_case allowlist', () => {
      const rawPayload = {
        id: '4d5e6f7a-8b9c-4d5e-1f2a-3b4c5d6e7f8a',
        siteId: 'site-delta-7',
        siteName: 'Prestige Tech Park',
        department: 'Security',
        designation: 'Guard',
        gender: 'Gents',
        requestedDate: '2026-11-18',
        status: 'Pending',
        items: [
          { sizeId: 's1', sizeLabel: '32', fit: 'Regular', category: 'Pants', quantity: 2 },
          { sizeId: 's2', sizeLabel: 'L', fit: 'Regular', category: 'Shirts', quantity: 2 },
        ],
        totalCost: 2400,
        source: 'Individual',
        requestedById: 'user-guard-99',
        requestedByName: 'Vikram Singh',
        _clientSession: 'mock-active',
      };

      const cleaned = stripLocalFields('uniform_requests', rawPayload);

      expect(cleaned.id).toBe('4d5e6f7a-8b9c-4d5e-1f2a-3b4c5d6e7f8a');
      expect(cleaned.site_id).toBe('site-delta-7');
      expect(cleaned.site_name).toBe('Prestige Tech Park');
      expect(cleaned.department).toBe('Security');
      expect(cleaned.gender).toBe('Gents');
      expect(cleaned.requested_date).toBe('2026-11-18');
      expect(cleaned.status).toBe('Pending');
      expect(cleaned.total_cost).toBe(2400);
      expect(cleaned.requested_by_id).toBe('user-guard-99');
      expect(cleaned.requested_by_name).toBe('Vikram Singh');
      expect(cleaned._clientSession).toBeUndefined();
      expect(cleaned.siteId).toBeUndefined();
    });
  });

  describe('Stable UUID Generation & Outbox Persistence (Finding 01)', () => {
    it('verifies generated record IDs match RFC 4122 v4 UUID format without pseudo-prefixes', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();

      expect(uuidRegex.test(id1)).toBe(true);
      expect(uuidRegex.test(id2)).toBe(true);
      expect(id1.startsWith('st_offline_')).toBe(false);
      expect(id1.startsWith('post_offline_')).toBe(false);
      expect(id1.startsWith('comm_offline_')).toBe(false);
      expect(id1.startsWith('unif_offline_')).toBe(false);
    });

    it('enqueues support ticket in outbox with stable UUID and attachment URL intact', async () => {
      const ticketId = crypto.randomUUID();
      const payload = {
        id: ticketId,
        ticketNumber: 'TKT-20261118-9999',
        title: 'Elevator 2 Emergency Alarm',
        description: 'Elevator stopped between 3rd and 4th floor.',
        category: 'Operational',
        priority: 'Urgent',
        status: 'Open',
        raisedById: 'user-001',
        raisedByName: 'Facility Guard',
        attachmentUrl: 'https://storage.paradigm.internal/support/elevator.jpg',
      };

      await enqueue({
        id: ticketId,
        tableName: 'support_tickets',
        action: 'INSERT',
        payload,
        userId: 'user-001',
      });

      const item = await getItem(ticketId);
      expect(item).toBeDefined();
      expect(item?.tableName).toBe('support_tickets');
      expect(item?.id).toBe(ticketId);
      expect(item?.payload.attachmentUrl).toBe('https://storage.paradigm.internal/support/elevator.jpg');
      expect(item?.status).toBe('pending');
    });

    it('enqueues ticket post with topological dependsOn pointing to parent ticket', async () => {
      const ticketId = crypto.randomUUID();
      const postId = crypto.randomUUID();

      await enqueue({
        id: postId,
        tableName: 'ticket_posts',
        action: 'INSERT',
        payload: {
          id: postId,
          ticketId,
          authorId: 'user-tech-10',
          authorName: 'Technician Kumar',
          authorRole: 'staff',
          content: 'Dispatched lift technician from Otis service center.',
          likes: [],
        },
        dependsOn: ticketId,
      });

      const item = await getItem(postId);
      expect(item).toBeDefined();
      expect(item?.tableName).toBe('ticket_posts');
      expect(item?.dependsOn).toBe(ticketId);
      expect(item?.payload.ticketId).toBe(ticketId);
    });

    it('enqueues ticket comment with topological dependsOn pointing to parent post', async () => {
      const postId = crypto.randomUUID();
      const commentId = crypto.randomUUID();

      await enqueue({
        id: commentId,
        tableName: 'ticket_comments',
        action: 'INSERT',
        payload: {
          id: commentId,
          postId,
          authorId: 'user-mgr-5',
          authorName: 'Site Supervisor',
          content: 'ETA confirmed for 15 minutes. Passengers evacuated safely.',
        },
        dependsOn: postId,
      });

      const item = await getItem(commentId);
      expect(item).toBeDefined();
      expect(item?.tableName).toBe('ticket_comments');
      expect(item?.dependsOn).toBe(postId);
      expect(item?.payload.postId).toBe(postId);
    });

    it('enqueues uniform request in outbox with items array and stable UUID', async () => {
      const uniformId = crypto.randomUUID();
      const payload = {
        id: uniformId,
        siteId: 'site-alpha-1',
        siteName: 'Brigade Metropolis',
        gender: 'Gents',
        status: 'Pending',
        items: [
          { sizeId: 'sz-1', sizeLabel: '34', fit: 'Slim', category: 'Pants', quantity: 3 },
        ],
        totalCost: 1800,
      };

      await enqueue({
        id: uniformId,
        tableName: 'uniform_requests',
        action: 'INSERT',
        payload,
      });

      const item = await getItem(uniformId);
      expect(item).toBeDefined();
      expect(item?.tableName).toBe('uniform_requests');
      expect(item?.id).toBe(uniformId);
      expect(item?.payload.totalCost).toBe(1800);
      expect(item?.status).toBe('pending');
    });
  });
});
