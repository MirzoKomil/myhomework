'use strict';
// O'quvchining ochiq ID'si (serialCode, masalan AA001) — FAQAT server beradi.
//
// Ilgari ID brauzerda "ko'rinib turgan lidlarning eng kattasi + 1" sifatida
// yaratilardi. Sotuv menejeri faqat o'z lidlarini ko'rgani uchun ikki menejer
// bir xil ID berardi (jonli bazada #AA001 va #AA422 ikki o'quvchida). Endi:
//  • ID lid "To'lov jarayonida" / "To'lov yopildi"ga o'tganda, lid saqlanadigan
//    tranzaksiya ichida, umumiy qulf ostida beriladi (lidlar, o'quvchilar va kitob
//    kartalaridagi eng katta ID + 1);
//  • leads va students jadvallarida kanonik ID uchun UNIQUE indeks — baza darajasida kafolat;
//  • ID o'zgarmaydi: bir marta berilgan ID brauzer nima yuborsa ham saqlanib qoladi.
// ID'lar umumiy ketma-ketlik (AA001…AA999, AB001…): ingliz va rus o'quvchilari orasida ham takrorlanmaydi.
// ID login emas (o'quvchi telefon bilan kiradi) va tashqi kalit emas — faqat ko'rinadigan raqam
// hamda kitob kartasidagi "Student ID" (book_roadmap.student_id) shu bilan bog'lanadi.

const RE = /^[A-Z]{2}\d{3}$/;
const SQL_RE = '^[A-Z]{2}[0-9]{3}$';
const LOCK = "SELECT pg_advisory_xact_lock(hashtext('public-serial-code'))";
const NEED_STATUSES = new Set(['tolov-jarayonida', 'tolov-yopildi']);
const MIGRATION = 'serial-takror-v1';

const canonical = v => { const s = String(v || '').trim().toUpperCase(); return RE.test(s) ? s : ''; };
const obj = v => { if (v && typeof v === 'object') return v; try { return JSON.parse(v || '{}') || {}; } catch { return {}; } };
const refId = v => { const r = obj(v); return r && r.id != null ? String(r.id) : ''; };

function nextCode(code) {
    const c = canonical(code);
    if (!c) return 'AA001';
    let letters = c.slice(0, 2), num = Number(c.slice(2)) + 1;
    if (num > 999) {
        num = 1;
        const a = letters.charCodeAt(0) - 65, b = letters.charCodeAt(1) - 65 + 1;
        const n = a * 26 + b;
        if (n >= 26 * 26) throw new Error("O'quvchi ID'lari tugadi (ZZ999)");
        letters = String.fromCharCode(65 + Math.floor(n / 26), 65 + (n % 26));
    }
    return letters + String(num).padStart(3, '0');
}

// Ishlatilgan eng katta ID (o'chirilgan lidlar, o'quvchilar va kitob kartalari ham hisobga olinadi).
async function maxUsed(client) {
    const { rows } = await client.query(`SELECT MAX(c) AS m FROM (
        SELECT extra_data->>'serialCode' AS c FROM leads
        UNION ALL SELECT extra_data->>'serialCode' FROM students
        UNION ALL SELECT student_id FROM book_roadmap) x WHERE c ~ $1`, [SQL_RE]);
    return rows[0]?.m || null;
}

// Tranzaksiya ichida chaqiriladi: qulf commit'gacha turadi, shu sabab bir vaqtdagi ikkinchi
// so'rov birinchisi yozib bo'lgach eng kattani ko'radi. UNIQUE indeks — zaxira kafolat.
async function allocate(client) {
    await client.query(LOCK);
    return nextCode(await maxUsed(client));
}

// Lid saqlanishidan oldin (db.js upsertLeadWithClient): ID'ni server belgilaydi.
// before — bazadagi eski lid (yoki null), merged — saqlanadigan lid (joyida o'zgartiriladi).
async function applyToLead(client, before, merged, status) {
    // Bir marta berilgan ID (eski boshqa ko'rinishdagisi ham, masalan EN-0412) o'zgarmaydi.
    const prev = String(before?.serialCode ?? '').trim();
    if (prev) { merged.serialCode = before.serialCode; return { code: canonical(prev), assigned: false }; }
    if (NEED_STATUSES.has(status)) {
        const code = await allocate(client);
        merged.serialCode = code;
        return { code, assigned: true };
    }
    // Brauzer o'zi "o'ylab topgan" ID qabul qilinmaydi.
    delete merged.serialCode;
    return { code: '', assigned: false };
}

// Lidga ID berilgach: bog'langan o'quvchi(lar) va kitob kartasi ham shu ID'ni oladi
// (ularda hali kanonik ID bo'lmasa). Brauzer endi o'zi ID tarqatmaydi.
async function syncLinked(client, leadId, code) {
    if (!leadId || !canonical(code)) return;
    await client.query(`UPDATE students SET extra_data = COALESCE(extra_data,'{}'::jsonb) || jsonb_build_object('serialCode', $2::text)
        WHERE extra_data->'leadRef'->>'id' = $1 AND COALESCE(extra_data->>'serialCode','') !~ $3
          AND NOT EXISTS (SELECT 1 FROM students o WHERE o.extra_data->>'serialCode' = $2 AND COALESCE(o.extra_data->>'isStaffDemo','') <> 'true')`, [String(leadId), code, SQL_RE]);
    const cards = (await client.query(`SELECT id, lead_ref, student_id FROM book_roadmap WHERE lead_ref LIKE $1`,
        ['%' + String(leadId).replace(/[%_\\]/g, '\\$&') + '%'])).rows;
    for (const c of cards) if (refId(c.lead_ref) === String(leadId) && !canonical(c.student_id))
        await client.query('UPDATE book_roadmap SET student_id=$2 WHERE id=$1', [c.id, code]);
}

// PATCH /api/state (admin/boshliq) o'quvchilar ro'yxati: ID serverniki — bazadagi ID saqlanadi,
// yo'q bo'lsa bog'langan lidniki; brauzer yuborgan yangi/eskirgan ID (masalan, takror tuzatilgandan
// keyin ochiq qolgan eski oynadan) qabul qilinmaydi.
async function guardStudentSerials(client, students, existingById) {
    if (!Array.isArray(students) || !students.length) return;
    const leadIds = [...new Set(students.map(s => s?.leadRef?.id).filter(Boolean).map(String))];
    const leadSerial = new Map(leadIds.length ? (await client.query(
        `SELECT id, extra_data->>'serialCode' AS c FROM leads WHERE id = ANY($1)`, [leadIds])).rows.map(r => [String(r.id), canonical(r.c)]) : []);
    const used = new Set();
    for (const s of students) {
        if (!s || !s.id || s.isStaffDemo) continue;
        const own = canonical(existingById.get(s.id)?.serialCode);
        const fromLead = s.leadRef?.id ? leadSerial.get(String(s.leadRef.id)) || '' : '';
        let code = own || fromLead;
        if (code && used.has(code)) code = '';
        if (code) { s.serialCode = code; used.add(code); }
        else if (canonical(s.serialCode)) {
            // Kanonik ko'rinishdagi, lekin server bermagan ID — olib tashlanadi (keyin liddan to'ldiriladi).
            console.warn(`[serial-takror] o'quvchi ${s.id}: brauzer yuborgan ID ${s.serialCode} qabul qilinmadi`);
            const old = existingById.get(s.id)?.serialCode;
            if (old !== undefined && !canonical(old)) s.serialCode = old; else delete s.serialCode;
        }
    }
}

// Arxivdan tiklash: ID boshqa yozuvda band bo'lsa — lid uchun yangisi beriladi, o'quvchida olib tashlanadi.
async function freeForRestore(client, table, row) {
    const extra = obj(row.extra_data);
    const code = canonical(extra.serialCode);
    if (!code) return null;
    const t = table === 'leads' ? 'leads' : 'students';
    const taken = (await client.query(`SELECT 1 FROM ${t} WHERE extra_data->>'serialCode' = $1 AND id <> $2 AND COALESCE(extra_data->>'isStaffDemo','') <> 'true' LIMIT 1`, [code, String(row.id)])).rows.length;
    if (!taken) return null;
    const next = t === 'leads' ? await allocate(client) : '';
    if (next) extra.serialCode = next; else delete extra.serialCode;
    row.extra_data = typeof row.extra_data === 'string' ? JSON.stringify(extra) : extra;
    await audit(client, t === 'leads' ? 'lead' : 'student', row.id, code, next, 'arxivdan tiklash: ID band edi', 'restore');
    console.warn(`[serial-takror] arxivdan tiklash ${t}/${row.id}: ${code} band edi → ${next || "olib tashlandi"}`);
    return next;
}

async function ensureAuditTable(client) {
    await client.query(`CREATE TABLE IF NOT EXISTS serial_code_audit (
        id BIGSERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT NOW(), entity TEXT NOT NULL, entity_id TEXT NOT NULL,
        old_code TEXT, new_code TEXT, reason TEXT, migration TEXT)`);
}
async function audit(client, entity, id, oldCode, newCode, reason, migration = MIGRATION) {
    await client.query(`INSERT INTO serial_code_audit (entity, entity_id, old_code, new_code, reason, migration) VALUES ($1,$2,$3,$4,$5,$6)`,
        [entity, String(id), oldCode || null, newCode || null, reason, migration]);
}

// "Kim birinchi olgan": lid to'lov bosqichiga birinchi kirgan vaqt (bosqichlar tarixi), keyin
// statusChangedAt, keyin lid yaratilgan vaqt. Lidsiz o'quvchi — sotilgan/qo'shilgan sana.
function leadSince(row) {
    const e = obj(row.extra_data);
    const h = (Array.isArray(e.stageHistory) ? e.stageHistory : []).find(x => x && NEED_STATUSES.has(x.to) && x.at);
    const t = Date.parse(h?.at || e.statusChangedAt || '') || (row.created_at ? new Date(row.created_at).getTime() : NaN);
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}
function studentSince(row) {
    const e = obj(row.extra_data);
    for (const k of ['soldAt', 'joinDate', 'startDate']) { const t = Date.parse(e[k] || ''); if (Number.isFinite(t)) return t; }
    return Number.MAX_SAFE_INTEGER;
}

/**
 * Bir martalik (idempotent) tuzatish: mavjud takror ID'lar va to'lov bosqichidagi ID'siz lidlar.
 * Har ID uchun "egalar" (lid va unga bog'langan o'quvchi/karta bitta ega) topiladi; eng birinchi
 * olgan ega ID'ni saqlaydi, keyingilarga navbatdagi bo'sh ID beriladi. Har o'zgarish
 * serial_code_audit jadvaliga (eski → yangi) yoziladi va logga `[serial-takror]` bilan chiqadi.
 * Keyin UNIQUE indekslar yaratiladi. Takror qolmagan bo'lsa hech narsa o'zgarmaydi.
 */
async function migrate(client) {
    await ensureAuditTable(client);
    await client.query(LOCK);
    const leads = (await client.query(`SELECT id, status, created_at, deleted_at, extra_data FROM leads`)).rows;
    const students = (await client.query(`SELECT id, extra_data FROM students`)).rows;
    const cards = (await client.query(`SELECT id, lead_ref, student_id FROM book_roadmap`)).rows;
    const leadById = new Map(leads.map(l => [String(l.id), l]));
    const studentsOfLead = new Map();
    for (const s of students) { const lid = obj(s.extra_data).leadRef?.id; if (lid) { const k = String(lid); if (!studentsOfLead.has(k)) studentsOfLead.set(k, []); studentsOfLead.get(k).push(s); } }
    const cardsOfLead = new Map();
    for (const c of cards) { const lid = refId(c.lead_ref); if (lid) { if (!cardsOfLead.has(lid)) cardsOfLead.set(lid, []); cardsOfLead.get(lid).push(c); } }

    // code → Map(ownerKey → since)
    const owners = new Map();
    const addOwner = (code, key, since) => {
        if (!code) return;
        if (!owners.has(code)) owners.set(code, new Map());
        const m = owners.get(code);
        m.set(key, Math.min(m.get(key) ?? Number.MAX_SAFE_INTEGER, since));
    };
    for (const l of leads) addOwner(canonical(obj(l.extra_data).serialCode), 'lead:' + l.id, leadSince(l));
    for (const s of students) {
        const e = obj(s.extra_data);
        if (e.isStaffDemo) continue;
        const lid = e.leadRef?.id ? String(e.leadRef.id) : '';
        const key = lid && leadById.has(lid) ? 'lead:' + lid : 'student:' + s.id;
        addOwner(canonical(e.serialCode), key, lid && leadById.has(lid) ? Math.min(leadSince(leadById.get(lid)), studentSince(s)) : studentSince(s));
    }

    let max = await maxUsed(client);
    const take = () => { max = nextCode(max); return max; };
    const changes = [];
    const setLead = async (id, oldCode, code, reason) => {
        await client.query(`UPDATE leads SET extra_data = COALESCE(extra_data,'{}'::jsonb) || jsonb_build_object('serialCode', $2::text) WHERE id=$1`, [id, code]);
        await audit(client, 'lead', id, oldCode, code, reason); changes.push(`lid ${id}: ${oldCode || '—'} → ${code}`);
    };
    const setStudent = async (id, oldCode, code, reason) => {
        await client.query(`UPDATE students SET extra_data = COALESCE(extra_data,'{}'::jsonb) || jsonb_build_object('serialCode', $2::text) WHERE id=$1`, [id, code]);
        await audit(client, 'student', id, oldCode, code, reason); changes.push(`o'quvchi ${id}: ${oldCode || '—'} → ${code}`);
    };
    const setCard = async (id, oldCode, code, reason) => {
        await client.query('UPDATE book_roadmap SET student_id=$2 WHERE id=$1', [id, code]);
        await audit(client, 'book_roadmap', id, oldCode, code, reason); changes.push(`kitob kartasi ${id}: ${oldCode || '—'} → ${code}`);
    };

    // 1) Takrorlar
    for (const [code, m] of owners) {
        if (m.size < 2) continue;
        const sorted = [...m.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
        const keeper = sorted[0][0];
        for (const [key] of sorted.slice(1)) {
            const fresh = take();
            const reason = `takror ${code} (${keeper.replace(':', ' ')} saqlab qoldi)`;
            if (key.startsWith('lead:')) {
                const lid = key.slice(5);
                if (canonical(obj(leadById.get(lid)?.extra_data).serialCode) === code) await setLead(lid, code, fresh, reason);
                for (const s of studentsOfLead.get(lid) || []) if (canonical(obj(s.extra_data).serialCode) === code) await setStudent(s.id, code, fresh, reason);
                for (const c of cardsOfLead.get(lid) || []) if (canonical(c.student_id) === code) await setCard(c.id, code, fresh, reason);
            } else {
                await setStudent(key.slice(8), code, fresh, reason);
            }
        }
    }

    // 2) To'lov bosqichidagi, lekin ID'siz lidlar (ilgari brauzer sahifa ochilganda berardi) va
    //    lidida ID bor-u, o'zida yo'q o'quvchi/karta.
    const fresh = (await client.query(`SELECT id, status, deleted_at, extra_data FROM leads`)).rows;
    const takenStudents = new Set((await client.query(`SELECT extra_data->>'serialCode' c FROM students WHERE extra_data->>'serialCode' ~ $1 AND COALESCE(extra_data->>'isStaffDemo','') <> 'true'`, [SQL_RE])).rows.map(r => r.c));
    for (const l of fresh) {
        let code = canonical(obj(l.extra_data).serialCode);
        if (!String(obj(l.extra_data).serialCode ?? '').trim() && !l.deleted_at && NEED_STATUSES.has(l.status)) {
            code = take();
            await setLead(l.id, obj(l.extra_data).serialCode || '', code, "to'lov bosqichidagi lidda ID yo'q edi");
        }
        if (!code) continue;
        for (const s of (await client.query(`SELECT id, extra_data FROM students WHERE extra_data->'leadRef'->>'id' = $1`, [String(l.id)])).rows) {
            const sc = obj(s.extra_data).serialCode;
            if (!canonical(sc) && !takenStudents.has(code)) { await setStudent(s.id, sc || '', code, "o'quvchida ID yo'q edi — lidnikidan"); takenStudents.add(code); }
        }
        for (const c of cardsOfLead.get(String(l.id)) || []) {
            const cur = (await client.query('SELECT student_id FROM book_roadmap WHERE id=$1', [c.id])).rows[0];
            if (cur && !canonical(cur.student_id)) await setCard(c.id, cur.student_id || '', code, "kitob kartasida ID yo'q edi — lidnikidan");
        }
    }

    for (const line of changes) console.log(`[serial-takror] ${line}`);
    if (changes.length) console.log(`[serial-takror] jami ${changes.length} ta o'zgarish (serial_code_audit, migration=${MIGRATION})`);
    return changes.length;
}

async function ensureIndexes(client) {
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS leads_serial_code_uq ON leads ((extra_data->>'serialCode')) WHERE extra_data->>'serialCode' ~ '${SQL_RE}'`);
    // Xodimning demo hisobi (isStaffDemo) — haqiqiy o'quvchi emas, noyoblikka kirmaydi.
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS students_serial_code_uq ON students ((extra_data->>'serialCode'))
        WHERE extra_data->>'serialCode' ~ '${SQL_RE}' AND COALESCE(extra_data->>'isStaffDemo', '') <> 'true'`);
}

module.exports = { RE, SQL_RE, NEED_STATUSES, MIGRATION, canonical, nextCode, maxUsed, allocate, applyToLead, syncLinked,
    guardStudentSerials, freeForRestore, migrate, ensureIndexes, ensureAuditTable, leadSince };
