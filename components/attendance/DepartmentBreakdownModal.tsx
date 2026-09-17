import React, { useState, useMemo } from 'react';
import { 
  X, Fingerprint, Users, Building2, CheckCircle2, Clock, 
  AlertTriangle, Search, Filter, Download, ArrowUpRight, ShieldCheck 
} from 'lucide-react';
import type { DepartmentKey, DepartmentStat, DesignationBreakdownItem } from '../../utils/departmentMapping';

interface DepartmentBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  stat: DepartmentStat | null;
  siteName: string;
  selectedDate: string;
  onApplyDepartmentFilter?: (deptKey: string) => void;
  onReassignEmployee?: (empCode: string, newDept: DepartmentKey) => void;
}

export const DepartmentBreakdownModal: React.FC<DepartmentBreakdownModalProps> = ({
  isOpen,
  onClose,
  stat,
  siteName,
  selectedDate,
  onApplyDepartmentFilter,
  onReassignEmployee,
}) => {
  const [activeTab, setActiveTab] = useState<'breakup' | 'employees'>('breakup');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enrolled' | 'present' | 'absent' | 'late'>('all');

  const employees = stat?.employees || [];
  const designationBreakdown = stat?.designationBreakdown || [];

  // Filtered employees for Tab 2 - defined BEFORE any early return to satisfy React Rule of Hooks
  const filteredEmployees = useMemo(() => {
    if (!isOpen || !stat) return [];
    return employees.filter(emp => {
      // Search matching
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (emp.empName && emp.empName.toLowerCase().includes(q)) ||
        (emp.empCode && emp.empCode.toLowerCase().includes(q)) ||
        (emp.designation && emp.designation.toLowerCase().includes(q))
      );
      if (!matchesSearch) return false;

      // Status matching
      const isPresent = (emp.inTime !== null && emp.inTime !== '—') || emp.status === 'Present' || Boolean(emp.shiftCompleted);
      const isLate = emp.lateMinutes > 0 || emp.status === 'Late';
      const isEnrolled = Boolean((emp.empCode && emp.empCode !== '—') || emp.biometricId);

      if (statusFilter === 'enrolled') return isEnrolled;
      if (statusFilter === 'present') return isPresent;
      if (statusFilter === 'absent') return !isPresent;
      if (statusFilter === 'late') return isLate;
      return true;
    });
  }, [isOpen, stat, employees, searchQuery, statusFilter]);

  if (!isOpen || !stat) return null;

  const { meta } = stat;

  // Export breakup data to CSV
  const handleExportBreakupCSV = () => {
    const headers = ['Designation', 'Sanctioned Deployed', 'Biometric Enrolled', 'Present Today', 'Absent', 'Shortage/Surplus'];
    const rows = designationBreakdown.map(item => [
      `"${item.designation.replace(/"/g, '""')}"`,
      item.deployed,
      item.enrolled,
      item.present,
      item.absent,
      item.shortage > 0 ? `+${item.shortage}` : item.shortage,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `${stat.key}_${siteName.replace(/[^a-z0-9]/gi, '_')}_Breakdown.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#072415] border-2 border-emerald-500/40 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* ── Modal Header ── */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#134426] flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-[#041b0f]/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-[#0d3820] text-emerald-800 dark:text-[#44D62C] flex items-center justify-center text-2xl shadow-inner shrink-0">
              {meta.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                  {meta.label} — Biometric Breakdown Plan
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {stat.enrollmentRate}% Enrolled
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-emerald-300/70 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-slate-700 dark:text-emerald-100">Site: {siteName}</span>
                <span>•</span>
                <span>Date: {selectedDate}</span>
                <span>•</span>
                <span>{meta.description}</span>
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

        {/* ── 4 Top KPI Pillar Cards ── */}
        <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 bg-white dark:bg-[#072415] shrink-0 border-b border-slate-100 dark:border-[#134426]">
          {/* Deployed Target */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-[#051c11] border border-slate-200 dark:border-[#134426]">
            <div className="flex items-center justify-between text-slate-500 dark:text-emerald-400/70 text-[11px] font-bold uppercase tracking-wider">
              <span>Sanctioned Target</span>
              <Building2 size={15} />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {stat.deployment}
              </span>
              <span className="text-xs font-semibold text-slate-400">staff</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Contract deployment quota</p>
          </div>

          {/* Biometric Enrolled */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60">
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 text-[11px] font-bold uppercase tracking-wider">
              <span>Biometric Enrolled</span>
              <Fingerprint size={15} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-950 dark:text-blue-200">
                {stat.enrolled}
              </span>
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                ({stat.enrollmentRate}%)
              </span>
            </div>
            <div className="w-full bg-blue-200/60 dark:bg-blue-900/60 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div 
                className="bg-blue-600 dark:bg-blue-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, stat.enrollmentRate)}%` }}
              />
            </div>
          </div>

          {/* Present Today */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
              <span>Present Today</span>
              <CheckCircle2 size={15} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-950 dark:text-emerald-200">
                {stat.present}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-[#44D62C]">
                ({stat.attendanceRate}%)
              </span>
            </div>
            <div className="w-full bg-emerald-200/60 dark:bg-emerald-900/60 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div 
                className="bg-emerald-600 dark:bg-[#44D62C] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, stat.attendanceRate)}%` }}
              />
            </div>
          </div>

          {/* Absent / Shortage */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 text-[11px] font-bold uppercase tracking-wider">
              <span>Absent / Shortage</span>
              <AlertTriangle size={15} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-950 dark:text-amber-200">
                {stat.absent}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                {stat.enrolled >= stat.deployment ? 'Quota met' : `${stat.deployment - stat.enrolled} unenrolled`}
              </span>
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
              {stat.late > 0 ? `${stat.late} late arrivals` : 'Full day tracking'}
            </p>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-[#134426] flex items-center justify-between gap-4 bg-white dark:bg-[#072415] shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('breakup')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'breakup'
                  ? 'border-emerald-600 text-emerald-700 dark:text-[#44D62C] dark:border-[#44D62C]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-emerald-300/70 dark:hover:text-white'
              }`}
            >
              <span>📋 Designation Breakup Plan</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-[#0d3820] text-[10px]">
                {designationBreakdown.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('employees')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'employees'
                  ? 'border-emerald-600 text-emerald-700 dark:text-[#44D62C] dark:border-[#44D62C]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-emerald-300/70 dark:hover:text-white'
              }`}
            >
              <span>👥 Department Employees List</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-[#0d3820] text-[10px]">
                {employees.length}
              </span>
            </button>
          </div>

          <button
            onClick={handleExportBreakupCSV}
            className="text-xs font-bold text-slate-600 hover:text-emerald-600 dark:text-emerald-300/80 dark:hover:text-white flex items-center gap-1 mb-2 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#1a5532] hover:bg-slate-50 dark:hover:bg-[#0d3820] transition-colors cursor-pointer shrink-0"
            title="Download CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50 dark:bg-[#041b0f]/50">
          {activeTab === 'breakup' ? (
            /* ── Tab 1: Designation Breakup Plan Table ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-emerald-300/70">
                <p>Official Sanctioned Designation Targets vs Enrolled Biometric Count & Attendance Today.</p>
                <span className="font-semibold">{designationBreakdown.length} designations mapped</span>
              </div>

              {designationBreakdown.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-sm font-semibold">No designation breakdown data available for this site.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-[#134426] rounded-2xl bg-white dark:bg-[#072415] shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100/80 dark:bg-[#051c11] text-slate-600 dark:text-emerald-200 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-[#134426]">
                      <tr>
                        <th className="py-3 px-4">Designation</th>
                        <th className="py-3 px-3 text-center">Deployed Plan</th>
                        <th className="py-3 px-3 text-center">Biometric Enrolled</th>
                        <th className="py-3 px-3 text-center">Enrollment %</th>
                        <th className="py-3 px-3 text-center">Present Today</th>
                        <th className="py-3 px-3 text-center">Absent</th>
                        <th className="py-3 px-4 text-center">Variance / Shortage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#134426]">
                      {designationBreakdown.map((item, idx) => {
                        const enrRate = item.deployed > 0 ? Math.round((item.enrolled / item.deployed) * 100) : (item.enrolled > 0 ? 100 : 0);
                        const isShort = item.shortage < 0;
                        const isExcess = item.shortage > 0;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-[#0d3820] transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {item.designation}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 dark:text-emerald-200">
                              {item.deployed || '—'}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black text-blue-700 dark:text-blue-300">
                              {item.enrolled}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                enrRate >= 100 
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                  : enrRate >= 70
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}>
                                {enrRate}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 dark:text-[#44D62C]">
                              {item.present}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-slate-500 dark:text-slate-400">
                              {item.absent}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isShort ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
                                  {item.shortage} Shortage
                                </span>
                              ) : isExcess ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                  +{item.shortage} Surplus
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-[#0d3820] dark:text-emerald-300">
                                  Balanced
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* ── Tab 2: Employee Biometric List ── */
            <div className="space-y-3">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, biometric ID, or role..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-[#134426] bg-white dark:bg-[#072415] text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: `All (${employees.length})` },
                    { id: 'enrolled', label: `Enrolled (${stat.enrolled})` },
                    { id: 'present', label: `Present (${stat.present})` },
                    { id: 'absent', label: `Absent (${stat.absent})` },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setStatusFilter(tab.id as any)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                        statusFilter === tab.id
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-[#072415] text-slate-600 dark:text-emerald-200 border-slate-200 dark:border-[#134426] hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Employees Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-[#134426] rounded-2xl bg-white dark:bg-[#072415] shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/80 dark:bg-[#051c11] text-slate-600 dark:text-emerald-200 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-[#134426]">
                    <tr>
                      <th className="py-3 px-3 text-center w-12">#</th>
                      <th className="py-3 px-4">Biometric ID</th>
                      <th className="py-3 px-4">Employee Name</th>
                      <th className="py-3 px-4">Designation</th>
                      <th className="py-3 px-3 text-center">Biometric Status</th>
                      <th className="py-3 px-4 text-center">Today's Attendance</th>
                      <th className="py-3 px-3 text-center">In / Out Time</th>
                      <th className="py-3 px-3 text-center">Move Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#134426]">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No employees matching search or filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp, idx) => {
                        const isEnrolled = Boolean((emp.empCode && emp.empCode !== '—') || emp.biometricId);
                        const isPresent = (emp.inTime !== null && emp.inTime !== '—') || emp.status === 'Present' || Boolean(emp.shiftCompleted);

                        return (
                          <tr key={emp.empCode || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#0d3820] transition-colors">
                            <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 font-mono font-bold text-blue-700 dark:text-blue-300">
                                <Fingerprint size={13} className="shrink-0 text-blue-600" />
                                <span>{emp.empCode || emp.biometricId || '—'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {emp.empName}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-emerald-100">
                              {emp.designation || 'General Staff'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isEnrolled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <CheckCircle2 size={11} /> Enrolled
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  Pending Setup
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isPresent ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-[#44D62C]">
                                  Present
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-[#0d3820] dark:text-slate-300">
                                  Shift Pending / Absent
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-600 dark:text-emerald-200">
                              {emp.inTime || '—'} / {emp.outTime || '—'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <select
                                value={stat.key}
                                onChange={(e) => onReassignEmployee?.(emp.empCode, e.target.value as DepartmentKey)}
                                className="text-[10px] font-extrabold px-2 py-1 rounded-lg border border-slate-200 dark:border-[#1a5532] bg-slate-50 dark:bg-[#041b0f] text-slate-800 dark:text-emerald-200 hover:border-emerald-500 cursor-pointer transition-colors shadow-2xs"
                                title={`Currently in ${meta.shortLabel}. Select another department to move.`}
                              >
                                <option value="mep">⚡ MEP</option>
                                <option value="housekeeping">🧹 Housekeeping</option>
                                <option value="garden">🌿 Garden</option>
                                <option value="security">🛡️ Security</option>
                                <option value="administration">🏢 Admin</option>
                                <option value="other">🐜 Other</option>
                              </select>
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
        </div>

        {/* ── Modal Footer ── */}
        <div className="p-4 border-t border-slate-200 dark:border-[#134426] flex items-center justify-between gap-3 bg-white dark:bg-[#072415] shrink-0">
          <div className="text-xs text-slate-500 dark:text-emerald-400/80 hidden sm:block">
            Showing verified biometric device records for <strong>{meta.label}</strong>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onApplyDepartmentFilter && (
              <button
                onClick={() => {
                  onApplyDepartmentFilter(stat.key);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
              >
                <span>Filter Main Table to {meta.shortLabel}</span>
                <ArrowUpRight size={14} />
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#0d3820] dark:text-emerald-200 dark:hover:bg-[#1a5532] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DepartmentBreakdownModal;
