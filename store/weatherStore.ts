import { create } from 'zustand';
import {
  getLiveWeatherBroadcast,
  reverseGeocodeLocation,
  cleanLocationName,
  WeatherBroadcastData,
  DEFAULT_LOCATIONS,
} from '../services/weather';
import { weatherDbService } from '../services/weatherDbService';

const BRIEFING_DISMISSED_KEY = 'paradigm_weather_briefing_dismissed_date';
const CACHED_ENT_LOCATIONS_KEY = 'paradigm_enterprise_locations_cache';

export interface WeatherLocation {
  id?: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  isGps?: boolean;
}

interface WeatherState {
  data: WeatherBroadcastData | null;
  loading: boolean;
  error: string | null;
  availableLocations: WeatherLocation[];
  selectedLocation: WeatherLocation;
  briefingDismissed: boolean;
  hasInitialized: boolean;
  lastFetchedAt: number;

  // Actions
  fetchWeather: (lat?: number, lon?: number, cityName?: string, force?: boolean) => Promise<WeatherBroadcastData | null>;
  changeLocation: (loc: WeatherLocation) => Promise<void>;
  dismissBriefingToday: () => void;
  initialize: () => void;
  loadEnterpriseLocations: () => Promise<void>;
}

// Module-level in-flight request lock to prevent duplicate concurrent network queries
let globalInFlightPromise: Promise<WeatherBroadcastData | null> | null = null;
let lastFetchTimestamp = 0;
let realtimeLocationsUnsubscribe: (() => void) | null = null;

// Helper to ensure each location name appears exactly once (no duplicates)
function deduplicateLocations(list: WeatherLocation[]): WeatherLocation[] {
  const seen = new Set<string>();
  const out: WeatherLocation[] = [];
  for (const item of list) {
    if (item.isGps || item.name.includes('(Live GPS)')) {
      out.push(item);
      continue;
    }
    const clean = cleanLocationName(item.name);
    const key = clean.toLowerCase().replace(/[\s,.-]+/g, ' ').trim();
    if (!seen.has(key)) {
      seen.add(key);
      out.push({
        ...item,
        name: clean,
      });
    }
  }
  return out;
}

// Initial cached enterprise locations
function getInitialLocations(): WeatherLocation[] {
  try {
    const cached = localStorage.getItem(CACHED_ENT_LOCATIONS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return deduplicateLocations(parsed);
      }
    }
  } catch {}
  return deduplicateLocations(DEFAULT_LOCATIONS);
}

export const useWeatherStore = create<WeatherState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  availableLocations: getInitialLocations(),
  selectedLocation: getInitialLocations()[0],
  briefingDismissed: (() => {
    try {
      const savedDate = localStorage.getItem(BRIEFING_DISMISSED_KEY);
      const todayStr = new Date().toISOString().slice(0, 10);
      return savedDate === todayStr;
    } catch {
      return false;
    }
  })(),
  hasInitialized: false,
  lastFetchedAt: 0,

  fetchWeather: async (lat?: number, lon?: number, cityName?: string, force = false) => {
    const state = get();
    const targetLat = lat ?? state.selectedLocation.lat;
    const targetLon = lon ?? state.selectedLocation.lon;
    const targetCity = cityName ?? state.selectedLocation.name;

    const now = Date.now();
    // Throttle non-forced queries within 20 seconds if data already exists
    if (!force && state.data && (now - lastFetchTimestamp < 20000)) {
      return state.data;
    }

    if (globalInFlightPromise) {
      return globalInFlightPromise;
    }

    set({ loading: state.data ? false : true, error: null });

    globalInFlightPromise = (async () => {
      try {
        const result = await getLiveWeatherBroadcast(targetLat, targetLon, targetCity, force);
        lastFetchTimestamp = Date.now();
        set({
          data: result,
          loading: false,
          error: null,
          lastFetchedAt: Date.now(),
        });
        return result;
      } catch (err: any) {
        console.warn('[WeatherStore] Fetch error handled gracefully:', err);
        set({
          loading: false,
          error: err?.message || 'Weather telemetry offline. Using cached radar.',
        });
        return state.data;
      } finally {
        globalInFlightPromise = null;
      }
    })();

    return globalInFlightPromise;
  },

  changeLocation: async (loc: WeatherLocation) => {
    const cleanLoc: WeatherLocation = {
      ...loc,
      name: cleanLocationName(loc.name),
    };
    set({ selectedLocation: cleanLoc });
    try {
      localStorage.setItem('paradigm_selected_weather_location', JSON.stringify(cleanLoc));
    } catch {}
    await get().fetchWeather(cleanLoc.lat, cleanLoc.lon, cleanLoc.name, true);
  },

  dismissBriefingToday: () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      localStorage.setItem(BRIEFING_DISMISSED_KEY, todayStr);
      set({ briefingDismissed: true });
    } catch {
      set({ briefingDismissed: true });
    }
  },

  loadEnterpriseLocations: async () => {
    try {
      const dbLocations = await weatherDbService.fetchEnterpriseLocations();
      if (dbLocations && dbLocations.length > 0) {
        const mapped: WeatherLocation[] = dbLocations.map((l) => ({
          id: l.id,
          name: l.name,
          lat: l.lat,
          lon: l.lon,
          address: l.address,
        }));

        set((prev) => {
          // Keep GPS pin at the top if present, and deduplicate all entries so each name appears only once
          const gpsLoc = prev.availableLocations.find((p) => p.isGps || p.name.includes('GPS'));
          const combined = gpsLoc ? [gpsLoc, ...mapped] : mapped;
          const uniqueCombined = deduplicateLocations(combined);
          try {
            localStorage.setItem(CACHED_ENT_LOCATIONS_KEY, JSON.stringify(uniqueCombined.slice(0, 200)));
          } catch {}
          return { availableLocations: uniqueCombined };
        });
      }
    } catch (e) {
      console.warn('[WeatherStore] Failed to load enterprise locations from DB:', e);
    }
  },

  initialize: () => {
    const state = get();
    if (state.hasInitialized) return;
    set({ hasInitialized: true });

    // Restore last selected location if present
    try {
      const savedLoc = localStorage.getItem('paradigm_selected_weather_location');
      if (savedLoc) {
        const parsed = JSON.parse(savedLoc);
        if (parsed && parsed.lat && parsed.lon) {
          parsed.name = cleanLocationName(parsed.name);
          set({ selectedLocation: parsed });
        }
      }
    } catch {}

    const curLoc = get().selectedLocation;
    // Initial weather fetch immediately
    get().fetchWeather(curLoc.lat, curLoc.lon, curLoc.name, false);

    // 1. Fetch real enterprise site locations from database (556 sites!)
    get().loadEnterpriseLocations();

    // 2. Subscribe to Realtime additions/updates on public.locations ("Add New Location")
    if (!realtimeLocationsUnsubscribe) {
      realtimeLocationsUnsubscribe = weatherDbService.subscribeToLocationsRealtime((event, loc) => {
        const item: WeatherLocation = {
          id: loc.id,
          name: loc.name,
          lat: loc.lat,
          lon: loc.lon,
          address: loc.address,
        };

        set((prev) => {
          let updated = [...prev.availableLocations];
          if (event === 'INSERT') {
            // New location added in Site Management! Auto-insert right after GPS
            const gpsLoc = updated.find((p) => p.isGps || p.name.includes('GPS'));
            const rest = updated.filter((p) => p.id !== item.id && !p.isGps && !p.name.includes('GPS'));
            updated = gpsLoc ? [gpsLoc, item, ...rest] : [item, ...rest];
          } else if (event === 'UPDATE') {
            updated = updated.map((p) => (p.id === item.id ? { ...p, ...item } : p));
          } else if (event === 'DELETE') {
            updated = updated.filter((p) => p.id !== item.id);
          }
          return { availableLocations: deduplicateLocations(updated) };
        });
      });
    }

    // 3. Try GPS once in background if geolocation is supported
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(4));
          const lon = Number(pos.coords.longitude.toFixed(4));

          let resolvedCity = 'Ramamurthi Nagar, Bengaluru East';
          try {
            resolvedCity = await reverseGeocodeLocation(lat, lon);
          } catch {}

          const userLoc: WeatherLocation = {
            id: 'gps_live',
            name: `${resolvedCity} (Live GPS)`,
            lat,
            lon,
            isGps: true,
          };

          set((prev) => {
            const filtered = prev.availableLocations.filter(
              (p) => !p.isGps && !p.name.includes('GPS')
            );
            return {
              availableLocations: [userLoc, ...filtered],
              // Auto-select GPS on first load if default was used
              selectedLocation: userLoc,
            };
          });

          get().fetchWeather(userLoc.lat, userLoc.lon, resolvedCity, true);
        },
        () => {
          // GPS denied or unavailable; site location remains active
        },
        { timeout: 6000, maximumAge: 300000 }
      );
    }
  },
}));
