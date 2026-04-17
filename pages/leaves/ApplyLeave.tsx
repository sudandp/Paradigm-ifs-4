import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    })
});

const ApplyLeave: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const { attendance: { office: { sickLeaveCertificateThreshold } } } = useSettingsStore();

    const validationSchema = useMemo(() => getLeaveValidationSchema(sickLeaveCertificateThreshold), [sickLeaveCertificateThreshold]);
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('edit');
    const isEditMode = !!editId;
    const isFemale = user?.gender?.toLowerCase() === 'female';
    const [isInitialLoading, setIsInitialLoading] = React.useState(isEditMode);
    const [userChildren, setUserChildren] = React.useState<UserChild[]>([]);

    React.useEffect(() => {
        if (!user || user.gender !== 'Female') return;
        api.getUserChildren(user.id)
            .then(data => setUserChildren(data))
            .catch(err => console.error('Failed to load children:', err));
    }, [user?.id, user?.gender]);

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
            locationName: 'Office'
        }
    });

    const watchStartDate = watch('startDate');
    const watchEndDate = watch('endDate');
    const watchLeaveType = watch('leaveType');

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
                correctionStatus, punchIn, punchOut, includeBreak, breakIn, breakOut, locationName 
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
                    includeBreak,
                    breakIn,
                    breakOut,
                    locationName
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
            
            <div className="w-full bg-card rounded-2xl shadow-card overflow-hidden">
                <header 
                    className={`p-4 flex items-center gap-4 ${isMobile ? 'fixed top-0 left-0 right-0 z-50 bg-[#041b0f] border-b border-[#1f3d2b]' : 'border-b'}`}
                    style={isMobile ? { paddingTop: 'calc(1rem + env(safe-area-inset-top))' } : {}}
                >
                    <Button variant="icon" onClick={() => navigate(-1)} aria-label="Go back">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="text-xl font-bold text-primary-text">
                        {isEditMode ? 'Edit Leave Request' : `Applying for ${getLeaveTypeDisplay(watchLeaveType)}`}
                    </h1>
                </header>

                <div className={`${isMobile ? 'px-4' : 'p-6'}`} style={isMobile ? { paddingTop: 'calc(5rem + env(safe-area-inset-top))' } : {}}>
                    <form id="leave-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="bg-card/50 p-4 rounded-xl border border-border space-y-4">
                            <Controller name="leaveType" control={control} render={({ field }) => (
                                <Select label="Leave Type" {...field} error={errors.leaveType?.message} className={isMobile ? 'pro-select pro-select-arrow' : ''}>
                                    <option value="Earned">Earned</option>
                                    <option value="Sick">Sick</option>
                                    <option value={isFemale ? "Pink Leave" : "Floating"}>{isFemale ? "Pink Leave" : "3rd Saturday Leave"}</option>
                                    <option value="Comp Off">Comp Off</option>
                                    <option value="Loss of Pay">Loss of Pay</option>
                                    {isFemale && userChildren.length > 0 && <option value="Child Care">Child Care</option>}
                                    <option value="WFH">Work From Home (WFH)</option>
                                    <option value="Correction">Request for Correction</option>
                                </Select>
                            )} />

                            {isMobile ? (
                                <DateRangePicker 
                                    label={watchLeaveType === 'Correction' ? "Select Date" : "Select Dates"}
                                    id="leaveRange"
                                    startDate={watchStartDate}
                                    endDate={watchEndDate}
                                    singleDateOnly={watchLeaveType === 'Correction'}
                                    onChange={(start, end) => {
                                        if (start) setValue('startDate', start, { shouldValidate: true });
                                        if (end) setValue('endDate', end, { shouldValidate: true });
                                    }}
                                    error={errors.startDate?.message || errors.endDate?.message}
                                />
                            ) : (
                                <div className={`grid gap-4 ${watchLeaveType === 'Correction' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                    <Controller name="startDate" control={control} render={({ field }) => (
                                        <DatePicker 
                                            label={watchLeaveType === 'Correction' ? "Date" : "Start Date"} 
                                            id="startDate" 
                                            value={field.value} 
                                            onChange={field.onChange} 
                                            error={errors.startDate?.message} 
                                        />
                                    )} />
                                    {watchLeaveType !== 'Correction' && (
                                        <Controller name="endDate" control={control} render={({ field }) => (
                                            <DatePicker label="End Date" id="endDate" value={field.value} onChange={field.onChange} error={errors.endDate?.message} />
                                        )} />
                                    )}
                                </div>
                            )}

                            {showHalfDayOption && (
                                <Controller name="dayOption" control={control} render={({ field }) => (
                                    <Select label="Day Option" {...field} className={isMobile ? 'pro-select pro-select-arrow' : ''}>
                                        <option value="full">Full Day</option>
                                        <option value="half">Half Day</option>
                                    </Select>
                                )} />
                            )}

                            {watchLeaveType === 'Correction' && (
                                <div className="space-y-4 pt-4 border-t border-border">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Controller name="correctionStatus" control={control} render={({ field }) => (
                                            <Select label="Status" {...field} error={errors.correctionStatus?.message}>
                                                <option value="Present">Present (Office)</option>
                                                <option value="Site Visit">Site Visit (Field)</option>
                                                <option value="W/H">Work From Home</option>
                                            </Select>
                                        )} />
                                        {(watch('correctionStatus') === 'Present' || watch('correctionStatus') === 'Site Visit') && (
                                            <Controller name="locationName" control={control} render={({ field }) => (
                                                <div className="space-y-1">
                                                    <label className="text-sm font-medium text-muted">Location / Site Name</label>
                                                    <input 
                                                        {...field} 
                                                        placeholder={watch('correctionStatus') === 'Site Visit' ? "e.g. Client Site" : "e.g. Office"}
                                                        className="w-full p-2.5 rounded-lg bg-page border border-border text-primary-text focus:ring-2 focus:ring-accent outline-none"
                                                    />
                                                </div>
                                            )} />
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 bg-accent/5 p-4 rounded-xl border border-accent/20">
                                        <Controller name="punchIn" control={control} render={({ field }) => (
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-muted flex items-center gap-1.5 uppercase tracking-wider">
                                                    <Clock className="w-3.5 h-3.5 text-green-500" /> Punch In
                                                </label>
                                                <input type="time" {...field} className="w-full p-2.5 rounded-lg bg-card border border-border text-sm" />
                                                {errors.punchIn && <p className="text-xs text-red-500">{errors.punchIn.message}</p>}
                                            </div>
                                        )} />
                                        <Controller name="punchOut" control={control} render={({ field }) => (
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-muted flex items-center gap-1.5 uppercase tracking-wider">
                                                    <Clock className="w-3.5 h-3.5 text-red-500" /> Punch Out
                                                </label>
                                                <input type="time" {...field} className="w-full p-2.5 rounded-lg bg-card border border-border text-sm" />
                                                {errors.punchOut && <p className="text-xs text-red-500">{errors.punchOut.message}</p>}
                                            </div>
                                        )} />
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
                                            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                                                <Controller name="breakIn" control={control} render={({ field }) => (
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-semibold text-muted uppercase tracking-wider">Break In</label>
                                                        <input type="time" {...field} className="w-full p-2.5 rounded-lg bg-card border border-border text-sm" />
                                                        {errors.breakIn && <p className="text-xs text-red-500">{errors.breakIn.message}</p>}
                                                    </div>
                                                )} />
                                                <Controller name="breakOut" control={control} render={({ field }) => (
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-semibold text-muted uppercase tracking-wider">Break Out</label>
                                                        <input type="time" {...field} className="w-full p-2.5 rounded-lg bg-card border border-border text-sm" />
                                                        {errors.breakOut && <p className="text-xs text-red-500">{errors.breakOut.message}</p>}
                                                    </div>
                                                )} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-card/50 p-4 rounded-xl border border-border">
                            <label className="block text-sm font-medium text-muted mb-2">
                                {watchLeaveType === 'Correction' ? 'Reason for requesting Correction' : `Reason for applying ${getLeaveTypeDisplay(watchLeaveType)}`}
                            </label>
                            <textarea 
                                {...register('reason')} 
                                rows={4} 
                                placeholder="Please provide details about your leave request..."
                                className={`w-full p-4 rounded-xl bg-page border border-border text-primary-text focus:ring-2 focus:ring-accent outline-none transition-all ${errors.reason ? 'border-red-500' : ''}`} 
                            />
                            {errors.reason && <p className="mt-2 text-xs text-red-500">{errors.reason.message}</p>}
                        </div>

                        {showDoctorCertUpload && (
                            <div className="bg-card/50 p-4 rounded-xl border border-border">
                                <Controller name="doctorCertificate" control={control} render={({ field, fieldState }) => (
                                    <UploadDocument 
                                        label="Doctor's Certificate (Required)" 
                                        file={field.value} 
                                        onFileChange={field.onChange} 
                                        error={fieldState.error?.message} 
                                        allowCapture 
                                    />
                                )} />
                            </div>
                        )}

                        <div className={`flex items-center gap-4 ${isMobile ? 'pb-10 pt-4' : 'pt-4'}`}>
                            <Button type="button" variant="secondary" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
                            <Button type="submit" form="leave-form" className="flex-2">{isEditMode ? 'Update Request' : 'Submit Request'}</Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ApplyLeave;
