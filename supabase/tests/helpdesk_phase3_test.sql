-- ============================================================================
-- Test: Phase 3 helpdesk (20261126090000_helpdesk_assignment_eta_closure.sql)
--   auto-assignment to present staff, tasks sync, notification outbox, photo-proof guard,
--   staff RPCs (accept / resolve), hand-over on punch-out, client confirm (close / reopen),
--   helpdesk_tick() auto-close.
--
-- Self-contained; everything is rolled back (ROLLBACK at the end). Run as postgres:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/helpdesk_phase3_test.sql
--   (or paste into the Supabase SQL editor)
-- Any failed assertion raises an exception and aborts the transaction.
--
-- Notes
--  * ops_tickets.assigned_to references auth.users, so the fixture users are created in
--    auth.users AND public.users (ON CONFLICT in case an auth->public sync trigger exists).
--  * Staff RPCs use auth.uid(). They are called as a real API user would be:
--        set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)
--        SET LOCAL ROLE authenticated
--    and RESET ROLE afterwards (inside each DO block, so _ctx stays readable as postgres).
--  * helpdesk_present_staff() only looks at attendance since IST midnight; punch-ins are
--    stamped NOW() - 1 second, so do not run this in the first second after 00:00 IST.
--  * helpdesk_tick() is global: it also touches real tickets, but all of it is rolled back.
--    pg_net requests queued by the outbox kick trigger are rolled back too (nothing is sent).
-- ============================================================================
BEGIN;

CREATE TEMP TABLE _ctx (k TEXT PRIMARY KEY, v UUID) ON COMMIT DROP;
INSERT INTO _ctx VALUES ('tech', gen_random_uuid()), ('sup', gen_random_uuid()), ('mgr', gen_random_uuid());

-- Fixtures -------------------------------------------------------------------
-- raw_user_meta_data is filled in case the live handle_new_user() trigger (not in this repo)
-- copies the name into public.users (name is NOT NULL there).
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
SELECT v, 'authenticated', 'authenticated', 'zz-hd3-' || k || '@example.invalid',
       jsonb_build_object('name', 'ZZ HD3 ' || k, 'full_name', 'ZZ HD3 ' || k), '{}'::jsonb
FROM _ctx;

INSERT INTO public.users (id, name, email, role_id)
SELECT v, 'ZZ HD3 ' || CASE k WHEN 'tech' THEN 'Technician' WHEN 'sup' THEN 'Supervisor' ELSE 'Manager' END,
       'zz-hd3-' || k || '@example.invalid',
       CASE k WHEN 'tech' THEN 'technician' WHEN 'sup' THEN 'supervisor' ELSE 'operation_manager' END
FROM _ctx
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role_id = EXCLUDED.role_id, email = EXCLUDED.email;

WITH l AS (
    INSERT INTO public.locations (name, latitude, longitude, radius)
    VALUES ('ZZ HD3 Test Location', 12.9716, 77.5946, 200)
    RETURNING id
)
INSERT INTO _ctx SELECT 'loc', id FROM l;

WITH s AS (
    INSERT INTO public.channel_sites (site_code, display_name, location_id, dedupe_window_hours, auto_close_hours)
    VALUES ('ZZ_HD3_SITE', 'Helpdesk Phase 3 test site', (SELECT v FROM _ctx WHERE k = 'loc'), 72, 24)
    RETURNING id
)
INSERT INTO _ctx SELECT 'site', id FROM s;

INSERT INTO public.site_ticket_assignees (site_id, user_id, tier, categories)
VALUES ((SELECT v FROM _ctx WHERE k = 'site'), (SELECT v FROM _ctx WHERE k = 'tech'), 'technician', '{Plumbing}'),
       ((SELECT v FROM _ctx WHERE k = 'site'), (SELECT v FROM _ctx WHERE k = 'sup'),  'supervisor', '{}'),
       ((SELECT v FROM _ctx WHERE k = 'site'), (SELECT v FROM _ctx WHERE k = 'mgr'),  'manager',    '{}');

WITH c AS (
    INSERT INTO public.channel_contacts (channel, sender_id, phone, display_name)
    VALUES ('whatsapp', '910000000031', '+910000000031', 'ZZ HD3 Reporter')
    RETURNING id
)
INSERT INTO _ctx SELECT 'contact', id FROM c;

-- Technician and supervisor punch in at the site today (manager stays off-site)
INSERT INTO public.attendance_events (user_id, type, "timestamp", location_id)
VALUES ((SELECT v FROM _ctx WHERE k = 'tech'), 'punch-in', NOW() - INTERVAL '1 second', (SELECT v FROM _ctx WHERE k = 'loc')),
       ((SELECT v FROM _ctx WHERE k = 'sup'),  'punch-in', NOW() - INTERVAL '1 second', (SELECT v FROM _ctx WHERE k = 'loc'));

-- Helpers --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.ctx(p_k TEXT) RETURNS UUID LANGUAGE sql AS $$
    SELECT v FROM _ctx WHERE k = p_k;
$$;

CREATE OR REPLACE FUNCTION pg_temp.report(p_title TEXT, p_category TEXT, p_issue_type TEXT, p_floor TEXT)
RETURNS TABLE (ticket_id UUID, is_duplicate BOOLEAN, ticket_status TEXT, assigned_to_name TEXT, ticket_number TEXT)
LANGUAGE sql AS $$
    SELECT r.ticket_id, r.is_duplicate, r.ticket_status, r.assigned_to_name, r.ticket_number
    FROM public.helpdesk_ingest_issue(
        pg_temp.ctx('site'), pg_temp.ctx('contact'), NULL,
        p_title, p_title || ' (test)', p_category, 'P3', p_issue_type, 'T1', p_floor, NULL, 0.9) r;
$$;

CREATE OR REPLACE FUNCTION pg_temp.notifs(p_ticket UUID, p_audience TEXT, p_event TEXT) RETURNS INT LANGUAGE sql AS $$
    SELECT COUNT(*)::int FROM public.ticket_notifications n
     WHERE n.ticket_id = p_ticket AND n.audience = p_audience AND n.event = p_event;
$$;

-- Sets the JWT claims auth.uid() reads. The caller does SET LOCAL ROLE authenticated / RESET ROLE.
CREATE OR REPLACE FUNCTION pg_temp.claims(p_uid UUID) RETURNS VOID LANGUAGE sql AS $$
    SELECT set_config('request.jwt.claims',
                      CASE WHEN p_uid IS NULL THEN '' ELSE json_build_object('sub', p_uid, 'role', 'authenticated')::text END,
                      true);
$$;

-- 0. Presence + site managers -------------------------------------------------
DO $$
DECLARE n INT;
BEGIN
    SELECT COUNT(*) INTO n FROM public.helpdesk_present_staff(pg_temp.ctx('site'))
     WHERE user_id IN (pg_temp.ctx('tech'), pg_temp.ctx('sup'));
    IF n <> 2 THEN RAISE EXCEPTION 'T0: expected technician + supervisor present, got %', n; END IF;
    PERFORM 1 FROM public.helpdesk_present_staff(pg_temp.ctx('site')) WHERE user_id = pg_temp.ctx('mgr');
    IF FOUND THEN RAISE EXCEPTION 'T0: manager has no attendance but is reported present'; END IF;
    PERFORM 1 FROM public.helpdesk_present_staff(pg_temp.ctx('site'))
     WHERE user_id = pg_temp.ctx('tech') AND tier = 'technician' AND categories = '{Plumbing}' AND open_tickets = 0;
    IF NOT FOUND THEN RAISE EXCEPTION 'T0: technician row (tier/categories/open_tickets) not as expected'; END IF;

    SELECT COUNT(*) INTO n FROM public.helpdesk_site_managers(pg_temp.ctx('site'))
     WHERE user_id IN (pg_temp.ctx('sup'), pg_temp.ctx('mgr'));
    IF n <> 2 THEN RAISE EXCEPTION 'T0: helpdesk_site_managers should return supervisor + manager, got %', n; END IF;
    PERFORM 1 FROM public.helpdesk_site_managers(pg_temp.ctx('site')) WHERE user_id = pg_temp.ctx('tech');
    IF FOUND THEN RAISE EXCEPTION 'T0: technician must not be a site manager'; END IF;
    RAISE NOTICE 'PASS 0: presence and site managers';
END $$;

-- 1. New Plumbing ticket -> present Plumbing technician, task row, assignee notification
DO $$
DECLARE r RECORD; t public.ops_tickets%ROWTYPE; k public.tasks%ROWTYPE; n INT;
BEGIN
    SELECT * INTO r FROM pg_temp.report('Water leakage', 'Plumbing', 'water_leak', '1');
    IF r.ticket_id IS NULL OR r.is_duplicate THEN RAISE EXCEPTION 'T1: ticket not created'; END IF;
    -- the AFTER INSERT auto-assign trigger has run before ingest's RETURN QUERY
    IF r.assigned_to_name IS DISTINCT FROM 'ZZ HD3 Technician' THEN
        RAISE EXCEPTION 'T1: ingest returned assigned_to_name=% (expected technician)', r.assigned_to_name;
    END IF;
    INSERT INTO _ctx VALUES ('t1', r.ticket_id);

    SELECT * INTO t FROM public.ops_tickets WHERE id = r.ticket_id;
    IF t.assigned_to IS DISTINCT FROM pg_temp.ctx('tech') THEN RAISE EXCEPTION 'T1: assigned_to=%', t.assigned_to; END IF;
    IF t.status <> 'Open' THEN RAISE EXCEPTION 'T1: status=%', t.status; END IF;
    IF NOT t.proof_required THEN RAISE EXCEPTION 'T1: channel ticket must have proof_required'; END IF;
    IF t.assigned_at IS NULL THEN RAISE EXCEPTION 'T1: assigned_at not set'; END IF;
    IF t.assignment_note IS NOT NULL THEN RAISE EXCEPTION 'T1: unexpected assignment_note %', t.assignment_note; END IF;
    IF t.response_due_at IS NULL OR t.resolution_due_at IS NULL THEN RAISE EXCEPTION 'T1: SLA deadlines missing'; END IF;

    SELECT COUNT(*) INTO n FROM public.tasks WHERE ops_ticket_id = r.ticket_id;
    IF n <> 1 THEN RAISE EXCEPTION 'T1: expected 1 linked task, got %', n; END IF;
    SELECT * INTO k FROM public.tasks WHERE ops_ticket_id = r.ticket_id;
    IF k.assigned_to_id IS DISTINCT FROM pg_temp.ctx('tech') OR k.status <> 'To Do' OR k.priority <> 'Medium'
       OR k.name NOT LIKE r.ticket_number || ': %' OR k.due_date IS NULL THEN
        RAISE EXCEPTION 'T1: task row not as expected (assignee %, status %, priority %, name %)',
            k.assigned_to_id, k.status, k.priority, k.name;
    END IF;

    IF pg_temp.notifs(r.ticket_id, 'assignee', 'assigned') <> 1 THEN RAISE EXCEPTION 'T1: no assignee/assigned notification'; END IF;
    -- New tickets: the bot reply names the assignee, so no separate client notification
    IF pg_temp.notifs(r.ticket_id, 'client', 'assigned') <> 0 THEN RAISE EXCEPTION 'T1: unexpected client notification'; END IF;
    PERFORM 1 FROM public.ticket_events e WHERE e.ticket_id = r.ticket_id AND e.event_type = 'assigned'
       AND e.payload->>'reason' = 'new_ticket' AND (e.payload->>'to')::uuid = pg_temp.ctx('tech');
    IF NOT FOUND THEN RAISE EXCEPTION 'T1: no "assigned" ticket event'; END IF;
    RAISE NOTICE 'PASS 1: % auto-assigned to technician, task + notification created', r.ticket_number;
END $$;

-- 2. Category the technician does not handle -> present supervisor, with a note
DO $$
DECLARE r RECORD; t public.ops_tickets%ROWTYPE;
BEGIN
    SELECT * INTO r FROM pg_temp.report('Power failure in corridor', 'Electrical', 'power_failure', '5');
    IF r.assigned_to_name IS DISTINCT FROM 'ZZ HD3 Supervisor' THEN
        RAISE EXCEPTION 'T2: Electrical ticket assigned to % (expected supervisor)', r.assigned_to_name;
    END IF;
    SELECT * INTO t FROM public.ops_tickets WHERE id = r.ticket_id;
    IF t.assignment_note IS NULL OR t.assignment_note NOT LIKE 'No technician on site%' THEN
        RAISE EXCEPTION 'T2: assignment_note=%', t.assignment_note;
    END IF;
    IF pg_temp.notifs(r.ticket_id, 'managers', 'reassigned') <> 1 THEN
        RAISE EXCEPTION 'T2: managers should be told about the fallback assignment';
    END IF;
    RAISE NOTICE 'PASS 2: category mismatch falls back to the present supervisor';
END $$;

-- 3. Technician accepts with an ETA (auth.uid() = technician) ------------------
DO $$
DECLARE t public.ops_tickets%ROWTYPE; v_t UUID := pg_temp.ctx('t1'); v_u UUID := pg_temp.ctx('tech');
BEGIN
    PERFORM pg_temp.claims(v_u);
    SET LOCAL ROLE authenticated;
    PERFORM public.helpdesk_accept_ticket(v_t, NOW() + INTERVAL '2 hours');
    RESET ROLE;
    PERFORM pg_temp.claims(NULL);

    SELECT * INTO t FROM public.ops_tickets WHERE id = v_t;
    IF t.status <> 'In Progress' OR t.eta_at IS NULL OR t.first_responded_at IS NULL THEN
        RAISE EXCEPTION 'T3: accept did not set status/eta/first_responded_at (%, %, %)', t.status, t.eta_at, t.first_responded_at;
    END IF;
    IF pg_temp.notifs(v_t, 'client', 'eta_set') <> 1 THEN RAISE EXCEPTION 'T3: no client eta_set notification'; END IF;
    PERFORM 1 FROM public.tasks WHERE ops_ticket_id = v_t AND status = 'In Progress';
    IF NOT FOUND THEN RAISE EXCEPTION 'T3: task not moved to In Progress'; END IF;
    RAISE NOTICE 'PASS 3: technician accepted with ETA';
END $$;

-- 4. Resolving without an after-photo fails (RPC and direct UPDATE) ------------
DO $$
DECLARE v_t UUID := pg_temp.ctx('t1'); v_u UUID := pg_temp.ctx('tech'); v_failed BOOLEAN := FALSE;
BEGIN
    PERFORM pg_temp.claims(v_u);
    SET LOCAL ROLE authenticated;
    BEGIN
        PERFORM public.helpdesk_resolve_ticket(v_t, 'fixed', ARRAY[]::TEXT[]);
    EXCEPTION WHEN check_violation THEN
        v_failed := TRUE;
    END;
    RESET ROLE;
    PERFORM pg_temp.claims(NULL);
    IF NOT v_failed THEN RAISE EXCEPTION 'T4: resolve without photo succeeded'; END IF;

    v_failed := FALSE;
    BEGIN
        UPDATE public.ops_tickets SET status = 'Resolved' WHERE id = v_t;
    EXCEPTION WHEN check_violation THEN
        v_failed := TRUE;
    END;
    IF NOT v_failed THEN RAISE EXCEPTION 'T4: direct UPDATE to Resolved without photo succeeded'; END IF;

    PERFORM 1 FROM public.ops_tickets WHERE id = v_t AND status = 'In Progress';
    IF NOT FOUND THEN RAISE EXCEPTION 'T4: ticket status changed despite failures'; END IF;
    RAISE NOTICE 'PASS 4: after-photo is mandatory';
END $$;

-- 5. Technician punches out -> ticket handed over to the present supervisor ----
INSERT INTO public.attendance_events (user_id, type, "timestamp", location_id)
VALUES ((SELECT v FROM _ctx WHERE k = 'tech'), 'punch-out', NOW(), (SELECT v FROM _ctx WHERE k = 'loc'));

DO $$
DECLARE t public.ops_tickets%ROWTYPE; v_t UUID := pg_temp.ctx('t1'); n INT;
BEGIN
    PERFORM 1 FROM public.helpdesk_present_staff(pg_temp.ctx('site')) WHERE user_id = pg_temp.ctx('tech');
    IF FOUND THEN RAISE EXCEPTION 'T5: technician still present after punch-out'; END IF;

    SELECT * INTO t FROM public.ops_tickets WHERE id = v_t;
    IF t.assigned_to IS DISTINCT FROM pg_temp.ctx('sup') THEN
        RAISE EXCEPTION 'T5: after punch-out assigned_to=% (expected supervisor)', t.assigned_to;
    END IF;
    IF t.status <> 'Open' OR t.first_responded_at IS NOT NULL THEN
        RAISE EXCEPTION 'T5: hand-over should reset to Open / not accepted (status %, first_responded_at %)', t.status, t.first_responded_at;
    END IF;
    PERFORM 1 FROM public.ticket_events e WHERE e.ticket_id = v_t AND e.event_type = 'reassigned'
       AND e.payload->>'reason' = 'assignee_checked_out' AND (e.payload->>'from')::uuid = pg_temp.ctx('tech');
    IF NOT FOUND THEN RAISE EXCEPTION 'T5: no reassigned event with reason assignee_checked_out'; END IF;

    SELECT COUNT(*) INTO n FROM public.tasks WHERE ops_ticket_id = v_t;
    IF n <> 1 THEN RAISE EXCEPTION 'T5: expected the existing task to be updated, found % tasks', n; END IF;
    PERFORM 1 FROM public.tasks WHERE ops_ticket_id = v_t AND assigned_to_id = pg_temp.ctx('sup') AND status = 'To Do';
    IF NOT FOUND THEN RAISE EXCEPTION 'T5: task not re-pointed to the supervisor'; END IF;

    IF pg_temp.notifs(v_t, 'assignee', 'reassigned') <> 1 THEN RAISE EXCEPTION 'T5: no assignee/reassigned notification'; END IF;
    IF pg_temp.notifs(v_t, 'client', 'reassigned') <> 1 THEN RAISE EXCEPTION 'T5: no client/reassigned notification'; END IF;
    IF pg_temp.notifs(v_t, 'managers', 'reassigned') <> 1 THEN RAISE EXCEPTION 'T5: no managers/reassigned notification'; END IF;
    RAISE NOTICE 'PASS 5: punch-out handed the ticket to the supervisor';
END $$;

-- 6. Former assignee (role technician, no longer assigned) may not act -------
DO $$
DECLARE v_t UUID := pg_temp.ctx('t1'); v_u UUID := pg_temp.ctx('tech'); v_denied BOOLEAN := FALSE;
BEGIN
    PERFORM pg_temp.claims(v_u);
    SET LOCAL ROLE authenticated;
    BEGIN
        PERFORM public.helpdesk_hold_ticket(v_t, 'waiting for parts');
    EXCEPTION WHEN raise_exception THEN
        v_denied := SQLERRM = 'Not allowed';
    END;
    RESET ROLE;
    PERFORM pg_temp.claims(NULL);
    IF NOT v_denied THEN RAISE EXCEPTION 'T6: former assignee was allowed to act'; END IF;
    RAISE NOTICE 'PASS 6: helpdesk_can_act denies the former assignee';
END $$;

-- 7. Supervisor (site manager) resolves with a photo -----------------------------
DO $$
DECLARE t public.ops_tickets%ROWTYPE; v_t UUID := pg_temp.ctx('t1'); v_u UUID := pg_temp.ctx('sup');
BEGIN
    PERFORM pg_temp.claims(v_u);
    SET LOCAL ROLE authenticated;
    PERFORM public.helpdesk_resolve_ticket(v_t, 'Replaced washer', ARRAY['proof/zz-hd3/t1-after-1.jpg'], 12.97, 77.59);
    RESET ROLE;
    PERFORM pg_temp.claims(NULL);

    SELECT * INTO t FROM public.ops_tickets WHERE id = v_t;
    IF t.status <> 'Resolved' OR t.resolved_at IS NULL OR t.resolution_note <> 'Replaced washer' THEN
        RAISE EXCEPTION 'T7: resolve not applied (status %, resolved_at %)', t.status, t.resolved_at;
    END IF;
    PERFORM 1 FROM public.ticket_media m WHERE m.ticket_id = v_t AND m.kind = 'after'
       AND m.storage_path = 'proof/zz-hd3/t1-after-1.jpg' AND m.uploaded_by_user = v_u;
    IF NOT FOUND THEN RAISE EXCEPTION 'T7: after photo not stored'; END IF;
    PERFORM 1 FROM public.tasks WHERE ops_ticket_id = v_t AND status = 'Done';
    IF NOT FOUND THEN RAISE EXCEPTION 'T7: task not Done'; END IF;
    IF pg_temp.notifs(v_t, 'client', 'resolved') <> 1 THEN RAISE EXCEPTION 'T7: no client/resolved notification'; END IF;
    IF pg_temp.notifs(v_t, 'managers', 'resolved') <> 1 THEN RAISE EXCEPTION 'T7: no managers/resolved notification'; END IF;
    RAISE NOTICE 'PASS 7: resolved with after-photo';
END $$;

-- 8. Client says NOT fixed -> In Progress, reopen_count 1 -------------------------
DO $$
DECLARE t public.ops_tickets%ROWTYPE; v_t UUID := pg_temp.ctx('t1'); v_res TEXT;
BEGIN
    -- someone who did not report the ticket cannot close/reopen it
    v_res := public.helpdesk_client_confirm(v_t, gen_random_uuid(), FALSE, NULL);
    IF v_res <> 'not_reporter' THEN RAISE EXCEPTION 'T8: stranger got %', v_res; END IF;

    v_res := public.helpdesk_client_confirm(v_t, pg_temp.ctx('contact'), FALSE, 'still dripping');
    IF v_res <> 'reopened' THEN RAISE EXCEPTION 'T8: confirm(no) returned %', v_res; END IF;
    SELECT * INTO t FROM public.ops_tickets WHERE id = v_t;
    IF t.status <> 'In Progress' OR t.reopen_count <> 1 OR t.resolved_at IS NOT NULL THEN
        RAISE EXCEPTION 'T8: after reopen status=% reopen_count=% resolved_at=%', t.status, t.reopen_count, t.resolved_at;
    END IF;
    PERFORM 1 FROM public.tasks WHERE ops_ticket_id = v_t AND status = 'In Progress';
    IF NOT FOUND THEN RAISE EXCEPTION 'T8: task not back to In Progress'; END IF;
    IF pg_temp.notifs(v_t, 'assignee', 'reopened') <> 1 OR pg_temp.notifs(v_t, 'managers', 'reopened') <> 1 THEN
        RAISE EXCEPTION 'T8: reopened notifications missing';
    END IF;
    PERFORM 1 FROM public.ticket_events e WHERE e.ticket_id = v_t AND e.event_type = 'reopened'
       AND e.actor_contact_id = pg_temp.ctx('contact') AND e.payload->>'comment' = 'still dripping';
    IF NOT FOUND THEN RAISE EXCEPTION 'T8: no reopened event'; END IF;
    RAISE NOTICE 'PASS 8: client "not fixed" reopened the ticket';
END $$;

-- 9. Resolve again (new photo), client says YES -> Closed --------------------------
DO $$
DECLARE t public.ops_tickets%ROWTYPE; v_t UUID := pg_temp.ctx('t1'); v_u UUID := pg_temp.ctx('sup'); v_res TEXT; n INT;
BEGIN
    PERFORM pg_temp.claims(v_u);
    SET LOCAL ROLE authenticated;
    PERFORM public.helpdesk_resolve_ticket(v_t, 'Replaced whole tap', ARRAY['proof/zz-hd3/t1-after-2.jpg']);
    RESET ROLE;
    PERFORM pg_temp.claims(NULL);

    v_res := public.helpdesk_client_confirm(v_t, pg_temp.ctx('contact'), TRUE, NULL);
    IF v_res <> 'closed' THEN RAISE EXCEPTION 'T9: confirm(yes) returned %', v_res; END IF;
    SELECT * INTO t FROM public.ops_tickets WHERE id = v_t;
    IF t.status <> 'Closed' OR t.client_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'T9: status=% client_confirmed_at=%', t.status, t.client_confirmed_at;
    END IF;
    PERFORM 1 FROM public.tasks WHERE ops_ticket_id = v_t AND status = 'Done';
    IF NOT FOUND THEN RAISE EXCEPTION 'T9: task not Done after close'; END IF;

    -- A second tap must not change anything (NB: it returns 'closed' again, see review notes)
    v_res := public.helpdesk_client_confirm(v_t, pg_temp.ctx('contact'), FALSE, NULL);
    SELECT COUNT(*) INTO n FROM public.ticket_events e WHERE e.ticket_id = v_t AND e.event_type = 'reopened';
    IF n <> 1 OR (SELECT status FROM public.ops_tickets WHERE id = v_t) <> 'Closed' THEN
        RAISE EXCEPTION 'T9: confirm on a Closed ticket changed it (result %)', v_res;
    END IF;
    RAISE NOTICE 'PASS 9: client "yes" closed the ticket';
END $$;

-- 10. helpdesk_tick() auto-closes a Resolved ticket after auto_close_hours ---------
DO $$
DECLARE r RECORD; v_u UUID := pg_temp.ctx('sup'); v_tick JSONB; v_status TEXT;
BEGIN
    SELECT * INTO r FROM pg_temp.report('Drain blocked', 'Plumbing', 'drain_blockage', '9');
    -- technician is punched out -> supervisor
    IF r.assigned_to_name IS DISTINCT FROM 'ZZ HD3 Supervisor' THEN
        RAISE EXCEPTION 'T10: new ticket after punch-out assigned to %', r.assigned_to_name;
    END IF;

    PERFORM pg_temp.claims(v_u);
    SET LOCAL ROLE authenticated;
    PERFORM public.helpdesk_resolve_ticket(r.ticket_id, 'Cleared', ARRAY['proof/zz-hd3/t2-after-1.jpg']);
    RESET ROLE;
    PERFORM pg_temp.claims(NULL);

    -- Not yet due: tick must leave it alone
    v_tick := public.helpdesk_tick();
    SELECT status INTO v_status FROM public.ops_tickets WHERE id = r.ticket_id;
    IF v_status <> 'Resolved' THEN RAISE EXCEPTION 'T10: closed too early (status %)', v_status; END IF;

    -- Backdate past auto_close_hours (24) -- not a status update, so the proof guard is not involved
    UPDATE public.ops_tickets SET resolved_at = NOW() - INTERVAL '25 hours' WHERE id = r.ticket_id;
    v_tick := public.helpdesk_tick();
    IF COALESCE((v_tick->>'auto_closed')::int, 0) < 1 THEN RAISE EXCEPTION 'T10: tick result %', v_tick; END IF;
    SELECT status INTO v_status FROM public.ops_tickets WHERE id = r.ticket_id;
    IF v_status <> 'Closed' THEN RAISE EXCEPTION 'T10: not auto-closed (status %)', v_status; END IF;
    PERFORM 1 FROM public.ticket_events e WHERE e.ticket_id = r.ticket_id AND e.event_type = 'auto_closed';
    IF NOT FOUND THEN RAISE EXCEPTION 'T10: no auto_closed event'; END IF;
    IF pg_temp.notifs(r.ticket_id, 'client', 'closed') <> 1 THEN RAISE EXCEPTION 'T10: no client/closed notification'; END IF;
    PERFORM 1 FROM public.tasks WHERE ops_ticket_id = r.ticket_id AND status = 'Done';
    IF NOT FOUND THEN RAISE EXCEPTION 'T10: task not Done after auto-close'; END IF;
    RAISE NOTICE 'PASS 10: helpdesk_tick auto-closed % (%)', r.ticket_number, v_tick;
END $$;

-- 11. Outbox claim marks rows processing and does not hand them out twice --------
DO $$
DECLARE n1 INT; n2 INT;
BEGIN
    SELECT COUNT(*) INTO n1 FROM public.helpdesk_claim_notifications(1000) c
     WHERE c.ticket_id IN (SELECT id FROM public.ops_tickets WHERE channel_site_id = pg_temp.ctx('site'));
    IF n1 = 0 THEN RAISE EXCEPTION 'T11: nothing claimed'; END IF;
    SELECT COUNT(*) INTO n2 FROM public.helpdesk_claim_notifications(1000) c
     WHERE c.ticket_id IN (SELECT id FROM public.ops_tickets WHERE channel_site_id = pg_temp.ctx('site'));
    IF n2 <> 0 THEN RAISE EXCEPTION 'T11: % rows claimed twice', n2; END IF;
    PERFORM 1 FROM public.ticket_notifications n
     WHERE n.ticket_id IN (SELECT id FROM public.ops_tickets WHERE channel_site_id = pg_temp.ctx('site'))
       AND (n.status <> 'processing' OR n.attempts <> 1);
    IF FOUND THEN RAISE EXCEPTION 'T11: claimed rows not processing/attempts=1'; END IF;
    RAISE NOTICE 'PASS 11: % notifications claimed once', n1;
END $$;

ROLLBACK;
