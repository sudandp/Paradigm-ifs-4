-- =====================================================================
-- FIX 07 - site_responsibility_matrix.takeover_date: clear impossible FUTURE dates (OPTIONAL)
-- Generated 2026-11-26 from a READ-ONLY review of production (nothing has been executed).
-- WHY: 69 matrix rows carry a takeover_date after today (2027-01-01 ... 2032-08-01, one site per month in sequence - a placeholder series from the import, not real dates). This includes Nikoo Homes 1/2/4 (2028).
--      Only the 7 of those sites that already have billing rows (finance/invoice tracker) or attendance in the last 60 days are listed: a site cannot be billed or staffed before its takeover.
--      Result is NULL (= unknown) rather than a guess; the owner should enter real dates afterwards (data entry).
-- IDEMPOTENT: only rows whose takeover_date is still in the future are updated.
-- OLD VALUES: kept in the ROLLBACK block.
-- FIX (2026-11-26): Added explicit ::date cast in WHERE clause.
--   Root cause: seed data inserted takeover_date values as TEXT literals into the
--   site_responsibility_matrix table. Even though the DDL declares the column as DATE,
--   Supabase / PostgreSQL stored the imported values as text in some rows, causing the
--   "operator does not exist: text > date" error when comparing with a DATE literal.
--   The ::date cast on the left-hand side coerces those text values to date at query time.
--   Long-term fix: run ALTER TABLE public.site_responsibility_matrix
--     ALTER COLUMN takeover_date TYPE DATE USING takeover_date::date;
--   after this script to enforce the type uniformly.
-- =====================================================================

BEGIN;

UPDATE public.site_responsibility_matrix
SET takeover_date = NULL
-- FIX: cast takeover_date to DATE explicitly to handle rows where the seed
-- import stored ISO-8601 text strings ('2028-06-01') instead of native DATE values.
-- CURRENT_DATE is used instead of a hard-coded date so the script stays idempotent
-- when re-run on future dates.
WHERE takeover_date::date > CURRENT_DATE
  AND id IN (
    -- Prestige Falcon City (was 2028-06-01)
    'f8f2a4ad-7c44-4ae4-ad9d-bfaa82175b98'::uuid,
    -- Phoenix One Bangalore West (was 2028-05-01)
    '811116ec-7571-462d-ad3b-2db830d5cd06'::uuid,
    -- Prestige Park Square (was 2028-09-01)
    '891aca8d-2475-4c0a-bec5-93955d485078'::uuid,
    -- Prestige Tranquility (was 2028-11-01)
    '688ac115-299d-4123-afe9-16a778f98fa2'::uuid,
    -- Purva Atmosphere (was 2028-12-01)
    '2f3252ad-ad76-44d2-91e3-860f3bbc3cb6'::uuid,
    -- Nikoo Homes 1 (was 2028-02-01)
    '43dc4730-45ab-4dd4-b69a-f64e5de61d67'::uuid,
    -- Sobha Silicon Oasis (was 2031-02-01)
    '50e737b9-5dec-4b48-9415-84ee2ab69591'::uuid
  );

COMMIT;

-- ---------------------------------------------------------------------
-- OPTIONAL FOLLOW-UP: enforce the DATE type at the storage level so this
-- cast is never needed again. Run this separately after verifying FIX 07 above.
-- BEGIN;
-- ALTER TABLE public.site_responsibility_matrix
--   ALTER COLUMN takeover_date TYPE DATE USING takeover_date::date;
-- COMMIT;

-- ---------------------------------------------------------------------
-- ROLLBACK (manual): restores the old placeholder dates.
-- BEGIN;
-- UPDATE public.site_responsibility_matrix m SET takeover_date = v.d::date
-- FROM (VALUES
--   ('f8f2a4ad-7c44-4ae4-ad9d-bfaa82175b98'::uuid, '2028-06-01'),
--   ('811116ec-7571-462d-ad3b-2db830d5cd06'::uuid, '2028-05-01'),
--   ('891aca8d-2475-4c0a-bec5-93955d485078'::uuid, '2028-09-01'),
--   ('688ac115-299d-4123-afe9-16a778f98fa2'::uuid, '2028-11-01'),
--   ('2f3252ad-ad76-44d2-91e3-860f3bbc3cb6'::uuid, '2028-12-01'),
--   ('43dc4730-45ab-4dd4-b69a-f64e5de61d67'::uuid, '2028-02-01'),
--   ('50e737b9-5dec-4b48-9415-84ee2ab69591'::uuid, '2031-02-01')
-- ) AS v(id, d) WHERE m.id = v.id AND m.takeover_date IS NULL;
-- COMMIT;
