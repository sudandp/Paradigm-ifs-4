-- ==============================================================================
-- Migration: Harden Face Authentication (Phase 2, 3, 11)
-- ==============================================================================

BEGIN;

-- 1. Create a Unique Index to guarantee only one ACTIVE face per user
-- This enforces Phase 2 Database Security Fix at the schema level.
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_face_per_user 
ON public.gate_users (user_id) 
WHERE is_active = true;

-- 2. Create RPC for Transactional Enrollment with Race Condition Protection (Phase 3 & 11)
-- This replaces the client-side multiple queries with a secure, atomic transaction.
CREATE OR REPLACE FUNCTION enroll_face_descriptor(
    p_user_id UUID,
    p_face_descriptor JSONB,
    p_photo_url TEXT DEFAULT NULL,
    p_department TEXT DEFAULT NULL,
    p_qr_token TEXT DEFAULT NULL,
    p_passcode TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock_key BIGINT;
    v_existing_id UUID;
    v_new_id UUID;
    v_result JSONB;
BEGIN
    -- PHASE 11: Race Condition Protection
    -- Generate a lock key from user_id to prevent concurrent enrollments for the same user
    v_lock_key := hashtext(p_user_id::text);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- PHASE 3: Transactional Enrollment
    -- 1. Find all existing user embeddings and deactivate ALL of them
    UPDATE public.gate_users
    SET is_active = false,
        updated_at = NOW()
    WHERE user_id = p_user_id AND is_active = true;

    -- 2. Insert the new latest embedding (or update the most recent inactive one to preserve ID if preferred, but INSERT is cleaner for audit)
    -- We will INSERT a new row, and generate qr_token and passcode if not provided
    INSERT INTO public.gate_users (
        user_id,
        face_descriptor,
        is_active,
        photo_url,
        department,
        qr_token,
        passcode,
        created_at,
        updated_at
    )
    VALUES (
        p_user_id,
        p_face_descriptor,
        true, -- ONLY latest face active
        p_photo_url,
        p_department,
        COALESCE(p_qr_token, 'PG-' || substr(md5(random()::text), 1, 12)),
        COALESCE(p_passcode, floor(random() * 9000 + 1000)::text),
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_id;

    -- Fetch the complete record to return to the client
    SELECT jsonb_build_object(
        'id', g.id,
        'user_id', g.user_id,
        'face_descriptor', g.face_descriptor,
        'qr_token', g.qr_token,
        'passcode', g.passcode,
        'photo_url', g.photo_url,
        'department', g.department,
        'is_active', g.is_active,
        'created_at', g.created_at,
        'updated_at', g.updated_at
    )
    INTO v_result
    FROM public.gate_users g
    WHERE g.id = v_new_id;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Face enrollment failed: %', SQLERRM;
END;
$$;

COMMIT;
