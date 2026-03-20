-- Migration: Ultimate RLS Performance Optimization (Zero Warnings)
-- Date: 2026-01-08
-- Description: Consolidates all RLS policies to single-per-action to resolve "Multiple Permissive Policies" warnings.
--              Also ensures "InitPlan" optimization by wrapping auth.uid() in scalar subqueries.

-- 1. Helper Function (Optimized)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (select auth.uid()) 
    AND role_id IN ('admin', 'hr', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 2. USERS
-- Logic: Admin (ALL), User (Select/Update Own)
-- ==============================================================================
DROP POLICY IF EXISTS "Admin HR Ops read users" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users read own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user to create their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user to update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete all users" ON public.users;
DROP POLICY IF EXISTS "Admins manage users" ON public.users;
DROP POLICY IF EXISTS "Users view own profile" ON public.users;
DROP POLICY IF EXISTS "Users update own profile" ON public.users;

CREATE POLICY "users_select_policy" ON public.users FOR SELECT USING (
    public.check_is_admin() OR id = (select auth.uid())
);
CREATE POLICY "users_update_policy" ON public.users FOR UPDATE USING (
    public.check_is_admin() OR id = (select auth.uid())
);
CREATE POLICY "users_insert_policy" ON public.users FOR INSERT WITH CHECK (
    public.check_is_admin()
);
CREATE POLICY "users_delete_policy" ON public.users FOR DELETE USING (
    public.check_is_admin()
);


-- ==============================================================================
-- 3. APP_MODULES
-- Logic: Admin (ALL), Authenticated (Select)
-- ==============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to read app modules" ON public.app_modules;
DROP POLICY IF EXISTS "Manage all app modules for Admin/HR" ON public.app_modules;
DROP POLICY IF EXISTS "Public read app modules" ON public.app_modules;
DROP POLICY IF EXISTS "Admins manage app_modules" ON public.app_modules;
DROP POLICY IF EXISTS "Admins insert app_modules" ON public.app_modules;
DROP POLICY IF EXISTS "Admins update app_modules" ON public.app_modules;
DROP POLICY IF EXISTS "Admins delete app_modules" ON public.app_modules;
DROP POLICY IF EXISTS "Authenticated read app_modules" ON public.app_modules;

CREATE POLICY "app_modules_select_policy" ON public.app_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_modules_insert_policy" ON public.app_modules FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "app_modules_update_policy" ON public.app_modules FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "app_modules_delete_policy" ON public.app_modules FOR DELETE USING (public.check_is_admin());


-- ==============================================================================
-- 4. ONBOARDING_SUBMISSIONS
-- Logic: Admin (ALL), User (Own - ALL) -> Consolidated
-- ==============================================================================
DROP POLICY IF EXISTS "Admins and HR can manage all submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Admins and HR can view all submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Allow admin/hr/managers to read all submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Authorized roles can view all submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Users can manage their own submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Authorized roles can update all submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Users can create their own submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Allow users to manage their own submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Admins manage onboarding_submissions" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "Users manage own onboarding_submissions" ON public.onboarding_submissions;

CREATE POLICY "onboarding_submissions_policy" ON public.onboarding_submissions FOR ALL USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);


-- ==============================================================================
-- 5. LEAVE_REQUESTS
-- Logic: Admin (ALL), User (Own - ALL) -> Consolidated
-- ==============================================================================
DROP POLICY IF EXISTS "Admins and HR can manage all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins and HR can view all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow admin/hr to manage all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow approvers to read assigned leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can manage their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins manage leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users manage own leave_requests" ON public.leave_requests;

CREATE POLICY "leave_requests_policy" ON public.leave_requests FOR ALL USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);


-- ==============================================================================
-- 6. ATTENDANCE_EVENTS
-- Logic: Admin (ALL), User (Own - ALL) -> Consolidated
-- ==============================================================================
DROP POLICY IF EXISTS "Allow authorized roles to insert manual attendance" ON public.attendance_events;
DROP POLICY IF EXISTS "Users can manage their own attendance" ON public.attendance_events;
DROP POLICY IF EXISTS "Admins and HR can view all attendance" ON public.attendance_events;
DROP POLICY IF EXISTS "Allow admin/hr/managers to read all attendance" ON public.attendance_events;
DROP POLICY IF EXISTS "Allow users to manage their own attendance" ON public.attendance_events;
DROP POLICY IF EXISTS "Admins manage attendance_events" ON public.attendance_events;
DROP POLICY IF EXISTS "Users manage own attendance_events" ON public.attendance_events;

CREATE POLICY "attendance_events_policy" ON public.attendance_events FOR ALL USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);


-- ==============================================================================
-- 7. ATTENDANCE_APPROVALS
-- Logic: Admin (ALL), User (Own - Select only)
-- ==============================================================================
DROP POLICY IF EXISTS "Managers can view and update approvals" ON public.attendance_approvals;
DROP POLICY IF EXISTS "Users can view their own approvals" ON public.attendance_approvals;
DROP POLICY IF EXISTS "Admins manage attendance_approvals" ON public.attendance_approvals;
DROP POLICY IF EXISTS "Users view own attendance_approvals" ON public.attendance_approvals;

CREATE POLICY "attendance_approvals_select_policy" ON public.attendance_approvals FOR SELECT USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);
CREATE POLICY "attendance_approvals_insert_policy" ON public.attendance_approvals FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "attendance_approvals_update_policy" ON public.attendance_approvals FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "attendance_approvals_delete_policy" ON public.attendance_approvals FOR DELETE USING (public.check_is_admin());


-- ==============================================================================
-- 8. LOCATIONS
-- Logic: Admin (ALL), Authenticated (Select)
-- ==============================================================================
DROP POLICY IF EXISTS "Authenticated insert locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated update locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated delete locations" ON public.locations;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON public.locations;
DROP POLICY IF EXISTS "Admins manage locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated read locations" ON public.locations;

CREATE POLICY "locations_select_policy" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "locations_insert_policy" ON public.locations FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "locations_update_policy" ON public.locations FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "locations_delete_policy" ON public.locations FOR DELETE USING (public.check_is_admin());


-- ==============================================================================
-- 9. USER_LOCATIONS
-- Logic: Admin (ALL), User (Own - ALL) -> Consolidated
-- ==============================================================================
DROP POLICY IF EXISTS "Users read own user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users insert own user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users delete own user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "Admin insert user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "Admin read user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "Authenticated delete user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "Admins manage user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users manage own user_locations" ON public.user_locations;

CREATE POLICY "user_locations_policy" ON public.user_locations FOR ALL USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);


-- ==============================================================================
-- 10. NOTIFICATIONS
-- Logic: Admin (ALL), User (Own - ALL) -> Consolidated
-- ==============================================================================
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;

CREATE POLICY "notifications_policy" ON public.notifications FOR ALL USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);


-- ==============================================================================
-- 11. TASKS
-- Logic: Admin (ALL), User (Assigned - Select only)
-- ==============================================================================
DROP POLICY IF EXISTS "Users can see tasks assigned to them" ON public.tasks;
DROP POLICY IF EXISTS "Enable read for assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users read assigned tasks" ON public.tasks;

CREATE POLICY "tasks_select_policy" ON public.tasks FOR SELECT USING (
    public.check_is_admin() OR assigned_to_id = (select auth.uid())
);
CREATE POLICY "tasks_insert_policy" ON public.tasks FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "tasks_update_policy" ON public.tasks FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "tasks_delete_policy" ON public.tasks FOR DELETE USING (public.check_is_admin());


-- ==============================================================================
-- 12. MISC TABLES (Consolidated Patterns)
-- ==============================================================================

-- Settings
DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON public.settings;
DROP POLICY IF EXISTS "Authenticated read settings" ON public.settings;
DROP POLICY IF EXISTS "settings_select_policy" ON public.settings;
DROP POLICY IF EXISTS "settings_mod_policy" ON public.settings;
CREATE POLICY "settings_select_policy_v2" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_insert_policy_v2" ON public.settings FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "settings_update_policy_v2" ON public.settings FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "settings_delete_policy_v2" ON public.settings FOR DELETE USING (public.check_is_admin());


-- Roles
DROP POLICY IF EXISTS "Allow authenticated users to read roles" ON public.roles;
DROP POLICY IF EXISTS "Authenticated read roles" ON public.roles;
CREATE POLICY "roles_select_policy" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_insert_policy" ON public.roles FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "roles_update_policy" ON public.roles FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "roles_delete_policy" ON public.roles FOR DELETE USING (public.check_is_admin());


-- Field Reports (Admin ALL, User Own ALL)
DROP POLICY IF EXISTS "Users can insert their own reports" ON public.field_reports;
DROP POLICY IF EXISTS "Users can see their own reports" ON public.field_reports;
DROP POLICY IF EXISTS "Admins manage field_reports" ON public.field_reports;
DROP POLICY IF EXISTS "Users manage own field_reports" ON public.field_reports;
CREATE POLICY "field_reports_policy" ON public.field_reports FOR ALL USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);


-- Extra Work Logs (Admin ALL, User Own ALL)
DROP POLICY IF EXISTS "Enable all access for admin/hr" ON public.extra_work_logs;
DROP POLICY IF EXISTS "Users can manage their own extra work logs" ON public.extra_work_logs;
DROP POLICY IF EXISTS "Enable HR/Admins to manage all claims" ON public.extra_work_logs;
DROP POLICY IF EXISTS "Enable read access for own logs" ON public.extra_work_logs;
DROP POLICY IF EXISTS "Admins manage extra_work_logs" ON public.extra_work_logs;
DROP POLICY IF EXISTS "Users manage own extra_work_logs" ON public.extra_work_logs;
CREATE POLICY "extra_work_logs_policy" ON public.extra_work_logs FOR ALL USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);

-- Comp Off Logs (Admin ALL, User Own ALL)
DROP POLICY IF EXISTS "Enable all access for HR and admins" ON public.comp_off_logs;
DROP POLICY IF EXISTS "Enable read access for own logs" ON public.comp_off_logs;
DROP POLICY IF EXISTS "Enable read access for HR and admins" ON public.comp_off_logs;
DROP POLICY IF EXISTS "Admins manage comp_off_logs" ON public.comp_off_logs;
DROP POLICY IF EXISTS "Users manage own comp_off_logs" ON public.comp_off_logs;
CREATE POLICY "comp_off_logs_policy" ON public.comp_off_logs FOR ALL USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);

-- Biometric Devices (Admin ALL, Auth Select)
DROP POLICY IF EXISTS "Admins can manage biometric devices" ON public.biometric_devices;
DROP POLICY IF EXISTS "Authenticated users can view devices" ON public.biometric_devices;
DROP POLICY IF EXISTS "Admins manage biometric_devices" ON public.biometric_devices;
DROP POLICY IF EXISTS "Authenticated read biometric_devices" ON public.biometric_devices;
CREATE POLICY "biometric_devices_select_policy" ON public.biometric_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "biometric_devices_insert_policy" ON public.biometric_devices FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "biometric_devices_update_policy" ON public.biometric_devices FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "biometric_devices_delete_policy" ON public.biometric_devices FOR DELETE USING (public.check_is_admin());

-- Holidays (Admin ALL, Auth Select)
DROP POLICY IF EXISTS "Enable all access for admin/hr" ON public.holidays;
DROP POLICY IF EXISTS "Enable write for admin/hr on holidays" ON public.holidays;
DROP POLICY IF EXISTS "Enable read access for all on holidays" ON public.holidays;
DROP POLICY IF EXISTS "Enable read for authenticated on holidays" ON public.holidays;
DROP POLICY IF EXISTS "Admins manage holidays" ON public.holidays;
DROP POLICY IF EXISTS "Authenticated read holidays" ON public.holidays;
CREATE POLICY "holidays_select_policy" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_insert_policy" ON public.holidays FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "holidays_update_policy" ON public.holidays FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "holidays_delete_policy" ON public.holidays FOR DELETE USING (public.check_is_admin());

-- Checklist Templates (Admin ALL, Auth Select)
DROP POLICY IF EXISTS "Allow admins to manage templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Allow authenticated users to read active templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Admins manage checklist_templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Authenticated read checklist_templates" ON public.checklist_templates;
CREATE POLICY "checklist_templates_select_policy" ON public.checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_templates_insert_policy" ON public.checklist_templates FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "checklist_templates_update_policy" ON public.checklist_templates FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "checklist_templates_delete_policy" ON public.checklist_templates FOR DELETE USING (public.check_is_admin());

-- Ticket Posts (Admin ALL, Author ALL)
DROP POLICY IF EXISTS "Allow users to create and manage their own posts" ON public.ticket_posts;
DROP POLICY IF EXISTS "Users manage own ticket_posts" ON public.ticket_posts;
DROP POLICY IF EXISTS "Admins manage ticket_posts" ON public.ticket_posts;
CREATE POLICY "ticket_posts_policy" ON public.ticket_posts FOR ALL USING (
    public.check_is_admin() OR author_id = (select auth.uid())
);

-- Ticket Comments (Admin ALL, Author ALL)
DROP POLICY IF EXISTS "Allow users to create and manage their own comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Users manage own ticket_comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Admins manage ticket_comments" ON public.ticket_comments;
CREATE POLICY "ticket_comments_policy" ON public.ticket_comments FOR ALL USING (
    public.check_is_admin() OR author_id = (select auth.uid())
);

-- Uniform Requests (Admin ALL, Requester ALL)
DROP POLICY IF EXISTS "Enable all access for admin/hr/managers" ON public.uniform_requests;
DROP POLICY IF EXISTS "Allow users to manage their own requests" ON public.uniform_requests;
DROP POLICY IF EXISTS "Admins manage uniform_requests" ON public.uniform_requests;
DROP POLICY IF EXISTS "Users manage own uniform_requests" ON public.uniform_requests;
CREATE POLICY "uniform_requests_policy" ON public.uniform_requests FOR ALL USING (
    public.check_is_admin() OR requested_by_id = (select auth.uid())
);

-- Location Cache (Auth ALL)
DROP POLICY IF EXISTS "Authenticated users can read location cache" ON public.location_cache;
DROP POLICY IF EXISTS "Authenticated users can insert location cache" ON public.location_cache;
DROP POLICY IF EXISTS "Authenticated manage location_cache" ON public.location_cache;
CREATE POLICY "location_cache_policy" ON public.location_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Support Tickets (Admin ALL, Creator ALL, Assigned Select)
DROP POLICY IF EXISTS "Allow users to manage their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can manage their own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Allow assigned users to view and update tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users manage own support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins manage support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Assigned users view support_tickets" ON public.support_tickets;

CREATE POLICY "support_tickets_select_policy" ON public.support_tickets FOR SELECT USING (
    public.check_is_admin() OR raised_by_id = (select auth.uid()) OR assigned_to_id = (select auth.uid())
);
-- For modification, we assume only admins and creators can do it (assigned users typically only comment)
CREATE POLICY "support_tickets_insert_policy" ON public.support_tickets FOR INSERT WITH CHECK (
    public.check_is_admin() OR raised_by_id = (select auth.uid())
);
CREATE POLICY "support_tickets_update_policy" ON public.support_tickets FOR UPDATE USING (
    public.check_is_admin() OR raised_by_id = (select auth.uid())
);
CREATE POLICY "support_tickets_delete_policy" ON public.support_tickets FOR DELETE USING (
    public.check_is_admin() OR raised_by_id = (select auth.uid())
);


-- ==============================================================================
-- 13. AUDIT LOGS (Fixing auth_rls_initplan)
-- ==============================================================================
DROP POLICY IF EXISTS "Admins and HR can view audit logs" ON public.attendance_audit_logs;
DROP POLICY IF EXISTS "Admins and HR can insert audit logs" ON public.attendance_audit_logs;

CREATE POLICY "audit_logs_select_policy" ON public.attendance_audit_logs FOR SELECT USING (
    public.check_is_admin()
);
CREATE POLICY "audit_logs_insert_policy" ON public.attendance_audit_logs FOR INSERT WITH CHECK (
    public.check_is_admin()
);
