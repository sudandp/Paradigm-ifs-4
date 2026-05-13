
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { User, OrganizationGroup, Role } from '../../types';
import { ShieldCheck, Plus, Edit, Trash2, Info, UserCheck, MapPin, Search, Filter, FilterX, FileSpreadsheet, X, RotateCw, Copy, Check, Clock } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import ApprovalModal from '../../components/admin/ApprovalModal';
import LocationAssignmentModal from '../../components/admin/LocationAssignmentModal';
import BulkUserUpdateModal from '../../components/admin/BulkUserUpdateModal';
import BulkRoleUpdateModal from '../../components/admin/BulkRoleUpdateModal';
import Pagination from '../../components/ui/Pagination';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { CheckSquare, Square } from 'lucide-react';


// Helper for role names
const getRoleName = (role: string) => {
    return role ? role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A';
}

const getRoleBadgeClass = (role: string) => {
    switch (role) {
        case 'admin': return 'bg-purple-100 text-purple-700';
        case 'hr': return 'bg-blue-100 text-blue-700';
        case 'management': return 'bg-emerald-100 text-emerald-700';
        case 'site_manager': return 'bg-orange-100 text-orange-800';
        case 'field_staff': return 'bg-sky-100 text-sky-800';
        case 'finance': return 'bg-teal-100 text-teal-700';
        case 'developer': return 'bg-indigo-100 text-indigo-700';
        case 'operation_manager': return 'bg-rose-100 text-rose-700';
        case 'unverified': return 'bg-yellow-100 text-yellow-800';
        case 'kiosk': return 'bg-cyan-100 text-cyan-700';
        case 'gate_only': return 'bg-blue-100 text-blue-700';
        default: return 'bg-slate-100 text-slate-700';
    }
};

interface UserActionProps {
    user: User;
    isSelected: boolean;
    onSelect: (userId: string) => void;
    handleApprove: (u: User) => void;
    handleEdit: (u: User) => void;
    handleManageLocations: (u: User) => void;
    handleResetPasscode: (u: User) => void;
    handleDelete: (u: User) => void;
}

// Memoized Row for performance
const UserRow = React.memo(({ 
    user, isSelected, onSelect, handleApprove, handleEdit, handleManageLocations, handleResetPasscode, handleDelete, orgStructure 
}: UserActionProps & { orgStructure: OrganizationGroup[] }) => {
    const resolveLocation = () => {
        if (user.location || user.locationName) return user.location || user.locationName;
        if (!user.societyId || orgStructure.length === 0) return '-';

        for (const group of orgStructure) {
            for (const company of group.companies) {
                if (company.id === user.societyId) {
                    return company.location || '-';
                }
            }
        }
        return '-';
    };

    return (
        <tr className={`hover:bg-slate-50 transition-colors border-b border-slate-100 ${isSelected ? 'bg-emerald-50/50' : ''}`}>
            <td className="px-6 py-4 whitespace-nowrap">
                <button 
                    onClick={() => onSelect(user.id)}
                    className={`transition-colors ${isSelected ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-400'}`}
                >
                    {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                </button>
            </td>
            <td data-label="Name" className="px-6 py-4 font-semibold text-base">{user.name}</td>
            <td data-label="Email" className="px-6 py-4 text-sm text-muted">{user.email}</td>
            <td data-label="Role" className="px-6 py-4 text-sm text-muted min-w-[160px]">
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${getRoleBadgeClass(user.role)}`}>
                    {getRoleName(user.role)}
                </span>
                {user.role === 'unverified' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 ml-2 uppercase tracking-tight">Pending Approval</span>
                )}
                {user.role === 'gate_only' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 ml-2 uppercase tracking-tight">Gate Only</span>
                )}
            </td>
            <td data-label="Company" className="px-6 py-4 text-base text-primary-text font-medium">
                {user.societyName || '-'}
            </td>
            <td data-label="Location" className="px-6 py-4 text-base text-primary-text font-medium">
                {resolveLocation()}
            </td>
            <td data-label="Biometric ID" className="px-6 py-4 text-base font-mono text-muted/80">
                {user.biometricId || '-'}
            </td>
            <td data-label="Actions" className="px-6 py-3">
                <div className="flex items-center gap-4 md:justify-start justify-end">
                    {(user.role === 'unverified' || user.role === 'gate_only') && (
                        <button 
                            onClick={() => handleApprove(user)} 
                            aria-label={`Approve ${user.name}`} 
                            title={`Approve ${user.name}`} 
                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:scale-110 transition-all flex items-center gap-1.5"
                        >
                            <UserCheck className="h-5 w-5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Approve</span>
                        </button>
                    )}
                    <button 
                        onClick={() => handleEdit(user)} 
                        aria-label={`Edit ${user.name}`} 
                        title={`Edit ${user.name}`} 
                        className="p-1 text-slate-500 hover:text-slate-700 hover:scale-110 transition-all"
                    >
                        <Edit className="h-5 w-5" />
                    </button>
                    <button 
                        onClick={() => handleManageLocations(user)} 
                        aria-label={`Geofencing ${user.name}`} 
                        title={`Geofencing ${user.name}`} 
                        className="p-1 text-emerald-500 hover:text-emerald-700 hover:scale-110 transition-all"
                    >
                        <MapPin className="h-5 w-5" />
                    </button>
                    <button 
                        onClick={() => handleResetPasscode(user)} 
                        aria-label={`Reset ${user.name}`} 
                        title={`Reset ${user.name}`} 
                        className="p-1 text-amber-500 hover:text-amber-700 hover:scale-110 transition-all"
                    >
                        <RotateCw className="h-5 w-5" />
                    </button>
                    <button 
                        onClick={() => handleDelete(user)} 
                        aria-label={`Delete ${user.name}`} 
                        title={`Delete ${user.name}`} 
                        className="p-1 text-red-500 hover:text-red-700 hover:scale-110 transition-all"
                    >
                        <Trash2 className="h-5 w-5" />
                    </button>
                </div>
            </td>
        </tr>
    );
});

// Memoized Card for Mobile view performance
const UserCard = React.memo(({ 
    user, isSelected, onSelect, handleApprove, handleEdit, handleManageLocations, handleResetPasscode, handleDelete, orgStructure 
}: UserActionProps & { orgStructure: OrganizationGroup[] }) => {
    const resolveLocation = () => {
        if (user.location || user.locationName) return user.location || user.locationName;
        if (!user.societyId || orgStructure.length === 0) return '-';

        for (const group of orgStructure) {
            for (const company of group.companies) {
                if (company.id === user.societyId) {
                    return company.location || '-';
                }
            }
        }
        return '-';
    };

    return (
        <div className={`bg-card p-4 rounded-xl border shadow-sm flex flex-col gap-3 h-full transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50/5 ring-1 ring-emerald-500' : 'border-border'}`}>
            <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                    <button 
                        onClick={() => onSelect(user.id)}
                        className={`mt-1 transition-colors ${isSelected ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                    </button>
                    <div>
                        <h3 className="font-semibold text-primary-text">{user.name}</h3>
                        <p className="text-sm text-muted">{user.email}</p>
                    </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRoleBadgeClass(user.role)}`}>
                    {getRoleName(user.role)}
                </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm mt-1 flex-grow">
                <div>
                    <span className="text-xs text-muted block">Company</span>
                    <span className="font-medium text-primary-text truncate block">{user.societyName || '-'}</span>
                </div>
                <div>
                    <span className="text-xs text-muted block">Location</span>
                    <span className="font-medium text-primary-text truncate block">{resolveLocation()}</span>
                </div>
                <div>
                    <span className="text-xs text-muted block">Biometric ID</span>
                    <span className="font-mono text-primary-text truncate block">{user.biometricId || '-'}</span>
                </div>
            </div>

            <div className="user-card-actions pt-4 mt-auto border-t border-white/5 flex items-center gap-3 px-2">
                <button 
                    onClick={() => handleEdit(user)} 
                    className="p-2.5 rounded-xl !bg-white/5 !border !border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-90 flex-shrink-0"
                    aria-label="Edit"
                >
                    <Edit className="h-4 w-4" />
                </button>
                <button 
                    onClick={() => handleManageLocations(user)} 
                    className="p-2.5 rounded-xl !bg-emerald-500/10 !border !border-emerald-500/20 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-90 flex-shrink-0"
                    aria-label="Geofencing"
                >
                    <MapPin className="h-4 w-4" />
                </button>
                <button 
                    onClick={() => handleResetPasscode(user)} 
                    className="p-2.5 rounded-xl !bg-amber-500/10 !border !border-amber-500/20 text-amber-500 hover:text-amber-400 hover:bg-amber-500/20 transition-all active:scale-90 flex-shrink-0"
                    aria-label="Reset"
                >
                    <RotateCw className="h-4 w-4" />
                </button>
                
                {(user.role === 'unverified' || user.role === 'gate_only') && (
                    <button 
                        onClick={() => handleApprove(user)} 
                        className="px-4 py-2.5 rounded-xl !bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-2 flex-shrink-0"
                    >
                        <UserCheck className="h-3 w-3" />
                        <span>Approve</span>
                    </button>
                )}
                
                <div className="flex-1" />

                <button 
                    onClick={() => handleDelete(user)} 
                    className="p-2.5 rounded-xl !bg-red-500/10 !border !border-red-500/20 text-red-500 hover:text-red-400 hover:bg-red-500/20 transition-all active:scale-90 flex-shrink-0"
                    aria-label="Delete"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
});

const UserManagement: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [fetchedAllFiltered, setFetchedAllFiltered] = useState(false);

    // Column filters as a single state object
    const [pendingFilters, setPendingFilters] = useState({
        company: 'all',
        site: 'all',
        role: 'all',
        location: '',
        status: 'all',
        employee: ''
    });

    const [activeFilters, setActiveFilters] = useState({
        company: 'all',
        site: 'all',
        role: 'all',
        location: '',
        status: 'all',
        employee: ''
    });

    const isFiltersDirty = useMemo(() => {
        return pendingFilters.company !== activeFilters.company ||
               pendingFilters.site !== activeFilters.site ||
               pendingFilters.role !== activeFilters.role ||
               pendingFilters.location !== activeFilters.location ||
               pendingFilters.status !== activeFilters.status ||
               pendingFilters.employee !== activeFilters.employee;
    }, [pendingFilters, activeFilters]);

    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
    const [recoveryPasscode, setRecoveryPasscode] = useState('');
    const [recoveryCountdown, setRecoveryCountdown] = useState(0);
    const [isCopied, setIsCopied] = useState(false);

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentUserForLocation, setCurrentUserForLocation] = useState<User | null>(null);
    const [orgStructure, setOrgStructure] = useState<OrganizationGroup[]>([]);
    const [allRoles, setAllRoles] = useState<Role[]>([]);
    const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
    const [isBulkRoleUpdateOpen, setIsBulkRoleUpdateOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    // Global click listener to close context menu
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent) => {
        if (selectedUserIds.length > 0) {
            e.preventDefault();
            // Ensure menu stays within viewport
            const x = Math.min(e.clientX, window.innerWidth - 220);
            const y = Math.min(e.clientY, window.innerHeight - 150);
            setContextMenu({ x, y });
        }
    };

    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const isMobile = useMediaQuery('(max-width: 767px)');

    const hasActiveFilters = useMemo(() => 
        activeFilters.company !== 'all' || 
        activeFilters.site !== 'all' || 
        activeFilters.role !== 'all' || 
        activeFilters.location !== '' || 
        activeFilters.status !== 'all' ||
        activeFilters.employee !== '',
        [activeFilters]
    );

    const allCompanies = useMemo(() => {
        const companies: any[] = [];
        orgStructure.forEach(group => {
            if (group.companies) {
                companies.push(...group.companies);
            }
        });
        return companies;
    }, [orgStructure]);

    const allLocations = useMemo(() => {
        const locations = new Set<string>();
        allCompanies.forEach(c => {
            if (c.location) locations.add(c.location);
        });
        users.forEach(u => {
            if (u.location) locations.add(u.location);
            if (u.locationName) locations.add(u.locationName);
        });
        return Array.from(locations).sort();
    }, [allCompanies, users]);

    const allSites = useMemo(() => {
        const sites: any[] = [];
        allCompanies.forEach(company => {
            if (company.entities) {
                sites.push(...company.entities);
            }
        });
        return sites;
    }, [allCompanies]);

    const filteredSites = useMemo(() => {
        if (pendingFilters.company === 'all') return allSites;
        return allSites.filter(site => site.companyId === pendingFilters.company);
    }, [allSites, pendingFilters.company]);

    const fetchUsers = useCallback(async () => {
        // Only show full-page skeleton if we have no users yet
        const shouldShowSkeleton = users.length === 0;
        if (shouldShowSkeleton) setIsLoading(true);
        
        try {
            // Fetch structure if not already fetched
            if (orgStructure.length === 0) {
                const structure = await api.getOrganizationStructure();
                setOrgStructure(structure);
            }

            // Fetch all roles if not already fetched
            if (allRoles.length === 0) {
                const roles = await api.getRoles();
                setAllRoles(roles);
            }

            if (hasActiveFilters) {
                // If we've already fetched all users for filtering, don't fetch again
                if (fetchedAllFiltered) return;

                const allUsers = await api.getUsers();
                setUsers(allUsers);
                setTotalUsers(allUsers.length);
                setFetchedAllFiltered(true);
            } else {
                const res = await api.getUsers({ 
                    page: currentPage, 
                    pageSize,
                    sortBy: 'name',
                    sortAscending: true
                });
                setUsers(res.data);
                setTotalUsers(res.total);
                // Reset this when going back to server-side pagination
                setFetchedAllFiltered(false);
            }
        } catch (error) {
            setToast({ message: 'Failed to fetch users.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, pageSize, hasActiveFilters, fetchedAllFiltered, users.length]);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, activeFilters]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Recovery Modal Countdown Logic
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isRecoveryModalOpen && recoveryCountdown > 0) {
            timer = setTimeout(() => {
                setRecoveryCountdown(prev => prev - 1);
            }, 1000);
        } else if (recoveryCountdown === 0 && isRecoveryModalOpen) {
            setIsRecoveryModalOpen(false);
            setRecoveryPasscode('');
        }
        return () => clearTimeout(timer);
    }, [isRecoveryModalOpen, recoveryCountdown]);

    const handleAdd = () => {
        navigate('/admin/users/add');
    };

    const handleEdit = useCallback((user: User) => {
        navigate(`/admin/users/edit/${user.id}`);
    }, [navigate]);

    const handleApprove = useCallback((user: User) => {
        setCurrentUser(user);
        setIsApprovalModalOpen(true);
    }, []);

    const handleDelete = useCallback((user: User) => {
        setCurrentUser(user);
        setIsDeleteModalOpen(true);
    }, []);

    const handleManageLocations = useCallback((user: User) => {
        setCurrentUserForLocation(user);
        setIsLocationModalOpen(true);
    }, []);

    const handleResetPasscode = useCallback((user: User) => {
        setCurrentUser(user);
        setIsResetModalOpen(true);
    }, []);

    const handleConfirmApproval = async (userId: string, newRole: string) => {
        setIsSaving(true);
        try {
            await api.approveUser(userId, newRole);
            setToast({ message: 'User approved and email confirmed successfully!', type: 'success' });
            setIsApprovalModalOpen(false);
            
            // Instant UI Update: Update the user in local state
            setUsers(prevUsers => 
                prevUsers.map(u => u.id === userId ? { ...u, role: newRole } : u)
            );
            
            // Still background fetch to be safe/sync with server specialized fields if any
            fetchUsers();
        } catch (error) {
            setToast({ message: 'Failed to approve user.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmReset = async () => {
        if (currentUser) {
            setIsSaving(true);
            try {
                const newCode = await api.resetUserPasscode(currentUser.id);
                setRecoveryPasscode(newCode);
                setRecoveryCountdown(30);
                setIsRecoveryModalOpen(true);
                setIsResetModalOpen(false);
                
                // Still background fetch to be safe
                fetchUsers();
            } catch (error) {
                setToast({ message: 'Failed to reset passcode.', type: 'error' });
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleConfirmDelete = async () => {
        if (currentUser) {
            const userIdToDelete = currentUser.id;
            setIsSaving(true);
            try {
                await api.deleteUser(userIdToDelete);
                setToast({ message: 'User deleted. Remember to also remove them from Supabase Auth.', type: 'success' });
                setIsDeleteModalOpen(false);
                
                // Instant UI Update: Remove from local state
                setUsers(prevUsers => prevUsers.filter(u => u.id !== userIdToDelete));
                
                // Background fetch to sync
                fetchUsers();
            } catch (error) {
                setToast({ message: 'Failed to delete user.', type: 'error' });
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleApplyFilters = () => {
        setActiveFilters(pendingFilters);
    };

    const clearAllFilters = () => {
        const defaultFilters = {
            company: 'all',
            site: 'all',
            role: 'all',
            location: '',
            status: 'all',
            employee: ''
        };
        setPendingFilters(defaultFilters);
        setActiveFilters(defaultFilters);
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setPendingFilters(prev => {
            const next = { ...prev, [name]: value };
            // Reset site if company changes
            if (name === 'company') {
                next.site = 'all';
            }
            return next;
        });
    };

    const toggleUserSelection = (userId: string) => {
        setSelectedUserIds(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId) 
                : [...prev, userId]
        );
    };

    const toggleAllSelection = () => {
        if (selectedUserIds.length === filteredUsers.length) {
            setSelectedUserIds([]);
        } else {
            setSelectedUserIds(filteredUsers.map(u => u.id));
        }
    };

    // Derive unique roles from the fetched global roles list
    const sortedRoles = useMemo(() => {
        return [...allRoles].sort((a, b) => 
            (a.displayName || a.id).localeCompare(b.displayName || b.id)
        );
    }, [allRoles]);

    const uniqueRoles = useMemo(() => {
        if (allRoles.length > 0) {
            return allRoles.map(r => r.displayName || r.id).sort();
        }
        // Fallback to current users if roles list is empty for some reason
        return Array.from(new Set(users.map(u => u.role).filter(Boolean))).sort();
    }, [allRoles, users]);

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            // Hide kiosk service accounts from normal admin view unless searching/filtering
            if (user.role === 'kiosk' && !hasActiveFilters) return false;
            
            if (activeFilters.company !== 'all' && user.organizationId !== activeFilters.company) return false;
            if (activeFilters.site !== 'all' && user.societyId !== activeFilters.site) return false;
            if (activeFilters.role !== 'all' && user.roleId !== activeFilters.role && user.role !== activeFilters.role) return false;
            if (activeFilters.location && (user.location || user.locationName || '').toLowerCase() !== activeFilters.location.toLowerCase()) return false;
            
            if (activeFilters.status !== 'all') {
                if (activeFilters.status === 'pending' && user.role !== 'unverified') return false;
                if (activeFilters.status === 'gate' && user.role !== 'gate_only') return false;
                if (activeFilters.status === 'active' && user.role === 'unverified') return false;
            }

            if (activeFilters.employee && !user.name?.toLowerCase().includes(activeFilters.employee.toLowerCase()) && !user.email?.toLowerCase().includes(activeFilters.employee.toLowerCase())) return false;
            
            return true;
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [users, activeFilters, hasActiveFilters]);

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-4 border-0 shadow-none lg:bg-card lg:p-6 lg:rounded-xl lg:shadow-card flex-1 flex flex-col">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <ApprovalModal
                isOpen={isApprovalModalOpen}
                onClose={() => setIsApprovalModalOpen(false)}
                onApprove={handleConfirmApproval}
                user={currentUser}
                isConfirming={isSaving}
            />

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
                isConfirming={isSaving}
            >
                Are you sure you want to delete the user "{currentUser?.name}"? This action cannot be undone.
            </Modal>

            <Modal
                isOpen={isResetModalOpen}
                onClose={() => setIsResetModalOpen(false)}
                onConfirm={handleConfirmReset}
                title="Reset Passcode"
                isConfirming={isSaving}
                confirmButtonText="Reset to Default"
                confirmButtonVariant="primary"
            >
                Are you sure you want to reset the passcode for "{currentUser?.name}"? It will be set back to the default system passcode.
            </Modal>

            <LocationAssignmentModal
                isOpen={isLocationModalOpen}
                onClose={() => setIsLocationModalOpen(false)}
                userId={currentUserForLocation?.id || ''}
                userName={currentUserForLocation?.name || ''}
            />

            <Modal
                isOpen={isRecoveryModalOpen}
                onClose={() => setIsRecoveryModalOpen(false)}
                title="Passcode Recovery"
                footer={
                    <div className="flex justify-center w-full">
                        <Button
                            onClick={() => setIsRecoveryModalOpen(false)}
                            variant="primary"
                            className="!px-12"
                        >
                            Done
                        </Button>
                    </div>
                }
            >
                <div className="text-center py-4">
                    <p className="text-sm text-muted mb-4 uppercase tracking-widest font-bold">New Passcode Generated</p>
                    
                    <div className="relative group max-w-[200px] mx-auto">
                        <div className="text-4xl font-black text-primary tracking-[0.5em] pl-[0.5em] bg-primary/5 py-4 rounded-xl border-2 border-primary/20 animate-in zoom-in duration-300">
                            {recoveryPasscode}
                        </div>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(recoveryPasscode);
                                setIsCopied(true);
                                setTimeout(() => setIsCopied(false), 2000);
                            }}
                            className="absolute -top-2 -right-2 bg-white shadow-md border border-border p-2 rounded-lg hover:scale-110 active:scale-95 transition-all text-primary"
                            title="Copy to clipboard"
                        >
                            {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                    </div>

                    <div className="mt-8 space-y-3">
                        <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 py-2 px-4 rounded-full w-fit mx-auto border border-amber-100">
                            <Clock className="h-4 w-4 animate-pulse" />
                            <span className="text-sm font-bold">Expires in {recoveryCountdown}s</span>
                        </div>
                        <p className="text-[11px] text-muted italic">
                            For security, this code will be hidden once the timer reaches zero.
                        </p>
                    </div>
                </div>
            </Modal>

            <AdminPageHeader title="User Management">
                <div className="flex gap-2 items-center">
                    {selectedUserIds.length > 0 && (
                        <div className="flex items-center gap-2 mr-4 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{selectedUserIds.length} Selected</span>
                            <Button 
                                size="sm"
                                className="!bg-emerald-500 !text-white !py-1 !px-3 !text-[10px] !rounded-md"
                                onClick={() => setIsBulkUpdateOpen(true)}
                            >
                                Bulk Update
                            </Button>
                        </div>
                    )}
                    <Button variant="outline" onClick={() => navigate('/admin/users/bulk-update-leaves')}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Bulk Update Leaves
                    </Button>
                    <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" /> Add User</Button>
                </div>
            </AdminPageHeader>

            <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-sm">
                <div className="flex items-start">
                    <Info className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold">Adding New Users</h4>
                        <p className="mt-1">
                            Use the <strong>Add User</strong> button below to create a new user. Provide their name, email, role and a temporary password. The system will automatically provision their login, send them a verification email and create their profile.
                        </p>
                    </div>
                </div>
            </div>

            {/* Premium Filters Section - Matching Attendance Dashboard */}
            <div className="bg-transparent md:bg-white p-0 md:p-4 rounded-xl shadow-none md:shadow-sm border-none md:border md:border-gray-100 mb-6 flex flex-col gap-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:flex xl:flex-wrap items-end gap-x-3 gap-y-4">
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                        <div className="relative">
                            <select
                                name="location"
                                className="w-full border border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none shadow-sm transition-all"
                                value={pendingFilters.location}
                                onChange={handleFilterChange}
                            >
                                <option value="">All Locations</option>
                                {allLocations.map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <Filter className="h-3.5 w-3.5 opacity-50" />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
                        <div className="relative">
                            <select
                                name="company"
                                className="w-full border border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none shadow-sm transition-all"
                                value={pendingFilters.company}
                                onChange={handleFilterChange}
                            >
                                <option value="all">All Companies</option>
                                {allCompanies.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <Filter className="h-3.5 w-3.5 opacity-50" />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Site</label>
                        <div className="relative">
                            <select
                                name="site"
                                className="w-full border border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none shadow-sm transition-all"
                                value={pendingFilters.site}
                                onChange={handleFilterChange}
                            >
                                <option value="all">All Sites</option>
                                {filteredSites.map(soc => (
                                    <option key={soc.id} value={soc.id}>{soc.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <Filter className="h-3.5 w-3.5 opacity-50" />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                        <div className="relative">
                            <select
                                name="role"
                                className="w-full border border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none shadow-sm transition-all"
                                value={pendingFilters.role}
                                onChange={handleFilterChange}
                            >
                                <option value="all">All Roles</option>
                                {sortedRoles.map(role => (
                                    <option key={role.id} value={role.id}>{role.displayName || role.id}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <Filter className="h-3.5 w-3.5 opacity-50" />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Approval Status</label>
                        <div className="relative">
                            <select
                                name="status"
                                className="w-full border border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none shadow-sm transition-all"
                                value={pendingFilters.status}
                                onChange={handleFilterChange}
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="pending">Pending Approval</option>
                                <option value="gate">Gate Only</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <Filter className="h-3.5 w-3.5 opacity-50" />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Employee / Email</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                name="employee"
                                type="text"
                                placeholder="Search name or email..."
                                value={pendingFilters.employee}
                                onChange={handleFilterChange}
                                className="w-full pl-9 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="col-span-2 md:col-span-1 xl:ml-auto">
                        <Button
                            onClick={handleApplyFilters}
                            className={`w-full text-white shadow-lg flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all duration-300 ${
                                isFiltersDirty 
                                    ? "bg-rose-600 hover:bg-rose-700 animate-pulse" 
                                    : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            Apply Filters
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {isLoading && users.length === 0 ? (
                <div className="w-full">
                    {/* Desktop Skeleton */}
                    <div className="hidden lg:block">
                        <TableSkeleton rows={5} cols={6} />
                    </div>
                    {/* Mobile/Tablet Skeleton */}
                    <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
                       {[1, 2, 3, 4].map(i => (
                           <div key={i} className="bg-card p-4 rounded-xl border border-border h-40 animate-pulse"></div>
                       ))}
                    </div>
                </div>
            ) : (
                <>
                    {/* Mobile/Tablet View - Cards Grid */}
                    <div className="lg:hidden">
                        {/* Mobile view now uses the same top filters, so we can remove these local ones */}


                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredUsers.map((user) => (
                                <UserCard 
                                    key={user.id} 
                                    user={user} 
                                    isSelected={selectedUserIds.includes(user.id)}
                                    onSelect={toggleUserSelection}
                                    orgStructure={orgStructure}
                                    handleApprove={handleApprove}
                                    handleEdit={handleEdit}
                                    handleManageLocations={handleManageLocations}
                                    handleResetPasscode={handleResetPasscode}
                                    handleDelete={handleDelete}
                                />
                            ))}
                            {filteredUsers.length === 0 && (
                                <div className="col-span-full text-center py-8 text-muted">
                                    No users found{hasActiveFilters ? ' matching the current filters' : ''}.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop View - Table */}
                    <div className="hidden lg:block overflow-x-auto max-w-full relative">
                        {/* Subtle loading indicator that doesn't block interactions */}
                        {isLoading && (
                            <div className="absolute top-0 right-0 p-1">
                                <span className="animate-pulse text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">AUTO-REFRESHING...</span>
                            </div>
                        )}
                        <table className="w-full table-auto responsive-table">
                            <thead>
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left">
                                        <button 
                                            onClick={toggleAllSelection}
                                            className={`transition-colors ${selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0 ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-400'}`}
                                            title="Select All Visible"
                                        >
                                            {selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0 ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                        </button>
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-muted uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-muted uppercase tracking-wider">Email</th>
                                    <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-muted uppercase tracking-wider min-w-[170px]">Role</th>
                                    <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-muted uppercase tracking-wider">Company</th>
                                    <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-muted uppercase tracking-wider">Location</th>
                                    <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-muted uppercase tracking-wider">Biometric ID</th>
                                    <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-muted uppercase tracking-wider">
                                        <div className="flex items-center gap-2">
                                            Actions
                                            {hasActiveFilters && (
                                                <button onClick={clearAllFilters} className="text-red-500 hover:text-red-700 transition-colors" title="Clear all filters">
                                                    <FilterX className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                </tr>
                                {/* Filter row removed in favor of top-level premium filters */}

                            </thead>
                            <tbody 
                                className="divide-y divide-border md:bg-card md:divide-y-0"
                                onContextMenu={handleContextMenu}
                            >
                                {filteredUsers.map((user) => (
                                    <UserRow 
                                        key={user.id} 
                                        user={user} 
                                        isSelected={selectedUserIds.includes(user.id)}
                                        onSelect={toggleUserSelection}
                                        orgStructure={orgStructure}
                                        handleApprove={handleApprove}
                                        handleEdit={handleEdit}
                                        handleManageLocations={handleManageLocations}
                                        handleResetPasscode={handleResetPasscode}
                                        handleDelete={handleDelete}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {!hasActiveFilters && (
                <Pagination 
                    currentPage={currentPage}
                    totalItems={totalUsers}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                    className="mt-6"
                />
            )}
            {hasActiveFilters && filteredUsers.length > 0 && (
                <div className="mt-4 text-sm text-muted text-center">
                    Showing {filteredUsers.length} of {users.length} total users
                </div>
            )}
            <BulkUserUpdateModal
                isOpen={isBulkUpdateOpen}
                onClose={() => setIsBulkUpdateOpen(false)}
                selectedUsers={users.filter(u => selectedUserIds.includes(u.id))}
                onSuccess={() => {
                    fetchUsers();
                    setSelectedUserIds([]);
                }}
            />

            <BulkRoleUpdateModal 
                isOpen={isBulkRoleUpdateOpen}
                onClose={() => setIsBulkRoleUpdateOpen(false)}
                selectedUsers={users.filter(u => selectedUserIds.includes(u.id))}
                onSuccess={() => {
                    fetchUsers();
                    setSelectedUserIds([]);
                }}
            />

            {contextMenu && (
                <div 
                    className="fixed z-[9999] bg-white border border-slate-200 shadow-2xl rounded-xl py-2 min-w-[200px] animate-in zoom-in-95 duration-100 ring-1 ring-black/5"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="px-4 py-2 border-b border-slate-50 mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selection Options</span>
                    </div>
                    <button 
                        onClick={() => {
                            setIsBulkUpdateOpen(true);
                            setContextMenu(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                        <CheckSquare className="h-4 w-4" />
                        Bulk Update (Organization)
                    </button>
                    <button 
                        onClick={() => {
                            setIsBulkRoleUpdateOpen(true);
                            setContextMenu(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    >
                        <ShieldCheck className="h-4 w-4 text-indigo-500" />
                        Update Role
                    </button>
                    <hr className="my-1 border-slate-100" />
                    <button 
                        onClick={() => setSelectedUserIds([])}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-500 flex items-center gap-3 transition-colors border-t border-slate-50 mt-1"
                    >
                        <div className="p-1.5 ml-0.5">
                            <X className="h-4 w-4" />
                        </div>
                        <span>Clear Selection</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
