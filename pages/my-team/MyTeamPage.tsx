import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Search, MapPin, Clock, ChevronRight, User as UserIcon, Navigation, Users, CheckCircle, XCircle } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDistanceToNow, isToday } from 'date-fns';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { NativeBridge } from '../../utils/nativeBridge';
import { useDevice } from '../../hooks/useDevice';

// ... existing imports

// ... inside component


import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { User, AttendanceEvent, AttendanceUnlockRequest } from '../../types';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';

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
  
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup>(L.layerGroup());
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    // Inject custom marker styles
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = markerStyles;
    document.head.appendChild(styleSheet);
    
    fetchTeamData();
    fetchUnlockRequests();
    fetchSettings(); // Call fetchSettings here
    
    return () => {
      document.head.removeChild(styleSheet);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const { settings } = await api.getInitialAppData();
      if (settings?.office?.trackingIntervalMinutes) {
        const interval = settings.office.trackingIntervalMinutes;
        setTrackingInterval(interval);
        
        // Start tracking automatically if we have an interval and user is valid
        // NOTE: Real implementation might check if user is actually checked-in first.
        // For now, we enforce tracking if the user is a field staff or similar.
        if (user) {
             NativeBridge.startTracking(interval, user.id);
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
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
        Object.values(locMap).forEach(({ state, city }) => {
          if (!grouped[state]) grouped[state] = [];
          if (!grouped[state].includes(city)) grouped[state].push(city);
        });

        // Sort states and cities
        const sortedGrouped: Record<string, string[]> = {};
        Object.keys(grouped).sort().forEach(state => {
          sortedGrouped[state] = grouped[state].sort();
        });

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
    setIsUpdatingInterval(true);
    try {
      // We need to fetch current settings first to not overwrite other things, or just patch.
      // api.updateAttendanceSettings expects the whole object or we need a specific patch method.
      // The `updateAttendanceSettings` we added takes `AttendanceSettings`.
      // So we should fetch, update, and save.
      const { settings } = await api.getInitialAppData();
      
      // Clone settings to avoid mutation
      const newSettings = { ...settings };
      
      // Update office if exists
      if (newSettings.office) {
          newSettings.office = {
              ...newSettings.office,
              trackingIntervalMinutes: trackingInterval
          };
      }

      // Update field if exists (avoids error if column is missing)
      if (newSettings.field) {
          newSettings.field = {
              ...newSettings.field,
              trackingIntervalMinutes: trackingInterval
          };
      }

      // Update site if exists
      if (newSettings.site) {
          newSettings.site = {
              ...newSettings.site,
              trackingIntervalMinutes: trackingInterval
          };
      }

      await api.updateAttendanceSettings(newSettings);
      
      // Update local tracking immediately
      if (user) {
         NativeBridge.startTracking(trackingInterval, user.id);
      }
      
      alert('Tracking interval updated successfully');
    } catch (err) {
      console.error('Failed to update interval:', err);
      alert('Failed to update tracking interval');
    } finally {
      setIsUpdatingInterval(false);
    }
  };

  // 1. Initialize Map Object & Initial Tiles
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        fadeAnimation: false // Disable to see if it helps with gray screen
      }).setView([12.9716, 77.5946], 12); // Bangalore
      
      mapRef.current = map;
      
      // Add Tile Layer
      tileLayerRef.current = L.tileLayer(tileUrl, { 
        attribution,
        maxZoom: 19,
        zIndex: 1
      }).addTo(map);

      // Add other layers
      markersRef.current.addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Initial size invalidation
      setTimeout(() => {
        map.invalidateSize();
        setTimeout(() => map.invalidateSize(), 500);
      }, 200);
    }
  }, []);

  // 2. Manage Tile Layer Updates (Theme change only)
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Refresh size when theme changes
    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [theme]);

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
    if (!mapRef.current) return;
    markersRef.current.clearLayers();

    const markerInstances: L.Marker[] = [];

    filteredMembers.forEach(member => {
      const loc = latestLocations[member.id];
      if (loc && loc.latitude && loc.longitude) {
        const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        
        const isActiveToday = loc && isToday(new Date(loc.timestamp));
        const indicatorColor = isActiveToday ? '#10b981' : '#ef4444';

        const isValidPhoto = member.photoUrl && (member.photoUrl.startsWith('http') || member.photoUrl.startsWith('data:'));

        const mapHtml = `
          <div class="custom-user-marker" style="border-color: ${indicatorColor}; overflow: hidden;">
            <div class="user-marker-initials" style="color: ${indicatorColor}">${initials}</div>
            ${isValidPhoto ? `<img src="${member.photoUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 10;" onerror="this.style.display='none'" />` : ''}
          </div>
        `;

        const customIcon = L.divIcon({
          className: '',
          html: mapHtml,
          iconSize: [48, 48],
          iconAnchor: [24, 58],
          popupAnchor: [0, -58]
        });

        const marker = L.marker([loc.latitude, loc.longitude], { icon: customIcon });
        
        const popupContent = `
          <div class="marker-popup-content">
            <p class="marker-popup-name">${member.name}</p>
            <p class="marker-popup-status">Last active ${formatDistanceToNow(new Date(loc.timestamp))} ago</p>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        markersRef.current.addLayer(marker);
        markerInstances.push(marker);
      }
    });

    if (markerInstances.length > 0) {
      const group = L.featureGroup(markerInstances);
      mapRef.current.fitBounds(group.getBounds().pad(0.3));
    }
  }, [filteredMembers, latestLocations]);

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
                {Object.entries(availableLocations).map(([state, cities]) => (
                  <optgroup key={state} label={state}>
                    <option value={`state:${state}`}>All {state}</option>
                    {cities.map(city => (
                      <option key={`${state}-${city}`} value={`city:${state}:${city}`}>{city}</option>
                    ))}
                  </optgroup>
                ))}
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
      <div className={`relative rounded-2xl overflow-hidden border border-border shadow-sm bg-card transition-all duration-300 ${isMobile ? 'h-72' : 'h-[400px]'}`}>
        <div ref={mapContainerRef} className="w-full h-full z-0" />
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
              return (
                <Link
                  key={member.id}
                  to={`/my-team/${member.id}`}
                  className="group bg-card border border-border rounded-2xl p-4 hover:border-accent hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center font-bold text-lg ring-2 ring-background overflow-hidden relative">
                        {member.name.charAt(0)}
                        {member.photoUrl && (
                          <img 
                            src={member.photoUrl} 
                            alt={member.name}
                            className="absolute inset-0 w-full h-full object-cover z-10"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
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
                      <p className="text-xs text-muted mb-2 truncate">
                        {member.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </p>
                      
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
