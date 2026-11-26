# WhatsApp Helpdesk: Setup (Phase 1)

## 1. Meta account (only you can do this; it needs your business login and documents)
1. **business.facebook.com**: create or verify the business (GST certificate or incorporation papers, website, and a domain email).
2. **developers.facebook.com**: Create App → type **Business** → add the **WhatsApp** product.
3. **WhatsApp → API Setup**: add a phone number that is **not** registered on any WhatsApp app (a new SIM, or remove the number from WhatsApp first). Verify it by OTP. Set the display name to "Paradigm Helpdesk" (Meta reviews this).
4. **Business Settings → System Users**: create an *Admin* system user → **Generate token** for the app with the scopes `whatsapp_business_messaging` and `whatsapp_business_management`, with expiry set to never. This is `WA_ACCESS_TOKEN`.
5. Note the **Phone number ID** (`WA_PHONE_NUMBER_ID`) and the **App Secret** (App settings → Basic) (`WA_APP_SECRET`).
6. Add a payment method. Replies within 24 h of the client's message are free; template messages are charged per conversation.

## 2. Secrets
```bash
supabase secrets set \
  WA_ACCESS_TOKEN=... \
  WA_PHONE_NUMBER_ID=... \
  WA_APP_SECRET=... \
  WA_VERIFY_TOKEN=<any random string you choose> \
  GROQ_API_KEY=... \
  HELPDESK_CRON_SECRET=<random long string>
# optional: WA_GRAPH_VERSION=v21.0   HELPDESK_LLM_MODEL=openai/gpt-oss-20b
```
In the SQL editor (the cron job reads these from Vault):
```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<same HELPDESK_CRON_SECRET>', 'helpdesk_cron_secret');
```
Frontend `.env`: `VITE_WA_HELPDESK_NUMBER=91XXXXXXXXXX` (used for QR codes).

## 3. Deploy
```bash
supabase db push        # migrations 20261125120000 + 20261125120500
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy helpdesk-process-inbound --no-verify-jwt
```

## 4. Connect the webhook
Meta app → WhatsApp → Configuration → Webhook:
- Callback URL: `https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`
- Verify token: the value of `WA_VERIFY_TOKEN`
- Subscribe to the **messages** field.

## 5. Configure a pilot site
Admin → WhatsApp Helpdesk Setup:
1. Create the site (code e.g. `LAKESIDE`) and link the entity and the attendance location.
2. Add towers, floors and areas with aliases ("tower a", "block a", …).
3. Print the QR poster, and/or pre-register client numbers.

## 6. Test
Message the helpdesk number: `SITE:LAKESIDE water clogged on tower 1 first floor`
→ a ticket is created and the bot replies with the ticket number. Send the same message from another phone and the bot replies "already reported" (report count 2).
Check **Admin → WhatsApp Helpdesk → Message log** for `failed` or `review` rows.

Without Meta access you can test locally with `scripts/whatsapp-webhook-simulator.mjs`. Replies will be logged as `failed` in `outbound_messages` until the WhatsApp token is set.

## Phase 3: assignment, ETA, photo closure

### Extra deploy
```bash
supabase db push        # + 20261126090000_helpdesk_assignment_eta_closure.sql
supabase functions deploy helpdesk-notify --no-verify-jwt
supabase functions deploy helpdesk-process-inbound --no-verify-jwt   # redeploy (now also drains the outbox)
supabase functions deploy whatsapp-webhook --no-verify-jwt           # redeploy (client Yes/No confirmation)
```

### WhatsApp templates to submit (WhatsApp Manager → Message templates, category **Utility**, language English)
These are needed only for messages sent **more than 24 h after the client's last message**. Inside 24 h the bot sends normal messages.

| Name | Body | Buttons | Secret |
|---|---|---|---|
| `ticket_update` | `Update on your ticket {{1}}: {{2}}` | — | `WA_TPL_TICKET_UPDATE=ticket_update` |
| `ticket_resolved` | `Your ticket {{1}} ({{2}}) has been resolved by our team. Is the issue fixed?` | Quick reply: `Yes, fixed`, `No, not fixed` | `WA_TPL_TICKET_RESOLVED=ticket_resolved` |

Optional: `WA_TPL_LANG=en` (must match the template language code). If a template is not configured, updates outside the 24 h window are recorded as `skipped` in the Notifications log.

### Configure who works on tickets
Admin → WhatsApp Helpdesk → **Assignees** (per site):
- **Technicians:** choose the categories they handle. Leave it empty to cover all categories.
- **Supervisors / managers:** they get the fallback assignment, escalations and the summary alerts. The site supervisor and ops manager from the Site Responsibility Matrix are included automatically.
- Site settings: auto-reassign on punch-out, auto-close hours, and whether clients are told about ETA changes.

### Lifecycle
1. **New ticket:** assigned to a technician who has punched in at the site today and handles the category (least busy first). If none, a supervisor on site; if none, the site supervisor or ops manager, with the note "nobody on site". The assignee gets a push notification and an in-app notification, and a row is created in **Tasks**.
2. **Accept + ETA** (app, ticket drawer): status changes to In Progress, and the client gets "accepted, ETA 4:30 PM".
3. **Reminders** (`helpdesk_tick`, every 5 min): the assignee and managers are alerted if the ticket isn't accepted within the SLA response time. The assignee gets a reminder 15 min before the ETA. Once overdue, the ticket escalates one level and alerts the assignee and managers.
4. **ETA change / hold:** a reason is required, and the client is informed.
5. **Punch-out with open tickets:** the ticket is auto-reassigned to someone on site, or the managers are alerted (per site setting).
6. **Resolve:** an **after photo is mandatory**, enforced by the database. The client gets the photo plus **✅ Yes, fixed / ❌ Not fixed** buttons.
7. **Yes:** Closed. **No:** reopened to the same assignee, managers alerted, and the client can add details or a photo. **No reply:** auto-closed after 24 h (configurable).
8. **Reassign:** only site managers and above, and a reason is required.

## How the bot behaves (Phase 1)
| Client sends | Bot does |
|---|---|
| `SITE:CODE …` (from the QR code) | Links the number to the site, then processes the rest as an issue |
| Issue text with location | AI extracts category, issue type, priority, tower and floor → creates a ticket, or merges into the open duplicate |
| Issue without location | Asks "Which tower / floor?" once. With no answer in 30 min, the ticket is created with location unknown |
| Photo + caption | Same as text; the photo is attached as a *before* photo |
| Photo only | Added to their ticket from the last 15 min, or the bot asks what the issue is |
| `hi` | Help text |
| `status` / `TKT-2611-00012` | Lists their open tickets / that ticket's status |
| Unknown number, no code | Asks for the QR code or `SITE:CODE` (it never lists other clients' sites) |
| Number linked to several sites | WhatsApp list picker: "Which site?" |
| Voice note | Asks them to type (transcription comes later) |
| Staff number (matches `users.phone`) | Treated as a reporter for now. Staff commands come in Phase 5 |
