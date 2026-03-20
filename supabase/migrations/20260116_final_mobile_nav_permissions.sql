-- Final update for mobile navigation permissions
-- Adds Home, Tasks, Profile to all roles
-- Removes Attendance from all roles globaly
UPDATE public.roles
SET permissions = (
  SELECT array_agg(DISTINCT p)
  FROM unnest(
    COALESCE(permissions, ARRAY[]::text[]) || 
    ARRAY['view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile']
  ) AS p
  WHERE p != 'view_mobile_nav_attendance'
);
