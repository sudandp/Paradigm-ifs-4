import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RotateCw,
  MapPin,
  CloudRain,
  Sun,
  Droplets,
  Wind,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Compass,
  Calendar,
  Send,
  Zap,
  Radio,
  UserCheck,
  Eye,
  Cloud,
  Gauge,
  Activity,
  Flame,
} from 'lucide-react';
import { useWeatherBroadcast } from '../../hooks/useWeatherBroadcast';
import { useAuthStore } from '../../store/authStore';
import { useDevice } from '../../hooks/useDevice';
import { weatherDbService, DbWeatherAlert, DbWeatherTask } from '../../services/weatherDbService';

export const WeatherBroadcastPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { isMobile } = useDevice();

  const {
    data,
    loading,
    error,
    selectedLocation,
    availableLocations,
    changeLocation,
    refresh,
  } = useWeatherBroadcast();

  // Supabase Database Alerts & Tasks State
  const [dbAlerts, setDbAlerts] = useState<DbWeatherAlert[]>([]);
  const [dbTasks, setDbTasks] = useState<DbWeatherTask[]>([]);
  const [localCompletedIds, setLocalCompletedIds] = useState<Record<string, boolean>>({});
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  // 1. Fetch DB alerts & tasks on mount / station switch
  useEffect(() => {
    let isMounted = true;
    const loadDbState = async () => {
      const [alerts, tasks] = await Promise.all([
        weatherDbService.fetchActiveAlerts(),
        weatherDbService.fetchWeatherTasks(),
      ]);
      if (isMounted) {
        setDbAlerts(alerts);
        setDbTasks(tasks);
      }
    };

    loadDbState();

    // 2. Subscribe to Supabase Realtime updates
    const unsubscribe = weatherDbService.subscribeToRealtime(
      (newAlert) => {
        setDbAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== newAlert.id)]);
      },
      (updatedTask) => {
        setDbTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === updatedTask.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updatedTask;
            return next;
          }
          return [updatedTask, ...prev];
        });
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [selectedLocation]);

  // Combine suggested telemetry tasks with active DB tasks
  const combinedTasks = React.useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      category: string;
      urgency: string;
      description: string;
      suggestedRole: string;
      isDone: boolean;
      dbId?: string;
    }> = [];

    // Prioritize DB tasks if present
    dbTasks.forEach((dbt) => {
      list.push({
        id: dbt.id,
        dbId: dbt.id,
        title: dbt.task_name,
        category: dbt.category,
        urgency: dbt.urgency,
        description: dbt.description || '',
        suggestedRole: dbt.suggested_role || 'Site Team',
        isDone: dbt.status === 'COMPLETED' || Boolean(localCompletedIds[dbt.id]),
      });
    });

    // Supplement with live calculated suggested tasks
    if (data?.suggestedTasks) {
      data.suggestedTasks.forEach((st) => {
        if (!list.some((item) => item.title.toLowerCase() === st.title.toLowerCase())) {
          list.push({
            id: st.id,
            title: st.title,
            category: st.category,
            urgency: st.urgency,
            description: st.description,
            suggestedRole: st.suggestedRole,
            isDone: Boolean(localCompletedIds[st.id]),
          });
        }
      });
    }

    return list;
  }, [dbTasks, data?.suggestedTasks, localCompletedIds]);

  const toggleTask = async (task: (typeof combinedTasks)[0]) => {
    const nextStatus = !task.isDone;
    setLocalCompletedIds((prev) => ({ ...prev, [task.id]: nextStatus }));

    if (task.dbId) {
      await weatherDbService.updateWeatherTaskStatus(
        task.dbId,
        nextStatus ? 'COMPLETED' : 'PENDING',
        user?.id,
        `Marked by ${user?.name || 'Staff'}`
      );
    }
  };

  const handleBroadcastAlert = async () => {
    if (!data) return;
    setBroadcastLoading(true);
    setBroadcastStatus(null);

    const primaryRisk = data.activeRisks[0] || {
      id: 'manual-alert',
      type: 'RAIN_IMMIGRANT',
      severity: 'HIGH',
      title: `Weather Advisory for ${selectedLocation.name}`,
      message: `Rain probability ${data.current.precipitationProbability}%. Team requested to secure site and monitor drainage.`,
      timing: 'Immediate',
      icon: '🌧️',
    };

    const res = await weatherDbService.broadcastAlertAndTasks(
      primaryRisk,
      data.suggestedTasks,
      {
        name: selectedLocation.name,
        lat: selectedLocation.lat,
        lon: selectedLocation.lon,
      }
    );

    setBroadcastLoading(false);
    if (res.alertId || res.taskCount > 0) {
      setBroadcastStatus(`Dispatched! ${res.taskCount} tasks synchronized.`);
      const [alerts, tasks] = await Promise.all([
        weatherDbService.fetchActiveAlerts(),
        weatherDbService.fetchWeatherTasks(),
      ]);
      setDbAlerts(alerts);
      setDbTasks(tasks);
    } else {
      setBroadcastStatus('Alert broadcasted to live feed.');
    }

    setTimeout(() => {
      setBroadcastStatus(null);
    }, 5000);
  };

  const completedCount = combinedTasks.filter((t) => t.isDone).length;

  return (
    <div className={`min-h-screen ${isMobile ? 'bg-[#041b0f] text-slate-100 p-4 pb-28' : 'bg-slate-50 text-slate-900 p-6 pb-16'} space-y-6`}>
      {/* Mobile Top Header */}
      {isMobile ? (
        <div className="flex items-center gap-3 pt-1 pb-2 -mx-4 -mt-4 px-4 bg-[#041b0f] border-b border-[#134426]/60 mb-2">
          <button
            type="button"
            onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/mobile-home')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#065f46] hover:bg-[#044e3b] text-white border border-emerald-500/40 font-bold text-xs shadow-[0_2px_8px_rgba(6,95,70,0.4)] active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Back</span>
          </button>
          <div className="h-[1px] flex-1 bg-[#134426]" />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#44D62C] bg-[#092c19] px-2.5 py-1 rounded-lg border border-[#134426]">
            WEATHER RADAR
          </span>
        </div>
      ) : (
        /* Desktop Top Header Bar */
        <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/90">
                Live Sensor Telemetry
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
                Live Sync (Open-Meteo)
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Weather Intelligence & Live Telemetry
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live automated weather meter, UV radiation, air quality (AQI), and operations triggers
            </p>
          </div>

          {/* Location Picker & Refresh Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={selectedLocation.name}
                onChange={(e) => {
                  const target = availableLocations.find((l) => l.name === e.target.value);
                  if (target) changeLocation(target);
                }}
                className="appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-8 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                {availableLocations.map((loc) => (
                  <option key={loc.name} value={loc.name} className="text-slate-900">
                    {loc.name}
                  </option>
                ))}
              </select>
              <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            </div>

            <button
              onClick={() => refresh()}
              disabled={loading}
              title="Refresh Live Telemetry"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:text-emerald-700 hover:bg-slate-50 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Hero Current Weather & Rich Telemetry Card */}
      {data && (
        <div className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm ${
          isMobile
            ? 'border-[#134426] bg-[#092c19] text-white'
            : 'border-slate-200/90 bg-white text-slate-900'
        }`}>
          {/* Main Top Section: Temp, Headline, and Location */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="space-y-2">
              <div className={`flex items-center gap-2 text-xs font-bold ${isMobile ? 'text-emerald-400' : 'text-emerald-700'}`}>
                <MapPin className="h-3.5 w-3.5" />
                <span>{selectedLocation.name}</span>
                <span className={isMobile ? 'text-emerald-500/40' : 'text-slate-300'}>•</span>
                <span className={isMobile ? 'text-emerald-300/80' : 'text-slate-500'}>
                  GPS: {data.latitude.toFixed(2)}°N, {data.longitude.toFixed(2)}°E
                </span>
                <span className={isMobile ? 'text-emerald-500/40' : 'text-slate-300'}>•</span>
                <span className={isMobile ? 'text-emerald-300/80' : 'text-slate-500'}>
                  {data.current.isDay ? 'Daytime ☀️' : 'Night Hours 🌙'}
                </span>
              </div>

              <div className="flex items-baseline gap-4">
                <span className={`text-6xl sm:text-7xl font-black tracking-tight ${isMobile ? 'text-white' : 'text-slate-900'}`}>
                  {data.current.temperature}°
                </span>
                <div>
                  <div className={`text-xl font-bold flex items-center gap-2 ${isMobile ? 'text-emerald-100' : 'text-slate-800'}`}>
                    <span>{data.current.weatherIcon}</span>
                    <span>{data.current.weatherDesc}</span>
                  </div>
                  <div className={`text-xs font-medium ${isMobile ? 'text-emerald-400/80' : 'text-slate-500'}`}>
                    Feels like {data.current.apparentTemperature}°C • Dew Point: {Math.round(data.current.temperature - ((100 - data.current.relativeHumidity) / 5))}°C
                  </div>
                </div>
              </div>

              <p className={`text-xs sm:text-sm leading-relaxed max-w-xl ${isMobile ? 'text-emerald-200/90' : 'text-slate-600'}`}>
                {data.morningBriefing.headline}
              </p>
            </div>

            {/* Quick Station Badge */}
            <div className={`rounded-xl border px-3.5 py-2 text-right ${
              isMobile ? 'border-emerald-500/30 bg-black/40' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className={`text-[10px] uppercase font-bold ${isMobile ? 'text-emerald-400' : 'text-slate-500'}`}>
                Sensor Status
              </div>
              <div className="flex items-center justify-end gap-1.5 text-xs font-black text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Live Active</span>
              </div>
              <div className={`text-[10px] mt-0.5 ${isMobile ? 'text-emerald-400/60' : 'text-slate-400'}`}>
                Updated: {new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Comprehensive Telemetry Grid (8 Metrics) */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {/* 1. Rain Probability */}
            <div className={`rounded-xl border p-3 text-center ${
              isMobile ? 'border-emerald-500/20 bg-black/40' : 'border-slate-200/80 bg-slate-50'
            }`}>
              <Droplets className="mx-auto h-4 w-4 text-sky-500 mb-1" />
              <div className={`text-[10px] uppercase font-bold ${isMobile ? 'text-emerald-400/70' : 'text-slate-500'}`}>Rain Prob.</div>
              <div className={`text-sm font-black ${isMobile ? 'text-white' : 'text-slate-900'}`}>{data.current.precipitationProbability}%</div>
              <div className={`text-[9px] ${isMobile ? 'text-emerald-400/60' : 'text-slate-400'}`}>Precip: {data.current.precipitation}mm</div>
            </div>

            {/* 2. Relative Humidity */}
            <div className={`rounded-xl border p-3 text-center ${
              isMobile ? 'border-emerald-500/20 bg-black/40' : 'border-slate-200/80 bg-slate-50'
            }`}>
              <Activity className="mx-auto h-4 w-4 text-emerald-500 mb-1" />
              <div className={`text-[10px] uppercase font-bold ${isMobile ? 'text-emerald-400/70' : 'text-slate-500'}`}>Humidity</div>
              <div className={`text-sm font-black ${isMobile ? 'text-white' : 'text-slate-900'}`}>{data.current.relativeHumidity}%</div>
              <div className={`text-[9px] ${isMobile ? 'text-emerald-400/60' : 'text-slate-400'}`}>{data.current.relativeHumidity > 70 ? 'High' : 'Comfortable'}</div>
            </div>

            {/* 3. Wind & Gusts */}
            <div className={`rounded-xl border p-3 text-center ${
              isMobile ? 'border-emerald-500/20 bg-black/40' : 'border-slate-200/80 bg-slate-50'
            }`}>
              <Wind className="mx-auto h-4 w-4 text-slate-400 mb-1" />
              <div className={`text-[10px] uppercase font-bold ${isMobile ? 'text-emerald-400/70' : 'text-slate-500'}`}>Wind</div>
              <div className={`text-sm font-black ${isMobile ? 'text-white' : 'text-slate-900'}`}>{data.current.windSpeed} km/h</div>
              <div className={`text-[9px] ${isMobile ? 'text-emerald-400/60' : 'text-slate-400'}`}>{data.current.windDirection} • Gusts {data.current.windGusts}</div>
            </div>

            {/* 4. UV Radiation (Current & Day Peak) */}
            <div className={`rounded-xl border p-3 text-center ${
              isMobile ? 'border-emerald-500/20 bg-black/40' : 'border-slate-200/80 bg-slate-50'
            }`}>
              <Sun className="mx-auto h-4 w-4 text-amber-500 mb-1" />
              <div className={`text-[10px] uppercase font-bold ${isMobile ? 'text-emerald-400/70' : 'text-slate-500'}`}>UV Radiation</div>
              <div className={`text-sm font-black ${isMobile ? 'text-white' : 'text-slate-900'}`}>
                {data.current.isDay ? data.current.uvIndex : '0 (Night)'}
              </div>
              <div className={`text-[9px] font-bold ${data.current.uvIndexMax >= 8 ? 'text-rose-600' : 'text-amber-600'}`}>
                Peak: {data.current.uvIndexMax} {data.current.uvIndexMax >= 8 ? '(Extreme)' : data.current.uvIndexMax >= 6 ? '(High)' : '(Moderate)'}
              </div>
            </div>

            {/* 5. Air Quality Index (AQI) */}
            <div className={`rounded-xl border p-3 text-center ${
              isMobile ? 'border-emerald-500/20 bg-black/40' : 'border-slate-200/80 bg-slate-50'
            }`}>
              <Flame className="mx-auto h-4 w-4 text-emerald-600 mb-1" />
              <div className={`text-[10px] uppercase font-bold ${isMobile ? 'text-emerald-400/70' : 'text-slate-500'}`}>Air Quality</div>
              <div className={`text-sm font-black ${isMobile ? 'text-white' : 'text-slate-900'}`}>
                {data.current.aqi !== undefined ? data.current.aqi : 65} <span className="text-[10px] font-bold text-emerald-600">AQI</span>
              </div>
              <div className={`text-[9px] font-semibold ${isMobile ? 'text-emerald-400/70' : 'text-slate-500'}`}>
                {data.current.aqiCategory || 'Moderate'} {data.current.pm25 ? `• PM2.5: ${data.current.pm25}` : ''}
              </div>
            </div>

            {/* 6. Visibility */}
            <div className={`rounded-xl border p-3 text-center ${
              isMobile ? 'border-emerald-500/20 bg-black/40' : 'border-slate-200/80 bg-slate-50'
            }`}>
              <Eye className="mx-auto h-4 w-4 text-indigo-500 mb-1" />
              <div className={`text-[10px] uppercase font-bold ${isMobile ? 'text-emerald-400/70' : 'text-slate-500'}`}>Visibility</div>
              <div className={`text-sm font-black ${isMobile ? 'text-white' : 'text-slate-900'}`}>{data.current.visibility} km</div>
              <div className={`text-[9px] ${isMobile ? 'text-emerald-400/60' : 'text-slate-400'}`}>Clear Horizon</div>
            </div>

            {/* 7. Cloud Cover */}
            <div className={`rounded-xl border p-3 text-center ${
              isMobile ? 'border-emerald-500/20 bg-black/40' : 'border-slate-200/80 bg-slate-50'
            }`}>
              <Cloud className="mx-auto h-4 w-4 text-sky-400 mb-1" />
              <div className={`text-[10px] uppercase font-bold ${isMobile ? 'text-emerald-400/70' : 'text-slate-500'}`}>Cloud Cover</div>
              <div className={`text-sm font-black ${isMobile ? 'text-white' : 'text-slate-900'}`}>{data.current.cloudCover}%</div>
              <div className={`text-[9px] ${isMobile ? 'text-emerald-400/60' : 'text-slate-400'}`}>Partly Overcast</div>
            </div>

            {/* 8. Barometric Pressure */}
            <div className={`rounded-xl border p-3 text-center ${
              isMobile ? 'border-emerald-500/20 bg-black/40' : 'border-slate-200/80 bg-slate-50'
            }`}>
              <Gauge className="mx-auto h-4 w-4 text-teal-600 mb-1" />
              <div className={`text-[10px] uppercase font-bold ${isMobile ? 'text-emerald-400/70' : 'text-slate-500'}`}>Pressure</div>
              <div className={`text-sm font-black ${isMobile ? 'text-white' : 'text-slate-900'}`}>{data.current.pressure} hPa</div>
              <div className={`text-[9px] ${isMobile ? 'text-emerald-400/60' : 'text-slate-400'}`}>Stable Altitude</div>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Active Operational Alerts Banner */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
            isMobile ? 'text-amber-400' : 'text-amber-800'
          }`}>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Active Site Alerts & Telemetry Triggers
          </h2>
          <button
            onClick={handleBroadcastAlert}
            disabled={broadcastLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {broadcastLoading ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>{broadcastStatus || 'Broadcast Alert to Team'}</span>
          </button>
        </div>

        {/* Show Realtime DB Alerts or Live Risks */}
        {dbAlerts.length === 0 && (!data || data.activeRisks.length === 0) ? (
          <div className={`rounded-xl border p-3.5 text-xs flex items-center gap-2.5 ${
            isMobile
              ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-300'
              : 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
          }`}>
            <Radio className="h-4 w-4 text-emerald-600" />
            <span>All clear. No extreme rain or storm warnings active for this cluster.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Show live risks */}
            {data?.activeRisks.map((risk) => (
              <div
                key={risk.id}
                className={`rounded-2xl border p-4 shadow-xs ${
                  risk.severity === 'CRITICAL'
                    ? (isMobile ? 'border-rose-500/40 bg-rose-950/20 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-900')
                    : (isMobile ? 'border-amber-500/30 bg-amber-950/20 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-900')
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{risk.icon}</span>
                    <div>
                      <div className="text-xs uppercase font-black tracking-tight">
                        {risk.title}
                      </div>
                      <div className={`text-[11px] font-medium ${isMobile ? 'text-amber-400/80' : 'text-amber-700'}`}>
                        Expected Around: {risk.timing}
                      </div>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                    risk.severity === 'CRITICAL' ? 'bg-rose-600 text-white' : 'bg-amber-200 text-amber-900'
                  }`}>
                    {risk.severity}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed opacity-90">{risk.message}</p>
              </div>
            ))}

            {/* Show DB alerts from serverless cron */}
            {dbAlerts.map((dba) => (
              <div
                key={dba.id}
                className={`rounded-2xl border p-4 shadow-xs ${
                  isMobile
                    ? 'border-sky-500/30 bg-sky-950/20 text-sky-200'
                    : 'border-sky-200 bg-sky-50 text-sky-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase font-black tracking-tight flex items-center gap-1.5">
                      <Radio className="h-3.5 w-3.5 text-sky-600 animate-pulse" />
                      {dba.title}
                    </div>
                    <div className={`text-[11px] font-medium ${isMobile ? 'text-sky-400/80' : 'text-sky-700'}`}>
                      Dispatched via Automation • {new Date(dba.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                    isMobile ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-200 text-sky-800'
                  }`}>
                    {dba.severity}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed opacity-90">{dba.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Automated Site Tasks Engine */}
      <div className={`rounded-2xl border p-5 shadow-xs space-y-4 ${
        isMobile
          ? 'border-[#134426] bg-[#092c19] text-white'
          : 'border-slate-200/90 bg-white text-slate-900'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${isMobile ? 'text-white' : 'text-slate-900'}`}>
              <Zap className="h-4 w-4 text-emerald-600" />
              Weather-Triggered Operations Checklist
            </h3>
            <p className={`text-xs ${isMobile ? 'text-emerald-300/80' : 'text-slate-500'}`}>
              Automated preventive tasks synchronized across mobile and web for on-duty technicians.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              isMobile ? 'bg-[#44D62C]/20 text-[#44D62C]' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {completedCount} / {combinedTasks.length} Completed
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {combinedTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => toggleTask(task)}
              className={`cursor-pointer select-none rounded-xl border p-4 transition-all ${
                task.isDone
                  ? (isMobile ? 'border-emerald-500/20 bg-emerald-950/20 opacity-60' : 'border-slate-200 bg-slate-50/80 opacity-60')
                  : (isMobile ? 'border-emerald-500/30 bg-black/40 hover:bg-emerald-950/30' : 'border-slate-200/90 bg-white hover:bg-slate-50/90 shadow-2xs')
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border mt-0.5 transition-colors ${
                    task.isDone
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : (isMobile ? 'border-emerald-500/40 bg-emerald-950/40 text-transparent' : 'border-slate-300 bg-white text-transparent')
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-bold ${
                        task.isDone
                          ? 'line-through text-slate-400'
                          : (isMobile ? 'text-white' : 'text-slate-900')
                      }`}
                    >
                      {task.title}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                      isMobile ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {task.category}
                    </span>
                    {task.urgency === 'CRITICAL' && (
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 uppercase">
                        Urgent
                      </span>
                    )}
                  </div>

                  <p className={`text-xs leading-relaxed ${isMobile ? 'text-emerald-200/80' : 'text-slate-600'}`}>
                    {task.description}
                  </p>

                  <div className={`text-[11px] flex items-center gap-1.5 ${isMobile ? 'text-emerald-400/70' : 'text-slate-500'}`}>
                    <UserCheck className="h-3 w-3 text-emerald-600" />
                    <span>Assigned Scope: <strong className={isMobile ? 'text-emerald-300' : 'text-slate-700'}>{task.suggestedRole}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Hourly Forecast & Rain Radar (Next 24h) */}
      {data && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
              isMobile ? 'text-emerald-400' : 'text-slate-700'
            }`}>
              <Clock className="h-4 w-4 text-emerald-600" />
              Hourly Forecast & Rain Radar (Next 24h)
            </h2>
            <span className={`text-xs ${isMobile ? 'text-emerald-400/60' : 'text-slate-400'}`}>Scroll horizontally →</span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-slate-300">
            {data.hourly.slice(0, 24).map((h, idx) => {
              const dateObj = new Date(h.time);
              const timeLabel = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isRainAlert = h.precipitationProbability >= 60;
              const isModerateRain = h.precipitationProbability >= 35 && h.precipitationProbability < 60;

              return (
                <div
                  key={idx}
                  className={`flex min-w-[95px] flex-col items-center justify-between rounded-xl border p-3 text-center shrink-0 transition-all shadow-2xs ${
                    isMobile
                      ? (isRainAlert ? 'border-sky-500/50 bg-sky-950/30 text-white' : 'border-emerald-500/20 bg-black/40 text-white')
                      : (isRainAlert ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-200/90 bg-white text-slate-800')
                  }`}
                >
                  <span className={`text-[11px] font-bold ${isMobile ? 'text-emerald-300' : 'text-slate-500'}`}>{timeLabel}</span>
                  <span className="my-1.5 text-2xl">{h.weatherIcon}</span>
                  <span className={`text-sm font-black ${isMobile ? 'text-white' : 'text-slate-900'}`}>{h.temperature}°C</span>

                  <div className="mt-2 w-full space-y-1">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-sky-600 font-bold">
                      <Droplets className="h-2.5 w-2.5" />
                      <span>{h.precipitationProbability}%</span>
                    </div>

                    {/* Mini Bar Meter */}
                    <div className={`h-1 w-full rounded-full overflow-hidden ${isMobile ? 'bg-emerald-950/60' : 'bg-slate-100'}`}>
                      <div
                        className={`h-full rounded-full ${
                          isRainAlert ? 'bg-sky-500' : isModerateRain ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(h.precipitationProbability, 100)}%` }}
                      />
                    </div>
                  </div>

                  <span
                    className={`mt-2 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase ${
                      isRainAlert
                        ? 'bg-sky-100 text-sky-800'
                        : isModerateRain
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isRainAlert ? 'Alert' : isModerateRain ? 'Caution' : 'Good'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 4: Travel Time & Commute Index */}
      {data && (
        <div className={`rounded-2xl border p-5 shadow-xs space-y-4 ${
          isMobile
            ? 'border-[#134426] bg-[#092c19] text-white'
            : 'border-slate-200/90 bg-white text-slate-900'
        }`}>
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${isMobile ? 'text-white' : 'text-slate-900'}`}>
              <Compass className="h-4 w-4 text-sky-500" />
              Commute & Field Travel Safety Index
            </h3>
            <p className={`text-xs ${isMobile ? 'text-emerald-300/80' : 'text-slate-500'}`}>
              Plan technician dispatch, site surveys, and team travel to avoid peak waterlogging and storm windows.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.travelIndex.map((win, idx) => (
              <div
                key={idx}
                className={`rounded-xl border p-3.5 space-y-2 ${
                  win.status === 'AVOID'
                    ? (isMobile ? 'border-rose-500/40 bg-rose-950/20 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-900')
                    : win.status === 'CAUTION'
                    ? (isMobile ? 'border-amber-500/30 bg-amber-950/20 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-900')
                    : (isMobile ? 'border-emerald-500/25 bg-black/40 text-emerald-200' : 'border-slate-200/90 bg-slate-50 text-slate-800')
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isMobile ? 'text-white' : 'text-slate-900'}`}>{win.timeSlot}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      win.status === 'AVOID'
                        ? 'bg-rose-600 text-white'
                        : win.status === 'CAUTION'
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {win.status}
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed opacity-90">{win.reason}</p>

                <div className={`flex items-center justify-between text-[10px] pt-1 border-t ${
                  isMobile ? 'border-emerald-500/10' : 'border-slate-200/60'
                }`}>
                  <span className={isMobile ? 'text-emerald-400/70' : 'text-slate-500'}>Peak Rain Chance</span>
                  <span className={`font-bold ${isMobile ? 'text-white' : 'text-slate-900'}`}>{win.rainProbability}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 5: 7-Day Extended Outlook */}
      {data && (
        <div className={`rounded-2xl border p-5 shadow-xs space-y-4 ${
          isMobile
            ? 'border-[#134426] bg-[#092c19] text-white'
            : 'border-slate-200/90 bg-white text-slate-900'
        }`}>
          <h3 className={`text-base font-bold flex items-center gap-2 ${isMobile ? 'text-white' : 'text-slate-900'}`}>
            <Calendar className="h-4 w-4 text-emerald-600" />
            7-Day Extended Operations Forecast
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {data.daily.map((day, idx) => {
              const dayName = idx === 0 ? 'Today' : new Date(day.date).toLocaleDateString([], { weekday: 'short' });
              return (
                <div
                  key={day.date}
                  className={`flex flex-col items-center justify-between rounded-xl border p-3 text-center ${
                    isMobile ? 'border-emerald-500/20 bg-black/30' : 'border-slate-200/80 bg-slate-50'
                  }`}
                >
                  <span className={`text-xs font-bold ${isMobile ? 'text-emerald-300' : 'text-slate-600'}`}>{dayName}</span>
                  <span className="my-1.5 text-2xl">{day.weatherIcon}</span>
                  <div className={`text-xs font-black ${isMobile ? 'text-white' : 'text-slate-900'}`}>
                    {day.temperatureMax}° / {day.temperatureMin}°
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-sky-600 font-bold">
                    <Droplets className="h-2.5 w-2.5" />
                    <span>{day.precipitationProbabilityMax}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherBroadcastPage;
