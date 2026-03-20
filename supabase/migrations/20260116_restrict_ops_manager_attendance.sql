-- Remove attendance permissions for operation_manager role
UPDATE public.roles
SET permissions = (
  SELECT array_agg(p)
  FROM unnest(permissions) AS p
  WHERE p NOT IN ('view_all_attendance', 'view_own_attendance', 'view_mobile_nav_attendance')
)
WHERE id = 'operation_manager';
