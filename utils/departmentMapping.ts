// Master Department Mapping Engine for Paradigm Site Attendance Dashboard
// Maps designations from the organization's job role matrix (Image 2) to 5 core functional buckets (Option A)

export type DepartmentKey = 'mep' | 'housekeeping' | 'garden' | 'security' | 'administration' | 'other';

export interface DepartmentMeta {
  key: DepartmentKey;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  badgeBg: string;
  badgeText: string;
  description: string;
}

export const DEPARTMENT_METAS: Record<DepartmentKey, DepartmentMeta> = {
  mep: {
    key: 'mep',
    label: 'MEP Services',
    shortLabel: 'MEP',
    icon: '⚡',
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50/80',
    bgDark: 'dark:bg-amber-950/40',
    borderLight: 'border-amber-200',
    borderDark: 'dark:border-amber-800/60',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/80',
    badgeText: 'text-amber-800 dark:text-amber-300',
    description: 'Electrical, Plumbing, STP/WTP, Multi-Tech, Pool & Utilities',
  },
  housekeeping: {
    key: 'housekeeping',
    label: 'Housekeeping',
    shortLabel: 'Housekeeping',
    icon: '🧹',
    color: 'text-emerald-700 dark:text-[#44D62C]',
    bgLight: 'bg-emerald-50/80',
    bgDark: 'dark:bg-[#0c3821]',
    borderLight: 'border-emerald-200',
    borderDark: 'dark:border-[#1a5532]',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/80',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    description: 'HK Boys, Ladies, Cleaners, Sweepers & Pantry Staff',
  },
  security: {
    key: 'security',
    label: 'Security Services',
    shortLabel: 'Security',
    icon: '🛡️',
    color: 'text-blue-700 dark:text-blue-400',
    bgLight: 'bg-blue-50/80',
    bgDark: 'dark:bg-blue-950/40',
    borderLight: 'border-blue-200',
    borderDark: 'dark:border-blue-800/60',
    badgeBg: 'bg-blue-100 dark:bg-blue-950/80',
    badgeText: 'text-blue-800 dark:text-blue-300',
    description: 'Guards, Lady Guards, Supervisors, Gunmen & Field Officers',
  },
  garden: {
    key: 'garden',
    label: 'Garden & Landscaping',
    shortLabel: 'Garden',
    icon: '🌿',
    color: 'text-teal-700 dark:text-teal-400',
    bgLight: 'bg-teal-50/80',
    bgDark: 'dark:bg-teal-950/40',
    borderLight: 'border-teal-200',
    borderDark: 'dark:border-teal-800/60',
    badgeBg: 'bg-teal-100 dark:bg-teal-950/80',
    badgeText: 'text-teal-800 dark:text-teal-300',
    description: 'Gardeners, Senior/Junior Helpers, Horticulturists & Weeders',
  },
  administration: {
    key: 'administration',
    label: 'Admin & Management',
    shortLabel: 'Admin',
    icon: '🏢',
    color: 'text-indigo-700 dark:text-indigo-400',
    bgLight: 'bg-indigo-50/80',
    bgDark: 'dark:bg-indigo-950/40',
    borderLight: 'border-indigo-200',
    borderDark: 'dark:border-indigo-800/60',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-950/80',
    badgeText: 'text-indigo-800 dark:text-indigo-300',
    description: 'Facility Managers, AFM, Executives, Helpdesk & Accounts',
  },
  other: {
    key: 'other',
    label: 'Pest & Specialized',
    shortLabel: 'Other/Pest',
    icon: '🐜',
    color: 'text-slate-700 dark:text-slate-300',
    bgLight: 'bg-slate-50/80',
    bgDark: 'dark:bg-slate-900/50',
    borderLight: 'border-slate-200',
    borderDark: 'dark:border-slate-800',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-800 dark:text-slate-300',
    description: 'Pest Control Operators & Specialized Support Staff',
  },
};

// Exact and normalized designation mapping dictionary from Image 2
const EXACT_DESIGNATION_MAP: Record<string, DepartmentKey> = {
  // ── ELECTRICAL DEPT ──
  'dg operator': 'mep',
  'electrical safety officer': 'mep',
  'electrical safety officer (trainee)': 'mep',
  'electrical supervisor': 'mep',
  'junior electrician': 'mep',
  'junior technician': 'mep',
  'lead electrician': 'mep',
  'lighting technician': 'mep',
  'senior electrician': 'mep',
  'senior technician': 'mep',
  'technical executive': 'mep',
  'technician': 'mep',
  'apprentice': 'mep',
  'electrician': 'mep',

  // ── PLUMBING DEPT ──
  'handyman': 'mep',
  'junior plumber': 'mep',
  'plumber': 'mep',
  'plumber cum carpenter': 'mep',
  'plumber cum pool operator & water operator': 'mep',
  'plumber cum pool operator & wtp operator': 'mep',
  'plumber cum water operator': 'mep',
  'plumber cum wtp operator': 'mep',
  'sr plumber cum water operator': 'mep',
  'sr plumber cum wtp operator': 'mep',
  'water tank cleaner': 'mep',
  'senior plumber': 'mep',

  // ── STP / WTP ──
  'junior stp': 'mep',
  'junior wtp': 'mep',
  'lead stp': 'mep',
  'lead wtp': 'mep',
  'senior stp': 'mep',
  'senior wtp': 'mep',
  'stp cum wtp operator': 'mep',
  'stp operator': 'mep',
  'water analyst': 'mep',
  'wtp operator': 'mep',
  'wtp/ro operator': 'mep',
  'ro operator': 'mep',

  // ── MULTI TECHNICIAN ──
  'audio visual technician': 'mep',
  'multi supervisor': 'mep',
  'multi technician': 'mep',
  'vehicle driver': 'mep',
  'vehicle driver (trainee)': 'mep',

  // ── OTHER SERVICES (TECHNICAL & UTILITIES) ──
  'badminton court operator': 'mep',
  'bowling alley operator': 'mep',
  'buggy driver': 'mep',
  'carpenter': 'mep',
  'cctv technician': 'mep',
  'chilled operator': 'mep',
  'chiller operator': 'mep',
  'dg engineer': 'mep',
  'fire fighting': 'mep',
  'fire alarm technician': 'mep',
  'fire warden': 'mep',
  'gas bank technician': 'mep',
  'hvac technician': 'mep',
  'ladder / scaffolding technician': 'mep',
  'life guard': 'mep',
  'maintenance electrician': 'mep',
  'network administrator': 'mep',
  'stack operator': 'mep',
  'tank cleaner': 'mep',
  'mason': 'mep',

  // ── SWIMMING POOL MAINTENANCE ──
  'pool operator': 'mep',
  'swimming pool cum wtp operator': 'mep',
  'waterbody operator': 'mep',
  'pool operator - full time': 'mep',
  'pool operator - required hours': 'mep',

  // ── PEST CONTROL SERVICES ──
  'pest control operator': 'other',
  'pest control operator - full time': 'other',
  'pest control operator - required hours': 'other',
  'pest tech': 'other',

  // ── HK SERVICES (HOUSEKEEPING) ──
  'hk assistant': 'housekeeping',
  'hk assistant (car wash)': 'housekeeping',
  'car wash boy': 'housekeeping',
  'car wash collection': 'housekeeping',
  'garbage collection': 'housekeeping',
  'hk supervisor': 'housekeeping',
  'hk trainee': 'housekeeping',
  'hk boy': 'housekeeping',
  'hk female': 'housekeeping',
  'hk lady': 'housekeeping',
  'hk office assistant': 'housekeeping',
  'hk concierge': 'housekeeping',
  'hk cleaner': 'housekeeping',
  'hk cleaner senior': 'housekeeping',
  'hk housekeeping': 'housekeeping',
  'hk dusting': 'housekeeping',
  'hk floor supervisor': 'housekeeping',
  'hk cluster head': 'housekeeping',
  'hk boys (rota - female)': 'housekeeping',
  'hk boys (rota - senior)': 'housekeeping',
  'office assistant': 'housekeeping',
  'office assistant cum cleaner': 'housekeeping',
  'office assistant cum hk boy': 'housekeeping',
  'ows operator': 'housekeeping',
  'pantry boy': 'housekeeping',
  'sweeper': 'housekeeping',
  'housekeeper': 'housekeeping',
  'janitor': 'housekeeping',
  'cleaner': 'housekeeping',

  // ── LANDSCAPING SERVICES (GARDEN) ──
  'asst head gardener': 'garden',
  'garden helper': 'garden',
  'garden sprinkler operator': 'garden',
  'gardener': 'garden',
  'head gardener': 'garden',
  'horticulturist': 'garden',
  'senior gardener': 'garden',
  'weeder': 'garden',
  'junior gardener': 'garden',
  'garden senior': 'garden',
  'garden junior': 'garden',

  // ── SECURITY SERVICES ──
  'asst security supervisor': 'security',
  'security executive': 'security',
  'asst security officer': 'security',
  'field officer': 'security',
  'head guard': 'security',
  'junior security guard': 'security',
  'lady guard': 'security',
  'security reliever': 'security',
  'security officer': 'security',
  'security guard main gate': 'security',
  'security guard with gun': 'security',
  'armed guard (bank/cash escort)': 'security',
  'patrol guard': 'security',
  'security supervisor': 'security',
  'senior head guard': 'security',
  'driver cum security guard': 'security',
  'patrol / armed security guard': 'security',
  'trained guard': 'security',
  'gunman': 'security',
  'security guard': 'security',
  'guard': 'security',

  // ── ADMINISTRATION LEVEL 1 & LEVEL 2 ──
  'afm - soft': 'administration',
  'afm soft': 'administration',
  'afm - technical': 'administration',
  'afm technical': 'administration',
  'aym - technical': 'administration',
  'associate facility manager': 'administration',
  'asst facility manager (crm & billing)': 'administration',
  'asst facility manager': 'administration',
  'asst manager civil engineer': 'administration',
  'asst property manager': 'administration',
  'civil engineer': 'administration',
  'clubhouse manager': 'administration',
  'estate manager': 'administration',
  'facility manager - soft services': 'administration',
  'facility manager - technical': 'administration',
  'lead property manager': 'administration',
  'senior facility manager': 'administration',
  'fire and safety officer': 'administration',
  'resident manager': 'administration',
  'site head soft services/mep': 'administration',
  'property manager': 'administration',
  'shift engineer': 'administration',
  'technical manager': 'administration',
  'technical assistant - engineer (electrical)': 'administration',
  'accountant': 'administration',
  'admin assistant': 'administration',
  'asst facility executive': 'administration',
  'billing & recovery incharge': 'administration',
  'club house executive': 'administration',
  'club house supervisor': 'administration',
  'customer relation executive': 'administration',
  'desk incharge': 'administration',
  'facility executive - site backoffice (crm)': 'administration',
  'fire and safety executive': 'administration',
  'front office executive': 'administration',
  'help desk cum receptionist': 'administration',
  'help desk female': 'administration',
  'help desk male': 'administration',
  'it officer': 'administration',
  'junior accountant': 'administration',
  'store incharge': 'administration',
  'asst manager - hr': 'administration',
  'soft service executive': 'administration',
};

/**
 * Normalizes an employee's designation and code to determine their functional department bucket
 */
export function getEmployeeDepartment(emp: {
  designation?: string;
  empCode?: string;
  department?: string;
}): DepartmentKey {
  const desig = (emp.designation || '').toLowerCase().trim();
  const cleanCode = (emp.empCode || '').replace(/\D/g, '');

  // 1. Direct dictionary match
  if (desig && EXACT_DESIGNATION_MAP[desig]) {
    return EXACT_DESIGNATION_MAP[desig];
  }

  // 2. Keyword matching on designation
  if (
    desig.includes('garden') ||
    desig.includes('horticult') ||
    desig.includes('weeder')
  ) {
    return 'garden';
  }

  if (
    desig.includes('housekeep') ||
    desig.includes('hk ') ||
    desig.startsWith('hk') ||
    desig.includes('cleaner') ||
    desig.includes('sweeper') ||
    desig.includes('janitor') ||
    desig.includes('pantry') ||
    desig.includes('garbage') ||
    desig.includes('car wash')
  ) {
    return 'housekeeping';
  }

  if (
    desig.includes('security') ||
    desig.includes('guard') ||
    desig.includes('gunman') ||
    desig.includes('patrol') ||
    desig.includes('field officer') ||
    desig.includes('aso')
  ) {
    return 'security';
  }

  if (
    desig.includes('electri') ||
    desig.includes('plumb') ||
    desig.includes('technician') ||
    desig.includes('stp') ||
    desig.includes('wtp') ||
    desig.includes('hvac') ||
    desig.includes('fire fighting') ||
    desig.includes('dg operator') ||
    desig.includes('handyman') ||
    desig.includes('pool') ||
    desig.includes('waterbody') ||
    desig.includes('carpenter') ||
    desig.includes('mason')
  ) {
    return 'mep';
  }

  if (
    desig.includes('manager') ||
    desig.includes('executive') ||
    desig.includes('admin') ||
    desig.includes('accountant') ||
    desig.includes('help desk') ||
    desig.includes('receptionist') ||
    desig.includes('crm') ||
    desig.includes('billing')
  ) {
    return 'administration';
  }

  if (desig.includes('pest')) {
    return 'other';
  }

  // 3. Fallback by Biometric Code series:
  // 32xxx -> Security
  // 31xxx -> MEP
  if (cleanCode.startsWith('32') || cleanCode.startsWith('320')) {
    return 'security';
  }
  if (cleanCode.startsWith('31') || cleanCode.startsWith('310')) {
    return 'mep';
  }

  return 'other';
}

export interface DepartmentStat {
  key: DepartmentKey;
  meta: DepartmentMeta;
  totalActive: number;
  totalHeadcount: number;
  deployment: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
}

/**
 * Computes department-wise attendance statistics for an array of processed employees
 * Accepts optional site/global sanctioned deployment counts from Version_5.6 Final.xlsm
 */
export function calculateDepartmentStats(
  employees: any[],
  deploymentCounts?: Record<DepartmentKey, number>
): Record<DepartmentKey, DepartmentStat> {
  const baseKeys: DepartmentKey[] = ['mep', 'housekeeping', 'garden', 'security', 'administration', 'other'];
  
  const stats: Record<DepartmentKey, DepartmentStat> = {} as any;
  baseKeys.forEach(k => {
    stats[k] = {
      key: k,
      meta: DEPARTMENT_METAS[k],
      totalActive: 0,
      totalHeadcount: 0,
      deployment: 0,
      present: 0,
      absent: 0,
      late: 0,
      attendanceRate: 0,
    };
  });

  employees.forEach(emp => {
    const dept = getEmployeeDepartment(emp);
    const target = stats[dept] || stats.other;
    
    target.totalHeadcount++;
    
    // Check active status
    const isActive = emp.isActiveEmployee !== false;
    if (isActive) {
      target.totalActive++;
    }

    // Check present status
    const isPresent =
      (emp.inTime !== null && emp.inTime !== '—') ||
      emp.status === 'Present' ||
      emp.status === 'Late' ||
      emp.status === 'Half Day' ||
      emp.status === 'Missed Punch IN' ||
      emp.status === 'Missed Punch OUT' ||
      Boolean(emp.shiftCompleted);

    if (isPresent) {
      target.present++;
    }

    if (emp.lateMinutes > 0 || emp.status === 'Late') {
      target.late++;
    }
  });

  // Calculate absent, deployment, and attendance rates
  baseKeys.forEach(k => {
    const s = stats[k];
    const sanctioned = deploymentCounts && deploymentCounts[k] !== undefined && deploymentCounts[k] > 0
      ? deploymentCounts[k]
      : (s.totalActive || s.totalHeadcount);
    s.deployment = sanctioned;
    s.absent = Math.max(0, sanctioned - s.present);
    s.attendanceRate = sanctioned > 0 ? Math.round((s.present / sanctioned) * 100) : 0;
  });

  return stats;
}
