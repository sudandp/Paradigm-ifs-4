import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getStaffCategory, isTechnicalRole } from '../../utils/attendanceCalculations';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import type { LeaveType, UploadedFile, LeaveBalance, UserChild, StaffAttendanceRules, LeaveRequestStatus } from '../../types';
import { ArrowLeft, Clock } from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Select from '../../components/ui/Select';
import { useForm, Controller, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { format, differenceInCalendarDays, isSameDay } from 'date-fns';
import DatePicker from '../../components/ui/DatePicker';
import NativeDatePicker from '../../components/ui/NativeDatePicker';
import DateRangePicker from '../../components/ui/DateRangePicker';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useSettingsStore } from '../../store/settingsStore';
import UploadDocument from '../../components/UploadDocument';

type LeaveRequestFormData = {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
    dayOption?: 'full' | 'half';
    doctorCertificate?: UploadedFile | null;
    // Correction fields
    correctionStatus?: 'Present' | 'Site Visit' | 'W/H';
    punchIn?: string;
    punchOut?: string;
    includeBreak?: boolean;
    breakIn?: string;
    breakOut?: string;
    locationName?: string;
    includeSiteOt?: boolean;
    siteOtIn?: string;
    siteOtOut?: string;
};

const getLeaveValidationSchema = (threshold: number) => yup.object({
    leaveType: yup.string<LeaveType>().oneOf(['Earned', 'Sick', 'Floating', 'Comp Off', 'Loss of Pay', 'Maternity', 'Child Care', 'Pink Leave', 'WFH', 'Correction', 'Permission']).required('Leave type is required'),
    startDate: yup.string().required('Start date is required'),
    endDate: yup.string().required('End date is required')
        .test('is-after-start', 'End date must be on or after start date', function (value) {
            const { startDate } = this.parent as { startDate?: string };
            if (!startDate || !value) return true;
            return new Date(value.replace(/-/g, '/')) >= new Date(startDate.replace(/-/g, '/'));
        }),
    reason: yup.string().required('A reason for the leave is required').min(10, 'Please provide a more detailed reason.'),
    dayOption: yup.string().oneOf(['full', 'half']).optional(),
    doctorCertificate: yup.mixed<UploadedFile | null>().when(['leaveType', 'startDate', 'endDate'], {
        is: (leaveType: string, startDate: string, endDate: string) => {
            if (leaveType !== 'Sick' || !startDate || !endDate) return false;
            const duration = differenceInCalendarDays(new Date(endDate.replace(/-/g, '/')), new Date(startDate.replace(/-/g, '/'))) + 1;
            return duration > threshold;
        },
        then: schema => schema.required(`A doctor's certificate is required for sick leave longer than ${threshold} days.`),
        otherwise: schema => schema.nullable().optional(),
    }),
    // Correction validation
    correctionStatus: yup.string().when('leaveType', {
        is: (val: string) => ['Correction', 'Permission'].includes(val),
        then: schema => schema.required('Status is required for corrections or permissions'),
        otherwise: schema => schema.optional()
    }),
    punchIn: yup.string().when('leaveType', {
        is: (val: string) => ['Correction', 'Permission'].includes(val),
        then: schema => schema.required('Punch in time is required'),
        otherwise: schema => schema.optional()
    }),
    punchOut: yup.string().when('leaveType', {
        is: (val: string) => ['Correction', 'Permission'].includes(val),
        then: schema => schema.required('Punch out time is required'),
        otherwise: schema => schema.optional()
    }),
    locationName: yup.string().optional(),
    breakIn: yup.string().when(['leaveType', 'includeBreak'], {
        is: (lt: string, ib: boolean) => ['Correction', 'Permission'].includes(lt) && ib === true,
        then: schema => schema.required('Break in time is required'),
        otherwise: schema => schema.optional()
    }),
    breakOut: yup.string().when(['leaveType', 'includeBreak'], {
        is: (lt: string, ib: boolean) => ['Correction', 'Permission'].includes(lt) && ib === true,
        then: schema => schema.required('Break out time is required'),
        otherwise: schema => schema.optional()
    }),
    siteOtIn: yup.string().when(['leaveType', 'includeSiteOt'], {
        is: (lt: string, ot: boolean) => ['Correction', 'Permission'].includes(lt) && ot === true,
        then: schema => schema.required('Site OT in time is required'),
        otherwise: schema => schema.optional()
    }),
    siteOtOut: yup.string().when(['leaveType', 'includeSiteOt'], {
        is: (lt: string, ot: boolean) => ['Correction', 'Permission'].includes(lt) && ot === true,
        then: schema => schema.required('Site OT out time is required'),
        otherwise: schema => schema.optional()
    })
});

const ApplyLeave: React.FC = () => {
    const { user, isCheckedIn } = useAuthStore();
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const { attendance } = useSettingsStore();
    const sickLeaveCertificateThreshold = attendance.office.sickLeaveCertificateThreshold;

    const validationSchema = useMemo(() => getLeaveValidationSchema(sickLeaveCertificateThreshold), [sickLeaveCertificateThreshold]);
    const userCategory = useMemo(() => getStaffCategory(user?.role, user?.societyId, attendance), [user?.role, user?.societyId, attendance]);
    const rules = useMemo(() => {
        if (!attendance || !userCategory) return null;
        return (attendance as any)[userCategory] as StaffAttendanceRules;
    }, [attendance, userCategory]);

    const [searchParams] = useSearchParams();
    const editId = searchParams.get('edit');
    const isEditMode = !!editId;
    const isFemale = user?.gender?.toLowerCase() === 'female';
    const [isInitialLoading, setIsInitialLoading] = React.useState(isEditMode);
    const [isFetchingLogs, setIsFetchingLogs] = React.useState(false);
    const [userChildren, setUserChildren] = React.useState<UserChild[]>([]);
    const [leaveBalance, setLeaveBalance] = React.useState<number>(0);
    const [fullBalance, setFullBalance] = React.useState<LeaveBalance | null>(null);

    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const initialLeaveType = (searchParams.get('leaveType') as LeaveType) || 'Earned';
    const initialStartDate = searchParams.get('startDate') || format(new Date(), 'yyyy-MM-dd');

    const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<LeaveRequestFormData>({
        resolver: yupResolver(validationSchema) as Resolver<LeaveRequestFormData>,
        defaultValues: { 
            leaveType: initialLeaveType, 
            startDate: initialStartDate, 
            endDate: initialStartDate, 
            dayOption: 'full',
            correctionStatus: 'Present',
            punchIn: '09:00',
            punchOut: '19:30',
            includeBreak: false,
            breakIn: '13:00',
            breakOut: '14:00',
            locationName: 'Office',
            includeSiteOt: false,
            siteOtIn: '20:00',
            siteOtOut: '22:00'
        }
    });

    const watchStartDate = watch('startDate');
    const watchEndDate = watch('endDate');
    const watchLeaveType = watch('leaveType');

    // Fetch leave balance and holidays
    React.useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                // Fetch Balances
                const balance = await api.getLeaveBalancesForUser(user.id);
                setFullBalance(balance);
                
                // Fetch Children
                const children = await api.getUserChildren(user.id).catch(() => []);
                setUserChildren(children as UserChild[]);

                const baseType = watchLeaveType.toLowerCase().replace(/\s/g, '');
                let balanceKeyBase = baseType;
                
                if (baseType === 'compoff') balanceKeyBase = 'compOff';
                else if (baseType === 'childcare') balanceKeyBase = 'childCare';
                else if (baseType === 'pinkleave') balanceKeyBase = 'pink';
                else if (baseType === 'maternity') balanceKeyBase = 'maternity';
                
                const typeKeyStr = `${balanceKeyBase}Total`;
                const usedKeyStr = `${balanceKeyBase}Used`;
                const pendingKeyStr = `${balanceKeyBase}Pending`;

                const total = (balance[typeKeyStr as keyof LeaveBalance] as number) || 0;
                const used = (balance[usedKeyStr as keyof LeaveBalance] as number) || 0;
                const pending = (balance[pendingKeyStr as keyof LeaveBalance] as number) || 0;
                setLeaveBalance(total - used - pending);
            } catch (err) {
                console.error('Failed to fetch initial data:', err);
            }
        };
        fetchData();
    }, [user, watchLeaveType]);

    // Sync endDate with startDate for corrections/permissions
    React.useEffect(() => {
        if (['Correction', 'Permission'].includes(watchLeaveType)) {
            setValue('endDate', watchStartDate);
        }
    }, [watchStartDate, watchLeaveType, setValue]);
 
     // If working (Checked In) and applying for Sick leave today, default to Half Day
     React.useEffect(() => {
         if (!watchStartDate) return;
         const isToday = isSameDay(new Date(watchStartDate.replace(/-/g, '/')), new Date());
         if (watchLeaveType === 'Sick' && isToday && isCheckedIn) {
             setValue('dayOption', 'half');
         }
     }, [watchLeaveType, watchStartDate, isCheckedIn, setValue]);

    const isSingleDay = useMemo(() => {
        if (!watchStartDate || !watchEndDate) return false;
        return isSameDay(new Date(watchStartDate.replace(/-/g, '/')), new Date(watchEndDate.replace(/-/g, '/')));
    }, [watchStartDate, watchEndDate]);

    const showHalfDayOption = isSingleDay && !['Correction', 'Permission'].includes(watchLeaveType);
    const showDoctorCertUpload = useMemo(() => {
        if (watchLeaveType !== 'Sick' || !watchStartDate || !watchEndDate) return false;
        const duration = differenceInCalendarDays(new Date(watchEndDate.replace(/-/g, '/')), new Date(watchStartDate.replace(/-/g, '/'))) + 1;
        return duration > sickLeaveCertificateThreshold;
    }, [watchLeaveType, watchStartDate, watchEndDate, sickLeaveCertificateThreshold]);

    // Auto-fetch attendance logs for Correction type
    React.useEffect(() => {
        const fetchLogs = async () => {
            if (!['Correction', 'Permission'].includes(watchLeaveType) || !watchStartDate || !user || isInitialLoading) return;
            
            setIsFetchingLogs(true);
            try {
                // Use UTC boundaries to match common API patterns for specific day queries
                const startDate = `${watchStartDate}T00:00:00Z`;
                const endDate = `${watchStartDate}T23:59:59Z`;
                const events = await api.getAttendanceEvents(user.id, startDate, endDate);
                
                if (events && events.length > 0) {
                    const punchInEvents = events.filter(e => e.type === 'punch-in' || (e as any).type === 'punch_in');
                    const punchOutEvents = events.filter(e => e.type === 'punch-out' || (e as any).type === 'punch_out');
                    const breakInEvents = events.filter(e => e.type === 'break-in' || (e as any).type === 'break_in');
                    const breakOutEvents = events.filter(e => e.type === 'break-out' || (e as any).type === 'break_out');
                    const siteOtInEvents = events.filter(e => e.type === 'site-ot-in' || (e as any).type === 'site_ot_in');
                    const siteOtOutEvents = events.filter(e => e.type === 'site-ot-out' || (e as any).type === 'site_ot_out');

                    // Punch In: Earliest
                    if (punchInEvents.length > 0) {
                        const earliestIn = punchInEvents.reduce((prev, curr) => 
                            new Date(curr.timestamp) < new Date(prev.timestamp) ? curr : prev
                        );
                        setValue('punchIn', format(new Date(earliestIn.timestamp), 'HH:mm'), { shouldValidate: true });
                        if (earliestIn.locationName) setValue('locationName', earliestIn.locationName);
                    }

                    // Punch Out: Latest
                    if (punchOutEvents.length > 0) {
                        const latestOut = punchOutEvents.reduce((prev, curr) => 
                            new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev
                        );
                        setValue('punchOut', format(new Date(latestOut.timestamp), 'HH:mm'), { shouldValidate: true });
                        // If no punch-in location, try punch-out location
                        if (!punchInEvents[0]?.locationName && latestOut.locationName) {
                            setValue('locationName', latestOut.locationName);
                        }
                    }

                    // Breaks: Earliest Break-in and Latest Break-out
                    if (breakInEvents.length > 0 || breakOutEvents.length > 0) {
                        setValue('includeBreak', true);
                        if (breakInEvents.length > 0) {
                            const earliestBIn = breakInEvents.reduce((prev, curr) => 
                                new Date(curr.timestamp) < new Date(prev.timestamp) ? curr : prev
                            );
                            setValue('breakIn', format(new Date(earliestBIn.timestamp), 'HH:mm'), { shouldValidate: true });
                        }

                        if (breakOutEvents.length > 0) {
                            const latestBOut = breakOutEvents.reduce((prev, curr) => 
                                new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev
                            );
                            setValue('breakOut', format(new Date(latestBOut.timestamp), 'HH:mm'), { shouldValidate: true });
                        }
                    }

                    // Site OT: Earliest OT-in and Latest OT-out
                    if (siteOtInEvents.length > 0 || siteOtOutEvents.length > 0) {
                        setValue('includeSiteOt', true);
                        if (siteOtInEvents.length > 0) {
                            const earliestOTIn = siteOtInEvents.reduce((prev, curr) => 
                                new Date(curr.timestamp) < new Date(prev.timestamp) ? curr : prev
                            );
                            setValue('siteOtIn', format(new Date(earliestOTIn.timestamp), 'HH:mm'), { shouldValidate: true });
                        }

                        if (siteOtOutEvents.length > 0) {
                            const latestOTOut = siteOtOutEvents.reduce((prev, curr) => 
                                new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev
                            );
                            setValue('siteOtOut', format(new Date(latestOTOut.timestamp), 'HH:mm'), { shouldValidate: true });
                        }
                    }
                } else {
                    // FALLBACK: If no events found, pre-fill with configured office hours from rules
                    if (rules?.fixedOfficeHours) {
                        setValue('punchIn', rules.fixedOfficeHours.checkInTime, { shouldValidate: true });
                        setValue('punchOut', rules.fixedOfficeHours.checkOutTime, { shouldValidate: true });
                        
                        // Fill Breaks if configured
                        if (rules.fixedOfficeHours.breakInTime) {
                            setValue('includeBreak', true);
                            setValue('breakIn', rules.fixedOfficeHours.breakInTime, { shouldValidate: true });
                        }
                        if (rules.fixedOfficeHours.breakOutTime) {
                            setValue('includeBreak', true);
                            setValue('breakOut', rules.fixedOfficeHours.breakOutTime, { shouldValidate: true });
                        }

                        // Fill OT if configured
                        if (rules.fixedOfficeHours.siteOtInTime) {
                            setValue('includeSiteOt', true);
                            setValue('siteOtIn', rules.fixedOfficeHours.siteOtInTime, { shouldValidate: true });
                        }
                        if (rules.fixedOfficeHours.siteOtOutTime) {
                            setValue('includeSiteOt', true);
                            setValue('siteOtOut', rules.fixedOfficeHours.siteOtOutTime, { shouldValidate: true });
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch attendance logs:', err);
                // Non-blocking error, just keep as is or log it
            } finally {
                setIsFetchingLogs(false);
            }
        };

        fetchLogs();
    }, [watchStartDate, watchLeaveType, user, setValue, isInitialLoading]);

    React.useEffect(() => {
        const fetchRequest = async () => {
            if (!editId || !user) return;
            try {
                // We need to find the specific request. getLeaveRequests can filter by userId.
                const response = await api.getLeaveRequests({ userId: user.id });
                const userRequests = response.data || [];
                const requestToEdit = userRequests.find(r => r.id === editId);
                
                if (requestToEdit) {
                    const editableStatuses: LeaveRequestStatus[] = ['pending_manager_approval', 'rejected', 'cancelled', 'withdrawn'];
                    if (!editableStatuses.includes(requestToEdit.status)) {
                        setToast({ message: 'This request cannot be edited in its current state.', type: 'error' });
                        setTimeout(() => navigate('/leaves/dashboard'), 1500);
                        return;
                    }
                    setValue('leaveType', requestToEdit.leaveType);
                    setValue('startDate', requestToEdit.startDate);
                    setValue('endDate', requestToEdit.endDate);
                    setValue('reason', requestToEdit.reason);
                    setValue('dayOption', requestToEdit.dayOption);
                    // Certificate handling is tricky since we only have Path/URL, let's keep it for now
                } else {
                    setToast({ message: 'Request not found.', type: 'error' });
                    navigate('/leaves/dashboard');
                }
            } catch (err) {
                setToast({ message: 'Failed to load request details.', type: 'error' });
            } finally {
                setIsInitialLoading(false);
            }
        };
        fetchRequest();
    }, [editId, user, setValue, navigate]);

    const onSubmit: SubmitHandler<LeaveRequestFormData> = async (formData) => {
        if (!user || isSubmitting) return;
        setIsSubmitting(true);
        try {
            // --- DUPLICATE CHECK ---
            // Fetch any existing requests for this user that overlap with the selected dates
            const { data: existingRequests } = await api.getLeaveRequests({ 
                userId: user.id,
                startDate: formData.startDate,
                endDate: formData.leaveType === 'Correction' ? formData.startDate : formData.endDate
            });

            // Filter out rejected, cancelled, and withdrawn requests, and the current request if in Edit Mode
            const conflictingRequests = existingRequests.filter(req => 
                req.status !== 'rejected' && 
                req.status !== 'cancelled' &&
                req.status !== 'withdrawn' &&
                (!isEditMode || req.id !== editId)
            );

            if (conflictingRequests.length > 0) {
                const conflict = conflictingRequests[0];
                const typeName = getLeaveTypeDisplay(conflict.leaveType);
                setToast({ 
                    message: `Conflict Detected: You already have a ${typeName} request (${conflict.status.replace(/_/g, ' ')}) for these dates. Duplicate requests are not allowed.`, 
                    type: 'error' 
                });
                setIsSubmitting(false);
                return;
            }



            const startDateObj = new Date(formData.startDate.replace(/-/g, '/'));
            const endDateObj = new Date(formData.endDate.replace(/-/g, '/'));
            const duration = formData.dayOption === 'half' ? 0.5 : differenceInCalendarDays(endDateObj, startDateObj) + 1;

            // Strict time check: 
            // 1. Sick Leave, Correction, and Permission can be applied for any date (past/present/future).
            // 2. All other leaves must be applied at least one day in advance (no past or present days).
            if (!['Correction', 'Permission', 'Sick'].includes(formData.leaveType)) {
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                if (startDateObj <= todayMidnight) {
                    setToast({ message: 'This type of leave must be applied at least one day in advance. Past and present days are not allowed.', type: 'error' });
                    setIsSubmitting(false);
                    return;
                }
            }

            // Earned Leave restriction: Cannot be 7 or more continuous days
            if (formData.leaveType === 'Earned' && duration >= 7) {
                setToast({ message: 'You cannot apply for Earned Leave for 7 or more continuous days.', type: 'error' });
                setIsSubmitting(false);
                return;
            }

            // Check balance before submitting
            // Skip balance check for 'Loss of Pay', 'WFH', 'Correction', and 'Permission'
            if (!['Loss of Pay', 'WFH', 'Correction', 'Permission'].includes(formData.leaveType)) {
                const balance = await api.getLeaveBalancesForUser(user.id);
                
                const baseType = formData.leaveType.toLowerCase().replace(/\s/g, '');
                let balanceKeyBase = baseType;
                
                if (baseType === 'compoff') balanceKeyBase = 'compOff';
                else if (baseType === 'childcare') balanceKeyBase = 'childCare';
                else if (baseType === 'pinkleave') balanceKeyBase = 'pink';
                else if (baseType === 'maternity') balanceKeyBase = 'maternity';
                
                const typeKeyStr = `${balanceKeyBase}Total`;
                const usedKeyStr = `${balanceKeyBase}Used`;
                const pendingKeyStr = `${balanceKeyBase}Pending`;
                
                // Expiry Check
                const leaveTypeLower = formData.leaveType.toLowerCase().replace(/\s/g, '');
                let leaveTypeMapped = leaveTypeLower;
                if (leaveTypeLower === 'compoff') leaveTypeMapped = 'compOff';
                else if (leaveTypeLower === 'pinkleave') leaveTypeMapped = 'pink';
                else if (leaveTypeLower === 'childcare') leaveTypeMapped = 'childCare';
                else if (leaveTypeLower === 'maternity') leaveTypeMapped = 'maternity';
                
                const isExpired = balance.expiryStates && (balance.expiryStates as any)[leaveTypeMapped];
                
                if (isExpired) {
                    setToast({ message: `The ${formData.leaveType} allocation has expired and is no longer available for use.`, type: 'error' });
                    setIsSubmitting(false);
                    return;
                }

                const total = (balance[typeKeyStr as keyof LeaveBalance] as number) || 0;
                const used = (balance[usedKeyStr as keyof LeaveBalance] as number) || 0;
                const pending = (balance[pendingKeyStr as keyof LeaveBalance] as number) || 0;
                let available = total - used - pending;

                // Add back the old duration if we are editing the same leave type
                if (isEditMode && editId) {
                    const { data: allUserRequests } = await api.getLeaveRequests({ userId: user.id });
                    const requestToEdit = allUserRequests.find((r: any) => r.id === editId);
                    if (requestToEdit && requestToEdit.leaveType === formData.leaveType) {
                        const oldStartDate = new Date(requestToEdit.startDate.replace(/-/g, '/'));
                        const oldEndDate = new Date(requestToEdit.endDate.replace(/-/g, '/'));
                        const oldDuration = requestToEdit.dayOption === 'half' ? 0.5 : differenceInCalendarDays(oldEndDate, oldStartDate) + 1;
                        available += oldDuration;
                    }
                }
                
                if (available < duration) {
                    setToast({ message: `Insufficient ${formData.leaveType} balance. You have ${available.toFixed(1)} days available, but requested ${duration} days.`, type: 'error' });
                    setIsSubmitting(false);
                    return;
                }
            }
            
            // Check Limits for Permission
            if (formData.leaveType === 'Permission') {
                if (!rules?.enablePermission) {
                    setToast({ message: 'Permissions are currently disabled by the administrator.', type: 'error' });
                    setIsSubmitting(false);
                    return;
                }

                // Verify duration
                const getMinutes = (timeStr: string) => {
                    if (!timeStr) return 0;
                    const [h, m] = timeStr.split(':').map(Number);
                    return h * 60 + m;
                };

                const startMins = getMinutes(formData.punchIn || '00:00');
                const endMins = getMinutes(formData.punchOut || '00:00');
                let durationHours = (endMins - startMins) / 60;
                if (durationHours < 0) durationHours += 24;

                const maxHours = rules.maxPermissionDurationHours || 2;
                if (durationHours > maxHours) {
                    setToast({ message: `Permission requests cannot exceed ${maxHours} hours. You requested ${durationHours.toFixed(1)} hours.`, type: 'error' });
                    setIsSubmitting(false);
                    return;
                }

                if (!isEditMode) {
                    const currentMonthStart = formData.startDate.substring(0, 7);
                    const { data: allReqs } = await api.getLeaveRequests({ userId: user.id });
                    const monthPerms = allReqs.filter(r => 
                        r.leaveType === 'Permission' && 
                        r.status !== 'rejected' &&
                        r.status !== 'withdrawn' &&
                        r.startDate.startsWith(currentMonthStart)
                    );

                    const maxPerms = rules.maxPermissionsPerMonth || 3;
                    if (monthPerms.length >= maxPerms) {
                        setToast({ message: `You have reached the maximum allowed permissions (${maxPerms}) for this month.`, type: 'error' });
                        setIsSubmitting(false);
                        return;
                    }
                }
            }
            
            // Check Limits for Correction
            if (formData.leaveType === 'Correction') {
                if (rules?.enableCorrectionLimits) {
                    // Verify duration
                    const getMinutes = (timeStr: string) => {
                        if (!timeStr) return 0;
                        const [h, m] = timeStr.split(':').map(Number);
                        return h * 60 + m;
                    };

                    const startMins = getMinutes(formData.punchIn || '00:00');
                    const endMins = getMinutes(formData.punchOut || '00:00');
                    let durationHours = (endMins - startMins) / 60;
                    if (durationHours < 0) durationHours += 24;

                    const maxHours = rules.maxCorrectionDurationHours || 2;
                    if (durationHours > maxHours) {
                        setToast({ message: `Correction requests cannot exceed ${maxHours} hours. You requested ${durationHours.toFixed(1)} hours.`, type: 'error' });
                        setIsSubmitting(false);
                        return;
                    }

                    if (!isEditMode) {
                        const currentMonthStart = formData.startDate.substring(0, 7);
                        const { data: allReqs } = await api.getLeaveRequests({ userId: user.id });
                        const monthCorrections = allReqs.filter(r => 
                            r.leaveType === 'Correction' && 
                            r.status !== 'rejected' &&
                            r.status !== 'withdrawn' &&
                            r.startDate.startsWith(currentMonthStart)
                        );

                        const maxCorrections = rules.maxCorrectionsPerMonth || 3;
                        if (monthCorrections.length >= maxCorrections) {
                            setToast({ message: `You have reached the maximum allowed corrections (${maxCorrections}) for this month.`, type: 'error' });
                            setIsSubmitting(false);
                            return;
                        }
                    }
                }
            }

            // Sanitize payload to exclude internal UI-only fields from top-level DB columns
            const { 
                leaveType, startDate, endDate, dayOption, reason, doctorCertificate,
                correctionStatus, punchIn, punchOut, includeBreak, breakIn, breakOut, 
                locationName, includeSiteOt, siteOtIn, siteOtOut
            } = formData;

            const basePayload: any = {
                leaveType,
                startDate,
                endDate: ['Correction', 'Permission'].includes(leaveType) ? startDate : endDate,
                dayOption,
                reason,
                doctorCertificate,
                userId: user.id,
                userName: user.name
            };

            // Add correction details only for Correction and Permission types
            if (['Correction', 'Permission'].includes(leaveType)) {
                basePayload.correctionDetails = {
                    status: correctionStatus,
                    punchIn,
                    punchOut,
                    breakIn,
                    breakOut,
                    locationName,
                    includeSiteOt,
                    siteOtIn,
                    siteOtOut
                };
            }

            if (isEditMode && editId) {
                // When editing a request that was previously rejected or cancelled, 
                // reset its status to start the approval flow again.
                await api.updateLeaveRequest(editId, {
                    ...basePayload,
                    status: 'pending_manager_approval'
                });
                setToast({ message: 'Leave request updated successfully!', type: 'success' });
            } else {
                await api.submitLeaveRequest(basePayload);
                setToast({ message: 'Leave request submitted successfully!', type: 'success' });
            }
            setTimeout(() => navigate('/leaves/dashboard'), 1500);
        } catch (err) {
            setToast({ message: isEditMode ? 'Failed to update leave request.' : 'Failed to submit leave request.', type: 'error' });
            setIsSubmitting(false);
        }
    };

    const getLeaveTypeDisplay = (type: string) => {
        switch (type) {
            case 'Earned': return 'Earned Leave';
            case 'Sick': return 'Sick Leave';
            case 'Floating': return 'Blue Leave';
            case 'Pink Leave': return 'Pink Leave';
            case 'Comp Off': return 'Comp Off';
            case 'Loss of Pay': return 'Loss of Pay';
            case 'Maternity': return 'Maternity Leave';
            case 'Child Care': return 'Child Care Leave';
            case 'WFH': return 'Work From Home (WFH)';
            case 'Correction': return 'Correction';
            case 'Permission': return 'Request for Permission';
            default: return type;
        }
    };

    if (!user) return null;

    return (
        <div className={`min-h-screen bg-page ${isMobile ? '' : 'p-6'}`}>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <div className={`w-full ${isMobile ? '' : 'md:bg-card md:p-8 md:rounded-2xl md:shadow-card md:border md:border-border'}`}>
                <header 
                    className={`p-4 flex items-center gap-4 ${isMobile ? 'fixed top-0 left-0 right-0 z-50 bg-[#041b0f]/80 backdrop-blur-lg border-b border-emerald-500/10' : 'mb-8'}`}
                    style={isMobile ? { paddingTop: 'calc(1rem + env(safe-area-inset-top))' } : {}}
                >
                    {isMobile && (
                        <Button 
                            variant="secondary" 
                            onClick={() => navigate(-1)} 
                            className="p-2 rounded-full h-10 w-10 flex items-center justify-center bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-2xl font-black text-primary-text tracking-tight uppercase text-lg">
                            {isEditMode ? 'Edit Request' : `Applying for Leave`}
                        </h1>
                        {!isEditMode && (
                            <p className="text-xs font-bold text-muted/60 uppercase tracking-widest mt-0.5">
                                Balance: <span className="text-emerald-500">{leaveBalance.toFixed(1)} days</span>
                            </p>
                        )}
                    </div>
                </header>

                <div 
                    className={`${isMobile ? 'px-4' : ''}`} 
                    style={isMobile ? { paddingTop: 'calc(5rem + env(safe-area-inset-top))' } : {}}
                >
                    <form 
                        id="leave-form" 
                        onSubmit={handleSubmit(onSubmit)} 
                        className={`space-y-8 ${isMobile ? 'bg-[#0d2c18]/30 backdrop-blur-xl rounded-[2.5rem] p-8 border border-emerald-500/10 shadow-2xl' : ''}`}
                    >
                        <div className="space-y-6">
                            <Controller 
                                name="leaveType" 
                                control={control} 
                                render={({ field }) => (
                                    <Select 
                                        label="Leave Type" 
                                        {...field} 
                                        error={errors.leaveType?.message} 
                                        className={isMobile ? 'pro-select pro-select-arrow' : ''}
                                    >
                                        <option value="Earned">Earned</option>
                                        <option value="Sick">Sick</option>
                                        <option value={isFemale ? "Pink Leave" : "Floating"}>{isFemale ? "Pink Leave" : "Blue Leave"}</option>
                                        <option value="Comp Off">Comp Off</option>
                                        <option value="Loss of Pay">Loss of Pay</option>
                                        {(isFemale && (userChildren.length > 0 || (fullBalance && fullBalance.childCareTotal > 0))) && <option value="Child Care">Child Care</option>}
                                        {(isFemale && fullBalance && fullBalance.maternityTotal > 0) && <option value="Maternity">Maternity Leave</option>}
                                        <option value="WFH">Work From Home (WFH)</option>
                                        <option value="Correction">Request for Correction</option>
                                        {(rules?.enablePermission || rules?.enablePermission === undefined) && (
                                            <option value="Permission">Request for Permission</option>
                                        )}
                                    </Select>
                                )} 
                            />

                            {isMobile ? (
                                <div className="space-y-6">
                                    <div className={`grid gap-4 ${['Correction', 'Permission'].includes(watchLeaveType) ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                        <Controller
                                            name="startDate"
                                            control={control}
                                            render={({ field }) => (
                                                <NativeDatePicker
                                                    label={['Correction', 'Permission'].includes(watchLeaveType) ? "Target Date" : "From"}
                                                    value={field.value}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                    error={errors.startDate?.message}
                                                />
                                            )}
                                        />
                                        {!['Correction', 'Permission'].includes(watchLeaveType) && (
                                            <Controller
                                                name="endDate"
                                                control={control}
                                                render={({ field }) => (
                                                    <NativeDatePicker
                                                        label="To"
                                                        value={field.value}
                                                        onChange={(e) => field.onChange(e.target.value)}
                                                        min={watchStartDate}
                                                        error={errors.endDate?.message}
                                                    />
                                                )}
                                            />
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className={`grid gap-4 ${['Correction', 'Permission'].includes(watchLeaveType) ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                    <Controller 
                                        name="startDate" 
                                        control={control} 
                                        render={({ field }) => (
                                            <DatePicker 
                                                label={['Correction', 'Permission'].includes(watchLeaveType) ? "Date" : "Start Date"} 
                                                id="startDate" 
                                                value={field.value} 
                                                onChange={field.onChange} 
                                                error={errors.startDate?.message} 
                                            />
                                        )} 
                                    />
                                    {!['Correction', 'Permission'].includes(watchLeaveType) && (
                                        <Controller 
                                            name="endDate" 
                                            control={control} 
                                            render={({ field }) => (
                                                <DatePicker 
                                                    label="End Date" 
                                                    id="endDate" 
                                                    value={field.value} 
                                                    onChange={field.onChange} 
                                                    error={errors.endDate?.message} 
                                                />
                                            )} 
                                        />
                                    )}
                                </div>
                            )}

                            {showHalfDayOption && (
                                <Controller 
                                    name="dayOption" 
                                    control={control} 
                                    render={({ field }) => (
                                        <Select 
                                            label="Day Option" 
                                            {...field} 
                                            className={isMobile ? 'pro-select pro-select-arrow' : ''}
                                        >
                                            <option value="full">Full Day</option>
                                            <option value="half">Half Day</option>
                                        </Select>
                                    )} 
                                />
                            )}

                            {['Correction', 'Permission'].includes(watchLeaveType) && (
                                <div className="space-y-4 pt-4 border-t border-emerald-500/10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Controller 
                                            name="correctionStatus" 
                                            control={control} 
                                            render={({ field }) => (
                                                <Select label="Status" {...field} error={errors.correctionStatus?.message}>
                                                    <option value="Present">Present (Office)</option>
                                                    <option value="Site Visit">Site Visit (Field)</option>
                                                    <option value="W/H">Work From Home</option>
                                                </Select>
                                            )} 
                                        />
                                        {(watch('correctionStatus') === 'Present' || watch('correctionStatus') === 'Site Visit') && (
                                            <div className="space-y-1">
                                                <label className="text-sm font-medium text-muted">Location / Site Name</label>
                                                <Controller
                                                    name="locationName"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <input 
                                                            {...field} 
                                                            placeholder={watch('correctionStatus') === 'Site Visit' ? "e.g. Client Site" : "e.g. Office"}
                                                            className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-accent outline-none transition-all ${isMobile ? 'bg-emerald-500/5 border-emerald-500/10 text-primary-text placeholder:text-white/10' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'}`}
                                                        />
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className={`grid grid-cols-2 gap-4 p-5 rounded-2xl border relative transition-all ${isFetchingLogs ? 'opacity-50 pointer-events-none' : ''} ${isMobile ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-gray-50 border-gray-100'}`}>
                                        {isFetchingLogs && (
                                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent"></div>
                                            </div>
                                        )}
                                        <Controller 
                                            name="punchIn" 
                                            control={control} 
                                            render={({ field }) => (
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-muted flex items-center gap-1.5 uppercase tracking-wider">
                                                        <Clock className="w-3.5 h-3.5 text-green-500" /> Punch In
                                                    </label>
                                                    <input type="time" {...field} className={`w-full p-2.5 rounded-lg border text-sm ${isMobile ? 'bg-[#041b0f] border-emerald-500/20 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                                                    {errors.punchIn && <p className="text-xs text-red-500">{errors.punchIn.message}</p>}
                                                </div>
                                            )} 
                                        />
                                        <Controller 
                                            name="punchOut" 
                                            control={control} 
                                            render={({ field }) => (
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-muted flex items-center gap-1.5 uppercase tracking-wider">
                                                        <Clock className="w-3.5 h-3.5 text-red-500" /> Punch Out
                                                    </label>
                                                    <input type="time" {...field} className={`w-full p-2.5 rounded-lg border text-sm ${isMobile ? 'bg-[#041b0f] border-emerald-500/20 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                                                    {errors.punchOut && <p className="text-xs text-red-500">{errors.punchOut.message}</p>}
                                                </div>
                                            )} 
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                id="includeBreak" 
                                                {...register('includeBreak')} 
                                                className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                                            />
                                            <label htmlFor="includeBreak" className="text-sm font-medium text-primary-text">Include Lunch Break?</label>
                                        </div>

                                        {watch('includeBreak') && (
                                            <div className={`grid grid-cols-2 gap-4 p-5 rounded-2xl border ${isMobile ? 'bg-orange-500/5 border-orange-500/20' : 'bg-orange-50 border-orange-100'}`}>
                                                <Controller 
                                                    name="breakIn" 
                                                    control={control} 
                                                    render={({ field }) => (
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-semibold text-muted uppercase tracking-wider">Break In</label>
                                                            <input type="time" {...field} className={`w-full p-2.5 rounded-lg border text-sm ${isMobile ? 'bg-[#041b0f] border-emerald-500/20 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                                                            {errors.breakIn && <p className="text-xs text-red-500">{errors.breakIn.message}</p>}
                                                        </div>
                                                    )} 
                                                />
                                                <Controller 
                                                    name="breakOut" 
                                                    control={control} 
                                                    render={({ field }) => (
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-semibold text-muted uppercase tracking-wider">Break Out</label>
                                                            <input type="time" {...field} className={`w-full p-2.5 rounded-lg border text-sm ${isMobile ? 'bg-[#041b0f] border-emerald-500/20 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                                                            {errors.breakOut && <p className="text-xs text-red-500">{errors.breakOut.message}</p>}
                                                        </div>
                                                    )} 
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {(userCategory === 'field' || userCategory === 'site') && (
                                        <div className="space-y-3 pt-4 border-t border-emerald-500/10">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    id="includeSiteOt" 
                                                    {...register('includeSiteOt')} 
                                                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-600"
                                                />
                                                <label htmlFor="includeSiteOt" className="text-sm font-medium text-primary-text">Include Site Overtime?</label>
                                            </div>

                                            {watch('includeSiteOt') && (
                                                <div className={`grid grid-cols-2 gap-4 p-5 rounded-2xl border ${isMobile ? 'bg-purple-500/5 border-purple-500/20' : 'bg-purple-50 border-purple-100'}`}>
                                                    <Controller 
                                                        name="siteOtIn" 
                                                        control={control} 
                                                        render={({ field }) => (
                                                            <div className="space-y-1">
                                                                <label className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1">
                                                                    <Clock className="w-3.5 h-3.5 text-purple-500" /> Site OT In
                                                                </label>
                                                                <input type="time" {...field} className={`w-full p-3 rounded-xl border text-sm outline-none ${isMobile ? 'bg-[#041b0f] border-emerald-500/20 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                                                                {errors.siteOtIn && <p className="text-xs text-red-500">{errors.siteOtIn.message}</p>}
                                                            </div>
                                                        )} 
                                                    />
                                                    <Controller 
                                                        name="siteOtOut" 
                                                        control={control} 
                                                        render={({ field }) => (
                                                            <div className="space-y-1">
                                                                <label className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1">
                                                                    <Clock className="w-3.5 h-3.5 text-purple-500" /> Site OT Out
                                                                </label>
                                                                <input type="time" {...field} className={`w-full p-3 rounded-xl border text-sm outline-none ${isMobile ? 'bg-[#041b0f] border-emerald-500/20 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                                                                {errors.siteOtOut && <p className="text-xs text-red-500">{errors.siteOtOut.message}</p>}
                                                            </div>
                                                        )} 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-muted mb-2 tracking-wide uppercase text-[10px] font-black">
                                    {watchLeaveType === 'Correction' ? 'Reason for requesting Correction' : `Reason for applying ${getLeaveTypeDisplay(watchLeaveType)}`}
                                </label>
                                <textarea 
                                    {...register('reason')} 
                                    rows={4} 
                                    placeholder="Please provide details about your leave request..."
                                    className={`w-full p-5 rounded-2xl border text-primary-text focus:ring-2 focus:ring-accent outline-none transition-all ${isMobile ? 'bg-emerald-500/5 border-emerald-500/10 placeholder:text-white/10' : 'bg-white border-gray-200 placeholder:text-gray-400'} ${errors.reason ? 'border-red-500' : ''}`} 
                                />
                                {errors.reason && <p className="mt-2 text-xs text-red-500 font-bold">{errors.reason.message}</p>}
                            </div>

                            {showDoctorCertUpload && (
                                <div className="pt-4 border-t border-emerald-500/10">
                                    <Controller 
                                        name="doctorCertificate" 
                                        control={control} 
                                        render={({ field, fieldState }) => (
                                            <UploadDocument 
                                                label="Doctor's Certificate (Required)" 
                                                file={field.value} 
                                                onFileChange={field.onChange} 
                                                error={fieldState.error?.message} 
                                                allowCapture 
                                            />
                                        )} 
                                    />
                                </div>
                            )}
                        </div>

                        <div className={`flex items-center gap-4 ${isMobile ? 'pb-10 pt-4' : 'pt-6 justify-end'}`}>
                            <Button type="button" variant="danger" onClick={() => navigate(-1)} disabled={isSubmitting} className="flex-1 md:flex-none md:w-32">Cancel</Button>
                            <Button type="submit" form="leave-form" isLoading={isSubmitting} className="flex-1 md:flex-none md:w-48">{isEditMode ? 'Update Request' : 'Submit'}</Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ApplyLeave;
