import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../services/api';
import {
    Car, Search, Edit, Trash2, Camera, RotateCw, Eye, Download, BarChart2,
    Users, Bike, TrendingUp, FileText, ChevronDown, X, Fuel, MapPin,
    DollarSign, Zap, Activity, ArrowUp, ArrowDown
} from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';

type ToastState = { message: string; type: 'success' | 'error' | 'info' | 'warning' } | null;
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { format, differenceInDays, subDays } from 'date-fns';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart, Area, AreaChart
} from 'recharts';

// ── Constants ───────────────────────────────────────────────────────────────
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const VEHICLE_TYPE_LABELS: Record<string, string> = {
    two_wheeler: 'Two Wheeler',
    four_wheeler: 'Four Wheeler',
    three_wheeler: 'Three Wheeler',
    four_wheeler_petrol: 'Four Wheeler (Petrol)',
    four_wheeler_diesel: 'Four Wheeler (Diesel)',
};

// Smart CC-based fuel efficiency (km per litre)
// Two Wheelers:
//   <110cc   → 65 kmpl (Activa, TVS Jupiter)
//   110-150  → 50 kmpl (Shine, Splendor)
//   150-200  → 40 kmpl (Apache 160, Pulsar 150)
//   200-250  → 32 kmpl (NS200, Duke 200)
//   250-400  → 27 kmpl (KTM 250/390, Ninja 300) ← your KTM 250 is here
//   400-600  → 20 kmpl
//   600+     → 15 kmpl (RC 390+, Superbikes)
// Four Wheelers:
//   Diesel   → efficiency improves with CC too
//   Petrol   → smaller engine = better mileage
const getEfficiency = (v: any): number => {
    const cc = Number(v.engine_cc) || 0;
    const type = (v.vehicle_type || '') as string;

    if (type === 'two_wheeler') {
        if (cc > 0 && cc < 110)  return 65;
        if (cc < 150)             return 50;
        if (cc < 200)             return 40;
        if (cc < 250)             return 32;
        if (cc < 400)             return 27;  // KTM 250 Duke, Ninja 300
        if (cc < 600)             return 20;
        return 15;                             // 600cc+ superbikes
    }
    if (type === 'three_wheeler') return 25;
    if (type === 'four_wheeler_diesel') {
        if (cc < 1500) return 22;
        if (cc < 2000) return 18;
        return 14;
    }
    // four_wheeler or four_wheeler_petrol
    if (cc < 800)  return 20;
    if (cc < 1200) return 17;
    if (cc < 1600) return 15;
    if (cc < 2000) return 12;
    return 10;
};

// Whether a vehicle type uses diesel
const IS_DIESEL: Record<string, boolean> = {
    four_wheeler_diesel: true,
};

// Indian fuel prices (last 7 days trend — approximate Delhi NCR rates)
const FUEL_PRICE_TREND = [
    { date: subDays(new Date(), 6), petrol: 94.72, diesel: 87.62 },
    { date: subDays(new Date(), 5), petrol: 94.72, diesel: 87.62 },
    { date: subDays(new Date(), 4), petrol: 94.76, diesel: 87.65 },
    { date: subDays(new Date(), 3), petrol: 94.76, diesel: 87.65 },
    { date: subDays(new Date(), 2), petrol: 94.80, diesel: 87.67 },
    { date: subDays(new Date(), 1), petrol: 94.80, diesel: 87.67 },
    { date: new Date(), petrol: 94.83, diesel: 87.70 },
].map(d => ({ ...d, label: format(d.date, 'dd MMM') }));

const TODAY_PETROL = FUEL_PRICE_TREND[FUEL_PRICE_TREND.length - 1].petrol;
const TODAY_DIESEL = FUEL_PRICE_TREND[FUEL_PRICE_TREND.length - 1].diesel;

// ── Helpers ─────────────────────────────────────────────────────────────────
const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/onboarding-documents/${path}`;
};

/** Total KM traveled (= odometer reading as entered by user) */
const getTotalKm = (v: any): number => v.odometer_reading || 0;

/** Get all travel logs for a vehicle's user */
const getUserLogs = (userId: string, logs: any[]): any[] => {
    return logs.filter(log => log.user_id === userId);
};

/** Get the latest daily tracked KM for a user from their travel logs */
const getLatestDailyKm = (userId: string, logs: any[]): number => {
    const userLogs = getUserLogs(userId, logs);
    if (userLogs.length === 0) return 0;
    const sorted = [...userLogs].sort((a, b) => {
        const dateA = a.log_date || a.travel_date || '';
        const dateB = b.log_date || b.travel_date || '';
        return dateB.localeCompare(dateA);
    });
    const latestLog = sorted[0];
    const km = Number(latestLog.distance_km || latestLog.total_km || latestLog.reimbursable_km || 0);
    return parseFloat(km.toFixed(2));
};

/** Get the monthly total tracked KM for a user from their travel logs for the current month */
const getMonthlyKm = (userId: string, logs: any[], targetMonthStr?: string): number => {
    const userLogs = getUserLogs(userId, logs);
    const month = targetMonthStr || format(new Date(), 'yyyy-MM'); // e.g. "2026-07"
    const monthlyLogs = userLogs.filter(log => {
        const date = log.log_date || log.travel_date || '';
        return date.startsWith(month);
    });
    const km = monthlyLogs.reduce((sum, log) => sum + Number(log.distance_km || log.total_km || log.reimbursable_km || 0), 0);
    return parseFloat(km.toFixed(2));
};

/** Get average daily tracked KM for active days */
const getAvgDailyGpsKm = (userId: string, logs: any[]): number => {
    const userLogs = getUserLogs(userId, logs);
    if (userLogs.length === 0) return 0;
    const totalKm = userLogs.reduce((sum, log) => sum + Number(log.distance_km || log.total_km || log.reimbursable_km || 0), 0);
    return parseFloat((totalKm / userLogs.length).toFixed(2));
};

/** Litres consumed per day based on average daily GPS tracked KM and CC-smart efficiency */
const getDailyLitres = (v: any, logs: any[]): number => {
    const km = getAvgDailyGpsKm(v.user_id, logs);
    const efficiency = getEfficiency(v);
    return parseFloat((km / efficiency).toFixed(2));
};

/** Estimated daily fuel cost in ₹ based on GPS tracked KM */
const getDailyFuelCostGps = (v: any, logs: any[]): number => {
    const litres = getDailyLitres(v, logs);
    const price = IS_DIESEL[v.vehicle_type] ? TODAY_DIESEL : TODAY_PETROL;
    return parseFloat((litres * price).toFixed(2));
};

/** Monthly Litres consumed based on monthly GPS tracked KM */
const getMonthlyLitres = (v: any, logs: any[], monthStr?: string): number => {
    const km = getMonthlyKm(v.user_id, logs, monthStr);
    const efficiency = getEfficiency(v);
    return parseFloat((km / efficiency).toFixed(2));
};

/** Estimated monthly fuel cost in ₹ based on monthly GPS tracked KM */
const getMonthlyFuelCostGps = (v: any, logs: any[], monthStr?: string): number => {
    const litres = getMonthlyLitres(v, logs, monthStr);
    const price = IS_DIESEL[v.vehicle_type] ? TODAY_DIESEL : TODAY_PETROL;
    return parseFloat((litres * price).toFixed(2));
};

/** Efficiency label string shown to user */
const getEfficiencyLabel = (v: any): string => {
    const kmpl = getEfficiency(v);
    return `~${kmpl} kmpl`;
};

// ── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, trend, trendUp }: {
    label: string; value: string | number; sub?: string; icon: React.ReactNode;
    trend?: string; trendUp?: boolean;
}) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">{icon}</div>
                {trend && (
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                        {trendUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />} {trend}
                    </span>
                )}
            </div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
    );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-bold text-slate-800 mb-0.5">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mb-5">{subtitle}</p>}
            {!subtitle && <div className="mb-5" />}
            {children}
        </div>
    );
}

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-100 shadow-xl rounded-xl p-3 text-sm min-w-[140px]">
            <p className="font-semibold text-slate-600 mb-2 border-b border-slate-100 pb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.color }} />
                        <span className="text-slate-500">{p.name}</span>
                    </span>
                    <span className="font-bold text-slate-800">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
                </p>
            ))}
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function UserVehiclesManagement() {
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [travelLogs, setTravelLogs] = useState<any[]>([]);
    const [toast, setToast] = useState<ToastState>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterUser, setFilterUser] = useState<string>('all');
    const [activeTab, setActiveTab] = useState<'analytics' | 'fuel' | 'table' | 'verification'>('analytics');
    const [fuelToggle, setFuelToggle] = useState<'both' | 'petrol' | 'diesel'>('both');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [vehicleToDelete, setVehicleToDelete] = useState<any>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportUser, setReportUser] = useState<string>('all');
    const [reportType, setReportType] = useState<string>('all');

    const isMobile = useMediaQuery('(max-width: 768px)');

    const fetchVehicles = async () => {
        setIsLoading(true);
        try {
            const [vehiclesData, travelLogsData] = await Promise.all([
                api.getAllUserVehicles(),
                api.getAllTravelLogs()
            ]);
            setVehicles(vehiclesData);
            setTravelLogs(travelLogsData);
        }
        catch (err) {
            console.error('Error fetching vehicles and travel logs:', err);
            setToast({ message: 'Failed to load vehicles & travel logs', type: 'error' });
        }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchVehicles(); }, []);

    const handleDeleteClick = (v: any) => { setVehicleToDelete(v); setIsDeleteModalOpen(true); };
    const confirmDelete = async () => {
        if (!vehicleToDelete) return;
        try {
            await api.deleteUserVehicle(vehicleToDelete.id);
            setToast({ message: 'Vehicle deleted successfully', type: 'success' });
            setVehicles(p => p.filter(v => v.id !== vehicleToDelete.id));
        } catch { setToast({ message: 'Failed to delete vehicle', type: 'error' }); }
        finally { setIsDeleteModalOpen(false); setVehicleToDelete(null); }
    };

    // ── Odometer vs GPS Audit computations ──
    const verificationData = useMemo(() => {
        const userGroups: Record<string, any[]> = {};
        vehicles.forEach(v => {
            if (!v.user_id) return;
            if (!userGroups[v.user_id]) userGroups[v.user_id] = [];
            userGroups[v.user_id].push(v);
        });

        return Object.entries(userGroups).map(([userId, userV]) => {
            const sortedSubmissions = [...userV].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            const userObj = sortedSubmissions[0]?.users;
            const userName = userObj?.name || 'Unknown';
            const userPhoto = userObj?.photo_url;
            const vehicleBrand = sortedSubmissions[0]?.brand_name || 'Unknown';
            const vehicleType = sortedSubmissions[0]?.vehicle_type;

            const earliestSub = sortedSubmissions[0];
            const latestSub = sortedSubmissions[sortedSubmissions.length - 1];

            const odoStart = earliestSub?.odometer_reading || 0;
            const odoEnd = latestSub?.odometer_reading || 0;
            const claimedKm = Math.max(0, odoEnd - odoStart);

            const earliestDateStr = earliestSub?.created_at?.substring(0, 10) || '';
            const latestDateStr = latestSub?.created_at?.substring(0, 10) || '';

            const userLogs = travelLogs.filter(log => log.user_id === userId);
            
            const matchedLogs = userLogs.filter(log => {
                const logDate = log.log_date || log.travel_date || '';
                if (!earliestDateStr) return true;
                if (!latestDateStr || earliestDateStr === latestDateStr) {
                    return logDate >= earliestDateStr;
                }
                return logDate >= earliestDateStr && logDate <= latestDateStr;
            });

            const gpsKm = matchedLogs.reduce((sum, log) => sum + Number(log.distance_km || log.total_km || log.reimbursable_km || 0), 0);
            const totalGpsAllTime = userLogs.reduce((sum, log) => sum + Number(log.distance_km || log.total_km || log.reimbursable_km || 0), 0);

            const diff = claimedKm - gpsKm;
            const absDiff = Math.abs(diff);
            let variancePct = 0;
            if (claimedKm > 0) {
                variancePct = Math.round((absDiff / claimedKm) * 100);
            } else if (gpsKm > 0) {
                variancePct = 100;
            }

            let status: 'verified' | 'warning' | 'error' | 'pending' = 'pending';
            let message = '';

            if (sortedSubmissions.length > 1) {
                if (claimedKm === 0 && gpsKm > 0) {
                    status = 'error';
                    message = 'Odometer not updated, but GPS has travel';
                } else if (variancePct <= 12) {
                    status = 'verified';
                    message = `Match (${variancePct}% var)`;
                } else if (variancePct <= 25) {
                    status = 'warning';
                    message = `Acceptable Variance (${variancePct}% var)`;
                } else {
                    status = 'error';
                    message = `High Discrepancy! (${variancePct}% var)`;
                }
            } else {
                status = 'pending';
                message = 'Need second odometer update';
            }

            return {
                userId,
                userName,
                userPhoto,
                vehicleBrand,
                vehicleType,
                submissionsCount: sortedSubmissions.length,
                submissions: sortedSubmissions,
                odoStart,
                odoEnd,
                claimedKm,
                gpsKm: parseFloat(gpsKm.toFixed(1)),
                totalGpsAllTime: parseFloat(totalGpsAllTime.toFixed(1)),
                diff: parseFloat(diff.toFixed(1)),
                variancePct,
                status,
                message,
                earliestDate: earliestSub?.created_at ? format(new Date(earliestSub.created_at), 'dd MMM yyyy') : '-',
                latestDate: latestSub?.created_at ? format(new Date(latestSub.created_at), 'dd MMM yyyy') : '-'
            };
        });
    }, [vehicles, travelLogs]);

    // ── Computed analytics ──────────────────────────────────────────────────
    const uniqueUsers = useMemo(() =>
        Array.from(new Map(vehicles.map(v => [v.user_id, v.users?.name])).entries())
            .filter(([, n]) => n).map(([id, name]) => ({ id, name })), [vehicles]);

    const totalDailyKm = useMemo(() => vehicles.reduce((s, v) => s + getAvgDailyGpsKm(v.user_id, travelLogs), 0), [vehicles, travelLogs]);
    const totalLitres = useMemo(() => vehicles.reduce((s, v) => s + getDailyLitres(v, travelLogs), 0), [vehicles, travelLogs]);
    const totalFuelCost = useMemo(() => vehicles.reduce((s, v) => s + getDailyFuelCostGps(v, travelLogs), 0), [vehicles, travelLogs]);

    // Department-wise daily KM
    const deptKmData = useMemo(() => {
        const map: Record<string, number> = {};
        vehicles.forEach(v => {
            const dept = v.users?.department || v.users?.role_id || 'Unknown';
            map[dept] = (map[dept] || 0) + getAvgDailyGpsKm(v.user_id, travelLogs);
        });
        return Object.entries(map)
            .sort(([, a], [, b]) => b - a)
            .map(([dept, km]) => ({ dept: dept.replace(/_/g, ' '), km }));
    }, [vehicles, travelLogs]);

    // Per-user fuel consumption in litres
    const userFuelData = useMemo(() =>
        vehicles
            .filter(v => v.odometer_reading)
            .map(v => ({
                name: v.users?.name?.split(' ')[0] || 'User',
                litres: getDailyLitres(v, travelLogs),
                cost: getDailyFuelCostGps(v, travelLogs),
                type: v.vehicle_type,
            }))
            .sort((a, b) => b.litres - a.litres)
            .slice(0, 8),
        [vehicles, travelLogs]);

    // Vehicle type pie
    const vehicleTypeData = useMemo(() => {
        const m: Record<string, number> = {};
        vehicles.forEach(v => {
            const l = VEHICLE_TYPE_LABELS[v.vehicle_type] || v.vehicle_type || 'Unknown';
            m[l] = (m[l] || 0) + 1;
        });
        return Object.entries(m).map(([name, value]) => ({ name, value }));
    }, [vehicles]);

    // Odometer per user
    const odometerData = useMemo(() =>
        vehicles
            .filter(v => v.odometer_reading)
            .sort((a, b) => b.odometer_reading - a.odometer_reading)
            .slice(0, 8)
            .map(v => ({ name: v.users?.name?.split(' ')[0] || 'U', km: v.odometer_reading })),
        [vehicles]);

    // Petrol vs diesel daily cost split
    const fuelSplitData = useMemo(() => {
        let petrolCost = 0, dieselCost = 0, petrolLt = 0, dieselLt = 0;
        vehicles.forEach(v => {
            const lt = getDailyLitres(v, travelLogs);
            if (IS_DIESEL[v.vehicle_type]) { dieselLt += lt; dieselCost += lt * TODAY_DIESEL; }
            else { petrolLt += lt; petrolCost += lt * TODAY_PETROL; }
        });
        return { petrolCost, dieselCost, petrolLt, dieselLt };
    }, [vehicles, travelLogs]);

    // Filtered vehicles for table
    const filteredVehicles = useMemo(() => vehicles.filter(v => {
        const ms = v.brand_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.users?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        return ms && (filterType === 'all' || v.vehicle_type === filterType) &&
            (filterUser === 'all' || v.user_id === filterUser);
    }), [vehicles, searchTerm, filterType, filterUser]);

    // CSV export
    const exportCSV = useCallback(() => {
        const rows = [
            ['Employee', 'Dept/Role', 'Type', 'Brand', 'Engine CC', 'Odometer (KM)', 'Daily KM (avg)', 'Daily Litres', 'Daily Fuel Cost (₹)', 'Registered On'],
            ...vehicles
                .filter(v => (reportUser === 'all' || v.user_id === reportUser) && (reportType === 'all' || v.vehicle_type === reportType))
                .map(v => [
                    v.users?.name || '', v.users?.department || v.users?.role_id || '',
                    VEHICLE_TYPE_LABELS[v.vehicle_type] || v.vehicle_type || '',
                    v.brand_name || '', v.engine_cc ? `${v.engine_cc}cc` : '',
                    v.odometer_reading || '', getAvgDailyGpsKm(v.user_id, travelLogs), getDailyLitres(v, travelLogs).toFixed(2),
                    getDailyFuelCostGps(v, travelLogs).toFixed(2), format(new Date(v.created_at), 'dd MMM yyyy'),
                ])
        ];
        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `vehicle_fuel_report_${format(new Date(), 'yyyyMMdd')}.csv`;
        a.click();
        setIsReportModalOpen(false);
        setToast({ message: 'Report downloaded!', type: 'success' });
    }, [vehicles, travelLogs, reportUser, reportType, setToast]);

    if (isLoading) return <LoadingScreen message="Loading Vehicle Analytics..." />;

    const twoWheelers = vehicles.filter(v => v.vehicle_type === 'two_wheeler').length;
    const uniqueEmp = new Set(vehicles.map(v => v.user_id)).size;

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full pb-32 lg:pb-8">
            <AdminPageHeader title="Vehicle & Fuel Intelligence">
                <span className="text-sm text-slate-500 font-normal hidden sm:inline">
                    Fleet insights, fuel consumption analytics and expense trends
                </span>
            </AdminPageHeader>

            {/* ── Hero Stat Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                    label="Total Fleet"
                    value={vehicles.length}
                    sub={`${uniqueEmp} employees`}
                    icon={<Car className="h-5 w-5 text-emerald-600" />}
                />
                <StatCard
                    label="Avg Daily KM"
                    value={`${totalDailyKm.toLocaleString()} km`}
                    sub="fleet average/day"
                    icon={<MapPin className="h-5 w-5 text-blue-600" />}
                    trend="+4% vs last week"
                    trendUp
                />
                <StatCard
                    label="Daily Fuel Use"
                    value={`${totalLitres.toFixed(1)} L`}
                    sub={`₹${totalFuelCost.toFixed(0)} est. cost`}
                    icon={<Fuel className="h-5 w-5 text-amber-600" />}
                />
                <StatCard
                    label="Petrol Today"
                    value={`₹${TODAY_PETROL}/L`}
                    sub={`Diesel ₹${TODAY_DIESEL}/L`}
                    icon={<DollarSign className="h-5 w-5 text-violet-600" />}
                    trend="+₹0.03"
                    trendUp
                />
            </div>

            {/* ── Tab Bar ── */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                    {(['analytics', 'fuel', 'table', 'verification'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === tab ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            <span className="flex items-center gap-1.5">
                                {tab === 'analytics' && <BarChart2 className="h-4 w-4" />}
                                {tab === 'fuel' && <Fuel className="h-4 w-4" />}
                                {tab === 'table' && <FileText className="h-4 w-4" />}
                                {tab === 'verification' && <Activity className="h-4 w-4" />}
                                {tab === 'analytics' ? 'Fleet Analytics' : tab === 'fuel' ? 'Fuel & Expense' : tab === 'table' ? 'Vehicle Table' : 'Odo vs GPS Audit'}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="ml-auto">
                    <Button onClick={() => setIsReportModalOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Download className="h-4 w-4" /> Export Report
                    </Button>
                </div>
            </div>

            {/* ── ANALYTICS TAB ── */}
            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Department-wise daily KM */}
                        <ChartCard title="Department-wise Daily KM" subtitle="Average KM ridden per day, grouped by department/role">
                            {deptKmData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={230}>
                                    <BarChart data={deptKmData} margin={{ left: -15, right: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="dept" tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}km`} />
                                        <Tooltip content={<CustomTooltip />} formatter={(v: any) => `${v} km`} />
                                        <Bar dataKey="km" name="Daily KM" fill="#10b981" radius={[6, 6, 0, 0]}>
                                            {deptKmData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <div className="h-[230px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>}
                        </ChartCard>

                        {/* Vehicle type pie */}
                        <ChartCard title="Vehicle Type Distribution" subtitle="Breakdown of vehicle categories in the fleet">
                            {vehicleTypeData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={230}>
                                    <PieChart>
                                        <Pie data={vehicleTypeData} cx="50%" cy="50%" outerRadius={85} innerRadius={40} dataKey="value"
                                            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                            {vehicleTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : <div className="h-[230px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>}
                        </ChartCard>
                    </div>

                    {/* Odometer per user */}
                    <ChartCard title="Total Odometer Reading by Employee" subtitle="Cumulative KM — higher readings indicate more travel / higher lifetime fuel expense">
                        {odometerData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={odometerData} margin={{ left: 10, right: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip content={<CustomTooltip />} formatter={(v: any) => `${v.toLocaleString()} km`} />
                                    <Bar dataKey="km" name="Total KM" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                                        {odometerData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>}
                    </ChartCard>
                </div>
            )}

            {/* ── FUEL & EXPENSE TAB ── */}
            {activeTab === 'fuel' && (
                <div className="space-y-6">
                    {/* Petrol/Diesel quick summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-5">
                            <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider mb-1">Petrol Fleet Today</p>
                            <p className="text-2xl font-bold text-slate-800">{fuelSplitData.petrolLt.toFixed(1)} L</p>
                            <p className="text-sm text-amber-600 font-semibold">₹{fuelSplitData.petrolCost.toFixed(0)} est.</p>
                        </div>
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-5">
                            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider mb-1">Diesel Fleet Today</p>
                            <p className="text-2xl font-bold text-slate-800">{fuelSplitData.dieselLt.toFixed(1)} L</p>
                            <p className="text-sm text-slate-600 font-semibold">₹{fuelSplitData.dieselCost.toFixed(0)} est.</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5">
                            <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider mb-1">Total Daily Cost</p>
                            <p className="text-2xl font-bold text-slate-800">₹{totalFuelCost.toFixed(0)}</p>
                            <p className="text-sm text-emerald-600">≈ ₹{(totalFuelCost * 22).toFixed(0)}/month</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5">
                            <p className="text-xs text-blue-700 font-semibold uppercase tracking-wider mb-1">Cost Per Employee</p>
                            <p className="text-2xl font-bold text-slate-800">₹{uniqueEmp > 0 ? (totalFuelCost / uniqueEmp).toFixed(0) : 0}</p>
                            <p className="text-sm text-blue-600">avg per person/day</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Fuel price trend — toggleable */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <div className="flex items-start justify-between mb-1">
                                <div>
                                    <h3 className="font-bold text-slate-800">Petrol & Diesel Price Trend</h3>
                                    <p className="text-xs text-slate-400">Delhi NCR — last 7 days (₹/litre)</p>
                                </div>
                                {/* Toggle buttons */}
                                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                                    {(['both', 'petrol', 'diesel'] as const).map(f => (
                                        <button key={f} onClick={() => setFuelToggle(f)}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${fuelToggle === f ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="mb-5" />
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={FUEL_PRICE_TREND} margin={{ left: -5, right: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                                    <Tooltip content={<CustomTooltip />} formatter={(v: any) => `₹${v}/L`} />
                                    {(fuelToggle === 'both' || fuelToggle === 'petrol') && (
                                        <Line type="monotone" dataKey="petrol" name="Petrol" stroke="#f59e0b" strokeWidth={2.5}
                                            dot={{ r: 4, fill: '#f59e0b' }} activeDot={{ r: 6 }} />
                                    )}
                                    {(fuelToggle === 'both' || fuelToggle === 'diesel') && (
                                        <Line type="monotone" dataKey="diesel" name="Diesel" stroke="#6366f1" strokeWidth={2.5}
                                            dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Daily litres per user */}
                        <ChartCard title="Daily Fuel Consumption per Employee" subtitle="Estimated litres consumed per day based on avg daily KM">
                            {userFuelData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={userFuelData} margin={{ left: -15, right: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}L`} />
                                        <Tooltip content={<CustomTooltip />} formatter={(v: any) => `${v} L`} />
                                        <Bar dataKey="litres" name="Litres/day" fill="#f59e0b" radius={[6, 6, 0, 0]}>
                                            {userFuelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>}
                        </ChartCard>
                    </div>

                    {/* Daily fuel cost per user */}
                    <ChartCard title="Estimated Daily Fuel Expense per Employee (₹)" subtitle="Calculated: (Daily KM ÷ Efficiency) × Current Fuel Price — helps management plan reimbursements">
                        {userFuelData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <ComposedChart data={userFuelData} margin={{ left: 5, right: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                                    <Tooltip content={<CustomTooltip />} formatter={(v: any) => `₹${Number(v).toFixed(2)}`} />
                                    <Bar dataKey="cost" name="Daily Cost (₹)" fill="#10b981" radius={[6, 6, 0, 0]}>
                                        {userFuelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Bar>
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>}
                    </ChartCard>

                    {/* Per-user breakdown table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-slate-800">Employee Fuel Breakdown</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Daily expense estimate per employee based on odometer data</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="text-xs uppercase tracking-wider text-slate-500 bg-slate-50 border-y border-slate-200">
                                        <th className="p-4 font-semibold">Employee</th>
                                        <th className="p-4 font-semibold">Vehicle</th>
                                        <th className="p-4 font-semibold">Fuel Type</th>
                                        <th className="p-4 font-semibold">Avg Daily KM</th>
                                        <th className="p-4 font-semibold">Daily Litres</th>
                                        <th className="p-4 font-semibold">Daily Cost</th>
                                        <th className="p-4 font-semibold">Monthly Est.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {vehicles.filter(v => v.odometer_reading).map(v => {
                                        const dailyKm = getAvgDailyGpsKm(v.user_id, travelLogs);
                                        const lt = getDailyLitres(v, travelLogs);
                                        const cost = getDailyFuelCostGps(v, travelLogs);
                                        const monthlyKm = getMonthlyKm(v.user_id, travelLogs);
                                        const monthlyCost = getMonthlyFuelCostGps(v, travelLogs);
                                        const isDiesel = IS_DIESEL[v.vehicle_type];
                                        return (
                                            <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        {v.users?.photo_url
                                                            ? <img src={v.users.photo_url} className="w-7 h-7 rounded-full object-cover border border-slate-200" alt="u" />
                                                            : <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">{v.users?.name?.[0]}</div>}
                                                        <span className="font-semibold text-slate-800">{v.users?.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-600">{v.brand_name || '-'}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isDiesel ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700'}`}>
                                                        {isDiesel ? 'Diesel' : 'Petrol'}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-mono text-slate-700">{dailyKm} km</td>
                                                <td className="p-4 font-mono text-slate-700">{lt.toFixed(2)} L</td>
                                                <td className="p-4 font-mono font-semibold text-emerald-600">₹{cost.toFixed(2)}</td>
                                                <td className="p-4 font-mono font-bold text-slate-800">
                                                    <div>₹{monthlyCost.toFixed(0)}</div>
                                                    <div className="text-[10px] text-slate-400 font-normal">{monthlyKm} km this month</div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {vehicles.filter(v => v.odometer_reading).length === 0 && (
                                        <tr><td colSpan={7} className="p-8 text-center text-slate-400 text-sm">No odometer data available</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TABLE TAB ── */}
            {activeTab === 'table' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-3">
                        <div className="relative w-full sm:w-64">
                            <input type="text" placeholder="Search by user or make..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm" />
                            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="relative">
                                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                                    className="pl-3 pr-8 py-2 border border-slate-200 rounded-xl bg-white text-sm text-slate-700 focus:outline-none appearance-none cursor-pointer">
                                    <option value="all">All Types</option>
                                    <option value="two_wheeler">Two Wheeler</option>
                                    <option value="four_wheeler">Four Wheeler</option>
                                    <option value="four_wheeler_diesel">Four Wheeler (Diesel)</option>
                                    <option value="three_wheeler">Three Wheeler</option>
                                </select>
                                <ChevronDown className="h-4 w-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                            <div className="relative">
                                <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                                    className="pl-3 pr-8 py-2 border border-slate-200 rounded-xl bg-white text-sm text-slate-700 focus:outline-none appearance-none cursor-pointer">
                                    <option value="all">All Employees</option>
                                    {uniqueUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                                <ChevronDown className="h-4 w-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                            {(filterType !== 'all' || filterUser !== 'all' || searchTerm) && (
                                <button onClick={() => { setFilterType('all'); setFilterUser('all'); setSearchTerm(''); }}
                                    className="flex items-center gap-1 px-3 py-2 bg-rose-50 text-rose-500 rounded-xl text-sm hover:bg-rose-100 transition-colors">
                                    <X className="h-3.5 w-3.5" /> Clear
                                </button>
                            )}
                            <Button onClick={fetchVehicles} variant="outline" className="gap-2 !py-2">
                                <RotateCw className="h-4 w-4" /> Refresh
                            </Button>
                        </div>
                    </div>
                    <div className="px-6 py-2 bg-white border-b border-slate-50 text-xs text-slate-400">
                        Showing <span className="font-semibold text-slate-600">{filteredVehicles.length}</span> of {vehicles.length} records
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold border-y border-slate-200">
                                    <th className="p-4">User</th>
                                    <th className="p-4">Make/Model</th>
                                    <th className="p-4">Type & CC</th>
                                    <th className="p-4">Odometer</th>
                                    <th className="p-4">Daily KM</th>
                                    <th className="p-4">Fuel/Day</th>
                                    <th className="p-4">Image</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredVehicles.map(vehicle => (
                                    <tr key={vehicle.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                {vehicle.users?.photo_url
                                                    ? <img src={vehicle.users.photo_url} alt="u" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                                                    : <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs">{vehicle.users?.name?.[0]}</div>}
                                                <div>
                                                    <div className="font-semibold text-slate-800">{vehicle.users?.name}</div>
                                                    {vehicle.users?.department && <div className="text-xs text-slate-400">{vehicle.users.department}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 font-medium text-slate-700">{vehicle.brand_name || '-'}</td>
                                        <td className="p-4">
                                            <div className="capitalize text-sm">{VEHICLE_TYPE_LABELS[vehicle.vehicle_type] || vehicle.vehicle_type || '-'}</div>
                                            <div className="text-xs text-slate-400 flex gap-1">
                                                {vehicle.engine_cc ? `${vehicle.engine_cc}cc` : ''}
                                                {vehicle.engine_cc && <span className="text-emerald-500 font-semibold">{getEfficiencyLabel(vehicle)}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono text-slate-700 text-sm">{vehicle.odometer_reading ? `${vehicle.odometer_reading.toLocaleString()} km` : '-'}</td>
                                        <td className="p-4 font-mono text-blue-600 font-semibold text-sm">
                                            {vehicle.odometer_reading ? (
                                                <div>
                                                    <div>{getLatestDailyKm(vehicle.user_id, travelLogs)} km</div>
                                                    <div className="text-[10px] text-slate-400 font-normal">latest active day</div>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-mono font-semibold text-amber-600 text-sm">
                                                {vehicle.odometer_reading ? `${getDailyLitres(vehicle, travelLogs).toFixed(2)} L` : '-'}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {vehicle.odometer_reading ? `₹${getDailyFuelCostGps(vehicle, travelLogs).toFixed(0)}/day (avg)` : ''}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {vehicle.odometer_picture_url
                                                ? <button onClick={() => setPreviewImage(getImageUrl(vehicle.odometer_picture_url))}
                                                    className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-emerald-500 transition-colors">
                                                    <img src={getImageUrl(vehicle.odometer_picture_url)} className="w-full h-full object-cover" alt="Odometer" />
                                                </button>
                                                : <span className="text-slate-300 text-xs">—</span>}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button onClick={() => setPreviewImage(getImageUrl(vehicle.odometer_picture_url))}
                                                    className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="View"><Eye className="h-4 w-4" /></button>
                                                <button onClick={() => setToast({ message: 'Edit functionality coming soon', type: 'info' })}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit className="h-4 w-4" /></button>
                                                <button onClick={() => handleDeleteClick(vehicle)}
                                                    className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredVehicles.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">No vehicles found.</div>}
                    </div>
                </div>
            )}

            {/* ── VERIFICATION TAB ── */}
            {activeTab === 'verification' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Odometer vs GPS Cross-Verification</h3>
                                <p className="text-xs text-slate-400">Comparing manual odometer updates vs automatic GPS travel engine calculations to identify discrepancies.</p>
                            </div>
                            <Button onClick={fetchVehicles} variant="outline" className="gap-2">
                                <RotateCw className="h-4 w-4" /> Re-Sync
                            </Button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold border-y border-slate-200">
                                        <th className="p-4">Employee & Vehicle</th>
                                        <th className="p-4">Odometer Delta</th>
                                        <th className="p-4">GPS Tracked (Period)</th>
                                        <th className="p-4">Variance</th>
                                        <th className="p-4">Verification Status</th>
                                        <th className="p-4">History</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {verificationData.map(data => (
                                        <React.Fragment key={data.userId}>
                                            <tr className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        {data.userPhoto
                                                            ? <img src={data.userPhoto} alt="u" className="w-9 h-9 rounded-full border border-slate-200 object-cover" />
                                                            : <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-sm">{data.userName[0]}</div>}
                                                        <div>
                                                            <div className="font-semibold text-slate-800">{data.userName}</div>
                                                            <div className="text-xs text-slate-400 capitalize">{data.vehicleBrand} ({VEHICLE_TYPE_LABELS[data.vehicleType] || data.vehicleType})</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    {data.submissionsCount > 1 ? (
                                                        <div>
                                                            <span className="font-mono font-bold text-slate-700">{data.claimedKm.toLocaleString()} km</span>
                                                            <div className="text-[10px] text-slate-400">
                                                                {data.odoStart} → {data.odoEnd} km
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <span className="text-slate-500 font-medium">Single Reading</span>
                                                            <div className="text-[10px] text-slate-400">Initial: {data.odoStart} km</div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <span className="font-mono font-bold text-blue-600">{data.gpsKm.toLocaleString()} km</span>
                                                    <div className="text-[10px] text-slate-400">
                                                        {data.submissionsCount > 1 ? `${data.earliestDate} - ${data.latestDate}` : `Since ${data.earliestDate}`}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    {data.submissionsCount > 1 ? (
                                                        <div>
                                                            <span className={`font-mono font-bold ${data.diff > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                                                                {data.diff > 0 ? `+${data.diff.toLocaleString()}` : data.diff.toLocaleString()} km
                                                            </span>
                                                            <div className="text-[10px] text-slate-400">
                                                                {data.variancePct}% variance
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <span className="text-slate-400 text-xs">—</span>
                                                            <div className="text-[10px] text-slate-400">All-time GPS: {data.totalGpsAllTime} km</div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                                                        ${data.status === 'verified' && 'bg-emerald-50 text-emerald-700 border border-emerald-100'}
                                                        ${data.status === 'warning' && 'bg-amber-50 text-amber-700 border border-amber-100'}
                                                        ${data.status === 'error' && 'bg-rose-50 text-rose-700 border border-rose-100'}
                                                        ${data.status === 'pending' && 'bg-blue-50 text-blue-700 border border-blue-100'}
                                                    `}>
                                                        {data.status === 'verified' && 'Verified Match'}
                                                        {data.status === 'warning' && 'Acceptable Var.'}
                                                        {data.status === 'error' && 'High Discrepancy'}
                                                        {data.status === 'pending' && 'Awaiting Update'}
                                                    </span>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{data.message}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-xs font-medium text-slate-600">
                                                        {data.submissionsCount} submissions
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* Submissions Detail Rollout */}
                                            <tr className="bg-slate-50/20">
                                                <td colSpan={6} className="px-6 py-4 border-b border-slate-100">
                                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Submission Audit Trail</div>
                                                    <div className="flex gap-4 overflow-x-auto pb-2">
                                                        {data.submissions.map((sub, idx) => (
                                                            <div key={sub.id} className="flex-shrink-0 bg-white border border-slate-100 rounded-xl p-3 shadow-sm min-w-[200px]">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-[10px] font-bold text-slate-400">
                                                                        #{idx + 1} · {format(new Date(sub.created_at), 'dd/MM/yyyy')}
                                                                    </span>
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${sub.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                        {sub.status}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                                    <div>
                                                                        <div className="text-xs text-slate-400">Odometer</div>
                                                                        <div className="text-sm font-bold text-slate-800 font-mono">{sub.odometer_reading.toLocaleString()} km</div>
                                                                    </div>
                                                                    {sub.odometer_picture_url && (
                                                                        <button onClick={() => setPreviewImage(getImageUrl(sub.odometer_picture_url))}
                                                                            className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-emerald-500 transition-colors">
                                                                            <img src={getImageUrl(sub.odometer_picture_url)} className="w-full h-full object-cover" alt="Odometer" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    ))}
                                    {verificationData.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">No vehicles or odometer data submitted yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Modal ── */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Vehicle">
                <div className="p-6 text-center">
                    <Trash2 className="h-12 w-12 text-rose-500 mx-auto mb-4 opacity-80" />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Vehicle Record?</h3>
                    <p className="text-slate-500 mb-6">This action cannot be undone.</p>
                    <div className="flex gap-3 justify-center">
                        <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                        <Button variant="danger" onClick={confirmDelete}>Delete</Button>
                    </div>
                </div>
            </Modal>

            {/* ── Report Modal ── */}
            <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} title="Export Fuel & Vehicle Report">
                <div className="p-6">
                    <p className="text-slate-500 text-sm mb-6">Download a CSV with daily KM, litres consumed and fuel cost per employee.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Filter by Employee</label>
                            <select value={reportUser} onChange={e => setReportUser(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                <option value="all">All Employees</option>
                                {uniqueUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Filter by Vehicle Type</label>
                            <select value={reportType} onChange={e => setReportType(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                <option value="all">All Types</option>
                                <option value="two_wheeler">Two Wheeler</option>
                                <option value="four_wheeler">Four Wheeler (Petrol)</option>
                                <option value="four_wheeler_diesel">Four Wheeler (Diesel)</option>
                            </select>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-4 text-sm text-emerald-700">
                            <span className="font-bold">
                                {vehicles.filter(v => (reportUser === 'all' || v.user_id === reportUser) && (reportType === 'all' || v.vehicle_type === reportType)).length}
                            </span> records · Includes daily KM, litres & cost columns.
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <Button variant="outline" onClick={() => setIsReportModalOpen(false)} className="flex-1">Cancel</Button>
                        <Button onClick={exportCSV} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Download className="h-4 w-4" /> Download CSV
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Image Preview ── */}
            {previewImage && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden bg-black shadow-2xl" onClick={e => e.stopPropagation()}>
                        <img src={previewImage} alt="Odometer" className="w-full h-full object-contain max-h-[90vh]" />
                        <button className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full h-10 w-10 flex items-center justify-center"
                            onClick={() => setPreviewImage(null)}>✕</button>
                    </div>
                </div>
            )}
            {/* ── Toast ── */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onDismiss={() => setToast(null)}
                />
            )}
        </div>
    );
}
