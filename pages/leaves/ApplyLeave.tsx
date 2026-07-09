import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getStaffCategory, isTechnicalRole, calculateWorkingHours } from '../../utils/attendanceCalculations';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import type { LeaveType, UploadedFile, LeaveBalance, UserChild, StaffAttendanceRules, LeaveRequestStatus, AttendanceEvent } from '../../types';
import { ArrowLeft, Clock, CloudOff, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Select from '../../components/ui/Select';
import { useForm, Controller, SubmitHandler, Resolver, useFieldArray } from 'react-hook-form';
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
    includeSite?: boolean;
    siteVisits?: { in: string; out: string }[];
};

const getLeaveValidationSchema = (threshold: number) => yup.object({
    leaveType: yup.string<LeaveType>().oneOf(['Earned', 'Sick', 'Floating', 'Comp Off', 'Loss of Pay', 'Maternity', 'Child Care', 'Pink Leave', 'WFH', 'Correction', 'Permission']).required('Leave type is required'),
    startDate: yup.string().required('Start date is required')
        .test('is-valid-correction-date', 'Correction can only be raised for the same day (today) or within the last 48 hours', function (value) {
            const { leaveType } = this.parent as { leaveType?: string };
            if (leaveType !== 'Correction' || !value) return true;
            
            const now = new Date();
            const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const targetDate = new Date(value.replace(/-/g, '/'));
            const diffDays = differenceInCalendarDays(todayMidnight, targetDate);
            
            return diffDays >= 0 && diffDays <= 2;
        }),
    endDate: yup.string().required('End date is required')
        .test('is-after-start', 'End date must be on or after start date', function (value) {
            const { startDate } = this.parent as { startDate?: string };
            if (!startDate || !value) return true;
            return new Date(value.replace(/-/g, '/')) >= new Date(startDate.replace(/-/g, '/'));
        }),
    reason: yup.string().when('leaveType', {
        is: (val: string) => val === 'Pink Leave',
        then: schema => schema.nullable().optional(),
        otherwise: schema => schema.required('A reason for the leave is required').min(10, 'Please provide a more detailed reason.')
    }),
    dayOption: yup.string().oneOf(['full', 'half']).optional(),
    // Doctor certificate is MANDATORY for Sick Leave — must be submitted with the request.
    doctorCertificate: yup.mixed<UploadedFile | null>().when('leaveType', {
        is: (val: string) => val === 'Sick',
        then: schema => schema.required("A doctor's certificate or prescription is required for Sick Leave."),
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
    }),
    siteVisits: yup.array().when(['leaveType', 'includeSite'], {
        is: (lt: string, inc: boolean) => ['Correction', 'Permission'].includes(lt) && inc === true,
        then: schema => schema.of(
            yup.object().shape({
                in: yup.string().required('Site in time is required'),
                out: yup.string().required('Site out time is required')
            })
        ).min(1, 'At least one site visit is required'),
        otherwise: schema => schema.optional()
    })
});

const ApplyLeave: React.FC = () => {
    const { user, isCheckedIn, isOffline } = useAuthStore();
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
    const isFemale = ['female', 'ladies'].includes((user?.gender || '').toLowerCase());

    const isProbation = React.useMemo(() => {
        if (!user) return false;
        const joinDateStr = user.joiningDate || user.createdAt;
        if (!joinDateStr) return false;
        
        const joinDate = new Date(joinDateStr.split('T')[0].replace(/-/g, '/'));
        const probationEnd = new Date(joinDate);
        probationEnd.setMonth(probationEnd.getMonth() + 3);
        
        const now = new Date();
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return todayMidnight < probationEnd;
    }, [user]);

    const [isInitialLoading, setIsInitialLoading] = React.useState(isEditMode);
    const [isFetchingLogs, setIsFetchingLogs] = React.useState(false);
    const [userChildren, setUserChildren] = React.useState<UserChild[]>([]);
    const [leaveBalance, setLeaveBalance] = React.useState<number>(0);
    const [fullBalance, setFullBalance] = React.useState<LeaveBalance | null>(null);
    const [correctionUsage, setCorrectionUsage] = React.useState({ used: 0, limit: 3, enabled: false });
    const [permissionUsage, setPermissionUsage] = React.useState({ used: 0, limit: 3, enabled: false });
    const [allLeaveRequests, setAllLeaveRequests] = React.useState<any[]>([]);
    const [dayEvents, setDayEvents] = React.useState<AttendanceEvent[]>([]);

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [permissionMinutes, setPermissionMinutes] = React.useState<number>(120); // default to 2 hours
    const [permissionSession, setPermissionSession] = React.useState<'morning' | 'evening'>('evening');
    const [hasPunchInLog, setHasPunchInLog] = React.useState<boolean>(true);
    const [basePunchInTime, setBasePunchInTime] = React.useState<string>('09:00');
    
    const getAdjustedPunchIn = (baseTime: string, permissionMins: number) => {
        if (!baseTime) return '09:00';
        const [hours, minutes] = baseTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        date.setMinutes(date.getMinutes() - permissionMins);
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const getAdjustedPunchOut = (baseTime: string, permissionMins: number) => {
        if (!baseTime) return '19:30';
        const [hours, minutes] = baseTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        date.setMinutes(date.getMinutes() + permissionMins);
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };
    
    const [basePunchOutTime, setBasePunchOutTime] = React.useState<string>('19:30');
    const [currentTime, setCurrentTime] = React.useState<string>(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });

    // Live clock for permission - updates every minute
    React.useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
        };
        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, []);

    const initialLeaveType = (searchParams.get('leaveType') as LeaveType) || (isProbation ? 'Loss of Pay' : 'Earned');
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
            punchOut: isSameDay(new Date(initialStartDate.replace(/-/g, '/')), new Date()) ? format(new Date(), 'HH:mm') : '19:30',
            includeBreak: false,
            breakIn: '13:00',
            breakOut: '14:00',
            locationName: 'Office',
            includeSiteOt: false,
            siteOtIn: '20:00',
            siteOtOut: '22:00',
            includeSite: false,
            siteVisits: [{ in: '10:00', out: '17:00' }]
        }
    });

    const { fields: siteVisitFields, append: appendSiteVisit, remove: removeSiteVisit } = useFieldArray({
        control,
        name: 'siteVisits'
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

                // Fetch All Leave Requests Once
                try {
                    const { data: allReqs } = await api.getLeaveRequests({ userId: user.id });
                    setAllLeaveRequests(allReqs || []);
                } catch (e) {
                    console.error('Failed to fetch requests for usage tracking:', e);
                }
            } catch (err) {
                console.error('Failed to fetch initial data:', err);
            }
        };
        fetchData();
    }, [user, watchLeaveType]);

    React.useEffect(() => {
        if (rules) {
            setCorrectionUsage(prev => ({ ...prev, limit: rules.maxCorrectionsPerMonth || 3, enabled: !!rules.enableCorrectionLimits }));
            setPermissionUsage(prev => ({ ...prev, limit: rules.maxPermissionsPerMonth || 3, enabled: rules.enablePermission !== false }));
        }
    }, [rules]);

    // Recalculate usage based on the selected date's month
    React.useEffect(() => {
        const monthPrefix = watchStartDate ? watchStartDate.substring(0, 7) : new Date().toISOString().substring(0, 7);
        const monthCorrections = allLeaveRequests.filter((r: any) => 
            r.leaveType === 'Correction' && 
            r.status !== 'rejected' &&
            r.status !== 'withdrawn' &&
            r.status !== 'cancelled' &&
            r.startDate.startsWith(monthPrefix) &&
            r.id !== editId
        );
        const monthPerms = allLeaveRequests.filter((r: any) => 
            r.leaveType === 'Permission' && 
            r.status !== 'rejected' &&
            r.status !== 'withdrawn' &&
            r.status !== 'cancelled' &&
            r.startDate.startsWith(monthPrefix) &&
            r.id !== editId
        );
        
        setCorrectionUsage(prev => ({ ...prev, used: monthCorrections.length }));
        setPermissionUsage(prev => ({ ...prev, used: monthPerms.length }));
    }, [watchStartDate, allLeaveRequests, editId]);

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



     const watchPunchIn = watch('punchIn') || '09:00';
     const watchPunchOut = watch('punchOut') || '19:30';
     const watchIncludeBreak = watch('includeBreak') || false;
     const watchBreakIn = watch('breakIn') || '13:00';
     const watchBreakOut = watch('breakOut') || '14:00';

     const workedHours = useMemo(() => {
         if (!watchPunchIn || !watchPunchOut) return { hours: 0, minutes: 0, text: '0h 0m' };
         
         const getMins = (timeStr: string) => {
             if (!timeStr) return 0;
             const [h, m] = timeStr.split(':').map(Number);
             return h * 60 + m;
         };
         
         const startMins = getMins(watchPunchIn);
         const endMins = getMins(watchPunchOut);
         let elapsedMins = endMins - startMins;
         if (elapsedMins < 0) elapsedMins += 24 * 60; // wrap around
         
         let breakMins = 0;
         if (watchIncludeBreak && watchBreakIn && watchBreakOut) {
             const bIn = getMins(watchBreakIn);
             const bOut = getMins(watchBreakOut);
             let diff = bOut - bIn;
             if (diff < 0) diff += 24 * 60;
             breakMins = diff;
         }
         
         let workedMins = elapsedMins - breakMins;
         if (workedMins < 0) workedMins = 0;
         
         const wHours = Math.floor(workedMins / 60);
         const wMins = workedMins % 60;
         
         return {
             hours: wHours,
             minutes: wMins,
             text: `${wHours}h ${wMins}m`
         };
     }, [watchPunchIn, watchPunchOut, watchIncludeBreak, watchBreakIn, watchBreakOut]);

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
                    setDayEvents(events);
                    const punchInEvents = events.filter(e => e.type === 'punch-in' || (e as any).type === 'punch_in');
                    const punchOutEvents = events.filter(e => e.type === 'punch-out' || (e as any).type === 'punch_out');
                    const breakInEvents = events.filter(e => e.type === 'break-in' || (e as any).type === 'break_in');
                    const breakOutEvents = events.filter(e => e.type === 'break-out' || (e as any).type === 'break_out');
                    const siteOtInEvents = events.filter(e => e.type === 'site-ot-in' || (e as any).type === 'site_ot_in');
                    const siteOtOutEvents = events.filter(e => e.type === 'site-ot-out' || (e as any).type === 'site_ot_out');
                    const siteInEvents = events.filter(e => e.type === 'site-in' || (e as any).type === 'site_in');
                    const siteOutEvents = events.filter(e => e.type === 'site-out' || (e as any).type === 'site_out');

                    // Punch In: Earliest
                    if (punchInEvents.length > 0) {
                        const earliestIn = punchInEvents.reduce((prev, curr) => 
                            new Date(curr.timestamp) < new Date(prev.timestamp) ? curr : prev
                        );
                        const formattedIn = format(new Date(earliestIn.timestamp), 'HH:mm');
                        setValue('punchIn', formattedIn, { shouldValidate: true });
                        setBasePunchInTime(formattedIn);
                        setHasPunchInLog(true);
                        if (earliestIn.locationName) setValue('locationName', earliestIn.locationName);
                    } else {
                        setHasPunchInLog(false);
                    }

                    // Punch Out: Latest
                    if (punchOutEvents.length > 0) {
                        const latestOut = punchOutEvents.reduce((prev, curr) => 
                            new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev
                        );
                        const formattedOut = format(new Date(latestOut.timestamp), 'HH:mm');
                        setValue('punchOut', formattedOut, { shouldValidate: true });
                        setBasePunchOutTime(formattedOut);
                        // If no punch-in location, try punch-out location
                        if (!punchInEvents[0]?.locationName && latestOut.locationName) {
                            setValue('locationName', latestOut.locationName);
                        }
                    } else {
                        const isToday = isSameDay(new Date(watchStartDate.replace(/-/g, '/')), new Date());
                        if (isToday) {
                            const nowTime = format(new Date(), 'HH:mm');
                            setValue('punchOut', nowTime, { shouldValidate: true });
                            setBasePunchOutTime(nowTime);
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

                    // Site In/Out: Map into pairs
                    if (siteInEvents.length > 0 || siteOutEvents.length > 0) {
                        setValue('includeSite', true);
                        const visits = [];
                        // Sort events by timestamp
                        const sortedIn = [...siteInEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        const sortedOut = [...siteOutEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        
                        const maxLen = Math.max(sortedIn.length, sortedOut.length, 1);
                        for (let i = 0; i < maxLen; i++) {
                            visits.push({
                                in: sortedIn[i] ? format(new Date(sortedIn[i].timestamp), 'HH:mm') : '10:00',
                                out: sortedOut[i] ? format(new Date(sortedOut[i].timestamp), 'HH:mm') : '17:00'
                            });
                        }
                        setValue('siteVisits', visits, { shouldValidate: true });
                    }
                } else {
                    setDayEvents([]);
                    // FALLBACK: If no events found, pre-fill with configured office hours from rules
                    if (rules?.fixedOfficeHours) {
                        setValue('punchIn', rules.fixedOfficeHours.checkInTime, { shouldValidate: true });
                        const isToday = isSameDay(new Date(watchStartDate.replace(/-/g, '/')), new Date());
                        if (isToday) {
                            const nowTime = format(new Date(), 'HH:mm');
                            setValue('punchOut', nowTime, { shouldValidate: true });
                            setBasePunchOutTime(nowTime);
                        } else {
                            setValue('punchOut', rules.fixedOfficeHours.checkOutTime, { shouldValidate: true });
                            setBasePunchOutTime(rules.fixedOfficeHours.checkOutTime);
                        }
                        
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
                setDayEvents([]);
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

                    if (requestToEdit.correctionDetails) {
                        const details = requestToEdit.correctionDetails;
                        if (details.status) setValue('correctionStatus', details.status);
                        if (details.punchIn) setValue('punchIn', details.punchIn);
                        if (details.punchOut) {
                            setValue('punchOut', details.punchOut);
                            if (requestToEdit.leaveType === 'Permission') {
                                const baseOut = '19:30';
                                const getMinutes = (timeStr: string) => {
                                    if (!timeStr) return 0;
                                    const [h, m] = timeStr.split(':').map(Number);
                                    return h * 60 + m;
                                };
                                const baseMins = getMinutes(baseOut);
                                const actualMins = getMinutes(details.punchOut);
                                let diffMins = baseMins - actualMins;
                                if (diffMins < 0) diffMins = 0;
                                if (diffMins > 180) diffMins = 180;
                                setPermissionMinutes(diffMins);
                            }
                        }
                        if (details.locationName) setValue('locationName', details.locationName);
                        if (details.includeBreak) {
                            setValue('includeBreak', true);
                            if (details.breakIn) setValue('breakIn', details.breakIn);
                            if (details.breakOut) setValue('breakOut', details.breakOut);
                        }
                        if (details.includeSiteOt) {
                            setValue('includeSiteOt', true);
                            if (details.siteOtIn) setValue('siteOtIn', details.siteOtIn);
                            if (details.siteOtOut) setValue('siteOtOut', details.siteOtOut);
                        }
                    }
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
            if (isProbation && ['Earned', 'Sick', 'Child Care'].includes(formData.leaveType)) {
                setToast({ message: `You cannot apply for ${formData.leaveType} during your 3-month probation period.`, type: 'error' });
                setIsSubmitting(false);
                return;
            }

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
            // 1. Sick Leave, Comp Off, Correction, Permission, and Pink Leave can be applied for any date (past/present/future).
            // 2. Earned Leave can be applied for the same day IF applied before 9:00 AM. Otherwise, at least 1 day in advance.
            // 3. All other leaves must be applied at least one day in advance (no past or present days).
            if (!['Correction', 'Permission', 'Sick', 'Comp Off', 'Pink Leave'].includes(formData.leaveType)) {
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                if (formData.leaveType === 'Earned') {
                    // Earned Leave: Allow same-day application if before 9:00 AM
                    const isToday = startDateObj.getTime() === todayMidnight.getTime();
                    const isPastDate = startDateObj < todayMidnight;
                    const currentHour = now.getHours();

                    if (isPastDate) {
                        setToast({ message: 'Earned Leave cannot be applied for past dates.', type: 'error' });
                        setIsSubmitting(false);
                        return;
                    }
                    if (isToday && currentHour >= 9) {
                        setToast({ message: 'Earned Leave for today must be applied before 9:00 AM.', type: 'error' });
                        setIsSubmitting(false);
                        return;
                    }
                } else {
                    // All other leave types: strict 1-day advance rule
                    if (startDateObj <= todayMidnight) {
                        setToast({ message: 'This type of leave must be applied at least one day in advance. Past and present days are not allowed.', type: 'error' });
                        setIsSubmitting(false);
                        return;
                    }
                }
            }

            // Earned Leave restriction: Cannot be 7 or more continuous days
            if (formData.leaveType === 'Earned' && duration >= 7) {
                setToast({ message: 'You cannot apply for Earned Leave for 7 or more continuous days.', type: 'error' });
                setIsSubmitting(false);
                return;
            }

            // Correction restriction: Same day or within 48 hours. If today is selected, check logs & duration.
            if (formData.leaveType === 'Correction') {
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const targetDate = new Date(formData.startDate.replace(/-/g, '/'));
                
                const diffDays = differenceInCalendarDays(todayMidnight, targetDate);
                
                // 1. Same day or last 48 hours restriction (diffDays: 0 = today, 1 = yesterday, 2 = day before)
                if (diffDays < 0 || diffDays > 2) {
                    setToast({ message: 'Corrections can only be raised for the same day (today) or within the last 48 hours.', type: 'error' });
                    setIsSubmitting(false);
                    return;
                }

                // 2. If present day (today) is selected
                if (diffDays === 0) {
                    // Check if there are any events/logs at all
                    if (dayEvents.length === 0) {
                        setToast({ message: 'No attendance logs found for today. You cannot raise a correction for today if there are no logs.', type: 'error' });
                        setIsSubmitting(false);
                        return;
                    }
                    
                    // Count punch-in and punch-out events
                    const punchIns = dayEvents.filter(e => e.type === 'punch-in' || (e as any).type === 'punch_in');
                    const punchOuts = dayEvents.filter(e => e.type === 'punch-out' || (e as any).type === 'punch_out');
                    const hasPunchIn = punchIns.length > 0;
                    const hasPunchOut = punchOuts.length > 0;
                    const forgotPunchOut = hasPunchIn && !hasPunchOut;
                    
                    // Calculate working hours
                    const hoursData = calculateWorkingHours(dayEvents);
                    const hoursWorked = hoursData.workingHours;
                    
                    // Validate: must have worked >= 4 hours OR forgot to punch out (has punch-in but no punch-out)
                    if (hoursWorked < 4 && !forgotPunchOut) {
                        setToast({ 
                            message: `You can only raise a correction for today if you have worked more than 4 hours (currently ${hoursWorked.toFixed(2)} hours) or if you have incomplete punch logs (forgot to punch out).`, 
                            type: 'error' 
                        });
                        setIsSubmitting(false);
                        return;
                    }
                }
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

                // Verify the user has worked on the permission date
                const targetDate = new Date(formData.startDate.replace(/-/g, '/'));
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                // We only check for attendance records on past or current days.
                if (targetDate <= todayMidnight) {
                    const checkDateStart = `${formData.startDate}T00:00:00Z`;
                    const checkDateEnd = `${formData.startDate}T23:59:59Z`;
                    const dayEvents = await api.getAttendanceEvents(user.id, checkDateStart, checkDateEnd);
                    
                    const hasPunchedIn = dayEvents && dayEvents.some((e: any) => 
                        ['punch-in', 'site-in', 'punch_in', 'site_in', 'site-ot-in', 'site_ot_in'].includes(e.type)
                    );
                    
                    if (!hasPunchedIn) {
                        setToast({ message: 'Permission can only be applied for days where you have an active attendance record (you must check in to work first).', type: 'error' });
                        setIsSubmitting(false);
                        return;
                    }
                }

                const currentMonthStart = formData.startDate.substring(0, 7);
                const { data: allReqs } = await api.getLeaveRequests({ userId: user.id });
                const monthPerms = allReqs.filter(r => 
                    r.leaveType === 'Permission' && 
                    r.status !== 'rejected' &&
                    r.status !== 'withdrawn' &&
                    r.status !== 'cancelled' &&
                    r.startDate.startsWith(currentMonthStart) &&
                    r.id !== editId
                );

                const maxPerms = rules.maxPermissionsPerMonth || 3;
                if (monthPerms.length >= maxPerms) {
                    setToast({ message: `You have reached the maximum allowed permissions (${maxPerms}) for this month.`, type: 'error' });
                    setIsSubmitting(false);
                    return;
                }

                // Calculate existing permission minutes for this month
                let totalExistingPermMins = 0;
                monthPerms.forEach(r => {
                    if (r.correctionDetails?.punchIn && r.correctionDetails?.punchOut) {
                        const getMinutes = (timeStr: string) => {
                            if (!timeStr) return 0;
                            const [h, m] = timeStr.split(':').map(Number);
                            return h * 60 + m;
                        };
                        const start = getMinutes(r.correctionDetails.punchIn);
                        const end = getMinutes(r.correctionDetails.punchOut);
                        let diff = end - start;
                        if (diff < 0) diff += 24 * 60;
                        totalExistingPermMins += diff;
                    }
                });

                // Verify duration and monthly total hours
                const maxHours = rules?.maxPermissionDurationHours || 3;
                const durationHours = permissionMinutes / 60;
                const totalMonthPermHours = (totalExistingPermMins + permissionMinutes) / 60;

                if (totalMonthPermHours > maxHours) {
                    setToast({ message: `Total permission time cannot exceed ${maxHours} hours per month. You have already used ${(totalExistingPermMins / 60).toFixed(1)} hours and requested ${durationHours.toFixed(1)} hours.`, type: 'error' });
                    setIsSubmitting(false);
                    return;
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

                    const currentMonthStart = formData.startDate.substring(0, 7);
                    const { data: allReqs } = await api.getLeaveRequests({ userId: user.id });
                    const monthCorrections = allReqs.filter(r => 
                        r.leaveType === 'Correction' && 
                        r.status !== 'rejected' &&
                        r.status !== 'withdrawn' &&
                        r.status !== 'cancelled' &&
                        r.startDate.startsWith(currentMonthStart) &&
                        r.id !== editId
                    );

                    const maxCorrections = rules.maxCorrectionsPerMonth || 3;
                    if (monthCorrections.length >= maxCorrections) {
                        setToast({ message: `You have reached the maximum allowed corrections (${maxCorrections}) for this month.`, type: 'error' });
                        setIsSubmitting(false);
                        return;
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
                reason: leaveType === 'Pink Leave' ? 'Pink Leave Request (Menstrual Leave)' : reason,
                doctorCertificate,
                userId: user.id,
                userName: user.name
            };

            // Add correction details only for Correction and Permission types
            if (['Correction', 'Permission'].includes(leaveType)) {
                // Extract original times from dayEvents
                const origPunchIn = dayEvents.filter(e => e.type === 'punch-in' || (e as any).type === 'punch_in');
                const origPunchOut = dayEvents.filter(e => e.type === 'punch-out' || (e as any).type === 'punch_out');
                const origBreakIn = dayEvents.filter(e => e.type === 'break-in' || (e as any).type === 'break_in');
                const origBreakOut = dayEvents.filter(e => e.type === 'break-out' || (e as any).type === 'break_out');
                
                const getEarliestTime = (eventsList: any[]) => {
                    if (eventsList.length === 0) return null;
                    const earliest = eventsList.reduce((prev, curr) => 
                        new Date(curr.timestamp) < new Date(prev.timestamp) ? curr : prev
                    );
                    return format(new Date(earliest.timestamp), 'HH:mm');
                };
                
                const getLatestTime = (eventsList: any[]) => {
                    if (eventsList.length === 0) return null;
                    const latest = eventsList.reduce((prev, curr) => 
                        new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev
                    );
                    return format(new Date(latest.timestamp), 'HH:mm');
                };

                const originalPunchInTime = getEarliestTime(origPunchIn);
                const originalPunchOutTime = getLatestTime(origPunchOut);

                basePayload.correctionDetails = {
                    status: correctionStatus,
                    punchIn,
                    punchOut,
                    breakIn,
                    breakOut,
                    locationName,
                    includeSiteOt,
                    siteOtIn,
                    siteOtOut,
                    originalLogs: {
                        punchIn: originalPunchInTime,
                        punchOut: originalPunchOutTime,
                        breakIn: getEarliestTime(origBreakIn),
                        breakOut: getLatestTime(origBreakOut),
                        locationName: (origPunchIn[0]?.locationName || origPunchOut[0]?.locationName) || null,
                        rawEvents: dayEvents.map(e => ({
                            type: e.type,
                            timestamp: e.timestamp,
                            locationName: e.locationName
                        }))
                    }
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
                setToast({ 
                    message: isOffline ? 'You are offline. Request saved and will sync later!' : 'Leave request submitted successfully!', 
                    type: 'success' 
                });
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
            case 'Correction': return 'Request for Correction (RC)';
            case 'Permission': return 'Request for Permission (RP)';
            default: return type;
        }
    };

    if (!user) return null;

    return (
        <div className={`min-h-screen bg-page ${isMobile ? '' : 'p-6'}`}>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <div className={`w-full ${isMobile ? '' : 'md:bg-card md:p-8 md:rounded-2xl md:shadow-card md:border md:border-border'}`}>
                <header 
                    className={`p-4 flex items-center justify-between gap-4 ${isMobile ? 'fixed top-0 left-0 right-0 z-50 bg-[#041b0f]/80 backdrop-blur-lg border-b border-emerald-500/10' : 'mb-8'}`}
                    style={isMobile ? { paddingTop: 'calc(1rem + env(safe-area-inset-top))' } : {}}
                >
                    <div className="flex items-center gap-4">
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
                            <h1 className="text-2xl font-black text-primary-text tracking-tight uppercase text-lg flex items-center gap-2">
                                {isEditMode ? 'Edit Request' : `Applying for Leave`}
                                {isOffline && (
                                    <span className="bg-orange-500/10 border border-orange-500/20 text-orange-500 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shrink-0">
                                        <CloudOff className="w-3 h-3" />
                                        OFFLINE
                                    </span>
                                )}
                            </h1>
                            {!isEditMode && (
                                <p className="text-xs font-bold text-muted/60 uppercase tracking-widest mt-0.5">
                                    Balance: <span className="text-emerald-500">{leaveBalance.toFixed(1)} days</span>
                                </p>
                            )}
                        </div>
                    </div>
                    
                    {watchLeaveType === 'Permission' && (
                        <div className="flex bg-emerald-500/10 p-1 rounded-lg shrink-0">
                            <button
                                type="button"
                                onClick={() => setPermissionSession('morning')}
                                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                                    permissionSession === 'morning' ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-500/20'
                                }`}
                            >
                                1st Half
                            </button>
                            <button
                                type="button"
                                onClick={() => setPermissionSession('evening')}
                                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                                    permissionSession === 'evening' ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-500/20'
                                }`}
                            >
                                2nd Half
                            </button>
                        </div>
                    )}
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
                            <div className={`grid gap-4 ${showHalfDayOption ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
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
                                            {!isProbation && <option value="Earned">Earned</option>}
                                            {!isProbation && <option value="Sick">Sick</option>}
                                            <option value={isFemale ? "Pink Leave" : "Floating"}>{isFemale ? "Pink Leave" : "Blue Leave"}</option>
                                            <option value="Comp Off">Comp Off</option>
                                            <option value="Loss of Pay">Loss of Pay</option>
                                            {(!isProbation && isFemale && (userChildren.length > 0 || (fullBalance && fullBalance.childCareTotal > 0))) && <option value="Child Care">Child Care</option>}
                                            {(isFemale && fullBalance && fullBalance.maternityTotal > 0) && <option value="Maternity">Maternity Leave</option>}
                                            <option value="WFH">Work From Home (WFH)</option>
                                            <option value="Correction">Request for Correction (RC)</option>
                                            {(rules?.enablePermission || rules?.enablePermission === undefined) && (
                                                <option value="Permission">Request for Permission (RP)</option>
                                            )}
                                        </Select>
                                    )} 
                                />

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
                            </div>

                            {watchLeaveType === 'Correction' && correctionUsage.enabled && (
                                <div className={`p-4 rounded-xl border ${correctionUsage.used >= correctionUsage.limit ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-5 h-5" />
                                        <h4 className="font-bold text-sm">Monthly Correction Limit</h4>
                                    </div>
                                    <p className="text-xs opacity-90 leading-relaxed mb-2">
                                        You have used <strong>{correctionUsage.used}</strong> out of <strong>{correctionUsage.limit}</strong> allowed corrections this month.
                                    </p>
                                    {correctionUsage.used >= correctionUsage.limit && (
                                        <div className="text-[11px] font-black uppercase tracking-widest bg-rose-500/20 p-2 rounded-lg mt-2">
                                            Limit Exceeded. Please contact admin for manual corrections.
                                        </div>
                                    )}
                                </div>
                            )}

                            {watchLeaveType === 'Correction' && (
                                <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/10 text-emerald-500 space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-5 h-5 text-emerald-500" />
                                        <h4 className="font-bold text-sm">Correction Request Guidelines</h4>
                                    </div>
                                    <div className="text-xs opacity-95 leading-relaxed space-y-1.5">
                                        <p>
                                            • Corrections can only be raised for the <strong>same day (today)</strong> or within the last <strong>48 hours</strong>.
                                        </p>
                                        <p>
                                            • For the <strong>present day (today)</strong>, corrections are only allowed if you have existing attendance logs (e.g., you forgot to punch out) or if you have worked for <strong>4 hours or more</strong>.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {watchLeaveType === 'Permission' && permissionUsage.enabled && (
                                <div className={`p-4 rounded-xl border ${permissionUsage.used >= permissionUsage.limit ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-5 h-5" />
                                        <h4 className="font-bold text-sm">Monthly Permission Limit</h4>
                                    </div>
                                    <div className="text-xs opacity-90 leading-relaxed mb-2 space-y-2">
                                        <p>
                                            You have used <strong>{permissionUsage.used}</strong> out of <strong>{permissionUsage.limit}</strong> allowed permissions this month.
                                        </p>
                                        <p className="bg-amber-500/15 border border-amber-500/30 p-2.5 rounded-lg">
                                            <strong>💡 Friendly Note:</strong> You have a monthly limit of <strong>3 hours</strong>. You can use it all in one day or split it — e.g., 1 hour per day across 3 days. Note that this is a <strong>permitted absence</strong>, not a granted leave.
                                        </p>
                                    </div>
                                    {permissionUsage.used >= permissionUsage.limit && (
                                        <div className="text-[11px] font-black uppercase tracking-widest bg-rose-500/20 p-2 rounded-lg mt-2">
                                            Limit Exceeded. Please contact admin for manual permission.
                                        </div>
                                    )}
                                </div>
                            )}

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
                                                    <input type="time" {...field} readOnly={watchLeaveType === 'Permission'} className={`w-full p-2.5 rounded-lg border text-sm ${watchLeaveType === 'Permission' ? 'opacity-75 cursor-not-allowed bg-emerald-500/5 border-emerald-500/20 text-emerald-400 font-bold' : isMobile ? 'bg-[#041b0f] border-emerald-500/20 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
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
                                                    <input 
                                                        type="time" 
                                                        {...field} 
                                                        readOnly={watchLeaveType === 'Permission'}
                                                        className={`w-full p-2.5 rounded-lg border text-sm ${
                                                            watchLeaveType === 'Permission' 
                                                                ? 'opacity-75 cursor-not-allowed bg-emerald-500/5 border-emerald-500/20 text-emerald-400 font-bold' 
                                                                : isMobile 
                                                                    ? 'bg-[#041b0f] border-emerald-500/20 text-white' 
                                                                    : 'bg-white border-gray-200 text-gray-900'
                                                        }`} 
                                                    />
                                                    {errors.punchOut && <p className="text-xs text-red-500">{errors.punchOut.message}</p>}
                                                </div>
                                            )} 
                                        />
                                    </div>

                                    {watchLeaveType === 'Permission' && !hasPunchInLog && (
                                        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm font-medium mb-4 flex items-center gap-2">
                                            <CloudOff className="w-5 h-5" />
                                            Please punch in from your office first, then raise a request for permission.
                                        </div>
                                    )}

                                    {watchLeaveType === 'Permission' && (
                                        <div className={`p-6 rounded-2xl border space-y-5 transition-all duration-300 ${
                                            isMobile 
                                                ? 'bg-emerald-500/5 border-emerald-500/10' 
                                                : 'bg-white border-gray-200 shadow-sm'
                                        }`}>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`p-1.5 rounded-lg ${isMobile ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                                                        <Clock className="w-4 h-4 text-emerald-600" />
                                                    </div>
                                                    <h4 className={`font-bold text-sm uppercase tracking-wide ${isMobile ? 'text-primary-text' : 'text-gray-800'}`}>
                                                        Permission Duration
                                                    </h4>
                                                </div>
                                                <div className={`text-[11px] font-semibold px-3 py-1 rounded-full ${
                                                    isMobile 
                                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                }`}>
                                                    Max 3 Hours
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-center justify-center py-3 space-y-1">
                                                <div className={`text-4xl font-black tracking-tight ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                                    {Math.floor(permissionMinutes / 60)}h {permissionMinutes % 60}m
                                                </div>
                                                <p className={`text-xs font-medium uppercase tracking-widest ${isMobile ? 'text-muted/65' : 'text-gray-400'}`}>
                                                    Requested Duration
                                                </p>
                                            </div>

                                            <div className="space-y-2 px-1">
                                                <input 
                                                    type="range" 
                                                    min="0" 
                                                    max="180" 
                                                    step="15" 
                                                    value={permissionMinutes} 
                                                    onChange={(e) => setPermissionMinutes(Number(e.target.value))}
                                                    className={`w-full h-2 rounded-full appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                                                        isMobile ? 'bg-emerald-200/50 accent-emerald-500' : 'bg-gray-200 accent-emerald-500'
                                                    }`}
                                                />
                                                <div className={`flex justify-between text-[10px] font-bold uppercase tracking-widest px-0.5 ${isMobile ? 'text-muted/60' : 'text-gray-400'}`}>
                                                    <span>0m</span>
                                                    <span>1h</span>
                                                    <span>2h</span>
                                                    <span>3h</span>
                                                </div>
                                            </div>



                                            <div className={`rounded-xl border text-xs ${
                                                isMobile 
                                                    ? 'bg-[#041b0f]/50 border-emerald-500/10 text-primary-text' 
                                                    : 'bg-gray-50 border-gray-200 text-gray-700'
                                            }`}>
                                                {/* Time flow row */}
                                                <div className="flex items-center justify-between gap-2 px-4 py-3">
                                                    {permissionSession === 'evening' ? (
                                                        <>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isMobile ? 'opacity-50' : 'text-gray-400'}`}>Now</span>
                                                                <span className={`font-bold text-sm px-3 py-1 rounded-lg border ${
                                                                    isMobile
                                                                        ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
                                                                        : 'bg-white text-gray-800 border-gray-300 shadow-xs'
                                                                }`}>
                                                                    {currentTime}
                                                                </span>
                                                            </div>
                                                            <div className={`text-lg font-bold ${isMobile ? 'opacity-30' : 'text-gray-300'}`}>→</div>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isMobile ? 'opacity-50' : 'text-gray-400'}`}>Adjusted Out</span>
                                                                <span className={`font-bold text-sm px-3 py-1 rounded-lg border ${
                                                                    isMobile 
                                                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                                }`}>
                                                                    {getAdjustedPunchOut(currentTime, permissionMinutes)}
                                                                </span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isMobile ? 'opacity-50' : 'text-gray-400'}`}>Base In</span>
                                                                <span className={`font-bold text-sm px-3 py-1 rounded-lg border ${
                                                                    isMobile
                                                                        ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
                                                                        : 'bg-white text-gray-800 border-gray-300 shadow-xs'
                                                                }`}>
                                                                    {basePunchInTime || '09:00'}
                                                                </span>
                                                            </div>
                                                            <div className={`text-lg font-bold ${isMobile ? 'opacity-30' : 'text-gray-300'}`}>→</div>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isMobile ? 'opacity-50' : 'text-gray-400'}`}>Adjusted In</span>
                                                                <span className={`font-bold text-sm px-3 py-1 rounded-lg border ${
                                                                    isMobile 
                                                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                                }`}>
                                                                    {getAdjustedPunchIn(basePunchInTime || '09:00', permissionMinutes)}
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                {/* Worked hours row */}
                                                <div className={`flex items-center justify-center gap-2 px-4 py-2.5 border-t ${isMobile ? 'border-emerald-500/10' : 'border-gray-200'}`}>
                                                    <span className={`flex items-center gap-1.5 font-semibold ${isMobile ? 'opacity-60 text-emerald-400' : 'text-gray-500'}`}>
                                                        <Clock className="w-3.5 h-3.5" /> Worked Hours:
                                                    </span>
                                                    <span className={`font-bold text-sm px-3 py-1 rounded-lg border transition-all ${
                                                        workedHours.hours >= 8 
                                                            ? isMobile ? 'bg-green-500/15 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-300'
                                                            : isMobile ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-300'
                                                    }`}>
                                                        {workedHours.text}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3 pt-4 border-t border-emerald-500/10">
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                id="includeSite" 
                                                {...register('includeSite')} 
                                                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                                            />
                                            <label htmlFor="includeSite" className="text-sm font-medium text-primary-text">Include Site Visit?</label>
                                        </div>

                                        {watch('includeSite') && (
                                            <div className="space-y-4">
                                                {siteVisitFields.map((field, index) => (
                                                    <div key={field.id} className={`grid grid-cols-[1fr_1fr_auto] gap-4 p-5 rounded-2xl border items-start ${isMobile ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                                                        <Controller 
                                                            name={`siteVisits.${index}.in`} 
                                                            control={control} 
                                                            render={({ field }) => (
                                                                <div className="space-y-1">
                                                                    <label className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1">
                                                                        <Clock className="w-3.5 h-3.5 text-blue-500" /> Site In
                                                                    </label>
                                                                    <input type="time" {...field} className={`w-full p-2.5 rounded-lg border text-sm ${isMobile ? 'bg-[#041b0f] border-emerald-500/20 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                                                                    {errors.siteVisits?.[index]?.in && <p className="text-xs text-red-500">{errors.siteVisits[index]?.in?.message}</p>}
                                                                </div>
                                                            )} 
                                                        />
                                                        <Controller 
                                                            name={`siteVisits.${index}.out`} 
                                                            control={control} 
                                                            render={({ field }) => (
                                                                <div className="space-y-1">
                                                                    <label className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1">
                                                                        <Clock className="w-3.5 h-3.5 text-blue-500" /> Site Out
                                                                    </label>
                                                                    <input type="time" {...field} className={`w-full p-2.5 rounded-lg border text-sm ${isMobile ? 'bg-[#041b0f] border-emerald-500/20 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                                                                    {errors.siteVisits?.[index]?.out && <p className="text-xs text-red-500">{errors.siteVisits[index]?.out?.message}</p>}
                                                                </div>
                                                            )} 
                                                        />
                                                        {siteVisitFields.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSiteVisit(index)}
                                                                className="mt-6 p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Remove Visit"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                <div className="flex justify-start">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => appendSiteVisit({ in: '10:00', out: '17:00' })}
                                                        className="w-fit border-dashed border-2 text-blue-600 hover:bg-blue-50"
                                                    >
                                                        + Add Another Site Visit
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3 pt-4 border-t border-emerald-500/10">
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

                            {watchLeaveType !== 'Pink Leave' && (
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
                            )}

                            {watchLeaveType === 'Sick' && (
                                <div className={`p-4 rounded-xl border ${isMobile ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                                    <div className="flex items-start gap-3">
                                        <div className="shrink-0 mt-0.5">
                                            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                                            </svg>
                                        </div>
                                        <div className="space-y-1">
                                            <p className={`text-sm font-black uppercase tracking-wide ${isMobile ? 'text-red-400' : 'text-red-700'}`}>
                                                ⚠ Doctor Certificate Required
                                            </p>
                                            <p className={`text-xs leading-relaxed ${isMobile ? 'text-red-300/80' : 'text-red-600'}`}>
                                                A doctor's certificate or prescription <strong>must be attached</strong> when submitting a Sick Leave request.
                                                Requests without a certificate will not be accepted.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

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
                            <Button 
                                type="submit" 
                                form="leave-form" 
                                isLoading={isSubmitting} 
                                disabled={
                                    isSubmitting || 
                                    (watchLeaveType === 'Correction' && correctionUsage.enabled && correctionUsage.used >= correctionUsage.limit) || 
                                    (watchLeaveType === 'Permission' && permissionUsage.enabled && permissionUsage.used >= permissionUsage.limit)
                                }
                                className="flex-1 md:flex-none md:w-48"
                            >
                                {isEditMode ? 'Update Request' : 'Submit'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ApplyLeave;
