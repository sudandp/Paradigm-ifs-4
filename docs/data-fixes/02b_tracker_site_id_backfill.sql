-- =====================================================================
-- FIX 02b - site_finance_tracker / site_invoice_tracker site_id backfill (EXACT name matches only)
-- Generated 2026-11-26 from a READ-ONLY review of production (nothing has been executed).
-- WHY: site_id is NULL on 817 of 817 finance-tracker rows and 787 of 787 invoice-tracker rows, so billing cannot be joined to a site by key (only by free-text name).
--      Both columns are TEXT (not a uuid FK), and site_invoice_defaults.site_id already holds organizations.id slugs for all 115 rows, so the same key is used here.
-- MATCH RULE: frozen list of distinct site_name values that equal an organization name after lower-casing and removing non-alphanumerics (unique org). Finance: 69 names / 441 rows. Invoice: 65 names / 429 rows.
-- NOT INCLUDED: typo / abbreviation / legal-name variants (fuzzy) - see the review tables in docs/data-quality-fixes.md.
-- IDEMPOTENT: only rows whose site_id IS NULL are updated. Soft-deleted rows are updated too (harmless).
-- OLD VALUES: site_id was NULL on every row touched (verified count above).
-- =====================================================================

BEGIN;

UPDATE public.site_finance_tracker t
SET site_id = v.org_id
FROM (VALUES
  -- 8 row(s)
  ('Akshaya Patra', 'akshaya_patra'),
  -- 7 row(s)
  ('Aratt Milano', 'aratt_milano'),
  -- 6 row(s)
  ('Artisane Forest Breeze', 'artisane_forest_breeze'),
  -- 8 row(s)
  ('ARTISANE PROJECTS', 'artisane_projects'),
  -- 6 row(s)
  ('August Park', 'august_park'),
  -- 7 row(s)
  ('Birla Alokya', 'birla_alokya'),
  -- 6 row(s)
  ('Brigade Bricklane', 'brigade_bricklane'),
  -- 7 row(s)
  ('Brigade Jacaranda', 'brigade_jacaranda'),
  -- 7 row(s)
  ('Brigade Laburnum', 'brigade_laburnum'),
  -- 7 row(s)
  ('Brigade Omega', 'brigade_omega'),
  -- 7 row(s)
  ('DSR Eden Greens', 'dsr_eden_greens'),
  -- 3 row(s)
  ('DSR Eden Greens Apartment Owners Association', 'dsr_eden_greens'),
  -- 7 row(s)
  ('DSR Woodwinds', 'dsr_woodwinds'),
  -- 7 row(s)
  ('FICO', 'fico'),
  -- 3 row(s)
  ('G K Ispat Pvt Ltd', 'gk_ispat_pvt_ltd'),
  -- 8 row(s)
  ('GK ISPAT PVT LTD', 'gk_ispat_pvt_ltd'),
  -- 7 row(s)
  ('GR Sankalpa', 'gr_sankalpa'),
  -- 7 row(s)
  ('GRGR', 'gr_gr'),
  -- 8 row(s)
  ('Habitat Aura', 'habitat_aura'),
  -- 7 row(s)
  ('Habitat Eden Heights', 'habitat_eden_heights'),
  -- 3 row(s)
  ('Hare Krishna Movement Bangalore', 'vrindhavan_pg'),
  -- 3 row(s)
  ('hebbal Infraspace', 'hebbal_infra_space'),
  -- 8 row(s)
  ('ISKCON', 'iskcon'),
  -- 8 row(s)
  ('ISKCON - TTD', 'iskcon_ttd'),
  -- 8 row(s)
  ('ISKCON Vaikunta Hill', 'iskcon_vaikunta_hill'),
  -- 8 row(s)
  ('Keshav Setlur', 'keshav_setlur'),
  -- 7 row(s)
  ('Kolte Patil I Towers', 'kolte_patil_i_towers'),
  -- 1 row(s)
  ('Krishvi Wisteria', 'krishvi_wisteria'),
  -- 7 row(s)
  ('Mantri Elegance', 'mantri_elegance'),
  -- 7 row(s)
  ('Mantri Premero', 'mantri_premero'),
  -- 7 row(s)
  ('MJ amadeus', 'm_j_amadeus'),
  -- 7 row(s)
  ('Nikoo Homes', 'nikoo_homes'),
  -- 7 row(s)
  ('NVT Life Square', 'nvt_life_square'),
  -- 7 row(s)
  ('NVT Mystic Garden', 'nvt_mystic_garden'),
  -- 7 row(s)
  ('NVT Oikos', 'nvt_oikos'),
  -- 7 row(s)
  ('NVT Under the Open Sky', 'nvt_under_the_open_sky'),
  -- 7 row(s)
  ('NVT Vaksana', 'nvt_vaksana'),
  -- 2 row(s)
  ('NVT Whispering Hues', 'nvt_whispering_hues'),
  -- 3 row(s)
  ('Pramukh MM Meridian', 'pramukh_mm_meridian'),
  -- 8 row(s)
  ('Prestige Falcon City', 'prestige_falcon_city'),
  -- 7 row(s)
  ('Prestige Garden Bay', 'prestige_garden_bay'),
  -- 5 row(s)
  ('Prestige Oasis', 'prestige_oasis'),
  -- 8 row(s)
  ('Prestige Park Square', 'prestige_park_square'),
  -- 7 row(s)
  ('Prestige South Ridge', 'prestige_south_ridge'),
  -- 8 row(s)
  ('Purva Atmosphere', 'purva_atmosphere'),
  -- 7 row(s)
  ('Purva Sunshine', 'purva_sunshine'),
  -- 7 row(s)
  ('Purva Venezia', 'purva_venezia'),
  -- 3 row(s)
  ('Raja Prakruthi', 'raja_prakruthi'),
  -- 3 row(s)
  ('Realserve', 'artisane_projects'),
  -- 7 row(s)
  ('Salarpuria Luxuria', 'salarpuria_luxuria'),
  -- 3 row(s)
  ('Sankirtan Seva Trust  V K Hill', 'iskcon_vaikunta_hill'),
  -- 7 row(s)
  ('SJR Spencer', 'sjr_spencer'),
  -- 7 row(s)
  ('SJR Verity', 'sjr_verity'),
  -- 3 row(s)
  ('SNN Bellahalli', 'snn_bellahalli'),
  -- 7 row(s)
  ('SNN Clermont Project', 'snn_clermont_project'),
  -- 7 row(s)
  ('SNN Raj Lake View', 'snn_raj_lakeview'),
  -- 7 row(s)
  ('Sobha Dew Flower', 'sobha_dew_flower'),
  -- 7 row(s)
  ('Sobha Morzaria', 'sobha_morzaria'),
  -- 7 row(s)
  ('Sobha Silicon Oasis', 'sobha_silicon_oasis'),
  -- 3 row(s)
  ('Sri Venkateshwara Seva Trust', 'iskcon_ttd'),
  -- 7 row(s)
  ('Sunny Grove', 'sunny_grove'),
  -- 8 row(s)
  ('SV Grandur', 'sv_grandur'),
  -- 7 row(s)
  ('Tata Sherwood', 'tata_sherwood'),
  -- 7 row(s)
  ('The Imperial Address', 'the_imperial_address'),
  -- 8 row(s)
  ('Trans Indus', 'trans_indus'),
  -- 7 row(s)
  ('UL India', 'ul_india'),
  -- 7 row(s)
  ('Urban Greens', 'urban_greens'),
  -- 7 row(s)
  ('Urban Serenity', 'urban_serenity'),
  -- 8 row(s)
  ('Vrindhavan PG', 'vrindhavan_pg')
) AS v(site_name, org_id)
WHERE t.site_name = v.site_name
  AND t.site_id IS NULL
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = v.org_id);

UPDATE public.site_invoice_tracker t
SET site_id = v.org_id
FROM (VALUES
  -- 8 row(s)
  ('Akshaya Patra', 'akshaya_patra'),
  -- 7 row(s)
  ('Aratt Milano', 'aratt_milano'),
  -- 6 row(s)
  ('Artisane Forest Breeze', 'artisane_forest_breeze'),
  -- 8 row(s)
  ('ARTISANE PROJECTS', 'artisane_projects'),
  -- 6 row(s)
  ('August Park', 'august_park'),
  -- 8 row(s)
  ('Birla Alokya', 'birla_alokya'),
  -- 6 row(s)
  ('Brigade Bricklane', 'brigade_bricklane'),
  -- 7 row(s)
  ('Brigade Jacaranda', 'brigade_jacaranda'),
  -- 7 row(s)
  ('Brigade Laburnum', 'brigade_laburnum'),
  -- 8 row(s)
  ('Brigade Omega', 'brigade_omega'),
  -- 7 row(s)
  ('DSR Eden Greens', 'dsr_eden_greens'),
  -- 7 row(s)
  ('DSR Woodwinds', 'dsr_woodwinds'),
  -- 7 row(s)
  ('FICO', 'fico'),
  -- 8 row(s)
  ('GK ISPAT PVT LTD', 'gk_ispat_pvt_ltd'),
  -- 7 row(s)
  ('GR Sankalpa', 'gr_sankalpa'),
  -- 7 row(s)
  ('GRGR', 'gr_gr'),
  -- 8 row(s)
  ('Habitat Aura', 'habitat_aura'),
  -- 7 row(s)
  ('Habitat Eden Heights', 'habitat_eden_heights'),
  -- 3 row(s)
  ('hebbal Infraspace', 'hebbal_infra_space'),
  -- 8 row(s)
  ('ISKCON', 'iskcon'),
  -- 8 row(s)
  ('ISKCON - TTD', 'iskcon_ttd'),
  -- 8 row(s)
  ('ISKCON Vaikunta Hill', 'iskcon_vaikunta_hill'),
  -- 8 row(s)
  ('Keshav Setlur', 'keshav_setlur'),
  -- 8 row(s)
  ('Kolte Patil I Towers', 'kolte_patil_i_towers'),
  -- 1 row(s)
  ('Krishvi Wisteria', 'krishvi_wisteria'),
  -- 7 row(s)
  ('Mantri Elegance', 'mantri_elegance'),
  -- 7 row(s)
  ('Mantri Premero', 'mantri_premero'),
  -- 7 row(s)
  ('MJ amadeus', 'm_j_amadeus'),
  -- 7 row(s)
  ('Nikoo Homes', 'nikoo_homes'),
  -- 7 row(s)
  ('NVT Life Square', 'nvt_life_square'),
  -- 7 row(s)
  ('NVT Mystic Garden', 'nvt_mystic_garden'),
  -- 7 row(s)
  ('NVT Oikos', 'nvt_oikos'),
  -- 7 row(s)
  ('NVT Under the Open Sky', 'nvt_under_the_open_sky'),
  -- 7 row(s)
  ('NVT Vaksana', 'nvt_vaksana'),
  -- 2 row(s)
  ('NVT Whispering Hues', 'nvt_whispering_hues'),
  -- 3 row(s)
  ('Pramukh MM Meridian', 'pramukh_mm_meridian'),
  -- 8 row(s)
  ('Prestige Falcon City', 'prestige_falcon_city'),
  -- 7 row(s)
  ('Prestige Garden Bay', 'prestige_garden_bay'),
  -- 5 row(s)
  ('Prestige Oasis', 'prestige_oasis'),
  -- 8 row(s)
  ('Prestige Park Square', 'prestige_park_square'),
  -- 7 row(s)
  ('Prestige South Ridge', 'prestige_south_ridge'),
  -- 8 row(s)
  ('Purva Atmosphere', 'purva_atmosphere'),
  -- 7 row(s)
  ('Purva Sunshine', 'purva_sunshine'),
  -- 8 row(s)
  ('Purva Venezia', 'purva_venezia'),
  -- 3 row(s)
  ('Raja Prakruthi', 'raja_prakruthi'),
  -- 7 row(s)
  ('Salarpuria Luxuria', 'salarpuria_luxuria'),
  -- 1 row(s)
  ('Salarpuria Luxuria ', 'salarpuria_luxuria'),
  -- 7 row(s)
  ('SJR Spencer', 'sjr_spencer'),
  -- 7 row(s)
  ('SJR Verity', 'sjr_verity'),
  -- 3 row(s)
  ('SNN Bellahalli', 'snn_bellahalli'),
  -- 7 row(s)
  ('SNN Clermont Project', 'snn_clermont_project'),
  -- 7 row(s)
  ('SNN Raj Lake View', 'snn_raj_lakeview'),
  -- 1 row(s)
  ('SNN Spiritua', 'snn_spiritua'),
  -- 7 row(s)
  ('Sobha Dew Flower', 'sobha_dew_flower'),
  -- 7 row(s)
  ('Sobha Morzaria', 'sobha_morzaria'),
  -- 7 row(s)
  ('Sobha Silicon Oasis', 'sobha_silicon_oasis'),
  -- 7 row(s)
  ('Sunny Grove', 'sunny_grove'),
  -- 8 row(s)
  ('SV Grandur', 'sv_grandur'),
  -- 7 row(s)
  ('Tata Sherwood', 'tata_sherwood'),
  -- 7 row(s)
  ('The Imperial Address', 'the_imperial_address'),
  -- 8 row(s)
  ('Trans Indus', 'trans_indus'),
  -- 7 row(s)
  ('UL India', 'ul_india'),
  -- 7 row(s)
  ('Urban Greens', 'urban_greens'),
  -- 7 row(s)
  ('Urban Serenity', 'urban_serenity'),
  -- 8 row(s)
  ('Vrindhavan PG', 'vrindhavan_pg')
) AS v(site_name, org_id)
WHERE t.site_name = v.site_name
  AND t.site_id IS NULL
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = v.org_id);

COMMIT;

-- ---------------------------------------------------------------------
-- ROLLBACK (manual). Old value = NULL for every row touched.
-- BEGIN;
-- UPDATE public.site_finance_tracker t SET site_id = NULL
-- FROM (VALUES
--   ('Akshaya Patra', 'akshaya_patra'),
--   ('Aratt Milano', 'aratt_milano'),
--   ('Artisane Forest Breeze', 'artisane_forest_breeze'),
--   ('ARTISANE PROJECTS', 'artisane_projects'),
--   ('August Park', 'august_park'),
--   ('Birla Alokya', 'birla_alokya'),
--   ('Brigade Bricklane', 'brigade_bricklane'),
--   ('Brigade Jacaranda', 'brigade_jacaranda'),
--   ('Brigade Laburnum', 'brigade_laburnum'),
--   ('Brigade Omega', 'brigade_omega'),
--   ('DSR Eden Greens', 'dsr_eden_greens'),
--   ('DSR Eden Greens Apartment Owners Association', 'dsr_eden_greens'),
--   ('DSR Woodwinds', 'dsr_woodwinds'),
--   ('FICO', 'fico'),
--   ('G K Ispat Pvt Ltd', 'gk_ispat_pvt_ltd'),
--   ('GK ISPAT PVT LTD', 'gk_ispat_pvt_ltd'),
--   ('GR Sankalpa', 'gr_sankalpa'),
--   ('GRGR', 'gr_gr'),
--   ('Habitat Aura', 'habitat_aura'),
--   ('Habitat Eden Heights', 'habitat_eden_heights'),
--   ('Hare Krishna Movement Bangalore', 'vrindhavan_pg'),
--   ('hebbal Infraspace', 'hebbal_infra_space'),
--   ('ISKCON', 'iskcon'),
--   ('ISKCON - TTD', 'iskcon_ttd'),
--   ('ISKCON Vaikunta Hill', 'iskcon_vaikunta_hill'),
--   ('Keshav Setlur', 'keshav_setlur'),
--   ('Kolte Patil I Towers', 'kolte_patil_i_towers'),
--   ('Krishvi Wisteria', 'krishvi_wisteria'),
--   ('Mantri Elegance', 'mantri_elegance'),
--   ('Mantri Premero', 'mantri_premero'),
--   ('MJ amadeus', 'm_j_amadeus'),
--   ('Nikoo Homes', 'nikoo_homes'),
--   ('NVT Life Square', 'nvt_life_square'),
--   ('NVT Mystic Garden', 'nvt_mystic_garden'),
--   ('NVT Oikos', 'nvt_oikos'),
--   ('NVT Under the Open Sky', 'nvt_under_the_open_sky'),
--   ('NVT Vaksana', 'nvt_vaksana'),
--   ('NVT Whispering Hues', 'nvt_whispering_hues'),
--   ('Pramukh MM Meridian', 'pramukh_mm_meridian'),
--   ('Prestige Falcon City', 'prestige_falcon_city'),
--   ('Prestige Garden Bay', 'prestige_garden_bay'),
--   ('Prestige Oasis', 'prestige_oasis'),
--   ('Prestige Park Square', 'prestige_park_square'),
--   ('Prestige South Ridge', 'prestige_south_ridge'),
--   ('Purva Atmosphere', 'purva_atmosphere'),
--   ('Purva Sunshine', 'purva_sunshine'),
--   ('Purva Venezia', 'purva_venezia'),
--   ('Raja Prakruthi', 'raja_prakruthi'),
--   ('Realserve', 'artisane_projects'),
--   ('Salarpuria Luxuria', 'salarpuria_luxuria'),
--   ('Sankirtan Seva Trust  V K Hill', 'iskcon_vaikunta_hill'),
--   ('SJR Spencer', 'sjr_spencer'),
--   ('SJR Verity', 'sjr_verity'),
--   ('SNN Bellahalli', 'snn_bellahalli'),
--   ('SNN Clermont Project', 'snn_clermont_project'),
--   ('SNN Raj Lake View', 'snn_raj_lakeview'),
--   ('Sobha Dew Flower', 'sobha_dew_flower'),
--   ('Sobha Morzaria', 'sobha_morzaria'),
--   ('Sobha Silicon Oasis', 'sobha_silicon_oasis'),
--   ('Sri Venkateshwara Seva Trust', 'iskcon_ttd'),
--   ('Sunny Grove', 'sunny_grove'),
--   ('SV Grandur', 'sv_grandur'),
--   ('Tata Sherwood', 'tata_sherwood'),
--   ('The Imperial Address', 'the_imperial_address'),
--   ('Trans Indus', 'trans_indus'),
--   ('UL India', 'ul_india'),
--   ('Urban Greens', 'urban_greens'),
--   ('Urban Serenity', 'urban_serenity'),
--   ('Vrindhavan PG', 'vrindhavan_pg')
-- ) AS v(site_name, org_id)
-- WHERE t.site_name = v.site_name AND t.site_id = v.org_id;
-- UPDATE public.site_invoice_tracker t SET site_id = NULL
-- FROM (VALUES
--   ('Akshaya Patra', 'akshaya_patra'),
--   ('Aratt Milano', 'aratt_milano'),
--   ('Artisane Forest Breeze', 'artisane_forest_breeze'),
--   ('ARTISANE PROJECTS', 'artisane_projects'),
--   ('August Park', 'august_park'),
--   ('Birla Alokya', 'birla_alokya'),
--   ('Brigade Bricklane', 'brigade_bricklane'),
--   ('Brigade Jacaranda', 'brigade_jacaranda'),
--   ('Brigade Laburnum', 'brigade_laburnum'),
--   ('Brigade Omega', 'brigade_omega'),
--   ('DSR Eden Greens', 'dsr_eden_greens'),
--   ('DSR Woodwinds', 'dsr_woodwinds'),
--   ('FICO', 'fico'),
--   ('GK ISPAT PVT LTD', 'gk_ispat_pvt_ltd'),
--   ('GR Sankalpa', 'gr_sankalpa'),
--   ('GRGR', 'gr_gr'),
--   ('Habitat Aura', 'habitat_aura'),
--   ('Habitat Eden Heights', 'habitat_eden_heights'),
--   ('hebbal Infraspace', 'hebbal_infra_space'),
--   ('ISKCON', 'iskcon'),
--   ('ISKCON - TTD', 'iskcon_ttd'),
--   ('ISKCON Vaikunta Hill', 'iskcon_vaikunta_hill'),
--   ('Keshav Setlur', 'keshav_setlur'),
--   ('Kolte Patil I Towers', 'kolte_patil_i_towers'),
--   ('Krishvi Wisteria', 'krishvi_wisteria'),
--   ('Mantri Elegance', 'mantri_elegance'),
--   ('Mantri Premero', 'mantri_premero'),
--   ('MJ amadeus', 'm_j_amadeus'),
--   ('Nikoo Homes', 'nikoo_homes'),
--   ('NVT Life Square', 'nvt_life_square'),
--   ('NVT Mystic Garden', 'nvt_mystic_garden'),
--   ('NVT Oikos', 'nvt_oikos'),
--   ('NVT Under the Open Sky', 'nvt_under_the_open_sky'),
--   ('NVT Vaksana', 'nvt_vaksana'),
--   ('NVT Whispering Hues', 'nvt_whispering_hues'),
--   ('Pramukh MM Meridian', 'pramukh_mm_meridian'),
--   ('Prestige Falcon City', 'prestige_falcon_city'),
--   ('Prestige Garden Bay', 'prestige_garden_bay'),
--   ('Prestige Oasis', 'prestige_oasis'),
--   ('Prestige Park Square', 'prestige_park_square'),
--   ('Prestige South Ridge', 'prestige_south_ridge'),
--   ('Purva Atmosphere', 'purva_atmosphere'),
--   ('Purva Sunshine', 'purva_sunshine'),
--   ('Purva Venezia', 'purva_venezia'),
--   ('Raja Prakruthi', 'raja_prakruthi'),
--   ('Salarpuria Luxuria', 'salarpuria_luxuria'),
--   ('Salarpuria Luxuria ', 'salarpuria_luxuria'),
--   ('SJR Spencer', 'sjr_spencer'),
--   ('SJR Verity', 'sjr_verity'),
--   ('SNN Bellahalli', 'snn_bellahalli'),
--   ('SNN Clermont Project', 'snn_clermont_project'),
--   ('SNN Raj Lake View', 'snn_raj_lakeview'),
--   ('SNN Spiritua', 'snn_spiritua'),
--   ('Sobha Dew Flower', 'sobha_dew_flower'),
--   ('Sobha Morzaria', 'sobha_morzaria'),
--   ('Sobha Silicon Oasis', 'sobha_silicon_oasis'),
--   ('Sunny Grove', 'sunny_grove'),
--   ('SV Grandur', 'sv_grandur'),
--   ('Tata Sherwood', 'tata_sherwood'),
--   ('The Imperial Address', 'the_imperial_address'),
--   ('Trans Indus', 'trans_indus'),
--   ('UL India', 'ul_india'),
--   ('Urban Greens', 'urban_greens'),
--   ('Urban Serenity', 'urban_serenity'),
--   ('Vrindhavan PG', 'vrindhavan_pg')
-- ) AS v(site_name, org_id)
-- WHERE t.site_name = v.site_name AND t.site_id = v.org_id;
-- COMMIT;
