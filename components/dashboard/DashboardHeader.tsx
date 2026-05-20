import React from 'react';
import { RefreshCw, Calendar } from 'lucide-react';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { format } from 'date-fns';
import type { Entity } from '../../types';

interface DashboardHeaderProps {
    title: string;
    subtitle?: string;
    sites: Entity[];
    selectedSiteId: string | undefined;
    onSiteChange: (siteId: string) => void;
    canSelectSite: boolean;
    activeSiteName: string;
    startDate: Date;
    endDate: Date;
    onStartDateChange: (d: Date) => void;
    onEndDateChange: (d: Date) => void;
    onRefresh: () => void;
    isLoading: boolean;
    extraControls?: React.ReactNode;
    showDateRange?: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    title,
    subtitle,
    sites,
    selectedSiteId,
    onSiteChange,
    canSelectSite,
    activeSiteName,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    onRefresh,
    isLoading,
    extraControls,
    showDateRange = true,
}) => {
    return (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                {/* Title + Site Name */}
                <div className="flex-shrink-0">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {subtitle || <>Viewing: <span className="font-semibold text-emerald-700">{activeSiteName}</span></>}
                    </p>
                </div>

                {/* Controls Row */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Site Selector */}
                    {canSelectSite && (
                        <div className="w-48">
                            <Select
                                label=""
                                id="dashboard-site-selector"
                                value={selectedSiteId || ''}
                                onChange={e => onSiteChange(e.target.value)}
                            >
                                <option value="all">All Sites</option>
                                {sites.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </Select>
                        </div>
                    )}

                    {extraControls}

                    {/* Date Range */}
                    {showDateRange && (
                        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-200">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <input
                                type="date"
                                value={format(startDate, 'yyyy-MM-dd')}
                                onChange={e => onStartDateChange(new Date(e.target.value + 'T00:00:00'))}
                                className="bg-transparent text-sm text-slate-700 border-0 outline-none w-[120px]"
                            />
                            <span className="text-slate-400 text-xs">to</span>
                            <input
                                type="date"
                                value={format(endDate, 'yyyy-MM-dd')}
                                onChange={e => onEndDateChange(new Date(e.target.value + 'T00:00:00'))}
                                className="bg-transparent text-sm text-slate-700 border-0 outline-none w-[120px]"
                            />
                        </div>
                    )}

                    {/* Refresh */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        className="border-slate-200 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default DashboardHeader;
