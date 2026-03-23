import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check whether the required Firebase configuration values are present.
// When deployed without the VITE_FIREBASE_* env vars, all values will be
// `undefined` and calling `initializeApp` would throw an uncaught
// FirebaseError ("Missing App configuration value: projectId") which
// crashes the entire application and causes the green/white screen.
const hasFirebaseConfig = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

if (hasFirebaseConfig) {
  try {
    app = initializeApp(firebaseConfig);
    // Initialize Firebase Cloud Messaging (browser only)
    if (typeof window !== 'undefined') {
      messaging = getMessaging(app);
    }
  } catch (err) {
    console.error('Firebase initialization failed:', err);
  }
} else {
  console.warn(
    'Firebase configuration (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID) is not set. ' +
    'Push notifications and other Firebase features will be disabled.\n' +
    'To enable Firebase, add the VITE_FIREBASE_* variables to your .env.local file or deployment environment.'
  );
}

export { messaging };
export default app;
