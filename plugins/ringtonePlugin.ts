// plugins/ringtonePlugin.ts
// TypeScript wrapper for the native RingtonePlugin Capacitor bridge.
// On Android: calls the native Java plugin to open RingtoneManager picker.
// On Web/iOS: returns null (feature not available).
import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

export interface RingtonePickerResult {
    cancelled: boolean;
    uri?: string;       // content URI e.g. "content://media/internal/audio/media/123"
    title?: string;     // human-readable name e.g. "Marimba"
}

export interface RingtonePlugin {
    openRingtonePicker(options?: { currentUri?: string }): Promise<RingtonePickerResult>;
    playRingtone(options: { uri: string; loop?: boolean }): Promise<{ playing: boolean }>;
    stopRingtone(): Promise<{ stopped: boolean }>;
}

// Register — only functional on Android where RingtonePlugin.java is registered
const RingtonePluginNative = registerPlugin<RingtonePlugin>('RingtonePlugin');

/**
 * Opens the Android native ringtone picker.
 * Returns null on non-Android platforms.
 */
export const openRingtonePicker = async (currentUri?: string): Promise<RingtonePickerResult | null> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null;
    try {
        return await RingtonePluginNative.openRingtonePicker(currentUri ? { currentUri } : {});
    } catch (e) {
        console.warn('[RingtonePlugin] openRingtonePicker failed:', e);
        return null;
    }
};

/**
 * Preview a ringtone by URI (plays once, not looping unless specified).
 */
export const previewRingtone = async (uri: string, loop: boolean = false): Promise<void> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    try {
        await RingtonePluginNative.playRingtone({ uri, loop });
    } catch (e) {
        console.warn('[RingtonePlugin] playRingtone failed:', e);
    }
};

/**
 * Stop any currently playing ringtone preview.
 */
export const stopRingtonePreview = async (): Promise<void> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    try {
        await RingtonePluginNative.stopRingtone();
    } catch (e) {
        console.warn('[RingtonePlugin] stopRingtone failed:', e);
    }
};
