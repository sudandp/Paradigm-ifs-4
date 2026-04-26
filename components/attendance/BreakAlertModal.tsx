// components/attendance/BreakAlertModal.tsx
// Full-screen urgent alert modal that fires when the break reminder timer goes off.
// • Web/PWA: shows this modal with looping audio from the user's selected alert tone.
// • Android/iOS: the BreakAlertModal fires in FOREGROUND mode;
//   background alerts are handled by LocalNotifications (native) with action buttons.
// Alarm doesn't stop until user taps "Continue Break" or "Break Out Now".
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, LogIn, Clock, Bell } from 'lucide-react';
import { useBreakAlertStore } from '../../store/breakAlertStore';
import { useAuthStore } from '../../store/authStore';
import { useAlertToneStore } from '../../store/alertToneStore';
import { scheduleStepBreakReminders, cancelStepBreakReminders } from '../../utils/permissionUtils';
import { previewRingtone, stopRingtonePreview } from '../../plugins/ringtonePlugin';

// ─── Interval options (mirrors AttendanceActionPage) ─────────────────────────
const INTERVALS: { label: string; value: number }[] = [
    { label: '10s', value: 0.1666 },
    { label: '1m',  value: 1      },
    { label: '15m', value: 15     },
    { label: '30m', value: 30     },
    { label: '45m', value: 45     },
    { label: '60m', value: 60     },
];

const formatElapsed = (minutes: number): string => {
    if (minutes < 1) return `${Math.round(minutes * 60)} seconds`;
    return `${Math.round(minutes)} minute${Math.round(minutes) !== 1 ? 's' : ''}`;
};

const BreakAlertModal: React.FC = () => {
    const { showModal, elapsedMinutes, dismissAlert } = useBreakAlertStore();
    const { toggleCheckInStatus, breakReminderInterval } = useAuthStore();
    const { getWebPath } = useAlertToneStore();

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const pulseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [selectedInterval, setSelectedInterval] = useState<number>(breakReminderInterval || 0.1666);
    const [isLoading, setIsLoading] = useState(false);
    const [pulse, setPulse] = useState(false);

    // ── Start the looping alarm using selected tone ────────────────────────────
    const startAlarm = useCallback(() => {
        const { isNativeRingtoneActive, nativeRingtoneUri } = useAlertToneStore.getState();

        if (isNativeRingtoneActive() && nativeRingtoneUri) {
            // Play using native Android ringtone API
            previewRingtone(nativeRingtoneUri, true);
        } else {
            // Play using web Audio API
            const audioPath = getWebPath();
            if (!audioRef.current || audioRef.current.src !== window.location.origin + audioPath) {
                if (audioRef.current) {
                    audioRef.current.pause();
                }
                audioRef.current = new Audio(audioPath);
                audioRef.current.loop = true;
            }
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.warn('[BreakAlert] Audio play blocked:', e));
        }
        pulseIntervalRef.current = setInterval(() => setPulse(p => !p), 800);
    }, [getWebPath]);

    const stopAlarm = useCallback(() => {
        const { isNativeRingtoneActive } = useAlertToneStore.getState();
        if (isNativeRingtoneActive()) {
            stopRingtonePreview();
        }

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (pulseIntervalRef.current) {
            clearInterval(pulseIntervalRef.current);
            pulseIntervalRef.current = null;
        }
        setPulse(false);
    }, []);

    // Sync selectedInterval to store's value on open
    useEffect(() => {
        if (showModal) {
            setSelectedInterval(breakReminderInterval || 0.1666);
            startAlarm();
        } else {
            stopAlarm();
        }
        return () => stopAlarm();
    }, [showModal]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handle: Extend Break ───────────────────────────────────────────────────
    const handleContinueBreak = async () => {
        setIsLoading(true);
        stopAlarm();
        try {
            // Local cancel/reschedule
            await cancelStepBreakReminders();
            
            // Sync: Trigger a new 'break-in' event in the database.
            // This will fire the realtime listener on all other devices (like Android),
            // causing them to refresh their status and reset their own reminder timers.
            const { success, message } = await toggleCheckInStatus(
                `Break acknowledged: Still on break (${selectedInterval}m interval)`,
                null,
                'office',
                undefined,
                'break-in',
                selectedInterval
            );

            if (success) {
                // If DB sync succeeded, the local schedule will be handled by the subsequent
                // checkAttendanceStatus refresh, but we can also do it here for immediate feedback.
                await scheduleStepBreakReminders(new Date(), selectedInterval);
                useAuthStore.setState({ breakReminderInterval: selectedInterval });
            } else {
                console.warn('[BreakAlert] Sync failed:', message);
                // Fallback: still try to reschedule locally even if DB sync failed
                await scheduleStepBreakReminders(new Date(), selectedInterval);
            }
        } catch (err) {
            console.warn('[BreakAlert] Failed to acknowledge break:', err);
        } finally {
            setIsLoading(false);
            dismissAlert();
        }
    };

    // ── Handle: Break Out ──────────────────────────────────────────────────────
    const handleBreakOut = async () => {
        setIsLoading(true);
        stopAlarm();
        try {
            await cancelStepBreakReminders();
            const { success, message } = await toggleCheckInStatus(
                'Break out via break alert reminder',
                null,
                'office',
                undefined,
                'break-out'
            );
            if (!success) {
                console.warn('[BreakAlert] Break-out failed:', message);
            }
        } catch (err) {
            console.error('[BreakAlert] Break-out error:', err);
        } finally {
            setIsLoading(false);
            dismissAlert();
        }
    };

    return (
        <AnimatePresence>
            {showModal && (
                <motion.div
                    key="break-alert-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    style={{ background: 'rgba(2, 20, 10, 0.93)', backdropFilter: 'blur(14px)' }}
                >
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.85, opacity: 0, y: 30 }}
                        transition={{ type: 'spring', damping: 18, stiffness: 300 }}
                        className="relative w-full max-w-sm mx-4 rounded-3xl overflow-hidden"
                        style={{
                            background: 'linear-gradient(145deg, #0a2818 0%, #041b0f 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            boxShadow: '0 0 60px rgba(239, 68, 68, 0.25), 0 25px 50px rgba(0,0,0,0.6)',
                        }}
                    >
                        {/* Pulsing border ring */}
                        <motion.div
                            animate={{ scale: pulse ? 1.06 : 1, opacity: pulse ? 0.6 : 0.25 }}
                            transition={{ duration: 0.4 }}
                            className="absolute -inset-0.5 rounded-3xl pointer-events-none"
                            style={{ border: '2px solid rgba(239, 68, 68, 0.8)', background: 'transparent' }}
                        />

                        <div className="relative p-7">
                            {/* Icon */}
                            <div className="flex justify-center mb-5">
                                <motion.div
                                    animate={{ scale: pulse ? 1.15 : 1 }}
                                    transition={{ duration: 0.4 }}
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                        boxShadow: `0 0 ${pulse ? '40px' : '20px'} rgba(239, 68, 68, 0.3)`,
                                    }}
                                >
                                    <Bell className="w-7 h-7 text-red-400" />
                                </motion.div>
                            </div>

                            {/* Title */}
                            <div className="text-center mb-2">
                                <p className="text-[11px] font-black text-red-400 uppercase tracking-[0.2em] mb-1">
                                    Break Reminder
                                </p>
                                <h2 className="text-2xl font-black text-white leading-tight">
                                    Still on break? ☕
                                </h2>
                            </div>

                            {/* Elapsed time */}
                            <div className="flex items-center justify-center gap-2 mb-6">
                                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                <p className="text-sm text-slate-300 font-medium">
                                    You've been on break for{' '}
                                    <span className="text-white font-bold">{formatElapsed(elapsedMinutes)}</span>
                                </p>
                            </div>

                            {/* Continue break — interval selector */}
                            <div
                                className="rounded-2xl p-4 mb-4"
                                style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                }}
                            >
                                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-3">
                                    Remind me again in
                                </p>
                                <div className="grid grid-cols-6 gap-1.5">
                                    {INTERVALS.map(({ label, value }) => (
                                        <button
                                            key={label}
                                            onClick={() => setSelectedInterval(value)}
                                            disabled={isLoading}
                                            className="relative py-2 rounded-xl text-xs font-black transition-all"
                                            style={{
                                                background: selectedInterval === value
                                                    ? 'rgba(16, 185, 129, 0.9)'
                                                    : 'rgba(255,255,255,0.06)',
                                                color: selectedInterval === value ? '#fff' : '#64748b',
                                                border: selectedInterval === value
                                                    ? '1px solid rgba(16,185,129,0.8)'
                                                    : '1px solid rgba(255,255,255,0.06)',
                                                boxShadow: selectedInterval === value
                                                    ? '0 4px 12px rgba(16,185,129,0.3)'
                                                    : 'none',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={handleContinueBreak}
                                    disabled={isLoading}
                                    className="w-full mt-3 py-3 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
                                    style={{
                                        background: isLoading
                                            ? 'rgba(16,185,129,0.4)'
                                            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: '#fff',
                                        boxShadow: '0 8px 20px rgba(16,185,129,0.3)',
                                    }}
                                >
                                    <Coffee className="w-4 h-4" />
                                    {isLoading ? 'Please wait…' : 'Continue Break'}
                                </button>
                            </div>

                            {/* Break Out button */}
                            <button
                                onClick={handleBreakOut}
                                disabled={isLoading}
                                className="w-full py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
                                style={{
                                    background: isLoading
                                        ? 'rgba(239,68,68,0.3)'
                                        : 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                                    color: '#fff',
                                    border: '1px solid rgba(239,68,68,0.4)',
                                    boxShadow: '0 8px 20px rgba(239,68,68,0.25)',
                                }}
                            >
                                <LogIn className="w-4 h-4" />
                                {isLoading ? 'Breaking out…' : 'Break Out Now'}
                            </button>

                            <p className="text-center text-[9px] text-slate-600 mt-4 font-medium">
                                Alarm will keep playing until you make a choice.
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BreakAlertModal;
