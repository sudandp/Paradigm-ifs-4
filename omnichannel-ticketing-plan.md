# Omnichannel Issue Bot & Ticketing — Feature Plan

**Goal:** Client groups on WhatsApp and Telegram, plus email, become ticket sources. A bot reads each message, works out the site, tower, floor and issue, and creates **one** ticket in Supabase (no duplicates). It assigns the ticket to an employee who is **present at that site**, tracks the ETA, sends follow-ups, and closes the ticket **only with a photo as proof**. Site managers and above see everything; an admin decides who can view, edit and reassign.

**Example:** in the *"Prestige Lakeside — Client Group"* WhatsApp group, someone writes *"water clogged on tower 1 first floor"*.
→ Ticket `PFM-T-01234` is created: Site = Prestige Lakeside, Tower 1, Floor 1, Category = Plumbing, P2, reporter = that sender.
→ The ticket is assigned to the plumber or technician checked in at that site today, and the ETA is set.
→ The bot replies in the group: *"Ticket PFM-T-01234 raised. Assigned to Ravi. ETA 4:30 PM."*
→ Later, Ravi uploads an after-photo, the bot posts it to the group, and the ticket is **Resolved** (or **Closed** once the client confirms).

---

## 0. What already exists (build on it, don't duplicate)

| Existing piece | Where | How it's reused |
|---|---|---|
| `ops_tickets` (title, category, priority, status, assigned_to, attachments, entity_id) | `supabase/migrations/20260423_ops_module.sql` | The core ticket table. We extend it. |
| SLA policies + due dates trigger, escalation level, closure OTP, rating | `20261024230000_helpdesk_sla_closure_otp.sql` | ETA/SLA and escalation come from here. |
| `run-escalations` edge function | `supabase/functions/run-escalations` | Extended to handle reminders and channel replies. |
| `send-email`, `send-notification`, FCM tokens | `supabase/functions/*` | Used for outbound email and push. |
| `attendance_events` | services | Shows who is **present at a site right now**. |
| `site_responsibility_matrix`, `site_staff_config` | services | Shows who handles which category at which site. |
| `entities` = sites | — | The site master. |
| Groq LLM wrapper | `api/groq.ts` | Extracts the issue, location and category from free text. |
| Helpdesk UI (`HelpdeskTickets.tsx`, `TicketDetail.tsx`, `ClosureOtpModal.tsx`) | pages/components | Extended rather than rebuilt. |

---

## 1. Architecture (one pipeline, many channels)

```
 WhatsApp ─┐                                    ┌─> Ticket engine (dedupe → create/merge → assign)
 Telegram ─┼─> Channel adapters ─> inbound_messages ─> AI extractor ─┤
 Email ────┘   (webhooks, edge fn)   (raw, idempotent)  (Groq)      └─> Reply / ask-for-info back to same channel
                                                                         │
 App (staff) <── ops_tickets / ticket_events / tasks ──> Outbound notifier (WA / TG / Email / Push)
```

Design rules:
- **Every channel normalises to one message shape** (`channel, chat_id, sender_id, sender_name, text, media[], received_at, external_msg_id`). Everything after the adapter is channel-agnostic, so adding Slack, SMS or an IVR (Exotel) later is just a new adapter.
- **Idempotency:** a unique key on `(channel, external_msg_id)` stops webhook retries from creating a second ticket.
- **Raw first, process second:** the webhook stores the message and returns 200 immediately. A worker (DB trigger, `pg_net`, or cron edge function) does the AI work. Channels retry quickly, so the webhook must never be slow.

---

## 2. Feature list (by module)

### F1 — Channel connectors

| Channel | How | Notes / decision needed |
|---|---|---|
| **Telegram** | Bot API with a webhook to the edge function `channel-telegram`. Add the bot to the client group and turn off privacy mode (BotFather `/setprivacy`) so it can read all messages. | Easiest option, free, and full group support. **Build first.** |
| **WhatsApp** ✅ *decided: official Cloud API, first channel* | One "Paradigm Helpdesk" number on the **Meta WhatsApp Cloud API**, with a webhook to the edge function `channel-whatsapp`. Code follows Meta's native payload; the provider is still open, and a BSP that passes Meta's format through only needs an adapter swap. | It's 1-to-1, not groups, so the site is identified per sender. See **F1a** below. |
| **Email** | Inbound parse webhook (Resend, SendGrid or Postmark inbound) to the edge function `channel-email`, or IMAP polling of `helpdesk@yourdomain`. | Each site gets an address alias (`lakeside@help…`) or the subject is parsed. Replies on the same thread are added as follow-ups using the `In-Reply-To` header. |
| **In-app** | Existing NewTicketModal / Resident helpdesk | Goes through the same engine, so the dedupe rules match. |

### F1a — WhatsApp (official API) specifics
- **Site identification without groups:**
  1. **QR code / link per site:** `wa.me/<helpdesk>?text=SITE:LAKESIDE%20` is printed on posters at each site and tower and generated from the admin UI. The first message carries the site code.
  2. **Remembered sender:** once a phone number is known in `channel_contacts` (client contacts can also be pre-registered by admin), later messages auto-map to that site. If the number belongs to more than one site, the bot sends an interactive **list message**: "Which site?".
  3. **Unknown sender with no code:** the bot replies with a site picker (interactive list), or for many sites, "reply with your site name".
- **Interactive messages:** use WhatsApp **buttons and lists** instead of free text where possible: pick tower, pick floor, confirm "Resolved? ✅ Yes / ❌ No". This is fewer AI errors and faster for clients.
- **24-hour window:** within 24 h of the client's last message, replies are free-form. After that (ETA updates, resolved notice, confirmation ask), we must use **Meta-approved templates**. Templates to get approved on day 1: `ticket_created`, `ticket_assigned_eta`, `ticket_eta_changed`, `ticket_resolved_confirm` (with buttons), `ticket_reopened`, and a staff `task_assigned` template.
- **Media:** photo and voice messages are downloaded via the Graph API media endpoint immediately (the media URL expires) and stored in Supabase Storage `ticket-media/`.
- **Staff numbers:** staff phones from the `users` table are recognised as staff, so their messages are commands (F10), not complaints.
- **Security:** verify `X-Hub-Signature-256` with the app secret on every webhook, and use the GET verify-token handshake. The webhook returns 200 within ms and processing is async.
- **Setup checklist (your side):** Meta Business Manager verification → WhatsApp Business Account → a dedicated phone number (not on any WhatsApp app) → a permanent System User token → webhook URL + verify token → template submissions.
- **Client groups still exist:** the helpdesk number can't read them, so post the QR/link in each group: "For issues, message Paradigm Helpdesk." Staff can also **forward** a group message to the helpdesk number, and the bot treats forwarded messages from staff as "raise on behalf of client".

**Channel binding (site mapping):** table `channel_bindings(channel, chat_id, entity_id, default_tower, is_active, created_by)`.
- An admin links each group/email alias to a site once, or the bot asks *"Which site is this group for?"* the first time it's added and an admin approves.
- A group that isn't linked never creates tickets. Its messages sit in a "Unmapped" inbox for admin review.

**Sender mapping:** table `channel_contacts(channel, sender_id, phone/email, name, entity_id, role: client|staff|resident, user_id?)`. If the sender is a staff member, their messages are treated as updates, not new complaints.

### F2 — Message understanding (AI extraction)
- The LLM (Groq, already wired) returns strict JSON: `is_issue (bool), title, category, sub_category, tower, floor, unit/area, priority_hint, language, needs_more_info[]`.
- **Filters out chatter:** "good morning", "thanks", and forwards are ignored, with no ticket. Only `is_issue = true` with confidence above a threshold continues. Low-confidence messages go to a review queue.
- **Supports multiple languages:** Kannada, Hindi, Tamil and Hinglish are normalised to English in the title, and the original text is kept.
- **Photos/voice:** the image is attached to the ticket. A voice note is transcribed (you already have Sarvam/Whisper-style tooling) and then extracted.
- **Missing info loop:** if the tower or floor is missing, the bot asks in the channel: *"Which tower and floor? Reply e.g. 'T1 F1'."* It holds a `draft` ticket for 30 min, then creates the ticket with "Location: unknown" so the issue isn't lost.
- **Location master:** `site_locations(entity_id, tower, floor, area, aliases[])` so "Tower A", "T-1" and "first block" all resolve to the same place.

### F3 — Duplicate prevention
Before creating a ticket, check for an **open** ticket (status not Resolved/Closed) with:
1. the same `entity_id` + `tower` + `floor` + `category`, **and**
2. similar text (`pg_trgm` similarity > 0.5, or embedding cosine) **or** created within the last N hours (configurable per category; default 24 h).

If there's a match:
- No new ticket. The message is **linked** to the existing ticket as a `ticket_event` (type `duplicate_report`), and the reporter is added to `ticket_reporters`.
- The bot replies: *"Already reported as PFM-T-01234 — status In Progress, ETA 4:30 PM."*
- The report count is shown in the UI ("Reported by 4 people"), which can **auto-raise priority** (for example, 3 or more reporters means +1 priority).

Also: a DB unique partial index or advisory lock on `(entity_id, tower, floor, category)` for open tickets. This prevents a race when two people report at the same second. A manual **Merge tickets** action is available for managers.

### F4 — Ticket creation & data captured
Extend `ops_tickets` with:
`source_channel, source_chat_id, source_message_id, tower, floor, area, reporter_contact_id, report_count, eta_at, eta_set_by, pending_reason, last_followup_at, proof_required (default true)`.

New tables:
- `ticket_events` — a full timeline: created, message, duplicate_report, assigned, reassigned, eta_set, eta_changed, status_changed, photo_uploaded, followup_sent, escalated, client_confirmed, reopened.
- `ticket_reporters` — every person who reported the issue, so they can all be notified on closure.
- `ticket_media` — before/after photos with `kind: before|progress|after`, `uploaded_by`, geo and timestamp.

The number format follows the existing `ticket_number` scheme.

### F5 — Auto-assignment to staff present on site
When a ticket is created, the assignment engine:
1. finds candidates: employees whose **latest `attendance_events` today at that `entity_id` is a check-in** (present now);
2. filters them by skill: the `site_responsibility_matrix` / `site_staff_config` role that matches the category (Plumbing → plumber/technician);
3. ranks them by the fewest open tickets, then by role seniority;
4. assigns the ticket, sends push + WhatsApp/Telegram DM to the assignee, and creates a **task** in their task list.

Fallbacks:
- If nobody suitable is present, assign to the **site supervisor/manager** and flag "No technician on site".
- If nobody at all is present, the ticket goes to the escalation queue and the manager is notified.

**Sticky until resolved:** the ticket stays with the assignee until it's resolved. If they **check out** with the ticket still open, the engine notifies the manager and either auto-reassigns to the next present employee (configurable) or keeps it and marks "carry over to next shift".

**Reassign:** done manually by anyone with the *reassign* permission (F8). A reason is required and logged in `ticket_events`.

### F6 — ETA tracking, follow-ups & escalation
- The assignee sets the ETA when accepting, within one tap (quick picks: 30 min, 1 h, 2 h, Today, Tomorrow). If they don't, the default ETA = the SLA `resolution_due_at`.
- **Accept timer:** if the assignee doesn't accept within X min (from the SLA response time), send a reminder, then escalate.
- **Follow-up scheduler** (extend `run-escalations` / `process-automated-pings`, cron every 5 min):
  - 15 min before the ETA: remind the assignee;
  - ETA passed and not resolved: mark **Overdue**, ask the assignee for a new ETA plus a reason, and notify the manager;
  - SLA breach: escalation level +1 (supervisor → site manager → ops head), using the existing `escalation_level`.
- Any ETA change is posted to the client channel (optional per site): *"Update on PFM-T-01234: new ETA 6 PM (reason: part awaited)."*
- **Pending reasons:** Awaiting material, Awaiting client access, Vendor required, and so on. These pause the SLA clock where configured (`On Hold`).

### F7 — Photo-proof closure (no photo = still pending)
- The assignee taps **Mark complete** in the app (or sends a photo to the bot in a DM with "done PFM-T-01234").
- An **after photo is mandatory**. Without it, the status cannot move past `In Progress`, and the ticket is reported as **Pending**. The photo is taken with the in-app camera (timestamp + geo-tag, optionally checked against the site geofence) to prevent reuse of old photos.
- Once the photo is uploaded, the status is `Resolved`. The bot posts the before/after photos to the client channel: *"PFM-T-01234 resolved ✅ — reply 'OK' to confirm or 'NOT OK' to reopen."*
- **Client confirmation:** "OK", or no response within 24 h (configurable), moves the ticket to `Closed`. "NOT OK" moves it to `Reopened`, keeps the same assignee, and notifies the manager. The existing closure OTP and rating can be optional extra steps.
- **Manager override close:** reuses the existing `admin_override` + reason + photo fields.

### F8 — Visibility & permissions (admin-configurable)
Table `ticket_access_rules(entity_id nullable, role_id nullable, user_id nullable, can_view, can_edit, can_reassign, can_close_override)`.
- **Defaults:** Site Manager and above get **view** on their sites; Ops Head and Admin get everything.
- The admin UI (in `RoleManagement.tsx` or a new *Ticket Access* tab) lets you pick a site or all sites, then a role or a specific user, then tick view / edit / reassign / override.
- Enforced by **Supabase RLS** on `ops_tickets`, `ticket_events` and `ticket_media` through a helper function `can_access_ticket(ticket, action)`, so it's enforced on the server, not only hidden in the UI.
- Assignees always see their own tickets. Field staff see only tickets assigned to them.
- **Client-side visibility:** clients see only what the bot posts in their group, with no internal notes. `ticket_events.is_internal` flags internal comments.

### F9 — Outbound notifications (one notifier, many channels)
Edge function `channel-send` with a provider per channel. Templates are stored in a `message_templates(event, channel, language, body)` table. WhatsApp templates must be pre-approved by Meta for messages sent outside the 24 h window.

| Event | Client channel | Assignee | Manager |
|---|---|---|---|
| Ticket created / duplicate | ✅ | — | optional |
| Assigned / reassigned | ✅ (name + ETA) | ✅ push + DM | ✅ on reassign |
| ETA changed / overdue | ✅ optional | ✅ | ✅ overdue |
| Escalated | — | ✅ | ✅ |
| Resolved (with photo) | ✅ | — | ✅ |
| Reopened | ✅ | ✅ | ✅ |

Quiet hours, rate limiting per group, and a digest mode (for example, a 9 AM summary to managers: *"Lakeside: 5 open, 2 overdue"*).

### F10 — Staff-side bot commands (optional, high value)
Staff can update tickets from WhatsApp or Telegram without opening the app:
- `my tickets` — lists their open tickets
- `eta 1234 2h` — sets the ETA
- send a photo with the caption `done 1234` — completes the ticket with proof
- `hold 1234 material` — puts it on hold with a pending reason

### F11 — Dashboards & reports
- **Ticket board** (extend `HelpdeskTickets.tsx`): filters for site, tower, channel, status, overdue and assignee. Kanban + list views.
- **Ticket detail** (extend `TicketDetail.tsx`): timeline, reporters, before/after gallery, ETA history, reassign button (permission-gated).
- **Manager dashboard:** open/overdue by site, average resolution time, SLA compliance %, top recurring issues per tower/floor (useful for planning preventive maintenance), technician leaderboard.
- **Recurring issue detection:** for example, the same tower, floor and category 3 times in 30 days creates a suggested PPM task (links to the existing `ops_maintenance_schedules`).
- Export to Excel; monthly client report per site.

### F12 — Admin & ops tooling
- Channel binding manager (link groups or email aliases to sites; see the unmapped inbox).
- AI review queue (low-confidence messages: one click to create a ticket, ignore, or merge).
- Site location master (towers, floors, aliases).
- Message template editor.
- Bot health page: webhook last-seen time, WhatsApp session status (for Option B), failed sends with a retry button.

---

## 3. Data model summary (new / changed)

```
ops_tickets            (+ source_channel, source_chat_id, source_message_id, tower, floor, area,
                          reporter_contact_id, report_count, eta_at, pending_reason, proof_required, ...)
channel_bindings       chat/group/email alias  -> entity_id
channel_contacts       sender on a channel     -> name/phone/user_id/role
inbound_messages       raw message log (unique channel+external_msg_id), processing status, ai_json
site_locations         entity_id, tower, floor, area, aliases[]
ticket_events          timeline / audit (is_internal flag)
ticket_reporters       many reporters per ticket
ticket_media           before / progress / after photos
ticket_access_rules    who can view / edit / reassign per site / role / user
message_templates      per event / channel / language
outbound_messages      send log + retry status
```
Indexes: a partial index on open tickets `(entity_id, tower, floor, category) WHERE status NOT IN ('Resolved','Closed')`; `pg_trgm` on `title`.

---

## 4. Edge functions / services

| Function | Purpose |
|---|---|
| `channel-telegram` | Telegram webhook: normalise the message, insert into `inbound_messages` |
| `channel-whatsapp` | Meta/BSP webhook (verify token + signature): normalise, insert |
| `wa-bridge` (Node, PM2) | *Only for Option B:* a Baileys session that posts to `channel-whatsapp` |
| `channel-email` | Inbound email parse webhook: normalise, insert |
| `process-inbound` | AI extract → dedupe → create/merge → assign → reply |
| `ticket-assign` | Assignment engine (also called when staff check out) |
| `channel-send` | Outbound notifier for all channels + retries |
| `run-escalations` (extend) | ETA reminders, overdue, SLA escalation, auto-close after confirmation timeout |

Secrets go in Supabase function secrets: `TELEGRAM_BOT_TOKEN`, `WA_TOKEN`/`WA_PHONE_ID`/`WA_APP_SECRET`, `INBOUND_EMAIL_SECRET`. Verify the signature on every webhook.

---

## 5. Delivery phases

| Phase | Scope | Outcome |
|---|---|---|
**WhatsApp-first order.** Start the Meta setup (business verification + template approval) on **day 1**, because it can take days to approve and runs in parallel with P1.

| Phase | Scope | Outcome |
|---|---|---|
| **P0 — Meta setup** (you, in parallel) | Business verification, helpdesk number, permanent token, submit templates | API credentials ready |
| **P1 — Core engine + WhatsApp inbound** (1.5 wk) | Schema changes, `inbound_messages`, `channel_contacts`, `site_locations`, `channel-whatsapp` webhook (signature check, media download), AI extraction, dedupe, ticket creation, `ticket_events` | A WhatsApp message creates the right ticket with no duplicates |
| **P2 — WhatsApp replies & conversation** (1 wk) | `channel-send` (WhatsApp), site QR/link generator, interactive tower/floor pickers, ask-for-info loop, created/duplicate replies, 24 h window + template fallback | Client gets a ticket number and status on WhatsApp |
| **P3 — Assignment + ETA + photo closure** (1.5 wk) | Present-staff assignment, stickiness on checkout, staff WhatsApp template + push, ETA, reminders, overdue/escalation, mandatory after-photo, client ✅/❌ confirm buttons, reopen | Full lifecycle on WhatsApp |
| **P4 — Permissions + UI** (1 wk) | `ticket_access_rules` + RLS, admin access UI, ticket board/detail upgrades, manager dashboard | Managers can use it daily |
| **P5 — Staff WhatsApp commands** (0.5 wk) | `my tickets`, `eta`, photo + `done`, `hold`, forward-on-behalf | Staff work from WhatsApp |
| **P6 — Email + Telegram** (1.5 wk) | New adapters into the same engine | All 3 channels |
| **P7 — Insights** (ongoing) | Recurring-issue → PPM suggestions, client monthly reports, priority boost on multiple reports | Proactive maintenance |

Pilot on **one site** (QR posters + its client contacts pre-registered) after P3, tune the AI prompts and dedupe thresholds on real messages, then roll out.

---

## 6. Decisions you need to make

1. ~~WhatsApp approach~~ → **Decided: official Cloud API, built first.** Still open: **provider** (Meta direct vs Gupshup/Interakt/AiSensy). The code targets Meta's format, so this can be decided later.
2. **Closure rule:** is the after-photo alone enough, or are photo **and** client confirmation (or OTP) required?
3. **When the assignee checks out with an open ticket:** auto-reassign to the next present staff member, or keep it and only alert the manager?
4. **Dedupe window** per category (default 24 h), and whether multiple reporters auto-raise priority.
5. **Should clients see the technician's name and phone** in group replies, or only the name?
6. **Bot language** in replies (English only, or reply in the sender's language).

---

## 7. Risks & mitigations
- **AI misreads a message:** a confidence threshold, the review queue, a manager "edit extracted fields" option, and prompt tuning on real data.
- **Group spam/noise:** the `is_issue` filter, rate limits, and ignoring messages from mapped staff unless they're commands.
- **WhatsApp ban (Option B):** a dedicated number, low send rate, a fallback to Telegram/email, and monitoring of session health.
- **Wrong assignee due to stale attendance:** use the latest event only, require a check-in today, and let the manager override.
- **Privacy:** client phone numbers are stored only in `channel_contacts` (protected by RLS); internal notes are never sent to client channels.
