import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import LoadingScreen from '../../components/ui/LoadingScreen';
import {
  Camera, Plus, Trash2, Wifi, WifiOff, RefreshCw,
  Activity, Shield, AlertCircle, CheckCircle, MapPin, UserPlus, Upload, X,
  Maximize2, Video, Download, Cpu, Server, Search
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
  serverHost: string | null;
  adminPort: number;
}

const NGROK_PROXY = 'https://tassel-estranged-prism.ngrok-free.dev';

// ─── Camera Live Preview Component ──────────────────────────────────────────
const CameraLivePreview: React.FC<{ camera: any; serverHost: string | null; adminPort: number }> = ({ camera }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [frameSrc, setFrameSrc] = useState<string>('');
  const isMountedRef = useRef(true);

  const camName = typeof camera === 'string' ? camera : camera?.name || 'main_gate_entry';

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
              timerId = setTimeout(fetchNextFrame, 350);
            }
            return;
          }
        }
        throw new Error(`Invalid response: ${res.status}`);
      } catch {
        if (isMountedRef.current) {
          setHasError(true);
          timerId = setTimeout(fetchNextFrame, 2000);
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
        className="w-full h-full relative group bg-black overflow-hidden select-none cursor-pointer rounded-xl border border-border"
      >
        {hasError && !frameSrc ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 gap-2 p-6">
            <Video className="h-7 w-7 text-amber-400 animate-pulse" />
            <span className="text-xs text-amber-300 font-mono tracking-wider font-semibold">RECONNECTING...</span>
          </div>
        ) : (
          <img
            src={frameSrc || `${NGROK_PROXY}/camera/frame/${encodeURIComponent(camName)}?ngrok-skip-browser-warning=true`}
            alt={camName}
            className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-[1.02]"
            style={{ imageRendering: 'auto' }}
          />
        )}

        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/60" />

        {/* Top OSD Header */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none font-mono">
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600/90 text-[9px] font-bold text-white uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />REC
            </span>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider drop-shadow-md">
              CAM-01 • {camName.replace(/_/g, ' ')}
            </span>
          </div>
          <span className="text-[9px] font-bold text-slate-200 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
            {currentTime}
          </span>
        </div>

        {/* Bottom OSD Bar */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <span className="text-[9px] text-emerald-300 font-mono bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI ACTIVE
          </span>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
            <button
              onClick={handleDownloadSnapshot}
              title="Download Snapshot"
              className="p-1 rounded bg-black/70 hover:bg-black text-white hover:text-emerald-400 transition-colors"
            >
              <Download className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
              title="Fullscreen"
              className="p-1 rounded bg-black/70 hover:bg-black text-white hover:text-emerald-400 transition-colors"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex flex-col backdrop-blur-md"
          onClick={() => setIsFullscreen(false)}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 px-3 py-1 rounded bg-red-600 text-xs font-bold uppercase tracking-wider text-white">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />LIVE SURVEILLANCE
              </span>
              <span className="text-sm font-bold text-emerald-400 tracking-wider uppercase font-mono">
                {camName.replace(/_/g, ' ')} — MAIN ENTRY GATE
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-emerald-300 font-mono font-bold">{currentTime}</span>
              <button 
                onClick={() => setIsFullscreen(false)} 
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-black flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            <img
              src={frameSrc || `${NGROK_PROXY}/camera/frame/${encodeURIComponent(camName)}?ngrok-skip-browser-warning=true`}
              alt={camName}
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl border border-white/10"
            />
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-slate-400 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <span>Paradigm IFS • Real-Time CCTV AI Attendance System</span>
            <div className="flex gap-3">
              <button 
                onClick={handleDownloadSnapshot} 
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-2 transition-colors"
              >
                <Download className="h-4 w-4" /> Save Snapshot
              </button>
              <button 
                onClick={() => setIsFullscreen(false)} 
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
              >
                Close
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
  const [form, setForm] = useState<NewDeviceForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Proactive enrollment state
  const [enrollUsers, setEnrollUsers] = useState<{ id: string; name: string; biometricId: string | null; department: string | null }[]>([]);
  const [enrollUserId, setEnrollUserId] = useState('');
  const [enrollPhoto, setEnrollPhoto] = useState<File | null>(null);
  const [enrollPhotoPreview, setEnrollPhotoPreview] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollResult, setEnrollResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!confirm('Are you sure you want to delete this CCTV device?')) return;
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
    if (!enrollPhoto) { setToast({ message: 'Please upload a face photo', type: 'error' }); return; }

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
      setEnrollResult({ success: true, message: `Enrolled ${selectedUser?.name} successfully! AI Face vector stored on edge server.` });
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

  if (isLoading) return <LoadingScreen message="Loading CCTV Devices..." />;

  const filteredDevices = devices.filter(
    (d) =>
      searchTerm === '' ||
      d.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.edgeDeviceId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status !== 'online').length;
  const totalCameras = devices.reduce((a, d) => a + d.cameras.length, 0);

  return (
    <div className="p-4 md:p-6 w-full">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* ── Top Header Section (Matching KioskManagement) ── */}
      <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <AdminPageHeader title="CCTV Devices" />
            <p className="text-muted -mt-4 mb-4">
              Manage edge servers and CCTV cameras for automatic site attendance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Register Device
            </Button>
          </div>
        </div>
      </div>

      {/* ── Metrics Summary Grid (4 Horizontal KPI Cards matching Image 1) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Camera className="h-6 w-6" />
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
          <div className="p-3 rounded-lg bg-red-500/10 text-red-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Inactive (Offline)</p>
            <h4 className="text-2xl font-bold text-primary-text">{offlineCount}</h4>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Total Cameras</p>
            <h4 className="text-2xl font-bold text-primary-text">{totalCameras}</h4>
          </div>
        </div>
      </div>

      {/* ── Search Filter Bar ── */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <Input
            id="cctv-search"
            name="cctvSearch"
            placeholder="Search CCTV devices by site or device name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4 text-muted" />}
          />
        </div>
        <Button variant="secondary" onClick={fetchData} title="Refresh Live Data" className="p-3">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Devices Cards / Surveillance Display ── */}
      {filteredDevices.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center shadow-card">
          <Camera className="h-12 w-12 text-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-lg font-bold text-primary-text mb-1">No CCTV Devices Found</h3>
          <p className="text-muted text-sm max-w-sm mx-auto mb-6">
            No registered CCTV edge servers matched your search criteria.
          </p>
          <Button variant="outline" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Register New Device
          </Button>
        </div>
      ) : (
        <div className="space-y-6 mb-8">
          {filteredDevices.map((device) => (
            <div
              key={device.id}
              className="bg-card rounded-xl shadow-card border border-border overflow-hidden hover:border-accent/40 transition-all"
            >
              <div className="p-5 md:p-6">
                <div className="flex flex-col lg:flex-row items-stretch gap-6">
                  {/* Left Metadata & Controls */}
                  <div className="flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-primary-text tracking-tight">
                              {device.siteName}
                            </h3>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                device.status === 'online'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${device.status === 'online' ? 'bg-green-600 animate-pulse' : 'bg-red-600'}`} />
                              {device.status === 'online' ? 'Online' : 'Offline'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted">
                            <span className="font-mono text-xs bg-muted/40 px-2 py-0.5 rounded border border-border">
                              {device.edgeDeviceId}
                            </span>
                            {device.locationName && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-muted" /> {device.locationName}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDelete(device.id)}
                          className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Device"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Active Channels */}
                      <div className="mt-4 mb-4">
                        <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">
                          Configured Camera Channels
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {device.cameras.map((cam: any, i: number) => (
                            <span
                              key={i}
                              className="text-xs px-3 py-1 rounded-lg font-medium bg-muted/40 border border-border text-primary-text flex items-center gap-1.5"
                            >
                              <Camera className="h-3.5 w-3.5 text-accent" />
                              <span className="font-semibold">{cam.name}</span>
                              <span className="text-[10px] text-muted uppercase font-mono">({cam.direction})</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Specifications */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-muted/20 border border-border/60">
                          <span className="text-muted block mb-0.5">Match Accuracy</span>
                          <span className="font-bold text-primary-text flex items-center gap-1">
                            <Shield className="h-3.5 w-3.5 text-emerald-600" />
                            {Math.round(device.matchThreshold * 100)}% Cosine Threshold
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/20 border border-border/60">
                          <span className="text-muted block mb-0.5">Anti-Spam Cooldown</span>
                          <span className="font-bold text-primary-text flex items-center gap-1">
                            <Activity className="h-3.5 w-3.5 text-amber-600" />
                            {device.cooldownSeconds}s (5 Minutes)
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/20 border border-border/60">
                          <span className="text-muted block mb-0.5">Edge Node Host</span>
                          <span className="font-bold text-primary-text font-mono flex items-center gap-1">
                            <Server className="h-3.5 w-3.5 text-blue-600" />
                            Port {device.adminPort || 4100}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/20 border border-border/60">
                          <span className="text-muted block mb-0.5">Database Link</span>
                          <span className="font-bold text-green-700 font-mono text-xs flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            MSSQL Synced
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted">
                      <span>Last heartbeat: {getLastSeenText(device.lastSeen)}</span>
                      <a
                        href="#/admin/cctv-dashboard"
                        className="text-accent hover:underline font-semibold flex items-center gap-1"
                      >
                        <Activity className="h-3.5 w-3.5" /> View Detection Logs →
                      </a>
                    </div>
                  </div>

                  {/* Right Surveillance Screen */}
                  <div className="w-full lg:w-[460px] xl:w-[500px] flex-shrink-0 flex flex-col justify-center">
                    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-sm border border-border relative">
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

      {/* ── Proactive Employee Face Enrollment Card ── */}
      <div className="bg-card rounded-xl shadow-card border border-border p-6 mb-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
          <div className="p-2.5 rounded-lg bg-accent/10 text-accent">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-primary-text">Enroll Employee Face</h3>
            <p className="text-xs text-muted mt-0.5">
              Pre-register employees so the CCTV AI recognizes them automatically on entry/exit.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div>
              <label className="block text-xs font-bold text-primary-text mb-2 uppercase tracking-wider">
                Select Employee *
              </label>
              <select
                value={enrollUserId}
                onChange={(e) => { setEnrollUserId(e.target.value); setEnrollResult(null); }}
                disabled={isEnrolling}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              >
                <option value="">-- Choose employee --</option>
                {enrollUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.biometricId ? `• Code: ${u.biometricId}` : ''} {u.department ? `• ${u.department}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-primary-text mb-2 uppercase tracking-wider">
                Face Photo *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handlePhotoSelect(f); }}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-all group"
              >
                <Upload className="h-7 w-7 text-muted group-hover:text-accent mx-auto mb-2 transition-colors" />
                <p className="text-sm font-semibold text-primary-text">Click or drag photo to upload</p>
                <p className="text-xs text-muted mt-1">Clear passport-style photo (JPG, PNG)</p>
              </div>
            </div>

            <Button
              onClick={handleEnrollFace}
              disabled={!enrollUserId || !enrollPhoto || isEnrolling}
              className="w-full flex items-center justify-center gap-2 h-11 text-sm font-semibold"
            >
              {isEnrolling ? (
                <><span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enrolling Face...</>
              ) : (
                <><UserPlus className="h-4 w-4" /> Enroll on Edge Server</>
              )}
            </Button>

            {enrollResult && (
              <div
                className={`p-3.5 rounded-lg border text-sm font-medium flex items-start gap-2.5 ${
                  enrollResult.success
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {enrollResult.success ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" /> : <X className="h-5 w-5 text-red-600 flex-shrink-0" />}
                <span>{enrollResult.message}</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="bg-background rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/20">
                <span className="text-xs font-bold text-primary-text uppercase tracking-wider">Face Preview</span>
              </div>
              <div className="aspect-square flex items-center justify-center bg-slate-900 relative">
                {enrollPhotoPreview ? (
                  <>
                    <img src={enrollPhotoPreview} alt="Face preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setEnrollPhoto(null); setEnrollPhotoPreview(null); }}
                      className="absolute top-2.5 right-2.5 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-all"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <Camera className="h-10 w-10 text-slate-700 mx-auto mb-2" />
                    <span className="text-xs text-slate-500 font-medium">Photo preview will appear here</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Register Device Modal ── */}
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
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>
              The <strong>Edge Device ID</strong> links the local Python camera pipeline to your cloud tenant.
            </span>
          </div>

          <Input
            label="Edge Device ID *"
            placeholder="e.g. server-win-0t8n581gn63"
            value={form.edgeDeviceId}
            onChange={(e) => setForm((f) => ({ ...f, edgeDeviceId: e.target.value }))}
          />

          <Input
            label="Site / Branch Name *"
            placeholder="e.g. Head Office - Main Gate"
            value={form.siteName}
            onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
          />

          <Input
            label="Location / Gate Area"
            placeholder="e.g. Gate 1 Entrance"
            value={form.locationName}
            onChange={(e) => setForm((f) => ({ ...f, locationName: e.target.value }))}
          />

          <Select
            label="Assign Organization"
            value={form.organizationId}
            onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
          >
            <option value="">Default Organization</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.shortName}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Match Threshold"
              type="number"
              min="0.3"
              max="0.9"
              step="0.05"
              value={form.matchThreshold}
              onChange={(e) => setForm((f) => ({ ...f, matchThreshold: e.target.value }))}
            />
            <Input
              label="Cooldown (sec)"
              type="number"
              min="60"
              max="3600"
              step="60"
              value={form.cooldownSeconds}
              onChange={(e) => setForm((f) => ({ ...f, cooldownSeconds: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ManageCctvDevices;
