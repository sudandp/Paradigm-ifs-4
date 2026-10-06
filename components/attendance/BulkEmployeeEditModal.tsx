import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Building2,
  Clock,
  Layers,
  Briefcase,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Users,
  CheckSquare,
  Square,
  Sparkles
} from 'lucide-react';
import {
  saveBulkCorrectionsToSupabase,
  bulkUpdateMssqlEmployees,
  AttendanceCorrectionRecord,
  BulkEmployeeUpdatePayload
} from '../../services/accessControlSupabase';
import { DepartmentKey } from '../../utils/departmentMapping';

interface SelectedEmpItem {
  empCode: string;
  empName: string;
  department?: string;
  designation?: string;
  shiftName?: string;
  company?: string;
}

interface BulkEmployeeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEmployees: SelectedEmpItem[];
  availableSites: string[];
  selectedDate: string;
  currentUserEmail: string;
  onSuccess: (updatedOverrides: Record<string, any>) => void;
}

const COMMON_DEPARTMENTS: Array<{ key: DepartmentKey; label: string; icon: string }> = [
  { key: 'mep', label: 'MEP & Technical', icon: '⚡' },
  { key: 'housekeeping', label: 'Housekeeping', icon: '🧹' },
  { key: 'garden', label: 'Garden & Landscape', icon: '🌿' },
  { key: 'security', label: 'Security & Guarding', icon: '🛡️' },
  { key: 'administration', label: 'Administration / Front Desk', icon: '🏢' },
  { key: 'other', label: 'Other / Pest / General', icon: '📦' },
];

const COMMON_SHIFTS = [
  'General Shift Group',
  'A Shift Group',
  'B Shift Group',
  'C Shift Group (Night)',
  'A + B Shift Group',
  'B + C Shift Group',
  'A + C Shift Group',
  'HK Morning Shift',
  'HK General Shift',
  'Garden Shift Group',
  'Security Day Duty (12h)',
  'Security Night Duty (12h)',
];

const COMMON_DESIGNATIONS = [
  'Electrician',
  'Plumber',
  'Multi Skilled Technician (MST)',
  'Technical Supervisor',
  'Housekeeping Staff',
  'Housekeeping Supervisor',
  'Garden Staff',
  'Security Guard',
  'Head Guard',
  'Security Supervisor',
  'Facility Executive',
  'Assistant Facility Manager',
  'Facility Manager',
  'Staff',
];

const COMMON_COMPANIES = [
  'Paradigm Services',
  'PIFS',
  'Southwall Security LLP'
];

export const BulkEmployeeEditModal: React.FC<BulkEmployeeEditModalProps> = ({
  isOpen,
  onClose,
  selectedEmployees,
  availableSites,
  selectedDate,
  currentUserEmail,
  onSuccess,
}) => {
  const [applySite, setApplySite] = useState(true);
  const [targetSite, setTargetSite] = useState('Parkwest');
  const [customSite, setCustomSite] = useState('');

  const [applyDept, setApplyDept] = useState(false);
  const [targetDept, setTargetDept] = useState<DepartmentKey | ''>('housekeeping');

  const [applyDesig, setApplyDesig] = useState(false);
  const [targetDesig, setTargetDesig] = useState('Housekeeping Staff');
  const [customDesig, setCustomDesig] = useState('');

  const [applyShift, setApplyShift] = useState(false);
  const [targetShift, setTargetShift] = useState('General Shift Group');

  const [applyCompany, setApplyCompany] = useState(false);
  const [targetCompany, setTargetCompany] = useState('Paradigm Services');

  const [syncToEssl, setSyncToEssl] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const count = selectedEmployees.length;
  const effectiveSite = targetSite === '__custom__' ? customSite.trim() : targetSite;
  const effectiveDesig = targetDesig === '__custom__' ? customDesig.trim() : targetDesig;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (count === 0) return;

    if (!applySite && !applyDept && !applyDesig && !applyShift && !applyCompany) {
      setErrorMessage('Please select at least one field to update.');
      return;
    }

    if (applySite && !effectiveSite) {
      setErrorMessage('Please provide a valid Site Name.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setProgressStatus(`Preparing bulk updates for ${count} employees...`);

    try {
      const now = new Date().toISOString();
      const updatedOverrides: Record<string, any> = {};
      const corrections: AttendanceCorrectionRecord[] = [];
      const mssqlUpdates: BulkEmployeeUpdatePayload[] = [];

      for (const emp of selectedEmployees) {
        const empCode = String(emp.empCode).trim();
        const empName = emp.empName || `Staff ${empCode}`;

        const overrideEntry: any = {};
        if (applySite) overrideEntry.site = effectiveSite;
        if (applyDept) overrideEntry.departmentOverride = targetDept || undefined;
        if (applyDesig) overrideEntry.designation = effectiveDesig;
        if (applyShift) overrideEntry.shiftName = targetShift;
        if (applyCompany) overrideEntry.company = targetCompany;

        updatedOverrides[empCode] = overrideEntry;

        // Build Supabase correction record
        corrections.push({
          id: `corr-${empCode}-${selectedDate}`,
          empCode,
          empName,
          attendanceDate: selectedDate,
          site: applySite ? effectiveSite : emp.department,
          department: applyDept ? (targetDept as string) : undefined,
          designation: applyDesig ? effectiveDesig : emp.designation,
          shiftName: applyShift ? targetShift : emp.shiftName,
          company: applyCompany ? targetCompany : emp.company,
          correctedBy: currentUserEmail || 'admin@paradigmfms.com',
          correctedAt: now,
        });

        // Build eSSL update record
        if (syncToEssl) {
          mssqlUpdates.push({
            empCode,
            empName,
            siteName: applySite ? effectiveSite : undefined,
            department: applyDept ? (targetDept as string) : undefined,
            designation: applyDesig ? effectiveDesig : undefined,
            shiftName: applyShift ? targetShift : undefined,
            companyName: applyCompany ? targetCompany : undefined,
          });
        }
      }

      // Step 1: Save to Supabase Cloud
      setProgressStatus(`Syncing ${count} updates to Supabase Cloud...`);
      await saveBulkCorrectionsToSupabase(corrections);

      // Step 2: Sync to eSSL MSSQL if requested
      if (syncToEssl && mssqlUpdates.length > 0) {
        setProgressStatus(`Updating ${count} employees in eSSL MSSQL database (dbo.Employees)...`);
        await bulkUpdateMssqlEmployees(mssqlUpdates);
      }

      setProgressStatus('Completed successfully!');
      onSuccess(updatedOverrides);
      onClose();
    } catch (err: any) {
      console.error('[BulkEmployeeEdit] Error applying updates:', err);
      setErrorMessage(err.message || 'An error occurred while applying bulk updates.');
    } finally {
      setIsSaving(false);
      setProgressStatus(null);
    }
  };

  const filteredSiteOptions = Array.from(new Set(['Parkwest', ...availableSites])).filter(
    s => s && s.toLowerCase() !== 'all' && s.toLowerCase() !== 'default'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#134426] flex items-center justify-between bg-slate-50 dark:bg-[#041b0f]/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-[#44D62C] border border-emerald-300 dark:border-emerald-800">
              <Users size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <span>Bulk Update Employees</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#44D62C] text-[#041b0f]">
                  {count} Selected
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-emerald-300/70 mt-0.5">
                Update site, designation, department, and shift across all selected staff in one click.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#0d3820] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected Employees Chip Preview */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-100/70 dark:bg-[#041b0f]/40 border-b border-slate-200 dark:border-[#134426] flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-600 dark:text-emerald-300/80 scrollbar-none">
          <span className="font-bold shrink-0 text-slate-700 dark:text-emerald-200">Updating:</span>
          <div className="flex items-center gap-1 overflow-x-auto">
            {selectedEmployees.slice(0, 8).map(emp => (
              <span
                key={emp.empCode}
                className="px-2 py-0.5 rounded-md bg-white dark:bg-[#0d3820] border border-slate-200 dark:border-[#1a5532] font-mono font-semibold shrink-0"
              >
                #{emp.empCode} {emp.empName.split(' ')[0]}
              </span>
            ))}
            {selectedEmployees.length > 8 && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#44D62C] font-bold shrink-0">
                +{selectedEmployees.length - 8} more
              </span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Site Assignment */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            applySite
              ? 'border-emerald-300 dark:border-[#22633c] bg-emerald-50/20 dark:bg-[#0d3820]/30'
              : 'border-slate-200 dark:border-[#134426] bg-slate-50/50 dark:bg-transparent opacity-75'
          }`}>
            <label className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applySite}
                onChange={e => setApplySite(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#44D62C]"
              />
              <Building2 size={14} className="text-emerald-600 dark:text-[#44D62C]" />
              <span>Update Client Site</span>
            </label>

            {applySite && (
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={targetSite}
                  onChange={e => setTargetSite(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#0d3820] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                >
                  {filteredSiteOptions.map(site => (
                    <option key={site} value={site}>{site}</option>
                  ))}
                  <option value="__custom__">+ Custom / New Site Name...</option>
                </select>

                {targetSite === '__custom__' && (
                  <input
                    type="text"
                    placeholder="Enter custom site name..."
                    value={customSite}
                    onChange={e => setCustomSite(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#0d3820] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                  />
                )}
              </div>
            )}
          </div>

          {/* 2. Department Assignment */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            applyDept
              ? 'border-emerald-300 dark:border-[#22633c] bg-emerald-50/20 dark:bg-[#0d3820]/30'
              : 'border-slate-200 dark:border-[#134426] bg-slate-50/50 dark:bg-transparent opacity-75'
          }`}>
            <label className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyDept}
                onChange={e => setApplyDept(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#44D62C]"
              />
              <Layers size={14} className="text-emerald-600 dark:text-[#44D62C]" />
              <span>Update Operational Department</span>
            </label>

            {applyDept && (
              <div className="mt-2.5">
                <select
                  value={targetDept}
                  onChange={e => setTargetDept(e.target.value as DepartmentKey)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#0d3820] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                >
                  {COMMON_DEPARTMENTS.map(d => (
                    <option key={d.key} value={d.key}>
                      {d.icon} {d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 3. Designation Assignment */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            applyDesig
              ? 'border-emerald-300 dark:border-[#22633c] bg-emerald-50/20 dark:bg-[#0d3820]/30'
              : 'border-slate-200 dark:border-[#134426] bg-slate-50/50 dark:bg-transparent opacity-75'
          }`}>
            <label className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyDesig}
                onChange={e => setApplyDesig(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#44D62C]"
              />
              <Briefcase size={14} className="text-emerald-600 dark:text-[#44D62C]" />
              <span>Update Designation / Job Title</span>
            </label>

            {applyDesig && (
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={targetDesig}
                  onChange={e => setTargetDesig(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#0d3820] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                >
                  {COMMON_DESIGNATIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="__custom__">+ Enter Custom Designation...</option>
                </select>

                {targetDesig === '__custom__' && (
                  <input
                    type="text"
                    placeholder="Enter custom designation..."
                    value={customDesig}
                    onChange={e => setCustomDesig(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#0d3820] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                  />
                )}
              </div>
            )}
          </div>

          {/* 4. Shift Assignment */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            applyShift
              ? 'border-emerald-300 dark:border-[#22633c] bg-emerald-50/20 dark:bg-[#0d3820]/30'
              : 'border-slate-200 dark:border-[#134426] bg-slate-50/50 dark:bg-transparent opacity-75'
          }`}>
            <label className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyShift}
                onChange={e => setApplyShift(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#44D62C]"
              />
              <Clock size={14} className="text-emerald-600 dark:text-[#44D62C]" />
              <span>Update Operational Shift</span>
            </label>

            {applyShift && (
              <div className="mt-2.5">
                <select
                  value={targetShift}
                  onChange={e => setTargetShift(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#0d3820] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                >
                  {COMMON_SHIFTS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 5. Company Assignment */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            applyCompany
              ? 'border-emerald-300 dark:border-[#22633c] bg-emerald-50/20 dark:bg-[#0d3820]/30'
              : 'border-slate-200 dark:border-[#134426] bg-slate-50/50 dark:bg-transparent opacity-75'
          }`}>
            <label className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyCompany}
                onChange={e => setApplyCompany(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#44D62C]"
              />
              <Building2 size={14} className="text-emerald-600 dark:text-[#44D62C]" />
              <span>Update Operating Company Entity</span>
            </label>

            {applyCompany && (
              <div className="mt-2.5">
                <select
                  value={targetCompany}
                  onChange={e => setTargetCompany(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#0d3820] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                >
                  {COMMON_COMPANIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 6. Dual eSSL & Supabase Master Sync Toggle */}
          <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-[#1a5532] bg-emerald-50/60 dark:bg-[#041b0f]/80 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="syncToEssl"
              checked={syncToEssl}
              onChange={e => setSyncToEssl(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#44D62C]"
            />
            <label htmlFor="syncToEssl" className="text-xs cursor-pointer select-none">
              <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600 dark:text-[#44D62C]" />
                Update eSSL MSSQL (`dbo.Employees`) and Supabase Cloud simultaneously
              </span>
              <span className="block text-slate-500 dark:text-emerald-300/70 text-[11px] mt-0.5">
                {syncToEssl
                  ? '✓ Both systems will update: eTimeTrackLite software on your remote server and Paradigm Cloud Dashboards.'
                  : 'ℹ Only updates Paradigm Cloud Dashboards (eSSL MSSQL will not be changed).'}
              </span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-[#134426] bg-slate-50 dark:bg-[#041b0f]/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-emerald-300/70 flex items-center gap-1.5">
            {isSaving && <Loader2 size={13} className="animate-spin text-emerald-600 dark:text-[#44D62C]" />}
            <span>{progressStatus || `${count} employees selected for update`}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-emerald-200 bg-white dark:bg-[#0d3820] border border-slate-200 dark:border-[#1a5532] hover:bg-slate-50 dark:hover:bg-[#1a5532] transition-colors cursor-pointer flex-1 sm:flex-initial"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || count === 0}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-[#041b0f] bg-[#44D62C] hover:bg-[#38b824] shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 flex-1 sm:flex-initial disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Apply Bulk Updates ({count})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
