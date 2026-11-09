import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CloudRain,
  Sun,
  Umbrella,
  Compass,
  AlertTriangle,
  X,
  ChevronRight,
  Sparkles,
  Droplets,
  Wind,
} from 'lucide-react';
import { WeatherBroadcastData } from '../../services/weather';

interface MorningBriefingCardProps {
  weatherData: WeatherBroadcastData | null;
  userName?: string;
  isDismissed: boolean;
  onDismiss: () => void;
  className?: string;
}

export const MorningBriefingCard: React.FC<MorningBriefingCardProps> = ({
  weatherData,
  userName = 'Team Member',
  isDismissed,
  onDismiss,
  className = '',
}) => {
  const navigate = useNavigate();

  if (isDismissed || !weatherData) {
    return null;
  }

  const { current, morningBriefing, city, activeRisks } = weatherData;
  const isRain = morningBriefing.rainExpected || current.precipitationProbability >= 40;
  const criticalRisk = activeRisks.find((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-2xl backdrop-blur-md ${
          isRain
            ? 'border-sky-500/40 bg-gradient-to-br from-[#051c24] via-[#041b0f] to-[#03150c]'
            : 'border-emerald-500/30 bg-gradient-to-br from-[#062615] via-[#041b0f] to-[#021008]'
        } ${className}`}
      >
        {/* Ambient Glow */}
        <div
          className={`pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl opacity-20 ${
            isRain ? 'bg-sky-400' : 'bg-[#44D62C]'
          }`}
        />

        {/* Header with Greeting & Dismiss */}
        <div className="relative flex items-center justify-between pb-3 border-b border-emerald-500/15">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                isRain
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-400'
                  : 'border-[#44D62C]/40 bg-[#44D62C]/15 text-[#44D62C]'
              }`}
            >
              {isRain ? <CloudRain className="h-5 w-5 animate-pulse" /> : <Sun className="h-5 w-5 text-amber-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                  Daily Weather Briefing
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#44D62C] animate-ping" />
                  Live
                </span>
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                {morningBriefing.greeting}, {userName.split(' ')[0]}!
              </h4>
            </div>
          </div>

          <button
            onClick={onDismiss}
            aria-label="Dismiss weather briefing"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-400/60 hover:bg-emerald-500/15 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-3.5 space-y-3">
          {/* Main Forecast Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {current.temperature}°C
              </span>
              <div className="text-xs text-emerald-300/80">
                <div className="font-medium text-white">{current.weatherDesc}</div>
                <div className="flex items-center gap-2 text-[11px] text-emerald-400/70">
                  <span className="flex items-center gap-0.5">
                    <Droplets className="h-3 w-3 text-sky-400" />
                    {current.precipitationProbability}% Rain
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Wind className="h-3 w-3 text-slate-400" />
                    {current.windSpeed} km/h
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 px-3 py-1.5 text-right">
              <div className="text-[10px] uppercase font-semibold text-emerald-400/70">Station</div>
              <div className="text-xs font-bold text-white truncate max-w-[140px]">{city}</div>
            </div>
          </div>

          {/* Critical Risk Notification (if any) */}
          {criticalRisk && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold">{criticalRisk.title}: </span>
                {criticalRisk.message}
              </div>
            </div>
          )}

          {/* Smart Gear & Commute Tip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-black/30 p-2.5">
              <Umbrella className="h-4 w-4 shrink-0 text-[#44D62C] mt-0.5" />
              <div>
                <span className="font-semibold text-white">Daily Gear: </span>
                <span className="text-emerald-200/90">{morningBriefing.clothingAdvice}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-black/30 p-2.5">
              <Compass className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Travel Window: </span>
                <span className="text-emerald-200/90">{morningBriefing.travelAdvice}</span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-emerald-400/60 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[#44D62C]" />
              Zero-cost radar telemetry via Open-Meteo
            </div>

            <button
              onClick={() => navigate('/weather')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#44D62C]/40 bg-[#44D62C]/20 px-3.5 py-1.5 text-xs font-semibold text-[#44D62C] hover:bg-[#44D62C] hover:text-black transition-all shadow-sm active:scale-95"
            >
              <span>Hourly Radar & Tasks</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

