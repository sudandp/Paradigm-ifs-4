import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { LogIn, LogOut, Clock, Coffee, X, CloudOff, Bell, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SmartFieldReportModal from '../../components/attendance/SmartFieldReportModal';
import { lookupByPasscode } from '../../services/gateApi';
import { isDeviceTimeSpoofed } from '../../utils/timeUtils';
import { getCurrentDevice, isDeviceAuthorized, registerDevice } from '../../services/deviceService';
import { DeviceType } from '../../types';

// ─── Break duration presets (minutes) ────────────────────────────────────────
const PRESETS = [
    { mins: 5,  label: '5',  desc: 'min' },
    { mins: 10, label: '10', desc: 'min' },
    { mins: 15, label: '15', desc: 'min' },
    { mins: 20, label: '20', desc: 'min' },
    { mins: 30, label: '30', desc: 'min' },
    { mins: 45, label: '45', desc: 'min' },
    { mins: 60, label: '60', desc: 'min' },
];

// ─── Circular Dial Component ─────────────────────────────────────────────────
const AlarmDial: React.FC<{
    selectedIndex: number;
    onSelect: (i: number) => void;
}> = ({ selectedIndex, onSelect }) => {
    const size = 240;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 95;
    const dotRadius = 18;
    const total = PRESETS.length;

    // Progress arc
    const progress = (selectedIndex + 1) / total;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - progress);

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="absolute inset-0">
                {/* Background ring */}
                <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(16,185,129,0.08)" strokeWidth="3" />
                {/* Progress arc */}
                <circle
                    cx={cx} cy={cy} r={radius}
                    fill="none"
                    stroke="url(#dialGrad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${cx} ${cy})`}
                    className="transition-all duration-500 ease-out"
                />
                {/* Tick marks */}
                {PRESETS.map((_, i) => {
                    const angle = (i / total) * 360 - 90;
                    const rad = (angle * Math.PI) / 180;
                    const tx = cx + (radius + 16) * Math.cos(rad);
                    const ty = cy + (radius + 16) * Math.sin(rad);
                    const ix = cx + radius * Math.cos(rad);
                    const iy = cy + radius * Math.sin(rad);
                    return (
                        <line key={i} x1={ix} y1={iy} x2={tx} y2={ty}
                            stroke={i <= selectedIndex ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.08)'}
                            strokeWidth="2" strokeLinecap="round"
                        />
                    );
                })}
                {/* Preset dots around the dial */}
                {PRESETS.map((p, i) => {
                    const angle = (i / total) * 360 - 90;
                    const rad = (angle * Math.PI) / 180;
                    const dx = cx + radius * Math.cos(rad);
                    const dy = cy + radius * Math.sin(rad);
                    const isActive = i === selectedIndex;
                    return (
                        <g key={i} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
                            <circle cx={dx} cy={dy} r={isActive ? dotRadius : 14}
                                fill={isActive ? 'rgba(16,185,129,0.9)' : 'rgba(255,255,255,0.06)'}
                                stroke={isActive ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.1)'}
                                strokeWidth={isActive ? 2 : 1}
                                className="transition-all duration-300"
                            />
                            <text x={dx} y={dy + 1} textAnchor="middle" dominantBaseline="middle"
                                fill={isActive ? '#fff' : '#64748b'}
                                fontSize={isActive ? '10' : '8'}
                                fontWeight="900"
                                style={{ pointerEvents: 'none' }}
                            >
                                {p.label}
                            </text>
                        </g>
                    );
                })}
                <defs>
                    <linearGradient id="dialGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#059669" />
                        <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Center display */}
            <div className="relative z-10 flex flex-col items-center">
                <motion.div
                    key={selectedIndex}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                    className="flex items-baseline gap-1"
                >
                    <span className="text-5xl font-black text-white tabular-nums tracking-tight">
                        {PRESETS[selectedIndex].label}
                    </span>
                    <span className="text-lg font-bold text-emerald-400/70">
                        {PRESETS[selectedIndex].desc}
                    </span>
                </motion.div>
                <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest mt-1">
                    Reminder interval
                </p>
            </div>
        </div>
    );
};

const AttendanceActionPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { toggleCheckInStatus, isCheckedIn, geofencingSettings, fetchGeofencingSettings, isOffline } = useAuthStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [breakInterval, setBreakInterval] = useState<number>(() => useAuthStore.getState().breakReminderInterval || 15);
    const [selectedIdx, setSelectedIdx] = useState(() => {
        const stored = useAuthStore.getState().breakReminderInterval || 15;
        const idx = PRESETS.findIndex(p => p.mins === stored);
        return idx >= 0 ? idx : 2;
    });
    
    const [isAlarmEnabled, setIsAlarmEnabled] = useState(true);
    const [alarmVolume, setAlarmVolume] = useState(70);
    const [isSnoozeEnabled, setIsSnoozeEnabled] = useState(false);
    const [usePasscodeFallback, setUsePasscodeFallback] = useState(false);
    const [passcode, setPasscode] = useState('');
    const [isVerifyingPasscode, setIsVerifyingPasscode] = useState(false);
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        const init = async () => {
            if (!geofencingSettings) await fetchGeofencingSettings();
            try {
                const { getPrecisePosition } = await import('../../utils/locationUtils');
                getPrecisePosition(150, 15000).catch(() => {});
            } catch (_) {}
        };
        init();
    }, [geofencingSettings, fetchGeofencingSettings]);

    const query = new URLSearchParams(location.search);
    const workType = query.get('workType') as 'office' | 'field' | 'site-ot' || 'office';
    const isCheckIn = location.pathname.includes('check-in');
    const isBreakIn = location.pathname.includes('break-in');
    const isBreakOut = location.pathname.includes('break-out');
    const actionParam = query.get('action') || query.get('forcedType');
    
    let action = isCheckIn ? (workType === 'field' ? 'Site Check In' : (workType === 'site-ot' ? 'Site OT In' : 'Punch In')) : (workType === 'field' ? 'Site Check Out' : (workType === 'site-ot' ? 'Site OT Out' : 'Punch Out'));
    if (isBreakIn) action = 'Break In';
    if (isBreakOut) action = 'Break Out';
    if (actionParam === 'site-ot-in') action = 'Site OT In';
    if (actionParam === 'site-ot-out') action = 'Site OT Out';

    const Icon = (isCheckIn || isBreakIn || isBreakOut) ? LogIn : LogOut;
    let iconBgColor = isCheckIn ? 'bg-emerald-100' : 'bg-red-100';
    let iconColor = isCheckIn ? 'text-emerald-600' : 'text-red-600';
    if (isBreakIn) { iconBgColor = 'bg-emerald-100/20'; iconColor = 'text-emerald-400'; }
    else if (isBreakOut) { iconBgColor = 'bg-amber-100'; iconColor = 'text-amber-600'; }
    else if (actionParam?.includes('site-ot')) { iconBgColor = 'bg-indigo-100'; iconColor = 'text-indigo-600'; }

    const requiresVerification = false;

    const alarmTime = useMemo(() => {
        const now = new Date();
        const preset = PRESETS[selectedIdx];
        return new Date(now.getTime() + preset.mins * 60 * 1000)
            .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }, [selectedIdx]);

    const handleDialSelect = (i: number) => {
        setSelectedIdx(i);
        setBreakInterval(PRESETS[i].mins);
    };

    const handleConfirm = async (isAutoConfirm = false) => {
        setIsSubmitting(true);
        try {
            const user = useAuthStore.getState().user;
            if (!user) { setToast({ message: 'User session invalid.', type: 'error' }); setIsSubmitting(false); return; }

            const { spoofed } = await isDeviceTimeSpoofed();
            if (spoofed) { setToast({ message: 'Time mismatch! Please enable Automatic Time.', type: 'error' }); setIsSubmitting(false); return; }

            const { deviceIdentifier, deviceType, deviceName, deviceInfo } = await getCurrentDevice();
            const deviceCheck = await isDeviceAuthorized(user.id, deviceIdentifier);
            if (!deviceCheck.authorized) {
                const result = await registerDevice(user.id, user.role, deviceIdentifier, deviceType as DeviceType, deviceName, deviceInfo);
                if (!result.success) { setToast({ message: `Device Unauthorized: ${result.message}`, type: 'error' }); setIsSubmitting(false); return; }
            }

            if (requiresVerification && !isVerified && !isAutoConfirm) { setUsePasscodeFallback(true); setIsSubmitting(false); return; }
            const settings = geofencingSettings || { enabled: false };
            if (!isCheckIn && !isBreakIn && !isBreakOut && !actionParam?.includes('site-ot') && settings.enabled && workType === 'field') {
                setIsReportModalOpen(true); setIsSubmitting(false); return;
            }

            let forcedType: string | undefined;
            if (isCheckIn) forcedType = workType === 'site-ot' ? 'site-ot-in' : 'punch-in';
            if (!isCheckIn && !isBreakIn && !isBreakOut) forcedType = workType === 'site-ot' ? 'site-ot-out' : 'punch-out';
            if (isBreakIn) forcedType = 'break-in';
            if (isBreakOut) forcedType = 'break-out';
            if (actionParam) forcedType = actionParam;

            const normalizedWorkType = workType === 'site-ot' ? 'field' : (workType as 'office' | 'field');
            
            // If break-in and alarm disabled, pass a flag or handle accordingly
            // For now, toggleCheckInStatus handles scheduling. If disabled, we might want to skip it.
            // But usually users want the record regardless of the local alarm.
            const { success, message } = await toggleCheckInStatus(
                undefined, 
                null, 
                normalizedWorkType, 
                undefined, 
                forcedType, 
                (forcedType === 'break-in' && isAlarmEnabled) ? breakInterval : undefined
            );

            setToast({ message, type: success ? 'success' : 'error' });
            if (success) setTimeout(() => navigate('/profile', { replace: true }), 600);
        } catch (error) {
            setToast({ message: 'Failed to process request.', type: 'error' });
        } finally { setIsSubmitting(false); }
    };

    const handlePasscodeSubmit = async () => {
        if (passcode.length < 4) return;
        setIsVerifyingPasscode(true);
        try {
            const user = await lookupByPasscode(passcode);
            if (user && user.userId === useAuthStore.getState().user?.id) {
                setToast({ message: 'Passcode verified!', type: 'success' });
                setIsVerified(true); setUsePasscodeFallback(false);
                setTimeout(() => handleConfirm(true), 500);
            } else { setToast({ message: 'Invalid passcode for this user.', type: 'error' }); }
        } catch (_) { setToast({ message: 'Error verifying passcode.', type: 'error' }); }
        finally { setIsVerifyingPasscode(false); }
    };

    const handleReportConfirm = async (reportId: string, summary: string, wt: 'office' | 'field') => {
        setIsReportModalOpen(false); setIsSubmitting(true);
        const { success, message } = await toggleCheckInStatus(summary, null, wt, reportId);
        setToast({ message, type: success ? 'success' : 'error' }); setIsSubmitting(false);
        if (success) setTimeout(() => navigate('/profile', { replace: true }), 600);
    };

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center p-4 z-20">
            <div className="fixed inset-0 bg-[#041b0f] z-0" />
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full z-0" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/20 blur-[120px] rounded-full z-0" />

            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <AnimatePresence mode="wait">
                {!isReportModalOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 350 }}
                        className="w-full max-w-md max-h-[92vh] rounded-[2.5rem] border border-white/10 shadow-2xl relative z-10 flex flex-col overflow-hidden"
                        style={{ background: 'linear-gradient(180deg, rgba(6,30,18,0.97) 0%, rgba(3,18,10,0.99) 100%)' }}
                    >
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/15 rounded-full z-20" />

                        <div className="flex-1 overflow-y-auto scrollbar-hide py-4">
                            {/* Top section: Icon + Title */}
                            <div className="pt-6 pb-4 text-center">
                                <div className="flex justify-center mb-4">
                                    <div className="relative">
                                        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 3, repeat: Infinity }}
                                            className="absolute inset-0 blur-2xl rounded-full bg-emerald-500/30" />
                                        <div className={`relative p-5 rounded-2xl ${iconBgColor} border border-emerald-500/20`}>
                                            {isBreakIn ? <Coffee className={`h-8 w-8 ${iconColor}`} /> : <Icon className={`h-8 w-8 ${iconColor}`} />}
                                        </div>
                                    </div>
                                </div>
                                <h1 className="text-2xl font-black text-white tracking-tight uppercase italic flex items-center justify-center gap-2">
                                    {action}
                                    {isOffline && (
                                        <span className="bg-orange-500/20 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full text-[9px] font-black not-italic flex items-center gap-1">
                                            <CloudOff className="w-2.5 h-2.5" /> OFFLINE
                                        </span>
                                    )}
                                </h1>
                                <p className="text-slate-400 text-xs mt-1">Are you sure you want to {action.toLowerCase()}?</p>
                            </div>

                            {/* ══════ ALARM DIAL SECTION (Break-In Only) ══════ */}
                            {isBreakIn && (
                                <div className="px-6 pb-2">
                                    {/* Circular Dial */}
                                    <div className="flex justify-center mb-4">
                                        <AlarmDial selectedIndex={selectedIdx} onSelect={handleDialSelect} />
                                    </div>

                                    {/* Alarm Info Cards */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {/* Alarm Time Card */}
                                        <div className="rounded-2xl p-3.5"
                                            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <Bell className="w-3 h-3 text-emerald-400" />
                                                <span className="text-[8px] font-black text-emerald-400/80 uppercase tracking-widest">Alarm</span>
                                            </div>
                                            <p className="text-lg font-black text-white tabular-nums">{alarmTime}</p>
                                        </div>
                                        {/* Interval Card */}
                                        <div className="rounded-2xl p-3.5"
                                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Repeat</span>
                                            </div>
                                            <p className="text-lg font-black text-white">
                                                Every <span className="text-emerald-400">{PRESETS[selectedIdx].label}{PRESETS[selectedIdx].mins >= 1 ? 'm' : ''}</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Set Alarm Toggle Row */}
                                    <div className="flex items-center justify-between rounded-2xl px-5 py-4 mb-4 transition-all"
                                        style={{ 
                                            background: isAlarmEnabled ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', 
                                            border: isAlarmEnabled ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.06)' 
                                        }}>
                                        <div className="flex items-center gap-3">
                                            <Bell className={`w-5 h-5 transition-colors ${isAlarmEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                                            <span className={`text-sm font-bold transition-colors ${isAlarmEnabled ? 'text-slate-200' : 'text-slate-500'}`}>Set break reminder</span>
                                        </div>
                                        <button 
                                            onClick={() => setIsAlarmEnabled(!isAlarmEnabled)}
                                            className={`w-12 h-7 rounded-full transition-all duration-300 relative p-1 ${isAlarmEnabled ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-700'}`}
                                        >
                                            <motion.div 
                                                animate={{ x: isAlarmEnabled ? 20 : 0 }}
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                className="w-5 h-5 rounded-full bg-white shadow-lg"
                                            />
                                        </button>
                                    </div>

                                    {/* Volume Slider Row (Matching Reference) */}
                                    <div className={`space-y-3 mb-5 px-1 transition-opacity duration-300 ${isAlarmEnabled ? 'opacity-100' : 'opacity-30'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Volume2 className={`w-3.5 h-3.5 transition-colors ${isAlarmEnabled ? 'text-emerald-400' : 'text-slate-600'}`} />
                                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isAlarmEnabled ? 'text-emerald-400/80' : 'text-slate-600'}`}>Alarm sound</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-500 italic">Default Tone</span>
                                                <span className={`text-[10px] font-bold tabular-nums transition-colors ${isAlarmEnabled ? 'text-emerald-400' : 'text-slate-600'}`}>{alarmVolume}%</span>
                                            </div>
                                        </div>
                                        <div className="relative h-6 flex items-center group">
                                            <div className="absolute inset-x-0 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div 
                                                    initial={false}
                                                    animate={{ width: `${alarmVolume}%` }}
                                                    className={`h-full transition-colors ${isAlarmEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                                    style={{ boxShadow: isAlarmEnabled ? '0 0 10px rgba(16,185,129,0.3)' : 'none' }}
                                                />
                                            </div>
                                            <input 
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={alarmVolume}
                                                onChange={(e) => setAlarmVolume(parseInt(e.target.value))}
                                                disabled={!isAlarmEnabled}
                                                className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                                            />
                                            {/* Custom Thumb */}
                                            <motion.div 
                                                animate={{ left: `calc(${alarmVolume}% - 10px)` }}
                                                className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 transition-colors z-0 pointer-events-none ${isAlarmEnabled ? 'bg-white border-emerald-500' : 'bg-slate-600 border-slate-700'}`}
                                                style={{ boxShadow: isAlarmEnabled ? '0 0 15px rgba(16,185,129,0.4)' : 'none' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Snooze Toggle Row */}
                                    <div className={`flex items-center justify-between rounded-2xl px-5 py-4 mb-6 transition-all duration-300 ${!isAlarmEnabled ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}
                                        style={{ 
                                            background: isSnoozeEnabled ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', 
                                            border: isSnoozeEnabled ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.06)' 
                                        }}>
                                        <div className="flex items-center gap-3">
                                            <motion.div animate={isSnoozeEnabled && isAlarmEnabled ? { rotate: [0, -10, 10, -10, 10, 0] } : {}} transition={{ duration: 0.5, repeat: isSnoozeEnabled ? Infinity : 0, repeatDelay: 2 }}>
                                                <Bell className={`w-5 h-5 transition-colors ${isSnoozeEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                                            </motion.div>
                                            <span className={`text-sm font-bold transition-colors ${isSnoozeEnabled ? 'text-slate-200' : 'text-slate-500'}`}>Snooze (5m)</span>
                                        </div>
                                        <button 
                                            onClick={() => setIsSnoozeEnabled(!isSnoozeEnabled)}
                                            disabled={!isAlarmEnabled}
                                            className={`w-12 h-7 rounded-full transition-all duration-300 relative p-1 ${isSnoozeEnabled ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-700'}`}
                                        >
                                            <motion.div 
                                                animate={{ x: isSnoozeEnabled ? 20 : 0 }}
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                className="w-5 h-5 rounded-full bg-white shadow-lg"
                                            />
                                        </button>
                                    </div>

                                    <p className="text-[8px] text-slate-600 text-center mb-4 font-medium italic">
                                        {isAlarmEnabled 
                                            ? "Rings until acknowledged · Works in background" 
                                            : "Reminders are disabled for this session"}
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="px-6 pb-6 flex flex-col gap-3">
                                <Button
                                    onClick={() => handleConfirm()}
                                    variant={isCheckIn || isBreakIn || isBreakOut || actionParam === 'site-ot-in' ? "primary" : "danger"}
                                    className={`w-full !rounded-2xl !py-4 !text-sm font-black tracking-widest uppercase italic shadow-2xl active:scale-[0.98] ${
                                        isBreakIn ? '!bg-emerald-600 !border-emerald-700 hover:!bg-emerald-700 shadow-emerald-900/40' :
                                        isBreakOut ? '!bg-amber-600 !border-amber-700 shadow-amber-900/40' :
                                        actionParam?.includes('site-ot') ? '!bg-indigo-600 !border-indigo-700 shadow-indigo-900/40' :
                                        (isCheckIn ? '!bg-emerald-600 !border-emerald-700 shadow-emerald-900/40' : '')
                                    }`}
                                    isLoading={isSubmitting}
                                >
                                    {isBreakIn ? 'Set Alarm & Break In' : `Confirm ${action}`}
                                </Button>
                                <button onClick={() => navigate(-1)} disabled={isSubmitting}
                                    className="w-full py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">
                                    Cancel Action
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <SmartFieldReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} onConfirm={handleReportConfirm} isLoading={isSubmitting} />

            {/* Passcode Modal */}
            <AnimatePresence>
                {usePasscodeFallback && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full max-w-xs bg-white rounded-3xl p-8 text-center shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-black uppercase tracking-tight text-gray-900">Enter Passcode</h3>
                                <button onClick={() => setUsePasscodeFallback(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-400" /></button>
                            </div>
                            <p className="text-xs text-gray-500 mb-8 font-medium">Use your 4-digit gate passcode to verify.</p>
                            <input type="password" maxLength={4} value={passcode} onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
                                className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-emerald-500 focus:bg-white outline-none transition-all mb-8" placeholder="****" autoFocus />
                            <Button onClick={handlePasscodeSubmit} isLoading={isVerifyingPasscode} disabled={passcode.length < 4}
                                className="w-full !rounded-2xl !py-4 font-black uppercase tracking-widest italic !bg-emerald-600 !border-emerald-700">
                                Verify Passcode
                            </Button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AttendanceActionPage;
