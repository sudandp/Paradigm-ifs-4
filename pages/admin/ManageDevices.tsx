import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Organization, BiometricDevice } from '../../types';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import { Cpu, Plus, Trash2, Wifi, WifiOff, MapPin, RefreshCw, Settings } from 'lucide-react';
import LoadingScreen from '../../components/ui/LoadingScreen';


const ManageDevices: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [newDevice, setNewDevice] = useState({
    sn: '',
    name: '',
    organizationId: '',
    locationName: ''
  });
  const [editingDevice, setEditingDevice] = useState<BiometricDevice | null>(null);
  const [setupDevice, setSetupDevice] = useState<BiometricDevice | null>(null);

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
      setToast({ message: 'Failed to load devices.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveDevice = async () => {
    const source = editingDevice || newDevice;
    
    if (!source.sn || !source.name) {
      setToast({ message: 'Serial Number and Name are required.', type: 'error' });
      return;
    }

    // Surgical payload: only send fields that are actually in the table and relevant for updates/inserts
    const payload = {
      sn: source.sn,
      name: source.name,
      organizationId: source.organizationId === '' ? null : source.organizationId,
      locationName: source.locationName === '' ? null : source.locationName,
    };

    try {
      if (editingDevice) {
        await api.updateBiometricDevice(editingDevice.id, payload);
        setToast({ message: 'Device updated successfully.', type: 'success' });
        setIsAddModalOpen(false);
        setEditingDevice(null);
      } else {
        const newDev = await api.addBiometricDevice(payload);
        setToast({ message: 'Device added successfully.', type: 'success' });
        setIsAddModalOpen(false);
        setSetupDevice(newDev); // Trigger Setup Wizard
      }
      setNewDevice({ sn: '', name: '', organizationId: '', locationName: '' });
      fetchData();
    } catch (error: any) {
      console.error('Save error:', error);
      setToast({ message: error.message || 'Failed to save device.', type: 'error' });
    }
  };

  const handleEditDevice = (device: any) => {
    setEditingDevice(device);
    setIsAddModalOpen(true);
  };

  const handleDeleteDevice = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this device?')) return;
    try {
      await api.deleteBiometricDevice(id);
      setToast({ message: 'Device deleted successfully.', type: 'success' });
      fetchData();
    } catch (error) {
      setToast({ message: 'Failed to delete device.', type: 'error' });
    }
  };

  if (isLoading) {
      return <LoadingScreen message="Loading page data..." />;
  }

  return (
    <div className="p-4 md:p-8">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
          <div>
            <h1 className="text-3xl font-extrabold text-primary-text tracking-tight">Biometric Devices</h1>
            <p className="text-muted mt-1">Manage eSSL AiFace-Mars hardware across site locations.</p>
          </div>
          <Button 
            onClick={() => { setEditingDevice(null); setIsAddModalOpen(true); }} 
            className="flex items-center justify-center gap-2 h-11 px-6 shadow-lg shadow-accent/20"
          >
            <Plus className="h-5 w-5" /> Add New Device
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse bg-card rounded-2xl h-56 border border-border"></div>
            ))
          ) : devices.length === 0 ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center bg-card rounded-3xl border border-dashed border-border/60 shadow-sm">
              <div className="h-20 w-20 bg-accent/5 rounded-full flex items-center justify-center mb-6">
                <Cpu className="h-10 w-10 text-accent/40" />
              </div>
              <h3 className="text-xl font-bold text-primary-text mb-2">No Devices Configured</h3>
              <p className="text-muted text-center max-w-sm mb-8 px-6">
                You haven't added any biometric devices yet. Connect your first eSSL device to start tracking attendance.
              </p>
              <Button 
                variant="outline" 
                onClick={() => { setEditingDevice(null); setIsAddModalOpen(true); }}
                className="hover:bg-accent hover:text-white transition-all"
              >
                Register Your First Device
              </Button>
            </div>
          ) : (
          devices.map((device) => (
            <div key={device.id} className="bg-card rounded-2xl shadow-sm border border-border hover:border-accent hover:shadow-md transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-1 pt-24 bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-2xl ${device.status === 'online' ? 'bg-emerald-500/10' : 'bg-gray-500/10'}`}>
                    {device.status === 'online' ? (
                      <Wifi className="h-6 w-6 text-emerald-500" />
                    ) : (
                      <WifiOff className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditDevice(device)}
                      className="p-2 text-muted hover:text-accent hover:bg-accent/5 rounded-xl transition-all"
                      title="Edit Device"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(device.id)}
                      className="p-2 text-muted hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all"
                      title="Delete Device"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 mb-6">
                  <h3 className="text-xl font-bold text-primary-text tracking-tight">{device.name}</h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-muted bg-gray-50 px-2 py-1 rounded w-fit capitalize">
                    <span>SN: {device.sn}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6 pt-6 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-sm text-primary-text/80">
                    <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-muted" />
                    </div>
                    <span className="font-medium">{device.locationName || device.organization?.shortName || 'Unassigned Site'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-primary-text/80">
                    <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center">
                      <RefreshCw className="h-4 w-4 text-muted" />
                    </div>
                    <span className="text-xs">Last seen: <span className="text-muted">{device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 w-fit">
                  <span className={`h-2 w-2 rounded-full animate-pulse ${device.status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-400'}`}></span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${device.status === 'online' ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {device.status}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

    <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onConfirm={handleSaveDevice}
        title={editingDevice ? "Edit Biometric Device" : "Add New Biometric Device"}
        confirmButtonText={editingDevice ? "Save Changes" : "Add Device"}
        confirmButtonVariant="primary"
      >
        <div className="space-y-4 py-4">
          <Input
            label="Serial Number (SN)"
            value={editingDevice ? editingDevice.sn : newDevice.sn}
            onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, sn: e.target.value }) : setNewDevice({ ...newDevice, sn: e.target.value })}
            placeholder="e.g. CI987654321"
            required
            disabled={!!editingDevice}
          />
          <Input
            label="Device Name"
            value={editingDevice ? editingDevice.name : newDevice.name}
            onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, name: e.target.value }) : setNewDevice({ ...newDevice, name: e.target.value })}
            placeholder="e.g. Main Gate Arrival"
            required
          />
          <Input
            label="Manual Site (Optional)"
            value={editingDevice ? (editingDevice.locationName || '') : newDevice.locationName}
            onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, locationName: e.target.value }) : setNewDevice({ ...newDevice, locationName: e.target.value })}
            placeholder="e.g. South Entry Gate"
          />
          <div className="text-xs text-muted -mt-2">If manual site is entered, it will override organization name in attendance logs.</div>
          
          <Select
            label="Assign Site (Organization)"
            value={editingDevice ? (editingDevice.organizationId || '') : newDevice.organizationId}
            onChange={(e) => editingDevice ? setEditingDevice({ ...editingDevice, organizationId: e.target.value }) : setNewDevice({ ...newDevice, organizationId: e.target.value })}
          >
            <option value="">Select a Site</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.shortName}</option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* Setup Wizard Modal */}
      <Modal
        isOpen={!!setupDevice}
        onClose={() => setSetupDevice(null)}
        title=" Configure Your Device"
        confirmButtonText="I Have Configured It"
        onConfirm={() => setSetupDevice(null)}
        confirmButtonVariant="primary"
      >
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>Action Required:</strong> Please enter these exact details into your eSSL Device under <em>Menu &rarr; Comm &rarr; Cloud Server (ADMS)</em>.
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1">Server Address (URL)</label>
              <div className="bg-gray-100 p-3 rounded-lg font-mono text-sm break-all select-all flex justify-between items-center group">
                 <span>https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/biometric-push</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1">Server Port</label>
                <div className="bg-gray-100 p-3 rounded-lg font-mono text-sm font-bold">443</div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1">Enable HTTPS</label>
                <div className="bg-gray-100 p-3 rounded-lg font-mono text-sm font-bold text-emerald-600">ON</div>
              </div>
            </div>
            
             <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1">Enable Domain Name</label>
                <div className="bg-gray-100 p-3 rounded-lg font-mono text-sm font-bold text-emerald-600">ON</div>
              </div>
          </div>

          <div className="border-t border-border pt-4">
             <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <div className="text-sm">
                   <span className="text-muted">Current Status: </span>
                   <span className={`font-bold ${devices.find(d => d.id === setupDevice?.id)?.status === 'online' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {devices.find(d => d.id === setupDevice?.id)?.status?.toUpperCase() || 'OFFLINE'}
                   </span>
                </div>
                <Button 
                   size="sm" 
                   variant="outline"
                   onClick={fetchData}
                   className="gap-2"
                 >
                   <RefreshCw className="h-3 w-3" /> Check Status
                 </Button>
             </div>
             <p className="text-xs text-muted mt-2 text-center">
                After saving on the device, wait 30 seconds and click "Check Status".
             </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ManageDevices;
