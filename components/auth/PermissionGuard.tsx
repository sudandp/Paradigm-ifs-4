import React, { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { Filesystem } from '@capacitor/filesystem';
import { App } from '@capacitor/app';

// Define the interface for our custom plugin
interface SecurityCheckPlugin {
    getSecurityStatus(): Promise<{
        developerMode: boolean;
        microphoneGranted: boolean;
        calendarGranted: boolean;
        contactsGranted: boolean;
        filesGranted: boolean;
        activityGranted: boolean;
    }>;
    openSettings(): Promise<void>;
}

const SecurityCheck = registerPlugin<SecurityCheckPlugin>('SecurityCheck');

interface PermissionGuardProps {
    children: React.ReactNode;
}

interface PermissionState {
    location: boolean;
    camera: boolean;
    notification: boolean;
    microphone: boolean;
    storage: boolean;
    calendar: boolean;
    contacts: boolean;
    activity: boolean;
}

interface SecurityState {
    developerMode: boolean;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({ children }) => {
    const [permissions, setPermissions] = useState<PermissionState>({
        location: false,
        camera: false,
        notification: false,
        microphone: false,
        storage: false,
        calendar: false,
        contacts: false,
        activity: false,
    });
    const [security, setSecurity] = useState<SecurityState>({
        developerMode: false,
    });
    const [loading, setLoading] = useState(true);

    const isNative = Capacitor.isNativePlatform();

    const checkPermissionsAndSecurity = async () => {
        if (!isNative) {
            setLoading(false);
            return;
        }

        try {
            // 0. Security Checks + Native Permission Checks
            let devMode = false;
            let nativeMicGranted = false;
            let nativeCalendarGranted = false;
            let nativeContactsGranted = false;
            let nativeFilesGranted = false;
            let nativeActivityGranted = false;

            try {
                // Native plugin checks OS manifest permission directly
                const status = await SecurityCheck.getSecurityStatus();
                devMode = status.developerMode;
                nativeMicGranted = status.microphoneGranted === true;
                nativeCalendarGranted = status.calendarGranted === true;
                nativeContactsGranted = status.contactsGranted === true;
                nativeFilesGranted = status.filesGranted === true;
                nativeActivityGranted = status.activityGranted === true;
            } catch (e) {
                console.warn("Failed to check security status or plugin not available", e);
            }

            // 1. Location
            const locationStatus = await Geolocation.checkPermissions();
            const locationGranted = locationStatus.location === 'granted' || locationStatus.coarseLocation === 'granted';

            // 2. Camera
            const cameraStatus = await Camera.checkPermissions();
            const cameraGranted = cameraStatus.camera === 'granted' || cameraStatus.photos === 'granted';

            // 3. Notifications
            let notificationGranted = false;
            try {
                const notificationStatus = await PushNotifications.checkPermissions();
                notificationGranted = notificationStatus.receive === 'granted';
            } catch (e) {
                console.warn('Push details not available or failed', e);
            }

            // 4. Storage (Filesystem)
            const storageStatus = await Filesystem.checkPermissions();
            const storageGranted = storageStatus.publicStorage === 'granted';

            // 5. Microphone
            // Use the native check result.
            const microphoneGranted = nativeMicGranted;


            setPermissions({
                location: locationGranted,
                camera: cameraGranted,
                notification: notificationGranted,
                storage: storageGranted,
                microphone: microphoneGranted,
                calendar: nativeCalendarGranted,
                contacts: nativeContactsGranted,
                activity: nativeActivityGranted,
            });
            setSecurity({
                developerMode: devMode
            });

        } catch (error) {
            console.error('Error checking permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const requestAllPermissions = async () => {
        if (!isNative) return;

        if (!permissions.location) {
            try { await Geolocation.requestPermissions(); } catch (e) { }
        }
        if (!permissions.camera) {
            try { await Camera.requestPermissions(); } catch (e) { }
        }
        if (!permissions.notification) {
            try { await PushNotifications.requestPermissions(); } catch (e) { }
        }
        if (!permissions.storage) {
            try { await Filesystem.requestPermissions(); } catch (e) { }
        }

        // For microphone, we don't have a direct "request" method from our custom plugin (yet).
        // But we can try using the standard user media request which triggers the robust prompt.
        // Or we rely on the user having gone to settings if they are stuck.
        // Ideally, we'd add a `requestMicrophonePermission` to the native plugin too, but
        // `getUserMedia` usually successfully *triggers* the dialog, just fails to resolve successfully.
        // So keeping this might still be useful to TRIGGER the prompt.
        if (!permissions.microphone) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
            } catch (err) { }
        }

        await checkPermissionsAndSecurity();
    };


    useEffect(() => {
        // Initial check
        checkPermissionsAndSecurity();

        // Re-check on resume
        const resumeListener = App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                checkPermissionsAndSecurity();
            }
        });

        return () => {
            resumeListener.then(handle => handle.remove());
        }
    }, [isNative]);

    if (!isNative) {
        return <>{children}</>;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    // Security Check: Developer Options - UNCHANGED for now, mostly matching previous
    if (security.developerMode) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 px-6 text-center animate-fade-in">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border-2 border-red-500">
                    <div className="mb-6">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/50">
                            <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Security Alert</h2>
                    <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                        Developer Options are enabled on this device.
                    </p>
                    <div className="bg-red-50 rounded-lg p-4 mb-6 text-left border border-red-100">
                        <p className="text-xs text-red-800 font-medium mb-1">
                            Action Required
                        </p>
                        <p className="text-xs text-red-600">
                            Please disable <strong>Developer Options</strong> in your device settings to continue using the application securely.
                        </p>
                    </div>

                    <button
                        onClick={() => checkPermissionsAndSecurity()}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-red-600/20 transition-all duration-200 active:scale-[0.98]"
                    >
                        Retry Check
                    </button>
                </div>
            </div>
        );
    }

    const allGranted =
        permissions.location &&
        permissions.camera &&
        permissions.notification &&
        permissions.storage &&
        permissions.microphone &&
        permissions.calendar &&
        permissions.contacts &&
        permissions.activity;

    // PERMISSION GUARD DISABLED PER PROJECT REQUIREMENT
    return <>{children}</>;
    
    /*
    if (allGranted) {
        return <>{children}</>;
    }
    */

    const openSettings = async () => {
        try {
            await (App as any).openAppSettings();
        } catch (e) {
            console.error("Failed to open settings", e);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 px-6 text-center animate-fade-in">
            {/* Red Border Box as requested */}
            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full border-4 border-red-600 relative overflow-hidden">

                <div className="mb-6">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/50">
                        {/* Custom Lock or Alert Icon */}
                        <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">Permissions Access</h2>
                <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                    This app requires full access to function. Please grant the following permissions in Settings.
                </p>

                <div className="w-full space-y-3 mb-8 text-left text-sm max-h-[320px] overflow-y-auto pr-1">
                    <PermissionItem label="Location" granted={permissions.location} />
                    <PermissionItem label="Camera" granted={permissions.camera} />
                    <PermissionItem label="Notifications" granted={permissions.notification} />
                    <PermissionItem label="Microphone" granted={permissions.microphone} />
                    <PermissionItem label="Files & Media" granted={permissions.storage} />
                    <PermissionItem label="Calendar" granted={permissions.calendar} />
                    <PermissionItem label="Contacts" granted={permissions.contacts} />
                    <PermissionItem label="Physical Activity" granted={permissions.activity} />
                </div>

                <div className="space-y-3">
                    <button
                        onClick={openSettings}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-red-600/20 transition-all duration-200 active:scale-[0.98] uppercase tracking-wide text-sm"
                    >
                        Grant Access
                    </button>
                    <button
                        onClick={checkPermissionsAndSecurity}
                        className="text-gray-500 text-xs hover:text-gray-700 underline underline-offset-2"
                    >
                        I have granted them, Check Again
                    </button>
                </div>
            </div>
        </div>
    );
};

const PermissionItem: React.FC<{ label: string; granted: boolean }> = ({ label, granted }) => (
    <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-gray-50 border border-gray-100">
        <span className="font-medium text-gray-700 text-sm">{label}</span>
        {granted ? (
            <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
        ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 tracking-wide uppercase">
                Required
            </span>
        )}
    </div>
);

export default PermissionGuard;
