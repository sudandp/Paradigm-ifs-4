import React, { useState, useMemo } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths,
} from "date-fns";
import {
  X, Users, Calendar, Check, Sparkles,
  Shield, Wrench, Leaf, UserCog, BookOpen,
  ChevronRight, CheckCircle2, Globe,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
export interface BulkRosterTargetEmployee {
  empCode: string;
  empName: string;
  department?: string;
  designation?: string;
  site?: string;
  status?: string;
  lifecycleStatus?: string;
  employmentStatus?: string;
  isActiveEmployee?: boolean | string;
  isActive?: boolean;
}

export interface BulkRosterAssignmentResult {
  weeklyOffsByEmpCode: Record<string, string[]>;
  holidayDates: string[];
  affectedCount: number;
  scope: string;
}

interface CategoryOption {
  key: string;
  label: string;
  color: string;
  bgSel: string;
  border: string;
  emoji: string;
  matchFn: (emp: BulkRosterTargetEmployee) => boolean;
}

interface BulkRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: BulkRosterTargetEmployee[];
  departmentList: string[];
  existingWeeklyOffsMap: Record<string, string[]>;
  onSave: (result: BulkRosterAssignmentResult, updatedWOMap: Record<string, string[]>) => Promise<void> | void;
}

// ─────────────────────────────────────────────────────────────────────────────
const DEPT_CATEGORIES: CategoryOption[] = [
  {
    key: "all", label: "All Employees", emoji: "🌐",
    color: "text-slate-700 dark:text-slate-200",
    bgSel: "bg-slate-800 text-white border-transparent",
    border: "border-slate-300 dark:border-slate-600",
    matchFn: () => true,
  },
  {
    key: "security", label: "Security", emoji: "🛡️",
    color: "text-blue-700 dark:text-blue-300",
    bgSel: "bg-blue-700 text-white border-transparent",
    border: "border-blue-300 dark:border-blue-700",
    matchFn: (e) => {
      const d = (e.designation || "").toLowerCase();
      const code = (e.empCode || "").replace(/\D/g, "");
      return code.startsWith("32") || ["security","guard","gunman","aso","supervisor","field officer"].some(k => d.includes(k));
    },
  },
  {
    key: "mep", label: "MEP / Technical", emoji: "🔧",
    color: "text-amber-700 dark:text-amber-300",
    bgSel: "bg-amber-600 text-white border-transparent",
    border: "border-amber-300 dark:border-amber-700",
    matchFn: (e) => {
      const d = (e.designation || "").toLowerCase();
      const code = (e.empCode || "").replace(/\D/g, "");
      return code.startsWith("31") || ["electrician","plumber","tech","mep","stp","wtp","pool","multi","helper"].some(k => d.includes(k));
    },
  },
  {
    key: "housekeeping", label: "Housekeeping", emoji: "🧹",
    color: "text-emerald-700 dark:text-emerald-300",
    bgSel: "bg-emerald-700 text-white border-transparent",
    border: "border-emerald-300 dark:border-emerald-700",
    matchFn: (e) => {
      const d = (e.designation || "").toLowerCase();
      return ["housekeep","hk","cleaner","sweeper","pantry","lady"].some(k => d.includes(k));
    },
  },
  {
    key: "garden", label: "Garden", emoji: "🌿",
    color: "text-teal-700 dark:text-teal-300",
    bgSel: "bg-teal-700 text-white border-transparent",
    border: "border-teal-300 dark:border-teal-700",
    matchFn: (e) => {
      const d = (e.designation || "").toLowerCase();
      return ["garden","horticulture","landscape","weeder","plant"].some(k => d.includes(k));
    },
  },
  {
    key: "admin", label: "Administration", emoji: "👔",
    color: "text-indigo-700 dark:text-indigo-300",
    bgSel: "bg-indigo-700 text-white border-transparent",
    border: "border-indigo-300 dark:border-indigo-700",
    matchFn: (e) => {
      const d = (e.designation || "").toLowerCase();
      return ["manager","officer","admin","hr","accountant","executive","coordinator"].some(k => d.includes(k));
    },
  },
];

const WEEKDAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export const isBulkEmployeeInactive = (emp: BulkRosterTargetEmployee): boolean => {
  if (!emp) return false;
  const s = String(emp.status || '').toLowerCase().trim();
  const l = String(emp.lifecycleStatus || '').toLowerCase().trim();
  const es = String(emp.employmentStatus || '').toLowerCase().trim();
  const inactiveStatuses = [
    'inactive', 'discontinued', 'discontinued / left', 'left',
    'resigned', 'terminated', 'absconded', 'not joined yet',
    'not joined', 'exit', 'relieved', 'separated', 'disabled', 'deactivated'
  ];
  if (inactiveStatuses.includes(s) || inactiveStatuses.includes(l) || inactiveStatuses.includes(es)) {
    return true;
  }
  if (emp.isActiveEmployee === false || emp.isActiveEmployee === 'false') return true;
  if (emp.isActive === false || (emp as any).is_active === false || (emp as any).active === false) return true;
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
export const BulkRosterModal: React.FC<BulkRosterModalProps> = ({
  isOpen, onClose, employees, departmentList, existingWeeklyOffsMap, onSave,
}) => {
  const [step, setStep] = useState<1|2|3>(1);
  const [scopeType, setScopeType] = useState<"category"|"site">("category");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSite, setSelectedSite] = useState("all");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [woEnabled, setWoEnabled] = useState(true);
  const [selectedWoWeekdays, setSelectedWoWeekdays] = useState<Set<number>>(new Set([0]));
  const [holidayEnabled, setHolidayEnabled] = useState(false);
  const [holidayList, setHolidayList] = useState<{date:string;name:string}[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [mergeMode, setMergeMode] = useState<"merge"|"replace">("merge");
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);
  const padDays = Array.from({ length: getDay(monthStart) });

  const scopedEmployees = useMemo(() => {
    // Exclude inactive / separated employees so week off is never assigned to them
    const activeEmployees = employees.filter(e => !isBulkEmployeeInactive(e));
    if (scopeType === "site") {
      if (selectedSite === "all") return activeEmployees;
      return activeEmployees.filter(e =>
        (e.department||"").toLowerCase().trim() === selectedSite.toLowerCase().trim() ||
        (e.site||"").toLowerCase().trim() === selectedSite.toLowerCase().trim()
      );
    }
    const cat = DEPT_CATEGORIES.find(c => c.key === selectedCategory);
    return cat ? activeEmployees.filter(cat.matchFn) : activeEmployees;
  }, [employees, scopeType, selectedCategory, selectedSite]);

  const woDateStrings = useMemo(() => {
    const dates = new Set<string>();
    if (!woEnabled) return dates;
    monthDays.forEach(d => {
      if (selectedWoWeekdays.has(getDay(d))) dates.add(format(d, "yyyy-MM-dd"));
    });
    return dates;
  }, [monthDays, selectedWoWeekdays, woEnabled]);

  const toggleWoDay = (day: number) => setSelectedWoWeekdays(prev => {
    const next = new Set(prev);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    return next;
  });

  const addHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) return;
    setHolidayList(prev => [...prev.filter(h => h.date !== newHolidayDate), { date: newHolidayDate, name: newHolidayName.trim() }]);
    setNewHolidayDate(""); setNewHolidayName("");
  };

  const handleSave = async () => {
    if (!scopedEmployees.length) return;
    setIsSaving(true);
    try {
      const updatedWOMap = { ...existingWeeklyOffsMap };
      const woList = Array.from(woDateStrings);
      const monthStr = format(currentMonth, "yyyy-MM");

      scopedEmployees.forEach(emp => {
        const cleanCode = emp.empCode.toLowerCase().trim();
        const numCode = cleanCode.replace(/^0+/, "");
        if (woEnabled && woList.length > 0) {
          const existing = updatedWOMap[cleanCode] || updatedWOMap[numCode] || [];
          const base = mergeMode === "replace" ? existing.filter(d => !d.startsWith(monthStr)) : existing;
          const merged = Array.from(new Set([...base, ...woList])).sort();
          updatedWOMap[cleanCode] = merged;
          if (numCode !== cleanCode) updatedWOMap[numCode] = merged;
        }
      });

      const scopeLabel = scopeType === "site"
        ? (selectedSite === "all" ? "All Sites" : selectedSite)
        : DEPT_CATEGORIES.find(c => c.key === selectedCategory)?.label || selectedCategory;

      const result: BulkRosterAssignmentResult = {
        weeklyOffsByEmpCode: updatedWOMap,
        holidayDates: holidayList.map(h => h.date),
        affectedCount: scopedEmployees.length,
        scope: scopeLabel,
      };
      await onSave(result, updatedWOMap);
      setSavedMsg(`WO assigned to ${scopedEmployees.length} employees in "${scopeLabel}" for ${format(currentMonth, "MMMM yyyy")}`);
      setStep(3);
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    setStep(1); setScopeType("category"); setSelectedCategory("all"); setSelectedSite("all");
    setCurrentMonth(new Date()); setWoEnabled(true); setSelectedWoWeekdays(new Set([0]));
    setHolidayEnabled(false); setHolidayList([]); setMergeMode("merge"); setSavedMsg("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#072415] rounded-3xl border border-slate-200 dark:border-[#134426] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#134426] bg-gradient-to-r from-emerald-50/80 to-slate-50 dark:from-[#0a2f1c] dark:to-[#072415] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Bulk Roster Assignment
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold">
                  Dept / Category Level
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-emerald-300/70">
                Assign WO & Holidays to all employees in a department at once
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-[#134426] cursor-pointer transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Step bar */}
        <div className="px-5 py-2 border-b border-slate-100 dark:border-[#134426] flex items-center gap-2 bg-slate-50/50 dark:bg-[#072415]/60 shrink-0">
          {(["Scope","Configure","Done"] as const).map((label, i) => {
            const num = i + 1;
            const active = step === num;
            const done = step > num;
            return (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${done ? "bg-emerald-500 text-white" : active ? "bg-[#006B3F] text-white" : "bg-slate-100 dark:bg-[#134426] text-slate-400"}`}>
                  {done ? <Check size={10} /> : num}
                </div>
                <span className={`text-[11px] font-bold ${active ? "text-slate-800 dark:text-white" : "text-slate-400 dark:text-emerald-400/50"}`}>{label}</span>
                {i < 2 && <ChevronRight size={10} className="text-slate-300" />}
              </div>
            );
          })}
          <span className="ml-auto text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
            {scopedEmployees.length} in scope
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── STEP 1: SCOPE ── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Scope type */}
              <div className="flex gap-2">
                {(["category","site"] as const).map(t => (
                  <button key={t} onClick={() => setScopeType(t)}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${scopeType === t ? "bg-[#006B3F] text-white border-transparent shadow" : "bg-white dark:bg-[#0c2e1c] text-slate-600 dark:text-emerald-200 border-slate-200 dark:border-[#134426]"}`}>
                    {t === "category" ? "👥 By Dept / Role Category" : "🏢 By Site / Location"}
                  </button>
                ))}
              </div>

              {/* Category grid */}
              {scopeType === "category" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DEPT_CATEGORIES.map(cat => {
                    const count = employees.filter(cat.matchFn).length;
                    const isSel = selectedCategory === cat.key;
                    return (
                      <button key={cat.key} onClick={() => setSelectedCategory(cat.key)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${isSel ? cat.bgSel : "bg-white dark:bg-[#0c2e1c] border-slate-200 dark:border-[#134426] hover:border-slate-300"}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{cat.emoji}</span>
                          <span className={`text-[11px] font-bold ${isSel ? "" : cat.color}`}>{cat.label}</span>
                        </div>
                        <p className={`text-[10px] mt-1 font-semibold ${isSel ? "text-white/80" : "text-slate-400"}`}>{count} employees</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Site list */}
              {scopeType === "site" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {["all", ...departmentList].map(site => {
                    const count = site === "all" ? employees.length : employees.filter(e => (e.department||"").toLowerCase().trim() === site.toLowerCase().trim()).length;
                    const isSel = selectedSite === site;
                    return (
                      <button key={site} onClick={() => setSelectedSite(site)}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${isSel ? "bg-[#006B3F] text-white border-transparent shadow" : "bg-white dark:bg-[#0c2e1c] border-slate-200 dark:border-[#134426] text-slate-700 dark:text-emerald-100 hover:border-emerald-400"}`}>
                        <span className="truncate">{site === "all" ? "🌐 All Sites" : site}</span>
                        <span className={`ml-2 text-[10px] font-bold shrink-0 ${isSel ? "text-emerald-200" : "text-slate-400"}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Inactive Exclusion Notice & Next button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#134426]">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-emerald-300/70">
                  <Shield size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Inactive and separated staff are automatically excluded.</span>
                </div>
                <button onClick={() => setStep(2)} disabled={scopedEmployees.length === 0}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-[#006B3F] hover:bg-[#005632] disabled:opacity-50 rounded-xl cursor-pointer shadow flex items-center justify-center gap-1.5">
                  Configure Roster ({scopedEmployees.length} Staff) <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: CONFIGURE ── */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Month nav */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#0c2e1c] border border-slate-200 dark:border-[#134426]">
                <button onClick={() => setCurrentMonth(p => subMonths(p, 1))} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] text-slate-700 dark:text-emerald-200 hover:bg-slate-100 cursor-pointer">← Prev</button>
                <div className="text-center">
                  <p className="text-sm font-black text-slate-800 dark:text-white">{format(currentMonth, "MMMM yyyy")}</p>
                  <p className="text-[10px] text-slate-400">{monthDays.length} days</p>
                </div>
                <button onClick={() => setCurrentMonth(p => addMonths(p, 1))} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] text-slate-700 dark:text-emerald-200 hover:bg-slate-100 cursor-pointer">Next →</button>
              </div>

              {/* ── Weekly Off toggle ── */}
              <div className="space-y-3 p-4 rounded-xl bg-amber-50/60 dark:bg-[#1a1000]/40 border border-amber-200 dark:border-amber-900/50">
                <div className="flex items-center gap-2">
                  <button onClick={() => setWoEnabled(v => !v)} className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${woEnabled ? "bg-amber-500" : "bg-slate-200 dark:bg-[#134426]"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${woEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Weekly Off (WO)</span>
                  {woEnabled && <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[10px] font-bold">{woDateStrings.size} dates</span>}
                </div>

                {woEnabled && (
                  <div className="space-y-3">
                    {/* Weekday picker */}
                    <div>
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-1.5">Select Weekly Off Day(s)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAY_SHORT.map((name, idx) => (
                          <button key={idx} onClick={() => toggleWoDay(idx)}
                            className={`w-12 py-1.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${selectedWoWeekdays.has(idx) ? "bg-amber-500 text-white border-amber-600 shadow" : "bg-white dark:bg-[#0c2e1c] border-amber-200 dark:border-amber-900/50 text-slate-600 dark:text-amber-200 hover:border-amber-400"}`}>
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mini calendar preview */}
                    <div className="grid grid-cols-7 gap-0.5 text-center">
                      {WEEKDAY_SHORT.map((d, i) => (
                        <div key={d} className={`text-[9px] font-bold py-1 ${i === 0 ? "text-amber-500" : "text-slate-400 dark:text-emerald-400/50"}`}>{d}</div>
                      ))}
                      {padDays.map((_, i) => <div key={"p"+i} className="h-6" />)}
                      {monthDays.map(d => {
                        const ds = format(d, "yyyy-MM-dd");
                        const isWO = woDateStrings.has(ds);
                        return (
                          <div key={ds} className={`h-6 rounded flex items-center justify-center text-[10px] font-bold ${isWO ? "bg-amber-500 text-white" : "bg-slate-50 dark:bg-[#0c2e1c] text-slate-500 dark:text-emerald-300/60"}`}>
                            {d.getDate()}
                          </div>
                        );
                      })}
                    </div>

                    {/* Merge mode */}
                    <div className="flex gap-2">
                      {(["merge","replace"] as const).map(mode => (
                        <button key={mode} onClick={() => setMergeMode(mode)}
                          className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border cursor-pointer transition-all ${mergeMode === mode ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent" : "bg-white dark:bg-[#0c2e1c] border-slate-200 dark:border-[#134426] text-slate-600 dark:text-emerald-200"}`}>
                          {mode === "merge" ? "🔀 Merge (keep existing)" : "🔄 Replace this month"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Holiday toggle ── */}
              <div className="space-y-3 p-4 rounded-xl bg-sky-50/60 dark:bg-[#001a2e]/40 border border-sky-200 dark:border-sky-900/50">
                <div className="flex items-center gap-2">
                  <button onClick={() => setHolidayEnabled(v => !v)} className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${holidayEnabled ? "bg-sky-500" : "bg-slate-200 dark:bg-[#134426]"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${holidayEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Site Holidays (H)</span>
                  {holidayEnabled && holidayList.length > 0 && <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-[10px] font-bold">{holidayList.length}</span>}
                </div>

                {holidayEnabled && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-400" />
                      <input type="text" placeholder="Holiday name (e.g. Diwali)" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addHoliday()}
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-400" />
                      <button onClick={addHoliday} disabled={!newHolidayDate || !newHolidayName.trim()}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-40 rounded-lg cursor-pointer">+ Add</button>
                    </div>
                    {holidayList.map(h => (
                      <div key={h.date} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40">
                        <span className="font-mono text-[11px] text-sky-700 dark:text-sky-300 font-bold mr-2">{h.date}</span>
                        <span className="text-[11px] text-slate-700 dark:text-slate-200 flex-1">{h.name}</span>
                        <button onClick={() => setHolidayList(p => p.filter(x => x.date !== h.date))} className="text-rose-400 hover:text-rose-600 cursor-pointer text-sm font-bold">×</button>
                      </div>
                    ))}
                    <p className="text-[10px] text-sky-500 dark:text-sky-400">💡 Staff with no punches on these dates show H (+1 payable day)</p>
                  </div>
                )}
              </div>

              {/* Summary + Save */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c2e1c] border border-slate-200 dark:border-[#134426] space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426]">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Employees</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{scopedEmployees.length}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
                    <p className="text-[9px] text-amber-600 uppercase font-bold">WO Dates</p>
                    <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{woEnabled ? woDateStrings.size : 0}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40">
                    <p className="text-[9px] text-sky-600 uppercase font-bold">Holidays</p>
                    <p className="text-2xl font-black text-sky-700 dark:text-sky-300">{holidayEnabled ? holidayList.length : 0}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-emerald-200 bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] rounded-xl cursor-pointer hover:bg-slate-100">← Back</button>
                  <button onClick={handleSave} disabled={isSaving || scopedEmployees.length === 0 || (!woEnabled && !holidayEnabled)}
                    className="flex-1 py-2.5 text-xs font-black text-white bg-[#006B3F] hover:bg-[#005632] disabled:opacity-50 rounded-xl cursor-pointer shadow flex items-center justify-center gap-2">
                    {isSaving ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : <><Sparkles size={13} />Apply to {scopedEmployees.length} Employees</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: SUCCESS ── */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white">✅ Roster Applied!</h4>
                <p className="text-sm text-slate-500 dark:text-emerald-300/70 mt-1 max-w-xs">{savedMsg}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={reset} className="px-5 py-2 text-xs font-bold text-slate-700 dark:text-emerald-200 bg-slate-100 dark:bg-[#134426] rounded-xl cursor-pointer hover:bg-slate-200">Assign Another</button>
                <button onClick={onClose} className="px-5 py-2 text-xs font-bold text-white bg-[#006B3F] hover:bg-[#005632] rounded-xl cursor-pointer shadow">Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
