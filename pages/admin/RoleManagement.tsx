import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import type { UserRole, Permission, TaskGroup, Role } from '../../types';
import { ShieldCheck, Check, X, Loader2, Plus, MoreVertical, Edit, Trash2, Search, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { api } from '../../services/api';
import RoleNameModal from '../../components/admin/RoleNameModal';
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import { useDevice } from '../../hooks/useDevice';
import { isAdmin } from '../../utils/auth';
import LoadingScreen from '../../components/ui/LoadingScreen';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import Input from '../../components/ui/Input';

export const allPermissions: { key: Permission; name: string; description: string; category: string }[] = [
    // Dashboards
    { key: 'view_site_dashboard', name: 'Site Dashboard', description: 'View the dashboard for a specific site/organization.', category: 'Dashboards' },
    { key: 'view_operations_dashboard', name: 'Operations Dashboard', description: 'View the operations management dashboard.', category: 'Dashboards' },
    { key: 'view_all_submissions', name: 'View All Submissions', description: 'Access the main dashboard to view all employee submissions.', category: 'Dashboards' },

    // Attendance Logs
    { key: 'view_own_attendance', name: 'View Own Attendance', description: 'Allows users to see their own attendance records.', category: 'Attendance Logs' },
    { key: 'view_all_attendance', name: 'View All Attendance', description: 'Allows users to see attendance records for all employees.', category: 'Attendance Logs' },
    { key: 'view_attendance_tracker', name: 'View Site Attendance Tracker', description: 'Monitor and track site-level attendance records.', category: 'Attendance Logs' },
    { key: 'download_attendance_report', name: 'Download Attendance Report', description: 'Generate and download attendance reports in CSV format.', category: 'Attendance Logs' },

    // Real-time Tracking
    { key: 'view_field_staff_tracking', name: 'View Field Staff Tracking', description: 'Track user check-in/out locations and activity on a map.', category: 'Real-time Tracking' },

    // Leaves & Rules
    { key: 'apply_for_leave', name: 'Apply for Leave', description: 'Allows users to request time off.', category: 'Leaves & Rules' },
    { key: 'manage_leave_requests', name: 'Manage Leave Requests', description: 'Approve or reject leave requests for employees.', category: 'Leaves & Rules' },
    { key: 'manage_approval_workflow', name: 'Manage Approval Workflow', description: 'Set up reporting managers for leave approvals.', category: 'Leaves & Rules' },
    { key: 'manage_attendance_rules', name: 'Manage Attendance Rules', description: 'Set work hours, holidays, and leave allocations.', category: 'Leaves & Rules' },

    // Employee Onboarding
    { key: 'create_enrollment', name: 'Create Enrollment', description: 'Access the multi-step form to onboard new employees.', category: 'Employee Onboarding' },
    { key: 'manage_enrollment_rules', name: 'Manage Enrollment Rules', description: 'Set rules for ESI/GMC, manpower limits, and documents.', category: 'Employee Onboarding' },
    { key: 'manage_attendance_rules', name: 'Attendance Rules (Onboarding)', description: 'Settings specifically for onboarding flow rules.', category: 'Employee Onboarding' },

    // Site Management
    { key: 'manage_sites', name: 'Manage Sites', description: 'Create, edit, and delete organizations/sites.', category: 'Site Management' },
    { key: 'view_entity_management', name: 'Client Management', description: 'Access the HR dashboard for managing company entities.', category: 'Site Management' },
    { key: 'view_my_locations', name: 'View My Locations', description: 'View assigned geofenced locations for personal attendance.', category: 'Site Management' },
    { key: 'manage_geo_locations', name: 'Manage Geo Locations', description: 'Create and manage geofenced locations for attendance.', category: 'Site Management' },

    // Operations & Team
    { key: 'manage_tasks', name: 'Manage Tasks', description: 'Create, assign, and manage all organizational tasks, including escalations.', category: 'Operations & Team' },
    { key: 'view_field_reports', name: 'View Field Reports', description: 'Access and review daily reports submitted by field staff.', category: 'Operations & Team' },
    { key: 'view_my_team', name: 'View My Team', description: 'Access the My Team page to view detailed team metrics.', category: 'Operations & Team' },

    // Uniforms & Kit
    { key: 'manage_uniforms', name: 'Manage Uniforms', description: 'Manage uniform requests and site configurations.', category: 'Uniforms & Kit' },

    // Policies & Compliance
    { key: 'manage_policies', name: 'Manage Policies', description: 'Create and manage company policies.', category: 'Policies & Compliance' },
    { key: 'manage_insurance', name: 'Manage Insurance', description: 'Create and manage company insurance plans.', category: 'Policies & Compliance' },

    // Finance & Invoicing
    { key: 'view_invoice_summary', name: 'View Invoice Summary', description: 'View and generate monthly invoices for sites.', category: 'Finance & Invoicing' },
    { key: 'manage_finance_settings', name: 'Manage Finance Settings', description: 'Control over global finance configurations.', category: 'Finance & Invoicing' },
    { key: 'view_finance_reports', name: 'View Finance Reports', description: 'Access to consolidated financial reports.', category: 'Finance & Invoicing' },

    // Audit & Costing
    { key: 'view_verification_costing', name: 'View Verification Costing', description: 'Analyze costs associated with third-party document verifications.', category: 'Audit & Costing' },

    // Biometric Devices
    { key: 'manage_biometric_devices', name: 'Manage Biometric Devices', description: 'Add, monitor, and remove biometric devices.', category: 'Biometric Devices' },

    // Security & Roles
    { key: 'manage_users', name: 'Manage Users', description: 'Create, edit, and delete user accounts.', category: 'Security & Roles' },
    { key: 'manage_roles_and_permissions', name: 'Manage Roles & Permissions', description: 'Access this page to edit role permissions.', category: 'Security & Roles' },
    { key: 'manage_modules', name: 'Manage Access Tasks', description: 'Create, edit, and group permissions into access task groups.', category: 'Security & Roles' },

    // System Config
    { key: 'view_developer_settings', name: 'Developer Settings', description: 'Access API settings and other developer tools.', category: 'System Config' },

    // Support & Profile
    { key: 'view_profile', name: 'View Profile', description: 'Access personal profile and settings.', category: 'Support & Profile' },
    { key: 'access_support_desk', name: 'Access Support Desk', description: 'Allows users to access the backend support and ticketing system.', category: 'Support & Profile' },
    { key: 'view_mobile_nav_home', name: 'Mobile Nav: Home', description: 'Show Home tab in mobile navigation.', category: 'Support & Profile' },
    { key: 'view_mobile_nav_attendance', name: 'Mobile Nav: Attendance', description: 'Show Attendance tab in mobile navigation.', category: 'Support & Profile' },
    { key: 'view_mobile_nav_tasks', name: 'Mobile Nav: Tasks', description: 'Show Tasks tab in mobile navigation.', category: 'Support & Profile' },
    { key: 'view_mobile_nav_profile', name: 'Mobile Nav: Profile', description: 'Show Profile tab in mobile navigation.', category: 'Support & Profile' },
];

const RoleManagement: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const { permissions, setRolePermissions, addRolePermissionEntry, removeRolePermissionEntry, renameRolePermissionEntry } = usePermissionsStore();
    const [roles, setRoles] = useState<Role[]>([]);
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [isNameModalOpen, setIsNameModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    
    const [currentRole, setCurrentRole] = useState<Role | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCloning, setIsCloning] = useState(false);
    const [roleToClone, setRoleToClone] = useState<Role | null>(null);

    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [roleSearchQuery, setRoleSearchQuery] = useState('');
    const [permissionSearchQuery, setPermissionSearchQuery] = useState('');
    
    const [expandedTaskGroups, setExpandedTaskGroups] = useState<Record<string, boolean>>({});
    
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { isMobile, isTablet } = useDevice();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [fetchedRoles, fetchedTaskGroups] = await Promise.all([api.getRoles(), api.getTaskGroups()]);
                
                const roleOrder = [
                    'bd', 'management', 'admin', 'developer', 'hr', 'operation_manager', 
                    'finance', 'field_staff', 'site_manager', 'unverified'
                ];

                const sortedRoles = fetchedRoles.sort((a, b) => {
                    const indexA = roleOrder.indexOf(a.id.toLowerCase());
                    const indexB = roleOrder.indexOf(b.id.toLowerCase());
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return a.displayName.localeCompare(b.displayName);
                });

                setRoles(sortedRoles);
                if (sortedRoles.length > 0) setSelectedRoleId(sortedRoles[0].id);

                const sortedTaskGroups = fetchedTaskGroups.sort((a, b) => a.name.localeCompare(b.name));
                setTaskGroups(sortedTaskGroups);
                
                // Open first task group by default
                if (sortedTaskGroups.length > 0) {
                    setExpandedTaskGroups({ [sortedTaskGroups[0].id]: true });
                }
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

    const selectedRole = useMemo(() => roles.find(r => r.id === selectedRoleId) || null, [roles, selectedRoleId]);

    const handlePermissionChange = async (roleId: UserRole, permission: Permission, checked: boolean) => {
        if (!roles.some(r => r.id === roleId)) return; // Prevents saving if role removed
        setIsSaving(true);
        const currentPermissions = permissions[roleId] || [];
        const newPermissions = checked
            ? [...currentPermissions, permission]
            : currentPermissions.filter(p => p !== permission);
        
        setRolePermissions(roleId, newPermissions);

        try {
            const updatedRoles = roles.map(r => 
                r.id === roleId ? { ...r, permissions: newPermissions } : r
            );
            await api.saveRoles(updatedRoles);
            setRoles(updatedRoles);
        } catch (error) {
            console.error("Failed to sync permissions:", error);
            setToast({ message: "Failed to save permissions. Please try again.", type: 'error' });
            // Revert changes on failure
            setRolePermissions(roleId, currentPermissions);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleModulePermissions = async (roleId: UserRole, modulePerms: Permission[], checkAll: boolean) => {
        setIsSaving(true);
        const currentPermissions = permissions[roleId] || [];
        let newPermissions = [...currentPermissions];

        if (checkAll) {
            modulePerms.forEach(p => {
                if (!newPermissions.includes(p)) newPermissions.push(p);
            });
        } else {
            newPermissions = currentPermissions.filter(p => !modulePerms.includes(p));
        }

        setRolePermissions(roleId, newPermissions);
        try {
            const updatedRoles = roles.map(r => r.id === roleId ? { ...r, permissions: newPermissions } : r);
            await api.saveRoles(updatedRoles);
            setRoles(updatedRoles);
        } catch (error) {
            setToast({ message: "Failed to save permissions.", type: 'error' });
            setRolePermissions(roleId, currentPermissions);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveRoleName = async (newName: string) => {
        const newId = newName.toLowerCase().replace(/\s+/g, '_');

        if (isCloning && roleToClone) {
            if (roles.some(r => r.id === newId)) {
                setToast({ message: `A role with ID '${newId}' already exists.`, type: 'error' });
                return;
            }
            const sourcePerms = permissions[roleToClone.id] || [];
            const newRole: Role = { id: newId, displayName: newName, permissions: sourcePerms };
            const updatedRoles = [...roles, newRole];
            
            await api.saveRoles(updatedRoles);
            setRoles(updatedRoles);
            addRolePermissionEntry(newRole);
            setRolePermissions(newId, sourcePerms);
            setSelectedRoleId(newId);
            setToast({ message: "Role cloned successfully.", type: 'success' });
            
        } else if (isEditing && currentRole) {
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
            if (selectedRoleId === currentRole.id) setSelectedRoleId(newId);
            setToast({ message: "Role renamed.", type: 'success' });
        } else {
            if (roles.some(r => r.id === newId)) {
                setToast({ message: `A role with ID '${newId}' already exists.`, type: 'error' });
                return;
            }
            const newRole: Role = { id: newId, displayName: newName, permissions: [] };
            const updatedRoles = [...roles, newRole];
            await api.saveRoles(updatedRoles);
            setRoles(updatedRoles);
            addRolePermissionEntry(newRole);
            setSelectedRoleId(newId);
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
        if (selectedRoleId === currentRole.id && updatedRoles.length > 0) {
            setSelectedRoleId(updatedRoles[0].id);
        } else if (updatedRoles.length === 0) {
            setSelectedRoleId(null);
        }
        setToast({ message: `Role '${currentRole.displayName}' deleted.`, type: 'success' });
        setIsDeleteModalOpen(false);
    };

    const toggleTaskGroup = (moduleId: string) => {
        setExpandedTaskGroups(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
    };

    const allPermissionDetailsMap = useMemo(() => new Map(allPermissions.map(p => [p.key, p])), []);
    const unassignedPermissions = useMemo(() => {
        const assigned = new Set(taskGroups.flatMap(m => m.permissions));
        return allPermissions.filter(p => !assigned.has(p.key));
    }, [taskGroups]);
    
    const filteredRoles = useMemo(() => {
        if (!roleSearchQuery) return roles;
        return roles.filter(r => r.displayName.toLowerCase().includes(roleSearchQuery.toLowerCase()));
    }, [roles, roleSearchQuery]);

    const groupedPermissions = useMemo(() => {
        const groups: Record<string, typeof allPermissions> = {};
        allPermissions.forEach(perm => {
            if (!groups[perm.category]) groups[perm.category] = [];
            groups[perm.category].push(perm);
        });
        
        // Filter groups based on search query
        if (permissionSearchQuery) {
            const query = permissionSearchQuery.toLowerCase();
            const filteredGroups: Record<string, typeof allPermissions> = {};
            Object.entries(groups).forEach(([category, perms]) => {
                const matched = perms.filter(p => 
                    p.name.toLowerCase().includes(query) || 
                    p.description.toLowerCase().includes(query)
                );
                if (matched.length > 0) filteredGroups[category] = matched;
            });
            return filteredGroups;
        }
        
        return groups;
    }, [permissionSearchQuery]);

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-4 border-0 shadow-none lg:bg-card lg:p-6 lg:rounded-xl lg:shadow-card flex-1 flex flex-col">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <RoleNameModal
                isOpen={isNameModalOpen}
                onClose={() => { setIsNameModalOpen(false); setIsCloning(false); }}
                onSave={handleSaveRoleName}
                title={isCloning ? 'Clone Role' : isEditing ? 'Rename Role' : 'Add New Role'}
                initialName={isCloning && roleToClone ? `${roleToClone.displayName} Copy` : isEditing ? currentRole?.displayName : ''}
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
                {!isMobile && <div className="text-sm text-muted">Manage roles and their access levels</div>}
            </AdminPageHeader>

            <div className="flex-1 flex flex-col md:flex-row gap-5 mt-3">
                {/* Left Sidebar - Roles */}
                <div className="w-full md:w-72 lg:w-80 flex-shrink-0 border border-border bg-card rounded-xl flex flex-col overflow-hidden shadow-sm">
                    {/* Sidebar Header */}
                    <div className="px-4 py-3 border-b border-border bg-page/40">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-accent" />
                                <span className="text-base font-bold text-primary-text uppercase tracking-tight">Roles</span>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-accent text-white shadow-sm">{filteredRoles.length}</span>
                            </div>
                            <button 
                                onClick={() => { setIsEditing(false); setIsCloning(false); setCurrentRole(null); setIsNameModalOpen(true); }} 
                                className="btn btn-primary btn-sm flex-shrink-0 h-7 px-3 gap-1 text-xs"
                                title="Add Role"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">New Role</span>
                            </button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                            <Input
                                type="text"
                                placeholder="Search roles..."
                                value={roleSearchQuery}
                                onChange={(e) => setRoleSearchQuery(e.target.value)}
                                className="pl-8 h-8 text-xs bg-card"
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {filteredRoles.map(role => {
                            const rolePermCount = (permissions[role.id] || []).length;
                            return (
                                <div 
                                    key={role.id}
                                    onClick={() => setSelectedRoleId(role.id)}
                                    className={`group flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-all ${
                                        selectedRoleId === role.id 
                                            ? 'bg-accent/10 text-accent font-semibold ring-1 ring-accent/20 shadow-sm' 
                                            : 'hover:bg-page text-primary-text'
                                    }`}
                                >
                                    <div className="flex flex-col min-w-0">
                                        <span className="truncate text-base font-semibold leading-snug tracking-tight">{role.displayName}</span>
                                        {!isAdmin(role.id) && (
                                            <span className={`text-[11px] mt-0.5 font-bold uppercase tracking-tight ${
                                                selectedRoleId === role.id ? 'text-accent/80' : 'text-muted'
                                            }`}>{rolePermCount} permissions</span>
                                        )}
                                    </div>
                                    
                                    <div className="relative flex items-center flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                                        {isAdmin(role.id) ? (
                                            <ShieldCheck className={`w-4 h-4 ${selectedRoleId === role.id ? 'text-accent' : 'text-accent/50 group-hover:text-accent'}`} />
                                        ) : (
                                            <>
                                                <button 
                                                    onClick={() => setActiveDropdown(activeDropdown === role.id ? null : role.id)}
                                                    className={`p-1.5 rounded-md hover:bg-card border border-transparent opacity-0 group-hover:opacity-100 transition-opacity ${
                                                        activeDropdown === role.id ? 'opacity-100 bg-card border-border shadow-sm' : ''
                                                    } ${selectedRoleId === role.id ? 'text-accent' : 'text-muted'}`}
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                
                                                {activeDropdown === role.id && (
                                                    <div ref={dropdownRef} className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                                                        <button onClick={() => { setIsEditing(true); setIsCloning(false); setCurrentRole(role); setIsNameModalOpen(true); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-page flex items-center text-primary-text"><Edit className="mr-2 h-4 w-4" />Rename</button>
                                                        <button onClick={() => { setIsEditing(false); setIsCloning(true); setRoleToClone(role); setIsNameModalOpen(true); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-page flex items-center text-primary-text"><Copy className="mr-2 h-4 w-4" />Clone</button>
                                                        <div className="h-px w-full bg-border my-1"></div>
                                                        <button onClick={() => { setCurrentRole(role); setIsDeleteModalOpen(true); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-page flex items-center text-red-600"><Trash2 className="mr-2 h-4 w-4" />Delete</button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content - Permissions Editor */}
                <div className="flex-1 w-full flex flex-col bg-card border border-border rounded-xl relative overflow-hidden">
                    {selectedRole ? (
                        <>
                            {/* Permissions Panel Header */}
                            <div className="px-6 py-4 border-b border-border bg-card flex flex-col space-y-3 shadow-sm z-10 flex-shrink-0">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-accent/10">
                                            <ShieldCheck className="w-5 h-5 text-accent" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-primary-text flex items-center gap-2">
                                                {selectedRole.displayName}
                                                <span className="text-base font-bold text-muted/60 uppercase tracking-widest">Permissions</span>
                                            </h2>
                                            <p className="text-sm font-medium text-muted mt-1">Configure what users with this role can access.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {isSaving ? (
                                            <div className="flex items-center text-xs font-semibold text-accent bg-accent/5 px-3 py-1.5 rounded-full border border-accent/20 animate-pulse">
                                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                                            </div>
                                        ) : (
                                            <div className="hidden md:flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                                                <Check className="w-3.5 h-3.5 mr-1.5" /> Auto-saved
                                            </div>
                                        )}
                                        <div className="relative w-56">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                                            <Input
                                                type="text"
                                                placeholder="Search permissions..."
                                                value={permissionSearchQuery}
                                                onChange={(e) => setPermissionSearchQuery(e.target.value)}
                                                className="pl-9 bg-page text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {isAdmin(selectedRole.id) && selectedRole.id.toLowerCase() !== 'developer' ? (
                                    <div className="p-3 bg-accent/5 border border-accent/15 rounded-lg flex items-center gap-3">
                                        <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0" />
                                        <span className="text-xs text-muted">
                                            <strong className="text-primary-text">Admin Access Locked — </strong>
                                            Super-user role with automatic full access. Permissions cannot be modified.
                                        </span>
                                    </div>
                                ) : null}
                            </div>

                            <div className="p-4 md:p-6 space-y-4 bg-page flex-1 overflow-y-auto">
                                {Object.entries(groupedPermissions).map(([category, perms]) => {
                                    const isExpanded = expandedTaskGroups[category] || permissionSearchQuery.length > 0;
                                    const rolePerms = permissions[selectedRole.id] || [];
                                    const checkedCount = perms.filter(p => {
                                        const isRoleAdmin = isAdmin(selectedRole.id) && selectedRole.id.toLowerCase() !== 'developer';
                                        const isMobileNavAuth = p.key.startsWith('view_mobile_nav_');
                                        return isRoleAdmin ? (isMobileNavAuth ? rolePerms.includes(p.key) : true) : rolePerms.includes(p.key);
                                    }).length;
                                    
                                    const isAllChecked = checkedCount === perms.length;
                                    const isIndeterminate = checkedCount > 0 && checkedCount < perms.length;
                                    const isRoleAdmin = isAdmin(selectedRole.id) && selectedRole.id.toLowerCase() !== 'developer';

                                    return (
                                        <div key={category} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden transform transition-all hover:border-border/80">
                                            <div 
                                                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-page transition-colors select-none"
                                                onClick={() => toggleTaskGroup(category)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-accent/10 text-accent' : 'bg-page text-muted'}`}>
                                                        {isExpanded ? <ChevronDown className="w-4 h-4 transition-transform" /> : <ChevronRight className="w-4 h-4 transition-transform" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-primary-text text-base md:text-lg leading-tight tracking-tight">{category}</h3>
                                                        <p className="text-sm font-medium text-muted mt-0.5">{perms.length} Permissions available</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-page border border-border text-muted hidden sm:inline-block">
                                                        {checkedCount} / {perms.length} Enabled
                                                    </span>
                                                    
                                                    {/* Module select all toggle */}
                                                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                                                        <label className={`relative flex items-center justify-center cursor-pointer ${isRoleAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only"
                                                                disabled={isRoleAdmin}
                                                                checked={isAllChecked}
                                                                onChange={(e) => {
                                                                    const allKeys = perms.map(p => p.key);
                                                                    handleToggleModulePermissions(selectedRole.id, allKeys, e.target.checked);
                                                                }}
                                                            />
                                                            <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${
                                                                isAllChecked ? 'bg-accent border-accent text-white' : 
                                                                isIndeterminate ? 'bg-accent border-accent text-white' : 'bg-white border-gray-300'
                                                            }`}>
                                                                {isAllChecked && <Check className="w-3.5 h-3.5" />}
                                                                {isIndeterminate && !isAllChecked && <div className="w-2.5 h-0.5 bg-white rounded-full" />}
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="px-5 pb-5 pt-3 border-t border-border bg-page/30 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                                                    {perms.map(permInfo => {
                                                        const permKey = permInfo.key;
                                                        const isRoleAdmin = isAdmin(selectedRole.id) && selectedRole.id.toLowerCase() !== 'developer';
                                                        const isCurrentUserRole = user?.role === selectedRole.id;
                                                        const isCorePermission = permKey === 'manage_roles_and_permissions';
                                                        const isMobileNavPermission = permKey.startsWith('view_mobile_nav_');
                                                        
                                                        const isChecked = isRoleAdmin 
                                                            ? (isMobileNavPermission ? (rolePerms.includes(permKey) ?? false) : true) 
                                                            : (rolePerms.includes(permKey) ?? false);
                                                            
                                                        const isAdminLocked = isRoleAdmin && !isMobileNavPermission;
                                                        const isDisabled = isAdminLocked || (isCurrentUserRole && isCorePermission);

                                                        return (
                                                            <div key={permKey} className="flex flex-col py-2 border-b border-border/40 last:border-0 lg:border-b-0 hover:bg-white/60 rounded-lg p-2 -mx-1 transition-colors duration-150">
                                                                <ToggleSwitch
                                                                    id={`perm-${permKey}`}
                                                                    label={permInfo.name}
                                                                    description={permInfo.description}
                                                                    checked={isChecked}
                                                                    onChange={(checked) => handlePermissionChange(selectedRole.id, permKey, checked)}
                                                                    disabled={isDisabled}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-20 h-20 rounded-2xl bg-accent/5 border-2 border-dashed border-accent/20 flex items-center justify-center mb-5">
                                <ShieldCheck className="w-9 h-9 text-accent/30" />
                            </div>
                            <h3 className="text-lg font-bold text-primary-text mb-2">No Role Selected</h3>
                            <p className="max-w-xs text-sm text-muted leading-relaxed">Pick a role from the sidebar to view and configure its access permissions.</p>
                            <button
                                onClick={() => { setIsEditing(false); setIsCloning(false); setCurrentRole(null); setIsNameModalOpen(true); }}
                                className="mt-5 btn btn-primary btn-sm gap-1.5"
                            >
                                <Plus className="h-3.5 w-3.5" /> Create New Role
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoleManagement;