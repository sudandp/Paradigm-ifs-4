import React, { useState, useEffect } from 'react';
import { 
    Bell, 
    Send, 
    Settings, 
    Shield, 
    Users, 
    Plus, 
    Trash2, 
    Save, 
    Info, 
    User as UserIcon,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Target,
    Filter,
    Mail,
    Pencil,
    X as CloseIcon,
    Coffee,
    LogOut as LogOutIcon,
    ClipboardCheck,
    XCircle,
    UserCheck,
    MessageSquare,
    DollarSign, 
    FileText,
    Zap,
    Activity,
    Smartphone
} from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import Checkbox from '../../components/ui/Checkbox';
import { api } from '../../services/api';
import type { NotificationRule, NotificationType, User as AppUser, Role, EmailTemplate } from '../../types';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';
import AdvancedNotificationSettings from '../admin/AdvancedNotificationSettings';
import NotificationPlanner from './NotificationPlannerUI';
import EmailConfigPanel from './EmailConfigPanel';
import { APP_EVENT_TYPES } from '../../utils/notificationTypes';


const EVENT_TYPES = APP_EVENT_TYPES.map(e => ({ value: e.id, label: e.label, icon: e.icon }));

const RECIPIENT_ROLES = [
    { value: 'direct_manager', label: 'Direct Reporting Manager' },
    { value: 'hr', label: 'HR Admin' },
    { value: 'ops_manager', label: 'Operations Manager' },
    { value: 'admin', label: 'System Administrator' },
    { value: 'finance', label: 'Finance Team' }
];

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
    { value: 'info', label: 'Information' },
    { value: 'security', label: 'Security Alert' },
    { value: 'task_assigned', label: 'Task Update' },
    { value: 'greeting', label: 'General / Greeting' },
    { value: 'direct_ping', label: 'Direct Ping' }
];

const NotificationsControl: React.FC = () => {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'rules' | 'broadcast' | 'automated' | 'planner' | 'activity' | 'email'>('rules');
    const [rules, setRules] = useState<NotificationRule[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    const role = (user?.role || '').toLowerCase();
    const isNotificationManager = ['admin', 'super_admin', 'management', 'hr', 'hr_ops', 'notification_manager', 'developer'].includes(role);

    // New Rule Form State
    const [newRule, setNewRule] = useState<Partial<NotificationRule>>({
        eventType: 'check_in',
        recipientRole: 'direct_manager',
        isEnabled: true,
        sendAlert: false,
        sendPush: false,
        sendEmail: false,
        emailTemplateId: ''
    });

    // Broadcast Form State
    const [broadcastData, setBroadcastData] = useState({
        role: '',
        userIds: [] as string[],
        title: '',
        message: '',
        type: 'info' as NotificationType
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [fetchedRules, fetchedRoles, fetchedUsers, fetchedTemplates] = await Promise.all([
                    api.getNotificationRules(),
                    api.getRoles(),
                    api.getUsers(),
                    api.getEmailTemplates()
                ]);
                setRules(fetchedRules);
                setRoles(fetchedRoles);
                setUsers(fetchedUsers.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
                setEmailTemplates(fetchedTemplates.filter(t => t.isActive));
            } catch (err) {
                setToast({ message: 'Failed to load data.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleAddRule = async () => {
        setIsSaving(true);
        try {
            const rule = await api.saveNotificationRule(newRule);
            if (isEditing) {
                setRules(rules.map(r => r.id === rule.id ? rule : r));
                setToast({ message: 'Rule updated successfully.', type: 'success' });
            } else {
                setRules([rule, ...rules]);
                setToast({ message: 'Rule added successfully.', type: 'success' });
            }
            cancelEdit();
        } catch (err) {
            setToast({ message: isEditing ? 'Failed to update rule.' : 'Failed to add rule.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditRule = (rule: NotificationRule) => {
        setNewRule({
            id: rule.id,
            eventType: rule.eventType,
            recipientRole: rule.recipientRole,
            recipientUserId: rule.recipientUserId,
            isEnabled: rule.isEnabled,
            sendPush: rule.sendPush,
            sendAlert: rule.sendAlert,
            sendEmail: rule.sendEmail,
            emailTemplateId: rule.emailTemplateId
        });
        setIsEditing(true);
        // Scroll to form on mobile
        if (window.innerWidth < 1024) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const cancelEdit = () => {
        setNewRule({ 
            eventType: 'check_in', 
            recipientRole: 'direct_manager', 
            isEnabled: true, 
            sendAlert: false, 
            sendPush: false, 
            sendEmail: false, 
            emailTemplateId: '' 
        });
        setIsEditing(false);
    };

    const handleToggleRule = async (rule: NotificationRule) => {
        try {
            const updated = await api.saveNotificationRule({ ...rule, isEnabled: !rule.isEnabled });
            setRules(rules.map(r => r.id === rule.id ? updated : r));
        } catch (err) {
            setToast({ message: 'Failed to update rule.', type: 'error' });
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm('Are you sure you want to delete this rule?')) return;
        try {
            await api.deleteNotificationRule(id);
            setRules(rules.filter(r => r.id !== id));
            setToast({ message: 'Rule deleted.', type: 'success' });
        } catch (err) {
            setToast({ message: 'Failed to delete rule.', type: 'error' });
        }
    };

    const handleBroadcast = async () => {
        if (!broadcastData.message) {
            setToast({ message: 'Please enter a message.', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            // For true global broadcasts, we ensure the backend knows
            const isAll = broadcastData.role === 'all' || (broadcastData.role === '' && broadcastData.userIds.length === 0);
            
            await api.broadcastNotification({
                ...broadcastData,
                role: isAll ? 'all' : broadcastData.role
            });
            
            setToast({ message: 'Broadcast sent successfully!', type: 'success' });
            setBroadcastData({ role: '', userIds: [], title: '', message: '', type: 'info' });
        } catch (err) {
            console.error('[Broadcast] Error:', err);
            setToast({ message: 'Failed to send broadcast.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="space-y-6 pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <AdminPageHeader title="Notification Management">
                <div className="flex p-1 bg-slate-100/50 rounded-xl border border-slate-200/50 backdrop-blur-sm">
                    <button 
                        onClick={() => setActiveTab('rules')} 
                        className={`flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'rules' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Settings className="mr-2 h-3.5 w-3.5" /> Rules
                    </button>
                    {isNotificationManager && (
                        <>
                            <button 
                                onClick={() => setActiveTab('broadcast')} 
                                className={`flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'broadcast' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Send className="mr-2 h-3.5 w-3.5" /> Broadcast
                            </button>
                            <button 
                                onClick={() => setActiveTab('automated')} 
                                className={`flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'automated' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Zap className="mr-2 h-3.5 w-3.5" /> Automated
                            </button>
                            <button 
                                onClick={() => setActiveTab('planner')} 
                                className={`flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'planner' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Clock className="mr-2 h-3.5 w-3.5" /> Planner
                            </button>
                            <button 
                                onClick={() => setActiveTab('activity')} 
                                className={`flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'activity' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Activity className="mr-2 h-3.5 w-3.5" /> Activity
                            </button>
                            <button 
                                onClick={() => setActiveTab('email')} 
                                className={`flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'email' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Mail className="mr-2 h-3.5 w-3.5" /> Email
                            </button>
                        </>
                    )}
                </div>
            </AdminPageHeader>

            {activeTab === 'rules' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Add Rule Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        <section className={`bg-card p-6 rounded-xl border shadow-sm transition-all duration-300 ${isEditing ? 'border-accent ring-1 ring-accent/20' : 'border-border'}`}>
                            <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
                                <span className="flex items-center">
                                    {isEditing ? <Pencil className="mr-2 h-5 w-5 text-accent" /> : <Plus className="mr-2 h-5 w-5 text-accent" />}
                                    {isEditing ? 'Edit Dispatch Rule' : 'New Dispatch Rule'}
                                </span>
                                {isEditing && (
                                    <button onClick={cancelEdit} className="text-muted hover:text-primary-text p-1">
                                        <CloseIcon className="h-4 w-4" />
                                    </button>
                                )}
                            </h3>
                            <div className="space-y-4">
                                <Select 
                                    label="When event occurs..." 
                                    value={newRule.eventType} 
                                    onChange={(e) => setNewRule({ ...newRule, eventType: e.target.value })}
                                >
                                    {EVENT_TYPES.map(et => (
                                        <option key={et.value} value={et.value}>{et.label}</option>
                                    ))}
                                </Select>

                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-primary-text">Notify this recipient...</p>
                                    <Select 
                                        value={newRule.recipientRole || ''} 
                                        onChange={(e) => setNewRule({ ...newRule, recipientRole: e.target.value, recipientUserId: undefined })}
                                    >
                                        <option value="">Select Role</option>
                                        {RECIPIENT_ROLES.map(role => (
                                            <option key={role.value} value={role.value}>{role.label}</option>
                                        ))}
                                    </Select>
                                    <div className="relative flex items-center py-2">
                                        <div className="flex-grow border-t border-border"></div>
                                        <span className="flex-shrink mx-4 text-xs text-muted uppercase">Or Specific User</span>
                                        <div className="flex-grow border-t border-border"></div>
                                    </div>
                                    <Select 
                                        value={newRule.recipientUserId || ''} 
                                        onChange={(e) => setNewRule({ ...newRule, recipientUserId: e.target.value, recipientRole: undefined })}
                                    >
                                        <option value="">Select User</option>
                                        <option value="all">All Users</option>
                                        {users.map(user => (
                                            <option key={user.id} value={user.id}>{user.name}</option>
                                        ))}
                                    </Select>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <Checkbox 
                                        id="newRuleSendAlert"
                                        label="Trigger standard Alert / Warning UI"
                                        checked={newRule.sendAlert}
                                        onChange={(e) => setNewRule({ ...newRule, sendAlert: e.target.checked })}
                                    />
                                    <Checkbox 
                                        id="newRuleSendPush"
                                        label="Trigger Real-time Push Notification"
                                        checked={newRule.sendPush}
                                        onChange={(e) => setNewRule({ ...newRule, sendPush: e.target.checked })}
                                    />
                                    <Checkbox 
                                        id="newRuleSendEmail"
                                        label="Send Automated Email Alert"
                                        checked={newRule.sendEmail}
                                        onChange={(e) => setNewRule({ ...newRule, sendEmail: e.target.checked })}
                                    />
                                    {newRule.sendEmail && (
                                        <Select 
                                            label="Select Email Template" 
                                            value={newRule.emailTemplateId || ''} 
                                            onChange={(e) => setNewRule({ ...newRule, emailTemplateId: e.target.value })}
                                        >
                                            <option value="">Choose Template...</option>
                                            {emailTemplates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </Select>
                                    )}
                                    <Button className="w-full" onClick={handleAddRule} isLoading={isSaving}>
                                        {isEditing ? 'Update Rule' : 'Create Rule'}
                                    </Button>
                                    {isEditing && (
                                        <Button variant="secondary" className="w-full" onClick={cancelEdit}>
                                            Cancel Edit
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </section>

                                <div className="p-4 bg-accent/5 rounded-xl border border-accent/10">
                            <div className="flex items-start gap-3">
                                <Info className="h-5 w-5 text-accent mt-0.5" />
                                <div className="text-sm text-primary-text/80 space-y-2">
                                    <p>Rules define automatic notification routing based on system events.</p>
                                    <p><strong>Example:</strong> If you set "Violation" to "HR Admin", every geofencing violation will trigger an alert to all HR users.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rules List */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold flex items-center">
                                <Filter className="mr-2 h-5 w-5 text-muted" /> Active Rules ({rules.length})
                            </h3>
                        </div>

                        {rules.map(rule => {
                            const eventType = EVENT_TYPES.find(et => et.value === rule.eventType);
                            const Icon = eventType?.icon || Bell;
                            const recipientUser = rule.recipientUserId ? users.find(u => u.id === rule.recipientUserId) : null;
                            const recipientRole = RECIPIENT_ROLES.find(r => r.value === rule.recipientRole);

                            return (
                                <div key={rule.id} className={`bg-card p-4 rounded-xl border transition-all ${rule.isEnabled ? 'border-border' : 'border-dashed opacity-60'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${rule.isEnabled ? 'bg-accent/10 text-accent' : 'bg-muted/10 text-muted'}`}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-primary-text">{eventType?.label || rule.eventType}</p>
                                                <p className="text-sm text-muted">
                                                    Notifies: <span className="font-medium text-emerald-600">
                                                        {rule.recipientUserId === 'all' ? 'All Users' : (recipientUser ? `User: ${recipientUser.name}` : (recipientRole?.label || rule.recipientRole))}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-4 border-r border-border px-4">
                                                <Button 
                                                    variant="icon" 
                                                    onClick={() => handleEditRule(rule)} 
                                                    className="text-accent hover:bg-accent/5 h-8 w-8" 
                                                    title="Edit Rule"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Alert</span>
                                                    <Checkbox 
                                                        id={`alert-${rule.id}`} 
                                                        label=""
                                                        checked={rule.sendAlert} 
                                                        onChange={async () => {
                                                            try {
                                                                const updated = await api.saveNotificationRule({ ...rule, sendAlert: !rule.sendAlert });
                                                                setRules(rules.map(r => r.id === rule.id ? updated : r));
                                                            } catch (err) {
                                                                setToast({ message: 'Failed to update alert setting.', type: 'error' });
                                                            }
                                                        }} 
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Push</span>
                                                    <Checkbox 
                                                        id={`push-${rule.id}`} 
                                                        label=""
                                                        checked={rule.sendPush} 
                                                        onChange={async () => {
                                                            try {
                                                                const updated = await api.saveNotificationRule({ ...rule, sendPush: !rule.sendPush });
                                                                setRules(rules.map(r => r.id === rule.id ? updated : r));
                                                            } catch (err) {
                                                                setToast({ message: 'Failed to update push setting.', type: 'error' });
                                                            }
                                                        }} 
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Email</span>
                                                    <Checkbox 
                                                        id={`email-${rule.id}`} 
                                                        label=""
                                                        checked={rule.sendEmail} 
                                                        onChange={async () => {
                                                            try {
                                                                const updated = await api.saveNotificationRule({ ...rule, sendEmail: !rule.sendEmail });
                                                                setRules(rules.map(r => r.id === rule.id ? updated : r));
                                                            } catch (err) {
                                                                setToast({ message: 'Failed to update email setting.', type: 'error' });
                                                            }
                                                        }} 
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Active</span>
                                                    <Checkbox 
                                                        id={`rule-${rule.id}`} 
                                                        label=""
                                                        checked={rule.isEnabled} 
                                                        onChange={() => handleToggleRule(rule)} 
                                                    />
                                                </div>
                                            </div>
                                            <Button 
                                                variant="icon" 
                                                onClick={() => handleDeleteRule(rule.id)} 
                                                className="text-red-500 hover:bg-red-50 h-8 w-8" 
                                                title="Delete Rule"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {rules.length === 0 && (
                            <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
                                <Settings className="h-12 w-12 text-muted mx-auto mb-4 opacity-20" />
                                <p className="text-muted">No dispatch rules configured yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : activeTab === 'automated' ? (
                <AdvancedNotificationSettings hideHeader={true} />
            ) : activeTab === 'planner' ? (
                <NotificationPlanner />
            ) : activeTab === 'activity' ? (
                <ActivityGreetingConfig rules={rules} setRules={setRules} toast={toast} setToast={setToast} />
            ) : activeTab === 'email' ? (
                <EmailConfigPanel />
            ) : (
                <div className="space-y-6">
                    <section className="bg-card p-8 rounded-2xl border border-border shadow-lg">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-emerald-200 shadow-xl">
                                <Send className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Compose Broadcast</h3>
                                <p className="text-muted text-sm">Send a custom notification to targeted groups.</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                        <Users className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-emerald-900 leading-tight">Global Broadcast</p>
                                        <p className="text-xs text-emerald-700">Message every user in the system</p>
                                    </div>
                                </div>
                                <Checkbox 
                                    label="Send to All" 
                                    checked={broadcastData.role === 'all'} 
                                    onChange={(e) => setBroadcastData({ ...broadcastData, role: e.target.checked ? 'all' : '', userIds: [] })}
                                    className="scale-110"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Select 
                                    label="Target Audience" 
                                    value={broadcastData.role === 'all' ? 'all' : broadcastData.role} 
                                    disabled={broadcastData.role === 'all'}
                                    onChange={(e) => setBroadcastData({ ...broadcastData, role: e.target.value, userIds: [] })}
                                >
                                    <option value="">Specific Users</option>
                                    <option value="all">Everyone</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.displayName}</option>
                                    ))}
                                </Select>

                                <Select 
                                    label="Alert Level" 
                                    value={broadcastData.type} 
                                    onChange={(e) => setBroadcastData({ ...broadcastData, type: e.target.value as NotificationType })}
                                >
                                    {NOTIFICATION_TYPES.map(nt => (
                                        <option key={nt.value} value={nt.value}>{nt.label}</option>
                                    ))}
                                </Select>
                            </div>

                            {!broadcastData.role && (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-primary-text">Select Recipients</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 border border-border rounded-xl bg-page/50">
                                        {users.map(user => (
                                            <Checkbox 
                                                key={user.id}
                                                label={user.name}
                                                className="hover:bg-white rounded-lg transition-colors p-1"
                                                labelClassName="text-xs truncate"
                                                checked={broadcastData.userIds.includes(user.id)}
                                                onChange={(e) => {
                                                    const userIds = e.target.checked 
                                                        ? [...broadcastData.userIds, user.id]
                                                        : broadcastData.userIds.filter(id => id !== user.id);
                                                    setBroadcastData({ ...broadcastData, userIds });
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Input 
                                label="Subject / Title" 
                                placeholder="e.g. Office Closure Notice"
                                value={broadcastData.title}
                                onChange={(e) => setBroadcastData({ ...broadcastData, title: e.target.value })}
                            />

                            <div className="space-y-2">
                                <p className="text-sm font-medium text-primary-text">Message Content</p>
                                <textarea 
                                    className="w-full h-32 p-4 rounded-xl border border-border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                    placeholder="Type your message here..."
                                    value={broadcastData.message}
                                    onChange={(e) => setBroadcastData({ ...broadcastData, message: e.target.value })}
                                />
                            </div>

                            <Button 
                                className="w-full h-12 text-lg shadow-emerald-100 shadow-xl" 
                                onClick={handleBroadcast} 
                                isLoading={isSaving}
                                disabled={!broadcastData.message}
                            >
                                <Send className="mr-2 h-5 w-5" /> Send Notification
                            </Button>
                        </div>
                    </section>

                    <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 flex gap-4">
                        <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                        <div>
                            <h4 className="font-bold text-amber-800">Broadcast Caution</h4>
                            <p className="text-amber-700 text-sm">
                                Manual broadcasts are sent immediately to the selected users' notification centers. 
                                Use this tool responsibly for critical updates or universal reminders.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Activity-Based Greeting Configuration ─────────────────────────────────
// This component provides a simple toggle UI for enabling greeting + push
// notifications on specific user activities (punch-in, punch-out, etc.)

const ACTIVITY_EVENTS = [
    { id: 'check_in', label: 'Office Punch In', description: 'Send greeting when employee punches in at office', emoji: '🟢', color: 'emerald' },
    { id: 'check_out', label: 'Office Punch Out', description: 'Send farewell when employee punches out', emoji: '🔴', color: 'red' },
    { id: 'site_check_in', label: 'Site Check-in', description: 'Send greeting when employee checks in at field site', emoji: '📍', color: 'blue' },
    { id: 'site_check_out', label: 'Site Check-out', description: 'Send notification when employee checks out from site', emoji: '📌', color: 'indigo' },
    { id: 'break_start', label: 'Break Start', description: 'Notify when employee starts a break', emoji: '☕', color: 'amber' },
    { id: 'break_end', label: 'Break End', description: 'Notify when employee ends a break', emoji: '🏁', color: 'orange' },
    { id: 'user_login', label: 'User Login', description: 'Send welcome greeting on login', emoji: '👋', color: 'violet' },
    { id: 'user_logout', label: 'User Logout', description: 'Send farewell on logout', emoji: '👋', color: 'slate' },
];

interface ActivityGreetingConfigProps {
    rules: NotificationRule[];
    setRules: React.Dispatch<React.SetStateAction<NotificationRule[]>>;
    toast: { message: string; type: 'success' | 'error' } | null;
    setToast: React.Dispatch<React.SetStateAction<{ message: string; type: 'success' | 'error' } | null>>;
}

const ActivityGreetingConfig: React.FC<ActivityGreetingConfigProps> = ({ rules, setRules, toast, setToast }) => {
    const [savingId, setSavingId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState({ description: '', emoji: '', color: '' });
    const [customActivities, setCustomActivities] = useState<typeof ACTIVITY_EVENTS>(() => {
        try {
            const stored = localStorage.getItem('custom_activity_events');
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });
    // Overrides for default cards (emoji/color/description changes)
    const [defaultOverrides, setDefaultOverrides] = useState<Record<string, { emoji?: string; color?: string; description?: string }>>(() => {
        try {
            const stored = localStorage.getItem('activity_default_overrides');
            return stored ? JSON.parse(stored) : {};
        } catch { return {}; }
    });
    const [newActivity, setNewActivity] = useState({ eventId: '', description: '', emoji: '🔔', color: 'emerald' });

    // Merge overrides into default activities
    const mergedDefaults = ACTIVITY_EVENTS.map(a => {
        const override = defaultOverrides[a.id];
        return override ? { ...a, ...override } : a;
    });
    const allActivities = [...mergedDefaults, ...customActivities];
    const usedEventIds = new Set(allActivities.map(a => a.id));
    const availableEvents = APP_EVENT_TYPES.filter(e => !usedEventIds.has(e.id));

    const saveCustomActivities = (updated: typeof ACTIVITY_EVENTS) => {
        setCustomActivities(updated);
        localStorage.setItem('custom_activity_events', JSON.stringify(updated));
    };
    const saveDefaultOverrides = (updated: typeof defaultOverrides) => {
        setDefaultOverrides(updated);
        localStorage.setItem('activity_default_overrides', JSON.stringify(updated));
    };

    const getGreetingRule = (eventType: string) => {
        return rules.find(r => r.eventType === eventType && r.sendPush && r.isEnabled);
    };

    const handleToggle = async (eventId: string, isCurrentlyActive: boolean) => {
        if (editingId) return; // Don't toggle when editing
        setSavingId(eventId);
        try {
            if (isCurrentlyActive) {
                const rule = getGreetingRule(eventId);
                if (rule) {
                    await api.deleteNotificationRule(rule.id);
                    setRules(prev => prev.filter(r => r.id !== rule.id));
                }
            } else {
                const newRule = await api.saveNotificationRule({
                    eventType: eventId,
                    recipientRole: 'direct_manager',
                    isEnabled: true,
                    sendAlert: false,
                    sendPush: true
                });
                setRules(prev => [newRule, ...prev]);
            }
            setToast({ message: isCurrentlyActive ? 'Activity notification disabled.' : 'Activity notification enabled with real-time push!', type: 'success' });
        } catch (err) {
            setToast({ message: 'Failed to update activity rule.', type: 'error' });
        } finally {
            setSavingId(null);
        }
    };

    const handleAddActivity = () => {
        if (!newActivity.eventId) {
            setToast({ message: 'Please select an event type.', type: 'error' });
            return;
        }
        const eventMeta = APP_EVENT_TYPES.find(e => e.id === newActivity.eventId);
        if (!eventMeta) return;
        const activity = {
            id: newActivity.eventId,
            label: eventMeta.label,
            description: newActivity.description || `Send notification on ${eventMeta.label}`,
            emoji: newActivity.emoji,
            color: newActivity.color
        };
        saveCustomActivities([...customActivities, activity]);
        setNewActivity({ eventId: '', description: '', emoji: '🔔', color: 'emerald' });
        setShowAddForm(false);
        setToast({ message: `"${eventMeta.label}" added to activities!`, type: 'success' });
    };

    const handleRemoveCustom = (eventId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const rule = getGreetingRule(eventId);
        if (rule) {
            api.deleteNotificationRule(rule.id).catch(() => {});
            setRules(prev => prev.filter(r => r.id !== rule.id));
        }
        saveCustomActivities(customActivities.filter(a => a.id !== eventId));
        setToast({ message: 'Activity removed.', type: 'success' });
    };

    const handleEditStart = (event: typeof ACTIVITY_EVENTS[0], e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(event.id);
        setEditData({ description: event.description, emoji: event.emoji, color: event.color });
    };

    const handleEditSave = (eventId: string) => {
        const isCustom = customActivities.some(c => c.id === eventId);
        if (isCustom) {
            // Update custom activity directly
            saveCustomActivities(customActivities.map(a => a.id === eventId ? { ...a, ...editData } : a));
        } else {
            // Save as override for default card
            saveDefaultOverrides({ ...defaultOverrides, [eventId]: editData });
        }
        setEditingId(null);
        setToast({ message: 'Activity updated!', type: 'success' });
    };

    const handleEditCancel = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingId(null);
    };

    const EMOJI_OPTIONS = ['🔔', '📢', '📋', '✅', '⚡', '🎯', '💼', '📊', '🔒', '⏰', '🚀', '💬', '📝', '🏷️', '🔧', '🎉', '🟢', '🔴', '📍', '📌', '☕', '🏁', '👋'];
    const COLOR_OPTIONS = [
        { value: 'emerald', css: 'bg-emerald-500' },
        { value: 'red', css: 'bg-red-500' },
        { value: 'blue', css: 'bg-blue-500' },
        { value: 'indigo', css: 'bg-indigo-500' },
        { value: 'amber', css: 'bg-amber-500' },
        { value: 'orange', css: 'bg-orange-500' },
        { value: 'violet', css: 'bg-violet-500' },
        { value: 'slate', css: 'bg-slate-500' },
    ];
    const colorMap: Record<string, string> = {
        emerald: 'from-emerald-500 to-emerald-600', red: 'from-red-500 to-red-600',
        blue: 'from-blue-500 to-blue-600', indigo: 'from-indigo-500 to-indigo-600',
        amber: 'from-amber-500 to-amber-600', orange: 'from-orange-500 to-orange-600',
        violet: 'from-violet-500 to-violet-600', slate: 'from-slate-500 to-slate-600',
    };

    return (
        <div className="space-y-6">
            <section className="bg-card p-8 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg">
                            <Activity className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-primary-text">Activity-Based Notifications</h3>
                            <p className="text-muted text-sm">Enable real-time push notifications for employee actions.</p>
                        </div>
                    </div>
                    <Button onClick={() => setShowAddForm(!showAddForm)} className="shrink-0">
                        <Plus className="h-4 w-4 mr-2" /> Add Activity
                    </Button>
                </div>

                {showAddForm && (
                    <div className="mt-6 p-5 bg-page/50 rounded-xl border border-dashed border-accent/30 space-y-4">
                        <h4 className="font-bold text-sm text-primary-text flex items-center gap-2">
                            <Plus className="h-4 w-4 text-accent" /> Create New Activity Notification
                        </h4>
                        <Select label="Select Event Type" value={newActivity.eventId} onChange={(e) => setNewActivity({ ...newActivity, eventId: e.target.value })}>
                            <option value="">Choose an event...</option>
                            {availableEvents.map(ev => (
                                <option key={ev.id} value={ev.id}>{ev.label} ({ev.category})</option>
                            ))}
                        </Select>
                        <Input label="Description (optional)" placeholder="e.g. Notify when employee completes a task" value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })} />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-primary-text mb-2">Emoji</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {EMOJI_OPTIONS.map(em => (
                                        <button key={em} type="button" onClick={() => setNewActivity({ ...newActivity, emoji: em })}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${newActivity.emoji === em ? 'ring-2 ring-accent bg-accent/10 scale-110' : 'bg-page hover:bg-white'}`}>{em}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary-text mb-2">Color</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {COLOR_OPTIONS.map(c => (
                                        <button key={c.value} type="button" onClick={() => setNewActivity({ ...newActivity, color: c.value })}
                                            className={`w-8 h-8 rounded-full ${c.css} transition-all ${newActivity.color === c.value ? 'ring-2 ring-offset-2 ring-accent scale-110' : 'opacity-60 hover:opacity-100'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button onClick={handleAddActivity} className="flex-1"><CheckCircle2 className="h-4 w-4 mr-2" /> Add Activity</Button>
                            <Button variant="secondary" onClick={() => { setShowAddForm(false); setNewActivity({ eventId: '', description: '', emoji: '🔔', color: 'emerald' }); }}>Cancel</Button>
                        </div>
                    </div>
                )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {allActivities.map(event => {
                    const isActive = !!getGreetingRule(event.id);
                    const isSaving = savingId === event.id;
                    const isEditing = editingId === event.id;
                    const isCustom = customActivities.some(c => c.id === event.id);
                    const displayEmoji = isEditing ? editData.emoji : event.emoji;
                    const displayColor = isEditing ? editData.color : event.color;
                    const gradient = colorMap[displayColor] || 'from-emerald-500 to-emerald-600';

                    if (isEditing) {
                        return (
                            <div key={event.id} className="bg-card rounded-2xl border-2 border-accent/40 p-5 shadow-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-bold text-sm text-primary-text flex items-center gap-2">
                                        <Pencil className="h-3.5 w-3.5 text-accent" /> Edit: {event.label}
                                    </h4>
                                    <button onClick={handleEditCancel} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                                        <CloseIcon className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs font-medium text-muted mb-1.5">Description</p>
                                        <input
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-border focus:ring-2 focus:ring-accent focus:border-accent bg-white"
                                            value={editData.description}
                                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted mb-1.5">Emoji</p>
                                        <div className="flex flex-wrap gap-1">
                                            {EMOJI_OPTIONS.map(em => (
                                                <button key={em} type="button" onClick={(e) => { e.stopPropagation(); setEditData({ ...editData, emoji: em }); }}
                                                    className={`w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all ${editData.emoji === em ? 'ring-2 ring-accent bg-accent/10 scale-110' : 'bg-page hover:bg-white'}`}>{em}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted mb-1.5">Color</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {COLOR_OPTIONS.map(c => (
                                                <button key={c.value} type="button" onClick={(e) => { e.stopPropagation(); setEditData({ ...editData, color: c.value }); }}
                                                    className={`w-7 h-7 rounded-full ${c.css} transition-all ${editData.color === c.value ? 'ring-2 ring-offset-2 ring-accent scale-110' : 'opacity-50 hover:opacity-100'}`} />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <Button onClick={(e: any) => { e.stopPropagation(); handleEditSave(event.id); }} className="flex-1 h-9 text-xs">
                                            <Save className="h-3.5 w-3.5 mr-1.5" /> Save
                                        </Button>
                                        <Button variant="secondary" onClick={handleEditCancel} className="h-9 text-xs">Cancel</Button>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={event.id}
                            className={`relative bg-card rounded-2xl border-2 p-5 transition-all duration-300 cursor-pointer group hover:shadow-lg ${isActive ? 'border-emerald-400 shadow-emerald-100 shadow-md' : 'border-border hover:border-slate-300'} ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}
                            onClick={() => handleToggle(event.id, isActive)}>
                            <div className="absolute top-4 right-4 flex items-center gap-1.5">
                                <button onClick={(e) => handleEditStart(event, e)}
                                    className="p-1 rounded-full text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100" title="Edit activity">
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {isCustom && (
                                    <button onClick={(e) => handleRemoveCustom(event.id, e)}
                                        className="p-1 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100" title="Remove activity">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                    {isActive ? (<><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span> Live</>) : 'Off'}
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white text-xl shadow-sm shrink-0`}>{event.emoji}</div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-primary-text text-sm">{event.label}</h4>
                                    <p className="text-xs text-muted mt-1 leading-relaxed">{event.description}</p>
                                </div>
                            </div>
                            {isActive && (
                                <div className="mt-4 flex items-center gap-3 pt-3 border-t border-border/50">
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-lg"><Smartphone className="h-3 w-3 text-emerald-600" /><span className="text-[10px] font-bold text-emerald-700 uppercase">Push</span></div>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 rounded-lg"><Bell className="h-3 w-3 text-violet-600" /><span className="text-[10px] font-bold text-violet-700 uppercase">In-App</span></div>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg"><Users className="h-3 w-3 text-blue-600" /><span className="text-[10px] font-bold text-blue-700 uppercase">All Users</span></div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-4">
                <Info className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800 space-y-1">
                    <p className="font-bold">How it works</p>
                    <p className="text-xs text-emerald-700">Click a card to enable/disable push notifications. Hover over any card to see the <strong>✏️ edit</strong> and <strong>🗑️ delete</strong> buttons. Use <strong>"+ Add Activity"</strong> to add new event types.</p>
                </div>
            </div>
        </div>
    );
};

export default NotificationsControl;
