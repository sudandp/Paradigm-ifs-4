import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Send,
  Plus,
  Search,
  Filter,
  BarChart3,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Building2,
  Trash2,
  Edit2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  MousePointerClick,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Smartphone,
  Monitor,
  Settings,
  FileText,
  History,
  TrendingUp,
  Target,
  ArrowLeft,
  X as CloseIcon,
  Check
} from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import LoadingScreen from '../../components/ui/LoadingScreen';
import MobileTopBar from '../../components/navigation/MobileTopBar';
import { useDevice } from '../../hooks/useDevice';
import { crmApi } from '../../services/crmApi';
import type { MarketingCampaign, CrmLead } from '../../types/crm';
import { LEAD_STATUS_ORDER } from '../../types/crm';
import { PARADIGM_MC_OUTREACH_TEMPLATE } from '../../data/marketingTemplate';

// Production-ready responsive email templates
const STARTER_TEMPLATES = [
  {
    name: 'Paradigm | Better Managed Communities (MC Outreach)',
    category: 'Residential FM',
    subject: 'Paradigm | Better Managed Communities - A Question for Your Management Committee',
    html: PARADIGM_MC_OUTREACH_TEMPLATE
  }
];

type MainTab = 'campaigns' | 'create' | 'templates' | 'audiences' | 'analytics';

const EmailMarketingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isMobile } = useDevice();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<MainTab>('campaigns');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);

  // Audience targeting mode & custom emails state
  const [audienceMode, setAudienceMode] = useState<'crm_leads' | 'manual_entry'>('crm_leads');
  const [customEmailsInput, setCustomEmailsInput] = useState<string>('');
  const [testEmailAddress, setTestEmailAddress] = useState<string>('sudhan@paradigmfms.com');
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);

  // Campaign Form State
  const [formData, setFormData] = useState<Partial<MarketingCampaign>>({
    name: '',
    subject: '',
    senderName: 'Paradigm Services',
    senderEmail: 'contact@paradigmfms.com',
    bodyHtml: STARTER_TEMPLATES[0].html,
    audienceFilter: {
      source: 'crm_leads',
      leadStatuses: ['New Lead', 'Contacted', 'Site Visit Planned']
    }
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [campaignList, leadList] = await Promise.all([
        crmApi.getCampaigns(),
        crmApi.getLeads()
      ]);
      setCampaigns(campaignList);
      setLeads(leadList);
    } catch (e: any) {
      console.error('Failed to load campaigns:', e);
      setToast({ message: 'Error loading campaign records', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.subject.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [campaigns, searchQuery, statusFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = campaigns.length;
    const sent = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
    const opened = campaigns.reduce((acc, c) => acc + (c.openedCount || 0), 0);
    const clicked = campaigns.reduce((acc, c) => acc + (c.clickedCount || 0), 0);
    const avgOpenRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
    const avgClickRate = opened > 0 ? Math.round((clicked / opened) * 100) : 0;

    return { total, sent, opened, clicked, avgOpenRate, avgClickRate };
  }, [campaigns]);

  // Audience matching count for CRM leads
  const matchingRecipients = useMemo(() => {
    return leads.filter(l => {
      const email = l.email || l.contactPersonEmail;
      if (!email || !email.includes('@')) return false;
      if (formData.audienceFilter?.leadStatuses?.length && !formData.audienceFilter.leadStatuses.includes(l.status)) {
        return false;
      }
      return true;
    });
  }, [leads, formData.audienceFilter]);

  // Parsed valid custom emails list
  const parsedCustomEmails = useMemo(() => {
    if (!customEmailsInput.trim()) return [];
    const tokens = customEmailsInput.split(/[\n,;\s]+/);
    const valid: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const token of tokens) {
      const clean = token.trim().toLowerCase();
      if (clean && emailRegex.test(clean) && !valid.includes(clean)) {
        valid.push(clean);
      }
    }
    return valid;
  }, [customEmailsInput]);

  const activeRecipientsCount = audienceMode === 'crm_leads'
    ? matchingRecipients.length
    : parsedCustomEmails.length;

  const handleSelectCampaign = (c: Partial<MarketingCampaign>) => {
    setFormData(c);
    const isManual = c.audienceFilter?.source === 'manual_entry' || Boolean(c.audienceFilter?.customEmails?.length);
    setAudienceMode(isManual ? 'manual_entry' : 'crm_leads');
    setCustomEmailsInput(c.audienceFilter?.customEmails?.join('\n') || '');
    setActiveTab('create');
  };

  const handleNewCampaign = (template = STARTER_TEMPLATES[0]) => {
    setFormData({
      name: '',
      subject: template.subject,
      senderName: 'Paradigm Services',
      senderEmail: 'contact@paradigmfms.com',
      bodyHtml: template.html,
      audienceFilter: {
        source: 'crm_leads',
        leadStatuses: ['New Lead', 'Contacted', 'Site Visit Planned']
      }
    });
    setAudienceMode('crm_leads');
    setCustomEmailsInput('');
    setActiveTab('create');
  };

  const handleSaveDraft = async () => {
    if (!formData.name?.trim() || !formData.subject?.trim()) {
      setToast({ message: 'Please provide both campaign name and subject line.', type: 'error' });
      return;
    }

    try {
      const updatedFilter = audienceMode === 'manual_entry'
        ? {
            source: 'manual_entry' as const,
            customEmails: parsedCustomEmails
          }
        : {
            source: 'crm_leads' as const,
            leadStatuses: formData.audienceFilter?.leadStatuses || ['New Lead', 'Contacted', 'Site Visit Planned']
          };

      await crmApi.saveCampaign({
        ...formData,
        audienceFilter: updatedFilter
      });
      setToast({ message: 'Campaign saved successfully!', type: 'success' });
      setActiveTab('campaigns');
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to save campaign', type: 'error' });
    }
  };

  const handleDispatch = async () => {
    if (!formData.name?.trim() || !formData.subject?.trim()) {
      setToast({ message: 'Please provide campaign name and subject before sending.', type: 'error' });
      return;
    }
    if (audienceMode === 'crm_leads' && !matchingRecipients.length) {
      setToast({ message: 'No recipients with valid email match the selected audience filter.', type: 'error' });
      return;
    }
    if (audienceMode === 'manual_entry' && !parsedCustomEmails.length) {
      setToast({ message: 'Please enter at least one valid target email address in the Target Emails box.', type: 'error' });
      return;
    }

    setIsDispatching(true);
    try {
      const updatedFilter = audienceMode === 'manual_entry'
        ? {
            source: 'manual_entry' as const,
            customEmails: parsedCustomEmails
          }
        : {
            source: 'crm_leads' as const,
            leadStatuses: formData.audienceFilter?.leadStatuses || ['New Lead']
          };

      const saved = await crmApi.saveCampaign({
        ...formData,
        audienceFilter: updatedFilter,
        status: 'sending'
      });

      const customRecipients = audienceMode === 'manual_entry'
        ? parsedCustomEmails.map(e => ({ email: e, name: e.split('@')[0] }))
        : undefined;

      await crmApi.dispatchCampaign(saved.id, customRecipients, saved);
      setToast({
        message: `🚀 Campaign launched to ${activeRecipientsCount} recipients!`,
        type: 'success'
      });
      setActiveTab('campaigns');
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || 'Dispatch failed', type: 'error' });
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSendTest = async () => {
    const trimmedEmail = testEmailAddress.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setToast({ message: 'Please enter a valid email address for testing.', type: 'error' });
      return;
    }

    setIsSendingTest(true);
    try {
      await crmApi.sendTestCampaignEmail(
        trimmedEmail,
        `[TEST] ${formData.subject || 'Paradigm Marketing Campaign'}`,
        formData.bodyHtml || ''
      );
      setToast({ message: `✅ Live test email sent to ${trimmedEmail}!`, type: 'success' });
      setShowTestModal(false);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to send test email', type: 'error' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await crmApi.deleteCampaign(id);
      setToast({ message: 'Campaign deleted', type: 'success' });
      loadData();
    } catch (e: any) {
      setToast({ message: e.message || 'Failed to delete', type: 'error' });
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading Campaign Studio..." />;
  }

  return (
    <div className={`w-full min-w-0 space-y-6 pb-24 ${isMobile ? 'px-3 pt-3' : 'px-1'}`}>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      <MobileTopBar title="EMAIL MARKETING" parentPath="/crm" />

      {/* Standard App Admin Header matching HRM / Notifications / Settings */}
      <AdminPageHeader title="Email Marketing & Campaigns">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setActiveTab('templates')}
            className="text-xs"
          >
            <FileText className="h-4 w-4 mr-1.5" /> Template Hub
          </Button>
          <Button
            variant="primary"
            onClick={() => handleNewCampaign()}
            className="text-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Campaign
          </Button>
        </div>
      </AdminPageHeader>

      {/* Top Navigation Tabs Bar */}
      <div className="border-b border-border overflow-x-auto no-scrollbar -mt-2 mb-6">
        <nav className="-mb-px flex space-x-2 sm:space-x-6 min-w-max pb-1 text-sm font-bold">
          {[
            { id: 'campaigns' as MainTab, label: 'All Campaigns', icon: BarChart3, count: campaigns.length },
            { id: 'create' as MainTab, label: 'Campaign Studio', icon: Edit2 },
            { id: 'templates' as MainTab, label: 'Templates & Layouts', icon: FileText, count: STARTER_TEMPLATES.length },
            { id: 'audiences' as MainTab, label: 'Lead Audiences', icon: Users, count: leads.length },
            { id: 'analytics' as MainTab, label: 'Delivery & Analytics', icon: TrendingUp }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-3 border-b-2 font-bold text-sm tracking-wide transition-colors ${
                  isActive
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-muted hover:text-primary-text hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-page text-muted'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* KPI Stats Cards Row (Full Width 4-Column Layout) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Total Sent</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Send className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-primary-text tracking-tight">{stats.sent.toLocaleString()}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{stats.total} total campaigns executed</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Avg Open Rate</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Eye className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-600 tracking-tight">{stats.avgOpenRate}%</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>{stats.opened} total opens tracked</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Click-Through Rate</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <MousePointerClick className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-purple-600 tracking-tight">{stats.avgClickRate}%</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            <span>{stats.clicked} link interactions</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Targetable Leads</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-primary-text tracking-tight">{leads.length}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>Live contacts in CRM pipeline</span>
          </div>
        </div>
      </div>

      {/* TAB 1: ALL CAMPAIGNS */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-sm">
            <div className="relative w-full sm:w-96">
              <Search className="h-4 w-4 absolute left-3.5 top-3 text-muted" />
              <input
                type="text"
                placeholder="Search campaigns by name or subject..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-page rounded-xl border border-border focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-muted">Filter:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs bg-page border border-border rounded-xl px-3 py-2 font-medium outline-none"
              >
                <option value="all">All Campaign Statuses</option>
                <option value="draft">Drafts</option>
                <option value="sending">Currently Sending</option>
                <option value="sent">Completed & Sent</option>
              </select>
            </div>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="bg-card p-16 text-center rounded-2xl border border-dashed border-border space-y-4 shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto text-emerald-600">
                <Mail className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-primary-text">No Marketing Campaigns Found</h3>
                <p className="text-xs text-muted max-w-md mx-auto">
                  Ready to reach prospective clients and property owners? Create and launch your first email campaign in minutes.
                </p>
              </div>
              <Button onClick={() => handleNewCampaign()} className="text-xs px-5 py-2.5">
                <Plus className="h-4 w-4 mr-1.5" /> Create First Campaign
              </Button>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-page/60 border-b border-border text-muted font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-4 pl-6">Campaign Name</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Target Audience</th>
                      <th className="p-4 text-center">Total Sent</th>
                      <th className="p-4 text-center">Open Rate</th>
                      <th className="p-4 text-center">Click Rate</th>
                      <th className="p-4">Last Updated</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCampaigns.map(c => {
                      const openPct = (c.sentCount || 0) > 0 ? Math.round(((c.openedCount || 0) / c.sentCount) * 100) : 0;
                      const clickPct = (c.openedCount || 0) > 0 ? Math.round(((c.clickedCount || 0) / c.openedCount) * 100) : 0;

                      return (
                        <tr key={c.id} className="hover:bg-page/40 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="font-bold text-sm text-primary-text">{c.name}</div>
                            <div className="text-xs text-muted line-clamp-1 mt-0.5">{c.subject}</div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              c.status === 'sent'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : c.status === 'sending'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="text-xs font-semibold text-primary-text">
                              {c.audienceFilter?.source === 'crm_leads' ? 'CRM Pipeline Leads' : 'Custom Contacts'}
                            </div>
                            <div className="text-[11px] text-muted">
                              {c.audienceFilter?.leadStatuses?.join(', ') || 'All Leads'}
                            </div>
                          </td>
                          <td className="p-4 text-center font-bold text-primary-text text-sm">
                            {c.sentCount || 0}
                          </td>
                          <td className="p-4 text-center">
                            <div className="font-black text-blue-600 text-sm">{openPct}%</div>
                            <div className="text-[10px] text-muted">{c.openedCount || 0} opened</div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="font-black text-purple-600 text-sm">{clickPct}%</div>
                            <div className="text-[10px] text-muted">{c.clickedCount || 0} clicks</div>
                          </td>
                          <td className="p-4 text-muted text-xs">
                            {new Date(c.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleSelectCampaign(c)}
                                className="p-2 hover:bg-page rounded-xl text-muted hover:text-primary-text transition-colors"
                                title="Edit / View"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(c.id)}
                                className="p-2 hover:bg-red-50 rounded-xl text-muted hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CAMPAIGN STUDIO (SPLIT BUILDER & LIVE PREVIEW) */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Form: Full Studio Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-6 bg-card p-6 md:p-8 rounded-3xl border border-border shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="font-bold text-lg text-primary-text flex items-center gap-2">
                  <Edit2 className="h-5 w-5 text-emerald-600" /> Campaign Configuration
                </h3>
                <p className="text-xs text-muted mt-0.5">Define subject, sender identity, target leads, and HTML body.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setActiveTab('campaigns')} className="text-xs">
                  Cancel
                </Button>
                <Button variant="secondary" onClick={handleSaveDraft} className="text-xs">
                  Save Draft
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowTestModal(true)}
                  className="text-xs border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800"
                >
                  <Mail className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Send Test Mail
                </Button>
                <Button
                  onClick={handleDispatch}
                  isLoading={isDispatching}
                  className="text-xs"
                  disabled={activeRecipientsCount === 0}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Dispatch to {activeRecipientsCount} {audienceMode === 'crm_leads' ? 'Leads' : 'Emails'}
                </Button>
              </div>
            </div>

            {/* Quick Template Picker */}
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                Choose Marketing Template Preset
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STARTER_TEMPLATES.map(t => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, bodyHtml: t.html, subject: t.subject })}
                    className="p-3.5 text-left rounded-2xl border border-border hover:border-emerald-500 hover:bg-emerald-50/20 transition-all text-xs group"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {t.category}
                    </span>
                    <div className="font-bold text-primary-text mt-2 group-hover:text-emerald-700">{t.name}</div>
                    <div className="text-[11px] text-muted mt-1 line-clamp-1">{t.subject}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Campaign Title (Internal Reference)"
                placeholder="e.g. November Facility Introduction"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
              <Input
                label="From Name"
                placeholder="Paradigm Services"
                value={formData.senderName || ''}
                onChange={e => setFormData({ ...formData, senderName: e.target.value })}
              />
            </div>

            <Input
              label="Email Subject Line"
              placeholder="e.g. Premium Facility Management Services for {{name}}"
              value={formData.subject || ''}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
              description="Personalize dynamically with {{name}}, {{firstName}}, or {{email}}"
            />

            {/* Audience Segment Selection */}
            <div className="bg-page/40 p-5 rounded-2xl border border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary-text uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-emerald-600" /> Target Audience Segment
                  </span>
                </div>

                {/* Segmented Mode Selector */}
                <div className="flex items-center bg-card p-1 rounded-xl border border-border shadow-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setAudienceMode('crm_leads');
                      setFormData({
                        ...formData,
                        audienceFilter: {
                          ...formData.audienceFilter,
                          source: 'crm_leads'
                        }
                      });
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      audienceMode === 'crm_leads'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-muted hover:text-primary-text'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>CRM Pipeline Leads</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      audienceMode === 'crm_leads' ? 'bg-white/20 text-white' : 'bg-page text-muted'
                    }`}>
                      {matchingRecipients.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAudienceMode('manual_entry');
                      setFormData({
                        ...formData,
                        audienceFilter: {
                          ...formData.audienceFilter,
                          source: 'manual_entry',
                          customEmails: parsedCustomEmails
                        }
                      });
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      audienceMode === 'manual_entry'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-muted hover:text-primary-text'
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Custom Target Emails</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      audienceMode === 'manual_entry' ? 'bg-white/20 text-white' : 'bg-page text-muted'
                    }`}>
                      {parsedCustomEmails.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Mode A: CRM Pipeline Stages */}
              {audienceMode === 'crm_leads' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted">
                      Select pipeline stages to automatically target prospective clients:
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {matchingRecipients.length} Matching Leads
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {LEAD_STATUS_ORDER.map(status => {
                      const isSelected = formData.audienceFilter?.leadStatuses?.includes(status);
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            const current = formData.audienceFilter?.leadStatuses || [];
                            const updated = isSelected ? current.filter(s => s !== status) : [...current, status];
                            setFormData({
                              ...formData,
                              audienceFilter: {
                                ...formData.audienceFilter,
                                source: 'crm_leads',
                                leadStatuses: updated
                              }
                            });
                          }}
                          className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                              : 'bg-card text-muted border-border hover:border-slate-300'
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Mode B: Direct / Custom Target Emails */
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-primary-text">
                        Enter or Paste Target Emails:
                      </div>
                      <div className="text-[11px] text-muted">
                        Paste single or multiple emails (separated by commas, semicolons, spaces, or new lines)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const testEmail = 'sudhan@paradigmfms.com';
                          if (!customEmailsInput.includes(testEmail)) {
                            const updated = customEmailsInput.trim() ? `${customEmailsInput.trim()}\n${testEmail}` : testEmail;
                            setCustomEmailsInput(updated);
                          }
                        }}
                        className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors"
                      >
                        + Add sudhan@paradigmfms.com
                      </button>
                      {customEmailsInput && (
                        <button
                          type="button"
                          onClick={() => setCustomEmailsInput('')}
                          className="text-[11px] text-muted hover:text-red-600 px-2 py-1 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={customEmailsInput}
                    onChange={e => {
                      setCustomEmailsInput(e.target.value);
                      const rawTokens = e.target.value.split(/[\n,;\s]+/);
                      const valid: string[] = [];
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      for (const token of rawTokens) {
                        const clean = token.trim().toLowerCase();
                        if (clean && emailRegex.test(clean) && !valid.includes(clean)) {
                          valid.push(clean);
                        }
                      }
                      setFormData({
                        ...formData,
                        audienceFilter: {
                          ...formData.audienceFilter,
                          source: 'manual_entry',
                          customEmails: valid
                        }
                      });
                    }}
                    placeholder="Enter target emails...&#10;e.g.&#10;sudhan@paradigmfms.com&#10;contact@client.com"
                    className="w-full p-3.5 text-xs font-mono bg-card rounded-xl border border-border focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none leading-relaxed transition-all"
                  />

                  {/* Valid Emails Preview Chips */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-bold text-muted">
                      Parsed Valid Target Emails:
                    </span>
                    <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${
                      parsedCustomEmails.length > 0
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-page text-muted'
                    }`}>
                      {parsedCustomEmails.length} Email{parsedCustomEmails.length === 1 ? '' : 's'} Ready
                    </span>
                  </div>

                  {parsedCustomEmails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-card rounded-xl border border-border/80">
                      {parsedCustomEmails.map(email => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                        >
                          <Mail className="h-3 w-3 text-emerald-600" />
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const remaining = parsedCustomEmails.filter(e => e !== email);
                              setCustomEmailsInput(remaining.join('\n'));
                            }}
                            className="ml-1 text-emerald-700 hover:text-red-600 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* HTML Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">
                  Email Body (HTML & Merge Tags)
                </label>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted text-[11px]">Insert:</span>
                  {['{{name}}', '{{firstName}}', '{{email}}'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFormData({ ...formData, bodyHtml: (formData.bodyHtml || '') + ' ' + tag })}
                      className="px-2 py-0.5 bg-page rounded-lg border border-border font-mono text-xs text-muted hover:text-primary-text hover:border-slate-300"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={14}
                value={formData.bodyHtml || ''}
                onChange={e => setFormData({ ...formData, bodyHtml: e.target.value })}
                className="w-full p-4 text-xs font-mono bg-page rounded-2xl border border-border focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none leading-relaxed transition-all"
                placeholder="Enter email HTML body..."
              />
            </div>
          </div>

          {/* Right Live Interactive Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex items-center justify-between">
              <span className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-emerald-600" /> Live Interactive Preview
              </span>
              <div className="flex items-center gap-1 bg-page p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    previewDevice === 'desktop' ? 'bg-card shadow-sm text-emerald-600' : 'text-muted hover:text-primary-text'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" /> Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    previewDevice === 'mobile' ? 'bg-card shadow-sm text-emerald-600' : 'text-muted hover:text-primary-text'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" /> Mobile
                </button>
              </div>
            </div>

            {/* Email Canvas Shell */}
            <div className={`mx-auto transition-all ${previewDevice === 'mobile' ? 'max-w-[360px]' : 'w-full'}`}>
              <div className="bg-white rounded-3xl border border-border shadow-lg overflow-hidden">
                {/* Simulated Email Client Bar */}
                <div className="bg-slate-100 p-4 border-b border-slate-200 text-xs space-y-1">
                  <div>
                    <span className="text-slate-400 font-semibold">From: </span>
                    <strong className="text-slate-700">{formData.senderName}</strong> &lt;{formData.senderEmail}&gt;
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Subject: </span>
                    <strong className="text-slate-800">
                      {(formData.subject || 'Preview Subject').replace(/{{name}}/gi, 'Sample Society')}
                    </strong>
                  </div>
                </div>

                {/* Rendered HTML */}
                <div
                  className="p-3 overflow-y-auto max-h-[640px] bg-white"
                  dangerouslySetInnerHTML={{
                    __html: (formData.bodyHtml || '')
                      .replace(/{{name}}/gi, 'Prestige Lake Towers')
                      .replace(/{{firstName}}/gi, 'Management Committee')
                      .replace(/{{email}}/gi, 'committee@prestige.com')
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TEMPLATES & LAYOUTS HUB */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" /> Pre-Designed Marketing Layouts ({STARTER_TEMPLATES.length})
              </h3>
              <p className="text-xs text-muted">Ready-to-send responsive email templates crafted for facility management pitches.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {STARTER_TEMPLATES.map(t => (
              <div key={t.name} className="bg-card p-6 rounded-3xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {t.category}
                    </span>
                    <span className="text-xs text-muted flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Responsive
                    </span>
                  </div>
                  <h4 className="font-bold text-base text-primary-text">{t.name}</h4>
                  <p className="text-xs text-muted font-medium">Subject: {t.subject}</p>
                </div>
                <div className="pt-6 border-t border-border mt-6 flex gap-3">
                  <Button
                    onClick={() => handleNewCampaign(t)}
                    className="w-full text-xs"
                  >
                    Use This Template
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LEAD AUDIENCES */}
      {activeTab === 'audiences' && (
        <div className="space-y-4">
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-primary-text flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" /> Targetable Contacts from CRM ({leads.length})
              </h3>
              <p className="text-xs text-muted">Leads with valid email addresses available for automated marketing campaigns.</p>
            </div>
            <Button onClick={() => navigate('/crm')} variant="secondary" className="text-xs">
              Go to CRM Pipeline <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-page/60 border-b border-border text-muted font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4 pl-6">Client / Society Name</th>
                  <th className="p-4">Contact Person</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6">City / Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map(l => (
                  <tr key={l.id} className="hover:bg-page/40 transition-colors">
                    <td className="p-4 pl-6 font-bold text-primary-text">{l.clientName}</td>
                    <td className="p-4 text-muted">{l.contactPerson || '—'}</td>
                    <td className="p-4 font-mono text-emerald-600">{l.email || l.contactPersonEmail || '—'}</td>
                    <td className="p-4 text-muted">{l.phone || '—'}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-page border border-border">
                        {l.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-muted">{l.city || l.location || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: DELIVERY & ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="bg-card p-8 rounded-3xl border border-border shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <h3 className="font-bold text-lg text-primary-text flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" /> Campaign Performance & Delivery Insights
              </h3>
              <p className="text-xs text-muted">Real-time open tracking and link click telemetry.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-page/50 border border-border">
              <h4 className="font-bold text-sm text-primary-text mb-2">1x1 Pixel Open Tracking</h4>
              <p className="text-xs text-muted leading-relaxed">
                Every dispatched email automatically injects a zero-cache 1x1 transparent tracking pixel. When recipients open the email, open counts are updated in real-time.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-page/50 border border-border">
              <h4 className="font-bold text-sm text-primary-text mb-2">Redirect Click Tracking</h4>
              <p className="text-xs text-muted leading-relaxed">
                All external links inside your email HTML are wrapped through your server's secure click redirect engine (`/api/track/click`), logging CTR metrics.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-page/50 border border-border">
              <h4 className="font-bold text-sm text-primary-text mb-2">Anti-Spam Pacing</h4>
              <p className="text-xs text-muted leading-relaxed">
                Outbound emails are paced with rate-limiting pauses and rotated across your active SMTP accounts to maintain high domain reputation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-primary-text">Send Live Test Email</h4>
                  <p className="text-xs text-muted">Test campaign appearance in your actual inbox</p>
                </div>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-1.5 rounded-xl text-muted hover:text-primary-text hover:bg-page transition-colors"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                  Recipient Test Email Address
                </label>
                <Input
                  placeholder="sudhan@paradigmfms.com"
                  value={testEmailAddress}
                  onChange={e => setTestEmailAddress(e.target.value)}
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-page text-xs text-muted space-y-1.5 border border-border/60">
                <div className="font-bold text-primary-text">Subject Line:</div>
                <div className="font-mono text-[11px] text-primary-text truncate">
                  [TEST] {formData.subject || 'Paradigm Marketing Campaign'}
                </div>
                <div className="text-[11px] text-muted pt-1 border-t border-border/40">
                  ⚡ Sent via production SMTP with high-res Supabase Storage CDN assets.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowTestModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button onClick={handleSendTest} isLoading={isSendingTest} className="text-xs">
                <Send className="h-3.5 w-3.5 mr-1.5" /> Send Test Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailMarketingDashboard;
