-- Migration: Fix Multiple Permissive Policies (Revised with Robust Drops)
-- Date: 2026-01-08
-- Description: Aggressively drops duplicate/overlapping policies and consolidates them into strictly one policy per action per table.
--              Includes explicit drops for all target policy names to prevent 'already exists' errors.

-- ==============================================================================
-- 1. ATTENDANCE_VIOLATIONS
-- ==============================================================================
DROP POLICY IF EXISTS "attendance_violations_select" ON public.attendance_violations;
DROP POLICY IF EXISTS "attendance_violations_mod" ON public.attendance_violations;
DROP POLICY IF EXISTS "attendance_violations_admin" ON public.attendance_violations;
-- Explicitly drop the new names we are about to create, just in case
DROP POLICY IF EXISTS "attendance_violations_insert" ON public.attendance_violations;
DROP POLICY IF EXISTS "attendance_violations_update" ON public.attendance_violations;
DROP POLICY IF EXISTS "attendance_violations_delete" ON public.attendance_violations;

CREATE POLICY "attendance_violations_select" ON public.attendance_violations FOR SELECT USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);
CREATE POLICY "attendance_violations_insert" ON public.attendance_violations FOR INSERT WITH CHECK (
    public.check_is_admin()
);
CREATE POLICY "attendance_violations_update" ON public.attendance_violations FOR UPDATE USING (
    public.check_is_admin()
);
CREATE POLICY "attendance_violations_delete" ON public.attendance_violations FOR DELETE USING (
    public.check_is_admin()
);

-- ==============================================================================
-- 2. LOCATIONS
-- ==============================================================================
DROP POLICY IF EXISTS "Public read locations" ON public.locations;

-- ==============================================================================
-- 3. ONBOARDING_SUBMISSIONS
-- ==============================================================================
DROP POLICY IF EXISTS "Admins and HR can update any submission" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Admins and HR can manage all submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "onboarding_submissions_policy" ON public.onboarding_submissions;

CREATE POLICY "onboarding_submissions_policy" ON public.onboarding_submissions FOR ALL USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);

-- ==============================================================================
-- 4. ORGANIZATIONS
-- ==============================================================================
DROP POLICY IF EXISTS "Allow admins and HR to manage organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow authenticated users to read organizations" ON public.organizations;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.organizations;
DROP POLICY IF EXISTS "organizations_read" ON public.organizations;
DROP POLICY IF EXISTS "organizations_write" ON public.organizations;
-- Drop target names
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;

CREATE POLICY "organizations_select" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "organizations_insert" ON public.organizations FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "organizations_update" ON public.organizations FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "organizations_delete" ON public.organizations FOR DELETE USING (public.check_is_admin());

-- ==============================================================================
-- 5. RECURRING_HOLIDAYS
-- ==============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to view recurring holidays" ON public.recurring_holidays;
DROP POLICY IF EXISTS "recurring_holidays_read" ON public.recurring_holidays;
DROP POLICY IF EXISTS "recurring_holidays_write" ON public.recurring_holidays;
-- Drop target names
DROP POLICY IF EXISTS "recurring_holidays_select" ON public.recurring_holidays;
DROP POLICY IF EXISTS "recurring_holidays_insert" ON public.recurring_holidays;
DROP POLICY IF EXISTS "recurring_holidays_update" ON public.recurring_holidays;
DROP POLICY IF EXISTS "recurring_holidays_delete" ON public.recurring_holidays;

CREATE POLICY "recurring_holidays_select" ON public.recurring_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "recurring_holidays_insert" ON public.recurring_holidays FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "recurring_holidays_update" ON public.recurring_holidays FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "recurring_holidays_delete" ON public.recurring_holidays FOR DELETE USING (public.check_is_admin());

-- ==============================================================================
-- 6. ROLES
-- ==============================================================================
DROP POLICY IF EXISTS "Allow admins to manage roles" ON public.roles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.roles;

-- ==============================================================================
-- 7. SETTINGS
-- ==============================================================================
DROP POLICY IF EXISTS "Allow admins and HR to update settings" ON public.settings;
DROP POLICY IF EXISTS "Enable write access for admin and hr" ON public.settings;
DROP POLICY IF EXISTS "Enable write for admin/hr" ON public.settings;
DROP POLICY IF EXISTS "Allow authenticated users to view settings" ON public.settings;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.settings;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.settings;
DROP POLICY IF EXISTS "settings_select_policy_v2" ON public.settings;
DROP POLICY IF EXISTS "settings_insert_policy_v2" ON public.settings;
DROP POLICY IF EXISTS "settings_update_policy_v2" ON public.settings;
DROP POLICY IF EXISTS "settings_delete_policy_v2" ON public.settings;
DROP POLICY IF EXISTS "settings_write_fixed" ON public.settings;
-- Drop target names
DROP POLICY IF EXISTS "settings_select" ON public.settings;
DROP POLICY IF EXISTS "settings_insert" ON public.settings;
DROP POLICY IF EXISTS "settings_update" ON public.settings;
DROP POLICY IF EXISTS "settings_delete" ON public.settings;

CREATE POLICY "settings_select" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_insert" ON public.settings FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "settings_update" ON public.settings FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "settings_delete" ON public.settings FOR DELETE USING (public.check_is_admin());

-- ==============================================================================
-- 8. TASKS
-- ==============================================================================
DROP POLICY IF EXISTS "Admins and managers can manage all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Enable all access for admin/hr/managers" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
-- Drop target names
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (
    public.check_is_admin() OR assigned_to_id = (select auth.uid()) OR created_by_id = (select auth.uid())
);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (public.check_is_admin());

-- ==============================================================================
-- 9. TICKET_COMMENTS
-- ==============================================================================
DROP POLICY IF EXISTS "Allow full access to admin and HR" ON public.ticket_comments;
DROP POLICY IF EXISTS "Allow users to view comments on accessible posts" ON public.ticket_comments;
DROP POLICY IF EXISTS "ticket_comments_policy" ON public.ticket_comments;

CREATE POLICY "ticket_comments_policy" ON public.ticket_comments FOR ALL USING (
    public.check_is_admin() OR author_id = (select auth.uid())
);

-- ==============================================================================
-- 10. TICKET_POSTS (Fixed)
-- ==============================================================================
DROP POLICY IF EXISTS "Allow full access to admin and HR" ON public.ticket_posts;
DROP POLICY IF EXISTS "Allow users to view posts on accessible tickets" ON public.ticket_posts;
DROP POLICY IF EXISTS "ticket_posts_policy" ON public.ticket_posts;
-- Drop target names
DROP POLICY IF EXISTS "ticket_posts_select" ON public.ticket_posts;
DROP POLICY IF EXISTS "ticket_posts_insert" ON public.ticket_posts;
DROP POLICY IF EXISTS "ticket_posts_update" ON public.ticket_posts;
DROP POLICY IF EXISTS "ticket_posts_delete" ON public.ticket_posts;

CREATE POLICY "ticket_posts_select" ON public.ticket_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "ticket_posts_insert" ON public.ticket_posts FOR INSERT WITH CHECK (
    public.check_is_admin() OR author_id = (select auth.uid())
);
CREATE POLICY "ticket_posts_update" ON public.ticket_posts FOR UPDATE USING (
    public.check_is_admin() OR author_id = (select auth.uid())
);
CREATE POLICY "ticket_posts_delete" ON public.ticket_posts FOR DELETE USING (
     public.check_is_admin() OR author_id = (select auth.uid())
);


-- ==============================================================================
-- 11. USERS (Major Cleanup)
-- ==============================================================================
DROP POLICY IF EXISTS "Admins and HR can manage all user profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Allow admin/hr to update any profile" ON public.users;
DROP POLICY IF EXISTS "Admins and HR can view all users" ON public.users;
DROP POLICY IF EXISTS "Allow admin/hr to read all profiles" ON public.users;
DROP POLICY IF EXISTS "Admins and HR can update any user" ON public.users;

-- Keep standard policies, ensure they are clean
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_insert_policy" ON public.users FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "users_update_policy" ON public.users FOR UPDATE USING (
    public.check_is_admin() OR id = (select auth.uid())
);
CREATE POLICY "users_delete_policy" ON public.users FOR DELETE USING (public.check_is_admin());

-- ==============================================================================
-- 12. VIOLATION_RESETS
-- ==============================================================================
DROP POLICY IF EXISTS "violation_resets_mod" ON public.violation_resets;
DROP POLICY IF EXISTS "violation_resets_select" ON public.violation_resets;
-- Drop target names
DROP POLICY IF EXISTS "violation_resets_insert" ON public.violation_resets;
DROP POLICY IF EXISTS "violation_resets_update" ON public.violation_resets;
DROP POLICY IF EXISTS "violation_resets_delete" ON public.violation_resets;

CREATE POLICY "violation_resets_select" ON public.violation_resets FOR SELECT TO authenticated USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);
CREATE POLICY "violation_resets_insert" ON public.violation_resets FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "violation_resets_update" ON public.violation_resets FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "violation_resets_delete" ON public.violation_resets FOR DELETE USING (public.check_is_admin());


-- ==============================================================================
-- 13. SITE CONFIGURATIONS (Fix Overlap)
-- ==============================================================================
-- Site Configs
DROP POLICY IF EXISTS "site_configs_write" ON public.site_configurations;
DROP POLICY IF EXISTS "site_configs_insert" ON public.site_configurations;
DROP POLICY IF EXISTS "site_configs_update" ON public.site_configurations;
DROP POLICY IF EXISTS "site_configs_delete" ON public.site_configurations;

CREATE POLICY "site_configs_insert" ON public.site_configurations FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "site_configs_update" ON public.site_configurations FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "site_configs_delete" ON public.site_configurations FOR DELETE USING (public.check_is_admin());

-- Gents
DROP POLICY IF EXISTS "site_gents_write" ON public.site_gents_uniform_configs;
DROP POLICY IF EXISTS "site_gents_insert" ON public.site_gents_uniform_configs;
DROP POLICY IF EXISTS "site_gents_update" ON public.site_gents_uniform_configs;
DROP POLICY IF EXISTS "site_gents_delete" ON public.site_gents_uniform_configs;

CREATE POLICY "site_gents_insert" ON public.site_gents_uniform_configs FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "site_gents_update" ON public.site_gents_uniform_configs FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "site_gents_delete" ON public.site_gents_uniform_configs FOR DELETE USING (public.check_is_admin());

-- Ladies
DROP POLICY IF EXISTS "site_ladies_write" ON public.site_ladies_uniform_configs;
DROP POLICY IF EXISTS "site_ladies_insert" ON public.site_ladies_uniform_configs;
DROP POLICY IF EXISTS "site_ladies_update" ON public.site_ladies_uniform_configs;
DROP POLICY IF EXISTS "site_ladies_delete" ON public.site_ladies_uniform_configs;

CREATE POLICY "site_ladies_insert" ON public.site_ladies_uniform_configs FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "site_ladies_update" ON public.site_ladies_uniform_configs FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "site_ladies_delete" ON public.site_ladies_uniform_configs FOR DELETE USING (public.check_is_admin());

-- Details
DROP POLICY IF EXISTS "site_details_write" ON public.site_uniform_details_configs;
DROP POLICY IF EXISTS "site_details_insert" ON public.site_uniform_details_configs;
DROP POLICY IF EXISTS "site_details_update" ON public.site_uniform_details_configs;
DROP POLICY IF EXISTS "site_details_delete" ON public.site_uniform_details_configs;

CREATE POLICY "site_details_insert" ON public.site_uniform_details_configs FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "site_details_update" ON public.site_uniform_details_configs FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "site_details_delete" ON public.site_uniform_details_configs FOR DELETE USING (public.check_is_admin());
