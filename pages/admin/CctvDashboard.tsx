import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import {
  Activity, ArrowRight, ArrowLeft, AlertTriangle, RefreshCw,
  Camera, CheckCircle, XCircle, Eye, UserPlus, UserCheck,
  Maximize2, Minimize2, Video, Download, Shield, Cpu, Clock, Search
} from 'lucide-react';

const NGROK_PROXY = 'https://tassel-estranged-prism.ngrok-free.dev';

interface CctvLog {
  id: string;
  userId: string | null;
  userName: string | null;
  cameraName: string;
  direction: 'entry' | 'exit';
  confidence: number;
  detectedAt: string;
  snapshotUrl: string | null;
  edgeDeviceId: string;
}

interface EnrollmentItem {
  id: string;
  cameraName: string;
  detectedAt: string;
  snapshotUrl: string | null;
  status: string;
  edgeDeviceId: string;
}

interface UserOption {
  id: string;
  name: string;
  biometricId: string | null;
}

// ── CCTV Live Stream Component (Standard NVR Style) ──
const NvrCameraStream: React.FC<{
  camName: string;
}> = ({ camName }) => {
  const [frameSrc, setFrameSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const p = (v: number) => v.toString().padStart(2, '0');
      setCurrentTime(`${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let timerId: any = null;
    let currentObjectUrl = '';

    const fetchNextFrame = async () => {
      if (!isMountedRef.current) return;

      try {
        const res = await fetch(
          `${NGROK_PROXY}/camera/frame/${encodeURIComponent(camName)}?_t=${Date.now()}`,
          {
            headers: {
              'ngrok-skip-browser-warning': '1',
            },
          }
        );

        if (res.ok) {
          const blob = await res.blob();
          if (blob.type.includes('image') || blob.size > 1000) {
            const newUrl = URL.createObjectURL(blob);
            if (isMountedRef.current) {
              setFrameSrc(newUrl);
              setHasError(false);
              if (currentObjectUrl) {
                URL.revokeObjectURL(currentObjectUrl);
              }
              currentObjectUrl = newUrl;
            } else {
              URL.revokeObjectURL(newUrl);
            }
            if (isMountedRef.current) {
              timerId = setTimeout(fetchNextFrame, 300); // ~3.5 FPS smooth live stream
            }
            return;
          }
        }
        throw new Error(`Invalid response: ${res.status}`);
      } catch {
        if (isMountedRef.current) {
          setHasError(true);
          timerId = setTimeout(fetchNextFrame, 2000); // Retry in 2s
        }
      }
    };

    fetchNextFrame();

    return () => {
      isMountedRef.current = false;
      if (timerId) clearTimeout(timerId);
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
  }, [camName]);

  const handleDownloadSnapshot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${NGROK_PROXY}/camera/frame/${encodeURIComponent(camName)}?_t=${Date.now()}`, {
        headers: { 'ngrok-skip-browser-warning': '1' },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CCTV_${camName}_${Date.now()}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
  };

  return (
    <>
      <div 
        onClick={() => setIsFullscreen(true)}
        className="w-full h-full relative group bg-black overflow-hidden select-none cursor-pointer rounded-2xl border border-border shadow-md"
      >
        {hasError && !frameSrc ? (
          <div className="w-full h-full min-h-[280px] flex flex-col items-center justify-center bg-slate-950 gap-2 p-6">
            <Video className="h-8 w-8 text-amber-400 animate-pulse" />
            <span className="text-xs text-amber-300 font-mono tracking-wider font-semibold">CONNECTING RTSP STREAM...</span>
            <span className="text-[10px] text-slate-500 font-mono">Attempting edge connection to {camName}</span>
          </div>
        ) : (
          <img
            src={frameSrc || `${NGROK_PROXY}/camera/frame/${encodeURIComponent(camName)}?ngrok-skip-browser-warning=true`}
            alt={camName}
            className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-[1.01]"
          />
        )}

        {/* OSD Header Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none font-mono">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-600/90 text-[10px] font-bold text-white uppercase tracking-widest shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" /> REC
            </span>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider drop-shadow-md bg-black/50 px-2 py-0.5 rounded">
              CAM-01 • {camName.replace(/_/g, ' ')}
            </span>
          </div>
          <span className="text-[11px] font-bold text-white bg-black/60 px-2.5 py-1 rounded backdrop-blur-xs">
            {currentTime}
          </span>
        </div>

        {/* OSD Bottom Bar */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI ACTIVE
            </span>
            <span className="text-[10px] text-slate-300 font-mono bg-black/60 px-2 py-0.5 rounded">
              352x288 • 25 FPS
            </span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDownloadSnapshot}
              className="p-1.5 bg-black/70 hover:bg-black text-white rounded-lg transition-colors border border-white/20"
              title="Download Snapshot"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 bg-black/70 hover:bg-black text-white rounded-lg transition-colors border border-white/20"
              title="Full Screen NVR View"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Surveillance Modal */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 md:p-8 animate-fadeIn"
          onClick={() => setIsFullscreen(false)}
        >
          <div className="flex items-center justify-between text-white font-mono text-sm">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded bg-red-600 font-bold text-xs uppercase flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" /> LIVE NVR MONITOR
              </span>
              <span className="text-emerald-400 font-bold tracking-wider">
                {camName.toUpperCase()} — MAIN ENTRANCE GATE
              </span>
            </div>
            <button 
              onClick={() => setIsFullscreen(false)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
            >
              <Minimize2 className="h-6 w-6 text-white" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center my-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <img
              src={frameSrc || `${NGROK_PROXY}/camera/frame/${encodeURIComponent(camName)}`}
              alt={camName}
              className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>RTSP TCP TRANSPORT • INSIGHTFACE 512D ONNX EMBEDDINGS</span>
            <span className="text-white font-bold">{currentTime}</span>
          </div>
        </div>
      )}
    </>
  );
};

const CctvDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<CctvLog[]>([]);
  const [unknownQueue, setUnknownQueue] = useState<EnrollmentItem[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'unknown' | 'history'>('live');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Enroll modal state
  const [selectedUnknown, setSelectedUnknown] = useState<EnrollmentItem | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [enrollStep, setEnrollStep] = useState<'select' | 'sending' | 'done'>('select');

  const stats = {
    entries: logs.filter(l => l.direction === 'entry' && l.userId).length,
    exits: logs.filter(l => l.direction === 'exit' && l.userId).length,
    unknown: unknownQueue.length,
    totalToday: logs.length,
  };

  const fetchLogs = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const [
        { data: logsData, error: logsError },
        { data: unknownData, error: unknownError },
        { data: usersData }
      ] = await Promise.all([
        supabase
          .from('cctv_attendance_logs')
          .select('*')
          .gte('detected_at', today.toISOString())
          .order('detected_at', { ascending: false })
          .limit(100),
        supabase
          .from('cctv_enrollment_queue')
          .select('*')
          .eq('status', 'pending')
          .order('detected_at', { ascending: false })
          .limit(20),
        supabase
          .from('users')
          .select('id, name, biometric_id')
          .order('name', { ascending: true })
          .limit(200),
      ]);

      if (logsError) throw logsError;
      if (unknownError) throw unknownError;

      setLogs((logsData || []).map((l: any) => ({
        id: l.id,
        userId: l.user_id,
        userName: l.user_name,
        cameraName: l.camera_name,
        direction: l.direction,
        confidence: l.confidence,
        detectedAt: l.detected_at,
        snapshotUrl: l.snapshot_url,
        edgeDeviceId: l.edge_device_id,
      })));

      setUnknownQueue((unknownData || []).map((u: any) => ({
        id: u.id,
        cameraName: u.camera_name,
        detectedAt: u.detected_at,
        snapshotUrl: u.snapshot_url,
        status: u.status,
        edgeDeviceId: u.edge_device_id,
      })));

      setUserOptions((usersData || []).map((u: any) => ({
        id: u.id,
        name: u.name || 'Unnamed Employee',
        biometricId: u.biometric_id || null,
      })));
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load CCTV data.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Realtime subscription
  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('cctv-live-dash')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cctv_attendance_logs' }, payload => {
        const l = payload.new as any;
        setLogs(prev => [{
          id: l.id,
          userId: l.user_id,
          userName: l.user_name,
          cameraName: l.camera_name,
          direction: l.direction,
          confidence: l.confidence,
          detectedAt: l.detected_at,
          snapshotUrl: l.snapshot_url,
          edgeDeviceId: l.edge_device_id,
        }, ...prev].slice(0, 100));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cctv_enrollment_queue' }, payload => {
        const u = payload.new as any;
        setUnknownQueue(prev => [{
          id: u.id,
          cameraName: u.camera_name,
          detectedAt: u.detected_at,
          snapshotUrl: u.snapshot_url,
          status: 'pending',
          edgeDeviceId: u.edge_device_id,
        }, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLogs]);

  const handleDismiss = async (id: string) => {
    await supabase
      .from('cctv_enrollment_queue')
      .update({ status: 'dismissed', resolved_at: new Date().toISOString(), resolved_by: user?.id })
      .eq('id', id);
    setUnknownQueue(prev => prev.filter(u => u.id !== id));
    setToast({ message: 'Unknown face dismissed', type: 'success' });
  };

  const handleAssignFace = async () => {
    if (!selectedUnknown || !selectedUserId) {
      setToast({ message: 'Please select an employee to assign.', type: 'error' });
      return;
    }

    setIsAssigning(true);
    setEnrollStep('sending');
    const selectedUserObj = userOptions.find(u => u.id === selectedUserId);

    try {
      const { error } = await supabase
        .from('cctv_enrollment_queue')
        .update({
          status: 'enrolled',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq('id', selectedUnknown.id);
      if (error) throw error;

      if (selectedUnknown.snapshotUrl) {
        try {
          const imgResponse = await fetch(selectedUnknown.snapshotUrl);
          const imgBlob = await imgResponse.blob();

          const formData = new FormData();
          formData.append('user_id', selectedUserId);
          formData.append('user_name', selectedUserObj?.name || 'Employee');
          formData.append('biometric_id', selectedUserObj?.biometricId || '');
          formData.append('department', 'CCTV_ENROLLED');
          formData.append('organization_id', user?.organizationId || '');
          formData.append('photo', new File([imgBlob], 'face.jpg', { type: 'image/jpeg' }));

          await fetch(`${NGROK_PROXY}/camera/enroll`, {
            method: 'POST',
            headers: { 'ngrok-skip-browser-warning': '1', 'x-api-key': 'paradigm-attendance-secret-2024' },
            body: formData,
            signal: AbortSignal.timeout(15000),
          });
        } catch (edgeErr) {
          console.warn('[CCTV Enroll] Edge enrollment warning:', edgeErr);
        }
      }

      setEnrollStep('done');
      setUnknownQueue(prev => prev.filter(u => u.id !== selectedUnknown.id));
      setToast({
        message: `Success! ${selectedUserObj?.name || 'Employee'} assigned and face embedding synced!`,
        type: 'success',
      });
      setSelectedUnknown(null);
      setSelectedUserId('');
      setEnrollStep('select');
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to assign face.', type: 'error' });
      setEnrollStep('select');
    } finally {
      setIsAssigning(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const filteredLogs = logs.filter(
    l =>
      searchTerm === '' ||
      l.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.cameraName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <LoadingScreen message="Loading CCTV surveillance telemetry..." />;

  return (
    <div className="p-4 md:p-6 w-full">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* ── Page Header ── */}
      <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <AdminPageHeader title="CCTV Live Surveillance & Attendance" />
            <p className="text-muted -mt-4 mb-2">
              Real-time video monitor with automated InsightFace biometric punch logging.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={fetchLogs} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh Logs
            </Button>
            <a
              href="#/admin/cctv-devices"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
            >
              <Camera className="h-4 w-4" /> Manage CCTV Devices
            </a>
          </div>
        </div>
      </div>

      {/* ── Metrics Summary Strip (Green & White Theme) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600">
            <ArrowRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Today's Entries</p>
            <h4 className="text-2xl font-bold text-primary-text">{stats.entries}</h4>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600">
            <ArrowLeft className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Today's Exits</p>
            <h4 className="text-2xl font-bold text-primary-text">{stats.exits}</h4>
          </div>
        </div>

        <div className={`bg-card border rounded-xl p-5 shadow-sm flex items-center gap-4 ${stats.unknown > 0 ? 'border-amber-300' : 'border-border'}`}>
          <div className={`p-3 rounded-lg ${stats.unknown > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Unknown Faces</p>
            <h4 className="text-2xl font-bold text-primary-text">{stats.unknown}</h4>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Total Face Punches</p>
            <h4 className="text-2xl font-bold text-primary-text">{stats.totalToday}</h4>
          </div>
        </div>
      </div>

      {/* ── CENTRAL NVR SURVEILLANCE & REALTIME PUNCH STATION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-stretch">
        {/* Left Column: Live NVR Camera Window (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-bold text-primary-text text-sm uppercase tracking-wider">
                  Live CCTV Surveillance Stream
                </h3>
              </div>
              <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                RTSP TCP • MAIN GATE
              </span>
            </div>

            <div className="aspect-video w-full rounded-xl overflow-hidden shadow-inner">
              <NvrCameraStream camName="main_gate_entry" />
            </div>

            <div className="flex items-center justify-between text-xs text-muted mt-3 px-1 pt-2 border-t border-border/70">
              <span className="flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5 text-emerald-600" /> InsightFace 512D AI Engine: Active
              </span>
              <span className="font-mono text-emerald-700 font-semibold">
                MSSQL eTimeTrackLite Sync: ONLINE
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Attendance Ticker (5 cols) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-card rounded-2xl border border-border shadow-sm flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-emerald-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <h3 className="font-bold text-emerald-950 text-sm">Real-Time Face Detections</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {logs.length} Today
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[360px] divide-y divide-border/60">
              {logs.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center p-6">
                  <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                    <Camera className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-bold text-primary-text">Waiting for Gate Activity...</p>
                  <p className="text-xs text-muted mt-1">Camera is scanning for faces in real-time.</p>
                </div>
              ) : (
                logs.slice(0, 15).map(log => (
                  <div key={log.id} className="p-3.5 hover:bg-emerald-50/30 transition-colors flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-extrabold flex-shrink-0 border ${
                      log.userId 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {log.userName ? log.userName.charAt(0).toUpperCase() : '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-primary-text truncate">
                          {log.userName || 'Unknown Person'}
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                          log.direction === 'entry'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {log.direction === 'entry' ? 'IN' : 'OUT'}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-muted" /> {formatTime(log.detectedAt)} • {log.cameraName}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {(log.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS SECTION: All Logs vs Unknown Faces Review ── */}
      <div className="flex items-center gap-2 p-1 bg-gray-100/80 rounded-xl w-fit mb-6 border border-border/80 shadow-2xs">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'live'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-emerald-700 hover:bg-white/80'
          }`}
        >
          <Activity className="h-4 w-4" /> All Gate Logs ({logs.length})
        </button>

        <button
          onClick={() => setActiveTab('unknown')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'unknown'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-emerald-700 hover:bg-white/80'
          }`}
        >
          <AlertTriangle className="h-4 w-4" /> Unknown Faces Review ({unknownQueue.length})
        </button>
      </div>

      {/* Tab 1: All Logs Table */}
      {activeTab === 'live' && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 text-muted absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search logs by employee or camera..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <span className="text-xs text-muted font-medium">Showing {filteredLogs.length} events today</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-emerald-50/60 border-b border-emerald-100 text-emerald-950 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Direction</th>
                  <th className="py-3.5 px-4">Camera Channel</th>
                  <th className="py-3.5 px-4">AI Confidence</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted font-medium">
                      No attendance events found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-primary-text">
                        {log.userName || <span className="text-muted italic">Unknown Person</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          log.direction === 'entry'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {log.direction === 'entry' ? '→ Punch-IN' : '← Punch-OUT'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted font-mono">{log.cameraName}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        {(log.confidence * 100).toFixed(0)}% Match
                      </td>
                      <td className="py-3 px-4 text-muted">{formatTime(log.detectedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Unknown Faces Review Queue */}
      {activeTab === 'unknown' && (
        <div className="space-y-4">
          {unknownQueue.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center bg-card rounded-2xl border border-dashed border-border shadow-sm">
              <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="font-bold text-primary-text text-base">All Clear!</h3>
              <p className="text-xs text-muted mt-1">No unknown faces pending assignment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unknownQueue.map(item => (
                <div key={item.id} className="bg-card rounded-2xl border border-amber-200 p-4 shadow-sm space-y-3">
                  <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border border-border">
                    {item.snapshotUrl ? (
                      <img src={item.snapshotUrl} alt="Unknown face" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted">
                        <Eye className="h-8 w-8 text-amber-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-amber-800">{item.cameraName}</span>
                    <span className="text-muted">{formatTime(item.detectedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      onClick={() => { setSelectedUnknown(item); setSelectedUserId(''); }}
                      className="flex-1 text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign Face
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDismiss(item.id)}
                      className="text-xs h-9 text-muted hover:text-red-500"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assign Face Modal */}
      <Modal
        isOpen={!!selectedUnknown}
        onClose={() => setSelectedUnknown(null)}
        onConfirm={handleAssignFace}
        title="Assign Face to Employee Profile"
        confirmButtonText={isAssigning ? 'Syncing...' : 'Confirm & Sync Face Vector'}
        confirmButtonVariant="primary"
        isLoading={isAssigning}
      >
        <div className="space-y-4 py-2">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
            Select the employee who matches this face photo. The edge server will extract their 512D biometric vector for future automated attendance punches.
          </div>
          <div>
            <label className="block text-xs font-bold text-primary-text mb-2 uppercase">Select Employee *</label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Choose employee --</option>
              {userOptions.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.biometricId ? `(Code: ${u.biometricId})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CctvDashboard;
