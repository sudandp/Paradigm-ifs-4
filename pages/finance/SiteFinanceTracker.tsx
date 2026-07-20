import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { api } from '../../services/api';
import type { SiteFinanceRecord, SiteInvoiceDefault } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { format, startOfMonth, startOfDay, parseISO } from 'date-fns';
import { 
    Loader2, Plus, Edit2, Trash2, IndianRupee, FileSpreadsheet, TrendingUp, TrendingDown, 
    ClipboardCheck, Building2, Download, Upload, AlertTriangle, RotateCcw, ShieldX, Search, Info, FilterX, X, Clock
} from 'lucide-react';
import Toast from '../../components/ui/Toast';
import RevisionHistoryModal from '../../components/modals/RevisionHistoryModal';
import LoadingScreen from '../../components/ui/LoadingScreen';


const SiteFinanceTracker: React.FC = () => {
    const navigate = useNavigate();
    const [records, setRecords] = useState<SiteFinanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [previewData, setPreviewData] = useState<Partial<SiteFinanceRecord>[]>([]);
    const [importedMonth, setImportedMonth] = useState<string>(''); // billing month read from uploaded file
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [siteDefaults, setSiteDefaults] = useState<SiteInvoiceDefault[]>([]);
    const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const exportDropdownRef = React.useRef<HTMLDivElement>(null);
    const { user } = useAuthStore();
    const [revisionModal, setRevisionModal] = useState<{ isOpen: boolean; recordId: string; siteName: string }>({ isOpen: false, recordId: '', siteName: '' });

    // Filter & Pagination State
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({ 
        siteName: '', 
        status: '',
        year: new Date().getFullYear().toString(),
        month: (new Date().getMonth() + 1).toString(),
        startDate: '',
        endDate: ''
    });
    
    // Deletion State
    const [deletedRecords, setDeletedRecords] = useState<SiteFinanceRecord[]>([]);
    const [activeSubTab, setActiveSubTab] = useState<'active' | 'log'>('active');
    const [recordToDelete, setRecordToDelete] = useState<SiteFinanceRecord | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRestoring, setIsRestoring] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const userRole = (user.role || '').toLowerCase();
            const isSuperAdmin = ['admin', 'super_admin', 'finance_manager', 'management', 'hr', 'hr_ops'].includes(userRole);
            const managerId = isSuperAdmin ? undefined : user.id;

            const [recordsData, defaultsData, deletedData] = await Promise.all([
                api.getSiteFinanceRecords(undefined as any, managerId),
                api.getSiteInvoiceDefaults(managerId),
                api.getDeletedSiteFinanceRecords(managerId)
            ]);
            setRecords(recordsData);
            setDeletedRecords(deletedData);
            setSiteDefaults(defaultsData.sort((a, b) => a.siteName.localeCompare(b.siteName)));

            // Auto-cleanup records older than 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const recordsToCleanup = deletedData.filter(r => 
                r.deletedAt && new Date(r.deletedAt) < sevenDaysAgo
            );

            if (recordsToCleanup.length > 0) {
                console.log(`Cleaning up ${recordsToCleanup.length} expired records...`);
                await Promise.all(recordsToCleanup.map(r => api.permanentlyDeleteSiteFinanceRecord(r.id)));
                // Refresh deleted records after cleanup
                const refreshedDeleted = await api.getDeletedSiteFinanceRecords();
                setDeletedRecords(refreshedDeleted);
            }
        } catch (error) {
            console.error('Error fetching finance data:', error);
            setToast({ message: 'Failed to load finance data', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Close export dropdown when clicking outside
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
                setExportDropdownOpen(false);
            }
        };
        if (exportDropdownOpen) document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [exportDropdownOpen]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const handleDownloadTemplate = async () => {
        setIsExporting(true);
        try {
            // Always use the CURRENT calendar month — finance team downloads for the present month
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1; // 1-indexed
            const billingMonthLabel = format(new Date(currentYear, currentMonth - 1, 1), 'MMMM yyyy'); // e.g. "July 2026"
            const billingMonthCode = format(new Date(currentYear, currentMonth - 1, 1), 'yyyy-MM-dd');  // stored in hidden cell

            const workbook = new ExcelJS.Workbook();
            const ws = workbook.addWorksheet('Finance Template');

            // ── Row 1: Metadata / Month header (hidden meta row) ──────────────────
            // Col A = label, Col B = billing month ISO value (read back on import)
            ws.getRow(1).getCell(1).value = 'BILLING_MONTH';
            ws.getRow(1).getCell(2).value = billingMonthCode;
            ws.getRow(1).font = { size: 7, color: { argb: 'FFBFBFBF' } };
            ws.getRow(1).height = 14;

            // ── Row 2: Banner ─────────────────────────────────────────────────────
            ws.mergeCells('A2:F2');
            const bannerCell = ws.getCell('A2');
            bannerCell.value = `📅  PARADIGM SERVICES — Finance Upload Template  |  Month: ${billingMonthLabel}`;
            bannerCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006B3F' } };
            bannerCell.alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(2).height = 22;

            // ── Row 3: Instruction banner ─────────────────────────────────────────
            ws.mergeCells('A3:F3');
            const instrCell = ws.getCell('A3');
            instrCell.value = '⚠️  Fill ONLY the yellow columns (Billed Amount & Billed Fee). Do NOT edit grey pre-filled columns.';
            instrCell.font = { italic: true, size: 9, color: { argb: 'FF7A5800' } };
            instrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
            instrCell.alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(3).height = 18;

            // ── Row 4: Column headers ─────────────────────────────────────────────
            const GREY_FILL  = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9D9D9' } };
            const YELLOW_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFF00' } };
            const GREEN_FILL  = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF006B3F' } };

            const headers = [
                { label: 'Site Name',              key: 'siteName',              width: 32 },
                { label: 'Company Name',            key: 'companyName',            width: 22 },
                { label: 'Contract Amount (₹)',     key: 'contractAmount',         width: 20 },
                { label: 'Contract Mgmt Fee (₹)',   key: 'contractManagementFee',  width: 22 },
                { label: 'Billed Amount (₹) ✏️',   key: 'billedAmount',           width: 20 },
                { label: 'Billed Mgmt Fee (₹) ✏️', key: 'billedManagementFee',    width: 22 },
            ];

            headers.forEach((h, idx) => {
                const col = idx + 1;
                const cell = ws.getRow(4).getCell(col);
                cell.value = h.label;
                cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
                cell.fill = GREEN_FILL;
                cell.alignment = { horizontal: col <= 4 ? 'left' : 'center', vertical: 'middle' };
                cell.border = {
                    bottom: { style: 'medium', color: { argb: 'FF00D27F' } }
                };
                ws.getColumn(col).width = h.width;
            });
            ws.getRow(4).height = 20;

            // ── Data rows ─────────────────────────────────────────────────────────
            // Build merged site list: records (dashboard data) + siteDefaults
            // This ensures sites added via "New Entry" form are also included
            type TemplateSite = { siteName: string; companyName: string; contractAmount: number; contractManagementFee: number };
            const siteMap = new Map<string, TemplateSite>();

            // Start with siteDefaults as base
            siteDefaults.forEach(s => {
                siteMap.set(s.siteName, {
                    siteName: s.siteName,
                    companyName: s.companyName || '',
                    contractAmount: s.contractAmount || 0,
                    contractManagementFee: s.contractManagementFee || 0,
                });
            });

            // Enrich / add from records — records always have the latest contract values
            records.forEach(r => {
                const existing = siteMap.get(r.siteName);
                siteMap.set(r.siteName, {
                    siteName: r.siteName,
                    companyName: r.companyName || existing?.companyName || '',
                    contractAmount: r.contractAmount || existing?.contractAmount || 0,
                    contractManagementFee: r.contractManagementFee || existing?.contractManagementFee || 0,
                });
            });

            const templateSites = Array.from(siteMap.values()).sort((a, b) => a.siteName.localeCompare(b.siteName));

            templateSites.forEach((site, i) => {
                const row = ws.getRow(5 + i);

                // Pre-filled (grey / locked visually) ─ cols 1-4
                const preFilled = [
                    site.siteName,
                    site.companyName || '',
                    site.contractAmount || 0,
                    site.contractManagementFee || 0,
                ];
                preFilled.forEach((val, ci) => {
                    const cell = row.getCell(ci + 1);
                    cell.value = val;
                    cell.fill = GREY_FILL;
                    cell.font = { size: 10, color: { argb: 'FF555555' } };
                    if (ci >= 2) cell.numFmt = '#,##0';
                    cell.protection = { locked: true };
                });

                // Editable (yellow) ─ cols 5-6
                [5, 6].forEach(ci => {
                    const cell = row.getCell(ci);
                    cell.value = null;
                    cell.fill = YELLOW_FILL;
                    cell.font = { size: 10, bold: true };
                    cell.numFmt = '#,##0';
                    cell.protection = { locked: false };
                    cell.border = {
                        top:    { style: 'thin', color: { argb: 'FFCCCC00' } },
                        bottom: { style: 'thin', color: { argb: 'FFCCCC00' } },
                        left:   { style: 'thin', color: { argb: 'FFCCCC00' } },
                        right:  { style: 'thin', color: { argb: 'FFCCCC00' } },
                    };
                });

                row.height = 18;
            });

            // Protect sheet so pre-filled cells cannot be edited
            ws.protect('paradigm_finance', {
                selectLockedCells: true,
                selectUnlockedCells: true,
                formatCells: false,
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Finance_Template_${billingMonthLabel.replace(' ', '_')}.xlsx`);
            setToast({ message: `Template for ${billingMonthLabel} downloaded!`, type: 'success' });
        } catch (error) {
            console.error('Template error:', error);
            setToast({ message: 'Failed to generate template', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);
            const ws = workbook.getWorksheet(1);

            const parsed: Partial<SiteFinanceRecord>[] = [];

            // ── Read billing month from metadata row 1 (embedded by handleDownloadTemplate) ──
            // Row 1, Col A = 'BILLING_MONTH', Col B = 'yyyy-MM-dd'
            let effectiveBillingMonth: string;
            const metaLabel = ws?.getRow(1).getCell(1).value?.toString() || '';
            const metaValue = ws?.getRow(1).getCell(2).value?.toString() || '';

            if (metaLabel === 'BILLING_MONTH' && metaValue) {
                // Template downloaded from the app — use embedded month
                effectiveBillingMonth = metaValue;
            } else {
                // Fallback: use current filter or current month for older/manual templates
                const uploadYearStr = filters.year === 'all' ? new Date().getFullYear().toString() : filters.year;
                const uploadMonthStr = filters.month === 'all' ? (new Date().getMonth() + 1).toString() : filters.month;
                effectiveBillingMonth = format(new Date(Number(uploadYearStr), Number(uploadMonthStr) - 1, 1), 'yyyy-MM-dd');
            }

            const billingMonthDisplay = format(new Date(effectiveBillingMonth), 'MMMM yyyy');

            // ── Parse data rows ─────────────────────────────────────────────────────
            // Our new template: row 1 = meta, row 2 = banner, row 3 = instructions, row 4 = headers, row 5+ = data
            // Legacy template: row 1 = headers, row 2+ = data
            // Detect by checking if row 1 col A is 'BILLING_MONTH'
            const dataStartRow = metaLabel === 'BILLING_MONTH' ? 5 : 2;

            ws?.eachRow((row, rowNumber) => {
                if (rowNumber < dataStartRow) return;

                const siteName = row.getCell(1).value?.toString().trim() || '';
                if (!siteName || siteName === 'Site Name') return; // skip header rows

                const siteDef = siteDefaults.find(s => s.siteName === siteName);

                const isValidUUID = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
                const validatedSiteId = siteDef?.siteId && isValidUUID(siteDef.siteId) ? siteDef.siteId : undefined;

                const bAmount = Number(row.getCell(5).value) || 0;
                const bFee    = Number(row.getCell(6).value) || 0;

                parsed.push({
                    siteId: validatedSiteId,
                    siteName,
                    companyName: row.getCell(2).value?.toString() || '',
                    contractAmount: Number(row.getCell(3).value) || 0,
                    contractManagementFee: Number(row.getCell(4).value) || 0,
                    billedAmount: bAmount,
                    billedManagementFee: bFee,
                    billingMonth: effectiveBillingMonth,
                    totalBilledAmount: bAmount + bFee,
                    status: 'pending'
                });
            });

            if (parsed.length === 0) {
                setToast({ message: 'No valid records found in file', type: 'error' });
            } else {
                setImportedMonth(billingMonthDisplay);
                setPreviewData(parsed);
                setToast({ message: `${parsed.length} records parsed for ${billingMonthDisplay}`, type: 'success' });
            }
        } catch (error) {
            console.error('Import error:', error);
            setToast({ message: 'Failed to process Excel file', type: 'error' });
        }
        if (e.target) e.target.value = '';
    };

    const handleConfirmImport = async () => {
        setIsImporting(true);
        try {
            // Inject creator info into preview data
            const enrichedPreviewData = previewData.map(record => ({
                ...record,
                createdBy: user?.id,
                createdByName: user?.name,
                createdByRole: user?.role
            }));

            // First save the monthly records
            await api.bulkSaveSiteFinanceRecords(enrichedPreviewData);
            
            // Then sync the contract details to defaults for future use
            const defaultsToUpdate: Partial<SiteInvoiceDefault>[] = enrichedPreviewData
                .filter(r => !!r.siteId) // Only update sites we know
                .map(r => ({
                    siteId: r.siteId,
                    siteName: r.siteName,
                    companyName: r.companyName,
                    contractAmount: r.contractAmount,
                    contractManagementFee: r.contractManagementFee
                }));
            
            if (defaultsToUpdate.length > 0) {
                await api.bulkSaveSiteInvoiceDefaults(defaultsToUpdate);
            }

            setToast({ message: 'Records imported and defaults synced successfully!', type: 'success' });
            setPreviewData([]);
            fetchData();
        } catch (error) {
            console.error('Bulk save error:', error);
            setToast({ message: 'Failed to save imported records', type: 'error' });
        } finally {
            setIsImporting(false);
        }
    };

    // ── Shared helper: apply header styling to a worksheet row ─────────────────
    const applySheetHeader = (ws: ExcelJS.Worksheet, label: string) => {
        ws.mergeCells('A1:J1');
        const banner = ws.getCell('A1');
        banner.value = label;
        banner.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006B3F' } };
        banner.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 22;

        const cols = [
            { header: 'Site Name',          key: 'siteName',              width: 30 },
            { header: 'Contract Amt (₹)',    key: 'contractAmount',         width: 18 },
            { header: 'Contract Fee (₹)',    key: 'contractManagementFee',  width: 18 },
            { header: 'Billed Amt (₹)',      key: 'billedAmount',           width: 18 },
            { header: 'Billed Fee (₹)',      key: 'billedManagementFee',    width: 18 },
            { header: 'Total Billed (₹)',    key: 'totalBilledAmount',      width: 18 },
            { header: 'Billing Diff (₹)',    key: 'billingVar',             width: 18 },
            { header: 'Fee Diff (₹)',        key: 'feeVar',                 width: 16 },
            { header: 'Net Variation (₹)',   key: 'netVar',                 width: 18 },
            { header: 'Status',             key: 'status',                 width: 12 },
        ];
        ws.columns = cols;
        const headerRow = ws.getRow(2);
        cols.forEach((c, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = c.header;
            cell.font  = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004D2E' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        headerRow.height = 18;
    };

    // ── Shared helper: write one data row to a worksheet ────────────────────────
    const writeDataRow = (ws: ExcelJS.Worksheet, r: SiteFinanceRecord, rowIdx: number) => {
        const bVar = (r.billedAmount || 0) - (r.contractAmount || 0);
        const fVar = (r.billedManagementFee || 0) - (r.contractManagementFee || 0);
        const netVar = bVar + fVar;
        const isEven = rowIdx % 2 === 0;
        const row = ws.addRow({
            siteName: r.siteName,
            contractAmount: r.contractAmount || 0,
            contractManagementFee: r.contractManagementFee || 0,
            billedAmount: r.billedAmount || 0,
            billedManagementFee: r.billedManagementFee || 0,
            totalBilledAmount: r.totalBilledAmount || 0,
            billingVar: bVar,
            feeVar: fVar,
            netVar,
            status: netVar >= 0 ? 'Profit' : 'Loss',
        });
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF5FFF9' : 'FFFFFFFF' } };
        // Color net variation
        const netCell = row.getCell(9);
        netCell.font = { bold: true, color: { argb: netVar >= 0 ? 'FF006B3F' : 'FFCC0000' } };
        const statusCell = row.getCell(10);
        statusCell.font = { bold: true, color: { argb: netVar >= 0 ? 'FF006B3F' : 'FFCC0000' } };
        // Number format for money cols
        [2,3,4,5,6,7,8,9].forEach(ci => { row.getCell(ci).numFmt = '#,##0'; });
        row.height = 17;
    };

    // ── Export: Current Month/Filter ────────────────────────────────────────────
    const handleExportCurrentMonth = async () => {
        setIsExporting(true);
        setExportDropdownOpen(false);
        try {
            const workbook = new ExcelJS.Workbook();
            const exportYear = filters.year === 'all' ? new Date().getFullYear().toString() : filters.year;
            const exportMonth = filters.month === 'all' ? (new Date().getMonth() + 1).toString() : filters.month;
            const exportDate = format(new Date(Number(exportYear), Number(exportMonth) - 1, 1), 'MMMM yyyy');

            const ws = workbook.addWorksheet(exportDate);
            applySheetHeader(ws, `Paradigm Services — Finance Report  |  ${exportDate}`);

            records.forEach((r, i) => writeDataRow(ws, r, i));

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Finance_Export_${exportDate.replace(' ', '_')}.xlsx`);
            setToast({ message: `Exported ${records.length} records for ${exportDate}`, type: 'success' });
        } catch (error) {
            console.error('Export error:', error);
            setToast({ message: 'Failed to export data', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    // ── Export: Full Year — one sheet per month ─────────────────────────────────
    const handleExportFullYear = async () => {
        setIsExporting(true);
        setExportDropdownOpen(false);
        try {
            const exportYear = filters.year === 'all' ? new Date().getFullYear() : Number(filters.year);
            const currentMonth = new Date().getFullYear() === exportYear ? new Date().getMonth() + 1 : 12;

            // Fetch ALL records for the year (not filtered by month)
            const userRole = (user?.role || '').toLowerCase();
            const isSuperAdmin = ['admin', 'super_admin', 'finance_manager', 'management', 'hr', 'hr_ops'].includes(userRole);
            const managerId = isSuperAdmin ? undefined : user?.id;
            const allRecords = await api.getSiteFinanceRecords(undefined as any, managerId);
            const yearRecords = allRecords.filter(r => {
                const d = r.billingMonth || r.createdAt || '';
                return d.startsWith(exportYear.toString());
            });

            const workbook = new ExcelJS.Workbook();

            // ── Summary sheet (first) ────────────────────────────────────────────
            const summaryWs = workbook.addWorksheet('📊 Annual Summary');
            summaryWs.mergeCells('A1:H1');
            const summaryBanner = summaryWs.getCell('A1');
            summaryBanner.value = `Paradigm Services — Annual Finance Summary  |  ${exportYear}`;
            summaryBanner.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            summaryBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006B3F' } };
            summaryBanner.alignment = { horizontal: 'center', vertical: 'middle' };
            summaryWs.getRow(1).height = 26;

            const summaryHeaders = ['Month', 'Sites', 'Total Contract (₹)', 'Total Billed (₹)', 'Net Variation (₹)', 'Profit Sites', 'Loss Sites', 'Status'];
            const summaryHeaderRow = summaryWs.getRow(2);
            summaryHeaders.forEach((h, i) => {
                const cell = summaryHeaderRow.getCell(i + 1);
                cell.value = h;
                cell.font  = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
                cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004D2E' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            summaryWs.getRow(2).height = 18;
            summaryWs.columns = [
                { width: 14 }, { width: 8 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 14 }, { width: 12 }, { width: 12 }
            ];

            let summaryRowIdx = 3;

            // ── Monthly sheets ───────────────────────────────────────────────────
            for (let m = 1; m <= currentMonth; m++) {
                const monthLabel = format(new Date(exportYear, m - 1, 1), 'MMMM');
                const monthCode  = format(new Date(exportYear, m - 1, 1), 'yyyy-MM');

                const monthRecords = yearRecords.filter(r => {
                    const d = r.billingMonth || r.createdAt || '';
                    return d.startsWith(monthCode);
                });

                const ws = workbook.addWorksheet(monthLabel);
                applySheetHeader(ws, `Paradigm Services — Finance Report  |  ${monthLabel} ${exportYear}`);

                if (monthRecords.length === 0) {
                    ws.getRow(3).getCell(1).value = 'No records for this month';
                    ws.getRow(3).getCell(1).font = { italic: true, color: { argb: 'FF999999' } };
                } else {
                    monthRecords.forEach((r, i) => writeDataRow(ws, r, i));
                }

                // Add to summary
                const totalContract = monthRecords.reduce((s, r) => s + (r.contractAmount || 0) + (r.contractManagementFee || 0), 0);
                const totalBilled   = monthRecords.reduce((s, r) => s + (r.totalBilledAmount || 0), 0);
                const netVar = totalBilled - totalContract;
                const profitSites = monthRecords.filter(r => ((r.billedAmount||0)+(r.billedManagementFee||0)) - ((r.contractAmount||0)+(r.contractManagementFee||0)) >= 0).length;

                const sumRow = summaryWs.getRow(summaryRowIdx++);
                const isEven = (summaryRowIdx % 2 === 0);
                sumRow.values = [monthLabel, monthRecords.length, totalContract, totalBilled, netVar, profitSites, monthRecords.length - profitSites, netVar >= 0 ? 'Profit' : 'Loss'];
                sumRow.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF5FFF9' : 'FFFFFFFF' } };
                sumRow.getCell(5).font = { bold: true, color: { argb: netVar >= 0 ? 'FF006B3F' : 'FFCC0000' } };
                sumRow.getCell(8).font = { bold: true, color: { argb: netVar >= 0 ? 'FF006B3F' : 'FFCC0000' } };
                [3,4,5].forEach(ci => { sumRow.getCell(ci).numFmt = '#,##0'; });
                sumRow.height = 17;
            }

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Finance_Annual_Report_${exportYear}.xlsx`);
            setToast({ message: `Full year ${exportYear} exported — ${currentMonth} month sheets created`, type: 'success' });
        } catch (error) {
            console.error('Full year export error:', error);
            setToast({ message: 'Failed to export full year data', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    // ── Export: Current filter data as uploadable template ──────────────────────
    const handleExportAsTemplate = async () => {
        setIsExporting(true);
        setExportDropdownOpen(false);
        try {
            const exportYear = filters.year === 'all' ? new Date().getFullYear() : Number(filters.year);
            const exportMonth = filters.month === 'all' ? new Date().getMonth() + 1 : Number(filters.month);
            const monthLabel = format(new Date(exportYear, exportMonth - 1, 1), 'MMMM yyyy');
            const billingMonthCode = format(new Date(exportYear, exportMonth - 1, 1), 'yyyy-MM-dd');

            const workbook = new ExcelJS.Workbook();
            const ws = workbook.addWorksheet('Finance Template');

            // ── Metadata row (same format as handleDownloadTemplate) ──────────────
            ws.getRow(1).getCell(1).value = 'BILLING_MONTH';
            ws.getRow(1).getCell(2).value = billingMonthCode;
            ws.getRow(1).font = { size: 7, color: { argb: 'FFBFBFBF' } };
            ws.getRow(1).height = 14;

            ws.mergeCells('A2:F2');
            const bannerCell = ws.getCell('A2');
            bannerCell.value = `📅  PARADIGM SERVICES — Re-Upload Template  |  Month: ${monthLabel}  (Exported for correction)`;
            bannerCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004488' } };
            bannerCell.alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(2).height = 22;

            ws.mergeCells('A3:F3');
            const instrCell = ws.getCell('A3');
            instrCell.value = '✏️  Correct the yellow columns (Billed Amount & Billed Fee) then re-import this file.';
            instrCell.font = { italic: true, size: 9, color: { argb: 'FF003366' } };
            instrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
            instrCell.alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(3).height = 18;

            const GREY_FILL   = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9D9D9' } };
            const YELLOW_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFF00' } };
            const GREEN_FILL  = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF006B3F' } };

            const headerLabels = ['Site Name', 'Company Name', 'Contract Amount (₹)', 'Contract Mgmt Fee (₹)', 'Billed Amount (₹) ✏️', 'Billed Mgmt Fee (₹) ✏️'];
            const colWidths = [32, 22, 20, 22, 20, 22];
            headerLabels.forEach((label, idx) => {
                const cell = ws.getRow(4).getCell(idx + 1);
                cell.value = label;
                cell.font  = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
                cell.fill  = GREEN_FILL;
                ws.getColumn(idx + 1).width = colWidths[idx];
            });
            ws.getRow(4).height = 20;

            records.forEach((r, i) => {
                const row = ws.getRow(5 + i);
                [r.siteName, r.companyName || '', r.contractAmount || 0, r.contractManagementFee || 0].forEach((val, ci) => {
                    const cell = row.getCell(ci + 1);
                    cell.value = val;
                    cell.fill  = GREY_FILL;
                    if (ci >= 2) cell.numFmt = '#,##0';
                });
                [5, 6].forEach((ci, offset) => {
                    const cell = row.getCell(ci);
                    cell.value = offset === 0 ? (r.billedAmount || 0) : (r.billedManagementFee || 0);
                    cell.fill  = YELLOW_FILL;
                    cell.font  = { bold: true };
                    cell.numFmt = '#,##0';
                });
                row.height = 18;
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Finance_Reupload_${monthLabel.replace(' ', '_')}.xlsx`);
            setToast({ message: `Re-upload template for ${monthLabel} exported`, type: 'success' });
        } catch (error) {
            console.error('Export as template error:', error);
            setToast({ message: 'Failed to export as template', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleDelete = async (reason: string) => {
        if (isBulkDeleting) {
            await handleBulkDelete(reason);
            return;
        }
        if (!recordToDelete || !user) return;
        
        setIsDeleting(true);
        try {
            await api.deleteSiteFinanceRecord(
                recordToDelete.id, 
                reason, 
                user.id, 
                user.name || 'Admin'
            );
            setToast({ message: 'Record moved to Deletion Log', type: 'success' });
            setRecordToDelete(null);
            setDeleteReason('');
            setShowDeleteModal(false);
            fetchData();
        } catch (error) {
            console.error('Delete error:', error);
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
            await api.bulkSoftDeleteSiteFinanceRecords(
                ids,
                reason,
                user.id,
                user.name || 'Admin'
            );
            setToast({ message: `${selectedIds.size} records moved to Deletion Log`, type: 'success' });
            setSelectedIds(new Set());
            setDeleteReason('');
            setIsBulkDeleting(false);
            setShowDeleteModal(false);
            fetchData();
        } catch (error) {
            console.error('Bulk delete error:', error);
            setToast({ message: 'Failed to delete selected records', type: 'error' });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRestoreRecord = async (id: string) => {
        setIsRestoring(id);
        try {
            await api.restoreSiteFinanceRecord(id);
            setToast({ message: 'Record restored successfully', type: 'success' });
            fetchData();
        } catch (error) {
            console.error('Restore error:', error);
            setToast({ message: 'Failed to restore record', type: 'error' });
        } finally {
            setIsRestoring(null);
        }
    };

    const handlePermanentDelete = async (id: string) => {
        if (!confirm('Are you sure you want to permanently delete this record? This cannot be undone.')) return;
        try {
            await api.permanentlyDeleteSiteFinanceRecord(id);
            setToast({ message: 'Record permanently deleted', type: 'success' });
            fetchData();
        } catch (error) {
            console.error('Permanent delete error:', error);
            setToast({ message: 'Failed to delete record permanently', type: 'error' });
        }
    };

    const isAdmin = ['admin', 'super_admin', 'management', 'hr'].includes(user?.role || '');

    const handleBulkRestore = async () => {
        if (selectedIds.size === 0 || !isAdmin) return;
        setIsRestoring('bulk');
        try {
            const ids = Array.from(selectedIds);
            await api.bulkRestoreSiteFinanceRecords(ids);
            setToast({ message: `${selectedIds.size} records restored successfully`, type: 'success' });
            setSelectedIds(new Set());
            fetchData();
        } catch (error) {
            console.error('Bulk restore error:', error);
            setToast({ message: 'Failed to restore records', type: 'error' });
        } finally {
            setIsRestoring(null);
        }
    };

    const handleBulkPermanentDelete = async () => {
        if (selectedIds.size === 0 || !isAdmin) return;
        if (!confirm(`Are you sure you want to permanently delete these ${selectedIds.size} records? This action cannot be undone.`)) return;

        try {
            const ids = Array.from(selectedIds);
            await api.bulkPermanentlyDeleteSiteFinanceRecords(ids);
            setToast({ message: `${selectedIds.size} records permanently deleted`, type: 'success' });
            setSelectedIds(new Set());
            fetchData();
        } catch (error) {
            console.error('Bulk permanent delete error:', error);
            setToast({ message: 'Failed to delete records permanently', type: 'error' });
        }
    };

    // Calculate variations for stats
    let totalBillingVariation = 0;
    let totalFeeVariation = 0;
    let profitSitesCount = 0;

    records.forEach(r => {
        const bDiff = (r.billedAmount || 0) - (r.contractAmount || 0);
        const fDiff = (r.billedManagementFee || 0) - (r.contractManagementFee || 0);
        totalBillingVariation += bDiff;
        totalFeeVariation += fDiff;
        if (bDiff + fDiff >= 0) profitSitesCount++;
    });

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(15);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const currentRecords = activeSubTab === 'active' ? records : deletedRecords;

    const filteredRecords = currentRecords.filter(r => {
        const matchesSearch = r.siteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.companyName || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesSiteName = !filters.siteName || 
            r.siteName.toLowerCase().includes(filters.siteName.toLowerCase());
            
        const matchesStatus = filters.status === '' || (() => {
            const variations = ((r.billedAmount || 0) + (r.billedManagementFee || 0)) - ((r.contractAmount || 0) + (r.contractManagementFee || 0));
            const isProfit = variations >= 0;
            return filters.status === 'profit' ? isProfit : !isProfit;
        })();

        let matchesYear = true;
        let matchesMonth = true;
        let matchesCustomRange = true;

        const recordDateStr = r.billingMonth || r.createdAt;
        if (recordDateStr) {
            const recordDate = parseISO(recordDateStr);
            if (filters.year !== 'all') {
                matchesYear = format(recordDate, 'yyyy') === filters.year;
            }
            if (filters.month !== 'all') {
                const recordMonth = format(recordDate, 'M');
                matchesMonth = recordMonth === filters.month;
            }
            
            if (filters.startDate && filters.endDate) {
                const dateOnly = startOfDay(recordDate);
                matchesCustomRange = (dateOnly >= startOfDay(parseISO(filters.startDate)) && dateOnly <= startOfDay(parseISO(filters.endDate)));
            }
        }

        return matchesSearch && matchesSiteName && matchesStatus && matchesYear && matchesMonth && matchesCustomRange;
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

    const siteOptions = useMemo(() => {
        const sites = new Set(records.map(r => r.siteName));
        siteDefaults.forEach(s => sites.add(s.siteName));
        return Array.from(sites).sort();
    }, [records, siteDefaults]);

    const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    // Reset page when search, filters or tab changes
    useEffect(() => { 
        setCurrentPage(1); 
    }, [searchQuery, filters, activeSubTab]);

    // Clear column filters and selection when switching sub-tabs
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
                            <option value="profit">Profit</option>
                            <option value="loss">Loss</option>
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
                        onClick={() => navigate('/finance/site-tracker/add')}
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

                        {/* Export Dropdown */}
                        <div className="relative" ref={exportDropdownRef}>
                            <button
                                onClick={() => setExportDropdownOpen(v => !v)}
                                disabled={isExporting}
                                className="whitespace-nowrap h-11 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-blue-400 md:text-blue-700 bg-blue-500/10 md:bg-blue-50 border border-blue-500/20 md:border-blue-100 rounded-lg hover:bg-blue-500/20 md:hover:bg-blue-100 transition-all disabled:opacity-50"
                            >
                                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                                <span>Export Data</span>
                                <svg className={`h-3 w-3 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {exportDropdownOpen && (
                                <div className="absolute right-0 top-12 z-50 w-64 bg-white md:bg-white dark:bg-[#06251c] rounded-xl shadow-2xl border border-gray-200 md:border-gray-200 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                    {/* Option 1 — Current Month */}
                                    <button
                                        onClick={handleExportCurrentMonth}
                                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors text-left border-b border-gray-100 dark:border-white/5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-800 dark:text-white">Export Current View</p>
                                            <p className="text-[10px] text-gray-500 dark:text-emerald-400/40 mt-0.5">Current filter — single sheet</p>
                                        </div>
                                    </button>
                                    {/* Option 2 — Full Year */}
                                    <button
                                        onClick={handleExportFullYear}
                                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors text-left border-b border-gray-100 dark:border-white/5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-800 dark:text-white">Full Year Export</p>
                                            <p className="text-[10px] text-gray-500 dark:text-emerald-400/40 mt-0.5">Jan → current month, one sheet each + summary</p>
                                        </div>
                                    </button>
                                    {/* Option 3 — Re-upload template */}
                                    <button
                                        onClick={handleExportAsTemplate}
                                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <Upload className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-800 dark:text-white">Export as Re-upload Template</p>
                                            <p className="text-[10px] text-gray-500 dark:text-emerald-400/40 mt-0.5">Editable yellow columns — import back after corrections</p>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── KPI Summary Cards ── */}
            {!isLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Variation */}
                    <div className={`rounded-xl border p-4 md:p-5 transition-all duration-150 shadow-sm ${totalBillingVariation >= 0 ? 'bg-emerald-500/10 md:bg-white border-emerald-500/20 md:border-emerald-100' : 'bg-rose-500/10 md:bg-white border-rose-500/20 md:border-rose-100'}`}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] md:text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Turnover variations</p>
                                <h3 className={`text-lg md:text-xl font-bold mt-1.5 ${totalBillingVariation >= 0 ? 'text-emerald-400 md:text-emerald-600' : 'text-rose-400 md:text-rose-600'}`}>{formatCurrency(totalBillingVariation)}</h3>
                                <p className={`text-[9px] md:text-[10px] font-medium mt-1 ${totalBillingVariation >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                                    {totalBillingVariation >= 0 ? '↑' : '↓'} Billing difference
                                </p>
                            </div>
                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center ${totalBillingVariation >= 0 ? 'bg-emerald-500/20 md:bg-emerald-50' : 'bg-rose-500/20 md:bg-rose-50'}`}>
                                <IndianRupee className={`h-4 w-4 md:h-5 md:w-5 ${totalBillingVariation >= 0 ? 'text-emerald-400 md:text-emerald-600' : 'text-rose-400 md:text-rose-600'}`} />
                            </div>
                        </div>
                    </div>

                    {/* Fee Variation */}
                    <div className={`rounded-xl border p-4 md:p-5 transition-all duration-150 shadow-sm ${totalFeeVariation >= 0 ? 'bg-emerald-500/10 md:bg-white border-emerald-500/20 md:border-emerald-100' : 'bg-rose-500/10 md:bg-white border-rose-500/20 md:border-rose-100'}`}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] md:text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Management fee variations</p>
                                <h3 className={`text-lg md:text-xl font-bold mt-1.5 ${totalFeeVariation >= 0 ? 'text-emerald-400 md:text-emerald-600' : 'text-rose-400 md:text-rose-600'}`}>{formatCurrency(totalFeeVariation)}</h3>
                                <p className={`text-[9px] md:text-[10px] font-medium mt-1 ${totalFeeVariation >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                                    {totalFeeVariation >= 0 ? '↑' : '↓'} Fee difference
                                </p>
                            </div>
                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center ${totalFeeVariation >= 0 ? 'bg-emerald-500/20 md:bg-emerald-50' : 'bg-rose-500/20 md:bg-rose-50'}`}>
                                {totalFeeVariation >= 0 ? <TrendingUp className={`h-4 w-4 md:h-5 md:w-5 ${totalFeeVariation >= 0 ? 'text-emerald-400 md:text-emerald-600' : 'text-rose-400 md:text-rose-600'}`} /> : <TrendingDown className={`h-4 w-4 md:h-5 md:w-5 ${totalFeeVariation >= 0 ? 'text-emerald-400 md:text-emerald-600' : 'text-rose-400 md:text-rose-600'}`} />}
                            </div>
                        </div>
                    </div>

                    {/* Profit Sites */}
                    <div className="bg-[#06251c] md:bg-white rounded-xl border border-white/5 md:border-gray-100 p-4 md:p-5 transition-all duration-150 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] md:text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Profit Sites</p>
                                <h3 className="text-lg md:text-xl font-bold text-white md:text-gray-900 mt-1.5">{profitSitesCount} <span className="text-xs md:text-sm font-normal text-emerald-700">/ {records.length}</span></h3>
                                <p className="text-[9px] md:text-[10px] font-medium text-emerald-400 md:text-emerald-600/80 mt-1">
                                    {records.length > 0 ? Math.round((profitSitesCount / records.length) * 100) : 0}% profitable
                                </p>
                            </div>
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-emerald-500/10 md:bg-emerald-50 flex items-center justify-center border border-emerald-500/20 md:border-emerald-100">
                                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-emerald-400 md:text-emerald-600" />
                            </div>
                        </div>
                    </div>

                    {/* Total Records */}
                    <div className="bg-[#06251c] md:bg-white rounded-xl border border-white/5 md:border-gray-100 p-4 md:p-5 transition-all duration-150 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] md:text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Total Records</p>
                                <h3 className="text-lg md:text-xl font-bold text-white md:text-gray-900 mt-1.5">{records.length}</h3>
                                <p className="text-[9px] md:text-[10px] font-medium text-emerald-400/50 md:text-gray-400 mt-1">
                                    For {(filters.year === 'all' || filters.month === 'all') 
                                        ? 'All Periods' 
                                        : format(new Date(Number(filters.year), Number(filters.month) - 1, 1), 'MMM yyyy')}
                                </p>
                            </div>
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white/5 md:bg-gray-50 flex items-center justify-center border border-white/10 md:border-gray-100">
                                <Building2 className="h-4 w-4 md:h-5 md:w-5 text-emerald-400/70 md:text-gray-400" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Records Table ── */}
            <div className="bg-[#041b0f] md:bg-white rounded-2xl border border-white/5 md:border-gray-200 shadow-2xl md:shadow-sm overflow-hidden pb-4">
                {/* Sub-Tabs & Search Bar */}
                <div className="px-6 py-4 border-b border-white/5 md:border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#06251c]/50 md:bg-gray-50/50">
                    <div className="flex items-center p-1.5 bg-[#041b0f] md:bg-gray-100/50 rounded-xl self-start border border-white/5 md:border-gray-200">
                        <button
                            onClick={() => setActiveSubTab('active')}
                            className={`px-5 py-1.5 text-xs font-black rounded-lg transition-all uppercase tracking-widest ${activeSubTab === 'active' ? 'bg-[#00D27F] md:bg-white text-[#041b0f] md:text-emerald-700 shadow-lg md:shadow-sm shadow-emerald-500/20' : 'text-emerald-400/40 md:text-gray-500 hover:text-emerald-400 md:hover:text-gray-700'}`}
                        >
                            Active Records
                        </button>
                        <button
                            onClick={() => setActiveSubTab('log')}
                            className={`px-5 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-2 uppercase tracking-widest ${activeSubTab === 'log' ? 'bg-[#00D27F] md:bg-white text-[#041b0f] md:text-emerald-700 shadow-lg md:shadow-sm shadow-emerald-500/20' : 'text-emerald-400/40 md:text-gray-500 hover:text-emerald-400 md:hover:text-gray-700'}`}
                        >
                            Deletion Log
                            {deletedRecords.length > 0 && (
                                <span className={`flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black ${activeSubTab === 'log' ? 'bg-[#041b0f]/50 md:bg-gray-100' : 'bg-[#06251c] md:bg-gray-200 text-emerald-400 md:text-gray-600'}`}>
                                    {deletedRecords.length}
                                </span>
                            )}
                        </button>
                    </div>


                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="relative">
                            <Loader2 className="h-10 w-10 animate-spin text-[#00D27F]" />
                            <div className="absolute inset-0 blur-lg bg-[#00D27F]/20 animate-pulse" />
                        </div>
                        <span className="text-xs text-emerald-400/40 font-black uppercase tracking-[0.2em]">Synchronizing Data...</span>
                    </div>
                ) : currentRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <div className="w-20 h-20 bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-6 border border-white/5 rotate-3">
                            <ClipboardCheck className="h-8 w-8 text-emerald-500/20" />
                        </div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">
                            {activeSubTab === 'active' ? 'No Records Found' : 'Log is Empty'}
                        </h3>
                        <p className="text-xs text-emerald-400/40 mt-2 max-w-[240px] font-bold uppercase tracking-tight leading-relaxed">
                            {activeSubTab === 'active' 
                                ? 'No finance entries for this period yet.' 
                                : 'No deletions recorded in the trailing 7 days.'}
                        </p>
                        {activeSubTab === 'active' && (
                            <button
                                onClick={() => navigate('/finance/site-tracker/add')}
                                className="mt-8 inline-flex items-center gap-2 px-6 py-3 text-xs font-black text-[#041b0f] bg-[#00D27F] rounded-xl hover:bg-[#00b86e] transition-all shadow-xl shadow-emerald-500/20 uppercase tracking-widest"
                            >
                                <Plus className="h-4 w-4" />
                                Add First Record
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
                                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Client Name</th>
                                        {activeSubTab === 'active' ? (
                                            <>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider whitespace-nowrap">Contract Value</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider whitespace-nowrap">Billed Value</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider whitespace-nowrap">Billing Diff</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider hidden md:table-cell whitespace-nowrap">Mgmt Fee</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider hidden md:table-cell whitespace-nowrap">Billed Fee</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider hidden md:table-cell whitespace-nowrap">Fee Diff</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider whitespace-nowrap font-black">Net Variation</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                                                <th className="px-4 py-3 text-center text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider hidden lg:table-cell whitespace-nowrap">Date</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Deleted By</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Reason</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Deleted At</th>
                                                <th className="px-4 py-3 text-right text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider">Expires In</th>
                                            </>
                                        )}
                                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-emerald-400/60 md:text-gray-500 uppercase tracking-wider w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {paginatedRecords.map(record => {
                                        const bDiff = (record.billedAmount || 0) - (record.contractAmount || 0);
                                        const fDiff = (record.billedManagementFee || 0) - (record.contractManagementFee || 0);
                                        const isProfit = bDiff + fDiff >= 0;
                                        const isSelected = selectedIds.has(record.id);
                                        
                                        // Calculate expiry for log
                                        let daysRemaining = 0;
                                        if (record.deletedAt) {
                                            const expiryDate = new Date(record.deletedAt);
                                            expiryDate.setDate(expiryDate.getDate() + 7);
                                            const diff = expiryDate.getTime() - new Date().getTime();
                                            daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                                        }

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
                                                    <div className="text-[10px] text-emerald-400/30 md:text-gray-500 mt-1 font-bold uppercase tracking-wider">{record.companyName || '—'}</div>
                                                    
                                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                        {activeSubTab === 'log' && record.billingMonth && (
                                                            <div className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 md:bg-emerald-50 border border-emerald-500/20 md:border-emerald-100 text-[#00D27F] md:text-emerald-700 font-black uppercase tracking-tighter">
                                                                For {format(parseISO(record.billingMonth), 'MMM yyyy')}
                                                            </div>
                                                        )}
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

                                                {activeSubTab === 'active' ? (
                                                    <>
                                                        <td className="px-4 py-3.5 text-center font-mono text-xs text-emerald-400/40 md:text-gray-400">{formatCurrency(record.contractAmount)}</td>
                                                        <td className="px-4 py-3.5 text-center font-mono text-xs font-black text-white md:text-gray-900">{formatCurrency(record.billedAmount)}</td>
                                                        <td className={`px-4 py-3.5 text-center font-mono text-xs font-black ${bDiff >= 0 ? 'text-[#00D27F] md:text-emerald-600' : 'text-rose-400 md:text-rose-600'}`}>
                                                            {bDiff >= 0 ? '+' : ''}{formatCurrency(bDiff)}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center font-mono text-xs text-emerald-400/40 md:text-gray-400 hidden md:table-cell">{formatCurrency(record.contractManagementFee)}</td>
                                                        <td className="px-4 py-3.5 text-center font-mono text-xs font-black text-white md:text-gray-900 hidden md:table-cell">{formatCurrency(record.billedManagementFee)}</td>
                                                        <td className={`px-4 py-3.5 text-center font-mono text-xs font-black hidden md:table-cell ${fDiff >= 0 ? 'text-[#00D27F] md:text-emerald-600' : 'text-rose-400 md:text-rose-600'}`}>
                                                            {fDiff >= 0 ? '+' : ''}{formatCurrency(fDiff)}
                                                        </td>
                                                        <td className={`px-4 py-3.5 text-center font-mono text-sm font-black ${isProfit ? 'text-[#00D27F] md:text-emerald-600' : 'text-rose-400 md:text-rose-600'}`}>
                                                            {isProfit ? '+' : ''}{formatCurrency(bDiff + fDiff)}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${isProfit ? 'bg-emerald-500/10 md:bg-emerald-50 text-[#00D27F] md:text-emerald-700' : 'bg-rose-500/10 md:bg-rose-50 text-rose-400 md:text-rose-700'}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${isProfit ? 'bg-[#00D27F]' : 'bg-rose-400'}`} />
                                                                {isProfit ? 'Profit' : 'Loss'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 hidden lg:table-cell text-center">
                                                            <div className="flex flex-col gap-0.5 items-center">
                                                                {(record.createdByName || record.createdByRole) && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        {record.createdByName && (
                                                                            <span className="text-[10px] font-black text-white md:text-gray-900 uppercase tracking-tighter">{record.createdByName.split(' ')[0]}</span>
                                                                        )}
                                                                        {record.createdByRole && (
                                                                            <span className="text-[8px] px-1.5 py-0.5 bg-white/5 md:bg-gray-100 text-emerald-400/40 md:text-gray-500 rounded-md font-black uppercase tracking-widest border border-white/5 md:border-gray-200">
                                                                                {record.createdByRole.replace('_', ' ')}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {record.createdAt && <div className="text-[9px] font-bold text-emerald-400/20 md:text-gray-400 uppercase tracking-widest">{format(new Date(record.createdAt), 'MMM d, h:mm a')}</div>}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center">
                                                            <div className="flex items-center justify-center gap-1 transition-all duration-200">
                                                                <button onClick={() => navigate(`/finance/site-tracker/edit/${record.id}`)} className="p-2 text-emerald-500 md:text-gray-500 hover:text-[#00D27F] md:hover:text-emerald-600 hover:bg-white/5 md:hover:bg-gray-100 rounded-xl transition-all border border-white/5 md:border-gray-100 shadow-sm" title="Edit">
                                                                    <Edit2 className="h-4 w-4" />
                                                                </button>
                                                                <button onClick={() => { setRecordToDelete(record); setIsBulkDeleting(false); setShowDeleteModal(true); }} className="p-2 text-rose-500 md:text-gray-500 hover:text-rose-400 md:hover:text-rose-600 hover:bg-rose-500/10 md:hover:bg-rose-50 rounded-xl transition-all border border-white/5 md:border-gray-100 shadow-sm" title="Delete">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-4 py-3.5 text-sm font-bold text-white md:text-gray-900">{record.deletedByName || '—'}</td>
                                                        <td className="px-4 py-3.5 text-[11px] text-emerald-400/60 md:text-gray-600 font-medium max-w-[200px] truncate italic" title={record.deletedReason}>"{record.deletedReason || 'No reason'}"</td>
                                                        <td className="px-4 py-3.5 text-[11px] text-emerald-400/40 md:text-gray-500 font-bold uppercase tracking-tighter">
                                                            {record.deletedAt && format(new Date(record.deletedAt), 'MMM d, h:mm a')}
                                                        </td>
                                                        <td className={`px-4 py-3.5 text-right text-[11px] font-black uppercase tracking-widest ${daysRemaining <= 2 ? 'text-rose-400 animate-pulse' : 'text-emerald-400/60'}`}>
                                                            {daysRemaining}d Left
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right">
                                                            {user?.role === 'admin' ? (
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <button 
                                                                        onClick={() => handleRestoreRecord(record.id)} 
                                                                        disabled={isRestoring === record.id}
                                                                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter text-[#041b0f] md:text-white bg-[#00D27F] md:bg-emerald-600 rounded-lg hover:bg-[#00b86e] md:hover:bg-emerald-700 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-lg md:shadow-none shadow-emerald-500/10"
                                                                    >
                                                                        {isRestoring === record.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
                                                                        Restore
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handlePermanentDelete(record.id)} 
                                                                        className="p-1.5 text-emerald-400/20 hover:text-rose-400 transition-colors"
                                                                        title="Permanently Delete"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-black text-emerald-400/20 uppercase tracking-widest italic">Admin Controlled</span>
                                                            )}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card-Based List View */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {paginatedRecords.map(record => {
                                const bDiff = (record.billedAmount || 0) - (record.contractAmount || 0);
                                const fDiff = (record.billedManagementFee || 0) - (record.contractManagementFee || 0);
                                const isProfit = bDiff + fDiff >= 0;
                                const isSelected = selectedIds.has(record.id);

                                return (
                                    <div 
                                        key={record.id} 
                                        className={`p-4 transition-all duration-150 border-b border-white/5 ${isSelected ? 'bg-emerald-500/10' : 'active:bg-white/5'}`}
                                        onClick={(e) => {
                                            // Handle row selection on click as well for mobile accessibility
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
                                                    <p className="text-[10px] text-emerald-400/50 font-medium uppercase mt-0.5">{record.companyName || '—'}</p>
                                                    {activeSubTab === 'log' && record.billingMonth && (
                                                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-emerald-500/10 text-[#00D27F] text-[9px] font-black rounded tracking-tighter uppercase">
                                                            {format(new Date(record.billingMonth), 'MMM yyyy')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {activeSubTab === 'active' && (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${isProfit ? 'bg-emerald-500/10 text-[#00D27F]' : 'bg-rose-500/10 text-rose-400'}`}>
                                                    {isProfit ? 'Profit' : 'Loss'}
                                                </span>
                                            )}
                                        </div>

                                        {activeSubTab === 'active' ? (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-3 bg-[#041b0f] rounded-xl border border-white/5">
                                                        <p className="text-[8px] font-black text-emerald-400/20 uppercase tracking-[0.2em] mb-1">Contract</p>
                                                        <p className="text-xs font-mono font-bold text-emerald-400/60">
                                                            {formatCurrency((record.contractAmount || 0) + (record.contractManagementFee || 0))}
                                                        </p>
                                                    </div>
                                                    <div className="p-3 bg-[#041b0f] rounded-xl border border-white/5 text-right">
                                                        <p className="text-[8px] font-black text-emerald-400/20 uppercase tracking-[0.2em] mb-1">Billed</p>
                                                        <p className="text-sm font-mono font-black text-white">
                                                            {formatCurrency((record.billedAmount || 0) + (record.billedManagementFee || 0))}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-2">
                                                    <div>
                                                        <p className="text-[8px] font-black text-emerald-400/20 uppercase tracking-[0.2em] mb-1">Net Variation</p>
                                                        <p className={`text-sm font-mono font-black ${isProfit ? 'text-[#00D27F]' : 'text-rose-400'}`}>
                                                            {isProfit ? '+' : ''}{formatCurrency(bDiff + fDiff)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/finance/site-tracker/edit/${record.id}`); }} 
                                                            className="p-2.5 text-emerald-400/40 hover:text-[#00D27F] hover:bg-white/5 rounded-xl transition-all border border-white/5"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setRecordToDelete(record); setIsBulkDeleting(false); setShowDeleteModal(true); }} 
                                                            className="p-2.5 text-emerald-400/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-white/5"
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
                                                        <span className="font-bold text-white uppercase tracking-tight">{record.deletedByName || '—'}</span> • {record.deletedAt && format(new Date(record.deletedAt), 'dd MMM, HH:mm')}
                                                    </div>
                                                    {user?.role === 'admin' && (
                                                        <div className="flex items-center gap-1.5">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleRestoreRecord(record.id); }} 
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
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
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
                trackerType="finance"
            />
            {/* ── Import Preview Modal ── */}
            {previewData.length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Financial Import Preview</h2>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {previewData.length} records ready to import
                                    {importedMonth && (
                                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                                            <Clock className="h-3 w-3" />
                                            {importedMonth}
                                        </span>
                                    )}
                                </p>
                            </div>
                            <button onClick={() => setPreviewData([])} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-gray-50">
                            <table className="w-full text-sm">
                                <thead className="bg-white border-b border-gray-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-widest">Site Name</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-widest">Contract</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-widest">Fee</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-widest">Billed</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-widest">Billed Fee</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-widest">Net Var</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {previewData.map((record, idx) => {
                                        const totalContract = (record.contractAmount || 0) + (record.contractManagementFee || 0);
                                        const totalBilled = (record.billedAmount || 0) + (record.billedManagementFee || 0);
                                        const variations = totalBilled - totalContract;
                                        const isProfit = variations >= 0;
                                        return (
                                            <tr key={idx} className="hover:bg-gray-100/50 transition-colors bg-white">
                                                <td className="px-5 py-3">
                                                    <div className="font-bold text-gray-900">{record.siteName}</div>
                                                    <div className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-wider">{record.companyName}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-600">{formatCurrency(record.contractAmount || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-600">{formatCurrency(record.contractManagementFee || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{formatCurrency(record.billedAmount || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{formatCurrency(record.billedManagementFee || 0)}</td>
                                                <td className={`px-4 py-3 text-right font-mono font-black ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {isProfit ? '+' : ''}{formatCurrency(variations)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setPreviewData([])} className="px-5 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-all border border-gray-200">Cancel</button>
                            <button
                                onClick={handleConfirmImport}
                                disabled={isImporting}
                                className="inline-flex items-center gap-1.5 px-6 py-2 text-sm font-black text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
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
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[110] flex items-center justify-center p-4">
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
        </div>
    );
};

export default SiteFinanceTracker;
