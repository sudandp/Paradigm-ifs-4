import { Network } from '@capacitor/network';
import { supabase } from './supabase';

export interface SyncQueueItem {
  id: string;
  entityType: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
  createdAt: number;
  attempts: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
}

const STORAGE_KEY = 'paradigm_offline_sync_queue_v1';

class OfflineSyncEngine {
  private isSyncing = false;
  private isOnline = true;

  constructor() {
    this.initNetworkListener();
  }

  private async initNetworkListener() {
    try {
      const status = await Network.getStatus();
      this.isOnline = status.connected;

      Network.addListener('networkStatusChange', (netStatus) => {
        this.isOnline = netStatus.connected;
        if (this.isOnline) {
          console.log('[OfflineSyncEngine] Network reconnected. Triggering sync queue drain...');
          this.drainQueue();
        }
      });
    } catch (e) {
      console.warn('[OfflineSyncEngine] Network plugin unavailable on web fallback:', e);
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.drainQueue();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  public getNetworkStatus(): boolean {
    return this.isOnline;
  }

  public getQueue(): SyncQueueItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[OfflineSyncEngine] Error reading queue:', e);
      return [];
    }
  }

  private saveQueue(queue: SyncQueueItem[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('[OfflineSyncEngine] Error writing queue:', e);
    }
  }

  public async enqueue(entityType: string, action: 'INSERT' | 'UPDATE' | 'DELETE', payload: Record<string, any>): Promise<SyncQueueItem> {
    const item: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      entityType,
      action,
      payload,
      createdAt: Date.now(),
      attempts: 0,
      status: 'PENDING'
    };

    const queue = this.getQueue();
    queue.push(item);
    this.saveQueue(queue);

    console.log(`[OfflineSyncEngine] Enqueued item ${item.id} for ${entityType}`);

    if (this.isOnline) {
      this.drainQueue();
    }

    return item;
  }

  public async drainQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline) return;

    this.isSyncing = true;
    const queue = this.getQueue();
    const pendingItems = queue.filter(item => item.status !== 'SYNCING' && item.attempts < 5);

    if (pendingItems.length === 0) {
      this.isSyncing = false;
      return;
    }

    console.log(`[OfflineSyncEngine] Draining ${pendingItems.length} queued offline items...`);

    for (const item of pendingItems) {
      item.status = 'SYNCING';
      item.attempts += 1;
      this.saveQueue(queue);

      try {
        let error = null;
        if (item.action === 'INSERT') {
          const { error: err } = await supabase.from(item.entityType).insert(item.payload);
          error = err;
        } else if (item.action === 'UPDATE') {
          const { id, ...updateData } = item.payload;
          const { error: err } = await supabase.from(item.entityType).update(updateData).eq('id', id || item.payload.entity_id);
          error = err;
        } else if (item.action === 'DELETE') {
          const { error: err } = await supabase.from(item.entityType).delete().eq('id', item.payload.id);
          error = err;
        }

        if (error) {
          console.warn(`[OfflineSyncEngine] Sync failed for ${item.id} (attempt ${item.attempts}):`, error.message);
          item.status = 'FAILED';
        } else {
          console.log(`[OfflineSyncEngine] Successfully synced ${item.id}`);
          const updatedQueue = this.getQueue().filter(q => q.id !== item.id);
          this.saveQueue(updatedQueue);
        }
      } catch (err: any) {
        console.error(`[OfflineSyncEngine] Exception syncing ${item.id}:`, err);
        item.status = 'FAILED';
        this.saveQueue(queue);
      }
    }

    this.isSyncing = false;
  }
}

export const offlineSyncEngine = new OfflineSyncEngine();
