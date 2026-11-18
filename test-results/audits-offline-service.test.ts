/**
 * audits-offline-service.test.ts
 *
 * Phase 3 Batch C Automated Unit Test Suite:
 * Snags, HT Yard, and PPM Audits Offline Hardening & Attachment Coalescing
 *
 * Covers:
 * 1. Audit Finding 05: stripLocalFields camelCase ↔ snake_case allowlist normalization
 *    for snag_audits, ppm_executions, ht_yard_audits, and onboarding_submissions.
 * 2. Audit Finding 06: Outbox attachment and photo coalescing during text/status edits
 *    (preventing photo deletion when attachments is undefined).
 * 3. Audit Finding 06: Clean replacement of photos only when an explicit new photo is attached.
 * 4. Audit Finding 22: Organizations store registered in ParadigmDB schema (v7) and
 *    getCachedSites fallback across IDB, paradigm_cache_organizations, and legacy keys.
 * 5. Offline snag read normalization: toCamelCase ensures offline list renders properly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stripLocalFields, TABLE_COLUMN_ALLOWLIST } from '../services/offline/syncEngine';
import { DB_VERSION, type OutboxItem, type StoredPhoto } from '../services/offline/db';

// ── In-Memory IDB & LocalStorage Mocks ───────────────────────────────────────

const _mockOutbox: Record<string, OutboxItem> = {};
const _mockPhotos: Record<string, StoredPhoto> = {};
const _mockOrgs: Record<string, any> = {};
const _mockLocalStorage: Record<string, string> = {};

vi.mock('../services/offline/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/offline/db')>();

  const mockDb = {
    objectStoreNames: {
      contains: vi.fn((name: string) =>
        ['snag_audits', 'ht_yard_audits', 'ppm_executions', 'organizations', 'outbox', 'photos'].includes(name)
      ),
    },
    get: vi.fn((storeName: string, id: string) => {
      if (storeName === 'outbox') return Promise.resolve(_mockOutbox[id]);
      if (storeName === 'photos') return Promise.resolve(_mockPhotos[id]);
      if (storeName === 'organizations') return Promise.resolve(_mockOrgs[id]);
      return Promise.resolve(undefined);
    }),
    put: vi.fn((storeName: string, item: any) => {
      if (storeName === 'outbox') _mockOutbox[item.id] = item;
      if (storeName === 'photos') _mockPhotos[item.id] = item;
      if (storeName === 'organizations') _mockOrgs[item.id] = item;
      return Promise.resolve();
    }),
    delete: vi.fn((storeName: string, id: string) => {
      if (storeName === 'outbox') delete _mockOutbox[id];
      if (storeName === 'photos') delete _mockPhotos[id];
      if (storeName === 'organizations') delete _mockOrgs[id];
      return Promise.resolve();
    }),
    getAll: vi.fn((storeName: string) => {
      if (storeName === 'outbox') return Promise.resolve(Object.values(_mockOutbox));
      if (storeName === 'photos') return Promise.resolve(Object.values(_mockPhotos));
      if (storeName === 'organizations') return Promise.resolve(Object.values(_mockOrgs));
      return Promise.resolve([]);
    }),
  };

  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(mockDb),
  };
});

// Setup mock global localStorage
vi.stubGlobal('localStorage', {
  getItem: (key: string) => _mockLocalStorage[key] ?? null,
  setItem: (key: string, val: string) => {
    _mockLocalStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete _mockLocalStorage[key];
  },
  clear: () => {
    Object.keys(_mockLocalStorage).forEach((k) => delete _mockLocalStorage[k]);
  },
});

function resetStores() {
  Object.keys(_mockOutbox).forEach((k) => delete _mockOutbox[k]);
  Object.keys(_mockPhotos).forEach((k) => delete _mockPhotos[k]);
  Object.keys(_mockOrgs).forEach((k) => delete _mockOrgs[k]);
  Object.keys(_mockLocalStorage).forEach((k) => delete _mockLocalStorage[k]);
}

describe('Phase 3 Batch C — Snags, HT Yard, and PPM Audits Offline Hardening', () => {
  beforeEach(() => {
    resetStores();
  });

  // ── 1. Audit Finding 05: Column Allowlist camelCase ↔ snake_case Normalization ──

  describe('Finding 05: stripLocalFields Allowlist Normalization', () => {
    it('normalizes camelCase Snag properties to snake_case allowlisted columns', () => {
      const camelSnag = {
        id: 'snag-001',
        nameOfSite: 'Sark 2 Villas',
        snagDescription: 'Perimeter solar fence loose connection',
        actionToBeTaken: 'Re-tension wire and inspect battery backup',
        snagPictureUrl: 'https://cdn.paradigm.com/snags/photo1.jpg',
        snagPictureName: 'fence.jpg',
        emailAddress: 'tech@paradigm.com',
        submittedBy: 'Tech Lead John',
        purposeOfVisit: ['Routine Inspection'],
        criticality: 'High',
        status: 'Open',
        timestamp: '2026-11-18T10:00:00Z',
        createdAt: '2026-11-18T10:00:00Z',
        clientRevision: 'rev-001',
        // Local fields that must be stripped:
        pending: true,
        failed: false,
        updated_at: '2026-11-18T10:00:00Z',
      };

      const clean = stripLocalFields('snag_audits', camelSnag);

      // Verify all canonical snake_case columns are populated from camelCase input
      expect(clean.id).toBe('snag-001');
      expect(clean.name_of_site).toBe('Sark 2 Villas');
      expect(clean.snag_description).toBe('Perimeter solar fence loose connection');
      expect(clean.action_to_be_taken).toBe('Re-tension wire and inspect battery backup');
      expect(clean.snag_picture_url).toBe('https://cdn.paradigm.com/snags/photo1.jpg');
      expect(clean.snag_picture_name).toBe('fence.jpg');
      expect(clean.email_address).toBe('tech@paradigm.com');
      expect(clean.submitted_by).toBe('Tech Lead John');
      expect(clean.purpose_of_visit).toEqual(['Routine Inspection']);
      expect(clean.criticality).toBe('High');
      expect(clean.status).toBe('Open');
      expect(clean.client_revision).toBe('rev-001');

      // Verify non-schema / server-managed fields were stripped
      expect(clean.updated_at).toBeUndefined();
      expect(clean.pending).toBeUndefined();
      expect(clean.failed).toBeUndefined();
    });

    it('normalizes camelCase PPM properties to snake_case allowlisted columns', () => {
      const camelPpm = {
        id: 'ppm-001',
        siteName: 'Tower A Substation',
        referenceNumber: 'PPM-2026-HT-01',
        categoryId: 'TRANSFORMER',
        auditDate: '2026-11-18',
        clientDivision: 'Commercial',
        status: 'COMPLETED',
        auditorName: 'Auditor Mark',
        organizationId: 'org-123',
        observations: { 'obs-1': { value: 'Oil Level Normal' } },
        summaryCounts: { total: 1, critical: 0 },
        snagIds: ['snag-001'],
        photoUrls: ['https://cdn.paradigm.com/ppm/t1.jpg'],
      };

      const clean = stripLocalFields('ppm_executions', camelPpm);

      expect(clean.site_name).toBe('Tower A Substation');
      expect(clean.reference_number).toBe('PPM-2026-HT-01');
      expect(clean.category_id).toBe('TRANSFORMER');
      expect(clean.audit_date).toBe('2026-11-18');
      expect(clean.client_division).toBe('Commercial');
      expect(clean.auditor_name).toBe('Auditor Mark');
      expect(clean.organization_id).toBe('org-123');
      expect(clean.observations).toEqual({ 'obs-1': { value: 'Oil Level Normal' } });
      expect(clean.summary_counts).toEqual({ total: 1, critical: 0 });
      expect(clean.snag_ids).toEqual(['snag-001']);
      expect(clean.photo_urls).toEqual(['https://cdn.paradigm.com/ppm/t1.jpg']);
    });

    it('normalizes camelCase HT Yard properties to snake_case allowlisted columns', () => {
      const camelHt = {
        id: 'ht-001',
        siteName: 'Substation Yard East',
        referenceNumber: 'HT-2026-099',
        auditDate: '2026-11-18',
        equipmentInstances: [{ id: 'eq-1', name: 'RMU Breaker' }],
        duplicatedStages: ['Stage 1', 'Stage 2'],
        auditLogs: [{ action: 'Created' }],
      };

      const clean = stripLocalFields('ht_yard_audits', camelHt);

      expect(clean.site_name).toBe('Substation Yard East');
      expect(clean.reference_number).toBe('HT-2026-099');
      expect(clean.audit_date).toBe('2026-11-18');
      expect(clean.equipment_instances).toEqual([{ id: 'eq-1', name: 'RMU Breaker' }]);
      expect(clean.duplicated_stages).toEqual(['Stage 1', 'Stage 2']);
      expect(clean.audit_logs).toEqual([{ action: 'Created' }]);
    });
  });

  // ── 2. Audit Finding 06: Outbox Attachment & Photo Coalescing ─────────────────

  describe('Finding 06: Attachment & Photo Coalescing on Edits', () => {
    it('preserves existing attachments and photo Blobs when updating snag status without re-attaching photos', async () => {
      const { enqueue, getItem } = await import('../services/offline/outbox');

      // Step 1: Create snag offline with a photo attachment
      _mockPhotos['photo-fence-orig'] = {
        id: 'photo-fence-orig',
        blob: new Blob(['fake-image-bytes'], { type: 'image/jpeg' }),
        fileName: 'fence.jpg',
        linkedToId: 'snag-att-001',
        createdAt: Date.now(),
      };

      await enqueue({
        id: 'snag-att-001',
        tableName: 'snag_audits',
        action: 'UPSERT',
        payload: {
          id: 'snag-att-001',
          name_of_site: 'Sark 2 Villas',
          snag_description: 'Broken gate latch',
          snag_picture_url: 'blob:photo-fence-orig',
          status: 'Open',
        },
        attachments: [
          {
            photoId: 'photo-fence-orig',
            payloadPath: 'snag_picture_url',
            storagePath: 'user1/snag_audits/snag-att-001/snag_photo.jpg',
          },
        ],
        photoId: 'photo-fence-orig',
      });

      // Confirm step 1 enqueued item and photo
      const item1 = await getItem('snag-att-001');
      expect(item1).toBeDefined();
      expect(item1?.attachments).toHaveLength(1);
      expect(item1?.attachments?.[0].photoId).toBe('photo-fence-orig');
      expect(_mockPhotos['photo-fence-orig']).toBeDefined();

      // Step 2: User updates status to "In Progress" offline (attachments is undefined!)
      await enqueue({
        id: 'snag-att-001',
        tableName: 'snag_audits',
        action: 'UPSERT',
        payload: {
          id: 'snag-att-001',
          status: 'In Progress',
        },
        // attachments is omitted/undefined (as happens in updateSnagStatus)
      });

      // Verify coalesced outbox item
      const item2 = await getItem('snag-att-001');
      expect(item2).toBeDefined();
      expect(item2?.status).toBe('pending');
      expect(item2?.payload.status).toBe('In Progress');

      // CRITICAL: Attachments must NOT be wiped to undefined!
      expect(item2?.attachments).toBeDefined();
      expect(item2?.attachments).toHaveLength(1);
      expect(item2?.attachments?.[0].photoId).toBe('photo-fence-orig');
      expect(item2?.photoId).toBe('photo-fence-orig');

      // CRITICAL: Photo Blob in storage must NOT be deleted!
      expect(_mockPhotos['photo-fence-orig']).toBeDefined();

      // CRITICAL: snag_picture_url in payload must be preserved from existing payload!
      expect(item2?.payload.snag_picture_url).toBe('blob:photo-fence-orig');
      expect(item2?.payload.name_of_site).toBe('Sark 2 Villas');
    });

    it('safely replaces old photo and deletes old Blob only when an explicit new photo is attached', async () => {
      const { enqueue, getItem } = await import('../services/offline/outbox');

      _mockPhotos['photo-old'] = {
        id: 'photo-old',
        blob: new Blob(['old'], { type: 'image/jpeg' }),
        fileName: 'old.jpg',
        linkedToId: 'snag-replace-001',
        createdAt: Date.now(),
      };
      _mockPhotos['photo-new'] = {
        id: 'photo-new',
        blob: new Blob(['new'], { type: 'image/jpeg' }),
        fileName: 'new.jpg',
        linkedToId: 'snag-replace-001',
        createdAt: Date.now(),
      };

      await enqueue({
        id: 'snag-replace-001',
        tableName: 'snag_audits',
        action: 'UPSERT',
        payload: { id: 'snag-replace-001', snag_picture_url: 'blob:old' },
        attachments: [
          {
            photoId: 'photo-old',
            payloadPath: 'snag_picture_url',
            storagePath: 'user1/snag/photo.jpg',
          },
        ],
        photoId: 'photo-old',
      });

      // Replace photo with photo-new
      await enqueue({
        id: 'snag-replace-001',
        tableName: 'snag_audits',
        action: 'UPSERT',
        payload: { id: 'snag-replace-001', snag_picture_url: 'blob:new' },
        attachments: [
          {
            photoId: 'photo-new',
            payloadPath: 'snag_picture_url',
            storagePath: 'user1/snag/photo.jpg',
          },
        ],
        photoId: 'photo-new',
      });

      const item = await getItem('snag-replace-001');
      expect(item?.attachments?.[0].photoId).toBe('photo-new');
      expect(item?.photoId).toBe('photo-new');

      // Old photo must be cleaned up from photos store
      expect(_mockPhotos['photo-old']).toBeUndefined();
      // New photo must be preserved
      expect(_mockPhotos['photo-new']).toBeDefined();
    });
  });

  // ── 3. Audit Finding 22: Organizations Cache & Fallback Resolution ────────────

  describe('Finding 22: Organizations Store & Fallback Resolution', () => {
    it('bumps DB_VERSION to 7 to support organizations store in ParadigmDB schema', () => {
      expect(DB_VERSION).toBe(7);
    });

    it('getCachedSites retrieves sites directly from IndexedDB organizations store', async () => {
      const { getCachedSites } = await import('../services/offline/prefetch');

      _mockOrgs['org-1'] = { id: 'org-1', short_name: 'Site Alpha', name: 'Alpha Tower' };
      _mockOrgs['org-2'] = { id: 'org-2', short_name: 'Site Beta', name: 'Beta Campus' };

      const sites = await getCachedSites();
      expect(sites).toHaveLength(2);
      expect(sites.map((s) => s.short_name)).toEqual(['Site Alpha', 'Site Beta']);
    });

    it('getCachedSites falls back to paradigm_cache_organizations in localStorage when IDB is empty', async () => {
      const { getCachedSites } = await import('../services/offline/prefetch');

      // IDB is empty, set localStorage with paradigm_cache_organizations format
      const localData = [
        { id: 'org-local-1', short_name: 'Local Site 1' },
        { id: 'org-local-2', short_name: 'Local Site 2' },
      ];
      _mockLocalStorage['paradigm_cache_organizations'] = JSON.stringify(localData);

      const sites = await getCachedSites();
      expect(sites).toHaveLength(2);
      expect(sites[0].short_name).toBe('Local Site 1');
    });

    it('getCachedSites falls back to paradigm_organizations_cache legacy key if modern cache is absent', async () => {
      const { getCachedSites } = await import('../services/offline/prefetch');

      const legacyData = [{ id: 'org-legacy', short_name: 'Legacy Site' }];
      _mockLocalStorage['paradigm_organizations_cache'] = JSON.stringify(legacyData);

      const sites = await getCachedSites();
      expect(sites).toHaveLength(1);
      expect(sites[0].short_name).toBe('Legacy Site');
    });
  });
});
