import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrmApi } from '../../services/hrm.api';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import StageBadge from '../../components/hr/StageBadge';
import Button from '../../components/ui/Button';
import {
  Phone, Users, UserPlus, Search, RefreshCw, AlertTriangle, CheckSquare, Square, UserCheck, Calendar, Clock,
  Target, TrendingUp, ChevronRight, Flame
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface Candidate {
  id: string;
  candidateName: string;
  candidateMobile: string;
  candidateRole: string;
  currentStage: string;
  referrerName: string;
  createdAt: string;
  assignedHrId?: string;
  isOverdue: boolean;
  lastCall?: {
    outcome: string;
    calledAt: string;
    nextCallAt?: string;
  } | null;
}

interface HRUser {
  id: string;
  name: string;
  role_id: string;
}

const HRCallQueue: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [hrUsers, setHrUsers] = useState<HRUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'mine' | 'all' | 'overdue' | 'today'>('mine');
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [assigning, setAssigning] = useState<boolean>(false);

  const fetchHRUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role_id')
        .in('role_id', ['admin', 'hr', 'super_admin', 'developer', 'management', 'hr_ops'])
        .order('name');
      if (error) throw error;
      setHrUsers(data as any[] || []);
    } catch (error) {
      console.error('Failed to fetch HR users:', error);
    }
  };

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await hrmApi.getQueue({
        status: filterType
      });
      setCandidates(data || []);
      setSelectedIds([]);
    } catch (error: any) {
      console.error('Failed to fetch queue:', error);
      toast.error('Failed to load candidate queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHRUsers();
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [filterType]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchQueue(), fetchHRUsers()]);
    setRefreshing(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCandidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCandidates.map((c) => c.id));
    }
  };

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one candidate');
      return;
    }
    if (!assigneeId) {
      toast.error('Please select an HR manager to assign to');
      return;
    }

    setAssigning(true);
    try {
      await hrmApi.assignHr(selectedIds, assigneeId);
      toast.success(`Assigned ${selectedIds.length} candidate(s) successfully`);
      setSelectedIds([]);
      fetchQueue();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed bulk assignment');
    } finally {
      setAssigning(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.candidateName?.toLowerCase().includes(term) ||
      c.candidateRole?.toLowerCase().includes(term) ||
      c.referrerName?.toLowerCase().includes(term) ||
      c.candidateMobile?.includes(term)
    );
  });

  const overdueCount = candidates.filter((c) => c.isOverdue).length;
  const totalCount = candidates.length;
  const todayCount = candidates.filter(c => {
    const todayStr = new Date().toISOString().split('T')[0];
    const createdStr = new Date(c.createdAt).toISOString().split('T')[0];
    return createdStr === todayStr;
  }).length;

  const reminders = candidates.filter((c) => {
    return c.lastCall?.nextCallAt && new Date(c.lastCall.nextCallAt) <= new Date() && c.currentStage !== 'joined' && c.currentStage !== 'rejected';
  });

  return (
    <div className={`animate-fade-in min-w-0 overflow-x-hidden min-h-screen ${isMobile ? 'bg-[#091c13] text-white p-4 pt-6 space-y-6 pb-24' : 'space-y-8 pb-32 md:pb-8'}`}>
      {/* Header */}
      <div className={`flex justify-between items-start sm:items-center ${isMobile ? 'flex-col gap-4' : 'flex-col sm:flex-row gap-6'}`}>
        <div className="w-full sm:w-auto">
          <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl text-white' : 'text-xl md:text-2xl text-primary-text'}`}>HR Call Queue</h1>
          <p className={`mt-1 text-xs md:text-sm leading-relaxed ${isMobile ? 'text-white/60' : 'text-muted'}`}>Manage recruitment pipeline & SLA follow-ups</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`flex items-center gap-2 transition-all active:scale-95 ${isMobile ? 'bg-[#006b3f] text-white px-5 py-2.5 rounded-full font-bold shadow-lg shadow-[#006b3f]/20 self-start' : 'btn btn-primary btn-md shadow-xl shadow-accent/20 hover:shadow-accent/40'}`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard isMobile={isMobile} icon={<Users className="w-5 h-5 md:w-6 md:h-6" />} label="Total Queue" value={totalCount} color="#3b82f6" trend="Active Pipeline" />
        <StatCard isMobile={isMobile} icon={<Flame className="w-5 h-5 md:w-6 md:h-6" />} label="Overdue" value={overdueCount} color="#ef4444" trend=">48h SLA" />
        <StatCard isMobile={isMobile} icon={<Target className="w-5 h-5 md:w-6 md:h-6" />} label="Today" value={todayCount} color="#f59e0b" trend="Scheduled" />
        <StatCard isMobile={isMobile} icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6" />} label="Selected" value={selectedIds.length} color="#10b981" trend="For Assign" />
      </div>

      {/* Reminders Alert Banner */}
      {reminders.length > 0 && (
        <div className={`p-5 rounded-3xl border transition-all ${isMobile ? 'bg-[#182a20] border-[#2a4536] space-y-4' : 'bg-amber-50 border-amber-200 shadow-sm space-y-4'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isMobile ? 'bg-amber-500/20' : 'bg-amber-500/10'}`}>
              <Clock className={`w-5 h-5 ${isMobile ? 'text-amber-400' : 'text-amber-600'}`} />
            </div>
            <div>
              <h4 className={`text-sm font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>Pending Callback Reminders</h4>
              <p className={`text-xs ${isMobile ? 'text-white/50' : 'text-muted'}`}>Scheduled recruiter call follow-ups that require immediate action.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reminders.map((cand) => (
              <div
                key={cand.id}
                onClick={() => navigate(`/hrm/candidate/${cand.id}`)}
                className={`p-3.5 rounded-2xl cursor-pointer border transition-all flex justify-between items-center group ${isMobile ? 'bg-[#121f17] border-[#2a4536] hover:bg-[#15251c]' : 'bg-white border-border hover:shadow-md hover:border-amber-300'}`}
              >
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate group-hover:text-emerald-500 transition-colors ${isMobile ? 'text-white' : 'text-primary-text'}`}>{cand.candidateName}</p>
                  <p className={`text-[10px] uppercase font-bold tracking-widest mt-0.5 ${isMobile ? 'text-white/40' : 'text-muted'}`}>{cand.candidateRole}</p>
                  <p className={`text-[9px] font-mono mt-1 ${isMobile ? 'text-amber-400/80' : 'text-amber-600 font-bold'}`}>
                    Due: {new Date(cand.lastCall!.nextCallAt!).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${isMobile ? 'bg-white/5 group-hover:bg-emerald-500 text-white/30 group-hover:text-white' : 'bg-slate-50 group-hover:bg-emerald-500 text-slate-400 group-hover:text-white'}`}>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className={`flex flex-col lg:flex-row gap-4 items-stretch lg:items-center ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-4 shadow-sm' : 'bg-white md:bg-white backdrop-blur-xl md:backdrop-blur-none p-3 md:p-5 rounded-3xl border border-border md:border-border shadow-sm md:shadow-sm max-md:bg-[#0d2c18]/40 max-md:border-white/5 max-md:shadow-2xl'}`}>
        <div className="relative flex-1 group">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 transition-colors ${isMobile ? 'text-white/40' : 'text-muted group-focus-within:text-emerald-500 max-md:text-white/20'}`} />
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full h-11 md:h-12 rounded-2xl pl-11 md:pl-12 pr-4 text-sm md:text-base outline-none transition-all ${isMobile ? 'bg-[#121f17] border border-transparent text-white placeholder:text-white/30 focus:bg-[#15251c]' : 'bg-white md:bg-white border border-border md:border-border text-primary-text md:text-primary-text placeholder:text-muted md:placeholder:text-muted focus:ring-2 focus:ring-emerald-500/20 max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white max-md:placeholder:text-white/20 max-md:focus:bg-white/[0.08]'}`}
          />
        </div>
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          <div className={`flex p-1 rounded-2xl border ${isMobile ? 'bg-[#0a140f] border-transparent' : 'bg-page border-border md:bg-page md:border-border max-md:bg-white/[0.05] max-md:border-white/5'}`}>
            {[
              { id: 'mine', label: 'My Queue' },
              { id: 'all', label: 'All' },
              { id: 'overdue', label: `Overdue (${overdueCount})` },
              { id: 'today', label: "Today" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id as any)}
                className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterType === tab.id
                    ? (isMobile ? 'bg-[#00a859] text-white shadow-lg' : 'bg-emerald-500 text-white md:bg-accent md:text-white shadow-lg shadow-emerald-500/20')
                    : (isMobile ? 'text-white/40 hover:text-white' : 'text-muted md:text-muted hover:text-primary-text md:hover:text-primary-text max-md:text-white/40')
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Assignment panel */}
      {selectedIds.length > 0 && (
        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center p-5 gap-4 rounded-3xl transition-all animate-fade-in ${isMobile ? 'bg-[#182a20] border border-[#2a4536]' : 'bg-emerald-50/80 border border-emerald-200/60 shadow-sm'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isMobile ? 'bg-emerald-500/20' : 'bg-emerald-500/10'}`}>
              <UserCheck className={`w-5 h-5 ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </div>
            <div>
              <p className={`text-sm font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>
                {selectedIds.length} candidate(s) selected
              </p>
              <p className={`text-xs ${isMobile ? 'text-white/50' : 'text-muted'}`}>Assign selected to a recruiter</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={`h-11 px-3 rounded-2xl text-sm outline-none flex-1 md:flex-none ${isMobile ? 'bg-[#121f17] border border-[#2a4536] text-white' : 'bg-white border border-border text-primary-text'}`}
            >
              <option value="">Select Recruiter...</option>
              {hrUsers.map((hr) => (
                <option key={hr.id} value={hr.id}>
                  {hr.name} ({hr.role_id})
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={assigning}
              className="btn btn-primary btn-md gap-2 whitespace-nowrap active:scale-95 transition-all"
            >
              {assigning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Assign
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted animate-pulse">Loading call queue...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredCandidates.length === 0 && (
        <div className={`text-center py-20 rounded-3xl border border-dashed ${isMobile ? 'border-[#2a4536] bg-[#182a20]' : 'border-border bg-white'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed ${isMobile ? 'bg-white/[0.05] border-white/10' : 'bg-page border-border'}`}>
            <Search className={`w-8 h-8 ${isMobile ? 'text-white/10' : 'text-muted/30'}`} />
          </div>
          <p className={`text-lg font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>No candidates in queue</p>
          <p className={`text-sm mt-1 ${isMobile ? 'text-white/30' : 'text-muted'}`}>All follow-ups completed or queue matches filters</p>
        </div>
      )}

      {/* Table View */}
      {!loading && filteredCandidates.length > 0 && (
        <div className={`overflow-hidden ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] shadow-2xl' : 'bg-white rounded-3xl border border-border shadow-sm'} pb-4`}>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isMobile ? 'bg-[#0a140f] border-[#2a4536]' : 'bg-page border-border'}`}>
                  <th className="text-left px-4 md:px-5 py-5 w-12">
                    <button onClick={toggleSelectAll} className={`p-1 rounded-lg transition-colors ${isMobile ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}>
                      {selectedIds.length === filteredCandidates.length ? (
                        <CheckSquare className={`w-4 h-4 ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      ) : (
                        <Square className={`w-4 h-4 ${isMobile ? 'text-white/30' : 'text-muted'}`} />
                      )}
                    </button>
                  </th>
                  <th className={`text-left px-4 md:px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Candidate / Role</th>
                  <th className={`text-left px-4 md:px-5 py-5 font-black uppercase tracking-widest text-[10px] hidden md:table-cell ${isMobile ? 'text-white/40' : 'text-muted'}`}>Referrer</th>
                  <th className={`text-left px-4 md:px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Stage</th>
                  <th className={`text-left px-4 md:px-5 py-5 font-black uppercase tracking-widest text-[10px] hidden lg:table-cell ${isMobile ? 'text-white/40' : 'text-muted'}`}>Last Contact</th>
                  <th className={`text-left px-4 md:px-5 py-5 font-black uppercase tracking-widest text-[10px] hidden lg:table-cell ${isMobile ? 'text-white/40' : 'text-muted'}`}>Timeline</th>
                  <th className={`text-left px-4 md:px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isMobile ? 'divide-[#2a4536]' : 'divide-border'}`}>
                {filteredCandidates.map((cand) => {
                  const isSelected = selectedIds.includes(cand.id);
                  const createdDate = new Date(cand.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short'
                  });

                  return (
                    <tr
                      key={cand.id}
                      onClick={() => navigate(`/hrm/candidate/${cand.id}`)}
                      className={`cursor-pointer transition-colors group ${
                        isMobile
                          ? (isSelected ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]')
                          : (isSelected ? 'bg-emerald-50/30' : 'hover:bg-accent/[0.02]')
                      }`}
                    >
                      <td className="py-5 px-4 md:px-5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleSelect(cand.id)} className="p-1 rounded-lg">
                          {isSelected ? (
                            <CheckSquare className={`w-4 h-4 ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`} />
                          ) : (
                            <Square className={`w-4 h-4 ${isMobile ? 'text-white/30' : 'text-muted'}`} />
                          )}
                        </button>
                      </td>
                      <td className="py-5 px-4 md:px-5">
                        <div className={`font-black leading-tight transition-colors ${isMobile ? 'text-white group-hover:text-emerald-400' : 'text-primary-text group-hover:text-accent'}`}>
                          {cand.candidateName}
                        </div>
                        <div className={`text-[10px] font-bold mt-1.5 uppercase tracking-wider ${isMobile ? 'text-white/30' : 'text-muted'}`}>
                          {cand.candidateRole} · {cand.candidateMobile}
                        </div>
                      </td>
                      <td className="py-5 px-4 md:px-5 hidden md:table-cell">
                        <div className={`text-[11px] font-bold ${isMobile ? 'text-white/60' : 'text-primary-text'}`}>{cand.referrerName}</div>
                        <div className={`flex items-center gap-1.5 text-[10px] font-semibold mt-1 ${isMobile ? 'text-white/30' : 'text-muted'}`}>
                          <Calendar className="w-3 h-3" />
                          {createdDate}
                        </div>
                      </td>
                      <td className="py-5 px-4 md:px-5">
                        <StageBadge stage={cand.currentStage as any} />
                      </td>
                      <td className="py-5 px-4 md:px-5 hidden lg:table-cell">
                        {cand.lastCall ? (
                          <div className="space-y-1">
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm ${isMobile ? 'bg-white/5 text-white/60' : 'bg-slate-100 text-slate-700'}`}>
                              {cand.lastCall.outcome.replace('_', ' ')}
                            </span>
                            <div className={`text-[10px] font-medium ${isMobile ? 'text-white/20' : 'text-muted'}`}>
                              {new Date(cand.lastCall.calledAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short'
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className={`text-xs ${isMobile ? 'text-white/20' : 'text-muted'}`}>No contact yet</span>
                        )}
                      </td>
                      <td className="py-5 px-4 md:px-5 hidden lg:table-cell">
                        {cand.isOverdue ? (
                          <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-xl w-fit ${isMobile ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            SLA OVERDUE
                          </span>
                        ) : cand.lastCall?.nextCallAt ? (
                          <div className={`flex items-center gap-1 text-[10px] font-medium ${isMobile ? 'text-white/40' : 'text-muted'}`}>
                            <Calendar className="w-3 h-3" />
                            Next: {new Date(cand.lastCall.nextCallAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short'
                            })}
                          </div>
                        ) : (
                          <span className={`text-[10px] ${isMobile ? 'text-white/20' : 'text-muted'}`}>Normal</span>
                        )}
                      </td>
                      <td className="py-5 px-4 md:px-5" onClick={(e) => e.stopPropagation()}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isMobile ? 'bg-white/5 group-hover:bg-emerald-500 group-hover:text-white text-white/30' : 'bg-page group-hover:bg-accent group-hover:text-white text-muted'}`}>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Stat Card - Matches CRM design language
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number; color: string; trend?: string; isMobile?: boolean }> = ({ icon, label, value, color, trend, isMobile }) => (
  <div className={`relative overflow-hidden group hover:shadow-lg transition-all duration-300 ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-4' : 'bg-white rounded-3xl border border-border p-4 md:p-5 shadow-sm'}`}>
    <div className={`absolute top-0 right-0 p-3 transition-opacity ${isMobile ? 'opacity-5 group-hover:opacity-10' : 'opacity-[0.05] group-hover:opacity-[0.08]'}`}>
      {React.cloneElement(icon as React.ReactElement, { className: 'w-16 h-16 md:w-20 md:h-20' })}
    </div>
    <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${color}15` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className={`text-[9px] md:text-xs font-black uppercase tracking-widest truncate ${isMobile ? 'text-white/60' : 'text-muted'}`}>{label}</p>
        <p className={`text-lg md:text-2xl font-black mt-0.5 ${isMobile ? 'text-white' : 'text-primary-text'}`}>{value}</p>
      </div>
    </div>
    {trend && (
      <div className="flex items-center gap-1.5">
        <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: color }} />
        <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-tighter ${isMobile ? 'text-white/40' : 'text-muted'}`}>{trend}</p>
      </div>
    )}
  </div>
);

export default HRCallQueue;
