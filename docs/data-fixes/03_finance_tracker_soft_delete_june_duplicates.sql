-- =====================================================================
-- FIX 03 - site_finance_tracker: SOFT-delete duplicate June-2026 rows from the bad import
-- Generated 2026-11-26 from a READ-ONLY review of production (nothing has been executed).
-- WHY: the 2026-07-27 11:52 import wrote June 2026 rows twice (11:52:19 by Sinchana KM, 11:52:21 by Arpitha Nairy) with every column shifted one place to the left
--      (company_name holds the contract amount, contract_amount holds the fee, and so on). 14 sites have duplicate site+month rows (28 shifted rows; 10 of those sites also have a clean June row under their short name).
-- RULE (A) sites with a clean June row of the same contract (GK Ispat + 6 legal-name sites): BOTH shifted copies soft-deleted. (B) 3 sites whose clean row has a DIFFERENT contract: only the 2nd copy is deleted, the 1st is left for the owner. (C) 4 sites with no other row: 2nd copy deleted, 1st kept and repaired by 03b. 21 rows soft-deleted, 8 kept.
-- METHOD: SOFT delete only - sets deleted_at / deleted_by_name / deleted_reason (existing columns). No row is removed. Readers that filter deleted_at IS NULL stop seeing them.
-- NOTE: kept shifted rows: tier C is repaired by 03b; tier B is left for the owner (see docs/data-quality-fixes.md).
-- IDEMPOTENT: only rows with deleted_at IS NULL are updated.
-- OLD VALUES: deleted_at / deleted_by / deleted_by_name / deleted_reason were NULL on every row below.
-- =====================================================================

BEGIN;

UPDATE public.site_finance_tracker
SET deleted_at = now(),
    deleted_by_name = 'Data-quality review 2026-11-26',
    deleted_reason = 'Duplicate site+month row from the 2026-07-27 June-2026 bad import (shifted columns); kept row retained'
WHERE deleted_at IS NULL
  AND id IN (
    -- G K Ispat Pvt Ltd 2026-06-01 (Sinchana KM, upd 11:52:19): column-shifted import copy; a clean row exists
    'a9283ce1-39d6-4d2d-93be-b5c78aad9e27',
    -- G K Ispat Pvt Ltd 2026-06-01 (Arpitha Nairy, upd 11:52:21): column-shifted import copy; a clean row exists
    'b9562b90-32e7-4296-956c-6db0896651ed',
    -- Aikyam Rameshwaram Cafe 2026-06-01 (Arpitha Nairy, upd 11:52:21): exact duplicate of the kept row (same values, written 2 s later by a second user)
    'ed40b5c2-b854-43b8-8ccb-86c15ceb35ed',
    -- DSR Eden Greens Apartment Owners Association 2026-06-01 (Arpitha Nairy, upd 11:52:21): exact duplicate of the kept shifted row (same values, written 2 s later by a second user)
    'd08e50b2-cc53-4853-9eb1-6a4f12849ccf',
    -- Garden Mansion Apartment Owners Association 2026-06-01 (Arpitha Nairy, upd 11:52:21): exact duplicate of the kept row (same values, written 2 s later by a second user)
    '695147b2-f949-46ed-9e24-3b0411d1a4d8',
    -- H V Ventures Projects Pvt Ltd 2026-06-01 (Arpitha Nairy, upd 11:52:21): exact duplicate of the kept row (same values, written 2 s later by a second user)
    '0512b310-5e53-4c64-8a22-2fb54debdf2d',
    -- Hare Krishna Movement Bangalore 2026-06-01 (Sinchana KM, upd 11:52:19): duplicate of clean June row "Vrindhavan PG" (342c2941, same contract 27181) written under the legal name, columns shifted
    '9c48c5b6-4c99-452b-bbf3-0e1979ffe851',
    -- Hare Krishna Movement Bangalore 2026-06-01 (Arpitha Nairy, upd 11:52:21): duplicate of clean June row "Vrindhavan PG" (342c2941, same contract 27181) written under the legal name, columns shifted
    '0df03599-23d4-4578-b0e9-89a60f2606c2',
    -- Paradigm Intergrated Facility Services Pvt Ltd 2026-06-01 (Arpitha Nairy, upd 11:52:21): exact duplicate of the kept row (same values, written 2 s later by a second user)
    '3d939df8-eb85-4f16-b5e4-fee4b5bcc3c9',
    -- Realserve 2026-06-01 (Sinchana KM, upd 11:52:19): duplicate of clean June row "ARTISANE PROJECTS" (3bd5bb9c, same contract 216161) written under the legal name, columns shifted
    '304ea4d0-7214-4f0f-bedc-e70f88e74637',
    -- Realserve 2026-06-01 (Arpitha Nairy, upd 11:52:21): duplicate of clean June row "ARTISANE PROJECTS" (3bd5bb9c, same contract 216161) written under the legal name, columns shifted
    '07848035-bc94-4e25-80f8-689b50bac017',
    -- Sankirtan Seva Trust  V K Hill 2026-06-01 (Sinchana KM, upd 11:52:19): duplicate of clean June row "ISKCON Vaikunta Hill" (a80f359c, same contract 97401) written under the legal name, columns shifted
    '34800158-d93a-449d-aa11-0225acef9eac',
    -- Sankirtan Seva Trust  V K Hill 2026-06-01 (Arpitha Nairy, upd 11:52:21): duplicate of clean June row "ISKCON Vaikunta Hill" (a80f359c, same contract 97401) written under the legal name, columns shifted
    'bc37c9e0-7dcd-4360-9cc3-c9b847b36c7a',
    -- SNN Raj Spirictua Residence Welfare Association 2026-06-01 (Arpitha Nairy, upd 11:52:21): exact duplicate of the kept shifted row (same values, written 2 s later by a second user)
    'a911d2d6-bf36-4da1-afbb-be9ef5455fd3',
    -- Sri Venkateshwara Seva Trust 2026-06-01 (Sinchana KM, upd 11:52:19): duplicate of clean June row "ISKCON - TTD" (d55778ed, same contract 41299) written under the legal name, columns shifted
    '9297b010-afbe-4992-aa21-9144d8c4e1ac',
    -- Sri Venkateshwara Seva Trust 2026-06-01 (Arpitha Nairy, upd 11:52:21): duplicate of clean June row "ISKCON - TTD" (d55778ed, same contract 41299) written under the legal name, columns shifted
    '96a963d5-8c09-4e82-8a05-d07b02b89325',
    -- SV Garndur Apartment Co Operative society Ltd 2026-06-01 (Sinchana KM, upd 11:52:19): duplicate of clean June row "SV Grandur" (e94186c6, same contract 248920) written under the legal name, columns shifted
    '4b7f2227-51b8-416e-9385-8efe44447a2c',
    -- SV Garndur Apartment Co Operative society Ltd 2026-06-01 (Arpitha Nairy, upd 11:52:21): duplicate of clean June row "SV Grandur" (e94186c6, same contract 248920) written under the legal name, columns shifted
    '1bbb28ef-33f8-4875-bb57-f3247030929e',
    -- Trands Indus Residents Association 2026-06-01 (Sinchana KM, upd 11:52:19): duplicate of clean June row "Trans Indus" (17598fd4, same contract 179222) written under the legal name, columns shifted
    'c311076c-fc16-4576-9944-ee4f0a4bf075',
    -- Trands Indus Residents Association 2026-06-01 (Arpitha Nairy, upd 11:52:21): duplicate of clean June row "Trans Indus" (17598fd4, same contract 179222) written under the legal name, columns shifted
    '9920ec19-e5c5-44de-8762-26390b2441bc',
    -- Urban Greens Villa Owners Wefare Association 2026-06-01 (Arpitha Nairy, upd 11:52:21): exact duplicate of the kept shifted row (same values, written 2 s later by a second user)
    '0d692f44-3c91-44c2-b087-208917b4622c'
  );

COMMIT;

-- KEPT rows (for reference):
--   67f1ae32-3770-4306-84d2-522742b9a0ff  GK ISPAT PVT LTD 2026-06-01: only non-corrupted row (company_name is text, amounts line up); approved
--   0d38cea8-3dbd-406c-971f-78eaa072590b  Aikyam Rameshwaram Cafe 2026-06-01: only June row for this site (no clean row, no organisation match); first copy of the import; column-shifted -> repaired by 03b
--   e1136426-13cc-4d9b-8762-cd86cf55ff10  DSR Eden Greens Apartment Owners Association 2026-06-01: REVIEW: clean June row "DSR Eden Greens" exists with a different contract (253358 vs shifted 232812); kept untouched for the owner to decide (probably delete)
--   0e5b9fd2-a675-46a4-80fd-baa843a3d3b8  Garden Mansion Apartment Owners Association 2026-06-01: only June row for this site (no clean row, no organisation match); first copy of the import; column-shifted -> repaired by 03b
--   bb745a2f-af8c-4760-baa0-e451252f192d  H V Ventures Projects Pvt Ltd 2026-06-01: only June row for this site (no clean row, no organisation match); first copy of the import; column-shifted -> repaired by 03b
--   cb0530c1-e4ee-458d-8291-78bf9bf93929  Paradigm Intergrated Facility Services Pvt Ltd 2026-06-01: only June row for this site (no clean row, no organisation match); first copy of the import; column-shifted -> repaired by 03b
--   f0d77ced-e4c5-42fc-b614-0444330275c2  SNN Raj Spirictua Residence Welfare Association 2026-06-01: REVIEW: clean June row "SNN Spiritua Project" exists with a different contract (188449 vs shifted 145036); kept untouched for the owner to decide (probably delete)
--   a17e6ff4-3721-4cb5-a13c-995c8e13b81a  Urban Greens Villa Owners Wefare Association 2026-06-01: REVIEW: clean June row "Urban Greens" exists with a different contract (154588 vs shifted 168000); kept untouched for the owner to decide (probably delete)

-- ---------------------------------------------------------------------
-- ROLLBACK (manual). Old values: deleted_at = NULL, deleted_by = NULL, deleted_by_name = NULL, deleted_reason = NULL.
-- BEGIN;
-- UPDATE public.site_finance_tracker SET deleted_at = NULL, deleted_by = NULL, deleted_by_name = NULL, deleted_reason = NULL
-- WHERE deleted_by_name = 'Data-quality review 2026-11-26' AND id IN (
--   'a9283ce1-39d6-4d2d-93be-b5c78aad9e27',
--   'b9562b90-32e7-4296-956c-6db0896651ed',
--   'ed40b5c2-b854-43b8-8ccb-86c15ceb35ed',
--   'd08e50b2-cc53-4853-9eb1-6a4f12849ccf',
--   '695147b2-f949-46ed-9e24-3b0411d1a4d8',
--   '0512b310-5e53-4c64-8a22-2fb54debdf2d',
--   '9c48c5b6-4c99-452b-bbf3-0e1979ffe851',
--   '0df03599-23d4-4578-b0e9-89a60f2606c2',
--   '3d939df8-eb85-4f16-b5e4-fee4b5bcc3c9',
--   '304ea4d0-7214-4f0f-bedc-e70f88e74637',
--   '07848035-bc94-4e25-80f8-689b50bac017',
--   '34800158-d93a-449d-aa11-0225acef9eac',
--   'bc37c9e0-7dcd-4360-9cc3-c9b847b36c7a',
--   'a911d2d6-bf36-4da1-afbb-be9ef5455fd3',
--   '9297b010-afbe-4992-aa21-9144d8c4e1ac',
--   '96a963d5-8c09-4e82-8a05-d07b02b89325',
--   '4b7f2227-51b8-416e-9385-8efe44447a2c',
--   '1bbb28ef-33f8-4875-bb57-f3247030929e',
--   'c311076c-fc16-4576-9944-ee4f0a4bf075',
--   '9920ec19-e5c5-44de-8762-26390b2441bc',
--   '0d692f44-3c91-44c2-b087-208917b4622c'
-- );
-- COMMIT;
