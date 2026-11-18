/**
 * storageQuota.ts — Paradigm Mobile Storage Quota & Capacity Defense
 *
 * Enforces Phase 5 storage quota monitoring and defense:
 * - 80% threshold: Non-blocking warning banner advising user to sync work.
 * - 95% threshold: Critical block preventing new photo attachments to avoid silent disk write failures.
 */

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  usagePercent: number;
  availableBytes: number;
  isWarning: boolean;   // >= 80%
  isCritical: boolean;  // >= 95%
  statusText: string;
}

/**
 * Queries browser / native WebView storage usage estimate via navigator.storage.estimate().
 */
export async function getStorageQuotaInfo(): Promise<StorageQuotaInfo> {
  let usageBytes = 0;
  let quotaBytes = 0;
  let usagePercent = 0;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage || 0;
      quotaBytes = estimate.quota || 0;
      if (quotaBytes > 0) {
        usagePercent = Math.round((usageBytes / quotaBytes) * 100);
      }
    } catch (err) {
      console.warn('[StorageQuota] navigator.storage.estimate failed:', err);
    }
  }

  const isWarning = usagePercent >= 80;
  const isCritical = usagePercent >= 95;
  const availableBytes = Math.max(0, quotaBytes - usageBytes);

  let statusText = 'Storage healthy';
  if (isCritical) {
    statusText = 'Storage critically full (≥95%). New media attachments blocked.';
  } else if (isWarning) {
    statusText = 'Storage warning (≥80%). Sync work soon to free space.';
  }

  return {
    usageBytes,
    quotaBytes,
    usagePercent,
    availableBytes,
    isWarning,
    isCritical,
    statusText,
  };
}

/**
 * Asserts that the device has sufficient storage space before accepting a new file or photo attachment.
 * Throws an explicit user-facing error if the device storage has exceeded 95% capacity.
 */
export async function assertStorageQuotaAvailable(requiredBytesEstimate: number = 200_000): Promise<void> {
  const quota = await getStorageQuotaInfo();
  if (quota.isCritical) {
    throw new Error(
      `Cannot save attachment: Device local storage is ${quota.usagePercent}% full (limit is 95%). Please sync pending items or free space.`
    );
  }
}
