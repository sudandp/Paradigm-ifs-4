import { createClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';

// The application was unable to load Supabase credentials from environment variables,
// causing "Failed to fetch" errors. Using the credentials provided for the project.
// Resolve Supabase credentials from Vite environment variables.  In development
// mode the `.env.local` file should define VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY.  When these are not set (for example when running
// the project offline or without a real Supabase backend) fall back to
// harmless dummy values.  This prevents the application from throwing at
// startup and allows it to boot the UI even when Supabase cannot be
// reached.  If the dummy values are used, network calls to Supabase will
// inevitably fail, but the rest of the app can still render and in many
// cases will work with mock data.
export const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_URL
  : process.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_ANON_KEY
  : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

// When credentials are missing log a warning and use dummy values.  Using
// `http://localhost` as the URL and a placeholder anon key is sufficient to
// instantiate the client; the Supabase client will attempt to connect to
// that URL for API calls and fail gracefully.
const resolvedUrl = supabaseUrl || 'http://localhost';
const resolvedAnonKey = supabaseAnonKey || 'public-anon-key';
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        'Supabase credentials (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY) are not set. ' +
        'Using dummy credentials; network requests to Supabase will fail.\n' +
        'To enable real authentication and database features, add VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_ANON_KEY to your .env.local file.'
    );
}

import { Capacitor } from '@capacitor/core';

const isBrowser = typeof window !== 'undefined';
const memStorage: Record<string, string> = {};

/**
 * Hybrid Dual-Layer Storage Adapter:
 * 1. Synchronously reads/writes localStorage for fast, non-blocking UI startup.
 * 2. Asynchronously reads/writes @capacitor/preferences (backed by Android SharedPreferences).
 * 
 * Why this is crucial for Android:
 * Android OS can clear Chromium WebView localStorage when background memory is under pressure
 * or when the app process recycles. Native SharedPreferences (Preferences) are PERMANENT and NEVER cleared
 * by OS memory management.
 * This adapter ensures session tokens are never lost, and if one store is missing tokens, it automatically
 * restores from the other.
 */
const HybridAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (!isBrowser) return memStorage[key] || null;
    
    // 1. Check Capacitor Preferences (Native Persistent Storage)
    try {
      const { value } = await Preferences.get({ key });
      if (value) {
        // Keep localStorage in sync
        try { window.localStorage.setItem(key, value); } catch {
          // Ignore localStorage sync errors in background
        }
        return value;
      }
    } catch (e) {
      console.warn('[HybridAuthStorage] Preferences read notice:', e);
    }

    // 2. Fallback to localStorage
    try {
      const localVal = window.localStorage.getItem(key);
      if (localVal) {
        // Re-persist to Preferences in background
        Preferences.set({ key, value: localVal }).catch(() => {
          // Ignore background re-persist error
        });
        return localVal;
      }
    } catch {
      // Ignore localStorage read errors in restricted contexts
    }

    return memStorage[key] || null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    memStorage[key] = value;
    if (!isBrowser) return;

    // Write to localStorage immediately
    try {
      window.localStorage.setItem(key, value);
    } catch (e: any) {
      console.warn('[HybridAuthStorage] localStorage set warning:', e?.message);
    }

    // Write to Capacitor Preferences (Android SharedPreferences)
    try {
      await Preferences.set({ key, value });
    } catch (e: any) {
      console.warn('[HybridAuthStorage] Preferences set warning:', e?.message);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    delete memStorage[key];
    if (!isBrowser) return;

    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore localStorage removal errors
    }

    try {
      await Preferences.remove({ key });
    } catch {
      // Ignore Preferences removal errors
    }
  },
};

const isNativePlatform = isBrowser && (Capacitor.isNativePlatform() || !!(window as any).Capacitor?.isNativePlatform());

// Custom fetch wrapper with a 15-second timeout to prevent dead socket hangs on mobile
const customFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeoutDuration = 15000; // 15s hard timeout for REST queries
  const timer = setTimeout(() => controller.abort(), timeoutDuration);

  if (init?.signal) {
    init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(input, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
};

// Main client for all requests
export const supabase = createClient(resolvedUrl, resolvedAnonKey, {
    auth: {
        // Persist the session across reloads and tabs.
        persistSession: true,
        // Use Hybrid Dual-Layer Storage on both Web and Native Android
        storage: HybridAuthStorage, 
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Use 'implicit' flow on Web (avoids PKCE code verifier storage issues on web redirects)
        flowType: isNativePlatform ? 'pkce' : 'implicit',
        // Bypass navigator.locks to prevent orphaned lock warnings (5000ms timeouts)
        // during React re-renders, visibility changes, and concurrent getSession calls.
        lock: async (_name, _acquireTimeout, fn) => await fn(),
    },
    global: {
        fetch: customFetch,
    },
});

/**
 * Reconnects the Supabase Realtime client.
 * Essential when returning from 20+ minute background pause to purge dead TCP sockets.
 */
export const reconnectSupabaseRealtime = () => {
  try {
    if (supabase && (supabase as any).realtime) {
      console.log('[SupabaseRealtime] Purging zombie sockets and reconnecting realtime...');
      (supabase as any).realtime.disconnect();
      setTimeout(() => {
        try {
          (supabase as any).realtime.connect();
          console.log('[SupabaseRealtime] ✅ Realtime client reconnected successfully.');
        } catch (connErr) {
          console.warn('[SupabaseRealtime] Reconnection notice:', connErr);
        }
      }, 150);
    }
  } catch (e) {
    console.warn('[SupabaseRealtime] Realtime disconnect/reconnect notice:', e);
  }
};

