import { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
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
    if (Capacitor.getPlatform() !== 'android') {
      setIsChecking(false);
      return;
    }

    try {
      // 1. Get current device app version
      const appInfo = await App.getInfo();
      const currentVersionCode = parseInt(appInfo.build, 10);

      // 2. Fetch the latest version info from our public version.json
      // Cache buster included to ensure we get the latest file
      const response = await fetch(`https://app.paradigmfms.com/version.json?t=${new Date().getTime()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch version info');
      }

      const remoteInfo: AppVersionInfo = await response.json();

      // 3. Compare version codes
      if (remoteInfo.latestVersionCode > currentVersionCode) {
        setUpdateInfo(remoteInfo);
        setIsUpdateRequired(true);

        // 4. Send FCU in-app notification broadcast to all users (once per version)
        sendFcuBroadcast(remoteInfo);
      }
    } catch (error) {
      console.error('Error checking for app updates:', error);
    } finally {
      setIsChecking(false);
    }
  };

  return { updateInfo, isUpdateRequired, isChecking, checkVersion };
};
