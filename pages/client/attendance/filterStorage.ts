export const ATTENDANCE_FILTERS_STORAGE_KEY = 'paradigm_site_attendance_filters_v1';

export interface PersistedAttendanceFilters {
  activeTab?: 'attendance' | 'reports' | 'shiftConfig' | 'userAccess' | 'auditLogs';
  selectedDate?: string;
  selectedOpsManager?: string;
  departmentFilter?: string;
  siteFilter?: string;
  search?: string;
  datePreset?: string;
  activeDateFilter?: string;
  startDate?: string;
  endDate?: string;
  reportType?: string;
  pendingReportType?: string;
  pendingLocation?: string;
  pendingCompany?: string;
  pendingSite?: string;
  pendingRole?: string;
  pendingEmployee?: string;
  pendingStatus?: string;
  pendingRecordType?: string;
  pendingPageSize?: number;
  selectedDeptCard?: string;
}

/**
 * Loads saved attendance filters from localStorage with error protection.
 */
export function loadPersistedAttendanceFilters(): PersistedAttendanceFilters | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ATTENDANCE_FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (err) {
    console.warn('[filterStorage] Error loading persisted filters:', err);
  }
  return null;
}

/**
 * Saves attendance filters to localStorage.
 */
export function savePersistedAttendanceFilters(filters: PersistedAttendanceFilters): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ATTENDANCE_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch (err) {
    console.warn('[filterStorage] Error saving persisted filters:', err);
  }
}

/**
 * Clears saved attendance filters from localStorage.
 */
export function clearPersistedAttendanceFilters(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ATTENDANCE_FILTERS_STORAGE_KEY);
  } catch (err) {
    console.warn('[filterStorage] Error clearing persisted filters:', err);
  }
}
