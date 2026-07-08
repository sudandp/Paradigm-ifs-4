import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Search, MapPin, Clock, ChevronRight, User as UserIcon, Navigation, Users, CheckCircle, XCircle, Globe, Map as MapIcon, Home, ClipboardList, Plus, Calendar, Bell, Check, X } from 'lucide-react';
import { formatDistanceToNow, isToday } from 'date-fns';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { useDevice } from '../../hooks/useDevice';
import MapSkeleton from '../../components/ui/MapSkeleton';

import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { User, AttendanceEvent, AttendanceUnlockRequest } from '../../types';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';

// Custom Marker CSS
const markerStyles = `
  .custom-user-marker {
    width: 48px;
    height: 48px;
    background-size: cover;
    background-position: center;
    border: 3px solid #10b981;
    border-radius: 12px;
    position: relative;
    background-color: white;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
  }
  .custom-user-marker::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 10px solid #10b981;
  }
  .user-marker-initials {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-weight: bold;
    color: #10b981;
    font-size: 18px;
    text-transform: uppercase;
  }
  .leaflet-popup-content-wrapper {
    border-radius: 12px;
    padding: 4px;
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
`;

const MyTeamPage: React.FC = () => {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const { isMobile, isTablet } = useDevice();
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [latestLocations, setLatestLocations] = useState<Record<string, { latitude: number; longitude: number; timestamp: string }>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [availableLocations, setAvailableLocations] = useState<Record<string, string[]>>({});
  const [memberLocations, setMemberLocations] = useState<Record<string, { state: string; city: string }>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [trackingInterval, setTrackingInterval] = useState<number>(15);
  const [isUpdatingInterval, setIsUpdatingInterval] = useState(false);
  const [unlockRequests, setUnlockRequests] = useState<AttendanceUnlockRequest[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const hasInitiallyFitted = useRef(false);
  // Ref to hold the current dashboard poll interval ID so we can restart it
  const dashboardPollRef = useRef<any>(null);

  // Helper: start (or restart) the dashboard location poll at the given interval
  const startDashboardPoll = (intervalMinutes: number) => {
    if (dashboardPollRef.current) clearInterval(dashboardPollRef.current);
    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
    dashboardPollRef.current = setInterval(() => {
      // Re-fetch only the latest locations so the map & list stay current
      setTeamMembers(prevMembers => {
        if (prevMembers.length > 0) {
          const userIds = prevMembers.map(m => m.id);
          api.getLatestLocations(userIds).then(locations => {
            setLatestLocations(locations);
          }).catch(console.error);
        }
        return prevMembers;
      });
    }, intervalMs);
    console.log(`[MyTeam] Dashboard poll started — every ${intervalMinutes} min(s)`);
  };

  useEffect(() => {
    // Inject custom marker styles
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = markerStyles;
    document.head.appendChild(styleSheet);
    fetchTeamData();
    fetchUnlockRequests();
    fetchSettings(); // Loads interval from DB, then starts poll inside
    
    return () => {
      document.head.removeChild(styleSheet);
      if (dashboardPollRef.current) clearInterval(dashboardPollRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const fetchSettings = async () => {
    try {
      // getInitialAppData returns the full settings row; attendance config is
      // nested under attendanceSettings (maps to attendance_settings column).
      const { settings } = await api.getInitialAppData();
      const attendanceSettings = settings?.attendanceSettings;
      const savedInterval = attendanceSettings?.trackingIntervalMinutes;
      if (savedInterval && savedInterval > 0) {
        setTrackingInterval(savedInterval);
        // Start the dashboard poll at the saved interval so admins see
        // fresh data without manual refresh. Field-staff device tracking is
        // handled by routeTrackingService in authStore — NOT from here.
        startDashboardPoll(savedInterval);
        console.log(`[MyTeam] Loaded tracking interval from DB: ${savedInterval} min(s)`);
      } else {
        // Fall back to default 15-minute poll if no interval is configured yet
        startDashboardPoll(15);
      }
    } catch (err) {
      console.error('[MyTeam] Error fetching settings:', err);
      // Still start a default poll so the dashboard doesn't go stale
      startDashboardPoll(15);
    }
  };

  const fetchTeamData = async () => {
    if (!user) return;
    try {
      // Keep loading true only if we have no data at all
      if (teamMembers.length === 0) setLoading(true);
      
      let members: User[] = [];
      
      // Fetch members based on user role
      if (['admin', 'super_admin'].includes(user.role)) {
        members = await api.getUsers();
      } else {
        members = await api.getTeamMembers(user.id);
      }
      
      // Set team members immediately to show the list "instantly"
      setTeamMembers(members);
      setLoading(false);
      
      // Fetch locations in the background
      const userIds = members.map(m => m.id);
      
      // Fetch locations in the background
      api.getTeamLocations(userIds).then(locMap => {
        setMemberLocations(locMap);
        
        // Group cities by state
        const grouped: Record<string, string[]> = {};
        
        // Add from locMap
        Object.values(locMap).forEach(({ state, city }) => {
          if (!grouped[state]) grouped[state] = [];
          if (!grouped[state].includes(city)) grouped[state].push(city);
        });

        // Add from member fallbacks if missing
        members.forEach(member => {
            if (!locMap[member.id]) {
                const fallbackCity = member.locationName || member.location;
                if (fallbackCity) {
                    const state = 'Other'; // Or a guessed state
                    locMap[member.id] = { state, city: fallbackCity };
                    if (!grouped[state]) grouped[state] = [];
                    if (!grouped[state].includes(fallbackCity)) grouped[state].push(fallbackCity);
                }
            }
        });

        // Sort states and cities
        const sortedGrouped: Record<string, string[]> = {};
        Object.keys(grouped).sort().forEach(state => {
          sortedGrouped[state] = grouped[state].sort();
        });

        setMemberLocations({...locMap});
        setAvailableLocations(sortedGrouped);
      }).catch(err => {
        console.error('Error fetching team locations:', err);
      });

      // Fetch locations in the background
      api.getLatestLocations(userIds).then(locations => {
        setLatestLocations(locations);
      }).catch(err => {
        console.error('Error fetching latest locations:', err);
      });

    } catch (err) {
      console.error('Error fetching team data:', err);
      setLoading(false);
    }
  };

  const fetchUnlockRequests = async () => {
    if (!user || user.role === 'field_staff') return;
    try {
      const isSuperAdmin = ['admin', 'super_admin'].includes(user.role);
      const requests = await api.getAttendanceUnlockRequests(isSuperAdmin ? undefined : user.id);
      setUnlockRequests(requests.filter(r => r.userId !== user.id));
    } catch (err) {
      console.error('Error fetching unlock requests:', err);
    }
  };

  const handleRespondToUnlock = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      await api.respondToUnlockRequest(requestId, status);
      setUnlockRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      console.error('Error responding to request:', err);
    }
  };



  const handleUpdateInterval = async () => {
    if (!user || user.role !== 'admin') return;
    if (!trackingInterval || trackingInterval < 1 || trackingInterval > 120) {
      alert('Please enter a valid interval between 1 and 120 minutes.');
      return;
    }
    setIsUpdatingInterval(true);
    try {
      // Fetch current full attendance settings so we don't clobber other fields.
      // The correct key path is attendanceSettings (maps to attendance_settings column).
      const { settings } = await api.getInitialAppData();
      const currentAttendance = settings?.attendanceSettings || {};

      // trackingIntervalMinutes is a TOP-LEVEL key on AttendanceSettings.
      // It is NOT nested under .office / .field / .site sub-objects.
      const updatedAttendance = {
        ...currentAttendance,
        trackingIntervalMinutes: trackingInterval,
      };

      await api.updateAttendanceSettings(updatedAttendance);

      // Restart the dashboard poll at the new interval so it takes effect immediately.
      // NOTE: Field-staff DEVICE tracking is managed by routeTrackingService in authStore.
      //       We must NOT call NativeBridge.startTracking() with the admin's own userId here,
      //       as that would incorrectly track the admin's location instead of field staff.
      startDashboardPoll(trackingInterval);

      console.log(`[MyTeam] Tracking interval saved: ${trackingInterval} min(s). Dashboard poll restarted.`);
      alert(`Tracking interval updated to ${trackingInterval} minute(s). Field devices will apply this on their next check-in.`);
    } catch (err) {
      console.error('[MyTeam] Failed to update interval:', err);
      alert('Failed to update tracking interval. Please try again.');
    } finally {
      setIsUpdatingInterval(false);
    }
  };

  // 1. Initialize Map Object & Initial Tiles (Dynamic Load)
  useEffect(() => {
    const initMap = async () => {
      if (mapContainerRef.current && !mapRef.current) {
        // Load Leaflet dynamically to prevent blocking main bundle
        const L = await import('leaflet');
        LRef.current = L;
        
        const isDark = theme === 'dark';
        const tileUrl = mapStyle === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : (isDark 
              ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
        
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
          fadeAnimation: true,
          markerZoomAnimation: true,
          maxZoom: 22
        }).setView([12.9716, 77.5946], 12); // Bangalore
        
        mapRef.current = map;
        
        // Add Tile Layer
        const tiles = L.tileLayer(tileUrl, { 
          maxZoom: 22,
          maxNativeZoom: 18,
          zIndex: 1,
          detectRetina: true,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map);
        
        tileLayerRef.current = tiles;

        // Initialize markers layer group
        markersRef.current = L.layerGroup().addTo(map);
        
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Only fade out skeleton once tiles are actually loaded for a "butter smooth" transition
        tiles.once('load', () => {
          setTimeout(() => setMapLoaded(true), 200);
        });

        // Fallback: If tiles take too long (e.g., 3s), show the map anyway
        setTimeout(() => setMapLoaded(true), 3000);

        // Aggressive size invalidation for proper rendering
        const invalidate = () => {
          if (mapRef.current) mapRef.current.invalidateSize();
        };
        
        setTimeout(invalidate, 100);
        setTimeout(invalidate, 500);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 1.5 Handle Resize invalidation
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) mapRef.current.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. Manage Tile Layer Updates (Theme & Style change)
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    
    let tileUrl = '';
    if (mapStyle === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    } else {
      const isDark = theme === 'dark';
      tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
      
    tileLayerRef.current.setUrl(tileUrl);
    
    // Refresh size when theme/style changes
    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [theme, mapStyle]);

  const filteredMembers = useMemo(() => {
    return teamMembers.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase().replace(/\s+/g, '_'));
      
      const loc = memberLocations[m.id];
      let matchesLocation = selectedLocation === 'All';
      
      if (!matchesLocation && loc) {
        if (selectedLocation.startsWith('state:')) {
          const state = selectedLocation.replace('state:', '');
          matchesLocation = loc.state === state;
        } else if (selectedLocation.startsWith('city:')) {
          const parts = selectedLocation.split(':');
          const state = parts[1];
          const city = parts[2];
          matchesLocation = loc.state === state && loc.city === city;
        }
      }
      
      return matchesSearch && matchesLocation;
    });
  }, [teamMembers, searchQuery, selectedLocation, memberLocations]);

  // Update Markers
  useEffect(() => {
    if (!mapRef.current || !markersRef.current || !LRef.current) return;
    const L = LRef.current;
    markersRef.current.clearLayers();

    const markerInstances: any[] = [];

    filteredMembers.forEach(member => {
      const loc = latestLocations[member.id];
      if (loc && loc.latitude && loc.longitude) {
        const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        
        const isActiveToday = loc && isToday(new Date(loc.timestamp));
        const indicatorColor = isActiveToday ? '#10b981' : '#ef4444';

        // Resolve photo URL (handle Supabase paths)
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

        const isValidPhoto = resolvedPhotoUrl && (resolvedPhotoUrl.startsWith('http') || resolvedPhotoUrl.startsWith('data:'));

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
        
        const popupContent = `
          <div class="marker-popup-content">
            <p class="marker-popup-name">${member.name}</p>
            <p class="marker-popup-status">Last active ${formatDistanceToNow(new Date(loc.timestamp))} ago</p>
            ${member.phone ? `
              <a href="https://wa.me/91${member.phone.replace(/\D/g,'')}" target="_blank" class="mt-2 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all no-underline">
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
        duration: !hasInitiallyFitted.current ? 2.5 : 0.8, 
        easeLinearity: 0.1
      });
      hasInitiallyFitted.current = true;
    } else if (selectedLocation !== 'All' && selectedLocation.startsWith('city:')) {
      const city = selectedLocation.split(':')[2];
      if (city) {
         fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json&limit=1`)
           .then(res => res.json())
           .then(data => {
              if (data && data.length > 0) {
                 mapRef.current.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 12, { animate: true, duration: 1.0 });
              }
           })
           .catch(err => console.error("Could not fetch city location", err));
      }
    }
  }, [filteredMembers, latestLocations, mapLoaded]);

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-[#042516] p-4 pb-28 text-white space-y-6 overflow-y-auto">

        {/* Title and Subtitle */}
        <div className="space-y-1 mt-2 text-center">
          <h1 className="text-2xl font-black tracking-tight text-white">My Team</h1>
          <p className="text-[11px] text-gray-400 font-medium">Real-time status and locations of your field personnel.</p>
        </div>

        {/* Structure Link */}
        {['admin', 'developer'].includes(user?.role || '') && (
          <div className="flex justify-center w-full">
            <Link to="/my-team/reporting" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00a859] hover:text-emerald-400 bg-[#182a20] px-4.5 py-2.5 rounded-2xl border border-[#2a4536]/30 shadow-sm transition-all">
              <Users className="w-3.5 h-3.5" />
              Manage Structure
            </Link>
          </div>
        )}

        {/* Search and dropdown filters */}
        <div className="space-y-2">
          <div className="relative">
            <select
              id="location-filter-mobile"
              name="locationFilter"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-4 py-3 bg-[#091c13] border border-[#2a4536]/30 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-transparent outline-none transition-all text-xs text-white appearance-none cursor-pointer font-semibold shadow-sm"
            >
              <option value="All">All Locations</option>
              {Object.entries(availableLocations).flatMap(([state, cities]) => [
                <option key={`state-${state}`} value={`state:${state}`} className="font-bold text-[#00a859]">All {state}</option>,
                ...cities.map(city => (
                  <option key={`${state}-${city}`} value={`city:${state}:${city}`}>
                    {city} ({state})
                  </option>
                ))
              ])}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              id="team-search-mobile"
              name="teamSearch"
              type="text"
              placeholder="Search team member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#091c13] border border-[#2a4536]/30 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-transparent outline-none transition-all text-xs text-white placeholder-gray-400 font-semibold shadow-sm"
            />
          </div>
        </div>

        {/* Admin Tracking Interval Control */}
        {user?.role === 'admin' && (
          <div className="bg-[#78817b]/80 backdrop-blur-md rounded-2xl border border-[#2a4536]/20 p-4.5 space-y-3.5 text-sm shadow-md">
            <div className="flex items-center gap-2 text-rose-800 font-bold">
              <Clock className="w-4.5 h-4.5 text-rose-800" />
              <span>Tracking Interval (mins):</span>
            </div>
            <div className="flex gap-3">
              <input 
                id="tracking-interval-mobile"
                name="trackingInterval"
                type="number" 
                min="1" 
                max="60" 
                value={trackingInterval} 
                onChange={(e) => setTrackingInterval(parseInt(e.target.value) || 15)}
                className="w-20 h-10 px-3 bg-white border-0 text-black text-center text-sm rounded-xl font-bold focus:outline-none shrink-0"
              />
              <button 
                onClick={handleUpdateInterval}
                disabled={isUpdatingInterval}
                className="flex-1 h-10 bg-[#00a859] hover:bg-[#008f4c] active:scale-95 text-white font-bold rounded-xl transition-all flex items-center justify-center border-none shadow-sm"
              >
                {isUpdatingInterval ? 'Saving...' : 'Set'}
              </button>
            </div>
          </div>
        )}

        {/* Pending Unlock Requests */}
        {unlockRequests.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-extrabold text-amber-500 flex items-center gap-2 uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              Pending Unlock Requests ({unlockRequests.length})
            </h2>
            <div className="space-y-4.5">
              {unlockRequests.map(req => (
                <div key={req.id} className="bg-[#fffdf6] rounded-3xl border border-amber-100/50 p-4.5 shadow-md space-y-4 text-black animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center font-black text-amber-700 overflow-hidden relative border border-amber-200 shrink-0">
                      {req.userName.charAt(0)}
                      {req.userPhoto && (
                        <img 
                          src={req.userPhoto} 
                          alt={req.userName} 
                          className="absolute inset-0 w-full h-full object-cover" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{req.userName}</p>
                      <p className="text-[10px] text-amber-700 font-semibold mt-0.5">{formatDistanceToNow(new Date(req.requestedAt))} ago</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-3 border border-amber-50/40 shadow-inner">
                    <p className="text-xs text-gray-700 font-medium leading-relaxed italic">"{req.reason}"</p>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100/80">
                    <button 
                      className="flex items-center gap-1.5 text-xs font-black text-[#00a859] hover:text-emerald-700 py-1.5 px-3 rounded-lg hover:bg-emerald-50 transition-colors"
                      onClick={() => handleRespondToUnlock(req.id, 'approved')}
                    >
                      <CheckCircle className="w-4 h-4 text-[#00a859]" /> Approve
                    </button>
                    <button 
                      className="flex items-center gap-1.5 text-xs font-black text-rose-600 hover:text-rose-700 py-1.5 px-3 rounded-lg hover:bg-rose-50 transition-colors"
                      onClick={() => handleRespondToUnlock(req.id, 'rejected')}
                    >
                      <XCircle className="w-4 h-4 text-rose-500" /> REJECT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Members List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
              Team Members
              <span className="bg-[#00a859]/20 text-[#00a859] text-xs px-2.5 py-0.5 rounded-full font-bold">
                {filteredMembers.length}
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-[#182a20] animate-pulse rounded-2xl border border-[#2a4536]/30" />
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-[#182a20] rounded-2xl border border-dashed border-[#2a4536]/30">
              <UserIcon className="w-10 h-10 mb-2 opacity-25" />
              <p className="text-xs">No team members found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMembers
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((member) => {
                  const loc = latestLocations[member.id];
                  const userLocInfo = memberLocations[member.id];
                  const locationDisplay = userLocInfo ? `${userLocInfo.city}, ${userLocInfo.state}` : (member.locationName || member.location);
                  return (
                    <Link
                      key={member.id}
                      to={`/my-team/${member.id}`}
                      className="flex items-center gap-3.5 bg-[#182a20] border border-[#2a4536]/30 rounded-2xl p-4 hover:border-emerald-500/50 transition-all duration-300 shadow-sm"
                    >
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-lg ring-2 ring-[#042516] overflow-hidden relative">
                          <ProfilePlaceholder 
                            photoUrl={member.photoUrl} 
                            seed={member.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#182a20] z-20 ${
                          loc && isToday(new Date(loc.timestamp))
                            ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' 
                            : 'bg-red-500 shadow-[0_0_6px_rgba(239,44,44,0.6)]'
                        }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-sm truncate">
                          {member.name}
                        </h3>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {member.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </p>
                        {locationDisplay && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            <span className="truncate">{locationDisplay}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="truncate">
                            {loc 
                              ? `Active ${formatDistanceToNow(new Date(loc.timestamp))} ago`
                              : 'No recent activity'
                            }
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-emerald-500 shrink-0" />
                    </Link>
                  );
                })}

              {/* Mobile Pagination */}
              {filteredMembers.length > pageSize && (
                <div className="flex justify-between items-center bg-[#182a20] border border-[#2a4536]/30 p-3 rounded-2xl mt-4 text-xs font-bold">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-3.5 py-2 bg-[#091c13] text-white rounded-xl border border-[#2a4536]/30 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-gray-300">
                    Page {currentPage} of {Math.ceil(filteredMembers.length / pageSize)}
                  </span>
                  <button
                    disabled={currentPage >= Math.ceil(filteredMembers.length / pageSize)}
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredMembers.length / pageSize), prev + 1))}
                    className="px-3.5 py-2 bg-[#091c13] text-white rounded-xl border border-[#2a4536]/30 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Custom Mobile Bottom Navigation Dock & Floating Plus Button */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#042516]/90 backdrop-blur-md px-4 pb-4 pt-2 border-t border-[#2a4536]/10">
          <div className="relative bg-[#091c13] border border-[#2a4536]/30 rounded-3xl h-16 flex items-center justify-around shadow-2xl">
            <button className="flex flex-col items-center justify-center text-[#00a859] p-2 hover:opacity-85 transition-opacity">
              <Home className="w-5 h-5" />
            </button>

            <button className="flex flex-col items-center justify-center text-gray-400 p-2 hover:text-[#00a859] hover:opacity-85 transition-colors">
              <ClipboardList className="w-5 h-5" />
            </button>

            {/* Center Floating Plus Button Container */}
            <div className="relative -top-5 shrink-0">
              <Link 
                to={['admin', 'hr', 'developer'].includes(user?.role || '') ? '/my-team/reporting' : '#'}
                className="w-14 h-14 bg-[#00a859] text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 hover:scale-105 transition-all duration-300"
              >
                <Plus className="w-6 h-6 stroke-[3]" />
              </Link>
            </div>

            <button className="flex flex-col items-center justify-center text-gray-400 p-2 hover:text-[#00a859] hover:opacity-85 transition-colors">
              <Calendar className="w-5 h-5" />
            </button>

            <button className="flex flex-col items-center justify-center text-gray-400 p-2 hover:text-[#00a859] hover:opacity-85 transition-colors">
              <UserIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-background overflow-hidden ${isTablet ? 'p-2' : 'p-6 md:p-8'} space-y-6`}>
      {/* Header & Search */}
      <div className={`flex flex-col ${isMobile ? 'gap-4' : 'gap-6'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className={`${isTablet ? 'text-lg' : 'text-2xl'} font-bold text-primary-text`}>My Team</h1>
            {!isTablet && <p className="text-sm text-muted">Real-time status and locations of your field personnel.</p>}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {['admin', 'developer'].includes(user?.role || '') && (
              <Link to="/my-team/reporting" className="w-full sm:w-auto">
                <Button variant="outline" size="sm" className="w-full whitespace-nowrap">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Structure
                </Button>
              </Link>
            )}
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <select
                id="location-filter"
                name="locationFilter"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 bg-card border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all text-sm appearance-none cursor-pointer"
              >
                <option value="All">All Locations</option>
                {Object.entries(availableLocations).flatMap(([state, cities]) => [
                  <option key={`state-${state}`} value={`state:${state}`} className="font-bold text-accent">All {state}</option>,
                  ...cities.map(city => (
                    <option key={`${state}-${city}`} value={`city:${state}:${city}`}>
                      {city} ({state})
                    </option>
                  ))
                ])}
              </select>
 
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                <input
                  id="team-search"
                  name="teamSearch"
                  type="text"
                  placeholder="Search team member..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full !pl-10 pr-4 py-2 bg-card border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all text-sm"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Admin Tracking Interval Control */}
        {user?.role === 'admin' && (
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${isMobile ? 'flex-col items-stretch bg-red-50/50' : 'bg-red-50 border-red-200 w-fit'}`}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700 whitespace-nowrap">Tracking Interval (mins):</span>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                      id="tracking-interval"
                      name="trackingInterval"
                      type="number" 
                      min="1" 
                      max="60" 
                      value={trackingInterval} 
                      onChange={(e) => setTrackingInterval(parseInt(e.target.value) || 15)}
                      className="w-20 h-9 text-sm border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 bg-white !text-gray-900"
                  />
                  <Button 
                      size="sm" 
                      variant="primary" 
                      onClick={handleUpdateInterval}
                      disabled={isUpdatingInterval}
                      className="h-9 px-4 text-xs bg-red-600 hover:bg-red-700 border-none rounded-lg"
                  >
                      {isUpdatingInterval ? 'Saving...' : 'Set'}
                  </Button>
                </div>
            </div>
        )}
 
        {/* Pending Unlock Requests */}
        {unlockRequests.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-amber-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending Unlock Requests ({unlockRequests.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unlockRequests.map(req => (
                <div key={req.id} className="bg-amber-50 border border-amber-100 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center font-bold text-amber-700 overflow-hidden relative">
                      {req.userName.charAt(0)}
                      {req.userPhoto && (
                        <img 
                          src={req.userPhoto} 
                          alt={req.userName} 
                          className="absolute inset-0 w-full h-full object-cover" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{req.userName}</p>
                      <p className="text-[10px] text-amber-700">{formatDistanceToNow(new Date(req.requestedAt))} ago</p>
                    </div>
                  </div>
                  <div className="bg-white/50 rounded-xl p-3 border border-amber-100/50">
                    <p className="text-xs text-gray-700 italic">"{req.reason}"</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 border-none text-[10px] uppercase font-bold"
                      onClick={() => handleRespondToUnlock(req.id, 'approved')}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-100 text-[10px] uppercase font-bold"
                      onClick={() => handleRespondToUnlock(req.id, 'rejected')}
                    >
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Map View */}
      <div className={`relative rounded-2xl overflow-hidden border border-border shadow-sm bg-card transition-all duration-500 ${isMobile ? 'h-72' : 'h-[400px]'}`}>
        {/* Style Toggle */}
        <div className="absolute top-4 right-4 z-20 flex bg-card/80 backdrop-blur-md rounded-xl border border-border p-1 shadow-lg">
          <button
            onClick={() => setMapStyle('streets')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mapStyle === 'streets' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-muted hover:bg-accent/10'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            MAP
          </button>
          <button
            onClick={() => setMapStyle('satellite')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mapStyle === 'satellite' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-muted hover:bg-accent/10'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            SATELLITE
          </button>
        </div>
 
        {/* Real Leaflet Map Container */}
        <div 
          ref={mapContainerRef} 
          className="w-full h-full z-0 will-change-transform" 
        />
        
        {/* Skeleton Overlay - Fades out when map is ready */}
        <div 
          className={`absolute inset-0 z-10 transition-all duration-[1200ms] ease-in-out bg-background will-change-opacity ${mapLoaded ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'}`}
        >
          <MapSkeleton />
        </div>
      </div>
 
      {/* Team List Header */}
      <div className={`${isTablet ? 'mt-4 px-2' : 'flex items-center justify-between mt-4 px-2'}`}>
        <h2 className={`${isTablet ? 'text-sm' : 'text-lg'} font-bold text-primary-text flex items-center gap-2`}>
          Team Members
          <span className="bg-accent/10 text-accent text-xs px-2 py-0.5 rounded-full">
            {filteredMembers.length}
          </span>
        </h2>
      </div>
 
      {/* Team Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-card animate-pulse rounded-2xl border border-border" />
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted bg-card rounded-2xl border border-dashed border-border">
          <UserIcon className="w-12 h-12 mb-3 opacity-20" />
          <p>No team members found.</p>
        </div>
      ) : (
        <div className={`flex flex-col ${isTablet ? 'gap-3' : 'gap-6'} pb-24`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMembers
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((member) => {
              const loc = latestLocations[member.id];
              const userLocInfo = memberLocations[member.id];
              const locationDisplay = userLocInfo ? `${userLocInfo.city}, ${userLocInfo.state}` : (member.locationName || member.location);
              return (
                <Link
                  key={member.id}
                  to={`/my-team/${member.id}`}
                  className="group bg-card border border-border rounded-2xl p-4 hover:border-accent hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center font-bold text-lg ring-2 ring-background overflow-hidden relative">
                        <ProfilePlaceholder 
                          photoUrl={member.photoUrl} 
                          seed={member.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card z-20 ${
                        loc && isToday(new Date(loc.timestamp))
                          ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' 
                          : 'bg-red-500 shadow-[0_0_8px_rgba(239,44,44,0.4)]'
                      }`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-primary-text truncate group-hover:text-accent transition-colors">
                        {member.name}
                      </h3>
                      <p className="text-xs text-muted truncate">
                        {member.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </p>
                      {locationDisplay && (
                        <div className="flex items-center gap-1.5 text-xs text-muted mt-1 mb-2">
                          <MapPin className="w-3 h-3 text-accent" />
                          <span className="truncate">{locationDisplay}</span>
                        </div>
                      )}
                      {!locationDisplay && <div className="mb-2" />}
                      
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {loc 
                            ? `Active ${formatDistanceToNow(new Date(loc.timestamp))} ago`
                            : 'No recent activity'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-medium text-accent">
                    <span>View Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
 
          <Pagination
            currentPage={currentPage}
            totalItems={filteredMembers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
 
      {/* Floating Action Button */}
      {['admin', 'hr', 'developer'].includes(user?.role || '') && (
        <button className="fixed bottom-8 right-8 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 hover:scale-110 transition-all duration-300 flex items-center justify-center z-50 group">
          <Navigation className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        </button>
      )}
    </div>
  );
};
 
export default MyTeamPage;
