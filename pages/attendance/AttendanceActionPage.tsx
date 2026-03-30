import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { LogIn, LogOut, Clock, CheckCircle } from 'lucide-react';
import SmartFieldReportModal from '../../components/attendance/SmartFieldReportModal';
import { api } from '../../services/api';


const AttendanceActionPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { toggleCheckInStatus, isCheckedIn, geofencingSettings, fetchGeofencingSettings } = useAuthStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    React.useEffect(() => {
        const init = async () => {
            if (!geofencingSettings) {
                await fetchGeofencingSettings();
            }
            setSettingsLoaded(true);
        };
        init();
    }, [geofencingSettings, fetchGeofencingSettings]);

    // Determine action from URL
    const query = new URLSearchParams(location.search);
    const workType = query.get('workType') as 'office' | 'field' || 'office';
    const isCheckIn = location.pathname.includes('check-in');
    const isBreakIn = location.pathname.includes('break-in');
    const isBreakOut = location.pathname.includes('break-out');
    
    const actionParam = query.get('action');
    
    let action = isCheckIn ? (workType === 'field' ? 'Check In' : 'Punch In') : (workType === 'field' ? 'Check Out' : 'Punch Out');
    if (isBreakIn) action = 'Break In';
    if (isBreakOut) action = 'Break Out';
    if (actionParam === 'site-ot-in') action = 'Site OT In';
    if (actionParam === 'site-ot-out') action = 'Site OT Out';

    const Icon = (isCheckIn || isBreakIn || isBreakOut) ? LogIn : LogOut;
    let iconBgColor = isCheckIn ? 'bg-emerald-100' : 'bg-red-100';
    let iconColor = isCheckIn ? 'text-emerald-600' : 'text-red-600';
    
    if (isBreakIn) {
        iconBgColor = 'bg-blue-100';
        iconColor = 'text-blue-600';
    } else if (isBreakOut) {
        iconBgColor = 'bg-amber-100';
        iconColor = 'text-amber-600';
    } else if (actionParam?.includes('site-ot')) {
        iconBgColor = 'bg-indigo-100';
        iconColor = 'text-indigo-600';
    }

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            // Use cached geofencing settings for immediate response
            const settings = geofencingSettings || { enabled: false };
            
            if (!isCheckIn && !isBreakIn && !isBreakOut && settings.enabled) {
                // If checking out and geofencing is enabled, open the report modal first
                setIsReportModalOpen(true);
                setIsSubmitting(false);
                return;
            }

            // Determine forced type
            let forcedType: string | undefined = undefined;
            if (isCheckIn) forcedType = 'punch-in';
            if (!isCheckIn && !isBreakIn && !isBreakOut) forcedType = 'punch-out';
            if (isBreakIn) forcedType = 'break-in';
            if (isBreakOut) forcedType = 'break-out';
            if (actionParam) forcedType = actionParam;

            // Direct check-in OR direct check-out (if geofencing is disabled)
            const { success, message } = await toggleCheckInStatus(undefined, null, workType, undefined, forcedType);
            setToast({ message, type: success ? 'success' : 'error' });
            
            if (success) {
                setTimeout(() => {
                    navigate('/profile', { replace: true });
                }, 1500);
            }
        } catch (error) {
            console.error('Action error:', error);
            setToast({ message: 'Failed to process request.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReportConfirm = async (reportId: string, summary: string, workType: 'office' | 'field') => {
        setIsReportModalOpen(false);
        setIsSubmitting(true);
        const { success, message } = await toggleCheckInStatus(summary, null, workType, reportId);
        setToast({ message, type: success ? 'success' : 'error' });
        setIsSubmitting(false);

        if (success) {
            setTimeout(() => {
                navigate('/profile', { replace: true });
            }, 1500);
        }
    };

    const handleCancel = () => {
        navigate(-1);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <div className={`w-full max-w-md bg-card rounded-2xl shadow-card p-8 text-center relative z-10 ${isReportModalOpen ? 'hidden' : 'block'}`}>
                <div className="flex justify-center mb-6">
                    <div className={`p-4 rounded-full ${iconBgColor}`}>
                        <Icon className={`h-10 w-10 ${iconColor}`} />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-primary-text mb-2">{action}</h1>
                <p className="text-muted mb-8">
                    Are you sure you want to {action.toLowerCase()}?
                </p>

                <div className="flex flex-col gap-3">
                    <Button
                        onClick={handleConfirm}
                        variant={isCheckIn || isBreakIn || isBreakOut || actionParam === 'site-ot-in' ? "primary" : "danger"}
                        className={`w-full !py-3 !text-lg shadow-lg ${actionParam?.includes('site-ot') ? '!bg-indigo-600 !border-indigo-700 hover:!bg-indigo-700' : ''}`}
                        isLoading={isSubmitting}
                    >
                        Yes, {action}
                    </Button>
                    <Button
                        onClick={handleCancel}
                        variant="secondary"
                        className="w-full !py-3"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                </div>
            </div>

            <SmartFieldReportModal 
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                onConfirm={handleReportConfirm}
                isLoading={isSubmitting}
            />
        </div>
    );
};

export default AttendanceActionPage;
