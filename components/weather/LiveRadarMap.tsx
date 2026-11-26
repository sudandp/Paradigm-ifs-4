import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCw,
  Layers,
  Cloud,
  CloudRain,
  LocateFixed,
  Clock,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface RadarFrame {
  time: number; // Unix timestamp (seconds)
  path: string;
  kind: 'past' | 'nowcast';
}

interface SatelliteFrame {
  time: number;
  path: string;
}

interface LiveRadarMapProps {
  lat: number;
  lon: number;
  locationName: string;
  isMobile?: boolean;
}

type LayerFilter = 'radar' | 'satellite' | 'both';
type BaseMapStyle = 'dark' | 'street' | 'satellite';

const BASE_TILE_URLS: Record<
  BaseMapStyle,
  { url: string; attribution: string; className?: string }
> = {
  dark: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    className: 'brightness-[0.85] contrast-[1.05] invert hue-rotate-180',
  },
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  },
};

export const LiveRadarMap: React.FC<LiveRadarMapProps> = ({
  lat,
  lon,
  locationName,
  isMobile = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  const [host, setHost] = useState<string>('https://tilecache.rainviewer.com');
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [satFrames, setSatFrames] = useState<SatelliteFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loadingFrames, setLoadingFrames] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // User Filters
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('both');
  const [baseStyle, setBaseStyle] = useState<BaseMapStyle>('dark');
  const [radarOpacity, setRadarOpacity] = useState<number>(0.75);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Recalculate Leaflet map dimensions when toggling Full Map + support Escape key
  useEffect(() => {
    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 60);

    if (!isFullscreen) return () => window.clearTimeout(timer);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  // Fetch RainViewer API frames (past 2h + nowcast 30m + satellite IR)
  const loadRadarMetadata = async () => {
    setLoadingFrames(true);
    setFetchError(null);
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!res.ok) throw new Error(`RainViewer HTTP ${res.status}`);
      const json = await res.json();

      if (json.host) setHost(json.host);

      const past: RadarFrame[] = (json.radar?.past || []).map((f: { time: number; path: string }) => ({
        time: f.time,
        path: f.path,
        kind: 'past' as const,
      }));
      const nowcast: RadarFrame[] = (json.radar?.nowcast || []).map((f: { time: number; path: string }) => ({
        time: f.time,
        path: f.path,
        kind: 'nowcast' as const,
      }));

      const combined = [...past, ...nowcast];
      setRadarFrames(combined);
      setSatFrames(json.satellite?.infrared || []);

      // Default to latest LIVE (last past frame)
      if (past.length > 0) {
        setFrameIndex(past.length - 1);
      } else {
        setFrameIndex(0);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load radar frames');
    } finally {
      setLoadingFrames(false);
    }
  };

  useEffect(() => {
    loadRadarMetadata();
  }, []);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lon],
      zoom: 9,
      zoomControl: true,
      attributionControl: true,
    });

    const tileCfg = BASE_TILE_URLS[baseStyle];
    baseLayerRef.current = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      maxZoom: 18,
      className: tileCfg.className || '',
    }).addTo(map);

    markerRef.current = L.circleMarker([lat, lon], {
      radius: 7,
      color: '#10b981',
      fillColor: '#34d399',
      fillOpacity: 0.9,
      weight: 2,
    })
      .addTo(map)
      .bindTooltip(locationName, { permanent: false, direction: 'top' });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      baseLayerRef.current = null;
      radarLayerRef.current = null;
      satelliteLayerRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update map center & marker when selected location changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([lat, lon], map.getZoom(), { animate: true });
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
      markerRef.current.setTooltipContent(locationName);
    }
  }, [lat, lon, locationName]);

  // Update base map style when toggled
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
    }
    const tileCfg = BASE_TILE_URLS[baseStyle];
    baseLayerRef.current = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      maxZoom: 18,
      className: tileCfg.className || '',
    }).addTo(map);
    baseLayerRef.current.bringToBack();
  }, [baseStyle]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || radarFrames.length === 0) return;
    const id = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % radarFrames.length);
    }, 650);
    return () => window.clearInterval(id);
  }, [isPlaying, radarFrames.length]);

  const currentFrame = radarFrames[frameIndex];

  // Closest satellite frame to current radar timestamp
  const matchingSatFrame = useMemo(() => {
    if (!satFrames.length || !currentFrame) return satFrames[satFrames.length - 1];
    return satFrames.reduce((best, item) =>
      Math.abs(item.time - currentFrame.time) < Math.abs(best.time - currentFrame.time) ? item : best
    );
  }, [satFrames, currentFrame]);

  // Update radar & satellite tile layers when frame, layer filter, or opacity changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous overlay layers
    if (radarLayerRef.current) {
      map.removeLayer(radarLayerRef.current);
      radarLayerRef.current = null;
    }
    if (satelliteLayerRef.current) {
      map.removeLayer(satelliteLayerRef.current);
      satelliteLayerRef.current = null;
    }

    // Satellite IR cloud layer (render underneath radar)
    if ((layerFilter === 'satellite' || layerFilter === 'both') && matchingSatFrame) {
      satelliteLayerRef.current = L.tileLayer(
        `${host}${matchingSatFrame.path}/256/{z}/{x}/{y}/0/0_0.png`,
        {
          opacity: layerFilter === 'both' ? Math.min(radarOpacity * 0.65, 0.55) : radarOpacity,
          zIndex: 200,
          maxNativeZoom: 7,
          maxZoom: 18,
        }
      ).addTo(map);
    }

    // Rain radar reflectivity layer (color scheme 2 = Universal Blue/Green/Yellow/Red, smooth=1, snow=1)
    if ((layerFilter === 'radar' || layerFilter === 'both') && currentFrame) {
      radarLayerRef.current = L.tileLayer(
        `${host}${currentFrame.path}/256/{z}/{x}/{y}/2/1_1.png`,
        {
          opacity: radarOpacity,
          zIndex: 300,
          maxNativeZoom: 7,
          maxZoom: 18,
        }
      ).addTo(map);
    }
  }, [host, currentFrame, matchingSatFrame, layerFilter, radarOpacity]);

  // Live index = last 'past' frame
  const liveIndex = useMemo(() => {
    const pastCount = radarFrames.filter((f) => f.kind === 'past').length;
    return pastCount > 0 ? pastCount - 1 : 0;
  }, [radarFrames]);

  // Jump helper for "Check Before Data" presets (minutes offset from LIVE)
  const jumpToOffsetMinutes = (offsetMin: number) => {
    if (!radarFrames.length || !radarFrames[liveIndex]) return;
    setIsPlaying(false);
    const targetTime = radarFrames[liveIndex].time + offsetMin * 60;
    let bestIdx = liveIndex;
    let bestDiff = Infinity;
    radarFrames.forEach((f, i) => {
      const diff = Math.abs(f.time - targetTime);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    });
    setFrameIndex(bestIdx);
  };

  const formattedFrameTime = useMemo(() => {
    if (!currentFrame) return 'Loading...';
    const d = new Date(currentFrame.time * 1000);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const diffMin = Math.round((currentFrame.time - (radarFrames[liveIndex]?.time ?? currentFrame.time)) / 60);
    if (currentFrame.kind === 'nowcast') {
      return `${timeStr} (Forecast +${diffMin}m)`;
    }
    if (diffMin === 0) return `${timeStr} (LIVE)`;
    return `${timeStr} (${diffMin}m ago)`;
  }, [currentFrame, radarFrames, liveIndex]);

  return (
    <div
      className={`overflow-hidden border shadow-sm ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] flex flex-col rounded-none'
          : 'rounded-2xl'
      } ${
        isMobile ? 'border-[#134426] bg-[#092c19]' : 'border-slate-200/90 bg-white'
      }`}
    >
      {/* Top Header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 p-3.5 border-b ${
          isMobile ? 'border-[#134426]' : 'border-slate-100'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span
            className={`text-xs font-black uppercase tracking-wider ${
              isMobile ? 'text-emerald-400' : 'text-emerald-700'
            }`}
          >
            Live Doppler Radar & Satellite
          </span>
          <span className="text-xs text-slate-400">•</span>
          <span className={`text-xs font-semibold ${isMobile ? 'text-emerald-200' : 'text-slate-600'}`}>
            {locationName} ({lat.toFixed(3)}°N, {lon.toFixed(3)}°E)
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => {
              mapRef.current?.setView([lat, lon], 9, { animate: true });
            }}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 border cursor-pointer transition-colors ${
              isMobile
                ? 'border-emerald-500/30 bg-black/40 text-emerald-300 hover:bg-[#134426]'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-500'
            }`}
            title="Re-center on selected site"
          >
            <LocateFixed className="h-3 w-3 text-emerald-600" />
            <span>Center</span>
          </button>

          <button
            type="button"
            onClick={loadRadarMetadata}
            disabled={loadingFrames}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 border cursor-pointer transition-colors ${
              isMobile
                ? 'border-emerald-500/30 bg-black/40 text-emerald-300 hover:bg-[#134426]'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-500'
            }`}
            title="Reload latest radar frames"
          >
            <RotateCw className={`h-3 w-3 text-emerald-600 ${loadingFrames ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 border cursor-pointer transition-colors ${
              isFullscreen
                ? 'border-rose-500/40 bg-rose-600 text-white hover:bg-rose-700'
                : isMobile
                ? 'border-emerald-500/30 bg-black/40 text-emerald-300 hover:bg-[#134426]'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
            title={isFullscreen ? 'Exit Full Map (Esc)' : 'Expand to Full Map'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3 w-3" />
                <span>Exit Full Map</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3" />
                <span>Full Map</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter Bar: Check Before Data (Time), Layer Filter & Map Style */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 border-b ${
          isMobile ? 'border-[#134426] bg-black/30' : 'border-slate-100 bg-slate-50/90'
        }`}
      >
        {/* Check Before Data: Past / Live / Forecast Time Filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mr-1 ${
              isMobile ? 'text-emerald-400/70' : 'text-slate-500'
            }`}
          >
            <Clock className="h-3 w-3" />
            Check Time:
          </span>
          {[
            { label: '⏮ -2h', offset: -120 },
            { label: '-1h', offset: -60 },
            { label: '-30m', offset: -30 },
            { label: '🔴 LIVE', offset: 0 },
            { label: '+30m', offset: 30 },
          ].map((preset) => {
            const isLivePreset = preset.offset === 0;
            const currentDiffMin =
              currentFrame && radarFrames[liveIndex]
                ? Math.round((currentFrame.time - radarFrames[liveIndex].time) / 60)
                : 0;
            const isActive = Math.abs(currentDiffMin - preset.offset) <= 5;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => jumpToOffsetMinutes(preset.offset)}
                disabled={!radarFrames.length}
                className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer disabled:opacity-40 ${
                  isActive
                    ? isLivePreset
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'bg-emerald-700 border-emerald-700 text-white'
                    : isMobile
                    ? 'border-[#134426] bg-black/40 text-emerald-300 hover:bg-[#134426]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Layer Filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mr-1 ${
              isMobile ? 'text-emerald-400/70' : 'text-slate-500'
            }`}
          >
            <Layers className="h-3 w-3" />
            Layer:
          </span>
          {(
            [
              { key: 'radar', label: 'Rain', icon: CloudRain },
              { key: 'satellite', label: 'Clouds', icon: Cloud },
              { key: 'both', label: 'Both', icon: Layers },
            ] as { key: LayerFilter; label: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setLayerFilter(key)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                layerFilter === key
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : isMobile
                  ? 'border-[#134426] bg-black/40 text-emerald-300 hover:bg-[#134426]'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'
              }`}
            >
              <Icon className="h-3 w-3" />
              <span>{label}</span>
            </button>
          ))}

          {/* Base Map Theme */}
          <select
            value={baseStyle}
            onChange={(e) => setBaseStyle(e.target.value as BaseMapStyle)}
            aria-label="Map theme"
            className={`ml-1 px-2 py-1 rounded-md text-[11px] font-bold border cursor-pointer focus:outline-none ${
              isMobile
                ? 'border-[#134426] bg-black/60 text-emerald-200'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            <option value="dark">Dark Map</option>
            <option value="street">Street Map</option>
            <option value="satellite">Satellite Map</option>
          </select>
        </div>
      </div>

      {/* Interactive Leaflet Map */}
      <div className={`relative w-full bg-slate-900 ${isFullscreen ? 'flex-1 min-h-0' : 'h-[440px]'}`}>
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {fetchError && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[450] rounded-lg bg-rose-900/90 text-white px-3 py-1.5 text-xs font-semibold shadow-lg">
            Radar feed unavailable: {fetchError}
          </div>
        )}

        {/* Bottom Floating Timeline Scrubber */}
        <div className="absolute bottom-3 left-3 right-3 z-[450] flex flex-wrap items-center gap-2.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/15 px-3 py-2 text-white shadow-xl">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setFrameIndex((p) => Math.max(0, p - 1));
              }}
              disabled={!radarFrames.length || frameIndex === 0}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 cursor-pointer"
              title="Previous 10m frame"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              disabled={!radarFrames.length}
              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 cursor-pointer"
              title={isPlaying ? 'Pause radar animation' : 'Play radar animation'}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setFrameIndex((p) => Math.min(radarFrames.length - 1, p + 1));
              }}
              disabled={!radarFrames.length || frameIndex >= radarFrames.length - 1}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 cursor-pointer"
              title="Next 10m frame"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, radarFrames.length - 1)}
            value={frameIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setFrameIndex(Number(e.target.value));
            }}
            disabled={!radarFrames.length}
            className="flex-1 min-w-[120px] accent-emerald-500 cursor-pointer"
          />

          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span
              className={`px-2 py-0.5 rounded-md ${
                currentFrame?.kind === 'nowcast'
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/30'
                  : frameIndex === liveIndex
                  ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                  : 'bg-white/10 text-emerald-200 border border-white/15'
              }`}
            >
              {formattedFrameTime}
            </span>

            <label className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-300">
              <span>Opacity</span>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={radarOpacity}
                onChange={(e) => setRadarOpacity(Number(e.target.value))}
                className="w-16 accent-emerald-500 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Legend Footer */}
      <div
        className={`p-3 border-t flex flex-wrap items-center justify-between gap-3 text-[11px] ${
          isMobile
            ? 'border-[#134426] bg-black/40 text-emerald-300/80'
            : 'border-slate-100 bg-slate-50 text-slate-600'
        }`}
      >
        <div className="flex items-center gap-2 font-semibold flex-wrap">
          <span>Precipitation Reflectivity:</span>
          <div className="flex items-center gap-1 text-[10px] font-mono flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Light (0.1mm)</span>
            <span>→</span>
            <span className="px-1.5 py-0.5 rounded bg-sky-200 text-sky-900 font-bold">Moderate (2.5mm)</span>
            <span>→</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold">Heavy (10mm)</span>
            <span>→</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-bold">Storm / Cloudburst</span>
          </div>
        </div>
        <span className="text-[10px] opacity-75">
          Source: RainViewer Tile API (2h Past + 30m Forecast + IR Clouds)
        </span>
      </div>
    </div>
  );
};

export default LiveRadarMap;
