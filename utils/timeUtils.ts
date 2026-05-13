export async function getServerTime(): Promise<Date | null> {
    try {
        // Use WorldTimeAPI for an independent time source
        const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', { 
            cache: 'no-store',
            // Small timeout so we don't block the punch if the API is down
            signal: AbortSignal.timeout(3000)
        });
        if (response.ok) {
           const data = await response.json();
           return new Date(data.utc_datetime);
        }
    } catch (e) {
        console.warn('[timeUtils] Failed to fetch server time:', e);
    }
    return null;
}

export async function isDeviceTimeSpoofed(): Promise<{ spoofed: boolean; serverTime?: Date; localTime: Date }> {
    const localTime = new Date();
    try {
        const serverTime = await getServerTime();
        // If we can't get the server time (e.g. offline or API down), we gracefully allow it
        if (!serverTime) return { spoofed: false, localTime }; 
        
        const diffMinutes = Math.abs(serverTime.getTime() - localTime.getTime()) / (1000 * 60);
        
        // Tolerance of 3 minutes for device drift
        return { 
            spoofed: diffMinutes > 3, 
            serverTime,
            localTime
        };
    } catch (e) {
        return { spoofed: false, localTime };
    }
}
