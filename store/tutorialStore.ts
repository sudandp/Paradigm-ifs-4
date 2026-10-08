import { create } from 'zustand';
import { supabase } from '../services/supabase';
import type { User } from '../types';

export type TutorialRole = 'site_staff' | 'field_officer' | 'manager';

export interface TutorialDemoState {
  isCheckedIn: boolean;
  siteWorkMode: 'duty' | 'ot';
  isSiteCheckedIn: boolean;
  isOnBreak: boolean;
  firstEntryTime?: string;
  firstBreakInTime?: string;
  lastBreakOutTime?: string;
  lastExitTime?: string;
}

const DEFAULT_DEMO_STATE: TutorialDemoState = {
  isCheckedIn: false,
  siteWorkMode: 'duty',
  isSiteCheckedIn: false,
  isOnBreak: false,
  firstEntryTime: undefined,
  firstBreakInTime: undefined,
  lastBreakOutTime: undefined,
  lastExitTime: undefined
};

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
  demoState: TutorialDemoState;
  
  setDemoState: (partial: Partial<TutorialDemoState>) => void;
  resetDemoState: () => void;
  startTutorial: (role: TutorialRole, force?: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  checkAutoStart: (userOrId: string | (Partial<User> & { id: string }), role?: string) => Promise<void>;
  replayTutorial: (role: string) => void;
  openSimulator: (role?: string) => void;
  closeSimulator: (completed?: boolean) => void;
  checkCertification: (userId: string) => boolean;
}

const SITE_STAFF_STEPS: TutorialStep[] = [
  {
    targetId: 'tour-main-punch',
    title: 'Daily Shift Start',
    badge: 'Step 1 of 8 • Shift Arrival',
    description: 'Tap the green glowing PUNCH IN orb to start your shift with biometric facial verification.',
    actionTip: 'Must punch within your assigned site boundary or biometric window.',
    placement: 'bottom'
  },
  {
    targetId: 'tour-entry-card',
    title: 'Recorded Punch Time',
    badge: 'Step 2 of 8 • Verified Entry Log',
    description: 'Your punch-in time is verified and recorded at First Entry with your exact timestamp.',
    actionTip: 'You can verify your daily logged hours and session status here anytime.',
    placement: 'bottom'
  },
  {
    targetId: 'tour-duty-mode',
    title: 'Duty Mode Selection',
    badge: 'Step 3 of 8 • Regular vs Site Duty',
    description: 'Switch between Regular Duty (standard assigned shift) and Site Duty (relieving / overtime). Your work calculations and multipliers dynamically adjust.',
    actionTip: 'Select your preferred duty mode before checking in.',
    placement: 'top'
  },
  {
    targetId: 'tour-site-action',
    title: 'Client Site Arrival',
    badge: 'Step 4 of 8 • Client Check In',
    description: 'When arriving at a client facility for inspection, meeting, or training, tap "Check In" to log your GPS-verified entry timestamp.',
    actionTip: 'Logs your entry timestamp and exact GPS site location automatically.',
    placement: 'top'
  },
  {
    targetId: 'tour-site-action',
    title: 'Client Site Departure',
    badge: 'Step 5 of 8 • Client Check Out',
    description: 'When your site inspection, meeting, or training is finished, tap "Check Out" to record your departure timestamp.',
    actionTip: 'Completes your client visit and logs active site duration.',
    placement: 'top'
  },
  {
    targetId: 'tour-break-action',
    title: 'Meal & Tea Breaks',
    badge: 'Step 6 of 8 • Break Tracking',
    description: 'Taking lunch or a tea break? Tap "Take Break" to pause your active duty timer. When finished, tap "Resume Work" to return to duty.',
    actionTip: 'Audio alarms will remind you 5 minutes before break expires.',
    placement: 'top'
  },
  {
    targetId: 'tour-break-action',
    title: 'Resume Active Duty',
    badge: 'Step 7 of 8 • Resume Duty',
    description: 'Break finished? Tap "Resume Work" to restart your shift timer and return to duty.',
    actionTip: 'Always tap Resume Work when arriving back on duty.',
    placement: 'top'
  },
  {
    targetId: 'tour-main-punch',
    title: 'Shift Completion',
    badge: 'Step 8 of 8 • Shift Checkout',
    description: 'At the end of your workday, tap the red PUNCH OUT orb to conclude your shift and record total payable hours.',
    actionTip: 'Calculates total payable duty hours for payroll.',
    placement: 'bottom'
  },
  {
    targetId: 'tour-main-punch',
    title: 'Certified Employee',
    badge: 'Certified • Operations Ready',
    description: 'Congratulations! You are officially certified and ready for live duty.',
    actionTip: 'You have mastered the complete operational workflow.',
    placement: 'center'
  }
];

const FIELD_OFFICER_STEPS: TutorialStep[] = [...SITE_STAFF_STEPS];

const MANAGER_STEPS: TutorialStep[] = [...SITE_STAFF_STEPS];

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
  demoState: { ...DEFAULT_DEMO_STATE },

  setDemoState: (partial: Partial<TutorialDemoState>) => {
    set(state => ({
      demoState: {
        ...state.demoState,
        ...partial
      }
    }));
  },

  resetDemoState: () => {
    set({ demoState: { ...DEFAULT_DEMO_STATE } });
  },

  startTutorial: (role: TutorialRole, force = false) => {
    let steps = SITE_STAFF_STEPS;
    if (role === 'field_officer') steps = FIELD_OFFICER_STEPS;
    else if (role === 'manager') steps = MANAGER_STEPS;

    set({
      isActive: true,
      currentStepIndex: 0,
      activeRole: role,
      steps,
      demoState: { ...DEFAULT_DEMO_STATE }
    });
  },

  nextStep: () => {
    const { currentStepIndex, steps, demoState } = get();
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const updatedDemo: TutorialDemoState = { ...demoState };

      // Auto-apply completion state for each preceding step up to nextIndex
      if (nextIndex >= 1) {
        // Step 1+ means Shift Punch-In has been completed
        updatedDemo.isCheckedIn = true;
        if (!updatedDemo.firstEntryTime) updatedDemo.firstEntryTime = nowTime;
        updatedDemo.siteWorkMode = updatedDemo.siteWorkMode || 'duty';
      }
      if (nextIndex >= 4) {
        // Step 4 is site_out, which requires site_in to have been completed
        updatedDemo.isSiteCheckedIn = true;
      }
      if (nextIndex >= 5) {
        // Step 5 is break_in, which requires site visit to be checked out
        updatedDemo.isSiteCheckedIn = false;
      }
      if (nextIndex >= 6) {
        // Step 6 is break_out, which requires break_in to be active
        updatedDemo.isOnBreak = true;
        if (!updatedDemo.firstBreakInTime) updatedDemo.firstBreakInTime = nowTime;
      }
      if (nextIndex >= 7) {
        // Step 7 is punch_out, which requires break to have been resumed
        updatedDemo.isOnBreak = false;
        if (!updatedDemo.lastBreakOutTime) updatedDemo.lastBreakOutTime = nowTime;
      }
      if (nextIndex >= 8) {
        // Step 8 is completed certification, which requires shift punch out
        updatedDemo.isCheckedIn = false;
        updatedDemo.isOnBreak = false;
        updatedDemo.isSiteCheckedIn = false;
        if (!updatedDemo.lastExitTime) updatedDemo.lastExitTime = nowTime;
      }

      set({ 
        currentStepIndex: nextIndex,
        demoState: updatedDemo
      });
    } else {
      get().skipTutorial();
    }
  },

  prevStep: () => {
    const { currentStepIndex, steps, demoState } = get();
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      const updatedDemo: TutorialDemoState = { ...demoState };

      if (prevIndex === 0) {
        updatedDemo.isCheckedIn = false;
        updatedDemo.isSiteCheckedIn = false;
        updatedDemo.isOnBreak = false;
      } else if (prevIndex < 4) {
        updatedDemo.isCheckedIn = true;
        updatedDemo.isSiteCheckedIn = false;
        updatedDemo.isOnBreak = false;
      } else if (prevIndex === 4) {
        updatedDemo.isCheckedIn = true;
        updatedDemo.isSiteCheckedIn = true;
        updatedDemo.isOnBreak = false;
      } else if (prevIndex === 5) {
        updatedDemo.isCheckedIn = true;
        updatedDemo.isSiteCheckedIn = false;
        updatedDemo.isOnBreak = false;
      } else if (prevIndex === 6) {
        updatedDemo.isCheckedIn = true;
        updatedDemo.isOnBreak = true;
      } else if (prevIndex === 7) {
        updatedDemo.isCheckedIn = true;
        updatedDemo.isOnBreak = false;
      }

      set({ currentStepIndex: prevIndex, demoState: updatedDemo });
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
    set({ isActive: false, currentStepIndex: 0, demoState: { ...DEFAULT_DEMO_STATE } });
  },

  openSimulator: (rawRole?: string) => {
    const role = resolveTutorialRole(rawRole);
    set({
      isActive: true,
      isSimulatorOpen: false,
      currentStepIndex: 0,
      activeRole: role,
      demoState: { ...DEFAULT_DEMO_STATE }
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
    set({ isSimulatorOpen: false, isActive: false, isCertified: certified, demoState: { ...DEFAULT_DEMO_STATE } });
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

  checkAutoStart: async (userOrId: string | (Partial<User> & { id: string }), rawRole?: string) => {
    try {
      const userObj = typeof userOrId === 'object' ? userOrId : null;
      const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
      const role = rawRole || (typeof userOrId === 'object' ? userOrId.role : '') || '';

      if (!userId) return;

      get().checkCertification(userId);
      const hasCompleted = localStorage.getItem(`paradigm_tutorial_completed_${userId}`);
      if (hasCompleted === 'true') {
        return;
      }

      // ── CRITICAL DIRECTIVE: Auto-launch ONLY for newly enrolled users (< 7 days) with ZERO punches ──
      // 1. Enrollment date check (joiningDate or createdAt)
      const dateStr = userObj?.joiningDate || userObj?.createdAt;
      if (!dateStr) {
        // If neither joining date nor created_at is present, this is an existing / old user
        console.log('[TutorialStore] No recent enrollment date found. Auto-launch skipped for existing user:', userId);
        localStorage.setItem(`paradigm_tutorial_completed_${userId}`, 'true');
        return;
      }

      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        console.log('[TutorialStore] Invalid enrollment date. Auto-launch skipped for user:', userId);
        localStorage.setItem(`paradigm_tutorial_completed_${userId}`, 'true');
        return;
      }

      const diffDays = (Date.now() - parsedDate.getTime()) / (1000 * 60 * 60 * 24);
      // If joined > 7 days ago, this is an old user -> DO NOT auto-launch
      if (diffDays > 7 || diffDays < 0) {
        console.log(`[TutorialStore] User enrolled ${Math.round(diffDays)} days ago (> 7 days). Auto-launch skipped for old user:`, userId);
        localStorage.setItem(`paradigm_tutorial_completed_${userId}`, 'true');
        return;
      }

      // 2. Punch history check: Must have ZERO previous punches
      const { count: punchCount, error: punchErr } = await supabase
        .from('attendance_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (punchErr) {
        console.warn('[TutorialStore] Error checking attendance_events, skipping auto-launch safely:', punchErr);
        return;
      }

      if (punchCount && punchCount > 0) {
        console.log(`[TutorialStore] User has ${punchCount} previous attendance punch(es). Auto-launch skipped for experienced user:`, userId);
        localStorage.setItem(`paradigm_tutorial_completed_${userId}`, 'true');
        return;
      }

      // Also check device_logs if biometricId is mapped
      if (userObj?.biometricId) {
        const { count: bioCount } = await supabase
          .from('device_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userObj.biometricId);

        if (bioCount && bioCount > 0) {
          console.log(`[TutorialStore] User has ${bioCount} biometric device log(s). Auto-launch skipped for experienced user:`, userId);
          localStorage.setItem(`paradigm_tutorial_completed_${userId}`, 'true');
          return;
        }
      }

      // All criteria passed: newly enrolled user (< 7 days) and exactly 0 punches
      const resolvedRole = resolveTutorialRole(role);
      console.log(`[TutorialStore] Auto-starting live real-screen virtual coach for newly enrolled user (${Math.round(diffDays)}d enrolled, 0 punches):`, userId);
      
      setTimeout(() => {
        get().replayTutorial(resolvedRole);
      }, 1200);
    } catch (e) {
      console.error('[TutorialStore] Error in checkAutoStart:', e);
    }
  },

  replayTutorial: (rawRole: string) => {
    const role = resolveTutorialRole(rawRole);
    console.log('[TutorialStore] Starting live real-screen virtual coach for role:', role);
    set({
      isActive: true,
      isSimulatorOpen: false,
      currentStepIndex: 0,
      activeRole: role,
      demoState: { ...DEFAULT_DEMO_STATE }
    });
  }
}));
