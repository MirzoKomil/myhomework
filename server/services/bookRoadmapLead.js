'use strict';
// Kitob yetkazish kartochkasi — liddan (To'lov jarayonida / To'lov yopildi).
// Sotuv menejeri umumiy /api/state snapshotini yoza olmaydi (403), shu sabab
// konversiyada kartochka shu yerda, SERVERdagi lid ma'lumotidan yaratiladi yoki
// yangilanadi. Sotuv faqat O'Z lidi uchun (lid.manager_id = o'z menejer ID'si).
// Mavjud kartochkaning holati, izohlari, jo'natish/yetkazish sanasi o'zgarmaydi —
// js/app.js autoSyncLeadToBookRoadmap bilan bir xil qoida.
const { randomUUID } = require('node:crypto');

const NEED_STATUSES = new Set(['tolov-jarayonida', 'tolov-yopildi']);
const fail = (status, message) => Object.assign(new Error(message), { status });
const obj = v => { if (v && typeof v === 'object') return v; try { return JSON.parse(v || '{}') || {}; } catch { return {}; } };
const arr = v => { if (Array.isArray(v)) return v; try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch { return []; } };
const refOf = v => { try { const r = typeof v === 'string' ? JSON.parse(v) : v; return r && typeof r === 'object' ? r : null; } catch { return null; } };
// Toshkent bo'yicha bugungi sana (dd.mm.yyyy) — kanban kartochkasidagi "sana".
const todayLabel = (now = new Date()) => { const d = new Date(now.getTime() + 5 * 3600000); return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`; };

/**
 * @param client  — tranzaksiya ichidagi pg client
 * @param leadId
 * @param actor   — { role, name }
 * @param managerId — sotuv menejeri bo'lsa uning menejer ID'si (aks holda null)
 * @param langs   — ROP til cheklovi (null — cheklovsiz)
 * @param entryId — klient keshidagi yangi kartochka ID'si (UUID; band bo'lsa server o'zi beradi)
 * @returns {{ entry, created }}
 */
async function upsertFromLead(client, { leadId, entryId = null, actor, managerId = null, langs = null, now = new Date() }) {
    const id = String(leadId || '').trim();
    if (!id) throw fail(400, 'Lid ko\'rsatilmagan');
    const row = (await client.query('SELECT * FROM leads WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [id])).rows[0];
    if (!row) throw fail(404, 'Lid topilmadi');
    if (actor?.role === 'sales_manager' && (!managerId || String(row.manager_id || '') !== String(managerId)))
        throw fail(403, 'Faqat o\'z lidingiz uchun kitob yetkazish yozuvi yaratiladi');
    const lang = row.language === 'russian' ? 'russian' : 'english';
    if (langs && !langs.includes(lang)) throw fail(403, 'ROP faqat o\'z til yo\'nalishidagi lid bilan ishlaydi');
    if (!NEED_STATUSES.has(row.status)) throw fail(409, 'Kitob yetkazish faqat "To\'lov jarayonida" yoki "To\'lov yopildi" bosqichidagi lid uchun');
    const extra = obj(row.extra_data);
    const fields = {
        name: row.name || extra.fullName || '',
        student_id: extra.serialCode || extra.studentId || '',
        phone: row.phone || '',
        region: extra.region || '',
        manager_id: row.manager_id || '',
        address: extra.paymentOnboarding?.bookAddress || ''
    };
    // Bir lidga bitta kartochka (bir vaqtda kelgan ikki so'rov ham bitta yaratadi).
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['book_roadmap:' + id]);
    const candidates = (await client.query(`SELECT * FROM book_roadmap WHERE lead_ref IS NOT NULL AND lead_ref LIKE $1`, ['%' + id.replace(/[%_\\]/g, '\\$&') + '%'])).rows;
    const existing = candidates.find(r => { const ref = refOf(r.lead_ref); return ref && String(ref.id) === id && (ref.lang || 'english') === lang; });
    if (existing) {
        const upd = (await client.query(
            `UPDATE book_roadmap SET name=$2, student_id=$3, phone=$4, region=$5, manager_id=$6, address=$7 WHERE id=$1 RETURNING *`,
            [existing.id, fields.name || existing.name, fields.student_id || existing.student_id || '', fields.phone || existing.phone || '',
                fields.region || existing.region || '', fields.manager_id, fields.address || existing.address || ''])).rows[0];
        return { entry: upd, created: false };
    }
    const summary = [];
    if (row.source) summary.push(`Manba: ${row.source}`);
    const s = extra.connectedSurvey || null;
    if (s?.languageLevel) summary.push(`Til darajasi: ${s.languageLevel}`);
    if (s?.learningGoal) summary.push(`Maqsad: ${s.learningGoal}`);
    if (s?.region) summary.push(`Hudud: ${s.region}`);
    const comments = [...arr(row.comments), {
        id: 'c' + now.getTime(), type: 'sync', reason: null, author: actor?.name || 'Admin', createdAt: now.toISOString(),
        text: `Liddan avtomatik qo'shildi (To'lov jarayonida)${summary.length ? '\n' + summary.join(' · ') : ''}`
    }];
    const want = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(entryId || '')) ? String(entryId) : null;
    const newId = want && !(await client.query('SELECT 1 FROM book_roadmap WHERE id=$1', [want])).rows.length ? want : randomUUID();
    const ins = (await client.query(
        `INSERT INTO book_roadmap (id, name, student_id, phone, region, manager_id, kind, status, date, lang, lead_ref, comments, address, dispatched_at, delivered_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'yangi-oquvchi',$8,$9,$10,$11,$12,'','') RETURNING *`,
        [newId, fields.name, fields.student_id, fields.phone, fields.region, fields.manager_id,
            row.lead_type === 'target' ? 'target' : 'organik', todayLabel(now), lang, JSON.stringify({ lang, id }),
            JSON.stringify(comments), fields.address])).rows[0];
    return { entry: ins, created: true };
}

// Kanban ustunlari (js/app.js BOOK_ROADMAP_COLUMNS) va jo'natish bosqichlari.
const STATUSES = new Set(['yangi-oquvchi', 'manzil-olindi', 'pochtaga-tayyorlandi', 'pochtaga-topshirildi', 'pochta-yetib-bordi', 'mijoz-qabul-qildi']);
const SHIPPING = new Set(['pochtaga-topshirildi', 'pochta-yetib-bordi', 'mijoz-qabul-qildi']);
const DISPATCHED = new Set(['pochtaga-topshirildi']), DELIVERED = new Set(['mijoz-qabul-qildi']);
const MAX_COMMENTS = 300;
const cleanComment = c => (c && typeof c === 'object' ? {
    id: String(c.id || '').slice(0, 64) || 'c' + Date.now(), text: String(c.text ?? '').slice(0, 4000), author: String(c.author || '').slice(0, 120),
    type: String(c.type || 'manual').slice(0, 40), reason: c.reason == null ? null : String(c.reason).slice(0, 200),
    ...(c.reasonId ? { reasonId: String(c.reasonId).slice(0, 64) } : {}), createdAt: String(c.createdAt || new Date().toISOString()).slice(0, 40)
} : null);

/**
 * Sotuv menejeri o'z kartochkasining bosqichi, izohlari va manzilini o'zgartiradi
 * (kanban). Ism/telefon/menejer/lid havolasi — faqat liddan (upsertFromLead) yoki admin.
 * Jo'natish bosqichiga faqat to'lov tasdiqlangan (to'liq/nasiya yoki "To'lov yopildi") lid o'tadi.
 */
async function updateOwnEntry(client, { entryId, patch = {}, actor, managerId = null, langs = null, now = new Date() }) {
    const cur = (await client.query('SELECT * FROM book_roadmap WHERE id=$1 FOR UPDATE', [String(entryId || '')])).rows[0];
    if (!cur) throw fail(404, 'Kitob yetkazish yozuvi topilmadi');
    if (actor?.role === 'sales_manager' && (!managerId || String(cur.manager_id || '') !== String(managerId)))
        throw fail(403, 'Faqat o\'z o\'quvchingizning kitob yetkazish yozuvini o\'zgartirasiz');
    if (langs && !langs.includes(cur.lang === 'russian' ? 'russian' : 'english')) throw fail(403, 'ROP faqat o\'z til yo\'nalishidagi yozuv bilan ishlaydi');
    const next = { status: cur.status, comments: arr(cur.comments), address: cur.address || '', dispatched: cur.dispatched_at || '', delivered: cur.delivered_at || '' };
    if (patch.status !== undefined && patch.status !== cur.status) {
        if (!STATUSES.has(patch.status)) throw fail(400, 'Bosqich noto\'g\'ri');
        if (SHIPPING.has(patch.status)) {
            const ref = refOf(cur.lead_ref);
            const lead = ref?.id ? (await client.query('SELECT status, extra_data FROM leads WHERE id=$1', [String(ref.id)])).rows[0] : null;
            const pt = lead ? obj(lead.extra_data).paymentSurvey?.paymentType : null;
            if (lead && lead.status !== 'tolov-yopildi' && pt !== 'full' && pt !== 'installment')
                throw fail(409, 'Kitobni jo\'natishdan oldin to\'lov tasdiqlanishi kerak (to\'liq to\'lov yoki nasiya)');
        }
        next.status = patch.status;
        const today = new Date(now.getTime() + 5 * 3600000).toISOString().slice(0, 10);
        if (DISPATCHED.has(next.status) && !next.dispatched) next.dispatched = today;
        if (DELIVERED.has(next.status) && !next.delivered) next.delivered = today;
    }
    if (patch.comments !== undefined) {
        if (!Array.isArray(patch.comments) || patch.comments.length > MAX_COMMENTS) throw fail(400, 'Izohlar ro\'yxati noto\'g\'ri');
        next.comments = patch.comments.map(cleanComment).filter(Boolean);
    }
    if (patch.address !== undefined) next.address = String(patch.address || '').slice(0, 400);
    const upd = (await client.query(`UPDATE book_roadmap SET status=$2, comments=$3, address=$4, dispatched_at=$5, delivered_at=$6 WHERE id=$1 RETURNING *`,
        [cur.id, next.status, JSON.stringify(next.comments), next.address, next.dispatched, next.delivered])).rows[0];
    return { entry: upd };
}

// server/db.js rowToBookRoadmap bilan bir xil shakl (klient keshi uchun).
const toClient = r => r && ({
    id: r.id, name: r.name, studentId: r.student_id || '', phone: r.phone || '', region: r.region || '',
    managerId: r.manager_id || '', kind: r.kind || 'organik', status: r.status || 'yangi-oquvchi', date: r.date || '',
    lang: r.lang || 'english', leadRef: refOf(r.lead_ref), address: r.address || '', dispatchedAt: r.dispatched_at || '',
    deliveredAt: r.delivered_at || '', comments: arr(r.comments), createdAt: r.created_at || null
});

module.exports = { upsertFromLead, updateOwnEntry, toClient, STATUSES, NEED_STATUSES, todayLabel };
