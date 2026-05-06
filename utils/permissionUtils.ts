import { LocalNotifications } from '@capacitor/local-notifications';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Contacts } from '@capacitor-community/contacts';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { pushNotificationService } from '../services/pushNotificationService';
import { useAlertToneStore } from '../store/alertToneStore';
import { scheduleBreakAlarm, cancelBreakAlarm } from '../plugins/breakAlarmPlugin';

// Notification IDs to ensure we can cancel them specifically
const NOTIFICATION_IDS = {
    SHIFT_END: 1001,
    BREAK_END: 1002,
    RECURRING_BREAK: 2000, // Base ID for recurring break reminders
};

// ─── Web-side break reminder state ──────────────────────────────────────────
// Stores active setInterval IDs so we can cancel them on break-out or re-schedule.
let _webBreakIntervalId: ReturnType<typeof setInterval> | null = null;
let _webBreakEndTimeoutId: ReturnType<typeof setTimeout> | null = null;
let _webBreakStepCount = 0;

/**
 * Show a browser Notification (works on web / PWA).
 * Silently no-ops if permission is not granted.
 */
const showWebNotification = (title: string, body: string) => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    try {
        new Notification(title, { body, icon: '/logos/paradigm-logo.png' });
    } catch (e) {
        console.warn('[WebNotif] Failed to show notification:', e);
    }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isIosWeb = (): boolean => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isIOS && !Capacitor.isNativePlatform();
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

        // ── iOS Web Fast-Path ──────────────────
        // On iOS Web (Safari/PWA), the Permissions API is unsupported or returns unreliable
        // results, and querying geolocation can trigger repeated popups.
        // We bypass all web permission pre-checks and let the app start normally.
        // Actual permission prompts will appear just-in-time when features are used.
        if (isIosWeb()) {
            console.log('[PermissionUtils] iOS Web detected — bypassing web permission pre-check.');
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
        // On iOS Web (Safari/PWA), we don't pre-request permissions.
        // Permissions are requested just-in-time via actual feature use
        // (e.g., geolocation on punch-in) to prevent iOS popup loops.
        if (isIosWeb()) {
            console.log('[PermissionUtils] iOS Web — skipping web permission request sequence.');
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
 * Request notification permissions specifically (legacy support or targeted).
 * Also registers action types and ensures they're set up regardless.
 */
export const requestNotificationPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
        const result = await LocalNotifications.requestPermissions();
        if (result.display === 'granted') {
            await registerBreakNotificationActions();
        } else {
            console.warn('Local notification permissions not granted');
        }
    } catch (error) {
        console.error('Error requesting notification permissions:', error);
    }
};

/**
 * Register action buttons for break reminder notifications.
 * Must be called on app boot (not just on permission grant) so they
 * survive app restarts without re-requesting permissions.
 */
export const registerBreakNotificationActions = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await LocalNotifications.registerActionTypes({
            types: [
                {
                    id: 'BREAK_REMINDER_ACTIONS',
                    actions: [
                        {
                            id: 'CONTINUE_BREAK',
                            title: 'Still on Break ☕',
                            foreground: true,
                        },
                        {
                            id: 'RESUME_WORK',
                            title: 'Break Out Now 🏁',
                            foreground: true,
                            destructive: true,
                        }
                    ]
                }
            ]
        });
        console.log('[PermissionUtils] Break notification actions registered.');
    } catch (error) {
        console.error('[PermissionUtils] Failed to register action types:', error);
    }
};

/**
 * Update the break_reminders Android notification channel with the user's selected tone.
 * Call this when the user changes their preferred alert tone in Settings.
 */
export const updateBreakReminderChannelSound = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const toneFilename = useAlertToneStore.getState().getNativeFilename();
        // If it's a native ringtone, the Java RingtonePlugin already handles the channel.
        // On boot, the channel already exists in Android, so we don't need to touch it.
        if (toneFilename === '__native_ringtone__') {
            console.log(`[PermissionUtils] break_reminders channel uses native system ringtone.`);
            return;
        }

        // Delete and recreate the channel so the new sound takes effect.
        // Android does NOT allow updating the sound of an existing channel once created.
        try { await LocalNotifications.deleteChannel({ id: 'break_reminders' }); } catch (_) {}
        await LocalNotifications.createChannel({
            id: 'break_reminders',
            name: 'Break Status Reminders',
            description: 'Periodic break reminder alerts. Customize the alert tone in Settings.',
            importance: 5,
            visibility: 1,
            sound: toneFilename, // no extension
            vibration: true,
            lights: true,
        });
        console.log(`[PermissionUtils] break_reminders channel updated with sound: ${toneFilename}`);
    } catch (error) {
        console.error('[PermissionUtils] Failed to update break channel sound:', error);
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
    if (!Capacitor.isNativePlatform()) return; // Shift-end reminder stays native-only
 
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
 * Works on both native (LocalNotifications) and web (browser Notification API).
 */
export const scheduleBreakEndReminder = async (breakStartTime: Date, breakDurationMinutes: number = 60) => {
    const endTime = new Date(breakStartTime.getTime() + breakDurationMinutes * 60 * 1000);
    const msUntilEnd = endTime.getTime() - Date.now();
    if (msUntilEnd <= 0) return;

    if (!Capacitor.isNativePlatform()) {
        // Web: use setTimeout to fire a browser notification
        if (_webBreakEndTimeoutId !== null) clearTimeout(_webBreakEndTimeoutId);
        _webBreakEndTimeoutId = setTimeout(() => {
            showWebNotification(
                'Break Over ⏳',
                'Your break time is up. Please resume work!'
            );
            _webBreakEndTimeoutId = null;
        }, msUntilEnd);
        console.log(`[Web] Scheduled break-end reminder in ${Math.round(msUntilEnd / 60000)}m`);
        return;
    }
 
    try {
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'Break Over ⏳',
                    body: 'Your break time is up. Please punch back in!',
                    id: NOTIFICATION_IDS.BREAK_END,
                    schedule: { at: endTime },
                    // Android: reference the filename WITHOUT extension from res/raw/
                    sound: 'beep',
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
 * Schedule recurring break reminders.
 * • Native (Android/iOS): schedules up to 8 LocalNotification one-shots with action buttons.
 *   Uses user-selected alert tone from alertToneStore.
 *   Background-safe: fires even when app is closed.
 * • Web: setInterval that dispatches 'break-alert-trigger' event → BreakAlertModal.
 */
export const scheduleStepBreakReminders = async (startTime: Date, intervalMinutes: number = 15) => {
    // Cancel any previously running reminders first
    await cancelStepBreakReminders();

    if (!Capacitor.isNativePlatform()) {
        // ── Web / PWA path ────────────────────────────────────────────────────
        _webBreakStepCount = 0;
        const intervalMs = intervalMinutes * 60 * 1000;
        _webBreakIntervalId = setInterval(() => {
            _webBreakStepCount++;
            const elapsedMins = _webBreakStepCount * intervalMinutes;

            // Primary: dispatch in-app modal event (foreground)
            window.dispatchEvent(new CustomEvent('break-alert-trigger', {
                detail: { elapsedMinutes: elapsedMins }
            }));

            // Fallback: browser notification when tab is in background
            const displayTime = elapsedMins < 1
                ? `${Math.round(elapsedMins * 60)} seconds`
                : `${Math.round(elapsedMins)} minute${Math.round(elapsedMins) !== 1 ? 's' : ''}`;
            showWebNotification(
                'Break Reminder ☕',
                `You've been on break for ${displayTime}. Open the app to respond.`
            );
        }, intervalMs);
        console.log(`[Web] Break alert timer set — fires every ${intervalMinutes}m (id: ${_webBreakIntervalId})`);
        return;
    }

    // ── Native path (Android) ──────────────────────────────────────────────
    if (Capacitor.getPlatform() === 'android') {
        const toneFilename = useAlertToneStore.getState().getNativeFilename();
        const nativeUri = useAlertToneStore.getState().nativeRingtoneUri;
        for (let i = 1; i <= 8; i++) {
            const triggerTime = new Date(startTime.getTime() + (i * intervalMinutes * 60 * 1000));
            if (triggerTime <= new Date()) continue;
            const elapsedMins = i * intervalMinutes;
            await scheduleBreakAlarm(
                elapsedMins,
                NOTIFICATION_IDS.RECURRING_BREAK + i,
                toneFilename !== '__native_ringtone__' ? toneFilename : undefined,
                nativeUri || undefined
            );
        }
        return;
    }

    // ── Native path (iOS) ────────────────────────────────────────────────────
    try {
        // Ensure action buttons are registered (safe to call multiple times)
        await registerBreakNotificationActions();

        // Get user's selected alert tone
        const toneFilename = useAlertToneStore.getState().getNativeFilename();

        const notifications: any[] = [];
        for (let i = 1; i <= 8; i++) {
            const triggerTime = new Date(startTime.getTime() + (i * intervalMinutes * 60 * 1000));
            if (triggerTime <= new Date()) continue;

            const elapsedMins = i * intervalMinutes;
            const displayTime = elapsedMins < 1
                ? `${Math.round(elapsedMins * 60)} seconds`
                : `${Math.round(elapsedMins)} minute${Math.round(elapsedMins) !== 1 ? 's' : ''}`;

            const notificationPayload: any = {
                title: '🔔 Break Reminder',
                body: `You've been on break for ${displayTime}. Still on break or returning to work?`,
                id: NOTIFICATION_IDS.RECURRING_BREAK + i,
                schedule: { at: triggerTime, allowWhileIdle: true },
                channelId: 'break_reminders',
                actionTypeId: 'BREAK_REMINDER_ACTIONS',
                smallIcon: 'ic_stat_icon_config_sample',
                extra: { elapsedMinutes: elapsedMins }, // read by foreground handler → BreakAlertModal
                ongoing: false,           // dismissible by swipe, but action buttons remain
            };

            // Only add the 'sound' property for built-in res/raw tones.
            // For native URI ringtones, we omit 'sound' and let the channel default handle it.
            if (toneFilename !== '__native_ringtone__') {
                notificationPayload.sound = toneFilename;
            }

            notifications.push(notificationPayload);
        }

        if (notifications.length > 0) {
            await LocalNotifications.schedule({ notifications });
            console.log(`[Native] Scheduled ${notifications.length} break reminders (tone: ${toneFilename}, every ${intervalMinutes}m)`);
        }
    } catch (error) {
        console.error('Failed to schedule step break reminders:', error);
    }
};

/**
 * Restore break reminders after app resume / page reload when user is still on break.
 * Call this from authStore.checkAttendanceStatus() when isOnBreak is true.
 */
export const restoreBreakRemindersOnResume = async (breakStartTime: Date, intervalMinutes: number, breakLimitMinutes: number) => {
    const now = Date.now();
    const startMs = new Date(breakStartTime).getTime();
    const elapsedMs = now - startMs;

    // Only restore if break is still within the allowed break limit
    if (elapsedMs >= breakLimitMinutes * 60 * 1000) return;

    console.log(`[BreakReminder] Restoring reminders — elapsed ${Math.round(elapsedMs / 60000)}m, interval ${intervalMinutes}m`);

    // Use the original breakStartTime so interval steps line up correctly
    await scheduleStepBreakReminders(new Date(breakStartTime), intervalMinutes);
    await scheduleBreakEndReminder(new Date(breakStartTime), breakLimitMinutes);
};

/**
 * Cancel all recurring break reminders (both web setInterval and native LocalNotifications).
 */
export const cancelStepBreakReminders = async () => {
    // ── Web path ─────────────────────────────────────────────────────────────
    if (_webBreakIntervalId !== null) {
        clearInterval(_webBreakIntervalId);
        _webBreakIntervalId = null;
        _webBreakStepCount = 0;
        console.log('[Web] Break step reminders cancelled.');
    }
    if (_webBreakEndTimeoutId !== null) {
        clearTimeout(_webBreakEndTimeoutId);
        _webBreakEndTimeoutId = null;
    }

    if (!Capacitor.isNativePlatform()) return;

    // ── Native path (Android) ────────────────────────────────────────────────
    if (Capacitor.getPlatform() === 'android') {
        for (let i = 1; i <= 8; i++) {
            await cancelBreakAlarm(NOTIFICATION_IDS.RECURRING_BREAK + i);
        }
        return;
    }

    // ── Native path (iOS) ────────────────────────────────────────────────────
    try {
        const pending = await LocalNotifications.getPending();
        const idsToCancel = pending.notifications
            .filter(n => n.id >= NOTIFICATION_IDS.RECURRING_BREAK && n.id < NOTIFICATION_IDS.RECURRING_BREAK + 20)
            .map(n => ({ id: n.id }));

        if (idsToCancel.length > 0) {
            await LocalNotifications.cancel({ notifications: idsToCancel });
            console.log(`Cancelled ${idsToCancel.length} recurring break reminders`);
        }
    } catch (error) {
        console.warn('Error cancelling recurring reminders:', error);
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
