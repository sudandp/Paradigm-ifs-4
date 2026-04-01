const fs = require('fs');

const targetFile = 'e:/backup/onboarding all files/Paradigm Office 4/pages/admin/RoleManagement.tsx';
const originalContent = fs.readFileSync(targetFile, 'utf8');

const importReplacement = `import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import type { UserRole, Permission, AppModule, Role } from '../../types';
import { ShieldCheck, Check, X, Loader2, Plus, MoreVertical, Edit, Trash2, Search, Copy, ChevronDown, ChevronRight, Save } from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { api } from '../../services/api';
import RoleNameModal from '../../components/admin/RoleNameModal';
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import { useDevice } from '../../hooks/useDevice';
import { isAdmin } from '../../utils/auth';
import LoadingScreen from '../../components/ui/LoadingScreen';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import Input from '../../components/ui/Input';`;

const componentContent = `
const RoleManagement: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const { permissions, setRolePermissions, addRolePermissionEntry, removeRolePermissionEntry, renameRolePermissionEntry } = usePermissionsStore();
    const [roles, setRoles] = useState<Role[]>([]);
    const [modules, setModules] = useState<AppModule[]>([]);
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
    
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { isMobile, isTablet } = useDevice();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [fetchedRoles, fetchedModules] = await Promise.all([api.getRoles(), api.getModules()]);
                
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

                const sortedModules = fetchedModules.sort((a, b) => a.name.localeCompare(b.name));
                setModules(sortedModules);
                
                // Open first module by default
                if (sortedModules.length > 0) {
                    setExpandedModules({ [sortedModules[0].id]: true });
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
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveRoleName = async (newName: string) => {
        const newId = newName.toLowerCase().replace(/\\s+/g, '_');

        if (isCloning && roleToClone) {
            if (roles.some(r => r.id === newId)) {
                setToast({ message: \`A role with ID '\${newId}' already exists.\`, type: 'error' });
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
                setToast({ message: \`A role with ID '\${newId}' already exists.\`, type: 'error' });
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
                setToast({ message: \`A role with ID '\${newId}' already exists.\`, type: 'error' });
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
        }
        setToast({ message: \`Role '\${currentRole.displayName}' deleted.\`, type: 'success' });
        setIsDeleteModalOpen(false);
    };

    const toggleModule = (moduleId: string) => {
        setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
    };

    const allPermissionDetailsMap = useMemo(() => new Map(allPermissions.map(p => [p.key, p])), []);
    const unassignedPermissions = useMemo(() => {
        const assigned = new Set(modules.flatMap(m => m.permissions));
        return allPermissions.filter(p => !assigned.has(p.key));
    }, [modules]);
    
    const filteredRoles = useMemo(() => {
        if (!roleSearchQuery) return roles;
        return roles.filter(r => r.displayName.toLowerCase().includes(roleSearchQuery.toLowerCase()));
    }, [roles, roleSearchQuery]);

    const filteredModules = useMemo(() => {
        if (!permissionSearchQuery) return modules;
        return modules.map(m => {
            const matchedPerms = m.permissions.filter(p => {
                const info = allPermissionDetailsMap.get(p);
                return info && (info.name.toLowerCase().includes(permissionSearchQuery.toLowerCase()) || 
                                info.description.toLowerCase().includes(permissionSearchQuery.toLowerCase()));
            });
            return { ...m, permissions: matchedPerms };
        }).filter(m => m.permissions.length > 0);
    }, [modules, permissionSearchQuery, allPermissionDetailsMap]);

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="h-[calc(100vh-80px)] md:h-[calc(100vh-96px)] flex flex-col bg-page !m-0 !p-0">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <RoleNameModal
                isOpen={isNameModalOpen}
                onClose={() => { setIsNameModalOpen(false); setIsCloning(false); }}
                onSave={handleSaveRoleName}
                title={isCloning ? 'Clone Role' : isEditing ? 'Rename Role' : 'Add New Role'}
                initialName={isCloning && roleToClone ? \`\${roleToClone.displayName} Copy\` : isEditing ? currentRole?.displayName : ''}
            />
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteRole}
                title="Confirm Deletion"
            >
                Are you sure you want to delete the role "{currentRole?.displayName}"? This action cannot be undone.
            </Modal>

            <div className="flex px-4 md:px-6 py-4 border-b border-border items-center justify-between bg-card flex-shrink-0">
                <AdminPageHeader title="Role & Permission Management" subtitle="Manage roles and their access levels" />
            </div>

            <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
                {/* Left Sidebar - Roles */}
                <div className="w-full md:w-80 flex-shrink-0 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col h-[40vh] md:h-full">
                    <div className="p-4 border-b border-border space-y-4">
                        <button 
                            onClick={() => { setIsEditing(false); setIsCloning(false); setCurrentRole(null); setIsNameModalOpen(true); }} 
                            className="btn btn-primary w-full justify-center"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add Role
                        </button>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                            <Input
                                type="text"
                                placeholder="Search roles..."
                                value={roleSearchQuery}
                                onChange={(e) => setRoleSearchQuery(e.target.value)}
                                className="pl-9 bg-page"
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredRoles.map(role => (
                            <div 
                                key={role.id}
                                onClick={() => setSelectedRoleId(role.id)}
                                className={\`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors \${selectedRoleId === role.id ? 'bg-accent/10 text-accent font-medium' : 'hover:bg-page text-primary-text'}\`}
                            >
                                <span className="truncate pr-2">{role.displayName}</span>
                                
                                <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
                                    {isAdmin(role.id) ? (
                                        <ShieldCheck className="w-4 h-4 text-accent/50 group-hover:text-accent mr-1" />
                                    ) : (
                                        <>
                                            <button 
                                                onClick={() => setActiveDropdown(activeDropdown === role.id ? null : role.id)}
                                                className={\`p-1.5 rounded-md hover:bg-card border border-transparent \${activeDropdown === role.id ? 'bg-card border-border shadow-sm' : ''} \${selectedRoleId === role.id ? 'text-accent' : 'text-muted'}\`}
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
                        ))}
                    </div>
                </div>

                {/* Main Content - Permissions Editor */}
                <div className="flex-1 flex flex-col bg-page h-[60vh] md:h-full overflow-hidden relative">
                    {selectedRole ? (
                        <>
                            <div className="p-4 md:p-6 border-b border-border bg-card flex flex-col space-y-4 shadow-sm z-10 flex-shrink-0">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-primary-text">{selectedRole.displayName} Permissions</h2>
                                        <p className="text-sm text-muted mt-1">Configure what users with this role can access.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {isSaving && (
                                            <div className="flex items-center text-sm text-muted animate-pulse">
                                                <Save className="w-4 h-4 mr-1.5" /> Saving...
                                            </div>
                                        )}
                                        <div className="relative w-full md:w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                                            <Input
                                                type="text"
                                                placeholder="Search permissions..."
                                                value={permissionSearchQuery}
                                                onChange={(e) => setPermissionSearchQuery(e.target.value)}
                                                className="pl-9 bg-page"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {isAdmin(selectedRole.id) && selectedRole.id.toLowerCase() !== 'developer' && (
                                    <div className="p-3 bg-accent/5 dark:bg-accent/10 border border-accent/20 rounded-lg flex items-start gap-3">
                                        <ShieldCheck className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                                        <div className="text-sm">
                                            <strong className="text-primary-text block mb-1">Admin Access Locked</strong>
                                            <span className="text-muted">The Admin role represents super-user access and automatically inherits all system permissions. This cannot be modified.</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-page">
                                {filteredModules.map(module => {
                                    const isExpanded = expandedModules[module.id] || permissionSearchQuery.length > 0;
                                    const modulePermissions = module.permissions;
                                    const rolePerms = permissions[selectedRole.id] || [];
                                    const checkedCount = modulePermissions.filter(p => {
                                        const isRoleAdmin = isAdmin(selectedRole.id) && selectedRole.id.toLowerCase() !== 'developer';
                                        const isMobileNavAuth = p.startsWith('view_mobile_nav_');
                                        return isRoleAdmin ? (isMobileNavAuth ? rolePerms.includes(p) : true) : rolePerms.includes(p);
                                    }).length;
                                    
                                    const isAllChecked = checkedCount === modulePermissions.length;
                                    const isIndeterminate = checkedCount > 0 && checkedCount < modulePermissions.length;
                                    const isRoleAdmin = isAdmin(selectedRole.id) && selectedRole.id.toLowerCase() !== 'developer';

                                    return (
                                        <div key={module.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                                            <div 
                                                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-page transition-colors select-none"
                                                onClick={() => toggleModule(module.id)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={\`p-1.5 rounded-lg \${isExpanded ? 'bg-accent/10 text-accent' : 'bg-page text-muted'}\`}>
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-primary-text">{module.name}</h3>
                                                        <p className="text-xs text-muted truncate max-w-sm md:max-w-md mt-0.5">{module.description}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-page border border-border text-muted hidden sm:inline-block">
                                                        {checkedCount} / {modulePermissions.length} Enabled
                                                    </span>
                                                    
                                                    {/* Module select all toggle */}
                                                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                                                        <label className={\`relative inline-flex items-center \${isRoleAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}\`}>
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only peer" 
                                                                disabled={isRoleAdmin}
                                                                checked={isAllChecked}
                                                                onChange={(e) => handleToggleModulePermissions(selectedRole.id, modulePermissions, e.target.checked)}
                                                            />
                                                            <div className={\`w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-accent-dark \${isAllChecked || isIndeterminate ? 'bg-accent' : ''} after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white\`}>
                                                                {isIndeterminate && !isAllChecked && (
                                                                     <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-0.5 bg-white rounded-full transition-opacity z-10" />
                                                                )}
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="px-5 pb-5 pt-2 border-t border-border bg-page/30 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                                    {modulePermissions.map(permKey => {
                                                        const permInfo = allPermissionDetailsMap.get(permKey);
                                                        if (!permInfo) return null;

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
                                                            <div key={permKey} className="flex flex-col py-2 border-b border-border/50 md:border-b-0">
                                                                <ToggleSwitch
                                                                    id={\`perm-\${permKey}\`}
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

                                {unassignedPermissions.length > 0 && !permissionSearchQuery && (
                                   <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6">
                                        <div className="px-5 py-4 flex items-center gap-3 border-b border-border bg-page/50">
                                            <h3 className="font-semibold text-primary-text">Uncategorized Permissions</h3>
                                        </div>
                                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                            {unassignedPermissions.map(permInfo => {
                                                const isRoleAdmin = isAdmin(selectedRole.id) && selectedRole.id.toLowerCase() !== 'developer';
                                                const isCurrentUserRole = user?.role === selectedRole.id;
                                                const isCorePermission = permInfo.key === 'manage_roles_and_permissions';
                                                const isMobileNavPermission = permInfo.key.startsWith('view_mobile_nav_');
                                                
                                                const isChecked = isRoleAdmin 
                                                    ? (isMobileNavPermission ? (permissions[selectedRole.id]?.includes(permInfo.key) ?? false) : true) 
                                                    : (permissions[selectedRole.id]?.includes(permInfo.key) ?? false);
                                                    
                                                const isAdminLocked = isRoleAdmin && !isMobileNavPermission;
                                                const isDisabled = isAdminLocked || (isCurrentUserRole && isCorePermission);

                                                return (
                                                    <div key={permInfo.key} className="flex flex-col py-2 border-b border-border/50 md:border-b-0">
                                                        <ToggleSwitch
                                                            id={\`perm-\${permInfo.key}\`}
                                                            label={permInfo.name}
                                                            description={permInfo.description}
                                                            checked={isChecked}
                                                            onChange={(checked) => handlePermissionChange(selectedRole.id, permInfo.key, checked)}
                                                            disabled={isDisabled}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                   </div>
                                )}
                            </div>
                        </>
                    ) : (
                         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted">
                            <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
                            <h3 className="text-lg font-medium text-primary-text mb-2">No Role Selected</h3>
                            <p className="max-w-md">Select a role from the sidebar to view and edit its permissions, or create a new role to get started.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoleManagement;
`;

// Extract imports definition block from original file (lines 1 to 16 approximately)
const originalFileLines = originalContent.split('\\n');
const importEndIndex = originalFileLines.findIndex(line => line.includes('export const allPermissions'));

const exportAllPermissionsBlockIndex = originalFileLines.findIndex(line => line.includes('export const allPermissions'));
const componentStartIndex = originalFileLines.findIndex(line => line.startsWith('const RoleManagement: React.FC = () => {'));

if (exportAllPermissionsBlockIndex !== -1 && componentStartIndex !== -1) {
    const permissionsBlock = originalFileLines.slice(exportAllPermissionsBlockIndex, componentStartIndex).join('\\n');
    const newContent = importReplacement + '\\n\\n' + permissionsBlock + componentContent;
    fs.writeFileSync(targetFile, newContent);
    console.log("Rewrote RoleManagement.tsx successfully");
} else {
    console.log("Failed to find index points.");
}
