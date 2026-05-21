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
      // 1. Push pending changes (Outbox)
      const pendingItems = await offlineDb.getPendingOutbox();
      for (const item of pendingItems) {
        // Skip items that have exceeded max retries
        if (item.retryCount >= SyncService.MAX_RETRIES) {
          console.warn(`[SyncService] Item ${item.id} exceeded max retries (${item.retryCount}), marking permanently failed`);
          await offlineDb.updateOutboxStatus(item.id!, 'failed');
          continue;
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
          await api.getAttendanceSettings().catch(() => {}); // Ensure settings cached for offline leave calc
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
            await api.addAttendanceEvent({ ...item.payload, is_offline_sync: true });
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

      // Success — remove from outbox
      await offlineDb.deleteFromOutbox(item.id);
    } catch (error: any) {
      // Universal duplicate detection: 409 Conflict or unique_violation (23505)
      // Treat as success — the record already exists on the server
      if (error?.status === 409 || error?.code === '23505') {
        console.warn(`[SyncService] Item ${item.id} (${item.table_name}) is a duplicate, removing from outbox`);
        await offlineDb.deleteFromOutbox(item.id);
        return;
      }

      console.error(`[SyncService] Failed to sync item ${item.id} (${item.table_name}):`, error);

      // Increment retry count and apply backoff
      const newRetryCount = (item.retryCount || 0) + 1;
      await offlineDb.updateOutboxRetryCount(item.id, newRetryCount);

      if (newRetryCount >= SyncService.MAX_RETRIES) {
        console.warn(`[SyncService] Item ${item.id} reached max retries (${newRetryCount}), marking failed`);
        await offlineDb.updateOutboxStatus(item.id, 'failed');
      } else {
        // Reset to pending so it's retried on next sync cycle
        await offlineDb.updateOutboxStatus(item.id, 'pending');
        // Exponential backoff delay before processing next item
        const delay = Math.min(1000 * Math.pow(2, newRetryCount), 60000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

}

export const syncService = new SyncService();
