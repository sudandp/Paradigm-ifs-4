// components/attendance/AlertTonePicker.tsx
// Settings UI that lets users preview and select their preferred break alert tone.
// On Android: recreates the break_reminders notification channel with the new sound.
// On Web: plays the tone directly via the Audio API for instant preview.
import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Check, Smartphone } from 'lucide-react';
import { useAlertToneStore, ALERT_TONES, type AlertToneId } from '../../store/alertToneStore';
import { updateBreakReminderChannelSound } from '../../utils/permissionUtils';
import { Capacitor } from '@capacitor/core';
import { openRingtonePicker } from '../../plugins/ringtonePlugin';

const AlertTonePicker: React.FC = () => {
    const { selectedToneId, setTone, getWebPath } = useAlertToneStore();
    const previewRef = useRef<HTMLAudioElement | null>(null);

    const handlePreview = (filename: string) => {
        if (previewRef.current) {
            previewRef.current.pause();
            previewRef.current.currentTime = 0;
        }
        previewRef.current = new Audio(`/sounds/${filename}.wav`);
        previewRef.current.play().catch(e => console.warn('[AlertTonePicker] Preview blocked:', e));
    };

    const handleSelect = async (id: AlertToneId, filename: string) => {
        setTone(id);
        handlePreview(filename);

        // On Android, recreate the notification channel with the new sound
        if (Capacitor.isNativePlatform()) {
            try {
                await updateBreakReminderChannelSound();
            } catch (e) {
                console.warn('[AlertTonePicker] Failed to update native channel:', e);
            }
        }
    };

    const handlePickNativeRingtone = async () => {
        const { nativeRingtoneUri, setNativeRingtone } = useAlertToneStore.getState();
        const result = await openRingtonePicker(nativeRingtoneUri || undefined);
        
        if (result && !result.cancelled && result.uri) {
            setNativeRingtone(result.uri, result.title || 'Custom Ringtone');
        }
    };

    // To check if a specific native ringtone is currently active
    const { isNativeRingtoneActive, nativeRingtoneTitle } = useAlertToneStore();
    const isNativeActive = isNativeRingtoneActive();

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">
                    Break Alert Tone
                </h3>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Choose the sound that plays when your break reminder fires. Tap a tone to preview it.
            </p>

            <div className="space-y-2">
                {ALERT_TONES.map((tone) => {
                    const isSelected = selectedToneId === tone.id && !isNativeActive;
                    return (
                        <motion.button
                            key={tone.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSelect(tone.id, tone.filename)}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
                            style={{
                                background: isSelected
                                    ? 'rgba(16, 185, 129, 0.12)'
                                    : 'rgba(255,255,255,0.04)',
                                border: isSelected
                                    ? '1px solid rgba(16,185,129,0.5)'
                                    : '1px solid rgba(255,255,255,0.08)',
                            }}
                        >
                            {/* Emoji */}
                            <span className="text-2xl w-10 text-center flex-shrink-0">
                                {tone.emoji}
                            </span>

                            {/* Labels */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white">
                                    {tone.label}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    {tone.description}
                                </p>
                            </div>

                            {/* Selected indicator */}
                            <div
                                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                    background: isSelected
                                        ? 'rgba(16,185,129,0.9)'
                                        : 'rgba(255,255,255,0.08)',
                                    border: isSelected
                                        ? '1px solid rgba(16,185,129,1)'
                                        : '1px solid rgba(255,255,255,0.15)',
                                }}
                            >
                                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                            </div>
                        </motion.button>
                    );
                })}

                {/* Native Ringtone Picker (Android Only) */}
                {Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && (
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={handlePickNativeRingtone}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all mt-2"
                        style={{
                            background: isNativeActive
                                ? 'rgba(16, 185, 129, 0.12)'
                                : 'rgba(255,255,255,0.04)',
                            border: isNativeActive
                                ? '1px solid rgba(16,185,129,0.5)'
                                : '1px solid rgba(255,255,255,0.08)',
                        }}
                    >
                        <span className="text-xl w-10 text-center flex-shrink-0 flex items-center justify-center text-indigo-400">
                            <Smartphone className="w-6 h-6" />
                        </span>
                        
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">
                                Pick from Device
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                {isNativeActive ? nativeRingtoneTitle : 'Select a custom system ringtone'}
                            </p>
                        </div>

                        <div
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                                background: isNativeActive
                                    ? 'rgba(16,185,129,0.9)'
                                    : 'rgba(255,255,255,0.08)',
                                border: isNativeActive
                                    ? '1px solid rgba(16,185,129,1)'
                                    : '1px solid rgba(255,255,255,0.15)',
                            }}
                        >
                            {isNativeActive && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                    </motion.button>
                )}
            </div>

            <p className="text-[10px] text-slate-600 mt-4 text-center">
                {Capacitor.isNativePlatform()
                    ? 'The notification channel will be updated immediately.'
                    : 'This tone plays in the browser when a break reminder fires.'}
            </p>
        </div>
    );
};

export default AlertTonePicker;
