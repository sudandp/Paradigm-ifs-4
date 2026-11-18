/**
 * Enrollment & Document Offline Service — Paradigm Mobile Hardening (Phase 3 Batch B)
 *
 * Provides:
 * 1. Durable draft attachment persistence in IndexedDB (survives form step navigation & app restarts).
 * 2. Rehydration of draft attachments upon app resume or page reload.
 * 3. Prevention of online cache overwrite (Audit Finding 24).
 * 4. Preservation of parent/child/family data structures across delayed sync.
 * 5. Immutable original creator attribution across user switches on shared devices.
 */

import { getDb, type StoredPhoto } from './db';
import type { OnboardingData, FamilyMember, UploadedFile } from '../../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── 1. Binary / Data URL Conversion Helpers ─────────────────────────────────

export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.warn('[EnrollmentOffline] Failed to convert data URL to Blob:', err);
    return new Blob([], { type: 'image/jpeg' });
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const mime = blob.type || 'image/jpeg';
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader did not return a string'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  // Node / SSR / headless fallback
  const buffer = await blob.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${mime};base64,${base64}`;
}

// ─── 2. Durable Draft Attachment Persistence (IndexedDB) ──────────────────────

export interface DraftDocDescriptor {
  key: string;            // Deterministic key, e.g. "personal.idProofFront"
  blob: Blob;
  fileName: string;
  payloadPath: string;
}

/**
 * Traverses an OnboardingData structure to find all uploaded files, blobs, or data URLs.
 */
export function extractDraftDocuments(data: OnboardingData): DraftDocDescriptor[] {
  const descriptors: DraftDocDescriptor[] = [];

  const checkAndAdd = (fileObj: UploadedFile | null | undefined, key: string, payloadPath: string) => {
    if (!fileObj || typeof fileObj !== 'object') return;

    let blob: Blob | null = null;
    if (typeof File !== 'undefined' && (fileObj as any).file instanceof File) {
      blob = (fileObj as any).file;
    } else if (fileObj.preview && typeof fileObj.preview === 'string' && fileObj.preview.startsWith('data:')) {
      blob = dataUrlToBlob(fileObj.preview);
    } else if ((fileObj as any).url && typeof (fileObj as any).url === 'string' && (fileObj as any).url.startsWith('data:')) {
      blob = dataUrlToBlob((fileObj as any).url);
    }

    if (blob && blob.size > 0) {
      descriptors.push({
        key,
        blob,
        fileName: fileObj.name || `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`,
        payloadPath,
      });
    }
  };

  // 1. Personal documents
  if (data.personal) {
    checkAndAdd(data.personal.idProofFront, 'personal.idProofFront', 'personal.id_proof_front');
    checkAndAdd(data.personal.idProofBack, 'personal.idProofBack', 'personal.id_proof_back');
    checkAndAdd(data.personal.photo, 'personal.photo', 'personal.photo');
  }

  // 2. Bank documents
  if (data.bank) {
    checkAndAdd(data.bank.bankProof, 'bank.bankProof', 'bank.bank_proof');
  }

  // 3. UAN / ESI / GMC documents
  if (data.uan) {
    checkAndAdd(data.uan.salarySlip, 'uan.salarySlip', 'uan.salary_slip');
    checkAndAdd(data.uan.document, 'uan.document', 'uan.document');
  }
  if (data.esi) {
    checkAndAdd(data.esi.document, 'esi.document', 'esi.document');
  }
  if (data.gmc) {
    checkAndAdd(data.gmc.gmcPolicyCopy, 'gmc.gmcPolicyCopy', 'gmc.gmc_policy_copy');
  }

  // 4. Education certificates
  if (Array.isArray(data.education)) {
    data.education.forEach((edu, index) => {
      checkAndAdd(edu.document, `education.${index}.document`, `education.${index}.document`);
    });
  }

  // 5. Family member ID proofs (Parent / Child / Spouse)
  if (Array.isArray(data.family)) {
    data.family.forEach((member, index) => {
      checkAndAdd(member.idProof, `family.${index}.idProof`, `family.${index}.id_proof`);
    });
  }

  return descriptors;
}

/**
 * Saves all binary document attachments for a draft into IndexedDB `photos` store.
 * Prevents loss of files when localStorage clears heavy base64 strings or upon app restart.
 */
export async function saveDraftDocumentsToIndexedDb(
  submissionId: string,
  data: OnboardingData
): Promise<number> {
  const descriptors = extractDraftDocuments(data);
  if (descriptors.length === 0) return 0;

  try {
    const db = await getDb();
    const linkedToId = `draft_${submissionId}`;

    for (const doc of descriptors) {
      const photoId = `draft_${submissionId}_${doc.key}`;
      const storedPhoto: StoredPhoto = {
        id: photoId,
        blob: doc.blob,
        fileName: doc.fileName,
        linkedToId,
        createdAt: Date.now(),
      };
      await db.put('photos', storedPhoto);
    }
    return descriptors.length;
  } catch (err) {
    console.warn('[EnrollmentOffline] Failed to persist draft documents to IndexedDB:', err);
    return 0;
  }
}

/**
 * Rehydrates document attachments from IndexedDB into an OnboardingData draft.
 * If preview/url was stripped by safeLocalStorage, restores it from the persistent Blob in IndexedDB.
 */
export async function restoreDraftDocumentsFromIndexedDb(
  data: OnboardingData
): Promise<OnboardingData> {
  if (!data || !data.id) return data;
  const submissionId = data.id;

  try {
    const db = await getDb();
    const linkedToId = `draft_${submissionId}`;
    const allPhotos = await db.getAllFromIndex('photos', 'by-linked', linkedToId);
    if (!allPhotos || allPhotos.length === 0) return data;

    const photoMap = new Map<string, StoredPhoto>();
    for (const p of allPhotos) {
      photoMap.set(p.id, p);
    }

    const rehydrateDoc = async (
      fileObj: UploadedFile | null | undefined,
      key: string
    ): Promise<UploadedFile | null | undefined> => {
      const photoId = `draft_${submissionId}_${key}`;
      const stored = photoMap.get(photoId);
      if (!stored) return fileObj;

      // If preview is already present and valid, retain it
      if (fileObj && fileObj.preview && fileObj.preview.length > 32) {
        return fileObj;
      }

      // Convert stored Blob back to displayable data URL
      try {
        const dataUrl = await blobToDataUrl(stored.blob);
        return {
          name: fileObj?.name || stored.fileName,
          type: fileObj?.type || stored.blob.type || 'image/jpeg',
          size: fileObj?.size || stored.blob.size,
          preview: dataUrl,
          url: fileObj?.url || dataUrl,
          path: fileObj?.path || null,
        };
      } catch {
        return fileObj;
      }
    };

    const cloned: OnboardingData = JSON.parse(JSON.stringify(data));

    if (cloned.personal) {
      cloned.personal.idProofFront = (await rehydrateDoc(cloned.personal.idProofFront, 'personal.idProofFront')) || null;
      cloned.personal.idProofBack = (await rehydrateDoc(cloned.personal.idProofBack, 'personal.idProofBack')) || null;
      cloned.personal.photo = (await rehydrateDoc(cloned.personal.photo, 'personal.photo')) || null;
    }
    if (cloned.bank) {
      cloned.bank.bankProof = (await rehydrateDoc(cloned.bank.bankProof, 'bank.bankProof')) || null;
    }
    if (cloned.uan) {
      cloned.uan.salarySlip = (await rehydrateDoc(cloned.uan.salarySlip, 'uan.salarySlip')) || null;
      cloned.uan.document = (await rehydrateDoc(cloned.uan.document, 'uan.document')) || null;
    }
    if (cloned.esi) {
      cloned.esi.document = (await rehydrateDoc(cloned.esi.document, 'esi.document')) || null;
    }
    if (cloned.gmc) {
      cloned.gmc.gmcPolicyCopy = (await rehydrateDoc(cloned.gmc.gmcPolicyCopy, 'gmc.gmcPolicyCopy')) || null;
    }
    if (Array.isArray(cloned.education)) {
      for (let i = 0; i < cloned.education.length; i++) {
        cloned.education[i].document = (await rehydrateDoc(cloned.education[i].document, `education.${i}.document`)) || null;
      }
    }
    if (Array.isArray(cloned.family)) {
      for (let i = 0; i < cloned.family.length; i++) {
        cloned.family[i].idProof = (await rehydrateDoc(cloned.family[i].idProof, `family.${i}.idProof`)) || null;
      }
    }

    return cloned;
  } catch (err) {
    console.warn('[EnrollmentOffline] Failed to rehydrate draft documents from IndexedDB:', err);
    return data;
  }
}

/**
 * Removes local draft document photos once a submission is fully synced.
 */
export async function deleteDraftDocumentsFromIndexedDb(submissionId: string): Promise<void> {
  try {
    const db = await getDb();
    const linkedToId = `draft_${submissionId}`;
    const allPhotos = await db.getAllFromIndex('photos', 'by-linked', linkedToId);
    for (const p of allPhotos) {
      await db.delete('photos', p.id);
    }
  } catch (err) {
    console.warn('[EnrollmentOffline] Failed to clean up draft photos from IndexedDB:', err);
  }
}

// ─── 3. Local Attachment & Preview Merging (Fix for Audit Finding 24) ─────────

/**
 * Merges original local file previews and blobs into a sanitized payload so that
 * when offlineDbData is stored locally, document thumbnails remain viewable.
 */
export function mergeDraftDocumentPreviews(
  sanitized: OnboardingData,
  original: OnboardingData
): OnboardingData {
  if (!sanitized || !original) return sanitized || original;

  const merged = { ...sanitized };

  const mergeFile = (sanDoc: any, origDoc: any) => {
    if (!origDoc) return sanDoc;
    if (!sanDoc) return origDoc;
    return {
      ...sanDoc,
      preview: origDoc.preview || origDoc.url || sanDoc.preview || sanDoc.url,
      url: origDoc.url || origDoc.preview || sanDoc.url || sanDoc.preview,
      file: origDoc.file || sanDoc.file,
    };
  };

  if (merged.personal && original.personal) {
    merged.personal = {
      ...merged.personal,
      idProofFront: mergeFile(merged.personal.idProofFront, original.personal.idProofFront),
      idProofBack: mergeFile(merged.personal.idProofBack, original.personal.idProofBack),
      photo: mergeFile(merged.personal.photo, original.personal.photo),
    };
  }

  if (merged.bank && original.bank) {
    merged.bank = {
      ...merged.bank,
      bankProof: mergeFile(merged.bank.bankProof, original.bank.bankProof),
    };
  }

  if (merged.uan && original.uan) {
    merged.uan = {
      ...merged.uan,
      salarySlip: mergeFile(merged.uan.salarySlip, original.uan.salarySlip),
      document: mergeFile(merged.uan.document, original.uan.document),
    };
  }

  if (merged.esi && original.esi) {
    merged.esi = {
      ...merged.esi,
      document: mergeFile(merged.esi.document, original.esi.document),
    };
  }

  if (merged.gmc && original.gmc) {
    merged.gmc = {
      ...merged.gmc,
      gmcPolicyCopy: mergeFile(merged.gmc.gmcPolicyCopy, original.gmc.gmcPolicyCopy),
    };
  }

  if (Array.isArray(merged.education) && Array.isArray(original.education)) {
    merged.education = merged.education.map((edu, idx) => ({
      ...edu,
      document: mergeFile(edu.document, original.education[idx]?.document),
    }));
  }

  if (Array.isArray(merged.family) && Array.isArray(original.family)) {
    merged.family = merged.family.map((fam, idx) => ({
      ...fam,
      idProof: mergeFile(fam.idProof, original.family[idx]?.idProof),
    }));
  }

  return merged;
}

// ─── 4. Parent/Child/Family Data Normalization & Creator Attribution ──────────

/**
 * Validates and normalizes family data (parents, spouse, children) before persistence
 * or synchronization. Ensures deduplication, valid relationships, and dependent flags.
 */
export function validateAndNormalizeFamilyData(family: FamilyMember[]): FamilyMember[] {
  if (!Array.isArray(family)) return [];

  const seenIds = new Set<string>();
  const normalized: FamilyMember[] = [];

  for (const member of family) {
    if (!member || typeof member !== 'object') continue;

    const id = member.id || `fam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    normalized.push({
      id,
      name: (member.name || '').trim(),
      relation: member.relation || '',
      dob: member.dob || '',
      gender: member.gender || '',
      occupation: member.occupation || '',
      dependent: Boolean(member.dependent),
      idProof: member.idProof || null,
      phone: member.phone || '',
    });
  }

  return normalized;
}

/**
 * Preserves the original creator attribution (user_id and created_user_id)
 * so that when delayed synchronization drains on a shared device under a different user,
 * original creator attribution is never overwritten.
 */
export function preserveOriginalCreator(
  payload: Record<string, unknown>,
  itemUserId?: string
): void {
  const currentCreator = payload.created_user_id || payload.createdUserId;
  const currentUserId = payload.user_id || payload.userId;

  const validOriginal = (currentCreator && typeof currentCreator === 'string' && UUID_REGEX.test(currentCreator))
    ? currentCreator
    : (itemUserId && UUID_REGEX.test(itemUserId) ? itemUserId : null);

  if (validOriginal) {
    payload.created_user_id = validOriginal;
    if (!payload.user_id || !UUID_REGEX.test(payload.user_id as string)) {
      payload.user_id = validOriginal;
    }
  }
}
