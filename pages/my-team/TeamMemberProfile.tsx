import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, Calendar, MapPin, Clock, 
  Navigation, Briefcase, ChevronRight, Info, FileText, AlertTriangle, Monitor, Shield, Globe, Smartphone
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import ViolationsView from '../../components/violations/ViolationsView';
import { 
  format, differenceInMinutes, startOfDay, endOfDay, 
  parseISO, isSameDay, addDays, subDays 
} from 'date-fns';
import { api } from '../../services/api';
import { User, AttendanceEvent, LeaveRequest, EmployeeScore } from '../../types';
import { calculateEmployeeScores } from '../../services/employeeScoring';
import { calculateDistanceMeters, reverseGeocode } from '../../utils/locationUtils';
import UserDeviceList from '../../components/devices/UserDeviceList';
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';

// Helper to safely format ISO strings and prevent RangeErrors
const safeFormatISO = (dateStr: string | undefined | null, formatStr: string, fallback = 'N/A') => {
  if (!dateStr) return fallback;
  try {
    const parsed = parseISO(dateStr);
    if (isNaN(parsed.getTime())) return fallback;
    return format(parsed, formatStr);
  } catch (e) {
    return fallback;
  }
};

// Helper component to resolve GPS coordinates into a text address
const ResolveAddress: React.FC<{ lat: number, lng: number, fallback?: string | null }> = ({ lat, lng, fallback }) => {
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const resolve = async () => {
      // Only resolve if fallback is likely just coordinates or missing
      const needsResolution = !fallback || fallback.startsWith('GPS:') || fallback === 'Location Timeout' || fallback === 'Location Unavailable' || fallback === 'Unknown Site';
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
  }, [lat, lng, fallback]);

  if (loading) return <span className="animate-pulse text-accent/50 text-[10px]">Resolving address...</span>;
  return <span>{resolvedAddress || fallback || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</span>;
};

interface ActivitySegment {
  id: string;
  type: 'Work' | 'Travel';
  startTime: string;
  endTime: string;
  duration: string;
  durationMin: number;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  distance?: number; // in km
}

const TeamMemberProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<User | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'leaves' | 'devices' | 'violations'>('activity');
  const [employeeScores, setEmployeeScores] = useState<EmployeeScore | null>(null);
  const [isScoresLoading, setIsScoresLoading] = useState(true);
  const { user: currentUser } = useAuthStore();

  const isManager = useMemo(() => {
    if (!currentUser || !member) return false;
    if (['admin', 'hr', 'operation_manager', 'developer'].includes(currentUser.role)) return true;
    return member.reportingManagerId === currentUser.id;
  }, [currentUser, member]);

  const isFieldStaff = useMemo(() => {
    return member?.role?.toLowerCase() === 'field_staff';
  }, [member]);

  useEffect(() => {
    if (id) {
      fetchMemberDetails();
    }
  }, [id]);

  // Fetch employee scores when member is loaded
  useEffect(() => {
    if (!member) return;
    let cancelled = false;
    const loadScores = async () => {
      setIsScoresLoading(true);
      try {
        const scores = await calculateEmployeeScores(member.id, member.role || 'office');
        if (!cancelled) setEmployeeScores(scores);
      } catch (err) {
        console.error('Failed to load employee scores:', err);
      } finally {
        if (!cancelled) setIsScoresLoading(false);
      }
    };
    loadScores();
    return () => { cancelled = true; };
  }, [member?.id, member?.role]);

  useEffect(() => {
    if (id) {
      fetchActivityLog();
    }
  }, [id, selectedDate]);

  const fetchMemberDetails = async () => {
    try {
      const user = await api.getUserById(id!);
      if (user) {
        setMember(user);
        const response = await api.getLeaveRequests({ userId: user.id });
        setLeaveRequests(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching user details:', err);
    }
  };

  const fetchActivityLog = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const start = startOfDay(selectedDate).toISOString();
      const end = endOfDay(selectedDate).toISOString();
      const data = await api.getLocationHistory(id, start, end);
      setEvents(data);
    } catch (err) {
      console.error('Error fetching activity log:', err);
    } finally {
      setLoading(false);
    }
  };

  const timeline = useMemo(() => {
    if (events.length === 0) return [];

    const sorted = [...events]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .filter((e, i, arr) => {
        if (i === 0) return true;
        const prev = arr[i - 1];
        return e.type !== prev.type || e.timestamp !== prev.timestamp;
      });

    const workSegments: ActivitySegment[] = [];
    const travelSegments: ActivitySegment[] = [];

    let activeIn: AttendanceEvent | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const evt = sorted[i];
      if (evt.type === 'punch-in') {
        if (!activeIn) activeIn = evt;
      } else if (evt.type === 'punch-out') {
        if (activeIn) {
          const start = parseISO(activeIn.timestamp);
          const end = parseISO(evt.timestamp);
          const durationMin = Math.max(0, differenceInMinutes(end, start));
          let locName = activeIn.locationName || 'Unknown Site';
          if (locName === 'Unknown Site' && activeIn.latitude && activeIn.longitude) {
            locName = `GPS: ${activeIn.latitude.toFixed(4)}, ${activeIn.longitude.toFixed(4)}`;
          }
          workSegments.push({
            id: `work-${activeIn.id}`,
            type: 'Work',
            startTime: activeIn.timestamp,
            endTime: evt.timestamp,
            duration: `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`,
            durationMin,
            locationName: locName,
            latitude: activeIn.latitude,
            longitude: activeIn.longitude
          });
          activeIn = null;
        }
      }
    }

    if (activeIn) {
      const isToday = isSameDay(selectedDate, new Date());
      const endTs = isToday ? new Date().toISOString() : endOfDay(parseISO(activeIn.timestamp)).toISOString();
      const start = parseISO(activeIn.timestamp);
      const end = parseISO(endTs);
      const durationMin = Math.max(0, differenceInMinutes(end, start));
      workSegments.push({
        id: `work-${activeIn.id}`,
        type: 'Work',
        startTime: activeIn.timestamp,
        endTime: endTs,
        duration: `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`,
        durationMin,
        locationName: activeIn.locationName || 'Unknown Site',
        latitude: activeIn.latitude,
        longitude: activeIn.longitude
      });
    }

    for (let j = 0; j < workSegments.length - 1; j++) {
      const current = workSegments[j];
      const next = workSegments[j + 1];
      const start = parseISO(current.endTime);
      const end = parseISO(next.startTime);
      const durationMin = Math.max(0, differenceInMinutes(end, start));
      const outEvt = sorted.find(e => e.timestamp === current.endTime && e.type === 'punch-out');
      const inEvt = sorted.find(e => e.timestamp === next.startTime && e.type === 'punch-in');
      let dist = 0;
      if (outEvt?.latitude && outEvt?.longitude && inEvt?.latitude && inEvt?.longitude) {
        dist = calculateDistanceMeters(outEvt.latitude, outEvt.longitude, inEvt.latitude, inEvt.longitude) / 1000;
      }
      if (durationMin > 0 || dist > 0.05) {
        travelSegments.push({
          id: `travel-${j}`,
          type: 'Travel',
          startTime: current.endTime,
          endTime: next.startTime,
          duration: `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`,
          durationMin,
          distance: Number(dist.toFixed(2))
        });
      }
    }

    return [...workSegments, ...travelSegments].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [events, selectedDate]);

  const groupedLeaves = useMemo(() => {
    const groups: Record<string, LeaveRequest[]> = {};
    if (!leaveRequests) return groups;
    leaveRequests.forEach(req => {
      const dateStr = (req as any).createdAt || req.startDate;
      if (!dateStr) return;
      const month = safeFormatISO(dateStr, 'MMMM yyyy');
      if (month === 'N/A') return;
      if (!groups[month]) groups[month] = [];
      groups[month].push(req);
    });
    return groups;
  }, [leaveRequests]);

  const metrics = useMemo(() => {
    let totalDist = 0;
    let workMin = 0;
    let travelMin = 0;
    timeline.forEach(s => {
      if (s.type === 'Work') workMin += s.durationMin;
      if (s.type === 'Travel') {
        travelMin += s.durationMin;
        totalDist += s.distance || 0;
      }
    });
    return {
      totalDistance: totalDist.toFixed(2),
      workDuration: `${Math.floor(workMin / 60)}h ${workMin % 60}m`,
      travelTime: `${Math.floor(travelMin / 60)}h ${travelMin % 60}m`
    };
  }, [timeline]);

  const exportReport = () => {
    const csvContent = [
      ['Type', 'Start Time', 'End Time', 'Duration', 'Details/Location'].join(','),
      ...timeline.map(s => [
        s.type,
        safeFormatISO(s.startTime, 'hh:mm a'),
        safeFormatISO(s.endTime, 'hh:mm a'),
        s.duration,
        s.type === 'Work' ? `"${s.locationName}"` : `${s.distance} km`
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Activity_Report_${member?.name}_${format(selectedDate, 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!member) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background text-primary-text">
      {/* Premium Header */}
      <div className="bg-card border-b border-border shadow-soft sticky top-0 z-30">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => navigate(-1)}
                  className="p-2 hover:bg-accent/5 rounded-xl transition-all group flex items-center justify-center border border-transparent hover:border-accent/10 active:scale-95"
                  title="Go Back"
                >
                  <ArrowLeft className="w-6 h-6 text-muted group-hover:text-accent transition-colors" />
                </button>
                <div className="flex items-center gap-3">
                  <ProfilePlaceholder photoUrl={member.photoUrl} seed={member.id} className="w-12 h-12 rounded-full border-2 border-accent/20" />
                  <div className="flex flex-col">
                    <h1 className="text-xl sm:text-2xl font-bold leading-tight">{member.name}</h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] sm:text-xs px-2 py-0.5 bg-accent/10 text-accent rounded-full font-bold uppercase tracking-wider">{member.role.replace(/_/g, ' ')}</span>
                      <span className="text-muted text-xs">•</span>
                      <span className="text-muted text-xs font-medium">{member.email}</span>
                    </div>
                  </div>
                </div>

                {/* Performance Score Badges */}
                <div className="flex items-center gap-3 ml-auto">
                  <div className="flex flex-col items-center gap-1">
                    <div className="relative flex justify-center items-center w-11 h-11 text-[#F97316] drop-shadow-md" title="Performance Score">
                      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                        <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                      </svg>
                      <span className="relative z-10 text-white font-bold text-xs">{isScoresLoading ? '—' : (employeeScores?.performanceScore ?? '—')}</span>
                    </div>
                    <span className="text-[9px] uppercase font-bold text-muted tracking-widest">Performance</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="relative flex justify-center items-center w-11 h-11 text-[#6366f1] drop-shadow-md" title="Attendance Score">
                      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                        <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                      </svg>
                      <span className="relative z-10 text-white font-bold text-xs">{isScoresLoading ? '—' : (employeeScores?.attendanceScore ?? '—')}</span>
                    </div>
                    <span className="text-[9px] uppercase font-bold text-muted tracking-widest">Attendance</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="relative flex justify-center items-center w-11 h-11 text-[#111827] drop-shadow-md" title="Response Score">
                      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                        <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                      </svg>
                      <span className="relative z-10 text-white font-bold text-xs">{isScoresLoading ? '—' : (employeeScores?.responseScore ?? '—')}</span>
                    </div>
                    <span className="text-[9px] uppercase font-bold text-muted tracking-widest">Response</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                <div className="flex items-center bg-white border border-border p-1 rounded-xl shadow-inner-soft min-w-fit">
                  <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-1 px-2.5 bg-transparent hover:bg-accent/5 rounded-lg transition-colors font-bold">&larr;</button>
                  <div className="flex items-center gap-2 px-3 py-1 text-xs sm:text-sm font-semibold">
                    <Calendar className="w-4 h-4 text-accent" />
                    {format(selectedDate, 'dd MMM, yyyy')}
                  </div>
                  <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} disabled={isSameDay(selectedDate, new Date())} className="p-1 px-2.5 bg-transparent hover:bg-accent/5 rounded-lg transition-colors font-bold disabled:opacity-20">&rarr;</button>
                </div>
                <button onClick={exportReport} className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 transition-all font-bold text-xs sm:text-sm shadow-accent-soft whitespace-nowrap">
                  <Download className="w-4 h-4" />
                  <span>Report</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 -mb-[1px]">
              <button 
                onClick={() => setActiveTab('violations')} 
                className={`relative px-4 py-2 text-sm font-bold transition-all rounded-t-lg ${activeTab === 'violations' ? 'text-accent' : 'text-primary-text hover:text-accent'}`}
              >
                Attendance Violations
                {activeTab === 'violations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full shadow-accent-soft" />}
              </button>
              <button 
                onClick={() => setActiveTab('activity')} 
                className={`relative px-4 py-2 text-sm font-bold transition-all rounded-t-lg ${activeTab === 'activity' ? 'text-accent' : 'text-primary-text hover:text-accent'}`}
              >
                Daily Activity
                {activeTab === 'activity' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full shadow-accent-soft" />}
              </button>
              <button 
                onClick={() => setActiveTab('devices')} 
                className={`relative px-4 py-2 text-sm font-bold transition-all rounded-t-lg ${activeTab === 'devices' ? 'text-accent' : 'text-primary-text hover:text-accent'}`}
              >
                Device History
                {activeTab === 'devices' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full shadow-accent-soft" />}
              </button>
              <button 
                onClick={() => setActiveTab('leaves')} 
                className={`relative px-4 py-2 text-sm font-bold transition-all rounded-t-lg ${activeTab === 'leaves' ? 'text-accent' : 'text-primary-text hover:text-accent'}`}
              >
                Leave History
                {activeTab === 'leaves' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full shadow-accent-soft" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <MetricCard title="Total Distance" value={`${metrics.totalDistance} km`} subtext="Traveled across segments" icon={<Navigation className="w-5 h-5" />} color="bg-blue-500" />
            <MetricCard title="Work Duration" value={metrics.workDuration} subtext="Total time at site locations" icon={<Briefcase className="w-5 h-5" />} color="bg-green-500" />
            <MetricCard title="Travel Time" value={metrics.travelTime} subtext="Total time spent commuting" icon={<MapPin className="w-5 h-5" />} color="bg-orange-500" />
            
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-accent" />
                Day Insights
              </h3>
              <div className="space-y-3">
                <InsightItem label="First Check-in" value={safeFormatISO(events.find(e => e.type === 'punch-in')?.timestamp, 'hh:mm a')} />
                <InsightItem label="Last Event" value={safeFormatISO(events[events.length - 1]?.timestamp, 'hh:mm a')} />
                <InsightItem label="Sites Visited" value={new Set(timeline.filter(s => s.type === 'Work').map(s => s.locationName)).size.toString()} />
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm overflow-visible min-h-[500px]">
              {activeTab === 'activity' ? (
                <>
                  <h3 className="text-lg font-bold mb-6">Activity Timeline</h3>
                  {loading ? (
                    <div className="space-y-8 animate-pulse">
                      {[1,2,3].map(i => (
                        <div key={i} className="flex gap-4">
                          <div className="w-8 h-8 rounded-full bg-slate-200" />
                          <div className="flex-1 h-20 bg-slate-100 rounded-xl" />
                        </div>
                      ))}
                    </div>
                  ) : timeline.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted opacity-50 text-lg">
                      <Clock className="w-12 h-12 mb-3" />
                      <p>No activity recorded for this day.</p>
                    </div>
                  ) : (
                    <div className="relative space-y-2">
                      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-border via-border to-transparent" />
                      {timeline.map((s) => (
                        <div key={s.id} className="relative pl-10 pb-8 last:pb-0 text-base">
                          <div className={`absolute left-0 top-1.5 w-8 h-8 rounded-full border-4 border-card flex items-center justify-center z-10 ${s.type === 'Work' ? 'bg-green-500' : 'bg-orange-500'}`}>
                            {s.type === 'Work' ? <Briefcase className="w-3 h-3 text-white" /> : <Navigation className="w-3 h-3 text-white" />}
                          </div>
                          <div className={`p-4 rounded-2xl border transition-all duration-300 ${s.type === 'Work' ? 'bg-green-500/5 border-green-500/10 hover:border-green-500/30' : 'bg-orange-500/5 border-orange-500/10 hover:border-orange-500/30'}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${s.type === 'Work' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{s.type === 'Work' ? 'At Location' : 'Travel'}</span>
                                <h4 className="font-bold">{s.type === 'Work' ? (s.latitude && s.longitude ? <ResolveAddress lat={s.latitude} lng={s.longitude} fallback={s.locationName} /> : s.locationName) : 'Travel to next stop'}</h4>
                              </div>
                              <div className="flex items-center gap-3 text-xs font-medium text-muted">
                                <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{safeFormatISO(s.startTime, 'hh:mm a')} - {safeFormatISO(s.endTime, 'hh:mm a')}</div>
                                <span className="bg-background px-2 py-0.5 rounded-lg border border-border">{s.duration}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : activeTab === 'leaves' ? (
                <>
                  <h3 className="text-lg font-bold mb-6">Leave Request History</h3>
                  {Object.keys(groupedLeaves).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted opacity-50 text-lg"><FileText className="w-12 h-12 mb-3" /><p>No leave requests found.</p></div>
                  ) : (
                    <div className="space-y-8">
                      {Object.entries(groupedLeaves).map(([month, requests]) => (
                        <div key={month} className="space-y-4">
                          <h4 className="text-sm font-bold text-accent px-2 py-1 bg-accent/5 rounded-lg inline-block">{month}</h4>
                          <div className="space-y-3">
                            {requests.map(req => (
                              <div key={req.id} className="p-4 rounded-xl border border-border bg-page/50 hover:bg-page transition-colors text-base">
                                <div className="flex justify-between items-start mb-2">
                                  <div><p className="font-bold">{req.leaveType} Leave</p><p className="text-xs text-muted">{safeFormatISO(req.startDate, 'dd MMM')} - {safeFormatISO(req.endDate, 'dd MMM, yyyy')}</p></div>
                                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${req.status === 'approved' ? 'bg-green-500 text-white' : req.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`}>{req.status.replace(/_/g, ' ')}</span>
                                </div>
                                <p className="text-sm text-muted line-clamp-2 italic">"{req.reason}"</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : activeTab === 'devices' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <UserDeviceList 
                    userId={member.id} 
                    userRole={member.role}
                    canManage={isManager} 
                    showTitle={true} 
                  />
                </div>
              ) : activeTab === 'violations' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <ViolationsView userId={member.id} userName={member.name} isManager={isManager} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string; subtext: string; icon: React.ReactNode; color: string }> = ({ title, value, subtext, icon, color }) => (
  <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-xl text-white shadow-sm ${color} group-hover:scale-110 transition-transform`}>{icon}</div>
      <div>
        <p className="text-xs font-medium text-muted uppercase tracking-wider">{title}</p>
        <h4 className="text-xl font-extrabold">{value}</h4>
        <p className="text-[10px] text-muted mt-0.5">{subtext}</p>
      </div>
    </div>
  </div>
);

const InsightItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-muted">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

export default TeamMemberProfile;
