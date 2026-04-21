import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import Toast from '../ui/Toast';
import { differenceInMinutes } from 'date-fns';
import { Capacitor } from '@capacitor/core';

const BreakTrackingMonitor: React.FC = () => {
    const { isOnBreak, lastBreakInTime, breakLimit, breakReminderInterval } = useAuthStore();
    const [alert, setAlert] = useState<{ message: string; type: 'error' } | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const lastNotifiedIntervalRef = useRef<number>(0); // tracks which interval step was last notified

    // ─── Web Audio beep (foreground only) ───────────────────────────────────
    const playBeep = useCallback(() => {
        try {
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            // Resume if suspended (browser autoplay policy)
            if (ctx.state === 'suspended') ctx.resume();

            // Play two quick beeps for urgency
            [0, 0.35].forEach((delay) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime + delay);
                gain.gain.setValueAtTime(0.35, ctx.currentTime + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.45);
            });
        } catch (e) {
            console.warn('[BreakMonitor] Failed to play alert sound:', e);
        }
    }, []);

    // ─── Browser Notification (works when tab is hidden / PWA background) ───
    const showBrowserNotification = useCallback((elapsedMinutes: number) => {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') {
            Notification.requestPermission();
            return;
        }
        try {
            const n = new Notification('☕ Break Reminder', {
                body: `You've been on break for ${elapsedMinutes} minutes. Still on break?`,
                icon: '/icons/icon-192x192.png',
                tag: 'break-reminder', // replaces previous one instead of stacking
                requireInteraction: true, // stays visible until dismissed
            });
            // Auto-close after 30s if user doesn't interact
            setTimeout(() => n.close(), 30000);
        } catch (e) {
            console.warn('[BreakMonitor] Browser notification failed:', e);
        }
    }, []);

    // ─── Main interval checker ───────────────────────────────────────────────
    useEffect(() => {
        if (!isOnBreak || !lastBreakInTime) {
            setAlert(null);
            lastNotifiedIntervalRef.current = 0;
            return;
        }

        const interval = setInterval(() => {
            const elapsedMinutes = differenceInMinutes(new Date(), new Date(lastBreakInTime));

            // Which reminder step are we on? e.g. 15m → step 1, 30m → step 2 …
            const currentStep = Math.floor(elapsedMinutes / breakReminderInterval);

            // Fire a reminder when we cross into a new step (and it's >= 1st step)
            if (currentStep >= 1 && currentStep > lastNotifiedIntervalRef.current) {
                lastNotifiedIntervalRef.current = currentStep;

                const message = elapsedMinutes >= breakLimit
                    ? `⚠️ Break limit exceeded! You've been on break for ${elapsedMinutes} minutes.`
                    : `☕ Break update: ${elapsedMinutes} minutes on break. Please acknowledge.`;

                setAlert({ message, type: 'error' });

                // On web/PWA: play the Web Audio beep AND fire a browser notification
                if (!Capacitor.isNativePlatform()) {
                    playBeep();
                    showBrowserNotification(elapsedMinutes);
                }
            }

            // Always show the persistent in-app toast once break limit is exceeded
            if (elapsedMinutes >= breakLimit) {
                setAlert({
                    message: `⚠️ Break limit! You've been on break for ${elapsedMinutes} minutes. Break out now!`,
                    type: 'error'
                });
                if (!Capacitor.isNativePlatform()) playBeep();
            }
        }, 60000); // check every minute

        // Immediate first check
        const elapsedNow = differenceInMinutes(new Date(), new Date(lastBreakInTime));
        if (elapsedNow >= breakLimit) {
            setAlert({ message: `⚠️ Break limit! You've been on break for ${elapsedNow} minutes.`, type: 'error' });
        }

        return () => clearInterval(interval);
    }, [isOnBreak, lastBreakInTime, breakLimit, breakReminderInterval, playBeep, showBrowserNotification]);

    if (!alert) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] animate-in fade-in slide-in-from-top-4 duration-300">
            <Toast
                message={alert.message}
                type={alert.type}
                onDismiss={() => setAlert(null)}
            />
        </div>
    );
};

export default BreakTrackingMonitor;
