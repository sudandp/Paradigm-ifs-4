/**
 * Gate Kiosk Service (Offline-First Guard Station)
 * Manages local caching of society units, residents, and domestic staff,
 * offline visitor logging, and auto-sync to Supabase with Exotel IVR fallback.
 */

import { supabase } from '../supabase';
import type {
  GateUnit,
  GateResident,
  GateDailyHelper,
  GateEntry,
  OfflineGateCache,
  GateEmergencyType
} from '../../types/communityGate';

const CACHE_KEY_PREFIX = 'paradigm_gate_cache_';
const PENDING_ENTRIES_KEY = 'paradigm_gate_pending_entries';

export class GateKioskService {
  /**
   * Pre-fetches the entire society unit & resident roster for offline access
   */
  static async prefetchGateData(organizationId: string): Promise<OfflineGateCache> {
    try {
      console.log(`[GateKiosk] Pre-fetching offline directory for org: ${organizationId}`);

      const [unitsRes, residentsRes, helpersRes] = await Promise.all([
        supabase
          .from('gate_units')
          .select('*')
          .eq('organization_id', organizationId)
          .order('block_tower')
          .order('unit_number'),
        supabase
          .from('gate_residents')
          .select('*, gate_units(block_tower, unit_number)')
          .eq('organization_id', organizationId)
          .eq('active', true),
        supabase
          .from('gate_daily_helpers')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('active', true)
      ]);

      const cache: OfflineGateCache = {
        organizationId,
        units: unitsRes.data || [],
        residents: residentsRes.data || [],
        helpers: helpersRes.data || [],
        cachedAt: Date.now()
      };

      localStorage.setItem(`${CACHE_KEY_PREFIX}${organizationId}`, JSON.stringify(cache));
      console.log(`[GateKiosk] Successfully cached ${cache.units.length} units, ${cache.residents.length} residents, ${cache.helpers.length} helpers.`);
      return cache;
    } catch (err) {
      console.error('[GateKiosk] Failed to prefetch data:', err);
      // Fallback to existing cache if network failed
      return this.getLocalCache(organizationId);
    }
  }

  /**
   * Reads cached units and residents from local storage
   */
  static getLocalCache(organizationId: string): OfflineGateCache {
    try {
      const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${organizationId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[GateKiosk] Corrupt local cache, initializing empty');
    }
    return {
      organizationId,
      units: [],
      residents: [],
      helpers: [],
      cachedAt: 0
    };
  }

  /**
   * Fast offline search for flats/towers (e.g. "A 101" or "102")
   */
  static searchUnits(organizationId: string, query: string): GateUnit[] {
    const cache = this.getLocalCache(organizationId);
    if (!query.trim()) return cache.units.slice(0, 30);

    const q = query.toLowerCase().trim();
    return cache.units.filter(u =>
      u.unit_number.toLowerCase().includes(q) ||
      u.block_tower.toLowerCase().includes(q) ||
      `${u.block_tower} ${u.unit_number}`.toLowerCase().includes(q)
    ).slice(0, 30);
  }

  /**
   * Fast offline lookup for vehicle number plate
   */
  static searchVehicle(organizationId: string, vehicleNo: string): { resident?: GateResident; unit?: GateUnit } | null {
    const q = vehicleNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!q || q.length < 4) return null;

    const cache = this.getLocalCache(organizationId);
    // Future expansion: vehicle lookup table in cache
    return null;
  }

  /**
   * Fast offline helper lookup by 4-digit code (e.g. DH-1002 or 1002)
   */
  static searchHelperByCode(organizationId: string, code: string): GateDailyHelper | null {
    const cache = this.getLocalCache(organizationId);
    const clean = code.trim().toLowerCase();
    return cache.helpers.find(h =>
      h.helper_code.toLowerCase() === clean ||
      h.helper_code.toLowerCase().endsWith(clean) ||
      h.full_name.toLowerCase().includes(clean)
    ) || null;
  }

  /**
   * Logs a visitor entry. Handles offline queuing and triggers dual approval when online.
   */
  static async logVisitorEntry(
    entry: Omit<GateEntry, 'id' | 'created_at'>
  ): Promise<{ success: boolean; entry: GateEntry; isOffline: boolean }> {
    const isOnline = navigator.onLine;
    const offlineId = `OFFLINE_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const fullEntry: GateEntry = {
      ...entry,
      id: crypto.randomUUID(),
      offline_id: offlineId,
      is_synced: isOnline,
      created_at: new Date().toISOString()
    };

    if (isOnline) {
      try {
        const { data, error } = await supabase
          .from('gate_entries')
          .insert({
            organization_id: entry.organization_id,
            unit_id: entry.unit_id,
            location_id: entry.location_id,
            visitor_type: entry.visitor_type,
            visitor_name: entry.visitor_name,
            visitor_phone: entry.visitor_phone,
            vehicle_number: entry.vehicle_number,
            company_name: entry.company_name,
            visitor_photo_url: entry.visitor_photo_url,
            helper_id: entry.helper_id,
            entry_gate_name: entry.entry_gate_name,
            guard_user_id: entry.guard_user_id,
            entry_time: entry.entry_time,
            approval_status: entry.approval_status || 'pending',
            approval_channel: entry.approval_channel || 'app_push',
            offline_id: offlineId,
            is_synced: true
          })
          .select()
          .single();

        if (error) throw error;

        // Trigger Dual Approval (FCM Push + 45s Exotel Fallback) if pending
        if (data.approval_status === 'pending') {
          supabase.functions.invoke('gate-visitor-approval-engine', {
            body: { entry_id: data.id }
          }).catch(e => console.warn('[GateKiosk] Dual approval invocation warning:', e));
        }

        return { success: true, entry: data, isOffline: false };
      } catch (cloudErr) {
        console.warn('[GateKiosk] Cloud insert failed, falling back to offline queue:', cloudErr);
      }
    }

    // Offline Fallback Queue
    this.queuePendingEntry(fullEntry);
    return { success: true, entry: fullEntry, isOffline: true };
  }

  /**
   * Appends an entry to the local IndexedDB/localStorage outbox
   */
  private static queuePendingEntry(entry: GateEntry) {
    try {
      const raw = localStorage.getItem(PENDING_ENTRIES_KEY);
      const queue: GateEntry[] = raw ? JSON.parse(raw) : [];
      queue.push(entry);
      localStorage.setItem(PENDING_ENTRIES_KEY, JSON.stringify(queue));
      console.log(`[GateKiosk] Entry queued offline. Total pending: ${queue.length}`);
    } catch (e) {
      console.error('[GateKiosk] Error queuing offline entry:', e);
    }
  }

  /**
   * Flushes all offline queued entries to Supabase via sync RPC
   */
  static async syncPendingEntries(): Promise<{ syncedCount: number }> {
    if (!navigator.onLine) return { syncedCount: 0 };

    try {
      const raw = localStorage.getItem(PENDING_ENTRIES_KEY);
      if (!raw) return { syncedCount: 0 };

      const queue: GateEntry[] = JSON.parse(raw);
      if (queue.length === 0) return { syncedCount: 0 };

      console.log(`[GateKiosk] Syncing ${queue.length} offline entries to Supabase...`);

      const { data, error } = await supabase.rpc('sync_offline_gate_entries', {
        p_entries: queue
      });

      if (error) throw error;

      console.log('[GateKiosk] Offline sync success:', data);
      localStorage.removeItem(PENDING_ENTRIES_KEY);
      return { syncedCount: queue.length };
    } catch (err) {
      console.error('[GateKiosk] Offline sync failed:', err);
      return { syncedCount: 0 };
    }
  }

  /**
   * Realtime subscription for gate entries (to update guard screen when resident approves/denies)
   */
  static subscribeToGateApprovals(
    organizationId: string,
    onStatusChange: (entry: GateEntry) => void
  ) {
    return supabase
      .channel(`gate_entries_${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gate_entries',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          onStatusChange(payload.new as GateEntry);
        }
      )
      .subscribe();
  }

  /**
   * Triggers an emergency SOS broadcast
   */
  static async triggerEmergencyAlert(
    organizationId: string,
    alertType: GateEmergencyType,
    locationDesc: string,
    unitId?: string
  ) {
    return supabase
      .from('gate_emergency_alerts')
      .insert({
        organization_id: organizationId,
        unit_id: unitId,
        alert_type: alertType,
        location_description: locationDesc,
        is_active: true
      })
      .select()
      .single();
  }
}
