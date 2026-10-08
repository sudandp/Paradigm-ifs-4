import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { User, UserRole, Role } from '../../types';
import { 
    Loader2, 
    Save, 
    Search, 
    FilterX, 
    Shield, 
    X, 
    Layers,
    Sparkles,
    Users,
    ChevronDown,
    ChevronUp,
    Check
} from 'lucide-react';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Pagination from '../../components/ui/Pagination';
import LoadingScreen from '../../components/ui/LoadingScreen';
import MobileTopBar from '../../components/navigation/MobileTopBar';

type UserWithManager = User & { managerName?: string; manager2Name?: string; manager3Name?: string };

type AssignmentFilterType = 'all' | 'unassigned' | 'assigned' | 'multi_level';

// Color-coded role badge styling (respecting no-purple guideline with dark mode support)
const getRoleBadgeStyle = (role: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('admin') || r.includes('management') || r.includes('director')) {
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200/90 dark:border-emerald-800/80 ring-1 ring-emerald-500/10';
    }
    if (r.includes('site_manager') || r.includes('manager') || r.includes('operation')) {
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200/90 dark:border-amber-800/80 ring-1 ring-amber-500/10';
    }
    if (r.includes('hr') || r.includes('recruitment')) {
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200/90 dark:border-blue-800/80 ring-1 ring-blue-500/10';
    }
    if (r.includes('field') || r.includes('staff')) {
        return 'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-200/90 dark:border-sky-800/80 ring-1 ring-sky-500/10';
    }
    if (r.includes('electrician') || r.includes('plumber') || r.includes('technician') || r.includes('security') || r.includes('hk')) {
        return 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-200/90 dark:border-teal-800/80 ring-1 ring-teal-500/10';
    }
    if (r.includes('finance') || r.includes('account')) {
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200/90 dark:border-emerald-800/80 ring-1 ring-emerald-500/10';
    }
    return 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700 ring-1 ring-slate-400/10';
};

const ApprovalWorkflow: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [users, setUsers] = useState<UserWithManager[]>([]);
    const [allRoles, setAllRoles] = useState<Role[]>([]);
    const [approverRoles, setApproverRoles] = useState<Role[]>([]);
    const [finalConfirmationRole, setFinalConfirmationRole] = useState<UserRole>('hr');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const initialUsersRef = useRef<Map<string, { r1?: string; r2?: string; r3?: string }>>(new Map());
    const initialFinalConfirmationRoleRef = useRef<UserRole>('hr');

    // Redirect to separate 2D chart page if ?tab=2d is passed
    useEffect(() => {
        if (searchParams.get('tab') === '2d') {
            navigate('/admin/workflow-chart', { replace: true });
        }
    }, [searchParams, navigate]);

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRole, setSelectedRole] = useState('all');
    const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilterType>('all');
    const [selectedManager, setSelectedManager] = useState('all');

    // Bulk Assignment States
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkTargetScope, setBulkTargetScope] = useState<'filtered' | 'role' | 'all'>('filtered');
    const [bulkTargetRole, setBulkTargetRole] = useState<string>('all');
    const [bulkLevel, setBulkLevel] = useState<1 | 2 | 3>(3);
    const [bulkManagerId, setBulkManagerId] = useState<string>('');

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
            setFinalConfirmationRole(settingsData.finalConfirmationRole);

            const initialMap = new Map<string, { r1?: string; r2?: string; r3?: string }>();
            sortedUsers.forEach(u => {
                initialMap.set(u.id, {
                    r1: u.reportingManagerId || '',
                    r2: u.reportingManager2Id || '',
                    r3: u.reportingManager3Id || ''
                });
            });
            initialUsersRef.current = initialMap;
            initialFinalConfirmationRoleRef.current = settingsData.finalConfirmationRole;
            
            // Filter roles that can be approvers for Final Confirmation
            const approvers = (rolesData || []).filter(r => ['admin', 'hr', 'operation_manager'].includes(r.id));
            approvers.push({ id: 'reporting_manager', displayName: 'Reporting Manager', permissions: [] });
            setApproverRoles(approvers);
        } catch (error) {
            setToast({ message: 'Failed to load workflow data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Role display name resolver
    const getRoleDisplayName = useCallback((roleId: string = '') => {
        const found = allRoles.find(r => r.id === roleId || r.id.toLowerCase() === roleId.toLowerCase());
        if (found?.displayName) return found.displayName;
        return roleId ? roleId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Staff';
    }, [allRoles]);

    // Unique roles present among users with counts
    const roleOptions = useMemo(() => {
        const counts = new Map<string, number>();
        users.forEach(u => {
            const r = u.role || 'unknown';
            counts.set(r, (counts.get(r) || 0) + 1);
        });
        return Array.from(counts.entries())
            .map(([roleId, count]) => ({
                id: roleId,
                name: getRoleDisplayName(roleId),
                count
            }))
            .sort((a, b) => b.count - a.count);
    }, [users, getRoleDisplayName]);

    // Unique managers assigned in the team
    const managerOptions = useMemo(() => {
        const mCount = new Map<string, { id: string; name: string; count: number }>();
        users.forEach(u => {
            if (u.reportingManagerId && u.managerName) {
                const existing = mCount.get(u.reportingManagerId);
                if (existing) {
                    existing.count += 1;
                } else {
                    mCount.set(u.reportingManagerId, {
                        id: u.reportingManagerId,
                        name: u.managerName,
                        count: 1
                    });
                }
            }
        });
        return Array.from(mCount.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [users]);

    // Assignment Stats
    const stats = useMemo(() => {
        const total = users.length;
        const unassigned = users.filter(u => !u.reportingManagerId).length;
        const assigned = users.filter(u => !!u.reportingManagerId).length;
        const multiLevel = users.filter(u => !!u.reportingManager2Id || !!u.reportingManager3Id).length;
        return { total, unassigned, assigned, multiLevel };
    }, [users]);

    // Filtered Users List
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            // 1. Search Query (Name, Role, Employee Code/ID, Manager, Location)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const nameMatch = (user.name || '').toLowerCase().includes(q);
                const roleMatch = getRoleDisplayName(user.role || '').toLowerCase().includes(q) || (user.role || '').toLowerCase().includes(q);
                const empIdMatch = ((user as any).empId || (user as any).employeeCode || user.biometricId || user.phone || user.email || '').toLowerCase().includes(q);
                const managerMatch = (user.managerName || '').toLowerCase().includes(q) || 
                                     (user.manager2Name || '').toLowerCase().includes(q) || 
                                     (user.manager3Name || '').toLowerCase().includes(q);
                const locationMatch = (user.location || '').toLowerCase().includes(q);
                if (!nameMatch && !roleMatch && !empIdMatch && !managerMatch && !locationMatch) {
                    return false;
                }
            }

            // 2. Role Filter
            if (selectedRole !== 'all' && user.role !== selectedRole) {
                return false;
            }

            // 3. Assignment Status Filter
            if (assignmentFilter === 'unassigned' && user.reportingManagerId) {
                return false;
            }
            if (assignmentFilter === 'assigned' && !user.reportingManagerId) {
                return false;
            }
            if (assignmentFilter === 'multi_level' && !user.reportingManager2Id && !user.reportingManager3Id) {
                return false;
            }

            // 4. Specific Manager Filter
            if (selectedManager !== 'all') {
                const matchesAnyManager = user.reportingManagerId === selectedManager ||
                                          user.reportingManager2Id === selectedManager ||
                                          user.reportingManager3Id === selectedManager;
                if (!matchesAnyManager) return false;
            }

            return true;
        });
    }, [users, searchQuery, selectedRole, assignmentFilter, selectedManager, getRoleDisplayName]);

    // Target users for bulk assign preview & execution
    const bulkTargetUsers = useMemo(() => {
        let targets: UserWithManager[] = [];
        if (bulkTargetScope === 'filtered') {
            targets = filteredUsers;
        } else if (bulkTargetScope === 'role') {
            targets = bulkTargetRole === 'all' ? users : users.filter(u => u.role === bulkTargetRole);
        } else {
            targets = users;
        }
        if (bulkManagerId && bulkManagerId !== 'CLEAR') {
            targets = targets.filter(u => u.id !== bulkManagerId);
        }
        return targets;
    }, [bulkTargetScope, bulkTargetRole, filteredUsers, users, bulkManagerId]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedRole, assignmentFilter, selectedManager]);

    const isFiltered = searchQuery !== '' || selectedRole !== 'all' || assignmentFilter !== 'all' || selectedManager !== 'all';

    const handleClearFilters = () => {
        setSearchQuery('');
        setSelectedRole('all');
        setAssignmentFilter('all');
        setSelectedManager('all');
    };

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

    const handleApplyBulk = () => {
        if (!bulkManagerId) {
            setToast({ message: 'Please select a manager to assign.', type: 'error' });
            return;
        }
        if (bulkTargetUsers.length === 0) {
            setToast({ message: 'No target employees found to assign.', type: 'error' });
            return;
        }

        const targetIds = new Set(bulkTargetUsers.map(u => u.id));
        const mgrObj = users.find(m => m.id === bulkManagerId);
        const mgrName = mgrObj?.name;

        setUsers(currentUsers =>
            currentUsers.map(u => {
                if (!targetIds.has(u.id)) return u;
                if (u.id === bulkManagerId) return u; // Never assign user to themselves

                const newId = bulkManagerId === 'CLEAR' ? undefined : bulkManagerId;
                const newName = bulkManagerId === 'CLEAR' ? undefined : mgrName;

                if (bulkLevel === 1) {
                    return { ...u, reportingManagerId: newId, managerName: newName };
                } else if (bulkLevel === 2) {
                    return { ...u, reportingManager2Id: newId, manager2Name: newName };
                } else {
                    return { ...u, reportingManager3Id: newId, manager3Name: newName };
                }
            })
        );

        const levelLabel = `L${bulkLevel}`;
        const mgrLabel = bulkManagerId === 'CLEAR' ? 'Cleared' : (mgrObj ? `${mgrObj.name} (${getRoleDisplayName(mgrObj.role)})` : 'Assigned');
        setToast({
            message: `Bulk updated ${levelLabel} $\\rightarrow$ ${mgrLabel} for ${bulkTargetUsers.length} employee(s). Click "Save Workflow" to save!`,
            type: 'success'
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Find only users whose managers actually changed
            const changedUsers = users.filter(u => {
                const init = initialUsersRef.current.get(u.id);
                if (!init) return true;
                const currR1 = u.reportingManagerId || '';
                const currR2 = u.reportingManager2Id || '';
                const currR3 = u.reportingManager3Id || '';
                return currR1 !== (init.r1 || '') || currR2 !== (init.r2 || '') || currR3 !== (init.r3 || '');
            });

            const roleChanged = finalConfirmationRole !== initialFinalConfirmationRoleRef.current;

            if (changedUsers.length === 0 && !roleChanged) {
                setToast({ message: 'No changes to save.', type: 'success' });
                return;
            }

            // Save changed users safely in concurrent batches of 15 for optimal speed
            const BATCH_SIZE = 15;
            for (let i = 0; i < changedUsers.length; i += BATCH_SIZE) {
                const batch = changedUsers.slice(i, i + BATCH_SIZE);
                await Promise.all(
                    batch.map(u => 
                        api.updateUserReportingManagers(u.id, {
                            reportingManagerId: u.reportingManagerId || null,
                            reportingManager2Id: u.reportingManager2Id || null,
                            reportingManager3Id: u.reportingManager3Id || null
                        })
                    )
                );
            }

            if (roleChanged) {
                await api.updateApprovalWorkflowSettings(finalConfirmationRole);
            }

            setToast({ 
                message: changedUsers.length > 0 
                    ? `Workflow saved successfully! (${changedUsers.length} employee hierarchy updated)` 
                    : 'Workflow settings saved successfully!', 
                type: 'success' 
            });
            await fetchData();
        } catch (error: any) {
            console.error('Failed to save workflow:', error);
            setToast({ message: `Failed to save workflow: ${error?.message || 'Server error'}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="border-0 shadow-none md:bg-card md:rounded-xl md:shadow-card flex flex-col flex-1 p-4 md:p-6 space-y-4">
            <MobileTopBar title="LEAVE APPROVALS" parentPath="/mobile-home" />
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* UNIFIED COMPACT EXECUTIVE HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2.5 border-b border-border flex-shrink-0">
                {/* Left: Page Title + Quick Stats */}
                <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-bold text-primary-text flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-primary" />
                        Leave Approval Workflow
                    </h2>

                    {/* Quick Stats Pills */}
                    <div className="hidden sm:flex items-center gap-1.5 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-page border border-border text-[11px] font-semibold text-muted">
                            Total: <strong className="text-primary-text">{stats.total}</strong>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Needs Manager: <strong>{stats.unassigned}</strong>
                        </span>
                    </div>
                </div>

                {/* Right: Bulk Assign Toggle + Final Approver Select + Save Button */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setIsBulkOpen(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs ${
                            isBulkOpen 
                                ? 'bg-primary dark:bg-emerald-600 text-white border-primary/80 dark:border-emerald-500 shadow-primary/20' 
                                : 'bg-primary/10 dark:bg-emerald-950/60 text-primary dark:text-emerald-300 border-primary/30 dark:border-emerald-800/60 hover:bg-primary/20'
                        }`}
                        title="Toggle Bulk Manager Assignment Panel"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Bulk Assign
                        {isBulkOpen ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                    </button>

                    <div className="flex items-center gap-1.5 bg-page px-2 py-1 rounded-lg border border-border">
                        <Shield className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="text-[11px] font-semibold text-muted whitespace-nowrap">Final Approver:</span>
                        <select
                            id="final-approver"
                            value={finalConfirmationRole}
                            onChange={e => setFinalConfirmationRole(e.target.value as UserRole)}
                            className="bg-transparent text-xs font-bold text-primary-text focus:outline-none cursor-pointer pr-1"
                            title="Select Final Confirmation Step Approver"
                        >
                            {approverRoles.map(role => (
                                <option key={role.id} value={role.id} className="bg-card text-primary-text">{role.displayName}</option>
                            ))}
                        </select>
                    </div>

                    <Button onClick={handleSave} isLoading={isSaving} size="sm">
                        <Save className="mr-1.5 h-3.5 w-3.5" /> Save Workflow
                    </Button>
                </div>
            </div>

            {/* ⚡ BULK ASSIGN PANEL */}
            {isBulkOpen && (
                <div className="p-4 bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-slate-50 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-slate-900/80 border border-emerald-300/80 dark:border-emerald-800/70 rounded-xl space-y-3.5 shadow-sm transition-all">
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 dark:border-emerald-800/50">
                        <div className="flex items-center gap-2">
                            <span className="p-1 rounded-md bg-primary dark:bg-emerald-600 text-white shadow-xs">
                                <Users className="w-4 h-4" />
                            </span>
                            <div>
                                <h3 className="text-xs font-bold text-primary-text dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                                    Bulk Reporting Manager Assignment
                                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                                        Fast Configuration
                                    </span>
                                </h3>
                                <p className="text-[11px] text-muted dark:text-slate-400">
                                    Assign an L1, L2, or L3 manager across a group or role of employees in one click
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsBulkOpen(false)}
                            className="text-muted dark:text-slate-400 hover:text-primary-text dark:hover:text-slate-200 p-1 rounded-lg hover:bg-page/80 dark:hover:bg-slate-800 transition-colors"
                            title="Close Bulk Panel"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${bulkTargetScope === 'role' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 items-end`}>
                        {/* 1. Target Scope */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-primary-text dark:text-slate-200 uppercase tracking-wider block">
                                1. Target Employees
                            </label>
                            <select
                                value={bulkTargetScope}
                                onChange={e => setBulkTargetScope(e.target.value as any)}
                                className="w-full h-9 px-3 bg-card dark:bg-slate-900 border border-border dark:border-slate-700 rounded-lg text-xs font-semibold text-primary-text dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs"
                            >
                                <option value="filtered">Currently Filtered ({filteredUsers.length})</option>
                                <option value="role">Specific Role...</option>
                                <option value="all">All Employees ({users.length})</option>
                            </select>
                        </div>

                        {/* 1b. Role Selector (Only when Specific Role is chosen) */}
                        {bulkTargetScope === 'role' && (
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-primary-text dark:text-slate-200 uppercase tracking-wider block">
                                    Target Role
                                </label>
                                <select
                                    value={bulkTargetRole}
                                    onChange={e => setBulkTargetRole(e.target.value)}
                                    className="w-full h-9 px-3 bg-card dark:bg-slate-900 border border-border dark:border-slate-700 rounded-lg text-xs font-semibold text-primary-text dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs"
                                >
                                    <option value="all">All Roles</option>
                                    {roleOptions.map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.name} ({r.count})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* 2. Manager Level */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-primary-text dark:text-slate-200 uppercase tracking-wider block">
                                2. Hierarchy Level
                            </label>
                            <div className="grid grid-cols-3 gap-1 bg-card dark:bg-slate-900 p-0.5 border border-border dark:border-slate-700 rounded-lg h-9 items-center shadow-xs">
                                <button
                                    type="button"
                                    onClick={() => setBulkLevel(1)}
                                    className={`h-7 text-xs font-bold rounded-md transition-all flex items-center justify-center ${
                                        bulkLevel === 1 ? 'bg-primary dark:bg-emerald-600 text-white shadow-xs' : 'text-muted dark:text-slate-400 hover:bg-page dark:hover:bg-slate-800'
                                    }`}
                                >
                                    L1
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBulkLevel(2)}
                                    className={`h-7 text-xs font-bold rounded-md transition-all flex items-center justify-center ${
                                        bulkLevel === 2 ? 'bg-primary dark:bg-emerald-600 text-white shadow-xs' : 'text-muted dark:text-slate-400 hover:bg-page dark:hover:bg-slate-800'
                                    }`}
                                >
                                    L2
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBulkLevel(3)}
                                    className={`h-7 text-xs font-bold rounded-md transition-all flex items-center justify-center ${
                                        bulkLevel === 3 ? 'bg-primary dark:bg-emerald-600 text-white shadow-xs' : 'text-muted dark:text-slate-400 hover:bg-page dark:hover:bg-slate-800'
                                    }`}
                                >
                                    L3
                                </button>
                            </div>
                        </div>

                        {/* 3. Manager Selection */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-primary-text dark:text-slate-200 uppercase tracking-wider block">
                                3. Assign Manager
                            </label>
                            <select
                                value={bulkManagerId}
                                onChange={e => setBulkManagerId(e.target.value)}
                                className="w-full h-9 px-3 bg-card dark:bg-slate-900 border border-border dark:border-slate-700 rounded-lg text-xs font-semibold text-primary-text dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs"
                            >
                                <option value="">-- Select Manager --</option>
                                <option value="CLEAR">None (Clear Level)</option>
                                {users.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({getRoleDisplayName(m.role)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 4. Action Button */}
                        <div className="space-y-1">
                            <button
                                type="button"
                                onClick={handleApplyBulk}
                                disabled={!bulkManagerId || bulkTargetUsers.length === 0}
                                className={`w-full h-9 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                                    !bulkManagerId || bulkTargetUsers.length === 0
                                        ? 'bg-page dark:bg-slate-800 text-muted/40 dark:text-slate-600 cursor-not-allowed border border-border dark:border-slate-700'
                                        : 'bg-primary hover:bg-primary/90 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white border border-primary/30 dark:border-emerald-700 shadow-primary/20 active:scale-[0.98]'
                                }`}
                            >
                                <Check className="w-3.5 h-3.5" />
                                Apply to {bulkTargetUsers.length} Staff
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table Content */}
            <div className="flex-1 space-y-4">
                {/* 🔍 COMPREHENSIVE FILTER & ROLE IDENTIFIER BAR */}
                        <div className="p-4 bg-page/70 border border-border rounded-xl space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {/* 1. Search Box */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search employee, role, manager..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-8 py-2 bg-card border border-border rounded-lg text-sm text-primary-text placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary-text p-0.5 rounded-full"
                                            title="Clear search"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* 2. Role Filter */}
                                <div>
                                    <select
                                        id="role-filter"
                                        value={selectedRole}
                                        onChange={e => setSelectedRole(e.target.value)}
                                        className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    >
                                        <option value="all">All User Roles ({users.length})</option>
                                        {roleOptions.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.name} ({r.count})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* 3. Assignment Status Filter */}
                                <div>
                                    <select
                                        id="assignment-filter"
                                        value={assignmentFilter}
                                        onChange={e => setAssignmentFilter(e.target.value as AssignmentFilterType)}
                                        className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    >
                                        <option value="all">All Manager Statuses</option>
                                        <option value="unassigned">⚠️ Needs Manager ({stats.unassigned})</option>
                                        <option value="assigned">✅ Assigned ({stats.assigned})</option>
                                        <option value="multi_level">⚡ Multi-Level Escalation ({stats.multiLevel})</option>
                                    </select>
                                </div>

                                {/* 4. Filter by Manager */}
                                <div>
                                    <select
                                        id="manager-filter"
                                        value={selectedManager}
                                        onChange={e => setSelectedManager(e.target.value)}
                                        className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    >
                                        <option value="all">All Reporting Managers</option>
                                        {managerOptions.map(m => (
                                            <option key={m.id} value={m.id}>
                                                Reports to: {m.name} ({m.count})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Active Filter Bar & Results Summary */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted border-t border-border/50">
                                <div className="flex items-center gap-2">
                                    <span>
                                        Showing <strong className="text-primary-text font-semibold">{filteredUsers.length}</strong> of {users.length} employees
                                    </span>
                                    {isFiltered && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                                            Filtered
                                        </span>
                                    )}
                                </div>

                                {isFiltered && (
                                    <button
                                        onClick={handleClearFilters}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100/80 dark:hover:bg-rose-900/60 px-2.5 py-1 rounded-md transition-colors"
                                    >
                                        <FilterX className="w-3.5 h-3.5" />
                                        Clear All Filters
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* DESKTOP TABLE VIEW */}
                        <div className="overflow-x-auto hidden md:block border border-border rounded-xl shadow-sm">
                            <table className="min-w-full divide-y divide-border">
                                <thead className="bg-page">
                                    <tr>
                                        <th className="px-4 py-3.5 text-left text-xs font-bold text-muted uppercase tracking-wider">Employee</th>
                                        <th className="px-4 py-3.5 text-left text-xs font-bold text-muted uppercase tracking-wider">User Role</th>
                                        <th className="px-4 py-3.5 text-left text-xs font-bold text-muted uppercase tracking-wider">
                                            <span className="flex items-center gap-1">
                                                Reporting Manager (L1)
                                                <span className="text-rose-500 font-bold">*</span>
                                            </span>
                                        </th>
                                        <th className="px-4 py-3.5 text-left text-xs font-bold text-muted uppercase tracking-wider">Reporting Manager 2 (L2)</th>
                                        <th className="px-4 py-3.5 text-left text-xs font-bold text-muted uppercase tracking-wider">Reporting Manager 3 (L3)</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-card divide-y divide-border">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-12 text-center text-muted">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <FilterX className="w-8 h-8 text-muted/50" />
                                                    <p className="text-sm font-medium text-primary-text">No employees found matching the filters</p>
                                                    <p className="text-xs text-muted">Try clearing your search query or selecting a different role</p>
                                                    <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-2">
                                                        Clear Filters
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(user => {
                                            const roleName = getRoleDisplayName(user.role);
                                            const roleBadgeCls = getRoleBadgeStyle(user.role);
                                            const isUnassigned = !user.reportingManagerId;

                                            return (
                                                <tr key={user.id} className="hover:bg-page/40 transition-colors">
                                                    {/* Employee Info */}
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center flex-shrink-0 border border-primary/20">
                                                                {(user.name || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-primary-text text-sm leading-tight">{user.name}</p>
                                                                {user.location && (
                                                                    <p className="text-[11px] text-muted mt-0.5">{user.location}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Role with Color-Coded Identifier Badge */}
                                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${roleBadgeCls}`}>
                                                            {roleName}
                                                        </span>
                                                    </td>

                                                    {/* Manager 1 (L1) */}
                                                    <td className="px-4 py-3.5">
                                                        <div className="relative">
                                                            <Select
                                                                label=""
                                                                aria-label={`Reporting Manager for ${user.name}`}
                                                                id={`manager-1-desktop-${user.id}`}
                                                                value={user.reportingManagerId || ''}
                                                                onChange={e => handleManagerChange(user.id, e.target.value, 1)}
                                                                className={`w-full min-w-[200px] text-xs font-medium ${isUnassigned ? 'border-amber-400 bg-amber-50/40 focus:border-amber-500' : ''}`}
                                                            >
                                                                <option value="">None (Unassigned)</option>
                                                                {users.filter(m => m.id !== user.id).map(manager => {
                                                                    const mgrRole = getRoleDisplayName(manager.role);
                                                                    return (
                                                                        <option key={manager.id} value={manager.id}>
                                                                            {manager.name} ({mgrRole})
                                                                        </option>
                                                                    );
                                                                })}
                                                            </Select>
                                                        </div>
                                                    </td>

                                                    {/* Manager 2 (L2) */}
                                                    <td className="px-4 py-3.5">
                                                        <Select
                                                            label=""
                                                            aria-label={`Reporting Manager 2 for ${user.name}`}
                                                            id={`manager-2-desktop-${user.id}`}
                                                            value={user.reportingManager2Id || ''}
                                                            onChange={e => handleManagerChange(user.id, e.target.value, 2)}
                                                            className="w-full min-w-[200px] text-xs font-medium"
                                                        >
                                                            <option value="">None</option>
                                                            {users.filter(m => m.id !== user.id).map(manager => {
                                                                const mgrRole = getRoleDisplayName(manager.role);
                                                                return (
                                                                    <option key={manager.id} value={manager.id}>
                                                                        {manager.name} ({mgrRole})
                                                                    </option>
                                                                );
                                                            })}
                                                        </Select>
                                                    </td>

                                                    {/* Manager 3 (L3) */}
                                                    <td className="px-4 py-3.5">
                                                        <Select
                                                            label=""
                                                            aria-label={`Reporting Manager 3 for ${user.name}`}
                                                            id={`manager-3-desktop-${user.id}`}
                                                            value={user.reportingManager3Id || ''}
                                                            onChange={e => handleManagerChange(user.id, e.target.value, 3)}
                                                            className="w-full min-w-[200px] text-xs font-medium"
                                                        >
                                                            <option value="">None</option>
                                                            {users.filter(m => m.id !== user.id).map(manager => {
                                                                const mgrRole = getRoleDisplayName(manager.role);
                                                                return (
                                                                    <option key={manager.id} value={manager.id}>
                                                                        {manager.name} ({mgrRole})
                                                                    </option>
                                                                );
                                                            })}
                                                        </Select>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* MOBILE CARD VIEW */}
                        <div className="space-y-3 md:hidden">
                            {filteredUsers.length === 0 ? (
                                <div className="p-8 text-center text-muted bg-card border border-border rounded-xl">
                                    <p className="text-sm font-medium text-primary-text">No employees found</p>
                                    <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-2">
                                        Clear Filters
                                    </Button>
                                </div>
                            ) : (
                                filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(user => {
                                    const roleName = getRoleDisplayName(user.role);
                                    const roleBadgeCls = getRoleBadgeStyle(user.role);
                                    const isUnassigned = !user.reportingManagerId;

                                    return (
                                        <div key={user.id} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                                            <div className="p-3.5 flex items-center justify-between border-b border-border bg-page/30">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20">
                                                        {(user.name || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-primary-text text-sm">{user.name}</p>
                                                        {user.location && <p className="text-[11px] text-muted">{user.location}</p>}
                                                    </div>
                                                </div>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${roleBadgeCls}`}>
                                                    {roleName}
                                                </span>
                                            </div>
                                            <div className="p-3.5 space-y-3">
                                                <div>
                                                    <label className="text-xs font-semibold text-primary-text mb-1 block">
                                                        Reporting Manager 1 (L1) <span className="text-rose-500">*</span>
                                                    </label>
                                                    <Select
                                                        label=""
                                                        id={`manager-1-mobile-${user.id}`}
                                                        value={user.reportingManagerId || ''}
                                                        onChange={e => handleManagerChange(user.id, e.target.value, 1)}
                                                        className={isUnassigned ? 'border-amber-400 bg-amber-50/40' : ''}
                                                    >
                                                        <option value="">None (Unassigned)</option>
                                                        {users.filter(m => m.id !== user.id).map(manager => (
                                                            <option key={manager.id} value={manager.id}>
                                                                {manager.name} ({getRoleDisplayName(manager.role)})
                                                            </option>
                                                        ))}
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-primary-text mb-1 block">
                                                        Reporting Manager 2 (L2)
                                                    </label>
                                                    <Select
                                                        label=""
                                                        id={`manager-2-mobile-${user.id}`}
                                                        value={user.reportingManager2Id || ''}
                                                        onChange={e => handleManagerChange(user.id, e.target.value, 2)}
                                                    >
                                                        <option value="">None</option>
                                                        {users.filter(m => m.id !== user.id).map(manager => (
                                                            <option key={manager.id} value={manager.id}>
                                                                {manager.name} ({getRoleDisplayName(manager.role)})
                                                            </option>
                                                        ))}
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-primary-text mb-1 block">
                                                        Reporting Manager 3 (L3)
                                                    </label>
                                                    <Select
                                                        label=""
                                                        id={`manager-3-mobile-${user.id}`}
                                                        value={user.reportingManager3Id || ''}
                                                        onChange={e => handleManagerChange(user.id, e.target.value, 3)}
                                                    >
                                                        <option value="">None</option>
                                                        {users.filter(m => m.id !== user.id).map(manager => (
                                                            <option key={manager.id} value={manager.id}>
                                                                {manager.name} ({getRoleDisplayName(manager.role)})
                                                            </option>
                                                        ))}
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                                             {/* Pagination */}
                        <div className="mt-4">
                            <Pagination
                                currentPage={currentPage}
                                totalItems={filteredUsers.length}
                                pageSize={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onPageSizeChange={setItemsPerPage}
                                pageSizeOptions={[10, 20, 50, 100]}
                            />
                        </div>
                    </div>
                </div>
            </div>
    );
};

export default ApprovalWorkflow;