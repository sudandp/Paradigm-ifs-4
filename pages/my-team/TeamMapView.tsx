import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  Navigation,
  CheckCircle,
  MapPin,
  ChevronDown,
  ArrowDown,
} from 'lucide-react';
import { formatDistanceToNow, isToday } from 'date-fns';
import { supabase } from '../../services/supabase';
import { User } from '../../types';
import 'leaflet/dist/leaflet.css';

// ─── Popup + marker styles injected once ───────────────────────────────────
const mapPopupStyles = `
  .leaflet-popup-content-wrapper {
    border-radius: 14px;
    padding: 4px;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,.2), 0 8px 10px -6px rgba(0,0,0,.1);
  }
  .marker-popup-content { padding: 8px; }
  .leaflet-container {
    width: 100% !important;
    height: 100% !important;
    z-index: 1 !important;
    background: #aadaff !important;
    outline: none !important;
  }
  .leaflet-tile-pane {
    background: transparent !important;
  }
  /* Fix sub-pixel tile border lines / seams on Windows high-DPI scaling (Leaflet issue #3575) */
  .leaflet-tile {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    scale: 1.006 !important;
    transform-origin: 50% 50% !important;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
  }

  /* Ultra-crisp Dark Mode for Google Roadmap — retains all apartments, malls, POIs, building footprints & road names */
  .map-style-dark .leaflet-tile {
    filter: invert(100%) hue-rotate(180deg) brightness(88%) contrast(115%) saturate(110%) !important;
  }
  .map-style-dark .leaflet-bar a {
    background-color: #1e293b !important;
    color: #f1f5f9 !important;
    border-color: #334155 !important;
  }
  .map-style-dark .leaflet-bar a:hover {
    background-color: #334155 !important;
  }

  /* ── Avatar pin marker ─────────────────────────────────────────── */
  .avatar-pin {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.35));
    transition: transform 0.15s ease, filter 0.15s ease;
    transform-origin: bottom center;
  }
  .avatar-pin:hover {
    transform: scale(1.12) translateY(-2px);
    filter: drop-shadow(0 8px 16px rgba(0,0,0,0.45));
  }
  .avatar-pin-ring {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    padding: 3px;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25), inset 0 0 0 3px var(--ring-color, #10b981);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-sizing: border-box;
  }
  .avatar-pin-ring::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid var(--ring-color, #10b981);
    opacity: 0.95;
    pointer-events: none;
    box-sizing: border-box;
  }
  .avatar-pin-img {
    width: 100% !important;
    height: 100% !important;
    min-width: 100% !important;
    min-height: 100% !important;
    aspect-ratio: 1 / 1 !important;
    object-fit: cover !important;
    object-position: center !important;
    border-radius: 50% !important;
    display: block !important;
    flex-shrink: 0 !important;
  }
  .avatar-pin-initials {
    width: 100% !important;
    height: 100% !important;
    min-width: 100% !important;
    min-height: 100% !important;
    aspect-ratio: 1 / 1 !important;
    border-radius: 50% !important;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: 0.5px;
    background: var(--initials-bg, #6366f1);
    flex-shrink: 0 !important;
  }
  .avatar-pin-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--ring-color, #10b981);
    border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    margin-top: -1px;
  }
  .avatar-pin-tail {
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 8px solid var(--ring-color, #10b981);
    margin-top: -1px;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
  }

  /* Native fullscreen: make the map wrapper fill the screen cleanly */
  .paradigm-map-wrapper:fullscreen,
  .paradigm-map-wrapper:-webkit-full-screen,
  .paradigm-map-wrapper:-moz-full-screen,
  .paradigm-map-wrapper:-ms-fullscreen {
    width: 100vw !important;
    height: 100vh !important;
    background: #0f172a;
    border-radius: 0 !important;
    border: none !important;
  }
`;

interface TeamMapViewProps {
  members: User[];
  latestLocations: Record<string, { latitude: number; longitude: number; timestamp: string }>;
  memberLocations?: Record<string, { state: string; city: string }>;
  selectedLocation: string;
  onLocationChange?: (location: string) => void;
  availableLocations?: Record<string, string[]>;
  theme?: string;
  isMobile?: boolean;
  isTablet?: boolean;
  focusedMemberId?: string | null;
  onClearFocusedMember?: () => void;
}

type MapStyleKey = 'streets' | 'satellite' | 'terrain' | 'dark';

interface MapStyleOption {
  id: MapStyleKey;
  name: string;
  url: string;
  overlayUrl?: string;
  maxNativeZoom: number;
  attribution: string;
  previewBg: string;
  icon: React.ReactNode;
}

// Landmark & building reverse geocode cache
const locationLandmarkCache = new Map<string, { landmark: string; road: string; fullAddress: string }>();

const fetchLandmarkForCoords = async (lat: number, lng: number) => {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (locationLandmarkCache.has(key)) {
    return locationLandmarkCache.get(key)!;
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`
    );
    if (!res.ok) throw new Error('Failed to fetch');
    const d = await res.json();
    const addr = d.address || {};

    // Prioritize specific POI / Building names for facility management:
    // Apartments, residential complexes, shopping malls, hospitals, hotels, corporate parks
    const landmark =
      addr.building ||
      addr.amenity ||
      addr.apartment ||
      addr.residential ||
      addr.commercial ||
      addr.hospital ||
      addr.hotel ||
      addr.mall ||
      addr.retail ||
      addr.office ||
      addr.leisure ||
      d.name ||
      (addr.road ? addr.road : 'Area Location');

    const road = [
      addr.road || addr.pedestrian || addr.street || addr.highway,
      addr.suburb || addr.neighbourhood || addr.city_district,
      addr.city || addr.town || addr.village || addr.county,
      addr.state
    ].filter(Boolean).join(', ');

    const result = {
      landmark: landmark || 'Facility Area',
      road: road || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      fullAddress: d.display_name || road,
    };
    locationLandmarkCache.set(key, result);
    return result;
  } catch {
    return {
      landmark: 'Current Pin Location',
      road: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      fullAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  }
};

const MAP_STYLES: Record<MapStyleKey, MapStyleOption> = {
  streets: {
    id: 'streets',
    name: 'Roadmap (POIs)',
    // Google Maps detailed roadmap with apartments, malls, tech parks, hospitals, hotels, road names & building footprints
    url: 'https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}',
    maxNativeZoom: 21,
    attribution: '&copy; Google Maps',
    previewBg: 'from-emerald-100 to-amber-100 dark:from-emerald-950 dark:to-stone-900',
    icon: <MapIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    // Google Maps satellite + roads/labels/POIs overlay
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    overlayUrl: 'https://mt1.google.com/vt/lyrs=h&hl=en&x={x}&y={y}&z={z}',
    maxNativeZoom: 21,
    attribution: '&copy; Google Maps',
    previewBg: 'from-blue-900 to-emerald-900',
    icon: <Globe className="w-4 h-4 text-blue-400" />,
  },
  terrain: {
    id: 'terrain',
    name: 'Terrain',
    // Google Maps Terrain with roads & POIs
    url: 'https://mt1.google.com/vt/lyrs=p&hl=en&x={x}&y={y}&z={z}',
    maxNativeZoom: 20,
    attribution: '&copy; Google Maps',
    previewBg: 'from-stone-300 to-amber-200 dark:from-stone-800 dark:to-stone-900',
    icon: <Mountain className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    // Google Maps detailed roadmap with dark theme styling — retains all apartments, malls, tech parks, hospitals, roads & building footprints
    url: 'https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}',
    maxNativeZoom: 21,
    attribution: '&copy; Google Maps',
    previewBg: 'from-slate-900 to-black',
    icon: <Moon className="w-4 h-4 text-indigo-400" />,
  },
};

export const TeamMapView: React.FC<TeamMapViewProps> = ({
  members,
  latestLocations,
  memberLocations = {},
  selectedLocation,
  onLocationChange,
  availableLocations,
  theme = 'light',
  isMobile = false,
  isTablet = false,
  focusedMemberId = null,
  onClearFocusedMember,
}) => {
  const [mapStyle, setMapStyle]             = useState<MapStyleKey>('streets');
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showLabels, setShowLabels]         = useState(true);
  const [onlyActiveToday, setOnlyActiveToday] = useState(false);
  // Tracks whether the browser is currently in native fullscreen
  const [isFullscreen, setIsFullscreen]     = useState(false);

  // DOM refs — wrapperRef is the element we call requestFullscreen() on
  const wrapperRef      = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const tileLayerRef    = useRef<any>(null);
  const labelLayerRef   = useRef<any>(null);
  const markersRef      = useRef<any>(null);
  const LRef            = useRef<any>(null);
  const hasInitiallyFitted = useRef(false);
  const panelRef        = useRef<HTMLDivElement>(null);

  // ── Inject popup / fullscreen CSS once ──────────────────────────────────
  useEffect(() => {
    const el = document.createElement('style');
    el.innerText = mapPopupStyles;
    document.head.appendChild(el);
    return () => { if (document.head.contains(el)) document.head.removeChild(el); };
  }, []);

  // ── Sync isFullscreen state with native browser fullscreen events ────────
  useEffect(() => {
    const onFsChange = () => {
      const inFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(inFs);
      // Give browser a moment to finish resizing, then fix Leaflet tiles
      setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 100);
      setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 400);
    };
    document.addEventListener('fullscreenchange',       onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange',    onFsChange);
    document.addEventListener('MSFullscreenChange',     onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange',       onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('mozfullscreenchange',    onFsChange);
      document.removeEventListener('MSFullscreenChange',     onFsChange);
    };
  }, []);

  // ── Keyboard: Esc collapses layers panel (browser handles Esc for fs) ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLayersPanel) setShowLayersPanel(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showLayersPanel]);

  // ── Click outside layers panel ───────────────────────────────────────────
  useEffect(() => {
    if (!showLayersPanel) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setShowLayersPanel(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showLayersPanel]);

  // ── Initialize Leaflet map once ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      // Remove stale Leaflet instance from container if HMR re-ran
      if ((mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const L = await import('leaflet');
      if (cancelled) return;
      LRef.current = L;

      // ── Eliminate tile lines & seams via 4-sided GPU scale overlap (Leaflet issue #3575) ──
      // Scales each tile 0.6% from its center, overlapping all 4 edges seamlessly with the tile's own pixels
      if (!(L.GridLayer as any)._scaleOverlapPatched) {
        const originalInitTile = (L.GridLayer.prototype as any)._initTile;
        (L.GridLayer.prototype as any)._initTile = function (tile: HTMLElement) {
          originalInitTile.call(this, tile);
          if (tile && tile.style) {
            tile.style.scale = '1.006';
            tile.style.transformOrigin = '50% 50%';
          }
        };

        const originalAddTile = (L.GridLayer.prototype as any)._addTile;
        (L.GridLayer.prototype as any)._addTile = function (coords: any, container: HTMLElement) {
          originalAddTile.call(this, coords, container);
          const key = this._tileCoordsToKey(coords);
          const tileEntry = this._tiles[key];
          if (tileEntry && tileEntry.el && tileEntry.el.style) {
            tileEntry.el.style.scale = '1.006';
            tileEntry.el.style.transformOrigin = '50% 50%';
          }
        };
        (L.GridLayer as any)._scaleOverlapPatched = true;
      }

      const cfg = MAP_STYLES[mapStyle] || MAP_STYLES.streets;

      // Calculate initial focus bounds from members immediately to load directly in team view (Image 3)
      const validPoints: [number, number][] = [];
      members.forEach(m => {
        const loc = latestLocations[m.id];
        if (
          loc?.latitude &&
          loc?.longitude &&
          !isNaN(loc.latitude) &&
          !isNaN(loc.longitude) &&
          loc.latitude !== 0 &&
          loc.longitude !== 0 &&
          Math.abs(loc.latitude) <= 90 &&
          Math.abs(loc.longitude) <= 180
        ) {
          validPoints.push([loc.latitude, loc.longitude]);
        }
      });

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: true,
        markerZoomAnimation: true,
        zoomSnap: 1,
        zoomDelta: 1,
        scrollWheelZoom: false, // Prevents hijacking page scroll on web app
        minZoom: 10, // Prevents zooming out to the entire planet
        maxZoom: 22,
      });

      if (validPoints.length > 0) {
        const initialBounds = L.latLngBounds(validPoints);
        const ne = initialBounds.getNorthEast();
        const sw = initialBounds.getSouthWest();
        if (Math.abs(ne.lat - sw.lat) < 0.0001 && Math.abs(ne.lng - sw.lng) < 0.0001) {
          map.setView(initialBounds.getCenter(), 14);
        } else {
          map.fitBounds(initialBounds.pad(0.25), { maxZoom: 15, padding: [24, 24], animate: false });
        }
        hasInitiallyFitted.current = true;
      } else {
        map.setView([12.9716, 77.5946], 12);
      }

      mapRef.current = map;

      // Base tile layer
      const baseTiles = L.tileLayer(cfg.url, {
        maxZoom: 22,
        maxNativeZoom: cfg.maxNativeZoom,
        zIndex: 1,
        detectRetina: false,
        attribution: cfg.attribution,
        keepBuffer: 8,
        updateWhenIdle: false, // Ensures tiles load immediately during movement, zoom, and switching
        updateWhenZooming: true,
        updateInterval: 50,
      }).addTo(map);
      tileLayerRef.current = baseTiles;

      // Overlay layer for roads & labels (Google roads for satellite, Esri reference for dark)
      const overlayUrl = cfg.overlayUrl || '';
      const labelTiles = L.tileLayer(overlayUrl, {
        zIndex: 500,
        maxZoom: 22,
        maxNativeZoom: cfg.maxNativeZoom || 18,
        detectRetina: false,
        keepBuffer: 8,
        updateWhenIdle: false,
        updateWhenZooming: true,
        updateInterval: 50,
      });
      labelLayerRef.current = labelTiles;
      if (showLabels && cfg.overlayUrl) {
        labelTiles.addTo(map);
      }

      markersRef.current = L.layerGroup().addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Multi-stage invalidateSize — prevents gray-tile edges after layout settle
      [80, 250, 500, 900, 1500].forEach(ms =>
        setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), ms)
      );

      // Automatically recalculate tile grid whenever container size shifts (sidebar/zoom/layout/mobile)
      let ro: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          mapRef.current?.invalidateSize({ animate: false });
        });
        if (mapContainerRef.current) ro.observe(mapContainerRef.current);
        if (wrapperRef.current) ro.observe(wrapperRef.current);
      }

      return () => {
        ro?.disconnect();
      };
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Swap tile URL when map style / labels toggle ─────────────────────────
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    const cfg = MAP_STYLES[mapStyle] || MAP_STYLES.streets;
    tileLayerRef.current.setUrl(cfg.url, false);
    tileLayerRef.current.options.maxNativeZoom = cfg.maxNativeZoom;
    tileLayerRef.current.redraw();

    if (labelLayerRef.current) {
      if (showLabels && cfg.overlayUrl) {
        labelLayerRef.current.setUrl(cfg.overlayUrl, false);
        labelLayerRef.current.options.maxNativeZoom = cfg.maxNativeZoom;
        labelLayerRef.current.redraw();
        if (!mapRef.current.hasLayer(labelLayerRef.current)) {
          mapRef.current.addLayer(labelLayerRef.current);
        }
      } else {
        if (mapRef.current.hasLayer(labelLayerRef.current)) {
          mapRef.current.removeLayer(labelLayerRef.current);
        }
      }
    }
    mapRef.current.invalidateSize({ animate: false });
    setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 80);
    setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 250);
  }, [mapStyle, showLabels]);

  // ── Ensure map recalibrates instantly on device switch / location filter ──
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.invalidateSize({ animate: false });
    const t1 = setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 80);
    const t2 = setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isMobile, isTablet, selectedLocation]);

  // ── Enable scroll wheel zoom only when in full screen mode, so normal page scroll is natural ──
  useEffect(() => {
    if (!mapRef.current) return;
    if (isFullscreen) {
      mapRef.current.scrollWheelZoom.enable();
    } else {
      mapRef.current.scrollWheelZoom.disable();
    }
  }, [isFullscreen]);

  // ── Filter which members appear on map ───────────────────────────────────
  const membersToPlot = members.filter(m => {
    const loc = latestLocations[m.id];
    if (!loc?.latitude || !loc?.longitude) return false;
    if (onlyActiveToday && !isToday(new Date(loc.timestamp))) return false;
    return true;
  });

  // ── Plot / update markers ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !markersRef.current || !LRef.current) return;
    const L = LRef.current;
    markersRef.current.clearLayers();

    const instances: any[] = [];

    membersToPlot.forEach(member => {
      const loc = latestLocations[member.id];
      if (!loc?.latitude || !loc?.longitude) return;

      const active = isToday(new Date(loc.timestamp));
      const ringColor = active ? '#10b981' : '#ef4444';

      // Resolve photo URL
      let photo = member.photoUrl;
      if (photo && !photo.startsWith('http') && !photo.startsWith('data:') && !photo.startsWith('/')) {
        const isAvatar = photo.startsWith('avatars/');
        const bucket = isAvatar ? 'avatars' : 'onboarding-documents';
        const path   = isAvatar ? photo.replace('avatars/', '') : photo;
        try { photo = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl; }
        catch { /* ignore */ }
      }

      // Initials fallback colors — cycle through a set of vivid palette colors
      const initialsColors = ['#6366f1','#f59e0b','#3b82f6','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4'];
      const colorIdx = member.name.charCodeAt(0) % initialsColors.length;
      const initialsColor = initialsColors[colorIdx];
      const initials = member.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

      // Build inner content: real photo if available, otherwise styled initials
      const innerHtml = photo
        ? `<img class="avatar-pin-img" src="${photo}" alt="" style="width:100%!important;height:100%!important;aspect-ratio:1/1!important;object-fit:cover!important;border-radius:50%!important;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
           <div class="avatar-pin-initials" style="display:none;--initials-bg:${initialsColor}">${initials}</div>`
        : `<div class="avatar-pin-initials" style="--initials-bg:${initialsColor}">${initials}</div>`;

      const icon = L.divIcon({
        className: '',
        html: `
          <div class="avatar-pin" style="--ring-color:${ringColor}">
            <div class="avatar-pin-ring">${innerHtml}</div>
            <div class="avatar-pin-tail"></div>
          </div>`,
        iconSize:    [44, 58],
        iconAnchor:  [22, 58],
        popupAnchor: [0, -62],
      });

      const phone = (member.phone || '').replace(/\D/g, '');
      const assignedFacility = member.societyName || member.organizationName || '';
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;

      const coordKey = `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
      const cached = locationLandmarkCache.get(coordKey);
      const initialLandmark = cached?.landmark || 'Loading building / landmark...';
      const initialRoad = cached?.road || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;

      const popup = `
        <div class="marker-popup-content min-w-[210px] max-w-[270px]">
          <!-- User header -->
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2.5 h-2.5 rounded-full shrink-0 ${active ? 'bg-emerald-500' : 'bg-red-500'}"></span>
            <div class="overflow-hidden flex-1">
              <p class="marker-popup-name text-xs font-bold text-gray-900 truncate">${member.name}</p>
              <p class="text-[10px] text-gray-500 capitalize leading-none truncate mt-0.5">${member.role || 'Staff'}</p>
            </div>
          </div>
          <p class="marker-popup-status text-[10px] text-gray-500 mb-2">
            ${active ? 'Active today' : 'Last active'}: ${formatDistanceToNow(new Date(loc.timestamp))} ago
          </p>

          <!-- Assigned Facility / Site -->
          ${assignedFacility ? `
            <div class="mb-2 p-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
              <div class="text-[9px] font-bold uppercase tracking-wider text-emerald-700">🏢 Assigned Site</div>
              <div class="text-[11px] font-bold text-gray-900 truncate mt-0.5" title="${assignedFacility}">${assignedFacility}</div>
            </div>
          ` : ''}

          <!-- Live Landmark & Road Details -->
          <div class="mb-2.5 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <div class="flex items-start gap-1.5">
              <span class="text-xs shrink-0 mt-0.5">📍</span>
              <div class="overflow-hidden flex-1">
                <div id="popup-landmark-${member.id}" class="text-[11px] font-bold text-gray-900 leading-tight">
                  ${initialLandmark}
                </div>
                <div id="popup-road-${member.id}" class="text-[10px] text-gray-500 leading-tight mt-1 truncate" title="${initialRoad}">
                  ${initialRoad}
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-1.5 mt-1">
            ${phone ? `
              <a href="https://wa.me/91${phone}" target="_blank"
                 class="flex-1 flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all no-underline shadow-sm">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>` : ''}
            <a href="${gmapsUrl}" target="_blank"
               class="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all no-underline shadow-sm">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
              Directions
            </a>
          </div>
        </div>`;

      const marker = L.marker([loc.latitude, loc.longitude], { icon });
      marker.bindPopup(popup);

      marker.on('popupopen', async () => {
        const res = await fetchLandmarkForCoords(loc.latitude, loc.longitude);
        const titleEl = document.getElementById(`popup-landmark-${member.id}`);
        const roadEl = document.getElementById(`popup-road-${member.id}`);
        if (titleEl && res.landmark) {
          titleEl.textContent = res.landmark;
        }
        if (roadEl && res.road) {
          roadEl.textContent = res.road;
          roadEl.title = res.road;
        }
      });
      markersRef.current.addLayer(marker);
      instances.push(marker);
    });

    if (instances.length > 0) {
      const group = L.featureGroup(instances);
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        if (Math.abs(ne.lat - sw.lat) < 0.0001 && Math.abs(ne.lng - sw.lng) < 0.0001) {
          mapRef.current.setView(bounds.getCenter(), 14, { animate: hasInitiallyFitted.current });
        } else {
          mapRef.current.fitBounds(bounds.pad(0.25), {
            minZoom: 10,
            maxZoom: 15,
            padding: [24, 24],
            animate: hasInitiallyFitted.current,
            duration: 0.6,
            easeLinearity: 0.2,
          });
        }
        hasInitiallyFitted.current = true;
      }
      setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 150);
      setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 650);
    } else if (selectedLocation !== 'All' && selectedLocation.startsWith('city:')) {
      const city = selectedLocation.split(':')[2];
      if (city) {
        fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json&limit=1`)
          .then(r => r.json())
          .then(d => {
            if (d?.length > 0 && mapRef.current) {
              mapRef.current.setView([parseFloat(d[0].lat), parseFloat(d[0].lon)], 13, { animate: true });
              setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 200);
            }
          })
          .catch(() => {});
      }
    }
  }, [membersToPlot, latestLocations, selectedLocation]);

  // ── Smoothly pan/zoom to a focused member when tapped from list ──────────
  useEffect(() => {
    if (!focusedMemberId || !mapRef.current || !markersRef.current) return;
    const loc = latestLocations[focusedMemberId];
    if (!loc?.latitude || !loc?.longitude) return;

    mapRef.current.flyTo([loc.latitude, loc.longitude], 16, {
      animate: true,
      duration: 0.9,
      easeLinearity: 0.25,
    });

    // Find and open marker popup
    markersRef.current.eachLayer((layer: any) => {
      if (layer.getLatLng) {
        const p = layer.getLatLng();
        if (Math.abs(p.lat - loc.latitude) < 0.0001 && Math.abs(p.lng - loc.longitude) < 0.0001) {
          setTimeout(() => layer.openPopup(), 450);
        }
      }
    });
  }, [focusedMemberId, latestLocations]);

  // ── Recenter handler ─────────────────────────────────────────────────────
  const handleRecenter = () => {
    if (!mapRef.current || !markersRef.current || !LRef.current) return;
    const layers = markersRef.current.getLayers();
    if (layers.length > 0) {
      mapRef.current.fitBounds(
        LRef.current.featureGroup(layers).getBounds().pad(0.3),
        { animate: true, duration: 1.0, easeLinearity: 0.25 }
      );
    } else {
      mapRef.current.setView([12.9716, 77.5946], 5, { animate: true });
    }
  };

  // ── Native fullscreen toggle ─────────────────────────────────────────────
  // Uses requestFullscreen() on the wrapper div so it works correctly even when
  // an ancestor has CSS zoom (desktop-scaled), transform, or overflow:hidden.
  const toggleFullscreen = useCallback(async () => {
    const el = wrapperRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen)              await el.requestFullscreen();
        else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
        else if ((el as any).mozRequestFullScreen)    (el as any).mozRequestFullScreen();
        else if ((el as any).msRequestFullscreen)     (el as any).msRequestFullscreen();
      } else {
        if (document.exitFullscreen)                     await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
        else if ((document as any).mozCancelFullScreen)  (document as any).mozCancelFullScreen();
        else if ((document as any).msExitFullscreen)     (document as any).msExitFullscreen();
      }
    } catch (err) {
      console.warn('[TeamMapView] Fullscreen API error:', err);
    }
  }, []);

  const activeCountToday = members.filter(m => {
    const loc = latestLocations[m.id];
    return loc && isToday(new Date(loc.timestamp));
  }).length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    // wrapperRef is the target for requestFullscreen()
    // paradigm-map-wrapper is styled in mapPopupStyles for :fullscreen pseudo-class
    <div
      ref={wrapperRef}
      className={`paradigm-map-wrapper relative rounded-2xl overflow-hidden border border-border shadow-sm transition-all duration-300 shrink-0 w-full ${
        mapStyle === 'dark' ? 'map-style-dark' : ''
      }`}
      style={{
        height:    isMobile ? 'min(48vh, 440px)' : (isTablet ? '400px' : '480px'),
        minHeight: isMobile ? '340px' : (isTablet ? '380px' : '480px'),
        backgroundColor: mapStyle === 'dark' ? '#121212' : (mapStyle === 'satellite' ? '#061018' : '#aadaff'),
      }}
    >
      {/* ── Fullscreen exit banner ─────────────────────────────────────── */}
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
              onClick={toggleFullscreen}
              className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
            >
              click here
            </button>
          </div>
        </div>
      )}

      {/* ── Top-Left Floating Location Pill ──────────────────────────────── */}
      {availableLocations && onLocationChange && (
        <div className="absolute top-3 left-3 z-[999] max-w-[140px] xs:max-w-[160px] sm:max-w-[240px]">
          <div className="relative flex items-center bg-card/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-border shadow-md px-2 sm:px-3 py-1.5 gap-1.5 text-xs font-semibold text-primary-text hover:border-emerald-500/40 transition-all">
            <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <select
              value={selectedLocation}
              onChange={e => onLocationChange(e.target.value)}
              className="bg-transparent text-[11px] sm:text-xs font-bold text-primary-text outline-none cursor-pointer appearance-none pr-3 truncate w-full"
            >
              <option value="All">All Locations</option>
              {Object.entries(availableLocations).flatMap(([state, cities]) => [
                <option key={`state-${state}`} value={`state:${state}`} className="font-bold text-emerald-600">
                  All {state}
                </option>,
                ...cities.map(city => (
                  <option key={`${state}-${city}`} value={`city:${state}:${city}`}>
                    {city} ({state})
                  </option>
                )),
              ])}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 pointer-events-none" />
          </div>
        </div>
      )}

      {/* ── Top-right controls ─────────────────────────────────────────── */}
      <div className="absolute top-3 right-3 z-[999] flex items-center gap-1 sm:gap-2">
        {/* Live badge - visible on mobile and web */}
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-card/90 dark:bg-slate-900/90 backdrop-blur-md border border-border shadow-md text-xs font-semibold text-primary-text">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-[11px] sm:text-xs font-bold">{membersToPlot.length}</span>
          {activeCountToday > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-[11px] font-bold">
              ({activeCountToday}{isMobile ? '' : ' live'})
            </span>
          )}
        </div>

        {/* Recenter */}
        <button
          type="button"
          onClick={handleRecenter}
          title="Fit all markers"
          className="p-2.5 rounded-xl bg-card/90 dark:bg-slate-900/90 backdrop-blur-md border border-border shadow-md text-primary-text hover:text-emerald-500 hover:border-emerald-500/40 active:scale-95 transition-all cursor-pointer"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Fullscreen toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen'}
          className="p-2.5 rounded-xl bg-card/90 dark:bg-slate-900/90 backdrop-blur-md border border-border shadow-md text-primary-text hover:text-emerald-500 hover:border-emerald-500/40 active:scale-95 transition-all cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Web App Quick Jump to Team Members Below ── */}
      {!isMobile && !isFullscreen && (
        <button
          type="button"
          onClick={() => {
            document.getElementById('team-members-list')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="absolute bottom-4 right-16 z-[999] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card/90 dark:bg-slate-900/90 backdrop-blur-md border border-border shadow-md text-xs font-semibold text-primary-text hover:text-emerald-500 hover:border-emerald-500/40 active:scale-95 transition-all cursor-pointer group"
          title="Scroll down to Team Members list"
        >
          <span>Team Members ({membersToPlot.length})</span>
          <ArrowDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform text-emerald-500" />
        </button>
      )}

      {/* ── Bottom-left layers / map-details panel ─────────────────────── */}
      <div className="absolute bottom-4 left-4 z-[999]" ref={panelRef}>
        {!showLayersPanel ? (
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

            {/* Shortcuts grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Map details</span>
              <div className="grid grid-cols-4 gap-2">
                {/* Active-only toggle */}
                <button
                  type="button"
                  onClick={() => setOnlyActiveToday(p => !p)}
                  className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer ${
                    onlyActiveToday
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'bg-gray-50/70 dark:bg-slate-800/50 border-gray-200/70 dark:border-slate-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 ${onlyActiveToday ? 'bg-emerald-500 text-white' : 'bg-gray-200/70 dark:bg-slate-700/60'}`}>
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-center leading-tight">Active</span>
                </button>

                {/* Labels toggle */}
                <button
                  type="button"
                  onClick={() => setShowLabels(p => !p)}
                  className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer ${
                    showLabels
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'bg-gray-50/70 dark:bg-slate-800/50 border-gray-200/70 dark:border-slate-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 ${showLabels ? 'bg-emerald-500 text-white' : 'bg-gray-200/70 dark:bg-slate-700/60'}`}>
                    <Navigation className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-center leading-tight">Labels</span>
                </button>

                {/* Fit All */}
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
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 ${isFullscreen ? 'bg-emerald-500 text-white' : 'bg-gray-200/70 dark:bg-slate-700/60'}`}>
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-bold text-center leading-tight">Screen</span>
                </button>
              </div>
            </div>

            {/* Map type thumbnails */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Map type</span>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(MAP_STYLES) as MapStyleKey[]).map(key => {
                  const item = MAP_STYLES[key];
                  const sel  = mapStyle === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMapStyle(key)}
                      className="group/thumb flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
                    >
                      <div className={`relative w-full aspect-square rounded-2xl overflow-hidden border-2 transition-all p-1 flex items-center justify-center bg-gradient-to-br ${item.previewBg} ${
                        sel ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-md scale-102'
                            : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                      }`}>
                        {item.icon}
                        {sel && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold truncate max-w-full ${sel ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Checkbox section */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 space-y-2">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={e => setShowLabels(e.target.checked)}
                  className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                />
                <span>Labels &amp; Roads</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyActiveToday}
                  onChange={e => setOnlyActiveToday(e.target.checked)}
                  className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                />
                <span>Active staff only today</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ── Leaflet map container — NEVER unmounts, always in same DOM spot ── */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        style={{
          height: '100%',
          width: '100%',
          backgroundColor: mapStyle === 'dark' ? '#121212' : (mapStyle === 'satellite' ? '#061018' : '#aadaff'),
        }}
      />
    </div>
  );
};

export default TeamMapView;
