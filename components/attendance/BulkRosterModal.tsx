import React, { useState, useMemo, useRef } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths,
} from "date-fns";
import ExcelJS from "exceljs";
import {
  X, Users, Calendar, Check, Sparkles,
  Shield, BookOpen, ChevronRight, CheckCircle2,
  FileSpreadsheet, Download, Upload, Loader2,
  AlertCircle, RefreshCw, Clock
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
export interface BulkRosterTargetEmployee {
  empCode: string;
  empName: string;
  department?: string;
  designation?: string;
  site?: string;
  shiftName?: string;
  shiftCode?: string;
  status?: string;
  lifecycleStatus?: string;
  employmentStatus?: string;
  isActiveEmployee?: boolean | string;
  isActive?: boolean;
}

export interface AvailableShiftOption {
  code: string;
  name: string;
  timing?: string;
}

export interface BulkRosterAssignmentResult {
  weeklyOffsByEmpCode: Record<string, string[]>;
  shiftOverridesByEmpCode?: Record<string, { shiftName?: string; shiftCode?: string }>;
  holidayDates: string[];
  affectedCount: number;
  scope: string;
}

interface CategoryOption {
  key: string;
  label: string;
  color: string;
  bgSel: string;
  border: string;
  emoji: string;
  matchFn: (emp: BulkRosterTargetEmployee) => boolean;
}

interface BulkRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: BulkRosterTargetEmployee[];
  departmentList: string[];
  availableShifts?: AvailableShiftOption[];
  existingWeeklyOffsMap: Record<string, string[]>;
  existingOverrides?: Record<string, any>;
  selectedDate?: string;
  currentUserEmail?: string;
  onSave: (
    result: BulkRosterAssignmentResult,
    updatedWOMap: Record<string, string[]>,
    updatedShiftOverrides?: Record<string, any>
  ) => Promise<void> | void;
}

// ─────────────────────────────────────────────────────────────────────────────
const DEPT_CATEGORIES: CategoryOption[] = [
  {
    key: "all", label: "All Employees", emoji: "🌐",
    color: "text-slate-700 dark:text-slate-200",
    bgSel: "bg-slate-800 text-white border-transparent",
    border: "border-slate-300 dark:border-slate-600",
    matchFn: () => true,
  },
  {
    key: "security", label: "Security", emoji: "🛡️",
    color: "text-blue-700 dark:text-blue-300",
    bgSel: "bg-blue-700 text-white border-transparent",
    border: "border-blue-300 dark:border-blue-700",
    matchFn: (e) => {
      const d = (e.designation || "").toLowerCase();
      const code = (e.empCode || "").replace(/\D/g, "");
      return code.startsWith("32") || ["security","guard","gunman","aso","supervisor","field officer"].some(k => d.includes(k));
    },
  },
  {
    key: "mep", label: "MEP / Technical", emoji: "🔧",
    color: "text-amber-700 dark:text-amber-300",
    bgSel: "bg-amber-600 text-white border-transparent",
    border: "border-amber-300 dark:border-amber-700",
    matchFn: (e) => {
      const d = (e.designation || "").toLowerCase();
      const code = (e.empCode || "").replace(/\D/g, "");
      return code.startsWith("31") || ["electrician","plumber","tech","mep","stp","wtp","pool","multi","helper"].some(k => d.includes(k));
    },
  },
  {
    key: "housekeeping", label: "Housekeeping", emoji: "🧹",
    color: "text-emerald-700 dark:text-emerald-300",
    bgSel: "bg-emerald-700 text-white border-transparent",
    border: "border-emerald-300 dark:border-emerald-700",
    matchFn: (e) => {
      const d = (e.designation || "").toLowerCase();
      return ["housekeep","hk","cleaner","sweeper","pantry","lady"].some(k => d.includes(k));
    },
  },
  {
    key: "garden", label: "Garden", emoji: "🌿",
    color: "text-teal-700 dark:text-teal-300",
    bgSel: "bg-teal-700 text-white border-transparent",
    border: "border-teal-300 dark:border-teal-700",
    matchFn: (e) => {
      const d = (e.designation || "").toLowerCase();
      return ["garden","horticulture","landscape","weeder","plant"].some(k => d.includes(k));
    },
  },
  {
    key: "admin", label: "Administration", emoji: "👔",
    color: "text-indigo-700 dark:text-indigo-300",
    bgSel: "bg-indigo-700 text-white border-transparent",
    border: "border-indigo-300 dark:border-indigo-700",
    matchFn: (e) => {
      const d = (e.designation || "").toLowerCase();
      return ["manager","officer","admin","hr","accountant","executive","coordinator"].some(k => d.includes(k));
    },
  },
];

const WEEKDAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEKDAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/**
 * Filter strictly inactive / separated personnel.
 * Active deployed employees (even if absent today or pending punch) MUST NOT be excluded.
 */
export const isBulkEmployeeInactive = (emp: BulkRosterTargetEmployee): boolean => {
  if (!emp) return true;
  const s = String(emp.status || '').toLowerCase().trim();
  const l = String(emp.lifecycleStatus || '').toLowerCase().trim();
  const es = String(emp.employmentStatus || '').toLowerCase().trim();
  const separatedStatuses = [
    'discontinued', 'discontinued / left', 'left',
    'resigned', 'terminated', 'absconded', 'not joined yet',
    'not joined', 'exit', 'relieved', 'separated', 'disabled', 'deactivated'
  ];
  if (separatedStatuses.includes(l) || separatedStatuses.includes(es)) {
    return true;
  }
  if (['discontinued', 'left', 'terminated', 'resigned', 'absconded'].includes(s)) {
    return true;
  }
  if (emp.isActive === false || (emp as any).is_active === false || (emp as any).active === false) {
    return true;
  }
  return false;
};

/**
 * Helper to convert weekday string (e.g. "Sunday" or "Sun, Wed") or date list into YYYY-MM-DD date strings for targetMonth.
 */
function parseWeeklyOffToDates(woInput: string, targetMonth: Date): string[] {
  if (!woInput) return [];
  const raw = String(woInput).trim().toLowerCase();
  const mStart = startOfMonth(targetMonth);
  const mEnd = endOfMonth(targetMonth);
  const daysInM = eachDayOfInterval({ start: mStart, end: mEnd });

  const dayNameMap: Record<string, number> = {
    'sun': 0, 'sunday': 0,
    'mon': 1, 'monday': 1,
    'tue': 2, 'tues': 2, 'tuesday': 2,
    'wed': 3, 'wednesday': 3,
    'thu': 4, 'thur': 4, 'thurs': 4, 'thursday': 4,
    'fri': 5, 'friday': 5,
    'sat': 6, 'saturday': 6,
  };

  const matchedWeekdays = new Set<number>();
  const customDates = new Set<string>();

  const parts = raw.split(/[,;\/]+/).map(p => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (dayNameMap[p] !== undefined) {
      matchedWeekdays.add(dayNameMap[p]);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
      customDates.add(p);
    } else if (/^\d{1,2}$/.test(p)) {
      const dayNum = parseInt(p, 10);
      if (dayNum >= 1 && dayNum <= 31) {
        customDates.add(`${format(targetMonth, 'yyyy-MM')}-${String(dayNum).padStart(2, '0')}`);
      }
    }
  }

  daysInM.forEach(d => {
    if (matchedWeekdays.has(getDay(d))) {
      customDates.add(format(d, 'yyyy-MM-dd'));
    }
  });

  return Array.from(customDates).sort();
}

interface ParsedExcelRosterRow {
  empCode: string;
  empName?: string;
  site?: string;
  department?: string;
  designation?: string;
  shiftName?: string;
  weeklyOffText?: string;
  matchedEmp?: BulkRosterTargetEmployee;
  isMatched: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
export const BulkRosterModal: React.FC<BulkRosterModalProps> = ({
  isOpen, onClose, employees, departmentList, availableShifts = [],
  existingWeeklyOffsMap, existingOverrides = {}, selectedDate, onSave,
}) => {
  // Method tab: "wizard" or "excel"
  const [activeMode, setActiveMode] = useState<"wizard" | "excel">("wizard");

  // Wizard state
  const [step, setStep] = useState<1|2|3>(1);
  const [scopeType, setScopeType] = useState<"category"|"site">("category");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSite, setSelectedSite] = useState("all");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // Shift assignment state
  const [assignedShift, setAssignedShift] = useState<string>("keep"); // "keep" or specific shift name

  // Week Off state
  const [woEnabled, setWoEnabled] = useState(true);
  const [selectedWoWeekdays, setSelectedWoWeekdays] = useState<Set<number>>(new Set([0])); // Sunday default
  const [mergeMode, setMergeMode] = useState<"merge"|"replace">("merge");

  // Holiday state
  const [holidayEnabled, setHolidayEnabled] = useState(false);
  const [holidayList, setHolidayList] = useState<{date:string;name:string}[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  // Excel state
  const [excelTargetSite, setExcelTargetSite] = useState("all");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelRows, setExcelRows] = useState<ParsedExcelRosterRow[]>([]);
  const [excelErrorMessage, setExcelErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // General state
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);
  const padDays = Array.from({ length: getDay(monthStart) });

  // Filter active workforce
  const activeEmployees = useMemo(() => {
    return employees.filter(e => !isBulkEmployeeInactive(e));
  }, [employees]);

  const targetSiteStaffCount = useMemo(() => {
    if (excelTargetSite === "all") return activeEmployees.length;
    return activeEmployees.filter(e => (e.site || e.department || "").toLowerCase().trim() === excelTargetSite.toLowerCase().trim()).length;
  }, [excelTargetSite, activeEmployees]);

  // Scoped employees for interactive wizard
  const scopedEmployees = useMemo(() => {
    if (scopeType === "site") {
      if (selectedSite === "all") return activeEmployees;
      return activeEmployees.filter(e => {
        const empSite = (e.site || e.department || "").toLowerCase().trim();
        return empSite === selectedSite.toLowerCase().trim();
      });
    }
    const cat = DEPT_CATEGORIES.find(c => c.key === selectedCategory);
    return cat ? activeEmployees.filter(cat.matchFn) : activeEmployees;
  }, [activeEmployees, scopeType, selectedCategory, selectedSite]);

  // Standard fallback shift options if none fed
  const shiftOptionsList = useMemo(() => {
    const list: AvailableShiftOption[] = [
      { code: "A", name: "Shift A (Morning 07:00 - 15:00)", timing: "07:00 AM - 03:00 PM" },
      { code: "B", name: "Shift B (Afternoon 14:00 - 22:00)", timing: "02:00 PM - 10:00 PM" },
      { code: "C", name: "Shift C (Night 21:00 - 07:00)", timing: "09:00 PM - 07:00 AM" },
      { code: "GEN", name: "General Shift (09:00 - 18:00)", timing: "09:00 AM - 06:00 PM" },
      { code: "DAY-12", name: "Security Day Duty (12h)", timing: "07:00 AM - 07:00 PM" },
      { code: "NIGHT-12", name: "Security Night Duty (12h)", timing: "07:00 PM - 07:00 AM" },
      { code: "HK-M", name: "Housekeeping Morning (07:00 - 16:00)", timing: "07:00 AM - 04:00 PM" },
      { code: "GAR", name: "Garden Shift (08:00 - 17:00)", timing: "08:00 AM - 05:00 PM" },
    ];
    if (availableShifts && availableShifts.length > 0) {
      availableShifts.forEach(s => {
        if (!list.some(x => x.code === s.code || x.name === s.name)) {
          list.push(s);
        }
      });
    }
    return list;
  }, [availableShifts]);

  // Selected week-off dates in the month
  const woDateStrings = useMemo(() => {
    const dates = new Set<string>();
    if (!woEnabled) return dates;
    monthDays.forEach(d => {
      if (selectedWoWeekdays.has(getDay(d))) dates.add(format(d, "yyyy-MM-dd"));
    });
    return dates;
  }, [monthDays, selectedWoWeekdays, woEnabled]);

  const toggleWoDay = (day: number) => setSelectedWoWeekdays(prev => {
    const next = new Set(prev);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    return next;
  });

  const addHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) return;
    setHolidayList(prev => [...prev.filter(h => h.date !== newHolidayDate), { date: newHolidayDate, name: newHolidayName.trim() }]);
    setNewHolidayDate(""); setNewHolidayName("");
  };

  // ── Save from Interactive Wizard ──────────────────────────────────────────
  const handleSaveWizard = async () => {
    if (!scopedEmployees.length) return;
    setIsSaving(true);
    try {
      const updatedWOMap = { ...existingWeeklyOffsMap };
      const updatedShiftOverrides = { ...existingOverrides };
      const woList = Array.from(woDateStrings);
      const monthStr = format(currentMonth, "yyyy-MM");

      scopedEmployees.forEach(emp => {
        const cleanCode = emp.empCode.toLowerCase().trim();
        const numCode = cleanCode.replace(/^0+/, "");

        // 1. Weekly Off Assignment
        if (woEnabled && woList.length > 0) {
          const existing = updatedWOMap[cleanCode] || updatedWOMap[numCode] || [];
          const base = mergeMode === "replace" ? existing.filter(d => !d.startsWith(monthStr)) : existing;
          const merged = Array.from(new Set([...base, ...woList])).sort();
          updatedWOMap[cleanCode] = merged;
          if (numCode !== cleanCode) updatedWOMap[numCode] = merged;
        }

        // 2. Shift Assignment (if not "keep")
        if (assignedShift && assignedShift !== "keep") {
          updatedShiftOverrides[emp.empCode] = {
            ...(updatedShiftOverrides[emp.empCode] || {}),
            empName: emp.empName,
            site: emp.site || emp.department,
            shiftName: assignedShift,
          };
        }
      });

      const scopeLabel = scopeType === "site"
        ? (selectedSite === "all" ? "All Sites" : selectedSite)
        : DEPT_CATEGORIES.find(c => c.key === selectedCategory)?.label || selectedCategory;

      const result: BulkRosterAssignmentResult = {
        weeklyOffsByEmpCode: updatedWOMap,
        shiftOverridesByEmpCode: updatedShiftOverrides,
        holidayDates: holidayList.map(h => h.date),
        affectedCount: scopedEmployees.length,
        scope: scopeLabel,
      };

      await onSave(result, updatedWOMap, updatedShiftOverrides);
      setSavedMsg(`Roster successfully applied for ${scopedEmployees.length} staff in "${scopeLabel}" (Month: ${format(currentMonth, "MMMM yyyy")})`);
      setStep(3);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Download Prefilled Excel Template ──────────────────────────────────────
  const handleDownloadExcelTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Roster Assignment");

      // 1. Compile clean Reference Lists from software & active employees
      const defaultDepts = ["MEP", "Housekeeping", "Security", "Administration", "Garden", "Front Office", "Operations"];
      const deptList = Array.from(new Set([
        ...defaultDepts,
        ...(departmentList || []),
        ...activeEmployees.map(e => e.department || "").filter(Boolean),
      ])).filter(d => d.trim().length > 0);

      const defaultDesigs = [
        "Staff", "Supervisor", "Technician", "Electrician", "Plumber",
        "Housekeeping Staff", "Housekeeping Supervisor", "Security Guard",
        "Head Guard", "Gunman", "Field Officer", "Admin Executive",
        "Site Incharge", "Manager", "Garden Staff", "Multi-Technician", "STP Operator"
      ];
      const desigList = Array.from(new Set([
        ...defaultDesigs,
        ...activeEmployees.map(e => e.designation || "").filter(Boolean),
      ])).filter(d => d.trim().length > 0);

      const defaultShifts = [
        "A Shift Group",
        "B Shift Group",
        "C Shift Group",
        "ABC Rotational Shift Group",
        "General Shift Group",
        "HK Morning Shift",
        "HK General Shift",
        "Garden Shift Group",
        "Security Day Duty (12h)",
        "Security Night Duty (12h)",
      ];
      const shiftNameList = Array.from(new Set([
        ...(availableShifts || []).map(s => s.name || s.code).filter(Boolean),
        ...defaultShifts,
        ...activeEmployees.map(e => e.shiftName || "").filter(Boolean),
      ])).filter(s => s.trim().length > 0);

      const weekDayList = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      // 2. Add hidden _ReferenceLists sheet for data validation source
      const refSheet = workbook.addWorksheet("_ReferenceLists");
      refSheet.state = "hidden";
      const maxRows = Math.max(deptList.length, desigList.length, shiftNameList.length, weekDayList.length);
      for (let i = 0; i < maxRows; i++) {
        refSheet.addRow([
          deptList[i] || "",
          desigList[i] || "",
          shiftNameList[i] || "",
          weekDayList[i] || "",
        ]);
      }

      worksheet.columns = [
        { header: "Biometric Code (Read-Only 🔒)", key: "empCode", width: 25 },
        { header: "Employee Name (Read-Only 🔒)", key: "empName", width: 28 },
        { header: "Site Name (Read-Only 🔒)", key: "site", width: 22 },
        { header: "Department (Select Dropdown ▼)", key: "department", width: 26 },
        { header: "Designation (Select Dropdown ▼)", key: "designation", width: 28 },
        { header: "Assigned Shift Name (Select Dropdown ▼)", key: "shiftName", width: 36 },
        { header: "Weekly Off Day (Select Dropdown ▼)", key: "weeklyOff", width: 28 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      // Columns 1-3: Slate / Dark Gray (Read-Only Header)
      for (let c = 1; c <= 3; c++) {
        const cell = headerRow.getCell(c);
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF334155" }, // Slate 700
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
      // Columns 4-7: Forest Green (Editable Dropdown Header)
      for (let c = 4; c <= 7; c++) {
        const cell = headerRow.getCell(c);
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF006B3F" }, // Forest Green
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      const targetList = excelTargetSite === "all"
        ? activeEmployees
        : activeEmployees.filter(e => (e.site || e.department || "").toLowerCase().trim() === excelTargetSite.toLowerCase().trim());

      targetList.forEach(emp => {
        // Look up existing week off day
        const existingDates = existingWeeklyOffsMap[emp.empCode.toLowerCase().trim()] || [];
        let existingDayName = "Sunday";
        if (existingDates.length > 0) {
          try {
            const firstDateObj = new Date(existingDates[0]);
            existingDayName = WEEKDAY_NAMES[getDay(firstDateObj)] || "Sunday";
          } catch {}
        }

        const ov = existingOverrides[emp.empCode] || {};
        const row = worksheet.addRow({
          empCode: emp.empCode,
          empName: ov.empName || emp.empName,
          site: ov.site || emp.site || emp.department || "Parkwest",
          department: ov.departmentOverride || emp.department || "MEP",
          designation: ov.designation || emp.designation || "Staff",
          shiftName: ov.shiftName || emp.shiftName || (shiftNameList[0] || "General Shift Group (09:00 - 18:00)"),
          weeklyOff: existingDayName,
        });

        // 🔒 Protect read-only columns (Columns 1, 2, 3)
        row.getCell(1).protection = { locked: true };
        row.getCell(2).protection = { locked: true };
        row.getCell(3).protection = { locked: true };
        const readOnlyBg = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF1F5F9" } };
        row.getCell(1).fill = readOnlyBg;
        row.getCell(2).fill = readOnlyBg;
        row.getCell(3).fill = readOnlyBg;

        // 🔓 Unlock editable dropdown columns (Columns 4, 5, 6, 7)
        row.getCell(4).protection = { locked: false };
        row.getCell(5).protection = { locked: false };
        row.getCell(6).protection = { locked: false };
        row.getCell(7).protection = { locked: false };

        // Attach Dropdown Data Validations
        row.getCell(4).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`_ReferenceLists!$A$1:$A$${deptList.length}`],
          showErrorMessage: true,
          errorTitle: "Invalid Department",
          error: "Please select an approved Department from the dropdown menu.",
        };

        row.getCell(5).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`_ReferenceLists!$B$1:$B$${desigList.length}`],
          showErrorMessage: true,
          errorTitle: "Invalid Designation",
          error: "Please select an approved Designation from the dropdown menu.",
        };

        row.getCell(6).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`_ReferenceLists!$C$1:$C$${shiftNameList.length}`],
          showErrorMessage: true,
          errorTitle: "Invalid Shift",
          error: "Please select an approved Shift from the dropdown menu.",
        };

        row.getCell(7).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`_ReferenceLists!$D$1:$D$${weekDayList.length}`],
          showErrorMessage: true,
          errorTitle: "Invalid Weekly Off",
          error: "Please select a valid weekday from the dropdown menu.",
        };
      });

      // 🛡️ Enforce Worksheet Protection so locked cells are read-only
      await worksheet.protect("", {
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
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const cleanSiteName = excelTargetSite === "all" ? "All Sites" : excelTargetSite.trim();
      const fileName = `Paradigm ${cleanSiteName} Roster Template ${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      downloadBlobReliably(blob, fileName);
    } catch (err) {
      console.error("[BulkRoster] Template download error:", err);
      setExcelErrorMessage("Could not generate Excel template.");
    }
  };

  /**
   * Downloads a Blob by converting to Data URL (base64) first.
   * This guarantees Chromium/Windows NEVER falls back to an internal Blob UUID without extension!
   */
  const downloadBlobReliably = (blob: Blob, fileName: string) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const link = document.createElement("a");
          link.style.display = "none";
          link.href = reader.result;
          link.download = fileName;
          link.setAttribute("download", fileName);
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            try {
              if (link.parentNode) document.body.removeChild(link);
            } catch {}
          }, 1000);
        } else {
          fallbackBlobDownload(blob, fileName);
        }
      };
      reader.onerror = () => fallbackBlobDownload(blob, fileName);
      reader.readAsDataURL(blob);
    } catch {
      fallbackBlobDownload(blob, fileName);
    }
  };

  const fallbackBlobDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.style.display = "none";
    link.href = url;
    link.download = fileName;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (link.parentNode) document.body.removeChild(link);
      } catch {}
      URL.revokeObjectURL(url);
    }, 60000);
  };

  // ── Download Prefilled CSV Template ────────────────────────────────────────
  const handleDownloadCsvTemplate = () => {
    try {
      const targetList = excelTargetSite === "all"
        ? activeEmployees
        : activeEmployees.filter(e => (e.site || e.department || "").toLowerCase().trim() === excelTargetSite.toLowerCase().trim());

      const headers = [
        "Biometric Code (Read-Only 🔒)",
        "Employee Name (Read-Only 🔒)",
        "Site Name (Read-Only 🔒)",
        "Department (MEP / Housekeeping / Security / Admin)",
        "Designation",
        "Assigned Shift Name",
        "Weekly Off Day (Sunday - Saturday)",
      ];

      const csvRows = [headers.join(",")];
      const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

      targetList.forEach(emp => {
        const existingDates = existingWeeklyOffsMap[emp.empCode.toLowerCase().trim()] || [];
        let existingDayName = "Sunday";
        if (existingDates.length > 0) {
          try {
            const firstDateObj = new Date(existingDates[0]);
            existingDayName = WEEKDAY_NAMES[getDay(firstDateObj)] || "Sunday";
          } catch {}
        }

        const ov = existingOverrides[emp.empCode] || {};
        const row = [
          escapeCsv(emp.empCode),
          escapeCsv(ov.empName || emp.empName),
          escapeCsv(ov.site || emp.site || emp.department || "Parkwest"),
          escapeCsv(ov.departmentOverride || emp.department || "MEP"),
          escapeCsv(ov.designation || emp.designation || "Staff"),
          escapeCsv(ov.shiftName || emp.shiftName || "General Shift (09:00 - 18:00)"),
          escapeCsv(existingDayName),
        ];
        csvRows.push(row.join(","));
      });

      const csvString = "\uFEFF" + csvRows.join("\r\n");
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const cleanSiteName = excelTargetSite === "all" ? "All Sites" : excelTargetSite.trim();
      const fileName = `Paradigm ${cleanSiteName} Roster Template ${format(new Date(), "yyyy-MM-dd")}.csv`;

      downloadBlobReliably(blob, fileName);
    } catch (err) {
      console.error("[BulkRoster] CSV template download error:", err);
      setExcelErrorMessage("Could not generate CSV template.");
    }
  };

  // ── Parse Uploaded Excel Roster ───────────────────────────────────────────
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setIsParsingExcel(true);
    setExcelErrorMessage(null);
    setExcelRows([]);

    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
      const employeeMap = new Map<string, BulkRosterTargetEmployee>();
      activeEmployees.forEach(emp => {
        employeeMap.set(String(emp.empCode).trim().toLowerCase(), emp);
        employeeMap.set(String(emp.empCode).trim().toLowerCase().replace(/^0+/, ""), emp);
      });

      const parsed: ParsedExcelRosterRow[] = [];

      if (isCsv) {
        // Parse CSV file with quotation support
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) throw new Error("CSV file is empty or missing employee data rows.");

        const parseCsvLine = (line: string): string[] => {
          const cells: string[] = [];
          let cur = "";
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
              cur = "";
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
          if (h.includes("code") || h.includes("biometric") || h.includes("emp_code")) colMap["empCode"] = idx;
          else if (h.includes("name") && !h.includes("shift") && !h.includes("site")) colMap["empName"] = idx;
          else if (h.includes("site")) colMap["site"] = idx;
          else if (h.includes("dept") || h.includes("department")) colMap["department"] = idx;
          else if (h.includes("desig") || h.includes("role")) colMap["designation"] = idx;
          else if (h.includes("shift")) colMap["shiftName"] = idx;
          else if (h.includes("week") || h.includes("off") || h.includes("wo")) colMap["weeklyOff"] = idx;
        });

        if (colMap["empCode"] === undefined) colMap["empCode"] = 0;
        if (colMap["empName"] === undefined) colMap["empName"] = 1;
        if (colMap["site"] === undefined) colMap["site"] = 2;
        if (colMap["department"] === undefined) colMap["department"] = 3;
        if (colMap["designation"] === undefined) colMap["designation"] = 4;
        if (colMap["shiftName"] === undefined) colMap["shiftName"] = 5;
        if (colMap["weeklyOff"] === undefined) colMap["weeklyOff"] = 6;

        for (let i = 1; i < lines.length; i++) {
          const cells = parseCsvLine(lines[i]);
          const rawCode = (cells[colMap["empCode"]] || "").trim();
          const cleanCode = rawCode.replace(/^#+/, "");
          if (!cleanCode) continue;

          const matchedEmp = employeeMap.get(cleanCode.toLowerCase()) || employeeMap.get(cleanCode.toLowerCase().replace(/^0+/, ""));

          parsed.push({
            empCode: cleanCode,
            empName: (cells[colMap["empName"]] || "").trim() || matchedEmp?.empName,
            site: (cells[colMap["site"]] || "").trim() || matchedEmp?.site,
            department: (cells[colMap["department"]] || "").trim() || matchedEmp?.department,
            designation: (cells[colMap["designation"]] || "").trim() || matchedEmp?.designation,
            shiftName: (cells[colMap["shiftName"]] || "").trim() || undefined,
            weeklyOffText: (cells[colMap["weeklyOff"]] || "").trim() || undefined,
            matchedEmp,
            isMatched: Boolean(matchedEmp),
          });
        }

        if (parsed.length === 0) {
          throw new Error("No employee rows detected in CSV file.");
        }

        setExcelRows(parsed);
        return;
      }

      // Otherwise parse XLSX / XLS
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error("No worksheets found in uploaded file.");

      const colMap: Record<string, number> = {};
      const firstRow = worksheet.getRow(1);
      firstRow.eachCell((cell, colNumber) => {
        const val = String(cell.value || "").toLowerCase().trim();
        if (val.includes("code") || val.includes("biometric") || val.includes("emp_code")) colMap["empCode"] = colNumber;
        else if (val.includes("name") && !val.includes("shift") && !val.includes("site")) colMap["empName"] = colNumber;
        else if (val.includes("site")) colMap["site"] = colNumber;
        else if (val.includes("dept") || val.includes("department")) colMap["department"] = colNumber;
        else if (val.includes("desig") || val.includes("role")) colMap["designation"] = colNumber;
        else if (val.includes("shift")) colMap["shiftName"] = colNumber;
        else if (val.includes("week") || val.includes("off") || val.includes("wo")) colMap["weeklyOff"] = colNumber;
      });

      if (!colMap["empCode"]) colMap["empCode"] = 1;
      if (!colMap["empName"]) colMap["empName"] = 2;
      if (!colMap["site"]) colMap["site"] = 3;
      if (!colMap["department"]) colMap["department"] = 4;
      if (!colMap["designation"]) colMap["designation"] = 5;
      if (!colMap["shiftName"]) colMap["shiftName"] = 6;
      if (!colMap["weeklyOff"]) colMap["weeklyOff"] = 7;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        const rawCode = String(row.getCell(colMap["empCode"]).value || row.getCell(colMap["empCode"]).text || "").trim();
        const cleanCode = rawCode.replace(/^#+/, "");
        if (!cleanCode) return;

        const matchedEmp = employeeMap.get(cleanCode.toLowerCase()) || employeeMap.get(cleanCode.toLowerCase().replace(/^0+/, ""));

        parsed.push({
          empCode: cleanCode,
          empName: String(row.getCell(colMap["empName"]).value || row.getCell(colMap["empName"]).text || "").trim() || matchedEmp?.empName,
          site: String(row.getCell(colMap["site"]).value || row.getCell(colMap["site"]).text || "").trim() || matchedEmp?.site,
          department: String(row.getCell(colMap["department"]).value || row.getCell(colMap["department"]).text || "").trim() || matchedEmp?.department,
          designation: String(row.getCell(colMap["designation"]).value || row.getCell(colMap["designation"]).text || "").trim() || matchedEmp?.designation,
          shiftName: String(row.getCell(colMap["shiftName"]).value || row.getCell(colMap["shiftName"]).text || "").trim() || undefined,
          weeklyOffText: String(row.getCell(colMap["weeklyOff"]).value || row.getCell(colMap["weeklyOff"]).text || "").trim() || undefined,
          matchedEmp,
          isMatched: Boolean(matchedEmp),
        });
      });

      if (parsed.length === 0) {
        throw new Error("No employee rows detected in spreadsheet.");
      }

      setExcelRows(parsed);
    } catch (err: any) {
      console.error("[BulkRoster] Excel parse error:", err);
      setExcelErrorMessage(err.message || "Failed to parse Excel file.");
    } finally {
      setIsParsingExcel(false);
    }
  };

  // ── Apply Excel Updates ───────────────────────────────────────────────────
  const handleApplyExcelUpdates = async () => {
    if (!excelRows.length) return;
    setIsSaving(true);
    try {
      const updatedWOMap = { ...existingWeeklyOffsMap };
      const updatedShiftOverrides = { ...existingOverrides };
      const validRows = excelRows.filter(r => r.isMatched);
      const targetMonth = currentMonth;
      const monthStr = format(targetMonth, "yyyy-MM");

      validRows.forEach(r => {
        const cleanCode = r.empCode.toLowerCase().trim();
        const numCode = cleanCode.replace(/^0+/, "");

        // 1. Shift Update
        if (r.shiftName && r.shiftName.trim()) {
          updatedShiftOverrides[r.empCode] = {
            ...(updatedShiftOverrides[r.empCode] || {}),
            empName: r.empName || r.matchedEmp?.empName,
            site: r.site || r.matchedEmp?.site || r.matchedEmp?.department,
            shiftName: r.shiftName.trim(),
          };
        }

        // 2. Weekly Off Update
        if (r.weeklyOffText && r.weeklyOffText.trim()) {
          const generatedDates = parseWeeklyOffToDates(r.weeklyOffText, targetMonth);
          if (generatedDates.length > 0) {
            const existing = updatedWOMap[cleanCode] || updatedWOMap[numCode] || [];
            // Replace existing dates for this month with new dates
            const filtered = existing.filter(d => !d.startsWith(monthStr));
            const merged = Array.from(new Set([...filtered, ...generatedDates])).sort();
            updatedWOMap[cleanCode] = merged;
            if (numCode !== cleanCode) updatedWOMap[numCode] = merged;
          }
        }
      });

      const result: BulkRosterAssignmentResult = {
        weeklyOffsByEmpCode: updatedWOMap,
        shiftOverridesByEmpCode: updatedShiftOverrides,
        holidayDates: [],
        affectedCount: validRows.length,
        scope: "Excel Spreadsheet Upload",
      };

      await onSave(result, updatedWOMap, updatedShiftOverrides);
      setSavedMsg(`Excel Roster successfully applied for ${validRows.length} staff (Shifts & Weekly Offs updated for ${format(targetMonth, "MMMM yyyy")})`);
      setStep(3);
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    setStep(1); setScopeType("category"); setSelectedCategory("all"); setSelectedSite("all");
    setAssignedShift("keep"); setCurrentMonth(new Date()); setWoEnabled(true);
    setSelectedWoWeekdays(new Set([0])); setHolidayEnabled(false); setHolidayList([]);
    setMergeMode("merge"); setSavedMsg(""); setExcelFile(null); setExcelRows([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#072415] rounded-3xl border border-slate-200 dark:border-[#134426] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#134426] bg-gradient-to-r from-emerald-50/80 to-slate-50 dark:from-[#0a2f1c] dark:to-[#072415] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Bulk Roster & Shift Assignment
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold">
                  {activeMode === "wizard" ? "Interactive Mode" : "Excel Spreadsheet Mode"}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-emerald-300/70">
                Assign Shifts & Weekly Offs to deployed staff across sites in bulk
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-[#134426] cursor-pointer transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-[#061e11] border-b border-slate-200/80 dark:border-[#134426] flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#0d3820] rounded-xl border border-slate-200 dark:border-[#1a5532]">
            <button
              type="button"
              onClick={() => { setActiveMode("wizard"); setStep(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeMode === "wizard"
                  ? "bg-[#006B3F] text-white shadow-xs"
                  : "text-slate-600 dark:text-emerald-200 hover:text-slate-900"
              }`}
            >
              <Sparkles size={13} />
              ⚡ Interactive Wizard
            </button>
            <button
              type="button"
              onClick={() => { setActiveMode("excel"); setStep(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeMode === "excel"
                  ? "bg-[#006B3F] text-white shadow-xs"
                  : "text-slate-600 dark:text-emerald-200 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet size={13} />
              📊 Excel Spreadsheet Roster
            </button>
          </div>

          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            {activeEmployees.length} Deployed Staff Available
          </span>
        </div>

        {/* Step Indicator (for Wizard) */}
        {activeMode === "wizard" && step < 3 && (
          <div className="px-5 py-2 border-b border-slate-100 dark:border-[#134426] flex items-center gap-2 bg-slate-50/50 dark:bg-[#072415]/60 shrink-0">
            {(["Scope Selection","Configure Shift & Week Off","Done"] as const).map((label, i) => {
              const num = i + 1;
              const active = step === num;
              const done = step > num;
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${done ? "bg-emerald-500 text-white" : active ? "bg-[#006B3F] text-white" : "bg-slate-100 dark:bg-[#134426] text-slate-400"}`}>
                    {done ? <Check size={10} /> : num}
                  </div>
                  <span className={`text-[11px] font-bold ${active ? "text-slate-800 dark:text-white" : "text-slate-400 dark:text-emerald-400/50"}`}>{label}</span>
                  {i < 2 && <ChevronRight size={10} className="text-slate-300" />}
                </div>
              );
            })}
            <span className="ml-auto text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              {scopedEmployees.length} in scope
            </span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* MODE 1: INTERACTIVE WIZARD                                         */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeMode === "wizard" && (
            <>
              {/* ── STEP 1: SCOPE SELECTION ── */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Scope Selector: By Category vs By Site */}
                  <div className="flex gap-2">
                    {(["category","site"] as const).map(t => (
                      <button key={t} onClick={() => setScopeType(t)}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${scopeType === t ? "bg-[#006B3F] text-white border-transparent shadow-xs" : "bg-white dark:bg-[#0c2e1c] text-slate-600 dark:text-emerald-200 border-slate-200 dark:border-[#134426]"}`}>
                        {t === "category" ? "👥 By Dept / Role Category" : "🏢 By Site / Location"}
                      </button>
                    ))}
                  </div>

                  {/* Category Grid */}
                  {scopeType === "category" && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {DEPT_CATEGORIES.map(cat => {
                        const count = activeEmployees.filter(cat.matchFn).length;
                        const isSel = selectedCategory === cat.key;
                        return (
                          <button key={cat.key} onClick={() => setSelectedCategory(cat.key)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${isSel ? cat.bgSel : "bg-white dark:bg-[#0c2e1c] border-slate-200 dark:border-[#134426] hover:border-slate-300"}`}>
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">{cat.emoji}</span>
                              <span className={`text-[11px] font-bold ${isSel ? "" : cat.color}`}>{cat.label}</span>
                            </div>
                            <p className={`text-[10px] mt-1 font-semibold ${isSel ? "text-white/80" : "text-slate-400"}`}>{count} employees</p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Site Grid */}
                  {scopeType === "site" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {["all", ...departmentList].map(site => {
                        const count = site === "all"
                          ? activeEmployees.length
                          : activeEmployees.filter(e => (e.site || e.department || "").toLowerCase().trim() === site.toLowerCase().trim()).length;
                        const isSel = selectedSite === site;
                        return (
                          <button key={site} onClick={() => setSelectedSite(site)}
                            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${isSel ? "bg-[#006B3F] text-white border-transparent shadow-xs" : "bg-white dark:bg-[#0c2e1c] border-slate-200 dark:border-[#134426] text-slate-700 dark:text-emerald-100 hover:border-emerald-400"}`}>
                            <span className="truncate">{site === "all" ? "🌐 All Sites (Global)" : site}</span>
                            <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${isSel ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-[#134426] text-slate-600 dark:text-emerald-300"}`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Summary & Next Action */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-[#134426]">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-emerald-300/70">
                      <Shield size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{scopedEmployees.length} active employees selected for roster configuration.</span>
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      disabled={scopedEmployees.length === 0}
                      className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-[#006B3F] hover:bg-[#005632] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      Configure Roster ({scopedEmployees.length} Staff) <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: CONFIGURE SHIFT & WEEK OFF ── */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Month Navigator */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#0c2e1c] border border-slate-200 dark:border-[#134426]">
                    <button onClick={() => setCurrentMonth(p => subMonths(p, 1))} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] text-slate-700 dark:text-emerald-200 hover:bg-slate-100 cursor-pointer">← Prev</button>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-800 dark:text-white">{format(currentMonth, "MMMM yyyy")}</p>
                      <p className="text-[10px] text-slate-400">{monthDays.length} days in cycle</p>
                    </div>
                    <button onClick={() => setCurrentMonth(p => addMonths(p, 1))} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] text-slate-700 dark:text-emerald-200 hover:bg-slate-100 cursor-pointer">Next →</button>
                  </div>

                  {/* 1. SHIFT ASSIGNMENT CARD */}
                  <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-[#072415] border border-emerald-200 dark:border-[#134426] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Shift Assignment</h4>
                      </div>
                      <span className="text-[10px] text-slate-400">Applies to all {scopedEmployees.length} staff</span>
                    </div>

                    <select
                      value={assignedShift}
                      onChange={e => setAssignedShift(e.target.value)}
                      className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#134426] bg-white dark:bg-[#0d3820] text-slate-800 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="keep">-- Keep Current Individual Shifts --</option>
                      {shiftOptionsList.map(s => (
                        <option key={s.code} value={s.name}>
                          {s.name} {s.timing ? `(${s.timing})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 dark:text-emerald-300/70">
                      Selecting a shift will re-assign this shift to all {scopedEmployees.length} employees in the selected scope.
                    </p>
                  </div>

                  {/* 2. WEEKLY OFF CARD */}
                  <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-[#1a1000]/40 border border-amber-200 dark:border-amber-900/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setWoEnabled(v => !v)} className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${woEnabled ? "bg-amber-500" : "bg-slate-200 dark:bg-[#134426]"}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${woEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                        </button>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Weekly Off (W/O) Assignment</span>
                      </div>
                      {woEnabled && <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[10px] font-bold">{woDateStrings.size} dates</span>}
                    </div>

                    {woEnabled && (
                      <div className="space-y-3 pt-1">
                        {/* Weekday pills */}
                        <div className="grid grid-cols-7 gap-1">
                          {WEEKDAY_SHORT.map((dayName, idx) => {
                            const isSel = selectedWoWeekdays.has(idx);
                            return (
                              <button key={dayName} type="button" onClick={() => toggleWoDay(idx)}
                                className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${isSel ? "bg-amber-500 text-white shadow-xs" : "bg-white dark:bg-[#0c2e1c] text-slate-600 dark:text-emerald-200 border border-slate-200 dark:border-[#134426]"}`}>
                                {dayName}
                              </button>
                            );
                          })}
                        </div>

                        {/* Calendar visualizer */}
                        <div className="grid grid-cols-7 gap-1 text-center bg-white dark:bg-[#072415] p-2 rounded-xl border border-amber-200/60 dark:border-amber-900/30">
                          {WEEKDAY_SHORT.map((d, i) => (
                            <div key={d} className={`text-[9px] font-bold py-1 ${i === 0 ? "text-amber-500" : "text-slate-400"}`}>{d}</div>
                          ))}
                          {padDays.map((_, i) => <div key={"p"+i} className="h-6" />)}
                          {monthDays.map(d => {
                            const ds = format(d, "yyyy-MM-dd");
                            const isWO = woDateStrings.has(ds);
                            return (
                              <div key={ds} className={`h-6 rounded flex items-center justify-center text-[10px] font-bold ${isWO ? "bg-amber-500 text-white" : "bg-slate-50 dark:bg-[#0c2e1c] text-slate-500 dark:text-emerald-300/60"}`}>
                                {d.getDate()}
                              </div>
                            );
                          })}
                        </div>

                        {/* Merge vs Replace */}
                        <div className="flex gap-2">
                          {(["merge","replace"] as const).map(mode => (
                            <button key={mode} type="button" onClick={() => setMergeMode(mode)}
                              className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border cursor-pointer transition-all ${mergeMode === mode ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent" : "bg-white dark:bg-[#0c2e1c] border-slate-200 dark:border-[#134426] text-slate-600 dark:text-emerald-200"}`}>
                              {mode === "merge" ? "🔀 Merge with existing W/Os" : "🔄 Replace all W/Os for this month"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. SITE HOLIDAYS CARD */}
                  <div className="space-y-3 p-4 rounded-xl bg-sky-50/60 dark:bg-[#001a2e]/40 border border-sky-200 dark:border-sky-900/50">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setHolidayEnabled(v => !v)} className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${holidayEnabled ? "bg-sky-500" : "bg-slate-200 dark:bg-[#134426]"}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${holidayEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Site Holidays (Optional)</span>
                      {holidayEnabled && holidayList.length > 0 && <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-[10px] font-bold">{holidayList.length}</span>}
                    </div>

                    {holidayEnabled && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)}
                            className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] text-slate-800 dark:text-slate-100 outline-none" />
                          <input type="text" placeholder="Holiday name (e.g. Diwali)" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && addHoliday()}
                            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] text-slate-800 dark:text-slate-100 outline-none" />
                          <button onClick={addHoliday} disabled={!newHolidayDate || !newHolidayName.trim()}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-40 rounded-lg cursor-pointer">+ Add</button>
                        </div>
                        {holidayList.map(h => (
                          <div key={h.date} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40">
                            <span className="font-mono text-[11px] text-sky-700 dark:text-sky-300 font-bold mr-2">{h.date}</span>
                            <span className="text-[11px] text-slate-700 dark:text-slate-200 flex-1">{h.name}</span>
                            <button onClick={() => setHolidayList(p => p.filter(x => x.date !== h.date))} className="text-rose-400 hover:text-rose-600 cursor-pointer text-sm font-bold">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Summary & Submit */}
                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-[#134426]">
                    <button onClick={() => setStep(1)} className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-emerald-200 bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] rounded-xl cursor-pointer hover:bg-slate-100">← Back</button>
                    <button
                      onClick={handleSaveWizard}
                      disabled={isSaving || scopedEmployees.length === 0}
                      className="flex-1 py-2.5 text-xs font-black text-white bg-[#006B3F] hover:bg-[#005632] disabled:opacity-50 rounded-xl cursor-pointer shadow-xs flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      Save & Apply Roster ({scopedEmployees.length} Staff)
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* MODE 2: EXCEL SPREADSHEET ROSTER IMPORT / EXPORT                    */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeMode === "excel" && step < 3 && (
            <div className="space-y-5">
              {/* Site Scope Filter for Excel */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-[#0c2e1c] border border-slate-200 dark:border-[#134426]">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    Target Site Scope for Excel Spreadsheet
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-emerald-300/70 mt-0.5">
                    Choose which client site's active workforce to export and update via Excel.
                  </p>
                </div>
                <select
                  value={excelTargetSite}
                  onChange={e => setExcelTargetSite(e.target.value)}
                  className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-[#134426] bg-white dark:bg-[#072415] text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="all">🌐 All Sites ({activeEmployees.length} Staff)</option>
                  {departmentList.map(s => {
                    const cnt = activeEmployees.filter(e => (e.site || e.department || "").toLowerCase().trim() === s.toLowerCase().trim()).length;
                    return (
                      <option key={s} value={s}>{s} ({cnt} Staff)</option>
                    );
                  })}
                </select>
              </div>

              {/* Action 1: Download Prefilled Excel or CSV Template */}
              <div className="p-5 rounded-2xl border border-emerald-200/80 dark:border-[#134426] bg-emerald-50/50 dark:bg-[#072415] space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                      <Download size={16} className="text-emerald-600" />
                      Step 1: Download Prefilled Template
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-emerald-300/80 mt-1 max-w-xl">
                      Downloads a prefilled roster for <b>{excelTargetSite === "all" ? "All Sites" : excelTargetSite}</b> ({targetSiteStaffCount} Staff). 
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="px-4 py-2.5 rounded-xl bg-[#006B3F] hover:bg-[#005632] text-white text-xs font-black flex items-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95"
                      title="Download Microsoft Excel spreadsheet with locked read-only columns and dropdown pickers"
                    >
                      <FileSpreadsheet size={16} />
                      Download Excel (.xlsx)
                      <span className="text-[10px] bg-amber-400 text-amber-950 font-extrabold px-1.5 py-0.5 rounded-full">⭐ Dropdowns</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCsvTemplate}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 text-slate-700 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                      title="Download raw CSV file (Note: CSV does not support Excel dropdown menus)"
                    >
                      <Download size={15} />
                      Download CSV (.csv)
                    </button>
                  </div>
                </div>

                {/* Info Pills: Locked vs Dropdowns */}
                <div className="pt-2 border-t border-emerald-200/60 dark:border-[#134426]/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
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
                      <span className="ml-1 text-amber-800 dark:text-amber-400">Department (MEP, HK, Security, Admin), Shift & Week Off</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action 2: Upload Completed File */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#134426] bg-white dark:bg-[#072415] space-y-3">
                <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Upload size={16} className="text-blue-600" />
                  Step 2: Upload Edited Spreadsheet (.xlsx / .csv)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-emerald-300/70">
                  Update the <b>Assigned Shift Name</b> and <b>Weekly Off Day</b> columns in Excel and upload the file back here.
                </p>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-[#134426] hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/60 dark:bg-[#051c11]"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                  <FileSpreadsheet size={32} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-2" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {excelFile ? excelFile.name : "Click to select or drag and drop completed Excel file"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV files
                  </p>
                </div>

                {isParsingExcel && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold justify-center py-2">
                    <Loader2 size={16} className="animate-spin" />
                    Parsing spreadsheet and validating biometric codes...
                  </div>
                )}

                {excelErrorMessage && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={15} />
                    {excelErrorMessage}
                  </div>
                )}
              </div>

              {/* Parsed Rows Preview */}
              {excelRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Preview: {excelRows.filter(r => r.isMatched).length} / {excelRows.length} Valid Staff Matched
                    </span>
                    <button
                      type="button"
                      onClick={() => { setExcelFile(null); setExcelRows([]); }}
                      className="text-slate-400 hover:text-red-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={11} /> Clear
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-[#134426] rounded-xl text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 dark:bg-[#0c2e1c] text-slate-700 dark:text-emerald-200 sticky top-0 font-bold text-[10px]">
                        <tr>
                          <th className="p-2">Code</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Site</th>
                          <th className="p-2">New Shift</th>
                          <th className="p-2">New Week Off</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#134426] text-[11px]">
                        {excelRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-[#072415]">
                            <td className="p-2 font-mono font-bold text-slate-900 dark:text-white">{r.empCode}</td>
                            <td className="p-2 font-medium text-slate-800 dark:text-emerald-100">{r.empName || "-"}</td>
                            <td className="p-2 text-slate-500">{r.site || "-"}</td>
                            <td className="p-2 font-semibold text-emerald-700 dark:text-emerald-300">{r.shiftName || "Keep Current"}</td>
                            <td className="p-2 font-semibold text-amber-700 dark:text-amber-300">{r.weeklyOffText || "-"}</td>
                            <td className="p-2">
                              {r.isMatched ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] font-bold">
                                  ✓ Ready
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-bold">
                                  Not Found
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyExcelUpdates}
                    disabled={isSaving || excelRows.filter(r => r.isMatched).length === 0}
                    className="w-full py-3 rounded-xl bg-[#006B3F] hover:bg-[#005632] text-white text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    Apply Excel Updates to {excelRows.filter(r => r.isMatched).length} Staff
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: SUCCESS CONFIRMATION ── */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Roster Successfully Saved!</h4>
                <p className="text-xs text-slate-500 dark:text-emerald-300/80 mt-1 max-w-md">{savedMsg}</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-emerald-200 bg-slate-100 dark:bg-[#134426] rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Assign Another Roster
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#006B3F] hover:bg-[#005632] rounded-xl shadow-xs cursor-pointer"
                >
                  Done & View Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
