import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Calendar as CalendarIcon, Clock, User, FileText } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { format, addDays, parseISO } from 'date-fns';
import { User as UserType } from '../../types';
import { api } from '../../services/api';
import { getStaffCategory } from '../../utils/attendanceCalculations';

import Toast from '../ui/Toast';

interface ManualAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    users: UserType[];
    currentUserRole: string;
    currentUserId: string;
    correctionRequestId?: string;
}

const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({ 
    isOpen, 
    onClose, 
    onSuccess, 
    users,
    currentUserRole,
    currentUserId,
    correctionRequestId
}) => {
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [status, setStatus] = useState<string>('Present'); // Present, W/H, On Leave
    const [checkInTime, setCheckInTime] = useState<string>('09:00');
    const [checkOutTime, setCheckOutTime] = useState<string>('19:30');
    const [checkOutNextDay, setCheckOutNextDay] = useState<boolean>(false);
    const [locationName, setLocationName] = useState<string>('Office');
    const [reason, setReason] = useState<string>('');
    const [breakInTime, setBreakInTime] = useState<string>('13:00');
    const [breakOutTime, setBreakOutTime] = useState<string>('14:00');
    const [includeBreak, setIncludeBreak] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingExisting, setIsLoadingExisting] = useState(false);
    const [existingEventIds, setExistingEventIds] = useState<string[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Enhanced State
    const [userCategory, setUserCategory] = useState<'office' | 'field' | 'site'>('office');
    const [includeSiteVisit, setIncludeSiteVisit] = useState<boolean>(false);
    const [siteOtInTime, setSiteOtInTime] = useState<string>('19:30');
    const [siteOtOutTime, setSiteOtOutTime] = useState<string>('21:30');
    const [siteOtNextDay, setSiteOtNextDay] = useState<boolean>(false);
    const [includeSiteOt, setIncludeSiteOt] = useState<boolean>(false);
    const [siteVisits, setSiteVisits] = useState<{in: string, out: string}[]>([{in: '09:00', out: '18:00'}]);

    const addSiteVisit = () => setSiteVisits([...siteVisits, {in: '10:00', out: '17:00'}]);
    const removeSiteVisit = (idx: number) => setSiteVisits(siteVisits.filter((_, i) => i !== idx));
    const updateSiteVisit = (idx: number, field: 'in'|'out', value: string) => {
        const newVisits = [...siteVisits];
        newVisits[idx][field] = value;
        setSiteVisits(newVisits);
    };

    useEffect(() => {
        if (isOpen) {
            // Reset form
            setSelectedUserId('');
            setDate(format(new Date(), 'yyyy-MM-dd'));
            setStatus('Present');
            setCheckInTime('09:00');
            setCheckOutTime('19:30');
            setCheckOutNextDay(false);
            setBreakInTime('13:00');
            setBreakOutTime('14:00');
            setIncludeBreak(false);
            setIncludeSiteVisit(false);
            setLocationName('Office');
            setReason('');
            setExistingEventIds([]);
            setIsLoadingExisting(false);
            setToast(null);
            setIncludeSiteOt(false);

            // Determine user category initially if applicable
            if (currentUserRole && !correctionRequestId) {
                // If it's a manager looking at their own or team's, we use their mapping if available
                // But usually we determine it from the selected user later.
            }

            // If correction request ID is provided, fetch details
            if (correctionRequestId) {
                const fetchCorrectionRequest = async () => {
                    try {
                        const { data } = await supabase.from('leave_requests').select('*').eq('id', correctionRequestId).single();
                        if (data) {
                            setSelectedUserId(data.user_id);
                            setDate(data.start_date);
                            setReason(`Correction for: ${data.reason}`);
                        }
                    } catch (err) {
                        console.error('Error fetching correction request:', err);
                    }
                };
                fetchCorrectionRequest();
            }
        }
    }, [isOpen, correctionRequestId, currentUserRole]);

    useEffect(() => {
        const fetchExistingLogs = async () => {
            if (!selectedUserId || !date || !isOpen) return;

            // 1. Detect User Category first
            const selectedUser = users.find(u => u.id === selectedUserId);
            if (selectedUser) {
                const category = getStaffCategory(selectedUser.roleId);
                setUserCategory(category);
                
                // If switching to field/site, update default status
                if (category !== 'office' && status === 'Present') {
                    setStatus('Site Visit');
                }
            }

            setIsLoadingExisting(true);
            try {
                // Use IST-aware range: from midnight IST on the selected date
                // through end of day (23:59:59 IST) on the SAME day only.
                // BUG FIX: Previously used next-day noon which caused day N+1 events
                // (e.g. day 15) to be fetched and then deleted when day N (day 14) was updated.
                // Overnight punch-outs that cross midnight are handled via the checkOutNextDay flag,
                // so we do NOT need to extend the fetch window into the next calendar day.
                const dayStart = parseISO(`${date}T00:00:00+05:30`);
                const dayEnd = parseISO(`${date}T23:59:59+05:30`); // same day end only
                const startDate = dayStart.toISOString();
                const endDate = dayEnd.toISOString();

                const { data, error: fetchError } = await supabase
                    .from('attendance_events')
                    .select('*')
                    .eq('user_id', selectedUserId)
                    .gte('timestamp', startDate)
                    .lte('timestamp', endDate);

                if (fetchError) throw fetchError;

                if (data && data.length > 0) {
                    setExistingEventIds(data.map(e => e.id));
                    
                    // Find granular segments
                    // 1. Main session punch in/out
                    const punchIn = data.find(e => e.type === 'punch-in' && (!e.work_type || e.work_type === 'office')) || data.find(e => e.type === 'punch-in');
                    const punchOut = data.find(e => e.type === 'punch-out' && (!e.work_type || e.work_type === 'office')) || data.find(e => e.type === 'punch-out');
                    const breakIn = data.find(e => e.type === 'break-in');
                    const breakOut = data.find(e => e.type === 'break-out');
                    const siteOtIn = data.find(e => e.type === 'site-ot-in');
                    const siteOtOut = data.find(e => e.type === 'site-ot-out');

                    // Populate times — detect next-day checkout
                    if (punchIn) setCheckInTime(format(new Date(punchIn.timestamp), 'HH:mm'));
                    if (punchOut) {
                        const outTime = format(new Date(punchOut.timestamp), 'HH:mm');
                        const outDate = format(new Date(punchOut.timestamp), 'yyyy-MM-dd');
                        setCheckOutTime(outTime);
                        setCheckOutNextDay(outDate !== date);
                    }

                    // 2. Field/Site Visits (site-in/site-out or punch-in with field work_type)
                    const fieldIns = data.filter(e => (e.type === 'site-in' || (e.type === 'punch-in' && e.work_type === 'field'))).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    const fieldOuts = data.filter(e => (e.type === 'site-out' || (e.type === 'punch-out' && e.work_type === 'field'))).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                    if (fieldIns.length > 0 || fieldOuts.length > 0) {
                        const visits = [];
                        const maxLen = Math.max(fieldIns.length, fieldOuts.length, 1);
                        for (let i = 0; i < maxLen; i++) {
                            visits.push({
                                in: fieldIns[i] ? format(new Date(fieldIns[i].timestamp), 'HH:mm') : '09:00',
                                out: fieldOuts[i] ? format(new Date(fieldOuts[i].timestamp), 'HH:mm') : '18:00'
                            });
                        }
                        setSiteVisits(visits);
                        setIncludeSiteVisit(true);
                    } else {
                        setSiteVisits([{in: '09:00', out: '18:00'}]);
                        setIncludeSiteVisit(false);
                    }

                    if (breakIn || breakOut) {
                        setIncludeBreak(true);
                        if (breakIn) setBreakInTime(format(new Date(breakIn.timestamp), 'HH:mm'));
                        if (breakOut) setBreakOutTime(format(new Date(breakOut.timestamp), 'HH:mm'));
                    } else {
                        setIncludeBreak(false);
                    }

                    if (siteOtIn || siteOtOut) {
                        setIncludeSiteOt(true);
                        if (siteOtIn) setSiteOtInTime(format(new Date(siteOtIn.timestamp), 'HH:mm'));
                        if (siteOtOut) {
                            setSiteOtOutTime(format(new Date(siteOtOut.timestamp), 'HH:mm'));
                            const otOutDate = format(new Date(siteOtOut.timestamp), 'yyyy-MM-dd');
                            setSiteOtNextDay(otOutDate !== date);
                        }
                    } else {
                        setIncludeSiteOt(false);
                        setSiteOtNextDay(false);
                    }

                    // Set status/location context
                    const firstEvent = data[0];
                    const hasFieldEvent = data.some(e => e.work_type === 'field' || e.type === 'site-in' || e.type === 'site-ot-in');

                    if (hasFieldEvent) {
                        setStatus('Site Visit');
                        setLocationName(firstEvent.location_name || '');
                    } else if (firstEvent.location_name === 'Work From Home') {
                        setStatus('W/H');
                    } else {
                        setStatus('Present');
                        setLocationName(firstEvent.location_name || 'Office');
                    }
                    
                    if (firstEvent.reason) setReason(firstEvent.reason);
                } else {
                    // Reset to defaults
                    setExistingEventIds([]);
                    setCheckInTime('09:00');
                    setCheckOutTime('19:30');
                    setSiteVisits([{in: '09:00', out: '18:00'}]);
                    setSiteOtInTime('19:30');
                    setSiteOtOutTime('21:30');
                    setIncludeBreak(false);
                    setIncludeSiteOt(false);
                    setIncludeSiteVisit(false);
                    
                    const selectedUser = users.find(u => u.id === selectedUserId);
                    const category = selectedUser ? getStaffCategory(selectedUser.roleId) : 'office';
                    setStatus(category === 'office' ? 'Present' : 'Site Visit');
                    setLocationName(category === 'office' ? 'Office' : '');
                    setReason('');
                }
            } catch (err) {
                console.error('Error fetching existing logs:', err);
            } finally {
                setIsLoadingExisting(false);
            }
        };

        fetchExistingLogs();
    }, [selectedUserId, date, isOpen, users, status]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) {
            setToast({ message: 'Please select an employee.', type: 'error' });
            return;
        }
        if (!reason) {
            setToast({ message: 'Please provide a reason or note for this manual entry.', type: 'error' });
            return;
        }

        if (includeBreak) {
            if (breakInTime && breakOutTime) {
                const checkInDate = parseISO(`${date}T${checkInTime}:00+05:30`);
                const breakInDate = parseISO(`${date}T${breakInTime}:00+05:30`);
                const breakOutDate = parseISO(`${date}T${breakOutTime}:00+05:30`);

                if (breakInDate <= checkInDate) {
                    setToast({ message: 'Break in time must be after punch in.', type: 'error' });
                    return;
                }
                if (breakOutDate <= breakInDate) {
                    setToast({ message: 'Break out time must be after break in.', type: 'error' });
                    return;
                }
            }
        }

        // Validate overall session wraps site visits correctly.
        // Pattern: Punch In (gate) ≤ Site In → Site Out ≤ Punch Out (gate)
        if ((status === 'Site Visit' || includeSiteVisit || userCategory !== 'office') && siteVisits.length > 0) {
            const punchIn = checkInTime;
            const punchOut = checkOutTime;

            for (const visit of siteVisits) {
                if (visit.in && punchIn && visit.in < punchIn) {
                    setToast({ message: `Site Check-In (${visit.in}) cannot be earlier than Overall Punch In (${punchIn}). Punch in first, then go to site.`, type: 'error' });
                    return;
                }
                if (visit.out && punchOut && visit.out > punchOut) {
                    setToast({ message: `Site Check-Out (${visit.out}) cannot be later than Overall Punch Out (${punchOut}). Leave site before final punch out.`, type: 'error' });
                    return;
                }
            }
        }

        setIsSubmitting(true);
        setToast(null);

        try {
            const selectedUser = users.find(u => u.id === selectedUserId);
            const timestampBase = date; // YYYY-MM-DD

            // 1. Insert Attendance Events
            const eventsToInsert = [];

            if (status === 'Present' || status === 'W/H' || status === 'Site Visit') {
                // A. Main Attendance Session (Always needed for overall duration)
                // Parse using IST offset so the user-entered local time is preserved correctly
                const mainInDate = parseISO(`${timestampBase}T${checkInTime}:00+05:30`);
                
                eventsToInsert.push({
                    user_id: selectedUserId,
                    timestamp: mainInDate.toISOString(),
                    type: 'punch-in',
                    location_name: status === 'W/H' ? 'Work From Home' : (userCategory === 'office' ? (locationName || 'Office') : (locationName || 'Site Deployment')),
                    work_type: 'office',
                    is_manual: true,
                    created_by: currentUserId,
                    reason: reason
                });

                if (checkOutTime && checkOutTime.trim() !== '') {
                    // If checkOutNextDay is toggled, stamp the punch-out on the following calendar date
                    const checkOutBase = checkOutNextDay
                        ? format(addDays(parseISO(timestampBase), 1), 'yyyy-MM-dd')
                        : timestampBase;
                    const mainOutDate = parseISO(`${checkOutBase}T${checkOutTime}:00+05:30`);
                    eventsToInsert.push({
                        user_id: selectedUserId,
                        timestamp: mainOutDate.toISOString(),
                        type: 'punch-out',
                        location_name: status === 'W/H' ? 'Work From Home' : (userCategory === 'office' ? (locationName || 'Office') : (locationName || 'Site Deployment')),
                        work_type: 'office',
                        is_manual: true,
                        created_by: currentUserId,
                        reason: reason
                    });
                }

                // B. Field/Site Visit Session (For Field Staff or when Site Visit / includeSiteVisit selected)
                if (status === 'Site Visit' || userCategory !== 'office' || includeSiteVisit) {
                    siteVisits.forEach(visit => {
                        if (visit.in && visit.in.trim() !== '') {
                            const siteInDate = parseISO(`${timestampBase}T${visit.in}:00+05:30`);
                            eventsToInsert.push({
                                user_id: selectedUserId,
                                timestamp: siteInDate.toISOString(),
                                type: 'site-in',
                                location_name: locationName || 'Site Location',
                                work_type: 'field',
                                is_manual: true,
                                created_by: currentUserId,
                                reason: reason
                            });
                        }

                        if (visit.out && visit.out.trim() !== '') {
                            const siteOutDate = parseISO(`${timestampBase}T${visit.out}:00+05:30`);
                            eventsToInsert.push({
                                user_id: selectedUserId,
                                timestamp: siteOutDate.toISOString(),
                                type: 'site-out',
                                location_name: locationName || 'Site Location',
                                work_type: 'field',
                                is_manual: true,
                                created_by: currentUserId,
                                reason: reason
                            });
                        }
                    });
                }

                // C. Site Overtime (Optional)
                if (includeSiteOt) {
                    if (siteOtInTime && siteOtInTime.trim() !== '') {
                        const otInDate = parseISO(`${timestampBase}T${siteOtInTime}:00+05:30`);
                        eventsToInsert.push({
                            user_id: selectedUserId,
                            timestamp: otInDate.toISOString(),
                            type: 'site-ot-in',
                            location_name: locationName || 'Site Location',
                            work_type: 'field',
                            is_manual: true,
                            created_by: currentUserId,
                            reason: reason
                        });
                    }

                    if (siteOtOutTime && siteOtOutTime.trim() !== '') {
                        const baseOtOut = parseISO(`${timestampBase}T${siteOtOutTime}:00+05:30`);
                        const isNextDay = siteOtNextDay || (siteOtInTime && siteOtOutTime < siteOtInTime);
                        const otOutDate = isNextDay ? addDays(baseOtOut, 1) : baseOtOut;
                        eventsToInsert.push({
                            user_id: selectedUserId,
                            timestamp: otOutDate.toISOString(),
                            type: 'site-ot-out',
                            location_name: locationName || 'Site Location',
                            work_type: 'field',
                            is_manual: true,
                            created_by: currentUserId,
                            reason: reason
                        });
                    }
                }

                // D. Break Events
                if (includeBreak) {
                    if (breakInTime && breakInTime.trim() !== '') {
                        const breakInDate = parseISO(`${timestampBase}T${breakInTime}:00+05:30`);
                        eventsToInsert.push({
                            user_id: selectedUserId,
                            timestamp: breakInDate.toISOString(),
                            type: 'break-in',
                            location_name: status === 'W/H' ? 'Work From Home' : (locationName || 'Office'),
                            work_type: status === 'Site Visit' ? 'field' : 'office',
                            is_manual: true,
                            created_by: currentUserId,
                            reason: reason
                        });
                    }

                    if (breakOutTime && breakOutTime.trim() !== '') {
                        const breakOutDate = parseISO(`${timestampBase}T${breakOutTime}:00+05:30`);
                        eventsToInsert.push({
                            user_id: selectedUserId,
                            timestamp: breakOutDate.toISOString(),
                            type: 'break-out',
                            location_name: status === 'W/H' ? 'Work From Home' : (locationName || 'Office'),
                            work_type: status === 'Site Visit' ? 'field' : 'office',
                            is_manual: true,
                            created_by: currentUserId,
                            reason: reason
                        });
                    }
                }
            }

            // 0. If existing events exist, delete them first (Correction logic)
            if (existingEventIds.length > 0) {
                const { error: deleteError } = await supabase
                    .from('attendance_events')
                    .delete()
                    .in('id', existingEventIds);

                if (deleteError) throw deleteError;
            }

            if (eventsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('attendance_events')
                    .insert(eventsToInsert);

                if (insertError) throw insertError;
            }

            // 2. Insert Audit Log
            const hasSiteDetails = Boolean(includeSiteVisit || status === 'Site Visit' || userCategory !== 'office');
            const auditLog = {
                action: 'MANUAL_ENTRY_ADDED',
                performed_by: currentUserId,
                target_user_id: selectedUserId,
                details: {
                    date,
                    status,
                    checkIn: (status === 'Present' || status === 'W/H' || status === 'Site Visit') ? checkInTime : 'N/A',
                    checkOut: (status === 'Present' || status === 'W/H' || status === 'Site Visit') ? (checkOutTime || 'N/A') : 'N/A',
                    includeSiteVisit: hasSiteDetails,
                    siteVisits: hasSiteDetails ? siteVisits : [],
                    includeSiteOt,
                    siteOtIn: includeSiteOt ? siteOtInTime : 'N/A',
                    siteOtOut: includeSiteOt ? siteOtOutTime : 'N/A',
                    includeBreak,
                    breakIn: includeBreak ? breakInTime : 'N/A',
                    breakOut: includeBreak ? breakOutTime : 'N/A',
                    locationName: locationName || 'Office',
                    workType: userCategory,
                    reason,
                    userName: selectedUser?.name
                }
            };

            const { error: auditError } = await supabase
                .from('attendance_audit_logs')
                .insert([{
                    ...auditLog,
                    action: existingEventIds.length > 0 ? 'MANUAL_ENTRY_UPDATED' : 'MANUAL_ENTRY_ADDED',
                }]);

            if (auditError) throw auditError;

            // 3. Send Notification to Reporting Manager
            if (selectedUser?.reportingManagerId) {
                try {
                    await api.createNotification({
                        userId: selectedUser.reportingManagerId,
                        message: `Manual attendance correction for ${selectedUser.name} on ${date}`,
                        type: 'info',
                        linkTo: '/attendance/tracker',
                        metadata: {
                            isTeamActivity: true,
                            employeeId: selectedUserId,
                            employeeName: selectedUser.name,
                            date: date,
                            action: existingEventIds.length > 0 ? 'UPDATE' : 'ADD'
                        }
                    });
                } catch (notifErr) {
                    console.error('Failed to send notification to manager:', notifErr);
                    // Don't fail the whole request if only notification fails
                }
            }

            // 4. Mark correction request as made if applicable
            if (correctionRequestId) {
                await api.markCorrectionAsMade(correctionRequestId, currentUserId);
            }

            // Show local success feedback first
            setToast({ message: 'Manual entry saved successfully!', type: 'success' });
            // Small delay ensures Supabase write is visible before parent re-fetches
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 500);
        } catch (err: unknown) {
            console.error('Manual attendance error:', err);
            let msg = 'Failed to save manual entry.';
            if (err && typeof err === 'object') {
                const e = err as { message?: string; details?: string; hint?: string };
                if (e.message) msg = e.message;
                if (e.details) msg += ` (${e.details})`;
                if (e.hint) msg += ` Hint: ${e.hint}`;
            }
            setToast({ message: msg, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-100">
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-slate-50/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-xl">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 leading-tight">Manual Attendance Entry</h2>
                            <p className="text-xs text-gray-500">Add or correct employee attendance records</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-200/60 rounded-full"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body with 2-Column Grid */}
                <div className="p-6 overflow-y-auto custom-scrollbar relative flex-1 bg-slate-50/30">
                    {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
                    {isLoadingExisting && (
                        <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] flex items-center justify-center rounded-xl">
                            <div className="flex flex-col items-center">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                                <p className="text-sm font-semibold text-gray-700">Loading existing logs...</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} id="manual-attendance-form" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* LEFT COLUMN: Core Details & Attendance Session */}
                        <div className="space-y-5">
                            {/* Employee Selection */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
                                        <User className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Employee <span className="text-red-500 ml-0.5">*</span>
                                    </label>
                                    <select
                                        value={selectedUserId}
                                        onChange={(e) => setSelectedUserId(e.target.value)}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-sm font-medium"
                                        required
                                    >
                                        <option value="">Select Employee</option>
                                        {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(user => (
                                            <option key={user.id} value={user.id}>{user.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date and Status Row */}
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
                                            <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Date <span className="text-red-500 ml-0.5">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-sm"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
                                            <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Status <span className="text-red-500 ml-0.5">*</span>
                                        </label>
                                        <select
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value)}
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-sm font-medium"
                                        >
                                            <option value="Present">Present (Office)</option>
                                            <option value="Site Visit">Site Visit (Field)</option>
                                            <option value="W/H">Work From Home</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* 1. Main Attendance Row (First In / Last Out) */}
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center">
                                        <Clock className="w-4 h-4 mr-1.5 text-blue-600" /> Overall Attendance Session
                                    </h3>
                                    {existingEventIds.length > 0 && (
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full uppercase tracking-wider font-bold">
                                            Edit Mode
                                        </span>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700 flex items-center">
                                            First Punch In <span className="text-red-500 ml-0.5">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={checkInTime}
                                            onChange={(e) => setCheckInTime(e.target.value)}
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-sm font-medium"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700 flex items-center justify-between">
                                            <span>Last Punch Out</span>
                                            <label className="flex items-center gap-1.5 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={checkOutNextDay}
                                                    onChange={(e) => setCheckOutNextDay(e.target.checked)}
                                                    className="w-3.5 h-3.5 rounded border-gray-400 text-orange-500 focus:ring-orange-400"
                                                />
                                                <span className="text-xs font-semibold text-orange-600 group-hover:text-orange-700">Next Day</span>
                                            </label>
                                        </label>
                                        <input
                                            type="time"
                                            value={checkOutTime}
                                            onChange={(e) => setCheckOutTime(e.target.value)}
                                            placeholder="Optional"
                                            className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:border-blue-500 transition-all bg-white text-sm font-medium ${checkOutNextDay ? 'border-orange-400 focus:ring-orange-400/20' : 'border-gray-300 focus:ring-blue-500/20'}`}
                                        />
                                        {checkOutNextDay && (
                                            <p className="text-xs text-orange-600 font-medium">
                                                ↳ Punch-out will be stamped on the next calendar day
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Site mode hint: punch in/out are gate times that wrap site visits */}
                                {(status === 'Site Visit' || includeSiteVisit || userCategory !== 'office') && (
                                    <p className="text-[11px] text-blue-600/80 bg-blue-50 border border-blue-100 rounded-md px-2.5 py-1.5 leading-relaxed">
                                        <span className="font-bold">Gate times:</span> Punch In → Site In → Site Out → Punch Out<br />
                                        <span className="text-gray-500">e.g. 09:00 punch in · 09:10 site in · 18:00 site out · 18:10 punch out</span>
                                    </p>
                                )}
                            </div>

                            {/* Reason / Notes */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-2">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
                                    <FileText className="w-3.5 h-3.5 mr-1.5 text-gray-500" /> Reason / Approval Remarks <span className="text-red-500 ml-0.5">*</span>
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g. Manual entry approved by Pradeep sir"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-sm h-20 resize-none font-medium"
                                    required
                                />
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Site Deployments, Lunch Breaks, Overtime */}
                        <div className="space-y-4">
                            {/* 2. Site Deployment Section */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center">
                                        <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Site Deployment Details
                                    </h3>
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            id="includeSiteVisit"
                                            checked={includeSiteVisit || status === 'Site Visit'}
                                            onChange={(e) => setIncludeSiteVisit(e.target.checked)}
                                            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                        />
                                        <span className="text-xs font-semibold text-gray-600">
                                            {(includeSiteVisit || status === 'Site Visit') ? 'Enabled' : 'Add Details'}
                                        </span>
                                    </label>
                                </div>

                                {(includeSiteVisit || status === 'Site Visit' || userCategory !== 'office') && (
                                    <div className="space-y-3 bg-emerald-50/40 p-3 rounded-lg border border-emerald-100">
                                        {siteVisits.map((visit, idx) => (
                                            <div key={idx} className="flex items-end gap-2 p-2.5 bg-white border border-gray-200 rounded-lg shadow-2xs">
                                                <div className="flex-1 space-y-1">
                                                    <label className="text-[11px] font-semibold text-gray-600">
                                                        Site Check In
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={visit.in}
                                                        onChange={(e) => updateSiteVisit(idx, 'in', e.target.value)}
                                                        className="w-full p-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-xs font-medium"
                                                    />
                                                </div>

                                                <div className="flex-1 space-y-1">
                                                    <label className="text-[11px] font-semibold text-gray-600">
                                                        Site Check Out
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={visit.out}
                                                        onChange={(e) => updateSiteVisit(idx, 'out', e.target.value)}
                                                        className="w-full p-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-xs font-medium"
                                                    />
                                                </div>
                                                {siteVisits.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeSiteVisit(idx)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        
                                        <div className="flex items-center justify-between pt-1">
                                            <button
                                                type="button"
                                                onClick={addSiteVisit}
                                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 tracking-wide"
                                            >
                                                + Add Another Visit
                                            </button>
                                        </div>

                                        <div className="space-y-1 pt-2 border-t border-emerald-100">
                                            <label className="text-[11px] font-semibold text-gray-700">Site Name / Location</label>
                                            <input
                                                type="text"
                                                value={locationName}
                                                onChange={(e) => setLocationName(e.target.value)}
                                                placeholder="e.g. Prestige Shantiniketan / Sarjapura Road"
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white text-xs"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 3. Break Selection */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Lunch Break</h3>
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            id="includeBreak"
                                            checked={includeBreak}
                                            onChange={(e) => setIncludeBreak(e.target.checked)}
                                            className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                                        />
                                        <span className="text-xs font-semibold text-gray-600">
                                            {includeBreak ? 'Enabled' : 'Add Break'}
                                        </span>
                                    </label>
                                </div>

                                {includeBreak && (
                                    <div className="grid grid-cols-2 gap-3 bg-amber-50/40 p-3 rounded-lg border border-amber-100">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold text-gray-600">Break In</label>
                                            <input
                                                type="time"
                                                value={breakInTime}
                                                onChange={(e) => setBreakInTime(e.target.value)}
                                                className="w-full p-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500 bg-white text-xs font-medium"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold text-gray-600">Break Out</label>
                                            <input
                                                type="time"
                                                value={breakOutTime}
                                                onChange={(e) => setBreakOutTime(e.target.value)}
                                                className="w-full p-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500 bg-white text-xs font-medium"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4. Site Overtime Selection */}
                            {(status === 'Site Visit' || userCategory !== 'office') && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Site Overtime (OT)</h3>
                                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                id="includeSiteOt"
                                                checked={includeSiteOt}
                                                onChange={(e) => setIncludeSiteOt(e.target.checked)}
                                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                            />
                                            <span className="text-xs font-semibold text-gray-600">
                                                {includeSiteOt ? 'Enabled' : 'Add OT'}
                                            </span>
                                        </label>
                                    </div>

                                    {includeSiteOt && (
                                        <div className="grid grid-cols-2 gap-3 bg-purple-50/40 p-3 rounded-lg border border-purple-100">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-semibold text-gray-600">OT Start</label>
                                                <input
                                                    type="time"
                                                    value={siteOtInTime}
                                                    onChange={(e) => setSiteOtInTime(e.target.value)}
                                                    className="w-full p-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 bg-white text-xs font-medium"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-semibold text-gray-600 flex items-center justify-between">
                                                    <span>OT End</span>
                                                    <label className="flex items-center gap-1 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={siteOtNextDay}
                                                            onChange={(e) => setSiteOtNextDay(e.target.checked)}
                                                            className="w-3 h-3 rounded border-gray-400 text-purple-600 focus:ring-purple-500"
                                                        />
                                                        <span className="text-[10px] font-semibold text-purple-600 group-hover:text-purple-700">Next Day</span>
                                                    </label>
                                                </label>
                                                <input
                                                    type="time"
                                                    value={siteOtOutTime}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setSiteOtOutTime(val);
                                                        if (siteOtInTime && val && val < siteOtInTime) {
                                                            setSiteOtNextDay(true);
                                                        }
                                                    }}
                                                    className="w-full p-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 bg-white text-xs font-medium"
                                                />
                                                {siteOtNextDay && (
                                                    <p className="text-[10px] text-purple-600 font-medium mt-0.5">
                                                        ↳ Overtime ends on next calendar day
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-slate-50/80 flex justify-end items-center gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-xs"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="manual-attendance-form"
                        disabled={isSubmitting}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Add Punch
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManualAttendanceModal;
