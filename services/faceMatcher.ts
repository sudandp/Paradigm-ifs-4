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
  // Using gate_users as the existing table instead of 'employees' from the prompt
  // to maintain compatibility with the active system.
  const { data, error } = await supabase
    .from('gate_users')
    .select('id, user_id, face_descriptor')
    .eq('is_active', true)
    .not('face_descriptor', 'is', null);

  const faceapi = await import('@vladmandic/face-api');

  if (error) {
    console.error('[FaceMatcher] Failed to fetch descriptors:', error);
    throw error;
  }

  const validUsers = data
    .map(emp => ({
      id: emp.id,
      descriptor: normalizeFaceDescriptor(emp.face_descriptor)
    }))
    .filter(emp => emp.descriptor !== null);

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
