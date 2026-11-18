import type * as faceapi from '@vladmandic/face-api';
import { supabase } from './supabase';

import { normalizeFaceDescriptor } from './gateApi';

let matcherInstance: faceapi.FaceMatcher | null = null;

/**
 * Fetches all registered gate users and builds a FaceMatcher cache.
 */
export async function getFaceMatcher(threshold = 0.5): Promise<faceapi.FaceMatcher> {
  if (matcherInstance) return matcherInstance;
  return refreshMatcher(threshold);
}

/**
 * Re-fetches descriptors from Supabase and rebuilds the FaceMatcher.
 */
export async function refreshMatcher(threshold = 0.5): Promise<faceapi.FaceMatcher> {
  let rawUsers: Array<{ id: string; user_id?: string; face_descriptor: any }> = [];

  try {
    const { data, error } = await supabase
      .from('gate_users')
      .select('id, user_id, face_descriptor')
      .eq('is_active', true)
      .not('face_descriptor', 'is', null);

    if (error) throw error;
    rawUsers = data || [];

    // Cache valid gate users and their descriptors for offline verification
    try {
      const { getStorageRepository } = await import('./offline/storageRepository');
      const repo = getStorageRepository();
      for (const u of rawUsers) {
        await repo.putRecord('gate_users', u.id, u);
      }
    } catch {
      // Best-effort cache
    }
  } catch (err) {
    console.warn('[FaceMatcher] Network fetch failed, falling back to cached offline face descriptors:', err);
    try {
      const { getStorageRepository } = await import('./offline/storageRepository');
      const repo = getStorageRepository();
      const cached = await repo.getAllRecords<any>('gate_users');
      rawUsers = (cached || [])
        .filter((u: any) => u.face_descriptor || u.faceDescriptor)
        .map((u: any) => ({
          id: u.id,
          user_id: u.userId || u.user_id,
          face_descriptor: u.face_descriptor || u.faceDescriptor,
        }));
    } catch (cacheErr) {
      console.warn('[FaceMatcher] Failed to read offline cached gate users:', cacheErr);
    }
  }

  const faceapi = await import('@vladmandic/face-api');

  const validUsers = rawUsers
    .map((emp) => ({
      id: emp.id,
      descriptor: normalizeFaceDescriptor(emp.face_descriptor),
    }))
    .filter((emp) => emp.descriptor !== null);

  const labeledDescriptors = validUsers.map(emp => {
    const float32Desc = new Float32Array(emp.descriptor!);
    return new faceapi.LabeledFaceDescriptors(emp.id, [float32Desc]);
  });

  if (labeledDescriptors.length === 0) {
    // Return a dummy matcher if no users exist
    const dummyDesc = new faceapi.LabeledFaceDescriptors('unknown', [new Float32Array(128)]);
    matcherInstance = new faceapi.FaceMatcher([dummyDesc], threshold);
  } else {
    matcherInstance = new faceapi.FaceMatcher(labeledDescriptors, threshold);
  }

  console.log(`[FaceMatcher] Initialized with ${labeledDescriptors.length} descriptors.`);
  return matcherInstance;
}
