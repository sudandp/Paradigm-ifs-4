-- =====================================================================
-- FIX 04 - site_responsibility_matrix: add ops_manager_id for name-only "SANDEEP" rows
-- Generated 2026-11-26 from a READ-ONLY review of production (nothing has been executed).
-- WHY: 16 matrix rows have ops_manager_name but ops_manager_id IS NULL, so id-based scoping ("my sites") ignores them. 14 say "SANDEEP"; exactly one active user is named Sandeep (Sandeep B, operation_manager) and he already owns 91 other rows by id.
-- NOT INCLUDED: "PRADEEP / ISAAC" (Nikoo Homes - two people) and "UNASSIGNED" (Sunny Grove).
-- TOUCHES: ops_manager_id only (ops_manager_name left as typed). IDEMPOTENT: only rows with ops_manager_id IS NULL.
-- OLD VALUES: ops_manager_id was NULL on every row below.
-- =====================================================================

BEGIN;

UPDATE public.site_responsibility_matrix
SET ops_manager_id = '04364421-22db-44e2-b1f1-08bcebc3d562'::uuid   -- Sandeep B
WHERE ops_manager_id IS NULL
  AND upper(btrim(ops_manager_name)) = 'SANDEEP'
  AND id IN (
    'bafb1c3d-c4be-402f-a858-850a169d9eab',
    '8a4d3333-c81c-49dc-afc7-a3fba53b97d3',
    '5abd9207-898d-44e0-a9f9-a37bb83f4dbc',
    '3b20e7f3-ba43-4f0d-b7b1-8a34f8ce28fb',
    'fd88e03c-6268-4788-96e4-e4d7e771bd15',
    '158a082f-c741-44be-98b7-e95956cf0efd',
    '30355074-9289-4679-906d-09b35fcdfe21',
    '3c7eb9e4-7d78-40f3-865b-f79b0cd2b90f',
    '195987ee-e64a-4089-b44d-513fb8aeb6a6',
    '8a347902-c622-4747-bf66-db0124f9b538',
    '932976ac-fcf0-49c4-87e1-87639373c88f',
    'e598b805-e11c-46e2-bc56-800f4ac7fba9',
    '7d1036e0-de81-4d8c-b300-ec42dea2ef09',
    '1c230293-39b4-4e41-b428-dda3375bc02b'
  );

COMMIT;

-- Rows covered: Artisane Forest Breeze; BLUE WATERS BY SJR PRIME CORP; Mahendra Aarna; 42 Estate Queens Square; Shriram Smrithi; THE PROMONT HOUSING; DSR Woodwinds; Shriram Signiaa; Serene - Brigade Cornerstone Utopia; NVT Vaksana; SNN Raj Lakeview; Janhavi Shelters; National Public School (Sarjapur); DSR Eden Greens

-- ---------------------------------------------------------------------
-- ROLLBACK (manual). Old value of ops_manager_id = NULL.
-- BEGIN;
-- UPDATE public.site_responsibility_matrix SET ops_manager_id = NULL
-- WHERE ops_manager_id = '04364421-22db-44e2-b1f1-08bcebc3d562'::uuid AND upper(btrim(ops_manager_name)) = 'SANDEEP' AND id IN (
--   'bafb1c3d-c4be-402f-a858-850a169d9eab',
--   '8a4d3333-c81c-49dc-afc7-a3fba53b97d3',
--   '5abd9207-898d-44e0-a9f9-a37bb83f4dbc',
--   '3b20e7f3-ba43-4f0d-b7b1-8a34f8ce28fb',
--   'fd88e03c-6268-4788-96e4-e4d7e771bd15',
--   '158a082f-c741-44be-98b7-e95956cf0efd',
--   '30355074-9289-4679-906d-09b35fcdfe21',
--   '3c7eb9e4-7d78-40f3-865b-f79b0cd2b90f',
--   '195987ee-e64a-4089-b44d-513fb8aeb6a6',
--   '8a347902-c622-4747-bf66-db0124f9b538',
--   '932976ac-fcf0-49c4-87e1-87639373c88f',
--   'e598b805-e11c-46e2-bc56-800f4ac7fba9',
--   '7d1036e0-de81-4d8c-b300-ec42dea2ef09',
--   '1c230293-39b4-4e41-b428-dda3375bc02b'
-- );
-- COMMIT;
