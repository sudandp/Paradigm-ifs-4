import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../../services/api';
import type { AttendanceEvent, User, Location } from '../../types';
import { Loader2, MapPin, List, Map as MapIcon, Route as RouteIcon } from 'lucide-react';
import { format } from 'date-fns';
import DatePicker from '../../components/ui/DatePicker';
import Select from '../../components/ui/Select';
import L from 'leaflet';
import Button from '../../components/ui/Button';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useThemeStore } from '../../store/themeStore';
import { reverseGeocode } from '../../utils/locationUtils';
import Pagination from '../../components/ui/Pagination';
import LoadingScreen from '../../components/ui/LoadingScreen';


// Maps raw event type strings to user-friendly display labels.
// Uses the workType field to distinguish office ("Punch In/Out") from
// field ("Check In/Out") events. Break events are labelled uniformly.
const getEventLabel = (type: string, workType?: 'office' | 'field'): string => {
    if (workType === 'field') {
        const fieldLabels: Record<string, string> = {
            'punch-in': 'Check In',
            'punch-out': 'Check Out',
            'break-in': 'Break In',
            'break-out': 'Break Out',
        };
        return fieldLabels[type] || type.replace('-', ' ');
    }
    // Default (office / undefined workType) → "Punch In" / "Punch Out"
    const officeLabels: Record<string, string> = {
        'punch-in': 'Punch In',
        'punch-out': 'Punch Out',
        'break-in': 'Break In',
        'break-out': 'Break Out',
    };
    return officeLabels[type] || type.replace('-', ' ');
};

// Helper component to resolve GPS coordinates into a text address
const ResolveAddress: React.FC<{ lat: number, lng: number, fallback?: string | null, knownLocations: Location[] }> = ({ lat, lng, fallback, knownLocations }) => {
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Check if the current coordinates are within any known location's radius
    const knownLocationName = useMemo(() => {
        if (!lat || !lng || knownLocations.length === 0) return null;
        
        // Sort locations by radius (smallest first) to prioritize specific nested locations
        const sortedLocations = [...knownLocations].sort((a, b) => a.radius - b.radius);
        
        for (const loc of sortedLocations) {
            const distance = L.latLng(lat, lng).distanceTo(L.latLng(loc.latitude, loc.longitude));
            if (distance <= loc.radius) {
                return loc.name;
            }
        }
        return null;
    }, [lat, lng, knownLocations]);

    useEffect(() => {
        if (knownLocationName) {
            setResolvedAddress(knownLocationName);
            return;
        }

        const resolve = async () => {
            // If we have valid coordinates, we should always try to resolve unless the fallback is already a specific location name
            const isGenericFallback = !fallback || fallback.includes('GPS') || fallback.includes('Location');
            const needsResolution = (lat !== 0 && lng !== 0) && isGenericFallback;
            
            if (!needsResolution) {
                setResolvedAddress(fallback);
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

    if (loading) return <span className="animate-pulse text-accent/50">Resolving address...</span>;
    return <span>{resolvedAddress || fallback || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</span>;
};

// Map View Component
const MapView: React.FC<{ events: (AttendanceEvent & { userName: string })[], users: User[] }> = ({ events, users }) => {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<L.LayerGroup>(L.layerGroup());
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const { theme } = useThemeStore();

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, {
                zoomControl: false
            }).setView([12.9716, 77.5946], 12); // Bangalore
            markersRef.current.addTo(mapRef.current);
            L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
        }
        // Force resize for proper rendering
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;

        const isDark = theme === 'dark';
        const lightTile = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        const darkTile = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        const tileUrl = isDark ? darkTile : lightTile;

        const attribution = isDark
            ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

        if (tileLayerRef.current) {
            tileLayerRef.current.setUrl(tileUrl);
            mapRef.current.attributionControl.setPrefix(attribution);
        } else {
            tileLayerRef.current = L.tileLayer(tileUrl, { attribution }).addTo(mapRef.current);
        }
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

        latestUserLocations.forEach((event: AttendanceEvent & { userName: string }) => {
            const user = userMap.get(event.userId);
            if (user && event.latitude && event.longitude) {
                const customIcon = L.divIcon({
                    className: '', // leaflet adds its own, we style '.user-marker'
                    html: `<div class="user-marker" style="background-image: url(${user.photoUrl || `https://i.pravatar.cc/150?u=${user.id}`})"></div>`,
                    iconSize: [48, 48],
                    iconAnchor: [24, 56],
                    popupAnchor: [0, -56]
                });

                const marker = L.marker([event.latitude, event.longitude], { icon: customIcon });

                marker.bindPopup(`
                    <div class="user-marker-popup">
                        <p class="popup-name">${user.name}</p>
                        <p class="popup-time">Last seen: ${format(new Date(event.timestamp), 'hh:mm a')}</p>
                    </div>
                `);

                markersRef.current.addLayer(marker);
                markerInstances.push(marker);
            }
        });

        if (markerInstances.length > 0 && mapRef.current) {
            const group = L.featureGroup(markerInstances);
            mapRef.current.fitBounds(group.getBounds().pad(0.5));
        } else if (mapRef.current) {
            mapRef.current.setView([12.9716, 77.5946], 12); // Reset to Bangalore if no markers
        }

    }, [events, users]);




    return <div ref={mapContainerRef} style={{ height: '600px', width: '100%', borderRadius: '1rem', zIndex: 0 }} />;
};

// Route View Component
// Displays a polyline connecting all attendance events for the selected user across the current date range
const RouteView: React.FC<{ events: (AttendanceEvent & { userName: string })[], selectedUser: string }> = ({ events, selectedUser }) => {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const rectangleRef = useRef<L.Rectangle | null>(null);
    const markersRef = useRef<L.LayerGroup>(L.layerGroup());
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const { theme } = useThemeStore();

    // Filter events belonging to the selected user and with valid coordinates
    const userEvents = useMemo(() => {
        return events
            .filter(e => e.userId === selectedUser && e.latitude && e.longitude)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [events, selectedUser]);

    // Initialise the map once
    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, { zoomControl: false }).setView([12.9716, 77.5946], 12);
            markersRef.current.addTo(mapRef.current);
            L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
        }
        // Force resize for proper rendering
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }, []);

    // Update tile layer on theme change
    useEffect(() => {
        if (!mapRef.current) return;
        const isDark = theme === 'dark';
        const lightTile = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        const darkTile = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        const tileUrl = isDark ? darkTile : lightTile;
        const attribution = isDark
            ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

        if (tileLayerRef.current) {
            tileLayerRef.current.setUrl(tileUrl);
            mapRef.current.attributionControl.setPrefix(attribution);
        } else {
            tileLayerRef.current = L.tileLayer(tileUrl, { attribution }).addTo(mapRef.current);
        }
    }, [theme]);

    // Update the route polyline and bounding rectangle when userEvents changes
    useEffect(() => {
        if (!mapRef.current) return;
        // Clear previous layers
        markersRef.current.clearLayers();
        if (polylineRef.current) {
            mapRef.current.removeLayer(polylineRef.current);
            polylineRef.current = null;
        }
        if (rectangleRef.current) {
            mapRef.current.removeLayer(rectangleRef.current);
            rectangleRef.current = null;
        }

        if (userEvents.length === 0) {
            // No events: centre map on Bangalore and return
            mapRef.current.setView([12.9716, 77.5946], 12);
            return;
        }

        // Build LatLng array for polyline
        const latLngs: L.LatLngTuple[] = userEvents.map(e => [e.latitude as number, e.longitude as number]);
        // Create polyline
        polylineRef.current = L.polyline(latLngs, { color: '#00BFA6', weight: 4 }).addTo(mapRef.current);
        // Add markers at start and end points
        const start = latLngs[0];
        const end = latLngs[latLngs.length - 1];
        // Create simple circle markers for start and end points
        const startMarker = L.marker(start, {
            icon: L.divIcon({
                className: '',
                html: '<div style="width:16px;height:16px;border-radius:50%;background-color:#00BFA6;border:2px solid white;"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        });
        const endMarker = L.marker(end, {
            icon: L.divIcon({
                className: '',
                html: '<div style="width:16px;height:16px;border-radius:50%;background-color:#EF4444;border:2px solid white;"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        });
        markersRef.current.addLayer(startMarker);
        markersRef.current.addLayer(endMarker);
        // Compute bounding box
        let minLat = latLngs[0][0], maxLat = latLngs[0][0];
        let minLon = latLngs[0][1], maxLon = latLngs[0][1];
        latLngs.forEach(([lat, lon]) => {
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
        });
        const southWest: L.LatLngTuple = [minLat, minLon];
        const northEast: L.LatLngTuple = [maxLat, maxLon];
        rectangleRef.current = L.rectangle([southWest, northEast], { color: '#FFB700', weight: 2, fillOpacity: 0.1 }).addTo(mapRef.current);
        // Fit map to rectangle bounds with padding
        const bounds = L.latLngBounds(southWest, northEast);
        mapRef.current.fitBounds(bounds.pad(0.2));
    }, [userEvents]);

    return <div ref={mapContainerRef} style={{ height: '600px', width: '100%', borderRadius: '1rem', zIndex: 0 }} />;
};

const MobileActivityCard: React.FC<{ event: (AttendanceEvent & { userName: string }), knownLocations: Location[] }> = ({ event, knownLocations }) => (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="p-3 bg-page flex justify-between items-center">
            <span className="text-sm font-medium text-muted">User</span>
            <span className="font-semibold text-primary-text">{event.userName}</span>
        </div>
        <div className="p-3 space-y-3 text-sm">
            <div className="flex justify-between items-center">
                <span className="text-muted font-medium">Event</span>
                <span className="font-semibold text-primary-text">{getEventLabel(event.type, event.workType)}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-muted font-medium">Timestamp</span>
                <span className="text-primary-text">{format(new Date(event.timestamp), 'dd MMM, yy - hh:mm a')}</span>
            </div>
            <div className="flex justify-between items-start">
                <span className="text-muted font-medium">Location</span>
                <div className="flex flex-col items-end gap-1 text-right">
                    {event.latitude && event.longitude ? (
                        <div className="font-semibold text-primary-text">
                            <ResolveAddress 
                                lat={event.latitude} 
                                lng={event.longitude} 
                                fallback={event.locationName} 
                                knownLocations={knownLocations}
                            />
                        </div>
                    ) : event.locationName && (
                        <span className="font-semibold text-primary-text">{event.locationName}</span>
                    )}
                    {event.latitude && event.longitude ? (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-accent hover:underline text-xs">
                            <MapPin className="h-3 w-3 mr-1" /> View Map
                        </a>
                    ) : (!event.locationName && <span className="text-primary-text font-medium">-</span>)}
                </div>
            </div>
        </div>
    </div>
);


const FieldStaffTracking: React.FC = () => {
    // viewMode supports 'list', 'map' and 'route' (area/route coverage)
    const [viewMode, setViewMode] = useState<'list' | 'map' | 'route'>('list');
    const [events, setEvents] = useState<AttendanceEvent[]>([]);
    const [users, setUsers] = useState<User[]>([]); // Store all users
    const [knownLocations, setKnownLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedUser, setSelectedUser] = useState<string>('all');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const isMobile = useMediaQuery('(max-width: 767px)');
    const fieldStaff = useMemo(() => users.filter(u => u.role === 'field_staff'), [users]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const [eventsData, usersData, locationsData] = await Promise.all([
                api.getAllAttendanceEvents(start.toISOString(), end.toISOString()),
                api.getUsers(),
                api.getLocations()
            ]);
            setEvents(eventsData);
            setUsers(usersData);
            setKnownLocations(locationsData);
        } catch (error) {
            console.error("Failed to fetch tracking data", error);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredEvents = useMemo(() => {
        let results = events;
        if (selectedUser !== 'all') {
            results = results.filter(e => e.userId === selectedUser);
        }

        const userMap = new Map<string, User>(users.map(u => [u.id, u]));

        return results
            .map(event => ({
                ...event,
                userName: userMap.get(event.userId)?.name || 'Unknown User',
            }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [events, users, selectedUser]);

    const paginatedEvents = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredEvents.slice(startIndex, startIndex + pageSize);
    }, [filteredEvents, currentPage, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedUser, startDate, endDate, pageSize]);

    const usersWithActivity = useMemo(() => {
        const activeUserIds = new Set(filteredEvents.map(e => e.userId));
        return users.filter(u => activeUserIds.has(u.id));
    }, [filteredEvents, users]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
        }

        if (viewMode === 'map') {
            return <MapView events={filteredEvents} users={usersWithActivity} />;
        }
        if (viewMode === 'route') {
            // Require a specific user selection for route view.  If 'all' is selected, prompt the user.
            if (selectedUser === 'all') {
                return <div className="text-center py-10 text-muted">Please select a specific user to view their route coverage.</div>;
            }
            return <RouteView events={filteredEvents} selectedUser={selectedUser} />;
        }

        if (isMobile) {
            return (
                <div className="space-y-3">
                    {paginatedEvents.length === 0 ? (
                        <div className="text-center py-10 text-muted">No events found.</div>
                    ) : (
                        paginatedEvents.map((event) => <MobileActivityCard key={event.id} event={event} knownLocations={knownLocations} />)
                    )}
                </div>
            );
        }

        return (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border responsive-table">
                    <thead className="bg-page">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase" style={{width: '15%'}}>User</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase" style={{width: '12%'}}>Event</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase" style={{width: '18%'}}>Timestamp</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase" style={{width: '55%', maxWidth: '400px'}}>Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedEvents.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-10 text-muted">No events found.</td></tr>
                        ) : (
                            paginatedEvents.map((event) => (
                                <tr key={event.id}>
                                    <td data-label="User" className="px-6 py-4 font-medium" style={{width: '15%'}}>{event.userName}</td>
                                    <td data-label="Event" className="px-6 py-4" style={{width: '12%'}}>{getEventLabel(event.type, event.workType)}</td>
                                    <td data-label="Timestamp" className="px-6 py-4 text-sm text-muted" style={{width: '18%'}}>{format(new Date(event.timestamp), 'dd MMM, yyyy - hh:mm a')}</td>
                                    <td data-label="Location" className="px-6 py-4 text-sm text-muted" style={{width: '55%', maxWidth: '400px'}}>
                                        <div className="flex flex-col gap-1 break-words">
                                            {event.latitude && event.longitude ? (
                                                <div className="font-medium text-primary-text break-words">
                                                    <ResolveAddress 
                                                        lat={event.latitude} 
                                                        lng={event.longitude} 
                                                        fallback={event.locationName} 
                                                        knownLocations={knownLocations}
                                                    />
                                                </div>
                                            ) : event.locationName && (
                                                <span className="font-medium text-primary-text break-words">{event.locationName}</span>
                                            )}
                                            
                                            {event.latitude && event.longitude ? (
                                                <a href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-accent hover:underline text-xs flex-shrink-0">
                                                    <MapPin className="h-3 w-3 mr-1 flex-shrink-0" /> View Map
                                                </a>
                                            ) : (!event.locationName && '-')}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="p-4 border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card">
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <h2 className="text-2xl font-bold text-primary-text flex-shrink-0">User Activity Tracking</h2>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full flex-1 justify-end flex-wrap max-w-full">
                        <div className="w-full sm:w-32">
                            <DatePicker label="" id="start-date" value={startDate} onChange={setStartDate} />
                        </div>
                        <div className="w-full sm:w-32">
                            <DatePicker label="" id="end-date" value={endDate} onChange={setEndDate} />
                        </div>
                        <div className="w-full sm:w-40">
                            <Select label="" id="user-select" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                                <option value="all">All Users</option>
                                {fieldStaff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </Select>
                        </div>
                    </div>
                </div>
                <div className="mt-4">
                    <div className="bg-page p-1 rounded-full flex items-center flex-wrap w-full justify-start gap-1">
                        {/* List View Toggle */}
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1 text-sm font-semibold rounded-full flex items-center gap-2 transition-colors duration-200 ${viewMode === 'list' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-primary-text'
                                }`}
                        >
                            <List className="h-4 w-4" />
                            List View
                        </button>
                        {/* Map View Toggle */}
                        <button
                            onClick={() => setViewMode('map')}
                            className={`px-3 py-1 text-sm font-semibold rounded-full flex items-center gap-2 transition-colors duration-200 ${viewMode === 'map' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-primary-text'
                                }`}
                        >
                            <MapIcon className="h-4 w-4" />
                            Map View
                        </button>
                        {/* Route View Toggle */}
                        <button
                            onClick={() => setViewMode('route')}
                            className={`px-3 py-1 text-sm font-semibold rounded-full flex items-center gap-2 transition-colors duration-200 ${viewMode === 'route' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-primary-text'
                                }`}
                        >
                            <RouteIcon className="h-4 w-4" />
                            Route View
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-6">
                {renderContent()}
            </div>

            {viewMode === 'list' && !isLoading && filteredEvents.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalItems={filteredEvents.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                    className="mt-6"
                />
            )}
        </div>
    );
};

export default FieldStaffTracking;