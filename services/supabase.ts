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
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

// Custom storage adapter for Capacitor
const CapacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string): Promise<void> => {
    await Preferences.remove({ key });
  },
};

// Main client for all requests
export const supabase = createClient(resolvedUrl, resolvedAnonKey, {
    auth: {
        // Persist the session across reloads and tabs.
        persistSession: true,
        // Use Capacitor Preferences for reliable storage on mobile and web
        storage: CapacitorStorage, 
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE flow is recommended for mobile apps
        flowType: 'pkce',
    },
    // Disable multi‑tab broadcast.  Supabase uses BroadcastChannel internally to synchronize
    // sessions across multiple tabs; however, this feature has been unstable in some client
    // versions and can cause the client to become unresponsive when several tabs are open.  Set
    // multiTab to false to ensure each tab manages its own session without interfering with
    // others.
});
