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
- Pending notifications recheck account/role, booking, assignment, attendance correction,
  lesson time and relevant automation switch before delivery.

## Not complete / not activated

These are required before claiming Task 3 is complete:

- Explicit verification/binding of the user's ten groups. Invite hashes alone do
  not reveal chat IDs; production Redis/token readiness and webhook setup passed.
- Milestone congratulations, employee onboarding/release notifications, daily/weekly/monthly
  awards and full academic admin digest.
- Accurate assistant rating attribution/history and free-slot presentation; existing
  assistant ratings lack historical employee ownership, which must not be guessed.
- Expanded weekly/monthly marketing conversion views and Russian-scoped advertising spend.
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

## Local verification

Do not start/import `server/db.js` or the full server against production for tests.

```powershell
node --test scripts/domwork-bot.test.cjs scripts/domwork-groups.test.cjs
node scripts/run-payroll-postgres.cjs scripts/domwork-bot-postgres.test.cjs
```

The verification runs passed 275 unit tests and 88 distinct PostgreSQL checks,
including rolling report SQL and main/assistant reminder cancellation. The mobile synthetic UI at 390px had no horizontal
overflow and 44px action buttons. All eight roles have real PostgreSQL authentication
fixtures; this is not a claim of complete live role-by-role acceptance testing.

The database runner accepts only the listed fixture tests, creates disposable loopback
PostgreSQL databases and always stops the test cluster. Redis and Telegram are mocked
in these tests; they are not proof of live delivery.

API documentation:
[Telegram Bot API](https://core.telegram.org/bots/api),
[Telegraf Telegram client](https://telegraf.js.org/classes/Telegram.html),
[node-redis](https://redis.io/docs/latest/develop/clients/nodejs/).
