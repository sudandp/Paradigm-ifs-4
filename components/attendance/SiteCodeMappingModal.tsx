import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Building2,
  Search,
  Sparkles,
  RefreshCw,
  Hash,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  SiteCodeRule,
  getSiteCodeMappings,
  saveSiteCodeMapping,
  deleteSiteCodeMapping,
  resetSiteCodeMappingsToDefault,
  fetchSiteCodeMappingsFromSupabase,
  resolveSiteFromCode,
} from '../../services/siteCodeMappingService';

interface SiteCodeMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSites: string[];
  onRulesChanged: () => void;
}

export const SiteCodeMappingModal: React.FC<SiteCodeMappingModalProps> = ({
  isOpen,
  onClose,
  availableSites,
  onRulesChanged,
}) => {
  const [rules, setRules] = useState<SiteCodeRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form Inputs
  const [prefixInput, setPrefixInput] = useState('');
  const [siteInput, setSiteInput] = useState('');
  const [customSiteInput, setCustomSiteInput] = useState('');
  const [companyInput, setCompanyInput] = useState('Paradigm Services');
  const [notesInput, setNotesInput] = useState('');

  // Live Test Tool
  const [testCodeInput, setTestCodeInput] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load rules on open
  useEffect(() => {
    if (isOpen) {
      setRules(getSiteCodeMappings());
      setPrefixInput('');
      setSiteInput(availableSites[0] || 'Parkwest');
      setCustomSiteInput('');
      setNotesInput('');
      setEditingRuleId(null);

      // Async hydrate from Supabase
      setIsSyncing(true);
      fetchSiteCodeMappingsFromSupabase()
        .then(remoteRules => {
          if (remoteRules && remoteRules.length > 0) {
            setRules(remoteRules);
          }
        })
        .finally(() => setIsSyncing(false));
    }
  }, [isOpen, availableSites]);

  // Clean deduplicated sites list
  const siteOptions = useMemo(() => {
    const list = Array.from(new Set(['Parkwest', ...availableSites])).filter(
      s => s && s.toLowerCase() !== 'all' && s.toLowerCase() !== 'default'
    );
    return list.sort((a, b) => a.localeCompare(b));
  }, [availableSites]);

  if (!isOpen) return null;

  const effectiveSite = siteInput === '__custom__' ? customSiteInput.trim() : siteInput;

  // Save or Edit rule
  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrefix = prefixInput.trim().replace(/^#+/, '');
    if (!cleanPrefix || !effectiveSite) return;

    const updated = saveSiteCodeMapping({
      id: editingRuleId || undefined,
      prefix: cleanPrefix,
      siteName: effectiveSite,
      company: companyInput,
      notes: notesInput.trim() || `${effectiveSite} (${cleanPrefix}xxx Series)`,
      isActive: true,
    });

    setRules(updated);
    setPrefixInput('');
    setNotesInput('');
    setCustomSiteInput('');
    setEditingRuleId(null);
    setSuccessToast(`✓ Prefix "${cleanPrefix}" mapped to ${effectiveSite}!`);
    setTimeout(() => setSuccessToast(null), 3000);
    onRulesChanged();
  };

  const handleStartEdit = (rule: SiteCodeRule) => {
    setEditingRuleId(rule.id);
    setPrefixInput(rule.prefix);
    if (siteOptions.includes(rule.siteName)) {
      setSiteInput(rule.siteName);
      setCustomSiteInput('');
    } else {
      setSiteInput('__custom__');
      setCustomSiteInput(rule.siteName);
    }
    setCompanyInput(rule.company || 'Paradigm Services');
    setNotesInput(rule.notes || '');
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setPrefixInput('');
    setNotesInput('');
    setCustomSiteInput('');
    setSiteInput(siteOptions[0] || 'Parkwest');
  };

  const handleDeleteRule = (id: string, prefix: string) => {
    const updated = deleteSiteCodeMapping(id);
    setRules(updated);
    setSuccessToast(`Removed rule for prefix "${prefix}".`);
    setTimeout(() => setSuccessToast(null), 2500);
    onRulesChanged();
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all site code prefix rules back to default factory mappings?')) {
      const defs = resetSiteCodeMappingsToDefault();
      setRules(defs);
      setSuccessToast('✓ Reset to standard factory site mappings.');
      setTimeout(() => setSuccessToast(null), 3000);
      onRulesChanged();
    }
  };

  // Filtered rules for search
  const filteredRules = rules.filter(r => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.prefix.toLowerCase().includes(q) ||
      r.siteName.toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q) ||
      (r.company || '').toLowerCase().includes(q)
    );
  });

  // Test code preview result
  const testResult = testCodeInput.trim() ? resolveSiteFromCode(testCodeInput.trim()) : null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#072415] border-2 border-emerald-500/40 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#134426] flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-[#041b0f]/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Site Code Mapping Feeder
                {isSyncing && (
                  <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-normal bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-emerald-300/70">
                Feed employee biometric ID prefixes (e.g. 46000 → Parkwest) so new device users are automatically recognized.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-[#134426]/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 flex items-center justify-between gap-2 shadow-sm animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="opacity-80 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">

          {/* Form: Add / Edit Prefix Rule */}
          <form
            onSubmit={handleSaveRule}
            className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-[#0a2f1b]/60 border border-emerald-500/20 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                {editingRuleId ? 'Edit Mapping Rule' : 'Feed New Site Code Rule'}
              </span>
              {editingRuleId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Prefix Input */}
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Code Prefix / Series <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">#</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 46 or 46000"
                    value={prefixInput}
                    onChange={e => setPrefixInput(e.target.value.trim())}
                    className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold rounded-xl bg-white dark:bg-[#041d0f] border border-slate-300 dark:border-[#134426] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 dark:text-emerald-400/60 mt-1 block">
                  Matches codes starting with {prefixInput ? `"${prefixInput}"` : 'this series'}
                </span>
              </div>

              {/* Site Selector */}
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Target Site Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={siteInput}
                  onChange={e => setSiteInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-[#041d0f] border border-slate-300 dark:border-[#134426] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {siteOptions.map(site => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter custom site name...</option>
                </select>

                {siteInput === '__custom__' && (
                  <input
                    type="text"
                    required
                    placeholder="Type new site name..."
                    value={customSiteInput}
                    onChange={e => setCustomSiteInput(e.target.value)}
                    className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#041d0f] border border-emerald-500 text-slate-900 dark:text-white focus:outline-hidden"
                  />
                )}
              </div>

              {/* Company Selector */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Company
                </label>
                <select
                  value={companyInput}
                  onChange={e => setCompanyInput(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl bg-white dark:bg-[#041d0f] border border-slate-300 dark:border-[#134426] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Paradigm Services">Paradigm Services</option>
                  <option value="PIFS">PIFS</option>
                  <option value="Southwall Security LLP">Southwall Security LLP</option>
                  <option value="PPFMS">PPFMS</option>
                </select>
              </div>
            </div>

            {/* Notes / Description */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-9">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Notes / Location Details (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Parkwest Shapoorji Pallonji Project in Bangalore"
                  value={notesInput}
                  onChange={e => setNotesInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#041d0f] border border-slate-300 dark:border-[#134426] text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={!prefixInput.trim() || !effectiveSite}
                  className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-emerald-600/30"
                >
                  {editingRuleId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {editingRuleId ? 'Update Rule' : 'Save Rule'}
                </button>
              </div>
            </div>
          </form>

          {/* Live Prefix Tester Tool */}
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#041d0f]/60 border border-slate-200 dark:border-[#134426] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Live Code Resolution Test
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Verify how any biometric employee ID will be routed in real time.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Type code e.g. 46002"
                value={testCodeInput}
                onChange={e => setTestCodeInput(e.target.value.trim())}
                className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-[#072415] border border-slate-300 dark:border-[#134426] text-slate-900 dark:text-white focus:outline-hidden w-36"
              />
              {testResult && testCodeInput && (
                <div
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 shrink-0 ${
                    testResult.isSmart
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  }`}
                >
                  <ArrowRight className="w-3 h-3" />
                  <span>{testResult.site}</span>
                  {testResult.matchedPrefix && (
                    <span className="text-[10px] font-mono opacity-80">({testResult.matchedPrefix}xxx)</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Active Rules List */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Active Site Code Rules ({filteredRules.length})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search prefix or site..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1 text-xs rounded-lg bg-slate-100 dark:bg-[#041d0f] border border-slate-200 dark:border-[#134426] text-slate-900 dark:text-white focus:outline-hidden w-44"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  title="Reset to factory default rules"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-[#134426]/50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-[#134426] rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-[#134426]/60">
              {filteredRules.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                  No rules match your search. Feed a new prefix rule above.
                </div>
              ) : (
                filteredRules.map(rule => (
                  <div
                    key={rule.id}
                    className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#0a2f1b]/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        #{rule.prefix}xxx
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {rule.siteName}
                          </span>
                          {rule.company && (
                            <span className="text-[10px] text-slate-400 dark:text-emerald-400/60 hidden sm:inline">
                              • {rule.company}
                            </span>
                          )}
                        </div>
                        {rule.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {rule.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStartEdit(rule)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                        title="Edit rule"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id, rule.prefix)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:px-5 border-t border-slate-200 dark:border-[#134426] bg-slate-50/80 dark:bg-[#041b0f]/80 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Synced across all users and devices via Supabase cloud.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-[#134426] hover:bg-slate-300 dark:hover:bg-[#185330] text-slate-800 dark:text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
