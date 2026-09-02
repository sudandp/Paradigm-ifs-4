import React, { useState, useEffect, useMemo } from 'react';
import type { User, Role } from '../../types';
import { 
    Search, 
    CheckCircle2, 
    AlertTriangle, 
    ShieldCheck, 
    Building2, 
    Clock, 
    Sparkles, 
    UserCheck, 
    Edit3 
} from 'lucide-react';
import Select from '../ui/Select';
import Button from '../ui/Button';

interface WorkflowPathTraceProps {
    users: (User & { managerName?: string; manager2Name?: string; manager3Name?: string })[];
    allRoles: Role[];
    finalConfirmationRole: string;
    initialSelectedUserId?: string;
    onManagerChange?: (userId: string, managerId: string, slot: 1 | 2 | 3) => void;
    onSave?: () => void;
}

const getRoleBadgeStyle = (role: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('admin') || r.includes('management') || r.includes('director')) {
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/90';
    }
    if (r.includes('site_manager') || r.includes('manager') || r.includes('operation')) {
        return 'bg-amber-50 text-amber-800 border-amber-200/90';
    }
    if (r.includes('hr') || r.includes('recruitment')) {
        return 'bg-blue-50 text-blue-800 border-blue-200/90';
    }
    if (r.includes('field') || r.includes('staff')) {
        return 'bg-sky-50 text-sky-800 border-sky-200/90';
    }
    if (r.includes('electrician') || r.includes('plumber') || r.includes('technician') || r.includes('security') || r.includes('hk')) {
        return 'bg-teal-50 text-teal-800 border-teal-200/90';
    }
    if (r.includes('finance') || r.includes('account')) {
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/90';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200/90';
};

const WorkflowPathTrace: React.FC<WorkflowPathTraceProps> = ({
    users,
    allRoles,
    finalConfirmationRole,
    initialSelectedUserId,
    onManagerChange,
    onSave
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string>(initialSelectedUserId || users[0]?.id || '');

    useEffect(() => {
        if (initialSelectedUserId) {
            setSelectedUserId(initialSelectedUserId);
        }
    }, [initialSelectedUserId]);
    const [isEditing, setIsEditing] = useState(false);

    const getRoleDisplayName = (roleId: string = '') => {
        const found = allRoles.find(r => r.id === roleId || r.id.toLowerCase() === roleId.toLowerCase());
        if (found?.displayName) return found.displayName;
        return roleId ? roleId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Staff';
    };

    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return users;
        const q = searchQuery.toLowerCase().trim();
        return users.filter(u => 
            (u.name || '').toLowerCase().includes(q) ||
            (u.role || '').toLowerCase().includes(q) ||
            (u.location || '').toLowerCase().includes(q)
        );
    }, [users, searchQuery]);

    const selectedUser = useMemo(() => {
        return users.find(u => u.id === selectedUserId) || users[0];
    }, [users, selectedUserId]);

    const manager1 = useMemo(() => {
        if (!selectedUser?.reportingManagerId) return null;
        return users.find(u => u.id === selectedUser.reportingManagerId);
    }, [users, selectedUser]);

    const manager2 = useMemo(() => {
        if (!selectedUser?.reportingManager2Id) return null;
        return users.find(u => u.id === selectedUser.reportingManager2Id);
    }, [users, selectedUser]);

    const manager3 = useMemo(() => {
        if (!selectedUser?.reportingManager3Id) return null;
        return users.find(u => u.id === selectedUser.reportingManager3Id);
    }, [users, selectedUser]);

    const finalApproverName = useMemo(() => {
        if (finalConfirmationRole === 'reporting_manager') {
            return manager3?.name || manager2?.name || manager1?.name || 'Direct Reporting Manager';
        }
        const roleObj = allRoles.find(r => r.id === finalConfirmationRole);
        return roleObj?.displayName || finalConfirmationRole.toUpperCase();
    }, [finalConfirmationRole, allRoles, manager1, manager2, manager3]);

    const hasManager = !!selectedUser?.reportingManagerId;

    return (
        <div className="space-y-6">
            {/* Top Selector Card */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h4 className="text-base font-bold text-primary-text flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            Approval Flow Simulator & Route Inspector
                        </h4>
                        <p className="text-xs text-muted mt-0.5">
                            Select any employee to simulate their step-by-step leave submission and manager escalation chain.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search employee..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-page/70 border border-border rounded-lg text-xs text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                        </div>
                        <select
                            value={selectedUserId}
                            onChange={e => setSelectedUserId(e.target.value)}
                            className="px-3 py-2 bg-page border border-border rounded-lg text-xs font-semibold text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary max-w-[220px]"
                        >
                            {filteredUsers.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.name} ({getRoleDisplayName(u.role)})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {selectedUser && (
                <div className="space-y-6">
                    {/* Pipeline Visualizer */}
                    <div className="bg-gradient-to-br from-page to-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/60">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-lg flex items-center justify-center shadow-inner">
                                    {(selectedUser.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-primary-text">{selectedUser.name}</h3>
                                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${getRoleBadgeStyle(selectedUser.role)}`}>
                                            {getRoleDisplayName(selectedUser.role)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted flex items-center gap-2 mt-0.5">
                                        {selectedUser.location && <span>📍 {selectedUser.location}</span>}
                                        {selectedUser.email && <span>✉️ {selectedUser.email}</span>}
                                        {selectedUser.phone && <span>📞 {selectedUser.phone}</span>}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsEditing(!isEditing)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg border border-primary/20 transition-colors"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                {isEditing ? 'Done Editing' : 'Edit Chain'}
                            </button>
                        </div>

                        {/* Visual Step-by-Step Flow */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                            {/* STEP 1: L1 Manager */}
                            <div className={`p-4 rounded-xl border transition-all ${
                                hasManager 
                                    ? 'bg-card border-border shadow-sm' 
                                    : 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20'
                            }`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black">1</span>
                                        Level 1 (L1) Approver
                                    </span>
                                    {hasManager ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Missing
                                        </span>
                                    )}
                                </div>

                                {manager1 ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-amber-200">
                                                {(manager1.name || 'M').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-primary-text truncate">{manager1.name}</p>
                                                <p className="text-[11px] text-muted truncate">{getRoleDisplayName(manager1.role)}</p>
                                            </div>
                                        </div>
                                        {manager1.location && (
                                            <p className="text-[11px] text-muted">📍 {manager1.location}</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="py-2">
                                        <p className="text-xs font-semibold text-amber-800">No Reporting Manager Assigned</p>
                                        <p className="text-[11px] text-amber-700/80 mt-0.5">
                                            Requests will bypass L1 or require admin intervention.
                                        </p>
                                    </div>
                                )}

                                {isEditing && onManagerChange && (
                                    <div className="mt-3 pt-3 border-t border-border/60">
                                        <label className="text-[11px] font-semibold text-muted block mb-1">Change L1:</label>
                                        <Select
                                            label=""
                                            id={`trace-l1-${selectedUser.id}`}
                                            value={selectedUser.reportingManagerId || ''}
                                            onChange={e => onManagerChange(selectedUser.id, e.target.value, 1)}
                                            className="text-xs"
                                        >
                                            <option value="">None (Unassigned)</option>
                                            {users.filter(m => m.id !== selectedUser.id).map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name} ({getRoleDisplayName(m.role)})
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {/* STEP 2: L2 Manager */}
                            <div className={`p-4 rounded-xl border transition-all ${
                                manager2 
                                    ? 'bg-card border-border shadow-sm' 
                                    : 'bg-page/40 border-border/60 border-dashed'
                            }`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black">2</span>
                                        Level 2 (L2) Approver
                                    </span>
                                    {manager2 ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                        <span className="text-[11px] text-muted italic">Optional</span>
                                    )}
                                </div>

                                {manager2 ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-blue-200">
                                                {(manager2.name || 'M').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-primary-text truncate">{manager2.name}</p>
                                                <p className="text-[11px] text-muted truncate">{getRoleDisplayName(manager2.role)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-2 text-center text-muted">
                                        <p className="text-xs">No Level 2 Escalation</p>
                                        <p className="text-[11px] opacity-70">Directly routes to next tier</p>
                                    </div>
                                )}

                                {isEditing && onManagerChange && (
                                    <div className="mt-3 pt-3 border-t border-border/60">
                                        <label className="text-[11px] font-semibold text-muted block mb-1">Set L2:</label>
                                        <Select
                                            label=""
                                            id={`trace-l2-${selectedUser.id}`}
                                            value={selectedUser.reportingManager2Id || ''}
                                            onChange={e => onManagerChange(selectedUser.id, e.target.value, 2)}
                                            className="text-xs"
                                        >
                                            <option value="">None (Skip L2)</option>
                                            {users.filter(m => m.id !== selectedUser.id).map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name} ({getRoleDisplayName(m.role)})
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {/* STEP 3: L3 Manager */}
                            <div className={`p-4 rounded-xl border transition-all ${
                                manager3 
                                    ? 'bg-card border-border shadow-sm' 
                                    : 'bg-page/40 border-border/60 border-dashed'
                            }`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black">3</span>
                                        Level 3 (L3) Approver
                                    </span>
                                    {manager3 ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                        <span className="text-[11px] text-muted italic">Optional</span>
                                    )}
                                </div>

                                {manager3 ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-teal-200">
                                                {(manager3.name || 'M').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-primary-text truncate">{manager3.name}</p>
                                                <p className="text-[11px] text-muted truncate">{getRoleDisplayName(manager3.role)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-2 text-center text-muted">
                                        <p className="text-xs">No Level 3 Escalation</p>
                                        <p className="text-[11px] opacity-70">Directly routes to final step</p>
                                    </div>
                                )}

                                {isEditing && onManagerChange && (
                                    <div className="mt-3 pt-3 border-t border-border/60">
                                        <label className="text-[11px] font-semibold text-muted block mb-1">Set L3:</label>
                                        <Select
                                            label=""
                                            id={`trace-l3-${selectedUser.id}`}
                                            value={selectedUser.reportingManager3Id || ''}
                                            onChange={e => onManagerChange(selectedUser.id, e.target.value, 3)}
                                            className="text-xs"
                                        >
                                            <option value="">None (Skip L3)</option>
                                            {users.filter(m => m.id !== selectedUser.id).map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name} ({getRoleDisplayName(m.role)})
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {/* STEP 4: Final Confirmation */}
                            <div className="p-4 rounded-xl border bg-emerald-50/50 border-emerald-200/90 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                                        Final Confirmation
                                    </span>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                </div>

                                <div className="space-y-2">
                                    <p className="font-bold text-sm text-emerald-950">{finalApproverName}</p>
                                    <p className="text-[11px] text-emerald-800/80 leading-relaxed">
                                        Final authorization step before leave balance deduction & calendar sync.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Save Changes Button if editing */}
                        {isEditing && onSave && (
                            <div className="mt-5 pt-4 border-t border-border flex justify-end">
                                <Button onClick={onSave} size="sm">
                                    Save Updated Workflow
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Step explanation cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div className="p-4 bg-card border border-border rounded-xl">
                            <div className="font-bold text-primary-text mb-1 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                Auto-Escalation Timing
                            </div>
                            <p className="text-muted leading-relaxed">
                                If L1 does not respond within 48 hours, the request automatically escalates to L2 (if configured) or alerts HR.
                            </p>
                        </div>
                        <div className="p-4 bg-card border border-border rounded-xl">
                            <div className="font-bold text-primary-text mb-1 flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-emerald-600" />
                                Approval Notifications
                            </div>
                            <p className="text-muted leading-relaxed">
                                Approvers receive real-time mobile push notifications and email summaries when an action is required.
                            </p>
                        </div>
                        <div className="p-4 bg-card border border-border rounded-xl">
                            <div className="font-bold text-primary-text mb-1 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-sky-600" />
                                Site & Location Rules
                            </div>
                            <p className="text-muted leading-relaxed">
                                Approvals conform to site-level roster assignments, verifying shift coverage before sign-off.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowPathTrace;
