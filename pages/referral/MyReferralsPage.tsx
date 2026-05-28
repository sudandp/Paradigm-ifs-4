import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import StageBadge from '../../components/hr/StageBadge';
import {
  Users, Building, Plus, RefreshCw, Calendar, Phone, Award, DollarSign, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface CandidateReferral {
  id: string;
  candidateName: string;
  candidateMobile: string;
  candidateRole: string;
  currentStage: string;
  createdAt: string;
  bonusEligible: boolean;
  bonusPaidAt?: string;
}

interface BusinessReferral {
  id: string;
  communityName: string;
  contactPersonName: string;
  serviceInterested: string;
  status: string;
  createdAt: string;
}

const MyReferralsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isMobile = useMediaQuery('(max-width: 767px)');
  
  const [candidates, setCandidates] = useState<CandidateReferral[]>([]);
  const [businesses, setBusinesses] = useState<BusinessReferral[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'candidates' | 'business'>('candidates');

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch Candidate Referrals
      const { data: candData, error: candError } = await supabase
        .from('candidate_referrals')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (candError) throw candError;
      setCandidates(candData || []);

      // 2. Fetch Business Referrals
      const { data: busData, error: busError } = await supabase
        .from('business_referrals')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (busError) throw busError;
      setBusinesses(busData || []);
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
      toast.error('Failed to load referrals data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const totalCandidates = candidates.length;
  const joinedCount = candidates.filter(c => c.currentStage === 'joined').length;
  const eligibleBonusCount = candidates.filter(c => c.bonusEligible && !c.bonusPaidAt).length;

  return (
    <div className={`animate-fade-in min-w-0 overflow-x-hidden min-h-screen ${isMobile ? 'bg-[#091c13] text-white p-4 pt-6 space-y-6 pb-24' : 'space-y-8 pb-32 md:pb-8'}`}>
      {/* Page Header */}
      <div className={`flex justify-between items-start sm:items-center ${isMobile ? 'flex-col gap-4' : 'flex-col sm:flex-row gap-6'}`}>
        <div className="w-full sm:w-auto">
          <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl text-white' : 'text-xl md:text-2xl text-primary-text'}`}>My Referrals</h1>
          <p className={`mt-1 text-xs md:text-sm leading-relaxed ${isMobile ? 'text-white/60' : 'text-muted'}`}>Track your submitted candidates, business leads & bonus rewards</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex items-center justify-center gap-2 transition-all active:scale-95 ${isMobile ? 'bg-[#182a20] border border-[#2a4536] text-white px-4 h-11 rounded-2xl text-xs font-bold' : 'btn btn-secondary btn-md shadow-sm'}`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={() => navigate(activeTab === 'candidates' ? '/referral/employee' : '/referral/business')}
            className={`flex items-center justify-center gap-2 transition-all active:scale-95 ${isMobile ? 'bg-[#006b3f] text-white px-5 py-2.5 rounded-full font-bold shadow-lg shadow-[#006b3f]/20 flex-1' : 'btn btn-primary btn-md shadow-xl shadow-accent/20 hover:shadow-accent/40'}`}
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'candidates' ? 'Refer Candidate' : 'Refer Business'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <StatCard
          isMobile={isMobile}
          icon={<Users className="w-5 h-5 md:w-6 md:h-6" />}
          label="Total Submitted"
          value={totalCandidates}
          color="#3b82f6"
          trend="Candidate referrals"
        />
        <StatCard
          isMobile={isMobile}
          icon={<Award className="w-5 h-5 md:w-6 md:h-6" />}
          label="Hired / Joined"
          value={joinedCount}
          color="#10b981"
          trend="Successful hires"
        />
        <StatCard
          isMobile={isMobile}
          icon={<DollarSign className="w-5 h-5 md:w-6 md:h-6" />}
          label="Pending Payouts"
          value={eligibleBonusCount}
          color="#f59e0b"
          trend="Unpaid bonuses"
          suffix=" Pending"
        />
      </div>

      {/* Tabs Menu */}
      <div className={`flex flex-col lg:flex-row gap-4 items-stretch lg:items-center ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-4 shadow-sm' : 'bg-white p-3 rounded-3xl border border-border shadow-sm'}`}>
        <div className={`flex p-1 rounded-2xl border ${isMobile ? 'bg-[#0a140f] border-transparent' : 'bg-page border-border'}`}>
          <button
            onClick={() => setActiveTab('candidates')}
            className={`px-4 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'candidates'
                ? (isMobile ? 'bg-[#00a859] text-white shadow-lg' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20')
                : (isMobile ? 'text-white/40 hover:text-white' : 'text-muted hover:text-primary-text')
            }`}
          >
            Candidates ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab('business')}
            className={`px-4 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'business'
                ? (isMobile ? 'bg-[#00a859] text-white shadow-lg' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20')
                : (isMobile ? 'text-white/40 hover:text-white' : 'text-muted hover:text-primary-text')
            }`}
          >
            Business Leads ({businesses.length})
          </button>
        </div>
      </div>

      {/* Submissions List Container */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted animate-pulse">Fetching your referrals...</p>
        </div>
      ) : activeTab === 'candidates' ? (
        candidates.length === 0 ? (
          <div className={`text-center py-20 rounded-3xl border border-dashed ${isMobile ? 'border-[#2a4536] bg-[#182a20]' : 'border-border bg-white'}`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed ${isMobile ? 'bg-white/[0.05]' : 'bg-page'}`}>
              <Users className={`w-8 h-8 ${isMobile ? 'text-white/20' : 'text-muted/30'}`} />
            </div>
            <p className={`text-lg font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>No candidate referrals yet</p>
            <p className={`text-xs mt-1 uppercase font-mono tracking-wider ${isMobile ? 'text-white/30' : 'text-muted'}`}>Submit your first referral candidate and track progress</p>
          </div>
        ) : (
          <div className={`overflow-hidden ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] shadow-2xl' : 'bg-white rounded-3xl border border-border shadow-sm'} pb-4`}>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isMobile ? 'bg-[#0a140f] border-[#2a4536]' : 'bg-page border-border'}`}>
                    <th className={`text-left px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Candidate / Contact</th>
                    <th className={`text-left px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Target Role</th>
                    <th className={`text-left px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Stage</th>
                    <th className={`text-left px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Submission Date</th>
                    <th className={`text-right px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Referral Bonus</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isMobile ? 'divide-[#2a4536]' : 'divide-border'}`}>
                  {candidates.map((cand) => {
                    const dateStr = new Date(cand.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    });

                    return (
                      <tr key={cand.id} className={`transition-colors group ${isMobile ? 'hover:bg-white/[0.02]' : 'hover:bg-accent/[0.02]'}`}>
                        <td className="py-5 px-5">
                          <div className={`font-black leading-tight ${isMobile ? 'text-white' : 'text-primary-text'}`}>
                            {cand.candidateName}
                          </div>
                          <div className={`text-[10px] font-bold mt-1.5 uppercase tracking-wider ${isMobile ? 'text-white/30' : 'text-muted'}`}>
                            {cand.candidateMobile}
                          </div>
                        </td>
                        <td className="py-5 px-5">
                          <span className={`text-[11px] font-bold uppercase tracking-wider ${isMobile ? 'text-white/70' : 'text-slate-700'}`}>
                            {cand.candidateRole}
                          </span>
                        </td>
                        <td className="py-5 px-5">
                          <StageBadge stage={cand.currentStage as any} />
                        </td>
                        <td className="py-5 px-5">
                          <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${isMobile ? 'text-white/40' : 'text-muted'}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            {dateStr}
                          </div>
                        </td>
                        <td className="py-5 px-5 text-right">
                          {cand.currentStage === 'joined' ? (
                            cand.bonusPaidAt ? (
                              <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${isMobile ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border border-emerald-100 text-emerald-600'}`}>
                                PAID
                              </span>
                            ) : (
                              <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${isMobile ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-amber-50 border border-amber-100 text-amber-600'}`}>
                                PROCESSING
                              </span>
                            )
                          ) : (
                            <span className={`text-xs font-semibold ${isMobile ? 'text-white/20' : 'text-slate-400'}`}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : businesses.length === 0 ? (
        <div className={`text-center py-20 rounded-3xl border border-dashed ${isMobile ? 'border-[#2a4536] bg-[#182a20]' : 'border-border bg-white'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed ${isMobile ? 'bg-white/[0.05]' : 'bg-page'}`}>
            <Building className={`w-8 h-8 ${isMobile ? 'text-white/20' : 'text-muted/30'}`} />
          </div>
          <p className={`text-lg font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>No business referrals yet</p>
          <p className={`text-xs mt-1 uppercase font-mono tracking-wider ${isMobile ? 'text-white/30' : 'text-muted'}`}>Refer a strategic business lead to earn rewards</p>
        </div>
      ) : (
        <div className={`overflow-hidden ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] shadow-2xl' : 'bg-white rounded-3xl border border-border shadow-sm'} pb-4`}>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isMobile ? 'bg-[#0a140f] border-[#2a4536]' : 'bg-page border-border'}`}>
                  <th className={`text-left px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Community Name</th>
                  <th className={`text-left px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Contact Person</th>
                  <th className={`text-left px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Service Interested</th>
                  <th className={`text-left px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Submission Date</th>
                  <th className={`text-right px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isMobile ? 'divide-[#2a4536]' : 'divide-border'}`}>
                {businesses.map((bus) => {
                  const dateStr = new Date(bus.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });

                  return (
                    <tr key={bus.id} className={`transition-colors group ${isMobile ? 'hover:bg-white/[0.02]' : 'hover:bg-accent/[0.02]'}`}>
                      <td className="py-5 px-5">
                        <div className={`font-black leading-tight ${isMobile ? 'text-white' : 'text-primary-text'}`}>
                          {bus.communityName}
                        </div>
                      </td>
                      <td className="py-5 px-5">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${isMobile ? 'text-white/70' : 'text-slate-700'}`}>
                          {bus.contactPersonName}
                        </span>
                      </td>
                      <td className="py-5 px-5 font-semibold text-slate-500 uppercase text-xs">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${isMobile ? 'text-white/50' : 'text-slate-500'}`}>
                          {bus.serviceInterested}
                        </span>
                      </td>
                      <td className="py-5 px-5">
                        <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${isMobile ? 'text-white/40' : 'text-muted'}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {dateStr}
                        </div>
                      </td>
                      <td className="py-5 px-5 text-right">
                        <span className={`inline-flex items-center text-[9px] font-black px-2.5 py-1 rounded-lg border ${
                          bus.status === 'yes'
                            ? (isMobile ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700 border-emerald-100')
                            : (isMobile ? 'bg-slate-500/10 border-slate-500/20 text-slate-400' : 'bg-slate-100 text-slate-500 border-slate-200')
                        }`}>
                          {bus.status === 'yes' ? 'CONVERTED' : 'PENDING'}
                        </span>
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

// Stat Card helper component
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  trend?: string;
  suffix?: string;
  isMobile?: boolean;
}> = ({ icon, label, value, color, trend, suffix = '', isMobile }) => (
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
        <p className={`text-lg md:text-2xl font-black mt-0.5 ${isMobile ? 'text-white' : 'text-primary-text'}`}>
          {value}{suffix}
        </p>
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

export default MyReferralsPage;
