import { useState, useEffect, useRef, useCallback } from 'react';

interface IdleTimerProps {
    onIdle: () => void;
    idleTimeout: number; // in ms
    promptTimeout: number; // in ms
    disabled?: boolean;
}

export const useIdleTimer = ({ onIdle, idleTimeout, promptTimeout, disabled = false }: IdleTimerProps) => {
    const [isIdle, setIsIdle] = useState(false);
    const [countdown, setCountdown] = useState(promptTimeout);

    const idleTimerRef = useRef<number | null>(null);
    const promptTimerRef = useRef<number | null>(null);
    const countdownIntervalRef = useRef<number | null>(null);

    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];

    const reset = useCallback(() => {
        if (disabled) return;

        setIsIdle(false);
        setCountdown(promptTimeout);

        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        idleTimerRef.current = window.setTimeout(() => {
            setIsIdle(true);
        }, idleTimeout);
    }, [idleTimeout, promptTimeout, disabled]);

    useEffect(() => {
        if (disabled) return;

        if (isIdle) {
            promptTimerRef.current = window.setTimeout(onIdle, promptTimeout);

            countdownIntervalRef.current = window.setInterval(() => {
                setCountdown(prev => Math.max(0, prev - 1000));
            }, 1000);
        }

        return () => {
            if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, [isIdle, onIdle, promptTimeout, disabled]);

    useEffect(() => {
        if (disabled) return;

        const handleActivity = () => reset();

        events.forEach(event => {
            window.addEventListener(event, handleActivity);
        });

        reset(); // Initialize timer on mount

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, [reset, disabled]);

    return { isIdle, countdown, reset };
};
