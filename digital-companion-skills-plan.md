# Implementation Plan: Paradigm Digital Companion & 50+ Office Skills Suite

## Executive Summary
Transform **Paradigm Assist** into a comprehensive **Autonomous Digital Companion** for office and facility employees. The companion will:
1. **Assist & Draft**: Write professional emails, WhatsApp updates, memos, incident reports, and notice board drafts.
2. **Local Notes Hub**: Take quick voice/text notes, categorize them, and store them securely on-device in IndexedDB (with search, pinning, and export).
3. **Reminders & Scheduling**: Set on-device alarms, roster alerts, and task reminders using the Notification API and Capacitor LocalNotifications.
4. **Local Control & Deep-Link App Launcher**: Direct intent triggers for Gmail, UltraViewer, WhatsApp, Calculator, Calendar, and system tools.
5. **50+ Modular Office & Facility Skills**: A catalog of 50+ specialized operational skills grouped into 6 core domains.

---

## 1. The 50+ Office Skills Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PARADIGM DIGITAL COMPANION (AI CORE)                │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   [ Natural Language ]      [ Slash Commands `/` ]     [ Skills Drawer / Tiles ]
           │                         │                         │
           └─────────────────────────┬─────────────────────────┘
                                     ▼
                    Intent Recognition & Skill Dispatcher
                                     │
   ┌──────────────┬──────────────┬───┴──────────┬──────────────┬──────────────┐
   ▼              ▼              ▼              ▼              ▼              ▼
Domain 1       Domain 2       Domain 3       Domain 4       Domain 5       Domain 6
Comms & Email  Task & Notes   Local Control  HR & Roster    MEP & Facility Office Tools
(10 Skills)    (8 Skills)     (8 Skills)     (10 Skills)    (10 Skills)    (8 Skills)
```

### Complete Breakdown of the 50+ Office Skills:

#### Category A: Communication & Drafting (10 Skills)
1. `email_draft`: Professional client, vendor, and escalation email drafter with tone selection.
2. `whatsapp_update`: Concise site status and emergency WhatsApp broadcast formatter.
3. `incident_report`: ISO 9001 standard security, MEP, or safety incident report generator.
4. `meeting_minutes`: Converts raw bullet points or voice transcripts into structured MoM with action items.
5. `circular_memo`: Formal company memo and policy announcement generator.
6. `quotation_followup`: Professional vendor quotation follow-up and price negotiation letter.
7. `handover_note`: Shift handover briefing generator for relieving supervisors.
8. `leave_application`: Formal leave / emergency absence application letter drafter.
9. `apology_resolution`: Client complaint de-escalation response and CAPA letter.
10. `greeting_wishes`: Festival, employee birthday, and work anniversary greeting drafter.

#### Category B: Local Notes & Information Hub (8 Skills)
11. `note_create`: Quick capture text/voice note with automatic tagging and title generation.
12. `note_search`: Fuzzy search across all locally saved notes in IndexedDB.
13. `note_pin`: Pin critical equipment codes, WiFi passwords, and emergency contacts to top.
14. `note_export`: Export notes to Markdown, JSON, or printable PDF.
15. `checklist_create`: Dynamic operational checklist with toggleable checkboxes.
16. `scratchpad`: Floating quick scratchpad for temporary numbers and measurements.
17. `voice_memo`: Speech-to-text recording converted to structured note.
18. `note_archive`: Clean up and archive completed notes.

#### Category C: System Launch & Local App Controls (8 Skills)
19. `launch_gmail`: Opens Gmail compose or inbox directly (`https://mail.google.com` / `mailto:`).
20. `launch_ultraviewer`: Deep-links or launches UltraViewer remote desktop support (`ultraviewer:`).
21. `launch_anydesk`: Deep-links or launches AnyDesk remote desktop (`anydesk:`).
22. `launch_whatsapp`: Opens WhatsApp Web or native app with pre-filled recipient or text.
23. `launch_calculator`: Launches device calculator or embedded floating quick calculator.
24. `launch_calendar`: Opens Google Calendar or device calendar for date scheduling.
25. `launch_maps`: Launches site location map and driving directions.
26. `set_reminder`: Schedules local notification alarm for shift start, patrol time, or task follow-up.

#### Category D: HR, Attendance & Policy Intelligence (10 Skills)
27. `shift_calculator`: Calculates duty hours, A/B/C slot match, and 14h double duty multipliers.
28. `weekly_off_checker`: Evaluates 6-day duty cycle and verifies the 1 W/O per week calendar rule.
29. `punch_regularization`: Generates biometric punch missed-in / missed-out regularization request.
30. `salary_slip_explainer`: Explains basic, HRA, PF, ESIC, and PT deductions from pay slips.
31. `onboarding_checklist`: Guides new hires step-by-step through document submission and verification.
32. `uniform_ppe_rules`: Summarizes PPE, safety shoes, and dress code requirements by role.
33. `overtime_audit`: Distinguishes between standard 1.0 Duty + OT vs 2.0x Double Duty.
34. `leave_balance_check`: Displays casual leave, earned leave, and sick leave guidelines.
35. `holiday_calendar`: Displays gazetted holiday calendar for the selected site.
36. `posh_guidelines`: Explains POSH (Prevention of Sexual Harassment) escalation procedure.

#### Category E: MEP, Security & Facility Operations (10 Skills)
37. `dg_troubleshooter`: Cold start, low oil pressure, and AMF failover diagnostic helper.
38. `stp_calculator`: SV30 settleability, DO probe target, and blower rotation schedule.
39. `lift_rescue_advisor`: Intercom reassurance script, LOTO breaker check, and brake release guide.
40. `fire_panel_triage`: FACP zone locator, 90-second verification timer, and siren escalation.
41. `cctv_blindspot_check`: Camera offline diagnostic and DVR/NVR reboot procedure.
42. `hvac_chiller_log`: Chiller approach temperature, refrigerant pressure, and cooling tower drift.
43. `transformer_oil_check`: BDV test standards, silica gel color inspection (blue vs pink).
44. `wTP_softener_regen`: Water softener backwash, brine suction, and hardness titration steps.
45. `access_control_reset`: Electromagnetic door lock (EM lock) and biometric reader reset SOP.
46. `pest_control_schedule`: Fogging, rodent baiting, and chemical MSDS safety verification.

#### Category F: Office Productivity & Utilities (8 Skills)
47. `unit_converter`: Converts electrical (kVA to kW, HP to kW), pressure (bar to psi), volume (KL to Gallons).
48. `diesel_consumption_calc`: Computes DG fuel consumption based on load percentage and running hours.
49. `electricity_eb_estimator`: Estimates EB tariff, peak demand charges, and power factor penalty.
50. `duty_roster_summarizer`: Summarizes who is on duty today across morning, afternoon, and night shifts.
51. `vendor_directory`: Fast directory search for OEM lift, DG, HVAC, and pest control vendor contacts.
52. `grammar_tone_polisher`: Rewrites informal technician notes into polished corporate language.
53. `text_summarizer`: Condenses lengthy inspection reports into 3 executive bullet points.
54. `qr_barcode_generator`: Generates QR codes for asset tagging and visitor check-in.

---

## 2. Technical Architecture & File Plan

- **`services/skillsRegistry.ts`**: Central registry defining all 54 skills, their trigger intents, icons, parameters, and action handlers.
- **`services/localNotesService.ts`**: IndexedDB storage layer for notes, tags, pinning, and export.
- **`services/reminderService.ts`**: Local notification scheduler using Web Notifications API & Capacitor LocalNotifications.
- **`services/appLauncherService.ts`**: Deep-link launcher for Gmail, UltraViewer, WhatsApp, Calculator, Calendar.
- **`components/assist/SkillsDrawer.tsx`**: Searchable sliding command palette & skills browser categorized by domain.
- **`components/assist/NotesPanel.tsx`**: Collapsible floating/docked local notes drawer.
- **`components/assist/ReminderModal.tsx`**: Fast reminder creation popup.

---

## 3. Approved Architecture & Implementation Decisions

1. **Local App Launcher (Hybrid Smart Launcher)**:
   - When the user asks "open ultraviewer" or "open gmail", the companion generates an **Interactive Action Card** inside the chat stream.
   - The card features a primary 1-click launch button triggering the protocol (e.g. `ultraviewer://`, `mailto:`, or web URL).
   - Prevents browser popup blockers while guaranteeing immediate, seamless access.

2. **Notes & Reminders Storage (On-Device First - IndexedDB)**:
   - All notes, scratchpads, and reminders are stored immediately in local IndexedDB.
   - 100% private and usable completely offline.
   - When online and authenticated, background synchronization with Supabase `user_local_notes` preserves multi-device access.

3. **50+ Skills Discovery (Dual Mode)**:
   - **Slash Commands**: Typing `/` inside the chat input opens an instant search popup of all 54 skills.
   - **Skills Library Drawer**: A header button *"⚡ 50+ Skills"* opens a full categorized drawer (Comms, Notes, System, HR, MEP, Utilities).
   - **Natural Language Matching**: Phrases like "take note:", "remind me to...", "write email to...", "open ultraviewer" automatically route to the corresponding skill.

---

## 5. Execution & Verification Status

- [x] **Phase 1: Core Services**
  - Implemented `services/appLauncherService.ts` (deep-linking protocols for UltraViewer, AnyDesk, Gmail, WhatsApp, Calculator, Calendar, Maps).
  - Implemented `services/localNotesService.ts` (IndexedDB/localStorage storage, pinning, tagging, fuzzy search, Markdown/JSON export).
  - Implemented `services/reminderService.ts` (local scheduler, Web Notifications, synthetic Web Audio chimes, in-app toast fallbacks).
  - Implemented `services/skillsRegistry.ts` (full 54 office & MEP operational skills catalog with slash commands).

- [x] **Phase 2: UI Components**
  - Created `components/assist/ActionLauncherCard.tsx` (high-contrast 1-click launch card bypassing popup blockers).
  - Created `components/assist/NotesPanelModal.tsx` (sliding on-device notes drawer).
  - Created `components/assist/SkillsDrawerModal.tsx` (interactive 54 skills browser with category filters and instant prompt tester).

- [x] **Phase 3: Assist Store & Chat Integration**
  - Wired local intent recognition into `store/assistStore.ts` (detects app launch, note saving, and reminder scheduling).
  - Added `54 Skills` and `Notes` buttons to `pages/assist/ParadigmAssistPage.tsx` header.
  - Rendered `ActionLauncherCard` inside assistant message bubbles.

- [x] **Phase 4: Quality Assurance & Visual Verification**
  - `npx tsc --noEmit` passed with 0 errors.
  - Browser subagent verified `54 Skills` modal, `Notes` modal, and `open ultraviewer` ActionLauncherCard rendering live on `http://localhost:5173/#/assist`.

