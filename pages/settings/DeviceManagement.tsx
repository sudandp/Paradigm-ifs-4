import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { 
  Plus, 
  AlertTriangle,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { 
  getCurrentDevice, 
  registerDevice, 
} from '../../services/deviceService';
import { DeviceType } from '../../types';
import UserDeviceList from '../../components/devices/UserDeviceList';


const DeviceManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [currentDeviceIdentifier, setCurrentDeviceIdentifier] = useState<string>('');
  
  const [registering, setRegistering] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  // We need a way to trigger a reload in the child component when a new device is registered
  const [refreshKey, setRefreshKey] = useState(0);

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
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Device Management</h1>
        <p className="text-gray-500 mt-1">Manage your registered devices and security settings</p>
      </div>

      {/* Current Device Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-100 rounded-full text-amber-600 mt-1">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900">Ensure your current device is registered</h3>
              <p className="text-sm text-amber-700 mt-1">
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

      <div className="bg-white rounded-xl shadow-card p-6">
        {user && (
            <UserDeviceList 
                key={refreshKey} 
                userId={user.id} 
                userRole={user.role}
                canManage={true} 
            />
        )}
      </div>
    </div>
  );
};

export default DeviceManagement; 
