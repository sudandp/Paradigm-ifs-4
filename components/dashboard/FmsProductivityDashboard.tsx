import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Wrench, 
  ShieldAlert, 
  TrendingUp, 
  Activity, 
  QrCode, 
  Calendar, 
  ChevronRight, 
  RefreshCw, 
  Search, 
  ArrowUpRight, 
  Zap, 
  AlertCircle, 
  Phone, 
  Plus, 
  Check, 
  X, 
  Filter, 
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Gauge,
  Layers,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { opsApi } from '../../services/opsApi';
import { useFmsProductivity } from '../../hooks/useFmsProductivity';
import Toast from '../ui/Toast';

// ─── Small UI helpers ───────────────────────────────────────────────────────

/** Marks a widget still running on placeholder data (not yet wired to a source). */
const SampleBadge: React.FC = () => (
  <span
    title="Placeholder data: this widget is not connected to a live source yet"
    className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-slate-200 text-slate-600 border border-slate-300"
  >
    Sample
  </span>
);

/** Shown when a live source failed to load (RLS, missing table, offline). */
const UnavailableNote: React.FC = () => (
  <p className="text-[11px] text-slate-400 italic">Data source unavailable.</p>
);

const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] text-slate-400 py-2">{children}</p>
);

const fmtDuration = (ms: number) => {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)} days`;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

export const FmsProductivityDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [activePillarTab, setActivePillarTab] = useState<'all' | 'visits' | 'tasks' | 'ppm' | 'manpower' | 'quality' | 'approvals'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Quick Action Modal states
  const [quickActionModal, setQuickActionModal] = useState<string | null>(null);

  // Sites = entities (ops tables key on entity_id)
  useEffect(() => {
    opsApi.getContractEntities().then(setSites).catch((e) => {
      console.error('Failed to load sites for FMS productivity dashboard', e);
    });
  }, []);

  const selectedSite = sites.find((s) => s.id === selectedSiteId);
  const { snapshot, isLoading, isFetching, error, refresh, now } = useFmsProductivity(
    selectedSiteId === 'all' ? undefined : selectedSiteId,
    selectedSite?.name,
  );

  const handleRefresh = async () => {
    const res = await refresh();
    setToast(
      res.error
        ? { message: 'Refresh failed. Showing last loaded data.', type: 'error' }
        : { message: 'Metrics refreshed from live data.', type: 'success' },
    );
  };

  // ── Live sections (from snapshot) ─────────────────────────────────────────
  const tk = snapshot?.tickets;
  const ppm = snapshot?.ppm;
  const assets = snapshot?.assets;
  const contracts = snapshot?.contracts;
  const snags = snapshot?.snags;
  const approvals = snapshot?.approvals;
  const gate = snapshot?.gate;
  const patrol = snapshot?.patrol;
  const score = snapshot?.score;
  const topThreat = tk?.data.slaThreats[0];

  // ──────────────────────────────────────────────────────────────────────────
  // SAMPLE DATA: widgets below are NOT wired yet (Phase 2 / Phase 4 of
  // fms-productivity-realtime-plan.md). Each one renders a <SampleBadge />.
  // ──────────────────────────────────────────────────────────────────────────

  // 1. Site Visit Frequency Heatmap
  const siteVisitsHeatmap = useMemo(() => [
    { id: '1', name: 'iTowers Exente', lastVisit: 'Today 10:15 AM', daysAgo: 0, status: 'good', officer: 'Rajesh K.' },
    { id: '2', name: 'Southwall Residency', lastVisit: 'Today 08:30 AM', daysAgo: 0, status: 'good', officer: 'Manoj S.' },
    { id: '3', name: 'Green Valley Villas', lastVisit: 'Yesterday', daysAgo: 1, status: 'fair', officer: 'Suresh P.' },
    { id: '4', name: 'Prestige Meridian', lastVisit: '2 days ago', daysAgo: 2, status: 'warning', officer: 'Unassigned' },
    { id: '5', name: 'Sobha Silicon Oasis', lastVisit: '4 days ago', daysAgo: 4, status: 'critical', officer: 'Rajesh K.' },
    { id: '6', name: 'Brigade Gateway Commercial', lastVisit: '5 days ago', daysAgo: 5, status: 'critical', officer: 'Manoj S.' },
  ], []);

  // 2. Planned vs Actual Site Visits
  const visitQuota = { planned: 8, completed: 5, inProgress: 1, pending: 2 };

  // 3. Live Team On-Ground Radar
  const fieldTeamRadar = [
    { name: 'Rajesh Kumar', role: 'Area Operations Officer', site: 'Sobha Silicon Oasis', status: 'On-Site', time: 'Since 09:30 AM', phone: '9845012345' },
    { name: 'Manoj Sharma', role: 'Technical Supervisor', site: 'Southwall Residency', status: 'In-Transit', time: 'En route to Brigade', phone: '9880198765' },
    { name: 'Suresh Patil', role: 'Quality Audit Inspector', site: 'Green Valley Villas', status: 'On-Site', time: 'Since 10:00 AM', phone: '9740234567' },
    { name: 'Dinesh Reddy', role: 'Facility Executive', site: 'Head Office', status: 'Stationary', time: 'Desk Review', phone: '9900345678' }
  ];

  // 4. Pending Daily Field Reports
  const pendingReports = [
    { officer: 'Manoj Sharma', site: 'Prestige Meridian (Morning Visit)', deadline: 'Today 06:00 PM', status: 'Pending' },
    { officer: 'Suresh Patil', site: 'Green Valley Villas (Safety Audit)', deadline: 'Today 06:00 PM', status: 'Pending' },
  ];

  // 5. Geofence Dwell-Time Analytics
  const avgDwellTime = '1h 48m per site';

  // 16. Site Manpower Deployment Deficit
  const manpowerDeficits = [
    { site: 'Sobha Silicon Oasis', required: 12, deployed: 10, deficit: 2, role: 'Security & MEP' },
    { site: 'Brigade Gateway', required: 8, deployed: 7, deficit: 1, role: 'Housekeeping' }
  ];

  // 18. Shift Handover Log Compliance
  const shiftHandover = { status: 'Verified', time: '07:15 AM', signedBy: 'Praveen Guard Supervisor' };

  // 19. Double Duty / Fatigue Watch
  const fatigueAlerts = [
    { staff: 'Raju Nayak (Security Guard)', shift: 'A+B Double Duty', hoursWorked: '14.5 Hours', site: 'Southwall', needsRelief: true }
  ];

  // 20. First 60-Minute Shift Arrival Health
  const morningPunctuality = '96.5% On-Time';

  // 23. Site Cleanliness & Yard Audit Scorecard
  const siteLeaderboard = [
    { rank: 1, site: 'Southwall Residency', score: '97.2%', trend: '+2.1%' },
    { rank: 2, site: 'iTowers Exente', score: '94.8%', trend: '+0.5%' },
    { rank: 3, site: 'Green Valley Villas', score: '91.0%', trend: '-1.4%' },
    { rank: 4, site: 'Sobha Silicon Oasis', score: '82.5%', trend: '-4.2%' }
  ];

  // 28. Client Survey Checklist Compliance
  const surveyCompliance = { completed: 11, target: 14, percentage: '78.5%' };

  return (
    <div className="space-y-6 pb-20 select-none antialiased">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER: FMS COMMAND TITLE, REFRESH & QUICK ACTIONS */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#006B3F] text-white flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  FMS Operational Productivity Command Center
                </h1>
                {error && !snapshot ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
                    Offline
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F0FDF4] text-[#006B3F] border border-emerald-300 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isFetching ? 'animate-ping' : ''}`} />
                    {isLoading ? 'Loading…' : 'Live'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {snapshot
                  ? `Updated ${fmtTime(snapshot.generatedAt)} • auto-refreshes on every change. Widgets tagged SAMPLE are not connected yet.`
                  : 'Loading live operational data…'}
              </p>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Site Selector */}
          <div className="relative">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 pr-8 text-xs font-bold text-slate-700 shadow-2xs cursor-pointer hover:bg-slate-100 transition focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">🏢 All {sites.length || ''} Managed Sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quick Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl shadow-2xs transition active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Refresh Field Metrics"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-700 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Live</span>
          </button>

          {/* Item #29: Quick Action Launchpad */}
          <button
            onClick={() => setQuickActionModal('log_visit')}
            className="px-4 py-2 bg-[#006B3F] hover:bg-[#005632] text-white rounded-xl shadow-xs font-bold text-xs flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Dispatch</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 2. TOP HERO ROW: PRODUCTIVITY SCORE (#30) + 4 URGENCY GAUGES */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Item #30: Daily FMS Productivity Score */}
        <div className="bg-gradient-to-br from-[#006B3F] to-[#04331C] text-white rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">
              #30 Daily Productivity Score
            </span>
            <span className="p-1 rounded-lg bg-emerald-800/60 text-emerald-300">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>

          <div className="my-3 flex items-baseline space-x-2">
            <span className="text-4xl font-black tracking-tight">{score?.value ?? '—'}</span>
            <span className="text-sm font-semibold text-emerald-200">/ 100</span>
            {score?.value != null && (
              <span className="ml-auto text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950">
                {score.value >= 85 ? 'Optimal' : score.value >= 65 ? 'Steady' : 'Needs Attention'}
              </span>
            )}
          </div>

          <div className="w-full bg-emerald-950/60 rounded-full h-2 overflow-hidden">
            <div className="bg-emerald-400 h-full rounded-full transition-all duration-700" style={{ width: `${score?.value ?? 0}%` }} />
          </div>
          <span className="text-[10px] text-emerald-200/80 mt-2 block">
            Equal weight: tasks closed today ({fmtPct(score?.tasksPct)}), PPM on schedule ({fmtPct(score?.ppmPct)}), open tickets within SLA ({fmtPct(score?.slaPct)}).
          </span>
        </div>

        {/* Item #26: Pending Approvals Waiting on Me */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              #26 Approvals Waiting On You
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <FileCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black text-slate-900">{approvals?.live ? approvals.data.total : '—'}</span>
            <span className="text-xs text-amber-700 font-bold ml-2">
              {approvals?.live && approvals.data.total === 0 ? 'All clear' : 'Action Required'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {approvals?.live
              ? `${approvals.data.leaveCount} leave, ${approvals.data.opsCount} workflow, ${approvals.data.gatePassCount} gate pass.`
              : 'Approval sources unavailable.'}
          </p>
          <button
            onClick={() => navigate('/enterprise/approvals')}
            className="mt-2 text-xs font-bold text-[#006B3F] hover:underline flex items-center space-x-1"
          >
            <span>Review & Authorize</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Item #7: Helpdesk SLA Countdown */}
        <div className="bg-white border border-rose-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              #7 SLA Breach Threat (&lt; 2h)
            </span>
            {topThreat && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                Urgent
              </span>
            )}
          </div>
          {topThreat ? (
            <>
              <div className="my-2">
                <span className="text-3xl font-black text-rose-700">
                  {fmtDuration(new Date(topThreat.dueAt).getTime() - now)}
                </span>
                <span className="text-xs text-slate-600 font-semibold block mt-0.5 truncate" title={topThreat.title}>
                  {topThreat.title} ({topThreat.site})
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-rose-100">
                <span className="truncate mr-2">
                  Assigned: {topThreat.assignee}
                  {tk!.data.slaThreats.length > 1 && ` • +${tk!.data.slaThreats.length - 1} more`}
                </span>
                <button
                  onClick={() => navigate('/operations/tickets')}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 shrink-0"
                >
                  Open Ticket
                </button>
              </div>
            </>
          ) : (
            <div className="my-2">
              <span className="text-3xl font-black text-emerald-700">{tk?.live ? 'None' : '—'}</span>
              <span className="text-xs text-slate-600 font-semibold block mt-0.5">
                {tk?.live
                  ? `No tickets due in the next 2h${tk.data.breachedCount ? ` • ${tk.data.breachedCount} already breached` : ''}`
                  : 'Ticket source unavailable'}
              </span>
            </div>
          )}
        </div>

        {/* Item #16: Manpower Deficit Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              #16 Manpower Deficit (Today)
            </span>
            <span className="flex items-center gap-1.5">
              <SampleBadge />
              <span className="p-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200">
                <Users className="w-4 h-4" />
              </span>
            </span>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black text-orange-600">
              -{manpowerDeficits.reduce((a, m) => a + m.deficit, 0)} Staff
            </span>
            <span className="text-xs text-slate-600 font-semibold ml-2">Shortfall Across {manpowerDeficits.length} Sites</span>
          </div>
          <div className="text-[11px] text-slate-500 space-y-1">
            {manpowerDeficits.map((m) => (
              <div key={m.site} className="flex justify-between">
                <span>{m.site}:</span>
                <span className="font-bold text-orange-700">{m.deployed}/{m.required} (-{m.deficit})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 3. FILTER TABS FOR THE 6 PILLARS */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        {[
          { id: 'all', label: 'All Productivity Items', icon: Layers },
          { id: 'visits', label: '1. Site Visits & Routes (1-5)', icon: MapPin },
          { id: 'tasks', label: '2. Tasks & SLA Timers (6-10)', icon: Zap },
          { id: 'ppm', label: '3. PPM & Asset Health (11-15)', icon: Wrench },
          { id: 'manpower', label: '4. Manpower & Shifts (16-20)', icon: Users },
          { id: 'quality', label: '5. Quality & Snagging (21-23)', icon: ShieldCheck },
          { id: 'approvals', label: '6. Urgency & Gate (26-30)', icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activePillarTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePillarTab(tab.id as any)}
              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-[#006B3F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 4. PILLAR 1: SITE VISITS & ROUTE EFFICIENCY (Items 1 - 5) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {(activePillarTab === 'all' || activePillarTab === 'visits') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>Pillar 1: Site Visits & Route Efficiency (Items 1 – 5)</span>
            </h2>
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <SampleBadge />
              Visit tracking not connected yet
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Item #1: Site Visit Frequency Heatmap */}
            <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">#1 Site Visit Frequency & Freshness</h3>
                  <p className="text-xs text-slate-500">Red highlights sites without an on-ground supervisory visit in &gt; 3 days.</p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded-lg text-slate-600">
                  {siteVisitsHeatmap.length} Sites Audited
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {siteVisitsHeatmap.map((site) => {
                  const isRed = site.daysAgo >= 3;
                  const isYellow = site.daysAgo === 2;
                  return (
                    <div
                      key={site.id}
                      className={`p-3.5 rounded-xl border transition ${
                        isRed
                          ? 'bg-rose-50/60 border-rose-300 text-rose-950'
                          : isYellow
                          ? 'bg-amber-50/60 border-amber-300 text-amber-950'
                          : 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs truncate">{site.name}</span>
                        {isRed && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                            &gt;3 Days!
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-[11px] space-y-1">
                        <div className="text-slate-600 flex justify-between">
                          <span>Last Visit:</span>
                          <span className="font-semibold">{site.lastVisit}</span>
                        </div>
                        <div className="text-slate-600 flex justify-between">
                          <span>Lead Officer:</span>
                          <span className="font-medium truncate max-w-[100px]">{site.officer}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Item #2: Planned vs Actual Visits + Item #5: Dwell Time */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">#2 Daily Visit Quota Progress</h3>
                <p className="text-xs text-slate-500 mb-4">Target: 8 physical site visits assigned today.</p>

                <div className="flex items-center justify-center my-4">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg viewBox="0 0 128 128" className="w-full h-full overflow-visible">
                      <g transform="rotate(-90 64 64)">
                        <circle cx="64" cy="64" r="48" stroke="#E2E8F0" strokeWidth="10" fill="none" />
                        <circle
                          cx="64"
                          cy="64"
                          r="48"
                          stroke="#006B3F"
                          strokeWidth="10"
                          strokeDasharray={301.6}
                          strokeDashoffset={301.6 - (301.6 * (visitQuota.completed || 5)) / (visitQuota.planned || 8)}
                          strokeLinecap="round"
                          fill="none"
                          className="transition-all duration-1000 ease-out"
                        />
                      </g>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-black text-slate-900 leading-none mb-1">
                        {visitQuota.completed}/{visitQuota.planned}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700">
                        {Math.round(((visitQuota.completed || 5) / (visitQuota.planned || 8)) * 100 * 10) / 10}% Done
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 text-center pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Done</span>
                    <span className="font-extrabold text-emerald-700 text-sm">{visitQuota.completed}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Active</span>
                    <span className="font-extrabold text-blue-600 text-sm">{visitQuota.inProgress}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Remaining</span>
                    <span className="font-extrabold text-amber-600 text-sm">{visitQuota.pending}</span>
                  </div>
                </div>
              </div>

              {/* Item #5: Geofence Dwell-Time Analytics */}
              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">#5 Avg Site Dwell-Time</span>
                  <span className="font-black text-slate-800 text-sm">{avgDwellTime}</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                  Thorough Inspection
                </span>
              </div>
            </div>
          </div>

          {/* Item #3 & #4: Live Radar & Pending Reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Item #3: Live Team On-Ground Radar */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <h3 className="text-sm font-bold text-slate-900">#3 Live Team On-Ground Radar</h3>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  4 Active Field Leads
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {fieldTeamRadar.map((officer, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-900">{officer.name}</span>
                        <span className="text-[10px] text-slate-500">• {officer.role}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-600 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold text-emerald-800">{officer.site}</span>
                        <span>({officer.time})</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        officer.status === 'On-Site'
                          ? 'bg-emerald-100 text-emerald-800'
                          : officer.status === 'In-Transit'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {officer.status}
                      </span>
                      <a
                        href={`tel:${officer.phone}`}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                        title="Call Officer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Item #4: Pending Daily Field Reports */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-slate-900">#4 Pending Daily Field Reports</h3>
                  </div>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Due by 06:00 PM
                  </span>
                </div>
                <div className="space-y-2.5">
                  {pendingReports.map((r, i) => (
                    <div key={i} className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{r.site}</span>
                        <span className="text-[11px] text-slate-600">Officer: {r.officer}</span>
                      </div>
                      <button
                        onClick={() => setToast({ message: 'Sample data: field-report reminders are not connected yet.', type: 'info' })}
                        className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
                      >
                        Remind Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-4">
                Field reports automatically sync client punch lists, yard photos, and vendor sign-offs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 5. PILLAR 2: TASKS, SLA & INCIDENT VELOCITY (Items 6 - 10) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {(activePillarTab === 'all' || activePillarTab === 'tasks') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span>Pillar 2: Tasks, SLA & Incident Velocity (Items 6 – 10)</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">Execution Speed & Bottleneck Resolution</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Item #6: High-Priority Overdue Tasks */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">#6 High-Priority Overdue Tasks</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                  {tk?.data.overdueHighPriorityCount ?? 0} Bottlenecks
                </span>
              </div>
              <div className="space-y-2.5">
                {tk && !tk.live && <UnavailableNote />}
                {tk?.live && tk.data.overdueHighPriority.length === 0 && (
                  <EmptyNote>No P1/P2 tickets past their due time.</EmptyNote>
                )}
                {tk?.data.overdueHighPriority.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl border border-rose-200 bg-rose-50/30">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        <span className="text-slate-400 mr-1">{t.label}</span>{t.title}
                      </span>
                      <span className="text-[10px] font-black text-rose-600 bg-white px-1.5 py-0.5 rounded border border-rose-200 shrink-0">
                        {fmtDuration(now - new Date(t.dueAt).getTime())} Overdue
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                      <span>{t.site} • {t.priority}</span>
                      <span className="font-semibold text-slate-700">Assignee: {t.assignee}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Item #8: Daily Task Completion Velocity & #10 Hotspots */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">#8 Daily Completion Velocity</h3>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {fmtPct(score?.tasksPct)} Burn-Rate
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 my-2 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Created Today</span>
                    <span className="text-xl font-black text-slate-800">{tk?.live ? tk.data.createdToday : '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Closed Today</span>
                    <span className="text-xl font-black text-emerald-800">{tk?.live ? tk.data.closedToday : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Item #10: Recurring Complaint Hotspots */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-800 uppercase block mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  #10 Recurring Complaint Hotspots
                </span>
                <div className="space-y-1.5 text-xs">
                  {tk?.live && tk.data.hotspots.length === 0 && (
                    <EmptyNote>No repeat complaints in the last 7 days.</EmptyNote>
                  )}
                  {tk?.data.hotspots.map((h) => (
                    <div key={`${h.site}-${h.title}`} className="p-2 rounded-lg bg-amber-50/40 border border-amber-200/80 text-[11px] flex justify-between items-center">
                      <span className="font-semibold text-slate-800 truncate mr-2">{h.title} • {h.site}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded shrink-0">
                        {h.count} times this week
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Item #9: Pending Site Corrective Actions */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">#9 Post-Audit Corrective Actions</h3>
                  <span className="text-xs text-slate-500">Oldest open snags</span>
                </div>
                <div className="space-y-2.5">
                  {snags && !snags.live && <UnavailableNote />}
                  {snags?.live && snags.data.correctiveActions.length === 0 && (
                    <EmptyNote>No open corrective actions.</EmptyNote>
                  )}
                  {snags?.data.correctiveActions.map((ca) => (
                    <div key={ca.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col space-y-1">
                      <span className="text-xs font-bold text-slate-800 line-clamp-2">{ca.title}</span>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>{ca.site}</span>
                        <span className="font-bold text-blue-700">Open {ca.ageDays}d</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => navigate('/operations/snag-report')}
                className="w-full mt-3 py-2 bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 rounded-xl transition cursor-pointer"
              >
                Open Snag Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 6. PILLAR 3: PPM & ASSET HEALTH (Items 11 - 15) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {(activePillarTab === 'all' || activePillarTab === 'ppm') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-600" />
              <span>Pillar 3: Preventive Maintenance (PPM) & Asset Health (Items 11 – 15)</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">Preventive Servicing & Machinery Uptime</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Item #11 & #12: Today's PPM Queue & Missed Alerts */}
            <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">#11 Today's Scheduled PPM Queue</h3>
                  <p className="text-xs text-slate-500">Critical equipment requiring preventive checkouts today.</p>
                </div>
                {(ppm?.data.delayedCount ?? 0) > 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-300 rounded-lg">
                    #12 Alert: {ppm!.data.delayedCount} PPMs Delayed
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {ppm && !ppm.live && <UnavailableNote />}
                {ppm?.live && ppm.data.queue.length === 0 && (
                  <EmptyNote>No PPM due today and nothing overdue ({ppm.data.activeCount} active schedules).</EmptyNote>
                )}
                {ppm?.data.queue.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-900">{item.equip}</span>
                        <span className="text-[11px] font-semibold text-slate-500">• {item.site}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Schedule: <strong className="text-slate-700">{item.frequency}</strong> | Role: {item.role}
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      item.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'Delayed'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Item #13, #14 & #15: QR Compliance, Uptime & AMC Expiring */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              {/* Item #13: Asset QR Tag Scan Compliance Rate */}
              <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">#13 Asset QR Scan Compliance</span>
                  <span className="text-2xl font-black text-emerald-950">{fmtPct(assets?.data.qrCompliancePct)}</span>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">
                    {assets?.live
                      ? `${assets.data.inspectedCount}/${assets.data.activeCount} assets inspected in 30 days`
                      : 'Asset source unavailable'}
                  </span>
                </div>
                <QrCode className="w-8 h-8 text-emerald-600" />
              </div>

              {/* Item #14: Critical Machinery Uptime Index */}
              <div>
                <span className="text-[11px] font-bold text-slate-700 uppercase block mb-2">#14 Machinery Availability (Now)</span>
                {assets?.live && assets.data.byCategory.length === 0 && <EmptyNote>No assets registered.</EmptyNote>}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {assets?.data.byCategory.map((m) => (
                    <div key={m.category} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 truncate block">{m.category} ({m.total})</span>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="font-black text-slate-800">{m.pct}%</span>
                        <span className={`text-[9px] font-bold ${m.worstStatus === 'Operational' ? 'text-emerald-700' : m.worstStatus === 'Critical Fault' ? 'text-rose-700' : 'text-amber-700'}`}>
                          {m.worstStatus === 'Operational' ? 'All OK' : m.worstStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Item #15: Contractor AMC Expiry Countdown */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 uppercase block mb-1">#15 Expiring AMC Contracts</span>
                {contracts?.live && contracts.data.expiring.length === 0 && (
                  <EmptyNote>No contracts expiring in the next 60 days.</EmptyNote>
                )}
                {contracts?.data.expiring.map((a) => (
                  <div key={a.id} className="text-[11px] flex justify-between py-1 text-slate-600">
                    <span className="truncate max-w-[170px]" title={`${a.vendor} • ${a.site} • ${a.type}`}>{a.vendor}</span>
                    <span className={`font-bold ${a.daysLeft <= 15 ? 'text-rose-700' : 'text-amber-700'}`}>{a.daysLeft}d left</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 7. PILLAR 4 & 5: MANPOWER, QUALITY & SNAG AUDITS (Items 16 - 25) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {(activePillarTab === 'all' || activePillarTab === 'manpower' || activePillarTab === 'quality') && (
        <div className={`grid gap-4 ${activePillarTab === 'all' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Pillar 4: On-Ground Manpower (Items 16-20) */}
          {(activePillarTab === 'all' || activePillarTab === 'manpower') && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <span>Pillar 4: Manpower & Shift Health (Items 16 – 20)</span>
                </h2>
                <span className="text-xs font-semibold text-slate-500">Operational Readiness</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                {/* Item #17: Night Patrol Rate */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">#17 Night Patrol QR Rate</span>
                  <span className="text-xl font-black text-slate-900">{fmtPct(patrol?.data.ratePct)}</span>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                    {patrol?.live
                      ? `${patrol.data.checkpointsHit}/${patrol.data.checkpointsTotal} checkpoints (24h)`
                      : 'Patrol source unavailable'}
                  </span>
                </div>
                {/* Item #20: 60-Min Arrival Health */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-center gap-1">#20 Morning Punctuality <SampleBadge /></span>
                  <span className="text-xl font-black text-slate-900">{morningPunctuality}</span>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">Opening Shift A</span>
                </div>
              </div>

              {/* Item #18: Shift Handover Compliance */}
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1.5">#18 Shift Handover Register <SampleBadge /></span>
                  <span className="font-bold text-slate-800">Shift A → B Checklist Handover Signed</span>
                  <span className="text-[10px] text-slate-500 block">Verified by {shiftHandover.signedBy} at {shiftHandover.time}</span>
                </div>
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              </div>

              {/* Item #19: Double Duty / Fatigue Watch */}
              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-xs flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-rose-800 uppercase flex items-center gap-1.5">#19 Staff Fatigue Watch (A+B Extended) <SampleBadge /></span>
                  <span className="font-bold text-slate-900">{fatigueAlerts[0].staff}</span>
                  <span className="text-[10px] text-rose-700 block">Worked {fatigueAlerts[0].hoursWorked} at {fatigueAlerts[0].site}</span>
                </div>
                <button 
                  onClick={() => setToast({ message: 'Sample data: relief dispatch is not connected yet.', type: 'info' })}
                  className="px-2.5 py-1 bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 font-bold text-[11px] rounded-lg shadow-2xs cursor-pointer active:scale-95 transition"
                >
                  Send Relief
                </button>
              </div>
            </div>
          )}

          {/* Pillar 5: Quality, Snagging & Yard Audit Scores (Items 21-25) */}
          {(activePillarTab === 'all' || activePillarTab === 'quality') && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span>Pillar 5: Quality & Yard Audit Scores (Items 21 – 23)</span>
                </h2>
                <span className="text-xs font-semibold text-slate-500">Defect Eradication</span>
              </div>

              {/* Item #21: Snag Aging Breakdown */}
              <div>
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="font-bold text-slate-700">#21 Snag Aging Distribution</span>
                  <span className="text-slate-500 text-[11px]">
                    {snags?.live ? `${snags.data.openCount} Total Active Snags` : 'Snag source unavailable'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 font-bold block">&lt; 3 Days</span>
                    <span className="text-base font-black text-emerald-900">{snags?.data.under3Days ?? '—'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-[10px] text-amber-800 font-bold block">3-7 Days</span>
                    <span className="text-base font-black text-amber-900">{snags?.data.between3And7 ?? '—'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                    <span className="text-[10px] text-rose-800 font-bold block">&gt; 7 Days Alert</span>
                    <span className="text-base font-black text-rose-900">{snags?.data.over7Days ?? '—'}</span>
                  </div>
                </div>
              </div>

              {/* Item #22: Critical Safety Hazards */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold text-slate-800 uppercase block">#22 High-Criticality Open Snags</span>
                {snags?.live && snags.data.hazards.length === 0 && (
                  <EmptyNote>No high-criticality snags open.</EmptyNote>
                )}
                {snags?.data.hazards.map((h) => (
                  <div key={h.id} className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
                    <div className="min-w-0 mr-2">
                      <span className="font-bold text-slate-900 block line-clamp-2">{h.title}</span>
                      <span className="text-[10px] text-slate-500">{h.site}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                      {h.severity}
                    </span>
                  </div>
                ))}
              </div>

              {/* Item #23: Cleanliness Leaderboard snippet */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">#23 Top Cleanliness Score: <SampleBadge /></span>
                <span className="font-extrabold text-[#006B3F] bg-[#F0FDF4] px-2.5 py-0.5 rounded-full border border-emerald-300">
                  {siteLeaderboard[0].site} ({siteLeaderboard[0].score})
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 8. PILLAR 6: URGENCY, GATE SECURITY & OPERATIONAL APPROVALS (Items 26 - 30) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {(activePillarTab === 'all' || activePillarTab === 'approvals') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
              <span>Pillar 6: Urgency, Gate Security & Operational Approvals (Items 26 – 30)</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">Fast Decision Velocity & Risk Mitigation</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Item #26: Pending Approvals Waiting on You */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-slate-900">#26 Pending Operational Approvals</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    {approvals?.data.total ?? 0} Action Required
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Pending leave, workflow approvals and material gate passes awaiting NOC.
                </p>

                <div className="space-y-2.5 text-xs">
                  {approvals && !approvals.live && <UnavailableNote />}
                  {approvals?.live && approvals.data.items.length === 0 && (
                    <EmptyNote>Nothing waiting for approval.</EmptyNote>
                  )}
                  {approvals?.data.items.map((item) => (
                    <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div className="min-w-0 mr-2">
                        <span className="font-bold text-slate-900 block truncate">{item.title}</span>
                        <span className="text-[11px] text-slate-500">{item.kind} • {item.subtitle}</span>
                      </div>
                      <button
                        onClick={() => navigate('/enterprise/approvals')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Open tickets past SLA: <strong className="text-slate-800">{tk?.live ? tk.data.breachedCount : '—'}</strong></span>
                <button onClick={() => navigate('/enterprise/approvals')} className="text-emerald-700 font-bold hover:underline">
                  Approvals Inbox →
                </button>
              </div>
            </div>

            {/* Item #27: Live Gate Security & Incident Stream */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-rose-600 animate-pulse" />
                    <h3 className="text-sm font-bold text-slate-900">#27 Gate Incident & Security Stream</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    Live Telemetry
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  {gate?.live
                    ? `Today: ${gate.data.entriesToday} gate entries • ${gate.data.overstays} visitors inside > 4h. All sites (gate data is not site-filtered yet).`
                    : 'Gate source unavailable.'}
                </p>

                <div className="space-y-2.5">
                  {gate?.live && gate.data.incidents.length === 0 && (
                    <EmptyNote>No emergency alerts raised today.</EmptyNote>
                  )}
                  {gate?.data.incidents.map((inc) => (
                    <div
                      key={inc.id}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        inc.resolved ? 'bg-slate-50/60 border-slate-200' : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="min-w-0 mr-2">
                        <span className="font-bold text-slate-900 block">{inc.type}</span>
                        <span className="text-[11px] text-slate-500 block mt-0.5 truncate">
                          {inc.location} • {fmtTime(inc.time)}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                        inc.resolved ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-600 text-white'
                      }`}>
                        {inc.resolved ? 'Resolved' : 'Active Alert'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Items #28, #29, #30: Survey Compliance, Quick Launchpad & Composite Score */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              {/* Item #28: Client Survey & Audit Compliance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">#28 Client Survey Compliance <SampleBadge /></h3>
                  <span className="text-xs font-black text-emerald-700">{surveyCompliance.percentage}</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full transition-all duration-1000" style={{ width: surveyCompliance.percentage }} />
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1.5">
                  <span>{surveyCompliance.completed} of {surveyCompliance.target} sites audited</span>
                  <span className="font-semibold text-slate-700">CSAT Score: 4.8 / 5.0</span>
                </div>
              </div>

              {/* Item #29: Quick Dispatch Launcher Button */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">#29 On-Ground Dispatch</span>
                  <span className="text-xs font-extrabold text-emerald-950 block">Instant Emergency Dispatch</span>
                  <span className="text-[10px] text-emerald-700">Push work orders directly to field staff</span>
                </div>
                <button
                  onClick={() => setQuickActionModal('dispatch')}
                  className="px-3 py-1.5 bg-[#006B3F] hover:bg-[#005230] text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Launch Pad
                </button>
              </div>

              {/* Item #30: Composite Daily Productivity Score */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">#30 Composite Index</span>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-2xl font-black text-slate-900">{score?.value ?? '—'}</span>
                      <span className="text-xs font-bold text-slate-400">/ 100</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] text-slate-500 mt-2">
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">Tasks: <strong className="text-slate-800">{fmtPct(score?.tasksPct)}</strong></div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">PPM: <strong className="text-slate-800">{fmtPct(score?.ppmPct)}</strong></div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">SLA: <strong className="text-slate-800">{fmtPct(score?.slaPct)}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 8. MODAL / DRAWER: FMS QUICK DISPATCH LAUNCHPAD (#29) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {quickActionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">#29 FMS Quick Dispatch Launchpad</h3>
              <button 
                onClick={() => setQuickActionModal(null)} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Instantly broadcast an on-ground operational request to field officers and technicians.
            </p>

            <div className="space-y-2.5">
              <button 
                onClick={() => { setQuickActionModal(null); navigate('/operations/ppm-audits'); }}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center space-x-3 text-left transition"
              >
                <div className="p-2 rounded-lg bg-emerald-100 text-[#006B3F]"><MapPin className="w-4 h-4" /></div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Check In to Site Visit</span>
                  <span className="text-[10px] text-slate-500">Record live GPS coordinates and start inspection</span>
                </div>
              </button>

              <button 
                onClick={() => { setQuickActionModal(null); navigate('/operations/tickets'); }}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center space-x-3 text-left transition"
              >
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700"><Zap className="w-4 h-4" /></div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Dispatch Urgent Task</span>
                  <span className="text-[10px] text-slate-500">Assign immediate work order to available on-site technician</span>
                </div>
              </button>

              <button 
                onClick={() => { setQuickActionModal(null); navigate('/operations/snag-audit'); }}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 flex items-center space-x-3 text-left transition"
              >
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700"><AlertTriangle className="w-4 h-4" /></div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Log Snag or Hazard</span>
                  <span className="text-[10px] text-slate-500">Upload photo evidence & assign contractor repair</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FmsProductivityDashboard;
