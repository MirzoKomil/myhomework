'use strict';
// Faol bo'lmagan o'quvchi bo'yicha sotuv menejeri eslatmalari (SotuvOquvchiArxiv):
//  • return_reminder — "Qaytish oldidan eslatma": muzlatilgan o'quvchi qaytishidan oldin qo'ng'iroq;
//  • winback — "Qayta jalb": chiqib ketgan o'quvchiga qo'ng'iroq rejasi va "Qo'ng'iroq qildim" yozuvi.
// Alohida, qo'shimcha jadval (mavjud jadvallarga yozmaydi). Birinchi chaqiruvda yaratiladi, qayta
// ishga tushirilsa o'zgarmaydi. Qo'ng'iroq rejasi saqlanmagan bo'lsa: oxirgi dars / oxirgi qo'ng'iroqdan 30 kun.
const { randomUUID } = require('node:crypto');
const T = require('./time');
const S = require('./schedule');

const KINDS = new Set(['return_reminder', 'winback']);
const WINBACK_DAYS = 30;
const SCHEMA = `
CREATE TABLE IF NOT EXISTS school_student_followups (
 id TEXT PRIMARY KEY, student_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('return_reminder','winback')),
 due_date DATE, note TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL, created_by_name TEXT NOT NULL DEFAULT '', created_by_role TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 done_at TIMESTAMPTZ, done_by TEXT, cancelled_at TIMESTAMPTZ, cancelled_by TEXT
);
CREATE INDEX IF NOT EXISTS school_student_followups_student ON school_student_followups(student_id, kind);
`;
let ready = null;
function ensure(db) {
    if (!ready) ready = Promise.resolve(db.query(SCHEMA)).catch(e => { ready = null; throw e; });
    return ready;
}
const dstr = v => (v ? S.dateStr(v) : null);
const tzDay = v => (v ? T.nowLocal(new Date(v)).date : null);

// student_id → { reminder: {id,due,note} | null, winback: {id,due,planned} , lastCall: {at,note,by} | null, calls: n }
async function forStudents(db, ids) {
    const out = new Map();
    if (!ids.length) return out;
    await ensure(db);
    const rows = (await db.query(`SELECT * FROM school_student_followups WHERE student_id = ANY($1::text[]) AND cancelled_at IS NULL ORDER BY created_at`, [ids])).rows;
    for (const id of ids) out.set(id, { reminder: null, winbackOpen: null, lastCall: null, calls: 0 });
    for (const r of rows) {
        const x = out.get(r.student_id); if (!x) continue;
        if (r.kind === 'return_reminder' && !r.done_at) x.reminder = { id: r.id, due: dstr(r.due_date), note: r.note };
        if (r.kind === 'winback' && !r.done_at) x.winbackOpen = { id: r.id, due: dstr(r.due_date), note: r.note };
        if (r.kind === 'winback' && r.done_at) { x.calls++; x.lastCall = { id: r.id, at: r.done_at, day: tzDay(r.done_at), note: r.note, by: r.created_by_name }; }
    }
    return out;
}
// Chiqib ketgan o'quvchining navbatdagi qo'ng'iroq kuni: saqlangan reja yoki (oxirgi qo'ng'iroq | chiqqan kun) + 30.
function winbackPlan(f, leftFrom) {
    if (f?.winbackOpen?.due) return { due: f.winbackOpen.due, planned: true };
    const base = [f?.lastCall?.day, leftFrom].filter(Boolean).sort().pop();
    return base ? { due: T.addDays(base, WINBACK_DAYS), planned: false } : null;
}

async function create(db, actor, studentId, body = {}) {
    await ensure(db);
    const kind = String(body.kind || '');
    if (!KINDS.has(kind)) throw T.fail(400, 'Eslatma turi noto\'g\'ri');
    const due = T.assertDate(body.due, 'Sana');
    if (due < T.nowLocal().date) throw T.fail(400, 'O\'tgan sanaga eslatma qo\'yib bo\'lmaydi');
    const note = String(body.note || '').trim().slice(0, 300);
    // Bir turdan bitta ochiq eslatma: eskisi bekor bo'ladi.
    await db.query(`UPDATE school_student_followups SET cancelled_at=NOW(), cancelled_by=$3 WHERE student_id=$1 AND kind=$2 AND done_at IS NULL AND cancelled_at IS NULL`, [studentId, kind, actor.id]);
    const { rows } = await db.query(`INSERT INTO school_student_followups (id,student_id,kind,due_date,note,created_by,created_by_name,created_by_role)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [randomUUID(), studentId, kind, due, note, actor.id, actor.name || '', actor.role || '']);
    return rows[0];
}
// "Qo'ng'iroq qildim": ochiq reja yopiladi, qo'ng'iroq yozuvi qoladi; keyingi reja — 30 kundan keyin (avtomatik).
async function logCall(db, actor, studentId, body = {}) {
    await ensure(db);
    const note = String(body.note || '').trim().slice(0, 300);
    await db.query(`UPDATE school_student_followups SET cancelled_at=NOW(), cancelled_by=$2 WHERE student_id=$1 AND kind='winback' AND done_at IS NULL AND cancelled_at IS NULL`, [studentId, actor.id]);
    const { rows } = await db.query(`INSERT INTO school_student_followups (id,student_id,kind,due_date,note,created_by,created_by_name,created_by_role,done_at,done_by)
        VALUES ($1,$2,'winback',$3,$4,$5,$6,$7,NOW(),$5) RETURNING *`, [randomUUID(), studentId, T.nowLocal().date, note, actor.id, actor.name || '', actor.role || '']);
    return rows[0];
}
async function cancel(db, actor, id, { manage = false } = {}) {
    await ensure(db);
    const row = (await db.query('SELECT * FROM school_student_followups WHERE id=$1', [id])).rows[0];
    if (!row || row.cancelled_at) throw T.fail(404, 'Eslatma topilmadi');
    if (!manage && row.created_by !== actor.id) throw T.fail(403, 'Faqat o\'zingiz qo\'ygan eslatmani bekor qilasiz');
    await db.query('UPDATE school_student_followups SET cancelled_at=NOW(), cancelled_by=$2 WHERE id=$1', [id, actor.id]);
    return { ...row, cancelled: true };
}
async function row(db, id) { await ensure(db); return (await db.query('SELECT * FROM school_student_followups WHERE id=$1', [id])).rows[0] || null; }

// Bildirishnomalar uchun: menejer o'quvchilari bo'yicha bugungi (va o'tgan) eslatmalar.
async function dueForManager(db, managerId, today) {
    if (!managerId) return [];
    await ensure(db);
    const st = (await db.query(`SELECT id, name FROM students WHERE extra_data->>'managerId' = $1`, [String(managerId)])).rows;
    if (!st.length) return [];
    const ids = st.map(s => s.id), names = new Map(st.map(s => [s.id, s.name]));
    const statuses = (await db.query('SELECT * FROM school_student_status WHERE student_id = ANY($1::text[]) AND cancelled_at IS NULL', [ids])).rows;
    const by = new Map(); for (const s of statuses) { if (!by.has(s.student_id)) by.set(s.student_id, []); by.get(s.student_id).push(s); }
    const fol = await forStudents(db, ids);
    const out = [];
    for (const id of ids) {
        const f = fol.get(id), rows = by.get(id) || [], state = S.statusOn(rows, today);
        if (f.reminder?.due && f.reminder.due <= today && state === 'frozen') out.push({ id: f.reminder.id, kind: 'return_reminder', studentId: id, name: names.get(id), due: f.reminder.due });
        if (state === 'left') {
            const last = rows.filter(r => r.status === 'left').pop();
            if (last?.reason_code === 'finished') continue;
            const plan = winbackPlan(f, dstr(last?.from_date));
            if (plan && plan.due <= today) out.push({ id: f.winbackOpen?.id || `auto:${id}:${plan.due}`, kind: 'winback', studentId: id, name: names.get(id), due: plan.due });
        }
    }
    return out;
}

module.exports = { ensure, forStudents, winbackPlan, create, logCall, cancel, row, dueForManager, WINBACK_DAYS, SCHEMA };
