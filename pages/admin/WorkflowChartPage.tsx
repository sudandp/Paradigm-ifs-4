import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { User, UserRole, Role } from '../../types';
import { 
    Save, 
    Table, 
    Network, 
    Shield, 
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    Users
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import OrgWorkflowCard from '../../components/admin/OrgWorkflowCard';
import LoadingScreen from '../../components/ui/LoadingScreen';

type UserWithManager = User & { managerName?: string; manager2Name?: string; manager3Name?: string };

const WorkflowChartPage: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserWithManager[]>([]);
    const [allRoles, setAllRoles] = useState<Role[]>([]);
    const [approverRoles, setApproverRoles] = useState<Role[]>([]);
    const [finalConfirmationRole, setFinalConfirmationRole] = useState<UserRole>('hr');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersData, settingsData, rolesData] = await Promise.all([
                api.getUsersWithManagers(),
                api.getApprovalWorkflowSettings(),
                api.getRoles()
            ]);
            
            // Sort users alphabetically by name
            const sortedUsers = [...usersData].sort((a, b) => 
                (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
            );
            setUsers(sortedUsers);
            setAllRoles(rolesData || []);
            setFinalConfirmationRole(settingsData?.finalConfirmationRole || 'hr');
            
            // Filter roles that can be approvers for Final Confirmation
            const approvers = (rolesData || []).filter(r => ['admin', 'hr', 'operation_manager'].includes(r.id));
            approvers.push({ id: 'reporting_manager', displayName: 'Reporting Manager', permissions: [] });
            setApproverRoles(approvers);
        } catch (error) {
            setToast({ message: 'Failed to load workflow chart data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Quick Stats Calculation
    const stats = useMemo(() => {
        const total = users.length;
        const unassigned = users.filter(u => !u.reportingManagerId).length;
        const assigned = users.filter(u => !!u.reportingManagerId).length;
        const multiLevel = users.filter(u => !!u.reportingManager2Id || !!u.reportingManager3Id).length;
        return { total, unassigned, assigned, multiLevel };
    }, [users]);

    // Hierarchy Slot updates
    const handleManagerChange = (userId: string, managerId: string, slot: 1 | 2 | 3 = 1) => {
        setUsers(currentUsers =>
            currentUsers.map(u => {
                if (u.id !== userId) return u;
                const mgrObj = users.find(m => m.id === managerId);
                const mgrName = mgrObj?.name;
                if (slot === 1) return { ...u, reportingManagerId: managerId || undefined, managerName: mgrName || undefined };
                if (slot === 2) return { ...u, reportingManager2Id: managerId || undefined, manager2Name: mgrName || undefined };
                return { ...u, reportingManager3Id: managerId || undefined, manager3Name: mgrName || undefined };
            })
        );
    };

    // Save All Updates
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await Promise.all(users.flatMap(u => [
                api.updateUserReportingManager(u.id, u.reportingManagerId || null, 1),
                api.updateUserReportingManager(u.id, u.reportingManager2Id || null, 2),
                api.updateUserReportingManager(u.id, u.reportingManager3Id || null, 3)
            ]));
            await api.updateApprovalWorkflowSettings(finalConfirmationRole);
            setToast({ message: 'Workflow & reporting hierarchy saved successfully!', type: 'success' });
            fetchData();
        } catch (error) {
            setToast({ message: 'Failed to save workflow changes.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <LoadingScreen message="Loading 2D workflow chart..." />;
    }

    return (
        <div className="flex flex-col flex-1 h-[calc(100vh-100px)] min-h-[640px] space-y-2.5">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Top Bar: Title, Stats & Actions */}
            <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs flex-shrink-0">
                {/* Left: Title & Quick Stats */}
                <div className="flex items-center gap-3.5 flex-wrap">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-50 border border-emerald-200/80 rounded-lg text-emerald-700">
                            <Network className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-base sm:text-lg font-bold text-primary-text leading-none">
                                2D Workflow Chart
                            </h1>
                            <p className="text-[11px] text-muted mt-1 leading-none">
                                Interactive organizational hierarchy, team clusters & approval simulation
                            </p>
                        </div>
                    </div>

                    {/* Stats Pills */}
                    <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-border">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-page border border-border text-xs font-semibold text-muted">
                            <Users className="w-3.5 h-3.5 text-primary" />
                            Total: <strong className="text-primary-text">{stats.total}</strong>
                        </span>
                        {stats.unassigned > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Needs Manager: <strong>{stats.unassigned}</strong>
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                All Assigned
                            </span>
                        )}
                        {stats.multiLevel > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
                                Multi-Level: <strong>{stats.multiLevel}</strong>
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: Table View Link, Approver Select, Save Button */}
                <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/approval-workflow')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-page hover:bg-card border border-border text-xs font-bold text-muted hover:text-primary-text rounded-lg transition-all"
                        title="Switch to Leave Approval Workflow Table View"
                    >
                        <Table className="w-3.5 h-3.5 text-primary" />
                        Table View
                    </button>

                    <button
                        type="button"
                        onClick={fetchData}
                        className="p-1.5 bg-page hover:bg-card border border-border text-muted hover:text-primary-text rounded-lg transition-all"
                        title="Reload chart data"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5 bg-page px-2.5 py-1.5 rounded-lg border border-border">
                        <Shield className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="text-[11px] font-semibold text-muted whitespace-nowrap hidden sm:inline">Final Approver:</span>
                        <select
                            id="final-approver-select"
                            value={finalConfirmationRole}
                            onChange={e => setFinalConfirmationRole(e.target.value as UserRole)}
                            className="bg-transparent text-xs font-bold text-primary-text focus:outline-none cursor-pointer pr-1"
                            title="Select Final Confirmation Step Approver"
                        >
                            {approverRoles.map(role => (
                                <option key={role.id} value={role.id}>{role.displayName}</option>
                            ))}
                        </select>
                    </div>

                    <Button onClick={handleSave} isLoading={isSaving} size="sm">
                        <Save className="mr-1.5 h-3.5 w-3.5" /> Save Workflow
                    </Button>
                </div>
            </div>

            {/* Main Interactive Chart Card */}
            <div className="flex-1 min-h-0 bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
                <OrgWorkflowCard 
                    users={users}
                    allRoles={allRoles}
                    finalConfirmationRole={finalConfirmationRole}
                    onManagerChange={handleManagerChange}
                    onSave={handleSave}
                />
            </div>
        </div>
    );
};

export default WorkflowChartPage;
