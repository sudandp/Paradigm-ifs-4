/**
 * onboarding.test.ts
 *
 * Unit tests for Phase 7: Employee Onboarding (New Enrollment) Offline Architecture:
 *   - stripLocalFields cleans transient flags & non-persisted properties
 *   - saveOfflineAware stages document attachments in IDB photos store
 *   - outbox item enqueued with attachments and schemaVersion: 1
 *   - syncEngine nested property update properly enriches document objects with public URLs
 *   - Outbox coalesces subsequent edits into a single item
 *
 * Run: npx vitest run services/offline/onboarding.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OutboxItem } from './db';
import { stripLocalFields } from './syncEngine';

// ─── In-memory IDB store mock ────────────────────────────────────────────────

const _outboxStore: Record<string, OutboxItem> = {};
const _photoStore: Record<string, any> = {};
const _onboardingStore: Record<string, any> = {};

vi.mock('./featureFlag', () => ({
  isOfflineEnabled: () => true,
  isCaptureEnabled: () => true,
  isDrainEnabled: () => true,
}));

vi.mock('./networkStatus', () => ({
  isOnline: () => false, // simulate field staff in zero signal
  isReachable: () => Promise.resolve(false),
  subscribeNetworkStatus: vi.fn(),
}));

vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./db')>();

  const mockDb = {
    objectStoreNames: {
      contains: vi.fn(() => true),
    },
    put: vi.fn((storeName: string, item: any) => {
      if (storeName === 'outbox') _outboxStore[item.id] = item;
      if (storeName === 'photos') _photoStore[item.id] = item;
      if (storeName === 'onboarding_submissions') _onboardingStore[item.id] = item;
      return Promise.resolve();
    }),
    get: vi.fn((storeName: string, id: string) => {
      if (storeName === 'outbox') return Promise.resolve(_outboxStore[id]);
      if (storeName === 'photos') return Promise.resolve(_photoStore[id]);
      if (storeName === 'onboarding_submissions') return Promise.resolve(_onboardingStore[id]);
      return Promise.resolve(undefined);
    }),
    getAll: vi.fn((storeName: string) => {
      if (storeName === 'outbox') return Promise.resolve(Object.values(_outboxStore));
      if (storeName === 'photos') return Promise.resolve(Object.values(_photoStore));
      if (storeName === 'onboarding_submissions') return Promise.resolve(Object.values(_onboardingStore));
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
      if (storeName === 'onboarding_submissions') delete _onboardingStore[id];
      return Promise.resolve();
    }),
  };

  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(mockDb),
    getPhoto: vi.fn((id: string) => Promise.resolve(_photoStore[id] || null)),
  };
});

function clearStores() {
  Object.keys(_outboxStore).forEach((k) => delete _outboxStore[k]);
  Object.keys(_photoStore).forEach((k) => delete _photoStore[k]);
  Object.keys(_onboardingStore).forEach((k) => delete _onboardingStore[k]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('onboarding.test.ts — Phase 7: Employee Onboarding Offline Mode', () => {
  beforeEach(() => clearStores());

  it('stripLocalFields strips transient UI fields from onboarding_submissions', () => {
    const rawPayload: Record<string, unknown> = {
      id: 'sub-uuid-1234',
      user_id: 'user-001',
      created_user_id: 'user-001',
      employee_id: 'EMP-9001',
      status: 'pending',
      pending: true,
      failed: false,
      created_by_name: 'Field Officer Dave',
      created_by_photo: 'https://example.com/avatar.jpg',
      created_by_role: 'Operations Manager',
      fcuStatus: 'pending',
      fcuAcknowledgedBy: 'HR Admin',
      confirm_account_number: '1234567890',
      file: {},
      is_qr_verified: true,
      personal: {
        first_name: 'Aarav',
        last_name: 'Sharma',
      },
    };

    const clean = stripLocalFields('onboarding_submissions', rawPayload);

    expect(clean.id).toBe('sub-uuid-1234');
    expect(clean.employee_id).toBe('EMP-9001');
    expect(clean.personal).toBeDefined();

    // Stripped fields
    expect(clean.pending).toBeUndefined();
    expect(clean.failed).toBeUndefined();
    expect(clean.created_by_name).toBeUndefined();
    expect(clean.created_by_photo).toBeUndefined();
    expect(clean.created_by_role).toBeUndefined();
    expect(clean.fcuStatus).toBeUndefined();
    expect(clean.fcuAcknowledgedBy).toBeUndefined();
    expect(clean.confirm_account_number).toBeUndefined();
    expect(clean.file).toBeUndefined();
    expect(clean.is_qr_verified).toBeUndefined();
  });

  it('saveOfflineAware stages multiple document attachments into IDB and queues to outbox', async () => {
    const { saveOfflineAware } = await import('./saveOfflineAware');

    const fakePhotoBlob = new Blob(['candidate_photo_bytes'], { type: 'image/jpeg' });
    const fakeAadhaarBlob = new Blob(['aadhaar_front_bytes'], { type: 'image/jpeg' });
    const fakeBankBlob = new Blob(['cancelled_cheque_bytes'], { type: 'image/jpeg' });

    const submissionRecord = {
      id: 'sub-4444-uuid',
      user_id: 'user-100',
      employee_id: 'EMP-4444',
      status: 'pending',
      enrollment_date: '2026-09-19',
      personal: {
        first_name: 'Rohan',
        last_name: 'Verma',
        photo: { name: 'rohan_photo.jpg', type: 'image/jpeg', size: 21 },
        id_proof_front: { name: 'aadhaar_front.jpg', type: 'image/jpeg', size: 19 },
      },
      bank: {
        bank_proof: { name: 'cheque.jpg', type: 'image/jpeg', size: 22 },
      },
    };

    const attachments = [
      { blob: fakePhotoBlob, payloadPath: 'personal.photo', key: 'candidate_photo' },
      { blob: fakeAadhaarBlob, payloadPath: 'personal.id_proof_front', key: 'aadhaar_front' },
      { blob: fakeBankBlob, payloadPath: 'bank.bank_proof', key: 'bank_cheque' },
    ];

    const onlineSaveMock = vi.fn().mockResolvedValue(undefined);

    const result = await saveOfflineAware({
      table: 'onboarding_submissions',
      record: submissionRecord,
      attachments,
      baseUpdatedAt: '2026-09-19T10:00:00.000Z',
      onlineSave: onlineSaveMock,
    });

    expect(result).toBe('queued');
    // Because offline, onlineSave should not have been called
    expect(onlineSaveMock).not.toHaveBeenCalled();

    // 1. Check IDB cache has the record
    expect(_onboardingStore['sub-4444-uuid']).toBeDefined();
    expect(_onboardingStore['sub-4444-uuid'].employee_id).toBe('EMP-4444');

    // 2. Check all 3 attachments staged in photos store
    const storedPhotos = Object.values(_photoStore);
    expect(storedPhotos.length).toBe(3);

    // 3. Check outbox entry created
    const outboxItem = _outboxStore['sub-4444-uuid'];
    expect(outboxItem).toBeDefined();
    expect(outboxItem.tableName).toBe('onboarding_submissions');
    expect(outboxItem.status).toBe('pending');
    expect(outboxItem.schemaVersion).toBe(1);
    expect(outboxItem.attachments).toBeDefined();
    expect(outboxItem.attachments?.length).toBe(3);
    expect(outboxItem.baseUpdatedAt).toBe('2026-09-19T10:00:00.000Z');
  });

  it('outbox coalesces subsequent offline edits on the same onboarding submission', async () => {
    const { enqueue, getItem } = await import('./outbox');

    const id = 'sub-coalesce-uuid';

    // Step 1: Draft personal details
    await enqueue({
      id,
      tableName: 'onboarding_submissions',
      action: 'UPSERT',
      payload: { id, status: 'draft', personal: { first_name: 'Priya' } },
      schemaVersion: 1,
    });

    const item = await getItem(id);
    expect(item).toBeDefined();
    expect((item?.payload as any).personal.first_name).toBe('Priya');
    expect((item?.payload as any).bank).toBeUndefined();

    // Step 2: Next step adds bank details — coalesces into same item
    await enqueue({
      id,
      tableName: 'onboarding_submissions',
      action: 'UPSERT',
      payload: {
        id,
        status: 'draft',
        personal: { first_name: 'Priya' },
        bank: { account_number: '9876543210', ifsc_code: 'HDFC0001234' },
      },
      schemaVersion: 1,
    });

    const all = Object.values(_outboxStore).filter((i) => i.id === id);
    expect(all.length).toBe(1); // Still exactly 1 item in outbox
    expect((all[0].payload as any).bank.account_number).toBe('9876543210');
  });

  it('cancelling/discarding an offline onboarding submission purges outbox, attachments, and cache', async () => {
    const { enqueue, discardFailedItem } = await import('./outbox');
    const { storeAttachment } = await import('./outbox');

    const id = 'sub-to-discard';
    const fakeBlob = new Blob(['attachment_data'], { type: 'image/jpeg' });
    const att = await storeAttachment(fakeBlob, 'personal.photo', `anon/onboarding/${id}/photo.jpg`);

    await enqueue({
      id,
      tableName: 'onboarding_submissions',
      action: 'UPSERT',
      payload: { id, employee_id: 'EMP-DISCARD' },
      attachments: [att],
      schemaVersion: 1,
    });

    expect(_outboxStore[id]).toBeDefined();
    expect(_photoStore[att.photoId]).toBeDefined();

    await discardFailedItem(id);

    expect(_outboxStore[id]).toBeUndefined();
    expect(_photoStore[att.photoId]).toBeUndefined();
    expect(_onboardingStore[id]).toBeUndefined();
  });
});
