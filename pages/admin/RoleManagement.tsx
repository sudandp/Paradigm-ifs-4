import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import type { UserRole, Permission, AppModule, Role } from '../../types';
import { ShieldCheck, Check, X, Loader2, Plus, MoreVertical, Edit, Trash2 } from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { api } from '../../services/api';
import RoleNameModal from '../../components/admin/RoleNameModal';
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import { useDevice } from '../../hooks/useDevice';
import { isAdmin } from '../../utils/auth';
import LoadingScreen from '../../components/ui/LoadingScreen';


export const allPermissions: { key: Permission; name: string; description: string }[] = [...[
    { key: 'apply_for_leave', name: 'Apply for Leave', description: 'Allows users to request time off.' },
    { key: 'create_enrollment', name: 'Create Enrollment', description: 'Access the multi-step form to onboard new employees.' },
    { key: 'view_developer_settings', name: 'Developer Settings', description: 'Access API settings and other developer tools.' },
    { key: 'download_attendance_report', name: 'Download Attendance Report', description: 'Generate and download attendance reports in CSV format.' },
    { key: 'manage_approval_workflow', name: 'Manage Approval Workflow', description: 'Set up reporting managers for leave approvals.' },
    { key: 'manage_attendance_rules', name: 'Manage Attendance Rules', description: 'Set work hours, holidays, and leave allocations.' },
    { key: 'manage_enrollment_rules', name: 'Manage Enrollment Rules', description: 'Set rules for ESI/GMC, manpower limits, and documents.' },
    { key: 'manage_insurance', name: 'Manage Insurance', description: 'Create and manage company insurance plans.' },
    { key: 'manage_leave_requests', name: 'Manage Leave Requests', description: 'Approve or reject leave requests for employees.' },
    { key: 'manage_modules', name: 'Manage Modules', description: 'Create, edit, and group permissions into modules.' },
    { key: 'manage_policies', name: 'Manage Policies', description: 'Create and manage company policies.' },
    { key: 'manage_roles_and_permissions', name: 'Manage Roles & Permissions', description: 'Access this page to edit role permissions.' },
    { key: 'manage_sites', name: 'Manage Sites', description: 'Create, edit, and delete organizations/sites.' },
    { key: 'manage_tasks', name: 'Manage Tasks', description: 'Create, assign, and manage all organizational tasks, including escalations.' },
    { key: 'manage_uniforms', name: 'Manage Uniforms', description: 'Manage uniform requests and site configurations.' },
    { key: 'manage_users', name: 'Manage Users', description: 'Create, edit, and delete user accounts.' },
    { key: 'view_operations_dashboard', name: 'Operations Dashboard', description: 'View the operations management dashboard.' },
    { key: 'view_site_dashboard', name: 'Site Dashboard', description: 'View the dashboard for a specific site/organization.' },
    { key: 'view_all_attendance', name: 'View All Attendance', description: 'Allows users to see attendance records for all employees.' },
    { key: 'view_all_submissions', name: 'View All Submissions', description: 'Access the main dashboard to view all employee submissions.' },
    { key: 'view_entity_management', name: 'View Entity Management', description: 'Access the HR dashboard for managing company entities.' },
    { key: 'view_field_staff_tracking', name: 'View Field Staff Tracking', description: 'Track user check-in/out locations and activity on a map.' },
    { key: 'view_invoice_summary', name: 'View Invoice Summary', description: 'View and generate monthly invoices for sites.' },
    { key: 'view_own_attendance', name: 'View Own Attendance', description: 'Allows users to see their own attendance records.' },
    { key: 'view_verification_costing', name: 'View Verification Costing', description: 'Analyze costs associated with third-party document verifications.' },
    { key: 'view_my_team', name: 'View My Team', description: 'Access the My Team page to view detailed team metrics.' },
    { key: 'view_field_reports', name: 'View Field Reports', description: 'Access and review daily reports submitted by field staff.' },
    { key: 'manage_biometric_devices', name: 'Manage Biometric Devices', description: 'Add, monitor, and remove biometric devices.' },
    { key: 'manage_geo_locations', name: 'Manage Geo Locations', description: 'Create and manage geofenced locations for attendance.' },
    { key: 'view_my_locations', name: 'View My Locations', description: 'View assigned geofenced locations for personal attendance.' },
    { key: 'view_profile', name: 'View Profile', description: 'Access personal profile and settings.' },
    { key: 'access_support_desk', name: 'Access Support Desk', description: 'Allows users to access the backend support and ticketing system.' },
    { key: 'view_mobile_nav_home', name: 'Mobile Nav: Home', description: 'Show Home tab in mobile navigation.' },
    { key: 'view_mobile_nav_attendance', name: 'Mobile Nav: Attendance', description: 'Show Attendance tab in mobile navigation.' },
    { key: 'view_mobile_nav_tasks', name: 'Mobile Nav: Tasks', description: 'Show Tasks tab in mobile navigation.' },
    { key: 'view_mobile_nav_profile', name: 'Mobile Nav: Profile', description: 'Show Profile tab in mobile navigation.' },
    { key: 'manage_finance_settings', name: 'Manage Finance Settings', description: 'Control over global finance configurations.' },
    { key: 'view_finance_reports', name: 'View Finance Reports', description: 'Access to consolidated financial reports.' },
    { key: 'view_attendance_tracker', name: 'View Site Attendance Tracker', description: 'Monitor and track site-level attendance records.' },
] as const].sort((a, b) => a.name.localeCompare(b.name));

const RoleManagement: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const { permissions, setRolePermissions, addRolePermissionEntry, removeRolePermissionEntry, renameRolePermissionEntry } = usePermissionsStore();
    const [roles, setRoles] = useState<Role[]>([]);
    const [modules, setModules] = useState<AppModule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [isNameModalOpen, setIsNameModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentRole, setCurrentRole] = useState<Role | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { isMobile, isTablet } = useDevice();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [fetchedRoles, fetchedModules] = await Promise.all([api.getRoles(), api.getModules()]);
                
                // Define the requested sort order for roles
                const roleOrder = [
                    'bd',
                    'management',
                    'admin',
                    'developer',
                    'hr',
                    'operation_manager',
                    'finance',
                    'field_staff',
                    'site_manager',
                    'unverified'
                ];

                const sortedRoles = fetchedRoles.sort((a, b) => {
                    const indexA = roleOrder.indexOf(a.id.toLowerCase());
                    const indexB = roleOrder.indexOf(b.id.toLowerCase());
                    
                    // Both roles are in our predefined list
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    // Only a is in our list
                    if (indexA !== -1) return -1;
                    // Only b is in our list
                    if (indexB !== -1) return 1;
                    // Neither are in our list, sort alphabetically
                    return a.displayName.localeCompare(b.displayName);
                });

                setRoles(sortedRoles);
                setModules(fetchedModules.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (error) {
                console.error("Failed to load data", error);
                setToast({ message: "Failed to load page data.", type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    const handlePermissionChange = async (role: UserRole, permission: Permission, checked: boolean) => {
        const currentPermissions = permissions[role] || [];
        const newPermissions = checked
            ? [...currentPermissions, permission]
            : currentPermissions.filter(p => p !== permission);
        
        // Update local store for immediate UI feedback
        setRolePermissions(role, newPermissions);

        // Persist to database
        try {
            const updatedRoles = roles.map(r => 
                r.id === role ? { ...r, permissions: newPermissions } : r
            );
            await api.saveRoles(updatedRoles);
        } catch (error) {
            console.error("Failed to sync permissions with database:", error);
            setToast({ message: "Failed to save permissions. Please try again.", type: 'error' });
        }
    };

    const handleSaveRoleName = async (newName: string) => {
        const newId = newName.toLowerCase().replace(/\s+/g, '_');

        if (isEditing && currentRole) {
            if (isAdmin(currentRole.id)) {
                setToast({ message: "The Admin role cannot be renamed.", type: 'error' });
                return;
            }
            if (roles.some(r => r.id === newId && r.id !== currentRole.id)) {
                setToast({ message: `A role with ID '${newId}' already exists.`, type: 'error' });
                return;
            }
            const updatedRoles = roles.map(r => r.id === currentRole.id ? { ...r, displayName: newName, id: newId } : r);
            await api.saveRoles(updatedRoles);
            setRoles(updatedRoles);
            renameRolePermissionEntry(currentRole.id, newId);
            setToast({ message: "Role renamed.", type: 'success' });
        } else {
            if (roles.some(r => r.id === newId)) {
                setToast({ message: `A role with ID '${newId}' already exists.`, type: 'error' });
                return;
            }
            const newRole: Role = { id: newId, displayName: newName };
            const updatedRoles = [...roles, newRole];
            await api.saveRoles(updatedRoles);
            setRoles(updatedRoles);
            addRolePermissionEntry(newRole);
            setToast({ message: "Role added successfully.", type: 'success' });
        }
    };

    const handleDeleteRole = async () => {
        if (!currentRole || isAdmin(currentRole.id)) {
            setToast({ message: "This role cannot be deleted.", type: 'error' });
            setIsDeleteModalOpen(false);
            return;
        }
        const updatedRoles = roles.filter(r => r.id !== currentRole.id);
        await api.saveRoles(updatedRoles);
        setRoles(updatedRoles);
        removeRolePermissionEntry(currentRole.id);
        setToast({ message: `Role '${currentRole.displayName}' deleted.`, type: 'success' });
        setIsDeleteModalOpen(false);
    };

    const allPermissionDetailsMap = useMemo(() => new Map(allPermissions.map(p => [p.key, p])), []);
    const unassignedPermissions = useMemo(() => {
        const assigned = new Set(modules.flatMap(m => m.permissions));
        return allPermissions.filter(p => !assigned.has(p.key));
    }, [modules]);

    const renderPermissionRow = (permInfo: { key: Permission; name: string; description: string; }) => (
        <tr key={permInfo.key}>
            <td data-label="Permission" className={`px-4 py-4 ${!isMobile ? `sticky left-0 bg-page z-20 border-r border-border shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${isTablet ? 'min-w-[160px]' : ''}` : ''}`}>
                <div className="flex flex-col items-end text-right md:items-start md:text-left">
                    <div className={`font-semibold text-primary-text break-words leading-tight ${isTablet ? 'text-xs' : 'text-sm'}`}>{permInfo.name}</div>
                    {!isTablet && <div className="text-xs text-muted">{permInfo.description}</div>}
                </div>
            </td>
            {roles.map(role => {
                // Check if the role is Admin, but explicitly exclude 'developer' so it can be managed
                const isRoleAdmin = isAdmin(role.id) && role.id.toLowerCase() !== 'developer';
                const isCurrentUserRole = user?.role === role.id;
                const isCorePermission = permInfo.key === 'manage_roles_and_permissions';
                
                const isMobileNavPermission = permInfo.key.startsWith('view_mobile_nav_');
                const isChecked = isRoleAdmin 
                    ? (isMobileNavPermission 
                        ? (permissions[role.id]?.includes(permInfo.key) ?? false)  // Check actual store for mobile nav
                        : true) // Always true for other admin perms
                    : (permissions[role.id]?.includes(permInfo.key) ?? false);

                // Admin is usually locked, EXCEPT for mobile nav permissions for actual Admin role
                // Developer is NOT locked (due to isRoleAdmin check above)
                const isAdminLocked = isRoleAdmin && !isMobileNavPermission;
                
                const isDisabled = isAdminLocked || (isCurrentUserRole && isCorePermission);
                const title = isAdminLocked 
                    ? "Admin role has all permissions by default and cannot be changed." 
                    : (isCurrentUserRole && isCorePermission) 
                        ? "You cannot disable your own access to Role Management." 
                        : "";
                return (
                    <td key={role.id} data-label={role.displayName} className={`${isTablet ? 'px-2 py-3 min-w-[96px]' : 'px-4 py-4'} text-center align-middle`}>
                        <div className="flex justify-center">
                            <label className={`relative flex items-center justify-center w-5 h-5 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input type="checkbox" className="sr-only peer" checked={isChecked} onChange={(e) => handlePermissionChange(role.id, permInfo.key, e.target.checked)} disabled={isDisabled} title={title} />
                                <span className={`w-5 h-5 bg-white border border-gray-300 rounded flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-accent-dark peer-checked:border-accent ${isDisabled ? 'opacity-50' : ''}`}>
                                    {isChecked ? <Check className="w-4 h-4 text-accent" /> : <X className="w-4 h-4 text-red-500" />}
                                </span>
                            </label>
                        </div>
                    </td>
                );
            })}
        </tr>
    );

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className={`${isTablet ? 'p-2' : 'p-4'} border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card`}>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <RoleNameModal
                isOpen={isNameModalOpen}
                onClose={() => setIsNameModalOpen(false)}
                onSave={handleSaveRoleName}
                title={isEditing ? 'Rename Role' : 'Add New Role'}
                initialName={isEditing ? currentRole?.displayName : ''}
            />
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteRole}
                title="Confirm Deletion"
            >
                Are you sure you want to delete the role "{currentRole?.displayName}"? This action cannot be undone.
            </Modal>

            <AdminPageHeader title="Role & Permission Management">
                <button onClick={() => navigate('/admin/roles/add')} className="btn btn-primary btn-md">
                    <Plus className="mr-2 h-4 w-4" /> Add Role
                </button>
            </AdminPageHeader>
            <p className="text-muted text-sm -mt-4 mb-6">
                Assign permissions to user roles. Changes are saved automatically.
            </p>

            <div className={`mb-6 p-4 bg-accent/5 dark:bg-accent/10 border border-accent/20 rounded-xl ${isTablet ? 'p-2' : ''}`}>
                <div className="flex gap-3 items-start md:items-center">
                    <ShieldCheck className={`h-5 w-5 text-accent flex-shrink-0 ${isTablet ? 'h-4 w-4' : ''} mt-0.5 md:mt-0`} />
                    <div className="text-sm">
                        <p className={`font-semibold text-primary-text ${isTablet ? 'text-xs' : ''}`}>Full Admin Access Enabled</p>
                        {!isTablet && (
                            <p className="text-muted leading-relaxed">
                                Users with the <strong>Admin</strong> or <strong>Super Admin</strong> role automatically have access to all features and pages in the system. These permissions are locked for security and cannot be disabled.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className={`overflow-x-auto ${isTablet ? 'hide-scrollbar' : ''}`}>
                <table className="min-w-full text-sm responsive-table border-separate border-spacing-0">
                    <thead className="bg-page">
                        <tr>
                            <th scope="col" className={`px-4 py-3 text-left font-bold text-primary-text ${!isMobile ? `sticky left-0 bg-page z-30 border-r border-border shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${isTablet ? 'min-w-[160px]' : ''}` : ''}`}>Permission</th>
                            {roles.map(role => (
                                <th key={role.id} scope="col" className={`py-3 text-center font-bold text-primary-text ${isTablet ? 'px-2 w-24 min-w-[96px] text-[10px]' : 'px-4 w-40 text-sm'}`}>
                                    <div className="flex flex-col items-center justify-center gap-1">
                                        <span className="leading-tight break-words whitespace-normal max-w-full">{role.displayName}</span>
                                         {!isAdmin(role.id) && (
                                            <div className="relative">
                                                <button onClick={() => setActiveDropdown(role.id === activeDropdown ? null : role.id)}>
                                                    <MoreVertical className="h-4 w-4 text-muted" />
                                                </button>
                                                {activeDropdown === role.id && (
                                                     <div ref={dropdownRef} className="absolute right-0 mt-2 w-32 bg-card border rounded-md shadow-lg z-30">
                                                        <button onClick={() => { navigate(`/admin/roles/edit/${role.id}`); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-page flex items-center"><Edit className="mr-2 h-4 w-4" />Edit</button>
                                                        <button onClick={() => { setCurrentRole(role); setIsDeleteModalOpen(true); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-page flex items-center text-red-600"><Trash2 className="mr-2 h-4 w-4" />Delete</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    {isLoading ? (
                        <tbody>
                            {isMobile
                                ? <tr><td colSpan={roles.length + 1 || 2}><TableSkeleton rows={3} cols={2} isMobile /></td></tr>
                                : <TableSkeleton rows={10} cols={roles.length + 1 || 5} />
                            }
                        </tbody>
                    ) : (
                        <>
                            {modules.map(module => (
                                <tbody key={module.id} className="divide-y divide-border">
                                    <tr className="bg-page/50">
                                        <td colSpan={roles.length + 1} className={`p-2 font-bold text-primary-text border-b border-border ${!isMobile ? 'sticky left-0 bg-page/80 backdrop-blur-sm z-10' : ''}`}>{module.name}</td>
                                    </tr>
                                    {module.permissions.map(permKey => {
                                        const permInfo = allPermissionDetailsMap.get(permKey);
                                        return permInfo ? renderPermissionRow(permInfo) : null;
                                    })}
                                </tbody>
                            ))}
                            {unassignedPermissions.length > 0 && (
                                <tbody className="divide-y divide-border">
                                    <tr className="bg-page/50">
                                        <td colSpan={roles.length + 1} className={`p-2 font-bold text-primary-text border-b border-border ${!isMobile ? 'sticky left-0 bg-page/80 backdrop-blur-sm z-10' : ''}`}>Uncategorized</td>
                                    </tr>
                                    {unassignedPermissions.map(renderPermissionRow)}
                                </tbody>
                            )}
                        </>
                    )}
                </table>
            </div>
        </div>
    );
};

export default RoleManagement;