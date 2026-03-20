-- Migration: Optimize RLS Policies and Fix Performance Warnings
-- Date: 2026-01-08
-- Objective: Fix performance warnings (auth_rls_initplan) and consolidate redundant policies (app_modules).

-- ==========================================
-- 1. App Modules: Consolidate Redundant Policies
-- ==========================================

-- Drop known redundant policies
DROP POLICY IF EXISTS "Admin HR delete app modules" ON public.app_modules;
DROP POLICY IF EXISTS "Allow admins to manage app modules" ON public.app_modules;
DROP POLICY IF EXISTS "Enable all access for admin/hr" ON public.app_modules;
DROP POLICY IF EXISTS "Admin HR insert app modules" ON public.app_modules;
DROP POLICY IF EXISTS "Admin HR update app modules" ON public.app_modules;

-- Create consolidated Manage policy using the optimized check_is_admin() function
-- This single policy handles ALL operations for admins/hr
CREATE POLICY "Manage all app modules for Admin/HR" 
ON public.app_modules
FOR ALL
USING (public.check_is_admin());

-- Optimize the Public/Authenticated Read policy
DROP POLICY IF EXISTS "Public read app modules" ON public.app_modules;
DROP POLICY IF EXISTS "Allow authenticated users to read app modules" ON public.app_modules;

CREATE POLICY "Allow authenticated users to read app modules" 
ON public.app_modules
FOR SELECT
TO authenticated
USING (true);


-- ==========================================
-- 2. Performance Fixes: Optimize auth.uid() calls
-- ==========================================
-- Replacing auth.uid() with (select auth.uid()) prevents per-row function re-evaluation.

-- --- users ---
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users read own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user to update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (id = (select auth.uid()));


-- --- notifications ---
DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable user to read their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;

CREATE POLICY "Users can manage their own notifications" ON public.notifications 
FOR ALL USING (user_id = (select auth.uid()));


-- --- attendance_events ---
DROP POLICY IF EXISTS "Users can manage their own attendance" ON public.attendance_events;
DROP POLICY IF EXISTS "Allow users to manage their own attendance" ON public.attendance_events;

CREATE POLICY "Users can manage their own attendance" ON public.attendance_events 
FOR ALL USING (user_id = (select auth.uid()));


-- --- attendance_approvals ---
DROP POLICY IF EXISTS "Users can view their own approvals" ON public.attendance_approvals;
CREATE POLICY "Users can view their own approvals" ON public.attendance_approvals 
FOR SELECT USING (user_id = (select auth.uid()));


-- --- leave_requests ---
DROP POLICY IF EXISTS "Users can manage their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow users to manage their own leave requests" ON public.leave_requests;

CREATE POLICY "Users can manage their own leave requests" ON public.leave_requests 
FOR ALL USING (user_id = (select auth.uid()));


-- --- support_tickets ---
DROP POLICY IF EXISTS "Users can manage their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can manage their own support tickets" ON public.support_tickets;

-- Note: Using raised_by_id as per schema
CREATE POLICY "Users can manage their own support tickets" ON public.support_tickets 
FOR ALL USING (raised_by_id = (select auth.uid())); 


-- --- extra_work_logs ---
DROP POLICY IF EXISTS "Enable insert for users to create their own claims" ON public.extra_work_logs;
DROP POLICY IF EXISTS "Enable users to view their own claims" ON public.extra_work_logs;
DROP POLICY IF EXISTS "Enable read/insert for own logs" ON public.extra_work_logs;

CREATE POLICY "Users can manage their own extra work logs" ON public.extra_work_logs 
FOR ALL USING (user_id = (select auth.uid()));


-- --- onboarding_submissions ---
DROP POLICY IF EXISTS "Users can manage their own submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Users can create their own submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Allow users to manage their own submissions" ON public.onboarding_submissions;

CREATE POLICY "Users can manage their own submissions" ON public.onboarding_submissions 
FOR ALL USING (user_id = (select auth.uid()));
