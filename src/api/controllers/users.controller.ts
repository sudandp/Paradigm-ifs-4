import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const getAdminSupabase = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase admin credentials not configured on server');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
};

/**
 * Administrative Delete User Controller
 * Uses Supabase Service Role client to bypass RLS and cleanly eliminate all
 * child and foreign key records before removing public.users and auth.users.
 */
export const deleteUserController = async (req: Request, res: Response) => {
  const targetUserId = req.params.id;
  const callingUser = (req as any).user;

  if (!targetUserId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Prevent self-deletion
  if (callingUser && callingUser.id === targetUserId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    const adminClient = getAdminSupabase();

    // 0. Verify calling user has admin or manager privileges
    if (callingUser) {
      const { data: callerData } = await adminClient
        .from('users')
        .select('role_id')
        .eq('id', callingUser.id)
        .maybeSingle();

      const roleId = callerData?.role_id?.toLowerCase() || '';
      const allowedRoles = ['admin', 'super_admin', 'superadmin', 'developer', 'hr'];
      if (!allowedRoles.includes(roleId)) {
        return res.status(403).json({ error: 'Access denied: Admin or HR privileges required to delete a user' });
      }
    }

    // 1. Fetch user email for email-based table cleanups
    let targetEmail: string | null = null;
    const { data: targetUser } = await adminClient
      .from('users')
      .select('email')
      .eq('id', targetUserId)
      .maybeSingle();
    if (targetUser?.email) {
      targetEmail = targetUser.email;
    }

    // 2. Pre-clean support tickets raised by this user
    try {
      const { data: userTickets } = await adminClient
        .from('support_tickets')
        .select('id')
        .eq('raised_by_id', targetUserId);

      if (userTickets && userTickets.length > 0) {
        const ticketIds = userTickets.map((t: any) => t.id);
        await adminClient.from('ticket_comments').delete().in('ticket_id', ticketIds);
        await adminClient.from('ticket_posts').delete().in('ticket_id', ticketIds);
        await adminClient.from('support_tickets').delete().eq('raised_by_id', targetUserId);
      }
    } catch (ticketErr) {
      console.warn('[deleteUserController] Support tickets cleanup warning:', ticketErr);
    }

    // 3. Multi-table cascade cleanup across all tables referencing users(id)
    await Promise.allSettled([
      // Field Staff Violations & Reports (Addresses field_attendance_violations_user_id_fkey)
      adminClient.from('field_attendance_violations').delete().eq('user_id', targetUserId),
      adminClient.from('field_attendance_violations').update({ acknowledged_by: null }).eq('acknowledged_by', targetUserId),
      adminClient.from('field_attendance_violations').update({ escalated_to: null }).eq('escalated_to', targetUserId),
      adminClient.from('field_reports').delete().eq('user_id', targetUserId),

      // Attendance Unlock Requests & Approvals
      adminClient.from('attendance_unlock_requests').delete().eq('user_id', targetUserId),
      adminClient.from('attendance_unlock_requests').update({ manager_id: null }).eq('manager_id', targetUserId),
      adminClient.from('attendance_approvals').update({ manager_id: null }).eq('manager_id', targetUserId),
      adminClient.from('attendance_approvals').delete().eq('user_id', targetUserId),

      // Gate Passes & Emergency Alerts
      adminClient.from('gate_emergency_alerts').update({ resolved_by: null }).eq('resolved_by', targetUserId),
      adminClient.from('gate_material_passes').update({ noc_approved_by: null }).eq('noc_approved_by', targetUserId),
      adminClient.from('gate_material_passes').update({ gate_verified_by: null }).eq('gate_verified_by', targetUserId),
      adminClient.from('kiosk_devices').update({ user_id: null }).eq('user_id', targetUserId),

      // Notifications & Rules
      adminClient.from('notification_rules').delete().eq('recipient_user_id', targetUserId),
      adminClient.from('notifications').delete().eq('user_id', targetUserId),
      adminClient.from('notifications').delete().eq('recipient_id', targetUserId),

      // Children & Dependents
      adminClient.from('user_children').delete().eq('user_id', targetUserId),
      adminClient.from('user_children').update({ verified_by: null }).eq('verified_by', targetUserId),

      // Reporting Manager Hierarchy (Self-referencing foreign keys)
      adminClient.from('users').update({ reporting_manager_id: null }).eq('reporting_manager_id', targetUserId),
      adminClient.from('users').update({ reporting_manager_2_id: null }).eq('reporting_manager_2_id', targetUserId),
      adminClient.from('users').update({ reporting_manager_3_id: null }).eq('reporting_manager_3_id', targetUserId),
      adminClient.from('users').update({ second_reporting_manager_id: null }).eq('second_reporting_manager_id', targetUserId),

      // System Backups & Audit Logs
      adminClient.from('system_backups').update({ created_by: null }).eq('created_by', targetUserId),
      adminClient.from('attendance_audit_logs').update({ target_user_id: null }).eq('target_user_id', targetUserId),
      adminClient.from('attendance_audit_logs').update({ performed_by: null }).eq('performed_by', targetUserId),
      adminClient.from('security_audit_logs').update({ user_id: null }).eq('user_id', targetUserId),
      adminClient.from('system_audit_logs').update({ user_id: null }).eq('user_id', targetUserId),
      adminClient.from('tracking_audit_logs').update({ admin_id: null }).eq('admin_id', targetUserId),
      adminClient.from('tracking_audit_logs').update({ target_user_id: null }).eq('target_user_id', targetUserId),
      adminClient.from('audit_logs').update({ user_id: null }).eq('user_id', targetUserId),
      adminClient.from('audit_logs').update({ actor_id: null }).eq('actor_id', targetUserId),

      // Site Responsibility Matrix & Locations
      adminClient.from('site_responsibility_matrix').update({ ops_manager_id: null }).eq('ops_manager_id', targetUserId),
      adminClient.from('site_responsibility_matrix').update({ site_manager_id: null }).eq('site_manager_id', targetUserId),
      adminClient.from('site_responsibility_matrix').update({ hr_incharge_id: null }).eq('hr_incharge_id', targetUserId),
      adminClient.from('site_responsibility_matrix').update({ accounts_incharge_id: null }).eq('accounts_incharge_id', targetUserId),
      adminClient.from('site_responsibility_matrix').update({ site_supervisor_id: null }).eq('site_supervisor_id', targetUserId),
      adminClient.from('locations').update({ created_by: null }).eq('created_by', targetUserId),

      // Tasks & Ops Tickets
      adminClient.from('tasks').update({ assigned_to_id: null }).eq('assigned_to_id', targetUserId),
      adminClient.from('tasks').update({ created_by_id: null }).eq('created_by_id', targetUserId),
      adminClient.from('support_tickets').update({ assigned_to_id: null }).eq('assigned_to_id', targetUserId),
      adminClient.from('ticket_comments').update({ author_id: null }).eq('author_id', targetUserId),
      adminClient.from('ticket_posts').update({ author_id: null }).eq('author_id', targetUserId),
      adminClient.from('ops_tickets').update({ created_by: null }).eq('created_by', targetUserId),
      adminClient.from('ops_tickets').update({ assigned_to: null }).eq('assigned_to', targetUserId),
      adminClient.from('ops_approval_requests').update({ requested_by: null }).eq('requested_by', targetUserId),
      adminClient.from('ops_approval_requests').update({ approver_id: null }).eq('approver_id', targetUserId),

      // Referrals & CRM
      adminClient.from('candidate_referrals').update({ created_by: null }).eq('created_by', targetUserId),
      adminClient.from('business_referrals').update({ created_by: null }).eq('created_by', targetUserId),
      adminClient.from('crm_leads').update({ assigned_to: null }).eq('assigned_to', targetUserId),
      adminClient.from('crm_leads').update({ created_by: null }).eq('created_by', targetUserId),

      // Finance & Invoicing
      adminClient.from('site_invoice_tracker').update({ created_by: null }).eq('created_by', targetUserId),
      adminClient.from('site_invoice_tracker').update({ deleted_by: null }).eq('deleted_by', targetUserId),
      adminClient.from('site_finance_tracker').update({ created_by: null }).eq('created_by', targetUserId),

      // Onboarding Submissions
      adminClient.from('onboarding_submissions').delete().eq('user_id', targetUserId),
      adminClient.from('onboarding_submissions').update({ created_user_id: null }).eq('created_user_id', targetUserId),
      adminClient.from('onboarding_submissions').update({ verified_by: null }).eq('verified_by', targetUserId),
      adminClient.from('onboarding_submissions').update({ fcu_acknowledged_by: null }).eq('fcu_acknowledged_by', targetUserId),
      adminClient.from('onboarding_submissions').update({ fcu_verified_by: null }).eq('fcu_verified_by', targetUserId),

      // Personal Employee Records
      adminClient.from('comp_off_logs').update({ granted_by_id: null }).eq('granted_by_id', targetUserId),
      adminClient.from('comp_off_logs').delete().eq('user_id', targetUserId),
      adminClient.from('extra_work_logs').update({ approver_id: null }).eq('approver_id', targetUserId),
      adminClient.from('extra_work_logs').delete().eq('user_id', targetUserId),
      adminClient.from('user_documents').delete().eq('user_id', targetUserId),
      adminClient.from('user_locations').delete().eq('user_id', targetUserId),
      adminClient.from('user_devices').delete().eq('user_id', targetUserId),
      adminClient.from('device_activity_logs').delete().eq('user_id', targetUserId),
      adminClient.from('device_approvals').delete().eq('user_id', targetUserId),
      adminClient.from('device_reset_logs').delete().eq('user_id', targetUserId),
      adminClient.from('attendance_events').delete().eq('user_id', targetUserId),
      adminClient.from('attendance_violations').delete().eq('user_id', targetUserId),
      adminClient.from('leave_requests').delete().eq('user_id', targetUserId),
      adminClient.from('user_holidays').delete().eq('user_id', targetUserId),
      adminClient.from('user_vehicles').delete().eq('user_id', targetUserId),
      adminClient.from('gate_users').delete().eq('user_id', targetUserId),
      adminClient.from('employee_scores').delete().eq('user_id', targetUserId),
      adminClient.from('fcm_tokens').delete().eq('user_id', targetUserId),
      adminClient.from('route_history').delete().eq('user_id', targetUserId),
      adminClient.from('user_roles').delete().eq('user_id', targetUserId),
      adminClient.from('communication_logs').delete().or(`sender_id.eq.${targetUserId},receiver_id.eq.${targetUserId}`),
      ...(targetEmail ? [adminClient.from('user_site_permissions').delete().eq('user_email', targetEmail)] : [])
    ]);

    // 4. Call delete_user RPC or direct public.users delete
    const { error: rpcErr } = await adminClient.rpc('delete_user', { target_user_id: targetUserId });
    if (rpcErr) {
      console.warn('[deleteUserController] RPC delete_user notice, executing direct delete:', rpcErr.message);
      const { error: directErr } = await adminClient.from('users').delete().eq('id', targetUserId);
      if (directErr) {
        throw new Error(directErr.message || rpcErr.message);
      }
    }

    // 5. Clean up auth.users record via Admin API
    try {
      await adminClient.auth.admin.deleteUser(targetUserId);
    } catch (authDeleteErr) {
      console.warn('[deleteUserController] auth.users cleanup notice (may not have auth record):', authDeleteErr);
    }

    return res.status(200).json({ success: true, message: 'User deleted permanently and cleanly' });
  } catch (error: any) {
    console.error('[deleteUserController] Error deleting user:', error);
    return res.status(500).json({ error: error.message || 'Internal server error while deleting user' });
  }
};
