

import React, { useState, useEffect, useMemo } from 'react';
// Fix: Use inline type import for RangeKeyDict
import { DateRangePicker, type Range, type RangeKeyDict } from 'react-date-range';
import { addDays, format } from 'date-fns';
import { api } from '../../services/api';
import type { OnboardingData, User, Organization } from '../../types';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { Users, UserCheck, UserX, Calendar, MapPin, Send, FileText, Activity } from 'lucide-react';
import Toast from '../../components/ui/Toast';
import { useNavigate } from 'react-router-dom';
import FormHeader from '../../components/onboarding/FormHeader';
import DatePicker from '../../components/ui/DatePicker';
import StatCard from '../../components/ui/StatCard';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';


const OperationsDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [submissions, setSubmissions] = useState<OnboardingData[]>([]);
    const [fieldStaff, setFieldStaff] = useState<User[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const { user } = useAuthStore();

    const [dateRange, setDateRange] = useState<Range[]>([
        {
            startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            endDate: new Date(),
            key: 'selection'
        }
    ]);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Assignment form state
    const [selectedOfficer, setSelectedOfficer] = useState('');
    const [selectedSite, setSelectedSite] = useState('');
    const [assignmentDate, setAssignmentDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            setIsLoading(true);
            try {
                const isSuperAdmin = ['admin', 'super_admin'].includes(user.role);
                const [subs, staff, orgs] = await Promise.all([
                    api.getVerificationSubmissions(undefined, undefined, isSuperAdmin ? undefined : user.id),
                    api.getFieldStaff(isSuperAdmin ? undefined : user.id),
                    api.getOrganizations()
                ]);
                setSubmissions(subs);
                setFieldStaff(staff);
                setOrganizations(orgs);
            } catch (error) {
                setToast({ message: 'Failed to load dashboard data.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const filteredSubmissions = useMemo(() => {
        const startDate = dateRange[0].startDate;
        const endDate = dateRange[0].endDate;
        if (!startDate || !endDate) return submissions;

        // Normalize endDate to include the whole day
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);

        return submissions.filter(s => {
            const submissionDate = new Date(s.enrollmentDate.replace(/-/g, '/'));
            return submissionDate >= startDate && submissionDate <= endOfDay;
        });
    }, [submissions, dateRange]);

    const stats = useMemo(() => ({
        total: filteredSubmissions.length,
        verified: filteredSubmissions.filter(s => s.status === 'verified').length,
        rejected: filteredSubmissions.filter(s => s.status === 'rejected').length,
    }), [filteredSubmissions]);

    const handleAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOfficer || !selectedSite || !assignmentDate) {
            setToast({ message: 'Please fill all fields for assignment.', type: 'error' });
            return;
        }
        try {
            await api.createAssignment(selectedOfficer, selectedSite, assignmentDate);
            setToast({ message: 'Assignment created successfully (mocked).', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to create assignment.', type: 'error' });
        }
    };

    const dateRangeText = (dateRange[0].startDate && dateRange[0].endDate)
        ? `${format(dateRange[0].startDate, 'MMM d, yyyy')} - ${format(dateRange[0].endDate, 'MMM d, yyyy')}`
        : 'Select Date';

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-4 space-y-8">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <div className="bg-card p-4 rounded-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-bold text-primary-text">Operations Dashboard</h2>
                    <div className="relative">
                        <Button variant="outline" onClick={() => setShowDatePicker(!showDatePicker)}>
                            <Calendar className="mr-2 h-4 w-4" />
                            <span>{dateRangeText}</span>
                        </Button>
                        {showDatePicker && (
                            <div className="absolute top-full right-0 mt-2 z-10 bg-card border rounded-lg shadow-lg">
                                <DateRangePicker
                                    onChange={(item: RangeKeyDict) => {
                                        setDateRange([item.selection]);
                                        setShowDatePicker(false);
                                    }}
                                    months={1}
                                    ranges={dateRange}
                                    direction="horizontal"
                                    maxDate={addDays(new Date(), 1)}
                                    shownDate={dateRange[0].startDate || new Date()}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Team Activity Card */}
            <div
                className="bg-gradient-to-br from-accent/10 to-accent/5 border-2 border-accent/30 rounded-2xl p-6 cursor-pointer hover:border-accent hover:shadow-lg transition-all group"
                onClick={() => navigate('/operations/team-activity')}
            >
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-accent rounded-xl p-3 group-hover:scale-110 transition-transform">
                                <Activity className="h-6 w-6 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-primary-text">Team Activity Monitor</h3>
                        </div>
                        <p className="text-muted mb-4">
                            Track your field team in real-time. Monitor check-ins, working hours, locations, and communicate instantly with your team members.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-xs font-medium">
                                Real-time tracking
                            </span>
                            <span className="px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-xs font-medium">
                                Location monitoring
                            </span>
                            <span className="px-3 py-1 bg-purple-500/10 text-purple-600 rounded-full text-xs font-medium">
                                Quick communication
                            </span>
                        </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Submissions" value={stats.total} icon={FileText} />
                <StatCard title="Verified Employees" value={stats.verified} icon={UserCheck} />
                <StatCard title="Rejected Applications" value={stats.rejected} icon={UserX} />
            </div>

            <div className="bg-card p-6 rounded-2xl">
                <FormHeader title="Assign Field Staff" subtitle="Assign a field staff to an organization for a specific date." />
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
                        <Button type="submit" className="w-full"><Send className="mr-2 h-4 w-4" />Assign</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OperationsDashboard;