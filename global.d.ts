// FIX: Manually define ImportMetaEnv to resolve issues with Vite environment variables not being found.
// This replaces the non-functional /// <reference types="vite/client" />
/// <reference lib="webworker" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_API_KEY: string;
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
    readonly VITE_FIREBASE_VAPID_KEY: string;
  }

  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }