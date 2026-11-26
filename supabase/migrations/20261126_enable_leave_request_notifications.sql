-- Notify the employee's reporting manager (in-app alert + push) whenever a leave approval is requested:
-- new leave request (app or Paradigm Assist chat), escalation to the next approver, 3rd-Saturday work request.
-- Mirrors the existing punch_unlock_request rules. Email stays off. Idempotent.
insert into public.notification_rules (event_type, recipient_role, recipient_user_id, is_enabled, send_alert, send_push, send_email)
select 'leave_request', 'direct_manager', null, true, true, true, false
where not exists (
  select 1 from public.notification_rules where event_type = 'leave_request' and recipient_role = 'direct_manager'
);
