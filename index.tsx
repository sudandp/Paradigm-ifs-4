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

// Initialize PWA elements for camera support in web browser
defineCustomElements(window);

// Start the offline sync engine — listens for reconnect and drains the outbox.
// No-op when VITE_OFFLINE_ENABLED !== 'true'.
syncEngine.start();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const root = ReactDOM.createRoot(rootElement);
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