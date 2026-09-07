import { useState, useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';
import { useAuthStore } from '../store/authStore';

// Traditional remote version check endpoint — update this file's latestVersionCode
// immediately after publishing to Play Store. No Play Store propagation delay.
const REMOTE_VERSION_URL = 'https://app.paradigmfms.com/version.json';

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
    await api.broadcastAppUpdateNotification({
      version: remoteInfo.latestVersionName,
      buildNumber: remoteInfo.latestVersionCode,
      releaseNotes: remoteInfo.releaseNotes,
      isMandatory: remoteInfo.isMandatory,
      playStoreUrl: remoteInfo.apkDownloadUrl
    });
    console.log(`[FCU] App update FCM broadcast sent for version ${remoteInfo.latestVersionName}`);
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
      // ── STEP 1: Google Play In-App Updates API (PRIMARY & MANDATORY) ──────────
      // This is the authoritative ground truth for Android. It only triggers when
      // Google Play has reviewed, approved, signed, and published the update for this device.
      console.log('[AppUpdate] Checking Google Play Store API for updates (Primary & Mandatory)...');
      const info = await AppUpdate.getAppUpdateInfo();

      console.log('[AppUpdate] Play Store info:', {
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
          releaseNotes: 'A new version of Paradigm IFS is available on Google Play Store. Please update now to continue using the application.',
          isMandatory: true, // MANDATORY: Enforced via Google Play API confirmation
        };

        console.log('[AppUpdate] Google Play update confirmed available! Enforcing mandatory update:', remoteInfo);
        updateDetectedRef.current = true;
        setUpdateInfo(remoteInfo);
        setIsUpdateRequired(true);

        // 1. Attempt native immediate update (Google's official full-screen overlay)
        if (info.immediateUpdateAllowed !== false) {
          console.log('[AppUpdate] Launching native Google Play immediate update overlay...');
          try {
            await AppUpdate.performImmediateUpdate();
          } catch (immErr) {
            console.warn('[AppUpdate] performImmediateUpdate failed — custom modal is the fallback:', immErr);
          }
        } else if (info.flexibleUpdateAllowed) {
          console.log('[AppUpdate] Starting flexible background download...');
          try {
            await AppUpdate.startFlexibleUpdate();
          } catch (flexErr) {
            console.warn('[AppUpdate] startFlexibleUpdate failed:', flexErr);
          }
        }

        await sendFcuBroadcast(remoteInfo);
        return;
      } else {
        console.log('[AppUpdate] Google Play: No update available (or app is already up to date). updateAvailability =', info.updateAvailability);
        updateDetectedRef.current = false;
      }

      // ── STEP 2: Vercel Remote version.json (ON HOLD) ─────────────────────────
      // Kept on hold so deploying web updates to Vercel never falsely triggers update
      // prompts or blocks users while Google Play review is still pending.
      /*
      // ON HOLD: Uncomment only if server-side remote fallback is required in the future.
      const res = await fetch(`${REMOTE_VERSION_URL}?t=${Date.now()}`);
      if (res.ok) {
        const remoteData: AppVersionInfo = await res.json();
        const appInfo = await App.getInfo();
        const currentBuildCode = parseInt(appInfo.build, 10);
        if (currentBuildCode < remoteData.latestVersionCode) {
          setUpdateInfo({ ...remoteData, isMandatory: false });
          setIsUpdateRequired(true);
        }
      }
      */
    } catch (err) {
      console.warn('[AppUpdate] Version check error:', err);
    } finally {
      setIsChecking(false);
    }
  };

  return { updateInfo, isUpdateRequired, isChecking, checkVersion };
};

