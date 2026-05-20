import React, { useRef, useEffect, useMemo } from 'react';
import {
    Chart,
    DoughnutController,
    ArcElement,
    Tooltip,
    Legend,
} from 'chart.js';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

const DESIGNATION_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#EC4899', '#06B6D4', '#006B3F', '#6B7280',
];

interface DesignationBreakdownChartProps {
    data: { labels: string[]; values: number[] };
}

const DesignationBreakdownChart: React.FC<DesignationBreakdownChartProps> = ({ data }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    const total = data.values.reduce((a, b) => a + b, 0);
    const isEmpty = total === 0 || (data.labels.length === 1 && data.labels[0] === 'No Present Staff');

    const sortedEntries = useMemo(() => {
        const raw = data.labels.map((label, i) => ({
            label,
            value: data.values[i] || 0,
            pct: total > 0 ? Math.round(((data.values[i] || 0) / total) * 100) : 0,
            color: DESIGNATION_COLORS[i % DESIGNATION_COLORS.length],
        }));
        return [...raw].sort((a, b) => b.value - a.value);
    }, [data, total]);

    const displayEntries = useMemo(() => {
        if (isEmpty) return [];
        const maxRings = 4;
        if (sortedEntries.length <= maxRings) return sortedEntries;

        const top = sortedEntries.slice(0, maxRings - 1);
        const remainder = sortedEntries.slice(maxRings - 1);
        const remainderValue = remainder.reduce((sum, e) => sum + e.value, 0);
        const remainderPct = total > 0 ? Math.round((remainderValue / total) * 100) : 0;

        return [
            ...top,
            { label: 'Others', value: remainderValue, pct: remainderPct, color: '#94A3B8' }
        ];
    }, [sortedEntries, isEmpty, total]);

    useEffect(() => {
        if (!chartRef.current) return;
        if (chartInstance.current) chartInstance.current.destroy();

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;

        if (isEmpty) {
            chartInstance.current = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
            });
            return () => { chartInstance.current?.destroy(); };
        }

        const datasets = displayEntries.map((entry) => ({
            label: entry.label,
            data: [entry.value, total - entry.value],
            backgroundColor: [entry.color, '#f1f5f9'],
            borderColor: '#ffffff',
            borderWidth: 3,
            borderRadius: 2,
            hoverOffset: 0,
        }));

        chartInstance.current = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Active', 'Remaining'], datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '40%',
                animation: { animateRotate: true, duration: 900, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#1e293b',
                        titleFont: { family: "'Inter', sans-serif", size: 12, weight: 'bold' },
                        bodyFont: { family: "'Inter', sans-serif", size: 11 },
                        padding: 10,
                        cornerRadius: 8,
                        filter: (item) => item.dataIndex === 0,
                        callbacks: {
                            title: (items) => displayEntries[items[0].datasetIndex]?.label || '',
                            label: (item) => {
                                const val = item.raw as number;
                                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                return ` ${val} staff (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });

        return () => { chartInstance.current?.destroy(); };
    }, [displayEntries, isEmpty, total]);

    return (
        <div className="flex items-center gap-6 w-full" data-lpignore="true" data-form-type="other" data-autofill="false">
            <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }} data-lpignore="true" data-form-type="other" data-autofill="false">
                <canvas ref={chartRef} width={160} height={160} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" data-lpignore="true" data-form-type="other" data-autofill="false">
                    <span className="text-[26px] font-bold text-slate-800 leading-none">{isEmpty ? 0 : total}</span>
                </div>
            </div>
            <div className="flex-1 min-w-0 space-y-2.5">
                {isEmpty ? (
                    <p className="text-xs text-slate-400 italic">No present staff today</p>
                ) : (
                    displayEntries.map((entry) => (
                        <div key={entry.label} className="flex items-center gap-2">
                            <span className="flex-shrink-0 h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-[13px] text-slate-700 font-medium">{entry.label}:</span>
                            <span className="text-[13px] font-bold text-slate-900">{entry.pct}%</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DesignationBreakdownChart;
