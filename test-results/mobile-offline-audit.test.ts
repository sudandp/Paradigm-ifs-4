/**
 * Audit reproductions, 2026-11-17.
 * These assert OBSERVED BUG BEHAVIOUR, not desired product behaviour.
 * No real accounts, network calls, or device databases are used.
 * IndexedDB mocks structured-clone values so queue races are not hidden by object aliases.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

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
import { stripLocalFields, syncEngine } from '../services/offline/syncEngine';
import { GateKioskService } from '../services/offline/gateKioskService';

function extractApiCache() {
  const source = ts.createSourceFile('api.ts', readFileSync('services/api.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  let initializer = '';
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) === 'offlineDb') initializer = declaration.initializer!.getText(source);
    }
  }
  expect(initializer).not.toBe('');
  const code = ts.transpileModule(`globalThis.result = ${initializer}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context: any = { localStorage: local, window: {}, console };
  runInNewContext(code, context);
  return context.result;
}

beforeEach(() => {
  m.stores = {}; m.server = {}; m.writes = []; m.currentUser = 'user-b'; m.online = true; m.queryError = null; m.duringWrite = undefined; m.duringRpc = undefined;
  storage.clear();
  storage.set('paradigm-auth-storage', JSON.stringify({ state: { user: { id: m.currentUser } } }));
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('navigator', { onLine: true });
});

describe('Current mobile/offline defects (passing means reproduced)', () => {
  it('legacy addToOutbox resolves without persisting a punch', async () => {
    const cache = extractApiCache();
    const before = [...storage.entries()];
    await cache.addToOutbox({ table_name: 'attendance_events', action: 'INSERT', payload: { userId: 'user-b' } });
    expect([...storage.entries()]).toEqual(before);
    expect(m.stores).toEqual({});
  });

  it('metadata cache getter returns null even after a successful cache write', async () => {
    const cache = extractApiCache();
    await cache.setCache('attendance_all_2026-11-17', [{ id: 'punch' }]);
    expect(await cache.getCache('attendance_all_2026-11-17')).toHaveLength(1);
    expect(await cache.getCacheWithMeta('attendance_all_2026-11-17')).toBeNull();
  });

  it('snag camelCase business fields are removed by the snake_case allowlist', () => {
    const clean = stripLocalFields('snag_audits', {
      id: 'snag', nameOfSite: 'Plant A', snagDescription: 'Leaking pump', actionToBeTaken: 'Repair',
      emailAddress: 'audit@example.invalid', snagPictureUrl: 'blob:photo', status: 'Open',
    });
    expect(clean).toEqual({ id: 'snag', status: 'Open' });
  });

  it('a text/status-only edit drops the queued photo references', async () => {
    const att = await outbox.storeAttachment(new Blob(['image'], { type: 'image/jpeg' }), 'snag_picture_url', 'user-b/snags/s/photo.jpg');
    await outbox.enqueue({ id: 's', tableName: 'snag_audits', payload: { id: 's' }, attachments: [att] });
    await outbox.enqueue({ id: 's', tableName: 'snag_audits', payload: { id: 's', status: 'Closed' } });
    expect((await outbox.getItem('s'))!.attachments).toBeUndefined();
    expect(await outbox.getPhoto(att.photoId)).toBeDefined();
  });

  it('failed unsynced record and its only photo are deleted after 24 hours', async () => {
    const att = await outbox.storeAttachment(new Blob(['image']), 'snag_picture_url', 'user-b/snags/s/photo.jpg');
    await outbox.enqueue({ id: 's', tableName: 'snag_audits', payload: { id: 's' }, attachments: [att] });
    m.stores.snag_audits = { s: { id: 's', pending: true } };
    await outbox.markFailed('s', { kind: 'permanent', message: 'permission denied' });
    m.stores.outbox.s.createdAt = Date.now() - 25 * 3600 * 1000;
    expect(await outbox.pruneStaleFailedItems()).toBe(1);
    expect(await outbox.getItem('s')).toBeUndefined();
    expect(await outbox.getPhoto(att.photoId)).toBeUndefined();
    expect(m.stores.snag_audits.s).toBeUndefined();
  });

  it('automatic drain leaves interrupted syncing and auth_paused items untouched', async () => {
    for (const status of ['syncing', 'auth_paused']) {
      await outbox.enqueue({ id: status, tableName: 'snag_audits', userId: m.currentUser, payload: { id: status } });
      m.stores.outbox[status].status = status;
    }
    expect(await (syncEngine as any)._drain(false)).toEqual({ synced: 0, failed: 0 });
    expect(m.writes).toHaveLength(0);
    expect((await outbox.getAll()).map(x => x.status)).toEqual(['syncing', 'auth_paused']);
  });

  it('manual sync drains user A work using the active user B session', async () => {
    await outbox.enqueue({ id: 'a-record', tableName: 'snag_audits', userId: 'user-a', payload: { id: 'a-record', status: 'Open' } });
    expect(await syncEngine.drain()).toEqual({ synced: 1, failed: 0 });
    expect(m.writes[0].sessionUser).toBe('user-b');
    expect(m.writes[0].payload.id).toBe('a-record');
  });

  it('matching an older revision discards a newer unsynced edit', async () => {
    m.server.s = { id: 's', updated_at: 'server-v2', client_revision: 'revision-old', snag_description: 'old' };
    await outbox.enqueue({ id: 's', tableName: 'snag_audits', userId: m.currentUser, baseUpdatedAt: 'server-v1',
      priorRevisions: ['revision-old'], payload: { id: 's', snag_description: 'new', client_revision: 'revision-new' } });
    expect(await syncEngine.drain()).toEqual({ synced: 1, failed: 0 });
    expect(m.writes).toHaveLength(0);
    expect(m.server.s.snag_description).toBe('old');
    expect(await outbox.getItem('s')).toBeUndefined();
  });

  it('an older in-flight sync deletes a new edit queued during its request', async () => {
    await outbox.enqueue({ id: 's', tableName: 'snag_audits', userId: m.currentUser,
      payload: { id: 's', snag_description: 'old', client_revision: 'r1' } });
    m.duringWrite = async () => {
      await outbox.enqueue({ id: 's', tableName: 'snag_audits', userId: m.currentUser,
        payload: { id: 's', snag_description: 'new', client_revision: 'r2' } });
    };
    expect(await syncEngine.drain()).toEqual({ synced: 1, failed: 0 });
    expect(m.server.s.snag_description).toBe('old');
    expect(await outbox.getItem('s')).toBeUndefined();
  });

  it('a failed gate-directory fetch overwrites a valid offline roster with empty lists', async () => {
    storage.set('paradigm_gate_cache_org', JSON.stringify({ organizationId: 'org', units: [{ id: 'flat-1' }], residents: [], helpers: [], cachedAt: 1 }));
    m.queryError = { message: 'Failed to fetch' };
    await GateKioskService.prefetchGateData('org');
    expect(GateKioskService.getLocalCache('org').units).toEqual([]);
  });

  it('a successful gate sync deletes a new visitor queued while the RPC was running', async () => {
    storage.set('paradigm_gate_pending_entries', JSON.stringify([{ id: 'old-visitor' }]));
    m.duringRpc = async () => {
      vi.stubGlobal('navigator', { onLine: false });
      await GateKioskService.logVisitorEntry({ organization_id: 'org', visitor_name: 'New visitor' } as any);
      expect(JSON.parse(storage.get('paradigm_gate_pending_entries')!)).toHaveLength(2);
    };
    expect(await GateKioskService.syncPendingEntries()).toEqual({ syncedCount: 1 });
    expect(storage.has('paradigm_gate_pending_entries')).toBe(false);
  });

  it('gate save reports success even when local storage is full', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('localStorage', { ...local, setItem: () => { throw new Error('QuotaExceededError'); } });
    const result = await GateKioskService.logVisitorEntry({ organization_id: 'org', visitor_name: 'Unsaved visitor' } as any);
    expect(result.success).toBe(true);
    expect(result.isOffline).toBe(true);
    expect(storage.has('paradigm_gate_pending_entries')).toBe(false);
  });
});
