import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { Role, Permission } from '../../types';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Input from '../../components/ui/Input';
import { Shield } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePermissionsStore } from '../../store/permissionsStore';
import { allPermissions } from '../admin/RoleManagement';


const AddRolePage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = !!id;
    const isMobile = useMediaQuery('(max-width: 767px)');
    const { permissions: rolePermissions, setRolePermissions, addRolePermissionEntry } = usePermissionsStore();

    const [name, setName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (isEditing && id) {
                    const roles = await api.getRoles();
                    const role = roles.find(r => r.id === id);
                    if (role) {
                        setName(role.id);
                        setDisplayName(role.displayName);
                        // Get permissions from store
                        const currentPermissions = rolePermissions[role.id] || [];
                        setSelectedPermissions(currentPermissions);
                    }
                }
            } catch (error) {
                setToast({ message: 'Failed to load data.', type: 'error' });
            }
        };
        fetchData();
    }, [id, isEditing, rolePermissions]);

    const handlePermissionToggle = (permissionKey: Permission) => {
        setSelectedPermissions(prev =>
            prev.includes(permissionKey)
                ? prev.filter(p => p !== permissionKey)
                : [...prev, permissionKey]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !displayName.trim()) return;

        setIsSubmitting(true);
        try {
            const roleId = isEditing ? name : name.toLowerCase().replace(/\s+/g, '_');
            const newRole: Role = { id: roleId, displayName: displayName.trim() };

            // Save role to backend
            // Note: In a real app, we should fetch existing roles first to append, or use an upsert that handles single items if supported.
            // api.saveRoles expects an array of all roles.
            const existingRoles = await api.getRoles();
            let updatedRoles = [...existingRoles];

            if (isEditing) {
                updatedRoles = updatedRoles.map(r => r.id === roleId ? newRole : r);
            } else {
                if (existingRoles.some(r => r.id === roleId)) {
                    setToast({ message: 'Role ID already exists.', type: 'error' });
                    setIsSubmitting(false);
                    return;
                }
                updatedRoles.push(newRole);
            }

            await api.saveRoles(updatedRoles);

            // Update permissions in store
            setRolePermissions(roleId, selectedPermissions);
            if (!isEditing) {
                addRolePermissionEntry(newRole);
            }

            setToast({ message: `Role ${isEditing ? 'updated' : 'created'} successfully!`, type: 'success' });
            setTimeout(() => navigate('/admin/roles'), 1500);
        } catch (error) {
            setToast({ message: 'Failed to save role. Please try again.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isMobile) {
        return (
            <div className="h-full flex flex-col">
                <header className="p-4 flex-shrink-0 fo-mobile-header">
                    <h1>{isEditing ? 'Edit Role' : 'Add Role'}</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="bg-card rounded-2xl p-6 space-y-6">
                        <div className="text-center">
                            <div className="inline-block bg-accent-light p-3 rounded-full mb-2">
                                <Shield className="h-8 w-8 text-accent-dark" />
                            </div>
                            <h2 className="text-xl font-bold text-primary-text">{isEditing ? 'Edit Role' : 'Add New Role'}</h2>
                            <p className="text-sm text-gray-400">Define role permissions and access control.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="Role ID"
                                id="roleId"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. admin, hr, field_staff"
                                required
                                disabled={isSubmitting || isEditing}
                            />

                            <Input
                                label="Display Name"
                                id="displayName"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                placeholder="e.g. Admin, HR, Field Staff"
                                required
                                disabled={isSubmitting}
                            />

                            <div>
                                <label className="block text-sm font-medium text-muted mb-2">
                                    Permissions
                                </label>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {allPermissions.map(permission => (
                                        <label key={permission.key} className="flex items-center gap-2 p-2 rounded hover:bg-page cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedPermissions.includes(permission.key)}
                                                onChange={() => handlePermissionToggle(permission.key)}
                                                className="form-checkbox"
                                                disabled={isSubmitting}
                                            />
                                            <span className="text-sm">{permission.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </form>
                    </div>
                </main>
                <footer className="p-4 flex-shrink-0 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/roles')}
                        disabled={isSubmitting}
                        className="fo-btn-secondary px-6"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !name.trim() || !displayName.trim()}
                        className="fo-btn-primary flex-1"
                    >
                        {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Role'}
                    </button>
                </footer>
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6">
            <div className="bg-card p-8 rounded-xl shadow-card w-full">
                <div className="flex items-center mb-6">
                    <div className="bg-accent-light p-3 rounded-full mr-4">
                        <Shield className="h-8 w-8 text-accent-dark" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-primary-text">{isEditing ? 'Edit Role' : 'Add New Role'}</h2>
                        <p className="text-muted">Define role permissions and access control.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="Role ID"
                        id="roleId"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. admin, hr, field_staff"
                        required
                        disabled={isSubmitting || isEditing}
                    />

                    <Input
                        label="Display Name"
                        id="displayName"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder="e.g. Admin, HR, Field Staff"
                        required
                        disabled={isSubmitting}
                    />

                    <div>
                        <label className="block text-sm font-medium text-muted mb-2">
                            Permissions ({selectedPermissions.length} selected)
                        </label>
                        <div className="border border-border rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto">
                            {allPermissions.map(permission => (
                                <label key={permission.key} className="flex items-center gap-3 p-2 rounded hover:bg-page cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedPermissions.includes(permission.key)}
                                        onChange={() => handlePermissionToggle(permission.key)}
                                        className="form-checkbox"
                                        disabled={isSubmitting}
                                    />
                                    <div>
                                        <div className="text-sm font-medium">{permission.name}</div>
                                        {permission.description && (
                                            <div className="text-xs text-muted">{permission.description}</div>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t flex justify-end gap-3">
                        <Button
                            type="button"
                            onClick={() => navigate('/admin/roles')}
                            variant="secondary"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} disabled={!name.trim() || !displayName.trim()}>
                            {isEditing ? 'Save Changes' : 'Create Role'}
                        </Button>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default AddRolePage;
