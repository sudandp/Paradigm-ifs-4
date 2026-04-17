import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { useNavigate, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';

import { GOOGLE_CONFIG } from '../config/authConfig';
import { api as apiService } from '../services/api';
import { pushNotificationService } from '../services/pushNotificationService';
import { syncService } from '../services/offline/syncService';
import { usePWAStore } from '../store/pwaStore';
import { useAuthStore } from '../store/authStore';
import { useScreenOrientation } from './useScreenOrientation';

const LAST_PATH_KEY = 'paradigm_lastPath';

const shouldStorePath = (path: string): boolean => {
  if (!path || path === '/') return false;
  
  const ignorePatterns = [
    '/auth',
    '/login',
    '/signup',
    '/onboarding',
    '/blocked-access',
    '/forbidden',
    '/reset-password',
    '/logout',
    '/splash'
  ];

  return !ignorePatterns.some(pattern => path.startsWith(pattern));
};

export const useAppInitialization = (permissionsComplete: boolean) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setDeferredPrompt } = usePWAStore();
  const { user, isInitialized } = useAuthStore();

  useScreenOrientation();

  // Configure StatusBar on native
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    StatusBar.setStyle({ style: Style.Dark }).catch(e => console.warn('[App] StatusBar setStyle failed:', e));
    StatusBar.setBackgroundColor({ color: '#041b0f' }).catch(e => console.warn('[App] StatusBar setBackgroundColor failed:', e));
  }, []);

  // Handle Android hardware back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.minimizeApp();
      }
    });
    return () => { handler.then(h => h.remove()); };
  }, []);

  // Deep link handling
  useEffect(() => {
    const handlePushDeeplink = (e: Event) => {
      const url = (e as CustomEvent).detail?.url;
      if (url) {
        const path = url.startsWith('http') ? new URL(url).pathname : url;
        navigate(path, { replace: true });
      }
    };
    window.addEventListener('push-deeplink', handlePushDeeplink);

    let appUrlListener: any;
    if (Capacitor.isNativePlatform()) {
      appUrlListener = CapacitorApp.addListener('appUrlOpen', (data) => {
        try {
          const url = new URL(data.url);
          const path = url.pathname + url.search;
          if (path && path !== '/') {
            navigate(path, { replace: true });
          }
        } catch (err) {}
      });
    }

    return () => {
      window.removeEventListener('push-deeplink', handlePushDeeplink);
      if (appUrlListener) appUrlListener.then((h: any) => h.remove());
    };
  }, [navigate]);

  // Sync Service & Social Login
  useEffect(() => {
    syncService.init().catch(err => console.error('Failed to initialize sync service:', err));
    
    if (Capacitor.isNativePlatform()) {
      const webClientId = GOOGLE_CONFIG.clientId;
      if (webClientId && !webClientId.includes('your-web-id')) {
        SocialLogin.initialize({
          google: { webClientId: webClientId }
        }).catch(err => console.warn('SocialLogin failed to initialize:', err));
      }
    }
  }, []);

  // Expose API
  useEffect(() => {
    (window as any).api = apiService;
    CapacitorUpdater.notifyAppReady();
  }, []);

  // Push Notifications
  useEffect(() => {
    if (!isInitialized || !permissionsComplete) return;
    pushNotificationService.init();
    pushNotificationService.listen();
  }, [isInitialized, permissionsComplete]);

  // PWA Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [setDeferredPrompt]);

  // Last Path Cache
  useEffect(() => {
    if (user && shouldStorePath(location.pathname + location.search)) {
      localStorage.setItem(LAST_PATH_KEY, location.pathname + location.search);
    }
  }, [location.pathname, location.search, user]);
};
