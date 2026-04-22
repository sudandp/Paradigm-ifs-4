import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrmStore } from '../../store/crmStore';
import { useAuthStore } from '../../store/authStore';
import { crmApi } from '../../services/crmApi';
import { leadConversionService, generateProposalHtml } from '../../services/leadConversion';
import type { CrmLead, LeadSource, PropertyType, CrmFollowup, FollowupType } from '../../types/crm';
import { LEAD_STATUS_ORDER, LEAD_STATUS_COLORS } from '../../types/crm';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import {
  ArrowLeft, Save, Plus, Phone, Mail, MapPin, Building2,
  Calendar, MessageSquare, Clock, User, ChevronDown, ChevronUp,
  FileText, DollarSign, ClipboardCheck, Loader2, Trash2, Send,
  ArrowRightCircle, Download, Users, ArrowUpRight
} from 'lucide-react';

const LeadDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { leads, fetchLeads, createLead, updateLead, deleteLead, updateLeadStatus, followups, fetchFollowups, createFollowup } = useCrmStore();

  const isNew = id === 'new';
  const existingLead = leads.find(l => l.id === id);

  const [form, setForm] = useState<Partial<CrmLead>>({
    clientName: '',
    associationName: '',
    contactPerson: '',
    phone: '',
    email: '',
    source: undefined,
    propertyType: undefined,
    city: '',
    location: '',
    areaSqft: undefined,
    builtUpArea: undefined,
    superBuiltUpArea: undefined,
    towerCount: undefined,
    floorCount: undefined,
    unitCount: undefined,
    presentFmsCompany: '',
    presentSecurityAgency: '',
    pestControlVendor: '',
    expectedStartDate: '',
    notes: '',
    status: 'New Lead',
    assignedTo: user?.id,
    organizationId: user?.organizationId,
  });

  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [followupForm, setFollowupForm] = useState<Partial<CrmFollowup>>({
    type: 'Call',
    notes: '',
    outcome: '',
    nextFollowupDate: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'quotations'>('details');

  useEffect(() => {
    if (!isNew && existingLead) {
      setForm(existingLead);
      fetchFollowups(existingLead.id);
    } else if (!isNew && !existingLead && leads.length === 0) {
      fetchLeads();
    }
  }, [id, existingLead, isNew, leads.length]);

  useEffect(() => {
    if (!isNew && !existingLead && leads.length > 0) {
      const found = leads.find(l => l.id === id);
      if (found) setForm(found);
    }
  }, [leads, id, isNew, existingLead]);

  const leadFollowups = id && !isNew ? (followups[id] || []) : [];

  const handleSave = async () => {
    if (!form.clientName?.trim()) {
      setToast({ message: 'Client name is required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      if (isNew) {
        const created = await createLead({ ...form, createdBy: user?.id });
        setToast({ message: 'Lead created successfully', type: 'success' });
        setTimeout(() => navigate(`/crm/leads/${created.id}`), 600);
      } else {
        await updateLead(id!, form);
        setToast({ message: 'Lead updated successfully', type: 'success' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to save', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFollowup = async () => {
    if (!followupForm.notes?.trim()) return;
    try {
      await createFollowup({ ...followupForm, leadId: id!, createdBy: user?.id });
      setFollowupForm({ type: 'Call', notes: '', outcome: '', nextFollowupDate: '' });
      setShowFollowupForm(false);
      setToast({ message: 'Follow-up added', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!window.confirm('Are you sure you want to permanently delete this lead?')) return;
    try {
      await deleteLead(id);
      navigate('/crm');
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-32">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Modern Header - Sticky on Mobile */}
      <div className="sticky top-0 z-40 -mx-4 px-4 py-4 md:static md:m-0 md:p-0 bg-[#041b0f]/80 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none border-b border-white/5 md:border-none flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div className="flex items-center gap-4 w-full">
          <button 
            onClick={() => navigate('/crm')} 
            className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center hover:bg-emerald-500 hover:text-[#041b0f] transition-all group"
          >
            <ArrowLeft className="w-5 h-5 transition-colors" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-3xl font-black text-white tracking-tight truncate uppercase">
                {isNew ? 'New Lead' : form.clientName}
              </h1>
              {!isNew && form.status && (
                <div className="px-2 py-0.5 rounded-lg text-[8px] font-black text-white uppercase tracking-tighter shadow-lg shrink-0" style={{ backgroundColor: LEAD_STATUS_COLORS[form.status] }}>
                  {form.status}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {!isNew && (
            <button 
              onClick={handleDelete} 
              className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xl"
              title="Delete Lead"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary btn-lg flex-1 md:flex-none gap-2 px-8 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 active:scale-95 transition-all"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span className="uppercase tracking-widest text-xs font-black">{isNew ? 'Initialize' : 'Save'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & History */}
        <div className="lg:col-span-8 space-y-8">
          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-white/5 md:border-border overflow-x-auto no-scrollbar scroll-smooth snap-x">
            {(['details', 'timeline', 'quotations'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative snap-start min-w-max ${activeTab === tab ? 'text-emerald-400 md:text-accent' : 'text-white/30 md:text-muted hover:text-white md:hover:text-primary-text'}`}
              >
                {tab}
                {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-400 md:bg-accent rounded-t-full shadow-[0_-2px_10px_rgba(52,211,153,0.3)] md:shadow-none" />}
              </button>
            ))}
          </div>

          {activeTab === 'details' && (
            <div className="space-y-8 animate-fade-in">
              {/* Client Section */}
              <div className="bg-white/[0.03] md:bg-white backdrop-blur-xl md:backdrop-blur-none rounded-[2.5rem] md:rounded-3xl border border-white/5 md:border-border p-6 md:p-8 shadow-2xl md:shadow-sm group hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 md:bg-accent/5 flex items-center justify-center">
                    <User className="w-5 h-5 text-emerald-400 md:text-accent" />
                  </div>
                  <h2 className="text-lg font-black text-white md:text-primary-text uppercase tracking-wider">Client Details</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Client / Billing Name" value={form.clientName || ''} onChange={(e) => setForm(p => ({ ...p, clientName: e.target.value }))} placeholder="e.g. Manu Srivatsa" />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Association Name" value={form.associationName || ''} onChange={(e) => setForm(p => ({ ...p, associationName: e.target.value }))} placeholder="e.g. Pramuk M M Meridian" />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Contact Person" value={form.contactPerson || ''} onChange={(e) => setForm(p => ({ ...p, contactPerson: e.target.value }))} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Phone Number" value={form.phone || ''} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} inputMode="tel" />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Email Address" value={form.email || ''} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} type="email" />
                  <div>
                    <label className="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2">Lead Source</label>
                    <select
                      className="form-input h-11"
                      value={form.source || ''}
                      onChange={(e) => setForm(p => ({ ...p, source: e.target.value as LeadSource }))}
                    >
                      <option value="">Select Source</option>
                      {['Referral', 'Website', 'Direct', 'Marketing', 'Facebook Ads', 'WhatsApp Campaign', 'Other'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Property Section */}
              <div className="bg-white/[0.03] md:bg-white backdrop-blur-xl md:backdrop-blur-none rounded-[2.5rem] md:rounded-3xl border border-white/5 md:border-border p-6 md:p-8 shadow-2xl md:shadow-sm group hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 md:bg-blue-50 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-400 md:text-blue-600" />
                  </div>
                  <h2 className="text-lg font-black text-white md:text-primary-text uppercase tracking-wider">Property Profile</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2">Type</label>
                    <select
                      className="form-input h-11"
                      value={form.propertyType || ''}
                      onChange={(e) => setForm(p => ({ ...p, propertyType: e.target.value as PropertyType }))}
                    >
                      <option value="">Select Type</option>
                      <option value="Residential">Residential</option>
                      <option value="Commercial">Commercial</option>
                      <option value="Mixed Use">Mixed Use</option>
                    </select>
                  </div>
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="City" value={form.city || ''} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Exact Location" value={form.location || ''} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Area (sqft)" type="number" value={form.areaSqft || ''} onChange={(e) => setForm(p => ({ ...p, areaSqft: Number(e.target.value) || undefined }))} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="No. of Towers" type="number" value={form.towerCount || ''} onChange={(e) => setForm(p => ({ ...p, towerCount: Number(e.target.value) || undefined }))} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="No. of Floors" type="number" value={form.floorCount || ''} onChange={(e) => setForm(p => ({ ...p, floorCount: Number(e.target.value) || undefined }))} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Total Units" type="number" value={form.unitCount || ''} onChange={(e) => setForm(p => ({ ...p, unitCount: Number(e.target.value) || undefined }))} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Expected Start" type="date" value={form.expectedStartDate || ''} onChange={(e) => setForm(p => ({ ...p, expectedStartDate: e.target.value }))} />
                </div>
              </div>

              {/* Vendor & Notes */}
              <div className="bg-white/[0.03] md:bg-white backdrop-blur-xl md:backdrop-blur-none rounded-[2.5rem] md:rounded-3xl border border-white/5 md:border-border p-6 md:p-8 shadow-2xl md:shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/10 md:bg-orange-50 flex items-center justify-center">
                          <User className="w-4 h-4 text-orange-400 md:text-orange-600" />
                        </div>
                        <h3 className="text-[10px] md:text-sm font-black text-white/40 md:text-primary-text uppercase tracking-widest md:tracking-wider">Current Vendors</h3>
                      </div>
                    <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Present FMS" value={form.presentFmsCompany || ''} onChange={(e) => setForm(p => ({ ...p, presentFmsCompany: e.target.value }))} />
                    <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Security Agency" value={form.presentSecurityAgency || ''} onChange={(e) => setForm(p => ({ ...p, presentSecurityAgency: e.target.value }))} />
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-white/[0.05] md:bg-slate-50 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-white/40 md:text-slate-600" />
                      </div>
                      <h3 className="text-[10px] md:text-sm font-black text-white/40 md:text-primary-text uppercase tracking-widest md:tracking-wider">Strategic Notes</h3>
                    </div>
                    <textarea
                      className="w-full min-h-[120px] bg-white/[0.02] md:bg-page/30 border-white/5 md:border-border border-dashed border-2 rounded-2xl p-4 text-white md:text-primary-text placeholder:text-white/20 md:placeholder:text-muted hover:border-emerald-500/20 md:hover:border-accent/20 transition-all outline-none"
                      value={form.notes || ''}
                      onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Key pain points, client preferences, competition info..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white/[0.03] md:bg-white backdrop-blur-xl md:backdrop-blur-none rounded-[2.5rem] md:rounded-3xl border border-white/5 md:border-border p-6 md:p-8 shadow-2xl md:shadow-sm">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 md:bg-accent/5 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-emerald-400 md:text-accent" />
                    </div>
                    <h2 className="text-lg font-black text-white md:text-primary-text uppercase tracking-wider">Communication History</h2>
                  </div>
                  <button
                    onClick={() => setShowFollowupForm(!showFollowupForm)}
                    className="btn btn-secondary btn-sm gap-2 border-white/10 md:border-border"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="uppercase tracking-widest text-[10px] font-black">New Entry</span>
                  </button>
                </div>

                {showFollowupForm && (
                  <div className="bg-white/[0.02] md:bg-page/50 p-6 rounded-[2rem] md:rounded-2xl border border-white/5 md:border-border mb-8 animate-fade-in-down space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2">Interaction Type</label>
                        <select
                          className="form-input h-10"
                          value={followupForm.type || 'Call'}
                          onChange={(e) => setFollowupForm(p => ({ ...p, type: e.target.value as FollowupType }))}
                        >
                          {['Call', 'Meeting', 'Email', 'WhatsApp', 'Site Visit', 'Other'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2">Next Follow-up</label>
                        <input
                          type="date"
                          className="form-input h-10"
                          value={followupForm.nextFollowupDate || ''}
                          onChange={(e) => setFollowupForm(p => ({ ...p, nextFollowupDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2">Discussion Notes</label>
                      <textarea
                        className="w-full min-h-[80px] bg-white/[0.05] md:bg-white border border-white/10 md:border-border rounded-2xl p-4 text-white md:text-primary-text placeholder:text-white/20 md:placeholder:text-muted outline-none"
                        value={followupForm.notes || ''}
                        onChange={(e) => setFollowupForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="What was discussed?"
                      />
                    </div>
                    <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Expected Outcome" value={followupForm.outcome || ''} onChange={(e) => setFollowupForm(p => ({ ...p, outcome: e.target.value }))} />
                    <div className="flex justify-end gap-3 pt-2">
                      <button onClick={() => setShowFollowupForm(false)} className="px-4 py-2 text-sm font-bold text-white/40 md:text-muted hover:text-white md:hover:text-primary-text">Cancel</button>
                      <button onClick={handleAddFollowup} className="btn btn-primary px-6 border-transparent">Add to Timeline</button>
                    </div>
                  </div>
                )}

                <div className="relative space-y-12 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[1px] before:bg-white/10 md:before:bg-border/60">
                  {leadFollowups.length === 0 && (
                    <div className="text-center py-20">
                      <div className="w-16 h-16 bg-white/[0.05] md:bg-page rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-white/10 md:border-border">
                        <MessageSquare className="w-8 h-8 text-white/10 md:text-muted/30" />
                      </div>
                      <p className="text-[10px] md:text-sm font-black md:font-bold text-white/20 md:text-muted uppercase tracking-[0.2em] md:tracking-widest">{leadFollowups.length === 0 ? 'Initial journey starting...' : ''}</p>
                    </div>
                  )}
                  {leadFollowups.map((fu, idx) => (
                    <div key={fu.id} className="relative pl-12 group">
                      <div className="absolute left-0 top-1 w-10 h-10 rounded-xl bg-[#041b0f] md:bg-white border border-white/10 md:border-2 md:border-border flex items-center justify-center z-10 group-hover:border-emerald-500 md:group-hover:border-accent transition-colors shadow-xl md:shadow-sm">
                        {fu.type === 'Call' && <Phone className="w-4 h-4 text-emerald-400 md:text-accent" />}
                        {fu.type === 'Meeting' && <Users className="w-4 h-4 text-emerald-400 md:text-accent" />}
                        {fu.type === 'Email' && <Mail className="w-4 h-4 text-emerald-400 md:text-accent" />}
                        {fu.type === 'Site Visit' && <MapPin className="w-4 h-4 text-emerald-400 md:text-accent" />}
                        {(!['Call', 'Meeting', 'Email', 'Site Visit'].includes(fu.type || '')) && <Clock className="w-4 h-4 text-emerald-400 md:text-accent" />}
                      </div>
                      <div className="bg-white/[0.02] md:bg-page/40 p-6 rounded-[2rem] md:rounded-2xl border border-transparent group-hover:border-white/5 md:group-hover:border-border group-hover:bg-white/[0.04] md:group-hover:bg-white transition-all">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] md:text-xs font-black md:font-black uppercase tracking-widest text-emerald-400 md:text-primary-text">{fu.type}</span>
                          <span className="w-1 h-1 rounded-full bg-white/10 md:bg-border" />
                          <span className="text-[9px] md:text-[10px] font-black md:font-bold text-white/20 md:text-muted uppercase md:capitalize tracking-widest md:tracking-normal">
                            {new Date(fu.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-white/70 md:text-primary-text leading-relaxed">{fu.notes}</p>
                        {fu.outcome && (
                          <div className="mt-4 p-4 md:p-3 rounded-2xl md:rounded-lg bg-emerald-500/5 md:bg-accent/5 border-l-4 border-emerald-500 md:border-accent">
                            <p className="text-[9px] md:text-[10px] font-black text-emerald-400 md:text-accent uppercase tracking-widest md:tracking-wider mb-1">Outcome</p>
                            <p className="text-xs font-bold text-white/80 md:text-primary-text">{fu.outcome}</p>
                          </div>
                        )}
                        {fu.nextFollowupDate && (
                          <div className="mt-4 flex items-center gap-2 text-[9px] md:text-[10px] font-black text-orange-400 md:text-orange-600 uppercase bg-orange-400/5 md:bg-orange-50 w-fit px-3 py-1 rounded-lg md:rounded-full border border-orange-400/10 md:border-orange-100">
                            <Clock className="w-3.5 h-3.5" />
                            Next: {new Date(fu.nextFollowupDate).toLocaleDateString('en-IN')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Actions & Pipeline */}
        <div className="lg:col-span-4 space-y-8">
          {/* Pipeline Status Widget */}
          <div className="bg-white/[0.03] md:bg-white backdrop-blur-xl md:backdrop-blur-none rounded-[2.5rem] md:rounded-3xl border border-white/5 md:border-border p-8 shadow-2xl md:shadow-sm">
            <h3 className="text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest mb-8 text-center">Pipeline Workflow</h3>
            <div className="space-y-4">
              {LEAD_STATUS_ORDER.map((status, idx) => {
                const isCurrent = form.status === status;
                const isPast = LEAD_STATUS_ORDER.indexOf(form.status || 'New Lead') > idx;
                return (
                  <div 
                    key={status} 
                    className={`flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer ${isCurrent ? 'bg-emerald-500/5 md:bg-accent/5 border border-emerald-500/20 md:border-accent/20' : 'opacity-40 grayscale-[0.5]'}`}
                    onClick={async () => {
                      if (isNew || !id) {
                        setForm(p => ({ ...p, status }));
                      } else {
                        try {
                          setIsSaving(true);
                          const updated = await updateLeadStatus(id, status);
                          setForm(updated);
                          setToast({ message: `Status updated to ${status}`, type: 'success' });
                        } catch (err: any) {
                          setToast({ message: err.message, type: 'error' });
                        } finally {
                          setIsSaving(false);
                        }
                      }
                    }}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[10px] ${isPast ? 'bg-emerald-500 md:bg-accent text-[#041b0f] md:text-white shadow-lg' : isCurrent ? 'bg-white/[0.05] md:bg-white border border-emerald-500 md:border-accent text-emerald-400 md:text-accent' : 'bg-white/[0.02] md:bg-page border border-white/5 md:border-border text-white/20 md:text-muted'}`}>
                      {isPast ? '✓' : idx + 1}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-emerald-400 md:text-accent' : 'text-white/60 md:text-muted'}`}>{status}</span>
                    {isCurrent && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 md:bg-accent animate-pulse" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dynamic Actions */}
          {!isNew && (
            <div className="bg-[#0d2c18] md:bg-white rounded-[2.5rem] md:rounded-3xl p-6 md:p-8 shadow-2xl md:shadow-sm space-y-6 relative overflow-hidden group border border-emerald-500/10 md:border-border">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 md:bg-accent opacity-5 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-150" />
              <h3 className="text-[10px] font-black text-emerald-400/40 md:text-muted uppercase tracking-widest relative z-10 text-center">Sales Actions</h3>
              
              <div className="space-y-4 relative z-10">
                <button
                  onClick={() => navigate(`/crm/leads/${id}/survey`)}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 md:bg-page hover:bg-white/10 md:hover:bg-accent/5 border border-white/10 md:border-border transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
                    <ClipboardCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-white md:text-primary-text">Property Survey</div>
                    <div className="text-[10px] text-white/50 md:text-muted font-bold uppercase tracking-wider">Site audit & data</div>
                  </div>
                </button>

                <button
                  onClick={() => navigate(`/crm/leads/${id}/quotation`)}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 md:bg-page hover:bg-white/10 md:hover:bg-accent/5 border border-white/10 md:border-border transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-white md:text-primary-text">Build Proposal</div>
                    <div className="text-[10px] text-white/50 md:text-muted font-bold uppercase tracking-wider">Dynamic costing engine</div>
                  </div>
                </button>

                <button
                  onClick={async () => {
                    if (!id) return;
                    try {
                      const quotations = await crmApi.getQuotations(id);
                      if (quotations.length === 0) { setToast({ message: 'Create a quotation first', type: 'error' }); return; }
                      const html = generateProposalHtml(form as CrmLead, quotations[0]);
                      const win = window.open('', '_blank');
                      if (win) { win.document.write(html); win.document.close(); win.print(); }
                    } catch (err: any) { setToast({ message: err.message, type: 'error' }); }
                  }}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 md:bg-page hover:bg-white/10 md:hover:bg-accent/5 border border-white/10 md:border-border transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-white md:text-primary-text">Generate PDF</div>
                    <div className="text-[10px] text-white/50 md:text-muted font-bold uppercase tracking-wider">Ready for client</div>
                  </div>
                </button>

                {form.status === 'Won' && !form.convertedEntityId && (
                  <button
                    onClick={async () => {
                      if (!id) return;
                      setIsConverting(true);
                      const result = await leadConversionService.convertLeadToEntity(id);
                      setIsConverting(false);
                      if (result.success) {
                        setToast({ message: result.message, type: 'success' });
                        setForm(p => ({ ...p, convertedEntityId: result.entityId, status: 'Onboarding Started' }));
                      } else {
                        setToast({ message: result.message, type: 'error' });
                      }
                    }}
                    disabled={isConverting}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 transition-all text-left shadow-xl shadow-emerald-500/30"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      {isConverting ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <ArrowRightCircle className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <div className="text-sm font-black text-white">Convert to Project</div>
                      <div className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Official Handover</div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
;

export default LeadDetail;
