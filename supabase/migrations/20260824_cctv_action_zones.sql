-- ============================================================
-- CCTV Attendance Module — Action Zone (ROI) Configuration Migration
-- Adds action_zones JSONB column to public.cctv_devices
-- ============================================================

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cctv_devices' 
        AND column_name = 'action_zones' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.cctv_devices 
        ADD COLUMN action_zones JSONB DEFAULT '{}'::jsonb;
        
        COMMENT ON COLUMN public.cctv_devices.action_zones IS 
        'Stores normalized polygon vertices (x,y in 0.0-1.0) defining the face detection Region of Interest (ROI) per camera.';
    END IF;
END $$;
