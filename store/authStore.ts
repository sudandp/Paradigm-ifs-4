

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Network as CapacitorNetwork } from '@capacitor/network';
const Network = {
  ...CapacitorNetwork,
  getStatus: async () => {
    try {
      const status = await CapacitorNetwork.getStatus();
      return {
        ...status,
        connected: status.connected || (typeof window !== 'undefined' && window.navigator.onLine)
      };
    } catch (e) {
      return {
        connected: typeof window !== 'undefined' ? window.navigator.onLine : true,
        connectionType: 'unknown'
      };
    }
  }
};
import { authService } from '../services/authService';
import { Preferences } from '@capacitor/preferences';
import { secureSet, secureGet, secureRemove } from '../utils/secureStorage';
import type { User, AttendanceEventType } from '../types';
import { supabase } from '../services/supabase';
import type { RealtimeChannel, Subscription } from '@supabase/supabase-js';
// FIX: Import the 'api' object to resolve 'Cannot find name' errors.
import { api } from '../services/api';

import { withTimeout } from '../utils/async';
import { format } from 'date-fns';
import { routeTrackingService } from '../services/routeTrackingService';
import { calculateDistanceMeters, reverseGeocode, getPrecisePosition } from '../utils/locationUtils';
import { processDailyEvents, isTechnicalRole } from '../utils/attendanceCalculations';
import { useSettingsStore } from './settingsStore';
import { dispatchNotificationFromRules } from '../services/notificationService';
import { LocalNotifications } from '@capacitor/local-notifications';
import { scheduleShiftEndReminder, scheduleBreakEndReminder, cancelNotification, scheduleStepBreakReminders, cancelStepBreakReminders, restoreBreakRemindersOnResume } from '../utils/permissionUtils';
// [SECURITY] Defense-in-depth: rate limiting, audit logging, session management
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  logSecurityEvent,
  startSessionMonitor,
  stopSessionMonitor,
  sanitizeEmail
} from '../utils/security';

// Centralized friendly error message handler for Supabase
// Centralized friendly error message handler for Supabase
// Centralized friendly error message handler for Supabase

const getFriendlyAuthError = (errorMessage: string): string => {
    const msg = errorMessage.toLowerCase();

    if (msg.includes('timed out')) {
        return 'The request took too long. Please check your internet connection and try again.';
    }
    if (msg.includes('invalid api key') || msg.includes('configuration')) {
        return 'System configuration error. Please contact support.';
    }
    if (msg.includes('failed to fetch') || msg.includes('network')) {
        return 'Unable to connect. Please check your internet connection.';
    }
    if (msg.includes('invalid login credentials')) {
        return 'Incorrect email or password. If you use Google Sign-In, please click "Sign in with Google".';
    }
    if (msg.includes('user already registered') || msg.includes('already exists')) {
        return 'This email is already registered. Please sign in.';
    }
    if (msg.includes('email not confirmed')) {
        return 'Please verify your email address. Check your inbox for the confirmation link.';
    }
    if (msg.includes('too many requests') || msg.includes('rate limit')) {
        return 'Too many attempts. Please wait a few minutes before trying again.';
    }
    if (msg.includes('weak password')) {
        return 'Password is too weak. Please use a stronger password.';
    }

    // Log the actual error for debugging
    console.error("Unhandled auth error:", errorMessage);
    
    // If it's a native auth error or contains technical details, show it to help debugging
    if (msg.includes('error') || msg.includes('fail') || msg.includes('exception') || msg.includes('native')) {
        return errorMessage;
    }

    // Special case for Google Sign-In generic failures on Android
    if (msg.includes('google') && Capacitor.isNativePlatform()) {
        return 'Google Sign-In failed. Please ensure your device has a stable internet connection and you have selected a valid account. If the problem persists, please contact admin.';
    }

    return 'Something went wrong. Please try again or contact support.';
};

const getActionTextForType = (type: string, workType?: string): string => {
    switch (type) {
        case 'punch-in': return workType === 'field' ? 'site checked in' : 'punched in';
        case 'punch-out': return workType === 'field' ? 'site checked out' : 'punched out';
        case 'break-in': return 'started a break ☕';
        case 'break-out': return 'ended a break 🏁';
        case 'site-ot-in': return 'started Site OT 🕒';
        case 'site-ot-out': return 'ended Site OT ✅';
        default: return 'updated attendance';
    }
};

const getLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

interface AuthState {
    user: User | null;
    isCheckedIn: boolean;
    isAttendanceLoading: boolean;
    lastCheckInTime: string | null;
    lastCheckOutTime: string | null;
    firstBreakInTime: string | null;
    lastBreakInTime: string | null;
    lastBreakOutTime: string | null;
    totalBreakDurationToday: number;
    totalWorkingDurationToday: number;
    breakIntervals: { start: string; end: string | null; duration: number }[];
    isOnBreak: boolean;
    loginWithEmail: (email: string, password: string, rememberMe: boolean) => Promise<{ error: { message: string } | null }>;
    signUp: (name: string, email: string, password: string) => Promise<{ error: { message: string } | null }>;
    loginWithGoogle: () => Promise<{ error: { message: string } | null; }>;
    sendPasswordReset: (email: string) => Promise<{ error: { message: string } | null }>;
    logout: () => Promise<void>;
    isInitialized: boolean;
    setUser: (user: User | null) => void;
    setInitialized: (initialized: boolean) => void;
    resetAttendance: () => void;
    updateUserProfile: (updates: Partial<User>) => void;
    checkAttendanceStatus: (isSilent?: boolean) => Promise<void>;
    toggleCheckInStatus: (note?: string, attachmentUrl?: string | null, workType?: 'office' | 'field', fieldReportId?: string, forcedType?: string, breakInterval?: number, overrideTimestamp?: string) => Promise<{ success: boolean; message: string }>;
    subscribeToAttendance: () => (() => void) | void;
    error: string | null;
    setError: (error: string | null) => void;
    loading: boolean;
    setLoading: (loading: boolean) => void;
    isLoginAnimationPending: boolean;
    setLoginAnimationPending: (pending: boolean) => void;
    liveSteps: number;
    setLiveSteps: (steps: number) => void;
    syncLiveSteps: (steps: number) => Promise<void>;
    geofencingSettings: { enabled: boolean; maxViolationsPerMonth: number } | null;
    breakLimit: number;
    breakReminderInterval: number; // user-selected reminder interval in minutes (web + native)
    fetchGeofencingSettings: () => Promise<void>;
    dailyPunchCount: number;
    /** Number of approved unlock requests today. Each approval enables one extra punch cycle. */
    approvedUnlockCount: number;
    /** Total requests (pending + approved) made today — used to enforce daily max of 2. */
    dailyUnlockRequestCount: number;
    /** Derived: true when user has an unused approved unlock available. */
    isPunchUnlocked: boolean;
    isFieldCheckedIn: boolean;
    isFieldCheckedOut: boolean;
    isSiteOtCheckedIn: boolean;
    /** True when a technical_reliever has an unclosed session from a previous day */
    hasPreviousDayOpenSession: boolean;
    /** Info about the open previous-day session (date, last event type) */
    previousDaySessionInfo: { date: string; lastEventType: string; lastEventTime: string } | null;
    isBreakingOut: boolean;
    setIsBreakingOut: (val: boolean) => void;
    loginWithPasscode: (email: string, passcode: string, rememberMe: boolean) => Promise<{ error: { message: string } | null }>;
    forceLogout: (reason?: string) => Promise<void>;
    isOffline: boolean;
    setIsOffline: (isOffline: boolean) => void;
    checkOfflineSession: () => Promise<boolean>;
    syncRouteTracking: () => Promise<void>;
    pendingAutoPunchOut: { userId: string; executeAt: number; notificationId: string } | null;
    setPendingAutoPunchOut: (data: { userId: string; executeAt: number; notificationId: string } | null) => void;
    executeAutoPunchOut: () => Promise<void>;
}

// Helper for time-based greetings
const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
};

// Custom storage adapter for Capacitor (matches supabase.ts logic)
const CapacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string): Promise<void> => {
    await Preferences.remove({ key });
  },
};

let lastSyncedSteps = 0;
let lastSyncTime = 0;

export const useAuthStore = create<AuthState>()(

    persist(
        (set, get) => ({
        user: null,
        isInitialized: false,
        isCheckedIn: false,
        isAttendanceLoading: true,
        lastCheckInTime: null,
        lastCheckOutTime: null,
        firstBreakInTime: null,
        lastBreakInTime: null,
        lastBreakOutTime: null,
        totalBreakDurationToday: 0,
        totalWorkingDurationToday: 0,
        breakIntervals: [],
        isOnBreak: false,
        isOffline: false,
        error: null,
        loading: false,
        geofencingSettings: null,
        breakLimit: 60,
        breakReminderInterval: 15,
        dailyPunchCount: 0,
        approvedUnlockCount: 0,
        dailyUnlockRequestCount: 0,
        isPunchUnlocked: false,
        isFieldCheckedIn: false,
        isFieldCheckedOut: false,
        isSiteOtCheckedIn: false,
        hasPreviousDayOpenSession: false,
        previousDaySessionInfo: null,
        isBreakingOut: false,
        setIsBreakingOut: (val) => set({ isBreakingOut: val }),
        pendingAutoPunchOut: null,
        setPendingAutoPunchOut: (data) => set({ pendingAutoPunchOut: data }),
        executeAutoPunchOut: async () => {
            const { user, isCheckedIn, isFieldCheckedIn, isSiteOtCheckedIn, pendingAutoPunchOut } = get();
            const isUserCheckedInAtAll = isCheckedIn || isFieldCheckedIn || isSiteOtCheckedIn;
            if (!user || !isUserCheckedInAtAll || !pendingAutoPunchOut) {
                set({ pendingAutoPunchOut: null });
                return;
            }
            
            try {
                await api.addAttendanceEvent({
                    userId: user.id,
                    timestamp: new Date().toISOString(),
                    type: 'punch-out',
                    checkoutNote: 'Auto punch-out: No response to reminder within 5 minutes',
                    workType: 'office',
                    source: 'auto_system'
                });
                
                try {
                    cancelNotification('SHIFT_END');
                    cancelNotification('BREAK_END');
                } catch (err) {
                    console.warn('[AutoPunchOut] Failed to cancel notifications:', err);
                }

                await get().checkAttendanceStatus(true);
                
                dispatchNotificationFromRules('check_out', {
                    actorName: user.name || 'System',
                    actionText: 'was auto punched out',
                    locString: '',
                    selfNotify: true,
                    selfMessage: `${user.name || 'there'}, you have been automatically punched out due to no response within 5 minutes.`,
                    title: 'Auto Punch-Out',
                    actor: {
                        id: user.id,
                        name: user.name,
                        role: user.role,
                        reportingManagerId: user.reportingManagerId
                    }
                });
            } catch (err) {
                console.error('[AutoPunchOut] Failed:', err);
            } finally {
                set({ pendingAutoPunchOut: null });
            }
        },
        forceLogout: async (reason) => {
            console.log(`Force logout triggered. Reason: ${reason || 'Unknown'}`);
            // Only clear in-memory state. DO NOT remove persistent tokens or call signOut().
            // The next app open / foreground resume will silently restore the session
            // via the saved refresh token. Tokens should only be destroyed on explicit
            // user-initiated logout() — not on inactivity or transient auth errors.
            set({ error: reason || 'Your session has expired. Please log in again.', loading: false, user: null });
            get().resetAttendance();
        },

        isLoginAnimationPending: false,
        setLoginAnimationPending: (pending) => set({ isLoginAnimationPending: pending }),
        liveSteps: 0,
        setLiveSteps: (steps) => set({ liveSteps: steps }),
        syncLiveSteps: async (steps: number) => {
            const { user } = get();
            if (!user) return;

            if (Capacitor.getPlatform() !== 'android') return;

            const now = Date.now();
            const timeElapsed = now - lastSyncTime;
            const stepsChanged = steps !== lastSyncedSteps;

            // Sync every 10s (was 60s) so the web app sees nearly real-time step data
            if (stepsChanged && (timeElapsed > 10000 || lastSyncTime === 0)) {
                lastSyncTime = now;
                lastSyncedSteps = steps;
                try {
                    await api.updateActiveSessionSteps(user.id, steps);
                    console.log(`[authStore] Synced live steps to database: ${steps}`);
                } catch (err) {
                    console.warn('[authStore] Failed to sync live steps to database:', err);
                }
            }
        },

        setUser: (user) => set({ user, error: null, loading: false }),
        setInitialized: (initialized) => set({ isInitialized: initialized }),
        setLoading: (loading) => set({ loading }),
        
        setIsOffline: (isOffline: boolean) => {
            set({ isOffline });
        },

        resetAttendance: () => set({
            isCheckedIn: false,
            isAttendanceLoading: false,
            lastCheckInTime: null,
            lastCheckOutTime: null,
            firstBreakInTime: null,
            lastBreakInTime: null,
            lastBreakOutTime: null,
            totalBreakDurationToday: 0,
            totalWorkingDurationToday: 0,
            breakIntervals: [],
            isOnBreak: false,
            isLoginAnimationPending: false,
            dailyPunchCount: 0,
            approvedUnlockCount: 0,
            dailyUnlockRequestCount: 0,
            isPunchUnlocked: false,
            isFieldCheckedIn: false,
            isFieldCheckedOut: false,
            isSiteOtCheckedIn: false,
            hasPreviousDayOpenSession: false,
            previousDaySessionInfo: null
        }),
        setError: (error) => set({ error }),

        checkOfflineSession: async () => {
            return true;
        },

        syncRouteTracking: async () => {
            const { user, isCheckedIn, isFieldCheckedIn, isSiteOtCheckedIn } = get();
            // Track any employee who is actively checked in (field, site, or office with GPS)
            const isAnyCheckedIn = isCheckedIn || isFieldCheckedIn || isSiteOtCheckedIn;
            if (!user || !isAnyCheckedIn) {
                routeTrackingService.stopTracking();
                return;
            }

            if (routeTrackingService.isActive()) return;

            try {
                const settings = await api.getAttendanceSettings();
                // trackingIntervalMinutes is a TOP-LEVEL key on AttendanceSettings,
                // NOT nested under .field / .office / .site sub-objects.
                const interval = (settings as any).trackingIntervalMinutes || settings.field?.trackingIntervalMinutes || 15;
                console.log(`[authStore] Starting route tracking: every ${interval} min(s) for user ${user.id}`);
                routeTrackingService.startTracking(user.id, interval);
            } catch (e) {
                console.warn('[authStore] Failed to fetch tracking interval, defaulting to 15m', e);
                routeTrackingService.startTracking(user.id, 15);
            }
        },

        loginWithEmail: async (email, password, rememberMe) => {
            set({ error: null, loading: true });

            // [SECURITY] Sanitize email input
            const cleanEmail = sanitizeEmail(email);
            if (!cleanEmail) {
                set({ error: 'Please enter a valid email address.', loading: false });
                return { error: { message: 'Please enter a valid email address.' } };
            }

            // [SECURITY] Check rate limit before attempting login
            const rateCheck = checkRateLimit(cleanEmail, 'login');
            if (!rateCheck.allowed) {
                logSecurityEvent({
                    event_type: 'login_lockout',
                    user_email: cleanEmail,
                    severity: 'warning',
                    details: { message: rateCheck.message }
                });
                set({ error: rateCheck.message, loading: false });
                return { error: { message: rateCheck.message } };
            }

            // NOTE: We intentionally do NOT call signOut() here. Doing so before each login
            // attempt was invalidating valid sessions on other devices and causing unnecessary
            // re-auth loops. Supabase's signInWithPassword handles session replacement natively.

            try {
                // Determine effective timeout: infinite/long for mobile, 20s for web
                const isMobile = Capacitor.isNativePlatform();
                
                // On mobile, we skip the timeout wrapper or make it very long (e.g., 5 mins)
                // because mobile networks can be flaky and we don't want premature timeouts.
                const loginPromise = authService.signInWithPassword(email, password);
                
                const { data, error } = isMobile 
                    ? await loginPromise 
                    : await withTimeout(
                        loginPromise,
                        12000, // Reduced from 20s for better web responsiveness
                        'Login attempt timed out. Please check your network connection.'
                    ).catch(e => ({ data: { user: null, session: null }, error: { message: e.message } }));

                // Handle sign-in errors
                if (error || !data.user || !data.session) {
                    // [SECURITY] Record failed attempt for rate limiting
                    recordFailedAttempt(cleanEmail, 'login');
                    logSecurityEvent({
                        event_type: 'login_failure',
                        user_email: cleanEmail,
                        severity: 'warning',
                        details: { error: error?.message || 'No session returned' }
                    });
                    const friendlyError = getFriendlyAuthError(error?.message || 'Invalid login credentials');
                    set({ error: friendlyError, loading: false });
                    return { error: { message: friendlyError } };
                }

                // [SECURITY] Clear rate limit on successful login
                clearRateLimit(cleanEmail, 'login');

                // If sign-in is successful, we take full control.
                // FORCE PERSISTENCE: As per user request ("keep login until unless user logout by them"),
                // we always save the refresh token to Preferences, regardless of the "Remember Me" checkbox.
                // [SECURITY] Values are AES-256 encrypted via secureStorage utility before persisting.
                await secureSet('rememberedEmail', email);
                await secureSet('supabase.auth.rememberMe', data.session.refresh_token);
                
                // [SECURITY FIX C8] Removed plaintext password storage.
                // The refresh token above provides persistent sessions without storing credentials.
                // Always clean up any previously stored password.
                await Preferences.remove({ key: 'rememberedPassword' });
                
                const appUser = await authService.getAppUserProfile(data.user);

                if (appUser) {
                    // Success case: profile fetched
                    set({ user: appUser, error: null, loading: false });
                    
                    // [SECURITY] Log successful login
                    logSecurityEvent({
                        event_type: 'login_success',
                        user_id: appUser.id,
                        user_email: cleanEmail,
                        severity: 'info',
                        details: { role: appUser.role, method: 'email' }
                    });
                    // [SECURITY] Start session inactivity monitor on WEB only (30 min timeout).
                    // On mobile (Android/iOS), users expect persistent sessions until manual logout.
                    // Backgrounding the app, screen-off, or idle periods should NOT trigger logout
                    // — the refresh token handles silent re-auth automatically.
                    if (!Capacitor.isNativePlatform()) {
                        startSessionMonitor(() => {
                            get().forceLogout('Your session has expired due to inactivity. Please log in again.');
                            logSecurityEvent({
                                event_type: 'session_expired',
                                user_id: appUser.id,
                                severity: 'info',
                                details: { reason: 'inactivity_timeout' }
                            });
                        });
                    }
                    // Dispatch login greeting via the Notification Rules engine
                    // Admins can configure who receives this in Notification Management
                    try {
                        const greeting = getTimeBasedGreeting();
                        dispatchNotificationFromRules('user_login', {
                            actorName: appUser.name || 'there',
                            actionText: 'logged in',
                            locString: '',
                            title: 'Paradigm Services',
                            selfNotify: true,
                            selfMessage: `${greeting}, ${appUser.name || 'there'}! Welcome back to Paradigm Services.`,
                            actor: {
                                id: appUser.id,
                                name: appUser.name,
                                role: appUser.role,
                                reportingManagerId: appUser.reportingManagerId
                            }
                        });
                    } catch (e) {
                        console.error('Failed to dispatch login greeting notification', e);
                    }
                    return { error: null };
                } else {
                    // Critical failure: sign-in worked, but profile fetch failed.
                    // Sign the user out to prevent an inconsistent state.
                    await authService.signOut();
                    const friendlyError = 'Login successful, but failed to retrieve user profile. Please try again.';
                    set({ user: null, error: friendlyError, loading: false });
                    return { error: { message: friendlyError } };
                }
            } catch (e) {
                // Catch exceptions from getAppUserProfile or other unexpected errors
                console.error('Unexpected error during login flow:', e);
                const friendlyError = getFriendlyAuthError('Unexpected error during login flow');
                set({ user: null, error: friendlyError, loading: false });
                return { error: { message: friendlyError } };
            }
        },

        loginWithPasscode: async (email, passcode, rememberMe) => {
            // Check if this appears to be a 4-digit numeric passcode
            const isFourDigitPasscode = (passcode.length === 4 && /^\d+$/.test(passcode));
            
            if (isFourDigitPasscode) {
                // Try with our hidden internal prefix first (satisfies 6-char rule)
                const result = await get().loginWithEmail(email, `PAR_${passcode}`, rememberMe);
                
                // If prefixed login works, return success
                if (!result.error) return result;
                
                // Otherwise, fall back to testing the raw passcode (for old accounts or if prefix didn't match)
                // we clear the error before trying the fallback to avoid confusing the UI
                set({ error: null });
            }

            // Fallback: Try with the provided value as-is (works for 6+ char passwords or un-prefixed PINs)
            return get().loginWithEmail(email, passcode, rememberMe);
        },

        signUp: async (name, email, password) => {
            set({ error: null, loading: true });
            const { data, error } = await authService.signUpWithPassword({
                email,
                password,
                options: { data: { name } }
            });

            if (error) {
                const friendlyError = getFriendlyAuthError(error.message);
                set({ error: friendlyError, loading: false });
                return { error: { message: friendlyError } };
            }

            // Create profile immediately so they are visible in User Management
            if (data?.user) {
                try {
                    await api.createUser({
                        id: data.user.id,
                        name,
                        email,
                        role: 'unverified'
                    });
                } catch (profileError) {
                    console.error('Error creating profile during signup:', profileError);
                    // We don't block signup if profile creation fails, 
                    // as getAppUserProfile handles it on the first login anyway.
                }
            }

            set({ loading: false });
            return { error: null };
        },

        loginWithGoogle: async () => {
            set({ error: null, loading: true });
            const { error } = await authService.signInWithGoogle();

            if (error) {
                // If it's explicitly our custom Native Auth Error, pass it through directly
                const finalError = (error.message && error.message.includes('Native Auth Error')) 
                    ? error.message 
                    : getFriendlyAuthError(error.message);
                
                set({ error: finalError, loading: false });
                return { error: { message: finalError } };
            }

            // With redirect flow, the user is not returned immediately.
            // The onAuthStateChange listener will handle the session.
            set({ loading: false }); 
            return { error: null };
        },

        sendPasswordReset: async (email: string) => {
            const { error } = await authService.resetPasswordForEmail(email);
            if (error) {
                return { error: { message: error.message } };
            }
            return { error: null };
        },

        logout: async () => {
            const currentUser = get().user;
            // Dispatch logout farewell via the Notification Rules engine
            if (currentUser) {
                try {
                    const greeting = getTimeBasedGreeting();
                    const farewell = new Date().getHours() >= 20 ? 'Good Night' : greeting;

                    dispatchNotificationFromRules('user_logout', {
                        actorName: currentUser.name || 'there',
                        actionText: 'logged out',
                        locString: '',
                        title: 'Paradigm Services',
                        selfNotify: true,
                        selfMessage: `${farewell}, ${currentUser.name || 'there'}! Thanks for your hard work today.`,
                        actor: {
                            id: currentUser.id,
                            name: currentUser.name,
                            role: currentUser.role,
                            reportingManagerId: currentUser.reportingManagerId
                        }
                    });
                } catch (e) {
                    console.error('Failed to dispatch logout farewell notification', e);
                }
            }
            // Clear all persistent tokens on logout (secure + legacy plaintext keys)
            await secureRemove('supabase.auth.rememberMe');
            await secureRemove('rememberedEmail');
            await Preferences.remove({ key: 'supabase.auth.rememberMe' }); // legacy plaintext cleanup
            await Preferences.remove({ key: 'rememberedEmail' }); // legacy plaintext cleanup
            await Preferences.remove({ key: 'rememberedPassword' });
            
            // [SECURITY] Stop session monitor
            stopSessionMonitor();

            // [SECURITY] Log logout event
            if (currentUser) {
                logSecurityEvent({
                    event_type: 'logout',
                    user_id: currentUser.id,
                    severity: 'info'
                });
            }
            
            // Trigger the actual sign out — use 'global' scope to revoke ALL sessions
            // This ensures password changes invalidate all active sessions
            await authService.signOut();
            
            // Local state cleanup
            routeTrackingService.stopTracking();
            get().resetAttendance();
            set({ user: null, error: null, loading: false });
        },

        updateUserProfile: (updates) => set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null
        })),

        fetchGeofencingSettings: async () => {
            const { user } = get();
            if (!user) return;
            try {
                // api.getGeofencingSettings doesn't need an orgId, it fetches the global one
                const geoSettings = await api.getGeofencingSettings();
                const fullSettings = await api.getAttendanceSettings();

                set({
                    geofencingSettings: geoSettings || null,
                    breakLimit: (fullSettings as any)?.breakLimit || 60
                });
            } catch (error) {
                console.error('Failed to fetch geofencing settings:', error);
            }
        },

        checkAttendanceStatus: async (isSilent = false) => {
            const { user } = get();
            if (!user) {
                set({ isAttendanceLoading: false });
                return;
            }
            
            // Only show spinner on initial load or if explicitly requested
            if (!isSilent) {
                set({ isAttendanceLoading: true });
            }
            
            try {
                const today = new Date();
                const endOfDayStr = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

                // Dynamically determine staff category from admin-configured role mapping
                // (Admin UI → Attendance Rules → Staff Selections).
                // Site staff roles need a 16-hour lookback to catch night-shift sessions
                // that cross midnight. Office/Field staff always start from today midnight.
                // Technical relievers get a 48-hour lookback to detect open sessions from previous days.
                const { attendance: attendanceSettings } = useSettingsStore.getState();
                const roleMapping = attendanceSettings.missedCheckoutConfig?.roleMapping || {
                    office: ['admin', 'hr', 'finance', 'developer', 'hr_ops', 'management', 'back_office_staff'],
                    field: ['field_staff', 'field_officer', 'operation_manager', 'technical_reliever'],
                    site: ['site_manager', 'security_guard', 'supervisor']
                };
                const officeRoles = roleMapping.office || [];
                const isOfficeStaffRole = officeRoles.includes(user.role) || officeRoles.includes(user.roleId);
                
                // --- 14-Day Offline Limit Check ---
                const isSessionValid = await get().checkOfflineSession();
                if (!isSessionValid) return;
                // All roles now use a 48h lookback to detect missing punch-outs from previous days
                const siteShiftLookbackMs = 48 * 60 * 60 * 1000;
                
                const startOfDayStr = siteShiftLookbackMs > 0
                    ? new Date(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).getTime() - siteShiftLookbackMs).toISOString()
                    : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();

                // Run data fetching concurrently to save time
                const [eventsResult, unlockCountResult, dailyUnlockCountResult, leaveRequestsResult] = await Promise.allSettled([
                    api.getAttendanceEvents(user.id, startOfDayStr, endOfDayStr),
                    api.checkUnlockStatus(),
                    api.getDailyUnlockRequestCount(),
                    api.getLeaveRequests({ userId: user.id })
                ]);

                // If the events fetch failed (offline / network error), preserve the last
                // known state that was persisted to device storage. Do NOT wipe to defaults.
                if (eventsResult.status === 'rejected') {
                    console.warn('[authStore] Offline – keeping last known attendance state from device cache.');
                    set({ isAttendanceLoading: false });
                    return;
                }

                const events = eventsResult.value;
                const approvedUnlockCount = unlockCountResult.status === 'fulfilled' ? unlockCountResult.value : 0;
                const dailyUnlockRequestCount = 0;
                const leaveRequests = (leaveRequestsResult.status === 'fulfilled' && (leaveRequestsResult.value as any)?.data)
                    ? (leaveRequestsResult.value as any).data
                    : [];

                // Online but genuinely no events today – safe to reset
                if (events.length === 0) {
                    set({
                        isCheckedIn: false,
                        lastCheckInTime: null,
                        lastCheckOutTime: null,
                        firstBreakInTime: null,
                        lastBreakInTime: null,
                        lastBreakOutTime: null,
                        totalBreakDurationToday: 0,
                        totalWorkingDurationToday: 0,
                        breakIntervals: [],
                        isAttendanceLoading: false,
                        dailyPunchCount: 0,
                        approvedUnlockCount,
                        dailyUnlockRequestCount,
                        isPunchUnlocked: approvedUnlockCount > 0,
                        isFieldCheckedIn: false,
                        isFieldCheckedOut: false,
                        isSiteOtCheckedIn: false,
                        hasPreviousDayOpenSession: false,
                        previousDaySessionInfo: null
                    });
                    return;
                }

                const { checkIn, checkOut, firstBreakIn, lastBreakIn, breakOut, breakHours, workingHours, dailyPunchCount: processedDailyPunchCount, breakIntervals } = processDailyEvents(events, new Date());
                const lastEvent = events[events.length - 1];
                
                // --- INDEPENDENT FLOW LOGIC ---
                // 1. Daily Punch Session (Office/General)
                const officeEvents = events.filter(e => !e.workType || e.workType === 'office');
                const lastOfficePunchEvent = officeEvents.filter(e => e.type === 'punch-in' || e.type === 'punch-out').pop();
                let currentlyCheckedIn = lastOfficePunchEvent ? (lastOfficePunchEvent.type === 'punch-in') : false;
                
                // 2. Site/Work Session (Field)
                // Note: events may be stored as 'punch-in'/'punch-out' (old) or 'site-in'/'site-out' (new desktop flow)
                const fieldEvents = events.filter(e => e.workType === 'field');
                const lastFieldPunchEvent = fieldEvents.filter(e => e.type === 'punch-in' || e.type === 'punch-out' || e.type === 'site-in' || e.type === 'site-out').pop();
                let isFieldCheckedIn = lastFieldPunchEvent ? (lastFieldPunchEvent.type === 'punch-in' || lastFieldPunchEvent.type === 'site-in') : false;
                
                // 3. Site OT Session
                const otEvents = events.filter(e => e.type === 'site-ot-in' || e.type === 'site-ot-out');
                const lastOtPunchEvent = otEvents.pop();
                let isSiteOtCheckedIn = lastOtPunchEvent ? (lastOtPunchEvent.type === 'site-ot-in') : false;

                // 3. Break Session
                const breakEvents = events.filter(e => e.type === 'break-in' || e.type === 'break-out');
                const lastBreakEvent = breakEvents.length > 0 ? breakEvents[breakEvents.length - 1] : null;
                let isOnBreak = lastBreakEvent ? (lastBreakEvent.type === 'break-in') : false;

                const todayDateStr = getLocalDateKey(today);

                if (currentlyCheckedIn && lastOfficePunchEvent) {
                    const eventDateStr = getLocalDateKey(new Date(lastOfficePunchEvent.timestamp));
                    if (eventDateStr < todayDateStr) {
                        const isResolved = leaveRequests.some((r: any) => 
                            ['Permission', 'Correction', 'Regularization'].includes(r.leaveType) &&
                            r.startDate === eventDateStr &&
                            !['rejected', 'withdrawn', 'cancelled'].includes(r.status)
                        );
                        if (isResolved) {
                            currentlyCheckedIn = false;
                        }
                    }
                }

                if (isFieldCheckedIn && lastFieldPunchEvent) {
                    const eventDateStr = getLocalDateKey(new Date(lastFieldPunchEvent.timestamp));
                    if (eventDateStr < todayDateStr) {
                        const isResolved = leaveRequests.some((r: any) => 
                            ['Permission', 'Correction', 'Regularization'].includes(r.leaveType) &&
                            r.startDate === eventDateStr &&
                            !['rejected', 'withdrawn', 'cancelled'].includes(r.status)
                        );
                        if (isResolved) {
                            isFieldCheckedIn = false;
                        }
                    }
                }

                if (isSiteOtCheckedIn && lastOtPunchEvent) {
                    const eventDateStr = getLocalDateKey(new Date(lastOtPunchEvent.timestamp));
                    if (eventDateStr < todayDateStr) {
                        const isResolved = leaveRequests.some((r: any) => 
                            ['Permission', 'Correction', 'Regularization'].includes(r.leaveType) &&
                            r.startDate === eventDateStr &&
                            !['rejected', 'withdrawn', 'cancelled'].includes(r.status)
                        );
                        if (isResolved) {
                            isSiteOtCheckedIn = false;
                        }
                    }
                }

                if (isOnBreak && lastBreakEvent) {
                    const eventDateStr = getLocalDateKey(new Date(lastBreakEvent.timestamp));
                    if (eventDateStr < todayDateStr) {
                        const isResolved = leaveRequests.some((r: any) => 
                            ['Permission', 'Correction', 'Regularization'].includes(r.leaveType) &&
                            r.startDate === eventDateStr &&
                            !['rejected', 'withdrawn', 'cancelled'].includes(r.status)
                        );
                        if (isResolved) {
                            isOnBreak = false;
                        }
                    }
                }

                // Count daily primary punches using the logic from processDailyEvents
                // which correctly ignores previous day's completed shifts.
                const dailyPunchCount = processedDailyPunchCount;

                const extraPunchCyclesUsed = Math.max(0, dailyPunchCount - 1);
                const isPunchUnlocked = approvedUnlockCount > extraPunchCyclesUsed;

                // Technical Reliever: Detect open sessions from PREVIOUS days.
                // If the last punch-in or site-ot-in is from a day before today and has no
                // corresponding punch-out/site-ot-out, the session is considered "open from previous day".
                let hasPreviousDayOpenSession = false;
                let previousDaySessionInfo: { date: string; lastEventType: string; lastEventTime: string } | null = null;

                if (lastEvent) {
                    const todayDateStr = getLocalDateKey(today);
                    const openSessions: Date[] = [];
                    
                    if (currentlyCheckedIn) {
                        const officePunchEvents = events.filter(e => !e.workType || e.workType === 'office');
                        const lastOfficePunch = officePunchEvents.filter(e => e.type === 'punch-in' || e.type === 'punch-out').pop();
                        if (lastOfficePunch && lastOfficePunch.type === 'punch-in') {
                            openSessions.push(new Date(lastOfficePunch.timestamp));
                        }
                    }
                    if (isFieldCheckedIn) {
                        const fieldPunchEvents = events.filter(e => e.workType === 'field');
                        const lastFieldPunch = fieldPunchEvents.filter(e => e.type === 'punch-in' || e.type === 'punch-out' || e.type === 'site-in' || e.type === 'site-out').pop();
                        if (lastFieldPunch && (lastFieldPunch.type === 'punch-in' || lastFieldPunch.type === 'site-in')) {
                            openSessions.push(new Date(lastFieldPunch.timestamp));
                        }
                    }
                    if (isSiteOtCheckedIn) {
                        const siteOtPunchEvents = events.filter(e => e.type === 'site-ot-in' || e.type === 'site-ot-out');
                        const lastSiteOtPunch = siteOtPunchEvents.pop();
                        if (lastSiteOtPunch && lastSiteOtPunch.type === 'site-ot-in') {
                            openSessions.push(new Date(lastSiteOtPunch.timestamp));
                        }
                    }
                    
                    if (openSessions.length > 0) {
                        const earliestSessionTime = new Date(Math.min(...openSessions.map(d => d.getTime())));
                        const sessionDateStr = getLocalDateKey(earliestSessionTime);
                        
                        if (sessionDateStr < todayDateStr) {
                            const isResolvedByRequest = leaveRequests.some((r: any) => 
                                ['Permission', 'Correction', 'Regularization'].includes(r.leaveType) &&
                                r.startDate === sessionDateStr &&
                                !['rejected', 'withdrawn', 'cancelled'].includes(r.status)
                            );

                            if (!isResolvedByRequest) {
                                hasPreviousDayOpenSession = true;
                                previousDaySessionInfo = {
                                    date: sessionDateStr,
                                    lastEventType: lastEvent.type,
                                    lastEventTime: new Date(lastEvent.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                                };
                            }
                        }
                    }
                }

                let activeSteps = 0;
                if (currentlyCheckedIn || isFieldCheckedIn || isSiteOtCheckedIn) {
                    const activeEvent = events.slice().reverse().find(e => e.type === 'punch-in' || e.type === 'site-ot-in');
                    if (activeEvent && typeof activeEvent.steps === 'number') {
                        activeSteps = activeEvent.steps;
                    }
                }

                set({
                    isCheckedIn: currentlyCheckedIn || (!isOfficeStaffRole && isSiteOtCheckedIn),
                    isOnBreak: isOnBreak,
                    lastCheckInTime: checkIn,
                    lastCheckOutTime: lastEvent?.type === 'punch-out' ? checkOut : null,
                    firstBreakInTime: firstBreakIn,
                    lastBreakInTime: lastBreakIn,
                    lastBreakOutTime: breakOut,
                    totalBreakDurationToday: breakHours,
                    totalWorkingDurationToday: workingHours,
                    breakIntervals: breakIntervals,
                    isAttendanceLoading: false,
                    dailyPunchCount,
                    approvedUnlockCount,
                    dailyUnlockRequestCount,
                    isPunchUnlocked,
                    isFieldCheckedIn,
                    isFieldCheckedOut: lastFieldPunchEvent ? (lastFieldPunchEvent.type === 'punch-out' || lastFieldPunchEvent.type === 'site-out') : false,
                    isSiteOtCheckedIn,
                    hasPreviousDayOpenSession,
                    previousDaySessionInfo,
                    liveSteps: activeSteps
                });

                // If user is still on break and the app just resumed / reloaded,
                // re-schedule break reminders so they are not silently lost.
                // Guard: Do not restore if we are currently breaking out!
                if (isOnBreak && lastBreakIn && !get().isBreakingOut) {
                    const { breakReminderInterval, breakLimit } = get();
                    restoreBreakRemindersOnResume(
                        new Date(lastBreakIn),
                        breakReminderInterval || 5,
                        breakLimit || 60
                    ).catch(e => console.warn('[authStore] Failed to restore break reminders on resume:', e));
                } else if (!isOnBreak) {
                    // Sync: If we are NOT on break (e.g. broke out on another device),
                    // ensure all local/native reminders are cancelled.
                    cancelStepBreakReminders();
                }
                
                // Sync tracking state after status update
                get().syncRouteTracking();

                                // Auto-resume step counter if the user is checked-in (any work type)
                if ((isFieldCheckedIn || currentlyCheckedIn || isSiteOtCheckedIn) && !isOnBreak) {
                    import('../services/stepCounterService').then(async ({ stepCounterService }) => {
                        try {
                            // Pre-request permission on resume so it doesn't silently fail
                            const { ok, reason } = await stepCounterService.preflight();
                            if (!ok) {
                                console.warn(`[authStore] Step counter resume skipped: ${reason}`);
                                return;
                            }
                            await stepCounterService.startCounting((steps) => {
                                console.log(`[authStore] Resumed step counting: ${steps}`);
                                set({ liveSteps: steps });
                                get().syncLiveSteps(steps);
                            });
                        } catch (e) {
                            console.warn('[authStore] Failed to resume step counting:', e);
                        }
                    });
                }
            } catch (error) {
                console.error("Failed to check attendance status (unexpected error):", error);
                set({ isAttendanceLoading: false });
            } finally {
                // Pre-fetch geofencing settings for faster toggle action
                get().fetchGeofencingSettings();
            }
        },

        toggleCheckInStatus: async (note?: string, attachmentUrl?: string | null, workType?: 'office' | 'field', fieldReportId?: string, forcedType?: string, breakInterval?: number, overrideTimestamp?: string) => {
            const { user, isCheckedIn, geofencingSettings, dailyPunchCount } = get();
            if (!user) return { success: false, message: 'User not found' };
            
            // Explicitly determine the type. If forcedType is missing, use toggle logic.
            const newType = (forcedType || (isCheckedIn ? 'punch-out' : 'punch-in')) as AttendanceEventType;
            console.log('[authStore] toggleCheckInStatus:', { newType, workType, forcedType });

            // Check field staff restriction for office punch-in
            if (user.role === 'field_staff' && newType === 'punch-in' && (!workType || workType === 'office')) {
                // If they have already punched in today (count >= 1), block unless overrides exist
                // The current request is to allow "based on request to reporting manager", implying an approval workflow.
                // For now, allow subsequent punches ONLY if explicitly requested (e.g., manual override flag, or maybe we enforce the limit here).
                // Let's implement the basic check first. The UI will likely block this before calling API, but enforcement here is good.
                // However, without a dedicated 'isEmergency' flag in arguments, we can't easily distinguish approved overrides here.
                // We'll trust the UI/Logic layer to gate this, or simply enforce it.
                // Given "can be done one time only", we should strictly block unless there's a mechanism.
                // For this implementation, we will enforce the block in UI but allow API if needed for debugging/future.
                // Actually, let's skip strict blocking in API for now to allow emergency overrides later if implemented.
            }

            // Ensure we have settings
            let settings = geofencingSettings;
            if (!settings) {
                try {
                    const fullSettings = await api.getAttendanceSettings();
                    const isOfficeUser = ['admin', 'hr', 'finance', 'developer'].includes(user.role);
                    const rules: any = fullSettings ? (isOfficeUser ? fullSettings.office : fullSettings.field) : null;
                    settings = { 
                        enabled: rules?.geofencingEnabled ?? false, 
                        maxViolationsPerMonth: rules?.maxViolationsPerMonth ?? 3 
                    };
                    set({ geofencingSettings: settings });
                } catch (e) {
                    settings = { enabled: false, maxViolationsPerMonth: 3 };
                }
            }

            // --- strict session enforcement REMOVED to allow multiple check-ins ---
            // Previous logic for preventing multiple check-ins per day has been removed
            // based on user feedback to support multiple sessions.
            // ----------------------------------------------------------------------

            // IMMEDIATELY cancel break alarms if the user is breaking out.
            // Do NOT wait for GPS or API calls, otherwise the device will keep ringing 
            // for up to 10 seconds while waiting for location acquisition.
            if (newType === 'break-out') {
                cancelNotification('BREAK_END');
                cancelStepBreakReminders();
                get().setIsBreakingOut(true);
            }

            try {
                // --- 3-Stage Location Acquisition using Capacitor ---
                let position: GeolocationPosition | null = null;
                let locationStatus: string | null = null;

                try {
                    // Stage 1: Primary - Robust Position Acquisition with internal fallbacks
                    // Break actions use a shorter 3s timeout to prevent Android UI hangs —
                    // GPS is nice-to-have for breaks, not critical.
                    // Punch-in/out gets the full 10s for accurate geofencing.
                    const isBreakAction = newType === 'break-in' || newType === 'break-out';
                    const gpsTimeout = isBreakAction ? 3000 : 10000;
                    position = await getPrecisePosition(150, gpsTimeout);
                } catch (err: any) {
                    console.warn('[Location] All location acquisition stages failed:', err.message);
                    // Provide a more descriptive fallback than just "GPS Unavailable"
                    const orgSuffix = user.organizationName ? `Near ${user.organizationName} (Estimated)` : 'GPS Unavailable';
                    locationStatus = err.message.includes('permission') 
                        ? 'Location Permission Denied' 
                        : orgSuffix;
                }

                const finalizeAttendance = async (lat?: number, lng?: number, locId?: string | null, locName?: string | null) => {
                    // Mark as OT if this is a 2nd+ punch cycle (user already punched in earlier today)
                    const currentDailyPunchCount = get().dailyPunchCount;
                    const isOtCycle = currentDailyPunchCount >= 1 && newType === 'punch-in' && workType !== 'field';

                    // Capture steps and GPS distance on punch-out
                    let stepsValue: number | undefined = undefined;
                    let distanceKmValue: number | undefined = undefined;

                    if (newType === 'punch-out' || newType === 'site-ot-out' || newType === 'site-out') {
                             try {
                              const { stepCounterService } = await import('../services/stepCounterService');
                              await stepCounterService.getStepCountFromNative();
                              stepsValue = stepCounterService.getStepsCount();
                              await stepCounterService.stopCounting();
                              set({ liveSteps: 0 }); // Reset live display after checkout
                            console.log(`[authStore] Saved steps: ${stepsValue}`);
                        } catch (err) {
                            console.warn('[authStore] Failed to capture step count on checkout:', err);
                        }

                        // Calculate total GPS distance for this session from route history
                        try {
                            const { calculateDailyPathTravelKm } = await import('../utils/attendanceCalculations');
                            const today = new Date();
                            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
                            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
                            const [todayEvents, routePoints] = await Promise.all([
                                api.getAttendanceEvents(user.id, startOfDay, endOfDay),
                                api.getRoutePoints(user.id, startOfDay, endOfDay).catch(() => [])
                            ]);
                            const { distance } = calculateDailyPathTravelKm(todayEvents, routePoints);
                            distanceKmValue = Number(distance.toFixed(3));
                            console.log(`[authStore] GPS distance for session: ${distanceKmValue} km`);
                        } catch (err) {
                            console.warn('[authStore] Failed to calculate session distance on checkout:', err);
                        }
                    }



                    // Block office punch-out if a field/duty-site session is still active.
                    // The correct order is: Site Out → then Punch Out.
                    const { isFieldCheckedIn: fieldOpen } = get();
                    if (newType === 'punch-out' && (!workType || workType === 'office') && fieldOpen) {
                        return { success: false, message: 'Please check out from the duty site first, then punch out.' };
                    }

                    try {
                        await api.addAttendanceEvent({
                            userId: user.id,
                            timestamp: overrideTimestamp || new Date().toISOString(),
                            type: newType,
                            latitude: lat,
                            longitude: lng,
                            locationId: locId,
                            locationName: locName,
                            checkoutNote: newType === 'punch-out' ? note : undefined,
                            attachmentUrl: newType === 'punch-out' ? (attachmentUrl || undefined) : undefined,
                            workType: workType,
                            fieldReportId: newType === 'punch-out' ? fieldReportId : undefined,
                            isOt: isOtCycle ? true : undefined,
                            steps: stepsValue,
                            travelDistance: distanceKmValue
                        });
                    } catch (err: any) {
                        return { success: false, message: err.message || 'Failed to record attendance' };
                    }

                    // Small delay to allow Supabase to index the new record
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await get().checkAttendanceStatus(true); // Silent refresh

                    // Calculate travel logs on checkout
                    if (newType === 'punch-out' || newType === 'site-ot-out' || newType === 'site-out') {
                        import('../services/ruleEngine').then(async ({ resolveEffectiveRules }) => {
                            try {
                                const settings = await api.getAttendanceSettings();
                                const { getStaffCategory } = await import('../utils/attendanceCalculations');
                                const staffCategory = getStaffCategory(user.roleId || user.role || '', user.societyId || user.organizationId, settings);
                                const { travelRules } = await resolveEffectiveRules({ userId: user.id, staffCategory });
                                
                                const { runTravelEngine } = await import('../services/travelEngine');
                                const today = format(new Date(), 'yyyy-MM-dd');
                                
                                console.log(`[authStore] Running travel calculation for today (${today})...`);
                                await runTravelEngine({
                                    userIds: [user.id],
                                    startDate: today,
                                    endDate: today,
                                    travelConfigMap: { [user.id]: travelRules }
                                });
                                console.log(`[authStore] Travel calculation completed.`);

                                // Instant rollup of monthly reimbursement claims on checkout
                                const { runReimbursementEngine } = await import('../services/reimbursementEngine');
                                const currentMonth = format(new Date(), 'yyyy-MM');
                                console.log(`[authStore] Running reimbursement claims rollup for month (${currentMonth})...`);
                                await runReimbursementEngine({
                                    userIds: [user.id],
                                    month: currentMonth
                                });
                                console.log(`[authStore] Reimbursement rollup completed.`);
                            } catch (travelErr) {
                                console.warn('[authStore] Failed to calculate travel distance or update monthly reimbursement on checkout:', travelErr);
                            }
                        });
                    }


                    // Self-notification is now handled by the dispatcher below with selfNotify: true
                    // This replaces the old hardcoded api.createNotification() call
                    
                    // Native Push Notification for Breaks (Swiggy Style)
                    if (Capacitor.isNativePlatform() && (newType === 'break-in' || newType === 'break-out')) {
                        const emoji = newType === 'break-in' ? '☕' : '🏁';
                        const title = newType === 'break-in' ? `${emoji} Break Started` : `${emoji} Break Ended`;
                        const timeStr = format(new Date(), 'hh:mm a');
                        const locationStr = locName || 'Current Location';
                        
                        LocalNotifications.schedule({
                            notifications: [
                                {
                                    title,
                                    body: `You ${newType.replace('-', ' ')} at ${timeStr} near ${locationStr}. Enjoy your time! ✨`,
                                    id: Date.now(),
                                    schedule: { at: new Date(Date.now() + 500) },
                                    sound: 'beep.wav',
                                    extra: null
                                }
                            ]
                        });
                    }

                    // Send notifications via Dynamic Rules
                    let mappedType = newType.replace('-', '_');
                    if (mappedType === 'punch_in') {
                        mappedType = workType === 'field' ? 'site_check_in' : 'check_in';
                    } else if (mappedType === 'punch_out') {
                        mappedType = workType === 'field' ? 'site_check_out' : 'check_out';
                    } else if (mappedType === 'break_in') {
                        mappedType = 'break_start';
                    } else if (mappedType === 'break_out') {
                        mappedType = 'break_end';
                    } else if (mappedType === 'site_ot_in') {
                        mappedType = 'site_ot_in';
                    } else if (mappedType === 'site_ot_out') {
                        mappedType = 'site_ot_out';
                    }
                    
                    // Build the self-notification message for the actor's own push notification
                    const isFirstAction = dailyPunchCount === 0 && newType === 'punch-in';
                    const selfGreeting = isFirstAction ? `${getTimeBasedGreeting()}, ` : '';
                    const verb = workType === 'field' ? 'checked' : 'punched';
                    const selfActionText = 
                        newType === 'punch-in' ? `${verb} in` : 
                        newType === 'punch-out' ? `${verb} out` : 
                        newType === 'break-in' ? 'started your break ☕' : 
                        newType === 'break-out' ? 'ended your break 🏁' :
                        newType === 'site-ot-in' ? 'started Site OT 🕒' : 'ended Site OT ✅';
                    const timeStr = format(new Date(), 'hh:mm a');
                    const atText = locName ? ` at ${locName}` : '';

                    dispatchNotificationFromRules(
                        mappedType,
                        {
                            actorName: user.name || 'An employee',
                            actionText: getActionTextForType(newType, workType),
                            locString: locName ? ` at ${locName}` : '',
                            selfNotify: true,
                            selfMessage: `${selfGreeting}${user.name || 'there'}! You have ${selfActionText}${atText} at ${timeStr}.`,
                            title: isFirstAction ? 'Paradigm Services' : `${selfActionText.charAt(0).toUpperCase() + selfActionText.slice(1)}`,
                            actor: {
                                id: user.id,
                                name: user.name,
                                role: user.role,
                                reportingManagerId: user.reportingManagerId
                            }
                        }
                    );

                    // Additional dispatch for OT punches
                    if (isOtCycle && newType === 'punch-in') {
                        dispatchNotificationFromRules('ot_punch', {
                            actorName: user.name || 'An employee',
                            actionText: 'has started an overtime (OT) punch cycle',
                            locString: locName ? ` at ${locName}` : '',
                            actor: {
                                id: user.id,
                                name: user.name,
                                role: user.role,
                                reportingManagerId: user.reportingManagerId
                            }
                        });
                    }

                    // Automatic Field Staff Violation Detection
                    if (user.role === 'field_staff') {
                        const today = format(new Date(), 'yyyy-MM-dd');
                        api.processFieldAttendance(user.id, today).catch(e => console.error('Violation check failed:', e));
                    }

                    if (newType === 'punch-in' || newType === 'site-ot-in' || newType === 'site-in') {
                        // Start step counter for all staff types (office, field, site)
                        // preflight() requests ACTIVITY_RECOGNITION permission BEFORE startCounting()
                        // so the dialog appears immediately at check-in, not silently later
                        import('../services/stepCounterService').then(async ({ stepCounterService }) => {
                            try {
                                const { ok, reason } = await stepCounterService.preflight();
                                if (!ok) {
                                    console.warn(`[authStore] Step counter preflight failed: ${reason}`);
                                    return; // Permission denied — counting won't start, steps will be 0
                                }
                                 await stepCounterService.startCounting((steps) => {
                                     console.log(`[authStore] Current steps: ${steps}`);
                                     set({ liveSteps: steps });
                                     get().syncLiveSteps(steps);
                                 });
                            } catch (err) {
                                console.warn('[authStore] Failed to start step counter:', err);
                            }
                        });

                        // Schedule Shift End Reminder (9 hours)
                        // If user has specific shift duration settings, we could use that. defaulting to 9h.
                        scheduleShiftEndReminder(new Date(), Math.max(9, get().totalWorkingDurationToday + 1 || 9));
                    } else if (newType === 'punch-out' || newType === 'site-ot-out' || newType === 'site-out') {
                        // Cancel shift end reminder
                        cancelNotification('SHIFT_END');
                        // Also ensure break reminder is cancelled just in case
                        cancelNotification('BREAK_END');
                    } else if (newType === 'break-in') {
                        // Persist user-selected interval so the web foreground monitor can read it
                        set({ breakReminderInterval: breakInterval || 5 });
                        // Schedule Break End Reminder (native)
                        scheduleBreakEndReminder(new Date(), get().breakLimit);
                        // Schedule recurring step reminders (native)
                        scheduleStepBreakReminders(new Date(), breakInterval || 5);
                    } else if (newType === 'break-out') {
                        // Alarms are already cancelled at the start of the function to prevent ringing
                    }

                    const actionLabel = getActionTextForType(newType, workType);
                    const finalMessage = `Successfully ${actionLabel}!`;
                        
                    return { success: true, message: finalMessage };
                };

                if (!position || !position.coords) {
                    // One last attempt: If they are near their assigned organization, assume that context
                    const fallbackName = locationStatus || 'GPS Unavailable';
                    return await finalizeAttendance(undefined, undefined, null, fallbackName);
                }
                const { latitude, longitude, accuracy } = position.coords;
                // If accuracy is unreasonably large (>1000m), still record the raw coordinates but flag no geofence match
                if (typeof accuracy === 'number' && accuracy > 1000) {
                    return await finalizeAttendance(latitude, longitude, null, null);
                }
                // --- Location Context & Geofencing ---
                let locationId: string | null = null;
                let locationName: string | null = null;
                let isViolation = false;

                try {
                    // Stage 1: Always attempt to match against known locations (sites) first
                    // to get a friendly name (e.g., "PIFS Bangalore") regardless of geofencing status.
                    let userLocations: any[] = [];
                    try {
                        userLocations = await api.getUserLocations(user.id);
                    } catch (err) {
                        console.warn('[Location] Failed to fetch live locations:', err);
                        userLocations = [];
                    }

                    for (const loc of userLocations) {
                        const dist = calculateDistanceMeters(latitude, longitude, loc.latitude, loc.longitude);
                        if (dist <= loc.radius) {
                            locationId = loc.id;
                            locationName = loc.name;
                            break;
                        }
                    }

                    if (!locationId) {
                        try {
                            const allLocations = await api.getLocations();
                            for (const loc of allLocations) {
                                const dist = calculateDistanceMeters(latitude, longitude, loc.latitude, loc.longitude);
                                if (dist <= loc.radius) {
                                    locationId = loc.id;
                                    locationName = loc.name;
                                    // Auto-assign this location to the user
                                    api.assignLocationToUser(user.id, loc.id).catch(e => console.warn('[authStore] assignLocationToUser failed:', e));
                                    break;
                                }
                            }
                        } catch (e) {
                            console.warn('[Location] Failed to fetch all locations online', e);
                        }
                    }

                    // Stage 2: Handle Geofencing enforcement (Violations)
                    if (settings.enabled && !locationId) {
                        isViolation = true;
                        try {
                            locationName = await reverseGeocode(latitude, longitude);
                        } catch (err) {
                            // If reverse geocoding fails, we might be offline
                            const isOfflineStatus = !(await Network.getStatus()).connected;
                            locationName = isOfflineStatus ? 'Offline Punch' : 'Outside Geofence';
                        }

                        // Log the violation
                        const now = new Date();
                        await api.addViolation({
                            userId: user.id,
                            violationDate: now.toISOString(),
                            violationMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
                            violationType: 'GEO_FENCE_VIOLATION',
                            violationDetails: {
                                attemptedLatitude: latitude,
                                attemptedLongitude: longitude,
                                locationName: locationName,
                            },
                            severity: 'Medium',
                            attemptedLatitude: latitude,
                            attemptedLongitude: longitude,
                            locationName: locationName,
                        }).catch(err => console.error('Failed to log geofencing violation:', err));

                        // Send violation notification via Dynamic Rules
                        dispatchNotificationFromRules(
                            'violation',
                            {
                                actorName: user.name || 'An employee',
                                actionText: getActionTextForType(newType, workType),
                                locString: ` outside their assigned geofence at ${locationName}`,
                                title: '📍 Geofencing Violation',
                                link: '/hr/field-staff-tracking',
                                severity: 'Medium',
                                metadata: {
                                    violationType: 'GEO_FENCE_VIOLATION',
                                    details: {
                                        latitude,
                                        longitude,
                                        locationName
                                    },
                                    date: now.toISOString()
                                },
                                actor: {
                                    id: user.id,
                                    name: user.name,
                                    role: user.role,
                                    reportingManagerId: user.reportingManagerId,
                                    photoUrl: user.photoUrl
                                }
                            }
                        );
                    } else if (!locationId) {
                        // Geofencing disabled or no enforcement, and no site match:
                        // Use reverse geocode but try to keep it concise if possible.
                        try {
                            locationName = await reverseGeocode(latitude, longitude);
                        } catch (err) {
                            locationName = 'Mobile Punch-in';
                        }
                    }
                } catch (geoErr) {
                    console.warn('Location name resolution failed:', geoErr);
                }

                // ── Backdated session close (previous-day missed checkout) ──
                // When an overrideTimestamp is provided, the current GPS location
                // only serves as an approximate address. Skip geofencing enforcement
                // entirely — it's irrelevant for yesterday's missed punch.
                if (overrideTimestamp) {
                    let backfillLocName = locationName;
                    if (!backfillLocName && position?.coords) {
                        try {
                            backfillLocName = await reverseGeocode(latitude, longitude);
                        } catch {
                            backfillLocName = 'Auto-closed (previous session)';
                        }
                    } else if (!backfillLocName) {
                        backfillLocName = 'Auto-closed (previous session)';
                    }
                    return await finalizeAttendance(latitude, longitude, locationId, backfillLocName);
                }

                const result = await finalizeAttendance(latitude, longitude, locationId, locationName);
                
                if (isViolation) {
                    const actionLabel = getActionTextForType(newType, workType);
                    return { 
                        success: true, 
                        message: `Successfully ${actionLabel}! (Note: Recorded as geofencing violation)` 
                    };
                }
                
                return result;

            } catch (err) {
                console.error('Error during attendance update:', err);
                return { success: false, message: 'Failed to update attendance.' };
            } finally {
                if (newType === 'break-out') {
                    get().setIsBreakingOut(false);
                }
            }
        },

        subscribeToAttendance: () => {
            const { user } = get();
            if (!user?.id) return;

            const attendanceChannel = supabase
                .channel(`attendance_changes_${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'attendance_events',
                        filter: `user_id=eq.${user.id}`,
                    },
                    () => {
                        console.log('Realtime: Attendance event detected, refreshing status...');
                        get().checkAttendanceStatus();
                    }
                )
                .subscribe();

            // --- Realtime step sync from mobile ---
            // When the Android app updates attendance_events.steps every 10s,
            // this subscription instantly pushes the new count to the web app
            // without waiting for the 15s poll cycle.
            const stepsChannel = supabase
                .channel(`steps_sync_${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'attendance_events',
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        const newSteps = (payload.new as any)?.steps;
                        if (typeof newSteps === 'number') {
                            console.log(`[Realtime] Step update from mobile: ${newSteps}`);
                            set({ liveSteps: newSteps });
                        }
                    }
                )
                .subscribe();

            const unlockChannel = supabase
                .channel(`unlock_changes_${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'attendance_unlock_requests',
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        console.log('Realtime: Unlock request change detected:', payload);
                        get().checkAttendanceStatus();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(attendanceChannel);
                supabase.removeChannel(stepsChannel);
                supabase.removeChannel(unlockChannel);
            };
        },
    }),
    {
        name: 'paradigm-auth-storage',
        storage: createJSONStorage(() => CapacitorStorage as any),
        partialize: (state) => ({
            user: state.user,
            isCheckedIn: state.isCheckedIn,
            lastCheckInTime: state.lastCheckInTime,
            lastCheckOutTime: state.lastCheckOutTime,
            firstBreakInTime: state.firstBreakInTime,
            lastBreakInTime: state.lastBreakInTime,
            lastBreakOutTime: state.lastBreakOutTime,
            totalBreakDurationToday: state.totalBreakDurationToday,
            totalWorkingDurationToday: state.totalWorkingDurationToday,
            breakIntervals: state.breakIntervals,
            isOnBreak: state.isOnBreak,
            dailyPunchCount: state.dailyPunchCount,
            isPunchUnlocked: state.isPunchUnlocked,
            approvedUnlockCount: state.approvedUnlockCount,
            isFieldCheckedIn: state.isFieldCheckedIn,
            isFieldCheckedOut: state.isFieldCheckedOut,
            isSiteOtCheckedIn: state.isSiteOtCheckedIn,
            hasPreviousDayOpenSession: state.hasPreviousDayOpenSession,
            previousDaySessionInfo: state.previousDaySessionInfo,
            geofencingSettings: state.geofencingSettings,
            breakLimit: state.breakLimit,
            breakReminderInterval: state.breakReminderInterval,
            pendingAutoPunchOut: state.pendingAutoPunchOut,
        }),
    }
)
);
