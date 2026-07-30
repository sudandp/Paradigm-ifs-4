/**
 * Offline-First Feature Flag
 *
 * Set VITE_OFFLINE_ENABLED=true in .env.local to enable the offline layer.
 * Set to false (or omit) to instantly revert to the original online-only behaviour
 * with zero code changes — no rollback deploy needed.
 */
export const isOfflineEnabled = (): boolean =>
  import.meta.env.VITE_OFFLINE_ENABLED === 'true';
