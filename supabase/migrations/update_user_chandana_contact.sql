-- 1. Archive Madhushree B M (ID: 4e26a446-ad78-4413-833c-22ac8a848478)
-- Preserves all historical attendance, logs, and data while freeing up the email
UPDATE public.users 
SET email = 'madhushree.left@paradigmfms.com',
    is_blocked = true,
    updated_at = NOW()
WHERE id = '4e26a446-ad78-4413-833c-22ac8a848478';

UPDATE auth.users 
SET email = 'madhushree.left@paradigmfms.com',
    banned_until = '2999-12-31 00:00:00+00',
    updated_at = NOW()
WHERE id = '4e26a446-ad78-4413-833c-22ac8a848478';

-- 2. Reassign 'onboarding@paradigmfms.com' and Phone to Chandana R (ID: bbcbb70e-9c52-46c3-96e9-8e89155e35bd)
-- Pre-confirmed in Auth table so no verification link is needed
UPDATE auth.users 
SET email = 'onboarding@paradigmfms.com',
    email_confirmed_at = NOW(),
    phone = '6366381663',
    phone_confirmed_at = NOW(),
    raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{phone}',
        '"6366381663"'::jsonb
    ),
    updated_at = NOW()
WHERE id = 'bbcbb70e-9c52-46c3-96e9-8e89155e35bd';

UPDATE public.users 
SET email = 'onboarding@paradigmfms.com',
    phone = '6366381663',
    updated_at = NOW()
WHERE id = 'bbcbb70e-9c52-46c3-96e9-8e89155e35bd';
