import { useEffect, useState } from 'react';

interface DeviceInfo {
    deviceId: string;
    deviceName: string;
    browser: string;
    os: string;
    timestamp: string;
}

/**
 * Hook to detect device changes and generate a stable device fingerprint.
 * This tracks when a user switches devices to help security monitoring.
 * Note: This uses localStorage instead of js-cookie to avoid adding a dependency.
 */
export function useDeviceFingerprint() {
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
    const [isNewDevice, setIsNewDevice] = useState(false);
    const [previousDevice, setPreviousDevice] = useState<DeviceInfo | null>(null);

    useEffect(() => {
        const generateDeviceFingerprint = (): DeviceInfo => {
            const userAgent = navigator.userAgent;
            const screenResolution = `${window.screen.width}x${window.screen.height}`;
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const language = navigator.language;
            const platform = navigator.platform;
            const hardwareConcurrency = navigator.hardwareConcurrency || 0;

            // Create a fingerprint from available device information
            const fingerprintString = `${userAgent}|${screenResolution}|${timezone}|${language}|${platform}|${hardwareConcurrency}`;

            // Simple hash function (for production, use a proper hash library)
            let hash = 0;
            for (let i = 0; i < fingerprintString.length; i++) {
                const char = fingerprintString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            const deviceId = 'dev_' + Math.abs(hash).toString(36);

            // Extract browser and OS info
            const getBrowser = () => {
                if (userAgent.indexOf('Chrome') > -1) return 'Chrome';
                if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
                if (userAgent.indexOf('Safari') > -1) return 'Safari';
                if (userAgent.indexOf('Edge') > -1) return 'Edge';
                return 'Unknown';
            };

            const getOS = () => {
                if (userAgent.indexOf('Win') > -1) return 'Windows';
                if (userAgent.indexOf('Mac') > -1) return 'MacOS';
                if (userAgent.indexOf('Linux') > -1) return 'Linux';
                if (userAgent.indexOf('Android') > -1) return 'Android';
                if (userAgent.indexOf('iOS') > -1) return 'iOS';
                return 'Unknown';
            };

            return {
                deviceId,
                deviceName: `${getOS()} - ${getBrowser()}`,
                browser: getBrowser(),
                os: getOS(),
                timestamp: new Date().toISOString(),
            };
        };

        const current = generateDeviceFingerprint();
        setDeviceInfo(current);

        // Check for previous device in localStorage
        const storedDeviceId = localStorage.getItem('device_id');
        const storedDeviceName = localStorage.getItem('device_name');
        const storedTimestamp = localStorage.getItem('device_timestamp');

        if (storedDeviceId && storedDeviceId !== current.deviceId) {
            // Device has changed!
            setIsNewDevice(true);
            setPreviousDevice({
                deviceId: storedDeviceId,
                deviceName: storedDeviceName || 'Unknown Device',
                browser: '',
                os: '',
                timestamp: storedTimestamp || new Date().toISOString(),
            });
        }

        // Store current device in localStorage
        localStorage.setItem('device_id', current.deviceId);
        localStorage.setItem('device_name', current.deviceName);
        localStorage.setItem('device_timestamp', current.timestamp);
    }, []);

    return {
        deviceInfo,
        isNewDevice,
        previousDevice,
    };
}
