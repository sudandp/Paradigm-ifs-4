-- Migration: 20261024234500_ppm_ticket_linkage.sql
-- Description: Bidirectional linkage between Asset PPM Inspections and Helpdesk Tickets

ALTER TABLE public.ops_tickets
    ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.ops_assets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS asset_code TEXT,
    ADD COLUMN IF NOT EXISTS ppm_log_id UUID;

ALTER TABLE public.ops_asset_ppm_logs
    ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES public.ops_tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ops_tickets_asset ON public.ops_tickets(asset_id);
CREATE INDEX IF NOT EXISTS idx_ops_asset_ppm_logs_ticket ON public.ops_asset_ppm_logs(ticket_id);
