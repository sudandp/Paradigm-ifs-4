import React from 'react';
import { format } from 'date-fns';
import { ClipboardList } from 'lucide-react';
import type { BasicReportDataRow, AttendanceLogDataRow, SiteOtDataRow, MonthlyReportRow, WorkHoursReportDataRow } from '../../pages/attendance/PDFReports';

// --- SHARED ---
const ReportHeader: React.FC<{ title: string; subtitle: string; logoUrl?: string; generatedBy?: string }> = ({ title, subtitle, logoUrl, generatedBy }) => (
    <div className="flex justify-between items-center border-b-2 border-gray-900 pb-4 mb-6 print:mb-4">
        <div className="flex-1">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 w-auto mb-1" />}
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Paradigm Services</p>
        </div>
        <div className="text-right flex-1">
            <h1 className="text-xl font-bold uppercase tracking-tight text-gray-900">{title}</h1>
            <p className="text-sm text-gray-600 font-medium">{subtitle}</p>
            <p className="text-[10px] text-gray-400 mt-1">Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            {generatedBy && <p className="text-[10px] text-gray-400">By: {generatedBy}</p>}
        </div>
    </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
        <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
        <p className="font-medium">{message}</p>
    </div>
);

const Footer: React.FC<{ label?: string }> = ({ label }) => (
    <div className="mt-6 pt-3 border-t border-gray-100 text-center text-[10px] text-gray-300 font-medium uppercase tracking-widest">
        {label || '© Paradigm Services - System Generated'}
    </div>
);

// --- 1. BASIC ATTENDANCE REPORT ---
export const BasicReportView: React.FC<{
    data: BasicReportDataRow[];
    dateRange: { startDate: Date; endDate: Date };
    logoUrl?: string;
    generatedBy?: string;
}> = ({ data, dateRange, logoUrl, generatedBy }) => {
    const subtitle = (dateRange?.startDate && dateRange?.endDate)
        ? `${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}`
        : 'Period Not Specified';

    if (!data.length) return <EmptyState message="No attendance data found for this period." />;

    return (
        <div className="bg-white p-6 shadow-sm rounded-xl">
            <ReportHeader title="Basic Attendance Report" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} />
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-3 py-2 border border-gray-300 font-bold text-left">Employee</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Date</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Status</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Check In</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Check Out</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-3 py-1.5 border border-gray-200 font-medium text-left">{row.userName}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.date}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center font-bold">
                                    <span className={
                                        row.status === 'P' ? 'text-green-600' :
                                        row.status === 'A' ? 'text-red-500' :
                                        row.status.includes('P') ? 'text-green-600' :
                                        'text-blue-500'
                                    }>{row.status}</span>
                                </td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.checkIn}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.checkOut}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.duration}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Footer />
        </div>
    );
};

// --- 2. DETAILED ATTENDANCE LOG ---
export const AttendanceLogView: React.FC<{
    data: AttendanceLogDataRow[];
    dateRange: { startDate: Date; endDate: Date };
    logoUrl?: string;
    generatedBy?: string;
}> = ({ data, dateRange, logoUrl, generatedBy }) => {
    const subtitle = (dateRange?.startDate && dateRange?.endDate)
        ? `${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}`
        : 'Period Not Specified';

    if (!data.length) return <EmptyState message="No log events recorded for this period." />;

    return (
        <div className="bg-white p-6 shadow-sm rounded-xl">
            <ReportHeader title="Detailed Attendance Log" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} />
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-3 py-2 border border-gray-300 font-bold text-left">Employee</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Date</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Time</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Type</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-left">Location</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-left">Device</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-3 py-1.5 border border-gray-200 font-medium">{row.userName}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.date}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.time}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center font-bold uppercase">
                                    <span className={row.type === 'in' ? 'text-green-600' : 'text-orange-600'}>{row.type}</span>
                                </td>
                                <td className="px-3 py-1.5 border border-gray-200 text-xs text-gray-600">{row.locationName}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-[10px] text-gray-400 italic">{row.device || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Footer label="Paradigm Services - Detailed Logs" />
        </div>
    );
};

// --- 3. MONTHLY STATUS REPORT ---
export const MonthlyStatusView: React.FC<{
    data: MonthlyReportRow[];
    dateRange: { startDate: Date; endDate: Date };
    logoUrl?: string;
    generatedBy?: string;
    days?: Date[];
}> = ({ data, dateRange, logoUrl, generatedBy, days }) => {
    const subtitle = (dateRange?.startDate && dateRange?.endDate)
        ? `${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}`
        : 'Period Not Specified';

    const dayHeaders = data.length > 0
        ? Array.from({ length: data[0].statuses.length }, (_, i) => i + 1)
        : [];

    if (!data.length) return <EmptyState message="No monthly status records found." />;

    const getStatusColor = (s: string) => {
        if (s === 'P') return 'text-green-600';
        if (s === 'A') return 'text-red-500';
        if (s === 'W/O') return 'text-gray-400';
        if (s === 'H' || s === 'HP') return 'text-orange-500';
        if (s.includes('F/H')) return 'text-yellow-600';
        if (s.includes('1/2')) return 'text-blue-500';
        if (s.includes('P')) return 'text-green-600';
        if (s.includes('S/L') || s.includes('E/L') || s.includes('C/O')) return 'text-blue-600';
        if (s === '-') return 'text-gray-300';
        return 'text-gray-700';
    };

    return (
        <div className="bg-white p-6 shadow-sm rounded-xl">
            <ReportHeader title="Monthly Attendance Report" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} />
            <div className="overflow-x-auto">
                <table className="w-full text-[9px] border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-2 py-1.5 border border-gray-300 font-bold sticky left-0 bg-gray-100 z-10 min-w-[100px] text-left">Employee</th>
                            {dayHeaders.map(d => (
                                <th key={d} className="px-0.5 py-1.5 border border-gray-200 font-semibold text-center text-gray-400 min-w-[22px]">{d}</th>
                            ))}
                            <th className="px-1 py-1.5 border border-gray-300 font-bold text-center bg-blue-50 text-blue-800 min-w-[28px]">P</th>
                            <th className="px-1 py-1.5 border border-gray-300 font-bold text-center bg-red-50 text-red-700 min-w-[28px]">A</th>
                            <th className="px-1 py-1.5 border border-gray-300 font-bold text-center bg-gray-50 min-w-[28px]">W/O</th>
                            <th className="px-1 py-1.5 border border-gray-300 font-bold text-center bg-orange-50 text-orange-700 min-w-[28px]">H</th>
                            <th className="px-1 py-1.5 border border-gray-300 font-bold text-center bg-green-50 text-green-700 min-w-[36px]">Pay</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-100">
                                <td className="px-2 py-1 border border-gray-200 font-medium sticky left-0 bg-white z-10 whitespace-nowrap">{row.userName}</td>
                                {row.statuses.map((status, sIdx) => (
                                    <td key={sIdx} className="px-0 py-1 border border-gray-100 text-center font-bold leading-tight">
                                        <span className={getStatusColor(status)}>{status}</span>
                                    </td>
                                ))}
                                <td className="px-1 py-1 border border-gray-200 text-center font-bold text-blue-700 bg-blue-50/30">{row.presentDays}</td>
                                <td className="px-1 py-1 border border-gray-200 text-center font-bold text-red-500">{row.absentDays}</td>
                                <td className="px-1 py-1 border border-gray-200 text-center text-gray-500">{row.weekOffs}</td>
                                <td className="px-1 py-1 border border-gray-200 text-center text-orange-600">{row.holidays}</td>
                                <td className="px-1 py-1 border border-gray-200 text-center font-bold text-green-700 bg-green-50/30">{row.totalPayableDays}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-bold uppercase">
                <span className="flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded bg-green-600 inline-block" /> P: Present</span>
                <span className="flex items-center gap-1 text-red-500"><span className="w-2 h-2 rounded bg-red-500 inline-block" /> A: Absent</span>
                <span className="flex items-center gap-1 text-blue-500"><span className="w-2 h-2 rounded bg-blue-500 inline-block" /> 1/2P: Half Day</span>
                <span className="flex items-center gap-1 text-gray-400"><span className="w-2 h-2 rounded bg-gray-400 inline-block" /> W/O: Weekly Off</span>
                <span className="flex items-center gap-1 text-orange-500"><span className="w-2 h-2 rounded bg-orange-500 inline-block" /> H: Holiday</span>
            </div>
            <Footer label="Paradigm Services - Monthly Status Report" />
        </div>
    );
};

// --- 4. SITE OT REPORT ---
export const SiteOtReportView: React.FC<{
    data: SiteOtDataRow[];
    dateRange: { startDate: Date; endDate: Date };
    logoUrl?: string;
    generatedBy?: string;
}> = ({ data, dateRange, logoUrl, generatedBy }) => {
    const subtitle = (dateRange?.startDate && dateRange?.endDate)
        ? `${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}`
        : 'Period Not Specified';

    if (!data.length) return <EmptyState message="No Site OT records found for this period." />;

    return (
        <div className="bg-white p-6 shadow-sm rounded-xl">
            <ReportHeader title="Site Overtime Report" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} />
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-3 py-2 border border-gray-300 font-bold text-left">Employee</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Date</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Site OT In</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Site OT Out</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Duration</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-left">Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-3 py-1.5 border border-gray-200 font-medium">{row.userName}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.date}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center text-teal-700 font-medium">{row.siteOtIn || '-'}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center text-teal-700 font-medium">{row.siteOtOut || '-'}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center font-bold text-green-700">{row.duration || '-'}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-xs text-gray-600">{row.locationName || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Footer label="Paradigm Services - Site OT Report" />
        </div>
    );
};

// --- 5. WORK HOURS REPORT ---
export const WorkHoursReportView: React.FC<{
    data: WorkHoursReportDataRow[];
    dateRange: { startDate: Date; endDate: Date };
    logoUrl?: string;
    generatedBy?: string;
}> = ({ data, dateRange, logoUrl, generatedBy }) => {
    const subtitle = (dateRange?.startDate && dateRange?.endDate)
        ? `${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}`
        : 'Period Not Specified';

    if (!data.length) return <EmptyState message="No work hours data found for this period." />;

    return (
        <div className="bg-white p-6 shadow-sm rounded-xl">
            <ReportHeader title="Monthly Work Hours Report" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} />
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-3 py-2 border border-gray-300 font-bold text-left">Employee</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Dept</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">P-Days</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Total Hrs</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">Avg Hrs</th>
                            <th className="px-3 py-2 border border-gray-300 font-bold text-center">OT Hrs</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-3 py-1.5 border border-gray-200 font-medium">{row.userName}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.department}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.presentDays}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.totalWorkingHours.toFixed(1)}h</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.avgWorkingHours.toFixed(1)}h</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center font-bold text-green-700">{row.otHours.toFixed(1)}h</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Footer label="Paradigm Services - Productivity Report" />
        </div>
    );
};
