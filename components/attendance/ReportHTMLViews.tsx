import React from 'react';
import { format } from 'date-fns';
import { ClipboardList } from 'lucide-react';
import type { BasicReportDataRow, AttendanceLogDataRow, SiteOtDataRow, MonthlyReportRow, WorkHoursReportDataRow } from '../../pages/attendance/PDFReports';
import { calculateStatsForDateRange } from '../../utils/attendanceCalculations';

// --- SHARED ---
export interface AppliedFilters {
    company?: string;
    location?: string;
    site?: string;
    role?: string;
}

interface ReportHeaderProps {
    title: string;
    subtitle: string;
    logoUrl?: string;
    generatedBy?: string;
    generatedByRole?: string;
    targetUserName?: string;
    targetUserRole?: string;
    filters?: AppliedFilters;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({ title, subtitle, logoUrl, generatedBy, generatedByRole, targetUserName, targetUserRole, filters }) => (
    <div className="flex justify-between items-start border-b-[3px] border-gray-950 pb-6 mb-8 gap-4">
        <div className="flex flex-col min-w-[200px]">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-14 w-auto mb-2 object-contain self-start" />}
            {targetUserName && (
                <div className="mt-2 flex flex-col">
                    <span className="text-[12px] text-gray-900 font-bold leading-none">{targetUserName}</span>
                    {targetUserRole && (
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{targetUserRole.replace(/_/g, ' ')}</span>
                    )}
                </div>
            )}
        </div>
        {filters && (filters.company || filters.location || filters.site || filters.role) ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center px-4 py-2 mx-4 max-w-xl self-center">
                <div className="text-[12px] text-gray-400 space-y-0.5 font-medium">
                    {filters.company && (
                        <p className="font-bold text-gray-800 uppercase tracking-wide">
                            {filters.company}
                        </p>
                    )}
                    {filters.location && (
                        <p className="text-gray-600 font-semibold">
                            {filters.location}
                        </p>
                    )}
                    {filters.site && (
                        <p className="text-gray-500">
                            {filters.site}
                        </p>
                    )}
                    {filters.role && (
                        <p className="text-gray-500 capitalize">
                            {filters.role.replace(/_/g, ' ')}
                        </p>
                    )}
                </div>
            </div>
        ) : (
            <div className="flex-1"></div>
        )}
        <div className="text-right min-w-[200px]">
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
    generatedByRole?: string;
    targetUserName?: string;
    targetUserRole?: string;
    filters?: AppliedFilters;
}> = ({ data, dateRange, logoUrl, generatedBy, generatedByRole, targetUserName, targetUserRole, filters }) => {
    const subtitle = (dateRange?.startDate && dateRange?.endDate)
        ? `Billing Cycle: ${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}`
        : 'Billing Cycle: Not Specified';

    if (!data.length) return <EmptyState message="No attendance data found for this period." />;

    return (
        <div className="bg-white p-4 md:p-[24px] shadow-lg rounded-[16px] border border-gray-100 max-w-full mx-auto overflow-hidden space-y-6">
            <ReportHeader title="Basic Attendance Report" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} generatedByRole={generatedByRole} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={filters} />
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-2 py-2 border border-gray-300 font-bold text-left text-[11px]">S.No</th>
                            <th className="px-2 py-2 border border-gray-300 font-bold text-left text-[11px]">Employee Name</th>
                            <th className="px-2 py-2 border border-gray-300 font-bold text-left text-[11px]">Dept</th>
                            <th className="px-2 py-2 border border-gray-300 font-bold text-center text-[11px]">In</th>
                            <th className="px-2 py-2 border border-gray-300 font-bold text-center text-[11px]">Out</th>
                            <th className="px-2 py-2 border border-gray-300 font-bold text-center text-[11px]">B.In</th>
                            <th className="px-2 py-2 border border-gray-300 font-bold text-center text-[11px]">B.Out</th>
                            <th className="px-2 py-2 border border-gray-300 font-bold text-center text-[11px]">OT.In</th>
                            <th className="px-2 py-2 border border-gray-300 font-bold text-center text-[11px]">OT.Out</th>
                            <th className="px-2 py-2 border border-gray-300 font-bold text-center text-[11px]">Dur</th>
                            <th className="px-2 py-2 border border-gray-300 font-bold text-center text-[11px]">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-2 py-1.5 border border-gray-200 text-left text-[11px]">{idx + 1}</td>
                                <td className="px-2 py-1.5 border border-gray-200 font-medium text-left text-[11px] capitalize">{row.userName}</td>
                                <td className="px-2 py-1.5 border border-gray-200 text-left text-[11px] capitalize">{String(row.department || row.dept || 'Staff').replace(/_/g, ' ')}</td>
                                <td className="px-2 py-1.5 border border-gray-200 text-center text-[11px]">{row.checkIn || row.pin || '—'}</td>
                                <td className="px-2 py-1.5 border border-gray-200 text-center text-[11px]">{row.checkOut || row.pout || '—'}</td>
                                <td className="px-2 py-1.5 border border-gray-200 text-center text-[11px] font-medium text-orange-600">{row.breakIn || '—'}</td>
                                <td className="px-2 py-1.5 border border-gray-200 text-center text-[11px] font-medium text-orange-600">{row.breakOut || '—'}</td>
                                <td className="px-2 py-1.5 border border-gray-200 text-center text-[11px] font-medium text-teal-600">{row.siteOtIn || '—'}</td>
                                <td className="px-2 py-1.5 border border-gray-200 text-center text-[11px] font-medium text-teal-600">{row.siteOtOut || '—'}</td>
                                <td className="px-2 py-1.5 border border-gray-200 text-center text-[11px]">{row.duration || row.wh || '—'}</td>
                                <td className="px-2 py-1.5 border border-gray-200 text-center font-bold text-[11px]">
                                    <span className={
                                        row.status === 'P' || row.status === 'Present' ? 'text-green-600' :
                                        row.status === 'A' || row.status === 'Absent' ? 'text-red-500' :
                                        row.status.includes('P') ? 'text-green-600' :
                                        'text-blue-500'
                                    }>{row.status}</span>
                                </td>
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
    generatedByRole?: string;
    targetUserName?: string;
    targetUserRole?: string;
    filters?: AppliedFilters;
}> = ({ data, dateRange, logoUrl, generatedBy, generatedByRole, targetUserName, targetUserRole, filters }) => {
    const subtitle = (dateRange?.startDate && dateRange?.endDate)
        ? `Billing Cycle: ${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}`
        : 'Billing Cycle: Not Specified';

    if (!data.length) return <EmptyState message="No log events recorded for this period." />;

    return (
        <div className="bg-white p-6 shadow-sm rounded-xl">
            <ReportHeader title="Detailed Attendance Log" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} generatedByRole={generatedByRole} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={filters} />
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
                                <td className="px-3 py-1.5 border border-gray-200 font-medium capitalize">{row.userName}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.date}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{row.time}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center font-bold uppercase">
                                    <span className={row.type === 'in' ? 'text-green-600' : 'text-orange-600'}>{row.type}</span>
                                </td>
                                <td className="px-3 py-1.5 border border-gray-200 text-xs text-gray-600">{row.locationName}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-[10px] text-gray-400 italic">
                                     {row.device || '-'}
                                     {row.isCached && (
                                         <div className="mt-1">
                                             <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-[4px] font-bold text-[8px] uppercase tracking-wider">
                                                 📴 Cached
                                             </span>
                                             {row.cachedAt && (
                                                 <div className="text-[7px] text-amber-600/60 mt-0.5">
                                                     {format(new Date(row.cachedAt), 'HH:mm dd/MM')}
                                                 </div>
                                             )}
                                         </div>
                                     )}
                                 </td>
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
    generatedByRole?: string;
    targetUserName?: string;
    targetUserRole?: string;
    filters?: AppliedFilters;
}> = ({ data, dateRange, logoUrl, generatedBy, days, generatedByRole, targetUserName, targetUserRole, filters }) => {
    const subtitle = (dateRange?.startDate && dateRange?.endDate)
        ? `Billing Cycle: ${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}`
        : 'Billing Cycle: Not Specified';

    const dayHeaders = days && days.length > 0
        ? days.map(d => d.getDate())
        : (data.length > 0 ? Array.from({ length: data[0].statuses.length }, (_, i) => i + 1) : []);

    if (!data.length) return <EmptyState message="No monthly status records found." />;

    const numDays = dayHeaders.length;

    // Dynamic layout styles based on number of columns/days
    const layout = React.useMemo(() => {
        if (numDays <= 7) {
            return {
                tableText: 'text-[11px]',
                employeeWidth: 'w-[150px] min-w-[150px] max-w-[150px]',
                dayColWidth: 'min-w-[32px]',
                statColWidth: 'min-w-[30px]',
                payWidth: 'w-[40px] min-w-[40px] max-w-[40px]',
                paddingY: 'py-2 px-1',
            };
        } else if (numDays <= 15) {
            return {
                tableText: 'text-[9.5px]',
                employeeWidth: 'w-[110px] min-w-[110px] max-w-[110px]',
                dayColWidth: 'min-w-[24px]',
                statColWidth: 'min-w-[22px]',
                payWidth: 'w-[32px] min-w-[32px] max-w-[32px]',
                paddingY: 'py-1.5 px-1',
            };
        } else if (numDays <= 22) {
            return {
                tableText: 'text-[8px]',
                employeeWidth: 'w-[80px] min-w-[80px] max-w-[80px]',
                dayColWidth: 'min-w-[20px]',
                statColWidth: 'min-w-[18px]',
                payWidth: 'w-[28px] min-w-[28px] max-w-[28px]',
                paddingY: 'py-1 px-0.5',
            };
        } else {
            return {
                tableText: 'text-[6.5px]',
                employeeWidth: 'w-[60px] min-w-[60px] max-w-[60px]',
                dayColWidth: 'min-w-[17px]',
                statColWidth: '',
                payWidth: 'w-[24px] min-w-[24px] max-w-[24px]',
                paddingY: 'py-1 px-0',
            };
        }
    }, [numDays]);

    const getStatusColor = (s: string) => {
        if (s.includes('+')) return 'text-[#0D9488] font-black'; // Combined Status Teal
        if (s === 'P') return 'text-[#059669]'; // Present Green
        if (s === 'A') return 'text-[#DC2626]'; // Absent Red
        if (s === 'W/O' || s === 'WOP') return 'text-[#6B7280]'; // WO Grey
        if (s === 'H' || s === 'H/P') return 'text-[#EA580C]'; // Holiday Orange
        if (s.includes('F/H') || s.includes('BL')) return 'text-[#1D4ED8]'; // Blue Leave
        if (s.includes('PL') || s.includes('P/L')) return 'text-[#DB2777]'; // Pink Leave
        if (s.includes('0.5')) return 'text-[#2563EB]'; // Half Day Blue
        if (s.includes('SL') || s.includes('S/L')) return 'text-[#9333EA]'; // Sick Leave Purple
        if (s.includes('EL') || s.includes('E/L')) return 'text-[#4F46E5]'; // Earned Leave Indigo
        if (s.includes('CL') || s.includes('C/L')) return 'text-[#7C3AED]'; // Casual Leave Violet
        if (s.includes('C/O')) return 'text-[#0891B2]'; // Comp Cyan
        if (s.includes('ML') || s.includes('M/L')) return 'text-[#BE185D]'; // Maternity Pink
        if (s.includes('CC') || s.includes('C/C')) return 'text-[#0F766E]'; // Child Care Teal
        if (s.includes('OT')) return 'text-[#0D9488]'; // OT Teal
        if (s === 'W/H' || s === 'WH') return 'text-[#0D9488]'; // WFH Teal
        if (s === 'W/P') return 'text-[#2563EB]'; // WP Blue
        if (s === 'RP' || s.includes('RP')) return 'text-[#0284C7]'; // Permission Blue
        if (s === 'RC' || s.includes('RC')) return 'text-[#16A34A]'; // Correction Green
        return 'text-gray-700';
    };

    const recalculatedRows = React.useMemo(() => {
        if (!days || days.length === 0) return data;
        return data.map(row => ({
            ...row,
            ...calculateStatsForDateRange(row.statuses, days)
        }));
    }, [data, days]);

    return (
        <div className="bg-white p-4 md:p-[24px] shadow-lg rounded-[16px] border border-gray-100 max-w-full mx-auto overflow-hidden space-y-6">
            <ReportHeader title="MONTHLY ATTENDANCE REPORT" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} generatedByRole={generatedByRole} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={filters} />
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Monthly Presence</span>
                    <div className="text-2xl font-black text-green-600">
                        {Math.round((recalculatedRows.reduce((acc, curr) => acc + (curr.presentDays || 0) + (curr.halfDays || 0) * 0.5, 0) / (recalculatedRows.length * (days?.length || 30) || 1)) * 100)}%
                    </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Punches</span>
                    <div className="text-2xl font-black text-blue-600">
                        {recalculatedRows.reduce((acc, curr) => acc + (curr.presentDays || 0), 0)}
                    </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Active Staff</span>
                    <div className="text-2xl font-black text-gray-900">{recalculatedRows.length}</div>
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar relative">
                <table className={`w-full ${layout.tableText} border-collapse`}>
                    <thead>
                        <tr className="bg-gray-50/50">
                            <th className={`px-1 ${layout.paddingY} font-bold text-gray-700 sticky left-0 bg-[#F9FAFB] z-20 ${layout.employeeWidth} text-left border-b border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>Employee</th>
                            {dayHeaders.map(d => (
                                <th key={d} className={`px-0 ${layout.paddingY} border-b border-gray-200 font-semibold text-center text-gray-400 ${layout.dayColWidth}`}>{d}</th>
                            ))}
                            <th className={`px-0 ${layout.paddingY} border-b border-l border-gray-200 font-bold text-center text-[#059669] bg-green-50/30 ${layout.statColWidth || 'min-w-[15px]'}`}>P</th>
                            <th className={`px-0 ${layout.paddingY} border-b border-gray-200 font-bold text-center text-[#2563EB] bg-blue-50/30 ${layout.statColWidth || 'min-w-[16px]'}`}>0.5P</th>
                            <th className={`px-0 ${layout.paddingY} border-b border-gray-200 font-bold text-center text-[#0D9488] bg-teal-50/30 ${layout.statColWidth || 'min-w-[18px]'}`}>OT</th>
                            <th className={`px-0 ${layout.paddingY} border-b border-gray-200 font-bold text-center text-[#0891B2] bg-cyan-50/30 ${layout.statColWidth || 'min-w-[16px]'}`}>C/O</th>
                            <th className={`px-0 ${layout.paddingY} border-b border-gray-200 font-bold text-center text-[#4F46E5] bg-indigo-50/30 ${layout.statColWidth || 'min-w-[16px]'}`}>E/L</th>
                            <th className={`px-0 ${layout.paddingY} border-b border-gray-200 font-bold text-center text-[#9333EA] bg-purple-50/30 ${layout.statColWidth || 'min-w-[16px]'}`}>S/L</th>
                            <th className={`px-0 ${layout.paddingY} border-b border-gray-200 font-bold text-center text-[#DC2626] bg-red-50/30 ${layout.statColWidth || 'min-w-[14px]'}`}>A</th>
                            <th className={`px-0 ${layout.paddingY} border-b border-gray-200 font-bold text-center text-[#6B7280] bg-gray-50/50 ${layout.statColWidth || 'min-w-[16px]'}`}>W/O</th>
                            <th className={`px-0 ${layout.paddingY} border-b border-gray-200 font-bold text-center text-[#EA580C] bg-orange-50/30 ${layout.statColWidth || 'min-w-[14px]'}`}>H</th>
                            <th className={`px-0 ${layout.paddingY} border-b border-l border-gray-200 font-bold text-center text-[#059669] bg-emerald-100 z-20 sticky right-0 ${layout.payWidth} shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>Pay</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recalculatedRows.map((row, idx) => (
                            <tr key={idx} className="group hover:bg-gray-50/30 transition-colors">
                                <td className={`px-1 ${layout.paddingY} font-medium text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50/30 z-10 whitespace-nowrap border-b border-gray-100 ${layout.employeeWidth} overflow-hidden text-ellipsis capitalize`}>{row.userName}</td>
                                {(days && days.length > 0 ? days : row.statuses).map((day, sIdx) => {
                                    const status = days && days.length > 0
                                        ? (row.statuses[(day as Date).getDate() - 1] || '-')
                                        : (day as string || '-');
                                    return (
                                        <td key={sIdx} className={`px-0 ${layout.paddingY} border-b border-gray-50 text-center font-bold leading-tight`}>
                                            <span className={getStatusColor(status)}>{status}</span>
                                        </td>
                                    );
                                })}
                                <td className={`px-0 ${layout.paddingY} border-b border-l border-gray-100 text-center font-bold text-[#059669] bg-green-50/10`}>{row.presentDays}</td>
                                <td className={`px-0 ${layout.paddingY} border-b border-gray-100 text-center font-bold text-[#2563EB] bg-blue-50/10`}>{row.halfDays}</td>
                                <td className={`px-0 ${layout.paddingY} border-b border-gray-100 text-center font-bold text-[#0D9488] bg-teal-50/10`}>{row.overtimeDays || 0}</td>
                                <td className={`px-0 ${layout.paddingY} border-b border-gray-100 text-center font-bold text-[#0891B2] bg-cyan-50/10`}>{row.compOffs || 0}</td>
                                <td className={`px-0 ${layout.paddingY} border-b border-gray-100 text-center font-bold text-[#4F46E5] bg-indigo-50/10`}>{row.earnedLeaves || 0}</td>
                                <td className={`px-0 ${layout.paddingY} border-b border-gray-100 text-center font-bold text-[#9333EA] bg-purple-50/10`}>{row.sickLeaves || 0}</td>
                                <td className={`px-0 ${layout.paddingY} border-b border-gray-100 text-center font-bold text-[#DC2626] bg-red-50/10`}>{row.absentDays}</td>
                                <td className={`px-0 ${layout.paddingY} border-b border-gray-100 text-center text-[#6B7280] font-medium`}>{row.weekOffs}</td>
                                <td className={`px-0 ${layout.paddingY} border-b border-gray-100 text-center text-[#EA580C] font-medium`}>{row.holidays}</td>
                                <td className={`px-0 ${layout.paddingY} border-b border-l border-gray-100 text-center font-bold text-[#059669] bg-emerald-100 sticky right-0 z-10 ${layout.payWidth} shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>{row.totalPayableDays}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-5 border-t border-gray-200 pt-4">
                <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 mb-2.5">NOTATION REFERENCE</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">

                    {/* Column 1 */}
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#DCFCE7] text-[#059669] rounded px-0.5">P</span>
                            <span className="text-gray-600">PRESENT — Full day attendance</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#DBEAFE] text-[#2563EB] rounded px-0.5">0.5P</span>
                            <span className="text-gray-600">HALF DAY — 50% attendance</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#D1FAE5] text-[#059669] rounded px-0.5">0.75P</span>
                            <span className="text-gray-600">THREE-QUARTER DAY — 75% attendance</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#E0F2FE] text-[#0369A1] rounded px-0.5">0.25P</span>
                            <span className="text-gray-600">QUARTER DAY — 25% attendance</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#FEE2E2] text-[#DC2626] rounded px-0.5">A</span>
                            <span className="text-gray-600">ABSENT — No attendance recorded</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#FEE2E2] text-[#DC2626] rounded px-0.5">LOP</span>
                            <span className="text-gray-600">LOSS OF PAY — Unpaid absence</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#F1F5F9] text-[#6B7280] rounded px-0.5">W/O</span>
                            <span className="text-gray-600">WEEKLY OFF — Scheduled day off (Sun)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#FEF9C3] text-[#854D0E] rounded px-0.5">H</span>
                            <span className="text-gray-600">HOLIDAY — Declared public holiday</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#FEF3C7] text-[#92400E] rounded px-0.5">H/P</span>
                            <span className="text-gray-600">HOLIDAY PRESENT — Worked on holiday</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#DBEAFE] text-[#1D4ED8] rounded px-0.5">W/P</span>
                            <span className="text-gray-600">WEEKEND PRESENT — Worked on week off</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#CCFBF1] text-[#0D9488] rounded px-0.5">W/H</span>
                            <span className="text-gray-600">WORK FROM HOME — Remote working day</span>
                        </div>
                    </div>

                    {/* Column 2 */}
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#EDE9FE] text-[#9333EA] rounded px-0.5">SL</span>
                            <span className="text-gray-600">SICK LEAVE — Medical leave</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#E0E7FF] text-[#4F46E5] rounded px-0.5">EL</span>
                            <span className="text-gray-600">EARNED LEAVE — Accrued paid leave</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#EDE9FE] text-[#7C3AED] rounded px-0.5">CL</span>
                            <span className="text-gray-600">CASUAL LEAVE — Short-notice leave</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#CFFAFE] text-[#0891B2] rounded px-0.5">C/O</span>
                            <span className="text-gray-600">COMP OFF — Compensatory off day</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#DBEAFE] text-[#1D4ED8] rounded px-0.5">BL</span>
                            <span className="text-gray-600">BLUE LEAVE — 3rd Saturday (male)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#FCE7F3] text-[#DB2777] rounded px-0.5">PL</span>
                            <span className="text-gray-600">PINK LEAVE — Female recurring holiday</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#FCE7F3] text-[#BE185D] rounded px-0.5">ML</span>
                            <span className="text-gray-600">MATERNITY LEAVE — Statutory leave</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#CCFBF1] text-[#0F766E] rounded px-0.5">CC</span>
                            <span className="text-gray-600">CHILD CARE LEAVE — Parental leave</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#CCFBF1] text-[#0D9488] rounded px-0.5">OT(P)</span>
                            <span className="text-gray-600">OVERTIME PRESENT — Extra pay eligible</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#E0F2FE] text-[#0284C7] rounded px-0.5">RP</span>
                            <span className="text-gray-600">REQUEST PERMISSION — Early/late request</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[7.5px] font-bold">
                            <span className="w-4 text-center text-[7px] font-black bg-[#DCFCE7] text-[#16A34A] rounded px-0.5">RC</span>
                            <span className="text-gray-600">REQUEST CORRECTION — Punch correction</span>
                        </div>
                    </div>

                </div>
                <p className="text-[6.5px] text-gray-400 mt-2">* Prefix 0.5 indicates half-day variant (e.g., 0.5EL = Half Earned Leave). H/P and W/P attract 1.5x payable credit.</p>
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
    generatedByRole?: string;
    targetUserName?: string;
    targetUserRole?: string;
    filters?: AppliedFilters;
}> = ({ data, dateRange, logoUrl, generatedBy, generatedByRole, targetUserName, targetUserRole, filters }) => {
    const subtitle = (dateRange?.startDate && dateRange?.endDate)
        ? `Billing Cycle: ${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}`
        : 'Billing Cycle: Not Specified';

    if (!data.length) return <EmptyState message="No Site OT records found for this period." />;

    return (
        <div className="bg-white p-6 shadow-sm rounded-xl">
            <ReportHeader title="Site Overtime Report" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} generatedByRole={generatedByRole} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={filters} />
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
                                <td className="px-3 py-1.5 border border-gray-200 font-medium capitalize">{row.userName}</td>
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
    generatedByRole?: string;
    targetUserName?: string;
    targetUserRole?: string;
    filters?: AppliedFilters;
}> = ({ data, dateRange, logoUrl, generatedBy, generatedByRole, targetUserName, targetUserRole, filters }) => {
    const subtitle = (dateRange?.startDate && dateRange?.endDate)
        ? `Billing Cycle: ${format(dateRange.startDate, 'dd MMM yyyy')} - ${format(dateRange.endDate, 'dd MMM yyyy')}`
        : 'Billing Cycle: Not Specified';

    if (!data.length) return <EmptyState message="No work hours data found for this period." />;

    return (
        <div className="bg-white p-6 shadow-sm rounded-xl">
            <ReportHeader title="Monthly Work Hours Report" subtitle={subtitle} logoUrl={logoUrl} generatedBy={generatedBy} generatedByRole={generatedByRole} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={filters} />
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
                                <td className="px-3 py-1.5 border border-gray-200 font-medium capitalize">{row.userName}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center capitalize">{String(row.department || 'Staff').replace(/_/g, ' ')}</td>
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

export interface LeaveBalanceTrackerRow {
    userId: string;
    userName: string;
    department: string;
    role: string;
    balances: any; // LeaveBalance
}

export const LeaveBalanceTrackerView: React.FC<{
    data: LeaveBalanceTrackerRow[];
    dateRange: { startDate: Date; endDate: Date };
    logoUrl?: string;
    generatedBy?: string;
    generatedByRole?: string;
    targetUserName?: string;
    targetUserRole?: string;
    filters?: AppliedFilters;
}> = ({ data, dateRange, logoUrl, generatedBy, generatedByRole, targetUserName, targetUserRole, filters }) => {
    const subtitle = (dateRange?.startDate && dateRange?.endDate)
        ? `As of Date: ${format(dateRange.endDate, 'dd MMM yyyy')}`
        : 'As of Date: Not Specified';

    if (!data.length) return <EmptyState message="No leave balance data found." />;

    return (
        <div className="bg-white p-4 md:p-[24px] shadow-lg rounded-[16px] border border-gray-100 max-w-full mx-auto overflow-hidden space-y-6">
            <ReportHeader 
                title="Leave Balance Tracker" 
                subtitle={subtitle} 
                logoUrl={logoUrl} 
                generatedBy={generatedBy} 
                generatedByRole={generatedByRole} 
                targetUserName={targetUserName} 
                targetUserRole={targetUserRole} 
                filters={filters} 
            />
            
            <div className="overflow-x-auto custom-scrollbar relative border border-gray-100 rounded-xl">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th rowSpan={2} className="px-3 py-3 border-r border-gray-200 font-bold text-left text-[11px] text-gray-700 sticky left-0 bg-gray-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[120px]">Employee</th>
                            <th rowSpan={2} className="px-3 py-3 border-r border-gray-200 font-bold text-center text-[11px] text-gray-700">Role / Dept</th>
                            <th colSpan={3} className="px-2 py-1.5 border-r border-b border-gray-200 font-bold text-center text-[10px] text-emerald-700 bg-emerald-50/40">Earned Leave (EL)</th>
                            <th colSpan={3} className="px-2 py-1.5 border-r border-b border-gray-200 font-bold text-center text-[10px] text-blue-700 bg-blue-50/40">Sick Leave (SL)</th>
                            <th colSpan={3} className="px-2 py-1.5 border-r border-b border-gray-200 font-bold text-center text-[10px] text-teal-700 bg-teal-50/40">Comp Off (CO)</th>
                            <th colSpan={3} className="px-2 py-1.5 border-r border-b border-gray-200 font-bold text-center text-[10px] text-amber-700 bg-amber-50/40">Floating (FH)</th>
                            <th colSpan={3} className="px-2 py-1.5 border-r border-b border-gray-200 font-bold text-center text-[10px] text-pink-700 bg-pink-50/40">Pink Leave (PL)</th>
                            <th colSpan={3} className="px-2 py-1.5 border-r border-b border-gray-200 font-bold text-center text-[10px] text-cyan-700 bg-cyan-50/40">Child Care (CC)</th>
                            <th colSpan={3} className="px-2 py-1.5 border-b border-gray-200 font-bold text-center text-[10px] text-rose-700 bg-rose-50/40">Maternity (ML)</th>
                        </tr>
                        <tr className="bg-gray-50/80 border-b border-gray-200">
                            {/* EL */}
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-emerald-50/10">Tot</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-emerald-50/10">Used</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-bold text-center text-[10px] text-emerald-600 bg-emerald-50/20">Bal</th>
                            {/* SL */}
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-blue-50/10">Tot</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-blue-50/10">Used</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-bold text-center text-[10px] text-blue-600 bg-blue-50/20">Bal</th>
                            {/* CO */}
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-teal-50/10">Tot</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-teal-50/10">Used</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-bold text-center text-[10px] text-teal-600 bg-teal-50/20">Bal</th>
                            {/* FH */}
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-amber-50/10">Tot</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-amber-50/10">Used</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-bold text-center text-[10px] text-amber-600 bg-amber-50/20">Bal</th>
                            {/* PL */}
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-pink-50/10">Tot</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-pink-50/10">Used</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-bold text-center text-[10px] text-pink-600 bg-pink-50/20">Bal</th>
                            {/* CC */}
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-cyan-50/10">Tot</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-cyan-50/10">Used</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-bold text-center text-[10px] text-cyan-600 bg-cyan-50/20">Bal</th>
                            {/* ML */}
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-rose-50/10">Tot</th>
                            <th className="px-2 py-1 border-r border-gray-200 font-semibold text-center text-[10px] text-gray-500 bg-rose-50/10">Used</th>
                            <th className="px-2 py-1 font-bold text-center text-[10px] text-rose-600 bg-rose-50/20">Bal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => {
                            const b = row.balances || {};
                            const elBal = (b.earnedTotal || 0) - (b.earnedUsed || 0) - (b.earnedPending || 0);
                            const slBal = (b.sickTotal || 0) - (b.sickUsed || 0) - (b.sickPending || 0);
                            const coBal = (b.compOffTotal || 0) - (b.compOffUsed || 0) - (b.compOffPending || 0);
                            const fhBal = (b.floatingTotal || 0) - (b.floatingUsed || 0) - (b.floatingPending || 0);
                            const plBal = (b.pinkTotal || 0) - (b.pinkUsed || 0) - (b.pinkPending || 0);
                            const ccBal = (b.childCareTotal || 0) - (b.childCareUsed || 0) - (b.childCarePending || 0);
                            const mlBal = (b.maternityTotal || 0) - (b.maternityUsed || 0) - (b.maternityPending || 0);

                            return (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-gray-50/30 border-b border-gray-100' : 'bg-gray-50/30 hover:bg-gray-50/50 border-b border-gray-100'}>
                                    <td className="px-3 py-2 border-r border-gray-100 font-medium text-gray-900 sticky left-0 bg-inherit capitalize z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{row.userName}</td>
                                    <td className="px-3 py-2 border-r border-gray-100 text-center text-gray-500 capitalize">{String(row.role || row.department || 'Staff').replace(/_/g, ' ')}</td>
                                    
                                    {/* EL */}
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.earnedTotal || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.earnedUsed || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center font-bold text-emerald-600 bg-emerald-50/5">{elBal.toFixed(1)}</td>
                                    
                                    {/* SL */}
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.sickTotal || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.sickUsed || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center font-bold text-blue-600 bg-blue-50/5">{slBal.toFixed(1)}</td>
                                    
                                    {/* CO */}
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.compOffTotal || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.compOffUsed || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center font-bold text-teal-600 bg-teal-50/5">{coBal.toFixed(1)}</td>
                                    
                                    {/* FH */}
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.floatingTotal || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.floatingUsed || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center font-bold text-amber-600 bg-amber-50/5">{fhBal.toFixed(1)}</td>
                                    
                                    {/* PL */}
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.pinkTotal || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.pinkUsed || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center font-bold text-pink-600 bg-pink-50/5">{plBal.toFixed(1)}</td>
                                    
                                    {/* CC */}
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.childCareTotal || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.childCareUsed || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center font-bold text-cyan-600 bg-cyan-50/5">{ccBal.toFixed(1)}</td>

                                    {/* ML */}
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.maternityTotal || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 border-r border-gray-100 text-center text-gray-600">{(b.maternityUsed || 0).toFixed(1)}</td>
                                    <td className="px-2 py-2 text-center font-bold text-rose-600 bg-rose-50/5">{mlBal.toFixed(1)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <Footer label="Paradigm Services - Leave Balance Tracker Report" />
        </div>
    );
};
