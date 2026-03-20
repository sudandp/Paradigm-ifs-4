import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { api } from '../../services/api';
import type { SiteInvoiceRecord, SiteInvoiceDefault } from '../../types';
import { format, differenceInCalendarDays, parseISO, isBefore, isToday, startOfDay, subDays } from 'date-fns';
import { Loader2, Plus, Trash2, Edit2, ClipboardList, CheckCircle2, Clock, Mail, AlertTriangle, Building2, Building, Download, Upload, FileSpreadsheet, X, Search, RotateCcw, ShieldX, Info, AlertCircle, FilterX } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import Toast from '../../components/ui/Toast';
import RevisionHistoryModal from '../../components/modals/RevisionHistoryModal';
import LoadingScreen from '../../components/ui/LoadingScreen';


const SiteAttendanceTracker: React.FC = () => {
    const navigate = useNavigate();
    const [records, setRecords] = useState<SiteInvoiceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [previewData, setPreviewData] = useState<Partial<SiteInvoiceRecord>[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [siteDefaults, setSiteDefaults] = useState<SiteInvoiceDefault[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [revisionModal, setRevisionModal] = useState<{ isOpen: boolean; recordId: string; siteName: string }>({ isOpen: false, recordId: '', siteName: '' });

    // Filter & Pagination State
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({ 
        siteName: '', 
        status: '',
        year: new Date().getFullYear().toString(),
        month: 'all',
        startDate: '',
        endDate: ''
    });

    const clearFilters = () => {
        setFilters({ 
            siteName: '', 
            status: '',
            year: new Date().getFullYear().toString(),
            month: 'all',
            startDate: '',
            endDate: ''
        });
        setSearchQuery('');
    };
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(15);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Deletion State
    const [deletedRecords, setDeletedRecords] = useState<SiteInvoiceRecord[]>([]);
    const [activeSubTab, setActiveSubTab] = useState<'active' | 'log'>('active');
    const [recordToDelete, setRecordToDelete] = useState<SiteInvoiceRecord | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRestoring, setIsRestoring] = useState<string | null>(null);

    const { user } = useAuthStore();

    const fetchInitialData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const userRole = (user.role || '').toLowerCase();
            const isSuperAdmin = ['admin', 'super_admin', 'finance_manager', 'management', 'hr', 'hr_ops'].includes(userRole);
            const managerId = isSuperAdmin ? undefined : user.id;

            const [fetchedRecords, fetchedDefaults, fetchedDeleted] = await Promise.all([
                api.getSiteInvoiceRecords(managerId),
                api.getSiteInvoiceDefaults(managerId),
                api.getDeletedSiteInvoiceRecords(managerId)
            ]);
            setRecords(fetchedRecords);
            setSiteDefaults(fetchedDefaults);
            setDeletedRecords(fetchedDeleted);

            // Auto-cleanup records older than 7 days
            const sevenDaysAgo = subDays(new Date(), 7);
            const recordsToCleanup = fetchedDeleted.filter(r => 
                r.deletedAt && new Date(r.deletedAt) < sevenDaysAgo
            );

            if (recordsToCleanup.length > 0) {
                await Promise.all(recordsToCleanup.map(r => api.permanentlyDeleteSiteInvoiceRecord(r.id)));
                const refreshedDeleted = await api.getDeletedSiteInvoiceRecords();
                setDeletedRecords(refreshedDeleted);
            }
        } catch (error) {
            console.error('Error fetching tracker data:', error);
            setToast({ message: 'Failed to load data', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const handleDelete = async (reason: string) => {
        if (isBulkDeleting) {
            await handleBulkDelete(reason);
            return;
        }
        if (!recordToDelete || !user) return;
        setIsDeleting(true);
        try {
            await api.softDeleteSiteInvoiceRecord(recordToDelete.id, reason, user.id, user.name || 'Unknown');
            setToast({ message: 'Record moved to deletion log', type: 'success' });
            setRecordToDelete(null);
            setDeleteReason('');
            setShowDeleteModal(false);
            fetchInitialData();
        } catch (error) {
            setToast({ message: 'Failed to delete record', type: 'error' });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBulkDelete = async (reason: string) => {
        if (selectedIds.size === 0 || !user) return;
        setIsDeleting(true);
        try {
            const ids = Array.from(selectedIds);
            await api.bulkSoftDeleteSiteInvoiceRecords(
                ids,
                reason,
                user.id,
                user.name || 'Unknown'
            );
            setToast({ message: `${selectedIds.size} records moved to deletion log`, type: 'success' });
            setSelectedIds(new Set());
            setDeleteReason('');
            setIsBulkDeleting(false);
            setShowDeleteModal(false);
            fetchInitialData();
        } catch (error) {
            console.error('Bulk delete error:', error);
            setToast({ message: 'Failed to delete selected records', type: 'error' });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRestore = async (id: string) => {
        setIsRestoring(id);
        try {
            await api.restoreSiteInvoiceRecord(id);
            setToast({ message: 'Record restored successfully', type: 'success' });
            fetchInitialData();
        } catch (error) {
            setToast({ message: 'Failed to restore record', type: 'error' });
        } finally {
            setIsRestoring(null);
        }
    };

  const handlePermanentDelete = async (id: string) => {
        if (!window.confirm('This will permanently delete the record. Continue?')) return;
        try {
            await api.permanentlyDeleteSiteInvoiceRecord(id);
            setToast({ message: 'Record permanently deleted', type: 'success' });
            fetchInitialData();
        } catch (error) {
            setToast({ message: 'Failed to delete record', type: 'error' });
        }
    };

    const handleBulkRestore = async () => {
        if (selectedIds.size === 0 || !isAdmin) return;
        setIsRestoring('bulk');
        try {
            const ids = Array.from(selectedIds);
            await api.bulkRestoreSiteInvoiceRecords(ids);
            setToast({ message: `${selectedIds.size} records restored successfully`, type: 'success' });
            setSelectedIds(new Set());
            fetchInitialData();
        } catch (error) {
            setToast({ message: 'Failed to restore records', type: 'error' });
        } finally {
            setIsRestoring(null);
        }
    };

    const handleBulkPermanentDelete = async () => {
        if (selectedIds.size === 0 || !isAdmin) return;
        if (!window.confirm(`Are you sure you want to permanently delete these ${selectedIds.size} records? This action cannot be undone.`)) return;

        try {
            const ids = Array.from(selectedIds);
            await api.bulkPermanentlyDeleteSiteInvoiceRecords(ids);
            setToast({ message: `${selectedIds.size} records permanently deleted`, type: 'success' });
            setSelectedIds(new Set());
            fetchInitialData();
        } catch (error) {
            setToast({ message: 'Failed to delete records', type: 'error' });
        }
    };

    const getDelayColor = (delay: number | null) => {
        if (delay === null) return 'text-gray-400';
        if (delay > 5) return 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-bold';
        if (delay > 0) return 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-semibold';
        return 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-medium';
    };

    const parseExcelDate = (val: any): string | null => {
        if (!val) return null;
        if (val instanceof Date) return format(val, 'yyyy-MM-dd');
        const str = val.toString().trim();
        if (!str) return null;
        // Handle common Excel date formats or raw strings
        try {
            const date = new Date(str);
            if (!isNaN(date.getTime())) {
                return format(date, 'yyyy-MM-dd');
            }
        } catch (e) {
            console.warn('Failed to parse date:', str);
        }
        return null;
    };

    const calculateDelay = (received: string, tentative: string): number | null => {
        if (!received || !tentative) return null;
        try {
            return differenceInCalendarDays(parseISO(received), parseISO(tentative));
        } catch (e) {
            return null;
        }
    };

    // --- Excel Functions ---
    const handleExport = async () => {
        setIsExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const ws = workbook.addWorksheet('Invoice Tracker');
            ws.columns = [
                { header: 'Site Name', key: 'siteName', width: 25 },
                { header: 'Company Name', key: 'companyName', width: 18 },
                { header: 'Billing Cycle', key: 'billingCycle', width: 18 },
                { header: 'Ops Incharge', key: 'opsIncharge', width: 15 },
                { header: 'HR Incharge', key: 'hrIncharge', width: 15 },
                { header: 'Invoice Incharge', key: 'invoiceIncharge', width: 18 },
                { header: 'Ops Remarks', key: 'opsRemarks', width: 20 },
                { header: 'HR Remarks', key: 'hrRemarks', width: 20 },
                { header: 'Finance Remarks', key: 'financeRemarks', width: 20 },
                { header: 'Manager Tentative Date', key: 'managerTentativeDate', width: 15 },
                { header: 'Manager Received Date', key: 'managerReceivedDate', width: 15 },
                { header: 'HR Tentative Date', key: 'hrTentativeDate', width: 15 },
                { header: 'HR Received Date', key: 'hrReceivedDate', width: 15 },
                { header: 'Attendance Received Time', key: 'attendanceReceivedTime', width: 12 },
                { header: 'Invoice Sharing Tentative Date', key: 'invoiceSharingTentativeDate', width: 15 },
                { header: 'Invoice Prepared Date', key: 'invoicePreparedDate', width: 15 },
                { header: 'Invoice Sent Date', key: 'invoiceSentDate', width: 15 },
                { header: 'Invoice Sent Time', key: 'invoiceSentTime', width: 12 },
                { header: 'Invoice Sent Method Remarks', key: 'invoiceSentMethodRemarks', width: 25 },
                { header: 'Received Balance', key: 'receivedBalance', width: 15 },
                { header: 'Balance Receipt No / Remarks', key: 'receivedBalanceReceipt', width: 25 },
            ];
            ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006B3F' } };
            records.forEach(r => ws.addRow(r));
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Attendance_Tracker_${format(new Date(), 'yyyyMMdd')}.xlsx`);
            setToast({ message: 'Exported successfully!', type: 'success' });
        } catch (err) {
            setToast({ message: 'Failed to export', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadTemplate = async () => {
        setIsExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const ws = workbook.addWorksheet('Template');
            ws.columns = [
                { header: 'Site Name', key: 'siteName', width: 25 },
                { header: 'Company Name', key: 'companyName', width: 20 },
                { header: 'Billing Cycle', key: 'billingCycle', width: 20 },
                { header: 'Ops Incharge', key: 'opsIncharge', width: 20 },
                { header: 'HR Incharge', key: 'hrIncharge', width: 20 },
                { header: 'Invoice Incharge', key: 'invoiceIncharge', width: 20 },
                { header: 'Ops Remarks', key: 'opsRemarks', width: 20 },
                { header: 'HR Remarks', key: 'hrRemarks', width: 20 },
                { header: 'Finance Remarks', key: 'financeRemarks', width: 20 },
                { header: 'Manager Tentative Date', key: 'managerTentativeDate', width: 15 },
                { header: 'Manager Received Date', key: 'managerReceivedDate', width: 15 },
                { header: 'HR Tentative Date', key: 'hrTentativeDate', width: 15 },
                { header: 'HR Received Date', key: 'hrReceivedDate', width: 15 },
                { header: 'Attendance Received Time', key: 'attendanceReceivedTime', width: 12 },
                { header: 'Invoice Sharing Tentative Date', key: 'invoiceSharingTentativeDate', width: 15 },
                { header: 'Invoice Prepared Date', key: 'invoicePreparedDate', width: 15 },
                { header: 'Invoice Sent Date', key: 'invoiceSentDate', width: 15 },
                { header: 'Invoice Sent Time', key: 'invoiceSentTime', width: 12 },
                { header: 'Invoice Sent Method Remarks', key: 'invoiceSentMethodRemarks', width: 25 },
                { header: 'Received Balance', key: 'receivedBalance', width: 15 },
                { header: 'Balance Receipt No / Remarks', key: 'receivedBalanceReceipt', width: 25 },
            ];
            ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
            siteDefaults.forEach(d => ws.addRow(d));
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const uploadYearStr = filters.year === 'all' ? new Date().getFullYear().toString() : filters.year;
            const uploadMonthStr = filters.month === 'all' ? (new Date().getMonth() + 1).toString() : filters.month;
            const templateMonth = format(new Date(Number(uploadYearStr), Number(uploadMonthStr) - 1, 1), 'yyyy-MM');
            
            saveAs(blob, `Attendance_Tracker_Template_${templateMonth}.xlsx`);
            setToast({ message: 'Template downloaded!', type: 'success' });
        } catch (err) {
            console.error('Template error:', err);
            setToast({ message: 'Failed to download template', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());
            const ws = workbook.getWorksheet(1);
            const parsed: Partial<SiteInvoiceRecord>[] = [];
            ws?.eachRow((row, i) => {
                if (i === 1) return;
                parsed.push({
                    siteName: row.getCell(1).value?.toString() || '',
                    companyName: row.getCell(2).value?.toString() || '',
                    billingCycle: row.getCell(3).value?.toString() || '',
                    opsIncharge: row.getCell(4).value?.toString() || '',
                    hrIncharge: row.getCell(5).value?.toString() || '',
                    invoiceIncharge: row.getCell(6).value?.toString() || '',
                    opsRemarks: row.getCell(7).value?.toString() || '',
                    hrRemarks: row.getCell(8).value?.toString() || '',
                    financeRemarks: row.getCell(9).value?.toString() || '',
                    managerTentativeDate: parseExcelDate(row.getCell(10).value),
                    managerReceivedDate: parseExcelDate(row.getCell(11).value),
                    hrTentativeDate: parseExcelDate(row.getCell(12).value),
                    hrReceivedDate: parseExcelDate(row.getCell(13).value),
                    attendanceReceivedTime: row.getCell(14).value?.toString() || '',
                    invoiceSharingTentativeDate: parseExcelDate(row.getCell(15).value),
                    invoicePreparedDate: parseExcelDate(row.getCell(16).value),
                    invoiceSentDate: parseExcelDate(row.getCell(17).value),
                    invoiceSentTime: row.getCell(18).value?.toString() || '',
                    invoiceSentMethodRemarks: row.getCell(19).value?.toString() || '',
                });
            });
            setPreviewData(parsed.filter(p => !!p.siteName));
            setToast({ message: 'File parsed. Please review.', type: 'success' });
        } catch (err) {
            setToast({ message: 'Failed to parse file', type: 'error' });
        }
    };

    const handleConfirmImport = async () => {
        if (!user) return;
        setIsImporting(true);
        try {
            const recordsWithUser = previewData.map(r => ({
                ...r,
                createdBy: user.id,
                createdByName: user.name,
                createdByRole: user.role
            }));
            await api.bulkSaveSiteInvoiceRecords(recordsWithUser);
            setToast({ message: 'Records imported!', type: 'success' });
            setPreviewData([]);
            fetchInitialData();
        } catch (err: any) {
            console.error('Import failed:', err);
            const detailedError = err.message || err.details || 'Check console for details';
            setToast({ message: `Import failed: ${detailedError}`, type: 'error' });
        } finally {
            setIsImporting(false);
        }
    };

    // --- Filter & Stats ---
    const currentRecords = activeSubTab === 'active' ? records : deletedRecords;

    const siteOptions = useMemo(() => {
        const sites = new Set(records.map(r => r.siteName));
        siteDefaults.forEach(s => sites.add(s.siteName));
        return Array.from(sites).sort();
    }, [records, siteDefaults]);

    const filteredRecords = useMemo(() => {
        return currentRecords.filter(r => {
            const matchesSearch = r.siteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (r.companyName || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesSiteName = !filters.siteName || 
                r.siteName.toLowerCase().includes(filters.siteName.toLowerCase());
                
            const matchesStatus = !filters.status || (() => {
                const isSent = !!r.invoiceSentDate;
                return filters.status === 'sent' ? isSent : !isSent;
            })();

            // Date filtering (based on createdAt)
            const recordDate = r.createdAt ? parseISO(r.createdAt) : null;
            const matchesYear = filters.year === 'all' || (recordDate && recordDate.getFullYear().toString() === filters.year);
            const matchesMonth = filters.month === 'all' || (recordDate && (recordDate.getMonth() + 1).toString() === filters.month);

            // Custom Date Range
            let matchesCustomRange = true;
            if (recordDate) {
                const dateOnly = startOfDay(recordDate);
                if (filters.startDate) {
                    matchesCustomRange = matchesCustomRange && (dateOnly >= startOfDay(parseISO(filters.startDate)));
                }
                if (filters.endDate) {
                    matchesCustomRange = matchesCustomRange && (dateOnly <= startOfDay(parseISO(filters.endDate)));
                }
            } else if (filters.startDate || filters.endDate) {
                matchesCustomRange = false;
            }

            return matchesSearch && matchesSiteName && matchesStatus && matchesYear && matchesMonth && matchesCustomRange;
        });
    }, [currentRecords, searchQuery, filters]);

    const stats = useMemo(() => {
        const total = records.length;
        const sent = records.filter(r => !!r.invoiceSentDate).length;
        const pending = total - sent;
        const today = startOfDay(new Date());
        const due = records.filter(r => {
            if (!!r.invoiceSentDate || !r.invoiceSharingTentativeDate) return false;
            return isBefore(parseISO(r.invoiceSharingTentativeDate), today) || isToday(parseISO(r.invoiceSharingTentativeDate));
        });
        return { total, sent, pending, due };
    }, [records]);

    const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = paginatedRecords.map(r => r.id);
            setSelectedIds(new Set(allIds));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    useEffect(() => { 
        setCurrentPage(1); 
    }, [searchQuery, filters, activeSubTab]);

    useEffect(() => {
        setFilters({ 
            siteName: '', 
            status: '',
            year: new Date().getFullYear().toString(),
            month: 'all',
            startDate: '',
            endDate: ''
        });
        setSelectedIds(new Set());
    }, [activeSubTab]);

    const isAdmin = ['admin', 'super_admin', 'management', 'hr'].includes(user?.role || '');

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="space-y-6 w-full px-4">
            {/* ── Action Bar ── */}
            <div className="bg-[#06251c] md:bg-white rounded-xl border border-white/5 md:border-gray-200 shadow-sm p-4 md:p-5 space-y-4">
                {/* Row 1: All Filtering Options */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <select
                            value={filters.year}
                            onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                            className="h-10 px-3 bg-[#041b0f] md:bg-gray-50 border border-white/10 md:border-gray-200 rounded-lg text-xs md:text-sm text-white md:text-gray-900 focus:outline-none focus:border-[#00D27F] transition-all font-semibold cursor-pointer min-w-[100px]"
                        >
                            <option value="all">Year</option>
                            {Array.from({ length: 5 }, (_, i) => {
                                const year = new Date().getFullYear() - i;
                                return <option key={year} value={year.toString()}>{year}</option>;
                            })}
                        </select>

                        <select
                            value={filters.month}
                            onChange={(e) => setFilters(prev => ({ ...prev, month: e.target.value }))}
                            className="h-10 px-3 bg-[#041b0f] md:bg-gray-50 border border-white/10 md:border-gray-200 rounded-lg text-xs md:text-sm text-white md:text-gray-900 focus:outline-none focus:border-[#00D27F] transition-all font-semibold cursor-pointer min-w-[110px]"
                        >
                            <option value="all">Month</option>
                            {Array.from({ length: 12 }, (_, i) => {
                                const date = new Date(2000, i, 1);
                                return <option key={i + 1} value={(i + 1).toString()}>{format(date, 'MMMM')}</option>;
                            })}
                        </select>

                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            className="h-10 px-3 bg-[#041b0f] md:bg-gray-50 border border-white/10 md:border-gray-200 rounded-lg text-xs md:text-sm text-white md:text-gray-900 focus:outline-none focus:border-[#00D27F] transition-all font-semibold cursor-pointer min-w-[110px]"
                        >
                            <option value="">Status</option>
                            <option value="sent">Sent</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1 bg-[#041b0f] md:bg-gray-50 p-1 rounded-lg border border-white/10 md:border-gray-200 shrink-0">
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                            className="h-8 px-2 bg-transparent text-[10px] text-white md:text-gray-900 focus:outline-none font-semibold cursor-pointer"
                            title="Start Date"
                        />
                        <span className="text-white/30 md:text-gray-400 text-xs">-</span>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                            className="h-8 px-2 bg-transparent text-[10px] text-white md:text-gray-900 focus:outline-none font-semibold cursor-pointer"
                            title="End Date"
                        />
                    </div>

                    <button
                        onClick={clearFilters}
                        className="h-10 w-10 flex items-center justify-center text-rose-400 hover:text-rose-500 bg-white/5 md:bg-rose-50 border border-white/10 md:border-rose-100 rounded-lg transition-all hover:scale-105 active:scale-95 shrink-0"
                        title="Clear All Filters"
                    >
                        <FilterX className="h-4 w-4" />
                    </button>

                    <div className="h-10 w-px bg-white/10 md:bg-gray-200 hidden md:block mx-1" />

                    <div className="flex-1 flex items-center gap-2 min-w-[300px]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500/50 md:text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search site or company..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-10 pl-10 pr-4 bg-[#041b0f] md:bg-gray-50 border border-white/10 md:border-gray-200 rounded-lg text-xs md:text-sm text-white md:text-gray-900 placeholder-emerald-500/30 md:placeholder-gray-400 focus:outline-none focus:border-[#00D27F] transition-all shadow-sm"
                            />
                        </div>
                        <select
                            value={filters.siteName}
                            onChange={(e) => setFilters(prev => ({ ...prev, siteName: e.target.value }))}
                            className="h-10 px-3 bg-[#041b0f] md:bg-gray-50 border border-white/10 md:border-gray-200 rounded-lg text-xs md:text-sm text-white md:text-gray-900 focus:outline-none focus:border-[#00D27F] transition-all font-semibold min-w-[160px] shadow-sm cursor-pointer"
                        >
                            <option value="">All Sites</option>
                            {siteOptions.map(site => (
                                <option key={site} value={site}>{site}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Row 2: All Primary Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 md:border-gray-100">
                    <button
                        onClick={() => navigate('/finance/attendance/add')}
                        className="whitespace-nowrap h-11 inline-flex items-center justify-center gap-2 px-6 py-2 text-sm font-bold text-[#041b0f] md:text-white bg-[#00D27F] md:bg-emerald-600 rounded-xl hover:bg-[#00b86e] md:hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
                    >
                        <Plus className="h-4 w-4" />
                        <span>New Entry</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadTemplate}
                            disabled={isExporting}
                            className="whitespace-nowrap h-11 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-400 md:text-emerald-700 bg-emerald-500/10 md:bg-emerald-50 border border-emerald-500/20 md:border-emerald-100 rounded-lg hover:bg-emerald-500/20 md:hover:bg-emerald-100 transition-all disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            <span>Download Template</span>
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="whitespace-nowrap h-11 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-amber-400 md:text-amber-700 bg-amber-500/10 md:bg-amber-50 border border-amber-500/20 md:border-amber-100 rounded-lg hover:bg-amber-500/20 md:hover:bg-amber-100 transition-all"
                        >
                            <Upload className="h-3.5 w-3.5" />
                            <span>Import Data</span>
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="whitespace-nowrap h-11 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-blue-400 md:text-blue-700 bg-blue-500/10 md:bg-blue-50 border border-blue-500/20 md:border-blue-100 rounded-lg hover:bg-blue-500/20 md:hover:bg-blue-100 transition-all disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                            <span>Export Data</span>
                        </button>
                    </div>
                </div>
            </div>


            {/* ── KPI Summary Cards ── */}
            {!isLoading && (
                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#06251c] md:bg-white rounded-xl border border-white/5 md:border-gray-200 p-4 md:p-5 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] md:text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Total Sites</p>
                                <h3 className="text-lg md:text-xl font-bold text-white md:text-gray-900 mt-1.5">{stats.total}</h3>
                                <p className="text-[9px] md:text-[10px] font-medium text-emerald-400/50 md:text-gray-400 mt-1">Active this month</p>
                            </div>
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white/5 md:bg-gray-50 flex items-center justify-center border border-white/10 md:border-gray-100">
                                <Building2 className="h-4 w-4 md:h-5 md:w-5 text-emerald-400/70 md:text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#06251c] md:bg-white rounded-xl border border-white/5 md:border-gray-200 p-4 md:p-5 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] md:text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Sent Status</p>
                                <h3 className="text-lg md:text-xl font-bold text-emerald-400 md:text-emerald-600 mt-1.5">{stats.sent}</h3>
                                <p className="text-[9px] md:text-[10px] font-medium text-emerald-400 md:text-emerald-600/60 mt-1 font-bold">Ready for billing</p>
                            </div>
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white/5 md:bg-emerald-50 flex items-center justify-center border border-white/10 md:border-emerald-100">
                                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-emerald-400 md:text-emerald-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#06251c] md:bg-white rounded-xl border border-white/5 md:border-gray-200 p-4 md:p-5 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] md:text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Pending</p>
                                <h3 className="text-lg md:text-xl font-bold text-amber-400 md:text-amber-600 mt-1.5">{stats.pending}</h3>
                                <p className="text-[9px] md:text-[10px] font-medium text-amber-400/80 md:text-amber-600/60 mt-1 font-bold">In processing</p>
                            </div>
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-amber-400/10 md:bg-amber-50 flex items-center justify-center border border-amber-400/20 md:border-amber-100">
                                <Clock className="h-4 w-4 md:h-5 md:w-5 text-amber-400 md:text-amber-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#FFF1F2] rounded-xl border border-rose-200 p-4 md:p-5 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] md:text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Due / Overdue</p>
                                <h3 className="text-lg md:text-xl font-bold text-rose-700 mt-1.5">{stats.due.length}</h3>
                                <p className="text-[9px] md:text-[10px] font-medium text-rose-600 mt-1 font-bold">Action required</p>
                            </div>
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-rose-100 flex items-center justify-center border border-rose-200 shadow-sm md:shadow-none">
                                <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-rose-600" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Due Alerts ── */}
            {!isLoading && stats.due.length > 0 && (
                <div className="bg-white/5 md:bg-rose-50 border border-white/10 md:border-rose-100 rounded-xl p-4 flex items-start gap-4 shadow-xl md:shadow-none">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                        <AlertCircle className="h-5 w-5 text-rose-500" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-white md:text-rose-900 flex items-center gap-2">
                            Immediate Action Required
                            <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                        </h4>
                        <p className="text-[11px] text-emerald-400/60 md:text-rose-700 mt-0.5">The following sites have reached their tentative invoice sharing date:</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {stats.due.map(site => (
                                <span key={site.id} className="inline-flex items-center px-3 py-1 rounded-full bg-[#041b0f] md:bg-white border border-white/10 md:border-rose-200 text-rose-400 md:text-rose-700 text-[10px] font-bold shadow-soft">
                                    {site.siteName} <span className="mx-1.5 text-white/20">•</span> Due: {site.invoiceSharingTentativeDate ? format(parseISO(site.invoiceSharingTentativeDate), 'dd MMM') : 'N/A'}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main Data Section ── */}
            <div className="bg-[#06251c] md:bg-white rounded-xl border border-white/5 md:border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                <div className="px-5 py-3 border-b border-white/5 md:border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex bg-[#041b0f] md:bg-gray-100/50 p-1 rounded-lg border border-white/5 md:border-gray-200">
                            <button
                                onClick={() => setActiveSubTab('active')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    activeSubTab === 'active' 
                                        ? 'bg-[#00D27F] md:bg-white text-[#041b0f] md:text-emerald-700 shadow-sm' 
                                        : 'text-emerald-400/50 md:text-gray-500 hover:text-emerald-400 md:hover:text-gray-700'
                                }`}
                            >
                                Active Records
                            </button>
                            <button
                                onClick={() => setActiveSubTab('log')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    activeSubTab === 'log' 
                                        ? 'bg-rose-500 text-white shadow-sm' 
                                        : 'text-emerald-400/50 md:text-gray-500 hover:text-emerald-400 md:hover:text-gray-700'
                                }`}
                            >
                                Deletion Log
                                {deletedRecords.length > 0 && (
                                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeSubTab === 'log' ? 'bg-white text-rose-600' : 'bg-rose-500/20 text-rose-400'}`}>
                                        {deletedRecords.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>


                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                        <Loader2 className="h-7 w-7 animate-spin text-[#00D27F] md:text-emerald-600" />
                        <span className="text-sm text-emerald-400/40 font-medium tracking-tight">Loading records...</span>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-5 border border-white/5">
                            <ClipboardList className="h-7 w-7 text-emerald-500/20" />
                        </div>
                        <h3 className="text-lg font-bold text-white">
                            {activeSubTab === 'active' ? 'No attendance records' : 'Deletion log is empty'}
                        </h3>
                        <p className="text-sm text-emerald-400/40 mt-1.5 max-w-xs leading-relaxed">
                            {activeSubTab === 'active' 
                                ? 'No records found for the current filter. Add a new entry to get started.' 
                                : 'Records deleted in the last 7 days will appear here.'}
                        </p>
                        {activeSubTab === 'active' && (
                            <button
                                onClick={() => navigate('/finance/attendance/add')}
                                className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-[#041b0f] bg-[#00D27F] rounded-lg hover:bg-[#00b86e] transition-all shadow-lg shadow-emerald-500/20"
                            >
                                <Plus className="h-4 w-4" />
                                Add First Entry
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[#041b0f] md:bg-gray-50 border-b border-white/5 md:border-gray-200">
                                        <th className="px-5 py-3 text-left w-10">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded border-white/20 md:border-gray-300 bg-white/5 md:bg-white text-[#00D27F] md:text-emerald-600 focus:ring-[#00D27F] cursor-pointer"
                                                checked={paginatedRecords.length > 0 && paginatedRecords.every(r => selectedIds.has(r.id))}
                                                onChange={handleSelectAll}
                                            />
                                        </th>
                                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Site Information</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider hidden md:table-cell">Incharges (Ops / HR)</th>
                                        {activeSubTab === 'active' ? (
                                            <>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider whitespace-nowrap">Mgr Delay</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider whitespace-nowrap">HR Delay</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider whitespace-nowrap">Sharing Delay</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Deleted By</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Reason</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Deleted At</th>
                                            </>
                                        )}
                                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {paginatedRecords.map((record, idx) => {
                                        const mgrDelay = calculateDelay(record.managerReceivedDate!, record.managerTentativeDate!);
                                        const hrDelay = calculateDelay(record.hrReceivedDate!, record.hrTentativeDate!);
                                        const sharingDelay = calculateDelay(record.invoiceSentDate!, record.invoiceSharingTentativeDate!);
                                        const isSelected = selectedIds.has(record.id);

                                        return (
                                            <tr key={record.id} className={`hover:bg-white/5 md:hover:bg-gray-50 transition-colors duration-100 group ${isSelected ? 'bg-emerald-500/10 md:bg-emerald-50' : ''}`}>
                                                <td className="px-5 py-3.5">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#00D27F] focus:ring-[#00D27F] cursor-pointer"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectRow(record.id)}
                                                    />
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="font-bold text-white md:text-gray-900 text-sm">{record.siteName}</div>
                                                    <div className="text-[11px] text-emerald-400/50 md:text-gray-500 mt-0.5">{record.companyName || '—'}</div>
                                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                        {record.billingCycle && <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 md:bg-gray-100 text-[#00D27F] md:text-gray-600 text-[10px] font-black uppercase tracking-tighter border border-emerald-500/20 md:border-gray-200">{record.billingCycle}</span>}
                                                        {record.revisionCount && record.revisionCount > 0 ? (
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRevisionModal({ isOpen: true, recordId: record.id, siteName: record.siteName });
                                                                }}
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 md:bg-blue-50 text-blue-400 md:text-blue-600 border border-blue-500/20 md:border-blue-100 text-[10px] font-bold uppercase tracking-tighter hover:bg-blue-500/20 md:hover:bg-blue-100 transition-colors cursor-pointer"
                                                            >
                                                                <RotateCcw className="h-2.5 w-2.5" />
                                                                Revised ({record.revisionCount})
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 hidden md:table-cell">
                                                    <div className="text-xs text-emerald-400 md:text-gray-600 font-medium">Ops: {record.opsIncharge || '—'}</div>
                                                    <div className="text-[11px] text-emerald-400/40 md:text-gray-400 mt-0.5">HR: {record.hrIncharge || '—'}</div>
                                                </td>
                                                {activeSubTab === 'active' ? (
                                                    <>
                                                        <td className="px-4 py-3.5 text-center text-xs">
                                                            <span className={getDelayColor(mgrDelay)}>
                                                                {mgrDelay !== null ? `${mgrDelay}d` : '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center text-xs">
                                                            <span className={getDelayColor(hrDelay)}>
                                                                {hrDelay !== null ? `${hrDelay}d` : '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center text-xs">
                                                            <span className={getDelayColor(sharingDelay)}>
                                                                {sharingDelay !== null ? `${sharingDelay}d` : '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center">
                                                            {record.invoiceSentDate ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#00D27F] text-[10px] font-black uppercase tracking-tight">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                    Sent
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-tight whitespace-nowrap">
                                                                    <Clock className="h-3 w-3" />
                                                                    Pending
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center">
                                                            <div className="text-[11px] font-bold text-white md:text-gray-900">{format(parseISO(record.createdAt!), 'dd MMM yyyy')}</div>
                                                            <div className="flex items-center justify-center gap-1 mt-1">
                                                                <span className="text-[10px] text-emerald-400/40 md:text-gray-400">{record.createdByName || 'System'}</span>
                                                                {record.createdByRole && (
                                                                    <span className="px-1 py-0.5 rounded bg-white/5 md:bg-gray-100 text-[9px] font-black text-emerald-400/60 md:text-gray-500 uppercase border border-white/5 md:border-gray-200 tracking-tighter">
                                                                        {record.createdByRole.replace('_', ' ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-4 py-3.5">
                                                            <div className="text-xs font-bold text-white md:text-gray-900">{record.deletedByName || 'Unknown'}</div>
                                                            <div className="text-[10px] text-emerald-400/40 md:text-gray-400 mt-0.5 font-mono">ID: {record.deletedBy?.slice(0, 8)}...</div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <div className="flex items-start gap-1.5">
                                                                <Info className="h-3 w-3 text-rose-400/60 md:text-rose-400 mt-0.5 shrink-0" />
                                                                <p className="text-[11px] text-rose-400/80 md:text-rose-600 font-medium leading-relaxed italic">"{record.deletedReason || 'No reason provided'}"</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <div className="text-[11px] font-bold text-white md:text-gray-900">{record.deletedAt ? format(parseISO(record.deletedAt), 'dd MMM, HH:mm') : '—'}</div>
                                                            <div className="text-[10px] text-rose-400/40 md:text-rose-400 mt-0.5 uppercase tracking-tighter font-black">Auto-purge in 7 days</div>
                                                        </td>
                                                    </>
                                                )}
                                                <td className="px-4 py-3.5 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {activeSubTab === 'active' ? (
                                                            <>
                                                                <button 
                                                                    onClick={() => navigate(`/finance/attendance/edit/${record.id}`)} 
                                                                    className="p-1.5 text-emerald-500 md:text-gray-500 hover:text-[#00D27F] md:hover:text-emerald-600 hover:bg-white/5 md:hover:bg-gray-100 rounded-md transition-all h-8 w-8 flex items-center justify-center border border-white/5 md:border-gray-100 shadow-sm"
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button 
                                                                    onClick={() => { setRecordToDelete(record); setIsBulkDeleting(false); setShowDeleteModal(true); }} 
                                                                    className="p-1.5 text-rose-500 md:text-gray-500 hover:text-rose-400 md:hover:text-rose-600 hover:bg-rose-500/10 md:hover:bg-rose-50 rounded-md transition-all h-8 w-8 flex items-center justify-center border border-white/5 md:border-gray-100 shadow-sm"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button 
                                                                    onClick={() => handleRestore(record.id)} 
                                                                    disabled={isRestoring === record.id || !isAdmin}
                                                                    className="p-1.5 text-emerald-400/40 hover:text-[#00D27F] hover:bg-white/5 rounded-md transition-all h-8 w-8 flex items-center justify-center border border-white/5 disabled:opacity-50"
                                                                    title="Restore"
                                                                >
                                                                    {isRestoring === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                                                </button>
                                                                <button 
                                                                    onClick={() => handlePermanentDelete(record.id)} 
                                                                    disabled={!isAdmin}
                                                                    className="p-1.5 text-rose-400/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all h-8 w-8 flex items-center justify-center border border-white/5 disabled:opacity-50"
                                                                    title="Permanent Delete"
                                                                >
                                                                    <ShieldX className="h-3.5 w-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card-Based List View */}
                        <div className="md:hidden divide-y divide-white/5">
                            {paginatedRecords.map(record => {
                                const mgrDelay = calculateDelay(record.managerReceivedDate!, record.managerTentativeDate!);
                                const hrDelay = calculateDelay(record.hrReceivedDate!, record.hrTentativeDate!);
                                const sharingDelay = calculateDelay(record.invoiceSentDate!, record.invoiceSharingTentativeDate!);
                                const isSelected = selectedIds.has(record.id);

                                return (
                                    <div 
                                        key={record.id} 
                                        className={`p-4 transition-all duration-150 border-b border-white/5 ${isSelected ? 'bg-emerald-500/10' : 'active:bg-white/5'}`}
                                        onClick={(e) => {
                                            if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
                                            handleSelectRow(record.id);
                                        }}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-start gap-3">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 mt-1 rounded border-white/20 bg-white/5 text-[#00D27F] focus:ring-[#00D27F] cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectRow(record.id)}
                                                />
                                                <div>
                                                    <h4 className="font-bold text-white leading-tight">{record.siteName}</h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-emerald-400/40 font-bold uppercase tracking-wider">{record.companyName || '—'}</span>
                                                        {record.billingCycle && (
                                                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-[#00D27F] text-[9px] font-black rounded uppercase tracking-tighter border border-emerald-500/20">
                                                                {record.billingCycle}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {activeSubTab === 'active' && (
                                                <div className="text-right">
                                                    {record.invoiceSentDate ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#00D27F] text-[9px] font-black uppercase tracking-tight">
                                                            <CheckCircle2 className="h-2.5 w-2.5" />
                                                            Sent
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase tracking-tight whitespace-nowrap">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            Pending
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {activeSubTab === 'active' ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="text-center p-2 bg-[#041b0f] rounded-lg border border-white/5">
                                                        <p className="text-[8px] font-bold text-emerald-400/40 uppercase tracking-widest mb-1">Mgr</p>
                                                        <p className={`text-xs font-black ${getDelayColor(mgrDelay)}`}>
                                                            {mgrDelay !== null ? `${mgrDelay}d` : '—'}
                                                        </p>
                                                    </div>
                                                    <div className="text-center p-2 bg-[#041b0f] rounded-lg border border-white/5">
                                                        <p className="text-[8px] font-bold text-emerald-400/40 uppercase tracking-widest mb-1">HR</p>
                                                        <p className={`text-xs font-black ${getDelayColor(hrDelay)}`}>
                                                            {hrDelay !== null ? `${hrDelay}d` : '—'}
                                                        </p>
                                                    </div>
                                                    <div className="text-center p-2 bg-[#041b0f] rounded-lg border border-white/5">
                                                        <p className="text-[8px] font-bold text-emerald-400/40 uppercase tracking-widest mb-1">Share</p>
                                                        <p className={`text-xs font-black ${getDelayColor(sharingDelay)}`}>
                                                            {sharingDelay !== null ? `${sharingDelay}d` : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-2 border-t border-dashed border-white/5">
                                                    <div className="text-[10px] text-emerald-400/40 font-bold uppercase tracking-tight">
                                                        {record.createdAt && format(parseISO(record.createdAt), 'dd MMM yyyy')} • <span className="text-white">{record.createdByName?.split(' ')[0] || 'System'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/finance/attendance/edit/${record.id}`); }} 
                                                            className="p-2 text-emerald-400/40 hover:text-[#00D27F] hover:bg-white/5 rounded-lg transition-all border border-white/5"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setRecordToDelete(record); setIsBulkDeleting(false); setShowDeleteModal(true); }} 
                                                            className="p-2 text-rose-400/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all border border-white/5"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="bg-rose-500/5 rounded-xl p-3 text-[11px] leading-relaxed italic text-rose-400/80 border border-rose-500/10 flex gap-2">
                                                    <Info className="h-3.5 w-3.5 shrink-0 text-rose-500/50" />
                                                    <span>"{record.deletedReason || 'No reason provided'}"</span>
                                                </div>
                                                <div className="flex items-center justify-between pt-1">
                                                    <div className="text-[10px] text-emerald-400/40">
                                                        <span className="font-bold text-white uppercase tracking-tight">{record.deletedByName || '—'}</span> • {record.deletedAt && format(parseISO(record.deletedAt), 'dd MMM, HH:mm')}
                                                    </div>
                                                    {isAdmin && (
                                                        <div className="flex items-center gap-1.5">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleRestore(record.id); }} 
                                                                disabled={isRestoring === record.id}
                                                                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter text-[#041b0f] bg-[#00D27F] rounded-lg hover:bg-[#00b86e] disabled:opacity-50 shadow-lg shadow-emerald-500/10"
                                                            >
                                                                Restore
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handlePermanentDelete(record.id); }} 
                                                                className="p-1.5 text-emerald-400/30 hover:text-rose-400 transition-colors"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-5 py-4 border-t border-white/5 md:border-border flex flex-col md:flex-row items-center justify-between bg-[#041b0f]/30 md:bg-card gap-4 md:gap-0">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] md:text-xs text-emerald-400/40 md:text-muted font-bold md:font-semibold uppercase md:uppercase tracking-widest md:tracking-wide">Rows:</span>
                                            <select
                                                value={rowsPerPage}
                                                onChange={(e) => {
                                                    setRowsPerPage(Number(e.target.value));
                                                    setCurrentPage(1);
                                                }}
                                                className="h-8 md:h-9 px-2 text-[11px] md:text-xs font-black md:font-bold text-emerald-400 md:text-primary-text bg-[#041b0f] md:bg-page border border-white/10 md:border-border rounded-lg outline-none focus:border-[#00D27F] md:focus:border-emerald-500 transition-all cursor-pointer shadow-sm"
                                            >
                                            <option value={10}>10</option>
                                            <option value={15}>15</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                        </select>
                                    </div>
                                    <p className="text-[10px] md:text-xs text-emerald-400/40 md:text-muted font-bold md:font-semibold uppercase md:uppercase tracking-tight md:tracking-wide">
                                        Showing {((currentPage - 1) * rowsPerPage) + 1}–{Math.min(currentPage * rowsPerPage, filteredRecords.length)} of {filteredRecords.length}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 md:px-4 py-1.5 md:h-9 text-[10px] md:text-xs font-black md:font-bold uppercase tracking-tighter md:tracking-wide text-emerald-400/60 md:text-primary-text bg-white/5 md:bg-page border border-white/5 md:border-border rounded-lg hover:bg-white/10 md:hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                        >Prev</button>
                                    <div className="flex items-center gap-1 mx-2">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-8 h-8 md:w-9 md:h-9 text-xs font-black rounded-lg transition-all ${page === currentPage ? 'bg-[#00D27F] md:bg-emerald-600 text-[#041b0f] md:text-white shadow-lg md:shadow-sm shadow-emerald-500/20' : 'text-emerald-400/40 md:text-muted hover:text-emerald-400 md:hover:text-primary-text hover:bg-white/5 md:hover:bg-page border border-white/5 md:border-border'}`}
                                                >{page}</button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 md:px-4 py-1.5 md:h-9 text-[10px] md:text-xs font-black md:font-bold uppercase tracking-tighter md:tracking-wide text-emerald-400/60 md:text-primary-text bg-white/5 md:bg-page border border-white/5 md:border-border rounded-lg hover:bg-white/10 md:hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                    >Next</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Import Preview Modal ── */}
            {previewData.length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-[#06251c] rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-white/10">
                        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">Attendance Import Preview</h2>
                                <p className="text-sm text-emerald-400/40 mt-0.5">{previewData.length} records ready to import</p>
                            </div>
                            <button onClick={() => setPreviewData([])} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                                <X className="h-5 w-5 text-emerald-400/40" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-[#041b0f]/50">
                            <table className="w-full text-sm">
                                <thead className="bg-[#041b0f] border-b border-white/5 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-emerald-400/60 uppercase tracking-widest">Site Name</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-bold text-emerald-400/60 uppercase tracking-widest">Company</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-bold text-emerald-400/60 uppercase tracking-widest">Billing</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-bold text-emerald-400/60 uppercase tracking-widest">Ops Incharge</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-bold text-emerald-400/60 uppercase tracking-widest">HR Incharge</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {previewData.map((record, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                            <td className="px-5 py-3 font-bold text-white">{record.siteName}</td>
                                            <td className="px-4 py-3 text-xs text-emerald-400/60">{record.companyName}</td>
                                            <td className="px-4 py-3 text-xs text-emerald-400/60">{record.billingCycle}</td>
                                            <td className="px-4 py-3 text-xs text-emerald-400/60">{record.opsIncharge}</td>
                                            <td className="px-4 py-3 text-xs text-emerald-400/60">{record.hrIncharge}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-white/5 bg-[#041b0f] flex justify-end gap-3">
                            <button onClick={() => setPreviewData([])} className="px-5 py-2 text-sm font-bold text-emerald-400/60 hover:text-emerald-400 hover:bg-white/5 rounded-xl transition-all border border-white/10">Cancel</button>
                            <button
                                onClick={handleConfirmImport}
                                disabled={isImporting}
                                className="inline-flex items-center gap-1.5 px-6 py-2 text-sm font-black text-[#041b0f] bg-[#00D27F] rounded-xl hover:bg-[#00b86e] transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                            >
                                {isImporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Confirm Import
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-[#041b0f] border border-[#00D27F]/20 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 backdrop-blur-xl">
                        <span className="text-sm font-bold text-emerald-400 border-r border-white/10 pr-6 uppercase tracking-wider">
                            {selectedIds.size} Selected
                        </span>
                        <div className="flex items-center gap-3">
                            {activeSubTab === 'active' ? (
                                <button
                                    onClick={() => {
                                        setIsBulkDeleting(true);
                                        setShowDeleteModal(true);
                                    }}
                                    className="flex items-center gap-2 px-5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-black uppercase tracking-tight transition-all shadow-lg shadow-rose-500/10"
                                >
                                    <Trash2 size={14} />
                                    Delete
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleBulkRestore}
                                        disabled={isRestoring === 'bulk'}
                                        className="flex items-center gap-2 px-5 py-2 bg-[#00D27F] hover:bg-[#00b86e] text-[#041b0f] rounded-xl text-xs font-black uppercase tracking-tight transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                                    >
                                        <RotateCcw size={14} className={isRestoring === 'bulk' ? 'animate-spin' : ''} />
                                        Restore
                                    </button>
                                    <button
                                        onClick={handleBulkPermanentDelete}
                                        disabled={!isAdmin}
                                        className="flex items-center gap-2 px-5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-black uppercase tracking-tight transition-all disabled:opacity-50"
                                    >
                                        <ShieldX size={14} />
                                        Delete Forever
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="px-4 py-2 hover:bg-white/5 rounded-xl text-xs font-bold text-emerald-400/60 hover:text-emerald-400 transition-all uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-[#06251c] rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-white/5">
                        <div className="p-8">
                            <div className="flex items-center gap-5 mb-8">
                                <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 border border-rose-500/20">
                                    <Trash2 size={28} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none">
                                        {isBulkDeleting ? `Delete ${selectedIds.size} Records` : 'Delete Record'}
                                    </h3>
                                    <p className="text-xs text-emerald-400/40 mt-2 font-bold uppercase tracking-widest">
                                        Move to Deletion Log
                                    </p>
                                </div>
                            </div>

                            {!isBulkDeleting && recordToDelete && (
                                <div className="bg-[#041b0f] rounded-2xl p-4 mb-8 border border-white/5">
                                    <p className="text-[10px] font-black text-emerald-400/20 uppercase tracking-widest mb-2">Selected Site</p>
                                    <p className="text-sm font-bold text-white">{recordToDelete.siteName}</p>
                                    <p className="text-[10px] text-emerald-400/40 mt-1 font-bold uppercase tracking-wider">{recordToDelete.companyName}</p>
                                </div>
                            )}

                            <div className="mb-8">
                                <label className="block text-xs font-black text-emerald-400/60 uppercase tracking-widest mb-3">Reason for Deletion</label>
                                <textarea
                                    value={deleteReason}
                                    onChange={(e) => setDeleteReason(e.target.value)}
                                    placeholder="Why are you deleting this?"
                                    className="w-full h-28 px-4 py-4 bg-[#041b0f] border border-white/10 focus:border-rose-500/50 rounded-2xl outline-none transition-all resize-none text-sm text-white placeholder-emerald-800"
                                />
                            </div>

                            <div className="bg-amber-500/5 rounded-2xl p-4 border border-amber-500/10 mb-8 flex items-start gap-4">
                                <AlertTriangle className="text-amber-500/40 flex-shrink-0 mt-0.5" size={18} />
                                <p className="text-[11px] text-amber-200/50 leading-relaxed font-bold uppercase tracking-tight">
                                    Restorable from Log within 7 days. After that, records purge automatically.
                                </p>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setRecordToDelete(null);
                                        setIsBulkDeleting(false);
                                    }}
                                    className="flex-1 py-4 px-4 bg-white/5 hover:bg-white/10 text-emerald-400 font-black uppercase tracking-widest rounded-2xl text-xs transition-all border border-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteReason)}
                                    disabled={!deleteReason.trim() || isDeleting}
                                    className="flex-[1.5] py-4 px-6 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-[#041b0f] rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-rose-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? 'Processing...' : 'Delete Now'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".xlsx,.xls"
            />

            <RevisionHistoryModal
                isOpen={revisionModal.isOpen}
                onClose={() => setRevisionModal({ ...revisionModal, isOpen: false })}
                recordId={revisionModal.recordId}
                siteName={revisionModal.siteName}
                trackerType="attendance"
            />
        </div>
    );
};

export default SiteAttendanceTracker;
