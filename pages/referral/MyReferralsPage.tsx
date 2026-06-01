import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import StageBadge from '../../components/hr/StageBadge';
import Modal from '../../components/ui/Modal';
import {
  Users, Building, Plus, RefreshCw, Calendar, Phone, Award, DollarSign, ChevronRight,
  Mail, Info, User, ShieldCheck, MapPin, Hash, Landmark, Wallet, Briefcase, Eye, Trash2,
  ArrowLeft, CheckCircle2, Clock
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
  candidateEmail?: string;
  referredPersonRole?: string;
  referrerName?: string;
  referrerMobile?: string;
  referrerRole?: string;
  employeeId?: string;
  siteLocation?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  isParadigmEmployee?: boolean;
}

interface BusinessReferral {
  id: string;
  communityName: string;
  contactPersonName: string;
  serviceInterested: string;
  status: string;
  createdAt: string;
  referrerName?: string;
  referrerMobile?: string;
  referrerRole?: string;
  clientName?: string;
  clientMobile?: string;
  clientEmail?: string;
  clientDesignation?: string;
  communityNature?: string;
  unitsCount?: string;
  remarks?: string;
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
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateReferral | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessReferral | null>(null);

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
      
      const mappedCandidates: CandidateReferral[] = (candData || []).map((cand: any) => ({
        id: cand.id,
        candidateName: cand.candidate_name || '',
        candidateMobile: cand.candidate_mobile || '',
        candidateRole: cand.candidate_role || '',
        currentStage: cand.current_stage || 'new',
        createdAt: cand.created_at || '',
        bonusEligible: !!cand.bonus_eligible,
        bonusPaidAt: cand.bonus_paid_at,
        candidateEmail: cand.candidate_email || '',
        referredPersonRole: cand.referred_person_role || '',
        referrerName: cand.referrer_name || '',
        referrerMobile: cand.referrer_mobile || '',
        referrerRole: cand.referrer_role || '',
        employeeId: cand.employee_id || '',
        siteLocation: cand.site_location || '',
        bankName: cand.bank_name || '',
        accountNumber: cand.account_number || '',
        ifscCode: cand.ifsc_code || '',
        upiId: cand.upi_id || '',
        isParadigmEmployee: !!cand.is_paradigm_employee
      }));
      setCandidates(mappedCandidates);

      // 2. Fetch Business Referrals
      const { data: busData, error: busError } = await supabase
        .from('business_referrals')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (busError) throw busError;
      
      const mappedBusinesses: BusinessReferral[] = (busData || []).map((bus: any) => ({
        id: bus.id,
        communityName: bus.community_name || '',
        contactPersonName: bus.contact_person_name || '',
        serviceInterested: bus.service_interested || '',
        status: bus.status || '',
        createdAt: bus.created_at || '',
        referrerName: bus.referrer_name || '',
        referrerMobile: bus.referrer_mobile || '',
        referrerRole: bus.referrer_role || '',
        clientName: bus.client_name || '',
        clientMobile: bus.client_mobile || '',
        clientEmail: bus.client_email || '',
        clientDesignation: bus.client_designation || '',
        communityNature: bus.community_nature || '',
        unitsCount: bus.units_count || '',
        remarks: bus.remarks || ''
      }));
      setBusinesses(mappedBusinesses);
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

  const handleWithdrawCandidate = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to withdraw the referral for ${name}? This action cannot be undone.`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('candidate_referrals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success(`Referral for ${name} has been withdrawn`);
      fetchData();
    } catch (err: any) {
      console.error('Error withdrawing candidate referral:', err);
      toast.error('Failed to withdraw referral');
    }
  };

  const handleWithdrawBusiness = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to withdraw the business lead for ${name}? This action cannot be undone.`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('business_referrals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success(`Business lead for ${name} has been withdrawn`);
      fetchData();
    } catch (err: any) {
      console.error('Error withdrawing business lead:', err);
      toast.error('Failed to withdraw lead');
    }
  };

  const totalCandidates = candidates.length;
  const joinedCount = candidates.filter(c => c.currentStage === 'joined').length;
  const eligibleBonusCount = candidates.filter(c => c.bonusEligible && !c.bonusPaidAt).length;

  if (!isMobile && selectedCandidate) {
    return (
      <div className="animate-fade-in min-w-0 overflow-x-hidden min-h-screen space-y-8 pb-32 md:pb-8">
        <CandidateDetailView
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onWithdraw={handleWithdrawCandidate}
        />
      </div>
    );
  }

  if (!isMobile && selectedBusiness) {
    return (
      <div className="animate-fade-in min-w-0 overflow-x-hidden min-h-screen space-y-8 pb-32 md:pb-8">
        <BusinessDetailView
          business={selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
          onWithdraw={handleWithdrawBusiness}
        />
      </div>
    );
  }

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
                    <th className={`text-right px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Actions</th>
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
                        <td className="py-5 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedCandidate(cand)}
                              className={`p-2 rounded-xl transition-all active:scale-95 flex items-center justify-center ${
                                isMobile
                                  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 shadow-sm border border-emerald-100'
                              }`}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleWithdrawCandidate(cand.id, cand.candidateName)}
                              className={`p-2 rounded-xl transition-all active:scale-95 flex items-center justify-center ${
                                isMobile
                                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                  : 'bg-red-50 text-red-600 hover:bg-red-100 shadow-sm border border-red-100'
                              }`}
                              title="Withdraw Referral"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
                  <th className={`text-right px-5 py-5 font-black uppercase tracking-widest text-[10px] ${isMobile ? 'text-white/40' : 'text-muted'}`}>Actions</th>
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
                      <td className="py-5 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedBusiness(bus)}
                            className={`p-2 rounded-xl transition-all active:scale-95 flex items-center justify-center ${
                              isMobile
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 shadow-sm border border-emerald-100'
                            }`}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleWithdrawBusiness(bus.id, bus.communityName)}
                            className={`p-2 rounded-xl transition-all active:scale-95 flex items-center justify-center ${
                              isMobile
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                : 'bg-red-50 text-red-600 hover:bg-red-100 shadow-sm border border-red-100'
                            }`}
                            title="Withdraw Lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
      {/* Modals for viewing details */}
      {selectedCandidate && (
        <Modal
          isOpen={!!selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          title="Candidate Referral Details"
          hideFooter
          maxWidth="md:max-w-2xl"
        >
          <div className={`space-y-6 ${isMobile ? 'text-white bg-[#091c13]' : 'text-slate-800'}`}>
            <div className="flex items-center justify-between border-b pb-4 border-slate-150 max-md:border-white/10">
              <div>
                <h4 className="text-base font-black uppercase text-emerald-600 tracking-wider">
                  {selectedCandidate.candidateName}
                </h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">
                  Submitted {new Date(selectedCandidate.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StageBadge stage={selectedCandidate.currentStage as any} />
                {selectedCandidate.currentStage === 'joined' && (
                  <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded border uppercase ${
                    selectedCandidate.bonusPaidAt
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                      : 'bg-amber-50 border-amber-200 text-amber-600'
                  }`}>
                    {selectedCandidate.bonusPaidAt ? 'Bonus Paid' : 'Bonus Processing'}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Candidate Information
                </h5>
                <DetailRow icon={<User className="w-4 h-4" />} label="Full Name" value={selectedCandidate.candidateName} isMobile={isMobile} />
                <DetailRow icon={<Phone className="w-4 h-4" />} label="Mobile Number" value={selectedCandidate.candidateMobile} isMobile={isMobile} />
                <DetailRow icon={<Mail className="w-4 h-4" />} label="Email Address" value={selectedCandidate.candidateEmail || 'N/A'} isMobile={isMobile} />
                <DetailRow icon={<Briefcase className="w-4 h-4" />} label="Target Role" value={selectedCandidate.candidateRole} isMobile={isMobile} />
                <DetailRow icon={<Info className="w-4 h-4" />} label="Current Experience" value={selectedCandidate.referredPersonRole || 'N/A'} isMobile={isMobile} />
              </div>

              <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Referrer Details &amp; Payment
                </h5>
                <DetailRow icon={<User className="w-4 h-4" />} label="Referrer Name" value={selectedCandidate.referrerName || 'N/A'} isMobile={isMobile} />
                <DetailRow icon={<Phone className="w-4 h-4" />} label="Referrer Mobile" value={selectedCandidate.referrerMobile || 'N/A'} isMobile={isMobile} />
                <DetailRow icon={<ShieldCheck className="w-4 h-4" />} label="Designation / Relation" value={selectedCandidate.referrerRole || 'N/A'} isMobile={isMobile} />
                
                {selectedCandidate.isParadigmEmployee ? (
                  <>
                    <DetailRow icon={<Hash className="w-4 h-4" />} label="Employee ID" value={selectedCandidate.employeeId || 'N/A'} isMobile={isMobile} />
                    <DetailRow icon={<MapPin className="w-4 h-4" />} label="Location / Site" value={selectedCandidate.siteLocation || 'N/A'} isMobile={isMobile} />
                  </>
                ) : (
                  <>
                    {selectedCandidate.upiId ? (
                      <DetailRow icon={<Wallet className="w-4 h-4" />} label="UPI ID" value={selectedCandidate.upiId} isMobile={isMobile} />
                    ) : (
                      <>
                        <DetailRow icon={<Landmark className="w-4 h-4" />} label="Bank Name" value={selectedCandidate.bankName || 'N/A'} isMobile={isMobile} />
                        <DetailRow icon={<Hash className="w-4 h-4" />} label="Account Number" value={selectedCandidate.accountNumber || 'N/A'} isMobile={isMobile} />
                        <DetailRow icon={<Info className="w-4 h-4" />} label="IFSC Code" value={selectedCandidate.ifscCode || 'N/A'} isMobile={isMobile} />
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-150 max-md:border-white/10">
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all ${
                  isMobile
                    ? 'bg-[#182a20] border border-[#2a4536] text-white hover:bg-[#1f3729]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedBusiness && (
        <Modal
          isOpen={!!selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
          title="Business Lead Details"
          hideFooter
          maxWidth="md:max-w-2xl"
        >
          <div className={`space-y-6 ${isMobile ? 'text-white bg-[#091c13]' : 'text-slate-800'}`}>
            <div className="flex items-center justify-between border-b pb-4 border-slate-150 max-md:border-white/10">
              <div>
                <h4 className="text-base font-black uppercase text-emerald-600 tracking-wider">
                  {selectedBusiness.communityName}
                </h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">
                  Submitted {new Date(selectedBusiness.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div>
                <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border ${
                  selectedBusiness.status === 'yes'
                    ? (isMobile ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700 border-emerald-100')
                    : (isMobile ? 'bg-slate-500/10 border-slate-500/20 text-slate-400' : 'bg-slate-100 text-slate-500 border-slate-200')
                }`}>
                  {selectedBusiness.status === 'yes' ? 'Converted' : 'Pending'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" /> Lead &amp; Client Details
                </h5>
                <DetailRow icon={<Building className="w-4 h-4" />} label="Community Name" value={selectedBusiness.communityName} isMobile={isMobile} />
                <DetailRow icon={<Info className="w-4 h-4" />} label="Nature of Community" value={selectedBusiness.communityNature || 'N/A'} isMobile={isMobile} />
                <DetailRow icon={<Hash className="w-4 h-4" />} label="Total Units" value={selectedBusiness.unitsCount || 'N/A'} isMobile={isMobile} />
                <DetailRow icon={<Briefcase className="w-4 h-4" />} label="Interested Service" value={selectedBusiness.serviceInterested} isMobile={isMobile} />
                <DetailRow icon={<User className="w-4 h-4" />} label="Contact Person" value={selectedBusiness.contactPersonName} isMobile={isMobile} />
                <DetailRow icon={<Info className="w-4 h-4" />} label="Client Designation" value={selectedBusiness.clientDesignation || 'N/A'} isMobile={isMobile} />
                <DetailRow icon={<Mail className="w-4 h-4" />} label="Client Email" value={selectedBusiness.clientEmail || 'N/A'} isMobile={isMobile} />
                <DetailRow icon={<Phone className="w-4 h-4" />} label="Client Mobile" value={selectedBusiness.clientMobile || 'N/A'} isMobile={isMobile} />
              </div>

              <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Referrer Info &amp; Notes
                </h5>
                <DetailRow icon={<User className="w-4 h-4" />} label="Referrer Name" value={selectedBusiness.referrerName || 'N/A'} isMobile={isMobile} />
                <DetailRow icon={<Phone className="w-4 h-4" />} label="Referrer Mobile" value={selectedBusiness.referrerMobile || 'N/A'} isMobile={isMobile} />
                <DetailRow icon={<ShieldCheck className="w-4 h-4" />} label="Role / Designation" value={selectedBusiness.referrerRole || 'N/A'} isMobile={isMobile} />
                
                <div className={`p-4 rounded-xl border flex flex-col gap-1.5 ${isMobile ? 'bg-white/[0.03] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isMobile ? 'text-white/40' : 'text-slate-400'}`}>Remarks / Notes</span>
                  <p className={`text-xs leading-relaxed font-semibold whitespace-pre-line ${isMobile ? 'text-white/80' : 'text-slate-600'}`}>
                    {selectedBusiness.remarks || 'No remarks provided.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-150 max-md:border-white/10">
              <button
                type="button"
                onClick={() => setSelectedBusiness(null)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all ${
                  isMobile
                    ? 'bg-[#182a20] border border-[#2a4536] text-white hover:bg-[#1f3729]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// Detail row helper component for Modals
const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string; isMobile?: boolean }> = ({ icon, label, value, isMobile }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl ${isMobile ? 'bg-white/[0.02]' : 'bg-slate-50 border border-slate-100/50'}`}>
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isMobile ? 'bg-white/5 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className={`text-[9px] font-black uppercase tracking-widest ${isMobile ? 'text-white/40' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-xs font-bold truncate mt-0.5 ${isMobile ? 'text-white' : 'text-slate-800'}`}>{value || 'N/A'}</p>
    </div>
  </div>
);

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

// Desktop-specific Candidate detail page view
interface CandidateDetailViewProps {
  candidate: CandidateReferral;
  onClose: () => void;
  onWithdraw: (id: string, name: string) => void;
}

const CandidateDetailView: React.FC<CandidateDetailViewProps> = ({ candidate, onClose, onWithdraw }) => {
  const dateStr = new Date(candidate.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const PIPELINE_STAGES = [
    { key: 'new', label: 'New Lead' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'screened', label: 'Screened' },
    { key: 'interview', label: 'Interview' },
    { key: 'shortlisted', label: 'Shortlisted' },
    { key: 'offer', label: 'Offer' },
    { key: 'joined', label: 'Joined' },
  ];

  const currentIdx = PIPELINE_STAGES.findIndex(s => s.key === candidate.currentStage);
  const isRejected = candidate.currentStage === 'rejected';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Back button and page title */}
      <div className="flex flex-col gap-1 w-full">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors mb-1.5 w-fit group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to My Referrals</span>
        </button>

        <div className="flex justify-between items-center gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-primary-text tracking-tight uppercase">
                {candidate.candidateName}
              </h1>
              <StageBadge stage={candidate.currentStage as any} />
            </div>
            <p className="text-xs md:text-sm text-muted mt-1 uppercase font-mono tracking-wider">
              Submitted on {dateStr}
            </p>
          </div>

          <button
            onClick={() => onWithdraw(candidate.id, candidate.candidateName)}
            className="flex items-center gap-2 btn btn-secondary text-red-600 hover:bg-red-50 hover:text-red-700 border-red-100 font-bold active:scale-95 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Withdraw Referral</span>
          </button>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Candidate Info Card */}
          <div className="bg-white rounded-3xl border border-border p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-600">
                <User className="w-5 h-5" />
              </div>
              <h2 className="text-base font-black uppercase tracking-wider text-primary-text">
                Candidate Information
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailRow icon={<User className="w-4 h-4" />} label="Full Name" value={candidate.candidateName} />
              <DetailRow icon={<Phone className="w-4 h-4" />} label="Mobile Number" value={candidate.candidateMobile} />
              <DetailRow icon={<Mail className="w-4 h-4" />} label="Email Address" value={candidate.candidateEmail || 'N/A'} />
              <DetailRow icon={<Briefcase className="w-4 h-4" />} label="Target Role" value={candidate.candidateRole} />
              <DetailRow icon={<Info className="w-4 h-4" />} label="Current Experience" value={candidate.referredPersonRole || 'N/A'} />
            </div>
          </div>

          {/* Timeline / Progress Pipeline Card */}
          <div className="bg-white rounded-3xl border border-border p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-primary-text">
                    Recruitment Progress
                  </h3>
                  <p className="text-[10px] text-muted mt-0.5 uppercase tracking-wide">
                    Stages timeline tracking
                  </p>
                </div>
              </div>
              {isRejected && (
                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-600 border border-red-100">
                  Rejected
                </span>
              )}
            </div>

            {/* Horizontal Timeline flow */}
            <div className="overflow-x-auto no-scrollbar pb-2 pt-4">
              <div className="flex items-start gap-0 min-w-max">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const isCompleted = idx < currentIdx || (idx === currentIdx && stage.key === candidate.currentStage);
                  const isCurrent = idx === currentIdx;

                  return (
                    <React.Fragment key={stage.key}>
                      <div className="flex flex-col items-center" style={{ minWidth: 100 }}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                          isCurrent
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/20'
                            : isCompleted
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-150'
                              : 'bg-slate-50 text-slate-300'
                        }`}>
                          <Award className="w-4 h-4" />
                        </div>
                        <p className={`text-[9px] font-black uppercase tracking-widest mt-2 text-center leading-tight ${
                          isCurrent
                            ? 'text-emerald-600'
                            : isCompleted
                              ? 'text-primary-text font-bold'
                              : 'text-slate-400'
                        }`}>
                          {stage.label}
                        </p>
                      </div>

                      {idx < PIPELINE_STAGES.length - 1 && (
                        <div className="flex items-center pt-4 px-0">
                          <div className={`h-[2px] w-6 md:w-8 rounded-full ${
                            idx < currentIdx ? 'bg-emerald-400' : 'bg-slate-100'
                          }`} />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side (1 col) */}
        <div className="space-y-6">
          {/* Referrer Info & Payment Card */}
          <div className="bg-white rounded-3xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-primary-text">
                Referrer details
              </h3>
            </div>

            <div className="space-y-4">
              <DetailRow icon={<User className="w-4 h-4" />} label="Referrer Name" value={candidate.referrerName || 'N/A'} />
              <DetailRow icon={<Phone className="w-4 h-4" />} label="Referrer Mobile" value={candidate.referrerMobile || 'N/A'} />
              <DetailRow icon={<ShieldCheck className="w-4 h-4" />} label="Designation / Relation" value={candidate.referrerRole || 'N/A'} />
              
              {candidate.isParadigmEmployee ? (
                <>
                  <DetailRow icon={<Hash className="w-4 h-4" />} label="Employee ID" value={candidate.employeeId || 'N/A'} />
                  <DetailRow icon={<MapPin className="w-4 h-4" />} label="Location / Site" value={candidate.siteLocation || 'N/A'} />
                </>
              ) : (
                <>
                  {candidate.upiId ? (
                    <DetailRow icon={<Wallet className="w-4 h-4" />} label="UPI ID" value={candidate.upiId} />
                  ) : (
                    <>
                      <DetailRow icon={<Landmark className="w-4 h-4" />} label="Bank Name" value={candidate.bankName || 'N/A'} />
                      <DetailRow icon={<Hash className="w-4 h-4" />} label="Account Number" value={candidate.accountNumber || 'N/A'} />
                      <DetailRow icon={<Info className="w-4 h-4" />} label="IFSC Code" value={candidate.ifscCode || 'N/A'} />
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Referral Bonus Card */}
          <div className="bg-white rounded-3xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-600">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-primary-text">
                Referral Bonus
              </h3>
            </div>

            <div className="flex flex-col items-center py-4 justify-center border border-dashed border-border rounded-2xl bg-page/40">
              {candidate.currentStage === 'joined' ? (
                candidate.bonusPaidAt ? (
                  <>
                    <span className="w-12 h-12 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600 mb-3">
                      <CheckCircle2 className="w-6 h-6" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-600 px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                      Paid
                    </span>
                    <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mt-2">
                      Bonus paid on {new Date(candidate.bonusPaidAt).toLocaleDateString('en-IN')}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="w-12 h-12 rounded-full flex items-center justify-center bg-amber-100 text-amber-600 mb-3 animate-pulse">
                      <Clock className="w-6 h-6" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-widest text-amber-600 px-3 py-1 bg-amber-50 rounded-lg border border-amber-200">
                      Processing
                    </span>
                    <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mt-2">
                      Bonus payout is being verified
                    </p>
                  </>
                )
              ) : (
                <>
                  <span className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100 text-slate-400 mb-3">
                    <DollarSign className="w-6 h-6" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400 px-3 py-1 bg-slate-50 rounded-lg border border-slate-200">
                    Not Eligible
                  </span>
                  <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mt-2 text-center px-4">
                    Bonus is released after candidate joins & completes onboarding
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Desktop-specific Business detail page view
interface BusinessDetailViewProps {
  business: BusinessReferral;
  onClose: () => void;
  onWithdraw: (id: string, name: string) => void;
}

const BusinessDetailView: React.FC<BusinessDetailViewProps> = ({ business, onClose, onWithdraw }) => {
  const dateStr = new Date(business.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Back button and page title */}
      <div className="flex flex-col gap-1 w-full">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors mb-1.5 w-fit group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to My Referrals</span>
        </button>

        <div className="flex justify-between items-center gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-primary-text tracking-tight uppercase">
                {business.communityName}
              </h1>
              <span className={`inline-flex items-center text-[9px] font-black px-2.5 py-1 rounded-lg border ${
                business.status === 'yes'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {business.status === 'yes' ? 'CONVERTED' : 'PENDING'}
              </span>
            </div>
            <p className="text-xs md:text-sm text-muted mt-1 uppercase font-mono tracking-wider">
              Submitted on {dateStr}
            </p>
          </div>

          <button
            onClick={() => onWithdraw(business.id, business.communityName)}
            className="flex items-center gap-2 btn btn-secondary text-red-600 hover:bg-red-50 hover:text-red-700 border-red-100 font-bold active:scale-95 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Withdraw Lead</span>
          </button>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Community Info Card */}
          <div className="bg-white rounded-3xl border border-border p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-600">
                <Building className="w-5 h-5" />
              </div>
              <h2 className="text-base font-black uppercase tracking-wider text-primary-text">
                Lead & Client Details
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailRow icon={<Building className="w-4 h-4" />} label="Community Name" value={business.communityName} />
              <DetailRow icon={<Info className="w-4 h-4" />} label="Nature of Community" value={business.communityNature || 'N/A'} />
              <DetailRow icon={<Hash className="w-4 h-4" />} label="Total Units" value={business.unitsCount || 'N/A'} />
              <DetailRow icon={<Briefcase className="w-4 h-4" />} label="Interested Service" value={business.serviceInterested} />
            </div>
          </div>

          {/* Contact Person Details Card */}
          <div className="bg-white rounded-3xl border border-border p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-primary-text">
                Client Contact Information
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailRow icon={<User className="w-4 h-4" />} label="Contact Person" value={business.contactPersonName} />
              <DetailRow icon={<Info className="w-4 h-4" />} label="Client Designation" value={business.clientDesignation || 'N/A'} />
              <DetailRow icon={<Mail className="w-4 h-4" />} label="Client Email" value={business.clientEmail || 'N/A'} />
              <DetailRow icon={<Phone className="w-4 h-4" />} label="Client Mobile" value={business.clientMobile || 'N/A'} />
            </div>
          </div>
        </div>

        {/* Right Side (1 col) */}
        <div className="space-y-6">
          {/* Referrer Info Card */}
          <div className="bg-white rounded-3xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-primary-text">
                Referrer Info
              </h3>
            </div>

            <div className="space-y-4">
              <DetailRow icon={<User className="w-4 h-4" />} label="Referrer Name" value={business.referrerName || 'N/A'} />
              <DetailRow icon={<Phone className="w-4 h-4" />} label="Referrer Mobile" value={business.referrerMobile || 'N/A'} />
              <DetailRow icon={<ShieldCheck className="w-4 h-4" />} label="Role / Designation" value={business.referrerRole || 'N/A'} />
            </div>
          </div>

          {/* Remarks Card */}
          <div className="bg-white rounded-3xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-600">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-primary-text">
                Remarks / Notes
              </h3>
            </div>

            <div className="p-4 rounded-xl border flex flex-col gap-1.5 bg-slate-50 border-slate-100">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Remarks / Notes</span>
              <p className="text-xs leading-relaxed font-semibold whitespace-pre-line text-slate-600">
                {business.remarks || 'No remarks provided.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyReferralsPage;
