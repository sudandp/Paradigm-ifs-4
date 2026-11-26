-- =====================================================================
-- FIX 03b - site_finance_tracker: repair the kept column-shifted June-2026 rows (OPTIONAL, needs finance sign-off)
-- Generated 2026-11-26 from a READ-ONLY review of production (nothing has been executed).
-- WHY: after FIX 03 the kept row of each bad-import site still has its values one column to the left:
--      company_name <- contract_amount, contract_amount <- contract_management_fee, contract_management_fee <- billed_amount,
--      billed_amount <- billed_management_fee, billed_management_fee <- (total). Verified for every row below: shifted billed_management_fee = shifted contract_management_fee + shifted billed_amount (the original total = billed + fee), so the shift is certain.
-- TOUCHES: 4 rows. company_name is restored from the same site's other months / invoice tracker when a single value exists (4 of 4); otherwise it is set to NULL.
-- total_billed_amount is recomputed only when the column is a plain (non-generated) column; if it is GENERATED it recomputes by itself.
-- IDEMPOTENT: each row is only updated while company_name is still numeric (i.e. still shifted).
-- OLD VALUES: kept in the ROLLBACK block.
-- =====================================================================

BEGIN;

UPDATE public.site_finance_tracker t
SET company_name = v.company_name,
    contract_amount = v.contract_amount,
    contract_management_fee = v.contract_management_fee,
    billed_amount = v.billed_amount,
    billed_management_fee = v.billed_management_fee
FROM (VALUES
  -- Aikyam Rameshwaram Cafe
  ('0d38cea8-3dbd-406c-971f-78eaa072590b'::uuid, 'Southwall Security LLP', 280736::numeric, 28074::numeric, 245266::numeric, 24527::numeric),
  -- Garden Mansion Apartment Owners Association
  ('0e5b9fd2-a675-46a4-80fd-baa843a3d3b8'::uuid, 'Southwall Security LLP', 150445::numeric, 15044::numeric, 135188::numeric, 13518.8::numeric),
  -- H V Ventures Projects Pvt Ltd
  ('bb745a2f-af8c-4760-baa0-e451252f192d'::uuid, 'Southwall Security LLP', 192312::numeric, 14423::numeric, 122218::numeric, 9167::numeric),
  -- Paradigm Intergrated Facility Services Pvt Ltd
  ('cb0530c1-e4ee-458d-8291-78bf9bf93929'::uuid, 'Southwall Security LLP', 214830::numeric, 38871::numeric, 214830::numeric, 14464::numeric)
) AS v(id, company_name, contract_amount, contract_management_fee, billed_amount, billed_management_fee)
WHERE t.id = v.id
  AND t.deleted_at IS NULL
  AND t.company_name ~ '^[0-9.,[:space:]]+$';

DO $$
BEGIN
  IF (SELECT is_generated FROM information_schema.columns WHERE table_schema='public' AND table_name='site_finance_tracker' AND column_name='total_billed_amount') = 'NEVER' THEN
    UPDATE public.site_finance_tracker
    SET total_billed_amount = billed_amount + billed_management_fee
    WHERE id IN ('0d38cea8-3dbd-406c-971f-78eaa072590b', '0e5b9fd2-a675-46a4-80fd-baa843a3d3b8', 'bb745a2f-af8c-4760-baa0-e451252f192d', 'cb0530c1-e4ee-458d-8291-78bf9bf93929');
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- ROLLBACK (manual). Restores the shifted values exactly as found.
-- Columns: id, company_name, contract_amount, contract_management_fee, billed_amount, billed_management_fee, total_billed_amount
-- BEGIN;
-- UPDATE public.site_finance_tracker t SET company_name = v.company_name, contract_amount = v.ca, contract_management_fee = v.cmf, billed_amount = v.ba, billed_management_fee = v.bmf
-- FROM (VALUES
--   -- Aikyam Rameshwaram Cafe: old total_billed_amount 294320
--   ('0d38cea8-3dbd-406c-971f-78eaa072590b'::uuid, '280736', 28074::numeric, 245266::numeric, 24527::numeric, 269793::numeric),
--   -- Garden Mansion Apartment Owners Association: old total_billed_amount 162225.6
--   ('0e5b9fd2-a675-46a4-80fd-baa843a3d3b8'::uuid, '150445', 15044::numeric, 135188::numeric, 13518.8::numeric, 148706.8::numeric),
--   -- H V Ventures Projects Pvt Ltd: old total_billed_amount 140552
--   ('bb745a2f-af8c-4760-baa0-e451252f192d'::uuid, '192312', 14423::numeric, 122218::numeric, 9167::numeric, 131385::numeric),
--   -- Paradigm Intergrated Facility Services Pvt Ltd: old total_billed_amount 243758
--   ('cb0530c1-e4ee-458d-8291-78bf9bf93929'::uuid, '214830', 38871::numeric, 214830::numeric, 14464::numeric, 229294::numeric)
-- ) AS v(id, company_name, ca, cmf, ba, bmf) WHERE t.id = v.id;
-- -- (if total_billed_amount is a plain column, also restore it from the comments above)
-- COMMIT;
