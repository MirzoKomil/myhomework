'use strict';
// Target lidlar monitoringi — har ikkala til yo'nalishi uchun yagona,
// server tomonida saqlanadigan kunlik reklama ma'lumoti va oylik reja.
//
// * Kunlik qator (kind='day'): targetolog o'z kabinetidan qo'lda kiritadi —
//   reklama sarfi ($), reklama kabinetidagi lid soni, o'zi sanagan sifatli
//   lid soni. CRM'ning o'zi hisoblagan raqamlar bu yerda SAQLANMAYDI —
//   ular har doim lidlardan jonli hisoblanadi va hech kim o'zgartira olmaydi.
// * Oylik reja (kind='plan'): faqat admin/boshliq kiritadi.
// * Har bir o'zgarish target_ad_history'ga (oldin/keyin, kim, qachon) yoziladi.
//
// Ruxsat: admin/boshliq — ikkala til, o'qish+yozish. ROP — o'z tili, faqat
// o'qish. Targetolog — HR'da berilgan til(lar) bo'yicha o'qish va kunlik
// ma'lumotni kiritish (bugun va oxirgi 7 kun ichida).

const crypto = require('crypto');

const LANGS = ['english', 'russian'];
const TARGETOLOG_EDIT_WINDOW_DAYS = 7;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS target_ad_entries (
    language TEXT NOT NULL CHECK (language IN ('english','russian')),
    kind TEXT NOT NULL CHECK (kind IN ('day','plan')),
    date TEXT NOT NULL,
    data JSONB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (language, kind, date)
);
CREATE TABLE IF NOT EXISTS target_ad_history (
    id TEXT PRIMARY KEY,
    language TEXT NOT NULL,
    kind TEXT NOT NULL,
    date TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    before_data JSONB,
    after_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;

function error(status, message) { return Object.assign(new Error(message), { status }); }

function tashkentToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function validDay(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key))) return false;
    const d = new Date(key + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === key;
}
const validMonth = m => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }

// HR yozuvidagi "lang" maydoni: 'english' | 'russian' | 'both'
function langsFromHr(lang) {
    if (lang === 'both') return [...LANGS];
    return LANGS.includes(lang) ? [lang] : ['english'];
}

// Foydalanuvchi qaysi til yo'nalishlarini ko'ra oladi va qaysilariga yoza oladi.
async function accessFor(db, actor) {
    const row = (await db.query(`SELECT u.id, u.role, h.lang, h.status FROM users u
        LEFT JOIN hr_employees h ON LOWER(TRIM(h.login)) = LOWER(TRIM(u.email)) WHERE u.id = $1`, [actor.id])).rows;
    if (row.length !== 1) throw error(403, 'Akkaunt topilmadi');
    const { role, lang, status } = row[0];
    if (['admin', 'boshliq'].includes(role)) return { role, read: [...LANGS], writeDay: [...LANGS], writePlan: true, editAnyDay: true };
    if (status === 'inactive') throw error(403, 'Xodim faol emas');
    if (role === 'targetolog') { const l = langsFromHr(lang); return { role, read: l, writeDay: l, writePlan: false, editAnyDay: false }; }
    if (role === 'rop') return { role, read: langsFromHr(lang === 'both' ? 'english' : lang), writeDay: [], writePlan: false, editAnyDay: false };
    throw error(403, 'Target monitoringiga ruxsat yo‘q');
}

// Targetolog uchun sotuv lidlari ham faqat ruxsat etilgan tillar bo'yicha.
async function targetologLangs(db, user) {
    if (user?.role !== 'targetolog') return null;
    const row = (await db.query('SELECT lang FROM hr_employees WHERE LOWER(TRIM(login)) = LOWER(TRIM($1)) LIMIT 1', [user.email || ''])).rows[0];
    return langsFromHr(row?.lang);
}

function num(value, { integer = false, max = 1e9, allowNull = false } = {}) {
    if (value === null || value === undefined || value === '') {
        if (allowNull) return null;
        throw error(400, 'Barcha maydonlarni to‘ldiring (nol bo‘lsa 0 yozing)');
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value)))
        throw error(400, 'Summa va sonlar manfiy bo‘lmagan raqam bo‘lishi kerak');
    return integer ? value : Math.round(value * 100) / 100;
}

function cleanData(kind, data) {
    if (kind === 'day') {
        const leadCount = num(data?.leadCount, { integer: true, max: 100000 });
        const kvalLeadCount = num(data?.kvalLeadCount, { integer: true, max: 100000, allowNull: true });
        if (kvalLeadCount != null && kvalLeadCount > leadCount) throw error(400, 'Sifatli lidlar soni jami lid sonidan oshmasligi kerak');
        const note = String(data?.note || '').trim().slice(0, 300);
        return { budget: num(data?.budget, { max: 1e7 }), leadCount, kvalLeadCount, note };
    }
    const lidSoni = num(data?.lidSoni, { integer: true, max: 1e6 });
    const kvalLidSoni = num(data?.kvalLidSoni, { integer: true, max: 1e6 });
    if (kvalLidSoni > lidSoni && lidSoni > 0) throw error(400, 'Sifatli lid rejasi jami lid rejasidan oshmasligi kerak');
    return { budget: num(data?.budget, { max: 1e8 }), fixed: num(data?.fixed, { max: 1e8, allowNull: true }) ?? 0, lidSoni, kvalLidSoni };
}

// Eski joylardan (domwork_ad_entries — rus tili; json_data — ikkala til)
// bir martalik ko'chirish. ON CONFLICT DO NOTHING: yangi jadvaldagi qiymat
// hech qachon eski bilan ustidan yozilmaydi.
async function migrateLegacy(db) {
    const exists = (await db.query("SELECT to_regclass('domwork_ad_entries') AS t")).rows[0]?.t;
    if (exists) {
        await db.query(`INSERT INTO target_ad_entries(language,kind,date,data,revision,updated_by,updated_at)
            SELECT 'russian', kind, date,
                CASE WHEN kind='plan' THEN jsonb_build_object('budget',COALESCE((data->>'budget')::numeric,0),'fixed',0,
                    'lidSoni',COALESCE((data->>'lidSoni')::int,0),'kvalLidSoni',COALESCE((data->>'kvalLidSoni')::int,0))
                ELSE jsonb_build_object('budget',COALESCE((data->>'budget')::numeric,0),'leadCount',COALESCE((data->>'leadCount')::int,0),'kvalLeadCount',NULL,'note','') END,
                revision, updated_by, updated_at
            FROM domwork_ad_entries ON CONFLICT DO NOTHING`);
    }
    const raw = Object.fromEntries((await db.query("SELECT key,data FROM json_data WHERE key IN ('targetDailyAdSpend','targetMonitoringPlan')")).rows.map(r => [r.key, r.data]));
    // Ikki xil eski format bor: {russian:{oy:{...}}} yoki to'g'ridan-to'g'ri {oy:{...}} (ingliz tili).
    const byLang = obj => {
        const out = { english: {}, russian: {} };
        for (const [k, v] of Object.entries(obj || {})) {
            if (LANGS.includes(k)) Object.assign(out[k], v || {});
            else if (validMonth(k)) out.english[k] = v;
        }
        return out;
    };
    const days = byLang(raw.targetDailyAdSpend), plans = byLang(raw.targetMonitoringPlan);
    for (const language of LANGS) {
        for (const [month, entries] of Object.entries(days[language])) {
            if (!validMonth(month)) continue;
            for (const [key, v] of Object.entries(entries || {})) {
                const date = validDay(key) ? key : month + '-' + String(key).padStart(2, '0');
                if (!validDay(date) || typeof v?.budget !== 'number' || !Number.isFinite(v.budget) || v.budget < 0) continue;
                const data = { budget: v.budget, leadCount: Number.isInteger(v.leadCount) && v.leadCount >= 0 ? v.leadCount : 0, kvalLeadCount: null, note: '' };
                await db.query(`INSERT INTO target_ad_entries(language,kind,date,data,updated_by) VALUES($1,'day',$2,$3,'legacy') ON CONFLICT DO NOTHING`, [language, date, JSON.stringify(data)]);
            }
        }
        for (const [month, p] of Object.entries(plans[language])) {
            if (!validMonth(month) || !p) continue;
            const data = { budget: Number(p.budget) || 0, fixed: 0, lidSoni: Number.parseInt(p.lidSoni, 10) || 0, kvalLidSoni: Number.parseInt(p.kvalLidSoni, 10) || 0 };
            await db.query(`INSERT INTO target_ad_entries(language,kind,date,data,updated_by) VALUES($1,'plan',$2,$3,'legacy') ON CONFLICT DO NOTHING`, [language, month, JSON.stringify(data)]);
        }
    }
}

async function init(pool) {
    await pool.query(SCHEMA);
    try { await migrateLegacy(pool); } catch (e) { console.error('[targetAds] legacy migration:', e.message); }
}

async function month(db, actor, { language, month: monthKey }) {
    const access = await accessFor(db, actor);
    if (!LANGS.includes(language)) throw error(400, 'Til yo‘nalishini tanlang');
    if (!access.read.includes(language)) throw error(403, 'Bu til yo‘nalishiga ruxsat yo‘q');
    if (!validMonth(monthKey)) throw error(400, 'Oy noto‘g‘ri');
    const rows = (await db.query(`SELECT e.kind, e.date, e.data, e.revision, e.updated_at, COALESCE(u.name, e.updated_by) AS updated_by_name
        FROM target_ad_entries e LEFT JOIN users u ON u.id = e.updated_by
        WHERE e.language = $1 AND (e.date = $2 OR LEFT(e.date, 7) = $2) ORDER BY e.date`, [language, monthKey])).rows;
    const meta = r => ({ revision: r.revision, updatedAt: r.updated_at, updatedBy: r.updated_by_name });
    const plan = rows.find(r => r.kind === 'plan');
    const today = tashkentToday();
    return {
        language, month: monthKey, today,
        days: Object.fromEntries(rows.filter(r => r.kind === 'day').map(r => [r.date, { ...r.data, ...meta(r) }])),
        plan: plan ? { ...plan.data, ...meta(plan) } : null,
        permissions: {
            canEditDays: access.writeDay.includes(language),
            canEditPlan: access.writePlan,
            editFrom: access.editAnyDay ? null : new Date(Date.parse(today + 'T00:00:00Z') - TARGETOLOG_EDIT_WINDOW_DAYS * 86400000).toISOString().slice(0, 10),
            editTo: today,
            langs: access.read
        }
    };
}

async function save(db, actor, body) {
    const access = await accessFor(db, actor);
    const { language, kind, date, revision } = body || {};
    if (!LANGS.includes(language)) throw error(400, 'Til yo‘nalishini tanlang');
    if (kind === 'plan') {
        if (!access.writePlan) throw error(403, 'Oylik rejani faqat admin kiritadi');
        if (!validMonth(date)) throw error(400, 'Oy noto‘g‘ri');
    } else if (kind === 'day') {
        if (!access.writeDay.includes(language)) throw error(403, 'Bu til yo‘nalishiga ma’lumot kiritish huquqi yo‘q');
        if (!validDay(date)) throw error(400, 'Sana noto‘g‘ri');
        const today = tashkentToday();
        if (date > today) throw error(400, 'Kelajak sanaga ma’lumot kiritib bo‘lmaydi');
        if (!access.editAnyDay && daysBetween(date, today) > TARGETOLOG_EDIT_WINDOW_DAYS)
            throw error(403, `Targetolog faqat oxirgi ${TARGETOLOG_EDIT_WINDOW_DAYS} kun ma’lumotini kirita oladi. Eski sanani admin tuzatadi`);
    } else throw error(400, 'Noto‘g‘ri tur');
    if (!Number.isInteger(revision) || revision < 0) throw error(400, 'Versiya talab qilinadi');
    const data = cleanData(kind, body.data);
    await db.query("SELECT pg_advisory_xact_lock(hashtext('target-ad:' || $1::text))", [language + ':' + kind + ':' + date]);
    const before = (await db.query('SELECT * FROM target_ad_entries WHERE language=$1 AND kind=$2 AND date=$3 FOR UPDATE', [language, kind, date])).rows[0];
    if ((before?.revision || 0) !== revision) throw error(409, 'Bu ma’lumotni boshqa foydalanuvchi o‘zgartirgan — oynani yangilang');
    await db.query(`INSERT INTO target_ad_entries(language,kind,date,data,updated_by) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(language,kind,date) DO UPDATE SET data=EXCLUDED.data, revision=target_ad_entries.revision+1, updated_by=EXCLUDED.updated_by, updated_at=NOW()`,
        [language, kind, date, JSON.stringify(data), actor.id]);
    await db.query('INSERT INTO target_ad_history(id,language,kind,date,actor_id,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [crypto.randomUUID(), language, kind, date, actor.id, before ? JSON.stringify(before.data) : null, JSON.stringify(data)]);
    return { ok: true };
}

// Domwork bot hisobotlari uchun (rus tili): davr bo'yicha reklama sarfi va reja.
async function advertising(db, language, start, end) {
    const rows = (await db.query(`SELECT kind,date,data FROM target_ad_entries WHERE language=$1
        AND ((kind='day' AND date BETWEEN $2 AND $3) OR (kind='plan' AND date=$4))`, [language, start, end, start.slice(0, 7)])).rows;
    const days = Object.fromEntries(rows.filter(r => r.kind === 'day').map(r => [r.date, r.data]));
    const plan = rows.find(r => r.kind === 'plan')?.data || null;
    return { days, total: Object.values(days).reduce((s, v) => s + (Number(v.budget) || 0), 0), known: Object.keys(days).length > 0,
        plan: plan ? { ...plan, kvalLidPct: plan.lidSoni ? Math.round(plan.kvalLidSoni / plan.lidSoni * 1000) / 10 : null } : null };
}

module.exports = { SCHEMA, init, month, save, advertising, accessFor, targetologLangs, langsFromHr, cleanData, TARGETOLOG_EDIT_WINDOW_DAYS };
