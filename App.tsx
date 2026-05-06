// Trigger Rebuild: 2026-01-08 18:25
// App.tsx
import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { secureSet, secureRemove, secureGet } from './utils/secureStorage';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { useEnrollmentRulesStore } from './store/enrollmentRulesStore';
import { usePermissionsStore } from './store/permissionsStore';
import { useSettingsStore } from './store/settingsStore';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useDevice } from './hooks/useDevice';
import { supabase } from './services/supabase';
import { authService } from './services/authService';
import { GOOGLE_CONFIG } from './config/authConfig';
// Import the API client under an alias to avoid name collisions.  Renaming
// to `apiService` prevents conflicts with other variables or globals named `api`.
import { api as apiService } from './services/api';
import type { User } from './types';
import { useOnboardingStore } from './store/onboardingStore';
import { usePWAStore } from './store/pwaStore';
import { useNotificationStore } from './store/notificationStore';
import { syncService } from './services/offline/syncService';
import OfflineStatusBanner from './components/OfflineStatusBanner';
import { pushNotificationService } from './services/pushNotificationService';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { Toaster } from 'react-hot-toast';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useScreenOrientation } from './hooks/useScreenOrientation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { cancelStepBreakReminders, scheduleStepBreakReminders, registerBreakNotificationActions, updateBreakReminderChannelSound } from './utils/permissionUtils';
import BreakAlertModal from './components/attendance/BreakAlertModal';
import { useBreakAlertStore } from './store/breakAlertStore';


import { AlertTriangle } from 'lucide-react';
import { withTimeout } from './utils/async';
import { lazyWithRetry } from './utils/lazyLoad';
import { useAppUpdate } from './hooks/useAppUpdate';
import { UpdatePromptModal } from './components/UpdatePromptModal';
import UpdateRequiredBanner, { isVersionOutdated } from './components/UpdateRequiredBanner';
import { APP_VERSION } from './src/config/appVersion';

// Layouts
import MainLayout from './components/layouts/MainLayout';
import MobileLayout from './components/layouts/MobileLayout';
import AuthLayout from './components/layouts/AuthLayout';
import SecurityWrapper from './components/SecurityWrapper';

// Pages
import Splash from './pages/Splash';
import Login from './pages/auth/Login';

const MobileHome = lazyWithRetry(() => import('./pages/MobileHome'));
const SignUp = lazyWithRetry(() => import('./pages/auth/SignUp'));
const ForgotPassword = lazyWithRetry(() => import('./pages/auth/ForgotPassword'));
const UpdatePassword = lazyWithRetry(() => import('./pages/auth/UpdatePassword'));
const LogoutPage = lazyWithRetry(() => import('./pages/auth/LogoutPage'));
const PendingApproval = lazyWithRetry(() => import('./pages/PendingApproval'));
const BlockedAccessPage = lazyWithRetry(() => import('./components/auth/BlockedAccessPage'));
const Forbidden = lazyWithRetry(() => import('./pages/Forbidden'));
const OnboardingHome = lazyWithRetry(() => import('./pages/OnboardingHome'));
const SelectOrganization = lazyWithRetry(() => import('./pages/onboarding/SelectOrganization'));
const AddEmployee = lazyWithRetry(() => import('./pages/onboarding/AddEmployee'));
const VerificationDashboard = lazyWithRetry(() => import('./pages/verification/VerificationDashboard'));
const UserManagement = lazyWithRetry(() => import('./pages/admin/UserManagement'));
const BulkEarnedLeavePage = lazyWithRetry(() => import('./pages/admin/BulkEarnedLeavePage'));
const SiteManagement = lazyWithRetry(() => import('./pages/admin/OrganizationManagement').then(m => ({ default: m.SiteManagement })));
const RoleManagement = lazyWithRetry(() => import('./pages/admin/RoleManagement'));
const ModuleManagement = lazyWithRetry(() => import('./pages/admin/ModuleManagement'));
const ManageDevices = lazyWithRetry(() => import('./pages/admin/ManageDevices'));
const DeviceApprovals = lazyWithRetry(() => import('./pages/admin/DeviceApprovals'));
const KioskManagement = lazyWithRetry(() => import('./pages/admin/KioskManagement'));
const AdvancedNotificationSettings = lazyWithRetry(() => import('./pages/admin/AdvancedNotificationSettings'));
const ApiSettings = lazyWithRetry(() => import('./pages/developer/ApiSettings').then(m => ({ default: m.ApiSettings })));
const OperationsDashboard = lazyWithRetry(() => import('./pages/operations/OperationsDashboard'));
const TeamActivity = lazyWithRetry(() => import('./pages/operations/TeamActivity'));
const SiteDashboard = lazyWithRetry(() => import('./pages/site/OrganizationDashboard'));
const ProfilePage = lazyWithRetry(() => import('./pages/profile/ProfilePage'));
const AttendanceDashboard = lazyWithRetry(() => import('./pages/attendance/AttendanceDashboard'));
const DeviceManagement = lazyWithRetry(() => import('./pages/settings/DeviceManagement'));
const MyLocations = lazyWithRetry(() => import('./pages/attendance/MyLocations'));
const AttendanceActionPage = lazyWithRetry(() => import('./pages/attendance/AttendanceActionPage'));
const RequestUnlockPage = lazyWithRetry(() => import('./pages/attendance/RequestUnlockPage'));
const AttendanceSettings = lazyWithRetry(() => import('./pages/hr/AttendanceSettings'));
const NotificationsControl = lazyWithRetry(() => import('./pages/hr/NotificationsControl'));
const LeaveDashboard = lazyWithRetry(() => import('./pages/leaves/LeaveDashboard'));
const ApplyLeave = lazyWithRetry(() => import('./pages/leaves/ApplyLeave'));
const HolidaySelectionPage = lazyWithRetry(() => import('./pages/leaves/HolidaySelectionPage'));
const LeaveManagement = lazyWithRetry(() => import('./pages/hr/LeaveManagement'));
const FamilyVerification = lazyWithRetry(() => import('./pages/hr/FamilyVerification'));
const ApprovalWorkflow = lazyWithRetry(() => import('./pages/admin/ApprovalWorkflow'));
const WorkflowChartFullScreen = lazyWithRetry(() => import('./pages/admin/WorkflowChartFullScreen'));
const TaskManagement = lazyWithRetry(() => import('./pages/tasks/TaskManagement'));
const EntityManagement = lazyWithRetry(() => import('./pages/hr/EntityManagement'));
const PoliciesAndInsurance = lazyWithRetry(() => import('./pages/hr/PoliciesAndInsurance'));
const EnrollmentRules = lazyWithRetry(() => import('./pages/hr/EnrollmentRules'));
const OnboardingPdfOutput = lazyWithRetry(() => import('./pages/onboarding/OnboardingPdfOutput'));
const UniformDashboard = lazyWithRetry(() => import('./pages/uniforms/UniformDashboard'));
const CostAnalysis = lazyWithRetry(() => import('./pages/billing/CostAnalysis'));
const InvoiceSummary = lazyWithRetry(() => import('./pages/billing/InvoiceSummary'));
const SiteAttendanceTracker = lazyWithRetry(() => import('./pages/billing/SiteAttendanceTracker'));
const AddSiteAttendanceRecord = lazyWithRetry(() => import('./pages/forms/AddSiteAttendanceRecord'));
const SiteFinanceTracker = lazyWithRetry(() => import('./pages/finance/SiteFinanceTracker'));
const FinanceModule = lazyWithRetry(() => import('./pages/finance/FinanceModule'));
const AddSiteFinanceRecord = lazyWithRetry(() => import('./pages/finance/AddSiteFinanceRecord'));
const FieldStaffTracking = lazyWithRetry(() => import('./pages/hr/FieldStaffTracking'));
const LocationManagement = lazyWithRetry(() => import('./pages/hr/LocationManagement'));
const PreUpload = lazyWithRetry(() => import('./pages/onboarding/PreUpload'));
const MySubmissions = lazyWithRetry(() => import('./pages/onboarding/MySubmissions'));
const MyTasks = lazyWithRetry(() => import('./pages/onboarding/MyTasks'));
const UniformRequests = lazyWithRetry(() => import('./pages/onboarding/UniformRequests'));
const SupportDashboard = lazyWithRetry(() => import('./pages/support/SupportDashboard'));
const TicketDetail = lazyWithRetry(() => import('./pages/support/TicketDetail'));
const Alerts = lazyWithRetry(() => import('./pages/support/Alerts'));
const MyTeam = lazyWithRetry(() => import('./pages/my-team/MyTeamPage'));
const FieldReports = lazyWithRetry(() => import('./pages/my-team/FieldReports'));
const Tasks = lazyWithRetry(() => import('./pages/tasks/TaskManagement'));
const TeamMemberProfile = lazyWithRetry(() => import('./pages/my-team/TeamMemberProfile'));
const ReportingStructure = lazyWithRetry(() => import('./pages/my-team/ReportingStructure'));

// Form Pages
const AddUserPage = lazyWithRetry(() => import('./pages/forms/AddUserPage'));
const AddPolicyPage = lazyWithRetry(() => import('./pages/forms/AddPolicyPage'));
const NewTicketPage = lazyWithRetry(() => import('./pages/forms/NewTicketPage'));
const AddGroupPage = lazyWithRetry(() => import('./pages/forms/AddGroupPage'));
const GrantCompOffPage = lazyWithRetry(() => import('./pages/forms/GrantCompOffPage'));
const AddModulePage = lazyWithRetry(() => import('./pages/forms/AddModulePage'));
const AddRolePage = lazyWithRetry(() => import('./pages/forms/AddRolePage'));
const AddSitePage = lazyWithRetry(() => import('./pages/forms/AddSitePage'));
const QuickAddSitePage = lazyWithRetry(() => import('./pages/forms/QuickAddSitePage'));
const AddTaskPage = lazyWithRetry(() => import('./pages/forms/AddTaskPage'));
const NewUniformRequestPage = lazyWithRetry(() => import('./pages/forms/NewUniformRequestPage'));

// CRM Module
const CrmDashboard = lazyWithRetry(() => import('./pages/crm/CrmDashboard'));
const LeadDetail = lazyWithRetry(() => import('./pages/crm/LeadDetail'));
const ChecklistBuilder = lazyWithRetry(() => import('./pages/crm/ChecklistBuilder'));
const SiteSurveyForm = lazyWithRetry(() => import('./pages/crm/SiteSurveyForm'));
const QuotationBuilder = lazyWithRetry(() => import('./pages/crm/QuotationBuilder'));

// Operations Module (Phase 2)
const HelpdeskTickets = lazyWithRetry(() => import('./pages/operations/HelpdeskTickets'));
const MaintenanceScheduler = lazyWithRetry(() => import('./pages/operations/MaintenanceScheduler'));
const ContractManager = lazyWithRetry(() => import('./pages/operations/ContractManager'));

// Finance Module (Phase 3)
const ProfitabilityDashboard = lazyWithRetry(() => import('./pages/finance/ProfitabilityDashboard'));
const PaymentTracker = lazyWithRetry(() => import('./pages/finance/PaymentTracker'));

// Enterprise Controls (Phase 4)
const ApprovalsInbox = lazyWithRetry(() => import('./pages/enterprise/ApprovalsInbox'));
const AuditTrail = lazyWithRetry(() => import('./pages/enterprise/AuditTrail'));

// Referral Module
const EmployeeReferralForm = lazyWithRetry(() => import('./pages/referral/EmployeeReferralForm'));
const BusinessReferralForm = lazyWithRetry(() => import('./pages/referral/BusinessReferralForm'));
const ReferralManagement = lazyWithRetry(() => import('./pages/referral/ReferralManagement'));

// Gate Attendance Module
const GateKiosk = lazyWithRetry(() => import('./pages/gate/GateKiosk'));
const RegisterGateUser = lazyWithRetry(() => import('./pages/gate/RegisterGateUser'));
const GateAttendanceLogs = lazyWithRetry(() => import('./pages/gate/GateAttendanceLogs'));

// Onboarding Form Steps
const PersonalDetails = lazyWithRetry(() => import('./pages/onboarding/PersonalDetails'));
const AddressDetails = lazyWithRetry(() => import('./pages/onboarding/AddressDetails'));
const OrganizationDetails = lazyWithRetry(() => import('./pages/onboarding/OrganizationDetails'));
const FamilyDetails = lazyWithRetry(() => import('./pages/onboarding/FamilyDetails'));
const EducationDetails = lazyWithRetry(() => import('./pages/onboarding/EducationDetails'));
const BankDetails = lazyWithRetry(() => import('./pages/onboarding/BankDetails'));
const UanDetails = lazyWithRetry(() => import('./pages/onboarding/UanDetails'));
const EsiDetails = lazyWithRetry(() => import('./pages/onboarding/EsiDetails'));
const GmcDetails = lazyWithRetry(() => import('./pages/onboarding/GmcDetails'));
const UniformDetails = lazyWithRetry(() => import('./pages/onboarding/UniformDetails'));
const Documents = lazyWithRetry(() => import('./pages/onboarding/Documents'));
const Biometrics = lazyWithRetry(() => import('./pages/onboarding/Biometrics'));
const Review = lazyWithRetry(() => import('./pages/onboarding/Review'));
const AadhaarScannerPage = lazyWithRetry(() => import('./pages/onboarding/AadhaarScannerPage'));

// Public Forms
const FormsSelection = lazyWithRetry(() => import('./pages/public/FormsSelection'));
const GMCForm = lazyWithRetry(() => import('./pages/public/GMCForm'));

// Image Viewer
const DocumentViewerPage = lazyWithRetry(() => import('./pages/DocumentViewerPage'));

// Components
import ProtectedRoute from './components/auth/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import { App as CapacitorApp } from '@capacitor/app';

// Theme Manager
const ThemeManager: React.FC = () => {
  const { theme, isAutomatic, _setThemeInternal } = useThemeStore();
  const { isMobile } = useDevice();
  useEffect(() => {
    const body = document.body;
    let newTheme = 'light';

    if (isAutomatic) {
      newTheme = isMobile ? 'dark' : 'light';
    } else {
      newTheme = theme;
    }

    _setThemeInternal(newTheme as 'light' | 'dark');

    if (newTheme === 'dark') {
      body.classList.add('pro-dark-theme');
    } else {
      body.classList.remove('pro-dark-theme');
    }
  }, [theme, isAutomatic, isMobile, _setThemeInternal]);

  return null;
};

// Global Error Boundary to prevent white screen
class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[GlobalErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Unknown Error';
      const isPostgrestError = this.state.error?.code?.startsWith('PGRST') || this.state.error?.status === 400 || this.state.error?.status === 406;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-md w-full">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4 text-sm">
              The application encountered an unexpected error. This often happens if your session has expired or there is a database mismatch.
            </p>
            
            <div className="mb-8 p-3 bg-gray-50 rounded-lg border border-gray-100 text-left">
               <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Error Details</p>
               <p className="text-xs font-mono text-gray-600 break-words">{errorMsg}</p>
               {isPostgrestError && <p className="text-[9px] text-emerald-600 mt-2 font-medium">Tip: Try clearing your session using the button below.</p>}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-600/20"
              >
                Reload Application
              </button>
              <button 
                onClick={async () => {
                   console.log('[GlobalErrorBoundary] Performing Hard Reset...');
                   localStorage.clear();
                   sessionStorage.clear();
                   await Preferences.clear();
                   window.location.href = '/auth/login';
                }}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold py-3 rounded-xl transition-colors"
              >
                Reset Session & Logout
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Helper: keys & ignored routes for last-path storage
// We persist the last visited path in localStorage so it survives
// across browser reloads and tab closures.  This enables the app to
// return the user to the same page after a refresh or PWA relaunch.
const LAST_PATH_KEY = 'app:lastPath';
const IGNORED_PATH_PREFIXES = ['/auth', '/splash', '/pending-approval', '/forbidden', '/blocked-access', '/referral/employee', '/referral/business'];

const shouldStorePath = (path: string) => {
  // ignore auth pages, splash, pending, forbidden or catch-all redirects
  // Also ignore the root path '/' to prevent getting stuck on the redirector
  if (path === '/' || path === '/#' || path === '/index.html') return false;
  return !IGNORED_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
};

// This wrapper component protects all main application routes
const MainLayoutWrapper: React.FC = () => {
  const { user, isInitialized } = useAuthStore();
  const location = useLocation();
  // IMPORTANT: All hooks must be called before any conditional returns
  const { isMobile } = useDevice();

  if (!isInitialized) {
    // Wait for the session check to complete.
    // Render a minimal component or null to prevent premature redirect.
    // Since Splash is commented out in App.tsx, we'll use null.
    return null;
  }

  const isPublicReferralPath = location.pathname.startsWith('/referral/employee') || location.pathname.startsWith('/referral/business');

  if (!user && !isPublicReferralPath) {
    // Not logged in and not a public path, redirect to login
    // Store the current path before redirecting if it should be remembered.
    if (shouldStorePath(location.pathname + location.search)) {
      localStorage.setItem(LAST_PATH_KEY, location.pathname + location.search);
    }
    return <Navigate to="/auth/login" replace />;
  }
  if (user && user.role === 'unverified') {
    // Logged in but not approved, redirect to pending page
    return <Navigate to="/pending-approval" replace />;
  }

  // Handle Salary Hold / Strike 3 Block
  // If user is on salary hold, they must provide reasoning and agree to terms.
  // We allow them to access the profile page specifically if they've acknowledged (which we check via reason).
  if (user && user.salaryHold) {
    const isAllowedPath = location.pathname === '/blocked-access' || 
                          location.pathname === '/profile' || 
                          location.pathname === '/auth/logout';
                          
    if (!isAllowedPath) {
      // Check if they've already acknowledged/provided reasons (this is a simple heuristic)
      // If the reason starts with 'Acknowledged', they might be in the 'Profile Access' state.
      const hasAcknowledged = user.salaryHoldReason?.startsWith('Acknowledged');
      
      if (!hasAcknowledged || location.pathname !== '/profile') {
         return <Navigate to="/blocked-access" replace />;
      }
    }
  }

  // User is authenticated and verified, show the main layout and its nested routes
  // Use MobileLayout for mobile devices, MainLayout for desktop

  return isMobile ? <MobileLayout /> : <MainLayout />;
};

const App: React.FC = () => {
  const { user, isInitialized, setUser, setInitialized, resetAttendance, setLoading, isLoginAnimationPending } = useAuthStore();
  const { init: initEnrollmentRules } = useEnrollmentRulesStore();
  const { initRoles } = usePermissionsStore();
  const { initSettings } = useSettingsStore();

  const navigate = useNavigate();
  const location = useLocation();
  const { setDeferredPrompt } = usePWAStore();
  const { isUpdateRequired, updateInfo } = useAppUpdate();
  const { isOnline } = useNetworkStatus();
  const [permissionsComplete, setPermissionsComplete] = useState(false);
  const [isAppOutdated, setIsAppOutdated] = useState(false);
  const { triggerAlert: triggerBreakAlert } = useBreakAlertStore();

  // ── Listen for web-side break alert timer events ──────────────────────────
  // permissionUtils.ts dispatches 'break-alert-trigger' via setInterval on web.
  // We catch it here and show the BreakAlertModal (with looping alarm sound).
  useEffect(() => {
    const handleBreakAlertTrigger = (e: Event) => {
      const detail = (e as CustomEvent).detail as { elapsedMinutes: number };
      console.log('[App] break-alert-trigger received, elapsed:', detail?.elapsedMinutes);
      triggerBreakAlert(detail?.elapsedMinutes ?? 0);
    };
    window.addEventListener('break-alert-trigger', handleBreakAlertTrigger);
    return () => window.removeEventListener('break-alert-trigger', handleBreakAlertTrigger);
  }, [triggerBreakAlert]);

  // Lock screen orientation to portrait on native
  useScreenOrientation();

  // Register break notification action buttons on native boot.
  // Must run on every launch — action types don't persist across app restarts.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    registerBreakNotificationActions().catch(e =>
      console.warn('[App] Failed to register break notification actions:', e)
    );
    // Also ensure channel sound matches user preference
    updateBreakReminderChannelSound().catch(e =>
      console.warn('[App] Failed to update break channel sound:', e)
    );
  }, []);

  // Configure StatusBar on native
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    StatusBar.setStyle({ style: Style.Dark }).catch(e => console.warn('[App] StatusBar setStyle failed:', e));
    StatusBar.setBackgroundColor({ color: '#041b0f' }).catch(e => console.warn('[App] StatusBar setBackgroundColor failed:', e));
  }, []);

  // Handle Android hardware back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        const { isCheckedIn, isFieldCheckedIn, isSiteOtCheckedIn } = useAuthStore.getState();
        if (isCheckedIn || isFieldCheckedIn || isSiteOtCheckedIn) {
          const proceed = window.confirm(
            "⚠️ IMPORTANT WARNING ⚠️\n\n" +
            "You are currently clocked in. For accurate attendance and salary calculation, the app must remain open in the background.\n\n" +
            "If you Force Close the app or turn off your GPS/Location, your work hours and route will NOT be recorded. This will directly affect your salary and attendance records.\n\n" +
            "Are you sure you want to minimize the app?"
          );
          if (proceed) {
            CapacitorApp.minimizeApp();
          }
        } else {
          CapacitorApp.minimizeApp();
        }
      }
    });
    return () => { handler.then(h => h.remove()); };
  }, []);

  // Check GPS/Location status when app comes to foreground
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        const { isCheckedIn, isFieldCheckedIn, isSiteOtCheckedIn } = useAuthStore.getState();
        if (isCheckedIn || isFieldCheckedIn || isSiteOtCheckedIn) {
          try {
            const { Geolocation } = await import('@capacitor/geolocation');
            const permissions = await Geolocation.checkPermissions();
            // If location is completely denied, warn the user
            if (permissions.location === 'denied') {
              window.alert(
                "⚠️ GPS/LOCATION DISABLED ⚠️\n\n" +
                "Your location permissions are denied or GPS is turned off.\n\n" +
                "Since you are currently clocked in, turning off GPS will stop your tracking. This will result in missing route data and can directly affect your salary calculation.\n\n" +
                "Please enable Location Services in your phone settings."
              );
            }
          } catch (e) {
            console.warn('[App] Failed to check GPS status on resume', e);
          }
        }
      }
    });
    return () => { handler.then(h => h.remove()); };
  }, []);

  // Deep link handling — push notification taps + native URL opens (universal links)
  useEffect(() => {
    // 1. Handle notification tap deep links (dispatched by pushNotificationService)
    const handlePushDeeplink = (e: Event) => {
      const url = (e as CustomEvent).detail?.url;
      if (url) {
        console.log('[App] Push deep link:', url);
        // If it's a full URL, extract the path. If it's a relative path, use as-is.
        const path = url.startsWith('http') ? new URL(url).pathname : url;
        navigate(path, { replace: true });
      }
    };
    window.addEventListener('push-deeplink', handlePushDeeplink);

    // 2. Handle native app URL opens (universal links)
    let appUrlListener: any;
    if (Capacitor.isNativePlatform()) {
      appUrlListener = CapacitorApp.addListener('appUrlOpen', (data) => {
        console.log('[App] App URL opened:', data.url);
        try {
          const url = new URL(data.url);
          const path = url.pathname + url.search;
          if (path && path !== '/') {
            navigate(path, { replace: true });
          }
        } catch (err) {
          console.warn('[App] Failed to parse deep link URL:', err);
        }
      });
    }

    return () => {
      window.removeEventListener('push-deeplink', handlePushDeeplink);
      if (appUrlListener) appUrlListener.then((h: any) => h.remove());
    };
  }, [navigate]);

  // 3. Handle Silent Tracking Pings (Admin triggered "Find")
  useEffect(() => {
    const handleSilentTrackingPing = async (e: any) => {
      const { user } = useAuthStore.getState();
      if (!user) return;
      
      const requestId = e.detail?.requestId;
      console.log(`[App] Received silent tracking ping (${requestId || 'no-id'}), recording position...`);
      try {
        const { routeTrackingService } = await import('./services/routeTrackingService');
        await routeTrackingService.recordPosition(user.id, requestId);
      } catch (err) {
        console.warn('[App] Failed to handle silent tracking ping:', err);
      }
    };

    // 1. Listen for CustomEvent (from pushNotificationService for foreground messages)
    window.addEventListener('silent-tracking-ping', handleSilentTrackingPing);

    // 2. Listen for Service Worker messages (for background web messages)
    const handleSWMessage = (event: MessageEvent) => {
      console.log('[App] Received message from Service Worker:', event.data?.type, event.data?.data);
      if (event.data && event.data.type === 'SILENT_TRACKING_PING') {
        handleSilentTrackingPing({ detail: event.data.data });
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    return () => {
      window.removeEventListener('silent-tracking-ping', handleSilentTrackingPing);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, []);

  // Handle Local Notification Actions (e.g., Break Reminders)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

        // ── FOREGROUND handler ─────────────────────────────────────────────────────
        // When a break reminder notification fires while the app is OPEN on Android/iOS,
        // intercept it and show the same full-screen BreakAlertModal (with looping alarm)
        // that web users see. Cancel the system tray notification so it doesn't double-show.
        const receivedListener = LocalNotifications.addListener('localNotificationReceived', async (notification) => {
            console.log('[App] Local notification received in foreground:', notification.id, notification.channelId);

            if (notification.channelId === 'break_reminders' || notification.channelId === 'insistent_break_alarms') {
                try {
                    await LocalNotifications.cancel({ notifications: [{ id: notification.id }] });
                } catch (e) {}
                
                const { breakReminderInterval } = useAuthStore.getState();
                const elapsed: number = (notification as any).extra?.elapsedMinutes ?? breakReminderInterval ?? 0.1666;
                console.log('[App] Triggering break alert modal directly (foreground):', elapsed);
                triggerBreakAlert(elapsed);
            }
        });

        // ── CUSTOM NATIVE ALARM handler ────────────────────────────────────────────
        // Catch actions from the Android BreakAlarmReceiver
        const handleNativeAlarmAction = async (e: any) => {
            const data = e.detail;
            if (!data) return;
            
            console.log('[App] Native alarm action received:', data);
            processBreakAction(data.action, data.elapsedMinutes);
        };

        const processBreakAction = async (actionId: string, elapsed: number) => {
            if (actionId === 'RESUME_WORK') {
                const { toggleCheckInStatus } = useAuthStore.getState();
                const { success } = await toggleCheckInStatus('Resumed work via alarm action', null, 'office', undefined, 'break-out');
                if (success) navigate('/profile', { replace: true });
            } else if (actionId === 'CONTINUE_BREAK' || actionId === 'OPEN_MODAL') {
                const { breakReminderInterval } = useAuthStore.getState();
                const elapsedMins = elapsed || breakReminderInterval || 0.1666;
                console.log('[App] Triggering break alert modal directly:', elapsedMins);
                triggerBreakAlert(elapsedMins);
            }
        };

        window.addEventListener('breakAlarmAction', handleNativeAlarmAction);

        // ── BACKGROUND / ACTION handler (For iOS fallback) ─────────────────────────
        // When user taps an action button on the standard LocalNotification tray (iOS)
        const actionListener = LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
            console.log('[App] Local notification action:', action);
            if (action.actionId === 'RESUME_WORK') {
                processBreakAction('RESUME_WORK', 0);
            } else if (action.actionId === 'CONTINUE_BREAK') {
                processBreakAction('CONTINUE_BREAK', 0);
            }
        });

        return () => {
            window.removeEventListener('breakAlarmAction', handleNativeAlarmAction);
            receivedListener.then(h => h.remove());
      actionListener.then(h => h.remove());
    };
  }, [navigate]);

  // Initialize offline sync service & Native Social Login
  useEffect(() => {
    syncService.init().catch(err => console.error('Failed to initialize sync service:', err));
    
    // Initialize Native Google Sign-In
    if (Capacitor.isNativePlatform()) {
      const webClientId = GOOGLE_CONFIG.clientId;

      if (webClientId && !webClientId.includes('your-web-id')) {
        SocialLogin.initialize({
          google: {
            webClientId: webClientId, 
          }
        }).catch(err => console.warn('SocialLogin failed to initialize:', err));
      } else {
        console.warn('Native Google Sign-In: Web Client ID is missing or using placeholder.');
      }
    }
  }, []);

  // Expose API for testing
  useEffect(() => {
    (window as any).api = apiService;
    
    // Notify Capgo that the app has successfully loaded
    CapacitorUpdater.notifyAppReady();
  }, []);

  // Initialize Push Notifications when app is initialized
  useEffect(() => {
    if (!isInitialized || !permissionsComplete) return;

    // GUARD: Only initialize push notifications on native mobile platforms
    // to prevent browser console errors and unnecessary overhead.
    if (!Capacitor.isNativePlatform()) return;

    console.log('[App] Initializing Push Notification Service');
    pushNotificationService.init();
    pushNotificationService.listen();
  }, [isInitialized, permissionsComplete]);


    useEffect(() => {
        const handleBeforeInstallPrompt = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            console.log('Capture beforeinstallprompt event');
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, [setDeferredPrompt]);

    // ── Audio Context Unlock ──────────────────────────────────────────────────
    // Most browsers block audio until the user interacts with the page.
    // This effect ensures we resume the AudioContext on the first click.
    useEffect(() => {
        const unlockAudio = async () => {
            console.log('[App] Attempting to unlock audio context...');
            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                const tempCtx = new AudioContextClass();
                if (tempCtx.state === 'suspended') {
                    await tempCtx.resume();
                }
                // Play a silent buffer to fully unlock on some mobile browsers
                const buffer = tempCtx.createBuffer(1, 1, 22050);
                const source = tempCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(tempCtx.destination);
                source.start(0);
                
                console.log('[App] Audio context unlocked state:', tempCtx.state);
            }
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };

        window.addEventListener('click', unlockAudio, { once: true });
        window.addEventListener('touchstart', unlockAudio, { once: true });
    }, []);

  useEffect(() => {
    if (user && shouldStorePath(location.pathname + location.search)) {
      localStorage.setItem(LAST_PATH_KEY, location.pathname + location.search);
    }
  }, [user, location.pathname, location.search]);

  // Synchronize badge count when app returns to foreground
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;

    const handler = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[App] App became active, syncing notifications and badge...');
        useNotificationStore.getState().fetchNotifications();
      }
    });

    return () => {
      handler.then(h => h.remove());
    };
  }, [user]);

  // Initialize notifications and real-time subscription when user is available
  useEffect(() => {
    if (user) {
      console.log('[App] Initializing Notifications for user:', user.id);
      useNotificationStore.getState().fetchNotifications();
      const unsubscribe = useNotificationStore.getState().subscribeToNotifications();
      
      const authUnsubscribe = useAuthStore.getState().subscribeToAttendance();
      useAuthStore.getState().fetchGeofencingSettings();

      // Refresh notifications when app returns to foreground
      const setupAppStateListener = async () => {
        const { App } = await import('@capacitor/app');
        return App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            console.log('[App] Resumed, refreshing notifications...');
            useNotificationStore.getState().fetchNotifications();
          }
        });
      };
      
      const appStateListenerPromise = setupAppStateListener();
      
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
        if (typeof authUnsubscribe === 'function') authUnsubscribe();
        appStateListenerPromise.then(l => l.remove());
      };
    }
  }, [user]);

  // Android Native Badge Sync (Capacitor)
  // We sync the total count (Notifications + Approvals) to the app icon badge.
  const totalUnreadCount = useNotificationStore(state => state.totalUnreadCount);
  useEffect(() => {
    // Sync system badge count when total unread count changes
    if (Capacitor.isNativePlatform() && user) {
      useNotificationStore.getState().updateBadgeCount();
    }
  }, [totalUnreadCount, user]);

  // Initialization & Supabase session management
  useEffect(() => {
    // Flag to prevent state updates after unmount
    let isMounted = true;

    // Timer to force initialization complete after a grace period.
    // If Supabase is unreachable, we still allow the app to render the login page.
    const fallbackTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('App initialization is taking too long. Proceeding without a session.');
        setLoading(false);
        setInitialized(true);
      }
    }, 5000); // Optimized fallback (reduced from 10s)

    const initializeApp = async () => {
      setLoading(true);
      try {
        let { data: { session }, error } = await supabase.auth.getSession();
        // If getSession returned an error, log it but continue.
        if (error) {
          console.error('Error fetching initial session:', error.message);
        }

        // 1. Check for long-term "Remember Me" token if no session is found
        // NOTE: We only do this if Supabase didn't already found a session in CapacitorStorage.
        if (!session) {
          // [SECURITY] Read encrypted token, fall back to legacy plaintext key for backward compatibility.
          const refreshToken = (await secureGet('supabase.auth.rememberMe'))
            ?? (await Preferences.get({ key: 'supabase.auth.rememberMe' })).value;
          if (refreshToken) {
            console.log('Attempting to restore session from long-term token...');
            try {
              // We use withTimeout to prevent hanging on poor mobile networks
              const { data: refreshData, error: refreshError } = await withTimeout(
                supabase.auth.refreshSession({ refresh_token: refreshToken }),
                20000, // 20s for session restoration
                'Session restoration timed out'
              ).catch(e => ({ data: { session: null }, error: { message: e.message } }));

              if (refreshError) {
                console.error('Failed to restore session from long-term token:', refreshError.message);
                // ONLY clear the token if it's a definitive invalidation (400)
                // If it's a network error (failed to fetch) or timeout, we DO NOT clear it.
                // This ensures "auto renew until manual logout" even if they open the app while offline.
                const isDefinitiveFailure = refreshError.message?.includes('400') || 
                                           refreshError.message?.includes('invalid refresh token') ||
                                           refreshError.message?.includes('not found');
                
                if (isDefinitiveFailure) {
                  console.warn('Invalid refresh token detected. Clearing persistent storage.');
                  await Preferences.remove({ key: 'supabase.auth.rememberMe' });
                }
              } else {
                session = refreshData.session;
              }
            } catch (e) {
              console.error('Exception while restoring session from long-term token:', e);
            }
          }
        }

        // 2. Process the final session state
        if (session) {
          try {
            const appUser = await authService.getAppUserProfile(session.user);
            if (isMounted) {
              setUser(appUser);
              // Initialize push notifications on initial session load
              pushNotificationService.init();
            }
          } catch (e) {
            console.error('Failed to fetch user profile during initialization:', e);
            if (isMounted) {
              setUser(null);
              resetAttendance();
            }
          }
        } else {
          if (isMounted) {
            setUser(null);
            resetAttendance();
          }
        }
      } catch (error) {
        console.error('Error during app initialization:', error);
        if (isMounted) {
          setUser(null);
          resetAttendance();
        }
      } finally {
        // Only clear the fallback timeout if initialization finishes before the fallback time
        clearTimeout(fallbackTimeout);
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeApp();

    // Listen for subsequent auth changes (e.g., login, logout)
    //
    // NOTE: The Supabase client can hang indefinitely if asynchronous
    // operations are performed directly inside the onAuthStateChange
    // callback.  See: https://github.com/orgs/supabase/discussions/37755
    // To avoid this, do not await other Supabase calls in the callback
    // itself.  Instead, schedule any async work on the next event loop
    // tick via setTimeout().  This ensures the callback returns
    // immediately and prevents the client from locking up when tabs are
    // switched or refreshed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AuthEvent] ${event}`);
      
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/auth/update-password', { replace: true });
        return;
      }

      // Always persist the latest refresh token so it survives app restarts.
      // TOKEN_REFRESHED fires automatically when Supabase silently renews the access token.
      // [SECURITY] Tokens and emails are AES-256 encrypted via secureStorage before persisting.
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
        secureSet('supabase.auth.rememberMe', session.refresh_token).catch(err => console.error('Error synchronizing auth token:', err));
          
        if (session.user.email) {
          secureSet('rememberedEmail', session.user.email).catch(e => console.warn('[App] Prefs auth save failed:', e));
        }
      }

      // Update global user state based on the session
      if (session?.user) {
        const currentUser = useAuthStore.getState().user;

        // TOKEN_REFRESHED: Supabase silently renewed the token. If we already have a user
        // in memory, there is nothing to do — the user is still logged in.
        // Only re-fetch the profile on an actual new SIGNED_IN event or if no user is in state.
        if (!currentUser || event === 'SIGNED_IN') {
          setTimeout(async () => {
            try {
              const appUser = await withTimeout(
                authService.getAppUserProfile(session.user),
                15000,
                'Profile fetch timed out'
              ).catch(err => {
                console.warn('Transient error fetching profile:', err.message);
                return currentUser; 
              });

              if (isMounted && appUser) {
                setUser(appUser);
                // Greeting logic — only once per session
                const greetKey = `greetingSent_${appUser.id}`;
                if (!localStorage.getItem(greetKey)) {
                  apiService.createNotification({
                    userId: appUser.id,
                    message: `Good morning, ${appUser.name || 'there'}! Welcome to Paradigm Services.`,
                    type: 'greeting',
                  }).catch(e => console.warn('[App] Push notification init failed:', e));
                  localStorage.setItem(greetKey, '1');
                }

                pushNotificationService.init();
              }
            } catch (err) {
              console.error('Failed to fetch user profile after auth change:', err);
            }
          }, 0);
        }
      } else if (event === 'SIGNED_OUT') {
        // The user explicitly signed out of THIS app (scope:'local').
        // Clear local state but do NOT attempt session restore — the user chose to leave.
        if (isMounted) {
          setUser(null);
          resetAttendance();
          useOnboardingStore.getState().reset();
          secureRemove('supabase.auth.rememberMe').catch(e => console.warn('[App] secureRemove failed:', e));
          secureRemove('rememberedEmail').catch(() => {});
          Preferences.remove({ key: 'supabase.auth.rememberMe' }).catch(() => {}); // legacy cleanup
          Preferences.remove({ key: 'rememberedEmail' }).catch(() => {}); // legacy cleanup
        }
      }
    });


    // Check session when app returns to foreground
    const appStateSubscription = CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        console.log('[AppState] App returned to foreground. Verifying session...');

        // Refresh notifications and badge count when app returns to foreground
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          console.log('[AppState] Refreshing notifications on resume...');
          useNotificationStore.getState().fetchNotifications().catch(err => {
            console.error('[AppState] Failed to refresh notifications on resume:', err);
          });
        }

        // Silently verify and restore the session WITHOUT forcing the user back to login.
        // supabase.auth.getSession() returns the in-memory session; if the access token
        // has expired, Supabase will automatically try to refresh it via autoRefreshToken.
        // If it cannot (e.g. no network), we fall back to our persisted refreshToken.
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // [SECURITY] Read encrypted token, fall back to legacy plaintext key for backward compatibility.
          const refreshToken = (await secureGet('supabase.auth.rememberMe'))
            ?? (await Preferences.get({ key: 'supabase.auth.rememberMe' })).value;
          if (refreshToken) {
            console.log('[AppState] Silently restoring session from saved token...');
            const { data: refreshData, error: refreshErr } = await supabase.auth
              .refreshSession({ refresh_token: refreshToken })
              .catch(e => ({ data: { session: null }, error: e }));
            
            if (refreshErr) {
              // Token is definitively invalid (e.g. revoked server-side). Only THEN do we force logout.
              const isDefinitiveFailure = refreshErr.message?.includes('invalid') || refreshErr.message?.includes('not found');
              if (isDefinitiveFailure) {
                console.warn('[AppState] Saved token is invalid. Forcing logout.');
                useAuthStore.getState().forceLogout('Your session has expired. Please log in again.');
              }
              // If it was a network error, we keep the user in the app and retry next time.
            } else if (refreshData.session) {
              console.log('[AppState] Session silently restored.');
            }
          } else if (currentUser) {
            // No token and no session — user state is stale. Clear it.
            console.warn('[AppState] No session or refresh token found. Clearing stale user state.');
            useAuthStore.getState().forceLogout('Your session has expired. Please log in again.');
          }
        }
      }
    });

    // Listen for global auth failures from API
    const handleAuthFailure = (e: any) => {
        const error = e.detail;
        useAuthStore.getState().forceLogout(
            error?.message?.includes('expired') 
                ? 'Your session has expired. Please log in again.' 
                : 'Authentication error. Please log in again.'
        );
    };
    window.addEventListener('supabase-auth-failure', handleAuthFailure);

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      window.removeEventListener('supabase-auth-failure', handleAuthFailure);
      clearTimeout(fallbackTimeout);
    };
  }, [setUser, setInitialized, resetAttendance, setLoading]);

  // Fetch initial app data on user login
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { settings, roles, holidays } = await apiService.getInitialAppData();
        const recurringHolidays = await apiService.getRecurringHolidays();

        if (settings.enrollmentRules) {
          initEnrollmentRules(settings.enrollmentRules);
        }
        if (roles) {
          initRoles(roles);
        }
        if (settings.attendanceSettings && holidays) {
          initSettings({
            holidays: holidays,
            attendanceSettings: settings.attendanceSettings,
            recurringHolidays: recurringHolidays || [],
            apiSettings: settings.apiSettings,
            addressSettings: settings.addressSettings,
            geminiApiSettings: settings.geminiApiSettings,
            offlineOcrSettings: settings.offlineOcrSettings,
            perfiosApiSettings: settings.perfiosApiSettings,
            otpSettings: settings.otpSettings,
            siteManagementSettings: settings.siteManagementSettings,
            notificationSettings: settings.notificationSettings,
          });

          // --- Version Check: only on native mobile apps, not web ---
          if (Capacitor.isNativePlatform()) {
            const serverVersion = settings.apiSettings?.appVersion;
            if (serverVersion && isVersionOutdated(APP_VERSION, serverVersion)) {
              console.warn(`[VersionCheck] App v${APP_VERSION} is outdated. Server requires v${serverVersion}.`);
              setIsAppOutdated(true);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load initial application data:', error);
      }
    };

    if (user && isInitialized) { // Ensure we only fetch after initialization is complete
      fetchInitialData();
      useAuthStore.getState().checkAttendanceStatus();
      
      // Trigger daily auto-backup check for admins
      if (user.role === 'admin' || user.role === 'hr' || user.role === 'super_admin' || user.role === 'developer') {
        apiService.autoBackupCheck();
      }
    }
  }, [user, isInitialized, initEnrollmentRules, initRoles, initSettings]);

  // Post-initialization navigation logic.
  useEffect(() => {
    if (!isInitialized) {
      return; // Wait for the session check to complete.
    }

    // This effect handles cases where a logged-in user is landing on a non-app page
    // such as the auth routes, the splash screen, or the root ("/").  In these
    // situations we check if we have a last known path in localStorage and
    // navigate there.  This ensures that refreshing the browser or reopening
    // the app returns the user to the page they were last working on.  If no
    // last path is stored, we send the user to their profile page.
    // We also check isLoginAnimationPending to allow the login page to show a success animation.

    // IMPORTANT: Allow users to stay on /auth/update-password to set their new password
    // after clicking a password reset link
    if (location.pathname === '/auth/update-password') {
      return; // Don't redirect, let them set their password
    }

    if (user && !isLoginAnimationPending && (
      (location.pathname.startsWith('/auth') && location.pathname !== '/auth/logout') ||
      location.pathname === '/' ||
      location.pathname === '/splash'
    )) {
      const lastPath = localStorage.getItem(LAST_PATH_KEY);
      
      // Validation check: Is this path restricted/administrative?
      const isRestrictedPath = lastPath && (
        lastPath.startsWith('/admin') || 
        lastPath.startsWith('/hr') || 
        lastPath.startsWith('/developer') ||
        lastPath.startsWith('/billing')
      );

      // Check for administrative roles that are allowed to access restricted paths
      // We include management, hr, and developer as they have broad access in this app.
      const isAdminRole = ['admin', 'hr', 'super_admin', 'developer', 'management', 'hr_ops'].includes(user.role);

      if (lastPath && shouldStorePath(lastPath) && lastPath !== '/' && lastPath !== '/#') {
        // If it's a restricted path and the user is NOT an admin, clear it and go to profile
        if (isRestrictedPath && !isAdminRole) {
          console.warn('[App] Guarding against unauthorized lastPath redirect:', lastPath);
          localStorage.removeItem(LAST_PATH_KEY);
          navigate('/profile', { replace: true });
        } else {
          localStorage.removeItem(LAST_PATH_KEY); // Clear after use
          navigate(lastPath, { replace: true });
        }
      } else {
        if (user.role === 'unverified') {
          navigate('/pending-approval', { replace: true });
        } else {
          navigate('/profile', { replace: true });
        }
      }
    }
  }, [isInitialized, user, location.pathname, navigate, isLoginAnimationPending]);



  // Robust check for native platform at the App level
  const isAndroidUA = /Android/i.test(navigator.userAgent);
  const isIOSUA = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isLikelyMobile = isAndroidUA || isIOSUA || Capacitor.isNativePlatform();

  // Stable callback — must not be re-created on every render to avoid
  // re-running Splash's initialization effect (which could cause a loop).
  const handleSplashComplete = useCallback(() => {
    console.log('[App] Splash sequence complete.');
    setPermissionsComplete(true);
  }, []);

  // While the initial authentication check OR the permissions check is running, show the splash screen.
  // This prevents the router from rendering and making incorrect navigation decisions
  // and ensures push notification and other dependent services have the required state to initialize.
  if (!isInitialized || !permissionsComplete) {
    return (
      <Splash 
        onComplete={handleSplashComplete}
      />
    );
  }

  // Once initialized, render the main application structure.
  return (
    <>
      <ScrollToTop />
      <ThemeManager />
      <OfflineStatusBanner />
      {isAppOutdated && <UpdateRequiredBanner />}
      {isUpdateRequired && <UpdatePromptModal updateInfo={updateInfo} />}
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>}>
      <Routes>
        {/* 1. Public Authentication & Form Routes */}
        <Route path="/auth" element={<AuthLayout />}>
          <Route index element={<Navigate to="login" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="update-password" element={<UpdatePassword />} />
          <Route path="logout" element={<LogoutPage />} />
        </Route>

        <Route path="/public/forms" element={<FormsSelection />} />
        <Route path="/public/forms/gmc" element={<GMCForm />} />

        {/* Gate Attendance Kiosk — standalone public route for security guard device */}
        <Route path="/gate" element={<GateKiosk />} />
        
        {/* Full-screen Image Viewer */}
        <Route path="/document-viewer" element={<DocumentViewerPage />} />

        {/* 2. Page for unverified users */}
        <Route path="/pending-approval" element={user && user.role === 'unverified' ? <PendingApproval /> : <Navigate to="/auth/login" replace />} />

        {/* 3. Forbidden page for unauthorized access */}
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="/blocked-access" element={<BlockedAccessPage />} />

        {/* 4. All protected main application routes are nested here */}
        <Route path="/" element={
          <SecurityWrapper>
            <GlobalErrorBoundary>
              <MainLayoutWrapper />
            </GlobalErrorBoundary>
          </SecurityWrapper>
        }>
          {/* Default route for authenticated users */}
          <Route index element={<Navigate to="/profile" replace />} />

          <Route element={<ProtectedRoute requiredPermission="view_profile" />}>
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="mobile-home" element={<MobileHome />} />

          {/* Referral Module — accessible to all authenticated users */}
          <Route path="referral/employee" element={<EmployeeReferralForm />} />
          <Route path="referral/business" element={<BusinessReferralForm />} />
          <Route element={<ProtectedRoute requiredPermission="view_referrals" />}>
            <Route path="referral/management" element={<ReferralManagement />} />
          </Route>

          {/* Onboarding Flow */}
          <Route element={<ProtectedRoute requiredPermission="create_enrollment" />}>
            <Route path="onboarding" element={<OnboardingHome />} />
            <Route path="onboarding/select-organization" element={<SelectOrganization />} />
            <Route path="onboarding/pre-upload" element={<PreUpload />} />
            <Route path="onboarding/submissions" element={<MySubmissions />} />
            <Route path="onboarding/aadhaar-scan" element={<AadhaarScannerPage />} />
            <Route path="onboarding/tasks" element={<MyTasks />} />
            <Route path="onboarding/uniforms" element={<UniformRequests />} />
            <Route path="onboarding/add" element={<AddEmployee />}>
              <Route path="personal" element={<PersonalDetails />} />
              <Route path="address" element={<AddressDetails />} />
              <Route path="organization" element={<OrganizationDetails />} />
              <Route path="family" element={<FamilyDetails />} />
              <Route path="education" element={<EducationDetails />} />
              <Route path="bank" element={<BankDetails />} />
              <Route path="uan" element={<UanDetails />} />
              <Route path="esi" element={<EsiDetails />} />
              <Route path="gmc" element={<GmcDetails />} />
              <Route path="uniform" element={<UniformDetails />} />
              <Route path="documents" element={<Documents />} />
              <Route path="biometrics" element={<Biometrics />} />
              <Route path="review" element={<Review />} />
            </Route>
            <Route path="onboarding/pdf/:id" element={<OnboardingPdfOutput />} />
          </Route>

          {/* Verification */}
          <Route element={<ProtectedRoute requiredPermission="view_all_submissions" />}>
            <Route path="verification/dashboard" element={<VerificationDashboard />} />
          </Route>

          {/* Admin */}
          <Route element={<ProtectedRoute requiredPermission="manage_users" />}>
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/users/add" element={<AddUserPage />} />
            <Route path="admin/users/edit/:id" element={<AddUserPage />} />
            <Route path="admin/users/bulk-update-leaves" element={<BulkEarnedLeavePage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="manage_biometric_devices" />}>
            <Route path="admin/devices" element={<ManageDevices />} />
            <Route path="admin/device-approvals" element={<DeviceApprovals />} />
            <Route path="admin/kiosks" element={<KioskManagement />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="manage_sites" />}>
            <Route path="admin/sites" element={<SiteManagement />} />
            <Route path="admin/sites/add" element={<AddSitePage />} />
            <Route path="admin/sites/quick-add" element={<QuickAddSitePage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="manage_roles_and_permissions" />}>
            <Route path="admin/roles" element={<RoleManagement />} />
            <Route path="admin/roles/add" element={<AddRolePage />} />
            <Route path="admin/roles/edit/:id" element={<AddRolePage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="manage_modules" />}>
            <Route path="admin/modules" element={<ModuleManagement />} />
            <Route path="admin/modules/add" element={<AddModulePage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="manage_approval_workflow" />}>
            <Route path="admin/approval-workflow" element={<ApprovalWorkflow />} />
            <Route path="admin/approval-workflow/chart" element={<WorkflowChartFullScreen />} />
          </Route>

          {/* Developer */}
          <Route element={<ProtectedRoute requiredPermission="view_developer_settings" />}>
            <Route path="developer/api" element={<ApiSettings />} />
          </Route>

          {/* Operations & Site */}
          <Route element={<ProtectedRoute requiredPermission="view_operations_dashboard" />}>
            <Route path="operations/dashboard" element={<OperationsDashboard />} />
            <Route path="operations/team-activity" element={<TeamActivity />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="view_my_team" />}>
            <Route path="my-team" element={<MyTeam />} />
            <Route path="my-team/reporting" element={<ReportingStructure />} />
            <Route path="my-team/:id" element={<TeamMemberProfile />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="view_field_reports" />}>
            <Route path="my-team/field-reports" element={<FieldReports />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="view_site_dashboard" />}>
            <Route path="site/dashboard" element={<SiteDashboard />} />
          </Route>

          {/* Attendance & Leave */}
          <Route element={<ProtectedRoute requiredPermission="view_own_attendance" />}>
            <Route path="attendance/dashboard" element={<AttendanceDashboard />} />
            <Route path="attendance/check-in" element={<AttendanceActionPage />} />
            <Route path="attendance/check-out" element={<AttendanceActionPage />} />
            <Route path="attendance/break-in" element={<AttendanceActionPage />} />
            <Route path="attendance/break-out" element={<AttendanceActionPage />} />
            <Route path="attendance/request-unlock" element={<RequestUnlockPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="view_my_locations" />}>
            {/* New page for users to manage their own geofenced locations */}
            <Route path="attendance/locations" element={<MyLocations />} />
          </Route>

          {/* User Settings */}
          <Route path="settings/devices" element={<DeviceManagement />} />

          <Route element={<ProtectedRoute requiredPermission="apply_for_leave" />}>
            <Route path="leaves/dashboard" element={<LeaveDashboard />} />
            <Route path="leaves/apply" element={<ApplyLeave />} />
            <Route path="leaves/holiday-selection" element={<HolidaySelectionPage />} />
          </Route>

          {/* HR */}
          <Route element={<ProtectedRoute requiredPermission="manage_attendance_rules" />}>
            <Route path="hr/attendance-settings" element={<AttendanceSettings />} />
            <Route path="notifications" element={<NotificationsControl />} />
            <Route path="hr/advanced-notifications" element={<AdvancedNotificationSettings />} />
            <Route path="hr/family-verification" element={<FamilyVerification />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="manage_leave_requests" />}>
            <Route path="hr/leave-management" element={<LeaveManagement />} />
            <Route path="hr/leave-management/grant-comp-off" element={<GrantCompOffPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="view_entity_management" />}>
            <Route path="hr/entity-management" element={<EntityManagement />} />
            <Route path="hr/entity-management/add-group" element={<AddGroupPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="manage_policies" />}>
            <Route path="hr/policies-and-insurance" element={<PoliciesAndInsurance />} />
            <Route path="hr/policies/add" element={<AddPolicyPage />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="manage_enrollment_rules" />}>
            <Route path="hr/enrollment-rules" element={<EnrollmentRules />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="view_field_staff_tracking" />}>
            <Route path="hr/field-staff-tracking" element={<FieldStaffTracking />} />
          </Route>

          {/* Location Management (Geofencing) */}
          <Route element={<ProtectedRoute requiredPermission="manage_geo_locations" />}>
            <Route path="hr/locations" element={<LocationManagement />} />
          </Route>

          {/* Uniforms */}
          <Route element={<ProtectedRoute requiredPermission="manage_uniforms" />}>
            <Route path="uniforms" element={<UniformDashboard />} />
            <Route path="uniforms/request/new" element={<NewUniformRequestPage />} />
            <Route path="uniforms/request/edit/:id" element={<NewUniformRequestPage />} />
          </Route>

          {/* Billing */}
          <Route element={<ProtectedRoute requiredPermission="view_verification_costing" />}>
            <Route path="billing/cost-analysis" element={<CostAnalysis />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="view_attendance_tracker" />}>
            <Route path="finance" element={<FinanceModule />} />
            <Route path="finance/attendance/add" element={<AddSiteAttendanceRecord />} />
            <Route path="finance/attendance/edit/:id" element={<AddSiteAttendanceRecord />} />
            <Route path="finance/site-tracker/add" element={<AddSiteFinanceRecord />} />
            <Route path="finance/site-tracker/edit/:id" element={<AddSiteFinanceRecord />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="view_invoice_summary" />}>
            <Route path="billing/summary" element={<InvoiceSummary />} />
          </Route>

          {/* Tasks */}
          <Route path="tasks" element={<Tasks />} />
          <Route path="tasks/add" element={<AddTaskPage />} />
          <Route path="tasks/edit/:id" element={<AddTaskPage />} />

          {/* CRM */}
          <Route element={<ProtectedRoute requiredPermission="view_crm_pipeline" />}>
            <Route path="crm" element={<CrmDashboard />} />
            <Route path="crm/leads/:id" element={<LeadDetail />} />
            <Route path="crm/leads/:id/survey" element={<SiteSurveyForm />} />
            <Route path="crm/leads/:id/quotation" element={<QuotationBuilder />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="view_crm_checklists" />}>
            <Route path="crm/checklists" element={<ChecklistBuilder />} />
          </Route>

          {/* Operations Hub (Phase 2) */}
          <Route element={<ProtectedRoute requiredPermission="view_operations" />}>
            <Route path="operations/tickets" element={<HelpdeskTickets />} />
            <Route path="operations/maintenance" element={<MaintenanceScheduler />} />
            <Route path="operations/contracts" element={<ContractManager />} />
          </Route>

          {/* Finance Hub (Phase 3) */}
          <Route element={<ProtectedRoute requiredPermission="view_finance_reports" />}>
            <Route path="finance/profitability" element={<ProfitabilityDashboard />} />
            <Route path="finance/payments" element={<PaymentTracker />} />
          </Route>

          {/* Enterprise Controls (Phase 4) */}
          <Route element={<ProtectedRoute requiredPermission="manage_approval_workflow" />}>
            <Route path="enterprise/approvals" element={<ApprovalsInbox />} />
            <Route path="enterprise/audit-trail" element={<AuditTrail />} />
          </Route>

          {/* Gate Attendance Admin */}
          <Route element={<ProtectedRoute requiredPermission="manage_users" />}>
            <Route path="gate/register" element={<RegisterGateUser />} />
            <Route path="gate/logs" element={<GateAttendanceLogs />} />
          </Route>

          {/* Support */}
          <Route element={<ProtectedRoute requiredPermission="access_support_desk" />}>
            <Route path="support" element={<SupportDashboard />} />
            <Route path="support/alerts" element={<Alerts />} />
            <Route path="support/ticket/new" element={<NewTicketPage />} />
            <Route path="support/ticket/:id" element={<TicketDetail />} />
          </Route>
        </Route>

        {/* 5. Catch-all: Redirects any unknown paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <Toaster 
        position="top-right" 
        reverseOrder={false} 
        gutter={8}
        containerStyle={{
          top: 16,
          right: 16,
        }}
        toastOptions={{
          style: {
            maxWidth: '340px',
            fontSize: '13px',
            padding: '10px 14px',
            borderRadius: '10px',
            wordBreak: 'break-word',
          },
        }}
      />
      {/* ── Break Alert Modal: full-screen overlay with looping alarm ── */}
      <BreakAlertModal />
    </>
  );
};

export default App;

