import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { LogIn, LogOut, Clock, CheckCircle, Coffee, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    const [breakInterval, setBreakInterval] = useState<number>(0.1666);

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
    
    const actionParam = query.get('action') || query.get('forcedType');
    
    let action = isCheckIn ? (workType === 'field' ? 'Site Check In' : 'Punch In') : (workType === 'field' ? 'Site Check Out' : 'Punch Out');
    if (isBreakIn) action = 'Break In';
    if (isBreakOut) action = 'Break Out';
    if (actionParam === 'site-ot-in') action = 'Site OT In';
    if (actionParam === 'site-ot-out') action = 'Site OT Out';

    const Icon = (isCheckIn || isBreakIn || isBreakOut) ? LogIn : LogOut;
    let iconBgColor = isCheckIn ? 'bg-emerald-100' : 'bg-red-100';
    let iconColor = isCheckIn ? 'text-emerald-600' : 'text-red-600';
    
    if (isBreakIn) {
        iconBgColor = 'bg-emerald-100/20';
        iconColor = 'text-emerald-400';
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
            
            if (!isCheckIn && !isBreakIn && !isBreakOut && !actionParam?.includes('site-ot') && settings.enabled) {
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
            const { success, message } = await toggleCheckInStatus(undefined, null, workType, undefined, forcedType, forcedType === 'break-in' ? breakInterval : undefined);
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
        <div className="fixed inset-0 flex flex-col items-center justify-center p-4 z-20">
            {/* Background elements for depth */}
            <div className="fixed inset-0 bg-[#041b0f] z-0" />
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full z-0" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full z-0" />

            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <AnimatePresence mode="wait">
                {!isReportModalOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                        transition={{ type: "spring", damping: 25, stiffness: 350 }}
                        className="w-full max-w-md bg-white/10 backdrop-blur-3xl rounded-[2.5rem] border border-white/20 shadow-2xl p-10 text-center relative z-10"
                    >
                        {/* Decorative top pulse */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />

                        <div className="flex justify-center mb-8">
                            <div className="relative">
                                <motion.div 
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute inset-0 blur-2xl rounded-full bg-emerald-500/40" 
                                />
                                <div className={`relative p-6 rounded-3xl ${iconBgColor} border border-white/10 shadow-inner`}>
                                    {isBreakIn ? (
                                        <Coffee className={`h-12 w-12 ${iconColor} drop-shadow-md`} />
                                    ) : (
                                        <Icon className={`h-12 w-12 ${iconColor} drop-shadow-md`} />
                                    )}
                                </div>
                            </div>
                        </div>

                        <h1 className="text-3xl font-black text-white mb-2 tracking-tight uppercase italic drop-shadow-sm">
                            {action}
                        </h1>
                        <p className="text-slate-300 mb-10 font-medium text-sm">
                            Are you sure you want to {action.toLowerCase()}?
                        </p>

                        {isBreakIn && (
                            <div className="mb-10 p-5 bg-black/30 backdrop-blur-md rounded-3xl border border-emerald-500/20 relative group shadow-lg shadow-emerald-500/5">
                                <label className="text-[10px] font-black text-emerald-400 mb-4 block text-left uppercase tracking-widest opacity-80">
                                    Reminder Interval
                                </label>
                                <div className="grid grid-cols-4 gap-2 relative bg-white/5 p-1.5 rounded-2xl border border-emerald-500/10">
                                    {[0.1666, 1, 15, 30, 45, 60].map((mins) => (
                                        <button
                                            key={mins}
                                            onClick={() => setBreakInterval(mins)}
                                            className="relative py-2.5 px-1 rounded-xl text-xs font-black transition-all z-10 select-none group"
                                        >
                                            <span className={`relative z-20 ${breakInterval === mins ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                                                {mins === 0.1666 ? '10s' : `${mins}m`}
                                            </span>
                                            {breakInterval === mins && (
                                                <motion.div
                                                    layoutId="activeInterval"
                                                    className="absolute inset-0 bg-emerald-600 rounded-lg shadow-lg shadow-emerald-600/30 z-10"
                                                    transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-start gap-2 mt-4">
                                    <Clock className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                                    <p className="text-[10px] text-emerald-300/70 text-left leading-relaxed font-medium">
                                        You will receive a notification every <span className="text-white font-bold underline decoration-emerald-500/50">{breakInterval === 0.1666 ? '10 seconds' : `${breakInterval} minutes`}</span> to acknowledge your break status.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleConfirm}
                                variant={isCheckIn || isBreakIn || isBreakOut || actionParam === 'site-ot-in' ? "primary" : "danger"}
                                className={`w-full !rounded-2xl !py-4 !text-base font-black tracking-widest uppercase italic shadow-2xl transition-all active:scale-[0.98] ${
                                    isBreakIn ? '!bg-emerald-600 !border-emerald-700 hover:!bg-emerald-700 shadow-emerald-900/40' : 
                                    isBreakOut ? '!bg-amber-600 !border-amber-700 shadow-amber-900/40' :
                                    actionParam?.includes('site-ot') ? '!bg-indigo-600 !border-indigo-700 shadow-indigo-900/40' : 
                                    (isCheckIn ? '!bg-emerald-600 !border-emerald-700 shadow-emerald-900/40' : '')
                                }`}
                                isLoading={isSubmitting}
                            >
                                Confirm {action}
                            </Button>
                            <button
                                onClick={handleCancel}
                                disabled={isSubmitting}
                                className="w-full py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors cursor-pointer"
                            >
                                Cancel Action
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
