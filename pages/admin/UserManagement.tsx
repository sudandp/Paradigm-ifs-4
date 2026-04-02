
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { User } from '../../types';
import { ShieldCheck, Plus, Edit, Trash2, Info, UserCheck, MapPin, Search, FilterX, FileSpreadsheet, X, RotateCw, Copy, Check, Clock } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import ApprovalModal from '../../components/admin/ApprovalModal';
import LocationAssignmentModal from '../../components/admin/LocationAssignmentModal';
import Pagination from '../../components/ui/Pagination';
import LoadingScreen from '../../components/ui/LoadingScreen';


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
        default: return 'bg-slate-100 text-slate-700';
    }
};

interface UserActionProps {
    user: User;
    handleApprove: (u: User) => void;
    handleEdit: (u: User) => void;
    handleManageLocations: (u: User) => void;
    handleResetPasscode: (u: User) => void;
    handleDelete: (u: User) => void;
}

// Memoized Row for performance
const UserRow = React.memo(({ 
    user, handleApprove, handleEdit, handleManageLocations, handleResetPasscode, handleDelete 
}: UserActionProps) => (
    <tr>
        <td data-label="Name" className="px-6 py-4 font-semibold text-base">{user.name}</td>
        <td data-label="Email" className="px-6 py-4 text-sm text-muted">{user.email}</td>
        <td data-label="Role" className="px-6 py-4 text-sm text-muted">
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${getRoleBadgeClass(user.role)}`}>
                {getRoleName(user.role)}
            </span>
            {user.role === 'unverified' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 ml-2 uppercase tracking-tight">Pending Approval</span>
            )}
        </td>
        <td data-label="Site" className="px-6 py-4 text-base text-primary-text font-medium">
            {user.organizationName || (user.societyName ? `${user.societyName} (HO)` : '-')}
        </td>
        <td data-label="Biometric ID" className="px-6 py-4 text-base font-mono text-muted/80">
            {user.biometricId || '-'}
        </td>
        <td data-label="Actions" className="px-6 py-3">
            <div className="flex items-center gap-1.5 md:justify-start justify-end">
                {user.role === 'unverified' && (
                    <Button variant="outline" size="sm" onClick={() => handleApprove(user)} aria-label={`Approve user ${user.name}`} title={`Approve user ${user.name}`} className="h-8 text-[11px] px-3"><UserCheck className="h-3.5 w-3.5 mr-1.5" />Approve</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleEdit(user)} aria-label={`Edit user ${user.name}`} title={`Edit user ${user.name}`} className="h-8 w-8 p-0 border-border hover:bg-page transition-all"><Edit className="h-3.5 w-3.5 text-slate-600" /></Button>
                <Button variant="outline" size="sm" onClick={() => handleManageLocations(user)} aria-label={`Manage Geofencing for ${user.name}`} title={`Manage Geofencing for ${user.name}`} className="h-8 w-8 p-0 border-border hover:bg-emerald-50 transition-all"><MapPin className="h-3.5 w-3.5 text-emerald-600" /></Button>
                <Button variant="outline" size="sm" onClick={() => handleResetPasscode(user)} aria-label={`Reset Passcode for ${user.name}`} title={`Reset Passcode for ${user.name}`} className="h-8 w-8 p-0 border-border hover:text-amber-600 hover:bg-amber-50 transition-all"><RotateCw className="h-3.5 w-3.5 text-slate-500" /></Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(user)} aria-label={`Delete user ${user.name}`} title={`Delete user ${user.name}`} className="h-8 w-8 p-0 border-border hover:bg-red-50 hover:text-red-600 transition-all"><Trash2 className="h-3.5 w-3.5 text-slate-400 group-hover:text-red-500" /></Button>
            </div>
        </td>
    </tr>
));

// Memoized Card for Mobile view performance
const UserCard = React.memo(({ 
    user, handleApprove, handleEdit, handleManageLocations, handleResetPasscode, handleDelete 
}: UserActionProps) => (
    <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col gap-3 h-full">
        <div className="flex justify-between items-start">
            <div>
                <h3 className="font-semibold text-primary-text">{user.name}</h3>
                <p className="text-sm text-muted">{user.email}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRoleBadgeClass(user.role)}`}>
                {getRoleName(user.role)}
            </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm mt-1 flex-grow">
            <div>
                <span className="text-xs text-muted block">Site</span>
                <span className="font-medium text-primary-text">{user.organizationName || (user.societyName ? `${user.societyName} (HO)` : '-')}</span>
            </div>
            <div>
                <span className="text-xs text-muted block">Biometric ID</span>
                <span className="font-mono text-primary-text">{user.biometricId || '-'}</span>
            </div>
        </div>

        <div className="pt-3 border-t border-border flex justify-end gap-2 mt-auto">
            {user.role === 'unverified' && (
                <Button variant="outline" size="sm" onClick={() => handleApprove(user)} className="flex-1">
                    <UserCheck className="h-4 w-4 mr-2" />Approve
                </Button>
            )}
            <Button variant="icon" size="sm" onClick={() => handleEdit(user)} className="h-9 w-9 border border-border rounded-lg">
                <Edit className="h-4 w-4" />
            </Button>
            <Button variant="icon" size="sm" onClick={() => handleManageLocations(user)} className="h-9 w-9 border border-border rounded-lg">
                <MapPin className="h-4 w-4 text-emerald-500" />
            </Button>
            <Button variant="icon" size="sm" onClick={() => handleResetPasscode(user)} className="h-9 w-9 border border-border rounded-lg hover:text-amber-600">
                <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="icon" size="sm" onClick={() => handleDelete(user)} className="h-9 w-9 border border-border rounded-lg hover:bg-red-50 text-red-500">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    </div>
));

const UserManagement: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [fetchedAllFiltered, setFetchedAllFiltered] = useState(false);

    // Column filters as a single state object
    const [filters, setFilters] = useState({
        name: '',
        email: '',
        role: '',
        site: '',
        biometricId: ''
    });

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
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const isMobile = useMediaQuery('(max-width: 767px)');

    const hasActiveFilters = useMemo(() => 
        Object.values(filters).some(v => v !== ''),
        [filters]
    );

    const fetchUsers = useCallback(async () => {
        // Only show full-page skeleton if we have no users yet
        const shouldShowSkeleton = users.length === 0;
        if (shouldShowSkeleton) setIsLoading(true);
        
        try {
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
                    search: searchTerm,
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
    }, [currentPage, pageSize, hasActiveFilters, fetchedAllFiltered, users.length, searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchTerm]);

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

    const clearAllFilters = () => {
        setFilters({
            name: '',
            email: '',
            role: '',
            site: '',
            biometricId: ''
        });
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    // Derive unique roles for dropdown
    const uniqueRoles = useMemo(() => 
        Array.from(new Set(users.map(u => u.role).filter(Boolean))).sort(),
        [users]
    );

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            if (filters.name && !user.name?.toLowerCase().includes(filters.name.toLowerCase())) return false;
            if (filters.email && !user.email?.toLowerCase().includes(filters.email.toLowerCase())) return false;
            if (filters.role && user.role !== filters.role) return false;
            if (filters.site && !(user.organizationName || '').toLowerCase().includes(filters.site.toLowerCase())) return false;
            if (filters.biometricId && !(user.biometricId || '').toLowerCase().includes(filters.biometricId.toLowerCase())) return false;
            return true;
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [users, filters]);

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
                <div className="flex gap-2">
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
                        {/* Mobile Filter Row - Static so focus isn't lost */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 bg-gray-50 p-3 rounded-lg border border-border">
                            <input
                                name="name"
                                type="text"
                                placeholder="Filter Name..."
                                value={filters.name}
                                onChange={handleFilterChange}
                                className="w-full text-sm px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <input
                                name="email"
                                type="text"
                                placeholder="Filter Email..."
                                value={filters.email}
                                onChange={handleFilterChange}
                                className="w-full text-sm px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredUsers.map((user) => (
                                <UserCard 
                                    key={user.id} 
                                    user={user} 
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
                                    <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-muted uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-muted uppercase tracking-wider">Email</th>
                                    <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-muted uppercase tracking-wider">Role</th>
                                    <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-muted uppercase tracking-wider">Site</th>
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
                                {/* Filter Row - Stable and permanently mounted */}
                                <tr className="bg-gray-50/50">
                                    <th className="px-6 py-2">
                                        <input
                                            id="filter-name"
                                            name="name"
                                            type="text"
                                            placeholder="Filter..."
                                            value={filters.name}
                                            onChange={handleFilterChange}
                                            className="w-full text-sm font-normal px-2 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                        />
                                    </th>
                                    <th className="px-6 py-2">
                                        <input
                                            id="filter-email"
                                            name="email"
                                            type="text"
                                            placeholder="Filter..."
                                            value={filters.email}
                                            onChange={handleFilterChange}
                                            className="w-full text-sm font-normal px-2 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                        />
                                    </th>
                                    <th className="px-6 py-2">
                                        <select
                                            id="filter-role"
                                            name="role"
                                            value={filters.role}
                                            onChange={handleFilterChange}
                                            className="w-full text-sm font-normal px-2 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                        >
                                            <option value="">All Roles</option>
                                            {uniqueRoles.map(role => (
                                                <option key={role} value={role}>{getRoleName(role)}</option>
                                            ))}
                                        </select>
                                    </th>
                                    <th className="px-6 py-2">
                                        <input
                                            id="filter-site"
                                            name="site"
                                            type="text"
                                            placeholder="Filter..."
                                            value={filters.site}
                                            onChange={handleFilterChange}
                                            className="w-full text-sm font-normal px-2 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                        />
                                    </th>
                                    <th className="px-6 py-2">
                                        <input
                                            id="filter-biometric-id"
                                            name="biometricId"
                                            type="text"
                                            placeholder="Filter..."
                                            value={filters.biometricId}
                                            onChange={handleFilterChange}
                                            className="w-full text-sm font-normal px-2 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                        />
                                    </th>
                                    <th className="px-6 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border md:bg-card md:divide-y-0">
                                {filteredUsers.map((user) => (
                                    <UserRow 
                                        key={user.id} 
                                        user={user} 
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
        </div>
    );
};

export default UserManagement;
