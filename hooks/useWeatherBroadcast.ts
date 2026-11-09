import { useEffect } from 'react';
import { useWeatherStore, WeatherLocation } from '../store/weatherStore';

export type { WeatherLocation };

export function useWeatherBroadcast(autoFetch = true) {
  const data = useWeatherStore((s) => s.data);
  const loading = useWeatherStore((s) => s.loading);
  const error = useWeatherStore((s) => s.error);
  const selectedLocation = useWeatherStore((s) => s.selectedLocation);
  const availableLocations = useWeatherStore((s) => s.availableLocations);
  const changeLocation = useWeatherStore((s) => s.changeLocation);
  const briefingDismissed = useWeatherStore((s) => s.briefingDismissed);
  const dismissBriefingToday = useWeatherStore((s) => s.dismissBriefingToday);
  const fetchWeather = useWeatherStore((s) => s.fetchWeather);
  const initialize = useWeatherStore((s) => s.initialize);

  useEffect(() => {
    if (autoFetch) {
      initialize();
    }
  }, [autoFetch, initialize]);

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
