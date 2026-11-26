-- ============================================================================
-- Test: public.helpdesk_ingest_issue()  (create-or-merge duplicate tickets)
--
-- Self-contained; everything is rolled back. Run as postgres (or another role that
-- can INSERT into channel_sites / channel_contacts / ops_tickets and EXECUTE the RPC):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/helpdesk_ingest_issue_test.sql
--   (or paste into the Supabase SQL editor)
-- channel_sites.entity_id / location_id are nullable, so no entities/locations rows are needed.
-- Any failed assertion raises an exception and aborts the transaction.
-- ============================================================================
BEGIN;

CREATE TEMP TABLE _ctx (k TEXT PRIMARY KEY, v UUID) ON COMMIT DROP;

-- Fixtures -------------------------------------------------------------------
WITH s AS (
    INSERT INTO public.channel_sites (site_code, display_name, dedupe_window_hours, auto_priority_bump_reporters)
    VALUES ('ZZ_TEST_SITE', 'Helpdesk RPC test site', 72, 3)
    RETURNING id
)
INSERT INTO _ctx SELECT 'site', id FROM s;

WITH c AS (
    INSERT INTO public.channel_contacts (channel, sender_id, phone, display_name)
    VALUES ('whatsapp', '910000000001', '+910000000001', 'Test Reporter A'),
           ('whatsapp', '910000000002', '+910000000002', 'Test Reporter B'),
           ('whatsapp', '910000000003', '+910000000003', 'Test Reporter C')
    RETURNING id, display_name
)
INSERT INTO _ctx SELECT CASE display_name WHEN 'Test Reporter A' THEN 'a'
                                          WHEN 'Test Reporter B' THEN 'b' ELSE 'c' END, id FROM c;

-- Helper: report "drain blocked, tower T1, floor <floor>" from contact <who>
CREATE OR REPLACE FUNCTION pg_temp.report(p_who TEXT, p_floor TEXT DEFAULT '1')
RETURNS TABLE (ticket_id UUID, is_duplicate BOOLEAN, report_count INT, priority TEXT, ticket_number TEXT)
LANGUAGE sql AS $$
    SELECT r.ticket_id, r.is_duplicate, r.report_count, r.priority, r.ticket_number
    FROM public.helpdesk_ingest_issue(
        (SELECT v FROM _ctx WHERE k = 'site'),
        (SELECT v FROM _ctx WHERE k = p_who),
        NULL,                       -- p_inbound_message_id
        'Drain Blockage',
        'water clogged on tower 1 first floor',
        'Plumbing',
        'P3',
        'drain_blockage',
        't1',                       -- lower-case on purpose: RPC upper-cases
        p_floor,
        NULL,
        0.6
    ) r;
$$;

-- 1. First report creates a ticket ------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
    SELECT * INTO r FROM pg_temp.report('a');
    IF r.ticket_id IS NULL THEN RAISE EXCEPTION 'T1: no ticket returned'; END IF;
    IF r.is_duplicate THEN RAISE EXCEPTION 'T1: first report flagged duplicate'; END IF;
    IF r.report_count <> 1 THEN RAISE EXCEPTION 'T1: report_count=% (expected 1)', r.report_count; END IF;
    IF r.priority <> 'P3' THEN RAISE EXCEPTION 'T1: priority=% (expected P3)', r.priority; END IF;
    IF r.ticket_number !~ '^TKT-\d{4}-\d{5}$' THEN RAISE EXCEPTION 'T1: bad ticket_number %', r.ticket_number; END IF;
    PERFORM 1 FROM public.ops_tickets t
     WHERE t.id = r.ticket_id AND t.tower = 'T1' AND t.floor = '1' AND t.status = 'Open'
       AND t.issue_type = 'drain_blockage' AND t.source_channel = 'whatsapp'
       AND t.reported_by_name = 'Test Reporter A';
    IF NOT FOUND THEN RAISE EXCEPTION 'T1: ticket row columns not as expected'; END IF;
    PERFORM 1 FROM public.ticket_events e WHERE e.ticket_id = r.ticket_id AND e.event_type = 'created';
    IF NOT FOUND THEN RAISE EXCEPTION 'T1: no "created" event'; END IF;
    INSERT INTO _ctx VALUES ('t1', r.ticket_id);
    RAISE NOTICE 'PASS 1: first report created %', r.ticket_number;
END $$;

-- 2. Same site/category/tower/floor/issue_type from another contact -> merged
DO $$
DECLARE r RECORD;
BEGIN
    SELECT * INTO r FROM pg_temp.report('b');
    IF r.ticket_id <> (SELECT v FROM _ctx WHERE k = 't1') THEN RAISE EXCEPTION 'T2: not merged into first ticket'; END IF;
    IF NOT r.is_duplicate THEN RAISE EXCEPTION 'T2: is_duplicate=false'; END IF;
    IF r.report_count <> 2 THEN RAISE EXCEPTION 'T2: report_count=% (expected 2)', r.report_count; END IF;
    IF (SELECT count(*) FROM public.ticket_reporters tr WHERE tr.ticket_id = r.ticket_id) <> 2 THEN
        RAISE EXCEPTION 'T2: expected 2 ticket_reporters rows';
    END IF;
    RAISE NOTICE 'PASS 2: second reporter merged, report_count=2';
END $$;

-- 3. Same contact again -> still a duplicate, report_count unchanged --------
DO $$
DECLARE r RECORD;
BEGIN
    SELECT * INTO r FROM pg_temp.report('b');
    IF r.ticket_id <> (SELECT v FROM _ctx WHERE k = 't1') OR NOT r.is_duplicate THEN
        RAISE EXCEPTION 'T3: repeat report not merged';
    END IF;
    IF r.report_count <> 2 THEN RAISE EXCEPTION 'T3: report_count=% (expected 2)', r.report_count; END IF;
    IF (SELECT count(*) FROM public.ticket_events e
         WHERE e.ticket_id = r.ticket_id AND e.event_type = 'duplicate_report') <> 2 THEN
        RAISE EXCEPTION 'T3: expected 2 duplicate_report events';
    END IF;
    RAISE NOTICE 'PASS 3: repeat reporter does not bump report_count';
END $$;

-- 4. Different floor -> new ticket ------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
    SELECT * INTO r FROM pg_temp.report('b', '2');
    IF r.is_duplicate THEN RAISE EXCEPTION 'T4: different floor merged'; END IF;
    IF r.ticket_id = (SELECT v FROM _ctx WHERE k = 't1') THEN RAISE EXCEPTION 'T4: same ticket id'; END IF;
    IF r.report_count <> 1 THEN RAISE EXCEPTION 'T4: report_count=%', r.report_count; END IF;
    RAISE NOTICE 'PASS 4: different floor creates a new ticket';
END $$;

-- 5. Third distinct reporter bumps P3 -> P2 (auto_priority_bump_reporters = 3)
DO $$
DECLARE r RECORD;
BEGIN
    SELECT * INTO r FROM pg_temp.report('c');
    IF r.ticket_id <> (SELECT v FROM _ctx WHERE k = 't1') OR NOT r.is_duplicate THEN
        RAISE EXCEPTION 'T5: third reporter not merged';
    END IF;
    IF r.report_count <> 3 THEN RAISE EXCEPTION 'T5: report_count=% (expected 3)', r.report_count; END IF;
    IF r.priority <> 'P2' THEN RAISE EXCEPTION 'T5: returned priority=% (expected P2)', r.priority; END IF;
    IF (SELECT t.priority FROM public.ops_tickets t WHERE t.id = r.ticket_id) <> 'P2' THEN
        RAISE EXCEPTION 'T5: stored priority not P2';
    END IF;
    PERFORM 1 FROM public.ticket_events e
     WHERE e.ticket_id = r.ticket_id AND e.event_type = 'priority_bumped' AND e.payload->>'from' = 'P3';
    IF NOT FOUND THEN RAISE EXCEPTION 'T5: no priority_bumped event'; END IF;
    RAISE NOTICE 'PASS 5: 3rd distinct reporter bumped P3 -> P2';
END $$;

-- 6. Closed ticket is not merged into --------------------------------------
DO $$
DECLARE r RECORD; v_closed UUID := (SELECT v FROM _ctx WHERE k = 't1');
BEGIN
    UPDATE public.ops_tickets SET status = 'Closed' WHERE id = v_closed;
    SELECT * INTO r FROM pg_temp.report('a');
    IF r.is_duplicate THEN RAISE EXCEPTION 'T6: merged into a closed ticket'; END IF;
    IF r.ticket_id = v_closed THEN RAISE EXCEPTION 'T6: returned the closed ticket'; END IF;
    IF r.report_count <> 1 OR r.priority <> 'P3' THEN
        RAISE EXCEPTION 'T6: new ticket has report_count=% priority=%', r.report_count, r.priority;
    END IF;
    RAISE NOTICE 'PASS 6: closed ticket not reused; new ticket %', r.ticket_number;
END $$;

DO $$ BEGIN RAISE NOTICE 'helpdesk_ingest_issue: ALL 6 CHECKS PASSED (rolling back)'; END $$;

ROLLBACK;
