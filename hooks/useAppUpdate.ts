import { useState, useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';
import { useAuthStore } from '../store/authStore';

export interface AppVersionInfo {
  latestVersionCode: number;
  latestVersionName: string;
  apkDownloadUrl: string;
  whatsappGroupUrl?: string;
  releaseNotes: string;
  isMandatory: boolean;
}

// Roles permitted to trigger the FCU broadcast.
// Restricted to prevent race conditions when multiple users open the app simultaneously.
const FCU_BROADCASTER_ROLES = ['admin', 'super_admin', 'developer', 'management'];

const FCU_STORAGE_KEY = 'fcu_announced_version';

/**
 * Sends a one-time broadcast notification to ALL users informing them of the
 * new app version. Guarded by a localStorage key so it only fires once per
 * distinct version name, and only when the current user has an admin-level role.
 */
const sendFcuBroadcast = async (remoteInfo: AppVersionInfo) => {
  const lastAnnounced = localStorage.getItem(FCU_STORAGE_KEY);

  // Skip if this version was already announced from this device
  if (lastAnnounced === remoteInfo.latestVersionName) return;

  const user = useAuthStore.getState().user;
  const userRole = user?.role || '';

  // Mark as announced immediately (even for non-admins) to prevent repeated checks
  localStorage.setItem(FCU_STORAGE_KEY, remoteInfo.latestVersionName);

  // Only admins may trigger the broadcast to avoid duplicate inserts
  if (!FCU_BROADCASTER_ROLES.includes(userRole)) {
    console.log(`[FCU] Skipping broadcast — role '${userRole}' is not permitted to broadcast.`);
    return;
  }

  try {
    const { api } = await import('../services/api');
    await api.broadcastNotification({
      title: `🚀 App Update v${remoteInfo.latestVersionName} Available`,
      message: remoteInfo.releaseNotes ||
        `A new version of Paradigm IFS (v${remoteInfo.latestVersionName}) is available. Please update to access the latest features and improvements.`,
      type: 'info',
      severity: 'Low',
    });
    console.log(`[FCU] Broadcast sent for version ${remoteInfo.latestVersionName}`);
  } catch (err) {
    // Non-critical — do not surface to user. The localStorage key is already set
    // so this won't retry on next launch even if the broadcast failed.
    console.warn('[FCU] Failed to send update broadcast notification:', err);
  }
};

export const useAppUpdate = () => {
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [isUpdateRequired, setIsUpdateRequired] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  // Prevents double-prompting on repeated resume events after update is already detected
  const updateDetectedRef = useRef(false);

  useEffect(() => {
    // Only run on native Android — no-op on web/iOS
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      setIsChecking(false);
      return;
    }

    // ── 1. Initial check on mount ────────────────────────────────────────────
    checkVersion();

    // ── 2. Re-check on EVERY foreground resume ───────────────────────────────
    // Google recommends checking for updates every time the user returns to the
    // app. Without this, a user who backgrounds the app, checks the Play Store,
    // and comes back will never see the update prompt.
    let listenerHandle: { remove: () => void } | null = null;

    const attachResumeListener = async () => {
      listenerHandle = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && !updateDetectedRef.current) {
          // App foregrounded and update modal not already showing — re-check
          console.log('[AppUpdate] App foregrounded — re-checking Play Store...');
          checkVersion();
        }
      });
    };
    attachResumeListener();

    // ── 3. Cleanup listener on unmount ───────────────────────────────────────
    return () => {
      listenerHandle?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkVersion = async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      setIsChecking(false);
      return;
    }

    try {
      console.log('[AppUpdate] Checking Play Store for update...');
      const info = await AppUpdate.getAppUpdateInfo();

      console.log('[AppUpdate] Raw info from Play Store:', {
        updateAvailability: info.updateAvailability,
        currentVersionCode: info.currentVersionCode,
        availableVersionCode: info.availableVersionCode,
        availableVersionName: info.availableVersionName,
        immediateUpdateAllowed: info.immediateUpdateAllowed,
        flexibleUpdateAllowed: info.flexibleUpdateAllowed,
        clientVersionStalenessDays: info.clientVersionStalenessDays,
      });

      const updateAvailable = info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE;

      if (updateAvailable) {
        const latestCode = info.availableVersionCode ? parseInt(String(info.availableVersionCode), 10) : 0;
        const remoteInfo: AppVersionInfo = {
          latestVersionCode: latestCode,
          latestVersionName: info.availableVersionName || `Build ${latestCode}`,
          apkDownloadUrl: 'https://play.google.com/store/apps/details?id=com.paradigm.ifs',
          releaseNotes: 'A new version of Paradigm IFS is available on the Play Store. Please update to get the latest features and security improvements.',
          isMandatory: info.immediateUpdateAllowed || false,
        };

        console.log('[AppUpdate] Update detected! Setting modal visible.', remoteInfo);
        // Mark detected so resume listener doesn't re-trigger
        updateDetectedRef.current = true;
        setUpdateInfo(remoteInfo);
        setIsUpdateRequired(true);

        // Try native immediate update (Google's full-screen overlay).
        // NOTE: Will fail silently if FLAG_SECURE is set on the window —
        // the custom UpdatePromptModal (already rendered in App.tsx) handles the fallback.
        if (info.immediateUpdateAllowed) {
          console.log('[AppUpdate] Launching native immediate update overlay...');
          try {
            await AppUpdate.performImmediateUpdate();
          } catch (immErr) {
            console.warn('[AppUpdate] performImmediateUpdate failed — custom modal is the fallback:', immErr);
          }
        } else if (info.flexibleUpdateAllowed) {
          console.log('[AppUpdate] Starting flexible background download...');
          try {
            await AppUpdate.startFlexibleUpdate();
            console.log('[AppUpdate] Flexible update download started in background.');
          } catch (flexErr) {
            console.warn('[AppUpdate] startFlexibleUpdate failed:', flexErr);
          }
        } else {
          console.log('[AppUpdate] Neither immediate nor flexible allowed — custom modal is the only prompt.');
        }

        // Send FCU broadcast notification (admin-only, fires once per version name)
        await sendFcuBroadcast(remoteInfo);

      } else {
        console.log('[AppUpdate] No update available. updateAvailability =', info.updateAvailability);
        // Reset so future resume events re-check correctly
        updateDetectedRef.current = false;
      }
    } catch (nativeErr) {
      console.warn('[AppUpdate] Native store check failed:', nativeErr);
    } finally {
      setIsChecking(false);
    }
  };

  return { updateInfo, isUpdateRequired, isChecking, checkVersion };
};

