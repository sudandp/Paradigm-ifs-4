import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Loader2, Calendar as CalendarIcon, User, FileText, Info, Clock } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { format, differenceInCalendarDays, isSameDay } from 'date-fns';
import { User as UserType, LeaveType, LeaveBalance } from '../../types';
import { api } from '../../services/api';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import Select from '../ui/Select';
import { useAuthStore } from '../../store/authStore';
import { isAdmin } from '../../utils/auth';

interface AssignLeaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    users: UserType[];
    currentUserId: string;
}

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
    
    // Correction/Permission specific state
    const [correctionStatus, setCorrectionStatus] = useState<'Present' | 'Site Visit' | 'W/H'>('Present');
    const [locationName, setLocationName] = useState<string>('');
    const [punchIn, setPunchIn] = useState<string>('09:00');
    const [punchOut, setPunchOut] = useState<string>('18:30');
    const [includeSite, setIncludeSite] = useState<boolean>(false);
    const [siteVisits, setSiteVisits] = useState<{in: string, out: string}[]>([{in: '10:00', out: '17:00'}]);

    const addSiteVisit = () => setSiteVisits([...siteVisits, {in: '10:00', out: '17:00'}]);
    const removeSiteVisit = (idx: number) => setSiteVisits(siteVisits.filter((_, i) => i !== idx));
    const updateSiteVisit = (idx: number, field: 'in'|'out', value: string) => {
        const newVisits = [...siteVisits];
        newVisits[idx][field] = value;
        setSiteVisits(newVisits);
    };
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    const [balance, setBalance] = useState<LeaveBalance | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId), [users, selectedUserId]);
    const isFemale = ['female', 'ladies'].includes((selectedUser?.gender || '').toLowerCase());

    const isSingleDay = useMemo(() => {
        if (!startDate || !endDate) return false;
        return isSameDay(new Date(startDate.replace(/-/g, '/')), new Date(endDate.replace(/-/g, '/')));
    }, [startDate, endDate]);

    const showHalfDayOption = isSingleDay;

    const duration = useMemo(() => {
        if (!startDate || !endDate) return 0;
        if (showHalfDayOption && dayOption === 'half') return 0.5;
        const start = new Date(startDate.replace(/-/g, '/'));
        const end = new Date(endDate.replace(/-/g, '/'));
        return differenceInCalendarDays(end, start) + 1;
    }, [startDate, endDate, showHalfDayOption, dayOption]);

    useEffect(() => {
        if (isOpen) {
            setSelectedUserId('');
            setLeaveType('Earned');
            setStartDate(format(new Date(), 'yyyy-MM-dd'));
            setEndDate(format(new Date(), 'yyyy-MM-dd'));
            setDayOption('full');
            setReason('');
            setCorrectionStatus('Present');
            setLocationName('');
            setPunchIn('09:00');
            setPunchOut('18:30');
            setIncludeSite(false);
            setSiteVisits([{in: '10:00', out: '17:00'}]);
            setBalance(null);
            setToast(null);
        }
    }, [isOpen]);

    useEffect(() => {
        const fetchBalance = async () => {
            if (!selectedUserId || !isOpen) {
                setBalance(null);
                return;
            }
            setIsLoadingBalance(true);
            try {
                const b = await api.getLeaveBalancesForUser(selectedUserId);
                setBalance(b);
            } catch (err) {
                console.error('Error fetching balance:', err);
            } finally {
                setIsLoadingBalance(false);
            }
        };
        fetchBalance();
    }, [selectedUserId, isOpen]);

    useEffect(() => {
        const fetchExistingLogs = async () => {
            if (!isOpen || !selectedUserId || !isSingleDay || !['Correction', 'Permission'].includes(leaveType)) return;

            try {
                const startDateTime = `${startDate}T00:00:00Z`;
                const endDateTime = `${startDate}T23:59:59Z`;

                const { data, error: fetchError } = await supabase
                    .from('attendance_events')
                    .select('*')
                    .eq('user_id', selectedUserId)
                    .gte('timestamp', startDateTime)
                    .lte('timestamp', endDateTime);

                if (fetchError) throw fetchError;

                if (data && data.length > 0) {
                    const punchInEvent = data.find(e => e.type === 'punch-in' && e.work_type === 'office');
                    const punchOutEvent = data.find(e => e.type === 'punch-out' && e.work_type === 'office');
                    
                    const fieldIns = data.filter(e => e.type === 'punch-in' && e.work_type === 'field').sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    const fieldOuts = data.filter(e => e.type === 'punch-out' && e.work_type === 'field').sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                    if (punchInEvent) setPunchIn(format(new Date(punchInEvent.timestamp), 'HH:mm'));
                    if (punchOutEvent) setPunchOut(format(new Date(punchOutEvent.timestamp), 'HH:mm'));

                    const firstEvent = data[0];
                    if (firstEvent.location_name === 'Work From Home') {
                        setCorrectionStatus('W/H');
                    } else if (fieldIns.length > 0 || fieldOuts.length > 0 || data.some(e => e.work_type === 'field')) {
                        setCorrectionStatus('Site Visit');
                        setLocationName(firstEvent.location_name || '');
                    } else {
                        setCorrectionStatus('Present');
                        setLocationName(firstEvent.location_name || '');
                    }

                    if (fieldIns.length > 0 || fieldOuts.length > 0) {
                        setIncludeSite(true);
                        const visits = [];
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
                        setSiteVisits([{in: '10:00', out: '17:00'}]);
                    }
                } else {
                    // Reset to defaults if no records found
                    setPunchIn('09:00');
                    setPunchOut('18:30');
                    setCorrectionStatus('Present');
                    setLocationName('');
                    setIncludeSite(false);
                    setSiteVisits([{in: '10:00', out: '17:00'}]);
                }
            } catch (err) {
                console.error('Error fetching existing logs for correction:', err);
            }
        };

        fetchExistingLogs();
    }, [isOpen, selectedUserId, isSingleDay, startDate, leaveType]);

    const availableBalance = useMemo(() => {
        if (!balance || !leaveType) return 0;
        
        // Map leaveType to LeaveBalance keys
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) {
            setToast({ message: 'Please select an employee.', type: 'error' });
            return;
        }
        if (!reason || reason.length < 10) {
            setToast({ message: 'Please provide a detailed reason (at least 10 characters).', type: 'error' });
            return;
        }
        if (new Date(endDate.replace(/-/g, '/')) < new Date(startDate.replace(/-/g, '/'))) {
            setToast({ message: 'End date must be on or after start date.', type: 'error' });
            return;
        }

        // Balance Check
        // Allow Loss of Pay, WFH, Correction, Permission or if balance is sufficient
        if (!['Loss of Pay', 'WFH', 'Correction', 'Permission'].includes(leaveType) && availableBalance < duration) {
            setToast({ 
                message: `Insufficient ${leaveType} balance. Available: ${availableBalance} days, requested: ${duration} days.`, 
                type: 'error' 
            });
            return;
        }

        setIsSubmitting(true);
        setToast(null);

        try {
            await api.submitLeaveRequest({
                userId: selectedUserId,
                userName: selectedUser?.name || 'Unknown',
                leaveType,
                startDate,
                endDate,
                reason,
                dayOption: showHalfDayOption ? dayOption : 'full',
                correctionDetails: ['Correction', 'Permission'].includes(leaveType) ? {
                    status: correctionStatus,
                    locationName,
                    punchIn,
                    punchOut,
                    includeSite,
                    includeBreak: false,
                    siteVisits
                } : undefined
            });

            
            // Record Audit Log
            try {
                await supabase.from('attendance_audit_logs').insert([{
                    action: 'LEAVE_ASSIGNED',
                    performed_by: currentUserId,
                    target_user_id: selectedUserId,
                    details: {
                        leaveType,
                        startDate,
                        endDate,
                        duration,
                        reason,
                        userName: selectedUser?.name,
                        source: 'Manual Assignment'
                    }
                }]);
            } catch (auditErr) {
                console.error('Failed to record audit log:', auditErr);
                // Don't fail the whole request
            }

            setToast({ message: 'Leave assigned successfully!', type: 'success' });
            onSuccess();
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err: any) {
            console.error('Assign leave error:', err);
            setToast({ message: err.message || 'Failed to assign leave.', type: 'error' });
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
                        <h2 className="text-xl font-bold text-gray-800">Assign Manual Leave</h2>
                        <p className="text-xs text-gray-500 mt-1">Assign leave on behalf of an employee</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar relative">
                    {toast && (
                        <div className="mb-4">
                            <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
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
                                    <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
                                ))}
                            </select>
                        </div>

                        {/* Leave Type */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700 flex items-center">
                                <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Leave Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={leaveType}
                                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/30 text-sm"
                            >
                                <option value="Earned">Earned</option>
                                <option value="Sick">Sick</option>
                                {!isFemale && <option value="Floating">3rd Saturday Leave</option>}
                                {isFemale && <option value="Pink Leave">Pink Leave</option>}
                                <option value="Comp Off">Comp Off</option>
                                <option value="Loss of Pay">Loss of Pay</option>
                                {isFemale && <option value="Maternity">Maternity</option>}
                                {isFemale && <option value="Child Care">Child Care</option>}
                                <option value="WFH">Work From Home (WFH)</option>
                                <option value="Correction">Correction (RC)</option>
                                <option value="Permission">Permission (PC)</option>
                            </select>
                        </div>

                        {/* Date Range */}
                        <div className={['Correction', 'Permission'].includes(leaveType) ? "space-y-1.5" : "grid grid-cols-2 gap-4"}>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700 flex items-center">
                                    <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> {['Correction', 'Permission'].includes(leaveType) ? 'Date' : 'Start Date'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        if (['Correction', 'Permission'].includes(leaveType)) {
                                            setEndDate(e.target.value);
                                        }
                                    }}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/30 text-sm"
                                    required
                                />
                            </div>

                            {!['Correction', 'Permission'].includes(leaveType) && (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700 flex items-center">
                                        <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> End Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/30 text-sm"
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        {/* Half Day Option */}
                        {showHalfDayOption && !['Correction', 'Permission'].includes(leaveType) && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Day Option</label>
                                <select
                                    value={dayOption}
                                    onChange={(e) => setDayOption(e.target.value as 'full' | 'half')}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/30 text-sm"
                                >
                                    <option value="full">Full Day</option>
                                    <option value="half">Half Day</option>
                                </select>
                            </div>
                        )}

                        {/* Balance Info */}
                        {isCurrentUserAdmin && selectedUserId && !['Correction', 'Permission'].includes(leaveType) && (
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                                <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                                <div className="text-sm text-blue-800">
                                    {isLoadingBalance ? (
                                        <p className="flex items-center gap-2">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Checking balance...
                                        </p>
                                    ) : (
                                        <div className="space-y-1">
                                            <p className="font-semibold">Current Balance: {availableBalance} days</p>
                                            <p className="text-xs text-blue-600">Requesting: {duration} days</p>
                                            {!['Loss of Pay', 'WFH', 'Correction', 'Permission'].includes(leaveType) && availableBalance < duration && (
                                                <p className="text-red-600 font-medium text-xs mt-1">Warning: Insufficient balance</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}



                        {/* Correction / Permission Fields */}
                        {['Correction', 'Permission'].includes(leaveType) && (
                            <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700">Status</label>
                                        <select
                                            value={correctionStatus}
                                            onChange={(e) => setCorrectionStatus(e.target.value as any)}
                                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                        >
                                            <option value="Present">Present (Office)</option>
                                            <option value="Site Visit">Site Visit (Field)</option>
                                            <option value="W/H">Work From Home</option>
                                        </select>
                                    </div>
                                    {(correctionStatus === 'Present' || correctionStatus === 'Site Visit') && (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-700">Location Name</label>
                                            <input
                                                type="text"
                                                value={locationName}
                                                onChange={(e) => setLocationName(e.target.value)}
                                                placeholder={correctionStatus === 'Site Visit' ? "e.g. Client Site" : "e.g. Office"}
                                                className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5 text-green-500" /> Punch In
                                        </label>
                                        <input
                                            type="time"
                                            value={punchIn}
                                            onChange={(e) => setPunchIn(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5 text-red-500" /> Punch Out
                                        </label>
                                        <input
                                            type="time"
                                            value={punchOut}
                                            onChange={(e) => setPunchOut(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="adminIncludeSite"
                                            checked={includeSite}
                                            onChange={(e) => setIncludeSite(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <label htmlFor="adminIncludeSite" className="text-sm font-medium text-gray-700">
                                            Include Site Visit?
                                        </label>
                                    </div>

                                    {includeSite && (
                                        <div className="space-y-3 mt-2">
                                            {siteVisits.map((visit, idx) => (
                                                <div key={idx} className="flex items-end gap-3 p-3 bg-white border border-gray-200 rounded-md">
                                                    <div className="flex-1 space-y-1">
                                                        <label className="text-xs font-semibold text-gray-500">Site In</label>
                                                        <input
                                                            type="time"
                                                            value={visit.in}
                                                            onChange={(e) => updateSiteVisit(idx, 'in', e.target.value)}
                                                            className="w-full p-1.5 border border-gray-300 rounded text-sm"
                                                        />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <label className="text-xs font-semibold text-gray-500">Site Out</label>
                                                        <input
                                                            type="time"
                                                            value={visit.out}
                                                            onChange={(e) => updateSiteVisit(idx, 'out', e.target.value)}
                                                            className="w-full p-1.5 border border-gray-300 rounded text-sm"
                                                        />
                                                    </div>
                                                    {siteVisits.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeSiteVisit(idx)}
                                                            className="p-1.5 mb-0.5 text-red-500 hover:bg-red-50 rounded"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={addSiteVisit}
                                                className="text-xs font-medium text-blue-600 hover:text-blue-800"
                                            >
                                                + Add Another Site Visit
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Reason */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">Reason / Notes <span className="text-red-500">*</span></label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Please provide details about this manual assignment..."
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/30 text-sm h-24 resize-none"
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
                        disabled={isSubmitting || (!!selectedUserId && !isLoadingBalance && availableBalance < duration && !['Loss of Pay', 'WFH', 'Correction', 'Permission'].includes(leaveType))}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Assign Leave
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssignLeaveModal;
