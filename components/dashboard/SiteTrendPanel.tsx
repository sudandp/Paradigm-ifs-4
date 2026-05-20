import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { SiteTrend } from '../../hooks/useDashboardData';

interface SiteTrendPanelProps {
    data: SiteTrend[];
}

const SiteTrendPanel: React.FC<SiteTrendPanelProps> = ({ data }) => {
    if (data.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Site-wise Attendance Trend</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Site</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Present (Recent)</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Trend</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(site => (
                            <tr key={site.name} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <td className="py-2.5 px-3 font-medium text-slate-700">{site.name}</td>
                                <td className="py-2.5 px-3 text-right text-slate-700 font-semibold">{site.count}</td>
                                <td className="py-2.5 px-3 text-right">
                                    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${
                                        site.pctChange > 0 ? 'text-emerald-600' : site.pctChange < 0 ? 'text-rose-500' : 'text-slate-400'
                                    }`}>
                                        {site.pctChange > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : site.pctChange < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : null}
                                        {site.pctChange > 0 ? '+' : ''}{site.pctChange}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SiteTrendPanel;
