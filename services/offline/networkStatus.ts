/**
 * Network Status — Paradigm FMS Offline Layer
 *
 * Thin wrapper around @capacitor/network (already installed).
 * Falls back to `navigator.onLine` when running in a plain browser context
 * (web dev, unit tests) where the Capacitor plugin is unavailable.
 *
 * Usage:
 *   isOnline()              → current boolean snapshot
 *   onStatusChange(cb)      → subscribe; returns cleanup fn
 */

import { Network } from '@capacitor/network';

// ─── Internal state ───────────────────────────────────────────────────────────

let _online: boolean =
  typeof navigator !== 'undefined' ? navigator.onLine : true;

let _initialized = false;

// ─── Init (called once by syncEngine.start()) ─────────────────────────────────

export async function initNetworkStatus(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  try {
    const status = await Network.getStatus();
    _online = status.connected;
    Network.addListener('networkStatusChange', (s) => {
      _online = s.connected;
      _listeners.forEach((fn) => fn(s.connected));
    });
  } catch {
    // Plain browser — use window events
    _online = navigator.onLine;
    window.addEventListener('online', () => {
      _online = true;
      _listeners.forEach((fn) => fn(true));
    });
    window.addEventListener('offline', () => {
      _online = false;
      _listeners.forEach((fn) => fn(false));
    });
  }
}

/** Synchronous snapshot of the current network state. */
export function isOnline(): boolean {
  return _online;
}

type StatusCallback = (online: boolean) => void;
const _listeners = new Set<StatusCallback>();

/**
 * Subscribe to network status changes.
 * Returns a cleanup function — call it to unsubscribe.
 *
 * NOTE: Does NOT add a new Capacitor listener per subscriber.
 * The single global listener in initNetworkStatus() updates _online
 * and broadcasts to ALL callbacks in _listeners already.
 */
export function onStatusChange(cb: StatusCallback): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

/**
 * Verifies real end-to-end connectivity by pinging the Supabase backend.
 * `isOnline()` / `navigator.onLine` only tests whether a network interface exists,
 * which is true on captive portals, dead Wi-Fi, and 0-data connections.
 */
export async function isReachable(timeoutMs = 4000): Promise<boolean> {
  if (!isOnline()) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    const { supabaseUrl } = await import('../supabase');
    const targetUrl = `${supabaseUrl}/auth/v1/health`;

    const res = await fetch(targetUrl, {
      method: 'GET',
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}
