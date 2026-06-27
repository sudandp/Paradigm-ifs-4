import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, Zap, Calendar,
  Users, IndianRupee, Clock, CheckCircle, AlertCircle,
  RotateCcw, Info, ChevronDown
} from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Toast from '../ui/Toast';
import { useAutoSiteConfig } from '../../hooks/useAutoSiteConfig';
import type { AutoSiteConfigData, AutoRoleRule } from '../../hooks/useAutoSiteConfig';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AutoSiteConfigProps {
  siteId: string;
  siteName: string;
  siteLocation?: string;
  onClose: () => void;
  onSaved?: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const WEEK_OFF_OPTIONS: AutoRoleRule['weeklyOffDay'][] = [
  'Sunday',
  'Saturday',
  'Sunday+Saturday',
  'Rotational',
];

const PER_DAY_OPTIONS: AutoRoleRule['perDaySalaryFormula'][] = [
  'CTC/26',
  'CTC/30',
  'CTC/25',
  'Custom',
];

const formulaLabel = (f: AutoRoleRule['perDaySalaryFormula'], divisor?: number) => {
  if (f === 'Custom') return `CTC ÷ ${divisor ?? '?'}`;
  return `${f.replace('CTC/', 'CTC ÷ ')}`;
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({
  icon, title, subtitle
}) => (
  <div className="flex items-start gap-3 mb-5">
    <div className="p-2.5 rounded-xl bg-accent/10 text-accent mt-0.5">{icon}</div>
    <div>
      <h3 className="font-bold text-base text-primary-text">{title}</h3>
      {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

// ─── Calculation Preview ──────────────────────────────────────────────────────

const CalcPreview: React.FC<{ config: AutoSiteConfigData }> = ({ config }) => {
  const totalRoles = config.roleRules.filter(r => r.isActive).length;
  const avgEL = totalRoles
    ? Math.round(config.roleRules.filter(r => r.isActive).reduce((s, r) => s + r.earnedLeavePerYear, 0) / totalRoles)
    : config.globalEL;
  const avgCL = totalRoles
    ? Math.round(config.roleRules.filter(r => r.isActive).reduce((s, r) => s + r.casualLeavePerYear, 0) / totalRoles)
    : config.globalCL;

  const cards = [
    {
      label: 'Avg EL / Year',
      value: `${avgEL} days`,
      sub: 'Earned Leave',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
    },
    {
      label: 'Avg CL / Year',
      value: `${avgCL} days`,
      sub: 'Casual Leave',
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200',
    },
    {
      label: 'Active Roles',
      value: `${totalRoles}`,
      sub: 'With rules assigned',
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
    },
    {
      label: 'Per-Day Base',
      value: formulaLabel(config.globalPerDayFormula, config.roleRules[0]?.customDivisor),
      sub: 'Global default formula',
      color: 'text-violet-600',
      bg: 'bg-violet-50 border-violet-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl border p-3.5 ${c.bg}`}>
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted mb-1">{c.sub}</p>
          <p className={`text-xl font-extrabold ${c.color}`}>{c.value}</p>
          <p className="text-[11px] text-muted mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  );
};

// ─── Role Rule Row ────────────────────────────────────────────────────────────

const RoleRuleRow: React.FC<{
  rule: AutoRoleRule;
  index: number;
  onChange: (updated: AutoRoleRule) => void;
  onDelete: () => void;
}> = ({ rule, index, onChange, onDelete }) => {
  const update = (patch: Partial<AutoRoleRule>) => onChange({ ...rule, ...patch });

  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${rule.isActive ? 'border-border bg-card' : 'border-border/40 bg-page/30 opacity-60'}`}>
      {/* Row header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-primary-text">
            {rule.designation || 'New Role'}
          </span>
          {rule.department && (
            <span className="text-[10px] bg-page border border-border px-2 py-0.5 rounded-full text-muted font-medium">
              {rule.department}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => update({ isActive: !rule.isActive })}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
              rule.isActive
                ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                : 'border-border text-muted hover:bg-page'
            }`}
          >
            {rule.isActive ? 'Active' : 'Inactive'}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Designation */}
        <div className="col-span-2 md:col-span-1">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Designation</label>
          <input
            type="text"
            value={rule.designation}
            onChange={e => update({ designation: e.target.value })}
            placeholder="e.g. Security Guard"
            className="w-full form-input text-sm py-1.5"
          />
        </div>

        {/* Department */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Department</label>
          <input
            type="text"
            value={rule.department}
            onChange={e => update({ department: e.target.value })}
            placeholder="e.g. Security"
            className="w-full form-input text-sm py-1.5"
          />
        </div>

        {/* EL */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-1">EL / Year</label>
          <input
            type="number"
            min={0}
            max={365}
            value={rule.earnedLeavePerYear}
            onChange={e => update({ earnedLeavePerYear: Number(e.target.value) })}
            className="w-full form-input text-sm py-1.5"
          />
        </div>

        {/* CL */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-1">CL / Year</label>
          <input
            type="number"
            min={0}
            max={365}
            value={rule.casualLeavePerYear}
            onChange={e => update({ casualLeavePerYear: Number(e.target.value) })}
            className="w-full form-input text-sm py-1.5"
          />
        </div>

        {/* Week Off */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Week Off</label>
          <select
            value={rule.weeklyOffDay}
            onChange={e => update({ weeklyOffDay: e.target.value as AutoRoleRule['weeklyOffDay'] })}
            className="w-full form-select text-sm py-1.5"
          >
            {WEEK_OFF_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* Per-Day Formula */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Per-Day Formula</label>
          <select
            value={rule.perDaySalaryFormula}
            onChange={e => update({ perDaySalaryFormula: e.target.value as AutoRoleRule['perDaySalaryFormula'] })}
            className="w-full form-select text-sm py-1.5"
          >
            {PER_DAY_OPTIONS.map(o => <option key={o} value={o}>{formulaLabel(o)}</option>)}
          </select>
          {rule.perDaySalaryFormula === 'Custom' && (
            <input
              type="number"
              min={1}
              placeholder="Divisor"
              value={rule.customDivisor ?? ''}
              onChange={e => update({ customDivisor: Number(e.target.value) })}
              className="w-full form-input text-sm py-1 mt-1"
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AutoSiteConfig: React.FC<AutoSiteConfigProps> = ({
  siteId,
  siteName,
  siteLocation,
  onClose,
  onSaved,
}) => {
  const { getConfig, saveConfig, resetConfig, makeNewRule, saving } = useAutoSiteConfig();
  const [config, setConfig] = useState<AutoSiteConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    let mounted = true;
    getConfig(siteId, siteName).then(data => {
      if (mounted) {
        setConfig(data);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [siteId, siteName, getConfig]);

  // Sync siteName into config
  useEffect(() => {
    if (config && config.siteName !== siteName) {
      setConfig(prev => prev ? { ...prev, siteName } : prev);
    }
  }, [siteName, config]);

  const updateRule = useCallback((index: number, updated: AutoRoleRule) => {
    setConfig(prev => {
      const rules = [...prev.roleRules];
      rules[index] = updated;
      return { ...prev, roleRules: rules };
    });
  }, []);

  const deleteRule = useCallback((index: number) => {
    setConfig(prev => ({
      ...prev,
      roleRules: prev.roleRules.filter((_, i) => i !== index),
    }));
  }, []);

  const addRule = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      roleRules: [...prev.roleRules, makeNewRule()],
    }));
  }, [makeNewRule]);

  const handleSave = async () => {
    await saveConfig(config);
    setToast({ message: 'Auto configuration saved successfully.', type: 'success' });
    onSaved?.();
  };

  const handleReset = async () => {
    await resetConfig(siteId);
    const refreshed = await getConfig(siteId, siteName);
    setConfig(refreshed);
    setShowResetConfirm(false);
    setToast({ message: 'Configuration reset to defaults.', type: 'success' });
  };

  if (loading || !config) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-page transition-colors text-muted hover:text-primary-text"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-primary-text">{siteName}</h2>
                {siteLocation && (
                  <span className="text-xs bg-page border border-border text-muted px-2 py-0.5 rounded-full font-medium">
                    {siteLocation}
                  </span>
                )}
                {/* Auto mode badge */}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border"
                  style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', border: 'none' }}>
                  <Zap className="h-3 w-3" /> AUTO MODE
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Role-based leave, week-off & salary rules — calculated automatically
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-primary-text border border-border rounded-lg px-3 py-2 hover:bg-page transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            <Button
              onClick={handleSave}
              style={{ backgroundColor: '#006B3F', color: '#fff' }}
              className="flex items-center gap-2 shadow-md hover:opacity-90 transition-all"
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </div>

      {/* Reset confirm overlay */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-50 rounded-xl text-red-500"><AlertCircle className="h-5 w-5" /></div>
              <div>
                <h4 className="font-bold text-primary-text">Reset Configuration?</h4>
                <p className="text-xs text-muted mt-0.5">This will restore all default rules for this site.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
              <Button onClick={handleReset} className="bg-red-500 text-white hover:bg-red-600">Reset</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">

        {/* Info banner */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>Auto Mode</strong> automatically computes EL, CL, weekly-offs and per-day salary for each role at this site.
            Rules you set here override the global defaults. Roles not listed fall back to the site-level defaults below.
          </p>
        </div>

        {/* ── Calculation Preview ─────────────────────────────────────────── */}
        <CalcPreview config={config} />

        {/* ── Site-Level Defaults ─────────────────────────────────────────── */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <SectionHeader
            icon={<Calendar className="h-4 w-4" />}
            title="Site-Level Defaults"
            subtitle="Applied to any role not listed in the role rules below"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Global EL */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Earned Leave / Year
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={config.globalEL}
                  onChange={e => setConfig(p => ({ ...p, globalEL: Number(e.target.value) }))}
                  className="form-input w-full pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">days</span>
              </div>
            </div>

            {/* Global CL */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Casual Leave / Year
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={config.globalCL}
                  onChange={e => setConfig(p => ({ ...p, globalCL: Number(e.target.value) }))}
                  className="form-input w-full pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">days</span>
              </div>
            </div>

            {/* Global Week Off */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">Weekly Off</label>
              <select
                value={config.globalWeeklyOff}
                onChange={e => setConfig(p => ({ ...p, globalWeeklyOff: e.target.value as AutoRoleRule['weeklyOffDay'] }))}
                className="form-select w-full"
              >
                {WEEK_OFF_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* Global Per-Day Formula */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">Per-Day Formula</label>
              <select
                value={config.globalPerDayFormula}
                onChange={e => setConfig(p => ({ ...p, globalPerDayFormula: e.target.value as AutoRoleRule['perDaySalaryFormula'] }))}
                className="form-select w-full"
              >
                {PER_DAY_OPTIONS.map(o => <option key={o} value={o}>{formulaLabel(o)}</option>)}
              </select>
            </div>
          </div>

          {/* Formula legend */}
          <div className="mt-4 p-3 bg-page rounded-xl border border-border">
            <p className="text-[11px] text-muted font-medium">
              <span className="text-primary-text font-bold">Formula examples:</span>{' '}
              CTC÷26 → standard working-day formula &nbsp;|&nbsp;
              CTC÷30 → calendar-day formula &nbsp;|&nbsp;
              CTC÷25 → attendance-based formula &nbsp;|&nbsp;
              Custom → enter your own divisor per role
            </p>
          </div>
        </section>

        {/* ── Role Rules ──────────────────────────────────────────────────── */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-start justify-between mb-5">
            <SectionHeader
              icon={<Users className="h-4 w-4" />}
              title="Role-Specific Rules"
              subtitle="Override defaults for individual designations / departments"
            />
            <Button
              size="sm"
              onClick={addRule}
              style={{ backgroundColor: '#006B3F', color: '#fff' }}
              className="flex items-center gap-2 shadow hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add Role
            </Button>
          </div>

          {config.roleRules.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border/60 rounded-xl">
              <Users className="h-10 w-10 mx-auto mb-3 text-muted/30" />
              <p className="text-sm text-muted font-medium">No role rules yet</p>
              <p className="text-xs text-muted mt-1">Add a role to override site-level defaults</p>
              <button
                onClick={addRule}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
              >
                <Plus className="h-4 w-4" /> Add First Role
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {config.roleRules.map((rule, idx) => (
                <RoleRuleRow
                  key={rule.id}
                  rule={rule}
                  index={idx}
                  onChange={updated => updateRule(idx, updated)}
                  onDelete={() => deleteRule(idx)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Calculation Explanation ─────────────────────────────────────── */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <SectionHeader
            icon={<IndianRupee className="h-4 w-4" />}
            title="How Auto Calculation Works"
            subtitle="Reference guide for the calculation engine"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted">
            <div className="space-y-2">
              <div className="flex gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <p><strong className="text-primary-text">EL Accrual</strong> — Earned Leave accrues monthly (EL per year ÷ 12). Accrued EL can be encashed or carried forward per company policy.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <p><strong className="text-primary-text">CL Pool</strong> — Casual Leave credited at the start of the year. Unused CL lapses at year-end (not carried forward).</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <p><strong className="text-primary-text">Week Off</strong> — Auto-marked in attendance. Employees on Sunday+Saturday get 2 weekly offs per week counted as paid days.</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <p><strong className="text-primary-text">Per-Day Salary</strong> — Computed as: <code className="bg-page px-1 py-0.5 rounded text-primary-text">Gross Monthly CTC ÷ Divisor</code>. Deductions apply on absent days.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <p><strong className="text-primary-text">Holiday Pay</strong> — Derived from Company Holiday Selection config. If a role works on holiday, billing & salary rules from that config apply.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <p><strong className="text-primary-text">Override Priority</strong> — Role-specific rules beat site defaults. Site defaults beat global system defaults.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom save bar */}
        <div className="flex justify-end gap-3 pt-2 pb-8">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            style={{ backgroundColor: '#006B3F', color: '#fff' }}
            className="flex items-center gap-2 shadow-md hover:opacity-90"
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save & Apply Configuration'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AutoSiteConfig;
