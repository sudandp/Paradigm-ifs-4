import { registerPlugin, Capacitor } from '@capacitor/core';

export interface BreakAlarmPlugin {
    schedule(options: {
        triggerAtMs: number;
        id: number;
        elapsedMinutes: number;
        soundFilename?: string;
        soundUri?: string;
    }): Promise<void>;
    
    cancel(options: { id: number }): Promise<void>;
}

const BreakAlarmNative = registerPlugin<BreakAlarmPlugin>('BreakAlarm');

/**
 * Schedule a break alarm at a specific absolute time.
 * @param triggerAtMs  Absolute epoch-ms when the alarm should fire
 * @param id          Unique notification ID
 * @param elapsedMinutes  How many minutes elapsed since break started (for display)
 * @param soundFilename   Optional res/raw filename (no extension)
 * @param soundUri        Optional native ringtone URI
 */
export const scheduleBreakAlarm = async (
    triggerAtMs: number,
    id: number,
    elapsedMinutes: number,
    soundFilename?: string,
    soundUri?: string
): Promise<void> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    try {
        await BreakAlarmNative.schedule({ triggerAtMs, id, elapsedMinutes, soundFilename, soundUri });
    } catch (e) {
        console.warn('[BreakAlarmPlugin] schedule failed:', e);
    }
};

export const cancelBreakAlarm = async (id: number): Promise<void> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    try {
        await BreakAlarmNative.cancel({ id });
    } catch (e) {
        console.warn('[BreakAlarmPlugin] cancel failed:', e);
    }
};
