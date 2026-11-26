# Paradigm Assist - data-quality fix pack

Generated 2026-11-26. **Strictly read-only review of production Supabase**: nothing was inserted, updated or deleted, and none of the SQL has been run. All SQL is in `docs/data-fixes/` (one file per fix, each in `BEGIN; ... COMMIT;`, idempotent, with a commented ROLLBACK that restores the old values). Only HIGH-confidence rows are in the SQL; everything else is in the review lists below.

## 0. Things you need to know first

1. **The canonical site key should be `organizations.id`** (text slug, e.g. `sobha_dew_flower`). It is already what `entities.organization_id`, `site_invoice_defaults.site_id` (115/115 rows match exactly) and the matrix FK `site_responsibility_matrix.organization_id` use. `site_responsibility_matrix.site_id` is something else: a uuid FK to `locations` (a GPS geofence), populated on only 21 of 202 rows, so I did not touch it.
2. **`users.location_id` is not a site column and must not be overwritten.** In production it is a TEXT foreign key to `organization_groups.id`, and that table has exactly one row (`group_1774003567612` = "AP Group"). The 116 "placeholder" users simply belong to the company group; the app reads it that way (`services/api.ts`, `SelectOrganization.tsx`). Writing a site id into it would break the FK. Fix 01 therefore adds a new column `users.primary_site_id` (FK `organizations.id`).
3. **Most field staff do not have a single home site.** Of 26 users with at least 10 site-named punches in the last 60 days, only 2 exceed 75% at one site (and one of those has an uncertain site mapping); the median top-site share is about 35% and each has 8-32 assigned geofences (`user_locations`, 2,124 rows). A "primary site" is only truthful for client-site accounts and a few fixed staff, so only 7 of 138 active users are HIGH confidence. The right roster source for roving staff is `user_locations` joined to the new geofence map (Fix 08).
4. **Code defect found (not fixed, per instructions):** `src/api/assist/scope.ts` compares `users.location_id` (an organization-group id) with `matrix.site_id` (a locations uuid) in the team and self branches, which can never match. After Fix 01/02a it should use `users.primary_site_id` and `matrix.organization_id`. Also `siteKey()` collapses a trailing digit, so "Nikoo Homes 1", "2", "4" and "Nikoo Homes" all become `nikoo home` (the only collision among the 217 organizations); a finance user scoped to one Nikoo block sees all four. Matching on ids avoids this.
5. **`site_finance_tracker` (site, month) is not unique by design.** Several sites have two real contracts in the same month under a service-line suffix (e.g. "42 Estate Queens" 217,098 vs "42 Estate Queens(PPFMS)" 131,000; Shriram Spurthi 457,083 vs "(FM)" 48,900; Kolte Patil Mirabilis, Aratt Milano, NVT Under the Open Sky, The Imperial Address). After Fix 02b these will share a site_id; the chatbot must **sum** per site-month, not de-duplicate. Only the June bad-import rows and the February legal-name rows are true duplicates.

## 1. Summary

| # | Problem | Rows affected | Impact on the chatbot | Fix (file) | Auto (HIGH) / manual | Risk |
|---|---|---|---|---|---|---|
| 1 | `users.location_id` is a company-group FK, not a site | 143 users (116 group id, 27 null; 138 active) | No per-site rosters, site-scoped access for managers/field staff matches nobody | Add `users.primary_site_id`; fill the certain ones (`01_users_primary_site.sql`) | **7** auto / **131** manual (active) | Low (additive column) |
| 2a | Matrix has no canonical site key | 202 of 202 rows have `organization_id` NULL | Matrix cannot be joined to organizations/entities/trackers except by fuzzy name | Backfill `organization_id` by exact name (`02a_...`) | **202** auto / 0 manual | Low |
| 2b | Finance / invoice trackers have no site key | finance 817 rows, invoice 787 rows have `site_id` NULL (defaults table: 115/115 already fine) | Billing questions per site rely on free-text names with 79 spelling variants | Backfill `site_id` for exact names (`02b_...`) | finance **441** rows / invoice **429** rows auto; **376 / 358** rows (79 names) manual | Low |
| 3 | Duplicate / shifted June-2026 billing rows | 28 shifted rows in 14 site-month groups (10 of 14 also have a clean June row) | Doubled or nonsense billed totals for June | Soft-delete duplicates (`03_...`); repair 4 kept rows (`03b_...`, optional) | **21** soft-deleted + **4** repaired / **3** kept for decision + **7** Feb legal-name rows (proposal only) | Medium (finance data; soft delete, reversible) |
| 4 | Matrix ops manager name without id | 16 rows | "My sites" for Sandeep misses 14 sites | Set `ops_manager_id` for "SANDEEP" (`04_...`) | **14** auto / **2** manual (+ **23** VENKAT rows to confirm) | Low |
| 5 | Invoice tracker ops in-charge is free text | 787 rows, 24 spellings (no id column) | Cannot join ops in-charge to a user | Report only; normalised mapping below | n/a (report) | - |
| 6 | Biometric devices "online" with stale heartbeat | 19 of 19 "online" devices last seen 2026-10-07 (50 days) | Device-status answers are wrong | None in DB - device bridge issue | n/a | - |
| 7a | `employee_scores.performance_score` stuck at 50 | 1,049 of 1,116 rows | Rankings are meaningless | Code fix (no tasks exist) | - | - |
| 7b | `users.monthly_ot_hours` all 0 | 143 of 143 | Wrong if read | Ignore column / code fix | - | - |
| 7c | `extra_work_logs.hours_worked` empty | 19 of 19 | OT claims count as 0 h | Data entry / code fix | - | - |
| 7d | `attendance_daily_summary` stale | stops 2026-04-30; 52,645 events since | None today (no tool reads it) | Ignore or rebuild job | - | - |
| 7e | Placeholder takeover dates | 69 matrix rows dated 2026-12 to 2032 | Wrong tenure / "since when" answers | Clear impossible dates (`07_...`, optional) | **7** auto / **62** manual | Low |
| 7f | Matrix site manager / field officer / supervisor empty | 202 of 202 each | Cannot answer "who is the site manager / FO" | Data entry | - | - |
| 8 | (new) geofence to site map missing | 556 locations, 21 linked | Attendance cannot be rolled up to a site | New `location_site_map` table (`08_...`) | **90** auto / **10** manual | Low (new table) |

### Recommended order to apply
Take a snapshot first (for example `CREATE TABLE _bak_<table> AS SELECT * FROM <table>` for the tables below, or a Supabase backup). Then:

1. `02a_matrix_organization_id_backfill.sql` (202 rows, additive key)
2. `02b_tracker_site_id_backfill.sql` (870 tracker rows, additive key)
3. `08_location_site_map.sql` (new table, 90 rows)
4. `01_users_primary_site.sql` (new column, 7 rows)
5. `04_matrix_ops_manager_ids.sql` (14 rows)
6. `03_finance_tracker_soft_delete_june_duplicates.sql` (21 soft deletes; finance should glance at the list first)
7. `03b_finance_tracker_repair_shifted_columns.sql` (optional, 4 rows, finance sign-off)
8. `07_matrix_clear_future_takeover_dates.sql` (optional, 7 rows)

Steps 1-4 only add keys or new objects and are safe to run any time; 5-8 change existing business values. Fixes 2b and 03 are independent (2b also updates soft-deleted rows, which is harmless).

Verification queries to run after each step are listed at the end.

---

## 2. Problem 1 - users: primary site

### Evidence
- `users.location_id`: 114 active + 2 left users hold `group_1774003567612` (116); 24 active + 3 left are NULL (27). PostgREST schema: `location_id: text, FK -> organization_groups.id`; `organization_groups` has the single row "AP Group". Migration `20260326_add_hierarchical_user_fields.sql` created it as `TEXT REFERENCES organization_groups(id)`.
- Evidence used per active user (60-day window): `attendance_events` (12,817 punches, 71 users, 100 named site geofences resolved to a site; 6,028 of the 12,817 punches have no location_id and many others are reverse-geocoded street addresses that cannot be named), `user_locations` (2,124 assignments, 80 users), `onboarding_submissions.organization_name`, `users.organization_id` (managers carry a comma list of entity ids), and for client accounts the account name / email.
- HIGH rule: either at least 10 site punches with at least 75% at one site (mapping itself HIGH), or a client-site account whose name AND email identify one organization. Everything else is manual.

### HIGH confidence - in `01_users_primary_site.sql` (7 users)
| User | Role | primary_site_id | Evidence |
|---|---|---|---|
| Rinju  P  R (Ops Technical) | field_staff | sobha_chrysanthemum | 47 of 58 site-mapped punches (81%) in last 60d at Sobha Chrysanthemum geofences; also in user_locations |
| I Tower Softservice Executive Paradigm | unverified | kolte_patil_i_towers | client-site account: name "I Tower Softservice Executive", email itowersoftservice.paradigm@ |
| Estate Manager Woodwinds (Paradigm Services ) | unverified | dsr_woodwinds | client-site account: name "Estate Manager Woodwinds", email ww@paradigmfms.com |
| Prashanth | unverified | ahad_euphoria | client-site account: email euphoria.afm1@paradigmfms.com |
| Naveen Kumar S T | unverified | alanoville_haryana_goyal_co | client-site account: email alanoville.estatemanager@ |
| Sark 2 PM | unverified | sark_two | client-site account: name "Sark 2 PM", email sark2pm@ (organisation sark_two exists; sark3 is a different org) |
| Fortune 1 FM | site_manager | fortune_one_flat_owners_wmma_cooperative_society_l | client-site account: name "Fortune 1 FM", email fortune1fm.paradigmfms@ |

### Manual review (131 active users)
Counts by category: no evidence / low: 68; few punches, has assigned geofences / low: 7; roving (punches at several sites) / low: 23; HQ / office based / n/a: 25; client-site account (name/email hint) / low: 2; client-site account (name/email hint) / medium: 4; roving (punches at several sites) / medium: 2.

**Roving staff (punches across many sites) - a single primary site is not supported; recommend `user_locations` as the roster.** Medium: Yogesh Singh -> Uber Verdant Phase II (55 of 86 punches, 64%), Madhu NH -> GR GR (63 of 83, 76%, but the "Gr Grand Residency" geofence to "GR GR" mapping is itself uncertain, so medium; she is a technical reliever).
| User | Role | Confidence | Top site (punches 60d) | Evidence |
|---|---|---|---|---|
| Veerabhadra T M | field_staff | low | (none, <60%) | Icon Sanctury 16, SOBHA DEW FLOWER 15, Purva Sunshine 13; top share 20% of 79; assigned geofences 20 |
| Basavaraj HB - Senior Manager Landscaping | field_staff | low | (none, <60%) | Janhavi Shelters 109, Shriram Signiaa 30, Elita Prominade 30; top share 34% of 324; assigned geofences 30 |
| Arun Kumar A V | field_staff | low | (none, <60%) | Prestige Garden Bay 31, Prestige Oasis 24, GR sankalpa 13; top share 40% of 77; assigned geofences 19 |
| Sandeep B | operation_manager | low | (none, <60%) | SJR Verity 5, SNN Raj Lakeview 4, Mahendra Aarna 3; top share 20% of 25; assigned geofences 15 |
| YOGESH SINGH | field_officer | medium | Uber Verdant Phase II (uber_verdant_phase_ii) | Uber Verdant Phase II 55, DSR Eden Greens 21, Artisane Forest Breeze 3; top share 64% of 86; assigned geofences 8 |
| Venkatachalam | operation_manager | low | (none, <60%) | Mahindra Lifespace Windchimes 16, Divyashree Elan 9, Kolte Patil Mirabilis 7; top share 24% of 67; assigned geofences 24 |
| Karthik K.s | field_staff | low | (none, <60%) | Greenwood Regency 28, SJR Verity 19, Pride Picasa 14; top share 33% of 85; assigned geofences 13 |
| Harish H P | field_staff | low | (none, <60%) | Greenwood Regency 20, Uber Verdant Phase II 10, DSR Eden Greens 7; top share 44% of 45; assigned geofences 17 |
| Madhu NH | technical_reliever | medium | GR GR (gr_gr) | GR GR 63, Artisane Forest Breeze 8, Brigade Laburnum 4; top share 76% of 83; assigned geofences 27 |
| Anil | field_staff | low | (none, <60%) | Birla Alokya 50, Prestige Garden Bay 42, Shriram Smrithi 9; top share 35% of 142; assigned geofences 21 |
| Shankar Namdev | field_officer | low | (none, <60%) | Prestige Garden Bay 37, Sobha Chrysanthemum 20, Brigade Bricklane 14; top share 25% of 150; assigned geofences 19 |
| Ganesha C | technical_reliever | low | (none, <60%) | Purva Sunshine 30, Kolte Patil Mirabilis 18, GR sankalpa 16; top share 19% of 155; assigned geofences 32 |
| Joy Immanuel | field_staff | low | (none, <60%) | SOBHA DEW FLOWER 18, Shriram Spurthi 7, Prestige South Ridge 6; top share 42% of 43; assigned geofences 18 |
| Keshav Murthy | operation_manager | low | (none, <60%) | SNN Spiritua 50, Brigade Laburnum 14, SOBHA DEW FLOWER 6; top share 54% of 93; assigned geofences 15 |
| Veerabhadraiah S | technical_reliever | low | (none, <60%) | DSR Woodwinds 20, M J Amadeus 16, Purva Sunshine 15; top share 17% of 119; assigned geofences 31 |
| Shilpa M | operation_manager | low | (none, <60%) | Prestige Garden Bay 6, Birla Alokya 3, Vaishnavi Terraces 2; top share 50% of 12; assigned geofences 17 |
| Isaac Roy | operation_manager | low | (none, <60%) | Shriram Spurthi 5, SNN Spiritua 4, Nikoo Homes 1 3; top share 19% of 26; assigned geofences 15 |
| Maibub Paradigm | field_staff | low | (none, <60%) | Purva Venezia 85, SJR Spencer 36, Aeris Residences 24; top share 46% of 183; assigned geofences 15 |
| Ramesh CV | field_staff | low | (none, <60%) | SOBHA DEW FLOWER 51, Prestige South Ridge 35, SNN Spiritua 20; top share 29% of 175; assigned geofences 25 |
| Gowtham Mohan | field_staff | low | (none, <60%) | Sobha Silicon Oasis 14, Mahendra Aarna 10, DSR Woodwinds 5; top share 35% of 40; assigned geofences 12 |
| Sonjoy Kurmi | field_staff | low | (none, <60%) | DSR Woodwinds 35, Shriram Smrithi 25, GR sankalpa 17; top share 19% of 183; assigned geofences 23 |
| Rajeshwari | field_staff | low | (none, <60%) | SNN Raj Lakeview 10, Shriram Signiaa 8, Artisane Forest Breeze 7; top share 23% of 44; assigned geofences 15 |
| Gagan Saikia | field_officer | low | (none, <60%) | Birla Alokya 13, Shriram Spurthi 11, Habitat Eden Heights 9; top share 34% of 38; assigned geofences 15 |
| sashikanta das | field_staff | low | (none, <60%) | Artisane Forest Breeze 48, SNN Spiritua 23, Brigade Laburnum 6; top share 50% of 96; assigned geofences 14 |
| Omkar | field_staff | low | (none, <60%) | Alanoville (Haryana & Goyal Co) 30, Purva Venezia 11, Nikoo Homes 1 8; top share 42% of 71; assigned geofences 31 |

**Client-site accounts (name / email hints):**
| User | Role | Confidence | Proposed site | Evidence |
|---|---|---|---|---|
| canny forest edge | site_manager | low | (no organisation row) | name "canny forest edge": no organisation row with that name |
| Facility Manager VGPT | site_manager | low | (no organisation row) | name "Facility Manager VGPT": no organisation row |
| Facility manager Purva (Madhu V Gowda) | unverified | medium | Purva Venezia (purva_venezia) | email facilitymanager@pvaoa.com + name "Facility manager Purva" (pvaoa = Purva Venezia AOA?); six Purva orgs exist |
| nikoo Facility Manager | unverified | medium | Nikoo Homes (nikoo_homes) | name "nikoo Facility Manager"; 4 Nikoo orgs (Homes, 1, 2, 4) |
| Charan Kumar | site_manager | medium | BLUE WATERS BY SJR PRIME CORP (blue_waters_by_sjr_prime_corp) | email propertymanagerpc.sjrbw@ (SJR Blue Waters) |
| Sanctuary FM | site_manager | medium | Icon Sanctury (icon_sanctury) | name "Sanctuary FM"; ICON Sanctuary vs MYSCAPE Sanctuary both exist |

**Few punches but assigned geofences (low):**
| User | Role | Evidence |
|---|---|---|
| Sunil Singh | field_officer | assigned sites: Shriram Smrithi |
| Bhimas Bora | field_officer | assigned sites: Assetz Soul & Soil, Nikoo Homes 1, Shriram Smrithi, Birla Alokya |
| Pravin Prasad | business_developer | assigned sites: Mahendra Aarna, Aeris Residences, Sobha Morzaria, Prestige South Ridge +4 |
| Sanjay Ganapati Naik | field_staff | assigned sites: Sobha Silicon Oasis, Nikoo Homes 1, Tata Sherwood, Vaishnavi Terraces +8 |
| Srikanth Ks | field_staff | assigned sites: Shriram Signiaa, Mahendra Aarna, Sobha Silicon Oasis, DSR Eden Greens +7 |
| Stany  D Souza | operation_manager | assigned sites: SOBHA DEW FLOWER, GR GR, Brigade Bricklane, SNN Raj Lakeview +14 |
| Sandip Limboo | field_officer | assigned sites: Raja ritz Avenue Phase 1, Uber Verdant Phase II, Habitat Eden Heights, Birla Alokya +3 |

**HQ / office based (25) - no client site, leave NULL:** Chennamma (hr); Arpitha Nairy (senior_accountant); Soumya Das (technician); Alen Dsouza (accounts_excitative); Bhaskar A (hr_onboaring); Kavya Hegde (accounts_excitative); Ruthvik Reddy (accounts_excitative_southwall); Sudhan M (admin); Vishwa Finance (finance_controller); Chandana R (hr_onboaring); Nagaraja (procurement_executive); Sinchana KM (accounts_excitative_invoice); Indrani (assistant_manager_-_admin); divya settu (procurement_co-ordinator); Nakul R Alvar (business_developer); Chethan V (finance_manager); Kavya M (hr_ops); Anup Noronha.s (hr_recruitment); Priyanka Avadhut Naik Karmali (hr_recruitment); Sunilkumar Hs (senior_accountant); Sriya Vijayan (hr_recruitment); Poojashree S (hr); Chiranjib Das (technician); Ravi DEVA (admin_manager); Surojit Mondal (driver_cum_store_assistent).

**No usable evidence (68) - leave NULL, owner to assign if a fixed site exists** (mostly `site_manager` accounts with personal names and no attendance, unverified accounts, and technicians/plumbers with no punches): Security Officer (unverified); Deepika Sudhan (Deeps) (unverified); Amritanshu Paradigm Services (director); Dasari Venkatesh (hr_ops); Kavitha (senior_manager_–_client_partnerships); Alekha Behera (plumber); Balla Yadagiri (field_staff); meena koutam (site_manager); Kannaiah R (site_manager); Google Reviewer (field_staff); Arya Thomas (senior_accountant_southwall); Singh (unverified); Ann Ruiz (unverified); Tikna Kanai (field_staff); Akash Kumar  Behera (electrician); Ankur (director); Prashant (afm_-_technical); Manasa Chakali (site_manager); Akash (field_staff); Arun Goud (site_manager); Pallavi Reddy (chief_experience_officer); gokul panneer (hvac_technician); Golekha Parida (plumber); Anil Hanmantrao Battewad (site_manager); Bududula praveen Praveen (site_manager); Sowndarya D (field_staff); Manojreddy Pundru (field_staff); Hemant Kumar Das (plumber); Sudhan (IOT Architect) (field_officer); Arjun Kumar Arjun (field_officer); Tharun Boyapally (operation_manager); Kusha K S (technical_reliever); Jagadeesh (field_staff); Arbinda Nayak (plumber_carpenter); Santosh Rathod (site_manager); Debashish Sharma (technical_supervisor); Naresh (field_staff); Udita Paul (hr); Natarajan V (field_staff); Lava K S (technical_supervisor); Manjunath (finance); Raghu Raman (unverified); Pradeepp Gangaiah (admin); Muralidhara B K (auditor); Ks Srikanth (site_manager); Sachin Kote (unverified); Kalakanti Premkumar (site_manager); krishna arason (unverified); Gopinatha M S (unverified); Hari krishna Bollam (site_manager); Pundru Manoj Reddy (field_staff); Sampath Kumar (site_manager); Amarender Golla (site_manager); Shivappa M (technical_supervisor); Test User (unverified); Yuva Naidu (field_officer); Ramesh Pathlvath (unverified); sampath chinthala (unverified); Naveen gowda (unverified); Veerendra Obinni (field_staff); Sachin Kote (site_manager); vinjam manoj kumar (technical_manager); Sampath (site_manager); Nithesh M (technician); Nithin Gowda (operation_manager); Sainath B (site_manager); Saikumar Palaki (site_manager); S.venkata Thirupathirao (site_manager).

Recommended owner action: assign a fixed site for the ~22 site managers and technicians directly (data entry in the admin screen, once the app exposes `primary_site_id`), and keep roving staff on `user_locations`.

---

## 3. Problem 2 - canonical site key

### Evidence
- `organizations`: 217 rows (1 is `DEMO_ORG_ID`); `entities`: 216 (ids `ent_<organization_id>`); matrix: 202 rows. Matrix `site_name` equals an organization name after lower-casing and stripping punctuation for **202 of 202** rows (unique match), matrix `organization_id` is NULL for all 202.
- `site_invoice_defaults.site_id` already holds the slug for 115/115 rows and equals the exact-name match in all 115.
- `site_finance_tracker.site_id` and `site_invoice_tracker.site_id` are TEXT (live schema; the 20260216 migration said uuid FK, it was changed) and NULL on every row.
- Exact normalised match (alnum-only, unique organization): finance 69 names = 441 of 817 rows; invoice 65 names = 429 of 787 rows. Legal names also match because `organizations.full_name` holds legal names (Realserve = Artisane Projects, Sri Venkateshwara Seva Trust = ISKCON TTD, etc.).
- Organizations / entities with **no matrix row** (so no ops owner): Prestige Lakeside, Sark Two, Gvk sky City, MYSCAPE SANCTUARY, Fortune one flat owners WMMA cooperative society ltd, NS D1 Afomma cooperative society Limited, NCD Royal Pevilion, Sark3 owners maintenance mutually aided cooperative society limited, Purva sunshine apartment, Giridhari, Saket Pranamam Flat Owner Maintenance Mutually Aided Cooperative society Ltd, Brigade Millenium Laburnum Block Apartment owners Association, Asian Suncity, ARK Hema.
- Sharing a legal name across several organizations makes three legal names ambiguous (NVT Quality Lifestyle Estate LLP, SNN Estates LLP, Ibrox Real Estate Development Pvt Ltd); those are excluded from the exact matches on purpose.

### Auto (HIGH): `02a` 202 matrix rows; `02b` finance 441 rows, invoice 429 rows.

### Manual review: tracker names that are not exact (79 names; "likely" = obvious typo/suffix of one organization, "medium" = plausible but ambiguous, "none" = no organization row exists, create one or leave NULL)
| Tracker site_name | finance rows | invoice rows | Proposed organizations.id | Organization | Confidence |
|---|---|---|---|---|---|
| 42 Estate Queens (PPFMS) | 1 | 1 | 42_estate_queens_square | 42 Estate Queens Square | likely |
| 42 Estate Queens( PPFMS) | 1 | 1 | 42_estate_queens_square | 42 Estate Queens Square | likely |
| 42 Estate Queens(PPFMS) | 5 | 5 | 42_estate_queens_square | 42 Estate Queens Square | likely |
| 42 Estate Queens | 7 | 7 | 42_estate_queens_square | 42 Estate Queens Square | likely |
| Advaitha Aksha | 4 | 4 | - | - | none |
| Aeries | 7 | 7 | aeris_residences | Aeris Residences | likely |
| Ahad | 7 | 7 | ahad_euphoria | Ahad Euphoria | likely |
| Aikyam Rameshwaram Cafe | 3 | 0 | - | - | none |
| Alanoville | 7 | 7 | alanoville_haryana_goyal_co | Alanoville (Haryana & Goyal Co) | likely |
| Aratt Milano( PPFMS) | 2 | 2 | aratt_milano | Aratt Milano | likely |
| Aratt Milano(PPFMS) | 5 | 5 | aratt_milano | Aratt Milano | likely |
| Artisane Forest Brezze | 1 | 1 | artisane_forest_breeze | Artisane Forest Breeze | likely |
| Assetz Soul and Soil | 7 | 7 | assetz_soul_soil | Assetz Soul & Soil | likely |
| Azven Breathe | 6 | 6 | - | - | none |
| Blue Jay | 5 | 5 | - | - | none |
| Blue Waters  By Sjr Prime | 1 | 1 | blue_waters_by_sjr_prime_corp | BLUE WATERS BY SJR PRIME CORP | likely |
| Blue Waters By Sjr Prime | 6 | 7 | blue_waters_by_sjr_prime_corp | BLUE WATERS BY SJR PRIME CORP | likely |
| Bolineni Nestor | 3 | 3 | - | - | none |
| Briagde Bricklane | 1 | 1 | brigade_bricklane | Brigade Bricklane | likely |
| Brigade Corner Stone Utopia | 2 | 2 | serene_brigade_cornerstone_utopia | Serene - Brigade Cornerstone Utopia | likely |
| Chanel India | 7 | 7 | chanel_india_pvt_ltd | Chanel India Pvt Ltd | likely |
| Elan Homes | 7 | 7 | - | - | none |
| Elita | 7 | 7 | elita_prominade | Elita Prominade | likely |
| "Fame India " | 0 | 1 | nadathur_fame_india | Nadathur Fame India | likely |
| Fame India | 7 | 7 | nadathur_fame_india | Nadathur Fame India | likely |
| Garden Mansion Apartment Owners Association | 3 | 0 | - | - | none |
| Global Edifice The Clan | 2 | 2 | global_edifice_infra | Global Edifice Infra | medium |
| Greenwood | 7 | 7 | greenwood_regency | Greenwood Regency | likely |
| H V Ventures Projects Pvt Ltd | 3 | 0 | - | - | none |
| ICON | 7 | 7 | icon_sanctury | Icon Sanctury | medium |
| Janhavi Shelter | 7 | 7 | janhavi_shelters | Janhavi Shelters | likely |
| Jyothi Woods | 7 | 7 | vamsiram_builders_jyothi_woods | VAMSIRAM BUILDERS Jyothi Woods | likely |
| Kolte Patil Mirablis(PPFMS) | 7 | 7 | kolte_patil_mirabilis | Kolte Patil Mirabilis | likely |
| Kolte Patil Mirablis | 7 | 7 | kolte_patil_mirabilis | Kolte Patil Mirabilis | likely |
| MARK One Lake Water | 2 | 2 | - | - | none |
| Mahendra Aarana | 7 | 7 | mahendra_aarna | Mahendra Aarna | likely |
| Mahendra Windchimes | 7 | 7 | mahindra_lifespace_windchimes | Mahindra Lifespace Windchimes | likely |
| "Maratt " | 0 | 1 | maratt_hospitality | Maratt Hospitality | likely |
| Maratt Project | 1 | 1 | maratt_hospitality | Maratt Hospitality | likely |
| Maratt | 7 | 7 | maratt_hospitality | Maratt Hospitality | likely |
| NPS East | 7 | 7 | - | - | none |
| NVT Stopping By the Woods | 2 | 3 | nvt_stopping_by_the_wood | NVT Stopping by the Wood | likely |
| NVT Symphony of orchids | 6 | 6 | nvt_symphony_of_orchid | NVT Symphony of Orchid | likely |
| NVT Under the Open Sky( PPFMS) | 3 | 3 | nvt_under_the_open_sky | NVT Under the Open Sky | likely |
| NVT Under the Open Sky(PPFMS) | 4 | 4 | nvt_under_the_open_sky | NVT Under the Open Sky | likely |
| NVT Wonderfull Word | 2 | 2 | nvt_a_wonderful_world | NVT A Wonderful World | likely |
| NVT Wonerfull Word | 5 | 5 | nvt_a_wonderful_world | NVT A Wonderful World | likely |
| Paradigm Intergrated Facility Services Pvt Ltd | 3 | 0 | - | - | none |
| Prestige St John | 7 | 8 | prestige_st_johns_wood | Prestige St Johns Wood | likely |
| Pride Picassa | 7 | 7 | pride_picasa | Pride Picasa | likely |
| Raja Four Square | 5 | 5 | - | - | none |
| Raja Ritz avenue | 7 | 7 | raja_ritz_avenue_phase_1 | Raja ritz Avenue Phase 1 | likely |
| SNN Clermont Marketing | 7 | 7 | snn_clermont_marketing_office | SNN Clermont Marketing Office | likely |
| SNN Dumont | 7 | 7 | snn_duomont_marketing_office | SNN Duomont Marketing Office | medium |
| SNN Estatae Felicity | 4 | 4 | snn_felicity | SNN Felicity | likely |
| SNN Estate Felicity | 3 | 3 | snn_felicity | SNN Felicity | likely |
| SNN Raj Spirictua Residence Welfare Association | 3 | 0 | snn_spiritua | SNN Spiritua | likely |
| SNN Spiritua Project | 7 | 7 | snn_spiritua | SNN Spiritua | likely |
| SV Garndur Apartment Co Operative society Ltd | 3 | 0 | sv_grandur | SV Grandur | likely |
| Shriram Signia | 7 | 7 | shriram_signiaa | Shriram Signiaa | likely |
| Shriram Smirithi | 7 | 7 | shriram_smrithi | Shriram Smrithi | likely |
| Shriram Spruthi( FM) | 1 | 1 | shriram_spurthi | Shriram Spurthi | likely |
| Shriram Spruthi( PIFS) | 1 | 1 | shriram_spurthi | Shriram Spurthi | likely |
| Shriram Spruthi(FM) | 5 | 5 | shriram_spurthi | Shriram Spurthi | likely |
| Shriram Spruthi | 7 | 7 | shriram_spurthi | Shriram Spurthi | likely |
| Sobha Chrysthamem | 2 | 2 | sobha_chrysanthemum | Sobha Chrysanthemum | likely |
| Sobha Chrysthamemu | 5 | 6 | sobha_chrysanthemum | Sobha Chrysanthemum | likely |
| Sterling Terrcaes | 7 | 7 | sterling_terraces | STERLING TERRACES | likely |
| Sumadhura Silver Ripples | 7 | 7 | - | - | none |
| TATA Promont | 7 | 7 | the_promont_housing | THE PROMONT HOUSING | medium |
| The Lake View Address | 6 | 6 | the_imperial_address | The Imperial Address | medium |
| Trands Indus Residents Association | 3 | 0 | trans_indus | Trans Indus | likely |
| Trascon | 6 | 6 | trasccon | Trasccon | likely |
| Uber Verdant 2 | 7 | 7 | uber_verdant_phase_ii | Uber Verdant Phase II | likely |
| Uber Verdanth Foresta Block | 1 | 1 | uber_verdant_phase_ii | Uber Verdant Phase II | medium |
| Urban Greens Villa Owners Wefare Association | 3 | 0 | urban_greens | Urban Greens | likely |
| Vaishnavi Terrcaes | 7 | 7 | vaishnavi_terraces | Vaishnavi Terraces | likely |
| Wyzminds | 5 | 5 | wyzmindz | Wyzmindz | likely |
| Zen Indraprasta | 7 | 7 | - | - | none |

Notes: "(PPFMS)", "(FM)", "(PIFS)" are service-line suffixes on the same site (see section 0 point 5). "Garden Mansion", "H V Ventures", "Aikyam Rameshwaram Cafe" and "Paradigm Intergrated Facility Services" are billed customers with no organization row. If you approve the "likely" rows, the same UPDATE pattern as `02b` applies (join on `site_name`).

### Geofence names not mapped to a site by Fix 08 (10, medium/ambiguous)
| locations.name | Best guess | Why not auto |
|---|---|---|
| Bhartiya City Nikoo Homes | nikoo_homes_1 | four Nikoo organizations |
| SNN RAJ Spiritua | snn_spiritua | ambiguous / alias |
| Gr Grand Residency | gr_gr | ambiguous / alias |
| Aeris Residences | aeris_residences | ambiguous / alias |
| The Lake View Address | the_imperial_address | ambiguous / alias |
| The Lakeview Address | the_imperial_address | ambiguous / alias |
| Aratt Aeris - Gate 1 | aeris_residences | ambiguous / alias |
| Purva sunshine apartment | purva_sunshine | ambiguous / alias |
| Brigade Millennium Laburnum | brigade_laburnum | ambiguous / alias |
| NVT Arcot Vaksana | nvt_vaksana | name differs ("Arcot") |

---

## 4. Problem 3 - duplicate June-2026 billing rows

### Evidence
- `site_finance_tracker`: 817 rows (none soft-deleted), 8 months (2026-01 to 2026-08). June has 139 rows versus about 108-110 in other months.
- 28 rows are **column-shifted**: `company_name` holds a number (the contract amount), `contract_amount` holds the fee, and so on. For all 28 the identity "shifted billed_management_fee = shifted contract_management_fee + shifted billed_amount" holds, so the shift is certain (e.g. G K Ispat: company_name `172340`, contract `17234`, fee `159813`, billed `15982`, total `175795`). They sit in 14 site-month pairs written 2 seconds apart on 2026-07-27 11:52 (by Sinchana KM then Arpitha Nairy).
- 10 of the 14 sites **also have a clean June row** under the short name. Verdict by group:
  - A (7 sites - both shifted copies soft-deleted): G K Ispat (clean row under the same name, approved), and six legal-name sites whose shifted contract equals the clean row's contract: Hare Krishna Movement = Vrindhavan PG, Realserve = Artisane Projects, Sankirtan Seva Trust = ISKCON Vaikunta Hill, Sri Venkateshwara Seva Trust = ISKCON TTD, SV Garndur = SV Grandur, Trands Indus = Trans Indus.
  - B (3 sites - only the second copy deleted, the first left for you): DSR Eden Greens (shifted contract 232,812 vs clean 253,358), Urban Greens (168,000 vs 154,588), SNN Raj Spiritua (145,036 vs 188,449). These legal-name rows carry an older/different contract; they are probably also duplicates, but the numbers disagree so I did not delete both.
  - C (4 sites - second copy deleted, first kept and repaired by 03b): Aikyam Rameshwaram Cafe, Garden Mansion Apartment Owners Association, H V Ventures Projects, Paradigm Intergrated Facility Services (no clean row, no organization). `company_name` is restored from the site's other months (all four show "Southwall Security LLP"; please confirm, especially for the Paradigm row).
- Total: **21 rows soft-deleted**, 8 rows kept (1 clean GK + 3 tier B + 4 tier C).

### Soft delete only
Uses the existing columns `deleted_at`, `deleted_by_name` ('Data-quality review 2026-11-26'), `deleted_reason`; no hard delete. Rollback sets them back to NULL for exactly those ids.

### Manual review
- **Tier B rows kept** (decide, probably soft-delete): e1136426-13cc-4d9b-8762-cd86cf55ff10 DSR Eden Greens Apartment Owners Association (shifted contract 232812; duplicate copy d08e50b2 is in the soft-delete list); f0d77ced-e4c5-42fc-b614-0444330275c2 SNN Raj Spirictua Residence Welfare Association (shifted contract 145036; duplicate copy a911d2d6 is in the soft-delete list); a17e6ff4-3721-4cb5-a13c-995c8e13b81a Urban Greens Villa Owners Wefare Association (shifted contract 168000; duplicate copy 0d692f44 is in the soft-delete list).
- **February 2026 legal-name rows**: 7 sites have a pending legal-name row that duplicates the approved short-name row (same contract, different billed amount). Proposed soft delete of the pending row (not auto because June was the stated scope):
| Site | Keep (approved) | Proposed soft delete (pending, legal name) |
|---|---|---|
| ARTISANE PROJECTS | f4880555 ARTISANE PROJECTS billed 227941 | 95eb7d7c Realserve billed 227784 |
| GK ISPAT PVT LTD | 7a308e02 GK ISPAT PVT LTD billed 156393 | 6eac8fbf G K Ispat Pvt Ltd billed 159813 |
| ISKCON - TTD | 1b3bba0f ISKCON - TTD billed 35918 | 632f364a Sri Venkateshwara Seva Trust billed 34639 |
| ISKCON Vaikunta Hill | 4892f457 ISKCON Vaikunta Hill billed 88609 | 1041f65d Sankirtan Seva Trust  V K Hill billed 73050 |
| SV Grandur | 9666d703 SV Grandur billed 229978 | c418c7dd SV Garndur Apartment Co Operative society Ltd billed 213560 |
| Trans Indus | 7921fb6c Trans Indus billed 181481 | 1a8fdb8f Trands Indus Residents Association billed 179725 |
| Vrindhavan PG | f6cb74bb Vrindhavan PG billed 26080 | 196d451d Hare Krishna Movement Bangalore billed 21757 |

- Not duplicates: service-line pairs (section 0 point 5). "The Imperial Address" (239,300 / 263,851) vs "The Lake View Address" (615,010) differ in contract by 2.5x, which looks like two contracts or a wrong site mapping; I proposed it as "medium" only.

---

## 5. Problem 4 - matrix ops manager

### Evidence
- 186 matrix rows have `ops_manager_id`; 16 have only the name: "SANDEEP" x14, "PRADEEP / ISAAC" x1 (Nikoo Homes), "UNASSIGNED" x1 (Sunny Grove).
- Exactly one user is called Sandeep (Sandeep B, operation_manager, already owner of 91 rows by id) -> Fix 04 sets `ops_manager_id` on the 14 rows (names left unchanged).
- Manual: "PRADEEP / ISAAC" (Pradeepp Gangaiah, admin, and Isaac Roy): the other Nikoo rows (1, 2, 4) belong to Isaac Roy, so Isaac is the likely owner; "UNASSIGNED": leave NULL.

### Related finding to confirm (not in SQL): the 23 "VENKAT" rows point to the wrong person?
23 matrix rows say "VENKAT" with `ops_manager_id` = **Dasari Venkatesh**, whose role is **hr_ops** and who has **0** punches at client sites. The operation manager **Venkatachalam** owns only 1 matrix row but has 24 assigned geofences, and 15 of the 23 VENKAT sites are among his assigned geofences or punches (49 of his 67 site punches are at VENKAT sites). The invoice tracker's most common ops in-charge is "Venkat" (191 rows). If confirmed, the fix is one statement (`UPDATE site_responsibility_matrix SET ops_manager_id = '<Venkatachalam id>' WHERE ops_manager_id = '<Dasari id>' AND upper(ops_manager_name) = 'VENKAT'`); until then Venkatachalam's chatbot scope is one site instead of about 24.

---

## 6. Problem 5 - invoice tracker ops in-charge (report only)

`site_invoice_tracker.ops_incharge` and `site_invoice_defaults.ops_incharge` are TEXT; there is no id column, so there is nothing to update. Proposed normalisation if a `ops_incharge_id` column is added later (and for the chatbot's name resolution now):

| Spelling(s) in tracker (rows) | Maps to user | Confidence |
|---|---|---|
| Isaac (125), Issac (17), ISSac (1) | Isaac Roy (operation_manager) | high |
| Sandeep (140) | Sandeep B (operation_manager) | high |
| Shilpa (129), Shilpa M (8) | Shilpa M (operation_manager) | high |
| KESHAV (80) | Keshav Murthy (operation_manager) | high |
| Harish (22) | Harish H P (field_staff; the matrix also names him ops owner of 8 sites) | high |
| Stany (7), Stany  D Souza (8) | Stany D Souza (operation_manager) | high |
| PRADEEP (8), Pradeepp Gangaiah (8) | Pradeepp Gangaiah (admin) | high |
| Nakul (1) | Nakul R Alvar (business_developer) | high |
| Venkat (191) | Dasari Venkatesh (hr_ops) per matrix, but see section 5: probably Venkatachalam | review |
| Sashikanth (11) | sashikanta das (field_staff) | medium |
| Kannaiah (6), kannaiah (1) | Kannaiah R (site_manager) | medium |
| Omkar (6) | Omkar (field_staff) | medium |
| Basavaraj (1) | Basavaraj HB (field_staff) | medium |
| Veerabhadra (1) | Veerabhadra T M or Veerabhadraiah S | low |
| Murali (10), Muruli (2) | no matching user (Muralidhara B K is an auditor) | none |
| Vignesh (3) | no matching user | none |
| Omkar/ Stany (1) | two people | none |

`site_invoice_defaults.ops_incharge` (115 rows) uses upper-case first names (VENKAT 23, ISAAC 19, SANDEEP 16, SHILPA 16, KESHAV 12, Nithin Gowda 10, HARISH 7, ...). "Nithin Gowda" is an operation_manager user with no matrix row.

---

## 7. Problem 6 - biometric devices with a stale heartbeat

34 devices: 19 `online`, 15 `offline`. **All 19 "online" devices have `last_seen` between 2026-10-07 07:07:11 and 07:08:06 UTC, about 50 days ago** (one heartbeat batch, then nothing), so the status column is frozen, not truthful. No DB change proposed; check the device bridge / sync job that writes `biometric_devices.status/last_seen`.

| Serial | Device | last_seen (UTC) | Age |
|---|---|---|---|
| ncd8234200855 | 42 Queens Square | 2026-10-07T07:07:45+00:00 | 50 days |
| cqik230960142 | Aratt Milano | 2026-10-07T07:07:36+00:00 | 50 days |
| ncd8251700081 | Birla alokiya | 2026-10-07T07:08:03+00:00 | 50 days |
| ncd8234200704 | Brigade Briclane | 2026-10-07T07:07:34+00:00 | 50 days |
| ncd8252500647 | Brigade Cornerstone Utopia | 2026-10-07T07:08:06+00:00 | 50 days |
| ncd8234200858 | Dsr eden green | 2026-10-07T07:07:54+00:00 | 50 days |
| ncd8240300184 | Elita Promenade | 2026-10-07T07:07:12+00:00 | 50 days |
| cqik230960707 | GR Sankalpa | 2026-10-07T07:07:39+00:00 | 50 days |
| ncd8251700066 | Kolte Patil I Towers | 2026-10-07T07:07:35+00:00 | 50 days |
| ncd8234200869 | Mahendra aarna | 2026-10-07T07:07:30+00:00 | 50 days |
| ncd8234200700 | Nikoo Homes | 2026-10-07T07:07:35+00:00 | 50 days |
| ncd8240300073 | Parkwast | 2026-10-07T07:07:21+00:00 | 50 days |
| ncd8252500650 | Prestige Oasis | 2026-10-07T07:07:34+00:00 | 50 days |
| ncd8252500649 | Purva venezia | 2026-10-07T07:07:44+00:00 | 50 days |
| cexj222260587 | Raja Ritz Avenue | 2026-10-07T07:07:35+00:00 | 50 days |
| ncd8251700370 | SJR Bluewaters by Prime Corp | 2026-10-07T07:07:11+00:00 | 50 days |
| ncd8234200865 | SNN Raj Spiripua | 2026-10-07T07:07:22+00:00 | 50 days |
| cqik230960951 | Sobha Silicon Oasis | 2026-10-07T07:07:39+00:00 | 50 days |
| ncd8240300521 | Sterling Terraces 1 | 2026-10-07T07:07:16+00:00 | 50 days |

Offline devices (for completeness; they are consistent): Artisane forest breeze (2025-08-04); Blue Jay Aster (2026-07-06); Fame India campus (2025-09-03); Head office Exit (2026-03-21); Head Office. (2026-03-21); KP- Mirabilis (2026-10-07); Maratt Pimento (2026-09-05); Nagarjuna Aster Park (2025-09-30); Nhaoa (2025-09-26); Nikoo Homes H ret (2025-09-26); Sri Ramsmriti (2025-03-11); Sumadhura Silver Ripples (2026-07-10); Tata Promont (2026-08-31); The Lake view Address (2026-06-25); Uber Verdant (2026-03-07). KP- Mirabilis went offline at the same moment (2026-10-07 03:13). Chatbot suggestion: answer device status as "last seen <date>" instead of trusting `status`.

---

## 8. Problem 7 - other findings

| Item | Counts | Cause | Recommended owner action |
|---|---|---|---|
| `employee_scores.performance_score` = 50 | 1,049 of 1,116 rows (the other 67 are 100); `attendance_score` = 0 on 434 rows; `overall_score` = 30 on 424 rows | `tasks` table is empty (0 rows), so `calculatePerformanceScore` returns the neutral 50 (`services/employeeScoring.ts` ~L103); users with no punches get attendance 0, giving overall 30 | **Code fix**: when a user has no tasks drop the performance weight (or store NULL); exclude accounts that never punch (client-site / unverified) from scoring. Until then the chatbot should not rank people by score. |
| `users.monthly_ot_hours` | 143 of 143 = 0, while `ot_hours_bank` > 0 for 45 users and 275 punches have `is_ot` | Counter maintained by a trigger (`20260218_ot_to_compoff_conversion.sql`) and reset on the 1st; it is not accumulating this month | **Ignore the column** (the chatbot already derives OT from punches and claims in `tools/hr.ts`); optional code fix to the trigger |
| `extra_work_logs.hours_worked` | 19 of 19 NULL (all "Night Shift", claim OT, Approved) | Claim form does not capture hours; `services/api.ts` ~L7172 sums `hours_worked`, so approved OT counts as 0 h | **Data entry** (approver fills hours) and **code fix** (make hours mandatory or derive from punches) |
| `attendance_daily_summary` | 5,612 rows, 2025-11-11 to 2026-04-30; `attendance_events` runs to 2026-11-26 (52,645 events after 1 May) | Summary job stopped; no assist tool reads this table (only listed in `scopeGuard.ts`) | **Ignore** (or schedule a rebuild); do not add chatbot features on it |
| Matrix site manager / field officer / supervisor | 202 of 202 empty each (hr and accounts in-charge are filled) | Never captured; 22 `site_manager` and 9 `field_officer` user accounts exist with no site link | **Data entry** (or populate from `primary_site_id` once assigned) |
| Takeover dates | 69 matrix rows are after today: 2026-12-01 ... 2032-08-01, one site per month in sequence (Concorde Amber 2027-01, ... Sobha Silicon Oasis 2031-02, Nikoo Homes 1/2/4 = 2028-02/03/04). 156 of the 200 dated rows fall on the 1st of a month; 173 distinct dates. `entities.site_takeover_date` is NULL for 105 of 216 and never in the future; 109 matrix rows disagree with the entity. "Nikoo Homes" (parent) = 2021-02-01 | Sequential placeholder import | **Data entry** of real dates. Fix 07 (optional) clears only the 7 future dates on sites that already have billing or attendance (Prestige Falcon City, Phoenix One Bangalore West, Prestige Park Square, Prestige Tranquility, Purva Atmosphere, Nikoo Homes 1, Sobha Silicon Oasis); the other 62 may be genuine pipeline sites, please confirm |
| Matrix vs organizations | 14 organizations/entities have no matrix row (listed in section 3); `matrix.is_active` true for all 202 | - | Data entry |

---

## 9. Fix 08 (new) - geofence to site map
Additive table `location_site_map(location_id uuid PK -> locations, organization_id text -> organizations)` with 90 geofences (matrix-linked, exact name, obvious variant, "Gate 1/2", "Entry/Exit"). Makes `attendance_events.location_id` and `user_locations` roll up to a site (64 sites have at least one assigned user on a mapped geofence, 773 assignments). 10 medium geofences are listed in section 3.

---

## 10. Verification queries (read-only, run after each step)
```sql
-- 02a
SELECT count(*) FILTER (WHERE organization_id IS NULL) AS still_null, count(*) AS total FROM site_responsibility_matrix;          -- 0 / 202
-- 02b
SELECT 'finance' t, count(*) FILTER (WHERE site_id IS NULL) AS null_ids, count(*) FROM site_finance_tracker
UNION ALL SELECT 'invoice', count(*) FILTER (WHERE site_id IS NULL), count(*) FROM site_invoice_tracker;                       -- 376 / 358 remain (fuzzy review)
-- 03
SELECT count(*) FROM site_finance_tracker WHERE deleted_by_name = 'Data-quality review 2026-11-26';                              -- 21
SELECT site_name, count(*) FROM site_finance_tracker WHERE billing_month = '2026-06-01' AND deleted_at IS NULL AND company_name ~ '^[0-9.,[:space:]]+$' GROUP BY 1;  -- tier B (3) remain, plus tier C (4) unless 03b is applied
-- 04
SELECT count(*) FROM site_responsibility_matrix WHERE ops_manager_name IS NOT NULL AND ops_manager_id IS NULL;                   -- 2
-- 01 / 08
SELECT count(*) FROM users WHERE primary_site_id IS NOT NULL;                                                                    -- 7
SELECT count(*) FROM location_site_map;                                                                                          -- 90
```

## 11. Method notes and limits
- Read-only: only `select` calls through the service-role client plus the PostgREST OpenAPI document (for column types and foreign keys). Intermediate scripts were scratch files; no source files were edited.
- Attendance window: last 60 days (12,817 punches, 71 users). Punches at unnamed geofences (street addresses) could not be attributed to a site and are excluded from shares, so the share percentages are of site-named punches only.
- Geofence to site mapping uses exact names, the matrix `site_id` links, and a reviewed alias list (typos such as "Verety", "Picassa", "Promenade"); medium/ambiguous ones are excluded from SQL.
- The SQL files were syntax-checked with a JavaScript Postgres parser (it does not understand `IS DISTINCT FROM`, `DO $$` or RLS statements, which are standard PostgreSQL) but **never executed** against any database; run them first on a staging copy.
