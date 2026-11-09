import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloudRain,
  Sun,
  Droplets,
  Wind,
  MapPin,
  ChevronRight,
  RotateCw,
  Sparkles,
  AlertTriangle,
  Activity,
  Flame,
} from 'lucide-react';
import { useWeatherBroadcast } from '../../hooks/useWeatherBroadcast';
import { cleanLocationName } from '../../services/weather';

interface WeatherHeaderPillProps {
  className?: string;
}

export const WeatherHeaderPill: React.FC<WeatherHeaderPillProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { data, loading, refresh, selectedLocation } = useWeatherBroadcast();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!data) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-gray-200/80 bg-white text-gray-600 shadow-2xs select-none ${className}`}>
        <span className="text-base leading-none animate-pulse">🌤️</span>
        <span className="text-xs font-black tracking-tight text-gray-900">--°</span>
        <span className="hidden sm:inline text-[11px] font-medium text-gray-400 pl-1 border-l border-gray-200">
          Syncing...
        </span>
      </div>
    );
  }

  const { current, city, activeRisks } = data;
  const isRain = current.precipitationProbability >= 45 || current.precipitation > 0;
  const criticalRisk = activeRisks.find((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH');

  return (
    <div ref={containerRef} className={`relative inline-block text-left select-none ${className}`}>
      {/* Pill Button (Windows Taskbar style) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group relative inline-flex items-center gap-2 px-3 py-1 rounded-lg border transition-all duration-200 cursor-pointer shadow-2xs ${
          isRain
            ? 'bg-sky-50/90 hover:bg-sky-100/90 border-sky-200/90 text-sky-900'
            : 'bg-white hover:bg-gray-50 border-gray-200/80 text-gray-800'
        }`}
        title={`Weather: ${current.temperature}°C, ${current.weatherDesc} in ${cleanLocationName(city)}. Click for live telemetry.`}
      >
        {/* Weather Icon */}
        <span className="text-base leading-none group-hover:scale-110 transition-transform">
          {current.weatherIcon}
        </span>

        {/* Temperature */}
        <div className="flex items-baseline gap-0.5">
          <span className="text-xs font-black tracking-tight text-gray-900">
            {current.temperature}°
          </span>
          <span className="text-[10px] font-semibold text-gray-500">C</span>
        </div>

        {/* City & condition text (desktop) */}
        <div className="hidden sm:flex items-center gap-1.5 pl-1 border-l border-gray-200/80 text-[11px]">
          <span className="font-bold text-gray-800 truncate max-w-[125px]" title={cleanLocationName(city)}>
            {city ? cleanLocationName(city).split(',')[0].trim() : 'Live'}
          </span>
          <span className="text-gray-300">•</span>
          {isRain ? (
            <span className="inline-flex items-center gap-1 font-bold text-sky-700">
              <Droplets className="w-3 h-3 text-sky-500" />
              <span>{current.precipitationProbability}%</span>
            </span>
          ) : (
            <span className="font-medium text-gray-500 truncate max-w-[90px]">
              {current.weatherDesc}
            </span>
          )}
        </div>

        {/* Pulsing indicator if critical risk */}
        {criticalRisk && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
        )}
      </button>

      {/* Flyout Popover on Click */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 mt-2 w-80 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-xl z-50 text-gray-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate max-w-[190px] font-extrabold text-slate-900">{cleanLocationName(city || selectedLocation.name)}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  refresh();
                }}
                disabled={loading}
                title="Refresh Live Data"
                className="p-1 rounded-md text-gray-400 hover:text-emerald-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            </div>

            {/* Main Weather Status */}
            <div className="flex items-center justify-between my-3">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{current.weatherIcon}</span>
                <div>
                  <div className="text-2xl font-black tracking-tight text-gray-900">
                    {current.temperature}°C
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    Feels like {current.apparentTemperature}°C
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-gray-800">{current.weatherDesc}</div>
                <div className="text-[11px] font-semibold text-sky-600 flex items-center justify-end gap-1">
                  <Droplets className="w-3 h-3 text-sky-500" />
                  {current.precipitationProbability}% Rain
                </div>
              </div>
            </div>

            {/* Active Risk Banner (if any) */}
            {criticalRisk && (
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{criticalRisk.title}: </span>
                  {criticalRisk.message}
                </div>
              </div>
            )}

            {/* Comprehensive Live Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100">
              <div className="flex items-center gap-1.5 text-gray-600">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Humidity: <strong className="text-gray-900">{current.relativeHumidity}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <Wind className="w-3.5 h-3.5 text-slate-400" />
                <span>Wind: <strong className="text-gray-900">{current.windSpeed} km/h {current.windDirection}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>UV Peak: <strong className="text-amber-700">{current.uvIndexMax} (Day)</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <Flame className="w-3.5 h-3.5 text-emerald-600" />
                <span>AQI: <strong className="text-gray-900">{current.aqi || 85} ({current.aqiCategory || 'Moderate'})</strong></span>
              </div>
            </div>

            {/* Action to Full Weather & Task Page */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/weather');
              }}
              className="w-full flex items-center justify-between rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Open Live Radar & Site Tasks
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
