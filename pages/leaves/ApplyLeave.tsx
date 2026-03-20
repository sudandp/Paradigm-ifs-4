import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import type { LeaveType, UploadedFile, LeaveBalance } from '../../types';
import { ArrowLeft } from 'lucide-react';
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
};

const getLeaveValidationSchema = (threshold: number) => yup.object({
    leaveType: yup.string<LeaveType>().oneOf(['Earned', 'Sick', 'Floating', 'Comp Off', 'Loss of Pay', 'Maternity', 'Child Care', 'Pink Leave']).required('Leave type is required'),
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

    const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<LeaveRequestFormData>({
        resolver: yupResolver(validationSchema) as Resolver<LeaveRequestFormData>,
        defaultValues: { 
            leaveType: 'Earned', 
            startDate: format(new Date(), 'yyyy-MM-dd'), 
            endDate: format(new Date(), 'yyyy-MM-dd'), 
            dayOption: 'full' 
        }
    });

    const watchStartDate = watch('startDate');
    const watchEndDate = watch('endDate');
    const watchLeaveType = watch('leaveType');

    const isSingleDay = useMemo(() => {
        if (!watchStartDate || !watchEndDate) return false;
        return isSameDay(new Date(watchStartDate.replace(/-/g, '/')), new Date(watchEndDate.replace(/-/g, '/')));
    }, [watchStartDate, watchEndDate]);

    const showHalfDayOption = isSingleDay;
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
            // Check balance before submitting (only for new requests)
            // Skip balance check for 'Loss of Pay' as it doesn't consume balance
            if (!isEditMode && formData.leaveType !== 'Loss of Pay') {
                const balance = await api.getLeaveBalancesForUser(user.id);
                const startDate = new Date(formData.startDate.replace(/-/g, '/'));
                const endDate = new Date(formData.endDate.replace(/-/g, '/'));
                const duration = formData.dayOption === 'half' ? 0.5 : differenceInCalendarDays(endDate, startDate) + 1;
                
                const typeKeyStr = `${formData.leaveType.toLowerCase()}Total`
                    .replace('earnedtotal', 'earnedTotal')
                    .replace('sicktotal', 'sickTotal')
                    .replace('floatingtotal', 'floatingTotal')
                    .replace('compofftotal', 'compOffTotal')
                    .replace('maternitytotal', 'maternityTotal')
                    .replace('childcaretotal', 'childCareTotal')
                    .replace('child caretotal', 'childCareTotal')
                    .replace('pink leavetotal', 'pinkTotal')
                    .replace('pinktotal', 'pinkTotal');
                
                const usedKeyStr = typeKeyStr.replace('Total', 'Used');
                const pendingKeyStr = typeKeyStr.replace('Total', 'Pending');
                
                // Expiry Check
                const leaveTypeLower = formData.leaveType.toLowerCase().replace(' ', '') as 'earned' | 'sick' | 'floating' | 'compoff' | 'maternity' | 'childcare' | 'pinkleave';
                const leaveTypeMapped = leaveTypeLower === 'pinkleave' ? 'pink' : leaveTypeLower;
                const isExpired = balance.expiryStates && balance.expiryStates[leaveTypeMapped as keyof NonNullable<typeof balance.expiryStates>];
                
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

            if (isEditMode && editId) {
                await api.updateLeaveRequest(editId, formData);
                setToast({ message: 'Leave request updated successfully!', type: 'success' });
            } else {
                await api.submitLeaveRequest({ ...formData, userId: user.id, userName: user.name });
                setToast({ message: 'Leave request submitted successfully!', type: 'success' });
            }
            setTimeout(() => navigate('/leaves/dashboard'), 1500);
        } catch (err) {
            setToast({ message: isEditMode ? 'Failed to update leave request.' : 'Failed to submit leave request.', type: 'error' });
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
                    <h1 className="text-xl font-bold text-primary-text">{isEditMode ? 'Edit Leave Request' : 'Apply for Leave'}</h1>
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
                                    {isFemale && <option value="Maternity">Maternity</option>}
                                    {isFemale && <option value="Child Care">Child Care</option>}
                                </Select>
                            )} />

                            {isMobile ? (
                                <DateRangePicker 
                                    label="Select Dates"
                                    id="leaveRange"
                                    startDate={watchStartDate}
                                    endDate={watchEndDate}
                                    onChange={(start, end) => {
                                        if (start) setValue('startDate', start, { shouldValidate: true });
                                        if (end) setValue('endDate', end, { shouldValidate: true });
                                    }}
                                    error={errors.startDate?.message || errors.endDate?.message}
                                />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Controller name="startDate" control={control} render={({ field }) => (
                                        <DatePicker label="Start Date" id="startDate" value={field.value} onChange={field.onChange} error={errors.startDate?.message} />
                                    )} />
                                    <Controller name="endDate" control={control} render={({ field }) => (
                                        <DatePicker label="End Date" id="endDate" value={field.value} onChange={field.onChange} error={errors.endDate?.message} />
                                    )} />
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
                        </div>

                        <div className="bg-card/50 p-4 rounded-xl border border-border">
                            <label className="block text-sm font-medium text-muted mb-2">Reason for Leave</label>
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
