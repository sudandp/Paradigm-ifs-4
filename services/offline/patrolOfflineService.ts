/**
 * Patrol & Security Guard Offline Service — Paradigm Mobile Hardening
 *
 * Handles offline perimeter scans, checkpoint QR verification, geofencing checks,
 * and durable outbox syncing for guard rounds across basements, terraces, and peripheries.
 */

import { supabase } from '../supabase';
import type { GatePatrolCheckpoint, GatePatrolScan } from '../../types/communityGate';
import { enqueue, getItem, getPending } from './outbox';
import { getStorageRepository, type IOfflineStorageRepository } from './storageRepository';

const CHECKPOINT_CACHE_PREFIX = 'paradigm_patrol_checkpoints_';
const PATROL_SCAN_CACHE_PREFIX = 'paradigm_patrol_scans_';

const isOnline = (): boolean => (typeof navigator !== 'undefined' ? navigator.onLine : true);

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Pre-fetches and caches patrol checkpoints for an organization.
 */
export async function fetchPatrolCheckpoints(
  organizationId: string
): Promise<GatePatrolCheckpoint[]> {
  const cacheKey = `${CHECKPOINT_CACHE_PREFIX}${organizationId}`;
  const repo = getStorageRepository();

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('gate_patrol_checkpoints')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('active', true)
        .order('sequence_order', { ascending: true });

      if (!error && data) {
        const checkpoints = data as GatePatrolCheckpoint[];
        await repo.putRecord('gate_patrol_checkpoints', organizationId, { id: organizationId, records: checkpoints });
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify(checkpoints));
        }
        return checkpoints;
      }
    } catch (netErr) {
      console.warn('[PatrolOffline] Online checkpoint fetch failed, serving offline cache:', netErr);
    }
  }

  // Offline fallback
  try {
    const rawCached = await repo.getRecord<any>('gate_patrol_checkpoints', organizationId);
    if (rawCached) {
      if (Array.isArray(rawCached)) return rawCached;
      if (Array.isArray(rawCached.records)) return rawCached.records;
      const arr = Object.values(rawCached).filter((v: any) => v && typeof v === 'object' && v.id && v.id !== organizationId);
      if (arr.length > 0) return arr as GatePatrolCheckpoint[];
    }
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(cacheKey);
      if (raw) return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[PatrolOffline] Error reading cached checkpoints:', err);
  }

  return [];
}

/**
 * Saves or updates a patrol checkpoint with offline outbox queuing.
 */
export async function savePatrolCheckpoint(
  checkpoint: Partial<GatePatrolCheckpoint> & { organization_id: string; checkpoint_name: string; checkpoint_code: string; qr_hash: string }
): Promise<GatePatrolCheckpoint> {
  const recordId = checkpoint.id || crypto.randomUUID();
  const repo = getStorageRepository();

  const fullCheckpoint: GatePatrolCheckpoint = {
    id: recordId,
    organization_id: checkpoint.organization_id,
    location_id: checkpoint.location_id,
    checkpoint_code: checkpoint.checkpoint_code,
    checkpoint_name: checkpoint.checkpoint_name,
    qr_hash: checkpoint.qr_hash,
    nfc_tag_uid: checkpoint.nfc_tag_uid,
    expected_latitude: checkpoint.expected_latitude,
    expected_longitude: checkpoint.expected_longitude,
    sequence_order: checkpoint.sequence_order ?? 0,
    active: checkpoint.active ?? true,
  };

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('gate_patrol_checkpoints')
        .upsert(fullCheckpoint)
        .select()
        .single();

      if (!error && data) {
        const current = (await fetchPatrolCheckpoints(checkpoint.organization_id)) || [];
        const updated = [...current.filter((c) => c.id !== recordId), data as GatePatrolCheckpoint];
        await repo.putRecord('gate_patrol_checkpoints', checkpoint.organization_id, { id: checkpoint.organization_id, records: updated });
        return data as GatePatrolCheckpoint;
      }
    } catch (netErr) {
      console.warn('[PatrolOffline] Online checkpoint save failed, queueing offline:', netErr);
    }
  }

  // Offline queueing
  await enqueue({
    id: recordId,
    tableName: 'gate_patrol_checkpoints',
    action: 'UPSERT',
    payload: fullCheckpoint as unknown as Record<string, unknown>,
  });

  const current = (await fetchPatrolCheckpoints(checkpoint.organization_id)) || [];
  const updated = [...current.filter((c) => c.id !== recordId), fullCheckpoint];
  await repo.putRecord('gate_patrol_checkpoints', checkpoint.organization_id, { id: checkpoint.organization_id, records: updated });

  return fullCheckpoint;
}

// Top-level helpers for safe array serialization in IndexedDB/SQLite
async function readCachedScans(repo: IOfflineStorageRepository, organizationId: string): Promise<GatePatrolScan[]> {
  try {
    const rawCached = await repo.getRecord<any>('gate_patrol_scans', organizationId);
    if (Array.isArray(rawCached)) return rawCached;
    if (rawCached && Array.isArray(rawCached.records)) return rawCached.records;
    if (rawCached && typeof rawCached === 'object') {
      const keys = Object.keys(rawCached).filter((k) => k !== 'id' && !isNaN(Number(k)));
      if (keys.length > 0) {
        return keys.sort((a, b) => Number(a) - Number(b)).map((k) => rawCached[k]);
      }
    }
  } catch (err) {
    console.warn('[PatrolOffline] Error reading cached scans:', err);
  }
  return [];
}

async function writeCachedScans(repo: IOfflineStorageRepository, organizationId: string, scans: GatePatrolScan[]): Promise<void> {
  await repo.putRecord('gate_patrol_scans', organizationId, { id: organizationId, records: scans });
}

/**
 * Logs a patrol scan event (QR or NFC) with geofence verification and durable outbox syncing.
 */
export async function logPatrolScan(params: {
  organizationId: string;
  checkpointId: string;
  guardId: string;
  qrHash?: string;
  latitude?: number;
  longitude?: number;
  remarks?: string;
}): Promise<GatePatrolScan> {
  const recordId = crypto.randomUUID();
  const scanTime = new Date().toISOString();
  const repo = getStorageRepository();

  // Validate geofence against cached checkpoint if coordinates are available
  let isWithinGeofence = true;
  const checkpoints = await fetchPatrolCheckpoints(params.organizationId);
  const targetCheckpoint = checkpoints.find(
    (c) => c.id === params.checkpointId || (params.qrHash && c.qr_hash === params.qrHash)
  );

  const effectiveCheckpointId = targetCheckpoint?.id || params.checkpointId;

  if (
    params.latitude !== undefined &&
    params.longitude !== undefined &&
    targetCheckpoint?.expected_latitude !== undefined &&
    targetCheckpoint?.expected_longitude !== undefined
  ) {
    const dist = calculateDistanceMeters(
      params.latitude,
      params.longitude,
      Number(targetCheckpoint.expected_latitude),
      Number(targetCheckpoint.expected_longitude)
    );
    // Geofence radius: 100 meters
    isWithinGeofence = dist <= 100;
  }

  const scanRecord: GatePatrolScan = {
    id: recordId,
    organization_id: params.organizationId,
    checkpoint_id: effectiveCheckpointId,
    guard_id: params.guardId,
    scan_time: scanTime,
    latitude: params.latitude,
    longitude: params.longitude,
    is_within_geofence: isWithinGeofence,
    remarks: params.remarks,
  };

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('gate_patrol_scans')
        .insert({
          id: recordId,
          organization_id: params.organizationId,
          checkpoint_id: effectiveCheckpointId,
          guard_id: params.guardId,
          scan_time: scanTime,
          latitude: params.latitude,
          longitude: params.longitude,
          is_within_geofence: isWithinGeofence,
          remarks: params.remarks,
          created_at: scanTime,
        })
        .select()
        .single();

      if (!error && data) {
        const liveScan = data as GatePatrolScan;
        const currentScans = await readCachedScans(repo, params.organizationId);
        await writeCachedScans(repo, params.organizationId, [liveScan, ...currentScans.slice(0, 100)]);
        return liveScan;
      }
    } catch (netErr) {
      console.warn('[PatrolOffline] Direct patrol scan upload failed, queueing offline:', netErr);
    }
  }

  // Offline queueing with stable UUID and topological dependsOn pointing to checkpoint
await enqueue({
  id: recordId,
  tableName: 'gate_patrol_scans',
  action: 'INSERT',
  payload: {
    id: recordId,
    organization_id: params.organizationId,
    checkpoint_id: effectiveCheckpointId,
    guard_id: params.guardId,
    scan_time: scanTime,
    latitude: params.latitude,
    longitude: params.longitude,
    is_within_geofence: isWithinGeofence,
    remarks: params.remarks,
    created_at: scanTime,
  },
  userId: params.guardId,
  dependsOn: effectiveCheckpointId,
  capturedAt: scanTime,
});

const currentScans = await readCachedScans(repo, params.organizationId);
await writeCachedScans(repo, params.organizationId, [scanRecord, ...currentScans.slice(0, 100)]);

return scanRecord;
}

/**
* Fetches recent patrol scans for an organization, merging cached and pending outbox records.
*/
export async function fetchPatrolScans(params: {
organizationId: string;
guardId?: string;
checkpointId?: string;
limit?: number;
}): Promise<GatePatrolScan[]> {
const repo = getStorageRepository();

if (isOnline()) {
  try {
    let query = supabase
      .from('gate_patrol_scans')
      .select('*')
      .eq('organization_id', params.organizationId)
      .order('scan_time', { ascending: false });

    if (params.guardId) query = query.eq('guard_id', params.guardId);
    if (params.checkpointId) query = query.eq('checkpoint_id', params.checkpointId);
    if (params.limit) query = query.limit(params.limit);
    else query = query.limit(100);

    const { data, error } = await query;
    if (!error && data) {
      const scans = data as GatePatrolScan[];
      await writeCachedScans(repo, params.organizationId, scans);
      return scans;
    }
  } catch (netErr) {
    console.warn('[PatrolOffline] fetchPatrolScans online failed, serving offline cache:', netErr);
  }
}

// Offline fallback
const cached = await readCachedScans(repo, params.organizationId);
let filtered = [...cached];

if (params.guardId) filtered = filtered.filter((s) => s.guard_id === params.guardId);
if (params.checkpointId) filtered = filtered.filter((s) => s.checkpoint_id === params.checkpointId);
if (params.limit) filtered = filtered.slice(0, params.limit);

return filtered;
}
