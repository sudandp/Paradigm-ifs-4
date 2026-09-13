import React, { useEffect, useState, useRef } from 'react';
import { 
  Layers, 
  Maximize2, 
  Minimize2, 
  Crosshair, 
  Map as MapIcon, 
  Globe, 
  Mountain, 
  Moon, 
  Check, 
  X, 
  Users, 
  Navigation, 
  MapPin, 
  CheckCircle,
  Eye,
  Compass
} from 'lucide-react';
import { formatDistanceToNow, isToday } from 'date-fns';
import { supabase } from '../../services/supabase';
import { User } from '../../types';
import MapSkeleton from '../../components/ui/MapSkeleton';
import 'leaflet/dist/leaflet.css';

const mapPopupStyles = `
  .leaflet-popup-content-wrapper {
    border-radius: 14px;
    padding: 4px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  }
  .marker-popup-content {
    padding: 8px;
  }
  .marker-popup-name {
    font-weight: 700;
    margin: 0;
    color: #1f2937;
  }
  .marker-popup-status {
    font-size: 11px;
    color: #6b7280;
    margin: 4px 0 0;
  }
  .leaflet-container {
    width: 100% !important;
    height: 100% !important;
    z-index: 1 !important;
  }
`;

interface TeamMapViewProps {
  members: User[];
  latestLocations: Record<string, { latitude: number; longitude: number; timestamp: string }>;
  memberLocations?: Record<string, { state: string; city: string }>;
  selectedLocation: string;
  theme?: string;
  isMobile?: boolean;
  isTablet?: boolean;
}

type MapStyleKey = 'streets' | 'satellite' | 'terrain' | 'dark';

interface MapStyleOption {
  id: MapStyleKey;
  name: string;
  url: string;
  maxNativeZoom: number;
  attribution: string;
  previewBg: string;
  icon: React.ReactNode;
}

const MAP_STYLES: Record<MapStyleKey, MapStyleOption> = {
  streets: {
    id: 'streets',
    name: 'Default',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
    previewBg: 'from-emerald-100 to-amber-100 dark:from-emerald-950 dark:to-stone-900',
    icon: <MapIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxNativeZoom: 18,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA',
    previewBg: 'from-blue-900 to-emerald-900',
    icon: <Globe className="w-4 h-4 text-blue-400" />
  },
  terrain: {
    id: 'terrain',
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 17,
    attribution: 'Map data: &copy; OpenStreetMap, SRTM | Map style: OpenTopoMap',
    previewBg: 'from-stone-300 to-amber-200 dark:from-stone-800 dark:to-stone-900',
    icon: <Mountain className="w-4 h-4 text-amber-600 dark:text-amber-400" />
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxNativeZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    previewBg: 'from-slate-900 to-black',
    icon: <Moon className="w-4 h-4 text-indigo-400" />
  }
};

const LABELS_OVERLAY_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png';

export const TeamMapView: React.FC<TeamMapViewProps> = ({
  members,
  latestLocations,
  memberLocations = {},
  selectedLocation,
  theme = 'light',
  isMobile = false,
  isTablet = false,
}) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('streets');
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [onlyActiveToday, setOnlyActiveToday] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const labelLayerRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const hasInitiallyFitted = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Inject custom map & popup styles
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = mapPopupStyles;
    document.head.appendChild(styleSheet);
    return () => {
      if (document.head.contains(styleSheet)) {
        document.head.removeChild(styleSheet);
      }
    };
  }, []);

  // Click outside listener for the Google Maps details popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowLayersPanel(false);
      }
    };
    if (showLayersPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLayersPanel]);

  // Keyboard shortcut: Escape exits fullscreen or closes layers popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        if (showLayersPanel) setShowLayersPanel(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, showLayersPanel]);

  // Handle container resize when fullscreen changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Initialize Map Object & Tile Layer
  useEffect(() => {
    let isCancelled = false;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      // Clean existing leaflet instance on container if present
      if ((mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const L = await import('leaflet');
      if (isCancelled) return;
      LRef.current = L;

      const initialStyleConfig = MAP_STYLES[mapStyle] || MAP_STYLES.streets;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: true,
        markerZoomAnimation: true,
        maxZoom: 22
      }).setView([12.9716, 77.5946], 12); // Default Bangalore

      mapRef.current = map;

      // Add Base Tile Layer
      const baseTiles = L.tileLayer(initialStyleConfig.url, {
        maxZoom: 22,
        maxNativeZoom: initialStyleConfig.maxNativeZoom,
        zIndex: 1,
        detectRetina: true,
        attribution: initialStyleConfig.attribution
      }).addTo(map);

      tileLayerRef.current = baseTiles;

      // Add Labels Overlay Layer for Satellite & Terrain
      const labelTiles = L.tileLayer(LABELS_OVERLAY_URL, {
        zIndex: 500,
        maxZoom: 22,
        maxNativeZoom: 18,
        detectRetina: true
      });
      labelLayerRef.current = labelTiles;

      if (showLabels && (mapStyle === 'satellite' || mapStyle === 'terrain')) {
        labelTiles.addTo(map);
      }

      // Initialize markers layer group
      markersRef.current = L.layerGroup().addTo(map);

      // Custom Zoom control at bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Fade out skeleton once tiles load
      baseTiles.once('load', () => {
        setTimeout(() => setMapLoaded(true), 150);
      });
      setTimeout(() => setMapLoaded(true), 2500);

      // Multi-stage size invalidation for zero-gray-tile guarantee
      const invalidate = () => {
        if (mapRef.current) mapRef.current.invalidateSize();
      };
      setTimeout(invalidate, 100);
      setTimeout(invalidate, 300);
      setTimeout(invalidate, 600);
      setTimeout(invalidate, 1200);
    };

    initMap();

    return () => {
      isCancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle Tile Updates when mapStyle or showLabels changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current || !LRef.current) return;
    const config = MAP_STYLES[mapStyle] || MAP_STYLES.streets;
    
    tileLayerRef.current.setUrl(config.url);

    // Manage Labels overlay layer
    if (labelLayerRef.current) {
      if (showLabels && (mapStyle === 'satellite' || mapStyle === 'terrain')) {
        if (!mapRef.current.hasLayer(labelLayerRef.current)) {
          mapRef.current.addLayer(labelLayerRef.current);
        }
      } else {
        if (mapRef.current.hasLayer(labelLayerRef.current)) {
          mapRef.current.removeLayer(labelLayerRef.current);
        }
      }
    }

    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [mapStyle, showLabels]);

  // Filter members according to `onlyActiveToday` and location
  const membersToPlot = members.filter(member => {
    const loc = latestLocations[member.id];
    if (!loc || !loc.latitude || !loc.longitude) return false;
    if (onlyActiveToday && !isToday(new Date(loc.timestamp))) {
      return false;
    }
    return true;
  });

  // Plot and update Markers on the map
  useEffect(() => {
    if (!mapRef.current || !markersRef.current || !LRef.current) return;
    const L = LRef.current;
    markersRef.current.clearLayers();

    const markerInstances: any[] = [];

    membersToPlot.forEach(member => {
      const loc = latestLocations[member.id];
      if (loc && loc.latitude && loc.longitude) {
        const isActiveToday = isToday(new Date(loc.timestamp));
        const indicatorColor = isActiveToday ? '#10b981' : '#ef4444';

        // Resolve profile photo URL
        let resolvedPhotoUrl = member.photoUrl;
        if (resolvedPhotoUrl && !resolvedPhotoUrl.startsWith('http') && !resolvedPhotoUrl.startsWith('data:') && !resolvedPhotoUrl.startsWith('/')) {
          const isAvatar = resolvedPhotoUrl.startsWith('avatars/');
          const bucket = isAvatar ? 'avatars' : 'onboarding-documents';
          const path = isAvatar ? resolvedPhotoUrl.replace('avatars/', '') : resolvedPhotoUrl;
          try {
            const { data } = supabase.storage.from(bucket).getPublicUrl(path);
            resolvedPhotoUrl = data.publicUrl;
          } catch (e) {
            console.error('Failed to resolve marker photo:', e);
          }
        }

        const mapHtml = `
          <div class="surgical-marker">
            <div class="marker-avatar" style="background-image: url(${resolvedPhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`}); border-color: ${indicatorColor}"></div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: '',
          html: mapHtml,
          iconSize: [48, 48],
          iconAnchor: [24, 48],
          popupAnchor: [0, -48]
        });

        const marker = L.marker([loc.latitude, loc.longitude], { icon: customIcon });

        const phoneClean = member.phone ? member.phone.replace(/\D/g, '') : '';
        const popupContent = `
          <div class="marker-popup-content min-w-[180px]">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="w-2.5 h-2.5 rounded-full ${isActiveToday ? 'bg-emerald-500' : 'bg-red-500'}"></span>
              <p class="marker-popup-name text-xs font-bold text-gray-900">${member.name}</p>
            </div>
            <p class="marker-popup-status text-[11px] text-gray-500 mb-1">
              ${isActiveToday ? 'Active today' : 'Last active'}: ${formatDistanceToNow(new Date(loc.timestamp))} ago
            </p>
            ${phoneClean ? `
              <a href="https://wa.me/91${phoneClean}" target="_blank" class="mt-2.5 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all no-underline shadow-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            ` : ''}
          </div>
        `;

        marker.bindPopup(popupContent);
        markersRef.current.addLayer(marker);
        markerInstances.push(marker);
      }
    });

    if (markerInstances.length > 0) {
      const group = L.featureGroup(markerInstances);
      mapRef.current.fitBounds(group.getBounds().pad(0.3), {
        animate: true,
        duration: !hasInitiallyFitted.current ? 2.0 : 0.8,
        easeLinearity: 0.1
      });
      hasInitiallyFitted.current = true;
    } else if (selectedLocation !== 'All' && selectedLocation.startsWith('city:')) {
      const city = selectedLocation.split(':')[2];
      if (city) {
        fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json&limit=1`)
          .then(res => res.json())
          .then(data => {
            if (data && data.length > 0 && mapRef.current) {
              mapRef.current.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 12, { animate: true, duration: 1.0 });
            }
          })
          .catch(err => console.error("Could not fetch city location", err));
      }
    }
  }, [membersToPlot, latestLocations, mapLoaded]);

  // Recenter / Fit All Bounds handler
  const handleRecenter = () => {
    if (!mapRef.current || !markersRef.current || !LRef.current) return;
    const layers = markersRef.current.getLayers();
    if (layers.length > 0) {
      const group = LRef.current.featureGroup(layers);
      mapRef.current.fitBounds(group.getBounds().pad(0.3), {
        animate: true,
        duration: 1.0,
        easeLinearity: 0.25
      });
    } else {
      mapRef.current.setView([12.9716, 77.5946], 12, { animate: true, duration: 1.0 });
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  const activeCountToday = members.filter(m => {
    const loc = latestLocations[m.id];
    return loc && isToday(new Date(loc.timestamp));
  }).length;

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[99999] w-screen h-screen bg-slate-950 transition-all duration-300 flex flex-col"
          : "relative rounded-2xl overflow-hidden border border-border shadow-sm bg-card transition-all duration-300 shrink-0 w-full"
      }
      style={
        isFullscreen
          ? { height: '100vh', width: '100vw' }
          : { height: isMobile ? '320px' : (isTablet ? '340px' : '440px'), minHeight: isMobile ? '320px' : (isTablet ? '340px' : '440px') }
      }
    >
      {/* Top Banner for Fullscreen Mode (Google Maps / Bing Maps style) */}
      {isFullscreen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-900/90 backdrop-blur-md text-white text-xs rounded-xl shadow-2xl border border-white/10 font-medium">
            <span>To exit full screen, press</span>
            <kbd className="px-2 py-0.5 bg-white/15 text-white rounded text-[11px] font-mono font-bold border border-white/20 shadow-inner">
              Esc
            </kbd>
            <span>or</span>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
            >
              click here
            </button>
          </div>
        </div>
      )}

      {/* Top Right Floating Action Controls */}
      <div className="absolute top-4 right-4 z-[999] flex items-center gap-2">
        {/* Live marker stats badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card/90 dark:bg-slate-900/90 backdrop-blur-md border border-border shadow-md text-xs font-semibold text-primary-text">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{membersToPlot.length} on map</span>
          {activeCountToday > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
              ({activeCountToday} active today)
            </span>
          )}
        </div>

        {/* Recenter button */}
        <button
          type="button"
          onClick={handleRecenter}
          title="Fit all markers"
          className="p-2.5 rounded-xl bg-card/90 dark:bg-slate-900/90 backdrop-blur-md border border-border shadow-md text-primary-text hover:text-emerald-500 hover:border-emerald-500/40 active:scale-95 transition-all cursor-pointer"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Fullscreen toggle button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Full Screen (Esc)" : "Full Screen"}
          className="p-2.5 rounded-xl bg-card/90 dark:bg-slate-900/90 backdrop-blur-md border border-border shadow-md text-primary-text hover:text-emerald-500 hover:border-emerald-500/40 active:scale-95 transition-all cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Bottom Left: Google Maps Style Floating Layers & Map Details Popover */}
      <div className="absolute bottom-4 left-4 z-[999]" ref={panelRef}>
        {!showLayersPanel ? (
          /* Collapsed Layers Button */
          <button
            type="button"
            onClick={() => setShowLayersPanel(true)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-slate-800 shadow-xl hover:border-emerald-500/60 hover:shadow-2xl text-xs font-bold text-gray-800 dark:text-gray-100 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wider">Layers</span>
              <span className="text-xs font-bold capitalize">{MAP_STYLES[mapStyle]?.name || 'Default'}</span>
            </div>
          </button>
        ) : (
          /* Expanded "Map details" Popover Card */
          <div className="w-[300px] sm:w-[320px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl p-4.5 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-gray-800 dark:text-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white tracking-tight">Map details</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLayersPanel(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Map Details / Feature Shortcuts */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Map details
              </span>
              <div className="grid grid-cols-4 gap-2">
                {/* Active Staff toggle */}
                <button
                  type="button"
                  onClick={() => setOnlyActiveToday(prev => !prev)}
                  className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer ${
                    onlyActiveToday
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'bg-gray-50/70 dark:bg-slate-800/50 border-gray-200/70 dark:border-slate-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 ${
                    onlyActiveToday ? 'bg-emerald-500 text-white' : 'bg-gray-200/70 dark:bg-slate-700/60'
                  }`}>
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-center leading-tight">Active</span>
                </button>

                {/* Labels toggle */}
                <button
                  type="button"
                  onClick={() => setShowLabels(prev => !prev)}
                  className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer ${
                    showLabels
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'bg-gray-50/70 dark:bg-slate-800/50 border-gray-200/70 dark:border-slate-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 ${
                    showLabels ? 'bg-emerald-500 text-white' : 'bg-gray-200/70 dark:bg-slate-700/60'
                  }`}>
                    <Navigation className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-center leading-tight">Labels</span>
                </button>

                {/* Recenter / Fit All */}
                <button
                  type="button"
                  onClick={handleRecenter}
                  className="flex flex-col items-center justify-center p-2 rounded-2xl border border-gray-200/70 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 active:scale-95 transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-1 bg-gray-200/70 dark:bg-slate-700/60">
                    <Crosshair className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-center leading-tight">Fit All</span>
                </button>

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer ${
                    isFullscreen
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'bg-gray-50/70 dark:bg-slate-800/50 border-gray-200/70 dark:border-slate-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 ${
                    isFullscreen ? 'bg-emerald-500 text-white' : 'bg-gray-200/70 dark:bg-slate-700/60'
                  }`}>
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-bold text-center leading-tight">Screen</span>
                </button>
              </div>
            </div>

            {/* Section 2: Map Type (Thumbnails Grid) */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Map type
              </span>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(MAP_STYLES) as MapStyleKey[]).map(key => {
                  const item = MAP_STYLES[key];
                  const isSelected = mapStyle === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMapStyle(key)}
                      className="group/thumb flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
                    >
                      <div
                        className={`relative w-full aspect-square rounded-2xl overflow-hidden border-2 transition-all p-1 flex items-center justify-center bg-gradient-to-br ${item.previewBg} ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-md scale-102'
                            : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {item.icon}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold truncate max-w-full ${
                        isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Bottom Checkboxes */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 space-y-2">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                />
                <span>Labels & Roads</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyActiveToday}
                  onChange={(e) => setOnlyActiveToday(e.target.checked)}
                  className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                />
                <span>Active staff only today</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Real Leaflet Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0 will-change-transform"
        style={{ height: '100%', width: '100%' }}
      />

      {/* Skeleton Overlay - Fades out when map is ready */}
      <div
        className={`absolute inset-0 z-10 transition-all duration-700 ease-in-out bg-background will-change-opacity ${
          mapLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <MapSkeleton />
      </div>
    </div>
  );
};

export default TeamMapView;
