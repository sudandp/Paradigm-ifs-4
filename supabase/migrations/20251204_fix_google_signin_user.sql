-- Check if the user exists in the users table and their role
SELECT id, name, email, role_id 
FROM public.users 
WHERE email = 'deepikasudheer003@gmail.com';

-- If the user doesn't exist or has role 'unverified', update or insert:
-- Option 1: If user exists, update their role (replace 'admin' with desired role)
UPDATE public.users 
SET role_id = 'admin'  -- Change to 'hr', 'developer', 'field_officer', etc. as needed
WHERE email = 'deepikasudheer003@gmail.com';

-- Option 2: If user doesn't exist, insert them (get the ID from Supabase Auth Users table)
-- First, get the auth user ID from the Authentication > Users page, then:
/*
INSERT INTO public.users (id, name, email, role_id)
VALUES (
  'af0cd1cd-accd-43de-9d4e-52f01056f496',  -- Replace with actual auth user ID
  'Deepika Sudheer',
  'deepikasudheer003@gmail.com',
  'admin'  -- or whatever role is appropriate
);
*/
