# Domwork Telegram integration — implementation status

This is the Russian-only `@Domworkuz_bot` integration. The existing lead-generation
and HR bots use their own credentials and are not changed.

## Current implementation

- Additive PostgreSQL schema; no rewriting of students, lessons, payment history or HR records.
- Verified private contact authentication, live CRM role checks, paid-student eligibility,
  ambiguous phone/account rejection and one Telegram identity per CRM account.
- Durable, deduplicated webhook inbox. CRM/session/outbox work is transactional.
- Durable outbox using Telegraf, Redis global/per-chat throttling, retry on explicit
  Telegram rate rejection only; ambiguous transport outcomes are held for review.
- Queued private replies recheck both role **and** account before delivery. Sent
  contents are erased from the outbox. No private cabinet information is posted in groups.
- Student menus: original credentials (only if last-four password still verifies),
  grades, receipt history/debt, schedule, own attendance, group links, existing contract PDF.
- Book delivery matches explicit student/lead identifiers, never a namesake.
- Staff read menus use own employee/manager scope; payroll reads the existing KPI
  calculation, including dual-role earnings. ROP aggregate views are Russian-only.
- Leave requests are stored durably with author and dates; no automatic approval.
- Observed Telegram groups do not bind themselves by title. Existing teacher group
  management supports multiple trial/classroom groups and explicit defaults.
- Admin-only status, webhook setup and learning-group bot-permission verification APIs.
- Teacher trial accept/reject/result inline callbacks use the existing CRM transaction,
  exact booking and current assigned teacher; manager and teacher notes are preserved.
- Responsive CRM bot controls: operational bindings, live permission verification,
  automation/material settings, broadcast preview/confirmation and leave review.
- Text/photo/video/voice broadcasts from Telegram, text broadcasts from CRM, future
  scheduling, frozen audience, owner-bound confirmation, cancellation and delivery status.
- Transactional source events for new Russian receipts, assignments, trial requests/results
  and attendance; historical imports do not generate sales celebrations.
- Student/trial reminders, missing primary/assistant-attendance reminders, daily trial promotion,
  20:00 calendar-day reports and 21:00 audit-based rolling 24-hour ROP comparison.
  Unknown historical receipt times are excluded from the rolling comparison, not guessed.
- Group digests, configurable family/methodical posts and Sunday platform reminders.
- Trial removal is opt-in and requires live restriction permission, exact completed booking
  and a proven membership update for the linked learner; it does not permanently ban them.
- Redis throttling and post-commit FSM mirror; PostgreSQL remains authoritative. Failed
  transactions/savepoints never populate the cache; cached state never grants permissions.
- Individual sales plans and bonus history use existing CRM data. Marketing distinguishes
  common CRM advertising spend from Russian spend; unscoped spend is not invented Russian CPL.
- Four Monday-based weekly and three calendar-month target-lead cohort reports use
  persisted lead-audit statuses only, as of the respective period end. Current periods
  stop today; current column totals do not fabricate historical conversion. Audit
  coverage and retained soft-deleted leads are explicitly explained.
- Admin academic digest counts unique Russian student-days for both duties, separates
  contradictory marks and does not infer absence from missing marks. Paid course starts
  use existing explicit start dates. Month-to-date signed receipts and a still-current
  confirmed sales plan are shown together. Admin-only read-only acceptance preview:
  `GET /api/domwork/bot/reports/preview`; it sends no messages or changes.
- Teacher/assistant seven-day calendar shows dated and recurring reservations and
  schedule-unoccupied intervals in the existing CRM 08:00–24:00 window. Only configured
  workday patterns and durations permit free intervals; incomplete reservations fail
  closed. Other-language reservations block time without exposing pupil identities.
  Primary lesson times are never treated as assistant lesson times. No auto-booking.
- Teacher ratings use explicit historical teacher ownership and Russian pupils only.
  Assistant ratings without historical ownership return an honest unavailable notice,
  never the main-teacher score. Already-queued private reports recheck reportsEnabled.
- Pending notifications recheck account/role, booking, assignment, attendance correction,
  lesson time and relevant automation switch before delivery.
- Authorized private menu buttons take precedence over unfinished broadcast, leave
  and group-chooser sessions. Selecting a button abandons only that user's unfinished
  workflow and opens the selected section without `/cancel`. Saved broadcasts,
  applications, CRM records and other users' sessions are preserved. Free-text/media
  workflow answers still work; old group-chooser replies are rejected after navigation.
  The group chooser retains the admin menu alongside its Telegram chat-picker button.

## Not complete / not activated

These are required before claiming Task 3 is complete:

- The user's ten supplied groups were explicitly bound and permission-checked on
  2026-10-11 (five departments and five teacher-specific trial groups). Actual main
  class groups and per-student membership/assignment still require admin acceptance.
- Milestone congratulations, employee onboarding/release notifications and daily/weekly/monthly
  awards.
- Accurate assistant rating attribution/history; existing
  assistant ratings lack historical employee ownership, which must not be guessed.
- Russian-scoped advertising spend input/integration (unscoped historical spend remains intact).
- Live role-by-role acceptance verification of the enabled bot in production.
- Face ID adapter and integration require the user's later service documentation.
- Course/platform/results media and official channel require actual admin content.

No token is committed to Git. No real Telegram message has been sent by the local tests.
Incomplete features return an explicit unavailable message, not fabricated data.

## Production configuration

| Variable | Purpose |
| --- | --- |
| `DOMWORK_BOT_ENABLED` | Exact `true` enables startup; default disabled |
| `DOMWORK_BOT_TOKEN` | Only this bot's token; server secret |
| `DOMWORK_BOT_WEBHOOK_SECRET` | Random 32–256 URL-safe characters; server secret |
| `REDIS_URL` | Railway private reference `${{Redis.REDIS_URL}}` |
| `DOMWORK_BOT_PUBLIC_URL` | HTTPS origin; defaults to `https://myhomework.uz` |

Startup verifies bot username and Redis readiness but does **not** change webhooks.
An authenticated persisted CRM admin must explicitly call
`POST /api/domwork/bot/webhook/setup` when the implementation is ready. Pending
updates are never dropped. An existing different webhook needs explicit replacement.

Automation defaults off. Adding a group/link/chat ID does not start broadcasting.
Learning-group verification uses `POST /api/domwork/bot/learning-groups/:id/verify`;
trial groups require bot admin and restriction permission. Delivery rechecks permissions.
CRM path: Settings → Telegram groups → Bot controls. Operational groups are explicitly
selected by department, learning groups by teacher and trial/classroom type. A single
chat ID cannot be both. Existing group history is retained when archived.

On 2026-10-11, only the three approved DOMWORK_BOT variables were applied to the
myhomework service through Railway. Production reported enabled/ready with Redis
connected, and explicit webhook setup succeeded without replacing another webhook.
Automation remains off. The user assisted with browser controls blocked by review;
no unrelated secret was revealed and no alternate path bypassed those blocks.

Phone changes do not silently transfer Telegram ownership. An authenticated CRM
admin can inspect only their own association through `GET /api/domwork/bot/my-telegram-link`
and explicitly revoke it through `POST /api/domwork/bot/my-telegram-link/unlink` with
`currentPhone`, `expectedTelegramId` and the exact `expectedRevision` from that preview.
This requires the current stored admin role and phone, serializes with contact linking,
retains the old association in audit history and deletes only that single bot link.
Students, leads, lessons, HR, groups and bot sessions/history are not rewritten.
The new Telegram account must still provide its own verified contact to reconnect.

## Automatic group discovery and per-student main-class routing

CRM → Settings → Telegram groups → **Automatic discovery and student groups**.
The bot records `my_chat_member` / admin-selected chats in an additive discovery inbox.
Its worker reads live chat details and bot/admin memberships, then maps registered
Telegram administrators to current Russian CRM teacher identities. Titles never grant
ownership. No match or several teachers requires an explicit admin choice. If the
teacher registers later, unconfirmed discoveries are rescanned. Existing chat IDs may
also be selected through the bot to refresh older observations; Telegram cannot list
all previously joined chats or all chat members through the Bot API.

Admins review the teacher AND trial/classroom type, select up to 50 chats and confirm.
Confirmation verifies live bot privileges (including restriction privilege for trials),
checks candidate revision/freshness, locks the database and atomically creates groups
with audit entries. Existing learning/department bindings and defaults are never
replaced. A duplicate chat, stale revision or audit failure rolls back the entire batch.
Invites absent from Telegram are left empty, not fabricated or generated externally.
Admins can add an invite later; students without one get an explicit unavailable notice.

For active paid Russian students, known verified Telegram identities are probed against
verified classroom groups of their current main teacher. Only membership evidence is
proposed; no automatic assignment or broadcast occurs. Several matches stay ambiguous,
unregistered students remain manually assignable. Student registration and membership
changes trigger another probe; the admin rescan refreshes proposals on demand.

Admins explicitly approve up to 100 student/group pairs, or manually select a group
of the student's main teacher. Store/audit: `domwork_student_group_links` and
`domwork_student_group_audit`. Student cards, historical links, teacher IDs, leads, HR
and trial-group data are not rewritten. Existing new assignments are shown and may
only be replaced with an explicit confirmation and matching revision.

Student-app schedule API, main-class bot menus, assignment notifications and lesson reminders route through the
student's explicit group, never a teacher-wide default. Unassigned learners get no
guessed group reminder. Historical explicit personal links remain visible only when
there is no new approved assignment. Before delivery, queued messages recheck the
student's current group/teacher and bot permissions; changing a group cancels obsolete
queued links/reminders. Archive or teacher mismatch stops routing but retains history.
Teachers' group menu lists all of their non-archived groups. No automation setting is
enabled by discovery, group approval or student assignment.

Discovery performs only Telegram reads. Errors are held for explicit rescan. The
database-backed pending/scanning lease resumes after worker restart. Old member lists
and private phone numbers are not scraped. Without the bot's admin rights, membership
proposals cannot be trusted and are not produced.

## Student app Telegram linking without matching phone numbers

Russian student app → Profile → **Telegram botga ulash**. Only a real active paid
Russian student with a valid live student session may create a link; anonymous,
CRM admin/teacher preview, English, frozen and staff-demo accounts are rejected.
`/api/domwork/student-telegram` provides owner-only status, create, confirm and cancel.
No student ID is accepted from the client as the account to bind.

The student creates a 256-bit one-time link (5-minute expiry), opens it in Telegram,
presses Start, returns to the original authenticated app session, checks the Telegram
name/username/ID and explicitly confirms. Until that final approval, the bot gets no
student identity or private CRM details. A different phone number needs no CRM edits.
Raw link credentials are hashed before the durable bot inbox persists the update;
public hash commands cannot claim a request. Expiry, cancellation, session revocation,
competing accounts and reused requests are checked transactionally.

New additive tables: `domwork_student_telegram_requests`,
`domwork_student_telegram_proofs`. Existing links are never replaced or disconnected.
Existing student cards, CRM phone/login, results, payments, HR, leads and group
assignments are not rewritten. A confirmed platform proof resolves the student by
account ID regardless of phone, but current Russian/active/paid checks still apply.
Approval records audit, queues membership discovery and sends only that student's
menu, atomically; it does not enable broadcasts, assign a group or alter bot settings.

Verification: `scripts/student-telegram.test.cjs` and
`scripts/student-telegram-postgres.test.cjs`. Synthetic mobile UI covers create →
claimed → explicit approval → linked; no real student or Telegram was used for tests.
The Expo web export succeeds. Full TypeScript checking has existing diagnostics in
the unchanged tabs layout and ExternalLink; no diagnostics in the new link files.

## Local verification commands

Do not start/import `server/db.js` or the full server against production for tests.

```powershell
node --test scripts/domwork-bot.test.cjs scripts/domwork-groups.test.cjs
node scripts/run-payroll-postgres.cjs scripts/domwork-bot-postgres.test.cjs
node scripts/run-payroll-postgres.cjs scripts/domwork-discovery-postgres.test.cjs
node --test scripts/domwork-reports.test.cjs
node scripts/run-payroll-postgres.cjs scripts/domwork-reports-postgres.test.cjs
```

The verification runs passed 275 unit tests and 88 distinct PostgreSQL checks,
including rolling report SQL and main/assistant reminder cancellation. The mobile synthetic UI at 390px had no horizontal
overflow and 44px action buttons. All eight roles have real PostgreSQL authentication
fixtures; this is not a claim of complete live role-by-role acceptance testing.

Task 3 reporting follow-up: 35 selected unit cases cover reporting, scheduling,
role isolation, discovery and student Telegram linking. Five new PostgreSQL checks
(plus their suite) cover actual cohort/attendance SQL, signed receipt/plan integration,
private calendar scoping and the admin preview. They assert source rows/settings are
unchanged and no outbox messages are created. 21:00 comparison now targets ROP only;
admin/marketing do not receive a mislabeled repeat of their daily report.

The database runner accepts only the listed fixture tests, creates disposable loopback
PostgreSQL databases and always stops the test cluster. Redis and Telegram are mocked
in these tests; they are not proof of live delivery.

API documentation:
[Telegram Bot API](https://core.telegram.org/bots/api),
[Telegraf Telegram client](https://telegraf.js.org/classes/Telegram.html),
[node-redis](https://redis.io/docs/latest/develop/clients/nodejs/).

## Recognition, Russian advertising and exact assistant ratings

New additive tables: `domwork_assistant_ratings`, `domwork_ad_entries`,
`domwork_insights_audit`. Existing ratings, advertising JSON, HR, payments, students,
attendance and group assignments are not migrated, overwritten or deleted.

Russian Marketing → Target monitoring now saves daily USD spend and monthly plans
through `/api/domwork/marketing`. Current persisted admin/Russian-targetolog access,
revision checks and transactional audits prevent stale or forged writes. Existing
unscoped spend remains untouched and is NOT used as Russian CPL/plan. Previously
explicitly Russian-scoped entries are read without migration; new entries override
the same day's value in reports, never double-count it. Zero is a valid known spend.

The existing student rating endpoint stores new authenticated Russian submissions
with the exact assistant ID in the separate table. The app rates the last completed
Monday–Sunday week: matching assistant-attendance owner evidence is required, not
merely today's assignment. Ambiguous/reassigned/missing evidence fails closed; old
anonymous ratings and already-rated weeks are not overwritten or reattributed.
Assistant/dual-role bot views read only their own attributed ratings.
Explicit `rus-oqituvchi` roles remain Russian even when the historical HR `lang`
field says English; this matches existing teacher-pool logic without editing HR.
Explicit English teacher roles are not treated as Russian assistants.

CRM → Telegram groups → Bot management exposes separate, OFF-by-default controls:
20/40/60-million monthly net receipt milestones, daily winners, weekly/monthly
awards, new Russian employee greetings and actual release announcements. Weekly
and monthly awards additionally require a selected criterion (net sales or main
teacher confirmed lessons with same-period rating as tie-breaker). They confer no
money or payroll bonus. Ties name all winners; missing evidence never invents one.
Daily/weekly/monthly awards run at a configurable Tashkent time (default 20:00).
Missing ticks are not backfilled. A read-only preview queues no Telegram messages.

Milestones capture only a new real receipt crossing a threshold while opted in,
subtract actual refunds using the same payroll sales-facts engine, and send once
per manager/month/threshold. Concurrent new Russian receipts are serialized. Old
imports do not capture milestones. Employee events capture only new HR IDs, never
startup bootstrap records; releases use an explicit versioned changelog ID once.
Disabled events are consumed without replay. Delivery rechecks flags, group rights,
employee status, milestone balance and award evidence; stale messages cancel.

Verify with `node scripts/run-payroll-postgres.cjs scripts/domwork-insights-postgres.test.cjs`.
Telegram/Redis are mocked. Real role-by-role delivery acceptance still requires
registered users, confirmed classroom assignments and explicit opt-in. Face ID
provider docs, real course/promotional materials and business award-policy choices
remain external inputs; this addition does not claim those are complete.

## Staff Telegram linking without matching phone numbers (2026-10-29)

CRM → Sozlamalar → Bildirishnomalar → Kanallar → **Telegram bot → Ulash**. Same pattern as the
student flow: a live CRM session creates a 5-minute one-time `ul_` deep link (only its SHA-256 is
stored; the inbox copy is redacted), the employee presses Start, returns to the CRM, checks the
Telegram name/username and confirms. Confirmation writes `domwork_staff_telegram_proofs`; the staff
identity then no longer depends on the CRM/HR phone matching Telegram. Phone-matched links without
proof keep the old rule. Only eligible Russian staff and admins (same rules as contact login) may
link; a Telegram previously linked as a lead is replaced on confirmation, any other occupied
account is rejected. Self-service unlink is audited. API: `/api/domwork/staff-telegram`.

Student and staff link creation also returns a server-rendered QR (`qr: {size,path}`) of the
personal link, so the desktop QR no longer opens the bare bot (which fell back to phone matching).
A student Telegram previously linked as a lead is replaced on confirmation.

Verify: `node scripts/run-payroll-postgres.cjs scripts/staff-telegram-postgres.test.cjs`.
Note: `student-app/dist` is not rebuilt here; the student-app source change ships with the next build.

## Lead funnel for unknown visitors (2026-10-29)

Spec: Claude Docs "Domwork bot — lid voronkasi" (Project doc `claude/bot_lid_voronka.md`). OFF by default
(`settings.funnelEnabled`); while off, unknown visitors keep the old phone prompt and landing gets no link.

- Landing (`POST /api/leads`, Russian) returns a one-time `ld_` deep link (`telegramUrl`, 7 days, hash only,
  single Telegram) when the bot and funnel are enabled; the "Rahmat" page uses it instead of the fallback.
- Unknown visitor: greeting + gift (no phone) → segment (2 min delay, cancelled if answered) → field guide →
  1-dars (one-tap own contact required; creates/links a `Telegram bot` lead tagged "no call") → quiz with
  honest per-question feedback → CTA (manager photo, testimonial post, 15% discount with per-visitor deadline) →
  call/Telegram + time → CRM lead comment + "Sotuv" group message (independent of groupNotificationsEnabled).
- Score ≥ 6 without a request → one soft "🔥" alert (message, not call). Price question → instant alert.
- Free text → sales group. `/stop` pauses. A 403 from Telegram marks the visitor blocked.
- Delivery: `_guest` rows go through `funnel.deliverable` (enabled, not blocked/paused, `unless` guards,
  automation cancelled once the visitor becomes a staff/student identity).
- Materials: admin sends a file to the bot with caption `#voronka <key>`; `#voronka` lists keys.
- Security fix: a lead link without a phone never resolves by phone (previously an empty phone could
  match an empty-phone student).
- Report: `GET /api/domwork/bot/funnel/report?days=30`; CRM → Bot controls → "Lid voronkasi".

Verify: `node scripts/run-payroll-postgres.cjs scripts/domwork-funnel-postgres.test.cjs`.

## Funnel nurture, manager actions, relay, channel bonus (2026-10-29)

- Drip (`settings.dripEnabled`, off by default): one message a day in the visitor's window (Uzbekistan 19:30–20:30,
  migrants 20:30–21:30 Tashkent), plan d1–d10 per the spec, then weekly phrases ×8 → reactivation poll → monthly,
  stop after 90 days. 3 ignored → every 3 days, 6 → weekly; any reply resets. 10% holdout gets none. Stops on
  request, manager outcome, /stop, block, or when the Telegram becomes a staff/student identity.
- Post-call track after a manager marks "rejected": price / time / think sequences; "not interested" → monthly only.
- Manager buttons on request/hot/price alerts in the Sales group (linked sales/ROP/admin only):
  talked · no answer (lead gets one polite "when is convenient?" per day) · later · booked trial · rejected+reason.
  Each writes a CRM lead comment.
- Relay: a manager replies to the bot's alert in the Sales group → the lead receives it via the bot, prefixed with the
  manager's first name; media is copied. Lead voice/photo is copied into the group. Mapping: `domwork_bot_relay`.
- Channel bonus (`settings.bonusChannel`, bot must be a channel admin): membership checked with getChatMember.
- Report adds per-message drip sends and block rate (⚠️ above 1.5%), bonus, relays, outcomes.

Verify: `node scripts/run-payroll-postgres.cjs scripts/domwork-funnel-drip-postgres.test.cjs`.

## Staff notifications to Telegram, cleanup (2026-10-29)

- `settings.staffNotifyEnabled` (off by default): every 2 minutes a separate runtime timer (own short transaction per staff member, 20 s budget) computes each linked staff member's
  CRM notification panel (staffNotify.collect) and sends new items whose "Telegram" preference is on. The first run
  per staff member, and after any gap over 10 minutes (paused, disabled, bot down, relinked), only records a baseline. Several new items arrive as one digest. "Quiet hours off" is respected. Quiet hours hold non-urgent items; urgent ones
  (hold_expiring, trial_confirm, trial_unassigned) go silently. Paused (/stop) staff get nothing. The CRM panel is
  unchanged — Telegram is an additional channel, so a delivery problem never hides an item.
- Feed sections use savepoints inside a transaction, so one failing source cannot abort the push.
- Bot menus: "Jarimalar" removed (no data source); "Face ID" reads CRM staff attendance (last 14 days).
- Broadcast audience and time are chosen with buttons. Lesson reminder at 15 minutes (matches app/FAQ).

Verify: `node scripts/run-payroll-postgres.cjs scripts/staff-notify-telegram-postgres.test.cjs`.
