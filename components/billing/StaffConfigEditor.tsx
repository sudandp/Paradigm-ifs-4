import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Loader2, History, IndianRupee, Calculator } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { api } from '../../services/api';
import { calculatePerDayRate, SiteStaffConfig } from '../../utils/siteStaffCalculations';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';

interface StaffConfigEditorProps {
  userId: string;
  employeeName: string;
  siteName: string;
  existingConfig: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const StaffConfigEditor: React.FC<StaffConfigEditorProps> = ({
  userId, employeeName, siteName, existingConfig, onClose, onSaved
}) => {
  const currentUser = useAuthStore(s => s.user);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [changeReason, setChangeReason] = useState('');

  const [form, setForm] = useState({
    ctcPerMonth: existingConfig?.ctcPerMonth ?? 0,
    weeklyOffsPerWeek: existingConfig?.weeklyOffsPerWeek ?? 1,
    earnedLeavesPerAnnum: existingConfig?.earnedLeavesPerAnnum ?? 0,
    nfhPerAnnum: existingConfig?.nfhPerAnnum ?? 12,
    nhBillingConfig: existingConfig?.nhBillingConfig ?? 'Actuals',
    nhSalaryConfig: existingConfig?.nhSalaryConfig ?? 'Double',
    shift: existingConfig?.shift ?? 'A',
    shiftHours: existingConfig?.shiftHours ?? 8,
    rateEffectiveDate: existingConfig?.rateEffectiveDate ?? new Date().toISOString().split('T')[0],
  });

  // Auto-calculate rate preview
  const ratePreview = useMemo(() => {
    if (!form.ctcPerMonth || form.ctcPerMonth <= 0) {
      return { perAnnumRate: 0, billableDutiesInYear: 0, perDayBillingRate: 0 };
    }
    const calcConfig: SiteStaffConfig = {
      userId,
      ctcPerMonth: Number(form.ctcPerMonth),
      weeklyOffsPerWeek: Number(form.weeklyOffsPerWeek),
      earnedLeavesPerAnnum: Number(form.earnedLeavesPerAnnum),
      nfhPerAnnum: Number(form.nfhPerAnnum),
      nhBillingConfig: form.nhBillingConfig as any,
      nhSalaryConfig: form.nhSalaryConfig as any,
      shift: form.shift,
      shiftHours: Number(form.shiftHours),
    };
    return calculatePerDayRate(calcConfig);
  }, [form, userId]);

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const loadHistory = async () => {
    setLogsLoading(true);
    try {
      const data = await api.getSiteStaffRateLogs(userId);
      setLogs(data);
    } catch { /* ignore */ }
    finally { setLogsLoading(false); }
  };

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory]);

  const handleSave = async () => {
    if (form.ctcPerMonth <= 0) return;
    setIsSaving(true);
    try {
      const configToSave = {
        userId,
        ctcPerMonth: Number(form.ctcPerMonth),
        weeklyOffsPerWeek: Number(form.weeklyOffsPerWeek),
        earnedLeavesPerAnnum: Number(form.earnedLeavesPerAnnum),
        nfhPerAnnum: Number(form.nfhPerAnnum),
        nhBillingConfig: form.nhBillingConfig,
        nhSalaryConfig: form.nhSalaryConfig,
        shift: form.shift,
        shiftHours: Number(form.shiftHours),
        perDayBillingRate: Number(ratePreview.perDayBillingRate.toFixed(2)),
        rateEffectiveDate: form.rateEffectiveDate,
        perAnnumRate: ratePreview.perAnnumRate,
        billableDutiesInYear: Number(ratePreview.billableDutiesInYear.toFixed(2)),
      };

      await api.saveSiteStaffConfig(configToSave);

      // Log the change
      await api.saveSiteStaffRateLog({
        userId,
        ctcPerMonth: configToSave.ctcPerMonth,
        weeklyOffsPerWeek: configToSave.weeklyOffsPerWeek,
        earnedLeavesPerAnnum: configToSave.earnedLeavesPerAnnum,
        nfhPerAnnum: configToSave.nfhPerAnnum,
        nhBillingConfig: configToSave.nhBillingConfig,
        nhSalaryConfig: configToSave.nhSalaryConfig,
        shift: configToSave.shift,
        shiftHours: configToSave.shiftHours,
        perDayBillingRate: configToSave.perDayBillingRate,
        rateEffectiveDate: configToSave.rateEffectiveDate,
        perAnnumRate: configToSave.perAnnumRate,
        billableDutiesInYear: configToSave.billableDutiesInYear,
        updatedBy: currentUser?.id || null,
        updatedByName: currentUser?.name || 'System',
      });

      onSaved();
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const fmtCurrency = (v: number) => v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
          <div>
            <h3 className="text-lg font-bold text-primary-text">{employeeName}</h3>
            <p className="text-xs text-muted mt-0.5">{siteName} • Billing Configuration</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-blue-100 text-blue-700' : 'hover:bg-page text-muted'}`}
              title="View History"
            >
              <History className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-page rounded-lg text-muted"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {showHistory ? (
          /* History View */
          <div className="p-5">
            <h4 className="font-semibold text-sm text-primary-text mb-3">Rate Change History</h4>
            {logsLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted text-center p-8">No changes recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {logs.map((log, idx) => (
                  <div key={log.id || idx} className="p-3 bg-page rounded-xl border border-border text-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-primary-text">{log.updatedByName || 'System'}</span>
                      <span className="text-xs text-muted">{log.updatedAt ? format(new Date(log.updatedAt), 'dd MMM yyyy, hh:mm a') : '-'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-muted">CTC:</span> {fmtCurrency(log.ctcPerMonth)}</div>
                      <div><span className="text-muted">WO/Wk:</span> {log.weeklyOffsPerWeek}</div>
                      <div><span className="text-muted">EL/Yr:</span> {log.earnedLeavesPerAnnum}</div>
                      <div><span className="text-muted">NFH:</span> {log.nfhPerAnnum}</div>
                      <div><span className="text-muted">Rate/Day:</span> {fmtCurrency(log.perDayBillingRate)}</div>
                      <div><span className="text-muted">Effective:</span> {log.rateEffectiveDate}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Editor View */
          <div className="p-5 space-y-5">
            {/* Contract Parameters */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="CTC / Month (₹)"
                id={`ctc-${userId}`}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={form.ctcPerMonth || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '').replace(/^0+(?=\d)/, '');
                  handleChange('ctcPerMonth', parseFloat(val) || 0);
                }}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-', ','].includes(e.key)) e.preventDefault();
                }}
                onPaste={(e) => {
                  const paste = e.clipboardData.getData('text');
                  if (!/^[\d.]+$/.test(paste)) e.preventDefault();
                }}
              />
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">Weekly Offs / Week</label>
                <Select
                  id={`wo-${userId}`}
                  value={form.weeklyOffsPerWeek}
                  onChange={(e) => handleChange('weeklyOffsPerWeek', parseFloat(e.target.value))}
                >
                  <option value="0">0 (None)</option>
                  <option value="0.5">0.5 (2/month)</option>
                  <option value="1">1 (4/month)</option>
                  <option value="2">2 (8/month)</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">Earned Leaves / Annum</label>
                <Select
                  id={`el-${userId}`}
                  value={form.earnedLeavesPerAnnum}
                  onChange={(e) => handleChange('earnedLeavesPerAnnum', parseInt(e.target.value))}
                >
                  <option value="0">0</option>
                  <option value="18">18</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">NFH / Annum</label>
                <Select
                  id={`nfh-${userId}`}
                  value={form.nfhPerAnnum}
                  onChange={(e) => handleChange('nfhPerAnnum', parseInt(e.target.value))}
                >
                  <option value="0">0</option>
                  <option value="10">10</option>
                  <option value="12">12</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">NH Billing Config</label>
                <Select
                  id={`nhbill-${userId}`}
                  value={form.nhBillingConfig}
                  onChange={(e) => handleChange('nhBillingConfig', e.target.value)}
                >
                  <option value="NA">NA (Zero addition)</option>
                  <option value="Actuals">Actuals (Single addition)</option>
                  <option value="Double">Double (Double addition)</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">NH Salary Config</label>
                <Select
                  id={`nhsal-${userId}`}
                  value={form.nhSalaryConfig}
                  onChange={(e) => handleChange('nhSalaryConfig', e.target.value)}
                >
                  <option value="NA">NA (Zero addition)</option>
                  <option value="Actuals">Actuals (Single addition)</option>
                  <option value="Double">Double (Double addition)</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">Shift</label>
                <Select
                  id={`shift-${userId}`}
                  value={form.shift}
                  onChange={(e) => handleChange('shift', e.target.value)}
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                  <option value="General">General</option>
                </Select>
              </div>
              <Input
                label="Shift Hours"
                id={`hrs-${userId}`}
                type="number"
                min="1"
                max="24"
                step="any"
                inputMode="decimal"
                value={form.shiftHours}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  const num = parseFloat(val) || 0;
                  handleChange('shiftHours', num > 24 ? 24 : num);
                }}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-', ','].includes(e.key)) e.preventDefault();
                }}
                onPaste={(e) => {
                  const paste = e.clipboardData.getData('text');
                  if (!/^[\d.]+$/.test(paste)) e.preventDefault();
                }}
              />
              <Input
                label="Rate Effective Date"
                id={`effdate-${userId}`}
                type="date"
                value={form.rateEffectiveDate}
                onChange={(e) => handleChange('rateEffectiveDate', e.target.value)}
              />
            </div>

            {/* Live Rate Preview */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4" /> Auto-Calculated Rate Preview
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-emerald-600 mb-0.5">Per Annum Rate</p>
                  <p className="font-bold text-emerald-900">{fmtCurrency(ratePreview.perAnnumRate)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 mb-0.5">Billable Duties / Year</p>
                  <p className="font-bold text-emerald-900">{ratePreview.billableDutiesInYear.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 mb-0.5">Per Day Billing Rate</p>
                  <p className="font-bold text-emerald-900 text-lg">{fmtCurrency(ratePreview.perDayBillingRate)}</p>
                </div>
              </div>

              {/* NH Holiday Calculation Preview */}
              {Number(form.nfhPerAnnum) > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 mb-2">Per Holiday Pay (×{form.nfhPerAnnum} holidays/year)</p>
                  <div className="overflow-hidden rounded-lg border border-emerald-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-emerald-100">
                          <th className="px-2 py-1.5 text-left text-emerald-700 font-semibold">Config</th>
                          <th className="px-2 py-1.5 text-center text-emerald-700 font-semibold">Not Worked</th>
                          <th className="px-2 py-1.5 text-center text-emerald-700 font-semibold">Half Day (½HP)</th>
                          <th className="px-2 py-1.5 text-center text-emerald-700 font-semibold">Full Day (HP)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'NH Billing', config: form.nhBillingConfig },
                          { label: 'NH Salary', config: form.nhSalaryConfig },
                        ].map(({ label, config }) => {
                          const vals = config === 'NA'
                            ? { nw: 0, half: 0.5, full: 1 }
                            : config === 'Actuals'
                              ? { nw: 1, half: 1.5, full: 2 }
                              : { nw: 1, half: 2, full: 3 };
                          const configLabel = config === 'NA' ? 'NA' : config === 'Actuals' ? 'Actuals (1+work)' : 'Double (1+2×work)';
                          return (
                            <tr key={label} className="border-t border-emerald-100">
                              <td className="px-2 py-1.5 text-emerald-800 font-medium">{label} <span className="text-emerald-500 font-normal">({configLabel})</span></td>
                              <td className="px-2 py-1.5 text-center font-bold text-emerald-900">{vals.nw}</td>
                              <td className="px-2 py-1.5 text-center font-bold text-emerald-900">{vals.half}</td>
                              <td className="px-2 py-1.5 text-center font-bold text-emerald-900">{vals.full}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-emerald-500 mt-1.5">
                    {form.nhBillingConfig === 'NA' ? '⚠ NA: Holidays not deducted from billable duties. Pay only for duties performed.' : `✓ ${form.nfhPerAnnum} holidays deducted from billable duties (${ratePreview.billableDutiesInYear.toFixed(0)} days/year).`}
                  </p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || form.ctcPerMonth <= 0}
                style={{ backgroundColor: '#006B3F', color: '#FFF' }}
                className="border hover:opacity-90 text-white"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Configuration
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffConfigEditor;
