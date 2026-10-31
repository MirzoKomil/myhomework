'use strict';
// Akademik bo'lim va yagona dars jadvali uchun qo'shimcha (additive) jadvallar.
// Mavjud students/leads/hr_employees jadvallariga hech narsa yozmaydi —
// faqat o'z jadvallarini yaratadi. Qayta ishga tushirilsa o'zgarmaydi.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS school_teacher_hours (
 teacher_id TEXT NOT NULL, weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
 start_min SMALLINT NOT NULL CHECK (start_min BETWEEN 0 AND 1440), end_min SMALLINT NOT NULL CHECK (end_min BETWEEN 0 AND 1440),
 trial_open BOOLEAN NOT NULL DEFAULT TRUE, updated_by TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (teacher_id, weekday, start_min), CHECK (end_min > start_min)
);
-- Ish vaqti shablonining har o'zgarishi (kim, qachon, oldin/keyin) — "O'zgarishlar tarixi" uchun.
CREATE TABLE IF NOT EXISTS school_hours_log (
 id BIGSERIAL PRIMARY KEY, teacher_id TEXT NOT NULL, before JSONB NOT NULL DEFAULT '[]', after JSONB NOT NULL DEFAULT '[]',
 actor_id TEXT NOT NULL, actor_name TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_hours_log_teacher ON school_hours_log(teacher_id, created_at DESC);
CREATE TABLE IF NOT EXISTS school_overrides (
 id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL,
 date DATE, weekday SMALLINT CHECK (weekday BETWEEN 1 AND 7),
 start_min SMALLINT NOT NULL, end_min SMALLINT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('open','close','makeup_only','leave')),
 reason TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_by_name TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), removed_at TIMESTAMPTZ, removed_by TEXT,
 CHECK (end_min > start_min), CHECK ((date IS NULL) <> (weekday IS NULL))
);
CREATE INDEX IF NOT EXISTS school_overrides_teacher ON school_overrides(teacher_id) WHERE removed_at IS NULL;
CREATE TABLE IF NOT EXISTS school_bookings (
 id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('trial','makeup','once')),
 student_id TEXT, lead_id TEXT, date DATE NOT NULL,
 start_min SMALLINT NOT NULL, end_min SMALLINT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('hold','pending','confirmed','done','no_show','cancelled','rejected')),
 hold_until TIMESTAMPTZ, group_id TEXT, note TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL, created_by_name TEXT NOT NULL DEFAULT '', created_by_role TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (end_min > start_min)
);
CREATE INDEX IF NOT EXISTS school_bookings_teacher_date ON school_bookings(teacher_id, date);
CREATE INDEX IF NOT EXISTS school_bookings_lead ON school_bookings(lead_id) WHERE lead_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS school_makeups (
 id TEXT PRIMARY KEY, student_id TEXT NOT NULL, teacher_id TEXT NOT NULL,
 missed_date DATE NOT NULL, held_date DATE, kind TEXT NOT NULL CHECK (kind IN ('separate','double')),
 booking_id TEXT, status TEXT NOT NULL CHECK (status IN ('planned','review','approved','rejected','cancelled')),
 created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 decided_by TEXT, decided_by_name TEXT, decided_at TIMESTAMPTZ, decision_note TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS school_makeups_once ON school_makeups(student_id, missed_date) WHERE status IN ('planned','review','approved');
CREATE TABLE IF NOT EXISTS school_requests (
 id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, requester_id TEXT NOT NULL, requester_name TEXT NOT NULL DEFAULT '',
 type TEXT NOT NULL CHECK (type IN ('leave','close','open','assist_late')),
 payload JSONB NOT NULL DEFAULT '{}', reason TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','rejected')),
 decided_by TEXT, decided_by_name TEXT, decided_at TIMESTAMPTZ, decision_note TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS school_student_status (
 id TEXT PRIMARY KEY, student_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('frozen','left','restored')),
 from_date DATE NOT NULL, to_date DATE, reason_code TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL,
 payload JSONB NOT NULL DEFAULT '{}',
 actor_id TEXT NOT NULL, actor_name TEXT NOT NULL DEFAULT '', actor_role TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), cancelled_at TIMESTAMPTZ, cancelled_by TEXT
);
CREATE INDEX IF NOT EXISTS school_student_status_student ON school_student_status(student_id, from_date);
CREATE TABLE IF NOT EXISTS school_teacher_history (
 id TEXT PRIMARY KEY, student_id TEXT NOT NULL, teacher_id TEXT NOT NULL,
 from_date DATE NOT NULL, to_date DATE, reason TEXT NOT NULL DEFAULT '',
 actor_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_teacher_history_student ON school_teacher_history(student_id, from_date);
CREATE TABLE IF NOT EXISTS school_student_audit (
 id BIGSERIAL PRIMARY KEY, student_id TEXT NOT NULL, action TEXT NOT NULL,
 changes JSONB NOT NULL DEFAULT '{}', reason TEXT NOT NULL DEFAULT '',
 actor_id TEXT NOT NULL, actor_name TEXT NOT NULL DEFAULT '', actor_role TEXT NOT NULL DEFAULT '',
 request_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_student_audit_student ON school_student_audit(student_id, created_at DESC);
CREATE TABLE IF NOT EXISTS school_edit_requests (
 id TEXT PRIMARY KEY, number SERIAL, student_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('tariff','teacher','payment')),
 changes JSONB NOT NULL, reason TEXT NOT NULL,
 requested_by TEXT NOT NULL, requester_name TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','returned')),
 decided_by TEXT, decided_by_name TEXT, decided_by_role TEXT, decided_at TIMESTAMPTZ, decision_note TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_edit_requests_status ON school_edit_requests(status, created_at DESC);
CREATE TABLE IF NOT EXISTS school_student_groups (
 student_id TEXT PRIMARY KEY, tg_link TEXT NOT NULL DEFAULT '', name TEXT NOT NULL,
 name_source TEXT NOT NULL DEFAULT 'manual' CHECK (name_source IN ('auto','manual')),
 archived BOOLEAN NOT NULL DEFAULT FALSE,
 updated_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS school_student_groups_name ON school_student_groups(LOWER(name));
-- AdminGuruhlar "A'zolar": admin/ROP Telegram guruhga kim qo'shilganini belgilaydi ({ teacher, assistant, sales, rop: xodim id, student: true }).
-- Bo'sh {} — hali belgilanmagan (soxta "5/5" ko'rsatilmaydi).
ALTER TABLE school_makeups ADD COLUMN IF NOT EXISTS held_start_min SMALLINT;
ALTER TABLE school_makeups ADD COLUMN IF NOT EXISTS held_full BOOLEAN;
-- Ustoz ilovasi v2: "Sinovga tanaffus" — ustoz admin ochgan sinov vaqtiga tanaffus oladi (kind='break', faqat sana, sabab majburiy).
ALTER TABLE school_overrides DROP CONSTRAINT IF EXISTS school_overrides_kind_check;
ALTER TABLE school_overrides ADD CONSTRAINT school_overrides_kind_check CHECK (kind IN ('open','close','makeup_only','leave','break'));
ALTER TABLE school_overrides ADD COLUMN IF NOT EXISTS reason_code TEXT NOT NULL DEFAULT '';
ALTER TABLE school_overrides ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';
ALTER TABLE school_student_groups ADD COLUMN IF NOT EXISTS members JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS school_assist_contacts (
 id TEXT PRIMARY KEY, student_id TEXT NOT NULL, assistant_id TEXT NOT NULL,
 day DATE NOT NULL, at_min SMALLINT, channel TEXT NOT NULL,
 minutes SMALLINT NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '',
 outcome TEXT NOT NULL CHECK (outcome IN ('contacted','no_answer')),
 created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 removed_at TIMESTAMPTZ, removed_by TEXT, correction_reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS school_assist_contacts_month ON school_assist_contacts(assistant_id, day) WHERE removed_at IS NULL;
CREATE TABLE IF NOT EXISTS school_assist_months (
 month TEXT PRIMARY KEY, locked_at TIMESTAMPTZ, prelim_by TEXT, prelim_at TIMESTAMPTZ,
 objection_until DATE, final_at TIMESTAMPTZ, paid_at TIMESTAMPTZ
);
-- Asosiy ustoz "Kelmadi" belgisi. main_attendance faqat "Keldi"ni saqlaydi (kelmadi bo'lsa qator o'chiriladi),
-- shuning uchun "kelmadi" va "belgilanmagan" farqi shu yerda: absent=true — kelmadi, absent=false — belgi olib tashlangan.
-- Maosh hisobiga ta'sir qilmaydi (maosh faqat main_attendance present=1 va tasdiqlangan qoplashdan).
CREATE TABLE IF NOT EXISTS school_absences (
 teacher_id TEXT NOT NULL, student_id TEXT NOT NULL, day DATE NOT NULL, absent BOOLEAN NOT NULL DEFAULT TRUE,
 marked_by TEXT NOT NULL DEFAULT '', marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (teacher_id, student_id, day)
);
ALTER TABLE school_absences ADD COLUMN IF NOT EXISTS reason_code TEXT NOT NULL DEFAULT '';
ALTER TABLE school_absences ADD COLUMN IF NOT EXISTS reason_note TEXT NOT NULL DEFAULT '';
-- Ustoz ilovasi v2: dars rejadagidan boshqa vaqtda o'tgan bo'lsa — haqiqiy vaqti (nazorat uchun, maoshga ta'sir qilmaydi).
CREATE TABLE IF NOT EXISTS school_lesson_times (
 teacher_id TEXT NOT NULL, student_id TEXT NOT NULL, day DATE NOT NULL, start_min SMALLINT NOT NULL, end_min SMALLINT NOT NULL,
 marked_by TEXT NOT NULL DEFAULT '', marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (teacher_id, student_id, day), CHECK (end_min > start_min)
);
-- Ustozning o'quvchi bo'yicha so'rovi ("Adminga so'rov" — muzlatish, ustoz, jadval): 'student' turi.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='school_requests_type_check' AND pg_get_constraintdef(oid) LIKE '%student%') THEN
  ALTER TABLE school_requests DROP CONSTRAINT IF EXISTS school_requests_type_check;
  ALTER TABLE school_requests ADD CONSTRAINT school_requests_type_check CHECK (type IN ('leave','close','open','assist_late','student'));
 END IF;
END $$;
-- Yordamchining "Moliyaga murojaat"i (yopilgan oy bo'yicha): 'assist_finance' turi. Qayta ishga tushirilsa xavfsiz.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='school_requests_type_check' AND pg_get_constraintdef(oid) LIKE '%assist_finance%') THEN
  ALTER TABLE school_requests DROP CONSTRAINT IF EXISTS school_requests_type_check;
  ALTER TABLE school_requests ADD CONSTRAINT school_requests_type_check CHECK (type IN ('leave','close','open','assist_late','student','assist_finance'));
 END IF;
END $$;
-- Ilgari qabul qilingan qoplash qarorlari o'quvchi "O'zgarishlar tarixi"ga bir marta ko'chiriladi (qayta ishga tushirilsa xavfsiz).
INSERT INTO school_student_audit (student_id,action,changes,reason,actor_id,actor_name,actor_role,created_at)
 SELECT m.student_id, CASE WHEN m.status='approved' THEN 'makeup-approved' ELSE 'makeup-rejected' END,
  jsonb_build_object('makeupId', m.id, 'missedDate', TO_CHAR(m.missed_date,'YYYY-MM-DD'), 'heldDate', TO_CHAR(m.held_date,'YYYY-MM-DD'), 'teacherId', m.teacher_id, 'kind', m.kind, 'backfill', true),
  COALESCE(m.decision_note,''), COALESCE(NULLIF(m.decided_by,''),'system'), COALESCE(m.decided_by_name,''), CASE WHEN COALESCE(m.decided_by,'')='' THEN 'system' ELSE '' END,
  COALESCE(m.decided_at, m.held_date::timestamptz, m.created_at)
 FROM school_makeups m
 WHERE m.status IN ('approved','rejected')
  AND NOT EXISTS (SELECT 1 FROM school_student_audit a WHERE a.student_id=m.student_id AND a.action IN ('makeup-approved','makeup-rejected') AND a.changes->>'makeupId'=m.id);
`;
// Jadvallar yaratilgach true — db.js dagi ilgaklar (sinov to'qnashuvi, guruh) faqat shunda ishlaydi.
const state = { ready: false };
async function initSchema(db) { await db.query(SCHEMA); state.ready = true; }
module.exports = { initSchema, SCHEMA, state };
