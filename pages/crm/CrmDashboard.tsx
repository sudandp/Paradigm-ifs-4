import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrmStore } from '../../store/crmStore';
import { useAuthStore } from '../../store/authStore';
import type { CrmLead, LeadStatus } from '../../types/crm';
import { LEAD_STATUS_ORDER, LEAD_STATUS_COLORS } from '../../types/crm';
import {
  Plus, Search, Filter, BarChart3, Users, Target, TrendingUp,
  Building2, Phone, Mail, Calendar, ChevronRight, ChevronLeft, Loader2,
  ArrowUpRight, ArrowDownRight, Eye, Clock, MapPin, Edit2, Trash2
} from 'lucide-react';

const CrmDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { leads, isLoading, fetchLeads, searchQuery, setSearchQuery, kanbanFilter, setKanbanFilter, deleteLead } = useCrmStore();
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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

  // Filtered leads
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (kanbanFilter === 'mine' && user) {
      result = result.filter(l => l.assignedTo === user.id);
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
    return result;
  }, [leads, kanbanFilter, searchQuery, user]);

  // Stats
  const stats = useMemo(() => {
    const total = leads.length;
    const active = leads.filter(l => !['Won', 'Lost'].includes(l.status)).length;
    const won = leads.filter(l => l.status === 'Won').length;
    const lost = leads.filter(l => l.status === 'Lost').length;
    const conversionRate = total > 0 ? ((won / total) * 100).toFixed(1) : '0';
    const pipeline = leads
      .filter(l => !['Won', 'Lost'].includes(l.status))
      .reduce((sum, l) => sum + (l.areaSqft || 0), 0);
    return { total, active, won, lost, conversionRate, pipeline };
  }, [leads]);

  // Kanban columns
  const kanbanColumns = useMemo(() => {
    const columns: Record<LeadStatus, CrmLead[]> = {} as any;
    LEAD_STATUS_ORDER.forEach(status => {
      columns[status] = filteredLeads.filter(l => l.status === status);
    });
    return columns;
  }, [filteredLeads]);

  return (
    <div className="space-y-8 animate-fade-in pb-32 md:pb-8 min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl md:text-3xl font-black text-[#0F172A] md:text-primary-text tracking-tight uppercase max-md:text-white">CRM Pipeline</h1>
          <p className="text-[10px] md:text-[11px] text-muted mt-1.5 font-bold uppercase tracking-widest max-md:text-emerald-400/60 leading-relaxed">Streamline leads & accelerate property onboarding</p>
        </div>
        <button
          onClick={() => navigate('/crm/leads/new')}
          className="hidden sm:flex btn btn-primary btn-lg gap-2 shadow-xl shadow-accent/20 hover:shadow-accent/40 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>New Lead</span>
        </button>
      </div>

      {/* Mobile Floating Action Button - Premium Design */}
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

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard icon={<Users className="w-5 h-5 md:w-6 md:h-6" />} label="Total" value={stats.total} color="#3b82f6" trend="+12% month" />
        <StatCard icon={<Target className="w-5 h-5 md:w-6 md:h-6" />} label="Active" value={stats.active} color="#f59e0b" trend="4 in neg" />
        <StatCard icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6" />} label="Won" value={stats.won} color="#10b981" suffix={`(${stats.conversionRate}%)`} trend="Top perf" />
        <StatCard icon={<ArrowDownRight className="w-5 h-5 md:w-6 md:h-6" />} label="Lost" value={stats.lost} color="#ef4444" trend="-5% vs prev" />
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center bg-white md:bg-white backdrop-blur-xl md:backdrop-blur-none p-3 md:p-5 rounded-3xl border border-border md:border-border shadow-sm md:shadow-sm max-md:bg-[#0d2c18]/40 max-md:border-white/5 max-md:shadow-2xl">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted md:text-muted group-focus-within:text-emerald-500 transition-colors max-md:text-white/20" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 md:h-12 bg-white md:bg-white border-border md:border-border rounded-2xl pl-11 md:pl-12 pr-4 text-sm md:text-base text-primary-text md:text-primary-text placeholder:text-muted md:placeholder:text-muted focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white max-md:placeholder:text-white/20 max-md:focus:bg-white/[0.08]"
          />
        </div>
        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className="flex bg-page md:bg-page p-1 rounded-2xl border border-border md:border-border max-md:bg-white/[0.05] max-md:border-white/5">
            <button
              onClick={() => setKanbanFilter('all')}
              className={`px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${kanbanFilter === 'all' ? 'bg-emerald-500 text-white md:bg-accent md:text-white shadow-lg shadow-emerald-500/20' : 'text-muted md:text-muted hover:text-primary-text md:hover:text-primary-text max-md:text-white/40'}`}
            >
              All
            </button>
            <button
              onClick={() => setKanbanFilter('mine')}
              className={`px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${kanbanFilter === 'mine' ? 'bg-emerald-500 text-white md:bg-accent md:text-white shadow-lg shadow-emerald-500/20' : 'text-muted md:text-muted hover:text-primary-text md:hover:text-primary-text max-md:text-white/40'}`}
            >
              Mine
            </button>
          </div>
          <div className="flex bg-white/[0.05] p-1 rounded-2xl border border-white/5 md:bg-page md:border-border">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'kanban' ? 'bg-emerald-500 text-white md:bg-accent md:text-white shadow-lg shadow-emerald-500/20' : 'text-muted md:text-muted hover:text-primary-text md:hover:text-primary-text max-md:text-white/40'}`}
              title="Kanban View"
            >
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'table' ? 'bg-emerald-500 text-white md:bg-accent md:text-white shadow-lg shadow-emerald-500/20' : 'text-muted md:text-muted hover:text-primary-text md:hover:text-primary-text max-md:text-white/40'}`}
              title="List View"
            >
              <Users className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
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
          {canScrollLeft && (
            <button
              onClick={() => scrollKanban('left')}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white border border-border shadow-lg items-center justify-center text-primary-text hover:bg-accent hover:text-white hover:border-accent transition-all opacity-0 group-hover/kanban:opacity-100"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {/* Right Arrow */}
          {canScrollRight && (
            <button
              onClick={() => scrollKanban('right')}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white border border-border shadow-lg items-center justify-center text-primary-text hover:bg-accent hover:text-white hover:border-accent transition-all opacity-0 group-hover/kanban:opacity-100"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          <div
            ref={kanbanScrollRef}
            onScroll={updateScrollButtons}
            className="overflow-x-auto pb-8 -mx-4 px-4 hide-scrollbar snap-x snap-mandatory scroll-smooth max-w-[calc(100vw-2rem)] md:max-w-full"
          >
            <div className="flex gap-4 md:gap-5 w-max px-2 md:px-0">
              {LEAD_STATUS_ORDER.filter(s => s !== 'Onboarding Started').map(status => (
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
                  />
                </div>
              ))}
            </div>
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
                {filteredLeads.map(lead => (
                  <tr 
                    key={lead.id} 
                    className="hover:bg-accent/[0.02] md:hover:bg-accent/[0.02] cursor-pointer transition-colors group max-md:hover:bg-white/[0.02]" 
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
                {filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-20">
                      <div className="flex flex-col items-center">
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

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number; color: string; suffix?: string; trend?: string }> = ({ icon, label, value, color, suffix, trend }) => (
  <div className="bg-white md:bg-white rounded-3xl border border-border md:border-border p-4 md:p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-300 shadow-sm md:shadow-sm max-md:bg-white/[0.03] max-md:backdrop-blur-xl max-md:border-white/5 max-md:shadow-2xl">
    <div className="absolute top-0 right-0 p-3 opacity-[0.05] md:opacity-[0.05] group-hover:opacity-[0.08] transition-opacity max-md:opacity-[0.03]">
      {React.cloneElement(icon as React.ReactElement, { className: 'w-16 h-16 md:w-20 md:h-20' })}
    </div>
    <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${color}15` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] md:text-xs text-muted md:text-muted font-black md:font-bold uppercase tracking-widest truncate max-md:text-white/40">{label}</p>
        <p className="text-lg md:text-2xl font-black text-primary-text md:text-primary-text mt-0.5 max-md:text-white">
          {value}
          {suffix && <span className="text-[10px] md:text-sm font-bold text-muted md:text-muted ml-1 md:ml-1.5 max-md:text-white/30">{suffix}</span>}
        </p>
      </div>
    </div>
    {trend && (
      <div className="flex items-center gap-1.5">
        <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: color }} />
        <p className="text-[8px] md:text-[10px] font-black md:font-bold text-muted md:text-muted uppercase tracking-tighter max-md:text-white/20">{trend}</p>
      </div>
    )}
  </div>
);

interface KanbanColumnProps {
  status: LeadStatus;
  leads: CrmLead[];
  color: string;
  onCardClick: (id: string) => void;
  onDeleteClick: (id: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ status, leads, color, onCardClick, onDeleteClick }) => (
  <div className="w-[85vw] md:w-[280px] lg:w-[300px] flex-shrink-0 flex flex-col">
    <div className="flex items-center justify-between mb-5 px-3">
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full ring-4 ring-offset-2" style={{ backgroundColor: color, '--tw-ring-color': `${color}15` } as any} />
        <h3 className="text-[10px] md:text-xs font-black text-primary-text md:text-primary-text uppercase tracking-widest md:tracking-tighter max-md:text-white/40">{status}</h3>
      </div>
      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg md:rounded-full border border-border md:border-border bg-white md:bg-white text-primary-text md:text-primary-text shadow-sm max-md:bg-white/5 max-md:border-white/5 max-md:text-white" style={{ color: window.innerWidth >= 768 ? color : undefined }}>
        {leads.length}
      </span>
    </div>
    <div className="flex-1 space-y-4 min-h-[500px] md:min-h-[600px] p-2 bg-white/[0.02] md:bg-page/30 rounded-3xl md:rounded-2xl border border-dashed border-white/5 md:border-border/60">
      {leads.map(lead => (
        <div
          key={lead.id}
          onClick={() => onCardClick(lead.id)}
          className="bg-white/[0.03] md:bg-white backdrop-blur-xl md:backdrop-blur-none rounded-[2rem] md:rounded-2xl border border-white/5 md:border-border p-5 cursor-pointer hover:bg-white/[0.05] md:hover:shadow-xl hover:border-emerald-500/40 md:hover:border-accent/40 hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: color }} />
          
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-sm font-black text-white md:text-primary-text group-hover:text-emerald-400 md:group-hover:text-accent transition-colors leading-tight line-clamp-2 uppercase tracking-tight md:tracking-normal">
              {lead.clientName}
            </h4>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCardClick(lead.id);
                }}
                className="w-8 h-8 rounded-xl bg-white/10 md:bg-gray-100 border border-white/10 md:border-border flex items-center justify-center text-white md:text-primary-text hover:bg-emerald-500 hover:text-white md:hover:text-white transition-all group/icon"
                title="Edit Lead"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick(lead.id);
                }}
                className="w-8 h-8 rounded-xl bg-white/10 md:bg-red-50 border border-white/10 md:border-red-100 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all group/icon"
                title="Delete Lead"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {lead.associationName && (
            <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] text-white/30 md:text-muted font-bold mb-4 uppercase tracking-wider md:tracking-normal">
              <Building2 className="w-3.5 h-3.5 opacity-50" />
              <span className="truncate">{lead.associationName}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-5">
            {lead.propertyType && (
              <span className="px-2.5 py-1 rounded-lg text-[9px] font-black bg-white/[0.05] md:bg-slate-100 text-white/60 md:text-slate-700 uppercase tracking-widest md:tracking-wider border border-white/5 md:border-transparent">
                {lead.propertyType}
              </span>
            )}
            {lead.source && (
              <span className="px-2.5 py-1 rounded-lg text-[9px] font-black bg-emerald-500/10 md:bg-emerald-50 text-emerald-400 md:text-emerald-700 uppercase tracking-widest md:tracking-wider border border-emerald-500/10 md:border-transparent">
                {lead.source}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {lead.city && (
              <div className="flex items-center gap-1.5 text-[10px] text-white/40 md:text-muted font-black md:font-bold uppercase tracking-tighter md:tracking-normal">
                <MapPin className="w-3.5 h-3.5 opacity-40" />
                <span className="truncate">{lead.city}</span>
              </div>
            )}
            {lead.unitCount && (
              <div className="flex items-center gap-1.5 text-[10px] text-white/40 md:text-muted font-black md:font-bold uppercase tracking-tighter md:tracking-normal">
                <Building2 className="w-3.5 h-3.5 opacity-40" />
                <span>{lead.unitCount} Units</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5 md:border-border/50 flex items-center justify-between">
            {lead.assignedToName ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg md:rounded-full bg-emerald-500/10 md:bg-accent/10 flex items-center justify-center border border-emerald-500/20 md:border-accent/20">
                  <span className="text-[9px] font-black text-emerald-400 md:text-accent">{lead.assignedToName.charAt(0)}</span>
                </div>
                <span className="text-[10px] text-white/60 md:text-primary-text font-black md:font-bold uppercase md:capitalize tracking-tighter md:tracking-normal">{lead.assignedToName.split(' ')[0]}</span>
              </div>
            ) : (
              <span className="text-[10px] text-white/20 md:text-muted font-black md:font-medium uppercase md:italic tracking-tighter md:tracking-normal">Unassigned</span>
            )}
            <div className="flex items-center gap-1 text-[10px] text-white/20 md:text-muted font-black md:font-bold uppercase md:capitalize tracking-tighter md:tracking-normal">
              <Clock className="w-3 h-3 opacity-40" />
              <span>{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recently'}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default CrmDashboard;
