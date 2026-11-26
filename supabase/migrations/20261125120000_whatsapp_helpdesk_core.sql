-- ============================================================================
-- Migration: 20261125120000_whatsapp_helpdesk_core.sql
-- Phase 1 of omnichannel-ticketing-plan.md (WhatsApp first)
--
-- Channel-agnostic core used by the WhatsApp webhook (and later Telegram/Email):
--   channel_sites        site registry + QR code (links entities AND locations)
--   site_locations       towers / floors / areas + aliases per site
--   channel_contacts     people who message the bot (client / staff / resident)
--   channel_contact_sites  which sites a contact belongs to
--   inbound_messages     raw, idempotent message log + processing status
--   outbound_messages    send log (status updated from WhatsApp delivery webhooks)
--   ticket_events        ticket timeline / audit
--   ticket_reporters     every person who reported the same ticket
--   ticket_media         before / progress / after photos
--   ops_tickets          + channel / location / dedupe columns
--   helpdesk_ingest_issue()  atomic "create or merge duplicate" RPC
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- 1. Site registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_code TEXT NOT NULL UNIQUE CHECK (site_code ~ '^[A-Z0-9_-]{2,30}$'), -- printed on QR: SITE:LAKESIDE
    display_name TEXT NOT NULL,
    entity_id TEXT REFERENCES public.entities(id) ON DELETE SET NULL,     -- ops_tickets.entity_id
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,  -- attendance geofence (P3 auto-assign)
    organization_id TEXT,
    dedupe_window_hours INT NOT NULL DEFAULT 72,
    auto_priority_bump_reporters INT NOT NULL DEFAULT 3, -- N distinct reporters => priority +1 (0 = off)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.site_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.channel_sites(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('tower', 'floor', 'area')),
    value TEXT NOT NULL,                     -- canonical, e.g. 'T1', '1', 'CLUBHOUSE'
    aliases TEXT[] NOT NULL DEFAULT '{}',    -- e.g. {'tower 1','tower a','block a','t-1'}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, kind, value)
);

-- ---------------------------------------------------------------------------
-- 2. Contacts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'email', 'app')),
    sender_id TEXT NOT NULL,                 -- WhatsApp wa_id (e.g. 919876543210)
    phone TEXT,
    email TEXT,
    display_name TEXT,
    contact_role TEXT NOT NULL DEFAULT 'client' CHECK (contact_role IN ('client', 'resident', 'staff', 'unknown')),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- set when the number belongs to an employee
    last_site_id UUID REFERENCES public.channel_sites(id) ON DELETE SET NULL,
    conversation_state JSONB NOT NULL DEFAULT '{}'::jsonb,       -- bot waiting for site / location / description
    last_inbound_at TIMESTAMPTZ,             -- WhatsApp 24h customer-service window
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (channel, sender_id)
);

CREATE TABLE IF NOT EXISTS public.channel_contact_sites (
    contact_id UUID NOT NULL REFERENCES public.channel_contacts(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES public.channel_sites(id) ON DELETE CASCADE,
    unit_number TEXT,
    added_via TEXT NOT NULL DEFAULT 'qr' CHECK (added_via IN ('qr', 'picker', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (contact_id, site_id)
);

-- ---------------------------------------------------------------------------
-- 3. Ticket extensions (must exist before the message log references tickets)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ops_tickets
    ADD COLUMN IF NOT EXISTS source_channel TEXT DEFAULT 'app',
    ADD COLUMN IF NOT EXISTS channel_site_id UUID REFERENCES public.channel_sites(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tower TEXT,
    ADD COLUMN IF NOT EXISTS floor TEXT,
    ADD COLUMN IF NOT EXISTS area TEXT,
    ADD COLUMN IF NOT EXISTS issue_type TEXT,           -- canonical slug used for duplicate detection
    ADD COLUMN IF NOT EXISTS reporter_contact_id UUID REFERENCES public.channel_contacts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS eta_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pending_reason TEXT,
    ADD COLUMN IF NOT EXISTS proof_required BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC(4,3);

CREATE INDEX IF NOT EXISTS idx_ops_tickets_dedupe
    ON public.ops_tickets (channel_site_id, category, tower, floor)
    WHERE status IN ('Open', 'In Progress', 'On Hold');
-- pg_trgm may live in "public" or (on Supabase) "extensions": resolve the opclass schema dynamically
DO $$
DECLARE v_schema TEXT;
BEGIN
    SELECT n.nspname INTO v_schema
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm';
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_ops_tickets_title_trgm ON public.ops_tickets USING gin (title %I.gin_trgm_ops)',
        v_schema);
END $$;

CREATE SEQUENCE IF NOT EXISTS public.ops_ticket_channel_seq;

-- ---------------------------------------------------------------------------
-- 4. Message logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inbound_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL,
    external_msg_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT,
    contact_id UUID REFERENCES public.channel_contacts(id) ON DELETE SET NULL,
    site_id UUID REFERENCES public.channel_sites(id) ON DELETE SET NULL,
    msg_type TEXT NOT NULL,                  -- text | image | audio | video | document | interactive | button | location | other
    body TEXT,
    media JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{id, mime_type, storage_path, sha256}]
    context_msg_id TEXT,                     -- message being replied to
    is_forwarded BOOLEAN NOT NULL DEFAULT FALSE,
    raw JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
        ('pending', 'processing', 'processed', 'ignored', 'awaiting_info', 'review', 'failed')),
    ai_result JSONB,
    ticket_id UUID REFERENCES public.ops_tickets(id) ON DELETE SET NULL,
    error TEXT,
    attempts INT NOT NULL DEFAULT 0,
    processed_at TIMESTAMPTZ,
    UNIQUE (channel, external_msg_id)        -- webhook retries never create a second ticket
);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_status ON public.inbound_messages (status, received_at);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_contact ON public.inbound_messages (contact_id, received_at DESC);

CREATE TABLE IF NOT EXISTS public.outbound_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL,
    to_id TEXT NOT NULL,
    contact_id UUID REFERENCES public.channel_contacts(id) ON DELETE SET NULL,
    ticket_id UUID REFERENCES public.ops_tickets(id) ON DELETE SET NULL,
    in_reply_to UUID REFERENCES public.inbound_messages(id) ON DELETE SET NULL,
    msg_type TEXT NOT NULL DEFAULT 'text',   -- text | template | interactive
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
    external_msg_id TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    status_updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_ext ON public.outbound_messages (channel, external_msg_id);

-- ---------------------------------------------------------------------------
-- 5. Ticket timeline, reporters, media
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.ops_tickets(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,   -- created | duplicate_report | message | media_added | priority_bumped | assigned | eta_set | ...
    actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    actor_contact_id UUID REFERENCES public.channel_contacts(id) ON DELETE SET NULL,
    inbound_message_id UUID REFERENCES public.inbound_messages(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,  -- internal notes are never sent to clients
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket ON public.ticket_events (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.ticket_reporters (
    ticket_id UUID NOT NULL REFERENCES public.ops_tickets(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.channel_contacts(id) ON DELETE CASCADE,
    first_message_id UUID REFERENCES public.inbound_messages(id) ON DELETE SET NULL,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ticket_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_reporters_contact ON public.ticket_reporters (contact_id);

CREATE TABLE IF NOT EXISTS public.ticket_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.ops_tickets(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'before' CHECK (kind IN ('before', 'progress', 'after')),
    storage_path TEXT NOT NULL,              -- bucket: ticket-media
    mime_type TEXT,
    uploaded_by_user UUID REFERENCES public.users(id) ON DELETE SET NULL,
    uploaded_by_contact UUID REFERENCES public.channel_contacts(id) ON DELETE SET NULL,
    inbound_message_id UUID REFERENCES public.inbound_messages(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_media_ticket ON public.ticket_media (ticket_id);

-- Private storage bucket for WhatsApp photos / proof photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-media', 'ticket-media', false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Atomic create-or-merge (no duplicate tickets, race-safe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.helpdesk_ingest_issue(
    p_site_id UUID,
    p_contact_id UUID,
    p_inbound_message_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_category TEXT,
    p_priority TEXT,
    p_issue_type TEXT,
    p_tower TEXT,
    p_floor TEXT,
    p_area TEXT,
    p_confidence NUMERIC,
    p_source_channel TEXT DEFAULT 'whatsapp'
)
RETURNS TABLE (
    ticket_id UUID,
    ticket_number TEXT,
    is_duplicate BOOLEAN,
    ticket_status TEXT,
    report_count INT,
    eta_at TIMESTAMPTZ,
    resolution_due_at TIMESTAMPTZ,
    assigned_to_name TEXT,
    priority TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
    v_site public.channel_sites%ROWTYPE;
    v_contact public.channel_contacts%ROWTYPE;
    v_existing public.ops_tickets%ROWTYPE;
    v_ticket_id UUID;
    v_new_reporter BOOLEAN := FALSE;
    v_category TEXT := CASE WHEN p_category IN
        ('Electrical','Plumbing','Housekeeping','Security','Civil','HVAC','General') THEN p_category ELSE 'General' END;
    v_priority TEXT := CASE WHEN p_priority IN ('P1','P2','P3','P4') THEN p_priority ELSE 'P3' END;
    v_issue_type TEXT := NULLIF(lower(trim(p_issue_type)), '');
    v_tower TEXT := NULLIF(upper(trim(p_tower)), '');
    v_floor TEXT := NULLIF(upper(trim(p_floor)), '');
    v_area  TEXT := NULLIF(upper(trim(p_area)), '');
    v_title TEXT := left(COALESCE(NULLIF(trim(p_title), ''), 'Issue reported via ' || p_source_channel), 200);
BEGIN
    SELECT * INTO v_site FROM public.channel_sites s WHERE s.id = p_site_id AND s.is_active;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'helpdesk_ingest_issue: unknown or inactive site %', p_site_id;
    END IF;
    SELECT * INTO v_contact FROM public.channel_contacts c WHERE c.id = p_contact_id;

    -- Serialise concurrent reports of the same problem at the same place
    PERFORM pg_advisory_xact_lock(hashtext(
        'helpdesk:' || p_site_id::text || ':' || v_category || ':' ||
        COALESCE(v_tower, '') || ':' || COALESCE(v_floor, '')));

    -- Duplicate = open ticket, same site + category + tower + floor, compatible area,
    -- younger than the site's dedupe window, and the same issue type OR a similar title.
    SELECT t.* INTO v_existing
    FROM public.ops_tickets t
    WHERE t.channel_site_id = p_site_id
      AND t.category = v_category
      AND t.status IN ('Open', 'In Progress', 'On Hold')
      AND t.tower IS NOT DISTINCT FROM v_tower
      AND t.floor IS NOT DISTINCT FROM v_floor
      AND (t.area IS NULL OR v_area IS NULL OR t.area = v_area)
      AND t.created_at > NOW() - make_interval(hours => v_site.dedupe_window_hours)
      AND (
            (v_issue_type IS NOT NULL AND v_issue_type <> 'other' AND t.issue_type = v_issue_type)
         OR similarity(COALESCE(t.title, ''), v_title) >= 0.4
      )
    ORDER BY (t.issue_type IS NOT DISTINCT FROM v_issue_type) DESC,
             similarity(COALESCE(t.title, ''), v_title) DESC,
             t.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        v_ticket_id := v_existing.id;

        IF p_contact_id IS NOT NULL THEN
            INSERT INTO public.ticket_reporters (ticket_id, contact_id, first_message_id)
            VALUES (v_ticket_id, p_contact_id, p_inbound_message_id)
            ON CONFLICT DO NOTHING;
            v_new_reporter := FOUND;
        END IF;

        IF v_new_reporter THEN
            UPDATE public.ops_tickets t
               SET report_count = t.report_count + 1,
                   updated_at = NOW()
             WHERE t.id = v_ticket_id
            RETURNING * INTO v_existing;

            -- Auto-raise priority once when enough distinct people report it
            IF v_site.auto_priority_bump_reporters > 0
               AND v_existing.report_count = v_site.auto_priority_bump_reporters
               AND v_existing.priority <> 'P1' THEN
                UPDATE public.ops_tickets t
                   SET priority = 'P' || (substring(t.priority from 2)::int - 1)::text
                 WHERE t.id = v_ticket_id;
                INSERT INTO public.ticket_events (ticket_id, event_type, payload, is_internal)
                VALUES (v_ticket_id, 'priority_bumped',
                        jsonb_build_object('from', v_existing.priority, 'reason', 'multiple_reporters',
                                           'report_count', v_existing.report_count), TRUE);
            END IF;
        END IF;

        -- A more urgent report (e.g. "now sparking") raises the open ticket's priority ('P1' < 'P3' as text)
        SELECT t.* INTO v_existing FROM public.ops_tickets t WHERE t.id = v_ticket_id;
        IF v_priority < v_existing.priority THEN
            UPDATE public.ops_tickets t SET priority = v_priority, updated_at = NOW() WHERE t.id = v_ticket_id;
            INSERT INTO public.ticket_events (ticket_id, event_type, actor_contact_id, inbound_message_id, payload, is_internal)
            VALUES (v_ticket_id, 'priority_bumped', p_contact_id, p_inbound_message_id,
                    jsonb_build_object('from', v_existing.priority, 'to', v_priority, 'reason', 'more_urgent_report'), TRUE);
        END IF;

        INSERT INTO public.ticket_events (ticket_id, event_type, actor_contact_id, inbound_message_id, payload)
        VALUES (v_ticket_id, 'duplicate_report', p_contact_id, p_inbound_message_id,
                jsonb_build_object('text', p_description, 'new_reporter', v_new_reporter));

        RETURN QUERY
        SELECT t.id, t.ticket_number, TRUE, t.status, t.report_count, t.eta_at, t.resolution_due_at, u.name, t.priority
        FROM public.ops_tickets t LEFT JOIN public.users u ON u.id = t.assigned_to
        WHERE t.id = v_ticket_id;
        RETURN;
    END IF;

    -- New ticket
    INSERT INTO public.ops_tickets (
        organization_id, entity_id, ticket_number, title, description, category, priority, status,
        reported_by_name, reported_by_phone, source_channel, channel_site_id, tower, floor, area,
        issue_type, reporter_contact_id, report_count, extraction_confidence, attachments
    ) VALUES (
        v_site.organization_id, v_site.entity_id,
        'TKT-' || to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYMM') || '-' ||
            lpad(nextval('public.ops_ticket_channel_seq')::text, 5, '0'),
        v_title, p_description, v_category, v_priority, 'Open',
        v_contact.display_name, v_contact.phone, p_source_channel, p_site_id, v_tower, v_floor, v_area,
        v_issue_type, p_contact_id, 1, p_confidence, '[]'::jsonb
    )
    RETURNING id INTO v_ticket_id;

    IF p_contact_id IS NOT NULL THEN
        INSERT INTO public.ticket_reporters (ticket_id, contact_id, first_message_id)
        VALUES (v_ticket_id, p_contact_id, p_inbound_message_id)
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO public.ticket_events (ticket_id, event_type, actor_contact_id, inbound_message_id, payload)
    VALUES (v_ticket_id, 'created', p_contact_id, p_inbound_message_id,
            jsonb_build_object('channel', p_source_channel, 'text', p_description,
                               'confidence', p_confidence, 'issue_type', v_issue_type));

    RETURN QUERY
    SELECT t.id, t.ticket_number, FALSE, t.status, t.report_count, t.eta_at, t.resolution_due_at, u.name, t.priority
    FROM public.ops_tickets t LEFT JOIN public.users u ON u.id = t.assigned_to
    WHERE t.id = v_ticket_id;
END;
$$;

REVOKE ALL ON FUNCTION public.helpdesk_ingest_issue(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_ingest_issue(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS trg_channel_sites_updated ON public.channel_sites;
        CREATE TRIGGER trg_channel_sites_updated BEFORE UPDATE ON public.channel_sites
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        DROP TRIGGER IF EXISTS trg_channel_contacts_updated ON public.channel_contacts;
        CREATE TRIGGER trg_channel_contacts_updated BEFORE UPDATE ON public.channel_contacts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. RLS
--   Writes from WhatsApp go through the edge function (service_role bypasses RLS).
--   Staff can read; only admins edit configuration. Fine-grained per-site
--   view/edit/reassign rules come in Phase 4 (ticket_access_rules).
-- ---------------------------------------------------------------------------
ALTER TABLE public.channel_sites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_locations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_contact_sites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_reporters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_media           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channel_sites_read ON public.channel_sites;
CREATE POLICY channel_sites_read ON public.channel_sites FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS channel_sites_admin ON public.channel_sites;
CREATE POLICY channel_sites_admin ON public.channel_sites FOR ALL TO authenticated
    USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS site_locations_read ON public.site_locations;
CREATE POLICY site_locations_read ON public.site_locations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS site_locations_admin ON public.site_locations;
CREATE POLICY site_locations_admin ON public.site_locations FOR ALL TO authenticated
    USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS channel_contacts_read ON public.channel_contacts;
CREATE POLICY channel_contacts_read ON public.channel_contacts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS channel_contacts_admin ON public.channel_contacts;
CREATE POLICY channel_contacts_admin ON public.channel_contacts FOR ALL TO authenticated
    USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS channel_contact_sites_read ON public.channel_contact_sites;
CREATE POLICY channel_contact_sites_read ON public.channel_contact_sites FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS channel_contact_sites_admin ON public.channel_contact_sites;
CREATE POLICY channel_contact_sites_admin ON public.channel_contact_sites FOR ALL TO authenticated
    USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS inbound_messages_admin_read ON public.inbound_messages;
CREATE POLICY inbound_messages_admin_read ON public.inbound_messages FOR SELECT TO authenticated
    USING (public.check_is_admin());
DROP POLICY IF EXISTS outbound_messages_admin_read ON public.outbound_messages;
CREATE POLICY outbound_messages_admin_read ON public.outbound_messages FOR SELECT TO authenticated
    USING (public.check_is_admin());

DROP POLICY IF EXISTS ticket_events_read ON public.ticket_events;
CREATE POLICY ticket_events_read ON public.ticket_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ticket_events_insert ON public.ticket_events;
CREATE POLICY ticket_events_insert ON public.ticket_events FOR INSERT TO authenticated
    WITH CHECK (actor_user_id = auth.uid());

DROP POLICY IF EXISTS ticket_reporters_read ON public.ticket_reporters;
CREATE POLICY ticket_reporters_read ON public.ticket_reporters FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS ticket_media_read ON public.ticket_media;
CREATE POLICY ticket_media_read ON public.ticket_media FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ticket_media_insert ON public.ticket_media;
CREATE POLICY ticket_media_insert ON public.ticket_media FOR INSERT TO authenticated
    WITH CHECK (uploaded_by_user = auth.uid());

-- Storage: staff can read ticket photos and upload proof photos
DROP POLICY IF EXISTS ticket_media_storage_read ON storage.objects;
CREATE POLICY ticket_media_storage_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'ticket-media');
DROP POLICY IF EXISTS ticket_media_storage_insert ON storage.objects;
CREATE POLICY ticket_media_storage_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ticket-media');
