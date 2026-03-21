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
    Zap
} from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import Checkbox from '../../components/ui/Checkbox';
import { api } from '../../services/api';
import type { NotificationRule, NotificationType, User as AppUser, Role } from '../../types';
import LoadingScreen from '../../components/ui/LoadingScreen';
import AdvancedNotificationSettings from '../admin/AdvancedNotificationSettings';
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
    const [activeTab, setActiveTab] = useState<'rules' | 'broadcast' | 'automated'>('rules');
    const [rules, setRules] = useState<NotificationRule[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // New Rule Form State
    const [newRule, setNewRule] = useState<Partial<NotificationRule>>({
        eventType: 'check_in',
        recipientRole: 'direct_manager',
        isEnabled: true,
        sendAlert: false
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
                const [fetchedRules, fetchedRoles, fetchedUsers] = await Promise.all([
                    api.getNotificationRules(),
                    api.getRoles(),
                    api.getUsers()
                ]);
                setRules(fetchedRules);
                setRoles(fetchedRoles);
                setUsers(fetchedUsers.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
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
            isEnabled: rule.isEnabled
        });
        setIsEditing(true);
        // Scroll to form on mobile
        if (window.innerWidth < 1024) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const cancelEdit = () => {
        setNewRule({ eventType: 'check_in', recipientRole: 'direct_manager', isEnabled: true, sendAlert: false });
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
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="space-y-6 pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <AdminPageHeader title="Notification Management">
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setActiveTab('rules')} className={activeTab === 'rules' ? 'bg-accent text-white' : ''}>
                        <Settings className="mr-2 h-4 w-4" /> Rules
                    </Button>
                    <Button variant="secondary" onClick={() => setActiveTab('broadcast')} className={activeTab === 'broadcast' ? 'bg-accent text-white' : ''}>
                        <Send className="mr-2 h-4 w-4" /> Broadcast
                    </Button>
                    <Button variant="secondary" onClick={() => setActiveTab('automated')} className={activeTab === 'automated' ? 'bg-accent text-white' : ''}>
                        <Zap className="mr-2 h-4 w-4" /> Automated Alerts
                    </Button>
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

export default NotificationsControl;
