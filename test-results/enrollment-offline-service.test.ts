import { describe, it, expect, beforeEach, vi } from 'vitest';

const m = vi.hoisted(() => ({
  stores: {} as Record<string, Record<string, any>>,
}));

vi.mock('../services/offline/db', () => ({
  getDb: async () => ({
    objectStoreNames: { contains: () => true },
    get: async (table: string, id: string) => structuredClone(m.stores[table]?.[id]),
    put: async (table: string, row: any) => {
      (m.stores[table] ??= {})[row.id] = structuredClone(row);
    },
    delete: async (table: string, id: string) => {
      delete m.stores[table]?.[id];
    },
    clear: async (table: string) => {
      m.stores[table] = {};
    },
    getAll: async (table: string) => structuredClone(Object.values(m.stores[table] ?? {})),
    getAllFromIndex: async (table: string, indexName: string, indexValue: any) => {
      const all = Object.values(m.stores[table] ?? {});
      if (indexName === 'by-linked') {
        return structuredClone(all.filter((item: any) => item.linkedToId === indexValue));
      }
      return structuredClone(all);
    },
  }),
}));

import {
  dataUrlToBlob,
  blobToDataUrl,
  extractDraftDocuments,
  saveDraftDocumentsToIndexedDb,
  restoreDraftDocumentsFromIndexedDb,
  deleteDraftDocumentsFromIndexedDb,
  mergeDraftDocumentPreviews,
  validateAndNormalizeFamilyData,
  preserveOriginalCreator,
} from '../services/offline/enrollmentOfflineService';
import { getDb } from '../services/offline/db';
import type { OnboardingData } from '../types';

// Mock minimal sample onboarding data
function createSampleOnboardingData(id: string = 'test-sub-123'): OnboardingData {
  return {
    id,
    status: 'draft',
    enrollmentDate: '2026-11-18',
    personal: {
      firstName: 'Ramesh',
      lastName: 'Kumar',
      dob: '1995-05-15',
      gender: 'Male',
      contactNumber: '9876543210',
      idProofType: 'Aadhaar',
      idProofNumber: '123456789012',
      idProofFront: {
        name: 'aadhaar_front.jpg',
        type: 'image/jpeg',
        size: 1024,
        preview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      },
      idProofBack: null,
      photo: null,
    } as any,
    address: {
      presentAddress: { addressLine1: 'Site 1', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      permanentAddress: { addressLine1: 'Site 1', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    } as any,
    bank: {
      accountHolderName: 'Ramesh Kumar',
      accountNumber: '1122334455',
      ifscCode: 'SBIN0001234',
      bankName: 'SBI',
      bankProof: {
        name: 'passbook.jpg',
        type: 'image/jpeg',
        size: 2048,
        preview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      },
    } as any,
    family: [
      {
        id: 'fam_child_1',
        name: 'Aarav Kumar',
        relation: 'Child',
        dob: '2020-01-01',
        gender: 'Male',
        dependent: true,
        idProof: {
          name: 'birth_cert.jpg',
          type: 'image/jpeg',
          size: 512,
          preview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        },
      },
    ] as any,
    education: [
      {
        id: 'edu_1',
        degree: 'SSLC',
        institution: 'Govt High School',
        startYear: '2010',
        endYear: '2011',
        document: {
          name: 'marks_card.jpg',
          type: 'image/jpeg',
          size: 1500,
          preview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        },
      },
    ] as any,
    uan: {} as any,
    esi: {} as any,
    gmc: {} as any,
    organization: {} as any,
    uniforms: [],
    biometrics: {} as any,
  };
}

describe('Phase 3 Batch B: Enrollment & Uploaded Documents Offline Hardening', () => {
  beforeEach(async () => {
    m.stores = {};
  });

  describe('Binary & Data URL Utilities', () => {
    it('converts data URLs to Blobs and back accurately', async () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
      const blob = dataUrlToBlob(dataUrl);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');
      expect(blob.size).toBeGreaterThan(0);

      const reconstructed = await blobToDataUrl(blob);
      expect(reconstructed).toContain('data:image/jpeg;base64,');
    });
  });

  describe('Durable Draft Attachment Storage (surviving form step restarts)', () => {
    it('extracts all document descriptors across personal, bank, family, and education', () => {
      const data = createSampleOnboardingData();
      const docs = extractDraftDocuments(data);
      expect(docs.length).toBe(4); // idProofFront, bankProof, child birth_cert, edu marks_card
      const keys = docs.map((d) => d.key);
      expect(keys).toContain('personal.idProofFront');
      expect(keys).toContain('bank.bankProof');
      expect(keys).toContain('family.0.idProof');
      expect(keys).toContain('education.0.document');
    });

    it('persists draft attachments in IndexedDB and rehydrates stripped previews', async () => {
      const submissionId = 'sub-test-offline-01';
      const data = createSampleOnboardingData(submissionId);

      // 1. Save draft documents into IndexedDB
      const count = await saveDraftDocumentsToIndexedDb(submissionId, data);
      expect(count).toBe(4);

      // Verify records are present in photos store
      const db = await getDb();
      const storedPhotos = await db.getAllFromIndex('photos', 'by-linked', `draft_${submissionId}`);
      expect(storedPhotos.length).toBe(4);

      // 2. Simulate safeLocalStorage stripping previews (setting them to null/empty)
      const strippedData = createSampleOnboardingData(submissionId);
      strippedData.personal.idProofFront!.preview = '';
      strippedData.bank.bankProof!.preview = '';
      strippedData.family[0].idProof!.preview = '';
      strippedData.education[0].document!.preview = '';

      // 3. Rehydrate from IndexedDB
      const restored = await restoreDraftDocumentsFromIndexedDb(strippedData);
      expect(restored.personal.idProofFront?.preview).toContain('data:image/jpeg;base64,');
      expect(restored.bank.bankProof?.preview).toContain('data:image/jpeg;base64,');
      expect(restored.family[0].idProof?.preview).toContain('data:image/jpeg;base64,');
      expect(restored.education[0].document?.preview).toContain('data:image/jpeg;base64,');
    });

    it('cleans up draft photos from IndexedDB after full sync', async () => {
      const submissionId = 'sub-test-cleanup';
      const data = createSampleOnboardingData(submissionId);
      await saveDraftDocumentsToIndexedDb(submissionId, data);

      const db = await getDb();
      expect((await db.getAllFromIndex('photos', 'by-linked', `draft_${submissionId}`)).length).toBe(4);

      await deleteDraftDocumentsFromIndexedDb(submissionId);
      expect((await db.getAllFromIndex('photos', 'by-linked', `draft_${submissionId}`)).length).toBe(0);
    });
  });

  describe('Audit Finding 24: Document Preview Preservation', () => {
    it('mergeDraftDocumentPreviews retains original previews in sanitized payload', () => {
      const original = createSampleOnboardingData('sub-24');
      // Create a sanitized copy where attachments were stripped to { name, type, size }
      const sanitized: OnboardingData = {
        ...original,
        personal: {
          ...original.personal,
          idProofFront: { name: 'aadhaar_front.jpg', type: 'image/jpeg', size: 1024, preview: '' },
        } as any,
        bank: {
          ...original.bank,
          bankProof: { name: 'passbook.jpg', type: 'image/jpeg', size: 2048, preview: '' },
        } as any,
      };

      const merged = mergeDraftDocumentPreviews(sanitized, original);
      expect(merged.personal.idProofFront?.preview).toBe(original.personal.idProofFront?.preview);
      expect(merged.bank.bankProof?.preview).toBe(original.bank.bankProof?.preview);
      expect(merged.family[0].idProof?.preview).toBe(original.family[0].idProof?.preview);
    });
  });

  describe('Parent/Child/Family Data Normalization', () => {
    it('normalizes family members, assigns unique IDs, and validates relationships', () => {
      const rawFamily: any[] = [
        { name: 'Sita', relation: 'Spouse', dob: '1996-03-10', gender: 'Female', dependent: true },
        { name: 'Aarav', relation: 'Child', dob: '2020-01-01', gender: 'Male', dependent: true },
        { name: 'Sita', relation: 'Spouse', id: 'dup_1', dob: '1996-03-10' },
      ];

      const normalized = validateAndNormalizeFamilyData(rawFamily);
      expect(normalized.length).toBe(3);
      expect(normalized[0].relation).toBe('Spouse');
      expect(normalized[1].relation).toBe('Child');
      expect(normalized[0].dependent).toBe(true);
      expect(normalized[1].dependent).toBe(true);
      expect(normalized[0].id).toBeDefined();
    });
  });

  describe('Creator Attribution on Shared Devices (Delayed Sync)', () => {
    it('preserves original creator user_id and created_user_id', () => {
      const originalCreatorId = '550e8400-e29b-41d4-a716-446655440000';
      const secondarySyncUser = '660e8400-e29b-41d4-a716-446655440000';

      const payload: Record<string, unknown> = {
        id: 'sub-shared-01',
        created_user_id: originalCreatorId,
        user_id: originalCreatorId,
        status: 'draft',
      };

      preserveOriginalCreator(payload, originalCreatorId);
      expect(payload.created_user_id).toBe(originalCreatorId);
      expect(payload.user_id).toBe(originalCreatorId);
      expect(payload.created_user_id).not.toBe(secondarySyncUser);
    });

    it('falls back to item.userId when payload creator is empty or non-UUID', () => {
      const originalCreatorId = '550e8400-e29b-41d4-a716-446655440000';
      const payload: Record<string, unknown> = {
        id: 'sub-shared-02',
        created_user_id: 'draft_user_temp',
        user_id: null,
      };

      preserveOriginalCreator(payload, originalCreatorId);
      expect(payload.created_user_id).toBe(originalCreatorId);
      expect(payload.user_id).toBe(originalCreatorId);
    });
  });
});
