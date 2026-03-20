-- Update roles to include mobile navigation permissions
-- We maintain the exclusion of 'view_mobile_nav_attendance' for 'operation_manager'

UPDATE public.roles
SET permissions = (
  SELECT array_agg(DISTINCT p)
  FROM unnest(
    COALESCE(permissions, ARRAY[]::text[]) || 
    ARRAY['view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'] ||
    CASE 
      WHEN id = 'operation_manager' THEN ARRAY[]::text[]
      ELSE ARRAY['view_mobile_nav_attendance'] 
    END
  ) AS p
);
