import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, ArrowLeft, UserPlus,
  Phone, Briefcase, CheckCircle2, LayoutGrid, List,
  ShieldCheck, RefreshCw, Calendar, Clock, ChevronRight, Trash2,
  Building, Layers, X, ExternalLink, Mail, Check, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import StageBadge from '../../components/hr/StageBadge';
import MobileTopBar from '../../components/navigation/MobileTopBar';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import { isAdmin } from '../../utils/auth';

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
      {React.cloneElement(icon as React.ReactElement, { className: 'w-16 h-16' } as any)}
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
  const { user } = useAuthStore();
  const { permissions } = usePermissionsStore();

  const userPermissions = React.useMemo(() => {
    if (!user || !permissions) return [];
    const roleId = user.roleId?.toLowerCase() || '';
    const roleName = user.role?.toLowerCase() || '';
    const roleNameUnderscore = roleName.replace(/\s+/g, '_');
    const roleNameHyphen = roleName.replace(/\s+/g, '-');
    const directPerms = (user as any).permissions || [];

    const found = permissions[user.roleId] || 
           permissions[roleId] || 
           permissions[user.role] || 
           permissions[roleName] || 
           permissions[roleNameUnderscore] || 
           permissions[roleNameHyphen] || 
           [];

    return [...new Set([...found, ...directPerms])];
  }, [user, permissions]);

  const isUserAdmin = user?.role ? isAdmin(user.role) : false;

  // Determine permissions for Candidate and Business referral tabs
  const canViewCandidates = isUserAdmin || 
    userPermissions.includes('view_candidate_referrals') || 
    (userPermissions.includes('view_referrals') && !userPermissions.includes('view_business_referrals'));

  const canViewBusiness = isUserAdmin || 
    userPermissions.includes('view_business_referrals') || 
    (userPermissions.includes('view_referrals') && !userPermissions.includes('view_candidate_referrals'));

  const availableTabs = React.useMemo(() => {
    const tabs: { id: 'candidate' | 'business'; label: string }[] = [];
    if (canViewCandidates) tabs.push({ id: 'candidate', label: 'Candidates' });
    if (canViewBusiness) tabs.push({ id: 'business', label: 'Business' });
    return tabs;
  }, [canViewCandidates, canViewBusiness]);

  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [referralType, setReferralType] = useState<'candidate' | 'business'>(() => {
    if (!canViewCandidates && canViewBusiness) return 'business';
    return 'candidate';
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Keep referralType in sync with permitted tabs
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(t => t.id === referralType)) {
      setReferralType(availableTabs[0].id);
    }
  }, [availableTabs, referralType]);

  // Modals & action states
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchReferrals = async () => {
    if (availableTabs.length === 0) {
      setLoading(false);
      setReferrals([]);
      return;
    }
    setLoading(true);
    try {
      const data = referralType === 'candidate' 
        ? (canViewCandidates ? await api.getCandidateReferrals() : []) 
        : (canViewBusiness ? await api.getBusinessReferrals() : []);
      setReferrals(data || []);
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
      toast.error('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, [referralType, availableTabs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReferrals();
    setRefreshing(false);
  };

  const filteredReferrals = referrals.filter(ref => {
    const searchLower = searchTerm.toLowerCase();
    if (referralType === 'candidate') {
      return (
        ref.candidateName?.toLowerCase().includes(searchLower) ||
        ref.referrerName?.toLowerCase().includes(searchLower) ||
        ref.candidateRole?.toLowerCase().includes(searchLower)
      );
    } else {
      return (
        ref.communityName?.toLowerCase().includes(searchLower) ||
        ref.companyName?.toLowerCase().includes(searchLower) ||
        ref.contactPersonName?.toLowerCase().includes(searchLower) ||
        ref.referrerName?.toLowerCase().includes(searchLower)
      );
    }
  });

  const totalCount = referrals.length;
  const employeeRefs = referrals.filter(r => r.isParadigmEmployee).length;
  const verifiedCount = referrals.filter(r => r.status === 'yes').length;

  const handleRowClick = (referral: any) => {
    if (referralType === 'candidate') {
      navigate(`/hrm/candidate/${referral.id}`);
    } else {
      setSelectedBusiness(referral);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (referralType === 'candidate') {
        await api.deleteCandidateReferral(deleteTarget.id);
      } else {
        await api.deleteBusinessReferral(deleteTarget.id);
      }
      toast.success('Referral deleted successfully');
      if (selectedBusiness?.id === deleteTarget.id) {
        setSelectedBusiness(null);
      }
      setDeleteTarget(null);
      await fetchReferrals();
    } catch (error: any) {
      console.error('Failed to delete referral:', error);
      toast.error(error?.message || 'Failed to delete referral');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateBusinessStatus = async (id: string, newStatus: string) => {
    setStatusUpdating(true);
    try {
      await api.updateBusinessReferralStatus(id, newStatus);
      toast.success(`Status updated to ${newStatus === 'yes' ? 'VERIFIED' : 'PENDING'}`);
      if (selectedBusiness && selectedBusiness.id === id) {
        setSelectedBusiness({ ...selectedBusiness, status: newStatus });
      }
      await fetchReferrals();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-32 md:pb-8 min-w-0 overflow-x-hidden">
      <MobileTopBar title="REFERRALS" parentPath="/mobile-home" />

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 w-full mb-4">
        {/* Back Navigation Link (Desktop Only) */}
        <button 
          onClick={() => navigate('/crm')} 
          className="hidden md:flex items-center gap-1.5 text-xs text-white/50 md:text-muted hover:text-emerald-400 md:hover:text-accent transition-colors mb-1.5 w-fit group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to CRM Pipeline</span>
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-white md:text-primary-text tracking-tight truncate">
              Referral Management
            </h1>
            <p className="text-xs md:text-sm text-muted mt-1 font-semibold uppercase tracking-wider text-emerald-400/60 md:text-muted">
              {referralType === 'candidate' ? 'Employee Candidate Submissions' : 'Strategic Business Opportunities'}
            </p>
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
      </div>

      {/* Tabs Row */}
      {availableTabs.length > 0 ? (
        <div className="mb-6 border-b border-white/5 md:border-border">
          <nav className="-mb-px flex space-x-6 overflow-x-auto no-scrollbar scroll-smooth snap-x" aria-label="Tabs">
            {availableTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setReferralType(tab.id)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors snap-start min-w-max ${
                  referralType === tab.id
                    ? 'border-emerald-400 text-emerald-400 md:border-accent md:text-accent-dark'
                    : 'border-transparent text-white/30 md:text-muted hover:text-white md:hover:text-accent-dark md:hover:border-accent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      ) : (
        <div className="mb-6 p-10 rounded-3xl bg-white dark:bg-white/[0.03] border border-border dark:border-white/5 text-center shadow-sm">
          <ShieldCheck className="w-12 h-12 text-muted/30 mx-auto mb-3" />
          <h3 className="text-base font-bold text-primary-text dark:text-white">Access Restricted</h3>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            You do not currently have permission to access Candidate or Business referrals. Contact your administrator to enable access.
          </p>
        </div>
      )}

      {availableTabs.length > 0 && (
        <>
          {/* ── Stats Row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 md:gap-5">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total" value={totalCount} color="#006b3f" sub="All referrals" />
        <StatCard icon={<ShieldCheck className="w-5 h-5" />} label="Employees" value={employeeRefs} color="#3b82f6" sub="AP Group staff" />
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
            <ReferralCard 
              key={referral.id} 
              referral={referral} 
              index={idx} 
              type={referralType}
              onSelect={() => handleRowClick(referral)}
              onDelete={(id) => setDeleteTarget({ 
                id, 
                name: referralType === 'candidate' ? (referral.candidateName || 'Candidate') : (referral.communityName || 'Business Lead') 
              })}
            />
          ))}
        </div>
      ) : (
        /* ── List View ── */
        <div className="bg-white rounded-[2.5rem] md:rounded-3xl border border-border overflow-hidden shadow-sm max-md:bg-[#0d2c18]/40 max-md:border-white/5 max-md:shadow-2xl pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-page max-md:bg-white/5 max-md:border-white/5">
                  <th className="text-left px-4 md:px-6 py-5 font-black text-muted uppercase tracking-widest text-[10px] max-md:text-white/40">
                    {referralType === 'candidate' ? 'Candidate' : 'Community / Business'}
                  </th>
                  <th className="hidden md:table-cell text-left px-6 py-5 font-black text-muted uppercase tracking-widest text-[10px]">
                    {referralType === 'candidate' ? 'Contact' : 'Client Contact'}
                  </th>
                  <th className="text-left px-4 md:px-6 py-5 font-black text-muted uppercase tracking-widest text-[10px] max-md:text-white/40">Referred By</th>
                  <th className="hidden md:table-cell text-left px-6 py-5 font-black text-muted uppercase tracking-widest text-[10px]">
                    {referralType === 'candidate' ? 'Role' : 'Service Type'}
                  </th>
                  <th className="text-left px-4 md:px-6 py-5 font-black text-muted uppercase tracking-widest text-[10px] max-md:text-white/40">Status</th>
                  <th className="text-right px-4 md:px-6 py-5 font-black text-muted uppercase tracking-widest text-[10px] max-md:text-white/40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border max-md:divide-white/5">
                {filteredReferrals.map((referral) => {
                  const isVerified = referral.status === 'yes';
                  const initials = referral.referrerName?.charAt(0)?.toUpperCase() ?? '?';
                  const formattedDate = referral.createdAt
                    ? new Date(referral.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    : 'N/A';
                  const displayName = referralType === 'candidate' ? referral.candidateName : (referral.communityName || referral.companyName);

                  return (
                    <tr
                      key={referral.id}
                      onClick={() => handleRowClick(referral)}
                      className="hover:bg-accent/[0.04] cursor-pointer transition-colors group max-md:hover:bg-white/[0.02]"
                    >
                      {/* Candidate / Business */}
                      <td className="px-4 md:px-6 py-5">
                        <div className="font-black text-primary-text group-hover:text-accent transition-colors leading-none max-md:text-white max-md:group-hover:text-emerald-400">
                          {displayName}
                        </div>
                        {(referral.candidateRole || referral.communityNature) && (
                          <div className="mt-1.5">
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-accent/8 text-accent border border-accent/15 max-md:bg-emerald-500/10 max-md:text-emerald-400 max-md:border-emerald-500/10">
                              {referralType === 'candidate' ? referral.candidateRole : referral.communityNature}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="hidden md:table-cell px-6 py-5">
                        {(referral.candidateMobile || referral.clientPhone || referral.contactMobile) && (
                          <div className="flex items-center gap-1.5 text-[11px] text-primary-text font-bold">
                            <Phone className="w-3 h-3 text-muted" />
                            {referralType === 'candidate' ? referral.candidateMobile : (referral.clientPhone || referral.contactMobile)}
                          </div>
                        )}
                        {(referral.referredPersonRole || referral.contactPersonName || referral.contactPerson) && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted font-semibold mt-1">
                            <Briefcase className="w-3 h-3" />
                            {referralType === 'candidate' ? referral.referredPersonRole : (referral.contactPersonName || referral.contactPerson)}
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

                      {/* Referrer Role / Service */}
                      <td className="hidden md:table-cell px-6 py-5">
                        <div className="flex flex-col gap-1.5">
                          {(referral.referrerRole || referral.serviceInterested || referral.serviceRequired) && (
                            <span className="inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-page border border-border text-muted truncate max-w-[150px]" title={referralType === 'candidate' ? referral.referrerRole : (referral.serviceInterested || referral.serviceRequired)}>
                              {referralType === 'candidate' ? referral.referrerRole : (referral.serviceInterested || referral.serviceRequired)}
                            </span>
                          )}
                          {referral.isParadigmEmployee && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-blue-50 border border-blue-100 text-blue-600">
                              <ShieldCheck className="w-3 h-3" />
                              AP Group Employee
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 md:px-6 py-5">
                        <div className="flex flex-col gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter w-fit ${
                            isVerified
                              ? 'bg-emerald-50 border border-emerald-100 text-emerald-700 max-md:bg-emerald-500/10 max-md:border-emerald-500/10 max-md:text-emerald-400'
                              : 'bg-page border border-border text-muted max-md:bg-white/5 max-md:border-white/5 max-md:text-white/30'
                          }`}>
                            {isVerified
                              ? <CheckCircle2 className="w-3 h-3" />
                              : <Clock className="w-3 h-3" />
                            }
                            {isVerified ? 'VERIFIED' : (referral.status?.toUpperCase() || 'PENDING')}
                          </span>
                          {referralType === 'candidate' && (
                            <StageBadge stage={referral.currentStage || referral.current_stage || 'new'} />
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 md:px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ id: referral.id, name: displayName });
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-page text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xs border border-transparent hover:border-red-600 max-md:bg-white/5 active:scale-95"
                            title="Delete Referral"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(referral);
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-page text-muted hover:bg-accent hover:text-white transition-all border border-border/50 hover:border-accent max-md:bg-white/5 max-md:hover:bg-emerald-500 max-md:hover:text-[#041b0f] active:scale-95"
                            title={referralType === 'candidate' ? 'View Candidate Details' : 'View Business Referral Details'}
                          >
                            <ChevronRight className="w-4 h-4" />
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
      </>
      )}

      {/* ── Business Referral Detail Modal ── */}
      {selectedBusiness && (
        <BusinessDetailModal
          business={selectedBusiness}
          statusUpdating={statusUpdating}
          onClose={() => setSelectedBusiness(null)}
          onUpdateStatus={(newStatus) => handleUpdateBusinessStatus(selectedBusiness.id, newStatus)}
          onDelete={() => setDeleteTarget({ 
            id: selectedBusiness.id, 
            name: selectedBusiness.communityName || selectedBusiness.companyName || 'Business Lead' 
          })}
          onNavigateCrm={() => navigate('/crm')}
        />
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteTarget && (
        <DeleteConfirmModal
          targetName={deleteTarget.name}
          isDeleting={isDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

// ─── Referral Card (Grid View) ────────────────────────────────────────────────
const ReferralCard: React.FC<{ 
  referral: any; 
  index: number; 
  type: 'candidate' | 'business'; 
  onSelect: () => void;
  onDelete: (id: string) => void;
}> = ({ referral, index, type, onSelect, onDelete }) => {
  const isVerified = referral.status === 'yes';
  const initials = referral.referrerName?.charAt(0)?.toUpperCase() ?? '?';
  const formattedDate = referral.createdAt
    ? new Date(referral.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : 'N/A';

  const displayName = type === 'candidate' ? referral.candidateName : (referral.communityName || referral.companyName);

  return (
    <div
      onClick={onSelect}
      className="group bg-white rounded-[2rem] md:rounded-3xl border border-border p-5 md:p-6 hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden cursor-pointer max-md:bg-white/[0.03] max-md:backdrop-blur-xl max-md:border-white/5 max-md:shadow-2xl"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Left accent bar */}
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-accent via-accent/70 to-transparent rounded-l-[2rem]" />

      {/* Card Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="space-y-1.5 min-w-0 pr-2">
          <h3 className="text-base font-black tracking-tight text-primary-text group-hover:text-accent transition-colors uppercase truncate max-md:text-white max-md:group-hover:text-emerald-400">
            {displayName}
          </h3>
          {(referral.candidateRole || referral.communityNature) && (
            <span className="inline-block px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-accent/8 text-accent border border-accent/15 max-md:bg-emerald-500/10 max-md:text-emerald-400 max-md:border-emerald-500/10">
              {type === 'candidate' ? referral.candidateRole : referral.communityNature}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(referral.id);
            }}
            className="p-2 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors max-md:hover:bg-white/10"
            title="Delete Referral"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div 
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-page border border-border group-hover:bg-accent group-hover:border-accent group-hover:text-white transition-all max-md:bg-white/5 max-md:border-white/5 max-md:group-hover:bg-emerald-500"
            title={type === 'candidate' ? 'View Candidate' : 'View Business Details'}
          >
            {type === 'candidate' ? (
              <UserPlus className="h-4 w-4 text-muted group-hover:text-white transition-colors" />
            ) : (
              <Building className="h-4 w-4 text-muted group-hover:text-white transition-colors" />
            )}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-2.5 mb-5">
        {(referral.candidateMobile || referral.clientPhone || referral.contactMobile) && (
          <div className="flex items-center gap-2.5">
            <Phone className="h-4 w-4 text-muted/60 flex-shrink-0 max-md:text-white/20" />
            <span className="text-sm font-bold text-primary-text max-md:text-white/70">
              {type === 'candidate' ? referral.candidateMobile : (referral.clientPhone || referral.contactMobile)}
            </span>
          </div>
        )}
        {(referral.referredPersonRole || referral.contactPersonName || referral.contactPerson) && (
          <div className="flex items-center gap-2.5">
            <Briefcase className="h-4 w-4 text-muted/60 flex-shrink-0 max-md:text-white/20" />
            <span className="text-sm font-bold text-primary-text max-md:text-white/70">
              {type === 'candidate' ? referral.referredPersonRole : (referral.contactPersonName || referral.contactPerson)}
            </span>
          </div>
        )}
        {type === 'business' && (referral.serviceInterested || referral.serviceRequired) && (
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-muted/60 flex-shrink-0 max-md:text-white/20" />
            <span className="text-xs font-bold text-primary-text/60 max-md:text-white/40 truncate">
              {referral.serviceInterested || referral.serviceRequired}
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
          {referral.isParadigmEmployee && (
            <div className="w-full space-y-2 mt-1">
              <span className="flex items-center gap-1 text-[9px] font-black uppercase py-1.5 px-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 max-md:bg-blue-500/10 max-md:border-blue-500/10 max-md:text-blue-400">
                <ShieldCheck className="h-3 w-3" />
                AP Group Employee
              </span>
              <div className="flex items-center gap-2 px-1">
                {referral.employeeId && (
                  <span className="text-[9px] font-black text-muted uppercase tracking-widest max-md:text-white/40">
                    ID: {referral.employeeId}
                  </span>
                )}
                {referral.siteLocation && (
                  <span className="text-[9px] font-black text-muted uppercase tracking-widest truncate max-md:text-white/40">
                    • {referral.siteLocation}
                  </span>
                )}
              </div>
            </div>
          )}
          {!referral.isParadigmEmployee && referral.referrerRole && (
            <span className="text-[9px] font-black uppercase py-1.5 px-3 rounded-xl bg-page border border-border text-muted max-md:bg-white/5 max-md:border-white/5 max-md:text-white/40">
              {referral.referrerRole}
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
            {isVerified ? 'VERIFIED' : (referral.status?.toUpperCase() || 'PENDING')}
          </span>
        </div>

        {type === 'candidate' && (
          <div className="flex items-center justify-between text-[9px] font-black uppercase py-2 px-3 rounded-xl bg-slate-50 border border-border">
            <span>Recruitment Stage</span>
            <StageBadge stage={referral.currentStage || referral.current_stage || 'new'} />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Business Referral Detail Modal ──────────────────────────────────────────
interface BusinessDetailModalProps {
  business: any;
  statusUpdating: boolean;
  onClose: () => void;
  onUpdateStatus: (newStatus: string) => void;
  onDelete: () => void;
  onNavigateCrm: () => void;
}

const BusinessDetailModal: React.FC<BusinessDetailModalProps> = ({
  business,
  statusUpdating,
  onClose,
  onUpdateStatus,
  onDelete,
  onNavigateCrm
}) => {
  const isVerified = business.status === 'yes';
  const formattedDate = business.createdAt
    ? new Date(business.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';
  const name = business.communityName || business.companyName || 'Business Opportunity';
  const contactPerson = business.contactPersonName || business.contactPerson || 'N/A';
  const contactPhone = business.clientPhone || business.contactMobile || 'N/A';
  const contactEmail = business.clientEmail || 'N/A';
  const designation = business.contactPersonDesignation || business.clientDesignation || 'N/A';
  const service = business.serviceInterested || business.serviceRequired || 'General Facilities Management';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div 
        className="bg-white rounded-3xl border border-border shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border bg-page">
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex-shrink-0">
              <Building className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-primary-text uppercase tracking-tight truncate">
                  {name}
                </h2>
                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-0.5 rounded-md border ${
                  isVerified
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isVerified ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {isVerified ? 'VERIFIED' : 'PENDING'}
                </span>
              </div>
              <p className="text-xs text-muted font-bold mt-1">
                Submitted on {formattedDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-muted hover:text-primary-text hover:bg-black/5 transition-all flex-shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Section 1: Business / Property Details */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-600" />
              Property & Service Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-page p-4 rounded-2xl border border-border">
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-wider">Community Nature</span>
                <p className="text-sm font-bold text-primary-text mt-0.5">{business.communityNature || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-wider">Total Units / Area</span>
                <p className="text-sm font-bold text-primary-text mt-0.5">{business.totalUnits ? `${business.totalUnits} Units` : 'N/A'}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-black uppercase text-muted tracking-wider">Interested Service</span>
                <p className="text-sm font-bold text-emerald-700 mt-0.5">{service}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Client Contact */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-600" />
              Client Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-page p-4 rounded-2xl border border-border">
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-wider">Contact Person</span>
                <p className="text-sm font-bold text-primary-text mt-0.5">{contactPerson}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-wider">Designation</span>
                <p className="text-sm font-bold text-primary-text mt-0.5">{designation}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-wider">Phone / Mobile</span>
                {contactPhone !== 'N/A' ? (
                  <a href={`tel:${contactPhone}`} className="text-sm font-bold text-emerald-600 hover:underline flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5" />
                    {contactPhone}
                  </a>
                ) : (
                  <p className="text-sm font-bold text-muted mt-0.5">N/A</p>
                )}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-wider">Email</span>
                {contactEmail !== 'N/A' ? (
                  <a href={`mailto:${contactEmail}`} className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1 mt-0.5 truncate">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{contactEmail}</span>
                  </a>
                ) : (
                  <p className="text-sm font-bold text-muted mt-0.5">N/A</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Referrer Information */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Referrer Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-page p-4 rounded-2xl border border-border">
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-wider">Referrer Name</span>
                <p className="text-sm font-bold text-primary-text mt-0.5">{business.referrerName || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-wider">Referrer Mobile</span>
                {business.referrerMobile ? (
                  <a href={`tel:${business.referrerMobile}`} className="text-sm font-bold text-emerald-600 hover:underline flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5" />
                    {business.referrerMobile}
                  </a>
                ) : (
                  <p className="text-sm font-bold text-muted mt-0.5">N/A</p>
                )}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-wider">Role / Designation</span>
                <p className="text-sm font-bold text-primary-text mt-0.5">{business.referrerRole || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-wider">Staff Affiliation</span>
                <p className="text-sm font-bold text-primary-text mt-0.5">
                  {business.isParadigmEmployee ? 'AP Group Employee' : 'External / Partner'}
                </p>
              </div>
              {business.employeeId && (
                <div>
                  <span className="text-[10px] font-black uppercase text-muted tracking-wider">Employee ID</span>
                  <p className="text-sm font-bold text-primary-text mt-0.5">{business.employeeId}</p>
                </div>
              )}
              {business.siteLocation && (
                <div>
                  <span className="text-[10px] font-black uppercase text-muted tracking-wider">Site Location</span>
                  <p className="text-sm font-bold text-primary-text mt-0.5">{business.siteLocation}</p>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Remarks / Notes */}
          {business.remarks && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-muted mb-2">Remarks & Notes</h3>
              <div className="bg-amber-50/60 border border-amber-200/60 p-3.5 rounded-2xl">
                <p className="text-xs font-semibold text-slate-700 whitespace-pre-line">{business.remarks}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border bg-page flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDelete}
              className="btn btn-secondary text-red-600 hover:bg-red-50 border-red-200 gap-1.5 text-xs font-bold py-2 px-3.5 rounded-xl"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Lead</span>
            </button>
            <button
              type="button"
              onClick={onNavigateCrm}
              className="btn btn-secondary gap-1.5 text-xs font-bold py-2 px-3.5 rounded-xl text-primary-text"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open CRM Pipeline</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={statusUpdating}
              onClick={() => onUpdateStatus(isVerified ? 'pending' : 'yes')}
              className={`btn gap-2 text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-md ${
                isVerified
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
            >
              {statusUpdating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : isVerified ? (
                <Clock className="w-3.5 h-3.5" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{isVerified ? 'Mark as Pending' : 'Verify Opportunity'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirmation Modal ────────────────────────────────────────────────
interface DeleteConfirmModalProps {
  targetName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  targetName,
  isDeleting,
  onConfirm,
  onCancel
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white rounded-3xl border border-border shadow-2xl w-full max-w-md p-6 animate-scale-up space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-primary-text tracking-tight">Delete Referral?</h3>
            <p className="text-xs text-muted font-semibold mt-0.5">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-sm font-medium text-slate-600 leading-relaxed bg-page p-3.5 rounded-2xl border border-border">
          Are you sure you want to delete <span className="font-black text-primary-text uppercase">"{targetName}"</span> from the system?
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="btn btn-secondary text-xs font-bold py-2.5 px-4 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="btn bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-red-500/20 gap-2 active:scale-95 disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferralManagement;
