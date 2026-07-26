import React, { useState, useEffect } from 'react';
import { 
  Plus, FileSpreadsheet, FileText, Zap, Layers, AlertTriangle, 
  CheckCircle2, Clock, Activity, Cpu, ShieldCheck, Search, Filter, 
  ArrowUpRight, Sparkles, SlidersHorizontal, Save, ChevronDown, Check, Trash2
} from 'lucide-react';
import { HTAuditHeader, HTEquipmentInstance, HTAuditResponse, HTSnagItem, HTEquipmentModuleType } from '../../types/htYard';
import { HT_YARD_FIELD_SPECS } from '../../config/htYardFieldSpecs';
import { HTAuditFormEngine } from '../../components/ht-yard/HTAuditFormEngine';
import { HTFeederRepeater } from '../../components/ht-yard/HTFeederRepeater';
import { HTEarthPitRegister } from '../../components/ht-yard/HTEarthPitRegister';
import { HTSnagListManager } from '../../components/ht-yard/HTSnagListManager';
import { htYardExporter } from '../../services/htYardExporter';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

export const HTYardAuditDashboard: React.FC = () => {
  const [activeAudit, setActiveAudit] = useState<HTAuditHeader | null>(null);
  const [equipmentInstances, setEquipmentInstances] = useState<HTEquipmentInstance[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string>('site_common');
  const [responses, setResponses] = useState<Record<string, HTAuditResponse>>({});
  const [snagItems, setSnagItems] = useState<HTSnagItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allAudits, setAllAudits] = useState<any[]>([]);
  const [showSiteDropdown, setShowSiteDropdown] = useState<boolean>(false);
  
  // Modal for new audit
  const [showNewAuditModal, setShowNewAuditModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newClientDivision, setNewClientDivision] = useState('');

  // Modal for delete audit
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState<{ id: string; siteName: string } | null>(null);

  const loadAudits = async () => {
    try {
      const list = await api.getAllHTYardAudits();
      setAllAudits(list);
      if (list && list.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayAudit = list.find((a: any) => a.activeAudit?.auditDate === todayStr);
        const selected = todayAudit || list[0];
        setActiveAudit(selected.activeAudit);
        setEquipmentInstances(selected.equipmentInstances || []);
        setResponses(selected.responses || {});
        setSnagItems(selected.snagItems || []);
      }
    } catch (err) {
      console.warn('[HTYardAudit] Error loading audits:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load saved audit list on mount
  useEffect(() => {
    loadAudits();
  }, []);

  const handleSelectAudit = (item: any) => {
    setActiveAudit(item.activeAudit);
    setEquipmentInstances(item.equipmentInstances || []);
    setResponses(item.responses || {});
    setSnagItems(item.snagItems || []);
    setActiveInstanceId('site_common');
    setShowSiteDropdown(false);
    toast.success(`Switched to ${item.activeAudit.siteName}`);
  };

  const handleDeleteAuditClick = (auditId: string, siteName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAuditToDelete({ id: auditId, siteName });
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteAudit = async () => {
    if (!auditToDelete) return;
    const targetId = auditToDelete.id;
    toast.loading('Deleting audit...', { id: 'delete-ht-audit' });
    try {
      await api.deleteHTYardAudit(targetId);
      const updatedList = allAudits.filter(a => a.activeAudit?.id !== targetId);
      setAllAudits(updatedList);

      if (activeAudit?.id === targetId) {
        if (updatedList.length > 0) {
          const next = updatedList[0];
          setActiveAudit(next.activeAudit);
          setEquipmentInstances(next.equipmentInstances || []);
          setResponses(next.responses || {});
          setSnagItems(next.snagItems || []);
        } else {
          setActiveAudit(null);
          setEquipmentInstances([]);
          setResponses({});
          setSnagItems([]);
        }
      }
      setShowDeleteModal(false);
      setAuditToDelete(null);
      toast.success('Site Audit deleted successfully!', { id: 'delete-ht-audit' });
    } catch (err) {
      toast.error('Failed to delete audit.', { id: 'delete-ht-audit' });
    }
  };

  const handleSaveAuditToDatabase = async () => {
    if (!activeAudit) return;
    toast.loading('Saving audit data to database...', { id: 'save-ht-audit' });
    try {
      await api.saveHTYardAudit({
        activeAudit,
        equipmentInstances,
        responses,
        snagItems
      });
      toast.success('HT Yard audit saved to database successfully!', { id: 'save-ht-audit' });
    } catch (err) {
      toast.error('Failed to save audit to database.', { id: 'save-ht-audit' });
    }
  };

  const handleCreateNewAudit = (siteName: string, division: string) => {
    const trimmedSite = (siteName || 'Prestige Tech Park HT Yard').trim();

    // Check if an audit with the same site name already exists (case-insensitive)
    const existingAudit = allAudits.find(
      (a) => a.activeAudit?.siteName?.trim().toLowerCase() === trimmedSite.toLowerCase()
    );

    if (existingAudit) {
      toast.error(`An audit for "${existingAudit.activeAudit.siteName}" already exists! Switched to existing audit.`, { id: 'dup-audit-error', duration: 4000 });
      handleSelectAudit(existingAudit);
      setShowNewAuditModal(false);
      return;
    }

    const auditId = `audit-${Date.now()}`;
    const newAudit: HTAuditHeader = {
      id: auditId,
      siteName: trimmedSite,
      referenceNumber: `HT-AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      auditDate: new Date().toISOString().split('T')[0],
      clientDivision: division.trim() || 'BESCOM East Division',
      status: 'Draft',
      auditorName: 'Field Engineer'
    };

    const defaultInstances: HTEquipmentInstance[] = [
      { id: `inst-rmu-1`, auditId, moduleType: 'RMU', instanceName: 'RMU 1', instanceNumber: 1, feederWayCount: 5 },
      { id: `inst-tr-1`, auditId, moduleType: 'Transformer', instanceName: 'Transformer 1', instanceNumber: 1, feederWayCount: 4 },
      { id: `inst-ltk-1`, auditId, moduleType: 'LT_Kiosk', instanceName: 'LT Kiosk 1', instanceNumber: 1, feederWayCount: 4 }
    ];

    const initialAuditData = {
      activeAudit: newAudit,
      equipmentInstances: defaultInstances,
      responses: {},
      snagItems: []
    };

    setActiveAudit(newAudit);
    setEquipmentInstances(defaultInstances);
    setResponses({});
    setSnagItems([]);
    setActiveInstanceId('site_common');
    setShowNewAuditModal(false);
    api.saveHTYardAudit(initialAuditData).then(() => {
      loadAudits();
    });
    toast.success('Started and saved new HT Yard audit session');
  };

  const addEquipmentInstance = (moduleType: HTEquipmentModuleType) => {
    if (!activeAudit) return;
    const sameTypeCount = equipmentInstances.filter(e => e.moduleType === moduleType).length;
    const newInst: HTEquipmentInstance = {
      id: `inst-${moduleType.toLowerCase()}-${Date.now()}`,
      auditId: activeAudit.id,
      moduleType,
      instanceName: `${moduleType.replace('_', ' ')} ${sameTypeCount + 1}`,
      instanceNumber: sameTypeCount + 1,
      feederWayCount: 4
    };
    setEquipmentInstances([...equipmentInstances, newInst]);
    setActiveInstanceId(newInst.id);
    toast.success(`Added ${newInst.instanceName}`);
  };

  const handleResponseChange = (key: string, val: Partial<HTAuditResponse>) => {
    setResponses((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...val } as HTAuditResponse
    }));
  };

  const handleExportExcel = () => {
    if (!activeAudit) return;
    htYardExporter.exportToExcel(activeAudit, equipmentInstances, responses, snagItems);
    toast.success('Exporting multi-sheet Excel workbook...');
  };

  const handleExportPDF = () => {
    if (!activeAudit) return;
    htYardExporter.exportToPDF(activeAudit, equipmentInstances, responses, snagItems);
    toast.success('Exporting PDF inspection report...');
  };

  const activeInstance = equipmentInstances.find(i => i.id === activeInstanceId);
  const activeSpec = activeInstance ? HT_YARD_FIELD_SPECS[activeInstance.moduleType] : null;

  // Stats calculation
  const totalResponses = Object.keys(responses).length;
  const openSnagsCount = snagItems.filter(s => s.status !== 'Closed').length;
  const totalEquipmentCount = equipmentInstances.length;

  // Loading Spinner while checking database / local storage
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin text-emerald-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Loading HT Yard Audit</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Retrieving inspection data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty State when no active audit exists
  if (!activeAudit) {
    return (
      <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden">
        
        <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-900/40 [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none" />
        
        <div className="relative z-10 max-w-lg w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-10 text-center shadow-xl shadow-slate-200/20 dark:shadow-none">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
            <Zap className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
            Start a New Audit
          </h1>
          
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
            You don't have an active HT Yard Take-Over Audit. Create a new one to begin inspecting RMUs, Transformers, and LT Kiosks.
          </p>
          
          <button
            onClick={() => setShowNewAuditModal(true)}
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 mx-auto"
          >
            <Plus className="w-5 h-5" /> Start Fresh Audit
          </button>
        </div>

        {/* New Audit Modal (rendered conditionally here too so it can be opened from the empty state) */}
        {showNewAuditModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-600" /> Start New HT Yard Audit
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Site / Substation Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Prestige Tech Park HT Yard"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Client / BESCOM Division
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BESCOM East Division"
                    value={newClientDivision}
                    onChange={(e) => setNewClientDivision(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setShowNewAuditModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateNewAudit(newSiteName, newClientDivision)}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all"
                >
                  Create Audit Draft
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
            <Zap className="w-4 h-4" /> HT Yard / Site Take-Over Audit
          </div>
          <div className="relative inline-block">
            <button
              onClick={() => setShowSiteDropdown(!showSiteDropdown)}
              className="flex items-center gap-2 group text-left focus:outline-hidden"
            >
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight group-hover:text-emerald-600 transition-colors">
                {activeAudit?.siteName || 'Site Audit'}
              </h1>
              <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950 text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 transition-all">
                <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showSiteDropdown ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Dropdown Menu */}
            {showSiteDropdown && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-2 space-y-1">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Site Audit</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {allAudits.length} Audits
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1 py-1">
                  {allAudits.map((item) => {
                    const isToday = item.activeAudit?.auditDate === new Date().toISOString().split('T')[0];
                    const isSelected = item.activeAudit?.id === activeAudit?.id;
                    return (
                      <div
                        key={item.activeAudit?.id || Math.random()}
                        onClick={() => handleSelectAudit(item)}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {item.activeAudit?.siteName}
                            </span>
                            {isToday && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                                Today
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                            <span className="font-mono">{item.activeAudit?.referenceNumber}</span>
                            <span>•</span>
                            <span>{item.activeAudit?.auditDate}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-1" />}
                          <button
                            onClick={(e) => handleDeleteAuditClick(item.activeAudit?.id, item.activeAudit?.siteName, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                            title="Delete Audit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setShowSiteDropdown(false);
                      setShowNewAuditModal(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Start Another New Audit
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Ref: <strong className="font-mono text-slate-700 dark:text-slate-300">{activeAudit?.referenceNumber}</strong></span>
            <span>•</span>
            <span>Date: <strong className="text-slate-700 dark:text-slate-300">{activeAudit?.auditDate}</strong></span>
            <span>•</span>
            <span>Division: <strong className="text-slate-700 dark:text-slate-300">{activeAudit?.clientDivision}</strong></span>
          </p>
        </div>

        {/* Top CTA Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSaveAuditToDatabase}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Audit
          </button>
          <button
            onClick={() => setShowNewAuditModal(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700"
          >
            <Plus className="w-4 h-4 text-slate-600 dark:text-slate-400" /> New Audit
          </button>
          <button
            onClick={() => activeAudit && handleDeleteAuditClick(activeAudit.id, activeAudit.siteName)}
            className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-rose-200/80 dark:border-rose-800"
            title="Delete Active Audit"
          >
            <Trash2 className="w-4 h-4 text-rose-600" /> Delete Audit
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-emerald-200/80 dark:border-emerald-800"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> Export PDF Report
          </button>
        </div>
      </div>

      {/* Metric Stat Cards (Matching CRM Pipeline Top Bar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Equipment Fleet */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Equipment Units</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalEquipmentCount} <span className="text-xs font-normal text-slate-500">instances</span></div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 inline-block">RMU, Transformer, Kiosk</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
            <Cpu className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Field Checklist Inputs */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Checked Items</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalResponses} <span className="text-xs font-normal text-slate-500">recorded</span></div>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-1 inline-block">Field observations logged</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Open Snag Defects */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Open Snags</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{openSnagsCount} <span className="text-xs font-normal text-slate-500">defects</span></div>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 inline-block">Requires action plan</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Audit Status */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Audit State</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeAudit?.status || 'Draft'}</div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 inline-block">Ready for review</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Equipment Navigation Toolbar (Matching CRM Tab Filters) */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 max-w-full">
          <button
            onClick={() => setActiveInstanceId('site_common')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeInstanceId === 'site_common'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Yard Common & HIRA
          </button>

          {equipmentInstances.map((inst) => (
            <button
              key={inst.id}
              onClick={() => setActiveInstanceId(inst.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeInstanceId === inst.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" /> {inst.instanceName}
            </button>
          ))}
        </div>

        {/* Add Equipment Dropdown Button */}
        <div className="relative group ml-auto">
          <button className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all">
            <Plus className="w-4 h-4" /> Add Equipment Unit
          </button>
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl hidden group-hover:block z-30 p-1.5 space-y-1">
            {(['RMU', 'Transformer', 'LT_Kiosk', 'VCB', 'Switchgear', 'HT_Panel', 'Meter_Cubicle', 'CSS'] as HTEquipmentModuleType[]).map((type) => (
              <button
                key={type}
                onClick={() => addEquipmentInstance(type)}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-between"
              >
                <span>+ Add {type.replace('_', ' ')}</span>
                <span className="text-[10px] text-slate-400 font-mono">Unit</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace Section */}
      {activeInstanceId === 'site_common' ? (
        <div className="space-y-6">
          <HTAuditFormEngine
            spec={HT_YARD_FIELD_SPECS.HT_Yard_Common}
            equipmentInstanceId="site_common"
            responses={responses}
            onChangeResponse={handleResponseChange}
            customStages={[
              {
                key: 'earth_pit_log',
                title: 'Earth Pit Inspection Log',
                subtitle: 'Auto-calculated based on units',
                content: (
                  <HTEarthPitRegister
                    equipmentInstances={equipmentInstances}
                    responses={responses}
                    onChangeResponse={handleResponseChange}
                  />
                )
              },
              {
                key: 'snag_list',
                title: 'Snag & Punch List',
                subtitle: 'Site-wide defect log',
                content: (
                  <HTSnagListManager
                    snagItems={snagItems}
                    onChange={setSnagItems}
                  />
                )
              }
            ]}
          />
        </div>
      ) : activeInstance && activeSpec ? (
        <div className="space-y-6">
          <HTAuditFormEngine
            spec={activeSpec}
            equipmentInstanceId={activeInstance.id}
            responses={responses}
            onChangeResponse={handleResponseChange}
            customStages={[
              ...((activeInstance.moduleType === 'RMU' || activeInstance.moduleType === 'VCB' || activeInstance.moduleType === 'LT_Kiosk')
                ? [
                    {
                      key: 'feeder_sections',
                      title: 'Feeder & Section Blocks',
                      subtitle: `${activeInstance.feederWayCount || 4} Ways Configured`,
                      content: (
                        <HTFeederRepeater
                          moduleType={activeInstance.moduleType}
                          feederCount={activeInstance.feederWayCount || 4}
                          equipmentInstanceId={activeInstance.id}
                          responses={responses}
                          onChangeResponse={handleResponseChange}
                        />
                      )
                    }
                  ]
                : []),
              {
                key: 'snag_list',
                title: 'Snag & Punch List',
                subtitle: `${activeInstance.instanceName} defect log`,
                content: (
                  <HTSnagListManager
                    snagItems={snagItems.filter(s => s.equipmentInstanceId === activeInstance.id)}
                    onChange={(updatedInstanceSnags) => {
                      const otherSnags = snagItems.filter(s => s.equipmentInstanceId !== activeInstance.id);
                      const tagged = updatedInstanceSnags.map(s => ({ ...s, equipmentInstanceId: activeInstance.id }));
                      setSnagItems([...otherSnags, ...tagged]);
                    }}
                    equipmentInstanceName={activeInstance.instanceName}
                  />
                )
              }
            ]}
          />
        </div>
      ) : null}

      {/* New Audit Modal */}
      {showNewAuditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" /> Start New HT Yard Audit
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Site / Substation Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prestige Tech Park HT Yard"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border ${
                    newSiteName.trim() && allAudits.some(a => a.activeAudit?.siteName?.trim().toLowerCase() === newSiteName.trim().toLowerCase())
                      ? 'border-amber-400 dark:border-amber-600 focus:ring-amber-500/20'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-600'
                  } dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2`}
                />
                {newSiteName.trim() && allAudits.some(a => a.activeAudit?.siteName?.trim().toLowerCase() === newSiteName.trim().toLowerCase()) && (
                  <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> An audit for "{newSiteName.trim()}" already exists. Proceeding will switch to the existing audit.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Client / BESCOM Division
                </label>
                <input
                  type="text"
                  placeholder="e.g. BESCOM East Division"
                  value={newClientDivision}
                  onChange={(e) => setNewClientDivision(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowNewAuditModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateNewAudit(newSiteName, newClientDivision)}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all ${
                  newSiteName.trim() && allAudits.some(a => a.activeAudit?.siteName?.trim().toLowerCase() === newSiteName.trim().toLowerCase())
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {newSiteName.trim() && allAudits.some(a => a.activeAudit?.siteName?.trim().toLowerCase() === newSiteName.trim().toLowerCase())
                  ? 'Switch to Existing Audit'
                  : 'Create Audit Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Site Audit?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete the audit for <strong className="text-slate-800 dark:text-slate-200">"{auditToDelete?.siteName}"</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setAuditToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteAudit}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
