import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

/**
 * useScreenOrientation Hook
 * 
 * Locks screen orientation to portrait on native phones.
 * Call this once in your root App component.
 */
export const useScreenOrientation = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const lockPortrait = async () => {
      try {
        await ScreenOrientation.lock({ orientation: 'portrait' });
        console.log('[ScreenOrientation] Locked to portrait');
      } catch (err) {
        console.warn('[ScreenOrientation] Failed to lock orientation:', err);
      }
    };

    lockPortrait();

    return () => {
      // Unlock on cleanup (shouldn't normally happen for root usage)
      ScreenOrientation.unlock().catch(() => {});
    };
  }, []);
};

/**
 * Temporarily unlock orientation (e.g., for charts, reports, media viewer)
 */
export const unlockOrientation = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ScreenOrientation.unlock();
  } catch {}
};

/**
 * Re-lock to portrait after temporary unlock
 */
export const lockToPortrait = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ScreenOrientation.lock({ orientation: 'portrait' });
  } catch {}
};
