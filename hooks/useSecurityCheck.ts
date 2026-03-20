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
            const issues: string[] = [];
            let developerModeEnabled = false;
            let locationSpoofingDetected = false;

            // 1. Check for Developer Tools (various methods)
            const devToolsCheck = () => {
                // Disable check for development/demo
                return false;

                /* 
                const threshold = 160;
                const widthThreshold = window.outerWidth - window.innerWidth > threshold;
                const heightThreshold = window.outerHeight - window.innerHeight > threshold;

                // Check console redirection
                const isConsoleRedirected = /./['toString']().length > 1;

                return widthThreshold || heightThreshold || isConsoleRedirected;
                */
            };

            if (devToolsCheck()) {
                developerModeEnabled = true;
                issues.push('Developer tools detected. Please close developer tools to continue.');
            }

            // 2. Check for location spoofing indicators
            const checkLocationSpoofing = () => {
                // Check if geolocation is available
                if (!('geolocation' in navigator)) {
                    return false;
                }

                // Check for common location spoofing extensions/tools
                // These checks look for fingerprints left by spoofing tools
                const spoofingIndicators = [
                    // Check if permissions API shows inconsistent geolocation state
                    () => {
                        if ('permissions' in navigator) {
                            return new Promise<boolean>((resolve) => {
                                navigator.permissions.query({ name: 'geolocation' as PermissionName })
                                    .then(result => {
                                        // If permission is granted but coords are suspiciously precise or unrealistic
                                        if (result.state === 'granted') {
                                            navigator.geolocation.getCurrentPosition(
                                                (pos) => {
                                                    // Check for unrealistic accuracy (common in spoofing)
                                                    const suspiciouslyPrecise = pos.coords.accuracy < 1;
                                                    const zeroAltitude = pos.coords.altitude === null && pos.coords.altitudeAccuracy === null;
                                                    resolve(suspiciouslyPrecise && zeroAltitude);
                                                },
                                                () => resolve(false),
                                                { maximumAge: 0, timeout: 1000, enableHighAccuracy: true }
                                            );
                                        } else {
                                            resolve(false);
                                        }
                                    })
                                    .catch(() => resolve(false));
                            });
                        }
                        return Promise.resolve(false);
                    }
                ];

                // For now, return false as location spoofing detection requires async checks
                // and we're in a sync function. We could enhance this later.
                return false;
            };

            if (checkLocationSpoofing()) {
                locationSpoofingDetected = true;
                issues.push('Location spoofing detected. Please disable location mocking apps to continue.');
            }

            const isSecure = issues.length === 0;

            setResult({
                isSecure,
                issues,
                developerModeEnabled,
                locationSpoofingDetected,
            });
        };

        // Run initial check
        checkSecurity();

        // Set up periodic checks every 2 seconds
        const interval = setInterval(checkSecurity, 2000);

        // Detect developer tools opening via resize
        window.addEventListener('resize', checkSecurity);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', checkSecurity);
        };
    }, []);

    return result;
}
