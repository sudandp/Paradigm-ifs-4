import { useState, useEffect } from 'react';

export interface KioskTelemetry {
  batteryPercentage: number | null;
  ipAddress: string | null;
  signalStrength: string | null;
}

export function useKioskTelemetry() {
  const [telemetry, setTelemetry] = useState<KioskTelemetry>({
    batteryPercentage: null,
    ipAddress: null,
    signalStrength: null,
  });

  useEffect(() => {
    let isMounted = true;

    // 1. Fetch Battery Status
    const setupBattery = async () => {
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          const updateBattery = () => {
            if (isMounted) {
              setTelemetry((prev) => ({ ...prev, batteryPercentage: Math.round(battery.level * 100) }));
            }
          };
          updateBattery();
          battery.addEventListener('levelchange', updateBattery);
          return () => battery.removeEventListener('levelchange', updateBattery);
        } catch (err) {
          console.warn('[useKioskTelemetry] Error getting battery status:', err);
        }
      }
    };

    let batteryCleanupPromise = setupBattery();

    // 2. Fetch Public IP Address (Cached or fetched safely)
    const fetchIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setTelemetry((prev) => ({ ...prev, ipAddress: data.ip }));
          }
        } else {
          throw new Error('IP service down');
        }
      } catch (err) {
        if (isMounted) {
          setTelemetry((prev) => ({ ...prev, ipAddress: 'Local/LAN' }));
        }
      }
    };

    fetchIp();

    // 3. Fetch Signal Strength (Downlink & Connection Speed)
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      const updateConnection = () => {
        if (!isMounted) return;
        const downlink = conn.downlink; // Megabits per second
        let strength = 'Good';
        if (downlink < 1) strength = 'Poor';
        else if (downlink > 10) strength = 'Excellent';
        setTelemetry((prev) => ({ ...prev, signalStrength: `${strength} (${downlink} Mbps)` }));
      };
      updateConnection();
      conn.addEventListener('change', updateConnection);
    } else {
      if (isMounted) {
        setTelemetry((prev) => ({ ...prev, signalStrength: 'Excellent (Broadband)' }));
      }
    }

    return () => {
      isMounted = false;
      if (conn) {
        conn.removeEventListener('change', () => {});
      }
      batteryCleanupPromise.then((cleanup) => {
        if (cleanup) cleanup();
      });
    };
  }, []);

  return telemetry;
}
