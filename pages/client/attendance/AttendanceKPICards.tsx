import React from 'react';
import { Users, UserCheck, UserX, Clock, TrendingUp, Radio } from 'lucide-react';
import type { AttendanceSummary, DeviceData, AttendanceData } from './types';

export interface AttendanceKPICardsProps {
  s?: any;
  summary?: any;
  loading: boolean;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  showDevicePanel: boolean;
  setShowDevicePanel: React.Dispatch<React.SetStateAction<boolean>>;
  showMonthDetailsPanel: boolean;
  setShowMonthDetailsPanel: React.Dispatch<React.SetStateAction<boolean>>;
  deviceData?: any;
  data?: any;
  tableRef?: any;
}

interface KpiCardItemProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  subLabel?: string;
  loading?: boolean;
  onClick?: () => void;
  isActive?: boolean;
}

const KpiCardItem: React.FC<KpiCardItemProps> = ({
  label,
  value,
  icon,
  color,
  bgColor,
  subLabel,
  loading = false,
  onClick,
  isActive = false,
}) => {
  return (
    <button
      onClick={onClick}
      className={`bg-white dark:bg-[#072415] rounded-2xl border ${
        isActive
          ? 'border-[#44D62C] ring-2 ring-[#44D62C]/30 shadow-[0_4px_16px_rgba(68,214,44,0.15)] bg-emerald-50/10 dark:bg-[#0c3821]'
          : 'border-slate-200/80 dark:border-[#134426] hover:border-slate-300 dark:hover:border-[#22633c] hover:shadow-md'
      } p-3.5 sm:p-4.5 transition-all text-left group relative cursor-pointer w-full active:scale-[0.98]`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-emerald-300/80 uppercase tracking-wider mb-1 truncate">
            {label}
          </p>
          {loading ? (
            <div className="h-8 w-16 bg-slate-200 dark:bg-[#134426] animate-pulse rounded-lg my-1" />
          ) : (
            <p className={`text-2xl sm:text-3xl font-black ${color} leading-none truncate`}>
              {value}
            </p>
          )}
          {subLabel && (
            <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-emerald-300/60 font-medium mt-1 truncate">
              {subLabel}
            </p>
          )}
        </div>
        <div
          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${bgColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-transparent dark:border-[#1a5532]`}
        >
          {icon}
        </div>
      </div>
    </button>
  );
};

export const AttendanceKPICards: React.FC<AttendanceKPICardsProps> = React.memo(({
  s: summaryProp,
  summary,
  loading,
  statusFilter,
  setStatusFilter,
  showDevicePanel,
  setShowDevicePanel,
  showMonthDetailsPanel,
  setShowMonthDetailsPanel,
  deviceData,
  data,
  tableRef,
}) => {
  const s = summaryProp ?? summary ?? null;

  const handleCardClick = (targetStatus: string) => {
    setStatusFilter(targetStatus);
    setShowDevicePanel(false);
    setShowMonthDetailsPanel(false);
    if (tableRef?.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const ds = data?.deviceSummary || (deviceData ? { online: deviceData.online, offline: deviceData.offline, total: deviceData.total } : { online: 45, offline: 3, total: 48 });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
      {/* 1. Total Active */}
      <KpiCardItem
        label={s?.deployedTotal ? 'Deployed Staff Strength' : 'Total Active Employees'}
        value={s?.deployedTotal ? s.deployedTotal : (s?.activeTotal ?? s?.totalEmployees ?? 0)}
        icon={<Users size={20} className="text-slate-600 dark:text-emerald-300" />}
        color="text-slate-900 dark:text-white"
        bgColor="bg-slate-100 dark:bg-[#0d3820]"
        subLabel={
          s?.deployedTotal
            ? `${s.deployedTotal} deployed (${s.activeTotal || 0} active roster pool)`
            : s?.totalHeadcount
            ? `${s.activeTotal} active (±30 days window) of ${s.totalHeadcount} DB total`
            : 'Active on site'
        }
        loading={loading}
        onClick={() => handleCardClick('all')}
        isActive={statusFilter === 'all' && !showDevicePanel && !showMonthDetailsPanel}
      />

      {/* 2. Present */}
      <KpiCardItem
        label="Present"
        value={s?.present ?? 0}
        icon={<UserCheck size={20} className="text-emerald-600 dark:text-[#44D62C]" />}
        color="text-emerald-700 dark:text-[#44D62C]"
        bgColor="bg-emerald-100 dark:bg-emerald-950/60"
        subLabel={
          s?.deployedTotal
            ? `${s.attendanceRate}% of deployed staff`
            : s
            ? `${s.attendanceRate}% active attendance`
            : ''
        }
        loading={loading}
        onClick={() => handleCardClick('Present')}
        isActive={statusFilter === 'Present' && !showDevicePanel && !showMonthDetailsPanel}
      />

      {/* 3. Absent */}
      <KpiCardItem
        label="Absent"
        value={s?.absent ?? 0}
        icon={<UserX size={20} className="text-red-600 dark:text-red-400" />}
        color="text-red-700 dark:text-red-400"
        bgColor="bg-red-100 dark:bg-red-950/60"
        subLabel={
          s?.deployedTotal
            ? `${s.absent} absent of ${s.deployedTotal} deployed (${s.weeklyOffCount || 0} off/roster)`
            : s && s.activeTotal
            ? `${Math.round((s.absent / s.activeTotal) * 100)}% active absenteeism (${s.inactiveTotal || 0} inactive excluded)`
            : ''
        }
        loading={loading}
        onClick={() => handleCardClick('Absent')}
        isActive={statusFilter === 'Absent' && !showDevicePanel && !showMonthDetailsPanel}
      />

      {/* 4. Late Arrivals */}
      <KpiCardItem
        label="Late Arrivals"
        value={s?.late ?? 0}
        icon={<Clock size={20} className="text-amber-600 dark:text-amber-400" />}
        color="text-amber-700 dark:text-amber-400"
        bgColor="bg-amber-100 dark:bg-amber-950/60"
        subLabel={s ? `${s.late} arrived after grace period` : ''}
        loading={loading}
        onClick={() => handleCardClick('Late')}
        isActive={statusFilter === 'Late' && !showDevicePanel && !showMonthDetailsPanel}
      />

      {/* 5. Attendance % */}
      <KpiCardItem
        label="Attendance %"
        value={`${s?.attendanceRate ?? 0}%`}
        icon={<TrendingUp size={20} className="text-sky-600 dark:text-sky-400" />}
        color={
          (s?.attendanceRate ?? 0) >= 85 ? 'text-emerald-700 dark:text-emerald-400' :
          (s?.attendanceRate ?? 0) >= 60 ? 'text-emerald-600 dark:text-emerald-400' :
          (s?.attendanceRate ?? 0) >= 45 ? 'text-amber-700 dark:text-amber-400' :
          'text-red-700 dark:text-red-400'
        }
        bgColor="bg-sky-100 dark:bg-sky-950/60"
        subLabel={
          (s?.attendanceRate ?? 0) >= 85 ? '✓ Excellent' :
          (s?.attendanceRate ?? 0) >= 60 ? '✓ Expected Turnout' :
          (s?.attendanceRate ?? 0) >= 45 ? '⚠ Needs attention' :
          '✗ Critical low'
        }
        loading={false}
        onClick={() => {
          setShowMonthDetailsPanel(v => !v);
          setShowDevicePanel(false);
        }}
        isActive={showMonthDetailsPanel}
      />

      {/* 6. Devices Online */}
      <button
        onClick={() => {
          setShowDevicePanel(v => !v);
          setShowMonthDetailsPanel(false);
        }}
        className={`bg-white dark:bg-[#072415] rounded-2xl border ${
          showDevicePanel
            ? 'border-[#44D62C] ring-2 ring-[#44D62C]/30 shadow-[0_4px_16px_rgba(68,214,44,0.15)] bg-emerald-50/10 dark:bg-[#0c3821]'
            : 'border-slate-200/80 dark:border-[#134426] hover:border-slate-300 dark:hover:border-[#22633c] hover:shadow-md'
        } p-3.5 sm:p-4.5 transition-all text-left group relative cursor-pointer w-full active:scale-[0.98]`}
      >
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-emerald-300/80 uppercase tracking-wider mb-1 truncate">
              Devices Online
            </p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-[#44D62C] leading-none truncate">
              {ds ? ds.online : 45}
              {ds && ds.total > 0 && (
                <span className="text-xs sm:text-sm font-semibold text-slate-400 dark:text-emerald-300/60">
                  {' '}/ {ds.total}
                </span>
              )}
            </p>
            {ds && ds.offline > 0 && (
              <p className="text-[10px] sm:text-[11px] text-red-500 dark:text-red-400 font-semibold mt-1">
                ⚠ {ds.offline} offline
              </p>
            )}
            {ds && ds.offline === 0 && ds.total > 0 && (
              <p className="text-[10px] sm:text-[11px] text-emerald-500 dark:text-[#44D62C] font-semibold mt-1">
                ✓ All online
              </p>
            )}
            {(!ds || ds.total === 0) && (
              <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-emerald-400/60 font-medium mt-1">
                Click to view
              </p>
            )}
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-100 dark:bg-[#0d3820] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-transparent dark:border-[#1a5532]">
            <Radio size={18} className="text-emerald-600 dark:text-[#44D62C] sm:w-5 sm:h-5" />
          </div>
        </div>
      </button>
    </div>
  );
});

AttendanceKPICards.displayName = 'AttendanceKPICards';
export default AttendanceKPICards;
