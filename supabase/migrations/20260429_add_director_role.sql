-- Add Director Role
-- Description: Creates a new 'Director' role that admins can configure.

INSERT INTO public.roles (id, display_name, permissions)
VALUES (
    'director', 
    'Director', 
    ARRAY['view_profile']::TEXT[]
)
ON CONFLICT (id) DO UPDATE 
SET display_name = EXCLUDED.display_name;
