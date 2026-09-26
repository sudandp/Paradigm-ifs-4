import React, { useState, useEffect, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  getDay,
} from 'date-fns';
import { X, Calendar, Check, RotateCcw, Sparkles, UserCheck, Shield, AlertTriangle } from 'lucide-react';

interface WeeklyOffFeedingModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    empCode: string;
    empName: string;
    department?: string;
    designation?: string;
    site?: string;
    status?: string;
    lifecycleStatus?: string;
    isActiveEmployee?: boolean | string;
    isActive?: boolean;
  } | null;
  activeMonth?: Date;
  initialWeeklyOffs?: string[]; // e.g. ['2026-09-06', '2026-09-13']
  onSave: (empCode: string, dates: string[]) => Promise<void> | void;
}

export const WeeklyOffFeedingModal: React.FC<WeeklyOffFeedingModalProps> = ({
  isOpen,
  onClose,
  employee,
  activeMonth = new Date(),
  initialWeeklyOffs = [],
  onSave,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(activeMonth);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(initialWeeklyOffs));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentMonth(activeMonth);
      setSelectedDates(new Set(initialWeeklyOffs));
    }
  }, [isOpen, activeMonth, initialWeeklyOffs]);

  // Calendar days generation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

  // Lead padding days for start of week (Sunday start)
  const startDayOfWeek = getDay(monthStart); // 0 = Sun, 1 = Mon ...
  const padDays = Array.from({ length: startDayOfWeek });

  const isInactive = useMemo(() => {
    if (!employee) return false;
    const s = String(employee.status || '').toLowerCase().trim();
    const l = String(employee.lifecycleStatus || '').toLowerCase().trim();
    const inactiveStatuses = [
      'inactive', 'discontinued', 'discontinued / left', 'left',
      'resigned', 'terminated', 'absconded', 'not joined yet',
      'not joined', 'exit', 'relieved', 'separated', 'disabled', 'deactivated'
    ];
    if (inactiveStatuses.includes(s) || inactiveStatuses.includes(l)) return true;
    if (employee.isActiveEmployee === false || employee.isActiveEmployee === 'false') return true;
    if (employee.isActive === false) return true;
    return false;
  }, [employee]);

  const toggleDate = (dateStr: string) => {
    if (isInactive) return;
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  // Quick preset: Mark all of a specific weekday in current month
  const markAllWeekday = (targetDay: number) => {
    if (isInactive) return;
    setSelectedDates(prev => {
      const next = new Set(prev);
      monthDays.forEach(d => {
        if (getDay(d) === targetDay) {
          next.add(format(d, 'yyyy-MM-dd'));
        }
      });
      return next;
    });
  };

  const clearCurrentMonth = () => {
    if (isInactive) return;
    setSelectedDates(prev => {
      const next = new Set(prev);
      monthDays.forEach(d => {
        next.delete(format(d, 'yyyy-MM-dd'));
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!employee || isInactive) return;
    setIsSaving(true);
    try {
      await onSave(employee.empCode, Array.from(selectedDates));
      onClose();
    } catch (err) {
      console.error('Error saving weekly offs:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !employee) return null;

  const currentMonthSelectedCount = monthDays.filter(d => selectedDates.has(format(d, 'yyyy-MM-dd'))).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#072415] rounded-3xl border border-slate-200 dark:border-[#134426] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-[#134426] flex items-center justify-between bg-slate-50/70 dark:bg-[#0a2f1c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Feed Weekly Offs (WO)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold tracking-wide">
                  Calendar Picker
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-emerald-300/70">
                Click exact dates to assign or remove weekly offs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-[#134426] transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Employee Card */}
        <div className="px-5 py-3.5 bg-amber-50/50 dark:bg-[#0d3b24]/40 border-b border-amber-100/60 dark:border-[#134426] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{employee.empName}</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 bg-white dark:bg-[#072415] rounded border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300">
                {employee.empCode}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-emerald-300/80 mt-0.5">
              {employee.designation || 'Staff'} • {employee.site || employee.department || 'Site Staff'}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
              {currentMonthSelectedCount} WO Selected
            </span>
            <div className="text-[10px] text-slate-400 dark:text-emerald-400/60">
              for {format(currentMonth, 'MMM yyyy')}
            </div>
          </div>
        </div>

        {/* Inactive Notice Banner */}
        {isInactive && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300 font-bold">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>This employee is inactive or separated. Weekly offs cannot be assigned to inactive staff.</span>
          </div>
        )}

        {/* Month Navigation & Presets */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
              className="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-emerald-200 bg-slate-100 hover:bg-slate-200 dark:bg-[#134426] dark:hover:bg-[#1b5e34] rounded-lg transition-all cursor-pointer"
            >
              ← Prev
            </button>
            <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <button
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
              className="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-emerald-200 bg-slate-100 hover:bg-slate-200 dark:bg-[#134426] dark:hover:bg-[#1b5e34] rounded-lg transition-all cursor-pointer"
            >
              Next →
            </button>
          </div>

          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center gap-1.5 py-1 border-y border-slate-100 dark:border-[#134426]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Quick:</span>
            <button
              onClick={() => markAllWeekday(0)}
              className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300 transition-all cursor-pointer"
            >
              + All Sundays
            </button>
            <button
              onClick={() => markAllWeekday(1)}
              className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#134426] dark:text-emerald-200 transition-all cursor-pointer"
            >
              + All Mondays
            </button>
            <button
              onClick={() => markAllWeekday(2)}
              className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#134426] dark:text-emerald-200 transition-all cursor-pointer"
            >
              + All Tuesdays
            </button>
            <button
              onClick={clearCurrentMonth}
              className="ml-auto px-2 py-0.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-all cursor-pointer flex items-center gap-1"
            >
              <RotateCcw size={10} /> Clear Month
            </button>
          </div>

          {/* 7-Column Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center pt-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, idx) => (
              <div
                key={dayName}
                className={`text-[11px] font-bold py-1 uppercase tracking-wider ${
                  idx === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-emerald-400/60'
                }`}
              >
                {dayName}
              </div>
            ))}

            {/* Empty Lead Pads */}
            {padDays.map((_, i) => (
              <div key={`pad-${i}`} className="h-10 rounded-xl bg-transparent" />
            ))}

            {/* Month Day Tiles */}
            {monthDays.map(dayDate => {
              const dateStr = format(dayDate, 'yyyy-MM-dd');
              const isSelected = selectedDates.has(dateStr);
              const dayNum = dayDate.getDate();
              const isSun = getDay(dayDate) === 0;

              return (
                <button
                  key={dateStr}
                  onClick={() => toggleDate(dateStr)}
                  className={`h-11 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer relative border text-xs font-bold ${
                    isSelected
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs scale-[0.98]'
                      : isSun
                      ? 'bg-amber-50/50 hover:bg-amber-100/70 dark:bg-[#0d3b24]/30 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-900/40'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#0c2e1c] text-slate-700 dark:text-emerald-100 border-slate-200/60 dark:border-[#134426]'
                  }`}
                >
                  <span className="text-[12px]">{dayNum}</span>
                  {isSelected && (
                    <span className="text-[8px] font-mono tracking-tighter uppercase px-1 rounded bg-amber-700 text-white mt-0.5">
                      WO
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 dark:text-emerald-400/60 text-center pt-2">
            💡 Tap any day tile to toggle it as Weekly Off. Selected days count as <strong>WO</strong> in attendance calculations.
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-[#134426] bg-slate-50/50 dark:bg-[#0a2f1c] flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-500 dark:text-emerald-300">
            Total active WO: <span className="font-bold text-amber-600">{selectedDates.size} days</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:text-emerald-200 dark:hover:bg-[#134426] rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isInactive}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              {isSaving ? 'Saving...' : isInactive ? 'Inactive Staff' : 'Save Weekly Offs'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
