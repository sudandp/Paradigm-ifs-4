-- ===========================================================================
-- PARADIGM IFS: BULK UPDATE DATE OF BIRTH FOR ALL EMPLOYEES (BO List.xlsx)
-- Generated on: 2026-11-04 20:54:04
-- Total Matched Employees: 56
-- ===========================================================================

BEGIN;

-- [01] Alen Dsouza (Ref: MS-748)
UPDATE public.users
SET date_of_birth = '2003-06-24'::DATE, updated_at = NOW()
WHERE id = '5c0e5041-aead-43b3-9d14-316c5e56a66b' OR
      email = 'alendsouza19@gmail.com' OR
      biometric_id = 'MS-748';

-- [02] Anil  (Ref: MS-686)
UPDATE public.users
SET date_of_birth = '2001-05-15'::DATE, updated_at = NOW()
WHERE id = 'd360ab98-6198-4e00-8efb-db7be5b50668' OR
      email = 'anil.foe@paradigmfms.com' OR
      biometric_id = 'MS-686';

-- [03] Anup Noronha.s (Ref: MS-761)
UPDATE public.users
SET date_of_birth = '1972-04-09'::DATE, updated_at = NOW()
WHERE id = '8f7282e6-e334-48e4-aab4-31d78272ad63' OR
      email = 'noronhasanup@gmail.com' OR
      biometric_id = 'MS-761';

-- [04] Arpitha Nairy (Ref: MS-538)
UPDATE public.users
SET date_of_birth = '2002-01-24'::DATE, updated_at = NOW()
WHERE id = '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27' OR
      email = 'arpitha@paradigmfms.com' OR
      biometric_id = 'MS-538';

-- [05] Arun Kumar A V (Ref: MS-730)
UPDATE public.users
SET date_of_birth = '2000-07-20'::DATE, updated_at = NOW()
WHERE id = '75b2a180-4d5f-413d-b898-1de4a4354f21' OR
      email = 'landscaping.foe@paradigmfms.com' OR
      biometric_id = 'MS-730';

-- [06] Basavaraj HB - Senior Manager Landscaping  (Ref: MS-656)
UPDATE public.users
SET date_of_birth = '1975-07-22'::DATE, updated_at = NOW()
WHERE id = '60d6abab-ef16-4deb-81a5-ebf4ad3a84bf' OR
      email = 'basavaraj@paradigmfms.com' OR
      biometric_id = 'MS-656';

-- [07] Bhaskar A (Ref: MS-08)
UPDATE public.users
SET date_of_birth = '2004-01-21'::DATE, updated_at = NOW()
WHERE id = '1429a5ac-790a-454a-9fc8-d1b5a9895996' OR
      email = 'southwall.hr@paradigmfms.com' OR
      biometric_id = 'MS-08';

-- [08] Bhimas Bora (Ref: SW-FOE-17)
UPDATE public.users
SET date_of_birth = '1998-04-14'::DATE, updated_at = NOW()
WHERE id = '6b5daefa-4af9-42dc-9e34-452b8a285823' OR
      email = 'borabhimas12@gmail.com' OR
      biometric_id = 'SW-FOE-17';

-- [09] Chandana R (Ref: MS-757)
UPDATE public.users
SET date_of_birth = '2002-07-31'::DATE, updated_at = NOW()
WHERE id = 'bbcbb70e-9c52-46c3-96e9-8e89155e35bd' OR
      email = 'onboarding@paradigmfms.com' OR
      biometric_id = 'MS-757';

-- [10] Chennamma (Ref: MS-639)
UPDATE public.users
SET date_of_birth = '1999-04-05'::DATE, updated_at = NOW()
WHERE id = 'eabb1f4f-0699-4f0f-b2a0-0350d9e56ead' OR
      email = 'chandana.hr@paradigmfms.com' OR
      biometric_id = 'MS-639';

-- [11] Chethan V (Ref: MS-145)
UPDATE public.users
SET date_of_birth = '1987-01-08'::DATE, updated_at = NOW()
WHERE id = 'd29b6020-e4ba-436c-adfb-b5fd2cd74990' OR
      email = 'chethan@paradigmfms.com' OR
      biometric_id = 'MS-145';

-- [12] Gagan Saikia (Ref: SW-FOE-18)
UPDATE public.users
SET date_of_birth = '1986-02-25'::DATE, updated_at = NOW()
WHERE id = '494af503-83b7-4de3-84ee-67db754e77fd' OR
      email = 'gagandeepa46@gmail.com' OR
      biometric_id = 'SW-FOE-18';

-- [13] Ganesha C (Ref: EM00417)
UPDATE public.users
SET date_of_birth = '1989-06-28'::DATE, updated_at = NOW()
WHERE id = 'c7806ce8-8650-4176-aba7-e468f30cf353' OR
      email = 'ganucnaik@gmail.com' OR
      biometric_id = 'EM00417';

-- [14] Gowtham Mohan  (Ref: MS-378)
UPDATE public.users
SET date_of_birth = '1992-03-30'::DATE, updated_at = NOW()
WHERE id = '64c6a86c-c8f9-4b8f-969c-9e4768854fdb' OR
      email = 'gowtham.tech@paradigmfms.com' OR
      biometric_id = 'MS-378';

-- [15] Harish H P  (Ref: HK-S-14)
UPDATE public.users
SET date_of_birth = '1992-01-20'::DATE, updated_at = NOW()
WHERE id = '10c74709-58d5-43d8-a8aa-9233699fc751' OR
      email = 'harish.hp@paradigmfms.com' OR
      biometric_id = 'HK-S-14';

-- [16] Indrani  (Ref: MS-610)
UPDATE public.users
SET date_of_birth = '1984-11-19'::DATE, updated_at = NOW()
WHERE id = '5f616bcd-47b9-4806-9c2a-b4ce0c123825' OR
      email = 'godsownindrani@gmail.com' OR
      biometric_id = 'MS-610';

-- [17] Isaac Roy (Ref: MS-649)
UPDATE public.users
SET date_of_birth = '1995-03-11'::DATE, updated_at = NOW()
WHERE id = '2a637f75-8829-4572-bdbb-d60f7bb62bd6' OR
      email = 'isaac.ops@paradigmfms.com' OR
      biometric_id = 'MS-649';

-- [18] Joy Immanuel (Ref: MS-515)
UPDATE public.users
SET date_of_birth = '1983-01-17'::DATE, updated_at = NOW()
WHERE id = '6172b8cd-337c-4199-9333-2031e1e971f3' OR
      email = 'joy@paradigmfms.com' OR
      biometric_id = 'MS-515';

-- [19] Karthik K.s (Ref: MS-747)
UPDATE public.users
SET date_of_birth = '1995-06-04'::DATE, updated_at = NOW()
WHERE id = 'ec3b9362-479d-4668-9d42-22f1fce56a7d' OR
      email = 'karthikks941@gmail.com' OR
      biometric_id = 'MS-747';

-- [20] Kavya Hegde (Ref: MS-743)
UPDATE public.users
SET date_of_birth = '2002-06-11'::DATE, updated_at = NOW()
WHERE id = '7a8c6fa8-f9c6-4c88-a3c5-53fa72d7994d' OR
      email = 'kavyash2002@gmail.com' OR
      biometric_id = 'MS-743';

-- [21] Kavya M (Ref: MS-759)
UPDATE public.users
SET date_of_birth = '1996-05-25'::DATE, updated_at = NOW()
WHERE id = '07f61efd-24f2-457e-84b3-d8dafcb556c6' OR
      email = 'hr.kavya@paradigmfms.com' OR
      biometric_id = 'MS-759';

-- [22] Keshav Murthy (Ref: SW-MS-001)
UPDATE public.users
SET date_of_birth = '1972-07-27'::DATE, updated_at = NOW()
WHERE id = 'ef0e7e26-ce43-46ac-9f20-5c128faeae47' OR
      email = 'keshavmani27@gmail.com' OR
      biometric_id = 'SW-MS-001';

-- [23] Madhu NH (Ref: EM0171)
UPDATE public.users
SET date_of_birth = '1993-07-30'::DATE, updated_at = NOW()
WHERE id = '0fe5e1b8-6a53-4f57-a11a-103f72f4419a' OR
      email = 'madhunh93@gmail.com' OR
      biometric_id = 'EM0171';

-- [24] Maibub Paradigm (Ref: MS-304)
UPDATE public.users
SET date_of_birth = '1984-06-01'::DATE, updated_at = NOW()
WHERE id = 'b74b27d5-10a3-4826-a989-50021cc93d80' OR
      email = 'maibub@paradigmfms.com' OR
      biometric_id = 'MS-304';

-- [25] Nagaraja (Ref: MS-563)
UPDATE public.users
SET date_of_birth = '2002-07-18'::DATE, updated_at = NOW()
WHERE id = 'd99e25c0-d5c9-49bc-8aa6-e30e6bdec546' OR
      email = 'nn2009260@gmail.com' OR
      biometric_id = 'MS-563';

-- [26] Nakul R Alvar (Ref: MS-088)
UPDATE public.users
SET date_of_birth = '1974-01-26'::DATE, updated_at = NOW()
WHERE id = '84d4ee16-b60f-401c-9478-584b7cbea26d' OR
      email = 'nakulalvar@paradigmfms.com' OR
      biometric_id = 'MS-088';

-- [27] Omkar   (Ref: SWP-12)
UPDATE public.users
SET date_of_birth = '1996-06-01'::DATE, updated_at = NOW()
WHERE id = '8fb818f1-3750-4bd0-83ad-8832550c7fab' OR
      email = 'omkar@paradigmfms.com' OR
      biometric_id = 'SWP-12';

-- [28] Pallavi Reddy (Ref: MS-035)
UPDATE public.users
SET date_of_birth = '1978-02-26'::DATE, updated_at = NOW()
WHERE id = 'c7d96fe9-8e53-4cbf-8464-7c75ae62a723' OR
      email = 'pallavi@paradigmfms.com' OR
      biometric_id = 'MS-035';

-- [29] Poojashree S (Ref: MS-324)
UPDATE public.users
SET date_of_birth = '1996-01-31'::DATE, updated_at = NOW()
WHERE id = 'c96bc0e5-4b75-42a2-9f69-139de275ab7e' OR
      email = 'pooja@paradigmfms.in' OR
      biometric_id = 'MS-324';

-- [30] Pravin Prasad (Ref: MS-750)
UPDATE public.users
SET date_of_birth = '1979-07-05'::DATE, updated_at = NOW()
WHERE id = '2b640d5f-b444-4242-a7a4-f860c15b8db9' OR
      email = 'pravin@paradigmfms.com' OR
      biometric_id = 'MS-750';

-- [31] Priyanka Avadhut Naik Karmali (Ref: MS-739)
UPDATE public.users
SET date_of_birth = '1985-08-06'::DATE, updated_at = NOW()
WHERE id = 'd9ad58b8-62b7-4c5c-a653-70f41e8021dd' OR
      email = 'recruitment@paradigmfms.com' OR
      biometric_id = 'MS-739';

-- [32] Rajeshwari  (Ref: HK-S-108)
UPDATE public.users
SET date_of_birth = '1989-06-06'::DATE, updated_at = NOW()
WHERE id = 'a533d5bb-4ecf-417b-8817-3b3832652f55' OR
      email = 'rajeshwari.foe@paradigmfms.com' OR
      biometric_id = 'HK-S-108';

-- [33] Ramesh CV (Ref: MS-222)
UPDATE public.users
SET date_of_birth = '1964-07-20'::DATE, updated_at = NOW()
WHERE id = 'c9e141f9-0f86-4651-ad4a-93e3c7f3685f' OR
      email = 'ramesh@paradigmfms.com' OR
      biometric_id = 'MS-222';

-- [34] Ravi DEVA (Ref: MS-210)
UPDATE public.users
SET date_of_birth = '1985-09-03'::DATE, updated_at = NOW()
WHERE id = '171fac2f-d595-4720-a193-86431982a01e' OR
      email = 'ravi@paradigmfms.com' OR
      biometric_id = 'MS-210';

-- [35] Rinju  P  R (Ops Technical) (Ref: MS-553)
UPDATE public.users
SET date_of_birth = '1985-05-22'::DATE, updated_at = NOW()
WHERE id = 'f632fc1b-ccfe-4424-946c-670f24582764' OR
      email = 'rinju@paradigmfms.in' OR
      biometric_id = 'MS-553';

-- [36] Ruthvik Reddy (Ref: MS-749)
UPDATE public.users
SET date_of_birth = '2001-11-14'::DATE, updated_at = NOW()
WHERE id = '5b65eb6f-05f9-45fa-8789-75e125e67e0f' OR
      email = 'ruthvikreddy1411@gmail.com' OR
      biometric_id = 'MS-749';

-- [37] Sandeep B  (Ref: EM0001)
UPDATE public.users
SET date_of_birth = '1988-04-08'::DATE, updated_at = NOW()
WHERE id = '04364421-22db-44e2-b1f1-08bcebc3d562' OR
      email = 'sandeep@paradigmfms.com' OR
      biometric_id = 'EM0001';

-- [38] Sandip Limboo (Ref: SW-SS-168)
UPDATE public.users
SET date_of_birth = '1996-10-10'::DATE, updated_at = NOW()
WHERE id = 'd6af6555-670a-4da5-953d-ca67a8aee7a3' OR
      email = 'limboosandip83@gmail.com' OR
      biometric_id = 'SW-SS-168';

-- [39] Sanjay Ganapati Naik (Ref: MS-566)
UPDATE public.users
SET date_of_birth = '1997-01-20'::DATE, updated_at = NOW()
WHERE id = '2a82f0cc-effb-4576-917c-72408ea06b45' OR
      email = 'fireofficer@paradigmfms.com' OR
      biometric_id = 'MS-566';

-- [40] Shankar Namdev (Ref: MS-740)
UPDATE public.users
SET date_of_birth = '1982-06-13'::DATE, updated_at = NOW()
WHERE id = 'c63ad327-6434-4f88-bbf5-c559e39805b2' OR
      email = 'ravindra.foe@paradigmfms.com' OR
      biometric_id = 'MS-740';

-- [41] Shilpa M (Ref: MS-573)
UPDATE public.users
SET date_of_birth = '1986-04-15'::DATE, updated_at = NOW()
WHERE id = '94a4f34e-f4d0-42d5-b2c5-7b43419a3325' OR
      email = 'shilpa.ops@paradigmfms.in' OR
      biometric_id = 'MS-573';

-- [42] Sinchana KM (Ref: MS-637)
UPDATE public.users
SET date_of_birth = '2004-01-29'::DATE, updated_at = NOW()
WHERE id = 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f' OR
      email = 'sinchana@paradigmfms.in' OR
      biometric_id = 'MS-637';

-- [43] Singh (Ref: SW-FOE-15)
UPDATE public.users
SET date_of_birth = '2002-10-02'::DATE, updated_at = NOW()
WHERE id = '6190ce1c-53f3-4e64-9f5c-339930aed70d' OR
      email = 'yogeshsinghys104011@gmail.com' OR
      biometric_id = 'SW-FOE-15';

-- [44] Sonjoy Kurmi (Ref: MS-732)
UPDATE public.users
SET date_of_birth = '2000-01-01'::DATE, updated_at = NOW()
WHERE id = 'edbda891-191d-4385-b31f-f527f31cc4b4' OR
      email = 'sanjaykurmi2105@gmail.com' OR
      biometric_id = 'MS-732';

-- [45] Sriya Vijayan  (Ref: MS-700)
UPDATE public.users
SET date_of_birth = '2001-09-03'::DATE, updated_at = NOW()
WHERE id = '2c56919a-a450-408b-9085-3ae11e0cae17' OR
      email = 'hiring@paradigmfms.in' OR
      biometric_id = 'MS-700';

-- [46] Stany  D Souza  (Ref: EM0005)
UPDATE public.users
SET date_of_birth = '1980-11-29'::DATE, updated_at = NOW()
WHERE id = '4f62cbdd-6410-4fa3-9d7e-04b05fc41866' OR
      email = 'stany@paradigmfms.com' OR
      biometric_id = 'EM0005';

-- [47] Sudhan M (Ref: MS-338)
UPDATE public.users
SET date_of_birth = '1995-10-16'::DATE, updated_at = NOW()
WHERE id = '5321c6f6-578e-4168-9da8-060148e1587b' OR
      email = 'admin@paradigmfms.com' OR
      biometric_id = 'MS-338';

-- [48] Sunil Singh (Ref: SW-FOE-16)
UPDATE public.users
SET date_of_birth = '1986-01-04'::DATE, updated_at = NOW()
WHERE id = '48969ea0-cbff-4ae9-bd22-8f237baa7992' OR
      email = 'sunilaus123@gmail.com' OR
      biometric_id = 'SW-FOE-16';

-- [49] Sunilkumar Hs (Ref: MS-746)
UPDATE public.users
SET date_of_birth = '1999-04-12'::DATE, updated_at = NOW()
WHERE id = '703903f0-5f06-4e1e-a1a9-4d83fb5a8c92' OR
      email = 'sunilkumarhs666@gmail.com' OR
      biometric_id = 'MS-746';

-- [50] Surojit Mondal (Ref: HKB-656)
UPDATE public.users
SET date_of_birth = '1990-10-25'::DATE, updated_at = NOW()
WHERE id = '313c72d8-7236-4fad-b0a4-59374274073a' OR
      email = 'surojitmondal8050@gmail.com' OR
      biometric_id = 'HKB-656';

-- [51] Veerabhadra T M (Ref: MS-480)
UPDATE public.users
SET date_of_birth = '1989-05-08'::DATE, updated_at = NOW()
WHERE id = '216d264d-b20b-45a1-91b5-09cb47c781fb' OR
      email = 'veerabhadra@paradigmfms.com' OR
      biometric_id = 'MS-480';

-- [52] Veerabhadraiah S (Ref: MS-333)
UPDATE public.users
SET date_of_birth = '1984-01-20'::DATE, updated_at = NOW()
WHERE id = 'd515b5f7-0b2b-4bca-b706-2bd0c9d593a3' OR
      email = 'veerabhadraiah.stp@paradigmfms.com' OR
      biometric_id = 'MS-333';

-- [53] Venkatachalam  (Ref: MS-249)
UPDATE public.users
SET date_of_birth = '1980-02-15'::DATE, updated_at = NOW()
WHERE id = 'ed8ce87f-1f28-4a3a-a319-4dc502add40d' OR
      email = 'venkat@paradigmfms.com' OR
      biometric_id = 'MS-249';

-- [54] Vishwa Finance (Ref: MS-753)
UPDATE public.users
SET date_of_birth = '1978-03-18'::DATE, updated_at = NOW()
WHERE id = 'b506395f-1a4a-4f46-9e04-b5f73fc3e131' OR
      email = 'vishwa.finance@paradigmfms.com' OR
      biometric_id = 'MS-753';

-- [55] divya settu (Ref: MS-729)
UPDATE public.users
SET date_of_birth = '1998-02-09'::DATE, updated_at = NOW()
WHERE id = 'd82e4430-bfd3-43aa-be9b-4cc14791c1b7' OR
      email = 'divyasettu7@gmail.com' OR
      biometric_id = 'MS-729';

-- [56] sashikanta das (Ref: SW-FOE-06)
UPDATE public.users
SET date_of_birth = '1989-03-16'::DATE, updated_at = NOW()
WHERE id = 'b6144e7e-d5e8-4f64-b50f-f15d01739c40' OR
      email = 'sashikantadas8262@gmail.com' OR
      biometric_id = 'SW-FOE-06';

COMMIT;

-- Verification Query
SELECT id, name, email, biometric_id, date_of_birth
FROM public.users
WHERE date_of_birth IS NOT NULL
ORDER BY name ASC;