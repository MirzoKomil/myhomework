'use strict';
// 14-noy: Yordamchi ustozning yangi o'quvchi bilan TANISHUV aloqasi (Abdulloh tasdiqlagan dizayn:
// artifact "Yordamchi ustoz: tanishuv aloqasi").
//  • O'quvchiga yordamchi ustoz biriktirilganda (yoki almashtirilganda) — shu juftlik uchun tanishuv ochiladi.
//  • Birinchi ishga tushganda mavjud barcha juftliklar 'legacy' (eski o'quvchilarga tegilmaydi).
//  • Yordamchi "Tanishdik" belgilamaguncha o'quvchi uning Bosh sahifasi tepasida turadi.
//  • Davomatga, maoshga va oylik 13 aloqa limitiga KIRMAYDI (school_assist_contacts ga yozilmaydi).
//  • 24 soat o'tsa — "Kechikdi"; akademik rahbarga bot ogohlantirishi (domworkBot/assistIntroBot.js). Qulf yo'q.
const { randomUUID } = require('node:crypto');
const fail = (status, message) => Object.assign(new Error(message), { status });
const CHANNELS = { phone: 'Telefon', tg_video: 'Telegram video', tg_text: 'Telegram yozishma' };
const CHECKS = ['introduced', 'number', 'schedule'];
const DUE_MS = 24 * 3600000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS school_assist_intros (
 id TEXT PRIMARY KEY, student_id TEXT NOT NULL, assistant_id TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 done_at TIMESTAMPTZ, channel TEXT NOT NULL DEFAULT '', checks JSONB NOT NULL DEFAULT '[]', note TEXT NOT NULL DEFAULT '',
 no_answer INTEGER NOT NULL DEFAULT 0, last_no_answer_at TIMESTAMPTZ,
 notified_new BOOLEAN NOT NULL DEFAULT FALSE, notified_done BOOLEAN NOT NULL DEFAULT FALSE, notified_late BOOLEAN NOT NULL DEFAULT FALSE,
 UNIQUE(student_id, assistant_id));`;
let ready = false;
async function init(db) { if (!ready) { await db.query(SCHEMA); ready = true; } }

// Yangi juftliklarni olish. Birinchi marta — hammasi 'legacy'.
async function enroll(db) {
    await init(db);
    const first = !(await db.query('SELECT 1 FROM school_assist_intros LIMIT 1')).rows.length;
    const rows = (await db.query(`SELECT s.id, s.assistant_teacher_id FROM students s
        WHERE COALESCE(s.assistant_teacher_id,'')<>'' AND COALESCE(s.extra_data->>'isStaffDemo','false')<>'true'
        AND NOT EXISTS(SELECT 1 FROM school_assist_intros i WHERE i.student_id=s.id AND i.assistant_id=s.assistant_teacher_id)`)).rows;
    for (const r of rows) await db.query(`INSERT INTO school_assist_intros(id,student_id,assistant_id,state) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [randomUUID(), r.id, r.assistant_teacher_id, first ? 'legacy' : 'pending']);
}

const view = r => {
    const age = Date.now() - new Date(r.assigned_at).getTime();
    return { studentId: r.student_id, assignedAt: r.assigned_at, dueAt: new Date(new Date(r.assigned_at).getTime() + DUE_MS).toISOString(),
        late: age > DUE_MS, hoursLeft: Math.max(0, Math.ceil((DUE_MS - age) / 3600000)), noAnswer: r.no_answer,
        retryAt: r.last_no_answer_at ? new Date(new Date(r.last_no_answer_at).getTime() + 3 * 3600000).toISOString() : null };
};
async function mine(db, assistantId) {
    await enroll(db);
    // Faqat hozir ham shu yordamchiga biriktirilgan faol o'quvchilar.
    const rows = (await db.query(`SELECT i.* FROM school_assist_intros i JOIN students s ON s.id=i.student_id AND s.assistant_teacher_id=i.assistant_id
        WHERE i.assistant_id=$1 AND i.state='pending' ORDER BY i.assigned_at`, [assistantId])).rows;
    return { intros: rows.map(view) };
}
async function save(db, assistantId, studentId, body = {}) {
    await init(db);
    const row = (await db.query(`SELECT i.* FROM school_assist_intros i JOIN students s ON s.id=i.student_id AND s.assistant_teacher_id=i.assistant_id
        WHERE i.assistant_id=$1 AND i.student_id=$2 FOR UPDATE OF i`, [assistantId, studentId])).rows[0];
    if (!row) throw fail(404, 'Bu o\'quvchi sizga biriktirilmagan');
    if (row.state !== 'pending') return { intro: view(row), already: true };
    const note = String(body.note || '').trim().slice(0, 500);
    if (body.result === 'no_answer') {
        const r = (await db.query(`UPDATE school_assist_intros SET no_answer=no_answer+1,last_no_answer_at=NOW(),note=CASE WHEN $2<>'' THEN $2 ELSE note END
            WHERE id=$1 RETURNING *`, [row.id, note])).rows[0];
        return { intro: view(r) };
    }
    if (body.result !== 'done') throw fail(400, 'Natijani tanlang');
    const channel = CHANNELS[body.channel] ? body.channel : 'phone';
    const checks = (Array.isArray(body.checks) ? body.checks : []).filter(c => CHECKS.includes(c));
    if (!checks.includes('introduced')) throw fail(400, 'O\'zingizni tanishtirganingizni belgilang');
    const r = (await db.query(`UPDATE school_assist_intros SET state='done',done_at=NOW(),channel=$2,checks=$3,note=$4 WHERE id=$1 RETURNING *`,
        [row.id, channel, JSON.stringify(checks), note])).rows[0];
    return { intro: { ...view(r), done: true } };
}
// Akademik rahbar / admin uchun: tanishilmaganlar soni.
async function pendingCount(db) {
    await enroll(db);
    return Number((await db.query(`SELECT COUNT(*) AS n FROM school_assist_intros i JOIN students s ON s.id=i.student_id AND s.assistant_teacher_id=i.assistant_id
        WHERE i.state='pending'`)).rows[0].n) || 0;
}
// Admin va akademik rahbar uchun: kutilayotganlar va oxirgi 14 kunda tanishganlar.
async function board(db) {
    await enroll(db);
    const rows = (await db.query(`SELECT i.*, s.name AS student, s.subject, a.name AS assistant, t.name AS teacher FROM school_assist_intros i
        JOIN students s ON s.id=i.student_id LEFT JOIN hr_employees a ON a.id=i.assistant_id LEFT JOIN hr_employees t ON t.id=s.teacher_id
        WHERE (i.state='pending' AND s.assistant_teacher_id=i.assistant_id) OR (i.state='done' AND i.done_at > NOW() - INTERVAL '14 days')
        ORDER BY i.state DESC, i.assigned_at`)).rows;
    return { items: rows.map(r => ({ ...view(r), state: r.state, student: r.student, language: r.subject, assistant: r.assistant || '—', teacher: r.teacher || '',
        doneAt: r.done_at, channel: CHANNELS[r.channel] || '', checks: r.checks || [], note: r.note || '' })) };
}
module.exports = { init, enroll, mine, save, pendingCount, board, CHANNELS, DUE_MS };
