import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Loader2, Calendar as CalendarIcon, User, FileText, Info } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { format, differenceInCalendarDays, isSameDay } from 'date-fns';
import { User as UserType, LeaveType, LeaveBalance } from '../../types';
import { api } from '../../services/api';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import Select from '../ui/Select';

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
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [leaveType, setLeaveType] = useState<LeaveType>('Earned');
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [dayOption, setDayOption] = useState<'full' | 'half'>('full');
    const [reason, setReason] = useState<string>('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    const [balance, setBalance] = useState<LeaveBalance | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId), [users, selectedUserId]);
    const isFemale = selectedUser?.gender?.toLowerCase() === 'female';

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
        // Allow Loss of Pay or if balance is sufficient
        if (leaveType !== 'Loss of Pay' && availableBalance < duration) {
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
                dayOption: showHalfDayOption ? dayOption : 'full'
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
                                <option value="Floating">3rd Saturday Leave</option>
                                <option value="Pink Leave">Pink Leave</option>
                                <option value="Comp Off">Comp Off</option>
                                <option value="Loss of Pay">Loss of Pay</option>
                                <option value="Maternity">Maternity</option>
                                <option value="Child Care">Child Care</option>
                            </select>
                        </div>

                        {/* Date Range */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700 flex items-center">
                                    <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Start Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/30 text-sm"
                                    required
                                />
                            </div>

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
                        </div>

                        {/* Half Day Option */}
                        {showHalfDayOption && (
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
                        {selectedUserId && (
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
                                            {availableBalance < duration && leaveType !== 'Loss of Pay' && (
                                                <p className="text-red-600 font-medium text-xs mt-1">Warning: Insufficient balance</p>
                                            )}
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
                        disabled={isSubmitting || (!!selectedUserId && !isLoadingBalance && availableBalance < duration && leaveType !== 'Loss of Pay')}
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
