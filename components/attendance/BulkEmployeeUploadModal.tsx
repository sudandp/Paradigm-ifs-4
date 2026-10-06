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
  ArrowRight,
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

  // ── Download Excel Template ─────────────────────────────────────────────────
  const handleDownloadTemplate = async (isPrefilled: boolean) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Employee Mappings');

      // Setup Headers
      worksheet.columns = [
        { header: 'Biometric Code (Required)', key: 'empCode', width: 22 },
        { header: 'Employee Name (Reference)', key: 'empName', width: 28 },
        { header: 'Site Name', key: 'site', width: 26 },
        { header: 'Department', key: 'department', width: 24 },
        { header: 'Designation', key: 'designation', width: 26 },
        { header: 'Shift Name', key: 'shiftName', width: 26 },
        { header: 'Company Name', key: 'company', width: 24 },
      ];

      // Format Header Row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF006B3F' }, // Paradigm Forest Green
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 24;

      if (isPrefilled && employees.length > 0) {
        employees.forEach(emp => {
          worksheet.addRow({
            empCode: emp.empCode,
            empName: emp.empName,
            site: emp.department || 'Parkwest',
            department: 'Housekeeping',
            designation: emp.designation || 'Housekeeping Staff',
            shiftName: emp.shiftName || 'General Shift Group',
            company: emp.company || 'Paradigm Services',
          });
        });
      } else {
        // Sample dummy row
        worksheet.addRow({
          empCode: '46001',
          empName: 'Sample Staff',
          site: 'Parkwest',
          department: 'Housekeeping',
          designation: 'Housekeeping Staff',
          shiftName: 'General Shift Group',
          company: 'Paradigm Services',
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const filename = isPrefilled
        ? `Paradigm_Staff_Template_${selectedDate}.xlsx`
        : `Paradigm_Bulk_Upload_Blank_Template.xlsx`;

      saveAs(blob, filename);
    } catch (err: any) {
      console.error('[BulkUpload] Template download error:', err);
      setErrorMessage('Could not generate Excel template.');
    }
  };

  // ── Parse Uploaded File ─────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsParsing(true);
    setErrorMessage(null);
    setParsedRows([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('The uploaded workbook has no sheets.');
      }

      const rows: ParsedEmployeeRow[] = [];
      const colMap: Record<string, number> = {};

      // Analyze Header Row (Row 1)
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

      // Fallback column indexing if headers were slightly different
      if (!colMap['empCode']) colMap['empCode'] = 1;
      if (!colMap['empName']) colMap['empName'] = 2;
      if (!colMap['site']) colMap['site'] = 3;
      if (!colMap['department']) colMap['department'] = 4;
      if (!colMap['designation']) colMap['designation'] = 5;
      if (!colMap['shiftName']) colMap['shiftName'] = 6;
      if (!colMap['company']) colMap['company'] = 7;

      const employeeMap = new Map<string, EmployeeContextItem>();
      employees.forEach(emp => employeeMap.set(String(emp.empCode).trim(), emp));

      // Parse Data Rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const rawCode = row.getCell(colMap['empCode']).text || String(row.getCell(colMap['empCode']).value || '');
        const cleanCode = rawCode.trim().replace(/^#+/, '');
        if (!cleanCode) return;

        const matchedEmp = employeeMap.get(cleanCode);

        const rowData: ParsedEmployeeRow = {
          empCode: cleanCode,
          empName: row.getCell(colMap['empName']).text || String(row.getCell(colMap['empName']).value || '').trim() || undefined,
          site: row.getCell(colMap['site']).text || String(row.getCell(colMap['site']).value || '').trim() || undefined,
          department: row.getCell(colMap['department']).text || String(row.getCell(colMap['department']).value || '').trim() || undefined,
          designation: row.getCell(colMap['designation']).text || String(row.getCell(colMap['designation']).value || '').trim() || undefined,
          shiftName: row.getCell(colMap['shiftName']).text || String(row.getCell(colMap['shiftName']).value || '').trim() || undefined,
          company: row.getCell(colMap['company']).text || String(row.getCell(colMap['company']).value || '').trim() || undefined,
          isMatched: Boolean(matchedEmp),
          matchedName: matchedEmp?.empName,
        };

        rows.push(rowData);
      });

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

  // ── Apply Bulk Updates ──────────────────────────────────────────────────────
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
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#134426] bg-slate-50/50 dark:bg-[#041b0f]/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h4 className="font-extrabold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                <Download size={14} className="text-emerald-600 dark:text-[#44D62C]" />
                Step 1: Download Template
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-emerald-300/70 mt-0.5">
                Get an Excel file formatted with all required columns.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleDownloadTemplate(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 dark:text-[#44D62C] bg-emerald-100 dark:bg-[#0d3820] border border-emerald-300 dark:border-[#1a5532] hover:bg-emerald-200 dark:hover:bg-[#1a5532] transition-colors cursor-pointer flex items-center gap-1.5 flex-1 sm:flex-initial"
              >
                <FileSpreadsheet size={13} />
                <span>Pre-filled Staff ({employees.length})</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-emerald-200 bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#1a5532] hover:bg-slate-50 dark:hover:bg-[#0d3820] transition-colors cursor-pointer flex items-center gap-1.5 flex-1 sm:flex-initial"
              >
                <span>Blank Template</span>
              </button>
            </div>
          </div>

          {/* Step 2: Upload File Area */}
          <div className="p-3.5 rounded-xl border border-dashed border-emerald-400 dark:border-[#1a5532] bg-emerald-50/20 dark:bg-[#0d3820]/20 flex flex-col items-center justify-center p-6 text-center">
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
