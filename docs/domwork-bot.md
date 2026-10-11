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

## Not complete / not activated

These are required before claiming Task 3 is complete:

- Trial accept/reject/result inline callbacks synchronized with CRM and Mayoq.
- Operational group binding UI for sales, marketing, teachers, family and Mayoq.
- Broadcast editor, audience preview/confirmation, media and scheduled sending.
- Admin leave approval/rejection and employee notification.
- Transactional CRM event hooks: payment, assignment, trial and attendance.
- Schedule/attendance reminders, once-daily trial promotion, 20:00/21:00 reports,
  department digests and safely gated trial-group removal.
- Exact marketing budget/CPL, individual sales plan and bonus-history presentation.
- Redis FSM/cache layer (current Redis usage is throttling; PostgreSQL stores sessions).
- End-to-end live Redis/Telegram checks, group verification and Russian role-account tests.
- Production deployment and deliberate webhook activation.
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

## Local verification

Do not start/import `server/db.js` or the full server against production for tests.

```powershell
node --test scripts/domwork-bot.test.cjs scripts/domwork-groups.test.cjs
node scripts/run-payroll-postgres.cjs scripts/domwork-bot-postgres.test.cjs
```

The database runner accepts only the listed fixture tests, creates disposable loopback
PostgreSQL databases and always stops the test cluster. Redis and Telegram are mocked
in these tests; they are not proof of live delivery.

API documentation:
[Telegram Bot API](https://core.telegram.org/bots/api),
[Telegraf Telegram client](https://telegraf.js.org/classes/Telegram.html),
[node-redis](https://redis.io/docs/latest/develop/clients/nodejs/).
