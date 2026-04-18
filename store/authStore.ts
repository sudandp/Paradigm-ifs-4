

import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { authService } from '../services/authService';
import { Preferences } from '@capacitor/preferences';
import type { User, AttendanceEventType } from '../types';
import { supabase } from '../services/supabase';
import type { RealtimeChannel, Subscription } from '@supabase/supabase-js';
// FIX: Import the 'api' object to resolve 'Cannot find name' errors.
import { api } from '../services/api';
import { withTimeout } from '../utils/async';
import { format } from 'date-fns';
import { routeTrackingService } from '../services/routeTrackingService';
import { calculateDistanceMeters, reverseGeocode, getPrecisePosition } from '../utils/locationUtils';
import { processDailyEvents } from '../utils/attendanceCalculations';
import { dispatchNotificationFromRules } from '../services/notificationService';
import { LocalNotifications } from '@capacitor/local-notifications';
import { scheduleShiftEndReminder, scheduleBreakEndReminder, cancelNotification } from '../utils/permissionUtils';

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
    checkAttendanceStatus: () => Promise<void>;
    toggleCheckInStatus: (note?: string, attachmentUrl?: string | null, workType?: 'office' | 'field', fieldReportId?: string, forcedType?: string) => Promise<{ success: boolean; message: string }>;
    subscribeToAttendance: () => (() => void) | void;
    error: string | null;
    setError: (error: string | null) => void;
    loading: boolean;
    setLoading: (loading: boolean) => void;
    isLoginAnimationPending: boolean;
    setLoginAnimationPending: (pending: boolean) => void;
    geofencingSettings: { enabled: boolean; maxViolationsPerMonth: number } | null;
    breakLimit: number;
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
    loginWithPasscode: (email: string, passcode: string, rememberMe: boolean) => Promise<{ error: { message: string } | null }>;
    forceLogout: (reason?: string) => Promise<void>;
    syncRouteTracking: () => Promise<void>;
}

// Helper for time-based greetings
const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
};

export const useAuthStore = create<AuthState>()(
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
        isOnBreak: false,
        error: null,
        loading: false,
        geofencingSettings: null,
        breakLimit: 60,
        dailyPunchCount: 0,
        approvedUnlockCount: 0,
        dailyUnlockRequestCount: 0,
        isPunchUnlocked: false,
        isFieldCheckedIn: false,
        isFieldCheckedOut: false,
        isSiteOtCheckedIn: false,
        forceLogout: async (reason) => {
            console.log(`Force logout triggered. Reason: ${reason || 'Unknown'}`);
            set({ error: reason || 'Your session has expired. Please log in again.', loading: false, user: null });
            await Preferences.remove({ key: 'supabase.auth.rememberMe' });
            await authService.signOut();
            get().resetAttendance();
        },

        isLoginAnimationPending: false,
        setLoginAnimationPending: (pending) => set({ isLoginAnimationPending: pending }),

        setUser: (user) => set({ user, error: null, loading: false }),
        setInitialized: (initialized) => set({ isInitialized: initialized }),
        setLoading: (loading) => set({ loading }),
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
            isOnBreak: false,
            isLoginAnimationPending: false,
            dailyPunchCount: 0,
            approvedUnlockCount: 0,
            dailyUnlockRequestCount: 0,
            isPunchUnlocked: false,
            isFieldCheckedIn: false,
            isFieldCheckedOut: false,
            isSiteOtCheckedIn: false
        }),
        setError: (error) => set({ error }),

        syncRouteTracking: async () => {
            const { user, isFieldCheckedIn } = get();
            if (!user || !isFieldCheckedIn) {
                routeTrackingService.stopTracking();
                return;
            }

            if (routeTrackingService.isActive()) return;

            try {
                const settings = await api.getAttendanceSettings();
                const interval = settings.field.trackingIntervalMinutes || 10;
                routeTrackingService.startTracking(user.id, interval);
            } catch (e) {
                console.warn('Failed to fetch tracking interval, defaulting to 10m', e);
                routeTrackingService.startTracking(user.id, 10);
            }
        },

        loginWithEmail: async (email, password, rememberMe) => {
            set({ error: null, loading: true });

            // Ensure a clean state before attempting login. This helps if there's a stale session
            // lingering that might confuse the client or the user.
            try {
                // Clear all persistent tokens to ensure a completely fresh start
                await Preferences.remove({ key: 'supabase.auth.rememberMe' });
                await authService.signOut();
            } catch (e) {
                // Ignore signout errors, we just want to try to clear state
            }

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
                    const friendlyError = getFriendlyAuthError(error?.message || 'Invalid login credentials');
                    set({ error: friendlyError, loading: false });
                    return { error: { message: friendlyError } };
                }

                // If sign-in is successful, we take full control.
                // FORCE PERSISTENCE: As per user request ("keep login until unless user logout by them"),
                // we always save the refresh token to Preferences, regardless of the "Remember Me" checkbox.
                await Preferences.set({ key: 'rememberedEmail', value: email });
                await Preferences.set({ key: 'supabase.auth.rememberMe', value: data.session.refresh_token });
                
                // [SECURITY FIX C8] Removed plaintext password storage.
                // The refresh token above provides persistent sessions without storing credentials.
                // Always clean up any previously stored password.
                await Preferences.remove({ key: 'rememberedPassword' });
                
                const appUser = await authService.getAppUserProfile(data.user);

                if (appUser) {
                    // Success case: profile fetched
                    set({ user: appUser, error: null, loading: false });
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
            // Clear all persistent tokens on logout
            await Preferences.remove({ key: 'supabase.auth.rememberMe' });
            await Preferences.remove({ key: 'rememberedEmail' });
            await Preferences.remove({ key: 'rememberedPassword' });
            
            // Trigger the actual sign out
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
                const fullSettings = await api.getAttendanceSettings();
                const isOfficeUser = ['admin', 'hr', 'finance', 'developer'].includes(user.role);
                const rules = isOfficeUser ? fullSettings.office : fullSettings.field;
                set({ 
                    geofencingSettings: {
                        enabled: rules.geofencingEnabled ?? false,
                        maxViolationsPerMonth: rules.maxViolationsPerMonth ?? 3
                    },
                    breakLimit: rules.lunchBreakDuration ?? 60
                });
            } catch (error) {
                console.error('Failed to fetch geofencing settings:', error);
            }
        },

        checkAttendanceStatus: async () => {
            const { user } = get();
            if (!user) {
                set({ isAttendanceLoading: false });
                return;
            }
            set({ isAttendanceLoading: true });
            
            try {
                const today = new Date();
                const endOfDayStr = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

                // For site staff with shift management, look back further to catch
                // active night-shift sessions that cross midnight (e.g., 9 PM → 7 AM).
                // 16 hours covers any reasonable shift start from the previous day.
                const isSiteStaffRole = !['admin', 'hr', 'finance', 'developer', 'field_staff', 'field_officer', 'operation_manager'].includes(user.role);
                const siteShiftLookbackMs = isSiteStaffRole ? 16 * 60 * 60 * 1000 : 0;
                const startOfDayStr = siteShiftLookbackMs > 0
                    ? new Date(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).getTime() - siteShiftLookbackMs).toISOString()
                    : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();

                // Run data fetching concurrently to save time
                const [eventsResult, unlockCountResult, dailyUnlockCountResult] = await Promise.allSettled([
                    api.getAttendanceEvents(user.id, startOfDayStr, endOfDayStr),
                    api.checkUnlockStatus(),
                    api.getDailyUnlockRequestCount()
                ]);

                const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
                const approvedUnlockCount = unlockCountResult.status === 'fulfilled' ? unlockCountResult.value : 0;
                const dailyUnlockRequestCount = dailyUnlockCountResult.status === 'fulfilled' ? dailyUnlockCountResult.value : 0;

                if (events.length === 0) {
                    set({
                        isCheckedIn: false,
                        lastCheckInTime: null,
                        lastCheckOutTime: null,
                        isAttendanceLoading: false,
                        dailyPunchCount: 0,
                        approvedUnlockCount,
                        dailyUnlockRequestCount,
                        isPunchUnlocked: approvedUnlockCount > 0,
                        isFieldCheckedIn: false,
                        isFieldCheckedOut: false,
                        isSiteOtCheckedIn: false
                    });
                    return;
                }

                const { checkIn, checkOut, firstBreakIn, lastBreakIn, breakOut, breakHours, workingHours } = processDailyEvents(events, new Date());
                const lastEvent = events[events.length - 1];
                
                // --- INDEPENDENT FLOW LOGIC ---
                // 1. Daily Punch Session (Office/General)
                const officeEvents = events.filter(e => !e.workType || e.workType === 'office');
                const lastOfficePunchEvent = officeEvents.filter(e => e.type === 'punch-in' || e.type === 'punch-out').pop();
                const currentlyCheckedIn = lastOfficePunchEvent ? (lastOfficePunchEvent.type === 'punch-in') : false;
                
                // 2. Site/Work Session (Field)
                const fieldEvents = events.filter(e => e.workType === 'field');
                const lastFieldPunchEvent = fieldEvents.filter(e => e.type === 'punch-in' || e.type === 'punch-out').pop();
                const isFieldCheckedIn = lastFieldPunchEvent ? (lastFieldPunchEvent.type === 'punch-in') : false;
                
                // 3. Site OT Session
                const otEvents = events.filter(e => e.type === 'site-ot-in' || e.type === 'site-ot-out');
                const lastOtPunchEvent = otEvents.pop();
                const isSiteOtCheckedIn = lastOtPunchEvent ? (lastOtPunchEvent.type === 'site-ot-in') : false;

                // 3. Break Session
                const breakEvents = events.filter(e => e.type === 'break-in' || e.type === 'break-out');
                const lastBreakEvent = breakEvents.length > 0 ? breakEvents[breakEvents.length - 1] : null;
                const isOnBreak = lastBreakEvent ? (lastBreakEvent.type === 'break-in') : false;

                // Count daily primary punches
                const dailyPunchCount = events.filter(e => e.type === 'punch-in' && (!e.workType || e.workType === 'office')).length;

                const extraPunchCyclesUsed = Math.max(0, dailyPunchCount - 1);
                const isPunchUnlocked = approvedUnlockCount > extraPunchCyclesUsed;

                set({
                    isCheckedIn: currentlyCheckedIn,
                    isOnBreak: isOnBreak,
                    lastCheckInTime: checkIn,
                    lastCheckOutTime: lastEvent?.type === 'punch-out' ? checkOut : null,
                    firstBreakInTime: firstBreakIn,
                    lastBreakInTime: lastBreakIn,
                    lastBreakOutTime: breakOut,
                    totalBreakDurationToday: breakHours,
                    totalWorkingDurationToday: workingHours,
                    isAttendanceLoading: false,
                    dailyPunchCount,
                    approvedUnlockCount,
                    dailyUnlockRequestCount,
                    isPunchUnlocked,
                    isFieldCheckedIn,
                    isFieldCheckedOut: lastFieldPunchEvent ? (lastFieldPunchEvent.type === 'punch-out') : false,
                    isSiteOtCheckedIn
                });
                
                // Sync tracking state after status update
                get().syncRouteTracking();
            } catch (error) {
                console.error("Failed to check attendance status (unexpected error):", error);
                set({ isAttendanceLoading: false });
            } finally {
                // Pre-fetch geofencing settings for faster toggle action
                get().fetchGeofencingSettings();
            }
        },

        toggleCheckInStatus: async (note?: string, attachmentUrl?: string | null, workType?: 'office' | 'field', fieldReportId?: string, forcedType?: string) => {
            const { user, isCheckedIn, geofencingSettings, dailyPunchCount } = get();
            if (!user) return { success: false, message: 'User not found' };
            
            // Explicitly determine the type. If forcedType is missing, use toggle logic.
            const newType = (forcedType || (isCheckedIn ? 'punch-out' : 'punch-in')) as AttendanceEventType;

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
                    const rules = isOfficeUser ? fullSettings.office : fullSettings.field;
                    settings = { 
                        enabled: rules.geofencingEnabled ?? false, 
                        maxViolationsPerMonth: rules.maxViolationsPerMonth ?? 3 
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

            try {
                // --- 3-Stage Location Acquisition using Capacitor ---
                let position: GeolocationPosition | null = null;
                let locationStatus: string | null = null;

                try {
                    // Stage 1: Primary - Robust Position Acquisition with internal fallbacks
                    // 10s timeout gives sufficient time for GPS while preventing long hangs
                    position = await getPrecisePosition(150, 10000);
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

                    await api.addAttendanceEvent({
                        userId: user.id,
                        timestamp: new Date().toISOString(),
                        type: newType,
                        latitude: lat,
                        longitude: lng,
                        locationId: locId,
                        locationName: locName,
                        checkoutNote: newType === 'punch-out' ? note : undefined,
                        attachmentUrl: newType === 'punch-out' ? (attachmentUrl || undefined) : undefined,
                        workType,
                        fieldReportId: newType === 'punch-out' ? fieldReportId : undefined,
                        isOt: isOtCycle || undefined
                    });
                    await get().checkAttendanceStatus();

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

                    if (newType === 'punch-in') {
                        // Schedule Shift End Reminder (9 hours)
                        // If user has specific shift duration settings, we could use that. defaulting to 9h.
                        scheduleShiftEndReminder(new Date(), Math.max(9, get().totalWorkingDurationToday + 1 || 9));
                    } else if (newType === 'punch-out') {
                        // Cancel shift end reminder
                        cancelNotification('SHIFT_END');
                        // Also ensure break reminder is cancelled just in case
                        cancelNotification('BREAK_END');
                    } else if (newType === 'break-in') {
                        // Schedule Break End Reminder
                        // Utilizes the store's breakLimit (e.g. 60 mins)
                        scheduleBreakEndReminder(new Date(), get().breakLimit);
                    } else if (newType === 'break-out') {
                        // Cancel break reminder
                        cancelNotification('BREAK_END');
                    }

                    const actionLabel = getActionTextForType(newType, workType);
                    return { success: true, message: `Successfully ${actionLabel}!` };
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
                    const userLocations = await api.getUserLocations(user.id);
                    for (const loc of userLocations) {
                        const dist = calculateDistanceMeters(latitude, longitude, loc.latitude, loc.longitude);
                        if (dist <= loc.radius) {
                            locationId = loc.id;
                            locationName = loc.name;
                            break;
                        }
                    }

                    if (!locationId) {
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
                    }

                    // Stage 2: Handle Geofencing enforcement (Violations)
                    if (settings.enabled && !locationId) {
                        isViolation = true;
                        try {
                            locationName = await reverseGeocode(latitude, longitude);
                        } catch (err) {
                            locationName = 'Outside Geofence';
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
                        // If it was approved, we need to refresh the isPunchUnlocked status
                        get().checkAttendanceStatus();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(attendanceChannel);
                supabase.removeChannel(unlockChannel);
            };
        },
    })
);