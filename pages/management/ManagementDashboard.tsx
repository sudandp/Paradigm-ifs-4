import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Toast from '../../components/ui/Toast';

// Shared dashboard components
import { useRoleSiteAccess } from '../../hooks/useRoleSiteAccess';
import { useDashboardData } from '../../hooks/useDashboardData';
import DashboardHeader from '../../components/dashboard/DashboardHeader';
import DashboardKpiCards from '../../components/dashboard/DashboardKpiCards';
import AttendanceTrendChart from '../../components/dashboard/AttendanceTrendChart';
import DesignationBreakdownChart from '../../components/dashboard/DesignationBreakdownChart';
import BillingSummaryPanel from '../../components/dashboard/BillingSummaryPanel';
import PendingLeavesPanel from '../../components/dashboard/PendingLeavesPanel';
import { BarChart3, Building, Search, MapPin, CheckCircle, XCircle, Compass } from 'lucide-react';

const formatRoleName = (role: string) => {
    if (!role) return 'N/A';
    if (role.toLowerCase() === 'hr') return 'HR';
    if (role.toLowerCase() === 'hr_ops') return 'HR Ops';
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const ManagementDashboard: React.FC = () => {
    const { user } = useAuthStore();

    // ── Role-Based Site Access ──────────────────────────────────────────
    const { allowedSites, isLoading: sitesLoading } = useRoleSiteAccess();

    // Lock selectedSiteId to 'all' to show all head offices
    const selectedSiteId = 'all';

    // ── Office Location State ───────────────────────────────────────────
    const [officeLocation, setOfficeLocation] = useState<'all' | 'Hyderabad' | 'Bangalore'>('all');

    // ── Dashboard Data (scoped to head office staff and selected location) ────
    const dashboard = useDashboardData(allowedSites, selectedSiteId, { 
        isOfficeOnly: true,
        officeLocation 
    });

    const activeSiteName = useMemo(() => {
        if (officeLocation === 'all') return 'All Head Offices';
        return `${officeLocation} Head Office`;
    }, [officeLocation]);

    // ── Staff Location Lookup State ─────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent'>('all');

    const todayStr = useMemo(() => new Date().toDateString(), []);

    // Process staff users and compute their today's location and active status
    const staffWithLocations = useMemo(() => {
        return dashboard.siteUsers.map((u: any) => {
            // Find today's events for this user
            const userEvents = (dashboard.attendanceEvents || []).filter((e: any) => {
                if (e.userId !== u.id) return false;
                return new Date(e.timestamp).toDateString() === todayStr;
            });

            // Sort by timestamp descending
            userEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const latestEvent = userEvents[0];
            const isCheckIn = latestEvent && (
                latestEvent.type?.toLowerCase().includes('in') ||
                latestEvent.type?.toLowerCase().includes('punch') ||
                latestEvent.type?.toLowerCase() === 'present'
            ) && !latestEvent.type?.toLowerCase().includes('out');

            const location = latestEvent?.locationName || latestEvent?.location_name || 'No Punch Recorded';
            const time = latestEvent?.timestamp 
                ? new Date(latestEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : 'N/A';
            const status = isCheckIn ? 'present' : 'absent';

            return {
                ...u,
                location,
                time,
                status,
                latestEvent
            };
        });
    }, [dashboard.siteUsers, dashboard.attendanceEvents, todayStr]);

    const filteredStaff = useMemo(() => {
        return staffWithLocations.filter(staff => {
            const matchesSearch =
                (staff.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (staff.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (staff.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (staff.location || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                statusFilter === 'all' ||
                staff.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [staffWithLocations, searchTerm, statusFilter]);

    // ── Loading State ───────────────────────────────────────────────────
    if (sitesLoading || (dashboard.isLoading && !selectedSiteId)) {
        return <LoadingScreen message="Loading management dashboard..." />;
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
                title="Head Office Management Control"
                activeSiteName={activeSiteName}
                sites={allowedSites}
                selectedSiteId={selectedSiteId}
                onSiteChange={() => {}}
                canSelectSite={false} // Explicitly disable site selector
                startDate={dashboard.startDate}
                endDate={dashboard.endDate}
                onStartDateChange={dashboard.setStartDate}
                onEndDateChange={dashboard.setEndDate}
                onRefresh={dashboard.fetchDashboardData}
                isLoading={dashboard.isLoading}
                showDateRange={false}
                extraControls={
                    <div className="w-44">
                        <select
                            id="office-location-selector"
                            value={officeLocation}
                            onChange={e => setOfficeLocation(e.target.value as any)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 text-sm text-slate-700 font-semibold focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-sm transition-all cursor-pointer"
                        >
                            <option value="all">All Locations</option>
                            <option value="Hyderabad">Hyderabad</option>
                            <option value="Bangalore">Bangalore</option>
                        </select>
                    </div>
                }
            />

            {/* ── Info Bar ─────────────────────────────────────────────── */}
            <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 flex items-center gap-3">
                <Building className="h-5 w-5 text-cyan-600 flex-shrink-0" />
                <span className="text-sm text-cyan-800 font-medium">
                    This dashboard displays statistics exclusively for head office and back office administration staff. Field/site staff metrics are excluded.
                </span>
            </div>

            {/* ── KPI Cards ────────────────────────────────────────────── */}
            <DashboardKpiCards
                todayMetrics={dashboard.todayMetrics}
                pendingLeaves={dashboard.leaveRequests.length}
                approvedLeaves={dashboard.approvedLeavesCount}
            />

            {/* ── Real-time Staff Locator Panel ───────────────────────── */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2.5">
                        <Compass className="h-5 w-5 text-cyan-600" />
                        <div>
                            <h3 className="text-base font-bold text-slate-800">
                                Staff Location Lookup
                            </h3>
                            <p className="text-xs text-slate-400">
                                Find and track active head office staff check-in locations and punch status.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name, role, location..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-500 focus:bg-white transition-all text-slate-700"
                            />
                        </div>

                        {/* Status Filters */}
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    statusFilter === 'all'
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setStatusFilter('present')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    statusFilter === 'present'
                                        ? 'bg-white text-emerald-700 shadow-sm'
                                        : 'text-slate-500 hover:text-emerald-700'
                                }`}
                            >
                                Present
                            </button>
                            <button
                                onClick={() => setStatusFilter('absent')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    statusFilter === 'absent'
                                        ? 'bg-white text-slate-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Absent
                            </button>
                        </div>
                    </div>
                </div>

                {/* Locator Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="px-5 py-4">Staff Member</th>
                                <th className="px-5 py-4">Role</th>
                                <th className="px-5 py-4 text-center">Status</th>
                                <th className="px-5 py-4">Today's Punch Location</th>
                                <th className="px-5 py-4 text-right">Punch Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredStaff.length > 0 ? (
                                filteredStaff.map((staff: any) => (
                                    <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors group">
                                        {/* Profile */}
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center font-bold text-cyan-700 text-sm uppercase">
                                                    {(staff.name || 'U').substring(0, 2)}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-semibold text-slate-800 group-hover:text-cyan-700 transition-colors">
                                                        {staff.name}
                                                    </h4>
                                                    <p className="text-xs text-slate-400">{staff.email}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Designation */}
                                        <td className="px-5 py-4">
                                            <span className="text-sm text-slate-600 font-medium">{formatRoleName(staff.role)}</span>
                                        </td>

                                        {/* Status */}
                                        <td className="px-5 py-4 text-center">
                                            {staff.status === 'present' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    <CheckCircle className="h-3 w-3" /> Checked In
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200">
                                                    <XCircle className="h-3 w-3" /> Checked Out
                                                </span>
                                            )}
                                        </td>

                                        {/* Location */}
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <MapPin className={`h-4 w-4 ${staff.status === 'present' ? 'text-cyan-500' : 'text-slate-300'}`} />
                                                <span className={`text-sm ${staff.status === 'present' ? 'text-slate-700 font-semibold' : 'text-slate-400 font-normal'}`}>
                                                    {staff.location}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Time */}
                                        <td className="px-5 py-4 text-right">
                                            <span className="text-sm text-slate-500 font-mono">{staff.time}</span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm">
                                        No head office staff found matching the filter criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
                        Staff by Designation
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

            {/* ── Pending Leaves ───────────────────────────────────────── */}
            <PendingLeavesPanel
                leaves={dashboard.leaveRequests}
                siteUsers={dashboard.siteUsers}
            />
        </div>
    );
};

export default ManagementDashboard;
