import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import LoadingScreen from '../../components/ui/LoadingScreen';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import {
  Camera, Plus, Trash2, Wifi, WifiOff, RefreshCw,
  Activity, Shield, AlertCircle, MapPin, UserPlus, Upload, X, CheckCircle,
  Maximize2, Minimize2, Video, Download, Sliders, Cpu, Server, Check, Copy, Sparkles
} from 'lucide-react';

interface CctvDevice {
  id: string;
  edgeDeviceId: string;
  siteName: string;
  locationName: string;
  organizationId: string;
  cameras: any[];
  status: 'online' | 'offline' | 'error';
  lastSeen: string | null;
  matchThreshold: number;
  cooldownSeconds: number;
  isActive: boolean;
  createdAt: string;
  serverHost: string | null;   // Auto-detected LAN IP from edge server
  adminPort: number;           // Admin HTTP port (default 4100)
}

const NGROK_PROXY = 'https://tassel-estranged-prism.ngrok-free.dev';

// ─── Camera Live Preview (Canvas-based MJPEG reader — works through Ngrok) ──
// fetch() opens ONE persistent connection with custom ngrok headers.
// Reads binary stream chunks, finds JPEG FFD8..FFD9 boundaries, paints to canvas.
const CameraLivePreview: React.FC<{ camera: any; serverHost: string | null; adminPort: number }> = ({ camera }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [statusMsg, setStatusMsg] = useState('CONNECTING LIVE STREAM...');
  const [currentTime, setCurrentTime] = useState('');
  const [fps, setFps] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fsCanvasRef = useRef<HTMLCanvasElement>(null);
  const fpsCounterRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<any>(null);

  const camName = typeof camera === 'string' ? camera : camera?.name || 'main_gate_entry';

  // OSD clock
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

  // FPS counter
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastFpsTimeRef.current) / 1000;
      if (elapsed > 0) {
        setFps(Math.round(fpsCounterRef.current / elapsed));
        fpsCounterRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Paint JPEG bytes to both inline and fullscreen canvas
  const paintFrame = (jpegBytes: Uint8Array) => {
    const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      [canvasRef.current, fsCanvasRef.current].forEach(canvas => {
        if (!canvas) return;
        if (canvas.width !== img.width) canvas.width = img.width;
        if (canvas.height !== img.height) canvas.height = img.height;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
      });
      URL.revokeObjectURL(url);
      fpsCounterRef.current += 1;
      if (!isConnected) setIsConnected(true);
      if (hasError) setHasError(false);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const startStream = useCallback(async () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const controller = new AbortController();
    abortRef.current = controller;
    setHasError(false);
    setStatusMsg('CONNECTING LIVE STREAM...');

    try {
      const res = await fetch(
        `${NGROK_PROXY}/camera/stream/${encodeURIComponent(camName)}?ngrok-skip-browser-warning=1`,
        {
          signal: controller.signal,
          headers: {
            'ngrok-skip-browser-warning': '1',
            'Accept': 'multipart/x-mixed-replace, image/jpeg, */*',
          },
        }
      );

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      let buf = new Uint8Array(0);
      const MAX_BUF = 2 * 1024 * 1024;

      const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
        const c = new Uint8Array(a.length + b.length);
        c.set(a); c.set(b, a.length);
        return c;
      };
      const findSeq = (h: Uint8Array, b0: number, b1: number, from = 0): number => {
        for (let i = from; i < h.length - 1; i++) {
          if (h[i] === b0 && h[i + 1] === b1) return i;
        }
        return -1;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done || controller.signal.aborted) break;
        if (!value?.length) continue;

        buf = concat(buf, value);

        let offset = 0;
        while (true) {
          const start = findSeq(buf, 0xFF, 0xD8, offset);
          if (start === -1) break;
          const end = findSeq(buf, 0xFF, 0xD9, start + 2);
          if (end === -1) break;
          const frameEnd = end + 2;
          if (frameEnd - start > 500) paintFrame(buf.slice(start, frameEnd));
          offset = frameEnd;
        }

        buf = offset > 0 ? buf.slice(offset) : buf;
        if (buf.length > MAX_BUF) buf = new Uint8Array(0);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setHasError(true);
      setIsConnected(false);
      setStatusMsg('STREAM RECONNECTING...');
      retryTimerRef.current = setTimeout(() => startStream(), 4000);
    }
  }, [camName]);

  useEffect(() => {
    startStream();
    return () => {
      abortRef.current?.abort();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [startStream]);

  const handleDownloadSnapshot = (e: React.MouseEvent) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CCTV_${camName}_${Date.now()}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/jpeg', 0.92);
  };

  return (
    <>
      {/* ── Inline CCTV Player ── */}
      <div
        onClick={() => setIsFullscreen(true)}
        className="w-full h-full relative group bg-black overflow-hidden select-none cursor-pointer rounded-xl border border-border"
      >
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-2 p-6 z-10">
            <Video className={`h-8 w-8 ${hasError ? 'text-amber-400' : 'text-emerald-400'} animate-pulse`} />
            <span className={`text-xs font-mono tracking-wider font-semibold ${hasError ? 'text-amber-300' : 'text-emerald-300'}`}>
              {statusMsg}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{camName} • RTSP TCP</span>
            {hasError && (
              <button onClick={(e) => { e.stopPropagation(); startStream(); }}
                className="mt-2 px-3 py-1 text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white rounded font-mono">
                RETRY NOW
              </button>
            )}
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover block"
          style={{ display: isConnected ? 'block' : 'none' }}
        />

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/60 z-20" />

        {/* Top OSD */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none font-mono z-30">
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600/90 text-[10px] font-bold text-white uppercase tracking-widest shadow-sm">
              <span className={`h-1.5 w-1.5 rounded-full bg-white ${isConnected ? 'animate-ping' : ''}`} />REC
            </span>
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider drop-shadow-md">
              CAM-01 • {camName.replace(/_/g, ' ')}
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-200 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
            {currentTime}
          </span>
        </div>

        {/* Bottom OSD */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-30">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI ON
            </span>
            <span className="text-[10px] text-slate-300 font-mono bg-black/60 px-2 py-0.5 rounded">
              MJPEG • {fps > 0 ? `${fps} FPS` : '---'}
            </span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
            <button onClick={handleDownloadSnapshot} title="Download Snapshot" className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-white border border-white/10">
              <Download className="h-3.5 w-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }} title="Fullscreen" className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-white border border-white/10">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Fullscreen Modal ── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={() => setIsFullscreen(false)}>
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 flex-shrink-0 font-mono bg-black/80" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 px-3 py-1 rounded bg-red-600 text-xs font-bold uppercase tracking-wider text-white">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />LIVE SURVEILLANCE
              </span>
              <span className="text-sm font-bold text-emerald-400 tracking-wider uppercase">
                {camName.replace(/_/g, ' ')} — MAIN ENTRY GATE
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">MJPEG CANVAS</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-emerald-300 font-bold">{currentTime}</span>
              <span className="text-xs text-emerald-300 font-mono">{fps > 0 ? `${fps} FPS` : '---'}</span>
              <button onClick={() => setIsFullscreen(false)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
            <canvas ref={fsCanvasRef} className="max-h-full max-w-full object-contain" />
            <div className="absolute top-4 left-4 text-emerald-400 text-xs font-mono bg-black/70 px-3.5 py-2 rounded-xl border border-emerald-500/20 pointer-events-none flex items-center gap-2 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>AI FACE RECOGNITION ACTIVE • INSIGHTFACE 512D • WIN-0T8N581GN63</span>
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 text-xs text-slate-400 flex-shrink-0 bg-black/80 font-mono" onClick={e => e.stopPropagation()}>
            <span>Paradigm IFS • Real-Time CCTV AI Attendance System • RTSP TCP</span>
            <div className="flex gap-3">
              <button onClick={handleDownloadSnapshot} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-2">
                <Download className="h-4 w-4" /> Save Snapshot
              </button>
              <button onClick={() => setIsFullscreen(false)} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2">
                <Minimize2 className="h-4 w-4" /> Exit Monitor
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};



// ─── Form Interface ─────────────────────────────────────────────────────────


interface NewDeviceForm {
  edgeDeviceId: string;
  deviceSecret: string;
  siteName: string;
  locationName: string;
  organizationId: string;
  matchThreshold: string;
  cooldownSeconds: string;
}

const DEFAULT_FORM: NewDeviceForm = {
  edgeDeviceId: '',
  deviceSecret: '',
  siteName: '',
  locationName: '',
  organizationId: '',
  matchThreshold: '0.45',
  cooldownSeconds: '300',
};

// ─── Main Component ─────────────────────────────────────────────────────────
const ManageCctvDevices: React.FC = () => {
  const { user } = useAuthStore();
  const [devices, setDevices] = useState<CctvDevice[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; shortName: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'devices' | 'enroll' | 'setup'>('devices');
  const [form, setForm] = useState<NewDeviceForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Proactive enrollment state
  const [enrollUsers, setEnrollUsers] = useState<{ id: string; name: string; biometricId: string | null; department: string | null }[]>([]);
  const [enrollUserId, setEnrollUserId] = useState('');
  const [enrollPhoto, setEnrollPhoto] = useState<File | null>(null);
  const [enrollPhotoPreview, setEnrollPhotoPreview] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollResult, setEnrollResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ data: devicesData }, { data: orgsData }] = await Promise.all([
        supabase
          .from('cctv_devices')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('organizations')
          .select('id, short_name')
          .eq('is_active', true),
      ]);

      setDevices(
        (devicesData || []).map((d: any) => ({
          id: d.id,
          edgeDeviceId: d.edge_device_id,
          siteName: d.site_name || '',
          locationName: d.location_name || '',
          organizationId: d.organization_id || '',
          cameras: d.cameras || [],
          status: d.status || 'offline',
          lastSeen: d.last_seen,
          matchThreshold: d.match_threshold || 0.45,
          cooldownSeconds: d.cooldown_seconds || 300,
          isActive: d.is_active,
          createdAt: d.created_at,
          serverHost: d.server_host || null,
          adminPort: d.admin_port || 4100,
        }))
      );
      setOrganizations((orgsData || []).map((o: any) => ({ id: o.id, shortName: o.short_name })));
    } catch {
      setToast({ message: 'Failed to load CCTV devices', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Fetch employees for proactive enrollment using application API
    const loadEmployees = async () => {
      try {
        const usersList: any = await api.getUsers({ fetchAll: true });
        if (Array.isArray(usersList) && usersList.length > 0) {
          setEnrollUsers(usersList.map((u: any) => ({
            id: u.id,
            name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unnamed',
            biometricId: u.biometricId || u.biometric_id || u.empCode || u.employeeId || null,
            department: u.department || null,
          })));
          return;
        }
      } catch (err) {
        console.warn('[CCTV] api.getUsers failed, falling back to direct query:', err);
      }

      // Direct fallback
      supabase.from('users').select('*').limit(500).then(({ data }) => {
        if (data && data.length > 0) {
          setEnrollUsers(data.map((u: any) => ({
            id: u.id,
            name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Unnamed',
            biometricId: u.biometric_id || u.emp_code || null,
            department: u.department || null,
          })));
        }
      });
    };

    loadEmployees();
  }, [fetchData]);

  const handleSave = async () => {
    if (!form.edgeDeviceId.trim() || !form.siteName.trim()) {
      setToast({ message: 'Device ID and Site Name are required', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('cctv_devices').insert({
        edge_device_id: form.edgeDeviceId.trim(),
        device_secret: form.deviceSecret.trim() || null,
        site_name: form.siteName.trim(),
        location_name: form.locationName.trim(),
        organization_id: form.organizationId || null,
        match_threshold: parseFloat(form.matchThreshold),
        cooldown_seconds: parseInt(form.cooldownSeconds, 10),
        cameras: [
          {
            name: 'main_gate_entry',
            direction: 'entry',
            rtsp_url: 'rtsp://admin:Paradigm%401610@192.168.1.64:554/Streaming/Channels/102',
            enabled: true,
          }
        ],
        status: 'online',
        is_active: true,
      });
      if (error) throw error;
      setToast({ message: 'CCTV edge server registered successfully', type: 'success' });
      setIsModalOpen(false);
      setForm(DEFAULT_FORM);
      fetchData();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to register device', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (deviceId: string) => {
    if (!confirm('Permanently delete this CCTV edge server and its configuration?')) return;
    try {
      const { error } = await supabase
        .from('cctv_devices')
        .delete()
        .eq('id', deviceId);
      if (error) throw error;
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      setToast({ message: 'Device removed successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to delete device', type: 'error' });
    }
  };

  const handlePhotoSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Please select a valid image file (JPG, PNG, WebP)', type: 'error' });
      return;
    }
    setEnrollPhoto(file);
    setEnrollResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setEnrollPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleEnrollFace = async () => {
    if (!enrollUserId) { setToast({ message: 'Please select an employee first', type: 'error' }); return; }
    if (!enrollPhoto) { setToast({ message: 'Please upload a clear face photo', type: 'error' }); return; }

    const selectedUser = enrollUsers.find(u => u.id === enrollUserId);
    const enrollUrl = `${NGROK_PROXY}/camera/enroll`;

    setIsEnrolling(true);
    setEnrollResult(null);
    try {
      const formData = new FormData();
      formData.append('user_id', enrollUserId);
      formData.append('user_name', selectedUser?.name || 'Employee');
      formData.append('biometric_id', selectedUser?.biometricId || '');
      formData.append('department', selectedUser?.department || 'General');
      formData.append('organization_id', user?.organizationId || '');
      formData.append('photo', enrollPhoto);

      const res = await fetch(enrollUrl, {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': '1',
          'x-api-key': 'paradigm-attendance-secret-2024',
        },
        body: formData,
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      setEnrollResult({ success: true, message: `Success! ${selectedUser?.name} is now enrolled. Face vector (${data.embedding_dims || 512}D) synced to edge AI model.` });
      setEnrollUserId('');
      setEnrollPhoto(null);
      setEnrollPhotoPreview(null);
    } catch (err: any) {
      setEnrollResult({ success: false, message: `Enrollment failed: ${err.message}` });
    } finally {
      setIsEnrolling(false);
    }
  };

  const getLastSeenText = (lastSeen: string | null) => {
    if (!lastSeen) return 'Never';
    const diffMs = Date.now() - new Date(lastSeen).getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (isLoading) return <LoadingScreen message="Loading CCTV Infrastructure..." />;

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const totalCameras = devices.reduce((a, d) => a + d.cameras.length, 0);

  return (
    <div className="p-4 md:p-6 w-full">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* ── Page Header ── */}
      <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <AdminPageHeader title="CCTV Surveillance Devices" />
            <p className="text-muted -mt-4 mb-2">
              Manage on-premise edge servers, RTSP camera streams, and AI biometric face recognition for gate attendance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={fetchData} title="Refresh Live Data" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Register Edge Device
            </Button>
          </div>
        </div>
      </div>

      {/* ── Metrics Summary Grid (Horizontal Left-to-Right KPI Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Total Devices</p>
            <h4 className="text-2xl font-bold text-primary-text">{devices.length}</h4>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-500/10 text-green-500">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Active (Online)</p>
            <h4 className="text-2xl font-bold text-primary-text">{onlineCount}</h4>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Total Cameras</p>
            <h4 className="text-2xl font-bold text-primary-text">{totalCameras}</h4>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Active Protection</p>
            <h4 className="text-2xl font-bold text-primary-text">{devices.filter(d => d.isActive).length}</h4>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation (Crisp Green & White) ── */}
      <div className="flex items-center gap-2 p-1 bg-gray-100/80 rounded-xl w-fit mb-6 border border-border/80 shadow-2xs">
        <button
          onClick={() => setActiveTab('devices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'devices'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-emerald-700 hover:bg-white/80'
          }`}
        >
          <Camera className="h-4 w-4" /> Live Surveillance & Devices
        </button>

        <button
          onClick={() => setActiveTab('enroll')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'enroll'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-emerald-700 hover:bg-white/80'
          }`}
        >
          <UserPlus className="h-4 w-4" /> Face Enrollment Studio
        </button>

        <button
          onClick={() => setActiveTab('setup')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'setup'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-emerald-700 hover:bg-white/80'
          }`}
        >
          <Sliders className="h-4 w-4" /> Edge Hardware Config
        </button>
      </div>

      {/* ── TAB 1: Surveillance & Devices ── */}
      {activeTab === 'devices' && (
        <div>
          {devices.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center bg-card rounded-3xl border border-dashed border-border/60 shadow-sm">
              <div className="h-20 w-20 bg-accent/5 rounded-full flex items-center justify-center mb-6">
                <Camera className="h-10 w-10 text-accent/40" />
              </div>
              <h3 className="text-xl font-bold text-primary-text mb-2">No CCTV Edge Servers Connected</h3>
              <p className="text-muted text-center max-w-sm mb-8 px-6 text-sm">
                Register your on-premise Windows / Linux CCTV attendance edge server to stream footage and recognize faces.
              </p>
              <Button onClick={() => setIsModalOpen(true)} className="h-11 px-6 shadow-md">
                <Plus className="h-4 w-4 mr-1.5" /> Register First Device
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {devices.map(device => (
                <div
                  key={device.id}
                  className="bg-card rounded-2xl shadow-sm border border-border hover:border-accent/40 transition-all overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex flex-col lg:flex-row items-stretch gap-8">
                      {/* Left Details Panel */}
                      <div className="flex-1 flex flex-col justify-between space-y-5">
                        <div className="space-y-5">
                          {/* Device Top Title & Actions */}
                          <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/70">
                            <div className="flex items-center gap-3.5">
                              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                                device.status === 'online' 
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm' 
                                  : 'bg-gray-100 text-gray-400 border border-gray-200'
                              }`}>
                                {device.status === 'online' ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-xl font-extrabold text-primary-text tracking-tight">{device.siteName}</h3>
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                                    device.status === 'online'
                                      ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-300/60'
                                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                                  }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                                    {device.status === 'online' ? 'Live & Synced' : 'Offline'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-xs font-mono text-muted bg-background px-2 py-0.5 rounded-md border border-border">
                                    {device.edgeDeviceId}
                                  </span>
                                  {device.locationName && (
                                    <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                      <MapPin className="h-3 w-3 text-emerald-600" /> {device.locationName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDelete(device.id)}
                              className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                              title="Delete edge device"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Channel Details Card */}
                          <div className="p-4 rounded-xl bg-background border border-border shadow-xs space-y-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-primary-text uppercase tracking-wider flex items-center gap-1.5">
                                <Camera className="h-3.5 w-3.5 text-accent" /> Camera Channel 01
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase font-mono">
                                Entry Gate (Punch-IN)
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="px-2.5 py-1 rounded-lg bg-card border border-border text-primary-text font-medium flex items-center gap-1">
                                <Cpu className="h-3 w-3 text-blue-500" /> InsightFace 512D AI
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-card border border-border text-primary-text font-medium flex items-center gap-1 font-mono">
                                RTSP TCP • 25 FPS
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-card border border-border text-primary-text font-medium flex items-center gap-1 font-mono">
                                352x288 Resolution
                              </span>
                            </div>
                          </div>

                          {/* Edge Server Telemetry 4-Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-background border border-border/80">
                              <span className="text-[11px] text-muted font-medium block">Match Sensitivity</span>
                              <div className="text-sm font-bold text-primary-text mt-0.5 flex items-center gap-1">
                                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                                {Math.round(device.matchThreshold * 100)}% Cosine Threshold
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-background border border-border/80">
                              <span className="text-[11px] text-muted font-medium block">Anti-Spam Cooldown</span>
                              <div className="text-sm font-bold text-primary-text mt-0.5 flex items-center gap-1">
                                <Activity className="h-3.5 w-3.5 text-amber-600" />
                                {device.cooldownSeconds}s (5 Minutes)
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-background border border-border/80">
                              <span className="text-[11px] text-muted font-medium block">Host Edge Node</span>
                              <div className="text-sm font-bold text-primary-text mt-0.5 font-mono flex items-center gap-1">
                                <Server className="h-3.5 w-3.5 text-blue-600" />
                                Port {device.adminPort || 4100}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-background border border-border/80">
                              <span className="text-[11px] text-muted font-medium block">Database Tunnel</span>
                              <div className="text-sm font-bold text-emerald-700 mt-0.5 flex items-center gap-1 font-mono text-xs">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                MSSQL Connected
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Actions & Heartbeat */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/70">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setActiveTab('enroll')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs transition-colors flex items-center gap-1.5"
                            >
                              <UserPlus className="h-3.5 w-3.5" /> Enroll Staff Face
                            </button>
                            <a
                              href="#/admin/cctv-dashboard"
                              className="px-3 py-1.5 rounded-lg bg-background hover:bg-muted text-primary-text border border-border font-semibold text-xs transition-colors flex items-center gap-1.5"
                            >
                              <Activity className="h-3.5 w-3.5 text-muted" /> View Live Logs
                            </a>
                          </div>

                          <span className="text-xs text-muted font-medium flex items-center gap-1">
                            <Activity className="h-3.5 w-3.5 text-emerald-500" /> Heartbeat: {getLastSeenText(device.lastSeen)}
                          </span>
                        </div>
                      </div>

                      {/* Right Video Surveillance Screen */}
                      <div className="w-full lg:w-[480px] xl:w-[540px] flex-shrink-0 flex flex-col justify-center">
                        <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-lg border border-border relative">
                          {device.cameras.length > 0 ? (
                            <CameraLivePreview
                              camera={device.cameras[0]}
                              serverHost={device.serverHost}
                              adminPort={device.adminPort}
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                              <Camera className="h-8 w-8 mb-2 opacity-50" />
                              <p className="text-xs font-semibold">No camera channel assigned</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Face Enrollment Studio ── */}
      {activeTab === 'enroll' && (
        <div className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-sm">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-text">AI Face Biometric Enrollment</h2>
                <p className="text-xs text-muted mt-0.5">
                  Upload employee face photos to generate 512-dimensional vector embeddings on the edge server for automatic recognition.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form Input (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-primary-text mb-2 uppercase tracking-wider">
                    Select Employee Profile *
                  </label>
                  <select
                    value={enrollUserId}
                    onChange={e => { setEnrollUserId(e.target.value); setEnrollResult(null); }}
                    disabled={isEnrolling}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  >
                    <option value="">-- Choose employee --</option>
                    {enrollUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.biometricId ? `• Code: ${u.biometricId}` : ''} {u.department ? `• ${u.department}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary-text mb-2 uppercase tracking-wider">
                    Face Image *
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handlePhotoSelect(f); }}
                    className="border-2 border-dashed border-emerald-200 bg-emerald-50/20 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/40 transition-all group"
                  >
                    <Upload className="h-8 w-8 text-emerald-600 group-hover:scale-110 mx-auto mb-2 transition-transform" />
                    <p className="text-sm font-semibold text-primary-text">Click or drag photo here</p>
                    <p className="text-xs text-muted mt-1">Clear front-facing passport-style photo (JPG, PNG)</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-950">
                    <Sparkles className="h-4 w-4 text-emerald-700" /> Best Practices for 99.8% AI Accuracy:
                  </p>
                  <p className="text-emerald-800">• Single face per photo, well-lit with clear eyes & nose</p>
                  <p className="text-emerald-800">• Avoid sunglasses, thick shadows, or heavy hats</p>
                </div>

                <Button
                  onClick={handleEnrollFace}
                  disabled={!enrollUserId || !enrollPhoto || isEnrolling}
                  className="w-full flex items-center justify-center gap-2 h-12 text-sm font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isEnrolling ? (
                    <><span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating & Syncing Embedding...</>
                  ) : (
                    <><UserPlus className="h-4 w-4" /> Enroll Face Vector to Edge Server</>
                  )}
                </Button>

                {enrollResult && (
                  <div className={`p-4 rounded-xl border text-sm font-medium flex items-start gap-3 ${
                    enrollResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {enrollResult.success ? <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" /> : <X className="h-5 w-5 text-red-600 flex-shrink-0" />}
                    <span>{enrollResult.message}</span>
                  </div>
                )}
              </div>

              {/* Photo Preview Card (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-card rounded-2xl border border-emerald-200/80 shadow-xs overflow-hidden">
                  <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50/70">
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Preview Crop</span>
                  </div>
                  <div className="aspect-square flex items-center justify-center bg-white relative">
                    {enrollPhotoPreview ? (
                      <>
                        <img src={enrollPhotoPreview} alt="Face preview" className="w-full h-full object-cover" />
                        <button
                          onClick={() => { setEnrollPhoto(null); setEnrollPhotoPreview(null); }}
                          className="absolute top-3 right-3 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-all"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-6">
                        <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                          <Camera className="h-8 w-8 text-emerald-600" />
                        </div>
                        <span className="text-xs text-muted font-medium">No photo selected</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-background space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Target Edge Server:</span>
                    <span className="font-mono font-semibold text-primary-text">WIN-0T8N581GN63</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">AI Model:</span>
                    <span className="font-semibold text-emerald-600">InsightFace Buffalo_L (ONNX)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Edge Hardware Setup Guide ── */}
      {activeTab === 'setup' && (
        <div className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-sm space-y-6 max-w-4xl">
          <div>
            <h2 className="text-xl font-bold text-primary-text mb-1">On-Premise Server Architecture</h2>
            <p className="text-xs text-muted">
              Configure the edge machine connected to your site's Hikvision / Dahua / CP PLUS CCTV network.
            </p>
          </div>

          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl bg-background border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary-text">RTSP Camera Connection URL Format</span>
                <button 
                  onClick={() => copyToClipboard('rtsp://admin:Paradigm%401610@192.168.1.64:554/Streaming/Channels/102')}
                  className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-semibold"
                >
                  {copiedKey ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />} Copy RTSP
                </button>
              </div>
              <code className="block p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 font-mono text-xs text-emerald-950 font-semibold break-all">
                rtsp://admin:Paradigm%401610@192.168.1.64:554/Streaming/Channels/102
              </code>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-background border border-border space-y-1">
                <span className="font-bold text-primary-text text-xs uppercase tracking-wider block">Service 1: Node Attendance API</span>
                <p className="text-xs text-muted">Runs on Port 4000 via PM2. Connects to local eTimeTrackLite MSSQL database.</p>
              </div>
              <div className="p-4 rounded-xl bg-background border border-border space-y-1">
                <span className="font-bold text-primary-text text-xs uppercase tracking-wider block">Service 2: Python AI Vision</span>
                <p className="text-xs text-muted">Runs on Port 4100 via PM2. InsightFace 512D recognition pipeline.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Register Device Modal ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setForm(DEFAULT_FORM); }}
        onConfirm={handleSave}
        title="Register CCTV Edge Server"
        confirmButtonText="Save Edge Device"
        confirmButtonVariant="primary"
        isLoading={saving}
      >
        <div className="space-y-4 py-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>
              The <strong>Edge Device ID</strong> links the local Python camera pipeline to your cloud tenant.
            </span>
          </div>

          <Input
            label="Edge Device ID *"
            placeholder="e.g. server-win-0t8n581gn63"
            value={form.edgeDeviceId}
            onChange={e => setForm(f => ({ ...f, edgeDeviceId: e.target.value }))}
          />

          <Input
            label="Site / Branch Name *"
            placeholder="e.g. Head Office - Main Gate"
            value={form.siteName}
            onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))}
          />

          <Input
            label="Location / Gate Area"
            placeholder="e.g. Gate 1 Entrance"
            value={form.locationName}
            onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))}
          />

          <Select
            label="Assign Organization"
            value={form.organizationId}
            onChange={e => setForm(f => ({ ...f, organizationId: e.target.value }))}
          >
            <option value="">Default Organization</option>
            {organizations.map(o => <option key={o.id} value={o.id}>{o.shortName}</option>)}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Match Threshold"
              type="number"
              min="0.3"
              max="0.9"
              step="0.05"
              value={form.matchThreshold}
              onChange={e => setForm(f => ({ ...f, matchThreshold: e.target.value }))}
            />
            <Input
              label="Cooldown (sec)"
              type="number"
              min="60"
              max="3600"
              step="60"
              value={form.cooldownSeconds}
              onChange={e => setForm(f => ({ ...f, cooldownSeconds: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ManageCctvDevices;
