import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { 
  Plus, 
  AlertTriangle,
  Laptop,
  Smartphone,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { 
  getCurrentDevice, 
  registerDevice, 
} from '../../services/deviceService';
import { DeviceType } from '../../types';
import UserDeviceList from '../../components/devices/UserDeviceList';
import MobileTopBar from '../../components/navigation/MobileTopBar';
import ProductivityDashboard from '../../components/productivity/ProductivityDashboard';

const DeviceManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [currentDeviceIdentifier, setCurrentDeviceIdentifier] = useState<string>('');
  
  const [registering, setRegistering] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'devices' | 'productivity'>('devices');

  useEffect(() => {
    identifyCurrentDevice();
  }, [user]);

  const identifyCurrentDevice = async () => {
    try {
      const { deviceIdentifier } = await getCurrentDevice();
      setCurrentDeviceIdentifier(deviceIdentifier);
    } catch (error) {
      console.error('Error identifying device:', error);
    }
  };

  const handleRegisterCurrentDevice = async () => {
    if (!user) return;
    
    try {
      setRegistering(true);
      const { deviceIdentifier, deviceType, deviceName, deviceInfo } = await getCurrentDevice();
      
      const result = await registerDevice(
        user.id,
        user.role,
        deviceIdentifier,
        deviceType as DeviceType,
        deviceName,
        deviceInfo
      );
      
      if (result.success) {
        setToast({ message: result.message, type: 'success' });
        setRefreshKey(prev => prev + 1); // Reload list
      } else if (result.requiresApproval) {
        setToast({ 
          message: 'Device registration request submitted for approval', 
          type: 'info' 
        });
        setRefreshKey(prev => prev + 1);
      } else {
        setToast({ message: result.message, type: 'error' });
      }
      
    } catch (error) {
      console.error('Error registering device:', error);
      setToast({ message: 'Failed to register device', type: 'error' });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24">
      <MobileTopBar title="LINKED DEVICES" parentPath="/mobile-home" />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Device & Productivity Management</h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">Manage linked devices, 1-laptop-to-1-user binding, and desktop application history</p>
        </div>

        {/* Top View Selector */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'devices'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" /> Linked Devices
          </button>
          <button
            onClick={() => setActiveTab('productivity')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'productivity'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Work Laptop Productivity
          </button>
        </div>
      </div>

      {activeTab === 'devices' ? (
        <>
          {/* Current Device Banner */}
          <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900 rounded-xl p-4 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-full text-amber-600 dark:text-amber-400 mt-1">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-300">Ensure your current device is registered</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  If your current device is not in the list below, please register it to avoid access issues.
                </p>
              </div>
            </div>
            <Button 
              onClick={handleRegisterCurrentDevice} 
              isLoading={registering}
              className="whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white border-none"
            >
              <Plus className="w-4 h-4 mr-2" /> Register This Device
            </Button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-card p-6 border border-slate-200 dark:border-zinc-800">
            {user && (
              <UserDeviceList 
                key={refreshKey} 
                userId={user.id} 
                userRole={user.role}
                canManage={true} 
              />
            )}
          </div>
        </>
      ) : (
        <ProductivityDashboard />
      )}
    </div>
  );
};

export default DeviceManagement; 
