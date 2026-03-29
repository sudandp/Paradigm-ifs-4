import React, { useState, useEffect } from 'react';
import {
    Mail,
    Settings,
    Send,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Plus,
    Trash2,
    Pencil,
    X as CloseIcon,
    Eye,
    FileText,
    Users,
    Calendar,
    Zap,
    Shield,
    RefreshCw,
    ExternalLink,
    Server,
    Save,
    TestTube,
    History
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import Checkbox from '../../components/ui/Checkbox';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { api } from '../../services/api';
import type { EmailConfig, EmailTemplate, EmailScheduleRule, EmailLog, Role, User } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';

type SubTab = 'config' | 'templates' | 'schedules' | 'logs';

const EmailConfigPanel: React.FC = () => {
    const { user } = useAuthStore();
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('config');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Data
    const [emailConfig, setEmailConfig] = useState<EmailConfig>({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        fromEmail: '',
        fromName: 'Paradigm FMS',
        replyTo: '',
        enabled: false,
    });
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [scheduleRules, setScheduleRules] = useState<EmailScheduleRule[]>([]);
    const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    // Form states
    const [testEmail, setTestEmail] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Partial<EmailScheduleRule> | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const [config, tmpl, rules, logs, r, u] = await Promise.all([
                api.getEmailConfig(),
                api.getEmailTemplates(),
                api.getEmailScheduleRules(),
                api.getEmailLogs(),
                api.getRoles(),
                api.getUsers(),
            ]);
            if (config) setEmailConfig(config);
            setTemplates(tmpl);
            setScheduleRules(rules);
            setEmailLogs(logs);
            setRoles(r);
            setUsers(u.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        } catch (err) {
            console.error('Failed to load email data:', err);
            setToast({ message: 'Failed to load email configuration.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // ── CONFIG TAB ──
    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            await api.saveEmailConfig(emailConfig);
            setToast({ message: 'Email configuration saved!', type: 'success' });
        } catch (err: any) {
            setToast({ message: `Failed to save: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestEmail = async () => {
        if (!testEmail) {
            setToast({ message: 'Please enter a test email address.', type: 'error' });
            return;
        }
        setIsTesting(true);
        try {
            await api.sendTestEmail(testEmail);
            setToast({ message: `Test email sent to ${testEmail}!`, type: 'success' });
        } catch (err: any) {
            setToast({ message: `Test failed: ${err.message}`, type: 'error' });
        } finally {
            setIsTesting(false);
        }
    };

    // ── TEMPLATE TAB ──
    const handleSaveTemplate = async () => {
        if (!editingTemplate?.name || !editingTemplate?.subjectTemplate) {
            setToast({ message: 'Template name and subject are required.', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            const saved = await api.saveEmailTemplate(editingTemplate);
            if (editingTemplate.id) {
                setTemplates(templates.map(t => t.id === saved.id ? saved : t));
            } else {
                setTemplates([saved, ...templates]);
            }
            setEditingTemplate(null);
            setShowTemplateForm(false);
            setToast({ message: 'Template saved!', type: 'success' });
        } catch (err: any) {
            setToast({ message: `Failed to save template: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Delete this template?')) return;
        try {
            await api.deleteEmailTemplate(id);
            setTemplates(templates.filter(t => t.id !== id));
            setToast({ message: 'Template deleted.', type: 'success' });
        } catch (err: any) {
            setToast({ message: `Failed: ${err.message}`, type: 'error' });
        }
    };

    // ── SCHEDULE TAB ──
    const handleSaveSchedule = async () => {
        if (!editingSchedule?.name) {
            setToast({ message: 'Rule name is required.', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            const saved = await api.saveEmailScheduleRule(editingSchedule);
            if (editingSchedule.id) {
                setScheduleRules(scheduleRules.map(r => r.id === saved.id ? saved : r));
            } else {
                setScheduleRules([saved, ...scheduleRules]);
            }
            setEditingSchedule(null);
            setShowScheduleForm(false);
            setToast({ message: 'Schedule rule saved!', type: 'success' });
        } catch (err: any) {
            setToast({ message: `Failed: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSchedule = async (id: string) => {
        if (!confirm('Delete this schedule rule?')) return;
        try {
            await api.deleteEmailScheduleRule(id);
            setScheduleRules(scheduleRules.filter(r => r.id !== id));
            setToast({ message: 'Schedule deleted.', type: 'success' });
        } catch (err: any) {
            setToast({ message: `Failed: ${err.message}`, type: 'error' });
        }
    };

    const handleTestSchedule = async (id: string) => {
        setToast({ message: 'Sending test email...', type: 'success' });
        try {
            await api.testEmailScheduleRule(id);
            setToast({ message: 'Test email sent!', type: 'success' });
            // Refresh logs
            const logs = await api.getEmailLogs();
            setEmailLogs(logs);
        } catch (err: any) {
            setToast({ message: `Test failed: ${err.message}`, type: 'error' });
        }
    };

    if (isLoading) return <LoadingScreen message="Loading email configuration..." />;

    const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
        report: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
        alert: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
        greeting: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
        document_expiry: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Preview Modal */}
            {previewHtml && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewHtml(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h3 className="font-bold text-primary-text">Email Preview</h3>
                            <button onClick={() => setPreviewHtml(null)} className="p-1 hover:bg-slate-100 rounded-lg"><CloseIcon className="h-5 w-5" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[70vh]">
                            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-tabs */}
            <div className="flex p-1 bg-slate-100/50 rounded-xl border border-slate-200/50">
                {([
                    { id: 'config' as SubTab, label: 'Configuration', icon: Settings },
                    { id: 'templates' as SubTab, label: 'Templates', icon: FileText },
                    { id: 'schedules' as SubTab, label: 'Schedules', icon: Calendar },
                    { id: 'logs' as SubTab, label: 'Delivery Logs', icon: History },
                ]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`flex items-center px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${activeSubTab === tab.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <tab.icon className="mr-2 h-3.5 w-3.5" /> {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════ CONFIG TAB ═══════════════ */}
            {activeSubTab === 'config' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <section className="bg-card p-8 rounded-2xl border border-border shadow-sm">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg">
                                <Server className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">SMTP Configuration</h3>
                                <p className="text-muted text-sm">Configure your Google Workspace email settings.</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="SMTP Host"
                                    value={emailConfig.host}
                                    onChange={e => setEmailConfig({ ...emailConfig, host: e.target.value })}
                                    placeholder="smtp.gmail.com"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        label="Port"
                                        type="number"
                                        value={emailConfig.port}
                                        onChange={e => setEmailConfig({ ...emailConfig, port: parseInt(e.target.value) || 587 })}
                                    />
                                    <div className="pt-6">
                                        <Checkbox
                                            id="smtp-secure"
                                            label="SSL/TLS"
                                            checked={emailConfig.secure}
                                            onChange={e => setEmailConfig({ ...emailConfig, secure: e.target.checked })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Input
                                label="Email Address (Username)"
                                value={emailConfig.user}
                                onChange={e => setEmailConfig({ ...emailConfig, user: e.target.value, fromEmail: e.target.value })}
                                placeholder="sudhan@paradigmfms.com"
                            />

                            <Input
                                label="App Password"
                                type="password"
                                value={emailConfig.pass}
                                onChange={e => setEmailConfig({ ...emailConfig, pass: e.target.value })}
                                placeholder="Google App Password (16 chars)"
                                description="Generate at myaccount.google.com/apppasswords"
                            />

                            <Input
                                label="Display Name"
                                value={emailConfig.fromName}
                                onChange={e => setEmailConfig({ ...emailConfig, fromName: e.target.value })}
                                placeholder="Paradigm FMS"
                            />

                            <Input
                                label="Reply-To Email (optional)"
                                value={emailConfig.replyTo || ''}
                                onChange={e => setEmailConfig({ ...emailConfig, replyTo: e.target.value })}
                                placeholder="support@paradigmfms.com"
                            />

                            <div className={`p-4 rounded-xl border flex items-start gap-3 ${emailConfig.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-page border-border'}`}>
                                <Checkbox
                                    id="email-enabled"
                                    label=""
                                    checked={emailConfig.enabled}
                                    onChange={e => setEmailConfig({ ...emailConfig, enabled: e.target.checked })}
                                />
                                <div>
                                    <span className="text-sm font-bold">Enable Email Sending</span>
                                    <p className="text-xs text-muted mt-0.5">When enabled, the system can send emails for notifications, reports, and automated alerts.</p>
                                </div>
                            </div>

                            <Button className="w-full h-11" onClick={handleSaveConfig} isLoading={isSaving}>
                                <Save className="mr-2 h-4 w-4" /> Save Configuration
                            </Button>
                        </div>
                    </section>

                    <div className="space-y-6">
                        {/* Test Email */}
                        <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                            <h4 className="font-bold text-primary-text mb-4 flex items-center gap-2">
                                <Send className="h-4 w-4 text-accent" /> Send Test Email
                            </h4>
                            <div className="flex gap-3">
                                <Input
                                    className="flex-1"
                                    placeholder="recipient@example.com"
                                    value={testEmail}
                                    onChange={e => setTestEmail(e.target.value)}
                                />
                                <Button onClick={handleTestEmail} isLoading={isTesting} className="shrink-0">
                                    Send Test
                                </Button>
                            </div>
                            <p className="text-xs text-muted mt-3">Sends a test email using current config to verify everything works.</p>
                        </section>

                        {/* Quick Stats */}
                        <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                            <h4 className="font-bold text-primary-text mb-4 flex items-center gap-2">
                                <Mail className="h-4 w-4 text-accent" /> Email Overview
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-emerald-50 rounded-xl text-center border border-emerald-100">
                                    <div className="text-2xl font-black text-emerald-600">{emailLogs.filter(l => l.status === 'sent').length}</div>
                                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Emails Sent</div>
                                </div>
                                <div className="p-4 bg-red-50 rounded-xl text-center border border-red-100">
                                    <div className="text-2xl font-black text-red-600">{emailLogs.filter(l => l.status === 'failed').length}</div>
                                    <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Failed</div>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-xl text-center border border-blue-100">
                                    <div className="text-2xl font-black text-blue-600">{templates.length}</div>
                                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Templates</div>
                                </div>
                                <div className="p-4 bg-violet-50 rounded-xl text-center border border-violet-100">
                                    <div className="text-2xl font-black text-violet-600">{scheduleRules.filter(r => r.isActive).length}</div>
                                    <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Active Schedules</div>
                                </div>
                            </div>
                        </section>

                        {/* Connection Status */}
                        <div className={`p-4 rounded-xl border flex items-center gap-3 ${emailConfig.enabled && emailConfig.user ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            {emailConfig.enabled && emailConfig.user ? (
                                <>
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                    <div>
                                        <span className="text-sm font-bold text-emerald-800">SMTP Configured</span>
                                        <p className="text-xs text-emerald-600">Sending as <strong>{emailConfig.fromName}</strong> &lt;{emailConfig.fromEmail || emailConfig.user}&gt;</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                                    <div>
                                        <span className="text-sm font-bold text-amber-800">Email Not Configured</span>
                                        <p className="text-xs text-amber-600">Fill in the SMTP settings and enable email sending to get started.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ TEMPLATES TAB ═══════════════ */}
            {activeSubTab === 'templates' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted" /> Email Templates ({templates.length})
                        </h3>
                        <Button onClick={() => {
                            setEditingTemplate({
                                name: '',
                                subjectTemplate: '',
                                bodyTemplate: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">\n  <h2>{subject}</h2>\n  <p>{message}</p>\n</div>',
                                category: 'alert',
                                variables: [],
                                isActive: true,
                            });
                            setShowTemplateForm(true);
                        }}>
                            <Plus className="h-4 w-4 mr-2" /> New Template
                        </Button>
                    </div>

                    {/* Template Form */}
                    {showTemplateForm && editingTemplate && (
                        <div className="bg-card p-6 rounded-2xl border border-accent/20 ring-1 ring-accent/10 space-y-5 animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold flex items-center gap-2">
                                    <Pencil className="h-4 w-4 text-accent" />
                                    {editingTemplate.id ? 'Edit Template' : 'New Template'}
                                </h4>
                                <button onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); }} className="p-1 hover:bg-slate-100 rounded-lg">
                                    <CloseIcon className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Template Name"
                                    value={editingTemplate.name || ''}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                    placeholder="e.g. Daily Attendance Report"
                                />
                                <Select
                                    label="Category"
                                    value={editingTemplate.category || 'alert'}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, category: e.target.value as any })}
                                >
                                    <option value="report">📊 Report</option>
                                    <option value="alert">🔔 Alert</option>
                                    <option value="greeting">👋 Greeting</option>
                                    <option value="document_expiry">⚠️ Document Expiry</option>
                                </Select>
                            </div>

                            <Input
                                label="Subject Template"
                                value={editingTemplate.subjectTemplate || ''}
                                onChange={e => setEditingTemplate({ ...editingTemplate, subjectTemplate: e.target.value })}
                                placeholder="Daily Attendance Report — {date}"
                                description="Use {variables} for dynamic content"
                            />

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-primary-text">Custom Greeting Message (Optional)</label>
                                <textarea
                                    className="w-full h-24 p-3 rounded-xl border border-border focus:ring-2 focus:ring-accent bg-page/30 text-sm"
                                    value={editingTemplate.variables?.find((v: any) => v.key === '_custom_message')?.description || ''}
                                    onChange={e => {
                                        const vars = [...(editingTemplate.variables || [])];
                                        const idx = vars.findIndex(v => v.key === '_custom_message');
                                        if (idx >= 0) vars[idx].description = e.target.value;
                                        else vars.push({ key: '_custom_message', description: e.target.value });
                                        setEditingTemplate({ ...editingTemplate, variables: vars });
                                    }}
                                    placeholder="Enter a creative and energetic greeting message here!"
                                />
                                <p className="text-[11px] text-muted-foreground">This message naturally replaces the default introductory text at the top of the email.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-primary-text">HTML Body Template</label>
                                <textarea
                                    className="w-full h-48 p-4 rounded-xl border border-border focus:ring-2 focus:ring-accent bg-page/30 font-mono text-xs"
                                    value={editingTemplate.bodyTemplate || ''}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, bodyTemplate: e.target.value })}
                                    placeholder="<div>Your HTML email content here...</div>"
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setPreviewHtml(editingTemplate.bodyTemplate || '')}
                                >
                                    <Eye className="h-3 w-3 mr-1" /> Preview
                                </Button>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button onClick={handleSaveTemplate} isLoading={isSaving} className="flex-1">
                                    <Save className="h-4 w-4 mr-2" /> {editingTemplate.id ? 'Update' : 'Create'} Template
                                </Button>
                                <Button variant="secondary" onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); }}>Cancel</Button>
                            </div>
                        </div>
                    )}

                    {/* Templates Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {templates.map(tmpl => {
                            const catColor = CATEGORY_COLORS[tmpl.category] || CATEGORY_COLORS.alert;
                            return (
                                <div key={tmpl.id} className={`bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all ${!tmpl.isActive ? 'opacity-50' : ''}`}>
                                    <div className="flex items-start justify-between mb-3">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${catColor.bg} ${catColor.text} ${catColor.border} border`}>
                                            {tmpl.category.replace('_', ' ')}
                                        </span>
                                        <div className="flex gap-1">
                                            <button onClick={() => setPreviewHtml(tmpl.bodyTemplate)} className="p-1.5 hover:bg-slate-100 rounded-lg text-muted" title="Preview">
                                                <Eye className="h-3.5 w-3.5" />
                                            </button>
                                            <button onClick={() => { setEditingTemplate(tmpl); setShowTemplateForm(true); }} className="p-1.5 hover:bg-accent/10 rounded-lg text-accent" title="Edit">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button onClick={() => handleDeleteTemplate(tmpl.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Delete">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-primary-text mb-1 line-clamp-1">{tmpl.name}</h4>
                                    <p className="text-xs text-muted mb-3 line-clamp-1">{tmpl.subjectTemplate}</p>
                                    {tmpl.variables && tmpl.variables.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {tmpl.variables.slice(0, 4).map(v => (
                                                <span key={v.key} className="text-[9px] px-1.5 py-0.5 bg-page rounded font-mono text-muted">{`{${v.key}}`}</span>
                                            ))}
                                            {tmpl.variables.length > 4 && <span className="text-[9px] text-muted">+{tmpl.variables.length - 4}</span>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {templates.length === 0 && (
                            <div className="col-span-full text-center py-16 bg-card rounded-2xl border border-dashed border-border">
                                <FileText className="h-10 w-10 text-muted/20 mx-auto mb-3" />
                                <p className="text-muted font-medium">No email templates configured yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════ SCHEDULES TAB ═══════════════ */}
            {activeSubTab === 'schedules' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-muted" /> Email Schedules ({scheduleRules.length})
                        </h3>
                        <Button onClick={() => {
                            setEditingSchedule({
                                name: '',
                                templateId: templates[0]?.id || '',
                                triggerType: 'scheduled',
                                scheduleConfig: { time: '21:00', frequency: 'daily' },
                                reportType: 'attendance_daily',
                                reportFormat: 'html',
                                recipientType: 'role',
                                recipientRoles: [],
                                recipientUserIds: [],
                                recipientEmails: [],
                                isActive: true,
                            });
                            setShowScheduleForm(true);
                        }}>
                            <Plus className="h-4 w-4 mr-2" /> New Schedule
                        </Button>
                    </div>

                    {/* Schedule Form */}
                    {showScheduleForm && editingSchedule && (
                        <div className="bg-card p-6 rounded-2xl border border-accent/20 ring-1 ring-accent/10 space-y-5 animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-accent" />
                                    {editingSchedule.id ? 'Edit Schedule Rule' : 'New Schedule Rule'}
                                </h4>
                                <button onClick={() => { setShowScheduleForm(false); setEditingSchedule(null); }} className="p-1 hover:bg-slate-100 rounded-lg">
                                    <CloseIcon className="h-4 w-4" />
                                </button>
                            </div>

                            <Input
                                label="Rule Name"
                                value={editingSchedule.name || ''}
                                onChange={e => setEditingSchedule({ ...editingSchedule, name: e.target.value })}
                                placeholder="e.g. Daily Attendance to Management"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Select
                                    label="Trigger Type"
                                    value={editingSchedule.triggerType || 'scheduled'}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, triggerType: e.target.value as any })}
                                >
                                    <option value="scheduled">🗓️ Scheduled (Time-based)</option>
                                    <option value="event">⚡ Event-based</option>
                                    <option value="document_expiry">⚠️ Document Expiry</option>
                                </Select>

                                <Select
                                    label="Email Template"
                                    value={editingSchedule.templateId || ''}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, templateId: e.target.value })}
                                >
                                    <option value="">Select template...</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </Select>

                                <Select
                                    label="Report Type"
                                    value={editingSchedule.reportType || ''}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, reportType: e.target.value })}
                                >
                                    <option value="">No report data</option>
                                    <option value="attendance_daily">📊 Daily Attendance Report</option>
                                    <option value="attendance_monthly">📈 Monthly Attendance Summary</option>
                                    <option value="leave_summary">🌴 Leave Summary</option>
                                    <option value="invoice_summary">💰 Invoice Summary</option>
                                </Select>
                            </div>

                            {/* Schedule Config */}
                            {editingSchedule.triggerType === 'scheduled' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-page/50 rounded-xl border border-dashed border-border">
                                    <Input
                                        label="Send Time (24h)"
                                        type="time"
                                        value={editingSchedule.scheduleConfig?.time || '21:00'}
                                        onChange={e => setEditingSchedule({
                                            ...editingSchedule,
                                            scheduleConfig: { ...editingSchedule.scheduleConfig!, time: e.target.value }
                                        })}
                                    />
                                    <Select
                                        label="Frequency"
                                        value={editingSchedule.scheduleConfig?.frequency || 'daily'}
                                        onChange={e => setEditingSchedule({
                                            ...editingSchedule,
                                            scheduleConfig: { ...editingSchedule.scheduleConfig!, frequency: e.target.value as any }
                                        })}
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </Select>
                                    {editingSchedule.scheduleConfig?.frequency === 'weekly' && (
                                        <Select
                                            label="Day of Week"
                                            value={editingSchedule.scheduleConfig?.dayOfWeek ?? 1}
                                            onChange={e => setEditingSchedule({
                                                ...editingSchedule,
                                                scheduleConfig: { ...editingSchedule.scheduleConfig!, dayOfWeek: parseInt(e.target.value) }
                                            })}
                                        >
                                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                                                <option key={i} value={i}>{d}</option>
                                            ))}
                                        </Select>
                                    )}
                                    {editingSchedule.scheduleConfig?.frequency === 'monthly' && (
                                        <Input
                                            label="Day of Month"
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={editingSchedule.scheduleConfig?.dayOfMonth || 1}
                                            onChange={e => setEditingSchedule({
                                                ...editingSchedule,
                                                scheduleConfig: { ...editingSchedule.scheduleConfig!, dayOfMonth: parseInt(e.target.value) }
                                            })}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Event Type */}
                            {editingSchedule.triggerType === 'event' && (
                                <Select
                                    label="When this event occurs..."
                                    value={editingSchedule.eventType || ''}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, eventType: e.target.value })}
                                >
                                    <option value="">Select event...</option>
                                    <option value="leave_approved">Leave Approved</option>
                                    <option value="leave_rejected">Leave Rejected</option>
                                    <option value="task_assigned">Task Assigned</option>
                                    <option value="task_completed">Task Completed</option>
                                    <option value="onboarding_submitted">New Enrollment</option>
                                    <option value="billing_invoice">Invoice Generated</option>
                                </Select>
                            )}

                            {/* Document Expiry Config */}
                            {editingSchedule.triggerType === 'document_expiry' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
                                    <Select
                                        label="Document Source"
                                        value={editingSchedule.expiryConfig?.table || 'entities'}
                                        onChange={e => setEditingSchedule({
                                            ...editingSchedule,
                                            expiryConfig: { ...editingSchedule.expiryConfig!, table: e.target.value }
                                        })}
                                    >
                                        <option value="entities">Entity Documents</option>
                                        <option value="insurances">Insurance Policies</option>
                                        <option value="policies">Company Policies</option>
                                    </Select>
                                    <Select
                                        label="Date Field"
                                        value={editingSchedule.expiryConfig?.field || 'psara_valid_till'}
                                        onChange={e => setEditingSchedule({
                                            ...editingSchedule,
                                            expiryConfig: { ...editingSchedule.expiryConfig!, field: e.target.value }
                                        })}
                                    >
                                        <option value="psara_valid_till">PSARA Validity</option>
                                        <option value="valid_till">Insurance Validity</option>
                                        <option value="shop_establishment_valid_till">Shop & Est. Validity</option>
                                    </Select>
                                    <Input
                                        label="Days Before Expiry"
                                        type="number"
                                        min={1}
                                        value={editingSchedule.expiryConfig?.daysBefore || 30}
                                        onChange={e => setEditingSchedule({
                                            ...editingSchedule,
                                            expiryConfig: { ...editingSchedule.expiryConfig!, daysBefore: parseInt(e.target.value) }
                                        })}
                                        description="Alert X days before expiry"
                                    />
                                </div>
                            )}

                            {/* Recipients */}
                            <div className="space-y-4">
                                <p className="text-sm font-bold text-primary-text">Recipients</p>
                                <Select
                                    label="Recipient Type"
                                    value={editingSchedule.recipientType || 'role'}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, recipientType: e.target.value as any })}
                                >
                                    <option value="role">By Role</option>
                                    <option value="users">Specific Users</option>
                                    <option value="custom_emails">Custom Email Addresses</option>
                                </Select>

                                {editingSchedule.recipientType === 'role' && (
                                    <div className="flex flex-wrap gap-2 p-3 border border-border rounded-xl bg-page/50">
                                        {roles.map(role => (
                                            <label key={role.id} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-border hover:border-accent/30 cursor-pointer text-xs font-medium">
                                                <input
                                                    type="checkbox"
                                                    checked={(editingSchedule.recipientRoles || []).includes(role.id)}
                                                    onChange={e => {
                                                        const current = editingSchedule.recipientRoles || [];
                                                        setEditingSchedule({
                                                            ...editingSchedule,
                                                            recipientRoles: e.target.checked ? [...current, role.id] : current.filter(r => r !== role.id)
                                                        });
                                                    }}
                                                    className="rounded"
                                                />
                                                {role.displayName}
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {editingSchedule.recipientType === 'users' && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 border border-border rounded-xl bg-page/50">
                                        {users.map(u => (
                                            <Checkbox
                                                key={u.id}
                                                label={u.name}
                                                labelClassName="text-xs truncate"
                                                className="hover:bg-white rounded-lg transition-colors p-1"
                                                checked={(editingSchedule.recipientUserIds || []).includes(u.id)}
                                                onChange={e => {
                                                    const current = editingSchedule.recipientUserIds || [];
                                                    setEditingSchedule({
                                                        ...editingSchedule,
                                                        recipientUserIds: e.target.checked ? [...current, u.id] : current.filter(id => id !== u.id)
                                                    });
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {editingSchedule.recipientType === 'custom_emails' && (
                                    <div className="space-y-2">
                                        <Input
                                            label="Email Addresses (comma-separated)"
                                            value={(editingSchedule.recipientEmails || []).join(', ')}
                                            onChange={e => setEditingSchedule({
                                                ...editingSchedule,
                                                recipientEmails: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                            })}
                                            placeholder="ceo@company.com, hr@company.com"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button onClick={handleSaveSchedule} isLoading={isSaving} className="flex-1">
                                    <Save className="h-4 w-4 mr-2" /> {editingSchedule.id ? 'Update' : 'Create'} Schedule
                                </Button>
                                <Button variant="secondary" onClick={() => { setShowScheduleForm(false); setEditingSchedule(null); }}>Cancel</Button>
                            </div>
                        </div>
                    )}

                    {/* Schedule Rules List */}
                    <div className="space-y-4">
                        {scheduleRules.map(rule => {
                            const templateName = templates.find(t => t.id === rule.templateId)?.name || 'No template';
                            return (
                                <div key={rule.id} className={`bg-card p-5 rounded-2xl border transition-all ${rule.isActive ? 'border-border' : 'border-dashed opacity-60'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-2xl ${rule.isActive ? 'bg-accent/10 text-accent' : 'bg-muted/10 text-muted'}`}>
                                                {rule.triggerType === 'scheduled' ? <Clock className="h-5 w-5" /> :
                                                    rule.triggerType === 'event' ? <Zap className="h-5 w-5" /> :
                                                        <Shield className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-primary-text">{rule.name}</h4>
                                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold uppercase">
                                                        {rule.triggerType === 'scheduled' ? `${rule.scheduleConfig?.frequency || 'daily'} @ ${rule.scheduleConfig?.time}` :
                                                            rule.triggerType === 'event' ? `On: ${rule.eventType}` : 'Expiry Check'}
                                                    </span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-page text-muted font-bold">
                                                        📧 {templateName}
                                                    </span>
                                                    {rule.reportType && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-bold uppercase">
                                                            📊 {rule.reportType?.replace('_', ' ')}
                                                        </span>
                                                    )}
                                                    {rule.lastSentAt && (
                                                        <span className="text-[10px] text-muted">
                                                            Last sent: {format(new Date(rule.lastSentAt), 'MMM d, h:mm a')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleTestSchedule(rule.id)}
                                                className="text-xs font-bold"
                                                title="Send test email now"
                                            >
                                                TEST
                                            </Button>
                                            <button onClick={() => { setEditingSchedule(rule); setShowScheduleForm(true); }} className="p-2 hover:bg-accent/10 rounded-full text-accent">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <Checkbox
                                                id={`sch-active-${rule.id}`}
                                                label=""
                                                checked={rule.isActive}
                                                onChange={async (e) => {
                                                    try {
                                                        const updated = await api.saveEmailScheduleRule({ ...rule, isActive: e.target.checked });
                                                        setScheduleRules(scheduleRules.map(r => r.id === rule.id ? updated : r));
                                                    } catch (err) {
                                                        setToast({ message: 'Failed to toggle.', type: 'error' });
                                                    }
                                                }}
                                            />
                                            <button onClick={() => handleDeleteSchedule(rule.id)} className="p-2 hover:bg-red-50 rounded-full text-red-500">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {scheduleRules.length === 0 && (
                            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
                                <Calendar className="h-10 w-10 text-muted/20 mx-auto mb-3" />
                                <p className="text-muted font-medium">No email schedules configured yet.</p>
                                <p className="text-xs text-muted/60 mt-1">Create a schedule to automate daily reports, expiry alerts, and more.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════ LOGS TAB ═══════════════ */}
            {activeSubTab === 'logs' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <History className="h-5 w-5 text-muted" /> Delivery Logs ({emailLogs.length})
                        </h3>
                        <Button variant="secondary" size="sm" onClick={async () => {
                            const logs = await api.getEmailLogs();
                            setEmailLogs(logs);
                            setToast({ message: 'Logs refreshed.', type: 'success' });
                        }}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                        </Button>
                    </div>

                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-3">Status</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-3">Recipient</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-3">Subject</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-3">Sent At</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted px-4 py-3">Error</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {emailLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-12 text-center text-muted">
                                                <Mail className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                                No emails sent yet.
                                            </td>
                                        </tr>
                                    ) : emailLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                {log.status === 'sent' ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                                                        <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                                                        <AlertTriangle className="h-3.5 w-3.5" /> Failed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-primary-text font-medium">{log.recipientEmail}</td>
                                            <td className="px-4 py-3 text-sm text-muted max-w-[200px] truncate">{log.subject}</td>
                                            <td className="px-4 py-3 text-xs text-muted">{format(new Date(log.createdAt), 'MMM d, h:mm a')}</td>
                                            <td className="px-4 py-3 text-xs text-red-500 max-w-[180px] truncate">{log.errorMessage || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailConfigPanel;
