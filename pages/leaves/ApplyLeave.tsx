import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getStaffCategory } from '../../utils/attendanceCalculations';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import type { LeaveType, UploadedFile, LeaveBalance, UserChild } from '../../types';
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
    leaveType: yup.string<LeaveType>().oneOf(['Earned', 'Sick', 'Floating', 'Comp Off', 'Loss of Pay', 'Maternity', 'Child Care', 'Pink Leave', 'WFH', 'Correction']).required('Leave type is required'),
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
        is: 'Correction',
        then: schema => schema.required('Status is required for corrections'),
        otherwise: schema => schema.optional()
    }),
    punchIn: yup.string().when('leaveType', {
        is: 'Correction',
        then: schema => schema.required('Punch in time is required'),
        otherwise: schema => schema.optional()
    }),
    punchOut: yup.string().when('leaveType', {
        is: 'Correction',
        then: schema => schema.required('Punch out time is required'),
        otherwise: schema => schema.optional()
    }),
    locationName: yup.string().optional(),
    breakIn: yup.string().when(['leaveType', 'includeBreak'], {
        is: (lt: string, ib: boolean) => lt === 'Correction' && ib === true,
        then: schema => schema.required('Break in time is required'),
        otherwise: schema => schema.optional()
    }),
    breakOut: yup.string().when(['leaveType', 'includeBreak'], {
        is: (lt: string, ib: boolean) => lt === 'Correction' && ib === true,
        then: schema => schema.required('Break out time is required'),
        otherwise: schema => schema.optional()
    }),
    siteOtIn: yup.string().when(['leaveType', 'includeSiteOt'], {
        is: (lt: string, ot: boolean) => lt === 'Correction' && ot === true,
        then: schema => schema.required('Site OT in time is required'),
        otherwise: schema => schema.optional()
    }),
    siteOtOut: yup.string().when(['leaveType', 'includeSiteOt'], {
        is: (lt: string, ot: boolean) => lt === 'Correction' && ot === true,
        then: schema => schema.required('Site OT out time is required'),
        otherwise: schema => schema.optional()
    })
});

const ApplyLeave: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const { attendance: { office: { sickLeaveCertificateThreshold } } } = useSettingsStore();

    const validationSchema = useMemo(() => getLeaveValidationSchema(sickLeaveCertificateThreshold), [sickLeaveCertificateThreshold]);
    const userCategory = useMemo(() => getStaffCategory(user?.role), [user?.role]);
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('edit');
    const isEditMode = !!editId;
    const isFemale = user?.gender?.toLowerCase() === 'female';
    const [isInitialLoading, setIsInitialLoading] = React.useState(isEditMode);
    const [isFetchingLogs, setIsFetchingLogs] = React.useState(false);
    const [userChildren, setUserChildren] = React.useState<UserChild[]>([]);
    const [leaveBalance, setLeaveBalance] = React.useState<number>(0);

    const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<LeaveRequestFormData>({
        resolver: yupResolver(validationSchema) as Resolver<LeaveRequestFormData>,
        defaultValues: { 
            leaveType: 'Earned', 
            startDate: format(new Date(), 'yyyy-MM-dd'), 
            endDate: format(new Date(), 'yyyy-MM-dd'), 
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
                const baseType = watchLeaveType.toLowerCase().replace(/\s/g, '');
                let balanceKeyBase = baseType;
                
                if (baseType === 'compoff') balanceKeyBase = 'compOff';
                else if (baseType === 'childcare') balanceKeyBase = 'childCare';
                else if (baseType === 'pinkleave') balanceKeyBase = 'pink';
                
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

    // Sync endDate with startDate for corrections
    React.useEffect(() => {
        if (watchLeaveType === 'Correction') {
            setValue('endDate', watchStartDate);
        }
    }, [watchStartDate, watchLeaveType, setValue]);

    const isSingleDay = useMemo(() => {
        if (!watchStartDate || !watchEndDate) return false;
        return isSameDay(new Date(watchStartDate.replace(/-/g, '/')), new Date(watchEndDate.replace(/-/g, '/')));
    }, [watchStartDate, watchEndDate]);

    const showHalfDayOption = isSingleDay && watchLeaveType !== 'Correction';
    const showDoctorCertUpload = useMemo(() => {
        if (watchLeaveType !== 'Sick' || !watchStartDate || !watchEndDate) return false;
        const duration = differenceInCalendarDays(new Date(watchEndDate.replace(/-/g, '/')), new Date(watchStartDate.replace(/-/g, '/'))) + 1;
        return duration > sickLeaveCertificateThreshold;
    }, [watchLeaveType, watchStartDate, watchEndDate, sickLeaveCertificateThreshold]);

    // Auto-fetch attendance logs for Correction type
    React.useEffect(() => {
        const fetchLogs = async () => {
            if (watchLeaveType !== 'Correction' || !watchStartDate || !user || isInitialLoading) return;
            
            setIsFetchingLogs(true);
            try {
                // Use UTC boundaries to match common API patterns for specific day queries
                const startDate = `${watchStartDate}T00:00:00Z`;
                const endDate = `${watchStartDate}T23:59:59Z`;
                const events = await api.getAttendanceEvents(user.id, startDate, endDate);
                
                if (events && events.length > 0) {
                    const punchInEvents = events.filter(e => e.type === 'punch-in');
                    const punchOutEvents = events.filter(e => e.type === 'punch-out');
                    const breakInEvents = events.filter(e => e.type === 'break-in');
                    const breakOutEvents = events.filter(e => e.type === 'break-out');
                    const siteOtInEvents = events.filter(e => e.type === 'site-ot-in');
                    const siteOtOutEvents = events.filter(e => e.type === 'site-ot-out');

                    // Punch In: Earliest
                    if (punchInEvents.length > 0) {
                        const earliestIn = punchInEvents.reduce((prev, curr) => 
                            new Date(curr.timestamp) < new Date(prev.timestamp) ? curr : prev
                        );
                        setValue('punchIn', format(new Date(earliestIn.timestamp), 'HH:mm'), { shouldValidate: true });
                        if (earliestIn.locationName) setValue('locationName', earliestIn.locationName);
                    } else {
                        setValue('punchIn', '00:00', { shouldValidate: true });
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
                    } else {
                        setValue('punchOut', '00:00', { shouldValidate: true });
                    }

                    // Breaks: Earliest Break-in and Latest Break-out
                    if (breakInEvents.length > 0 || breakOutEvents.length > 0) {
                        setValue('includeBreak', true);
                        if (breakInEvents.length > 0) {
                            const earliestBIn = breakInEvents.reduce((prev, curr) => 
                                new Date(curr.timestamp) < new Date(prev.timestamp) ? curr : prev
                            );
                            setValue('breakIn', format(new Date(earliestBIn.timestamp), 'HH:mm'), { shouldValidate: true });
                        } else {
                            setValue('breakIn', '00:00', { shouldValidate: true });
                        }

                        setValue('breakOut', '00:00');
                    }

                    // Site OT: Earliest OT-in and Latest OT-out
                    if (siteOtInEvents.length > 0 || siteOtOutEvents.length > 0) {
                        setValue('includeSiteOt', true);
                        if (siteOtInEvents.length > 0) {
                            const earliestOTIn = siteOtInEvents.reduce((prev, curr) => 
                                new Date(curr.timestamp) < new Date(prev.timestamp) ? curr : prev
                            );
                            setValue('siteOtIn', format(new Date(earliestOTIn.timestamp), 'HH:mm'), { shouldValidate: true });
                        } else {
                            setValue('siteOtIn', '00:00', { shouldValidate: true });
                        }

                        if (siteOtOutEvents.length > 0) {
                            const latestOTOut = siteOtOutEvents.reduce((prev, curr) => 
                                new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev
                            );
                            setValue('siteOtOut', format(new Date(latestOTOut.timestamp), 'HH:mm'), { shouldValidate: true });
                        } else {
                            setValue('siteOtOut', '00:00', { shouldValidate: true });
                        }
                    } else {
                        setValue('includeSiteOt', false);
                        setValue('siteOtIn', '22:00');
                        setValue('siteOtOut', '23:00');
                    }
                } else {
                    // No events found - reset to 00:00 as requested
                    setValue('punchIn', '00:00', { shouldValidate: true });
                    setValue('punchOut', '00:00', { shouldValidate: true });
                    setValue('includeBreak', false);
                    setValue('breakIn', '00:00', { shouldValidate: true });
                    setValue('breakOut', '00:00', { shouldValidate: true });
                    setValue('includeSiteOt', false);
                    setValue('siteOtIn', '22:00', { shouldValidate: true });
                    setValue('siteOtOut', '23:00', { shouldValidate: true });
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
                    if (requestToEdit.status !== 'pending_manager_approval') {
                        setToast({ message: 'Only pending requests can be edited.', type: 'error' });
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
        if (!user) return;
        try {
            // --- DUPLICATE CHECK ---
            // Fetch any existing requests for this user that overlap with the selected dates
            const { data: existingRequests } = await api.getLeaveRequests({ 
                userId: user.id,
                startDate: formData.startDate,
                endDate: formData.leaveType === 'Correction' ? formData.startDate : formData.endDate
            });

            // Filter out rejected requests and the current request if in Edit Mode
            const conflictingRequests = existingRequests.filter(req => 
                req.status !== 'rejected' && 
                (!isEditMode || req.id !== editId)
            );

            if (conflictingRequests.length > 0) {
                const conflict = conflictingRequests[0];
                const typeName = getLeaveTypeDisplay(conflict.leaveType);
                setToast({ 
                    message: `Conflict Detected: You already have a ${typeName} request (${conflict.status.replace(/_/g, ' ')}) for these dates. Duplicate requests are not allowed.`, 
                    type: 'error' 
                });
                return;
            }

            // Check balance before submitting (only for new requests)
            // Skip balance check for 'Loss of Pay', 'WFH', and 'Correction'
            if (!isEditMode && !['Loss of Pay', 'WFH', 'Correction'].includes(formData.leaveType)) {
                const balance = await api.getLeaveBalancesForUser(user.id);
                const startDate = new Date(formData.startDate.replace(/-/g, '/'));
                const endDate = new Date(formData.endDate.replace(/-/g, '/'));
                const duration = formData.dayOption === 'half' ? 0.5 : differenceInCalendarDays(endDate, startDate) + 1;
                
                const baseType = formData.leaveType.toLowerCase().replace(/\s/g, '');
                let balanceKeyBase = baseType;
                
                if (baseType === 'compoff') balanceKeyBase = 'compOff';
                else if (baseType === 'childcare') balanceKeyBase = 'childCare';
                else if (baseType === 'pinkleave') balanceKeyBase = 'pink';
                
                const typeKeyStr = `${balanceKeyBase}Total`;
                const usedKeyStr = `${balanceKeyBase}Used`;
                const pendingKeyStr = `${balanceKeyBase}Pending`;
                
                // Expiry Check
                const leaveTypeLower = formData.leaveType.toLowerCase().replace(/\s/g, '');
                let leaveTypeMapped = leaveTypeLower;
                if (leaveTypeLower === 'compoff') leaveTypeMapped = 'compOff';
                else if (leaveTypeLower === 'pinkleave') leaveTypeMapped = 'pink';
                else if (leaveTypeLower === 'childcare') leaveTypeMapped = 'childCare';
                
                const isExpired = balance.expiryStates && (balance.expiryStates as any)[leaveTypeMapped];
                
                if (isExpired) {
                    setToast({ message: `The ${formData.leaveType} allocation has expired and is no longer available for use.`, type: 'error' });
                    return;
                }

                const total = (balance[typeKeyStr as keyof LeaveBalance] as number) || 0;
                const used = (balance[usedKeyStr as keyof LeaveBalance] as number) || 0;
                const pending = (balance[pendingKeyStr as keyof LeaveBalance] as number) || 0;
                const available = total - used - pending;
                
                if (available < duration) {
                    setToast({ message: `Insufficient ${formData.leaveType} balance. You have ${available.toFixed(1)} days available (including pending requests), but requested ${duration} days.`, type: 'error' });
                    return;
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
                endDate: leaveType === 'Correction' ? startDate : endDate,
                dayOption,
                reason,
                doctorCertificate,
                userId: user.id,
                userName: user.name
            };

            // Add correction details only for Correction type
            if (leaveType === 'Correction') {
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
                await api.updateLeaveRequest(editId, basePayload);
                setToast({ message: 'Leave request updated successfully!', type: 'success' });
            } else {
                await api.submitLeaveRequest(basePayload);
                setToast({ message: 'Leave request submitted successfully!', type: 'success' });
            }
            setTimeout(() => navigate('/leaves/dashboard'), 1500);
        } catch (err) {
            setToast({ message: isEditMode ? 'Failed to update leave request.' : 'Failed to submit leave request.', type: 'error' });
        }
    };

    const getLeaveTypeDisplay = (type: string) => {
        switch (type) {
            case 'Earned': return 'Earned Leave';
            case 'Sick': return 'Sick Leave';
            case 'Floating': return '3rd Saturday Leave';
            case 'Pink Leave': return 'Pink Leave';
            case 'Comp Off': return 'Comp Off';
            case 'Loss of Pay': return 'Loss of Pay';
            case 'Child Care': return 'Child Care Leave';
            case 'WFH': return 'Work From Home (WFH)';
            case 'Correction': return 'Correction';
            default: return type;
        }
    };

    if (!user) return null;

    return (
        <div className={`min-h-screen bg-page ${isMobile ? '' : 'p-6'}`}>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <div className="w-full">
                <header 
                    className={`p-4 flex items-center gap-4 ${isMobile ? 'fixed top-0 left-0 right-0 z-50 bg-[#041b0f]/80 backdrop-blur-lg border-b border-emerald-500/10' : 'mb-8'}`}
                    style={isMobile ? { paddingTop: 'calc(1rem + env(safe-area-inset-top))' } : {}}
                >
                    <Button 
                        variant="secondary" 
                        onClick={() => navigate(-1)} 
                        className="p-2 rounded-full h-10 w-10 flex items-center justify-center bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
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
                        className="bg-[#0d2c18]/30 backdrop-blur-xl rounded-[2.5rem] p-8 border border-emerald-500/10 shadow-2xl space-y-8"
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
                                        <option value={isFemale ? "Pink Leave" : "Floating"}>{isFemale ? "Pink Leave" : "3rd Saturday Leave"}</option>
                                        <option value="Comp Off">Comp Off</option>
                                        <option value="Loss of Pay">Loss of Pay</option>
                                        {isFemale && userChildren.length > 0 && <option value="Child Care">Child Care</option>}
                                        <option value="WFH">Work From Home (WFH)</option>
                                        <option value="Correction">Request for Correction</option>
                                    </Select>
                                )} 
                            />

                            {isMobile ? (
                                <div className="space-y-6">
                                    <div className={`grid gap-4 ${watchLeaveType === 'Correction' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                        <Controller
                                            name="startDate"
                                            control={control}
                                            render={({ field }) => (
                                                <NativeDatePicker
                                                    label={watchLeaveType === 'Correction' ? "Target Date" : "From"}
                                                    value={field.value}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                    error={errors.startDate?.message}
                                                />
                                            )}
                                        />
                                        {watchLeaveType !== 'Correction' && (
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
                                <div className={`grid gap-4 ${watchLeaveType === 'Correction' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                    <Controller 
                                        name="startDate" 
                                        control={control} 
                                        render={({ field }) => (
                                            <DatePicker 
                                                label={watchLeaveType === 'Correction' ? "Date" : "Start Date"} 
                                                id="startDate" 
                                                value={field.value} 
                                                onChange={field.onChange} 
                                                error={errors.startDate?.message} 
                                            />
                                        )} 
                                    />
                                    {watchLeaveType !== 'Correction' && (
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

                            {watchLeaveType === 'Correction' && (
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
                                                            className="w-full p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-primary-text focus:ring-2 focus:ring-accent outline-none placeholder:text-white/10"
                                                        />
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className={`grid grid-cols-2 gap-4 bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10 relative transition-all ${isFetchingLogs ? 'opacity-50 pointer-events-none' : ''}`}>
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
                                                    <input type="time" {...field} className="w-full p-2.5 rounded-lg bg-[#041b0f] border border-emerald-500/20 text-white text-sm" />
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
                                                    <input type="time" {...field} className="w-full p-2.5 rounded-lg bg-[#041b0f] border border-emerald-500/20 text-white text-sm" />
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
                                            <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-orange-500/5 border border-orange-500/20">
                                                <Controller 
                                                    name="breakIn" 
                                                    control={control} 
                                                    render={({ field }) => (
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-semibold text-muted uppercase tracking-wider">Break In</label>
                                                            <input type="time" {...field} className="w-full p-2.5 rounded-lg bg-[#041b0f] border border-emerald-500/20 text-white text-sm" />
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
                                                            <input type="time" {...field} className="w-full p-2.5 rounded-lg bg-[#041b0f] border border-emerald-500/20 text-white text-sm" />
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
                                                <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-purple-500/5 border border-purple-500/20">
                                                    <Controller 
                                                        name="siteOtIn" 
                                                        control={control} 
                                                        render={({ field }) => (
                                                            <div className="space-y-1">
                                                                <label className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1">
                                                                    <Clock className="w-3.5 h-3.5 text-purple-500" /> Site OT In
                                                                </label>
                                                                <input type="time" {...field} className="w-full p-3 rounded-xl bg-[#041b0f] border border-emerald-500/20 text-white text-sm outline-none" />
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
                                                                <input type="time" {...field} className="w-full p-3 rounded-xl bg-[#041b0f] border border-emerald-500/20 text-white text-sm outline-none" />
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
                                    className={`w-full p-5 rounded-[1.5rem] bg-emerald-500/5 border border-emerald-500/10 text-primary-text focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-white/10 ${errors.reason ? 'border-red-500' : ''}`} 
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

                        <div className={`flex items-center gap-4 ${isMobile ? 'pb-10 pt-4' : 'pt-4'}`}>
                            <Button type="button" variant="danger" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
                            <Button type="submit" form="leave-form" className="flex-1">{isEditMode ? 'Update Request' : 'Submit'}</Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ApplyLeave;
