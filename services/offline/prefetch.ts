/**
 * prefetch.ts — Master Data Prefetch Utility
 *
 * Pre-warms IndexedDB cache with reference and master data (sites/organizations,
 * equipment templates, and categories) when the device is online so field
 * technicians can launch and complete audits even with zero network connectivity.
 */

import { supabase } from '../supabase';
import * as cache from './cache';
import { isOnline } from './networkStatus';

export interface PrefetchStats {
  sitesCount: number;
  durationMs: number;
  timestamp: string;
}

/**
 * Prefetches master data required for offline audits (Snag, PPM, HT Yard, Onboarding).
 * Safe to call repeatedly; gracefully skips when offline or on error.
 */
export async function prefetchMasterData(): Promise<PrefetchStats | null> {
  if (!isOnline()) {
    console.log('[Prefetch] Skipped: device is currently offline');
    return null;
  }

  const startTime = Date.now();
  let sitesCount = 0;

  try {
    console.log('[Prefetch] Pre-warming offline master data caches...');

    // 1. Prefetch Sites / Organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, short_name, code, city, status, address')
      .order('name');

    if (!orgsError && orgs && orgs.length > 0) {
      await cache.putServerRecords('organizations', orgs);
      sitesCount = orgs.length;
      console.log(`[Prefetch] Cached ${orgs.length} sites/organizations in IDB`);
    }

    // 2. Prefetch HT Yard Master Assets / Templates if table exists
    try {
      const { data: htAssets, error: htError } = await supabase
        .from('ht_yard_master_assets')
        .select('*');
      if (!htError && htAssets && htAssets.length > 0) {
        await cache.putServerRecords('ht_yard_master_assets', htAssets);
        console.log(`[Prefetch] Cached ${htAssets.length} HT Yard master assets`);
      }
    } catch {
      // Table may not exist or be restricted — non-fatal
    }

    const stats: PrefetchStats = {
      sitesCount,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem('paradigm_offline_prefetch_meta', JSON.stringify(stats));
    return stats;
  } catch (err) {
    console.warn('[Prefetch] Master data prefetch warning:', err);
    return null;
  }
}

/**
 * Returns cached sites/organizations from IndexedDB.
 * Falls back to localStorage if IDB is empty.
 */
export async function getCachedSites(): Promise<any[]> {
  try {
    const cached = await cache.getAll<any>('organizations');
    if (cached && cached.length > 0) return cached;
  } catch (err) {
    console.warn('[Prefetch] Error reading cached sites:', err);
  }

  // Fallback to localStorage legacy key if present
  try {
    const raw = localStorage.getItem('paradigm_organizations_cache');
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('[Prefetch] Legacy organizations cache unavailable:', err);
  }

  return [];
}
