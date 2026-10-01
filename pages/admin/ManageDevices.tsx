import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Organization, BiometricDevice } from '../../types';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import {
  Cpu, Plus, Trash2, Wifi, WifiOff, MapPin, RefreshCw, Settings,
  Search, ShieldCheck, CheckCircle2, Copy, Check, Server, Radio,
  List, LayoutGrid, Users, UserCheck, ExternalLink, Clock, ArrowRight, Fingerprint, Database
} from 'lucide-react';
import LoadingScreen from '../../components/ui/LoadingScreen';
import MobileTopBar from '../../components/navigation/MobileTopBar';

const ESSL_MODELS = [
  'eSSL AiFace-Mars (Face + Fingerprint + RFID)',
  'eSSL SilkBio-101 (Face + Palm + Fingerprint)',
  'eSSL MB20 / MB160 (Multi-Biometric)',
  'eSSL Mars Series (High Speed Face Recognition)',
  'eSSL Identix / K30 / U990',
  'ZKTeco / eSSL Compatible Hardware'
];

const ManageDevices: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // View Mode: Default to List View as requested
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  // Device Form State
  const initialDeviceState = {
    sn: '',
    name: '',
    organizationId: '',
    locationName: '',
    model: 'eSSL AiFace-Mars (Face + Fingerprint + RFID)',
    direction: 'all',
    connectionType: 'Cloud',
    ipAddress: '',
    port: '443',
    commKey: '0',
  };

  const [newDevice, setNewDevice] = useState(initialDeviceState);
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [setupDevice, setSetupDevice] = useState<any | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const navigate = useNavigate();

  // Device-based Users Modal state
  const [selectedDeviceForUsers, setSelectedDeviceForUsers] = useState<any | null>(null);
  const [deviceUsersLoading, setDeviceUsersLoading] = useState(false);
  const [deviceUsersData, setDeviceUsersData] = useState<{
    users: any[];
    punches: any[];
    totalUniqueUsers: number;
    totalPunches: number;
  }>({ users: [], punches: [], totalUniqueUsers: 0, totalPunches: 0 });
  const [deviceUsersTab, setDeviceUsersTab] = useState<'users' | 'punches'>('users');
  const [deviceUserSearch, setDeviceUserSearch] = useState('');

  const handleOpenDeviceUsers = async (device: any) => {
    setSelectedDeviceForUsers(device);
    setDeviceUsersLoading(true);
    setDeviceUsersTab('users');
    setDeviceUserSearch('');
    try {
      const res = await api.getDeviceUsersAndPunches(device.sn, device.name);
      setDeviceUsersData(res);
    } catch (err) {
      console.error('Failed to load device users:', err);
      setToast({ message: 'Failed to load device users.', type: 'error' });
    } finally {
      setDeviceUsersLoading(false);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [devicesData, orgsData] = await Promise.all([
        api.getBiometricDevices(),
        api.getOrganizations()
      ]);
      setDevices(devicesData);
      setOrganizations(orgsData);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      setToast({ message: 'Failed to load biometric devices.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSyncFromEssl = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/mssql-devices');
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.devices) && json.devices.length > 0) {
          await fetchData();
          setToast({ message: `Successfully synchronized ${json.devices.length} eSSL devices!`, type: 'success' });
          setIsSyncing(false);
          return;
        }
      }

      await fetchData();
      setToast({ message: 'Device list refreshed from server.', type: 'success' });
    } catch (err: any) {
      setToast({ message: 'Sync failed: ' + (err.message || 'Server unreachable'), type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveDevice = async () => {
    const source = editingDevice || newDevice;

    if (!source.sn || !source.name) {
      setToast({ message: 'Device Name and Serial Number (SN) are required.', type: 'error' });
      return;
    }

    const payload = {
      sn: source.sn.trim(),
      name: source.name.trim(),
      organizationId: source.organizationId === '' ? null : source.organizationId,
      locationName: source.locationName === '' ? (source.name || null) : source.locationName,
      status: 'online' as const,
      direction: source.direction || 'all',
      connectionType: source.connectionType || 'Cloud',
      ipAddress: source.ipAddress || null,
      deviceType: source.model || 'eSSL AiFace-Mars',
    };

    try {
      if (editingDevice) {
        await api.updateBiometricDevice(editingDevice.id, payload);
        setToast({ message: `eSSL Device '${source.name}' updated successfully.`, type: 'success' });
        setIsAddModalOpen(false);
        setEditingDevice(null);
      } else {
        const newDev = await api.addBiometricDevice(payload);
        setToast({ message: `eSSL Device '${source.name}' added successfully!`, type: 'success' });
        setIsAddModalOpen(false);
        setSetupDevice(newDev); // Automatically trigger machine cloud configuration wizard
      }
      setNewDevice(initialDeviceState);
      fetchData();
    } catch (error: any) {
      console.error('Save error:', error);
      setToast({ message: error.message || 'Failed to save eSSL device.', type: 'error' });
    }
  };

  const handleEditDevice = (device: any) => {
    setEditingDevice({
      ...device,
      model: device.deviceType || device.model || 'eSSL AiFace-Mars (Face + Fingerprint + RFID)',
      direction: device.direction || 'all',
      connectionType: device.connectionType || 'Cloud',
      ipAddress: device.ipAddress || '',
      port: device.port || '443',
      commKey: device.commKey || '0',
    });
    setIsAddModalOpen(true);
  };

  const handleDeleteDevice = async (device: any) => {
    if (!window.confirm(`Are you sure you want to delete '${device.name}' (SN: ${device.sn})?`)) return;
    try {
      await api.deleteBiometricDevice(device.id, device.sn);
      setToast({ message: 'Device deleted successfully.', type: 'success' });
      fetchData();
    } catch (error) {
      setToast({ message: 'Failed to delete device.', type: 'error' });
    }
  };

  const copyCloudUrl = () => {
    navigator.clipboard.writeText('https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/biometric-push');
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = !q ||
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.sn && d.sn.toLowerCase().includes(q)) ||
        (d.locationName && d.locationName.toLowerCase().includes(q)) ||
        (d.organization?.shortName && d.organization.shortName.toLowerCase().includes(q));

      const isDevOnline = d.status === 'online';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'online' && isDevOnline) ||
        (statusFilter === 'offline' && !isDevOnline);

      return matchesSearch && matchesStatus;
    });
  }, [devices, searchTerm, statusFilter]);

  // Filtered staff and punches within the device users modal
  const filteredDeviceUsers = useMemo(() => {
    const q = deviceUserSearch.toLowerCase().trim();
    if (!q) return deviceUsersData.users;
    return deviceUsersData.users.filter(u =>
      (u.empCode && u.empCode.toLowerCase().includes(q)) ||
      (u.empName && u.empName.toLowerCase().includes(q)) ||
      (u.designation && u.designation.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  }, [deviceUsersData.users, deviceUserSearch]);

  const filteredDevicePunches = useMemo(() => {
    const q = deviceUserSearch.toLowerCase().trim();
    if (!q) return deviceUsersData.punches;
    return deviceUsersData.punches.filter(p =>
      (p.empCode && p.empCode.toLowerCase().includes(q)) ||
      (p.empName && p.empName.toLowerCase().includes(q)) ||
      (p.direction && p.direction.toLowerCase().includes(q))
    );
  }, [deviceUsersData.punches, deviceUserSearch]);

  const totalCount = devices.length;
  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = Math.max(0, totalCount - onlineCount);

  if (isLoading && devices.length === 0) {
    return <LoadingScreen message="Loading eSSL biometric hardware..." />;
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <MobileTopBar title="BIOMETRIC DEVICES" parentPath="/mobile-home" />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <Cpu className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-primary-text tracking-tight flex items-center gap-2">
                eSSL Biometric Devices
              </h1>
              <p className="text-muted text-sm mt-0.5">
                Manage eSSL hardware (AiFace-Mars, SilkBio, MB20) &amp; ADMS Cloud Push integration.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={handleSyncFromEssl}
            disabled={isSyncing}
            className="flex items-center gap-2 h-11 px-4 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50"
            title="Scan attendance logs and eTimeTrackLite for active devices"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync eSSL Devices'}
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/admin/essl')}
            className="flex items-center gap-2 h-11 px-4 border-blue-600/30 text-blue-700 hover:bg-blue-50"
            title="Manage eSSL employees, weekly off feeding, and holidays"
          >
            <Database className="h-4 w-4" />
            eSSL Master Sync &amp; Feeding
          </Button>

          <Button
            onClick={() => {
              setEditingDevice(null);
              setNewDevice(initialDeviceState);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
          >
            <Plus className="h-5 w-5" /> Add eSSL Device
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs uppercase font-bold text-muted tracking-wider">Total Hardware</p>
            <p className="text-2xl font-black text-primary-text mt-1">{totalCount}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-muted">
            <Cpu className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs uppercase font-bold text-emerald-600 tracking-wider">Online / Active</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{onlineCount}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Wifi className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs uppercase font-bold text-gray-500 tracking-wider">Offline / Standby</p>
            <p className="text-2xl font-black text-gray-600 mt-1">{offlineCount}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
            <WifiOff className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs uppercase font-bold text-blue-600 tracking-wider">Cloud Protocol</p>
            <p className="text-base font-bold text-blue-700 mt-1">ADMS Push 443</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Server className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar + View Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-3 rounded-2xl border border-border">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search device name, SN, site..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-xl text-sm border-none focus:outline-none focus:ring-2 focus:ring-emerald-500 text-primary-text"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5">
            {(['all', 'online', 'offline'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-bold uppercase rounded-xl transition-all ${
                  statusFilter === tab
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-muted hover:bg-gray-100 hover:text-primary-text'
                }`}
              >
                {tab} ({tab === 'all' ? totalCount : tab === 'online' ? onlineCount : offlineCount})
              </button>
            ))}
          </div>

          {/* List vs Grid View Toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold ${
                viewMode === 'list'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="List View"
            >
              <List className="h-4 w-4" />
              <span className="hidden md:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold ${
                viewMode === 'grid'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden md:inline">Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Empty State, List View, or Grid View */}
      {filteredDevices.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center bg-card rounded-3xl border border-dashed border-border/80 shadow-sm text-center px-4">
          <div className="h-20 w-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <Cpu className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-bold text-primary-text mb-1">
            {devices.length === 0 ? 'No eSSL Devices Found' : 'No Devices Match Filter'}
          </h3>
          <p className="text-muted text-sm max-w-md mb-6">
            {devices.length === 0
              ? 'Add your first eSSL machine (AiFace-Mars, SilkBio, MB20) or click "Sync eSSL Devices" to auto-import devices.'
              : 'Try adjusting your search keyword or switching the status filter.'}
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSyncFromEssl}
              className="gap-2 border-emerald-600/30 text-emerald-700"
            >
              <RefreshCw className="h-4 w-4" /> Sync eSSL Devices
            </Button>
            <Button
              onClick={() => {
                setEditingDevice(null);
                setNewDevice(initialDeviceState);
                setIsAddModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" /> Add eSSL Device
            </Button>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* ═══════════════════════════════════════════════════════
           LIST VIEW (Clean, compact tabular design)
           ═══════════════════════════════════════════════════════ */
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted select-none">
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Device &amp; Model</th>
                  <th className="py-3.5 px-4">Serial Number</th>
                  <th className="py-3.5 px-4">Site Location</th>
                  <th className="py-3.5 px-4">Direction</th>
                  <th className="py-3.5 px-4">Last Recorded Punch</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredDevices.map((device) => {
                  const isOnline = device.status === 'online';
                  return (
                    <tr
                      key={device.id || device.sn}
                      className="hover:bg-gray-50/80 transition-colors group"
                    >
                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          isOnline
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>

                      {/* Device Name & Model */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleOpenDeviceUsers(device)}
                          className="text-left group/btn block"
                          title="Click to view enrolled employees & punches on this device"
                        >
                          <div className="font-bold text-primary-text group-hover/btn:text-emerald-700 transition-colors flex items-center gap-1.5 hover:underline">
                            <span>{device.name}</span>
                            <Users className="h-3.5 w-3.5 text-blue-600 opacity-60 group-hover/btn:opacity-100" />
                          </div>
                          <div className="text-xs text-muted">
                            {device.deviceType || device.model || 'eSSL AiFace-Mars'}
                          </div>
                        </button>
                      </td>

                      {/* Serial Number & Connection */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-200">
                            {device.sn}
                          </span>
                          {device.ipAddress && (
                            <span className="text-[11px] font-mono text-muted">
                              {device.ipAddress}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Site Location */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-primary-text font-medium text-xs">
                          <MapPin className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {device.locationName || device.organization?.shortName || 'Unassigned Site'}
                          </span>
                        </div>
                      </td>

                      {/* Direction */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-[11px] font-bold uppercase bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-100">
                          {device.direction === 'in' ? 'IN Only' : device.direction === 'out' ? 'OUT Only' : 'IN + OUT'}
                        </span>
                      </td>

                      {/* Last Recorded Punch */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        {device.lastSeen ? (
                          <div>
                            <span className="font-semibold text-primary-text">
                              {new Date(device.lastSeen).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </span>
                            <span className="text-muted ml-1.5">
                              {new Date(device.lastSeen).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted italic">Never recorded</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDeviceUsers(device)}
                            className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200/60 transition-colors flex items-center gap-1"
                            title="View enrolled staff and punch history on this device"
                          >
                            <Users className="h-3.5 w-3.5" />
                            Users
                          </button>

                          <button
                            onClick={() => setSetupDevice(device)}
                            className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200/60 transition-colors flex items-center gap-1"
                            title="View ADMS Cloud Server settings for this device"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Setup ADMS
                          </button>

                          <button
                            onClick={() => handleEditDevice(device)}
                            className="p-1.5 text-muted hover:text-emerald-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit Device"
                          >
                            <Settings className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteDevice(device)}
                            className="p-1.5 text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Device"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* List Footer Stats */}
          <div className="p-3 bg-gray-50/70 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-muted gap-2">
            <span>
              Showing <strong className="text-primary-text">{filteredDevices.length}</strong> of {totalCount} devices
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              {onlineCount} Online
              <span className="inline-block h-2 w-2 rounded-full bg-gray-400 ml-2" />
              {offlineCount} Offline
            </span>
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════
           GRID VIEW (Card cards with quick actions)
           ═══════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDevices.map((device) => {
            const isOnline = device.status === 'online';
            return (
              <div
                key={device.id || device.sn}
                className="bg-card rounded-2xl shadow-sm border border-border hover:border-emerald-500/50 hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between group"
              >
                <div className="p-6">
                  {/* Top Bar with Online Status & Actions */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-2.5 rounded-xl ${isOnline ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                        {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                        {isOnline ? 'Online (Active)' : 'Offline'}
                      </span>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditDevice(device)}
                        className="p-2 text-muted hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Edit Device Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDevice(device)}
                        className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Delete Device"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Device Title & Serial Number */}
                  <div className="space-y-1 mb-5">
                    <button
                      type="button"
                      onClick={() => handleOpenDeviceUsers(device)}
                      className="text-left group/btn"
                      title="Click to view enrolled employees & punches on this device"
                    >
                      <h3 className="text-lg font-bold text-primary-text tracking-tight group-hover/btn:text-emerald-700 transition-colors flex items-center gap-1.5 hover:underline">
                        <span>{device.name}</span>
                        <Users className="h-4 w-4 text-blue-600 opacity-70 group-hover/btn:opacity-100" />
                      </h3>
                    </button>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-md">
                        SN: {device.sn}
                      </span>
                      {device.direction && (
                        <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {device.direction === 'in' ? 'IN Only' : device.direction === 'out' ? 'OUT Only' : 'IN + OUT'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Location & Last Seen info */}
                  <div className="space-y-2.5 pt-4 border-t border-gray-100 text-xs text-muted">
                    <div className="flex items-center gap-2.5 text-primary-text font-medium">
                      <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span className="truncate">{device.locationName || device.organization?.shortName || 'Unassigned Site'}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <RefreshCw className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span>
                        Last punch:{' '}
                        <strong className="text-primary-text">
                          {device.lastSeen ? new Date(device.lastSeen).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Never recorded'}
                        </strong>
                      </span>
                    </div>

                    {device.ipAddress && (
                      <div className="flex items-center gap-2.5 font-mono text-[11px]">
                        <Radio className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span>IP: {device.ipAddress}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Users & Cloud ADMS Setup Info Button */}
                <div className="p-4 bg-gray-50/70 border-t border-border flex items-center justify-between">
                  <button
                    onClick={() => handleOpenDeviceUsers(device)}
                    className="text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                    title="View enrolled employees & punches on this device"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>View Users</span>
                  </button>
                  <button
                    onClick={() => setSetupDevice(device)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    Setup ADMS &rarr;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit eSSL Device Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onConfirm={handleSaveDevice}
        title={editingDevice ? "Edit eSSL Biometric Device" : "Add New eSSL Biometric Device"}
        confirmButtonText={editingDevice ? "Save Changes" : "Register eSSL Device"}
        confirmButtonVariant="primary"
      >
        <div className="space-y-4 py-2 text-sm">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 leading-relaxed">
            <strong>eSSL Hardware Integration:</strong> This registers the device in both Paradigm Attendance Engine and eTimeTrackLite. After saving, configure the ADMS Cloud Server in the machine menu.
          </div>

          <Input
            label="Device Serial Number (SN)"
            value={editingDevice ? editingDevice.sn : newDevice.sn}
            onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, sn: e.target.value.toUpperCase() }) : setNewDevice({ ...newDevice, sn: e.target.value.toUpperCase() })}
            placeholder="e.g. NCD8252500647, CQIK230960142"
            required
            disabled={!!editingDevice}
          />
          <p className="text-[11px] text-muted -mt-3">Found on the device sticker or in <em>Menu &rarr; System Info &rarr; Device Info</em>.</p>

          <Input
            label="Device Name / Gate Label"
            value={editingDevice ? editingDevice.name : newDevice.name}
            onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, name: e.target.value }) : setNewDevice({ ...newDevice, name: e.target.value })}
            placeholder="e.g. Brigade Utopia Main Gate, Birla Alokiya Exit"
            required
          />

          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">eSSL Hardware Model</label>
            <select
              value={editingDevice ? editingDevice.model : newDevice.model}
              onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, model: e.target.value }) : setNewDevice({ ...newDevice, model: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {ESSL_MODELS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Punch Direction</label>
              <select
                value={editingDevice ? (editingDevice.direction || 'all') : newDevice.direction}
                onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, direction: e.target.value }) : setNewDevice({ ...newDevice, direction: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="all">Both (Check-In &amp; Check-Out)</option>
                <option value="in">In Only (Entry Gate)</option>
                <option value="out">Out Only (Exit Gate)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Connection Protocol</label>
              <select
                value={editingDevice ? (editingDevice.connectionType || 'Cloud') : newDevice.connectionType}
                onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, connectionType: e.target.value }) : setNewDevice({ ...newDevice, connectionType: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="Cloud">Cloud Server (ADMS / Push)</option>
                <option value="LAN">Local Network (LAN TCP/IP)</option>
              </select>
            </div>
          </div>

          <Select
            label="Assign Site Location (Organization)"
            value={editingDevice ? (editingDevice.organizationId || '') : newDevice.organizationId}
            onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, organizationId: e.target.value }) : setNewDevice({ ...newDevice, organizationId: e.target.value })}
          >
            <option value="">Select Site Location</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.shortName}</option>
            ))}
          </Select>

          <Input
            label="Custom Location Name (Optional override)"
            value={editingDevice ? (editingDevice.locationName || '') : newDevice.locationName}
            onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, locationName: e.target.value }) : setNewDevice({ ...newDevice, locationName: e.target.value })}
            placeholder="e.g. Tower B - Ground Floor Reception"
          />

          {(editingDevice?.connectionType === 'LAN' || newDevice.connectionType === 'LAN') && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Static IP Address"
                value={editingDevice ? (editingDevice.ipAddress || '') : newDevice.ipAddress}
                onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, ipAddress: e.target.value }) : setNewDevice({ ...newDevice, ipAddress: e.target.value })}
                placeholder="192.168.1.201"
              />
              <Input
                label="Device Port"
                value={editingDevice ? (editingDevice.port || '4370') : newDevice.port}
                onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, port: e.target.value }) : setNewDevice({ ...newDevice, port: e.target.value })}
                placeholder="4370"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* eSSL Machine Cloud Server (ADMS) Setup Wizard */}
      <Modal
        isOpen={!!setupDevice}
        onClose={() => setSetupDevice(null)}
        title="eSSL Device Cloud Server (ADMS) Configuration"
        confirmButtonText="Done &amp; Test Connection"
        onConfirm={() => {
          setSetupDevice(null);
          handleSyncFromEssl();
        }}
        confirmButtonVariant="primary"
      >
        <div className="space-y-5 py-2 text-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-800">
              <ShieldCheck className="h-4 w-4" /> 5-Step Setup on the Physical eSSL Machine:
            </p>
            <ol className="list-decimal pl-4 space-y-1 mt-2 text-[11px] text-amber-800/90">
              <li>Press <strong>M/OK</strong> button on your eSSL machine to open the main menu.</li>
              <li>Go to <strong>Comm. &rarr; Cloud Server (or ADMS)</strong>.</li>
              <li>Enter the exact details shown below and tap <strong>OK / Save</strong>.</li>
              <li>Ensure the machine has an active Internet connection (via Wi-Fi, Ethernet cable, or 4G SIM).</li>
              <li>Reboot the device. The cloud globe icon on the machine screen will turn yellow/green!</li>
            </ol>
          </div>

          <div className="space-y-3.5 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Server Address (Domain Name)</label>
                <button
                  type="button"
                  onClick={copyCloudUrl}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedUrl ? 'Copied!' : 'Copy URL'}
                </button>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-200 font-mono text-xs text-emerald-700 break-all select-all font-bold">
                https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/biometric-push
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-gray-200 text-center">
                <p className="text-[10px] uppercase font-bold text-muted">Server Port</p>
                <p className="text-base font-black text-primary-text mt-0.5">443</p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-gray-200 text-center">
                <p className="text-[10px] uppercase font-bold text-muted">Enable HTTPS</p>
                <p className="text-base font-black text-emerald-600 mt-0.5">ON</p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-gray-200 text-center">
                <p className="text-[10px] uppercase font-bold text-muted">Domain Name</p>
                <p className="text-base font-black text-emerald-600 mt-0.5">ON</p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200/60 flex items-center justify-between text-xs">
            <div>
              <span className="text-muted">Target Serial Number: </span>
              <span className="font-mono font-bold text-primary-text">{setupDevice?.sn}</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] uppercase">
              <CheckCircle2 className="h-3 w-3" /> Ready to pair
            </span>
          </div>
        </div>
      </Modal>

      {/* Device-Based Users & Punch History Modal */}
      <Modal
        isOpen={!!selectedDeviceForUsers}
        onClose={() => setSelectedDeviceForUsers(null)}
        title=""
        maxWidth="md:max-w-4xl"
        hideFooter={true}
      >
        <div className="space-y-4 -mt-2">
          {/* Device Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-primary-text">
                    {selectedDeviceForUsers?.name}
                  </h3>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    selectedDeviceForUsers?.status === 'online'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${selectedDeviceForUsers?.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                    {selectedDeviceForUsers?.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                  <span className="font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                    SN: {selectedDeviceForUsers?.sn}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-emerald-600" />
                    {selectedDeviceForUsers?.locationName || selectedDeviceForUsers?.organization?.shortName || 'Unassigned Site'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const devName = selectedDeviceForUsers?.name || '';
                const devSn = selectedDeviceForUsers?.sn || '';
                setSelectedDeviceForUsers(null);
                navigate(`/admin/device-logs?device=${encodeURIComponent(devName)}&sn=${encodeURIComponent(devSn)}`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200/80 transition-colors self-start sm:self-auto"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Device Logs
            </button>
          </div>

          {/* Quick Stats Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100">
              <p className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">Active Staff on Machine</p>
              <p className="text-xl font-black text-blue-900 mt-0.5">{deviceUsersData.totalUniqueUsers}</p>
            </div>
            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
              <p className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Total Recorded Punches</p>
              <p className="text-xl font-black text-emerald-900 mt-0.5">{deviceUsersData.totalPunches}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <p className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">Latest Punch Logged</p>
              <p className="text-xs font-bold text-gray-900 mt-1 truncate">
                {deviceUsersData.punches[0]?.logDate
                  ? new Date(deviceUsersData.punches[0].logDate).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                  : 'No punches yet'}
              </p>
            </div>
          </div>

          {/* Search & Tabs Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* Tabs */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setDeviceUsersTab('users')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  deviceUsersTab === 'users'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Staff Members ({deviceUsersData.totalUniqueUsers})
              </button>
              <button
                onClick={() => setDeviceUsersTab('punches')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  deviceUsersTab === 'punches'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Recent Punches ({deviceUsersData.punches.length})
              </button>
            </div>

            {/* Search input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder={deviceUsersTab === 'users' ? 'Search employee, code...' : 'Search logs...'}
                value={deviceUserSearch}
                onChange={(e) => setDeviceUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 rounded-xl text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-primary-text"
              />
            </div>
          </div>

          {/* Tab Body */}
          {deviceUsersLoading ? (
            <div className="py-16 text-center">
              <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-2" />
              <p className="text-sm font-medium text-muted">Retrieving device user logs & employee profiles...</p>
            </div>
          ) : deviceUsersTab === 'users' ? (
            filteredDeviceUsers.length === 0 ? (
              <div className="py-12 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-primary-text">No active staff found for this device</p>
                <p className="text-xs text-muted mt-0.5">
                  {deviceUserSearch ? 'No staff matched your search filter.' : 'No biometric punches logged on this device yet.'}
                </p>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-muted sticky top-0 border-b border-border z-10">
                    <tr>
                      <th className="py-2.5 px-3">Emp Code</th>
                      <th className="py-2.5 px-3">Employee Name</th>
                      <th className="py-2.5 px-3">Designation / Role</th>
                      <th className="py-2.5 px-3 text-center">Device Punches</th>
                      <th className="py-2.5 px-3">Last Recorded Punch</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDeviceUsers.map(u => (
                      <tr key={u.empCode} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-gray-800">
                          <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            {u.empCode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-primary-text whitespace-nowrap">
                          {u.empName}
                        </td>
                        <td className="py-2.5 px-3 text-muted whitespace-nowrap">
                          {u.designation || 'Staff'}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 font-bold rounded-full bg-blue-50 text-blue-700">
                            {u.totalPunches}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {u.lastPunch ? (
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                (u.lastDirection || '').toLowerCase().includes('in')
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {u.lastDirection || 'PUNCH'}
                              </span>
                              <span className="text-gray-700 font-medium">
                                {new Date(u.lastPunch).toLocaleString('en-IN', {
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted italic">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              const devName = selectedDeviceForUsers?.name || '';
                              const devSn = selectedDeviceForUsers?.sn || '';
                              setSelectedDeviceForUsers(null);
                              navigate(`/admin/device-logs?device=${encodeURIComponent(devName)}&sn=${encodeURIComponent(devSn)}&empCode=${encodeURIComponent(u.empCode)}`);
                            }}
                            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 ml-auto"
                          >
                            View Logs &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* Punches Tab */
            filteredDevicePunches.length === 0 ? (
              <div className="py-12 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-primary-text">No punch logs found</p>
                <p className="text-xs text-muted mt-0.5">
                  {deviceUserSearch ? 'No punches matched your search filter.' : 'No biometric punches logged on this device yet.'}
                </p>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-muted sticky top-0 border-b border-border z-10">
                    <tr>
                      <th className="py-2.5 px-3">Date &amp; Time</th>
                      <th className="py-2.5 px-3">Emp Code</th>
                      <th className="py-2.5 px-3">Employee Name</th>
                      <th className="py-2.5 px-3">Direction</th>
                      <th className="py-2.5 px-3">Verify Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDevicePunches.map((p, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-gray-800">
                          {new Date(p.logDate).toLocaleString('en-IN', {
                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-gray-700">
                          {p.empCode}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-primary-text whitespace-nowrap">
                          {p.empName}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            (p.direction || '').toLowerCase().includes('in')
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {p.direction || 'IN'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted">
                          {p.verifyMode || 'Face'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted">
              Showing {deviceUsersTab === 'users' ? filteredDeviceUsers.length : filteredDevicePunches.length} records
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedDeviceForUsers(null)}
                className="px-4 py-1.5 text-xs"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  const devName = selectedDeviceForUsers?.name || '';
                  const devSn = selectedDeviceForUsers?.sn || '';
                  setSelectedDeviceForUsers(null);
                  navigate(`/admin/device-logs?device=${encodeURIComponent(devName)}&sn=${encodeURIComponent(devSn)}`);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 text-xs flex items-center gap-1.5"
              >
                Full Device Logs &rarr;
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ManageDevices;
