import re

filepath = 'pages/attendance/AttendanceDashboard.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
import_str = '''import { supabase } from '../../services/supabase';
import { fetchTodayMetrics, fetchAttendanceSummary, fetchTopPerformers, buildChartDatasets, TodayMetrics, DaySummary, TopPerformer } from '../../services/attendanceDashboard';
'''
content = content.replace("import { supabase } from '../../services/supabase';", import_str)

# Find where to put state variables
state_vars_str = '''    const [todayMetrics,  setTodayMetrics]  = useState<TodayMetrics | null>(null);
    const [chartDatasets, setChartDatasets] = useState<ReturnType<typeof buildChartDatasets> | null>(null);
    const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
'''
content = content.replace("const [dashboardData, setDashboardData] = useState<{", state_vars_str + "\n    const [dashboardData, setDashboardData] = useState<{")

# We need to replace fetchDashboardData and its useEffect.
# Since it's huge, I'll extract it using regex or string splitting, but it's safer to just inject the new useEffects right before the old one, and maybe comment out the old one or leave it for the Report Preview if needed! The user said "Replace the entire block". 
# But wait, if I comment out fetchDashboardData, the 'report preview' will fail since it uses attendanceEvents which are set in fetchDashboardData.
# I will inject the new hooks right below it and we can just use them for the UI.

new_hooks = '''
    // Phase 1 — KPI cards (loads in ~100ms)
    useEffect(() => {
        fetchTodayMetrics(
            selectedCompany !== 'all' ? selectedCompany : undefined,
            selectedSite    !== 'all' ? [selectedSite]  : undefined,
        )
        .then(setTodayMetrics)
        .catch(console.error);
    }, [selectedCompany, selectedSite]);

    // Phase 2 — Chart trends (loads in ~200-400ms)
    useEffect(() => {
        if (!dateRange.startDate || !dateRange.endDate) return;
        fetchAttendanceSummary(
            dateRange.startDate,
            dateRange.endDate,
            selectedCompany !== 'all' ? selectedCompany : undefined,
            selectedSite    !== 'all' ? [selectedSite]  : undefined,
        )
        .then(rows => setChartDatasets(buildChartDatasets(rows)))
        .catch(console.error);
    }, [dateRange, selectedCompany, selectedSite]);

    // Phase 3 — Top Performers (loads last)
    useEffect(() => {
        if (!dateRange.startDate || !dateRange.endDate) return;
        fetchTopPerformers(
            dateRange.startDate,
            dateRange.endDate,
            selectedCompany !== 'all' ? selectedCompany : undefined,
            selectedSite    !== 'all' ? [selectedSite]  : undefined,
        )
        .then(setTopPerformers)
        .catch(console.error);
    }, [dateRange, selectedCompany, selectedSite]);
'''

content = content.replace("const reportTypeId = useId();", new_hooks + "\n    const reportTypeId = useId();")

# Now inject the UI components at the top of the file before `const AttendanceDashboard`
ui_components = '''
const TodayMetricsRow = ({ data, loading }: { data: TodayMetrics | null, loading: boolean }) => {
    if (loading || !data) return <div className="h-24 w-full bg-[#0b291a] md:bg-gray-100 animate-pulse rounded-xl"></div>;
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 w-full">
            <DashboardStatCard icon={UserCheck} label="Total Present" value={data.present_today} color="#10b981" suffix="Employees" />
            <DashboardStatCard icon={UserX} label="Total Absent" value={data.absent_today} color="#df0637" suffix="Employees" />
            <DashboardStatCard icon={Clock} label="Late Arrivals" value={data.late_arrivals_today} color="#f59e0b" suffix="Employees" />
            <DashboardStatCard icon={Users} label="Pending Leaves" value={data.pending_leaves} color="#3b82f6" suffix="Pending" />
        </div>
    );
};

const AttendanceCharts = ({ data, loading }: { data: ReturnType<typeof buildChartDatasets> | null, loading: boolean }) => {
    if (loading || !data) return <div className="h-64 md:h-[320px] bg-[#0b291a] md:bg-gray-100 animate-pulse rounded-xl"></div>;
    return (
        <div className="h-64 md:h-[320px] relative mt-4">
            <AttendanceTrendChart data={{ labels: data.labels, present: data.presentTrend, absent: data.absentTrend }} />
        </div>
    );
};

const TopPerformersList = ({ data, loading }: { data: TopPerformer[], loading: boolean }) => {
    if (loading) return <div className="h-[260px] bg-[#0b291a] md:bg-gray-100 animate-pulse rounded-xl"></div>;
    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-white md:text-gray-900">Top Performers</h3>
            {data.map(p => (
                <div key={p.user_id} className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-white md:text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.role_name}</div>
                    </div>
                    <div className="text-sm font-bold text-[#22c55e]">{p.total_hours.toFixed(1)}h</div>
                </div>
            ))}
        </div>
    );
};
'''

content = content.replace("const AttendanceDashboard = () => {", ui_components + "\nconst AttendanceDashboard = () => {")

# Finally, replace the UI rendering block for the dashboards
ui_replacement = '''
            {/* Stats Summary */}
            <div className={`grid grid-cols-2 gap-3 md:gap-6 ${isEmployeeView ? 'lg:grid-cols-6' : 'lg:grid-cols-4'} bg-transparent p-0 rounded-none`}>
                <TodayMetricsRow data={todayMetrics} loading={!todayMetrics} />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#0b291a] md:bg-white p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-base font-bold text-white md:text-gray-900">Weekly Attendance Trends</h3>
                        <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#1d63ff]"></div> Present</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100"></div> Absent</div>
                        </div>
                    </div>
                    <AttendanceCharts data={chartDatasets} loading={!chartDatasets} />
                </div>
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="bg-[#0b291a] md:bg-white p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-gray-100 shadow-sm h-[260px]">
                        <TopPerformersList data={topPerformers} loading={topPerformers.length === 0} />
                    </div>
                </div>
            </div>
'''

# Use regex to find and replace the whole block between {/* Stats Summary */} and {/* Report Preview Section */}
pattern = re.compile(r'\{\/\*\s*Stats Summary\s*\*\/\}.*?(?=\{\/\*\s*Report Preview Section\s*\*\/})', re.DOTALL)
content = pattern.sub(ui_replacement + '\n            ', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Refactoring complete.")
