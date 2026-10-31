'use strict';
// Xodimlar uchun avtomatik yaratilgan demo o'quvchilar (students.extra_data.isStaffDemo = true)
// endi kerak emas (31-okt): yangi xodimga demo yaratilmaydi, eskilari bazadan butunlay o'chiriladi.
// Har server ishga tushganda ishlaydi — o'chiradigan narsa qolmagach hech narsa qilmaydi (idempotent).
// Arxivga tushirilmaydi: bular haqiqiy o'quvchi emas, foydasiz yozuvlar.
// Moliya/to'lov/maosh, arxiv va audit jadvallariga tegilmaydi (KEEP_TABLE_RE).

const DEMO_WHERE = "COALESCE(extra_data->>'isStaffDemo','false') = 'true'";
// Pul, maosh, arxiv va audit/jurnal jadvallari tegilmaydi (demo'larda to'lov yo'q, jurnallar o'zgarmas).
const KEEP_TABLE_RE = /^(fin_|payment|salary|archive|audit)|_(log|audit|archive|audits)$/i;

function isStaffDemoRow(s) {
    return !!s && (s.isStaffDemo === true || s.isStaffDemo === 'true');
}

async function removeStaffDemoStudents(pool, log = console) {
    const client = await pool.connect();
    let ids = [];
    try {
        await client.query('BEGIN');
        ids = (await client.query(`DELETE FROM students WHERE ${DEMO_WHERE} RETURNING id`)).rows.map(r => String(r.id));
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
    if (!ids.length) return { removed: 0, related: {} };

    // Shu demo o'quvchilarga tegishli yetim qatorlar (progress, davomat, holatlar va h.k.).
    const related = {};
    const { rows: tables } = await pool.query(`SELECT table_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND column_name = 'student_id' AND table_name <> 'students'`);
    for (const { table_name: t } of tables) {
        if (KEEP_TABLE_RE.test(t) || !/^[a-z0-9_]+$/i.test(t)) continue;
        try {
            const r = await pool.query(`DELETE FROM "${t}" WHERE student_id::text = ANY($1::text[])`, [ids]);
            if (r.rowCount) related[t] = r.rowCount;
        } catch (err) {
            log.warn?.(`[xodim-demo] ${t} tozalanmadi: ${err.message}`);
        }
    }
    log.log?.(`[xodim-demo] ${ids.length} ta xodim demo o'quvchisi o'chirildi`, JSON.stringify(related));
    return { removed: ids.length, related };
}

module.exports = { removeStaffDemoStudents, isStaffDemoRow };
