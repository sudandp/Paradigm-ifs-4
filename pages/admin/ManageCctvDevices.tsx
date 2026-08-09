import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import LoadingScreen from '../../components/ui/LoadingScreen';
import {
  Camera, Plus, Trash2, Wifi, WifiOff, RefreshCw,
  Activity, Shield, AlertCircle, MapPin
} from 'lucide-react';

interface CctvDevice {
  id: string;
  edgeDeviceId: string;
  siteName: string;
  locationName: string;
  organizationId: string;
  cameras: { name: string; direction: 'entry' | 'exit' }[];
  status: 'online' | 'offline' | 'error';
  lastSeen: string | null;
  matchThreshold: number;
  cooldownSeconds: number;
  isActive: boolean;
  createdAt: string;
}

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
        }))
      );
      setOrganizations((orgsData || []).map((o: any) => ({ id: o.id, shortName: o.short_name })));
    } catch {
      setToast({ message: 'Failed to load CCTV devices', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const handleDeactivate = async (deviceId: string) => {
    if (!confirm('Deactivate this CCTV device?')) return;
    const { error } = await supabase
      .from('cctv_devices')
      .update({ is_active: false })
      .eq('id', deviceId);
    if (error) {
      setToast({ message: 'Failed to deactivate', type: 'error' });
    } else {
      setToast({ message: 'Device deactivated', type: 'success' });
      fetchData();
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
                {/* Top row */}
                <div className="flex justify-between items-start mb-5">
                  <div className={`p-3 rounded-2xl ${device.status === 'online' ? 'bg-emerald-500/10' : 'bg-gray-100'}`}>
                    {device.status === 'online'
                      ? <Wifi className="h-6 w-6 text-emerald-500" />
                      : <WifiOff className="h-6 w-6 text-gray-400" />
                    }
                  </div>
                  <div className="flex gap-1">
                    {!device.isActive && (
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">
                        Inactive
                      </span>
                    )}
                    {device.isActive && (
                      <button
                        onClick={() => handleDeactivate(device.id)}
                        className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Deactivate device"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Name + ID */}
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-primary-text tracking-tight mb-1">{device.siteName}</h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-muted bg-gray-50 px-2 py-1 rounded-lg w-fit">
                    {device.edgeDeviceId}
                  </div>
                </div>

                {/* Camera badges */}
                {device.cameras.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-4">
                    {device.cameras.map((cam, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        cam.direction === 'entry' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        🎥 {cam.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Meta */}
                <div className="space-y-2 pt-4 border-t border-gray-50">
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
                  <div className="flex items-center gap-3 text-xs text-muted pt-1">
                    <span>Threshold: {device.matchThreshold}</span>
                    <span>·</span>
                    <span>Cooldown: {device.cooldownSeconds}s</span>
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
            </div>
          ))}
        </div>
      )}

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
