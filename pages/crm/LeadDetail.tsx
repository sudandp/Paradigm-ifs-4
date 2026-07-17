import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrmStore } from '../../store/crmStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase';
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
  const { 
    leads, fetchLeads, fetchLeadById, isLoading, createLead, updateLead, deleteLead, updateLeadStatus, 
    followups, fetchFollowups, createFollowup, deleteFollowup,
    submissions, fetchSubmission,
    quotations, fetchQuotations
  } = useCrmStore();

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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'quotations'>('details');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await (supabase
          .from('users') as any)
          .select('id, name, email, role_id, phone, role:roles(display_name), onboarding_submissions!onboarding_submissions_user_id_fkey(employee_id)')
          .order('name');
        if (!error && data) {
          setUsersList(data);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!isNew) {
      if (existingLead) {
        setForm(existingLead);
        if (existingLead.referrerName) {
          setSearchTerm(existingLead.referrerName);
        }
        fetchFollowups(existingLead.id);
        fetchSubmission(existingLead.id);
        fetchQuotations(existingLead.id);
      } else {
        fetchLeadById(id!);
      }
    }
  }, [id, existingLead, isNew, fetchLeadById, fetchFollowups, fetchSubmission, fetchQuotations]);

  const leadFollowups = id && !isNew ? (followups[id] || []) : [];
  const leadSubmission = id && !isNew ? (submissions[id] || null) : null;
  const leadQuotations = id && !isNew ? quotations.filter(q => q.leadId === id) : [];

  // Combine all timeline events
  const timelineEvents = useMemo(() => {
    const events: any[] = [
      ...leadFollowups.map(f => ({ ...f, timelineType: 'followup' }))
    ];

    if (leadSubmission) {
      events.push({
        id: leadSubmission.id,
        type: 'Site Survey',
        notes: `Property audit submitted with ${Object.keys(leadSubmission.data || {}).length} responses.`,
        createdAt: leadSubmission.createdAt,
        timelineType: 'submission',
        data: leadSubmission.data,
        remarks: leadSubmission.remarks
      });
    }

    leadQuotations.forEach(q => {
      events.push({
        id: q.id,
        type: 'Quotation',
        notes: `Quotation ${q.quotationNumber} generated for ₹${q.annualCost?.toLocaleString()}/year.`,
        createdAt: q.createdAt,
        timelineType: 'quotation',
        status: q.status
      });
    });

    return events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [leadFollowups, leadSubmission, leadQuotations]);

  // Smart field-mismatch detection: shows a helpful hint when user types wrong data
  const [fieldHint, setFieldHint] = useState<{ field: string; message: string } | null>(null);
  const fieldHintTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const detectMismatch = (fieldName: string, rawValue: string, cleanedValue: string) => {
    if (rawValue === cleanedValue) return; // nothing was stripped, no mismatch
    if (fieldHintTimeout.current) clearTimeout(fieldHintTimeout.current);

    let hint = '';
    if (/@/.test(rawValue) && /\./.test(rawValue)) {
      hint = '💡 This looks like an email address — please use the Email field below';
    } else if (/\d{4,}/.test(rawValue)) {
      hint = '💡 This looks like a phone number — please use the Phone Number field';
    } else if (/\d/.test(rawValue)) {
      hint = '💡 Numbers are not allowed in this field';
    } else if (/[@#$%^&*!]/.test(rawValue)) {
      hint = '💡 Special characters are not allowed in this field';
    }

    if (hint) {
      setFieldHint({ field: fieldName, message: hint });
      fieldHintTimeout.current = setTimeout(() => setFieldHint(null), 4000);
    }
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.clientName?.trim()) {
      newErrors.clientName = 'Client name is required';
    } else if (form.clientName.trim().length < 2) {
      newErrors.clientName = 'Client name must be at least 2 characters';
    }
    if (!form.contactPerson?.trim()) {
      newErrors.contactPerson = 'Contact person is required';
    } else if (form.contactPerson.trim().length < 2) {
      newErrors.contactPerson = 'Contact person must be at least 2 characters';
    }
    if (!form.phone?.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^(?:\+91[- ]?)?[0-9]{10}$/.test(form.phone.trim())) {
      newErrors.phone = 'Enter a valid 10-digit phone number (e.g. +91 9876543210)';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.contactPersonEmail?.trim() && !emailRegex.test(form.contactPersonEmail.trim())) {
      newErrors.contactPersonEmail = 'Enter a valid email address';
    }
    if (form.email?.trim() && !emailRegex.test(form.email.trim())) {
      newErrors.email = 'Enter a valid email address';
    }

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      setToast({ message: 'Please fill in all mandatory fields', type: 'error' });
      return;
    }
    setFormErrors({});
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

  const handleDeleteFollowup = async (followupId: string) => {
    if (!followupId) return;
    if (!window.confirm('Are you sure you want to permanently delete this timeline entry?')) return;
    try {
      await deleteFollowup(followupId);
      setToast({ message: 'Timeline entry deleted successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to delete timeline entry', type: 'error' });
    }
  };

  if (!isNew && isLoading && !existingLead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
        <p className="text-sm text-white/50 md:text-muted mt-4">Loading lead details...</p>
      </div>
    );
  }

  if (!isNew && !existingLead && !isLoading) {
    return (
      <div className="text-center p-8 bg-white/[0.03] md:bg-white backdrop-blur-xl md:backdrop-blur-none rounded-[2.5rem] md:rounded-3xl border border-white/5 md:border-border max-w-md mx-auto mt-20">
        <h2 className="text-xl font-bold text-white md:text-primary-text mb-4">Lead Not Found</h2>
        <p className="text-white/50 md:text-muted mb-6">The lead you are trying to view does not exist or you do not have permission to view it.</p>
        <button onClick={() => navigate('/crm')} className="btn btn-primary px-6 active:scale-95 transition-all shadow-sm">
          Back to Leads
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 animate-fade-in pb-32">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Modern Header - Sticky on Mobile */}
      <div className="sticky top-0 z-40 -mx-4 px-4 py-4 md:static md:mt-0 md:mx-0 md:mb-6 md:p-0 bg-[#041b0f]/80 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none border-b border-white/5 md:border-none flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div className="flex flex-col gap-1 w-full">
          {/* Back Navigation Link */}
          <button 
            onClick={() => navigate('/crm')} 
            className="flex items-center gap-1.5 text-xs text-white/50 md:text-muted hover:text-emerald-400 md:hover:text-accent transition-colors mb-1.5 w-fit group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Leads</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-white md:text-primary-text tracking-tight truncate">
                {isNew ? 'New Lead' : form.clientName}
              </h1>
              {!isNew && form.status && (
                <div className="px-2 py-0.5 rounded-lg text-[8px] font-black text-white uppercase tracking-tighter shadow-lg shrink-0" style={{ backgroundColor: LEAD_STATUS_COLORS[form.status] }}>
                  {form.status}
                </div>
              )}
            </div>
            <p className="hidden md:block text-sm text-muted mt-1">
              {isNew ? 'Create a new lead and initialize pipeline workflow' : 'Manage client details, timeline, and quotations'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          {!isNew && (
            <button 
              onClick={handleDelete} 
              className="w-10 h-10 rounded-xl bg-white/[0.05] md:bg-red-50 border border-white/10 md:border-red-200 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
              title="Delete Lead"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary btn-md flex-1 md:flex-none gap-2 px-6 active:scale-95 transition-all shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="font-semibold text-sm">{isNew ? 'Initialize' : 'Save'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & History */}
        <div className="lg:col-span-8 space-y-8">
          {/* Tabs */}
          <div className="mb-6 border-b border-white/5 md:border-border">
            <nav className="-mb-px flex space-x-6 overflow-x-auto no-scrollbar scroll-smooth snap-x" aria-label="Tabs">
              {(['details', 'timeline', 'quotations'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors snap-start min-w-max ${
                    activeTab === tab 
                      ? 'border-emerald-400 text-emerald-400 md:border-accent md:text-accent-dark' 
                      : 'border-transparent text-white/30 md:text-muted hover:text-white md:hover:text-accent-dark md:hover:border-accent'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
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
                {fieldHint && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 animate-fade-in">
                    <span className="text-sm text-amber-600 md:text-amber-500 font-medium">{fieldHint.message}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Client Name" requiredIndicator error={formErrors.clientName} value={form.clientName || ''} onChange={(e) => { const raw = e.target.value; const cleaned = raw.replace(/[^a-zA-Z\s.-]/g, ''); detectMismatch('clientName', raw, cleaned); setForm(p => ({ ...p, clientName: cleaned })); }} placeholder="e.g. Manu Srivatsa" />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Association Name / Billing Name" value={form.associationName || ''} onChange={(e) => setForm(p => ({ ...p, associationName: e.target.value.replace(/[^a-zA-Z0-9\s.&-]/g, '') }))} placeholder="e.g. Pramuk M M Meridian" />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Contact Person" requiredIndicator error={formErrors.contactPerson} value={form.contactPerson || ''} onChange={(e) => { const raw = e.target.value; const cleaned = raw.replace(/[^a-zA-Z\s.-]/g, ''); detectMismatch('contactPerson', raw, cleaned); setForm(p => ({ ...p, contactPerson: cleaned })); }} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Contact Person Designation" value={form.contactPersonDesignation || ''} onChange={(e) => { const raw = e.target.value; const cleaned = raw.replace(/[^a-zA-Z\s.-]/g, ''); detectMismatch('designation', raw, cleaned); setForm(p => ({ ...p, contactPersonDesignation: cleaned })); }} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Phone Number" requiredIndicator error={formErrors.phone} value={form.phone || ''} onChange={(e) => { const v = e.target.value.replace(/[^0-9+ -]/g, ''); if (v.length <= 13) setForm(p => ({ ...p, phone: v })); }} inputMode="tel" maxLength={13} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Contact Person Email ID" error={formErrors.contactPersonEmail} value={form.contactPersonEmail || ''} onChange={(e) => setForm(p => ({ ...p, contactPersonEmail: e.target.value.replace(/\s/g, '') }))} onBlur={(e) => {
                    if (e.target.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) {
                      setFormErrors(prev => ({ ...prev, contactPersonEmail: 'Enter a valid email address' }));
                    } else {
                      setFormErrors(prev => { const copy = { ...prev }; delete copy.contactPersonEmail; return copy; });
                    }
                  }} type="email" />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Association Email Address" error={formErrors.email} value={form.email || ''} onChange={(e) => setForm(p => ({ ...p, email: e.target.value.replace(/\s/g, '') }))} onBlur={(e) => {
                    if (e.target.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) {
                      setFormErrors(prev => ({ ...prev, email: 'Enter a valid email address' }));
                    } else {
                      setFormErrors(prev => { const copy = { ...prev }; delete copy.email; return copy; });
                    }
                  }} type="email" />
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
                  <div>
                    <label className="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2">Assigned To</label>
                    <select
                      className="form-input h-11"
                      value={form.assignedTo || ''}
                      onChange={(e) => setForm(p => ({ ...p, assignedTo: e.target.value }))}
                      disabled={!['admin', 'super_admin', 'superadmin'].includes(user?.role || '')}
                    >
                      <option value="">Unassigned</option>
                      {Object.entries(
                        usersList.reduce((acc, user) => {
                          const role = user.role_id ? user.role_id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unknown Role';
                          if (!acc[role]) acc[role] = [];
                          acc[role].push(user);
                          return acc;
                        }, {} as Record<string, any[]>)
                      ).map(([role, users]: [string, any[]]) => (
                        <optgroup key={role} label={role}>
                          {users.map((u: any) => (
                            <option key={u.id} value={u.id}>
                              {u.name || u.email}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Referral Details Section — only visible when source = Referral */}
              {form.source === 'Referral' && (
                <div className="bg-white/[0.03] md:bg-white backdrop-blur-xl md:backdrop-blur-none rounded-[2.5rem] md:rounded-3xl border border-white/5 md:border-border p-6 md:p-8 shadow-2xl md:shadow-sm group hover:shadow-md transition-all animate-fade-in">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 md:bg-amber-50 flex items-center justify-center">
                      <User className="w-5 h-5 text-amber-400 md:text-amber-600" />
                    </div>
                    <h2 className="text-lg font-black text-white md:text-primary-text uppercase tracking-wider">Referral Details</h2>
                  </div>

                  {/* Employee/Outsider Toggle */}
                  <div className="mb-8">
                    <label className="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-3">Is the Referrer a Paradigm Employee?</label>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setForm(p => ({ ...p, referrerIsEmployee: true, referrerRelation: undefined, referrerBankName: undefined, referrerAccountNumber: undefined, referrerIfscCode: undefined, referrerUpiId: undefined }));
                          if (user) {
                            setForm(p => ({ ...p, referrerName: user.name || '', referrerMobile: user.phone || '', referrerDesignation: user.role || '' }));
                            setSearchTerm(user.name || '');
                          }
                        }}
                        className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${
                          form.referrerIsEmployee === true
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                            : 'bg-white/5 md:bg-gray-100 text-white/50 md:text-gray-500 border border-white/10 md:border-border'
                        }`}
                      >
                        Yes, Employee
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForm(p => ({ ...p, referrerIsEmployee: false, referrerEmployeeId: undefined, referrerSiteLocation: undefined, referrerName: '', referrerMobile: '', referrerDesignation: undefined }));
                          setSearchTerm('');
                        }}
                        className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${
                          form.referrerIsEmployee === false
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                            : 'bg-white/5 md:bg-gray-100 text-white/50 md:text-gray-500 border border-white/10 md:border-border'
                        }`}
                      >
                        No, Outsider
                      </button>
                    </div>
                  </div>

                  {/* Employee Fields */}
                  {form.referrerIsEmployee === true && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                      <div className="relative" ref={dropdownRef}>
                        <Input
                          labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2"
                          label="Referrer Name"
                          requiredIndicator
                          value={searchTerm}
                          onFocus={() => setIsDropdownOpen(true)}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^a-zA-Z\s.-]/g, '');
                            setSearchTerm(val);
                            setForm(p => ({ ...p, referrerName: val }));
                            setIsDropdownOpen(true);
                          }}
                          placeholder="Search or enter name..."
                        />
                        {isDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-[#0b2818] md:bg-white border border-emerald-900/30 md:border-gray-200 rounded-2xl shadow-2xl scrollbar-thin">
                            {usersList.filter(u =>
                              (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
                            ).length > 0 ? (
                              usersList
                                .filter(u =>
                                  (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map((u: any) => (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => {
                                      setSearchTerm(u.name);
                                      const roleData = u.role;
                                      const mappedDesignation = (Array.isArray(roleData) ? roleData[0]?.display_name : roleData?.display_name) || u.role_id || '';
                                      const friendlyDesignation = typeof mappedDesignation === 'string'
                                        ? mappedDesignation.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                                        : '';
                                      
                                      const subData = u.onboarding_submissions;
                                      const employeeId = (Array.isArray(subData) ? subData[0]?.employee_id : subData?.employee_id) || '';
                                      
                                      setForm(p => ({
                                        ...p,
                                        referrerName: u.name,
                                        referrerMobile: u.phone || '',
                                        referrerDesignation: friendlyDesignation,
                                        referrerEmployeeId: employeeId
                                      }));
                                      setIsDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-emerald-800/20 md:hover:bg-gray-50 text-white md:text-gray-800 border-b border-emerald-900/10 md:border-gray-100 last:border-b-0 transition-colors flex flex-col gap-0.5 cursor-pointer animate-fade-in"
                                  >
                                    <span className="text-sm font-bold">{u.name}</span>
                                    <span className="text-[10px] text-white/50 md:text-gray-400">
                                      {u.email} • {((Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || u.role_id)}
                                    </span>
                                  </button>
                                ))
                            ) : (
                              <div className="px-4 py-3 text-xs text-white/50 md:text-gray-400">No employees found</div>
                            )}
                          </div>
                        )}
                      </div>
                      <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Referrer Contact Number" requiredIndicator value={form.referrerMobile || ''} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v.length <= 10) setForm(p => ({ ...p, referrerMobile: v })); }} inputMode="tel" maxLength={10} />
                      <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Employee ID" value={form.referrerEmployeeId || ''} onChange={(e) => setForm(p => ({ ...p, referrerEmployeeId: e.target.value }))} placeholder="e.g. AP1234" />
                      <div>
                        <label className="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2">Site / Location <span className="text-red-500">*</span></label>
                        <select
                          className="form-input h-11"
                          value={form.referrerSiteLocation || ''}
                          onChange={(e) => setForm(p => ({ ...p, referrerSiteLocation: e.target.value }))}
                        >
                          <option value="">Select City / Location</option>
                          {['Bangalore', 'Hyderabad', 'Chennai', 'Mumbai', 'Pune', 'Delhi NCR', 'Kolkata', 'Ahmedabad', 'Other'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Referrer Designation" requiredIndicator value={form.referrerDesignation || ''} onChange={(e) => setForm(p => ({ ...p, referrerDesignation: e.target.value.replace(/[^a-zA-Z\s.\-/]/g, '') }))} />
                    </div>
                  )}

                  {/* Outsider Fields */}
                  {form.referrerIsEmployee === false && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Referrer Name" requiredIndicator value={form.referrerName || ''} onChange={(e) => setForm(p => ({ ...p, referrerName: e.target.value.replace(/[^a-zA-Z\s.-]/g, '') }))} />
                        <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Referrer Contact Number" requiredIndicator value={form.referrerMobile || ''} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v.length <= 10) setForm(p => ({ ...p, referrerMobile: v })); }} inputMode="tel" maxLength={10} />
                        <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Relation / Company" requiredIndicator value={form.referrerRelation || ''} onChange={(e) => setForm(p => ({ ...p, referrerRelation: e.target.value }))} placeholder="e.g. Friend, Vendor Name" />
                      </div>

                      {/* Payment Details */}
                      <div className="mt-4">
                        <label className="block text-[10px] font-black text-amber-400 md:text-amber-600 uppercase tracking-widest md:tracking-wider mb-4">💰 Payment Details (For Referral Reward)</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4 p-5 rounded-2xl border border-white/5 md:border-border bg-white/[0.02] md:bg-gray-50/50">
                            <label className="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest">🏦 Bank Transfer</label>
                            <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Bank Name" value={form.referrerBankName || ''} onChange={(e) => setForm(p => ({ ...p, referrerBankName: e.target.value }))} placeholder="e.g. HDFC Bank" />
                            <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Account Number" value={form.referrerAccountNumber || ''} onChange={(e) => setForm(p => ({ ...p, referrerAccountNumber: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="Enter account number" />
                            <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="IFSC Code" value={form.referrerIfscCode || ''} onChange={(e) => setForm(p => ({ ...p, referrerIfscCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))} placeholder="e.g. HDFC0001234" />
                          </div>
                          <div className="space-y-4 p-5 rounded-2xl border border-white/5 md:border-border bg-white/[0.02] md:bg-gray-50/50">
                            <label className="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest">📱 UPI Payment</label>
                            <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="UPI ID" value={form.referrerUpiId || ''} onChange={(e) => setForm(p => ({ ...p, referrerUpiId: e.target.value }))} placeholder="e.g. 9876543210@paytm" />
                            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                              <p className="text-[10px] font-bold text-amber-500 md:text-amber-600 leading-relaxed">* Please provide either Bank or UPI details to process the referral reward after successful verification.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="City" value={form.city || ''} onChange={(e) => setForm(p => ({ ...p, city: e.target.value.replace(/[^a-zA-Z\s-]/g, '') }))} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Exact Location" value={form.location || ''} onChange={(e) => setForm(p => ({ ...p, location: e.target.value.replace(/[^a-zA-Z0-9\s.,/#-]/g, '') }))} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Area (sqft)" type="number" min={0} value={form.areaSqft || ''} onChange={(e) => setForm(p => ({ ...p, areaSqft: Math.abs(Number(e.target.value)) || undefined }))} onKeyDown={(e) => { if (['-', '.', 'e', 'E'].includes(e.key)) e.preventDefault(); }} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="No. of Towers" type="number" min={0} value={form.towerCount || ''} onChange={(e) => setForm(p => ({ ...p, towerCount: Math.abs(Number(e.target.value)) || undefined }))} onKeyDown={(e) => { if (['-', '.', 'e', 'E'].includes(e.key)) e.preventDefault(); }} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="No. of Floors" type="number" min={0} value={form.floorCount || ''} onChange={(e) => setForm(p => ({ ...p, floorCount: Math.abs(Number(e.target.value)) || undefined }))} onKeyDown={(e) => { if (['-', '.', 'e', 'E'].includes(e.key)) e.preventDefault(); }} />
                  <Input labelClassName="block text-[10px] font-black text-white/40 md:text-muted uppercase tracking-widest md:tracking-wider mb-2" label="Total Units" type="number" min={0} value={form.unitCount || ''} onChange={(e) => setForm(p => ({ ...p, unitCount: Math.abs(Number(e.target.value)) || undefined }))} onKeyDown={(e) => { if (['-', '.', 'e', 'E'].includes(e.key)) e.preventDefault(); }} />
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
                  {timelineEvents.length === 0 && (
                    <div className="text-center py-20">
                      <div className="w-16 h-16 bg-white/[0.05] md:bg-page rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-white/10 md:border-border">
                        <MessageSquare className="w-8 h-8 text-white/10 md:text-muted/30" />
                      </div>
                      <p className="text-[10px] md:text-sm font-black md:font-bold text-white/20 md:text-muted uppercase tracking-[0.2em] md:tracking-widest">Initial journey starting...</p>
                    </div>
                  )}
                  {timelineEvents.map((ev, idx) => (
                    <div key={ev.id} className="relative pl-12 group">
                      <div className="absolute left-0 top-1 w-10 h-10 rounded-xl bg-[#041b0f] md:bg-white border border-white/10 md:border-2 md:border-border flex items-center justify-center z-10 group-hover:border-emerald-500 md:group-hover:border-accent transition-colors shadow-xl md:shadow-sm">
                        {ev.timelineType === 'followup' && (
                          <>
                            {ev.type === 'Call' && <Phone className="w-4 h-4 text-emerald-400 md:text-accent" />}
                            {ev.type === 'Meeting' && <Users className="w-4 h-4 text-emerald-400 md:text-accent" />}
                            {ev.type === 'Email' && <Mail className="w-4 h-4 text-emerald-400 md:text-accent" />}
                            {ev.type === 'Site Visit' && <MapPin className="w-4 h-4 text-emerald-400 md:text-accent" />}
                            {(!['Call', 'Meeting', 'Email', 'Site Visit'].includes(ev.type || '')) && <Clock className="w-4 h-4 text-emerald-400 md:text-accent" />}
                          </>
                        )}
                        {ev.timelineType === 'submission' && <ClipboardCheck className="w-4 h-4 text-emerald-400 md:text-accent" />}
                        {ev.timelineType === 'quotation' && <DollarSign className="w-4 h-4 text-emerald-400 md:text-accent" />}
                      </div>
                      <div className="bg-white/[0.02] md:bg-page/40 p-6 rounded-[2rem] md:rounded-2xl border border-transparent group-hover:border-white/5 md:group-hover:border-border group-hover:bg-white/[0.04] md:group-hover:bg-white transition-all">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${ev.timelineType === 'submission' ? 'text-blue-400' : ev.timelineType === 'quotation' ? 'text-amber-400' : 'text-emerald-400 md:text-primary-text'}`}>
                              {ev.timelineType === 'submission' ? 'Site Audit' : ev.timelineType === 'quotation' ? 'Proposal' : ev.type}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-white/10 md:bg-border" />
                            <span className="text-[9px] md:text-[10px] font-black md:font-bold text-white/20 md:text-muted uppercase md:capitalize tracking-widest md:tracking-normal">
                              {new Date(ev.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          {user?.role?.toLowerCase() === 'admin' && ev.timelineType === 'followup' && (
                            <button
                              onClick={() => handleDeleteFollowup(ev.id)}
                              className="text-red-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-500/10 active:scale-95 shadow-sm"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm font-medium text-white/70 md:text-primary-text leading-relaxed">{ev.notes}</p>
                        
                        {ev.timelineType === 'submission' && ev.data && (
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            {Object.entries(ev.data).map(([key, val]: [string, any]) => (
                              <div key={key} className="bg-white/5 md:bg-page p-2 rounded-lg border border-white/5">
                                <p className="text-[8px] uppercase text-white/40 md:text-muted mb-0.5">{key.replace('f_', '').replace('_', ' ')}</p>
                                <p className="text-xs font-bold text-emerald-400 md:text-primary-text">{val.toString()}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {ev.outcome && (
                          <div className="mt-4 p-4 md:p-3 rounded-2xl md:rounded-lg bg-emerald-500/5 md:bg-accent/5 border-l-4 border-emerald-500 md:border-accent">
                            <p className="text-[9px] md:text-[10px] font-black text-emerald-400 md:text-accent uppercase tracking-widest md:tracking-wider mb-1">Outcome</p>
                            <p className="text-xs font-bold text-white/80 md:text-primary-text">{ev.outcome}</p>
                          </div>
                        )}
                        {ev.nextFollowupDate && (
                          <div className="mt-4 flex items-center gap-2 text-[9px] md:text-[10px] font-black text-orange-400 md:text-orange-600 uppercase bg-orange-400/5 md:bg-orange-50 w-fit px-3 py-1 rounded-lg md:rounded-full border border-orange-400/10 md:border-orange-100">
                            <Clock className="w-3.5 h-3.5" />
                            Next: {new Date(ev.nextFollowupDate).toLocaleDateString('en-IN')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quotations' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white/[0.03] md:bg-white backdrop-blur-xl md:backdrop-blur-none rounded-[2.5rem] md:rounded-3xl border border-white/5 md:border-border p-6 md:p-8 shadow-2xl md:shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 md:bg-accent/5 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-emerald-400 md:text-accent" />
                    </div>
                    <h2 className="text-lg font-black text-white md:text-primary-text uppercase tracking-wider">Quotations & Proposals</h2>
                  </div>
                  <button
                    onClick={() => navigate(`/crm/leads/${id}/quotation`)}
                    className="btn btn-primary btn-sm gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="uppercase tracking-widest text-[10px] font-black">Build Proposal</span>
                  </button>
                </div>

                {leadQuotations.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-white/[0.05] md:bg-page rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-white/10 md:border-border">
                      <DollarSign className="w-8 h-8 text-white/10 md:text-muted/30" />
                    </div>
                    <p className="text-[10px] md:text-sm font-black md:font-bold text-white/20 md:text-muted uppercase tracking-[0.2em] md:tracking-widest mb-4">No quotations created yet</p>
                    <button
                      onClick={() => navigate(`/crm/leads/${id}/quotation`)}
                      className="btn btn-secondary px-6 border-white/10 md:border-border"
                    >
                      Create First Quotation
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {leadQuotations.map((q) => (
                      <div key={q.id} className="p-6 rounded-2xl border border-white/5 md:border-border bg-white/[0.02] md:bg-page/20 hover:bg-white/[0.04] md:hover:bg-white transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white md:text-primary-text">
                              Quotation #{q.quotationNumber || 'Draft'}
                            </span>
                            <span className="text-xs text-white/40 md:text-muted">v{q.version}</span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400">
                              {q.status}
                            </span>
                          </div>
                          <div className="text-xs text-white/60 md:text-muted space-x-4">
                            <span>Monthly: <strong className="text-emerald-400">₹{q.monthlyCost?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
                            <span>Annual: <strong className="text-emerald-400">₹{q.annualCost?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
                            <span>Margin: <strong>{q.marginPercent?.toFixed(1)}%</strong></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => navigate(`/crm/leads/${id}/quotation`)}
                            className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold border border-white/10 md:border-border rounded-xl text-white hover:bg-white/5 transition-all text-center"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              const html = generateProposalHtml(form as CrmLead, q);
                              const win = window.open('', '_blank');
                              if (win) { win.document.write(html); win.document.close(); win.print(); }
                            }}
                            className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all text-center"
                          >
                            View / Print
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    className={`flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer hover:bg-accent/5 ${
                      isCurrent 
                        ? 'bg-emerald-500/5 md:bg-accent/5 border border-emerald-500/20 md:border-accent/20' 
                        : isPast 
                          ? 'opacity-70 md:opacity-80' 
                          : 'opacity-40 md:opacity-50'
                    }`}
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
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[10px] ${
                      isPast 
                        ? 'bg-accent text-white shadow-lg' 
                        : isCurrent 
                          ? 'bg-white border-2 border-accent text-accent' 
                          : 'bg-gray-50 md:bg-page border border-border text-muted'
                    }`}>
                      {isPast ? '✓' : idx + 1}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      isCurrent ? 'text-accent' : isPast ? 'text-primary-text' : 'text-muted'
                    }`}>{status}</span>
                    {isCurrent && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
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

export default LeadDetail;
