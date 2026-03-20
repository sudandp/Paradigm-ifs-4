import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { User, UserRole, Role } from '../../types';
import { Loader2, Save, Table, Network, Maximize2 } from 'lucide-react';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import WorkflowChart2D from '../../components/admin/WorkflowChart2D';
import OrgWorkflowCard from '../../components/admin/OrgWorkflowCard';
import Pagination from '../../components/ui/Pagination';
import LoadingScreen from '../../components/ui/LoadingScreen';



type UserWithManager = User & { managerName?: string, manager2Name?: string, manager3Name?: string };

type ViewTab = 'table' | '2d';

const ApprovalWorkflow: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserWithManager[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [finalConfirmationRole, setFinalConfirmationRole] = useState<UserRole>('hr');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [activeTab, setActiveTab] = useState<ViewTab>('table');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

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
            setFinalConfirmationRole(settingsData.finalConfirmationRole);
            // Filter to only show roles that can be approvers, plus the special "reporting_manager" option
            const approverRoles = rolesData.filter(r => ['admin', 'hr', 'operation_manager'].includes(r.id));
            // Add special "Reporting Manager" option
            approverRoles.push({ id: 'reporting_manager', displayName: 'Reporting Manager', permissions: [] });
            setRoles(approverRoles);
        } catch (error) {
            setToast({ message: 'Failed to load workflow data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleManagerChange = (userId: string, managerId: string, slot: 1 | 2 | 3 = 1) => {
        setUsers(currentUsers =>
            currentUsers.map(u => {
                if (u.id !== userId) return u;
                if (slot === 1) return { ...u, reportingManagerId: managerId || undefined };
                if (slot === 2) return { ...u, reportingManager2Id: managerId || undefined };
                return { ...u, reportingManager3Id: managerId || undefined };
            })
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await Promise.all(users.flatMap(u => [
                api.updateUserReportingManager(u.id, u.reportingManagerId || null, 1),
                api.updateUserReportingManager(u.id, u.reportingManager2Id || null, 2),
                api.updateUserReportingManager(u.id, u.reportingManager3Id || null, 3)
            ]));
            await api.updateApprovalWorkflowSettings(finalConfirmationRole);
            setToast({ message: 'Workflow saved successfully!', type: 'success' });
            fetchData(); // re-fetch to confirm names
        } catch (error) {
            setToast({ message: 'Failed to save workflow.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-4 border-0 shadow-none md:bg-card md:p-8 md:rounded-xl md:shadow-card">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <AdminPageHeader title="Leave Approval Settings">
                <Button onClick={handleSave} isLoading={isSaving}><Save className="mr-2 h-4 w-4" /> Save Workflow</Button>
            </AdminPageHeader>

            <section className="mb-8">
                <h3 className="text-xl font-bold text-primary-text mb-2">Final Confirmation Step</h3>
                <p className="text-sm text-muted mb-4">Select the role responsible for the final confirmation of a leave request after it has been approved by the reporting manager chain.</p>
                <div className="max-w-xs">
                    <Select
                        label="Final Confirmation Role"
                        id="final-approver"
                        value={finalConfirmationRole}
                        onChange={e => setFinalConfirmationRole(e.target.value as UserRole)}
                    >
                        {roles.map(role => <option key={role.id} value={role.id}>{role.displayName}</option>)}
                    </Select>
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-primary-text mb-1">Reporting Structure</h3>
                        <p className="text-sm text-muted">View and manage organizational hierarchy</p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="border-b border-border mb-6">
                    <div className="flex gap-1 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('table')}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === 'table'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted hover:text-primary-text hover:border-border'
                                }`}
                        >
                            <Table className="w-4 h-4" />
                            Table View
                        </button>
                        <button
                            onClick={() => setActiveTab('2d')}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === '2d'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted hover:text-primary-text hover:border-border'
                                }`}
                        >
                            <Network className="w-4 h-4" />
                            2D Workflow Chart
                        </button>

                    </div>
                </div>

                {/* Tab Content */}
                {isLoading ? (
                    <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted" />
                    </div>
                ) : (
                    <>
                        {/* Table View */}
                        {activeTab === 'table' && (
                            <>
                                <p className="text-sm text-muted mb-4">For each employee, assign a reporting manager. Leave requests will be sent to this manager for first-level approval.</p>
                                <div className="overflow-x-auto hidden md:block border border-border rounded-lg">
                                    <table className="min-w-full">
                                        <thead className="bg-page">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Employee</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Role</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Reporting Manager</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Reporting Manager 2</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Reporting Manager 3</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-card divide-y divide-border">
                                            {users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(user => (
                                                <tr key={user.id}>
                                                    <td className="px-4 py-4 font-medium text-primary-text whitespace-nowrap">{user.name}</td>
                                                    <td className="px-4 py-4 text-sm text-muted capitalize whitespace-nowrap">{roles.find(r => r.id === user.role)?.displayName || user.role.replace(/_/g, ' ')}</td>
                                                    <td className="px-4 py-4">
                                                        <Select
                                                            label=""
                                                            aria-label={`Reporting Manager for ${user.name}`}
                                                            id={`manager-1-desktop-${user.id}`}
                                                            value={user.reportingManagerId || ''}
                                                            onChange={e => handleManagerChange(user.id, e.target.value, 1)}
                                                            className="w-full min-w-[160px]"
                                                        >
                                                            <option value="">None</option>
                                                            {users.filter(m => m.id !== user.id).map(manager => (
                                                                <option key={manager.id} value={manager.id}>{manager.name}</option>
                                                            ))}
                                                        </Select>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <Select
                                                            label=""
                                                            aria-label={`Reporting Manager 2 for ${user.name}`}
                                                            id={`manager-2-desktop-${user.id}`}
                                                            value={user.reportingManager2Id || ''}
                                                            onChange={e => handleManagerChange(user.id, e.target.value, 2)}
                                                            className="w-full min-w-[160px]"
                                                        >
                                                            <option value="">None</option>
                                                            {users.filter(m => m.id !== user.id).map(manager => (
                                                                <option key={manager.id} value={manager.id}>{manager.name}</option>
                                                            ))}
                                                        </Select>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <Select
                                                            label=""
                                                            aria-label={`Reporting Manager 3 for ${user.name}`}
                                                            id={`manager-3-desktop-${user.id}`}
                                                            value={user.reportingManager3Id || ''}
                                                            onChange={e => handleManagerChange(user.id, e.target.value, 3)}
                                                            className="w-full min-w-[160px]"
                                                        >
                                                            <option value="">None</option>
                                                            {users.filter(m => m.id !== user.id).map(manager => (
                                                                <option key={manager.id} value={manager.id}>{manager.name}</option>
                                                            ))}
                                                        </Select>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="space-y-3 md:hidden">
                                    {users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(user => (
                                        <div key={user.id} className="bg-card rounded-lg border border-border overflow-hidden">
                                            <div className="p-3">
                                                <p className="font-semibold text-primary-text">{user.name}</p>
                                                <p className="text-sm text-muted capitalize">{roles.find(r => r.id === user.role)?.displayName || user.role.replace(/_/g, ' ')}</p>
                                            </div>
                                            <div className="p-3 border-t border-border space-y-3">
                                                <Select
                                                    label="Manager 1"
                                                    id={`manager-1-mobile-${user.id}`}
                                                    value={user.reportingManagerId || ''}
                                                    onChange={e => handleManagerChange(user.id, e.target.value, 1)}
                                                >
                                                    <option value="">None</option>
                                                    {users.filter(m => m.id !== user.id).map(manager => (
                                                        <option key={manager.id} value={manager.id}>{manager.name}</option>
                                                    ))}
                                                </Select>
                                                <Select
                                                    label="Manager 2"
                                                    id={`manager-2-mobile-${user.id}`}
                                                    value={user.reportingManager2Id || ''}
                                                    onChange={e => handleManagerChange(user.id, e.target.value, 2)}
                                                >
                                                    <option value="">None</option>
                                                    {users.filter(m => m.id !== user.id).map(manager => (
                                                        <option key={manager.id} value={manager.id}>{manager.name}</option>
                                                    ))}
                                                </Select>
                                                <Select
                                                    label="Manager 3"
                                                    id={`manager-3-mobile-${user.id}`}
                                                    value={user.reportingManager3Id || ''}
                                                    onChange={e => handleManagerChange(user.id, e.target.value, 3)}
                                                >
                                                    <option value="">None</option>
                                                    {users.filter(m => m.id !== user.id).map(manager => (
                                                        <option key={manager.id} value={manager.id}>{manager.name}</option>
                                                    ))}
                                                </Select>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4">
                                    <Pagination
                                        currentPage={currentPage}
                                        totalItems={users.length}
                                        pageSize={itemsPerPage}
                                        onPageChange={setCurrentPage}
                                        onPageSizeChange={setItemsPerPage}
                                        pageSizeOptions={[10, 20, 50, 100]}
                                    />
                                </div>
                            </>
                        )}

                        {/* 2D Workflow Chart */}
                        {activeTab === '2d' && (
                            <OrgWorkflowCard users={users} />
                        )}


                    </>
                )}
            </section>
        </div>
    );
};

export default ApprovalWorkflow;