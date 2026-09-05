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

const CACHE_STORAGE_KEY = 'pifs_geocode_cache_v2';

function loadGeocodeCache(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.entries(parsed).forEach(([k, v]) => {
          if (typeof v === 'string') map.set(k, v);
        });
      }
    }
  } catch {
    /* ignore cache read error */
  }
  return map;
}

const geocodeCache = loadGeocodeCache();

function saveToGeocodeCache(key: string, value: string) {
  geocodeCache.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (geocodeCache.size > 500) {
        const firstKey = geocodeCache.keys().next().value;
        if (firstKey) geocodeCache.delete(firstKey);
      }
      const obj: Record<string, string> = {};
      geocodeCache.forEach((v, k) => { obj[k] = v; });
      window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
    }
  } catch {
    /* ignore cache save error */
  }
}

/**
 * Perform a reverse geocode lookup of a coordinate to a human-readable address.
 * Uses persistent local storage + in-memory cache to guarantee instantaneous UI loads without layout flicker.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const cacheKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

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
          const res = parts.join(', ');
          saveToGeocodeCache(cacheKey, res);
          return res;
        }
      }
      
      if (data.display_name) {
        const cleaned = (data.display_name as string)
          .split(', ')
          .filter(p => !/(India|South City Corporation|Municipal Corporation|Central City Corporation|Corporation|District|Urban)/i.test(p))
          .slice(0, 5)
          .join(', ');
        if (cleaned) {
          saveToGeocodeCache(cacheKey, cleaned);
          return cleaned;
        }
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
      const adminList = bdcData.localityInfo?.administrative || [];
      const isJunk = (n: string) => !n || /(Corporation|taluk|district|Authority|Development|Metropolitan|Council|Basin|subdivision)/i.test(n);

      const deepArea = adminList.find((a: any) => a.order >= 15 && !isJunk(a.name))?.name;
      const suburb = bdcData.locality || bdcData.sublocality;
      const majorCity = adminList.find((a: any) => (a.name === 'Bengaluru' || a.name === 'Bangalore') && !isJunk(a.name))?.name || (bdcData.city && !isJunk(bdcData.city) ? bdcData.city : 'Bengaluru');
      const state = bdcData.principalSubdivision || 'Karnataka';
      const pin = bdcData.postcode;

      const parts = [];
      if (deepArea && deepArea !== suburb && deepArea !== majorCity) parts.push(deepArea);
      if (suburb && suburb !== majorCity) parts.push(suburb);
      if (majorCity) parts.push(majorCity);
      if (state) parts.push(state);
      if (pin) parts.push(pin);

      if (parts.length > 0) {
        const res = parts.join(', ');
        saveToGeocodeCache(cacheKey, res);
        return res;
      }
    }
  } catch (bdcErr) {
    console.warn('BigDataCloud reverse geocode failed:', bdcErr);
  }

  return fallback;
}

const isRawAddressString = (name?: string | null): boolean => {
  if (!name) return true;
  const trimmed = name.trim();
  if (/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(trimmed)) return true;
  if (
    trimmed.length > 60 &&
    trimmed.includes(',') &&
    !trimmed.toLowerCase().startsWith('near by') &&
    !trimmed.toLowerCase().includes('office') &&
    !trimmed.toLowerCase().includes('site') &&
    !trimmed.toLowerCase().includes('branch')
  ) {
    return true;
  }
  return false;
};

/**
 * Synchronously resolves a location name from geometric checks & in-memory cache.
 * Prevents UI layout flip on first render.
 */
export function resolveLocationNameSync(
  lat?: number | null,
  lon?: number | null,
  rawAddress?: string | null,
  user?: any,
  userLocations?: any[]
): string | null {
  if (lat == null || lon == null || isNaN(Number(lat)) || isNaN(Number(lon))) {
    return rawAddress && !isRawAddressString(rawAddress) ? rawAddress : null;
  }

  const numLat = Number(lat);
  const numLon = Number(lon);
  const homeLocName = user?.name ? `${user.name} Home` : 'Home Location';

  // 1a. Check registered corporate sites within radius
  if (Array.isArray(userLocations) && userLocations.length > 0) {
    for (const loc of userLocations) {
      if (loc.latitude != null && loc.longitude != null) {
        const lLat = Number(loc.latitude);
        const lLon = Number(loc.longitude);
        if (!isNaN(lLat) && !isNaN(lLon)) {
          const isHomeType = loc.type === 'home' || loc.name?.toLowerCase().includes('home');
          if (!isHomeType) {
            const dist = calculateDistanceMeters(numLat, numLon, lLat, lLon);
            const radius = Number(loc.radius) || 150;
            if (dist <= radius) {
              return loc.name || 'Registered Site';
            }
          }
        }
      }
    }
  }

  // 1b. Check user home location within radius
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

  // 1c. Check in-memory cache
  const cacheKey = `${numLat.toFixed(5)},${numLon.toFixed(5)}`;
  if (geocodeCache.has(cacheKey)) {
    const cached = geocodeCache.get(cacheKey)!;
    const distInfo = findRegisteredSiteDistance(numLat, numLon, undefined, userLocations, user);
    if (distInfo.isUnregistered && distInfo.targetSiteName && distInfo.distanceKm <= 2.5 && !cached.toLowerCase().includes('near by')) {
      return `Near by (${distInfo.targetSiteName}), ${cached}`;
    }
    return cached;
  }

  // 1d. If unregistered and near a known site, return formatted landmark hint immediately
  const distInfo = findRegisteredSiteDistance(numLat, numLon, undefined, userLocations, user);
  if (distInfo.isUnregistered && distInfo.targetSiteName && distInfo.distanceKm <= 2.5) {
    return `Near by (${distInfo.targetSiteName})`;
  }

  return null;
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

  // 1. If we have latitude and longitude, check for a match against registered locations first
  if (lat != null && lon != null) {
    const numLat = Number(lat);
    const numLon = Number(lon);

    // 1a. Check all registered corporate sites / client locations within their radius
    if (Array.isArray(userLocations) && userLocations.length > 0) {
      const siteMatches: { name: string; dist: number; isRaw: boolean }[] = [];
      for (const loc of userLocations) {
        if (loc.latitude != null && loc.longitude != null) {
          const lLat = Number(loc.latitude);
          const lLon = Number(loc.longitude);
          if (!isNaN(lLat) && !isNaN(lLon)) {
            const isHomeType = loc.type === 'home' || loc.name?.toLowerCase().includes('home');
            if (!isHomeType) {
              const dist = calculateDistanceMeters(numLat, numLon, lLat, lLon);
              const radius = Number(loc.radius) || 150;
              if (dist <= radius) {
                const locName = loc.name || 'Registered Site';
                const isRaw = isRawAddressString(locName);
                siteMatches.push({ name: locName, dist, isRaw });
              }
            }
          }
        }
      }

      if (siteMatches.length > 0) {
        // Pick the best non-raw candidate closest to the user
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
      // If within 2.5km of a registered corporate site and address doesn't already contain landmark
      const distInfo = findRegisteredSiteDistance(numLat, numLon, undefined, userLocations, user);
      if (distInfo.isUnregistered && distInfo.targetSiteName && distInfo.distanceKm <= 2.5 && !geocodedAddress.toLowerCase().includes('near by')) {
        return `Near by (${distInfo.targetSiteName}), ${geocodedAddress}`;
      }
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

  // Helper to format/clean raw address strings into concise landmark names
  const cleanCandidateName = (name: string): string => {
    if (!name) return 'Registered Location';
    if (
      name.length > 40 &&
      (name.includes('Corporation') ||
        name.includes('District') ||
        name.includes('Urban') ||
        (name.match(/,/g) || []).length >= 2)
    ) {
      const parts = name
        .split(',')
        .map(p => p.trim())
        .filter(p => !/(India|City Corporation|Corporation|District|Urban|Karnataka|\d{6})/i.test(p));
      if (parts.length > 0) {
        return parts.slice(0, 2).join(', ');
      }
    }
    return name;
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
            name: isHomeType ? loc.name : cleanCandidateName(loc.name),
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
            name: isHomeType ? e.locationName : cleanCandidateName(e.locationName),
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

export interface LocationErrorWithFlags extends Error {
  isPermissionError?: boolean;
  isPositionUnavailable?: boolean;
  isUnsupported?: boolean;
  isPreciseError?: boolean;
  isLowAccuracy?: boolean;
}

/**
 * Robustly acquire GPS coordinates with active retry, warm-up, and error classification.
 * Uses progressive fallback (high-accuracy -> fused/network provider) to avoid blocking users.
 */
export async function getPrecisePosition(accuracyThreshold: number = 50, timeoutMs: number = 10000): Promise<GeolocationPosition> {
  // If a request is already active, wait for it
  if (activeLocationPromise) {
    console.log('[Location] Joining active location request flow...');
    return activeLocationPromise;
  }

  const isNative = Capacitor.isNativePlatform();
  // Desktop web browsers use Wi-Fi/IP triangulation where accuracy is typically 40m - 200m
  // On mobile native, we accept up to 150m (or custom threshold)
  const effectiveThreshold = isNative ? Math.max(accuracyThreshold, 150) : Math.max(accuracyThreshold, 250);

  activeLocationPromise = (async () => {
    try {
      // Accessing permissions via Capacitor on native platforms (iOS/Android)
      if (isNative) {
        try {
          const permission = await Geolocation.checkPermissions();
          if (permission.location !== 'granted') {
            const requestResult = await Geolocation.requestPermissions();
            if (requestResult.location !== 'granted') {
              const error = Object.assign(new Error('Location permission denied. Please enable location access in device settings.'), {
                isPermissionError: true
              }) as LocationErrorWithFlags;
              throw error;
            }
          }
        } catch (err: any) {
          if (err?.isPermissionError) throw err;
          console.warn('[Location] Capacitor checkPermissions warning:', err);
        }
      }

      // Stage 1: Fast direct acquisition with cached position allowance (20s)
      try {
        const directPromise = isNative
          ? Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: Math.min(timeoutMs, 5000),
              maximumAge: 20000 // Accept recent 20s fix for instant response
            })
          : new Promise<GeolocationPosition>((resolve, reject) => {
              if (typeof navigator === 'undefined' || !navigator.geolocation) {
                const err = Object.assign(new Error('Geolocation not supported on this browser/device'), {
                  isUnsupported: true
                }) as LocationErrorWithFlags;
                return reject(err);
              }
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: Math.min(timeoutMs, 5000),
                maximumAge: 20000
              });
            });

        const pos = (await directPromise) as unknown as GeolocationPosition;
        if (pos?.coords?.latitude != null && pos?.coords?.longitude != null) {
          const acc = pos.coords.accuracy || 999;
          console.log(`[Location] Direct fix acquired: lat=${pos.coords.latitude}, lon=${pos.coords.longitude}, accuracy=${acc}m (threshold=${effectiveThreshold}m)`);
          
          if (acc <= effectiveThreshold) {
            return pos;
          }
          console.log(`[Location] Direct fix accuracy (${acc}m) is approximate. Starting fallback listener...`);
        }
      } catch (stage1Err: unknown) {
        const errObj = stage1Err as { code?: number; message?: string } | undefined;
        console.warn('[Location] Direct high-accuracy failed or timed out:', errObj?.message);
        if (errObj?.code === 1 || errObj?.message?.toLowerCase().includes('denied') || errObj?.message?.toLowerCase().includes('permission')) {
          const pError = Object.assign(new Error('Location permission denied. Please allow location access in your device settings.'), {
            isPermissionError: true
          }) as LocationErrorWithFlags;
          throw pError;
        }
      }

      // Stage 1.5: Fast Fused/Network Location Provider Probe (Immediate 0.2s return on Android/iOS)
      try {
        const networkPromise = isNative
          ? Geolocation.getCurrentPosition({
              enableHighAccuracy: false, // Uses Cell/Wi-Fi fused provider
              timeout: 3000,
              maximumAge: 60000 // 1 minute cache
            })
          : new Promise<GeolocationPosition>((resolve, reject) => {
              if (typeof navigator !== 'undefined' && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: false,
                  timeout: 3000,
                  maximumAge: 60000
                });
              } else {
                reject(new Error('Navigator geolocation unavailable'));
              }
            });

        const netPos = (await networkPromise) as unknown as GeolocationPosition;
        if (netPos?.coords?.latitude != null && netPos?.coords?.longitude != null) {
          const netAcc = netPos.coords.accuracy || 999;
          console.log(`[Location] Fast network/fused fix acquired: lat=${netPos.coords.latitude}, lon=${netPos.coords.longitude}, accuracy=${netAcc}m`);
          if (netAcc <= effectiveThreshold) {
            return netPos;
          }
        }
      } catch (netErr) {
        console.warn('[Location] Fast network probe skipped:', netErr);
      }

      // Stage 2: Active Watch Listener (Warmup & GPS Lock)
      return await new Promise<GeolocationPosition>((resolve, reject) => {
        let bestPos: GeolocationPosition | null = null;
        let watchId: string | null = null;
        let resolved = false;

        const safeResolve = (pos: GeolocationPosition) => {
          if (resolved) return;
          resolved = true;
          if (watchId) {
            if (isNative) {
              Geolocation.clearWatch({ id: watchId }).catch(() => { /* ignore clear watch */ });
            } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
              navigator.geolocation.clearWatch(Number(watchId));
            }
            watchId = null;
          }
          resolve(pos);
        };

        const safeReject = (err: Error) => {
          if (resolved) return;
          resolved = true;
          if (watchId) {
            if (isNative) {
              Geolocation.clearWatch({ id: watchId }).catch(() => { /* ignore clear watch */ });
            } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
              navigator.geolocation.clearWatch(Number(watchId));
            }
            watchId = null;
          }
          reject(err);
        };

        const timer = setTimeout(() => {
          if (resolved) return;
          if (bestPos && bestPos.coords) {
            const finalAcc = bestPos.coords.accuracy || 999;
            console.log(`[Location] GPS warmup complete. Best accuracy=${finalAcc}m`);
            safeResolve(bestPos);
          } else {
            const err = Object.assign(new Error('GPS Signal Weak or Location Disabled. Please ensure Location Services are turned ON in phone settings and retry.'), {
              isPositionUnavailable: true
            }) as LocationErrorWithFlags;
            safeReject(err);
          }
        }, Math.min(Math.max(timeoutMs, 6000), 10000));

        if (isNative) {
          Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
            (position, err) => {
              if (err) {
                console.warn('[Location] watchPosition notice:', err);
                return;
              }
              if (position) {
                const p = position as unknown as GeolocationPosition;
                const acc = p.coords?.accuracy || Infinity;
                if (!bestPos || acc < (bestPos.coords?.accuracy || Infinity)) {
                  bestPos = p;
                }
                if (acc <= effectiveThreshold) {
                  clearTimeout(timer);
                  safeResolve(p);
                }
              }
            }
          ).then(id => {
            watchId = id;
          }).catch(err => {
            console.warn('[Location] watchPosition start notice:', err);
          });
        } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
          const wId = navigator.geolocation.watchPosition(
            (pos) => {
              const acc = pos.coords?.accuracy || Infinity;
              if (!bestPos || acc < (bestPos.coords?.accuracy || Infinity)) {
                bestPos = pos;
              }
              if (acc <= effectiveThreshold) {
                clearTimeout(timer);
                safeResolve(pos);
              }
            },
            (err) => {
              console.warn('[Location] browser watchPosition notice:', err);
              if (err.code === 1) {
                const pError = Object.assign(new Error('Location permission denied in browser/device.'), {
                  isPermissionError: true
                }) as LocationErrorWithFlags;
                clearTimeout(timer);
                safeReject(pError);
              }
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
          );
          watchId = String(wId);
        }
      });

    } finally {
      activeLocationPromise = null;
    }
  })();

  return activeLocationPromise;
}