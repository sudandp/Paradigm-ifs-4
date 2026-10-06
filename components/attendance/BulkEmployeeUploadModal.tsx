import React, { useState, useRef } from 'react';
import ExcelJS from 'exceljs';
import { saveAsHybrid as saveAs } from '../../utils/fileDownloader';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Check,
  RefreshCw
} from 'lucide-react';
import {
  saveBulkCorrectionsToSupabase,
  bulkUpdateMssqlEmployees,
  AttendanceCorrectionRecord,
  BulkEmployeeUpdatePayload
} from '../../services/accessControlSupabase';

interface EmployeeContextItem {
  empCode: string;
  empName: string;
  department?: string;
  designation?: string;
  shiftName?: string;
  company?: string;
}

interface BulkEmployeeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeContextItem[];
  departmentList?: string[];
  availableShifts?: { code: string; name: string; timing?: string }[];
  selectedDate: string;
  currentUserEmail: string;
  onSuccess: (updatedOverrides: Record<string, any>) => void;
}

interface ParsedEmployeeRow {
  empCode: string;
  empName?: string;
  site?: string;
  department?: string;
  designation?: string;
  shiftName?: string;
  company?: string;
  isMatched: boolean;
  matchedName?: string;
}

export const BulkEmployeeUploadModal: React.FC<BulkEmployeeUploadModalProps> = ({
  isOpen,
  onClose,
  employees,
  departmentList,
  availableShifts,
  selectedDate,
  currentUserEmail,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncToEssl, setSyncToEssl] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  /**
   * Downloads a Blob by converting to Data URL (base64) first.
   * This guarantees Chromium/Windows NEVER falls back to an internal Blob UUID without extension!
   */
  const downloadBlobReliably = (blob: Blob, fileName: string) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const link = document.createElement('a');
          link.style.display = 'none';
          link.href = reader.result;
          link.download = fileName;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            try {
              if (link.parentNode) document.body.removeChild(link);
            } catch {}
          }, 1000);
        } else {
          saveAs(blob, fileName);
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      saveAs(blob, fileName);
    }
  };

  // ── Download Excel Template with Locked Columns & Dropdown Validations ──────
  const handleDownloadExcelTemplate = async (isPrefilled: boolean) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Employee Mappings');

      // 1. Compile clean Reference Lists for data validation dropdowns
      const defaultDepts = ['MEP', 'Housekeeping', 'Security', 'Administration', 'Garden', 'Front Office', 'Operations'];
      const deptList = Array.from(new Set([
        ...defaultDepts,
        ...(departmentList || []),
        ...employees.map(e => e.department || '').filter(Boolean),
      ])).filter(d => d.trim().length > 0);

      const defaultDesigs = [
        'Staff', 'Supervisor', 'Technician', 'Electrician', 'Plumber',
        'Housekeeping Staff', 'Housekeeping Supervisor', 'Security Guard',
        'Head Guard', 'Gunman', 'Field Officer', 'Admin Executive',
        'Site Incharge', 'Manager', 'Garden Staff', 'Multi-Technician', 'STP Operator'
      ];
      const desigList = Array.from(new Set([
        ...defaultDesigs,
        ...employees.map(e => e.designation || '').filter(Boolean),
      ])).filter(d => d.trim().length > 0);

      const defaultShifts = [
        'A Shift Group',
        'B Shift Group',
        'C Shift Group',
        'ABC Rotational Shift Group',
        'General Shift Group',
        'HK Morning Shift',
        'HK General Shift',
        'Garden Shift Group',
        'Security Day Duty (12h)',
        'Security Night Duty (12h)',
      ];
      const shiftNameList = Array.from(new Set([
        ...(availableShifts || []).map(s => s.name || s.code).filter(Boolean),
        ...defaultShifts,
        ...employees.map(e => e.shiftName || '').filter(Boolean),
      ])).filter(s => s.trim().length > 0);

      const defaultCompanies = [
        'Paradigm Services',
        'Southwall Security',
        'Paradigm Facility Management Services',
      ];
      const companyList = Array.from(new Set([
        ...defaultCompanies,
        ...employees.map(e => e.company || '').filter(Boolean),
      ])).filter(c => c.trim().length > 0);

      // 2. Add hidden _ReferenceLists sheet for data validation source
      const refSheet = workbook.addWorksheet('_ReferenceLists');
      refSheet.state = 'hidden';
      const maxRows = Math.max(deptList.length, desigList.length, shiftNameList.length, companyList.length);
      for (let i = 0; i < maxRows; i++) {
        refSheet.addRow([
          deptList[i] || '',
          desigList[i] || '',
          shiftNameList[i] || '',
          companyList[i] || '',
        ]);
      }

      // 3. Setup Columns
      worksheet.columns = [
        { header: 'Biometric Code (Read-Only 🔒)', key: 'empCode', width: 25 },
        { header: 'Employee Name (Read-Only 🔒)', key: 'empName', width: 28 },
        { header: 'Site Name (Read-Only 🔒)', key: 'site', width: 24 },
        { header: 'Department (Select Dropdown ▼)', key: 'department', width: 26 },
        { header: 'Designation (Select Dropdown ▼)', key: 'designation', width: 28 },
        { header: 'Assigned Shift Name (Select Dropdown ▼)', key: 'shiftName', width: 36 },
        { header: 'Company Name (Select Dropdown ▼)', key: 'company', width: 28 },
      ];

      // Format Header Row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      // Columns 1-3: Slate / Dark Gray (Read-Only Header)
      for (let c = 1; c <= 3; c++) {
        const cell = headerRow.getCell(c);
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF334155' }, // Slate 700
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      // Columns 4-7: Forest Green (Editable Dropdown Header)
      for (let c = 4; c <= 7; c++) {
        const cell = headerRow.getCell(c);
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF006B3F' }, // Forest Green
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      const thinBorder: any = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      const targetList = (isPrefilled && employees.length > 0) ? employees : [
        {
          empCode: '31001',
          empName: 'Sample Staff',
          department: 'MEP',
          designation: 'Technician',
          shiftName: 'A Shift Group',
          company: 'Paradigm Services',
        }
      ];

      targetList.forEach(emp => {
        const row = worksheet.addRow({
          empCode: emp.empCode,
          empName: emp.empName,
          site: emp.department || 'Parkwest',
          department: emp.department || 'MEP',
          designation: emp.designation || 'Staff',
          shiftName: emp.shiftName || 'General Shift Group',
          company: emp.company || 'Paradigm Services',
        });
        row.height = 22;

        // Columns 1-3: Read-Only (Locked)
        for (let c = 1; c <= 3; c++) {
          const cell = row.getCell(c);
          cell.protection = { locked: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
          cell.font = { color: { argb: 'FF475569' }, size: 10 };
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'center' : 'left' };
        }

        // Columns 4-7: Editable with Dropdowns (Unlocked, soft yellow tint)
        for (let c = 4; c <= 7; c++) {
          const cell = row.getCell(c);
          cell.protection = { locked: false };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFDE7' }, // Soft yellow
          };
          cell.font = { color: { argb: 'FF0F172A' }, bold: true, size: 10 };
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }

        // Attach Dropdown Data Validations
        row.getCell(4).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_ReferenceLists!$A$1:$A$${deptList.length}`],
          showErrorMessage: true,
          errorTitle: 'Invalid Department',
          error: 'Please select an approved Department from the dropdown menu.',
        };

        row.getCell(5).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_ReferenceLists!$B$1:$B$${desigList.length}`],
          showErrorMessage: true,
          errorTitle: 'Invalid Designation',
          error: 'Please select an approved Designation from the dropdown menu.',
        };

        row.getCell(6).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_ReferenceLists!$C$1:$C$${shiftNameList.length}`],
          showErrorMessage: true,
          errorTitle: 'Invalid Shift',
          error: 'Please select an approved Shift from the dropdown menu.',
        };

        row.getCell(7).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_ReferenceLists!$D$1:$D$${companyList.length}`],
          showErrorMessage: true,
          errorTitle: 'Invalid Company',
          error: 'Please select an approved Company from the dropdown menu.',
        };
      });

      // 🛡️ Enforce Worksheet Protection so locked cells are read-only
      await worksheet.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: true,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        insertHyperlinks: false,
        deleteColumns: false,
        deleteRows: false,
        sort: true,
        autoFilter: true,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const filename = isPrefilled
        ? `Paradigm Staff Template ${selectedDate}.xlsx`
        : `Paradigm Blank Staff Template.xlsx`;

      downloadBlobReliably(blob, filename);
    } catch (err: any) {
      console.error('[BulkUpload] Excel template download error:', err);
      setErrorMessage('Could not generate Excel template.');
    }
  };

  // ── Download CSV Template ───────────────────────────────────────────────────
  const handleDownloadCsvTemplate = (isPrefilled: boolean) => {
    try {
      const headers = [
        'Biometric Code (Read-Only 🔒)',
        'Employee Name (Read-Only 🔒)',
        'Site Name (Read-Only 🔒)',
        'Department',
        'Designation',
        'Assigned Shift Name',
        'Company Name',
      ];

      const csvRows = [headers.join(',')];
      const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

      const targetList = (isPrefilled && employees.length > 0) ? employees : [
        {
          empCode: '31001',
          empName: 'Sample Staff',
          department: 'MEP',
          designation: 'Technician',
          shiftName: 'A Shift Group',
          company: 'Paradigm Services',
        }
      ];

      targetList.forEach(emp => {
        csvRows.push([
          escapeCsv(emp.empCode),
          escapeCsv(emp.empName),
          escapeCsv(emp.department || 'Parkwest'),
          escapeCsv(emp.department || 'MEP'),
          escapeCsv(emp.designation || 'Staff'),
          escapeCsv(emp.shiftName || 'General Shift Group'),
          escapeCsv(emp.company || 'Paradigm Services'),
        ].join(','));
      });

      const csvString = '\uFEFF' + csvRows.join('\r\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const filename = isPrefilled
        ? `Paradigm Staff Template ${selectedDate}.csv`
        : `Paradigm Blank Staff Template.csv`;

      downloadBlobReliably(blob, filename);
    } catch (err: any) {
      console.error('[BulkUpload] CSV download error:', err);
      setErrorMessage('Could not generate CSV template.');
    }
  };

  // ── Parse Uploaded File (XLSX, XLS, or CSV) ─────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsParsing(true);
    setErrorMessage(null);
    setParsedRows([]);

    try {
      const isCsv = selectedFile.name.toLowerCase().endsWith('.csv') || selectedFile.type.includes('csv');
      const employeeMap = new Map<string, EmployeeContextItem>();
      employees.forEach(emp => {
        employeeMap.set(String(emp.empCode).trim().toLowerCase(), emp);
        employeeMap.set(String(emp.empCode).trim().toLowerCase().replace(/^0+/, ''), emp);
      });

      const rows: ParsedEmployeeRow[] = [];

      if (isCsv) {
        // Parse CSV with quotation and comma handling
        const text = await selectedFile.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) throw new Error('CSV file is empty or missing data rows.');

        const parseCsvLine = (line: string): string[] => {
          const cells: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === ',' && !inQuotes) {
              cells.push(cur.trim());
              cur = '';
            } else {
              cur += ch;
            }
          }
          cells.push(cur.trim());
          return cells;
        };

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
        const colMap: Record<string, number> = {};
        headers.forEach((h, idx) => {
          if (h.includes('code') || h.includes('biometric') || h.includes('emp_code')) colMap['empCode'] = idx;
          else if (h.includes('name') && !h.includes('company') && !h.includes('site') && !h.includes('shift')) colMap['empName'] = idx;
          else if (h.includes('site')) colMap['site'] = idx;
          else if (h.includes('dept') || h.includes('department')) colMap['department'] = idx;
          else if (h.includes('desig') || h.includes('designation') || h.includes('role')) colMap['designation'] = idx;
          else if (h.includes('shift')) colMap['shiftName'] = idx;
          else if (h.includes('company')) colMap['company'] = idx;
        });

        if (colMap['empCode'] === undefined) colMap['empCode'] = 0;
        if (colMap['empName'] === undefined) colMap['empName'] = 1;
        if (colMap['site'] === undefined) colMap['site'] = 2;
        if (colMap['department'] === undefined) colMap['department'] = 3;
        if (colMap['designation'] === undefined) colMap['designation'] = 4;
        if (colMap['shiftName'] === undefined) colMap['shiftName'] = 5;
        if (colMap['company'] === undefined) colMap['company'] = 6;

        for (let i = 1; i < lines.length; i++) {
          const cells = parseCsvLine(lines[i]);
          const rawCode = (cells[colMap['empCode']] || '').trim();
          const cleanCode = rawCode.replace(/^#+/, '');
          if (!cleanCode) continue;

          const matchedEmp = employeeMap.get(cleanCode.toLowerCase()) || employeeMap.get(cleanCode.toLowerCase().replace(/^0+/, ''));

          rows.push({
            empCode: cleanCode,
            empName: (cells[colMap['empName']] || '').trim() || matchedEmp?.empName,
            site: (cells[colMap['site']] || '').trim() || matchedEmp?.department,
            department: (cells[colMap['department']] || '').trim() || matchedEmp?.department,
            designation: (cells[colMap['designation']] || '').trim() || matchedEmp?.designation,
            shiftName: (cells[colMap['shiftName']] || '').trim() || matchedEmp?.shiftName,
            company: (cells[colMap['company']] || '').trim() || matchedEmp?.company,
            isMatched: Boolean(matchedEmp),
            matchedName: matchedEmp?.empName,
          });
        }
      } else {
        // Parse XLSX / XLS using ExcelJS
        const buffer = await selectedFile.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          throw new Error('The uploaded workbook has no sheets.');
        }

        const colMap: Record<string, number> = {};
        const firstRow = worksheet.getRow(1);
        firstRow.eachCell((cell, colNumber) => {
          const val = String(cell.value || '').toLowerCase().trim();
          if (val.includes('code') || val.includes('emp_code') || val.includes('biometric')) colMap['empCode'] = colNumber;
          else if (val.includes('name') && !val.includes('company') && !val.includes('site') && !val.includes('shift')) colMap['empName'] = colNumber;
          else if (val.includes('site')) colMap['site'] = colNumber;
          else if (val.includes('dept') || val.includes('department')) colMap['department'] = colNumber;
          else if (val.includes('desig') || val.includes('designation') || val.includes('role')) colMap['designation'] = colNumber;
          else if (val.includes('shift')) colMap['shiftName'] = colNumber;
          else if (val.includes('company')) colMap['company'] = colNumber;
        });

        // Fallback column indexing
        if (!colMap['empCode']) colMap['empCode'] = 1;
        if (!colMap['empName']) colMap['empName'] = 2;
        if (!colMap['site']) colMap['site'] = 3;
        if (!colMap['department']) colMap['department'] = 4;
        if (!colMap['designation']) colMap['designation'] = 5;
        if (!colMap['shiftName']) colMap['shiftName'] = 6;
        if (!colMap['company']) colMap['company'] = 7;

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header

          const rawCode = row.getCell(colMap['empCode']).text || String(row.getCell(colMap['empCode']).value || '');
          const cleanCode = rawCode.trim().replace(/^#+/, '');
          if (!cleanCode) return;

          const matchedEmp = employeeMap.get(cleanCode.toLowerCase()) || employeeMap.get(cleanCode.toLowerCase().replace(/^0+/, ''));

          rows.push({
            empCode: cleanCode,
            empName: (row.getCell(colMap['empName']).text || String(row.getCell(colMap['empName']).value || '')).trim() || matchedEmp?.empName,
            site: (row.getCell(colMap['site']).text || String(row.getCell(colMap['site']).value || '')).trim() || matchedEmp?.department,
            department: (row.getCell(colMap['department']).text || String(row.getCell(colMap['department']).value || '')).trim() || matchedEmp?.department,
            designation: (row.getCell(colMap['designation']).text || String(row.getCell(colMap['designation']).value || '')).trim() || matchedEmp?.designation,
            shiftName: (row.getCell(colMap['shiftName']).text || String(row.getCell(colMap['shiftName']).value || '')).trim() || matchedEmp?.shiftName,
            company: (row.getCell(colMap['company']).text || String(row.getCell(colMap['company']).value || '')).trim() || matchedEmp?.company,
            isMatched: Boolean(matchedEmp),
            matchedName: matchedEmp?.empName,
          });
        });
      }

      if (rows.length === 0) {
        throw new Error('No valid employee rows found in spreadsheet. Ensure Column A contains Biometric Codes.');
      }

      setParsedRows(rows);
    } catch (err: any) {
      console.error('[BulkUpload] Parse error:', err);
      setErrorMessage(err.message || 'Failed to parse spreadsheet file.');
    } finally {
      setIsParsing(false);
    }
  };

  // ── Apply Bulk Updates to Supabase and eSSL MSSQL ───────────────────────────
  const handleApplyUpdates = async () => {
    if (parsedRows.length === 0) return;

    setIsApplying(true);
    setErrorMessage(null);
    setProgressStatus(`Applying updates for ${parsedRows.length} employees...`);

    try {
      const now = new Date().toISOString();
      const updatedOverrides: Record<string, any> = {};
      const corrections: AttendanceCorrectionRecord[] = [];
      const mssqlUpdates: BulkEmployeeUpdatePayload[] = [];

      for (const row of parsedRows) {
        const empCode = row.empCode;
        const empName = row.matchedName || row.empName || `Staff ${empCode}`;

        const overrideEntry: any = {};
        if (row.site) overrideEntry.site = row.site;
        if (row.department) overrideEntry.departmentOverride = row.department;
        if (row.designation) overrideEntry.designation = row.designation;
        if (row.shiftName) overrideEntry.shiftName = row.shiftName;
        if (row.company) overrideEntry.company = row.company;

        updatedOverrides[empCode] = overrideEntry;

        corrections.push({
          id: `corr-${empCode}-${selectedDate}`,
          empCode,
          empName,
          attendanceDate: selectedDate,
          site: row.site,
          department: row.department,
          designation: row.designation,
          shiftName: row.shiftName,
          company: row.company,
          correctedBy: currentUserEmail || 'admin@paradigmfms.com',
          correctedAt: now,
        });

        if (syncToEssl) {
          mssqlUpdates.push({
            empCode,
            empName,
            siteName: row.site,
            department: row.department,
            designation: row.designation,
            shiftName: row.shiftName,
            companyName: row.company,
          });
        }
      }

      // Step 1: Save to Supabase Cloud
      setProgressStatus(`Syncing ${parsedRows.length} rows to Supabase Cloud...`);
      await saveBulkCorrectionsToSupabase(corrections);

      // Step 2: Sync to eSSL MSSQL
      if (syncToEssl && mssqlUpdates.length > 0) {
        setProgressStatus(`Syncing ${parsedRows.length} rows to eSSL MSSQL database (dbo.Employees)...`);
        await bulkUpdateMssqlEmployees(mssqlUpdates);
      }

      onSuccess(updatedOverrides);
      onClose();
    } catch (err: any) {
      console.error('[BulkUpload] Apply error:', err);
      setErrorMessage(err.message || 'Failed to apply spreadsheet updates.');
    } finally {
      setIsApplying(false);
      setProgressStatus(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#134426] flex items-center justify-between bg-slate-50 dark:bg-[#041b0f]/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-[#44D62C] border border-emerald-300 dark:border-emerald-800">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                Bulk Employee Upload (Excel / CSV)
              </h3>
              <p className="text-xs text-slate-500 dark:text-emerald-300/70 mt-0.5">
                Download a pre-filled Excel template, edit site/department/shift/designation in bulk, and re-upload.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#0d3820] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Template Download Options */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-[#134426] bg-slate-50/50 dark:bg-[#041b0f]/40 space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Download size={14} className="text-emerald-600 dark:text-[#44D62C]" />
                  Step 1: Download Template
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-emerald-300/70 mt-0.5">
                  Get an Excel file formatted with all required columns and dropdown selectors.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleDownloadExcelTemplate(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-black text-white bg-[#006B3F] hover:bg-[#005632] shadow-sm transition-all cursor-pointer flex items-center gap-1.5 flex-1 sm:flex-initial"
                  title="Download Microsoft Excel spreadsheet with locked read-only columns and dropdown pickers"
                >
                  <FileSpreadsheet size={14} />
                  <span>Pre-filled Staff ({employees.length})</span>
                  <span className="text-[9px] bg-amber-400 text-amber-950 font-extrabold px-1.5 py-0.5 rounded-full">⭐ Dropdowns</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadCsvTemplate(true)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-emerald-200 bg-slate-200 hover:bg-slate-300 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-slate-300 dark:border-emerald-800 transition-colors cursor-pointer flex items-center gap-1.5 flex-1 sm:flex-initial"
                  title="Download raw CSV file"
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadExcelTemplate(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-emerald-200 bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#1a5532] hover:bg-slate-50 dark:hover:bg-[#0d3820] transition-colors cursor-pointer flex items-center gap-1.5 flex-1 sm:flex-initial"
                >
                  <span>Blank Template</span>
                </button>
              </div>
            </div>

            {/* Info Pills: Locked vs Dropdowns */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-[#134426]/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-[#061e11] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1a4a2e]">
                <span className="w-5 h-5 rounded-lg bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0">🔒</span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">Red Box (Locked):</span>
                  <span className="ml-1 text-slate-600 dark:text-slate-400">Biometric Code, Name & Site cannot be modified</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                <span className="w-5 h-5 rounded-lg bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">▼</span>
                <div>
                  <span className="font-bold text-amber-950 dark:text-amber-200">Yellow Box (Dropdown Only):</span>
                  <span className="ml-1 text-amber-800 dark:text-amber-400">Department (MEP, HK, Security, Admin), Shift & Company</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Upload File Area */}
          <div className="rounded-xl border-2 border-dashed border-emerald-400 dark:border-[#1a5532] bg-emerald-50/20 dark:bg-[#0d3820]/20 flex flex-col items-center justify-center p-6 text-center">
            <Upload size={28} className="text-emerald-600 dark:text-[#44D62C] mb-2" />
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
              {file ? file.name : 'Choose an Excel or CSV file'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-emerald-300/70 mt-1 max-w-sm">
              Drag & drop your populated spreadsheet here or click to browse.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-[#44D62C] dark:text-[#041b0f] hover:opacity-90 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              {isParsing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Reading Spreadsheet...</span>
                </>
              ) : (
                <>
                  <Upload size={13} />
                  <span>{file ? 'Replace Spreadsheet File' : 'Select Spreadsheet File'}</span>
                </>
              )}
            </button>
          </div>

          {/* Step 3: Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-[#44D62C]" />
                  <span>Parsed {parsedRows.length} Employees</span>
                  <span className="text-slate-400 dark:text-emerald-400/60 font-normal">
                    ({parsedRows.filter(r => r.isMatched).length} matched in current workforce)
                  </span>
                </h4>
              </div>

              <div className="border border-slate-200 dark:border-[#134426] rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-[#041b0f] border-b border-slate-200 dark:border-[#134426] text-[10px] uppercase font-bold text-slate-500 dark:text-emerald-300/70 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Site</th>
                      <th className="px-3 py-2">Department</th>
                      <th className="px-3 py-2">Designation</th>
                      <th className="px-3 py-2">Shift</th>
                      <th className="px-3 py-2">Company</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#134426] font-medium text-slate-700 dark:text-emerald-100">
                    {parsedRows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-[#0d3820]">
                        <td className="px-3 py-1.5 font-mono font-bold text-emerald-700 dark:text-[#44D62C]">
                          #{row.empCode}
                        </td>
                        <td className="px-3 py-1.5 truncate max-w-[120px]">
                          {row.matchedName || row.empName || 'Staff'}
                        </td>
                        <td className="px-3 py-1.5 truncate max-w-[120px] font-semibold">
                          {row.site || '—'}
                        </td>
                        <td className="px-3 py-1.5 truncate max-w-[110px]">
                          {row.department || '—'}
                        </td>
                        <td className="px-3 py-1.5 truncate max-w-[120px]">
                          {row.designation || '—'}
                        </td>
                        <td className="px-3 py-1.5 truncate max-w-[120px]">
                          {row.shiftName || '—'}
                        </td>
                        <td className="px-3 py-1.5 truncate max-w-[120px]">
                          {row.company || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* eSSL Sync Checkbox */}
          <div className="p-3 rounded-xl border border-emerald-300 dark:border-[#1a5532] bg-emerald-50/60 dark:bg-[#041b0f]/80 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="syncToEsslUpload"
              checked={syncToEssl}
              onChange={e => setSyncToEssl(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#44D62C]"
            />
            <label htmlFor="syncToEsslUpload" className="text-xs cursor-pointer select-none">
              <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600 dark:text-[#44D62C]" />
                Update eSSL MSSQL (`dbo.Employees`) and Supabase Cloud simultaneously
              </span>
              <span className="block text-slate-500 dark:text-emerald-300/70 text-[11px] mt-0.5">
                Both remote hardware database and Cloud Dashboards will be updated from this spreadsheet.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-[#134426] bg-slate-50 dark:bg-[#041b0f]/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-emerald-300/70 flex items-center gap-1.5">
            {isApplying && <Loader2 size={13} className="animate-spin text-emerald-600 dark:text-[#44D62C]" />}
            <span>{progressStatus || (parsedRows.length > 0 ? `Ready to apply ${parsedRows.length} updates` : 'Awaiting spreadsheet upload')}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-emerald-200 bg-white dark:bg-[#0d3820] border border-slate-200 dark:border-[#1a5532] hover:bg-slate-50 dark:hover:bg-[#1a5532] transition-colors cursor-pointer flex-1 sm:flex-initial"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyUpdates}
              disabled={isApplying || parsedRows.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-[#041b0f] bg-[#44D62C] hover:bg-[#38b824] shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 flex-1 sm:flex-initial disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Applying Spreadsheet...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Apply Updates ({parsedRows.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
