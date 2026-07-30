/**
 * phase4.test.ts
 *
 * Unit tests for Phase 4: Refinements & Resilience:
 *   - Exponential backoff calculation & nextAttemptAt timestamps
 *   - Non-retryable error detection (RLS / permission errors -> permanent failure)
 *   - Attempt capping at maxAttempts = 5
 *   - getPending() filtering by nextAttemptAt
 *   - retryFailedItem() and discardFailedItem() outbox lifecycle
 *   - throttleUploads() concurrency pool throttling
 *
 * Run: npx vitest run services/offline/phase4.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OutboxItem } from './db';

// ─── In-memory IDB store mock for Phase 4 ───────────────────────────────────

const _outboxStore: Record<string, OutboxItem> = {};
const _photoStore: Record<string, any> = {};
const _snagStore: Record<string, any> = {};

vi.mock('./featureFlag', () => ({
  isOfflineEnabled: () => true,
}));

vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./db')>();

  const mockDb = {
    put: vi.fn((storeName: string, item: any) => {
      if (storeName === 'outbox') _outboxStore[item.id] = item;
      if (storeName === 'photos') _photoStore[item.id] = item;
      if (storeName === 'snag_audits') _snagStore[item.id] = item;
      return Promise.resolve();
    }),
    get: vi.fn((storeName: string, id: string) => {
      if (storeName === 'outbox') return Promise.resolve(_outboxStore[id]);
      if (storeName === 'photos') return Promise.resolve(_photoStore[id]);
      if (storeName === 'snag_audits') return Promise.resolve(_snagStore[id]);
      return Promise.resolve(undefined);
    }),
    getAll: vi.fn((storeName: string) => {
      if (storeName === 'outbox') return Promise.resolve(Object.values(_outboxStore));
      return Promise.resolve([]);
    }),
    getAllFromIndex: vi.fn((storeName: string, indexName: string, value: string) => {
      if (storeName === 'outbox' && indexName === 'by-status') {
        return Promise.resolve(Object.values(_outboxStore).filter((i) => i.status === value));
      }
      return Promise.resolve([]);
    }),
    delete: vi.fn((storeName: string, id: string) => {
      if (storeName === 'outbox') delete _outboxStore[id];
      if (storeName === 'photos') delete _photoStore[id];
      if (storeName === 'snag_audits') delete _snagStore[id];
      return Promise.resolve();
    }),
  };

  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(mockDb),
  };
});

function clearStores() {
  Object.keys(_outboxStore).forEach((k) => delete _outboxStore[k]);
  Object.keys(_photoStore).forEach((k) => delete _photoStore[k]);
  Object.keys(_snagStore).forEach((k) => delete _snagStore[k]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('phase4.test.ts — Exponential Backoff & Attempt Capping', () => {
  beforeEach(() => clearStores());

  it('transient failure calculates exponential backoff and sets nextAttemptAt', async () => {
    const { enqueue, markFailed, getPending } = await import('./outbox');

    const item = await enqueue({
      id: 'backoff-1',
      tableName: 'snag_audits',
      action: 'INSERT',
      payload: { id: 'backoff-1' },
    });

    const now = Date.now();
    // 1st transient failure -> 2000ms delay (2s)
    await markFailed('backoff-1', 'Network timeout');

    const updated = _outboxStore['backoff-1'];
    expect(updated.status).toBe('pending');
    expect(updated.attempts).toBe(1);
    expect(updated.nextAttemptAt).toBeGreaterThanOrEqual(now + 1900);
    expect(updated.nextAttemptAt).toBeLessThanOrEqual(now + 2500);

    // getPending() should exclude items whose nextAttemptAt is in the future
    const pendingNow = await getPending();
    expect(pendingNow.find((i) => i.id === 'backoff-1')).toBeUndefined();
  });

  it('non-retryable error (e.g. RLS rejection) immediately transitions to permanent failed status', async () => {
    const { enqueue, markFailed, getFailed } = await import('./outbox');

    await enqueue({
      id: 'rls-permanent-1',
      tableName: 'snag_audits',
      action: 'INSERT',
      payload: { id: 'rls-permanent-1' },
    });

    await markFailed('rls-permanent-1', 'new row violates row-level security policy for table "snag_audits"');

    const failed = await getFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].id).toBe('rls-permanent-1');
    expect(failed[0].status).toBe('failed');
    expect(failed[0].nextAttemptAt).toBeUndefined();
  });

  it('reaching maxAttempts (5) transitions item to permanent failed status', async () => {
    const { enqueue, markFailed, getFailed } = await import('./outbox');

    await enqueue({
      id: 'max-attempts-1',
      tableName: 'snag_audits',
      action: 'INSERT',
      payload: { id: 'max-attempts-1' },
    });

    // Simulate 4 transient failures
    for (let i = 0; i < 4; i++) {
      await markFailed('max-attempts-1', 'Connection reset', 5);
      expect(_outboxStore['max-attempts-1'].status).toBe('pending');
    }

    // 5th failure -> reaches maxAttempts = 5 -> permanent failed
    await markFailed('max-attempts-1', 'Connection reset', 5);

    const item = _outboxStore['max-attempts-1'];
    expect(item.status).toBe('failed');
    expect(item.attempts).toBe(5);
    expect(item.nextAttemptAt).toBeUndefined();

    expect(await getFailed()).toHaveLength(1);
  });
});

describe('phase4.test.ts — Manual Retry & Discard API', () => {
  beforeEach(() => clearStores());

  it('retryFailedItem resets failed status back to pending with 0 attempts', async () => {
    const { enqueue, markFailed, retryFailedItem, getPending } = await import('./outbox');

    await enqueue({
      id: 'retry-item-1',
      tableName: 'snag_audits',
      action: 'INSERT',
      payload: { id: 'retry-item-1' },
    });

    await markFailed('retry-item-1', 'Permanent error', 1);
    expect(_outboxStore['retry-item-1'].status).toBe('failed');

    await retryFailedItem('retry-item-1');

    const item = _outboxStore['retry-item-1'];
    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(0);
    expect(item.failureReason).toBeUndefined();
    expect(item.nextAttemptAt).toBeUndefined();

    const pending = await getPending();
    expect(pending.find((i) => i.id === 'retry-item-1')).toBeDefined();
  });

  it('discardFailedItem purges outbox item, photo, and IDB cache', async () => {
    const { enqueue, markFailed, discardFailedItem, getFailed } = await import('./outbox');

    _photoStore['photo-123'] = { id: 'photo-123', blob: new Blob(['test']) };
    _snagStore['discard-item-1'] = { id: 'discard-item-1', nameOfSite: 'Test' };

    await enqueue({
      id: 'discard-item-1',
      tableName: 'snag_audits',
      action: 'INSERT',
      payload: { id: 'discard-item-1' },
      photoId: 'photo-123',
    });

    await markFailed('discard-item-1', 'RLS error');
    expect(await getFailed()).toHaveLength(1);

    await discardFailedItem('discard-item-1');

    expect(_outboxStore['discard-item-1']).toBeUndefined();
    expect(_photoStore['photo-123']).toBeUndefined();
    expect(_snagStore['discard-item-1']).toBeUndefined();
  });
});

describe('phase4.test.ts — Batch Photo Upload Throttling', () => {
  it('throttleUploads limits concurrent async task execution to concurrency limit (2)', async () => {
    const { throttleUploads } = await import('./syncEngine');

    let activeWorkers = 0;
    let maxObservedWorkers = 0;

    const createTask = (id: number) => async () => {
      activeWorkers++;
      maxObservedWorkers = Math.max(maxObservedWorkers, activeWorkers);
      await new Promise((resolve) => setTimeout(resolve, 20));
      activeWorkers--;
      return `result-${id}`;
    };

    const tasks = [createTask(1), createTask(2), createTask(3), createTask(4), createTask(5)];

    const results = await throttleUploads(tasks, 2);

    expect(results).toEqual(['result-1', 'result-2', 'result-3', 'result-4', 'result-5']);
    expect(maxObservedWorkers).toBeLessThanOrEqual(2);
  });
});
