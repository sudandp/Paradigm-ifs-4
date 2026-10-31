import React, { useState } from 'react';
import {
  Building,
  Building2,
  Box,
  Users,
  Search,
  CheckCircle2,
  Calendar,
  TrendingUp,
  RefreshCw,
  Bell,
  CreditCard,
  LifeBuoy,
  Sparkles,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  MessageSquare,
  Wrench,
  DollarSign,
  IndianRupee,
  Sliders,
  Plus,
  Phone,
  Mail,
  Car,
  Home,
  ChevronLeft,
  Settings,
  ShieldCheck,
  Package,
  Folder,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import Logo from '../../components/ui/Logo';

// Megaphone icon for "Paradigm Club"
const MegaphoneIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 11 18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);

export const SocietyGateAdminDashboard: React.FC = () => {
  // Real authenticated user state from store
  const currentUser = useAuthStore((state) => state.user);
  const realUserName = currentUser?.name || (currentUser as any)?.full_name || currentUser?.email?.split('@')[0] || 'Admin';
  const realUserRole = currentUser?.role 
    ? (currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1).replace(/_/g, ' '))
    : 'Society Manager';
  const userInitials = (realUserName || 'P')
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Navigation State
  const [selectedOrgName, setSelectedOrgName] = useState<string>(
    currentUser?.societyName || currentUser?.organizationName || 'Kolte Patil iTowers Exente RWA'
  );
  const [fiscalYear, setFiscalYear] = useState<string>('FY 2026-2027');
  
  // Active Primary Item matching Screenshot (Default: 'society')
  const [activeItem, setActiveItem] = useState<string>('society');
  const [activeSubItem, setActiveSubItem] = useState<string>('buildings');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [buildingFilter, setBuildingFilter] = useState<string>('');
  
  // Accordion sub-folder states for nested options
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    society: true,
    parking: false,
    security_patrolling: false
  });

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // ── 1. EXACT 9 BUILDINGS LIST (From MyGate Screenshot) ──
  const [buildings] = useState([
    { name: 'Club House', type: 'Facilities', created: '2026-01-07 06:50:46 PM', updated: '2026-01-07 06:50:46 PM', updatedBy: 'durga.prasad@mygate.in' },
    { name: 'A', type: 'Residential', created: '2026-01-06 03:04:11 PM', updated: '2026-01-06 03:04:11 PM', updatedBy: 'rijul.balasubramanian@mygate.in' },
    { name: 'B', type: 'Residential', created: '2026-01-06 03:04:11 PM', updated: '2026-01-06 03:04:11 PM', updatedBy: 'rijul.balasubramanian@mygate.in' },
    { name: 'C', type: 'Residential', created: '2026-01-06 03:04:11 PM', updated: '2026-01-06 03:04:11 PM', updatedBy: 'rijul.balasubramanian@mygate.in' },
    { name: 'D', type: 'Residential', created: '2026-01-06 03:04:11 PM', updated: '2026-01-06 03:04:11 PM', updatedBy: 'rijul.balasubramanian@mygate.in' },
    { name: 'E', type: 'Residential', created: '2026-01-06 03:04:11 PM', updated: '2026-01-06 03:04:11 PM', updatedBy: 'rijul.balasubramanian@mygate.in' },
    { name: 'Non Member', type: 'Non Members', created: '2026-01-05 06:22:59 PM', updated: '2026-01-05 06:22:59 PM', updatedBy: 'mohan.murali@mygate.in' },
    { name: 'Security', type: 'Security', created: '2026-01-05 06:21:13 PM', updated: '2026-01-05 06:21:13 PM', updatedBy: 'mohan.murali@mygate.in' },
    { name: 'COMMON AREA', type: 'Residential', created: '2026-01-05 06:21:12 PM', updated: '2026-01-12 10:43:19 AM', updatedBy: 'sudhanshu.jaiswal@mygate.in' }
  ]);

  // ── 2. RESIDENT DIRECTORY (Flats & Occupants) ──
  const [directory] = useState([
    { id: '1', tower: 'Tower A', flat: '101', owner: 'Ramesh Sundaram', phone: '9845012345', residentType: 'Owner', vehicles: 'KA 03 AA 1102', occupancy: 'Occupied' },
    { id: '2', tower: 'Tower A', flat: '1703', owner: 'Monojit Paul', phone: '9880198765', residentType: 'Owner', vehicles: 'KA 03 AA 4120', occupancy: 'Occupied' },
    { id: '3', tower: 'Tower B', flat: '402', owner: 'Sanjay Deshmukh', phone: '9740234567', residentType: 'Tenant', vehicles: 'KA 04 MM 9021', occupancy: 'Occupied' },
    { id: '4', tower: 'Tower C', flat: '1104', owner: 'Praveen Nair', phone: '9900345678', residentType: 'Owner', vehicles: 'KA 05 PQ 7781', occupancy: 'Occupied' },
    { id: '5', tower: 'Tower E', flat: '903', owner: 'Jaivardhan', phone: '9845187654', residentType: 'Owner', vehicles: 'KA 01 EK 8812', occupancy: 'Occupied' },
    { id: '6', tower: 'Tower E', flat: '904', owner: 'Ananya Sharma', phone: '9731298456', residentType: 'Tenant', vehicles: 'KA 01 TR 2234', occupancy: 'Occupied' }
  ]);

  // ── 3. GATES LIST ──
  const [gates] = useState([
    { name: 'Main Gate (Entry/Exit)', type: 'Vehicular & Pedestrian', boomBarrier: 'Connected (Auto RFID)', guardCount: 4 },
    { name: 'Gate 2 (Back Gate)', type: 'Vehicular Only', boomBarrier: 'Connected (Fastag)', guardCount: 2 },
    { name: 'Tower A/B Basement Gate', type: 'Resident Only', boomBarrier: 'RFID Card Access', guardCount: 2 }
  ]);

  // ── 4. DEFAULTERS LIST ──
  const [defaulters] = useState([
    { id: '1', name: 'Jaivardhan', flat: 'E-E-903', amount: 99288, overdueDays: 120, status: 'Overdue > 90 Days', phone: '9845187654' },
    { id: '2', name: 'Monojit Paul', flat: 'A-A-1703', amount: 64500, overdueDays: 75, status: 'Overdue > 60 Days', phone: '9880198765' },
    { id: '3', name: 'Sanjay Deshmukh', flat: 'B-B-402', amount: 48200, overdueDays: 45, status: 'Overdue > 30 Days', phone: '9740234567' },
    { id: '4', name: 'Praveen Nair', flat: 'C-C-1104', amount: 37950, overdueDays: 32, status: 'Overdue > 30 Days', phone: '9900345678' }
  ]);

  // ── 5. EXACT 11 NAV ITEMS FROM SCREENSHOT ──
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'society',
      label: 'Society',
      icon: Building2,
      hasSub: true,
      subOptions: [
        { id: 'society_details', label: 'Society Details' },
        { id: 'buildings', label: 'Buildings' },
        { id: 'flats_amenities', label: 'Flats & Amenities' },
        { id: 'gates', label: 'Gates & Kiosks' },
        {
          id: 'parking',
          label: 'Parking',
          isFolder: true,
          nested: [
            { id: 'parking_slots', label: 'Slot Allocation' },
            { id: 'parking_rfid', label: 'RFID Vehicle Stickers' },
            { id: 'parking_visitors', label: 'Visitor Parking Bay' },
            { id: 'parking_violations', label: 'Wheel Clamp Violations' }
          ]
        },
        {
          id: 'security_patrolling',
          label: 'Security And Patrolling',
          isFolder: true,
          nested: [
            { id: 'patrol_routes', label: 'Guard Patrol Routes' },
            { id: 'checkpoint_qr', label: 'QR Checkpoint Tags' },
            { id: 'shift_handover', label: 'Shift Handover Log' },
            { id: 'incident_logs', label: 'Incident Escalations' }
          ]
        },
        { id: 'society_charges', label: 'Society Charges' },
        { id: 'generated_reports', label: 'Generated Reports' }
      ]
    },
    {
      id: 'directory',
      label: 'Directory',
      icon: Users,
      hasSub: true,
      subOptions: [
        { id: 'residents', label: 'Residents' },
        { id: 'management_committee', label: 'Management Committee' },
        { id: 'daily_help', label: 'Daily Help & Staff (Service Providers)' },
        { id: 'visitors', label: 'Visitors' },
        { id: 'vendor_master', label: 'Vendor Master' }
      ]
    },
    { id: 'club', label: 'Paradigm Club', icon: MegaphoneIcon },
    { id: 'communications', label: 'Communications', icon: MessageSquare, dot: true },
    { id: 'helpdesk', label: 'Help Desk', icon: LifeBuoy },
    { id: 'amenities', label: 'Amenities', icon: Calendar },
    { id: 'assets', label: 'Assets & Inventory', icon: Box, dot: true },
    { id: 'accounts', label: 'Accounts', icon: IndianRupee, dot: true },
    { id: 'reports', label: 'Financial Reports', icon: TrendingUp, dot: true },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const filteredBuildings = buildingFilter
    ? buildings.filter(b => b.name.toLowerCase().includes(buildingFilter.toLowerCase()) || b.type.toLowerCase().includes(buildingFilter.toLowerCase()))
    : buildings;

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-slate-800 flex font-sans select-none antialiased">
      {/* ── 1. EXACT FLOATING MYGATE SIDEBAR (Matching Screenshot Red Box) ── */}
      <aside
        className={`bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-slate-200/90 flex flex-col py-4 shrink-0 z-20 m-3 h-[calc(100vh-24px)] transition-all duration-300 ${
          isSidebarCollapsed ? 'w-16 px-2' : 'w-60 px-3'
        }`}
      >
        {/* Top Header: mygate logo + circular collapse chevron < */}
        <div className="flex items-center justify-between px-2 mb-5">
          {!isSidebarCollapsed && (
            <div className="flex items-center space-x-2.5 cursor-pointer py-1" onClick={() => setActiveItem('dashboard')}>
              <Logo
                className="h-8 w-auto max-w-[150px] object-contain"
                variant="original"
              />
            </div>
          )}

          {isSidebarCollapsed && (
            <div
              className="w-9 h-9 rounded-xl bg-[#F0FDF4] border border-emerald-200 flex items-center justify-center mx-auto shadow-2xs cursor-pointer hover:bg-emerald-100 transition"
              onClick={() => setActiveItem('dashboard')}
              title="Paradigm Portal"
            >
              <Logo
                localPath="/favicon.png"
                className="h-6 w-6 object-contain"
                variant="original"
              />
            </div>
          )}

          {/* Circular Collapse Toggle Button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-6 h-6 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
            title={isSidebarCollapsed ? 'Expand Menu' : 'Collapse Menu'}
          >
            <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-200 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* 11 Nav Items List */}
        <nav className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            const isExpanded = expandedFolders[item.id] ?? false;

            return (
              <div key={item.id} className="relative">
                {/* Main Nav Button */}
                <button
                  onClick={() => {
                    setActiveItem(item.id);
                    if (item.hasSub) {
                      toggleFolder(item.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer relative ${
                    isActive
                      ? 'text-[#006B3F] font-bold bg-[#F0FDF4] border border-emerald-100 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title={item.label}
                >
                  {/* Left Emerald Green Accent Bar on Active Item (Paradigm Brand Theme) */}
                  {isActive && (
                    <span className="w-1.5 h-6 rounded-r-full bg-[#006B3F] absolute left-0 top-1/2 -translate-y-1/2 shadow-xs" />
                  )}

                  <div className="flex items-center space-x-3 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#006B3F]' : 'text-slate-500'}`} />
                    {!isSidebarCollapsed && (
                      <div className="flex items-center space-x-1.5 truncate">
                        {/* Red Notification Dot for designated items */}
                        {item.dot && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        )}
                        <span className="truncate">{item.label}</span>
                      </div>
                    )}
                  </div>

                  {!isSidebarCollapsed && item.hasSub && (
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </motion.div>
                  )}
                </button>

                {/* Sub-Nav Accordion (Shows nested options & sub-folders when open) */}
                {!isSidebarCollapsed && item.hasSub && isExpanded && (
                  <AnimatePresence initial={false}>
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-7 pr-1 mt-0.5 space-y-0.5 border-l border-slate-200/80 ml-5"
                    >
                      {item.subOptions?.map((sub) => {
                        const isSubActive = activeSubItem === sub.id;

                        // Type A: Sub-folder (e.g. Parking, Security And Patrolling)
                        if (sub.isFolder) {
                          const isFolderOpen = expandedFolders[sub.id] ?? false;
                          const hasActiveKid = sub.nested?.some(k => activeSubItem === k.id);

                          return (
                            <div key={sub.id} className="pt-0.5">
                              <button
                                onClick={() => toggleFolder(sub.id)}
                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-semibold text-left transition cursor-pointer ${
                                  hasActiveKid
                                    ? 'bg-emerald-50/80 text-[#006B3F] font-bold'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                              >
                                <div className="flex items-center space-x-1.5 truncate">
                                  {isFolderOpen ? <FolderOpen className="w-3 h-3 text-[#006B3F]" /> : <Folder className="w-3 h-3 text-slate-400" />}
                                  <span className="truncate">{sub.label}</span>
                                </div>
                                <motion.div animate={{ rotate: isFolderOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
                                  <ChevronRight className="w-3 h-3 text-slate-400" />
                                </motion.div>
                              </button>

                              {/* Nested "Other Stuffs" */}
                              {isFolderOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="pl-3 mt-0.5 space-y-0.5 border-l border-emerald-200 ml-2"
                                >
                                  {sub.nested?.map((child) => {
                                    const isKidActive = activeSubItem === child.id;
                                    return (
                                      <button
                                        key={child.id}
                                        onClick={() => {
                                          setActiveSubItem(child.id);
                                          setActiveItem(item.id);
                                        }}
                                        className={`w-full flex items-center space-x-1.5 px-2 py-1 rounded text-xs transition cursor-pointer text-left ${
                                          isKidActive
                                            ? 'bg-[#F0FDF4] text-[#006B3F] font-bold border border-emerald-200'
                                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                        }`}
                                      >
                                        <span className={`w-1 h-1 rounded-full ${isKidActive ? 'bg-[#006B3F]' : 'bg-slate-300'}`} />
                                        <span className="truncate">{child.label}</span>
                                      </button>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </div>
                          );
                        }

                        // Type B: Direct Sub-Option (e.g. Buildings, Flats & Amenities)
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setActiveSubItem(sub.id);
                              setActiveItem(item.id);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                              isSubActive
                                ? 'bg-[#F0FDF4] text-[#006B3F] font-bold border border-emerald-200 shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── 2. MAIN WORKSPACE CONTENT AREA (Exact Screenshot Canvas) ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Sticky Desktop TopBar with floating search & status pills */}
        <header className="h-16 px-8 flex items-center justify-between sticky top-0 z-10 bg-[#F4F5F7]">
          {/* Search Modules pill */}
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Modules"
              className="w-full pl-9 pr-14 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-slate-400 shadow-2xs transition"
            />
            <div className="absolute right-3 top-2 flex items-center space-x-1 pointer-events-none">
              <span className="px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-400 border border-slate-200">
                CTRL
              </span>
              <span className="px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-400 border border-slate-200">
                K
              </span>
            </div>
          </div>

          {/* Right Selector Pills: RWA Organization, Fiscal Year, Profile */}
          <div className="flex items-center space-x-3">
            <div className="px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-800 shadow-2xs flex items-center space-x-2 cursor-pointer hover:bg-slate-50">
              <span>{selectedOrgName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>

            <div className="px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-700 shadow-2xs flex items-center space-x-2 cursor-pointer hover:bg-slate-50">
              <span>{fiscalYear}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>

            <div className="flex items-center space-x-2.5 pl-2">
              {currentUser?.photoUrl || (currentUser as any)?.avatar ? (
                <img
                  src={currentUser?.photoUrl || (currentUser as any)?.avatar}
                  alt={realUserName}
                  className="w-8 h-8 rounded-full object-cover border-2 border-emerald-500 shadow-2xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#F0FDF4] text-[#006B3F] font-black text-xs flex items-center justify-center border border-emerald-300 shadow-2xs">
                  {userInitials}
                </div>
              )}
              <div className="text-left leading-tight hidden md:block">
                <span className="font-bold text-slate-800 text-xs block">{realUserName}</span>
                <span className="text-[10px] text-emerald-700 font-semibold block">{realUserRole}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
            </div>
          </div>
        </header>

        {/* Main Canvas Body */}
        <main className="px-8 pb-12 pt-2 max-w-7xl w-full mx-auto space-y-4">
          {/* Breadcrumb matching Screenshot: Society >> Buildings */}
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
            <span className="hover:underline cursor-pointer" onClick={() => { setActiveItem('society'); setActiveSubItem('buildings'); }}>
              Society
            </span>
            <span>&gt;&gt;</span>
            <span className="text-slate-600 font-semibold capitalize">
              {activeSubItem.replace(/_/g, ' ')}
            </span>
          </div>

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE: SOCIETY >> BUILDINGS (1:1 Exact Match with Screenshot)
             ════════════════════════════════════════════════════════════════════════ */}
          {activeItem === 'society' && activeSubItem === 'buildings' && (
            <div className="space-y-4">
              {/* Heading */}
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Building List
              </h1>

              {/* Filter Controls Row */}
              <div className="flex items-center space-x-3">
                <select
                  value={buildingFilter}
                  onChange={(e) => setBuildingFilter(e.target.value)}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 w-48 shadow-2xs focus:outline-none focus:border-slate-400"
                >
                  <option value="">Building</option>
                  <option value="Club House">Club House</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                  <option value="Non Member">Non Member</option>
                  <option value="Security">Security</option>
                  <option value="COMMON AREA">COMMON AREA</option>
                </select>

                <button
                  onClick={() => {}}
                  className="px-8 py-2 bg-[#006B3F] hover:bg-[#005632] text-white font-bold text-xs rounded-md shadow-xs transition cursor-pointer"
                >
                  Submit
                </button>
              </div>

              {/* Results Count Line with Checkbox in Green & White Theme */}
              <div className="flex items-center space-x-2 pt-1 pb-1">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-emerald-300 text-[#006B3F] focus:ring-[#006B3F] accent-[#006B3F] cursor-pointer"
                />
                <span className="text-xs font-semibold text-[#006B3F]">
                  {filteredBuildings.length} Results Found
                </span>
              </div>

              {/* Exact 9-Row Table from Screenshot */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="border-b border-slate-200 bg-white">
                    <tr>
                      <th className="py-3 px-4 font-bold text-slate-800">Building Name</th>
                      <th className="py-3 px-4 font-bold text-slate-800">Building Type</th>
                      <th className="py-3 px-4 font-bold text-slate-800">Created</th>
                      <th className="py-3 px-4 font-bold text-slate-800">Updated</th>
                      <th className="py-3 px-4 font-bold text-slate-800">Updated By</th>
                      <th className="py-3 px-4 text-right">
                        <Sliders className="w-4 h-4 text-slate-400 inline cursor-pointer hover:text-slate-600" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBuildings.map((b) => (
                      <tr key={b.name} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{b.name}</td>
                        <td className="py-3.5 px-4 text-slate-600">{b.type}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">{b.created}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">{b.updated}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]" colSpan={2}>
                          {b.updatedBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE: SOCIETY >> GATES
             ════════════════════════════════════════════════════════════════════════ */}
          {activeItem === 'society' && activeSubItem === 'gates' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900">Security Gate Infrastructure</h2>
              <div className="grid grid-cols-3 gap-4">
                {gates.map((g) => (
                  <div key={g.name} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <h4 className="font-bold text-slate-900 text-sm">{g.name}</h4>
                    <p className="text-xs text-slate-500">{g.type}</p>
                    <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-semibold">
                      <span>Boom Barrier:</span>
                      <span className="text-[#006B3F]">{g.boomBarrier}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE: DIRECTORY >> RESIDENTS
             ════════════════════════════════════════════════════════════════════════ */}
          {activeItem === 'directory' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">Society Directory & Resident Registry</h3>
                  <p className="text-xs text-slate-500">437 Flats across Towers A, B, C, D, E with registered vehicles and contacts.</p>
                </div>
              </div>

              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tower & Flat</th>
                    <th className="py-3 px-4">Resident Name</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Registered Vehicle</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {directory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.tower} - {item.flat}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{item.owner}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{item.phone}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {item.residentType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{item.vehicles}</td>
                      <td className="py-3 px-4 text-[#006B3F] font-bold">Occupied</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              DYNAMIC SUB-FOLDER & MODULE VIEW (When opening nested sub-folders)
             ════════════════════════════════════════════════════════════════════════ */}
          {activeSubItem !== 'buildings' && activeSubItem !== 'gates' && activeItem !== 'directory' && activeItem !== 'dashboard' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                      {activeItem}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 capitalize">
                      {activeSubItem.replace(/_/g, ' ')}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage and configure operations, rules, and records for {activeSubItem.replace(/_/g, ' ')}.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer">
                    Export Excel
                  </button>
                  <button className="px-4 py-2 bg-[#006B3F] hover:bg-[#005632] text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition cursor-pointer">
                    <Plus className="w-4 h-4" />
                    <span>New Entry</span>
                  </button>
                </div>
              </div>

              {/* Sub-Folder Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Status</span>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-bold text-slate-800">Operational & Live</span>
                  </div>
                  <p className="text-[11px] text-slate-500">All system services synced with central Supabase cluster.</p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Records Logged</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xl font-black text-slate-900">1,248</span>
                    <span className="text-xs text-slate-400">entries</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Updated today at 4:15 PM across active checkpoints.</p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Security SLA</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xl font-black text-emerald-600">99.4%</span>
                    <span className="text-xs text-slate-400">compliance</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Zero critical pending breaches logged for this cycle.</p>
                </div>
              </div>

              {/* Sub-Folder Action Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-bold">Item ID</th>
                      <th className="py-3 px-4 font-bold">Description / Unit</th>
                      <th className="py-3 px-4 font-bold">Category</th>
                      <th className="py-3 px-4 font-bold">Assigned Guard / Staff</th>
                      <th className="py-3 px-4 font-bold">Timestamp</th>
                      <th className="py-3 px-4 font-bold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { id: 'REC-0912', desc: 'Main Gate Tower A Checkpoint', cat: activeSubItem.replace(/_/g, ' '), staff: 'Ramesh Kumar (Guard)', time: '10 mins ago', status: 'Verified' },
                      { id: 'REC-0911', desc: 'Basement Parking Slot B-24', cat: activeSubItem.replace(/_/g, ' '), staff: 'Sunil Sharma (Supervisor)', time: '28 mins ago', status: 'Verified' },
                      { id: 'REC-0910', desc: 'Club House Perimeter Patrol', cat: activeSubItem.replace(/_/g, ' '), staff: `${realUserName} (Manager)`, time: '1 hour ago', status: 'Pending Review' }
                    ].map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{row.id}</td>
                        <td className="py-3 px-4 text-slate-800 font-semibold">{row.desc}</td>
                        <td className="py-3 px-4 text-slate-500 capitalize">{row.cat}</td>
                        <td className="py-3 px-4 text-slate-600">{row.staff}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{row.time}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.status === 'Verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE: DASHBOARD OVERVIEW
             ════════════════════════════════════════════════════════════════════════ */}
          {activeItem === 'dashboard' && (
            <div className="space-y-6">
              {/* Shortcuts */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">SHORTCUTS</h2>
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {[
                    { label: 'Notice Board', icon: Bell, item: 'communications', sub: 'notice_board' },
                    { label: 'Dues Tracker', icon: CreditCard, item: 'accounts', sub: 'dues_tracker' },
                    { label: 'Helpdesk Complaints', icon: LifeBuoy, item: 'helpdesk', sub: 'all_complaints' },
                    { label: 'Flats & Amenities', icon: Calendar, item: 'society', sub: 'flats_amenities' },
                    { label: 'Entry - Exit Patrol', icon: ShieldCheck, item: 'society', sub: 'security_patrolling' },
                    { label: 'Daily Attendance', icon: Users, item: 'directory', sub: 'daily_help' }
                  ].map((pill) => {
                    const Icon = pill.icon;
                    return (
                      <button
                        key={pill.label}
                        onClick={() => {
                          setActiveItem(pill.item);
                          setActiveSubItem(pill.sub);
                        }}
                        className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-700 flex items-center space-x-2 transition shadow-2xs cursor-pointer"
                      >
                        <Icon className="w-3.5 h-3.5 text-slate-500" />
                        <span>{pill.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Telemetry and Defaulters Grid */}
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-8 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Active Gate Guards</span>
                      <span className="text-2xl font-black text-[#006B3F] block">{8}</span>
                      <span className="text-xs text-slate-500">Guards On Duty</span>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">App Adoption</span>
                      <span className="text-2xl font-black text-blue-600 block">{1144}</span>
                      <span className="text-xs text-slate-500">Users (437 Flats)</span>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Society Age</span>
                      <span className="text-lg font-bold text-slate-800 block">0 years, 9 months</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">DEFAULTERS</h3>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 text-[11px] border-b border-slate-100">
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 font-medium">Flat</th>
                        <th className="pb-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {defaulters.map((item) => (
                        <tr key={item.flat} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 font-bold text-slate-800">{item.name}</td>
                          <td className="py-2.5 font-mono text-slate-500">{item.flat}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                            ₹ {item.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── 3. FLOATING CHAT BUTTON (Bottom-Right, matching screenshot) ── */}
      <button
        onClick={() => alert('Paradigm Assist Support Chat')}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#115E59] hover:bg-[#0F766E] text-white shadow-xl flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 z-40"
        title="Support Chat"
      >
        <MessageSquare className="w-5 h-5" />
      </button>
    </div>
  );
};

export default SocietyGateAdminDashboard;
