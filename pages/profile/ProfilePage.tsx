import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import type { User, UploadedFile, EmployeeScore, UserChild } from '../../types';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { api } from '../../services/api';
import { dispatchNotificationFromRules } from '../../services/notificationService';
import { User as UserIcon, Loader2, ClipboardList, LogOut, LogIn, Crosshair, CheckCircle, Info, MapPin, AlertTriangle, Clock, Lock, Edit, Camera, Mail, Baby, PlusCircle, Trash2, FileCheck, FileX } from 'lucide-react';
import { AvatarUpload } from '../../components/onboarding/AvatarUpload';
import { format } from 'date-fns';
import Modal from '../../components/ui/Modal';

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
        isFieldCheckedOut
    } = useAuthStore();
    const { permissions } = usePermissionsStore();
    const navigate = useNavigate();

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
    
    const isFieldStaff = user?.role === 'field_staff';

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
        
        // Security check: Verify old passcode
        if (formData.oldPasscode !== user.passcode) {
            setToast({ message: 'Current passcode is incorrect.', type: 'error' });
            return;
        }

        setIsSavingPasscode(true);
        try {
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
            <div className="p-4 space-y-8 md:bg-transparent bg-[#041b0f]">
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

                <div className="flex flex-col items-center text-center gap-4">
                    <AvatarUpload file={avatarFile} onFileChange={handlePhotoChange} />
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                        <p className="text-emerald-400/90 font-medium text-sm">{user.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <section>
                        <h3 className="fo-section-title mb-4">Profile Details</h3>
                        <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
                            <Input label="Full Name" id="name" error={profileErrors.name?.message} registration={register('name')} autoComplete="name" />
                            <Input label="Email Address" id="email" type="email" error={profileErrors.email?.message} registration={register('email')} readOnly className="!bg-gray-700/50" autoComplete="email" />
                            <Input label="Phone Number" id="phone" type="tel" error={profileErrors.phone?.message} registration={register('phone')} autoComplete="tel" />
                            <div className="space-y-1">
                                <label htmlFor="gender" className="block text-sm font-medium text-gray-300">Gender</label>
                                <select id="gender" {...register('gender')} className="form-input !bg-[#0d2c18] !border-emerald-500/20 !text-white w-full">
                                    <option value="" disabled>Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                                {profileErrors.gender && <p className="text-red-500 text-xs mt-1">{profileErrors.gender.message}</p>}
                            </div>
                            <div className="flex justify-end pt-2"><Button type="submit" isLoading={isSaving} disabled={!isDirty}>Save Changes</Button></div>
                        </form>
                    </section>
 
                    <section className="bg-emerald-500/5 rounded-2xl border border-emerald-500/10 p-5 mt-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                                <Lock className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-white">Authentication Passcode</h3>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400">Update your 4-digit numeric passcode for secure access.</p>
                            
                            <form onSubmit={handlePasscodeSubmit(onPasscodeSubmit)} className="space-y-4">
                                <Input 
                                    label="Current Passcode" 
                                    id="oldPasscode" 
                                    type="password" 
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="Enter current 4 digits"
                                    registration={registerPasscode('oldPasscode')}
                                    error={passcodeErrors.oldPasscode?.message}
                                />
                                
                                <div className="grid grid-cols-1 gap-4">
                                    <Input 
                                        label="New Passcode" 
                                        id="newPasscode" 
                                        type="password" 
                                        inputMode="numeric"
                                        maxLength={4}
                                        placeholder="Enter new 4 digits"
                                        registration={registerPasscode('newPasscode')}
                                        error={passcodeErrors.newPasscode?.message}
                                    />
                                    
                                    <Input 
                                        label="Confirm New Passcode" 
                                        id="confirmPasscode" 
                                        type="password" 
                                        inputMode="numeric"
                                        maxLength={4}
                                        placeholder="Confirm new 4 digits"
                                        registration={registerPasscode('confirmPasscode')}
                                        error={passcodeErrors.confirmPasscode?.message}
                                    />
                                </div>

                                <Button 
                                    type="submit"
                                    isLoading={isSavingPasscode}
                                    disabled={!isPasscodeDirty}
                                    className="w-full"
                                >
                                    Update Passcode
                                </Button>
                            </form>

                            <div className="flex items-center gap-2 text-[10px] text-emerald-400/60 mt-1">
                                <Info className="h-3 w-3" />
                                <span>Contact Admin if you forgot your current passcode.</span>
                            </div>
                        </div>
                    </section>


                    {user.role !== 'management' && (
                        <section className={`relative transition-all duration-500 ${isOnBreak ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-[#041b0f] rounded-2xl' : ''}`}>
                            {isOnBreak && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-rose-900/50 animate-pulse uppercase tracking-tighter">
                                    Active Break
                                </div>
                            )}
                            <h3 className="fo-section-title mb-4">Work Hours Tracking</h3>
                            <div className="bg-[#0f291e]/80 backdrop-blur-md rounded-2xl border border-white/5 p-5 shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                                
                                {/* 2x2 Grid for Attendance Times */}
                                <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                                    <div className="text-center p-3 bg-black/30 rounded-xl border border-white/10">
                                        <p className="text-[9px] text-emerald-400 mb-1 uppercase tracking-widest font-bold flex items-center justify-center gap-1">
                                            <LogIn className="h-3 w-3" /> First In
                                        </p>
                                        <p className="text-base font-bold text-white font-mono">{formatTime(lastCheckInTime)}</p>
                                    </div>
                                    <div className="text-center p-3 bg-black/30 rounded-xl border border-white/10">
                                        <p className="text-[9px] text-rose-400 mb-1 uppercase tracking-widest font-bold flex items-center justify-center gap-1">
                                            <LogOut className="h-3 w-3" /> Last Out
                                        </p>
                                        <p className="text-base font-bold text-white font-mono">{formatTime(lastCheckOutTime)}</p>
                                    </div>
                                    <div className="text-center p-3 bg-black/30 rounded-xl border border-white/10">
                                        <p className="text-[9px] text-blue-400 mb-1 uppercase tracking-widest font-bold flex items-center justify-center gap-1">
                                            <CheckCircle className="h-3 w-3" /> First B-In
                                        </p>
                                        <p className="text-base font-bold text-white font-mono">{formatTime(firstBreakInTime)}</p>
                                    </div>
                                    <div className="text-center p-3 bg-black/30 rounded-xl border border-white/10">
                                        <p className="text-[9px] text-amber-400 mb-1 uppercase tracking-widest font-bold flex items-center justify-center gap-1">
                                            <CheckCircle className="h-3 w-3" /> Last B-Out
                                        </p>
                                        <p className="text-base font-bold text-white font-mono">{formatTime(lastBreakOutTime)}</p>
                                    </div>
                                </div>

                                {/* Stats Grid: Break & Work */}
                                <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                                    <div className="px-4 py-4 bg-blue-500/5 rounded-xl border border-blue-500/10 flex flex-col items-center justify-center gap-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="h-5 w-5 text-blue-500" />
                                            <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Total Break</span>
                                        </div>
                                        <p className="text-lg font-bold text-white font-mono">
                                            {totalBreakDurationToday > 0 
                                                ? `${Math.floor(totalBreakDurationToday)}h ${Math.round((totalBreakDurationToday % 1) * 60)}m` 
                                                : '0h 0m'}
                                        </p>
                                    </div>
                                    <div className="px-4 py-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex flex-col items-center justify-center gap-2">
                                        <div className="flex items-center gap-2">
                                            <ClipboardList className="h-5 w-5 text-emerald-500" />
                                            <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Total Work</span>
                                        </div>
                                        <p className="text-lg font-bold text-white font-mono">
                                            {totalWorkingDurationToday > 0 
                                                ? `${Math.floor(totalWorkingDurationToday)}h ${Math.round((totalWorkingDurationToday % 1) * 60)}m` 
                                                : '0h 0m'}
                                        </p>
                                    </div>
                                </div>

                                {isAttendanceLoading ? (
                                    <div className="flex items-center justify-center text-emerald-500 h-[60px] bg-black/20 rounded-xl border border-white/5"><Loader2 className="h-6 w-6 animate-spin" /></div>
                                ) : (
                                        <div className="space-y-4 relative z-10">
                                            <div className="flex flex-col space-y-3">
                                                <div className="flex items-center gap-2 px-0.5">
                                                    <button 
                                                        onClick={() => handleToggleHint('punch')}
                                                        className="focus:outline-none hover:scale-110 transition-all active:scale-95 !bg-transparent !border-none !p-0 !shadow-none !ring-0 flex items-center justify-center"
                                                        title="Click for hint"
                                                    >
                                                        <Info className="h-5 w-5 text-emerald-400" />
                                                    </button>
                                                    {showPunchHint && (
                                                        <span className="text-base italic text-emerald-100/70 font-medium leading-tight animate-in fade-in slide-in-from-left-2 duration-300">
                                                            Punch in is required when starting the day, and Punch out when the day ends
                                                        </span>
                                                    )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 relative z-10">
                                                {/* Punch In / Request Unlock Button */}
                                                 <button
                                                    onClick={() => {
                                                        if (isPunchBlocked) {
                                                            if (unlockRequestStatus === 'pending') return;
                                                            navigate('/attendance/request-unlock');
                                                            return;
                                                        }
                                                        // Always use 'office' for the main day punch, even for field staff.
                                                        // This separates the Daily Punch (Day Start) from Site Visits.
                                                        navigate('/attendance/check-in?workType=office');
                                                    }}
                                                    disabled={isCheckedIn || isOnBreak || isActionInProgress || (isPunchBlocked && unlockRequestStatus === 'pending')}
                                                    className={`
                                                        relative overflow-hidden rounded-xl border p-0 transition-all duration-300 active:scale-[0.98] shadow-lg
                                                        flex flex-col items-center justify-center gap-1 h-[72px]
                                                        ${isPunchBlocked 
                                                            ? 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400/30 shadow-amber-500/20' 
                                                            : 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400/30 shadow-emerald-500/20'
                                                        }
                                                        ${(isCheckedIn || isOnBreak || isActionInProgress || (isPunchBlocked && unlockRequestStatus === 'pending')) ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:brightness-110'}
                                                    `}
                                                >
                                                    {/* Shine Effect */}
                                                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
                                                    
                                                    {isPunchBlocked ? (
                                                        <>
                                                            {unlockRequestStatus === 'pending' 
                                                                ? <Clock className="h-6 w-6 text-white drop-shadow-sm" />
                                                                : <Lock className="h-6 w-6 text-white drop-shadow-sm" />
                                                            }
                                                            <span className="text-white font-bold text-sm tracking-wide drop-shadow-sm">
                                                                {unlockRequestStatus === 'pending' ? 'PENDING' : 'REQUEST PUNCH IN'}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <LogIn className={`h-6 w-6 text-white drop-shadow-sm ${!isCheckedIn ? 'animate-pulse' : ''}`} />
                                                            <span className="text-white font-bold text-sm tracking-wide drop-shadow-sm">PUNCH IN</span>
                                                        </>
                                                    )}
                                                </button>

                                                {/* Punch Out Button */}
                                                 <button
                                                    onClick={() => navigate('/attendance/check-out?workType=office')}
                                                    disabled={!isCheckedIn || isFieldCheckedIn || isOnBreak || (isFieldStaff && !isFieldCheckedOut) || isActionInProgress || isPunchBlocked}
                                                    className={`
                                                        relative overflow-hidden rounded-xl border p-0 transition-all duration-300 active:scale-[0.98] shadow-lg
                                                        flex flex-col items-center justify-center gap-1 h-[72px]
                                                        ${(!isCheckedIn || isFieldCheckedIn || isOnBreak || (isFieldStaff && !isFieldCheckedOut) || isActionInProgress || isPunchBlocked)
                                                            ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-50' // Disabled Glass State
                                                            : 'bg-gradient-to-br from-rose-500 to-pink-600 border-rose-400/30 shadow-rose-500/20 hover:brightness-110'
                                                        }
                                                    `}
                                                >
                                                    {(!(!effectivelyCheckedIn || isFieldCheckedIn || isOnBreak || isActionInProgress || isPunchBlocked)) && (
                                                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
                                                    )}
                                                    <LogOut className={`h-6 w-6 ${(!isCheckedIn || isFieldCheckedIn || isOnBreak || (isFieldStaff && !isFieldCheckedOut) || isActionInProgress || isPunchBlocked) ? 'text-white/30' : 'text-white drop-shadow-sm'}`} />
                                                    <span className={`font-bold text-sm tracking-wide ${(!isCheckedIn || isFieldCheckedIn || isOnBreak || (isFieldStaff && !isFieldCheckedOut) || isActionInProgress || isPunchBlocked) ? 'text-white/30' : 'text-white drop-shadow-sm'}`}>
                                                        PUNCH OUT
                                                    </span>
                                                </button>
                                            </div>

                                                {/* Field Staff Buttons - Only show once session is active */}
                                                {(user?.role === 'field_staff' || user?.role === 'operation_manager') && isCheckedIn && !isPunchBlocked && (
                                                    <div className="grid grid-cols-2 gap-3 pb-2 border-b border-white/5">
                                                         <Button
                                                             onClick={() => navigate("/attendance/check-in?workType=field")}
                                                             disabled={!isCheckedIn || isFieldCheckedIn || isOnBreak || isActionInProgress || isPunchBlocked}
                                                             variant="primary"
                                                             className={`attendance-action-btn !bg-blue-600 !border-blue-700 ${!isCheckedIn || isFieldCheckedIn || isOnBreak || isPunchBlocked ? 'pointer-events-none opacity-50' : ''}`}
                                                         >
                                                             <MapPin className="mr-2 h-4 w-4" />
                                                             Site Check In
                                                         </Button>
 
                                                         <Button
                                                             onClick={() => navigate("/attendance/check-out?workType=field")}
                                                             disabled={!isFieldCheckedIn || isOnBreak || isActionInProgress || isPunchBlocked}
                                                             variant="secondary"
                                                             className={`attendance-action-btn !bg-amber-600 !border-amber-700 !text-white ${!isFieldCheckedIn || isOnBreak || isPunchBlocked ? 'pointer-events-none opacity-50' : ''}`}
                                                         >
                                                             <MapPin className="mr-2 h-4 w-4" />
                                                             Site Check Out
                                                         </Button>
                                                    </div>
                                                )}
                                            </div>

                                            
                                              {isCheckedIn && (
                                                <div className="flex flex-col space-y-3 pt-2 border-t border-white/5">
                                                    <div className="flex items-center gap-2 px-0.5">
                                                        <button 
                                                            onClick={() => handleToggleHint('break')}
                                                            className="focus:outline-none hover:scale-110 transition-all active:scale-95 !bg-transparent !border-none !p-0 !shadow-none !ring-0 flex items-center justify-center"
                                                            title="Click for hint"
                                                        >
                                                            <Info className="h-5 w-5 text-blue-400" />
                                                        </button>
                                                        {showBreakHint && (
                                                            <span className="text-base italic text-blue-100/70 font-medium leading-tight animate-in fade-in slide-in-from-left-2 duration-300">
                                                                Break in when user goes for lunch is mandatory, or it will be a violation
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                         <Button
                                                             onClick={() => navigate('/attendance/break-in')}
                                                             disabled={(isFieldStaff ? !isFieldCheckedIn : !isCheckedIn) || isOnBreak || isActionInProgress || isPunchBlocked}
                                                             variant="primary"
                                                             className={`attendance-action-btn !bg-emerald-600 !border-emerald-700 ${((isFieldStaff ? !isFieldCheckedIn : !isCheckedIn) || isOnBreak || isPunchBlocked) ? 'pointer-events-none opacity-50' : ''}`}
                                                         >
                                                             <CheckCircle className="mr-2 h-4 w-4" />
                                                             Break In
                                                         </Button>
                                                         <Button
                                                             onClick={() => navigate('/attendance/break-out')}
                                                             disabled={!isOnBreak || isActionInProgress || isPunchBlocked}
                                                             variant="primary"
                                                             className={`attendance-action-btn !bg-emerald-600 !border-emerald-700 ${(!isOnBreak || isPunchBlocked) ? 'pointer-events-none opacity-50' : ''}`}
                                                         >
                                                             <CheckCircle className="mr-2 h-4 w-4" />
                                                             Break Out
                                                         </Button>
                                                    </div>
                                                </div>
                                             )}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}


                    <section>
                        <h3 className="fo-section-title mb-4">Account Actions</h3>
                        <div className="space-y-4">
                            <button 
                                onClick={() => navigate('/leaves/dashboard')} 
                                className="w-full group relative overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl py-3 px-4 flex items-center justify-between transition-all duration-300 active:scale-[0.98]"
                            >
                                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors"></div>
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="p-2 rounded-xl bg-white/20 text-white backdrop-blur-sm">
                                        <Crosshair className="h-5 w-5" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-white font-bold text-sm">Leave Tracker</p>
                                        <p className="text-emerald-100 text-[10px] mt-0.5">View history & balances</p>
                                    </div>
                                </div>
                                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 group-hover:bg-white group-hover:text-emerald-700 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>

                            <button 
                                onClick={async () => {
                                    try {
                                        if ('serviceWorker' in navigator) {
                                            const registrations = await navigator.serviceWorker.getRegistrations();
                                            for (const registration of registrations) {
                                                await registration.unregister();
                                            }
                                        }
                                        if ('caches' in window) {
                                            const cacheNames = await caches.keys();
                                            await Promise.all(cacheNames.map(name => caches.delete(name)));
                                        }
                                        setToast({ message: 'Cache cleared! Reloading...', type: 'success' });
                                        setTimeout(() => window.location.reload(), 1000);
                                    } catch (error) {
                                        console.error('Failed to clear cache:', error);
                                        setToast({ message: 'Failed to clear cache. Try again.', type: 'error' });
                                    }
                                }}
                                className="w-full group relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-4 flex items-center justify-between transition-all duration-300 active:scale-[0.98]"
                            >
                                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors"></div>
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="p-3 rounded-xl bg-white/20 text-white backdrop-blur-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-white font-bold text-base">Clear Cache & Reload</p>
                                        <p className="text-blue-100 text-xs mt-0.5">Fix loading issues</p>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 group-hover:bg-white group-hover:text-blue-700 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>

                            <button 
                                onClick={handleLogoutClick} 
                                className="w-full group relative overflow-hidden bg-gradient-to-br from-rose-600 to-rose-800 rounded-2xl p-4 flex items-center justify-between transition-all duration-300 active:scale-[0.98]"
                            >
                                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors"></div>
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="p-3 rounded-xl bg-white/20 text-white backdrop-blur-sm">
                                        <LogOut className="h-6 w-6" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-white font-bold text-base">Log Out</p>
                                        <p className="text-rose-100 text-xs mt-0.5">Sign out of your account</p>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 group-hover:bg-white group-hover:text-rose-700 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    if (isScoresLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="w-full space-y-8 md:space-y-5">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Full-width Redesigned Web Header (Matching Reference Design) */}
            <div className="relative overflow-hidden md:bg-white md:rounded-[32px] md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 flex flex-col">
                
                {/* Dual Tone Background — 55/45 horizontal split (top green, bottom white) */}
                <div className="absolute top-0 left-0 w-full h-[55%] bg-[#006B3F] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-full h-[45%] bg-white pointer-events-none"></div>


                {/* Content Container */}
                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-center gap-6 md:gap-8 w-full p-6 md:p-8 md:pt-12">
                    {/* Squircle Avatar (The squircle shape is now handled inside AvatarUpload) */}
                    <div className="relative scale-110 md:scale-110 flex-shrink-0">
                        <AvatarUpload file={avatarFile} onFileChange={handlePhotoChange} />
                    </div>
                    
                    {/* User Info aligned next to the avatar */}
                    <div className="text-center md:text-left flex-1 md:pb-0">
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                             <h2 className="text-[24px] md:text-[26px] font-bold text-gray-900 md:text-white tracking-tight">{user.name}</h2>
                             <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/20 text-white text-[11px] font-bold uppercase tracking-widest shadow-sm">
                                {getRoleName(user.role)}
                             </span>
                        </div>
                        <p className="mt-1.5 text-[13px] font-normal text-gray-500 md:text-white md:opacity-90 inline-flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 flex-shrink-0 hidden md:inline-block" />
                            {user.email}
                        </p>
                        
                        {/* Desktop Avatar Controls — standardized design system */}
                        <div className="mt-5 hidden md:flex items-center justify-start gap-3">
                            <label htmlFor="avatar-upload" className="cursor-pointer inline-flex items-center justify-center h-[42px] px-5 rounded-lg border-2 border-transparent bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                                <Edit className="w-4 h-4 mr-2 flex-shrink-0" />
                                {avatarFile ? 'Change' : 'Upload'}
                            </label>
                            <button 
                                type="button"
                                onClick={() => document.getElementById('avatar-hidden-capture-btn')?.click()}
                                className="inline-flex items-center justify-center h-[42px] px-5 rounded-lg border-2 border-emerald-600 bg-white hover:bg-emerald-50 text-emerald-700 text-sm font-semibold shadow-sm transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                            >
                                <Camera className="w-4 h-4 mr-2 flex-shrink-0" />
                                Capture
                            </button>
                        </div>
                    </div>
                </div>

                {/* Performance Badges — centered on the green/white boundary line (desktop only) */}
                <div className="hidden md:flex absolute top-[55%] right-8 -translate-y-1/2 z-20 items-center gap-4">
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-12 h-12 transform hover:scale-105 transition-all text-[#F97316] drop-shadow-md" title="Performance Score: 99">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-sm tracking-tight">{isScoresLoading ? '—' : (employeeScores?.performanceScore ?? '—')}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Performance</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-12 h-12 transform hover:scale-105 transition-all text-[#6366f1] drop-shadow-md" title="Attendance: 98%">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-sm tracking-tight">{isScoresLoading ? '—' : (employeeScores?.attendanceScore ?? '—')}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Attendance</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-12 h-12 transform hover:scale-105 transition-all text-[#111827] drop-shadow-md" title="Response Time: 99%">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-sm tracking-tight">{isScoresLoading ? '—' : (employeeScores?.responseScore ?? '—')}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Response</span>
                    </div>
                </div>

                {/* Mobile-only badges (inside normal flow) */}
                <div className="md:hidden flex items-center justify-center gap-3 w-full px-6 pb-4">
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-10 h-10 text-[#F97316] drop-shadow-sm">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-[13px]">{isScoresLoading ? '—' : (employeeScores?.performanceScore ?? '—')}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Performance</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-10 h-10 text-[#6366f1] drop-shadow-sm">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-[13px]">{isScoresLoading ? '—' : (employeeScores?.attendanceScore ?? '—')}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Attendance</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex justify-center items-center w-10 h-10 text-[#111827] drop-shadow-sm">
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                            </svg>
                            <span className="relative z-10 text-white font-bold text-[13px]">{isScoresLoading ? '—' : (employeeScores?.responseScore ?? '—')}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Response</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6">
                
                {/* 70% Left Column */}
                <div className="lg:col-span-8 space-y-6 lg:space-y-6">

                    {/* Side-by-Side: Profile Details & Work Hours Tracking */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        
                    {/* Profile Details */}
                    <div className="md:bg-white md:p-6 md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 h-full transition-shadow">
                        <div className="flex items-center gap-3 mb-5 md:mb-5">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <UserIcon className="h-5 w-5 text-blue-600" />
                            </div>
                            <h3 className="text-lg md:text-base font-bold text-gray-900">Profile Details</h3>
                        </div>
                        <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-5 md:space-y-3">
                            <div className="grid grid-cols-1 gap-5 md:gap-4">
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
                            <div className="flex justify-end pt-5 mt-5 border-t border-gray-100">
                                <Button type="submit" isLoading={isSaving} disabled={!isDirty} className="md:!px-6 md:!py-2 md:!h-[42px] md:!text-sm md:rounded-lg w-full md:w-auto transition-all">Save Changes</Button>
                            </div>
                        </form>
                    </div>

                    {/* Work Hours Tracking */}
                    {user.role !== 'management' ? (
                        <div className={`relative transition-all duration-500 md:bg-white md:p-6 md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border ${isOnBreak ? 'border-rose-500 ring-2 ring-rose-100' : 'border-gray-100'} h-full`}>
                            {isOnBreak && (
                                <div className="absolute -top-3 left-6 z-20 bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-md shadow-sm uppercase tracking-wider">
                                    On Break
                                </div>
                            )}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-indigo-50 rounded-lg">
                                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                                </div>
                                <h3 className="text-base font-bold text-gray-900">Work Hours Tracking</h3>
                            </div>
                            <div className="space-y-6">
                                {/* Small Stat Boxes */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                                        <p className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> First In
                                        </p>
                                        <p className="text-xl font-bold text-gray-900 font-mono tracking-tight">{formatTime(lastCheckInTime)}</p>
                                    </div>
                                    <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                                        <p className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Last Out
                                        </p>
                                        <p className="text-xl font-bold text-gray-900 font-mono tracking-tight">{formatTime(lastCheckOutTime)}</p>
                                    </div>
                                    <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                                        <p className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> First B-In
                                        </p>
                                        <p className="text-xl font-bold text-gray-900 font-mono tracking-tight">{formatTime(firstBreakInTime)}</p>
                                    </div>
                                    <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                                        <p className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Last B-Out
                                        </p>
                                        <p className="text-xl font-bold text-gray-900 font-mono tracking-tight">{formatTime(lastBreakOutTime)}</p>
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
                                                           className={`attendance-action-btn md:!h-[42px] md:!py-0 md:!text-sm md:!rounded-lg transition-all ${
                                                               isPunchBlocked ? '!bg-amber-600 !text-white' : '!bg-emerald-600 hover:!bg-emerald-700 !text-white shadow-sm'
                                                           } ${isCheckedIn || isOnBreak || isActionInProgress || (isPunchBlocked && unlockRequestStatus === 'pending') ? '!bg-gray-100 !text-gray-400 !border-gray-200 pointer-events-none opacity-50 shadow-none' : ''}`}
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
                                                     className={`attendance-action-btn md:!h-[42px] md:!py-0 md:!text-sm md:!rounded-lg transition-all !bg-rose-600 hover:!bg-rose-700 !text-white shadow-sm ${(!isCheckedIn || isFieldCheckedIn || isOnBreak || (isFieldStaff && !isFieldCheckedOut) || isPunchBlocked) ? '!bg-gray-100 !text-gray-400 !border-gray-200 pointer-events-none opacity-50 shadow-none' : ''}`}
                                                     disabled={!isCheckedIn || isFieldCheckedIn || isOnBreak || (isFieldStaff && !isFieldCheckedOut) || isActionInProgress || isPunchBlocked}
                                                 >
                                                     <LogOut className="mr-2 h-4 w-4" /> Punch Out
                                                 </Button>
                                            </div>

                                            {/* Field Staff Buttons */}
                                            {user?.role === 'field_staff' && (
                                                <div className="grid grid-cols-2 gap-4 mt-4">
                                                     <Button
                                                         onClick={() => navigate('/attendance/check-in?workType=field')}
                                                         variant="primary"
                                                         className={`attendance-action-btn md:!h-[42px] md:!py-0 md:!text-sm md:!rounded-lg transition-all ${(!isCheckedIn || isFieldCheckedIn || isOnBreak || isPunchBlocked) ? '!bg-gray-100 !text-gray-400 !border-gray-200 pointer-events-none opacity-50 shadow-none' : '!bg-emerald-600 hover:!bg-emerald-700 !text-white shadow-sm'}`}
                                                         disabled={!isCheckedIn || isFieldCheckedIn || isOnBreak || isActionInProgress || isPunchBlocked}
                                                     >
                                                         <MapPin className="mr-2 h-4 w-4" /> Site In
                                                     </Button>
                                                     <Button
                                                         onClick={() => navigate('/attendance/check-out?workType=field')}
                                                         variant="secondary"
                                                         className={`attendance-action-btn md:!h-[42px] md:!py-0 md:!text-sm md:!rounded-lg transition-all ${(!isFieldCheckedIn || isOnBreak || isPunchBlocked) ? '!bg-gray-100 !text-gray-400 !border-gray-200 pointer-events-none opacity-50 shadow-none' : '!bg-transparent hover:!bg-emerald-50 !border-emerald-600 !text-emerald-700'}`}
                                                         disabled={!isFieldCheckedIn || isOnBreak || isActionInProgress || isPunchBlocked}
                                                     >
                                                         <MapPin className="mr-2 h-4 w-4" /> Site Out
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
                                                     className={`attendance-action-btn md:!h-[42px] md:!py-0 md:!text-sm md:!rounded-lg transition-all ${((isFieldStaff ? !isFieldCheckedIn : !isCheckedIn) || isOnBreak || isPunchBlocked) ? '!bg-gray-100 !text-gray-400 !border-gray-200 pointer-events-none opacity-50 shadow-none' : '!bg-transparent hover:!bg-emerald-50 !border-emerald-600 !text-emerald-700'}`}
                                                     disabled={(isFieldStaff ? !isFieldCheckedIn : !isCheckedIn) || isOnBreak || isActionInProgress || isPunchBlocked}
                                                 >
                                                     <CheckCircle className="mr-2 h-4 w-4" /> Break In
                                                 </Button>
                                                 <Button
                                                     onClick={() => navigate('/attendance/break-out')}
                                                     variant="secondary"
                                                     className={`attendance-action-btn md:!h-[42px] md:!py-0 md:!text-sm md:!rounded-lg transition-all ${(!isOnBreak || isPunchBlocked) ? '!bg-gray-100 !text-gray-400 !border-gray-200 pointer-events-none opacity-50 shadow-none' : '!bg-transparent hover:!bg-emerald-50 !border-emerald-600 !text-emerald-700'}`}
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
                    </div> {/* End Side-by-Side Grid */}

                    {/* Passcode Management Desktop */}
                    <div className="md:bg-white md:p-6 md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 transition-shadow">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <Lock className="h-5 w-5 text-amber-600" />
                            </div>
                            <h3 className="text-lg md:text-base font-bold text-gray-900">Security Passcode</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">Manage your 4-digit security passcode for quick authentication.</p>
                        
                        <form onSubmit={handlePasscodeSubmit(onPasscodeSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input 
                                    label="Current Passcode" 
                                    id="oldPasscode-desktop" 
                                    type="password" 
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="Old PIN"
                                    registration={registerPasscode('oldPasscode')}
                                    error={passcodeErrors.oldPasscode?.message}
                                    className="bg-gray-50/50"
                                />
                                <Input 
                                    label="New Passcode" 
                                    id="newPasscode-desktop" 
                                    type="password" 
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="New PIN"
                                    registration={registerPasscode('newPasscode')}
                                    error={passcodeErrors.newPasscode?.message}
                                    className="bg-gray-50/50"
                                />
                                <Input 
                                    label="Confirm Passcode" 
                                    id="confirmPasscode-desktop" 
                                    type="password" 
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="Confirm PIN"
                                    registration={registerPasscode('confirmPasscode')}
                                    error={passcodeErrors.confirmPasscode?.message}
                                    className="bg-gray-50/50"
                                />
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <Info className="h-3.5 w-3.5" />
                                    <span>Must be exactly 4 digits.</span>
                                </div>
                                <Button 
                                    type="submit"
                                    isLoading={isSavingPasscode}
                                    disabled={!isPasscodeDirty}
                                    className="md:!px-8 shadow-md"
                                >
                                    Save Passcode
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Family Details Section (Female employees only) */}
                    {user.gender === 'Female' && (
                        <div className="md:bg-white md:p-6 md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 transition-shadow">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-2 bg-pink-50 rounded-lg">
                                    <Baby className="h-5 w-5 text-pink-600" />
                                </div>
                                <h3 className="text-lg md:text-base font-bold text-gray-900">Family Details</h3>
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
                </div>

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
