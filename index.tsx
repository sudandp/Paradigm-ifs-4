import { Buffer } from 'buffer';

// Polyfill Buffer & Node globals for browser PDF generation (@react-pdf/renderer)
if (typeof window !== 'undefined') {
  (window as any).Buffer = (window as any).Buffer || Buffer;
  (window as any).global = (window as any).global || window;
  (window as any).process = (window as any).process || { env: {} };
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
  (globalThis as any).global = (globalThis as any).global || globalThis;
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import { SpeedInsights } from "@vercel/speed-insights/react";
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { syncEngine } from './services/offline/syncEngine';
import { checkAndHandleAppUpgrade } from './services/appUpgradeManager';

// Initialize PWA elements for camera support in web browser
defineCustomElements(window);

// Initialize Android safe area insets fallback to prevent system 3-button nav overlap
if (typeof window !== 'undefined') {
  const isAndroid = /android/i.test(navigator.userAgent);
  if (isAndroid) {
    const rootStyle = document.documentElement.style;
    if (!rootStyle.getPropertyValue('--safe-area-inset-bottom')) {
      rootStyle.setProperty('--safe-area-inset-bottom', '48px');
    }
    if (!rootStyle.getPropertyValue('--safe-area-inset-top')) {
      rootStyle.setProperty('--safe-area-inset-top', '24px');
    }
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2 * 60 * 1000, // 2 minutes fresh cache for instantaneous cross-module navigation
      gcTime: 15 * 60 * 1000,    // 15 minutes garbage collection persistence in memory
      refetchOnReconnect: true,
    },
  },
});

async function bootstrap() {
  // 1. Mount React IMMEDIATELY so the user NEVER experiences a blank white screen.
  const root = ReactDOM.createRoot(rootElement!);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <HashRouter {...{ future: { v7_startTransition: true, v7_relativeSplatPath: true } } as any}>
          <App />
          <SpeedInsights />
        </HashRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );

  // 2. Run app upgrade detection & cache maintenance concurrently in the background without blocking the view
  try {
    checkAndHandleAppUpgrade().catch((err) => {
      console.warn('[Bootstrap] Upgrade check background warning:', err);
    });
  } catch (err) {
    console.warn('[Bootstrap] Upgrade check synchronous warning:', err);
  }

  // 3. Start the offline sync engine — listens for reconnect and drains the outbox.
  // No-op when VITE_OFFLINE_ENABLED !== 'true'.
  syncEngine.start();

  // 4. Pre-warm master data caches in background if online (sites, structure, designations)
  import('./services/offline/prefetch')
    .then(({ prefetchMasterData }) => prefetchMasterData().catch(() => {}))
    .catch(() => {});
}

bootstrap();