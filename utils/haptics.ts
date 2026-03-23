import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Haptic Feedback Utility
 * 
 * Provides tactile feedback on native platforms. All functions are no-ops on web.
 * Use these to make button taps, form submissions, and state changes feel native.
 */

const isNative = () => Capacitor.isNativePlatform();

/** Light tap — for button presses, toggles, selections */
export const lightTap = async () => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
};

/** Medium tap — for confirmations, swipe actions */
export const mediumTap = async () => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
};

/** Heavy tap — for destructive actions, important state changes */
export const heavyTap = async () => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch {}
};

/** Success notification — for completed actions (check-in, form submit) */
export const successVibration = async () => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
};

/** Warning notification — for alerts, validation errors */
export const warningVibration = async () => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {}
};

/** Error notification — for failures, denied actions */
export const errorVibration = async () => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {}
};

/** Quick selection changed vibration */
export const selectionChanged = async () => {
  if (!isNative()) return;
  try {
    await Haptics.selectionChanged();
  } catch {}
};
