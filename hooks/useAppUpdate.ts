import { useState, useEffect } from 'react';
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

  useEffect(() => {
    checkVersion();
  }, []);

  const checkVersion = async () => {
    // Only run on native Android
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
        setUpdateInfo(remoteInfo);
        setIsUpdateRequired(true);

        // Try native immediate update (Google's full-screen overlay) — only if Play Store allows it
        // For Early Access apps, immediateUpdateAllowed is typically false; we fall back to our in-app modal
        if (info.immediateUpdateAllowed) {
          console.log('[AppUpdate] Launching native immediate update overlay...');
          try {
            await AppUpdate.performImmediateUpdate();
          } catch (immErr) {
            console.warn('[AppUpdate] performImmediateUpdate failed, modal will handle it:', immErr);
          }
        } else if (info.flexibleUpdateAllowed) {
          console.log('[AppUpdate] Immediate not allowed, flexible update available — showing in-app modal.');
          // Start flexible download in background silently
          try {
            await AppUpdate.startFlexibleUpdate();
            console.log('[AppUpdate] Flexible update download started in background.');
          } catch (flexErr) {
            console.warn('[AppUpdate] startFlexibleUpdate failed:', flexErr);
          }
        } else {
          console.log('[AppUpdate] Neither immediate nor flexible allowed by Play Store — showing in-app modal only.');
        }

        // Send FCU broadcast notification
        await sendFcuBroadcast(remoteInfo);

      } else {
        console.log('[AppUpdate] No update available. updateAvailability =', info.updateAvailability);
      }
    } catch (nativeErr) {
      console.warn('[AppUpdate] Native store check failed:', nativeErr);
    } finally {
      setIsChecking(false);
    }
  };

  return { updateInfo, isUpdateRequired, isChecking, checkVersion };
};

