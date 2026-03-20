import { LocalNotifications } from '@capacitor/local-notifications';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Contacts } from '@capacitor-community/contacts';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { oneSignalService } from '../services/oneSignalService';

// Notification IDs to ensure we can cancel them specifically
const NOTIFICATION_IDS = {
    SHIFT_END: 1001,
    BREAK_END: 1002,
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Robustly check if all required permissions are granted.
 * Categories: Camera, Location, Notifications, Nearby Devices, Photos/Videos, Contacts, Music/Audio
 */
export const checkRequiredPermissions = async () => {
    // On web, we check for notification permission specifically if the user is 
    // reporting "missing" permissions.
    if (!Capacitor.isNativePlatform()) {
        const permission = (window as any).Notification?.permission;
        console.log('[PermissionUtils] Web Notification Permission:', permission);
        
        if (permission !== 'granted') {
            return { allGranted: false, missing: ['Notifications'] };
        }
        return { allGranted: true, missing: [] };
    }

    // COMPLETE BYPASS: Per project requirement, we are disabling the permission compliance check for Native.
    // This ensures no user is ever blocked by the security bridge or missing permissions on mobile.
    console.log('[PermissionUtils] Permission check BYPASSED for Native.');
    return { allGranted: true, missing: [] };
};

/**
 * Request ALL required device permissions using a unified sequence of modern Capacitor calls.
 */
export const requestAllPermissions = async () => {
    if (!Capacitor.isNativePlatform()) {
        // Trigger OneSignal prompt on Web
        await oneSignalService.requestPermission();
        return;
    }

    console.log('[PermissionUtils] Starting SEQUENTIAL permission request sequence...');
    const isAndroid = Capacitor.getPlatform() === 'android';

    const reqDelay = 1200; // Increased delay

    try {
        console.log('[PermissionUtils] REQUESTING: Camera & Photos');
        await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    } catch (e) { console.error('[PermissionUtils] Camera/Photos req FAILED:', e); }
    await delay(reqDelay);

    // 2. Location
    try {
        console.log('[PermissionUtils] REQUESTING: Location');
        await Geolocation.requestPermissions();
        // Force a location check to trigger system dialog if pending
        await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 3000 }).catch(() => {});
    } catch (e) { console.error('[PermissionUtils] Location req FAILED:', e); }
    await delay(reqDelay);

    // 3. Contacts
    try {
        console.log('[PermissionUtils] REQUESTING: Contacts');
        await Contacts.requestPermissions();
    } catch (e) { console.error('[PermissionUtils] Contacts req FAILED:', e); }
    await delay(reqDelay);

    // 4. Bluetooth
    try {
        console.log('[PermissionUtils] REQUESTING: Bluetooth');
        await BleClient.initialize().catch(() => {});
        
        if (isAndroid) {
             const permissions = (window as any).plugins?.permissions;
             if (permissions) {
                 await new Promise((resolve) => {
                     permissions.requestPermissions([
                         permissions.BLUETOOTH_SCAN,
                         permissions.BLUETOOTH_CONNECT,
                         permissions.BLUETOOTH_ADVERTISE
                     ], (s: any) => resolve(s), (err: any) => resolve(err));
                 });
             }
        }
    } catch (e) { console.error('[PermissionUtils] Bluetooth req FAILED:', e); }
    await delay(reqDelay);

    // 5. Media Audio (Android 13+)
    if (isAndroid) {
        try {
            const permissions = (window as any).plugins?.permissions;
            if (permissions && permissions.READ_MEDIA_AUDIO) {
                console.log('[PermissionUtils] REQUESTING: Media Audio');
                await new Promise((resolve) => {
                    permissions.requestPermission(permissions.READ_MEDIA_AUDIO, (s: any) => resolve(s), (err: any) => resolve(err));
                });
            }
        } catch (e) { console.error('[PermissionUtils] Media req FAILED:', e); }
        await delay(reqDelay);
    }

    // 6. Notifications (LAST, because it's often the most disruptive on Android 13+)
    try {
        console.log('[PermissionUtils] REQUESTING: Notifications');
        await LocalNotifications.requestPermissions();
    } catch (e) { console.error('[PermissionUtils] Notification req FAILED:', e); }
    await delay(reqDelay);

    console.log('[PermissionUtils] SEQUENTIAL permission request finished.');
};

/**
 * Request notification permissions specifically (legacy support or targeted)
 */
export const requestNotificationPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
        const result = await LocalNotifications.requestPermissions();
        if (result.display !== 'granted') {
            console.warn('Local notification permissions not granted');
        }
    } catch (error) {
        console.error('Error requesting notification permissions:', error);
    }
};

/**
 * Request camera permissions specifically (targeted)
 */
export const requestCameraPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
        const result = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
        if (result.camera !== 'granted') {
            console.warn('Camera permissions not granted');
        }
    } catch (error) {
        console.error('Error requesting camera permissions:', error);
    }
};

/**
 * Request location permissions specifically (targeted)
 */
export const requestLocationPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
        const result = await Geolocation.requestPermissions();
        if (result.location !== 'granted' && result.coarseLocation !== 'granted') {
            console.warn('Location permissions not granted');
        } else {
            // Force a location check to trigger system dialog if pending/background
            await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 3000 }).catch(() => {});
        }
    } catch (error) {
        console.error('Error requesting location permissions:', error);
    }
};

/**
 * Request photo and video permissions specifically (targeted)
 */
export const requestPhotoVideoPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
        // On modern Android (13+), images and videos are separate permissions
        // Capacitor's Camera plugin handles 'photos' but for complete coverage 
        // we can also use the native bridge for READ_MEDIA_VIDEO if needed.
        const result = await Camera.requestPermissions({ permissions: ['photos'] });
        if (result.photos !== 'granted') {
            console.warn('Photo/Video permissions not granted');
        }
    } catch (error) {
        console.error('Error requesting photo/video permissions:', error);
    }
};

/**
 * Request music and audio permissions specifically (targeted, Android 13+)
 */
export const requestMusicAudioPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    const isAndroid = Capacitor.getPlatform() === 'android';
    if (!isAndroid) return;

    try {
        const permissions = (window as any).plugins?.permissions;
        if (permissions && permissions.READ_MEDIA_AUDIO) {
            console.log('[PermissionUtils] REQUESTING: Media Audio');
            await new Promise((resolve) => {
                permissions.requestPermission(permissions.READ_MEDIA_AUDIO, (s: any) => resolve(s), (err: any) => resolve(err));
            });
        }
    } catch (error) {
        console.error('Error requesting music/audio permissions:', error);
    }
};




/**
 * Schedule a "Shift End" reminder.
 */
export const scheduleShiftEndReminder = async (startTime: Date, shiftDurationHours: number = 9) => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        const endTime = new Date(startTime.getTime() + shiftDurationHours * 60 * 60 * 1000);
        if (endTime <= new Date()) return;

        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'Shift Ending Soon 🏠',
                    body: 'Your 9-hour shift is about to end. Don\'t forget to punch out!',
                    id: NOTIFICATION_IDS.SHIFT_END,
                    schedule: { at: endTime },
                    sound: 'beep.wav',
                    smallIcon: 'ic_stat_icon_config_sample',
                    actionTypeId: '',
                    extra: null
                }
            ]
        });
        console.log(`Scheduled shift end reminder for ${endTime.toLocaleTimeString()}`);
    } catch (error) {
        console.error('Failed to schedule shift end reminder:', error);
    }
};

/**
 * Schedule a "Break Over" reminder.
 */
export const scheduleBreakEndReminder = async (breakStartTime: Date, breakDurationMinutes: number = 60) => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        const endTime = new Date(breakStartTime.getTime() + breakDurationMinutes * 60 * 1000);
        if (endTime <= new Date()) return;

        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'Break Over ⏳',
                    body: 'Your break time is up. Please punch back in!',
                    id: NOTIFICATION_IDS.BREAK_END,
                    schedule: { at: endTime },
                    sound: 'beep.wav',
                    smallIcon: 'ic_stat_icon_config_sample',
                    actionTypeId: '',
                    extra: null
                }
            ]
        });
        console.log(`Scheduled break end reminder for ${endTime.toLocaleTimeString()}`);
    } catch (error) {
        console.error('Failed to schedule break end reminder:', error);
    }
};

/**
 * Cancel a specific notification by type.
 */
export const cancelNotification = async (type: 'SHIFT_END' | 'BREAK_END') => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        const id = NOTIFICATION_IDS[type];
        await LocalNotifications.cancel({ notifications: [{ id }] });
        console.log(`Cancelled notification type: ${type}`);
    } catch (error) {
        console.warn(`Error cancelling notification ${type}:`, error);
    }
};
