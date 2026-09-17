import { saveAsHybrid as saveAs } from './fileDownloader';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { type EmployeeMonthlyData } from '../components/attendance/MonthlyHoursReport';
import { calculateStatsForDateRange, resolveMonthlyDayHeaders, parseStatusDetails } from './attendanceCalculations';
import { FIXED_HOLIDAYS } from './constants';
import { isSecurityEmployee, getCompanyBranding, PARADIGM_LOGO_BASE64, SOUTHWALL_LOGO_BASE64 } from './reportLogos';

export { isSecurityEmployee, getCompanyBranding };

export interface MonthlyReportRow {
    userName: string;
    statuses: string[];
    presentDays: number;
    halfDays: number;
    threeQuarterDays?: number;
    quarterDays?: number;
    absentDays: number;
    weekOffs: number;
    holidays: number;
    weekendPresents: number;
    holidayPresents: number;
    totalPayableDays: number;
    sickLeaves: number;
    earnedLeaves: number;
    compOffs: number;
    floatingHolidays: number;
    lossOfPays: number;
    workFromHomeDays: number;
    overtimeDays: number;
    dailyData?: any[];
}

export interface LeaveBalanceRow {
    userName: string;
    earnedTotal: number;
    earnedUsed: number;
    earnedThisMonth: number;
    earnedPreviousMonth: number;
    sickTotal: number;
    sickUsed: number;
    floatingTotal: number;
    floatingUsed: number;
    compOffTotal: number;
    compOffUsed: number;
    maternityTotal: number;
    maternityUsed: number;
    childCareTotal: number;
    childCareUsed: number;
    totalBalance: number;
}

// --- Generic Excel Export ---
export interface GenericReportColumn {
    header: string;
    key: string;
    width: number;
}

const buildGenericWorksheet = async (
    workbook: any,
    sheetName: string,
    sheetData: any[],
    columns: GenericReportColumn[],
    reportTitle: string,
    dateRange: { startDate: Date; endDate: Date },
    isSecurity?: boolean,
    customLogoBase64?: string,
    generatedBy?: string
) => {
    const worksheet = workbook.addWorksheet(sheetName);
    const branding = getCompanyBranding(!!isSecurity);
    const effectiveLogoBase64 = (typeof customLogoBase64 === 'string' && customLogoBase64.length > 50) ? customLogoBase64 : branding.logoBase64;
    const effectiveLogoExt = branding.logoExt;

    // Top Rows Sizing
    worksheet.getRow(1).height = 36;
    worksheet.getRow(2).height = 24;
    worksheet.getRow(3).height = 20;

    const useSplitHeader = columns.length >= 4;
    const textStartColLetter = useSplitHeader ? 'C' : 'A';
    const totalCols = Math.max(columns.length, 4);
    let mergeEndCol = '';
    let colCursor = totalCols;
    while (colCursor > 0) {
        const remainder = (colCursor - 1) % 26;
        mergeEndCol = String.fromCharCode(65 + remainder) + mergeEndCol;
        colCursor = Math.floor((colCursor - 1) / 26);
    }

    if (useSplitHeader) {
        worksheet.mergeCells('A1:B3');
        const logoCell = worksheet.getCell('A1');
        logoCell.value = '';
        logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

        const cardBorderColor = 'FFCBD5E1';
        for (let rowIdx = 1; rowIdx <= 3; rowIdx++) {
            for (let colIdx = 1; colIdx <= 2; colIdx++) {
                const c = worksheet.getRow(rowIdx).getCell(colIdx);
                c.border = {
                    top: rowIdx === 1 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
                    bottom: rowIdx === 3 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
                    left: colIdx === 1 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
                    right: colIdx === 2 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
                };
            }
        }

        if (effectiveLogoBase64) {
            try {
                const cleanBase64 = effectiveLogoBase64.includes(',') ? effectiveLogoBase64.split(',')[1] : effectiveLogoBase64;
                const imageId = workbook.addImage({
                    base64: cleanBase64,
                    extension: effectiveLogoExt,
                });
                if (isSecurity) {
                    worksheet.addImage(imageId, {
                        tl: { col: 0.25, row: 0.35 },
                        ext: { width: 145, height: 48 }
                    });
                } else {
                    worksheet.addImage(imageId, {
                        tl: { col: 0.1, row: 0.55 },
                        ext: { width: 190, height: 30 }
                    });
                }
            } catch (error) {
                console.error('Failed to add logo to Excel:', error);
            }
        }

        worksheet.mergeCells(`${textStartColLetter}1:${mergeEndCol}1`); 
        const titleCell = worksheet.getCell(`${textStartColLetter}1`);
        titleCell.value = `${branding.companyName} — ${reportTitle}`;
        titleCell.font = { size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branding.primaryColor } };
        titleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

        worksheet.mergeCells(`${textStartColLetter}2:${mergeEndCol}2`);
        const dateCell = worksheet.getCell(`${textStartColLetter}2`);
        const startStr = (dateRange.startDate instanceof Date && !isNaN(dateRange.startDate.getTime())) ? format(dateRange.startDate, 'dd MMM yyyy') : 'Start';
        const endStr = (dateRange.endDate instanceof Date && !isNaN(dateRange.endDate.getTime())) ? format(dateRange.endDate, 'dd MMM yyyy') : 'End';
        dateCell.value = `Period: ${startStr} to ${endStr}   |   Organization: ${branding.companyName}`;
        dateCell.font = { size: 10.5, color: { argb: 'FF1E293B' }, bold: true };
        dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        dateCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

        worksheet.mergeCells(`${textStartColLetter}3:${mergeEndCol}3`);
        const metaCell1 = worksheet.getCell(`${textStartColLetter}3`);
        metaCell1.value = `Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}${generatedBy ? ` by ${generatedBy}` : ''}`;
        metaCell1.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
        metaCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        metaCell1.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    } else {
        worksheet.mergeCells(`A1:${mergeEndCol}1`); 
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `${branding.companyName} — ${reportTitle}`;
        titleCell.font = { size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branding.primaryColor } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells(`A2:${mergeEndCol}2`);
        const dateCell = worksheet.getCell('A2');
        const startStr = (dateRange.startDate instanceof Date && !isNaN(dateRange.startDate.getTime())) ? format(dateRange.startDate, 'dd MMM yyyy') : 'Start';
        const endStr = (dateRange.endDate instanceof Date && !isNaN(dateRange.endDate.getTime())) ? format(dateRange.endDate, 'dd MMM yyyy') : 'End';
        dateCell.value = `Period: ${startStr} to ${endStr}   |   Organization: ${branding.companyName}`;
        dateCell.font = { size: 10.5, color: { argb: 'FF1E293B' }, bold: true };
        dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells(`A3:${mergeEndCol}3`);
        const metaCell1 = worksheet.getCell('A3');
        metaCell1.value = `Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}${generatedBy ? ` by ${generatedBy}` : ''}`;
        metaCell1.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
        metaCell1.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    let currentRow = 5;

    // 3. Define Header Row
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = columns.map(c => c.header);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branding.primaryColor } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Set widths
    columns.forEach((col, idx) => {
        worksheet.getColumn(idx + 1).width = col.width;
    });

    currentRow++;

    // 4. Add Data
    sheetData.forEach(item => {
        const rowValues = columns.map(col => item[col.key]);
        const row = worksheet.getRow(currentRow);
        row.values = rowValues;
        
        row.eachCell((cell) => {
             cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
             cell.alignment = { wrapText: true, vertical: 'middle' };
        });
        
        currentRow++;
    });

    // Protect Sheet with password: password1610
    await worksheet.protect('password1610', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        insertHyperlinks: false,
        deleteColumns: false,
        deleteRows: false,
        sort: false,
        autoFilter: false,
        pivotTables: false
    });
};

export const exportGenericReportToExcel = async (
    data: any[],
    columns: GenericReportColumn[],
    reportTitle: string,
    dateRange: { startDate: Date; endDate: Date },
    fileNamePrefix: string,
    logoBase64?: string,
    generatedBy?: string,
    options?: { returnBlobOnly?: boolean }
): Promise<{ blob: Blob; fileName: string }> => {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();

    const hasEmployeeDetails = data.some(item => item.designation || item.role || item.company);
    const securityRows = hasEmployeeDetails ? data.filter(item => isSecurityEmployee(item)) : [];
    const paradigmRows = hasEmployeeDetails ? data.filter(item => !isSecurityEmployee(item)) : [];

    if (securityRows.length > 0 && paradigmRows.length > 0) {
        await buildGenericWorksheet(workbook, 'Southwall Security', securityRows, columns, reportTitle, dateRange, true, logoBase64, generatedBy);
        await buildGenericWorksheet(workbook, 'Paradigm Services', paradigmRows, columns, reportTitle, dateRange, false, logoBase64, generatedBy);
    } else if (securityRows.length > 0) {
        await buildGenericWorksheet(workbook, 'Southwall Security', securityRows, columns, reportTitle, dateRange, true, logoBase64, generatedBy);
    } else if (paradigmRows.length > 0) {
        await buildGenericWorksheet(workbook, 'Paradigm Services', paradigmRows, columns, reportTitle, dateRange, false, logoBase64, generatedBy);
    } else {
        await buildGenericWorksheet(workbook, reportTitle, data, columns, reportTitle, dateRange, false, logoBase64, generatedBy);
    }

    // 5. Generate and Save
    const buffer = await workbook.xlsx.writeBuffer();
    const monthStr = (dateRange.startDate instanceof Date && !isNaN(dateRange.startDate.getTime())) ? format(dateRange.startDate, 'MMM_yyyy') : format(new Date(), 'MMM_yyyy');
    const fileName = `${fileNamePrefix}_${monthStr}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (!options?.returnBlobOnly) {
        saveAs(blob, fileName);
    }
    return { blob, fileName };
};



const buildMonthlyAttendanceWorksheet = async (
    workbook: any,
    sheetName: string,
    empList: EmployeeMonthlyData[],
    dateRange: { startDate: Date; endDate: Date },
    isSecurity?: boolean,
    customLogoBase64?: string,
    generatedBy?: string
) => {
    const worksheet = workbook.addWorksheet(sheetName);
    const branding = getCompanyBranding(!!isSecurity);
    const effectiveLogoBase64 = (typeof customLogoBase64 === 'string' && customLogoBase64.length > 50) ? customLogoBase64 : branding.logoBase64;
    const effectiveLogoExt = branding.logoExt;

    // Top Rows Sizing
    worksheet.getRow(1).height = 36;
    worksheet.getRow(2).height = 24;
    worksheet.getRow(3).height = 20;

    // 1. Dedicated Clean White Logo Card (A1:D3)
    worksheet.mergeCells('A1:D3');
    const logoCell = worksheet.getCell('A1');
    logoCell.value = '';
    logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

    const cardBorderColor = 'FFCBD5E1';
    for (let rowIdx = 1; rowIdx <= 3; rowIdx++) {
        for (let colIdx = 1; colIdx <= 4; colIdx++) {
            const c = worksheet.getRow(rowIdx).getCell(colIdx);
            c.border = {
                top: rowIdx === 1 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
                bottom: rowIdx === 3 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
                left: colIdx === 1 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
                right: colIdx === 4 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
            };
        }
    }

    if (effectiveLogoBase64) {
        try {
            const cleanBase64 = effectiveLogoBase64.includes(',') ? effectiveLogoBase64.split(',')[1] : effectiveLogoBase64;
            const imageId = workbook.addImage({
                base64: cleanBase64,
                extension: effectiveLogoExt,
            });
            if (isSecurity) {
                worksheet.addImage(imageId, {
                    tl: { col: 0.45, row: 0.35 },
                    ext: { width: 165, height: 55 }
                });
            } else {
                worksheet.addImage(imageId, {
                    tl: { col: 0.2, row: 0.55 },
                    ext: { width: 228, height: 35 }
                });
            }
        } catch (error) {
            console.error('Failed to add logo to Excel:', error);
        }
    }

    // 2. Right Side: Top Header Banner (E1:AJ1)
    worksheet.mergeCells('E1:AJ1');
    const titleCell = worksheet.getCell('E1');
    titleCell.value = `${branding.companyName} — Monthly Attendance Report`;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branding.primaryColor } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

    // 3. Billing Cycle & Org Banner (E2:AJ2)
    worksheet.mergeCells('E2:AJ2');
    const dateCell = worksheet.getCell('E2');
    const startStr = (dateRange.startDate instanceof Date && !isNaN(dateRange.startDate.getTime())) ? format(dateRange.startDate, 'dd MMMM yyyy') : 'Start';
    const endStr = (dateRange.endDate instanceof Date && !isNaN(dateRange.endDate.getTime())) ? format(dateRange.endDate, 'dd MMMM yyyy') : 'End';
    dateCell.value = `Billing Cycle: ${startStr} - ${endStr}   |   Organization: ${branding.companyName}`;
    dateCell.font = { size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    dateCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

    // 4. Metadata (E3:AJ3) - WITHOUT PASSWORD
    worksheet.mergeCells('E3:AJ3');
    const metaCell = worksheet.getCell('E3');
    metaCell.value = `Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}${generatedBy ? ` by ${generatedBy}` : ''}`;
    metaCell.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
    metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    metaCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

    let currentRow = 4;

    // 3. Loop through each employee and create a detailed block
    empList.forEach((employee) => {
        // Employee Summary Header
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        const nameCell = worksheet.getCell(`A${currentRow}`);
        nameCell.value = employee.userName || employee.employeeName;
        nameCell.font = { bold: true, size: 13, color: { argb: branding.primaryColor } };
        
        worksheet.mergeCells(`G${currentRow}:L${currentRow}`);
        const roleCell = worksheet.getCell(`G${currentRow}`);
        roleCell.value = `Role: ${employee.role?.replace(/_/g, ' ') || 'N/A'}`;
        roleCell.font = { italic: true, size: 11, color: { argb: 'FF64748B' } };
        
        currentRow++;

        // Status Tiles / Summary Stats Row
        const statsRow = worksheet.getRow(currentRow);
        statsRow.height = 28;
        const stats = [
            { l: 'Net Work', v: `${(employee.totalNetWorkDuration || 0).toFixed(2)} Hrs` },
            { l: 'Total OT', v: `${(employee.totalOT || 0).toFixed(2)} Hrs` },
            { l: 'Avg Hrs', v: `${(employee.averageWorkingHrs || 0).toFixed(2)} Hrs` },
            { l: 'P', v: employee.presentDays || 0 },
            { l: 'A', v: employee.absentDays || 0 },
            { l: 'W/O', v: employee.weekOffs || 0 },
            { l: 'H', v: employee.holidays || 0 },
            { l: 'L', v: (employee.leaves || 0) },
            { l: 'Pay Days', v: employee.totalPayableDays }
        ];

        stats.forEach((s, idx) => {
            const col = idx * 2 + 1;
            const labelCell = worksheet.getCell(currentRow, col);
            labelCell.value = s.l;
            labelCell.font = { bold: true, size: 9, color: { argb: 'FF475569' } };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
            labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            const valCell = worksheet.getCell(currentRow, col + 1);
            valCell.value = s.v;
            valCell.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
            valCell.alignment = { horizontal: 'center', vertical: 'middle' };
            valCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            if (s.l === 'Pay Days') {
                valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branding.lightBgColor } };
                valCell.font.color = { argb: branding.accentColor };
            }
        });

        currentRow += 2;

        // --- Detailed 31-Day Matrix block ---
        const matrixHeaders = ['Date', ...(employee.dailyData || []).map(d => d.date)];
        const headerRow = worksheet.getRow(currentRow);
        headerRow.values = matrixHeaders;
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.height = 24;
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branding.primaryColor } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        
        // Define Rows for the matrix
        const metricsData = [
            { label: 'Status', key: 'status' },
            { label: 'In Time', key: 'inTime' },
            { label: 'Out Time', key: 'outTime' },
            { label: 'Gross', key: 'grossDuration' },
            { label: 'Net worked', key: 'netWorkedHours' },
            { label: 'OT', key: 'ot' },
            { label: 'Shift', key: 'shift' }
        ];

        metricsData.forEach((m) => {
            currentRow++;
            const rowValues = [
                m.label,
                ...(employee.dailyData || []).map(d => {
                    const val = (d as any)[m.key];
                    if (m.key === 'shift' && typeof val === 'string') {
                        return val.replace(/Shift /g, '');
                    }
                    return val || '-';
                })
            ];
            const matrixRow = worksheet.getRow(currentRow);
            matrixRow.values = rowValues;
            matrixRow.height = 20;

            const labelCell = matrixRow.getCell(1);
            labelCell.font = { bold: true, color: { argb: 'FF1E293B' } };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            labelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

            for (let i = 2; i <= rowValues.length; i++) {
                const cell = matrixRow.getCell(i);
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

                // Apply conditional colors for Status
                if (m.label === 'Status') {
                    const statusVal = rowValues[i - 1];
                    if (statusVal === 'P' || statusVal === 'Present' || statusVal === 'W/P' || statusVal === 'H/P' || statusVal === 'BL/P' || statusVal === 'PL/P') {
                        cell.font = { color: { argb: 'FF166534' }, bold: true };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
                    } else if (statusVal === 'A' || statusVal === 'Absent' || String(statusVal).includes('LOP')) {
                        cell.font = { color: { argb: 'FF991B1B' }, bold: true };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                    } else if (statusVal === 'W/O') {
                        cell.font = { color: { argb: 'FF475569' }, bold: true };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                    } else if (statusVal === 'H') {
                        cell.font = { color: { argb: 'FF854D0E' }, bold: true };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFef9C3' } };
                    }
                }
            }
            matrixRow.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        currentRow += 3; // Spacer between employees
    });

    // Finalize column widths
    worksheet.getColumn(1).width = 18;
    for (let i = 2; i <= 35; i++) {
        worksheet.getColumn(i).width = 9;
    }

    // Protect Sheet with password: password1610
    await worksheet.protect('password1610', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        insertHyperlinks: false,
        deleteColumns: false,
        deleteRows: false,
        sort: false,
        autoFilter: false,
        pivotTables: false
    });
};

export const exportAttendanceToExcel = async (
    data: EmployeeMonthlyData[],
    dateRange: { startDate: Date; endDate: Date },
    logoBase64?: string,
    generatedBy?: string,
    options?: { returnBlobOnly?: boolean }
): Promise<{ blob: Blob; fileName: string }> => {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();

    const securityEmps = data.filter(e => isSecurityEmployee({ designation: (e as any).designation || e.role, role: e.role || (e as any).designation, company: (e as any).company }));
    const paradigmEmps = data.filter(e => !isSecurityEmployee({ designation: (e as any).designation || e.role, role: e.role || (e as any).designation, company: (e as any).company }));

    if (securityEmps.length > 0 && paradigmEmps.length > 0) {
        await buildMonthlyAttendanceWorksheet(workbook, 'Southwall Security', securityEmps, dateRange, true, logoBase64, generatedBy);
        await buildMonthlyAttendanceWorksheet(workbook, 'Paradigm Services', paradigmEmps, dateRange, false, logoBase64, generatedBy);
    } else if (securityEmps.length > 0) {
        await buildMonthlyAttendanceWorksheet(workbook, 'Southwall Security', securityEmps, dateRange, true, logoBase64, generatedBy);
    } else if (paradigmEmps.length > 0) {
        await buildMonthlyAttendanceWorksheet(workbook, 'Paradigm Services', paradigmEmps, dateRange, false, logoBase64, generatedBy);
    } else {
        await buildMonthlyAttendanceWorksheet(workbook, 'Monthly Attendance', data, dateRange, false, logoBase64, generatedBy);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const monthStr = (dateRange.startDate instanceof Date && !isNaN(dateRange.startDate.getTime())) ? format(dateRange.startDate, 'MMM_yyyy') : format(new Date(), 'MMM_yyyy');
    const fileName = `Monthly_Attendance_Report_${monthStr}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (!options?.returnBlobOnly) {
        saveAs(blob, fileName);
    }
    return { blob, fileName };
};


// ── Detailed Audit 31-Day Attendance Report Export (Matching PDF Layout) ──

export interface DetailedAuditExcelEmployee {
    empCode: string;
    empName: string;
    designation: string;
    department: string;
    company?: string;
    role?: string;
    billingPeriod: string;
    netWorkHrs: string;
    totalOtHrs: string;
    avgHrsPerDay: string;
    grossHrs: string;
    breakHrs: string;
    paidDays: string;
    absentDays: string;
    weeklyOffs: string;
    payableDays: string;
    presenceScorePct: number;
    shiftGsCount: number;
    shiftNsCount: number;
    dailyData: {
        dayNum: number;
        status: string;
        inTime: string;
        outTime: string;
        permDuration?: string;
        grossDur: string;
        breakIn?: string;
        breakOut?: string;
        breakDur: string;
        netWorked: string;
        travelKm?: string;
        lateBy: string;
        ot: string;
        shortfall?: string;
        shift: string;
    }[];
}

const cleanTimeForExcel = (timeStr: string | null | undefined): string => {
    if (!timeStr || timeStr === '-' || timeStr === '—' || timeStr === 'null' || timeStr === 'undefined' || timeStr.trim() === '') return '-';
    const clean = timeStr.trim().replace(/[\u2013\u2014]/g, '-');
    if (clean === '-' || clean === '—') return '-';
    const match = clean.match(/(?:^|[\sT])(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(am|pm))?/i);
    if (match) {
        let h = parseInt(match[1], 10);
        const min = match[2];
        const ap = match[3]?.toUpperCase();
        if (ap === 'PM' && h < 12) h += 12;
        if (ap === 'AM' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${min}`;
    }
    return clean;
};

const cleanDurForExcel = (durStr: string | null | undefined): string => {
    if (!durStr || durStr === '-' || durStr === '—' || durStr === 'null' || durStr.trim() === '') return '-';
    const clean = durStr.trim().replace(/[\u2013\u2014]/g, '-');
    if (clean === '-' || clean === '—') return '-';
    const hmMatch = clean.match(/^(\d+)\s*h\s*(\d+)?\s*m?$/i);
    if (hmMatch) {
        const h = hmMatch[1];
        const m = hmMatch[2] ? hmMatch[2].padStart(2, '0') : '00';
        return `${h}:${m}`;
    }
    return clean;
};

const cleanShiftForExcel = (shiftStr: string | null | undefined): string => {
    if (!shiftStr || shiftStr === '-' || shiftStr === '—' || shiftStr.trim() === '') return '-';
    const clean = shiftStr.trim().replace(/[\u2013\u2014]/g, '-');
    if (clean.length <= 4) return clean;
    if (/night.*12/i.test(clean)) return 'NS12';
    if (/day.*12/i.test(clean)) return 'DS12';
    if (/general/i.test(clean)) return 'GS';
    if (/night/i.test(clean)) return 'NS';
    if (/morning/i.test(clean)) return 'MS';
    if (/evening/i.test(clean)) return 'ES';
    return clean.slice(0, 4).toUpperCase();
};

const buildDetailedAuditWorksheet = async (
    workbook: any,
    sheetName: string,
    empList: DetailedAuditExcelEmployee[],
    isSecurity: boolean,
    siteName: string,
    dateRange: { startDate: Date; endDate: Date },
    generatedBy?: string
) => {
    const worksheet = workbook.addWorksheet(sheetName);
    const branding = getCompanyBranding(isSecurity);

    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
    };

    const thinBorder = {
        top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } }
    };

    worksheet.getColumn(1).width = 18;
    for (let c = 2; c <= 32; c++) {
        worksheet.getColumn(c).width = 8.5;
    }

    // Top Rows Sizing
    worksheet.getRow(1).height = 36;
    worksheet.getRow(2).height = 24;
    worksheet.getRow(3).height = 20;

    // 1. Dedicated Clean White Logo Card (A1:D3)
    worksheet.mergeCells('A1:D3');
    const logoCell = worksheet.getCell('A1');
    logoCell.value = '';
    logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

    const cardBorderColor = 'FFCBD5E1';
    for (let rowIdx = 1; rowIdx <= 3; rowIdx++) {
        for (let colIdx = 1; colIdx <= 4; colIdx++) {
            const c = worksheet.getRow(rowIdx).getCell(colIdx);
            c.border = {
                top: rowIdx === 1 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
                bottom: rowIdx === 3 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
                left: colIdx === 1 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
                right: colIdx === 4 ? { style: 'thin', color: { argb: cardBorderColor } } : undefined,
            };
        }
    }

    // Embed Logo into the clean white card (A1:D3)
    if (branding.logoBase64) {
        try {
            const cleanBase64 = branding.logoBase64.includes(',') ? branding.logoBase64.split(',')[1] : branding.logoBase64;
            const imageId = workbook.addImage({
                base64: cleanBase64,
                extension: branding.logoExt,
            });
            if (isSecurity) {
                // Southwall logo (aspect ratio 3:1)
                worksheet.addImage(imageId, {
                    tl: { col: 0.5, row: 0.35 },
                    ext: { width: 165, height: 55 }
                });
            } else {
                // Paradigm logo (aspect ratio 6.52:1, 1024x157)
                worksheet.addImage(imageId, {
                    tl: { col: 0.25, row: 0.55 },
                    ext: { width: 235, height: 36 }
                });
            }
        } catch (err) {
            console.warn('Failed to embed logo in Excel sheet:', err);
        }
    }

    // 2. Right Side: Top Header Banner (E1:AF1)
    worksheet.mergeCells('E1:AF1');
    const h1 = worksheet.getCell('E1');
    h1.value = branding.headerTitle;
    h1.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branding.primaryColor } };
    h1.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

    // 3. Report Title Banner (E2:AF2)
    worksheet.mergeCells('E2:AF2');
    const h2 = worksheet.getCell('E2');
    h2.value = `Detailed Audit Attendance Report (31-Day) — Site: ${siteName}`;
    h2.font = { size: 12, bold: true, color: { argb: 'FF1E293B' } };
    h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    h2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

    // 4. Metadata Line (E3:AF3) - WITHOUT PASSWORD
    const startStr = dateRange.startDate ? format(dateRange.startDate, 'dd MMM yyyy') : '01 Sep 2026';
    const endStr = dateRange.endDate ? format(dateRange.endDate, 'dd MMM yyyy') : '17 Sep 2026';

    worksheet.mergeCells('E3:AF3');
    const h3 = worksheet.getCell('E3');
    h3.value = `Billing Cycle: ${startStr} — ${endStr}   |   Organization: ${branding.companyName}   |   Generated by: ${generatedBy || 'admin@paradigmfms.com'}`;
    h3.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
    h3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    h3.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

    let r = 5;

    empList.forEach((emp) => {
        // Employee Header
        worksheet.mergeCells(`A${r}:P${r}`);
        const empNameCell = worksheet.getCell(`A${r}`);
        empNameCell.value = `Name : ${emp.empName} (${emp.empCode})   |   Role: ${emp.designation}`;
        empNameCell.font = { bold: true, size: 11, color: { argb: branding.primaryColor } };
        empNameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branding.lightBgColor } };
        empNameCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

        worksheet.mergeCells(`Q${r}:AF${r}`);
        const siteCell = worksheet.getCell(`Q${r}`);
        siteCell.value = `ORG: ${branding.companyName}   |   SITE: ${emp.department.toUpperCase()}   |   Billing: ${emp.billingPeriod}`;
        siteCell.font = { bold: true, size: 10, color: { argb: 'FF1E293B' } };
        siteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branding.lightBgColor } };
        siteCell.alignment = { horizontal: 'right', vertical: 'middle' };
        worksheet.getRow(r).height = 24;

        r++;

        // KPI Cards Row
        worksheet.getRow(r).height = 26;

        worksheet.mergeCells(`A${r}:D${r}`);
        const kpiNet = worksheet.getCell(`A${r}`);
        kpiNet.value = `NET WORK: ${emp.netWorkHrs} Hrs`;
        kpiNet.font = { bold: true, size: 9.5, color: { argb: branding.accentColor } };
        kpiNet.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branding.lightBgColor } };
        kpiNet.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells(`E${r}:H${r}`);
        const kpiOt = worksheet.getCell(`E${r}`);
        kpiOt.value = `TOTAL OT: ${emp.totalOtHrs} Hrs`;
        kpiOt.font = { bold: true, size: 9.5, color: { argb: 'FF047857' } };
        kpiOt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        kpiOt.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells(`I${r}:L${r}`);
        const kpiAvg = worksheet.getCell(`I${r}`);
        kpiAvg.value = `AVG HRS/DAY: ${emp.avgHrsPerDay} Hrs`;
        kpiAvg.font = { bold: true, size: 9.5, color: { argb: 'FF854D0E' } };
        kpiAvg.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
        kpiAvg.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells(`M${r}:R${r}`);
        const kpiGross = worksheet.getCell(`M${r}`);
        kpiGross.value = `GROSS: ${emp.grossHrs}h / BREAK: ${emp.breakHrs}h`;
        kpiGross.font = { bold: true, size: 9.5, color: { argb: 'FF1E293B' } };
        kpiGross.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        kpiGross.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells(`S${r}:AF${r}`);
        const kpiDist = worksheet.getCell(`S${r}`);
        kpiDist.value = `Paid: ${emp.paidDays} | Absent: ${emp.absentDays} | W/O: ${emp.weeklyOffs} | Payable: ${emp.payableDays}`;
        kpiDist.font = { bold: true, size: 9.5, color: { argb: branding.primaryColor } };
        kpiDist.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        kpiDist.alignment = { horizontal: 'center', vertical: 'middle' };

        [kpiNet, kpiOt, kpiAvg, kpiGross, kpiDist].forEach(c => {
            c.border = thinBorder;
        });

        r++;

        // Matrix Header Row: Date (Col 1 = 'Date', Col 2..32 = Day 1..31)
        const dateRow = worksheet.getRow(r);
        dateRow.height = 20;
        dateRow.getCell(1).value = 'Date';
        dateRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        dateRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        dateRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        dateRow.getCell(1).border = thinBorder;

        for (let d = 1; d <= 31; d++) {
            const cell = dateRow.getCell(d + 1);
            cell.value = d;
            cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = thinBorder;
        }

        r++;

        // 12 Attendance Metrics Rows
        const metrics = [
            { label: 'Status', key: 'status', bold: true },
            { label: 'InTime', key: 'inTime', isTime: true },
            { label: 'OutTime', key: 'outTime', isTime: true },
            { label: 'Perm Duration', key: 'permDuration', isDur: true },
            { label: 'Gross Dur', key: 'grossDur', isDur: true },
            { label: 'Break In', key: 'breakIn', isTime: true },
            { label: 'Break Out', key: 'breakOut', isTime: true },
            { label: 'Break Dur', key: 'breakDur', isDur: true },
            { label: 'Net worked', key: 'netWorked', isDur: true, isHighlight: true },
            { label: 'Travel (KM)', key: 'travelKm' },
            { label: 'Late By', key: 'lateBy', isDur: true },
            { label: 'OT', key: 'ot', isDur: true },
            { label: 'Shift', key: 'shift', isShift: true }
        ];

        metrics.forEach((m) => {
            const mRow = worksheet.getRow(r);
            mRow.height = 18;

            const lblCell = mRow.getCell(1);
            lblCell.value = m.label;
            lblCell.font = { size: 8.5, bold: m.bold || m.isHighlight, color: { argb: m.isHighlight ? branding.primaryColor : 'FF334155' } };
            lblCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: m.isHighlight ? branding.lightBgColor : (r % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF') }
            };
            lblCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            lblCell.border = thinBorder;

            for (let d = 1; d <= 31; d++) {
                const dayData = emp.dailyData.find((item) => item.dayNum === d);
                const cell = mRow.getCell(d + 1);
                let rawVal: any = dayData ? (dayData as any)[m.key] : '-';

                if (m.isTime) rawVal = cleanTimeForExcel(rawVal);
                else if (m.isDur) rawVal = cleanDurForExcel(rawVal);
                else if (m.isShift) rawVal = cleanShiftForExcel(rawVal);
                else if (!rawVal) rawVal = '-';

                cell.value = rawVal;
                cell.font = { size: 8, bold: m.bold || m.isHighlight };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = thinBorder;

                // Color Highlights for Status
                if (m.label === 'Status') {
                    if (rawVal === 'P') {
                        cell.font = { color: { argb: 'FF15803D' }, bold: true, size: 8.5 };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
                    } else if (rawVal === 'A') {
                        cell.font = { color: { argb: 'FFDC2626' }, bold: true, size: 8.5 };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                    } else if (rawVal === 'W/O') {
                        cell.font = { color: { argb: 'FF0284C7' }, bold: true, size: 8.5 };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
                    } else if (rawVal === 'H' || rawVal === 'H/P') {
                        cell.font = { color: { argb: 'FF4338CA' }, bold: true, size: 8.5 };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
                    } else {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    }
                } else if (m.isHighlight) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branding.lightBgColor } };
                    cell.font = { color: { argb: branding.primaryColor }, bold: true, size: 8 };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                }
            }

            r++;
        });

        // Metric Summary Footer row for this employee
        worksheet.mergeCells(`A${r}:AF${r}`);
        const summaryCell = worksheet.getCell(`A${r}`);
        summaryCell.value = `AVG WORKING HOURS: ${emp.avgHrsPerDay}H  |  SITE PRESENCE SCORE: ${emp.presenceScorePct}%  |  SHIFT DISTRIBUTION: Shift GS(${emp.shiftGsCount}) Shift NS(${emp.shiftNsCount})`;
        summaryCell.font = { size: 8.5, bold: true, color: { argb: 'FF475569' } };
        summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(r).height = 18;

        r += 2; // Spacer between employees
    });

    // Legend Row at the end
    worksheet.mergeCells(`A${r}:AF${r}`);
    const legendCell = worksheet.getCell(`A${r}`);
    legendCell.value = `ORGANIZATION: ${branding.companyName}  |  LEGEND: P: Present | 0.5P: Half Day | 0.75P: Three Quarter Day | A: Absent | LOP: Loss of Pay | W/O: Weekly Off | H: Public Holiday | H/P: Holiday Present | SL: Sick Leave | EL: Earned Leave | C/O: Comp Off`;
    legendCell.font = { size: 8.5, color: { argb: 'FF475569' } };
    legendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    legendCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(r).height = 20;

    // Apply Sheet Protection with password: password1610
    await worksheet.protect('password1610', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        insertHyperlinks: false,
        deleteColumns: false,
        deleteRows: false,
        sort: false,
        autoFilter: false,
        pivotTables: false
    });
};

export const exportDetailedAuditReportToExcel = async (
    employees: DetailedAuditExcelEmployee[],
    dateRange: { startDate: Date; endDate: Date },
    siteName: string,
    fileNameBase: string,
    generatedBy?: string,
    options?: { returnBlobOnly?: boolean }
): Promise<{ blob: Blob; fileName: string }> => {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();

    // Separate security employees from paradigm employees
    const securityEmployees = employees.filter(e => isSecurityEmployee(e));
    const paradigmEmployees = employees.filter(e => !isSecurityEmployee(e));

    if (securityEmployees.length > 0 && paradigmEmployees.length > 0) {
        // Two separate sheets: Southwall Security & Paradigm Services
        await buildDetailedAuditWorksheet(workbook, 'Southwall Security', securityEmployees, true, siteName, dateRange, generatedBy);
        await buildDetailedAuditWorksheet(workbook, 'Paradigm Services', paradigmEmployees, false, siteName, dateRange, generatedBy);
    } else if (securityEmployees.length > 0) {
        // All filtered employees belong to Southwall Security
        await buildDetailedAuditWorksheet(workbook, 'Southwall Security', securityEmployees, true, siteName, dateRange, generatedBy);
    } else if (paradigmEmployees.length > 0) {
        // All filtered employees belong to Paradigm Services
        await buildDetailedAuditWorksheet(workbook, 'Paradigm Services', paradigmEmployees, false, siteName, dateRange, generatedBy);
    } else {
        // Fallback empty sheet
        const emptyWs = workbook.addWorksheet('Attendance Report');
        emptyWs.getCell('A1').value = 'No employee records found for the selected filter.';
        await emptyWs.protect('password1610');
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `${fileNameBase}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (!options?.returnBlobOnly) {
        saveAs(blob, fileName);
    }
    return { blob, fileName };
};

export const exportLeaveBalancesToExcel = async (
    data: LeaveBalanceRow[],
    logoBase64?: string,
    generatedBy?: string,
    options?: { returnBlobOnly?: boolean }
): Promise<{ blob: Blob; fileName: string }> => {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leave Balance Report');

    // 1. Add Logo if available
    if (logoBase64 && logoBase64.startsWith('data:image')) {
        try {
            const base64Data = logoBase64.split(',')[1];
            const imageId = workbook.addImage({
                base64: base64Data,
                extension: 'png',
            });
            worksheet.addImage(imageId, {
                tl: { col: 0, row: 0 },
                ext: { width: 180, height: 45 }
            });
        } catch (error) {
            console.error('Failed to add logo to Excel:', error);
        }
    }

    // 2. Add Title and Metadata
    worksheet.getRow(1).height = 35;
    worksheet.mergeCells('A1:P1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'User Leave Balance Report';
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: 'right', vertical: 'middle' };

    worksheet.getRow(2).height = 15;
    worksheet.mergeCells('A2:P2');
    const metaCell1 = worksheet.getCell('A2');
    metaCell1.value = `As of: ${format(new Date(), 'dd MMM yyyy HH:mm')}`;
    metaCell1.font = { size: 10, italic: true };
    metaCell1.alignment = { horizontal: 'right', vertical: 'middle' };

    if (generatedBy) {
        worksheet.getRow(3).height = 15;
        worksheet.mergeCells('A3:P3');
        const metaCell2 = worksheet.getCell('A3');
        metaCell2.value = `Generated by: ${generatedBy}`;
        metaCell2.font = { size: 10, italic: true };
        metaCell2.alignment = { horizontal: 'right', vertical: 'middle' };
    }

    let currentRow = 5;

    // 3. Define Header Row
    const columns = [
        { header: 'Employee Name', key: 'userName', width: 25 },
        { header: 'EL Earned this Month', key: 'earnedThisMonth', width: 20 },
        { header: 'EL closing Balance previous month', key: 'earnedPreviousMonth', width: 30 },
        { header: 'EL total', key: 'earnedTotal', width: 12 },
        { header: 'EL Used', key: 'earnedUsed', width: 12 },
        { header: 'SL Total', key: 'sickTotal', width: 12 },
        { header: 'SL Used', key: 'sickUsed', width: 12 },
        { header: 'FH Total', key: 'floatingTotal', width: 12 },
        { header: 'FH Used', key: 'floatingUsed', width: 12 },
        { header: 'CompOff Total', key: 'compOffTotal', width: 15 },
        { header: 'CompOff Used', key: 'compOffUsed', width: 15 },
        { header: 'Maternity Total', key: 'maternityTotal', width: 15 },
        { header: 'Maternity Used', key: 'maternityUsed', width: 15 },
        { header: 'ChildCare Total', key: 'childCareTotal', width: 15 },
        { header: 'ChildCare Used', key: 'childCareUsed', width: 15 },
        { header: 'Net Balance', key: 'totalBalance', width: 15 }
    ];

    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = columns.map(c => c.header);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    headerRow.alignment = { horizontal: 'center' };

    columns.forEach((col, idx) => {
        worksheet.getColumn(idx + 1).width = col.width;
    });

    currentRow++;

    // 4. Add Data
    data.forEach(item => {
        const row = worksheet.getRow(currentRow);
        row.values = columns.map(col => item[col.key as keyof LeaveBalanceRow]);
        
        // Add borders
        row.eachCell((cell) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        
        currentRow++;
    });

    // 5. Generate and Save
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Leave_Balances_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (!options?.returnBlobOnly) {
        saveAs(blob, fileName);
    }
    return { blob, fileName };
};


export const exportMonthlyMatrixToExcel = async (
    monthlyData: Record<string, any[]>,
    dateRange: { startDate: Date; endDate: Date },
    logoBase64?: string,
    generatedBy?: string,
    generatedByRole?: string,
    targetUserName?: string,
    targetUserRole?: string,
    filters?: any,
    userHolidaysPool?: any[],
    options?: { returnBlobOnly?: boolean }
): Promise<{ blob: Blob; fileName: string }> => {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();

    // Sort month keys to ensure chronological order in sheets
    const sortedMonthKeys = Object.keys(monthlyData).sort();

    // Helper to convert 1-based column number to Excel letter (1 -> A, 27 -> AA, etc.)
    const getColLetter = (n: number) => {
        let letter = '';
        while (n > 0) {
            const temp = (n - 1) % 26;
            letter = String.fromCharCode(65 + temp) + letter;
            n = Math.floor((n - temp - 1) / 26);
        }
        return letter;
    };

    const thinBorder = {
        top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    };

    for (const monthKey of sortedMonthKeys) {
        const data = monthlyData[monthKey];
        const monthDate = new Date(monthKey + '-01');
        const worksheet = workbook.addWorksheet(format(monthDate, 'MMMM yyyy'));

        // Calculate days for this month within the global range
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const displayStart = monthStart > dateRange.startDate ? monthStart : dateRange.startDate;
        const displayEnd = monthEnd < dateRange.endDate ? monthEnd : dateRange.endDate;
        const monthDays = eachDayOfInterval({ start: displayStart, end: displayEnd });
        const maxDays = monthDays.length;

        // Recalculate employee rows using shared attendance calculation
        const recalculatedData = data.map(employee => ({
            ...employee,
            ...calculateStatsForDateRange(employee.statuses || [], monthDays)
        }));

        // Resolve exact holidays using shared algorithm (guarantees 100% match with HTML view)
        const dayHeaders = resolveMonthlyDayHeaders(monthDays, userHolidaysPool);
        const holidaysInPeriod = dayHeaders.filter(dh => dh.isHoliday);

        // Calculate Metric Summary Statistics
        const totalPresence = recalculatedData.reduce((acc, curr) => acc + (curr.presentDays || 0) + (curr.halfDays || 0) * 0.5, 0);
        const maxPossibleDays = recalculatedData.length * (monthDays.length || 30) || 1;
        const monthlyPresencePct = Math.round((totalPresence / maxPossibleDays) * 100);
        const totalPunches = Number(recalculatedData.reduce((acc, curr) => acc + (curr.presentDays || 0), 0).toFixed(2));
        const activeStaff = recalculatedData.length;

        const endColIndex = 1 + maxDays + 11; // 1 Employee + N Days + 11 Summary Stats (P, 0.5P, WH, OT, C/O, E/L, S/L, A, W/O, H, Pay)
        const mergeEndCol = getColLetter(endColIndex);

        // --- 1. Header Block (Rows 1 to 4) ---
        if (logoBase64 && logoBase64.startsWith('data:image')) {
            try {
                const base64Data = logoBase64.split(',')[1];
                const imageId = workbook.addImage({
                    base64: base64Data,
                    extension: 'png',
                });
                worksheet.addImage(imageId, {
                    tl: { col: 0, row: 0 },
                    ext: { width: 140, height: 35 }
                });
            } catch (error) {
                console.error('Failed to add logo to Excel:', error);
            }
        }

        // Company title on left
        worksheet.mergeCells('A3:D3');
        const companyCell = worksheet.getCell('A3');
        companyCell.value = 'PARADIGM SERVICES';
        companyCell.font = { bold: true, size: 11, color: { argb: 'FF006B3F' } };
        companyCell.alignment = { horizontal: 'left', vertical: 'middle' };

        // Subtitle filter on left
        worksheet.mergeCells('A4:D4');
        const subFilterCell = worksheet.getCell('A4');
        let filterDesc = 'ALL EMPLOYEES';
        if (targetUserName) {
            filterDesc = `${targetUserName}${targetUserRole ? ` (${targetUserRole.replace(/_/g, ' ')})` : ''}`;
        } else if (filters?.site) {
            filterDesc = `Site: ${filters.site}`;
        } else if (filters?.company) {
            filterDesc = `Company: ${filters.company}`;
        }
        subFilterCell.value = filterDesc.toUpperCase();
        subFilterCell.font = { bold: true, size: 8.5, color: { argb: 'FF6B7280' } };
        subFilterCell.alignment = { horizontal: 'left', vertical: 'middle' };

        // Top-Right Report Title & Metadata
        worksheet.mergeCells(`E1:${mergeEndCol}1`);
        const titleCell = worksheet.getCell('E1');
        titleCell.value = 'MONTHLY ATTENDANCE REPORT';
        titleCell.font = { size: 18, bold: true, color: { argb: 'FF111827' } };
        titleCell.alignment = { horizontal: 'right', vertical: 'middle' };

        worksheet.mergeCells(`E2:${mergeEndCol}2`);
        const cycleCell = worksheet.getCell('E2');
        cycleCell.value = `Billing Cycle: ${format(displayStart, 'dd MMM yyyy')} - ${format(displayEnd, 'dd MMM yyyy')}`;
        cycleCell.font = { size: 11, bold: true, color: { argb: 'FF374151' } };
        cycleCell.alignment = { horizontal: 'right', vertical: 'middle' };

        worksheet.mergeCells(`E3:${mergeEndCol}3`);
        const genCell1 = worksheet.getCell('E3');
        genCell1.value = `Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`;
        genCell1.font = { size: 9.5, color: { argb: 'FF6B7280' } };
        genCell1.alignment = { horizontal: 'right', vertical: 'middle' };

        worksheet.mergeCells(`E4:${mergeEndCol}4`);
        const genCell2 = worksheet.getCell('E4');
        genCell2.value = `By: ${generatedBy || 'Sudhan M'}${generatedByRole ? ` (${generatedByRole.toUpperCase()})` : ''}`;
        genCell2.font = { size: 9.5, color: { argb: 'FF6B7280' } };
        genCell2.alignment = { horizontal: 'right', vertical: 'middle' };

        // --- 2. Stats Cards (Rows 6 & 7) ---
        // Card 1: Monthly Presence
        worksheet.mergeCells('B6:E6');
        const pLabel = worksheet.getCell('B6');
        pLabel.value = 'MONTHLY PRESENCE';
        pLabel.font = { size: 8, bold: true, color: { argb: 'FF065F46' } };
        pLabel.alignment = { horizontal: 'center', vertical: 'middle' };
        pLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };

        worksheet.mergeCells('B7:E7');
        const pVal = worksheet.getCell('B7');
        pVal.value = `${monthlyPresencePct}%`;
        pVal.font = { size: 16, bold: true, color: { argb: 'FF059669' } };
        pVal.alignment = { horizontal: 'center', vertical: 'middle' };
        pVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
        pVal.border = { bottom: { style: 'medium', color: { argb: 'FF10B981' } } };

        // Card 2: Total Punches
        worksheet.mergeCells('G6:J6');
        const punchLabel = worksheet.getCell('G6');
        punchLabel.value = 'TOTAL PUNCHES';
        punchLabel.font = { size: 8, bold: true, color: { argb: 'FF1E40AF' } };
        punchLabel.alignment = { horizontal: 'center', vertical: 'middle' };
        punchLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

        worksheet.mergeCells('G7:J7');
        const punchVal = worksheet.getCell('G7');
        punchVal.value = totalPunches;
        punchVal.font = { size: 16, bold: true, color: { argb: 'FF2563EB' } };
        punchVal.alignment = { horizontal: 'center', vertical: 'middle' };
        punchVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
        punchVal.border = { bottom: { style: 'medium', color: { argb: 'FF3B82F6' } } };

        // Card 3: Active Staff
        worksheet.mergeCells('L6:O6');
        const staffLabel = worksheet.getCell('L6');
        staffLabel.value = 'ACTIVE STAFF';
        staffLabel.font = { size: 8, bold: true, color: { argb: 'FF374151' } };
        staffLabel.alignment = { horizontal: 'center', vertical: 'middle' };
        staffLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

        worksheet.mergeCells('L7:O7');
        const staffVal = worksheet.getCell('L7');
        staffVal.value = activeStaff;
        staffVal.font = { size: 16, bold: true, color: { argb: 'FF111827' } };
        staffVal.alignment = { horizontal: 'center', vertical: 'middle' };
        staffVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        staffVal.border = { bottom: { style: 'medium', color: { argb: 'FF6B7280' } } };

        let currentRow = 9;

        // --- 3. Company & Fixed Holidays Banner (Rows 9 & 10) ---
        if (holidaysInPeriod.length > 0) {
            worksheet.mergeCells(`A${currentRow}:${mergeEndCol}${currentRow}`);
            const bannerTitle = worksheet.getCell(`A${currentRow}`);
            bannerTitle.value = `📅  COMPANY & FIXED HOLIDAYS (${holidaysInPeriod.length}):`;
            bannerTitle.font = { size: 9.5, bold: true, color: { argb: 'FF881337' } };
            bannerTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
            bannerTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            bannerTitle.border = { top: { style: 'thin', color: { argb: 'FFF43F5E' } }, left: { style: 'thin', color: { argb: 'FFF43F5E' } }, right: { style: 'thin', color: { argb: 'FFF43F5E' } } };

            currentRow++;
            worksheet.mergeCells(`A${currentRow}:${mergeEndCol}${currentRow}`);
            const bannerBody = worksheet.getCell(`A${currentRow}`);
            bannerBody.value = holidaysInPeriod.map(h => `• ${h.dayNumber} ${format(h.dateObj, 'MMM')} (${h.dayOfWeek}): ${h.holidayName}${h.isFixed ? ' [FIXED]' : ''}`).join('    ');
            bannerBody.font = { size: 9, bold: true, color: { argb: 'FF9F1239' } };
            bannerBody.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
            bannerBody.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            bannerBody.border = { bottom: { style: 'thin', color: { argb: 'FFF43F5E' } }, left: { style: 'thin', color: { argb: 'FFF43F5E' } }, right: { style: 'thin', color: { argb: 'FFF43F5E' } } };

            currentRow += 2; // Spacer
        } else {
            currentRow++;
        }

        // --- 4. Two-Row Matrix Header ---
        const hRow1Index = currentRow;
        const hRow2Index = currentRow + 1;

        const hRow1 = worksheet.getRow(hRow1Index);
        const hRow2 = worksheet.getRow(hRow2Index);
        hRow1.height = 22;
        hRow2.height = 18;

        // Employee Header (Merged across Row 1 & Row 2)
        worksheet.mergeCells(`A${hRow1Index}:A${hRow2Index}`);
        const empHeader = worksheet.getCell(`A${hRow1Index}`);
        empHeader.value = 'Employee';
        empHeader.font = { bold: true, size: 10, color: { argb: 'FF1F2937' } };
        empHeader.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        empHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        empHeader.border = thinBorder;
        worksheet.getCell(`A${hRow2Index}`).border = thinBorder;

        // Day Columns (Date Number in Row 1, Day of Week in Row 2)
        dayHeaders.forEach((dh, idx) => {
            const colNum = 2 + idx;
            const cell1 = worksheet.getCell(hRow1Index, colNum);
            const cell2 = worksheet.getCell(hRow2Index, colNum);

            cell1.value = dh.dayNumber;
            cell2.value = dh.dayOfWeek;

            cell1.alignment = { horizontal: 'center', vertical: 'middle' };
            cell2.alignment = { horizontal: 'center', vertical: 'middle' };

            if (dh.isHoliday) {
                // High-visibility rose holiday styling
                cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
                cell1.font = { bold: true, size: 9.5, color: { argb: 'FF881337' } };
                cell1.border = { top: { style: 'thin', color: { argb: 'FFF43F5E' } }, left: { style: 'thin', color: { argb: 'FFF43F5E' } }, right: { style: 'thin', color: { argb: 'FFF43F5E' } }, bottom: { style: 'thin', color: { argb: 'FFF43F5E' } } };

                cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFECDD3' } };
                cell2.font = { bold: true, size: 8, color: { argb: 'FF9F1239' } };
                cell2.border = { top: { style: 'thin', color: { argb: 'FFF43F5E' } }, left: { style: 'thin', color: { argb: 'FFF43F5E' } }, right: { style: 'thin', color: { argb: 'FFF43F5E' } }, bottom: { style: 'thin', color: { argb: 'FFF43F5E' } } };
            } else if (dh.isSunday) {
                // Sunday styling
                cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
                cell1.font = { bold: true, size: 9, color: { argb: 'FFE11D48' } };
                cell1.border = thinBorder;

                cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
                cell2.font = { bold: true, size: 8, color: { argb: 'FFE11D48' } };
                cell2.border = thinBorder;
            } else {
                // Normal working day styling
                cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                cell1.font = { bold: true, size: 9, color: { argb: 'FF374151' } };
                cell1.border = thinBorder;

                cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
                cell2.font = { size: 8, color: { argb: 'FF6B7280' } };
                cell2.border = thinBorder;
            }
        });

        // Summary Stats Column Headers (Merged across Row 1 & Row 2)
        const summaryHeaders = [
            { label: 'P', bg: 'FFD1FAE5', text: 'FF065F46' },
            { label: '0.5P', bg: 'FFDBEAFE', text: 'FF1E40AF' },
            { label: 'WH', bg: 'FFCCFBF1', text: 'FF0F766E' },
            { label: 'OT', bg: 'FFCCFBF1', text: 'FF0F766E' },
            { label: 'C/O', bg: 'FFCFFAFE', text: 'FF0E7490' },
            { label: 'E/L', bg: 'FFE0E7FF', text: 'FF3730A3' },
            { label: 'S/L', bg: 'FFF3E8FF', text: 'FF6B21A8' },
            { label: 'A', bg: 'FFFEE2E2', text: 'FF991B1B' },
            { label: 'W/O', bg: 'FFF1F5F9', text: 'FF475569' },
            { label: 'H', bg: 'FFFFEDD5', text: 'FF9A3412' },
            { label: 'Pay', bg: 'FFA7F3D0', text: 'FF064E3B' },
        ];

        summaryHeaders.forEach((sh, idx) => {
            const colNum = 2 + maxDays + idx;
            worksheet.mergeCells(hRow1Index, colNum, hRow2Index, colNum);
            const cell = worksheet.getCell(hRow1Index, colNum);
            cell.value = sh.label;
            cell.font = { bold: true, size: sh.label === 'Pay' ? 10 : 9, color: { argb: sh.text } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sh.bg } };
            cell.border = thinBorder;
            worksheet.getCell(hRow2Index, colNum).border = thinBorder;
        });

        currentRow += 2;

        // --- 5. Render Employee Data Rows (Primary Row + Detail Status Sub-Row) ---
        recalculatedData.forEach((employee) => {
            const statuses = employee.statuses || [];
            const dayParsedStatuses = monthDays.map((d, sIdx) => {
                const rawStatus = statuses[d.getDate() - 1] || '-';
                const dayNumber = d.getDate();
                const dayData = employee.dailyData?.[dayNumber - 1];
                let parsed = parseStatusDetails(rawStatus, dayData);
                const dh = dayHeaders[sIdx];
                const curDateStr = format(d, 'yyyy-MM-dd');
                const isFixedHoliday = Boolean(dh?.isFixed) || FIXED_HOLIDAYS.some(fh => curDateStr.endsWith('-' + fh.date));

                const empId = String((employee as any).employeeId || (employee as any).userId || (employee as any).id || '').trim().toLowerCase();
                const empName = String(employee.userName || (employee as any).employeeName || '').trim().toLowerCase();

                const userSelectedThisHoliday = (userHolidaysPool || []).some((uh: any) => {
                    const uhUserId = String(uh.userId || uh.user_id || uh.employeeId || uh.employee_id || '').trim().toLowerCase();
                    const uhName = String(uh.userName || uh.name || uh.employeeName || '').trim().toLowerCase();
                    const matchesUser = (empId && uhUserId === empId) || (empName && uhName === empName);
                    if (!matchesUser) return false;
                    const uhDateRaw = String(uh.holidayDate || uh.holiday_date || uh.date || '').split('T')[0].split(' ')[0];
                    return uhDateRaw === curDateStr || isSameDay(new Date(uhDateRaw), d);
                });

                const isApplicableHolidayForUser = isFixedHoliday || (dh?.isHoliday && userSelectedThisHoliday);

                if (isApplicableHolidayForUser && (
                    parsed.primary === 'P' || 
                    parsed.primary === 'H/P' || 
                    rawStatus === 'P' || 
                    rawStatus === 'H/P' || 
                    rawStatus === 'HP' || 
                    rawStatus === 'Present' ||
                    parsed.detailLines.includes('C/O') ||
                    rawStatus.includes('C/O') ||
                    rawStatus.includes('CO')
                )) {
                    parsed = {
                        primary: (rawStatus.includes('0.5') || parsed.primary.includes('0.5')) ? '0.5H/P' : 'H/P',
                        detailLines: []
                    };
                }
                return {
                    rawStatus,
                    primary: parsed.primary,
                    detailLines: parsed.detailLines,
                    isHoliday: dh?.isHoliday,
                    isSunday: dh?.isSunday,
                };
            });

            // 1. Primary Row: Employee Name + Clean High-Level Status + 11 Summary Totals
            const primaryRow = worksheet.getRow(currentRow);
            primaryRow.height = 20;

            const primaryRowData: (string | number)[] = [employee.userName || employee.employeeName || 'Unknown'];
            dayParsedStatuses.forEach((ds) => {
                primaryRowData.push(ds.primary);
            });
            primaryRowData.push(
                employee.presentDays || 0,
                employee.halfDays || 0,
                employee.workFromHomeDays || 0,
                employee.overtimeDays || 0,
                employee.compOffs || 0,
                employee.earnedLeaves || 0,
                employee.sickLeaves || 0,
                employee.absentDays || 0,
                employee.weekOffs || 0,
                employee.holidays || 0,
                employee.totalPayableDays || 0
            );
            primaryRow.values = primaryRowData;

            // Primary Row Styling
            for (let colNumber = 1; colNumber <= endColIndex; colNumber++) {
                const cell = primaryRow.getCell(colNumber);
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = thinBorder;

                if (colNumber === 1) {
                    cell.font = { bold: true, size: 9.5, color: { argb: 'FF111827' } };
                    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                } else if (colNumber >= 2 && colNumber <= 1 + maxDays) {
                    const ds = dayParsedStatuses[colNumber - 2];
                    const s = ds.primary;
                    cell.font = { bold: true, size: 8.5 };

                    // Semantic font color matching HTML getStatusColor
                    if (s === 'P' || s === 'Present' || s === 'H/P' || s === 'W/P' || s === 'WOP' || s === 'BL/P' || s === 'PL/P') {
                        cell.font.color = { argb: 'FF059669' }; // Present Green
                    } else if (s === 'A' || s === 'Absent') {
                        cell.font.color = { argb: 'FFDC2626' }; // Absent Red
                    } else if (s === 'W/O' || s === 'Weekly Off') {
                        cell.font.color = { argb: 'FF6B7280' }; // WO Slate
                    } else if (s === 'H' || s === 'Holiday') {
                        cell.font.color = { argb: 'FFEA580C' }; // Holiday Orange
                    } else if (s.includes('0.5')) {
                        cell.font.color = { argb: 'FF2563EB' }; // Half Day Blue
                    } else if (s.includes('OT') || s === 'W/H' || s === 'WH') {
                        cell.font.color = { argb: 'FF0D9488' }; // Teal
                    } else if (s.includes('C/O') || s === 'CO') {
                        cell.font.color = { argb: 'FF0891B2' }; // Comp Cyan
                    } else if (s.includes('EL') || s.includes('E/L')) {
                        cell.font.color = { argb: 'FF4F46E5' }; // Earned Indigo
                    } else if (s.includes('SL') || s.includes('S/L')) {
                        cell.font.color = { argb: 'FF9333EA' }; // Sick Purple
                    } else if (s.includes('BL') || s.includes('B/L') || s.includes('F/H')) {
                        cell.font.color = { argb: 'FF1D4ED8' }; // Blue Leave
                    } else if (s.includes('PL') || s.includes('P/L')) {
                        cell.font.color = { argb: 'FFDB2777' }; // Pink Leave
                    } else if (s === 'LOP') {
                        cell.font.color = { argb: 'FFDC2626' }; // LOP Red
                    } else {
                        cell.font.color = { argb: 'FF374151' };
                    }

                    // Background highlight
                    if (ds.isHoliday) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFFECDD3' } },
                            bottom: { style: 'thin', color: { argb: 'FFFECDD3' } },
                            left: { style: 'thin', color: { argb: 'FFFECDD3' } },
                            right: { style: 'thin', color: { argb: 'FFFECDD3' } },
                        };
                    } else if (ds.isSunday) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    } else if (s === 'A' || s === 'Absent') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
                    }
                } else if (colNumber > 1 + maxDays) {
                    const statOffset = colNumber - (2 + maxDays);
                    const sh = summaryHeaders[statOffset];
                    cell.font = { bold: true, size: 9 };

                    if (sh?.label === 'P') {
                        cell.font.color = { argb: 'FF059669' };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
                    } else if (sh?.label === '0.5P') {
                        cell.font.color = { argb: 'FF2563EB' };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
                    } else if (sh?.label === 'WH' || sh?.label === 'OT') {
                        cell.font.color = { argb: 'FF0D9488' };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
                    } else if (sh?.label === 'C/O') {
                        cell.font.color = { argb: 'FF0891B2' };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFEFF' } };
                    } else if (sh?.label === 'E/L') {
                        cell.font.color = { argb: 'FF4F46E5' };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
                    } else if (sh?.label === 'S/L') {
                        cell.font.color = { argb: 'FF9333EA' };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF5FF' } };
                    } else if (sh?.label === 'A') {
                        cell.font.color = { argb: 'FFDC2626' };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
                    } else if (sh?.label === 'W/O') {
                        cell.font.color = { argb: 'FF6B7280' };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    } else if (sh?.label === 'H') {
                        cell.font.color = { argb: 'FFEA580C' };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
                    } else if (sh?.label === 'Pay') {
                        cell.font = { bold: true, size: 9.5, color: { argb: 'FF064E3B' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FF10B981' } },
                            bottom: { style: 'thin', color: { argb: 'FF10B981' } },
                            left: { style: 'medium', color: { argb: 'FF10B981' } },
                            right: { style: 'thin', color: { argb: 'FF10B981' } },
                        };
                    }
                }
            }

            // 2. Sub Row: Detail status breakdown
            currentRow++;
            const detailRow = worksheet.getRow(currentRow);
            const hasDetails = dayParsedStatuses.some(ds => ds.detailLines.length > 0);
            detailRow.height = hasDetails ? 24 : 16;

            const detailRowData: (string | number)[] = ['Detail status'];
            dayParsedStatuses.forEach((ds) => {
                detailRowData.push(ds.detailLines.length > 0 ? ds.detailLines.join('\n') : '');
            });
            for (let i = 0; i < 11; i++) {
                detailRowData.push('');
            }
            detailRow.values = detailRowData;

            // Sub Row Styling
            for (let colNumber = 1; colNumber <= endColIndex; colNumber++) {
                const cell = detailRow.getCell(colNumber);
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = thinBorder;

                if (colNumber === 1) {
                    cell.font = { bold: true, size: 8.5, color: { argb: 'FFDC2626' } }; // Bold red matching HTML text-red-600
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else if (colNumber >= 2 && colNumber <= 1 + maxDays) {
                    const ds = dayParsedStatuses[colNumber - 2];
                    cell.font = { bold: true, size: 7.5, color: { argb: 'FF0284C7' } }; // Bold sky blue matching HTML text-[#0284C7]

                    if (ds.isHoliday) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFFECDD3' } },
                            bottom: { style: 'thin', color: { argb: 'FFFECDD3' } },
                            left: { style: 'thin', color: { argb: 'FFFECDD3' } },
                            right: { style: 'thin', color: { argb: 'FFFECDD3' } },
                        };
                    } else if (ds.isSunday) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    } else {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    }
                } else if (colNumber > 1 + maxDays) {
                    // Summary stats placeholders in sub-row
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    const statOffset = colNumber - (2 + maxDays);
                    const sh = summaryHeaders[statOffset];
                    if (sh?.label === 'Pay') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6FBF0' } };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FF10B981' } },
                            bottom: { style: 'thin', color: { argb: 'FF10B981' } },
                            left: { style: 'medium', color: { argb: 'FF10B981' } },
                            right: { style: 'thin', color: { argb: 'FF10B981' } },
                        };
                    }
                }
            }

            currentRow++;
        });

        // --- 6. Footer Notation Reference & Legend Block ---
        currentRow++;
        worksheet.mergeCells(`A${currentRow}:${mergeEndCol}${currentRow}`);
        const legendCell = worksheet.getCell(`A${currentRow}`);
        legendCell.value = 'NOTATION REFERENCE: P: Present | 0.5P: Half Day | WH: Work From Home | OT: Overtime | C/O: Comp Off | E/L: Earned Leave | S/L: Sick Leave | A: Absent | W/O: Weekly Off | H: Holiday | RP: Permission (e.g. 0.75P+0.25RP) | Pay: Total Payable Days';
        legendCell.font = { size: 8.5, color: { argb: 'FF4B5563' } };
        legendCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        legendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        legendCell.border = thinBorder;

        if (holidaysInPeriod.length > 0) {
            currentRow++;
            worksheet.mergeCells(`A${currentRow}:${mergeEndCol}${currentRow}`);
            const holLegendCell = worksheet.getCell(`A${currentRow}`);
            holLegendCell.value = `ROSE HIGHLIGHTED COLUMNS = Declared Company Holidays (${holidaysInPeriod.map(h => `${h.dayNumber} ${format(h.dateObj, 'MMM')}: ${h.holidayName}`).join(' • ')})`;
            holLegendCell.font = { bold: true, size: 8.5, color: { argb: 'FF881337' } };
            holLegendCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            holLegendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
            holLegendCell.border = {
                top: { style: 'thin', color: { argb: 'FFFECDD3' } },
                bottom: { style: 'thin', color: { argb: 'FFFECDD3' } },
                left: { style: 'thin', color: { argb: 'FFFECDD3' } },
                right: { style: 'thin', color: { argb: 'FFFECDD3' } },
            };
        }

        // --- 7. Column Widths ---
        worksheet.getColumn(1).width = 24; // Employee column
        for (let i = 2; i <= 1 + maxDays; i++) {
            worksheet.getColumn(i).width = 8.8; // Day columns (comfortably fits 0.99P+0.01RP on 1 line)
        }
        for (let i = 2 + maxDays; i <= endColIndex - 1; i++) {
            worksheet.getColumn(i).width = 6.2; // Stats columns
        }
        worksheet.getColumn(endColIndex).width = 7.5; // Pay column
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const monthStr = (dateRange.startDate instanceof Date && !isNaN(dateRange.startDate.getTime()))
        ? format(dateRange.startDate, 'MMM_yyyy')
        : format(new Date(), 'MMM_yyyy');
    const fileName = `Monthly_Attendance_Report_${monthStr}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (!options?.returnBlobOnly) {
        saveAs(blob, fileName);
    }
    return { blob, fileName };
};
