import React, { useState, useEffect } from 'react';
import { 
  X, Settings, Plus, Trash2, CheckCircle2, ShieldCheck, 
  Building2, Search, Sparkles, RefreshCw, AlertCircle 
} from 'lucide-react';
import { 
  DepartmentKey, 
  DEPARTMENT_METAS, 
  CustomRoleMapping, 
  getCustomRoleMappings, 
  saveCustomRoleMapping, 
  deleteCustomRoleMapping 
} from '../../utils/departmentMapping';

interface RoleMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSite: string;
  onMappingChanged: () => void;
}

export const RoleMappingModal: React.FC<RoleMappingModalProps> = ({
  isOpen,
  onClose,
  currentSite,
  onMappingChanged,
}) => {
  const [mappings, setMappings] = useState<CustomRoleMapping[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>(currentSite === 'all' ? 'All Sites' : currentSite);
  const [designationInput, setDesignationInput] = useState('');
  const [targetDept, setTargetDept] = useState<DepartmentKey>('security');
  const [searchQuery, setSearchQuery] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMappings(getCustomRoleMappings());
      setSelectedSite(currentSite === 'all' ? 'All Sites' : currentSite);
    }
  }, [isOpen, currentSite]);

  if (!isOpen) return null;

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!designationInput.trim()) return;

    const newMappings = saveCustomRoleMapping({
      siteName: selectedSite,
      designation: designationInput.trim(),
      department: targetDept,
    });

    setMappings(newMappings);
    setDesignationInput('');
    setSuccessToast(`Assigned "${designationInput.trim()}" to ${DEPARTMENT_METAS[targetDept].shortLabel}!`);
    setTimeout(() => setSuccessToast(null), 3000);
    onMappingChanged();
  };

  const handleDeleteRule = (id: string) => {
    const newMappings = deleteCustomRoleMapping(id);
    setMappings(newMappings);
    onMappingChanged();
  };

  const filteredMappings = mappings.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.designation.toLowerCase().includes(q) ||
      m.siteName.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q)
    );
  });

  const popularSuggestions = [
    { desig: 'Security Officer', dept: 'security' as DepartmentKey },
    { desig: 'Facility Manager', dept: 'administration' as DepartmentKey },
    { desig: 'Asst Facility Manager', dept: 'administration' as DepartmentKey },
    { desig: 'Technical Supervisor', dept: 'mep' as DepartmentKey },
    { desig: 'HK Supervisor', dept: 'housekeeping' as DepartmentKey },
    { desig: 'Garden Helper', dept: 'garden' as DepartmentKey },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#072415] border-2 border-emerald-500/40 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#134426] flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-[#041b0f]/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-[#0d3820] text-emerald-800 dark:text-[#44D62C] flex items-center justify-center text-xl shadow-inner shrink-0">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                Role & Department Assignment Rules
              </h2>
              <p className="text-xs text-slate-500 dark:text-emerald-300/70 mt-0.5">
                Assign any job role directly to a department without editing backend code.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-[#0d3820] dark:hover:text-white transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success Alert */}
        {successToast && (
          <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 bg-white dark:bg-[#072415]">
          
          {/* Form to Add / Reassign a Role */}
          <form onSubmit={handleSaveRule} className="p-4 rounded-2xl bg-slate-50 dark:bg-[#041b0f] border border-slate-200 dark:border-[#134426] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                <Plus size={14} className="text-emerald-600" />
                <span>Create Role Assignment Rule</span>
              </span>
              <span className="text-[10px] text-slate-400">Live Auto-Save</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Site Scope */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-emerald-300">
                  Site Scope:
                </label>
                <select
                  value={selectedSite}
                  onChange={e => setSelectedSite(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#072415] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/25 cursor-pointer"
                >
                  <option value={currentSite === 'all' ? 'All Sites' : currentSite}>
                    This Site Only ({currentSite === 'all' ? 'All Sites' : currentSite})
                  </option>
                  <option value="All Sites">All Sites (Global)</option>
                </select>
              </div>

              {/* Designation Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-emerald-300">
                  Role / Designation:
                </label>
                <input
                  type="text"
                  value={designationInput}
                  onChange={e => setDesignationInput(e.target.value)}
                  placeholder="e.g. Security Officer, Plumber..."
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#072415] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/25"
                />
              </div>
            </div>

            {/* Target Department Selection */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-emerald-300">
                Assign to Department:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['mep', 'housekeeping', 'garden', 'security', 'administration', 'other'] as DepartmentKey[]).map(k => {
                  const m = DEPARTMENT_METAS[k];
                  const isSelected = targetDept === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTargetDept(k)}
                      className={`flex items-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-100 text-emerald-900 dark:bg-[#0d3820] dark:text-[#44D62C] dark:border-[#44D62C] ring-2 ring-emerald-500/30'
                          : 'border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#072415] text-slate-700 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-[#0a2e1b]'
                      }`}
                    >
                      <span className="text-sm shrink-0">{m.icon}</span>
                      <span className="truncate">{m.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Suggestions */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
              <span className="text-slate-400 dark:text-emerald-400/60 font-medium">Quick Suggestions:</span>
              {popularSuggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setDesignationInput(s.desig);
                    setTargetDept(s.dept);
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-200/70 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-[#0d3820] dark:text-emerald-300 dark:hover:bg-[#1a5532] text-[10px] font-semibold transition-colors cursor-pointer"
                >
                  {s.desig} → {DEPARTMENT_METAS[s.dept].shortLabel}
                </button>
              ))}
            </div>

            {/* Submit button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={!designationInput.trim()}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Save Assignment Rule</span>
              </button>
            </div>
          </form>

          {/* Active Rules List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Active Custom Rules ({filteredMappings.length})
              </h3>
              {mappings.length > 0 && (
                <div className="relative w-44">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search rules..."
                    className="w-full text-[11px] pl-7 pr-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#1a5532] bg-slate-50 dark:bg-[#041b0f] text-slate-800 dark:text-white outline-none"
                  />
                </div>
              )}
            </div>

            {filteredMappings.length === 0 ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-[#134426] text-slate-400">
                <AlertCircle size={24} className="mx-auto mb-1.5 opacity-50 text-slate-400" />
                <p className="text-xs font-semibold">No custom role rules created yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Standard department keywords are active. Use the form above to assign any role to a custom department.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-[#134426] rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-[#134426]">
                {filteredMappings.map(m => {
                  const meta = DEPARTMENT_METAS[m.department];
                  return (
                    <div key={m.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#041b0f]/60 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {m.designation}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${meta.badgeBg} ${meta.badgeText}`}>
                            <span>{meta.icon}</span>
                            <span>{meta.shortLabel}</span>
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Scope: <strong>{m.siteName}</strong>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteRule(m.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="Delete rule"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-[#134426] bg-slate-50/80 dark:bg-[#041b0f]/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Rules apply immediately across all cards and breakdown plans.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-[#0d3820] dark:hover:bg-[#1a5532] text-slate-800 dark:text-white font-bold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
