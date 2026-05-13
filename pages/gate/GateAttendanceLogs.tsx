/**
 * GateAttendanceLogs.tsx — Admin dashboard for gate attendance logs
 * View today's attendance, filter by date/method, export to CSV.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGateAttendanceLogs } from '../../services/gateApi';
import type { GateAttendanceLog, GateAttendanceMethod } from '../../types/gate';
import {
  ArrowLeft, Calendar, Download, Filter, Loader2, User,
  QrCode, Camera, Search, RefreshCw, Clock, Hash
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { isAdmin as checkIsAdmin } from '../../utils/auth';

const formatAction = (action?: string) => {
  if (!action) return '—';
  return action.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const METHOD_ICONS: Record<string, React.ReactNode> = {
  face: <Hash className="w-3.5 h-3.5 opacity-40" />, // Legacy fallback
  qr: <QrCode className="w-3.5 h-3.5" />,
  manual: <Camera className="w-3.5 h-3.5" />,
  passcode: <Hash className="w-3.5 h-3.5" />,
};

const METHOD_COLORS: Record<string, string> = {
  face: 'bg-slate-50 text-slate-400 border-slate-200', // Legacy fallback
  qr: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  manual: 'bg-amber-50 text-amber-700 border-amber-200',
  passcode: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const GateAttendanceLogs: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  
  // ─── RBAC: Ensure only Admin and Security roles can access ───
  useEffect(() => {
    if (!currentUser) return;
    
    const role = (currentUser.role || '').toLowerCase();
    const isSecurity = role.includes('security');
    const isAdmin = checkIsAdmin(currentUser.role);
    
    if (!isAdmin && !isSecurity) {
      console.warn('[GateAttendanceLogs] Unauthorized access attempt by:', currentUser.email);
      navigate('/forbidden', { replace: true });
    }
  }, [currentUser, navigate]);
  const [logs, setLogs] = useState<GateAttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [methodFilter, setMethodFilter] = useState<GateAttendanceMethod | ''>('');
  const [search, setSearch] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGateAttendanceLogs({
        date: selectedDate,
        method: methodFilter || undefined,
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch gate logs:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, methodFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Filter by search text
  const filtered = logs.filter((l) =>
    !search || (l.userName || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.department || '').toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const totalToday = logs.length;
  const byMethod = { qr: 0, manual: 0, passcode: 0 };
  logs.forEach((l) => { if (byMethod[l.method as string] !== undefined) byMethod[l.method as string]++; });

  // Export CSV
  const exportCsv = () => {
    const headers = ['Name', 'Department', 'Action', 'Method', 'Device', 'Confidence', 'Time', 'Notes'];
    const rows = filtered.map((l) => [
      l.userName || '',
      l.department || '',
      formatAction(l.deviceInfo?.action),
      l.method,
      l.deviceInfo?.deviceName || 'Web Browser',
      l.confidence ? (l.confidence * 100).toFixed(1) + '%' : '',
      format(new Date(l.markedAt), 'hh:mm:ss a'),
      l.notes || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gate-attendance-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 md:px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-primary-text">Gate Attendance Logs</h1>
            <p className="text-xs text-muted">{format(new Date(selectedDate), 'EEEE, dd MMM yyyy')}</p>
          </div>
          <button onClick={loadLogs} className="p-2 rounded-xl hover:bg-gray-100 transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4 text-muted" />
          </button>
          <button onClick={exportCsv} className="btn btn-md btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center bg-white p-3 md:p-4 rounded-3xl border border-border shadow-sm max-md:bg-[#0d2c18]/40 max-md:border-white/5 max-md:shadow-2xl mt-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted max-md:text-white/20" />
              <input type="date" value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-11 bg-page border border-border rounded-2xl pl-11 pr-4 text-sm text-primary-text focus:ring-2 focus:ring-accent/20 outline-none transition-all max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white" />
            </div>
            
            <div className="relative">
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as any)}
                className="h-11 bg-page border border-border rounded-2xl px-4 text-sm text-primary-text focus:ring-2 focus:ring-accent/20 outline-none transition-all max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white select-none">
                <option value="">All Methods</option>
                <option value="qr">QR Code</option>
                <option value="passcode">Passcode</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <div className="relative flex-1 min-w-[200px] group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors max-md:text-white/20" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name..."
                className="w-full h-11 bg-page border border-border rounded-2xl pl-11 pr-4 text-sm text-primary-text placeholder:text-muted focus:ring-2 focus:ring-accent/20 outline-none transition-all max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white max-md:placeholder:text-white/20" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
            <p className="text-xs text-muted uppercase font-semibold">Total Today</p>
            <p className="text-3xl font-bold text-primary-text mt-1">{totalToday}</p>
          </div>
          {(['qr', 'passcode', 'manual'] as const).map((m) => (
            <div key={m} className="bg-card rounded-2xl border border-border p-4 shadow-card">
              <p className="text-xs text-muted uppercase font-semibold flex items-center gap-1.5">{METHOD_ICONS[m]} {m}</p>
              <p className="text-3xl font-bold text-primary-text mt-1">{byMethod[m]}</p>
            </div>
          ))}
        </div>

        {/* Log List */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted text-sm">No attendance logs found for this date</div>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">Employee</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">Department</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">Action</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">Method</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">Device</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">Confidence</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-muted text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {log.userPhotoUrl
                            ? <img src={log.userPhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
                            : <div className="w-8 h-8 rounded-full bg-accent-light flex items-center justify-center"><User className="w-4 h-4 text-accent" /></div>
                          }
                          <span className="font-medium text-primary-text">{log.userName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{log.department || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                          {formatAction(log.deviceInfo?.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${METHOD_COLORS[log.method]}`}>
                          {METHOD_ICONS[log.method]} {log.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {log.deviceInfo?.deviceName || '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {log.confidence ? `${(log.confidence * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-muted">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(log.markedAt), 'hh:mm:ss a')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {filtered.map((log) => (
                <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                  {log.userPhotoUrl
                    ? <img src={log.userPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
                    : <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center"><User className="w-5 h-5 text-accent" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary-text text-sm truncate">{log.userName}</p>
                    <p className="text-xs text-muted truncate">
                      {log.deviceInfo?.action && (
                        <span className="font-medium text-gray-600 mr-1">
                          {formatAction(log.deviceInfo.action)} •
                        </span>
                      )}
                      {log.department || '—'} • {format(new Date(log.markedAt), 'hh:mm a')}
                    </p>
                    <p className="text-[10px] text-accent/60 font-medium truncate">{log.deviceInfo?.deviceName || 'Web'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${METHOD_COLORS[log.method]}`}>
                    {log.method}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GateAttendanceLogs;
