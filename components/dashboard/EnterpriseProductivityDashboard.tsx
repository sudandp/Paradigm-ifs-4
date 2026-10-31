import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Briefcase, 
  Users, 
  DollarSign, 
  Wrench, 
  CheckCircle2, 
  Bell, 
  Calendar, 
  Clock, 
  Sparkles, 
  Filter, 
  RefreshCw, 
  Layers, 
  Search, 
  ChevronRight,
  ShieldCheck,
  Zap,
  LayoutDashboard
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import type { Organization } from '../../types';
import Toast from '../ui/Toast';

// Department Views
import { ManagementView } from './DepartmentalViews/ManagementView';
import { BackOfficeView } from './DepartmentalViews/BackOfficeView';
import { HrManpowerView } from './DepartmentalViews/HrManpowerView';
import { FinanceBillingView } from './DepartmentalViews/FinanceBillingView';
import { SiteOpsView } from './DepartmentalViews/SiteOpsView';

// Productivity Widgets
import { MomActionTracker } from './ProductivityWidgets/MomActionTracker';
import { BroadcastNoticesBoard } from './ProductivityWidgets/BroadcastNoticesBoard';
import { EventsCalendarWidget } from './ProductivityWidgets/EventsCalendarWidget';
import { SmartRemindersHub } from './ProductivityWidgets/SmartRemindersHub';
import { DailyProductivityScorecard } from './ProductivityWidgets/DailyProductivityScorecard';

export type DashboardDepartment = 'management' | 'backoffice' | 'hr' | 'finance' | 'site_ops';

const DEPARTMENTS = [
  { id: 'management' as const, label: 'Executive Management', shortLabel: 'Management', icon: Building2, desc: 'Portfolio Health, MRR, P0 Incidents & Collections' },
  { id: 'backoffice' as const, label: 'Back Office & Admin', shortLabel: 'Back Office', icon: Briefcase, desc: 'Helpdesk Dispatch, PO Approvals & Warehouse Spares' },
  { id: 'hr' as const, label: 'HR & Manpower', shortLabel: 'HR & Manpower', icon: Users, desc: 'Shift A/B/C Muster, Biometric Sync & 2.0x Double Duty' },
  { id: 'finance' as const, label: 'Finance & Billing', shortLabel: 'Finance', icon: DollarSign, desc: 'Monthly Billing Pipeline, AR Aging & Energy Costs' },
  { id: 'site_ops' as const, label: 'Site Operations & MEP', shortLabel: 'Site Ops', icon: Wrench, desc: 'Live Team Radar, PPM Execution & Water Quality' }
];

export const EnterpriseProductivityDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Auto-detect initial department based on user role
  const getInitialDepartment = (): DashboardDepartment => {
    try {
      const saved = localStorage.getItem('paradigm_active_dash_dept');
      if (saved && ['management', 'backoffice', 'hr', 'finance', 'site_ops'].includes(saved)) {
        return saved as DashboardDepartment;
      }
    } catch {}

    const role = (user?.role || '').toLowerCase();
    if (role.includes('finance') || role.includes('billing') || role.includes('account')) return 'finance';
    if (role.includes('hr') || role.includes('recruitment') || role.includes('talent')) return 'hr';
    if (role.includes('operat') || role.includes('engineer') || role.includes('technician') || role.includes('supervisor')) return 'site_ops';
    if (role.includes('admin') || role.includes('backoffice') || role.includes('procure')) return 'backoffice';
    return 'management';
  };

  const [activeDepartment, setActiveDepartment] = useState<DashboardDepartment>(getInitialDepartment);
  const [productivitySection, setProductivitySection] = useState<'all' | 'mom' | 'notices' | 'events' | 'reminders'>('all');

  // Handle department change with persistence
  const handleDepartmentChange = (dept: DashboardDepartment) => {
    setActiveDepartment(dept);
    try {
      localStorage.setItem('paradigm_active_dash_dept', dept);
    } catch {}
  };

  // Load sites
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const orgs = await api.getOrganizations();
        setOrganizations(orgs);
      } catch (e) {
        console.warn('Failed to load sites for dashboard', e);
      }
    };
    fetchSites();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setToast({ message: 'Live facility data and productivity meters refreshed.', type: 'success' });
    }, 600);
  };

  const currentDeptMeta = useMemo(() => {
    return DEPARTMENTS.find(d => d.id === activeDepartment) || DEPARTMENTS[0];
  }, [activeDepartment]);

  return (
    <div className="space-y-6 pb-20 select-none antialiased">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* ── 1. GLOBAL COMMAND HEADER & CONTROLS ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#006B3F] text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Paradigm Enterprise Facility Command Center
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F0FDF4] text-[#006B3F] border border-emerald-300">
                Live 24x7 Operations
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Production standard productivity suite for property operations, workforce muster, and statutory governance.
            </p>
          </div>
        </div>

        {/* Global Controls: Site Filter & Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch lg:self-auto">
          {/* Site Selector */}
          <div className="relative flex-1 sm:flex-initial">
            <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
              className="pl-9 pr-8 py-2 w-full sm:w-56 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-[#006B3F] transition-all cursor-pointer shadow-2xs"
            >
              <option value="all">🏢 All Managed Properties</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {(org as any).name || org.fullName || org.shortName || 'Site'}
                </option>
              ))}
              {organizations.length === 0 && (
                <>
                  <option value="itowers">iTowers Exente</option>
                  <option value="southwall">Southwall Residency</option>
                  <option value="sobha">Sobha Silicon Oasis</option>
                  <option value="greenvalley">Green Valley Villas</option>
                  <option value="brigade">Brigade Gateway</option>
                </>
              )}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-2xs transition-all active:scale-95"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        </div>
      </div>

      {/* ── 2. DEPARTMENTAL NAVIGATION PILL BAR ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
        <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-slate-100 text-xs">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#006B3F]" /> Department Command View:
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            Current: <strong className="text-slate-800">{currentDeptMeta.label}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2">
          {DEPARTMENTS.map(dept => {
            const Icon = dept.icon;
            const isActive = activeDepartment === dept.id;

            return (
              <button
                key={dept.id}
                onClick={() => handleDepartmentChange(dept.id)}
                className={`p-3 rounded-xl border flex flex-col items-start text-left transition-all relative overflow-hidden group ${
                  isActive
                    ? 'bg-[#F0FDF4] border-emerald-400 text-slate-900 shadow-2xs ring-1 ring-emerald-400/50'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 right-0 w-8 h-8 bg-[#006B3F] text-white flex items-center justify-center rounded-bl-xl shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors ${
                  isActive ? 'bg-[#006B3F] text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-xs font-bold leading-tight ${isActive ? 'text-[#006B3F]' : 'text-slate-800'}`}>
                  {dept.shortLabel}
                </span>
                <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  {dept.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. ACTIVE DEPARTMENT OPERATIONS VIEW ── */}
      <div className="transition-all duration-300">
        {activeDepartment === 'management' && <ManagementView siteFilter={selectedSiteId} />}
        {activeDepartment === 'backoffice' && <BackOfficeView siteFilter={selectedSiteId} />}
        {activeDepartment === 'hr' && <HrManpowerView siteFilter={selectedSiteId} />}
        {activeDepartment === 'finance' && <FinanceBillingView siteFilter={selectedSiteId} />}
        {activeDepartment === 'site_ops' && <SiteOpsView siteFilter={selectedSiteId} />}
      </div>

      {/* ── 4. CROSS-CUTTING REAL-TIME PRODUCTIVITY CORE ── */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Enterprise Productivity & Action Hub
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#006B3F] text-white">
                Live Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Integrated Minutes of Meeting (MOM) tracker, company circulars, compliance calendar, and smart reminders.
            </p>
          </div>

          {/* Quick Tab filter for productivity section */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 self-start sm:self-auto text-xs">
            {(['all', 'mom', 'notices', 'events', 'reminders'] as const).map(sec => (
              <button
                key={sec}
                onClick={() => setProductivitySection(sec)}
                className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-all ${
                  productivitySection === sec
                    ? 'bg-[#006B3F] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sec === 'all' ? 'All Hubs' : sec.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Productivity Components Grid */}
        <div className="space-y-6">
          {/* Row A: MOM Action Tasks & Daily Duty Scorecard */}
          {(productivitySection === 'all' || productivitySection === 'mom') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* MOM Action Tracker (2/3 col) */}
              <div className="lg:col-span-2">
                <MomActionTracker 
                  departmentFilter={activeDepartment} 
                  siteFilter={selectedSiteId} 
                />
              </div>

              {/* Daily Duty & Productivity Scorecard (1/3 col) */}
              <div className="lg:col-span-1">
                <DailyProductivityScorecard />
              </div>
            </div>
          )}

          {/* Row B: Broadcast Notices & Circulars + Operations Events Calendar */}
          {(productivitySection === 'all' || productivitySection === 'notices' || productivitySection === 'events') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(productivitySection === 'all' || productivitySection === 'notices') && (
                <BroadcastNoticesBoard departmentFilter={activeDepartment} />
              )}
              {(productivitySection === 'all' || productivitySection === 'events') && (
                <EventsCalendarWidget departmentFilter={activeDepartment} />
              )}
            </div>
          )}

          {/* Row C: Smart Reminders Hub */}
          {(productivitySection === 'all' || productivitySection === 'reminders') && (
            <div className="grid grid-cols-1 gap-6">
              <SmartRemindersHub departmentFilter={activeDepartment} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnterpriseProductivityDashboard;
