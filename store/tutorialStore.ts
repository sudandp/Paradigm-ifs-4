import { create } from 'zustand';

export type TutorialRole = 'site_staff' | 'field_officer' | 'manager';

export interface TutorialStep {
  targetId: string;
  title: string;
  badge: string;
  description: string;
  actionTip?: string;
  placement?: 'top' | 'bottom' | 'center';
}

interface TutorialState {
  isActive: boolean;
  isSimulatorOpen: boolean;
  isCertified: boolean;
  currentStepIndex: number;
  activeRole: TutorialRole;
  steps: TutorialStep[];
  
  startTutorial: (role: TutorialRole, force?: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  checkAutoStart: (userId: string, role: string) => void;
  replayTutorial: (role: string) => void;
  openSimulator: (role?: string) => void;
  closeSimulator: (completed?: boolean) => void;
  checkCertification: (userId: string) => boolean;
}

const SITE_STAFF_STEPS: TutorialStep[] = [
  {
    targetId: 'tour-main-punch',
    title: 'Main Shift Punch',
    badge: 'Step 1 of 4 • Shift Start & End',
    description: 'Tap this central button to punch IN at the start of your shift using facial or location verification. Tap again at the end of your shift to punch OUT.',
    actionTip: 'Must punch within your assigned site boundary or biometric window.',
    placement: 'bottom'
  },
  {
    targetId: 'tour-duty-mode',
    title: 'Duty Mode Selection',
    badge: 'Step 2 of 4 • Regular vs Site Duty',
    description: 'Switch between Regular Duty and Site Duty (Overtime). Your work calculations and shift multipliers dynamically adjust based on this selection.',
    actionTip: 'Select your duty mode before checking in.',
    placement: 'top'
  },
  {
    targetId: 'tour-break-action',
    title: 'Meal & Tea Breaks',
    badge: 'Step 3 of 4 • Break Tracking',
    description: 'Taking lunch or a tea break? Tap "Take Break" to pause your active duty timer. When finished, tap "Resume Work" to return to duty.',
    actionTip: 'Audio alarms will remind you 5 minutes before break expires.',
    placement: 'top'
  },
  {
    targetId: 'tour-notification-bell',
    title: 'Alerts & Approvals Bell',
    badge: 'Step 4 of 4 • Notifications',
    description: 'View instant notifications about shift updates, holiday broadcasts, leave request status, and device background reliability.',
    actionTip: 'Check the shield icon inside to keep background alarms active.',
    placement: 'bottom'
  }
];

const FIELD_OFFICER_STEPS: TutorialStep[] = [
  {
    targetId: 'tour-main-punch',
    title: 'Daily Duty Check-in',
    badge: 'Step 1 of 4 • Start Field Day',
    description: 'Start your official workday here. Once punched in, your field officer shift is active and live geo-tracking begins for safety and client audits.',
    actionTip: 'Ensure GPS location is turned ON on your phone.',
    placement: 'bottom'
  },
  {
    targetId: 'tour-site-action',
    title: 'Site In & Site Out Visits',
    badge: 'Step 2 of 4 • Client Visits',
    description: 'When arriving at a client property or facility, tap "Site In". When leaving the site for the next location, tap "Site Out".',
    actionTip: 'Logs your entry timestamp and exact GPS site location automatically.',
    placement: 'top'
  },
  {
    targetId: 'tour-break-action',
    title: 'Field Break Tracking',
    badge: 'Step 3 of 4 • Lunch & Travel Rest',
    description: 'Pause your field duty for meal or travel breaks. Tapping "Take Break" ensures your break time is logged accurately without breaking duty continuity.',
    actionTip: 'Always tap "Resume Work" when arriving back on duty.',
    placement: 'top'
  },
  {
    targetId: 'tour-notification-bell',
    title: 'Field Alerts & Approvals',
    badge: 'Step 4 of 4 • Alerts & Tasks',
    description: 'Receive emergency site alerts, manager dispatch messages, and approvals for attendance corrections or fuel/expense claims.',
    actionTip: 'Tap the bell anytime from any screen.',
    placement: 'bottom'
  }
];

const MANAGER_STEPS: TutorialStep[] = [
  {
    targetId: 'tour-notification-bell',
    title: 'Approvals & Team Alerts',
    badge: 'Step 1 of 3 • Approvals Hub',
    description: 'Your central command for team management: approve pending leave requests, attendance unlock requests, overtime claims, and site reports.',
    actionTip: 'Badge number indicates actionable requests waiting for your sign-off.',
    placement: 'bottom'
  },
  {
    targetId: 'tour-main-punch',
    title: 'Manager Attendance Check-in',
    badge: 'Step 2 of 3 • Personal Punch',
    description: 'Log your own administrative or site inspection presence with a quick tap. Automatically records your duty hours for monthly payroll.',
    actionTip: 'Tap to punch in at start of day; tap to punch out at departure.',
    placement: 'bottom'
  },
  {
    targetId: 'tour-break-action',
    title: 'Duty Break Tracking',
    badge: 'Step 3 of 3 • Break Logging',
    description: 'Track your official office or field meal breaks. Helps maintain accurate compliant work hours and duty metrics.',
    actionTip: 'Tap "Take Break" and "Resume Work" when returning.',
    placement: 'top'
  }
];

function resolveTutorialRole(rawRole?: string): TutorialRole {
  if (!rawRole) return 'site_staff';
  const role = rawRole.toLowerCase();

  if (
    role.includes('manager') ||
    role.includes('admin') ||
    role.includes('director') ||
    role.includes('supervisor') ||
    role.includes('hr') ||
    role.includes('officer_in_charge')
  ) {
    return 'manager';
  }

  if (
    role.includes('field') ||
    role.includes('patrol') ||
    role.includes('inspector') ||
    role.includes('visiting')
  ) {
    return 'field_officer';
  }

  return 'site_staff';
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  isSimulatorOpen: false,
  isActive: false,
  isCertified: false,
  currentStepIndex: 0,
  activeRole: 'site_staff',
  steps: SITE_STAFF_STEPS,

  startTutorial: (role: TutorialRole, force = false) => {
    let steps = SITE_STAFF_STEPS;
    if (role === 'field_officer') steps = FIELD_OFFICER_STEPS;
    else if (role === 'manager') steps = MANAGER_STEPS;

    set({
      isActive: true,
      currentStepIndex: 0,
      activeRole: role,
      steps
    });
  },

  nextStep: () => {
    const { currentStepIndex, steps } = get();
    if (currentStepIndex + 1 < steps.length) {
      set({ currentStepIndex: currentStepIndex + 1 });
    } else {
      get().skipTutorial();
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  skipTutorial: () => {
    try {
      const authStorage = localStorage.getItem('paradigm-auth-storage');
      let userId: string | null = null;
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        userId = parsed?.state?.user?.id;
      }
      if (userId) {
        localStorage.setItem(`paradigm_tutorial_completed_${userId}`, 'true');
        console.log('[TutorialStore] Marked tutorial completed for user:', userId);
      }
    } catch (e) {
      // Ignore storage errors
    }
    set({ isActive: false, currentStepIndex: 0 });
  },

  openSimulator: (rawRole?: string) => {
    const role = resolveTutorialRole(rawRole);
    set({
      isSimulatorOpen: true,
      activeRole: role,
      isActive: false
    });
  },

  closeSimulator: (completed = false) => {
    let certified = get().isCertified;
    if (completed) {
      try {
        const authStorage = localStorage.getItem('paradigm-auth-storage');
        let userId: string | null = null;
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          userId = parsed?.state?.user?.id;
        }
        if (userId) {
          localStorage.setItem(`paradigm_tutorial_completed_${userId}`, 'true');
          localStorage.setItem(`paradigm_attendance_certified_${userId}`, 'true');
          certified = true;
          console.log('[TutorialStore] Marked tutorial simulation completed and certified for user:', userId);
        }
      } catch (e) {
        // Ignore
      }
    }
    set({ isSimulatorOpen: false, isCertified: certified });
  },

  checkCertification: (userId: string) => {
    if (!userId) return false;
    try {
      const isCert = localStorage.getItem(`paradigm_attendance_certified_${userId}`) === 'true';
      set({ isCertified: isCert });
      return isCert;
    } catch (e) {
      return false;
    }
  },

  checkAutoStart: (userId: string, role: string) => {
    if (!userId) return;
    try {
      get().checkCertification(userId);
      const hasCompleted = localStorage.getItem(`paradigm_tutorial_completed_${userId}`);
      console.log('[TutorialStore] checkAutoStart for user:', userId, 'hasCompleted:', hasCompleted, 'role:', role);
      if (!hasCompleted) {
        const resolvedRole = resolveTutorialRole(role);
        console.log('[TutorialStore] Auto-starting interactive voice simulator for role:', resolvedRole);
        // Small delay to allow page initialization
        setTimeout(() => {
          get().openSimulator(resolvedRole);
        }, 1200);
      }
    } catch (e) {
      console.error('[TutorialStore] Error in checkAutoStart:', e);
    }
  },

  replayTutorial: (rawRole: string) => {
    const role = resolveTutorialRole(rawRole);
    console.log('[TutorialStore] Replaying interactive voice simulator for role:', role);
    get().openSimulator(role);
  }
}));
