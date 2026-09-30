import React from 'react';
import { Sliders, RotateCcw, Wrench, Sparkles, Flower2, Shield, UserCheck, Layers } from 'lucide-react';
import type { DepartmentStat } from './types';

interface DepartmentGridProps {
  departments: DepartmentStat[];
  selectedDepartment: string;
  onDepartmentSelect: (deptName: string) => void;
  onOpenRoleMapping?: () => void;
  onOpenSyncOverrides?: () => void;
}

const DEPT_ICONS: Record<string, React.ReactNode> = {
  mep: <Wrench size={14} className="text-amber-500" />,
  housekeeping: <Sparkles size={14} className="text-sky-500" />,
  garden: <Flower2 size={14} className="text-emerald-500" />,
  security: <Shield size={14} className="text-blue-500" />,
  admin: <UserCheck size={14} className="text-purple-500" />,
  other: <Layers size={14} className="text-slate-500" />,
};

export const DepartmentGrid: React.FC<DepartmentGridProps> = React.memo(({
  departments,
  selectedDepartment,
  onDepartmentSelect,
  onOpenRoleMapping,
  onOpenSyncOverrides,
}) => {
  return (
    <div className="bg-white dark:bg-[#072415] rounded-2xl border border-slate-200/80 dark:border-[#134426] shadow-xs p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#134426] pb-3">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-emerald-600 dark:text-[#44D62C]" />
          <h2 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm uppercase tracking-wider">
            Department Wise Attendance Breakdown
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Present Days vs Deployment
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenRoleMapping && (
            <button
              onClick={onOpenRoleMapping}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#134426] text-[11px] font-bold text-slate-700 dark:text-emerald-200 hover:bg-slate-50 dark:hover:bg-[#0d3820] transition-colors cursor-pointer"
            >
              <Sliders size={13} className="text-slate-500 dark:text-emerald-400" />
              Assign Roles
            </button>
          )}
          {onOpenSyncOverrides && (
            <button
              onClick={onOpenSyncOverrides}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#134426] text-[11px] font-bold text-slate-700 dark:text-emerald-200 hover:bg-slate-50 dark:hover:bg-[#0d3820] transition-colors cursor-pointer"
            >
              <RotateCcw size={13} className="text-slate-500 dark:text-emerald-400" />
              Sync / Reset Overrides
            </button>
          )}
          <span className="text-[11px] font-semibold text-slate-400 dark:text-emerald-400/60 pl-1">
            6 Core Departments
          </span>
        </div>
      </div>

      {/* Grid of Department Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {departments.map((dept) => {
          const key = dept.name.toLowerCase();
          const icon = DEPT_ICONS[key] || <Layers size={14} className="text-emerald-500" />;
          const deployed = dept.deployedCount || dept.total || 0;
          const present = dept.present;
          const absent = Math.max(0, deployed - present);
          const pct = deployed > 0 ? Math.round((present / deployed) * 100) : 0;
          const isSelected = selectedDepartment.toLowerCase() === key;

          return (
            <div
              key={dept.name}
              onClick={() => onDepartmentSelect(dept.name)}
              className={`p-3 rounded-xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                isSelected
                  ? 'border-[#44D62C] ring-2 ring-[#44D62C]/30 bg-emerald-50/20 dark:bg-[#0c3821]'
                  : 'border-slate-200/80 dark:border-[#134426] bg-slate-50/50 dark:bg-[#0a2f1b] hover:border-slate-300 dark:hover:border-[#22633c]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    {icon}
                    <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                      {dept.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-emerald-300/60 shrink-0">
                    {pct}%
                  </span>
                </div>

                <div className="flex items-baseline gap-1 my-1">
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {present}
                  </span>
                  <span className="text-xs font-semibold text-slate-400 dark:text-emerald-300/60">
                    / {deployed}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-emerald-400/50 ml-auto">
                    PRESENT / DEPLOYED
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-200 dark:bg-[#134426] rounded-full overflow-hidden my-1.5">
                  <div
                    className="h-full bg-emerald-500 dark:bg-[#44D62C] rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/50 dark:border-[#134426] flex items-center justify-between text-[10px] text-slate-400 dark:text-emerald-400/60 mt-1">
                <span>{absent} Absent</span>
                <span className="font-bold text-sky-600 dark:text-sky-400 hover:underline">
                  Plan & Users →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

DepartmentGrid.displayName = 'DepartmentGrid';
export default DepartmentGrid;
