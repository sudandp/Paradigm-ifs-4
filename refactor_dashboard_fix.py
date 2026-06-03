import re

filepath = 'pages/attendance/AttendanceDashboard.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Inject state variables
state_vars_str = '''    const [todayMetrics,  setTodayMetrics]  = useState<TodayMetrics | null>(null);
    const [chartDatasets, setChartDatasets] = useState<ReturnType<typeof buildChartDatasets> | null>(null);
    const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
'''
target_var = "const [dashboardData, setDashboardData] = useState<DashboardData |\nnull>(null);"
target_var_alt = "const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);"

if target_var_alt in content:
    content = content.replace(target_var_alt, state_vars_str + "\n    " + target_var_alt)
elif target_var in content:
    content = content.replace(target_var, state_vars_str + "\n    " + target_var)

# Inject UI components before const AttendanceDashboard
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
        <div className="flex flex-col gap-4 overflow-y-auto h-full pr-2">
            <h3 className="text-sm font-semibold text-white md:text-gray-900 sticky top-0 bg-[#0b291a] md:bg-white pb-2 z-10">Top Performers</h3>
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

target_component = "const AttendanceDashboard: React.FC = () => {"
if target_component in content:
    content = content.replace(target_component, ui_components + "\n" + target_component)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Injections successful.")
