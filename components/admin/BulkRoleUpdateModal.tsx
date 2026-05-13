import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';
import type { User, Role } from '../../types';
import Modal from '../ui/Modal';
import Toast from '../ui/Toast';
import { ShieldCheck } from 'lucide-react';

interface BulkRoleUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedUsers: User[];
    onSuccess: () => void;
}

const BulkRoleUpdateModal: React.FC<BulkRoleUpdateModalProps> = ({
    isOpen,
    onClose,
    selectedUsers,
    onSuccess
}) => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadRoles();
        }
    }, [isOpen]);

    const loadRoles = async () => {
        setIsLoading(true);
        try {
            const [systemRoles, designations] = await Promise.all([
                api.getRoles(),
                api.getSiteStaffDesignations()
            ]);

            // Merge system roles with site staff designations (matches AttendanceSettings.tsx logic)
            const merged: Role[] = [...systemRoles];
            designations.forEach(desig => {
                if (!desig.designation) return;
                const slug = desig.designation.toLowerCase().replace(/\s+/g, '_');
                // Only add if it doesn't already exist as a role ID
                if (!merged.some(r => r.id === slug)) {
                    merged.push({
                        id: slug,
                        displayName: desig.designation
                    });
                }
            });

            // Sort roles A-Z
            const sortedRoles = merged.sort((a, b) => 
                (a.displayName || a.id).localeCompare(b.displayName || b.id)
            );
            setRoles(sortedRoles);
        } catch (error) {
            console.error('Failed to load roles:', error);
            setToast({ message: 'Failed to load roles.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedRoleId) {
            setToast({ message: 'Please select a role.', type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            // Ensure the role entry exists in the database with Technician permissions
            const roleObj = roles.find(r => r.id === selectedRoleId);
            if (roleObj) {
                await api.ensureRoleExists(roleObj.id, roleObj.displayName || roleObj.id);
            }

            const userIds = selectedUsers.map(u => u.id);
            await api.bulkUpdateUsers(userIds, {
                role: selectedRoleId
            });

            setToast({ message: `Successfully updated roles for ${selectedUsers.length} users.`, type: 'success' });
            setTimeout(() => {
                onSuccess();
                onClose();
                setSelectedRoleId('');
            }, 1500);
        } catch (error: any) {
            console.error('Bulk role update failed:', error);
            const errorMsg = error?.message || error?.details || 'Failed to update roles.';
            setToast({ message: errorMsg, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={`Update Role (${selectedUsers.length} Users)`}
                onConfirm={handleUpdate}
                isConfirming={isSaving}
                confirmButtonText="Apply Role"
            >
                <div className="space-y-4 py-2">
                    <p className="text-sm text-muted mb-6">
                        Select a new role to apply to all selected employees. This will update their permissions immediately.
                    </p>

                    <div>
                        <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">New Role Assignment</label>
                        <select
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer hover:border-slate-300 disabled:opacity-50"
                            value={selectedRoleId}
                            onChange={(e) => setSelectedRoleId(e.target.value)}
                            disabled={isLoading || isSaving}
                        >
                            <option value="">Select a Role</option>
                            {roles.map(role => (
                                <option key={role.id} value={role.id}>
                                    {role.displayName || role.id}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3 mt-4">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-tight">Warning</h4>
                            <p className="text-[11px] text-amber-800/70 mt-0.5">
                                Changing roles in bulk will override current permission levels. Ensure the selected employees are eligible for the new role.
                            </p>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default BulkRoleUpdateModal;
