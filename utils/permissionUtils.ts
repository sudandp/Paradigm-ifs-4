import { LocalNotifications } from '@capacitor/local-notifications';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Contacts } from '@capacitor-community/contacts';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { pushNotificationService } from '../services/pushNotificationService';

// Notification IDs to ensure we can cancel them specifically
const NOTIFICATION_IDS = {
    SHIFT_END: 1001,
    BREAK_END: 1002,
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Detect if running as an iOS standalone/PWA (Add to Home Screen) app.
 * navigator.standalone is an iOS-only property, true when launched from Home Screen.
 */
const isIosStandalone = (): boolean => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isStandalone =
        (window.navigator as any).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;
    return isIOS && isStandalone;
};

/**
 * Safely query the Permissions API with fallback for unsupported browsers.
 * iOS Safari (especially in PWA/standalone mode) does NOT support
 * navigator.permissions.query for camera/geolocation — it throws or returns null.
 * Returns null when unsupported (caller should treat null as "don't block").
 */
const safePermissionQuery = async (name: string): Promise<PermissionState | null> => {
    try {
        if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
            return null;
        }
        const result = await navigator.permissions.query({ name: name as PermissionName });
        return result.state;
    } catch (_e) {
        return null;
    }
};

/**
 * Robustly check if all required permissions are granted.
 * Categories: Camera, Location, Notifications, Nearby Devices, Photos/Videos, Contacts, Music/Audio
 */
export const checkRequiredPermissions = async () => {
    // ─── Web Platform ────────────────────────────────────────────────────────
    if (!Capacitor.isNativePlatform()) {
        const missing: string[] = [];

        // ── iOS Standalone (Add to Home Screen) Fast-Path ──────────────────
        // On iOS PWA, the Permissions API is unsupported or returns unreliable
        // results, and querying geolocation can trigger repeated popups.
        // We bypass all web permission pre-checks and let the app start normally.
        // Actual permission prompts will appear just-in-time when features are used.
        if (isIosStandalone()) {
            console.log('[PermissionUtils] iOS standalone detected — bypassing web permission pre-check.');
            return { allGranted: true, missing: [] };
        }

        // 1. Camera check — safe query, defaults to not-blocking if unsupported
        const camStatus = await safePermissionQuery('camera');
        if (camStatus !== null && camStatus !== 'granted') missing.push('Camera');

        // 2. Location check — safe query, defaults to not-blocking if unsupported
        const locStatus = await safePermissionQuery('geolocation');
        if (locStatus !== null && locStatus !== 'granted') missing.push('Location');

        // 3. Notifications check (Unified)
        const notifPermission = (window as any).Notification?.permission || 'default';
        
        // Notifications are NON-BLOCKING on Web (Browsers/PWA)
        // because browsers often suppress prompts in Incognito or specific contexts.
        if (notifPermission !== 'granted') {
            missing.push('Notifications');
        }

        const isNative = Capacitor.isNativePlatform();
        const criticalMissing = missing.filter(p => isNative || p !== 'Notifications');

        console.log('[PermissionUtils] Web Permissions Status:', { missing, criticalMissing });
        return { 
            allGranted: criticalMissing.length === 0, 
            missing: missing 
        };
    }

    // ─── Native Platform ─────────────────────────────────────────────────────
    const missing: string[] = [];
    const isAndroid = Capacitor.getPlatform() === 'android';

    try {
        // 1. Camera
        const cam = await Camera.checkPermissions();
        if (cam.camera !== 'granted') missing.push('Camera');
        
        // 2. Photos & Videos
        if (cam.photos !== 'granted') missing.push('Photos/Videos');
        
        // 3. Location
        const loc = await Geolocation.checkPermissions();
        if (loc.location !== 'granted') missing.push('Location');
        
        // 4. Notifications
        const notif = await LocalNotifications.checkPermissions();
        if (notif.display !== 'granted') missing.push('Notifications');

        // 5. Contacts
        const cont = await Contacts.checkPermissions();
        if (cont.contacts !== 'granted') missing.push('Contacts');

        // 6. Bluetooth (Nearby Devices)
        if (isAndroid) {
            const permissions = (window as any).plugins?.permissions;
            if (permissions) {
                const results = await new Promise<any>((resolve) => {
                    permissions.hasPermission(permissions.BLUETOOTH_SCAN, (status: any) => resolve(status));
                });
                if (!results?.hasPermission) missing.push('Bluetooth');
            }
        }

        // 7. Music & Audio (Android 13+)
        if (isAndroid) {
            const permissions = (window as any).plugins?.permissions;
            if (permissions && permissions.READ_MEDIA_AUDIO) {
                const results = await new Promise<any>((resolve) => {
                    permissions.hasPermission(permissions.READ_MEDIA_AUDIO, (status: any) => resolve(status));
                });
                if (!results?.hasPermission) missing.push('Music');
            }
        }
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
export const requestAllPermissions = async (onProgress?: (id: string, missing: string[]) => void) => {
    const reCheck = async (currentId: string) => {
        const { missing } = await checkRequiredPermissions();
        if (onProgress) onProgress(currentId, missing);
        return missing;
    };

    if (!Capacitor.isNativePlatform()) {
    
    console.log('[PermissionUtils] Requesting permissions on Web (Optimized Flow)...');
        
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const webReqDelay = isSafari ? 400 : 800;
        // On iOS standalone (PWA), we don't pre-request permissions.
        // Permissions are requested just-in-time via actual feature use
        // (e.g., geolocation on punch-in) to prevent iOS popup loops.
        if (isIosStandalone()) {
            console.log('[PermissionUtils] iOS standalone — skipping web permission request sequence.');
            if (onProgress) onProgress('', []);
            return;
        }

        // 1. Notifications
        try {
            const notifPermission = (window as any).Notification?.permission || 'default';
            if (notifPermission !== 'granted' && notifPermission !== 'denied') {
                if (onProgress) onProgress('Notifications', (await checkRequiredPermissions()).missing);
                try {
                    await Promise.race([
                        pushNotificationService.init(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
                    ]);
                } catch (e) {
                    console.warn('[PermissionUtils] Notification request suppressed or timed out');
                }
                await reCheck('Notifications');
                await delay(webReqDelay);
            }
        } catch (e) { console.error('Web notif req failed', e); }
        
        // 2. Camera
        try {
            let { missing } = await checkRequiredPermissions();
            if (missing.includes('Camera')) {
                if (onProgress) onProgress('Camera', missing);
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop());
                await reCheck('Camera');
                await delay(webReqDelay);
            }
        } catch (e) { console.error('Web Camera req failed', e); }

        // 3. Location — Only request if permission is NOT already granted or denied.
        // On iOS Safari (in-browser), requesting this will show the native prompt.
        // We NEVER call this in iOS standalone mode (handled by early return above).
        try {
            let { missing } = await checkRequiredPermissions();
            if (missing.includes('Location')) {
                if (onProgress) onProgress('Location', missing);
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { 
                        enableHighAccuracy: false, 
                        timeout: 10000
                    });
                });
                await reCheck('Location');
                await delay(webReqDelay);
            }
        } catch (e) { console.error('Web Location req failed', e); }

        if (onProgress) onProgress('', (await checkRequiredPermissions()).missing);
        return;
    }

    console.log('[PermissionUtils] Starting Native sequential request sequence...');
    const reqDelay = 1000;

    // 1. Camera
    try {
        let { missing } = await checkRequiredPermissions();
        if (missing.includes('Camera')) {
            if (onProgress) onProgress('Camera', missing);
            await Camera.requestPermissions({ permissions: ['camera'] });
            await reCheck('Camera');
            await delay(reqDelay);
        }
    } catch (e) { console.error('Camera req failed', e); }

    // 2. Photos & Videos
    try {
        let { missing } = await checkRequiredPermissions();
        if (missing.includes('Photos/Videos')) {
            if (onProgress) onProgress('Photos/Videos', missing);
            await Camera.requestPermissions({ permissions: ['photos'] });
            await reCheck('Photos/Videos');
            await delay(reqDelay);
        }
    } catch (e) { console.error('Photos req failed', e); }

    // 3. Location
    try {
        let { missing } = await checkRequiredPermissions();
        if (missing.includes('Location')) {
            if (onProgress) onProgress('Location', missing);
            await Geolocation.requestPermissions();
            
            // Note: iOS 14+ hangs natively if we call getCurrentPosition immediately after requestPermissions
            // We removed the 'single shot' trigger here to prevent freezing the native Capacitor bridge.
            
            await reCheck('Location');
            await delay(reqDelay);
        }
    } catch (e) { console.error('Location req failed', e); }

    // 4. Notifications
    try {
        let { missing } = await checkRequiredPermissions();
        if (missing.includes('Notifications')) {
            if (onProgress) onProgress('Notifications', missing);
            await LocalNotifications.requestPermissions();
            await reCheck('Notifications');
            await delay(reqDelay);
        }
    } catch (e) { console.error('Notification req failed', e); }

    // 5. Contacts
    try {
        let { missing } = await checkRequiredPermissions();
        if (missing.includes('Contacts')) {
            if (onProgress) onProgress('Contacts', missing);
            await Contacts.requestPermissions();
            await reCheck('Contacts');
            await delay(reqDelay);
        }
    } catch (e) { console.error('Contacts req failed', e); }

    // 6. Bluetooth
    try {
        let { missing } = await checkRequiredPermissions();
        if (missing.includes('Bluetooth')) {
            if (onProgress) onProgress('Bluetooth', missing);
            const permissions = (window as any).plugins?.permissions;
            if (permissions) {
                await new Promise((resolve) => {
                    permissions.requestPermissions([
                        permissions.BLUETOOTH_SCAN,
                        permissions.BLUETOOTH_CONNECT,
                        permissions.BLUETOOTH_ADVERTISE
                    ], resolve, resolve);
                });
            }
            await reCheck('Bluetooth');
            await delay(reqDelay);
        }
    } catch (e) { console.error('Bluetooth req failed', e); }

    // 7. Music
    try {
        let { missing } = await checkRequiredPermissions();
        if (missing.includes('Music')) {
            if (onProgress) onProgress('Music', missing);
            const permissions = (window as any).plugins?.permissions;
            if (permissions && permissions.READ_MEDIA_AUDIO) {
                await new Promise((resolve) => {
                    permissions.requestPermission(permissions.READ_MEDIA_AUDIO, resolve, resolve);
                });
            }
            await reCheck('Music');
            await delay(reqDelay);
        }
    } catch (e) { console.error('Music req failed', e); }

    if (onProgress) onProgress('', (await checkRequiredPermissions()).missing);
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
        }
        // Removed the getCurrentPosition trigger here to prevent native thread deadlocks on iOS
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
