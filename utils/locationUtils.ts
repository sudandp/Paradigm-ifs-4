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
  
  // 1. Primary: Nominatim OpenStreetMap API (Detailed street, landmark, and neighborhood resolution)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.address) {
        const { 
          amenity, building, shop, office, hotel, hospital, clinic, bank, school, university,
          mall, supermarket, fuel, petrol_pump, house_name,
          road, pedestrian, footway, street,
          neighbourhood, residential, subdistrict,
          quarter, suburb,
          city, town, village, municipality,
          state, postcode
        } = data.address;
        
        const landmark = amenity || building || shop || office || hotel || hospital || clinic || bank || school || university || mall || supermarket || fuel || petrol_pump || house_name;
        const streetName = road || street || pedestrian || footway;
        const areaName = suburb || quarter || neighbourhood || residential || subdistrict;
        const cityName = city || town || village || municipality || 'Bengaluru';
        const stateName = state || 'Karnataka';
        const pin = postcode;

        const parts: string[] = [];
        if (landmark) {
          parts.push(`Near by (${landmark})`);
        }
        if (streetName) {
          parts.push(streetName);
        }
        if (areaName && areaName !== streetName) {
          parts.push(areaName);
        }
        if (cityName) {
          parts.push(cityName);
        }
        if (stateName) {
          parts.push(stateName);
        }
        if (pin) {
          parts.push(pin);
        }

        if (parts.length > 0) {
          return parts.join(', ');
        }
      }
      
      if (data.display_name) {
        const cleaned = (data.display_name as string)
          .split(', ')
          .filter(p => !/(India|South City Corporation|Municipal Corporation|Central City Corporation|Corporation|District|Urban)/i.test(p))
          .slice(0, 5)
          .join(', ');
        if (cleaned) return cleaned;
      }
    }
  } catch (err) {
    console.warn('Nominatim reverse geocode failed:', err);
  }

  // 2. Fallback: BigDataCloud Client Reverse Geocode API
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const bdcRes = await fetch(bdcUrl);
    if (bdcRes.ok) {
      const bdcData = await bdcRes.json();
      const parts = [
        bdcData.locality || bdcData.sublocality || bdcData.city,
        bdcData.city !== bdcData.locality ? bdcData.city : null,
        bdcData.principalSubdivision,
        bdcData.postcode
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch (bdcErr) {
    console.warn('BigDataCloud reverse geocode failed:', bdcErr);
  }

  return fallback;
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

  const isRawAddressString = (name?: string | null): boolean => {
    if (!name) return true;
    const trimmed = name.trim();
    if (/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(trimmed)) return true;
    if (
      trimmed.length > 50 &&
      (trimmed.includes('Bengaluru') ||
        trimmed.includes('Corporation') ||
        trimmed.includes('Urban') ||
        trimmed.includes('District') ||
        (trimmed.match(/,/g) || []).length >= 3)
    ) {
      return true;
    }
    return false;
  };

  // 1. If coordinates are provided, check registered work sites first
  if (lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
    const numLat = Number(lat);
    const numLon = Number(lon);

    // 1a. Match assigned corporate / work sites (non-home)
    if (Array.isArray(userLocations) && userLocations.length > 0) {
      const siteMatches: Array<{ name: string; dist: number; isRaw: boolean }> = [];

      for (const loc of userLocations) {
        if (loc.latitude != null && loc.longitude != null) {
          const lLat = Number(loc.latitude);
          const lLon = Number(loc.longitude);
          if (!isNaN(lLat) && !isNaN(lLon) && lLat !== 0 && lLon !== 0) {
            const isHomeType = loc.type === 'home' || loc.name?.toLowerCase().includes('home');
            if (!isHomeType) {
              const dist = calculateDistanceMeters(numLat, numLon, lLat, lLon);
              const radius = Number(loc.radius) || 100;
              if (dist <= radius) {
                siteMatches.push({
                  name: loc.name,
                  dist,
                  isRaw: isRawAddressString(loc.name)
                });
              }
            }
          }
        }
      }

      if (siteMatches.length > 0) {
        // Sort: Clean corporate names first, then closest distance
        siteMatches.sort((a, b) => {
          if (a.isRaw !== b.isRaw) return a.isRaw ? 1 : -1;
          return a.dist - b.dist;
        });
        return siteMatches[0].name;
      }
    }

    // 1b. Check direct distance match to user's registered Home Location coordinates
    if (user?.homeLatitude != null && user?.homeLongitude != null) {
      const homeLat = Number(user.homeLatitude);
      const homeLng = Number(user.homeLongitude);
      if (!isNaN(homeLat) && !isNaN(homeLng) && homeLat !== 0 && homeLng !== 0) {
        const dist = calculateDistanceMeters(numLat, numLon, homeLat, homeLng);
        const homeRadius = Number(user.homeRadius) || 150;
        if (dist <= homeRadius) {
          return homeLocName;
        }
      }
    }

    // 1c. Check assigned locations explicitly designated as Home
    if (Array.isArray(userLocations) && userLocations.length > 0) {
      for (const loc of userLocations) {
        if (loc.latitude != null && loc.longitude != null) {
          const lLat = Number(loc.latitude);
          const lLon = Number(loc.longitude);
          if (!isNaN(lLat) && !isNaN(lLon)) {
            const isHomeType = loc.type === 'home' || loc.name?.toLowerCase().includes('home');
            if (isHomeType) {
              const dist = calculateDistanceMeters(numLat, numLon, lLat, lLon);
              const radius = Number(loc.radius) || 150;
              if (dist <= radius) {
                return loc.name || homeLocName;
              }
            }
          }
        }
      }
    }

    // 1d. Resolve clean address via Reverse Geocoding if lat/lon exist
    const geocodedAddress = await reverseGeocode(numLat, numLon);
    if (geocodedAddress && !/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(geocodedAddress.trim())) {
      return geocodedAddress;
    }
  }

  // 2. Prioritize clean, registered site/office name if present (e.g. "Paradigm Office", "PIFS Bangalore")
  if (
    rawAddress &&
    !/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(rawAddress.trim()) &&
    rawAddress !== 'GPS Location' &&
    rawAddress !== 'Auto Check-out' &&
    !isRawAddressString(rawAddress)
  ) {
    return rawAddress;
  }

  return rawAddress && !/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(rawAddress.trim()) && !isRawAddressString(rawAddress)
    ? rawAddress
    : lat != null && lon != null
    ? 'GPS Location'
    : 'Unknown Location';
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

  // Helper to verify a name is a genuine human-readable site name and not raw coordinates or placeholder
  const isValidNamedLocation = (name?: string | null): boolean => {
    if (!name) return false;
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(trimmed)) return false;
    const lower = trimmed.toLowerCase();
    return !(
      lower === 'gps location' ||
      lower === 'unknown location' ||
      lower === 'registered site' ||
      lower === 'site location' ||
      lower === 'mobile punch-in' ||
      lower === 'offline punch' ||
      lower === 'outside geofence' ||
      lower === 'auto check-out'
    );
  };

  const ROAD_FACTOR = 1.4;
  const AVG_SPEED_KMH = 26;

  const candidates: Array<{ name: string; lat: number; lon: number; isHome: boolean; radius: number }> = [];

  // 1. Add User Registered DB Locations (Corporate / Client Sites from database)
  const dbLocs = Array.isArray(userLocations) ? userLocations : [];
  for (const loc of dbLocs) {
    if (loc.latitude != null && loc.longitude != null) {
      const lLat = Number(loc.latitude);
      const lLon = Number(loc.longitude);
      if (!isNaN(lLat) && !isNaN(lLon) && lLat !== 0 && lLon !== 0) {
        const isHomeType = loc.type === 'home' || loc.name?.toLowerCase().includes('home');
        if (isValidNamedLocation(loc.name)) {
          candidates.push({
            name: loc.name,
            lat: lLat,
            lon: lLon,
            isHome: isHomeType,
            radius: Number(loc.radius) || 300
          });
        }
      }
    }
  }

  // 2. Add User Registered Home location if present
  if (user?.homeLatitude != null && user?.homeLongitude != null) {
    const hLat = Number(user.homeLatitude);
    const hLon = Number(user.homeLongitude);
    if (!isNaN(hLat) && !isNaN(hLon) && hLat !== 0 && hLon !== 0) {
      candidates.push({
        name: user.name ? `${user.name} Home` : 'Home',
        lat: hLat,
        lon: hLon,
        isHome: true,
        radius: Number(user.homeRadius) || 150
      });
    }
  }

  // 3. Fallback: Check sameDayEvents only for verified genuine named sites (not coordinates)
  if (candidates.length === 0 && Array.isArray(sameDayEvents)) {
    sameDayEvents.forEach(e => {
      if (e.latitude != null && e.longitude != null && isValidNamedLocation(e.locationName)) {
        const eLat = Number(e.latitude);
        const eLon = Number(e.longitude);
        if (!isNaN(eLat) && !isNaN(eLon) && eLat !== 0 && eLon !== 0) {
          const isHomeType = e.locationName.toLowerCase().includes('home');
          candidates.push({
            name: e.locationName,
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

  // Find nearest candidate among saved locations
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

  // Inside geofence radius — user is AT the location, no alert needed
  if (nearestDistMeters <= nearestCandidate.radius) return empty;

  const straightKm = nearestDistMeters / 1000;
  const roadDistKm = Number((straightKm * ROAD_FACTOR).toFixed(1));
  const durationMin = Math.max(2, Math.round((roadDistKm / AVG_SPEED_KMH) * 60));

  return {
    isUnregistered: true,
    distanceKm: roadDistKm,
    durationMin,
    targetSiteName: nearestCandidate.name,
    isHome: nearestCandidate.isHome
  };
}

/**
 * Attempt to obtain a fresh high‑accuracy geolocation fix with fast multi-stage fallbacks.
 * Eliminates stale cached fixes (maximumAge: 0) and avoids permission loops on iOS Safari/Capacitor.
 */
export async function getPrecisePosition(accuracyThreshold: number = 100, timeoutMs: number = 10000): Promise<GeolocationPosition> {
  // If a request is already active, wait for it
  if (activeLocationPromise) {
    console.log('[Location] Joining active location request flow...');
    return activeLocationPromise;
  }

  activeLocationPromise = (async () => {
    try {
      // Accessing permissions via Capacitor on native platforms (iOS/Android)
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
          console.warn('[Location] Capacitor checkPermissions error:', err);
        }
      }

      // Stage 1: Fast direct acquisition (High Accuracy, maximumAge: 0 for fresh GPS fix)
      try {
        const directPromise = Capacitor.isNativePlatform()
          ? Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: Math.min(timeoutMs, 7000),
              maximumAge: 0 // ALWAYS FRESH!
            })
          : new Promise<GeolocationPosition>((resolve, reject) => {
              if (typeof navigator === 'undefined' || !navigator.geolocation) {
                return reject(new Error('Geolocation not supported'));
              }
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: Math.min(timeoutMs, 7000),
                maximumAge: 0 // ALWAYS FRESH!
              });
            });

        const pos = (await directPromise) as unknown as GeolocationPosition;
        if (pos?.coords?.latitude != null && pos?.coords?.longitude != null) {
          console.log('[Location] Stage 1 (High Accuracy Direct) succeeded:', {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
          return pos;
        }
      } catch (stage1Err: any) {
        console.warn('[Location] Stage 1 (High Accuracy Direct) failed or timed out:', stage1Err.message);
        if (stage1Err.code === 1 || stage1Err.message?.toLowerCase().includes('denied') || stage1Err.message?.toLowerCase().includes('permission')) {
          const pError = new Error('Location permission denied. Please enable location access in settings.');
          (pError as any).isPermissionError = true;
          throw pError;
        }
      }

      // Stage 2: Low-accuracy fast fallback (Cellular/Wi-Fi positioning, maximumAge: 0)
      try {
        const fallbackPromise = Capacitor.isNativePlatform()
          ? Geolocation.getCurrentPosition({
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 0
            })
          : new Promise<GeolocationPosition>((resolve, reject) => {
              if (typeof navigator === 'undefined' || !navigator.geolocation) {
                return reject(new Error('Geolocation not supported'));
              }
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 0
              });
            });

        const lowPos = (await fallbackPromise) as unknown as GeolocationPosition;
        if (lowPos?.coords?.latitude != null && lowPos?.coords?.longitude != null) {
          console.log('[Location] Stage 2 (Low Accuracy Fallback) succeeded:', {
            lat: lowPos.coords.latitude,
            lon: lowPos.coords.longitude,
            accuracy: lowPos.coords.accuracy
          });
          return lowPos;
        }
      } catch (stage2Err: any) {
        console.warn('[Location] Stage 2 (Low Accuracy Fallback) failed:', stage2Err.message);
      }

      // Stage 3: WatchPosition listener with rapid resolve for best available position
      return await new Promise<GeolocationPosition>((resolve, reject) => {
        let bestPos: GeolocationPosition | null = null;
        let watchId: string | null = null;
        let resolved = false;

        const safeResolve = (pos: GeolocationPosition) => {
          if (resolved) return;
          resolved = true;
          if (watchId) {
            Geolocation.clearWatch({ id: watchId }).catch(() => {});
            watchId = null;
          }
          resolve(pos);
        };

        const timer = setTimeout(() => {
          if (resolved) return;
          if (watchId) {
            Geolocation.clearWatch({ id: watchId }).catch(() => {});
            watchId = null;
          }
          if (bestPos) {
            console.log('[Location] Stage 3: Resolving best acquired position');
            safeResolve(bestPos);
          } else {
            reject(new Error('GPS Signal Weak. Please ensure location services are enabled and you are not in a basement.'));
          }
        }, Math.min(timeoutMs, 5000));

        Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
          (position, err) => {
            if (err) {
              console.warn('[Location] watchPosition error:', err);
              return;
            }
            if (position) {
              const p = position as unknown as GeolocationPosition;
              if (!bestPos || (p.coords.accuracy && p.coords.accuracy < (bestPos.coords.accuracy || Infinity))) {
                bestPos = p;
              }
              if (p.coords.accuracy && p.coords.accuracy <= accuracyThreshold) {
                clearTimeout(timer);
                safeResolve(p);
              }
            }
          }
        ).then(id => {
          watchId = id;
        }).catch(err => {
          console.warn('[Location] watchPosition start failed:', err);
        });
      });

    } finally {
      activeLocationPromise = null;
    }
  })();

  return activeLocationPromise;
}