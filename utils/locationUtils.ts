import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Global promise to track an active location request.
 * This ensures that multiple components calling getPrecisePosition
 * simultaneously will wait for the same underlying hardware request
 * rather than firing overlapping permission prompts.
 */
let activeLocationPromise: Promise<GeolocationPosition> | null = null;

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
 * Prevents overlapping requests to avoid permission loops on iOS Safari.
 */
export async function getPrecisePosition(accuracyThreshold: number = 50, timeoutMs: number = 20000): Promise<GeolocationPosition> {
  // If a request is already in progress, wait for it instead of starting a new one
  if (activeLocationPromise) {
    console.log('[Location] Joining existing location request flow...');
    return activeLocationPromise;
  }

  activeLocationPromise = (async () => {
    try {
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

      return await new Promise<GeolocationPosition>((resolve, reject) => {
        (async () => {
          let bestPos: GeolocationPosition | null = null;
          let watchId: string | null = null;
          let resolved = false;
          let isFallbackChainActive = false;

          const safeResolve = (pos: GeolocationPosition) => {
            if (resolved) return;
            resolved = true;
            resolve(pos);
          };

          const cleanup = async () => {
            if (watchId) {
              try { await Geolocation.clearWatch({ id: watchId }); } catch (_) {}
              watchId = null;
            }
          };

          // Timer for the primary high-accuracy watch
          const timer = setTimeout(async () => {
            if (resolved || isFallbackChainActive) return;
            
            isFallbackChainActive = true;
            console.warn('[Location] Primary match timed out, starting serial fallbacks');

            // Fallback chain: try multiple strategies SERIALY to avoid overlapping prompts on iOS
            
            // Fallback 1: High-accuracy with generous cache (Fastest if GPS was recently on)
            try {
              const pos = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 300000 
              });
              console.log('[Location] Fallback 1 (cached) succeeded');
              await cleanup();
              safeResolve(pos as unknown as GeolocationPosition);
              return;
            } catch (err) {
              console.warn('[Location] Fallback 1 failed');
            }

            // Fallback 2: Low-accuracy WebView API (Safest for Web/iOS)
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
              try {
                const webPos = await new Promise<GeolocationPosition>((res, rej) => {
                  navigator.geolocation.getCurrentPosition(res, rej, {
                    enableHighAccuracy: false,
                    timeout: 8000,
                    maximumAge: 300000
                  });
                });
                console.log('[Location] Fallback 2 (WebView Low) succeeded');
                await cleanup();
                safeResolve(webPos);
                return;
              } catch (err: any) {
                console.warn('[Location] Fallback 2 failed:', err.message);
                if (err.code === 1 || err.message?.toLowerCase().includes('permission')) {
                  const pError = new Error('Location permission denied. Please check your browser settings.');
                  (pError as any).isPermissionError = true;
                  reject(pError);
                  return;
                }
              }
            }

            if (bestPos) {
              console.log('[Location] Returning best available position after all timeouts');
              await cleanup();
              safeResolve(bestPos);
              return;
            }

            if (!resolved) {
              await cleanup();
              reject(new Error('GPS Signal Weak. Please ensure you are outdoors.'));
            }
          }, timeoutMs);

          try {
            // Start watching for position updates
            watchId = await Geolocation.watchPosition(
              {
                enableHighAccuracy: true,
                timeout: timeoutMs,
                maximumAge: 30000
              },
              (position, err) => {
                if (err) {
                  console.warn('[Location] watchPosition error:', err);
                  // On web/Safari, if we get a permission error here, we stop immediately
                  if (err.message?.toLowerCase().includes('permission')) {
                    const pError = new Error('Location permission denied. Please check your app settings.');
                    (pError as any).isPermissionError = true;
                    clearTimeout(timer);
                    cleanup().then(() => reject(pError));
                  }
                  return;
                }

                if (position) {
                  const pos = position as unknown as GeolocationPosition;
                  // Update best position if this one is better
                  if (!bestPos || (pos.coords.accuracy && pos.coords.accuracy < (bestPos.coords.accuracy || Infinity))) {
                    bestPos = pos;
                  }
                  // If accuracy is good enough, resolve immediately
                  if (pos.coords.accuracy && pos.coords.accuracy <= accuracyThreshold) {
                    clearTimeout(timer);
                    cleanup().then(() => safeResolve(pos));
                  }
                }
              }
            );
          } catch (err) {
            console.error('[Location] Failed to start watchPosition:', err);
            // Fallback chain will still be triggered by the timer
          }
        })();
      });
    } finally {
      // Clear the active promise so the next request can start fresh if needed
      activeLocationPromise = null;
    }
  })();

  return activeLocationPromise;
}