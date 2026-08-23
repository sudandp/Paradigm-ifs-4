import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  History, ArrowLeft, Search, Filter, RefreshCw, 
  Download, User, ShieldCheck, Zap, ChevronDown, Check, Trash2,
  Clock, Activity, AlertCircle, Plus, Pencil, Layers, FileSpreadsheet,
  Calendar, X
} from 'lucide-react';
import { api } from '../../services/api';
import { getCachedPpmExecutions } from '../../services/offline/cache';
import { HTAuditLogEntry } from '../../types/htYard';
import toast from 'react-hot-toast';

export interface UnifiedAuditLogEntry extends HTAuditLogEntry {
  auditId?: string;
  moduleType: 'SITE_AUDIT' | 'PPM_AUDIT' | 'SNAG_AUDIT' | 'MASTER_DATA' | 'AUDIT_REPORT';
  siteName: string;
  auditRef?: string;
}

export const HTYardAuditLogsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedAuditId = searchParams.get('auditId');

  const [allLogs, setAllLogs] = useState<UnifiedAuditLogEntry[]>([]);
  const [allAuditSites, setAllAuditSites] = useState<{ id: string; siteName: string; module: string; ref: string }[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(selectedAuditId || 'ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showSiteDropdown, setShowSiteDropdown] = useState<boolean>(false);

  const loadAllLogs = async () => {
    setIsLoading(true);
    try {
      const combinedLogs: UnifiedAuditLogEntry[] = [];
      const sitesList: { id: string; siteName: string; module: string; ref: string }[] = [];

      // 1. Load HT Yard Site Audits
      try {
        const htAudits = await api.getAllHTYardAudits();
        (htAudits || []).forEach((item: any) => {
          const active = item.activeAudit;
          if (active) {
            sitesList.push({
              id: active.id,
              siteName: active.siteName,
              module: 'Site Audit (HT Yard)',
              ref: active.referenceNumber
            });

            if (active.auditLogs && active.auditLogs.length > 0) {
              active.auditLogs.forEach((l: HTAuditLogEntry) => {
                combinedLogs.push({
                  ...l,
                  auditId: active.id,
                  moduleType: 'SITE_AUDIT',
                  siteName: active.siteName,
                  auditRef: active.referenceNumber
                });
              });
            }
          }
        });
        // 1b. Load HT Yard explicit global activity logs
        const rawHtLogs = localStorage.getItem('paradigm_ht_audit_global_logs');
        if (rawHtLogs) {
          const parsedHtLogs = JSON.parse(rawHtLogs);
          (parsedHtLogs || []).forEach((l: any) => {
            combinedLogs.push({
              ...l,
              auditId: l.auditId || 'ht-global',
              moduleType: 'SITE_AUDIT',
              siteName: l.siteName || 'Site Audit'
            });
          });
        }
      } catch (e) {
        console.warn('[HTYardAuditLogsPage] Error loading HT Yard audits:', e);
      }

      // 2. Load PPM Audits
      try {
        const ppmRuns = await getCachedPpmExecutions();
        (ppmRuns || []).forEach((run: any) => {
          sitesList.push({
            id: run.id,
            siteName: run.site_name || run.category_id || 'PPM Audit',
            module: 'PPM Audits',
            ref: run.reference_number || run.id
          });

          // Generate synthetic logs if explicit logs array not attached
          if (run.auditLogs && run.auditLogs.length > 0) {
            run.auditLogs.forEach((l: HTAuditLogEntry) => {
              combinedLogs.push({
                ...l,
                auditId: run.id,
                moduleType: 'PPM_AUDIT',
                siteName: run.site_name || 'PPM Audit',
                auditRef: run.reference_number
              });
            });
          } else {
            combinedLogs.push({
              id: `log-ppm-${run.id}`,
              auditId: run.id,
              timestamp: run.created_at ? new Date(run.created_at).toLocaleString() : run.audit_date || 'Recent',
              userName: run.auditor_name || 'Sudhan M',
              userRole: 'Admin',
              actionType: 'SAVE',
              target: run.category_id || 'PPM Checklist',
              details: `Executed PPM audit (${Object.keys(run.observations || {}).length} observations recorded)`,
              moduleType: 'PPM_AUDIT',
              siteName: run.site_name || run.category_id || 'PPM Audit',
              auditRef: run.reference_number
            });
          }
        });

        // 2b. Load PPM explicit facility action logs (duplicate / remove / rename events)
        const rawPpmLogs = localStorage.getItem('paradigm_ppm_audit_logs');
        if (rawPpmLogs) {
          const parsedPpmLogs = JSON.parse(rawPpmLogs);
          (parsedPpmLogs || []).forEach((l: any) => {
            combinedLogs.push({
              ...l,
              auditId: l.auditId || 'ppm-global',
              moduleType: 'PPM_AUDIT',
              siteName: l.siteName || 'PPM Audits'
            });
          });
        }

        // 3. Load Master Data Activity Logs
        const rawMdLogs = localStorage.getItem('paradigm_master_data_audit_logs');
        if (rawMdLogs) {
          const parsedMdLogs = JSON.parse(rawMdLogs);
          (parsedMdLogs || []).forEach((l: any) => {
            combinedLogs.push({
              ...l,
              auditId: l.auditId || 'md-global',
              moduleType: 'MASTER_DATA',
              siteName: l.siteName || 'HT Master Data'
            });
          });
        }
        // 4. Load Snag Audit Activity Logs
        const rawSnagLogs = localStorage.getItem('paradigm_snag_audit_logs');
        if (rawSnagLogs) {
          const parsedSnagLogs = JSON.parse(rawSnagLogs);
          (parsedSnagLogs || []).forEach((l: any) => {
            combinedLogs.push({
              ...l,
              auditId: l.auditId || 'snag-global',
              moduleType: 'SNAG_AUDIT',
              siteName: l.siteName || 'Snag Audit'
            });
          });
        }
      } catch (e) {
        console.warn('[HTYardAuditLogsPage] Error loading PPM/Master Data/Snag audits:', e);
      }

      // Sort combined logs descending by ID / timestamp
      combinedLogs.sort((a, b) => b.id.localeCompare(a.id));

      console.log('[HTYardAuditLogsLoaded]', {
        count: combinedLogs.length,
        logs: combinedLogs,
        sites: sitesList
      });

      setAllLogs(combinedLogs);
      setAllAuditSites(sitesList);

    } catch (err) {
      console.warn('[HTYardAuditLogsPage] Error combining logs:', err);
      toast.error('Failed to load activity logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllLogs();
  }, [selectedAuditId]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('No logs available to export');
      return;
    }
    const headers = ['Log ID', 'Module', 'Site Audit', 'Timestamp', 'User Name', 'User Role', 'Action Type', 'Target', 'Details'];
    const rows = filteredLogs.map(l => [
      l.id,
      `"${l.moduleType}"`,
      `"${l.siteName}"`,
      `"${l.timestamp}"`,
      `"${l.userName}"`,
      `"${l.userRole}"`,
      `"${l.actionType}"`,
      `"${l.target.replace(/"/g, '""')}"`,
      `"${l.details.replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `All_Audit_Logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported all audit change logs CSV!');
  };

  // Filtered logs calculation
  const filteredLogs = allLogs.filter(log => {
    const matchesModule = moduleFilter === 'ALL' || log.moduleType === moduleFilter;
    const matchesSite = selectedSiteId === 'ALL' || !log.auditId || log.auditId === 'ppm-global' || log.auditId === 'md-global' || log.auditId === 'ht-global' || log.auditId === 'snag-global' || log.auditId === selectedSiteId;
    const matchesAction = actionFilter === 'ALL' || (log.actionType && log.actionType.toUpperCase() === actionFilter.toUpperCase());
    
    // Date Range (From Date -> To Date)
    if (fromDate || toDate) {
      const rawDate = log.timestamp ? log.timestamp.split('T')[0].split(' ')[0] : '';
      if (fromDate && rawDate && rawDate < fromDate) return false;
      if (toDate && rawDate && rawDate > toDate) return false;
    }

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      log.userName.toLowerCase().includes(query) ||
      log.userRole.toLowerCase().includes(query) ||
      log.siteName.toLowerCase().includes(query) ||
      log.target.toLowerCase().includes(query) ||
      log.details.toLowerCase().includes(query) ||
      log.timestamp.toLowerCase().includes(query);
    return matchesModule && matchesSite && matchesAction && matchesSearch;
  });

  const totalCreates = allLogs.filter(l => l.actionType === 'CREATE').length;
  const totalEdits = allLogs.filter(l => l.actionType === 'EDIT').length;
  const totalDeletes = allLogs.filter(l => l.actionType === 'DELETE').length;
  const totalDuplicates = allLogs.filter(l => l.actionType === 'DUPLICATE').length;

  const currentActiveSite = allAuditSites.find(s => s.id === selectedSiteId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin text-emerald-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Loading All Audit Activity Logs</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Aggregating Site, PPM, and Snag audit tracks...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 space-y-6">
      
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <button
            onClick={() => navigate('/operations/ht-yard-audits')}
            className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline mb-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Audits Dashboard
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="relative inline-block">
              <button
                onClick={() => setShowSiteDropdown(!showSiteDropdown)}
                className="flex items-center gap-2 group text-left focus:outline-hidden cursor-pointer"
              >
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight group-hover:text-emerald-600 transition-colors">
                  Audit Change Log — {currentActiveSite ? currentActiveSite.siteName : 'All Audits Combined'}
                </h1>
                <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-100 text-slate-600 dark:text-slate-300 transition-all">
                  <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showSiteDropdown ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Site Dropdown */}
              {showSiteDropdown && (
                <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-2 space-y-1">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Audit Session</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {allAuditSites.length} Audits Total
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1 py-1">
                    <div
                      onClick={() => {
                        setSelectedSiteId('ALL');
                        setShowSiteDropdown(false);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                        selectedSiteId === 'ALL'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 font-bold text-emerald-700'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">All Audits Combined</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">Aggregated log feed for all modules</p>
                      </div>
                      {selectedSiteId === 'ALL' && <Check className="w-4 h-4 text-emerald-600" />}
                    </div>

                    {allAuditSites.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedSiteId(item.id);
                          setShowSiteDropdown(false);
                        }}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                          selectedSiteId === item.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{item.siteName}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{item.module} • Ref: {item.ref}</p>
                        </div>
                        {selectedSiteId === item.id && <Check className="w-4 h-4 text-emerald-600" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Unified Audit Activity Tracker</span>
            <span>•</span>
            <span>Auditor: <strong className="text-slate-700 dark:text-slate-300">Sudhan M (Admin)</strong></span>
          </p>
        </div>

        {/* Action Header Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadAllLogs}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Logs
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export CSV Log
          </button>
        </div>
      </div>

      {/* Module Filter Tabs covering all items under Audit & Snag Reports */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-x-auto">
        <button
          onClick={() => setModuleFilter('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
            moduleFilter === 'ALL'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Layers size={14} /> All ({allLogs.length})
        </button>

        <button
          onClick={() => setModuleFilter('SITE_AUDIT')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
            moduleFilter === 'SITE_AUDIT'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Zap size={14} /> Site Audit ({allLogs.filter(l => l.moduleType === 'SITE_AUDIT').length})
        </button>

        <button
          onClick={() => setModuleFilter('PPM_AUDIT')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
            moduleFilter === 'PPM_AUDIT'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <ShieldCheck size={14} /> PPM Audits ({allLogs.filter(l => l.moduleType === 'PPM_AUDIT').length})
        </button>

        <button
          onClick={() => setModuleFilter('SNAG_AUDIT')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
            moduleFilter === 'SNAG_AUDIT'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <AlertCircle size={14} /> Snag Audit ({allLogs.filter(l => l.moduleType === 'SNAG_AUDIT').length})
        </button>

        <button
          onClick={() => setModuleFilter('MASTER_DATA')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
            moduleFilter === 'MASTER_DATA'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Pencil size={14} /> Master Data ({allLogs.filter(l => l.moduleType === 'MASTER_DATA').length})
        </button>

        <button
          onClick={() => setModuleFilter('AUDIT_REPORT')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
            moduleFilter === 'AUDIT_REPORT'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <FileSpreadsheet size={14} /> Reports ({allLogs.filter(l => l.moduleType === 'AUDIT_REPORT').length})
        </button>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Logged Actions</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{allLogs.length} <span className="text-xs font-normal text-slate-500">entries</span></div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 inline-block">Complete history</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 border border-emerald-100">
            <History className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Edits & Updates</span>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{totalEdits} <span className="text-xs font-normal text-slate-500">edits</span></div>
            <span className="text-[11px] text-blue-600 font-medium mt-1 inline-block">Field & value updates</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 border border-blue-100">
            <Pencil className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Stage Duplications</span>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{totalDuplicates} <span className="text-xs font-normal text-slate-500">copies</span></div>
            <span className="text-[11px] text-purple-600 font-medium mt-1 inline-block">Duplicated stages</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 border border-purple-100">
            <Plus className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Creates / Deletes</span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{totalCreates + totalDeletes} <span className="text-xs font-normal text-slate-500">actions</span></div>
            <span className="text-[11px] text-rose-600 font-medium mt-1 inline-block">{totalCreates} creates • {totalDeletes} deletes</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 border border-rose-100">
            <Trash2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Filter & Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        
        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by user, role, site, target, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
            />
          </div>

          {/* Filter Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Action:
            </span>
            {['ALL', 'CREATE', 'EDIT', 'DELETE', 'DUPLICATE', 'SAVE'].map((type) => (
              <button
                key={type}
                onClick={() => setActionFilter(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all cursor-pointer ${
                  actionFilter === type
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Date to Date Filter Row */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              Filter by Date:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors flex items-center gap-0.5 cursor-pointer"
              >
                <X size={12} /> Clear Dates
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${!fromDate && !toDate ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              All Time
            </button>
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setFromDate(today);
                setToDate(today);
              }}
              className="px-2 py-0.5 rounded-md font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const d = new Date();
                d.setDate(d.getDate() - 7);
                setFromDate(d.toISOString().split('T')[0]);
                setToDate(now.toISOString().split('T')[0]);
              }}
              className="px-2 py-0.5 rounded-md font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                setFromDate(firstDay);
                setToDate(now.toISOString().split('T')[0]);
              }}
              className="px-2 py-0.5 rounded-md font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              This Month
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-6">Timestamp & ID</th>
                <th className="py-3.5 px-6">Module & Audit Site</th>
                <th className="py-3.5 px-6">User & Role</th>
                <th className="py-3.5 px-6">Action</th>
                <th className="py-3.5 px-6">Target / Component</th>
                <th className="py-3.5 px-6">Exact Change Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <History className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                    <p className="font-bold text-slate-700 dark:text-slate-300 text-base">No audit change logs found</p>
                    <p className="text-xs text-slate-400 mt-1">Actions performed across audit forms will automatically record here.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    
                    {/* Timestamp & ID */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">{log.timestamp}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{log.id}</div>
                    </td>

                    {/* Module & Audit Site */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="font-extrabold text-slate-900 dark:text-white">{log.siteName}</div>
                      <span className={`inline-block text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider mt-0.5 ${
                        log.moduleType === 'SITE_AUDIT' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                        log.moduleType === 'PPM_AUDIT' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                        'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                      }`}>
                        {log.moduleType.replace('_', ' ')}
                      </span>
                    </td>

                    {/* User Name & Role */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs border border-emerald-200 dark:border-emerald-800">
                          {log.userName ? log.userName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{log.userName}</div>
                          <span className="inline-block text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-0.5">
                            {log.userRole || 'Admin'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Action Badge */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        log.actionType === 'CREATE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200' :
                        log.actionType === 'EDIT' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200' :
                        log.actionType === 'DELETE' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200' :
                        log.actionType === 'DUPLICATE' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                      }`}>
                        {log.actionType}
                      </span>
                    </td>

                    {/* Target */}
                    <td className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200 max-w-xs truncate">
                      {log.target}
                    </td>

                    {/* Details */}
                    <td className="py-4 px-6 font-medium text-slate-700 dark:text-slate-300 leading-relaxed max-w-md">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Showing <strong>{filteredLogs.length}</strong> of <strong>{allLogs.length}</strong> activity entries across all modules</span>
          <span>Unified Change Log Tracker</span>
        </div>
      </div>
    </div>
  );
};

export default HTYardAuditLogsPage;
