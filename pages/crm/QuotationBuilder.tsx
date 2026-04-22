import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCrmStore } from '../../store/crmStore';
import { crmApi } from '../../services/crmApi';
import { useAuthStore } from '../../store/authStore';
import type { CrmQuotation, ManpowerLineItem, CrmStatutoryMaster, ManpowerSuggestionInput } from '../../types/crm';
import { MANPOWER_ROLES } from '../../types/crm';
import Toast from '../../components/ui/Toast';
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, Calculator, Zap,
  DollarSign, TrendingUp, FileText, Download, ChevronDown, ChevronUp
} from 'lucide-react';

const fmt = (val: number) => val.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

const QuotationBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id: leadId } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { leads } = useCrmStore();
  const lead = leads.find(l => l.id === leadId);

  const [manpower, setManpower] = useState<ManpowerLineItem[]>([]);
  const [statutory, setStatutory] = useState<CrmStatutoryMaster | null>(null);
  const [statutoryList, setStatutoryList] = useState<CrmStatutoryMaster[]>([]);
  const [consumables, setConsumables] = useState(0);
  const [equipment, setEquipment] = useState(0);
  const [uniform, setUniform] = useState(0);
  const [mgmtFeePercent, setMgmtFeePercent] = useState(10);
  const [gstPercent, setGstPercent] = useState(18);
  const [showStatutory, setShowStatutory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [existingQuotation, setExistingQuotation] = useState<CrmQuotation | null>(null);

  useEffect(() => {
    crmApi.getStatutoryMasters().then(list => {
      setStatutoryList(list);
      if (list.length > 0) setStatutory(list[0]);
    }).catch(() => {});
    if (leadId) {
      crmApi.getQuotations(leadId).then(q => {
        if (q.length > 0) {
          const latest = q[0];
          setExistingQuotation(latest);
          setManpower(latest.manpowerDetails || []);
          setConsumables(latest.consumablesCost);
          setEquipment(latest.equipmentCost);
          setUniform(latest.uniformCost);
          setMgmtFeePercent(latest.managementFeePercent);
          setGstPercent(latest.gstPercent);
        }
      }).catch(() => {});
    }
  }, [leadId]);

  // Auto-suggest manpower
  const handleAutoSuggest = () => {
    if (!lead) { setToast({ message: 'Lead data required for suggestions', type: 'error' }); return; }
    const input: ManpowerSuggestionInput = {
      areaSqft: lead.areaSqft || 50000,
      unitCount: lead.unitCount || 100,
      towerCount: lead.towerCount || 2,
      floorCount: lead.floorCount || 10,
      propertyType: lead.propertyType || 'Residential',
      hasSwimmingPool: false, hasStp: true, hasClubHouse: true,
    };
    const suggestions = crmApi.suggestManpower(input);
    const items: ManpowerLineItem[] = suggestions.map(s => ({
      role: s.role, department: 'Operations', count: s.suggestedCount,
      salary: statutory?.minWages?.[s.role] || statutory?.minWages?.['Unskilled'] || 12000,
      shiftType: 'General', dutyHours: 8, weeklyOff: 'Sunday',
      relieverRequired: s.suggestedCount > 3, experienceRequired: '',
    }));
    setManpower(items);
    setToast({ message: `${items.length} roles suggested based on property data`, type: 'info' });
  };

  const addRow = () => {
    setManpower([...manpower, {
      role: '', department: 'Operations', count: 1, salary: 12000,
      shiftType: 'General', dutyHours: 8, weeklyOff: 'Sunday', relieverRequired: false,
    }]);
  };

  const updateRow = (idx: number, updates: Partial<ManpowerLineItem>) => {
    setManpower(manpower.map((m, i) => i === idx ? { ...m, ...updates } : m));
  };

  const removeRow = (idx: number) => setManpower(manpower.filter((_, i) => i !== idx));

  // Calculations
  const calc = useMemo(() => {
    const totalSalary = manpower.reduce((t, m) => {
      const effectiveCount = m.relieverRequired ? Math.ceil(m.count * 1.17) : m.count;
      return t + (effectiveCount * m.salary);
    }, 0);
    const pfRate = statutory?.pfRate || 12;
    const esiRate = (statutory?.esiEmployerRate || 3.25) + (statutory?.esiEmployeeRate || 0.75);
    const bonusRate = statutory?.bonusRate || 8.33;
    const totalStatutory = totalSalary * ((pfRate + esiRate + bonusRate + (statutory?.gratuityRate || 4.81) + (statutory?.edliRate || 0.5) + (statutory?.adminChargesRate || 0.5)) / 100);
    const subtotal = totalSalary + totalStatutory + consumables + equipment + uniform;
    const mgmtFee = subtotal * (mgmtFeePercent / 100);
    const preGst = subtotal + mgmtFee;
    const gst = preGst * (gstPercent / 100);
    const monthly = preGst + gst;
    const annual = monthly * 12;
    const margin = mgmtFee;
    const marginPct = preGst > 0 ? (margin / preGst) * 100 : 0;
    const totalHeadcount = manpower.reduce((t, m) => t + (m.relieverRequired ? Math.ceil(m.count * 1.17) : m.count), 0);
    return { totalSalary, totalStatutory, subtotal, mgmtFee, preGst, gst, monthly, annual, margin, marginPct, totalHeadcount };
  }, [manpower, statutory, consumables, equipment, uniform, mgmtFeePercent, gstPercent]);

  const handleSave = async (status: string = 'Draft') => {
    if (!leadId) return;
    setIsSaving(true);
    try {
      await crmApi.saveQuotation({
        id: existingQuotation?.id,
        leadId, manpowerDetails: manpower,
        totalSalaryCost: calc.totalSalary, statutoryCost: calc.totalStatutory,
        consumablesCost: consumables, equipmentCost: equipment, uniformCost: uniform,
        adminCharges: 0, managementFee: calc.mgmtFee, managementFeePercent: mgmtFeePercent,
        gstAmount: calc.gst, gstPercent, monthlyCost: calc.monthly, annualCost: calc.annual,
        marginAmount: calc.margin, marginPercent: calc.marginPct, status: status as any,
        createdBy: user?.id,
      });
      setToast({ message: status === 'Sent to Client' ? 'Quotation sent' : 'Quotation saved', type: 'success' });
      if (status === 'Sent to Client') {
        await crmApi.updateLeadStatus(leadId, 'Proposal Sent');
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/crm/leads/${leadId}`)} className="p-2 rounded-lg hover:bg-accent/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-primary-text" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-text">Quotation Builder</h1>
            <p className="text-xs text-muted mt-0.5">{lead?.clientName} • {lead?.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleSave('Draft')} disabled={isSaving} className="px-4 py-2 rounded-lg text-xs font-semibold border border-border text-muted hover:border-accent transition-all flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Save Draft
          </button>
          <button onClick={() => handleSave('Sent to Client')} disabled={isSaving} className="btn btn-primary btn-md gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Send to Client
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-5">

          {/* Manpower Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-page/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-primary-text">Manpower Planning</h3>
              <div className="flex items-center gap-2">
                <button onClick={handleAutoSuggest} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Auto-Suggest
                </button>
                <button onClick={addRow} className="px-3 py-1.5 rounded-lg text-[10px] font-bold border border-border text-muted hover:border-accent transition-colors flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Role
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-page/30">
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-muted uppercase">Role</th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-muted uppercase w-20">Count</th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-muted uppercase w-28">Salary (₹)</th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-muted uppercase w-24">Shift</th>
                    <th className="text-center px-2 py-2 text-[10px] font-bold text-muted uppercase w-20">Reliever</th>
                    <th className="text-right px-3 py-2 text-[10px] font-bold text-muted uppercase w-28">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {manpower.map((row, idx) => {
                    const effectiveCount = row.relieverRequired ? Math.ceil(row.count * 1.17) : row.count;
                    const rowTotal = effectiveCount * row.salary;
                    return (
                      <tr key={idx} className="border-b border-border/30 hover:bg-page/20 transition-colors">
                        <td className="px-2 py-1.5">
                          <select className="form-input !text-xs !py-1.5" value={row.role} onChange={(e) => updateRow(idx, { role: e.target.value })}>
                            <option value="">Select Role</option>
                            {MANPOWER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" className="form-input !text-xs !py-1.5 text-center" value={row.count} onChange={(e) => updateRow(idx, { count: Number(e.target.value) || 0 })} min={0} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" className="form-input !text-xs !py-1.5 text-center" value={row.salary} onChange={(e) => updateRow(idx, { salary: Number(e.target.value) || 0 })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <select className="form-input !text-xs !py-1.5" value={row.shiftType} onChange={(e) => updateRow(idx, { shiftType: e.target.value })}>
                            <option>General</option><option>8hr</option><option>12hr</option><option>Night</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input type="checkbox" checked={row.relieverRequired} onChange={(e) => updateRow(idx, { relieverRequired: e.target.checked })} className="w-4 h-4 rounded border-border text-accent" />
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold text-xs">{fmt(rowTotal)}</td>
                        <td className="px-1 py-1.5">
                          <button onClick={() => removeRow(idx)} className="p-1 hover:bg-red-50 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {manpower.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted text-xs">No manpower added. Use "Auto-Suggest" or "Add Role".</td></tr>
                  )}
                </tbody>
                {manpower.length > 0 && (
                  <tfoot className="bg-page/50 font-semibold">
                    <tr>
                      <td className="px-3 py-2 text-xs">TOTAL</td>
                      <td className="text-center px-2 py-2 text-xs">{calc.totalHeadcount}</td>
                      <td colSpan={3}></td>
                      <td className="px-3 py-2 text-right text-xs">{fmt(calc.totalSalary)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Additional Costs */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-bold text-primary-text mb-3">Additional Costs (Monthly)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Consumables (₹)</label>
                <input type="number" className="form-input" value={consumables} onChange={(e) => setConsumables(Number(e.target.value) || 0)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Equipment (₹)</label>
                <input type="number" className="form-input" value={equipment} onChange={(e) => setEquipment(Number(e.target.value) || 0)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Uniforms (₹)</label>
                <input type="number" className="form-input" value={uniform} onChange={(e) => setUniform(Number(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {/* Statutory Rates */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <button onClick={() => setShowStatutory(!showStatutory)} className="w-full flex items-center justify-between px-4 py-3 bg-page/50 text-left">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold text-primary-text">Statutory Rates</h3>
              </div>
              {showStatutory ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
            </button>
            {showStatutory && statutory && (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in-down">
                {[
                  { label: 'PF Rate', key: 'pfRate' },
                  { label: 'ESI (Employee)', key: 'esiEmployeeRate' },
                  { label: 'ESI (Employer)', key: 'esiEmployerRate' },
                  { label: 'Bonus', key: 'bonusRate' },
                  { label: 'Gratuity', key: 'gratuityRate' },
                  { label: 'EDLI', key: 'edliRate' },
                  { label: 'Admin Charges', key: 'adminChargesRate' },
                ].map(item => (
                  <div key={item.key} className="p-2.5 rounded-lg bg-page/50 border border-border/50">
                    <p className="text-[10px] text-muted font-medium">{item.label}</p>
                    <p className="text-sm font-bold text-primary-text">{(statutory as any)[item.key]}%</p>
                  </div>
                ))}
                <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/20">
                  <p className="text-[10px] text-accent font-medium">Total Statutory</p>
                  <p className="text-sm font-bold text-accent">{fmt(calc.totalStatutory)}/mo</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border border-border p-4 lg:sticky lg:top-4 space-y-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Cost Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Salary ({calc.totalHeadcount} staff)</span><span className="font-medium">{fmt(calc.totalSalary)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Statutory</span><span className="font-medium">{fmt(calc.totalStatutory)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Consumables</span><span className="font-medium">{fmt(consumables)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Equipment</span><span className="font-medium">{fmt(equipment)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Uniforms</span><span className="font-medium">{fmt(uniform)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold">{fmt(calc.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <span className="text-muted">Mgmt Fee</span>
                  <input type="number" className="form-input !py-0.5 !px-1 !text-xs w-12 text-center" value={mgmtFeePercent} onChange={(e) => setMgmtFeePercent(Number(e.target.value) || 0)} />
                  <span className="text-muted text-xs">%</span>
                </div>
                <span className="font-medium">{fmt(calc.mgmtFee)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <span className="text-muted">GST</span>
                  <input type="number" className="form-input !py-0.5 !px-1 !text-xs w-12 text-center" value={gstPercent} onChange={(e) => setGstPercent(Number(e.target.value) || 0)} />
                  <span className="text-muted text-xs">%</span>
                </div>
                <span className="font-medium">{fmt(calc.gst)}</span>
              </div>
              <div className="border-t-2 border-primary-text pt-2 flex justify-between">
                <span className="font-bold text-base">Monthly</span>
                <span className="font-bold text-base" style={{ color: '#006B3F' }}>{fmt(calc.monthly)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-sm text-muted">Annual</span>
                <span className="font-bold text-sm" style={{ color: '#006B3F' }}>{fmt(calc.annual)}</span>
              </div>
            </div>
            {/* Margin */}
            <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-green-700" />
                <span className="text-[10px] font-bold text-green-700 uppercase">Margin</span>
              </div>
              <p className="text-lg font-bold text-green-800">{fmt(calc.margin)}<span className="text-xs font-normal text-green-600 ml-1">({calc.marginPct.toFixed(1)}%)</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationBuilder;
