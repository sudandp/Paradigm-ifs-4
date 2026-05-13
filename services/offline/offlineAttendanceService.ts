/**
 * offlineAttendanceService.ts
 * 
 * Offline-first wrapper for all attendance operations.
 * Routes actions through online API or offline outbox depending on network status.
 * Manages local attendance state cache for offline viewing.
 * 
 * Design decisions:
 * - Client timestamps are authoritative (server stores synced_at separately)
 * - Max 1000 outbox items (warn at 800)
 * - 3-month auto-purge for old cache
 */

import { offlineDb } from './database';
import { api } from '../api';
import { Network } from '@capacitor/network';
import type { AttendanceEventType } from '../../types/attendance';

const OUTBOX_WARN_THRESHOLD = 800;
const OUTBOX_MAX_ITEMS = 1000;

export interface AttendanceEventPayload {
  userId: string;
  timestamp: string;
  type: AttendanceEventType;
  latitude?: number;
  longitude?: number;
  locationId?: string | null;
  locationName?: string | null;
  checkoutNote?: string;
  attachmentUrl?: string;
  workType?: 'office' | 'field';
  fieldReportId?: string;
  isOt?: boolean;
  isOfflineSync?: boolean;
}

class OfflineAttendanceService {
  /**
   * Main entry point for attendance actions.
   * If online → calls API directly + caches locally.
   * If offline → queues to outbox + updates local cache.
   * Returns success/failure for immediate UI feedback.
   */
  async punchAction(payload: AttendanceEventPayload): Promise<{ success: boolean; message: string; isOffline: boolean }> {
    const status = await Network.getStatus();

    if (status.connected) {
      return this.punchOnline(payload);
    } else {
      return this.punchOffline(payload);
    }
  }

  private async punchOnline(payload: AttendanceEventPayload): Promise<{ success: boolean; message: string; isOffline: boolean }> {
    try {
      await api.addAttendanceEvent(payload as any);
      // Update last online timestamp
      await offlineDb.setLastOnlineTimestamp();
      // Cache this event locally for offline history
      await this.appendToLocalEvents(payload);
      return { success: true, message: 'Attendance recorded.', isOffline: false };
    } catch (err: any) {
      console.error('[OfflineAttendance] Online punch failed, falling back to offline queue:', err);
      // Network might have dropped mid-request — queue offline
      return this.punchOffline(payload);
    }
  }

  private async punchOffline(payload: AttendanceEventPayload): Promise<{ success: boolean; message: string; isOffline: boolean }> {
    try {
      // Check outbox capacity
      const totalCount = await offlineDb.getTotalOutboxCount();
      if (totalCount >= OUTBOX_MAX_ITEMS) {
        return {
          success: false,
          message: `Offline queue is full (${OUTBOX_MAX_ITEMS} items). Please connect to the internet to sync pending data.`,
          isOffline: true
        };
      }

      const warnMsg = totalCount >= OUTBOX_WARN_THRESHOLD
        ? ` (${totalCount}/${OUTBOX_MAX_ITEMS} queued items — connect to internet soon)`
        : '';

      // Queue to outbox with offline flag
      await offlineDb.addToOutbox({
        table_name: 'attendance_events',
        action: 'INSERT',
        payload: { ...payload, isOfflineSync: true }
      });

      // Append to local event cache so UI reflects immediately
      await this.appendToLocalEvents(payload);

      return {
        success: true,
        message: `Attendance saved offline — will sync when connected.${warnMsg}`,
        isOffline: true
      };
    } catch (err: any) {
      console.error('[OfflineAttendance] Failed to queue offline punch:', err);
      return { success: false, message: 'Failed to save attendance locally.', isOffline: true };
    }
  }

  /**
   * Queue a leave request for offline sync.
   */
  async queueLeaveRequest(payload: any): Promise<{ success: boolean; message: string; isOffline: boolean }> {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        await api.submitLeaveRequest(payload);
        return { success: true, message: 'Leave request submitted.', isOffline: false };
      } catch (err) {
        console.warn('[OfflineAttendance] Leave request online submit failed, queuing offline');
      }
    }

    await offlineDb.addToOutbox({
      table_name: 'leave_requests',
      action: 'INSERT',
      payload
    });
    return { success: true, message: 'Leave request saved offline — will sync when connected.', isOffline: true };
  }

  /**
   * Queue a notification dispatch for offline sync.
   */
  async queueNotification(eventType: string, payload: any): Promise<void> {
    await offlineDb.addToOutbox({
      table_name: 'notification_dispatch',
      action: 'INSERT',
      payload: { eventType, ...payload }
    });
  }

  // ── Local Event Cache ──────────────────────────────────────────────────────

  /**
   * Append a new attendance event to the local cache for today.
   * This ensures the UI shows correct state even when offline.
   */
  private async appendToLocalEvents(event: AttendanceEventPayload) {
    const cacheKey = `today_events_${event.userId}`;
    const existing = await offlineDb.getCache(cacheKey) || [];
    existing.push({
      ...event,
      id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: event.timestamp,
      user_id: event.userId,
      work_type: event.workType
    });
    await offlineDb.setCache(cacheKey, existing);
  }

  /**
   * Get today's events from local cache (for offline state computation).
   * Merges cached server events with pending outbox items.
   */
  async getLocalTodayEvents(userId: string): Promise<any[]> {
    const cacheKey = `today_events_${userId}`;
    const cached = await offlineDb.getCache(cacheKey) || [];
    return cached;
  }

  /**
   * Replace local event cache with fresh server data (called after sync).
   */
  async updateLocalEventCache(userId: string, events: any[]) {
    const cacheKey = `today_events_${userId}`;
    await offlineDb.setCache(cacheKey, events);
  }

  /**
   * Cache attendance history for a specific month (for offline dashboard).
   */
  async cacheAttendanceHistory(userId: string, yearMonth: string, events: any[]) {
    const cacheKey = `attendance_history_${userId}_${yearMonth}`;
    await offlineDb.setCache(cacheKey, events);
  }

  /**
   * Get cached attendance history for a month.
   */
  async getCachedAttendanceHistory(userId: string, yearMonth: string): Promise<{ events: any[] | null; timestamp: string | null }> {
    const cacheKey = `attendance_history_${userId}_${yearMonth}`;
    const result = await offlineDb.getCacheWithTimestamp(cacheKey);
    return result ? { events: result.value, timestamp: result.timestamp } : { events: null, timestamp: null };
  }

  // ── Settings & Profile Cache ───────────────────────────────────────────────

  async cacheUserProfile(user: any) {
    await offlineDb.setCache('current_user', user);
  }

  async getCachedUserProfile(): Promise<any | null> {
    return await offlineDb.getCache('current_user');
  }

  async cacheAttendanceSettings(settings: any) {
    await offlineDb.setCache('attendance_settings', settings);
  }

  async getCachedAttendanceSettings(): Promise<any | null> {
    return await offlineDb.getCache('attendance_settings');
  }

  async cacheGeofencingSettings(settings: any) {
    await offlineDb.setCache('geofencing_settings', settings);
  }

  async getCachedGeofencingSettings(): Promise<any | null> {
    return await offlineDb.getCache('geofencing_settings');
  }

  async cacheUserLocations(userId: string, locations: any[]) {
    await offlineDb.setCache(`user_locations_${userId}`, locations);
  }

  async getCachedUserLocations(userId: string): Promise<any[] | null> {
    return await offlineDb.getCache(`user_locations_${userId}`);
  }

  // ── Maintenance ────────────────────────────────────────────────────────────

  /** Run periodic maintenance (auto-purge old cache, etc.) */
  async runMaintenance() {
    try {
      await offlineDb.purgeOldCache(3);
      console.log('[OfflineAttendance] Maintenance: purged old cache entries');
    } catch (err) {
      console.warn('[OfflineAttendance] Maintenance failed:', err);
    }
  }
}

export const offlineAttendanceService = new OfflineAttendanceService();
