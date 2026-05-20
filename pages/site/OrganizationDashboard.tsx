import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../services/api';
import type { OnboardingData } from '../../types';
import StatusChip from '../../components/ui/StatusChip';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Search, Eye, FileText, UserPlus } from 'lucide-react';
import PortalSyncStatusChip from '../../components/ui/PortalSyncStatusChip';
import Toast from '../../components/ui/Toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { isAdmin } from '../../utils/auth';
import LoadingScreen from '../../components/ui/LoadingScreen';

// Shared dashboard components
import { useRoleSiteAccess } from '../../hooks/useRoleSiteAccess';
import { useDashboardData } from '../../hooks/useDashboardData';
import DashboardHeader from '../../components/dashboard/DashboardHeader';
import DashboardKpiCards from '../../components/dashboard/DashboardKpiCards';
import AttendanceTrendChart from '../../components/dashboard/AttendanceTrendChart';
import DesignationBreakdownChart from '../../components/dashboard/DesignationBreakdownChart';
import BillingSummaryPanel from '../../components/dashboard/BillingSummaryPanel';
import PendingLeavesPanel from '../../components/dashboard/PendingLeavesPanel';
import SiteTrendPanel from '../../components/dashboard/SiteTrendPanel';
import { BarChart3 } from 'lucide-react';


const SiteDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const isMobile = useMediaQuery('(max-width: 767px)');

    // ── Role-Based Site Access ──────────────────────────────────────────
    const { allowedSites, canSelectSite, defaultSiteId, isLoading: sitesLoading } = useRoleSiteAccess();
    const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(undefined);

    // Set default site once resolved
    useEffect(() => {
        if (defaultSiteId && !selectedSiteId) {
            setSelectedSiteId(defaultSiteId);
        }
    }, [defaultSiteId]);

    // ── Dashboard Data (shared hook) ────────────────────────────────────
    const dashboard = useDashboardData(allowedSites, selectedSiteId);

    // ── Active site name resolution ─────────────────────────────────────
    const activeSiteName = useMemo(() => {
        if (!selectedSiteId || selectedSiteId === 'all') return 'All Sites';
        const found = allowedSites.find(s => s.id === selectedSiteId);
        return found ? found.name : user?.organizationName || 'N/A';
    }, [allowedSites, selectedSiteId, user]);

    // ── Onboarding Submissions (existing feature) ───────────────────────
    const [submissions, setSubmissions] = useState<OnboardingData[]>([]);
    const [submissionsLoading, setSubmissionsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchSubmissions = useCallback(async () => {
        if (!selectedSiteId || selectedSiteId === 'all') {
            setSubmissions([]);
            return;
        }
        setSubmissionsLoading(true);
        try {
            const isSuperAdmin = ['admin', 'super_admin'].includes(user?.role || '');
            const data = await api.getVerificationSubmissions(
                statusFilter === 'all' ? undefined : statusFilter,
                selectedSiteId,
                isSuperAdmin ? undefined : user?.id
            );
            setSubmissions(data);
        } catch (error) {
            console.error("Failed to fetch submissions", error);
        } finally {
            setSubmissionsLoading(false);
        }
    }, [statusFilter, selectedSiteId, user?.role, user?.id]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const filteredSubmissions = useMemo(() => {
        return submissions.filter(s => {
            const firstName = s.personal?.firstName || '';
            const lastName = s.personal?.lastName || '';
            const employeeId = s.personal?.employeeId || '';
            const term = searchTerm.toLowerCase();
            return firstName.toLowerCase().includes(term) ||
                   lastName.toLowerCase().includes(term) ||
                   employeeId.toLowerCase().includes(term);
        });
    }, [submissions, searchTerm]);

    const filterTabs = ['all', 'pending', 'verified', 'rejected'];

    // ── Loading State ───────────────────────────────────────────────────
    if (sitesLoading || (dashboard.isLoading && !selectedSiteId)) {
        return <LoadingScreen message="Loading site dashboard..." />;
    }

    return (
        <div className="p-4 md:p-6 bg-slate-50 min-h-screen space-y-6">
            {dashboard.toast && (
                <Toast
                    message={dashboard.toast.message}
                    type={dashboard.toast.type === 'error' ? 'error' : 'success'}
                    onDismiss={() => dashboard.setToast(null)}
                />
            )}

            {/* ── Dashboard Header ─────────────────────────────────────── */}
            <DashboardHeader
                title="Site Dashboard"
                activeSiteName={activeSiteName}
                sites={allowedSites}
                selectedSiteId={selectedSiteId}
                onSiteChange={setSelectedSiteId}
                canSelectSite={canSelectSite}
                startDate={dashboard.startDate}
                endDate={dashboard.endDate}
                onStartDateChange={dashboard.setStartDate}
                onEndDateChange={dashboard.setEndDate}
                onRefresh={dashboard.fetchDashboardData}
                isLoading={dashboard.isLoading}
            />

            {/* ── KPI Cards ────────────────────────────────────────────── */}
            <DashboardKpiCards
                todayMetrics={dashboard.todayMetrics}
                pendingLeaves={dashboard.leaveRequests.length}
                approvedLeaves={dashboard.approvedLeavesCount}
            />

            {/* ── Charts Row ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Attendance Trend (3/5) */}
                <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                        <BarChart3 className="h-5 w-5 text-[#006B3F]" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                            Attendance Trend
                        </h3>
                    </div>
                    <AttendanceTrendChart data={dashboard.weeklyData} />
                </div>

                {/* Designation Breakdown (2/5) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                    <h3 className="text-[15px] font-bold text-slate-800 pb-4 mb-4">
                        Attendance by Department
                    </h3>
                    <div className="flex items-center justify-center min-h-[140px]">
                        <DesignationBreakdownChart data={dashboard.designationBreakdown} />
                    </div>
                </div>
            </div>

            {/* ── Billing Summary ──────────────────────────────────────── */}
            <BillingSummaryPanel
                billing={dashboard.billingSummary}
                siteUsersCount={dashboard.siteUsers.length}
            />

            {/* ── Site Trend (visible when 'All Sites' selected) ──────── */}
            {selectedSiteId === 'all' && (
                <SiteTrendPanel data={dashboard.siteTrendData} />
            )}

            {/* ── Pending Leaves ───────────────────────────────────────── */}
            <PendingLeavesPanel
                leaves={dashboard.leaveRequests}
                siteUsers={dashboard.siteUsers}
            />

            {/* ── Onboarding Submissions Table (existing feature) ──────── */}
            {selectedSiteId && selectedSiteId !== 'all' && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                        <div>
                            <h3 className="text-base font-semibold text-slate-800">Onboarding Submissions</h3>
                            <p className="text-sm text-slate-500">Enrollment records for <span className="font-semibold text-emerald-700">{activeSiteName}</span></p>
                        </div>
                        <Button
                            onClick={() => navigate('/onboarding/select-organization')}
                            style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }}
                            className="border hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                            <UserPlus className="mr-2 h-4 w-4" />New Enrollment
                        </Button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <div className="w-full sm:w-auto border-b border-border">
                            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                                {filterTabs.map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setStatusFilter(tab)}
                                        className={`${statusFilter === tab
                                            ? 'border-emerald-500 text-emerald-700'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm capitalize transition-colors duration-200`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="relative w-full sm:w-auto sm:max-w-xs">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="site-search"
                                name="siteSearch"
                                type="text"
                                placeholder="Search by name or ID..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="block w-full !pl-10 pr-3 py-2 border border-border rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-accent focus:border-accent sm:text-sm"
                            />
                        </div>
                    </div>

                    {/* Submissions Table */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full responsive-table">
                            <thead className="bg-page">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Employee</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Portal Sync</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissionsLoading ? (
                                    <tr><td colSpan={4} className="text-center py-10 text-muted">Loading submissions...</td></tr>
                                ) : filteredSubmissions.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-10 text-muted">No submissions found.</td></tr>
                                ) : (
                                    filteredSubmissions.map((s) => (
                                        <tr key={s.id}>
                                            <td data-label="Employee" className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-primary-text">{s.personal?.firstName || 'Unknown'} {s.personal?.lastName || ''}</div>
                                                <div className="text-sm text-muted">{s.personal?.employeeId || 'N/A'}</div>
                                            </td>
                                            <td data-label="Status" className="px-6 py-4 whitespace-nowrap">
                                                <StatusChip status={s.status} />
                                            </td>
                                            <td data-label="Portal Sync" className="px-6 py-4 whitespace-nowrap">
                                                <PortalSyncStatusChip status={s.portalSyncStatus} />
                                            </td>
                                            <td data-label="Actions" className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center gap-2 md:justify-start justify-end">
                                                    <Button variant="icon" size="sm" onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)} title="View/Edit Details"><Eye className="h-4 w-4" /></Button>
                                                    <Button variant="icon" size="sm" onClick={() => navigate(`/onboarding/pdf/${s.id}`)} title="Download Forms"><FileText className="h-4 w-4" /></Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SiteDashboard;
