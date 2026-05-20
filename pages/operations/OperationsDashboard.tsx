import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { api } from '../../services/api';
import type { User, Organization } from '../../types';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { Activity, Send, BarChart3 } from 'lucide-react';
import Toast from '../../components/ui/Toast';
import { useNavigate } from 'react-router-dom';
import DatePicker from '../../components/ui/DatePicker';
import { useAuthStore } from '../../store/authStore';
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


const OperationsDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    // ── Role-Based Site Access ──────────────────────────────────────────
    const { allowedSites, canSelectSite, defaultSiteId, isLoading: sitesLoading } = useRoleSiteAccess();
    const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (defaultSiteId && !selectedSiteId) {
            setSelectedSiteId(defaultSiteId);
        }
    }, [defaultSiteId]);

    // ── Dashboard Data (shared hook) ────────────────────────────────────
    const dashboard = useDashboardData(allowedSites, selectedSiteId);

    const activeSiteName = useMemo(() => {
        if (!selectedSiteId || selectedSiteId === 'all') return 'All Sites';
        const found = allowedSites.find(s => s.id === selectedSiteId);
        return found ? found.name : user?.organizationName || 'N/A';
    }, [allowedSites, selectedSiteId, user]);

    // ── Field Staff Assignment (existing feature) ────────────────────────
    const [fieldStaff, setFieldStaff] = useState<User[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedOfficer, setSelectedOfficer] = useState('');
    const [selectedSite, setSelectedSite] = useState('');
    const [assignmentDate, setAssignmentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [assignmentToast, setAssignmentToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        const fetchOpsData = async () => {
            if (!user) return;
            try {
                const isSuperAdmin = ['admin', 'super_admin'].includes(user.role);
                const [staff, orgs] = await Promise.all([
                    api.getFieldStaff(isSuperAdmin ? undefined : user.id),
                    api.getOrganizations()
                ]);
                setFieldStaff(staff);
                setOrganizations(orgs);
            } catch (error) {
                console.error('Failed to load ops data:', error);
            }
        };
        fetchOpsData();
    }, [user]);

    const handleAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOfficer || !selectedSite || !assignmentDate) {
            setAssignmentToast({ message: 'Please fill all fields for assignment.', type: 'error' });
            return;
        }
        try {
            await api.createAssignment(selectedOfficer, selectedSite, assignmentDate);
            setAssignmentToast({ message: 'Assignment created successfully.', type: 'success' });
        } catch (error) {
            setAssignmentToast({ message: 'Failed to create assignment.', type: 'error' });
        }
    };

    // ── Loading State ───────────────────────────────────────────────────
    if (sitesLoading || (dashboard.isLoading && !selectedSiteId)) {
        return <LoadingScreen message="Loading operations dashboard..." />;
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
            {assignmentToast && (
                <Toast
                    message={assignmentToast.message}
                    type={assignmentToast.type}
                    onDismiss={() => setAssignmentToast(null)}
                />
            )}

            {/* ── Dashboard Header ─────────────────────────────────────── */}
            <DashboardHeader
                title="Operations Control Center"
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

            {/* ── Team Activity Card (Ops-specific) ────────────────────── */}
            <div
                className="bg-gradient-to-br from-emerald-50 to-emerald-25 border-2 border-emerald-200/50 rounded-2xl p-6 cursor-pointer hover:border-emerald-400 hover:shadow-lg transition-all group"
                onClick={() => navigate('/operations/team-activity')}
            >
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-[#006B3F] rounded-xl p-3 group-hover:scale-110 transition-transform">
                                <Activity className="h-6 w-6 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Team Activity Monitor</h3>
                        </div>
                        <p className="text-slate-600 mb-4 text-sm">
                            Track your field team in real-time. Monitor check-ins, working hours, locations, and communicate instantly with your team members.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-xs font-medium">
                                Real-time tracking
                            </span>
                            <span className="px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-xs font-medium">
                                Location monitoring
                            </span>
                            <span className="px-3 py-1 bg-cyan-500/10 text-cyan-600 rounded-full text-xs font-medium">
                                Quick communication
                            </span>
                        </div>
                    </div>
                    <div className="flex-shrink-0 ml-4 hidden sm:block">
                        <Button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate('/operations/team-activity');
                            }}
                            style={{ backgroundColor: '#006B3F', color: '#FFFFFF' }}
                        >
                            View Team Activity →
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Charts Row ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                        <BarChart3 className="h-5 w-5 text-[#006B3F]" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                            Attendance Trend
                        </h3>
                    </div>
                    <AttendanceTrendChart data={dashboard.weeklyData} />
                </div>

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

            {/* ── Field Staff Assignment (existing ops feature) ────────── */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                <h3 className="text-base font-semibold text-slate-800 mb-4">Assign Field Staff</h3>
                <p className="text-sm text-slate-500 mb-4">Assign a field staff to an organization for a specific date.</p>
                <form onSubmit={handleAssignment} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div className="md:col-span-1">
                        <Select label="Field Staff" id="officer" value={selectedOfficer} onChange={e => setSelectedOfficer(e.target.value)}>
                            <option value="">Select Staff</option>
                            {fieldStaff.map(officer => <option key={officer.id} value={officer.id}>{officer.name}</option>)}
                        </Select>
                    </div>
                    <div className="md:col-span-1">
                        <Select label="Organization/Site" id="site" value={selectedSite} onChange={e => setSelectedSite(e.target.value)}>
                            <option value="">Select Site</option>
                            {organizations.map(org => <option key={org.id} value={org.id}>{org.shortName}</option>)}
                        </Select>
                    </div>
                    <div className="md:col-span-1">
                        <DatePicker label="Assignment Date" id="assignmentDate" value={assignmentDate} onChange={setAssignmentDate} />
                    </div>
                    <div className="md:col-span-1">
                        <Button type="submit" className="w-full" style={{ backgroundColor: '#006B3F', color: '#FFFFFF' }}>
                            <Send className="mr-2 h-4 w-4" />Assign
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OperationsDashboard;