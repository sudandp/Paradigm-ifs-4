import React from 'react';
import { IndianRupee, CheckCircle2, BarChart3 } from 'lucide-react';
import type { BillingSummary } from '../../hooks/useDashboardData';

interface BillingSummaryPanelProps {
    billing: BillingSummary;
    siteUsersCount: number;
}

const BillingSummaryPanel: React.FC<BillingSummaryPanelProps> = ({ billing, siteUsersCount }) => {
    if (!billing.isRatesConfigured && siteUsersCount > 0) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-center gap-3 text-amber-700">
                    <BarChart3 className="h-5 w-5" />
                    <p className="text-sm font-medium">
                        Billing rates not configured for staff at this site. Configure rates in Site Configuration to see financial projections.
                    </p>
                </div>
            </div>
        );
    }

    if (siteUsersCount === 0) return null;

    return (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-emerald-600" />
                Billing Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Duties</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{billing.totalDuties.toFixed(1)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Estimated Billing</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">₹{billing.totalCost.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Configured Staff</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">
                        {billing.configuredUsersCount}
                        <span className="text-sm font-normal text-slate-400 ml-1">/ {siteUsersCount}</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BillingSummaryPanel;
