import React from 'react';
import { format } from 'date-fns';
import { ClipboardList } from 'lucide-react';
import type { BasicReportDataRow, AttendanceLogDataRow, SiteOtDataRow, MonthlyReportRow, WorkHoursReportDataRow } from '../../pages/attendance/PDFReports';

// --- SHARED ---
const ReportHeader: React.FC<{ title: string; subtitle: string; logoUrl?: string; generatedBy?: string }> = ({ title, subtitle, logoUrl, generatedBy }) => (
    <div className="flex justify-between items-start border-b-[3px] border-gray-950 pb-6 mb-8">
        <div className="flex flex-col">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-14 w-auto mb-2 object-contain" />}
            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em]">Paradigm Services</span>
        </div>
        <div className="text-right">
            <h1 className="text-[28px] font-black tracking-tight text-gray-900 mb-1 leading-none">{title}</h1>
            <p className="text-[16px] text-gray-800 font-bold mb-2">{subtitle}</p>
            <div className="text-[12px] text-gray-400 space-y-0.5 font-medium">
                <p>Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
                {generatedBy && <p>By: {generatedBy}</p>}
            </div>
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

    const totalEmployees = data.length;
    const presentCount = data.filter(r => r.status === 'P' || r.status.includes('P')).length;
    const attendancePercentage = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;
    const lateCount = data.filter(r => r.status === 'Late' || r.status.includes('L')).length;

    return (
        <div className="bg-white p-4 md:p-6 shadow-lg rounded-2xl border border-gray-100 max-w-full mx-auto overflow-hidden space-y-6">
            <ReportHeader title="Basic Attendance Report" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} />
            
            {/* Summary Box */}
            <div className="bg-gray-50/80 border border-gray-100 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Daily Summary</h3>
                <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
                    Dear Team,<br /><br />
                    Today's attendance stands at <strong>{attendancePercentage}%</strong>. 
                    A total of <strong>{totalEmployees - presentCount}</strong> employees were absent, and <strong>{lateCount}</strong> reported late.<br /><br />
                    Attendance requires attention.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Staff Presence</span>
                    <div className="text-2xl font-black text-green-600">{attendancePercentage}%</div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Present</span>
                    <div className="text-2xl font-black text-blue-600">{presentCount}</div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Late</span>
                    <div className="text-2xl font-black text-orange-500">{lateCount}</div>
                </div>
            </div>

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
        if (s.includes('+')) return 'text-[#0D9488] font-black'; // Combined Status Teal
        if (s === 'P') return 'text-[#059669]'; // Present Green
        if (s === 'A') return 'text-[#DC2626]'; // Absent Red
        if (s === 'W/O' || s === 'WOP') return 'text-[#6B7280]'; // WO Grey
        if (s === 'H' || s === 'HP' || s === 'H/P') return 'text-[#EA580C]'; // Holiday Orange
        if (s.includes('F/H')) return 'text-[#CA8A04]'; // Floating Gold
        if (s.includes('1/2')) return 'text-[#2563EB]'; // Half Day Blue
        if (s.includes('S/L')) return 'text-[#9333EA]'; // Sick Purple
        if (s.includes('E/L')) return 'text-[#4F46E5]'; // Earned Indigo
        if (s.includes('C/O')) return 'text-[#0891B2]'; // Comp Cyan
        if (s.includes('OT')) return 'text-[#0D9488]'; // OT Teal
        return 'text-gray-700';
    };

    return (
        <div className="bg-white p-4 md:p-6 shadow-lg rounded-2xl border border-gray-100 max-w-full mx-auto overflow-hidden space-y-6">
            <ReportHeader title="MONTHLY ATTENDANCE REPORT" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} />
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Monthly Presence</span>
                    <div className="text-2xl font-black text-green-600">
                        {Math.round((data.reduce((acc, curr) => acc + (curr.presentDays || 0) + (curr.halfDays || 0) * 0.5, 0) / (data.length * (days?.length || 30) || 1)) * 100)}%
                    </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Punches</span>
                    <div className="text-2xl font-black text-blue-600">
                        {data.reduce((acc, curr) => acc + (curr.presentDays || 0), 0)}
                    </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Active Staff</span>
                    <div className="text-2xl font-black text-gray-900">{data.length}</div>
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar relative">
                <table className="w-full text-[6.5px] border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50">
                            <th className="px-1 py-1 font-bold text-gray-700 sticky left-0 bg-[#F9FAFB] z-20 w-[60px] min-w-[60px] max-w-[60px] text-left border-b border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Employee</th>
                            {dayHeaders.map(d => (
                                <th key={d} className="px-0 py-1 border-b border-gray-200 font-semibold text-center text-gray-400 min-w-[17px]">{d}</th>
                            ))}
                            <th className="px-0 py-1 border-b border-l border-gray-200 font-bold text-center text-[#059669] bg-green-50/30 min-w-[15px]">P</th>
                            <th className="px-0 py-1 border-b border-gray-200 font-bold text-center text-[#2563EB] bg-blue-50/30 min-w-[16px]">1/2P</th>
                            <th className="px-0 py-1 border-b border-gray-200 font-bold text-center text-[#0D9488] bg-teal-50/30 min-w-[18px]">OT</th>
                            <th className="px-0 py-1 border-b border-gray-200 font-bold text-center text-[#0891B2] bg-cyan-50/30 min-w-[16px]">C/O</th>
                            <th className="px-0 py-1 border-b border-gray-200 font-bold text-center text-[#4F46E5] bg-indigo-50/30 min-w-[16px]">E/L</th>
                            <th className="px-0 py-1 border-b border-gray-200 font-bold text-center text-[#9333EA] bg-purple-50/30 min-w-[16px]">S/L</th>
                            <th className="px-0 py-1 border-b border-gray-200 font-bold text-center text-[#DC2626] bg-red-50/30 min-w-[14px]">A</th>
                            <th className="px-0 py-1 border-b border-gray-200 font-bold text-center text-[#6B7280] bg-gray-50/50 min-w-[16px]">W/O</th>
                            <th className="px-0 py-1 border-b border-gray-200 font-bold text-center text-[#EA580C] bg-orange-50/30 min-w-[14px]">H</th>
                            <th className="px-0 py-1 border-b border-l border-gray-200 font-bold text-center text-[#059669] bg-emerald-100 z-20 sticky right-0 w-[24px] min-w-[24px] max-w-[24px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Pay</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className="group hover:bg-gray-50/30 transition-colors">
                                <td className="px-1 py-1 font-medium text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50/30 z-10 whitespace-nowrap border-b border-gray-100 w-[60px] min-w-[60px] max-w-[60px] overflow-hidden text-ellipsis">{row.userName}</td>
                                {row.statuses.map((status, sIdx) => (
                                    <td key={sIdx} className="px-0 py-1 border-b border-gray-50 text-center font-bold leading-tight">
                                        <span className={getStatusColor(status)}>{status}</span>
                                    </td>
                                ))}
                                <td className="px-0 py-1 border-b border-l border-gray-100 text-center font-bold text-[#059669] bg-green-50/10">{row.presentDays}</td>
                                <td className="px-0 py-1 border-b border-gray-100 text-center font-bold text-[#2563EB] bg-blue-50/10">{row.halfDays}</td>
                                <td className="px-0 py-1 border-b border-gray-100 text-center font-bold text-[#0D9488] bg-teal-50/10">{row.overtimeDays || 0}</td>
                                <td className="px-0 py-1 border-b border-gray-100 text-center font-bold text-[#0891B2] bg-cyan-50/10">{row.compOffs || 0}</td>
                                <td className="px-0 py-1 border-b border-gray-100 text-center font-bold text-[#4F46E5] bg-indigo-50/10">{row.earnedLeaves || 0}</td>
                                <td className="px-0 py-1 border-b border-gray-100 text-center font-bold text-[#9333EA] bg-purple-50/10">{row.sickLeaves || 0}</td>
                                <td className="px-0 py-1 border-b border-gray-100 text-center font-bold text-[#DC2626] bg-red-50/10">{row.absentDays}</td>
                                <td className="px-0 py-1 border-b border-gray-100 text-center text-[#6B7280] font-medium">{row.weekOffs}</td>
                                <td className="px-0 py-1 border-b border-gray-100 text-center text-[#EA580C] font-medium">{row.holidays}</td>
                                <td className="px-0 py-1 border-b border-l border-gray-100 text-center font-bold text-[#059669] bg-emerald-100 sticky right-0 z-10 w-[24px] min-w-[24px] max-w-[24px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">{row.totalPayableDays}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[8px] font-bold">
                <span className="flex items-center gap-1 text-[#059669]"><span className="w-1.5 h-1.5 rounded-full bg-[#059669]" /> P: PRESENT</span>
                <span className="flex items-center gap-1 text-[#DC2626]"><span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" /> A: ABSENT</span>
                <span className="flex items-center gap-1 text-[#2563EB]"><span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" /> 1/2P: HALF DAY</span>
                <span className="flex items-center gap-1 text-[#6B7280]"><span className="w-1.5 h-1.5 rounded-full bg-[#6B7280]" /> W/O: WEEKLY OFF</span>
                <span className="flex items-center gap-1 text-[#EA580C]"><span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" /> H: HOLIDAY</span>
                <span className="flex items-center gap-1 text-[#0D9488]"><span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" /> OT (P): OT / EXTRAP</span>
                <span className="flex items-center gap-1 text-[#9333EA]"><span className="w-1.5 h-1.5 rounded-full bg-[#9333EA]" /> S/L: SICK LEAVE</span>
                <span className="flex items-center gap-1 text-[#4F46E5]"><span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" /> E/L: EARNED LEAVE</span>
                <span className="flex items-center gap-1 text-[#0891B2]"><span className="w-1.5 h-1.5 rounded-full bg-[#0891B2]" /> C/O: COMP OFF</span>
            </div>

            <Footer label="PARADIGM SERVICES - MONTHLY STATUS REPORT" />
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
