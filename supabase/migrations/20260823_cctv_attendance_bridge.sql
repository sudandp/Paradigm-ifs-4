-- ============================================================
--  CCTV to Attendance Events Bridge — Database Migration
--  Creates the bi-directional bridge between cctv_attendance_logs
--  and attendance_events with deduplication and auto-linking.
-- ============================================================

-- ─── 1. Add Bridge Columns to attendance_events ─────────────
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_events' 
        AND column_name = 'cctv_log_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.attendance_events 
        ADD COLUMN cctv_log_id UUID REFERENCES public.cctv_attendance_logs(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_events' 
        AND column_name = 'source' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.attendance_events 
        ADD COLUMN source TEXT DEFAULT 'app';
    END IF;
END $$;

-- ─── 2. Add Bridge Columns to cctv_attendance_logs ──────────
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cctv_attendance_logs' 
        AND column_name = 'bridged' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.cctv_attendance_logs 
        ADD COLUMN bridged BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cctv_attendance_logs' 
        AND column_name = 'bridged_at' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.cctv_attendance_logs 
        ADD COLUMN bridged_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cctv_attendance_logs' 
        AND column_name = 'bridge_error' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.cctv_attendance_logs 
        ADD COLUMN bridge_error TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cctv_attendance_logs' 
        AND column_name = 'location_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.cctv_attendance_logs 
        ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ─── 3. Add location_id to cctv_devices ─────────────────────
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cctv_devices' 
        AND column_name = 'location_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.cctv_devices 
        ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ─── 4. Performance Indexes ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_events_cctv_log ON public.attendance_events(cctv_log_id) WHERE cctv_log_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_events_user_ts ON public.attendance_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_events_source ON public.attendance_events(source);
CREATE INDEX IF NOT EXISTS idx_cctv_logs_unbridged ON public.cctv_attendance_logs(bridged, user_id, detected_at DESC) WHERE user_id IS NOT NULL;

-- ─── 5. Real-Time Bridge Trigger Function ───────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_bridge_cctv_attendance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_window_interval INTERVAL := INTERVAL '15 minutes';
    v_min_confidence FLOAT := 0.70;
    v_event_type TEXT;
    v_location_name TEXT;
    v_location_id UUID;
    v_device_uuid UUID := NULL;
    v_existing_event_id UUID;
    v_inserted_event_id UUID;
BEGIN
    -- Only process identified employees
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- If already bridged (e.g. manually linked), skip
    IF NEW.bridged = TRUE AND NEW.attendance_event_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Confidence threshold check
    IF COALESCE(NEW.confidence, 0) < v_min_confidence THEN
        NEW.bridge_error := 'Skipped: Confidence below threshold (' || ROUND((COALESCE(NEW.confidence, 0) * 100)::numeric, 1)::text || '% < ' || (v_min_confidence * 100)::text || '%)';
        RETURN NEW;
    END IF;

    -- Determine event type from CCTV direction
    IF NEW.direction = 'entry' THEN
        v_event_type := 'punch-in';
    ELSE
        v_event_type := 'punch-out';
    END IF;

    -- Lookup site location and device UUID from cctv_devices if available
    IF NEW.edge_device_id IS NOT NULL THEN
        SELECT cd.id, cd.location_name, cd.location_id
        INTO v_device_uuid, v_location_name, v_location_id
        FROM public.cctv_devices cd
        WHERE cd.edge_device_id = NEW.edge_device_id
        LIMIT 1;
    END IF;

    -- Fallback location name if device lookup didn't yield one
    IF v_location_name IS NULL THEN
        v_location_name := COALESCE(NEW.camera_name, 'CCTV Gate');
    END IF;

    -- If location_id was directly set on the log, prioritize that
    IF NEW.location_id IS NOT NULL THEN
        v_location_id := NEW.location_id;
    END IF;

    -- Deduplication guard: Check if an attendance event of the same type already exists for this user within ±15 mins
    SELECT id INTO v_existing_event_id
    FROM public.attendance_events
    WHERE user_id = NEW.user_id
      AND type = v_event_type
      AND timestamp >= (NEW.detected_at - v_window_interval)
      AND timestamp <= (NEW.detected_at + v_window_interval)
    ORDER BY ABS(EXTRACT(EPOCH FROM (timestamp - NEW.detected_at))) ASC
    LIMIT 1;

    IF v_existing_event_id IS NOT NULL THEN
        -- Link to existing event without creating duplicate
        NEW.attendance_event_id := v_existing_event_id;
        NEW.bridged := TRUE;
        NEW.bridged_at := now();
        NEW.bridge_error := 'Merged with existing event ' || v_existing_event_id::text;
        RETURN NEW;
    END IF;

    -- Insert into attendance_events
    INSERT INTO public.attendance_events (
        user_id,
        timestamp,
        type,
        location_name,
        location_id,
        source,
        device_id,
        device_name,
        cctv_log_id,
        is_manual
    ) VALUES (
        NEW.user_id,
        NEW.detected_at,
        v_event_type,
        v_location_name,
        v_location_id,
        'cctv',
        v_device_uuid,
        COALESCE(NEW.edge_device_id, 'CCTV Edge Server'),
        NEW.id,
        FALSE
    ) RETURNING id INTO v_inserted_event_id;

    NEW.attendance_event_id := v_inserted_event_id;
    NEW.bridged := TRUE;
    NEW.bridged_at := now();
    NEW.bridge_error := NULL;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never fail the CCTV log insertion even if bridge encounters an unexpected issue
    NEW.bridge_error := 'Bridge error: ' || SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_cctv_attendance_bridge ON public.cctv_attendance_logs;
CREATE TRIGGER trg_cctv_attendance_bridge
    BEFORE INSERT OR UPDATE OF user_id ON public.cctv_attendance_logs
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION public.trg_fn_bridge_cctv_attendance();

-- ─── 6. Batch Backfill Stored Procedure ──────────────────────
CREATE OR REPLACE FUNCTION public.backfill_cctv_attendance_bridge(
    p_limit INTEGER DEFAULT 500,
    p_min_confidence FLOAT DEFAULT 0.70
)
RETURNS TABLE (
    processed_count INTEGER,
    bridged_count INTEGER,
    merged_count INTEGER,
    skipped_count INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r RECORD;
    v_proc INTEGER := 0;
    v_bridged INTEGER := 0;
    v_merged INTEGER := 0;
    v_skipped INTEGER := 0;
    v_window_interval INTERVAL := INTERVAL '15 minutes';
    v_event_type TEXT;
    v_existing_event_id UUID;
    v_inserted_event_id UUID;
    v_location_name TEXT;
    v_location_id UUID;
BEGIN
    FOR r IN (
        SELECT l.*, cd.id as device_uuid, cd.location_name as device_loc_name, cd.location_id as device_loc_id
        FROM public.cctv_attendance_logs l
        LEFT JOIN public.cctv_devices cd ON cd.edge_device_id = l.edge_device_id
        WHERE l.user_id IS NOT NULL 
          AND (l.bridged IS NULL OR l.bridged = FALSE)
        ORDER BY l.detected_at ASC
        LIMIT p_limit
    ) LOOP
        v_proc := v_proc + 1;

        IF COALESCE(r.confidence, 0) < p_min_confidence THEN
            UPDATE public.cctv_attendance_logs
            SET bridge_error = 'Skipped: Confidence below threshold (' || ROUND((COALESCE(r.confidence, 0) * 100)::numeric, 1)::text || '%)'
            WHERE id = r.id;
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        IF r.direction = 'entry' THEN
            v_event_type := 'punch-in';
        ELSE
            v_event_type := 'punch-out';
        END IF;

        v_location_name := COALESCE(r.device_loc_name, r.camera_name, 'CCTV Gate');
        v_location_id := COALESCE(r.location_id, r.device_loc_id);

        -- Check duplicate
        SELECT id INTO v_existing_event_id
        FROM public.attendance_events
        WHERE user_id = r.user_id
          AND type = v_event_type
          AND timestamp >= (r.detected_at - v_window_interval)
          AND timestamp <= (r.detected_at + v_window_interval)
        ORDER BY ABS(EXTRACT(EPOCH FROM (timestamp - r.detected_at))) ASC
        LIMIT 1;

        IF v_existing_event_id IS NOT NULL THEN
            UPDATE public.cctv_attendance_logs
            SET attendance_event_id = v_existing_event_id,
                bridged = TRUE,
                bridged_at = now(),
                bridge_error = 'Merged with existing event ' || v_existing_event_id::text
            WHERE id = r.id;
            v_merged := v_merged + 1;
        ELSE
            INSERT INTO public.attendance_events (
                user_id,
                timestamp,
                type,
                location_name,
                location_id,
                source,
                device_id,
                device_name,
                cctv_log_id,
                is_manual
            ) VALUES (
                r.user_id,
                r.detected_at,
                v_event_type,
                v_location_name,
                v_location_id,
                'cctv',
                r.device_uuid,
                COALESCE(r.edge_device_id, 'CCTV Edge Server'),
                r.id,
                FALSE
            ) RETURNING id INTO v_inserted_event_id;

            UPDATE public.cctv_attendance_logs
            SET attendance_event_id = v_inserted_event_id,
                bridged = TRUE,
                bridged_at = now(),
                bridge_error = NULL
            WHERE id = r.id;
            v_bridged := v_bridged + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_proc, v_bridged, v_merged, v_skipped;
END;
$$;
