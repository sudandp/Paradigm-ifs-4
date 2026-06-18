/**
 * Device Warning Dialog
 * 
 * Full-screen blocking page shown when a user attempts to access the app
 * from an unauthorized device. Provides options to request access, revoke other sessions, or logout.
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, LogOut, Send, Smartphone, Monitor, RefreshCw, Laptop } from 'lucide-react';
import { getUserDevices, revokeDevice } from '../../services/deviceService';
import { UserDevice } from '../../types';
import Button from '../ui/Button';
import Logo from '../ui/Logo';
import './DeviceWarningDialog.css';

interface DeviceWarningDialogProps {
  userId: string;
  deviceName: string;
  deviceType: string;
  status: 'not_found' | 'pending' | 'revoked' | 'limit_reached';
  onRequestAccess: () => void;
  onLogout: () => void;
  onTryAgain?: () => void;
  isRequestingAccess?: boolean;
  limits?: { web: number; android: number; ios: number };
  customMessage?: string;
  onAutoReplace?: () => void;
  isReplacingDevice?: boolean;
}

const DeviceWarningDialog: React.FC<DeviceWarningDialogProps> = ({
  userId,
  deviceName,
  deviceType,
  status,
  onRequestAccess,
  onLogout,
  onTryAgain,
  isRequestingAccess = false,
  isReplacingDevice = false,
  limits = { web: 1, android: 1, ios: 1 },
  customMessage,
  onAutoReplace,
}) => {
  const [existingDevices, setExistingDevices] = useState<UserDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  useEffect(() => {
    if (status === 'limit_reached' || status === 'not_found' || status === 'pending') {
      loadUserDevices();
    }
  }, [userId, status]);

  const loadUserDevices = async () => {
    try {
      setLoadingDevices(true);
      const devices = await getUserDevices(userId);
      // Filter unique by deviceIdentifier to prevent multiple slots/buttons for same device
      const activeDevices = devices.filter(d => d.status === 'active');
      const uniqueDevices: UserDevice[] = [];
      const seenIds = new Set();
      
      activeDevices.forEach(d => {
        if (!seenIds.has(d.deviceIdentifier)) {
          uniqueDevices.push(d);
          seenIds.add(d.deviceIdentifier);
        }
      });

      setExistingDevices(uniqueDevices);
    } catch (e) {
      console.error('Error loading devices in dialog:', e);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleRemoveDevice = async (id: string) => {
    if (!window.confirm('Remove this device and free up a slot?')) return;
    try {
      await revokeDevice(id);
      await loadUserDevices();
      // Auto-trigger re-check after successful removal
      if (onTryAgain) {
        onTryAgain();
      }
    } catch (e) {
      alert('Failed to remove device');
    }
  };

  const getMessage = () => {
    switch (status) {
      case 'not_found':
        return {
          title: 'Device Not Registered',
          description: customMessage || 'This device is not registered for your account. Please check your registered devices or request access.',
          actionText: 'Request Access',
          showRequestButton: true,
          showTryAgainButton: false,
        };
      case 'limit_reached':
        const limitCount = limits[deviceType as keyof typeof limits] || 5;
        return {
          title: 'Device Limit Reached',
          description: customMessage || `You have reached your limit of ${limitCount} authorized ${deviceType} sessions. You can automatically deactivate your oldest session and log in immediately, or request a limit increase to add a ${limitCount + 1}th device.`,
          actionText: `Request ${limitCount + 1}th Device`,
          showRequestButton: true,
          showTryAgainButton: true,
        };
      case 'pending':
        const currentLimit = limits[deviceType as keyof typeof limits] || 1;
        return {
          title: 'Approval Pending',
          description: customMessage || (
            <>
              You have a limit of {currentLimit} {deviceType} device{currentLimit !== 1 ? 's' : ''} only. 
              If you need to add this new device, please remove one of your active devices on the right and click "Try Again", 
              or wait for management approval.
              <br /><br />
              If more devices need to be added, an administrator needs to give permission.
            </>
          ),
          actionText: 'Waiting for Approval',
          showRequestButton: false,
          showTryAgainButton: true,
        };
      case 'revoked':
        return {
          title: 'Device Access Revoked',
          description: customMessage || 'Access from this device has been revoked. You can request access again if this was a mistake.',
          actionText: 'Request Access',
          showRequestButton: true,
          showTryAgainButton: false,
        };
      default:
        return {
          title: 'Unauthorized Device',
          description: customMessage || 'You cannot access the application from this device.',
          actionText: '',
          showRequestButton: false,
          showTryAgainButton: false,
        };
    }
  };

  const message = getMessage();

  return (
    <div className="device-warning-page">
      <div className="device-warning-container">
        
        {/* Header with Logo */}
        <header className="device-warning-nav">
          <Logo className="h-9" variant="bottle-green" />
          <div className="device-warning-nav-badge">
            Security Checkpoint
          </div>
        </header>

        <main className="device-warning-grid">
          
          {/* Left Panel: Status Info */}
          <section className="device-warning-main-panel">
            <div className="device-warning-header-section">
              <div className={`device-warning-status-badge status-${status}`}>
                <AlertTriangle size={16} />
                <span>{status.replace('_', ' ').toUpperCase()}</span>
              </div>
              
              <h1 className="device-warning-main-title">{message.title}</h1>
              <p className="device-warning-main-description">{message.description}</p>
            </div>

            {/* Current Device Details Sub-card */}
            <div className="current-device-card">
              <div className="current-device-icon-wrapper">
                {deviceType === 'web' ? <Monitor size={22} /> : <Smartphone size={22} />}
              </div>
              <div className="current-device-details">
                <span className="current-device-label">CURRENT DEVICE</span>
                <h3 className="current-device-name" title={deviceName}>
                  {deviceName}
                </h3>
                <span className="current-device-type">
                  {deviceType === 'web' ? 'Web Session' : `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} Session`}
                </span>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="device-warning-actions">
              {status === 'limit_reached' && onAutoReplace && (
                <Button
                  variant="primary"
                  onClick={onAutoReplace}
                  isLoading={isReplacingDevice}
                  className="w-full md:w-auto"
                >
                  <RefreshCw size={16} className="mr-2" />
                  Deactivate Oldest & Login
                </Button>
              )}

              {message.showRequestButton && (
                <Button
                  variant={status === 'limit_reached' ? 'outline' : 'primary'}
                  onClick={onRequestAccess}
                  isLoading={isRequestingAccess}
                  className="w-full md:w-auto"
                >
                  <Send size={16} className="mr-2" />
                  {message.actionText}
                </Button>
              )}
              
              {message.showTryAgainButton && (
                <Button
                  variant={status === 'limit_reached' ? 'outline' : 'primary'}
                  onClick={onTryAgain}
                  className="w-full md:w-auto"
                >
                  <RefreshCw size={16} className="mr-2" />
                  Try Again
                </Button>
              )}

              <Button
                variant="secondary"
                onClick={onLogout}
                className="w-full md:w-auto text-gray-700 border border-gray-300"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </section>

          {/* Right Panel: Active Device / Session List */}
          <section className="device-warning-side-panel">
            <div className="side-panel-header">
              <h2 className="side-panel-title">Authorized Devices</h2>
              <span className="side-panel-limit-badge">
                {existingDevices.filter(d => d.deviceType === deviceType).length} / {limits[deviceType as keyof typeof limits]} Active
              </span>
            </div>
            
            <p className="side-panel-subtitle">
              You are signed in on these devices. You can remove a device to free up a slot.
            </p>

            <div className="active-devices-list">
              {loadingDevices ? (
                <div className="loading-state-wrapper">
                  <div className="spinner-small" />
                  <span>Loading active sessions...</span>
                </div>
              ) : existingDevices.filter(d => d.deviceType === deviceType).length > 0 ? (
                <div className="device-items-stack">
                  {existingDevices.filter(d => d.deviceType === deviceType).map(device => (
                    <div key={device.id} className="active-device-item-card">
                      <div className="active-device-item-icon">
                        {deviceType === 'web' ? <Monitor size={18} /> : <Smartphone size={18} />}
                      </div>
                      <div className="active-device-item-info">
                        <h4 className="active-device-item-name" title={device.deviceName}>
                          {device.deviceName}
                        </h4>
                        <div className="active-device-item-meta">
                          <span className="status-dot-active" />
                          <span>Active now</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="dw-btn-remove-compact"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-devices-state">
                  <Laptop size={32} className="text-gray-300 mb-2" />
                  <p>No other active {deviceType} devices.</p>
                </div>
              )}
            </div>
          </section>

        </main>
        
        {/* Footer info */}
        <footer className="device-warning-system-footer">
          <div>Paradigm Protection Engine v4.0</div>
          <div>All access attempts are monitored for security auditing.</div>
        </footer>

      </div>
    </div>
  );
};

export default DeviceWarningDialog;
