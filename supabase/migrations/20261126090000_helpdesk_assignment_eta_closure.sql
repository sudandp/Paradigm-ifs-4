-- ============================================================================
-- Migration: 20261126090000_helpdesk_assignment_eta_closure.sql
-- Phase 2/3 of omnichannel-ticketing-plan.md
--   * Auto-assignment to staff PRESENT at the site (attendance), sticky until resolved
--   * Hand-over when the assignee punches out
--   * Staff actions: accept + ETA, change ETA, hold, reassign, resolve WITH after-photo
--   * Client confirmation (close / reopen), auto-close
--   * Reminders, overdue + escalation tick (pg_cron, every 5 min)
--   * Notification outbox -> helpdesk-notify edge function (WhatsApp to clients, push to staff)
--   * A linked row in public.tasks for every assignment
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Config & columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.channel_sites
    ADD COLUMN IF NOT EXISTS reassign_on_checkout BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS auto_close_hours INT NOT NULL DEFAULT 24,          -- Resolved -> Closed without client reply
    ADD COLUMN IF NOT EXISTS notify_client_on_eta_change BOOLEAN NOT NULL DEFAULT TRUE;

-- Who handles tickets at a site. categories = '{}' means "all categories".
CREATE TABLE IF NOT EXISTS public.site_ticket_assignees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.channel_sites(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'technician' CHECK (tier IN ('technician', 'supervisor', 'manager')),
    categories TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_site_ticket_assignees_user ON public.site_ticket_assignees (user_id);

ALTER TABLE public.ops_tickets
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS assignment_note TEXT,            -- e.g. 'No technician on site'
    ADD COLUMN IF NOT EXISTS reopen_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolution_note TEXT,
    ADD COLUMN IF NOT EXISTS accept_reminder_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS eta_reminder_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMPTZ;

ALTER TABLE public.ops_tickets ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;

-- Photo proof is mandatory for channel tickets; existing app tickets keep their current closing flow.
-- Backfill without firing updated_at / audit triggers on every legacy ticket.
ALTER TABLE public.ops_tickets ALTER COLUMN proof_required SET DEFAULT FALSE;
SET LOCAL session_replication_role = replica;
UPDATE public.ops_tickets SET proof_required = FALSE WHERE COALESCE(source_channel, 'app') = 'app' AND proof_required;
UPDATE public.ops_tickets SET proof_required = TRUE WHERE channel_site_id IS NOT NULL AND NOT proof_required;
SET LOCAL session_replication_role = origin;

-- Timeline order inside one transaction (created -> assigned) needs wall-clock timestamps
ALTER TABLE public.ticket_events ALTER COLUMN created_at SET DEFAULT clock_timestamp();

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS ops_ticket_id UUID REFERENCES public.ops_tickets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_ops_ticket ON public.tasks (ops_ticket_id);

CREATE INDEX IF NOT EXISTS idx_attendance_events_user_ts ON public.attendance_events (user_id, "timestamp" DESC);

-- Global helpdesk authority: admin / super_admin / management only.
-- (check_is_admin() also includes hr etc.; it is still used for configuration screens, not ticket work.)
CREATE OR REPLACE FUNCTION public.helpdesk_is_global_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid() AND u.role_id IN ('super_admin', 'admin', 'management'));
$$;
REVOKE ALL ON FUNCTION public.helpdesk_is_global_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helpdesk_is_global_admin() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Notification outbox (processed by edge function helpdesk-notify)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.ops_tickets(id) ON DELETE CASCADE,
    audience TEXT NOT NULL CHECK (audience IN ('client', 'assignee', 'managers')),
    event TEXT NOT NULL,   -- assigned | reassigned | eta_set | eta_changed | on_hold | resolved | closed | reopened
                           -- | accept_reminder | eta_reminder | overdue | handover | unassigned
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
    attempts INT NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ticket_notifications_pending ON public.ticket_notifications (status, created_at);

-- which outbox row produced a WhatsApp message (retries skip contacts that already got it)
ALTER TABLE public.outbound_messages ADD COLUMN IF NOT EXISTS notification_id UUID REFERENCES public.ticket_notifications(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_outbound_messages_notification ON public.outbound_messages (notification_id, contact_id);

CREATE OR REPLACE FUNCTION public.helpdesk_notify(p_ticket UUID, p_audience TEXT, p_event TEXT, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    INSERT INTO public.ticket_notifications (ticket_id, audience, event, payload)
    VALUES (p_ticket, p_audience, p_event, COALESCE(p_payload, '{}'::jsonb));
$$;

-- Kick the edge function immediately (cron is the safety net). Same Vault secrets as the inbound cron.
CREATE OR REPLACE FUNCTION public.trg_fn_ticket_notifications_kick()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_url TEXT; v_secret TEXT;
BEGIN
    BEGIN
        SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url';
        SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'helpdesk_cron_secret';
        IF v_url IS NOT NULL AND v_secret IS NOT NULL THEN
            PERFORM net.http_post(
                url := v_url || '/functions/v1/helpdesk-notify',
                headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
                body := '{}'::jsonb);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- never block the business transaction because of a notification
    END;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_ticket_notifications_kick ON public.ticket_notifications;
CREATE TRIGGER trg_ticket_notifications_kick
    AFTER INSERT ON public.ticket_notifications
    FOR EACH STATEMENT EXECUTE FUNCTION public.trg_fn_ticket_notifications_kick();

-- ---------------------------------------------------------------------------
-- 3. Who is present at a site right now
--    Present = today's (IST) latest in/out attendance event is an "in" event, and the user either
--    punched in at the site's geofence or is assigned to that location.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.helpdesk_present_staff_all(p_site_id UUID)
RETURNS TABLE (user_id UUID, name TEXT, role_id TEXT, last_in_at TIMESTAMPTZ, tier TEXT, categories TEXT[], open_tickets INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH site AS (
        SELECT s.id, s.location_id FROM public.channel_sites s WHERE s.id = p_site_id
    ),
    last_ev AS (
        -- rolling 16 h window so night shifts that started before midnight still count
        SELECT DISTINCT ON (e.user_id) e.user_id, e.type, e."timestamp", e.location_id
        FROM public.attendance_events e
        WHERE e."timestamp" >= NOW() - INTERVAL '16 hours'
          AND e.type IN ('punch-in', 'check-in', 'check_in', 'site-in', 'site-ot-in',
                         'punch-out', 'check-out', 'check_out', 'site-out', 'site-ot-out')
        ORDER BY e.user_id, e."timestamp" DESC
    )
    SELECT u.id, u.name, u.role_id, le."timestamp", a.tier, a.categories,
           (SELECT COUNT(*)::int FROM public.ops_tickets t
             WHERE t.assigned_to = u.id AND t.status IN ('Open', 'In Progress', 'On Hold'))
    FROM last_ev le
    JOIN public.users u ON u.id = le.user_id
    CROSS JOIN site
    LEFT JOIN public.site_ticket_assignees a ON a.site_id = site.id AND a.user_id = u.id AND a.is_active
    WHERE le.type IN ('punch-in', 'check-in', 'check_in', 'site-in', 'site-ot-in')
      AND COALESCE(u.is_blocked, FALSE) = FALSE
      AND (
            -- configured assignee: present unless they punched in at a DIFFERENT geofence
            (a.user_id IS NOT NULL AND (
                 site.location_id IS NULL OR le.location_id IS NULL OR le.location_id = site.location_id
              OR EXISTS (SELECT 1 FROM public.user_locations ul WHERE ul.user_id = u.id AND ul.location_id = site.location_id)))
            -- other staff are listed (tier NULL, never auto-assigned) when they are at this site's geofence
         OR (site.location_id IS NOT NULL AND (le.location_id = site.location_id OR EXISTS (
                SELECT 1 FROM public.user_locations ul WHERE ul.user_id = u.id AND ul.location_id = site.location_id)))
      );
$$;

-- Supervisors / managers to notify for a site: configured assignees + site_responsibility_matrix
-- Ordered: supervisors before managers (fallback assignment picks the first)
CREATE OR REPLACE FUNCTION public.helpdesk_site_managers_all(p_site_id UUID)
RETURNS TABLE (user_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT q.uid FROM (
        SELECT a.user_id AS uid, CASE a.tier WHEN 'supervisor' THEN 1 ELSE 3 END AS rnk
          FROM public.site_ticket_assignees a
         WHERE a.site_id = p_site_id AND a.is_active AND a.tier IN ('supervisor', 'manager')
        UNION ALL
        SELECT x.uid, x.rnk FROM public.channel_sites s
          JOIN public.site_responsibility_matrix m ON m.site_id = s.location_id AND m.is_active
          CROSS JOIN LATERAL (VALUES (m.site_supervisor_id, 2), (m.ops_manager_id, 4)) AS x(uid, rnk)
         WHERE s.id = p_site_id AND x.uid IS NOT NULL
    ) q
    -- assigned_to references auth.users: only return people who can actually be assigned
    WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = q.uid)
    GROUP BY q.uid
    ORDER BY MIN(q.rnk);
$$;

-- ---------------------------------------------------------------------------
-- 4. Assignment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.helpdesk_sync_task(p_ticket_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.ops_tickets%ROWTYPE;
BEGIN
    SELECT * INTO t FROM public.ops_tickets WHERE id = p_ticket_id;
    IF NOT FOUND THEN RETURN; END IF;

    IF t.assigned_to IS NULL THEN
        UPDATE public.tasks SET assigned_to_id = NULL WHERE ops_ticket_id = t.id AND status <> 'Done';
        RETURN;
    END IF;

    UPDATE public.tasks
       SET assigned_to_id = t.assigned_to,
           status = CASE WHEN t.status IN ('Resolved', 'Closed') THEN 'Done'
                         WHEN t.status IN ('In Progress', 'On Hold') THEN 'In Progress' ELSE 'To Do' END,
           due_date = (COALESCE(t.eta_at, t.resolution_due_at) AT TIME ZONE 'Asia/Kolkata')::date,
           priority = CASE WHEN t.priority IN ('P1', 'P2') THEN 'High' WHEN t.priority = 'P3' THEN 'Medium' ELSE 'Low' END
     WHERE ops_ticket_id = t.id;

    IF NOT FOUND THEN
        INSERT INTO public.tasks (name, description, assigned_to_id, priority, status, due_date, ops_ticket_id)
        VALUES (
            left(COALESCE(t.ticket_number, 'Ticket') || ': ' || t.title, 250),
            concat_ws(E'\n', t.description,
                      NULLIF(concat_ws(' · ', 'Tower ' || t.tower, 'Floor ' || t.floor, t.area), '')),
            t.assigned_to,
            CASE WHEN t.priority IN ('P1', 'P2') THEN 'High' WHEN t.priority = 'P3' THEN 'Medium' ELSE 'Low' END,
            'To Do',
            (COALESCE(t.eta_at, t.resolution_due_at) AT TIME ZONE 'Asia/Kolkata')::date,
            t.id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'helpdesk_sync_task(%): %', p_ticket_id, SQLERRM; -- tasks schema drift must not block tickets
END $$;

-- Picks the best person and assigns. Returns the user id (or NULL when nobody could be found).
CREATE OR REPLACE FUNCTION public.helpdesk_auto_assign(p_ticket_id UUID, p_exclude_user UUID DEFAULT NULL, p_reason TEXT DEFAULT 'auto')
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    t public.ops_tickets%ROWTYPE;
    v_user UUID;
    v_note TEXT;
    v_prev UUID;
BEGIN
    SELECT * INTO t FROM public.ops_tickets WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND OR t.channel_site_id IS NULL OR t.status IN ('Resolved', 'Closed') THEN RETURN NULL; END IF;
    v_prev := t.assigned_to;

    -- a) present technician for this category, least loaded
    SELECT p.user_id INTO v_user FROM public.helpdesk_present_staff_all(t.channel_site_id) p
     WHERE p.tier = 'technician' AND (cardinality(p.categories) = 0 OR t.category = ANY (p.categories))
       AND p.user_id IS DISTINCT FROM p_exclude_user
     ORDER BY p.open_tickets, p.last_in_at LIMIT 1;

    -- b) present supervisor
    IF v_user IS NULL THEN
        SELECT p.user_id INTO v_user FROM public.helpdesk_present_staff_all(t.channel_site_id) p
         WHERE p.tier = 'supervisor' AND p.user_id IS DISTINCT FROM p_exclude_user
         ORDER BY p.open_tickets LIMIT 1;
        IF v_user IS NOT NULL THEN v_note := 'No technician on site – assigned to supervisor'; END IF;
    END IF;

    -- c) nobody suitable present: site supervisor / manager even if off-site
    IF v_user IS NULL THEN
        SELECT m.user_id INTO v_user FROM public.helpdesk_site_managers_all(t.channel_site_id) m
         WHERE m.user_id IS DISTINCT FROM p_exclude_user LIMIT 1;
        IF v_user IS NOT NULL THEN v_note := 'Nobody suitable on site – assigned to site manager'; END IF;
    END IF;

    IF v_user IS NULL THEN
        UPDATE public.ops_tickets SET assignment_note = 'No staff available to assign', is_escalated = TRUE,
               escalated_at = COALESCE(escalated_at, NOW()), updated_at = NOW()
         WHERE id = t.id;
        INSERT INTO public.ticket_events (ticket_id, event_type, payload, is_internal)
        VALUES (t.id, 'assignment_failed', jsonb_build_object('reason', p_reason), TRUE);
        PERFORM public.helpdesk_notify(t.id, 'managers', 'unassigned', jsonb_build_object('reason', p_reason));
        RETURN NULL;
    END IF;

    IF v_user = v_prev THEN RETURN v_user; END IF;

    UPDATE public.ops_tickets
       SET assigned_to = v_user, assigned_at = NOW(), assignment_note = v_note, updated_at = NOW(),
           first_responded_at = NULL, accept_reminder_sent_at = NULL,
           -- a new assignee gets a fresh acceptance window
           response_due_at = CASE WHEN v_prev IS NULL THEN response_due_at
                                  ELSE NOW() + GREATEST(COALESCE(response_due_at - created_at, INTERVAL '30 minutes'), INTERVAL '15 minutes') END,
           status = CASE WHEN status = 'On Hold' THEN status ELSE 'Open' END
     WHERE id = t.id;

    INSERT INTO public.ticket_events (ticket_id, event_type, actor_user_id, payload)
    VALUES (t.id, CASE WHEN v_prev IS NULL THEN 'assigned' ELSE 'reassigned' END, NULL,
            jsonb_build_object('to', v_user, 'from', v_prev, 'reason', p_reason, 'note', v_note,
                               'to_name', (SELECT name FROM public.users WHERE id = v_user)));

    PERFORM public.helpdesk_sync_task(t.id);
    PERFORM public.helpdesk_notify(t.id, 'assignee', CASE WHEN v_prev IS NULL THEN 'assigned' ELSE 'reassigned' END,
                                   jsonb_build_object('reason', p_reason));
    -- New tickets: the bot's "ticket raised" reply already names the assignee
    IF p_reason <> 'new_ticket' THEN
        PERFORM public.helpdesk_notify(t.id, 'client', CASE WHEN v_prev IS NULL THEN 'assigned' ELSE 'reassigned' END, '{}'::jsonb);
    END IF;
    IF v_prev IS NOT NULL OR v_note IS NOT NULL THEN
        PERFORM public.helpdesk_notify(t.id, 'managers', 'reassigned',
                                       jsonb_build_object('reason', p_reason, 'note', v_note, 'from', v_prev));
    END IF;
    RETURN v_user;
END $$;

-- New channel tickets get auto-assigned right after the ingest RPC inserts them
CREATE OR REPLACE FUNCTION public.trg_fn_ops_ticket_auto_assign()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.channel_site_id IS NOT NULL AND NEW.assigned_to IS NULL THEN
        BEGIN
            PERFORM public.helpdesk_auto_assign(NEW.id, NULL, 'new_ticket');
        EXCEPTION WHEN OTHERS THEN
            -- never lose the client's ticket because assignment failed; the tick / managers pick it up
            RAISE WARNING 'helpdesk auto-assign failed for %: %', NEW.id, SQLERRM;
            INSERT INTO public.ticket_events (ticket_id, event_type, payload, is_internal)
            VALUES (NEW.id, 'assignment_failed', jsonb_build_object('error', SQLERRM), TRUE);
        END;
    END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_ops_ticket_auto_assign ON public.ops_tickets;
CREATE TRIGGER trg_ops_ticket_auto_assign
    AFTER INSERT ON public.ops_tickets
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_ops_ticket_auto_assign();

-- Channel tickets require photo proof
CREATE OR REPLACE FUNCTION public.trg_fn_ops_ticket_proof_default()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.channel_site_id IS NOT NULL THEN NEW.proof_required := TRUE; END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ops_ticket_proof_default ON public.ops_tickets;
CREATE TRIGGER trg_ops_ticket_proof_default
    BEFORE INSERT ON public.ops_tickets
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_ops_ticket_proof_default();

-- ---------------------------------------------------------------------------
-- 5. Guard: no Resolved/Closed without an AFTER photo (unless admin override with reason+photo)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_ops_ticket_require_proof()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- admin_override only counts when set by an admin (or a backend role with no JWT) and with a reason
    IF NEW.proof_required
       AND NEW.status IN ('Resolved', 'Closed')
       AND OLD.status NOT IN ('Resolved', 'Closed')
       AND NOT (COALESCE(NEW.admin_override, FALSE)
                AND COALESCE(trim(NEW.admin_override_reason), '') <> ''
                AND (auth.uid() IS NULL OR public.helpdesk_is_global_admin()))
       -- after a reopen, an older photo is not proof any more
       AND NOT EXISTS (SELECT 1 FROM public.ticket_media m
                        WHERE m.ticket_id = NEW.id AND m.kind = 'after'
                          AND m.created_at > COALESCE(NEW.reopened_at, '-infinity'::timestamptz)) THEN
        RAISE EXCEPTION 'An after-photo is required before this ticket can be resolved'
            USING ERRCODE = 'check_violation', HINT = 'Upload a completion photo first';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ops_ticket_require_proof ON public.ops_tickets;
CREATE TRIGGER trg_ops_ticket_require_proof
    BEFORE UPDATE OF status ON public.ops_tickets
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_ops_ticket_require_proof();

-- ---------------------------------------------------------------------------
-- 6. Staff actions (RPCs called from the app)
-- ---------------------------------------------------------------------------
-- Can the current user act on this ticket? action: 'work' (assignee / managers) | 'reassign' (managers only)
CREATE OR REPLACE FUNCTION public.helpdesk_can_act(p_ticket_id UUID, p_action TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    -- Global: admins + management. Everyone else is scoped to sites where they are supervisor/manager
    -- (site_ticket_assignees or Site Responsibility Matrix). Fine-grained rules come in Phase 4.
    SELECT public.helpdesk_is_global_admin()
        OR EXISTS (SELECT 1 FROM public.ops_tickets t
                     JOIN public.helpdesk_site_managers_all(t.channel_site_id) m ON m.user_id = auth.uid()
                    WHERE t.id = p_ticket_id)
        OR (p_action = 'work' AND EXISTS (SELECT 1 FROM public.ops_tickets t WHERE t.id = p_ticket_id AND t.assigned_to = auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.helpdesk_accept_ticket(p_ticket_id UUID, p_eta TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.ops_tickets%ROWTYPE;
BEGIN
    IF NOT public.helpdesk_can_act(p_ticket_id, 'work') THEN RAISE EXCEPTION 'Not allowed'; END IF;
    IF p_eta IS NULL OR p_eta < NOW() THEN RAISE EXCEPTION 'ETA must be in the future'; END IF;
    SELECT * INTO t FROM public.ops_tickets WHERE id = p_ticket_id FOR UPDATE;
    IF t.status IN ('Resolved', 'Closed') THEN RAISE EXCEPTION 'Ticket is already %', t.status; END IF;

    UPDATE public.ops_tickets
       SET status = 'In Progress', eta_at = p_eta, first_responded_at = COALESCE(first_responded_at, NOW()),
           assigned_to = COALESCE(assigned_to, auth.uid()), assigned_at = COALESCE(assigned_at, NOW()),
           pending_reason = NULL, eta_reminder_sent_at = NULL, overdue_notified_at = NULL, updated_at = NOW()
     WHERE id = p_ticket_id;
    INSERT INTO public.ticket_events (ticket_id, event_type, actor_user_id, payload)
    VALUES (p_ticket_id, 'eta_set', auth.uid(), jsonb_build_object('eta', p_eta, 'accepted', TRUE));
    PERFORM public.helpdesk_sync_task(p_ticket_id);
    PERFORM public.helpdesk_notify(p_ticket_id, 'client', 'eta_set', jsonb_build_object('eta', p_eta));
END $$;

CREATE OR REPLACE FUNCTION public.helpdesk_set_eta(p_ticket_id UUID, p_eta TIMESTAMPTZ, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.ops_tickets%ROWTYPE; v_notify BOOLEAN;
BEGIN
    IF NOT public.helpdesk_can_act(p_ticket_id, 'work') THEN RAISE EXCEPTION 'Not allowed'; END IF;
    IF p_eta IS NULL OR p_eta < NOW() THEN RAISE EXCEPTION 'ETA must be in the future'; END IF;
    IF COALESCE(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required to change the ETA'; END IF;
    SELECT * INTO t FROM public.ops_tickets WHERE id = p_ticket_id FOR UPDATE;
    IF t.status IN ('Resolved', 'Closed') THEN RAISE EXCEPTION 'Ticket is already %', t.status; END IF;

    UPDATE public.ops_tickets
       SET eta_at = p_eta, eta_reminder_sent_at = NULL, overdue_notified_at = NULL,
           status = CASE WHEN status = 'Open' THEN 'In Progress' ELSE status END,
           first_responded_at = COALESCE(first_responded_at, NOW()), updated_at = NOW()
     WHERE id = p_ticket_id;
    INSERT INTO public.ticket_events (ticket_id, event_type, actor_user_id, payload)
    VALUES (p_ticket_id, 'eta_changed', auth.uid(), jsonb_build_object('from', t.eta_at, 'eta', p_eta, 'reason', p_reason));
    PERFORM public.helpdesk_sync_task(p_ticket_id);

    SELECT s.notify_client_on_eta_change INTO v_notify FROM public.channel_sites s WHERE s.id = t.channel_site_id;
    IF COALESCE(v_notify, TRUE) THEN
        PERFORM public.helpdesk_notify(p_ticket_id, 'client', 'eta_changed', jsonb_build_object('eta', p_eta, 'reason', p_reason));
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.helpdesk_hold_ticket(p_ticket_id UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.helpdesk_can_act(p_ticket_id, 'work') THEN RAISE EXCEPTION 'Not allowed'; END IF;
    IF COALESCE(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A pending reason is required'; END IF;
    UPDATE public.ops_tickets SET status = 'On Hold', pending_reason = p_reason, updated_at = NOW()
     WHERE id = p_ticket_id AND status NOT IN ('Resolved', 'Closed');
    IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found or already closed'; END IF;
    INSERT INTO public.ticket_events (ticket_id, event_type, actor_user_id, payload)
    VALUES (p_ticket_id, 'on_hold', auth.uid(), jsonb_build_object('reason', p_reason));
    PERFORM public.helpdesk_sync_task(p_ticket_id);
    PERFORM public.helpdesk_notify(p_ticket_id, 'client', 'on_hold', jsonb_build_object('reason', p_reason));
    PERFORM public.helpdesk_notify(p_ticket_id, 'managers', 'on_hold', jsonb_build_object('reason', p_reason));
END $$;

CREATE OR REPLACE FUNCTION public.helpdesk_reassign_ticket(p_ticket_id UUID, p_user_id UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.ops_tickets%ROWTYPE;
BEGIN
    IF NOT public.helpdesk_can_act(p_ticket_id, 'reassign') THEN RAISE EXCEPTION 'Only site managers and above can reassign'; END IF;
    IF COALESCE(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required to reassign'; END IF;
    SELECT * INTO t FROM public.ops_tickets WHERE id = p_ticket_id FOR UPDATE;
    IF t.status IN ('Resolved', 'Closed') THEN RAISE EXCEPTION 'Ticket is already %', t.status; END IF;
    IF t.assigned_to IS NOT DISTINCT FROM p_user_id THEN RETURN; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN RAISE EXCEPTION 'Unknown user'; END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN RAISE EXCEPTION 'This user has no login and cannot be assigned'; END IF;

    UPDATE public.ops_tickets
       SET assigned_to = p_user_id, assigned_at = NOW(), assignment_note = NULL,
           status = CASE WHEN status = 'On Hold' THEN status ELSE 'Open' END,
           first_responded_at = NULL, accept_reminder_sent_at = NULL, updated_at = NOW(),
           response_due_at = NOW() + GREATEST(COALESCE(response_due_at - created_at, INTERVAL '30 minutes'), INTERVAL '15 minutes')
     WHERE id = p_ticket_id;
    INSERT INTO public.ticket_events (ticket_id, event_type, actor_user_id, payload)
    VALUES (p_ticket_id, 'reassigned', auth.uid(),
            jsonb_build_object('from', t.assigned_to, 'to', p_user_id, 'reason', p_reason,
                               'to_name', (SELECT name FROM public.users WHERE id = p_user_id)));
    PERFORM public.helpdesk_sync_task(p_ticket_id);
    PERFORM public.helpdesk_notify(p_ticket_id, 'assignee', 'reassigned', jsonb_build_object('reason', p_reason));
    PERFORM public.helpdesk_notify(p_ticket_id, 'client', 'reassigned', '{}'::jsonb);
END $$;

-- Resolve: caller first uploads photo(s) to storage bucket 'ticket-media', then passes the paths here.
CREATE OR REPLACE FUNCTION public.helpdesk_resolve_ticket(
    p_ticket_id UUID, p_note TEXT, p_photo_paths TEXT[],
    p_latitude DOUBLE PRECISION DEFAULT NULL, p_longitude DOUBLE PRECISION DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_path TEXT; t public.ops_tickets%ROWTYPE;
BEGIN
    IF NOT public.helpdesk_can_act(p_ticket_id, 'work') THEN RAISE EXCEPTION 'Not allowed'; END IF;
    SELECT * INTO t FROM public.ops_tickets WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;
    IF t.status IN ('Resolved', 'Closed') THEN RAISE EXCEPTION 'Ticket is already %', t.status; END IF;

    FOREACH v_path IN ARRAY COALESCE(p_photo_paths, '{}') LOOP
        IF v_path !~ '^[A-Za-z0-9/_.-]+$' OR v_path LIKE '%..%' THEN RAISE EXCEPTION 'Invalid photo path'; END IF;
        INSERT INTO public.ticket_media (ticket_id, kind, storage_path, uploaded_by_user, latitude, longitude)
        VALUES (p_ticket_id, 'after', v_path, auth.uid(), p_latitude, p_longitude);
    END LOOP;

    -- trg_ops_ticket_require_proof enforces at least one 'after' photo
    UPDATE public.ops_tickets
       SET status = 'Resolved', resolved_at = NOW(), resolution_note = p_note, pending_reason = NULL, updated_at = NOW()
     WHERE id = p_ticket_id;
    INSERT INTO public.ticket_events (ticket_id, event_type, actor_user_id, payload)
    VALUES (p_ticket_id, 'resolved', auth.uid(),
            jsonb_build_object('note', p_note, 'photos', COALESCE(array_length(p_photo_paths, 1), 0)));
    PERFORM public.helpdesk_sync_task(p_ticket_id);
    PERFORM public.helpdesk_notify(p_ticket_id, 'client', 'resolved', '{}'::jsonb);
    PERFORM public.helpdesk_notify(p_ticket_id, 'managers', 'resolved', '{}'::jsonb);
END $$;

-- Called by the WhatsApp engine (service role) when the client taps Yes / No
CREATE OR REPLACE FUNCTION public.helpdesk_client_confirm(p_ticket_id UUID, p_contact_id UUID, p_ok BOOLEAN, p_comment TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.ops_tickets%ROWTYPE;
BEGIN
    SELECT * INTO t FROM public.ops_tickets WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN RETURN 'not_found'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.ticket_reporters r WHERE r.ticket_id = p_ticket_id AND r.contact_id = p_contact_id) THEN
        RETURN 'not_reporter';
    END IF;
    IF t.status <> 'Resolved' THEN RETURN 'already_' || lower(replace(t.status, ' ', '_')); END IF;

    IF p_ok THEN
        UPDATE public.ops_tickets SET status = 'Closed', client_confirmed_at = NOW(), updated_at = NOW() WHERE id = p_ticket_id;
        INSERT INTO public.ticket_events (ticket_id, event_type, actor_contact_id, payload)
        VALUES (p_ticket_id, 'client_confirmed', p_contact_id, jsonb_build_object('comment', p_comment));
        PERFORM public.helpdesk_sync_task(p_ticket_id);
        RETURN 'closed';
    END IF;

    UPDATE public.ops_tickets
       SET status = 'In Progress', reopen_count = reopen_count + 1, resolved_at = NULL, reopened_at = NOW(),
           -- the old ETA is in the past: give the assignee a fresh window instead of escalating instantly
           eta_at = NOW() + INTERVAL '4 hours',
           overdue_notified_at = NULL, eta_reminder_sent_at = NULL, updated_at = NOW()
     WHERE id = p_ticket_id;
    INSERT INTO public.ticket_events (ticket_id, event_type, actor_contact_id, payload)
    VALUES (p_ticket_id, 'reopened', p_contact_id, jsonb_build_object('comment', p_comment, 'reopen_count', t.reopen_count + 1));
    PERFORM public.helpdesk_sync_task(p_ticket_id);
    PERFORM public.helpdesk_notify(p_ticket_id, 'assignee', 'reopened', jsonb_build_object('comment', p_comment));
    PERFORM public.helpdesk_notify(p_ticket_id, 'managers', 'reopened', jsonb_build_object('comment', p_comment));
    RETURN 'reopened';
END $$;

-- ---------------------------------------------------------------------------
-- 7. Hand-over when the assignee punches out
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_helpdesk_checkout_handover()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_new UUID;
BEGIN
    IF NEW.type NOT IN ('punch-out', 'check-out', 'check_out', 'site-out', 'site-ot-out') THEN RETURN NULL; END IF;
    BEGIN
        FOR r IN
            SELECT t.id, s.reassign_on_checkout
              FROM public.ops_tickets t JOIN public.channel_sites s ON s.id = t.channel_site_id
             WHERE t.assigned_to = NEW.user_id AND t.status IN ('Open', 'In Progress')
        LOOP
            IF r.reassign_on_checkout THEN
                v_new := public.helpdesk_auto_assign(r.id, NEW.user_id, 'assignee_checked_out');
            ELSE
                INSERT INTO public.ticket_events (ticket_id, event_type, payload, is_internal)
                VALUES (r.id, 'assignee_checked_out', jsonb_build_object('user_id', NEW.user_id), TRUE);
                PERFORM public.helpdesk_notify(r.id, 'managers', 'handover', jsonb_build_object('user_id', NEW.user_id));
            END IF;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'helpdesk checkout handover failed for %: %', NEW.user_id, SQLERRM; -- never block attendance
    END;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_helpdesk_checkout_handover ON public.attendance_events;
CREATE TRIGGER trg_helpdesk_checkout_handover
    AFTER INSERT ON public.attendance_events
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_helpdesk_checkout_handover();

-- ---------------------------------------------------------------------------
-- 8. Periodic tick: reminders, overdue/escalation, auto-close (pg_cron every 5 min)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.helpdesk_tick()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n_accept INT := 0; n_eta INT := 0; n_overdue INT := 0; n_closed INT := 0;
BEGIN
    -- Not accepted within the SLA response time
    FOR r IN SELECT id FROM public.ops_tickets
              WHERE channel_site_id IS NOT NULL AND status = 'Open' AND assigned_to IS NOT NULL
                AND first_responded_at IS NULL AND accept_reminder_sent_at IS NULL
                AND response_due_at IS NOT NULL AND response_due_at < NOW()
    LOOP
        UPDATE public.ops_tickets SET accept_reminder_sent_at = NOW()
         WHERE id = r.id AND status = 'Open' AND accept_reminder_sent_at IS NULL;
        CONTINUE WHEN NOT FOUND;
        PERFORM public.helpdesk_notify(r.id, 'assignee', 'accept_reminder', '{}'::jsonb);
        PERFORM public.helpdesk_notify(r.id, 'managers', 'accept_reminder', '{}'::jsonb);
        n_accept := n_accept + 1;
    END LOOP;

    -- 15 minutes before ETA
    FOR r IN SELECT id FROM public.ops_tickets
              WHERE channel_site_id IS NOT NULL AND status = 'In Progress' AND eta_at IS NOT NULL
                AND eta_reminder_sent_at IS NULL AND eta_at BETWEEN NOW() AND NOW() + INTERVAL '15 minutes'
    LOOP
        UPDATE public.ops_tickets SET eta_reminder_sent_at = NOW()
         WHERE id = r.id AND status = 'In Progress' AND eta_reminder_sent_at IS NULL;
        CONTINUE WHEN NOT FOUND;
        PERFORM public.helpdesk_notify(r.id, 'assignee', 'eta_reminder', '{}'::jsonb);
        n_eta := n_eta + 1;
    END LOOP;

    -- Overdue: ETA (or SLA resolution time) passed -> escalate one level
    FOR r IN SELECT id, escalation_level FROM public.ops_tickets
              WHERE channel_site_id IS NOT NULL AND status IN ('Open', 'In Progress')
                AND COALESCE(eta_at, resolution_due_at) < NOW()
                AND (overdue_notified_at IS NULL OR overdue_notified_at < COALESCE(eta_at, resolution_due_at))
    LOOP
        UPDATE public.ops_tickets
           SET overdue_notified_at = NOW(), is_escalated = TRUE, escalated_at = COALESCE(escalated_at, NOW()),
               escalation_level = COALESCE(escalation_level, 0) + 1
         WHERE id = r.id AND status IN ('Open', 'In Progress');
        CONTINUE WHEN NOT FOUND;
        INSERT INTO public.ticket_events (ticket_id, event_type, payload, is_internal)
        VALUES (r.id, 'escalated', jsonb_build_object('level', COALESCE(r.escalation_level, 0) + 1, 'reason', 'overdue'), TRUE);
        PERFORM public.helpdesk_notify(r.id, 'assignee', 'overdue', '{}'::jsonb);
        PERFORM public.helpdesk_notify(r.id, 'managers', 'overdue', jsonb_build_object('level', COALESCE(r.escalation_level, 0) + 1));
        n_overdue := n_overdue + 1;
    END LOOP;

    -- Resolved and the client did not answer -> close
    FOR r IN SELECT t.id FROM public.ops_tickets t JOIN public.channel_sites s ON s.id = t.channel_site_id
              WHERE t.status = 'Resolved' AND t.resolved_at < NOW() - make_interval(hours => s.auto_close_hours)
    LOOP
        UPDATE public.ops_tickets SET status = 'Closed', updated_at = NOW() WHERE id = r.id AND status = 'Resolved';
        CONTINUE WHEN NOT FOUND; -- client reopened it in the meantime
        INSERT INTO public.ticket_events (ticket_id, event_type, payload)
        VALUES (r.id, 'auto_closed', jsonb_build_object('reason', 'no_client_response'));
        PERFORM public.helpdesk_sync_task(r.id);
        PERFORM public.helpdesk_notify(r.id, 'client', 'closed', '{}'::jsonb);
        n_closed := n_closed + 1;
    END LOOP;

    RETURN jsonb_build_object('accept_reminders', n_accept, 'eta_reminders', n_eta, 'overdue', n_overdue, 'auto_closed', n_closed);
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('helpdesk-tick-every-5-min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('helpdesk-tick-every-5-min', '*/5 * * * *', $cron$ SELECT public.helpdesk_tick(); $cron$);

-- ---------------------------------------------------------------------------
-- 9. Permissions
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.helpdesk_notify(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.helpdesk_auto_assign(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.helpdesk_sync_task(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.helpdesk_client_confirm(UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.helpdesk_tick() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.helpdesk_site_managers_all(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.helpdesk_present_staff_all(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_present_staff_all(UUID), public.helpdesk_site_managers_all(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.helpdesk_notify(UUID, TEXT, TEXT, JSONB), public.helpdesk_auto_assign(UUID, UUID, TEXT),
    public.helpdesk_sync_task(UUID), public.helpdesk_client_confirm(UUID, UUID, BOOLEAN, TEXT), public.helpdesk_tick()
    TO service_role;

REVOKE ALL ON FUNCTION public.helpdesk_accept_ticket(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helpdesk_set_eta(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helpdesk_hold_ticket(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helpdesk_reassign_ticket(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helpdesk_resolve_ticket(UUID, TEXT, TEXT[], DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.helpdesk_can_act(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
    public.helpdesk_accept_ticket(UUID, TIMESTAMPTZ), public.helpdesk_set_eta(UUID, TIMESTAMPTZ, TEXT),
    public.helpdesk_hold_ticket(UUID, TEXT), public.helpdesk_reassign_ticket(UUID, UUID, TEXT),
    public.helpdesk_resolve_ticket(UUID, TEXT, TEXT[], DOUBLE PRECISION, DOUBLE PRECISION),
    public.helpdesk_can_act(UUID, TEXT)
    TO authenticated, service_role;

ALTER TABLE public.site_ticket_assignees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_ticket_assignees_read ON public.site_ticket_assignees;
CREATE POLICY site_ticket_assignees_read ON public.site_ticket_assignees FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS site_ticket_assignees_admin ON public.site_ticket_assignees;
CREATE POLICY site_ticket_assignees_admin ON public.site_ticket_assignees FOR ALL TO authenticated
    USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

ALTER TABLE public.ticket_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_notifications_admin_read ON public.ticket_notifications;
CREATE POLICY ticket_notifications_admin_read ON public.ticket_notifications FOR SELECT TO authenticated
    USING (public.check_is_admin());

-- ---------------------------------------------------------------------------
-- 10. Outbox claim for the notifier (parallel-safe)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ticket_notifications ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.helpdesk_claim_notifications(p_limit INT DEFAULT 50)
RETURNS SETOF public.ticket_notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- a worker that died mid-delivery: give up after 3 attempts
    UPDATE public.ticket_notifications
       SET status = 'failed', error = COALESCE(error, 'processing timeout')
     WHERE status = 'processing' AND claimed_at < NOW() - INTERVAL '5 minutes' AND attempts >= 3;

    RETURN QUERY
    WITH c AS (
        SELECT id FROM public.ticket_notifications
         WHERE status = 'pending'
            OR (status = 'failed' AND attempts < 3)
            OR (status = 'processing' AND claimed_at < NOW() - INTERVAL '5 minutes' AND attempts < 3)
         ORDER BY created_at
         LIMIT p_limit
         FOR UPDATE SKIP LOCKED
    ), u AS (
        UPDATE public.ticket_notifications n
           SET status = 'processing', attempts = n.attempts + 1, claimed_at = NOW()
          FROM c WHERE n.id = c.id
        RETURNING n.*
    )
    SELECT * FROM u;
END $$;
REVOKE ALL ON FUNCTION public.helpdesk_claim_notifications(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_claim_notifications(INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 11. Access hardening
-- ---------------------------------------------------------------------------
-- Is the current user part of this site's helpdesk team (any tier) or its escalation contacts?
CREATE OR REPLACE FUNCTION public.helpdesk_is_site_member(p_site_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.site_ticket_assignees a
                    WHERE a.site_id = p_site_id AND a.user_id = auth.uid() AND a.is_active)
        OR EXISTS (SELECT 1 FROM public.helpdesk_site_managers_all(p_site_id) m WHERE m.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.helpdesk_is_site_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helpdesk_is_site_member(UUID) TO authenticated, service_role;

-- App-facing versions: only global admins, config admins and the site's own team see who is on site.
-- (Backend callers have no JWT -> auth.uid() IS NULL -> allowed.)
CREATE OR REPLACE FUNCTION public.helpdesk_present_staff(p_site_id UUID)
RETURNS TABLE (user_id UUID, name TEXT, role_id TEXT, last_in_at TIMESTAMPTZ, tier TEXT, categories TEXT[], open_tickets INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p.* FROM public.helpdesk_present_staff_all(p_site_id) p
     WHERE auth.uid() IS NULL OR public.helpdesk_is_global_admin() OR public.check_is_admin()
        OR public.helpdesk_is_site_member(p_site_id);
$$;

CREATE OR REPLACE FUNCTION public.helpdesk_site_managers(p_site_id UUID)
RETURNS TABLE (user_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT m.user_id FROM public.helpdesk_site_managers_all(p_site_id) m
     WHERE auth.uid() IS NULL OR public.helpdesk_is_global_admin() OR public.check_is_admin()
        OR public.helpdesk_is_site_member(p_site_id);
$$;
REVOKE ALL ON FUNCTION public.helpdesk_present_staff(UUID), public.helpdesk_site_managers(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helpdesk_present_staff(UUID), public.helpdesk_site_managers(UUID) TO authenticated, service_role;

-- Client phone numbers: config admins, global admins, the site's team, and staff assigned a ticket the contact reported.
CREATE OR REPLACE FUNCTION public.helpdesk_can_see_contact(p_contact_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.check_is_admin() OR public.helpdesk_is_global_admin()
        OR EXISTS (SELECT 1 FROM public.channel_contact_sites cs
                    WHERE cs.contact_id = p_contact_id AND public.helpdesk_is_site_member(cs.site_id))
        OR EXISTS (SELECT 1 FROM public.ticket_reporters r JOIN public.ops_tickets t ON t.id = r.ticket_id
                    WHERE r.contact_id = p_contact_id
                      AND (t.assigned_to = auth.uid() OR public.helpdesk_is_site_member(t.channel_site_id)));
$$;
REVOKE ALL ON FUNCTION public.helpdesk_can_see_contact(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helpdesk_can_see_contact(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS channel_contacts_read ON public.channel_contacts;
CREATE POLICY channel_contacts_read ON public.channel_contacts FOR SELECT TO authenticated
    USING (public.helpdesk_can_see_contact(id));

-- Staff may delete photos they uploaded themselves (cleanup after a failed resolve)
DROP POLICY IF EXISTS ticket_media_storage_delete_own ON storage.objects;
CREATE POLICY ticket_media_storage_delete_own ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'ticket-media' AND owner = auth.uid() AND name LIKE 'after/%');
