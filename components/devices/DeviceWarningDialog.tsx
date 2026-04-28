/**
 * Device Warning Dialog
 * 
 * Full-screen blocking dialog shown when a user attempts to access the app
 * from an unauthorized device. Provides options to request access or logout.
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, LogOut, Send, Trash2, Smartphone, Monitor, RefreshCw } from 'lucide-react';
import { getUserDevices, revokeDevice } from '../../services/deviceService';
import { UserDevice } from '../../types';
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
  limits = { web: 1, android: 1, ios: 1 },
  customMessage,
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
        };
      case 'limit_reached':
        return {
          title: 'Device Limit Reached',
          description: customMessage || `You have reached your limit of authorized ${deviceType} sessions. You can remove an older device below to continue, or request a limit increase from your manager.`,
          actionText: 'Request Access',
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
              If you need to add this new device, please remove one of your active devices below and click "Try Again", 
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
    <div className="device-warning-overlay">
      <div className="device-warning-bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      
      <div className="device-warning-card animate-fade-in-scale">
        <div className="device-warning-header">
          <div className={`device-warning-icon-wrapper status-${status}`}>
            <AlertTriangle size={32} />
          </div>
          <h1 className="device-warning-title">{message.title}</h1>
        </div>
        
        <div className="device-warning-content">
          <div className="device-info-hero">
            <div className="device-type-icon">
              {deviceType === 'web' ? <Monitor size={24} /> : <Smartphone size={24} />}
            </div>
            <div className="device-info-text">
              <span className="device-label">CURRENT DEVICE</span>
              <p className="device-name" title={deviceName}>
                {deviceName.length > 40 ? `${deviceName.substring(0, 37)}...` : deviceName}
              </p>
              <span className="device-type-tag">
                {deviceType === 'web' ? 'Web Session' : `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} Session`}
              </span>
            </div>
          </div>
          
          <p className="device-warning-description">{message.description}</p>
          
          <div className="device-active-section">
            <div className="dw-section-header">
              <h3>Active {deviceType === 'web' ? 'Web' : `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)}`} Devices</h3>
              <span className="dw-limit-indicator">
                {existingDevices.filter(d => d.deviceType === deviceType).length} / {limits[deviceType as keyof typeof limits]}
              </span>
            </div>
            
            {loadingDevices ? (
              <div className="loading-state">
                <div className="spinner-small" />
                <span>Syncing devices...</span>
              </div>
            ) : existingDevices.filter(d => d.deviceType === deviceType).length > 0 ? (
              <div className="dw-device-grid">
                {existingDevices.filter(d => d.deviceType === deviceType).map(device => (
                  <div key={device.id} className="dw-device-card">
                    <div className="dw-device-card-icon">
                      {deviceType === 'web' ? <Monitor size={20} /> : <Smartphone size={20} />}
                    </div>
                    <div className="dw-device-card-info">
                      <span className="dw-device-card-name" title={device.deviceName}>
                        {device.deviceName.length > 30 ? `${device.deviceName.substring(0, 27)}...` : device.deviceName}
                      </span>
                      <span className="dw-status-active">Active</span>
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
              <div className="empty-state-mini">
                <p>No other active {deviceType} devices.</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="device-warning-footer">
          {message.showRequestButton && (
            <button
              className="action-button-primary"
              onClick={onRequestAccess}
              disabled={isRequestingAccess}
            >
              {isRequestingAccess ? (
                <>
                  <div className="spinner-small" />
                  <span>Requesting...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>{message.actionText}</span>
                </>
              )}
            </button>
          )}
          
          {message.showTryAgainButton && (
            <button
              className="action-button-primary animate-pulse-subtle"
              onClick={onTryAgain}
            >
              <RefreshCw size={18} />
              <span>Try Again</span>
            </button>
          )}

          <button
            className="action-button-primary action-button-logout"
            onClick={onLogout}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceWarningDialog;
