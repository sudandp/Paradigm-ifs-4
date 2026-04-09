import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../../services/api';
import type { AttendanceEvent, User, Location, RoutePoint, Role } from '../../types';
import { Loader2, MapPin, List, Map as MapIcon, Route as RouteIcon, Calendar, Users, ChevronRight, ExternalLink, Clock, Filter, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import DatePicker from '../../components/ui/DatePicker';
import Select from '../../components/ui/Select';
import L from 'leaflet';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useThemeStore } from '../../store/themeStore';
import { reverseGeocode } from '../../utils/locationUtils';
import Pagination from '../../components/ui/Pagination';
import { motion, AnimatePresence } from 'framer-motion';
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';

// --- Constants & Helpers ---

const getEventLabel = (type: string, workType?: 'office' | 'field'): string => {
    if (workType === 'field') {
        const fieldLabels: Record<string, string> = {
            'punch-in': 'Check-In',
            'punch-out': 'Check-Out',
            'break-in': 'Break-In',
            'break-out': 'Break-Out',
        };
        return fieldLabels[type] || type.replace('-', ' ');
    }
    const officeLabels: Record<string, string> = {
        'punch-in': 'Punch-In',
        'punch-out': 'Punch-Out',
        'break-in': 'Break-In',
        'break-out': 'Break-Out',
    };
    return officeLabels[type] || type.replace('-', ' ');
};

const getEventColor = (type: string) => {
    switch (type) {
        case 'punch-in': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        case 'punch-out': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        case 'break-in': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        case 'break-out': return 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
        default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
};

// --- Sub-components ---

const ResolveAddress: React.FC<{ lat: number, lng: number, fallback?: string | null, knownLocations: Location[] }> = ({ lat, lng, fallback, knownLocations }) => {
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const knownLocationName = useMemo(() => {
        if (!lat || !lng || knownLocations.length === 0) return null;
        const sortedLocations = [...knownLocations].sort((a, b) => a.radius - b.radius);
        for (const loc of sortedLocations) {
            const distance = L.latLng(lat, lng).distanceTo(L.latLng(loc.latitude, loc.longitude));
            if (distance <= loc.radius) return loc.name;
        }
        return null;
    }, [lat, lng, knownLocations]);

    useEffect(() => {
        if (knownLocationName) {
            setResolvedAddress(knownLocationName);
            return;
        }
        const resolve = async () => {
            const isGenericFallback = !fallback || fallback.includes('GPS') || fallback.includes('Location');
            const needsResolution = (lat !== 0 && lng !== 0) && isGenericFallback;
            if (!needsResolution) {
                setResolvedAddress(fallback || null);
                return;
            }
            try {
                setLoading(true);
                const address = await reverseGeocode(lat, lng);
                setResolvedAddress(address);
            } catch (err) {
                setResolvedAddress(fallback || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            } finally {
                setLoading(false);
            }
        };
        resolve();
    }, [lat, lng, fallback, knownLocationName]);

    if (loading) return <span className="animate-pulse text-accent/50 font-mono text-[10px]">RESOLVING ADDRESS...</span>;
    return <span className="text-primary-text font-medium leading-relaxed">{resolvedAddress || fallback || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</span>;
};

const MapView: React.FC<{ events: (AttendanceEvent & { userName: string })[], users: User[] }> = ({ events, users }) => {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<L.LayerGroup>(L.layerGroup());
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const { theme } = useThemeStore();

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, { zoomControl: false }).setView([12.9716, 77.5946], 12);
            markersRef.current.addTo(mapRef.current);
            L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
        }
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;
        const isDark = theme === 'dark';
        const tileUrl = isDark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        if (tileLayerRef.current) tileLayerRef.current.setUrl(tileUrl);
        else tileLayerRef.current = L.tileLayer(tileUrl).addTo(mapRef.current);
    }, [theme]);

    useEffect(() => {
        markersRef.current.clearLayers();
        const latestUserLocations = new Map<string, AttendanceEvent & { userName: string }>();
        events.forEach(event => {
            if (event.latitude && event.longitude) {
                const existingEvent = latestUserLocations.get(event.userId);
                if (!existingEvent || new Date(event.timestamp) > new Date(existingEvent.timestamp)) {
                    latestUserLocations.set(event.userId, event);
                }
            }
        });

        const userMap = new Map<string, User>(users.map(u => [u.id, u]));
        const markerInstances: L.Marker[] = [];

        latestUserLocations.forEach((event) => {
            const user = userMap.get(event.userId);
            if (user && event.latitude && event.longitude) {
                const customIcon = L.divIcon({
                    className: '',
                    html: `<div class="surgical-marker">
                             <div class="marker-avatar" style="background-image: url(${user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`})"></div>
                           </div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                    popupAnchor: [0, -20]
                });

                const marker = L.marker([event.latitude, event.longitude], { icon: customIcon });
                marker.bindPopup(`<div class="p-2 font-sans">
                                    <p class="font-bold text-slate-900">${user.name}</p>
                                    <p class="text-xs text-slate-500">${format(new Date(event.timestamp), 'hh:mm a')}</p>
                                  </div>`);
                markersRef.current.addLayer(marker);
                markerInstances.push(marker);
            }
        });

        if (markerInstances.length > 0 && mapRef.current) {
            const group = L.featureGroup(markerInstances);
            mapRef.current.fitBounds(group.getBounds().pad(0.5));
        }
    }, [events, users]);

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="relative overflow-hidden border-2 border-border/50 shadow-2xl"
            style={{ height: '600px', borderRadius: '4px' }}
        >
            <div ref={mapContainerRef} className="h-full w-full grayscale-[0.2] contrast-[1.1]" />
            <div className="absolute top-4 left-4 z-[400] bg-slate-900/80 backdrop-blur-md px-3 py-1.5 border border-white/10 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-white tracking-widest uppercase">Live Oversight Active</span>
            </div>
        </motion.div>
    );
};

const RouteView: React.FC<{ events: (AttendanceEvent & { userName: string })[], selectedUser: string, startDate: string, endDate: string }> = ({ events, selectedUser, startDate, endDate }) => {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const markersRef = useRef<L.LayerGroup>(L.layerGroup());
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const { theme } = useThemeStore();
    const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);

    const userEvents = useMemo(() => {
        return events
            .filter(e => e.userId === selectedUser && e.latitude && e.longitude)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [events, selectedUser]);

    useEffect(() => {
        if (!selectedUser || selectedUser === 'all') return;
        
        const fetchRoute = async () => {
            setIsLoadingRoute(true);
            try {
                const start = new Date(startDate);
                start.setHours(0,0,0,0);
                const end = new Date(endDate);
                end.setHours(23,59,59,999);
                const points = await api.getRoutePoints(selectedUser, start.toISOString(), end.toISOString());
                setRoutePoints(points);
            } catch (error) {
                console.error("Failed to fetch route points:", error);
            } finally {
                setIsLoadingRoute(false);
            }
        };
        fetchRoute();
    }, [selectedUser, startDate, endDate]);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, { zoomControl: false }).setView([12.9716, 77.5946], 12);
            markersRef.current.addTo(mapRef.current);
            L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
        }
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;
        const isDark = theme === 'dark';
        const tileUrl = isDark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        if (tileLayerRef.current) tileLayerRef.current.setUrl(tileUrl);
        else tileLayerRef.current = L.tileLayer(tileUrl).addTo(mapRef.current);
    }, [theme]);

    useEffect(() => {
        if (!mapRef.current) return;
        markersRef.current.clearLayers();
        if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);

        // Draw High-Frequency Route
        const routeLatLngs: L.LatLngTuple[] = routePoints.map(p => [p.latitude, p.longitude]);
        if (routeLatLngs.length > 0) {
            polylineRef.current = L.polyline(routeLatLngs, { 
                color: '#3B82F6', 
                weight: 5, 
                opacity: 0.8,
                smoothFactor: 1.5 
            }).addTo(mapRef.current);
            
            // Add subtle pulse dots for every point but not too many
            routeLatLngs.forEach((pos, idx) => {
                if (idx % 5 === 0) { // Every 5th point for performance
                    const dot = L.circleMarker(pos, {
                        radius: 3,
                        fillColor: '#3B82F6',
                        fillOpacity: 0.5,
                        stroke: false
                    });
                    markersRef.current.addLayer(dot);
                }
            });
        }

        // Draw Attendance Events as distinct markers
        userEvents.forEach((e) => {
            const pos: L.LatLngTuple = [e.latitude as number, e.longitude as number];
            const color = e.type === 'punch-in' ? '#10B981' : e.type === 'punch-out' ? '#EF4444' : '#F59E0B';
            const icon = L.divIcon({
                className: '',
                html: `<div class="w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center" style="background-color: ${color}; color: white">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      </div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const marker = L.marker(pos, { icon });
            marker.bindPopup(`<div class="p-2">
                <p class="font-bold uppercase text-[10px] text-slate-500 tracking-widest">${getEventLabel(e.type, e.workType)}</p>
                <p class="text-sm font-black text-slate-800">${format(new Date(e.timestamp), 'hh:mm a')}</p>
                <p class="text-[10px] text-slate-400 mt-1">${e.locationName || 'GPS Location'}</p>
            </div>`);
            markersRef.current.addLayer(marker);
        });

        if (routeLatLngs.length > 0 && mapRef.current) {
            mapRef.current.fitBounds(polylineRef.current!.getBounds().pad(0.2));
        } else if (userEvents.length > 0 && mapRef.current) {
            const group = L.featureGroup(userEvents.map(e => L.marker([e.latitude!, e.longitude!])));
            mapRef.current.fitBounds(group.getBounds().pad(0.2));
        }
    }, [routePoints, userEvents]);

    return (
        <div className="relative group">
            {isLoadingRoute && (
                <div className="absolute inset-0 z-[500] bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                    <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Plotting Trajectory</span>
                </div>
            )}
            <div ref={mapContainerRef} style={{ height: '600px', width: '100%', borderRadius: '4px', zIndex: 0, border: '2px solid rgba(0,0,0,0.05)' }} />
            <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/90 backdrop-blur-md p-3 border border-white/10 rounded-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="h-1 w-6 bg-blue-500 rounded-full" />
                        <span className="text-[9px] font-bold text-white uppercase tracking-tighter">Movement Path</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-emerald-500 rounded-full border-2 border-white" />
                        <span className="text-[9px] font-bold text-white uppercase tracking-tighter">Check-In</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-rose-500 rounded-full border-2 border-white" />
                        <span className="text-[9px] font-bold text-white uppercase tracking-tighter">Check-Out</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ActivityItem: React.FC<{ 
    event: (AttendanceEvent & { userName: string, userPhoto?: string | null, userRole?: string }), 
    isFirst: boolean, 
    isLast: boolean, 
    knownLocations: Location[],
    onSelect: (userId: string) => void 
}> = ({ event, isFirst, isLast, knownLocations, onSelect }) => {
    const badgeStyles = getEventColor(event.type);
    
    return (
        <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="group relative flex gap-6 pb-8 last:pb-0"
        >
            {/* Timeline Line */}
            <div className="absolute left-[23px] top-[48px] bottom-0 w-[1px] bg-border group-last:hidden" />
            
            {/* Meta / Time */}
            <div className="w-20 pt-2 flex flex-col items-end flex-shrink-0">
                <span className="text-[14px] font-mono font-bold text-primary-text tracking-tighter">
                    {format(new Date(event.timestamp), 'HH:mm')}
                </span>
                <span className="text-[10px] font-bold text-muted tracking-widest uppercase">
                    {format(new Date(event.timestamp), 'dd MMM')}
                </span>
            </div>

            {/* Avatar Junction */}
            <div className="relative z-10 pt-1">
                <div className="h-[48px] w-[48px] rounded-full border-2 border-page bg-card shadow-lg p-0.5 transition-transform group-hover:scale-110">
                    <ProfilePlaceholder 
                        photoUrl={event.userPhoto || undefined} 
                        seed={event.userName}
                        className="h-full w-full rounded-full object-cover shadow-inner"
                    />
                </div>
                {isFirst && <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-page" title="Current Session" />}
            </div>

            {/* Content Card */}
            <div className="flex-1 bg-card border border-border shadow-sm group-hover:shadow-md transition-all duration-300 p-4 relative overflow-hidden">
                {/* Decorative Side Tab */}
                <div className={`absolute top-0 left-0 bottom-0 w-1 ${badgeStyles.split(' ')[0].replace('text-', 'bg-')}`} />
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                <h4 className="text-sm font-black text-primary-text uppercase tracking-tight">{event.userName}</h4>
                                <span className={`px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border ${badgeStyles}`}>
                                    {getEventLabel(event.type, event.workType)}
                                </span>
                            </div>
                            {event.userRole && (
                                <span className="text-[10px] font-bold text-muted uppercase tracking-wider mt-0.5">
                                    {event.userRole}
                                </span>
                            )}
                        </div>
                        <div className="flex items-start gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-muted mt-0.5" />
                            <div className="text-xs text-primary-text max-w-md">
                                <ResolveAddress 
                                    lat={event.latitude || 0} 
                                    lng={event.longitude || 0} 
                                    fallback={event.locationName} 
                                    knownLocations={knownLocations} 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                        {event.latitude && event.longitude && (
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 px-3 rounded-sm border border-border bg-page hover:bg-slate-50 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary-text transition-colors"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Inspect Position
                            </a>
                        )}
                        <button 
                            onClick={() => onSelect(event.userId)}
                            className="h-8 w-8 rounded-sm border border-border flex items-center justify-center text-muted hover:text-primary-text hover:bg-page transition-colors"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// --- Main Component ---

const FieldStaffTracking: React.FC = () => {
    const [viewMode, setViewMode] = useState<'list' | 'map' | 'route'>('list');
    const [events, setEvents] = useState<AttendanceEvent[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
    const [knownLocations, setKnownLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedUser, setSelectedUser] = useState<string>('all');
    const [selectedRole, setSelectedRole] = useState<string>('all');

    // Temporary states for "Apply Filter" logic
    const [tempUser, setTempUser] = useState<string>('all');
    const [tempRole, setTempRole] = useState<string>('all');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const isMobile = useMediaQuery('(max-width: 767px)');
    
    // Map of role IDs (snake_case from API) to Display Names
    const roleLabelsMap = useMemo(() => {
        const labels: Record<string, string> = {};
        availableRoles.forEach(r => {
            const slug = r.id.toLowerCase().replace(/\s+/g, '_');
            labels[slug] = r.displayName;
        });
        return labels;
    }, [availableRoles]);

    const trackingRoleSlugs = useMemo(() => {
        return availableRoles.map(r => r.id.toLowerCase().replace(/\s+/g, '_'));
    }, [availableRoles]);

    // All users that are in any project role, sorted A-Z
    const trackingUsers = useMemo(() => {
        return users
            .filter(u => trackingRoleSlugs.includes(u.role))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [users, trackingRoleSlugs]);

    // Users available for selection based on the TEMPORARY role filter
    const selectableUsers = useMemo(() => {
        if (tempRole === 'all') return trackingUsers;
        return trackingUsers.filter(u => u.role === tempRole);
    }, [trackingUsers, tempRole]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const [eventsData, usersData, locationsData, rolesData] = await Promise.all([
                api.getAllAttendanceEvents(start.toISOString(), end.toISOString()),
                api.getUsers(),
                api.getLocations(),
                api.getRoles()
            ]);
            setEvents(eventsData);
            setUsers(usersData);
            setKnownLocations(locationsData);
            setAvailableRoles(rolesData);
        } catch (error) {
            console.error("Tracking Data Fetch Error", error);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredEvents = useMemo(() => {
        let results = events;
        
        // Filter by User
        if (selectedUser !== 'all') {
            results = results.filter(e => e.userId === selectedUser);
        } else if (selectedRole !== 'all') {
            // If no specific user but a role is selected, filter by all users in that role
            const roleUserIds = new Set(trackingUsers.filter(u => u.role === selectedRole).map(u => u.id));
            results = results.filter(e => roleUserIds.has(e.userId));
        } else {
            // Default: Filter by ALL tracking roles
            const trackingUserIds = new Set(trackingUsers.map(u => u.id));
            results = results.filter(e => trackingUserIds.has(e.userId));
        }

        const userMap = new Map<string, User>(users.map(u => [u.id, u]));
        return results.map(e => {
            const user = userMap.get(e.userId);
            return { 
                ...e, 
                userName: user?.name || 'System Operator',
                userPhoto: user?.photoUrl,
                userRole: user ? roleLabelsMap[user.role] : 'System Operator'
            };
        })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [events, users, trackingUsers, selectedUser, selectedRole]);

    const paginatedEvents = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredEvents.slice(start, start + pageSize);
    }, [filteredEvents, currentPage, pageSize]);

    useEffect(() => { setCurrentPage(1); }, [selectedUser, selectedRole, startDate, endDate, pageSize]);

    const handleApplyFilters = () => {
        setSelectedUser(tempUser);
        setSelectedRole(tempRole);
        setCurrentPage(1);
    };

    const handleBackToAll = () => {
        setSelectedUser('all');
        setSelectedRole('all');
        setTempUser('all');
        setTempRole('all');
        setViewMode('list');
        setCurrentPage(1);
    };

    return (
        <div className="space-y-8 p-4 md:p-0">
            {/* --- Command Bar (Floating Control Layer) --- */}
            <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-card border-x border-b border-border shadow-2xl p-6 relative overflow-hidden"
            >
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-indigo-500" />
                
                <div className="flex flex-col gap-6">
                    {/* Tier 1: Header Info & View Switcher */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-primary-text tracking-tight flex items-center gap-3">
                                {(selectedUser !== 'all' || selectedRole !== 'all') && (
                                    <button 
                                        onClick={handleBackToAll}
                                        className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all active:scale-90"
                                        title="Back to Overall View"
                                    >
                                        <ArrowLeft className="h-6 w-6" />
                                    </button>
                                )}
                                FIELD OPS TRACKING
                                <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-[10px] font-bold text-slate-500 border border-slate-200 uppercase tracking-[0.2em] animate-pulse">
                                    Active Monitor
                                </span>
                            </h2>
                            <p className="text-xs text-muted font-medium flex items-center gap-1.5 uppercase tracking-wide">
                                <Clock className="h-3 w-3" />
                                Real-time synchronization active • {filteredEvents.length} Signals Captured
                            </p>
                        </div>

                        <div className="bg-slate-100 p-1 rounded-sm flex items-center gap-1">
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                List View
                            </button>
                            <button 
                                onClick={() => setViewMode('map')}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Map View
                            </button>
                            <button 
                                onClick={() => setViewMode('route')}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'route' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Route View
                            </button>
                        </div>
                    </div>

                    {/* Tier 2: Filter Controls */}
                    <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border/50">
                        <div className="flex items-center gap-2 bg-page p-1 border border-border shadow-inner">
                            <div className="flex items-center gap-1 px-2 border-r border-border text-muted">
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="text-[9px] font-bold uppercase hidden lg:inline">Range</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent border-none text-[11px] font-bold text-primary-text focus:ring-0 p-1"
                                />
                                <span className="text-muted text-[10px] px-1">—</span>
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent border-none text-[11px] font-bold text-primary-text focus:ring-0 p-1"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-page p-1 border border-border shadow-inner min-w-[200px] flex-1 md:flex-initial">
                            <div className="flex items-center gap-1 px-2 border-r border-border text-muted">
                                <Users className="h-3.5 w-3.5" />
                                <span className="text-[9px] font-bold uppercase hidden lg:inline">Role</span>
                            </div>
                            <select 
                                value={tempRole} 
                                onChange={(e) => {
                                    setTempRole(e.target.value);
                                    setTempUser('all');
                                }}
                                className="flex-1 bg-transparent border-none text-xs font-bold text-primary-text focus:ring-0 p-1"
                            >
                                <option value="all">ALL PROJECT ROLES</option>
                                {availableRoles.map(role => {
                                    const slug = role.id.toLowerCase().replace(/\s+/g, '_');
                                    return (
                                        <option key={role.id} value={slug}>{role.displayName}</option>
                                    );
                                })}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-page p-1 border border-border shadow-inner min-w-[250px] flex-1 md:flex-initial">
                            <div className="flex items-center gap-1 px-2 border-r border-border text-muted">
                                <List className="h-3.5 w-3.5" />
                                <span className="text-[9px] font-bold uppercase hidden lg:inline">Name</span>
                            </div>
                            <select 
                                value={tempUser} 
                                onChange={(e) => setTempUser(e.target.value)}
                                className="flex-1 bg-transparent border-none text-xs font-bold text-primary-text focus:ring-0 p-1"
                            >
                                <option value="all">ALL AGENTS (A-Z)</option>
                                {selectableUsers.map(u => <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>)}
                            </select>
                        </div>

                        <button
                            onClick={handleApplyFilters}
                            className="h-9 px-6 ml-auto bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 rounded-sm"
                        >
                            <Filter className="h-3 w-3" />
                            Apply Filter
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* --- Data Stream Content --- */}
            <div className="relative min-h-[400px]">
                {isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                        <span className="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase">Synchronizing Stream</span>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {viewMode === 'list' && (
                            <motion.div 
                                key="list"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-2 pb-12"
                            >
                                {paginatedEvents.length === 0 ? (
                                    <div className="flex flex-col items-center py-20 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-sm">
                                        <p className="text-slate-400 font-black tracking-widest uppercase">No Signals Detected in this range</p>
                                    </div>
                                ) : (
                                    <div className="pl-0 md:pl-8">
                                        {paginatedEvents.map((event, idx) => (
                                            <ActivityItem 
                                                key={event.id} 
                                                event={event} 
                                                isFirst={currentPage === 1 && idx === 0}
                                                isLast={idx === paginatedEvents.length - 1}
                                                knownLocations={knownLocations}
                                                onSelect={(userId) => {
                                                    setSelectedUser(userId);
                                                    setTempUser(userId);
                                                    setViewMode('list');
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {filteredEvents.length > pageSize && (
                                    <div className="mt-12 pt-8 border-t border-border">
                                        <Pagination
                                            currentPage={currentPage}
                                            totalItems={filteredEvents.length}
                                            pageSize={pageSize}
                                            onPageChange={setCurrentPage}
                                            onPageSizeChange={setPageSize}
                                        />
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {viewMode === 'map' && (
                            <MapView key="map" events={filteredEvents} users={users} />
                        )}

                        {viewMode === 'route' && (
                            <motion.div 
                                key="route"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                {selectedUser === 'all' ? (
                                    <div className="flex flex-col items-center py-40 border-2 border-dashed border-border">
                                        <RouteIcon className="h-12 w-12 text-slate-200 mb-4" />
                                        <p className="text-slate-400 font-black tracking-widest uppercase text-xs">Awaiting Agent Selection for Route Analysis</p>
                                    </div>
                                ) : (
                                    <RouteView events={filteredEvents} selectedUser={selectedUser} startDate={startDate} endDate={endDate} />
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
            
            {/* Global Visual Background Elements */}
            <div className="fixed inset-0 pointer-events-none z-[-1] opacity-[0.03] overflow-hidden grayscale">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] border border-slate-900 rounded-full -mr-64 -mt-64" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] border border-slate-900 rounded-full -ml-32 -mb-32" />
            </div>
        </div>
    );
};

export default FieldStaffTracking;