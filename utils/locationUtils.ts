import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Calculate the distance in meters between two coordinates using the Haversine formula.
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Perform a reverse geocode lookup of a coordinate to a human-readable address.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
    const res = await fetch(url);
    if (!res.ok) return fallback;
    const data = await res.json();
    if (data.address) {
      const { road, suburb, city, village, town, state, country } = data.address;
      // Prioritize a concise address: Road, Suburb, and City/Village/Town
      const shortAddress = [road, suburb, city || village || town, state]
        .filter(Boolean)
        .join(', ');
      
      if (shortAddress) return shortAddress;
    }
    
    if (data.display_name) {
      return data.display_name as string;
    }
    return fallback;
  } catch (err) {
    console.warn('Reverse geocode failed:', err);
    return fallback;
  }
}

/**
 * Attempt to obtain a high‑accuracy geolocation fix with multi-stage fallbacks.
 * Skips Capacitor permission checks on web to avoid "Not implemented" errors.
 *
 * Android-optimized: Allows cached positions in fallbacks and includes a
 * navigator.geolocation WebView fallback for maximum reliability.
 */
export async function getPrecisePosition(accuracyThreshold: number = 50, timeoutMs: number = 20000): Promise<GeolocationPosition> {
  // Accessing permissions via Capacitor is only necessary/supported on native platforms (iOS/Android).
  if (Capacitor.isNativePlatform()) {
    try {
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location !== 'granted') {
          const error = new Error('Location permission denied. Please enable location access in settings.');
          (error as any).isPermissionError = true;
          throw error;
        }
      }
    } catch (err) {
      console.warn('Capacitor checkPermissions not available:', err);
    }
  }

  return new Promise((resolve, reject) => {
    (async () => {
      let bestPos: GeolocationPosition | null = null;
      let watchId: string | null = null;
      let resolved = false;

      const safeResolve = (pos: GeolocationPosition) => {
        if (resolved) return;
        resolved = true;
        resolve(pos);
      };

      const timer = setTimeout(async () => {
        if (watchId) {
          try { await Geolocation.clearWatch({ id: watchId }); } catch (_) {
            // ignore error during cleanup
          }
        }

        if (bestPos) {
          safeResolve(bestPos);
          return;
        }

        // Fallback chain: try multiple strategies with increasing leniency
        console.warn('[Location] watchPosition timed out, trying fallback chain...');

        // Fallback 1: Low-accuracy (Wi-Fi/Cell tower) — fast on Android
        try {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000 // Accept cached positions up to 5 minutes old
          });
          console.log('[Location] Fallback 1 (low-accuracy) succeeded, accuracy:', pos.coords.accuracy);
          safeResolve(pos as unknown as GeolocationPosition);
          return;
        } catch (err) {
          console.warn('[Location] Fallback 1 (low-accuracy) failed:', err);
        }

        // Fallback 2: High-accuracy with generous cache
        try {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 300000 // Accept cached positions up to 5 minutes old
          });
          console.log('[Location] Fallback 2 (high-accuracy cached) succeeded, accuracy:', pos.coords.accuracy);
          safeResolve(pos as unknown as GeolocationPosition);
          return;
        } catch (err) {
          console.warn('[Location] Fallback 2 (high-accuracy cached) failed:', err);
        }

        // Fallback 3: navigator.geolocation WebView API — this is what web-app-to-app converters use
        // and is often more reliable on Android because it uses the browser engine's location stack
        // (Wi-Fi triangulation, cell towers, cached GPS from Google Play Services)
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            const webPos = await new Promise<GeolocationPosition>((res, rej) => {
              navigator.geolocation.getCurrentPosition(res, rej, {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000
              });
            });
            console.log('[Location] Fallback 3 (WebView navigator.geolocation) succeeded, accuracy:', webPos.coords.accuracy);
            safeResolve(webPos);
            return;
          } catch (err: any) {
            console.warn('[Location] Fallback 3 (WebView navigator.geolocation) failed:', err);
            if (err.code === 1 || err.message?.toLowerCase().includes('permission')) {
              const pError = new Error('Location permission denied in browser. Please check your browser settings.');
              (pError as any).isPermissionError = true;
              clearTimeout(timer);
              reject(pError);
              return;
            }
          }

          // Fallback 3b: WebView high-accuracy as absolute last resort
          try {
            const webPos = await new Promise<GeolocationPosition>((res, rej) => {
              navigator.geolocation.getCurrentPosition(res, rej, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 600000 // Accept cached up to 10 minutes
              });
            });
            console.log('[Location] Fallback 3b (WebView high-accuracy) succeeded, accuracy:', webPos.coords.accuracy);
            safeResolve(webPos);
            return;
          } catch (err: any) {
            console.warn('[Location] Fallback 3b (WebView high-accuracy) failed:', err);
            if (err.code === 1 || err.message?.toLowerCase().includes('permission')) {
              const pError = new Error('Location permission denied in browser. Please check your browser settings.');
              (pError as any).isPermissionError = true;
              clearTimeout(timer);
              reject(pError);
              return;
            }
          }
        }

        if (!resolved) {
          reject(new Error('GPS Signal Weak. Please ensure you are outdoors or near a window and that location is enabled.'));
        }
      }, timeoutMs);

      try {
        // Start watching for position updates with Capacitor
        // Use maximumAge: 60000 to allow a reasonably recent cached position as initial fix
        watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: timeoutMs,
            maximumAge: 60000 // Allow cached position up to 1 minute for faster initial fix
          },
          (position, err) => {
            if (err) {
              console.warn('[Location] watchPosition error:', err);
              if (err.message?.toLowerCase().includes('permission')) {
                const pError = new Error('Location permission denied. Please check your app settings.');
                (pError as any).isPermissionError = true;
                clearTimeout(timer);
                reject(pError);
              }
              return;
            }

            if (position) {
              const pos = position as unknown as GeolocationPosition;
              if (!bestPos || (pos.coords.accuracy && pos.coords.accuracy < (bestPos.coords.accuracy || Infinity))) {
                bestPos = pos;
                console.log('[Location] watchPosition got fix, accuracy:', pos.coords.accuracy);
              }
              if (pos.coords.accuracy && pos.coords.accuracy <= accuracyThreshold) {
                clearTimeout(timer);
                if (watchId) {
                  Geolocation.clearWatch({ id: watchId }).catch(() => {});
                }
                safeResolve(pos);
              }
            }
          }
        );
      } catch (err) {
        console.error('[Location] Failed to start watchPosition:', err);
        // Don't reject here — the timer fallback chain will handle recovery
      }
    })();
  });
}