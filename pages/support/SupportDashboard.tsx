import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { SupportTicket, User } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { Loader2, Plus, LifeBuoy, Users, Phone, MessageSquare, MessageCircle, Video, Search, Filter, UserCheck, AlertTriangle, Download, Trophy, Award, Info } from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { formatDistanceToNow } from 'date-fns';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { getAllPreComputedScores, calculateAllEmployeeScores, type EmployeeScoreWithUser } from '../../services/employeeScoring';
import { isAdmin } from '../../utils/auth';


const PriorityIndicator: React.FC<{ priority: SupportTicket['priority'] }> = ({ priority }) => {
    const styles = {
        Low: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
        Medium: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]',
        High: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]',
        Urgent: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    };
    return <span className={`w-3 h-3 rounded-full ${styles[priority]}`} title={`Priority: ${priority}`}></span>;
};

const StatusChip: React.FC<{ status: SupportTicket['status'] }> = ({ status }) => {
    const styles = {
        Open: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        'In Progress': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        'Pending Requester': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        Resolved: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        Closed: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    };

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
            {status}
        </span>
    );
};

const TicketCard: React.FC<{ ticket: SupportTicket, onClick: () => void }> = ({ ticket, onClick }) => (
    <div
        onClick={onClick}
        className="group bg-card hover:bg-accent/5 p-5 rounded-xl border border-border hover:border-accent cursor-pointer transition-all duration-300 flex flex-col justify-between h-full shadow-sm hover:shadow-md"
    >
        <div>
            <div className="flex justify-between items-start gap-3 mb-2">
                <h4 className="font-bold text-primary-text leading-snug group-hover:text-accent transition-colors line-clamp-2">
                    {ticket.title}
                </h4>
                <div className="flex-shrink-0 mt-1"><PriorityIndicator priority={ticket.priority} /></div>
            </div>
            <p className="text-xs text-muted font-mono">#{ticket.ticketNumber}</p>
        </div>
        <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex justify-between items-center text-xs text-muted mb-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-white font-bold">
                        {ticket.raisedByName.charAt(0)}
                    </div>
                    <span>{ticket.raisedByName}</span>
                </div>
                <span>{formatDistanceToNow(new Date(ticket.raisedAt), { addSuffix: true })}</span>
            </div>
            <div className="flex justify-between items-center">
                <StatusChip status={ticket.status} />
            </div>
        </div>
    </div>
);

const NearbyUserItem: React.FC<{ 
    user: User, 
    onAction: (targetUser: User, type: 'call' | 'sms' | 'whatsapp') => void,
    onPing: (user: User) => void
}> = ({ user, onAction, onPing }) => (
    <div className={`flex items-center gap-4 p-3 rounded-xl bg-card border transition-colors ${user.isNearby ? 'border-accent/40 bg-accent/5' : 'border-border hover:border-accent/50'}`}>
        <div className="relative flex-shrink-0">
            <ProfilePlaceholder photoUrl={user.photoUrl} seed={user.id} className="w-12 h-12 rounded-full shadow-sm" />
            <span className={`absolute -bottom-0.5 -right-0.5 block h-4 w-4 rounded-full ${user.isAvailable ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-rose-600 shadow-[0_0_6px_rgba(225,29,72,0.6)]'} ring-2 ring-white`}></span>
        </div>
        <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-primary-text truncate">{user.name}</p>
                {user.isNearby && (
                    <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Nearby</span>
                )}
            </div>
            <p className="text-xs text-muted truncate">
                {user.locationName && <span className="text-accent/80 font-medium">{user.locationName} • </span>}
                {user.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>
        </div>
        <div className="flex items-center gap-1">
            <Button
                variant="icon"
                size="sm"
                className="hover:opacity-90 transition-opacity border"
                style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }}
                title="Ping (Internal)"
                onClick={() => onPing(user)}
            >
                <AlertTriangle className="h-4 w-4" />
            </Button>
            <Button
                variant="icon"
                size="sm"
                className="hover:opacity-90 transition-opacity border"
                style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }}
                title="Call"
                onClick={() => onAction(user, 'call')}
            >
                <Phone className="h-4 w-4" />
            </Button>
            <Button
                variant="icon"
                size="sm"
                className="hover:opacity-90 transition-opacity border"
                style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }}
                title="SMS"
                onClick={() => onAction(user, 'sms')}
            >
                <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
                variant="icon"
                size="sm"
                className="hover:opacity-90 transition-opacity border"
                style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }}
                title="WhatsApp"
                onClick={() => onAction(user, 'whatsapp')}
            >
                <MessageSquare className="h-4 w-4" />
            </Button>
        </div>
    </div>
);

const SupportDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [nearbyUsers, setNearbyUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isNearbyModalOpen, setIsNearbyModalOpen] = useState(false);
    const isMobile = useMediaQuery('(max-width: 767px)');

    // Top Performers state
    const [allScores, setAllScores] = useState<EmployeeScoreWithUser[]>([]);
    const [scoresLoading, setScoresLoading] = useState(true);
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [showAllScores, setShowAllScores] = useState<boolean>(false);
    const [hasSetDefaultRole, setHasSetDefaultRole] = useState(false);
    const [isScoreInfoModalOpen, setIsScoreInfoModalOpen] = useState(false);

    const [filters, setFilters] = useState({
        status: 'all',
        priority: 'all',
        searchTerm: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            setIsLoading(true);
            try {
                const [ticketsData, usersData] = await Promise.all([
                    api.getSupportTickets(),
                    api.getNearbyUsers(user.id)
                ]);
                setTickets(ticketsData);
                // Show only online users near the logged-in user's location
                setNearbyUsers(usersData.nearbyOnline);
            } catch (error) {
                setToast({ message: 'Failed to load support data.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user]);

    // Fetch all employee scores — instant load from pre-computed, then background refresh
    useEffect(() => {
        const fetchScores = async () => {
            setScoresLoading(true);
            try {
                // Step 1: Load pre-computed scores instantly (fast path)
                const cachedScores = await getAllPreComputedScores();
                setAllScores(cachedScores);
                setScoresLoading(false);

                // Step 2: Background refresh (silent, won't block UI)
                if (isAdmin(user?.role)) {
                    calculateAllEmployeeScores().then(freshScores => {
                        if (freshScores && freshScores.length > 0) {
                            setAllScores(freshScores);
                        }
                    }).catch(err => {
                        console.error('Background score refresh failed:', err);
                    });
                }
            } catch (err) {
                console.error('Failed to load employee scores:', err);
                setScoresLoading(false);
            }
        };
        fetchScores();
    }, []);

    // Group scores by role — top 3 per role for all users
    const userIsAdmin = isAdmin(user?.role);

    // Unique roles from scores
    const uniqueRoles = useMemo(() => {
        const roles = new Set(allScores.map(s => s.userRole));
        return Array.from(roles).sort();
    }, [allScores]);

    useEffect(() => {
        if (!hasSetDefaultRole && user?.role && uniqueRoles.length > 0) {
            if (uniqueRoles.includes(user.role)) {
                setRoleFilter(user.role);
            }
            setHasSetDefaultRole(true);
        }
    }, [user, uniqueRoles, hasSetDefaultRole]);

    // Grouped: { roleName: top3Employees[] }
    const scoresByRole = useMemo(() => {
        const roles = roleFilter !== 'all' ? [roleFilter] : uniqueRoles;
        const grouped: { role: string; label: string; employees: EmployeeScoreWithUser[] }[] = [];
        for (const role of roles) {
            let employees = allScores.filter(s => s.userRole === role);
            if (!showAllScores) {
                employees = employees.slice(0, 3);
            }
            if (employees.length > 0) {
                grouped.push({
                    role,
                    label: role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    employees: employees,
                });
            }
        }
        return grouped;
    }, [allScores, uniqueRoles, roleFilter, showAllScores]);

    // Flat list for CSV download
    const filteredScores = useMemo(() => scoresByRole.flatMap(g => g.employees), [scoresByRole]);

    // CSV download (admin only)
    const downloadReport = () => {
        const header = 'Rank,Name,Role,Performance,Attendance,Response,Overall';
        const rows = filteredScores.map((s, i) =>
            `${i + 1},"${s.userName}","${s.userRole.replace(/_/g, ' ')}",${s.scores.performanceScore},${s.scores.attendanceScore},${s.scores.responseScore},${s.scores.overallScore}`
        );
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Top_Performers_Report_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredTickets = useMemo(() => {
        return tickets.filter(ticket => {
            const statusMatch = filters.status === 'all' || ticket.status === filters.status;
            const priorityMatch = filters.priority === 'all' || ticket.priority === filters.priority;
            const searchMatch = filters.searchTerm === '' ||
                ticket.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                ticket.ticketNumber.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                ticket.description.toLowerCase().includes(filters.searchTerm.toLowerCase());
            return statusMatch && priorityMatch && searchMatch;
        });
    }, [tickets, filters]);

    const stats = useMemo(() => {
        const userActionTickets = tickets.filter(t => t.status === 'Resolved' && t.raisedById === user?.id);
        return {
            open: tickets.filter(t => t.status === 'Open').length,
            inProgress: tickets.filter(t => t.status === 'In Progress').length,
            pendingYourAction: userActionTickets.length,
        }
    }, [tickets, user]);

    const handleNewTicketSuccess = (newTicket: SupportTicket) => {
        setTickets(prev => [newTicket, ...prev]);
        setToast({ message: 'New ticket created successfully!', type: 'success' });
        navigate(`/support/ticket/${newTicket.id}`);
    };

    const handleCommunication = async (targetUser: User, type: 'call' | 'sms' | 'whatsapp') => {
        if (!targetUser.phone) {
            setToast({ message: 'User does not have a phone number.', type: 'error' });
            return;
        }

        let numberToCall = targetUser.phone.replace(/\D/g, '');
        if (numberToCall.length > 10) numberToCall = numberToCall.slice(-10);
        
        if (numberToCall.length !== 10) {
            setToast({ message: 'Invalid phone number format.', type: 'error' });
            return;
        }

        // Log the communication
        if (user) {
            try {
                await api.logCommunication({
                    senderId: user.id,
                    receiverId: targetUser.id,
                    type,
                    metadata: {
                        targetPhone: numberToCall,
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (err) {
                console.error('Failed to log communication:', err);
                // Continue with the action even if logging fails
            }
        }

        if (type === 'whatsapp') {
            window.open(`https://wa.me/91${numberToCall}`, '_blank');
        } else if (type === 'call') {
            window.location.href = `tel:+91${numberToCall}`;
        } else if (type === 'sms') {
            window.location.href = `sms:+91${numberToCall}`;
        }
    };

    const handlePing = async (targetUser: User) => {
        if (!user) return;
        try {
            await api.createNotification({
                userId: targetUser.id,
                type: 'direct_ping',
                title: 'Nearby Support Request',
                message: `${user.name} is requesting support nearby.`,
                metadata: {
                    senderId: user.id,
                    senderName: user.name,
                    locationName: user.locationName || 'Nearby Location'
                }
            });
            setToast({ message: `Sent a ping to ${targetUser.name}!`, type: 'success' });
        } catch (error) {
            console.error('Failed to send ping:', error);
            setToast({ message: 'Failed to send ping.', type: 'error' });
        }
    };

    const StatCard: React.FC<{ title: string, value: number, icon: React.ReactNode, colorClass: string }> = ({ title, value, icon, colorClass }) => (
        <div className="bg-transparent p-5 rounded-2xl flex items-center justify-between transition-all">
            <div>
                <p className="text-sm font-medium text-muted mb-1">{title}</p>
                <p className={`text-3xl font-bold ${colorClass.replace('bg-', 'text-').split(' ')[0]}`}>{value}</p>
            </div>
            <div className={`p-3 rounded-full ${colorClass.replace('text-', 'bg-')} bg-opacity-90 shadow-sm`}>
                {React.cloneElement(icon as React.ReactElement, { className: 'h-6 w-6 text-white' })}
            </div>
        </div>
    );

    return (
        <>
            <div className="w-full p-4 lg:p-8 space-y-8">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Modals */}

            <Modal
                isOpen={isNearbyModalOpen}
                onClose={() => setIsNearbyModalOpen(false)}
                title="Nearby Available Support"
                onConfirm={() => setIsNearbyModalOpen(false)}
                confirmButtonText="Close"
            >
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {nearbyUsers.length > 0 ? (
                        nearbyUsers.map(u => (
                            <NearbyUserItem key={u.id} user={u} onAction={handleCommunication} onPing={handlePing} />
                        ))
                    ) : (
                        <div className="text-center py-8 text-muted">
                            <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p>No support staff found nearby.</p>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Header Section */}
            <div className="relative overflow-hidden rounded-3xl bg-transparent p-6 lg:p-10 transition-all">

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-50 rounded-lg backdrop-blur-sm">
                                <LifeBuoy className="h-6 w-6 text-emerald-600" />
                            </div>
                            <h2 className="text-2xl lg:text-3xl font-bold text-primary-text">Support & Audit</h2>
                        </div>
                        <p className="text-muted max-w-xl text-sm">
                            Track issues, request audits, and connect with support staff in real-time.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                        {isMobile && (
                            <Button
                                onClick={() => setIsNearbyModalOpen(true)}
                                variant="secondary"
                                className="flex-1 lg:flex-none bg-gray-100 text-gray-900 hover:bg-gray-200 border-none shadow-none p-0 text-sm transition-colors"
                            >
                                <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Nearby
                            </Button>
                        )}
                        {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'hr_ops' || user?.role === 'developer') && (
                            <Button
                                onClick={() => navigate('/support/alerts')}
                                variant="secondary"
                                className="flex-1 lg:flex-none bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200"
                            >
                                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Broadcast Alert
                            </Button>
                        )}
                        <Button
                            onClick={() => navigate('/support/ticket/new')}
                            className="flex-1 lg:flex-none"
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Ticket
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                <StatCard
                    title="Open Tickets"
                    value={stats.open}
                    icon={<LifeBuoy className="h-6 w-6" />}
                    colorClass="text-rose-500"
                />
                <StatCard
                    title="In Progress"
                    value={stats.inProgress}
                    icon={<Loader2 className="h-6 w-6" />}
                    colorClass="text-blue-500"
                />
                <StatCard
                    title="Pending Your Action"
                    value={stats.pendingYourAction}
                    icon={<UserCheck className="h-6 w-6" />}
                    colorClass="text-amber-500"
                />
            </div>


            {/* ─── Top Performers Section ─── */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 rounded-xl">
                            <Trophy className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
                                Team Performance
                                <button
                                    onClick={() => setIsScoreInfoModalOpen(true)}
                                    className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted transition-colors"
                                    title="How are scores calculated?"
                                >
                                    <Info className="w-4 h-4" />
                                </button>
                            </h3>
                            <p className="text-xs text-muted">{showAllScores ? 'All employees' : 'Top 3 per department'} · Monthly scorecard</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-2 mr-2">
                            <label htmlFor="show-all-scores" className="text-sm font-medium text-muted cursor-pointer flex items-center gap-2">
                                <input
                                    id="show-all-scores"
                                    name="show-all-scores"
                                    type="checkbox"
                                    checked={showAllScores}
                                    onChange={(e) => setShowAllScores(e.target.checked)}
                                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                                />
                                Show All
                            </label>
                        </div>
                        <select
                            id="role-filter"
                            name="role-filter"
                            aria-label="Filter by role"
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30"
                        >
                            <option value="all">All Roles</option>
                            {uniqueRoles.map(r => (
                                <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                            ))}
                        </select>
                        {isAdmin(user?.role) && (
                            <button
                                onClick={downloadReport}
                                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-all font-bold text-sm shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                Download Report
                            </button>
                        )}
                    </div>
                </div>

                {scoresLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    </div>
                ) : scoresByRole.length === 0 ? (
                    <div className="text-center py-12 text-muted">
                        <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p>No scores available yet.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {scoresByRole.map(group => (
                            <div key={group.role}>
                                <h4 className="text-sm font-bold text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"></span>
                                    {group.label}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {group.employees.map((emp, index) => {
                                        const rank = index + 1;
                                        const medalColor = rank === 1 ? 'from-amber-400 to-yellow-500' : rank === 2 ? 'from-gray-300 to-gray-400' : 'from-orange-400 to-amber-600';
                                        return (
                                            <div
                                                key={emp.userId}
                                                className="relative bg-background rounded-xl border border-amber-300/50 shadow-md p-4 hover:shadow-lg transition-all duration-300 group"
                                            >
                                                {/* Rank Badge */}
                                                <div className={`absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-md z-10 bg-gradient-to-br ${medalColor} text-white`}>
                                                    {rank}
                                                </div>

                                                {/* User Info */}
                                                <div className="flex items-center gap-3 mb-4">
                                                    <ProfilePlaceholder photoUrl={emp.userPhotoUrl} seed={emp.userId} className="w-10 h-10 rounded-full shadow-sm" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-primary-text truncate">{emp.userName}</p>
                                                        <p className="text-[10px] text-muted uppercase tracking-wider font-medium truncate">{emp.userRole.replace(/_/g, ' ')}</p>
                                                    </div>
                                                </div>

                                                {/* Score Badges */}
                                                <div className="flex items-center justify-between gap-1 mb-3">
                                                    {[
                                                        { label: 'Perf', value: emp.scores.performanceScore, color: 'text-[#F97316]' },
                                                        { label: 'Attend', value: emp.scores.attendanceScore, color: 'text-[#6366f1]' },
                                                        { label: 'Resp', value: emp.scores.responseScore, color: 'text-[#111827]' },
                                                    ].map(badge => (
                                                        <div key={badge.label} className="flex flex-col items-center gap-0.5">
                                                            <div className={`relative flex justify-center items-center w-9 h-9 ${badge.color} drop-shadow-sm`}>
                                                                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current z-0">
                                                                    <path d="M50 0L58.8 11.5L73.5 7.6L78.4 21.6L92.4 24.3L91.2 38.6L100 50L91.2 61.4L92.4 75.7L78.4 78.4L73.5 92.4L58.8 88.5L50 100L41.2 88.5L26.5 92.4L21.6 78.4L7.6 75.7L8.8 61.4L0 50L8.8 38.6L7.6 24.3L21.6 21.6L26.5 7.6L41.2 11.5Z" />
                                                                </svg>
                                                                <span className="relative z-10 text-white font-bold text-[11px]">{badge.value}</span>
                                                            </div>
                                                            <span className="text-[8px] uppercase font-bold text-muted tracking-wider">{badge.label}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Overall Score Bar */}
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                emp.scores.overallScore >= 80 ? 'bg-green-500' :
                                                                emp.scores.overallScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                                            }`}
                                                            style={{ width: `${emp.scores.overallScore}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-black text-primary-text min-w-[28px] text-right">{emp.scores.overallScore}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="lg:grid lg:grid-cols-3 lg:gap-8">
                {/* Main Content - Ticket List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-transparent p-5 rounded-2xl">
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="relative flex-grow">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    id="search"
                                    name="search"
                                    aria-label="Search tickets"
                                    placeholder="Search tickets..."
                                    className="!pl-10 bg-gray-50 border-gray-200"
                                    value={filters.searchTerm}
                                    onChange={e => setFilters(f => ({ ...f, searchTerm: e.target.value }))}
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="w-32 sm:w-40">
                                    <Select
                                        id="status-filter"
                                        name="status-filter"
                                        aria-label="Filter by status"
                                        value={filters.status}
                                        onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                                        className="bg-gray-50 border-gray-200"
                                    >
                                        <option value="all">All Status</option>
                                        <option>Open</option>
                                        <option>In Progress</option>
                                        <option value="Pending Requester">Pending</option>
                                        <option>Resolved</option>
                                        <option>Closed</option>
                                    </Select>
                                </div>
                                <div className="w-32 sm:w-40">
                                    <Select
                                        id="priority-filter"
                                        name="priority-filter"
                                        aria-label="Filter by priority"
                                        value={filters.priority}
                                        onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
                                        className="bg-gray-50 border-gray-200"
                                    >
                                        <option value="all">All Priority</option>
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                        <option>Urgent</option>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {filteredTickets.length > 0 ? filteredTickets.map(ticket => (
                                    <TicketCard key={ticket.id} ticket={ticket} onClick={() => navigate(`/support/ticket/${ticket.id}`)} />
                                )) : (
                                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted">
                                        <div className="p-4 bg-accent/5 rounded-full mb-3">
                                            <Search className="h-8 w-8 opacity-50" />
                                        </div>
                                        <p>No tickets match your filters.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar - Nearby Users (Desktop) */}
                <aside className="hidden lg:block space-y-6">
                    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm sticky top-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-lg text-primary-text flex items-center gap-2">
                                <Users className="h-5 w-5 text-accent" /> Nearby Support
                            </h3>
                            <span className="text-xs font-medium bg-accent/10 text-accent px-2 py-1 rounded-full">
                                {nearbyUsers.filter(u => u.isAvailable).length} Online
                            </span>
                        </div>

                        <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-1 custom-scrollbar">
                            {nearbyUsers.length > 0 ? (
                                nearbyUsers.map(u => (
                                    <NearbyUserItem key={u.id} user={u} onAction={handleCommunication} onPing={handlePing} />
                                ))
                            ) : (
                                <div className="text-center py-8 text-muted">
                                    <p>No support staff found nearby.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>
        </div>

        {/* Score Information Fixed Dialog */}
        {isScoreInfoModalOpen && (
            <div 
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm shadow-2xl transition-opacity animate-in fade-in duration-200" 
                onClick={() => setIsScoreInfoModalOpen(false)}
            >
                <div 
                    className="bg-card w-full max-w-sm sm:max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in-scale transform" 
                    onClick={e => e.stopPropagation()}
                >
                    <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-accent/5">
                        <h3 className="text-base sm:text-lg font-bold text-primary-text flex items-center gap-2">
                            <Info className="w-5 h-5 text-accent" /> Score System
                        </h3>
                        <button 
                            onClick={() => setIsScoreInfoModalOpen(false)} 
                            className="text-muted hover:text-primary-text transition-colors p-1"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <div>
                            <h4 className="font-bold text-primary-text mb-2 flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-accent" /> Overall Score
                            </h4>
                            <p className="text-sm text-muted">A 100-point metric weighted across three categories:</p>
                            <ul className="list-disc list-inside mt-2 space-y-1.5 ml-1 text-sm text-muted mb-2">
                                <li><strong>Performance:</strong> Completed vs. assigned tasks.</li>
                                <li><strong>Attendance:</strong> Present days, minus late remarks.</li>
                                <li><strong>Response:</strong> Average broadcast response speed.</li>
                            </ul>
                        </div>
                        
                        <div className="pt-4 border-t border-border">
                            <h4 className="font-bold text-primary-text mb-2 flex items-center gap-2">
                                <Award className="w-4 h-4 text-amber-500" /> Tiebreaker
                            </h4>
                            <p className="text-sm text-muted">
                                If members tie with an identical overall score, the system breaks the tie using <strong>Punctuality</strong>.<br/><br/>
                                Staff who have accrued the most total clocked-in minutes throughout the month rank higher.
                            </p>
                        </div>
                    </div>
                    <div className="px-5 py-4 border-t border-border bg-gray-50/50 dark:bg-black/20 flex justify-end">
                        <Button onClick={() => setIsScoreInfoModalOpen(false)} className="w-full sm:w-auto">Got it</Button>
                    </div>
                </div>
            </div>
        )}

        </>
    );
};

export default SupportDashboard;