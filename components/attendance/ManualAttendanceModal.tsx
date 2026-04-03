import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Calendar as CalendarIcon, Clock, User, FileText } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { format } from 'date-fns';
import { User as UserType } from '../../types';
import { api } from '../../services/api';
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
    const [checkOutTime, setCheckOutTime] = useState<string>('18:00');
    const [locationName, setLocationName] = useState<string>('Office');
    const [reason, setReason] = useState<string>('');
    const [breakInTime, setBreakInTime] = useState<string>('13:00');
    const [breakOutTime, setBreakOutTime] = useState<string>('14:00');
    const [includeBreak, setIncludeBreak] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingExisting, setIsLoadingExisting] = useState(false);
    const [existingEventIds, setExistingEventIds] = useState<string[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset form
            setSelectedUserId('');
            setDate(format(new Date(), 'yyyy-MM-dd'));
            setStatus('Present');
            setCheckInTime('09:00');
            setCheckOutTime('18:00');
            setBreakInTime('13:00');
            setBreakOutTime('14:00');
            setIncludeBreak(false);
            setLocationName('Office');
            setReason('');
            setExistingEventIds([]);
            setIsLoadingExisting(false);
            setToast(null);

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
    }, [isOpen, correctionRequestId]);

    useEffect(() => {
        const fetchExistingLogs = async () => {
            if (!selectedUserId || !date || !isOpen) return;

            setIsLoadingExisting(true);
            try {
                const startDate = `${date}T00:00:00Z`;
                const endDate = `${date}T23:59:59Z`;

                const { data, error: fetchError } = await supabase
                    .from('attendance_events')
                    .select('*')
                    .eq('user_id', selectedUserId)
                    .gte('timestamp', startDate)
                    .lte('timestamp', endDate);

                if (fetchError) throw fetchError;

                if (data && data.length > 0) {
                    setExistingEventIds(data.map(e => e.id));
                    
                    // Find punch-in and punch-out
                    const punchIn = data.find(e => e.type === 'punch-in' || e.type === 'check-in');
                    const punchOut = data.find(e => e.type === 'punch-out' || e.type === 'check-out');
                    const breakIn = data.find(e => e.type === 'break-in');
                    const breakOut = data.find(e => e.type === 'break-out');

                    if (punchIn) setCheckInTime(format(new Date(punchIn.timestamp), 'HH:mm'));
                    if (punchOut) setCheckOutTime(format(new Date(punchOut.timestamp), 'HH:mm'));
                    
                    if (breakIn || breakOut) {
                        setIncludeBreak(true);
                        if (breakIn) setBreakInTime(format(new Date(breakIn.timestamp), 'HH:mm'));
                        if (breakOut) setBreakOutTime(format(new Date(breakOut.timestamp), 'HH:mm'));
                    } else {
                        setIncludeBreak(false);
                    }

                    // Set location and status from any event
                    const firstEvent = data[0];
                    const hasFieldEvent = data.some(e => e.work_type === 'field');

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
                    // Reset to defaults if no logs found for this user/date
                    setExistingEventIds([]);
                    setCheckInTime('09:00');
                    setCheckOutTime('18:00');
                    setBreakInTime('13:00');
                    setBreakOutTime('14:00');
                    setIncludeBreak(false);
                    setStatus('Present');
                    setLocationName('Office');
                    setReason('');
                }
            } catch (err) {
                console.error('Error fetching existing logs:', err);
            } finally {
                setIsLoadingExisting(false);
            }
        };

        fetchExistingLogs();
    }, [selectedUserId, date, isOpen]);

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
            if (!breakInTime || !breakOutTime) {
                setToast({ message: 'Please provide both break in and break out times.', type: 'error' });
                return;
            }
            
            const checkInDate = new Date(`${date}T${checkInTime}:00`);
            const checkOutDate = new Date(`${date}T${checkOutTime}:00`);
            const breakInDate = new Date(`${date}T${breakInTime}:00`);
            const breakOutDate = new Date(`${date}T${breakOutTime}:00`);

            if (breakInDate <= checkInDate || breakInDate >= checkOutDate) {
                setToast({ message: 'Break in time must be between punch in and punch out.', type: 'error' });
                return;
            }
            if (breakOutDate <= breakInDate || breakOutDate >= checkOutDate) {
                setToast({ message: 'Break out time must be after break in and before punch out.', type: 'error' });
                return;
            }
        }

        setIsSubmitting(true);
        setToast(null);

        try {
            const selectedUser = users.find(u => u.id === selectedUserId);
            const timestampBase = date; // YYYY-MM-DD

            // 1. Insert Attendance Events
            const eventsToInsert = [];

            // Check In
            if (status === 'Present' || status === 'W/H' || status === 'Site Visit') {
                const checkInDate = new Date(`${timestampBase}T${checkInTime}:00`);
                eventsToInsert.push({
                    user_id: selectedUserId,
                    timestamp: checkInDate.toISOString(),
                    type: 'punch-in',
                    location_name: status === 'W/H' ? 'Work From Home' : locationName,
                    work_type: status === 'Site Visit' ? 'field' : 'office',
                    is_manual: true,
                    created_by: currentUserId,
                    reason: reason
                });

                // Check Out
                const checkOutDate = new Date(`${timestampBase}T${checkOutTime}:00`);
                eventsToInsert.push({
                    user_id: selectedUserId,
                    timestamp: checkOutDate.toISOString(),
                    type: 'punch-out',
                    location_name: status === 'W/H' ? 'Work From Home' : locationName,
                    work_type: status === 'Site Visit' ? 'field' : 'office',
                    is_manual: true,
                    created_by: currentUserId,
                    reason: reason
                });

                // Add Break Events if selected
                if (includeBreak) {
                    const breakInDate = new Date(`${timestampBase}T${breakInTime}:00`);
                    const breakOutDate = new Date(`${timestampBase}T${breakOutTime}:00`);
                    
                    eventsToInsert.push({
                        user_id: selectedUserId,
                        timestamp: breakInDate.toISOString(),
                        type: 'break-in',
                        location_name: status === 'W/H' ? 'Work From Home' : locationName,
                        work_type: status === 'Site Visit' ? 'field' : 'office',
                        is_manual: true,
                        created_by: currentUserId,
                        reason: reason
                    });

                    eventsToInsert.push({
                        user_id: selectedUserId,
                        timestamp: breakOutDate.toISOString(),
                        type: 'break-out',
                        location_name: status === 'W/H' ? 'Work From Home' : locationName,
                        work_type: status === 'Site Visit' ? 'field' : 'office',
                        is_manual: true,
                        created_by: currentUserId,
                        reason: reason
                    });
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
            const auditLog = {
                action: 'MANUAL_ENTRY_ADDED',
                performed_by: currentUserId,
                target_user_id: selectedUserId,
                details: {
                    date,
                    status,
                    checkIn: (status === 'Present' || status === 'W/H' || status === 'Site Visit') ? checkInTime : 'N/A',
                    checkOut: (status === 'Present' || status === 'W/H' || status === 'Site Visit') ? checkOutTime : 'N/A',
                    includeBreak,
                    breakIn: includeBreak ? breakInTime : 'N/A',
                    breakOut: includeBreak ? breakOutTime : 'N/A',
                    workType: status === 'Site Visit' ? 'field' : 'office',
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

            onSuccess();
            // Show local success before closing to give immediate feedback
            setToast({ message: 'Manual entry saved successfully!', type: 'success' });
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err: any) {
            console.error('Manual attendance error:', err);
            let msg = 'Failed to save manual entry.';
            if (err.message) msg = err.message;
            if (err.details) msg += ` (${err.details})`;
            if (err.hint) msg += ` Hint: ${err.hint}`;
            setToast({ message: msg, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Manual Attendance Entry</h2>
                        <p className="text-xs text-gray-500 mt-1">Add missing attendance records</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar relative">
                    {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
                    {isLoadingExisting && (
                        <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
                            <div className="flex flex-col items-center">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                                <p className="text-sm font-medium text-gray-600">Loading existing logs...</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Employee Selection */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700 flex items-center">
                                <User className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Employee <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/30 text-sm"
                                required
                            >
                                <option value="">Select Employee</option>
                                {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(user => (
                                    <option key={user.id} value={user.id}>{user.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date and Status Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700 flex items-center">
                                    <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/30 text-sm"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700 flex items-center">
                                    <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Status <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/30 text-sm"
                                >
                                    <option value="Present">Present (Office)</option>
                                    <option value="Site Visit">Site Visit (Field)</option>
                                    <option value="W/H">Work From Home</option>
                                </select>
                            </div>
                        </div>

                        {/* Time Row */}
                        <div className="grid grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700 flex items-center">
                                    <Clock className="w-3.5 h-3.5 mr-1.5 text-green-600" /> {status === 'Site Visit' ? 'Site Check In' : 'Punch In'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="time"
                                    value={checkInTime}
                                    onChange={(e) => setCheckInTime(e.target.value)}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-sm"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700 flex items-center">
                                    <Clock className="w-3.5 h-3.5 mr-1.5 text-red-600" /> {status === 'Site Visit' ? 'Site Check Out' : 'Punch Out'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="time"
                                    value={checkOutTime}
                                    onChange={(e) => setCheckOutTime(e.target.value)}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-sm"
                                    required
                                />
                            </div>
                        </div>

                        {/* Break Selection */}
                        <div className="space-y-4 pt-2 border-t border-gray-100">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="includeBreak"
                                    checked={includeBreak}
                                    onChange={(e) => setIncludeBreak(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="includeBreak" className="ml-2 text-sm font-medium text-gray-700">
                                    Include Lunch Break?
                                </label>
                            </div>

                            {includeBreak && (
                                <div className="grid grid-cols-2 gap-4 bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-gray-700 flex items-center">
                                            <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Break In <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={breakInTime}
                                            onChange={(e) => setBreakInTime(e.target.value)}
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-sm"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-gray-700 flex items-center">
                                            <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Break Out <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={breakOutTime}
                                            onChange={(e) => setBreakOutTime(e.target.value)}
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-sm"
                                            required
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Location (if Present or Site Visit) */}
                        {(status === 'Present' || status === 'Site Visit') && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">{status === 'Site Visit' ? 'Site Name' : 'Location Name'}</label>
                                <input
                                    type="text"
                                    value={locationName}
                                    onChange={(e) => setLocationName(e.target.value)}
                                    placeholder={status === 'Site Visit' ? "e.g. Prestige Shantiniketan, Brigade Tech Park" : "e.g. Head Office, Client Site"}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/30 text-sm"
                                />
                            </div>
                        )}

                        {/* Reason / Notes */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">Reason / Notes <span className="text-red-500">*</span></label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Why is this being added manually? e.g. 'Forgot to punch in', 'Biometric issue'"
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/30 text-sm h-20 resize-none"
                                required
                            />
                        </div>

                    </form>
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
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
