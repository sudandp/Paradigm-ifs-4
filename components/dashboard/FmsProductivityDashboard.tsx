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
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import type { Organization } from '../../types';
import Toast from '../ui/Toast';

export const FmsProductivityDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [activePillarTab, setActivePillarTab] = useState<'all' | 'visits' | 'tasks' | 'ppm' | 'manpower' | 'quality' | 'approvals'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Quick Action Modal states
  const [quickActionModal, setQuickActionModal] = useState<string | null>(null);

  // Fetch initial organizations/sites
  useEffect(() => {
    const loadSites = async () => {
      try {
        const orgs = await api.getOrganizations();
        setOrganizations(orgs);
      } catch (e) {
        console.error('Failed to load sites for FMS productivity dashboard', e);
      }
    };
    loadSites();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setToast({ message: 'Productivity metrics refreshed with latest field data.', type: 'success' });
    }, 700);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 30 FMS PRODUCTIVITY ITEMS DATA ENGINE
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

  // 6. High-Priority Overdue Tasks
  const overdueTasks = [
    { id: 'T-104', title: 'DG Set 2 Diesel Leakage Rectification', site: 'Sobha Silicon Oasis', priority: 'High', overdueBy: '2 days', assignee: 'Kishore (Tech MEP)' },
    { id: 'T-109', title: 'Fire Hydrant Pressure Drop Inspection', site: 'iTowers Exente', priority: 'Critical', overdueBy: '1 day', assignee: 'Manoj S.' },
    { id: 'T-115', title: 'Main Basement Drainage Pump Sump Clean', site: 'Southwall Residency', priority: 'High', overdueBy: '3 days', assignee: 'Santhosh (Plumber)' }
  ];

  // 7. Helpdesk SLA Breach Countdown
  const slaBreachQueue = [
    { id: 'TCK-882', subject: 'Tower B Passenger Lift #1 Jerking & Stuck', site: 'iTowers Exente', priority: 'Critical', minutesLeft: 34, assignedTo: 'Johnson Lifts AMC' },
    { id: 'TCK-885', subject: 'Clubhouse Main Inverter Trip - Power Failure', site: 'Green Valley', priority: 'High', minutesLeft: 78, assignedTo: 'In-House MEP' }
  ];

  // 8. Daily Task Completion Velocity
  const taskVelocity = { createdToday: 18, closedToday: 14, velocityRate: '78%' };

  // 9. Pending Site Corrective Actions
  const correctiveActions = [
    { id: 'CA-1', title: 'Install rubber insulation mats near HT Electrical Panel', site: 'Sobha Silicon Oasis', due: 'Tomorrow' },
    { id: 'CA-2', title: 'Recalibrate Chlorination doser in STP Room', site: 'iTowers Exente', due: 'In 2 days' }
  ];

  // 10. Recurring Complaint Hotspots
  const complaintHotspots = [
    { title: 'Tower C STP Odour Complaint', occurrences: '3 times this week', site: 'iTowers Exente', action: 'Dosing check required' },
    { title: 'Visitor Gate Boom Barrier Delay', occurrences: '4 times this week', site: 'Southwall', action: 'Fastag antenna alignment' }
  ];

  // 11. Today's PPM Checklist Queue
  const ppmQueue = [
    { equip: 'DG Set 500 kVA (DG-01)', site: 'iTowers Exente', schedule: 'Weekly B-Check', status: 'In Progress', technician: 'Kishore M.' },
    { equip: 'Fire Jockey Pump #2', site: 'Sobha Silicon', schedule: 'Monthly Run Test', status: 'Pending', technician: 'Manoj S.' },
    { equip: 'STP Air Blower Filter #1', site: 'Southwall', schedule: 'Bi-Weekly Cleaning', status: 'Completed', technician: 'Santosh' }
  ];

  // 12. Missed / Delayed PPM Alert
  const delayedPpmCount = 2;

  // 13. Asset QR Tag Scan Compliance Rate
  const qrScanCompliance = '94.2%';

  // 14. Critical Machinery Uptime Index
  const machineryHealth = [
    { type: 'Elevators (24)', uptime: '99.8%', status: 'Normal' },
    { type: 'DG Sets (8)', uptime: '100%', status: 'Optimal' },
    { type: 'Fire Hydrants (6)', uptime: '98.5%', status: 'Minor Service' },
    { type: 'STP Plant (4)', uptime: '96.2%', status: 'Attention Req.' }
  ];

  // 15. Contractor AMC Expiry Countdown
  const expiringAmcs = [
    { vendor: 'Otis Elevators AMC', site: 'iTowers Exente', daysLeft: 18, contractType: 'Comprehensive' },
    { vendor: 'Eureka Forbes RO Plant', site: 'Southwall', daysLeft: 27, contractType: 'Semi-Comprehensive' }
  ];

  // 16. Site Manpower Deployment Deficit
  const manpowerDeficits = [
    { site: 'Sobha Silicon Oasis', required: 12, deployed: 10, deficit: 2, role: 'Security & MEP' },
    { site: 'Brigade Gateway', required: 8, deployed: 7, deficit: 1, role: 'Housekeeping' }
  ];

  // 17. Guard Patrolling QR Checkpoint Rate
  const nightPatrolRate = '92.4%';

  // 18. Shift Handover Log Compliance
  const shiftHandover = { status: 'Verified', time: '07:15 AM', signedBy: 'Praveen Guard Supervisor' };

  // 19. Double Duty / Fatigue Watch
  const fatigueAlerts = [
    { staff: 'Raju Nayak (Security Guard)', shift: 'A+B Double Duty', hoursWorked: '14.5 Hours', site: 'Southwall', needsRelief: true }
  ];

  // 20. First 60-Minute Shift Arrival Health
  const morningPunctuality = '96.5% On-Time';

  // 21. Open Snag Aging Index
  const snagAging = { under3Days: 14, between3And7: 8, over7Days: 3 };

  // 22. Top 5 Critical Safety Hazards
  const criticalHazards = [
    { id: 'H-1', title: 'Open electrical junction box near Pool Deck', site: 'iTowers Exente', severity: 'Critical' },
    { id: 'H-2', title: 'Fire exit corridor blocked with contractor paint drums', site: 'Sobha Silicon', severity: 'High' }
  ];

  // 23. Site Cleanliness & Yard Audit Scorecard
  const siteLeaderboard = [
    { rank: 1, site: 'Southwall Residency', score: '97.2%', trend: '+2.1%' },
    { rank: 2, site: 'iTowers Exente', score: '94.8%', trend: '+0.5%' },
    { rank: 3, site: 'Green Valley Villas', score: '91.0%', trend: '-1.4%' },
    { rank: 4, site: 'Sobha Silicon Oasis', score: '82.5%', trend: '-4.2%' }
  ];

  // 24. Snag Closure Verification Queue
  const snagsToVerify = [
    { id: 'SN-402', desc: 'Basement 1 overhead water drip repaired by plumber', site: 'iTowers Exente', vendor: 'Apex MEP' },
    { id: 'SN-418', desc: 'Main Gate boom barrier photo-sensor replaced', site: 'Southwall', vendor: 'SecureTech' }
  ];

  // 25. Audit Change Log Stream
  const recentAuditLogs = [
    { action: 'Updated DG Set test pressure log', user: 'Kishore M.', site: 'iTowers Exente', time: '12m ago' },
    { action: 'Closed Snag #398 (Clubhouse AC Filter)', user: 'Manoj S.', site: 'Green Valley', time: '45m ago' }
  ];

  // 26. Pending Approvals Waiting on Me
  const pendingApprovalsCount = 4;

  // 27. Gate Incident & Security Escalation Feed
  const gateIncidents = [
    { type: 'Unauthorized Vehicle Gate Entry', site: 'Sobha Silicon', time: '11:05 AM', resolved: true },
    { type: 'Visitor Gate Pass Overstay (> 4h)', site: 'iTowers Exente', time: '09:40 AM', resolved: false }
  ];

  // 28. Client Survey Checklist Compliance
  const surveyCompliance = { completed: 11, target: 14, percentage: '78.5%' };

  // 29 & 30. Composite FMS Productivity Score
  const dailyProductivityScore = 88; // /100

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
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F0FDF4] text-[#006B3F] border border-emerald-300">
                  Live Operations
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time operational velocity, supervisory visits, machinery uptime, and SLA response across all sites.
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
              <option value="all">🏢 All 18 Managed Sites</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{(org as any).name || org.fullName || org.shortName || 'Site'}</option>
              ))}
            </select>
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quick Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl shadow-2xs transition active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Refresh Field Metrics"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-700 ${isRefreshing ? 'animate-spin' : ''}`} />
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
            <span className="text-4xl font-black tracking-tight">{dailyProductivityScore}</span>
            <span className="text-sm font-semibold text-emerald-200">/ 100</span>
            <span className="ml-auto text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950">
              Optimal (High Velocity)
            </span>
          </div>

          <div className="w-full bg-emerald-950/60 rounded-full h-2 overflow-hidden">
            <div className="bg-emerald-400 h-full rounded-full transition-all duration-700" style={{ width: `${dailyProductivityScore}%` }} />
          </div>
          <span className="text-[10px] text-emerald-200/80 mt-2 block">
            Weighted on visits (92%), tasks closed (78%) & PPM on-time (94%).
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
            <span className="text-3xl font-black text-slate-900">{pendingApprovalsCount}</span>
            <span className="text-xs text-amber-700 font-bold ml-2">Action Required</span>
          </div>
          <p className="text-[11px] text-slate-500">2 Leave requests, 1 Material Gate Pass, 1 Invoice.</p>
          <button 
            onClick={() => setToast({ message: 'Routing to Approvals Inbox...', type: 'info' })}
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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
              Urgent
            </span>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black text-rose-700">34 min</span>
            <span className="text-xs text-slate-600 font-semibold block mt-0.5">
              Tower B Lift #1 Jerking (iTowers)
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-rose-100">
            <span>Vendor: Johnson Lifts</span>
            <button 
              onClick={() => setToast({ message: 'Escalation SMS & Notification dispatched to Vendor lead.', type: 'success' })}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800"
            >
              Ping Escalation
            </button>
          </div>
        </div>

        {/* Item #16: Manpower Deficit Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              #16 Manpower Deficit (Today)
            </span>
            <span className="p-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black text-orange-600">-3 Staff</span>
            <span className="text-xs text-slate-600 font-semibold ml-2">Shortfall Across 2 Sites</span>
          </div>
          <div className="text-[11px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Sobha Silicon:</span>
              <span className="font-bold text-orange-700">10/12 (-2)</span>
            </div>
            <div className="flex justify-between">
              <span>Brigade Gateway:</span>
              <span className="font-bold text-orange-700">7/8 (-1)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 3. FILTER TABS FOR THE 6 PILLARS */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        {[
          { id: 'all', label: 'All 30 Productivity Items', icon: Layers },
          { id: 'visits', label: '1. Site Visits & Routes (1-5)', icon: MapPin },
          { id: 'tasks', label: '2. Tasks & SLA Timers (6-10)', icon: Zap },
          { id: 'ppm', label: '3. PPM & Asset Health (11-15)', icon: Wrench },
          { id: 'manpower', label: '4. Manpower & Shifts (16-20)', icon: Users },
          { id: 'quality', label: '5. Quality & Snagging (21-25)', icon: ShieldCheck },
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
            <span className="text-xs font-semibold text-slate-500">Live GPS & Field Verification</span>
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
                        onClick={() => setToast({ message: `Reminder SMS sent to ${r.officer}`, type: 'success' })}
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
                  {overdueTasks.length} Bottlenecks
                </span>
              </div>
              <div className="space-y-2.5">
                {overdueTasks.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl border border-rose-200 bg-rose-50/30">
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-xs text-slate-900">{t.title}</span>
                      <span className="text-[10px] font-black text-rose-600 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                        {t.overdueBy} Overdue
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                      <span>{t.site}</span>
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
                    {taskVelocity.velocityRate} Burn-Rate
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 my-2 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Created Today</span>
                    <span className="text-xl font-black text-slate-800">{taskVelocity.createdToday}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Closed Today</span>
                    <span className="text-xl font-black text-emerald-800">{taskVelocity.closedToday}</span>
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
                  {complaintHotspots.map((h, i) => (
                    <div key={i} className="p-2 rounded-lg bg-amber-50/40 border border-amber-200/80 text-[11px] flex justify-between items-center">
                      <span className="font-semibold text-slate-800 truncate mr-2">{h.title}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded shrink-0">
                        {h.occurrences}
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
                  <span className="text-xs text-slate-500">From Past Audits</span>
                </div>
                <div className="space-y-2.5">
                  {correctiveActions.map((ca) => (
                    <div key={ca.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col space-y-1">
                      <span className="text-xs font-bold text-slate-800">{ca.title}</span>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>{ca.site}</span>
                        <span className="font-bold text-blue-700">Due: {ca.due}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => setToast({ message: 'Corrective Action task batch verified.', type: 'success' })}
                className="w-full mt-3 py-2 bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 rounded-xl transition cursor-pointer"
              >
                Mark Action Items Followed Up
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
                {delayedPpmCount > 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-300 rounded-lg">
                    #12 Alert: {delayedPpmCount} PPMs Delayed
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {ppmQueue.map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-900">{item.equip}</span>
                        <span className="text-[11px] font-semibold text-slate-500">• {item.site}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Schedule: <strong className="text-slate-700">{item.schedule}</strong> | Tech: {item.technician}
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      item.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'In Progress'
                        ? 'bg-blue-100 text-blue-800'
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
                  <span className="text-2xl font-black text-emerald-950">{qrScanCompliance}</span>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">Physical Tag Verification</span>
                </div>
                <QrCode className="w-8 h-8 text-emerald-600" />
              </div>

              {/* Item #14: Critical Machinery Uptime Index */}
              <div>
                <span className="text-[11px] font-bold text-slate-700 uppercase block mb-2">#14 Machinery Uptime Index</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {machineryHealth.map((m, i) => (
                    <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 truncate block">{m.type}</span>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="font-black text-slate-800">{m.uptime}</span>
                        <span className="text-[9px] font-bold text-emerald-700">{m.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Item #15: Contractor AMC Expiry Countdown */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 uppercase block mb-1">#15 Expiring AMC Contracts</span>
                {expiringAmcs.map((a, i) => (
                  <div key={i} className="text-[11px] flex justify-between py-1 text-slate-600">
                    <span className="truncate max-w-[170px]">{a.vendor}</span>
                    <span className="font-bold text-amber-700">{a.daysLeft}d left</span>
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
                  <span className="text-xl font-black text-slate-900">{nightPatrolRate}</span>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">142 Checkpoints Hit</span>
                </div>
                {/* Item #20: 60-Min Arrival Health */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">#20 Morning Punctuality</span>
                  <span className="text-xl font-black text-slate-900">{morningPunctuality}</span>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">Opening Shift A</span>
                </div>
              </div>

              {/* Item #18: Shift Handover Compliance */}
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">#18 Shift Handover Register</span>
                  <span className="font-bold text-slate-800">Shift A → B Checklist Handover Signed</span>
                  <span className="text-[10px] text-slate-500 block">Verified by {shiftHandover.signedBy} at {shiftHandover.time}</span>
                </div>
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              </div>

              {/* Item #19: Double Duty / Fatigue Watch */}
              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-xs flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-rose-800 uppercase block">#19 Staff Fatigue Watch (A+B Extended)</span>
                  <span className="font-bold text-slate-900">{fatigueAlerts[0].staff}</span>
                  <span className="text-[10px] text-rose-700 block">Worked {fatigueAlerts[0].hoursWorked} at {fatigueAlerts[0].site}</span>
                </div>
                <button 
                  onClick={() => setToast({ message: 'Relief guard dispatched via Roster Assistant.', type: 'success' })}
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
                  <span>Pillar 5: Quality & Yard Audit Scores (Items 21 – 25)</span>
                </h2>
                <span className="text-xs font-semibold text-slate-500">Defect Eradication</span>
              </div>

              {/* Item #21: Snag Aging Breakdown */}
              <div>
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="font-bold text-slate-700">#21 Snag Aging Distribution</span>
                  <span className="text-slate-500 text-[11px]">25 Total Active Snags</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 font-bold block">&lt; 3 Days</span>
                    <span className="text-base font-black text-emerald-900">{snagAging.under3Days}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-[10px] text-amber-800 font-bold block">3-7 Days</span>
                    <span className="text-base font-black text-amber-900">{snagAging.between3And7}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                    <span className="text-[10px] text-rose-800 font-bold block">&gt; 7 Days Alert</span>
                    <span className="text-base font-black text-rose-900">{snagAging.over7Days}</span>
                  </div>
                </div>
              </div>

              {/* Item #22: Critical Safety Hazards */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold text-slate-800 uppercase block">#22 Immediate Safety Hazards (Zero-Tolerance)</span>
                {criticalHazards.map((h) => (
                  <div key={h.id} className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 block">{h.title}</span>
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
                <span className="font-bold text-slate-700">#23 Top Cleanliness Score:</span>
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
                    {pendingApprovalsCount} Action Required
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Critical authorisations blocking on-ground field execution.
                </p>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Leave: Raju Nayak (Security)</span>
                      <span className="text-[11px] text-slate-500">2 Days Sick Leave • Southwall</span>
                    </div>
                    <button
                      onClick={() => setToast({ message: 'Raju Nayak leave approved and roster updated.', type: 'success' })}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      Approve
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Material Outward Gate Pass</span>
                      <span className="text-[11px] text-slate-500">Scrap Metal Batch #4 • iTowers</span>
                    </div>
                    <button
                      onClick={() => setToast({ message: 'Material Gate Pass authorised with QR digital stamp.', type: 'success' })}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      Authorize
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Emergency Vendor Repair Invoice</span>
                      <span className="text-[11px] text-slate-500">₹8,450 • Johnson Lifts AMC</span>
                    </div>
                    <button
                      onClick={() => setToast({ message: 'Emergency repair invoice verified & queued for finance release.', type: 'success' })}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      Release
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Avg Decision Turnaround: <strong className="text-slate-800">42 mins</strong></span>
                <span className="text-emerald-700 font-bold">Zero SLA Breaches</span>
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
                  Perimeter surveillance and automated barrier violation logs.
                </p>

                <div className="space-y-2.5">
                  {gateIncidents.map((inc, i) => (
                    <div 
                      key={i} 
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        inc.resolved ? 'bg-slate-50/60 border-slate-200' : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-slate-900">{inc.type}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Site: <strong className="text-slate-700">{inc.site}</strong> • Time: {inc.time}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        inc.resolved ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-600 text-white'
                      }`}>
                        {inc.resolved ? 'Resolved' : 'Active Alert'}
                      </span>
                    </div>
                  ))}

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Heavy Vehicle Delivery Exit</span>
                      <span className="text-[11px] text-slate-500">Site: Green Valley • Time: 08:15 AM</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                      Cleared
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setToast({ message: 'All active gate alerts flagged to Site Shift Marshals.', type: 'info' })}
                className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 rounded-xl transition cursor-pointer"
              >
                Broadcast Incident Checklist to Marshals
              </button>
            </div>

            {/* Items #28, #29, #30: Survey Compliance, Quick Launchpad & Composite Score */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              {/* Item #28: Client Survey & Audit Compliance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-900">#28 Client Survey Compliance</h3>
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
                      <span className="text-2xl font-black text-slate-900">{dailyProductivityScore}</span>
                      <span className="text-xs font-bold text-slate-400">/ 100</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-xl border border-emerald-300">
                    High Velocity
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] text-slate-500 mt-2">
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">Visits: <strong className="text-slate-800">92%</strong></div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">Tasks: <strong className="text-slate-800">78%</strong></div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">PPM: <strong className="text-slate-800">94%</strong></div>
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
                onClick={() => { setQuickActionModal(null); setToast({ message: 'GPS Site Visit Check-in Logged.', type: 'success' }); }}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center space-x-3 text-left transition"
              >
                <div className="p-2 rounded-lg bg-emerald-100 text-[#006B3F]"><MapPin className="w-4 h-4" /></div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Check In to Site Visit</span>
                  <span className="text-[10px] text-slate-500">Record live GPS coordinates and start inspection</span>
                </div>
              </button>

              <button 
                onClick={() => { setQuickActionModal(null); setToast({ message: 'Emergency Work Order Dispatched to MEP Team.', type: 'success' }); }}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center space-x-3 text-left transition"
              >
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700"><Zap className="w-4 h-4" /></div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Dispatch Urgent Task</span>
                  <span className="text-[10px] text-slate-500">Assign immediate work order to available on-site technician</span>
                </div>
              </button>

              <button 
                onClick={() => { setQuickActionModal(null); setToast({ message: 'Snag created with camera capture queue.', type: 'success' }); }}
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
