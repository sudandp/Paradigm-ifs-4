




import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AddressSettings, AttendanceSettings, Holiday, GmcPolicySettings, PerfiosApiSettings, GeminiApiSettings, OfflineOcrSettings, OtpSettings, ApiSettings, NotificationSettings, VerificationCosts, VerificationCostSetting, SiteManagementSettings, StaffAttendanceRules, RecurringHolidayRule } from '../types';
import { api } from '../services/api';
import { HOLIDAY_SELECTION_POOL } from '../utils/constants';

interface SettingsState {
  address: AddressSettings;
  attendance: AttendanceSettings;
  officeHolidays: Holiday[];
  fieldHolidays: Holiday[];
  siteHolidays: Holiday[];
  gmcPolicy: GmcPolicySettings;
  perfiosApi: PerfiosApiSettings;
  geminiApi: GeminiApiSettings;
  otp: OtpSettings;
  notifications: NotificationSettings;
  verificationCosts: VerificationCosts;
  siteManagement: SiteManagementSettings;
  apiSettings: ApiSettings;
  offlineOcr: OfflineOcrSettings;
  recurringHolidays: RecurringHolidayRule[];
  initSettings: (data: { 
    holidays: Holiday[], 
    attendanceSettings: AttendanceSettings, 
    recurringHolidays: RecurringHolidayRule[], 
    apiSettings?: ApiSettings,
    addressSettings?: AddressSettings,
    geminiApiSettings?: GeminiApiSettings,
    offlineOcrSettings?: OfflineOcrSettings,
    perfiosApiSettings?: PerfiosApiSettings,
    otpSettings?: OtpSettings,
    siteManagementSettings?: SiteManagementSettings,
    notificationSettings?: NotificationSettings,
  }) => void;
  updateAddressSettings: (settings: Partial<AddressSettings>) => void;
  updateAttendanceSettings: (settings: AttendanceSettings) => void;
  updateGmcPolicySettings: (settings: Partial<GmcPolicySettings>) => void;
  updatePerfiosApiSettings: (settings: Partial<PerfiosApiSettings>) => void;
  updateGeminiApiSettings: (settings: Partial<GeminiApiSettings>) => void;
  updateOtpSettings: (settings: Partial<OtpSettings>) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  updateVerificationCosts: (costs: VerificationCosts) => void;
  updateSiteManagementSettings: (settings: Partial<SiteManagementSettings>) => void;
  updateApiSettings: (settings: Partial<ApiSettings>) => void;
  updateOfflineOcrSettings: (settings: Partial<OfflineOcrSettings>) => void;
  addHoliday: (type: 'office' | 'field' | 'site', holiday: Omit<Holiday, 'id' | 'type'>) => Promise<void>;
  removeHoliday: (type: 'office' | 'field' | 'site', id: string) => Promise<void>;
  addRecurringHoliday: (rule: RecurringHolidayRule) => Promise<void>;
  removeRecurringHoliday: (id: string) => Promise<void>;
}

const initialAddress: AddressSettings = {
  enablePincodeVerification: true,
};

const initialAttendance: AttendanceSettings = {
  office: {
    minimumHoursFullDay: 8,
    minimumHoursHalfDay: 4,
    annualEarnedLeaves: 0,
    annualSickLeaves: 0,
    monthlyFloatingLeaves: 0,
    annualCompOffLeaves: 0,
    enableAttendanceNotifications: false,
    sickLeaveCertificateThreshold: 2,
    geofencingEnabled: false,
    maxViolationsPerMonth: 3,
    fixedOfficeHours: {
      checkInTime: '09:00',
      checkOutTime: '18:00',
    },
    dailyWorkingHours: {
      min: 7,
      max: 9,
    },
    monthlyTargetHours: 216,
    enableHoursBasedCalculation: true,
    enableBreakTracking: true,
    lunchBreakDuration: 60,
    maxHolidaysPerCategory: 10,
    adminAllocatedHolidays: 5,
    employeeHolidays: 6,
    enableCustomHolidays: false,
    holidayPool: [...HOLIDAY_SELECTION_POOL],
    weeklyOffDays: [0], // Sunday
  },
  field: {
    minimumHoursFullDay: 9,
    minimumHoursHalfDay: 5,
    annualEarnedLeaves: 0,
    annualSickLeaves: 0,
    monthlyFloatingLeaves: 0,
    annualCompOffLeaves: 0,
    enableAttendanceNotifications: true,
    sickLeaveCertificateThreshold: 3,
    geofencingEnabled: true,
    maxViolationsPerMonth: 3,
    weeklyOffDays: [0], // Sunday
    fixedOfficeHours: {
      checkInTime: '09:00',
      checkOutTime: '18:00',
    },
    dailyWorkingHours: {
      min: 7,
      max: 9,
    },
    minimumSitePercentage: 75,
    maximumTravelPercentage: 25,
    enableSiteTimeTracking: true,
    maxHolidaysPerCategory: 10,
    adminAllocatedHolidays: 5,
    employeeHolidays: 6,
    enableCustomHolidays: false,
    holidayPool: [...HOLIDAY_SELECTION_POOL],
  },
  site: {
    minimumHoursFullDay: 9,
    minimumHoursHalfDay: 5,
    annualEarnedLeaves: 0,
    annualSickLeaves: 0,
    monthlyFloatingLeaves: 0,
    annualCompOffLeaves: 0,
    enableAttendanceNotifications: true,
    sickLeaveCertificateThreshold: 3,
    geofencingEnabled: true,
    maxViolationsPerMonth: 3,
    fixedOfficeHours: {
      checkInTime: '09:00',
      checkOutTime: '18:00',
    },
    dailyWorkingHours: {
      min: 7,
      max: 9,
    },
    maxHolidaysPerCategory: 10,
    adminAllocatedHolidays: 5,
    employeeHolidays: 6,
    enableCustomHolidays: false,
    holidayPool: [...HOLIDAY_SELECTION_POOL],
  }
};

const initialGmcPolicy: GmcPolicySettings = {
  applicability: 'Optional - Opt-in Default',
  optInDisclaimer: 'Please note that currently the GMC facility covers only spouse and two children. If you would like to continue, please select below relationships and submit.',
  coverageDetails: 'Spouse and two children',
  optOutDisclaimer: 'Please note that you are opting out of the GMC Facility. You will have to submit a declaration to the company towards the same along with proof of your existing insurance.',
  requireAlternateInsurance: true,
  collectProvider: true,
  collectStartDate: true,
  collectEndDate: true,
  collectExtentOfCover: true,
};

const initialPerfiosApi: PerfiosApiSettings = {
  enabled: true,
  clientId: '',
  clientSecret: '',
};

const initialGeminiApi: GeminiApiSettings = {
  enabled: true,
};

const initialOtp: OtpSettings = {
  enabled: true,
};

const initialOfflineOcr: OfflineOcrSettings = {
  enabled: false,
};

const initialApiSettings: ApiSettings = {
  autoBackupEnabled: false,
  backupSchedule: {
    frequency: 'daily',
    startTime: '00:00',
    interval: 1,
    dayOfWeek: 0,
    dayOfMonth: 1,
    monthOfYear: 1,
  },
  appVersion: '1.0.0',
  oneSignalAppId: ''
};


const initialNotifications: NotificationSettings = {
  email: {
    enabled: false,
  }
};

const initialVerificationCosts: VerificationCostSetting[] = [
  { id: 'cost_1', name: 'Profile Picture', cost: 0 },
  { id: 'cost_2', name: 'Mobile to Form Prefill', cost: 7 },
  { id: 'cost_3', name: 'KYC OCR (Plus)', cost: 1.50 },
  { id: 'cost_4', name: 'Aadhaar Mobile Link', cost: 2.5 },
  { id: 'cost_5', name: 'EPF UAN Lookup', cost: 2.50 },
  { id: 'cost_6', name: 'Cheque OCR', cost: 3 },
  { id: 'cost_7', name: 'Bank AC Verification Advanced', cost: 2.25 },
  { id: 'cost_8', name: 'PAN Profile Detailed', cost: 5 },
  { id: 'cost_9', name: 'Aadhaar Verification', cost: 1.75 },
  { id: 'cost_10', name: 'Voter ID OCR', cost: 1.50 },
  { id: 'cost_11', name: 'Driving License OCR', cost: 1.50 },
  { id: 'cost_12', name: 'Education Certificate OCR', cost: 2.00 },
  { id: 'cost_13', name: 'Experience/Salary Slip OCR', cost: 2.00 },
  { id: 'cost_14', name: 'ESI Card OCR', cost: 1.50 },
];

const initialSiteManagement: SiteManagementSettings = {
  enableProvisionalSites: false,
};

// FIX: Corrected zustand store creation with persist middleware to ensure proper typing.
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      address: initialAddress,
      attendance: initialAttendance,
      officeHolidays: [],
      fieldHolidays: [],
      siteHolidays: [],
      recurringHolidays: [],
      gmcPolicy: initialGmcPolicy,
      perfiosApi: initialPerfiosApi,
      geminiApi: initialGeminiApi,
      otp: initialOtp,
      notifications: initialNotifications,
      verificationCosts: initialVerificationCosts,
      siteManagement: initialSiteManagement,
      apiSettings: initialApiSettings,
      offlineOcr: initialOfflineOcr,
      initSettings: (data) => {
        if (data) {
          const { 
            holidays, attendanceSettings, recurringHolidays, apiSettings,
            addressSettings, geminiApiSettings, offlineOcrSettings, perfiosApiSettings,
            otpSettings, siteManagementSettings, notificationSettings
          } = data;
          const office = holidays.filter(h => h.type === 'office');
          const field = holidays.filter(h => h.type === 'field');
          const site = holidays.filter(h => h.type === 'site');
          set({ 
            officeHolidays: office, 
            fieldHolidays: field, 
            siteHolidays: site, 
            attendance: attendanceSettings, 
            recurringHolidays: recurringHolidays || [],
            apiSettings: apiSettings ? { ...initialApiSettings, ...apiSettings } : initialApiSettings,
            address: addressSettings || initialAddress,
            geminiApi: geminiApiSettings || initialGeminiApi,
            offlineOcr: offlineOcrSettings || initialOfflineOcr,
            perfiosApi: perfiosApiSettings || initialPerfiosApi,
            otp: otpSettings || initialOtp,
            siteManagement: siteManagementSettings || initialSiteManagement,
            notifications: notificationSettings || initialNotifications,
          });
        }
      },
      updateAddressSettings: (settings) => set((state) => ({
        address: { ...state.address, ...settings }
      })),
      updateAttendanceSettings: (settings) => set({ attendance: settings }),
      updateGmcPolicySettings: (settings) => set((state) => ({
        gmcPolicy: { ...state.gmcPolicy, ...settings }
      })),
      updatePerfiosApiSettings: (settings) => set((state) => ({
        perfiosApi: { ...state.perfiosApi, ...settings }
      })),
      updateGeminiApiSettings: (settings) => set((state) => ({
        geminiApi: { ...state.geminiApi, ...settings }
      })),
      updateOtpSettings: (settings) => set((state) => ({
        otp: { ...state.otp, ...settings }
      })),
      updateNotificationSettings: (settings) => set((state) => ({
        notifications: {
          ...state.notifications,
          ...settings,
          email: { ...state.notifications.email, ...settings.email }
        }
      })),
      updateVerificationCosts: (costs) => set({ verificationCosts: costs }),
      updateSiteManagementSettings: (settings) => set((state) => ({
        siteManagement: { ...state.siteManagement, ...settings }
      })),
      updateApiSettings: (settings) => set((state) => ({
        apiSettings: { ...state.apiSettings, ...settings }
      })),
      updateOfflineOcrSettings: (settings) => set((state) => ({
        offlineOcr: { ...state.offlineOcr, ...settings }
      })),
      addHoliday: async (type, holiday) => {
        const newHoliday = await api.addHoliday({ ...holiday, type });
        set((state) => {
          const key = type === 'office' ? 'officeHolidays' : type === 'field' ? 'fieldHolidays' : 'siteHolidays';
          const newHolidays = [...state[key], newHoliday].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          return { [key]: newHolidays };
        });
      },
      removeHoliday: async (type, id) => {
        await api.removeHoliday(id);
        set((state) => {
          const key = type === 'office' ? 'officeHolidays' : type === 'field' ? 'fieldHolidays' : 'siteHolidays';
          return { [key]: state[key].filter(h => h.id !== id) };
        });
      },
      addRecurringHoliday: async (rule) => {
        const newRule = await api.addRecurringHoliday(rule);
        set((state) => ({
          recurringHolidays: [...state.recurringHolidays, newRule]
        }));
      },
      removeRecurringHoliday: async (id) => {
        await api.deleteRecurringHoliday(id);
        set((state) => ({
          recurringHolidays: state.recurringHolidays.filter(h => h.id !== id)
        }));
      },
    }),
    {
      name: 'paradigm_app_settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);