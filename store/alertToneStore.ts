// store/alertToneStore.ts
// Persists user's chosen break alert tone across sessions.
// Supports 4 tones: beep (default), classic, gentle, urgent.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AlertToneId = 'beep' | 'alert_urgent';

export interface AlertTone {
    id: AlertToneId;
    label: string;
    description: string;
    /** filename WITHOUT extension — used for both web (/sounds/*.wav) and native (res/raw/*) */
    filename: string;
    emoji: string;
}

export const ALERT_TONES: AlertTone[] = [
    {
        id: 'beep',
        label: 'Standard Beep',
        description: 'Classic single beep',
        filename: 'beep',
        emoji: '🔔',
    },
    {
        id: 'alert_urgent',
        label: 'Urgent Alert',
        description: 'High-pitched rapid double-burst',
        filename: 'alert_urgent',
        emoji: '🚨',
    },
];

interface AlertToneState {
    selectedToneId: AlertToneId;
    /** Android-only: URI of a user-selected system ringtone (overrides selectedToneId on native) */
    nativeRingtoneUri: string | null;
    /** Human-readable name of the native ringtone (e.g. 'Marimba') */
    nativeRingtoneTitle: string | null;
    setTone: (id: AlertToneId) => void;
    /** Set a native ringtone selected from the Android RingtoneManager */
    setNativeRingtone: (uri: string, title: string) => void;
    /** Clear the native ringtone selection and fall back to built-in tones */
    clearNativeRingtone: () => void;
    /** Returns the full web audio path for the current tone (used by BreakAlertModal on web) */
    getWebPath: () => string;
    /** Returns the native sound filename (no extension) for the current tone */
    getNativeFilename: () => string;
    /** Returns the full AlertTone object for the current selection */
    getSelected: () => AlertTone;
    /** True when a native Android ringtone is selected */
    isNativeRingtoneActive: () => boolean;
}

export const useAlertToneStore = create<AlertToneState>()(
    persist(
        (set, get) => ({
            selectedToneId: 'beep',
            nativeRingtoneUri: null,
            nativeRingtoneTitle: null,

            setTone: (id) => set({ selectedToneId: id, nativeRingtoneUri: null, nativeRingtoneTitle: null }),

            setNativeRingtone: (uri, title) =>
                set({ nativeRingtoneUri: uri, nativeRingtoneTitle: title }),

            clearNativeRingtone: () =>
                set({ nativeRingtoneUri: null, nativeRingtoneTitle: null }),

            getWebPath: () => {
                // Native ringtone URIs can't be played by WebView Audio API —
                // fall back to the selected built-in tone for the in-app modal.
                const tone = ALERT_TONES.find(t => t.id === get().selectedToneId) ?? ALERT_TONES[0];
                return `/sounds/${tone.filename}.wav`;
            },

            getNativeFilename: () => {
                // If a system ringtone is active, signal caller with special token.
                // The channel will already be updated with the URI by the native plugin.
                if (get().nativeRingtoneUri) return '__native_ringtone__';
                const tone = ALERT_TONES.find(t => t.id === get().selectedToneId) ?? ALERT_TONES[0];
                return tone.filename;
            },

            getSelected: () => {
                return ALERT_TONES.find(t => t.id === get().selectedToneId) ?? ALERT_TONES[0];
            },

            isNativeRingtoneActive: () => !!get().nativeRingtoneUri,
        }),
        {
            name: 'paradigm:alert-tone',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
