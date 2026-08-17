import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useImpersonationStore } from '../store/impersonationStore';
import { useSecurityCheck } from '../hooks/useSecurityCheck';
import SecurityWarningModal from '../components/ui/SecurityWarningModal';
import { api } from '../services/api';
import { isAdmin } from '../utils/auth';
import { getCurrentDevice, registerDevice, getDeviceLimits, createDeviceChangeRequest, replaceOldestDevice } from '../services/deviceService';
import DeviceWarningDialog from './devices/DeviceWarningDialog';
import { DeviceType } from '../types';
import LoadingScreen from './ui/LoadingScreen';


interface SecurityWrapperProps {
    children: React.ReactNode;
}

/**
 * Security wrapper component that monitors for developer mode, location spoofing,
 * and UNREGISTERED/UNAUTHORIZED DEVICES after user has logged in.
 */
const SecurityWrapper: React.FC<SecurityWrapperProps> = ({ children }) => {
    const { user } = useAuthStore();
    const securityCheck = useSecurityCheck();
    const [securityAlertSent, setSecurityAlertSent] = useState(false);

    // Device validation state
    const [deviceStatus, setDeviceStatus] = useState<'authorized' | 'pending' | 'revoked' | 'limit_reached' | 'checking'>('checking');
    const [deviceInfo, setDeviceInfo] = useState<{ id: string, name: string, type: DeviceType } | null>(null);
    const [deviceMessage, setDeviceMessage] = useState('');
    const [limits, setLimits] = useState<{ web: number; android: number; ios: number }>({ web: 1, android: 1, ios: 1 });
    const [isRequestingAccess, setIsRequestingAccess] = useState(false);
    const [isReplacingDevice, setIsReplacingDevice] = useState(false);
    const [checkTrigger, setCheckTrigger] = useState(0);

    // Track which user.id we've already checked to prevent re-running on profile updates
    const lastCheckedUserId = useRef<string | null>(null);

    // Check if current user is exempt from security checks (admin/developer)
    // NOTE: We might want admins to also be subject to device limits, but for now keeping consistency
    // with existing security check pattern. However, device registration is beneficial for tracking.
    const isExemptFromSecurityChecks = user && (user.role === 'developer'); 

    // Monitor security issues and send alerts (only for non-exempt users)
    useEffect(() => {
        if (user && !isExemptFromSecurityChecks && !securityCheck.isSecure && !securityAlertSent) {
            const violationType = securityCheck.developerModeEnabled
                ? 'developer_mode'
                : 'location_spoofing';

            // Send alert to reporting manager
            api.sendSecurityAlert(user.id, user.name, violationType, undefined)
                .catch(err => console.error('Failed to send security alert:', err));

            setSecurityAlertSent(true);
        }
    }, [user, securityCheck, securityAlertSent, isExemptFromSecurityChecks]);

    // Perform Device Validation (memoized to avoid redundant calls)
    useEffect(() => {
        const checkDevice = async () => {
            if (!user) return;

            // If developer or admin is impersonating, skip device registration & security checks entirely
            const isImpState = useImpersonationStore.getState().isImpersonating;
            const isImpLocal = !!localStorage.getItem('paradigm_impersonation_session');
            if (user.role === 'developer' || isImpState || isImpLocal) {
                setDeviceStatus('authorized');
                lastCheckedUserId.current = user.id;
                return;
            }

            // Skip if we've already checked this user
            if (lastCheckedUserId.current === user.id) {
                return;
            }

            try {
                // Get current device details and limits
                const [{ deviceIdentifier, deviceType, deviceName, deviceInfo: dInfo }, devLimits] = await Promise.all([
                    getCurrentDevice(),
                    getDeviceLimits(user.role)
                ]);
                
                setLimits(devLimits);

                const result = await registerDevice(
                    user.id,
                    user.role,
                    deviceIdentifier,
                    deviceType as DeviceType,
                    deviceName,
                    dInfo
                );

                if (result.success) {
                    setDeviceStatus('authorized');
                    lastCheckedUserId.current = user.id;
                } else if (result.request) {
                    setDeviceStatus('pending');
                    setDeviceInfo({ 
                       id: result.request.id, 
                       name: deviceName, 
                       type: deviceType as DeviceType 
                    });
                    setDeviceMessage(result.message);
                } else if (result.requiresApproval) {
                    setDeviceStatus('limit_reached');
                    setDeviceInfo({ 
                       id: '', 
                       name: deviceName, 
                       type: deviceType as DeviceType 
                    });
                    setDeviceMessage(result.message);
                } else {
                    setDeviceStatus('revoked');
                    setDeviceInfo({ 
                       id: '', 
                       name: deviceName, 
                       type: deviceType as DeviceType 
                    });
                    setDeviceMessage(result.message || 'Unable to register device. Please try again.');
                }

            } catch (error: any) {
                console.error('Device validation failed:', error);
                setDeviceStatus('revoked');
                setDeviceMessage(`Device security check failed: ${error?.message || 'Network error'}. Please try again.`);
                lastCheckedUserId.current = null;
            }
        };

        checkDevice();
    }, [user?.id, checkTrigger]);

    // Handler for "Request Access" button - creates a device change request
    const handleRequestAccess = async () => {
        if (!user) return;
        try {
            setIsRequestingAccess(true);
            const { deviceIdentifier, deviceType, deviceName, deviceInfo: dInfo } = await getCurrentDevice();
            await createDeviceChangeRequest(
                user.id,
                deviceType as DeviceType,
                deviceIdentifier,
                deviceName,
                dInfo
            );
            setDeviceStatus('pending');
            setDeviceMessage('Your device access request has been submitted. Please wait for admin/HR approval.');
        } catch (e: any) {
            console.error('Failed to request access:', e);
            if (e?.message?.includes('duplicate') || e?.code === '23505') {
                setDeviceStatus('pending');
                setDeviceMessage('You already have a pending request. Please wait for admin/HR approval.');
            } else {
                setDeviceMessage('Failed to submit request. Please try again.');
            }
        } finally {
            setIsRequestingAccess(false);
        }
    };

    // Handler for "Try Again" button - forces a re-check
    const handleTryAgain = () => {
        setDeviceStatus('checking');
        lastCheckedUserId.current = null;
        setCheckTrigger(prev => prev + 1);
    };

    // Handler for "Auto-Replace Oldest & Login" button
    const handleAutoReplaceDevice = async () => {
        if (!user) return;
        try {
            setIsReplacingDevice(true);
            const { deviceIdentifier, deviceType, deviceName, deviceInfo: dInfo } = await getCurrentDevice();
            const result = await replaceOldestDevice(
                user.id,
                user.role,
                deviceType as DeviceType,
                deviceIdentifier,
                deviceName,
                dInfo
            );
            if (result.success) {
                setDeviceStatus('authorized');
                lastCheckedUserId.current = user.id;
            } else {
                setDeviceMessage(result.message || 'Failed to replace device. Please try again.');
            }
        } catch (error: any) {
            console.error('Failed to auto-replace device:', error);
            setDeviceMessage(`Replacement failed: ${error?.message || 'Unknown error'}`);
        } finally {
            setIsReplacingDevice(false);
        }
    };

    const isImpersonating = useImpersonationStore(s => s.isImpersonating);
    const isImpLocal = !!localStorage.getItem('paradigm_impersonation_session');

    // 1. Check basic security (Dev mode / Location spoofing)
    if (user && !isExemptFromSecurityChecks && !securityCheck.isSecure && !isImpersonating && !isImpLocal) {
        return <SecurityWarningModal issues={securityCheck.issues} />;
    }

    // 2. Check Device Authorization (Bypassed during impersonation or developer role)
    if (user && (user.role === 'developer' || isImpersonating || isImpLocal)) {
        return <>{children}</>;
    }

    if (user && deviceStatus !== 'authorized' && deviceStatus !== 'checking') {
        return (
            <DeviceWarningDialog 
                userId={user.id}
                status={deviceStatus as any}
                deviceName={deviceInfo?.name || 'Unknown Device'}
                deviceType={deviceInfo?.type || 'web'}
                limits={limits}
                customMessage={deviceMessage}
                isRequestingAccess={isRequestingAccess}
                isReplacingDevice={isReplacingDevice}
                onLogout={() => useAuthStore.getState().logout()}
                onRequestAccess={handleRequestAccess}
                onTryAgain={handleTryAgain}
                onAutoReplace={handleAutoReplaceDevice}
            />
        );
    }
    
    // While checking device status, show a loading screen
    if (user && deviceStatus === 'checking' && user.role !== 'developer' && !isImpersonating && !isImpLocal) {
         return <LoadingScreen message="Verifying device security..." />;
    }
    
    return <>{children}</>;
};

export default SecurityWrapper;
