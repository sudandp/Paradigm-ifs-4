importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
// Update these values with your actual Firebase config if they change!
const firebaseConfig = {
  apiKey: "AIzaSyDOdfKUXBH4T2_mCk9QSYb4lFL9DP4N--o",
  authDomain: "paradigm-ifs.firebaseapp.com",
  projectId: "paradigm-ifs",
  storageBucket: "paradigm-ifs.firebasestorage.app",
  messagingSenderId: "447552978158",
  appId: "1:447552978158:web:58c079f59d00d8940bc7ff",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Optional: you can add a listener for background messages here
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here if needed
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new message.',
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
