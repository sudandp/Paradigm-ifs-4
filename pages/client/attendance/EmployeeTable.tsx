import React from 'react';
import {
  Search,
  LayoutGrid,
  Table as TableIcon,
  X,
  Database,
  UserPlus,
  Building2,
  Clock,
  Pencil,
  Calendar,
  Filter,
  CheckSquare,
  Square,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Users,
  Bell
} from 'lucide-react';
import { EmployeeRow } from './types';

export interface EmployeeTableProps {
  onNotifyMissedPunchOut?: (emp: any) => void;
  paginatedEmployees: EmployeeRow[] | any[];
  filteredEmployees: EmployeeRow[] | any[];
  loading: boolean;
  selectedDate: string;
  data: any;
  s: any;
  selectedDeptCard: any;
  setSelectedDeptCard: (dept: any) => void;
  shiftFilter: string;
  setShiftFilter: (filter: string) => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  search: string;
  setSearch: (search: string) => void;
  activeViewMode: 'cards' | 'table';
  setViewMode: (mode: 'cards' | 'table') => void;
  columnFilters: Record<string, string[]>;
  clearAllColumnFilters: () => void;
  toggleColumnFilterVal: (colKey: string, val: string) => void;
  selectAllColumnFilterVals: (colKey: string, vals: string[]) => void;
  clearColumnFilter: (colKey: string) => void;
  columnSearchQuery: Record<string, string>;
  setColumnSearchQuery: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  columnUniqueValuesMap: Record<string, { val: string; count: number }[]>;
  activeFilterDropdown: string | null;
  setActiveFilterDropdown: (colKey: string | null) => void;
  filterDropdownRef: React.RefObject<HTMLDivElement | null>;
  handleSort: (col: any) => void;
  sortKey: any;
  sortDir: 'asc' | 'desc';
  SortIcon: React.FC<{ col: any }>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  pageSize: number;
  empOverrides: Record<string, any>;
  editingEmpCode: string | null;
  canEditEmployee: (department?: string) => boolean;
  openEditModal: (emp: any) => void;
  onFeedWeeklyOff: (emp: any, displayEmpName: string, displaySite: string) => void;
  formatLiveWorkingHours: (emp: any, selectedDate?: string) => string;
  isSecurityGuardWithoutWeekOff: (params: any) => boolean;
  isAdminUser: boolean;
  StatusBadge: React.FC<any>;
  ShiftBadge: React.FC<any>;
  DEPARTMENT_METAS: Record<string, any>;
  getEmployeeDepartment: (params: any) => string;

  // ── Bulk Selection & Upload Props ──
  selectedEmpCodes?: Set<string>;
  onToggleSelectEmp?: (empCode: string) => void;
  onToggleSelectAll?: () => void;
  onQuickSelectUnallocated?: () => void;
  onQuickSelectSite?: () => void;
  onClearSelection?: () => void;
  onOpenBulkEditModal?: () => void;
  onOpenBulkUploadModal?: () => void;
  onDownloadPreFilledExcel?: () => void;
  currentSiteName?: string;
}

export const EmployeeTable: React.FC<EmployeeTableProps> = React.memo(({
  paginatedEmployees,
  filteredEmployees,
  loading,
  selectedDate,
  data,
  s,
  selectedDeptCard,
  setSelectedDeptCard,
  shiftFilter,
  setShiftFilter,
  statusFilter,
  setStatusFilter,
  search,
  setSearch,
  activeViewMode,
  setViewMode,
  columnFilters,
  clearAllColumnFilters,
  toggleColumnFilterVal,
  selectAllColumnFilterVals,
  clearColumnFilter,
  columnSearchQuery,
  setColumnSearchQuery,
  columnUniqueValuesMap,
  activeFilterDropdown,
  setActiveFilterDropdown,
  filterDropdownRef,
  handleSort,
  sortKey,
  sortDir,
  SortIcon,
  currentPage,
  setCurrentPage,
  totalPages,
  pageSize,
  empOverrides,
  editingEmpCode,
  canEditEmployee,
  openEditModal,
  onFeedWeeklyOff,
  formatLiveWorkingHours,
  isSecurityGuardWithoutWeekOff,
  isAdminUser,
  StatusBadge,
  ShiftBadge,
  DEPARTMENT_METAS,
  getEmployeeDepartment,
  selectedEmpCodes,
  onToggleSelectEmp,
  onToggleSelectAll,
  onQuickSelectUnallocated,
  onQuickSelectSite,
  onClearSelection,
  onOpenBulkEditModal,
  onOpenBulkUploadModal,
  onDownloadPreFilledExcel,
  currentSiteName,
  onNotifyMissedPunchOut,
}) => {
  const isAllSelected = paginatedEmployees.length > 0 && paginatedEmployees.every(e => selectedEmpCodes?.has(e.empCode));
  const isSomeSelected = paginatedEmployees.some(e => selectedEmpCodes?.has(e.empCode));

  return (
    <div className="bg-white dark:bg-[#072415] rounded-2xl border border-slate-200 dark:border-[#134426] shadow-xs overflow-hidden">
      {/* Table header + filters */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-[#134426] flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5 flex-wrap">
            <span>Employee Attendance Details</span>
            {!loading && (
              <span className="text-xs font-normal text-slate-500 dark:text-emerald-300/70">
                ({filteredEmployees.length} active of {s?.totalHeadcount ?? data?.employees.length ?? 0} total)
              </span>
            )}
            {selectedDeptCard !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-[#44D62C] border border-emerald-300 dark:border-emerald-800 animate-in fade-in">
                <span>{DEPARTMENT_METAS[selectedDeptCard]?.icon}</span>
                <span>Dept: {DEPARTMENT_METAS[selectedDeptCard]?.label}</span>
                <button
                  type="button"
                  onClick={() => setSelectedDeptCard('all')}
                  className="ml-1 text-slate-500 hover:text-red-500 dark:hover:red-400 font-extrabold cursor-pointer"
                  title="Clear department filter"
                >
                  ×
                </button>
              </span>
            )}
          </h2>

          {/* Mobile View Mode Switcher */}
          <div className="flex md:hidden items-center bg-slate-100 dark:bg-[#041b0f] p-0.5 rounded-xl border border-slate-200 dark:border-[#134426] shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeViewMode === 'cards'
                  ? 'bg-[#44D62C] text-[#041b0f] shadow-xs font-extrabold'
                  : 'text-slate-600 dark:text-emerald-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Card View (Mobile Optimized)"
            >
              <LayoutGrid size={13} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeViewMode === 'table'
                  ? 'bg-[#44D62C] text-[#041b0f] shadow-xs font-extrabold'
                  : 'text-slate-600 dark:text-emerald-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Table View (Full Columns)"
            >
              <TableIcon size={13} />
              <span>Table</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Shift filter */}
          <select
            value={shiftFilter}
            onChange={e => setShiftFilter(e.target.value)}
            className="text-xs border border-slate-200 dark:border-[#1a5532] rounded-lg px-2.5 py-1.5 bg-white dark:bg-[#0d3820] text-slate-700 dark:text-emerald-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 flex-1 sm:flex-initial"
          >
            <option value="all" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">All Shifts</option>
            <option value="DoubleTriple" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">⚠️ Multi-Shift (Double/Triple)</option>

            {selectedDeptCard === 'security' && (
              <>
                <option value="Security Day Duty (12h)" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🛡️ Security Day Duty (12h | 08:00 AM - 08:00 PM)</option>
                <option value="Security Night Duty (12h)" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🛡️ Security Night Duty (12h | 08:00 PM - 08:00 AM)</option>
              </>
            )}

            {selectedDeptCard === 'mep' && (
              <>
                <option value="A Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">⚡ A Shift (07:00 AM - 02:00 PM)</option>
                <option value="B Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">⚡ B Shift (02:00 PM - 09:00 PM)</option>
                <option value="C Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">⚡ C Shift (09:00 PM - 07:00 AM)</option>
                <option value="General Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🏢 General Shift (09:00 AM - 06:00 PM)</option>
                <option value="A + B Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">⚡ A + B Shift (07:00 AM - 09:00 PM | 2 Duties)</option>
                <option value="B + C Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">⚡ B + C Shift (02:00 PM - 07:00 AM | 2 Duties)</option>
                <option value="A + C Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">⚡ A + C Shift (07:00 AM - 07:00 AM | 2 Duties)</option>
                <option value="A + B + C Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">⚡ A + B + C Shift (07:00 AM - 07:00 AM | 3 Duties)</option>
              </>
            )}

            {selectedDeptCard === 'housekeeping' && (
              <>
                <option value="HK Morning Shift" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🧹 HK Morning Shift (07:00 AM - 04:00 PM)</option>
                <option value="HK General Shift" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🧹 HK General Shift (08:00 AM - 05:00 PM)</option>
              </>
            )}

            {selectedDeptCard === 'garden' && (
              <option value="Garden Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🌿 Garden Shift (08:00 AM - 05:00 PM)</option>
            )}

            {(selectedDeptCard === 'administration' || selectedDeptCard === 'other') && (
              <option value="General Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🏢 General Shift (09:00 AM - 06:00 PM)</option>
            )}

            {selectedDeptCard === 'all' && (
              <>
                <option value="A Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">⚡ MEP: A Shift (07:00 AM - 02:00 PM)</option>
                <option value="B Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">⚡ MEP: B Shift (02:00 PM - 09:00 PM)</option>
                <option value="C Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">⚡ MEP: C Shift (09:00 PM - 07:00 AM)</option>
                <option value="Security Day Duty (12h)" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🛡️ Security: Day Duty (12h | 08:00 AM - 08:00 PM)</option>
                <option value="Security Night Duty (12h)" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🛡️ Security: Night Duty (12h | 08:00 PM - 08:00 AM)</option>
                <option value="HK Morning Shift" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🧹 HK: Morning Shift (07:00 AM - 04:00 PM)</option>
                <option value="HK General Shift" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🧹 HK: General Shift (08:00 AM - 05:00 PM)</option>
                <option value="Garden Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🌿 Garden Shift (08:00 AM - 05:00 PM)</option>
                <option value="General Shift Group" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">🏢 General Shift (09:00 AM - 06:00 PM)</option>
              </>
            )}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 dark:border-[#1a5532] rounded-lg px-2.5 py-1.5 bg-white dark:bg-[#0d3820] text-slate-700 dark:text-emerald-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 flex-1 sm:flex-initial"
          >
            <option value="Present" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">Present (All)</option>
            <option value="OnDuty" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">On Duty (Active)</option>
            <option value="Completed" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">Shift Completed (6+ hrs)</option>
            <option value="all" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">
              {s?.deployedTotal ? `Deployed Staff (${s.deployedTotal})` : `All Active (${s?.activeTotal ?? 0})`}
            </option>
            <option value="Absent" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">Absent ({s?.absent ?? 0})</option>
            <option value="Late" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">Late ({s?.late ?? 0})</option>
            <option value="Half Day" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">Half Day</option>
            <option value="Inactive" className="bg-white dark:bg-[#072415] text-slate-900 dark:text-white">Inactive Employees ({s?.inactiveTotal ?? 0})</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 sm:flex-initial min-w-[140px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-emerald-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search employee..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-[#1a5532] rounded-lg bg-white dark:bg-[#0d3820] text-slate-700 dark:text-emerald-100 placeholder-slate-400 dark:placeholder-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-full sm:w-44"
            />
          </div>

          {/* Desktop View Mode Switcher */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-[#041b0f] p-0.5 rounded-xl border border-slate-200 dark:border-[#134426]">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-all ${
                activeViewMode === 'cards'
                  ? 'bg-[#44D62C] text-[#041b0f] shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-emerald-300 dark:hover:text-white'
              }`}
              title="Cards View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                activeViewMode === 'table'
                  ? 'bg-[#44D62C] text-[#041b0f] shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-emerald-300 dark:hover:text-white'
              }`}
              title="Table View"
            >
              <TableIcon size={14} />
            </button>
          </div>

          {/* Bulk Selection & Upload Quick Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onOpenBulkUploadModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-[#0d3820] dark:text-emerald-200 dark:hover:bg-[#1a5532] border border-emerald-300 dark:border-[#1a5532] transition-all cursor-pointer shadow-xs active:scale-95"
              title="Upload Excel or CSV file to bulk update employees"
            >
              <Upload size={13} className="text-emerald-600 dark:text-[#44D62C]" />
              <span>Upload Excel</span>
            </button>

            <button
              type="button"
              onClick={onQuickSelectUnallocated}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Select all staff with unallocated or auto-mapped sites"
            >
              <span>Select Unallocated</span>
            </button>

            {currentSiteName && currentSiteName !== 'all' && (
              <button
                type="button"
                onClick={onQuickSelectSite}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-[#041b0f] dark:text-emerald-300 border border-slate-300 dark:border-[#1a5532] transition-all cursor-pointer shadow-xs active:scale-95"
                title={`Select all staff currently deployed at ${currentSiteName}`}
              >
                <span>Select All at {currentSiteName}</span>
              </button>
            )}

            {selectedEmpCodes && selectedEmpCodes.size > 0 && (
              <button
                type="button"
                onClick={onOpenBulkEditModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold text-[#041b0f] bg-[#44D62C] hover:bg-[#38b824] shadow-md transition-all cursor-pointer active:scale-95"
                title={`Bulk update ${selectedEmpCodes.size} selected employees`}
              >
                <Pencil size={13} />
                <span>Bulk Update ({selectedEmpCodes.size})</span>
              </button>
            )}
          </div>

          {/* Clear Filters */}
          {Object.keys(columnFilters).length > 0 && (
            <button
              onClick={clearAllColumnFilters}
              className="flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
              title="Clear all smart column filters"
            >
              <X size={13} />
              Clear Filters ({Object.keys(columnFilters).length})
            </button>
          )}
        </div>
      </div>

      {/* Table vs Cards View */}
      {activeViewMode === 'cards' ? (
        <div className="p-3 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-[#041b0f]/60">
          {loading && (!paginatedEmployees || paginatedEmployees.length === 0) ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] animate-pulse space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-[#0d3820] rounded" />
                  <div className="h-6 w-20 bg-slate-200 dark:bg-[#0d3820] rounded-full" />
                </div>
                <div className="h-3 w-48 bg-slate-200 dark:bg-[#0d3820] rounded" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-[#134426]">
                  <div className="h-10 bg-slate-100 dark:bg-[#0d3820] rounded-xl" />
                  <div className="h-10 bg-slate-100 dark:bg-[#0d3820] rounded-xl" />
                  <div className="h-10 bg-slate-100 dark:bg-[#0d3820] rounded-xl" />
                  <div className="h-10 bg-slate-100 dark:bg-[#0d3820] rounded-xl" />
                </div>
              </div>
            ))
          ) : filteredEmployees.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-emerald-400">
              <Database size={36} className="mx-auto mb-2 opacity-40" />
              <p className="font-medium text-slate-500 dark:text-emerald-300">
                {data?.connectionStatus === 'error' ? 'Database unavailable — check connection.' : 'No records found.'}
              </p>
              {search && (
                <button onClick={() => setSearch('')} className="mt-2 text-xs text-[#44D62C] hover:underline font-bold">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            paginatedEmployees.map((emp, idx) => {
              const override = empOverrides[emp.empCode] || {};
              const displayEmpName = override.empName ?? emp.empName;
              const displaySite = override.site ?? emp.department;
              const displayShift = override.shiftName ?? emp.shiftName;
              const displayDesignation = override.designation ?? emp.designation;
              const isEditable = canEditEmployee(emp.department);
              const isBeingEdited = editingEmpCode === emp.empCode;
              const isEmpNameCorrectedCard = Boolean(
                override.empName &&
                override.empName.trim().toLowerCase() !== (emp.empName || '').trim().toLowerCase()
              );

              const cardBorder = emp.shiftType === 'triple'
                ? 'border-l-4 border-l-red-600 border-red-200 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/20'
                : emp.shiftType === 'double'
                  ? 'border-l-4 border-l-amber-500 border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20'
                  : 'border-slate-200/80 dark:border-[#134426] bg-white dark:bg-[#072415] hover:dark:border-[#22633c]';

              const isNextDay = (emp as any).isNextDayOut ?? ((emp.shiftName || '').toLowerCase().includes('night') && (emp.inTime || '').toLowerCase().includes('pm') && (emp.outTime || '').toLowerCase().includes('am'));

              return (
                <div
                  key={`card-${emp.empCode}-${idx}`}
                  className={`rounded-2xl border p-3.5 sm:p-4 shadow-xs space-y-3 transition-all ${cardBorder}${isBeingEdited ? ' ring-2 ring-[#44D62C]' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={selectedEmpCodes?.has(emp.empCode) || false}
                          onChange={() => onToggleSelectEmp?.(emp.empCode)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#44D62C]"
                          title={`Select ${displayEmpName}`}
                        />
                        <span className={`text-sm font-extrabold text-slate-900 dark:text-white truncate ${isEmpNameCorrectedCard ? 'text-emerald-700 dark:text-[#44D62C]' : ''}`}>
                          {displayEmpName}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-emerald-300 bg-slate-100 dark:bg-[#0d3820] border border-transparent dark:border-[#1a5532] px-1.5 py-0.5 rounded">
                          #{emp.empCode || '—'}
                        </span>
                        {(emp as any).lifecycleStatus === 'New Joinee' && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-800 bg-emerald-100 dark:bg-[#0d3820] dark:text-[#44D62C] border border-transparent dark:border-[#1a5532] px-1.5 py-0.5 rounded">
                            <UserPlus size={9} /> New Joinee
                          </span>
                        )}
                        {isEmpNameCorrectedCard && (
                          <span className="text-[9px] text-emerald-600 dark:text-[#44D62C] font-bold uppercase">✏ Corrected</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-emerald-300/80 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-emerald-200">
                          <Building2 size={12} className="text-[#44D62C]" />
                          {displaySite}
                          {(emp as any).isSmartSite && !override.site && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" title="Auto-mapped site" />
                          )}
                        </span>
                        <span className="text-slate-300 dark:text-[#1a5532]">•</span>
                        {(() => {
                          const deptKey = override.departmentOverride || getEmployeeDepartment({ designation: displayDesignation, empCode: emp.empCode, department: displaySite, departmentOverride: override.departmentOverride });
                          const deptMeta = DEPARTMENT_METAS[deptKey] || DEPARTMENT_METAS.other;
                          return (
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold ${deptMeta?.badgeBg || 'bg-slate-100'} ${deptMeta?.badgeText || 'text-slate-700'}`}>
                              <span>{deptMeta?.icon || '🏢'}</span>
                              <span>{deptMeta?.shortLabel || 'Other'}</span>
                            </span>
                          );
                        })()}
                        <span className="truncate max-w-[140px] font-medium text-slate-600 dark:text-emerald-300/70">{displayDesignation || 'Staff'}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge
                        status={emp.status}
                        shiftCompleted={emp.shiftCompleted}
                        inTime={emp.inTime}
                        outTime={emp.outTime}
                        shiftType={emp.shiftType}
                        shiftName={emp.shiftName}
                        shiftTiming={(emp as any).shiftTiming}
                        selectedDate={selectedDate}
                        isMissedPunchIn={(emp as any).isMissedPunchIn}
                        isMissedPunchOut={(emp as any).isMissedPunchOut}
                        isNewEnrolled={(emp as any).isNewEnrolled}
                      />
                      {onNotifyMissedPunchOut && !((emp as any).isNewEnrolled || emp.status === 'New Enrolled') && (emp.status === 'Missed Punch OUT' || (emp as any).isMissedPunchOut) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNotifyMissedPunchOut(emp);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                          title="Inform Reporting Manager and Operations Manager"
                        >
                          <Bell size={10} className="shrink-0 animate-bounce" />
                          <span>Inform Manager</span>
                        </button>
                      )}
                      {emp.lateMinutes > 0 && !(emp as any).isNewEnrolled && emp.status !== 'New Enrolled' && !(emp as any).isMissedPunchIn && emp.status !== 'Missed Punch IN' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Clock size={9} className="shrink-0 text-amber-600" />
                          Late {emp.lateMinutes >= 60 ? `${Math.floor(emp.lateMinutes / 60)}h ${emp.lateMinutes % 60}m` : `${emp.lateMinutes}m`}
                        </span>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => openEditModal(emp)}
                            className="p-1 rounded-lg text-slate-400 hover:text-[#44D62C] hover:bg-emerald-50 dark:hover:bg-[#0d3820] transition-colors cursor-pointer"
                            title="Edit employee details"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onFeedWeeklyOff(emp, displayEmpName, displaySite)}
                          className="p-1 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer flex items-center gap-0.5 text-[9px] font-extrabold"
                          title={`Feed Weekly Offs for ${displayEmpName}`}
                        >
                          <Calendar size={12} />
                          <span>WO</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-0.5">
                    <ShiftBadge shiftName={displayShift} shiftTiming={override.shiftName ? undefined : (emp as any).shiftTiming} />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-[#134426] text-xs">
                    {/* IN */}
                    <div className="bg-slate-50 dark:bg-[#041b0f] p-2.5 rounded-xl border border-slate-100 dark:border-[#134426]">
                      <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-emerald-300/70 tracking-wider">In Punch</p>
                      {emp.inTime ? (
                        <div className="mt-0.5">
                          <p className="font-mono font-bold text-emerald-600 dark:text-[#44D62C] text-xs">{emp.inTime}</p>
                          <p className="text-[10px] text-slate-400 dark:text-emerald-400/60 font-medium">
                            {(emp as any).isNewEnrolled || emp.status === 'New Enrolled'
                              ? `${new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} (Enrolled)`
                              : emp.inTime.includes('Prev Night')
                              ? (() => {
                                  const d = new Date(selectedDate);
                                  d.setDate(d.getDate() - 1);
                                  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} (Overnight)`;
                                })()
                              : new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      ) : (emp as any).isMissedPunchIn ? (
                        <p className="font-bold text-amber-600 dark:text-amber-400 text-xs mt-0.5">Missed IN</p>
                      ) : (
                        <p className="text-slate-400 dark:text-emerald-300/40 text-xs mt-0.5">—</p>
                      )}
                    </div>

                    {/* OUT */}
                    <div className="bg-slate-50 dark:bg-[#041b0f] p-2.5 rounded-xl border border-slate-100 dark:border-[#134426]">
                      <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-emerald-300/70 tracking-wider">Out Punch</p>
                      {emp.outTime ? (
                        <div className="mt-0.5">
                          <p className="font-mono font-bold text-slate-700 dark:text-emerald-100 text-xs">
                            {emp.outTime}
                            {isNextDay && <span className="text-[9px] text-[#44D62C] ml-1 font-bold">+1d</span>}
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-300/70 font-medium">
                            {(() => {
                              if (emp.outTime && emp.outTime.includes('Pending')) {
                                return 'Active Shift';
                              }
                              if (isNextDay) {
                                const d = new Date(selectedDate);
                                d.setDate(d.getDate() + 1);
                                return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} (+1d)`;
                              }
                              return new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                            })()}
                          </p>
                        </div>
                      ) : (emp as any).isMissedPunchOut ? (
                        <p className="font-bold text-amber-600 dark:text-amber-400 text-xs mt-0.5">Missed OUT</p>
                      ) : (
                        <p className="text-slate-400 dark:text-emerald-300/40 text-xs mt-0.5">—</p>
                      )}
                    </div>

                    {/* DURATION */}
                    <div className="bg-slate-50 dark:bg-[#041b0f] p-2.5 rounded-xl border border-slate-100 dark:border-[#134426]">
                      <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-emerald-300/70 tracking-wider">Hours Worked</p>
                      <p className="font-mono font-bold text-slate-800 dark:text-white mt-0.5 text-xs">
                        {formatLiveWorkingHours(emp, selectedDate)}
                      </p>
                    </div>

                    {/* OT */}
                    <div className="bg-slate-50 dark:bg-[#041b0f] p-2.5 rounded-xl border border-slate-100 dark:border-[#134426]">
                      <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-emerald-300/70 tracking-wider">Overtime</p>
                      <p className="font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5 text-xs">
                        {emp.otHours || '0h 00m'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto">
          <div className="min-w-[950px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-[#041b0f] border-b border-slate-200 dark:border-[#134426]">
                <tr>
                  <th className="px-3 py-3 w-10 text-center select-none">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={el => { if (el) el.indeterminate = isSomeSelected && !isAllSelected; }}
                      onChange={onToggleSelectAll}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#44D62C]"
                      title={isAllSelected ? 'Deselect all visible employees' : 'Select all visible employees'}
                    />
                  </th>
                  {[
                    { key: 'empCode', label: 'Biometric Code' },
                    { key: 'empName', label: 'Employee' },
                    { key: 'department', label: 'Site (🟠 Auto-Mapped)' },
                    { key: 'shiftName', label: 'Shift' },
                    { key: 'designation', label: 'Designation' },
                    { key: 'inTime', label: 'In Time' },
                    { key: 'outTime', label: 'Out Time' },
                    { key: 'workingHours', label: 'Hours' },
                    { key: 'otHours', label: 'OT' },
                    { key: 'status', label: 'Status' },
                  ].map(col => {
                    const isCentered = col.key === 'status';
                    const activeSelectedVals = columnFilters[col.key] || [];
                    const isFiltered = activeSelectedVals.length > 0;
                    const isOpen = activeFilterDropdown === col.key;
                    const allUnique = isOpen ? (columnUniqueValuesMap[col.key] || []) : [];
                    const searchQ = (columnSearchQuery[col.key] || '').toLowerCase().trim();
                    const filteredUnique = searchQ
                      ? allUnique.filter(u => u.val.toLowerCase().includes(searchQ))
                      : allUnique;

                    return (
                      <th
                        key={col.key}
                        className={`px-3 py-3 font-bold text-slate-500 dark:text-emerald-300/80 uppercase tracking-wider select-none relative ${isCentered ? 'text-center' : 'text-left'}`}
                      >
                        <div className={`inline-flex items-center gap-1.5 ${isCentered ? 'justify-center w-full' : ''}`}>
                          <button
                            onClick={() => handleSort(col.key as keyof EmployeeRow)}
                            className="hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 font-bold cursor-pointer transition-colors"
                          >
                            <span>{col.label}</span>
                            <SortIcon col={col.key as keyof EmployeeRow} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFilterDropdown(isOpen ? null : col.key);
                            }}
                            className={`p-1 rounded-md transition-all cursor-pointer ${
                              isFiltered
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 dark:hover:bg-[#0d3820] dark:text-emerald-300'
                            }`}
                            title={`Smart Filter by ${col.label}`}
                          >
                            <Filter size={11} className={isFiltered ? 'fill-white' : ''} />
                          </button>

                          {isFiltered && (
                            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-mono font-extrabold flex items-center justify-center -ml-0.5">
                              {activeSelectedVals.length}
                            </span>
                          )}
                        </div>

                        {isOpen && (
                          <div
                            ref={filterDropdownRef as any}
                            onClick={e => e.stopPropagation()}
                            className="absolute top-full left-0 mt-1.5 z-50 w-64 p-3 bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] rounded-2xl shadow-2xl space-y-2.5 font-sans normal-case text-left text-slate-900 dark:text-white"
                          >
                            <div className="relative">
                              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-emerald-400" />
                              <input
                                type="text"
                                placeholder={`Search ${col.label}...`}
                                value={columnSearchQuery[col.key] || ''}
                                onChange={e => setColumnSearchQuery(prev => ({ ...prev, [col.key]: e.target.value }))}
                                className="w-full pl-8 pr-2 py-1.5 text-xs font-semibold border border-slate-200 dark:border-[#1a5532] rounded-xl bg-slate-50 dark:bg-[#041b0f] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-emerald-400/50 outline-none focus:ring-2 focus:ring-emerald-500/25"
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] font-extrabold border-b border-slate-100 dark:border-[#134426] pb-2 px-0.5">
                              <button
                                onClick={() => selectAllColumnFilterVals(col.key, allUnique.map(u => u.val))}
                                className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                              >
                                Select All ({allUnique.length})
                              </button>
                              {isFiltered && (
                                <button
                                  onClick={() => clearColumnFilter(col.key)}
                                  className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                                >
                                  Clear ({activeSelectedVals.length})
                                </button>
                              )}
                            </div>

                            <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1 text-xs font-semibold">
                              {filteredUnique.length === 0 ? (
                                <p className="py-4 text-center text-slate-400 dark:text-emerald-400/60 text-[11px]">No matching values</p>
                              ) : (
                                filteredUnique.map(item => {
                                  const isChecked = activeSelectedVals.includes(item.val);
                                  return (
                                    <label
                                      key={item.val}
                                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer select-none ${
                                        isChecked
                                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                                          : 'hover:bg-slate-100 dark:hover:bg-[#0d3820] text-slate-700 dark:text-emerald-100'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleColumnFilterVal(col.key, item.val)}
                                          className="rounded text-emerald-600 focus:ring-emerald-500/20 cursor-pointer w-3.5 h-3.5"
                                        />
                                        <span className="truncate font-semibold text-xs">{item.val}</span>
                                      </div>
                                      <span className="text-[10px] font-mono text-slate-400 dark:text-emerald-400/70 font-bold ml-2">
                                        {item.count}
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-[#134426] flex items-center justify-between">
                              <button
                                onClick={() => handleSort(col.key as keyof EmployeeRow)}
                                className="text-[10px] font-bold text-slate-500 dark:text-emerald-300 hover:text-slate-800 dark:hover:text-white cursor-pointer flex items-center gap-1"
                              >
                                Sort {sortKey === col.key && sortDir === 'asc' ? 'Z → A' : 'A → Z'}
                              </button>
                              <button
                                onClick={() => setActiveFilterDropdown(null)}
                                className="px-3 py-1 rounded-lg text-xs font-extrabold bg-slate-900 dark:bg-[#44D62C] text-white dark:text-[#041b0f] cursor-pointer hover:opacity-90"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#134426]">
                {loading && (!paginatedEmployees || paginatedEmployees.length === 0) ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 11 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3.5 bg-slate-100 dark:bg-[#0d3820] rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-400">
                      <Database size={36} className="mx-auto mb-2 opacity-40" />
                      <p className="font-medium text-slate-500 dark:text-emerald-300/80">
                        {data?.connectionStatus === 'error' ? 'Database unavailable — check connection.' : 'No records found.'}
                      </p>
                      {search && (
                        <button onClick={() => setSearch('')} className="mt-2 text-xs text-emerald-600 dark:text-[#44D62C] hover:underline">
                          Clear search
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedEmployees.map((emp, idx) => {
                    const rowBg = emp.shiftType === 'triple'
                      ? 'bg-red-500/15 dark:bg-red-950/50 border-l-4 border-red-600 font-medium'
                      : emp.shiftType === 'double'
                        ? 'bg-amber-500/15 dark:bg-amber-950/40 border-l-4 border-amber-500 font-medium'
                        : 'hover:bg-slate-50/80 dark:hover:bg-[#0d3820] transition-colors';

                    const override = empOverrides[emp.empCode] || {};
                    const displayEmpName = override.empName ?? emp.empName;
                    const displaySite = override.site ?? emp.department;
                    const displayDesignation = override.designation ?? emp.designation;
                    const isSecGuardNoWO = isSecurityGuardWithoutWeekOff({
                      designation: displayDesignation,
                      role: (emp as any).role,
                      shiftName: override.shiftName ?? emp.shiftName,
                      department: displaySite
                    });
                    const rawDisplayShift = override.shiftName ?? emp.shiftName;
                    const displayShift = (isSecGuardNoWO && (rawDisplayShift === 'W/O' || rawDisplayShift === 'WO'))
                      ? ((emp as any).hadPrevNightShift ? 'Security Night Duty (12h)' : 'Security Day Duty (12h)')
                      : rawDisplayShift;
                    const hasShiftCorrection = Boolean(override.shiftName && !(isSecGuardNoWO && (override.shiftName === 'W/O' || override.shiftName === 'WO')));
                    const isEditable = canEditEmployee(emp.department);
                    const isBeingEdited = editingEmpCode === emp.empCode;

                    const isEmpNameCorrected = Boolean(
                      override.empName &&
                      override.empName.trim().toLowerCase() !== (emp.empName || '').trim().toLowerCase()
                    );
                    const isSiteCorrected = Boolean(
                      override.site &&
                      override.site.trim().toLowerCase() !== ((emp as any).originalDept || emp.department || '').trim().toLowerCase()
                    );
                    const isShiftCorrected = Boolean(
                      hasShiftCorrection &&
                      displayShift &&
                      displayShift.trim().toLowerCase() !== (emp.shiftName || '').trim().toLowerCase()
                    );
                    const isDesignationCorrected = Boolean(
                      override.designation &&
                      override.designation.trim().toLowerCase() !== (emp.designation || '').trim().toLowerCase()
                    );

                    return (
                      <tr
                        key={`${emp.empCode}-${idx}`}
                        className={`${rowBg}${isBeingEdited ? ' ring-2 ring-inset ring-emerald-400 dark:ring-emerald-600' : ''}`}
                      >
                        <td className="px-3 py-3 text-center select-none" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedEmpCodes?.has(emp.empCode) || false}
                            onChange={() => onToggleSelectEmp?.(emp.empCode)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#44D62C]"
                            title={`Select ${displayEmpName}`}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 dark:text-emerald-300/80">{emp.empCode || '—'}</td>
                        
                        {/* EMPLOYEE NAME */}
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white max-w-[180px]">
                          <div className="flex items-center gap-1.5 group/empname">
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className={`truncate ${isEmpNameCorrected ? 'text-emerald-700 dark:text-[#44D62C] font-extrabold' : ''}`}>
                                {displayEmpName}
                              </span>
                              {isEmpNameCorrected && (
                                <span className="text-[9px] text-emerald-600 dark:text-[#44D62C] font-bold uppercase tracking-wide">✏ Corrected</span>
                              )}
                              {(emp as any).lifecycleStatus === 'New Joinee' && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.2 rounded w-max">
                                  <UserPlus size={9} /> New Joinee
                                </span>
                              )}
                            </div>
                            {isEditable && (
                              <button
                                onClick={() => openEditModal(emp)}
                                className="opacity-0 group-hover/empname:opacity-100 ml-0.5 p-0.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all cursor-pointer shrink-0"
                                title="Correct employee name"
                              >
                                <Pencil size={11} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onFeedWeeklyOff(emp, displayEmpName, displaySite)}
                              className="p-1 rounded-md text-amber-600 hover:text-amber-800 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-all cursor-pointer shrink-0 flex items-center gap-1 text-[9px] font-extrabold"
                              title={`Feed Weekly Offs for ${displayEmpName}`}
                            >
                              <Calendar size={11} className="text-amber-500" />
                              <span className="hidden group-hover/empname:inline bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-1 py-0.2 rounded">Feed WO</span>
                            </button>
                          </div>
                        </td>

                        {/* SITE */}
                        <td className="px-4 py-3 text-slate-600 dark:text-emerald-100">
                          <div className="flex items-center gap-1.5 group/site">
                            <div className="flex flex-col gap-0.5">
                              <span className={isSiteCorrected ? 'text-emerald-700 dark:text-[#44D62C] font-semibold' : ''}>
                                {displaySite}
                              </span>
                              {isSiteCorrected && (
                                <span className="text-[9px] text-emerald-600 dark:text-[#44D62C] font-bold uppercase tracking-wide">✏ Corrected</span>
                              )}
                            </div>
                            {(emp as any).isSmartSite && !override.site && (
                              <span
                                className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0 cursor-help"
                                title={`Smart Inferred Site (Original in eTimeTrack was '${(emp as any).originalDept || 'Default'}')`}
                              />
                            )}
                            {isEditable && (
                              <button
                                onClick={() => openEditModal(emp)}
                                className="opacity-0 group-hover/site:opacity-100 ml-0.5 p-0.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all cursor-pointer"
                                title={isAdminUser ? 'Admin: Edit Site / Shift / Designation' : 'Correct auto-assigned details for your site staff'}
                              >
                                <Pencil size={11} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* SHIFT */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 group/shift">
                            <div className="flex flex-col gap-0.5">
                              <ShiftBadge shiftName={displayShift} shiftTiming={override.shiftName ? undefined : (emp as any).shiftTiming} />
                              {isShiftCorrected && (
                                <span className="text-[9px] text-emerald-600 dark:text-[#44D62C] font-bold uppercase tracking-wide">✏ Corrected</span>
                              )}
                            </div>
                            {isEditable && (
                              <button
                                onClick={() => openEditModal(emp)}
                                className="opacity-0 group-hover/shift:opacity-100 ml-0.5 p-0.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all cursor-pointer"
                                title="Correct auto-assigned shift"
                              >
                                <Pencil size={11} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* DESIGNATION */}
                        <td className="px-4 py-3 text-slate-500 dark:text-emerald-300/80 max-w-[160px]">
                          {(() => {
                            const deptKey = override.departmentOverride || getEmployeeDepartment({ designation: displayDesignation, empCode: emp.empCode, department: displaySite, departmentOverride: override.departmentOverride });
                            const deptMeta = DEPARTMENT_METAS[deptKey] || DEPARTMENT_METAS.other;
                            return (
                              <div className="flex items-center gap-1.5 group/desig flex-wrap">
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold ${deptMeta?.badgeBg || 'bg-slate-100'} ${deptMeta?.badgeText || 'text-slate-700'} shrink-0`}>
                                  <span>{deptMeta?.icon || '🏢'}</span>
                                  <span>{deptMeta?.shortLabel || 'Other'}</span>
                                </span>
                                <span className={`truncate font-medium text-slate-700 dark:text-emerald-100 ${isDesignationCorrected ? 'text-emerald-700 dark:text-[#44D62C] font-semibold' : ''}`}>
                                  {displayDesignation}
                                </span>
                                {isDesignationCorrected && (
                                  <span className="text-[9px] text-emerald-600 font-bold">✏</span>
                                )}
                                {isEditable && (
                                  <button
                                    onClick={() => openEditModal(emp)}
                                    className="opacity-0 group-hover/desig:opacity-100 ml-0.5 p-0.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all cursor-pointer shrink-0"
                                    title="Correct auto-assigned designation"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* IN TIME */}
                        <td className="px-4 py-3 font-mono">
                          {emp.inTime ? (
                            <div className="flex flex-col">
                              <span className="text-emerald-600 dark:text-[#44D62C] font-semibold">{emp.inTime}</span>
                              <span className="text-[10px] text-slate-400 dark:text-emerald-400/60 font-medium">
                                {(emp as any).isNewEnrolled || emp.status === 'New Enrolled'
                                  ? `${new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} (Enrolled)`
                                  : emp.inTime.includes('Prev Night')
                                  ? (() => {
                                      const d = new Date(selectedDate);
                                      d.setDate(d.getDate() - 1);
                                      return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} (Overnight)`;
                                    })()
                                  : new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                          ) : (emp as any).isMissedPunchIn ? (
                            <div className="flex flex-col">
                              <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">Missed IN</span>
                              <span className="text-[10px] text-slate-400 dark:text-emerald-400/60 font-medium">
                                {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-[#1a5532]">—</span>
                          )}
                        </td>

                        {/* OUT TIME */}
                        <td className="px-4 py-3 font-mono">
                          {emp.outTime ? (
                            <div className="flex flex-col">
                              <span className={emp.outTime.includes('Pending') ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-700 dark:text-emerald-100 font-semibold"}>
                                {emp.outTime}
                              </span>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-300/80 font-medium">
                                {(() => {
                                  if (emp.outTime.includes('Pending')) {
                                    return 'Active Shift';
                                  }
                                  const isNextDay = (emp as any).isNextDayOut ?? ((emp.shiftName || '').toLowerCase().includes('night') && (emp.inTime || '').toLowerCase().includes('pm') && (emp.outTime || '').toLowerCase().includes('am'));
                                  if (isNextDay) {
                                    const d = new Date(selectedDate);
                                    d.setDate(d.getDate() + 1);
                                    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} (+1d)`;
                                  }
                                  return new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                                })()}
                              </span>
                            </div>
                          ) : (emp as any).isMissedPunchOut ? (
                            <div className="flex flex-col">
                              <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">Missed OUT</span>
                              <span className="text-[10px] text-slate-400 dark:text-emerald-400/60 font-medium">
                                {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-[#1a5532]">—</span>
                          )}
                        </td>

                        {/* HOURS */}
                        <td className="px-4 py-3 font-mono text-slate-800 dark:text-white font-semibold">{formatLiveWorkingHours(emp, selectedDate)}</td>

                        {/* OT */}
                        <td className="px-4 py-3 font-mono text-amber-600 dark:text-amber-400 font-semibold">
                          {emp.otHours || '0h 00m'}
                        </td>

                        {/* STATUS */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <StatusBadge 
                              status={emp.status} 
                              shiftCompleted={emp.shiftCompleted} 
                              inTime={emp.inTime}
                              outTime={emp.outTime} 
                              shiftType={emp.shiftType} 
                              shiftName={emp.shiftName}
                              shiftTiming={(emp as any).shiftTiming}
                              selectedDate={selectedDate} 
                              isMissedPunchIn={(emp as any).isMissedPunchIn}
                              isMissedPunchOut={(emp as any).isMissedPunchOut}
                              isNewEnrolled={(emp as any).isNewEnrolled}
                            />
                            {onNotifyMissedPunchOut && !((emp as any).isNewEnrolled || emp.status === 'New Enrolled') && (emp.status === 'Missed Punch OUT' || (emp as any).isMissedPunchOut) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNotifyMissedPunchOut(emp);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all active:scale-95 cursor-pointer mt-0.5"
                                title="Inform Reporting Manager & Ops Manager about missed punch OUT"
                              >
                                <Bell size={10} className="shrink-0 animate-bounce" />
                                <span>Inform Manager</span>
                              </button>
                            )}
                            {emp.lateMinutes > 0 && !(emp as any).isNewEnrolled && emp.status !== 'New Enrolled' && !(emp as any).isMissedPunchIn && emp.status !== 'Missed Punch IN' && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                <Clock size={10} className="shrink-0 text-amber-600" />
                                Late by {emp.lateMinutes >= 60 ? `${Math.floor(emp.lateMinutes / 60)}h ${emp.lateMinutes % 60}m` : `${emp.lateMinutes}m`}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {!loading && filteredEmployees.length > 0 && (
        <div className="px-4 py-3.5 border-t border-slate-100 dark:border-[#134426] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/70 dark:bg-[#062013]">
          <div className="text-slate-500 dark:text-emerald-300/80 font-medium text-center sm:text-left">
            Showing <span className="font-bold text-slate-800 dark:text-white">{Math.min((currentPage - 1) * pageSize + 1, filteredEmployees.length)}</span> to{' '}
            <span className="font-bold text-slate-800 dark:text-white">{Math.min(currentPage * pageSize, filteredEmployees.length)}</span> of{' '}
            <span className="font-bold text-slate-800 dark:text-white">{filteredEmployees.length}</span> employees
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#0d3820] text-slate-700 dark:text-emerald-100 font-bold hover:bg-slate-100 dark:hover:bg-[#134e2c] dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed dark:disabled:bg-[#061d10] dark:disabled:border-[#0e351d] dark:disabled:text-emerald-800/60 transition-all shadow-xs cursor-pointer"
            >
              Previous
            </button>

            <div className="px-3 py-1 rounded-lg bg-white dark:bg-[#04190e] border border-slate-200/80 dark:border-[#134426] text-slate-600 dark:text-emerald-200/90 font-semibold text-xs shadow-2xs">
              Page <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{currentPage}</span> of{' '}
              <span className="font-bold text-slate-800 dark:text-emerald-100">{totalPages}</span>
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#1a5532] bg-white dark:bg-[#0d3820] text-slate-700 dark:text-emerald-100 font-bold hover:bg-slate-100 dark:hover:bg-[#134e2c] dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed dark:disabled:bg-[#061d10] dark:disabled:border-[#0e351d] dark:disabled:text-emerald-800/60 transition-all shadow-xs cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Sticky Floating Bulk Action Bar ───────────────────────────────── */}
      {selectedEmpCodes && selectedEmpCodes.size > 0 && (
        <div className="sticky bottom-3 z-30 mx-3 my-2 p-3 sm:px-5 sm:py-3 rounded-2xl bg-slate-900/95 dark:bg-[#041b0f]/95 text-white border border-emerald-500/60 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#44D62C] text-[#041b0f] flex items-center justify-center font-extrabold text-sm shrink-0">
              {selectedEmpCodes.size}
            </div>
            <div>
              <p className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-1.5">
                <span>{selectedEmpCodes.size} Employees Selected</span>
              </p>
              <p className="text-[11px] text-emerald-300/80 hidden xs:block">
                Simultaneous update to eSSL MSSQL (`dbo.Employees`) and Supabase Cloud
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenBulkEditModal}
              className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-[#041b0f] bg-[#44D62C] hover:bg-[#38b824] shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Pencil size={13} />
              <span>Bulk Update Selected ({selectedEmpCodes.size})</span>
            </button>

            <button
              type="button"
              onClick={onDownloadPreFilledExcel}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 dark:bg-[#0d3820] dark:hover:bg-[#1a5532] border border-slate-700 dark:border-[#1a5532] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Download Excel spreadsheet with selected staff"
            >
              <FileSpreadsheet size={13} className="text-[#44D62C]" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>

            <button
              type="button"
              onClick={onClearSelection}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              Deselect
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

EmployeeTable.displayName = 'EmployeeTable';
export default EmployeeTable;
