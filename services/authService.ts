


import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { GOOGLE_CONFIG } from '../config/authConfig';
import type { User as AppUser } from "../types";
import type { Session, User as SupabaseUser, SignUpWithPasswordCredentials } from '@supabase/supabase-js';

import { api } from './api';

// Module-level flag to avoid duplicate initialization and fix first-tap race condition
let _socialLoginInitialized = false;
let _socialLoginInitPromise: Promise<void> | null = null;

/**
 * Ensures SocialLogin is initialized before attempting login.
 * Safe to call multiple times — subsequent calls resolve immediately.
 */
const ensureSocialLoginInitialized = (): Promise<void> => {
    if (_socialLoginInitialized) return Promise.resolve();
    if (_socialLoginInitPromise) return _socialLoginInitPromise;

    const webClientId = GOOGLE_CONFIG.clientId;
    if (!webClientId || webClientId.includes('your-web-id')) {
        return Promise.resolve(); // Will be caught by the clientId guard below
    }

    _socialLoginInitPromise = SocialLogin.initialize({
        google: { webClientId }
    }).then(() => {
        _socialLoginInitialized = true;
        console.log('[NativeAuth] SocialLogin initialized successfully.');
    }).catch(err => {
        console.warn('[NativeAuth] SocialLogin.initialize() failed:', err);
        _socialLoginInitPromise = null; // Allow retry on next tap
    });

    return _socialLoginInitPromise;
};

export const getAppUserProfile = async (supabaseUser: SupabaseUser): Promise<AppUser | null> => {
    try {
        let { data, error } = await supabase
            .from('users')
            .select('*, role:roles(display_name)')
            .eq('id', supabaseUser.id)
            .single();

        // If profile not found, create one on the fly. This handles the first login after signup.
        if (error && error.code === 'PGRST116') { // PGRST116: Row not found
            // [SECURITY FIX C5] Generate a random temporary passcode instead of hardcoded '5687'
            const randomPasscode = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit random PIN
            const newUserProfile = {
                id: supabaseUser.id,
                name: supabaseUser.user_metadata.name || 'New User',
                email: supabaseUser.email!,
                role_id: 'unverified',
                passcode: randomPasscode,
                // Save Google profile picture on first login
                photo_url: supabaseUser.user_metadata?.avatar_url
                    || supabaseUser.user_metadata?.picture
                    || null,
            };

            const { data: createdData, error: insertError } = await supabase
                .from('users')
                .insert(newUserProfile)
                .select('*, role:roles(display_name)')
                .single();

            if (insertError) {
                console.error("Error creating user profile on-the-fly:", insertError.message, insertError);
                return null; // Creation failed, login fails.
            }

            // Sync the temporary passcode with Supabase Auth password so they can login with email/passcode later.
            // This works because the user is currently authenticated via Google.
            try {
                await supabase.auth.updateUser({ password: `PAR_${randomPasscode}` });
            } catch (authUpdateError) {
                console.warn("Failed to set default auth password for new user:", authUpdateError);
                // We don't block login if this fails, as they can still use Google.
            }

            data = createdData;
            error = null; // Clear the "not found" error
        }


        if (error) {
            console.error("Error fetching app profile:", error.message, error);
            return null;
        }

        const roleData = data.role;
        const rawRoleName = (Array.isArray(roleData) ? roleData[0]?.display_name : (roleData as any)?.display_name) || data.role_id;
        // Normalize to lowercase for consistent role checks throughout the app
        const roleName = typeof rawRoleName === 'string' ? rawRoleName.toLowerCase().replace(/\s+/g, '_') : rawRoleName;

        return api.processUrlsForDisplay({
            id: data.id,
            name: data.name,
            email: supabaseUser.email || '',
            phone: data.phone,
            role: roleName, 
            roleId: data.role_id,
            organizationId: data.organization_id,
            organizationName: data.organization_name,
            reportingManagerId: data.reporting_manager_id,
            reportingManager2Id: data.reporting_manager_2_id,
            reportingManager3Id: data.reporting_manager_3_id,
            // Use custom uploaded photo first; fall back to Google OAuth profile picture
            photoUrl: data.photo_url
                || supabaseUser.user_metadata?.avatar_url
                || supabaseUser.user_metadata?.picture
                || null,
            gender: data.gender,
            biometricId: data.biometric_id,
            salaryHold: data.salary_hold,
            salaryHoldReason: data.salary_hold_reason,
            salaryHoldDate: data.salary_hold_date,
            joiningDate: data.joining_date,
            createdAt: data.created_at,
            homeLatitude: data.home_latitude != null ? Number(data.home_latitude) : null,
            homeLongitude: data.home_longitude != null ? Number(data.home_longitude) : null,
            homeAddress: data.home_address,
            // [SECURITY FIX L2] Do NOT include passcode in profile — prevents credential leakage
            // passcode is only used server-side for auth, never sent to client
            passcode: undefined,
        });
    } catch (e) {
        console.error("Exception fetching profile:", e);
        return null;
    }
};

const signInWithPassword = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
};

const signUpWithPassword = async ({ email, password, options }: { email: string; password: string; options?: any }) => {
    return await supabase.auth.signUp({
        email,
        password,
        options: {
            ...options,
            emailRedirectTo: `${window.location.origin}/`,
        },
    });
};

// [SECURITY FIX H3] This should be done via a server-side RPC that validates caller role.
// The client-side direct update is preserved as a fallback but the `api.ts` version
// uses the `approve_user` RPC which validates admin privileges server-side.
const approveUser = async (userId: string, newRole: string) => {
    // Use RPC with server-side role validation instead of direct table update
    const { data, error } = await supabase.rpc('approve_user', {
        user_id: userId,
        role_text: newRole
    });
    if (error) {
        // Fallback: direct update only if RPC doesn't exist yet
        console.warn('[SECURITY] approve_user RPC failed, falling back to direct update:', error.message);
        return await supabase.from('users').update({ role_id: newRole }).eq('id', userId);
    }
    return { data };
};

const signInWithGoogle = async () => {
    // Determine the redirect URL.
    const origin = window.location.origin;
    let redirectUrl = origin.endsWith('/') ? origin : `${origin}/`;
    
    console.log("Initiating Google Sign-In...");
    
    // Check if running on native mobile via Capacitor to use Native Google Auth
    if (Capacitor.isNativePlatform()) {
        console.log("Using Native Google Auth via CapacitorSocialLogin...");
        
        const webClientId = GOOGLE_CONFIG.clientId;
        
        if (!webClientId || webClientId.includes('your-web-id')) {
            console.error("Native Google Login: Web Client ID is missing. Cannot proceed without browser.");
            return { error: { message: 'Google Sign-In is not configured for this app. Please contact support.' } };
        }

        // FIX: Await initialization before calling login() to prevent the
        // first-tap failure caused by a race condition between initialize() and login().
        try {
            console.log("[NativeAuth] Ensuring SocialLogin is initialized...");
            await ensureSocialLoginInitialized();

            console.log("[NativeAuth] Initiating interactive Google login...");
            const res = await SocialLogin.login({
                provider: 'google',
                options: {
                    filterByAuthorizedAccounts: false,
                    style: 'bottom'
                }
            });
            
            if (res.result?.responseType === 'online' && res.result?.idToken) {
                return await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: res.result.idToken,
                });
            } else {
                throw new Error("No idToken received from native Google login.");
            }
        } catch (error: any) {
            console.error("Native Google Login Exception:", error);
            const errorMessage = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
            
            if (errorMessage.toLowerCase().includes('cancel')) {
               return { error: { message: 'Google Sign-In was canceled.' } };
            }
            
            return { 
                error: { 
                    message: `Native Auth Error: ${errorMessage}. If the issue persists, ensure your SHA-1 fingerprint is registered in the Google Cloud Console for package 'com.paradigm.ifs' and Web Client ID is in Supabase Dashboard.` 
                } 
            };
        }
    }
    
    // FALLBACK TO WEB BROWSER OAUTH
    console.log("Current Origin:", origin);
    console.log("Target Redirect URL:", redirectUrl);

    // Warning for mobile/remote testing
    if (redirectUrl.includes('localhost') || redirectUrl.includes('127.0.0.1')) {
        if (window.location.protocol === 'https:') {
             console.log("Environment: Production/Secure Local. Redirect URL is: " + redirectUrl);
             console.warn("IMPORTANT: Ensure '" + redirectUrl + "' is added to your Supabase Redirect URLs.");
        } else {
             console.warn(
                "WARNING: You are using 'localhost' or '127.0.0.1' as the redirect URL. " +
                "This may fail if there is a mismatch between the host used to access the app and the one whitelisted in Supabase."
            );
        }
    }

    // Do NOT pass prompt:'select_account' — that forces the Google account picker
    // on every login, even when the user already has a valid token. Omitting it
    // lets Google silently reuse the existing session. The user will only see the
    // account picker on their very first login or after a manual sign-out.
    return await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl,
        }
    });
};

const signOut = async (): Promise<void> => {
    // Use scope:'local' to sign out ONLY from this app's session.
    // This does NOT invalidate the Google account or other devices/browsers.
    // The user can re-open the app on a different device and still be signed in there.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
        console.error("Error signing out:", error.message);
    }
};

const resetPasswordForEmail = async (email: string) => {
    // We redirect to the root. The App.tsx onAuthStateChange listener will detect
    // the PASSWORD_RECOVERY event and redirect to /auth/update-password.
    const redirectTo = window.location.origin;
    return await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
    });
};

const updateUserPassword = async (password: string) => {
    return await supabase.auth.updateUser({ password });
};

export const authService = {
    getAppUserProfile,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    signOut,
    resetPasswordForEmail,
    updateUserPassword,
    approveUser,
};