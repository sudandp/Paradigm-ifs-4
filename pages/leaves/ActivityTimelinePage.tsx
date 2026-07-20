import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Footprints, Navigation } from 'lucide-react';
import { format } from 'date-fns';
import Button from '../../components/ui/Button';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatDistance, stepsToDistanceKm } from '../../utils/distanceUtils';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon path issues in React bundles
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});


export type DetailedActivityRecord = {
    dateStr: string;
    travelKm: number;
    travelDuration: number;
    steps: number;
    startTime: string | null;
    endTime: string | null;
    startLocation: string | null;
    endLocation: string | null;
};

const formatDuration = (mins: number): string => {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
};



export const ActivityTimelinePage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Safely parse state
    const state = location.state as { records?: DetailedActivityRecord[], type?: 'travel' | 'steps', userId?: string };
    const records = state?.records || [];
    const type = state?.type || 'travel';

    const [selectedDateForMap, setSelectedDateForMap] = useState<string | null>(null);
    const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
    const [isMapLoading, setIsMapLoading] = useState(false);
    const { user } = useAuthStore();
    const mapRef = useRef<HTMLDivElement | null>(null);
    const leafletMapRef = useRef<any>(null);

    const handleToggleMap = async (dateStr: string) => {
        if (selectedDateForMap === dateStr) {
            setSelectedDateForMap(null);
            setRouteCoords([]);
            return;
        }

        setSelectedDateForMap(dateStr);
        setIsMapLoading(true);
        setRouteCoords([]);

        try {
            const targetUserId = state?.userId || user?.id;
            if (!targetUserId) {
                console.error("No user ID found for fetching route history");
                return;
            }

            const { data, error } = await supabase
                .from('route_history')
                .select('latitude, longitude, timestamp')
                .eq('user_id', targetUserId)
                .gte('timestamp', dateStr + 'T00:00:00Z')
                .lte('timestamp', dateStr + 'T23:59:59Z')
                .order('timestamp', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                const coords: [number, number][] = data.map(pt => [pt.latitude, pt.longitude]);
                setRouteCoords(coords);
            }
        } catch (err) {
            console.error("Failed to fetch route history:", err);
        } finally {
            setIsMapLoading(false);
        }
    };

    useEffect(() => {
        // Only run when map element and coordinates are loaded
        if (!mapRef.current || routeCoords.length === 0) return;

        // Destroy existing map instance to prevent initialization conflicts
        if (leafletMapRef.current) {
            try {
                leafletMapRef.current.remove();
            } catch (err) {
                console.warn("Failed to destroy previous map:", err);
            }
            leafletMapRef.current = null;
        }

        try {
            // Initialize Leaflet Map
            const map = L.map(mapRef.current, {
                zoomControl: true,
                dragging: true,
                touchZoom: true
            }).setView(routeCoords[0], 14);
            
            leafletMapRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            // Draw route line
            const polyline = L.polyline(routeCoords, {
                color: '#10b981',
                weight: 4,
                opacity: 0.8
            }).addTo(map);

            // Fit map display area to polyline path bounds
            map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

            // Start marker
            L.marker(routeCoords[0]).addTo(map).bindPopup('Punch-In / Route Start');

            // End marker
            if (routeCoords.length > 1) {
                L.marker(routeCoords[routeCoords.length - 1]).addTo(map).bindPopup('Punch-Out / Route End');
            }
        } catch (err) {
            console.error("Failed to initialize Leaflet Map:", err);
        }

        // Cleanup map instance on unmount or coordinates refresh
        return () => {
            if (leafletMapRef.current) {
                try {
                    leafletMapRef.current.remove();
                } catch (ignored) {}
                leafletMapRef.current = null;
            }
        };
    }, [routeCoords]);


    return (
        <div className="min-h-screen bg-page p-4 md:p-6 pb-32">
            <header className="mb-6">
                <button onClick={() => navigate(-1)} className="flex items-center text-sm font-medium mb-4 text-muted-foreground hover:text-primary-text transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold text-primary-text flex items-center gap-2">
                    {type === 'travel' ? (
                        <><MapPin className="text-emerald-500 w-6 h-6" /> Monthly Travel Breakdown</>
                    ) : (
                        <><Footprints className="text-indigo-500 w-6 h-6" /> Monthly Footsteps Breakdown</>
                    )}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Detailed daily logs for the selected month.</p>
            </header>

            {!records || records.length === 0 ? (
                <div className="bg-card rounded-2xl p-8 border border-border text-center shadow-card">
                    <p className="text-muted-foreground mb-4">No records found or data was lost.</p>
                    <Button onClick={() => navigate('/leaves/dashboard')} variant="primary">
                        Return to Dashboard
                    </Button>
                </div>
            ) : (
                <div className="bg-card rounded-2xl p-4 md:p-6 shadow-card border border-border">
                    <div className="relative border-l-2 border-border/50 ml-3 md:ml-6 space-y-8 py-4">
                        {records.length === 0 ? (
                             <p className="text-center text-muted-foreground text-sm py-4">No records to display for this category.</p>
                        ) : (
                            records
                            .map((record) => (
                            <div key={record.dateStr} className="relative pl-6 md:pl-8">
                                <div className="absolute left-[-5px] top-1.5 w-3 h-3 rounded-full bg-accent ring-4 ring-card"></div>
                                <div className="mb-3 text-base font-bold text-primary-text">
                                    {format(new Date(record.dateStr), 'MMM dd, yyyy (EEEE)')}
                                </div>
                                <div className="bg-accent/5 rounded-xl p-4 md:p-5 border border-accent/10 shadow-sm space-y-4">
                                    
                                    {/* Location & Time Section - Only relevant for Travel since it spans the whole day's locations */}
                                    {type === 'travel' && (
                                        <>
                                        <div className="flex flex-col md:flex-row md:items-center gap-4 text-sm">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <span className="text-[10px] font-bold text-blue-600">IN</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-primary-text">{record.startTime ? format(new Date(record.startTime), 'hh:mm a') : 'N/A'}</p>
                                                        <p className="text-xs text-muted-foreground line-clamp-1" title={record.startLocation || ''}>{record.startLocation || 'Unknown Location'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="hidden md:flex flex-col items-center justify-center text-muted/30">
                                                <div className="h-px w-8 bg-border"></div>
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <span className="text-[10px] font-bold text-purple-600">OUT</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-primary-text">{record.endTime ? format(new Date(record.endTime), 'hh:mm a') : 'N/A'}</p>
                                                        <p className="text-xs text-muted-foreground line-clamp-1" title={record.endLocation || ''}>{record.endLocation || 'Unknown Location'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-px w-full bg-border/50"></div>
                                        </>
                                    )}

                                    {/* Metrics Section */}
                                    <div className="flex items-center gap-4 flex-wrap w-full">
                                        {type === 'travel' ? (
                                            record.travelKm > 0 ? (
                                                <>
                                                <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                                    <MapPin className="w-4 h-4 text-emerald-600" />
                                                    <span className="font-bold text-emerald-800 text-sm">{record.travelKm.toFixed(2)} KM</span>
                                                </div>
                                                {record.travelDuration > 0 && (
                                                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                                        <Clock className="w-4 h-4 text-blue-600" />
                                                        <span className="font-medium text-blue-800 text-sm">{formatDuration(record.travelDuration)}</span>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleMap(record.dateStr)}
                                                    className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors text-xs font-bold ml-auto shadow-sm"
                                                >
                                                    <Navigation className="w-3.5 h-3.5 text-gray-500" />
                                                    {selectedDateForMap === record.dateStr ? 'Hide Route' : 'Show Route'}
                                                </button>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                                    <MapPin className="w-4 h-4 text-gray-400" />
                                                    <span className="text-gray-500 text-sm italic">No GPS route data captured for this day</span>
                                                </div>
                                            )
                                        ) : record.steps > 0 ? (
                                            <>
                                            <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                                <Footprints className="w-4 h-4 text-indigo-600" />
                                                <span className="font-bold text-indigo-800 text-sm">{record.steps.toLocaleString()} steps</span>
                                            </div>
                                            {/* Walking distance = steps × 0.75m (avg stride). NOT GPS distance. */}
                                            <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                                <Navigation className="w-4 h-4 text-green-600" />
                                                <span className="font-medium text-green-800 text-sm">{formatDistance(stepsToDistanceKm(record.steps))}</span>
                                            </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                                <Footprints className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-500 text-sm italic">Step data not captured by app for this day</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Inline Map View */}
                                    {type === 'travel' && selectedDateForMap === record.dateStr && (
                                        <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden shadow-inner relative bg-gray-50/50">
                                            {isMapLoading ? (
                                                <div className="h-[250px] flex items-center justify-center text-gray-500 text-xs font-bold gap-2">
                                                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                                    Loading GPS trail...
                                                </div>
                                            ) : routeCoords.length === 0 ? (
                                                <div className="h-[120px] flex items-center justify-center text-gray-400 text-xs font-semibold">
                                                    No route history coordinates recorded for this date.
                                                </div>
                                            ) : (
                                                <div ref={mapRef} className="h-[250px] w-full z-10" />
                                            )}
                                        </div>
                                    )}
                                    
                                </div>
                            </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityTimelinePage;
