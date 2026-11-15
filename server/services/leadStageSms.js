'use strict';
// Lid bosqichi o'zgarganda avtomatik SMS — SERVER tomonida (15-noy).
// Ilgari brauzerda (js/app.js maybeSendAutoStageSms) yuborilardi: xodim sahifani yopsa yoki
// telefon ilovasidan o'zgartirsa SMS ketmay qolardi. Endi PATCH /api/leads/:id saqlagandan
// keyin shu yerda yuboriladi. Faqat rus tili (Domwork) lidlari, faqat O'zbekiston raqamlari.
const eskiz = require('./eskiz');
const T = require('./smsTexts');
const { normalizeLeadStatus } = require('./leadStages');

// Bir lidga bir bosqich SMS'i 12 soat ichida qayta ketmaydi (oldinga-orqaga surilsa ham).
const RECENT = new Map();
const RECENT_MS = 12 * 3600000;
function seen(key) {
    const now = Date.now();
    for (const [k, at] of RECENT) if (now - at > RECENT_MS) RECENT.delete(k);
    if (RECENT.has(key)) return true;
    RECENT.set(key, now);
    return false;
}

// Lidning SMS uchun raqami: phone, bo'lmasa phone2 — birinchi O'zbekiston raqami.
function uzPhoneOf(lead) {
    for (const raw of [lead?.phone, lead?.phone2, ...(Array.isArray(lead?.phones) ? lead.phones : [])]) {
        const d = eskiz.normalizePhone(raw);
        if (eskiz.isValidUzPhone(d)) return d;
    }
    return '';
}

// Eskiz xatosi turini aniqlash (ogohlantirish uchun)
function errorKind(message) {
    const m = String(message || '');
    if (/fill the balance|balans/i.test(m)) return 'balance';
    if (/модерац|moderat/i.test(m)) return 'moderation';
    if (/ESKIZ_EMAIL|login xatosi|Unauthorized|Token/i.test(m)) return 'auth';
    return '';
}

// Admin'ga Telegram ogohlantirishi — har tur uchun 6 soatda bir marta (bot ulangan bo'lsa).
async function alertAdmin(kind, detail) {
    if (!kind) return;
    try {
        const { pool } = require('../db');
        const scheduler = require('./domworkBot/scheduler');
        const events = require('./domworkBot/events');
        const bucket = Math.floor(Date.now() / (6 * 3600000));
        const key = `sms-alert:${kind}:${bucket}`;
        const head = {
            balance: '⚠️ <b>Eskiz SMS balansi tugagan</b> — mijozlarga SMS ketmayapti. my.eskiz.uz → SMS da balansni to\'ldiring.',
            moderation: '⚠️ <b>SMS matni Eskiz moderatsiyasidan o\'tmagan</b> — shu matn ketmayapti. my.eskiz.uz → SMS → Mening matnlarim ga qo\'shish kerak.',
            auth: '⚠️ <b>Eskiz SMS ulanishi ishlamayapti</b> (login/parol). Railway\'dagi ESKIZ_EMAIL / ESKIZ_PASSWORD ni tekshiring.',
        }[kind];
        await scheduler.once(pool, key, async () => {
            const people = await scheduler.roles(pool, ['admin']);
            const text = head + (detail ? `\n\n<i>${String(detail).replace(/[<>&]/g, '').slice(0, 300)}</i>` : '');
            const sent = new Set();
            for (const p of people) {
                if (sent.has(p.telegramId)) continue;
                sent.add(p.telegramId);
                await events.privateMessage(pool, key + ':' + p.telegramId, p, text, { parse_mode: 'HTML', _expiresAt: new Date(Date.now() + 24 * 3600000).toISOString() });
            }
        });
    } catch (err) {
        console.warn('[sms-alert] yuborilmadi:', err.message);
    }
}

// Bitta avtomatik SMS: yuboradi, tarixga yozadi, xato bo'lsa adminni ogohlantiradi.
async function sendAuto(lead, text, audience) {
    const { addSmsHistoryEntries } = require('../db');
    const phone = uzPhoneOf(lead);
    if (!phone || !text) return null; // xorijiy/yo'q raqam — jim o'tkaziladi
    const base = { phone, name: lead.name || '', message: text, recipientId: lead.id, recipientType: lead.recipientType || 'lead', audience, sentBy: 'system' };
    let entry;
    try {
        const resp = await eskiz.sendSms(phone, text);
        entry = { ...base, status: 'sent', eskizId: resp?.id || null };
    } catch (err) {
        entry = { ...base, status: 'error', error: err.message || 'Nomalum xatolik' };
        alertAdmin(errorKind(err.message), `${audience}: ${err.message}`);
    }
    try { await addSmsHistoryEntries([entry]); } catch (e) { console.warn('[stage-sms] tarixga yozilmadi:', e.message); }
    return entry;
}

// Lidning sotuv menejeri: ismi va HR kartasidagi telefoni (SMS'dagi "Menejer: ..." qismi uchun).
async function managerContact(managerId) {
    if (!managerId) return {};
    try {
        const { pool } = require('../db');
        const r = (await pool.query('SELECT sm.name AS name, he.phone AS phone, he.first_name AS first_name FROM sales_managers sm LEFT JOIN hr_employees he ON he.id = sm.id WHERE sm.id = $1', [String(managerId)])).rows[0];
        return r ? { managerName: r.first_name || r.name || '', managerPhone: r.phone || '' } : {};
    } catch { return {}; }
}

async function trialLinkFor(lead) {
    const teacherId = lead?.paymentOnboarding?.teacherId || lead?.trialTeacherId || '';
    if (!teacherId) return '';
    try {
        const map = await require('../db').getTeacherTrialLinksMap();
        return map.get(teacherId) || '';
    } catch { return ''; }
}

// Saqlashdan keyin yuboriladigan matnlar ro'yxati: [kalit, matn, takrorlanmaslik kaliti]
// prev — saqlashdan OLDINGI holat: { status, trialLessonAt, teacherId }
async function buildMessages(prev, lead, platformAccess, contact = {}) {
    const name = lead.name;
    const R = (key, vars = {}) => T.render(key, { ...contact, name, ...vars });
    const from = normalizeLeadStatus(prev?.status), to = normalizeLeadStatus(lead.status);
    const statusChanged = !!prev?.status && from !== to;
    const out = [];
    if (statusChanged && (to === 'boglanishga-urinilmoqda' || to === 'boglanildi' || to === 'qaror-jarayonida')) {
        out.push([to, R(to), to]);
    }
    // Sinov darsi: bosqichga kirganda YOKI vaqt/ustoz o'zgarganda (ustozsiz qo'yilib, keyin admin
    // ustoz biriktirganda ham) — ustoz havolasi va vaqt bo'lsagina.
    if (to === 'sinov-darsida' && lead.trialLessonAt) {
        const teacherId = lead.paymentOnboarding?.teacherId || '';
        const changed = statusChanged || prev?.trialLessonAt !== lead.trialLessonAt || (prev?.teacherId || '') !== teacherId;
        if (changed && teacherId && new Date(lead.trialLessonAt).getTime() > Date.now()) {
            const link = await trialLinkFor(lead);
            if (link) out.push(['sinov-qoyildi', R('sinov-qoyildi', { link, date: T.uzDate(lead.trialLessonAt), time: T.uzTime(lead.trialLessonAt) }), 'sinov|' + lead.trialLessonAt]);
        }
    }
    if (statusChanged && to === 'tolov-jarayonida') {
        const ps = lead.paymentSurvey || {};
        if (ps.paymentType === 'partial' && ps.nextPaymentDate) out.push(['tolov-qisman', R('tolov-qisman', { date: T.uzDate(ps.nextPaymentDate) }), 'tolov']);
        else out.push(['tolov-toliq', R('tolov-toliq'), 'tolov']);
    } else if (statusChanged && to === 'tolov-yopildi') {
        out.push(['tolov-yopildi', R('tolov-yopildi'), 'tolov-yopildi']);
    }
    // O'quvchi akkaunti AYNAN shu saqlashda yaratilgan bo'lsa — login SMS
    if ((to === 'tolov-jarayonida' || to === 'tolov-yopildi') && platformAccess?.credentialsCreated && platformAccess.student?.login) {
        const login = String(platformAccess.student.login);
        out.push(['ilova-login', R('ilova-login', { login, password: login.replace(/\D/g, '').slice(-4) }), 'login']);
    }
    return out.filter(([, text]) => text);
}

function prevOf(leadLike) {
    if (!leadLike) return null;
    return { status: leadLike.status, trialLessonAt: leadLike.trialLessonAt || null, teacherId: leadLike.paymentOnboarding?.teacherId || '' };
}

// Lid saqlangandan keyin chaqiriladi (javob qaytgandan keyin — kutilmaydi).
// prevLead — saqlashdan oldingi lid (getLeadById natijasi), lead — saqlangan lid.
async function onLeadSaved(prevLead, lead, platformAccess, opts = {}) {
    try {
        if (!lead || !prevLead || opts.skip) return;
        if (lead.language !== 'russian') return;
        if (!uzPhoneOf(lead)) return;
        const contact = await managerContact(lead.managerId);
        for (const [key, text, dedupe] of await buildMessages(prevOf(prevLead), lead, platformAccess, contact)) {
            if (seen(`${lead.id}|${dedupe}`)) continue;
            await sendAuto(lead, text, 'auto-' + key);
        }
    } catch (err) {
        console.error('[stage-sms] xatolik:', err.message);
    }
}

// Ustoz sinov natijasini yozganda (trialLessons.updateTrialLesson) — "keldi" yoki "kelmadi" SMS'i.
async function onTrialResult(lead, attended) {
    try {
        if (!lead || lead.language !== 'russian' || !uzPhoneOf(lead)) return;
        const key = attended ? 'sinov-otdi' : 'sinov-kelmadi';
        if (seen(`${lead.id}|${key}|${lead.trialLessonAt || ''}`)) return;
        const contact = await managerContact(lead.managerId);
        await sendAuto(lead, T.render(key, { ...contact, name: lead.name }), 'auto-' + key);
    } catch (err) { console.error('[stage-sms] sinov natijasi:', err.message); }
}

// ── Kunlik SMS'lar (Toshkent 09:00–20:00 oralig'ida, har biri bir marta) ──
//  • "Keyin sotib olmoqchi": lid aytgan aloqa sanasi (contactDate, bo'lmasa purchaseDate) kuni
//  • Qarzdor: to'lov sanasidan 1 kun oldin va sana o'tgan kunning ertasiga
function tkDate(offsetDays = 0) {
    return new Date(Date.now() + 5 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
}
const STUDENT_INACTIVE = new Set(['inactive', 'tark-etdi', "to'xtatilgan", 'bekor', 'left', 'archived', 'deleted']);
async function runDaily() {
    const hour = new Date(Date.now() + 5 * 3600000).getUTCHours();
    if (hour < 9 || hour >= 20) return;
    const db = require('../db');
    const pool = db.pool;
    const { once } = require('./domworkBot/scheduler');
    const today = tkDate(0), tomorrow = tkDate(1), yesterday = tkDate(-1);
    const leads = (await pool.query(`SELECT * FROM leads WHERE deleted_at IS NULL AND language = 'russian' AND status = 'keyin-sotib-olmoqchi'`)).rows;
    for (const row of leads) {
        const lead = db.rowToLead(row);
        const survey = lead.deferredPurchaseSurvey || {};
        const day = String(survey.contactDate || survey.purchaseDate || '').slice(0, 10);
        if (day !== today || !uzPhoneOf(lead)) continue;
        await once(pool, `sms:keyin:${lead.id}:${day}`, async () => {
            const contact = await managerContact(lead.managerId);
            await sendAuto(lead, T.render('keyin-sotib-olmoqchi', { ...contact, name: lead.name }), 'auto-keyin-sotib-olmoqchi');
        });
    }
    const students = (await pool.query(`SELECT id, name, phone, extra_data FROM students WHERE subject = 'russian'`)).rows;
    for (const r of students) {
        let x = r.extra_data;
        if (typeof x === 'string') { try { x = JSON.parse(x); } catch { x = {}; } }
        x = x || {};
        if (!(Number(x.debtAmount) > 0) || x.frozen === true || x.legacyFrozen === true || x.legacyInactive === true || x.isStaffDemo === true) continue;
        if (STUDENT_INACTIVE.has(String(x.status || '').toLowerCase())) continue;
        const due = String(x.paymentDueDate || '').slice(0, 10);
        const kind = due === tomorrow ? 'qarz-eslatma' : due === yesterday ? 'qarz-otdi' : '';
        if (!kind) continue;
        const person = { id: r.id, name: r.name, phone: r.phone, phone2: x.phone2, recipientType: 'student' };
        if (!uzPhoneOf(person)) continue;
        await once(pool, `sms:${kind}:${r.id}:${due}`, async () => {
            let managerId = '';
            if (x.leadRef?.id) managerId = (await pool.query('SELECT manager_id FROM leads WHERE id = $1', [x.leadRef.id])).rows[0]?.manager_id || '';
            const contact = await managerContact(managerId);
            await sendAuto(person, T.render(kind, { ...contact, name: r.name, date: T.uzDate(due + 'T12:00:00Z') }), 'auto-' + kind);
        });
    }
}
let dailyTimer = null;
function startDaily() {
    if (dailyTimer || process.env.NODE_ENV === 'test') return;
    dailyTimer = setInterval(() => runDaily().catch(e => console.warn('[stage-sms] kunlik:', e.message)), 10 * 60000);
    dailyTimer.unref?.();
}

module.exports = { onTrialResult, runDaily, startDaily, managerContact, onLeadSaved, sendAuto, uzPhoneOf, errorKind, alertAdmin, buildMessages, prevOf };
