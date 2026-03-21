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
    // On web, we check for notification and other permissions specifically
    if (!Capacitor.isNativePlatform()) {
        const results: string[] = [];
        
        // 1. Notifications
        const notificationPermission = (window as any).Notification?.permission;
        if (notificationPermission !== 'granted') {
            results.push('Notifications');
        }

        // 2. Geolocation
        try {
            const geoStatus = await navigator.permissions.query({ name: 'geolocation' as any });
            if (geoStatus.state !== 'granted') {
                results.push('Location');
            }
        } catch (e) {}

        // 3. Camera
        try {
            const cameraStatus = await navigator.permissions.query({ name: 'camera' as any });
            if (cameraStatus.state !== 'granted') {
                results.push('Camera');
            }
        } catch (e) {}

        console.log('[PermissionUtils] Web Permissions Missing:', results);
        return { 
            allGranted: results.length === 0, 
            missing: results 
        };
    }

    // NATIVE PLATFORM: Check individual plugins
    const missing: string[] = [];
    
    try {
        const cam = await Camera.checkPermissions();
        if (cam.camera !== 'granted') missing.push('Camera');
        
        const loc = await Geolocation.checkPermissions();
        if (loc.location !== 'granted') missing.push('Location');
        
        const notif = await LocalNotifications.checkPermissions();
        if (notif.display !== 'granted') missing.push('Notifications');
    } catch (e) {
        console.error('[PermissionUtils] Native check error:', e);
    }

    return { 
        allGranted: missing.length === 0, 
        missing 
    };
};

/**
 * Request ALL required device permissions using a unified sequence of modern Capacitor calls.
 */
export const requestAllPermissions = async (onProgress?: (id: string) => void) => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[PermissionUtils] Requesting permissions on Web (Optimized Flow)...');
        const webReqDelay = 800;
        
        // 1. Camera
        try {
            const cameraStatus = await navigator.permissions.query({ name: 'camera' as any });
            if (cameraStatus.state !== 'granted') {
                if (onProgress) onProgress('Camera');
                console.log('[PermissionUtils] Web: Requesting Camera');
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop());
                await delay(webReqDelay);
            } else {
                console.log('[PermissionUtils] Web: Camera already granted, skipping.');
            }
        } catch (e) { 
            console.error('[PermissionUtils] Web Camera req FAILED:', e); 
            // Fallback for browsers that don't support camera query
            try {
                if (onProgress) onProgress('Camera');
                await navigator.mediaDevices.getUserMedia({ video: true }).then(s => s.getTracks().forEach(t => t.stop()));
                await delay(webReqDelay);
            } catch(e2) {}
        }

        // 2. Location
        try {
            const geoStatus = await navigator.permissions.query({ name: 'geolocation' as any });
            if (geoStatus.state !== 'granted') {
                if (onProgress) onProgress('Location');
                console.log('[PermissionUtils] Web: Requesting Location');
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { 
                        enableHighAccuracy: false, 
                        timeout: 10000
                    });
                });
                await delay(webReqDelay);
            } else {
                console.log('[PermissionUtils] Web: Location already granted, skipping.');
            }
        } catch (e) { 
            console.error('[PermissionUtils] Web Location req FAILED:', e); 
            // Fallback
            try {
                if (onProgress) onProgress('Location');
                await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
                await delay(webReqDelay);
            } catch(e2) {}
        }

        // 3. Notifications (OneSignal)
        try {
            const notifPermission = (window as any).Notification?.permission;
            if (notifPermission !== 'granted') {
                if (onProgress) onProgress('Notifications');
                console.log('[PermissionUtils] Web: Requesting Notifications');
                
                // Add a safety timeout to prevent stalling if OneSignal hangs
                await Promise.race([
                    oneSignalService.requestPermission(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Notification request timeout')), 12000))
                ]).catch(e => console.warn('[PermissionUtils] Notification request timed out or failed:', e));

            } else {
                console.log('[PermissionUtils] Web: Notifications already granted, skipping.');
            }
        } catch (e) { console.error('[PermissionUtils] Web OneSignal req FAILED:', e); }

        if (onProgress) onProgress(''); // Clear progress
        return;
    }

    console.log('[PermissionUtils] Starting OPTIMIZED SEQUENTIAL permission request sequence (Native)...');
    const isAndroid = Capacitor.getPlatform() === 'android';
    const reqDelay = 1500; // Slightly longer for native system transitions

    // 1. Camera & Photos
    try {
        const cam = await Camera.checkPermissions();
        if (cam.camera !== 'granted' || cam.photos !== 'granted') {
            if (onProgress) onProgress('Camera');
            console.log('[PermissionUtils] Native: Requesting Camera/Photos');
            await Promise.race([
                Camera.requestPermissions({ permissions: ['camera', 'photos'] }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Camera timeout')), 15000))
            ]);
            await delay(reqDelay);
        } else {
            console.log('[PermissionUtils] Native: Camera/Photos already granted.');
        }
    } catch (e) { console.error('[PermissionUtils] Camera/Photos req FAILED:', e); }

    // 2. Location
    try {
        const loc = await Geolocation.checkPermissions();
        if (loc.location !== 'granted' || loc.coarseLocation !== 'granted') {
            if (onProgress) onProgress('Location');
            console.log('[PermissionUtils] Native: Requesting Location');
            await Promise.race([
                (async () => {
                    await Geolocation.requestPermissions();
                    await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000 }).catch(() => {});
                })(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Location timeout')), 15000))
            ]);
            await delay(reqDelay);
        } else {
            console.log('[PermissionUtils] Native: Location already granted.');
        }
    } catch (e) { console.error('[PermissionUtils] Location req FAILED:', e); }

    // 3. Notifications (Essential for OneSignal)
    try {
        const notif = await LocalNotifications.checkPermissions();
        if (notif.display !== 'granted') {
            if (onProgress) onProgress('Notifications');
            console.log('[PermissionUtils] Native: Requesting Notifications');
            await Promise.race([
                LocalNotifications.requestPermissions(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Notification timeout')), 15000))
            ]);
            await delay(reqDelay);
        } else {
            console.log('[PermissionUtils] Native: Notifications already granted.');
        }
    } catch (e) { console.error('[PermissionUtils] Notification req FAILED:', e); }

    // 4. Contacts (Secondary)
    try {
        const cont = await Contacts.checkPermissions();
        if (cont.contacts !== 'granted') {
            if (onProgress) onProgress('Contacts');
            console.log('[PermissionUtils] Native: Requesting Contacts');
            await Contacts.requestPermissions();
            await delay(reqDelay);
        }
    } catch (e) { console.error('[PermissionUtils] Contacts req FAILED:', e); }

    // 5. Bluetooth (Secondary)
    try {
        await BleClient.initialize().catch(() => {});
        if (isAndroid) {
             if (onProgress) onProgress('Bluetooth');
             console.log('[PermissionUtils] Native: Requesting Bluetooth (Android)');
             const permissions = (window as any).plugins?.permissions;
             if (permissions) {
                 await new Promise((resolve) => {
                     permissions.requestPermissions([
                         permissions.BLUETOOTH_SCAN,
                         permissions.BLUETOOTH_CONNECT,
                         permissions.BLUETOOTH_ADVERTISE
                     ], (s: any) => resolve(s), (err: any) => resolve(err));
                 });
                 await delay(reqDelay);
             }
        }
    } catch (e) { console.error('[PermissionUtils] Bluetooth req FAILED:', e); }

    // 6. Media Audio (Android 13+, Secondary)
    if (isAndroid) {
        try {
            const permissions = (window as any).plugins?.permissions;
            if (permissions && permissions.READ_MEDIA_AUDIO) {
                if (onProgress) onProgress('Media Audio');
                console.log('[PermissionUtils] Native: Requesting Media Audio');
                await new Promise((resolve) => {
                    permissions.requestPermission(permissions.READ_MEDIA_AUDIO, (s: any) => resolve(s), (err: any) => resolve(err));
                });
                await delay(reqDelay);
            }
        } catch (e) { console.error('[PermissionUtils] Media req FAILED:', e); }
    }

    if (onProgress) onProgress('');
    console.log('[PermissionUtils] Native SEQUENTIAL permission request finished.');
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
