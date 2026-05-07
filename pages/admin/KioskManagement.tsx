import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { fetchKioskDevices, registerKioskDevice, assignKioskDevice, deleteKioskDevice, reportKioskHeartbeat, KioskDevice } from '../../services/gateApi';
import type { Location } from '../../types';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { Monitor, Battery, Wifi, Shield, Plus, RefreshCw, AlertCircle, CheckCircle, Smartphone, MapPin, Search, Edit, UserCheck, Trash2 } from 'lucide-react';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Pagination from '../../components/ui/Pagination';

const KioskManagement: React.FC = () => {
  const [kiosks, setKiosks] = useState<KioskDevice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  
  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingKioskId, setEditingKioskId] = useState<string | null>(null);
  const [editingKioskUserId, setEditingKioskUserId] = useState<string | null>(null);

  // Search and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = async () => {
    try {
      const [kioskList, locs] = await Promise.all([
        fetchKioskDevices(),
        api.getLocations(),
      ]);
      setKiosks(kioskList);
      setLocations(locs);
    } catch (err: any) {
      console.error(err);
      setToast({ message: 'Failed to load kiosk monitoring data.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh status data every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const openEditModal = (k: KioskDevice) => {
    setEditingKioskId(k.id);
    setEditingKioskUserId(k.userId);
    setDeviceName(k.deviceName || '');
    setSelectedLocationId(k.locationId || '');
    setShowEditModal(true);
  };

  const handleDeleteKiosk = async (k: KioskDevice) => {
    if (!window.confirm(`Are you sure you want to delete "${k.deviceName}"?\nThis will remove the device record from the system.`)) return;
    try {
      await deleteKioskDevice(k.id);
      setToast({ message: 'Kiosk deleted successfully!', type: 'success' });
      await loadData();
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || 'Failed to delete kiosk device.', type: 'error' });
    }
  };

  const handleUpdateKiosk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKioskId) return;
    if (!selectedLocationId || !deviceName) {
      setToast({ message: 'Please select a location and provide a device name.', type: 'error' });
      return;
    }
    setIsRegistering(true);
    try {
      await assignKioskDevice(editingKioskId, deviceName, selectedLocationId, editingKioskUserId);
      setToast({ message: editingKioskUserId ? 'Kiosk updated successfully!' : 'Kiosk assigned & user account created!', type: 'success' });
      setSelectedLocationId('');
      setDeviceName('');
      setEditingKioskId(null);
      setEditingKioskUserId(null);
      setShowEditModal(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || 'Failed to assign kiosk device.', type: 'error' });
    } finally {
      setIsRegistering(false);
    }
  };



  // Status checkers based on 5 minutes (300,000 ms) threshold
  const isOnline = (lastHeartbeat: string) => {
    if (!lastHeartbeat) return false;
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    return diff < 300000;
  };

  // Metrics computation
  const metrics = kiosks.reduce(
    (acc, k) => {
      acc.total += 1;
      const online = isOnline(k.lastHeartbeat);
      if (online) {
        acc.online += 1;
      } else {
        acc.offline += 1;
      }
      if (k.batteryPercentage !== null && k.batteryPercentage < 20) {
        acc.lowBattery += 1;
      }
      return acc;
    },
    { total: 0, online: 0, offline: 0, lowBattery: 0 }
  );

  if (isLoading) {
    return <LoadingScreen message="Loading kiosk telemetry..." />;
  }

  // Filter and Paginate
  const filteredKiosks = kiosks.filter(
    (k) =>
      searchTerm === '' ||
      k.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.locationName?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const paginatedKiosks = filteredKiosks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="p-4 md:p-6 w-full">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <AdminPageHeader title="Gate Kiosk Devices" />
            <p className="text-muted -mt-4 mb-4">
              Monitor and assign hardware kiosk devices to locations. Devices auto-register on first boot.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted bg-primary-50 p-3 rounded-lg border border-primary-100">
             <AlertCircle className="h-5 w-5 text-primary-500" />
             Boot a new device in Kiosk Mode to register it here automatically.
          </div>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Monitor className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Total Devices</p>
            <h4 className="text-2xl font-bold text-primary-text">{metrics.total}</h4>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-500/10 text-green-500">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Active (Online)</p>
            <h4 className="text-2xl font-bold text-primary-text">{metrics.online}</h4>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-red-500/10 text-red-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Inactive (Offline)</p>
            <h4 className="text-2xl font-bold text-primary-text">{metrics.offline}</h4>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
            <Battery className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted">Low Battery (&lt;20%)</p>
            <h4 className="text-2xl font-bold text-primary-text">{metrics.lowBattery}</h4>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <Input
            id="kiosk-search"
            name="kioskSearch"
            placeholder="Search kiosks by name or site location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4 text-muted" />}
          />
        </div>
        <Button variant="secondary" onClick={loadData} title="Refresh Live Data" className="p-3">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Devices Status List */}
      <div className="space-y-4 md:space-y-0">
        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {paginatedKiosks.length === 0 ? (
            <p className="text-muted text-center py-8">No registered kiosk devices found.</p>
          ) : (
            paginatedKiosks.map((k) => {
              const online = isOnline(k.lastHeartbeat);
              return (
                <div key={k.id} className="bg-card rounded-lg shadow-card p-4 border border-border">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-primary-text flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-muted" />
                        {k.deviceName}
                      </h4>
                      <p className="text-sm text-muted flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" /> {k.locationName}
                      </p>
                      {k.userEmail && (
                        <p className="text-[10px] text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full mt-1.5 w-fit flex items-center gap-1">
                          <UserCheck className="h-3 w-3" /> {k.userEmail}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {online ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-muted">Battery</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Battery className={`h-4 w-4 ${k.batteryPercentage && k.batteryPercentage < 20 ? 'text-red-500 animate-pulse' : 'text-green-500'}`} />
                        <span>{k.batteryPercentage !== null ? `${k.batteryPercentage}%` : '--'}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted">Network Speed</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Wifi className="h-4 w-4 text-muted" />
                        <span className="truncate">{k.signalStrength || '--'}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted">IP Address</p>
                      <p className="font-mono mt-0.5">{k.ipAddress || '--'}</p>
                    </div>
                    <div>
                      <p className="text-muted">Last Active</p>
                      <p className="mt-0.5">{k.lastHeartbeat ? new Date(k.lastHeartbeat).toLocaleString() : 'Never'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEditModal(k)} size="sm" className="flex items-center gap-1.5 text-xs py-1.5 h-auto">
                      <Edit className="h-3.5 w-3.5" /> Assign Site
                    </Button>
                    <Button variant="outline" onClick={() => handleDeleteKiosk(k)} size="sm" className="flex items-center gap-1.5 text-xs py-1.5 h-auto border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto border border-border rounded-lg bg-card">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-page text-primary-text">
              <tr>
                <th className="p-3 border-b border-border text-left">Device Name</th>
                <th className="p-3 border-b border-border text-left">Site Location</th>
                <th className="p-3 border-b border-border text-left">Linked Account</th>
                <th className="p-3 border-b border-border text-left">Status</th>
                <th className="p-3 border-b border-border text-left">Battery</th>
                <th className="p-3 border-b border-border text-left">Signal Speed</th>
                <th className="p-3 border-b border-border text-left">IP Address</th>
                <th className="p-3 border-b border-border text-left">Last Active</th>
                <th className="p-3 border-b border-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedKiosks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted">
                    No registered kiosk devices found.
                  </td>
                </tr>
              ) : (
                paginatedKiosks.map((k) => {
                  const online = isOnline(k.lastHeartbeat);
                  return (
                    <tr key={k.id} className="border-b border-border hover:bg-page/50 transition-colors">
                      <td className="p-3 font-semibold flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-muted" />
                        {k.deviceName}
                      </td>
                      <td className="p-3">{k.locationName}</td>
                      <td className="p-3">
                        {k.userEmail ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-50 text-cyan-700">
                            <UserCheck className="h-3 w-3" /> {k.userEmail}
                          </span>
                        ) : (
                          <span className="text-muted text-xs italic">Not linked</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
                          {online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="p-3">
                        {k.batteryPercentage !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-border h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  k.batteryPercentage < 20
                                    ? 'bg-red-500'
                                    : k.batteryPercentage < 50
                                    ? 'bg-amber-500'
                                    : 'bg-green-500'
                                }`}
                                style={{ width: `${k.batteryPercentage}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs font-bold">{k.batteryPercentage}%</span>
                          </div>
                        ) : (
                          <span className="text-muted">--</span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-xs text-muted truncate max-w-[150px]">{k.signalStrength || '--'}</td>
                      <td className="p-3 font-mono text-xs">{k.ipAddress || '--'}</td>
                      <td className="p-3 text-xs text-muted">
                        {k.lastHeartbeat ? new Date(k.lastHeartbeat).toLocaleString() : 'Never'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="secondary" onClick={() => openEditModal(k)} size="sm" className="flex items-center gap-1.5 text-xs py-1 h-auto px-2 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/30">
                            <Edit className="h-3.5 w-3.5 text-emerald-600" /> Assign
                          </Button>
                          <Button variant="outline" onClick={() => handleDeleteKiosk(k)} size="sm" className="text-xs py-1 h-auto px-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredKiosks.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredKiosks.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            className="mt-4"
          />
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md border border-border rounded-xl shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-primary-text mb-4">Assign Location to Kiosk</h3>
            <form onSubmit={handleUpdateKiosk} className="space-y-4">
              <Select
                label="Site Location"
                id="edit-kiosk-loc"
                name="kioskLocation"
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                required
              >
                <option value="">-- Select Location --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name || loc.address || `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
                  </option>
                ))}
              </Select>

              <Input
                label="Kiosk Display Name"
                id="edit-kiosk-name"
                name="kioskName"
                placeholder="e.g., Gate 1 - North Entrance"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                required
              />

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="secondary" type="button" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isRegistering}>
                  Save Assignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default KioskManagement;
