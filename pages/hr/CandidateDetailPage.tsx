import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { hrmApi } from '../../services/hrm.api';
import { supabase } from '../../services/supabase';
import StageBadge from '../../components/hr/StageBadge';
import LogCallModal from '../../components/hr/LogCallModal';
import CallHistoryTimeline from '../../components/hr/CallHistoryTimeline';
import ScreeningFormPanel from '../../components/hr/ScreeningFormPanel';
import LettersTab from '../../components/hr/LettersTab';
import ActivityFeed from '../../components/hr/ActivityFeed';
import Button from '../../components/ui/Button';
import {
  Phone, User, ArrowLeft, RefreshCw, Briefcase, Calendar, Info, Clock, AlertTriangle, ShieldCheck, Mail,
  FileText, MessageSquare, Activity, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CandidateStage } from '../../types';
import { useMediaQuery } from '../../hooks/useMediaQuery';

// Legal transition states mapping
const LEGAL_TRANSITIONS: Record<CandidateStage, CandidateStage[]> = {
  new: ['contacted'],
  contacted: ['screened', 'rejected'],
  screened: ['interview', 'rejected'],
  interview: ['shortlisted', 'offer', 'rejected'],
  shortlisted: ['offer', 'rejected'],
  offer: ['joined', 'rejected'],
  joined: [],
  rejected: []
};

const CandidateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 767px)');
  
  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'screening' | 'letters' | 'feed'>('overview');
  
  // Modals / change states
  const [showCallModal, setShowCallModal] = useState<boolean>(false);
  const [targetStage, setTargetStage] = useState<string>('');
  const [stageReason, setStageReason] = useState<string>('');
  const [submittingStage, setSubmittingStage] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const fetchCandidate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidate_referrals')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setCandidate(data);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load candidate details');
      navigate('/hrm/calls/queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidate();
  }, [id, refreshKey]);

  const handleStageChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStage) return;

    setSubmittingStage(true);
    try {
      await hrmApi.moveStage(id!, targetStage, stageReason);
      toast.success(`Candidate stage moved to ${targetStage}`);
      setTargetStage('');
      setStageReason('');
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update stage');
    } finally {
      setSubmittingStage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-medium text-muted animate-pulse">Loading candidate profile...</p>
      </div>
    );
  }

  if (!candidate) return null;

  const currentStage: CandidateStage = (candidate.current_stage || 'new') as CandidateStage;
  const allowedNextStages = LEGAL_TRANSITIONS[currentStage] || [];
  const hasNoTransitions = allowedNextStages.length === 0;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'calls', label: 'Call Logs', icon: Phone },
    { id: 'screening', label: 'Screening', icon: FileText },
    { id: 'letters', label: 'Letters', icon: Mail },
    { id: 'feed', label: 'Activity', icon: Activity }
  ];

  return (
    <div className={`w-full animate-fade-in min-w-0 ${isMobile ? 'bg-[#091c13] text-white p-4 pt-6 space-y-6 pb-24 min-h-screen' : 'space-y-8 pb-32'}`}>
      {/* Modern Header - Sticky on Mobile */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 ${isMobile ? '' : ''}`}>
        <div className="flex flex-col gap-1 w-full">
          {/* Back Nav */}
          <button
            onClick={() => navigate('/hrm/calls/queue')}
            className={`flex items-center gap-1.5 text-xs hover:text-emerald-400 transition-colors mb-1.5 w-fit group ${isMobile ? 'text-white/50' : 'text-muted hover:text-accent'}`}
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Queue</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className={`text-xl md:text-2xl font-bold tracking-tight truncate ${isMobile ? 'text-white' : 'text-primary-text'}`}>
                {candidate.candidate_name}
              </h1>
              <StageBadge stage={currentStage} />
            </div>
            <p className={`text-sm mt-1 ${isMobile ? 'text-white/50' : 'text-muted'}`}>
              Manage candidate details, calls & pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={() => setShowCallModal(true)}
            className={`btn btn-primary btn-md gap-2 flex-1 md:flex-none active:scale-95 transition-all shadow-xl shadow-accent/20 hover:shadow-accent/40`}
          >
            <Phone className="w-4 h-4" />
            <span className="font-semibold text-sm">Log Call</span>
          </button>
        </div>
      </div>

      {/* Summary + Stage Transition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info card */}
        <div className={`lg:col-span-2 ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-5' : 'bg-white rounded-3xl border border-border p-6 md:p-8 shadow-sm'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isMobile ? 'bg-emerald-500/20' : 'bg-accent/5'}`}>
              <User className={`w-5 h-5 ${isMobile ? 'text-emerald-400' : 'text-accent'}`} />
            </div>
            <h2 className={`text-lg font-black uppercase tracking-wider ${isMobile ? 'text-white' : 'text-primary-text'}`}>Candidate Profile</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow icon={<Briefcase />} label="Target Role" value={candidate.candidate_role} isMobile={isMobile} />
            <InfoRow icon={<Phone />} label="Mobile" value={candidate.candidate_mobile} isMobile={isMobile} />
            <InfoRow icon={<User />} label="Referrer" value={`${candidate.referrer_name} (${candidate.referrer_role || 'Employee'})`} isMobile={isMobile} />
            <InfoRow icon={<Calendar />} label="Submitted" value={new Date(candidate.created_at).toLocaleDateString('en-IN')} isMobile={isMobile} />
            {candidate.candidate_email && (
              <InfoRow icon={<Mail />} label="Email" value={candidate.candidate_email} isMobile={isMobile} />
            )}
            {candidate.joining_date && (
              <InfoRow icon={<Calendar />} label="Joining Date" value={new Date(candidate.joining_date).toLocaleDateString('en-IN')} isMobile={isMobile} accent />
            )}
          </div>
        </div>

        {/* Stage Transition Panel */}
        <div className={`${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-5' : 'bg-white rounded-3xl border border-border p-6 shadow-sm'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isMobile ? 'bg-blue-500/20' : 'bg-blue-500/10'}`}>
              <Activity className={`w-5 h-5 ${isMobile ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <h3 className={`text-sm font-black uppercase tracking-wider ${isMobile ? 'text-white' : 'text-primary-text'}`}>Stage Transition</h3>
          </div>

          {hasNoTransitions ? (
            <div className={`p-5 rounded-2xl text-center ${isMobile ? 'bg-white/[0.03] border border-[#2a4536]' : 'bg-page border border-border'}`}>
              <ShieldCheck className={`w-8 h-8 mx-auto mb-2 ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <p className={`text-xs font-bold ${isMobile ? 'text-white/50' : 'text-muted'}`}>Terminal stage: {currentStage.toUpperCase()}</p>
            </div>
          ) : (
            <form onSubmit={handleStageChange} className="space-y-4">
              <div>
                <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isMobile ? 'text-white/40' : 'text-muted'}`}>
                  Next Stage
                </label>
                <select
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value)}
                  className={`w-full h-11 px-3 rounded-2xl text-sm outline-none ${isMobile ? 'bg-[#121f17] border border-[#2a4536] text-white' : 'bg-page border border-border text-primary-text'}`}
                  required
                >
                  <option value="">Select next stage...</option>
                  {allowedNextStages.map((stg) => (
                    <option key={stg} value={stg}>
                      {stg.charAt(0).toUpperCase() + stg.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isMobile ? 'text-white/40' : 'text-muted'}`}>
                  Reason
                </label>
                <textarea
                  value={stageReason}
                  onChange={(e) => setStageReason(e.target.value)}
                  rows={2}
                  placeholder="Notes or evaluation results..."
                  className={`w-full p-3 rounded-2xl text-sm outline-none resize-none ${isMobile ? 'bg-[#121f17] border border-[#2a4536] text-white placeholder:text-white/20' : 'bg-page border border-border text-primary-text placeholder:text-muted'}`}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingStage}
                className="btn btn-primary w-full gap-2 active:scale-95 transition-all"
              >
                {submittingStage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4 rotate-180" />}
                Transition Stage
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={`p-2 rounded-3xl border ${isMobile ? 'bg-[#182a20] border-[#2a4536]' : 'bg-white border-border shadow-sm'}`}>
        <nav className="flex space-x-2 overflow-x-auto no-scrollbar scroll-smooth snap-x">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all snap-start ${
                  activeTab === tab.id
                    ? (isMobile ? 'bg-[#00a859] text-white shadow-lg' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20')
                    : (isMobile ? 'text-white/40 hover:text-white' : 'text-muted hover:text-primary-text')
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className={`min-h-[300px] ${isMobile ? 'bg-[#182a20] rounded-[24px] border border-[#2a4536] p-5' : 'bg-white rounded-3xl border border-border p-6 md:p-8 shadow-sm'}`}>
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            {currentStage === 'shortlisted' && (
              <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 gap-4 rounded-2xl border transition-all ${isMobile ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200 shadow-sm'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isMobile ? 'bg-emerald-500/20' : 'bg-emerald-500/10'}`}>
                    <Mail className={`w-5 h-5 ${isMobile ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>Candidate Shortlisted!</h4>
                    <p className={`text-xs mt-0.5 ${isMobile ? 'text-white/60' : 'text-muted'}`}>An Offer Letter draft has been automatically generated. Review and issue it to send to the candidate.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('letters')}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap ${isMobile ? 'bg-[#006b3f] text-white shadow-md' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/15 hover:bg-emerald-600'}`}
                >
                  <span>Open Letters Workspace</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Referral Info */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isMobile ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                  <Info className={`w-4 h-4 ${isMobile ? 'text-amber-400' : 'text-amber-600'}`} />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-wider ${isMobile ? 'text-white' : 'text-primary-text'}`}>Referral Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isMobile ? 'text-white/60' : 'text-muted'}`}>Referral Origin</h4>
                  <div className={`grid grid-cols-2 gap-2 text-xs ${isMobile ? 'text-white/40' : 'text-muted'}`}>
                    <span className="font-bold">Is Employee?</span>
                    <span className={`font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>{candidate.is_paradigm_employee ? 'Yes' : 'No'}</span>
                    {candidate.employee_id && (
                      <>
                        <span className="font-bold">Employee ID:</span>
                        <span className={`font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>{candidate.employee_id}</span>
                      </>
                    )}
                    {candidate.site_location && (
                      <>
                        <span className="font-bold">Location:</span>
                        <span className={`font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>{candidate.site_location}</span>
                      </>
                    )}
                  </div>
                </div>

                {!candidate.is_paradigm_employee && (
                  <div className="space-y-3">
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${isMobile ? 'text-white/60' : 'text-muted'}`}>Bank / Payment</h4>
                    <div className={`grid grid-cols-2 gap-2 text-xs ${isMobile ? 'text-white/40' : 'text-muted'}`}>
                      <span className="font-bold">Bank:</span>
                      <span className={`font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>{candidate.bank_name || 'N/A'}</span>
                      <span className="font-bold">Account:</span>
                      <span className={`font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>{candidate.account_number || 'N/A'}</span>
                      <span className="font-bold">IFSC:</span>
                      <span className={`font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>{candidate.ifsc_code || 'N/A'}</span>
                      <span className="font-bold">UPI:</span>
                      <span className={`font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>{candidate.upi_id || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Probation details */}
            {(candidate.joining_date || candidate.probation_end_date) && (
              <div className={`pt-6 border-t ${isMobile ? 'border-[#2a4536]' : 'border-border/50'}`}>
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isMobile ? 'text-white/60' : 'text-muted'}`}>Recruitment & Probation</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MiniCard label="Joining Date" value={candidate.joining_date} isMobile={isMobile} />
                  <MiniCard label="Probation End" value={candidate.probation_end_date} isMobile={isMobile} />
                  <MiniCard
                    label="Bonus"
                    value={candidate.bonus_eligible ? 'ELIGIBLE' : 'INELIGIBLE'}
                    isMobile={isMobile}
                    accent={candidate.bonus_eligible}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isMobile ? 'bg-emerald-500/20' : 'bg-accent/5'}`}>
                  <Phone className={`w-4 h-4 ${isMobile ? 'text-emerald-400' : 'text-accent'}`} />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-wider ${isMobile ? 'text-white' : 'text-primary-text'}`}>Call History</h3>
              </div>
              <button
                onClick={() => setShowCallModal(true)}
                className="btn btn-secondary btn-sm gap-2"
              >
                <Phone className="w-3.5 h-3.5" />
                Log Call
              </button>
            </div>
            <CallHistoryTimeline candidateId={id!} refreshTrigger={refreshKey} />
          </div>
        )}

        {activeTab === 'screening' && (
          <ScreeningFormPanel
            candidateId={id!}
            onScreeningSaved={() => setRefreshKey(prev => prev + 1)}
          />
        )}

        {activeTab === 'letters' && (
          <LettersTab
            candidateId={id!}
            candidateName={candidate.candidate_name}
            onLetterActivity={() => setRefreshKey(prev => prev + 1)}
          />
        )}

        {activeTab === 'feed' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isMobile ? 'bg-blue-500/20' : 'bg-blue-500/10'}`}>
                <MessageSquare className={`w-4 h-4 ${isMobile ? 'text-blue-400' : 'text-blue-600'}`} />
              </div>
              <h3 className={`text-sm font-black uppercase tracking-wider ${isMobile ? 'text-white' : 'text-primary-text'}`}>Activity Logs</h3>
            </div>
            <ActivityFeed candidateId={id!} refreshTrigger={refreshKey} />
          </div>
        )}
      </div>

      {/* Log Call Modal */}
      <LogCallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        candidateId={id!}
        candidateName={candidate.candidate_name}
        onCallLogged={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  );
};

// Info Row helper
const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string; isMobile?: boolean; accent?: boolean }> = ({ icon, label, value, isMobile, accent }) => (
  <div className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${isMobile ? 'bg-white/[0.02]' : 'bg-page/40'}`}>
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
      accent
        ? (isMobile ? 'bg-emerald-500/20' : 'bg-emerald-50')
        : (isMobile ? 'bg-white/5' : 'bg-slate-50')
    }`}>
      {React.cloneElement(icon as React.ReactElement, {
        className: `w-4 h-4 ${accent ? (isMobile ? 'text-emerald-400' : 'text-emerald-600') : (isMobile ? 'text-white/30' : 'text-muted')}`
      })}
    </div>
    <div className="min-w-0">
      <p className={`text-[10px] font-black uppercase tracking-widest ${isMobile ? 'text-white/40' : 'text-muted'}`}>{label}</p>
      <p className={`text-sm font-bold truncate mt-0.5 ${accent ? (isMobile ? 'text-emerald-400' : 'text-emerald-600') : (isMobile ? 'text-white' : 'text-primary-text')}`}>{value}</p>
    </div>
  </div>
);

// Mini Card helper
const MiniCard: React.FC<{ label: string; value: string; isMobile?: boolean; accent?: boolean }> = ({ label, value, isMobile, accent }) => (
  <div className={`p-4 rounded-2xl border ${isMobile ? 'bg-white/[0.02] border-[#2a4536]' : 'bg-page/40 border-border/50'}`}>
    <p className={`text-[10px] font-black uppercase tracking-widest ${isMobile ? 'text-white/40' : 'text-muted'}`}>{label}</p>
    <p className={`text-sm font-bold mt-1 ${accent ? (isMobile ? 'text-emerald-400' : 'text-emerald-600') : (isMobile ? 'text-white' : 'text-primary-text')}`}>{value}</p>
  </div>
);

export default CandidateDetailPage;
