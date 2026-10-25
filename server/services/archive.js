'use strict';
// Arxiv — CRM'dan o'chirilgan har qanday yozuvning server tomondagi nusxasi.
//
// Qoidalar:
//  * Arxivga yozishni faqat server qiladi. Brauzer qanday yo'l bilan
//    o'chirmasin (snapshot PATCH, alohida DELETE, eski tab) — o'chgan qator
//    bazadan yo'qolishidan oldin shu tranzaksiya ichida arxivga tushadi.
//    Arxivga yozilmasa, o'chirish ham bo'lmaydi (bitta tranzaksiya).
//  * Nusxa — bazadagi qatorning o'zi (raw row) yoki JSON elementning o'zi.
//    Tiklash shu nusxani aynan joyiga qaytaradi.
//  * Arxiv hech qachon avtomatik tozalanmaydi. Tiklangan yozuv ham o'chmaydi,
//    faqat "tiklangan" deb belgilanadi (kim, qachon) — iz qoladi.
//  * Lidlar alohida: ular allaqachon `leads.deleted_at` bilan yumshoq
//    o'chiriladi, arxiv ro'yxatida ular shu jadvaldan qo'shib ko'rsatiladi.

const { randomUUID } = require('crypto');
const ctx = require('./archiveContext');

// Bazadagi jadval → arxiv turi.
const TABLE_TYPES = {
    students: {
        type: 'student', label: "O'quvchi",
        title: r => r.name, subtitle: r => [r.phone, r.group_name].filter(Boolean).join(' · '),
        lang: r => r.subject === 'russian' ? 'russian' : 'english'
    },
    hr_employees: {
        type: 'employee', label: 'Xodim',
        title: r => r.name, subtitle: r => [r.role, r.phone].filter(Boolean).join(' · '),
        lang: r => r.lang || ''
    },
    teachers: {
        type: 'teacher', label: 'Ustoz (eski jadval)',
        title: r => r.name, subtitle: r => r.phone || '',
        lang: r => r.subject === 'russian' ? 'russian' : 'english'
    },
    book_roadmap: {
        type: 'bookRoadmap', label: 'Kitob yetkazish',
        title: r => r.name, subtitle: r => [r.phone, r.region].filter(Boolean).join(' · '),
        lang: r => r.lang || ''
    },
    hr_candidates: {
        type: 'candidate', label: 'HR nomzod',
        title: r => r.full_name || 'Nomzod', subtitle: r => [r.vacancy_name, r.contact_phone || r.telegram_phone].filter(Boolean).join(' · '),
        lang: () => ''
    }
};

// json_data kalitlari (massiv, har bir elementda `id`) → arxiv turi.
const JSON_TYPES = {
    scripts: { type: 'script', label: 'Sotuv skripti', title: i => i.title || i.name },
    guides: { type: 'guide', label: "Yo'riqnoma", title: i => i.title || i.name },
    bonusHistory: { type: 'bonus', label: 'Bonus tarixi', title: i => [i.managerName || i.managerId, som(i.amount)].filter(Boolean).join(' · ') },
    shopOrders: { type: 'shopOrder', label: "Do'kon buyurtmasi", title: i => i.studentName || i.name || i.title },
    manualNotifications: { type: 'notification', label: 'Bildirishnoma', title: i => i.title || i.text },
    contentComments: { type: 'contentComment', label: 'Dars izohi', title: i => i.text || i.body },
    communityPosts: { type: 'communityPost', label: 'Hamjamiyat posti', title: i => i.text || i.title || i.body },
    callRecordings: { type: 'callRecording', label: "Qo'ng'iroq yozuvi", title: i => i.title || i.name || i.fileName || i.phone },
    cashFlow: { type: 'cashTx', label: 'Pul oqimi yozuvi', title: i => [i.category || i.type, som(i.amount), i.date].filter(Boolean).join(' · ') },
    orgChart: { type: 'orgNode', label: 'Tashkiliy tuzilma', title: i => i.title || i.name }
};

const TYPE_LABELS = {
    lead: 'Lid',
    communityComment: 'Hamjamiyat izohi',
    offboarding: 'Ishdan bo‘shatish',
    ...Object.fromEntries(Object.values(TABLE_TYPES).map(t => [t.type, t.label])),
    ...Object.fromEntries(Object.values(JSON_TYPES).map(t => [t.type, t.label]))
};

const FULL_ROLES = new Set(['admin', 'boshliq']);
// ROP sotuv bilan bog'liq turlarni ko'radi va tiklaydi (xodimning pasport,
// karta kabi maxfiy maydonlari bo'lgan nusxalar faqat admin/boshliqqa).
const ROP_TYPES = new Set(['lead', 'student', 'bookRoadmap', 'script', 'bonus']);

function err(status, message, code) { return Object.assign(new Error(message), { status, code }); }
const som = v => (Number.isFinite(Number(v)) && v !== '' && v !== null ? String(Math.round(Number(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' so‘m' : '');

function canView(actor, type) {
    if (FULL_ROLES.has(actor?.role)) return true;
    return actor?.role === 'rop' && ROP_TYPES.has(type);
}

function short(value, max = 160) {
    const s = String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS archive_records (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL DEFAULT '',
    source_table TEXT NOT NULL DEFAULT '',
    source_key TEXT NOT NULL DEFAULT '',
    parent_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    lang TEXT NOT NULL DEFAULT '',
    snapshot JSONB NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    deleted_by_id TEXT NOT NULL DEFAULT '',
    deleted_by_role TEXT NOT NULL DEFAULT '',
    deleted_by_email TEXT NOT NULL DEFAULT '',
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    restored_at TIMESTAMPTZ,
    restored_by_id TEXT NOT NULL DEFAULT '',
    legacy_id TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS archive_records_type_idx ON archive_records (entity_type, deleted_at DESC);
CREATE INDEX IF NOT EXISTS archive_records_entity_idx ON archive_records (entity_id);
CREATE INDEX IF NOT EXISTS archive_records_deleted_idx ON archive_records (deleted_at DESC);`;

async function init(pool) {
    await pool.query(SCHEMA);
    await migrateLegacyBlob(pool).catch(e => console.warn('[archive] eski arxivni ko‘chirishda xato:', e.message));
}

async function insertRecord(db, rec) {
    const actor = rec.actor || ctx.currentActor() || {};
    const id = rec.id || randomUUID();
    await db.query(
        `INSERT INTO archive_records
            (id, entity_type, entity_id, source_table, source_key, parent_id, title, subtitle, lang,
             snapshot, reason, deleted_by_id, deleted_by_role, deleted_by_email, deleted_at, legacy_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15::timestamptz, NOW()),$16)
         ON CONFLICT (id) DO NOTHING`,
        [id, rec.type, String(rec.entityId ?? ''), rec.sourceTable || '', rec.sourceKey || '', String(rec.parentId || ''),
         short(rec.title, 200), short(rec.subtitle, 200), rec.lang || '', JSON.stringify(rec.snapshot ?? {}), short(rec.reason, 500),
         String(actor.id || ''), String(actor.role || ''), String(actor.email || ''), rec.deletedAt || null, rec.legacyId || null]
    );
    return id;
}

// Snapshot-save (DELETE + qayta INSERT) qiladigan har bir jadval o'chirishdan
// oldin shu funksiyani chaqiradi: kelgan ro'yxatda yo'q qatorlar arxivlanadi.
async function archiveMissingRows(client, table, incoming, { reason = '' } = {}) {
    const def = TABLE_TYPES[table];
    if (!def) return [];
    const keep = new Set((incoming || []).map(i => i && i.id).filter(Boolean).map(String));
    const { rows: ids } = await client.query(`SELECT id FROM ${table}`);
    const removedIds = ids.map(r => r.id).filter(id => !keep.has(String(id)));
    if (!removedIds.length) return [];
    const { rows } = await client.query(`SELECT * FROM ${table} WHERE id = ANY($1)`, [removedIds]);
    for (const row of rows) await archiveRow(client, table, row, { reason });
    return removedIds;
}

async function archiveRow(client, table, row, { reason = '', extra = null } = {}) {
    const def = TABLE_TYPES[table];
    if (!def || !row) return null;
    return insertRecord(client, {
        type: def.type, entityId: row.id, sourceTable: table,
        title: def.title(row) || row.id, subtitle: def.subtitle(row), lang: def.lang(row),
        snapshot: extra ? { row, ...extra } : { row }, reason
    });
}

// HR nomzodi media fayllari (BYTEA) bilan birga arxivlanadi — fayl base64
// ko'rinishida nusxada saqlanadi va tiklashda baytlarga qaytariladi.
async function archiveCandidate(db, id) {
    const { rows } = await db.query('SELECT * FROM hr_candidates WHERE id=$1 FOR UPDATE', [id]);
    if (!rows[0]) return null;
    const { rows: media } = await db.query('SELECT * FROM hr_candidate_media WHERE candidate_id=$1', [id]).catch(() => ({ rows: [] }));
    const toB64 = b => Buffer.isBuffer(b) ? b.toString('base64')
        : (typeof b === 'string' && b.startsWith('\\x') ? Buffer.from(b.slice(2), 'hex').toString('base64') : b);
    const encoded = media.map(m => ({ ...m, bytes: toB64(m.bytes) }));
    return archiveRow(db, 'hr_candidates', rows[0], { extra: { media: encoded } });
}

// json_data massivlarida o'chgan elementlarni arxivlash.
async function archiveJsonDiff(client, key, previous, next, { reason = '' } = {}) {
    const def = JSON_TYPES[key];
    if (!def || !Array.isArray(previous) || !Array.isArray(next)) return 0;
    const nextIds = new Set(next.filter(i => i && i.id != null).map(i => String(i.id)));
    let n = 0;
    for (const item of previous) {
        if (!item || item.id == null) continue;
        if (!nextIds.has(String(item.id))) {
            await insertRecord(client, {
                type: def.type, entityId: item.id, sourceKey: key,
                title: def.title(item) || String(item.id), lang: item.lang || item.language || '',
                snapshot: { item }, reason
            });
            n++;
        }
    }
    // Hamjamiyat postlari ichidagi izohlar alohida o'chiriladi.
    if (key === 'communityPosts') {
        const nextById = new Map(next.filter(p => p && p.id != null).map(p => [String(p.id), p]));
        for (const post of previous) {
            const after = post && nextById.get(String(post.id));
            if (!after || !Array.isArray(post.comments)) continue;
            const left = new Set((after.comments || []).filter(c => c && c.id != null).map(c => String(c.id)));
            for (const c of post.comments) {
                if (c && c.id != null && !left.has(String(c.id))) {
                    await insertRecord(client, {
                        type: 'communityComment', entityId: c.id, sourceKey: key, parentId: post.id,
                        title: short(c.text || c.body || ''), snapshot: { item: c }, reason
                    });
                    n++;
                }
            }
        }
    }
    return n;
}

// Eski brauzer tomondagi "archive" JSON blobidagi yozuvlarni bir marta
// server arxiviga ko'chiradi (legacy_id bo'yicha takrorlanmaydi).
async function migrateLegacyBlob(db) {
    const blob = (await db.query("SELECT data FROM json_data WHERE key='archive'")).rows[0]?.data;
    if (!Array.isArray(blob) || !blob.length) return 0;
    let n = 0;
    for (const rec of blob) {
        if (!rec || !rec.item) continue;
        const type = ['lead', 'student', 'employee'].includes(rec.type) ? rec.type : null;
        if (!type || type === 'lead') continue; // lidlar leads jadvalida o'zi bor
        const legacyId = `blob:${rec.id || rec.item.id}:${rec.deletedAt || ''}`;
        const res = await db.query(
            `INSERT INTO archive_records (id, entity_type, entity_id, source_table, title, subtitle, lang, snapshot, reason,
                 deleted_by_email, deleted_at, legacy_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::timestamptz, NOW()),$12)
             ON CONFLICT (legacy_id) DO NOTHING`,
            [randomUUID(), type, String(rec.item.id || ''), type === 'student' ? 'students' : 'hr_employees',
             short(rec.item.name || rec.item.id, 200), short(type === 'student' ? rec.item.phone : rec.item.role, 200),
             type === 'student' ? (rec.item.subject === 'russian' ? 'russian' : 'english') : (rec.item.lang || ''),
             JSON.stringify({ legacyItem: rec.item }), 'Eski arxivdan ko‘chirildi', String(rec.deletedBy || ''),
             safeDate(rec.deletedAt), legacyId]
        );
        n += res.rowCount;
    }
    return n;
}

function safeDate(v) {
    const d = v ? new Date(v) : null;
    return d && Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

// ── O'qish ───────────────────────────────────────────────────────────────

function mapRecord(r) {
    return {
        id: r.id, kind: 'record', type: r.entity_type, typeLabel: TYPE_LABELS[r.entity_type] || r.entity_type,
        entityId: r.entity_id, title: r.title, subtitle: r.subtitle, lang: r.lang, reason: r.reason,
        deletedAt: r.deleted_at, deletedBy: r.deleted_by_name || r.deleted_by_email || r.deleted_by_id || '',
        restoredAt: r.restored_at, restoredBy: r.restored_by_name || r.restored_by_id || '',
        restorable: !r.restored_at && isRestorableType(r.entity_type)
    };
}

function isRestorableType(type) {
    return type !== 'offboarding';
}

const LEAD_PREFIX = 'lead:';

async function list(db, actor, query = {}) {
    const types = String(query.type || '').split(',').map(s => s.trim()).filter(Boolean);
    const wanted = (types.length ? types : Object.keys(TYPE_LABELS)).filter(t => canView(actor, t));
    if (!wanted.length) throw err(403, 'Arxivni ko‘rishga ruxsat yo‘q');
    const status = ['deleted', 'restored', 'all'].includes(query.status) ? query.status : 'deleted';
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
    const q = String(query.q || '').trim().toLowerCase();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(query.from || '') ? query.from : null;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(query.to || '') ? query.to : null;
    const lang = ['english', 'russian'].includes(query.lang) ? query.lang : null;

    const params = [];
    const p = v => { params.push(v); return '$' + params.length; };
    const recordTypes = wanted.filter(t => t !== 'lead');
    const parts = [];
    if (recordTypes.length) {
        const w = [`a.entity_type = ANY(${p(recordTypes)})`];
        if (status === 'deleted') w.push('a.restored_at IS NULL');
        if (status === 'restored') w.push('a.restored_at IS NOT NULL');
        if (q) w.push(`(LOWER(a.title) LIKE ${p('%' + q + '%')} OR LOWER(a.subtitle) LIKE $${params.length} OR a.entity_id = ${p(q)})`);
        if (from) w.push(`a.deleted_at >= (${p(from)}::date AT TIME ZONE 'Asia/Tashkent')`);
        if (to) w.push(`a.deleted_at < ((${p(to)}::date + 1) AT TIME ZONE 'Asia/Tashkent')`);
        if (lang) w.push(`a.lang IN (${p(lang)}, '')`);
        parts.push(`SELECT a.id, a.entity_type, a.entity_id, a.title, a.subtitle, a.lang, a.reason, a.deleted_at,
                a.deleted_by_id, a.deleted_by_email, du.name AS deleted_by_name, a.restored_at, a.restored_by_id, ru.name AS restored_by_name
            FROM archive_records a
            LEFT JOIN users du ON du.id = a.deleted_by_id
            LEFT JOIN users ru ON ru.id = a.restored_by_id
            WHERE ${w.join(' AND ')}`);
    }
    if (wanted.includes('lead') && status !== 'restored') {
        const w = ['l.deleted_at IS NOT NULL'];
        if (q) w.push(`(LOWER(l.name) LIKE ${p('%' + q + '%')} OR l.phone LIKE $${params.length} OR l.id = ${p(q)})`);
        if (from) w.push(`l.deleted_at >= (${p(from)}::date AT TIME ZONE 'Asia/Tashkent')`);
        if (to) w.push(`l.deleted_at < ((${p(to)}::date + 1) AT TIME ZONE 'Asia/Tashkent')`);
        if (lang) w.push(`l.language = ${p(lang)}`);
        parts.push(`SELECT '${LEAD_PREFIX}' || l.id AS id, 'lead' AS entity_type, l.id AS entity_id, l.name AS title,
                CONCAT_WS(' · ', NULLIF(l.phone,''), NULLIF(l.status,'')) AS subtitle, l.language AS lang, '' AS reason,
                l.deleted_at, '' AS deleted_by_id, '' AS deleted_by_email, NULLIF(l.deleted_by,'') AS deleted_by_name,
                NULL::timestamptz AS restored_at, '' AS restored_by_id, NULL AS restored_by_name
            FROM leads l WHERE ${w.join(' AND ')}`);
    }
    if (!parts.length) return { items: [], total: 0, counts: {} };
    const union = parts.join(' UNION ALL ');
    const [{ rows }, { rows: totalRows }, counts] = await Promise.all([
        db.query(`SELECT * FROM (${union}) x ORDER BY deleted_at DESC NULLS LAST, id LIMIT ${limit} OFFSET ${offset}`, params),
        db.query(`SELECT COUNT(*)::int AS n FROM (${union}) x`, params),
        countsByType(db, actor)
    ]);
    return { items: rows.map(mapRecord), total: totalRows[0].n, counts, limit, offset };
}

async function countsByType(db, actor) {
    const out = {};
    const { rows } = await db.query(`SELECT entity_type, COUNT(*)::int AS n FROM archive_records WHERE restored_at IS NULL GROUP BY entity_type`);
    for (const r of rows) if (canView(actor, r.entity_type)) out[r.entity_type] = r.n;
    if (canView(actor, 'lead')) {
        const { rows: l } = await db.query('SELECT COUNT(*)::int AS n FROM leads WHERE deleted_at IS NOT NULL');
        out.lead = l[0].n;
    }
    return out;
}

async function get(db, actor, id) {
    if (String(id).startsWith(LEAD_PREFIX)) {
        if (!canView(actor, 'lead')) throw err(403, 'Ruxsat yo‘q');
        const { rows } = await db.query('SELECT * FROM leads WHERE id=$1', [String(id).slice(LEAD_PREFIX.length)]);
        if (!rows[0]) throw err(404, 'Yozuv topilmadi');
        return { id, type: 'lead', typeLabel: 'Lid', snapshot: { row: rows[0] } };
    }
    const { rows } = await db.query(
        `SELECT a.*, du.name AS deleted_by_name, ru.name AS restored_by_name FROM archive_records a
         LEFT JOIN users du ON du.id=a.deleted_by_id LEFT JOIN users ru ON ru.id=a.restored_by_id WHERE a.id=$1`, [id]);
    const r = rows[0];
    if (!r) throw err(404, 'Yozuv topilmadi');
    if (!canView(actor, r.entity_type)) throw err(403, 'Ruxsat yo‘q');
    return { ...mapRecord(r), snapshot: redact(r.entity_type, r.snapshot) };
}

// Parol xeshlari hech kimga ko'rsatilmaydi (tiklash uchun bazada qoladi).
function redact(type, snapshot) {
    const s = JSON.parse(JSON.stringify(snapshot || {}));
    const strip = o => { if (o && typeof o === 'object') { delete o.password_hash; delete o.passwordHash; delete o.password; } };
    strip(s.row); strip(s.item); strip(s.legacyItem);
    if (s.row && s.row.extra_data) strip(s.row.extra_data);
    return s;
}

// ── Tiklash ───────────────────────────────────────────────────────────────

const columnCache = new Map();
async function tableColumns(db, table) {
    if (columnCache.has(table)) return columnCache.get(table);
    const { rows } = await db.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 AND table_schema = current_schema()`, [table]);
    const map = new Map(rows.map(r => [r.column_name, r.data_type]));
    if (map.size) columnCache.set(table, map);
    return map;
}

async function insertRawRow(db, table, row) {
    const cols = await tableColumns(db, table);
    const keys = Object.keys(row).filter(k => cols.has(k));
    if (!keys.includes('id')) throw err(400, 'Nusxada ID yo‘q, tiklab bo‘lmaydi');
    const values = keys.map(k => {
        const v = row[k];
        if ((cols.get(k) === 'jsonb' || cols.get(k) === 'json') && v !== null && v !== undefined) return JSON.stringify(v);
        if (cols.get(k) === 'bytea' && typeof v === 'string') return Buffer.from(v, 'base64');
        return v;
    });
    const res = await db.query(
        `INSERT INTO ${table} (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')})
         ON CONFLICT (id) DO NOTHING`, values);
    if (!res.rowCount) throw err(409, 'Bu ID bilan yozuv allaqachon bor — u avval tiklangan yoki qayta yaratilgan', 'ALREADY_EXISTS');
}

// Eski blob formatidagi (brauzer obyekti) yozuvni jadval qatoriga aylantirish.
function legacyToRow(type, item) {
    if (type === 'student') {
        const { id, name, phone, group, subject, teacherId, assistantTeacherId, lessonDayOfWeek, lessonTime, lessonDuration, password, hasPassword, ...extra } = item;
        return {
            id, name: name || '', phone: phone || '', group_name: group || '', subject: subject || 'english',
            teacher_id: teacherId || null, assistant_teacher_id: assistantTeacherId || null,
            lesson_day_of_week: lessonDayOfWeek ?? null, lesson_time: lessonTime || '', lesson_duration: lessonDuration || 15,
            extra_data: extra
        };
    }
    if (type === 'employee') {
        const e = item;
        return {
            id: e.id, name: e.name, first_name: e.firstName || '', last_name: e.lastName || '', role: e.role || 'employee',
            login: e.login || '', phone: e.phone || '', email: e.email || '', department: e.department || '',
            status: e.status || 'active', join_date: e.joinDate || '', gender: e.gender || '', birth_date: e.birthDate || '',
            start_date: e.startDate || '', card_number: e.cardNumber || '', passport_series: e.passportSeries || '',
            pinfl: e.pinfl || '', address: e.address || '', lang: e.lang || 'english', trial_group_link: e.trialGroupLink || '',
            kpi_template_id: e.kpiTemplateId || '', dual_role: e.dualRole === true
        };
    }
    throw err(400, 'Bu eski yozuvni tiklab bo‘lmaydi');
}

async function restoreJsonItem(db, key, item, parentId) {
    const current = (await db.query('SELECT data FROM json_data WHERE key=$1 FOR UPDATE', [key])).rows[0]?.data;
    const list = Array.isArray(current) ? current : [];
    if (parentId) {
        const post = list.find(p => p && String(p.id) === String(parentId));
        if (!post) throw err(409, 'Izoh tegishli bo‘lgan post o‘chirilgan — avval postni tiklang', 'PARENT_MISSING');
        post.comments = Array.isArray(post.comments) ? post.comments : [];
        if (post.comments.some(c => c && String(c.id) === String(item.id))) throw err(409, 'Bu izoh allaqachon joyida', 'ALREADY_EXISTS');
        post.comments.push(item);
    } else {
        if (list.some(i => i && String(i.id) === String(item.id))) throw err(409, 'Bu yozuv allaqachon joyida', 'ALREADY_EXISTS');
        list.push(item);
    }
    await db.query(`INSERT INTO json_data(key,data) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data`, [key, JSON.stringify(list)]);
}

// db — tranzaksiya ichidagi client. restoreLead — db.js'dagi mavjud funksiya.
async function restore(db, actor, id, { restoreLead } = {}) {
    if (String(id).startsWith(LEAD_PREFIX)) {
        if (!canView(actor, 'lead') || !['admin', 'boshliq', 'rop'].includes(actor?.role)) throw err(403, 'Lidni tiklashga ruxsat yo‘q');
        const leadId = String(id).slice(LEAD_PREFIX.length);
        const restored = restoreLead ? await restoreLead(leadId, actor) : null;
        if (!restored) throw err(404, 'Lid topilmadi');
        return { type: 'lead', entityId: leadId };
    }
    const { rows } = await db.query('SELECT * FROM archive_records WHERE id=$1 FOR UPDATE', [id]);
    const r = rows[0];
    if (!r) throw err(404, 'Arxiv yozuvi topilmadi');
    if (!canView(actor, r.entity_type)) throw err(403, 'Bu yozuvni tiklashga ruxsat yo‘q');
    if (r.restored_at) throw err(409, 'Bu yozuv allaqachon tiklangan', 'ALREADY_RESTORED');
    if (!isRestorableType(r.entity_type)) throw err(400, 'Bu yozuv turi tiklanmaydi');
    const snap = r.snapshot || {};
    if (r.source_table) {
        const row = snap.row || (snap.legacyItem ? legacyToRow(r.entity_type, snap.legacyItem) : null);
        if (!row) throw err(400, 'Nusxa bo‘sh, tiklab bo‘lmaydi');
        await insertRawRow(db, r.source_table, row);
        if (r.source_table === 'hr_candidates' && Array.isArray(snap.media)) {
            for (const m of snap.media) await insertRawRow(db, 'hr_candidate_media', m).catch(() => {});
        }
    } else if (r.source_key) {
        if (!snap.item) throw err(400, 'Nusxa bo‘sh, tiklab bo‘lmaydi');
        if (r.source_key === 'cashFlow' && snap.item.inflowRecordId) throw err(400, 'Bu yozuv To‘lovlar reyestridan avtomatik yaratiladi');
        await restoreJsonItem(db, r.source_key, snap.item, r.entity_type === 'communityComment' ? r.parent_id : null);
    } else {
        throw err(400, 'Bu yozuvni tiklash yo‘li noma’lum');
    }
    await db.query('UPDATE archive_records SET restored_at=NOW(), restored_by_id=$2 WHERE id=$1', [id, String(actor?.id || '')]);
    return { type: r.entity_type, entityId: r.entity_id };
}

module.exports = {
    init, SCHEMA, TABLE_TYPES, JSON_TYPES, TYPE_LABELS,
    insertRecord, archiveMissingRows, archiveRow, archiveCandidate, archiveJsonDiff, migrateLegacyBlob,
    list, get, restore, canView, legacyToRow, redact
};
