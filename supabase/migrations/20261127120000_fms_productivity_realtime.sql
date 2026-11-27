-- FMS Productivity Command Center: enable realtime change events on the
-- tables the dashboard listens to (hooks/useFmsProductivity.ts).
-- Idempotent: only adds tables that exist and are not already published.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'ops_tickets',
    'ops_maintenance_schedules',
    'ops_maintenance_logs',
    'ops_assets',
    'ops_contracts',
    'snag_audits',
    'ops_approval_requests',
    'leave_requests',
    'gate_material_passes',
    'gate_emergency_alerts',
    'gate_entries',
    'gate_patrol_scans'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = t
       )
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
       )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Added % to supabase_realtime', t;
    END IF;
  END LOOP;
END $$;

-- Indexes for the dashboard's hot filters (no-ops if they already exist)
CREATE INDEX IF NOT EXISTS idx_ops_tickets_entity_status ON public.ops_tickets (entity_id, status);
CREATE INDEX IF NOT EXISTS idx_ops_tickets_resolution_due ON public.ops_tickets (resolution_due_at) WHERE status IN ('Open', 'In Progress', 'On Hold');
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests (status);
CREATE INDEX IF NOT EXISTS idx_gate_entries_entry_time ON public.gate_entries (entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_gate_emergency_alerts_created ON public.gate_emergency_alerts (created_at DESC);
