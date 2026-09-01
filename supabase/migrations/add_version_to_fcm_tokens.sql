-- ==============================================================================
-- Migration: Add App Version & Build Tracking to FCM Tokens
-- Allows targeting devices running outdated app versions with FCM push updates
-- ==============================================================================

-- 1. Add app_version and build_number to fcm_tokens table
ALTER TABLE IF EXISTS public.fcm_tokens
  ADD COLUMN IF NOT EXISTS app_version TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS build_number INTEGER DEFAULT NULL;

-- 2. Create index for fast version-based queries
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_platform_version 
ON public.fcm_tokens(platform, app_version);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_build_number 
ON public.fcm_tokens(platform, build_number);

-- 3. Function to get count of outdated devices
CREATE OR REPLACE FUNCTION get_outdated_fcm_device_count(
  p_target_version TEXT,
  p_target_build INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_mobile INT := 0;
  v_outdated INT := 0;
  v_updated INT := 0;
BEGIN
  -- Total mobile tokens (Android/iOS)
  SELECT COUNT(*) INTO v_total_mobile
  FROM public.fcm_tokens
  WHERE platform IN ('android', 'ios');

  -- Outdated tokens: where app_version is NULL, doesn't match target, or build_number < target_build
  SELECT COUNT(*) INTO v_outdated
  FROM public.fcm_tokens
  WHERE platform IN ('android', 'ios')
    AND (
      app_version IS NULL 
      OR app_version != p_target_version
      OR (p_target_build IS NOT NULL AND build_number IS NOT NULL AND build_number < p_target_build)
    );

  v_updated := v_total_mobile - v_outdated;

  RETURN jsonb_build_object(
    'totalMobileDevices', v_total_mobile,
    'outdatedDevices', v_outdated,
    'updatedDevices', v_updated,
    'targetVersion', p_target_version,
    'targetBuild', p_target_build
  );
END;
$$;
