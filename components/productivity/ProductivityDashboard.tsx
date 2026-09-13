import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Laptop, 
  Monitor, 
  Clock, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  ShieldCheck, 
  Terminal, 
  Copy, 
  Check, 
  Calendar, 
  Code2, 
  Globe, 
  MessageSquare, 
  Folder, 
  RefreshCw, 
  Sparkles,
  Zap,
  BarChart3,
  Flame,
  Coffee,
  Info
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { getUserDevices } from '../../services/deviceService';
import type { 
  LaptopAppUsageLog, 
  DailyLaptopProductivitySummary, 
  ProductivityAppStat, 
  UserDevice 
} from '../../types';
import Button from '../ui/Button';
import Toast from '../ui/Toast';

interface ProductivityDashboardProps {
  targetUserId?: string;
  targetUserName?: string;
  isManagerView?: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Development: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/30' },
  Browsing: { bg: 'bg-sky-500/10 dark:bg-sky-500/20', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-500/30' },
  Communication: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/30' },
  Productivity: { bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-700 dark:text-teal-400', border: 'border-teal-500/30' },
  Design: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-500/30' },
  Utility: { bg: 'bg-slate-500/10 dark:bg-slate-500/20', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-500/30' },
  Other: { bg: 'bg-gray-500/10 dark:bg-gray-500/20', text: 'text-gray-700 dark:text-gray-400', border: 'border-gray-500/30' }
};

export const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({
  targetUserId,
  targetUserName,
  isManagerView = false
}) => {
  const { user, isCheckedIn } = useAuthStore();
  const effectiveUserId = targetUserId || user?.id;
  const displayName = targetUserName || user?.name || 'Employee';

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [summary, setSummary] = useState<DailyLaptopProductivitySummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<LaptopAppUsageLog[]>([]);
  const [registeredLaptop, setRegisteredLaptop] = useState<UserDevice | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'setup'>('overview');

  const fetchProductivityData = useCallback(async (isSilent = false) => {
    if (!effectiveUserId) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Fetch Registered Laptop for this user
      const userDevices: UserDevice[] = await getUserDevices(effectiveUserId);
      const laptopDevice = userDevices.find(d => 
        (d.deviceType === 'web' || d.deviceName.toLowerCase().includes('laptop') || d.isExclusiveLaptop) &&
        d.status === 'active'
      ) || null;
      setRegisteredLaptop(laptopDevice);

      // 2. Fetch daily summary
      const sum = await api.getDailyProductivitySummary(effectiveUserId, selectedDate);
      setSummary(sum);

      // 3. Fetch recent raw logs for detail view (if any)
      const { data: logsData, error: logsError } = await (await import('../../services/supabase')).supabase
        .from('laptop_app_usage_logs')
        .select('*')
        .eq('user_id', effectiveUserId)
        .gte('recorded_at', `${selectedDate}T00:00:00Z`)
        .lte('recorded_at', `${selectedDate}T23:59:59Z`)
        .order('recorded_at', { ascending: false })
        .limit(40);

      if (!logsError && logsData) {
        setRecentLogs(logsData.map(row => ({
          id: row.id,
          userId: row.user_id,
          hardwareUuid: row.hardware_uuid,
          appName: row.app_name || row.process_name || 'Application',
          processName: row.process_name || row.app_name,
          windowTitle: row.window_title,
          category: row.category || 'Other',
          durationSeconds: row.duration_seconds || 10,
          isIdle: row.is_idle,
          recordedAt: row.recorded_at,
          shiftDate: row.shift_date
        })));
      }
    } catch (err: any) {
      console.warn('[ProductivityDashboard] Error loading data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveUserId, selectedDate]);

  useEffect(() => {
    fetchProductivityData();
  }, [fetchProductivityData]);

  const formatSeconds = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds <= 0) return '0m';
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setToast({ message: 'Command copied to clipboard!', type: 'success' });
    setTimeout(() => setCopiedCommand(null), 2500);
  };

  // Helper calculation for focus score
  const focusScore = useMemo(() => {
    if (!summary || summary.totalActiveSeconds === 0) return 0;
    const workCategories = ['Development', 'Productivity', 'Design'];
    let productiveSecs = 0;
    summary.topApps.forEach(app => {
      if (workCategories.includes(app.category)) {
        productiveSecs += app.durationSeconds;
      }
    });
    return Math.min(100, Math.round((productiveSecs / summary.totalActiveSeconds) * 100));
  }, [summary]);

  const quickStartScript = `# Run in PowerShell (Administrator or standard terminal)
cd "E:\\backup\\onboarding all files\\Paradigm Office 4\\desktop-agent"
npm install
npm start -- --user="${effectiveUserId}"`;

  return (
    <div className="space-y-6">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onDismiss={() => setToast(null)} 
        />
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isManagerView ? `${displayName}'s Work Productivity` : 'Work Laptop & Productivity Tracker'}
              </h2>
              {registeredLaptop?.hardwareUuid && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <Lock className="w-3 h-3" /> 1-Laptop Locked
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Tracks active work windows from punch-in to logout on authorized machines.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Selector */}
          <div className="relative flex items-center">
            <Calendar className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => fetchProductivityData(true)}
            isLoading={refreshing}
            className="!py-1.5 !px-3"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Application Overview
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'timeline'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400'
          }`}
        >
          <Activity className="w-4 h-4" /> Window History ({recentLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('setup')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'setup'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Hardware Binding & Agent Setup
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Active Work Time
                </span>
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {formatSeconds(summary?.totalActiveSeconds || 0)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                <Flame className="w-3 h-3" /> In active desktop apps
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Idle / AFK Time
                </span>
                <Coffee className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {formatSeconds(summary?.totalIdleSeconds || 0)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                No mouse/keyboard input
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Focus Efficiency
                </span>
                <Sparkles className="w-4 h-4 text-teal-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {focusScore}%
                </span>
              </div>
              <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-1 font-medium">
                Core development & tools
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Current Laptop Status
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">
                  {registeredLaptop?.deviceName || 'Work Machine'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {isCheckedIn ? 'Shift Active (Tracking)' : 'Shift Clocked Out'}
              </p>
            </div>
          </div>

          {/* Top Applications Breakdown */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Most Used Applications
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Aggregated time spent in foreground desktop programs for {selectedDate}
                </p>
              </div>

              {summary && summary.topApps.length > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                  {summary.topApps.length} Apps Tracked
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
                <span className="text-sm">Analyzing application usage logs...</span>
              </div>
            ) : (!summary || summary.topApps.length === 0) ? (
              <div className="py-12 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 mb-3">
                  <Laptop className="w-6 h-6" />
                </div>
                <h4 className="font-semibold text-slate-800 dark:text-zinc-200">No application usage recorded for this date</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mt-1 mb-4">
                  Run the background agent on your registered work laptop during an active punch-in shift to automatically stream active window analytics.
                </p>
                <Button size="sm" onClick={() => setActiveTab('setup')}>
                  View Quick Setup Guide
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {summary.topApps.map((app, idx) => {
                  const percent = summary.totalActiveSeconds > 0
                    ? Math.round((app.durationSeconds / summary.totalActiveSeconds) * 100)
                    : 0;
                  const catStyle = CATEGORY_COLORS[app.category] || CATEGORY_COLORS.Other;

                  return (
                    <div key={`${app.name || app.appName || app.processName || idx}`} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 font-bold text-slate-400 text-right">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {app.name || app.appName || app.processName || 'Application'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                            {app.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="font-mono text-slate-600 dark:text-zinc-300 font-bold">
                            {formatSeconds(app.durationSeconds)}
                          </span>
                          <span className="w-10 text-right font-semibold text-slate-400">
                            {percent}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(4, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Raw Active Window Sampler
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Every 10-second active window logged by the laptop companion agent
              </p>
            </div>
          </div>

          {recentLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No recent window samples available for {selectedDate}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-zinc-800 text-slate-400">
                    <th className="py-2.5 px-3 font-semibold">Time</th>
                    <th className="py-2.5 px-3 font-semibold">Application</th>
                    <th className="py-2.5 px-3 font-semibold">Window Title</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {recentLogs.map((log) => {
                    const timeStr = log.recordedAt 
                      ? new Date(log.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : (log.startTime || '');
                    const catStyle = CATEGORY_COLORS[log.category] || CATEGORY_COLORS.Other;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                          {timeStr}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {log.appName || log.processName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 max-w-xs truncate" title={log.windowTitle}>
                          {log.windowTitle || '(No window title)'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                            {log.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-zinc-300">
                          {log.durationSeconds}s
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Setup Tab */}
      {activeTab === 'setup' && (
        <div className="space-y-6">
          {/* Security & 1:1 Laptop Policy */}
          <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-950/20 dark:to-zinc-900 border border-emerald-500/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Strict 1-Laptop-to-1-User Exclusive Registration
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                  Every work laptop is tied cryptographically and by Hardware UUID to exactly one employee account. If another employee tries to log in or run productivity tracking on this machine, the server will block access until an administrator unbinds it.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-mono text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    UUID Hardware Locked
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-mono text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Only active during logged-in shift
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-mono text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Encrypted Supabase RLS
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bound Machine Details */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-emerald-600" />
              Machine Hardware Registration
            </h4>

            {registeredLaptop ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                  <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
                    Laptop Name
                  </span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm">
                    {registeredLaptop.deviceName}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                  <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
                    Hardware UUID
                  </span>
                  <span className="font-mono text-slate-800 dark:text-zinc-200 text-xs truncate block">
                    {registeredLaptop.hardwareUuid || 'Generated by Agent'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                  <span className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">
                    Status
                  </span>
                  <span className="font-semibold text-emerald-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active & Bound to You
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-zinc-400 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center gap-3">
                <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>No dedicated laptop registered yet. Running the desktop agent below will automatically bind your laptop's hardware UUID to your profile.</span>
              </div>
            )}
          </div>

          {/* Setup Instructions */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-600" />
              Desktop Companion Agent Quick Start
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Because modern web browsers are sandboxed and cannot inspect external operating system windows (such as VS Code or Slack), a lightweight Node.js/PowerShell agent samples active windows on your machine and pushes updates to your account.
            </p>

            <div className="relative bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto">
              <button
                onClick={() => copyToClipboard(quickStartScript, 'start-script')}
                className="absolute right-3 top-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Copy Command"
              >
                {copiedCommand === 'start-script' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <pre className="text-emerald-400">{quickStartScript}</pre>
            </div>

            <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-1">
              <p>• The agent only logs foreground window names while your Paradigm attendance punch is active.</p>
              <p>• When you punch out or take a break, tracking pauses automatically.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductivityDashboard;
