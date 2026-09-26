import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  SlidersHorizontal,
  Zap,
  Save,
  Users,
  Clock,
  UserX,
  UserCheck,
  TrendingUp,
} from 'lucide-react';
import {
  processDeviceLogs,
  summariseProcessedRecords,
  type ProcessedAttendanceRecord,
  type ProcessingSummary,
} from '../../utils/deviceLogProcessor';
import { format } from 'date-fns';
import { api } from '../../services/api';
import Logo from '../../components/ui/Logo';
import { exportGenericReportToExcel, GenericReportColumn } from '../../utils/excelExport';

export interface DevicePunchLog {
  id: string;
  downloadDate: string;
  userId: string;
  logDate: string;
  deviceName: string;
  serialNo: string;
  attState: string;
  verifyMode: string;
  gps?: string;
  attPhoto?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DeviceLogsPage: React.FC = () => {
  // ── Top Bar Filter States ──
  const [selectedDevice, setSelectedDevice] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // September by default
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [fromDate, setFromDate] = useState<number>(25);
  const [toDate, setToDate] = useState<number>(26);
  const [verifyModeFilter, setVerifyModeFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'DownloadDate' | 'LogDate' | 'UserId'>('DownloadDate');
  const [sortOrder, setSortOrder] = useState<'Desc' | 'Asc'>('Desc');
  const [pageSize, setPageSize] = useState<number>(100);

  // ── Presets & Modes ──
  const [activeDatePreset, setActiveDatePreset] = useState<string>('25th - 26th Sep');
  const [isRawBurst, setIsRawBurst] = useState<boolean>(true); // Checked shows all raw burst scans
  const [showSubFilterRow, setShowSubFilterRow] = useState<boolean>(true);

  // ── Column Quick-Filter States ──
  const [userIdFilterMode, setUserIdFilterMode] = useState<'Contains' | 'Equals' | 'No Filter'>('Contains');
  const [userIdSearch, setUserIdSearch] = useState<string>('31049');

  const [downloadDateFilterMode, setDownloadDateFilterMode] = useState<string>('No Filter');
  const [downloadDateSearch, setDownloadDateSearch] = useState<string>('');

  const [logDateFilterMode, setLogDateFilterMode] = useState<string>('No Filter');
  const [logDateSearch, setLogDateSearch] = useState<string>('');

  const [deviceNameFilterMode, setDeviceNameFilterMode] = useState<string>('No Filter');
  const [deviceNameSearch, setDeviceNameSearch] = useState<string>('');

  const [serialNoFilterMode, setSerialNoFilterMode] = useState<string>('No Filter');
  const [serialNoSearch, setSerialNoSearch] = useState<string>('');

  const [verifyFilterMode, setVerifyFilterMode] = useState<string>('No Filter');
  const [verifySearch, setVerifySearch] = useState<string>('');

  // ── Data & UI States ──
  const [logs, setLogs] = useState<DevicePunchLog[]>([]);
  const [deviceList, setDeviceList] = useState<Array<{ id: number; name: string; serial: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedPunchForModal, setSelectedPunchForModal] = useState<DevicePunchLog | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  // ── Attendance Processing States ──
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processResult, setProcessResult] = useState<ProcessedAttendanceRecord[] | null>(null);
  const [processSummary, setProcessSummary] = useState<ProcessingSummary | null>(null);
  const [showProcessModal, setShowProcessModal] = useState<boolean>(false);
  const [isSavingProcessed, setIsSavingProcessed] = useState<boolean>(false);
  const [processSaveMsg, setProcessSaveMsg] = useState<string | null>(null);


  useEffect(() => {
    let isMounted = true;
    async function loadDevices() {
      try {
        const res = await fetch('/api/mssql-devices');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && Array.isArray(data.devices)) {
            const list = data.devices.map((d: any) => ({
              id: d.deviceId,
              name: d.deviceName,
              serial: d.serialNo || '',
            }));
            setDeviceList(list);
            return;
          }
        }
      } catch (_) {}

      // Fallback standard device list
      if (isMounted) {
        setDeviceList([
          { id: 62, name: 'Brigade Cornerstone Utopia', serial: 'NCD8252500647' },
          { id: 60, name: 'Birla alokiya', serial: 'NCD8251700081' },
          { id: 20, name: 'Sobha Silicon Oasis', serial: 'CQIK230960951' },
          { id: 34, name: 'Nikoo Homes', serial: 'NCD8234200700' },
          { id: 38, name: 'Mahendra aarna', serial: 'NCD8234200869' },
          { id: 63, name: 'Purva venezia', serial: 'NCD8252500649' },
          { id: 57, name: 'Dsr eden green', serial: 'NCD8234200858' },
        ]);
      }
    }
    loadDevices();
    return () => { isMounted = false; };
  }, []);

  // ── Fetch Device Logs ──
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const mPad = String(selectedMonth).padStart(2, '0');
      const startDayPad = String(fromDate).padStart(2, '0');
      const endDayPad = String(toDate).padStart(2, '0');
      const startDate = `${selectedYear}-${mPad}-${startDayPad}`;
      const endDate = `${selectedYear}-${mPad}-${endDayPad}`;

      const empCodeParam = (userIdFilterMode !== 'No Filter' && userIdSearch.trim())
        ? userIdSearch.trim()
        : '';

      const queryParams: any = {
        startDate,
        endDate,
        month: selectedMonth,
        year: selectedYear,
        fromDay: fromDate,
        toDay: toDate,
        raw: isRawBurst,
      };

      if (empCodeParam) queryParams.empCode = empCodeParam;
      if (selectedDevice !== 'All') queryParams.device = selectedDevice;
      if (verifyModeFilter !== 'All') queryParams.verifyMode = verifyModeFilter;

      const results = await api.getBiometricDeviceLogs(queryParams);
      setLogs(results || []);
      setLastRefreshedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to load device logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDevice, selectedMonth, selectedYear, fromDate, toDate, verifyModeFilter, isRawBurst, userIdFilterMode, userIdSearch]);

  // Initial load
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ── Format Helper: e.g. "26 Sep 2026, 07:13:47" ──
  const formatDateTimeDisplay = (isoStr: string | null | undefined): string => {
    if (!isoStr) return '—';
    try {
      const dt = new Date(isoStr);
      if (isNaN(dt.getTime())) return isoStr;
      return format(dt, 'dd MMM yyyy, HH:mm:ss');
    } catch {
      return String(isoStr);
    }
  };

  // ── Handle Preset Date Buttons ──
  const handlePresetClick = (preset: string) => {
    setActiveDatePreset(preset);
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1;
    const currDay = now.getDate();

    if (preset === 'Today') {
      setSelectedYear(currYear);
      setSelectedMonth(currMonth);
      setFromDate(currDay);
      setToDate(currDay);
    } else if (preset === 'Yesterday') {
      const yest = new Date(Date.now() - 86400000);
      setSelectedYear(yest.getFullYear());
      setSelectedMonth(yest.getMonth() + 1);
      setFromDate(yest.getDate());
      setToDate(yest.getDate());
    } else if (preset === 'Last 3 Days') {
      const d3 = new Date(Date.now() - 3 * 86400000);
      setSelectedYear(currYear);
      setSelectedMonth(currMonth);
      setFromDate(d3.getDate());
      setToDate(currDay);
    } else if (preset === 'Last 7 Days') {
      const d7 = new Date(Date.now() - 7 * 86400000);
      setSelectedYear(currYear);
      setSelectedMonth(currMonth);
      setFromDate(d7.getDate());
      setToDate(currDay);
    } else if (preset === 'This Month') {
      setSelectedYear(currYear);
      setSelectedMonth(currMonth);
      setFromDate(1);
      setToDate(currDay);
    } else if (preset === '25th - 26th Sep') {
      setSelectedYear(2026);
      setSelectedMonth(9);
      setFromDate(25);
      setToDate(26);
    }
  };

  // ── Client-side Filtering ──
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // User ID filter
      if (userIdFilterMode === 'Contains' && userIdSearch.trim()) {
        if (!log.userId.toLowerCase().includes(userIdSearch.trim().toLowerCase())) return false;
      } else if (userIdFilterMode === 'Equals' && userIdSearch.trim()) {
        if (log.userId.toLowerCase() !== userIdSearch.trim().toLowerCase()) return false;
      }

      // Download Date filter
      if (downloadDateFilterMode === 'Contains' && downloadDateSearch.trim()) {
        const dStr = formatDateTimeDisplay(log.downloadDate);
        if (!dStr.toLowerCase().includes(downloadDateSearch.trim().toLowerCase())) return false;
      }

      // Log Date filter
      if (logDateFilterMode === 'Contains' && logDateSearch.trim()) {
        const lStr = formatDateTimeDisplay(log.logDate);
        if (!lStr.toLowerCase().includes(logDateSearch.trim().toLowerCase())) return false;
      }

      // Device Name filter
      if (deviceNameFilterMode === 'Contains' && deviceNameSearch.trim()) {
        if (!log.deviceName.toLowerCase().includes(deviceNameSearch.trim().toLowerCase())) return false;
      }

      // Serial No filter
      if (serialNoFilterMode === 'Contains' && serialNoSearch.trim()) {
        if (!log.serialNo.toLowerCase().includes(serialNoSearch.trim().toLowerCase())) return false;
      }

      // Verify Mode filter
      if (verifyFilterMode === 'Contains' && verifySearch.trim()) {
        if (!log.verifyMode.toLowerCase().includes(verifySearch.trim().toLowerCase())) return false;
      }

      // Top bar device dropdown filter
      if (selectedDevice !== 'All') {
        const devMatch = log.deviceName.toLowerCase().includes(selectedDevice.toLowerCase()) ||
                         log.serialNo.toLowerCase() === selectedDevice.toLowerCase();
        if (!devMatch) return false;
      }

      // Top bar verify mode dropdown
      if (verifyModeFilter !== 'All') {
        if (log.verifyMode.toLowerCase() !== verifyModeFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [
    logs,
    userIdFilterMode, userIdSearch,
    downloadDateFilterMode, downloadDateSearch,
    logDateFilterMode, logDateSearch,
    deviceNameFilterMode, deviceNameSearch,
    serialNoFilterMode, serialNoSearch,
    verifyFilterMode, verifySearch,
    selectedDevice, verifyModeFilter
  ]);

  // ── Sorting ──
  const sortedLogs = useMemo(() => {
    const list = [...filteredLogs];
    list.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (sortBy === 'DownloadDate') {
        valA = new Date(a.downloadDate).getTime() || 0;
        valB = new Date(b.downloadDate).getTime() || 0;
      } else if (sortBy === 'LogDate') {
        valA = new Date(a.logDate).getTime() || 0;
        valB = new Date(b.logDate).getTime() || 0;
      } else if (sortBy === 'UserId') {
        valA = a.userId;
        valB = b.userId;
      }

      if (valA < valB) return sortOrder === 'Asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'Asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredLogs, sortBy, sortOrder]);

  // ── Pagination ──
  const totalRecords = sortedLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);
  const paginatedLogs = sortedLogs.slice(startIndex, endIndex);

  // ── Summary Metrics for KPI cards ──
  const uniqueUsersCount = useMemo(() => {
    return new Set(sortedLogs.map(l => l.userId)).size;
  }, [sortedLogs]);

  const primaryDeviceName = useMemo(() => {
    if (sortedLogs.length === 0) return '—';
    return sortedLogs[0].deviceName || 'Utopia';
  }, [sortedLogs]);

  const latestPunchTime = useMemo(() => {
    if (sortedLogs.length === 0) return '—';
    return formatDateTimeDisplay(sortedLogs[0].logDate);
  }, [sortedLogs]);

  // ── Reset / Clear Filters ──
  const handleRemoveFilters = () => {
    setUserIdFilterMode('No Filter');
    setUserIdSearch('');
    setDownloadDateFilterMode('No Filter');
    setDownloadDateSearch('');
    setLogDateFilterMode('No Filter');
    setLogDateSearch('');
    setDeviceNameFilterMode('No Filter');
    setDeviceNameSearch('');
    setSerialNoFilterMode('No Filter');
    setSerialNoSearch('');
    setVerifyFilterMode('No Filter');
    setVerifySearch('');
  };

  // ── Excel Export ──
  const handleExportExcel = async () => {
    if (sortedLogs.length === 0) return;
    const columns: GenericReportColumn[] = [
      { header: 'Download Date', key: 'downloadDate', width: 22 },
      { header: 'User ID', key: 'userId', width: 15 },
      { header: 'Log Date', key: 'logDate', width: 22 },
      { header: 'Device Name', key: 'deviceName', width: 25 },
      { header: 'Serial No', key: 'serialNo', width: 20 },
      { header: 'Att State', key: 'attState', width: 14 },
      { header: 'Verify Mode', key: 'verifyMode', width: 16 },
      { header: 'GPS', key: 'gps', width: 15 },
    ];

    const exportRows = sortedLogs.map(l => ({
      downloadDate: formatDateTimeDisplay(l.downloadDate),
      userId: l.userId,
      logDate: formatDateTimeDisplay(l.logDate),
      deviceName: l.deviceName,
      serialNo: l.serialNo,
      attState: l.attState || '—',
      verifyMode: l.verifyMode,
      gps: l.gps || '—',
    }));

    const mPad = String(selectedMonth).padStart(2, '0');
    const startDayPad = String(fromDate).padStart(2, '0');
    const endDayPad = String(toDate).padStart(2, '0');
    const exportStartDate = new Date(`${selectedYear}-${mPad}-${startDayPad}`);
    const exportEndDate   = new Date(`${selectedYear}-${mPad}-${endDayPad}`);

    await exportGenericReportToExcel(
      exportRows,
      columns,
      'Biometric Device Logs Report',
      { startDate: exportStartDate, endDate: exportEndDate },
      `Device_Logs_${selectedYear}_${selectedMonth}_${fromDate}_to_${toDate}`,
    );
  };

  // ── CSV Export ──
  const handleExportCsv = () => {
    if (sortedLogs.length === 0) return;
    const headers = ['Download Date', 'User ID', 'Log Date', 'Device Name', 'Serial No', 'Att State', 'Verify Mode', 'GPS'];
    const csvContent = [
      headers.join(','),
      ...sortedLogs.map(l => [
        `"${formatDateTimeDisplay(l.downloadDate)}"`,
        `"${l.userId}"`,
        `"${formatDateTimeDisplay(l.logDate)}"`,
        `"${l.deviceName}"`,
        `"${l.serialNo}"`,
        `"${l.attState || ''}"`,
        `"${l.verifyMode}"`,
        `"${l.gps || ''}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Device_Logs_${selectedYear}_${selectedMonth}_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Process Attendance from loaded logs ──
  const handleProcessAttendance = useCallback(async () => {
    if (!logs.length) return;
    setIsProcessing(true);
    setProcessSaveMsg(null);
    try {
      // Run the processor with zero employee config (it will group by empCode & date,
      // detect shifts automatically, no WO/holiday data passed — can be extended later).
      const records = processDeviceLogs(
        logs,
        [],   // employees — no WO/holiday overrides yet
        [],   // shiftDefs — will auto-group without shift-detection
        [],   // siteHolidays
        15,   // graceMinutes
        30,   // breakDeductionMins
      );
      const summary = summariseProcessedRecords(records);
      setProcessResult(records);
      setProcessSummary(summary);
      setShowProcessModal(true);
    } catch (err) {
      console.error('Processing failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [logs]);

  const handleSaveProcessedAttendance = useCallback(async () => {
    if (!processResult || !processResult.length) return;
    setIsSavingProcessed(true);
    setProcessSaveMsg(null);
    try {
      const { inserted, error } = await api.saveProcessedAttendance(processResult);
      if (error) {
        setProcessSaveMsg(`⚠️ Save failed: ${error}`);
      } else {
        setProcessSaveMsg(`✅ Saved ${inserted} attendance records to Supabase.`);
      }
    } catch (err: any) {
      setProcessSaveMsg(`⚠️ Error: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSavingProcessed(false);
    }
  }, [processResult]);

  const reportPeriodLabel = `${fromDate} ${MONTH_NAMES[selectedMonth - 1].slice(0, 3)} ${selectedYear} - ${toDate} ${MONTH_NAMES[selectedMonth - 1].slice(0, 3)} ${selectedYear}`;

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      
      {/* ── Page Header (Exact match to Biometric Devices / ManageDevices.tsx) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-extrabold text-primary-text tracking-tight">Device Logs</h1>
          <p className="text-muted mt-1">Live biometric machine scan logs & punch history directly from eTimeTrackLite.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Raw Burst Scans Toggle */}
          <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-card cursor-pointer text-xs font-bold text-primary-text shadow-sm select-none hover:bg-muted/10 transition-colors">
            <input
              type="checkbox"
              checked={isRawBurst}
              onChange={(e) => setIsRawBurst(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded"
            />
            Raw Burst Scans ({logs.length} Punches)
          </label>

          {/* Process Attendance Button */}
          <button
            onClick={handleProcessAttendance}
            disabled={isProcessing || isLoading || logs.length === 0}
            className="flex items-center justify-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap size={15} className={isProcessing ? 'animate-pulse' : ''} />
            <span>{isProcessing ? 'Processing...' : 'Process Attendance'}</span>
          </button>

          {/* Sync Button */}
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Syncing...' : 'Sync Logs'}</span>
          </button>
        </div>
      </div>

      {/* ── Filter Card (Clean card with border-border, NO thick green outline) ── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
        
        {/* Preset Date Range Buttons & Connection Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
            {['25th - 26th Sep', 'Today', 'Yesterday', 'Last 3 Days', 'Last 7 Days', 'This Month'].map(preset => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeDatePreset === preset
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-card text-muted hover:text-primary-text border border-border hover:bg-muted/10'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Connection
            </div>
            {lastRefreshedAt && <span>Updated: {lastRefreshedAt}</span>}
          </div>
        </div>

        {/* 9 Filter Selects Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          
          {/* Select Device */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1">Select Device</label>
            <select
              value={selectedDevice}
              onChange={e => setSelectedDevice(e.target.value)}
              className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-border bg-card text-primary-text outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">All Devices</option>
              {deviceList.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-border bg-card text-primary-text outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m} ({MONTH_NAMES[m - 1].slice(0, 3)})</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-border bg-card text-primary-text outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1">From Date</label>
            <select
              value={fromDate}
              onChange={e => setFromDate(Number(e.target.value))}
              className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-border bg-card text-primary-text outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>Day {d}</option>
              ))}
            </select>
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1">To Date</label>
            <select
              value={toDate}
              onChange={e => setToDate(Number(e.target.value))}
              className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-border bg-card text-primary-text outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>Day {d}</option>
              ))}
            </select>
          </div>

          {/* Verify Mode */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1">Verify Mode</label>
            <select
              value={verifyModeFilter}
              onChange={e => setVerifyModeFilter(e.target.value)}
              className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-border bg-card text-primary-text outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">All Modes</option>
              <option value="VS_FACE">VS_FACE</option>
              <option value="FP">FP (Fingerprint)</option>
              <option value="CARD">Card</option>
              <option value="PWD">Password</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-border bg-card text-primary-text outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="DownloadDate">Download Date</option>
              <option value="LogDate">Log Date</option>
              <option value="UserId">User ID</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1">Sort Order</label>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as any)}
              className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-border bg-card text-primary-text outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="Desc">Descending</option>
              <option value="Asc">Ascending</option>
            </select>
          </div>

          {/* Show Records */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1">Show Records</label>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-border bg-card text-primary-text outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="50">50 Records</option>
              <option value="100">100 Records</option>
              <option value="200">200 Records</option>
              <option value="500">500 Records</option>
            </select>
          </div>
        </div>

        {/* Action Row & User ID Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-primary-text">Quick User ID Filter:</span>
            <div className="relative">
              <input
                type="text"
                value={userIdSearch}
                onChange={e => setUserIdSearch(e.target.value)}
                placeholder="e.g. 31049"
                className="w-40 text-xs font-bold px-3 py-2 rounded-xl border border-border bg-card text-primary-text outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <button
              onClick={() => setShowSubFilterRow(!showSubFilterRow)}
              className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary-text px-2 py-1 transition-colors"
            >
              <SlidersHorizontal size={13} />
              {showSubFilterRow ? 'Hide Column Filters' : 'Show Column Filters'}
            </button>
          </div>

          {/* Apply Filters Button */}
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 ml-auto"
          >
            <Filter size={14} />
            {isLoading ? 'Loading...' : 'Apply Filters'}
          </button>
        </div>
      </div>

      {/* ── Table & Results Section (Clean card with border-border, NO thick green outline) ── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        
        {/* Results Header with Export buttons */}
        <div className="p-5 flex flex-wrap items-center justify-between gap-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-primary-text">
                Device Logs Preview & Export
              </h2>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted">
              <span>{totalRecords} records loaded • Period: {reportPeriodLabel}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                MS SQL Database
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportExcel}
              disabled={sortedLogs.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-border bg-card hover:bg-muted/10 text-primary-text rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              Download Excel
            </button>

            <button
              onClick={handleExportCsv}
              disabled={sortedLogs.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-border bg-card hover:bg-muted/10 text-primary-text rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Download size={14} />
              Download CSV
            </button>
          </div>
        </div>

        {/* 4 Summary Stat KPI Cards */}
        <div className="p-5 border-b border-border bg-muted/5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Total Punches */}
            <div className="bg-card p-4 rounded-xl border border-border shadow-xs text-center">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider">
                TOTAL PUNCHES
              </div>
              <div className="text-2xl font-black text-primary-text mt-0.5">
                {totalRecords}
              </div>
              <div className="text-[10px] font-medium text-emerald-600 mt-0.5">
                {isRawBurst ? 'All Burst Scans' : '5-Min Debounced'}
              </div>
            </div>

            {/* Unique Users */}
            <div className="bg-card p-4 rounded-xl border border-border shadow-xs text-center">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider">
                EMPLOYEES
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-0.5">
                {uniqueUsersCount}
              </div>
              <div className="text-[10px] font-medium text-muted mt-0.5">
                Unique User IDs
              </div>
            </div>

            {/* Primary Device */}
            <div className="bg-card p-4 rounded-xl border border-border shadow-xs text-center">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider">
                PRIMARY DEVICE
              </div>
              <div className="text-base font-bold text-primary-text mt-1 truncate px-1" title={primaryDeviceName}>
                {primaryDeviceName}
              </div>
              <div className="text-[10px] font-mono text-muted mt-0.5">
                {sortedLogs[0]?.serialNo || 'NCD8252500647'}
              </div>
            </div>

            {/* Latest Punch */}
            <div className="bg-card p-4 rounded-xl border border-border shadow-xs text-center">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider">
                LATEST PUNCH
              </div>
              <div className="text-xs font-black text-primary-text mt-2 truncate">
                {latestPunchTime}
              </div>
              <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                Verified Face
              </div>
            </div>

          </div>
        </div>

        {/* Column Quick-Filter Bar */}
        {showSubFilterRow && (
          <div className="bg-muted/10 px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-primary-text">Quick Filters:</span>
              
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2.5 py-1">
                <span className="text-[11px] text-muted">User ID:</span>
                <input
                  type="text"
                  value={userIdSearch}
                  onChange={e => setUserIdSearch(e.target.value)}
                  placeholder="31049"
                  className="w-20 font-bold text-emerald-600 outline-none text-xs bg-transparent"
                />
              </div>

              <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2.5 py-1">
                <span className="text-[11px] text-muted">Device:</span>
                <input
                  type="text"
                  value={deviceNameSearch}
                  onChange={e => {
                    setDeviceNameFilterMode(e.target.value ? 'Contains' : 'No Filter');
                    setDeviceNameSearch(e.target.value);
                  }}
                  placeholder="e.g. Utopia"
                  className="w-24 font-medium text-primary-text outline-none text-xs bg-transparent"
                />
              </div>

              <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2.5 py-1">
                <span className="text-[11px] text-muted">Serial:</span>
                <input
                  type="text"
                  value={serialNoSearch}
                  onChange={e => {
                    setSerialNoFilterMode(e.target.value ? 'Contains' : 'No Filter');
                    setSerialNoSearch(e.target.value);
                  }}
                  placeholder="Serial No..."
                  className="w-28 font-mono text-primary-text outline-none text-xs bg-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={fetchLogs}
                className="font-bold text-emerald-600 hover:underline cursor-pointer"
              >
                Apply Filter
              </button>
              <span className="text-border">|</span>
              <button
                onClick={handleRemoveFilters}
                className="font-semibold text-rose-500 hover:underline cursor-pointer"
              >
                Remove Filter
              </button>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-muted/15 text-muted border-b border-border font-bold select-none">
                <th className="py-3 px-4 whitespace-nowrap">Download Date</th>
                <th className="py-3 px-4 whitespace-nowrap">User Id</th>
                <th className="py-3 px-4 whitespace-nowrap">Log Date</th>
                <th className="py-3 px-4 whitespace-nowrap">Device Name</th>
                <th className="py-3 px-4 whitespace-nowrap">Serial No</th>
                <th className="py-3 px-4 whitespace-nowrap">Att State</th>
                <th className="py-3 px-4 whitespace-nowrap">Verify Mode</th>
                <th className="py-3 px-4 whitespace-nowrap">GPS</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Att Photo</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-emerald-600" />
                    <p className="font-bold text-primary-text">Querying MS SQL Biometrics...</p>
                    <p className="text-xs text-muted mt-0.5">Fetching punch log records for the selected date range</p>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted" />
                    <p className="font-bold text-sm text-primary-text">No device logs found</p>
                    <p className="text-xs text-muted mt-1">
                      No records match the current filters for {reportPeriodLabel}.
                    </p>
                    <button
                      onClick={handleRemoveFilters}
                      className="mt-3 px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
                    >
                      Reset Filters
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-muted/10 transition-colors"
                  >
                    {/* Download Date */}
                    <td className="py-3 px-4 font-mono text-[11px] text-muted whitespace-nowrap">
                      {formatDateTimeDisplay(row.downloadDate)}
                    </td>

                    {/* User Id */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-xs">
                        {row.userId}
                      </span>
                    </td>

                    {/* Log Date */}
                    <td className="py-3 px-4 font-mono text-[11px] text-primary-text font-semibold whitespace-nowrap">
                      {formatDateTimeDisplay(row.logDate)}
                    </td>

                    {/* Device Name */}
                    <td className="py-3 px-4 text-primary-text font-medium whitespace-nowrap">
                      {row.deviceName}
                    </td>

                    {/* Serial No */}
                    <td className="py-3 px-4 font-mono text-[11px] text-muted whitespace-nowrap">
                      {row.serialNo}
                    </td>

                    {/* Att State */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {row.attState ? (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          row.attState.toLowerCase().includes('in')
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                        }`}>
                          {row.attState}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Verify Mode */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/15 border border-border rounded-md text-[11px] font-semibold text-primary-text">
                        <CheckCircle2 size={11} className="text-emerald-600" />
                        {row.verifyMode || 'VS_FACE'}
                      </span>
                    </td>

                    {/* GPS */}
                    <td className="py-3 px-4 text-muted whitespace-nowrap">
                      {row.gps || '—'}
                    </td>

                    {/* Att Photo */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedPunchForModal(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition cursor-pointer"
                      >
                        <Eye size={12} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-4 bg-muted/5 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted">Records per page:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="font-bold text-xs px-2.5 py-1 rounded-lg border border-border bg-card text-primary-text outline-none"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>

          <div className="font-bold text-primary-text">
            Records: <span className="text-emerald-600">{totalRecords > 0 ? startIndex + 1 : 0} - {endIndex}</span> of {totalRecords}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-border bg-card text-muted hover:text-primary-text hover:bg-muted/10 disabled:opacity-30 disabled:pointer-events-none"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-border bg-card text-muted hover:text-primary-text hover:bg-muted/10 disabled:opacity-30 disabled:pointer-events-none"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-3 py-1 bg-emerald-600 text-white font-extrabold rounded-lg shadow-xs text-xs">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-border bg-card text-muted hover:text-primary-text hover:bg-muted/10 disabled:opacity-30 disabled:pointer-events-none"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-border bg-card text-muted hover:text-primary-text hover:bg-muted/10 disabled:opacity-30 disabled:pointer-events-none"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Att Photo / Punch Verification Details Modal ── */}
      {selectedPunchForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-emerald-600 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-extrabold text-sm tracking-wide">Biometric Punch Verification</h3>
              </div>
              <button
                onClick={() => setSelectedPunchForModal(null)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              
              {/* Photo / Facial scan placeholder card */}
              <div className="flex items-center gap-4 p-3.5 bg-muted/10 rounded-xl border border-border">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 font-extrabold text-xl shadow-inner">
                  {selectedPunchForModal.userId.slice(-2)}
                </div>
                <div>
                  <div className="text-[10px] text-muted font-bold uppercase tracking-wider">
                    Employee Code
                  </div>
                  <div className="text-xl font-black text-primary-text">
                    {selectedPunchForModal.userId}
                  </div>
                  <div className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified Facial Scan ({selectedPunchForModal.verifyMode})
                  </div>
                </div>
              </div>

              {/* Punch Metas Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-primary-text">
                <div className="p-2.5 bg-muted/10 rounded-xl border border-border">
                  <div className="text-[10px] font-bold text-muted">Log Timestamp</div>
                  <div className="font-bold text-primary-text mt-0.5">
                    {formatDateTimeDisplay(selectedPunchForModal.logDate)}
                  </div>
                </div>

                <div className="p-2.5 bg-muted/10 rounded-xl border border-border">
                  <div className="text-[10px] font-bold text-muted">Download Timestamp</div>
                  <div className="font-bold text-primary-text mt-0.5">
                    {formatDateTimeDisplay(selectedPunchForModal.downloadDate)}
                  </div>
                </div>

                <div className="p-2.5 bg-muted/10 rounded-xl border border-border">
                  <div className="text-[10px] font-bold text-muted">Device Location</div>
                  <div className="font-bold text-primary-text mt-0.5">
                    {selectedPunchForModal.deviceName}
                  </div>
                </div>

                <div className="p-2.5 bg-muted/10 rounded-xl border border-border">
                  <div className="text-[10px] font-bold text-muted">Machine Serial</div>
                  <div className="font-mono font-bold text-primary-text mt-0.5">
                    {selectedPunchForModal.serialNo}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300">
                <strong>Machine Verification Source:</strong> Live MS SQL eTimeTrackLite biometrics (Direction: {selectedPunchForModal.attState || 'IN/OUT Biometric'}).
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-muted/10 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedPunchForModal(null)}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          Process Attendance Result Modal
      ───────────────────────────────────────────────────────────────────── */}
      {showProcessModal && processSummary && processResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/10 flex items-center justify-center">
                  <Zap size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-primary-text">Attendance Processing Result</h2>
                  <p className="text-xs text-muted mt-0.5">{processResult.length} records computed from {logs.length} punches</p>
                </div>
              </div>
              <button
                onClick={() => { setShowProcessModal(false); setProcessSaveMsg(null); }}
                className="w-8 h-8 rounded-xl border border-border bg-muted/10 hover:bg-muted/20 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Summary KPI Cards */}
            <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 border-b border-border">
              {[
                { label: 'Present',    value: processSummary.present,   icon: <UserCheck size={16} />, color: 'text-emerald-600' },
                { label: 'Absent',     value: processSummary.absent,    icon: <UserX size={16} />,    color: 'text-red-500' },
                { label: 'Weekly Off', value: processSummary.weeklyOff, icon: <Calendar size={16} />, color: 'text-blue-500' },
                { label: 'Late',       value: processSummary.late,      icon: <Clock size={16} />,    color: 'text-amber-500' },
                { label: 'OT Hours',   value: `${processSummary.totalOtH}h`, icon: <TrendingUp size={16} />, color: 'text-purple-500' },
              ].map(stat => (
                <div key={stat.label} className="bg-muted/10 rounded-xl border border-border p-3 text-center">
                  <div className={`flex justify-center mb-1 ${stat.color}`}>{stat.icon}</div>
                  <div className={`text-lg font-extrabold ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] font-semibold text-muted mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-auto px-6 py-4">
              <p className="text-xs font-bold text-muted mb-2">Preview (up to 20 records)</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {['Emp Code', 'Date', 'In', 'Out', 'Net', 'OT', 'Late', 'Status', 'Shift'].map(h => (
                      <th key={h} className="text-left py-1.5 pr-3 font-bold text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processResult.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/5 transition-colors">
                      <td className="py-1.5 pr-3 font-semibold text-primary-text">{r.empCode}</td>
                      <td className="py-1.5 pr-3 text-muted">{r.attendanceDate}</td>
                      <td className="py-1.5 pr-3">{r.inTime ?? '—'}</td>
                      <td className="py-1.5 pr-3">{r.outTime ?? '—'}</td>
                      <td className="py-1.5 pr-3">{r.netMins ? `${Math.floor(r.netMins/60)}h${String(r.netMins%60).padStart(2,'0')}m` : '—'}</td>
                      <td className="py-1.5 pr-3">{r.otMins > 0 ? `${Math.floor(r.otMins/60)}h${String(r.otMins%60).padStart(2,'0')}m` : '—'}</td>
                      <td className="py-1.5 pr-3">{r.lateMinutes > 0 ? `${r.lateMinutes}m` : '—'}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          r.status === 'P' ? 'bg-emerald-100 text-emerald-700' :
                          r.status === 'Late' ? 'bg-amber-100 text-amber-700' :
                          r.status === 'A' ? 'bg-red-100 text-red-600' :
                          r.status === 'W/O' ? 'bg-blue-100 text-blue-600' :
                          r.status === 'H' ? 'bg-purple-100 text-purple-600' :
                          'bg-muted/20 text-muted'
                        }`}>{r.status}</span>
                      </td>
                      <td className="py-1.5 pr-3 text-muted">{r.shiftName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {processResult.length > 20 && (
                <p className="text-xs text-muted mt-2">… and {processResult.length - 20} more records</p>
              )}
            </div>

            {/* Save Action Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs">
                {processSaveMsg ? (
                  <span className={processSaveMsg.startsWith('✅') ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                    {processSaveMsg}
                  </span>
                ) : (
                  <span className="text-muted">Review results above, then save to Supabase.</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowProcessModal(false); setProcessSaveMsg(null); }}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-border bg-muted/10 hover:bg-muted/20 text-primary-text transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveProcessedAttendance}
                  disabled={isSavingProcessed || !!processSaveMsg?.startsWith('✅')}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <Save size={13} />
                  {isSavingProcessed ? 'Saving...' : 'Save to Supabase'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


export default DeviceLogsPage;
