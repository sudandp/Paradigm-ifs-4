import React from 'react';
import { Clock, User } from 'lucide-react';

interface PendingLeavesPanelProps {
    leaves: any[];
    /** All site users — used to resolve user name from userId */
    siteUsers: any[];
}

const PendingLeavesPanel: React.FC<PendingLeavesPanelProps> = ({ leaves, siteUsers }) => {
    if (leaves.length === 0) return null;

    const getUserName = (userId: string) => {
        const u = siteUsers.find(su => su.id === userId);
        return u?.name || 'Unknown';
    };

    const formatStatus = (status: string) => {
        switch (status) {
            case 'pending_manager_approval': return 'Awaiting Manager';
            case 'pending_hr_confirmation': return 'Awaiting HR';
            default: return status;
        }
    };

    return (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-600" />
                Pending Leave Requests
                <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">{leaves.length}</span>
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
                {leaves.slice(0, 10).map((leave, i) => (
                    <div
                        key={leave.id || i}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-cyan-200 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-cyan-100 rounded-lg p-1.5">
                                <User className="h-3.5 w-3.5 text-cyan-700" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-700">{getUserName(leave.userId)}</p>
                                <p className="text-xs text-slate-400">
                                    {leave.leaveType || leave.leave_type || 'Leave'} • {leave.startDate || leave.start_date || '—'} → {leave.endDate || leave.end_date || '—'}
                                </p>
                            </div>
                        </div>
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                            {formatStatus(leave.status)}
                        </span>
                    </div>
                ))}
                {leaves.length > 10 && (
                    <p className="text-xs text-slate-400 text-center pt-2">
                        +{leaves.length - 10} more pending...
                    </p>
                )}
            </div>
        </div>
    );
};

export default PendingLeavesPanel;
