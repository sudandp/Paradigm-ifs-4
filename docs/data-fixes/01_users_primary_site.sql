-- =====================================================================
-- FIX 01 - users: primary site per user (HIGH confidence only)
-- Generated 2026-11-26 from a READ-ONLY review of production (nothing has been executed).
-- WHY: users.location_id is NOT a site. In production it is a TEXT foreign key to organization_groups.id, which holds exactly one row
--      ('group_1774003567612' = 'AP Group'). 116 users carry it, 27 are NULL. It cannot hold a site, and the app reads it as the company group,
--      so DO NOT overwrite it. This script ADDS a new nullable column users.primary_site_id (FK organizations.id, the canonical site key) and
--      fills it for the 7 users whose site is certain. All other users stay NULL (see docs/data-quality-fixes.md, manual review list).
-- TOUCHES: ADD COLUMN (additive, idempotent) + UPDATE of 7 rows. users.location_id is NOT modified.
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS; UPDATE only where value differs.
-- OLD VALUES: primary_site_id is a new column, so every old value is NULL.
-- =====================================================================

BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS primary_site_id TEXT REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_primary_site_id ON public.users(primary_site_id);
COMMENT ON COLUMN public.users.primary_site_id IS 'Canonical primary client site (organizations.id). NULL = roving / office / unknown. Added by data-quality fix 01.';

UPDATE public.users u
SET primary_site_id = v.site_id
FROM (VALUES
  -- Rinju  P  R (Ops Technical) (field_staff): 47 of 58 site-mapped punches (81%) in last 60d at Sobha Chrysanthemum geofences; also in user_locations
  ('f632fc1b-ccfe-4424-946c-670f24582764'::uuid, 'sobha_chrysanthemum'),
  -- I Tower Softservice Executive Paradigm (unverified): client-site account: name "I Tower Softservice Executive", email itowersoftservice.paradigm@
  ('f7c59f4e-342a-4104-8175-20892f4ceee2'::uuid, 'kolte_patil_i_towers'),
  -- Estate Manager Woodwinds (Paradigm Services ) (unverified): client-site account: name "Estate Manager Woodwinds", email ww@paradigmfms.com
  ('f363a8ab-bff9-4948-844a-59fab7ba8067'::uuid, 'dsr_woodwinds'),
  -- Prashanth (unverified): client-site account: email euphoria.afm1@paradigmfms.com
  ('bd182f49-c97a-4d43-a9e0-f61e5b842c43'::uuid, 'ahad_euphoria'),
  -- Naveen Kumar S T  (unverified): client-site account: email alanoville.estatemanager@
  ('b101d1ab-67af-441d-a55d-9808ca9c1dfb'::uuid, 'alanoville_haryana_goyal_co'),
  -- Sark 2 PM (unverified): client-site account: name "Sark 2 PM", email sark2pm@ (organisation sark_two exists; sark3 is a different org)
  ('c83d40af-0852-4d9c-bfaf-69012a0075c1'::uuid, 'sark_two'),
  -- Fortune 1 FM (site_manager): client-site account: name "Fortune 1 FM", email fortune1fm.paradigmfms@
  ('7575fedd-e537-4f5c-a699-ab5f2f5dd333'::uuid, 'fortune_one_flat_owners_wmma_cooperative_society_l')
) AS v(id, site_id)
WHERE u.id = v.id
  AND u.primary_site_id IS DISTINCT FROM v.site_id;

COMMIT;

-- ---------------------------------------------------------------------
-- ROLLBACK (run manually if needed). Old value of primary_site_id for all rows above = NULL.
-- BEGIN;
-- UPDATE public.users SET primary_site_id = NULL WHERE id IN (
--   'f632fc1b-ccfe-4424-946c-670f24582764',
--   'f7c59f4e-342a-4104-8175-20892f4ceee2',
--   'f363a8ab-bff9-4948-844a-59fab7ba8067',
--   'bd182f49-c97a-4d43-a9e0-f61e5b842c43',
--   'b101d1ab-67af-441d-a55d-9808ca9c1dfb',
--   'c83d40af-0852-4d9c-bfaf-69012a0075c1',
--   '7575fedd-e537-4f5c-a699-ab5f2f5dd333'
-- );
-- -- Only if the column should be removed completely:
-- -- DROP INDEX IF EXISTS public.idx_users_primary_site_id; ALTER TABLE public.users DROP COLUMN IF EXISTS primary_site_id;
-- COMMIT;
