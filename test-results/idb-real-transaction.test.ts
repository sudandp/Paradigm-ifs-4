/**
 * Real IndexedDB Transaction Integration Tests — Paradigm Offline Hardening
 * Uses W3C-compliant fake-indexeddb engine to test real IDB transactions,
 * aborts, rollbacks, and isolation boundaries without synthetic mock shortcuts.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB, type IDBPDatabase } from 'idb';

const m = vi.hoisted(() => ({
  realDb: null as IDBPDatabase<any> | null,
}));

vi.mock('../services/offline/db', () => ({
  getDb: async () => m.realDb,
}));

import { withIdbTransaction } from '../services/offline/idbTransaction';
import { IndexedDbStorageAdapter } from '../services/offline/storageRepository';

const DB_NAME = 'paradigm_test_real_idb';

async function createRealTestDb(): Promise<IDBPDatabase<any>> {
  return await openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('snag_audits' as any)) {
        db.createObjectStore('snag_audits' as any, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('outbox' as any)) {
        db.createObjectStore('outbox' as any, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('photos' as any)) {
        db.createObjectStore('photos' as any, { keyPath: 'id' });
      }
    },
  });
}

describe('Real IndexedDB Transaction Engine Tests', () => {
  beforeEach(async () => {
    indexedDB = new IDBFactory(); // fresh in-memory database
    m.realDb = await createRealTestDb();
  });

  afterEach(async () => {
    if (m.realDb) {
      m.realDb.close();
      m.realDb = null;
    }
  });

  it('withIdbTransaction commits modifications on successful completion', async () => {
    await withIdbTransaction(['snag_audits'], 'readwrite', async (tx) => {
      await tx.put('snag_audits', { id: 'snag-commit-1', description: 'Real commit test' });
    });

    const persisted = await m.realDb!.get('snag_audits', 'snag-commit-1');
    expect(persisted).toBeDefined();
    expect(persisted.description).toBe('Real commit test');
  });

  it('withIdbTransaction rolls back all operations across multiple stores when callback throws', async () => {
    await m.realDb!.put('snag_audits', { id: 'existing-snag', description: 'Original state' });

    await expect(
      withIdbTransaction(['snag_audits', 'outbox'], 'readwrite', async (tx) => {
        // Mutate existing record
        await tx.put('snag_audits', { id: 'existing-snag', description: 'Corrupted state' });
        // Insert new record in second store
        await tx.put('outbox', { id: 'out-1', status: 'pending', payload: { action: 'test' } });

        // Simulate crash / exception mid-transaction
        throw new Error('Simulated failure during multi-store operation');
      })
    ).rejects.toThrow('Simulated failure during multi-store operation');

    // Verify existing record rolled back to original state
    const snag = await m.realDb!.get('snag_audits', 'existing-snag');
    expect(snag.description).toBe('Original state');

    // Verify newly inserted outbox item was completely rolled back
    const outboxItem = await m.realDb!.get('outbox', 'out-1');
    expect(outboxItem).toBeUndefined();
  });

  it('IndexedDbStorageAdapter.runTransaction executes atomic writes and rolls back on error', async () => {
    const adapter = new IndexedDbStorageAdapter();
    await adapter.initialize();

    await expect(
      adapter.runTransaction('readwrite', ['snag_audits'], async (txRepo) => {
        await txRepo.putRecord('snag_audits', 'tx-snag-1', { id: 'tx-snag-1', title: 'Draft snag' });
        throw new Error('Transaction abort triggered');
      })
    ).rejects.toThrow('Transaction abort triggered');

    const result = await adapter.getRecord('snag_audits', 'tx-snag-1');
    expect(result).toBeNull();
  });

  it('IndexedDbStorageAdapter.runTransaction isolates nested transaction requests', async () => {
    const adapter = new IndexedDbStorageAdapter();
    await adapter.initialize();

    await expect(
      adapter.runTransaction('readwrite', ['snag_audits'], async () => {
        // Nested transaction must fail fast
        await adapter.runTransaction('readwrite', ['snag_audits'], async () => {});
      })
    ).rejects.toThrow('Nested transactions are not supported');
  });
});
