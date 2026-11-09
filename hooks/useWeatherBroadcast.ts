import { useState, useEffect, useCallback } from 'react';
import {
  getLiveWeatherBroadcast,
  WeatherBroadcastData,
  DEFAULT_LOCATIONS,
} from '../services/weather';

const BRIEFING_DISMISSED_KEY = 'paradigm_weather_briefing_dismissed_date';

export function useWeatherBroadcast(autoFetch = true) {
  const [data, setData] = useState<WeatherBroadcastData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableLocations, setAvailableLocations] = useState(DEFAULT_LOCATIONS);
  const [selectedLocation, setSelectedLocation] = useState(DEFAULT_LOCATIONS[0]);
  const [briefingDismissed, setBriefingDismissed] = useState<boolean>(() => {
    try {
      const savedDate = localStorage.getItem(BRIEFING_DISMISSED_KEY);
      const todayStr = new Date().toISOString().slice(0, 10);
      return savedDate === todayStr;
    } catch {
      return false;
    }
  });

  const fetchWeather = useCallback(
    async (lat?: number, lon?: number, cityName?: string, force = false) => {
      setLoading(true);
      setError(null);
      try {
        const targetLat = lat ?? selectedLocation.lat;
        const targetLon = lon ?? selectedLocation.lon;
        const targetCity = cityName ?? selectedLocation.name;

        const result = await getLiveWeatherBroadcast(targetLat, targetLon, targetCity, force);
        setData(result);
      } catch (err: any) {
        console.warn('[useWeatherBroadcast] Weather fetch error:', err);
        setError(err?.message || 'Unable to load weather forecast.');
      } finally {
        setLoading(false);
      }
    },
    [selectedLocation]
  );

  // Try GPS on initial mount, if granted
  useEffect(() => {
    if (!autoFetch) return;

    let isMounted = true;

    const initLocationAndFetch = async () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isMounted) return;
            const lat = Number(pos.coords.latitude.toFixed(4));
            const lon = Number(pos.coords.longitude.toFixed(4));
            const userLoc = {
              name: 'Current GPS Location (Bangalore)',
              lat,
              lon,
            };
            setAvailableLocations((prev) => {
              const filtered = prev.filter((p) => !p.name.includes('GPS'));
              return [userLoc, ...filtered];
            });
            setSelectedLocation(userLoc);
            fetchWeather(userLoc.lat, userLoc.lon, userLoc.name, true);
          },
          () => {
            // Permission denied or timed out; use default site location
            if (!isMounted) return;
            fetchWeather(selectedLocation.lat, selectedLocation.lon, selectedLocation.name, false);
          },
          { timeout: 4000, maximumAge: 300000 }
        );
      } else {
        fetchWeather(selectedLocation.lat, selectedLocation.lon, selectedLocation.name, false);
      }
    };

    initLocationAndFetch();

    return () => {
      isMounted = false;
    };
  }, [autoFetch, fetchWeather]);

  const changeLocation = useCallback(
    (loc: { name: string; lat: number; lon: number }) => {
      setSelectedLocation(loc);
      fetchWeather(loc.lat, loc.lon, loc.name, true);
    },
    [fetchWeather]
  );

  const dismissBriefingToday = useCallback(() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      localStorage.setItem(BRIEFING_DISMISSED_KEY, todayStr);
      setBriefingDismissed(true);
    } catch {
      setBriefingDismissed(true);
    }
  }, []);

  return {
    data,
    loading,
    error,
    selectedLocation,
    availableLocations,
    changeLocation,
    refresh: () => fetchWeather(selectedLocation.lat, selectedLocation.lon, selectedLocation.name, true),
    briefingDismissed,
    dismissBriefingToday,
  };
}
