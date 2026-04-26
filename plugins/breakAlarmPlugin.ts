import { registerPlugin, Capacitor } from '@capacitor/core';

export interface BreakAlarmPlugin {
    schedule(options: {
        intervalMinutes: number;
        id: number;
        soundFilename?: string;
        soundUri?: string;
    }): Promise<void>;
    
    cancel(options: { id: number }): Promise<void>;
}

const BreakAlarmNative = registerPlugin<BreakAlarmPlugin>('BreakAlarm');

export const scheduleBreakAlarm = async (intervalMinutes: number, id: number, soundFilename?: string, soundUri?: string): Promise<void> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    try {
        await BreakAlarmNative.schedule({ intervalMinutes, id, soundFilename, soundUri });
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
