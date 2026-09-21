import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { User, Role, Organization } from '../../types';
import { 
    Maximize2, 
    Minimize2,
    ChevronDown, 
    ChevronRight, 
    ChevronLeft, 
    Mail, 
    Phone, 
    Building2, 
    Sparkles, 
    X, 
    Layers,
    Search,
    RotateCcw,
    ZoomIn,
    ZoomOut,
    AlertTriangle,
    ArrowRightLeft,
    Check,
    CheckCircle2,
    UserCheck,
    UserX,
    Users,
    Edit2,
    ArrowRight,
    Loader2,
    Trash2,
    MapPin
} from 'lucide-react';
import { getProxyUrl } from '../../utils/fileUrl';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';

export interface WorkflowNode extends User {
    managerName?: string;
    manager2Name?: string;
    manager3Name?: string;
    children?: WorkflowNode[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    level?: number;
    isLeaf?: boolean;
    totalDescendants?: number;
}

interface WorkflowChart2DProps {
    users: (User & { managerName?: string; manager2Name?: string; manager3Name?: string })[];
    allRoles?: Role[];
    organizations?: Organization[];
    externalSearchQuery?: string;
    externalZoom?: number;
    showControls?: boolean;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
    onSelectEmployeeForTrace?: (userId: string) => void;
    onManagerChange?: (userId: string, managerId: string, slot: 1 | 2 | 3) => void;
    onRefresh?: () => void;
}

// Role color scheme (strictly compliant with no-purple rule)
const getRoleTheme = (role: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('admin') || r.includes('management') || r.includes('director') || r.includes('president')) {
        return {
            border: 'border-emerald-300',
            bg: 'bg-emerald-50/50',
            accent: 'bg-emerald-600',
            badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            avatarBg: 'bg-emerald-600 text-white',
            label: 'Executive'
        };
    }
    if (r.includes('site_manager') || r.includes('manager') || r.includes('operation') || r.includes('supervisor')) {
        return {
            border: 'border-amber-300',
            bg: 'bg-amber-50/50',
            accent: 'bg-amber-500',
            badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
            avatarBg: 'bg-amber-600 text-white',
            label: 'Management'
        };
    }
    if (r.includes('hr') || r.includes('recruitment') || r.includes('people')) {
        return {
            border: 'border-blue-300',
            bg: 'bg-blue-50/50',
            accent: 'bg-blue-500',
            badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
            avatarBg: 'bg-blue-600 text-white',
            label: 'HR & People'
        };
    }
    if (r.includes('electrician') || r.includes('plumber') || r.includes('technician') || r.includes('security') || r.includes('hk') || r.includes('maintenance')) {
        return {
            border: 'border-teal-300',
            bg: 'bg-teal-50/50',
            accent: 'bg-teal-500',
            badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
            avatarBg: 'bg-teal-600 text-white',
            label: 'Technical / Ops'
        };
    }
    if (r.includes('field') || r.includes('staff') || r.includes('assistant')) {
        return {
            border: 'border-sky-300',
            bg: 'bg-sky-50/50',
            accent: 'bg-sky-500',
            badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
            avatarBg: 'bg-sky-600 text-white',
            label: 'Field Staff'
        };
    }
    if (r.includes('finance') || r.includes('account')) {
        return {
            border: 'border-emerald-300',
            bg: 'bg-emerald-50/50',
            accent: 'bg-emerald-500',
            badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            avatarBg: 'bg-emerald-700 text-white',
            label: 'Finance'
        };
    }
    return {
        border: 'border-slate-300',
        bg: 'bg-slate-50/50',
        accent: 'bg-slate-400',
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
        avatarBg: 'bg-slate-600 text-white',
        label: 'Staff'
    };
};

const CARD_WIDTH = 232;
const CARD_HEIGHT = 86;
const HORIZONTAL_GAP = 28;
const VERTICAL_GAP = 60;
const LEAF_COLS = 2; // Compact 2-3 column layout for leaves

/**
 * Resolves a user's photo URL through proxy / supabase storage
 */
export const getUserPhotoUrl = (user?: Partial<User> | null): string | null => {
    if (!user) return null;
    const rawPhoto = user.photoUrl || (user as any).photo_url || (user as any).avatar_url;
    if (!rawPhoto || typeof rawPhoto !== 'string') return null;
    if (
        rawPhoto.startsWith('http') || 
        rawPhoto.startsWith('https') || 
        rawPhoto.startsWith('data:') || 
        rawPhoto.startsWith('/api/') || 
        rawPhoto.startsWith('blob:')
    ) {
        return getProxyUrl(rawPhoto);
    }
    if (rawPhoto.startsWith('avatars/')) {
        const path = rawPhoto.replace('avatars/', '');
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        return data?.publicUrl ? getProxyUrl(data.publicUrl) : null;
    }
    return getProxyUrl(rawPhoto);
};

/**
 * Clean, modern user avatar component that shows employee photo with fallback to role initial
 */
export const WorkflowUserAvatar: React.FC<{ 
    user: Partial<User>;
    theme?: { avatarBg?: string };
    size?: string;
    textSize?: string;
    rounded?: string;
    className?: string;
}> = ({ user, theme, size = "w-8 h-8", textSize = "text-xs", rounded = "rounded-lg", className = "" }) => {
    const [imgError, setImgError] = useState(false);
    const photoUrl = getUserPhotoUrl(user);
    const initial = (user.name || 'U').charAt(0).toUpperCase();

    if (photoUrl && !imgError) {
        return (
            <div className={`${size} ${rounded} overflow-hidden flex-shrink-0 shadow-xs border border-slate-200/80 bg-slate-100 flex items-center justify-center relative ${className}`}>
                <img 
                    src={photoUrl} 
                    alt={user.name || 'User'}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
            </div>
        );
    }

    return (
        <div className={`${size} ${rounded} flex items-center justify-center font-bold ${textSize} flex-shrink-0 shadow-xs ${theme?.avatarBg || 'bg-slate-600 text-white'} ${className}`}>
            {initial}
        </div>
    );
};

export const WorkflowChart2D: React.FC<WorkflowChart2DProps> = ({
    users,
    allRoles = [],
    organizations = [],
    externalSearchQuery,
    externalZoom,
    showControls = true,
    isFullscreen = false,
    onToggleFullscreen,
    onSelectEmployeeForTrace,
    onManagerChange,
    onRefresh
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartAreaRef = useRef<HTMLDivElement | null>(null);

    const [selectedBranchRoot, setSelectedBranchRoot] = useState<string>('all');
    const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
    const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
    const [orgSearchTerm, setOrgSearchTerm] = useState('');
    const orgDropdownRef = useRef<HTMLDivElement | null>(null);

    const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
    const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
    const [zoom, setZoom] = useState<number>(0.9);
    const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 40, y: 40 });

    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const hasDraggedRef = useRef(false);

    const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : '';

    // Reassignment Modal State
    const [reassignModalTarget, setReassignModalTarget] = useState<WorkflowNode | null>(null);
    const [selectedNewManagerId, setSelectedNewManagerId] = useState<string>('');
    const [reassignSlot, setReassignSlot] = useState<1 | 2 | 3>(1);
    const [selectedDirectReportIds, setSelectedDirectReportIds] = useState<Set<string>>(new Set());
    const [managerSearchQuery, setManagerSearchQuery] = useState<string>('');
    const [isReassigning, setIsReassigning] = useState<boolean>(false);
    const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Individual Manager Edit in Drawer
    const [isEditingL1Manager, setIsEditingL1Manager] = useState<boolean>(false);
    const [selectedL1ManagerId, setSelectedL1ManagerId] = useState<string>('');
    const [isSavingL1Manager, setIsSavingL1Manager] = useState<boolean>(false);

    // Auto-dismiss toast
    useEffect(() => {
        if (toastNotification) {
            const timer = setTimeout(() => setToastNotification(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [toastNotification]);

    // Delete Inactive User State
    const [userToDelete, setUserToDelete] = useState<WorkflowNode | null>(null);
    const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);
    const [deletedUserIds, setDeletedUserIds] = useState<Set<string>>(new Set());

    // 14-day activity status per user (active / inactive / unknown)
    const [activityMap, setActivityMap] = useState<Record<string, 'active' | 'inactive' | 'unknown'>>({});

    useEffect(() => {
        if (!users || users.length === 0) return;
        let isMounted = true;
        api.getUsersActivityStatus(users.map(u => ({ id: u.id, role: u.role })))
            .then(newMap => {
                if (isMounted) {
                    setActivityMap(prev => ({ ...prev, ...newMap }));
                }
            })
            .catch(() => {});
        return () => { isMounted = false; };
    }, [users]);

    // Check if a user has left the organization
    const isUserLeft = useCallback((user: User | WorkflowNode | null | undefined): boolean => {
        if (!user) return false;
        return user.status === 'left' || !!user.leftDate || !!(user as any).left_date;
    }, []);

    // Get comprehensive active/inactive status
    const getUserActivityStatus = useCallback((user: User | WorkflowNode | null | undefined): {
        isActive: boolean;
        label: string;
        reason?: string;
    } => {
        if (!user) return { isActive: true, label: 'Active' };
        if (isUserLeft(user)) {
            return { isActive: false, label: 'Left', reason: user.leftDate ? `Exit: ${user.leftDate}` : 'Marked as left' };
        }
        if (user.isBlocked || user.status === 'blocked') {
            return { isActive: false, label: 'Blocked', reason: 'Account is blocked' };
        }
        if (user.status === 'inactive') {
            return { isActive: false, label: 'Inactive', reason: 'Account inactive' };
        }
        const act = activityMap[user.id];
        if (act === 'inactive') {
            return { isActive: false, label: 'Inactive', reason: 'No attendance / punches in 14+ days' };
        }
        return { isActive: true, label: 'Active' };
    }, [activityMap, isUserLeft]);

    // Resolve location cleanly from user profile or assigned organization
    const resolveLocation = useCallback((user: User | WorkflowNode): string => {
        if (user.location) return user.location;
        if ((user as any).locationName) return (user as any).locationName;
        const orgId = user.organizationId || user.societyId;
        if (orgId && organizations.length > 0) {
            const org = organizations.find(o => o.id === orgId || (user.organizationId && user.organizationId.split(',').map(s => s.trim()).includes(o.id)));
            if ((org as any)?.location) return (org as any).location;
        }
        return '';
    }, [organizations]);

    const handleConfirmDeleteUser = async () => {
        if (!userToDelete) return;
        const target = userToDelete;
        setIsDeletingUser(true);
        try {
            await api.deleteUser(target.id);
            setToastNotification({
                message: `User "${target.name}" has been permanently deleted.`,
                type: 'success'
            });
            // Optimistic instant local removal
            setDeletedUserIds(prev => new Set([...prev, target.id]));
            if (selectedNode?.id === target.id) {
                setSelectedNode(null);
            }
            setUserToDelete(null);
            // Sync server
            onRefresh?.();
        } catch (err: any) {
            console.error('Delete user error:', err);
            setToastNotification({
                message: 'Failed to delete user: ' + (err.message || 'Unknown error'),
                type: 'error'
            });
        } finally {
            setIsDeletingUser(false);
        }
    };

    const branchScrollRef = useRef<HTMLDivElement | null>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkBranchScroll = useCallback(() => {
        if (!branchScrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = branchScrollRef.current;
        setCanScrollLeft(scrollLeft > 2);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
    }, []);

    const scrollBranches = useCallback((direction: 'left' | 'right') => {
        if (!branchScrollRef.current) return;
        const amount = direction === 'left' ? -280 : 280;
        branchScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
        setTimeout(checkBranchScroll, 200);
    }, [checkBranchScroll]);

    const handleBranchWheel = (e: React.WheelEvent) => {
        if (!branchScrollRef.current) return;
        if (e.deltaY !== 0) {
            e.preventDefault();
            e.stopPropagation();
            branchScrollRef.current.scrollLeft += e.deltaY;
            checkBranchScroll();
        }
    };

    const getRoleDisplayName = useCallback((roleId: string = '') => {
        const found = allRoles.find(r => r.id === roleId || r.id.toLowerCase() === roleId.toLowerCase());
        if (found?.displayName) return found.displayName;
        return roleId ? roleId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Staff';
    }, [allRoles]);

    // Available Organizations calculation with counts
    const organizationOptions = useMemo(() => {
        const orgMap = new Map<string, { id: string; name: string; count: number }>();

        // 1. Seed from organizations prop if available
        organizations.forEach(org => {
            if (org.id) {
                orgMap.set(org.id, {
                    id: org.id,
                    name: org.shortName || org.fullName || org.id,
                    count: 0
                });
            }
        });

        // 2. Count members from users & capture any unlisted organizations
        users.forEach(user => {
            const orgId = user.organizationId || user.societyId;
            const orgName = (user.organizationName || user.societyName || '').trim();

            if (orgId) {
                const ids = orgId.split(',').map(s => s.trim()).filter(Boolean);
                ids.forEach(id => {
                    const existing = orgMap.get(id);
                    if (existing) {
                        existing.count += 1;
                    } else {
                        orgMap.set(id, {
                            id,
                            name: orgName || id,
                            count: 1
                        });
                    }
                });
            } else if (orgName) {
                const existing = orgMap.get(orgName);
                if (existing) {
                    existing.count += 1;
                } else {
                    orgMap.set(orgName, {
                        id: orgName,
                        name: orgName,
                        count: 1
                    });
                }
            }
        });

        return Array.from(orgMap.values())
            .filter(o => o.count > 0 || organizations.some(orig => orig.id === o.id))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }, [organizations, users]);

    // Active users filtered by selected Organization
    const activeUsers = useMemo(() => {
        const base = deletedUserIds.size > 0 ? users.filter(u => !deletedUserIds.has(u.id)) : users;
        if (selectedOrgId === 'all') return base;
        return base.filter(user => {
            if (user.organizationId) {
                const ids = user.organizationId.split(',').map(s => s.trim().toLowerCase());
                if (ids.includes(selectedOrgId.toLowerCase())) return true;
            }
            if (user.societyId && user.societyId.toLowerCase() === selectedOrgId.toLowerCase()) return true;
            if (user.organizationName && user.organizationName.toLowerCase() === selectedOrgId.toLowerCase()) return true;
            if (user.societyName && user.societyName.toLowerCase() === selectedOrgId.toLowerCase()) return true;
            return false;
        });
    }, [users, selectedOrgId, deletedUserIds]);

    // Filtered options for dropdown search
    const filteredOrgOptions = useMemo(() => {
        if (!orgSearchTerm.trim()) return organizationOptions;
        const q = orgSearchTerm.toLowerCase();
        return organizationOptions.filter(o => o.name.toLowerCase().includes(q));
    }, [organizationOptions, orgSearchTerm]);

    // Close dropdown on outside click or escape
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
                setIsOrgDropdownOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOrgDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Build hierarchy with cycle detection and fallback to guarantee all users are visible
    const { roots, topBranches, nodeMap } = useMemo(() => {
        const map = new Map<string, WorkflowNode>();
        activeUsers.forEach(user => {
            map.set(user.id, { ...user, children: [] });
        });

        const rootList: WorkflowNode[] = [];
        const hasParent = new Set<string>();
        const parentOf = new Map<string, string>(); // childId -> parentId in tree

        // Check if potentialChild is already an ancestor of potentialParent in current tree
        const isAncestorInTree = (ancestorId: string, startId: string): boolean => {
            let cur: string | undefined = startId;
            const visited = new Set<string>();
            while (cur) {
                if (cur === ancestorId) return true;
                if (visited.has(cur)) break;
                visited.add(cur);
                cur = parentOf.get(cur);
            }
            return false;
        };

        activeUsers.forEach(user => {
            const node = map.get(user.id);
            if (!node) return;
            const mgrId = user.reportingManagerId;
            if (!mgrId || mgrId === user.id || !map.has(mgrId)) return;

            // Prevent cycles: attaching user under mgrId only creates a cycle if user is already an ancestor of mgrId in the tree
            if (!isAncestorInTree(user.id, mgrId)) {
                const parent = map.get(mgrId)!;
                parent.children!.push(node);
                parentOf.set(user.id, mgrId);
                hasParent.add(user.id);
            }
        });

        // Top-level roots (either no manager, manager not in active group, or cycle breakers)
        activeUsers.forEach(user => {
            if (!hasParent.has(user.id)) {
                const node = map.get(user.id);
                if (node) {
                    rootList.push(node);
                }
            }
        });

        // If for any reason rootList is still empty, add all active users
        if (rootList.length === 0 && activeUsers.length > 0) {
            activeUsers.forEach(u => {
                const node = map.get(u.id);
                if (node) rootList.push(node);
            });
        }

        // Compute total descendants with recursion protection
        const visitedDescendants = new Set<string>();
        const countDescendants = (node: WorkflowNode): number => {
            if (!node || !node.id) return 0;
            if (visitedDescendants.has(node.id) || !node.children || node.children.length === 0) {
                node.totalDescendants = 0;
                node.isLeaf = true;
                return 0;
            }
            visitedDescendants.add(node.id);
            node.children = node.children.filter(Boolean);
            let total = node.children.length;
            node.children.forEach(child => {
                if (child) {
                    total += countDescendants(child);
                }
            });
            node.totalDescendants = total;
            node.isLeaf = total === 0;
            return total;
        };

        rootList.forEach(r => {
            if (r) countDescendants(r);
        });

        // Ensure descendants are computed for all nodes in map
        map.forEach(n => {
            if (n.totalDescendants === undefined) {
                countDescendants(n);
            }
        });

        // Map count of direct reportees for each manager
        const managerReporteesCount = new Map<string, number>();
        activeUsers.forEach(u => {
            if (u.reportingManagerId) {
                managerReporteesCount.set(
                    u.reportingManagerId,
                    (managerReporteesCount.get(u.reportingManagerId) || 0) + 1
                );
            }
        });

        // Identify ONLY actual reporting managers (users who have people reporting to them)
        const reportingManagers = activeUsers
            .filter(u => {
                const node = map.get(u.id);
                const directReports = managerReporteesCount.get(u.id) || (node?.children ? node.children.length : 0);
                const totalReports = node?.totalDescendants || 0;
                return directReports > 0 || totalReports > 0;
            })
            .map(u => {
                const node = map.get(u.id);
                const directReports = managerReporteesCount.get(u.id) || (node?.children ? node.children.length : 0);
                const totalReports = node?.totalDescendants || directReports;
                return {
                    id: u.id,
                    name: u.name || 'Unnamed',
                    role: u.role || 'Staff',
                    totalMembers: directReports,
                    totalDescendants: totalReports
                };
            })
            .sort((a, b) => b.totalMembers - a.totalMembers || a.name.localeCompare(b.name));

        return { roots: rootList, topBranches: reportingManagers, nodeMap: map };
    }, [activeUsers]);

    // Keep selectedNode in sync when nodeMap changes
    useEffect(() => {
        if (selectedNode) {
            const updated = nodeMap.get(selectedNode.id);
            if (updated) setSelectedNode(updated);
        }
    }, [nodeMap]);

    // Calculate reporting managers who have left the company but still have reports
    const leftManagersWithReports = useMemo(() => {
        return topBranches.filter(branch => {
            const node = nodeMap.get(branch.id);
            return isUserLeft(node) && (branch.totalMembers > 0 || (node?.children?.length || 0) > 0);
        });
    }, [topBranches, nodeMap, isUserLeft]);

    // Open reassign modal for a manager
    const openReassignModal = useCallback((managerNode: WorkflowNode) => {
        setReassignModalTarget(managerNode);
        setSelectedNewManagerId('');
        setReassignSlot(1);
        setManagerSearchQuery('');
        const reportIds = new Set((managerNode.children || []).map(c => c.id));
        setSelectedDirectReportIds(reportIds);
    }, []);

    // Eligible new managers (exclude current manager, left employees, and direct reports being transferred)
    const eligibleNewManagers = useMemo(() => {
        if (!reassignModalTarget) return [];
        const reportIds = new Set((reassignModalTarget.children || []).map(c => c.id));
        return users.filter(u => {
            if (u.id === reassignModalTarget.id) return false;
            if (isUserLeft(u)) return false;
            if (reportIds.has(u.id)) return false;
            if (managerSearchQuery.trim()) {
                const q = managerSearchQuery.toLowerCase();
                return (u.name || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
            }
            return true;
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [users, reassignModalTarget, isUserLeft, managerSearchQuery]);

    // Eligible managers for individual user L1 change in drawer
    const eligibleL1ManagersForSelectedNode = useMemo(() => {
        if (!selectedNode) return [];
        return users.filter(u => {
            if (u.id === selectedNode.id) return false;
            if (isUserLeft(u)) return false;
            return true;
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [users, selectedNode, isUserLeft]);

    // Reassign Direct Reports Action
    const handleConfirmReassignment = async () => {
        if (!reassignModalTarget || !selectedNewManagerId) {
            setToastNotification({ message: 'Please select a new reporting manager.', type: 'error' });
            return;
        }
        if (selectedDirectReportIds.size === 0) {
            setToastNotification({ message: 'Please select at least one direct report to reassign.', type: 'error' });
            return;
        }

        setIsReassigning(true);
        try {
            const reportIds = Array.from(selectedDirectReportIds);
            await Promise.all(
                reportIds.map(reportId =>
                    api.updateUserReportingManager(reportId, selectedNewManagerId, reassignSlot)
                )
            );

            // Optimistic update callback for each report
            reportIds.forEach(reportId => {
                onManagerChange?.(reportId, selectedNewManagerId, reassignSlot);
            });

            const newMgr = users.find(u => u.id === selectedNewManagerId);
            setToastNotification({
                message: `Successfully reassigned ${reportIds.length} direct report(s) to ${newMgr?.name || 'new manager'}!`,
                type: 'success'
            });

            setReassignModalTarget(null);

            if (onRefresh) {
                onRefresh();
            }
        } catch (err: any) {
            console.error('Failed to reassign direct reports:', err);
            setToastNotification({
                message: 'Failed to reassign direct reports: ' + (err.message || 'Unknown error'),
                type: 'error'
            });
        } finally {
            setIsReassigning(false);
        }
    };

    // Change Individual Manager Action
    const handleSaveIndividualL1Manager = async () => {
        if (!selectedNode) return;
        setIsSavingL1Manager(true);
        try {
            const mgrIdToSave = selectedL1ManagerId || null;
            await api.updateUserReportingManager(selectedNode.id, mgrIdToSave, 1);
            onManagerChange?.(selectedNode.id, mgrIdToSave || '', 1);
            setIsEditingL1Manager(false);
            const newMgr = users.find(u => u.id === selectedL1ManagerId);
            setToastNotification({
                message: mgrIdToSave
                    ? `Reporting manager for ${selectedNode.name} updated to ${newMgr?.name || 'new manager'}.`
                    : `Reporting manager for ${selectedNode.name} cleared.`,
                type: 'success'
            });
            if (onRefresh) {
                onRefresh();
            }
        } catch (err: any) {
            console.error('Failed to update reporting manager:', err);
            setToastNotification({
                message: 'Failed to update manager: ' + (err.message || 'Unknown error'),
                type: 'error'
            });
        } finally {
            setIsSavingL1Manager(false);
        }
    };

    // Filter roots if a specific branch / manager is selected
    const activeRoots = useMemo(() => {
        if (selectedBranchRoot === 'all') return roots.filter((r): r is WorkflowNode => !!r);
        // Find in full nodeMap so clicking any reporting manager focuses their team
        const selected = nodeMap.get(selectedBranchRoot);
        return selected ? [selected] : roots.filter((r): r is WorkflowNode => !!r);
    }, [roots, nodeMap, selectedBranchRoot]);

    // Smart Compact Layout Calculation
    const { layoutNodes, layoutConnectors, bounds } = useMemo(() => {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        const nodes: WorkflowNode[] = [];
        const connectors: { id: string; parent: WorkflowNode; child: WorkflowNode }[] = [];
        const visitedLayoutNodes = new Set<string>();

        const layoutSubtree = (node: WorkflowNode, x: number, y: number, level: number): { width: number; height: number } => {
            if (!node || !node.id || visitedLayoutNodes.has(node.id)) {
                return { width: 0, height: 0 };
            }
            visitedLayoutNodes.add(node.id);

            node.level = level;
            node.width = CARD_WIDTH;
            node.height = CARD_HEIGHT;

            const isCollapsed = collapsedNodes.has(node.id);
            const hasChildren = node.children && node.children.length > 0 && !isCollapsed;

            if (!hasChildren) {
                node.x = x;
                node.y = y;
                nodes.push(node);

                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x + CARD_WIDTH);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y + CARD_HEIGHT);

                return { width: CARD_WIDTH, height: CARD_HEIGHT };
            }

            const children = (node.children || []).filter(c => c && c.id && !visitedLayoutNodes.has(c.id));
            const branchChildren = children.filter(c => c.children && c.children.length > 0);
            const leafChildren = children.filter(c => !c.children || c.children.length === 0);

            const branchLayouts: { node: WorkflowNode; width: number; height: number }[] = [];
            let currentBranchX = x;
            let childrenMaxHeight = 0;

            // 1. Layout Branch Children Recursively
            branchChildren.forEach(child => {
                const bLayout = layoutSubtree(child, currentBranchX, y + CARD_HEIGHT + VERTICAL_GAP, level + 1);
                if (bLayout.width > 0) {
                    branchLayouts.push({ node: child, width: bLayout.width, height: bLayout.height });
                    currentBranchX += bLayout.width + HORIZONTAL_GAP;
                    childrenMaxHeight = Math.max(childrenMaxHeight, bLayout.height);

                    connectors.push({
                        id: `${node.id}->${child.id}`,
                        parent: node,
                        child: child
                    });
                }
            });

            const branchSectionWidth = branchLayouts.length > 0 
                ? branchLayouts.reduce((acc, b) => acc + b.width + HORIZONTAL_GAP, 0) - HORIZONTAL_GAP 
                : 0;

            // 2. Layout Leaf Children in a Compact 2-3 Column Matrix
            let leafSectionWidth = 0;
            let leafSectionHeight = 0;
            if (leafChildren.length > 0) {
                const cols = Math.min(LEAF_COLS, leafChildren.length);
                const rows = Math.ceil(leafChildren.length / cols);
                leafSectionWidth = cols * CARD_WIDTH + (cols - 1) * (HORIZONTAL_GAP / 2);
                leafSectionHeight = rows * CARD_HEIGHT + (rows - 1) * 16;

                const leafStartX = branchSectionWidth > 0 ? currentBranchX : x;
                const leafStartY = y + CARD_HEIGHT + VERTICAL_GAP;

                leafChildren.forEach((leaf, idx) => {
                    visitedLayoutNodes.add(leaf.id);
                    const colIdx = idx % cols;
                    const rowIdx = Math.floor(idx / cols);

                    const lx = leafStartX + colIdx * (CARD_WIDTH + HORIZONTAL_GAP / 2);
                    const ly = leafStartY + rowIdx * (CARD_HEIGHT + 16);

                    leaf.x = lx;
                    leaf.y = ly;
                    leaf.level = level + 1;
                    leaf.width = CARD_WIDTH;
                    leaf.height = CARD_HEIGHT;

                    nodes.push(leaf);

                    connectors.push({
                        id: `${node.id}->${leaf.id}`,
                        parent: node,
                        child: leaf
                    });

                    minX = Math.min(minX, lx);
                    maxX = Math.max(maxX, lx + CARD_WIDTH);
                    minY = Math.min(minY, ly);
                    maxY = Math.max(maxY, ly + CARD_HEIGHT);
                });

                childrenMaxHeight = Math.max(childrenMaxHeight, leafSectionHeight);
            }

            const childrenTotalWidth = branchSectionWidth > 0 && leafSectionWidth > 0
                ? branchSectionWidth + HORIZONTAL_GAP + leafSectionWidth
                : Math.max(branchSectionWidth, leafSectionWidth);

            const totalWidth = Math.max(CARD_WIDTH, childrenTotalWidth);
            const parentX = x + (totalWidth / 2) - (CARD_WIDTH / 2);
            node.x = parentX;
            node.y = y;
            nodes.push(node);

            minX = Math.min(minX, parentX);
            maxX = Math.max(maxX, parentX + CARD_WIDTH);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y + CARD_HEIGHT);

            return {
                width: totalWidth,
                height: CARD_HEIGHT + VERTICAL_GAP + childrenMaxHeight
            };
        };

        // Multi-Root Layout: Arrange roots in a clean grid
        const startX = 60;
        const startY = 60;

        if (activeRoots.length > 2 && selectedBranchRoot === 'all') {
            let rowY = startY;
            for (let i = 0; i < activeRoots.length; i += 2) {
                const r1 = activeRoots[i];
                const r2 = activeRoots[i + 1];

                const l1 = layoutSubtree(r1, startX, rowY, 0);
                let maxHeight = l1.height;

                if (r2) {
                    const l2 = layoutSubtree(r2, startX + l1.width + HORIZONTAL_GAP * 2, rowY, 0);
                    maxHeight = Math.max(maxHeight, l2.height);
                }

                rowY += (maxHeight > 0 ? maxHeight : CARD_HEIGHT) + VERTICAL_GAP * 1.5;
            }
        } else {
            let curX = startX;
            activeRoots.forEach(root => {
                const l = layoutSubtree(root, curX, startY, 0);
                curX += (l.width > 0 ? l.width : CARD_WIDTH) + HORIZONTAL_GAP * 2;
            });
        }

        const b = {
            minX: isFinite(minX) ? minX : 0,
            maxX: isFinite(maxX) ? maxX : 1200,
            minY: isFinite(minY) ? minY : 0,
            maxY: isFinite(maxY) ? maxY : 800,
            width: isFinite(maxX - minX) ? Math.max(800, maxX - minX + 160) : 1200,
            height: isFinite(maxY - minY) ? Math.max(600, maxY - minY + 160) : 800
        };

        return { layoutNodes: nodes, layoutConnectors: connectors, bounds: b };
    }, [activeRoots, collapsedNodes, selectedBranchRoot]);

    // Auto-fit function
    const autoFit = useCallback((targetZoom?: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const contentW = Math.max(bounds.width, 800);
        const contentH = Math.max(bounds.height, 600);

        const zoomX = (rect.width - 60) / contentW;
        const zoomY = (rect.height - 60) / contentH;
        let newZoom = Math.min(zoomX, zoomY);
        newZoom = Math.max(0.4, Math.min(newZoom, 1.0));

        const finalZoom = targetZoom !== undefined ? targetZoom : (externalZoom !== undefined ? externalZoom : newZoom);

        // Position nodes starting neatly with ample breathing room
        const newOffsetX = Math.max(30, (rect.width - (bounds.maxX - bounds.minX) * finalZoom) / 2) - bounds.minX * finalZoom;
        const newOffsetY = 60 - bounds.minY * finalZoom;

        setZoom(finalZoom);
        setOffset({ x: newOffsetX, y: newOffsetY });
    }, [bounds, externalZoom]);

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev * 1.15, 1.8));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev * 0.85, 0.35));
    };

    // Run auto-fit on load, when branch or organization changes, or when fullscreen toggles
    useEffect(() => {
        const timer = setTimeout(() => autoFit(), 120);
        return () => clearTimeout(timer);
    }, [selectedBranchRoot, selectedOrgId, autoFit, isFullscreen]);

    // Search and Auto-Focus
    useEffect(() => {
        if (!searchQuery.trim()) return;
        const q = searchQuery.toLowerCase().trim();
        const matched = layoutNodes.find(n => 
            (n.name || '').toLowerCase().includes(q) || 
            (n.role || '').toLowerCase().includes(q)
        );

        if (matched && matched.x !== undefined && matched.y !== undefined && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const targetX = rect.width / 2 - (matched.x + CARD_WIDTH / 2) * zoom;
            const targetY = rect.height / 2 - (matched.y + CARD_HEIGHT / 2) * zoom;
            setOffset({ x: targetX, y: targetY });
            setSelectedNode(matched);
        }
    }, [searchQuery, layoutNodes, zoom]);

    // Pan Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.org-card-button') || (e.target as HTMLElement).closest('.org-card')) {
            return;
        }
        isDraggingRef.current = true;
        hasDraggedRef.current = false;
        dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current) return;
        hasDraggedRef.current = true;
        setOffset({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = delta > 0 ? 1.08 : 0.92;
        const newZoom = Math.max(0.35, Math.min(zoom * factor, 1.8));

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newOffsetX = mouseX - (mouseX - offset.x) * (newZoom / zoom);
        const newOffsetY = mouseY - (mouseY - offset.y) * (newZoom / zoom);

        setZoom(newZoom);
        setOffset({ x: newOffsetX, y: newOffsetY });
    };

    const toggleNodeCollapse = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const handleExpandAll = () => {
        setCollapsedNodes(new Set());
        setTimeout(() => autoFit(), 100);
    };

    const handleCollapseToManagers = () => {
        const toCollapse = new Set<string>();
        layoutNodes.forEach(n => {
            if (n.children && n.children.length > 0) {
                const hasManagerKids = n.children.some(c => c.children && c.children.length > 0);
                if (!hasManagerKids) {
                    toCollapse.add(n.id);
                }
            }
        });
        setCollapsedNodes(toCollapse);
        setTimeout(() => autoFit(), 100);
    };

    // Check branch scroll on branch list change or resize
    useEffect(() => {
        checkBranchScroll();
        const handleResize = () => checkBranchScroll();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [topBranches, checkBranchScroll]);

    return (
        <div className="relative w-full h-full flex-1 min-h-[550px] bg-slate-50 select-none overflow-hidden flex flex-col" ref={containerRef}>
            {/* Top Branch Selector & Action Bar with Sliding Options */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2.5 z-10 shadow-xs">
                {/* Organization Dropdown + Branch Navigation Bar */}
                <div className="flex-1 min-w-0 flex items-center gap-2 relative">
                    {/* Interactive Organization Dropdown */}
                    <div className="relative flex-shrink-0" ref={orgDropdownRef}>
                        <button
                            type="button"
                            id="organization-dropdown-btn"
                            onClick={() => setIsOrgDropdownOpen(prev => !prev)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border shadow-xs cursor-pointer select-none ${
                                selectedOrgId !== 'all'
                                    ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-500/20'
                                    : 'bg-slate-900 text-white border-slate-950 hover:bg-slate-800'
                            }`}
                            title="Click to select and filter by Organization"
                        >
                            <span className="flex items-center gap-1.5">
                                {selectedOrgId !== 'all' ? (
                                    <>
                                        <Building2 className="w-3.5 h-3.5 text-emerald-200" />
                                        <span className="max-w-[150px] sm:max-w-[190px] truncate">
                                            {organizationOptions.find(o => o.id === selectedOrgId)?.name || 'Organization'}
                                        </span>
                                        <span className="text-[10px] bg-emerald-900/70 text-emerald-100 px-1.5 py-0.2 rounded-full font-bold">
                                            {activeUsers.length}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-sm leading-none">🌐</span>
                                        <span>All Organization</span>
                                        <span className="text-[10px] bg-slate-800 text-slate-200 px-1.5 py-0.2 rounded-full font-bold">
                                            {users.length}
                                        </span>
                                    </>
                                )}
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 text-slate-300 ${isOrgDropdownOpen ? 'rotate-180 text-white' : ''}`} />
                        </button>

                        {/* Reset button when an organization is filtered */}
                        {selectedOrgId !== 'all' && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrgId('all');
                                    setSelectedBranchRoot('all');
                                }}
                                title="Reset to All Organization"
                                className="absolute -top-1.5 -right-1.5 p-0.5 bg-slate-800 hover:bg-red-600 text-white rounded-full shadow-xs transition-colors z-20"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        )}

                        {/* Dropdown Menu Modal */}
                        {isOrgDropdownOpen && (
                            <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                                {/* Search box inside dropdown */}
                                <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={orgSearchTerm}
                                            onChange={e => setOrgSearchTerm(e.target.value)}
                                            placeholder="Search organization or site..."
                                            className="w-full pl-8 pr-7 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 text-slate-800"
                                            autoFocus
                                        />
                                        {orgSearchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => setOrgSearchTerm('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Options List */}
                                <div className="max-h-72 overflow-y-auto p-1.5 space-y-1 text-xs divide-y divide-slate-100">
                                    {/* All Organization Option */}
                                    <div className="pb-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedOrgId('all');
                                                setSelectedBranchRoot('all');
                                                setIsOrgDropdownOpen(false);
                                                setTimeout(() => autoFit(), 100);
                                            }}
                                            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-semibold transition-colors cursor-pointer ${
                                                selectedOrgId === 'all'
                                                    ? 'bg-slate-900 text-white font-bold'
                                                    : 'text-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span>🌐</span>
                                                <span>All Organization</span>
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                                selectedOrgId === 'all'
                                                    ? 'bg-slate-800 text-slate-100'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {users.length} members
                                            </span>
                                        </button>
                                    </div>

                                    {/* Organizations / Sites Group */}
                                    {filteredOrgOptions.length > 0 ? (
                                        <div className="pt-1.5 space-y-0.5">
                                            <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                <Building2 className="w-3 h-3 text-emerald-600" />
                                                Organizations & Sites ({filteredOrgOptions.length})
                                            </div>
                                            {filteredOrgOptions.map(org => {
                                                const isSelected = selectedOrgId === org.id;
                                                return (
                                                    <button
                                                        key={org.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedOrgId(org.id);
                                                            setSelectedBranchRoot('all');
                                                            setIsOrgDropdownOpen(false);
                                                            setTimeout(() => autoFit(), 100);
                                                        }}
                                                        className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium transition-colors cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-emerald-700 text-white font-bold'
                                                                : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
                                                        }`}
                                                    >
                                                        <span className="truncate pr-2">{org.name}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${
                                                            isSelected
                                                                ? 'bg-emerald-900/60 text-emerald-100'
                                                                : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {org.count}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="py-4 text-center text-slate-400 text-[11px]">
                                            No organizations found matching "{orgSearchTerm}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="h-5 w-px bg-slate-200 hidden sm:block flex-shrink-0" />

                    {/* Reporting Managers Label & Slider Section */}
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
                            <Layers className="w-3.5 h-3.5 text-emerald-700" /> Reporting Managers:
                        </span>

                        {/* Left Slide Button */}
                        <button
                            type="button"
                            onClick={() => scrollBranches('left')}
                            disabled={!canScrollLeft}
                            title="Slide left"
                            className={`p-1 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                                canScrollLeft
                                    ? 'bg-white text-slate-800 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 shadow-xs cursor-pointer'
                                    : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
                            }`}
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>

                        {/* Scrollable Branch Pills Row */}
                        <div 
                            ref={branchScrollRef}
                            onScroll={checkBranchScroll}
                            onWheel={handleBranchWheel}
                            className="flex-1 flex items-center gap-1.5 overflow-x-auto py-1 scroll-smooth no-scrollbar"
                        >
                            <button
                                type="button"
                                onClick={() => setSelectedBranchRoot('all')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 border cursor-pointer ${
                                    selectedBranchRoot === 'all'
                                        ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                }`}
                            >
                                All ({activeUsers.length})
                            </button>
                            {leftManagersWithReports.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const firstLeft = leftManagersWithReports[0];
                                        setSelectedBranchRoot(firstLeft.id);
                                        const node = nodeMap.get(firstLeft.id);
                                        if (node) setSelectedNode(node);
                                    }}
                                    title="Managers who have left the company but still have active direct reports assigned - Click to view and reassign"
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0 border bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200 cursor-pointer shadow-xs animate-pulse"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Left Mgrs with Reports ({leftManagersWithReports.length})</span>
                                </button>
                            )}
                            {topBranches.map(branch => {
                                const branchUser = nodeMap.get(branch.id);
                                const isBranchLeft = isUserLeft(branchUser);
                                return (
                                    <button
                                        key={branch.id}
                                        type="button"
                                        onClick={() => setSelectedBranchRoot(branch.id)}
                                        title={`Manager: ${branch.name}${isBranchLeft ? ' (LEFT COMPANY)' : ''} (${branch.totalMembers} reportees) - Click to focus team`}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0 border cursor-pointer ${
                                            isBranchLeft
                                                ? selectedBranchRoot === branch.id
                                                    ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                                                    : 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100'
                                                : selectedBranchRoot === branch.id
                                                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                                                    : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                                        }`}
                                    >
                                        {isBranchLeft && <AlertTriangle className="w-3 h-3 text-rose-600 flex-shrink-0" />}
                                        <span>{branch.name}</span>
                                        {isBranchLeft && <span className="text-[9px] uppercase font-black text-rose-700 bg-rose-200/80 px-1 py-0.2 rounded">Left</span>}
                                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                            selectedBranchRoot === branch.id ? 'bg-black/30 text-white' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {branch.totalMembers}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Right Slide Button */}
                        <button
                            type="button"
                            onClick={() => scrollBranches('right')}
                            disabled={!canScrollRight}
                            title="Slide right"
                            className={`p-1 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                                canScrollRight
                                    ? 'bg-white text-slate-800 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 shadow-xs cursor-pointer'
                                    : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
                            }`}
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Quick Toolbar Buttons */}
                {showControls && (
                    <div className="flex items-center gap-1.5 flex-shrink-0 pl-2.5 border-l border-slate-200">
                        {/* Zoom Controls */}
                        <div className="flex items-center gap-0.5 bg-slate-50 rounded-lg px-1.5 py-0.5 border border-slate-200">
                            <button
                                type="button"
                                onClick={handleZoomOut}
                                className="p-1 hover:bg-slate-200/60 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                                title="Zoom Out"
                            >
                                <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[11px] font-bold text-slate-700 min-w-[34px] text-center select-none">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                type="button"
                                onClick={handleZoomIn}
                                className="p-1 hover:bg-slate-200/60 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                                title="Zoom In"
                            >
                                <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => autoFit()}
                            title="Fit and center tree in display"
                            className="px-2.5 py-1 text-xs font-bold text-slate-800 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1 bg-white shadow-2xs whitespace-nowrap cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-700" />
                            Fit Tree
                        </button>

                        <button
                            type="button"
                            onClick={handleExpandAll}
                            className="px-2.5 py-1 text-xs font-bold text-slate-800 hover:text-emerald-800 hover:bg-emerald-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1 bg-white shadow-2xs whitespace-nowrap cursor-pointer"
                        >
                            <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
                            Expand All
                        </button>
                        <button
                            type="button"
                            onClick={handleCollapseToManagers}
                            className="px-2.5 py-1 text-xs font-bold text-slate-800 hover:text-amber-800 hover:bg-amber-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1 bg-white shadow-2xs whitespace-nowrap cursor-pointer"
                        >
                            <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                            Collapse
                        </button>
                        {onToggleFullscreen && (
                            <button
                                type="button"
                                onClick={onToggleFullscreen}
                                title={isFullscreen ? "Exit Full Display (Esc)" : "View tree in Full Display Only Page"}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-2xs whitespace-nowrap cursor-pointer ${
                                    isFullscreen
                                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                                        : 'bg-emerald-700 text-white hover:bg-emerald-800'
                                }`}
                            >
                                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                                <span>{isFullscreen ? 'Exit Full Display' : 'Full Screen'}</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Interactive Vector & DOM Tree Viewport */}
            <div 
                className="flex-1 min-h-[450px] relative overflow-hidden cursor-grab active:cursor-grabbing bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:18px_18px]"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
            >
                {/* Scalable & Pannable Canvas Board */}
                <div 
                    ref={chartAreaRef}
                    className="absolute top-0 left-0 transition-transform duration-75 ease-out"
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                        transformOrigin: '0 0',
                        width: `${bounds.width}px`,
                        height: `${bounds.height}px`
                    }}
                >
                    {/* SVG Connector Paths */}
                    <svg 
                        className="absolute inset-0 pointer-events-none"
                        width={bounds.width} 
                        height={bounds.height}
                    >
                        <defs>
                            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.6" />
                            </linearGradient>
                            <linearGradient id="activeLineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#059669" stopOpacity="1" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
                            </linearGradient>
                        </defs>

                        {layoutConnectors.map(({ id, parent, child }) => {
                            if (parent.x === undefined || parent.y === undefined || child.x === undefined || child.y === undefined) return null;

                            const px = parent.x + CARD_WIDTH / 2;
                            const py = parent.y + CARD_HEIGHT;
                            const cx = child.x + CARD_WIDTH / 2;
                            const cy = child.y;

                            const isVertical = Math.abs(px - cx) < 0.5;
                            const midY = (py + cy) / 2;
                            const pathData = isVertical
                                ? `M ${px} ${py} L ${cx} ${cy}`
                                : `M ${px} ${py} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${cy}`;

                            const isHighlighted = selectedNode && (selectedNode.id === child.id || selectedNode.id === parent.id);

                            // Note: SVG linearGradient with default gradientUnits="objectBoundingBox"
                            // is unpainted by browsers on 0-width paths (purely vertical lines where px === cx).
                            // Using a direct stroke color on vertical lines ensures they are always rendered.
                            const strokeColor = isHighlighted
                                ? (isVertical ? '#059669' : 'url(#activeLineGrad)')
                                : (isVertical ? '#94a3b8' : 'url(#lineGrad)');

                            return (
                                <g key={id}>
                                    <path
                                        d={pathData}
                                        fill="none"
                                        stroke={strokeColor}
                                        strokeWidth={isHighlighted ? 2.5 : 1.8}
                                        strokeLinecap="round"
                                    />
                                    {/* Connection joint dots */}
                                    <circle cx={px} cy={py} r={2} fill={isHighlighted ? '#059669' : '#94a3b8'} />
                                    <circle cx={cx} cy={cy} r={2.5} fill={isHighlighted ? '#059669' : '#94a3b8'} />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Rich HTML DOM Org Cards */}
                    {layoutNodes.map(node => {
                        if (node.x === undefined || node.y === undefined) return null;

                        const theme = getRoleTheme(node.role);
                        const isCollapsed = collapsedNodes.has(node.id);
                        const hasChildren = node.children && node.children.length > 0;
                        const isSelected = selectedNode?.id === node.id;
                        const isMatch = !!searchQuery && (
                            (node.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (node.role || '').toLowerCase().includes(searchQuery.toLowerCase())
                        );
                        const isUnassigned = !node.reportingManagerId;
                        const statusInfo = getUserActivityStatus(node);
                        const userLoc = resolveLocation(node);
                        const isInactive = !statusInfo.isActive;

                        return (
                            <div
                                key={node.id}
                                onClick={() => setSelectedNode(isSelected ? null : node)}
                                className={`org-card absolute rounded-xl bg-white border cursor-pointer transition-all duration-150 select-none shadow-sm hover:shadow-md ${
                                    isInactive ? 'border-rose-300 ring-1 ring-rose-200/80 bg-rose-50/10' : theme.border
                                } ${
                                    isSelected || isMatch
                                        ? 'ring-3 ring-emerald-500/30 border-emerald-500 shadow-md'
                                        : 'hover:border-slate-400'
                                }`}
                                style={{
                                    left: `${node.x}px`,
                                    top: `${node.y}px`,
                                    width: `${CARD_WIDTH}px`,
                                    height: `${CARD_HEIGHT}px`
                                }}
                            >
                                {/* Left Color Accent Strip */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${
                                    isInactive ? 'bg-rose-500' : isUnassigned ? 'bg-amber-500' : theme.accent
                                }`} />

                                <div className="p-2.5 pl-3.5 h-full flex flex-col justify-between">
                                    {/* Top Row: Avatar + Name + Role */}
                                    <div className="flex items-center gap-2 min-w-0">
                                        <WorkflowUserAvatar user={node} theme={theme} size="w-8 h-8" />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-xs text-slate-900 truncate leading-snug" title={node.name}>
                                                {node.name}
                                            </p>
                                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold border ${theme.badgeBg}`}>
                                                    {getRoleDisplayName(node.role)}
                                                </span>
                                                {isInactive && (
                                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300 uppercase tracking-tight" title={statusInfo.reason || statusInfo.label}>
                                                        <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                                        {statusInfo.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Location / Status & Actions */}
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                                        <div className="flex items-center gap-1 min-w-0 truncate">
                                            {/* Explicit Active or Inactive Badge */}
                                            {statusInfo.isActive ? (
                                                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex-shrink-0">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded flex-shrink-0" title={statusInfo.reason || 'Inactive user'}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                                    Inactive
                                                </span>
                                            )}

                                            {userLoc ? (
                                                <span className="truncate max-w-[70px] text-slate-500 font-medium" title={userLoc}>
                                                    📍 {userLoc}
                                                </span>
                                            ) : isUnassigned ? (
                                                <span className="truncate max-w-[65px] text-amber-600 font-bold" title="Needs Reporting Manager">
                                                    ⚠️ Needs Mgr
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {/* Delete Option for Inactive Users */}
                                            {isInactive && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setUserToDelete(node);
                                                    }}
                                                    title={`Delete inactive user "${node.name}"`}
                                                    className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center gap-0.5 cursor-pointer transition-colors"
                                                >
                                                    <Trash2 className="w-2.5 h-2.5" />
                                                    Delete
                                                </button>
                                            )}

                                            {hasChildren && (
                                                <>
                                                    {statusInfo.label === 'Left' && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openReassignModal(node);
                                                            }}
                                                            title="Manager has left! Click to reassign direct reports to a new manager"
                                                            className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-0.5 cursor-pointer transition-colors"
                                                        >
                                                            <ArrowRightLeft className="w-2.5 h-2.5" />
                                                            Reassign
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => toggleNodeCollapse(node.id, e)}
                                                        className={`org-card-button px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 border transition-colors ${
                                                            isCollapsed
                                                                ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                                                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                                        }`}
                                                    >
                                                        {isCollapsed ? (
                                                            <>
                                                                <ChevronRight className="w-3 h-3 text-amber-700" />
                                                                <span>+{node.children!.length}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronDown className="w-3 h-3 text-slate-600" />
                                                                <span>{node.children!.length}</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Selected Node Inspector Drawer */}
            {selectedNode && (
                <div className="absolute top-14 right-4 z-30 w-84 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl p-5 animate-fade-in-scale max-h-[85vh] overflow-y-auto">
                    <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-3">
                        <div className="flex items-center gap-3">
                            <WorkflowUserAvatar user={selectedNode} theme={getRoleTheme(selectedNode.role)} size="w-10 h-10" textSize="text-sm" rounded="rounded-xl" />
                            <div>
                                <h4 className="font-bold text-slate-900 text-sm">{selectedNode.name}</h4>
                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getRoleTheme(selectedNode.role).badgeBg}`}>
                                        {getRoleDisplayName(selectedNode.role)}
                                    </span>
                                    {(() => {
                                        const sInfo = getUserActivityStatus(selectedNode);
                                        return sInfo.isActive ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300 uppercase tracking-tight">
                                                <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                                {sInfo.label}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedNode(null);
                                setIsEditingL1Manager(false);
                            }}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-3 text-xs text-slate-700">
                        {/* Delete Inactive User Callout Button in Drawer */}
                        {!getUserActivityStatus(selectedNode).isActive && (
                            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-bold text-xs text-rose-900">User is Inactive</p>
                                    <p className="text-[10px] text-rose-700 truncate">
                                        {getUserActivityStatus(selectedNode).reason || 'Can be permanently deleted'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setUserToDelete(selectedNode)}
                                    className="px-2.5 py-1.5 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors flex-shrink-0"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                </button>
                            </div>
                        )}
                        {/* Manager Left Alert Banner */}
                        {isUserLeft(selectedNode) && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                                <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                    <span>Employee Has Left / Relieved</span>
                                </div>
                                {selectedNode.leftDate && (
                                    <p className="text-[11px] text-rose-700 pl-5">
                                        Exit Date: <strong>{selectedNode.leftDate}</strong>
                                        {selectedNode.exitReason ? ` • ${selectedNode.exitReason}` : ''}
                                    </p>
                                )}
                                {selectedNode.children && selectedNode.children.length > 0 && (
                                    <p className="text-[11px] text-rose-800 font-semibold pl-5 pt-0.5">
                                        ⚠️ Still has <strong>{selectedNode.children.length} direct report(s)</strong> assigned. Reassign them below to prevent workflow bottlenecks!
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Direct Reports Reassignment Callout Button */}
                        {selectedNode.children && selectedNode.children.length > 0 && (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => openReassignModal(selectedNode)}
                                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer ${
                                        isUserLeft(selectedNode)
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                            : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                    }`}
                                >
                                    <ArrowRightLeft className="w-4 h-4" />
                                    <span>Reassign {selectedNode.children.length} Direct Report{selectedNode.children.length > 1 ? 's' : ''}</span>
                                </button>
                            </div>
                        )}

                        {selectedNode.location && (
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span>Location: <strong>{selectedNode.location}</strong></span>
                            </div>
                        )}
                        {selectedNode.email && (
                            <div className="flex items-center gap-2 truncate">
                                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{selectedNode.email}</span>
                            </div>
                        )}
                        {selectedNode.phone && (
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span>{selectedNode.phone}</span>
                            </div>
                        )}

                        {/* Approval Escalation & Reporting Manager */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Approval Escalation</p>
                            
                            {/* L1 Reporting Manager */}
                            <div className="space-y-1">
                                {isEditingL1Manager ? (
                                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                        <label className="text-[11px] font-bold text-slate-700 block">
                                            Select New L1 Manager for {selectedNode.name}:
                                        </label>
                                        <select
                                            value={selectedL1ManagerId}
                                            onChange={e => setSelectedL1ManagerId(e.target.value)}
                                            className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        >
                                            <option value="">-- No Manager (None) --</option>
                                            {eligibleL1ManagersForSelectedNode.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name} ({getRoleDisplayName(u.role)})
                                                </option>
                                            ))}
                                        </select>
                                        <div className="flex items-center justify-end gap-1.5 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingL1Manager(false)}
                                                disabled={isSavingL1Manager}
                                                className="px-2.5 py-1 rounded text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveIndividualL1Manager}
                                                disabled={isSavingL1Manager}
                                                className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                            >
                                                {isSavingL1Manager ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <p className="text-slate-800">
                                            L1 Manager: <strong>{selectedNode.managerName || '⚠️ Unassigned'}</strong>
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedL1ManagerId(selectedNode.reportingManagerId || '');
                                                setIsEditingL1Manager(true);
                                            }}
                                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-0.5 cursor-pointer"
                                        >
                                            <Edit2 className="w-3 h-3" /> Change
                                        </button>
                                    </div>
                                )}
                            </div>

                            {selectedNode.manager2Name && (
                                <p className="text-slate-800">L2 Manager: <strong>{selectedNode.manager2Name}</strong></p>
                            )}
                            
                            {/* Direct Reports Mini List */}
                            {selectedNode.children && selectedNode.children.length > 0 && (
                                <div className="pt-1">
                                    <p className="text-emerald-800 font-bold text-[11px] mb-1">
                                        Direct Reports ({selectedNode.children.length}):
                                    </p>
                                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                        {selectedNode.children.map(child => (
                                            <div key={child.id} className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
                                                <span className="font-semibold text-slate-800 truncate">{child.name}</span>
                                                <span className="text-[10px] text-slate-500 flex-shrink-0">{getRoleDisplayName(child.role)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {onSelectEmployeeForTrace && (
                            <div className="pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => onSelectEmployeeForTrace(selectedNode.id)}
                                    className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                    Trace Approval Chain
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Reassign Direct Reports Modal */}
            {reassignModalTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div 
                        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-scale"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-rose-100 text-rose-700 border border-rose-200">
                                    <ArrowRightLeft className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                                        Reassign Direct Reports
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Current Manager: <strong>{reassignModalTarget.name}</strong> ({getRoleDisplayName(reassignModalTarget.role)})
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReassignModalTarget(null)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-5 overflow-y-auto space-y-4 text-xs">
                            {/* Warning Banner if Manager has left */}
                            {isUserLeft(reassignModalTarget) && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-900">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-xs">
                                            {reassignModalTarget.name} has left the company {reassignModalTarget.leftDate ? `(${reassignModalTarget.leftDate})` : ''}
                                        </p>
                                        <p className="text-[11px] text-rose-800 mt-0.5">
                                            Reassigning direct reports ensures leave applications, task escalations, and attendance approvals are not orphaned.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Select New Manager */}
                            <div className="space-y-1.5">
                                <label className="font-bold text-slate-800 block text-xs">
                                    1. Choose New Reporting Manager: <span className="text-rose-500">*</span>
                                </label>
                                
                                {/* Search input */}
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search active employee by name or role..."
                                        value={managerSearchQuery}
                                        onChange={e => setManagerSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                                    />
                                </div>

                                {/* Manager Selection Box */}
                                <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white">
                                    {eligibleNewManagers.length === 0 ? (
                                        <p className="p-3 text-center text-slate-400 text-xs">
                                            No eligible active managers found matching "{managerSearchQuery}"
                                        </p>
                                    ) : (
                                        eligibleNewManagers.map(mgr => {
                                            const isSelected = selectedNewManagerId === mgr.id;
                                            return (
                                                <div
                                                    key={mgr.id}
                                                    onClick={() => setSelectedNewManagerId(mgr.id)}
                                                    className={`p-2 px-3 flex items-center justify-between cursor-pointer transition-colors ${
                                                        isSelected ? 'bg-emerald-50 text-emerald-950 font-semibold' : 'hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <WorkflowUserAvatar user={mgr} theme={getRoleTheme(mgr.role)} size="w-7 h-7" textSize="text-xs" />
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-900 truncate">{mgr.name}</p>
                                                            <p className="text-[10px] text-slate-500 truncate">{getRoleDisplayName(mgr.role)} {mgr.location ? `• ${mgr.location}` : ''}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isSelected ? (
                                                            <span className="p-1 rounded-full bg-emerald-700 text-white">
                                                                <Check className="w-3 h-3" />
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-semibold text-slate-400">Select</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Direct Reports Checkbox List */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="font-bold text-slate-800 text-xs">
                                        2. Select Direct Reports to Transfer ({selectedDirectReportIds.size}/{(reassignModalTarget.children || []).length}):
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allIds = new Set((reassignModalTarget.children || []).map(c => c.id));
                                                setSelectedDirectReportIds(allIds);
                                            }}
                                            className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-slate-300">|</span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDirectReportIds(new Set())}
                                            className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>

                                <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white">
                                    {(reassignModalTarget.children || []).map(child => {
                                        const isChecked = selectedDirectReportIds.has(child.id);
                                        return (
                                            <label
                                                key={child.id}
                                                className={`p-2 px-3 flex items-center justify-between cursor-pointer transition-colors ${
                                                    isChecked ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {
                                                            const next = new Set(selectedDirectReportIds);
                                                            if (isChecked) next.delete(child.id);
                                                            else next.add(child.id);
                                                            setSelectedDirectReportIds(next);
                                                        }}
                                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-xs text-slate-900 truncate">{child.name}</p>
                                                        <p className="text-[10px] text-slate-500 truncate">{getRoleDisplayName(child.role)} {child.location ? `• ${child.location}` : ''}</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                    {child.role ? child.role.replace(/_/g, ' ') : 'Staff'}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Escalation Slot */}
                            <div className="space-y-1">
                                <label className="font-bold text-slate-800 text-xs block">
                                    3. Assign to Escalation Level:
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { slot: 1 as const, title: 'L1 Primary', desc: 'First-line approver' },
                                        { slot: 2 as const, title: 'L2 Secondary', desc: 'Second level' },
                                        { slot: 3 as const, title: 'L3 Escalation', desc: 'Final tier' },
                                    ].map(item => (
                                        <button
                                            key={item.slot}
                                            type="button"
                                            onClick={() => setReassignSlot(item.slot)}
                                            className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                                                reassignSlot === item.slot
                                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500'
                                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <p className="font-bold text-xs">{item.title}</p>
                                            <p className="text-[10px] text-slate-500">{item.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80">
                            <button
                                type="button"
                                onClick={() => setReassignModalTarget(null)}
                                disabled={isReassigning}
                                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmReassignment}
                                disabled={isReassigning || !selectedNewManagerId || selectedDirectReportIds.size === 0}
                                className={`px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                                    isReassigning || !selectedNewManagerId || selectedDirectReportIds.size === 0
                                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                        : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/20'
                                }`}
                            >
                                {isReassigning ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Reassigning...</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowRightLeft className="w-4 h-4" />
                                        <span>Reassign {selectedDirectReportIds.size} Reports</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Inactive User Confirmation Modal */}
            {userToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div 
                        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-fade-in-scale"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/80">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-rose-100 text-rose-700 border border-rose-200">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                                        Delete Inactive User
                                    </h3>
                                    <p className="text-xs text-rose-700 mt-0.5 font-medium">
                                        Permanent removal from workflow & system
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setUserToDelete(null)}
                                disabled={isDeletingUser}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-4 text-xs text-slate-700">
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                                <WorkflowUserAvatar user={userToDelete} theme={getRoleTheme(userToDelete.role)} size="w-10 h-10" />
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-900 text-sm truncate">{userToDelete.name}</p>
                                    <p className="text-slate-500 text-[11px] truncate">{userToDelete.email || 'No email registered'}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded">
                                            {getRoleDisplayName(userToDelete.role)}
                                        </span>
                                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded">
                                            {getUserActivityStatus(userToDelete).label}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-amber-900">
                                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                    <span>Permanent Action</span>
                                </div>
                                <p className="text-[11px] text-amber-800 pl-5">
                                    This user will be permanently deleted from the database. All biometric assignments, records, and login permissions will be removed.
                                </p>
                                {userToDelete.children && userToDelete.children.length > 0 && (
                                    <p className="text-[11px] text-amber-900 font-semibold pl-5 pt-1">
                                        ⚠️ This user has <strong>{userToDelete.children.length} direct report(s)</strong>. They will automatically be linked to this user's manager to prevent workflow disconnection.
                                    </p>
                                )}
                            </div>

                            <p className="text-slate-600 text-[11px]">
                                Are you sure you want to permanently delete <strong>{userToDelete.name}</strong>?
                            </p>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setUserToDelete(null)}
                                disabled={isDeletingUser}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteUser}
                                disabled={isDeletingUser}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {isDeletingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                <span>{isDeletingUser ? 'Deleting...' : 'Delete Permanently'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification Banner */}
            {toastNotification && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in-scale">
                    <div className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
                        toastNotification.type === 'success' 
                            ? 'bg-emerald-800 text-white border-emerald-900' 
                            : 'bg-rose-800 text-white border-rose-900'
                    }`}>
                        {toastNotification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <AlertTriangle className="w-4 h-4 text-rose-300" />}
                        <span>{toastNotification.message}</span>
                        <button onClick={() => setToastNotification(null)} className="ml-2 hover:opacity-80 cursor-pointer">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowChart2D;
