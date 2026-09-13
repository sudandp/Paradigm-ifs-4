import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, MapPin, Clock, ChevronRight, User as UserIcon, Navigation, Users, CheckCircle, XCircle, Globe, Map as MapIcon, Home, ClipboardList, Plus, Calendar, Bell, Check, X, ArrowLeft, Crosshair, Building } from 'lucide-react';
import { formatDistanceToNow, isToday } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { useDevice } from '../../hooks/useDevice';
import TeamMapView from './TeamMapView';

import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { User, AttendanceEvent, AttendanceUnlockRequest } from '../../types';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';

// Helper: Finds the best matching dropdown value ('city:State:City' or 'state:State') for the current user
// Alias map: alternate/old city names → canonical dropdown city name
const CITY_ALIASES: Record<string, string> = {
  'bangalore': 'Bengaluru',
  'bengaluru': 'Bengaluru',
  'bombay': 'Mumbai',
  'mumbai': 'Mumbai',
  'madras': 'Chennai',
  'chennai': 'Chennai',
  'calcutta': 'Kolkata',
  'kolkata': 'Kolkata',
  'cochin': 'Kochi',
  'kochi': 'Kochi',
  'mysore': 'Mysuru',
  'mysuru': 'Mysuru',
  'hubli': 'Hubballi',
  'hubballi': 'Hubballi',
  'mangalore': 'Mangaluru',
  'mangaluru': 'Mangaluru',
  'vizag': 'Visakhapatnam',
  'visakhapatnam': 'Visakhapatnam',
  'poona': 'Pune',
  'pune': 'Pune',
  'new delhi': 'Delhi',
  'delhi': 'Delhi',
  'secunderabad': 'Hyderabad',
  'hyderabad': 'Hyderabad',
  'warangal': 'Warangal',
  'nizamabad': 'Nizamabad',
  'dharwad': 'Dharwad',
  'vijayawada': 'Vijayawada',
};

const findUserLocationKey = (
  currentUser: User | null,
  locMap: Record<string, { state: string; city: string }>,
  available: Record<string, string[]>,
  allMembers: User[]
): string | null => {
  if (!currentUser) return null;

  // Resolve a raw city string to canonical dropdown city (handles aliases)
  const resolveCity = (rawCity: string): string => {
    const lower = rawCity.toLowerCase().trim();
    return CITY_ALIASES[lower] || rawCity;
  };

  // Try to match city+state against the available dropdown options
  const tryMatch = (rawCity: string, rawState?: string): string | null => {
    const canonicalCity = resolveCity(rawCity);
    for (const [state, cities] of Object.entries(available)) {
      // Optionally filter by state if provided
      if (rawState && state.toLowerCase() !== rawState.toLowerCase()) continue;
      const cityKey = cities.find(
        c => c.toLowerCase() === canonicalCity.toLowerCase() ||
             c.toLowerCase() === rawCity.toLowerCase()
      );
      if (cityKey) return `city:${state}:${cityKey}`;
    }
    // Fall back to state-level match
    if (rawState) {
      const stateKey = Object.keys(available).find(
        s => s.toLowerCase() === rawState.toLowerCase()
      );
      if (stateKey) return `state:${stateKey}`;
    }
    return null;
  };

  // 1. Direct match from locMap (most reliable — derived from onboarding submissions)
  const userLoc = locMap[currentUser.id];
  if (userLoc?.city) {
    const result = tryMatch(userLoc.city, userLoc.state || undefined);
    if (result) return result;
  }

  // 2. Scan user's text fields for any known city or state mention
  const fullUser = allMembers.find(m => m.id === currentUser.id) || currentUser;
  const candidates = [
    fullUser.locationName,
    fullUser.location,
    (fullUser as any).homeAddress,
    (fullUser as any).home_address,
    fullUser.organizationName,
    fullUser.societyName,
  ].filter((t): t is string => typeof t === 'string' && t.trim().length > 0);

  for (const text of candidates) {
    const lower = text.toLowerCase();

    // Try each known city alias against the text
    for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
      if (lower.includes(alias)) {
        const result = tryMatch(canonical);
        if (result) return result;
      }
    }

    // Try dropdown city names directly
    for (const [state, cities] of Object.entries(available)) {
      for (const city of cities) {
        if (lower.includes(city.toLowerCase())) {
          return `city:${state}:${city}`;
        }
      }
    }

    // Fall back to state-level match
    for (const state of Object.keys(available)) {
      if (lower.includes(state.toLowerCase())) {
        return `state:${state}`;
      }
    }
  }

  return null;
};

const MyTeamPage: React.FC = () => {
  const navigate = useNavigate();
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
  const hasManuallySelected = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [trackingInterval, setTrackingInterval] = useState<number>(15);
  const [isUpdatingInterval, setIsUpdatingInterval] = useState(false);
  const [unlockRequests, setUnlockRequests] = useState<AttendanceUnlockRequest[]>([]);
  const [focusedMemberId, setFocusedMemberId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'all' | 'active'>('all');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showIntervalModal, setShowIntervalModal] = useState(false);
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
    fetchTeamData();
    fetchUnlockRequests();
    fetchSettings(); // Loads interval from DB, then starts poll inside

    // Realtime subscription: When a device pings route_history, instantly update map without waiting for poll
    const routeChannel = supabase
      .channel('my_team_route_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'route_history' },
        (payload) => {
          const pt = payload.new as any;
          if (pt && pt.user_id && pt.latitude && pt.longitude) {
            console.log(`[MyTeam] Realtime GPS update for ${pt.user_id}:`, pt.latitude, pt.longitude);
            setLatestLocations(prev => ({
              ...prev,
              [pt.user_id]: {
                latitude: Number(pt.latitude),
                longitude: Number(pt.longitude),
                timestamp: pt.timestamp,
                accuracy: pt.accuracy,
                deviceName: pt.device_name,
                source: pt.source,
              }
            }));
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(routeChannel);
      if (dashboardPollRef.current) clearInterval(dashboardPollRef.current);
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
      
      // Fetch locations in the background — ensure current user is mapped as well
      const userIds = Array.from(new Set([...members.map(m => m.id), ...(user?.id ? [user.id] : [])]));
      
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

        // Auto-select location based on current user if not manually chosen yet
        if (!hasManuallySelected.current) {
          const matched = findUserLocationKey(user, locMap, sortedGrouped, members);
          if (matched) {
            setSelectedLocation(matched);
          }
        }
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

  if (isMobile) {
    const activeMembersCount = teamMembers.filter(m => latestLocations[m.id] && isToday(new Date(latestLocations[m.id].timestamp))).length;
    const displayedMembers = mobileTab === 'active'
      ? filteredMembers.filter(m => latestLocations[m.id] && isToday(new Date(latestLocations[m.id].timestamp)))
      : filteredMembers;

    return (
      <div className="flex flex-col min-h-screen bg-[#041b0f] pb-32 text-white">
        {/* Native Mobile Top Bar - Non-floating, fixed-flow */}
        <div className="px-3.5 py-2.5 border-b border-[#134426]/50 flex items-center justify-between gap-2 w-full">
          <button
            type="button"
            onClick={() => {
              if (window.history.state?.idx > 0) navigate(-1);
              else navigate('/mobile-home');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#065f46] hover:bg-[#044e3b] text-white border border-emerald-500/40 font-bold text-xs shadow-[0_2px_8px_rgba(6,95,70,0.4)] active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Back</span>
          </button>

          <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
            <span>My Team</span>
            <span className="text-[10px] font-bold text-[#44D62C] bg-[#092c19] px-2 py-0.5 rounded-full border border-[#134426]">
              {displayedMembers.length}
            </span>
          </h1>

          <div className="flex items-center gap-1.5">
            {['admin', 'developer'].includes(user?.role || '') && (
              <Link
                to="/my-team/reporting"
                className="p-2 rounded-xl bg-[#092c19] border border-[#134426] text-[#44D62C] hover:bg-[#134426] transition-all"
                title="Manage Structure"
              >
                <Users className="w-4 h-4" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowSearchModal(prev => !prev)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                showSearchModal || searchQuery
                  ? 'bg-[#065f46] text-white border-white/20'
                  : 'bg-[#092c19] border-[#134426] text-gray-300'
              }`}
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Search Bar */}
        {(showSearchModal || searchQuery) && (
          <div className="px-3.5 py-2 bg-[#062414] border-b border-[#134426]/50 animate-fadeIn">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="team-search-mobile"
                type="text"
                placeholder="Search staff name, role, site..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-10 py-2.5 bg-[#041b0f] border border-[#44D62C]/40 rounded-xl text-xs text-white placeholder-gray-400 font-semibold outline-none focus:ring-2 focus:ring-[#44D62C]/30 shadow-md"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* App-Style Hero Map (48vh) */}
        <div className="p-3">
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-[#134426]/80">
            <TeamMapView
              members={filteredMembers}
              latestLocations={latestLocations}
              memberLocations={memberLocations}
              selectedLocation={selectedLocation}
              onLocationChange={loc => {
                hasManuallySelected.current = true;
                setSelectedLocation(loc);
              }}
              availableLocations={availableLocations}
              theme={theme}
              isMobile={true}
              isTablet={isTablet}
              focusedMemberId={focusedMemberId}
              onClearFocusedMember={() => setFocusedMemberId(null)}
            />
          </div>
        </div>

        {/* Bottom Sheet Styled Team Member Section */}
        <div className="flex-1 bg-[#072415] rounded-t-3xl border-t border-[#134426] px-3.5 pt-3 pb-8 space-y-3.5 shadow-2xl">
          {/* Drag Pill Handle */}
          <div className="w-10 h-1 bg-gray-600/70 rounded-full mx-auto mb-1" />

          {/* Quick Segmented Tabs & Admin Interval Pill */}
          <div className="flex items-center justify-between gap-2">
            {/* Segmented Tabs */}
            <div className="flex items-center bg-[#041b0f] p-1 rounded-xl border border-[#134426]">
              <button
                type="button"
                onClick={() => setMobileTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mobileTab === 'all'
                    ? 'bg-[#065f46] text-white shadow-sm border border-white/10'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All Staff ({filteredMembers.length})
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('active')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mobileTab === 'active'
                    ? 'bg-[#065f46] text-white shadow-sm border border-white/10'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active ({activeMembersCount})
              </button>
            </div>

            {/* Admin Tracking Interval Compact Pill */}
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setShowIntervalModal(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#041b0f] border border-[#134426] hover:border-[#44D62C]/40 rounded-xl text-xs font-bold text-gray-300 transition-all cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <span>{trackingInterval}m</span>
              </button>
            )}
          </div>

          {/* Collapsible Admin Interval Editor Bar */}
          {showIntervalModal && user?.role === 'admin' && (
            <div className="bg-[#092c19] border border-[#134426] p-3 rounded-2xl space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> GPS Tracking Interval (mins)
                </span>
                <button
                  type="button"
                  onClick={() => setShowIntervalModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={trackingInterval}
                  onChange={e => setTrackingInterval(parseInt(e.target.value) || 15)}
                  className="w-20 px-3 py-1.5 bg-[#041b0f] border border-[#134426] text-white text-center text-xs font-bold rounded-xl outline-none focus:border-[#44D62C]"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateInterval();
                    setShowIntervalModal(false);
                  }}
                  disabled={isUpdatingInterval}
                  className="flex-1 py-1.5 bg-[#065f46] hover:bg-[#044e39] text-white font-bold text-xs rounded-xl shadow-md border border-white/10 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingInterval ? 'Saving...' : 'Save Interval'}
                </button>
              </div>
            </div>
          )}

          {/* Pending Unlock Requests */}
          {unlockRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-black text-amber-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" /> Pending Unlocks ({unlockRequests.length})
              </h2>
              <div className="space-y-2.5">
                {unlockRequests.map(req => (
                  <div key={req.id} className="bg-[#fffdf6] rounded-2xl border border-amber-100/50 p-3.5 shadow-md space-y-2.5 text-black">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center font-black text-amber-700 overflow-hidden relative border border-amber-200 shrink-0">
                        {req.userName.charAt(0)}
                        {req.userPhoto && (
                          <img
                            src={req.userPhoto}
                            alt={req.userName}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{req.userName}</p>
                        <p className="text-[10px] text-amber-700 font-semibold">{formatDistanceToNow(new Date(req.requestedAt))} ago</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-700 italic bg-white p-2 rounded-xl border border-amber-50">"{req.reason}"</p>
                    <div className="flex gap-2 pt-1 border-t border-gray-100">
                      <button
                        onClick={() => handleRespondToUnlock(req.id, 'approved')}
                        className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleRespondToUnlock(req.id, 'rejected')}
                        className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member Cards List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-[#1A2819] animate-pulse rounded-2xl border border-[#2B3E2A]/30" />
              ))}
            </div>
          ) : displayedMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 bg-[#1A2819]/50 rounded-2xl border border-dashed border-[#2B3E2A]/30">
              <UserIcon className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">No personnel found in this category.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedMembers
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map(member => {
                  const loc = latestLocations[member.id];
                  const userLocInfo = memberLocations[member.id];
                  const locationDisplay = userLocInfo ? `${userLocInfo.city}, ${userLocInfo.state}` : (member.locationName || member.location);
                  const isUserActive = loc && isToday(new Date(loc.timestamp));
                  const phone = (member.phone || '').replace(/\D/g, '');
                  const assignedFacility = member.societyName || member.organizationName;

                  return (
                    <div
                      key={member.id}
                      className="bg-[#102418] border border-[#1e442c] rounded-2xl p-3.5 shadow-sm space-y-2.5 transition-all hover:border-emerald-500/50"
                    >
                      {/* Member Info Row */}
                      <Link
                        to={`/my-team/${member.id}`}
                        className="flex items-center gap-3 no-underline text-white"
                      >
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-base ring-2 ring-[#041b0f] overflow-hidden relative">
                            <ProfilePlaceholder
                              photoUrl={member.photoUrl}
                              seed={member.name}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#102418] z-20 ${
                            isUserActive
                              ? 'bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'
                              : 'bg-red-500 shadow-[0_0_6px_rgba(239,44,44,0.6)]'
                          }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="font-bold text-white text-xs sm:text-sm truncate">
                              {member.name}
                            </h3>
                            <ChevronRight className="w-3.5 h-3.5 text-emerald-500 shrink-0 opacity-70" />
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-gray-400 truncate mt-0.5">
                            {member.role.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          </p>

                          {/* Assigned Facility Site Badge */}
                          {assignedFacility && (
                            <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-800/60 text-[9px] font-bold text-emerald-400 max-w-full truncate">
                              <span>🏢 {assignedFacility}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                            <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">
                              {loc
                                ? `Active ${formatDistanceToNow(new Date(loc.timestamp))} ago`
                                : 'No recent activity'
                              }
                            </span>
                          </div>
                        </div>
                      </Link>

                      {/* Quick Action Buttons Row */}
                      <div className="pt-2 border-t border-[#1a3825] flex items-center gap-2">
                        {/* 1-Tap Locate On Map */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFocusedMemberId(member.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                        >
                          <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Locate Pin</span>
                        </button>

                        {/* WhatsApp Button */}
                        {phone && (
                          <a
                            href={`https://wa.me/91${phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366] py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all no-underline shadow-sm active:scale-95"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            <span>WhatsApp</span>
                          </a>
                        )}

                        {/* Directions Button */}
                        {loc && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/40 text-blue-400 py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all no-underline shadow-sm active:scale-95"
                          >
                            <Navigation className="w-3 h-3 text-blue-400" />
                            <span>Directions</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}

              {/* Mobile Pagination */}
              {displayedMembers.length > pageSize && (
                <div className="flex justify-between items-center bg-[#102418] border border-[#1e442c] p-2.5 rounded-2xl mt-3 text-xs font-bold">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 bg-[#1a3825] text-white rounded-xl border border-[#2B3E2A]/30 disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <span className="text-gray-300 text-[11px]">
                    Page {currentPage} of {Math.ceil(displayedMembers.length / pageSize)}
                  </span>
                  <button
                    disabled={currentPage >= Math.ceil(displayedMembers.length / pageSize)}
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(displayedMembers.length / pageSize), prev + 1))}
                    className="px-3 py-1.5 bg-[#1a3825] text-white rounded-xl border border-[#2B3E2A]/30 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-full w-full bg-background ${isTablet ? 'p-2' : 'p-6 md:p-8'} space-y-6 pb-24`}>
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
                onChange={(e) => {
                  hasManuallySelected.current = true;
                  setSelectedLocation(e.target.value);
                }}
                className="w-full sm:w-48 px-3 py-2 bg-card border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all text-sm appearance-none cursor-pointer"
              >
                <option value="All">All Locations</option>
                {Object.entries(availableLocations).flatMap(([state, cities]) => [
                  <option key={`state-${state}`} value={`state:${state}`} className="font-bold text-accent">All {state}</option>,
                  ...(cities as string[]).map(city => (
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
      <TeamMapView
        members={filteredMembers}
        latestLocations={latestLocations}
        memberLocations={memberLocations}
        selectedLocation={selectedLocation}
        onLocationChange={loc => {
          hasManuallySelected.current = true;
          setSelectedLocation(loc);
        }}
        availableLocations={availableLocations}
        theme={theme}
        isMobile={false}
        isTablet={isTablet}
        focusedMemberId={focusedMemberId}
        onClearFocusedMember={() => setFocusedMemberId(null)}
      />

 
      {/* Team List Header */}
      <div id="team-members-list" className={`${isTablet ? 'mt-4 px-2' : 'flex items-center justify-between mt-4 px-2'}`}>
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFocusedMemberId(member.id);
                        document.querySelector('.paradigm-map-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold transition-all cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Locate on Map</span>
                    </button>
                    <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>View Profile</span>
                      <ChevronRight className="w-4 h-4" />
                    </span>
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
    </div>
  );
};
 
export default MyTeamPage;
