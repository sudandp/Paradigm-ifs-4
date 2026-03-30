-- Migration: 20260330_technical_reliever_setup.sql
-- Description: Adds the 'technical_reliever' role and updates the OT processing function.

-- 1. Add the role to the public.roles table if it doesn't exist
INSERT INTO public.roles (id, display_name, permissions)
VALUES ('technical_reliever', 'Technical Reliever', '{create_enrollment, view_own_attendance, apply_for_leave, access_support_desk}')
ON CONFLICT (id) DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    permissions = EXCLUDED.permissions;

-- 2. Update the OT processing function to explicitly handle technical_reliever as field staff
-- (Actually, since it defaults to 'field', we just need to ensure it's not in the 'office' or 'site' lists)
-- We will also update the comments for event types.

COMMENT ON COLUMN public.attendance_events.type IS 
'Valid values: punch-in, punch-out, break-in, break-out, site-ot-in, site-ot-out. site-ot events are for field staff/technical relievers.';

-- 3. Update the process_ot_after_checkout function to include technical_reliever in field category (if needed)
-- Since the current function defaults to 'field', and it's not in the 'office' or 'site' IN clauses, 
-- it will correctly resolve to 'field'.

-- However, we can add it to the office list if the user later decides they belong there, 
-- but for now we follow the 'field officer' pattern.

-- 4. Fix any existing role_id to role consistency if applicable.
-- The function uses u.role_id, so the roles table entry id 'technical_reliever' is correct.
