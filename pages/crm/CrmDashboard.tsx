import React, { useEffect, useState, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrmStore } from '../../store/crmStore';
import { useAuthStore } from '../../store/authStore';
import type { CrmLead, LeadStatus } from '../../types/crm';
import { LEAD_STATUS_ORDER, LEAD_STATUS_COLORS } from '../../types/crm';
import {
  Plus, Search, Filter, BarChart3, Users, Target, TrendingUp,
  Building2, Phone, Mail, Calendar, ChevronRight, ChevronLeft, Loader2,
  ArrowUpRight, ArrowDownRight, Eye, EyeOff, Layers, Clock, MapPin, Edit2, Trash2, ChevronDown, Send, Wand2
} from 'lucide-react';
import { crmApi } from '../../services/crmApi';
import { useMediaQuery } from '../../hooks/useMediaQuery';

// Hook: animates a number from prev value to next value
const useAnimatedCounter = (target: number, duration = 400) => {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const raf = useRef<number>(0);

  useLayoutEffect(() => {
    const start = prev.current;
    const end = target;
    if (start === end) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = end;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return display;
};

const CrmDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { leads, isLoading, fetchLeads, searchQuery, setSearchQuery, kanbanFilter, setKanbanFilter, deleteLead, updateLead } = useCrmStore();
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [isAssigning, setIsAssigning] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<string>('all');
  const [showClosedLeads, setShowClosedLeads] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [sortBy, setSortBy] = useState<string>('created_desc');
  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const isMobile = useMediaQuery('(max-width: 767px)');
  // Filter transition state: true = show skeleton for 150ms after any filter change
  const [isFiltering, setIsFiltering] = useState(false);
  const filterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger skeleton shimmer whenever any filter changes
  const triggerFilter = useCallback((setter: () => void) => {
    setter();
    setIsFiltering(true);
    if (filterTimer.current) clearTimeout(filterTimer.current);
    filterTimer.current = setTimeout(() => setIsFiltering(false), 350);
  }, []);

  useEffect(() => () => { if (filterTimer.current) clearTimeout(filterTimer.current); }, []);

  const updateScrollButtons = useCallback(() => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scrollKanban = useCallback((direction: 'left' | 'right') => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    const scrollAmount = 300;
    el.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Unique locations for filter
  const locations = useMemo(() => {
    const cities = leads.map(l => l.city).filter(Boolean) as string[];
    return [...new Set(cities)].sort();
  }, [leads]);

  const handleAutoAssign = async () => {
    if (!window.confirm('This will retroactively auto-assign all unassigned leads based on their location. Proceed?')) return;
    
    setIsAssigning(true);
    let assignedCount = 0;
    try {
      const unassigned = leads.filter(l => !l.assignedTo && l.city);
      for (const lead of unassigned) {
        if (!lead.city) continue;
        const newAssignee = await crmApi.autoAssignLeadByCity(lead.city);
        if (newAssignee) {
          await updateLead(lead.id, { assignedTo: newAssignee });
          assignedCount++;
        }
      }
      if (assignedCount > 0) {
        alert(`Successfully assigned ${assignedCount} leads!`);
        await fetchLeads(); // refresh the view
      } else {
        alert('No leads matched the auto-assignment rules, or they are all already assigned.');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred during auto-assignment.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Filtered leads
  const filteredLeads = useMemo(() => {
    let result = leads;
    
    // Location-based filtering for non-admins
    const isAdminUser = ['admin', 'super_admin', 'superadmin'].includes(user?.role || '');
    if (!isAdminUser) {
      result = result.filter(l => 
        (user?.location && l.city?.toLowerCase() === user.location.toLowerCase()) || 
        l.assignedTo === user?.id
      );
    }
    
    if (kanbanFilter === 'mine' && user) {
      result = result.filter(l => l.assignedTo === user.id);
    }
    if (locationFilter !== 'all') {
      result = result.filter(l => l.city === locationFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.clientName?.toLowerCase().includes(q) ||
        l.associationName?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.contactPerson?.toLowerCase().includes(q)
      );
    }

    if (quickFilter === 'stagnant') {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      result = result.filter(l => !l.stageUpdatedAt || l.stageUpdatedAt < fourteenDaysAgo);
    }
    if (quickFilter === 'urgent') {
      result = result.filter(l => 
        l.nextFollowupDate && new Date(l.nextFollowupDate).getTime() < Date.now() && !['Won', 'Lost'].includes(l.status)
      );
    }
    
    // Sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'created_desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'created_asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'activity_desc') {
        const timeA = new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt).getTime();
        return timeB - timeA;
      }
      if (sortBy === 'activity_asc') {
        const timeA = new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt).getTime();
        return timeA - timeB;
      }
      if (sortBy === 'value_desc') return (b.dealValue || 0) - (a.dealValue || 0);
      if (sortBy === 'value_asc') return (a.dealValue || 0) - (b.dealValue || 0);
      return 0;
    });

    return result;
  }, [leads, kanbanFilter, locationFilter, searchQuery, quickFilter, sortBy, user]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredLeads.length;
    const active = filteredLeads.filter(l => !['Won', 'Lost'].includes(l.status)).length;
    const won = filteredLeads.filter(l => l.status === 'Won').length;
    const lost = filteredLeads.filter(l => l.status === 'Lost').length;
    
    // Win rate = Won / (Won + Lost)
    const closedDeals = won + lost;
    const conversionRate = closedDeals > 0 ? ((won / closedDeals) * 100).toFixed(1) : '0';
    
    const totalValue = filteredLeads.reduce((sum, l) => sum + (l.dealValue || 0), 0);
    const pipeline = filteredLeads
      .filter(l => !['Won', 'Lost'].includes(l.status))
      .reduce((sum, l) => sum + (l.dealValue || 0), 0);
    const wonValue = filteredLeads
      .filter(l => l.status === 'Won')
      .reduce((sum, l) => sum + (l.dealValue || 0), 0);
    const lostValue = filteredLeads
      .filter(l => l.status === 'Lost')
      .reduce((sum, l) => sum + (l.dealValue || 0), 0);

    const formatVal = (val: number) => {
      if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
      if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
      return `₹${val.toLocaleString('en-IN')}`;
    };

    return { 
      total, active, won, lost, 
      conversionRate, pipeline, 
      totalValue, wonValue, lostValue,
      formatVal
    };
  }, [filteredLeads]);

  // Kanban columns
  const kanbanColumns = useMemo(() => {
    const columns: Record<LeadStatus, CrmLead[]> = {} as any;
    LEAD_STATUS_ORDER
      .filter(status => showClosedLeads || !['Won', 'Lost'].includes(status))
      .forEach(status => {
        columns[status] = filteredLeads.filter(l => l.status === status);
      });
    return columns;
  }, [filteredLeads, showClosedLeads]);

  return (
    <div className={`animate-fade-in min-w-0 overflow-x-hidden min-h-screen ${isMobile ? 'bg-[#091c13] text-white p-4 pt-6 space-y-6 pb-24' : 'space-y-8 pb-32 md:pb-8'}`}>
      {/* Header */}
      <div className={`flex justify-between items-start sm:items-center ${isMobile ? 'flex-col gap-4' : 'flex-col sm:flex-row gap-6'}`}>
        <div className="w-full sm:w-auto">
          <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl text-white' : 'text-xl md:text-2xl text-primary-text'}`}>CRM Pipeline</h1>
          <p className={`mt-1 text-xs md:text-sm leading-relaxed ${isMobile ? 'text-white/60' : 'text-muted max-md:text-emerald-400/60'}`}>Streamline leads & accelerate property onboarding</p>
        </div>
        <button
          onClick={() => navigate('/crm/leads/new')}
          className={`flex items-center justify-center gap-2 transition-all active:scale-95 ${isMobile ? 'bg-[#006b3f] text-white px-5 py-2.5 rounded-full font-bold shadow-lg shadow-[#006b3f]/20 self-start' : 'hidden sm:flex btn btn-primary btn-lg shadow-xl shadow-accent/20 hover:shadow-accent/40'}`}
        >
          <Plus className="w-5 h-5" />
          <span>New Lead</span>
        </button>
      </div>

      {/* Mobile Floating Action Button - Premium Design */}
      {!isMobile && (
      <div className="md:hidden">
        <button
          onClick={() => navigate('/crm/leads/new')}
          className="fixed bottom-24 right-6 w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-[0_8px_30px_rgb(16,185,129,0.4)] z-40 md:hidden active:scale-90 transition-all border border-white/20 backdrop-blur-lg hover:scale-110 group"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="absolute inset-0 rounded-2xl bg-emerald-400 animate-ping opacity-20 group-active:hidden" />
          <Plus className="w-7 h-7 relative z-10" />
        </button>
      </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard isMobile={isMobile} icon={<Users className="w-5 h-5 md:w-6 md:h-6" />} label="Total" value={stats.total} suffix={`(${stats.formatVal(stats.totalValue)})`} color="#3b82f6" trend="Total Pipeline" />
        <StatCard isMobile={isMobile} icon={<Target className="w-5 h-5 md:w-6 md:h-6" />} label="Active" value={stats.active} suffix={`(${stats.formatVal(stats.pipeline)})`} color="#f59e0b" trend="In Progress" />
        <StatCard isMobile={isMobile} icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6" />} label="Won" value={stats.won} suffix={`(${stats.formatVal(stats.wonValue)})`} color="#10b981" trend={`Win Rate: ${stats.conversionRate}%`} />
        <StatCard isMobile={isMobile} icon={<ArrowDownRight className="w-5 h-5 md:w-6 md:h-6" />} label="Lost" value={stats.lost} suffix={`(${stats.formatVal(stats.lostValue)})`} color="#ef4444" trend="Closed Lost" />
      </div>

      {/* Filter transition overlay shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 800px 100%;
          animation: shimmer 1.2s infinite linear;
        }
        .skeleton-shimmer-light {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 800px 100%;
          animation: shimmer 1.2s infinite linear;
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .card-enter {
          animation: fadeSlideUp 0.3s ease-out both;
        }
      `}</style>

      {/* Controls */}
      <div className={`flex flex-col lg:flex-row gap-4 items-stretch lg:items-center ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-4 shadow-sm' : 'bg-white md:bg-white backdrop-blur-xl md:backdrop-blur-none p-3 md:p-5 rounded-3xl border border-border md:border-border shadow-sm md:shadow-sm max-md:bg-[#0d2c18]/40 max-md:border-white/5 max-md:shadow-2xl'}`}>
        <div className="relative flex-1 group">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 transition-colors ${isMobile ? 'text-white/40' : 'text-muted md:text-muted group-focus-within:text-emerald-500 max-md:text-white/20'}`} />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full h-11 md:h-12 rounded-2xl pl-11 md:pl-12 pr-4 text-sm md:text-base outline-none transition-all ${isMobile ? 'bg-[#121f17] border border-transparent text-white placeholder:text-white/30 focus:bg-[#15251c]' : 'bg-white md:bg-white border border-border md:border-border text-primary-text md:text-primary-text placeholder:text-muted md:placeholder:text-muted focus:ring-2 focus:ring-emerald-500/20 max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white max-md:placeholder:text-white/20 max-md:focus:bg-white/[0.08]'}`}
          />
        </div>
        
        <div className="relative">
          <div className={`absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none`}>
            <MapPin className={`w-4 h-4 md:w-5 md:h-5 ${isMobile ? 'text-white/40' : 'text-muted md:text-muted max-md:text-white/20'}`} />
          </div>
          <select
            value={locationFilter}
            onChange={(e) => triggerFilter(() => setLocationFilter(e.target.value))}
            className={`w-full lg:w-40 h-11 md:h-12 rounded-2xl pl-10 pr-8 text-sm md:text-base outline-none appearance-none transition-all cursor-pointer ${isMobile ? 'bg-[#121f17] border border-transparent text-white focus:bg-[#15251c]' : 'bg-white md:bg-white border border-border md:border-border text-primary-text md:text-primary-text focus:ring-2 focus:ring-emerald-500/20 max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white max-md:focus:bg-white/[0.08]'}`}
          >
            <option value="all">All Locations</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
          <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isMobile ? 'text-white/40' : 'text-muted md:text-muted max-md:text-white/20'}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        <div className="relative">
          <div className={`absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none`}>
            <Filter className={`w-4 h-4 md:w-5 md:h-5 ${isMobile ? 'text-white/40' : 'text-muted md:text-muted max-md:text-white/20'}`} />
          </div>
          <select
            value={quickFilter}
            onChange={(e) => triggerFilter(() => setQuickFilter(e.target.value))}
            className={`w-full lg:w-36 h-11 md:h-12 rounded-2xl pl-10 pr-8 text-sm md:text-base outline-none appearance-none transition-all cursor-pointer ${isMobile ? 'bg-[#121f17] border border-transparent text-white focus:bg-[#15251c]' : 'bg-white md:bg-white border border-border md:border-border text-primary-text md:text-primary-text focus:ring-2 focus:ring-emerald-500/20 max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white max-md:focus:bg-white/[0.08]'}`}
          >
            <option value="all">All Leads</option>
            <option value="stagnant">Stagnant</option>
            <option value="urgent">Urgent</option>
          </select>
          <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isMobile ? 'text-white/40' : 'text-muted md:text-muted max-md:text-white/20'}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        <div className="relative">
          <div className={`absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none`}>
            <Calendar className={`w-4 h-4 md:w-5 md:h-5 ${isMobile ? 'text-white/40' : 'text-muted md:text-muted max-md:text-white/20'}`} />
          </div>
          <select
            value={sortBy}
            onChange={(e) => triggerFilter(() => setSortBy(e.target.value))}
            className={`w-full lg:w-40 h-11 md:h-12 rounded-2xl pl-10 pr-8 text-sm md:text-base outline-none appearance-none transition-all cursor-pointer ${isMobile ? 'bg-[#121f17] border border-transparent text-white focus:bg-[#15251c]' : 'bg-white md:bg-white border border-border md:border-border text-primary-text md:text-primary-text focus:ring-2 focus:ring-emerald-500/20 max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white max-md:focus:bg-white/[0.08]'}`}
          >
            <option value="created_desc">Creation Date (Newest)</option>
            <option value="created_asc">Creation Date (Oldest)</option>
            <option value="activity_desc">Last Activity (Newest)</option>
            <option value="activity_asc">Last Activity (Oldest)</option>
            <option value="value_desc">Deal Value (High-Low)</option>
            <option value="value_asc">Deal Value (Low-High)</option>
          </select>
          <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isMobile ? 'text-white/40' : 'text-muted md:text-muted max-md:text-white/20'}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className={`flex p-1 rounded-2xl border ${isMobile ? 'bg-[#0a140f] border-transparent' : 'bg-page md:bg-page border-border md:border-border max-md:bg-white/[0.05] max-md:border-white/5'}`}>
            <button
              onClick={() => triggerFilter(() => setKanbanFilter('all'))}
              className={`px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${kanbanFilter === 'all' ? (isMobile ? 'bg-[#00a859] text-white shadow-lg' : 'bg-emerald-500 text-white md:bg-accent md:text-white shadow-lg shadow-emerald-500/20') : (isMobile ? 'text-white/40 hover:text-white' : 'text-muted md:text-muted hover:text-primary-text md:hover:text-primary-text max-md:text-white/40')}`}
            >
              All
            </button>
            <button
              onClick={() => triggerFilter(() => setKanbanFilter('mine'))}
              className={`px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${kanbanFilter === 'mine' ? (isMobile ? 'bg-[#00a859] text-white shadow-lg' : 'bg-emerald-500 text-white md:bg-accent md:text-white shadow-lg shadow-emerald-500/20') : (isMobile ? 'text-white/40 hover:text-white' : 'text-muted md:text-muted hover:text-primary-text md:hover:text-primary-text max-md:text-white/40')}`}
            >
              Mine
            </button>
          </div>
          <div className={`flex p-1 rounded-2xl border ${isMobile ? 'bg-[#0a140f] border-transparent' : 'bg-white/[0.05] border-white/5 md:bg-page md:border-border'}`}>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'kanban' ? (isMobile ? 'bg-[#00a859] text-white shadow-lg' : 'bg-emerald-500 text-white md:bg-accent md:text-white shadow-lg shadow-emerald-500/20') : (isMobile ? 'text-white/40 hover:text-white' : 'text-muted md:text-muted hover:text-primary-text md:hover:text-primary-text max-md:text-white/40')}`}
              title="Kanban View"
            >
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'table' ? (isMobile ? 'bg-[#00a859] text-white shadow-lg' : 'bg-emerald-500 text-white md:bg-accent md:text-white shadow-lg shadow-emerald-500/20') : (isMobile ? 'text-white/40 hover:text-white' : 'text-muted md:text-muted hover:text-primary-text md:hover:text-primary-text max-md:text-white/40')}`}
              title="List View"
            >
              <Users className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          <button
            onClick={() => setShowClosedLeads(!showClosedLeads)}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all ${showClosedLeads ? (isMobile ? 'bg-[#00a859]/20 border-[#00a859] text-[#00a859]' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400') : (isMobile ? 'bg-[#0a140f] border-transparent text-white/40 hover:text-white' : 'bg-white/[0.05] border-white/5 md:bg-page md:border-border text-muted md:text-muted hover:text-primary-text max-md:text-white/40')}`}
            title={showClosedLeads ? "Hide Closed Leads" : "Show Closed Leads"}
          >
            {showClosedLeads ? <Eye className="w-4 h-4 md:w-5 md:h-5" /> : <EyeOff className="w-4 h-4 md:w-5 md:h-5" />}
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest hidden md:block">{showClosedLeads ? 'Hide Closed' : 'Show Closed'}</span>
          </button>
          <button
            onClick={() => setIsCompact(!isCompact)}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all ${isCompact ? (isMobile ? 'bg-[#00a859]/20 border-[#00a859] text-[#00a859]' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400') : (isMobile ? 'bg-[#0a140f] border-transparent text-white/40 hover:text-white' : 'bg-white/[0.05] border-white/5 md:bg-page md:border-border text-muted md:text-muted hover:text-primary-text max-md:text-white/40')}`}
            title={isCompact ? "Detailed View" : "Compact View"}
          >
            <Layers className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest hidden md:block">{isCompact ? 'Detailed' : 'Compact'}</span>
          </button>
          <button
            onClick={() => navigate('/crm/bd-report')}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all ${isMobile ? 'bg-[#00a859]/20 border-[#00a859] text-[#00a859]' : 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600'}`}
            title="Submit BD Daily Report"
          >
            <Send className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest hidden md:block">BD Report</span>
          </button>
          
          {['admin', 'super_admin', 'superadmin'].includes(user?.role || '') && (
            <button
              onClick={handleAutoAssign}
              disabled={isAssigning}
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all ${isAssigning ? 'opacity-50 cursor-not-allowed' : ''} ${isMobile ? 'bg-[#00a859]/20 border-[#00a859] text-[#00a859]' : 'bg-accent/10 border-accent/20 text-accent hover:bg-accent/20 hover:border-accent/40'}`}
              title="Retroactively Auto-Assign Leads"
            >
              {isAssigning ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Wand2 className="w-4 h-4 md:w-5 md:h-5" />}
              <span className="text-[10px] md:text-xs font-black uppercase tracking-widest hidden md:block">{isAssigning ? 'Assigning...' : 'Auto-Assign'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted animate-pulse">Synchronizing pipeline data...</p>
        </div>
      )}

      {/* Kanban Board */}
      {!isLoading && viewMode === 'kanban' && (
        <div className="relative group/kanban">
          {/* Left Arrow */}
          {canScrollLeft && !isFiltering && (
            <button
              onClick={() => scrollKanban('left')}
              className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white border border-border shadow-2xl items-center justify-center text-primary-text hover:bg-accent hover:text-white hover:border-accent transition-all opacity-80 hover:opacity-100 hover:scale-110"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {/* Right Arrow */}
          {canScrollRight && !isFiltering && (
            <button
              onClick={() => scrollKanban('right')}
              className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white border border-border shadow-2xl items-center justify-center text-primary-text hover:bg-accent hover:text-white hover:border-accent transition-all opacity-80 hover:opacity-100 hover:scale-110"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
          <div
            ref={kanbanScrollRef}
            onScroll={updateScrollButtons}
            className="overflow-x-auto pb-8 -mx-4 px-4 custom-scrollbar snap-x snap-mandatory scroll-smooth max-w-[calc(100vw-2rem)] md:max-w-full"
          >
            {/* Skeleton shimmer while filtering */}
            {isFiltering ? (
              <div className="flex gap-4 md:gap-5 w-max px-2 md:px-0">
                {LEAD_STATUS_ORDER
                  .filter(status => showClosedLeads || !['Won', 'Lost'].includes(status))
                  .map((status, colIdx) => (
                    <div key={status} className="w-[85vw] md:w-[280px] lg:w-[300px] flex-shrink-0 flex flex-col" style={{ animationDelay: `${colIdx * 40}ms` }}>
                      {/* Column header skeleton */}
                      <div className="flex items-center justify-between mb-5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEAD_STATUS_COLORS[status], opacity: 0.4 }} />
                          <div className={`h-3 w-20 rounded-full ${isMobile ? 'skeleton-shimmer' : 'skeleton-shimmer-light'}`} />
                        </div>
                        <div className={`h-5 w-8 rounded-lg ${isMobile ? 'skeleton-shimmer' : 'skeleton-shimmer-light'}`} />
                      </div>
                      {/* Card skeletons */}
                      <div className={`flex-1 space-y-4 h-[calc(100vh-280px)] overflow-hidden p-2 rounded-3xl md:rounded-2xl ${isMobile ? 'bg-transparent' : 'bg-white/[0.02] md:bg-page/30 border border-dashed border-white/5 md:border-border/60'}`}>
                        {[1, 2, 3].map((i) => (
                          <div key={i} className={`rounded-[2rem] md:rounded-2xl p-5 ${isMobile ? 'bg-[#182a20] border border-[#2a4536]' : 'bg-white/[0.03] md:bg-white border border-white/5 md:border-border'}`}>
                            <div className={`h-4 w-3/4 rounded-full mb-3 ${isMobile ? 'skeleton-shimmer' : 'skeleton-shimmer-light'}`} />
                            <div className={`h-3 w-1/2 rounded-full mb-4 ${isMobile ? 'skeleton-shimmer' : 'skeleton-shimmer-light'}`} />
                            <div className="flex gap-2 mb-4">
                              <div className={`h-5 w-16 rounded-lg ${isMobile ? 'skeleton-shimmer' : 'skeleton-shimmer-light'}`} />
                              <div className={`h-5 w-12 rounded-lg ${isMobile ? 'skeleton-shimmer' : 'skeleton-shimmer-light'}`} />
                            </div>
                            <div className={`h-3 w-1/3 rounded-full ${isMobile ? 'skeleton-shimmer' : 'skeleton-shimmer-light'}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex gap-4 md:gap-5 w-max px-2 md:px-0">
                {LEAD_STATUS_ORDER
                  .filter(status => showClosedLeads || !['Won', 'Lost'].includes(status))
                  .map(status => (
                  <div key={status} className="snap-center">
                    <KanbanColumn
                      status={status}
                      leads={kanbanColumns[status] || []}
                      color={LEAD_STATUS_COLORS[status]}
                      onCardClick={(id) => navigate(`/crm/leads/${id}`)}
                      onDeleteClick={async (id) => {
                        if (window.confirm('Are you sure you want to delete this lead?')) {
                          await deleteLead(id);
                        }
                      }}
                      isMobile={isMobile}
                      isCompact={isCompact}
                      canDelete={['admin', 'super_admin', 'superadmin'].includes(user?.role || '')}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table View */}
      {!isLoading && viewMode === 'table' && (
        <div className="bg-white md:bg-white rounded-[2.5rem] md:rounded-3xl border border-border md:border-border overflow-hidden shadow-sm md:shadow-sm max-md:bg-[#0d2c18]/40 max-md:border-white/5 max-md:shadow-2xl pb-4">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border md:border-border bg-page md:bg-page max-md:bg-white/5 max-md:border-white/5">
                  <th className="text-left px-4 md:px-6 py-5 font-black text-muted md:text-muted uppercase tracking-widest text-[10px] max-md:text-white/40">Lead Entity</th>
                  <th className="hidden md:table-cell text-left px-6 py-5 font-black text-muted md:text-muted uppercase tracking-widest text-[10px]">Details</th>
                  <th className="text-left px-4 md:px-6 py-5 font-black text-muted md:text-muted uppercase tracking-widest text-[10px] max-md:text-white/40">Status</th>
                  <th className="text-left px-4 md:px-6 py-5 font-black text-white/40 uppercase tracking-widest text-[10px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border md:divide-border max-md:divide-white/5">
                {isFiltering
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} style={{ animationDelay: `${i * 40}ms` }}>
                      <td className="px-4 md:px-6 py-5">
                        <div className={`h-4 w-32 rounded-full mb-2 ${isMobile ? 'skeleton-shimmer' : 'skeleton-shimmer-light'}`} />
                        <div className={`h-3 w-20 rounded-full ${isMobile ? 'skeleton-shimmer' : 'skeleton-shimmer-light'}`} />
                      </td>
                      <td className="hidden md:table-cell px-6 py-5">
                        <div className={`h-3 w-24 rounded-full mb-2 skeleton-shimmer-light`} />
                        <div className={`h-3 w-16 rounded-full skeleton-shimmer-light`} />
                      </td>
                      <td className="px-4 md:px-6 py-5">
                        <div className={`h-5 w-16 rounded-lg ${isMobile ? 'skeleton-shimmer' : 'skeleton-shimmer-light'}`} />
                      </td>
                      <td className="px-4 md:px-6 py-5">
                        <div className={`h-8 w-8 rounded-full ${isMobile ? 'skeleton-shimmer' : 'skeleton-shimmer-light'}`} />
                      </td>
                    </tr>
                  ))
                  : filteredLeads.map((lead, rowIdx) => (
                  <tr 
                    key={lead.id}
                    className="hover:bg-accent/[0.02] md:hover:bg-accent/[0.02] cursor-pointer transition-colors group max-md:hover:bg-white/[0.02] card-enter"
                    style={{ animationDelay: `${Math.min(rowIdx * 30, 300)}ms` }}
                    onClick={() => navigate(`/crm/leads/${lead.id}`)}
                  >
                    <td className="px-4 md:px-6 py-5">
                      <div className="font-black text-primary-text md:text-primary-text group-hover:text-accent md:group-hover:text-accent transition-colors leading-none max-md:text-white max-md:group-hover:text-emerald-400 flex items-center gap-2">
                        {lead.clientName}
                        <div className="hidden group-hover:flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/leads/${lead.id}`);
                            }}
                            className="p-1 text-muted hover:text-accent transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {['admin', 'super_admin', 'superadmin'].includes(user?.role || '') && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm('Delete this lead?')) {
                                  await deleteLead(lead.id);
                                }
                              }}
                              className="p-1 text-muted hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {lead.associationName && <div className="text-[10px] text-muted md:text-muted font-bold mt-1.5 uppercase tracking-wider truncate max-w-[150px] md:max-w-xs max-md:text-white/30">{lead.associationName}</div>}
                    </td>
                    <td className="hidden md:table-cell px-6 py-5">
                      <div className="text-[11px] text-primary-text md:text-primary-text font-bold max-md:text-white/60">{lead.propertyType || '-'}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted md:text-muted font-semibold mt-1 max-md:text-white/30">
                        <MapPin className="w-3 h-3" />
                        {lead.city || '-'}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-5">
                      <span
                        className="px-2.5 py-1 rounded-lg text-[9px] font-black text-white uppercase tracking-tighter shadow-lg"
                        style={{ backgroundColor: LEAD_STATUS_COLORS[lead.status] }}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-page md:bg-page group-hover:bg-accent md:group-hover:bg-accent group-hover:text-white md:group-hover:text-white transition-all max-md:bg-white/5 max-md:group-hover:bg-emerald-500 max-md:group-hover:text-[#041b0f]">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </td>
                  </tr>
                ))}
                {!isFiltering && filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-20">
                      <div className="flex flex-col items-center card-enter">
                        <div className="w-16 h-16 bg-white/[0.05] md:bg-page rounded-full flex items-center justify-center mb-4 border border-white/5 md:border-border">
                          <Search className="w-8 h-8 text-white/10 md:text-muted/30" />
                        </div>
                        <p className="text-lg font-black md:font-bold text-white md:text-primary-text">No leads found</p>
                        <p className="text-[10px] md:text-sm text-white/30 md:text-muted font-bold md:font-medium uppercase md:capitalize tracking-widest md:tracking-normal mt-2 md:mt-1">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number; color: string; suffix?: string; trend?: string, isMobile?: boolean }> = ({ icon, label, value, color, suffix, trend, isMobile }) => {
  const animatedValue = useAnimatedCounter(value);
  return (
  <div className={`relative overflow-hidden group hover:shadow-lg transition-all duration-300 ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-4' : 'bg-white md:bg-white rounded-3xl border border-border md:border-border p-4 md:p-5 shadow-sm md:shadow-sm max-md:bg-white/[0.03] max-md:backdrop-blur-xl max-md:border-white/5 max-md:shadow-2xl'}`}>
    <div className={`absolute top-0 right-0 p-3 transition-opacity ${isMobile ? 'opacity-5 group-hover:opacity-10' : 'opacity-[0.05] md:opacity-[0.05] group-hover:opacity-[0.08] max-md:opacity-[0.03]'}`}>
      {React.cloneElement(icon as React.ReactElement, { className: 'w-16 h-16 md:w-20 md:h-20' })}
    </div>
    <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${color}15` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className={`text-[9px] md:text-xs font-black md:font-bold uppercase tracking-widest truncate ${isMobile ? 'text-white/60' : 'text-muted md:text-muted max-md:text-white/40'}`}>{label}</p>
        <p className={`text-lg md:text-2xl font-black mt-0.5 tabular-nums ${isMobile ? 'text-white' : 'text-primary-text md:text-primary-text max-md:text-white'}`}>
          {animatedValue}
          {suffix && <span className={`text-[10px] md:text-sm font-bold ml-1 md:ml-1.5 ${isMobile ? 'text-white/40' : 'text-muted md:text-muted max-md:text-white/30'}`}>{suffix}</span>}
        </p>
      </div>
    </div>
    {trend && (
      <div className="flex items-center gap-1.5">
        <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: color }} />
        <p className={`text-[8px] md:text-[10px] font-black md:font-bold uppercase tracking-tighter ${isMobile ? 'text-white/40' : 'text-muted md:text-muted max-md:text-white/20'}`}>{trend}</p>
      </div>
    )}
  </div>
  );
};

interface KanbanColumnProps {
  status: LeadStatus;
  leads: CrmLead[];
  color: string;
  onCardClick: (id: string) => void;
  onDeleteClick: (id: string) => void;
  isMobile?: boolean;
  isCompact?: boolean;
  canDelete?: boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ status, leads, color, onCardClick, onDeleteClick, isMobile, isCompact, canDelete }) => {
  const getAgeingColor = (lead: CrmLead) => {
    const dateString = lead.stageUpdatedAt || lead.createdAt;
    if (!dateString) return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    if (days > 14) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (days > 7) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  };
  
  const getAgeingText = (lead: CrmLead) => {
    const dateString = lead.stageUpdatedAt || lead.createdAt;
    if (!dateString) return 'Unknown';
    const days = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24)));
    if (days === 0) return '< 1d in stage';
    return `${days}d in stage`;
  };

  const getAgeingDays = (lead: CrmLead) => {
    const dateString = lead.stageUpdatedAt || lead.createdAt;
    if (!dateString) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24)));
  };

  const averageDays = React.useMemo(() => {
    if (leads.length === 0) return 0;
    const totalDays = leads.reduce((acc, lead) => acc + Math.max(0, getAgeingDays(lead)), 0);
    return Math.round(totalDays / leads.length);
  }, [leads]);

  return (
  <div className="w-[85vw] md:w-[280px] lg:w-[300px] flex-shrink-0 flex flex-col">
    <div className="flex flex-col mb-5 px-3 gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full ring-4 ring-offset-2" style={{ backgroundColor: color, '--tw-ring-color': `${color}15` } as any} />
          <h3 className={`text-[10px] md:text-xs font-black uppercase tracking-widest md:tracking-tighter ${isMobile ? 'text-white' : 'text-primary-text md:text-primary-text max-md:text-white/40'}`}>{status}</h3>
        </div>
        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg md:rounded-full border shadow-sm ${isMobile ? 'bg-[#182a20] border-[#2a4536] text-white/60' : 'border-border md:border-border bg-white md:bg-white text-primary-text md:text-primary-text max-md:bg-white/5 max-md:border-white/5 max-md:text-white'}`} style={{ color: window.innerWidth >= 768 ? color : undefined }}>
          {leads.length}
        </span>
      </div>
      {leads.length > 0 && (
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted/80 uppercase tracking-widest pl-[22px]">
          <Clock className="w-3 h-3 opacity-50" />
          <span>Avg. {averageDays === 0 ? '< 1 day' : `${averageDays} days`} in stage</span>
        </div>
      )}
    </div>
    <div className={`flex-1 space-y-4 h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar p-2 rounded-3xl md:rounded-2xl ${isMobile ? 'bg-transparent' : 'bg-white/[0.02] md:bg-page/30 border border-dashed border-white/5 md:border-border/60'}`}>
      {leads.map((lead, cardIdx) => {
        const isOverdue = lead.nextFollowupDate && new Date(lead.nextFollowupDate).getTime() < Date.now() && !['Won', 'Lost'].includes(lead.status);
        
        return (
        <div
          key={lead.id}
          onClick={() => onCardClick(lead.id)}
          className={`cursor-pointer group relative overflow-hidden transition-all duration-300 card-enter ${isCompact ? 'p-3 rounded-2xl' : 'p-5 rounded-[2rem] md:rounded-2xl'} ${isMobile ? 'bg-[#182a20] border border-[#2a4536] hover:bg-[#1a2e23]' : 'bg-white/[0.03] md:bg-white backdrop-blur-xl md:backdrop-blur-none border border-white/5 md:border-border hover:bg-white/[0.05] md:hover:bg-slate-50 md:hover:shadow-xl hover:border-emerald-500/40 md:hover:border-accent/40 hover:-translate-y-1'}`}
          style={{ animationDelay: `${Math.min(cardIdx * 40, 400)}ms` }}
        >
          <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: color }} />
          
          <div className="flex items-start justify-between mb-3">
            <h4 className={`text-sm font-black leading-tight line-clamp-2 uppercase tracking-tight md:tracking-normal transition-colors ${isMobile ? 'text-white group-hover:text-white/80' : 'text-white md:text-primary-text group-hover:text-emerald-400 md:group-hover:text-accent'}`}>
              {lead.clientName}
            </h4>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCardClick(lead.id);
                }}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all group/icon ${isMobile ? 'bg-[#2a4b3d] border-none text-[#4ea8e9] hover:bg-[#345c4b]' : 'bg-white/10 md:bg-gray-100 border border-white/10 md:border-border text-white md:text-primary-text hover:bg-emerald-500 hover:text-white md:hover:text-white'}`}
                title="Edit Lead"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteClick(lead.id);
                  }}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all group/icon ${isMobile ? 'bg-[#4b2a2a] border-none text-[#e94e4e] hover:bg-[#5c3434]' : 'bg-white/10 md:bg-red-50 border border-white/10 md:border-red-100 text-red-400 hover:bg-red-500 hover:text-white'}`}
                  title="Delete Lead"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {!isCompact && lead.associationName && (
            <div className={`flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold mb-4 uppercase tracking-wider md:tracking-normal ${isMobile ? 'text-white/40' : 'text-white/30 md:text-muted'}`}>
              <Building2 className="w-3.5 h-3.5 opacity-50" />
              <span className="truncate">{lead.associationName}</span>
            </div>
          )}

          {!isCompact && (lead.propertyType || lead.source || lead.dealValue) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {lead.propertyType && (
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest md:tracking-wider ${isMobile ? 'bg-[#2a4536] text-[#69ab82]' : 'bg-white/[0.05] md:bg-slate-100 text-white/60 md:text-slate-700 border border-white/5 md:border-transparent'}`}>
                  {lead.propertyType}
                </span>
              )}
              {lead.source && (
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest md:tracking-wider ${isMobile ? 'bg-[#183a27] text-[#4ea8e9]' : 'bg-emerald-500/10 md:bg-emerald-50 text-emerald-400 md:text-emerald-700 border border-emerald-500/10 md:border-transparent'}`}>
                  {lead.source}
                </span>
              )}
              {lead.dealValue && (
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest md:tracking-wider ${isMobile ? 'bg-[#2a4536] text-[#69ab82]' : 'bg-white/[0.05] md:bg-slate-100 text-white/60 md:text-slate-700 border border-white/5 md:border-transparent'}`}>
                  ₹{lead.dealValue.toLocaleString()}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <span className={`px-2 py-1 rounded border text-[9px] font-bold flex items-center gap-1 ${getAgeingColor(lead)}`}>
              {getAgeingDays(lead) > 7 && <Clock className="w-3 h-3" />}
              {getAgeingText(lead)}
            </span>
            {lead.nextFollowupDate && !['Won', 'Lost'].includes(lead.status) && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-bold ${isOverdue ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                <Calendar className="w-3 h-3" />
                <span>Next: {new Date(lead.nextFollowupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                {isOverdue && <span className="ml-1 uppercase">(Overdue)</span>}
              </div>
            )}
          </div>

          {(lead.city || lead.unitCount) && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {lead.city && (
                <div className={`flex items-center gap-1.5 text-[10px] font-black md:font-bold uppercase tracking-tighter md:tracking-normal ${isMobile ? 'text-white/50' : 'text-white/40 md:text-muted'}`}>
                  <MapPin className="w-3.5 h-3.5 opacity-40" />
                  <span className="truncate">{lead.city}</span>
                </div>
              )}
              {lead.unitCount && (
                <div className={`flex items-center gap-1.5 text-[10px] font-black md:font-bold uppercase tracking-tighter md:tracking-normal ${isMobile ? 'text-white/50' : 'text-white/40 md:text-muted'}`}>
                  <Building2 className="w-3.5 h-3.5 opacity-40" />
                  <span>{lead.unitCount} Units</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-white/5 md:border-border mt-auto">
            <div className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${isMobile ? 'text-white/60' : 'text-muted md:text-muted'}`}>
              {new Date(lead.createdAt).toLocaleDateString('en-GB')}
            </div>
            {lead.assignedToName ? (
              <div className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${isMobile ? 'bg-[#183a27] border-[#2a4b3d] text-[#4ea8e9]' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 md:bg-gray-50 md:border-border'}`}>
                {lead.assignedToName.split(' ')[0]}
              </div>
            ) : (
              <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${isMobile ? 'bg-[#4b2a2a] border-none text-[#e94e4e]' : 'bg-red-50 border-red-100 text-red-500'}`}>
                Unassigned
              </div>
            )}
          </div>
        </div>
        );
      })}
    </div>
  </div>
  );
};

export default CrmDashboard;
