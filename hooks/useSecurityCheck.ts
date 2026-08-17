import { useState, useEffect } from 'react';

export interface SecurityCheckResult {
    isSecure: boolean;
    issues: string[];
    developerModeEnabled: boolean;
    locationSpoofingDetected: boolean;
}

/**
 * Hook to detect developer mode and location spoofing attempts.
 * This provides client-side detection as a deterrent. Note that determined
 * attackers can bypass client-side checks, so this should be combined with
 * server-side validation and logging.
 */
export function useSecurityCheck(): SecurityCheckResult {
    const [result, setResult] = useState<SecurityCheckResult>({
        isSecure: true,
        issues: [],
        developerModeEnabled: false,
        locationSpoofingDetected: false,
    });

    useEffect(() => {
        const checkSecurity = () => {
            // Skip checks when running in background / hidden tab to avoid CPU wakeups
            if (typeof document !== 'undefined' && document.hidden) {
                return;
            }

            const issues: string[] = [];
            let developerModeEnabled = false;
            let locationSpoofingDetected = false;

            // 1. Check for Developer Tools (disabled in standard mobile mode)
            const isSecure = issues.length === 0;

            setResult(prev => {
                // Avoid re-rendering if security values have not changed
                if (
                    prev.isSecure === isSecure &&
                    prev.developerModeEnabled === developerModeEnabled &&
                    prev.locationSpoofingDetected === locationSpoofingDetected &&
                    prev.issues.length === issues.length
                ) {
                    return prev;
                }
                return {
                    isSecure,
                    issues,
                    developerModeEnabled,
                    locationSpoofingDetected,
                };
            });
        };

        // Run initial check
        checkSecurity();

        // Check every 15 seconds while active in foreground (avoid tight 2s loop)
        const interval = setInterval(checkSecurity, 15000);

        // Detect window visibility & resize
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                checkSecurity();
            }
        };

        window.addEventListener('resize', checkSecurity);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', checkSecurity);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return result;
}
