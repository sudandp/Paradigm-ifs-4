/**
 * Mobile Offline Hardening — Phase 1 Verification Tests
 * Verifies that the critical data-loss bugs identified in the 2026-11-17 audit are resolved:
 *  - Stuck 'syncing' items are auto-recovered on lease expiry
 *  - 'auth_paused' items resume once the user is authenticated
 *  - Failed records and attachments are never silently deleted
 *  - In-flight sync preserves newer revisions queued during request execution
 *  - Concurrency retry on an older revision re-bases instead of deleting newer client edits
 *  - Manual sync strictly isolates items by authenticated user
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  stores: {} as Record<string, Record<string, any>>,
  server: {} as Record<string, any>,
  writes: [] as any[],
  currentUser: 'user-b',
  online: true,
  queryError: null as any,
  duringWrite: undefined as undefined | (() => Promise<void>),
  duringRpc: undefined as undefined | (() => Promise<void>),
}));
const storage = new Map<string, string>();
const local = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};

vi.mock('../services/offline/db', () => {
  const db = {
    objectStoreNames: { contains: () => true },
    async put(table: string, row: any) {
      (m.stores[table] ??= {})[row.id] = structuredClone(row);
    },
    async get(table: string, id: string) { return structuredClone(m.stores[table]?.[id]); },
    async delete(table: string, id: string) { delete m.stores[table]?.[id]; },
    async getAll(table: string) { return structuredClone(Object.values(m.stores[table] ?? {})); },
    async getAllFromIndex(table: string, index: string, value: string) {
      const field = { 'by-user': 'userId', 'by-status': 'status', 'by-table': 'tableName' }[index];
      return structuredClone(Object.values(m.stores[table] ?? {}).filter((x: any) => x[field!] === value));
    },
  };
  return { getDb: async () => db, getStoragePersistenceState: () => true };
});

vi.mock('../services/offline/cache', () => {
  const put = async (table: string, row: any) => { (m.stores[table] ??= {})[row.id] = structuredClone(row); };
  return {
    put,
    migrateLocalStoragePpmDrafts: async () => {},
    cacheSnagEntry: (row: any) => put('snag_audits', row),
    cachePpmExecution: (row: any) => put('ppm_executions', row),
    cacheHtYardAudit: (row: any) => put('ht_yard_audits', row),
    cacheOnboardingSubmission: (row: any) => put('onboarding_submissions', row),
    deleteSnagEntryFromCache: async (id: string) => { delete m.stores.snag_audits?.[id]; },
  };
});

vi.mock('../services/offline/networkStatus', () => ({
  isOnline: () => m.online,
  isReachable: async () => m.online,
  initNetworkStatus: async () => {},
  onStatusChange: () => () => {},
}));

vi.mock('../services/offline/featureFlag', () => ({ isDrainEnabled: () => true, isCaptureEnabled: () => true }));
vi.mock('../services/api', () => ({ api: {} }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { dismiss: vi.fn(), success: vi.fn(), error: vi.fn() }) }));

vi.mock('../services/supabase', () => ({
  ensureSupabaseAuthSession: async () => ({
    user: { id: m.currentUser },
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }),
  supabase: {
    rpc: async () => {
      if (m.duringRpc) { const cb = m.duringRpc; m.duringRpc = undefined; await cb(); }
      return { data: { success: true }, error: null };
    },
    auth: {
      getSession: async () => ({ data: { session: { user: { id: m.currentUser }, expires_at: Math.floor(Date.now() / 1000) + 3600 } } }),
      refreshSession: async () => ({ data: { session: { user: { id: m.currentUser } } } }),
    },
    from: (table: string) => {
      let id: string;
      let payload: any;
      const execute = async () => {
        if (m.queryError) return { data: null, error: m.queryError };
        if (payload) {
          if (m.duringWrite) { const cb = m.duringWrite; m.duringWrite = undefined; await cb(); }
          m.writes.push({ table, payload: structuredClone(payload), sessionUser: m.currentUser });
          m.server[payload.id] = structuredClone(payload);
          return { data: { ...payload, updated_at: 'server-new' }, error: null };
        }
        return { data: m.server[id] ?? null, error: null };
      };
      const chain: any = {
        select: () => chain,
        eq: (_key: string, value: string) => { id = value; return chain; },
        order: () => chain,
        upsert: (value: any) => { payload = value; return chain; },
        maybeSingle: execute,
        then: (resolve: any, reject: any) => execute().then(resolve, reject),
      };
      return chain;
    },
  },
}));

import * as outbox from '../services/offline/outbox';
import { syncEngine } from '../services/offline/syncEngine';

beforeEach(() => {
  m.stores = {}; m.server = {}; m.writes = []; m.currentUser = 'user-b'; m.online = true; m.queryError = null; m.duringWrite = undefined; m.duringRpc = undefined;
  storage.clear();
  storage.set('paradigm-auth-storage', JSON.stringify({ state: { user: { id: m.currentUser } } }));
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('navigator', { onLine: true });
});

describe('Mobile Offline Hardening — Phase 1 Resolved Regressions', () => {
  it('P1-01: Stuck syncing items are recovered back to pending when lease expires', async () => {
    await outbox.enqueue({ id: 'stuck-1', tableName: 'snag_audits', userId: m.currentUser, payload: { id: 'stuck-1' } });
    await outbox.markSyncing('stuck-1', 1000); // 1-second lease
    
    // Simulate expired lease
    m.stores.outbox['stuck-1'].leaseExpiresAt = Date.now() - 5000;
    expect(m.stores.outbox['stuck-1'].status).toBe('syncing');

    const recovered = await outbox.recoverStuckSyncingItems(0);
    expect(recovered).toBe(1);
    expect(m.stores.outbox['stuck-1'].status).toBe('pending');
    expect(m.stores.outbox['stuck-1'].leaseExpiresAt).toBeUndefined();
  });

  it('P1-02: Failed records and photos are NOT deleted after 24 hours', async () => {
    const att = await outbox.storeAttachment(new Blob(['image']), 'snag_picture_url', 'user-b/snags/s/photo.jpg');
    await outbox.enqueue({ id: 's', tableName: 'snag_audits', payload: { id: 's' }, attachments: [att] });
    m.stores.snag_audits = { s: { id: 's', pending: true } };
    await outbox.markFailed('s', { kind: 'permanent', message: 'permission denied' });
    
    // Set age to 30 hours old
    m.stores.outbox.s.createdAt = Date.now() - 30 * 3600 * 1000;
    
    // pruneStaleFailedItems must NOT destroy the record or photo
    const pruned = await outbox.pruneStaleFailedItems();
    expect(pruned).toBe(0);
    expect(await outbox.getItem('s')).toBeDefined();
    expect(await outbox.getPhoto(att.photoId)).toBeDefined();
    expect(m.stores.snag_audits.s).toBeDefined();
    expect(m.stores.outbox.s.status).toBe('failed');
  });

  it('P1-03: Manual sync does NOT drain User A items when User B is authenticated', async () => {
    await outbox.enqueue({ id: 'a-record', tableName: 'snag_audits', userId: 'user-a', payload: { id: 'a-record', status: 'Open' } });
    await outbox.enqueue({ id: 'b-record', tableName: 'snag_audits', userId: 'user-b', payload: { id: 'b-record', status: 'Open' } });

    // Drain triggered by user-b
    const res = await syncEngine.drain();
    expect(res.synced).toBe(1);
    expect(m.writes).toHaveLength(1);
    expect(m.writes[0].payload.id).toBe('b-record');
    expect(m.writes[0].sessionUser).toBe('user-b');

    // user-a's item must remain queued and intact
    const aItem = await outbox.getItem('a-record');
    expect(aItem).toBeDefined();
    expect(aItem?.status).toBe('pending');
  });

  it('P1-04: In-flight sync preserves a newer revision queued during request execution', async () => {
    await outbox.enqueue({
      id: 's', tableName: 'snag_audits', userId: m.currentUser,
      payload: { id: 's', snag_description: 'initial', client_revision: 'rev-1' }
    });

    // Simulate user editing to rev-2 while rev-1 request is in flight
    m.duringWrite = async () => {
      await outbox.enqueue({
        id: 's', tableName: 'snag_audits', userId: m.currentUser,
        payload: { id: 's', snag_description: 'updated', client_revision: 'rev-2' }
      });
    };

    // First drain commits rev-1 to server, but preserves rev-2 in outbox!
    await syncEngine.drain();
    
    // Server has rev-1 for now
    expect(m.server.s.snag_description).toBe('initial');
    
    // Outbox MUST still contain 's' with rev-2 ready to sync next!
    const item = await outbox.getItem('s');
    expect(item).toBeDefined();
    expect(item?.payload.client_revision).toBe('rev-2');
    expect(item?.status).toBe('pending');

    // Second drain syncs rev-2 to server
    await syncEngine.drain();
    expect(m.server.s.snag_description).toBe('updated');
    expect(await outbox.getItem('s')).toBeUndefined();
  });

  it('P1-05: Server matching an older revision re-bases and syncs newer client revision', async () => {
    m.server.s = { id: 's', updated_at: 'server-v2', client_revision: 'revision-old', snag_description: 'old' };
    
    await outbox.enqueue({
      id: 's', tableName: 'snag_audits', userId: m.currentUser, baseUpdatedAt: 'server-v1',
      priorRevisions: ['revision-old'],
      payload: { id: 's', snag_description: 'brand-new', client_revision: 'revision-new' }
    });

    // Instead of falsely considering this already committed and discarding 'brand-new',
    // the sync engine re-bases and uploads the new revision!
    const res = await syncEngine.drain();
    expect(res.synced).toBe(1);
    expect(m.writes).toHaveLength(1);
    expect(m.server.s.snag_description).toBe('brand-new');
    expect(m.server.s.client_revision).toBe('revision-new');
  });

  it('P1-06: auth_paused items are resumed when the user is authenticated', async () => {
    await outbox.enqueue({ id: 'auth-item', tableName: 'snag_audits', userId: m.currentUser, payload: { id: 'auth-item' } });
    await outbox.markFailed('auth-item', { kind: 'auth', message: 'Session expired' });
    expect((await outbox.getItem('auth-item'))?.status).toBe('auth_paused');

    // Resume items for user-b
    const resumed = await outbox.resumeAuthPausedItems('user-b');
    expect(resumed).toBe(1);
    expect((await outbox.getItem('auth-item'))?.status).toBe('pending');

    // Drain successfully processes it
    const res = await syncEngine.drain();
    expect(res.synced).toBe(1);
  });
});
