import React, { useState, useMemo } from 'react';
import type { StaffAttendanceRules } from '../../types/attendance';
import { DEFAULT_SITE_DEPARTMENTS, WEEKDAYS, SITE_LEAVE_TYPES, generateDeptSlug } from '../../types/siteAttendance';
import type { SiteDepartment, DeptRuleConfig } from '../../types/siteAttendance';
import { Users, Calendar, Clock, Palmtree, ListChecks, BarChart3, ChevronDown, Plus, Trash2, X } from 'lucide-react';

interface SiteAttendanceConfigProps {
  currentRules: StaffAttendanceRules;
  onSettingChange: (setting: keyof StaffAttendanceRules, value: any) => void;
}

const SiteAttendanceConfig: React.FC<SiteAttendanceConfigProps> = ({ currentRules, onSettingChange }) => {
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

  // --- Dynamic Department List ---
  const departments: SiteDepartment[] = useMemo(() => {
    return (currentRules as any).siteDepartments || [];
  }, [(currentRules as any).siteDepartments]);

  // --- Department Rule Configs ---
  const deptConfigs: DeptRuleConfig[] = useMemo(() => {
    return (currentRules as any).deptRuleConfigs || [];
  }, [(currentRules as any).deptRuleConfigs]);

  const getConfig = (deptId: string): DeptRuleConfig => {
    return deptConfigs.find(c => c.deptId === deptId) || { deptId };
  };

  const updateConfig = (deptId: string, patch: Partial<DeptRuleConfig>) => {
    const existing = [...deptConfigs];
    const idx = existing.findIndex(c => c.deptId === deptId);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...patch };
    } else {
      existing.push({ deptId, ...patch });
    }
    onSettingChange('deptRuleConfigs' as any, existing);
  };

  // --- Add / Remove Department ---
  const handleAddDept = () => {
    if (!newDeptName.trim()) return;
    const slug = generateDeptSlug(newDeptName);
    if (departments.some(d => d.id === slug)) return; // already exists

    const shortLabel = newDeptName.trim().substring(0, 5).toUpperCase();
    const updated: SiteDepartment[] = [
      ...departments,
      { id: slug, label: newDeptName.trim(), shortLabel },
    ];
    onSettingChange('siteDepartments' as any, updated);

    // Initialize config with defaults
    updateConfig(slug, {
      weeklyOffDays: currentRules.weeklyOffDays || [0],
      holidayCodeType: 'H',
      leaveTypes: ['S/L', 'C/O', 'OT'],
      deploymentCount: 0,
    });

    setNewDeptName('');
    setShowAddDept(false);
  };

  const handleRemoveDept = (deptId: string) => {
    onSettingChange('siteDepartments' as any, departments.filter(d => d.id !== deptId));
    onSettingChange('deptRuleConfigs' as any, deptConfigs.filter(c => c.deptId !== deptId));
  };

  const handleSeedDefaults = () => {
    onSettingChange('siteDepartments' as any, DEFAULT_SITE_DEPARTMENTS);
    const configs: DeptRuleConfig[] = DEFAULT_SITE_DEPARTMENTS.map(d => ({
      deptId: d.id,
      weeklyOffDays: currentRules.weeklyOffDays || [0],
      holidayCodeType: 'H',
      leaveTypes: d.id === 'admin' ? ['E/L', 'S/L', 'C/O', 'OT'] : ['S/L', 'C/O', 'OT'],
      deploymentCount: 0,
    }));
    onSettingChange('deptRuleConfigs' as any, configs);
  };

  const shifts = currentRules.siteShifts || [];

  // --- No departments configured yet ---
  if (departments.length === 0) {
    return (
      <section className="pt-6 border-t border-border">
        <h3 className="text-lg font-semibold text-primary-text mb-2 flex items-center">
          <Users className="mr-2 h-5 w-5 text-muted" />
          Site Departments
        </h3>
        <p className="text-sm text-muted mb-4">
          Add departments for this site to configure department-level attendance rules.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSeedDefaults}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors border border-accent/20"
          >
            <ListChecks className="h-4 w-4" />
            Load Default Departments (Admin, E&M, HK, Landscaping, Security)
          </button>
          <button
            type="button"
            onClick={() => setShowAddDept(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-primary-text hover:bg-accent/5 transition-colors border border-dashed border-border"
          >
            <Plus className="h-4 w-4" />
            Add Custom Department
          </button>
        </div>
        {showAddDept && (
          <AddDeptInline
            value={newDeptName}
            onChange={setNewDeptName}
            onAdd={handleAddDept}
            onCancel={() => { setShowAddDept(false); setNewDeptName(''); }}
          />
        )}
      </section>
    );
  }

  return (
    <>
      {/* ── Department List + Add ── */}
      <section className="pt-6 border-t border-border">
        <h3 className="text-lg font-semibold text-primary-text mb-2 flex items-center">
          <Users className="mr-2 h-5 w-5 text-muted" />
          Site Departments
        </h3>
        <p className="text-sm text-muted mb-4">
          Departments configured for this site. Rules below apply per department.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {departments.map(dept => (
            <span
              key={dept.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold border border-accent/20"
            >
              {dept.label}
              <button
                type="button"
                onClick={() => handleRemoveDept(dept.id)}
                className="hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-red-500/10"
                title={`Remove ${dept.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {!showAddDept ? (
            <button
              type="button"
              onClick={() => setShowAddDept(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-muted hover:text-accent border border-dashed border-border hover:border-accent/30 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          ) : (
            <AddDeptInline
              value={newDeptName}
              onChange={setNewDeptName}
              onAdd={handleAddDept}
              onCancel={() => { setShowAddDept(false); setNewDeptName(''); }}
            />
          )}
        </div>
      </section>

      {/* ── Deployment + Weekly Offs + Shift (Compact Table) ── */}
      <section className="pt-6 border-t border-border">
        <h3 className="text-lg font-semibold text-primary-text mb-2 flex items-center">
          <BarChart3 className="mr-2 h-5 w-5 text-muted" />
          Department Rules
        </h3>
        <p className="text-sm text-muted mb-4">
          Configure deployment count, weekly offs, shift, and holiday code per department.
        </p>

        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-page">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-primary-text whitespace-nowrap">Department</th>
                <th className="text-center px-3 py-3 font-semibold text-primary-text whitespace-nowrap">Headcount</th>
                <th className="text-center px-3 py-3 font-semibold text-primary-text whitespace-nowrap">Weekly Off</th>
                {shifts.length > 0 && (
                  <th className="text-center px-3 py-3 font-semibold text-primary-text whitespace-nowrap">Default Shift</th>
                )}
                <th className="text-center px-3 py-3 font-semibold text-primary-text whitespace-nowrap">Holiday Code</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(dept => {
                const cfg = getConfig(dept.id);
                const selectedDays = cfg.weeklyOffDays || currentRules.weeklyOffDays || [0];
                return (
                  <tr key={dept.id} className="border-t border-border/50 hover:bg-accent/5 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3 font-medium text-primary-text whitespace-nowrap">{dept.label}</td>

                    {/* Headcount */}
                    <td className="text-center px-3 py-3">
                      <input
                        type="number"
                        min={0}
                        max={999}
                        className="w-16 text-center bg-transparent border border-border/50 rounded-lg px-2 py-1.5 text-sm text-primary-text focus:border-accent focus:outline-none"
                        value={cfg.deploymentCount || 0}
                        onChange={(e) => updateConfig(dept.id, { deploymentCount: parseInt(e.target.value) || 0 })}
                      />
                    </td>

                    {/* Weekly Off Days */}
                    <td className="text-center px-3 py-3">
                      <div className="flex gap-1 justify-center">
                        {WEEKDAYS.map(day => {
                          const isSelected = selectedDays.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => {
                                const updated = isSelected
                                  ? selectedDays.filter((d: number) => d !== day.value)
                                  : [...selectedDays, day.value];
                                updateConfig(dept.id, { weeklyOffDays: updated });
                              }}
                              className={`
                                w-7 h-7 text-[10px] font-bold rounded-md transition-all border
                                ${isSelected
                                  ? 'bg-accent text-white border-accent shadow-sm'
                                  : 'bg-transparent text-muted border-border/40 hover:border-accent/40'
                                }
                              `}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    {/* Shift */}
                    {shifts.length > 0 && (
                      <td className="text-center px-3 py-3">
                        <select
                          className="bg-transparent border border-border/50 rounded-lg px-2 py-1.5 text-sm text-primary-text focus:border-accent focus:outline-none cursor-pointer"
                          value={cfg.shiftId || ''}
                          onChange={(e) => updateConfig(dept.id, { shiftId: e.target.value })}
                        >
                          <option value="">Auto</option>
                          {shifts.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                    )}

                    {/* Holiday Code */}
                    <td className="text-center px-3 py-3">
                      <select
                        className="bg-transparent border border-border/50 rounded-lg px-2 py-1.5 text-sm text-primary-text focus:border-accent focus:outline-none cursor-pointer"
                        value={cfg.holidayCodeType || 'H'}
                        onChange={(e) => updateConfig(dept.id, { holidayCodeType: e.target.value })}
                      >
                        <option value="H">H (Full)</option>
                        <option value="0.5H">0.5H (Half)</option>
                        <option value="O/H">O/H (Surprise)</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Holiday Toggle ── */}
      <section className="pt-6 border-t border-border">
        <h3 className="text-lg font-semibold text-primary-text mb-2 flex items-center">
          <Palmtree className="mr-2 h-5 w-5 text-muted" />
          Holiday Payability
        </h3>
        <label className="inline-flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={(currentRules as any).siteHolidayToggle ?? true}
              onChange={(e) => onSettingChange('siteHolidayToggle' as any, e.target.checked)}
            />
            <div className="w-10 h-5 bg-border/60 rounded-full peer-checked:bg-accent transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5" />
          </div>
          <span className="text-sm font-medium text-primary-text group-hover:text-accent transition-colors">
            Pay holidays for this site
          </span>
        </label>
      </section>

      {/* ── Leave Eligibility Matrix ── */}
      <section className="pt-6 border-t border-border">
        <h3 className="text-lg font-semibold text-primary-text mb-2 flex items-center">
          <ListChecks className="mr-2 h-5 w-5 text-muted" />
          Leave Eligibility by Department
        </h3>
        <p className="text-sm text-muted mb-4">
          Control which leave types each department can use.
        </p>

        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-page">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-primary-text">Department</th>
                {SITE_LEAVE_TYPES.map(lt => (
                  <th key={lt.id} className="text-center px-4 py-3 font-semibold text-primary-text">{lt.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map(dept => {
                const cfg = getConfig(dept.id);
                const deptLeaves = cfg.leaveTypes || ['S/L', 'C/O'];
                return (
                  <tr key={dept.id} className="border-t border-border/50 hover:bg-accent/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-primary-text">{dept.label}</td>
                    {SITE_LEAVE_TYPES.map(lt => (
                      <td key={lt.id} className="text-center px-4 py-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30 cursor-pointer"
                          checked={deptLeaves.includes(lt.id)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...new Set([...deptLeaves, lt.id])]
                              : deptLeaves.filter((l: string) => l !== lt.id);
                            updateConfig(dept.id, { leaveTypes: updated });
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Info ── */}
      <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/15 rounded-lg">
        <p className="text-xs text-blue-600 font-medium">
          <strong>How it works:</strong> When computing attendance, the system checks the department
          rule first (weekly off, shift, holiday code). If no department rule, it falls back to the
          site-wide setting above. Individual staff can further override their weekly off in the staff roster.
        </p>
      </div>
    </>
  );
};

/** Inline mini-form to add a department */
const AddDeptInline: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}> = ({ value, onChange, onAdd, onCancel }) => (
  <div className="inline-flex items-center gap-2 mt-2">
    <input
      type="text"
      autoFocus
      placeholder="Department name..."
      className="border border-border/50 rounded-lg px-3 py-1.5 text-sm text-primary-text bg-transparent focus:border-accent focus:outline-none w-48"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); if (e.key === 'Escape') onCancel(); }}
    />
    <button type="button" onClick={onAdd} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-colors">
      Add
    </button>
    <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-muted text-xs font-bold hover:bg-border/20 transition-colors">
      Cancel
    </button>
  </div>
);

export default SiteAttendanceConfig;
