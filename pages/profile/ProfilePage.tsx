import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { User, UploadedFile, EmployeeScore, UserChild } from '../../types';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { api } from '../../services/api';
import { dispatchNotificationFromRules } from '../../services/notificationService';
import { User as UserIcon, Loader2, ClipboardList, LogOut, LogIn, Crosshair, CheckCircle, Info, MapPin, AlertTriangle, Clock, Lock, Edit, Camera, Mail, Baby, PlusCircle, Trash2, FileCheck, FileX, Zap, Volume2, Coffee } from 'lucide-react';
import { AvatarUpload } from '../../components/onboarding/AvatarUpload';
import AlertTonePicker from '../../components/attendance/AlertTonePicker';
import { format } from 'date-fns';
import Modal from '../../components/ui/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

import { useMediaQuery } from '../../hooks/useMediaQuery';
import { isAdmin } from '../../utils/auth';
import { calculateEmployeeScores, getEmployeeScore } from '../../services/employeeScoring';
import LoadingScreen from '../../components/ui/LoadingScreen';


// --- Profile Section ---
const profileValidationSchema = yup.object({
    name: yup.string().required('Name is required'),
    email: yup.string().email('Must be a valid email').required('Email is required'),
    phone: yup.string().matches(/^[6-9][0-9]{9}$/, 'Must be a valid 10-digit Indian mobile number').optional().nullable(),
    gender: yup.string().oneOf(['Male', 'Female', 'Other', '']).optional().nullable(),
}).defined();

type ProfileFormData = Pick<User, 'name' | 'email' | 'phone' | 'gender'>;


// --- Main Component ---
const ProfilePage: React.FC = () => {
    const { 
        user, 
        updateUserProfile, 
        isCheckedIn, 
        isOnBreak,
        isAttendanceLoading, 
        toggleCheckInStatus, 
        logout, 
        lastCheckInTime, 
        lastCheckOutTime,
        firstBreakInTime,
        lastBreakInTime,
        lastBreakOutTime,
        totalBreakDurationToday,
        totalWorkingDurationToday,
        checkAttendanceStatus,
        dailyPunchCount,
        isFieldCheckedIn,
        isFieldCheckedOut,
        isSiteOtCheckedIn,
        breakIntervals
    } = useAuthStore();
    const { permissions } = usePermissionsStore();
    const navigate = useNavigate();

    // Haptic feedback helper
    const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Medium) => {
        try {
            await Haptics.impact({ style });
        } catch (e) {
            // Silently fail if not on native
        }
    };

    const [isSaving, setIsSaving] = useState(false);
    const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
    
    // Interactive Hints State
    const [showPunchHint, setShowPunchHint] = useState(false);
    const [showBreakHint, setShowBreakHint] = useState(false);
    
    // Unlock Request State
    const [unlockRequestStatus, setUnlockRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');

    // Employee Scores State
    const [employeeScores, setEmployeeScores] = useState<EmployeeScore | null>(null);
    const [isScoresLoading, setIsScoresLoading] = useState(true);

    // Children State (for female employees)
    const [children, setChildren] = useState<UserChild[]>([]);
    const [isChildrenLoading, setIsChildrenLoading] = useState(false);
    const [newChildName, setNewChildName] = useState('');
    const [newChildDob, setNewChildDob] = useState('');
    const [newChildCert, setNewChildCert] = useState<string | null>(null);

    // Punch Restriction: 1 punch-in per day, unlimited unlock requests (1st=duty, 2nd+=OT)
    const hasPunchedToday = (dailyPunchCount || 0) >= 1;
    const isPunchUnlocked = useAuthStore(s => s.isPunchUnlocked);
    const dailyUnlockRequestCount = useAuthStore(s => s.dailyUnlockRequestCount);
    const approvedUnlockCount = useAuthStore(s => s.approvedUnlockCount);
    
    // Blocked if: Punched Today AND Not Currently Checked In (office or field) AND Not Unlocked
    const isPunchBlocked = hasPunchedToday && !isCheckedIn && !isFieldCheckedIn && !isPunchUnlocked;
    // Combined check-in state: true if user is checked in via either office or field
    const effectivelyCheckedIn = isCheckedIn || isFieldCheckedIn;
    // Is the next unlock request for OT? (1st request = duty, 2nd+ = OT)
    const isNextRequestOT = dailyUnlockRequestCount >= 1;

    const punchHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const breakHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Role Categorization from Settings
    const { attendance: settingsAttendance } = useSettingsStore();
    const roleMapping = settingsAttendance.missedCheckoutConfig?.roleMapping || {
        office: ['admin', 'hr', 'finance', 'developer'],
        field: ['field_staff', 'field_officer', 'technical_reliever'],
        site: [
            'site_manager', 'security_guard', 'supervisor', 'technician', 'plumber', 'multitech', 'hvac_technician', 'plumber_carpenter',
            'afm_-_soft', 'associate_facility_manager', 'afm_-_technical', 'asst_facility_manager_operations', 'asst_facility_manager', 'asst_manager_civil_engineer'
        ]
    };
    
    const isSiteStaffRole = (roleMapping.site || []).includes(user?.role || '') || user?.role === 'technical_reliever';
    const isFieldStaffRole = (roleMapping.field || []).includes(user?.role || '');
    const isOfficeStaffRole = (roleMapping.office || []).includes(user?.role || '');

    // Check for existing unlock request
    // Check for existing unlock request on mount/update
    useEffect(() => {
        if (hasPunchedToday && !isPunchUnlocked) {
            api.getMyUnlockRequest().then(req => {
                if (req) {
                    setUnlockRequestStatus(req.status);
                    // Sync store if approved
                    if (req.status === 'approved') {
                        checkAttendanceStatus();
                    }
                }
            });
        }
    }, [hasPunchedToday, isPunchUnlocked, checkAttendanceStatus]);

    // Poll for status update if pending (Real-time update)
    useEffect(() => {
        if (unlockRequestStatus === 'pending') {
            const interval = setInterval(() => {
                 api.getMyUnlockRequest().then(req => {
                    if (req) {
                        setUnlockRequestStatus(req.status);
                        if (req.status === 'approved') {
                            checkAttendanceStatus();
                        }
                    }
                });
            }, 5000); // Check every 5 seconds for faster feedback
            return () => clearInterval(interval);
        }
    }, [unlockRequestStatus, checkAttendanceStatus]);

    // Show warning toast for blocked punch
    useEffect(() => {
        if (isPunchBlocked && unlockRequestStatus !== 'pending') {
            setToast({ 
                message: isNextRequestOT
                    ? 'Request manager approval for overtime (OT) punch.'
                    : 'One punch-in allowed per day. Request approval for emergency punch.', 
                type: 'warning' 
            });
        }
    }, [isPunchBlocked, unlockRequestStatus, isNextRequestOT]);

    // Fetch or calculate employee scores on mount
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        const loadScores = async () => {
            setIsScoresLoading(true);
            try {
                // Always calculate fresh scores from live data
                const scores = await calculateEmployeeScores(user.id, user.role || 'office');
                if (!cancelled) setEmployeeScores(scores);
            } catch (err) {
                console.error('Failed to load employee scores:', err);
            } finally {
                if (!cancelled) setIsScoresLoading(false);
            }
        };
        loadScores();
        return () => { cancelled = true; };
    }, [user?.id, user?.role]);

    // Fetch children when gender is Female
    useEffect(() => {
        if (!user || user.gender !== 'Female') return;
        setIsChildrenLoading(true);
        api.getUserChildren(user.id)
            .then(data => setChildren(data))
            .catch(err => console.error('Failed to load children:', err))
            .finally(() => setIsChildrenLoading(false));
    }, [user?.id, user?.gender]);

    const isMobile = useMediaQuery('(max-width: 767px)');
    const isMobileView = isMobile; // Apply mobile view for all users on mobile

    useEffect(() => {
        const checkPermissions = async () => {
            if (!navigator.permissions?.query) {
                setPermissionStatus('prompt');
                return;
            }
            try {
                const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
                const locationStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });

                if (cameraStatus.state === 'granted' && locationStatus.state === 'granted') {
                    setPermissionStatus('granted');
                } else if (cameraStatus.state === 'denied' || locationStatus.state === 'denied') {
                    setPermissionStatus('denied');
                } else {
                    setPermissionStatus('prompt');
                }

                const updateStatus = () => checkPermissions();
                cameraStatus.onchange = updateStatus;
                locationStatus.onchange = updateStatus;

            } catch (e) {
                console.warn("Permissions API not fully supported. Defaulting to 'prompt'.", e);
                setPermissionStatus('prompt');
            }
        };

        checkPermissions();
    }, []);

    const requestPermissions = async () => {
        let cameraOk = false;
        let locationOk = false;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            cameraOk = true;
        } catch (err) {
            console.error("Camera permission denied:", err);
        }

        try {
            await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            locationOk = true;
        } catch (err) {
            console.error("Location permission denied:", err);
        }

        if (cameraOk && locationOk) {
            setPermissionStatus('granted');
            // Only show toast if we were not already granted
            if (permissionStatus !== 'granted') {
                setToast({ message: 'Camera and Location permissions granted!', type: 'success' });
            }
        } else {
            setPermissionStatus('denied');
            let message = 'Permissions were not fully granted. ';
            if (!cameraOk) message += 'Camera access is needed. ';
            if (!locationOk) message += 'Location access is needed.';
            setToast({ message, type: 'error' });
        }
    };

    // Profile form
    const { register, handleSubmit: handleProfileSubmit, formState: { errors: profileErrors, isDirty }, getValues, trigger, reset } = useForm<ProfileFormData>({
        resolver: yupResolver(profileValidationSchema) as Resolver<ProfileFormData>,
        defaultValues: { name: user?.name || '', email: user?.email || '', phone: user?.phone || '', gender: user?.gender || '' },
    });

    // Effect to keep form synchronized with global user state
    useEffect(() => {
        if (user) {
            reset({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                gender: user.gender || ''
            });
        }
    }, [user, reset]);

    const handlePhotoChange = async (file: UploadedFile | null) => {
        if (!user) return;
        const originalPhotoUrl = user.photoUrl;

        // Optimistically update UI
        updateUserProfile({ photoUrl: file?.preview });

        try {
            let dataUrlForApi: string | null = null;
            if (file && file.file) {
                // Convert file to data URL for the API
                dataUrlForApi = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file.file);
                });
            }

            // Call API which handles upload to Supabase Storage and DB update
            const updatedUser = await api.updateUser(user.id, { photoUrl: dataUrlForApi });

            // Final update with permanent Supabase URL
            updateUserProfile(updatedUser);
            setToast({ message: `Profile photo ${dataUrlForApi ? 'updated' : 'removed'}.`, type: 'success' });
        } catch (e) {
            console.error(e);
            setToast({ message: 'Failed to save photo.', type: 'error' });
            updateUserProfile({ photoUrl: originalPhotoUrl }); // Revert on failure
        }
    };

    const onProfileSubmit: SubmitHandler<ProfileFormData> = async (formData) => {
        if (!user) return;
        setIsSaving(true);
        try {
            const updatedUser = await api.updateUser(user.id, formData);
            updateUserProfile(updatedUser);
            // Reset the form with the new data to clear the 'dirty' state
            reset(formData);
            setToast({ message: 'Profile updated successfully!', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to update profile.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };
    
    // Passcode management
    const [isSavingPasscode, setIsSavingPasscode] = useState(false);
    const passcodeValidationSchema = yup.object({
        oldPasscode: yup.string().required('Current passcode is required'),
        newPasscode: yup.string()
            .matches(/^\d{4}$/, 'Passcode must be exactly 4 digits')
            .required('New passcode is required'),
        confirmPasscode: yup.string()
            .oneOf([yup.ref('newPasscode')], 'Passcodes must match')
            .required('Please confirm your new passcode'),
    });
    type PasscodeFormData = { oldPasscode: string; newPasscode: string; confirmPasscode: string };
    const { register: registerPasscode, handleSubmit: handlePasscodeSubmit, formState: { errors: passcodeErrors, isDirty: isPasscodeDirty }, reset: resetPasscode } = useForm<PasscodeFormData>({
        resolver: yupResolver(passcodeValidationSchema) as Resolver<PasscodeFormData>,
        defaultValues: { oldPasscode: '', newPasscode: '', confirmPasscode: '' }
    });

    const onPasscodeSubmit: SubmitHandler<PasscodeFormData> = async (formData) => {
        if (!user) return;
        
        setIsSavingPasscode(true);
        try {
            // Security check: Fetch the LATEST passcode from the database 
            // to avoid "Incorrect Passcode" errors due to stale local session data (e.g. after admin reset)
            const latestPasscode = await api.getUserPasscode(user.id);
            
            // If no passcode is set in the DB, fallback to system default '5687'
            const effectiveCurrentPasscode = latestPasscode || '5687';
            
            if (effectiveCurrentPasscode !== formData.oldPasscode) {
                setToast({ message: 'Current passcode is incorrect.', type: 'error' });
                setIsSavingPasscode(false);
                return;
            }

            await api.updateUserPasscode(user.id, formData.newPasscode);
            updateUserProfile({ passcode: formData.newPasscode });
            resetPasscode({ oldPasscode: '', newPasscode: '', confirmPasscode: '' });
            setToast({ message: 'Passcode updated successfully!', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.message || 'Failed to update passcode.', type: 'error' });
        } finally {
            setIsSavingPasscode(false);
        }
    };

    const handleAttendanceAction = async () => {
        setIsSubmittingAttendance(true);
        const { success, message } = await toggleCheckInStatus();
        setToast({ message, type: success ? 'success' : 'error' });
        setIsSubmittingAttendance(false);
    };

    const isActionInProgress = isSubmittingAttendance;

    const handleLogoutClick = () => {
        window.location.hash = '#/auth/logout';
    };

    const handleAddChild = async () => {
        if (!user || !newChildName.trim() || !newChildDob) {
            setToast({ message: 'Please enter child name and date of birth.', type: 'error' });
            return;
        }
        if (children.length >= 2) {
            setToast({ message: 'Maximum 2 children allowed.', type: 'error' });
            return;
        }
        try {
            const child = await api.addChild(user.id, {
                childName: newChildName.trim(),
                dateOfBirth: newChildDob,
                birthCertificateDataUrl: newChildCert
            });
            setChildren(prev => [...prev, child]);
            setNewChildName('');
            setNewChildDob('');
            setNewChildCert(null);
            setToast({ message: 'Child added successfully! Birth certificate sent for verification.', type: 'success' });
        } catch (e) {
            setToast({ message: 'Failed to add child.', type: 'error' });
        }
    };

    const handleDeleteChild = async (childId: string) => {
        if (!window.confirm('Are you sure you want to remove this child?')) return;
        try {
            await api.deleteChild(childId);
            setChildren(prev => prev.filter(c => c.id !== childId));
            setToast({ message: 'Child removed.', type: 'success' });
        } catch (e) {
            setToast({ message: 'Failed to remove child.', type: 'error' });
        }
    };

    const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setNewChildCert(reader.result as string);
        reader.readAsDataURL(file);
    };

    const formatTime = (isoString: string | null) => {
        if (!isoString) return '--:--';
        return format(new Date(isoString), 'hh:mm a');
    };

    const handleToggleHint = (type: 'punch' | 'break') => {
        if (type === 'punch') {
            if (punchHintTimeoutRef.current) clearTimeout(punchHintTimeoutRef.current);
            setShowPunchHint(true);
            punchHintTimeoutRef.current = setTimeout(() => setShowPunchHint(false), 10000);
        } else {
            if (breakHintTimeoutRef.current) clearTimeout(breakHintTimeoutRef.current);
            setShowBreakHint(true);
            breakHintTimeoutRef.current = setTimeout(() => setShowBreakHint(false), 10000);
        }
    };

    const canManageTasks = user && (isAdmin(user.role) || permissions[user.role]?.includes('manage_tasks'));
    const tasksLink = canManageTasks ? '/tasks' : '/onboarding/tasks';
    const getRoleName = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    if (!user) return <div>Loading user profile...</div>;

    const avatarFile: UploadedFile | null = user.photoUrl
        ? { preview: user.photoUrl, name: 'Profile Photo', type: 'image/jpeg', size: 0 }
        : null;

    if (isMobileView) {
        return (
            <div className="p-4 space-y-8 md:bg-transparent bg-[#041b0f] min-h-screen overflow-x-hidden relative">
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

                {/* Editorial Watermark Background (Role Title) */}
                <div 
                    className="absolute top-24 left-1/2 -translate-x-1/2 opacity-[0.08] text-[110px] font-black text-transparent pointer-events-none select-none uppercase tracking-tighter leading-none z-0 overflow-hidden w-full text-center whitespace-nowrap"
                    style={{ WebkitTextStroke: '2px rgba(255,255,255,0.1)' }}
                >
                    {user.role.replace(/_/g, ' ')}
                </div>

                {/* Premium Header Section */}
                <div className="flex flex-col items-center text-center gap-6 relative z-10 pt-6">
                    <div className="relative flex items-center justify-center">
                        {/* Breathing Status Ring */}
                        <motion.div 
                            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className={`absolute w-40 h-40 rounded-full blur-2xl ${effectivelyCheckedIn ? 'bg-emerald-500/50' : 'bg-rose-500/30'}`}
                        />
                        <div className="relative z-10 w-40 h-40 flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                                <motion.circle
                                    cx="50%"
                                    cy="50%"
                                    r="45%"
                                    fill="none"
                                    stroke={effectivelyCheckedIn ? '#dcfce7' : '#fda4af'}
                                    strokeWidth="2"
                                    strokeDasharray="6 4"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                                    className="opacity-70"
                                />
                            </svg>
                            <div className="relative z-10 w-28 h-28 flex items-center justify-center">
                                <AvatarUpload file={avatarFile} onFileChange={handlePhotoChange} hideControls={true} />
                            </div>
                        </div>
                    </div>
                    
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className="space-y-1">
                            <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">
                                {user.name.split(' ')[0]}<span className="text-emerald-500">.</span>
                            </h2>
                            <div className="flex items-center justify-center gap-2">
                                 <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em] border border-emerald-500/20 shadow-lg shadow-black/20">
                                    {user.role.replace(/_/g, ' ')}
                                 </span>
                                 {effectivelyCheckedIn && (
                                    <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-400 tracking-widest bg-black/40 px-2 py-1 rounded-full border border-emerald-500/10">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                        LIVE
                                    </span>
                                 )}
                            </div>
                        </div>

                        {/* Custom Avatar Controls */}
                        <div className="flex items-center justify-center gap-2 relative z-50 pointer-events-auto">
                            <button 
                                type="button"
                                onClick={() => document.getElementById('avatar-upload')?.click()}
                                className="cursor-pointer px-4 py-2 bg-transparent border-none text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all hover:opacity-70"
                            >
                                <Edit className="w-3 h-3 text-emerald-400" />
                                Change
                            </button>
                            <button 
                                type="button"
                                onClick={() => document.getElementById('avatar-hidden-capture-btn')?.click()}
                                className="px-4 py-2 bg-transparent border-none text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all hover:opacity-70"
                            >
                                <Camera className="w-3 h-3" />
                                Capture
                            </button>
                        </div>
                    </motion.div>
                </div>

                <div className="space-y-6">



                    {user.role !== 'management' && (
                        <section className="relative">
                            <div className="flex items-center justify-between mb-6 px-2">
                                <h3 className="text-lg font-black text-white/90 uppercase tracking-widest flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-emerald-500" /> TIMELINE
                                </h3>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
                                    {format(new Date(), 'dd MMM yyyy')}
                                </div>
                            </div>

                            <div className="flex gap-4 px-2">
                                {/* Vertical Flux Line */}
                                <div className="flex flex-col items-center">
                                    <div className={`w-3 h-3 rounded-full border-2 ${lastCheckInTime ? 'bg-emerald-500 border-emerald-300' : 'bg-gray-800 border-gray-700'}`} />
                                    <div className="w-[2px] flex-1 bg-gradient-to-b from-emerald-500/50 via-blue-500/50 to-rose-500/50 my-1 rounded-full opacity-20" />
                                    <div className={`w-3 h-3 rounded-full border-2 ${lastCheckOutTime ? 'bg-rose-500 border-rose-300' : 'bg-gray-800 border-gray-700'}`} />
                                </div>

                                <div className="flex-1 space-y-6">
                                    {/* Temporal Nodes */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest">First Entry</p>
                                            <p className="text-2xl font-black text-white tracking-tighter tabular-nums">{formatTime(lastCheckInTime)}</p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-[10px] font-black text-rose-500/70 uppercase tracking-widest">Last Exit</p>
                                            <p className="text-2xl font-black text-white tracking-tighter tabular-nums">{formatTime(lastCheckOutTime)}</p>
                                        </div>
                                        
                                        <div className="space-y-1 border-t border-white/5 pt-4">
                                            <p className="text-[10px] font-black text-blue-500/70 uppercase tracking-widest">First B-In</p>
                                            <p className="text-xl font-black text-white/90 tracking-tighter tabular-nums">{formatTime(firstBreakInTime)}</p>
                                        </div>
                                        <div className="space-y-1 text-right border-t border-white/5 pt-4">
                                            <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest">Last B-Out</p>
                                            <p className="text-xl font-black text-white/90 tracking-tighter tabular-nums">{formatTime(lastBreakOutTime)}</p>
                                        </div>
                                    </div>

                                    {/* Accumulation Stats */}
                                    <div className="grid grid-cols-2 gap-3">
                                         <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Zap className="h-3 w-3 text-emerald-400" />
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">Work Vol.</span>
                                            </div>
                                            <p className="text-xl font-bold text-white tabular-nums">
                                                {totalWorkingDurationToday > 0 
                                                    ? `${Math.floor(totalWorkingDurationToday)}h ${Math.round((totalWorkingDurationToday % 1) * 60)}m` 
                                                    : '0.0h'}
                                            </p>
                                         </div>
                                         <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Zap className="h-3 w-3 text-rose-400" />
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">Break Vol.</span>
                                            </div>
                                            <p className="text-xl font-bold text-white tabular-nums">
                                                {totalBreakDurationToday > 0 
                                                    ? `${Math.floor(totalBreakDurationToday)}h ${Math.round((totalBreakDurationToday % 1) * 60)}m` 
                                                    : '0.0h'}
                                            </p>
                                         </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ═══ COMMAND CENTER ═══ */}
                    {user.role !== 'management' && (
                        <section className="flex flex-col items-center justify-center py-8 relative">
                            {/* ── The Punch Orb ── */}
                            {isAttendanceLoading ? (
                                <div className="w-40 h-40 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                                </div>
                            ) : (
                                <div className="relative flex items-center justify-center">
                                    {/* ── Dynamic Wave Ripples ── */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                        {[0, 1, 2].map((i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ scale: 1, opacity: 0.5 }}
                                                animate={{ 
                                                    scale: [1, 1.8], 
                                                    opacity: [0.3, 0] 
                                                }}
                                                transition={{ 
                                                    duration: 3, 
                                                    repeat: Infinity, 
                                                    delay: i * 1,
                                                    ease: "easeOut"
                                                }}
                                                className={`absolute w-40 h-40 rounded-full border-[2px] ${effectivelyCheckedIn ? 'border-rose-500/40' : 'border-emerald-400/40'}`}
                                            />
                                        ))}
                                        
                                        {/* Core Breathing Aura */}
                                        <motion.div 
                                            animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }}
                                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                            className={`absolute w-56 h-56 rounded-full blur-2xl ${effectivelyCheckedIn ? 'bg-rose-500' : 'bg-emerald-400'}`} 
                                        />
                                    </div>
                                    <motion.button
                                        whileTap={{ scale: 0.93 }}
                                        onClick={() => {
                                            triggerHaptic(ImpactStyle.Heavy);
                                            if (isPunchBlocked) {
                                                if (unlockRequestStatus === 'pending') return;
                                                navigate('/attendance/request-unlock');
                                                return;
                                            }
                                            if (isCheckedIn) navigate('/attendance/check-out?workType=office');
                                            else navigate('/attendance/check-in?workType=office');
                                        }}
                                        disabled={isOnBreak || isSubmittingAttendance || (isPunchBlocked && unlockRequestStatus === 'pending')}
                                        className={`
                                            relative w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-500 shadow-2xl overflow-hidden
                                            ${isOnBreak || isSubmittingAttendance ? 'opacity-50 grayscale cursor-not-allowed' : ''}
                                            ${effectivelyCheckedIn 
                                                ? 'bg-gradient-to-br from-[#1a0a0a] to-[#0a0505] border-[3px] border-rose-500/40' 
                                                : isPunchBlocked 
                                                    ? 'bg-gradient-to-br from-amber-600 to-orange-800 border-[3px] border-amber-400/30'
                                                    : 'bg-gradient-to-br from-emerald-500 to-teal-700 border-[3px] border-[#dcfce7]/30'
                                            }
                                        `}
                                    >
                                        <motion.div 
                                            animate={{ scale: [1, 1.15, 1], opacity: [0.05, 0.2, 0.05] }}
                                            transition={{ duration: 3, repeat: Infinity }}
                                            className={`absolute inset-[-8px] rounded-full blur-xl ${effectivelyCheckedIn ? 'bg-rose-500' : 'bg-emerald-400'}`}
                                        />
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={effectivelyCheckedIn ? 'out' : 'in'}
                                                initial={{ y: 15, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                exit={{ y: -15, opacity: 0 }}
                                                className="flex flex-col items-center relative z-10"
                                            >
                                                {effectivelyCheckedIn ? (
                                                    <>
                                                        <LogOut className="h-9 w-9 text-rose-500 mb-1 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                                        <span className="text-base font-black text-white tracking-widest">PUNCH OUT</span>
                                                    </>
                                                ) : isPunchBlocked ? (
                                                    <>
                                                        {unlockRequestStatus === 'pending' ? <Clock className="h-9 w-9 text-amber-400 mb-1" /> : <Lock className="h-9 w-9 text-white mb-1" />}
                                                        <span className="text-xs font-black text-white tracking-tight leading-tight px-4">
                                                            {unlockRequestStatus === 'pending' ? 'PENDING' : 'REQUEST ACCESS'}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <LogIn className="h-10 w-10 text-[#dcfce7] mb-1 drop-shadow-[0_0_12px_rgba(220,252,231,0.5)] animate-pulse" />
                                                        <span className="text-lg font-black text-white tracking-widest">PUNCH IN</span>
                                                    </>
                                                )}
                                            </motion.div>
                                        </AnimatePresence>
                                        <div className={`absolute bottom-0 left-0 w-full h-1 transition-colors duration-500 ${effectivelyCheckedIn ? 'bg-rose-500' : 'bg-emerald-400'}`} />
                                    </motion.button>
                                </div>
                            )}

                            {/* ── Action Grid: Break / Site / Site OT ── */}
                            {isCheckedIn && !isPunchBlocked && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    className="w-full mt-8 px-2 space-y-3"
                                >
                                    {/* Break Row */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => { triggerHaptic(); navigate('/attendance/break-in'); }}
                                            disabled={isOnBreak || isSubmittingAttendance}
                                            className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all active:scale-95 flex items-center justify-center gap-2
                                                ${isOnBreak 
                                                    ? 'bg-gray-800/50 border-white/5 text-gray-600 cursor-not-allowed' 
                                                    : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                                                }`}
                                        >
                                            <Clock className="h-3.5 w-3.5" />
                                            Break In
                                        </button>
                                        <button
                                            onClick={() => { triggerHaptic(); navigate('/attendance/break-out'); }}
                                            disabled={!isOnBreak || isSubmittingAttendance}
                                            className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all active:scale-95 flex items-center justify-center gap-2
                                                ${isOnBreak 
                                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                                                    : 'bg-gray-800/50 border-white/5 text-gray-600 cursor-not-allowed'
                                                }`}
                                        >
                                            <CheckCircle className="h-3.5 w-3.5" />
                                            Break Out
                                        </button>
                                    </div>

                                    {/* Site In/Out Row — for field & site staff */}
                                    {(isFieldStaffRole || isSiteStaffRole) && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => { triggerHaptic(); navigate('/attendance/check-in?workType=field'); }}
                                                disabled={isFieldCheckedIn || isOnBreak || isSubmittingAttendance || isSiteOtCheckedIn}
                                                className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all active:scale-95 flex items-center justify-center gap-2
                                                    ${isFieldCheckedIn || isOnBreak || isSiteOtCheckedIn 
                                                        ? 'bg-gray-800/50 border-white/5 text-gray-600 cursor-not-allowed' 
                                                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                                    }`}
                                            >
                                                <MapPin className="h-3.5 w-3.5" />
                                                Site In
                                            </button>
                                            <button
                                                onClick={() => { triggerHaptic(); navigate('/attendance/check-out?workType=field'); }}
                                                disabled={!isFieldCheckedIn || isOnBreak || isSubmittingAttendance || isSiteOtCheckedIn}
                                                className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all active:scale-95 flex items-center justify-center gap-2
                                                    ${isFieldCheckedIn && !isOnBreak && !isSiteOtCheckedIn
                                                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                                        : 'bg-gray-800/50 border-white/5 text-gray-600 cursor-not-allowed'
                                                    }`}
                                            >
                                                <MapPin className="h-3.5 w-3.5" />
                                                Site Out
                                            </button>
                                        </div>
                                    )}

                                    {/* Site OT Row — for site staff only */}
                                    {isSiteStaffRole && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => { triggerHaptic(); navigate('/attendance/check-in?action=site-ot-in'); }}
                                                disabled={isSiteOtCheckedIn || isOnBreak || isSubmittingAttendance || isFieldCheckedIn}
                                                className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all active:scale-95 flex items-center justify-center gap-2
                                                    ${isSiteOtCheckedIn || isOnBreak || isFieldCheckedIn
                                                        ? 'bg-gray-800/50 border-white/5 text-gray-600 cursor-not-allowed' 
                                                        : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20'
                                                    }`}
                                            >
                                                <Zap className="h-3.5 w-3.5" />
                                                Site OT In
                                            </button>
                                            <button
                                                onClick={() => { triggerHaptic(); navigate('/attendance/check-out?action=site-ot-out'); }}
                                                disabled={!isSiteOtCheckedIn || isOnBreak || isSubmittingAttendance || isFieldCheckedIn}
                                                className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all active:scale-95 flex items-center justify-center gap-2
                                                    ${isSiteOtCheckedIn && !isOnBreak && !isFieldCheckedIn
                                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                                                        : 'bg-gray-800/50 border-white/5 text-gray-600 cursor-not-allowed'
                                                    }`}
                                            >
                                                <CheckCircle className="h-3.5 w-3.5" />
                                                Site OT Out
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Hint Zone */}
                            <div className="mt-6 px-8 text-center min-h-[32px]">
                                {isCheckedIn ? (
                                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} className="text-[9px] text-emerald-200 uppercase tracking-[0.15em] font-black leading-relaxed">
                                        active session · remember to punch out
                                    </motion.p>
                                ) : (
                                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} className="text-[9px] text-gray-500 uppercase tracking-[0.15em] font-black leading-relaxed">
                                        tap the orb to register presence
                                    </motion.p>
                                )}
                            </div>
                        </section>
                    )}



                    {/* Glass Fragment Account Actions */}
                    <section className="space-y-3 px-2">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Core Utilities</h3>
                        
                        <div className="grid grid-cols-1 gap-2">
                             <button 
                                onClick={() => navigate('/leaves/dashboard')} 
                                className="w-full bg-white/5 border border-white/5 rounded-xl p-4 flex items-center justify-between transition-all active:scale-[0.98] group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                                        <Crosshair className="h-5 w-5" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-white font-bold text-sm uppercase tracking-tight">Leave Tracker</p>
                                        <p className="text-gray-500 text-[10px] uppercase font-bold">History & Balance</p>
                                    </div>
                                </div>
                                <Zap className="h-4 w-4 text-emerald-500/30 group-hover:text-emerald-500 transition-colors" />
                            </button>

                            <button 
                                onClick={handleLogoutClick} 
                                className="w-full bg-rose-500/5 border border-rose-500/10 rounded-xl p-4 flex items-center justify-between transition-all active:scale-[0.98] group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
                                        <LogOut className="h-5 w-5" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-white font-bold text-sm uppercase tracking-tight">Terminate Session</p>
                                        <p className="text-rose-500/50 text-[10px] uppercase font-bold">Log out completely</p>
                                    </div>
                                </div>
                                <Zap className="h-4 w-4 text-rose-500/30 group-hover:text-rose-500 transition-colors" />
                            </button>
                        </div>
                    </section>

                    {/* Secondary Management Sections */}
                    <div className="space-y-8 px-2 pb-24 text-white">
                        {/* Profile Details Fragment */}
                        <section className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <UserIcon className="h-5 w-5 text-emerald-400" />
                                <h3 className="text-sm font-black uppercase tracking-widest">Identity Details</h3>
                            </div>
                            <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
                                <div className="space-y-4">
                                    <Input label="Display Name" id="name" registration={register('name')} className="bg-black/20 border-white/5 text-white" />
                                    <Input label="Contact Direct" id="phone" type="tel" registration={register('phone')} className="bg-black/20 border-white/5 text-white" />
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-gray-500 uppercase">Biological Gender</label>
                                        <select {...register('gender')} className="w-full bg-black/20 border border-white/5 rounded-xl h-12 px-4 text-sm font-bold text-white focus:border-emerald-500 outline-none transition-all">
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <Button type="submit" isLoading={isSaving} disabled={!isDirty} className="w-full !bg-emerald-600 !h-12 rounded-xl font-black uppercase tracking-widest text-xs mt-4">Update Profile</Button>
                            </form>
                        </section>

                        {/* Security Pin Section */}
                        <section className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <Lock className="h-5 w-5 text-amber-400" />
                                <h3 className="text-sm font-black uppercase tracking-widest">Security Pin</h3>
                            </div>
                            <p className="text-[11px] text-gray-400 mb-6 leading-relaxed uppercase font-bold tracking-tight">4-digit code required for high-security attendance verification.</p>
                            <form onSubmit={handlePasscodeSubmit(onPasscodeSubmit)} className="space-y-4">
                                <Input label="Current Pin" id="oldPasscode" type="password" inputMode="numeric" maxLength={4} registration={registerPasscode('oldPasscode')} className="bg-black/20 border-white/5 text-white" />
                                <Input label="New Security Pin" id="newPasscode" type="password" inputMode="numeric" maxLength={4} registration={registerPasscode('newPasscode')} className="bg-black/20 border-white/5 text-white" />
                                <Button type="submit" isLoading={isSavingPasscode} disabled={!isPasscodeDirty} className="w-full !bg-amber-600 !h-12 rounded-xl font-black uppercase tracking-widest text-xs mt-2">Update Security</Button>
                            </form>
                        </section>

                        {/* Alert Tone Picker Section */}
                        <section className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                            <AlertTonePicker />
                        </section>

                        {/* Family Section Fragment */}
                        {user.gender === 'Female' && (
                            <section className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <Baby className="h-5 w-5 text-pink-400" />
                                    <h3 className="text-sm font-black uppercase tracking-widest">Family Matrix</h3>
                                </div>
                                {/* Reusing the logic but styled for dark mode */}
                                {isChildrenLoading ? (
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-pink-400" />
                                ) : (
                                    <div className="space-y-4">
                                        {children.map(child => (
                                            <div key={child.id} className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                                                <div>
                                                    <p className="text-sm font-bold text-white">{child.childName}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase">{child.dateOfBirth}</p>
                                                </div>
                                                <button onClick={() => handleDeleteChild(child.id)} className="p-2 text-rose-500/50 hover:text-rose-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        ))}
                                        {children.length < 2 && (
                                            <button 
                                                onClick={() => setToast({ message: 'Use desktop to add children details for now.', type: 'info' })}
                                                className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-[10px] font-black text-gray-500 uppercase hover:bg-white/5 transition-all"
                                            >
                                                + Add Member
                                            </button>
                                        )}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (isScoresLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-3 md:p-4 flex-1 flex flex-col space-y-4">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Full-width Redesigned Web Header (Matching Reference Design) */}
            <div className="relative overflow-hidden md:bg-white md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 flex flex-col">
                
                {/* Dual Tone Background — 50/50 horizontal split (top green, bottom white) */}
                <div className="absolute top-0 left-0 w-full h-[50%] bg-[#006B3F] pointer-events-none transition-all duration-300"></div>
                <div className="absolute bottom-0 left-0 w-full h-[50%] bg-white pointer-events-none transition-all duration-300"></div>


                {/* Content Container — balanced padding to ensure the avatar's center aligns with the 50/50 background split */}
                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-center gap-6 md:gap-8 w-full py-6 md:py-8 px-6">
                    {/* Squircle Avatar (The squircle shape is now handled inside AvatarUpload) */}
                    <div className="relative flex-shrink-0">
                        <AvatarUpload file={avatarFile} onFileChange={handlePhotoChange} />
                    </div>
                    
                    {/* User Info aligned next to the avatar */}
                    <div className="text-center md:text-left flex-1 md:pb-0">
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                             <h2 className="text-2xl font-bold text-gray-900 md:text-white tracking-tight">{user.name}</h2>
                             <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/20 text-white text-xs font-bold uppercase tracking-widest shadow-sm">
                                {getRoleName(user.role)}
                             </span>
                        </div>
                        <p className="mt-1.5 text-sm font-normal text-gray-500 md:text-white md:opacity-90 inline-flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 flex-shrink-0 hidden md:inline-block" />
                            {user.email}
                        </p>
                        
                        {/* Desktop Avatar Controls — standardized design system */}
                        <div className="mt-5 hidden md:flex items-center justify-start gap-3">
                            <label htmlFor="avatar-upload" className="cursor-pointer inline-flex items-center justify-center h-9 px-4 rounded-lg border-2 border-transparent bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                                <Edit className="w-4 h-4 mr-2 flex-shrink-0" />
                                {avatarFile ? 'Change' : 'Upload'}
                            </label>
                            <button 
                                type="button"
                                onClick={() => document.getElementById('avatar-hidden-capture-btn')?.click()}
                                className="inline-flex items-center justify-center h-9 px-4 rounded-lg border-2 border-transparent bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                                <Camera className="w-4 h-4 mr-2 flex-shrink-0" />
                                Capture
                            </button>
                        </div>
                    </div>
                </div>

                {/* Performance Badges — centered on the green/white boundary line (desktop only) */}
                <div className="hidden md:flex absolute top-1/2 right-8 -translate-y-[1.75rem] z-20 items-center gap-4">
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-14 h-14 transform hover:scale-105 transition-all text-[#F97316] drop-shadow-md" title="Performance Score: 99">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-sm tracking-tight">{isScoresLoading ? '—' : (employeeScores?.performanceScore ?? '—')}</span>
                        </div>
                        <span className="text-[11px] uppercase font-bold text-gray-500 tracking-widest">Performance</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-14 h-14 transform hover:scale-105 transition-all text-[#6366f1] drop-shadow-md" title="Attendance: 98%">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-sm tracking-tight">{isScoresLoading ? '—' : (employeeScores?.attendanceScore ?? '—')}</span>
                        </div>
                        <span className="text-[11px] uppercase font-bold text-gray-500 tracking-widest">Attendance</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-14 h-14 transform hover:scale-105 transition-all text-[#111827] drop-shadow-md" title="Response Time: 99%">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-sm tracking-tight">{isScoresLoading ? '—' : (employeeScores?.responseScore ?? '—')}</span>
                        </div>
                        <span className="text-[11px] uppercase font-bold text-gray-500 tracking-widest">Response</span>
                    </div>
                </div>

                {/* Mobile-only badges (inside normal flow) */}
                <div className="md:hidden flex items-center justify-center gap-3 w-full px-6 pb-4">
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-12 h-12 text-[#F97316] drop-shadow-sm">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-[13px]">{isScoresLoading ? '—' : (employeeScores?.performanceScore ?? '—')}</span>
                        </div>
                        <span className="text-[11px] uppercase font-bold text-gray-500 tracking-widest">Performance</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-12 h-12 text-[#6366f1] drop-shadow-sm">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-[13px]">{isScoresLoading ? '—' : (employeeScores?.attendanceScore ?? '—')}</span>
                        </div>
                        <span className="text-[11px] uppercase font-bold text-gray-500 tracking-widest">Attendance</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-12 h-12 text-[#111827] drop-shadow-sm">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-[13px]">{isScoresLoading ? '—' : (employeeScores?.responseScore ?? '—')}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Response</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-5">
                
                {/* Unified Horizontal Layout (All cards in 1 row) */}
                <div className="lg:col-span-12 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-stretch">

                    {/* Side-by-Side: Profile Details & Work Hours Tracking */}
                        
                    {/* Profile Details */}
                    <div className="md:bg-white md:p-3 md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 h-full transition-shadow">
                        <div className="flex items-center gap-3 mb-5 md:mb-5">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <UserIcon className="h-5 w-5 text-blue-600" />
                            </div>
                            <h3 className="text-base md:text-sm font-bold text-gray-900">Profile Details</h3>
                        </div>
                        <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4 md:space-y-3">
                            <div className="grid grid-cols-1 gap-4 md:gap-3">
                                <div className="w-full">
                                    <Input label="Full Name" id="name" error={profileErrors.name?.message} registration={register('name')} className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors" autoComplete="name" />
                                </div>
                                <div className="w-full">
                                    <Input label="Phone Number" id="phone" type="tel" error={profileErrors.phone?.message} registration={register('phone')} className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors" autoComplete="tel" />
                                </div>
                                <div className="w-full">
                                    <Input label="Email Address" id="email" type="email" error={profileErrors.email?.message} registration={register('email')} readOnly className="bg-gray-100/50 text-gray-500 cursor-not-allowed border-gray-200" autoComplete="email" />
                                </div>
                                <div className="w-full space-y-1">
                                    <label htmlFor="gender-desktop" className="block text-sm font-medium text-gray-700">Gender</label>
                                    <select id="gender-desktop" {...register('gender')} className="form-input bg-gray-50/50 border-gray-200 focus:bg-white transition-colors w-full h-[42px]">
                                        <option value="" disabled>Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    {profileErrors.gender && <p className="text-red-500 text-xs mt-1">{profileErrors.gender.message}</p>}
                                </div>
                            </div>
                            <div className="flex justify-end pt-4 mt-4 border-t border-gray-100">
                                <Button type="submit" isLoading={isSaving} disabled={!isDirty} className="md:!px-5 md:!py-0 md:!h-8 md:!text-[12px] md:rounded-lg w-full md:w-auto transition-all !bg-amber-600 hover:!bg-amber-700 font-bold">Save</Button>
                            </div>
                        </form>
                    </div>

                    {/* Work Hours Tracking */}
                    {user.role !== 'management' ? (
                        <div className={`relative transition-all duration-500 md:bg-white md:p-3 md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border ${isOnBreak ? 'border-rose-500 ring-2 ring-rose-100' : 'border-gray-100'} h-full`}>
                            {isOnBreak && (
                                <div className="absolute -top-3 left-6 z-20 bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-md shadow-sm uppercase tracking-wider">
                                    On Break
                                </div>
                            )}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-indigo-50 rounded-lg">
                                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-900">Work Hours Tracking</h3>
                            </div>
                            <div className="space-y-6">
                                {/* Small Stat Boxes */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                                        <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> First In
                                        </p>
                                        <p className="text-lg font-bold text-gray-900 font-mono tracking-tight">{formatTime(lastCheckInTime)}</p>
                                    </div>
                                    <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                                        <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Last Out
                                        </p>
                                        <p className="text-lg font-bold text-gray-900 font-mono tracking-tight">{formatTime(lastCheckOutTime)}</p>
                                    </div>
                                    <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                                        <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> First B-In
                                        </p>
                                        <p className="text-lg font-bold text-gray-900 font-mono tracking-tight">{formatTime(firstBreakInTime)}</p>
                                    </div>
                                    <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                                        <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Last B-Out
                                        </p>
                                        <p className="text-lg font-bold text-gray-900 font-mono tracking-tight">{formatTime(lastBreakOutTime)}</p>
                                    </div>
                                </div>

                                {isAttendanceLoading ? (
                                    <div className="flex items-center justify-center h-[56px] md:h-[40px] bg-gray-50 rounded-xl"><Loader2 className="h-6 w-6 md:h-4 md:w-4 animate-spin text-gray-400" /></div>
                                ) : (
                                    <div className="space-y-6 md:space-y-3">
                                            <div className="flex flex-col space-y-3 md:space-y-1.5">
                                                <div className="flex items-center gap-2 px-0.5">
                                                    <button 
                                                        onClick={() => handleToggleHint('punch')}
                                                        className="focus:outline-none hover:scale-110 transition-all active:scale-95 !bg-transparent !border-none !p-0 !shadow-none !ring-0 flex items-center justify-center"
                                                        title="Click for hint"
                                                    >
                                                        <Info className="h-5 w-5 md:h-3.5 md:w-3.5 text-emerald-600" />
                                                    </button>
                                                    {showPunchHint && (
                                                        <span className="text-base md:text-xs italic text-emerald-700 font-medium animate-in fade-in slide-in-from-left-2 duration-300">
                                                            Punch in is required when starting the day, and Punch out when the day ends
                                                        </span>
                                                    )}
                                                </div>
                                            <div className="grid grid-cols-2 gap-4 md:gap-3">
                                                <div className="relative group">
                                                       <Button
                                                           onClick={() => {
                                                               if (isPunchBlocked) {
                                                                   if (unlockRequestStatus === 'pending') return;
                                                                   navigate('/attendance/request-unlock');
                                                                   
                                                                   return;
                                                               }
                                                               if (user?.role === 'field_staff' || user?.role === 'operation_manager') {
                                                                   navigate('/attendance/check-in?workType=office');
                                                               } else {
                                                                   navigate('/attendance/check-in');
                                                               }
                                                           }}
                                                           variant="primary"
                                                           className={`attendance-action-btn md:!h-9 md:!py-0 md:!text-sm md:!rounded-lg transition-all ${
                                                               isPunchBlocked ? '!bg-amber-600 !text-white' : '!bg-emerald-600 hover:!bg-emerald-700 '
                                                           } ${isCheckedIn || isOnBreak || isActionInProgress || (isPunchBlocked && unlockRequestStatus === 'pending') ? '!bg-gray-100 !text-gray-700 !border-gray-200 pointer-events-none shadow-none' : ''}`}
                                                           disabled={isCheckedIn || isOnBreak || isActionInProgress || (isPunchBlocked && unlockRequestStatus === 'pending')}
                                                       >
                                                          {isPunchBlocked ? (
                                                               unlockRequestStatus === 'pending' 
                                                                 ? <Clock className="mr-2 h-4 w-4" /> 
                                                                 : <Lock className="mr-2 h-4 w-4" />
                                                          ) : <LogIn className={`mr-2 h-4 w-4 ${!isCheckedIn ? 'animate-pulse' : ''}`} />}
                                                          {isPunchBlocked 
                                                              ? (unlockRequestStatus === 'pending' 
                                                                  ? 'Pending' 
                                                                  : 'Request Punch In') 
                                                              : 'Punch In'}
                                                       </Button>
                                                </div>
                                                 <Button
                                                     onClick={() => navigate('/attendance/check-out?workType=office')}
                                                     variant="danger"
                                                     className={`attendance-action-btn md:!h-9 md:!py-0 md:!text-sm md:!rounded-lg transition-all !bg-rose-600 hover:!bg-rose-700 !text-white shadow-sm ${(!isCheckedIn || isFieldCheckedIn || isOnBreak || ((isFieldStaffRole || isSiteStaffRole) && !isFieldCheckedOut) || isPunchBlocked) ? '!bg-gray-100 !text-gray-600 !border-gray-200 pointer-events-none shadow-none' : ''}`}
                                                     disabled={!isCheckedIn || isFieldCheckedIn || isOnBreak || ((isFieldStaffRole || isSiteStaffRole) && !isFieldCheckedOut) || isActionInProgress || isPunchBlocked}
                                                 >
                                                     <LogOut className="mr-2 h-4 w-4" /> Punch Out
                                                 </Button>
                                            </div>

                                            {/* Field Staff & Site Staff Buttons */}
                                            {(isFieldStaffRole || isSiteStaffRole) && (
                                                <div className="grid grid-cols-2 gap-4 mt-4">
                                                     <Button
                                                         onClick={() => navigate('/attendance/check-in?workType=field')}
                                                         variant="primary"
                                                         className={`attendance-action-btn md:!h-9 md:!py-0 md:!text-sm md:!rounded-lg transition-all ${(!isCheckedIn || isFieldCheckedIn || isOnBreak || isPunchBlocked || isSiteOtCheckedIn) ? '!bg-gray-100 !text-gray-600 !border-gray-200 pointer-events-none shadow-none' : '!bg-emerald-600 hover:!bg-emerald-700 !text-white shadow-sm'}`}
                                                         disabled={!isCheckedIn || isFieldCheckedIn || isOnBreak || isActionInProgress || isPunchBlocked || isSiteOtCheckedIn}
                                                     >
                                                         <MapPin className="mr-2 h-4 w-4" /> Site In
                                                     </Button>
                                                     <Button
                                                         onClick={() => navigate('/attendance/check-out?workType=field')}
                                                         variant="secondary"
                                                         className={`attendance-action-btn md:!h-9 md:!py-0 md:!text-sm md:!rounded-lg transition-all ${(!isFieldCheckedIn || isOnBreak || isPunchBlocked || isSiteOtCheckedIn) ? '!bg-gray-100 !text-gray-600 !border-gray-200 pointer-events-none shadow-none' : '!bg-transparent hover:!bg-emerald-50 !border-emerald-600 !text-emerald-700'}`}
                                                         disabled={!isFieldCheckedIn || isOnBreak || isActionInProgress || isPunchBlocked || isSiteOtCheckedIn}
                                                     >
                                                         <MapPin className="mr-2 h-4 w-4" /> Site Out
                                                     </Button>
                                                </div>
                                            )}

                                            {/* Site OT Buttons for Site Staff */}
                                            {isSiteStaffRole && (
                                                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                                                     <Button
                                                         onClick={() => navigate('/attendance/check-in?action=site-ot-in')}
                                                         variant="primary"
                                                         className={`attendance-action-btn md:!h-9 md:!py-0 md:!text-sm md:!rounded-lg transition-all ${(!isCheckedIn || isSiteOtCheckedIn || isOnBreak || isPunchBlocked || isFieldCheckedIn) ? '!bg-gray-100 !text-gray-600 !border-gray-200 pointer-events-none shadow-none' : '!bg-indigo-600 hover:!bg-indigo-700 !text-white shadow-sm'}`}
                                                         disabled={!isCheckedIn || isSiteOtCheckedIn || isOnBreak || isActionInProgress || isPunchBlocked || isFieldCheckedIn}
                                                     >
                                                         <Clock className="mr-2 h-4 w-4" /> Site OT In
                                                     </Button>
                                                     <Button
                                                         onClick={() => navigate('/attendance/check-out?action=site-ot-out')}
                                                         variant="secondary"
                                                         className={`attendance-action-btn md:!h-9 md:!py-0 md:!text-sm md:!rounded-lg transition-all ${(!isSiteOtCheckedIn || isOnBreak || isPunchBlocked || isFieldCheckedIn) ? '!bg-gray-100 !text-gray-600 !border-gray-200 pointer-events-none shadow-none' : '!bg-transparent hover:!bg-indigo-50 !border-indigo-600 !text-indigo-700'}`}
                                                         disabled={!isSiteOtCheckedIn || isOnBreak || isActionInProgress || isPunchBlocked || isFieldCheckedIn}
                                                     >
                                                         <CheckCircle className="mr-2 h-4 w-4" /> Site OT Out
                                                     </Button>
                                                </div>
                                            )}
                                        </div>


                                        <div className="flex flex-col space-y-3 md:space-y-1.5">
                                            <div className="flex items-center gap-2 px-0.5">
                                                <button 
                                                    onClick={() => handleToggleHint('break')}
                                                    className="focus:outline-none hover:scale-110 transition-all active:scale-95 !bg-transparent !border-none !p-0 !shadow-none !ring-0 flex items-center justify-center"
                                                    title="Click for hint"
                                                >
                                                    <Info className="h-5 w-5 md:h-3.5 md:w-3.5 text-blue-600" />
                                                </button>
                                                {showBreakHint && (
                                                    <span className="text-base md:text-xs italic text-blue-700 font-medium animate-in fade-in slide-in-from-left-2 duration-300">
                                                        Break in when user goes for lunch is mandatory, or it will be a violation
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                 <Button
                                                     onClick={() => navigate('/attendance/break-in')}
                                                     variant="secondary"
                                                     className={`attendance-action-btn md:!h-9 md:!py-0 md:!text-sm md:!rounded-lg transition-all ${(((isFieldStaffRole || isSiteStaffRole) ? !isFieldCheckedIn : !isCheckedIn) || isOnBreak || isPunchBlocked) ? '!bg-gray-100 !text-gray-600 !border-gray-200 pointer-events-none shadow-none' : '!bg-transparent hover:!bg-emerald-50 !border-emerald-600 !text-emerald-700'}`}
                                                     disabled={((isFieldStaffRole || isSiteStaffRole) ? !isFieldCheckedIn : !isCheckedIn) || isOnBreak || isActionInProgress || isPunchBlocked}
                                                 >
                                                     <CheckCircle className="mr-2 h-4 w-4" /> Break In
                                                 </Button>
                                                 <Button
                                                     onClick={() => navigate('/attendance/break-out')}
                                                     variant="secondary"
                                                     className={`attendance-action-btn md:!h-9 md:!py-0 md:!text-sm md:!rounded-lg transition-all ${(!isOnBreak || isActionInProgress || isPunchBlocked) ? '!bg-gray-100 !text-gray-600 !border-gray-200 pointer-events-none shadow-none' : '!bg-transparent hover:!bg-emerald-50 !border-emerald-600 !text-emerald-700'}`}
                                                     disabled={!isOnBreak || isActionInProgress || isPunchBlocked}
                                                 >
                                                     <CheckCircle className="mr-2 h-4 w-4" /> Break Out
                                                 </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : <div></div>}

                    {/* Passcode Management Desktop */}
                    <div className="md:bg-white md:p-3 md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 transition-shadow">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-50 rounded-lg">
                                    <Lock className="h-5 w-5 text-amber-600" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-900">Security Passcode</h3>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">Update your 4-digit security passcode for attendance authentication. Keep this private for secure check-ins.</p>
                        
                        <form onSubmit={handlePasscodeSubmit(onPasscodeSubmit)} className="space-y-3">
                            <div className="grid grid-cols-1 gap-3">
                                <Input 
                                    label="Current Passcode" 
                                    id="oldPasscode-desktop" 
                                    type="password" 
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="Enter current PIN"
                                    registration={registerPasscode('oldPasscode')}
                                    error={passcodeErrors.oldPasscode?.message}
                                    className="bg-gray-50/30"
                                />
                                <Input 
                                    label="New Passcode" 
                                    id="newPasscode-desktop" 
                                    type="password" 
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="Enter new 4 digits"
                                    registration={registerPasscode('newPasscode')}
                                    error={passcodeErrors.newPasscode?.message}
                                    className="bg-gray-50/30"
                                />
                                <Input 
                                    label="Confirm Passcode" 
                                    id="confirmPasscode-desktop" 
                                    type="password" 
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="Confirm new 4 digits"
                                    registration={registerPasscode('confirmPasscode')}
                                    error={passcodeErrors.confirmPasscode?.message}
                                    className="bg-gray-50/30"
                                />
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-medium leading-none">
                                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                                        <span>Must be exactly 4 numeric digits.</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[9px] text-amber-600 font-medium italic leading-none">
                                        <AlertTriangle className="h-3 w-3" />
                                        <span>Forgot PIN? Reset via User Management or Contact Admin.</span>
                                    </div>
                                </div>
                                    <Button 
                                        type="submit"
                                        isLoading={isSavingPasscode}
                                        disabled={!isPasscodeDirty}
                                        className="md:!px-5 md:!h-8 md:!text-[12px] !bg-amber-600 hover:!bg-amber-700 transition-all font-bold md:rounded-lg"
                                    >
                                        Save
                                    </Button>
                            </div>
                        </form>
                    </div>

                    {/* Family Details Section (Female employees only) */}
                    {user.gender === 'Female' && (
                        <div className="md:bg-white md:p-3 md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 transition-shadow">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-2 bg-pink-50 rounded-lg">
                                    <Baby className="h-5 w-5 text-pink-600" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-900">Family Details</h3>
                                <span className="text-xs text-gray-400">({children.length}/2 children)</span>
                            </div>

                            {isChildrenLoading ? (
                                <div className="flex items-center justify-center h-20"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Existing children */}
                                    {children.map(child => (
                                        <div key={child.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 text-sm">{child.childName}</p>
                                                <p className="text-xs text-gray-500">DOB: {child.dateOfBirth}</p>
                                                {child.birthCertificateUrl && (
                                                    <a href={child.birthCertificateUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                                                        <FileCheck className="h-3 w-3" /> View Certificate
                                                    </a>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {child.verificationStatus === 'approved' && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                                                        <CheckCircle className="h-3 w-3" /> Approved
                                                    </span>
                                                )}
                                                {child.verificationStatus === 'pending' && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                                                        <Clock className="h-3 w-3" /> Pending
                                                    </span>
                                                )}
                                                {child.verificationStatus === 'rejected' && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-full">
                                                        <FileX className="h-3 w-3" /> Rejected
                                                    </span>
                                                )}
                                                <button onClick={() => handleDeleteChild(child.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Remove child">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add child form */}
                                    {children.length < 2 && (
                                        <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl space-y-3">
                                            <p className="text-sm font-medium text-gray-700">Add Child</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Child's Name"
                                                    value={newChildName}
                                                    onChange={e => setNewChildName(e.target.value)}
                                                    className="form-input bg-white border-gray-200 text-sm h-[40px] rounded-lg"
                                                />
                                                <input
                                                    type="date"
                                                    value={newChildDob}
                                                    onChange={e => setNewChildDob(e.target.value)}
                                                    className="form-input bg-white border-gray-200 text-sm h-[40px] rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Birth Certificate (PDF/Image)</label>
                                                <input
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    onChange={handleCertFileChange}
                                                    className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
                                                />
                                            </div>
                                            <button
                                                onClick={handleAddChild}
                                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-pink-600 hover:bg-pink-700 rounded-lg transition-colors"
                                            >
                                                <PlusCircle className="h-4 w-4" /> Add Child
                                            </button>
                                        </div>
                                    )}

                                    {children.length === 0 && (
                                        <p className="text-xs text-gray-400 italic">Add your children's details to become eligible for Child Care Leave.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    </div> {/* End Horizontal Grid Row */}
                </div> {/* End col-span-12 container */}

                {/* Hide entirely on desktop using md:hidden as requested */}
                <div className="lg:col-span-4 space-y-6 md:hidden">
                    {/* Remove the box styling strictly for web view as requested */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:bg-transparent md:p-0 md:rounded-none md:shadow-none md:border-none">
                        <h3 className="text-base font-bold mb-4 text-gray-900 border-b border-gray-100 md:border-transparent md:pb-0 pb-3">Account Actions</h3>
                        <div className="space-y-3">
                            <Button onClick={() => navigate('/leaves/dashboard')} variant="outline" className="w-full justify-start py-2.5 px-4 md:!h-[42px] md:text-sm md:rounded-lg text-gray-700 hover:text-gray-900 md:bg-white border-gray-200 hover:bg-gray-50 transition-colors" title="View your leave history and balances"><Crosshair className="mr-3 h-4 w-4 text-gray-500" /> Leave Tracker</Button>
                            <Button onClick={handleLogoutClick} variant="outline" className="w-full justify-start py-2.5 px-4 md:!h-[42px] md:text-sm md:rounded-lg text-rose-600 hover:text-rose-700 md:bg-white border-rose-200 hover:bg-rose-50 transition-colors" isLoading={isSaving}><LogOut className="mr-3 h-4 w-4" /> Log Out</Button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ProfilePage;
