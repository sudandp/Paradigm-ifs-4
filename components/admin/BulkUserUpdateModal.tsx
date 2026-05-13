import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';
import type { User, OrganizationGroup, Company, Entity, AttendanceSettings } from '../../types';
import { getStaffCategory } from '../../utils/attendanceCalculations';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Toast from '../ui/Toast';

interface BulkUserUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedUsers: User[];
    onSuccess: () => void;
}

const BulkUserUpdateModal: React.FC<BulkUserUpdateModalProps> = ({
    isOpen,
    onClose,
    selectedUsers,
    onSuccess
}) => {
    const [orgStructure, setOrgStructure] = useState<OrganizationGroup[]>([]);
    const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [selectedLocation, setSelectedLocation] = useState('');
    const [selectedSocietyId, setSelectedSocietyId] = useState('');
    const [selectedOrganizationId, setSelectedOrganizationId] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [structure, settings] = await Promise.all([
                api.getOrganizationStructure(),
                api.getAttendanceSettings()
            ]);
            setOrgStructure(structure);
            setAttendanceSettings(settings);
        } catch (error) {
            console.error('Failed to load data:', error);
            setToast({ message: 'Failed to load organization data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const locations = useMemo(() => {
        const uniqueLocations = new Set<string>();
        orgStructure.forEach(group => {
            group.companies.forEach(company => {
                if (company.location) uniqueLocations.add(company.location);
            });
        });
        return Array.from(uniqueLocations).sort();
    }, [orgStructure]);

    const availableSocieties = useMemo(() => {
        if (!selectedLocation) return [];
        const list: Company[] = [];
        orgStructure.forEach(group => {
            group.companies.forEach(company => {
                if (company.location === selectedLocation) {
                    list.push(company);
                }
            });
        });
        const uniqueMap = new Map();
        list.forEach(s => uniqueMap.set(s.id, s));
        return Array.from(uniqueMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [selectedLocation, orgStructure]);

    const availableEntities = useMemo(() => {
        if (!selectedSocietyId || !selectedLocation) return [];
        const list: Entity[] = [];
        orgStructure.forEach(group => {
            group.companies.forEach(company => {
                if (company.id === selectedSocietyId && company.location === selectedLocation) {
                    list.push(...company.entities);
                }
            });
        });
        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [selectedSocietyId, selectedLocation, orgStructure]);

    // Detect staff category based on first user's role and new site
    const detectedCategory = useMemo(() => {
        if (!selectedOrganizationId || selectedUsers.length === 0 || !attendanceSettings) return null;
        // Use first user as reference
        const refUser = selectedUsers[0];
        return getStaffCategory(refUser.role || '', selectedOrganizationId, attendanceSettings);
    }, [selectedOrganizationId, selectedUsers, attendanceSettings]);

    const handleUpdate = async () => {
        if (!selectedLocation || !selectedSocietyId || !selectedOrganizationId) {
            setToast({ message: 'Please select all fields.', type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            const society = availableSocieties.find(s => s.id === selectedSocietyId);
            const entity = availableEntities.find(e => e.id === selectedOrganizationId) || (selectedOrganizationId.endsWith('_head_office') ? { name: 'Head Office' } : null);
            
            let locationGroupId = '';
            for (const group of orgStructure) {
                if (group.companies.some(c => c.id === selectedSocietyId && c.location === selectedLocation)) {
                    locationGroupId = group.id;
                    break;
                }
            }

            const userIds = selectedUsers.map(u => u.id);
            
            // Clean up pseudo-IDs for Head Office to prevent DB foreign key errors
            let finalOrgId = selectedOrganizationId;
            let finalOrgName = entity?.name || 'Head Office';
            
            if (selectedOrganizationId && selectedOrganizationId.endsWith('_head_office')) {
                finalOrgId = '';
                finalOrgName = '';
            }

            await api.bulkUpdateUsers(userIds, {
                societyId: selectedSocietyId,
                societyName: society?.name,
                locationId: locationGroupId,
                organizationId: finalOrgId,
                organizationName: finalOrgName
            });

            setToast({ message: `Successfully updated ${selectedUsers.length} users.`, type: 'success' });
            setTimeout(() => {
                onSuccess();
                onClose();
                setSelectedLocation('');
                setSelectedSocietyId('');
                setSelectedOrganizationId('');
            }, 1500);
        } catch (error: any) {
            console.error('Bulk update failed:', error);
            const errorMsg = error?.message || error?.details || 'Failed to update users.';
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
                title={`Bulk Update (${selectedUsers.length} Users)`}
                onConfirm={handleUpdate}
                isConfirming={isSaving}
                confirmButtonText="Update All"
            >
                <div className="space-y-4 py-2">
                    <p className="text-sm text-muted mb-6">
                        Select the new region and company details to apply to all selected users.
                    </p>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Location (Region)</label>
                            <select
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer hover:border-slate-300"
                                value={selectedLocation}
                                onChange={(e) => {
                                    setSelectedLocation(e.target.value);
                                    setSelectedSocietyId('');
                                    setSelectedOrganizationId('');
                                }}
                                disabled={isLoading || isSaving}
                            >
                                <option value="">Select Location</option>
                                {locations.map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Society (Company)</label>
                            <select
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                value={selectedSocietyId}
                                onChange={(e) => {
                                    setSelectedSocietyId(e.target.value);
                                    setSelectedOrganizationId('');
                                }}
                                disabled={!selectedLocation || isLoading || isSaving}
                            >
                                <option value="">Select Company</option>
                                {availableSocieties.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Assigned Site (Entity)</label>
                            <select
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                value={selectedOrganizationId}
                                onChange={(e) => setSelectedOrganizationId(e.target.value)}
                                disabled={!selectedSocietyId || isLoading || isSaving}
                            >
                                <option value="">Select Site</option>
                                {selectedSocietyId && (
                                    <option value={`${selectedSocietyId}_head_office`}>Head Office</option>
                                )}
                                {availableEntities.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                        </div>

                        {detectedCategory && (
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <span className="text-xl">ℹ️</span>
                                <div>
                                    <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-tight">Staff Category Assignment</h4>
                                    <p className="text-[11px] text-indigo-800/70 mt-0.5">
                                        These users will follow the rules of:
                                    </p>
                                    <div className="mt-2">
                                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 py-1 px-2.5 rounded-md border border-indigo-200 uppercase tracking-widest">
                                            {detectedCategory} Staff
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default BulkUserUpdateModal;
