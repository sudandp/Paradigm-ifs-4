-- Migration: Add User Exit Fields, mark_user_left RPC, and admin_update_user_auth_email RPC
-- Allows marking employees as Left/Relieved with exit date and freeing up role-based emails.

-- 1. Add Exit Tracking Columns to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS left_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exit_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exit_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_original_email TEXT DEFAULT NULL;

-- 2. RPC to Mark User as Left and optionally release/archive email
CREATE OR REPLACE FUNCTION mark_user_left(
  target_user_id UUID,
  p_exit_date DATE DEFAULT CURRENT_DATE,
  p_exit_reason TEXT DEFAULT 'Resigned',
  p_release_email BOOLEAN DEFAULT true,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_email TEXT;
  v_archived_email TEXT := NULL;
  v_user_name TEXT;
  v_email_domain TEXT;
  v_email_prefix TEXT;
BEGIN
  -- Fetch current user record
  SELECT email, name INTO v_current_email, v_user_name
  FROM public.users
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with ID % not found.', target_user_id;
  END IF;

  -- Archive email if releasing
  IF p_release_email AND v_current_email IS NOT NULL AND v_current_email != '' THEN
    IF POSITION('@' IN v_current_email) > 0 THEN
      v_email_prefix := SPLIT_PART(v_current_email, '@', 1);
      v_email_domain := SPLIT_PART(v_current_email, '@', 2);
    ELSE
      v_email_prefix := 'user_' || SUBSTR(target_user_id::text, 1, 8);
      v_email_domain := 'paradigmfms.com';
    END IF;

    -- Format: firstname.lastname.left.YYYYMMDD@domain
    v_archived_email := LOWER(REGEXP_REPLACE(COALESCE(TRIM(v_user_name), v_email_prefix), '[^a-zA-Z0-9]+', '.', 'g')) 
                        || '.left.' 
                        || TO_CHAR(COALESCE(p_exit_date, CURRENT_DATE), 'YYYYMMDD') 
                        || '@' 
                        || v_email_domain;

    -- Avoid collisions if already exists
    WHILE EXISTS (SELECT 1 FROM public.users WHERE email = v_archived_email AND id != target_user_id) LOOP
      v_archived_email := v_archived_email || '_' || SUBSTR(gen_random_uuid()::text, 1, 4);
    END LOOP;

    -- Update Auth credentials (deactivate and archive email)
    UPDATE auth.users
    SET email = v_archived_email,
        banned_until = '2999-12-31 00:00:00+00',
        updated_at = NOW()
    WHERE id = target_user_id;

    -- Update Public User Profile
    UPDATE public.users
    SET status = 'left',
        is_blocked = true,
        left_date = p_exit_date,
        exit_reason = p_exit_reason,
        exit_notes = p_notes,
        archived_original_email = v_current_email,
        email = v_archived_email,
        updated_at = NOW()
    WHERE id = target_user_id;

  ELSE
    -- Mark as left without archiving email
    UPDATE auth.users
    SET banned_until = '2999-12-31 00:00:00+00',
        updated_at = NOW()
    WHERE id = target_user_id;

    UPDATE public.users
    SET status = 'left',
        is_blocked = true,
        left_date = p_exit_date,
        exit_reason = p_exit_reason,
        exit_notes = p_notes,
        updated_at = NOW()
    WHERE id = target_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'userId', target_user_id,
    'status', 'left',
    'archivedEmail', v_archived_email,
    'releasedEmail', v_current_email
  );
END;
$$;

-- 3. RPC to Update User Email in both public.users and auth.users atomically
CREATE OR REPLACE FUNCTION admin_update_user_auth_email(
  target_user_id UUID,
  new_email TEXT,
  new_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Guard against duplicate in public.users
  IF EXISTS (SELECT 1 FROM public.users WHERE email = new_email AND id != target_user_id) THEN
    RAISE EXCEPTION 'Email % is already in use by another active user.', new_email;
  END IF;

  -- Update auth.users (Pre-confirmed so user can login immediately)
  UPDATE auth.users
  SET email = new_email,
      email_confirmed_at = NOW(),
      phone = COALESCE(new_phone, phone),
      phone_confirmed_at = CASE WHEN new_phone IS NOT NULL THEN NOW() ELSE phone_confirmed_at END,
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{phone}',
        to_jsonb(COALESCE(new_phone, ''))
      ),
      updated_at = NOW()
  WHERE id = target_user_id;

  -- Update public.users
  UPDATE public.users
  SET email = new_email,
      phone = COALESCE(new_phone, phone),
      updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'userId', target_user_id,
    'email', new_email
  );
END;
$$;
