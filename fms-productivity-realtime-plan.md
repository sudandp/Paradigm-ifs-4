# FMS Productivity Command Center: Real-Time Data Plan

**Target:** `components/dashboard/FmsProductivityDashboard.tsx` (rendered from `pages/attendance/AttendanceDashboard.tsx:5721`)
**Today:** All widgets use hardcoded arrays (lines 76–215). Only the site dropdown loads real data (`api.getOrganizations()`). **Sync Live** and every action button only show a toast.

---

## 1. Architecture

```
Supabase tables ──► RPC get_fms_productivity_snapshot(p_entity_id, p_date)  ──► JSON per pillar
      │                                                                           │
      └──► Realtime postgres_changes (filtered by entity) ──► debounce 2s ──► react-query invalidate
                                                                                  │
                         useFmsProductivity(siteId) hook  ◄───────────────────────┘
                                   │
                    FmsProductivityDashboard (pure rendering, no data arrays)
```

- **A single aggregate RPC, not 30 client queries.** Aggregation runs in Postgres. RLS and company scope apply once, so the page needs one round trip. Pillars can be split into separate RPCs later if any one gets slow.
- **Realtime by invalidation, not row patching.** Subscribe to change events on the source tables. On any event, refetch the snapshot, debounced to about 2 s. The project already uses `supabase.channel(...)` in 35 places, so follow that pattern.
- **Clock-driven values computed on the client.** The SLA countdown (#7), "x days ago" and overdue flags depend on the time, not on data changes. Compute them from timestamps (`resolution_due_at`, `last_visit_at`) on a 30 s tick. Don't refetch for them.
- **A 60 s background poll** as a fallback in case the realtime socket drops (mobile/Capacitor).
- **react-query** (`@tanstack/react-query` is already installed) handles caching, `isFetching` for the Sync Live spinner and stale-while-revalidate.

### Site filter: decide this first
The dropdown lists **organizations**. The ops tables (`ops_tickets`, `ops_assets`, `ops_contracts`, …) key on **entityId** (`entities` table). Confirm how a "site" maps across `organizations`, `entities` and `locations`, then point the dropdown at the table the RPC filters on. This one decision affects every widget.

---

## 2. Widget → data source map

Status: ✅ data exists, query only · 🟡 data exists, needs a derivation rule or config · 🔴 no source yet

### Pillar 1: Site Visits & Routes
| # | Widget | Source | Status |
|---|---|---|---|
| 1 | Site visit freshness | Latest supervisor check-in per site from `attendance_events` / `field_reports` | 🟡 define which roles count as a "supervisory visit" |
| 2 | Daily visit quota (5/8) | Distinct site visits today per officer; target from `settings` | 🟡 add a per-role target setting |
| 3 | Live team radar | `user_locations` (latest per user) + `route_history` | ✅ |
| 4 | Pending field reports | `field_reports` where status = pending | ✅ |
| 5 | Avg site dwell time | Check-in → check-out pairs at a site (`attendance_events`) or geofence segments in `route_history` | 🟡 |

### Pillar 2: Tasks & SLA
| # | Widget | Source | Status |
|---|---|---|---|
| 6 | High-priority overdue | `ops_tickets` + `tasks`: open and `due_date < now()` | ✅ |
| 7 | SLA breach threat < 2h | `ops_tickets.resolution_due_at - now() < 2h`, not resolved; vendor from `assigned_to` | ✅ |
| 8 | Completion velocity | `ops_tickets.resolved_at` today, bucketed by hour | ✅ |
| 9 | Post-audit corrective actions | `ht_snag_items` / `snag_audits` open items | ✅ |
| 10 | Complaint hotspots | `ops_tickets` grouped by entity + category, last 30 days | ✅ |

### Pillar 3: PPM & Assets
| # | Widget | Source | Status |
|---|---|---|---|
| 11 | Today's PPM queue | `ht_ppm_schedules` / `ops_maintenance_schedules` due today | ✅ confirm which scheduler is canonical |
| 12 | PPMs delayed | Same tables, past due with no `ppm_executions` / `ops_maintenance_logs` row | ✅ |
| 13 | Asset QR scan compliance | Scans (`ops_asset_ppm_logs`) ÷ scheduled inspections | 🟡 |
| 14 | Machinery uptime | `ops_assets` status + downtime from `ops_tickets` linked by `asset_id` | 🟡 define the downtime window |
| 15 | Expiring AMC | `ops_contracts` with end date within 60 days | ✅ |

### Pillar 4: Manpower & Shifts
| # | Widget | Source | Status |
|---|---|---|---|
| 16 | Manpower deficit | Required from `site_staff_config` vs present today (reuse `get_attendance_dashboard_data`) | ✅ |
| 17 | Night patrol QR rate | `gate_patrol_scans` ÷ `gate_patrol_checkpoints` for the night shift | ✅ |
| 18 | Shift handover register | No table | 🔴 needs a `shift_handovers` table + a mobile form |
| 19 | Fatigue watch | `attendance_events`: worked > 12 h, or back-to-back shifts | 🟡 |
| 20 | Morning punctuality | First punch vs shift start (`shift_rule_configs`); use the existing attendance engine | ✅ |

### Pillar 5: Quality & Snagging
| # | Widget | Source | Status |
|---|---|---|---|
| 21 | Snag aging | Open snag items bucketed by `created_at` age | ✅ |
| 22 | Safety hazards | Snag items with category safety / severity high | 🟡 needs a reliable category or severity field |
| 23 | Cleanliness leaderboard | `ht_yard_audits` / `ht_audit_responses` scores per site | 🟡 define the score formula |
| 24–25 | **Not in the UI** | The header says "30 items" but #24 and #25 are never rendered | Fix the label or add widgets |

### Pillar 6: Approvals, Gate & Score
| # | Widget | Source | Status |
|---|---|---|---|
| 26 | Approvals waiting on you | `leave_requests` + `ops_approval_requests` + `gate_material_passes` pending for `auth.uid()` | ✅ |
| 27 | Gate incident stream | `gate_entries` + `gate_emergency_alerts` today | ✅ |
| 28 | Client survey compliance | No survey table; proxy from `ops_tickets.rating` | 🔴 / proxy |
| 29 | Quick dispatch | Action, not a metric (see section 3) | n/a |
| 30 | Daily productivity score | Server-side weighted formula of visits %, tasks closed %, PPM on time % | 🟡 store weights in `settings` |

**Totals:** 15 ✅, 10 🟡, 2 🔴, plus the #24–25 label problem.

---

## 3. Make the buttons real

| Button | Wire to |
|---|---|
| Sync Live | `queryClient.invalidateQueries(['fms-snapshot'])`. Show the spinner from `isFetching`. |
| Review & Authorize / Approve leave / Gate pass / Invoice | Existing approve endpoints for `leave_requests`, `ops_approval_requests`, `gate_material_passes` |
| Ping Escalation (#7) | `ops_tickets` escalation (`is_escalated`, `escalation_level`) + `notificationService` / `escalation_matrix` |
| Reminder SMS (#1) | `notificationService` / existing SMS provider. Log to `communication_logs`. |
| Relief guard dispatch (#16) | Roster service (`attendanceRosterService`) |
| Quick Dispatch modal | Visit check-in → `attendance_events`; Work order → `opsApi.saveTicket`; Snag → `opsApi.saveSnagEntry` |

Until a button is wired, disable it with a "Coming soon" tooltip so it never shows a false success toast.

---

## 4. Phased rollout

**Phase 0: Stop misleading users (½ day)**
- Add a `source: 'live' | 'sample'` flag per widget. Widgets that aren't wired yet show a small **Sample data** chip.
- Remove the global "Live" badges until Phase 1 ships.
- Fix the "30 Items" label (#24–25).

**Phase 1: Foundation + ✅ widgets (3–4 days)**
- Resolve the site/entity mapping.
- Migration: `get_fms_productivity_snapshot(p_entity_id uuid, p_date date) returns jsonb`, `SECURITY INVOKER` so RLS applies. Return pillars 2, 3, 6 and the ✅ items from 1, 4 and 5.
- Check that the indexes these queries need exist (`ops_tickets(entity_id, status, resolution_due_at)`, `attendance_events(user_id, timestamp)`, …).
- `hooks/useFmsProductivity.ts`: react-query + realtime channel + 60 s poll + 30 s clock tick.
- Refactor the component: delete the hardcoded arrays and read from the hook. Add loading skeletons and an empty state for each widget ("No SLA tickets at risk" instead of fake data).

**Phase 2: 🟡 derivations (3–4 days)**
- Agree on the business rules (visit definition, dwell, uptime window, fatigue threshold, cleanliness formula, score weights) and store the tunable values in `settings`.
- Extend the RPC.

**Phase 3: Actions (2–3 days)**
- Wire the buttons in section 3. After each action, invalidate the snapshot. Log each action to `audit_logs`.

**Phase 4: 🔴 new data (scope separately)**
- `shift_handovers` table + mobile handover form (#18).
- Client survey table + form, or formally adopt the ticket-rating proxy (#28).

---

## 5. Realtime subscription list

`ops_tickets`, `tasks`, `attendance_events`, `user_locations`, `field_reports`, `leave_requests`, `ops_approval_requests`, `gate_material_passes`, `gate_entries`, `gate_emergency_alerts`, `gate_patrol_scans`, `ht_snag_items`, `ppm_executions`, `ops_maintenance_logs`

- Check that each table is in the `supabase_realtime` publication. Add any missing ones in the Phase 1 migration.
- Filter by `entity_id=eq.<site>` when a single site is selected. `user_locations` is high-volume, so throttle it separately (radar only, 10 s).

---

## 6. Risks / open questions
1. **Site identity:** organizations, entities and locations (see section 1). This is the main blocker.
2. **Two PPM systems:** `ht_ppm_*` and `ops_maintenance_*`. Which is the source of truth?
3. **RLS scope:** an admin sees all sites, a supervisor only theirs. The RPC must respect `companyScope` / `user_site_permissions`.
4. **Realtime load:** about 14 subscriptions per open dashboard. If it gets heavy, use one server-side `broadcast` channel fed by triggers instead.
5. **Mobile:** sockets drop when the app is backgrounded, so refetch on `appStateChange` (Capacitor) in addition to the poll.
