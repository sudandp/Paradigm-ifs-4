import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import LoadingScreen from '../../components/ui/LoadingScreen';
import {
  Camera, Plus, Trash2, Wifi, WifiOff, RefreshCw,
  Activity, Shield, AlertCircle, MapPin, UserPlus, Upload, X, CheckCircle,
  Maximize2, Minimize2, Video, Download
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

const CameraLivePreview: React.FC<{ camera: any; serverHost: string | null; adminPort: number }> = ({ camera, serverHost, adminPort }) => {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [isLive, setIsLive] = React.useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
  const [currentTime, setCurrentTime] = React.useState<string>('');
  const prevBlobRef = React.useRef<string | null>(null);
  const failCountRef = React.useRef<number>(0);

  const camName = typeof camera === 'string' ? camera : camera?.name || 'main_gate_entry';
  const NGROK_PROXY = 'https://tassel-estranged-prism.ngrok-free.dev';
  const frameUrl = `${NGROK_PROXY}/camera/frame/${camName}`;

  // Live CCTV OSD Clock (e.g. 2026-08-11 17:35:00)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      setCurrentTime(timeStr);
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Frame Poller with zero-flicker buffer & auto-recovery
  useEffect(() => {
    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout>;

    const fetchFrame = async () => {
      const url = `${frameUrl}?t=${Date.now()}`;
      try {
        const res = await fetch(url, {
          headers: {
            'ngrok-skip-browser-warning': '1',
            'x-api-key': 'paradigm-attendance-secret-2024',
          },
          signal: AbortSignal.timeout(12000), // 12s timeout to prevent premature aborts
        });

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('image')) {
            const blob = await res.blob();
            const newUrl = URL.createObjectURL(blob);
            if (isMounted) {
              setBlobUrl(newUrl);
              setIsLive(true);
              failCountRef.current = 0;
              if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
              prevBlobRef.current = newUrl;
            } else {
              URL.revokeObjectURL(newUrl);
            }
          }
        } else {
          failCountRef.current += 1;
          if (failCountRef.current > 5 && isMounted) setIsLive(false);
        }
      } catch {
        failCountRef.current += 1;
        if (failCountRef.current > 5 && isMounted) setIsLive(false);
      }

      if (isMounted) timerId = setTimeout(fetchFrame, 1200);
    };

    fetchFrame();
    return () => {
      isMounted = false;
      clearTimeout(timerId);
      if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
    };
  }, [frameUrl]);

  // Snapshot download
  const handleDownloadSnapshot = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `CCTV_${camName}_${Date.now()}.jpg`;
    a.click();
  };

  return (
    <>
      {/* ── Standard / Card CCTV View ── */}
      <div className="w-full h-full relative group bg-black overflow-hidden select-none font-mono">
        {blobUrl ? (
          <img
            src={blobUrl}
            alt={camName}
            className="w-full h-full object-cover block filter contrast-[1.05]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 text-xs gap-2">
            <Video className="h-7 w-7 text-emerald-500 animate-pulse" />
            <span className="tracking-widest uppercase text-[11px] text-emerald-400">Connecting Camera Feed...</span>
          </div>
        )}

        {/* CCTV Scanline / OSD Vignette Effect */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-black/60" />

        {/* ── Top OSD Overlay ── */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[10px] text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600/80 backdrop-blur-sm text-[9px] font-bold text-white uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-white animate-ping" />
              LIVE
            </span>
            <span className="font-bold tracking-wider text-emerald-400 uppercase drop-shadow">
              CAM-01 • {camName.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="text-[10px] tracking-wider text-emerald-300 font-bold bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
            {currentTime}
          </div>
        </div>

        {/* ── Center Crosshairs (Subtle Authentic CCTV Overlay) ── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-8 h-8 border border-white/60 rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        </div>

        {/* ── Bottom OSD & Action Controls Bar ── */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white/90 drop-shadow">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 pointer-events-none">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-slate-300 text-[9px]">1080P • 15 FPS • FACE AI ACTIVE</span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-md p-1 rounded-lg border border-white/15">
            <button
              onClick={handleDownloadSnapshot}
              title="Save Snapshot"
              className="p-1.5 rounded hover:bg-white/20 text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsFullscreen(true)}
              title="Fullscreen Mode"
              className="p-1.5 rounded hover:bg-white/20 text-white transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Fullscreen Theater Modal ── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col justify-between p-4 font-mono select-none">
          {/* Header */}
          <div className="flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 px-3 py-1 rounded bg-red-600 text-xs font-bold uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                LIVE CCTV SURVEILLANCE
              </span>
              <span className="text-sm font-bold text-emerald-400 tracking-wider uppercase">
                {camName.replace(/_/g, ' ')} — MAIN ENTRANCE
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-emerald-300 font-bold">{currentTime}</span>
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Full Camera Screen */}
          <div className="flex-1 my-4 relative rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
            {blobUrl ? (
              <img src={blobUrl} alt={camName} className="w-full h-full object-contain" />
            ) : (
              <span className="text-emerald-400 animate-pulse text-sm">Connecting Stream...</span>
            )}
            <div className="absolute top-4 left-4 text-emerald-400 text-xs drop-shadow bg-black/60 px-3 py-1.5 rounded-lg border border-white/10">
              ● RESOLUTION: 1920x1080 • BITRATE: AUTO • AI FACE RECOGNITION: ENABLED
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
            <span>Paradigm IFS CCTV Attendance System • Server WIN-0T8N581GN63</span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadSnapshot}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-sans text-xs font-bold flex items-center gap-2 transition-colors"
              >
                <Download className="h-4 w-4" /> Download Snapshot
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="px-4 py-2 rounded-xl bg-accent text-white font-sans text-xs font-bold hover:bg-accent/90 transition-colors"
              >
                Close Fullscreen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

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

const ManageCctvDevices: React.FC = () => {
  const { user } = useAuthStore();
  const [devices, setDevices] = useState<CctvDevice[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; shortName: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
        cameras: [],
        status: 'offline',
        is_active: true,
      });
      if (error) throw error;
      setToast({ message: 'CCTV device registered successfully', type: 'success' });
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
    if (!confirm('Permanently delete this CCTV device?')) return;
    try {
      const { error } = await supabase
        .from('cctv_devices')
        .delete()
        .eq('id', deviceId);
      if (error) throw error;
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      setToast({ message: 'Device deleted successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to delete device', type: 'error' });
    }
  };

  const handlePhotoSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Please select a valid image file (JPG, PNG)', type: 'error' });
      return;
    }
    setEnrollPhoto(file);
    setEnrollResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setEnrollPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleEnrollFace = async () => {
    if (!enrollUserId) { setToast({ message: 'Select an employee first', type: 'error' }); return; }
    if (!enrollPhoto) { setToast({ message: 'Upload a face photo first', type: 'error' }); return; }

    const selectedUser = enrollUsers.find(u => u.id === enrollUserId);
    const NGROK_PROXY = 'https://tassel-estranged-prism.ngrok-free.dev';
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
      setEnrollResult({ success: true, message: `✅ ${selectedUser?.name} enrolled! ${data.embedding_dims || 512}D embedding stored on edge server.` });
      setEnrollUserId('');
      setEnrollPhoto(null);
      setEnrollPhotoPreview(null);
    } catch (err: any) {
      setEnrollResult({ success: false, message: `❌ Enrollment failed: ${err.message}` });
    } finally {
      setIsEnrolling(false);
    }
  };

  const getLastSeenText = (lastSeen: string | null) => {
    if (!lastSeen) return 'Never';
    const diffMs = Date.now() - new Date(lastSeen).getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  };

  if (isLoading) return <LoadingScreen message="Loading CCTV devices..." />;

  return (
    <div className="p-4 md:p-8">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-extrabold text-primary-text tracking-tight">CCTV Devices</h1>
          <p className="text-muted mt-1">Manage edge servers and CCTV cameras for automatic site attendance.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchData} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 h-11 px-6 shadow-lg shadow-accent/20">
            <Plus className="h-5 w-5" /> Register Device
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Devices', value: devices.length, icon: <Camera className="h-5 w-5 text-accent" />, bg: 'bg-accent/5' },
          { label: 'Online', value: devices.filter(d => d.status === 'online').length, icon: <Wifi className="h-5 w-5 text-emerald-500" />, bg: 'bg-emerald-50' },
          { label: 'Total Cameras', value: devices.reduce((a, d) => a + d.cameras.length, 0), icon: <Activity className="h-5 w-5 text-blue-500" />, bg: 'bg-blue-50' },
          { label: 'Active', value: devices.filter(d => d.isActive).length, icon: <Shield className="h-5 w-5 text-amber-500" />, bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className={`h-10 w-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>{s.icon}</div>
            <div className="text-2xl font-bold text-primary-text">{s.value}</div>
            <div className="text-sm text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Device Cards */}
      {devices.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center bg-card rounded-3xl border border-dashed border-border/60 shadow-sm">
          <div className="h-20 w-20 bg-accent/5 rounded-full flex items-center justify-center mb-6">
            <Camera className="h-10 w-10 text-accent/40" />
          </div>
          <h3 className="text-xl font-bold text-primary-text mb-2">No CCTV Devices Registered</h3>
          <p className="text-muted text-center max-w-sm mb-8 px-6">
            Register your first CCTV edge server to start automatic attendance.
          </p>
          <Button variant="outline" onClick={() => setIsModalOpen(true)} className="hover:bg-accent hover:text-white transition-all">
            + Register First Device
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map(device => (
            <div
              key={device.id}
              className={`bg-card rounded-2xl shadow-sm border border-border hover:border-accent hover:shadow-md transition-all relative overflow-hidden group ${!device.isActive ? 'opacity-60' : ''}`}
            >
              <div className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-6 items-start">
                  {/* Left Column: Info */}
                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-2xl ${device.status === 'online' ? 'bg-emerald-500/10' : 'bg-gray-100'}`}>
                        {device.status === 'online'
                          ? <Wifi className="h-6 w-6 text-emerald-500" />
                          : <WifiOff className="h-6 w-6 text-gray-400" />
                        }
                      </div>
                      <div className="flex items-center gap-1 md:hidden">
                        <button
                          onClick={() => handleDelete(device.id)}
                          className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Permanently delete device"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Name + ID */}
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-primary-text tracking-tight mb-1">{device.siteName}</h3>
                      <div className="flex items-center gap-2 text-xs font-mono text-muted bg-gray-50 px-2.5 py-1 rounded-lg w-fit">
                        {device.edgeDeviceId}
                      </div>
                    </div>

                    {/* Camera badges */}
                    {device.cameras.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mb-4">
                        {device.cameras.map((cam, i) => (
                          <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                            cam.direction === 'entry' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            <Camera className="h-3 w-3" /> {cam.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Meta */}
                    <div className="space-y-2 pt-3 border-t border-gray-100">
                      {device.locationName && (
                        <div className="flex items-center gap-2 text-sm text-primary-text/80">
                          <div className="h-7 w-7 rounded-lg bg-gray-50 flex items-center justify-center">
                            <MapPin className="h-3.5 w-3.5 text-muted" />
                          </div>
                          <span className="font-medium">{device.locationName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-primary-text/80">
                        <div className="h-7 w-7 rounded-lg bg-gray-50 flex items-center justify-center">
                          <RefreshCw className="h-3.5 w-3.5 text-muted" />
                        </div>
                        <span className="text-xs text-muted">Last seen: {getLastSeenText(device.lastSeen)}</span>
                      </div>
                    </div>

                    {/* Status pill */}
                    <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 w-fit">
                      <span className={`h-2 w-2 rounded-full animate-pulse ${
                        device.status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-400'
                      }`} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        device.status === 'online' ? 'text-emerald-600' : 'text-gray-500'
                      }`}>
                        {device.status}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Live Camera Video Preview Window */}
                  <div className="w-full md:w-[380px] lg:w-[440px] flex flex-col gap-2 items-end flex-shrink-0">
                    <div className="hidden md:flex justify-end w-full mb-1">
                      <button
                        onClick={() => handleDelete(device.id)}
                        className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Permanently delete device"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="w-full aspect-video rounded-2xl bg-black border border-slate-800 relative overflow-hidden shadow-2xl flex items-center justify-center group/cam">
                      {device.status === 'online' && device.cameras.length > 0 ? (
                        <CameraLivePreview
                          camera={device.cameras[0]}
                          serverHost={device.serverHost}
                          adminPort={device.adminPort}
                        />
                      ) : (
                        <div className="text-center p-4">
                          <Camera className="h-6 w-6 text-slate-600 mx-auto mb-1" />
                          <span className="text-[11px] text-slate-500 font-medium block">
                            {device.status === 'online' ? 'No Camera Configured' : 'Camera Offline'}
                          </span>
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

      {/* ─── Proactive Face Enrollment Section ─── */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
          <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary-text">Enroll Employee Face</h2>
            <p className="text-xs text-muted mt-0.5">Pre-register employees so the CCTV recognizes them from day one — no unknown face queue needed.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Form */}
          <div className="bg-card rounded-2xl border border-border p-6 space-y-5">

            {/* Employee select */}
            <div>
              <label className="block text-xs font-bold text-primary-text mb-2 uppercase tracking-wider">Select Employee *</label>
              <select
                value={enrollUserId}
                onChange={e => { setEnrollUserId(e.target.value); setEnrollResult(null); }}
                disabled={isEnrolling}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              >
                <option value="">-- Search and select employee --</option>
                {enrollUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.biometricId ? `• ID: ${u.biometricId}` : ''} {u.department ? `• ${u.department}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Photo upload */}
            <div>
              <label className="block text-xs font-bold text-primary-text mb-2 uppercase tracking-wider">Face Photo *</label>
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
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-all group"
              >
                <Upload className="h-7 w-7 text-muted group-hover:text-accent mx-auto mb-2 transition-colors" />
                <p className="text-sm font-semibold text-primary-text">Click or drag to upload photo</p>
                <p className="text-xs text-muted mt-1">Clear front-facing photo — JPG, PNG, WebP supported</p>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-bold text-blue-800 mb-1.5">📸 Photo Tips for Best Results</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Use a clear, well-lit front-facing photo</li>
                <li>Face must be clearly visible — no sunglasses or masks</li>
                <li>Avoid group photos — one face only</li>
                <li>Higher resolution = more accurate recognition</li>
              </ul>
            </div>

            {/* Enroll button */}
            <Button
              onClick={handleEnrollFace}
              disabled={!enrollUserId || !enrollPhoto || isEnrolling}
              className="w-full flex items-center justify-center gap-2 h-11"
            >
              {isEnrolling ? (
                <><span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enrolling Face...</>
              ) : (
                <><UserPlus className="h-4 w-4" /> Enroll on Edge Server</>
              )}
            </Button>

            {/* Result */}
            {enrollResult && (
              <div className={`flex items-start gap-3 p-3 rounded-xl border text-sm font-medium ${
                enrollResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {enrollResult.success
                  ? <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-emerald-600" />
                  : <X className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-600" />
                }
                <span>{enrollResult.message}</span>
              </div>
            )}
          </div>

          {/* Right: Preview + Info */}
          <div className="space-y-4">

            {/* Photo preview */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-bold text-primary-text uppercase tracking-wider">Face Preview</p>
              </div>
              <div className="aspect-square bg-gray-50 flex items-center justify-center relative">
                {enrollPhotoPreview ? (
                  <>
                    <img src={enrollPhotoPreview} alt="Face preview" className="h-full w-full object-cover" />
                    <button
                      onClick={() => { setEnrollPhoto(null); setEnrollPhotoPreview(null); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="text-center">
                    <Camera className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-muted">Photo preview will appear here</p>
                  </div>
                )}
              </div>
            </div>

            {/* Edge server info */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-bold text-primary-text uppercase tracking-wider mb-3">Target Edge Server</p>
              {devices.filter(d => d.status === 'online').length > 0 ? (
                <div className="space-y-2">
                  {devices.filter(d => d.status === 'online').map(d => (
                    <div key={d.id} className="flex items-center gap-3 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-800">{d.siteName}</p>
                        <p className="text-[11px] font-mono text-emerald-600">{d.serverHost}:{d.adminPort || 4100}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <WifiOff className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700">No online edge servers detected. Start the server and refresh.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Register Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setForm(DEFAULT_FORM); }}
        onConfirm={handleSave}
        title="Register CCTV Edge Device"
        confirmButtonText="Register Device"
        confirmButtonVariant="primary"
        isLoading={saving}
      >
        <div className="space-y-4 py-2">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 inline mr-2" />
            The <strong>Edge Device ID</strong> must match the{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">EDGE_DEVICE_ID</code> in the edge server's{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">.env</code> file.
          </div>
          <Input
            label="Edge Device ID *"
            placeholder="e.g. edge-server-site-alpha"
            value={form.edgeDeviceId}
            onChange={e => setForm(f => ({ ...f, edgeDeviceId: e.target.value }))}
          />
          <Input
            label="Device Secret"
            type="password"
            placeholder="Shared secret key for authentication"
            value={form.deviceSecret}
            onChange={e => setForm(f => ({ ...f, deviceSecret: e.target.value }))}
          />
          <Input
            label="Site Name *"
            placeholder="e.g. Prestige Lakeside"
            value={form.siteName}
            onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))}
          />
          <Input
            label="Location / Gate"
            placeholder="e.g. Main Entrance"
            value={form.locationName}
            onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))}
          />
          <Select
            label="Assign Organization"
            value={form.organizationId}
            onChange={e => setForm(f => ({ ...f, organizationId: e.target.value }))}
          >
            <option value="">Select organization...</option>
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
              label="Cooldown (seconds)"
              type="number"
              min="60"
              max="3600"
              step="60"
              value={form.cooldownSeconds}
              onChange={e => setForm(f => ({ ...f, cooldownSeconds: e.target.value }))}
            />
          </div>
          <div className="text-xs text-muted -mt-2">
            Threshold: 0.45 recommended. Cooldown: 300 = 5 minutes between re-detections.
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ManageCctvDevices;
