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
      const { 
        house_number, house_name,
        hotel, school, university, college, 
        apartment, apartments, mall, supermarket,
        bus_stop, fuel, petrol_pump,
        hospital, clinic, doctors,
        cinema, theatre, museum, 
        attraction, tourism, historic,
        building, amenity, shop, office, 
        park, garden,
        road, residential, neighbourhood, suburb, city_district,
        city, village, town, state, postcode
        // NOTE: 'county' (e.g. "Bengaluru South City Corporation") and 'country' ("India") are intentionally excluded
        // because Nominatim returns these as redundant noise for Indian addresses
      } = data.address;
      
      // Get the most descriptive "name" of the place first
      const poiName = house_name || hotel || school || university || college || 
                      apartment || apartments || mall || supermarket ||
                      bus_stop || fuel || petrol_pump ||
                      hospital || clinic || doctors ||
                      cinema || theatre || museum || 
                      attraction || tourism || historic ||
                      building || amenity || shop || office || 
                      park || garden;
      
      // Build a deduped, clean parts list.
      // We skip 'county' (municipal corporation) and 'country' entirely.
      // For city/village/town: only include if it doesn't duplicate suburb/neighbourhood already included.
      const placeName = city || village || town || null;
      const suburbOrNeighbourhood = suburb || neighbourhood || null;
      
      // Only include city if it's distinct from what we already have in suburb/neighbourhood/city_district
      const shouldIncludeCity = placeName && 
        placeName !== suburbOrNeighbourhood && 
        placeName !== city_district &&
        placeName !== road;

      const rawParts = [
        house_number, 
        road, 
        residential,
        neighbourhood,
        suburb, 
        city_district,
        shouldIncludeCity ? placeName : null,
        state, 
        postcode,
      ].filter(Boolean) as string[];

      // Deduplicate consecutive identical values (e.g. suburb === city)
      const parts = rawParts.filter((part, i) => i === 0 || part !== rawParts[i - 1]);
      
      const shortAddress = parts.join(', ');
      
      if (poiName) {
        return `${poiName} - ${shortAddress || data.display_name}`;
      }
      
      if (shortAddress) return shortAddress;
    }
    
    if (data.display_name) {
      // Fallback: strip country and county from display_name as a best-effort clean
      const cleaned = (data.display_name as string)
        .split(', ')
        .filter(p => !/(India|South City Corporation|Municipal Corporation|Corporation|District)/i.test(p))
        .join(', ');
      return cleaned || data.display_name;
    }
    return fallback;
  } catch (err) {
    console.warn('Reverse geocode failed:', err);
    return fallback;
  }
}

/**
 * Resolves a coordinate or raw address to a friendly location name if it matches
 * the user's registered home location or saved locations.
 */
export async function resolveLocationName(
  lat?: number | null,
  lon?: number | null,
  rawAddress?: string | null,
  user?: any,
  userLocations?: any[]
): Promise<string> {
  const homeLocName = user?.name ? `${user.name} Home` : 'Home Location';

  // 1. Check direct distance match to user's registered Home Location coordinates
  if (lat != null && lon != null && user?.homeLatitude != null && user?.homeLongitude != null) {
    const homeLat = Number(user.homeLatitude);
    const homeLng = Number(user.homeLongitude);
    if (!isNaN(homeLat) && !isNaN(homeLng)) {
      const dist = calculateDistanceMeters(lat, lon, homeLat, homeLng);
      if (dist <= 300) { // 300m radius threshold for home location
        return homeLocName;
      }
    }
  }

  // 2. Check user's assigned locations list (sites / home geofences)
  if (lat != null && lon != null && Array.isArray(userLocations) && userLocations.length > 0) {
    for (const loc of userLocations) {
      if (loc.latitude != null && loc.longitude != null) {
        const dist = calculateDistanceMeters(lat, lon, Number(loc.latitude), Number(loc.longitude));
        const radius = loc.radius || 200;
        if (dist <= radius) {
          return loc.name || homeLocName;
        }
      }
    }
  }

  // 3. Check address string match if reverse geocode address or raw address is available
  const addressToCheck = rawAddress || (lat != null && lon != null ? await reverseGeocode(lat, lon) : null);
  if (addressToCheck) {
    if (user?.homeAddress) {
      const normAddress = addressToCheck.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normHome = user.homeAddress.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (
        normAddress.includes(normHome) ||
        normHome.includes(normAddress) ||
        (normHome.length > 15 && normAddress.includes(normHome.slice(0, 20))) ||
        (normAddress.length > 15 && normHome.includes(normAddress.slice(0, 20)))
      ) {
        return homeLocName;
      }
    }
    return addressToCheck;
  }

  return rawAddress || (lat != null && lon != null ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : 'Unknown Location');
}

export interface SiteDistanceInfo {
  isUnregistered: boolean;
  distanceKm: number;
  durationMin: number;
  targetSiteName: string | null;
  isHome?: boolean;
}

/**
 * Calculates estimated road distance and drive time from a punch location
 * to the NEAREST registered location (Home or Work Site).
 */
export function findRegisteredSiteDistance(
  lat?: number | null,
  lon?: number | null,
  sameDayEvents?: any[],
  userLocations?: any[],
  user?: any
): SiteDistanceInfo {
  const empty: SiteDistanceInfo = { isUnregistered: false, distanceKm: 0, durationMin: 0, targetSiteName: null, isHome: false };

  if (lat == null || lon == null || isNaN(Number(lat)) || isNaN(Number(lon))) return empty;

  const punchLat = Number(lat);
  const punchLon = Number(lon);

  const ROAD_FACTOR = 1.6;
  const AVG_SPEED_KMH = 26;

  const candidates: Array<{ name: string; lat: number; lon: number; isHome: boolean; radius: number }> = [];

  // 1. Add User Registered Home location if present
  if (user?.homeLatitude != null && user?.homeLongitude != null) {
    const hLat = Number(user.homeLatitude);
    const hLon = Number(user.homeLongitude);
    if (!isNaN(hLat) && !isNaN(hLon)) {
      candidates.push({
        name: user.name ? `${user.name} Home` : 'Home',
        lat: hLat,
        lon: hLon,
        isHome: true,
        radius: 300
      });
    }
  }

  // 2. Add User DB Locations (Sites / Geofences)
  const dbLocs = Array.isArray(userLocations) ? userLocations : [];
  for (const loc of dbLocs) {
    if (loc.latitude != null && loc.longitude != null) {
      const lLat = Number(loc.latitude);
      const lLon = Number(loc.longitude);
      if (!isNaN(lLat) && !isNaN(lLon)) {
        const isHomeType = loc.type === 'home' || loc.name?.toLowerCase().includes('home');
        candidates.push({
          name: loc.name || (isHomeType ? 'Home' : 'Registered Site'),
          lat: lLat,
          lon: lLon,
          isHome: isHomeType,
          radius: loc.radius || 300
        });
      }
    }
  }

  // 3. Fallback: Check Same-Day Site Check In events for site coordinates/names
  if (Array.isArray(sameDayEvents)) {
    sameDayEvents.forEach(e => {
      const isSite = e.type === 'site-check-in' || e.type === 'site-in' || e.type === 'check-in' || (e.type === 'punch-in' && e.workType === 'field');
      if (isSite && e.latitude != null && e.longitude != null) {
        const eLat = Number(e.latitude);
        const eLon = Number(e.longitude);
        if (!isNaN(eLat) && !isNaN(eLon)) {
          const isHomeType = e.locationName?.toLowerCase().includes('home');
          candidates.push({
            name: e.locationName || 'Site Location',
            lat: eLat,
            lon: eLon,
            isHome: isHomeType,
            radius: 300
          });
        }
      }
    });
  }

  if (candidates.length === 0) return empty;

  // Find nearest candidate
  let nearestCandidate: typeof candidates[0] | null = null;
  let nearestDistMeters = Infinity;

  for (const cand of candidates) {
    const dist = calculateDistanceMeters(punchLat, punchLon, cand.lat, cand.lon);
    if (dist < nearestDistMeters) {
      nearestDistMeters = dist;
      nearestCandidate = cand;
    }
  }

  if (!nearestCandidate || nearestDistMeters === Infinity) return empty;

  // Inside geofence radius — no alert
  if (nearestDistMeters <= nearestCandidate.radius) return empty;

  const roadDistKm = Number(((nearestDistMeters / 1000) * ROAD_FACTOR).toFixed(1));
  const durationMin = Math.max(5, Math.round((roadDistKm / AVG_SPEED_KMH) * 60));

  return {
    isUnregistered: true,
    distanceKm: roadDistKm,
    durationMin,
    targetSiteName: nearestCandidate.name,
    isHome: nearestCandidate.isHome
  };
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