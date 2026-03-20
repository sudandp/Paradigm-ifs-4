-- Migration: Optimize Database Indexes
-- Description: Addresses Supabase Linter warnings for unindexed foreign keys and unused indexes.
-- Date: 2026-01-08

-- ==============================================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- Each foreign key constraint should have a corresponding index for performance.
-- ==============================================================================

-- public.attendance_approvals
CREATE INDEX IF NOT EXISTS idx_attendance_approvals_manager_id ON public.attendance_approvals(manager_id);
CREATE INDEX IF NOT EXISTS idx_attendance_approvals_user_id ON public.attendance_approvals(user_id);

-- public.attendance_audit_logs
CREATE INDEX IF NOT EXISTS idx_attendance_audit_logs_performed_by ON public.attendance_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_logs_target_user_id ON public.attendance_audit_logs(target_user_id);

-- public.attendance_events
CREATE INDEX IF NOT EXISTS idx_attendance_events_created_by ON public.attendance_events(created_by);
CREATE INDEX IF NOT EXISTS idx_attendance_events_device_id ON public.attendance_events(device_id);
CREATE INDEX IF NOT EXISTS idx_attendance_events_field_report_id ON public.attendance_events(field_report_id);
CREATE INDEX IF NOT EXISTS idx_attendance_events_location_id ON public.attendance_events(location_id);
CREATE INDEX IF NOT EXISTS idx_attendance_events_user_id ON public.attendance_events(user_id);

-- public.attendance_violations
CREATE INDEX IF NOT EXISTS idx_attendance_violations_assigned_geofence_id ON public.attendance_violations(assigned_geofence_id);

-- public.biometric_devices
CREATE INDEX IF NOT EXISTS idx_biometric_devices_organization_id ON public.biometric_devices(organization_id);

-- public.comp_off_logs
CREATE INDEX IF NOT EXISTS idx_comp_off_logs_granted_by_id ON public.comp_off_logs(granted_by_id);
CREATE INDEX IF NOT EXISTS idx_comp_off_logs_leave_request_id ON public.comp_off_logs(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_comp_off_logs_user_id ON public.comp_off_logs(user_id);

-- public.companies
CREATE INDEX IF NOT EXISTS idx_companies_group_id ON public.companies(group_id);

-- public.entities
CREATE INDEX IF NOT EXISTS idx_entities_company_id ON public.entities(company_id);

-- public.extra_work_logs
CREATE INDEX IF NOT EXISTS idx_extra_work_logs_approver_id ON public.extra_work_logs(approver_id);
CREATE INDEX IF NOT EXISTS idx_extra_work_logs_user_id ON public.extra_work_logs(user_id);

-- public.field_reports
CREATE INDEX IF NOT EXISTS idx_field_reports_attendance_event_id ON public.field_reports(attendance_event_id);
CREATE INDEX IF NOT EXISTS idx_field_reports_template_id ON public.field_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_field_reports_user_id ON public.field_reports(user_id);

-- public.leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);

-- public.locations
CREATE INDEX IF NOT EXISTS idx_locations_created_by ON public.locations(created_by);

-- public.notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- public.onboarding_submissions
CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_user_id ON public.onboarding_submissions(user_id);

-- public.support_tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to_id ON public.support_tickets(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_raised_by_id ON public.support_tickets(raised_by_id);

-- public.tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_id ON public.tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by_id ON public.tasks(created_by_id);

-- public.ticket_comments
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id ON public.ticket_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_post_id ON public.ticket_comments(post_id);

-- public.ticket_posts
CREATE INDEX IF NOT EXISTS idx_ticket_posts_author_id ON public.ticket_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_ticket_posts_ticket_id ON public.ticket_posts(ticket_id);

-- public.user_locations
CREATE INDEX IF NOT EXISTS idx_user_locations_location_id ON public.user_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON public.user_locations(user_id);

-- public.users
CREATE INDEX IF NOT EXISTS idx_users_reporting_manager_id ON public.users(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON public.users(role_id);

-- public.violation_resets
CREATE INDEX IF NOT EXISTS idx_violation_resets_reset_by ON public.violation_resets(reset_by);


-- ==============================================================================
-- 2. DROP UNUSED INDEXES
-- Removing indexes that are never used to save storage and write performance.
-- ==============================================================================

DROP INDEX IF EXISTS public.idx_organizations_manager;
DROP INDEX IF EXISTS public.idx_organizations_reporting_manager;
DROP INDEX IF EXISTS public.idx_organizations_provisional_date;
DROP INDEX IF EXISTS public.idx_violations_user_month;
DROP INDEX IF EXISTS public.idx_violations_date;
DROP INDEX IF EXISTS public.idx_violation_resets_month;
DROP INDEX IF EXISTS public.idx_violation_resets_date;
DROP INDEX IF EXISTS public.idx_organizations_backend_officer;
