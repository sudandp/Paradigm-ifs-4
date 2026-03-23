


import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';
import type { User as AppUser } from "../types";
import type { Session, User as SupabaseUser, SignUpWithPasswordCredentials } from '@supabase/supabase-js';

export const getAppUserProfile = async (supabaseUser: SupabaseUser): Promise<AppUser | null> => {
    try {
        let { data, error } = await supabase
            .from('users')
            .select('*, role:roles(display_name)')
            .eq('id', supabaseUser.id)
            .single();

        // If profile not found, create one on the fly. This handles the first login after signup.
        if (error && error.code === 'PGRST116') { // PGRST116: Row not found
            const newUserProfile = {
                id: supabaseUser.id,
                name: supabaseUser.user_metadata.name || 'New User',
                email: supabaseUser.email!,
                role_id: 'unverified'
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

        return {
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
            photoUrl: data.photo_url,
            gender: data.gender,
            biometricId: data.biometric_id,
            salaryHold: data.salary_hold,
            salaryHoldReason: data.salary_hold_reason,
            salaryHoldDate: data.salary_hold_date,
        };
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

// This would be a Supabase Edge Function in a real project
const approveUser = async (userId: string, newRole: string) => {
    return await supabase.from('users').update({ role_id: newRole }).eq('id', userId);
};

const signInWithGoogle = async () => {
    // Determine the redirect URL.  In a production environment (such as a deployed
    // web app or a Capacitor app using a custom scheme), this should match the
    // configured authorized redirect URI in the Supabase/Google console.
    // For local development, we use window.location.origin.
    const origin = window.location.origin;
    let redirectUrl = origin.endsWith('/') ? origin : `${origin}/`;
    
    // IMPORTANT: On native mobile (Android/iOS via Capacitor), we must use our registered 
    // custom URL scheme so the OS knows to redirect from Chrome back to the app.
    // This value 'com.paradigm.ifs://google-callback' MUST be configured in your Supabase Auth Redirect URLs.
    if (Capacitor.isNativePlatform()) {
        redirectUrl = 'com.paradigm.ifs://google-callback';
    }
    
    console.log("Initiating Google Sign-In...");
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

    return await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl,
            queryParams: {
                prompt: 'select_account',
            },
        }
    });
};

const signOut = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
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