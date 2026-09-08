import React, { useState, useEffect } from 'react';
import { 
    Clock, 
    Calendar, 
    Plus, 
    Trash2, 
    Send, 
    AlertCircle, 
    CheckCircle2, 
    Zap, 
    Users, 
    Info, 
    Bell, 
    Sparkles, 
    Search, 
    Filter, 
    Mail, 
    Play, 
    Pause, 
    RotateCw, 
    ArrowRight, 
    Layers,
    FileSpreadsheet,
    ShieldCheck
} from 'lucide-react';
import { api } from '../../services/api';
import type { ScheduledNotification, AutomatedNotificationRule, Role, User, NotificationType } from '../../types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import LoadingScreen from '../../components/ui/LoadingScreen';
import StatCard from '../../components/ui/StatCard';
import { format, addHours, parseISO } from 'date-fns';

const NOTIFICATION_TYPES: { value: NotificationType; label: string; color: string; bg: string }[] = [
    { value: 'info', label: 'Info Alert', color: 'text-blue-600', bg: 'bg-blue-50' },
    { value: 'security', label: 'Security', color: 'text-red-600', bg: 'bg-red-50' },
    { value: 'task_assigned', label: 'Task Update', color: 'text-teal-600', bg: 'bg-teal-50' },
    { value: 'greeting', label: 'General Notice', color: 'text-emerald-600', bg: 'bg-emerald-50' }
];

type FilterCategory = 'all' | 'broadcast' | 'automated' | 'email';

interface UnifiedTimelineEvent {
    id: string;
    rawId: string | number;
    time: string;
    title: string;
    subtitle: string;
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
    badgeBg: string;
    type: 'BROADCAST' | 'AUTOMATED' | 'EMAIL REPORT';
    jobType: 'broadcast' | 'automated' | 'email';
    isActive: boolean;
    details?: string;
}

const NotificationPlanner: React.FC = () => {
    const [scheduled, setScheduled] = useState<ScheduledNotification[]>([]);
    const [autoRules, setAutoRules] = useState<AutomatedNotificationRule[]>([]);
    const [emailSchedules, setEmailSchedules] = useState<any[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [runningJobId, setRunningJobId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [newData, setNewData] = useState<Partial<ScheduledNotification>>({
        title: '',
        message: '',
        scheduledAt: format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
        type: 'info',
        targetRole: 'all'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [sn, ar, r, u, es] = await Promise.all([
                api.getScheduledNotifications(),
                api.getAutomatedRules(),
                api.getRoles(),
                api.getUsers(),
                api.getEmailScheduleRules().catch(() => [])
            ]);
            setScheduled(sn || []);
            setAutoRules(ar || []);
            setRoles(r || []);
            setUsers((u || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            setEmailSchedules(es || []);
        } catch (err) {
            console.error('Failed to fetch planner data:', err);
            setToast({ message: 'Failed to load planner data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!newData.message || !newData.scheduledAt) {
            setToast({ message: 'Please provide both dispatch time and message body.', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            await api.saveScheduledNotification(newData);
            setToast({ message: 'Broadcast scheduled successfully in Planner queue.', type: 'success' });
            setShowForm(false);
            setNewData({ 
                title: '', 
                message: '', 
                scheduledAt: format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"), 
                type: 'info', 
                targetRole: 'all' 
            });
            fetchData();
        } catch (err: any) {
            setToast({ message: `Failed to schedule: ${err.message || 'Error'}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Cancel this scheduled broadcast?')) return;
        try {
            await api.deleteScheduledNotification(id);
            setScheduled(scheduled.filter(s => s.id !== id));
            setToast({ message: 'Broadcast cancelled.', type: 'success' });
        } catch (err: any) {
            setToast({ message: `Failed to cancel: ${err.message || 'Error'}`, type: 'error' });
        }
    };

    const handleRunNow = async (jobType: 'broadcast' | 'automated' | 'email', rawId: string | number, title: string) => {
        const lockKey = `${jobType}-${rawId}`;
        setRunningJobId(lockKey);
        try {
            const res = await api.runJobNow(jobType, rawId);
            setToast({ 
                message: res.message || `Successfully triggered "${title}".`, 
                type: 'success' 
            });
            await fetchData();
        } catch (err: any) {
            console.error('Run job failed:', err);
            setToast({ message: `Job execution failed: ${err.message || 'Error'}`, type: 'error' });
        } finally {
            setRunningJobId(null);
        }
    };

    const handleToggleActive = async (jobType: 'automated' | 'email', rawId: string | number, currentActive: boolean) => {
        try {
            await api.toggleJobActive(jobType, rawId, !currentActive);
            setToast({ 
                message: `Job ${!currentActive ? 'activated' : 'paused'} successfully.`, 
                type: 'success' 
            });
            await fetchData();
        } catch (err: any) {
            setToast({ message: `Toggle failed: ${err.message || 'Error'}`, type: 'error' });
        }
    };

    const getTimelineEvents = (): UnifiedTimelineEvent[] => {
        const events: UnifiedTimelineEvent[] = [];

        // 1. Automated Notification Rules
        autoRules.filter(r => r.isActive).forEach(rule => {
            if (rule.config?.time) {
                events.push({
                    id: `auto-${rule.id}`,
                    rawId: rule.id,
                    time: rule.config.time,
                    title: rule.name,
                    subtitle: `Category: ${(rule.targetCategory || 'All Staff').toUpperCase()}`,
                    icon: Zap,
                    color: 'text-amber-600',
                    bgColor: 'bg-amber-50',
                    borderColor: 'border-amber-200',
                    badgeBg: 'bg-amber-100 text-amber-900 border border-amber-200',
                    type: 'AUTOMATED',
                    jobType: 'automated',
                    isActive: rule.isActive
                });
            }
        });

        // 2. Email Schedule Rules
        emailSchedules.filter(es => es.isActive).forEach(es => {
            const time = es.scheduleConfig?.time || '09:00';
            const formatStr = (es.scheduleConfig?.exportFileFormat || es.reportFormat || 'xlsx').toUpperCase();
            events.push({
                id: `email-${es.id}`,
                rawId: es.id,
                time: time,
                title: es.name || 'Attendance Email Report',
                subtitle: `${(es.reportType || 'attendance').replace(/_/g, ' ').toUpperCase()} • ${formatStr}`,
                icon: Mail,
                color: 'text-sky-600',
                bgColor: 'bg-sky-50',
                borderColor: 'border-sky-200',
                badgeBg: 'bg-sky-100 text-sky-900 border border-sky-200',
                type: 'EMAIL REPORT',
                jobType: 'email',
                isActive: es.isActive
            });
        });

        // 3. Scheduled Broadcast Notifications
        scheduled.filter(s => !s.isSent).forEach(s => {
            try {
                const date = parseISO(s.scheduledAt);
                events.push({
                    id: s.id,
                    rawId: s.id,
                    time: format(date, 'HH:mm'),
                    title: s.title || 'Broadcast Notice',
                    subtitle: s.targetRole === 'all' || !s.targetRole ? 'All Staff (Everyone)' : `Target Role: ${s.targetRole}`,
                    details: s.message,
                    icon: Send,
                    color: 'text-emerald-600',
                    bgColor: 'bg-emerald-50',
                    borderColor: 'border-emerald-200',
                    badgeBg: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
                    type: 'BROADCAST',
                    jobType: 'broadcast',
                    isActive: true
                });
            } catch (err) {
                // Ignore parsing errors
            }
        });

        return events.sort((a, b) => a.time.localeCompare(b.time));
    };

    if (isLoading) return <LoadingScreen message="Loading Unified Job Planner..." />;

    const timelineEvents = getTimelineEvents();
    const upcomingBroadcasts = scheduled.filter(s => !s.isSent);
    const activeAutoRules = autoRules.filter(r => r.isActive);
    const activeEmailSchedules = emailSchedules.filter(e => e.isActive);
    const completedToday = scheduled.filter(s => s.isSent);

    // Filtered unified jobs for the right-side cards
    const allUnifiedJobs = [
        ...upcomingBroadcasts.map(b => ({
            id: b.id,
            rawId: b.id,
            jobType: 'broadcast' as const,
            title: b.title || 'Broadcast Announcement',
            subtitle: b.targetRole === 'all' || !b.targetRole ? 'All Staff' : `Role: ${b.targetRole}`,
            scheduleInfo: format(parseISO(b.scheduledAt), 'MMM d, h:mm a'),
            icon: Send,
            color: 'text-emerald-600',
            badge: 'BROADCAST',
            badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            isActive: true,
            description: b.message,
            canDelete: true
        })),
        ...autoRules.map(ar => ({
            id: `auto-${ar.id}`,
            rawId: ar.id,
            jobType: 'automated' as const,
            title: ar.name,
            subtitle: `Target: ${(ar.targetCategory || 'All Staff').toUpperCase()}`,
            scheduleInfo: `Daily at ${ar.config?.time || '21:00'} IST`,
            icon: Zap,
            color: 'text-amber-600',
            badge: 'AUTO-RULE',
            badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
            isActive: ar.isActive,
            description: ar.pushBodyTemplate || ar.smsTemplate || 'Automated condition check.',
            canDelete: false
        })),
        ...emailSchedules.map(es => ({
            id: `email-${es.id}`,
            rawId: es.id,
            jobType: 'email' as const,
            title: es.name || 'Automated Email Report',
            subtitle: `${(es.reportType || 'attendance').replace(/_/g, ' ').toUpperCase()}`,
            scheduleInfo: `Daily at ${es.scheduleConfig?.time || '09:00'} IST • ${(es.scheduleConfig?.exportFileFormat || es.reportFormat || 'xlsx').toUpperCase()}`,
            icon: Mail,
            color: 'text-sky-600',
            badge: 'EMAIL REPORT',
            badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
            isActive: es.isActive,
            description: `Recipients: ${(es.recipients || []).length} recipients configured.`,
            canDelete: false
        }))
    ];

    const filteredJobs = allUnifiedJobs.filter(job => {
        if (selectedCategory !== 'all' && job.jobType !== selectedCategory) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return job.title.toLowerCase().includes(q) || job.subtitle.toLowerCase().includes(q);
        }
        return true;
    });

    return (
        <div className="space-y-6 w-full animate-in fade-in duration-500">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Top Row: Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard icon={Send} value={upcomingBroadcasts.length} title="Upcoming Broadcasts" />
                <StatCard icon={Zap} value={activeAutoRules.length} title="Active Auto-Rules" />
                <StatCard icon={Mail} value={activeEmailSchedules.length} title="Active Email Schedules" />
                <StatCard icon={CheckCircle2} value={completedToday.length} title="Sent / Completed" />
            </div>

            {/* Main Content Split: Timeline (Left) vs Jobs Control Deck (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left: 24-Hour Master Timeline */}
                <div className="lg:col-span-4 lg:sticky lg:top-8">
                    <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
                        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-emerald-600" />
                                    Next 24-Hour Schedule
                                </h3>
                                <p className="text-[11px] text-slate-400">All planned jobs in chronological order</p>
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Live</span>
                            </div>
                        </div>

                        <div className="space-y-3.5 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-100 max-h-[580px] overflow-y-auto pr-1">
                            {timelineEvents.length > 0 ? (
                                timelineEvents.map((event) => {
                                    const isRunning = runningJobId === `${event.jobType}-${event.rawId}`;
                                    return (
                                        <div key={event.id} className="relative pl-7 group">
                                            <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center bg-white border border-slate-200 ${event.color} z-10 shadow-xs group-hover:border-emerald-300`}>
                                                <event.icon className="h-3 w-3" />
                                            </div>
                                            <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/60 hover:border-emerald-200 hover:bg-white transition-all shadow-2xs">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-md ${event.badgeBg}`}>
                                                        {event.type}
                                                    </span>
                                                    <span className={`text-xs font-bold font-mono ${event.color}`}>{event.time} IST</span>
                                                </div>
                                                <p className="text-xs font-bold text-slate-800 leading-tight mb-1">{event.title}</p>
                                                <p className="text-[11px] text-slate-500 mb-2">{event.subtitle}</p>
                                                
                                                {/* Instant Run Button */}
                                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                    <span className="text-[10px] text-slate-400">Scheduled Trigger</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRunNow(event.jobType, event.rawId, event.title)}
                                                        disabled={isRunning}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 px-2 py-0.5 rounded-md transition-colors cursor-pointer shadow-2xs"
                                                    >
                                                        {isRunning ? (
                                                            <>
                                                                <RotateCw className="h-3 w-3 animate-spin text-emerald-600" /> Running...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play className="h-2.5 w-2.5 fill-current text-emerald-600" /> Run Now
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-16 text-slate-400">
                                    <Sparkles className="h-7 w-7 mx-auto mb-2 opacity-40 text-emerald-600" />
                                    <p className="text-xs font-bold uppercase tracking-wider">No Events Scheduled</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Unified Jobs Control Deck */}
                <div className="lg:col-span-8 h-full">
                    {showForm ? (
                        /* Broadcast Composer Modal */
                        <div className="bg-white p-7 rounded-2xl shadow-xs border border-slate-200 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                                        <Send className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-slate-900">Schedule Broadcast Notification</h2>
                                        <p className="text-xs text-slate-500">Draft and queue an announcement to dispatch at a specific time.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1 rounded-lg border border-slate-200"
                                >
                                    Cancel
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                <div className="space-y-4">
                                    <Input 
                                        label="Notification Headline / Title" 
                                        placeholder="e.g. Office Closure Notice"
                                        value={newData.title}
                                        onChange={(e) => setNewData({ ...newData, title: e.target.value })}
                                        className="text-xs"
                                    />
                                    <Select 
                                        label="Target Recipient Audience"
                                        value={newData.targetRole || 'all'} 
                                        onChange={(e) => setNewData({ ...newData, targetRole: e.target.value })}
                                    >
                                        <option value="all">Company-wide (All Staff Members)</option>
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.displayName}</option>
                                        ))}
                                    </Select>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-700">Scheduled Dispatch Date & Time</label>
                                        <input 
                                            type="datetime-local" 
                                            className="w-full h-9 px-3 rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-emerald-500 text-slate-900 text-xs font-medium"
                                            value={newData.scheduledAt}
                                            onChange={(e) => setNewData({ ...newData, scheduledAt: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-700">Notification Alert Category</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {NOTIFICATION_TYPES.map(nt => (
                                                <button
                                                    key={nt.value}
                                                    type="button"
                                                    onClick={() => setNewData({ ...newData, type: nt.value as NotificationType })}
                                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                                        newData.type === nt.value 
                                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' 
                                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                                                    }`}
                                                >
                                                    {nt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1 mb-6">
                                <label className="text-xs font-semibold text-slate-700">Message Body</label>
                                <textarea 
                                    className="w-full h-28 p-3 rounded-xl bg-slate-50/50 border border-slate-200 focus:bg-white focus:outline-none focus:border-emerald-500 text-slate-800 text-xs font-medium resize-none"
                                    placeholder="Write your broadcast announcement message here..."
                                    value={newData.message}
                                    onChange={(e) => setNewData({ ...newData, message: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowForm(false)}
                                    className="h-10 px-5 text-xs font-bold"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={handleSave} 
                                    isLoading={isSaving}
                                    className="h-10 px-6 text-xs font-bold"
                                >
                                    Confirm & Schedule Broadcast
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* Unified Jobs Control Deck */
                        <div className="space-y-4">
                            {/* Filter Bar & Header */}
                            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                                {/* Category Pills */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                                    {[
                                        { id: 'all', label: `All Jobs (${allUnifiedJobs.length})` },
                                        { id: 'broadcast', label: `Broadcasts (${upcomingBroadcasts.length})` },
                                        { id: 'automated', label: `Auto-Rules (${autoRules.length})` },
                                        { id: 'email', label: `Email Reports (${emailSchedules.length})` },
                                    ].map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setSelectedCategory(cat.id as FilterCategory)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                                selectedCategory === cat.id
                                                    ? 'bg-slate-900 text-white shadow-2xs'
                                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                                            }`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Search Input */}
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search jobs..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-36 sm:w-44 pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <Button 
                                        size="sm" 
                                        onClick={() => setShowForm(true)}
                                        className="h-8 px-3 text-xs font-bold rounded-lg"
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Schedule Broadcast
                                    </Button>
                                </div>
                            </div>

                            {/* Job Cards Grid */}
                            {filteredJobs.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredJobs.map((job) => {
                                        const isRunning = runningJobId === `${job.jobType}-${job.rawId}`;
                                        return (
                                            <div 
                                                key={job.id} 
                                                className={`p-4 rounded-xl border transition-all bg-white shadow-xs hover:border-emerald-300 flex flex-col justify-between ${
                                                    !job.isActive ? 'opacity-70 bg-slate-50/70' : ''
                                                }`}
                                            >
                                                <div>
                                                    {/* Card Header */}
                                                    <div className="flex items-start justify-between gap-2 mb-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-2 rounded-lg bg-slate-50 border border-slate-200/80 ${job.color}`}>
                                                                <job.icon className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${job.badgeBg}`}>
                                                                    {job.badge}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Actions: Run Now & Toggle / Delete */}
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRunNow(job.jobType, job.rawId, job.title)}
                                                                disabled={isRunning}
                                                                title="Trigger / Test Job Now"
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                                                            >
                                                                {isRunning ? (
                                                                    <RotateCw className="h-3 w-3 animate-spin text-emerald-700" />
                                                                ) : (
                                                                    <Play className="h-3 w-3 fill-current text-emerald-700" />
                                                                )}
                                                                Run Now
                                                            </button>

                                                            {job.canDelete ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelete(job.rawId as string)}
                                                                    title="Cancel Broadcast"
                                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleActive(job.jobType as 'automated' | 'email', job.rawId, job.isActive)}
                                                                    title={job.isActive ? 'Pause Job' : 'Resume Job'}
                                                                    className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer ${
                                                                        job.isActive 
                                                                            ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700' 
                                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                    }`}
                                                                >
                                                                    {job.isActive ? 'Pause' : 'Activate'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <h4 className="text-sm font-bold text-slate-900 leading-snug mb-1">
                                                        {job.title}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 font-medium mb-3 line-clamp-2">
                                                        {job.description}
                                                    </p>
                                                </div>

                                                {/* Card Footer */}
                                                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                                                        <Clock className="h-3 w-3 text-emerald-600" />
                                                        {job.scheduleInfo}
                                                    </span>
                                                    <span className={`font-bold ${job.isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                        {job.isActive ? 'Active' : 'Paused'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                                    <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                                        <Sparkles className="h-6 w-6 text-emerald-600" />
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800 mb-1">No Jobs Matching Filter</h4>
                                    <p className="text-xs text-slate-400 mb-4 max-w-xs">There are no planned triggers in this category matching your search criteria.</p>
                                    <Button 
                                        onClick={() => setShowForm(true)}
                                        size="sm"
                                        className="rounded-lg text-xs"
                                    >
                                        <Plus className="mr-1 h-3.5 w-3.5" /> Schedule New Broadcast
                                    </Button>
                                </div>
                            )}

                            {/* Completed History Section */}
                            {completedToday.length > 0 && (
                                <div className="mt-6 pt-4 border-t border-slate-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Recently Dispatched / Completed</h5>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {completedToday.slice(0, 4).map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800 leading-tight">{item.title || 'Broadcast Announcement'}</p>
                                                        <p className="text-[10px] text-slate-400">Sent to: {item.targetRole === 'all' ? 'All Staff' : item.targetRole}</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {format(parseISO(item.processedAt || item.scheduledAt), 'MMM d, h:mm a')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationPlanner;
