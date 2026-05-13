import { offlineDb, OutboxItem } from './database';
import { api } from '../api';
import { Network } from '@capacitor/network';
import { dispatchNotificationFromRules } from '../notificationService';

class SyncService {
  private isSyncing = false;
  private syncInterval: number | null = null;

  async init() {
    await offlineDb.init();
    this.startAutoSync();
    
    // Listen for network changes to trigger sync
    Network.addListener('networkStatusChange', (status) => {
      if (status.connected) {
        this.sync();
      }
    });
  }

  startAutoSync(intervalMs = 60000) { // Sync every minute
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = window.setInterval(() => this.sync(), intervalMs);
  }

  private static readonly MAX_RETRIES = 5;

  async sync() {
    if (this.isSyncing) return;
    
    const status = await Network.getStatus();
    if (!status.connected) return;

    this.isSyncing = true;
    console.log('[SyncService] Starting sync...');

    try {
      // 1. Push pending changes (Outbox) — skip items that have exceeded max retries
      const pendingItems = await offlineDb.getPendingOutbox();
      for (const item of pendingItems) {
        const retryCount = (item as any).retry_count || 0;
        if (retryCount >= SyncService.MAX_RETRIES) {
          console.warn(`[SyncService] Item ${item.id} exceeded max retries (${retryCount}), marking permanently failed`);
          await offlineDb.updateOutboxStatus(item.id!, 'failed');
          continue;
        }
        
        // Exponential backoff: skip if item was recently retried
        if (retryCount > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 60000); // max 60s
          const lastAttempt = (item as any).last_attempt || 0;
          if (Date.now() - lastAttempt < backoffMs) {
            continue; // Skip — not enough time has passed since last retry
          }
        }
        
        await this.processItem(item);
      }

      // 2. Pull latest data for all key modules
      await this.pullAllData();
      
      // 3. Mark last sync success + update online timestamp
      await offlineDb.setSyncTime(new Date().toISOString());
      await offlineDb.setLastOnlineTimestamp();
      
    } catch (error) {
      console.error('[SyncService] Sync failed:', error);
    } finally {
      this.isSyncing = false;
      console.log('[SyncService] Sync completed.');
    }
  }

  /**
   * Refreshes the local cache by pulling all major data collections from Supabase.
   */
  async pullAllData() {
    console.log('[SyncService] Refreshing local cache...');
    try {
      // Basic App Data
      await api.getInitialAppData();
      
      // User Profile & Attendance (already mostly handled by getInitialAppData/getLeaveBalances)
      const { data: { session } } = await api.auth.getSession();
      if (session?.user?.id) {
          const userId = session.user.id;
          await api.getLeaveBalancesForUser(userId);
          await api.getLeaveRequests({ userId });
          await api.getUserChildren(userId);
          await api.getUserLocations(userId);
      }

      // Global Lists
      await api.getOrganizations();
      await api.getLocations();
      await api.getSupportTickets();
      await api.getTasks();
      
    } catch (err) {
      console.error('[SyncService] Failed to pull some data collections:', err);
    }
  }

  private async processItem(item: OutboxItem) {
    if (!item.id) return;
    
    await offlineDb.updateOutboxStatus(item.id, 'syncing');

    try {
      // Logic to route the request back to the API based on table_name and action
      // This is a simplified version; in a real app, we'd have a registry of sync handlers
      
      switch (item.table_name) {
        case 'tasks':
          if (item.action === 'INSERT') await api.createTask(item.payload);
          if (item.action === 'UPDATE') await api.updateTask(item.payload.id, item.payload.updates);
          if (item.action === 'DELETE') await api.deleteTask(item.payload.id);
          break;
        case 'onboarding_submissions':
          if (item.action === 'INSERT') await api._saveSubmission(item.payload.data, item.payload.asDraft);
          break;
        case 'leave_requests':
          if (item.action === 'INSERT') await api.submitLeaveRequest(item.payload);
          if (item.action === 'UPDATE') await api.updateLeaveRequest(item.payload.id, item.payload.updates);
          break;
        case 'entities':
          if (item.action === 'INSERT' || item.action === 'UPDATE') await api.saveEntity(item.payload);
          break;
        case 'field_reports':
          if (item.action === 'INSERT') await api.submitFieldReport(item.payload);
          break;
        case 'extra_work_logs':
          if (item.action === 'INSERT') await api.submitExtraWorkClaim(item.payload);
          break;
        case 'comp_off_logs':
          if (item.action === 'INSERT') await api.addCompOffLog(item.payload);
          break;
        case 'locations':
          if (item.action === 'INSERT') await api.createLocation(item.payload);
          break;
        case 'organizations':
          if (item.action === 'INSERT') await api.createOrganization(item.payload);
          break;
        case 'uniform_requests':
          if (item.action === 'INSERT') await api.submitUniformRequest(item.payload);
          if (item.action === 'UPDATE') await api.updateUniformRequest(item.payload);
          if (item.action === 'DELETE') await api.deleteUniformRequest(item.payload.id);
          break;
        case 'user_children':
          if (item.action === 'INSERT') await api.addChild(item.payload.userId, item.payload);
          if (item.action === 'UPDATE') await api.updateChild(item.payload.id, item.payload.updates);
          if (item.action === 'DELETE') await api.deleteChild(item.payload.id);
          break;
        case 'attendance_violations':
          if (item.action === 'INSERT') await api.addViolation(item.payload);
          break;
        case 'violation_resets':
          if (item.action === 'INSERT') await api.resetViolations(item.payload.userId, item.payload.month, item.payload.reason, item.payload.adminId);
          break;
        case 'biometric_devices':
          if (item.action === 'INSERT') await api.addBiometricDevice(item.payload);
          if (item.action === 'UPDATE') await api.updateBiometricDevice(item.payload.id, item.payload.updates);
          if (item.action === 'DELETE') await api.deleteBiometricDevice(item.payload.id);
          break;
        case 'site_configurations':
          if (item.action === 'UPDATE') await api.saveSiteConfiguration(item.payload.organization_id, item.payload.config);
          if (item.action === 'UPDATE_ASSETS') await api.updateSiteAssets(item.payload.organization_id, item.payload.assets);
          if (item.action === 'UPDATE_TOOLS') await api.updateSiteIssuedTools(item.payload.organization_id, item.payload.tools);
          break;
        case 'settings':
          if (item.action === 'SAVE_SETTINGS') await api.saveAttendanceSettings(item.payload.attendance_settings);
          break;
        case 'site_finance_tracker':
          if (item.action === 'INSERT') await api.saveSiteFinanceRecord(item.payload);
          break;
        case 'attendance_events':
          if (item.action === 'INSERT') {
            try {
              await api.addAttendanceEvent({ ...item.payload, is_offline_sync: true });
            } catch (attErr: any) {
              // 409 = duplicate event (idempotency) — treat as success
              if (attErr?.status === 409 || attErr?.code === '23505') {
                console.warn(`[SyncService] Attendance event ${item.id} already exists, skipping duplicate`);
              } else {
                throw attErr;
              }
            }
          }
          break;
        case 'notification_dispatch':
          if (item.action === 'INSERT') {
            const { eventType, ...notifPayload } = item.payload;
            try {
              dispatchNotificationFromRules(eventType, notifPayload);
            } catch (nErr) {
              console.warn(`[SyncService] Notification dispatch failed for ${eventType}:`, nErr);
              // Don't block sync for notification failures
            }
          }
          break;
        case 'support_tickets':
          if (item.action === 'INSERT') await api.createSupportTicket(item.payload);
          break;
        case 'ticket_posts':
          if (item.action === 'INSERT') await api.addTicketPost(item.payload.ticketId, item.payload.post);
          break;
        case 'ticket_comments':
          if (item.action === 'INSERT') await api.addPostComment(item.payload.postId, item.payload.comment);
          break;
      }

      await offlineDb.deleteFromOutbox(item.id);
    } catch (error) {
      console.error(`[SyncService] Failed to sync item ${item.id}:`, error);
      await offlineDb.updateOutboxStatus(item.id, 'failed');
    }
  }
}

export const syncService = new SyncService();
