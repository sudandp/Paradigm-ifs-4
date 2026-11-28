import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Loader2, Calendar as CalendarIcon, CalendarCheck, User, FileText, Info, Clock, Paperclip, MapPin, Activity, MessageSquare, AlertTriangle, ChevronDown, History, Timer } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { format, differenceInCalendarDays, isSameDay, addDays } from 'date-fns';
import { User as UserType, LeaveType, LeaveBalance, UploadedFile, StaffAttendanceRules } from '../../types';
import { api } from '../../services/api';
import Toast from '../ui/Toast';
import SearchableSelect from '../ui/SearchableSelect';
import UploadDocument from '../UploadDocument';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { isAdmin } from '../../utils/auth';
import { getStaffCategory } from '../../utils/attendanceCalculations';

interface AssignLeaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    users: UserType[];
    currentUserId: string;
}

type SiteVisit = { in: string; out: string };
/** A worked session reconstructed from the day's punches. `out` is null while still punched in. */
type DaySession = { in: string; out: string | null };

const toMins = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};
const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (!h) return `${m}m`;
    return m ? `${h}h ${m}m` : `${h}h`;
};
const formatTime12 = (hhmm: string) => format(new Date(`2000-01-01T${hhmm}:00`), 'h:mm a');
const ATTENDANCE_IN_TYPES = ['punch-in', 'punch_in', 'site-in', 'site_in', 'site-ot-in', 'site_ot_in'];

const ATTENDANCE_FIX_TYPES: LeaveType[] = ['Correction', 'Permission'] as LeaveType[];
const BALANCE_EXEMPT_TYPES: string[] = ['Loss of Pay', 'WFH', 'Correction', 'Permission'];
const INACTIVE_REQUEST_STATUSES = ['rejected', 'cancelled', 'withdrawn'];
const MIN_REASON_LENGTH = 10;

const DEFAULT_PUNCH_IN = '09:00';
const DEFAULT_PUNCH_OUT = '18:30';
const defaultSiteVisit = (): SiteVisit => ({ in: '10:00', out: '17:00' });

const parseLocalDate = (ymd: string) => new Date(ymd.replace(/-/g, '/'));

const formatRole = (role?: string) => {
    if (!role) return '';
    const words = role.replace(/[_-]+/g, ' ').trim();
    if (words.length <= 3) return words.toUpperCase();
    return words.replace(/\b\w/g, c => c.toUpperCase());
};

// Shared field styling so every control has the same height, border and focus ring.
const fieldCls = 'form-input h-12';

/** Native select styled like SearchableSelect (same height, border and chevron), so every dropdown matches. */
const SelectField: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...props }) => (
    <div className="relative">
        <select {...props} className={`${fieldCls} appearance-none pr-10 cursor-pointer ${className}`}>
            {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
    </div>
);

const FieldLabel: React.FC<{ icon: React.ElementType; required?: boolean; htmlFor?: string; iconClassName?: string; children: React.ReactNode }> = ({
    icon: Icon,
    required,
    htmlFor,
    iconClassName = 'text-accent',
    children,
}) => (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-gray-700 flex items-center">
        <Icon className={`w-3.5 h-3.5 mr-1.5 ${iconClassName}`} />
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
);

const AssignLeaveModal: React.FC<AssignLeaveModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    users,
    currentUserId
}) => {
    const { user: currentUser } = useAuthStore();
    const isCurrentUserAdmin = currentUser && isAdmin(currentUser.role);

    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [leaveType, setLeaveType] = useState<LeaveType>('Earned');
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [dayOption, setDayOption] = useState<'full' | 'half'>('full');
    const [reason, setReason] = useState<string>('');
    const [doctorCertificate, setDoctorCertificate] = useState<UploadedFile | null>(null);
    const [waiveCertificate, setWaiveCertificate] = useState<boolean>(false);

    // Correction/Permission specific state
    const [correctionStatus, setCorrectionStatus] = useState<'Present' | 'Site Visit' | 'W/H'>('Present');
    const [locationName, setLocationName] = useState<string>('');
    const [punchIn, setPunchIn] = useState<string>(DEFAULT_PUNCH_IN);
    const [punchOut, setPunchOut] = useState<string>(DEFAULT_PUNCH_OUT);
    const [includeSite, setIncludeSite] = useState<boolean>(false);
    const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([defaultSiteVisit()]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [locationOptions, setLocationOptions] = useState<{ id: string; name: string }[]>([]);
    // What the employee actually punched on the selected day (null = not loaded yet).
    const [actualDay, setActualDay] = useState<{ sessions: DaySession[]; hasAttendance: boolean } | null>(null);
    // Permissions already used in the selected month (null = not loaded yet).
    const [monthPermUsage, setMonthPermUsage] = useState<{ count: number; minutes: number } | null>(null);

    const addSiteVisit = () => setSiteVisits(prev => [...prev, defaultSiteVisit()]);
    const removeSiteVisit = (idx: number) => setSiteVisits(prev => prev.filter((_, i) => i !== idx));
    const updateSiteVisit = (idx: number, field: 'in' | 'out', value: string) =>
        setSiteVisits(prev => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    const [balance, setBalance] = useState<LeaveBalance | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    // Escape closes the dialog (but not mid-submit).
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, isSubmitting, onClose]);

    // Messages render at the top of the scroll area; bring them into view so they're never missed.
    useEffect(() => {
        if (toast) bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, [toast]);

    const isAttendanceFix = ATTENDANCE_FIX_TYPES.includes(leaveType);
    const isCorrection = leaveType === 'Correction';
    const isPermission = leaveType === 'Permission';
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId), [users, selectedUserId]);
    const isFemale = ['female', 'ladies'].includes((selectedUser?.gender || '').toLowerCase());

    // Attendance rules for the selected employee's staff category (office / field / site).
    const { attendance } = useSettingsStore();
    const rules = useMemo(() => {
        if (!attendance || !selectedUser) return null;
        const category = getStaffCategory(selectedUser.role, (selectedUser as any).societyId, attendance);
        return ((attendance as any)[category] as StaffAttendanceRules) || null;
    }, [attendance, selectedUser]);
    const permissionsEnabled = rules?.enablePermission !== false;
    const maxPermsPerMonth = rules?.maxPermissionsPerMonth || 3;
    // Same pool rule as ApplyLeave: monthly pool is at least 3 hours.
    const permPoolMins = Math.round(
        ((rules?.maxPermissionDurationHours && rules.maxPermissionDurationHours >= 3) ? rules.maxPermissionDurationHours : 3) * 60
    );

    const employeeOptions = useMemo(
        () => [...users]
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map(u => ({ id: u.id, name: u.name || 'Unnamed', badge: formatRole(u.role) || undefined })),
        [users]
    );

    const leaveTypeOptions = useMemo(() => {
        const opts: { value: LeaveType; label: string }[] = [
            { value: 'Earned' as LeaveType, label: 'Earned' },
            { value: 'Sick' as LeaveType, label: 'Sick' },
        ];
        if (!isFemale) opts.push({ value: 'Floating' as LeaveType, label: '3rd Saturday Leave' });
        if (isFemale) opts.push({ value: 'Pink Leave' as LeaveType, label: 'Pink Leave' });
        opts.push({ value: 'Comp Off' as LeaveType, label: 'Comp Off' });
        opts.push({ value: 'Loss of Pay' as LeaveType, label: 'Loss of Pay' });
        if (isFemale) {
            opts.push({ value: 'Maternity' as LeaveType, label: 'Maternity' });
            opts.push({ value: 'Child Care' as LeaveType, label: 'Child Care' });
        }
        opts.push({ value: 'WFH' as LeaveType, label: 'Work From Home (WFH)' });
        opts.push({ value: 'Correction' as LeaveType, label: 'Attendance Correction (RC)' });
        opts.push({ value: 'Permission' as LeaveType, label: 'Permission (PC)' });
        return opts;
    }, [isFemale]);

    // If the selected type isn't valid for the newly selected employee (e.g. Pink Leave -> male), reset it
    // so the dropdown and the submitted value can never disagree.
    useEffect(() => {
        if (!leaveTypeOptions.some(o => o.value === leaveType)) {
            setLeaveType('Earned');
        }
    }, [leaveTypeOptions, leaveType]);

    // Corrections/permissions are single-day: collapse any previously chosen range.
    useEffect(() => {
        if (isAttendanceFix && endDate !== startDate) {
            setEndDate(startDate);
        }
    }, [isAttendanceFix, startDate, endDate]);

    const isSingleDay = useMemo(() => {
        if (!startDate || !endDate) return false;
        return isSameDay(parseLocalDate(startDate), parseLocalDate(endDate));
    }, [startDate, endDate]);

    const showHalfDayOption = isSingleDay;

    const duration = useMemo(() => {
        if (!startDate || !endDate) return 0;
        if (showHalfDayOption && dayOption === 'half') return 0.5;
        return differenceInCalendarDays(parseLocalDate(endDate), parseLocalDate(startDate)) + 1;
    }, [startDate, endDate, showHalfDayOption, dayOption]);

    useEffect(() => {
        if (isOpen) {
            setSelectedUserId('');
            setLeaveType('Earned');
            setStartDate(format(new Date(), 'yyyy-MM-dd'));
            setEndDate(format(new Date(), 'yyyy-MM-dd'));
            setDayOption('full');
            setReason('');
            setDoctorCertificate(null);
            setWaiveCertificate(false);
            setCorrectionStatus('Present');
            setLocationName('');
            setPunchIn(DEFAULT_PUNCH_IN);
            setPunchOut(DEFAULT_PUNCH_OUT);
            setIncludeSite(false);
            setSiteVisits([defaultSiteVisit()]);
            setBalance(null);
            setToast(null);
        }
    }, [isOpen]);

    // Known locations for the Location field (free text still allowed).
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        api.getLocations()
            .then(locs => {
                if (cancelled) return;
                const names = Array.from(new Set((locs || []).map(l => (l.name || '').trim()).filter(Boolean)));
                setLocationOptions(names.sort((a, b) => a.localeCompare(b)).map(n => ({ id: n, name: n })));
            })
            .catch(err => console.error('Error fetching locations:', err));
        return () => { cancelled = true; };
    }, [isOpen]);

    useEffect(() => {
        let cancelled = false;
        const fetchBalance = async () => {
            if (!selectedUserId || !isOpen) {
                setBalance(null);
                return;
            }
            setIsLoadingBalance(true);
            try {
                const b = await api.getLeaveBalancesForUser(selectedUserId);
                if (!cancelled) setBalance(b);
            } catch (err) {
                console.error('Error fetching balance:', err);
            } finally {
                if (!cancelled) setIsLoadingBalance(false);
            }
        };
        fetchBalance();
        return () => { cancelled = true; };
    }, [selectedUserId, isOpen]);

    useEffect(() => {
        if (!isOpen || !selectedUserId || !isSingleDay || !isAttendanceFix) return;

        // Ignore responses that arrive after the employee/date/type has changed.
        let cancelled = false;

        const fetchExistingLogs = async () => {
            setIsLoadingLogs(true);
            try {
                // Local-day window (not UTC), so early-morning and late-night punches land on the right day.
                const dayStart = new Date(`${startDate}T00:00:00`);
                const dayEnd = addDays(dayStart, 1);

                const { data, error: fetchError } = await supabase
                    .from('attendance_events')
                    .select('*')
                    .eq('user_id', selectedUserId)
                    .gte('timestamp', dayStart.toISOString())
                    .lt('timestamp', dayEnd.toISOString())
                    .order('timestamp', { ascending: true });

                if (fetchError) throw fetchError;
                if (cancelled) return;

                // Rebuild worked sessions (any punch-in → next punch-out) so Permission can avoid overlapping them.
                const sessions: DaySession[] = [];
                for (const ev of data || []) {
                    const t = format(new Date(ev.timestamp), 'HH:mm');
                    if (ev.type === 'punch-in' || ev.type === 'punch_in') {
                        if (!sessions.length || sessions[sessions.length - 1].out !== null) sessions.push({ in: t, out: null });
                    } else if ((ev.type === 'punch-out' || ev.type === 'punch_out') && sessions.length && sessions[sessions.length - 1].out === null) {
                        sessions[sessions.length - 1].out = t;
                    }
                }
                setActualDay({
                    sessions,
                    hasAttendance: (data || []).some(e => ATTENDANCE_IN_TYPES.includes(e.type)),
                });

                if (isPermission) {
                    // Permission = the time the employee was AWAY. On approval it is ADDED as an extra
                    // punch-in/punch-out pair, so never pre-fill it with the real punches.
                    setPunchIn('');
                    setPunchOut('');
                    setIncludeSite(false);
                    setSiteVisits([defaultSiteVisit()]);
                    const first = data?.[0];
                    if (first?.location_name === 'Work From Home') {
                        setCorrectionStatus('W/H');
                        setLocationName('');
                    } else {
                        setCorrectionStatus(first?.work_type === 'field' ? 'Site Visit' : 'Present');
                        setLocationName(first?.location_name || '');
                    }
                    return;
                }

                if (data && data.length > 0) {
                    const punchInEvent = data.find(e => e.type === 'punch-in' && e.work_type === 'office');
                    const punchOutEvent = [...data].reverse().find(e => e.type === 'punch-out' && e.work_type === 'office');

                    const fieldIns = data.filter(e => e.type === 'punch-in' && e.work_type === 'field');
                    const fieldOuts = data.filter(e => e.type === 'punch-out' && e.work_type === 'field');

                    setPunchIn(punchInEvent ? format(new Date(punchInEvent.timestamp), 'HH:mm') : DEFAULT_PUNCH_IN);
                    setPunchOut(punchOutEvent ? format(new Date(punchOutEvent.timestamp), 'HH:mm') : '');

                    const firstEvent = data[0];
                    if (firstEvent.location_name === 'Work From Home') {
                        setCorrectionStatus('W/H');
                        setLocationName('');
                    } else if (fieldIns.length > 0 || fieldOuts.length > 0 || data.some(e => e.work_type === 'field')) {
                        setCorrectionStatus('Site Visit');
                        setLocationName(firstEvent.location_name || '');
                    } else {
                        setCorrectionStatus('Present');
                        setLocationName(firstEvent.location_name || '');
                    }

                    if (fieldIns.length > 0 || fieldOuts.length > 0) {
                        setIncludeSite(true);
                        const visits: SiteVisit[] = [];
                        const maxLen = Math.max(fieldIns.length, fieldOuts.length, 1);
                        for (let i = 0; i < maxLen; i++) {
                            visits.push({
                                in: fieldIns[i] ? format(new Date(fieldIns[i].timestamp), 'HH:mm') : '10:00',
                                out: fieldOuts[i] ? format(new Date(fieldOuts[i].timestamp), 'HH:mm') : '17:00'
                            });
                        }
                        setSiteVisits(visits);
                    } else {
                        setIncludeSite(false);
                        setSiteVisits([defaultSiteVisit()]);
                    }
                } else {
                    // Reset to defaults if no records found
                    setPunchIn(DEFAULT_PUNCH_IN);
                    setPunchOut(DEFAULT_PUNCH_OUT);
                    setCorrectionStatus('Present');
                    setLocationName('');
                    setIncludeSite(false);
                    setSiteVisits([defaultSiteVisit()]);
                }
            } catch (err) {
                console.error('Error fetching existing logs for correction:', err);
            } finally {
                if (!cancelled) setIsLoadingLogs(false);
            }
        };

        setActualDay(null);
        fetchExistingLogs();
        return () => { cancelled = true; };
    }, [isOpen, selectedUserId, isSingleDay, startDate, isAttendanceFix, isPermission]);

    // Permissions already taken this month (count + minutes), for the monthly limits.
    useEffect(() => {
        setMonthPermUsage(null);
        if (!isOpen || !selectedUserId || !isPermission || !startDate) return;
        let cancelled = false;

        const monthStart = `${startDate.substring(0, 7)}-01`;
        const monthEnd = format(addDays(new Date(`${monthStart}T00:00:00`), 40), 'yyyy-MM-01');

        supabase
            .from('leave_requests')
            .select('id, correction_details, status')
            .eq('user_id', selectedUserId)
            .eq('leave_type', 'Permission')
            .gte('start_date', monthStart)
            .lt('start_date', monthEnd)
            .not('status', 'in', `(${INACTIVE_REQUEST_STATUSES.join(',')})`)
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error) {
                    console.error('Error fetching monthly permissions:', error);
                    return;
                }
                let minutes = 0;
                for (const r of data || []) {
                    const d = (r as any).correction_details || {};
                    const pin = d.punchIn ?? d.punch_in;
                    const pout = d.punchOut ?? d.punch_out;
                    if (pin && pout) minutes += Math.max(0, toMins(pout) - toMins(pin));
                    else if (d.permissionMinutes ?? d.permission_minutes) minutes += Number(d.permissionMinutes ?? d.permission_minutes);
                }
                setMonthPermUsage({ count: (data || []).length, minutes });
            });

        return () => { cancelled = true; };
    }, [isOpen, selectedUserId, isPermission, startDate]);

    const availableBalance = useMemo(() => {
        if (!balance || !leaveType) return 0;

        const typeKeyMap: Record<string, keyof LeaveBalance> = {
            'Earned': 'earnedTotal',
            'Sick': 'sickTotal',
            'Floating': 'floatingTotal',
            'Comp Off': 'compOffTotal',
            'Maternity': 'maternityTotal',
            'Child Care': 'childCareTotal',
            'Pink Leave': 'pinkTotal'
        };

        const usedKeyMap: Record<string, keyof LeaveBalance> = {
            'Earned': 'earnedUsed',
            'Sick': 'sickUsed',
            'Floating': 'floatingUsed',
            'Comp Off': 'compOffUsed',
            'Maternity': 'maternityUsed',
            'Child Care': 'childCareUsed',
            'Pink Leave': 'pinkUsed'
        };

        const totalKey = typeKeyMap[leaveType];
        const usedKey = usedKeyMap[leaveType];
        if (!totalKey || !usedKey) return 0;

        const total = (balance[totalKey] as number) || 0;
        const used = (balance[usedKey] as number) || 0;
        return total - used;
    }, [balance, leaveType]);

    const needsBalance = !BALANCE_EXEMPT_TYPES.includes(leaveType);
    const insufficientBalance = needsBalance && availableBalance < duration;

    /** Returns an error message for the correction/permission times, or null when valid. */
    const validateAttendanceTimes = (): string | null => {
        if (isPermission) return validatePermission();

        if (!punchIn) return 'Punch In time is required.';
        // Approval rebuilds the day from these two times, so both are mandatory.
        if (!punchOut) return 'Punch Out time is required for a correction.';
        if (punchOut <= punchIn) return 'Punch Out must be after Punch In.';

        if (isCorrection) {
            if (startDate > todayStr) return 'You cannot correct attendance for a future date.';
            if (startDate === todayStr) {
                const nowHHmm = format(new Date(), 'HH:mm');
                if (punchIn > nowHHmm) return 'Punch In cannot be later than the current time.';
                if (punchOut && punchOut > nowHHmm) return 'Punch Out cannot be later than the current time. Leave it empty if the employee is still working.';
            }
        }

        if (includeSite) {
            const windowEnd = punchOut || '23:59';
            const sorted = [...siteVisits].sort((a, b) => a.in.localeCompare(b.in));
            for (let i = 0; i < sorted.length; i++) {
                const v = sorted[i];
                if (!v.in || !v.out) return `Site visit ${i + 1}: both Site In and Site Out are required.`;
                if (v.out <= v.in) return `Site visit ${v.in}–${v.out}: Site Out must be after Site In.`;
                if (v.in < punchIn || v.out > windowEnd) {
                    return `Site visit ${v.in}–${v.out} must fall within the punch window (${punchIn}–${punchOut || 'end of day'}).`;
                }
                if (i > 0 && v.in < sorted[i - 1].out) {
                    return `Site visits ${sorted[i - 1].in}–${sorted[i - 1].out} and ${v.in}–${v.out} overlap.`;
                }
            }
        }
        return null;
    };

    const permissionMins = isPermission && punchIn && punchOut && punchOut > punchIn ? toMins(punchOut) - toMins(punchIn) : 0;

    const shiftStart = rules?.fixedOfficeHours?.checkInTime || '09:00';
    const shiftEnd = rules?.fixedOfficeHours?.checkOutTime || '18:00';
    const openSession = actualDay?.sessions.find(s => s.out === null) || null;

    /** Ready-made windows from the employee's actual punches vs. their shift (late arrival, gaps, early leave). */
    const permissionSuggestions = useMemo(() => {
        if (!isPermission || !actualDay || startDate > todayStr) return [];
        const ss = actualDay.sessions;
        if (!ss.length) return [];
        const out: { label: string; from: string; to: string }[] = [];
        if (ss[0].in > shiftStart) out.push({ label: 'Late arrival', from: shiftStart, to: ss[0].in });
        for (let i = 0; i < ss.length - 1; i++) {
            const gapFrom = ss[i].out;
            const gapTo = ss[i + 1].in;
            if (gapFrom && toMins(gapTo) - toMins(gapFrom) >= 5) out.push({ label: 'Away between punches', from: gapFrom, to: gapTo });
        }
        const last = ss[ss.length - 1];
        if (last.out && last.out < shiftEnd) out.push({ label: 'Early leave', from: last.out, to: shiftEnd });
        return out;
    }, [isPermission, actualDay, startDate, todayStr, shiftStart, shiftEnd]);

    /**
     * Explains, in plain words, why the chosen window doesn't fit the employee's punches,
     * and (where possible) offers the corrected window.
     */
    const permissionIssue = useMemo((): { message: string; fix?: { from: string; to: string } } | null => {
        if (!isPermission || !actualDay || startDate > todayStr) return null;

        // Still punched in: approving now would add a punch-out and mark them as punched out.
        if (openSession) {
            return startDate === todayStr
                ? { message: `${selectedUser?.name || 'The employee'} is still punched in (since ${formatTime12(openSession.in)}). Wait until they punch out, then record the permission from their actual punch-out time. Approving it now would mark them as punched out.` }
                : { message: `There's no punch-out on this day (punched in at ${formatTime12(openSession.in)}). Fix the day with an Attendance Correction first.` };
        }

        if (!punchIn || !punchOut || punchOut <= punchIn) return null;
        const clash = actualDay.sessions.find(s => s.out && punchIn < s.out && punchOut > s.in);
        if (!clash || !clash.out) return null;
        const sIn = clash.in;
        const sOut = clash.out;

        if (punchIn >= sIn && punchOut <= sOut) {
            return { message: `Already punched in from ${formatTime12(sIn)} to ${formatTime12(sOut)}. That time already counts as worked, so no permission is needed for it.` };
        }
        if (punchIn >= sIn && punchOut > sOut) {
            return {
                message: `They were working until ${formatTime12(sOut)}, so the time away starts at ${formatTime12(sOut)}, not ${formatTime12(punchIn)}.`,
                fix: { from: sOut, to: punchOut },
            };
        }
        if (punchIn < sIn && punchOut <= sOut) {
            return {
                message: `They punched in at ${formatTime12(sIn)}, so the time away ends at ${formatTime12(sIn)}, not ${formatTime12(punchOut)}.`,
                fix: { from: punchIn, to: sIn },
            };
        }
        return { message: `They worked ${formatTime12(sIn)} – ${formatTime12(sOut)}, which is inside this window. Choose only the time they were away.` };
    }, [isPermission, actualDay, startDate, todayStr, openSession, punchIn, punchOut, selectedUser]);

    /** Permission = time away from work, added on approval as an extra punch-in/out pair. */
    const validatePermission = (): string | null => {
        if (!permissionsEnabled) return 'Permissions are disabled for this employee\'s staff category in Attendance Rules.';
        if (!punchIn || !punchOut) return 'Both "Away From" and "Away Until" times are required for a permission.';
        if (punchOut <= punchIn) return '"Away Until" must be after "Away From".';

        if (startDate <= todayStr) {
            if (!actualDay) return 'Still loading the employee\'s punches for this day. Please wait a moment.';
            if (!actualDay.hasAttendance) {
                return 'The employee has no punches on this day. A permission only covers part of a worked day; use Attendance Correction instead.';
            }
            if (permissionIssue) return permissionIssue.message;
        }

        if (monthPermUsage) {
            if (monthPermUsage.count >= maxPermsPerMonth) {
                return `This employee has already used ${monthPermUsage.count} of ${maxPermsPerMonth} permissions this month.`;
            }
            if (monthPermUsage.minutes + permissionMins > permPoolMins) {
                const left = Math.max(0, permPoolMins - monthPermUsage.minutes);
                return `This exceeds the monthly permission limit of ${formatMins(permPoolMins)}. Only ${formatMins(left)} left this month.`;
            }
        }
        return null;
    };

    /** Finds an active request for the same employee that overlaps the chosen dates. */
    const findOverlappingRequest = async () => {
        const { data, error } = await supabase
            .from('leave_requests')
            .select('id, leave_type, start_date, end_date, status')
            .eq('user_id', selectedUserId)
            .lte('start_date', endDate)
            .gte('end_date', startDate)
            .not('status', 'in', `(${INACTIVE_REQUEST_STATUSES.join(',')})`);

        if (error) {
            console.error('Overlap check failed:', error);
            return null; // don't block on a failed check
        }
        // Permission covers only a few hours, so it can co-exist with other entries.
        return (data || []).find(r => !isPermission && r.leave_type !== 'Permission') || null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!selectedUserId) {
            setToast({ message: 'Please select an employee.', type: 'error' });
            return;
        }
        if (!leaveTypeOptions.some(o => o.value === leaveType)) {
            setToast({ message: 'The selected type is not available for this employee.', type: 'error' });
            return;
        }
        if (reason.trim().length < MIN_REASON_LENGTH) {
            setToast({ message: `Please provide a detailed reason (at least ${MIN_REASON_LENGTH} characters).`, type: 'error' });
            return;
        }
        if (parseLocalDate(endDate) < parseLocalDate(startDate)) {
            setToast({ message: 'End date must be on or after start date.', type: 'error' });
            return;
        }
        if (isAttendanceFix) {
            const timeError = validateAttendanceTimes();
            if (timeError) {
                setToast({ message: timeError, type: 'error' });
                return;
            }
        }

        if (leaveType === 'Sick' && !doctorCertificate && !waiveCertificate && !isCurrentUserAdmin) {
            setToast({ message: 'Please attach a doctor\'s certificate/prescription for sick leave.', type: 'error' });
            return;
        }

        if (insufficientBalance) {
            setToast({
                message: `Insufficient ${leaveType} balance. Available: ${availableBalance} days, requested: ${duration} days.`,
                type: 'error'
            });
            return;
        }

        setIsSubmitting(true);
        setToast(null);

        try {
            const overlap = await findOverlappingRequest();
            if (overlap) {
                const range = overlap.start_date === overlap.end_date
                    ? overlap.start_date
                    : `${overlap.start_date} to ${overlap.end_date}`;
                setToast({
                    message: `${selectedUser?.name || 'This employee'} already has a ${overlap.leave_type} request (${range}, ${String(overlap.status).replace(/_/g, ' ')}) on these dates.`,
                    type: 'error'
                });
                return;
            }

            await api.submitLeaveRequest({
                userId: selectedUserId,
                userName: selectedUser?.name || 'Unknown',
                leaveType,
                startDate,
                endDate,
                reason: reason.trim(),
                dayOption: showHalfDayOption && !isAttendanceFix ? dayOption : 'full',
                doctorCertificate: leaveType === 'Sick' && !waiveCertificate ? doctorCertificate : undefined,
                ...((leaveType === 'Sick' && waiveCertificate) ? { bypassDoctorCertificate: true } : {}),
                correctionDetails: isAttendanceFix ? {
                    status: correctionStatus,
                    locationName: correctionStatus === 'W/H' && !includeSite ? '' : locationName.trim(),
                    punchIn,
                    punchOut,
                    includeSite: isPermission ? false : includeSite,
                    includeBreak: false,
                    siteVisits: includeSite && !isPermission ? siteVisits : [],
                    ...(isPermission ? { permissionMinutes: permissionMins } : {})
                } : undefined
            });

            // Record audit log. supabase-js returns errors instead of throwing, so check explicitly.
            let auditFailed = false;
            try {
                const { error: auditError } = await supabase.from('attendance_audit_logs').insert([{
                    action: 'LEAVE_ASSIGNED',
                    performed_by: currentUserId,
                    target_user_id: selectedUserId,
                    details: {
                        leaveType,
                        startDate,
                        endDate,
                        duration,
                        reason: reason.trim(),
                        userName: selectedUser?.name,
                        source: 'Manual Assignment'
                    }
                }]);
                if (auditError) throw auditError;
            } catch (auditErr) {
                auditFailed = true;
                console.error('Failed to record audit log:', auditErr);
            }

            setToast(auditFailed
                ? { message: `${submitLabel} saved, but the audit log could not be recorded. Please inform IT.`, type: 'error' }
                : { message: `${submitLabel} saved successfully!`, type: 'success' });
            onSuccess();
            setTimeout(() => {
                onClose();
            }, auditFailed ? 3500 : 1500);
        } catch (err: any) {
            console.error('Assign leave error:', err);
            setToast({ message: err.message || 'Failed to assign leave.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const title = isCorrection ? 'Attendance Correction' : isPermission ? 'Permission (PC)' : 'Assign Manual Leave';
    const subtitle = isCorrection
        ? 'Correct punch records on behalf of an employee'
        : isPermission
            ? 'Cover time the employee was away: late arrival, early leave or a short break'
            : 'Assign leave on behalf of an employee';
    const submitLabel = isCorrection ? 'Correction' : isPermission ? 'Permission' : 'Leave';
    const submitButtonText = isCorrection ? 'Submit Correction' : isPermission ? 'Submit Permission' : 'Assign Leave';
    const permissionTimeInvalid = isPermission && !!punchIn && !!punchOut && punchOut <= punchIn;

    const reasonLength = reason.trim().length;
    const HeaderIcon = isCorrection ? History : isPermission ? Timer : CalendarCheck;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="assign-leave-title"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="flex justify-between items-center gap-3 p-5 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-accent-light text-accent flex items-center justify-center">
                            <HeaderIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 id="assign-leave-title" className="text-lg sm:text-xl font-bold text-gray-800 leading-tight">{title}</h2>
                            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        aria-label="Close"
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div ref={bodyRef} className="p-5 sm:p-6 overflow-y-auto custom-scrollbar relative">
                    {toast && (
                        <div className="mb-4">
                            <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
                        </div>
                    )}

                    <form id="assign-leave-form" onSubmit={handleSubmit} className="space-y-5">
                        {/* Employee Selection */}
                        <div className="space-y-1.5">
                            <FieldLabel icon={User} required htmlFor="assign-leave-employee">Employee</FieldLabel>
                            <SearchableSelect
                                id="assign-leave-employee"
                                placeholder="Search employee by name or role..."
                                options={employeeOptions}
                                value={selectedUserId}
                                onChange={setSelectedUserId}
                            />
                        </div>

                        {/* Request Type */}
                        <div className="space-y-1.5">
                            <FieldLabel icon={FileText} required htmlFor="assign-leave-type">Request Type</FieldLabel>
                            <SelectField
                                id="assign-leave-type"
                                value={leaveType}
                                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                            >
                                {leaveTypeOptions.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </SelectField>
                        </div>

                        {/* Date Range */}
                        <div className={isAttendanceFix ? 'space-y-1.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
                            <div className="space-y-1.5">
                                <FieldLabel icon={CalendarIcon} required htmlFor="assign-leave-start">
                                    {isAttendanceFix ? 'Date' : 'Start Date'}
                                </FieldLabel>
                                <input
                                    id="assign-leave-start"
                                    type="date"
                                    value={startDate}
                                    max={isCorrection ? todayStr : undefined}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        if (isAttendanceFix) setEndDate(e.target.value);
                                    }}
                                    className={fieldCls}
                                    required
                                />
                            </div>

                            {!isAttendanceFix && (
                                <div className="space-y-1.5">
                                    <FieldLabel icon={CalendarIcon} required htmlFor="assign-leave-end">End Date</FieldLabel>
                                    <input
                                        id="assign-leave-end"
                                        type="date"
                                        value={endDate}
                                        min={startDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className={fieldCls}
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        {/* Half Day Option */}
                        {showHalfDayOption && !isAttendanceFix && (
                            <div className="space-y-1.5">
                                <FieldLabel icon={Clock} htmlFor="assign-leave-dayopt">Day Option</FieldLabel>
                                <SelectField
                                    id="assign-leave-dayopt"
                                    value={dayOption}
                                    onChange={(e) => setDayOption(e.target.value as 'full' | 'half')}
                                >
                                    <option value="full">Full Day</option>
                                    <option value="half">Half Day</option>
                                </SelectField>
                            </div>
                        )}

                        {/* Balance Info */}
                        {isCurrentUserAdmin && selectedUserId && !isAttendanceFix && (
                            <div className={`border p-4 rounded-lg flex items-start gap-3 ${insufficientBalance && !isLoadingBalance ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                <Info className={`w-5 h-5 mt-0.5 shrink-0 ${insufficientBalance && !isLoadingBalance ? 'text-red-600' : 'text-accent'}`} />
                                <div className="text-sm text-gray-800">
                                    {isLoadingBalance ? (
                                        <p className="flex items-center gap-2">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Checking balance...
                                        </p>
                                    ) : (
                                        <div className="space-y-1">
                                            <p className="font-semibold">Current Balance: {needsBalance ? `${availableBalance} days` : 'Not applicable'}</p>
                                            <p className="text-xs text-gray-600">Requesting: {duration} day{duration === 1 ? '' : 's'}</p>
                                            {insufficientBalance && (
                                                <p className="text-red-600 font-medium text-xs mt-1">Insufficient balance for this request</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Sick Leave Medical Certificate / Document Upload */}
                        {leaveType === 'Sick' && (
                            <div className="p-4 border border-amber-200 bg-amber-50/50 rounded-xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                        <Paperclip className="w-4 h-4 text-amber-600" />
                                        Doctor's Certificate / Prescription {!waiveCertificate && <span className="text-red-500">*</span>}
                                    </label>
                                    {isCurrentUserAdmin && (
                                        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer hover:text-gray-900 select-none">
                                            <input
                                                type="checkbox"
                                                checked={waiveCertificate}
                                                onChange={(e) => setWaiveCertificate(e.target.checked)}
                                                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                            />
                                            <span className="font-medium text-[11px]">Waive (Admin Override)</span>
                                        </label>
                                    )}
                                </div>

                                {!waiveCertificate ? (
                                    <div className="space-y-1">
                                        <UploadDocument
                                            label="Attach Medical Certificate (Image / PDF)"
                                            file={doctorCertificate}
                                            onFileChange={setDoctorCertificate}
                                            allowCapture
                                            hideLabel
                                        />
                                        <p className="text-[11px] text-amber-800/80">
                                            Attach a scanned copy, photo, or PDF prescription for official records.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-2.5 bg-amber-100/60 rounded-lg border border-amber-300/60 text-xs text-amber-900 font-medium flex items-center gap-2">
                                        <Info className="w-4 h-4 text-amber-700 shrink-0" />
                                        <span>Admin Override: Medical certificate requirement is waived for this manual entry.</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Correction / Permission Fields */}
                        {isAttendanceFix && (
                            <div className="relative space-y-4 p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                                {/* One summary card: recorded punches + what this request will do */}
                                <div className={`rounded-lg bg-white border border-gray-200 border-l-4 ${isCorrection ? 'border-l-amber-400' : 'border-l-accent'} px-3 py-2.5 text-xs space-y-1.5`}>
                                    <div className="flex items-start gap-2 text-gray-600">
                                        <History className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
                                        {!selectedUserId ? (
                                            <span className="text-gray-500">Select an employee to see their punches for this day.</span>
                                        ) : isLoadingLogs || !actualDay ? (
                                            <span className="flex items-center gap-1.5 text-gray-500">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Loading punches…
                                            </span>
                                        ) : (
                                            <span>
                                                <span className="font-semibold text-gray-700">Recorded: </span>
                                                {actualDay.sessions.length === 0
                                                    ? <span className="text-gray-400">{actualDay.hasAttendance ? 'Site punches only' : 'No punches on this day'}</span>
                                                    : actualDay.sessions.map((s, i) => (
                                                        <span key={i} className="whitespace-nowrap">
                                                            {i > 0 && <span className="text-gray-300"> · </span>}
                                                            {formatTime12(s.in)} – {s.out ? formatTime12(s.out) : <span className="text-amber-600 font-medium">still in</span>}
                                                        </span>
                                                    ))}
                                            </span>
                                        )}
                                    </div>
                                    <div className={`flex items-start gap-2 ${isCorrection ? 'text-amber-800' : 'text-emerald-900'}`}>
                                        {isCorrection
                                            ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                                            : <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" />}
                                        <span>
                                            {isCorrection
                                                ? 'On approval, these times replace every punch recorded on this day.'
                                                : <>Enter when the employee was <b>away</b>. It's added to their punches on approval, so it can't overlap time already worked.</>}
                                        </span>
                                    </div>
                                    {isPermission && selectedUserId && !permissionsEnabled && (
                                        <div className="flex items-start gap-2 font-semibold text-red-600">
                                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            Permissions are disabled for this staff category.
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className={`space-y-1.5 ${correctionStatus === 'W/H' && !includeSite ? 'sm:col-span-2' : ''}`}>
                                        <FieldLabel icon={Activity} htmlFor="assign-leave-status">Status</FieldLabel>
                                        <SelectField
                                            id="assign-leave-status"
                                            value={correctionStatus}
                                            onChange={(e) => {
                                                const val = e.target.value as 'Present' | 'Site Visit' | 'W/H';
                                                setCorrectionStatus(val);
                                                if (val === 'Site Visit' && !isPermission) setIncludeSite(true);
                                            }}
                                        >
                                            <option value="Present">Present (Office)</option>
                                            <option value="Site Visit">Site Visit (Field)</option>
                                            <option value="W/H">Work From Home</option>
                                        </SelectField>
                                    </div>
                                    {(correctionStatus === 'Present' || correctionStatus === 'Site Visit' || includeSite) && (
                                        <div className="space-y-1.5">
                                            <FieldLabel icon={MapPin} htmlFor="assign-leave-location">Location</FieldLabel>
                                            <SearchableSelect
                                                id="assign-leave-location"
                                                placeholder={correctionStatus === 'Site Visit' || includeSite ? 'Search site...' : 'Search office...'}
                                                options={locationOptions}
                                                value={locationName}
                                                onChange={setLocationName}
                                                allowCustom
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Suggested windows from the employee's actual punches */}
                                {permissionSuggestions.length > 0 && !openSession && (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-semibold text-gray-600">Suggested from their punches</p>
                                        <div className="flex flex-wrap gap-2">
                                            {permissionSuggestions.map(sg => {
                                                const active = punchIn === sg.from && punchOut === sg.to;
                                                return (
                                                    <button
                                                        key={`${sg.from}-${sg.to}`}
                                                        type="button"
                                                        onClick={() => { setPunchIn(sg.from); setPunchOut(sg.to); }}
                                                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${active
                                                            ? 'border-accent bg-accent text-white'
                                                            : 'border-gray-200 bg-white text-gray-700 hover:border-accent hover:text-accent'}`}
                                                    >
                                                        <span className="font-semibold">{sg.label}</span>
                                                        <span className={active ? 'text-white/80' : 'text-gray-400'}> · {formatTime12(sg.from)} – {formatTime12(sg.to)} ({formatMins(toMins(sg.to) - toMins(sg.from))})</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <FieldLabel icon={Clock} iconClassName="text-green-600" required htmlFor="assign-leave-in">
                                            {isPermission ? 'Away From' : 'Punch In'}
                                        </FieldLabel>
                                        <input
                                            id="assign-leave-in"
                                            type="time"
                                            value={punchIn}
                                            onChange={(e) => setPunchIn(e.target.value)}
                                            className={fieldCls}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <FieldLabel icon={Clock} iconClassName="text-red-500" required htmlFor="assign-leave-out">
                                            {isPermission ? 'Away Until' : 'Punch Out'}
                                        </FieldLabel>
                                        <input
                                            id="assign-leave-out"
                                            type="time"
                                            value={punchOut}
                                            min={punchIn || undefined}
                                            onChange={(e) => setPunchOut(e.target.value)}
                                            className={`${fieldCls} ${(punchOut && punchIn && punchOut <= punchIn) || (permissionIssue && !openSession) ? 'form-input--error' : ''}`}
                                            required
                                        />
                                    </div>
                                </div>
                                {punchOut && punchIn && punchOut <= punchIn && (
                                    <p className="-mt-2 text-xs text-red-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        {permissionTimeInvalid ? '"Away Until" must be after "Away From".' : 'Punch Out must be after Punch In.'}
                                    </p>
                                )}
                                {permissionIssue && (
                                    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${openSession
                                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                                        : 'bg-red-50 border-red-200 text-red-800'}`}>
                                        <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${openSession ? 'text-amber-500' : 'text-red-500'}`} />
                                        <div className="space-y-2">
                                            <p>{permissionIssue.message}</p>
                                            {permissionIssue.fix && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setPunchIn(permissionIssue.fix!.from); setPunchOut(permissionIssue.fix!.to); }}
                                                    className="rounded-md bg-white border border-red-200 px-2.5 py-1 font-semibold text-red-700 hover:bg-red-100 transition-colors"
                                                >
                                                    Use {formatTime12(permissionIssue.fix.from)} – {formatTime12(permissionIssue.fix.to)} ({formatMins(toMins(permissionIssue.fix.to) - toMins(permissionIssue.fix.from))})
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Permission duration + monthly allowance */}
                                {isPermission && selectedUserId && (
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <span className="text-gray-600">
                                            Duration: <b className="text-gray-800">{permissionMins ? formatMins(permissionMins) : '—'}</b>
                                        </span>
                                        {monthPermUsage && (
                                            <span className={
                                                monthPermUsage.count >= maxPermsPerMonth || monthPermUsage.minutes + permissionMins > permPoolMins
                                                    ? 'text-red-600 font-medium'
                                                    : 'text-gray-500'
                                            }>
                                                This month: {monthPermUsage.count}/{maxPermsPerMonth} used · {formatMins(Math.max(0, permPoolMins - monthPermUsage.minutes))} of {formatMins(permPoolMins)} left
                                            </span>
                                        )}
                                    </div>
                                )}

                                {!isPermission && <div className="space-y-2 pt-3 border-t border-gray-200">
                                    <label htmlFor="adminIncludeSite" className="flex items-center gap-2 cursor-pointer select-none w-fit">
                                        <input
                                            type="checkbox"
                                            id="adminIncludeSite"
                                            checked={includeSite}
                                            onChange={(e) => setIncludeSite(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Include site visit</span>
                                    </label>

                                    {includeSite && (
                                        <div className="space-y-3 mt-2">
                                            {siteVisits.map((visit, idx) => {
                                                const invalid = !!visit.in && !!visit.out && visit.out <= visit.in;
                                                return (
                                                    <div key={idx} className="flex items-end gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                                                        <div className="flex-1 space-y-1">
                                                            <label className="text-xs font-semibold text-gray-500">Site In</label>
                                                            <input
                                                                type="time"
                                                                value={visit.in}
                                                                onChange={(e) => updateSiteVisit(idx, 'in', e.target.value)}
                                                                className={`${fieldCls} !h-10`}
                                                            />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <label className="text-xs font-semibold text-gray-500">Site Out</label>
                                                            <input
                                                                type="time"
                                                                value={visit.out}
                                                                min={visit.in || undefined}
                                                                onChange={(e) => updateSiteVisit(idx, 'out', e.target.value)}
                                                                className={`${fieldCls} !h-10 ${invalid ? 'form-input--error' : ''}`}
                                                            />
                                                        </div>
                                                        {siteVisits.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSiteVisit(idx)}
                                                                aria-label="Remove site visit"
                                                                className="p-2 mb-0.5 text-red-500 hover:bg-red-50 rounded-lg"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            <button
                                                type="button"
                                                onClick={addSiteVisit}
                                                className="text-xs font-semibold text-accent hover:text-accent-dark"
                                            >
                                                + Add another site visit
                                            </button>
                                        </div>
                                    )}
                                </div>}
                            </div>
                        )}

                        {/* Reason */}
                        <div className="space-y-1.5">
                            <FieldLabel icon={MessageSquare} required htmlFor="assign-leave-reason">Reason / Notes</FieldLabel>
                            <textarea
                                id="assign-leave-reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder={isCorrection
                                    ? 'e.g. Employee forgot to punch out; confirmed with manager.'
                                    : 'Please provide details about this manual assignment...'}
                                className="form-input h-24 resize-none"
                                required
                            />
                            <p className={`text-[11px] text-right ${reasonLength >= MIN_REASON_LENGTH ? 'text-accent' : 'text-gray-400'}`}>
                                {reasonLength < MIN_REASON_LENGTH
                                    ? `${MIN_REASON_LENGTH - reasonLength} more character${MIN_REASON_LENGTH - reasonLength === 1 ? '' : 's'} needed`
                                    : `${reasonLength} characters`}
                            </p>
                        </div>
                    </form>
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="assign-leave-form"
                        disabled={isSubmitting || (!!selectedUserId && !isLoadingBalance && insufficientBalance)}
                        className="px-6 py-2 text-sm font-semibold text-white bg-accent rounded-lg hover:bg-accent-dark transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                {submitButtonText}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssignLeaveModal;
