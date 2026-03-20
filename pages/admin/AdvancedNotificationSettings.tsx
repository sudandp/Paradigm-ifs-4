import React, { useState, useEffect } from 'react';
import { 
    Bell, 
    Settings, 
    Shield, 
    Plus, 
    Trash2, 
    Save, 
    Info, 
    AlertTriangle,
    CheckCircle2,
    Clock,
    Pencil,
    X as CloseIcon,
    MessageSquare,
    Smartphone,
    Mail,
    Zap,
    Users
} from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import Checkbox from '../../components/ui/Checkbox';
import { api } from '../../services/api';
import type { AutomatedNotificationRule } from '../../types';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { PROACTIVE_TRIGGER_TYPES, APP_EVENT_TYPES } from '../../utils/notificationTypes';

interface AdvancedNotificationSettingsProps {
    hideHeader?: boolean;
}

const TRIGGER_TYPES = [
    ...PROACTIVE_TRIGGER_TYPES.map(t => ({ value: t.id, label: t.label, description: t.description })),
    ...APP_EVENT_TYPES.map(t => ({ value: `event_${t.id}`, label: `On Event: ${t.label}`, description: `Triggered immediately when ${t.label} occurs` }))
];

const AdvancedNotificationSettings: React.FC<AdvancedNotificationSettingsProps> = ({ hideHeader = false }) => {
    const [rules, setRules] = useState<AutomatedNotificationRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<AutomatedNotificationRule>>({
        name: '',
        triggerType: 'missed_punch_out',
        isActive: true,
        enablePush: true,
        enableSms: false,
        config: { time: '21:00', notifyManager: false },
        pushTitleTemplate: 'Reminder: Punch Out Required',
        pushBodyTemplate: 'Hi {name}, it looks like you haven\'t punched out yet. Please punch out to avoid attendance violations.',
        smsTemplate: 'Paradigm Alerts: Hi {name}, please punch out of your shift at {site} now.'
    });

    useEffect(() => {
        const fetchRules = async () => {
            try {
                const data = await api.getAutomatedRules();
                setRules(data);
            } catch (err) {
                setToast({ message: 'Failed to load automated rules.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchRules();
    }, []);

    const handleSave = async () => {
        if (!formData.name) {
            setToast({ message: 'Please provide a rule name.', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            const saved = await api.saveAutomatedRule(formData);
            if (isEditing) {
                setRules(rules.map(r => r.id === saved.id ? saved : r));
                setToast({ message: 'Rule updated successfully.', type: 'success' });
            } else {
                setRules([saved, ...rules]);
                setToast({ message: 'Rule created successfully.', type: 'success' });
            }
            resetForm();
        } catch (err) {
            setToast({ message: 'Failed to save rule.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (rule: AutomatedNotificationRule) => {
        setFormData(rule);
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this automated rule?')) return;
        try {
            await api.deleteAutomatedRule(id);
            setRules(rules.filter(r => r.id !== id));
            setToast({ message: 'Rule deleted.', type: 'success' });
        } catch (err) {
            setToast({ message: 'Failed to delete rule.', type: 'error' });
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            triggerType: 'missed_punch_out',
            isActive: true,
            enablePush: true,
            enableSms: false,
            config: { time: '21:00', notifyManager: false },
            pushTitleTemplate: 'Reminder: Punch Out Required',
            pushBodyTemplate: 'Hi {name}, it looks like you haven\'t punched out yet. Please punch out to avoid attendance violations.',
            smsTemplate: 'Paradigm Alerts: Hi {name}, please punch out of your shift at {site} now.'
        });
        setIsEditing(false);
    };

    if (isLoading) {
        return <LoadingScreen message="Loading automated rules..." />;
    }

    return (
        <div className="space-y-6 pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {!hideHeader && (
                <AdminPageHeader title="Automated Notification Rules">
                    <div className="p-1 bg-white/50 backdrop-blur rounded-lg border flex gap-2">
                    <div className="flex items-center px-4 py-2 text-xs font-bold text-accent uppercase tracking-wider">
                        <Zap className="h-4 w-4 mr-2" /> Proactive AI Alerts
                    </div>
                    </div>
                </AdminPageHeader>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Rule Configuration Panel */}
                <div className="lg:col-span-1 space-y-6">
                    <section className={`bg-card p-6 rounded-2xl border transition-all shadow-sm ${isEditing ? 'border-accent ring-1 ring-accent/10' : 'border-border'}`}>
                        <h3 className="text-xl font-bold mb-6 flex items-center justify-between">
                            <span className="flex items-center">
                                {isEditing ? <Pencil className="mr-3 h-5 w-5 text-accent" /> : <Plus className="mr-3 h-5 w-5 text-accent" />}
                                {isEditing ? 'Update Rule' : 'New Rule'}
                            </span>
                            {isEditing && (
                                <button onClick={resetForm} className="text-muted hover:text-primary-text p-1 bg-page rounded-full">
                                    <CloseIcon className="h-4 w-4" />
                                </button>
                            )}
                        </h3>

                        <div className="space-y-5">
                            <Input 
                                label="Rule Name" 
                                placeholder="e.g., Night Punch-out Check"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />

                            <Select 
                                label="Trigger Type" 
                                value={formData.triggerType} 
                                onChange={e => setFormData({ ...formData, triggerType: e.target.value })}
                            >
                                {TRIGGER_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </Select>

                            <div className="p-4 bg-page/50 rounded-xl border border-dashed text-xs text-muted">
                                {TRIGGER_TYPES.find(t => t.value === formData.triggerType)?.description}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Check Time (24h)" 
                                    type="time"
                                    value={formData.config?.time}
                                    onChange={e => setFormData({ ...formData, config: { ...formData.config, time: e.target.value } })}
                                />
                                <Select 
                                    label="Frequency"
                                    value={formData.config?.frequency || 'daily'}
                                    onChange={e => setFormData({ ...formData, config: { ...formData.config, frequency: e.target.value as any } })}
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="yearly">Yearly</option>
                                </Select>
                            </div>

                            {formData.config?.frequency === 'weekly' && (
                                <Select 
                                    label="Day of Week"
                                    value={formData.config?.dayOfWeek || 1}
                                    onChange={e => setFormData({ ...formData, config: { ...formData.config, dayOfWeek: parseInt(e.target.value) } })}
                                >
                                    <option value={0}>Sunday</option>
                                    <option value={1}>Monday</option>
                                    <option value={2}>Tuesday</option>
                                    <option value={3}>Wednesday</option>
                                    <option value={4}>Thursday</option>
                                    <option value={5}>Friday</option>
                                    <option value={6}>Saturday</option>
                                </Select>
                            )}

                            {formData.config?.frequency === 'monthly' && (
                                <Input 
                                    label="Day of Month (1-31)"
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={formData.config?.dayOfMonth || 1}
                                    onChange={e => setFormData({ ...formData, config: { ...formData.config, dayOfMonth: parseInt(e.target.value) } })}
                                />
                            )}

                            <Input 
                                label="Duration Threshold (Minutes)"
                                type="number"
                                placeholder="Trigger if state lasts X minutes"
                                value={formData.config?.durationMinutes || ''}
                                onChange={e => setFormData({ ...formData, config: { ...formData.config, durationMinutes: parseInt(e.target.value) || 0 } })}
                                description="Optional: e.g. Trigger if employee late by 30 mins"
                            />

                            <div className="space-y-1">
                                <Select 
                                    label="Follow-up Rule (Chaining)"
                                    value={formData.config?.chainedRuleId || ''}
                                    onChange={e => setFormData({ ...formData, config: { ...formData.config, chainedRuleId: e.target.value } })}
                                >
                                    <option value="">No Follow-up</option>
                                    {rules.filter(r => r.id !== formData.id).map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </Select>
                                <p className="text-[10px] text-muted">Select a rule to execute AFTER this one</p>
                            </div>

                            <div className="pt-2">
                                <div className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${formData.config?.notifyManager ? 'bg-primary/5 border-primary/20' : 'bg-page border-border'}`}>
                                    <div className="pt-0.5">
                                        <Checkbox 
                                            id="ch-manager" 
                                            label=""
                                            checked={formData.config?.notifyManager || false} 
                                            onChange={e => setFormData({ ...formData, config: { ...formData.config, notifyManager: e.target.checked } })} 
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-primary-text">Also Notify Reporting Manager</span>
                                        <span className="text-xs text-muted mt-0.5">Send a copy of this alert (via SMS/Push) to the employee's direct manager.</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <p className="text-sm font-bold text-primary-text">Notification Channels</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${formData.enablePush ? 'bg-accent/5 border-accent/20' : 'bg-page border-border'}`}>
                                        <Checkbox 
                                            id="ch-push" 
                                            label=""
                                            checked={formData.enablePush} 
                                            onChange={e => setFormData({ ...formData, enablePush: e.target.checked })} 
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">Push</span>
                                            <Smartphone className="h-4 w-4 text-muted" />
                                        </div>
                                    </div>
                                    <div className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${formData.enableSms ? 'bg-amber-50 border-amber-200' : 'bg-page border-border'}`}>
                                        <Checkbox 
                                            id="ch-sms" 
                                            label=""
                                            checked={formData.enableSms} 
                                            onChange={e => setFormData({ ...formData, enableSms: e.target.checked })} 
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">SMS</span>
                                            <MessageSquare className="h-4 w-4 text-muted" />
                                        </div>
                                    </div>
                                </div>
                                {formData.enableSms && (
                                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                        <p className="text-[10px] text-amber-700 leading-tight">
                                           SMS delivery requires OneSignal credits and a configured provider.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <Button className="w-full h-11 shadow-lg" onClick={handleSave} isLoading={isSaving}>
                                {isEditing ? 'Update Rule' : 'Save Rule'}
                            </Button>
                        </div>
                    </section>

                    <section className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                         <div className="flex items-start gap-3">
                             <div className="p-2 bg-emerald-500 rounded-lg text-white">
                                 <Info className="h-5 w-5" />
                             </div>
                             <div className="space-y-1">
                                 <h4 className="font-bold text-emerald-900">Variables</h4>
                                 <p className="text-xs text-emerald-700 leading-relaxed">
                                     Use these tags in your templates: <br/>
                                     <code className="bg-white/50 px-1 rounded font-bold">{'{name}'}</code>, 
                                     <code className="bg-white/50 px-1 rounded font-bold">{'{site}'}</code>, 
                                     <code className="bg-white/50 px-1 rounded font-bold">{'{time}'}</code>
                                 </p>
                             </div>
                         </div>
                    </section>
                </div>

                {/* Templates & Rules List */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Template Editor */}
                    <section className="bg-card p-8 rounded-2xl border border-border shadow-sm">
                        <h3 className="text-xl font-bold mb-6 flex items-center">
                            <MessageSquare className="mr-3 h-6 w-6 text-accent" /> 
                            Content Templates
                        </h3>
                        
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                                <Input 
                                    label="Push Heading" 
                                    placeholder="Reminder: Action Required"
                                    value={formData.pushTitleTemplate}
                                    onChange={e => setFormData({ ...formData, pushTitleTemplate: e.target.value })}
                                />
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-primary-text">Push Message Body</p>
                                    <textarea 
                                        className="w-full h-24 p-4 rounded-xl border border-border focus:ring-2 focus:ring-accent focus:border-accent bg-page/30"
                                        value={formData.pushBodyTemplate}
                                        onChange={e => setFormData({ ...formData, pushBodyTemplate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2 opacity-80">
                                    <p className="text-sm font-bold text-primary-text flex items-center">
                                        <Smartphone className="h-4 w-4 mr-2" /> SMS Fallback Template
                                    </p>
                                    <textarea 
                                        className="w-full h-20 p-4 rounded-xl border border-border focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-amber-50/10"
                                        placeholder="Paradigm Services: Hi {name}..."
                                        value={formData.smsTemplate}
                                        onChange={e => setFormData({ ...formData, smsTemplate: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Active Rules List */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-primary-text">Configured Rules ({rules.length})</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {rules.map(rule => (
                                <div key={rule.id} className="bg-card p-5 rounded-2xl border border-border flex items-center justify-between hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl ${rule.isActive ? 'bg-accent/10 text-accent' : 'bg-muted/10 text-muted grayscale'}`}>
                                            <Bell className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-primary-text">{rule.name}</h4>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="flex items-center text-xs text-muted">
                                                    <Clock className="h-3 w-3 mr-1" /> {rule.config?.time}
                                                </span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-page font-bold text-muted uppercase tracking-wider">
                                                    {rule.triggerType.replace('_', ' ')}
                                                </span>
                                                {rule.config?.notifyManager && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase tracking-wider flex items-center">
                                                        <Users className="h-3 w-3 mr-1" /> Manager Notified
                                                    </span>
                                                )}
                                                <div className="flex gap-1">
                                                    {rule.enablePush && <Smartphone className="h-3 w-3 text-accent" />}
                                                    {rule.enableSms && <MessageSquare className="h-3 w-3 text-amber-600" />}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}>
                                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                        </Button>
                                        <Button variant="secondary" size="sm" className="text-red-600 hover:bg-red-50 hover:border-red-200" onClick={() => handleDelete(rule.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            {rules.length === 0 && (
                                <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border flex flex-col items-center">
                                    <div className="p-4 bg-page rounded-full mb-4">
                                        <Smartphone className="h-10 w-10 text-muted/30" />
                                    </div>
                                    <p className="text-muted font-medium">No automated rules set up yet.</p>
                                    <p className="text-xs text-muted/60 mt-1">Start by creating a rule for Missed Punch Outs.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default AdvancedNotificationSettings;
