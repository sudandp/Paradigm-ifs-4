# Technical Handover Guide

Welcome to the **Paradigm IFS** development team. This document provides the high-level architectural context needed to maintain and extend the system.

## 🏗️ Architecture Overview

The system follows a "Clean Frontend" architecture with a robust service layer that abstracts Supabase and local storage.

### 1. State Management
- **Local State**: Standard React `useState` and `useReducer`.
- **Global State**: [Zustand](https://github.com/pmndrs/zustand) for auth, navigation, and theme state (see `/store`).
- **Server State**: [TanStack Query](https://tanstack.com/query) (React Query) for data fetching, caching, and optimistic updates.

### 2. Service Layer (`/services`)
- **`api.ts`**: The main interface for all data operations. It handles snake_case to camelCase conversion, timeout logic, and error handling.
- **`supabase.ts`**: Client initialization.
- **`offline/database.ts`**: IndexedDB integration for offline-first support in remote field locations.

### 3. Key Modules
- **HR & Onboarding**: Complex form management using `react-hook-form` and `yup` validation.
- **Attendance System**: Geo-fenced check-ins with face/document verification (AI-powered).
- **Inventory & Uniforms**: Site-specific configuration and payroll deduction logic.

## 📱 Mobile Strategy

We use a hybrid approach:
1. **Capacitor Core**: Used for hardware access (Camera, Geolocation, Filesystem).
2. **Native WebView Layer**: Custom wrappers in `android/` and `ios/` ensure the app behaves like a native utility, handling deep links and push notifications properly.

## 🔐 Security & Env Variables

### Environment Variables
The app requires several VITE_ prefixed variables for the frontend:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- `VITE_FIREBASE_*`: For Cloud Messaging.
- `VITE_API_KEY`: For Google Gemini AI features.

### Service Worker Security
The `public/firebase-messaging-sw.js` is **auto-generated** at build time from environment variables to prevent leaking keys in version control while allowing the SW to have the correct configuration.

## 🚀 Deployment

- **Web**: Optimized for **Vercel**. Connect the GitHub repo and it will auto-deploy.
- **Mobile**:
    - **Android**: `npm run build:apk` then open `android/` in Android Studio to sign the AAB.
    - **iOS**: Drag `dist` to the native project or use Capacitor sync.

## 🛠️ Known Patterns & Gotchas
- **CamelCase vs SnakeCase**: The database uses `snake_case`, but the UI uses `camelCase`. Always use the `api.toCamelCase()` helper when fetching.
- **Haptic Feedback**: Integrated into core attendance actions for a premium feel.
- **Offline Outbox**: Pending actions are stored in IndexedDB and synced when connection returns.

---
*Drafted by Antigravity Agent - 2026*
