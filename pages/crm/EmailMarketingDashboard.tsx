import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
import { supabase } from '../../services/supabase';
import type { MarketingCampaign, CrmLead } from '../../types/crm';
import { LEAD_STATUS_ORDER } from '../../types/crm';
import { PARADIGM_MC_OUTREACH_TEMPLATE } from '../../data/marketingTemplate';
import {
  buildMarketingHtml,
  DEFAULT_TEMPLATE_CONTENT,
  type MarketingTemplateContent
} from '../../data/templateBuilder';

export interface StarterTemplate {
  id: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  subject: string;
  html: string;
  badge?: string;
  stats: { label: string; value: string }[];
  features: string[];
}

// Production-ready responsive email templates
const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'mc-outreach',
    name: 'Paradigm | Better Managed Communities (MC Outreach)',
    category: 'Residential FM',
    tagline: 'High-Impact Outreach for Residential Management Committees',
    description: 'Purpose-built outreach template for Apartment Associations, RWAs, and MC Board Members. Focuses on resolving daily firefighting, staff supervision, and vendor accountability with proven 40%+ open rates.',
    subject: 'Paradigm | Better Managed Communities - A Question for Your Management Committee',
    html: PARADIGM_MC_OUTREACH_TEMPLATE,
    badge: 'Recommended',
    stats: [
      { label: 'Avg Open Rate', value: '46%' },
      { label: 'Click Rate', value: '18%' },
      { label: 'Response Target', value: '< 24h' }
    ],
    features: [
      'Visual Content Editor Supported',
      'Dynamic {{name}} & {{firstName}} personalization',
      '14+ Verified client community showcase',
      'Integrated WhatsApp & direct site audit CTA'
    ]
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
  const [testEmailSubject, setTestEmailSubject] = useState<string>('');
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [previewTemplateModal, setPreviewTemplateModal] = useState<StarterTemplate | null>(null);
  const [modalPreviewDevice, setModalPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Visual Template Content Editor State (User-Friendly Mode)
  const [bodyEditorMode, setBodyEditorMode] = useState<'visual' | 'code'>('visual');
  const [templateContent, setTemplateContent] = useState<MarketingTemplateContent>(DEFAULT_TEMPLATE_CONTENT);
  const [visualSectionTab, setVisualSectionTab] = useState<'greeting' | 'hero' | 'stats' | 'cta' | 'signoff'>('greeting');

  const handleContentChange = <K extends keyof MarketingTemplateContent>(field: K, value: MarketingTemplateContent[K]) => {
    const next = { ...templateContent, [field]: value };
    setTemplateContent(next);
    setFormData(prev => ({ ...prev, bodyHtml: buildMarketingHtml(next) }));
  };

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

    // Real-time subscription: auto-updates Open Rate and Click Rate immediately when recipient opens or clicks
    const channel = supabase
      .channel('crm-campaign-live-analytics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketing_campaigns' },
        () => {
          crmApi.getCampaigns().then(updated => setCampaigns(updated)).catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-refresh when any campaign is in 'sending' status
  useEffect(() => {
    const hasSending = campaigns.some(c => c.status === 'sending');
    if (!hasSending) return;

    const interval = setInterval(async () => {
      try {
        const updated = await crmApi.getCampaigns();
        setCampaigns(updated);
      } catch {}
    }, 2500);

    return () => clearInterval(interval);
  }, [campaigns]);

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
    setTemplateContent(DEFAULT_TEMPLATE_CONTENT);
    setBodyEditorMode('visual');
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

    const finalSubject = (testEmailSubject.trim() || formData.subject || 'Paradigm Marketing Campaign').trim();

    setIsSendingTest(true);
    try {
      await crmApi.sendTestCampaignEmail(
        trimmedEmail,
        finalSubject,
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
            onClick={loadData}
            title="Refresh Live Analytics"
            className="text-xs"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
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
                  onClick={() => {
                    setTestEmailSubject(formData.subject || '');
                    setShowTestModal(true);
                  }}
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

            {/* Template Body Editor with User-Friendly Visual Editor & Raw Code Toggle */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-1 bg-page p-1 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setBodyEditorMode('visual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      bodyEditorMode === 'visual'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-muted hover:text-primary-text'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Visual Content Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setBodyEditorMode('code')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      bodyEditorMode === 'code'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-muted hover:text-primary-text'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" /> Raw HTML Source
                  </button>
                </div>

                <div className="text-[11px] text-muted">
                  {bodyEditorMode === 'visual' ? (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold">
                      ✨ User-Friendly Mode: Edit text, names & stats live
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span>Insert:</span>
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
                  )}
                </div>
              </div>

              {bodyEditorMode === 'visual' ? (
                <div className="space-y-3">
                  {/* Animated Visual Sub-tabs with sliding pill indicator */}
                  <div className="relative flex flex-wrap items-center gap-1.5 bg-page p-1.5 rounded-2xl border border-border text-xs">
                    {[
                      { id: 'greeting' as const, label: 'Greeting & Name', icon: Users },
                      { id: 'hero' as const, label: 'Headline & Pitch', icon: Target },
                      { id: 'stats' as const, label: 'Company Stats', icon: BarChart3 },
                      { id: 'cta' as const, label: 'CTA & Review Button', icon: ArrowUpRight },
                      { id: 'signoff' as const, label: 'Sender & Contact', icon: CheckCircle2 }
                    ].map((tab, idx) => {
                      const isActive = visualSectionTab === tab.id;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setVisualSectionTab(tab.id)}
                          className={`relative px-3.5 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 select-none z-10 ${
                            isActive
                              ? 'text-emerald-950 font-extrabold'
                              : 'text-muted hover:text-primary-text'
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="visualActiveTabPill"
                              className="absolute inset-0 bg-card rounded-xl shadow-xs border border-emerald-500/30 -z-10"
                              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            />
                          )}
                          <Icon className={`h-3.5 w-3.5 transition-colors ${isActive ? 'text-emerald-600' : 'text-muted'}`} />
                          <span>{tab.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black transition-colors ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-page text-muted border border-border'
                          }`}>
                            {idx + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Animated Tab Panel Switching with AnimatePresence */}
                  <AnimatePresence mode="wait">
                    {/* Section 1: Greeting & Name */}
                    {visualSectionTab === 'greeting' && (
                      <motion.div
                        key="greeting"
                        initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-4 bg-page/50 p-4 sm:p-5 rounded-2xl border border-border"
                      >
                        <div>
                          <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                            Recipient Greeting Line
                          </label>
                          <Input
                            value={templateContent.greetingText}
                            onChange={e => handleContentChange('greetingText', e.target.value)}
                            placeholder="e.g. Dear Management Committee Member,"
                          />
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[11px] text-muted">Quick presets:</span>
                            <button
                              type="button"
                              onClick={() => handleContentChange('greetingText', 'Dear Management Committee Member,')}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            >
                              Committee Member
                            </button>
                            <button
                              type="button"
                              onClick={() => handleContentChange('greetingText', 'Dear {{firstName}},')}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                            >
                              First Name (&#123;&#123;firstName&#125;&#125;)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleContentChange('greetingText', 'Dear {{name}},')}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                            >
                              Full Name (&#123;&#123;name&#125;&#125;)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleContentChange('greetingText', 'Dear Valued Resident,')}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
                            >
                              Resident
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                            Opening Message — Problem Context
                          </label>
                          <textarea
                            rows={3}
                            value={templateContent.introPara1}
                            onChange={e => handleContentChange('introPara1', e.target.value)}
                            className="w-full p-3 text-xs bg-card rounded-xl border border-border focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none leading-relaxed transition-all"
                            placeholder="First paragraph..."
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                            Paradigm Introduction — The Solution
                          </label>
                          <textarea
                            rows={3}
                            value={templateContent.introPara2}
                            onChange={e => handleContentChange('introPara2', e.target.value)}
                            className="w-full p-3 text-xs bg-card rounded-xl border border-border focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none leading-relaxed transition-all"
                            placeholder="Second paragraph..."
                          />
                        </div>

                        {/* Step Navigation Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-border mt-4">
                          <span className="text-[11px] text-muted font-medium">Step 1 of 5: Recipient Greeting</span>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setVisualSectionTab('hero')}
                            className="text-xs"
                          >
                            Next: Headline & Pitch <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Section 2: Hero Headline & Pitch */}
                    {visualSectionTab === 'hero' && (
                      <motion.div
                        key="hero"
                        initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-4 bg-page/50 p-4 sm:p-5 rounded-2xl border border-border"
                      >
                        <Input
                          label="Eyebrow Category / Tag"
                          value={templateContent.eyebrow}
                          onChange={e => handleContentChange('eyebrow', e.target.value)}
                          placeholder="e.g. A QUESTION FOR YOUR MANAGEMENT COMMITTEE"
                        />
                        <div>
                          <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                            Main Hero Headline / Question
                          </label>
                          <textarea
                            rows={2}
                            value={templateContent.headline}
                            onChange={e => handleContentChange('headline', e.target.value)}
                            className="w-full p-3 text-xs bg-card rounded-xl border border-border focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none leading-relaxed transition-all"
                            placeholder="Main headline..."
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                            Subheadline / Pain Points Summary
                          </label>
                          <textarea
                            rows={3}
                            value={templateContent.subheadline}
                            onChange={e => handleContentChange('subheadline', e.target.value)}
                            className="w-full p-3 text-xs bg-card rounded-xl border border-border focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none leading-relaxed transition-all"
                            placeholder="Repeated complaints. Staff supervision. Equipment breakdowns..."
                          />
                        </div>

                        {/* Step Navigation Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-border mt-4">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setVisualSectionTab('greeting')}
                            className="text-xs"
                          >
                            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back: Greeting
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setVisualSectionTab('stats')}
                            className="text-xs"
                          >
                            Next: Company Stats <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Section 3: Company Stats */}
                    {visualSectionTab === 'stats' && (
                      <motion.div
                        key="stats"
                        initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-4 bg-page/50 p-4 sm:p-5 rounded-2xl border border-border"
                      >
                        <p className="text-xs text-muted">Customize the 3 prominent highlight statistics displayed in the green hero header:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-card p-3 rounded-xl border border-border space-y-2">
                            <Input
                              label="Stat 1 Value"
                              value={templateContent.stat1Value}
                              onChange={e => handleContentChange('stat1Value', e.target.value)}
                              placeholder="20"
                            />
                            <Input
                              label="Stat 1 Label"
                              value={templateContent.stat1Label}
                              onChange={e => handleContentChange('stat1Label', e.target.value)}
                              placeholder="YEARS"
                            />
                          </div>
                          <div className="bg-card p-3 rounded-xl border border-border space-y-2">
                            <Input
                              label="Stat 2 Value"
                              value={templateContent.stat2Value}
                              onChange={e => handleContentChange('stat2Value', e.target.value)}
                              placeholder="150+"
                            />
                            <Input
                              label="Stat 2 Label"
                              value={templateContent.stat2Label}
                              onChange={e => handleContentChange('stat2Label', e.target.value)}
                              placeholder="COMMUNITIES"
                            />
                          </div>
                          <div className="bg-card p-3 rounded-xl border border-border space-y-2">
                            <Input
                              label="Stat 3 Value"
                              value={templateContent.stat3Value}
                              onChange={e => handleContentChange('stat3Value', e.target.value)}
                              placeholder="5,000+"
                            />
                            <Input
                              label="Stat 3 Label"
                              value={templateContent.stat3Label}
                              onChange={e => handleContentChange('stat3Label', e.target.value)}
                              placeholder="PROFESSIONALS"
                            />
                          </div>
                        </div>

                        {/* Step Navigation Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-border mt-4">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setVisualSectionTab('hero')}
                            className="text-xs"
                          >
                            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back: Headline
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setVisualSectionTab('cta')}
                            className="text-xs"
                          >
                            Next: CTA Button <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Section 4: CTA & Audit Review Button */}
                    {visualSectionTab === 'cta' && (
                      <motion.div
                        key="cta"
                        initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-4 bg-page/50 p-4 sm:p-5 rounded-2xl border border-border"
                      >
                        <Input
                          label="Callout Heading"
                          value={templateContent.ctaHeading}
                          onChange={e => handleContentChange('ctaHeading', e.target.value)}
                          placeholder="e.g. Would a fresh look at your operations help?"
                        />
                        <div>
                          <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                            Callout Body & Reassurance
                          </label>
                          <textarea
                            rows={3}
                            value={templateContent.ctaSubtext}
                            onChange={e => handleContentChange('ctaSubtext', e.target.value)}
                            className="w-full p-3 text-xs bg-card rounded-xl border border-border focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none leading-relaxed transition-all"
                            placeholder="We would be pleased to visit your community..."
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            label="Button Text"
                            value={templateContent.ctaButtonText}
                            onChange={e => handleContentChange('ctaButtonText', e.target.value)}
                            placeholder="Request a Complimentary Site Review"
                          />
                          <Input
                            label="Button Target URL"
                            value={templateContent.ctaButtonUrl}
                            onChange={e => handleContentChange('ctaButtonUrl', e.target.value)}
                            placeholder="https://app.paradigmfms.com/#/referral/business"
                          />
                        </div>

                        {/* Step Navigation Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-border mt-4">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setVisualSectionTab('stats')}
                            className="text-xs"
                          >
                            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back: Stats
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setVisualSectionTab('signoff')}
                            className="text-xs"
                          >
                            Next: Sender & Contact <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Section 5: Sender Signoff & Contact Details */}
                    {visualSectionTab === 'signoff' && (
                      <motion.div
                        key="signoff"
                        initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-4 bg-page/50 p-4 sm:p-5 rounded-2xl border border-border"
                      >
                        <p className="text-xs text-muted">Edit the representative name, phone, email, and WhatsApp contact details displayed at the bottom of the email:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            label="Representative Name (Sender Signoff)"
                            value={templateContent.senderName}
                            onChange={e => handleContentChange('senderName', e.target.value)}
                            placeholder="e.g. Kavitha or Sudhan M"
                          />
                          <Input
                            label="Company Name"
                            value={templateContent.senderCompany}
                            onChange={e => handleContentChange('senderCompany', e.target.value)}
                            placeholder="Paradigm Integrated Facility Services Pvt. Ltd."
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Input
                            label="Contact Phone"
                            value={templateContent.senderPhone}
                            onChange={e => handleContentChange('senderPhone', e.target.value)}
                            placeholder="+91 99006 08885"
                          />
                          <Input
                            label="Contact Email"
                            value={templateContent.senderEmail}
                            onChange={e => handleContentChange('senderEmail', e.target.value)}
                            placeholder="kavitha@paradigmfms.com"
                          />
                          <Input
                            label="WhatsApp Number (Digits only)"
                            value={templateContent.whatsappNumber}
                            onChange={e => handleContentChange('whatsappNumber', e.target.value)}
                            placeholder="919900608885"
                          />
                        </div>

                        {/* Step Navigation Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-border mt-4">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setVisualSectionTab('cta')}
                            className="text-xs"
                          >
                            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back: CTA
                          </Button>
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Template Ready to Dispatch!
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={14}
                    value={formData.bodyHtml || ''}
                    onChange={e => setFormData({ ...formData, bodyHtml: e.target.value })}
                    className="w-full p-4 text-xs font-mono bg-page rounded-2xl border border-border focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none leading-relaxed transition-all"
                    placeholder="Enter email HTML body..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Live Interactive Preview (5 cols) — Full Height Sticky Canvas */}
          <div className="lg:col-span-5 sticky top-4 self-start flex flex-col h-[calc(100vh-140px)] min-h-[750px] space-y-3">
            <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex items-center justify-between shrink-0">
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

            {/* Email Canvas Shell — Stretches full height down to the bottom of the page */}
            <div className={`flex-1 min-h-0 flex flex-col transition-all ${previewDevice === 'mobile' ? 'max-w-[380px] mx-auto w-full' : 'w-full'}`}>
              <div className="flex-1 min-h-0 flex flex-col bg-white rounded-3xl border border-border shadow-lg overflow-hidden">
                {/* Simulated Email Client Bar */}
                <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 text-xs space-y-1 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 font-semibold">From: </span>
                      <strong className="text-slate-700">{formData.senderName || 'Paradigm Services'}</strong> &lt;{formData.senderEmail || 'contact@paradigmfms.com'}&gt;
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Live
                    </span>
                  </div>
                  <div className="truncate">
                    <span className="text-slate-400 font-semibold">Subject: </span>
                    <strong className="text-slate-800">
                      {(formData.subject || 'Preview Subject').replace(/{{name}}/gi, 'Sample Society')}
                    </strong>
                  </div>
                </div>

                {/* Rendered HTML — Full Height Scrollable Container without arbitrary max-height cuts */}
                <div
                  className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-white"
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" /> Pre-Designed Marketing Layouts ({STARTER_TEMPLATES.length})
              </h3>
              <p className="text-xs text-muted">Ready-to-send responsive email templates crafted for facility management pitches.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Verified Anti-Spam Tested
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {STARTER_TEMPLATES.map(t => (
              <div
                key={t.name}
                className="group bg-card rounded-3xl border border-border/80 hover:border-emerald-500/40 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
              >
                {/* Visual Email Mockup Header */}
                <div className="relative bg-[#073b2b] p-5 border-b border-emerald-950 overflow-hidden">
                  {/* Gold accent line at the very top */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#e3b94e] via-amber-300 to-[#e3b94e]" />

                  {/* Browser / Email Window Chrome bar */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-800/40">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                      <span className="text-[10px] text-emerald-200/60 font-mono ml-2">email-preview.html</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {t.badge && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#e3b94e]/20 text-[#f6d77e] border border-[#e3b94e]/40 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-[#e3b94e]" /> {t.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inner miniature email presentation */}
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="px-2.5 py-1 rounded-full bg-white/10 text-white font-bold text-[10px] tracking-wider flex items-center gap-1.5 border border-white/15">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        PARADIGM SERVICES
                      </div>
                      <span className="text-[9px] uppercase tracking-widest text-[#e3b94e] font-bold">
                        Residential FM
                      </span>
                    </div>

                    <div className="text-center py-1">
                      <p className="text-[9px] uppercase tracking-wider text-[#e3b94e] font-semibold mb-1">
                        A Question For Your Management Committee
                      </p>
                      <h5 className="text-sm font-extrabold text-white leading-snug">
                        You hired an FM agency. <span className="text-[#e3b94e]">Why are you still chasing daily problems?</span>
                      </h5>
                      <p className="text-[10px] text-emerald-100/70 mt-1 line-clamp-1">
                        Repeated complaints · Staff supervision · Equipment breakdowns · Inefficient AMCs
                      </p>
                    </div>

                    {/* Miniature stats counter */}
                    <div className="grid grid-cols-3 gap-1 bg-black/30 rounded-xl p-2 border border-white/10 text-center">
                      <div>
                        <div className="text-xs font-black text-[#e3b94e]">20</div>
                        <div className="text-[8px] uppercase tracking-wider text-emerald-200/70 font-semibold">Years</div>
                      </div>
                      <div className="border-x border-white/10">
                        <div className="text-xs font-black text-[#e3b94e]">150+</div>
                        <div className="text-[8px] uppercase tracking-wider text-emerald-200/70 font-semibold">Communities</div>
                      </div>
                      <div>
                        <div className="text-xs font-black text-[#e3b94e]">5,000+</div>
                        <div className="text-[8px] uppercase tracking-wider text-emerald-200/70 font-semibold">Staff</div>
                      </div>
                    </div>
                  </div>

                  {/* Hover Overlay with Quick Preview */}
                  <div className="absolute inset-0 bg-[#073b2b]/85 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3 backdrop-blur-[3px]">
                    <Button
                      onClick={() => setPreviewTemplateModal(t)}
                      variant="secondary"
                      className="bg-white hover:bg-emerald-50 text-emerald-950 font-bold text-xs shadow-xl border-none"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5 text-emerald-700" /> Interactive Preview
                    </Button>
                    <Button
                      onClick={() => handleNewCampaign(t)}
                      className="text-xs font-bold shadow-xl"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Customize in Studio
                    </Button>
                  </div>
                </div>

                {/* Card Information Body */}
                <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Tags row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {t.category}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-blue-500" /> Visual Editor Ready
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> 100% Responsive
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3 text-amber-600" /> Tracking Active
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h4 className="font-bold text-base text-primary-text group-hover:text-emerald-600 transition-colors">
                        {t.name}
                      </h4>
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        {t.description}
                      </p>
                    </div>

                    {/* Subject line showcase bar */}
                    <div className="p-3 rounded-2xl bg-page border border-border/80 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-emerald-600" /> Default Subject Line
                      </div>
                      <p className="text-xs font-semibold text-primary-text line-clamp-1">
                        {t.subject}
                      </p>
                    </div>

                    {/* Performance Metrics Stats Strip */}
                    {t.stats && t.stats.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-muted/20 border border-border/60 text-center">
                        {t.stats.map(s => (
                          <div key={s.label}>
                            <div className="text-sm font-extrabold text-primary-text">{s.value}</div>
                            <div className="text-[9px] uppercase tracking-wider text-muted font-bold mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Feature Highlights Grid */}
                    {t.features && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted pt-1">
                        {t.features.map(f => (
                          <div key={f} className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate">{f}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dual Action Buttons */}
                  <div className="pt-5 border-t border-border mt-5 flex items-center gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => setPreviewTemplateModal(t)}
                      className="flex-1 text-xs py-2.5 flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-muted" /> Preview
                    </Button>
                    <Button
                      onClick={() => handleNewCampaign(t)}
                      className="flex-[2] text-xs py-2.5 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Use in Campaign Studio
                    </Button>
                  </div>
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">
                    Subject Line
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (testEmailSubject.trim()) {
                        setFormData(prev => ({ ...prev, subject: testEmailSubject.trim() }));
                        setToast({ message: 'Campaign subject updated!', type: 'success' });
                      }
                    }}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-colors"
                    title="Copy this subject to the main campaign"
                  >
                    Sync to Campaign
                  </button>
                </div>
                <Input
                  placeholder="Enter test subject line..."
                  value={testEmailSubject}
                  onChange={e => setTestEmailSubject(e.target.value)}
                />
              </div>

              <div className="p-3 rounded-2xl bg-page text-[11px] text-muted space-y-1 border border-border/60">
                <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                  <span>⚡ Instant Preview Test</span>
                </div>
                <div>Sent via verified production SMTP with Supabase Storage CDN assets.</div>
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

      {/* TEMPLATE QUICK PREVIEW MODAL */}
      {previewTemplateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-card border border-border rounded-3xl shadow-2xl max-w-4xl w-full h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-page/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-primary-text truncate">
                      {previewTemplateModal.name}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 hidden sm:inline-block">
                      {previewTemplateModal.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted truncate">
                    Subject: {previewTemplateModal.subject}
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-card border border-border rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setModalPreviewDevice('desktop')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      modalPreviewDevice === 'desktop'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-muted hover:text-primary-text'
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalPreviewDevice('mobile')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      modalPreviewDevice === 'mobile'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-muted hover:text-primary-text'
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Mobile</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewTemplateModal(null)}
                  className="p-2 rounded-xl text-muted hover:text-primary-text hover:bg-page transition-colors"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable Email Viewport */}
            <div className="flex-1 min-h-0 bg-slate-900/10 dark:bg-black/40 overflow-y-auto p-4 sm:p-6 flex items-start justify-center">
              <div
                className={`transition-all duration-300 bg-white shadow-xl ${
                  modalPreviewDevice === 'desktop'
                    ? 'w-full max-w-[680px] rounded-2xl border border-border overflow-hidden'
                    : 'w-[375px] rounded-[36px] border-[8px] border-slate-800 shadow-2xl overflow-hidden'
                }`}
              >
                <div
                  className="w-full overflow-x-hidden text-slate-800"
                  dangerouslySetInnerHTML={{ __html: previewTemplateModal.html }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-muted flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Loading this template will initialize the visual editor and recipient targeting.</span>
              </div>
              <div className="flex items-center justify-end gap-2 shrink-0">
                <Button
                  variant="secondary"
                  onClick={() => setPreviewTemplateModal(null)}
                  className="text-xs"
                >
                  Close Preview
                </Button>
                <Button
                  onClick={() => {
                    const t = previewTemplateModal;
                    setPreviewTemplateModal(null);
                    handleNewCampaign(t);
                  }}
                  className="text-xs"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Use in Campaign Studio
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailMarketingDashboard;
