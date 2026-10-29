'use strict';
// Yordamchi ustoz — alohida lavozim (Abdulloh, 29-okt):
//   "Asosiy ustoz endi yordamchi ustozlik qila olmasligi kerak, bu pozitsiyaga alohida odam qo'yamiz."
//   "Mohinur ustozning yordamchi ustoz sifatidagi o'quvchilari ham avtomatik haqiqiy yordamchi ustoz Ayubxonga o'tib qolishi kerak."
//
// Bir martalik ko'chirish (server ishga tushganda):
//  • Mohinur Azimova (asosiy ustoz) va Ayubxon Axmadjonov (HR lavozimi 'yordamchi') ism bilan topiladi —
//    ikkalasi ham BITTADAN aniq topilsagina ko'chiriladi, aks holda hech narsa o'zgarmaydi (logga yoziladi).
//  • Faqat students.assistant_teacher_id o'zgaradi (bundan keyingi biriktirish). Aloqa yozuvlari
//    (school_assist_contacts), oktyabr aloqalari va maosh hisobi O'ZGARMAYDI — Mohinurning o'tgan aloqalari
//    unga hisoblanishda davom etadi (contacts.assistant_id = Mohinur).
//  • Har o'quvchiga school_student_audit yozuvi (sabab bilan). Yordamchi biriktirish tarixi (from/to)
//    alohida jadvalda saqlanmaydi — tarix shu audit yozuvi va aloqalardagi assistant_id orqali ko'rinadi.
//  • Bajarilgani school_migrations jadvaliga yoziladi; qayta ishga tushsa hech narsa qilmaydi va logga yozmaydi
//    (advisory lock — bir vaqtda ikki jarayon ham ikki marta ko'chirmaydi). Marker FAQAT muvaffaqiyatli ko'chirishda yoki
//    "ko'chiriladigan narsa yo'q" (Mohinurda yordamchi o'quvchi qolmagan) bo'lganda yoziladi (BAHO-5 yordamchi #9a).
//    Mohinur yoki Ayubxon (HR lavozimi 'yordamchi') topilmasa — marker yozilmaydi, sabab logga yoziladi va keyingi
//    ishga tushishda yana urinadi (masalan, admin Ayubxonning lavozimini 'yordamchi' qilgach o'zi bajariladi).
//  • Boshqa asosiy ustozlarda qolgan yordamchi o'quvchilar avtomatik KO'CHIRILMAYDI — soni logga yoziladi,
//    admin "Yordamchi kerak" ogohlantirishida ko'radi (legacyAssignments()).
const MIGRATION_ID = 'assistant-separation-2026-10-29';
const REASON = 'Asosiy ustoz yordamchi bo\'la olmaydi — Ayubxon Axmadjonovga o\'tkazildi';
const MAIN_ROLES = ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy'];
const roles = require('../../../js/teacherRoles');

// Ism bo'yicha qidiruv: kichik harf, apostrof/ortiqcha bo'shliqsiz; "x" ↔ "h" (Axmadjonov / Ahmadjonov).
const norm = s => String(s || '').toLowerCase().replace(/[ʻʼ'`‘’]/g, '').replace(/\s+/g, ' ').trim();
const loose = s => norm(s).replace(/kh/g, 'x').replace(/h/g, 'x');
const hasAll = (name, parts) => { const n = loose(name).split(' '); return parts.every(p => n.includes(loose(p))); };

async function findOne(db, parts, roleOk) {
    const rows = (await db.query(`SELECT id, name, role, lang, status FROM hr_employees WHERE COALESCE(status,'active') <> 'inactive'`)).rows;
    const hit = rows.filter(r => hasAll(r.name, parts) && roleOk(r));
    return { hit: hit.length === 1 ? hit[0] : null, count: hit.length };
}

async function legacyAssignments(db, subject = null) {
    // Asosiy ustozga (yordamchi lavozimida bo'lmagan xodimga) yordamchi sifatida biriktirilgan faol o'quvchilar.
    const rows = (await db.query(`SELECT s.id, s.name, s.subject, s.extra_data, he.id AS aid, he.name AS aname FROM students s
        JOIN hr_employees he ON he.id = s.assistant_teacher_id WHERE he.role = ANY($1::text[])`, [MAIN_ROLES])).rows
        .filter(r => { const x = typeof r.extra_data === 'object' && r.extra_data ? r.extra_data : (() => { try { return JSON.parse(r.extra_data || '{}'); } catch { return {}; } })();
            if (subject && (r.subject || 'english') !== subject) return false;
            return !['inactive', 'archived', 'deleted', 'left'].includes(String(x.status || '').toLowerCase()) && x.isStaffDemo !== true; });
    const by = new Map();
    for (const r of rows) { if (!by.has(r.aid)) by.set(r.aid, { id: r.aid, name: r.aname, students: [] }); by.get(r.aid).students.push({ id: r.id, name: r.name }); }
    return { total: rows.length, teachers: [...by.values()] };
}

async function migrate(pool, log = console) {
    await pool.query(`CREATE TABLE IF NOT EXISTS school_migrations (id TEXT PRIMARY KEY, ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), result JSONB NOT NULL DEFAULT '{}')`);
    const c = await pool.connect();
    let result = null;
    try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [MIGRATION_ID]);
        const done = (await c.query('SELECT result FROM school_migrations WHERE id=$1', [MIGRATION_ID])).rows[0];
        if (done) { await c.query('COMMIT'); result = { ...done.result, skipped: 'already-done' }; }
        else {
            const main = await findOne(c, ['mohinur', 'azimova'], r => MAIN_ROLES.includes(r.role));
            const asst = await findOne(c, ['ayubxon', 'axmadjonov'], r => r.role === 'yordamchi');
            const pending = main.hit ? Number((await c.query('SELECT COUNT(*)::int AS n FROM students WHERE assistant_teacher_id=$1', [main.hit.id])).rows[0].n) : null;
            if (main.hit && pending === 0) {
                // Ko'chiriladigan narsa yo'q — bajarilgan deb yoziladi.
                result = { skipped: 'nothing-to-move', from: { id: main.hit.id, name: main.hit.name }, moved: [], kept: [] };
                await c.query('INSERT INTO school_migrations (id, result) VALUES ($1,$2)', [MIGRATION_ID, JSON.stringify(result)]);
                await c.query('COMMIT');
                log.log(`[yordamchi-alohida] ${main.hit.name}da yordamchi o'quvchi yo'q — ko'chirish kerak emas`);
            } else if (!main.hit || !asst.hit) {
                // Marker yozilmaydi — keyingi ishga tushishda yana urinadi.
                result = { skipped: 'not-found', retry: true, mohinur: main.count, ayubxon: asst.count };
                const anyAyub = asst.hit ? null : await findOne(c, ['ayubxon', 'axmadjonov'], () => true);
                await c.query('COMMIT');
                const why = [!main.hit ? `Mohinur Azimova (asosiy ustoz lavozimida) ${main.count} ta topildi` : '',
                    !asst.hit ? (anyAyub?.count ? `Ayubxon Axmadjonov topildi, lekin HR lavozimi 'yordamchi' emas (${anyAyub.hit?.role || anyAyub.count + ' ta moslik'})` : `Ayubxon Axmadjonov (yordamchi) ${asst.count} ta topildi`) : ''].filter(Boolean).join('; ');
                log.warn(`[yordamchi-alohida] ko'chirilmadi, keyingi ishga tushishda yana uriniladi: ${why} — ikkalasi bittadan bo'lishi kerak`);
            } else {
                const lang = roles.language(asst.hit);
                const studs = (await c.query('SELECT id, name, subject, teacher_id FROM students WHERE assistant_teacher_id=$1 ORDER BY name FOR UPDATE', [main.hit.id])).rows;
                const moved = [], kept = [];
                for (const s of studs) {
                    // Til mos bo'lmasa yoki Ayubxon shu o'quvchining asosiy ustozi bo'lsa — tegilmaydi (admin qo'lda hal qiladi).
                    if ((s.subject || 'english') !== lang || s.teacher_id === asst.hit.id) { kept.push({ id: s.id, name: s.name }); continue; }
                    await c.query(`UPDATE students SET assistant_teacher_id=$2,
                        extra_data = COALESCE(extra_data,'{}'::jsonb) || jsonb_build_object('schoolRev', COALESCE((extra_data->>'schoolRev')::int,0)+1)
                        WHERE id=$1 AND assistant_teacher_id=$3`, [s.id, asst.hit.id, main.hit.id]);
                    await c.query(`INSERT INTO school_student_audit (student_id,action,changes,reason,actor_id,actor_name,actor_role)
                        VALUES ($1,'edit',$2,$3,'system','Tizim (migratsiya)','system')`,
                        [s.id, JSON.stringify({ assistant: [main.hit.name, asst.hit.name], assistantId: { from: main.hit.id, to: asst.hit.id } }), REASON]);
                    moved.push({ id: s.id, name: s.name });
                }
                result = { from: { id: main.hit.id, name: main.hit.name }, to: { id: asst.hit.id, name: asst.hit.name }, moved, kept };
                await c.query('INSERT INTO school_migrations (id, result) VALUES ($1,$2)', [MIGRATION_ID, JSON.stringify(result)]);
                await c.query('COMMIT');
                log.log(`[yordamchi-alohida] ${main.hit.name} → ${asst.hit.name}: ${moved.length} o'quvchi ko'chirildi${kept.length ? `, ${kept.length} ta til mos emas — tegilmadi` : ''}`);
            }
        }
    } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        throw e;
    } finally { c.release(); }
    const legacy = await legacyAssignments(pool);
    // Ogohlantirish faqat ko'chirish shu ishga tushishda bajarilganda (keyin — admin "Yordamchi kerak" ro'yxatida ko'radi).
    if (legacy.total && result?.skipped !== 'already-done') log.warn(`[yordamchi-alohida] DIQQAT: ${legacy.total} o'quvchi hali asosiy ustozga yordamchi sifatida biriktirilgan (avtomatik ko'chirilmadi): `
        + legacy.teachers.map(t => `${t.name} — ${t.students.length}`).join(', '));
    return { ...result, legacy: legacy.total };
}

module.exports = { MIGRATION_ID, REASON, migrate, legacyAssignments };
