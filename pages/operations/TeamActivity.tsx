import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import type { User } from '../../types';
import {
    MapPin, Phone, MessageSquare, Clock, Navigation2,
    User as UserIcon, Calendar, TrendingUp, Loader2,
    CheckCircle2, XCircle, Activity, LogIn, LogOut
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';
import { formatDistanceToNow, format } from 'date-fns';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { isAdmin } from '../../utils/auth';
import Pagination from '../../components/ui/Pagination';
import LoadingScreen from '../../components/ui/LoadingScreen';


interface TeamMember extends User {
    lastCheckIn?: string;
    lastCheckOut?: string;
    currentLocation?: { latitude: number; longitude: number; address?: string };
    todayWorkingHours?: number;
    todayTravelDistance?: number;
    isCurrentlyWorking?: boolean;
    isPresent?: boolean;
}

const TeamActivity: React.FC = () => {
    const { user } = useAuthStore();
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);
    const isMobile = useMediaQuery('(max-width: 767px)');

    useEffect(() => {
        fetchTeamMembers();
        const interval = setInterval(fetchTeamMembers, 30000);
        return () => clearInterval(interval);
    }, [user]);

    const fetchTeamMembers = async () => {
        if (!user) return;
        try {
            setIsLoading(true);
            const allUsers = await api.getUsers();

            let teamList: User[] = [];
            if (isAdmin(user.role) || user.role === 'developer') {
                teamList = allUsers.filter(u =>
                    u.role === 'operation_manager' || u.role === 'field_staff'
                );
            } else if (user.role === 'operation_manager') {
                teamList = allUsers.filter(u =>
                    u.role === 'field_staff' && u.reportingManagerId === user.id
                );
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const enrichedTeam: TeamMember[] = await Promise.all(
                teamList.map(async (member) => {
                    try {
                        const events = await api.getAttendanceEvents(
                            member.id,
                            today.toISOString(),
                            endOfDay.toISOString()
                        );

                        const sortedEvents = events.sort((a, b) =>
                            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                        );

                        const checkIns = sortedEvents.filter(e =>
                            e.type.toLowerCase().replace(/[-_\s]/g, '') === 'checkin'
                        );
                        const checkOuts = sortedEvents.filter(e =>
                            e.type.toLowerCase().replace(/[-_\s]/g, '') === 'checkout'
                        );

                        const lastCheckIn = checkIns[0];
                        const lastCheckOut = checkOuts[0];

                        let workingHours = 0;
                        for (let i = 0; i < checkOuts.length; i++) {
                            const checkOut = checkOuts[i];
                            const matchingCheckIn = checkIns.find(ci =>
                                new Date(ci.timestamp) < new Date(checkOut.timestamp)
                            );
                            if (matchingCheckIn) {
                                const diff = new Date(checkOut.timestamp).getTime() -
                                    new Date(matchingCheckIn.timestamp).getTime();
                                workingHours += diff / (1000 * 60 * 60);
                            }
                        }

                        const isCurrentlyWorking = lastCheckIn && (!lastCheckOut ||
                            new Date(lastCheckIn.timestamp) > new Date(lastCheckOut.timestamp));

                        if (isCurrentlyWorking && lastCheckIn) {
                            const timeSinceCheckIn = Date.now() - new Date(lastCheckIn.timestamp).getTime();
                            workingHours += timeSinceCheckIn / (1000 * 60 * 60);
                        }

                        return {
                            ...member,
                            lastCheckIn: lastCheckIn?.timestamp,
                            lastCheckOut: lastCheckOut?.timestamp,
                            currentLocation: lastCheckIn ? {
                                latitude: lastCheckIn.latitude || 0,
                                longitude: lastCheckIn.longitude || 0,
                                address: (lastCheckIn as any).address || undefined
                            } : undefined,
                            todayWorkingHours: workingHours,
                            todayTravelDistance: 0,
                            isCurrentlyWorking,
                            isPresent: checkIns.length > 0
                        };
                    } catch (error) {
                        console.error(`Error fetching data for ${member.name}:`, error);
                        return {
                            ...member,
                            isPresent: false,
                            isCurrentlyWorking: false
                        };
                    }
                })
            );

            setTeamMembers(enrichedTeam);
        } catch (error) {
            console.error('Error fetching team members:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCall = (phone?: string) => {
        if (!phone) return;
        const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
        window.location.href = `tel:+91${cleanedPhone}`;
    };

    const handleMessage = (phone?: string) => {
        if (!phone) return;
        const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
        window.location.href = `sms:+91${cleanedPhone}`;
    };

    const formatHours = (hours?: number) => {
        if (!hours) return '0h 0m';
        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);
        return `${h}h ${m}m`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
        );
    }

    const MemberCard: React.FC<{ member: TeamMember }> = ({ member }) => (
        <div
            className="bg-card border border-border rounded-xl p-4 hover:border-accent transition-all cursor-pointer"
            onClick={() => setSelectedMember(member)}
        >
            <div className="flex items-start gap-3">
                <div className="relative">
                    <ProfilePlaceholder
                        photoUrl={member.photoUrl}
                        seed={member.id}
                        className="w-12 h-12 rounded-full"
                    />
                    <span className={`absolute -bottom-0.5 -right-0.5 block h-4 w-4 rounded-full ring-2 ring-white ${member.isCurrentlyWorking
                            ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]'
                            : member.isPresent
                                ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]'
                                : 'bg-red-500 shadow-[0_0_10px_rgba(239,44,44,0.8)]'
                        }`} />
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-primary-text truncate">{member.name}</h3>
                    <p className="text-xs text-muted">
                        {member.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>

                    <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                            {member.isCurrentlyWorking ? (
                                <>
                                    <Activity className="h-3 w-3 text-green-500" />
                                    <span className="text-green-500 font-medium">Working</span>
                                </>
                            ) : member.isPresent ? (
                                <>
                                    <CheckCircle2 className="h-3 w-3 text-yellow-500" />
                                    <span className="text-yellow-500">Punched Out</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="h-3 w-3 text-red-500" />
                                    <span className="text-red-500">Absent</span>
                                </>
                            )}
                        </div>

                        {member.todayWorkingHours! > 0 && (
                            <div className="flex items-center gap-2 text-xs text-muted">
                                <Clock className="h-3 w-3" />
                                <span>{formatHours(member.todayWorkingHours)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <Button
                        variant="icon"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleCall(member.phone); }}
                        className="hover:bg-accent/10"
                        style={{ backgroundColor: '#006B3F', color: '#FFFFFF' }}
                    >
                        <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="icon"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleMessage(member.phone); }}
                        className="hover:bg-accent/10"
                        style={{ backgroundColor: '#006B3F', color: '#FFFFFF' }}
                    >
                        <MessageSquare className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );

    const MemberDetails: React.FC<{ member: TeamMember }> = ({ member }) => (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ProfilePlaceholder
                        photoUrl={member.photoUrl}
                        seed={member.id}
                        className="w-16 h-16 rounded-full"
                    />
                    <div>
                        <h2 className="text-xl font-bold text-primary-text">{member.name}</h2>
                        <p className="text-sm text-muted">
                            {member.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                    </div>
                </div>

                {isMobile && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedMember(null)}
                    >
                        Close
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-accent/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <LogIn className="h-4 w-4 text-accent" />
                        <span className="text-xs font-medium text-muted">Last Punch In</span>
                    </div>
                    <p className="text-sm font-bold text-primary-text">
                        {member.lastCheckIn
                            ? format(new Date(member.lastCheckIn), 'hh:mm a')
                            : 'Not checked in'}
                    </p>
                    {member.lastCheckIn && (
                        <p className="text-xs text-muted mt-1">
                            {formatDistanceToNow(new Date(member.lastCheckIn), { addSuffix: true })}
                        </p>
                    )}
                </div>

                <div className="bg-accent/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <LogOut className="h-4 w-4 text-accent" />
                        <span className="text-xs font-medium text-muted">Last Punch Out</span>
                    </div>
                    <p className="text-sm font-bold text-primary-text">
                        {member.lastCheckOut
                            ? format(new Date(member.lastCheckOut), 'hh:mm a')
                            : 'Not checked out'}
                    </p>
                    {member.lastCheckOut && (
                        <p className="text-xs text-muted mt-1">
                            {formatDistanceToNow(new Date(member.lastCheckOut), { addSuffix: true })}
                        </p>
                    )}
                </div>

                <div className="bg-accent/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-accent" />
                        <span className="text-xs font-medium text-muted">Working Hours Today</span>
                    </div>
                    <p className="text-lg font-bold text-primary-text">
                        {formatHours(member.todayWorkingHours)}
                    </p>
                </div>

                <div className="bg-accent/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-accent" />
                        <span className="text-xs font-medium text-muted">Status</span>
                    </div>
                    <p className={`text-lg font-bold ${member.isCurrentlyWorking ? 'text-green-500' :
                            member.isPresent ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                        {member.isCurrentlyWorking ? 'Working' :
                            member.isPresent ? 'Punched Out' : 'Absent'}
                    </p>
                </div>
            </div>

            {member.currentLocation && (
                <div className="bg-accent/5 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-accent" />
                        <span className="text-xs font-medium text-muted">Current Location</span>
                    </div>
                    <p className="text-sm text-primary-text">
                        {member.currentLocation.address || 'Location not available'}
                    </p>
                    {member.currentLocation.latitude !== 0 && (
                        <a
                            href={`https://www.google.com/maps?q=${member.currentLocation.latitude},${member.currentLocation.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent hover:underline mt-2 inline-block"
                        >
                            View on map →
                        </a>
                    )}
                </div>
            )}

            <div className="flex gap-3">
                <Button
                    onClick={() => handleCall(member.phone)}
                    className="flex-1"
                    style={{ backgroundColor: '#006B3F', color: '#FFFFFF' }}
                >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                </Button>
                <Button
                    onClick={() => handleMessage(member.phone)}
                    className="flex-1"
                    style={{ backgroundColor: '#006B3F', color: '#FFFFFF' }}
                >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Message
                </Button>
            </div>
        </div>
    );

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-4 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-primary-text">Team Activity</h1>
                    <p className="text-sm text-muted mt-1">
                        {user?.role === 'operation_manager'
                            ? 'Monitor your field team in real-time'
                            : 'Monitor all operation managers and field staff'}
                    </p>
                </div>

                <Button
                    onClick={fetchTeamMembers}
                    variant="secondary"
                    size="sm"
                >
                    <Activity className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <UserIcon className="h-4 w-4 text-accent" />
                        <span className="text-xs font-medium text-muted">Total Team</span>
                    </div>
                    <p className="text-2xl font-bold text-primary-text">{teamMembers.length}</p>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-green-500" />
                        <span className="text-xs font-medium text-muted">Working Now</span>
                    </div>
                    <p className="text-2xl font-bold text-green-500">
                        {teamMembers.filter(m => m.isCurrentlyWorking).length}
                    </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-yellow-500" />
                        <span className="text-xs font-medium text-muted">Present</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-500">
                        {teamMembers.filter(m => m.isPresent && !m.isCurrentlyWorking).length}
                    </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-xs font-medium text-muted">Absent</span>
                    </div>
                    <p className="text-2xl font-bold text-red-500">
                        {teamMembers.filter(m => !m.isPresent).length}
                    </p>
                </div>
            </div>

            {isMobile && selectedMember ? (
                <MemberDetails member={selectedMember} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-3">
                        {teamMembers.length === 0 ? (
                            <div className="bg-card border border-border rounded-xl p-12 text-center">
                                <UserIcon className="h-12 w-12 mx-auto text-muted mb-4 opacity-50" />
                                <p className="text-muted">No team members found</p>
                            </div>
                        ) : (
                            <>
                                {teamMembers
                                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                                    .map(member => (
                                        <MemberCard key={member.id} member={member} />
                                    ))}
                                
                                <Pagination 
                                    currentPage={currentPage}
                                    totalItems={teamMembers.length}
                                    pageSize={pageSize}
                                    onPageChange={setCurrentPage}
                                    onPageSizeChange={setPageSize}
                                    className="mt-6 col-span-full"
                                />
                            </>
                        )}
                    </div>

                    {!isMobile && selectedMember && (
                        <div className="lg:col-span-1 sticky top-6 self-start">
                            <MemberDetails member={selectedMember} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TeamActivity;
