/**
 * Device Connection Status Utility
 *
 * Identifies whether a user is logged in/connected from:
 * - Laptop (Web / Desktop)
 * - Phone (Android / iOS Mobile App)
 * - Both (Laptop & Phone)
 * - Logged in from Phone, working on Laptop
 */

export interface DeviceConnectionDetails {
  statusText: string;          // e.g. "Logged in from Phone, working on Laptop"
  shortBadgeText: string;      // e.g. "Phone • Working on Laptop"
  connectionType: 'laptop' | 'phone' | 'both' | 'phone_working_laptop';
  hasPhone: boolean;
  hasLaptop: boolean;
  punchedFromPhone: boolean;
  punchedFromLaptop: boolean;
  primaryDeviceLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export function detectDeviceConnectionStatus(
  eventSource?: string,
  deviceName?: string,
  userPlatforms: string[] = []
): DeviceConnectionDetails {
  const src = (eventSource || '').toLowerCase();
  const devName = (deviceName || '').toLowerCase();

  const isAndroidSignal = src.includes('android') || src === 'background_fcm' || devName.includes('android');
  const isIosSignal = src.includes('ios') || devName.includes('iphone') || devName.includes('ipad');
  const isWebSignal = src === 'web' || devName.includes('chrome') || devName.includes('windows') || devName.includes('macintosh') || devName.includes('web');

  const hasPhoneInPlatforms = userPlatforms.includes('android') || userPlatforms.includes('ios');
  const hasWebInPlatforms = userPlatforms.includes('web');

  const hasPhone = isAndroidSignal || isIosSignal || hasPhoneInPlatforms;
  const hasLaptop = isWebSignal || hasWebInPlatforms;

  const punchedFromPhone = isAndroidSignal || isIosSignal;
  const punchedFromLaptop = isWebSignal;

  let primaryDeviceLabel = 'Unknown Device';
  if (isAndroidSignal) primaryDeviceLabel = src === 'background_fcm' ? 'Android (BG Signal)' : 'Android Phone';
  else if (isIosSignal) primaryDeviceLabel = 'iPhone';
  else if (isWebSignal) primaryDeviceLabel = 'Laptop / Web Browser';
  else if (deviceName) primaryDeviceLabel = deviceName;

  // Case 1: Punched in / logged in from phone, but actively working/logged in on laptop
  if ((punchedFromPhone && hasWebInPlatforms) || (hasPhoneInPlatforms && isWebSignal && punchedFromPhone)) {
    return {
      statusText: 'Logged in from Phone, working on Laptop',
      shortBadgeText: 'Phone Punch • Working on Laptop',
      connectionType: 'phone_working_laptop',
      hasPhone: true,
      hasLaptop: true,
      punchedFromPhone: true,
      punchedFromLaptop: false,
      primaryDeviceLabel,
      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
      badgeText: 'text-emerald-700 dark:text-emerald-400',
      badgeBorder: 'border-emerald-500/30'
    };
  }

  // Case 2: Connected / Logged in from Both
  if (hasPhone && hasLaptop) {
    return {
      statusText: 'Logged in from Both (Laptop & Phone)',
      shortBadgeText: 'Connected on Both (Laptop & Phone)',
      connectionType: 'both',
      hasPhone: true,
      hasLaptop: true,
      punchedFromPhone,
      punchedFromLaptop,
      primaryDeviceLabel,
      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
      badgeText: 'text-emerald-600 dark:text-emerald-400',
      badgeBorder: 'border-emerald-500/30'
    };
  }

  // Case 3: Logged in from Laptop only
  if (hasLaptop) {
    return {
      statusText: 'Logged in from Laptop',
      shortBadgeText: 'Logged in from Laptop',
      connectionType: 'laptop',
      hasPhone: false,
      hasLaptop: true,
      punchedFromPhone: false,
      punchedFromLaptop: true,
      primaryDeviceLabel,
      badgeBg: 'bg-blue-500/10 dark:bg-blue-950/40',
      badgeText: 'text-blue-600 dark:text-blue-400',
      badgeBorder: 'border-blue-500/30'
    };
  }

  // Case 4: Logged in from Phone only
  return {
    statusText: 'Logged in from Phone',
    shortBadgeText: 'Logged in from Phone',
    connectionType: 'phone',
    hasPhone: true,
    hasLaptop: false,
    punchedFromPhone: true,
    punchedFromLaptop: false,
    primaryDeviceLabel: isIosSignal ? 'iPhone' : 'Android Phone',
    badgeBg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    badgeBorder: 'border-emerald-500/30'
  };
}
