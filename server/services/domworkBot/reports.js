'use strict';
const policy = require('./policy');
const money = value => new Intl.NumberFormat('uz-UZ').format(Number(value) || 0).replace(/[\u00a0\u202f]/g, ' ') + ' UZS';
const dateAt = date => new Date(date + 'T12:00:00Z');
function shift(date, days) { const d = dateAt(date); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); }
function periods(now = new Date()) {
    const today = policy.today(now), day = dateAt(today).getUTCDay() || 7;
    const monday = shift(today, 1-day), month = today.slice(0,7) + '-01';
    const weeks = Array.from({length:4}, (_, i) => {
        const start = shift(monday, -7*(3-i)); return {start,end:i===3?today:shift(start,6)};
    });
    const months = Array.from({length:3}, (_, i) => {
        const d = dateAt(month); d.setUTCMonth(d.getUTCMonth() - (2-i));
        const start = d.toISOString().slice(0,10), next = new Date(d); next.setUTCMonth(next.getUTCMonth()+1);
        return {start,end:i===2?today:shift(next.toISOString().slice(0,10),-1)};
    });
    return {weeks,months};
}
// A current column is not evidence of where a lead was at a past month end.
// Only persisted audit snapshots at/before that end count towards conversion.
async function cohort(db, start, end) {
    return (await db.query(`WITH cohort AS (
        SELECT id FROM leads WHERE language='russian' AND lead_type='target'
          AND (created_at AT TIME ZONE 'Asia/Tashkent')::date BETWEEN $1::date AND $2::date
    ), progress AS (
        SELECT c.id,COUNT(a.lead_id)>0 AS known,
          BOOL_OR(COALESCE(a.snapshot->'after',a.snapshot)->>'status' IN ('boglanildi','malumot-berildi')) AS contacted,
          BOOL_OR(COALESCE(a.snapshot->'after',a.snapshot)->>'status'='sinov-darsida') AS trial,
          BOOL_OR(COALESCE(a.snapshot->'after',a.snapshot)->>'status'='tolov-yopildi') AS won
        FROM cohort c LEFT JOIN lead_audit a ON a.lead_id=c.id
          AND a.created_at < ($2::date+1)::timestamp AT TIME ZONE 'Asia/Tashkent'
        GROUP BY c.id
    ) SELECT COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE known)::int AS audited,
        COUNT(*) FILTER(WHERE contacted)::int AS contacted,COUNT(*) FILTER(WHERE trial)::int AS trial,
        COUNT(*) FILTER(WHERE won)::int AS won FROM progress`,[start,end])).rows[0];
}
async function marketingHistory(db, now = new Date()) {
    const windows = periods(now), lines = [];
    for (const [label, ranges] of [['Haftalik',windows.weeks],['Oylik',windows.months]]) {
        lines.push(label + ' target lidlar konversiyasi:');
        for (const p of ranges) {
            const r = await cohort(db,p.start,p.end), percent = r.leads ? (r.won/r.leads*100).toFixed(1)+'%' : '—';
            lines.push(`${p.start} — ${p.end}\nLid: ${r.leads} · Bog‘lanildi: ${r.contacted} · Sinov: ${r.trial} · Yopildi: ${r.won} (${percent}) · Auditi bor: ${r.audited}/${r.leads}`);
        }
    }
    return lines.join('\n') + '\nHar davrda kelgan target lidlar, o‘sha davr oxirigacha auditda qayd etilgan bosqichlar. O‘chirilgan lidlarning saqlangan tarixi ham hisobga olinadi. Audit yo‘q bosqichlar taxmin qilinmaydi; joriy davr bugungacha.';
}
async function attendance(db, table, start, end) {
    if (!['main_attendance','assistant_attendance'].includes(table)) throw policy.error(400,'Davomat turi noto‘g‘ri');
    return (await db.query(`WITH marks AS MATERIALIZED (
        SELECT a.student_id,LEFT(a.att_key,7) AS month,a.day,
            BOOL_OR(a.present=1) AS attended,BOOL_OR(a.present=0) AS absent
        FROM ${table} a JOIN students s ON s.id=a.student_id AND s.subject='russian'
        WHERE LEFT(a.att_key,7) ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$' AND a.day BETWEEN 1 AND 31
            AND LEFT(a.att_key,7) BETWEEN LEFT($1,7) AND LEFT($2,7)
        GROUP BY a.student_id,LEFT(a.att_key,7),a.day
    ), valid AS (
        SELECT * FROM marks WHERE day<=EXTRACT(DAY FROM (month||'-01')::date+INTERVAL '1 month'-INTERVAL '1 day')
            AND (month||'-'||LPAD(day::text,2,'0')) BETWEEN $1 AND $2
    ) SELECT COUNT(*) FILTER(WHERE attended AND NOT absent)::int AS attended,
        COUNT(*) FILTER(WHERE absent AND NOT attended)::int AS absent,
        COUNT(*) FILTER(WHERE attended AND absent)::int AS conflict FROM valid`,[start,end])).rows[0];
}
async function academicDigest(db, start, end) {
    const main = await attendance(db,'main_attendance',start,end), assistant = await attendance(db,'assistant_attendance',start,end);
    const newStudents = (await db.query(`SELECT COUNT(*)::int AS count FROM students WHERE subject='russian'
        AND extra_data->>'startDate' BETWEEN $1 AND $2 AND COALESCE(extra_data->>'isStaffDemo','false')<>'true'
        AND COALESCE(extra_data->>'passwordHash','')<>''
        AND CASE WHEN COALESCE(extra_data->>'paidAmount','') ~ '^[0-9]+([.][0-9]+)?$'
            THEN (extra_data->>'paidAmount')::numeric>0 ELSE false END`,[start,end])).rows[0].count;
    return `Akademik hisobot: ${start} — ${end}\n`
        + `Asosiy dars: qatnashdi ${main.attended} · kelmadi ${main.absent}\n`
        + `Yordamchi dars: qatnashdi ${assistant.attended} · kelmadi ${assistant.absent}\n`
        + `Zid davomat yozuvlari: ${main.conflict+assistant.conflict} (qatnashdi/kelmadiga qo‘shilmadi)\n`
        + `O‘qishni boshlagan pullik o‘quvchilar: ${newStudents}\n`
        + 'Faqat belgilangan davomat hisoblandi. Belgilanmagan kun “kelmadi” emas. Boshlash sanasi yo‘q eski o‘quvchilar taxmin qilinmaydi.';
}
module.exports = { shift, periods, cohort, marketingHistory, attendance, academicDigest };
