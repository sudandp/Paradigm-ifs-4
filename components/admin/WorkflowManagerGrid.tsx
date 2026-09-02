import React, { useState, useMemo } from 'react';
import type { User, Role } from '../../types';
import { 
    Users, 
    Search, 
    AlertTriangle, 
    ChevronDown, 
    ChevronUp, 
    Layers 
} from 'lucide-react';
import Select from '../ui/Select';

interface WorkflowManagerGridProps {
    users: (User & { managerName?: string; manager2Name?: string; manager3Name?: string })[];
    allRoles: Role[];
    onManagerChange?: (userId: string, managerId: string, slot: 1 | 2 | 3) => void;
    onSave?: () => void;
}

const getRoleBadgeStyle = (role: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('admin') || r.includes('management') || r.includes('director')) {
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/90';
    }
    if (r.includes('site_manager') || r.includes('manager') || r.includes('operation')) {
        return 'bg-amber-50 text-amber-800 border-amber-200/90';
    }
    if (r.includes('hr') || r.includes('recruitment')) {
        return 'bg-blue-50 text-blue-800 border-blue-200/90';
    }
    if (r.includes('field') || r.includes('staff')) {
        return 'bg-sky-50 text-sky-800 border-sky-200/90';
    }
    if (r.includes('electrician') || r.includes('plumber') || r.includes('technician') || r.includes('security') || r.includes('hk')) {
        return 'bg-teal-50 text-teal-800 border-teal-200/90';
    }
    if (r.includes('finance') || r.includes('account')) {
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/90';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200/90';
};

const WorkflowManagerGrid: React.FC<WorkflowManagerGridProps> = ({
    users,
    allRoles,
    onManagerChange,
    onSave
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
    const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
    const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');

    const getRoleDisplayName = (roleId: string = '') => {
        const found = allRoles.find(r => r.id === roleId || r.id.toLowerCase() === roleId.toLowerCase());
        if (found?.displayName) return found.displayName;
        return roleId ? roleId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Staff';
    };

    // Grouping by Manager
    const { managerGroups, unassignedUsers } = useMemo(() => {
        const groups = new Map<string, { manager: User; team: User[] }>();
        const unassigned: User[] = [];

        // Build index of all users by id
        const userMap = new Map<string, User>();
        users.forEach(u => userMap.set(u.id, u));

        // Group team members under their L1 reporting manager
        users.forEach(u => {
            if (u.reportingManagerId) {
                const mgr = userMap.get(u.reportingManagerId);
                if (mgr) {
                    if (!groups.has(mgr.id)) {
                        groups.set(mgr.id, { manager: mgr, team: [] });
                    }
                    groups.get(mgr.id)!.team.push(u);
                } else {
                    unassigned.push(u);
                }
            } else {
                unassigned.push(u);
            }
        });

        // Convert to sorted array by team size descending
        const sortedGroups = Array.from(groups.values()).sort((a, b) => b.team.length - a.team.length);

        return { managerGroups: sortedGroups, unassignedUsers: unassigned };
    }, [users]);

    // Expand all managers by default on first load if small, or keep first few open
    React.useEffect(() => {
        if (managerGroups.length > 0 && expandedManagers.size === 0) {
            const initialExpanded = new Set<string>();
            managerGroups.slice(0, 3).forEach(g => initialExpanded.add(g.manager.id));
            setExpandedManagers(initialExpanded);
        }
    }, [managerGroups]);

    const toggleManager = (managerId: string) => {
        setExpandedManagers(prev => {
            const next = new Set(prev);
            if (next.has(managerId)) {
                next.delete(managerId);
            } else {
                next.add(managerId);
            }
            return next;
        });
    };

    const expandAll = () => {
        const all = new Set<string>(managerGroups.map(g => g.manager.id));
        setExpandedManagers(all);
    };

    const collapseAll = () => {
        setExpandedManagers(new Set());
    };

    // Filtered manager groups
    const filteredManagerGroups = useMemo(() => {
        if (!searchQuery.trim() && selectedRoleFilter === 'all') return managerGroups;

        const q = searchQuery.toLowerCase().trim();

        return managerGroups
            .map(group => {
                const mgrMatch = (group.manager.name || '').toLowerCase().includes(q) ||
                                 (group.manager.role || '').toLowerCase().includes(q);
                
                const filteredTeam = group.team.filter(u => {
                    const nameMatch = (u.name || '').toLowerCase().includes(q);
                    const roleMatch = (u.role || '').toLowerCase().includes(q) || getRoleDisplayName(u.role).toLowerCase().includes(q);
                    const locationMatch = (u.location || '').toLowerCase().includes(q);
                    const searchPass = !q || nameMatch || roleMatch || locationMatch || mgrMatch;
                    const rolePass = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
                    return searchPass && rolePass;
                });

                if (mgrMatch || filteredTeam.length > 0) {
                    return {
                        manager: group.manager,
                        team: filteredTeam
                    };
                }
                return null;
            })
            .filter((g): g is { manager: User; team: User[] } => g !== null);
    }, [managerGroups, searchQuery, selectedRoleFilter, allRoles]);

    // Filtered unassigned
    const filteredUnassigned = useMemo(() => {
        if (!searchQuery.trim() && selectedRoleFilter === 'all') return unassignedUsers;

        const q = searchQuery.toLowerCase().trim();
        return unassignedUsers.filter(u => {
            const nameMatch = (u.name || '').toLowerCase().includes(q);
            const roleMatch = (u.role || '').toLowerCase().includes(q) || getRoleDisplayName(u.role).toLowerCase().includes(q);
            const locationMatch = (u.location || '').toLowerCase().includes(q);
            const searchPass = !q || nameMatch || roleMatch || locationMatch;
            const rolePass = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
            return searchPass && rolePass;
        });
    }, [unassignedUsers, searchQuery, selectedRoleFilter, allRoles]);

    return (
        <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search managers or employees..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-page border border-border rounded-lg text-xs text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowOnlyUnassigned(!showOnlyUnassigned)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                            showOnlyUnassigned 
                                ? 'bg-amber-600 text-white border-amber-600' 
                                : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                        }`}
                    >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        Unassigned ({unassignedUsers.length})
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={expandAll}
                        className="px-3 py-1.5 text-xs font-semibold text-muted hover:text-primary-text bg-page border border-border rounded-lg transition-colors"
                    >
                        Expand All
                    </button>
                    <button
                        type="button"
                        onClick={collapseAll}
                        className="px-3 py-1.5 text-xs font-semibold text-muted hover:text-primary-text bg-page border border-border rounded-lg transition-colors"
                    >
                        Collapse All
                    </button>
                </div>
            </div>

            {/* UNASSIGNED SECTION (CRITICAL ATTENTION) */}
            {(showOnlyUnassigned || unassignedUsers.length > 0) && (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/90 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                            <h4 className="font-bold text-amber-950 text-sm">
                                Needs Reporting Manager ({filteredUnassigned.length} of {unassignedUsers.length})
                            </h4>
                        </div>
                        <span className="text-xs text-amber-900 font-medium">
                            Directly assign an L1 manager to connect them to the approval workflow
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredUnassigned.slice(0, 12).map(user => (
                            <div key={user.id} className="p-3 bg-card border border-amber-200/70 rounded-lg shadow-sm space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                            {(user.name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-xs text-primary-text truncate">{user.name}</p>
                                            <p className="text-[10px] text-muted truncate">{getRoleDisplayName(user.role)}</p>
                                        </div>
                                    </div>
                                    {user.location && (
                                        <span className="text-[10px] text-muted whitespace-nowrap">📍 {user.location}</span>
                                    )}
                                </div>

                                {onManagerChange && (
                                    <div className="pt-1">
                                        <Select
                                            label=""
                                            id={`assign-mgr-${user.id}`}
                                            value=""
                                            onChange={e => onManagerChange(user.id, e.target.value, 1)}
                                            className="text-xs border-amber-300 bg-amber-50/50"
                                        >
                                            <option value="">⚡ Assign Manager...</option>
                                            {users.filter(m => m.id !== user.id).map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name} ({getRoleDisplayName(m.role)})
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {filteredUnassigned.length > 12 && (
                        <p className="text-xs text-amber-900 mt-3 text-center">
                            + {filteredUnassigned.length - 12} more unassigned employees. Use search or Table View for full roster.
                        </p>
                    )}
                </div>
            )}

            {/* MANAGER TEAM ROSTERS */}
            {!showOnlyUnassigned && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-primary-text text-sm flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            Assigned Manager Roster ({filteredManagerGroups.length} Teams)
                        </h4>
                        <span className="text-xs text-muted">
                            Total {users.length - unassignedUsers.length} assigned employees
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredManagerGroups.map(({ manager, team }) => {
                            const isExpanded = expandedManagers.has(manager.id);
                            const roleBadgeCls = getRoleBadgeStyle(manager.role);

                            return (
                                <div 
                                    key={manager.id} 
                                    className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                                >
                                    {/* Manager Header Card */}
                                    <div 
                                        onClick={() => toggleManager(manager.id)}
                                        className="p-4 bg-page/40 hover:bg-page/70 border-b border-border cursor-pointer flex items-center justify-between gap-3 select-none transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-inner">
                                                {(manager.name || 'M').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-primary-text text-sm truncate">{manager.name}</h4>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${roleBadgeCls}`}>
                                                        {getRoleDisplayName(manager.role)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted flex items-center gap-2 mt-0.5 truncate">
                                                    {manager.location && <span>📍 {manager.location}</span>}
                                                    {manager.email && <span>✉️ {manager.email}</span>}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                                <Users className="w-3 h-3 mr-1" />
                                                {team.length} {team.length === 1 ? 'Report' : 'Reports'}
                                            </span>
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                                        </div>
                                    </div>

                                    {/* Direct Team Members Sub-Roster */}
                                    {isExpanded && (
                                        <div className="p-3 bg-card divide-y divide-border/60">
                                            {team.length === 0 ? (
                                                <div className="py-4 text-center text-xs text-muted">
                                                    No direct reports assigned matching current search.
                                                </div>
                                            ) : (
                                                team.map(member => (
                                                    <div key={member.id} className="py-2 px-1.5 flex items-center justify-between gap-2 hover:bg-page/50 rounded-lg transition-colors">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center flex-shrink-0 border border-slate-200">
                                                                {(member.name || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-xs text-primary-text truncate">{member.name}</p>
                                                                <p className="text-[10px] text-muted truncate">{getRoleDisplayName(member.role)}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            {member.location && (
                                                                <span className="text-[10px] text-muted hidden sm:inline">📍 {member.location}</span>
                                                            )}
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getRoleBadgeStyle(member.role)}`}>
                                                                {getRoleDisplayName(member.role)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowManagerGrid;
