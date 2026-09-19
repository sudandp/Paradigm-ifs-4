/**
 * useOutboxStatus.ts — React Hooks for Offline Sync Status
 *
 * Provides real-time subscriptions to outbox events for:
 * 1. Per-record badges (`useOutboxStatus`)
 * 2. Application-wide offline summary banner & review (`useOutboxSummary`)
 */

import { useState, useEffect, useCallback } from 'react';
import * as outbox from '../services/offline/outbox';
import { isOnline as getIsOnline, isReachable, onStatusChange } from '../services/offline/networkStatus';
import { syncNow as triggerSyncNow } from '../services/offline/syncEngine';
import type { OutboxItem, OutboxStatus } from '../services/offline/db';

export type RecordSyncStatus = OutboxStatus | 'synced';

export interface UseOutboxStatusResult {
  status: RecordSyncStatus;
  isQueued: boolean;
  item?: OutboxItem;
  failureReason?: string;
  isConflict: boolean;
  isAuthPaused: boolean;
}

/**
 * Hook to track the sync status of a specific record by ID.
 * Returns 'synced' if the record has no pending outbox mutations.
 */
export function useOutboxStatus(tableName: string, recordId: string | undefined): UseOutboxStatusResult {
  const [item, setItem] = useState<OutboxItem | undefined>(undefined);
  const [status, setStatus] = useState<RecordSyncStatus>('synced');

  const checkStatus = useCallback(async () => {
    if (!recordId) {
      setItem(undefined);
      setStatus('synced');
      return;
    }
    const existing = await outbox.getItem(recordId);
    if (existing && existing.tableName === tableName) {
      setItem(existing);
      setStatus(existing.status);
    } else {
      setItem(undefined);
      setStatus('synced');
    }
  }, [tableName, recordId]);

  useEffect(() => {
    checkStatus();

    const unsubscribe = outbox.subscribeOutbox((event) => {
      if (!recordId) return;
      if (event.item && event.item.id === recordId) {
        if (event.type === 'synced') {
          setItem(undefined);
          setStatus('synced');
        } else {
          setItem(event.item);
          setStatus(event.item.status);
        }
      } else if (event.type === 'drained') {
        checkStatus();
      }
    });

    return () => unsubscribe();
  }, [recordId, checkStatus]);

  return {
    status,
    isQueued: status !== 'synced',
    item,
    failureReason: item?.failureReason || item?.lastError?.message,
    isConflict: status === 'conflict',
    isAuthPaused: status === 'auth_paused',
  };
}

export interface UseOutboxSummaryResult {
  summary: outbox.OutboxSummary;
  isOnline: boolean;
  isReachableState: boolean;
  syncNow: () => Promise<void>;
  clearFailed: () => Promise<number>;
  refresh: () => Promise<void>;
}

/**
 * Hook providing live global outbox metrics for the banner and sync screen.
 */
export function useOutboxSummary(): UseOutboxSummaryResult {
  const [summary, setSummary] = useState<outbox.OutboxSummary>({
    pending: 0,
    syncing: 0,
    failed: 0,
    conflict: 0,
    authPaused: 0,
    total: 0,
  });
  const [online, setOnline] = useState<boolean>(getIsOnline());
  const [reachable, setReachable] = useState<boolean>(getIsOnline());

  const refresh = useCallback(async () => {
    const s = await outbox.getOutboxSummary();
    setSummary(s);
    setOnline(getIsOnline());
  }, []);

  useEffect(() => {
    refresh();

    // Outbox event listener
    const unsubOutbox = outbox.subscribeOutbox(() => {
      refresh();
    });

    // Network status listener
    const unsubNet = onStatusChange((newOnline) => {
      setOnline(newOnline);
      refresh();
      if (newOnline) {
        isReachable(3000).then((r) => setReachable(r));
      } else {
        setReachable(false);
      }
    });

    // Periodic reachability check when online
    const pingTimer = setInterval(() => {
      if (getIsOnline()) {
        isReachable(3000).then((r) => setReachable(r));
      } else {
        setReachable(false);
      }
    }, 30000);

    return () => {
      unsubOutbox();
      unsubNet();
      clearInterval(pingTimer);
    };
  }, [refresh]);

  const syncNow = useCallback(async () => {
    await triggerSyncNow();
    await refresh();
  }, [refresh]);

  const clearFailed = useCallback(async () => {
    const count = await outbox.clearAllFailed();
    await refresh();
    return count;
  }, [refresh]);

  return {
    summary,
    isOnline: online,
    isReachableState: reachable,
    syncNow,
    clearFailed,
    refresh,
  };
}
