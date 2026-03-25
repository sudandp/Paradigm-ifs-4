import React, { useState, useEffect } from 'react';
import { 
    Clock, 
    Calendar, 
    Plus, 
    Trash2, 
    Send, 
    AlertCircle, 
    CheckCircle2, 
    ChevronRight,
    Zap,
    Users,
    Info,
    Bell,
    Sparkles,
    ArrowRight,
    Search,
    Filter,
    PlusCircle
} from 'lucide-react';
import { api } from '../../services/api';
import type { ScheduledNotification, AutomatedNotificationRule, Role, User, NotificationType } from '../../types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import Checkbox from '../../components/ui/Checkbox';
import LoadingScreen from '../../components/ui/LoadingScreen';
import StatCard from '../../components/ui/StatCard';
import { format, addHours, startOfHour, isAfter, parseISO } from 'date-fns';

const NOTIFICATION_TYPES: { value: NotificationType; label: string; color: string; bg: string }[] = [
    { value: 'info', label: 'Info Alert', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { value: 'security', label: 'Security', color: 'text-red-500', bg: 'bg-red-500/10' },
    { value: 'task_assigned', label: 'Task Update', color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { value: 'greeting', label: 'General', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
];

const NotificationPlanner: React.FC = () => {
    const [scheduled, setScheduled] = useState<ScheduledNotification[]>([]);
    const [autoRules, setAutoRules] = useState<AutomatedNotificationRule[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [newData, setNewData] = useState<Partial<ScheduledNotification>>({
        title: '',
        message: '',
        scheduledAt: format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
        type: 'info',
        targetRole: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [sn, ar, r, u] = await Promise.all([
                api.getScheduledNotifications(),
                api.getAutomatedRules(),
                api.getRoles(),
                api.getUsers()
            ]);
            setScheduled(sn);
            setAutoRules(ar.filter(rule => rule.isActive));
            setRoles(r);
            setUsers(u.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        } catch (err) {
            console.error('Failed to fetch planner data:', err);
            setToast({ message: 'Failed to load planner data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!newData.message || !newData.scheduledAt) {
            setToast({ message: 'Please fill in all required fields.', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            await api.saveScheduledNotification(newData);
            setToast({ message: 'Notification scheduled.', type: 'success' });
            setShowForm(false);
            setNewData({ title: '', message: '', scheduledAt: format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"), type: 'info', targetRole: '' });
            fetchData();
        } catch (err) {
            setToast({ message: 'Failed to schedule.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Cancel this notification?')) return;
        try {
            await api.deleteScheduledNotification(id);
            setScheduled(scheduled.filter(s => s.id !== id));
            setToast({ message: 'Notification cancelled.', type: 'success' });
        } catch (err) {
            setToast({ message: 'Failed to cancel.', type: 'error' });
        }
    };

    const getTimelineEvents = () => {
        const events: any[] = [];
        autoRules.forEach(rule => {
            if (rule.config?.time) {
                events.push({
                    id: `auto-${rule.id}`,
                    time: rule.config.time,
                    title: rule.name,
                    icon: Zap,
                    color: 'text-amber-500',
                    bgColor: 'bg-amber-500/10',
                    borderColor: 'border-amber-500/10',
                    type: 'AUTOMATED'
                });
            }
        });
        scheduled.filter(s => !s.isSent).forEach(s => {
            const date = parseISO(s.scheduledAt);
            if (isAfter(date, new Date())) {
                events.push({
                    id: s.id,
                    time: format(date, 'HH:mm'),
                    title: s.title || 'Broadcast',
                    message: s.message,
                    icon: Send,
                    color: 'text-emerald-500',
                    bgColor: 'bg-emerald-500/10',
                    borderColor: 'border-emerald-500/10',
                    type: 'BROADCAST'
                });
            }
        });
        return events.sort((a, b) => a.time.localeCompare(b.time));
    };

    if (isLoading) return <LoadingScreen message="Loading Planner..." />;

    const timelineEvents = getTimelineEvents();
    const upcomingBroadcasts = scheduled.filter(s => !s.isSent);

    return (
        <div className="space-y-6 w-full animate-in fade-in duration-500">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Top Row: Metrics (Decluttered) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={Send} value={upcomingBroadcasts.length} title="Upcoming Broadcasts" />
                <StatCard icon={Zap} value={autoRules.length} title="Active Auto-Rules" />
                <StatCard icon={Users} value={roles.length} title="Target Roles" />
                <StatCard icon={CheckCircle2} value={scheduled.filter(s => s.isSent).length} title="Sent Today" />
            </div>

            {/* Main Content Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left: Timeline (Next 24 Hours) */}
                <div className="lg:col-span-4 lg:sticky lg:top-8">
                    <div className="bg-card p-6 rounded-xl shadow-card border border-border">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-md font-semibold text-primary-text flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted" />
                                Next 24 Hours
                            </h3>
                            <div className="flex items-center gap-1.5 opacity-50">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Monitoring</span>
                            </div>
                        </div>

                        <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-100 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {timelineEvents.length > 0 ? (
                                timelineEvents.map((event, idx) => (
                                    <div key={idx} className="relative pl-8 group">
                                        <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center bg-white border border-slate-100 ${event.color} z-10 shadow-sm transition-all group-hover:border-emerald-200`}>
                                            <event.icon className="h-2.5 w-2.5" />
                                        </div>
                                        <div className="p-4 bg-slate-50/50 rounded-xl border border-transparent hover:border-slate-200 hover:bg-white transition-all cursor-default shadow-sm">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[10px] font-bold tracking-widest text-muted uppercase">{event.type}</span>
                                                <span className={`text-[11px] font-bold ${event.color}`}>{event.time}</span>
                                            </div>
                                            <p className="text-sm font-semibold text-primary-text leading-tight">{event.title}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20 opacity-30">
                                    <Sparkles className="h-8 w-8 mx-auto mb-3" />
                                    <p className="text-xs font-bold uppercase tracking-widest">No Events Scheduled</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Action Area (Queue / Planned) */}
                <div className="lg:col-span-8 h-full">
                    {showForm ? (
                        <div className="bg-card p-8 rounded-xl shadow-card border border-border animate-in zoom-in-95 duration-300">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-accent-light text-accent-dark rounded-xl">
                                    <Send className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-primary-text">Broadcast Composer</h2>
                                    <p className="text-xs text-muted font-medium">Draft and schedule a push notification or alert.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                <div className="space-y-6">
                                    <Input 
                                        label="Notification Title" 
                                        placeholder="Enter headline..."
                                        value={newData.title}
                                        onChange={(e) => setNewData({ ...newData, title: e.target.value })}
                                    />
                                    <Select 
                                        label="Target Recipient Role"
                                        value={newData.targetRole} 
                                        onChange={(e) => setNewData({ ...newData, targetRole: e.target.value })}
                                    >
                                        <option value="">Select specific role...</option>
                                        <option value="all">Company-wide (Everyone)</option>
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.displayName}</option>
                                        ))}
                                    </Select>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <label className="text-sm text-muted font-medium ml-1">Scheduled Dispatch Time</label>
                                        <input 
                                            type="datetime-local" 
                                            className="w-full h-10 px-4 rounded-lg bg-white border border-border focus:ring-2 focus:ring-accent text-primary-text font-medium text-sm"
                                            value={newData.scheduledAt}
                                            onChange={(e) => setNewData({ ...newData, scheduledAt: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm text-muted font-medium ml-1">Broadcast Category</label>
                                        <div className="flex gap-2">
                                            {NOTIFICATION_TYPES.map(nt => (
                                                <button
                                                    key={nt.value}
                                                    type="button"
                                                    onClick={() => setNewData({ ...newData, type: nt.value as NotificationType })}
                                                    className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-tight border flex-grow transition-all ${newData.type === nt.value ? 'bg-accent text-white border-accent' : 'bg-white border-border text-muted hover:bg-slate-50'}`}
                                                >
                                                    {nt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 mb-10">
                                <label className="text-sm text-muted font-medium ml-1">Message Body</label>
                                <textarea 
                                    className="w-full h-40 p-4 rounded-xl bg-white border border-border focus:ring-2 focus:ring-accent text-primary-text font-medium resize-none shadow-inner"
                                    placeholder="Compose your message here..."
                                    value={newData.message}
                                    onChange={(e) => setNewData({ ...newData, message: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-4">
                                <Button 
                                    className="flex-grow h-12 rounded-xl text-md font-bold" 
                                    onClick={handleSave} 
                                    isLoading={isSaving}
                                >
                                    Confirm Scheduling
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="h-12 px-8 rounded-xl font-bold" 
                                    onClick={() => setShowForm(false)}
                                >
                                    Back
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 h-full flex flex-col">
                            {upcomingBroadcasts.length > 0 ? (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                                            <Send className="h-4 w-4" />
                                            Upcoming Queue
                                        </h3>
                                        <Button 
                                            size="sm" 
                                            variant="primary" 
                                            onClick={() => setShowForm(true)}
                                            className="rounded-lg px-4 h-9 text-xs"
                                        >
                                            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Notification
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {upcomingBroadcasts.map(item => {
                                            const typeInfo = NOTIFICATION_TYPES.find(t => t.value === item.type) || NOTIFICATION_TYPES[0];
                                            return (
                                                <div key={item.id} className="bg-card p-6 rounded-xl border border-border shadow-card hover:shadow-md transition-all animate-in fade-in duration-300">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className={`p-2 rounded-lg ${typeInfo.bg} ${typeInfo.color}`}>
                                                            <Bell className="h-5 w-5" />
                                                        </div>
                                                        <Button 
                                                            variant="icon" 
                                                            className="h-8 w-8 text-muted hover:text-red-500 hover:bg-red-50"
                                                            onClick={() => handleDelete(item.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${typeInfo.color} mb-1 block`}>{typeInfo.label}</span>
                                                    <h4 className="text-md font-bold text-primary-text mb-1 line-clamp-1">{item.title || 'Notification Broadcast'}</h4>
                                                    <p className="text-xs text-muted font-medium mb-6 line-clamp-3 leading-relaxed">{item.message}</p>
                                                    
                                                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="h-3.5 w-3.5 text-accent-dark" />
                                                            <span className="text-[11px] font-bold text-primary-text">{format(parseISO(item.scheduledAt), 'MMM d, h:mm a')}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted uppercase">
                                                            <Users className="h-3 w-3" />
                                                            {item.targetRole === 'all' ? 'Everyone' : 'Targeted'}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="bg-card p-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center flex-grow">
                                    <div className="w-20 h-20 bg-accent-light/30 rounded-full flex items-center justify-center mb-6">
                                        <Send className="h-8 w-8 text-accent-dark opacity-30" />
                                    </div>
                                    <h4 className="text-lg font-bold text-primary-text mb-2">Queue is Empty</h4>
                                    <p className="text-sm text-muted font-medium mb-8 max-w-[240px]">Plan and schedule future broadcasts for your organization.</p>
                                    <Button 
                                        onClick={() => setShowForm(true)}
                                        size="md"
                                        className="rounded-xl px-8"
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Create First Broadcast
                                    </Button>
                                </div>
                            )}

                            {/* Completed History - Subtle Section */}
                            {scheduled.filter(s => s.isSent).length > 0 && (
                                <div className="mt-auto pt-8 border-t border-border">
                                    <div className="flex items-center gap-3 mb-4">
                                        <CheckCircle2 className="h-4 w-4 text-accent-dark" />
                                        <h5 className="text-[11px] font-bold text-muted uppercase tracking-widest">Recently Completed</h5>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {scheduled.filter(s => s.isSent).slice(0, 2).map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                                                    <span className="text-xs font-semibold text-primary-text">{item.title}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-muted uppercase">{format(parseISO(item.processedAt || item.scheduledAt), 'MMM d')}</span>
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
