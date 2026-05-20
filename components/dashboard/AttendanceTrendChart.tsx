import React, { useRef, useEffect, useMemo } from 'react';
import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface AttendanceTrendChartProps {
    data: { labels: string[]; present: number[]; absent: number[] };
}

const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({ data }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        if (chartRef.current) {
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                chartInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: data.labels,
                        datasets: [
                            {
                                label: 'Present',
                                data: data.present,
                                backgroundColor: '#006B3F',
                                borderColor: '#005632',
                                borderWidth: 1,
                                borderRadius: 2,
                            },
                            {
                                label: 'Absent',
                                data: data.absent,
                                backgroundColor: '#EF4444',
                                borderColor: '#DC2626',
                                borderWidth: 1,
                                borderRadius: 2,
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(128,128,128,0.1)' },
                                ticks: { stepSize: 1, precision: 0 }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { maxRotation: 0, minRotation: 0, autoSkip: true, maxTicksLimit: 7 }
                            }
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'bottom',
                                labels: {
                                    usePointStyle: true,
                                    boxWidth: 8,
                                    padding: 15,
                                    font: { family: "'Inter', sans-serif", size: 12 }
                                }
                            },
                            tooltip: {
                                backgroundColor: '#0F172A',
                                cornerRadius: 4,
                                padding: 8,
                                displayColors: true,
                            }
                        }
                    }
                });
            }
        }
        return () => { chartInstance.current?.destroy(); };
    }, [data]);

    return (
        <div className="h-64 relative w-full">
            <canvas ref={chartRef}></canvas>
        </div>
    );
};

export default AttendanceTrendChart;
