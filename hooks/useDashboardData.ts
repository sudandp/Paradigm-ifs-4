import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { getStaffCategory } from '../utils/attendanceCalculations';
import { calculatePerDayRate } from '../utils/siteStaffCalculations';
import { format, eachDayOfInterval, startOfMonth } from 'date-fns';
import type { Entity } from '../types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface TodayMetrics {
    present: number;
    absent: number;
    late: number;
    total: number;
}

export interface WeeklyData {
    labels: string[];
    present: number[];
    absent: number[];
}

export interface DesignationBreakdownData {
    labels: string[];
    values: number[];
}

export interface BillingSummary {
    totalCost: number;
    totalDuties: number;
    configuredUsersCount: number;
    isRatesConfigured: boolean;
}

export interface SiteTrend {
    name: string;
    count: number;
    pctChange: number;
}

export interface DashboardData {
    isLoading: boolean;
    siteUsers: any[];
    attendanceEvents: any[];
    leaveRequests: any[];
    approvedLeavesCount: number;
    siteStaffConfigs: any[];
    siteHolidays: any[];
    todayMetrics: TodayMetrics;
    weeklyData: WeeklyData;
    designationBreakdown: DesignationBreakdownData;
    billingSummary: BillingSummary;
    siteTrendData: SiteTrend[];
    toast: { message: string; type: 'success' | 'warning' | 'error' } | null;
    setToast: (t: { message: string; type: 'success' | 'warning' | 'error' } | null) => void;
    fetchDashboardData: () => Promise<void>;
    startDate: Date;
    endDate: Date;
    setStartDate: (d: Date) => void;
    setEndDate: (d: Date) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const isOfficeRole = (roleName?: string) => {
    const cat = getStaffCategory(roleName || '', undefined, {
        roleMapping: {
            office: ['admin', 'hr', 'finance', 'developer', 'hr_ops', 'management', 'back_office_staff', 'accountant'],
            field: ['field_staff', 'field_officer', 'technical_reliever', 'supervisor', 'site_supervisor', 'operation_manager'],
            site: ['site_manager', 'security_guard']
        }
    });
    return cat === 'office';
};

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Shared dashboard data hook — fetches and computes all KPI metrics
 * used by Client, Site, and Operations dashboards.
 */
export function useDashboardData(
    allowedSites: Entity[],
    selectedSiteId: string | undefined,
    options?: { isOfficeOnly?: boolean; officeLocation?: 'all' | 'Hyderabad' | 'Bangalore' }
): DashboardData {
    const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [siteUsers, setSiteUsers] = useState<any[]>([]);
    const [attendanceEvents, setAttendanceEvents] = useState<any[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
    const [approvedLeavesCount, setApprovedLeavesCount] = useState<number>(0);
    const [siteStaffConfigs, setSiteStaffConfigs] = useState<any[]>([]);
    const [siteHolidays, setSiteHolidays] = useState<any[]>([]);

    // ── Fetch ───────────────────────────────────────────────────────────────

    const fetchDashboardData = useCallback(async () => {
        if (!selectedSiteId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 30) {
                setToast({
                    message: "Historical date range restricted to a maximum of 30 days to optimize load performance.",
                    type: "warning"
                });
                const clampedEndDate = new Date(startDate);
                clampedEndDate.setDate(startDate.getDate() + 30);
                setEndDate(clampedEndDate);
                return;
            }

            const startStr = format(startDate, 'yyyy-MM-dd') + 'T00:00:00.000Z';
            const endStr = format(endDate, 'yyyy-MM-dd') + 'T23:59:59.999Z';

            const [
                usersList,
                eventsList,
                leavesList,
                billingConfigs,
                holidaysList,
                orgStructure
            ] = await Promise.all([
                api.getUsers({ fetchAll: true }),
                api.getAllAttendanceEvents(startStr, endStr),
                api.getLeaveRequests({ status: ['pending_manager_approval', 'pending_hr_confirmation', 'approved'] }),
                api.getAllSiteStaffConfigs(),
                api.getSiteSpecificHolidays && selectedSiteId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedSiteId)
                    ? api.getSiteSpecificHolidays(selectedSiteId)
                    : Promise.resolve([]),
                api.getOrganizationStructure()
            ]);

            // Build the set of allowed site IDs
            const allowedSiteIds = new Set(allowedSites.map(s => s.id));

            // Helper to resolve user's base location
            const resolveUserLoc = (user: any) => {
                if (user.location || user.locationName) return user.location || user.locationName;
                if (!user.societyId || !orgStructure) return '';
                for (const group of orgStructure) {
                    for (const company of group.companies || []) {
                        if (company.id === user.societyId) {
                            return company.location || '';
                        }
                    }
                }
                return '';
            };

            // Filter users to selected site
            const selectedSiteIds = selectedSiteId === 'all'
                ? [] : (selectedSiteId || '').split(',').map(s => s.trim());
            const filteredSiteUsers = (usersList || []).filter((u: any) => {
                const isOffice = isOfficeRole(u.role);
                if (options?.isOfficeOnly) {
                    if (!isOffice) return false;
                    
                    // Filter by officeLocation
                    if (options.officeLocation && options.officeLocation !== 'all') {
                        const loc = (resolveUserLoc(u) || '').toLowerCase();
                        const target = options.officeLocation.toLowerCase();
                        if (target === 'hyderabad') {
                            if (!loc.includes('hyd') && !loc.includes('secunderabad')) return false;
                        } else if (target === 'bangalore') {
                            if (!loc.includes('bangalore') && !loc.includes('bengaluru') && !loc.includes('blr')) return false;
                        }
                    }
                } else {
                    if (isOffice) return false;
                }

                if (selectedSiteId === 'all') {
                    if (!u.organizationId) {
                        return !!options?.isOfficeOnly;
                    }
                    const userSiteIds = u.organizationId.split(',').map((s: string) => s.trim());
                    return userSiteIds.some((id: string) => allowedSiteIds.has(id));
                }

                if (!u.organizationId) return false;
                const userSiteIds = u.organizationId.split(',').map((s: string) => s.trim());
                return selectedSiteIds.some(id => userSiteIds.includes(id));
            });

            const mappedSiteUsers = filteredSiteUsers.map((u: any) => ({
                ...u,
                baseLocation: resolveUserLoc(u) || 'N/A'
            }));
            setSiteUsers(mappedSiteUsers);

            const siteUserIds = new Set(mappedSiteUsers.map((u: any) => u.id));

            const filteredEvents = (eventsList || []).filter((e: any) => siteUserIds.has(e.userId));
            setAttendanceEvents(filteredEvents);

            const normalizedLeaves = (Array.isArray(leavesList) ? leavesList : (leavesList as any)?.data || []).filter(Boolean);

            const filteredPendingLeaves = normalizedLeaves.filter((l: any) =>
                siteUserIds.has(l.userId) &&
                (l.status === 'pending_manager_approval' || l.status === 'pending_hr_confirmation')
            );
            setLeaveRequests(filteredPendingLeaves);

            const countApproved = normalizedLeaves.filter((l: any) => {
                if (!siteUserIds.has(l.userId)) return false;
                if (l.status !== 'approved') return false;
                const start = l.startDate || l.start_date;
                const end = l.endDate || l.end_date;
                if (!start || !end) return false;
                const lStart = new Date(start);
                const lEnd = new Date(end);
                const rangeStart = new Date(startDate);
                rangeStart.setHours(0, 0, 0, 0);
                const rangeEnd = new Date(endDate);
                rangeEnd.setHours(23, 59, 59, 999);
                return lStart <= rangeEnd && lEnd >= rangeStart;
            }).length;
            setApprovedLeavesCount(countApproved);

            setSiteStaffConfigs(billingConfigs || []);
            setSiteHolidays(holidaysList || []);
        } catch (error) {
            console.error("[useDashboardData] Failed to load metrics:", error);
            setToast({ message: "Failed to fetch metrics. Please try again.", type: "error" });
        } finally {
            setIsLoading(false);
        }
    }, [selectedSiteId, startDate, endDate, allowedSites, options?.officeLocation]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    // ── Computed Metrics ────────────────────────────────────────────────────

    const todayMetrics = useMemo((): TodayMetrics => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todayEvents = attendanceEvents.filter(e => {
            const datePart = e.timestamp ? e.timestamp.substring(0, 10) : '';
            return datePart === todayStr;
        });

        const presentUserIds = new Set(
            todayEvents.filter(e => e.type === 'punch-in' || e.type === 'site-in').map(e => e.userId)
        );

        const presentCount = presentUserIds.size;
        const totalCount = siteUsers.length;
        const absentCount = Math.max(0, totalCount - presentCount);

        let lateArrivalsToday = 0;
        const userPunchIns: Record<string, any[]> = {};
        todayEvents.forEach(e => {
            if (e.type === 'punch-in' || e.type === 'site-in') {
                if (!userPunchIns[e.userId]) userPunchIns[e.userId] = [];
                userPunchIns[e.userId].push(e);
            }
        });
        Object.values(userPunchIns).forEach(punches => {
            punches.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const timeStr = punches[0].timestamp?.substring(11, 16);
            if (timeStr && timeStr > '09:30') lateArrivalsToday++;
        });

        return { present: presentCount, absent: absentCount, late: lateArrivalsToday, total: totalCount };
    }, [siteUsers, attendanceEvents]);

    const weeklyData = useMemo((): WeeklyData => {
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const labels = days.map(d => format(d, 'dd MMM'));
        const present: number[] = [];
        const absent: number[] = [];

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayEvents = attendanceEvents.filter(e => e.timestamp?.substring(0, 10) === dateStr);
            const presentIds = new Set(
                dayEvents.filter(e => e.type === 'punch-in' || e.type === 'site-in').map(e => e.userId)
            );
            present.push(presentIds.size);
            absent.push(Math.max(0, siteUsers.length - presentIds.size));
        });

        return { labels, present, absent };
    }, [startDate, endDate, attendanceEvents, siteUsers]);

    const siteTrendData = useMemo((): SiteTrend[] => {
        if (!allowedSites.length || selectedSiteId !== 'all') return [];

        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const midIdx = Math.floor(days.length / 2);
        const firstHalf = days.slice(0, midIdx || 1).map(d => format(d, 'yyyy-MM-dd'));
        const secondHalf = days.slice(midIdx).map(d => format(d, 'yyyy-MM-dd'));

        return allowedSites.map(site => {
            const siteUserIds = new Set(
                (siteUsers as any[]).filter(u => {
                    if (!u.organizationId) return false;
                    return u.organizationId.split(',').map((s: string) => s.trim()).includes(site.id);
                }).map(u => u.id)
            );

            if (siteUserIds.size === 0) return null;

            const countPresent = (dates: string[]) => {
                const presentIds = new Set<string>();
                attendanceEvents.forEach((e: any) => {
                    const d = e.timestamp?.substring(0, 10);
                    if (dates.includes(d) && siteUserIds.has(e.userId) && (e.type === 'punch-in' || e.type === 'site-in')) {
                        presentIds.add(e.userId);
                    }
                });
                return presentIds.size;
            };

            const firstCount = countPresent(firstHalf);
            const secondCount = countPresent(secondHalf);
            const pctChange = firstCount === 0
                ? (secondCount > 0 ? 100 : 0)
                : Math.round(((secondCount - firstCount) / firstCount) * 100);

            return { name: site.name, count: secondCount, pctChange };
        }).filter(Boolean) as SiteTrend[];
    }, [allowedSites, selectedSiteId, startDate, endDate, attendanceEvents, siteUsers]);

    const designationBreakdown = useMemo((): DesignationBreakdownData => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todayEvents = attendanceEvents.filter(e => e.timestamp?.substring(0, 10) === todayStr);
        const presentUserIds = new Set(
            todayEvents.filter(e => e.type === 'punch-in' || e.type === 'site-in').map(e => e.userId)
        );

        const counts: Record<string, number> = {};
        presentUserIds.forEach(uid => {
            const userObj = siteUsers.find(u => u.id === uid);
            if (userObj) {
                const rawRole = userObj.designation || userObj.role || 'Staff';
                const label = rawRole
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c: string) => c.toUpperCase());
                counts[label] = (counts[label] || 0) + 1;
            }
        });

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const labels = sorted.map(([k]) => k);
        const values = sorted.map(([, v]) => v);

        return {
            labels: labels.length > 0 ? labels : ['No Present Staff'],
            values: values.length > 0 ? values : [0]
        };
    }, [attendanceEvents, siteUsers]);

    const billingSummary = useMemo((): BillingSummary => {
        let totalCost = 0;
        let totalDuties = 0;
        let configuredUsersCount = 0;

        const days = eachDayOfInterval({ start: startDate, end: endDate });

        siteUsers.forEach(u => {
            const config = siteStaffConfigs.find(c => c.userId === u.id);
            if (!config) return;

            configuredUsersCount++;
            const perDayRate = config.perDayBillingRate || calculatePerDayRate(config).perDayBillingRate || 0;

            let userDuties = 0;
            days.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isUserPresent = attendanceEvents.some(e =>
                    e.userId === u.id &&
                    e.timestamp?.substring(0, 10) === dateStr &&
                    (e.type === 'punch-in' || e.type === 'site-in')
                );

                if (isUserPresent) {
                    const isHoliday = siteHolidays.some(h => h.date === dateStr);
                    if (isHoliday && config.nhBillingConfig === 'Double') {
                        userDuties += 2;
                    } else if (isHoliday && config.nhBillingConfig === 'Actuals') {
                        userDuties += 1.5;
                    } else {
                        userDuties += 1;
                    }
                }
            });

            totalDuties += userDuties;
            totalCost += userDuties * perDayRate;
        });

        const isRatesConfigured = configuredUsersCount > 0 || siteUsers.length === 0;

        return { totalCost, totalDuties, configuredUsersCount, isRatesConfigured };
    }, [siteUsers, siteStaffConfigs, attendanceEvents, siteHolidays, startDate, endDate]);

    return {
        isLoading,
        siteUsers,
        attendanceEvents,
        leaveRequests,
        approvedLeavesCount,
        siteStaffConfigs,
        siteHolidays,
        todayMetrics,
        weeklyData,
        designationBreakdown,
        billingSummary,
        siteTrendData,
        toast,
        setToast,
        fetchDashboardData,
        startDate,
        endDate,
        setStartDate,
        setEndDate,
    };
}
