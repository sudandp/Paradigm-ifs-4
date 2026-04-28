import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSecurityCheck } from '../hooks/useSecurityCheck';
import SecurityWarningModal from '../components/ui/SecurityWarningModal';
import { api } from '../services/api';
import { isAdmin } from '../utils/auth';
import { getCurrentDevice, registerDevice, getDeviceLimits, createDeviceChangeRequest } from '../services/deviceService';
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

                // For developers, we might just log but not block, or just standard register
                // Let's standard register everyone to ensure logs are kept
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
                    // Mark this user as checked
                    lastCheckedUserId.current = user.id;
                } else if (result.request) {
                    // Device is awaiting approval
                    setDeviceStatus('pending');
                    setDeviceInfo({ 
                       id: result.request.id, 
                       name: deviceName, 
                       type: deviceType as DeviceType 
                    });
                    setDeviceMessage(result.message);
                } else if (result.requiresApproval) {
                    // Limit reached, wait for user to "press" request button
                    setDeviceStatus('limit_reached');
                    setDeviceInfo({ 
                       id: '', 
                       name: deviceName, 
                       type: deviceType as DeviceType 
                    });
                    setDeviceMessage(result.message);
                } else {
                    // Other error (e.g. revoked)
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
                // FAIL CLOSED: Show error instead of letting them in.
                setDeviceStatus('revoked');
                setDeviceMessage(`Device security check failed: ${error?.message || 'Network error'}. Please try again.`);
                // Reset check state to allow trying again
                lastCheckedUserId.current = null;
            }
        };

        checkDevice();
    }, [user?.id, checkTrigger]); // Only depend on user.id and manual trigger

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
            // Switch to pending status after successful request
            setDeviceStatus('pending');
            setDeviceMessage('Your device access request has been submitted. Please wait for admin/HR approval.');
        } catch (e: any) {
            console.error('Failed to request access:', e);
            // If it's a duplicate request error, show pending anyway
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

    // 1. Check basic security (Dev mode / Location spoofing)
    if (user && !isExemptFromSecurityChecks && !securityCheck.isSecure) {
        return <SecurityWarningModal issues={securityCheck.issues} />;
    }

    // 2. Check Device Authorization
    if (user && deviceStatus !== 'authorized' && deviceStatus !== 'checking') {
        // If developer, maybe bypass?
        if (user.role === 'developer') return <>{children}</>;

        return (
            <DeviceWarningDialog 
                userId={user.id}
                status={deviceStatus as any}
                deviceName={deviceInfo?.name || 'Unknown Device'}
                deviceType={deviceInfo?.type || 'web'}
                limits={limits}
                customMessage={deviceMessage}
                isRequestingAccess={isRequestingAccess}
                onLogout={() => useAuthStore.getState().logout()}
                onRequestAccess={handleRequestAccess}
                onTryAgain={handleTryAgain}
            />
        );
    }
    
    // While checking device status, show a loading screen to prevent "not restructing user" issue
    if (user && deviceStatus === 'checking' && user.role !== 'developer') {
         return <LoadingScreen message="Verifying device security..." />;
    }
    
    // Otherwise, render children normally
    return <>{children}</>;
};

export default SecurityWrapper;
