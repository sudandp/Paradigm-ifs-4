/**
 * Completion audit, 2026-11-19. Assertions describe REQUIRED behavior.
 * These tests intentionally remain red until the audited defects are fixed.
 * Production queue/save/sync/cache/migration code runs with synthetic storage and
 * server boundaries. This is not a device, SQLite, or real-backend acceptance test.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  stores: {} as Record<string, Record<string, any>>,
  server: {} as Record<string, any>,
  currentUser: 'user-b',
  queryError: null as any,
  missingStores: new Set<string>(),
  duringWrite: undefined as undefined | (() => Promise<void>),
  duringUpload: undefined as undefined | (() => Promise<void>),
  duringRpc: undefined as undefined | (() => Promise<void>),
  afterOutboxRead: undefined as undefined | (() => Promise<void>),
}));
const storage = new Map<string, string>();
const local = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};

vi.mock('../services/offline/db', () => ({
  getStoragePersistenceState: () => true,
  getDb: async () => ({
    objectStoreNames: { contains: (table: string) => !m.missingStores.has(table) },
    async put(table: string, row: any) {
      (m.stores[table] ??= {})[row.id] = structuredClone(row);
    },
    async get(table: string, id: string) {
      const snapshot = structuredClone(m.stores[table]?.[id]);
      // A second writer can commit between separate IDB read/delete transactions.
      if (table === 'outbox' && m.afterOutboxRead) {
        const cb = m.afterOutboxRead; m.afterOutboxRead = undefined; await cb();
      }
      return snapshot;
    },
    async delete(table: string, id: string) { delete m.stores[table]?.[id]; },
    async getAll(table: string) { return structuredClone(Object.values(m.stores[table] ?? {})); },
    async getAllFromIndex(table: string, index: string, value: string) {
      const field = { 'by-user': 'userId', 'by-status': 'status' }[index]!;
      return structuredClone(Object.values(m.stores[table] ?? {}).filter((row: any) => row[field] === value));
    },
  }),
}));
vi.mock('../services/offline/networkStatus', () => ({
  isOnline: () => true, isReachable: async () => true,
  initNetworkStatus: async () => {}, onStatusChange: () => () => {},
}));
vi.mock('../services/offline/featureFlag', () => ({
  isDrainEnabled: () => true, isCaptureEnabled: () => true, isOfflineEnabled: () => true,
}));
vi.mock('../services/api', () => ({ api: {} }));
vi.mock('../services/offline/telemetry', () => ({ recordSyncTelemetry: async () => {} }));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { dismiss: vi.fn(), success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../services/supabase', () => {
  const session = () => ({ user: { id: m.currentUser }, expires_at: Math.floor(Date.now() / 1000) + 3600 });
  return {
    ensureSupabaseAuthSession: async () => session(),
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: session() } }),
        refreshSession: async () => ({ data: { session: session() }, error: null }),
      },
      storage: { from: () => ({
        upload: async () => {
          if (m.duringUpload) { const cb = m.duringUpload; m.duringUpload = undefined; await cb(); }
          return { error: null };
        },
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.invalid/photo.jpg' } }),
      }) },
      rpc: async () => {
        if (m.duringRpc) { const cb = m.duringRpc; m.duringRpc = undefined; await cb(); }
        return { data: { success: true }, error: null };
      },
      from: (table: string) => {
        let id: string;
        let payload: any;
        const execute = async () => {
          if (m.queryError) return { data: null, error: m.queryError };
          if (payload) {
            if (m.duringWrite) { const cb = m.duringWrite; m.duringWrite = undefined; await cb(); }
            m.server[payload.id] = structuredClone(payload);
            return { data: { ...payload, updated_at: 'server-new' }, error: null };
          }
          return { data: m.server[id] ?? null, error: null };
        };
        const chain: any = {
          select: () => chain, order: () => chain,
          eq: (_key: string, value: string) => { id = value; return chain; },
          upsert: (value: any) => { payload = value; return chain; },
          insert: async () => ({ data: null, error: null }),
          maybeSingle: execute,
          then: (resolve: any, reject: any) => execute().then(resolve, reject),
        };
        return chain;
      },
    },
  };
});

import * as outbox from '../services/offline/outbox';
import * as cache from '../services/offline/cache';
import { syncEngine } from '../services/offline/syncEngine';
import { saveOfflineAware } from '../services/offline/saveOfflineAware';
import { IndexedDbStorageAdapter } from '../services/offline/storageRepository';
import { verifyMigratedRecords } from '../services/offline/migrationJournal';
import { GateKioskService } from '../services/offline/gateKioskService';
import { resolveUseServer } from '../services/offline/conflictActions';

beforeEach(() => {
  m.stores = {}; m.server = {}; m.currentUser = 'user-b'; m.queryError = null;
  m.missingStores.clear(); m.duringWrite = undefined; m.duringUpload = undefined;
  m.duringRpc = undefined; m.afterOutboxRead = undefined;
  storage.clear();
  local.setItem('paradigm-auth-storage', JSON.stringify({ state: { user: { id: m.currentUser } } }));
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => vi.unstubAllGlobals());

const queueRevision = (revision: string, extra: Record<string, any> = {}) => outbox.enqueue({
  id: 's', tableName: 'snag_audits', userId: 'user-b',
  payload: { id: 's', snag_description: revision, client_revision: revision }, ...extra,
});

describe('Offline plan completion requirements', () => {
  it('V01: upload checkpoint must preserve an edit queued during file upload', async () => {
    const att = await outbox.storeAttachment(new Blob(['photo']), 'snag_picture_url', 'user-b/snags/s/photo.jpg');
    await queueRevision('rev-1', { attachments: [att] });
    m.duringUpload = async () => { await queueRevision('rev-2'); };
    await syncEngine.drain();
    expect(m.server.s.client_revision).toBe('rev-1');
    expect((await outbox.getItem('s'))?.payload.client_revision).toBe('rev-2');
  });

  it('V02: acknowledging an older save must retain photos referenced by the newer queued edit', async () => {
    const att = await outbox.storeAttachment(new Blob(['photo']), 'snag_picture_url', 'user-b/snags/s/photo.jpg');
    await queueRevision('rev-1', { attachments: [att] });
    m.duringWrite = async () => { await queueRevision('rev-2'); };
    await syncEngine.drain();
    expect((await outbox.getItem('s'))?.payload.client_revision).toBe('rev-2');
    expect(await outbox.getPhoto(att.photoId)).toBeDefined();
  });

  it('V03: successful online save must not remove a newer offline revision', async () => {
    await saveOfflineAware({
      table: 'snag_audits', record: { id: 's', client_revision: 'rev-1' },
      onlineSave: async () => { await queueRevision('rev-2'); },
    });
    expect((await outbox.getItem('s'))?.payload.client_revision).toBe('rev-2');
  });

  it('V04: revision check and acknowledgment must be atomic against another writer', async () => {
    await queueRevision('rev-1');
    m.afterOutboxRead = async () => { await queueRevision('rev-2'); };
    await outbox.markSynced('s', 'rev-1');
    expect((await outbox.getItem('s'))?.payload.client_revision).toBe('rev-2');
  });

  it('V05: unmapped legacy ownership must be held for review, not uploaded by the next account', async () => {
    await queueRevision('rev-1', { userId: undefined });
    await syncEngine.drain();
    expect(m.server.s).toBeUndefined();
    expect(await outbox.getItem('s')).toBeDefined();
  });

  it('V06: cached private onboarding records must be scoped to the active account', async () => {
    m.stores.onboarding_submissions = { private: { id: 'private', user_id: 'user-a' } };
    expect(await cache.getCachedOnboardingSubmissions()).toEqual([]);
  });

  it('V07: migration verification must detect changed nested payload fields', async () => {
    const result = await verifyMigratedRecords(
      [{ id: 's', payload: { description: 'original' } }],
      [{ id: 's', payload: { description: 'corrupted' } }], 'outbox',
    );
    expect(result.passed).toBe(false);
  });

  it('V08: writing an unsupported domain store must report failure', async () => {
    m.missingStores.add('gate_entries'); // absent from the production IDB schema
    const repo = new IndexedDbStorageAdapter();
    await expect(repo.putRecord('gate_entries', 'g', { id: 'g' })).rejects.toThrow();
  });

  it('V09: failed gate roster refresh must retain the last downloaded directory', async () => {
    local.setItem('paradigm_gate_cache_org', JSON.stringify({
      organizationId: 'org', units: [{ id: 'unit-1' }], residents: [], helpers: [], cachedAt: 1000,
    }));
    m.queryError = { message: 'network unavailable' };
    const roster = await GateKioskService.prefetchGateData('org');
    expect(roster.units).toEqual([{ id: 'unit-1' }]);
  });

  it('V10: legacy gate replay must retain entries added while its RPC is in flight', async () => {
    local.setItem('paradigm_gate_pending_entries', JSON.stringify([{ id: 'old' }]));
    m.duringRpc = async () => {
      local.setItem('paradigm_gate_pending_entries', JSON.stringify([{ id: 'old' }, { id: 'new' }]));
    };
    await GateKioskService.syncPendingEntries();
    expect(JSON.parse(local.getItem('paradigm_gate_pending_entries') || '[]')).toEqual([{ id: 'new' }]);
  });

  it('V11: Use Server must retain the draft when fetching the server version fails', async () => {
    await queueRevision('rev-1');
    await outbox.markFailed('s', { kind: 'conflict', message: 'server changed' });
    m.queryError = { message: 'network unavailable' };
    await resolveUseServer('s').catch(() => false);
    expect(await outbox.getItem('s')).toBeDefined();
  });

  it('V12: clearing visible failed work must preserve another account\'s failed records', async () => {
    await queueRevision('rev-1', { userId: 'user-a' });
    await outbox.markFailed('s', { kind: 'permanent', message: 'validation rejected' });
    await outbox.clearAllFailed();
    expect(await outbox.getItem('s')).toBeDefined();
  });
});
