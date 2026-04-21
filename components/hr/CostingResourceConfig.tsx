import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ToggleSwitch from '../ui/ToggleSwitch';
import Toast from '../ui/Toast';
import { api } from '../../services/api';
import type { Organization, SiteCostingMaster, CostingResource as CostingResourceType, BillingModel, ResourceShift } from '../../types';
import {
  Plus, Trash2, Save, Loader2, ArrowLeft, Copy, Edit,
  CheckCircle, AlertCircle, LayoutGrid, Lock, Unlock, Settings
} from 'lucide-react';

// ============ DEFAULTS ============
const makeDefaultResource = (): CostingResourceType => ({
  id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  department: '',
  designation: '',
  costCentre: '',
  unitType: 'Manpower',
  quantity: 1,
  billingRate: 0,
  billingModel: 'Per Month',
  total: 0,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  shiftType: 'General',
  shifts: [],
  openShiftAllowed: false,
  weeklyOffApplicable: false,
  weeklyOffType: 'Sunday',
  leaveApplicable: false,
  earnedLeaveCount: null,
  sickLeaveCount: null,
  holidayBillingRule: '',
  holidayPaymentRule: '',
  dutyRule: '',
  uniformDeduction: false,
  uniformDeductionNote: '',
  employmentVerification: false,
  backgroundVerification: false,
  policeVerification: false,
});

const EMPTY_CONFIG: SiteCostingMaster = {
  id: '',
  siteId: '',
  siteName: '',
  clientName: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: '',
  billingModel: 'Per Month',
  billingCycleDay: 1,
  adminChargePercent: 10,
  adminChargeApplicable: true,
  status: 'Draft',
  versionNo: 1,
  resources: [],
  additionalCharges: [],
};

// ============ CALC HELPERS ============
const calcResourceTotal = (r: CostingResourceType): number => {
  const qty = Number(r.quantity) || 0;
  const rate = Number(r.billingRate) || 0;
  switch (r.billingModel) {
    case 'Per Month': return qty * rate;
    case 'Per Day': return qty * rate * 26;
    case 'Per Hour': return qty * rate * 208;
    case 'Lumpsum': return rate;
    default: return qty * rate;
  }
};

const fmt = (val: number) =>
  val.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

// ============ EXPANDABLE ROW COMPONENT ============
interface ResourceRowProps {
  index: number;
  register: any;
  control: any;
  watch: any;
  remove: (index: number) => void;
  isLocked: boolean;
  total: number;
  groupedDesignations: Record<string, string[]>;
  setValue: any;
}

const ResourceRow: React.FC<ResourceRowProps> = ({ index, register, control, watch, remove, isLocked, total, groupedDesignations, setValue }) => {
  const [expanded, setExpanded] = useState(false);
  const shifts: ResourceShift[] = watch(`resources.${index}.shifts`) || [];
  const shiftType = watch(`resources.${index}.shiftType`);
  const watchedDept = watch(`resources.${index}.department`);

  const departments = useMemo(() => Object.keys(groupedDesignations), [groupedDesignations]);
  const availableDesignations = useMemo(() => (watchedDept ? groupedDesignations[watchedDept] || [] : []), [watchedDept, groupedDesignations]);

  return (
    <>
      {/* Main data row */}
      <tr className="hover:bg-page/30 transition-colors border-b border-border">
        <td className="px-1 py-1">
          <select 
            className="form-input !py-1.5 !text-sm w-full min-w-[120px]" 
            {...register(`resources.${index}.department`)} 
            disabled={isLocked}
            onChange={(e) => {
              setValue(`resources.${index}.department`, e.target.value);
              setValue(`resources.${index}.designation`, ''); // Clear designation on dept change
            }}
          >
            <option value="">Select Dept</option>
            {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
          </select>
        </td>
        <td className="px-1 py-1">
          <select 
            className="form-input !py-1.5 !text-sm w-full min-w-[160px]" 
            {...register(`resources.${index}.designation`)} 
            disabled={isLocked || !watchedDept}
          >
            <option value="">Select Designation</option>
            {availableDesignations.map(des => <option key={des} value={des}>{des}</option>)}
          </select>
        </td>
        <td className="px-1 py-1">
          <select className="form-input !py-1.5 !text-sm w-full" {...register(`resources.${index}.unitType`)} disabled={isLocked}>
            <option>Manpower</option><option>Duty</option><option>Visit</option><option>Days</option><option>Actuals</option><option>Lumpsum</option>
          </select>
        </td>
        <td className="px-1 py-1">
          <input className="form-input !py-1.5 !text-sm text-center w-full" type="number" {...register(`resources.${index}.quantity`)} disabled={isLocked} />
        </td>
        <td className="px-1 py-1">
          <input className="form-input !py-1.5 !text-sm text-center w-full" type="number" {...register(`resources.${index}.billingRate`)} disabled={isLocked} />
        </td>
        <td className="px-1 py-1">
          <select className="form-input !py-1.5 !text-sm w-full" {...register(`resources.${index}.billingModel`)} disabled={isLocked}>
            <option>Per Month</option><option>Per Day</option><option>Per Hour</option><option>Lumpsum</option>
          </select>
        </td>
        <td className="px-3 py-1 text-right font-semibold text-sm whitespace-nowrap">{fmt(total)}</td>
        <td className="px-1 py-1 text-center">
          <div className="flex items-center gap-0.5">
            <button type="button" title="Configure policies" onClick={() => setExpanded(!expanded)}
              className={`p-1 rounded transition-colors ${expanded ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100 text-gray-400'}`}>
              <Settings className="h-4 w-4" />
            </button>
            {!isLocked && (
              <button type="button" onClick={() => remove(index)} className="p-1 hover:bg-red-50 rounded transition-colors">
                <Trash2 className="h-4 w-4 text-red-400 hover:text-red-600" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expandable policy section */}
      {expanded && (
        <tr className="bg-gray-50/70">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
              {/* Column 1: Working Hours & Shifts */}
              <div className="space-y-3 p-3 bg-white rounded-lg border border-border">
                <h5 className="font-semibold text-xs uppercase text-muted tracking-wide">Working Hours & Shifts</h5>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted">Start Time</label>
                    <input type="time" className="form-input !py-1 !text-sm w-full mt-0.5" {...register(`resources.${index}.workingHoursStart`)} disabled={isLocked} />
                  </div>
                  <div>
                    <label className="text-xs text-muted">End Time</label>
                    <input type="time" className="form-input !py-1 !text-sm w-full mt-0.5" {...register(`resources.${index}.workingHoursEnd`)} disabled={isLocked} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted">Shift Type</label>
                  <select className="form-input !py-1 !text-sm w-full mt-0.5" {...register(`resources.${index}.shiftType`)} disabled={isLocked}>
                    <option>General</option><option>1st Shift</option><option>2nd Shift</option><option>3rd Shift</option><option>4th Shift</option>
                  </select>
                </div>
                <Controller control={control} name={`resources.${index}.openShiftAllowed`}
                  render={({ field }) => <ToggleSwitch id={`open-shift-${index}`} label="Open Shift Allowed" checked={!!field.value} onChange={field.onChange} disabled={isLocked} />} />

                {/* Multiple shift timings */}
                {shifts.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs text-muted font-medium">Shift Schedule</label>
                    {shifts.map((_, si) => (
                      <div key={si} className="grid grid-cols-3 gap-1.5 items-end">
                        <div>
                          <input className="form-input !py-1 !text-xs w-full" {...register(`resources.${index}.shifts.${si}.name`)} placeholder="Name" disabled={isLocked} />
                        </div>
                        <div>
                          <input type="time" className="form-input !py-1 !text-xs w-full" {...register(`resources.${index}.shifts.${si}.startTime`)} disabled={isLocked} />
                        </div>
                        <div>
                          <input type="time" className="form-input !py-1 !text-xs w-full" {...register(`resources.${index}.shifts.${si}.endTime`)} disabled={isLocked} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isLocked && (
                  <Controller control={control} name={`resources.${index}.shifts`}
                    render={({ field }) => (
                      <button type="button" className="text-xs text-green-700 hover:text-green-800 font-medium"
                        onClick={() => field.onChange([...(field.value || []), { name: `Shift ${(field.value?.length || 0) + 1}`, startTime: '08:00', endTime: '16:00' }])}>
                        + Add Shift Timing
                      </button>
                    )} />
                )}
              </div>

              {/* Column 2: Leave, Weekly Off, Holiday */}
              <div className="space-y-3 p-3 bg-white rounded-lg border border-border">
                <h5 className="font-semibold text-xs uppercase text-muted tracking-wide">Leave & Holiday</h5>
                <Controller control={control} name={`resources.${index}.weeklyOffApplicable`}
                  render={({ field }) => <ToggleSwitch id={`woff-${index}`} label="Weekly Off Applicable" checked={!!field.value} onChange={field.onChange} disabled={isLocked} />} />
                <Controller control={control} name={`resources.${index}.leaveApplicable`}
                  render={({ field }) => <ToggleSwitch id={`leave-${index}`} label="Leave Applicable" checked={!!field.value} onChange={field.onChange} disabled={isLocked} />} />
                {watch(`resources.${index}.leaveApplicable`) && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted">Earned Leave</label>
                      <input type="number" className="form-input !py-1 !text-sm w-full mt-0.5" {...register(`resources.${index}.earnedLeaveCount`)} placeholder="EL/yr" disabled={isLocked} />
                    </div>
                    <div>
                      <label className="text-xs text-muted">Sick Leave</label>
                      <input type="number" className="form-input !py-1 !text-sm w-full mt-0.5" {...register(`resources.${index}.sickLeaveCount`)} placeholder="SL/yr" disabled={isLocked} />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted">Holiday Billing Rule</label>
                  <textarea className="form-input !py-1 !text-sm w-full mt-0.5" rows={2} {...register(`resources.${index}.holidayBillingRule`)} disabled={isLocked}
                    placeholder="e.g. Billable if worked on Holiday, additional duty carry forward" />
                </div>
                <div>
                  <label className="text-xs text-muted">Holiday Payment Rule</label>
                  <textarea className="form-input !py-1 !text-sm w-full mt-0.5" rows={2} {...register(`resources.${index}.holidayPaymentRule`)} disabled={isLocked}
                    placeholder="e.g. Pay OT if worked, Compensate in coming month" />
                </div>
              </div>

              {/* Column 3: Duty, Uniform, Verifications */}
              <div className="space-y-3 p-3 bg-white rounded-lg border border-border">
                <h5 className="font-semibold text-xs uppercase text-muted tracking-wide">Duty, Uniform & Compliance</h5>
                <div>
                  <label className="text-xs text-muted">Duty Rule</label>
                  <textarea className="form-input !py-1 !text-sm w-full mt-0.5" rows={2} {...register(`resources.${index}.dutyRule`)} disabled={isLocked}
                    placeholder="e.g. Work for 2-3 hrs max 4 hrs, claim 1 duty" />
                </div>
                <Controller control={control} name={`resources.${index}.uniformDeduction`}
                  render={({ field }) => <ToggleSwitch id={`uniform-${index}`} label="Uniform Deduction" checked={!!field.value} onChange={field.onChange} disabled={isLocked} />} />
                {watch(`resources.${index}.uniformDeduction`) && (
                  <div>
                    <label className="text-xs text-muted">Deduction Note</label>
                    <input className="form-input !py-1 !text-sm w-full mt-0.5" {...register(`resources.${index}.uniformDeductionNote`)} disabled={isLocked}
                      placeholder="e.g. During PNF, based on months worked" />
                  </div>
                )}
                <div className="border-t border-border pt-2 space-y-1.5">
                  <h6 className="font-medium text-xs text-muted">Verifications</h6>
                  <Controller control={control} name={`resources.${index}.employmentVerification`}
                    render={({ field }) => <ToggleSwitch id={`emp-v-${index}`} label="Employment Verification" checked={!!field.value} onChange={field.onChange} disabled={isLocked} />} />
                  <Controller control={control} name={`resources.${index}.backgroundVerification`}
                    render={({ field }) => <ToggleSwitch id={`bg-v-${index}`} label="Background Verification" checked={!!field.value} onChange={field.onChange} disabled={isLocked} />} />
                  <Controller control={control} name={`resources.${index}.policeVerification`}
                    render={({ field }) => <ToggleSwitch id={`police-v-${index}`} label="Police Verification" checked={!!field.value} onChange={field.onChange} disabled={isLocked} />} />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ============ MAIN COMPONENT ============
const CostingResourceConfig: React.FC<{ sites?: any[] }> = ({ sites: externalSites }) => {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [sites, setSites] = useState<any[]>(externalSites || []);
  const [configs, setConfigs] = useState<SiteCostingMaster[]>([]);
  const [allDesignations, setAllDesignations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const { register, control, handleSubmit, watch, setValue, reset, getValues } = useForm<SiteCostingMaster>({ defaultValues: EMPTY_CONFIG });
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'resources' });

  const watchedResources = watch('resources');
  const watchedAdminPercent = watch('adminChargePercent');
  const watchedAdminApplicable = watch('adminChargeApplicable');
  const watchedCharges = watch('additionalCharges');
  const watchedStatus = watch('status');
  const watchedSiteId = watch('siteId');
  const watchedBillingModel = watch('billingModel');
  const isLocked = watchedStatus === 'Approved';

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [configsData, designationsData] = await Promise.all([
          api.getSiteCostingConfigs().catch(() => []),
          api.getSiteStaffDesignations().catch(() => []),
        ]);
        if (externalSites) setSites(externalSites);
        else {
           // Fallback only if no prop
           const sitesData = await api.getOrganizations();
           setSites(sitesData);
        }
        setConfigs(configsData);
        setAllDesignations(designationsData);
      } catch {
        setToast({ message: 'Failed to load configuration data.', type: 'error' });
      } finally { setIsLoading(false); }
    })();
  }, [externalSites]);

  // Group designations by department for dropdowns
  const groupedDesignations = useMemo(() => {
    return allDesignations.reduce((acc, curr) => {
      const dept = curr.department || 'Uncategorized';
      if (!acc[dept]) acc[dept] = [];
      if (curr.designation) acc[dept].push(curr.designation);
      return acc;
    }, {} as Record<string, string[]>);
  }, [allDesignations]);

  // ---- Calculations ----
  const { resourceSubtotal, chargesTotal, adminAmount, grandTotal } = useMemo(() => {
    const res = Array.isArray(watchedResources) ? watchedResources : [];
    const chg = Array.isArray(watchedCharges) ? watchedCharges : [];
    const resSub = res.reduce((s, r) => s + calcResourceTotal(r), 0);
    const chgTot = chg.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const sub = resSub + chgTot;
    const adm = watchedAdminApplicable ? (sub * ((Number(watchedAdminPercent) || 0) / 100)) : 0;
    return { resourceSubtotal: resSub, chargesTotal: chgTot, adminAmount: adm, grandTotal: sub + adm };
  }, [watchedResources, watchedCharges, watchedAdminPercent, watchedAdminApplicable]);

  // ---- Handlers ----
  const handleNewConfig = () => { reset(EMPTY_CONFIG); setView('editor'); };
  const handleEditConfig = (c: SiteCostingMaster) => { reset({ ...EMPTY_CONFIG, ...c }); setView('editor'); };

  const handleCloneConfig = async (cfg: SiteCostingMaster) => {
    try {
      setIsLoading(true);
      if (cfg.id && !cfg.id.startsWith('new_')) { await api.cloneSiteCostingConfig(cfg.id); }
      else { reset({ ...cfg, id: `new_${Date.now()}`, versionNo: (cfg.versionNo || 1) + 1, status: 'Draft' }); setView('editor'); return; }
      setConfigs(await api.getSiteCostingConfigs().catch(() => []));
      setToast({ message: 'Configuration cloned.', type: 'success' });
    } catch { setToast({ message: 'Failed to clone.', type: 'error' }); }
    finally { setIsLoading(false); }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Delete this configuration?')) return;
    try { await api.deleteSiteCostingConfig(id); setConfigs(p => p.filter(c => c.id !== id)); setToast({ message: 'Deleted.', type: 'success' }); }
    catch { setToast({ message: 'Failed to delete.', type: 'error' }); }
  };

  const handleAddResource = () => append(makeDefaultResource());
  const handleCopyLastRow = () => {
    const res = getValues('resources');
    if (res.length > 0) { const last = res[res.length - 1]; append({ ...last, id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }); }
    else handleAddResource();
  };

  const handleAddCharge = () => {
    const cur = getValues('additionalCharges') || [];
    setValue('additionalCharges', [...cur, { id: `chg_${Date.now()}`, chargeName: '', chargeType: 'Fixed', amount: 0, frequency: 'Monthly' }]);
  };
  const handleRemoveCharge = (i: number) => {
    const cur = getValues('additionalCharges') || [];
    setValue('additionalCharges', cur.filter((_, idx) => idx !== i));
  };

  const handleLoadManpower = async () => {
    if (!watchedSiteId) return;
    try {
      setIsLoading(true);
      const details = await api.getManpowerDetails(watchedSiteId);
      const resources: CostingResourceType[] = details.filter((d: any) => d.count > 0).map((d: any) => ({
        ...makeDefaultResource(),
        id: `res_${d.designation.replace(/\s/g, '_')}_${Date.now()}`,
        designation: d.designation,
        quantity: d.count,
      }));
      replace(resources);
      setToast({ message: `Loaded ${resources.length} resources.`, type: 'info' });
    } catch { setToast({ message: 'Failed to load manpower.', type: 'error' }); }
    finally { setIsLoading(false); }
  };

  const onSubmit = async (data: SiteCostingMaster) => {
    if (!data.siteId) { setToast({ message: 'Please select a site.', type: 'error' }); return; }
    setIsSaving(true);
    try {
      const site = sites.find(s => s.id === data.siteId);
      await api.saveSiteCostingConfig({ ...data, siteName: site?.name || site?.shortName || '' });
      setConfigs(await api.getSiteCostingConfigs().catch(() => []));
      setToast({ message: 'Configuration saved!', type: 'success' });
      setView('dashboard');
    } catch (err: any) { setToast({ message: err?.message || 'Save failed.', type: 'error' }); }
    finally { setIsSaving(false); }
  };

  // ============ RENDER: DASHBOARD ============
  const renderDashboard = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h3 className="text-xl font-semibold text-primary-text">Costing & Resource Configuration</h3>
        <Button onClick={handleNewConfig} style={{ backgroundColor: '#006B3F', color: '#FFF', borderColor: '#005632' }}
          className="border hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all">
          <Plus className="mr-2 h-4 w-4" /> New Configuration
        </Button>
      </div>
      {configs.length === 0 ? (
        <div className="text-center p-12 text-muted bg-page rounded-xl border border-border">
          <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No configurations yet</p>
          <p className="text-sm mt-1">Click "New Configuration" to create your first site costing setup.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-page">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Site</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Ver</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Resources</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {configs.map(cfg => (
                <tr key={cfg.id} className="hover:bg-page/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{cfg.siteName || 'Unnamed'}</td>
                  <td className="px-4 py-3">
                    {cfg.status === 'Approved'
                      ? <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold bg-green-50 px-2 py-1 rounded-full"><CheckCircle className="h-3 w-3" /> Approved</span>
                      : <span className="inline-flex items-center gap-1 text-yellow-600 text-xs font-semibold bg-yellow-50 px-2 py-1 rounded-full"><AlertCircle className="h-3 w-3" /> Draft</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">v{cfg.versionNo || 1}</td>
                  <td className="px-4 py-3 text-sm">{cfg.resources?.length || 0} roles</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleEditConfig(cfg)} title="Edit"><Edit className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => handleCloneConfig(cfg)} title="Clone"><Copy className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteConfig(cfg.id)} title="Delete" className="hover:!border-red-300 hover:!text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ============ RENDER: EDITOR ============
  const renderEditor = () => (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="icon" onClick={() => setView('dashboard')}><ArrowLeft className="h-5 w-5" /></Button>
          <h3 className="text-xl font-semibold text-primary-text">
            Costing Configuration
          </h3>
          {isLocked && <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold bg-green-50 px-2 py-1 rounded-full"><Lock className="h-3 w-3" /> Locked</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={() => setValue('status', isLocked ? 'Draft' : 'Approved')}>
            {isLocked ? <><Unlock className="h-4 w-4 mr-1" /> Unlock</> : <><Lock className="h-4 w-4 mr-1" /> Lock</>}
          </Button>
          <Button type="submit" disabled={isSaving || isLocked} style={{ backgroundColor: '#006B3F', color: '#FFF' }} className="border hover:opacity-90 text-white">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save
          </Button>
        </div>
      </div>

      {/* Site selection */}
      <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select label="Site *" id="costing-site" {...register('siteId', { required: true })} disabled={isLocked}>
            <option value="">Select a Site</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name || s.shortName}</option>)}
          </Select>
          <Input label="Effective From" id="eff-from" type="date" {...register('effectiveFrom')} disabled={isLocked} />
          <Input label="Effective To" id="eff-to" type="date" {...register('effectiveTo')} disabled={isLocked} />
          <Select label="Billing Model" id="bill-model" {...register('billingModel')} disabled={isLocked}>
            <option>Per Month</option><option>Per Day</option><option>Per Hour</option>
          </Select>
          {watchedBillingModel === 'Per Month' && (
            <Input 
              label="Billing Cycle (Day)" 
              id="bill-cycle-day" 
              type="number" 
              min={1} 
              max={31} 
              {...register('billingCycleDay', { min: 1, max: 31 })} 
              disabled={isLocked} 
              placeholder="1-31"
            />
          )}
        </div>
      </div>

      {/* Resource Grid + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <h4 className="text-lg font-semibold text-primary-text">Resources</h4>
            <div className="flex items-center gap-2 flex-wrap">
              {watchedSiteId && !isLocked && (
                <Button type="button" variant="outline" size="sm" onClick={handleLoadManpower}> Load Manpower</Button>
              )}
            </div>
          </div>

          {/* Table */}
          {fields.length > 0 ? (
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-page">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted uppercase">Dept</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted uppercase">Designation / Desc.</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted uppercase w-36">Units</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted uppercase w-24">Qty</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted uppercase w-32">Rate</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted uppercase w-36">Model</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted uppercase w-40">Total</th>
                    <th className="px-3 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="bg-card">
                  {fields.map((field, index) => {
                    const resource = watchedResources?.[index];
                    const rowTotal = resource ? calcResourceTotal(resource) : 0;
                    return (
                      <ResourceRow key={field.id} index={index} register={register} control={control} watch={watch}
                        remove={remove} isLocked={isLocked} total={rowTotal} groupedDesignations={groupedDesignations} setValue={setValue} />
                    );
                  })}
                </tbody>
                <tfoot className="bg-page font-semibold">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-right text-sm">SUB TOTAL</td>
                    <td className="px-3 py-2 text-right text-sm">{fmt(resourceSubtotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center p-8 text-muted bg-page rounded-xl border border-border">
              Load manpower, import CSV, or click "Add Resource" to begin.
            </div>
          )}

          {/* Add row buttons */}
          {!isLocked && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleAddResource} size="sm"><Plus className="mr-1 h-4 w-4" /> Add Resource</Button>
              {fields.length > 0 && <Button type="button" variant="outline" onClick={handleCopyLastRow} size="sm"><Copy className="mr-1 h-4 w-4" /> Copy Last Row</Button>}
            </div>
          )}

          {/* Additional Charges */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-primary-text uppercase tracking-wide">Additional Charges</h4>
              {!isLocked && (
                <button type="button" onClick={handleAddCharge} className="text-xs text-green-700 hover:text-green-800 font-medium">+ Add Charge</button>
              )}
            </div>
            {(watchedCharges || []).map((charge, idx) => (
              <div key={charge.id || idx} className="flex items-end gap-2 p-2 bg-page rounded-lg border border-border">
                <div className="flex-1"><Input label="Name" id={`chg-n-${idx}`} {...register(`additionalCharges.${idx}.chargeName`)} disabled={isLocked} /></div>
                <div className="w-24"><Input label="Qty" id={`chg-q-${idx}`} type="number" {...register(`additionalCharges.${idx}.frequency`)} disabled={isLocked} /></div>
                <div className="w-24"><Input label="Rate" id={`chg-r-${idx}`} type="number" {...register(`additionalCharges.${idx}.amount`)} disabled={isLocked} /></div>
                {!isLocked && <button type="button" onClick={() => handleRemoveCharge(idx)} className="p-1 mb-1"><Trash2 className="h-4 w-4 text-red-400" /></button>}
              </div>
            ))}
          </div>
        </div>

        {/* Summary panel */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-xl p-4 lg:sticky lg:top-4 space-y-3">
            <h4 className="font-semibold text-primary-text text-sm uppercase tracking-wide">Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Resources ({fields.length})</span><span className="font-medium">{fmt(resourceSubtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Add. Charges</span><span className="font-medium">{fmt(chargesTotal)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-muted">Subtotal</span><span className="font-semibold">{fmt(resourceSubtotal + chargesTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Controller control={control} name="adminChargeApplicable"
                    render={({ field }) => (
                      <div className="scale-75 origin-left -mr-3">
                        <ToggleSwitch id="admin-fee-toggle" label="" checked={!!field.value} onChange={field.onChange} disabled={isLocked} />
                      </div>
                    )} />
                  <span className="text-muted">Admin</span>
                  <input type="number" className="form-input !py-0.5 !px-1 !text-xs w-12 text-center" {...register('adminChargePercent')} disabled={isLocked || !watchedAdminApplicable} />
                  <span className="text-muted text-xs">%</span>
                </div>
                <span className="font-medium">{fmt(adminAmount)}</span>
              </div>
              <div className="border-t-2 border-primary-text pt-2 flex justify-between">
                <span className="font-bold text-base">Grand Total</span>
                <span className="font-bold text-base" style={{ color: '#006B3F' }}>{fmt(grandTotal)}</span>
              </div>
            </div>
            <p className="text-xs text-muted italic mt-2">Click ⚙️ on any resource row to configure its policies.</p>
          </div>
        </div>
      </div>
    </form>
  );

  // ============ MAIN RENDER ============
  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      {isLoading && view === 'dashboard' ? (
        <div className="flex items-center justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      ) : view === 'dashboard' ? renderDashboard() : renderEditor()}
    </div>
  );
};

export default CostingResourceConfig;