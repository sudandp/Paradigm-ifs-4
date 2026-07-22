import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useForm, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { User, UploadedFile, EmployeeScore, UserChild } from '../../types';
import type { GateUser } from '../../types/gate';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { api } from '../../services/api';
import { registerGateUser, uploadGatePhoto } from '../../services/gateApi';
import { dispatchNotificationFromRules } from '../../services/notificationService';
import { User as UserIcon, Loader2, ClipboardList, LogOut, LogIn, Crosshair, CheckCircle, Info, MapPin, AlertTriangle, Clock, Lock, Edit, Camera, Mail, Baby, PlusCircle, Trash2, FileCheck, FileX, Zap, Volume2, Coffee, FileText, Shield, Settings, ArrowLeft, Sparkles, QrCode, Footprints, Maximize, Navigation, HelpCircle, RefreshCw, Home, Bike, Car, Bus, Building2 } from 'lucide-react';
import { AvatarUpload } from '../../components/onboarding/AvatarUpload';
import AlertTonePicker from '../../components/attendance/AlertTonePicker';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { calculateDailyPathTravelKm } from '../../utils/attendanceCalculations';
import CameraCaptureModal from '../../components/CameraCaptureModal';
import HelpTicketModal from '../../components/support/HelpTicketModal';
import Modal from '../../components/ui/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { reverseGeocode, getPrecisePosition } from '../../utils/locationUtils';
import { formatDistance, stepsToDistanceKm } from '../../utils/distanceUtils';
import { isThirdSaturday } from '../../utils/date';

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

const TECHNICAL_ROLE_KEYWORDS = [
    'technical',
    'technician',
    'reliever',
    'electrician',
    'plumber',
    'carpenter',
    'hvac',
    'multitech',
    'maintenance'
];

const isTechnicalAttendanceRole = (role?: string | null) => {
    const normalized = (role || '').toLowerCase();
    return TECHNICAL_ROLE_KEYWORDS.some(keyword => normalized.includes(keyword));
};

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
        isSiteOtCheckedIn,
        breakIntervals,
        hasPreviousDayOpenSession,
        previousDaySessionInfo,
        loginWithPasscode
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

    // Correction Modal States
    const [showCorrectionModal, setShowCorrectionModal] = useState(false);
    const [correctionReason, setCorrectionReason] = useState('');
    const [usedCorrections, setUsedCorrections] = useState(0);

    // Fetch used corrections
    const fetchUsedCorrections = useCallback(async () => {
        if (!user?.id) return;
        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const { data, error } = await supabase
                .from('leave_requests')
                .select('id')
                .eq('user_id', user.id)
                .eq('leave_type', 'Correction')
                .in('status', ['Approved', 'Auto-Approved'])
                .gte('start_date', startOfMonth.toISOString().split('T')[0]);
                
            if (!error && data) {
                setUsedCorrections(data.length);
            }
        } catch (err) {
            console.error('Failed to fetch used corrections', err);
        }
    }, [user?.id]);

    useEffect(() => {
        if (hasPreviousDayOpenSession) {
            fetchUsedCorrections();
        }
    }, [hasPreviousDayOpenSession, fetchUsedCorrections]);

    const handleAutoCheckOut = async (userReason?: string) => {
        triggerHaptic(ImpactStyle.Medium);
        setIsSubmittingAttendance(true);
        try {
            // 1. Fetch current GPS coordinates (we record the location as present,
            //    but the timestamp will be set to end of the missed session day)
            let lat: number | undefined = undefined;
            let lng: number | undefined = undefined;
            try {
                const pos = await getPrecisePosition(150, 10000);
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
            } catch (err) {
                console.warn("Failed to get coordinates for auto check-out:", err);
            }

            // 3. Determine which sessions to close
            const toClose: ('field' | 'office')[] = [];
            if (isFieldCheckedIn) toClose.push('field');
            if (isCheckedIn) toClose.push('office');

            const overrideTimestamp = previousDaySessionInfo?.date ? `${previousDaySessionInfo.date}T23:59:59Z` : undefined;

            let success = true;
            let errMsg = '';
            if (hasPreviousDayOpenSession && previousDaySessionInfo?.date && user) {
                try {
                    const punchInTimeStr = previousDaySessionInfo.firstIn ? previousDaySessionInfo.firstIn.substring(0, 5) : '09:00';
                    const punchOutTimeStr = '23:59';
                    
                    const baseNote = `user clicked for punch out from missed punch-out dialog`;
                    const note = userReason ? `${baseNote}. Reason: ${userReason}` : baseNote;
                    
                    const payload = {
                        userId: user.id,
                        userName: user.name,
                        leaveType: 'Correction',
                        startDate: previousDaySessionInfo.date,
                        endDate: previousDaySessionInfo.date,
                        dayOption: 'full',
                        reason: note,
                        correctionDetails: {
                            status: 'Auto-closed Missed Punch-Out',
                            punchIn: punchInTimeStr,
                            punchOut: punchOutTimeStr
                        }
                    };
                    
                    const newReq = await api.submitLeaveRequest(payload as any);
                    await api.approveLeaveRequest(newReq.id, user.id);
                } catch (correctionErr: any) {
                     success = false;
                     errMsg = correctionErr.message || 'Failed to process Correction for missed punch-out.';
                }
            } else {
                for (const wt of toClose) {
                    const forcedType = wt === 'field' ? 'site-out' : 'punch-out';
                    // Inject the intended session date in brackets so the frontend can properly group it
                    const dateTag = previousDaySessionInfo?.date ? ` [SessionDate: ${previousDaySessionInfo.date}]` : '';
                    const baseNote = wt === 'field'
                        ? `user clicked for site out${dateTag}`
                        : `user clicked for punch out with out applying correction this is the record of punch out${dateTag}`;
                    const note = userReason ? `${baseNote}. Reason: ${userReason}` : baseNote;
                    const res = await toggleCheckInStatus(
                        note,
                        null,
                        wt,
                        undefined,
                        forcedType,
                        undefined,
                        overrideTimestamp
                    );
                    if (!res.success) {
                        success = false;
                        errMsg = res.message;
                    }
                }
            }

            if (success) {
                setToast({ message: 'Previous session closed successfully.', type: 'success' });
            } else {
                setToast({ message: errMsg || 'Failed to close some sessions.', type: 'error' });
            }
            await checkAttendanceStatus();
        } catch (err: any) {
            setToast({ message: err.message || 'Auto check-out failed.', type: 'error' });
        } finally {
            setIsSubmittingAttendance(false);
            setIsPunchOutModalOpen(false);
            setPunchOutReason('');
        }
    };


    const [isSaving, setIsSaving] = useState(false);
    const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
    const [isPunchOutModalOpen, setIsPunchOutModalOpen] = useState(false);
    const [punchOutReason, setPunchOutReason] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
    const [missingPunchReason, setMissingPunchReason] = useState('');
    const [todayMetrics, setTodayMetrics] = useState({
        totalDistance: '0.00',
        travelTime: '0h 0m',
        totalSteps: 0
    });
    const [isMetricsLoading, setIsMetricsLoading] = useState(true);
    const [monthlyMissedPunchesCount, setMonthlyMissedPunchesCount] = useState(0);

    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        const fetchTodayMetrics = async () => {
            setIsMetricsLoading(true);
            try {
                const today = new Date();
                const start = startOfDay(today).toISOString();
                const end = endOfDay(today).toISOString();

                // Fetch both attendance events AND continuous GPS route points (same sources as Route View)
                const [events, routePoints] = await Promise.all([
                    api.getAttendanceEvents(user.id, start, end),
                    api.getRoutePoints(user.id, start, end).catch(() => [])
                ]);

                if (cancelled) return;

                if (events.length === 0 && routePoints.length === 0) {
                    setTodayMetrics({
                        totalDistance: '0.00',
                        travelTime: '0h 0m',
                        totalSteps: 0
                    });
                    return;
                }

                // Calculate travel distance + duration using the same algorithm as Route View:
                // merges attendance events + route_history GPS pings, sorts chronologically,
                // deduplicates points within 5m, and sums the cumulative path distance.
                const { distance, duration } = calculateDailyPathTravelKm(events, routePoints);

                // Steps are captured on check-out events only (saved by stepCounterService on check-out)
                const totalSteps = events
                    .filter(e => (e.type === 'punch-out' || e.type === 'site-ot-out' || e.type === 'site-out') && e.steps != null)
                    .reduce((sum, e) => sum + (e.steps || 0), 0);

                setTodayMetrics({
                    totalDistance: distance.toFixed(2),
                    travelTime: `${Math.floor(duration / 60)}h ${duration % 60}m`,
                    totalSteps
                });
            } catch (err) {
                console.error('Failed to load today metrics:', err);
            } finally {
                if (!cancelled) setIsMetricsLoading(false);
            }
        };

        const fetchMonthlyMissedPunches = async () => {
            try {
                const start = startOfMonth(new Date()).toISOString();
                const end = endOfMonth(new Date()).toISOString();
                const events = await api.getAttendanceEvents(user.id, start, end);
                if (cancelled) return;
                
                const count = events.filter(e => e.checkoutNote && e.checkoutNote.includes('user clicked for punch out with out applying correction this is the record of punch out')).length;
                setMonthlyMissedPunchesCount(count);
            } catch (err) {
                console.error('Failed to load monthly missed punches:', err);
            }
        };

        fetchTodayMetrics();
        fetchMonthlyMissedPunches();
        return () => { cancelled = true; };
    }, [user?.id, isCheckedIn, isFieldCheckedIn, isSiteOtCheckedIn, isOnBreak]);

    const locationParams = useLocation();
    const queryParams = new URLSearchParams(locationParams.search);
    const approveLocationChange = queryParams.get('approveLocationChange');
    const reqUserId = queryParams.get('reqUserId');
    const newLat = queryParams.get('lat');
    const newLon = queryParams.get('lon');
    const newAddr = queryParams.get('address');
    const changeReasonParam = queryParams.get('reason');

    const approveVehicleAdd = queryParams.get('approveVehicleAdd');
    const vehicleTypeParam = queryParams.get('type');
    const brandParam = queryParams.get('brand');
    const ccParam = queryParams.get('cc');
    const odoParam = queryParams.get('odo');
    const imgParam = queryParams.get('img');

    const [gateUser, setGateUser] = useState<GateUser | null>(null);
    const [isGateUserLoading, setIsGateUserLoading] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isHomeLocationOpen, setIsHomeLocationOpen] = useState(false);
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    // Home Location Change Request States
    const [changeReason, setChangeReason] = useState('');
    const [updateCount, setUpdateCount] = useState(0);
    const [requestingUser, setRequestingUser] = useState<User | null>(null);
    const isFirstTime = !user?.homeAddress;

    useEffect(() => {
        const fetchGateData = async () => {
            if (user?.id) {
                try {
                    const { getGateUserByUserId } = await import('../../services/gateApi');
                    const data = await getGateUserByUserId(user.id);
                    setGateUser(data);
                } catch (err) {
                    console.error('[ProfilePage] Failed to fetch gate user data:', err);
                } finally {
                    setIsGateUserLoading(false);
                }
            } else {
                setIsGateUserLoading(false);
            }
        };
        fetchGateData();
    }, [user?.id, isSettingsOpen, isEnrolling]);
    
    // Interactive Hints State
    const [showPunchHint, setShowPunchHint] = useState(false);
    const [showBreakHint, setShowBreakHint] = useState(false);
    
    // Unlock Request State
    const [unlockRequestStatus, setUnlockRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');

    // Employee Scores State
    const [employeeScores, setEmployeeScores] = useState<EmployeeScore | null>(null);
    const [isScoresLoading, setIsScoresLoading] = useState(true);
    
    // Work Mode Selection State
    const [siteWorkMode, setSiteWorkMode] = useState<'duty' | 'ot'>('duty');
    
    

    // Children State (for female employees)
    const [children, setChildren] = useState<UserChild[]>([]);
    const [newChildName, setNewChildName] = useState('');
    const [isChildrenLoading, setIsChildrenLoading] = useState(false);

    // Home Location State
    const [homeLocationName, setHomeLocationName] = useState('');
    const [homeLatitude, setHomeLatitude] = useState('');
    const [homeLongitude, setHomeLongitude] = useState('');
    const [homeAddress, setHomeAddress] = useState('');
    const [isSyncingLocation, setIsSyncingLocation] = useState(false);
    const [isSavingLocation, setIsSavingLocation] = useState(false);

    // Vehicle Type State
    const [vehicleType, setVehicleType] = useState<string>(user?.vehicle_type || 'two_wheeler');
    const [isSavingVehicle, setIsSavingVehicle] = useState(false);

    const [isVehicleDetailsOpen, setIsVehicleDetailsOpen] = useState(false);
    const [vehiclesList, setVehiclesList] = useState<any[]>([]);
    const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);

    const [vehicleBrand, setVehicleBrand] = useState('');
    const [vehicleCC, setVehicleCC] = useState('');
    const [vehicleOdo, setVehicleOdo] = useState('');
    const [vehicleOdoImage, setVehicleOdoImage] = useState<File | null>(null);
    const [odoImagePreview, setOdoImagePreview] = useState<string | null>(null);
    const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);
    const [vehicleChangeReason, setVehicleChangeReason] = useState('');

    const [isOdometerCameraOpen, setIsOdometerCameraOpen] = useState(false);
    const [isDraggingOdo, setIsDraggingOdo] = useState(false);

    const base64ToFile = (base64String: string, filename: string): File => {
        const arr = base64String.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

    const handleOdometerCapture = (base64Image: string, mimeType: string) => {
        try {
            const file = base64ToFile(base64Image, 'odometer.jpg');
            setVehicleOdoImage(file);
            setOdoImagePreview(base64Image);
            setIsOdometerCameraOpen(false);
            setToast({ message: 'Odometer picture captured successfully!', type: 'success' });
        } catch (err) {
            console.error('Failed to convert captured image:', err);
            setToast({ message: 'Failed to process captured image.', type: 'error' });
        }
    };

    const handleOdometerImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setVehicleOdoImage(file);
            setOdoImagePreview(URL.createObjectURL(file));
        }
    };

    const fetchVehicles = useCallback(async () => {
        if (!user?.id) return;
        setIsLoadingVehicles(true);
        try {
            const list = await api.getUserVehicles(user.id);
            setVehiclesList(list);
        } catch (err) {
            console.error("Failed to fetch vehicles:", err);
        } finally {
            setIsLoadingVehicles(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchVehicles();
    }, [fetchVehicles]);

    useEffect(() => {
        if (user?.vehicle_type) setVehicleType(user.vehicle_type);
    }, [user?.vehicle_type]);

    const handleSaveVehicleType = async () => {
        if (!user?.id) return;
        setIsSavingVehicle(true);
        try {
            await api.updateUser(user.id, { vehicle_type: vehicleType as any });
            await updateUserProfile({ vehicle_type: vehicleType as any });
            setToast({ message: 'Vehicle type saved successfully!', type: 'success' });
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to save vehicle type.', type: 'error' });
        } finally {
            setIsSavingVehicle(false);
        }
    };

    const handleAddVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;
        if (!vehicleBrand.trim() || !vehicleOdo.trim() || !vehicleOdoImage) {
            setToast({ message: 'Please fill brand name, odometer reading, and upload odometer picture.', type: 'error' });
            return;
        }

        setIsSubmittingVehicle(true);
        try {
            // 1. Upload odometer picture
            const uploadRes = await api.uploadDocument(vehicleOdoImage, 'onboarding-documents', undefined, 'odometer_picture');
            
            // 2. Check if user already has an approved vehicle
            const activeVehicles = vehiclesList.filter(v => v.status === 'approved');
            const needsApproval = activeVehicles.length >= 1;

            if (needsApproval) {
                if (!vehicleChangeReason.trim()) {
                    setToast({ message: 'Please provide a reason for adding more than 1 vehicle.', type: 'error' });
                    setIsSubmittingVehicle(false);
                    return;
                }

                // Create request notifications for admins and reporting managers
                const { data: admins } = await supabase
                    .from('users')
                    .select('id')
                    .in('role_id', ['admin', 'super_admin', 'developer']);

                const notifyTargets = new Set<string>();
                if (user.reportingManagerId) {
                    notifyTargets.add(user.reportingManagerId);
                }
                if (admins) {
                    admins.forEach(admin => notifyTargets.add(admin.id));
                }

                const notificationMsg = `[Vehicle Add Request] ${user.name} requested to add vehicle "${vehicleBrand}". Reason: "${vehicleChangeReason}"`;
                const reqLink = `/profile?approveVehicleAdd=true&reqUserId=${user.id}&type=${vehicleType}&brand=${encodeURIComponent(vehicleBrand)}&cc=${vehicleCC}&odo=${vehicleOdo}&img=${encodeURIComponent(uploadRes.url)}&reason=${encodeURIComponent(vehicleChangeReason)}`;

                const promises = Array.from(notifyTargets).map(targetId => {
                    return api.createNotification({
                        userId: targetId,
                        message: notificationMsg,
                        type: 'approval_request',
                        linkTo: reqLink
                    });
                });

                await Promise.all(promises);
                setToast({ message: 'Vehicle addition request submitted for approval!', type: 'success' });
            } else {
                // Add directly as approved
                await api.addUserVehicle({
                    userId: user.id,
                    vehicleType,
                    brandName: vehicleBrand,
                    engineCc: vehicleCC ? parseInt(vehicleCC) : null,
                    odometerReading: parseInt(vehicleOdo),
                    odometerPictureUrl: uploadRes.url,
                    status: 'approved'
                });

                setToast({ message: 'Vehicle added successfully!', type: 'success' });
                // Also update active vehicle type in profile
                await api.updateUser(user.id, { vehicle_type: vehicleType as any });
                await updateUserProfile({ vehicle_type: vehicleType as any });
                fetchVehicles();
            }

            // Reset form
            setVehicleBrand('');
            setVehicleCC('');
            setVehicleOdo('');
            setVehicleOdoImage(null);
            setOdoImagePreview(null);
            setVehicleChangeReason('');
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to submit vehicle.', type: 'error' });
        } finally {
            setIsSubmittingVehicle(false);
        }
    };

    useEffect(() => {
        if (user) {
            setHomeLocationName(user.name ? `${user.name} Home` : 'My Home');
            setHomeLatitude(user.homeLatitude != null ? String(user.homeLatitude) : '');
            setHomeLongitude(user.homeLongitude != null ? String(user.homeLongitude) : '');
            setHomeAddress(user.homeAddress || '');
        }
    }, [user]);

    // Fetch approved home location update count for this calendar year
    useEffect(() => {
        if (isHomeLocationOpen && user?.id) {
            const fetchUpdateCount = async () => {
                try {
                    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
                    const { data } = await supabase
                        .from('notifications')
                        .select('id')
                        .eq('user_id', user.id)
                        .ilike('message', '%home location%')
                        .ilike('message', '%approved%')
                        .gte('created_at', startOfYear);
                    setUpdateCount(data ? data.length : 0);
                } catch (e) {
                    console.error('Failed to fetch location update count:', e);
                }
            };
            fetchUpdateCount();
        }
    }, [isHomeLocationOpen, user?.id]);

    // Check for location/vehicle change approval query params on load (Manager/Admin view)
    useEffect(() => {
        if ((approveLocationChange || approveVehicleAdd) && reqUserId) {
            api.getUsers().then(users => {
                const found = users.find(u => u.id === reqUserId);
                if (found) setRequestingUser(found);
            });
        }
    }, [approveLocationChange, approveVehicleAdd, reqUserId]);

    const syncHomeLocationToDashboard = async (userId: string, userName: string, lat: number, lon: number, address: string) => {
        try {
            const userLocs = await api.getUserLocations(userId);
            const locationNameKey = `${userName} Home`;
            const existingHomeLoc = userLocs.find(loc => 
                loc.name?.toLowerCase().includes('home')
            );
            
            if (existingHomeLoc) {
                await api.updateLocation(existingHomeLoc.id, {
                    name: existingHomeLoc.name || locationNameKey,
                    latitude: lat,
                    longitude: lon,
                    radius: 100,
                    address: address || null
                });
            } else {
                const newLoc = await api.createLocation({
                    name: locationNameKey,
                    latitude: lat,
                    longitude: lon,
                    radius: 100,
                    address: address || null,
                    createdBy: userId
                });
                await api.assignLocationToUser(userId, newLoc.id);
            }
        } catch (err) {
            console.error('Failed to sync location to dashboard:', err);
        }
    };

    const handleRequestLocationChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (updateCount >= 3) {
            setToast({ message: 'Maximum 3 updates per calendar year allowed.', type: 'error' });
            return;
        }
        if (!changeReason.trim()) {
            setToast({ message: 'Please provide a reason for updating your address.', type: 'error' });
            return;
        }
        
        setIsSavingLocation(true);
        try {
            // Find admin users
            const { data: admins } = await supabase
                .from('users')
                .select('id')
                .in('role_id', ['admin', 'super_admin', 'developer']);
                
            const notifyTargets = new Set<string>();
            if (user.reportingManagerId) {
                notifyTargets.add(user.reportingManagerId);
            }
            if (admins) {
                admins.forEach(admin => notifyTargets.add(admin.id));
            }
            
            const notificationMsg = `[Location Change Request] ${user.name} requested to change home location. Reason: "${changeReason}"`;
            const reqLink = `/profile?approveLocationChange=true&reqUserId=${user.id}&lat=${homeLatitude}&lon=${homeLongitude}&address=${encodeURIComponent(homeAddress)}&reason=${encodeURIComponent(changeReason)}`;
            
            const promises = Array.from(notifyTargets).map(targetId => {
                return api.createNotification({
                    userId: targetId,
                    message: notificationMsg,
                    type: 'approval_request',
                    linkTo: reqLink
                });
            });
            
            await Promise.all(promises);
            
            setToast({ message: 'Home location change request submitted for approval!', type: 'success' });
            setIsHomeLocationOpen(false);
            setChangeReason('');
        } catch (err: any) {
            console.error(err);
            setToast({ message: err.message || 'Failed to submit request.', type: 'error' });
        } finally {
            setIsSavingLocation(false);
        }
    };

    const handleSyncHomeLocation = async () => {
        setIsSyncingLocation(true);
        setToast({ message: 'Acquiring your precise position, please wait...', type: 'info' });
        try {
            const pos = await getPrecisePosition();
            const { latitude: lat, longitude: lon } = pos.coords;
            const latStr = lat.toFixed(7);
            const lonStr = lon.toFixed(7);
            
            let fetchedAddress = '';
            try {
                fetchedAddress = await reverseGeocode(lat, lon);
            } catch (err) {
                console.warn('Reverse geocode failed:', err);
            }
            
            const confirmMsg = `Acquired Coordinates:\nLatitude: ${latStr}\nLongitude: ${lonStr}\n\nAddress:\n${fetchedAddress || 'Could not resolve address'}\n\nUpdate your home location?`;
            if (window.confirm(confirmMsg)) {
                setHomeLatitude(latStr);
                setHomeLongitude(lonStr);
                if (fetchedAddress) setHomeAddress(fetchedAddress);
                
                setIsSavingLocation(true);
                const updatedUser = await api.updateUser(user.id, {
                    homeLatitude: lat,
                    homeLongitude: lon,
                    homeAddress: fetchedAddress || homeAddress
                });
                await syncHomeLocationToDashboard(user.id, user.name || '', lat, lon, fetchedAddress || homeAddress);
                updateUserProfile(updatedUser);
                setToast({ message: 'Home location synced and saved successfully!', type: 'success' });
                triggerHaptic(ImpactStyle.Medium);
            } else {
                setToast({ message: 'Location sync cancelled.', type: 'info' });
            }
        } catch (err: any) {
            console.error(err);
            const msg = err.message?.toLowerCase().includes('permission') 
                ? 'Location permission denied. Please check settings.' 
                : 'Failed to acquire location. Please try again.';
            setToast({ message: msg, type: 'error' });
        } finally {
            setIsSyncingLocation(false);
            setIsSavingLocation(false);
        }
    };

    const handleSaveHomeLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        const lat = parseFloat(homeLatitude);
        const lon = parseFloat(homeLongitude);
        
        if (isNaN(lat) || isNaN(lon)) {
            setToast({ message: 'Please enter valid numeric coordinates or click Sync.', type: 'error' });
            return;
        }
        
        setIsSavingLocation(true);
        try {
            const updatedUser = await api.updateUser(user.id, {
                homeLatitude: lat,
                homeLongitude: lon,
                homeAddress: homeAddress.trim() || null
            });
            await syncHomeLocationToDashboard(user.id, user.name || '', lat, lon, homeAddress.trim());
            updateUserProfile(updatedUser);
            setToast({ message: 'Home location updated successfully!', type: 'success' });
            triggerHaptic(ImpactStyle.Medium);
        } catch (err: any) {
            console.error(err);
            setToast({ message: err.message || 'Failed to save home location.', type: 'error' });
        } finally {
            setIsSavingLocation(false);
        }
    };

    const handleResetGateAccess = async () => {
        if (!user?.id || !gateUser?.id) return;
        if (!window.confirm('PERMANENT DELETE: This will permanently delete your Gate Access QR code and PIN. You will NOT be able to punch in at any gate kiosk until your profile is re-created. Continue?')) return;
        
        try {
            setIsSaving(true);
            const { deleteGateUser } = await import('../../services/gateApi');
            await deleteGateUser(gateUser.id, user.id);
            setGateUser(null);
            setToast({ message: 'Gate access profile deleted permanently', type: 'success' });
            triggerHaptic(ImpactStyle.Heavy);
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to delete profile', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEnrollmentCapture = async (base64Data: string) => {
        if (!user?.id) return;
        setIsRegistering(true);
        try {
            // 1. Upload photo
            const fileName = `gate_${user.id}_${Date.now()}.jpg`;
            const photoUrl = await uploadGatePhoto(base64Data, 'registration', fileName);
            
            // 2. Register user (passcode/QR generated on server/API)
            const newUser = await registerGateUser({
                userId: user.id,
                photoUrl,
                department: user.department || 'EMPLOYEE'
            });
            
            setGateUser(newUser);
            setIsEnrolling(false);
            setToast({ message: '🎉 Gate Access Activated! Use your QR or PIN at any kiosk.', type: 'success' });
            triggerHaptic(ImpactStyle.Heavy);
        } catch (err: any) {
            console.error('[ProfilePage] Enrollment failed:', err);
            setToast({ message: 'Enrollment failed: ' + err.message, type: 'error' });
        } finally {
            setIsRegistering(false);
        }
    };
    const [newChildDob, setNewChildDob] = useState('');
    const [newChildCert, setNewChildCert] = useState<string | null>(null);

    // Punch Restriction: 1 punch-in per day, unlimited unlock requests (1st=duty, 2nd+=OT)
    const hasPunchedToday = (dailyPunchCount || 0) >= 1;
    const isPunchUnlocked = useAuthStore(s => s.isPunchUnlocked);
    const dailyUnlockRequestCount = useAuthStore(s => s.dailyUnlockRequestCount);
    const approvedUnlockCount = useAuthStore(s => s.approvedUnlockCount);

    const [liveSteps, setLiveSteps] = useState<number>(0);
    useEffect(() => {
        return useAuthStore.subscribe((state) => {
            setLiveSteps(state.liveSteps);
        });
    }, []);
    
    const isThirdSaturdayToday = isThirdSaturday(new Date());
    // Blocked if: (Punched Today OR today is 3rd Saturday) AND Not Currently Checked In (office or field) AND Not Unlocked
    const isPunchBlocked = (hasPunchedToday || isThirdSaturdayToday) && !isCheckedIn && !isFieldCheckedIn && !isSiteOtCheckedIn && !isPunchUnlocked;
    // Combined check-in state: true if user is checked in via either office or field
    const effectivelyCheckedIn = isCheckedIn || isFieldCheckedIn || isSiteOtCheckedIn;

    // Poll attendance status / live steps when checked in
    useEffect(() => {
        if (!effectivelyCheckedIn || !user?.id) return;
        
        const interval = setInterval(() => {
            checkAttendanceStatus(true);
        }, 15000); // Poll every 15 seconds
        
        return () => clearInterval(interval);
    }, [effectivelyCheckedIn, user?.id, checkAttendanceStatus]);
    // Is the next unlock request for OT? (1st request = duty, 2nd+ = OT)
    const isNextRequestOT = dailyUnlockRequestCount >= 1;
    // Technical roles can carry OT/site sessions across midnight.
    const isTechnicalReliever = isTechnicalAttendanceRole(user?.role) || isTechnicalAttendanceRole(user?.roleId);

    const punchHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const breakHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Role Categorization from Settings
    const { attendance: settingsAttendance } = useSettingsStore();
    const configMapping = (settingsAttendance as any)?.missedCheckoutConfig?.roleMapping 
        || (settingsAttendance as any)?.missed_checkout_config?.role_mapping 
        || (settingsAttendance as any)?.missedCheckoutConfig?.role_mapping 
        || (settingsAttendance as any)?.missed_checkout_config?.roleMapping 
        || (settingsAttendance as any)?.roleMapping 
        || (settingsAttendance as any)?.role_mapping;

    const roleMapping = {
        office: configMapping?.office || ['admin', 'hr', 'finance', 'developer', 'hr_ops', 'management', 'back_office_staff', 'accountant', 'finance_manager'],
        field: configMapping?.field || ['field_staff', 'field_officer', 'technical_reliever', 'operation_manager', 'operations_manager', 'bd', 'business_developer'],
        site: configMapping?.site || [
            'site_manager', 'security_guard', 'supervisor', 'technician', 'plumber', 'multitech', 'hvac_technician', 'plumber_carpenter',
            'afm_-_soft', 'associate_facility_manager', 'afm_-_technical', 'asst_facility_manager_operations', 'asst_facility_manager', 'asst_manager_civil_engineer',
            'electrical_supervisor', 'electrician', 'lift_technician'
        ]
    };
    
    const userRoleLower = (user?.role || '').toLowerCase();
    const userRoleIdLower = (user?.roleId || '').toLowerCase();

    const isSiteStaffRole = (roleMapping.site || []).some((r: string) => r.toLowerCase() === userRoleLower || (r.toLowerCase() === userRoleIdLower && userRoleIdLower !== '')) || isTechnicalReliever;
    const isFieldStaffRole = (roleMapping.field || []).some((r: string) => r.toLowerCase() === userRoleLower || (r.toLowerCase() === userRoleIdLower && userRoleIdLower !== ''));
    const isOfficeStaffRole = (roleMapping.office || []).some((r: string) => r.toLowerCase() === userRoleLower || (r.toLowerCase() === userRoleIdLower && userRoleIdLower !== ''));

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

    // Initial load and background sync for attendance
    useEffect(() => {
        checkAttendanceStatus();
        const interval = setInterval(() => checkAttendanceStatus(true), 60000); // silent refresh every minute
        return () => clearInterval(interval);
    }, [checkAttendanceStatus]);

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
            // 1. VERIFICATION STRATEGY: 
            // Try DB check first (fast), but fallback to Auth sign-in check if DB is out of sync.
            const latestPasscode = await api.getUserPasscode(user.id);
            const dbMatches = (latestPasscode || '5687') === formData.oldPasscode;
            
            let verified = dbMatches;
            
            if (!dbMatches) {
                const result = await loginWithPasscode(user.email, formData.oldPasscode, true);
                if (!result.error) {
                    verified = true;
                }
            }

            if (!verified) {
                setToast({ message: 'Current passcode is incorrect.', type: 'error' });
                setIsSavingPasscode(false);
                return;
            }
            
            await api.updateUserPasscode(user.id, formData.newPasscode);
            updateUserProfile({ passcode: formData.newPasscode });
            resetPasscode({ oldPasscode: '', newPasscode: '', confirmPasscode: '' });
            setToast({ message: 'Passcode updated successfully!', type: 'success' });
        } catch (error: any) {
            console.error("Passcode update failed:", error);
            let userMessage = error.message || 'Failed to update passcode.';
            
            if (error.message?.toLowerCase().includes('permission denied')) {
                userMessage = "Permission Denied: Your database role lacks 'EXECUTE' permission for the sync function. Please run the Security Hardening SQL migration or contact an administrator.";
            }
            
            setToast({ message: userMessage, type: 'error' });
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

    if (!user) return <LoadingScreen message="Initializing profile..." />;
    if (isScoresLoading) return <LoadingScreen message="Syncing performance data..." />;

    const avatarFile: UploadedFile | null = user.photoUrl
        ? { preview: user.photoUrl, name: 'Profile Photo', type: 'image/jpeg', size: 0 }
        : null;

    if (isMobileView) {
        return (
            <div className="p-4 space-y-8 md:bg-transparent bg-[#041b0f] w-full overflow-x-hidden relative">
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
                            <AvatarUpload file={avatarFile} onFileChange={handlePhotoChange} hideControls={true} userId={user.id} />
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
                                {user.name}<span className="text-emerald-500">.</span>
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
                        <div className="flex flex-wrap items-center justify-center gap-1 relative z-50 pointer-events-auto">
                            <button 
                                type="button"
                                onClick={() => document.getElementById('avatar-upload')?.click()}
                                className="cursor-pointer px-2 py-1.5 bg-transparent border-none text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-all hover:opacity-70"
                            >
                                <Edit className="w-3 h-3 text-emerald-400" />
                                Change
                            </button>
                            <button 
                                type="button"
                                onClick={() => document.getElementById('avatar-hidden-capture-btn')?.click()}
                                className="px-2 py-1.5 bg-transparent border-none text-rose-500 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-all hover:opacity-70"
                            >
                                <Camera className="w-3 h-3" />
                                Capture
                            </button>
                            <button 
                                type="button"
                                onClick={() => { triggerHaptic(); setIsSettingsOpen(true); }}
                                className="px-2 py-1.5 bg-transparent border-none text-emerald-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-all hover:opacity-70"
                            >
                                <Settings className="w-3 h-3" />
                                Settings
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    triggerHaptic();
                                    if (isMobile) {
                                        setIsHelpModalOpen(true);
                                    } else {
                                        navigate('/support/ticket/new', { state: { from: '/profile' } });
                                    }
                                }}
                                className="px-2 py-1.5 bg-transparent border-none text-amber-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-all hover:opacity-70"
                            >
                                <HelpCircle className="w-3 h-3 text-amber-400" />
                                Help
                            </button>
                            <button 
                                type="button"
                                onClick={() => { triggerHaptic(); setIsHomeLocationOpen(true); }}
                                className="px-2 py-1.5 bg-transparent border-none text-sky-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-all hover:opacity-70"
                            >
                                <Home className="w-3 h-3 text-sky-400" />
                                Home
                            </button>
                            <button 
                                type="button"
                                onClick={() => { triggerHaptic(); setIsVehicleDetailsOpen(true); }}
                                className="px-2 py-1.5 bg-transparent border-none text-amber-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-all hover:opacity-70"
                            >
                                <Bike className="w-3 h-3 text-amber-400" />
                                Vehicle
                            </button>

                        </div>
                    </motion.div>
                </div>

                <div className="space-y-6">



                    {user.role !== 'management' && (
                        <section className="relative">
                            <div className="flex items-center justify-between mb-6 px-2">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-black text-white/90 uppercase tracking-widest flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-emerald-500" /> TIMELINE
                                    </h3>
                                    {hasPreviousDayOpenSession && (
                                        <div className="px-2 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center gap-1.5 animate-pulse">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                            <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Started Yesterday</span>
                                        </div>
                                    )}
                                </div>
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

                                    {/* Daily Activity Stats — role-aware */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {isOfficeStaffRole ? (
                                            /* ── Office Staff: Work Session Stats ── */
                                            <>
                                                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Clock className="h-3.5 w-3.5 text-blue-400" />
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase">Hours Worked</span>
                                                    </div>
                                                    <p className="text-xl font-bold text-white tabular-nums">
                                                        {totalWorkingDurationToday > 0
                                                            ? `${Math.floor(totalWorkingDurationToday)}h ${Math.round((totalWorkingDurationToday % 1) * 60)}m`
                                                            : effectivelyCheckedIn ? <span className="text-emerald-400 animate-pulse text-base">Active</span> : '—'
                                                        }
                                                    </p>
                                                </div>
                                                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Coffee className="h-3.5 w-3.5 text-amber-400" />
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase">Break Time</span>
                                                    </div>
                                                    <p className="text-xl font-bold text-white tabular-nums">
                                                        {totalBreakDurationToday > 0
                                                            ? `${Math.floor(totalBreakDurationToday)}h ${Math.round((totalBreakDurationToday % 1) * 60)}m`
                                                            : '0h 0m'
                                                        }
                                                    </p>
                                                </div>
                                                {/* Daily Steps — full width */}
                                                <div className="col-span-2 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl backdrop-blur-md">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Footprints className="h-3.5 w-3.5 text-emerald-400" />
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase">Daily Steps</span>
                                                    </div>
                                                    <p className="text-xl font-bold text-white tabular-nums flex items-baseline">
                                                        {isMetricsLoading ? '—' : (todayMetrics.totalSteps + (effectivelyCheckedIn ? liveSteps : 0)).toLocaleString()}
                                                        {effectivelyCheckedIn && liveSteps > 0 && (
                                                            <span className="text-sm font-black text-emerald-400 ml-2 animate-pulse">
                                                                ({liveSteps} live)
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            /* ── Field / Site Staff: Activity Metrics ── */
                                            <>
                                                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Footprints className="h-3.5 w-3.5 text-emerald-400" />
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase">Daily Steps</span>
                                                    </div>
                                                    <p className="text-xl font-bold text-white tabular-nums flex items-baseline">
                                                        {isMetricsLoading ? '—' : (todayMetrics.totalSteps + (effectivelyCheckedIn ? liveSteps : 0)).toLocaleString()}
                                                        {effectivelyCheckedIn && liveSteps > 0 && (
                                                            <span className="text-sm font-black text-emerald-400 ml-2 animate-pulse">
                                                                ({liveSteps} live)
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Navigation className="h-3.5 w-3.5 text-blue-400" />
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase">Travel Dist.</span>
                                                    </div>
                                                    <p className="text-xl font-bold text-white tabular-nums">
                                                        {isMetricsLoading ? '—' : formatDistance(parseFloat(todayMetrics.totalDistance))}
                                                    </p>
                                                </div>
                                                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <MapPin className="h-3.5 w-3.5 text-amber-400" />
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase">Travel Time</span>
                                                    </div>
                                                    <p className="text-xl font-bold text-white tabular-nums">
                                                        {isMetricsLoading ? '—' : todayMetrics.travelTime}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ═══ COMMAND CENTER ═══ */}
                    {user.role !== 'management' && (
                        <section className="flex flex-col items-center justify-center py-8 relative">
                            {/* Monthly Missed Punches Banner */}
                            {monthlyMissedPunchesCount > 0 && (
                                <div className="w-full max-w-sm mb-4 px-4">
                                    <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-900/40 to-pink-900/30 backdrop-blur-xl p-3 shadow-lg">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-rose-400" />
                                            <p className="text-xs font-semibold text-rose-100 flex-1">
                                                Auto-closed missed punches this month: <span className="font-black text-white ml-1">{monthlyMissedPunchesCount}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Previous Day Open Session Banner ── */}
                            {hasPreviousDayOpenSession && previousDaySessionInfo && (
                                <div className="w-full max-w-sm mb-6 px-4">
                                    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-900/40 to-orange-900/30 backdrop-blur-xl p-4 shadow-lg">
                                        <div className="absolute inset-0 bg-amber-500/5 animate-pulse" />
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                                                <h4 className="text-sm font-black text-amber-300 uppercase tracking-wider">
                                                    {isCheckedIn && isFieldCheckedIn ? 'Missed Punch Out & Site Out' : isFieldCheckedIn ? 'Missed Site Out' : 'Missed Punch Out'}
                                                </h4>
                                            </div>
                                            <p className="text-xs text-amber-200/80 leading-relaxed mb-3">
                                                You forgot to {isCheckedIn && isFieldCheckedIn ? 'punch out and site out' : isFieldCheckedIn ? 'site out' : 'punch out'} on <span className="font-bold text-white">{new Date(previousDaySessionInfo.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>.
                                                Please close the previous session with current data or apply for correction.
                                            </p>
                                            <div className="flex gap-3 mt-3">
                                                {!isCheckedIn && (
                                                    <button
                                                        disabled={isSubmittingAttendance}
                                                        onClick={() => setShowCorrectionModal(true)}
                                                        className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                    >
                                                        {isSubmittingAttendance ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            isFieldCheckedIn ? 'Site Out' : 'Punch Out'
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    disabled={isSubmittingAttendance}
                                                    onClick={() => navigate(`/leaves/apply?leaveType=Correction&startDate=${previousDaySessionInfo.date}`)}
                                                    className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                >
                                                    Correction
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* ── The Punch Orb ── */}
                            {(isAttendanceLoading && !lastCheckInTime && !lastCheckOutTime) ? (
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
                                        whileTap={{ 
                                            scale: 0.88, 
                                            rotate: -2,
                                            transition: { type: "spring", stiffness: 400, damping: 10 } 
                                        }}
                                        onClick={() => {
                                            triggerHaptic(ImpactStyle.Heavy);
                                            if (isPunchBlocked) {
                                                if (unlockRequestStatus === 'pending') return;
                                                navigate('/attendance/request-unlock');
                                                return;
                                            }
                                            if (effectivelyCheckedIn) {
                                                if (hasPreviousDayOpenSession && isCheckedIn && previousDaySessionInfo) {
                                                    navigate(`/leaves/apply?leaveType=Correction&startDate=${previousDaySessionInfo.date}`);
                                                    return;
                                                }
                                                const wt = isSiteOtCheckedIn ? 'site-ot' : isFieldCheckedIn ? 'field' : 'office';
                                                navigate(`/attendance/check-out?workType=${wt}`);
                                            } else {
                                                navigate('/attendance/check-in?workType=office');
                                            }
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
                                                    (hasPreviousDayOpenSession && isCheckedIn) ? (
                                                        // Missed punch out from previous day -> force correction
                                                        <>
                                                            <AlertTriangle className="h-9 w-9 text-amber-400 mb-1 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                                                            <span className="text-[13px] font-black text-amber-300 tracking-tight leading-tight px-2 text-center font-mono">APPLY{`\n`}CORRECTION</span>
                                                        </>
                                                    ) : (isFieldCheckedIn || isSiteOtCheckedIn) ? (
                                                        // Field/site session active → user must site-out before punching out
                                                        <>
                                                            <MapPin className="h-9 w-9 text-amber-400 mb-1 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                                                            <span className="text-[13px] font-black text-amber-300 tracking-tight leading-tight px-2 text-center">SITE OUT{`\n`}FIRST</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <LogOut className="h-9 w-9 text-rose-500 mb-1 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                                            <span className="text-lg font-black text-white tracking-widest">PUNCH OUT</span>
                                                        </>
                                                    )
                                                ) : isPunchBlocked ? (
                                                    <>
                                                        {unlockRequestStatus === 'pending' ? <Clock className="h-9 w-9 text-amber-400 mb-1" /> : <Lock className="h-9 w-9 text-white mb-1" />}
                                                        <span className="text-[13.5px] font-black text-white tracking-tight leading-tight px-4">
                                                            {unlockRequestStatus === 'pending' ? 'PENDING' : 'REQUEST ACCESS'}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <LogIn className="h-10 w-10 text-[#dcfce7] mb-1 drop-shadow-[0_0_12px_rgba(220,252,231,0.5)] animate-pulse" />
                                                        <span className="text-xl font-black text-white tracking-widest">PUNCH IN</span>
                                                    </>
                                                )}
                                            </motion.div>
                                        </AnimatePresence>
                                        <div className={`absolute bottom-0 left-0 w-full h-1 transition-colors duration-500 ${effectivelyCheckedIn ? ((hasPreviousDayOpenSession && isCheckedIn) ? 'bg-amber-400' : (isFieldCheckedIn || isSiteOtCheckedIn) ? 'bg-amber-400' : 'bg-rose-500') : 'bg-emerald-400'}`} />
                                    </motion.button>
                                </div>
                            )}

                            {/* ── Stale Break Warning (mobile): break-in from previous session, not checked in today ── */}
                            {isOnBreak && !effectivelyCheckedIn && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="w-full mt-6 px-2"
                                >
                                    <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-900/50 to-orange-900/40 backdrop-blur-xl p-4 shadow-lg">
                                        <div className="absolute inset-0 bg-amber-400/5 animate-pulse" />
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Coffee className="w-5 h-5 text-amber-400 flex-shrink-0" />
                                                <h4 className="text-sm font-black text-amber-300 uppercase tracking-wider">Break Not Closed</h4>
                                            </div>
                                            <p className="text-xs text-amber-200/80 leading-relaxed mb-3">
                                                Your break from a <span className="font-bold text-white">previous session</span> was never ended.
                                                You must end it before punching in, or apply for a correction.
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { triggerHaptic(ImpactStyle.Medium); navigate('/attendance/break-out'); }}
                                                    className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                >
                                                    <Coffee className="w-3.5 h-3.5" /> End Break
                                                </button>
                                                <button
                                                    onClick={() => { triggerHaptic(ImpactStyle.Light); navigate('/leaves/apply?leaveType=Correction'); }}
                                                    className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-black uppercase tracking-widest transition-all active:scale-95 border border-amber-500/20 flex items-center justify-center gap-1.5"
                                                >
                                                    <FileText className="w-3.5 h-3.5" /> Correction
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* ── Action Grid: Break / Site / Site OT ── */}
                            {effectivelyCheckedIn && !isPunchBlocked && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    className="w-full mt-8 px-2 space-y-4"
                                >
                                    {/* ── 1. Duty Mode Selector ── */}
                                    {(isFieldStaffRole || isSiteStaffRole) && !(isFieldCheckedIn || isSiteOtCheckedIn) && (
                                        <div className={`flex bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md mb-4 ${isOnBreak ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                                            <button 
                                                onClick={() => { triggerHaptic(); setSiteWorkMode('duty'); }}
                                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all duration-300 ${siteWorkMode === 'duty' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}
                                            >
                                                Regular Duty
                                            </button>
                                            <button 
                                                onClick={() => { triggerHaptic(); setSiteWorkMode('ot'); }}
                                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all duration-300 ${siteWorkMode === 'ot' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400'}`}
                                            >
                                                Overtime (OT)
                                            </button>
                                        </div>
                                    )}

                                    {/* ── 2. Unified Action Links (Site / Break) ── */}
                                    <div className="flex justify-center items-center gap-8 md:gap-12 mt-8 mb-4 w-full">
                                        {/* Site Toggle Card */}
                                        {(isFieldStaffRole || isSiteStaffRole) && (
                                            <motion.button
                                                whileTap={isOnBreak ? {} : { scale: 0.95 }}
                                                animate={(isFieldCheckedIn || isSiteOtCheckedIn) && !isOnBreak ? { 
                                                    scale: [1, 1.05, 1],
                                                    opacity: [0.8, 1, 0.8] 
                                                } : { scale: 1, opacity: 1 }}
                                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                                disabled={isOnBreak}
                                                onClick={() => {
                                                    triggerHaptic();
                                                    if (isFieldCheckedIn || isSiteOtCheckedIn) {
                                                        const mode = isSiteOtCheckedIn ? 'site-ot' : 'field';
                                                        navigate(`/attendance/check-out?workType=${mode}`);
                                                    } else {
                                                        const mode = siteWorkMode === 'ot' ? 'site-ot' : 'field';
                                                        navigate(`/attendance/check-in?workType=${mode}`);
                                                    }
                                                }}
                                                className={`
                                                    flex items-center gap-2 transition-colors
                                                    ${isOnBreak 
                                                        ? 'text-gray-500 opacity-40 cursor-not-allowed' 
                                                        : (isFieldCheckedIn || isSiteOtCheckedIn
                                                            ? 'text-rose-400 hover:text-rose-300' 
                                                            : 'text-[#00c58d] hover:text-[#00c58d]/80')}
                                                `}
                                            >
                                                {isOnBreak ? <Lock className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                                                <span className="text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
                                                    {isOnBreak ? 'Site Locked' : (isFieldCheckedIn || isSiteOtCheckedIn ? 'Site Out' : 'Site In')}
                                                    {(isFieldCheckedIn || isSiteOtCheckedIn) && (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                                    )}
                                                </span>
                                            </motion.button>
                                        )}

                                        {/* Divider */}
                                        {(isFieldStaffRole || isSiteStaffRole) && (
                                            <div className="w-[1px] h-5 bg-white/10 rounded-full" />
                                        )}

                                        {/* Break Toggle Card */}
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            animate={isOnBreak ? { 
                                                scale: [1, 1.05, 1],
                                                opacity: [0.8, 1, 0.8] 
                                            } : { scale: 1, opacity: 1 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                            onClick={() => {
                                                triggerHaptic();
                                                if (isOnBreak) navigate('/attendance/break-out');
                                                else navigate('/attendance/break-in');
                                            }}
                                            className={`
                                                flex items-center gap-2 transition-colors
                                                ${isOnBreak
                                                    ? 'text-amber-400 hover:text-amber-300' 
                                                    : 'text-blue-400 hover:text-blue-300'}
                                            `}
                                        >
                                            <Coffee className="h-4 w-4" />
                                            <span className="text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
                                                {isOnBreak ? 'Resume Work' : 'Take Break'}
                                                {isOnBreak && (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                                                )}
                                            </span>
                                        </motion.button>
                                    </div>

                                    {/* ── 3. Active Session Hint ── */}
                                    <div className="flex items-center justify-center gap-2 pt-2">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">
                                            Active Session Running
                                        </span>
                                    </div>
                                </motion.div>
                            )}

                            {/* Hint Zone */}
                            <div className="mt-6 px-8 text-center min-h-[32px]">
                                {isOnBreak && !effectivelyCheckedIn ? (
                                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-amber-400 uppercase tracking-[0.15em] font-black leading-relaxed animate-pulse">
                                        ☕ end break above to enable punch in
                                    </motion.p>
                                ) : isCheckedIn ? (
                                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} className="text-[10px] text-emerald-200 uppercase tracking-[0.15em] font-black leading-relaxed">
                                        active session · remember to punch out
                                    </motion.p>
                                ) : (
                                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-black leading-relaxed">
                                        tap the orb to register presence
                                    </motion.p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Home Location Modal trigger placeholder — rendered as modal below */}

                    {/* Floating Logout Button */}
                    <div className="flex justify-center mt-4 mb-2 w-full px-8">
                        <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={handleLogoutClick}
                            className="flex items-center justify-center gap-3 py-2 text-rose-500/80 hover:text-rose-500 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Log Out</span>
                        </motion.button>
                    </div>

                    {/* Secondary Management Sections - MOVED to Settings Modal */}

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

                    {/* ═══ HOME LOCATION MODAL (MOBILE) ═══ */}
                        <AnimatePresence>
                            {isHomeLocationOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 100 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 100 }}
                                    className="fixed inset-0 z-[110] bg-[#041b0f] flex flex-col overflow-hidden"
                                >
                                    {/* Header */}
                                    <div className="relative overflow-hidden pt-8 pb-6 px-6 bg-gradient-to-br from-[#0a2133] to-[#041b0f] rounded-b-[40px] shadow-2xl mb-4">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
                                        <div className="relative z-10 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-sky-500/10 rounded-2xl text-sky-400 shadow-inner border border-sky-500/20">
                                                    <Home className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 opacity-60 mb-0.5">
                                                        <MapPin className="w-3 h-3 text-sky-400" />
                                                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white">Location Config</span>
                                                    </div>
                                                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic -mt-1">
                                                        Home<span className="text-sky-400">.</span>
                                                    </h2>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { triggerHaptic(); setIsHomeLocationOpen(false); }}
                                                className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-95 transition-all"
                                            >
                                                <ArrowLeft className="w-5 h-5 text-white" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Form Content */}
                                    <div className="flex-1 overflow-y-auto px-6 py-4">
                                        <form 
                                            onSubmit={async (e) => {
                                                if (isFirstTime) {
                                                    await handleSaveHomeLocation(e);
                                                    setIsHomeLocationOpen(false);
                                                } else {
                                                    await handleRequestLocationChange(e);
                                                }
                                            }} 
                                            className="space-y-5"
                                        >
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Location Name</label>
                                                <input
                                                    type="text"
                                                    value={homeLocationName}
                                                    disabled
                                                    className="form-input bg-white/5 border-white/10 text-sm h-[48px] rounded-2xl w-full text-gray-400 cursor-not-allowed px-4"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Latitude</label>
                                                    <input
                                                        type="text"
                                                        value={homeLatitude}
                                                        onChange={e => setHomeLatitude(e.target.value)}
                                                        className="form-input bg-black/20 border-white/10 text-white text-sm h-[48px] rounded-2xl w-full focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 px-4"
                                                        placeholder="Latitude"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Longitude</label>
                                                    <input
                                                        type="text"
                                                        value={homeLongitude}
                                                        onChange={e => setHomeLongitude(e.target.value)}
                                                        className="form-input bg-black/20 border-white/10 text-white text-sm h-[48px] rounded-2xl w-full focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 px-4"
                                                        placeholder="Longitude"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Home Address</label>
                                                <textarea
                                                    value={homeAddress}
                                                    onChange={e => setHomeAddress(e.target.value)}
                                                    rows={3}
                                                    className="form-input bg-black/20 border-white/10 text-white text-sm py-3 px-4 rounded-2xl w-full resize-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50"
                                                    placeholder="Enter your home address"
                                                />
                                            </div>

                                            {/* Subsequent Change Requests Flow */}
                                            {!isFirstTime && (
                                                <div className="space-y-4 pt-2">
                                                    <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl text-[11px] text-amber-300 space-y-1">
                                                        <p className="font-bold flex items-center gap-1.5">⚠️ Calendar Year Update Limit</p>
                                                        <p>You can update your home location only 3 times per calendar year.</p>
                                                        <p>Approved updates this year: <strong className="text-white">{updateCount} / 3</strong></p>
                                                    </div>
                                                    {updateCount >= 3 ? (
                                                        <div className="text-rose-400 font-bold text-xs p-3 text-center bg-rose-500/10 rounded-2xl border border-rose-500/20">
                                                            You have reached the maximum limit of 3 home location updates for this calendar year.
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1.5">Reason for Updating Address</label>
                                                            <textarea
                                                                value={changeReason}
                                                                onChange={e => setChangeReason(e.target.value)}
                                                                rows={2}
                                                                required
                                                                className="form-input bg-black/20 border-white/10 text-white text-sm py-3 px-4 rounded-2xl w-full resize-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                                                                placeholder="Please explain why you are updating your home address..."
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex gap-3 pt-4 border-t border-white/5">
                                                <Button
                                                    type="button"
                                                    onClick={handleSyncHomeLocation}
                                                    isLoading={isSyncingLocation}
                                                    variant="outline"
                                                    className="flex-1 !h-[48px] text-xs font-bold uppercase tracking-wider !border-white/10 !text-white hover:!bg-white/5 !rounded-2xl"
                                                >
                                                    <Navigation className="w-3.5 h-3.5 mr-1.5" />
                                                    Sync Location
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    isLoading={isSavingLocation}
                                                    disabled={!isFirstTime && (updateCount >= 3 || !changeReason.trim())}
                                                    className={`flex-1 !h-[48px] text-xs font-bold uppercase tracking-wider !rounded-2xl ${
                                                        !isFirstTime ? '!bg-amber-600 hover:!bg-amber-700' : '!bg-sky-600 hover:!bg-sky-700'
                                                    } text-white`}
                                                >
                                                    {isFirstTime ? 'Save' : 'Request Update'}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                    {/* ═══ VEHICLE DETAILS MODAL (MOBILE) ═══ */}
                    <AnimatePresence>
                        {isVehicleDetailsOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 100 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 100 }}
                                className="fixed inset-0 z-[110] bg-[#041b0f] flex flex-col overflow-hidden text-white"
                            >
                                {/* Header */}
                                <div className="relative overflow-hidden pt-8 pb-6 px-6 bg-gradient-to-br from-[#0a2133] to-[#041b0f] rounded-b-[40px] shadow-2xl mb-4">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
                                    <div className="relative z-10 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 shadow-inner border border-amber-500/20">
                                                <Bike className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5 opacity-60 mb-0.5">
                                                    <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white">Vehicle Config</span>
                                                </div>
                                                <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic -mt-1">
                                                    My Vehicle<span className="text-amber-400">.</span>
                                                </h2>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { triggerHaptic(); setIsVehicleDetailsOpen(false); }}
                                            className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-95 transition-all"
                                        >
                                            <ArrowLeft className="w-5 h-5 text-white" />
                                        </button>
                                    </div>
                                </div>

                                {/* Form & List Content */}
                                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                                    {/* Vehicles List */}
                                    {isLoadingVehicles ? (
                                        <div className="py-4 text-center text-xs text-gray-400">Loading vehicles...</div>
                                    ) : vehiclesList.length === 0 ? (
                                        <div className="py-6 text-center text-xs text-gray-400 border border-dashed border-white/10 rounded-2xl bg-white/5">
                                            No vehicles registered. Please add one below.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Registered Vehicles</h3>
                                            {vehiclesList.map((v) => (
                                                <div key={v.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white/10 rounded-xl">
                                                            {v.vehicle_type === 'two_wheeler' ? <Bike className="w-5 h-5 text-amber-400" /> : <Car className="w-5 h-5 text-blue-400" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{v.brand_name}</p>
                                                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
                                                                {v.vehicle_type.replace('_', ' ')} {v.engine_cc ? `• ${v.engine_cc}cc` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold text-white">{v.odometer_reading.toLocaleString()} km</p>
                                                        <span className={`inline-block px-2 py-0.5 text-[8px] font-black uppercase rounded-md tracking-wider mt-1.5 ${
                                                            v.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                        }`}>
                                                            {v.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add Vehicle Form */}
                                    {(vehiclesList.length === 0 || vehiclesList.filter(v => v.status === 'approved').length >= 1) && (
                                        <form onSubmit={async (e) => {
                                            await handleAddVehicle(e);
                                            setIsVehicleDetailsOpen(false);
                                        }} className="space-y-4 pt-4 border-t border-white/5">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                                                {vehiclesList.filter(v => v.status === 'approved').length >= 1 
                                                    ? 'Request Another Vehicle' 
                                                    : 'Add First Vehicle'}
                                            </h3>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Vehicle Type</label>
                                                <select
                                                    value={vehicleType}
                                                    onChange={e => setVehicleType(e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded-2xl text-white text-sm h-[48px] px-4"
                                                >
                                                    <option value="two_wheeler">Two Wheeler</option>
                                                    <option value="four_wheeler_petrol">4W Petrol</option>
                                                    <option value="four_wheeler_diesel">4W Diesel</option>
                                                    <option value="public_transport">Public Transport</option>
                                                    <option value="company_vehicle">Company Vehicle</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Brand Name</label>
                                                <input
                                                    type="text"
                                                    value={vehicleBrand}
                                                    onChange={e => setVehicleBrand(e.target.value)}
                                                    placeholder="e.g. Honda Activa, Suzuki Swift"
                                                    className="w-full bg-black/20 border border-white/10 rounded-2xl text-white text-sm h-[48px] px-4"
                                                    required
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                {vehicleType === 'two_wheeler' && (
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Engine CC</label>
                                                        <input
                                                            type="number"
                                                            value={vehicleCC}
                                                            onChange={e => setVehicleCC(e.target.value)}
                                                            placeholder="e.g. 125"
                                                            className="w-full bg-black/20 border border-white/10 rounded-2xl text-white text-sm h-[48px] px-4"
                                                        />
                                                    </div>
                                                )}
                                                <div className={vehicleType !== 'two_wheeler' ? 'col-span-2' : ''}>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Odometer Reading (KM)</label>
                                                    <input
                                                        type="number"
                                                        value={vehicleOdo}
                                                        onChange={e => setVehicleOdo(e.target.value)}
                                                        placeholder="e.g. 8450"
                                                        className="w-full bg-black/20 border border-white/10 rounded-2xl text-white text-sm h-[48px] px-4"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Odometer Picture</label>
                                                <input 
                                                    id="odometer-file-input" 
                                                    type="file" 
                                                    className="sr-only" 
                                                    onChange={handleOdometerImageChange} 
                                                    accept="image/*"
                                                />
                                                {odoImagePreview ? (
                                                    <div className="w-full bg-[#07160E] border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[180px] relative overflow-hidden group">
                                                        <div className="relative w-full h-[150px] bg-black/40 rounded-xl overflow-hidden flex items-center justify-center border border-white/10">
                                                            <img 
                                                                src={odoImagePreview} 
                                                                alt="Odometer Preview" 
                                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                                            />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                                <label 
                                                                    htmlFor="odometer-file-input" 
                                                                    className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl cursor-pointer transition-all active:scale-95"
                                                                    title="Change Photo"
                                                                >
                                                                    <RefreshCw className="h-5 w-5 text-white" />
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setVehicleOdoImage(null);
                                                                        setOdoImagePreview(null);
                                                                    }}
                                                                    className="p-2.5 bg-rose-500/20 hover:bg-rose-500/30 backdrop-blur-md rounded-xl transition-all active:scale-95"
                                                                    title="Remove Photo"
                                                                >
                                                                    <Trash2 className="h-5 w-5 text-rose-400" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="w-full mt-2 flex justify-between items-center px-1 text-[10px] font-bold text-gray-400">
                                                            <span className="truncate max-w-[180px]">{vehicleOdoImage?.name || 'odometer.jpg'}</span>
                                                            <span>{vehicleOdoImage ? `${(vehicleOdoImage.size / (1024 * 1024)).toFixed(2)} MB` : 'Captured'}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div 
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            setIsDraggingOdo(true);
                                                        }}
                                                        onDragLeave={(e) => {
                                                            e.preventDefault();
                                                            setIsDraggingOdo(false);
                                                        }}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setIsDraggingOdo(false);
                                                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                                const file = e.dataTransfer.files[0];
                                                                setVehicleOdoImage(file);
                                                                setOdoImagePreview(URL.createObjectURL(file));
                                                            }
                                                        }}
                                                        className={`w-full bg-[#07160E] border border-dashed rounded-2xl p-6 flex flex-col items-center justify-center min-h-[180px] transition-all relative ${
                                                            isDraggingOdo 
                                                                ? 'border-emerald-500 bg-[#0C2417]' 
                                                                : 'border-white/10 hover:border-emerald-500/50 hover:bg-[#091F14]'
                                                        }`}
                                                    >
                                                        <label htmlFor="odometer-file-input" className="absolute inset-0 cursor-pointer z-0" />
                                                        <div className="relative z-10 flex flex-col items-center text-center w-full pointer-events-none mb-1">
                                                            <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 mb-3">
                                                                <Camera className="h-8 w-8 text-emerald-400" />
                                                            </div>
                                                            <p className="font-bold text-white text-sm">Click to upload</p>
                                                            <p className="text-[10px] font-semibold mt-1 uppercase tracking-wider text-gray-500">or drag & drop</p>
                                                        </div>
                                                        
                                                        <div className="relative z-10 flex items-center w-full max-w-[140px] my-3 pointer-events-none">
                                                            <div className="h-px flex-1 bg-white/10"></div>
                                                            <span className="px-3 text-[10px] font-semibold text-gray-500">OR</span>
                                                            <div className="h-px flex-1 bg-white/10"></div>
                                                        </div>
                                                        
                                                        <button 
                                                            type="button" 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                setIsOdometerCameraOpen(true); 
                                                            }} 
                                                            className="relative z-10 flex items-center justify-center font-bold text-white hover:text-white/80 transition-colors text-xs py-1.5 px-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 active:scale-95"
                                                        >
                                                            <Camera className="h-4 w-4 mr-2 text-rose-500" />
                                                            Capture with Camera
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {vehiclesList.filter(v => v.status === 'approved').length >= 1 && (
                                                <div className="space-y-2 pt-2">
                                                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-[11px] text-amber-300 space-y-1">
                                                        <p className="font-bold flex items-center gap-1.5">⚠️ Limit Exceeded</p>
                                                        <p>Adding another vehicle requires approval from your manager or admin.</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1.5">Reason for Request</label>
                                                        <textarea
                                                            value={vehicleChangeReason}
                                                            onChange={e => setVehicleChangeReason(e.target.value)}
                                                            rows={2}
                                                            className="w-full bg-black/20 border border-white/10 rounded-2xl text-white text-sm py-3 px-4 resize-none"
                                                            placeholder="Why do you need to add an additional vehicle?"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="pt-4 border-t border-white/5">
                                                <Button
                                                    type="submit"
                                                    isLoading={isSubmittingVehicle}
                                                    className={`w-full !h-[48px] text-xs font-bold uppercase tracking-wider !rounded-2xl text-white ${
                                                        vehiclesList.filter(v => v.status === 'approved').length >= 1 
                                                            ? '!bg-amber-600 hover:!bg-amber-700' 
                                                            : '!bg-emerald-600 hover:!bg-emerald-700'
                                                    }`}
                                                >
                                                    {vehiclesList.filter(v => v.status === 'approved').length >= 1 
                                                        ? 'Request Approval' 
                                                        : 'Save Vehicle'}
                                                </Button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ═══ SETTINGS MODAL (MOBILE) ═══ */}

                        <AnimatePresence>
                            {isSettingsOpen && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 100 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 100 }}
                                    className="fixed inset-0 z-[110] bg-[#041b0f] flex flex-col overflow-hidden"
                                >
                            {/* Premium Mobile Header (Matching Profile Header) */}
                            <div className="relative overflow-hidden pt-8 pb-6 px-6 bg-gradient-to-br from-[#0a2f1c] to-[#041b0f] rounded-b-[40px] shadow-2xl mb-4">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
                                
                                <div className="relative z-10 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 shadow-inner border border-emerald-500/20">
                                            <Settings className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 opacity-60 mb-0.5">
                                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white">System Config</span>
                                            </div>
                                            <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic -mt-1">
                                                Settings<span className="text-emerald-500">.</span>
                                            </h2>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => { triggerHaptic(); setIsSettingsOpen(false); }}
                                        className="p-3 rounded-full bg-white/5 text-white hover:bg-white/10 active:scale-90 transition-all border border-white/10"
                                    >
                                        <ArrowLeft className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-32">
                                <div className="relative z-10 space-y-6">
                                    {/* 1. Gate Access Security Card */}
                                    <section>
                                        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-[32px] p-6 relative overflow-hidden shadow-2xl">
                                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                                <QrCode className="w-20 h-20 text-emerald-400" />
                                            </div>
                                            <div className="relative z-10 space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <h3 className="text-white font-black uppercase tracking-widest text-[11px] opacity-40">Gate Access</h3>
                                                        <div className="text-white font-black uppercase tracking-tighter italic text-2xl leading-none">Security Identity</div>
                                                        {gateUser?.createdAt && (
                                                            <div className="flex items-center gap-1.5 mt-1 text-[8px] font-black uppercase tracking-widest text-emerald-400/60">
                                                                <Clock className="w-2 h-2" />
                                                                Enrolled: {new Date(gateUser.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!gateUser && (
                                                        <button 
                                                            onClick={() => setIsEnrolling(true)}
                                                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
                                                        >
                                                            Get Access
                                                        </button>
                                                    )}
                                                    {gateUser?.passcode && (
                                                        <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 rounded-2xl px-4 py-2 flex flex-col items-center shadow-lg">
                                                            <div className="text-[8px] text-emerald-400 font-black uppercase tracking-[0.2em] mb-1">Access PIN</div>
                                                            <div className="text-2xl font-black text-white tracking-[0.2em] font-mono leading-none">{gateUser.passcode}</div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-4 bg-white rounded-3xl flex items-center justify-center shadow-inner min-h-[160px]">
                                                    {isGateUserLoading ? (
                                                        <div className="w-32 h-32 flex items-center justify-center">
                                                            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                                                        </div>
                                                    ) : gateUser?.qrToken ? (
                                                        <img 
                                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${gateUser.qrToken}`} 
                                                            alt="Access QR" 
                                                            className="w-32 h-32"
                                                        />
                                                    ) : (
                                                        <div 
                                                            onClick={() => !gateUser && setIsEnrolling(true)}
                                                            className={`w-32 h-32 flex flex-col items-center justify-center text-slate-300 ${!gateUser ? 'cursor-pointer hover:bg-white/10 rounded-3xl transition-colors' : ''}`}
                                                        >
                                                            <QrCode className="w-16 h-16 opacity-20" />
                                                            {!gateUser && <span className="text-[8px] font-black uppercase mt-2 opacity-40">Setup Access</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-white/40 text-center font-bold uppercase tracking-widest leading-relaxed">
                                                    Use this QR or PIN at any Paradigm Gate Kiosk for rapid attendance marking.
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    {/* 2. Identity Details */}
                                    <section className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-[32px] p-6 shadow-2xl">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                                                <UserIcon className="h-5 w-5" />
                                            </div>
                                            <h3 className="text-sm font-black uppercase tracking-[0.2em] italic text-white/80">Identity Matrix</h3>
                                        </div>
                                        <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-5">
                                            <div className="space-y-4">
                                                <Input label="Name" id="name" registration={register('name')} className="bg-black/40 border-white/10 text-white !rounded-xl !h-12 text-sm font-bold placeholder:text-white/20" />
                                                <Input label="Phone" id="phone" type="tel" registration={register('phone')} className="bg-black/40 border-white/10 text-white !rounded-xl !h-12 text-sm font-bold placeholder:text-white/20" />
                                                <Select label="Gender" id="gender" registration={register('gender')} className="bg-black/40 border-white/10 text-white !rounded-xl !h-12 text-sm font-bold placeholder:text-white/20">
                                                    <option value="" disabled className="text-gray-500 bg-[#041b0f]">Select Gender</option>
                                                    <option value="Male" className="bg-[#041b0f] text-white">Male</option>
                                                    <option value="Female" className="bg-[#041b0f] text-white">Female</option>
                                                    <option value="Other" className="bg-[#041b0f] text-white">Other</option>
                                                </Select>
                                            </div>
                                            <Button type="submit" isLoading={isSaving} disabled={!isDirty} className="w-full !bg-emerald-600 !h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] mt-2 italic shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">Update Identity</Button>
                                        </form>
                                    </section>

                                    {/* 3. Security Pin */}
                                    <section className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-[32px] p-6 shadow-2xl">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                                                <Lock className="h-5 w-5" />
                                            </div>
                                            <h3 className="text-sm font-black uppercase tracking-[0.2em] italic text-white/80">Security Pin</h3>
                                        </div>
                                        <form onSubmit={handlePasscodeSubmit(onPasscodeSubmit)} className="space-y-5">
                                            <Input label="Current Pin" id="oldPasscode" type="password" registration={registerPasscode('oldPasscode')} className="bg-black/40 border-white/10 text-white !rounded-xl !h-12 text-sm font-bold" />
                                            <Input label="New Pin" id="newPasscode" type="password" inputMode="numeric" maxLength={4} registration={registerPasscode('newPasscode')} className="bg-black/40 border-white/10 text-white !rounded-xl !h-12 text-sm font-bold" />
                                            <Button type="submit" isLoading={isSavingPasscode} disabled={!isPasscodeDirty} className="w-full !bg-amber-600 !h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] mt-2 italic shadow-lg shadow-amber-900/20 active:scale-95 transition-all">Change Access Pin</Button>
                                        </form>
                                    </section>

                                    {/* 4. Alert Tone */}
                                    <section className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-[32px] p-6 shadow-2xl">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                                                <Volume2 className="h-5 w-5" />
                                            </div>
                                            <h3 className="text-sm font-black uppercase tracking-[0.2em] italic text-white/80">Audio Alerts</h3>
                                        </div>
                                        <AlertTonePicker />
                                    </section>
                                </div>
                            </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {isEnrolling && (
                            <CameraCaptureModal
                                isOpen={isEnrolling}
                                onClose={() => setIsEnrolling(false)}
                                onCapture={handleEnrollmentCapture}
                                captureGuidance="profile"
                                isLoading={isRegistering}
                            />
                        )}

                        <HelpTicketModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
                </div>
        );
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
                        <AvatarUpload file={avatarFile} onFileChange={handlePhotoChange} userId={user.id} />
                    </div>
                    
                    {/* User Info aligned next to the avatar */}
                    <div className="text-center md:text-left flex-1 md:pb-0 md:pr-[260px] lg:pr-[300px]">
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                             <h2 className="text-2xl font-bold text-gray-900 md:text-white tracking-tight">{user.name}</h2>
                             <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/20 text-white text-xs font-bold uppercase tracking-widest shadow-sm">
                                {getRoleName(user.role)}
                             </span>
                        </div>
                        <div className="mt-1.5 text-sm font-normal text-gray-500 md:text-white md:opacity-90 inline-flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 flex-shrink-0 hidden md:inline-block" />
                            {user.email}
                        </div>
                        
                        {/* Desktop Avatar Controls — standardized design system */}
                        <div className="mt-5 hidden md:flex flex-wrap items-center justify-start gap-3">
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
                            <button 
                                type="button"
                                onClick={() => { triggerHaptic(); setIsSettingsOpen(true); }}
                                className="inline-flex items-center justify-center h-9 px-4 rounded-lg border-2 border-emerald-600/20 bg-emerald-50 text-emerald-700 text-sm font-semibold shadow-sm transition-all duration-200 ease-in-out hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                            >
                                <Settings className="w-4 h-4 mr-2 flex-shrink-0" />
                                Profile Settings
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

                    {/* Missed Punch-Out Correction Modal */}
                    {showCorrectionModal && previousDaySessionInfo && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                                    <div className="p-2 bg-rose-100 rounded-lg">
                                        <AlertTriangle className="h-5 w-5 text-rose-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">Close Previous Session</h3>
                                        <p className="text-xs text-gray-500">You forgot to punch out on {new Date(previousDaySessionInfo.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}.</p>
                                    </div>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 space-y-2">
                                        <p className="text-sm text-orange-900">
                                            You checked in at <strong className="font-mono">{previousDaySessionInfo.firstIn}</strong>.
                                        </p>
                                        <p className="text-sm text-orange-900">
                                            By punching out now, your checkout time will be recorded as <strong className="font-mono">23:59</strong>, and you will have worked <strong>{previousDaySessionInfo.workingHours?.toFixed(1) || 0} hours</strong>.
                                        </p>
                                    </div>
                                    
                                    <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                                        <p className="text-xs text-blue-900 font-medium">
                                            Correction handled by Paradigm AI. You have used <strong className="text-blue-700">{usedCorrections} / {((settingsAttendance as any)?.[user?.role === 'office' ? 'office' : 'field']?.maxCorrectionsPerMonth) ?? 3}</strong> corrections this month.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Mention Reason <span className="text-rose-500">*</span></label>
                                        <input 
                                            type="text"
                                            value={correctionReason}
                                            onChange={(e) => setCorrectionReason(e.target.value)}
                                            placeholder="e.g., Forgot to punch out"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                                    <button 
                                        onClick={() => setShowCorrectionModal(false)}
                                        className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
                                        disabled={isSubmittingAttendance}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (!correctionReason.trim()) {
                                                setToast({ message: 'Please mention a reason.', type: 'error' });
                                                return;
                                            }
                                            setShowCorrectionModal(false);
                                            handleAutoCheckOut(correctionReason);
                                        }}
                                        disabled={!correctionReason.trim() || isSubmittingAttendance}
                                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        {isSubmittingAttendance && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Submit & Punch Out
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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
                                        <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> First In
                                        </div>
                                        <p className="text-lg font-bold text-gray-900 font-mono tracking-tight">{formatTime(hasPreviousDayOpenSession && previousDaySessionInfo?.firstIn ? previousDaySessionInfo.firstIn : lastCheckInTime)}</p>
                                    </div>
                                    <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                                        <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Last Out
                                        </div>
                                        <p className="text-lg font-bold text-gray-900 font-mono tracking-tight">{formatTime(hasPreviousDayOpenSession && previousDaySessionInfo?.lastOut ? previousDaySessionInfo.lastOut : lastCheckOutTime)}</p>
                                    </div>
                                    <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                                        <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> First B-In
                                        </div>
                                        <p className="text-lg font-bold text-gray-900 font-mono tracking-tight">{formatTime(hasPreviousDayOpenSession && previousDaySessionInfo?.firstBreakIn ? previousDaySessionInfo.firstBreakIn : firstBreakInTime)}</p>
                                    </div>
                                    <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                                        <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Last B-Out
                                        </div>
                                        <p className="text-lg font-bold text-gray-900 font-mono tracking-tight">{formatTime(hasPreviousDayOpenSession && previousDaySessionInfo?.lastBreakOut ? previousDaySessionInfo.lastBreakOut : lastBreakOutTime)}</p>
                                    </div>
                                </div>

                                {isAttendanceLoading ? (
                                    <div className="flex items-center justify-center h-[56px] md:h-[40px] bg-gray-50 rounded-xl"><Loader2 className="h-6 w-6 md:h-4 md:w-4 animate-spin text-gray-400" /></div>
                                ) : (
                                    <div className="space-y-6 md:space-y-3">
                                            {/* Desktop: Previous Day Open Session Warning */}
                                            {hasPreviousDayOpenSession && previousDaySessionInfo && (
                                                <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 mb-2">
                                                    <div className="flex items-start gap-2">
                                                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                                        <div className="flex-1">
                                                            <p className="text-xs font-bold text-amber-800">Open Session from {new Date(previousDaySessionInfo.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                                            <p className="text-[10px] text-amber-700 mt-0.5">Last: {previousDaySessionInfo.lastEventType.replace(/-/g, ' ')} at {previousDaySessionInfo.lastEventTime}. Close session or apply for correction.</p>
                                                            <div className="flex gap-1.5 mt-2">
                                                                {isSiteOtCheckedIn && (
                                                                    <Button onClick={() => navigate('/attendance/check-out?workType=field&forcedType=site-ot-out')} variant="primary" className="!h-7 !text-[10px] !px-2.5 !bg-indigo-600 hover:!bg-indigo-700">
                                                                        Site OT Out
                                                                    </Button>
                                                                )}
                                                                {!isSiteOtCheckedIn && (
                                                                     <Button 
                                                                         onClick={() => setIsPunchOutModalOpen(true)} 
                                                                         isLoading={isSubmittingAttendance}
                                                                         variant="danger" 
                                                                         className="!h-7 !text-[10px] !px-2.5"
                                                                     >
                                                                         {previousDaySessionInfo.lastEventType.includes('site') ? 'Site Out' : 'Punch Out'}
                                                                     </Button>
                                                                 )}
                                                                <Button onClick={() => navigate(`/leaves/apply?leaveType=Correction&startDate=${previousDaySessionInfo.date}`)} variant="secondary" className="!h-7 !text-[10px] !px-2.5">
                                                                    Apply Correction
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                             {/* ── Stale Break Warning (desktop): break-in from previous session, not checked in today ── */}
                                             {isOnBreak && !effectivelyCheckedIn && (
                                                 <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 mb-2">
                                                     <div className="flex items-start gap-2">
                                                         <Coffee className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                                         <div className="flex-1">
                                                             <p className="text-xs font-bold text-amber-800">Unclosed Break from Previous Session</p>
                                                             <div className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                                                                 You forgot to end your break. End it now to enable punch-in, or apply for a correction if hours need adjustment.
                                                             </div>
                                                             <div className="flex gap-1.5 mt-2">
                                                                 <Button
                                                                     onClick={() => navigate('/attendance/break-out')}
                                                                     variant="primary"
                                                                     className="!h-7 !text-[10px] !px-2.5 !bg-amber-500 hover:!bg-amber-600"
                                                                 >
                                                                     <Coffee className="mr-1 h-3 w-3" /> End Break Now
                                                                 </Button>
                                                                 <Button
                                                                     onClick={() => navigate(`/leaves/apply?leaveType=Correction${previousDaySessionInfo ? `&startDate=${previousDaySessionInfo.date}` : ''}`)}
                                                                     variant="secondary"
                                                                     className="!h-7 !text-[10px] !px-2.5"
                                                                 >
                                                                     <FileText className="mr-1 h-3 w-3" /> Apply Correction
                                                                 </Button>
                                                             </div>
                                                         </div>
                                                     </div>
                                                 </div>
                                             )}

                                             {/* ── 1. Primary Session Toggle (Punch In/Out) ── */}
                                             <div className="w-full">
                                                {!effectivelyCheckedIn ? (
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
                                                                    // Warm up GPS
                                                                    import('../../utils/locationUtils').then(m => m.getPrecisePosition(150, 15000).catch(() => {}));
                                                                    navigate('/attendance/check-in');
                                                                }
                                                            }}
                                                            variant="primary"
                                                            className={`w-full !h-12 !rounded-2xl transition-all font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-900/20 ${
                                                                isPunchBlocked ? '!bg-amber-600' : '!bg-emerald-600 hover:!bg-emerald-700 '
                                                            } ${(isOnBreak && !effectivelyCheckedIn) || isActionInProgress || (isPunchBlocked && unlockRequestStatus === 'pending') ? '!bg-gray-100 !text-gray-700 !border-gray-200 pointer-events-none shadow-none' : ''}`}
                                                            disabled={(isOnBreak && !effectivelyCheckedIn) || isActionInProgress || (isPunchBlocked && unlockRequestStatus === 'pending')}
                                                        >
                                                           {isPunchBlocked ? (
                                                                unlockRequestStatus === 'pending' 
                                                                  ? <Clock className="mr-2 h-4 w-4" /> 
                                                                  : <Lock className="mr-2 h-4 w-4" />
                                                           ) : <LogIn className="mr-2 h-4 w-4 animate-pulse" />}
                                                           {isPunchBlocked 
                                                               ? (unlockRequestStatus === 'pending' ? 'Pending Approval' : 'Request Punch In') 
                                                               : 'Punch In'}
                                                        </Button>
                                                        {!isPunchBlocked && !isOnBreak && !isActionInProgress && (
                                                            <div className="absolute -top-1 -right-1 flex h-3 w-3">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Button
                                                        onClick={() => {
                                                            if (hasPreviousDayOpenSession) {
                                                                if (isCheckedIn && previousDaySessionInfo) {
                                                                    navigate(`/leaves/apply?leaveType=Correction&startDate=${previousDaySessionInfo.date}`);
                                                                } else {
                                                                    handleAutoCheckOut();
                                                                }
                                                            } else {
                                                                // Normal flow: navigate to confirmation page
                                                                import('../../utils/locationUtils').then(m => m.getPrecisePosition(150, 15000).catch(() => {}));
                                                                const targetWorkType = (isFieldCheckedIn || isSiteOtCheckedIn) ? 'field' : 'office';
                                                                navigate(`/attendance/check-out?workType=${targetWorkType}`);
                                                            }
                                                        }}

                                                        variant="danger"
                                                        className={`w-full !h-12 !rounded-2xl transition-all font-black uppercase tracking-widest text-sm shadow-xl ${
                                                            isOnBreak || isActionInProgress
                                                                ? 'shadow-none !bg-gray-100 !text-gray-400 !border-gray-200 pointer-events-none'
                                                                : (hasPreviousDayOpenSession && isCheckedIn)
                                                                    ? 'shadow-amber-900/10 !bg-amber-500 hover:!bg-amber-600'
                                                                    : (isFieldCheckedIn || isSiteOtCheckedIn)
                                                                        ? 'shadow-amber-900/10 !bg-amber-500 hover:!bg-amber-600'
                                                                        : 'shadow-red-900/10'
                                                        }`}
                                                        disabled={isOnBreak || isActionInProgress}
                                                    >
                                                        {(hasPreviousDayOpenSession && isCheckedIn) ? (
                                                            <><AlertTriangle className="mr-2 h-4 w-4" /> Apply Correction</>
                                                        ) : (isFieldCheckedIn || isSiteOtCheckedIn) ? (
                                                            <><MapPin className="mr-2 h-4 w-4" /> Site Out First</>
                                                        ) : (
                                                            <><LogOut className="mr-2 h-4 w-4" /> Punch Out</>
                                                        )}
                                                    </Button>
                                                )}
                                             </div>

                                             {/* ── 2. Site Context Section (Consolidated Mode Selector) ── */}
                                             {(isFieldStaffRole || isSiteStaffRole) && effectivelyCheckedIn && (
                                                 <div className="mt-6 pt-6 border-t border-gray-100/50 space-y-4">
                                                     {!(isFieldCheckedIn || isSiteOtCheckedIn) ? (
                                                         <div className="space-y-3">
                                                            <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-200/50 shadow-inner">
                                                                <button 
                                                                    onClick={() => setSiteWorkMode('duty')}
                                                                    className={`flex-1 py-2 text-[11px] font-black uppercase tracking-[0.1em] rounded-xl transition-all ${siteWorkMode === 'duty' ? 'bg-white text-emerald-600 shadow-md border border-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}
                                                                >
                                                                    Regular Duty
                                                                </button>
                                                                {(isSiteStaffRole || isFieldStaffRole) && (
                                                                    <button 
                                                                        onClick={() => setSiteWorkMode('ot')}
                                                                        className={`flex-1 py-2 text-[11px] font-black uppercase tracking-[0.1em] rounded-xl transition-all ${siteWorkMode === 'ot' ? 'bg-white text-indigo-600 shadow-md border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                                                                    >
                                                                        Overtime (OT)
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <Button
                                                                onClick={() => navigate(siteWorkMode === 'duty' ? '/attendance/check-in?workType=field&action=site-in' : '/attendance/check-in?workType=site-ot&action=site-ot-in')}
                                                                className={`w-full !h-11 !rounded-2xl transition-all font-bold uppercase tracking-widest text-[12px] shadow-lg ${siteWorkMode === 'duty' ? '!bg-emerald-600 shadow-emerald-900/10' : '!bg-indigo-600 shadow-indigo-900/10'} ${isOnBreak || isActionInProgress || isPunchBlocked ? 'opacity-50 pointer-events-none' : ''}`}
                                                                disabled={isOnBreak || isActionInProgress || isPunchBlocked}
                                                            >
                                                                <MapPin className="mr-2 h-4 w-4" /> Check In to Site
                                                            </Button>
                                                         </div>
                                                     ) : (
                                                         <Button
                                                             onClick={() => navigate(isFieldCheckedIn ? '/attendance/check-out?workType=field&action=site-out' : '/attendance/check-out?workType=site-ot&action=site-ot-out')}
                                                             variant="secondary"
                                                             className="w-full !h-11 !rounded-2xl !bg-red-50 !border-red-100 !text-red-700 font-bold uppercase tracking-widest text-[12px] hover:!bg-red-100"
                                                             disabled={isOnBreak || isActionInProgress || isPunchBlocked}
                                                         >
                                                             <LogOut className="mr-2 h-4 w-4" /> 
                                                             {isFieldCheckedIn ? 'Check Out (Duty Site)' : 'Check Out (Site OT)'}
                                                         </Button>
                                                     )}
                                                 </div>
                                             )}

                                             {/* ── 3. Break Session (Dynamic Toggle) ── */}
                                             {effectivelyCheckedIn && (
                                                <div className={`mt-6 pt-6 border-t border-gray-100/50 space-y-3`}>
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
                                                     <Button
                                                         onClick={() => navigate(isOnBreak ? '/attendance/break-out' : '/attendance/break-in')}
                                                         variant="secondary"
                                                         className={`w-full !h-11 !rounded-2xl transition-all font-bold uppercase tracking-widest text-[12px] ${isOnBreak ? '!bg-amber-500 !text-white border-transparent shadow-lg shadow-amber-900/20' : '!bg-blue-50/50 !text-blue-700 !border-blue-100 hover:!bg-blue-100'} ${isActionInProgress || isPunchBlocked ? 'opacity-50 pointer-events-none' : ''}`}
                                                         disabled={isActionInProgress || isPunchBlocked}
                                                     >
                                                         {isOnBreak ? <Coffee className="mr-2 h-4 w-4" /> : <Clock className="mr-2 h-4 w-4" />}
                                                         {isOnBreak ? 'End My Break' : 'Start My Break'}
                                                     </Button>
                                                </div>
                                             )}
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

                    {/* Today's Activity Card */}
                    {user.role !== 'management' && (
                        <div className="md:bg-white md:p-3 md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 h-full transition-shadow">
                            <div className="flex items-center gap-3 mb-5">
                                <div className={`p-2 rounded-lg ${isOfficeStaffRole ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                                    {isOfficeStaffRole
                                        ? <Clock className="h-5 w-5 text-blue-600" />
                                        : <Footprints className="h-5 w-5 text-emerald-600" />
                                    }
                                </div>
                                <h3 className="text-sm font-bold text-gray-900">
                                    {isOfficeStaffRole ? "Today's Session" : "Today's Activity"}
                                </h3>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    {isOfficeStaffRole ? (
                                        /* ── Office Staff: Work Session Summary ── */
                                        <>
                                            {/* Hours Worked */}
                                            <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100 flex flex-col justify-center">
                                                <div className="text-[10px] font-bold text-blue-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                                                    Hours Worked
                                                </div>
                                                <p className="text-lg font-bold text-gray-900 tabular-nums">
                                                    {totalWorkingDurationToday > 0
                                                        ? `${Math.floor(totalWorkingDurationToday)}h ${Math.round((totalWorkingDurationToday % 1) * 60)}m`
                                                        : effectivelyCheckedIn ? <span className="text-emerald-600 animate-pulse text-sm">Active</span> : '—'
                                                    }
                                                </p>
                                            </div>
                                            {/* Break Time */}
                                            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-100 flex flex-col justify-center">
                                                <div className="text-[10px] font-bold text-amber-600 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Coffee className="w-3.5 h-3.5 text-amber-600" />
                                                    Break Time
                                                </div>
                                                <p className="text-lg font-bold text-gray-900 tabular-nums">
                                                    {totalBreakDurationToday > 0
                                                        ? `${Math.floor(totalBreakDurationToday)}h ${Math.round((totalBreakDurationToday % 1) * 60)}m`
                                                        : '0h 0m'
                                                    }
                                                </p>
                                            </div>
                                            {/* Daily Steps — full width */}
                                            <div className="col-span-2 bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 flex flex-col justify-center">
                                                <div className="text-[10px] font-bold text-emerald-600 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Footprints className="w-3.5 h-3.5 text-emerald-600" />
                                                    Daily Steps
                                                </div>
                                                <p className="text-lg font-bold text-gray-900 tabular-nums flex items-baseline">
                                                    {isMetricsLoading ? '—' : (todayMetrics.totalSteps + (effectivelyCheckedIn ? liveSteps : 0)).toLocaleString()}
                                                    {effectivelyCheckedIn && liveSteps > 0 && (
                                                        <span className="text-xs font-black text-emerald-600 ml-2 animate-pulse">
                                                            ({liveSteps} live)
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        /* ── Field / Site Staff: Activity Metrics ── */
                                        <>
                                            {/* Steps */}
                                            <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                                                <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Footprints className="w-3.5 h-3.5 text-emerald-600" />
                                                    Daily Steps
                                                </div>
                                                <p className="text-lg font-bold text-gray-900 tabular-nums flex items-baseline">
                                                    {isMetricsLoading ? '—' : (todayMetrics.totalSteps + (effectivelyCheckedIn ? liveSteps : 0)).toLocaleString()}
                                                    {effectivelyCheckedIn && liveSteps > 0 && (
                                                        <span className="text-xs font-black text-emerald-600 ml-2 animate-pulse">
                                                            ({liveSteps} live)
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            {/* Distance (GPS route) */}
                                            <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                                                <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Navigation className="w-3.5 h-3.5 text-blue-600" />
                                                    Distance
                                                </div>
                                                <p className="text-lg font-bold text-gray-900 tabular-nums">
                                                    {isMetricsLoading ? '—' : formatDistance(parseFloat(todayMetrics.totalDistance))}
                                                </p>
                                            </div>
                                            {/* Travel Duration */}
                                            <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                                                <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                                                    Travel Time
                                                </div>
                                                <p className="text-lg font-bold text-gray-900 tabular-nums">
                                                    {isMetricsLoading ? '—' : todayMetrics.travelTime}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Home Location Card */}
                    <div className="md:bg-white md:p-3 md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 h-full transition-shadow flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-2 bg-emerald-50 rounded-lg">
                                    <MapPin className="h-5 w-5 text-emerald-600" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-900">Home Location</h3>
                            </div>
                            <form 
                                onSubmit={async (e) => {
                                    if (isFirstTime) {
                                        await handleSaveHomeLocation(e);
                                    } else {
                                        await handleRequestLocationChange(e);
                                    }
                                }} 
                                className="space-y-3"
                            >
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Location Name</label>
                                    <input
                                        type="text"
                                        value={homeLocationName}
                                        disabled
                                        className="form-input bg-gray-50 border-gray-200 text-sm h-[40px] rounded-lg w-full text-gray-500 cursor-not-allowed"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Latitude</label>
                                        <input
                                            type="text"
                                            value={homeLatitude}
                                            onChange={e => setHomeLatitude(e.target.value)}
                                            className="form-input bg-white border-gray-200 text-sm h-[40px] rounded-lg w-full"
                                            placeholder="Latitude"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Longitude</label>
                                        <input
                                            type="text"
                                            value={homeLongitude}
                                            onChange={e => setHomeLongitude(e.target.value)}
                                            className="form-input bg-white border-gray-200 text-sm h-[40px] rounded-lg w-full"
                                            placeholder="Longitude"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Home Address</label>
                                    <textarea
                                        value={homeAddress}
                                        onChange={e => setHomeAddress(e.target.value)}
                                        rows={2}
                                        className="form-input bg-white border-gray-200 text-sm py-2 px-3 rounded-lg w-full resize-none"
                                        placeholder="Enter your home address"
                                    />
                                </div>

                                {/* Subsequent Change Requests Flow */}
                                {!isFirstTime && (
                                    <div className="space-y-3 pt-2">
                                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[11px] text-amber-800 space-y-1">
                                            <p className="font-bold flex items-center gap-1.5">⚠️ Calendar Year Update Limit</p>
                                            <p>You can update your home location only 3 times per calendar year.</p>
                                            <p>Approved updates this year: <strong className="text-amber-900">{updateCount} / 3</strong></p>
                                        </div>
                                        {updateCount >= 3 ? (
                                            <div className="text-rose-600 font-bold text-xs p-3 text-center bg-rose-50 rounded-lg border border-rose-200">
                                                You have reached the maximum limit of 3 home location updates for this calendar year.
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-xs font-semibold text-amber-600 mb-1">Reason for Updating Address</label>
                                                <textarea
                                                    value={changeReason}
                                                    onChange={e => setChangeReason(e.target.value)}
                                                    rows={2}
                                                    required
                                                    className="form-input bg-white border-gray-200 text-sm py-2 px-3 rounded-lg w-full resize-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                                                    placeholder="Please explain why you are updating your home address..."
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-2 justify-end pt-3 mt-3 border-t border-gray-100">
                                    <Button 
                                        type="button" 
                                        onClick={handleSyncHomeLocation} 
                                        isLoading={isSyncingLocation}
                                        variant="outline"
                                        className="!h-[38px] text-xs font-semibold"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                        Sync Location
                                    </Button>
                                    <Button 
                                        type="submit" 
                                        isLoading={isSavingLocation}
                                        disabled={!isFirstTime && (updateCount >= 3 || !changeReason.trim())}
                                        className={`!h-[38px] text-xs font-semibold text-white ${!isFirstTime ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                    >
                                        {isFirstTime ? 'Save' : 'Request Update'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* ── Vehicle Details Card (desktop) ── */}
                    <div className="md:bg-white md:p-3 md:rounded-xl md:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 h-full transition-shadow flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-50 rounded-lg">
                                        <Bike className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900">My Vehicles</h3>
                                        <p className="text-[10px] text-gray-400 font-medium">Reimbursement details</p>
                                    </div>
                                </div>
                            </div>

                            {/* Vehicles List */}
                            {isLoadingVehicles ? (
                                <div className="py-4 text-center text-xs text-gray-400">Loading vehicles...</div>
                            ) : vehiclesList.length === 0 ? (
                                <div className="py-4 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl mb-4 bg-gray-50/40">
                                    No vehicles registered. Please add one below.
                                </div>
                            ) : (
                                <div className="space-y-2.5 mb-4">
                                    {vehiclesList.map((v) => (
                                        <div key={v.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-white rounded-lg border border-gray-100">
                                                    {v.vehicle_type === 'two_wheeler' ? <Bike className="w-4 h-4 text-amber-500" /> : <Car className="w-4 h-4 text-blue-500" />}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-800">{v.brand_name}</p>
                                                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                                                        {v.vehicle_type.replace('_', ' ')} {v.engine_cc ? `• ${v.engine_cc}cc` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-gray-900">{v.odometer_reading.toLocaleString()} km</p>
                                                <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black uppercase rounded-md tracking-wider mt-1 ${
                                                    v.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {v.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add Vehicle Form */}
                            {(vehiclesList.length === 0 || vehiclesList.filter(v => v.status === 'approved').length >= 1) && (
                                <form onSubmit={handleAddVehicle} className="space-y-3 pt-2 border-t border-gray-100">
                                    <h4 className="text-xs font-bold text-gray-700">
                                        {vehiclesList.filter(v => v.status === 'approved').length >= 1 
                                            ? 'Request to Add Another Vehicle' 
                                            : 'Register First Vehicle'}
                                    </h4>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Vehicle Type</label>
                                            <select
                                                value={vehicleType}
                                                onChange={e => setVehicleType(e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-lg text-xs h-[36px] px-2"
                                            >
                                                <option value="two_wheeler">Two Wheeler</option>
                                                <option value="four_wheeler_petrol">4W Petrol</option>
                                                <option value="four_wheeler_diesel">4W Diesel</option>
                                                <option value="public_transport">Public Transport</option>
                                                <option value="company_vehicle">Company Vehicle</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Brand Name</label>
                                            <input
                                                type="text"
                                                value={vehicleBrand}
                                                onChange={e => setVehicleBrand(e.target.value)}
                                                placeholder="e.g. Honda, Suzuki"
                                                className="w-full bg-white border border-gray-200 rounded-lg text-xs h-[36px] px-2.5"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        {vehicleType === 'two_wheeler' && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1">Engine CC</label>
                                                <input
                                                    type="number"
                                                    value={vehicleCC}
                                                    onChange={e => setVehicleCC(e.target.value)}
                                                    placeholder="e.g. 150"
                                                    className="w-full bg-white border border-gray-200 rounded-lg text-xs h-[36px] px-2.5"
                                                />
                                            </div>
                                        )}
                                        <div className={vehicleType !== 'two_wheeler' ? 'col-span-2' : ''}>
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Odometer Reading (KM)</label>
                                            <input
                                                type="number"
                                                value={vehicleOdo}
                                                onChange={e => setVehicleOdo(e.target.value)}
                                                placeholder="e.g. 12450"
                                                className="w-full bg-white border border-gray-200 rounded-lg text-xs h-[36px] px-2.5"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1">Odometer Picture</label>
                                        <input 
                                            id="odometer-file-input-edit" 
                                            type="file" 
                                            className="sr-only" 
                                            onChange={handleOdometerImageChange} 
                                            accept="image/*"
                                        />
                                        {odoImagePreview ? (
                                            <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden group">
                                                <div className="relative w-full h-[110px] bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200">
                                                    <img 
                                                        src={odoImagePreview} 
                                                        alt="Odometer Preview" 
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <label 
                                                            htmlFor="odometer-file-input-edit" 
                                                            className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg cursor-pointer transition-all active:scale-95"
                                                            title="Change Photo"
                                                        >
                                                            <RefreshCw className="h-4 w-4 text-white" />
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setVehicleOdoImage(null);
                                                                setOdoImagePreview(null);
                                                            }}
                                                            className="p-2 bg-rose-500/20 hover:bg-rose-500/30 backdrop-blur-md rounded-lg transition-all active:scale-95"
                                                            title="Remove Photo"
                                                        >
                                                            <Trash2 className="h-4 w-4 text-rose-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="w-full mt-1.5 flex justify-between items-center px-0.5 text-[9px] font-bold text-gray-400">
                                                    <span className="truncate max-w-[150px]">{vehicleOdoImage?.name || 'odometer.jpg'}</span>
                                                    <span>{vehicleOdoImage ? `${(vehicleOdoImage.size / (1024 * 1024)).toFixed(2)} MB` : 'Captured'}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div 
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    setIsDraggingOdo(true);
                                                }}
                                                onDragLeave={(e) => {
                                                    e.preventDefault();
                                                    setIsDraggingOdo(false);
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setIsDraggingOdo(false);
                                                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                        const file = e.dataTransfer.files[0];
                                                        setVehicleOdoImage(file);
                                                        setOdoImagePreview(URL.createObjectURL(file));
                                                    }
                                                }}
                                                className={`w-full bg-gray-50 border border-dashed rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px] transition-all relative ${
                                                    isDraggingOdo 
                                                        ? 'border-emerald-500 bg-emerald-50/50' 
                                                        : 'border-gray-200 hover:border-emerald-500/50 hover:bg-gray-100/50'
                                                }`}
                                            >
                                                <label htmlFor="odometer-file-input-edit" className="absolute inset-0 cursor-pointer z-0" />
                                                <div className="relative z-10 flex flex-col items-center text-center w-full pointer-events-none mb-0.5">
                                                    <div className="p-2 bg-emerald-50 rounded-full text-emerald-600 mb-2">
                                                        <Camera className="h-6 w-6 text-emerald-600" />
                                                    </div>
                                                    <p className="font-bold text-gray-700 text-xs">Click to upload</p>
                                                    <p className="text-[9px] font-semibold mt-0.5 uppercase tracking-wider text-gray-400">or drag & drop</p>
                                                </div>
                                                
                                                <div className="relative z-10 flex items-center w-full max-w-[100px] my-2 pointer-events-none">
                                                    <div className="h-px flex-1 bg-gray-200"></div>
                                                    <span className="px-2 text-[8px] font-semibold text-gray-400">OR</span>
                                                    <div className="h-px flex-1 bg-gray-200"></div>
                                                </div>
                                                
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setIsOdometerCameraOpen(true); 
                                                    }} 
                                                    className="relative z-10 flex items-center justify-center font-bold text-gray-700 hover:bg-gray-100 transition-colors text-xs py-1 px-3 bg-white rounded-lg border border-gray-200 active:scale-95"
                                                >
                                                    <Camera className="h-3.5 w-3.5 mr-1.5 text-rose-500" />
                                                    Capture with Camera
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {vehiclesList.filter(v => v.status === 'approved').length >= 1 && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-amber-600 mb-1 uppercase tracking-wider">Reason for Adding Vehicle</label>
                                            <textarea
                                                value={vehicleChangeReason}
                                                onChange={e => setVehicleChangeReason(e.target.value)}
                                                rows={2}
                                                className="w-full bg-white border border-gray-200 rounded-lg text-xs p-2 resize-none"
                                                placeholder="Explain why you need an additional vehicle..."
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-2">
                                        <Button
                                            type="submit"
                                            isLoading={isSubmittingVehicle}
                                            className={`!h-[38px] text-xs font-bold w-full uppercase tracking-wider text-white ${
                                                vehiclesList.filter(v => v.status === 'approved').length >= 1 
                                                    ? '!bg-amber-600 hover:!bg-amber-700' 
                                                    : '!bg-emerald-600 hover:!bg-emerald-700'
                                            }`}
                                        >
                                            {vehiclesList.filter(v => v.status === 'approved').length >= 1 
                                                ? 'Request Approval to Add' 
                                                : 'Save Vehicle'}
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

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


            {/* ═══ SETTINGS MODAL (WEB) ═══ */}
            <AnimatePresence>
                {isSettingsOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >

                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white dark:bg-[#0b291a] w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl border border-gray-200 dark:border-[#1a3d2c] flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-[#1a3d2c]">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                                        <Settings className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Profile Settings</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your identity and security preferences</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a3d2c] transition-all"
                                >
                                    <FileText className="w-6 h-6 rotate-45" /> {/* Close Icon alternative if X not handy, but ArrowLeft is standard here */}
                                    <ArrowLeft className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Identity Section */}
                                    <section className="space-y-4">
                                        <div className="flex items-center gap-2 text-gray-900 dark:text-white mb-2">
                                            <UserIcon className="w-4 h-4 text-emerald-600" />
                                            <h3 className="font-bold">Identity Details</h3>
                                        </div>
                                        <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
                                            <Input label="Display Name" id="name-modal" registration={register('name')} className="bg-gray-50 dark:bg-[#041b0f] border-gray-200 dark:border-[#1a3d2c]" />
                                            <Input label="Phone Number" id="phone-modal" type="tel" registration={register('phone')} className="bg-gray-50 dark:bg-[#041b0f] border-gray-200 dark:border-[#1a3d2c]" />
                                            <div className="space-y-1">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                                                <select {...register('gender')} className="w-full bg-gray-50 dark:bg-[#041b0f] border border-gray-200 dark:border-[#1a3d2c] rounded-xl h-11 px-4 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all">
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <Button type="submit" isLoading={isSaving} disabled={!isDirty} className="w-full !bg-emerald-600 hover:!bg-emerald-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-emerald-500/10">Save Changes</Button>
                                        </form>
                                    </section>

                                    {/* Security Section */}
                                    <section className="space-y-4">
                                        <div className="flex items-center gap-2 text-gray-900 dark:text-white mb-2">
                                            <Lock className="w-4 h-4 text-amber-600" />
                                            <h3 className="font-bold">Access Security</h3>
                                        </div>
                                        <form onSubmit={handlePasscodeSubmit(onPasscodeSubmit)} className="space-y-4">
                                            <Input label="Current Pin" id="oldPasscode-modal" type="password" registration={registerPasscode('oldPasscode')} className="bg-gray-50 dark:bg-[#041b0f] border-gray-200 dark:border-[#1a3d2c]" />
                                            <Input label="New 4-Digit Pin" id="newPasscode-modal" type="password" inputMode="numeric" maxLength={4} registration={registerPasscode('newPasscode')} className="bg-gray-50 dark:bg-[#041b0f] border-gray-200 dark:border-[#1a3d2c]" />
                                            <Button type="submit" isLoading={isSavingPasscode} disabled={!isPasscodeDirty} className="w-full !bg-amber-600 hover:!bg-amber-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-amber-500/10">Update Pin</Button>
                                        </form>

                                        {/* Gate Access Management for Web */}
                                        <div className="pt-4 border-t border-gray-100 dark:border-[#1a3d2c] mt-4">
                                            <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/30">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Gate Access Profile</h4>
                                                    {gateUser?.passcode && (
                                                        <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300">PIN: {gateUser.passcode}</span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    {isGateUserLoading ? (
                                                        <div className="w-full flex items-center justify-center py-2">
                                                            <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                                                        </div>
                                                    ) : gateUser ? (
                                                        <Button 
                                                            onClick={handleResetGateAccess}
                                                            variant="outline"
                                                            className="w-full !h-9 !text-xs !border-red-200 dark:!border-red-900/30 !text-red-600 dark:!text-red-400 hover:!bg-red-50 dark:hover:!bg-red-900/10"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                                                            Reset Gate Profile
                                                        </Button>
                                                    ) : (
                                                        <Button 
                                                            onClick={() => setIsEnrolling(true)}
                                                            className="w-full !h-9 !text-xs !bg-emerald-600 hover:!bg-emerald-700 text-white font-bold rounded-lg shadow-sm"
                                                        >
                                                            <Camera className="w-3.5 h-3.5 mr-2" />
                                                            Get Gate Access
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                {/* Alert Tone Picker Section */}
                                <section className="pt-6 border-t border-gray-100 dark:border-[#1a3d2c]">
                                    <div className="flex items-center gap-2 text-gray-900 dark:text-white mb-4">
                                        <Volume2 className="w-4 h-4 text-blue-600" />
                                        <h3 className="font-bold">Notification Audio</h3>
                                    </div>
                                    <AlertTonePicker />
                                </section>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


            {isEnrolling && (
                <CameraCaptureModal
                    isOpen={isEnrolling}
                    onClose={() => setIsEnrolling(false)}
                    onCapture={handleEnrollmentCapture}
                    captureGuidance="profile"
                    isLoading={isRegistering}
                />
            )}

            {approveLocationChange === 'true' && requestingUser && (
                <Modal
                    isOpen={true}
                    onClose={() => {
                        navigate('/profile', { replace: true });
                    }}
                    title="Home Location Change Approval"
                    hideFooter={true}
                    containerClassName="bg-[#041b0f] text-white border border-[#1d422f] rounded-[24px] shadow-card max-w-md mx-auto"
                >
                    <div className="space-y-4 p-4">
                        <div className="flex items-center gap-3 bg-[#0a1c13] p-4 rounded-xl border border-[#1d422f]">
                            <MapPin className="h-6 w-6 text-sky-400" />
                            <div>
                                <h4 className="font-bold text-white text-sm">Request Details</h4>
                                <p className="text-xs text-gray-400">Request from {requestingUser.name}</p>
                            </div>
                        </div>
                        <div className="space-y-2 text-xs">
                            <p><strong className="text-gray-400">Current Address:</strong> {requestingUser.homeAddress || 'Not Set'}</p>
                            <p><strong className="text-sky-400">New Address:</strong> {newAddr}</p>
                            <p><strong className="text-amber-400">Reason for Change:</strong> {changeReasonParam}</p>
                            <p><strong className="text-gray-400">New Coordinates:</strong> {newLat}, {newLon}</p>
                        </div>
                        <div className="flex gap-3 pt-4 border-t border-white/10">
                            <Button
                                onClick={async () => {
                                    try {
                                        await api.updateUser(reqUserId!, {
                                            homeLatitude: parseFloat(newLat || '0'),
                                            homeLongitude: parseFloat(newLon || '0'),
                                            homeAddress: newAddr
                                        });
                                        
                                        await syncHomeLocationToDashboard(
                                            reqUserId!,
                                            requestingUser.name || '',
                                            parseFloat(newLat || '0'),
                                            parseFloat(newLon || '0'),
                                            newAddr || ''
                                        );
                                        
                                        await api.createNotification({
                                            userId: reqUserId!,
                                            message: `Your home location update request to "${newAddr}" has been approved by ${user?.name}.`,
                                            type: 'info'
                                        });

                                        setToast({ message: 'Home location change approved successfully!', type: 'success' });
                                    } catch (err) {
                                        setToast({ message: 'Failed to approve request.', type: 'error' });
                                    } finally {
                                        navigate('/profile', { replace: true });
                                    }
                                }}
                                className="flex-1 !bg-emerald-600 hover:!bg-emerald-700 text-white !rounded-2xl"
                            >
                                Approve
                            </Button>
                            <Button
                                onClick={async () => {
                                    try {
                                        await api.createNotification({
                                            userId: reqUserId!,
                                            message: `Your home location update request to "${newAddr}" has been rejected.`,
                                            type: 'warning'
                                        });
                                        setToast({ message: 'Request rejected.', type: 'info' });
                                    } catch (err) {
                                        setToast({ message: 'Failed to reject request.', type: 'error' });
                                    } finally {
                                        navigate('/profile', { replace: true });
                                    }
                                }}
                                className="flex-1 !bg-rose-600 hover:!bg-rose-700 text-white !rounded-2xl"
                            >
                                Reject
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {approveVehicleAdd === 'true' && requestingUser && (
                <Modal
                    isOpen={true}
                    onClose={() => {
                        navigate('/profile', { replace: true });
                    }}
                    title="Vehicle Addition Approval"
                    hideFooter={true}
                    containerClassName="bg-[#041b0f] text-white border border-[#1d422f] rounded-[24px] shadow-card max-w-md mx-auto"
                >
                    <div className="space-y-4 p-4 text-white">
                        <div className="flex items-center gap-3 bg-[#0a1c13] p-4 rounded-xl border border-[#1d422f]">
                            <Bike className="h-6 w-6 text-amber-400" />
                            <div>
                                <h4 className="font-bold text-white text-sm">Vehicle Request Details</h4>
                                <p className="text-xs text-gray-400">Request from {requestingUser.name}</p>
                            </div>
                        </div>
                        <div className="space-y-2 text-xs">
                            <p><strong className="text-gray-400">Vehicle Type:</strong> {vehicleTypeParam === 'two_wheeler' ? 'Two Wheeler' : 'Four Wheeler'}</p>
                            <p><strong className="text-gray-400">Brand Name:</strong> {brandParam}</p>
                            {ccParam && <p><strong className="text-gray-400">Engine CC:</strong> {ccParam} cc</p>}
                            <p><strong className="text-gray-400">Odometer Reading:</strong> {odoParam} km</p>
                            <p><strong className="text-amber-400">Reason for Request:</strong> {changeReasonParam}</p>
                            {imgParam && (
                                <div className="mt-2 border border-white/10 rounded-xl overflow-hidden bg-black/40">
                                    <p className="p-2 bg-white/5 font-semibold text-gray-300">Odometer Reading Picture:</p>
                                    <img src={imgParam} alt="Odometer" className="w-full h-auto object-cover max-h-[200px]" />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 pt-4 border-t border-white/10">
                            <Button
                                onClick={async () => {
                                    try {
                                        await api.addUserVehicle({
                                            userId: reqUserId!,
                                            vehicleType: vehicleTypeParam!,
                                            brandName: brandParam!,
                                            engineCc: ccParam ? parseInt(ccParam) : null,
                                            odometerReading: parseInt(odoParam || '0'),
                                            odometerPictureUrl: imgParam!,
                                            status: 'approved'
                                        });

                                        // Also update active vehicle type in profile
                                        await api.updateUser(reqUserId!, { vehicle_type: vehicleTypeParam as any });
                                        
                                        await api.createNotification({
                                            userId: reqUserId!,
                                            message: `Your request to add vehicle "${brandParam}" has been approved by ${user?.name}.`,
                                            type: 'info'
                                        });

                                        setToast({ message: 'Vehicle addition approved successfully!', type: 'success' });
                                    } catch (err: any) {
                                        setToast({ message: err.message || 'Failed to approve vehicle.', type: 'error' });
                                    } finally {
                                        navigate('/profile', { replace: true });
                                    }
                                }}
                                className="flex-1 !h-[48px] text-xs font-bold uppercase tracking-wider !bg-emerald-600 hover:!bg-emerald-700 text-white !rounded-2xl"
                            >
                                Approve
                            </Button>
                            <Button
                                onClick={async () => {
                                    try {
                                        await api.createNotification({
                                            userId: reqUserId!,
                                            message: `Your request to add vehicle "${brandParam}" has been rejected by ${user?.name}.`,
                                            type: 'warning'
                                        });

                                        setToast({ message: 'Vehicle addition request rejected.', type: 'info' });
                                    } catch (err: any) {
                                        setToast({ message: err.message || 'Failed to reject request.', type: 'error' });
                                    } finally {
                                        navigate('/profile', { replace: true });
                                    }
                                }}
                                className="flex-1 !h-[48px] text-xs font-bold uppercase tracking-wider !bg-rose-600 hover:!bg-rose-700 text-white !rounded-2xl"
                            >
                                Reject
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {isOdometerCameraOpen && (
                <CameraCaptureModal
                    isOpen={isOdometerCameraOpen}
                    onClose={() => setIsOdometerCameraOpen(false)}
                    onCapture={handleOdometerCapture}
                    captureGuidance="document"
                />
            )}

            <HelpTicketModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />

            {/* Punch Out Reason Modal */}
            <Modal
                isOpen={isPunchOutModalOpen}
                onClose={() => setIsPunchOutModalOpen(false)}
                title="Punch Out"
                confirmButtonText="Confirm Punch Out"
                confirmButtonVariant="danger"
                onConfirm={() => handleAutoCheckOut(punchOutReason)}
                isLoading={isSubmittingAttendance}
            >
                <div className="space-y-4">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="text-amber-800 text-sm font-bold">You are closing an open session from {previousDaySessionInfo?.date}</p>
                        <p className="text-amber-700 text-xs mt-1">Calculated Hours: <strong>{previousDaySessionInfo?.workingHours || 0} hrs</strong></p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason for missed punch out / late punch out</label>
                        <textarea
                            value={punchOutReason}
                            onChange={(e) => setPunchOutReason(e.target.value)}
                            className="w-full form-input rounded-xl text-sm"
                            rows={3}
                            placeholder="Please provide a reason..."
                            required
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ProfilePage;
