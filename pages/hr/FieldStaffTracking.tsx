import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../../services/api';
import type { AttendanceEvent, User, Location, RoutePoint, Role } from '../../types';
import { Loader2, MapPin, List, Map as MapIcon, Route as RouteIcon, Calendar, Users, ChevronRight, ExternalLink, Clock, Filter, ArrowLeft, Download, RefreshCw, History, Battery, Smartphone, Network, Globe, Monitor, Tablet } from 'lucide-react';
import { format } from 'date-fns';
import DatePicker from '../../components/ui/DatePicker';
import Select from '../../components/ui/Select';
import L from 'leaflet';
import { supabase } from '../../services/supabase';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useThemeStore } from '../../store/themeStore';
import { reverseGeocode, calculateDistanceMeters } from '../../utils/locationUtils';
import Pagination from '../../components/ui/Pagination';
import { motion, AnimatePresence } from 'framer-motion';
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';
import { useAuthStore } from '../../store/authStore';
import { isAdmin } from '../../utils/auth';

// --- Constants & Helpers ---

const getEventLabel = (type: string, workType?: 'office' | 'field' | 'site'): string => {
    if (workType === 'field' || workType === 'site') {
        const fieldLabels: Record<string, string> = {
            'punch-in': 'Check-In',
            'punch-out': 'Check-Out',
            'site-in': 'Site Entry',
            'site-out': 'Site Exit',
            'site-ot-in': 'Site OT Start',
            'site-ot-out': 'Site OT End',
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
        case 'punch-out': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
        case 'site-in': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        case 'site-out': return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
        case 'site-ot-in': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        case 'site-ot-out': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
        case 'break-in': return 'text-sky-500 bg-sky-500/10 border-sky-500/20';
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

// --- Logs View ---
const TrackingLogsView: React.FC<{ 
    startDate: string, 
    endDate: string,
    onViewOnMap: (userId: string) => void,
    onStatusResolved?: () => void  // Called when any PENDING log resolves — lets parent refresh route data
}> = ({ startDate, endDate, onViewOnMap, onStatusResolved }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getTrackingAuditLogs(startDate, endDate);
            setLogs(data);
        } catch (err) {
            console.error('Failed to fetch tracking logs:', err);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchLogs();

        // Real-time listener (best effort — may not fire if realtime not enabled for this table)
        const channelId = `logs_updates_${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelId)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'tracking_audit_logs' 
            }, (payload) => {
                console.log('[TrackingLogs] Realtime update received:', payload);
                fetchLogs();
            })
            .subscribe((status) => {
                console.log(`[TrackingLogs] Realtime subscription status: ${status}`);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchLogs, refreshKey]);

    // Surgical poll: only re-fetch statuses for PENDING rows by their IDs
    // This avoids re-rendering the entire table on every poll tick
    const fetchPendingStatuses = useCallback(async () => {
        const pendingIds = logs
            .filter(log => log.status === 'pending')
            .map(log => log.id);
        if (pendingIds.length === 0) return;

        try {
            const { data, error } = await supabase
                .from('tracking_audit_logs')
                .select('id, status')
                .in('id', pendingIds);

            if (error || !data) return;

            // Only update state if at least one status has changed — avoids unnecessary re-renders
            const updatedMap = new Map(data.map(row => [row.id, row.status]));
            const hasChange = pendingIds.some(id => updatedMap.get(id) !== 'pending');
            if (!hasChange) return;

            setLogs(prev => prev.map(log =>
                updatedMap.has(log.id)
                    ? { ...log, status: updatedMap.get(log.id) }
                    : log
            ));

            // Notify parent that a tracking request resolved — triggers silent GPS data refresh
            onStatusResolved?.();
        } catch (err) {
            console.error('[TrackingLogs] Failed to poll pending statuses:', err);
        }
    }, [logs, onStatusResolved]);

    // ✅ Auto-poll every 5 seconds when any log is still PENDING (surgical update — no table flash)
    useEffect(() => {
        const hasPending = logs.some(log => log.status === 'pending');
        if (!hasPending) return;

        const interval = setInterval(() => {
            fetchPendingStatuses();
        }, 5000);

        return () => clearInterval(interval);
    }, [logs, fetchPendingStatuses]);

    if (loading && refreshKey === 0) {
        return (
            <div className="flex flex-col items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border border-border shadow-sm overflow-hidden"
        >
            <div className="p-4 border-b border-border flex justify-end">
                <button onClick={() => setRefreshKey(k => k + 1)} className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase hover:text-slate-900 transition-colors">
                    Refresh Logs
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-border">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Requested At</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Admin</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Target Agent</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    No tracking logs found for this period
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-[11px] font-mono font-bold text-slate-700">
                                        {format(new Date(log.requestedAt), 'dd MMM yyyy, HH:mm:ss')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full overflow-hidden border border-border">
                                                <ProfilePlaceholder 
                                                    photoUrl={log.admin.photoUrl} 
                                                    seed={log.admin.name} 
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-900">{log.admin.name}</span>
                                                <span className="text-[9px] text-primary-600 font-black uppercase tracking-widest">{log.admin.role?.replace(/_/g, ' ')}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full overflow-hidden border border-border">
                                                <ProfilePlaceholder 
                                                    photoUrl={log.target.photoUrl} 
                                                    seed={log.target.name} 
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-900">{log.target.name}</span>
                                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{log.target.role?.replace(/_/g, ' ')}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                            log.status === 'successful' ? 'bg-emerald-100 text-emerald-700' :
                                            log.status === 'failed' ? 'bg-red-100 text-red-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {log.status === 'successful' && (
                                            <button
                                                onClick={() => onViewOnMap(log.targetUserId)}
                                                className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                                                title="View on Map"
                                            >
                                                <MapIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

const MapView: React.FC<{ 
    events: (AttendanceEvent & { userName: string })[], 
    users: User[], 
    selectedUser: string,
    knownLocations: Location[],
    liveRoutePoints: RoutePoint[], // Fresh GPS pings from parent state
    onSelectUser: (userId: string) => void
}> = ({ events, users, selectedUser, knownLocations, liveRoutePoints, onSelectUser }) => {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<L.LayerGroup>(L.layerGroup());
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const { theme } = useThemeStore();

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView([12.9716, 77.5946], 12);
            markersRef.current.addTo(mapRef.current);
            L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
        }
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;
        const isDark = theme === 'dark';
        const tileUrl = isDark 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            
        if (tileLayerRef.current) tileLayerRef.current.setUrl(tileUrl);
        else {
            tileLayerRef.current = L.tileLayer(tileUrl, {
                maxZoom: 22,
                maxNativeZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }).addTo(mapRef.current);
        }
        
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
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
                let resolvedPhotoUrl = user.photoUrl;
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

                const customIcon = L.divIcon({
                    className: '',
                    html: `<div class="surgical-marker">
                             <div class="marker-avatar" style="background-image: url(${resolvedPhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`})"></div>
                           </div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                    popupAnchor: [0, -20]
                });

                const marker = L.marker([event.latitude, event.longitude], { icon: customIcon });
                marker.on('click', () => onSelectUser(event.userId));
                
                // Create a container for the popup content to allow React to render ResolveAddress
                const popupContent = document.createElement('div');
                popupContent.className = 'p-2 font-sans min-w-[150px]';
                popupContent.innerHTML = `
                    <p class="font-black text-slate-900 uppercase text-[10px] tracking-widest border-b border-slate-100 pb-1 mb-1">${user.name}</p>
                    <p class="text-[10px] font-bold text-slate-400 mb-2">${format(new Date(event.timestamp), 'hh:mm:ss a')}</p>
                    <div id="address-${event.id}" class="text-[11px] font-bold text-slate-700 leading-tight">Resolving...</div>
                `;

                marker.bindPopup(popupContent);
                
                // Update address after popup opens
                marker.on('popupopen', async () => {
                    const addrDiv = document.getElementById(`address-${event.id}`);
                    if (addrDiv) {
                        const addr = await reverseGeocode(event.latitude!, event.longitude!);
                        addrDiv.innerText = addr;
                    }
                });

                markersRef.current.addLayer(marker);
                markerInstances.push(marker);
            }
        });

        if (markerInstances.length > 0 && mapRef.current) {
            const group = L.featureGroup(markerInstances);
            const bounds = group.getBounds();
            if (markerInstances.length === 1) {
                mapRef.current.setView(markerInstances[0].getLatLng(), 16);
            } else {
                mapRef.current.fitBounds(bounds.pad(0.5));
            }
        }
    }, [events, users, selectedUser]);

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="relative overflow-hidden border-2 border-border/50 shadow-2xl"
            style={{ height: '600px', borderRadius: '4px' }}
        >
            <div ref={mapContainerRef} className="h-full w-full grayscale-[0.2] contrast-[1.1]" />
            <div className="absolute top-4 right-4 z-[400] bg-slate-900/80 backdrop-blur-md px-3 py-1.5 border border-white/10 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-white tracking-widest uppercase">Live Oversight Active</span>
            </div>

            <div className="absolute bottom-4 right-4 z-[400] bg-slate-900/80 backdrop-blur-md p-3 border border-white/10 rounded-sm flex flex-col gap-2 min-w-[140px]">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">Punch In</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">Punch Out</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">Site Entry</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">Site OT</span>
                </div>
            </div>

            {/* Floating Detailed Metadata Card (Top Left Overlay) */}
            {selectedUser !== 'all' && (
                <div className="absolute top-4 left-4 z-[1000] w-80 pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-md p-4 border border-slate-200 rounded-sm shadow-2xl pointer-events-auto">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Signal Source</span>
                                <span className="text-xs font-black text-slate-900">
                                    {users.find(u => u.id === selectedUser)?.name || 'Field Staff'}
                                </span>
                            </div>
                            {(() => {
                                // Prefer liveRoutePoints timestamp (actual GPS ping) over attendance event
                                const latestRoutePoint = liveRoutePoints.length > 0
                                    ? liveRoutePoints[liveRoutePoints.length - 1]
                                    : null;
                                const lastEvent = latestRoutePoint || events
                                    .filter(e => e.userId === selectedUser && e.latitude && e.longitude)
                                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                
                                const isStale = lastEvent && (Date.now() - new Date(lastEvent.timestamp).getTime() > 5 * 60 * 1000);
                                
                                if (isStale) {
                                    return (
                                        <div className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest animate-pulse shadow-lg shadow-amber-500/20">
                                            Stale Signal
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                                <MapPin className="h-5 w-5 text-blue-600 animate-pulse" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Captured At</span>
                                <span className="text-xs font-black text-slate-700">
                                    {(() => {
                                        // Always show the latest GPS ping time (route_history), not the attendance event time
                                        const latestRoutePoint = liveRoutePoints.length > 0
                                            ? liveRoutePoints[liveRoutePoints.length - 1]
                                            : null;
                                        const lastEvent = latestRoutePoint || events
                                            .filter(e => e.userId === selectedUser && e.latitude && e.longitude)
                                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                        return lastEvent ? format(new Date(lastEvent.timestamp), 'HH:mm:ss, dd MMM yyyy') : 'Awaiting Data';
                                    })()}
                                </span>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precise Location</span>
                                <div className="text-xs font-bold text-slate-900 mt-1 leading-tight">
                                    {(() => {
                                        const latestRoutePoint = liveRoutePoints.length > 0
                                            ? liveRoutePoints[liveRoutePoints.length - 1]
                                            : null;
                                        const lastEvent = latestRoutePoint || events
                                            .filter(e => e.userId === selectedUser && e.latitude && e.longitude)
                                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                        
                                        if (!lastEvent) return 'Coordinates not available';
                                        
                                        return (
                                            <ResolveAddress 
                                                lat={lastEvent.latitude!} 
                                                lng={lastEvent.longitude!} 
                                                fallback="Resolving area..." 
                                                knownLocations={knownLocations} 
                                            />
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Device & Network Telemetry */}
                        {(() => {
                            const latestRoutePoint = liveRoutePoints.length > 0
                                ? liveRoutePoints[liveRoutePoints.length - 1]
                                : null;
                            const lastEvent = latestRoutePoint || events
                                .filter(e => e.userId === selectedUser && e.latitude && e.longitude)
                                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                
                            if (!lastEvent) return null;
                            
                            return (
                                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-sm bg-amber-50 flex items-center justify-center">
                                            <Battery className={`h-4 w-4 ${lastEvent.batteryLevel && lastEvent.batteryLevel < 0.2 ? 'text-red-500 animate-pulse' : 'text-amber-600'}`} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Battery</span>
                                            <span className="text-[10px] font-bold text-slate-700">
                                                {lastEvent.batteryLevel ? `${Math.round(lastEvent.batteryLevel * 100)}%` : 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const src = (lastEvent as any).source || '';
                                            const isAndroid = src.includes('android') || src === 'background_fcm';
                                            const isWeb = src === 'web' || (!src && (lastEvent.deviceName?.toLowerCase().includes('chrome') || lastEvent.deviceName?.toLowerCase().includes('windows') || lastEvent.deviceName?.toLowerCase().includes('capacitor web')));
                                            const isIos = src.includes('ios');

                                            const bgColor = isAndroid ? 'bg-emerald-50' : isWeb ? 'bg-blue-50' : 'bg-slate-50';
                                            const iconColor = isAndroid ? 'text-emerald-600' : isWeb ? 'text-blue-600' : 'text-slate-600';
                                            const label = isAndroid
                                                ? (src === 'background_fcm' ? 'Android (BG)' : 'Android (FG)')
                                                : isWeb ? 'Web/Laptop'
                                                : isIos ? 'iPhone'
                                                : (lastEvent.deviceName || 'Unknown');
                                            const dotColor = isAndroid ? 'bg-emerald-500' : isWeb ? 'bg-blue-500' : 'bg-slate-400';

                                            return (
                                                <>
                                                    <div className={`h-8 w-8 rounded-sm ${bgColor} flex items-center justify-center relative`}>
                                                        {isAndroid ? <Smartphone className={`h-4 w-4 ${iconColor}`} /> : <Monitor className={`h-4 w-4 ${iconColor}`} />}
                                                        <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${dotColor} ring-1 ring-white`} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Device Source</span>
                                                        <span className={`text-[10px] font-black truncate max-w-[90px] ${isAndroid ? 'text-emerald-700' : isWeb ? 'text-blue-700' : 'text-slate-700'}`}>
                                                            {label}
                                                        </span>
                                                        {isAndroid && lastEvent.deviceName && (
                                                            <span className="text-[8px] text-slate-400 truncate max-w-[90px]">{lastEvent.deviceName}</span>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-sm bg-blue-50 flex items-center justify-center">
                                            <Network className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Network</span>
                                            <span className="text-[10px] font-bold text-slate-700">
                                                {lastEvent.networkType || 'Offline'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-sm bg-indigo-50 flex items-center justify-center">
                                            <Globe className="h-4 w-4 text-indigo-600" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">IP Address</span>
                                            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">
                                                {lastEvent.ipAddress || '---'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </motion.div>
    );
};

const RouteView: React.FC<{ 
    events: (AttendanceEvent & { userName: string })[], 
    selectedUser: string, 
    startDate: string, 
    endDate: string, 
    users: User[],
    knownLocations: Location[],
    onSelectUser: (userId: string) => void
}> = ({ events, selectedUser, startDate, endDate, users, knownLocations, onSelectUser }) => {
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

    const routeStats = useMemo(() => {
        if (routePoints.length < 2) return null;
        let totalDist = 0;
        for (let i = 0; i < routePoints.length - 1; i++) {
            totalDist += calculateDistanceMeters(
                routePoints[i].latitude, routePoints[i].longitude,
                routePoints[i+1].latitude, routePoints[i+1].longitude
            );
        }
        const startTime = new Date(routePoints[0].timestamp).getTime();
        const endTime = new Date(routePoints[routePoints.length - 1].timestamp).getTime();
        const durationMs = endTime - startTime;
        const durationHrs = durationMs / (1000 * 60 * 60);
        const avgSpeed = durationHrs > 0 ? (totalDist / 1000) / durationHrs : 0;

        return {
            distance: (totalDist / 1000).toFixed(2),
            duration: (durationMs / (1000 * 60)).toFixed(0),
            avgSpeed: avgSpeed.toFixed(1)
        };
    }, [routePoints]);

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

        // ✅ Real-time listener: re-fetch when a new GPS ping arrives for this user
        const channelId = `map_route_${selectedUser}_${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'route_history',
                filter: `user_id=eq.${selectedUser}`
            }, (payload) => {
                console.log('[MapView] New GPS ping received, refreshing route points...', payload.new);
                fetchRoute(); // Silent re-fetch to update map card & pin
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedUser, startDate, endDate]);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView([12.9716, 77.5946], 12);
            markersRef.current.addTo(mapRef.current);
            L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
        }
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;
        const isDark = theme === 'dark';
        const tileUrl = isDark 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            
        if (tileLayerRef.current) tileLayerRef.current.setUrl(tileUrl);
        else {
            tileLayerRef.current = L.tileLayer(tileUrl, {
                maxZoom: 22,
                maxNativeZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }).addTo(mapRef.current);
        }
        
        setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }, [theme]);

    useEffect(() => {
        if (!mapRef.current) return;
        markersRef.current.clearLayers();
        if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);

        const routeLatLngs: L.LatLngTuple[] = routePoints.map(p => [p.latitude, p.longitude]);
        if (routeLatLngs.length > 0) {
            polylineRef.current = L.polyline(routeLatLngs, { 
                color: '#3B82F6', 
                weight: 6, 
                opacity: 0.9,
                smoothFactor: 1.5 
            }).addTo(mapRef.current);
            
            routePoints.forEach((p, idx) => {
                if (idx % 3 === 0 || idx === routePoints.length - 1) { 
                    const dot = L.circleMarker([p.latitude, p.longitude], {
                        radius: 4,
                        fillColor: '#3B82F6',
                        fillOpacity: 0.6,
                        color: 'white',
                        weight: 2
                    });
                    
                    const time = format(new Date(p.timestamp), 'hh:mm:ss a');
                    const speed = p.speed ? `${(p.speed * 3.6).toFixed(1)} km/h` : 'Stationary';
                    dot.bindTooltip(`
                        <div class="px-2 py-1 font-sans">
                            <p class="font-bold text-[10px] text-slate-500 uppercase">GPS Ping</p>
                            <p class="text-xs font-black text-slate-900">${time}</p>
                            <p class="text-[10px] text-blue-600 mt-1">${speed}</p>
                        </div>
                    `, { sticky: true });
                    
                    markersRef.current.addLayer(dot);
                }
            });
        } else if (userEvents.length > 1) {
            const eventLatLngs: L.LatLngTuple[] = userEvents.map(e => [e.latitude as number, e.longitude as number]);
            polylineRef.current = L.polyline(eventLatLngs, { 
                color: '#3B82F6', 
                weight: 5, 
                opacity: 0.8,
                lineJoin: 'round'
            }).addTo(mapRef.current);
        }

        userEvents.forEach((e) => {
            const pos: L.LatLngTuple = [e.latitude as number, e.longitude as number];
            const color = e.type === 'punch-in' ? '#10B981' 
                        : e.type === 'punch-out' ? '#EF4444' 
                        : e.type === 'site-in' ? '#3B82F6' 
                        : e.type === 'site-out' ? '#64748B'
                        : e.type === 'site-ot-in' ? '#F59E0B'
                        : e.type === 'site-ot-out' ? '#EA580C'
                        : '#94A3B8';
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
    }, [routePoints, userEvents, selectedUser, users]);

    return (
        <div className="relative group">
            {isLoadingRoute && (
                <div className="absolute inset-0 z-[500] bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                    <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Plotting Trajectory</span>
                </div>
            )}
            <div ref={mapContainerRef} style={{ height: '600px', width: '100%', borderRadius: '4px', zIndex: 0, border: '2px solid rgba(0,0,0,0.05)' }} />
            {routeStats && (
                <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2 pointer-events-none">
                    <div className="bg-slate-900/90 backdrop-blur-md p-4 border border-white/10 rounded-sm shadow-2xl flex items-center gap-6 pointer-events-auto">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Distance</span>
                            <span className="text-lg font-black text-white">{routeStats.distance} <span className="text-[10px] font-normal text-slate-400">KM</span></span>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</span>
                            <span className="text-lg font-black text-white">{Math.floor(Number(routeStats.duration) / 60)}h {Number(routeStats.duration) % 60}m</span>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Speed</span>
                            <span className="text-lg font-black text-white">{routeStats.avgSpeed} <span className="text-[10px] font-normal text-slate-400">KM/H</span></span>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Detailed Metadata Card (Top Left Overlay) */}
            {selectedUser !== 'all' && (
                <div className="absolute top-4 left-4 z-[1000] w-80 pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-md p-4 border border-slate-200 rounded-sm shadow-2xl pointer-events-auto">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Signal Source</span>
                                <span className="text-xs font-black text-slate-900">
                                    {users.find(u => u.id === selectedUser)?.name || 'Field Staff'}
                                </span>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                                <MapPin className="h-5 w-5 text-blue-600 animate-pulse" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Captured At</span>
                                <span className="text-xs font-black text-slate-700">
                                    {(() => {
                                        const lastPoint = routePoints.length > 0 
                                            ? routePoints[routePoints.length - 1] 
                                            : userEvents.length > 0 
                                                ? userEvents[userEvents.length - 1] 
                                                : null;
                                        return lastPoint ? format(new Date(lastPoint.timestamp), 'HH:mm:ss, dd MMM yyyy') : 'Awaiting Data';
                                    })()}
                                </span>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precise Location</span>
                                <div className="text-xs font-bold text-slate-900 mt-1 leading-tight">
                                    {(() => {
                                        const lastPoint = routePoints.length > 0 
                                            ? routePoints[routePoints.length - 1] 
                                            : userEvents.length > 0 
                                                ? userEvents[userEvents.length - 1] 
                                                : null;
                                        
                                        if (!lastPoint) return 'Coordinates not available';
                                        
                                        return (
                                            <ResolveAddress 
                                                lat={lastPoint.latitude} 
                                                lng={lastPoint.longitude} 
                                                knownLocations={knownLocations} 
                                            />
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Device & Network Telemetry */}
                        {(() => {
                            const lastPoint = routePoints.length > 0 
                                ? routePoints[routePoints.length - 1] 
                                : userEvents.length > 0 
                                    ? userEvents[userEvents.length - 1] 
                                    : null;
                                
                            if (!lastPoint) return null;
                            
                            return (
                                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-sm bg-amber-50 flex items-center justify-center">
                                            <Battery className={`h-4 w-4 ${lastPoint.batteryLevel && lastPoint.batteryLevel < 0.2 ? 'text-red-500 animate-pulse' : 'text-amber-600'}`} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Battery</span>
                                            <span className="text-[10px] font-bold text-slate-700">
                                                {lastPoint.batteryLevel ? `${Math.round(lastPoint.batteryLevel * 100)}%` : 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-sm bg-slate-50 flex items-center justify-center">
                                            <Smartphone className="h-4 w-4 text-slate-600" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Device</span>
                                            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">
                                                {lastPoint.deviceName || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-sm bg-blue-50 flex items-center justify-center">
                                            <Network className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Network</span>
                                            <span className="text-[10px] font-bold text-slate-700">
                                                {lastPoint.networkType || 'Offline'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-sm bg-indigo-50 flex items-center justify-center">
                                            <Globe className="h-4 w-4 text-indigo-600" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">IP Address</span>
                                            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">
                                                {lastPoint.ipAddress || '---'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/90 backdrop-blur-md p-3 border border-white/10 rounded-sm shadow-2xl min-w-[160px]">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 border-b border-white/5 pb-1">Signal Protocol</p>
                <div className="grid grid-cols-1 gap-2.5">
                    <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-tight">Punch In</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-rose-500 border-2 border-white shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-tight">Punch Out</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-blue-500 border-2 border-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-tight">Site In/Out</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-amber-500 border-2 border-white shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-tight">Site OT</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-1 w-6 bg-indigo-500/50 rounded-full border border-indigo-400/30" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-tight">Movement Path</span>
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
    isSelected: boolean,
    onToggle: (userId: string) => void,
    onFind: (userId: string, platforms?: string[]) => void,
    onSelect: (userId: string) => void,
    userPlatforms?: string[]
}> = ({ event, isFirst, isLast, knownLocations, isSelected, onToggle, onFind, onSelect, userPlatforms = [] }) => {
    const badgeStyles = getEventColor(event.type);
    const [isPinging, setIsPinging] = useState(false);

    // Default selection: prefer mobile (android/ios) over web/laptop.
    // If the user has both 'web' and 'android', pre-select android only.
    const getDefaultPlatforms = (platforms: string[]) => {
        const mobilePlatforms = platforms.filter(p => p !== 'web');
        return mobilePlatforms.length > 0 ? mobilePlatforms : platforms;
    };

    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(() => getDefaultPlatforms(userPlatforms));
    const initializedRef = useRef(false);

    useEffect(() => {
        // Only set defaults on first load (when platforms data arrives from API).
        // Do NOT reset user's manual node selection on subsequent renders.
        if (!initializedRef.current && userPlatforms.length > 0) {
            setSelectedPlatforms(getDefaultPlatforms(userPlatforms));
            initializedRef.current = true;
        }
    }, [userPlatforms]);

    const togglePlatform = (p: string) => {
        setSelectedPlatforms(prev =>
            prev.includes(p) ? prev.filter(item => item !== p) : [...prev, p]
        );
    };
    
    return (
        <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="group relative flex gap-4 md:gap-6 pb-8 last:pb-0"
        >
            <div className="flex-shrink-0 pt-[14px] z-20">
                <input 
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(event.userId)}
                    className="h-5 w-5 rounded-sm border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer transition-all hover:border-slate-400"
                />
            </div>

            <div className="absolute left-[10px] top-[48px] bottom-0 w-[1.5px] bg-slate-200 group-last:hidden" />

            <div className="w-20 pt-2 flex flex-col items-end flex-shrink-0">
                <span className="text-[14px] font-mono font-bold text-primary-text tracking-tighter">
                    {format(new Date(event.timestamp), 'HH:mm')}
                </span>
                <span className="text-[10px] font-bold text-muted tracking-widest uppercase">
                    {format(new Date(event.timestamp), 'dd MMM')}
                </span>
            </div>

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

            <div className="flex-1 bg-card border border-border shadow-sm group-hover:shadow-md transition-all duration-300 p-4 relative overflow-hidden">
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

                    {/* Platform Targeting (Mission Control Aesthetics) */}
                    <div className="flex-1 flex items-center justify-center border-x border-slate-100/30 px-6 bg-slate-50/30">
                        {userPlatforms.length > 0 ? (
                            <div className="flex items-center gap-6">
                                <AnimatePresence mode="popLayout">
                                    {userPlatforms.map((platform, pIdx) => {
                                        const isSelected = selectedPlatforms.includes(platform);
                                        const Icon = platform === 'web' ? Monitor : Smartphone;
                                        const label = platform === 'web' ? 'Laptop' : platform === 'ios' ? 'iPhone' : 'Android';
                                        
                                        return (
                                            <motion.button 
                                                key={platform}
                                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                transition={{ delay: pIdx * 0.1, type: "spring", stiffness: 300, damping: 20 }}
                                                onClick={() => togglePlatform(platform)}
                                                className="group/node relative flex flex-col items-center"
                                            >
                                                {/* Node Background with Glassmorphism */}
                                                <div className={`
                                                    relative h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-500
                                                    ${isSelected 
                                                        ? 'bg-slate-900 shadow-[0_0_20px_rgba(16,185,129,0.3)] border-emerald-500/50' 
                                                        : 'bg-white border-slate-200 hover:border-slate-400 shadow-sm'}
                                                    border-[1.5px]
                                                `}>
                                                    <Icon className={`
                                                        h-5 w-5 transition-all duration-500
                                                        ${isSelected ? 'text-emerald-400 scale-110' : 'text-slate-400 group-hover/node:text-slate-600'}
                                                    `} />
                                                    
                                                    {/* Status Ping Indicator */}
                                                    {isSelected && (
                                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-slate-900"></span>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* High-Precision Label */}
                                                <span className={`
                                                    mt-2 text-[7px] font-black uppercase tracking-[0.2em] transition-colors
                                                    ${isSelected ? 'text-slate-900' : 'text-slate-400 group-hover/node:text-slate-600'}
                                                `}>
                                                    {label}
                                                </span>

                                                {/* Hidden Glow Effect on Hover */}
                                                {!isSelected && (
                                                    <div className="absolute inset-0 -z-10 bg-blue-500/5 blur-xl rounded-full opacity-0 group-hover/node:opacity-100 transition-opacity" />
                                                )}
                                            </motion.button>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-2">
                                <div className="relative h-10 w-10 flex items-center justify-center">
                                    <Globe className="h-5 w-5 text-slate-200 animate-[spin_10s_linear_infinite]" />
                                    <div className="absolute inset-0 border border-dashed border-slate-200 rounded-full animate-pulse" />
                                </div>
                                <span className="mt-2 text-[7px] font-black text-slate-300 uppercase tracking-[0.2em]">Searching Nodes...</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center pr-2">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={async () => {
                                setIsPinging(true);
                                try {
                                    await onFind(event.userId, selectedPlatforms);
                                } finally {
                                    setIsPinging(false);
                                }
                            }}
                            disabled={isPinging || (userPlatforms.length > 0 && selectedPlatforms.length === 0)}
                            className={`
                                relative h-10 px-6 rounded-xl flex items-center gap-3 transition-all duration-300
                                ${isPinging || (userPlatforms.length > 0 && selectedPlatforms.length === 0)
                                    ? 'bg-slate-100 text-slate-400 grayscale cursor-not-allowed'
                                    : 'bg-indigo-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:bg-indigo-700 hover:shadow-[0_6px_20px_rgba(79,70,229,0.4)]'}
                            `}
                            title={selectedPlatforms.length === 0 ? "Select at least one node" : "Initiate Signal Scan"}
                        >
                            {isPinging ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <div className="relative">
                                    <MapPin className="h-3.5 w-3.5" />
                                    <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-20" />
                                </div>
                            )}
                            <span className="text-[10px] font-black uppercase tracking-[0.15em]">
                                {isPinging ? 'Scanning...' : 'Find'}
                            </span>
                        </motion.button>
                        {event.latitude && event.longitude && (
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 px-3 rounded-sm border border-border bg-page hover:bg-slate-50 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary-text transition-colors"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Inspect
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
    const [viewMode, setViewMode] = useState<'list' | 'map' | 'route' | 'logs'>('list');
    const [events, setEvents] = useState<AttendanceEvent[]>([]);
    const [liveRoutePoints, setLiveRoutePoints] = useState<RoutePoint[]>([]); // Single source of truth for latest GPS pings
    const [users, setUsers] = useState<User[]>([]);
    const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
    const [knownLocations, setKnownLocations] = useState<Location[]>([]);
    const [userPlatformsMap, setUserPlatformsMap] = useState<Record<string, string[]>>({});
    const [isLoading, setIsLoading] = useState(true);

    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedUser, setSelectedUser] = useState<string>('all');
    const [selectedRole, setSelectedRole] = useState<string>('all');

    const [tempUser, setTempUser] = useState<string>('all');
    const [tempRole, setTempRole] = useState<string>('all');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isRequestingTracking, setIsRequestingTracking] = useState(false);

    const isMobile = useMediaQuery('(max-width: 767px)');
    const { user: currentUser } = useAuthStore();
    
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

    const trackingUsers = useMemo(() => {
        let filtered = users.filter(u => trackingRoleSlugs.includes(u.role));

        if (currentUser && !isAdmin(currentUser.role) && currentUser.role === 'Operation Manager') {
            filtered = filtered.filter(u => 
                u.reportingManagerId === currentUser.id || 
                u.reportingManager2Id === currentUser.id || 
                u.reportingManager3Id === currentUser.id
            );
        }

        return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }, [users, trackingRoleSlugs, currentUser]);

    const selectableUsers = useMemo(() => {
        if (tempRole === 'all') return trackingUsers;
        return trackingUsers.filter(u => u.role === tempRole);
    }, [trackingUsers, tempRole]);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            // 1. Fetch static data if not already present
            if (users.length === 0 || availableRoles.length === 0) {
                const [usersData, locationsData, rolesData] = await Promise.all([
                    api.getUsers(),
                    api.getLocations(),
                    api.getRoles()
                ]);
                setUsers(usersData);
                setKnownLocations(locationsData);
                setAvailableRoles(rolesData);
                
                // Fetch platforms for all users
                const allUserIds = usersData.map((u: any) => u.id);
                api.getUserActivePlatforms(allUserIds).then(setUserPlatformsMap);
            }

            // 2. Fetch dynamic signal data
            const promises: any[] = [
                api.getAllAttendanceEvents(start.toISOString(), end.toISOString())
            ];

            if (selectedUser !== 'all') {
                promises.push(api.getRoutePoints(selectedUser, start.toISOString(), end.toISOString()));
            }

            const results = await Promise.all(promises);
            const eventsData = results[0];
            const routePoints = results[1] || [];
            
            // Filter out any existing 'Current Position' events to avoid duplicates
            let combinedEvents = eventsData.filter(e => !e.id.startsWith('route-'));
            
            // Map route points to AttendanceEvent format and add them all
            const mappedRoutePoints = routePoints.map(point => ({
                id: `route-${point.id}`,
                userId: point.userId,
                timestamp: point.timestamp,
                type: 'punch-in', // Treat as a signal event
                latitude: point.latitude,
                longitude: point.longitude,
                locationName: 'Current Position (Live Tracking)',
                workType: 'field',
                batteryLevel: point.batteryLevel,
                deviceName: point.deviceName,
                ipAddress: point.ipAddress,
                networkType: point.networkType,
                networkProvider: point.networkProvider,
                source: point.source
            } as AttendanceEvent));

            combinedEvents = [...combinedEvents, ...mappedRoutePoints];
            
            setEvents(combinedEvents);
            setLiveRoutePoints(routePoints); // Always update live route points for MapView metadata card
        } catch (error) {
            console.error("Tracking Data Fetch Error", error);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, selectedUser, selectedRole, users.length, availableRoles.length]);

    // Reference to the latest fetchData to avoid re-subscribing every time fetchData changes
    const fetchDataRef = useRef(fetchData);
    useEffect(() => {
        fetchDataRef.current = fetchData;
    }, [fetchData]);

    // Dedicated real-time listener effect
    useEffect(() => {
        // Use a unique channel for this component instance to avoid clashes during HMR or rapid re-renders
        const channelId = `tracking_updates_${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'route_history' }, (payload) => {
                if (selectedUser === 'all' || payload.new.user_id === selectedUser) {
                    fetchDataRef.current(true); // Silent refresh for realtime updates
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tracking_audit_logs' }, () => {
                fetchDataRef.current(true); // Silent refresh for log status updates
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedUser]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredEvents = useMemo(() => {
        let results = events;
        
        if (selectedUser !== 'all') {
            results = results.filter(e => e.userId === selectedUser);
        } else if (selectedRole !== 'all') {
            const roleUserIds = new Set(trackingUsers.filter(u => u.role === selectedRole).map(u => u.id));
            results = results.filter(e => roleUserIds.has(e.userId));
        } else {
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
        setSelectedUserIds([]);
    };

    const handleFindUsers = async (userIds?: string[], platforms?: string[]) => {
        const targets = userIds || selectedUserIds;
        if (targets.length === 0) return;

        setIsRequestingTracking(true);
        try {
            await api.requestRealTimeTracking(targets, platforms);
            setSelectedUserIds([]);
        } catch (error) {
            console.error('Tracking request failed:', error);
        } finally {
            setIsRequestingTracking(false);
        }
    };

    const toggleUserSelection = (userId: string) => {
        setSelectedUserIds(prev => 
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const toggleAllOnPage = () => {
        const pageUserIds = paginatedEvents.map(e => e.userId);
        const allSelected = pageUserIds.every(id => selectedUserIds.includes(id));
        
        if (allSelected) {
            setSelectedUserIds(prev => prev.filter(id => !pageUserIds.includes(id)));
        } else {
            setSelectedUserIds(prev => Array.from(new Set([...prev, ...pageUserIds])));
        }
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
                            <button 
                                onClick={() => setViewMode('logs')}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'logs' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Logs
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

                        <div className="flex gap-2 ml-auto">
                            {selectedUserIds.length > 0 && (
                                <button
                                    onClick={() => handleFindUsers()}
                                    disabled={isRequestingTracking}
                                    className="h-9 px-6 bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-amber-600 transition-all active:scale-95 flex items-center gap-2 rounded-sm disabled:opacity-50"
                                >
                                    {isRequestingTracking ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                                    Find ({selectedUserIds.length})
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    // Placeholder for actual export logic
                                    alert('Preparing tracking report for download...');
                                }}
                                className="h-9 px-4 bg-white text-slate-900 border border-slate-200 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2 rounded-sm"
                            >
                                <Download className="h-3 w-3" />
                                Export
                            </button>
                            <button
                                onClick={handleApplyFilters}
                                className="h-9 px-6 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 rounded-sm"
                            >
                                <Filter className="h-3 w-3" />
                                Apply Filter
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Selection Toolbar (Mobile/Sticky) */}
            {selectedUserIds.length > 0 && (
                <motion.div 
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-xl"
                >
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected</span>
                        <span className="text-sm font-black">{selectedUserIds.length} Agents</span>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <button 
                        onClick={() => handleFindUsers()}
                        disabled={isRequestingTracking}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-amber-400 transition-colors disabled:opacity-50"
                    >
                        {isRequestingTracking ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                        Trigger Real-time Find
                    </button>
                    <div className="w-px h-6 bg-white/10" />
                    <button 
                        onClick={() => setSelectedUserIds([])}
                        className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                </motion.div>
            )}

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
                                    <div className="pl-0">
                                        <div className="flex items-center gap-4 md:gap-6 mb-6">
                                            <div className="flex-shrink-0">
                                                <input 
                                                    type="checkbox"
                                                    checked={paginatedEvents.length > 0 && paginatedEvents.every(e => selectedUserIds.includes(e.userId))}
                                                    onChange={toggleAllOnPage}
                                                    className="h-5 w-5 rounded-sm border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer transition-all hover:border-slate-400"
                                                />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Select All Agents on this page</span>
                                        </div>
                                        {paginatedEvents.map((event, idx) => (
                                            <ActivityItem 
                                                key={event.id} 
                                                event={event} 
                                                isFirst={currentPage === 1 && idx === 0}
                                                isLast={idx === paginatedEvents.length - 1}
                                                knownLocations={knownLocations}
                                                isSelected={selectedUserIds.includes(event.userId)}
                                                onToggle={toggleUserSelection}
                                                onFind={(userId, platforms) => handleFindUsers([userId], platforms)}
                                                onSelect={(userId) => {
                                                    setSelectedUser(userId);
                                                    setTempUser(userId);
                                                    setViewMode('list');
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                userPlatforms={userPlatformsMap[event.userId]}
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
                            <MapView 
                                key="map" 
                                events={filteredEvents} 
                                users={users} 
                                selectedUser={selectedUser} 
                                knownLocations={knownLocations}
                                liveRoutePoints={liveRoutePoints}
                                onSelectUser={setSelectedUser}
                            />
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
                                    <RouteView 
                                        events={filteredEvents} 
                                        selectedUser={selectedUser} 
                                        startDate={startDate} 
                                        endDate={endDate} 
                                        users={users} 
                                        knownLocations={knownLocations}
                                        onSelectUser={setSelectedUser}
                                    />
                                )}
                            </motion.div>
                        )}
                        {viewMode === 'logs' && (
                            <TrackingLogsView 
                                startDate={startDate} 
                                endDate={endDate} 
                                onViewOnMap={(userId) => {
                                    setTempUser(userId);
                                    setSelectedUser(userId);
                                    setViewMode('map');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                onStatusResolved={() => fetchData(true)} // Silently refresh GPS data when a log resolves
                            />
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