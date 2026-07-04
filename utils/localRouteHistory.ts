import { Preferences } from '@capacitor/preferences';
import { supabase } from '../services/supabase';
import { RoutePoint } from '../types/attendance';

export interface LocalRoutePoint extends RoutePoint {
  synced?: boolean;
}

// Helper to convert object keys to snake_case for Supabase
function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      newObj[snakeKey] = toSnakeCase(obj[key]);
    }
    return newObj;
  }
  return obj;
}

// Helper to convert object keys to camelCase from Supabase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      newObj[camelKey] = toCamelCase(obj[key]);
    }
    return newObj;
  }
  return obj;
}

/**
 * Save a route point to local storage (Capacitor Preferences)
 */
export async function saveRoutePointLocally(
  userId: string,
  point: Omit<RoutePoint, 'id'>,
  synced: boolean = false
): Promise<LocalRoutePoint> {
  try {
    const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    const dateStr = point.timestamp.substring(0, 10); // YYYY-MM-DD
    const key = `local_route_points_${userId}_${dateStr}`;

    const newPoint: LocalRoutePoint = {
      ...point,
      id: localId,
      synced
    };

    // Load existing points for the day
    const { value } = await Preferences.get({ key });
    let points: LocalRoutePoint[] = [];
    if (value) {
      try {
        points = JSON.parse(value);
      } catch (_) {
        points = [];
      }
    }

    points.push(newPoint);
    await Preferences.set({ key, value: JSON.stringify(points) });
    console.log(`[localRouteHistory] Route point saved locally (synced=${synced}):`, key, localId);
    return newPoint;
  } catch (err) {
    console.error('[localRouteHistory] Failed to save route point locally:', err);
    // Return mock structure so execution is not blocked
    return {
      ...point,
      id: 'local_fail_' + Date.now(),
      synced: false
    };
  }
}

/**
 * Retrieve cached route points for a user, optionally filtered by date range
 */
export async function getLocalRoutePoints(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<LocalRoutePoint[]> {
  try {
    const { keys } = await Preferences.keys();
    const userPrefix = `local_route_points_${userId}_`;
    const matchedKeys = keys.filter(k => k.startsWith(userPrefix));

    let allPoints: LocalRoutePoint[] = [];

    // Parse start and end date ranges if present
    const start = startDate ? new Date(startDate).getTime() : -Infinity;
    const end = endDate ? new Date(endDate).getTime() : Infinity;

    for (const key of matchedKeys) {
      const { value } = await Preferences.get({ key });
      if (value) {
        try {
          const dayPoints: LocalRoutePoint[] = JSON.parse(value);
          allPoints.push(...dayPoints);
        } catch (_) {}
      }
    }

    // Filter by timestamp range
    if (startDate || endDate) {
      allPoints = allPoints.filter(p => {
        const t = new Date(p.timestamp).getTime();
        return t >= start && t <= end;
      });
    }

    // Sort chronologically
    return allPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (err) {
    console.error('[localRouteHistory] Failed to get local route points:', err);
    return [];
  }
}

/**
 * Retrieve all local route points that have not been synced yet
 */
export async function getUnsyncedRoutePoints(userId: string): Promise<LocalRoutePoint[]> {
  const allPoints = await getLocalRoutePoints(userId);
  return allPoints.filter(p => p.synced === false);
}

/**
 * Mark a batch of local points as synced
 */
export async function markRoutePointsAsSynced(userId: string, pointIds: string[]): Promise<void> {
  if (pointIds.length === 0) return;
  const idSet = new Set(pointIds);

  try {
    const { keys } = await Preferences.keys();
    const userPrefix = `local_route_points_${userId}_`;
    const matchedKeys = keys.filter(k => k.startsWith(userPrefix));

    for (const key of matchedKeys) {
      const { value } = await Preferences.get({ key });
      if (value) {
        try {
          const points: LocalRoutePoint[] = JSON.parse(value);
          let modified = false;

          const updatedPoints = points.map(p => {
            if (idSet.has(p.id)) {
              modified = true;
              return { ...p, synced: true };
            }
            return p;
          });

          if (modified) {
            await Preferences.set({ key, value: JSON.stringify(updatedPoints) });
          }
        } catch (_) {}
      }
    }
    console.log(`[localRouteHistory] Marked ${pointIds.length} points as synced`);
  } catch (err) {
    console.error('[localRouteHistory] Failed to mark route points as synced:', err);
  }
}

/**
 * Push all unsynced local points to Supabase
 */
export async function pushLocalPointsToSupabase(userId: string): Promise<{ successCount: number; failedCount: number }> {
  const unsynced = await getUnsyncedRoutePoints(userId);
  if (unsynced.length === 0) {
    return { successCount: 0, failedCount: 0 };
  }

  console.log(`[localRouteHistory] Attempting to sync ${unsynced.length} local route points for user ${userId}...`);

  let successCount = 0;
  let failedCount = 0;
  const successIds: string[] = [];

  for (const point of unsynced) {
    try {
      // 1. Remove local metadata key (synced) and local generated id so Supabase creates a new DB UUID
      const { synced, id, ...rawPoint } = point;

      // 2. Insert snake_case fields
      const dbPayload = toSnakeCase(rawPoint);

      const { error } = await supabase
        .from('route_history')
        .insert(dbPayload);

      if (error) throw error;

      successIds.push(point.id);
      successCount++;
    } catch (err: any) {
      console.warn(`[localRouteHistory] Sync failed for point ${point.id}:`, err.message || err);
      failedCount++;
    }
  }

  if (successCount > 0) {
    await markRoutePointsAsSynced(userId, successIds);
  }

  console.log(`[localRouteHistory] Sync complete: ${successCount} succeeded, ${failedCount} failed`);
  return { successCount, failedCount };
}
