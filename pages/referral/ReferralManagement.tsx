import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, ArrowLeft, UserPlus,
  Phone, Briefcase, CheckCircle2, LayoutGrid, List,
  ShieldCheck, RefreshCw, Calendar, Clock, ChevronRight
} from 'lucide-react';
import { api } from '../../services/api';

// ─── Stat Card ───────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  sub?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, sub }) => (
  <div className="bg-white rounded-3xl border border-border p-4 md:p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-300 shadow-sm max-md:bg-white/[0.03] max-md:backdrop-blur-xl max-md:border-white/5 max-md:shadow-2xl">
    <div className="absolute top-0 right-0 p-3 opacity-[0.05] group-hover:opacity-[0.08] transition-opacity">
      {React.cloneElement(icon as React.ReactElement, { className: 'w-16 h-16' })}
    </div>
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${color}18` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] text-muted font-black uppercase tracking-widest truncate max-md:text-white/40">{label}</p>
        <p className="text-lg font-black text-primary-text mt-0.5 max-md:text-white">{value}</p>
      </div>
    </div>
    {sub && (
      <div className="flex items-center gap-1.5">
        <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: color }} />
        <p className="text-[8px] font-black text-muted uppercase tracking-tighter max-md:text-white/20">{sub}</p>
      </div>
    )}
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const ReferralManagement: React.FC = () => {
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const data = await api.getCandidateReferrals();
      setReferrals(data);
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReferrals();
    setRefreshing(false);
  };

  const filteredReferrals = referrals.filter(ref =>
    ref.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ref.referrerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ref.candidateRole?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCount = referrals.length;
  const employeeRefs = referrals.filter(r => r.isParadigmEmployee).length;
  const verifiedCount = referrals.filter(r => r.status === 'yes').length;

  return (
    <div className="space-y-8 animate-fade-in pb-32 md:pb-8 min-w-0 overflow-x-hidden">

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 hover:bg-accent/10 text-muted max-md:hover:bg-white/10 max-md:text-white/60"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-primary-text tracking-tight uppercase max-md:text-white">
              Referral Management
            </h1>
            <p className="text-[10px] text-muted mt-1 font-bold uppercase tracking-widest max-md:text-emerald-400/60">
              Employee Candidate Submissions
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="hidden sm:flex btn btn-primary btn-lg gap-2 shadow-xl shadow-accent/20 hover:shadow-accent/40 active:scale-95 transition-all disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 md:gap-5">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total" value={totalCount} color="#006b3f" sub="All referrals" />
        <StatCard icon={<ShieldCheck className="w-5 h-5" />} label="Employees" value={employeeRefs} color="#3b82f6" sub="Paradigm staff" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Verified" value={verifiedCount} color="#10b981" sub="System approved" />
      </div>

      {/* ── Search & Controls ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center bg-white p-3 md:p-5 rounded-3xl border border-border shadow-sm max-md:bg-[#0d2c18]/40 max-md:border-white/5 max-md:shadow-2xl">
        {/* Search */}
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted group-focus-within:text-accent transition-colors max-md:text-white/20" />
          <input
            type="text"
            placeholder="Search by name or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 md:h-12 bg-page border border-border rounded-2xl pl-11 md:pl-12 pr-4 text-sm md:text-base text-primary-text placeholder:text-muted focus:ring-2 focus:ring-accent/20 outline-none transition-all max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white max-md:placeholder:text-white/20 max-md:focus:bg-white/[0.08]"
          />
        </div>

        <div className="flex items-center justify-between md:justify-start gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-page p-1 rounded-2xl border border-border max-md:bg-white/[0.05] max-md:border-white/5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-muted hover:text-primary-text max-md:text-white/40'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-muted hover:text-primary-text max-md:text-white/40'}`}
              title="List View"
            >
              <List className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>

          {/* Mobile refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="md:hidden flex items-center justify-center gap-2 h-11 px-5 rounded-2xl bg-white/5 border border-white/10 text-emerald-400 font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Content Area ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            </div>
          </div>
          <p className="text-sm font-bold text-muted animate-pulse max-md:text-white/40">
            Loading referrals...
          </p>
        </div>
      ) : filteredReferrals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 rounded-[2.5rem] border-2 border-dashed border-border bg-page max-md:border-white/5 max-md:bg-white/[0.02]">
          <div className="w-16 h-16 bg-page rounded-full flex items-center justify-center mb-4 border border-border max-md:bg-white/5 max-md:border-white/5">
            <Users className="w-8 h-8 text-muted/30 max-md:text-white/10" />
          </div>
          <p className="text-lg font-black text-primary-text max-md:text-white">No referrals found</p>
          <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-2 max-md:text-white/30">
            Try adjusting your search
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {filteredReferrals.map((referral, idx) => (
            <ReferralCard key={referral.id} referral={referral} index={idx} />
          ))}
        </div>
      ) : (
        /* ── List View ── */
        <div className="bg-white rounded-[2.5rem] md:rounded-3xl border border-border overflow-hidden shadow-sm max-md:bg-[#0d2c18]/40 max-md:border-white/5 max-md:shadow-2xl pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-page max-md:bg-white/5 max-md:border-white/5">
                  <th className="text-left px-4 md:px-6 py-5 font-black text-muted uppercase tracking-widest text-[10px] max-md:text-white/40">Candidate</th>
                  <th className="hidden md:table-cell text-left px-6 py-5 font-black text-muted uppercase tracking-widest text-[10px]">Contact</th>
                  <th className="text-left px-4 md:px-6 py-5 font-black text-muted uppercase tracking-widest text-[10px] max-md:text-white/40">Referred By</th>
                  <th className="hidden md:table-cell text-left px-6 py-5 font-black text-muted uppercase tracking-widest text-[10px]">Role</th>
                  <th className="text-left px-4 md:px-6 py-5 font-black text-muted uppercase tracking-widest text-[10px] max-md:text-white/40">Status</th>
                  <th className="text-left px-4 md:px-6 py-5 font-black text-white/0 uppercase tracking-widest text-[10px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border max-md:divide-white/5">
                {filteredReferrals.map((referral) => {
                  const isVerified = referral.status === 'yes';
                  const initials = referral.referrerName?.charAt(0)?.toUpperCase() ?? '?';
                  const formattedDate = referral.createdAt
                    ? new Date(referral.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    : 'N/A';

                  return (
                    <tr
                      key={referral.id}
                      className="hover:bg-accent/[0.02] cursor-pointer transition-colors group max-md:hover:bg-white/[0.02]"
                    >
                      {/* Candidate */}
                      <td className="px-4 md:px-6 py-5">
                        <div className="font-black text-primary-text group-hover:text-accent transition-colors leading-none max-md:text-white max-md:group-hover:text-emerald-400">
                          {referral.candidateName}
                        </div>
                        {referral.candidateRole && (
                          <div className="mt-1.5">
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-accent/8 text-accent border border-accent/15 max-md:bg-emerald-500/10 max-md:text-emerald-400 max-md:border-emerald-500/10">
                              {referral.candidateRole}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="hidden md:table-cell px-6 py-5">
                        {referral.candidateMobile && (
                          <div className="flex items-center gap-1.5 text-[11px] text-primary-text font-bold">
                            <Phone className="w-3 h-3 text-muted" />
                            {referral.candidateMobile}
                          </div>
                        )}
                        {referral.referredPersonRole && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted font-semibold mt-1">
                            <Briefcase className="w-3 h-3" />
                            {referral.referredPersonRole}
                          </div>
                        )}
                      </td>

                      {/* Referred By */}
                      <td className="px-4 md:px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20 flex-shrink-0 max-md:bg-emerald-500/10 max-md:border-emerald-500/20">
                            <span className="text-[10px] font-black text-accent max-md:text-emerald-400">{initials}</span>
                          </div>
                          <div>
                            <div className="text-xs font-black text-primary-text uppercase max-md:text-white/70">
                              {referral.referrerName}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted font-bold mt-0.5 max-md:text-white/30">
                              <Calendar className="w-3 h-3" />
                              {formattedDate}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Referrer Role */}
                      <td className="hidden md:table-cell px-6 py-5">
                        <div className="flex flex-col gap-1.5">
                          {referral.referrerRole && (
                            <span className="inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-page border border-border text-muted">
                              {referral.referrerRole}
                            </span>
                          )}
                          {referral.isParadigmEmployee && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-blue-50 border border-blue-100 text-blue-600">
                              <ShieldCheck className="w-3 h-3" />
                              Employee
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 md:px-6 py-5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${
                          isVerified
                            ? 'bg-emerald-50 border border-emerald-100 text-emerald-700 max-md:bg-emerald-500/10 max-md:border-emerald-500/10 max-md:text-emerald-400'
                            : 'bg-page border border-border text-muted max-md:bg-white/5 max-md:border-white/5 max-md:text-white/30'
                        }`}>
                          {isVerified
                            ? <CheckCircle2 className="w-3 h-3" />
                            : <Clock className="w-3 h-3" />
                          }
                          {referral.status?.toUpperCase() || 'PENDING'}
                        </span>
                      </td>

                      {/* Arrow */}
                      <td className="px-4 md:px-6 py-5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-page group-hover:bg-accent group-hover:text-white transition-all max-md:bg-white/5 max-md:group-hover:bg-emerald-500 max-md:group-hover:text-[#041b0f]">
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

// ─── Referral Card (Grid View) ────────────────────────────────────────────────
const ReferralCard: React.FC<{ referral: any; index: number }> = ({ referral, index }) => {
  const isVerified = referral.status === 'yes';
  const initials = referral.referrerName?.charAt(0)?.toUpperCase() ?? '?';
  const formattedDate = referral.createdAt
    ? new Date(referral.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : 'N/A';

  return (
    <div
      className="group bg-white rounded-[2rem] md:rounded-3xl border border-border p-5 md:p-6 hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden max-md:bg-white/[0.03] max-md:backdrop-blur-xl max-md:border-white/5 max-md:shadow-2xl"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Left accent bar */}
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-accent via-accent/70 to-transparent rounded-l-[2rem]" />

      {/* Card Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="space-y-1.5">
          <h3 className="text-base font-black tracking-tight text-primary-text group-hover:text-accent transition-colors uppercase max-md:text-white max-md:group-hover:text-emerald-400">
            {referral.candidateName}
          </h3>
          {referral.candidateRole && (
            <span className="inline-block px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-accent/8 text-accent border border-accent/15 max-md:bg-emerald-500/10 max-md:text-emerald-400 max-md:border-emerald-500/10">
              {referral.candidateRole}
            </span>
          )}
        </div>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-page border border-border group-hover:bg-accent group-hover:border-accent transition-all max-md:bg-white/5 max-md:border-white/5 max-md:group-hover:bg-emerald-500">
          <UserPlus className="h-5 w-5 text-muted group-hover:text-white transition-colors" />
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-2.5 mb-5">
        {referral.candidateMobile && (
          <div className="flex items-center gap-2.5">
            <Phone className="h-4 w-4 text-muted/60 flex-shrink-0 max-md:text-white/20" />
            <span className="text-sm font-bold text-primary-text max-md:text-white/70">
              {referral.candidateMobile}
            </span>
          </div>
        )}
        {referral.referredPersonRole && (
          <div className="flex items-center gap-2.5">
            <Briefcase className="h-4 w-4 text-muted/60 flex-shrink-0 max-md:text-white/20" />
            <span className="text-sm font-bold text-primary-text max-md:text-white/70">
              {referral.referredPersonRole}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border max-md:border-white/5 space-y-3 pt-4">
        {/* Referrer Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20 max-md:bg-emerald-500/10 max-md:border-emerald-500/20">
              <span className="text-[11px] font-black text-accent max-md:text-emerald-400">{initials}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-tighter text-muted max-md:text-white/30">Referred By</span>
              <span className="text-xs font-black uppercase text-primary-text max-md:text-white/70">{referral.referrerName}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-muted max-md:text-white/30">
            <Calendar className="h-3 w-3" />
            <span className="text-[10px] font-black uppercase">{formattedDate}</span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {referral.referrerRole && (
            <span className="text-[9px] font-black uppercase py-1.5 px-3 rounded-xl bg-page border border-border text-muted max-md:bg-white/5 max-md:border-white/5 max-md:text-white/40">
              {referral.referrerRole}
            </span>
          )}
          {referral.isParadigmEmployee && (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase py-1.5 px-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 max-md:bg-blue-500/10 max-md:border-blue-500/10 max-md:text-blue-400">
              <ShieldCheck className="h-3 w-3" />
              Employee
            </span>
          )}
        </div>

        {/* Status */}
        <div className={`flex items-center justify-between text-[9px] font-black uppercase py-2 px-3 rounded-xl ${
          isVerified
            ? 'bg-emerald-50 border border-emerald-100 text-emerald-700 max-md:bg-emerald-500/10 max-md:border-emerald-500/10 max-md:text-emerald-400'
            : 'bg-page border border-border text-muted max-md:bg-white/5 max-md:border-white/5 max-md:text-white/30'
        }`}>
          <span>System Status</span>
          <span className="flex items-center gap-1">
            {isVerified ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {referral.status?.toUpperCase() || 'PENDING'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReferralManagement;
