import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Calendar as CalendarIcon, CheckCircle2, ShieldCheck, 
  Sparkles, ChevronLeft, ChevronRight, Play, X, 
  FolderOpen 
} from 'lucide-react';
import { PPMFrequency, getChecklistForCategory, PPMCategoryChecklist } from '../../config/htPpmChecklists';
import { htPpmSchedulerService, PPMTaskInstance } from '../../services/htPpmSchedulerService';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

export interface HTPpmCalendarViewHandle {
  handleAutoGenerateSchedules: () => Promise<void>;
  loadTasks: () => Promise<void>;
}

export interface HTPpmCalendarViewProps {
  onSelectTask?: (task: PPMTaskInstance) => void;
  hideHeaderBanner?: boolean;
}

export const HTPpmCalendarView = forwardRef<HTPpmCalendarViewHandle, HTPpmCalendarViewProps>(({
  onSelectTask,
  hideHeaderBanner = false,
}, ref) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedFrequency, setSelectedFrequency] = useState<PPMFrequency | 'ALL'>('ALL');
  const [tasks, setTasks] = useState<PPMTaskInstance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTaskForExecution, setActiveTaskForExecution] = useState<PPMTaskInstance | null>(null);
  const [activeChecklist, setActiveChecklist] = useState<PPMCategoryChecklist | null>(null);
  
  // Execution form state
  const [itemResponses, setItemResponses] = useState<Record<string, any>>({});
  const [technicianName, setTechnicianName] = useState('Lead Electrical Engineer');
  const [overallRemarks, setOverallRemarks] = useState('');

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const loaded = await htPpmSchedulerService.getTasks(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        selectedFrequency
      );
      setTasks(loaded);
    } catch (e) {
      console.error('Failed to load PPM tasks', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [currentDate, selectedFrequency]);

  const handlePrevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleOpenExecution = (task: PPMTaskInstance) => {
    setActiveTaskForExecution(task);
    const checklist = getChecklistForCategory(task.category, task.frequency) || null;
    setActiveChecklist(checklist);

    // Initialize item responses
    const initial: Record<string, any> = {};
    if (checklist) {
      checklist.items.forEach(item => {
        initial[item.id] = {
          checked: false,
          numericValue: undefined,
          remarks: ''
        };
      });
    }
    setItemResponses(initial);
    setOverallRemarks('');
  };

  const handleSubmitPpmCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTaskForExecution) return;

    await htPpmSchedulerService.completeTask(
      activeTaskForExecution.id,
      technicianName,
      itemResponses,
      overallRemarks
    );

    toast.success(`✅ ${activeTaskForExecution.frequency} PPM Completed & Saved to Database!`, { icon: '🏆' });
    setActiveTaskForExecution(null);
    setActiveChecklist(null);
    await loadTasks();
  };

  const handleAutoGenerateSchedules = async () => {
    try {
      // 1. Fetch all real equipment instances from Supabase
      const { data: equipRows } = await supabase
        .from('ht_equipment_instances')
        .select('id, instance_name, module_type');

      if (equipRows && equipRows.length > 0) {
        for (const eq of equipRows) {
          const category = (eq.module_type === 'Transformer' ? 'TRANSFORMER' :
                            eq.module_type === 'LT_Kiosk' ? 'LT_KIOSK' :
                            eq.module_type === 'HT_Panel' ? 'HT_PANEL' : 'RMU') as any;
          await htPpmSchedulerService.autoGeneratePpmForAsset(eq.id, eq.instance_name, category);
        }
        toast.success(`✨ Scheduled PPM tasks for ${equipRows.length} registered equipment units!`);
      } else {
        // Fallback: check local storage audits
        const raw = localStorage.getItem('ht_draft_audits_v1');
        const audits = raw ? JSON.parse(raw) : [];
        let scheduledCount = 0;

        for (const a of audits) {
          const instances = a.equipmentInstances || [];
          for (const eq of instances) {
            const category = (eq.moduleType === 'Transformer' ? 'TRANSFORMER' :
                              eq.moduleType === 'LT_Kiosk' ? 'LT_KIOSK' :
                              eq.moduleType === 'HT_Panel' ? 'HT_PANEL' : 'RMU') as any;
            await htPpmSchedulerService.autoGeneratePpmForAsset(eq.id, eq.instanceName || eq.name, category);
            scheduledCount++;
          }
        }

        if (scheduledCount > 0) {
          toast.success(`✨ Scheduled PPM tasks for ${scheduledCount} equipment units!`);
        } else {
          // Initialize for default equipment
          await htPpmSchedulerService.autoGeneratePpmForAsset('HT-RMU-01', '11kV Ring Main Unit (RMU-01)', 'RMU');
          toast.success('✨ Initialized first PPM maintenance cycle!');
        }
      }
      await loadTasks();
    } catch (err) {
      console.error(err);
      toast.error('Failed to auto-generate PPM schedules');
    }
  };

  useImperativeHandle(ref, () => ({
    handleAutoGenerateSchedules,
    loadTasks,
  }));

  // Month stats
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
  const pendingCount = tasks.length - completedCount;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions (Optional) */}
      {!hideHeaderBanner && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/80 border border-emerald-500/30 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center font-bold text-xl shrink-0">
              🗓️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black uppercase tracking-wide text-white">
                  Planned Preventive Maintenance (PPM) Calendar
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  Supabase Synced
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Automated recurring maintenance checklists across Daily, Weekly, Monthly, Quarterly & Yearly engineering intervals.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAutoGenerateSchedules}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> Auto-Schedule From Equipment Fleet
          </button>
        </div>
      )}

      {/* Frequency Filter Toolbar & Month Navigator */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Frequency Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const).map(freq => (
            <button
              key={freq}
              type="button"
              onClick={() => setSelectedFrequency(freq)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                selectedFrequency === freq
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {freq === 'ALL' && '⚡ All Frequencies'}
              {freq === 'DAILY' && '🌅 Daily'}
              {freq === 'WEEKLY' && '📅 Weekly'}
              {freq === 'MONTHLY' && '🗓️ Monthly'}
              {freq === 'QUARTERLY' && '📊 Quarterly'}
              {freq === 'YEARLY' && '🏆 Yearly'}
            </button>
          ))}
        </div>

        {/* Month Navigator */}
        <div className="flex items-center justify-between md:justify-end gap-3">
          <span className="text-xs font-bold text-slate-500">
            {completedCount} Done • {pendingCount} Pending
          </span>
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-black text-slate-800 dark:text-slate-100 min-w-[120px] text-center">
              {monthName}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Task List Grid / Empty State */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold">Loading maintenance schedules from Supabase...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4 p-6">
          <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <div>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">No PPM Tasks Scheduled for {monthName}</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Click the button below to automatically generate recurring maintenance tasks for your equipment fleet.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAutoGenerateSchedules}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> Initialize PPM Schedule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map(task => {
            const isCompleted = task.status === 'COMPLETED';
            const checklist = getChecklistForCategory(task.category, task.frequency);
            const itemCount = checklist?.items.length || 3;

            return (
              <div
                key={task.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md ${
                  isCompleted
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      task.frequency === 'DAILY' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                      task.frequency === 'WEEKLY' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                      task.frequency === 'MONTHLY' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                      task.frequency === 'QUARTERLY' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' :
                      'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                    }`}>
                      {task.frequency} PPM
                    </span>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {isCompleted ? '✅ Completed' : '⏳ Scheduled'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                      {task.assetName}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500 block">
                      ID: {task.assetId} • {task.category}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                      <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" /> {task.scheduledDate}
                    </span>
                    <span>•</span>
                    <span>{itemCount} Checkpoints</span>
                  </div>
                </div>

                {/* Footer action */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {isCompleted ? (
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Signed off by {task.completedBy || 'Engineer'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenExecution(task)}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" /> Execute & Sign Off Checklist
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CHECKLIST EXECUTION MODAL DRAWER */}
      {activeTaskForExecution && activeChecklist && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 uppercase">
                    {activeTaskForExecution.frequency} PPM Checklist
                  </span>
                  <span className="text-xs text-slate-400">Target: {activeTaskForExecution.scheduledDate}</span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                  {activeTaskForExecution.assetName}
                </h3>
              </div>
              <button
                onClick={() => { setActiveTaskForExecution(null); setActiveChecklist(null); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Checklist Items Form */}
            <form onSubmit={handleSubmitPpmCompletion} className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="space-y-3">
                {activeChecklist.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {item.taskTitle}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-7">
                          {item.description}
                        </p>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium pl-7">
                          Acceptance: {item.acceptanceCriteria}
                        </div>
                      </div>

                      {/* Input Type */}
                      {item.inputType === 'BOOLEAN' && (
                        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={itemResponses[item.id]?.checked || false}
                            onChange={(e) => {
                              setItemResponses({
                                ...itemResponses,
                                [item.id]: {
                                  ...itemResponses[item.id],
                                  checked: e.target.checked
                                }
                              });
                            }}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            Pass / Verified
                          </span>
                        </label>
                      )}
                    </div>

                    {/* Numeric Input */}
                    {item.inputType === 'NUMERIC' && (
                      <div className="pl-7 flex items-center gap-3">
                        <div className="relative w-48">
                          <input
                            type="number"
                            step="any"
                            placeholder={`Enter measured ${item.unit || 'value'}...`}
                            value={itemResponses[item.id]?.numericValue || ''}
                            onChange={(e) => {
                              setItemResponses({
                                ...itemResponses,
                                [item.id]: {
                                  ...itemResponses[item.id],
                                  numericValue: parseFloat(e.target.value),
                                  checked: true
                                }
                              });
                            }}
                            className="w-full pl-3 pr-12 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          />
                          {item.unit && (
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-slate-400">
                              {item.unit}
                            </span>
                          )}
                        </div>
                        {item.minTolerance !== undefined && (
                          <span className="text-[10px] text-slate-400 font-bold">
                            Min: {item.minTolerance} {item.unit}
                          </span>
                        )}
                        {item.maxTolerance !== undefined && (
                          <span className="text-[10px] text-slate-400 font-bold">
                            Max: {item.maxTolerance} {item.unit}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Technician Signoff & Remarks */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Signing Electrical Engineer
                  </label>
                  <input
                    type="text"
                    required
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Overall PPM Engineering Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="All maintenance checks completed in compliance with OEM standards..."
                    value={overallRemarks}
                    onChange={(e) => setOverallRemarks(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white resize-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setActiveTaskForExecution(null); setActiveChecklist(null); }}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" /> Submit & Sign Off PPM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
