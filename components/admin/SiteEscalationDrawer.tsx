import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Building2, 
  UserCheck, 
  Phone, 
  Mail, 
  Layers, 
  Calendar, 
  FileText, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  PhoneCall, 
  MessageSquare,
  Edit2,
  Save,
  Clock,
  MapPin,
  ExternalLink
} from 'lucide-react';
import type { SiteResponsibilityMatrix, EscalationTier } from '../../types/siteRouting';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface SiteEscalationDrawerProps {
  site: SiteResponsibilityMatrix | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updated: SiteResponsibilityMatrix) => Promise<void>;
}

export const SiteEscalationDrawer: React.FC<SiteEscalationDrawerProps> = ({
  site,
  isOpen,
  onClose,
  onSave
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<SiteResponsibilityMatrix | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (site) {
      setFormData(JSON.parse(JSON.stringify(site)));
      setIsEditing(false);
    }
  }, [site]);

  if (!isOpen || !formData) return null;

  const defaultTiers: EscalationTier[] = [
    { level: 1, role: 'Site Supervisor', name: formData.siteSupervisorName || 'Site In-charge', contact: '+91 80 4123 4567' },
    { level: 2, role: 'Operations Manager', name: formData.opsManagerName, contact: 'Direct Ops Hotline' },
    { level: 3, role: 'Head of Operations', name: 'Management Support Desk', contact: 'support@paradigmfms.com' }
  ];

  const tiers: EscalationTier[] = formData.escalationTiers && formData.escalationTiers.length > 0
    ? formData.escalationTiers
    : defaultTiers;

  const handleSave = async () => {
    if (!onSave || !formData) return;
    try {
      setIsSaving(true);
      await onSave(formData);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update escalation matrix', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTierChange = (index: number, field: keyof EscalationTier, value: string) => {
    const updatedTiers = [...tiers];
    updatedTiers[index] = { ...updatedTiers[index], [field]: value };
    setFormData({ ...formData, escalationTiers: updatedTiers });
  };

  const getCompanyBadgeColor = (comp: string) => {
    const lower = comp.toLowerCase();
    if (lower.includes('pifs') && lower.includes('ppfms')) return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
    if (lower.includes('swllp') || lower.includes('south')) return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    if (lower.includes('ppfms')) return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fade-in flex justify-end" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 h-full shadow-2xl overflow-y-auto flex flex-col border-l border-gray-200 dark:border-zinc-800 animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-950/50 sticky top-0 z-10 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                  {formData.siteName}
                </h2>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getCompanyBadgeColor(formData.billingCompany)}`}>
                  {formData.billingCompany}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
                <span>Billing: {formData.billingCycle || '3rd Billing Cycle'}</span>
                {formData.unitsCount && (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formData.unitsCount} Units / Flats</span>
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => {
                    setFormData(JSON.parse(JSON.stringify(site)));
                    setIsEditing(false);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="!bg-emerald-600 hover:!bg-emerald-700 !text-white flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? 'Saving...' : 'Save Matrix'}
                </Button>
              </>
            ) : (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Escalation
              </Button>
            )}

            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="p-6 space-y-8 flex-1">
          
          {/* Section 1: Incharges */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                Primary Functional Incharges
              </h3>
              <span className="text-[11px] text-gray-400">Directly responsible for automated workflows</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Ops Lead Card */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 relative group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                    Operations Lead
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                {isEditing ? (
                  <Input 
                    value={formData.opsManagerName} 
                    onChange={(e) => setFormData({ ...formData, opsManagerName: e.target.value })} 
                    className="!py-1 !text-sm"
                  />
                ) : (
                  <div className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {formData.opsManagerName}
                  </div>
                )}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  Shift checkouts, overall operations & escalation management.
                </p>
              </div>

              {/* Site Manager Card */}
              <div className="p-4 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/40 relative group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300">
                    Site Manager
                  </span>
                  <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                {isEditing ? (
                  <Input 
                    value={formData.siteManagerName || formData.siteSupervisorName || ''} 
                    placeholder="Site Manager(s)"
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      siteManagerName: e.target.value,
                      siteSupervisorName: e.target.value
                    })} 
                    className="!py-1 !text-sm"
                  />
                ) : (
                  <div className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {formData.siteManagerName || formData.siteSupervisorName || <span className="text-gray-400 text-sm italic font-normal">Unassigned</span>}
                  </div>
                )}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  On-site day-to-day management, site team supervision & client contact.
                </p>
              </div>

              {/* Field Officer Card */}
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 relative group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                    Field Officer
                  </span>
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                {isEditing ? (
                  <Input 
                    value={formData.fieldOfficerName || ''} 
                    placeholder="Field Officer(s)"
                    onChange={(e) => setFormData({ ...formData, fieldOfficerName: e.target.value })} 
                    className="!py-1 !text-sm"
                  />
                ) : (
                  <div className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {formData.fieldOfficerName || <span className="text-gray-400 text-sm italic font-normal">Unassigned</span>}
                  </div>
                )}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  On-ground inspection, patrol audits & field staff supervision.
                </p>
              </div>

              {/* HR Incharge Card */}
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 relative group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    HR Incharge
                  </span>
                  <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                {isEditing ? (
                  <Input 
                    value={formData.hrInchargeName} 
                    onChange={(e) => setFormData({ ...formData, hrInchargeName: e.target.value })} 
                    className="!py-1 !text-sm"
                  />
                ) : (
                  <div className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {formData.hrInchargeName}
                  </div>
                )}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  Attendance muster, onboarding & leave approvals.
                </p>
              </div>

              {/* Accounts Incharge Card */}
              <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 relative group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                    Accounts Lead
                  </span>
                  <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                {isEditing ? (
                  <Input 
                    value={formData.accountsInchargeName} 
                    onChange={(e) => setFormData({ ...formData, accountsInchargeName: e.target.value })} 
                    className="!py-1 !text-sm"
                  />
                ) : (
                  <div className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {formData.accountsInchargeName}
                  </div>
                )}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  Billing cycle, invoices & GST compliance.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Escalation Hierarchy (L1 / L2 / L3) */}
          <div className="bg-gray-50 dark:bg-zinc-950/60 p-5 rounded-3xl border border-gray-200/80 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Escalation Matrix (Query & Emergency Resolution)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tiered resolution path shown to clients, residents, and field personnel.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {tiers.map((tier, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm"
                >
                  <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center ${
                    tier.level === 1 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                    tier.level === 2 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                    'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                  }`}>
                    L{tier.level}
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">{tier.role}</span>
                      {isEditing ? (
                        <Input 
                          value={tier.name} 
                          onChange={(e) => handleTierChange(idx, 'name', e.target.value)} 
                          className="!py-0.5 !text-xs"
                        />
                      ) : (
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{tier.name}</span>
                      )}
                    </div>

                    <div className="md:col-span-2 flex items-center justify-between">
                      {isEditing ? (
                        <Input 
                          value={tier.contact || ''} 
                          onChange={(e) => handleTierChange(idx, 'contact', e.target.value)} 
                          placeholder="Phone / Email"
                          className="!py-0.5 !text-xs w-full"
                        />
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{tier.contact || 'Not configured'}</span>
                      )}

                      {!isEditing && tier.contact && (
                        <div className="flex items-center gap-1">
                          {tier.contact.includes('@') ? (
                            <a 
                              href={`mailto:${tier.contact}`}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300 transition-colors"
                              title="Send Email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <a 
                              href={`tel:${tier.contact.replace(/[^0-9+]/g, '')}`}
                              className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 transition-colors"
                              title="Call Lead"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Automated Workflow Routing Switches */}
          <div className="border border-gray-200 dark:border-zinc-800 rounded-3xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Automated Downstream Actions
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 block">Daily Attendance Report</span>
                  <span className="text-gray-500 dark:text-gray-400 text-[11px]">Auto-sent at 10:00 AM to {formData.opsManagerName} & {formData.hrInchargeName}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 block">Invoice Generation Alert</span>
                  <span className="text-gray-500 dark:text-gray-400 text-[11px]">Auto-routed to {formData.accountsInchargeName} on {formData.billingCycle || '3rd Cycle'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 block">Field & Facility Tickets</span>
                  <span className="text-gray-500 dark:text-gray-400 text-[11px]">Directly assigned to {formData.opsManagerName} without manual triage</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 block">Staff Grievances & Leaves</span>
                  <span className="text-gray-500 dark:text-gray-400 text-[11px]">Auto-routed to {formData.hrInchargeName} for approval workflow</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Legal, Tax & Contract Reference */}
          <div className="border-t border-gray-100 dark:border-zinc-800 pt-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Tax & Invoicing Entity Details
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400 block mb-0.5">Billing Legal Name:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200 leading-snug">
                  {formData.billingLegalName || formData.siteName}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">GSTIN / UIN:</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {formData.gstin || 'Not Provided'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">PAN Number:</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {formData.pan || 'Not Provided'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">Takeover Date:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {formData.takeoverDate || 'Standard Contract'}
                </span>
              </div>
              {formData.buyerAddress && (
                <div className="col-span-2">
                  <span className="text-gray-400 block mb-0.5">Registered Site Address:</span>
                  <span className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {formData.buyerAddress}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {isEditing && (
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Matrix'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
