import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Smartphone, 
  Globe, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Shield,
  Info,
  Cpu,
  Zap,
  Wifi
} from 'lucide-react';
import Toast from '../ui/Toast';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { 
  getUserDevices, 
  revokeDevice, 
  deleteDevice,
  getCurrentDevice
} from '../../services/deviceService';
import { UserDevice, DeviceType } from '../../types';
import { formatDate } from '../../utils/date';

interface UserDeviceListProps {
  userId: string;
  userRole?: string;
  canManage?: boolean;
  className?: string;
  showTitle?: boolean;
}

const UserDeviceList: React.FC<UserDeviceListProps> = ({ 
  userId, 
  userRole = 'staff',
  canManage = false,
  className = '',
  showTitle = true
}) => {
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceIdentifier, setCurrentDeviceIdentifier] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [viewedDevice, setViewedDevice] = useState<UserDevice | null>(null);
  const [limits, setLimits] = useState<{ web: number; android: number; ios: number }>({ web: 1, android: 1, ios: 1 });

  useEffect(() => {
    loadDevices();
    identifyCurrentDevice();
    loadLimits();
  }, [userId, userRole]);

  const loadLimits = async () => {
    try {
      const { getDeviceLimits } = await import('../../services/deviceService');
      const devLimits = await getDeviceLimits(userRole);
      setLimits(devLimits);
    } catch (e) {
      console.error('Error loading limits:', e);
    }
  };

  const loadDevices = async () => {
    try {
      setLoading(true);
      const userDevices = await getUserDevices(userId);
      setDevices(userDevices);
    } catch (error) {
      console.error('Error loading devices:', error);
      setToast({ message: 'Failed to load devices', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const identifyCurrentDevice = async () => {
    try {
      const { deviceIdentifier } = await getCurrentDevice();
      setCurrentDeviceIdentifier(deviceIdentifier);
    } catch (error) {
      console.error('Error identifying device:', error);
    }
  };

  const handleRevokeDevice = async (device: UserDevice) => {
    if (!canManage) return;
    
    const isRevoked = device.status === 'revoked';
    const action = isRevoked ? 'permanently delete' : 'remove';
    const confirmMessage = isRevoked 
      ? 'Are you sure you want to permanently delete this device history? This cannot be undone.'
      : 'Are you sure you want to remove this device? The user will need to register it again to use it.';

    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      if (isRevoked) {
        await deleteDevice(device.id);
        setToast({ message: 'Device deleted permanently', type: 'success' });
      } else {
        await revokeDevice(device.id);
        setToast({ message: 'Device removed successfully', type: 'success' });
      }
      await loadDevices();
    } catch (error) {
      console.error('Error removing/deleting device:', error);
      setToast({ message: 'Failed to remove device', type: 'error' });
    }
  };

  const getDeviceIcon = (device: UserDevice) => {
    const type = device.deviceType.toLowerCase();
    const os = device.deviceInfo?.os?.toLowerCase() || '';
    const model = device.deviceInfo?.deviceModel?.toLowerCase() || '';
    const name = device.deviceName.toLowerCase();

    if (os.includes('ios') || os.includes('iphone')) return <Smartphone className="w-5 h-5 text-gray-800" />;
    if (os.includes('ipad')) return <Smartphone className="w-5 h-5 text-gray-800" />; // Or Tablet icon if available
    if (os.includes('mac')) return <Monitor className="w-5 h-5 text-gray-800" />;
    if (type === 'android') return <Smartphone className="w-5 h-5 text-green-500" />;
    
    return <Monitor className="w-5 h-5" />;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'active':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Active</span>;
      case 'pending':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pending Approval</span>;
      case 'revoked':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" /> Revoked</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getUsageColor = (used: number, limit: number) => {
    if (used > limit) return 'bg-red-50 border-red-100 text-red-700';
    if (used === limit) return 'bg-amber-50 border-amber-100 text-amber-700';
    return 'bg-blue-50 border-blue-100 text-blue-700';
  };

  const activeWeb = devices.filter(d => d.deviceType.toLowerCase() === 'web' && d.status.toLowerCase() === 'active').length;
  const activeAndroid = devices.filter(d => d.deviceType.toLowerCase() === 'android' && d.status.toLowerCase() === 'active').length;
  const activeIos = devices.filter(d => d.deviceType.toLowerCase() === 'ios' && d.status.toLowerCase() === 'active').length;

  return (
    <div className={`space-y-6 ${className}`}>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      {showTitle && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-primary" /> Registered Devices
          </h2>
          
          <div className="flex gap-2">
            <div className={`px-3 py-1 border rounded-lg text-xs font-semibold flex items-center gap-1.5 ${getUsageColor(activeWeb, limits.web)}`}>
              <Monitor className="w-3.5 h-3.5" /> Laptop / PC: {activeWeb} / {limits.web}
            </div>
            <div className={`px-3 py-1 border rounded-lg text-xs font-semibold flex items-center gap-1.5 ${getUsageColor(activeAndroid, limits.android)}`}>
              <Smartphone className="w-3.5 h-3.5" /> Android: {activeAndroid} / {limits.android}
            </div>
            <div className={`px-3 py-1 border rounded-lg text-xs font-semibold flex items-center gap-1.5 ${getUsageColor(activeIos, limits.ios)}`}>
              <Smartphone className="w-3.5 h-3.5" /> iOS: {activeIos} / {limits.ios}
            </div>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-gray-50 h-20 rounded-lg"></div>
          ))}
        </div>
      ) : devices.length > 0 ? (
        <div className="space-y-4">
          {devices.map(device => {
            const isCurrent = device.deviceIdentifier === currentDeviceIdentifier;
            return (
              <div key={device.id} className={`border rounded-xl p-4 transition-all ${isCurrent ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${isCurrent ? 'bg-white text-primary' : 'bg-gray-100 text-gray-500'}`}>
                      {getDeviceIcon(device)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {(() => {
                            const info = device.deviceInfo || {};
                            const os = (info.os || '').toLowerCase();
                            const manufacturer = (info.manufacturer || '').toLowerCase();
                            const model = (info.deviceModel || '').toLowerCase();
                            const browser = info.browser || '';
                            
                            // 1. Identify Apple Devices Specifically
                            if (manufacturer.includes('apple') || os.includes('mac') || os.includes('ios') || os.includes('iphone') || os.includes('ipad')) {
                              if (os.includes('iphone') || model.includes('iphone')) return `iPhone (${browser})`;
                              if (os.includes('ipad') || model.includes('ipad')) return `iPad (${browser})`;
                              if (os.includes('mac') || model.includes('mac')) return `MacBook / iMac (${browser})`;
                              return `Apple Device (${browser})`;
                            }
                            
                            // 2. Identify Android
                            if (device.deviceType.toLowerCase() === 'android' || os.includes('android')) {
                              const hwModel = info.hardwareModel || info.deviceModel;
                              const manufacturer = (info.manufacturer || '').replace(/Google Inc\.?/i, 'Google');
                              
                              let makeModel = 'Android Device';
                              if (hwModel && manufacturer) {
                                // Prevent "Samsung Samsung Fold" or "Google Pixel"
                                const hasManufInModel = hwModel.toLowerCase().includes(manufacturer.toLowerCase());
                                makeModel = hasManufInModel ? hwModel : `${manufacturer} ${hwModel}`;
                              } else {
                                makeModel = hwModel || manufacturer || 'Android Device';
                              }
                              
                              // Clean up generic "K" or "Unknown"
                              if (makeModel.toUpperCase() === 'K' || makeModel.toUpperCase() === 'UNKNOWN') makeModel = 'Android Device';
                              
                              return `${makeModel} (${browser})`;
                            }
                            
                            // 3. Identify PC Make (HP, Dell, etc.)
                            if (info.deviceModel || info.manufacturer) {
                              const model = info.deviceModel || '';
                              const manufacturer = (info.manufacturer || '').replace(/Google Inc\.?/i, 'Google');
                              
                              let makeModel = '';
                              if (model && manufacturer) {
                                const hasManufInModel = model.toLowerCase().includes(manufacturer.toLowerCase());
                                makeModel = hasManufInModel ? model : `${manufacturer} ${model}`;
                              } else {
                                makeModel = model || manufacturer;
                              }
                              
                              return `${makeModel} Laptop/PC (${browser})`;
                            }

                            // Fallback to the original logic or registered device name
                            return device.deviceName || `${os || 'Unknown'} System (${browser})`;
                          })()}
                        </h3>
                        {isCurrent && <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">Current</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <span>
                          {device.deviceType.toLowerCase() === 'web' 
                            ? `${device.deviceInfo?.browser} on ${device.deviceInfo?.os || device.deviceInfo?.platform}`
                            : `${device.deviceInfo?.manufacturer || ''} ${device.deviceInfo?.deviceModel || device.deviceInfo?.platform || ''}`
                          }
                        </span>
                        {device.deviceInfo?.ipAddress && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-[11px] font-mono">
                              <Globe className="w-3 h-3 text-accent/70" /> {device.deviceInfo.ipAddress}
                            </span>
                          </>
                        )}
                        <span className="text-gray-300">•</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(device.lastUsedAt)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {device.deviceInfo?.batteryLevel !== undefined && (
                          <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 text-[10px] font-medium text-gray-600">
                            <span className={`w-1.5 h-1.5 rounded-full ${device.deviceInfo.batteryLevel > 0.2 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            Battery: {Math.round(device.deviceInfo.batteryLevel * 100)}% {device.deviceInfo.isCharging ? '(Charging)' : ''}
                          </span>
                        )}
                        {device.deviceInfo?.connectionType && (
                          <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 text-[10px] font-medium text-gray-600 uppercase">
                            Network: {device.deviceInfo.connectionType}
                          </span>
                        )}
                        {device.deviceInfo?.appVersion && (
                          <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 text-[10px] font-medium text-gray-600">
                            App v{device.deviceInfo.appVersion}
                          </span>
                        )}
                        {device.deviceInfo?.androidId && (
                          <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 text-[10px] font-medium text-gray-600 font-mono">
                            Android ID: {device.deviceInfo.androidId}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-400 font-mono">
                        System ID: {device.id.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    {getStatusBadge(device.status)}
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewedDevice(device)}
                        className="p-1.5 text-gray-400 hover:text-accent hover:bg-accent-soft rounded-lg transition-colors"
                        title="View device details"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      
                      {canManage && (
                        <button 
                          onClick={() => handleRevokeDevice(device)}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
                          title="Remove Device"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Monitor className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p>No devices registered yet.</p>
        </div>
      )}

      {/* Device Information Modal */}
      <Modal
        isOpen={!!viewedDevice}
        onClose={() => setViewedDevice(null)}
        title="Device Information"
        hideFooter
        maxWidth="md:max-w-lg"
      >
        {viewedDevice && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="p-3 bg-white text-primary rounded-lg shadow-sm">
                {getDeviceIcon(viewedDevice)}
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{viewedDevice.deviceName}</h4>
                <p className="text-xs text-gray-500">Registered: {formatDate(viewedDevice.registeredAt)}</p>
              </div>
              <div className="ml-auto">
                {getStatusBadge(viewedDevice.status)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Manufacturer</div>
                    <p className="text-sm font-medium text-gray-700">{viewedDevice.deviceInfo?.manufacturer || 'Unknown'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Hardware Model</div>
                    <p className="text-sm font-medium text-gray-700">{viewedDevice.deviceInfo?.deviceModel || 'Unknown'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Operating System</label>
                    <p className="text-sm font-medium text-gray-700">
                      {(() => {
                        const os = viewedDevice.deviceInfo?.os || '';
                        const version = viewedDevice.deviceInfo?.osVersion || '';
                        const capOS = os.charAt(0).toUpperCase() + os.slice(1);
                        if (version.toLowerCase().startsWith(os.toLowerCase())) return version;
                        return `${capOS} ${version}`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Battery Status</label>
                    <p className="text-sm font-medium text-gray-700">
                      {viewedDevice.deviceInfo?.batteryLevel !== undefined 
                        ? `${Math.round(viewedDevice.deviceInfo.batteryLevel * 100)}% ${viewedDevice.deviceInfo.isCharging ? '(Charging)' : ''}`
                        : 'Unknown'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Wifi className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Network Info</label>
                    <p className="text-sm font-medium text-gray-700 uppercase">{viewedDevice.deviceInfo?.connectionType || 'Unknown'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Public IP API</label>
                    <p className="text-sm font-mono text-gray-700">{viewedDevice.deviceInfo?.ipAddress || 'Not recorded'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Screen</label>
                    <p className="text-sm font-medium text-gray-700">{viewedDevice.deviceInfo?.screenResolution || 'Unknown'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">App Version</span>
                <span className="font-medium text-gray-700">v{viewedDevice.deviceInfo?.appVersion || 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Hardware Signature</span>
                <span className="font-mono text-gray-700 text-[10px]">
                  {viewedDevice.deviceInfo?.canvas ? `HW-${viewedDevice.deviceInfo.canvas.slice(-8).toUpperCase()}` : 'GENERIC-ID'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">System ID</span>
                <span className="font-mono text-gray-700">{viewedDevice.id.slice(0, 18)}...</span>
              </div>
              {viewedDevice.deviceInfo?.androidId && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Android ID</span>
                  <span className="font-mono text-gray-700">{viewedDevice.deviceInfo.androidId}</span>
                </div>
              )}
            </div>
            
            <div className="flex justify-end pt-2">
              <Button onClick={() => setViewedDevice(null)} variant="secondary" className="w-full">
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserDeviceList;
