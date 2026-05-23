import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { LogIn, LogOut, Clock, Coffee, X, CloudOff, Bell, Volume2, MoveLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SmartFieldReportModal from '../../components/attendance/SmartFieldReportModal';
import { lookupByPasscode } from '../../services/gateApi';
import { isDeviceTimeSpoofed } from '../../utils/timeUtils';
import { getCurrentDevice, isDeviceAuthorized, registerDevice } from '../../services/deviceService';
import { DeviceType } from '../../types';
import { useMediaQuery } from '../../hooks/useMediaQuery';

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
    let iconBgColor = isCheckIn ? 'bg-emerald-500/15' : 'bg-rose-500/15';
    let iconColor = isCheckIn ? 'text-emerald-400' : 'text-rose-400';
    if (isBreakIn) { iconBgColor = 'bg-emerald-500/15'; iconColor = 'text-emerald-400'; }
    else if (isBreakOut) { iconBgColor = 'bg-amber-500/15'; iconColor = 'text-amber-400'; }
    else if (actionParam?.includes('site-ot')) { iconBgColor = 'bg-indigo-500/15'; iconColor = 'text-indigo-400'; }

    // Accent color system based on action type
    const accentColor = isBreakIn ? 'emerald' : isBreakOut ? 'amber' : actionParam?.includes('site-ot') ? 'indigo' : isCheckIn ? 'emerald' : 'rose';

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
            const { attendance } = useSettingsStore.getState();
            const currentWorkTypeCategory = workType === 'site-ot' ? 'site' : (workType as 'office' | 'field' | 'site');
            const enableFieldReport = attendance?.[currentWorkTypeCategory]?.enableFieldReport ?? true;
            
            if (!isCheckIn && !isBreakIn && !isBreakOut && !actionParam?.includes('site-ot') && settings.enabled && enableFieldReport) {
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

    const isMobile = useMediaQuery('(max-width: 767px)');

    if (!isMobile) {
        return (
            <div className="p-4 md:p-8 flex-1 flex flex-col space-y-6 bg-slate-50 min-h-screen animate-in fade-in duration-300">
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
                
                {/* ═══ ROW 1: HEADER (SEPARATED OUTSIDE CARD, LIKE DEVICE APPROVALS) ═══ */}
                <div className="w-full flex items-center justify-between pb-2 px-1">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate(-1)}
                            disabled={isSubmitting}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white hover:bg-gray-50 active:scale-95 transition-all border border-gray-200 shadow-sm disabled:opacity-50 text-emerald-600"
                        >
                            <MoveLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 leading-tight">
                                {action}
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">
                                {isBreakIn 
                                    ? "Confirm to start your break timer and register attendance."
                                    : `Confirm your ${action.toLowerCase()} details.`
                                }
                            </p>
                        </div>
                    </div>
                    {isOffline && (
                        <span className="bg-orange-500/10 border border-orange-500/20 text-orange-600 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5">
                            <CloudOff className="w-4 h-4 animate-pulse" /> Offline Mode
                        </span>
                    )}
                </div>

                {isBreakIn ? (
                    <>
                        {/* ═══ ROW 2: CLOCK & SETTINGS (SEPARATED CARD) ═══ */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 w-full">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                {/* Left column: Alarm Dial */}
                                <div className="lg:col-span-5 flex flex-col items-center justify-center lg:border-r lg:border-gray-100 lg:pr-6">
                                    <AlarmDial selectedIndex={selectedIdx} onSelect={handleDialSelect} />
                                </div>

                                {/* Right column: Alarm Stats & Settings */}
                                <div className="lg:col-span-7 space-y-6">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="rounded-2xl p-4 bg-gray-50 border border-gray-100 flex flex-col justify-between text-center">
                                            <div className="flex items-center justify-center gap-1.5 mb-1.5">
                                                <Bell className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                                <span className="text-[9px] font-black text-emerald-600/80 uppercase tracking-widest whitespace-nowrap">Alarm At</span>
                                            </div>
                                            <p className="text-base font-black text-gray-900 tabular-nums whitespace-nowrap">{alarmTime}</p>
                                        </div>
                                        <div className="rounded-2xl p-4 bg-gray-50 border border-gray-100 flex flex-col justify-between text-center">
                                            <div className="flex items-center justify-center gap-1.5 mb-1.5">
                                                <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                                <span className="text-[9px] font-black text-gray-400/80 uppercase tracking-widest whitespace-nowrap">Repeat</span>
                                            </div>
                                            <p className="text-base font-black text-gray-900 whitespace-nowrap">
                                                Every <span className="text-emerald-600 font-black">{PRESETS[selectedIdx].label}m</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Alarm Settings Controls */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 px-1">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Alarm Controls</span>
                                            <div className="flex-1 h-[1px] bg-gray-100" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Set break reminder toggle */}
                                            <div className="flex items-center justify-between rounded-2xl px-4 py-3.5 bg-gray-50 border border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <Bell className={`w-5 h-5 transition-colors ${isAlarmEnabled ? 'text-emerald-600' : 'text-gray-400'}`} />
                                                    <span className={`text-sm font-bold transition-colors ${isAlarmEnabled ? 'text-gray-700' : 'text-gray-400'}`}>Set break reminder</span>
                                                </div>
                                                <button 
                                                    onClick={() => setIsAlarmEnabled(!isAlarmEnabled)}
                                                    className={`w-12 h-7 rounded-full transition-all duration-300 relative p-1 ${isAlarmEnabled ? 'bg-emerald-600 shadow-md' : 'bg-gray-300'}`}
                                                >
                                                    <motion.div 
                                                        animate={{ x: isAlarmEnabled ? 20 : 0 }}
                                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                        className="w-5 h-5 rounded-full bg-white shadow-sm"
                                                    />
                                                </button>
                                            </div>

                                            {/* Snooze Toggle */}
                                            <div className={`flex items-center justify-between rounded-2xl px-4 py-3.5 bg-gray-50 border border-gray-100 transition-all duration-300 ${!isAlarmEnabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                                                <div className="flex items-center gap-3">
                                                    <Bell className={`w-5 h-5 transition-colors ${isSnoozeEnabled ? 'text-emerald-600' : 'text-gray-400'}`} />
                                                    <span className={`text-sm font-bold transition-colors ${isSnoozeEnabled ? 'text-gray-700' : 'text-gray-400'}`}>Snooze (5m)</span>
                                                </div>
                                                <button 
                                                    onClick={() => setIsSnoozeEnabled(!isSnoozeEnabled)}
                                                    disabled={!isAlarmEnabled}
                                                    className={`w-12 h-7 rounded-full transition-all duration-300 relative p-1 ${isSnoozeEnabled ? 'bg-emerald-600 shadow-md' : 'bg-gray-300'}`}
                                                >
                                                    <motion.div 
                                                        animate={{ x: isSnoozeEnabled ? 20 : 0 }}
                                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                        className="w-5 h-5 rounded-full bg-white shadow-sm"
                                                    />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Volume Slider */}
                                        <div className={`rounded-2xl px-5 py-4 bg-gray-50 border border-gray-100 space-y-3 transition-opacity duration-300 ${isAlarmEnabled ? 'opacity-100' : 'opacity-40'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Volume2 className={`w-3.5 h-3.5 transition-colors ${isAlarmEnabled ? 'text-emerald-600' : 'text-gray-400'}`} />
                                                    <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isAlarmEnabled ? 'text-emerald-600/80' : 'text-gray-400'}`}>Alarm sound volume</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-400 italic">Default Tone</span>
                                                    <span className={`text-[10px] font-bold tabular-nums transition-colors ${isAlarmEnabled ? 'text-emerald-600' : 'text-gray-400'}`}>{alarmVolume}%</span>
                                                </div>
                                            </div>
                                            <div className="relative h-8 flex items-center group">
                                                <div className="absolute inset-x-0 h-1 bg-gray-200 rounded-full overflow-hidden pointer-events-none">
                                                    <motion.div 
                                                        initial={false}
                                                        animate={{ width: `${alarmVolume}%` }}
                                                        className={`h-full transition-colors ${isAlarmEnabled ? 'bg-emerald-600' : 'bg-gray-400'}`}
                                                    />
                                                </div>
                                                <motion.div 
                                                    animate={{ left: `calc(${alarmVolume}% - 10px)` }}
                                                    className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 transition-colors pointer-events-none ${isAlarmEnabled ? 'bg-white border-emerald-600' : 'bg-gray-400 border-gray-300'}`}
                                                />
                                                <input 
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={alarmVolume}
                                                    onChange={(e) => setAlarmVolume(parseInt(e.target.value))}
                                                    disabled={!isAlarmEnabled}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                                    style={{ zIndex: 20 }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ═══ ROW 3: ACTION / CONFIRMATION (HORIZONTAL BAR CARD) ═══ */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                                    <Coffee className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg leading-tight uppercase tracking-tight italic">
                                        Confirm {action}
                                    </h3>
                                    <p className="text-gray-500 text-xs mt-0.5">
                                        Click submit to register your break check-in with the configured timer.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <button 
                                    onClick={() => navigate(-1)} 
                                    disabled={isSubmitting}
                                    className="flex-1 sm:flex-none px-5 py-3 text-xs font-bold text-red-600 hover:text-red-700 uppercase tracking-widest transition-colors border border-transparent hover:border-red-50 rounded-xl"
                                >
                                    Cancel Action
                                </button>
                                <Button
                                    onClick={() => handleConfirm()}
                                    variant="primary"
                                    className="flex-1 sm:flex-none !rounded-xl !py-3.5 !px-8 !text-xs font-bold tracking-widest uppercase italic shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-transform"
                                    isLoading={isSubmitting}
                                >
                                    Set Alarm & Break In
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Regular Action layout (Punch In, Punch Out, Site Check-in, etc.) */
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full flex flex-col items-center justify-center min-h-[350px]">
                        <div className="flex flex-col items-center text-center space-y-6 max-w-md mx-auto w-full py-8">
                            <div className="relative">
                                <motion.div 
                                    animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.25, 0.1] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className={`absolute inset-0 rounded-full blur-xl -m-4 ${
                                        accentColor === 'emerald' ? 'bg-emerald-500/30' :
                                        accentColor === 'amber' ? 'bg-amber-500/30' :
                                        accentColor === 'indigo' ? 'bg-indigo-500/30' :
                                        'bg-rose-500/30'
                                    }`}
                                />
                                <div className={`relative p-6 rounded-3xl border ${
                                    accentColor === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                    accentColor === 'amber' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                    accentColor === 'indigo' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                    'bg-rose-50 text-rose-600 border-rose-100'
                                }`}>
                                    <Icon className="h-12 w-12" />
                                </div>
                            </div>

                            <div>
                                <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter italic">
                                    {action}<span className={`${
                                        accentColor === 'emerald' ? 'text-emerald-500' :
                                        accentColor === 'amber' ? 'text-amber-500' :
                                        accentColor === 'indigo' ? 'text-indigo-500' :
                                        'text-rose-500'
                                    }`}>.</span>
                                </h2>
                                <p className="text-gray-500 text-sm mt-2 font-medium">
                                    Are you sure you want to {action.toLowerCase()}?
                                </p>
                            </div>

                            <div className="w-full space-y-3 pt-6">
                                <Button
                                    onClick={() => handleConfirm()}
                                    variant={isCheckIn || isBreakIn || isBreakOut || actionParam === 'site-ot-in' ? "primary" : "danger"}
                                    className={`w-full !rounded-2xl !py-4.5 !text-sm font-black tracking-widest uppercase italic shadow-lg active:scale-[0.98] transition-transform ${
                                        isBreakOut ? '!bg-amber-600 !border-amber-700 shadow-amber-500/20' :
                                        actionParam?.includes('site-ot') ? '!bg-indigo-600 !border-indigo-700 shadow-indigo-500/20' :
                                        (isCheckIn ? '!bg-emerald-600 !border-emerald-700 shadow-emerald-500/20' : '')
                                    }`}
                                    isLoading={isSubmitting}
                                >
                                    Confirm {action}
                                </Button>
                                <button 
                                    onClick={() => navigate(-1)} 
                                    disabled={isSubmitting}
                                    className="w-full py-2.5 text-xs font-black text-red-500 hover:text-red-600 uppercase tracking-widest transition-colors"
                                >
                                    Cancel Action
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <SmartFieldReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} onConfirm={handleReportConfirm} isLoading={isSubmitting} />

                {/* Passcode Modal */}
                <AnimatePresence>
                    {usePasscodeFallback && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                className="w-full max-w-xs rounded-3xl p-8 text-center shadow-2xl border border-gray-100 bg-white"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-black uppercase tracking-tight text-gray-900">Enter Passcode</h3>
                                    <button onClick={() => setUsePasscodeFallback(false)} className="p-2 hover:bg-gray-50 rounded-full transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
                                </div>
                                <p className="text-xs text-gray-500 mb-8 font-medium">Use your 4-digit gate passcode to verify.</p>
                                <input type="password" maxLength={4} value={passcode} onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
                                    className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-emerald-500 focus:bg-white outline-none transition-all mb-8 text-gray-900 placeholder:text-gray-300" placeholder="****" autoFocus />
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
    }

    return (
        <div className="min-h-screen bg-[#041b0f] w-full overflow-x-hidden relative pb-24">
            {/* Ambient Background Glows */}
            <div className="fixed top-[-15%] right-[-15%] w-[60%] h-[60%] bg-emerald-500/8 blur-[150px] rounded-full pointer-events-none" />
            <div className="fixed bottom-[-15%] left-[-15%] w-[60%] h-[60%] bg-emerald-900/15 blur-[150px] rounded-full pointer-events-none" />

            {/* Editorial Watermark Background */}
            <div 
                className="absolute top-32 left-1/2 -translate-x-1/2 opacity-[0.04] text-[120px] font-black text-transparent pointer-events-none select-none uppercase tracking-tighter leading-none z-0 overflow-hidden w-full text-center whitespace-nowrap"
                style={{ WebkitTextStroke: '2px rgba(255,255,255,0.08)' }}
            >
                {action}
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* ═══ PAGE HEADER ═══ */}
            {isOffline && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="sticky top-0 z-30 backdrop-blur-xl bg-[#041b0f]/80 border-b border-white/5"
                >
                    <div className="flex items-center justify-end px-4 py-3 max-w-lg mx-auto">
                        <span className="bg-orange-500/20 border border-orange-500/30 text-orange-400 px-3 py-1 rounded-full text-[9px] font-black flex items-center gap-1.5">
                            <CloudOff className="w-3 h-3" /> OFFLINE
                        </span>
                    </div>
                </motion.div>
            )}

            <div className="relative z-10 px-4 max-w-lg mx-auto">
                {/* ═══ HERO SECTION ═══ */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col items-center text-center pt-8 pb-6"
                >
                    {/* Icon with breathing glow */}
                    <div className="relative mb-6">
                        <motion.div 
                            animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.35, 0.15] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className={`absolute inset-0 w-24 h-24 rounded-full blur-2xl ${
                                accentColor === 'emerald' ? 'bg-emerald-500/40' :
                                accentColor === 'amber' ? 'bg-amber-500/40' :
                                accentColor === 'indigo' ? 'bg-indigo-500/40' :
                                'bg-rose-500/40'
                            }`}
                            style={{ top: '-8px', left: '-8px', width: 'calc(100% + 16px)', height: 'calc(100% + 16px)' }}
                        />
                        <div className={`relative p-6 rounded-3xl ${iconBgColor} border border-white/10 backdrop-blur-sm`}>
                            {isBreakIn ? <Coffee className={`h-10 w-10 ${iconColor}`} /> : <Icon className={`h-10 w-10 ${iconColor}`} />}
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">
                        {action}<span className={`${
                            accentColor === 'emerald' ? 'text-emerald-500' :
                            accentColor === 'amber' ? 'text-amber-500' :
                            accentColor === 'indigo' ? 'text-indigo-500' :
                            'text-rose-500'
                        }`}>.</span>
                    </h1>
                    <p className="text-slate-500 text-xs mt-2 font-medium">
                        Are you sure you want to {action.toLowerCase()}?
                    </p>
                </motion.div>

                {/* ══════ ALARM DIAL SECTION (Break-In Only) ══════ */}
                {isBreakIn && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-6"
                    >
                        {/* ── Dial Section ── */}
                        <section>
                            <div className="flex justify-center mb-2">
                                <AlarmDial selectedIndex={selectedIdx} onSelect={handleDialSelect} />
                            </div>
                        </section>

                        {/* ── Info Cards ── */}
                        <section>
                            <div className="flex items-center gap-3 mb-4 px-1">
                                <h3 className="text-xs font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5 text-emerald-500" /> Schedule
                                </h3>
                                <div className="flex-1 h-[1px] bg-white/5" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {/* Alarm Time Card */}
                                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
                                    <div className="flex items-center gap-1.5 mb-2.5">
                                        <Bell className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-[8px] font-black text-emerald-400/80 uppercase tracking-widest">Alarm</span>
                                    </div>
                                    <p className="text-xl font-black text-white tabular-nums tracking-tight">{alarmTime}</p>
                                </div>
                                {/* Interval Card */}
                                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
                                    <div className="flex items-center gap-1.5 mb-2.5">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[8px] font-black text-slate-400/80 uppercase tracking-widest">Repeat</span>
                                    </div>
                                    <p className="text-xl font-black text-white tracking-tight">
                                        Every <span className="text-emerald-400">{PRESETS[selectedIdx].label}m</span>
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* ── Reminder Settings ── */}
                        <section>
                            <div className="flex items-center gap-3 mb-4 px-1">
                                <h3 className="text-xs font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Bell className="h-3.5 w-3.5 text-emerald-500" /> Reminder
                                </h3>
                                <div className="flex-1 h-[1px] bg-white/5" />
                            </div>

                            {/* Set Alarm Toggle */}
                            <div className="flex items-center justify-between rounded-2xl px-5 py-4 mb-3 bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
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

                            {/* Volume Slider */}
                            <div className={`rounded-2xl px-5 py-4 mb-3 bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm space-y-3 transition-opacity duration-300 ${isAlarmEnabled ? 'opacity-100' : 'opacity-30'}`}>
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
                                <div className="relative h-8 flex items-center group">
                                    <div className="absolute inset-x-0 h-1.5 bg-white/5 rounded-full overflow-hidden pointer-events-none">
                                        <motion.div 
                                            initial={false}
                                            animate={{ width: `${alarmVolume}%` }}
                                            className={`h-full transition-colors ${isAlarmEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                            style={{ boxShadow: isAlarmEnabled ? '0 0 10px rgba(16,185,129,0.3)' : 'none' }}
                                        />
                                    </div>
                                    <motion.div 
                                        animate={{ left: `calc(${alarmVolume}% - 10px)` }}
                                        className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 transition-colors pointer-events-none ${isAlarmEnabled ? 'bg-white border-emerald-500' : 'bg-slate-600 border-slate-700'}`}
                                        style={{ boxShadow: isAlarmEnabled ? '0 0 15px rgba(16,185,129,0.4)' : 'none' }}
                                    />
                                    <input 
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={alarmVolume}
                                        onChange={(e) => setAlarmVolume(parseInt(e.target.value))}
                                        disabled={!isAlarmEnabled}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                        style={{ zIndex: 20 }}
                                    />
                                </div>
                            </div>

                            {/* Snooze Toggle */}
                            <div className={`flex items-center justify-between rounded-2xl px-5 py-4 mb-3 bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm transition-all duration-300 ${!isAlarmEnabled ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
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

                            <p className="text-[9px] text-slate-600 text-center font-medium italic px-4">
                                {isAlarmEnabled 
                                    ? "Rings until acknowledged · Works in background" 
                                    : "Reminders are disabled for this session"}
                            </p>
                        </section>
                    </motion.div>
                )}

                {/* ═══ ACTION BUTTON ═══ */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: isBreakIn ? 0.4 : 0.2 }}
                    className="mt-8 space-y-3"
                >
                    <Button
                        onClick={() => handleConfirm()}
                        variant={isCheckIn || isBreakIn || isBreakOut || actionParam === 'site-ot-in' ? "primary" : "danger"}
                        className={`w-full !rounded-2xl !py-5 !text-sm font-black tracking-widest uppercase italic shadow-2xl active:scale-[0.98] transition-transform ${
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
                        className="w-full py-3 text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest transition-colors">
                        Cancel Action
                    </button>
                </motion.div>
            </div>

            <SmartFieldReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} onConfirm={handleReportConfirm} isLoading={isSubmitting} />

            {/* Passcode Modal */}
            <AnimatePresence>
                {usePasscodeFallback && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full max-w-xs rounded-3xl p-8 text-center shadow-2xl border border-white/10 backdrop-blur-xl"
                            style={{ background: 'linear-gradient(180deg, rgba(6,30,18,0.97) 0%, rgba(3,18,10,0.99) 100%)' }}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-black uppercase tracking-tight text-white">Enter Passcode</h3>
                                <button onClick={() => setUsePasscodeFallback(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                            </div>
                            <p className="text-xs text-slate-500 mb-8 font-medium">Use your 4-digit gate passcode to verify.</p>
                            <input type="password" maxLength={4} value={passcode} onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
                                className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-white/5 border-2 border-white/10 rounded-2xl focus:border-emerald-500 focus:bg-white/10 outline-none transition-all mb-8 text-white placeholder:text-slate-600" placeholder="****" autoFocus />
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
