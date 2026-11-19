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


describe('Claim re-verification boundary checks', () => {
  it('RV01: acknowledgment retains a write arriving after the final revision read', async () => {
    await queueRevision('rev-1');
    m.afterOutboxRead = async () => {
      m.afterOutboxRead = async () => { await queueRevision('rev-2'); };
    };
    await outbox.markSynced('s', 'rev-1');
    expect((await outbox.getItem('s'))?.payload.client_revision).toBe('rev-2');
  });

  it('RV02: camelCase cached onboarding records remain account isolated', async () => {
    m.stores.onboarding_submissions = { private: { id: 'private', userId: 'user-a', createdUserId: 'user-a' } };
    expect(await cache.getCachedOnboardingSubmissions('user-b')).toEqual([]);
  });

  it('RV03: missing authentication cannot clear every account failed queue', async () => {
    await queueRevision('rev-1', { userId: 'user-a' });
    await outbox.markFailed('s', { kind: 'permanent', message: 'rejected' });
    storage.clear();
    await outbox.clearAllFailed().catch(() => {});
    expect(await outbox.getItem('s')).toBeDefined();
  });

  it('RV04: auth resume cannot claim unmapped paused work for the next account', async () => {
    await queueRevision('rev-1', { userId: 'anonymous' });
    await outbox.markFailed('s', { kind: 'auth', message: 'expired' });
    await outbox.resumeAuthPausedItems('user-b');
    expect((await outbox.getItem('s'))?.userId).toBe('anonymous');
    expect((await outbox.getPending('user-b'))).toEqual([]);
  });

  it('RV05: repository transaction rolls back earlier writes if callback fails', async () => {
    const repo = new IndexedDbStorageAdapter();
    await expect(repo.runTransaction('readwrite', ['snag_audits'], async () => {
      await repo.putRecord('snag_audits', 's', { id: 's' });
      throw new Error('abort transaction');
    })).rejects.toThrow('abort transaction');
    expect(await repo.getRecord('snag_audits', 's')).toBeNull();
  });

  it('RV06: old photo upload cannot acknowledge replacement bytes at the same payload field', async () => {
    const oldAtt = await outbox.storeAttachment(new Blob(['old']), 'snag_picture_url', 'user-b/snags/s/old.jpg');
    await queueRevision('rev-1', { attachments: [oldAtt] });
    let newPhotoId: string;
    m.duringUpload = async () => {
      const newAtt = await outbox.storeAttachment(new Blob(['new']), 'snag_picture_url', 'user-b/snags/s/new.jpg');
      newPhotoId = newAtt.photoId;
      await queueRevision('rev-2', { attachments: [newAtt] });
    };
    await syncEngine.drain();
    const pending = await outbox.getItem('s');
    expect(pending?.attachments?.[0].photoId).toBe(newPhotoId!);
    expect(pending?.attachments?.[0].uploadedUrl).toBeUndefined();
  });

  it('RV07: older server completion cannot overwrite the newer local record cache', async () => {
    await queueRevision('rev-1');
    m.duringWrite = async () => {
      await queueRevision('rev-2');
      await cache.put('snag_audits', { id: 's', client_revision: 'rev-2', snag_description: 'rev-2' });
    };
    await syncEngine.drain();
    expect((await outbox.getItem('s'))?.payload.client_revision).toBe('rev-2');
    expect((await cache.get<any>('snag_audits', 's'))?.client_revision).toBe('rev-2');
  });
});

