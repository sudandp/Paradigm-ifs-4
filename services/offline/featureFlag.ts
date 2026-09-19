/**
 * Offline-First Feature Flag System
 *
 * Decoupled flags (Section 11.1):
 * - isCaptureEnabled(): Controls whether offline saves are enqueued into outbox.
 * - isDrainEnabled(): Controls whether the syncEngine drains the outbox to Supabase.
 *   ALWAYS enabled so queued items are never stranded if capture is turned off.
 */

export const isCaptureEnabled = (): boolean => {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('paradigm_offline_capture_disabled') === 'true') {
    return false;
  }
  return import.meta.env.VITE_OFFLINE_ENABLED !== 'false';
};

export const isDrainEnabled = (): boolean => true; // Always drain queued items

/** Backward compatibility alias */
export const isOfflineEnabled = (): boolean => isCaptureEnabled();
