/**
 * Conflict Resolver & Review Tests
 * Verifies Phase 3A conflict resolution logic:
 *  - Diff comparison detects changed fields
 *  - resolveKeepMine re-bases revision and re-queues for sync
 *  - resolveUseServer purges outbox item and applies server record to cache
 *  - exportConflictDraft produces valid JSON backup
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  stores: {} as Record<string, Record<string, any>>,
  server: {} as Record<string, any>,
  events: [] as any[],
}));

vi.mock('../services/offline/db', () => ({
  getDb: async () => ({
    get: async (table: string, id: string) => structuredClone(m.stores[table]?.[id]),
    put: async (table: string, row: any) => { (m.stores[table] ??= {})[row.id] = structuredClone(row); },
    delete: async (table: string, id: string) => { delete m.stores[table]?.[id]; },
    getAll: async (table: string) => structuredClone(Object.values(m.stores[table] ?? {})),
  }),
}));

vi.mock('../services/offline/outbox', () => ({
  discardFailedItem: async (id: string) => {
    delete m.stores.outbox?.[id];
    m.events.push({ type: 'discarded', id });
  },
  emitOutboxEvent: (evt: any) => m.events.push(evt),
}));

vi.mock('../services/offline/syncEngine', () => ({
  syncEngine: {
    drain: vi.fn(async () => ({ synced: 1, failed: 0 })),
  },
}));

vi.mock('../services/offline/cache', () => ({
  cacheSnagEntry: async (row: any) => { (m.stores.snag_audits ??= {})[row.id] = structuredClone(row); },
  cachePpmExecution: async () => {},
  cacheHtYardAudit: async () => {},
  cacheOnboardingSubmission: async () => {},
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (_field: string, id: string) => ({
          maybeSingle: async () => ({ data: m.server[id] ?? null, error: null }),
        }),
      }),
    }),
  },
}));

import {
  buildConflictComparison,
  fetchServerConflictRecord,
  resolveKeepMine,
  resolveUseServer,
  exportConflictDraft,
} from '../services/offline/conflictActions';

beforeEach(() => {
  m.stores = {};
  m.server = {};
  m.events = [];
});

describe('Phase 3A: Conflict Resolution Actions', () => {
  it('buildConflictComparison correctly computes differences between client and server', () => {
    const item: any = {
      id: 'snag-1',
      tableName: 'snag_audits',
      status: 'conflict',
      payload: {
        id: 'snag-1',
        snag_description: 'Client edited description',
        status: 'In Progress',
        location: 'Building A',
      },
    };

    const serverRecord = {
      id: 'snag-1',
      snag_description: 'Server original description',
      status: 'In Progress',
      location: 'Building B',
    };

    const comp = buildConflictComparison(item, serverRecord);
    expect(comp.hasServerRecord).toBe(true);

    const descField = comp.fields.find((f) => f.key === 'snag_description');
    expect(descField?.isDifferent).toBe(true);
    expect(descField?.clientValue).toBe('Client edited description');
    expect(descField?.serverValue).toBe('Server original description');

    const statusField = comp.fields.find((f) => f.key === 'status');
    expect(statusField?.isDifferent).toBe(false);

    // Mismatched fields must appear first
    expect(comp.fields[0].isDifferent).toBe(true);
  });

  it('fetchServerConflictRecord queries supabase table by id', async () => {
    m.server['snag-1'] = { id: 'snag-1', status: 'Closed', updated_at: '2026-11-17T10:00:00Z' };

    const rec = await fetchServerConflictRecord('snag_audits', 'snag-1');
    expect(rec).toBeDefined();
    expect(rec?.status).toBe('Closed');
  });

  it('resolveKeepMine re-bases revision onto server version and sets pending', async () => {
    m.stores.outbox = {
      'snag-1': {
        id: 'snag-1',
        tableName: 'snag_audits',
        status: 'conflict',
        baseUpdatedAt: '2026-11-17T08:00:00Z',
        priorRevisions: ['rev-0'],
        payload: { id: 'snag-1', client_revision: 'rev-1', snag_description: 'Keep this' },
      },
    };
    m.server['snag-1'] = { id: 'snag-1', updated_at: '2026-11-17T09:30:00Z' };

    const success = await resolveKeepMine('snag-1');
    expect(success).toBe(true);

    const updated = m.stores.outbox['snag-1'];
    expect(updated.status).toBe('pending');
    expect(updated.baseUpdatedAt).toBe('2026-11-17T09:30:00Z');
    expect(updated.priorRevisions).toContain('rev-1');
    expect(updated.payload.client_revision).toMatch(/^rev-\d+-/);
  });

  it('resolveUseServer discards local outbox item and caches server version', async () => {
    m.stores.outbox = {
      'snag-1': {
        id: 'snag-1',
        tableName: 'snag_audits',
        status: 'conflict',
        payload: { id: 'snag-1', snag_description: 'Discard this' },
      },
    };
    m.server['snag-1'] = { id: 'snag-1', snag_description: 'Official Server Version', status: 'Closed' };

    const success = await resolveUseServer('snag-1');
    expect(success).toBe(true);

    // Outbox item must be purged
    expect(m.stores.outbox['snag-1']).toBeUndefined();
    // Cache must have server version
    expect(m.stores.snag_audits['snag-1'].snag_description).toBe('Official Server Version');
  });

  it('exportConflictDraft serializes unsaved client payload into clean JSON format', async () => {
    m.stores.outbox = {
      'snag-1': {
        id: 'snag-1',
        tableName: 'snag_audits',
        status: 'conflict',
        createdAt: 1731800000000,
        payload: { id: 'snag-1', notes: 'Important field note' },
        attachments: [],
      },
    };

    const res = await exportConflictDraft('snag-1');
    expect(res.success).toBe(true);
    expect(res.filename).toContain('paradigm_conflict_draft_snag_audits_snag-1');

    const parsed = JSON.parse(res.jsonContent);
    expect(parsed.recordId).toBe('snag-1');
    expect(parsed.payload.notes).toBe('Important field note');
  });
});
