import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
// Also load from .env (standard fallback)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const template = `importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
// This file is auto-generated during build. Do not edit directly.
const firebaseConfig = {
  apiKey: "${process.env.VITE_FIREBASE_API_KEY || ''}",
  authDomain: "${process.env.VITE_FIREBASE_AUTH_DOMAIN || ''}",
  projectId: "${process.env.VITE_FIREBASE_PROJECT_ID || ''}",
  storageBucket: "${process.env.VITE_FIREBASE_STORAGE_BUCKET || ''}",
  messagingSenderId: "${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''}",
  appId: "${process.env.VITE_FIREBASE_APP_ID || ''}",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Optional: you can add a listener for background messages here
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new message.',
    icon: '/icons/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click to open page
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.', event);
  event.notification.close();

  const data = event.notification.data || {};
  const link = data.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(link);
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
    })
  );
});
`;

const outputPath = path.resolve(__dirname, '../public/firebase-messaging-sw.js');

try {
  fs.writeFileSync(outputPath, template);
  console.log('Successfully generated public/firebase-messaging-sw.js with environment variables.');
} catch (error) {
  console.error('Error generating firebase-messaging-sw.js:', error);
  process.exit(1);
}
