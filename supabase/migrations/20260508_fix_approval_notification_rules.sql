
-- Add notification rules for punch_unlock_request
-- Notify direct manager
INSERT INTO public.notification_rules (event_type, recipient_role, is_enabled, send_alert, send_push, send_email)
VALUES ('punch_unlock_request', 'direct_manager', true, true, true, false);

-- Notify admin
INSERT INTO public.notification_rules (event_type, recipient_role, is_enabled, send_alert, send_push, send_email)
VALUES ('punch_unlock_request', 'admin', true, true, true, false);

-- Add notification rules for ot_punch
-- Notify direct manager
INSERT INTO public.notification_rules (event_type, recipient_role, is_enabled, send_alert, send_push, send_email)
VALUES ('ot_punch', 'direct_manager', true, true, true, false);

-- Notify admin
INSERT INTO public.notification_rules (event_type, recipient_role, is_enabled, send_alert, send_push, send_email)
VALUES ('ot_punch', 'admin', true, true, true, false);
