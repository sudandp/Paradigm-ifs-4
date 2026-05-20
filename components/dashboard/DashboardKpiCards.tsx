import React from 'react';
import { Users, UserCheck, UserX, Clock, AlertTriangle, CheckCircle2, Ban } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { TodayMetrics } from '../../hooks/useDashboardData';

interface DashboardKpiCardsProps {
    todayMetrics: TodayMetrics;
    pendingLeaves: number;
    approvedLeaves: number;
}

const KpiCard: React.FC<{
    label: string;
    value: number;
    icon: React.ReactNode;
    accentColor: string;
    borderColor: string;
    subtitle?: string;
}> = ({ label, value, icon, accentColor, borderColor, subtitle }) => (
    <div
        className="bg-white rounded-2xl p-5 border-l-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group"
        style={{ borderLeftColor: borderColor }}
    >
        <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500 tracking-wide">{label}</span>
            <div className="p-2 rounded-xl group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: accentColor }}>
                {icon}
            </div>
        </div>
        <p className="text-3xl font-bold text-slate-800">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
);

const DashboardKpiCards: React.FC<DashboardKpiCardsProps> = ({ todayMetrics, pendingLeaves, approvedLeaves }) => {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
                label="Total Staff"
                value={todayMetrics.total}
                icon={<Users className="h-5 w-5 text-white" />}
                accentColor="#006B3F"
                borderColor="#006B3F"
                subtitle="Allocated"
            />
            <KpiCard
                label="Present Today"
                value={todayMetrics.present}
                icon={<UserCheck className="h-5 w-5 text-white" />}
                accentColor="#10B981"
                borderColor="#10B981"
                subtitle={todayMetrics.total > 0 ? `${Math.round((todayMetrics.present / todayMetrics.total) * 100)}%` : '0%'}
            />
            <KpiCard
                label="Absent Today"
                value={todayMetrics.absent}
                icon={<UserX className="h-5 w-5 text-white" />}
                accentColor="#EF4444"
                borderColor="#EF4444"
            />
            <KpiCard
                label="Late Arrivals"
                value={todayMetrics.late}
                icon={<Clock className="h-5 w-5 text-white" />}
                accentColor="#F59E0B"
                borderColor="#F59E0B"
                subtitle="After 09:30 AM"
            />
            <KpiCard
                label="Pending Leaves"
                value={pendingLeaves}
                icon={<AlertTriangle className="h-5 w-5 text-white" />}
                accentColor="#06B6D4"
                borderColor="#06B6D4"
                subtitle={`${approvedLeaves} approved`}
            />
        </div>
    );
};

export default DashboardKpiCards;
