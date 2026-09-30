import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, Building2, Database } from 'lucide-react';
import type { TrendPoint, DeptRow } from './types';

export interface TrendSectionProps {
  loading: boolean;
  isFetchingMssqlReport?: boolean;
  rangeMssqlReportMap?: Record<string, Record<string, any>>;
  accessibleTrend: TrendPoint[] | any[];
  accessibleDepartments: DeptRow[] | any[];
  departmentFilter: string;
  setDepartmentFilter: (dept: string) => void;
  tableRef?: React.RefObject<HTMLDivElement | null>;
  CustomTooltip?: React.FC<any>;
}

export const TrendSection: React.FC<TrendSectionProps> = React.memo(({
  loading,
  isFetchingMssqlReport = false,
  rangeMssqlReportMap = {},
  accessibleTrend,
  accessibleDepartments,
  departmentFilter,
  setDepartmentFilter,
  tableRef,
  CustomTooltip,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* 7-Day Trend Chart */}
      <div className="lg:col-span-2 bg-white dark:bg-[#072415] rounded-2xl border border-slate-200/80 dark:border-[#134426] p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">7-Day Attendance Trend</h2>
            <p className="text-xs text-slate-500 dark:text-emerald-300/70">Present vs Absent daily</p>
          </div>
          <BarChart3 size={18} className="text-slate-400 dark:text-emerald-400" />
        </div>

        {(loading || (isFetchingMssqlReport && (!rangeMssqlReportMap || Object.keys(rangeMssqlReportMap).length === 0))) ? (
          <div className="h-44 sm:h-52 bg-slate-100 dark:bg-[#0d3820] rounded-xl animate-pulse flex items-center justify-center">
            <span className="text-xs font-semibold text-slate-400 dark:text-emerald-400/70">Syncing 7-day attendance trend...</span>
          </div>
        ) : accessibleTrend && accessibleTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={accessibleTrend} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              {CustomTooltip ? <Tooltip content={<CustomTooltip />} /> : <Tooltip />}
              <Bar dataKey="present" name="Present" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-44 sm:h-52 flex flex-col items-center justify-center text-slate-400 dark:text-emerald-400/60 gap-2">
            <Database size={32} />
            <p className="text-xs font-medium">No trend data available</p>
          </div>
        )}
      </div>

      {/* Site Breakdown */}
      <div className="bg-white dark:bg-[#072415] rounded-2xl border border-slate-200/80 dark:border-[#134426] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">Site Breakdown</h2>
              {departmentFilter !== 'all' && (
                <button
                  onClick={() => setDepartmentFilter('all')}
                  className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 font-bold px-2 py-0.5 rounded-full transition-colors"
                >
                  Clear Filter
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-emerald-300/70">Click any site to view users</p>
          </div>
          <Building2 size={18} className="text-slate-400 dark:text-emerald-400" />
        </div>

        {loading && (!accessibleDepartments || accessibleDepartments.length === 0) ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 bg-slate-100 dark:bg-[#0d3820] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : accessibleDepartments && accessibleDepartments.length > 0 ? (
          <div className="space-y-2 overflow-y-auto max-h-52 pr-1">
            {accessibleDepartments.map((dept: any) => {
              const pct = dept.total > 0 ? Math.round((dept.present / dept.total) * 100) : 0;
              const isSelected = departmentFilter === dept.name;
              return (
                <div
                  key={dept.name}
                  onClick={() => {
                    const nextFilter = isSelected ? 'all' : dept.name;
                    setDepartmentFilter(nextFilter);
                    if (tableRef?.current) {
                      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className={`p-2 rounded-xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-500 shadow-xs'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-[#0d3820]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className={`truncate max-w-[160px] ${isSelected ? 'font-bold text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-emerald-100'}`}>
                      {dept.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isSelected && (
                        <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                      <span className="text-slate-500 dark:text-emerald-300/70 font-mono text-[11px]">{dept.present}/{dept.total}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-[#041b0f] h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-52 flex flex-col items-center justify-center text-slate-400 dark:text-emerald-400/60 gap-2">
            <Building2 size={32} />
            <p className="text-xs font-medium">No site data</p>
          </div>
        )}
      </div>
    </div>
  );
});

TrendSection.displayName = 'TrendSection';
export default TrendSection;
