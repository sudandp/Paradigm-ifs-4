// FIX: Manually define ImportMetaEnv to resolve issues with Vite environment variables not being found.
// This replaces the non-functional /// <reference types="vite/client" />
/// <reference lib="webworker" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_API_KEY: string;
    readonly VITE_API_KEY_1: string;
    readonly VITE_API_KEY_2: string;
    readonly VITE_API_KEY_3: string;
    readonly VITE_API_KEY_4: string;
    readonly VITE_API_KEY_5: string;
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
    readonly VITE_FIREBASE_VAPID_KEY: string;
    readonly VITE_GOOGLE_WEB_CLIENT_ID: string;
    readonly VITE_GOOGLE_ANDROID_CLIENT_ID: string;
    readonly VITE_EMPLOYMENT_AGREEMENT_PDF_URL: string;
    readonly VITE_KYC_VENDOR: string;
    readonly VITE_ESIGN_VENDOR: string;
    readonly VITE_ESIGN_DIGIO_CLIENT_ID: string;
    readonly VITE_ESIGN_DIGIO_CLIENT_SECRET: string;
    readonly VITE_ESIGN_LEEGALITY_AUTH_TOKEN: string;
    readonly VITE_ESIGN_SIGNDESK_APP_ID: string;
    readonly VITE_ESIGN_SIGNDESK_API_KEY: string;
    readonly VITE_KYC_DECENTRO_CLIENT_ID: string;
    readonly VITE_KYC_DECENTRO_CLIENT_SECRET: string;
    readonly VITE_KYC_DECENTRO_MODULE_SECRET: string;
    readonly VITE_KYC_DECENTRO_PROVIDER_SECRET: string;
    readonly VITE_KYC_HYPERVERGE_APP_ID: string;
    readonly VITE_KYC_HYPERVERGE_APP_KEY: string;
    readonly VITE_KYC_SIGNZY_API_KEY: string;
    readonly VITE_KYC_SIGNZY_PATIENT_ID: string;
  }

  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }