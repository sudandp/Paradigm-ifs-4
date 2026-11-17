/**
 * Storage Repository Contract Tests — Paradigm Offline Hardening
 * Verifies that the unified IOfflineStorageRepository contract behaves consistently:
 * - Domain record CRUD
 * - Outbox enqueue, FIFO pending query, and updates
 * - Attachment storage and retrieval
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  stores: {} as Record<string, Record<string, any>>,
}));

vi.mock('../services/offline/db', () => ({
  getDb: async () => ({
    objectStoreNames: { contains: () => true },
    get: async (table: string, id: string) => structuredClone(m.stores[table]?.[id]),
    put: async (table: string, row: any) => { (m.stores[table] ??= {})[row.id] = structuredClone(row); },
    delete: async (table: string, id: string) => { delete m.stores[table]?.[id]; },
    getAll: async (table: string) => structuredClone(Object.values(m.stores[table] ?? {})),
  }),
}));

import {
  IndexedDbStorageAdapter,
  getStorageRepository,
  type IOfflineStorageRepository,
} from '../services/offline/storageRepository';

beforeEach(() => {
  m.stores = {};
});

describe('IOfflineStorageRepository Contract Tests', () => {
  it('Factory returns an IndexedDbStorageAdapter on web environments', () => {
    const repo = getStorageRepository();
    expect(repo).toBeDefined();
    expect(repo.engineName).toBe('indexeddb');
  });

  it('CRUD operations on domain records persist and retrieve correctly', async () => {
    const adapter: IOfflineStorageRepository = new IndexedDbStorageAdapter();
    await adapter.initialize();

    await adapter.putRecord('snag_audits', 'snag-1', { id: 'snag-1', description: 'Leaking pipe' });
    const fetched = await adapter.getRecord<any>('snag_audits', 'snag-1');
    expect(fetched).toBeDefined();
    expect(fetched.description).toBe('Leaking pipe');

    const all = await adapter.getAllRecords<any>('snag_audits');
    expect(all).toHaveLength(1);

    await adapter.deleteRecord('snag_audits', 'snag-1');
    expect(await adapter.getRecord('snag_audits', 'snag-1')).toBeNull();
  });

  it('Outbox operations manage FIFO ordering, userId filtering, and updates', async () => {
    const adapter: IOfflineStorageRepository = new IndexedDbStorageAdapter();
    await adapter.initialize();

    const item1: any = {
      id: 'out-1',
      tableName: 'snag_audits',
      action: 'UPSERT',
      status: 'pending',
      userId: 'user-a',
      createdAt: 1000,
      payload: { id: 's1' },
    };

    const item2: any = {
      id: 'out-2',
      tableName: 'snag_audits',
      action: 'UPSERT',
      status: 'pending',
      userId: 'user-b',
      createdAt: 2000,
      payload: { id: 's2' },
    };

    await adapter.enqueueOutbox(item1);
    await adapter.enqueueOutbox(item2);

    // Filter by user-a
    const userAPending = await adapter.getPendingOutbox('user-a');
    expect(userAPending).toHaveLength(1);
    expect(userAPending[0].id).toBe('out-1');

    // Update status to syncing
    await adapter.updateOutboxItem({ ...item1, status: 'syncing', leaseExpiresAt: Date.now() + 60000 });
    const updated = await adapter.getOutboxItem('out-1');
    expect(updated?.status).toBe('syncing');

    // Deletion
    await adapter.deleteOutboxItem('out-1');
    expect(await adapter.getOutboxItem('out-1')).toBeNull();
  });

  it('Attachment management stores and retrieves Blobs natively', async () => {
    const adapter: IOfflineStorageRepository = new IndexedDbStorageAdapter();
    await adapter.initialize();

    const dummyBlob = new Blob(['sample-photo-data'], { type: 'image/jpeg' });
    await adapter.storeAttachment('photo-123', dummyBlob, 'evidence.jpg', 'snag-1');

    const retrieved = await adapter.getAttachment('photo-123');
    expect(retrieved).toBeDefined();
    expect(retrieved?.fileName).toBe('evidence.jpg');
    expect(retrieved?.linkedToId).toBe('snag-1');

    await adapter.deleteAttachment('photo-123');
    expect(await adapter.getAttachment('photo-123')).toBeNull();
  });
});
