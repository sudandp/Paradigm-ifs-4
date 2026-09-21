import React, { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet';
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
  Phone,
  MessageCircle,
} from 'lucide-react';
import { formatDistanceToNow, isToday } from 'date-fns';
import { supabase } from '../../services/supabase';
import { User } from '../../types';
import { detectDeviceConnectionStatus } from '../../utils/deviceConnection';
import 'leaflet/dist/leaflet.css';

// ─── Popup + marker styles injected once ───────────────────────────────────
const mapPopupStyles = `
  .leaflet-popup-content-wrapper {
    border-radius: 14px;
    padding: 4px;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,.2), 0 8px 10px -6px rgba(0,0,0,.1);
  }
  .marker-popup-content { padding: 8px; }

  /* ── Team Map Popup - Premium UI & Dark Theme Protection ────── */
  .team-map-popup .leaflet-popup-content-wrapper {
    background: #082214 !important;
    color: #ffffff !important;
    border: 1px solid #1a5c34 !important;
    border-radius: 18px !important;
    box-shadow: 0 20px 35px -5px rgba(0,0,0,0.65), 0 0 0 1px rgba(68,214,44,0.15) !important;
    padding: 0 !important;
    overflow: hidden !important;
  }
  .team-map-popup .leaflet-popup-content {
    margin: 0 !important;
    padding: 14px 14px 12px 14px !important;
    line-height: 1.4 !important;
    color: #ffffff !important;
    min-width: 220px !important;
    max-width: 280px !important;
  }
  .team-map-popup .leaflet-popup-tip-container {
    width: 30px !important;
    height: 14px !important;
  }
  .team-map-popup .leaflet-popup-tip {
    background: #082214 !important;
    border: 1px solid #1a5c34 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
  }
  .team-map-popup .leaflet-popup-close-button {
    top: 10px !important;
    right: 10px !important;
    width: 24px !important;
    height: 24px !important;
    border-radius: 50% !important;
    background: rgba(255, 255, 255, 0.1) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    color: #94a3b8 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 15px !important;
    font-weight: 700 !important;
    padding: 0 !important;
    transition: all 0.2s ease !important;
    text-decoration: none !important;
    z-index: 10 !important;
  }
  .team-map-popup .leaflet-popup-close-button:hover {
    background: rgba(255, 255, 255, 0.22) !important;
    color: #ffffff !important;
  }
  .team-map-popup * {
    box-sizing: border-box;
  }
  .team-map-popup .popup-title {
    color: #ffffff !important;
    font-size: 13px !important;
    font-weight: 800 !important;
    line-height: 1.25 !important;
    margin: 0 !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  }
  .team-map-popup .popup-role {
    color: #a7f3d0 !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    background: rgba(6, 95, 70, 0.5) !important;
    border: 1px solid rgba(16, 185, 129, 0.35) !important;
    border-radius: 6px !important;
    padding: 1px 7px !important;
    display: inline-block !important;
    text-transform: capitalize !important;
    letter-spacing: 0.02em !important;
  }
  .team-map-popup .popup-time {
    color: #94a3b8 !important;
    font-size: 10px !important;
    font-weight: 500 !important;
    margin: 6px 0 10px 0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
  }
  .team-map-popup .popup-section-site {
    background: rgba(4, 27, 15, 0.85) !important;
    border: 1px solid #144827 !important;
    border-radius: 12px !important;
    padding: 8px 10px !important;
    margin-bottom: 8px !important;
  }
  .team-map-popup .popup-section-site-tag {
    font-size: 9px !important;
    font-weight: 800 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.12em !important;
    color: #44D62C !important;
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
  }
  .team-map-popup .popup-section-site-name {
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #f8fafc !important;
    margin-top: 2px !important;
    line-height: 1.3 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }
  .team-map-popup .popup-section-loc {
    background: rgba(4, 27, 15, 0.85) !important;
    border: 1px solid #144827 !important;
    border-radius: 12px !important;
    padding: 8px 10px !important;
    margin-bottom: 12px !important;
  }
  .team-map-popup .popup-landmark {
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #f8fafc !important;
    line-height: 1.3 !important;
  }
  .team-map-popup .popup-road {
    font-size: 10px !important;
    font-weight: 500 !important;
    color: #94a3b8 !important;
    line-height: 1.3 !important;
    margin-top: 3px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }
  .team-map-popup a.popup-btn {
    font-size: 11px !important;
    font-weight: 700 !important;
    text-decoration: none !important;
    padding: 8px 12px !important;
    border-radius: 12px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    transition: all 0.18s ease !important;
    cursor: pointer !important;
    line-height: 1 !important;
    outline: none !important;
    border: none !important;
  }
  .team-map-popup a.popup-btn * {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  }
  .team-map-popup a.popup-btn span {
    color: #ffffff !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    line-height: 1 !important;
  }
  .team-map-popup a.popup-btn-wa {
    background: #16a34a !important;
    color: #ffffff !important;
    border: 1px solid #22c55e !important;
    box-shadow: 0 2px 8px rgba(22,163,74,0.35) !important;
  }
  .team-map-popup a.popup-btn-wa:hover {
    background: #15803d !important;
    border-color: #16a34a !important;
  }
  .team-map-popup a.popup-btn-wa:active {
    transform: scale(0.96) !important;
  }
  .team-map-popup a.popup-btn-wa svg {
    fill: #ffffff !important;
  }
  .team-map-popup a.popup-btn-nav {
    background: #2563eb !important;
    color: #ffffff !important;
    border: 1px solid #3b82f6 !important;
    box-shadow: 0 2px 8px rgba(37,99,235,0.35) !important;
  }
  .team-map-popup a.popup-btn-nav:hover {
    background: #1d4ed8 !important;
    border-color: #2563eb !important;
  }
  .team-map-popup a.popup-btn-nav:active {
    transform: scale(0.96) !important;
  }
  .team-map-popup a.popup-btn-nav svg {
    stroke: #ffffff !important;
  }
  .leaflet-container {
    width: 100% !important;
    height: 100% !important;
    z-index: 1 !important;
    background: #aadaff !important;
    outline: none !important;
    touch-action: none;
    -webkit-touch-action: none;
  }
  .leaflet-tile-pane {
    background: transparent !important;
  }
  /* Fix sub-pixel tile border lines / seams without crashing mobile GPU memory */
  .leaflet-tile {
    border: none !important;
    outline: 1px solid transparent !important;
    box-shadow: none !important;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    image-rendering: -webkit-optimize-contrast;
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
  /* Override Leaflet's default .leaflet-div-icon white box style */
  .leaflet-div-icon {
    background: transparent !important;
    border: none !important;
  }
  .avatar-marker-icon {
    background: transparent !important;
    border: none !important;
    overflow: visible !important;
  }
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
    flex-shrink: 0;
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
    width: 38px !important;
    height: 38px !important;
    min-width: 38px !important;
    min-height: 38px !important;
    aspect-ratio: 1 / 1 !important;
    object-fit: cover !important;
    object-position: center top !important;
    border-radius: 50% !important;
    display: block !important;
    flex-shrink: 0 !important;
  }
  .avatar-pin-initials {
    width: 38px !important;
    height: 38px !important;
    min-width: 38px !important;
    min-height: 38px !important;
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

  /* Top HUD Controls - high specificity to prevent index.css mobile overrides */
  .paradigm-map-wrapper .team-map-hud-btn {
    background: #041b0f !important;
    background-color: #041b0f !important;
    color: #ffffff !important;
    border: 1px solid #1a5c34 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45) !important;
    border-radius: 12px !important;
    width: 36px !important;
    height: 36px !important;
    min-width: 36px !important;
    min-height: 36px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    cursor: pointer !important;
    opacity: 1 !important;
    visibility: visible !important;
    transition: all 0.2s ease !important;
  }
  .paradigm-map-wrapper .team-map-hud-btn:hover {
    background: #09381c !important;
    border-color: #22c55e !important;
  }
  .paradigm-map-wrapper .team-map-hud-btn:active {
    transform: scale(0.95) !important;
  }
  .paradigm-map-wrapper .team-map-hud-btn svg {
    color: #ffffff !important;
    stroke: #ffffff !important;
    width: 17px !important;
    height: 17px !important;
    display: block !important;
  }
  .paradigm-map-wrapper .team-map-live-pill {
    background: #041b0f !important;
    background-color: #041b0f !important;
    color: #ffffff !important;
    border: 1px solid #1a5c34 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45) !important;
    border-radius: 14px !important;
    height: 36px !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 0 10px !important;
  }
  .paradigm-map-wrapper .team-map-live-pill span {
    color: #ffffff !important;
    font-weight: 800 !important;
    font-size: 11px !important;
  }

  /* Bottom Card Action Buttons (WhatsApp, Call, Directions) */
  .paradigm-map-wrapper a.team-action-btn,
  .paradigm-map-wrapper button.team-action-btn {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    height: 40px !important;
    min-height: 40px !important;
    padding: 0 10px !important;
    border-radius: 12px !important;
    font-size: 12px !important;
    font-weight: 800 !important;
    text-decoration: none !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35) !important;
    cursor: pointer !important;
    transition: all 0.18s ease !important;
  }
  .paradigm-map-wrapper a.team-action-btn:active,
  .paradigm-map-wrapper button.team-action-btn:active {
    transform: scale(0.96) !important;
  }
  .paradigm-map-wrapper a.team-action-btn *,
  .paradigm-map-wrapper button.team-action-btn * {
    color: #ffffff !important;
    stroke: #ffffff !important;
  }
  .paradigm-map-wrapper a.team-action-btn span,
  .paradigm-map-wrapper button.team-action-btn span {
    color: #ffffff !important;
    font-size: 12px !important;
    font-weight: 800 !important;
    line-height: 1 !important;
    letter-spacing: 0.02em !important;
  }
  .paradigm-map-wrapper a.team-action-btn-wa {
    background-color: #16a34a !important;
    border: 1px solid #22c55e !important;
  }
  .paradigm-map-wrapper a.team-action-btn-wa:hover {
    background-color: #15803d !important;
  }
  .paradigm-map-wrapper a.team-action-btn-call {
    background-color: #2563eb !important;
    border: 1px solid #3b82f6 !important;
  }
  .paradigm-map-wrapper a.team-action-btn-call:hover {
    background-color: #1d4ed8 !important;
  }
  .paradigm-map-wrapper a.team-action-btn-nav {
    background-color: #0d9488 !important;
    border: 1px solid #14b8a6 !important;
  }
  .paradigm-map-wrapper a.team-action-btn-nav:hover {
    background-color: #0f766e !important;
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
  latestLocations: Record<string, { latitude: number; longitude: number; timestamp: string; source?: string; deviceName?: string }>;
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

// Known coordinates for Indian cities and state centers to guarantee instant, reliable map centering
const CITY_COORDINATES: Record<string, [number, number]> = {
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  hyderabad: [17.3850, 78.4867],
  secunderabad: [17.4399, 78.4983],
  chennai: [13.0827, 80.2707],
  mumbai: [19.0760, 72.8777],
  pune: [18.5204, 73.8567],
  delhi: [28.6139, 77.2090],
  mysore: [12.2958, 76.6394],
  mysuru: [12.2958, 76.6394],
  mangalore: [12.9141, 74.8560],
  mangaluru: [12.9141, 74.8560],
  hubli: [15.3647, 75.1240],
  coimbatore: [11.0168, 76.9558],
  kochi: [9.9312, 76.2673],
  madurai: [9.9252, 78.1198],
};

const STATE_COORDINATES: Record<string, [number, number]> = {
  karnataka: [12.9716, 77.5946],
  telangana: [17.3850, 78.4867],
  'tamil nadu': [13.0827, 80.2707],
  maharashtra: [19.0760, 72.8777],
  kerala: [9.9312, 76.2673],
  delhi: [28.6139, 77.2090],
  andhra: [16.5062, 80.6480],
  'andhra pradesh': [16.5062, 80.6480],
};

const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const MAP_STYLES: Record<MapStyleKey, MapStyleOption> = {
  streets: {
    id: 'streets',
    name: 'Roadmap (POIs)',
    // Google Maps detailed roadmap — use {s} subdomain rotation (mt0–mt3) to match actual Google Maps CDN usage
    url: 'https://mt{s}.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}',
    maxNativeZoom: 21,
    attribution: '&copy; Google Maps',
    previewBg: 'from-emerald-100 to-amber-100 dark:from-emerald-950 dark:to-stone-900',
    icon: <MapIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    // Google Maps satellite + roads/labels/POIs overlay
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    overlayUrl: 'https://mt{s}.google.com/vt/lyrs=h&hl=en&x={x}&y={y}&z={z}',
    maxNativeZoom: 21,
    attribution: '&copy; Google Maps',
    previewBg: 'from-blue-900 to-emerald-900',
    icon: <Globe className="w-4 h-4 text-blue-400" />,
  },
  terrain: {
    id: 'terrain',
    name: 'Terrain',
    // Google Maps Terrain with roads & POIs
    url: 'https://mt{s}.google.com/vt/lyrs=p&hl=en&x={x}&y={y}&z={z}',
    maxNativeZoom: 20,
    attribution: '&copy; Google Maps',
    previewBg: 'from-stone-300 to-amber-200 dark:from-stone-800 dark:to-stone-900',
    icon: <Mountain className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    // Google Maps roadmap with dark CSS filter
    url: 'https://mt{s}.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}',
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

  // Mobile Bottom Sheet state
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [selectedMemberLocation, setSelectedMemberLocation] = useState<{ landmark: string; road: string; fullAddress: string } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

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

  // ── Mobile Member Selection Handler ─────────────────────────────────────
  const handleSelectMember = useCallback(async (member: User) => {
    setSelectedMember(member);
    const loc = latestLocations[member.id];
    if (!loc?.latitude || !loc?.longitude) return;

    if (mapRef.current) {
      mapRef.current.flyTo([loc.latitude, loc.longitude], 17, {
        animate: true,
        duration: 1.0,
        easeLinearity: 0.25,
      });
    }

    setIsLoadingLocation(true);
    try {
      const res = await fetchLandmarkForCoords(loc.latitude, loc.longitude);
      setSelectedMemberLocation(res);
    } catch {
      setSelectedMemberLocation(null);
    } finally {
      setIsLoadingLocation(false);
    }
  }, [latestLocations]);

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
    let cleanupRO: (() => void) | undefined;

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

      // ─── UNIVERSAL MOBILE FIX #1: waitForSize ────────────────────────────
      // Never call L.map() until the container has real pixel dimensions.
      // We poll (via rAF) until clientWidth AND clientHeight are > 0.
      await new Promise<void>(resolve => {
        const check = () => {
          const el = mapContainerRef.current;
          if (el && el.clientWidth > 0 && el.clientHeight > 0) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
      if (cancelled || !mapContainerRef.current) return;

      LRef.current = L;

      const cfg = MAP_STYLES[mapStyle] || MAP_STYLES.streets;

      // Pre-calculate member bounds for initial view (filtering distant outliers if a specific city is selected)
      let targetCity: string | null = null;
      if (selectedLocation && selectedLocation !== 'All' && selectedLocation.startsWith('city:')) {
        targetCity = selectedLocation.split(':')[2]?.toLowerCase()?.trim() || null;
      }
      const cityCoord = targetCity ? CITY_COORDINATES[targetCity] : null;

      const validPoints: [number, number][] = [];
      members.forEach(m => {
        const loc = latestLocations[m.id];
        if (
          loc?.latitude && loc?.longitude &&
          !isNaN(loc.latitude) && !isNaN(loc.longitude) &&
          loc.latitude !== 0 && loc.longitude !== 0 &&
          Math.abs(loc.latitude) <= 90 && Math.abs(loc.longitude) <= 180
        ) {
          if (cityCoord) {
            const dist = getDistanceKm(cityCoord[0], cityCoord[1], loc.latitude, loc.longitude);
            if (dist > 80 && (!focusedMemberId || m.id !== focusedMemberId)) return;
          }
          validPoints.push([loc.latitude, loc.longitude]);
        }
      });

      // ─── UNIVERSAL MOBILE FIX #2: Crisp Map Configuration ─────────────────
      // 1. zoomSnap: 1 & zoomDelta: 1 -> Guarantees integer zoom alignment for raster tiles
      //    (prevents fractional sub-pixel matrix distortion and tile corner-bunching).
      // 2. preferCanvas: true -> Hardware accelerated vector marker layers.
      // 3. tapHold: false -> Modern Android WebView uses native pointer events.
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: true,
        markerZoomAnimation: true,
        zoomAnimation: true,
        zoomSnap: 1,
        zoomDelta: 1,
        wheelPxPerZoomLevel: 60,
        scrollWheelZoom: false,
        minZoom: 3,
        maxZoom: 21,
        preferCanvas: true,
        bounceAtZoomLimits: false,
        doubleClickZoom: true,
        dragging: true,
        touchZoom: true,
        tapHold: false,
      });

      map.invalidateSize({ animate: false });

      // ─── UNIVERSAL MOBILE FIX #3: Initial fit inside whenReady ────────────
      map.whenReady(() => {
        if (cancelled) return;
        map.invalidateSize({ animate: false });

        if (validPoints.length > 0) {
          const initialBounds = L.latLngBounds(validPoints);
          const ne = initialBounds.getNorthEast();
          const sw = initialBounds.getSouthWest();
          if (Math.abs(ne.lat - sw.lat) < 0.0001 && Math.abs(ne.lng - sw.lng) < 0.0001) {
            map.setView(initialBounds.getCenter(), 14, { animate: false });
          } else {
            map.fitBounds(initialBounds.pad(0.25), { maxZoom: 15, padding: [24, 24], animate: false });
          }
          hasInitiallyFitted.current = true;
        } else {
          const fallbackCenter = cityCoord || [12.9716, 77.5946];
          map.setView(fallbackCenter, 12, { animate: false });
        }
      });

      mapRef.current = map;

      // ─── UNIVERSAL MOBILE FIX #4: Continuous Tile Streaming ───────────────
      // 1. keepBuffer: 8 -> Generous buffer so zooming in/out never exposes blue background
      // 2. updateWhenIdle: false -> Continues loading tiles during panning/zooming gestures
      // 3. updateWhenZooming: true -> Loads new zoom level tiles immediately during zoom
      // 4. updateInterval: 100 -> Throttled to 100ms for high responsiveness
      const baseTiles = L.tileLayer(cfg.url, {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 21,
        maxNativeZoom: cfg.maxNativeZoom,
        zIndex: 1,
        detectRetina: false,
        attribution: cfg.attribution,
        keepBuffer: 8,
        updateWhenIdle: false,
        updateWhenZooming: true,
        updateInterval: 100,
        crossOrigin: 'anonymous',
      }).addTo(map);
      tileLayerRef.current = baseTiles;

      // Overlay label layer
      const overlayUrl = cfg.overlayUrl || '';
      const labelTiles = L.tileLayer(overlayUrl, {
        subdomains: ['0', '1', '2', '3'],
        zIndex: 500,
        maxZoom: 21,
        maxNativeZoom: cfg.maxNativeZoom || 18,
        detectRetina: false,
        keepBuffer: 8,
        updateWhenIdle: false,
        updateWhenZooming: true,
        updateInterval: 100,
        crossOrigin: 'anonymous',
      });
      labelLayerRef.current = labelTiles;
      if (showLabels && cfg.overlayUrl) {
        labelTiles.addTo(map);
      }

      markersRef.current = L.layerGroup().addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // ─── UNIVERSAL MOBILE FIX #5: Auto-invalidate on zoomend / moveend ─────
      // Ensures the tile grid is 100% full after any pinch or button zoom gesture
      map.on('zoomend moveend', () => {
        map.invalidateSize({ debounceMoveend: true });
      });

      // ─── UNIVERSAL MOBILE FIX #6: ResizeObserver sync ─────────────────────
      let roTimer: ReturnType<typeof setTimeout> | null = null;
      let ro: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(entries => {
          const entry = entries[0];
          if (!entry) return;
          const { width, height } = entry.contentRect;
          if (width === 0 || height === 0) return;
          if (roTimer) clearTimeout(roTimer);
          roTimer = setTimeout(() => {
            mapRef.current?.invalidateSize({ animate: false });
          }, 60);
        });
        if (mapContainerRef.current) ro.observe(mapContainerRef.current);
        if (wrapperRef.current) ro.observe(wrapperRef.current);
      }

      const backupTimers = [150, 400, 800, 1400].map(ms =>
        setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), ms)
      );

      cleanupRO = () => {
        ro?.disconnect();
        if (roTimer) clearTimeout(roTimer);
        backupTimers.forEach(t => clearTimeout(t));
      };
    };

    initMap();

    return () => {
      cancelled = true;
      cleanupRO?.();
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
    hasInitiallyFitted.current = false;
    if (!mapRef.current) return;
    // Immediate + post-animation cascade for mobile WebView
    mapRef.current.invalidateSize({ animate: false });
    const ts = [80, 300, 700].map(ms =>
      setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), ms)
    );
    return () => ts.forEach(clearTimeout);
  }, [isTablet, selectedLocation]);

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

    // If user clicked specifically on this member, always plot them
    if (focusedMemberId && m.id === focusedMemberId) return true;

    // When a specific city is selected (e.g. Bangalore),
    // exclude distant outlier pings (>80km from the selected city center).
    // This prevents stale weekend pings from another state (e.g. Kerala) from
    // skewing the city view and pulling the map center away to other states.
    if (selectedLocation && selectedLocation !== 'All' && selectedLocation.startsWith('city:')) {
      const cityKey = selectedLocation.split(':')[2]?.toLowerCase()?.trim();
      const cityCenter = cityKey ? CITY_COORDINATES[cityKey] : null;
      if (cityCenter) {
        const dist = getDistanceKm(cityCenter[0], cityCenter[1], loc.latitude, loc.longitude);
        if (dist > 80) {
          return false;
        }
      }
    }

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
      const rawName = (member.name || '').trim();
      const displayName = rawName || (member.email ? member.email.split('@')[0] : 'Team Member');
      const formattedRole = (member.role || 'Staff').replace(/_/g, ' ');
      const initials = (rawName || displayName).split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'TM';
      const colorIdx = (rawName || displayName).charCodeAt(0) % initialsColors.length;
      const initialsColor = initialsColors[colorIdx];

      // Build inner content: real photo if available, otherwise styled initials
      const innerHtml = photo
        ? `<img class="avatar-pin-img" src="${photo}" alt="" style="width:100%!important;height:100%!important;aspect-ratio:1/1!important;object-fit:cover!important;border-radius:50%!important;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
           <div class="avatar-pin-initials" style="display:none;--initials-bg:${initialsColor}">${initials}</div>`
        : `<div class="avatar-pin-initials" style="--initials-bg:${initialsColor}">${initials}</div>`;

      const icon = L.divIcon({
        className: 'avatar-marker-icon',
        html: `
          <div class="avatar-pin" style="--ring-color:${ringColor}">
            <div class="avatar-pin-ring">${innerHtml}</div>
            <div class="avatar-pin-tail"></div>
          </div>`,
        iconSize:    [44, 54],
        iconAnchor:  [22, 54],
        popupAnchor: [0, -58],
      });

      const phone = (member.phone || '').replace(/\D/g, '');
      const assignedFacility = member.societyName || member.organizationName || '';
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;

      const coordKey = `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
      const cached = locationLandmarkCache.get(coordKey);
      const initialLandmark = cached?.landmark || 'Loading building / landmark...';
      const initialRoad = cached?.road || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;

      const connInfo = detectDeviceConnectionStatus(loc.source, loc.deviceName);
      const connIconEmoji = connInfo.hasLaptop && connInfo.hasPhone ? '📱💻' : connInfo.hasLaptop ? '💻' : '📱';

      const popup = `
        <div class="team-map-popup-inner">
          <!-- User header -->
          <div style="display: flex; align-items: center; gap: 8px; padding-right: 18px; margin-bottom: 3px;">
            <span style="width: 9px; height: 9px; border-radius: 50%; background: ${active ? '#44D62C' : '#ef4444'}; box-shadow: 0 0 8px ${active ? 'rgba(68,214,44,0.7)' : 'rgba(239,68,68,0.7)'}; flex-shrink: 0;"></span>
            <div style="overflow: hidden; flex: 1;">
              <p class="popup-title" title="${displayName}">${displayName}</p>
              <div style="display: flex; items-center: gap: 4px; flex-wrap: wrap; margin-top: 2px;">
                <span class="popup-role">${formattedRole}</span>
                <span style="font-size: 9px; font-weight: 800; color: #6ee7b7; background: rgba(6, 95, 70, 0.6); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 6px; padding: 1px 6px; display: inline-flex; items-center: gap: 3px;">
                  <span>${connIconEmoji}</span>
                  <span>${connInfo.statusText}</span>
                </span>
              </div>
            </div>
          </div>
          <p class="popup-time">
            <span>⏱</span>
            <span>${active ? 'Active today' : 'Last active'}: ${formatDistanceToNow(new Date(loc.timestamp))} ago</span>
          </p>

          <!-- Assigned Facility / Site -->
          ${assignedFacility ? `
            <div class="popup-section-site">
              <div class="popup-section-site-tag"><span>🏢</span> <span>ASSIGNED SITE</span></div>
              <div class="popup-section-site-name" title="${assignedFacility}">${assignedFacility}</div>
            </div>
          ` : ''}

          <!-- Live Landmark & Road Details -->
          <div class="popup-section-loc">
            <div style="display: flex; align-items: flex-start; gap: 6px;">
              <span style="font-size: 12px; flex-shrink: 0; margin-top: 1px;">📍</span>
              <div style="overflow: hidden; flex: 1;">
                <div id="popup-landmark-${member.id}" class="popup-landmark">
                  ${initialLandmark}
                </div>
                <div id="popup-road-${member.id}" class="popup-road" title="${initialRoad}">
                  ${initialRoad}
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
            ${phone ? `
              <a href="https://wa.me/91${phone}" target="_blank"
                 class="btn popup-btn popup-btn-wa" style="flex: 1;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#ffffff" style="flex-shrink: 0;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span>WhatsApp</span>
              </a>` : ''}
            <a href="${gmapsUrl}" target="_blank"
               class="btn popup-btn popup-btn-nav" style="flex: 1;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" style="flex-shrink: 0;"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Directions</span>
            </a>
          </div>
        </div>`;

      const marker = L.marker([loc.latitude, loc.longitude], { icon });
      marker.bindPopup(popup, {
        className: 'team-map-popup',
        closeButton: true,
        offset: [0, -10],
      });

      marker.on('click', () => {
        if (isMobile) {
          handleSelectMember(member);
        }
      });

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
        if (!hasInitiallyFitted.current) {
          if (Math.abs(ne.lat - sw.lat) < 0.0001 && Math.abs(ne.lng - sw.lng) < 0.0001) {
            mapRef.current.setView(bounds.getCenter(), 14, { animate: false });
          } else {
            // Note: DO NOT set minZoom here — minZoom clamps zoom when bounds are wide,
            // which causes Leaflet to forcibly center on the midpoint of distant points.
            mapRef.current.fitBounds(bounds.pad(0.25), {
              maxZoom: 15,
              padding: [24, 24],
              animate: false,
            });
          }
          hasInitiallyFitted.current = true;
        }
      }
      setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 150);
    } else if (selectedLocation !== 'All') {
      // Instant fallback to city/state center when no member pins are in that city
      let targetCenter: [number, number] | null = null;
      if (selectedLocation.startsWith('city:')) {
        const cityKey = selectedLocation.split(':')[2]?.toLowerCase()?.trim();
        if (cityKey && CITY_COORDINATES[cityKey]) targetCenter = CITY_COORDINATES[cityKey];
      } else if (selectedLocation.startsWith('state:')) {
        const stateKey = selectedLocation.replace('state:', '').toLowerCase()?.trim();
        if (stateKey && STATE_COORDINATES[stateKey]) targetCenter = STATE_COORDINATES[stateKey];
      }

      if (targetCenter && mapRef.current) {
        mapRef.current.setView(targetCenter, 13, { animate: true });
        setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 200);
      }
    }
  }, [membersToPlot, latestLocations, selectedLocation, isMobile, handleSelectMember]);

  // ── Smoothly pan/zoom to a focused member when tapped from list ──────────
  useEffect(() => {
    if (!focusedMemberId || !mapRef.current || !markersRef.current) return;
    const loc = latestLocations[focusedMemberId];
    if (!loc?.latitude || !loc?.longitude) return;

    const found = members.find(m => m.id === focusedMemberId);
    if (found && isMobile) {
      handleSelectMember(found);
    }

    mapRef.current.flyTo([loc.latitude, loc.longitude], 16, {
      animate: true,
      duration: 0.9,
      easeLinearity: 0.25,
    });

    // Find and open marker popup on desktop
    if (!isMobile) {
      markersRef.current.eachLayer((layer: any) => {
        if (layer.getLatLng) {
          const p = layer.getLatLng();
          if (Math.abs(p.lat - loc.latitude) < 0.0001 && Math.abs(p.lng - loc.longitude) < 0.0001) {
            setTimeout(() => layer.openPopup(), 450);
          }
        }
      });
    }
  }, [focusedMemberId, latestLocations, isMobile, members, handleSelectMember]);

  // ── Recenter handler ─────────────────────────────────────────────────────
  const handleRecenter = () => {
    if (!mapRef.current || !markersRef.current || !LRef.current) return;
    const layers = markersRef.current.getLayers();
    if (layers.length > 0) {
      mapRef.current.fitBounds(
        LRef.current.featureGroup(layers).getBounds().pad(0.25),
        { maxZoom: 15, animate: true, duration: 1.0, easeLinearity: 0.25 }
      );
    } else {
      let defaultCenter: [number, number] = [12.9716, 77.5946];
      if (selectedLocation?.startsWith('city:')) {
        const c = selectedLocation.split(':')[2]?.toLowerCase()?.trim();
        if (c && CITY_COORDINATES[c]) defaultCenter = CITY_COORDINATES[c];
      }
      mapRef.current.setView(defaultCenter, 12, { animate: true });
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
      className={`paradigm-map-wrapper relative rounded-2xl overflow-hidden border border-border shadow-sm shrink-0 w-full ${
        mapStyle === 'dark' ? 'map-style-dark' : ''
      }`}
      style={{
        height:    isFullscreen ? '100%' : (isMobile ? 'min(58vh, 520px)' : (isTablet ? '400px' : '480px')),
        minHeight: isFullscreen ? '100%' : (isMobile ? '380px' : (isTablet ? '380px' : '480px')),
        backgroundColor: mapStyle === 'dark' ? '#121212' : (mapStyle === 'satellite' ? '#061018' : '#aadaff'),
      }}
    >
      {/* ── Fullscreen exit banner (Desktop only — Mobile uses floating ✕ button) ── */}
      {isFullscreen && !isMobile && (
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

      {/* ── Unified Top Control HUD (Non-colliding, thumb-friendly) ───────── */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-[999] flex items-center justify-between gap-2 pointer-events-none">
        {/* Left: Location Dropdown Pill */}
        {availableLocations && Object.keys(availableLocations).length > 0 && onLocationChange && (
          <div className="pointer-events-auto max-w-[55%] xs:max-w-[60%] sm:max-w-[240px]">
            <div className="relative flex items-center bg-card/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-border shadow-lg px-2.5 py-1.5 gap-1.5 text-xs font-semibold text-primary-text hover:border-emerald-500/40 transition-all">
              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <select
                value={selectedLocation}
                onChange={e => onLocationChange(e.target.value)}
                className="bg-transparent text-[11px] sm:text-xs font-bold text-primary-text outline-none cursor-pointer appearance-none pr-3.5 truncate w-full"
              >
                <option value="All" className="bg-card dark:bg-slate-900 text-primary-text">All Locations</option>
                {Object.entries(availableLocations).flatMap(([state, cities]) => [
                  <option key={`state-${state}`} value={`state:${state}`} className="font-bold text-emerald-600 dark:text-emerald-400 bg-card dark:bg-slate-900">
                    All {state}
                  </option>,
                  ...cities.map(city => (
                    <option key={`${state}-${city}`} value={`city:${state}:${city}`} className="bg-card dark:bg-slate-900 text-primary-text">
                      {city} ({state})
                    </option>
                  )),
                ])}
              </select>
              <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Right: Status Pill & Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0 ml-auto">
          {/* Live badge */}
          <div className="team-map-live-pill flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-2xl bg-card/95 dark:bg-slate-900/95 backdrop-blur-md border border-border shadow-lg text-xs font-semibold text-primary-text">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-xs font-bold text-white">{membersToPlot.length}</span>
            {activeCountToday > 0 && (
              <span className="text-emerald-400 text-[10px] sm:text-[11px] font-bold">
                ({activeCountToday}{isMobile ? '' : ' live'})
              </span>
            )}
          </div>

          {/* Recenter */}
          <button
            type="button"
            onClick={handleRecenter}
            title="Fit all markers"
            className="team-map-hud-btn btn flex items-center justify-center cursor-pointer transition-all active:scale-95"
            style={{
              backgroundColor: '#041b0f',
              background: '#041b0f',
              color: '#ffffff',
              border: '1px solid #1a5c34',
              borderRadius: '12px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
              width: '36px',
              height: '36px',
              minWidth: '36px',
              minHeight: '36px',
              padding: 0,
            }}
            aria-label="Recenter map"
          >
            <Crosshair className="w-4 h-4 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
          </button>

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            className="team-map-hud-btn btn flex items-center justify-center cursor-pointer transition-all active:scale-95"
            style={{
              backgroundColor: '#041b0f',
              background: '#041b0f',
              color: '#ffffff',
              border: '1px solid #1a5c34',
              borderRadius: '12px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
              width: '36px',
              height: '36px',
              minWidth: '36px',
              minHeight: '36px',
              padding: 0,
            }}
            aria-label="Toggle full screen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
            ) : (
              <Maximize2 className="w-4 h-4 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile Floating Layer FAB (Placed comfortably above bottom sheet) ── */}
      {isMobile && (
        <div className="absolute right-3 bottom-[185px] z-[998]">
          <button
            type="button"
            onClick={() => setShowLayersPanel(p => !p)}
            className="w-11 h-11 rounded-full bg-card/95 dark:bg-slate-900/95 backdrop-blur-md border border-border shadow-xl text-primary-text flex items-center justify-center active:scale-95 transition-all hover:border-emerald-500/50"
            title="Change Map Layers"
            aria-label="Map Layers"
          >
            <Layers className="w-5 h-5 text-emerald-500" />
          </button>
        </div>
      )}

      {/* ── Web App Quick Jump to Team Members Below (Desktop only) ── */}
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

      {/* ── Desktop Bottom-left layers panel ────────────────────────────── */}
      <div className={isMobile ? "fixed inset-x-3 bottom-4 z-[1002]" : "absolute bottom-4 left-4 z-[999]"} ref={panelRef}>
        {!showLayersPanel ? (
          !isMobile && (
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
          )
        ) : (
          <div className="w-full max-w-[340px] mx-auto sm:w-[320px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl p-4.5 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-gray-800 dark:text-gray-100">
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

      {/* ── MOBILE-FIRST FLOATING BOTTOM SHEET (Option A) ──────────────────── */}
      {isMobile && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[999] pointer-events-auto">
          {selectedMember ? (
            /* Selected Member Detail Action Card */
            (() => {
              const loc = latestLocations[selectedMember.id];
              const active = loc ? isToday(new Date(loc.timestamp)) : false;
              const phone = (selectedMember.phone || '').replace(/\D/g, '');
              const assignedFacility = selectedMember.societyName || selectedMember.organizationName || '';
              const gmapsUrl = loc ? `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}` : '';

              let photo = selectedMember.photoUrl;
              if (photo && !photo.startsWith('http') && !photo.startsWith('data:') && !photo.startsWith('/')) {
                const isAvatar = photo.startsWith('avatars/');
                const bucket = isAvatar ? 'avatars' : 'onboarding-documents';
                const path = isAvatar ? photo.replace('avatars/', '') : photo;
                try {
                  photo = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
                } catch {
                  /* fallback gracefully */
                }
              }

              const rawName = (selectedMember.name || '').trim();
              const displayName = rawName || (selectedMember.email ? selectedMember.email.split('@')[0] : 'Team Member');
              const formattedRole = (selectedMember.role || 'Staff').replace(/_/g, ' ');
              const initials = (rawName || displayName).split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'TM';

              return (
                <div className="bg-[#082214]/95 backdrop-blur-xl border border-emerald-500/35 rounded-3xl p-3.5 shadow-2xl text-white animate-in slide-in-from-bottom-4 duration-200">
                  {/* Drag pill handle */}
                  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2.5" />

                  {/* Member Header */}
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="relative shrink-0 w-11 h-11 rounded-full overflow-hidden border-2" style={{ borderColor: active ? '#10b981' : '#ef4444' }}>
                        {photo ? (
                          <img src={photo} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-emerald-700 flex items-center justify-center font-bold text-xs text-white">
                            {initials}
                          </div>
                        )}
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#082214] ${active ? 'bg-emerald-400' : 'bg-red-500'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-extrabold text-sm text-white truncate">{displayName}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            {formattedRole}
                          </span>
                          {(() => {
                            const mConnInfo = detectDeviceConnectionStatus(loc?.source, loc?.deviceName);
                            return (
                              <span className="text-[10px] font-bold text-emerald-200 bg-black/40 px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1">
                                <span>{mConnInfo.hasLaptop && mConnInfo.hasPhone ? '📱💻' : mConnInfo.hasLaptop ? '💻' : '📱'}</span>
                                <span>{mConnInfo.statusText}</span>
                              </span>
                            );
                          })()}
                          {assignedFacility && (
                            <span className="text-[10px] text-gray-300 truncate max-w-[130px]">
                              • {assignedFacility}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMember(null)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                      aria-label="Close details"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Location info */}
                  <div className="bg-black/35 rounded-2xl p-2.5 mb-3 border border-white/5 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-100 truncate">
                          {isLoadingLocation ? 'Finding building / landmark...' : (selectedMemberLocation?.landmark || 'Facility Area')}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {selectedMemberLocation?.road || (loc ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}` : 'Coordinates unavailable')}
                        </p>
                      </div>
                    </div>
                    {loc && (
                      <p className="text-[10px] text-emerald-400 font-medium pl-5">
                        {active ? '🟢 Active today' : '🔴 Last active'}: {formatDistanceToNow(new Date(loc.timestamp))} ago
                      </p>
                    )}
                  </div>

                  {/* Mobile Action Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {phone ? (
                      <a
                        href={`https://wa.me/91${phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn team-action-btn team-action-btn-wa flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-xs font-bold text-white shadow-md shadow-emerald-900/40"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-white text-white shrink-0" />
                        <span className="text-white font-bold">WhatsApp</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="team-action-btn flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-gray-800 text-gray-500 text-xs font-bold opacity-50 cursor-not-allowed"
                      >
                        <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>WhatsApp</span>
                      </button>
                    )}

                    {phone ? (
                      <a
                        href={`tel:${phone}`}
                        className="btn team-action-btn team-action-btn-call flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-xs font-bold text-white shadow-md shadow-blue-900/40"
                      >
                        <Phone className="w-3.5 h-3.5 fill-white text-white shrink-0" />
                        <span className="text-white font-bold">Call</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="team-action-btn flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-gray-800 text-gray-500 text-xs font-bold opacity-50 cursor-not-allowed"
                      >
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>Call</span>
                      </button>
                    )}

                    {gmapsUrl ? (
                      <a
                        href={gmapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn team-action-btn team-action-btn-nav flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-95 transition-all text-xs font-bold text-white shadow-md shadow-teal-900/40"
                      >
                        <Navigation className="w-3.5 h-3.5 text-white shrink-0" />
                        <span className="text-white font-bold">Directions</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="team-action-btn flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-gray-800 text-gray-500 text-xs font-bold opacity-50 cursor-not-allowed"
                      >
                        <Navigation className="w-3.5 h-3.5 shrink-0" />
                        <span>Directions</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            /* Carousel bottom drawer when no member is selected */
            <div className="bg-slate-950/95 backdrop-blur-xl border border-white/15 rounded-3xl p-3 shadow-2xl text-white animate-in fade-in duration-200">
              {/* Drag pill handle */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2" />

              {/* Header with count and filter */}
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-extrabold text-white">Team on Map ({membersToPlot.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOnlyActiveToday(p => !p)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                    onlyActiveToday
                      ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  {onlyActiveToday ? '✓ Active Only' : 'Show Active Only'}
                </button>
              </div>

              {/* Horizontal scroll list */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {membersToPlot.length === 0 ? (
                  <div className="py-2 px-4 text-xs text-gray-400 italic text-center w-full">
                    No team members with GPS coordinates found
                  </div>
                ) : (
                  membersToPlot.map(member => {
                    const loc = latestLocations[member.id];
                    const active = loc ? isToday(new Date(loc.timestamp)) : false;
                    const rawName = (member.name || '').trim();
                    const displayName = rawName || (member.email ? member.email.split('@')[0] : 'Team Member');
                    const formattedRole = (member.role || 'Staff').replace(/_/g, ' ');
                    const initials = (rawName || displayName).split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'TM';

                    let photo = member.photoUrl;
                    if (photo && !photo.startsWith('http') && !photo.startsWith('data:') && !photo.startsWith('/')) {
                      const isAvatar = photo.startsWith('avatars/');
                      const bucket = isAvatar ? 'avatars' : 'onboarding-documents';
                      const path = isAvatar ? photo.replace('avatars/', '') : photo;
                      try {
                        photo = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
                      } catch {
                        /* fallback gracefully */
                      }
                    }

                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelectMember(member)}
                        className="flex items-center gap-2 p-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 shrink-0 min-w-[140px] max-w-[180px] active:scale-95 transition-all text-left cursor-pointer"
                      >
                        <div className="relative shrink-0 w-8 h-8 rounded-full overflow-hidden border" style={{ borderColor: active ? '#10b981' : '#ef4444' }}>
                          {photo ? (
                            <img src={photo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-emerald-800 flex items-center justify-center font-bold text-[10px] text-white">
                              {initials}
                            </div>
                          )}
                          <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-black ${active ? 'bg-emerald-400' : 'bg-red-500'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-white truncate leading-tight">{displayName}</p>
                          <p className="text-[9px] text-emerald-400 font-medium truncate mt-0.5 capitalize">{formattedRole}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Leaflet map container ────────────────────────────────────────────
           UNIVERSAL MOBILE FIX: position:absolute + inset:0
           This is the industry-standard fix for Leaflet on mobile.
           Unlike height:100% (which requires ALL ancestors to have explicit
           heights set), absolute+inset:0 fills the nearest positioned parent
           instantly — regardless of CSS layout phase, flex/grid, or vh units.
           Result: clientWidth/clientHeight are ALWAYS correct when Leaflet reads them.
      ── */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          backgroundColor: mapStyle === 'dark' ? '#121212' : (mapStyle === 'satellite' ? '#061018' : '#aadaff'),
          touchAction: 'none',
        }}
      />
    </div>
  );
};

export default TeamMapView;
