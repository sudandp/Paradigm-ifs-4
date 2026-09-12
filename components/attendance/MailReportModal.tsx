import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Mail, FileDown, Loader2, Send } from 'lucide-react';

export interface MailReportFilterSummary {
    dateRange: { startDate?: Date | null; endDate?: Date | null };
    employeeName?: string;
    site?: string;
    company?: string;
    role?: string;
    staffCategory?: string;
    recordCount?: number;
    generatedBy?: string;
}

export interface MailReportPayload {
    to: string[];
    subject: string;
    html: string;
    triggerType: 'manual';
    attachPdf: boolean;
    attachExcel: boolean;
}

export interface MailReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (payload: MailReportPayload) => void;
    isSending: boolean;
    reportType: string;
    currentUserEmail: string;
    filterSummary: MailReportFilterSummary;
    availableUsers: { id: string; name: string; email: string; role?: string }[];
    canAttachExcel?: boolean;
}

// Builds a clean HTML email body for the attendance report
export function buildReportEmailHtml(opts: {
    reportType: string;
    filterSummary: MailReportFilterSummary;
    userMessage: string;
    generatedBy: string;
    attachPdf?: boolean;
    attachExcel?: boolean;
}): string {
    const { reportType, filterSummary, userMessage, generatedBy, attachPdf = true, attachExcel = true } = opts;
    const reportLabel = reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Report';
    const startStr = filterSummary.dateRange.startDate ? format(filterSummary.dateRange.startDate, 'dd MMM yyyy') : '-';
    const endStr = filterSummary.dateRange.endDate ? format(filterSummary.dateRange.endDate, 'dd MMM yyyy') : '-';
    const dateRangeStr = startStr === endStr ? startStr : `${startStr} – ${endStr}`;
    const now = format(new Date(), 'dd MMM yyyy, hh:mm a');

    const filterRows: [string, string][] = [
        ['Report Type', reportLabel],
        ['Period', dateRangeStr],
        ['Employee', filterSummary.employeeName || 'All Employees'],
    ];
    if (filterSummary.company) filterRows.push(['Company', filterSummary.company]);
    if (filterSummary.site) filterRows.push(['Site / Society', filterSummary.site]);
    if (filterSummary.role) filterRows.push(['Role', filterSummary.role]);
    if (filterSummary.staffCategory) filterRows.push(['Staff Category', filterSummary.staffCategory]);
    if (filterSummary.recordCount !== undefined) filterRows.push(['Records', String(filterSummary.recordCount)]);

    const attachmentBadges: string[] = [];
    if (attachPdf) attachmentBadges.push('Official PDF Document (.pdf)');
    if (attachExcel) attachmentBadges.push('Formatted Excel Workbook (.xlsx)');
    if (attachmentBadges.length > 0) {
        filterRows.push(['Attached Formats', attachmentBadges.join(' + ')]);
    }

    const filterTableRows = filterRows.map(([k, v]) =>
        `<tr><td style="padding:7px 14px;font-weight:600;color:#374151;background:#f9fafb;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${k}</td><td style="padding:7px 14px;color:#111827;border-bottom:1px solid #e5e7eb;">${v}</td></tr>`
    ).join('');

    const msgHtml = userMessage
        ? `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${userMessage.replace(/\n/g, '<br/>')}</p>`
        : '';

    const attachmentNote = (attachPdf && attachExcel)
        ? 'The complete report is attached to this email in both printable PDF format and formatted Excel spreadsheet (.xlsx) workbook.'
        : attachExcel
            ? 'The complete report is attached to this email as a formatted Excel spreadsheet (.xlsx) workbook.'
            : 'The complete report is attached to this email as an official printable PDF document.';

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#006B3F 0%,#009A5B 100%);padding:28px 32px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">📊 ${reportLabel}</h1>
          <p style="margin:6px 0 0;font-size:13px;color:#dcfce7;">Paradigm Facility Management Services</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          ${msgHtml}
          <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">Please find the attendance report documents attached to this email. The report was generated based on the following parameters:</p>
          <!-- Filter Summary Table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            <thead><tr><td colspan="2" style="padding:10px 14px;background:#006B3F;color:#fff;font-size:12px;font-weight:700;letter-spacing:0.5px;">REPORT DETAILS</td></tr></thead>
            <tbody>${filterTableRows}</tbody>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${attachmentNote} If you have any questions or require modifications, please contact the HR team.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Generated by <strong style="color:#374151;">${generatedBy}</strong> on ${now}.<br/>This is an automated report from <strong style="color:#374151;">Paradigm FMS Attendance System</strong>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export const MailReportModal: React.FC<MailReportModalProps> = ({
    isOpen,
    onClose,
    onSend,
    isSending,
    reportType,
    currentUserEmail,
    filterSummary,
    availableUsers,
    canAttachExcel = true,
}) => {
    const reportLabel = reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Report';
    const startStr = filterSummary.dateRange.startDate ? format(filterSummary.dateRange.startDate, 'dd MMM yyyy') : '-';
    const endStr = filterSummary.dateRange.endDate ? format(filterSummary.dateRange.endDate, 'dd MMM yyyy') : '-';
    const dateRangeStr = startStr === endStr ? startStr : `${startStr} – ${endStr}`;

    // Format selection state: PDF always enabled, Excel enabled only if allowed
    const [attachPdf, setAttachPdf] = useState(true);
    const [attachExcel, setAttachExcel] = useState(canAttachExcel);

    useEffect(() => {
        if (!canAttachExcel) {
            setAttachExcel(false);
            setAttachPdf(true);
        }
    }, [canAttachExcel]);

    // Multi-recipient state
    const [selectedRecipients, setSelectedRecipients] = useState<{ name: string; email: string }[]>(() => {
        if (currentUserEmail) return [{ name: 'Me', email: currentUserEmail }];
        return [];
    });
    const [recipientSearch, setRecipientSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [customEmailInput, setCustomEmailInput] = useState('');
    const [subject, setSubject] = useState(`${reportLabel} – ${dateRangeStr}`);
    const [message, setMessage] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!isDropdownOpen) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isDropdownOpen]);

    if (!isOpen) return null;

    // Filter users: has email, not already selected
    const selectedEmails = new Set(selectedRecipients.map(r => r.email.toLowerCase()));
    const filteredUsers = availableUsers
        .filter(u => u.email && !selectedEmails.has(u.email.toLowerCase()))
        .filter(u => {
            if (!recipientSearch) return true;
            const q = recipientSearch.toLowerCase();
            return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        })
        .slice(0, 30);

    const addRecipient = (name: string, email: string) => {
        if (!email || selectedEmails.has(email.toLowerCase())) return;
        setSelectedRecipients(prev => [...prev, { name, email }]);
        setRecipientSearch('');
        setIsDropdownOpen(false);
    };

    const removeRecipient = (email: string) => {
        setSelectedRecipients(prev => prev.filter(r => r.email !== email));
    };

    const handleCustomEmailAdd = () => {
        const email = customEmailInput.trim();
        if (!email || !email.includes('@')) return;
        addRecipient(email, email);
        setCustomEmailInput('');
    };

    const handleSend = () => {
        if (selectedRecipients.length === 0) return;
        if (!attachPdf && !attachExcel) return;
        const htmlBody = buildReportEmailHtml({
            reportType,
            filterSummary,
            userMessage: message,
            generatedBy: filterSummary.generatedBy || 'Paradigm System',
            attachPdf,
            attachExcel,
        });
        onSend({
            to: selectedRecipients.map(r => r.email),
            subject,
            html: htmlBody,
            triggerType: 'manual',
            attachPdf,
            attachExcel,
        });
    };

    const filterChips: { label: string; value: string }[] = [
        { label: 'Period', value: dateRangeStr },
        { label: 'Employee', value: filterSummary.employeeName || 'All Employees' },
        ...(filterSummary.company ? [{ label: 'Company', value: filterSummary.company }] : []),
        ...(filterSummary.site ? [{ label: 'Site', value: filterSummary.site }] : []),
        ...(filterSummary.role ? [{ label: 'Role', value: filterSummary.role }] : []),
        ...(filterSummary.staffCategory ? [{ label: 'Category', value: filterSummary.staffCategory }] : []),
    ];

    const attachedLabels = [attachPdf && 'PDF', attachExcel && 'Excel'].filter(Boolean).join(' & ');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0b291a] w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-[#1a3d2c] overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-[#1a3d2c] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-[#006b3f] dark:text-emerald-400">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mail Report</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {attachedLabels ? `${attachedLabels} attached` : 'Select attachment'} &middot; Select recipients below
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-[#1a3d2c] transition-all cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Report Summary Card */}
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <FileDown className="w-4 h-4 text-[#006b3f] dark:text-emerald-400" />
                            <span className="text-xs font-bold text-[#006b3f] dark:text-emerald-300 uppercase tracking-wide">Report Being Sent</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2.5">{reportLabel}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {filterChips.map(chip => (
                                <span key={chip.label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-[#0b291a] border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-gray-700 dark:text-gray-200">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{chip.label}:</span>
                                    {chip.value}
                                </span>
                            ))}
                            {filterSummary.recordCount !== undefined && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs font-medium text-green-700 dark:text-green-300">
                                    {filterSummary.recordCount} records
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Format Selector: PDF & Excel */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                            Attached Document Formats <span className="normal-case font-normal text-gray-400">(select at least one)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <label
                                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                    attachPdf
                                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-sm'
                                        : 'bg-gray-50 dark:bg-[#041b0f] border-gray-200 dark:border-[#1a3d2c] text-gray-400 opacity-60'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={attachPdf}
                                    onChange={e => {
                                        if (!e.target.checked && !attachExcel) return;
                                        setAttachPdf(e.target.checked);
                                    }}
                                    className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                />
                                <div className="min-w-0">
                                    <p className="text-xs font-bold leading-tight">PDF Document</p>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Printable styled .pdf</p>
                                </div>
                            </label>

                            {canAttachExcel && (
                                <label
                                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                        attachExcel
                                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 shadow-sm'
                                            : 'bg-gray-50 dark:bg-[#041b0f] border-gray-200 dark:border-[#1a3d2c] text-gray-400 opacity-60'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={attachExcel}
                                        onChange={e => {
                                            if (!e.target.checked && !attachPdf) return;
                                            setAttachExcel(e.target.checked);
                                        }}
                                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold leading-tight">Excel Spreadsheet</p>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Formatted styled .xlsx</p>
                                    </div>
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Multi-Recipient Selector */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                            Recipients <span className="normal-case font-normal text-gray-400">({selectedRecipients.length} selected)</span>
                        </label>

                        {/* Selected Recipient Chips */}
                        {selectedRecipients.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2 p-2.5 rounded-xl border border-gray-200 dark:border-[#1a3d2c] bg-gray-50 dark:bg-[#041b0f] min-h-[44px]">
                                {selectedRecipients.map(r => (
                                    <span key={r.email} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                                        <span className="max-w-[140px] truncate" title={r.email}>
                                            {r.name !== r.email ? r.name : r.email}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeRecipient(r.email)}
                                            className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-200 dark:bg-emerald-700 hover:bg-red-200 dark:hover:bg-red-700 text-emerald-700 dark:text-emerald-200 hover:text-red-700 dark:hover:text-red-200 flex items-center justify-center transition-colors cursor-pointer"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Search Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <div className="relative">
                                <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={recipientSearch}
                                    onChange={e => { setRecipientSearch(e.target.value); setIsDropdownOpen(true); }}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    placeholder="Search by name or email..."
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#1a3d2c] bg-gray-50 dark:bg-[#041b0f] text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                                />
                            </div>

                            {isDropdownOpen && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#0e2318] border border-gray-200 dark:border-[#1a3d2c] rounded-xl shadow-xl overflow-hidden">
                                    <div className="max-h-48 overflow-y-auto">
                                        {filteredUsers.length === 0 && (
                                            <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">No users found</div>
                                        )}
                                        {filteredUsers.map(u => (
                                            <button
                                                key={u.id || u.email}
                                                type="button"
                                                onClick={() => addRecipient(u.name, u.email)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-left cursor-pointer"
                                            >
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#006b3f] to-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                    {(u.name || u.email).charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{u.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                                                </div>
                                                {u.role && (
                                                    <span className="ml-auto flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#1a3d2c] px-1.5 py-0.5 rounded-md">{u.role}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Custom Email Add */}
                        <div className="flex gap-2 mt-2">
                            <input
                                type="email"
                                value={customEmailInput}
                                onChange={e => setCustomEmailInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCustomEmailAdd(); } }}
                                placeholder="Or type a custom email and press Enter"
                                className="flex-1 px-3 py-2 rounded-xl border border-dashed border-gray-300 dark:border-[#2a4536] bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-xs placeholder:text-gray-400"
                            />
                            <button
                                type="button"
                                onClick={handleCustomEmailAdd}
                                disabled={!customEmailInput.includes('@')}
                                className="px-3 py-2 rounded-xl bg-[#006b3f] hover:bg-[#005632] text-white text-xs font-semibold disabled:opacity-40 transition-all cursor-pointer"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#1a3d2c] bg-gray-50 dark:bg-[#041b0f] text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                        />
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                            Additional Message <span className="normal-case font-normal text-gray-400">(Optional)</span>
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={3}
                            placeholder="e.g. Dear Management, Please review the attached report for discrepancies."
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#1a3d2c] bg-gray-50 dark:bg-[#041b0f] text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none text-sm"
                        />
                        <p className="mt-1.5 text-xs text-gray-400">A professional HTML email with the filter summary will be auto-generated. Your message is prepended at the top.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 bg-gray-50 dark:bg-[#041b0f]/50 border-t border-gray-100 dark:border-[#1a3d2c] flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a3d2c] transition-all text-sm cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={isSending || selectedRecipients.length === 0 || (!attachPdf && !attachExcel)}
                        onClick={handleSend}
                        className="flex-[2] bg-[#006b3f] hover:bg-[#005632] text-white font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm cursor-pointer"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Sending to {selectedRecipients.length}...</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-5 h-5" />
                                <span>Send to {selectedRecipients.length} Recipient{selectedRecipients.length !== 1 ? 's' : ''}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
