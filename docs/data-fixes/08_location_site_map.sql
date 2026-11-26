-- =====================================================================
-- FIX 08 - NEW table location_site_map: GPS geofence (locations.id) -> canonical site (organizations.id)  (HIGH confidence only)
-- Generated 2026-11-26 from a READ-ONLY review of production (nothing has been executed).
-- WHY: locations has 556 rows, mostly reverse-geocoded street addresses, and only 21 are linked from the matrix (site_responsibility_matrix.site_id).
--      attendance_events.location_id therefore cannot be rolled up to a site. This additive lookup maps 90 named site geofences
--      (matrix-linked, or name equals the site / an obvious spelling variant / "Gate 1/2", "Entry/Exit") to organizations.id.
-- NOT INCLUDED (10 medium / ambiguous geofences, listed in docs/data-quality-fixes.md): e.g. "Bhartiya City Nikoo Homes" (4 Nikoo orgs), "Brigade Millennium Laburnum".
-- TOUCHES: creates one new table (+RLS read policy); inserts 90 rows. Nothing existing is modified.
-- IDEMPOTENT: CREATE ... IF NOT EXISTS, INSERT ... ON CONFLICT DO NOTHING.
-- OLD VALUES: none (new table).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.location_site_map (
  location_id     UUID PRIMARY KEY REFERENCES public.locations(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source          TEXT NOT NULL DEFAULT 'data-quality-fix-08',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_location_site_map_org ON public.location_site_map(organization_id);
ALTER TABLE public.location_site_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "location_site_map_read" ON public.location_site_map;
CREATE POLICY "location_site_map_read" ON public.location_site_map FOR SELECT TO authenticated USING (true);

INSERT INTO public.location_site_map (location_id, organization_id)
SELECT v.location_id, v.organization_id
FROM (VALUES
  -- 42 Queens Square Residents Welfare Association
  ('2ca398a6-cb83-45be-aa18-e7269a185007'::uuid, '42_estate_queens_square'),
  -- Ahad Euphoria
  ('18db05b7-7f3a-4b4e-ad90-cc77f3e2c165'::uuid, 'ahad_euphoria'),
  -- AllonovIlle
  ('06b09bc2-8de0-4260-8494-dd85d9cba570'::uuid, 'alanoville_haryana_goyal_co'),
  -- ALANOVILLE RESIDENTS WELFARE ASSOCIATION
  ('1c7e9bd6-f9e7-42dd-94bb-00fe79c77701'::uuid, 'alanoville_haryana_goyal_co'),
  -- Aratt Milano
  ('a38b8e66-cd11-4163-8fc3-8ac38114f860'::uuid, 'aratt_milano'),
  -- Artisane forest breeze - Gate 1
  ('ecf3f5c3-be15-4116-b1ea-94523beb4456'::uuid, 'artisane_forest_breeze'),
  -- Artisane forest breeze - Gate 2
  ('59ee124a-befa-47f8-94ef-358be52e1259'::uuid, 'artisane_forest_breeze'),
  -- Assetz Soul & Soil
  ('7ff9f66e-5739-415b-9b81-ee1678b48e2e'::uuid, 'assetz_soul_soil'),
  -- August Park Apartment
  ('673f2a8f-7158-48a5-9dcb-a3bd10e1f912'::uuid, 'august_park'),
  -- August Park
  ('61347ecd-aeac-4b85-8e8d-8e21842f7d81'::uuid, 'august_park'),
  -- Birla Alokya
  ('2f3f0c3e-5bd2-48af-b75a-b48a45e8db98'::uuid, 'birla_alokya'),
  -- Brigade Bricklane - Gate 1
  ('a8481c11-ec0f-4c7b-9cf3-dff6b26b6351'::uuid, 'brigade_bricklane'),
  -- Brigade Bricklane - Gate 2
  ('f00ef9d4-bddf-4a29-b96c-b03491f0b3b6'::uuid, 'brigade_bricklane'),
  -- Brigade Millennium Jacaranda Block Apt Owner Association. - Gate 2
  ('f02f38ef-fb56-4964-89a7-1ac491a2e46e'::uuid, 'brigade_jacaranda'),
  -- Brigade Omega Apartment
  ('fbee1d17-fa1d-4d57-a319-c62a56033da6'::uuid, 'brigade_omega'),
  -- Divyashree Elan Apartments
  ('ddf8bc8b-602e-42b6-b11d-d3fb50e99827'::uuid, 'divyashree_elan'),
  -- DSR Eden Greens
  ('25b8d336-237d-4789-ba10-719c826b5ded'::uuid, 'dsr_eden_greens'),
  -- DSR WoodWinds Apartment Owners Association
  ('eb2b07d7-a73e-4205-b04c-1271d72ddc27'::uuid, 'dsr_woodwinds'),
  -- Elita Promenade Phase 1
  ('633d4355-9451-47a0-9207-0ee3d4415423'::uuid, 'elita_prominade'),
  -- GR Sankalpa
  ('de2fbcd5-0331-4c51-b1ce-48b66b40673f'::uuid, 'gr_sankalpa'),
  -- GREENWOOD REGENCY APARTMENT OWNERS ASSOCIATION
  ('a74bec59-7cd6-4b1a-9499-83ee1dc6edaa'::uuid, 'greenwood_regency'),
  -- Habitat Eden Heights
  ('a6eea271-7e2c-416b-a973-a2ee5ed65c75'::uuid, 'habitat_eden_heights'),
  -- ICON SANCTUARY VILLA OWNERS WELFEARASSOCIATION
  ('d1ebce60-da18-4eef-bd63-c744256a72e1'::uuid, 'icon_sanctury'),
  -- Janhavi Shelters Back Gate
  ('d0e914a3-4653-4cfd-8936-ab4f54e26222'::uuid, 'janhavi_shelters'),
  -- Kolte Patil I Tower Exente
  ('64e960d8-71ee-4d87-8598-df7781b7bb19'::uuid, 'kolte_patil_i_towers'),
  -- I Tower
  ('ea7b5780-15c1-4a2d-b053-0dcbb4d1556b'::uuid, 'kolte_patil_i_towers'),
  -- ITowers Exente
  ('0972356d-8c89-48e6-b8d0-2ab3b02a2d24'::uuid, 'kolte_patil_i_towers'),
  -- Mirabilis Apartment Owners Association - Entry
  ('4a1eddf2-a161-413e-ae63-a11acd0828c0'::uuid, 'kolte_patil_mirabilis'),
  -- Mirabilis Apartment Owners Association - Exit
  ('2185b174-20f2-4ef1-ab34-389e6fd2b392'::uuid, 'kolte_patil_mirabilis'),
  -- Kolte Patil Mirabilis
  ('dd420fc9-d185-4ec2-b9e0-c9e1de942294'::uuid, 'kolte_patil_mirabilis'),
  -- MJ Lifestyle Amadeus
  ('c2622ea8-8cd3-4c61-8128-261a9b831aee'::uuid, 'm_j_amadeus'),
  -- Mahendra Aarna
  ('ed48231b-674d-4cc6-9c36-8647878a0f26'::uuid, 'mahendra_aarna'),
  -- Mahindra Windchimes
  ('7e3543b9-d9ed-4b74-8920-775866c50c80'::uuid, 'mahindra_lifespace_windchimes'),
  -- Mantri Elegance - Entry
  ('f7e56fd3-2b6b-4795-8ca1-f8fe350ccbdb'::uuid, 'mantri_elegance'),
  -- Mantri Elegance - Exit
  ('349c52e3-25bb-4db0-a4ff-46f269565d8f'::uuid, 'mantri_elegance'),
  -- Mantri premero
  ('ae07bacb-d4ec-414d-a560-568d0b550452'::uuid, 'mantri_premero'),
  -- MARATT PIMENTO - Gate 2
  ('3f97c22a-2fdf-48c9-896d-d619538285e8'::uuid, 'maratt_hospitality'),
  -- MARATT PIMENTO - Gate 1
  ('8676ae1c-b644-4740-81bd-5b1fb7b9dad3'::uuid, 'maratt_hospitality'),
  -- Nadathur Fame India
  ('501ce426-d796-40f2-8228-34061276419b'::uuid, 'nadathur_fame_india'),
  -- NIKOO HOMES 1 - Entry
  ('51234ece-56f3-46f9-8cc2-3a14c2943d38'::uuid, 'nikoo_homes_1'),
  -- NIKOO HOMES 1 - Exit
  ('cc136e60-e55f-474d-902d-f9d610e43e23'::uuid, 'nikoo_homes_1'),
  -- NVT Life Square
  ('e3b5cea4-9a98-4f20-a2f3-75376b12bf38'::uuid, 'nvt_life_square'),
  -- Phoenix One Bangalore West
  ('544f3d15-5c26-4f15-9df7-5b43af7990a0'::uuid, 'phoenix_one_bangalore_west'),
  -- Prestige Garden Bay
  ('594c7791-0984-4b55-93ce-85c0fd87092d'::uuid, 'prestige_garden_bay'),
  -- Prestige Oasis.
  ('51a3bbdd-9c0d-4108-984d-4e4587f7398e'::uuid, 'prestige_oasis'),
  -- Prestige Oasis
  ('5f0cc3f0-c499-409c-98bf-e024dd9f7b51'::uuid, 'prestige_oasis'),
  -- Prestige South Ridge
  ('7e438f9a-4d5c-410d-b582-5d88704d5a3f'::uuid, 'prestige_south_ridge'),
  -- Prestige St.Johns Woods Back Gate
  ('6cdf588a-e940-4acf-b487-526bdbce751c'::uuid, 'prestige_st_johns_wood'),
  -- Pride Picassa Apartment
  ('7cbfc08d-f572-4626-9826-62b29e3d11fe'::uuid, 'pride_picasa'),
  -- Pride Picasa
  ('427276d6-c8c3-40cc-820c-a608bf5f2f12'::uuid, 'pride_picasa'),
  -- Purva Venezia Apartment - Gate 1
  ('040670e8-cc4a-4e88-b1e0-f9ce3f7a151e'::uuid, 'purva_venezia'),
  -- Purva Venezia Apartment - Gate 2
  ('4e6728f7-0ddc-48cb-b8e6-95a03448ea4e'::uuid, 'purva_venezia'),
  -- Purva Venezia
  ('563e7935-44ae-497c-9b6c-636a04c39d17'::uuid, 'purva_venezia'),
  -- Raja Ritz Avenue
  ('aeca93eb-d1ec-4db0-aa17-ad359afa1069'::uuid, 'raja_ritz_avenue_phase_1'),
  -- Shriram Signiaa Apartment
  ('19e7b624-df7a-467d-9d7f-8f82974d29e7'::uuid, 'shriram_signiaa'),
  -- Shriram Signiaa
  ('97f041b4-491f-48d7-8835-113b57029f47'::uuid, 'shriram_signiaa'),
  -- SHRIRAM SMRITHI - Gate 2
  ('bb86014a-0d8b-41f7-9774-70ed5aa77460'::uuid, 'shriram_smrithi'),
  -- Shriram Smrithi
  ('102cafb6-6fbb-4e9f-8895-3f0cfbc018e8'::uuid, 'shriram_smrithi'),
  -- SHRIRAM SPURTHI APARTMENTS ASSOCIATION
  ('8aa210b6-6753-4df6-8a7f-8cbbe0320dcc'::uuid, 'shriram_spurthi'),
  -- Sjr Spencer
  ('efdaea81-440e-4061-a9a8-d6641c4cd83f'::uuid, 'sjr_spencer'),
  -- SJR Verety
  ('f90f036f-ee4f-413e-8443-d2a7941883ca'::uuid, 'sjr_verity'),
  -- SNN Bellahalli
  ('582026fe-a122-40d6-882f-0138bdf2081e'::uuid, 'snn_bellahalli'),
  -- SNN RAJ LAKE VIEW APARTMENT - Gate 2
  ('5e7ec433-5ba8-49de-94d5-fda610784df3'::uuid, 'snn_raj_lakeview'),
  -- SNN RAJ LAKE VIEW APARTMENT - Gate 1
  ('b19521cf-aeae-47c6-9aca-14170c4b723e'::uuid, 'snn_raj_lakeview'),
  -- SNN Raj Lake View
  ('b2b68ce1-2a08-4ac4-9619-c553be0aa5bb'::uuid, 'snn_raj_lakeview'),
  -- SNN Raj Lake View, Bilekahalli, Bengaluru South City Corporation, Beng
  ('a9ecec02-2a6b-4918-a9cd-e99b2b520068'::uuid, 'snn_raj_lakeview'),
  -- Sobha Chrysanthemum Apartment Owner's Welfare Association - Gate 2
  ('0c2acba1-080d-439f-bc67-df06d9b870c6'::uuid, 'sobha_chrysanthemum'),
  -- Sobha Chrysanthemum Apartment Owner's Welfare Association - Gate 1
  ('96ab3908-3550-43ea-aa70-0b9e665432c8'::uuid, 'sobha_chrysanthemum'),
  -- Sobha Dew Flower
  ('d7334df5-aac1-468b-8d9a-fae8b0247d7c'::uuid, 'sobha_dew_flower'),
  -- Sobha dewflower - Entry
  ('d7cbfc56-8bd2-42c7-aa39-858aef642403'::uuid, 'sobha_dew_flower'),
  -- Sobha dewflower - Exit
  ('1349d020-c926-4f7d-85f8-e51fc698fcab'::uuid, 'sobha_dew_flower'),
  -- Sobha Morzaria Grandeur Apartment Owners Association
  ('fc051e80-b88f-4b3b-8d63-88559a2e9f95'::uuid, 'sobha_morzaria'),
  -- Sobha Morzaria Grandeur
  ('be07a175-3580-446c-ba54-ee885db62889'::uuid, 'sobha_morzaria'),
  -- Sobha Silicon Oasis
  ('a5be25d1-221c-4e73-aba5-628af686ceee'::uuid, 'sobha_silicon_oasis'),
  -- SOBHA SILICON OASIS - Gate 1
  ('88befbee-90a8-4e48-95d8-9985cc0fc959'::uuid, 'sobha_silicon_oasis'),
  -- Sobha Silicon Oasis Main Gate
  ('d4495c67-d97c-4908-a5b2-8896e24b794b'::uuid, 'sobha_silicon_oasis'),
  -- Sterling Terraces
  ('fa77ea90-4241-4598-be43-f31a9ea538b5'::uuid, 'sterling_terraces'),
  -- Sterling Terraces - Gate 3
  ('54331e46-2518-4473-a8b2-b595ee581661'::uuid, 'sterling_terraces'),
  -- Sterling Terraces - Gate 1
  ('99a8d130-547a-4a47-a898-a4c0e893592f'::uuid, 'sterling_terraces'),
  -- TATA Sherwood Apartments
  ('ee86fc74-207b-499e-ae2b-25d227543291'::uuid, 'tata_sherwood'),
  -- Tata sherwood
  ('755f854a-544b-40c3-939b-db0fc3ef84d9'::uuid, 'tata_sherwood'),
  -- Trans Indus
  ('112e1f4d-3008-497e-ba84-708d99240b95'::uuid, 'trans_indus'),
  -- Uber Verdant 2
  ('7b16f4fd-3bd4-4244-a871-97e3e23e5bda'::uuid, 'uber_verdant_phase_ii'),
  -- Uber Verdant Phase II
  ('9b57e7f0-6a3b-4dc5-a890-ef6f53361a4c'::uuid, 'uber_verdant_phase_ii'),
  -- UBER VERDANT Back Gate
  ('5ba452e5-02b5-4111-91ca-98356c57cacb'::uuid, 'uber_verdant_phase_ii'),
  -- URBAN GREENS VILLA OWNERS WELFARE ASSOCIATION
  ('4c708e47-dc17-44e1-a5c1-e753d8b3b0c6'::uuid, 'urban_greens'),
  -- Vaishnavi Terraces
  ('7b8f1061-e2b2-4968-9792-16889d8dc20d'::uuid, 'vaishnavi_terraces'),
  -- Vaishnavi Terraces Apartment Owners association - Gate 2
  ('d906776f-092c-4686-8ccb-44d61dd87f19'::uuid, 'vaishnavi_terraces'),
  -- Vaishnavi Terraces Apartment Owners association - Gate 1
  ('af46ee79-5adc-41e8-bc9b-4269a09f3282'::uuid, 'vaishnavi_terraces'),
  -- Jyothi Woods
  ('a671728c-7b57-41ed-90d0-c201f030dd01'::uuid, 'vamsiram_builders_jyothi_woods')
) AS v(location_id, organization_id)
WHERE EXISTS (SELECT 1 FROM public.locations l WHERE l.id = v.location_id)
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = v.organization_id)
ON CONFLICT (location_id) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------
-- ROLLBACK (manual). Old state: table did not exist. Simplest: drop it.
-- BEGIN;
-- DROP TABLE IF EXISTS public.location_site_map;
-- COMMIT;
-- (or, to keep the table but remove only these rows:)
-- DELETE FROM public.location_site_map WHERE source = 'data-quality-fix-08';
