'use strict';
// "Qotib qolgan lidlar" qoidasi: "Bog'lanishga urinilmoqda"da turib, bir marta ham bog'lanilmagan lidlar.
// warnDays — ogohlantirish, lockDays — sotuv menejerining ishi shu lidlar hal bo'lguncha qulflanadi (klientda).
// Server: qoida sozlamasi (til bo'yicha) va "qo'ng'iroq qilmasdan Sifatsizga o'tkazib bo'lmaydi" tekshiruvi.
const DEFAULT_RULE = Object.freeze({ warnDays: 3, lockDays: 5, callsPerDay: 30 });
const KEY = 'staleLeadRule';
const CALL_EVIDENCE_TYPES = new Set(['call-attempt', 'contact-fail']);
const CALL_WINDOW_MS = 24 * 60 * 60 * 1000;
const PRE_CONTACT = new Set(['yangi-lidlar', 'boglanishga-urinilmoqda']);

function cleanRule(r) {
    const w = Math.round(Number(r?.warnDays)), l = Math.round(Number(r?.lockDays));
    const warnDays = Number.isFinite(w) && w >= 1 && w <= 60 ? w : DEFAULT_RULE.warnDays;
    let lockDays = Number.isFinite(l) && l >= 1 && l <= 90 ? l : DEFAULT_RULE.lockDays;
    if (lockDays <= warnDays) lockDays = warnDays + 1;
    const c = Math.round(Number(r?.callsPerDay));
    const callsPerDay = Number.isFinite(c) && c >= 1 && c <= 300 ? c : DEFAULT_RULE.callsPerDay;
    return { warnDays, lockDays, callsPerDay };
}

async function getRules(pool) {
    const row = (await pool.query('SELECT data FROM json_data WHERE key = $1', [KEY])).rows[0];
    const d = row?.data && typeof row.data === 'object' ? row.data : {};
    return { english: cleanRule(d.english), russian: cleanRule(d.russian) };
}

async function saveRules(pool, patch, langs) {
    const current = await getRules(pool);
    for (const lang of ['english', 'russian']) {
        if (!patch?.[lang]) continue;
        if (langs && !langs.includes(lang)) continue; // ROP faqat o'z tili
        current[lang] = cleanRule(patch[lang]);
    }
    await pool.query(`INSERT INTO json_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`,
        [KEY, JSON.stringify(current)]);
    return current;
}

const ts = v => { const t = typeof v === 'number' ? v : Date.parse(v || ''); return Number.isFinite(t) ? t : 0; };
// Dalil vaqti — server qabul qilgan vaqt (serverAt). Telefon soati noto'g'ri bo'lsa ham ishlaydi.
// serverAt yo'q eski izohlar uchun telefon vaqti keng chegarada qabul qilinadi.
function hasRecentCall(lead, now = Date.now()) {
    return (Array.isArray(lead?.comments) ? lead.comments : []).some(c => {
        if (!c || !CALL_EVIDENCE_TYPES.has(c.type)) return false;
        const s = ts(c.serverAt);
        if (s) return now - s <= CALL_WINDOW_MS;
        const t = ts(c.createdAt);
        return t > 0 && Math.abs(now - t) <= CALL_WINDOW_MS;
    });
}
// Yangi qo'ng'iroq izohlariga server vaqtini qo'yadi (mavjudlariga tegmaydi).
function stampCallEvidence(existing, incoming, now = new Date()) {
    if (!incoming || !Array.isArray(incoming.comments)) return;
    const had = new Set((Array.isArray(existing?.comments) ? existing.comments : []).map(c => c && c.id).filter(Boolean));
    for (const c of incoming.comments) {
        if (c && CALL_EVIDENCE_TYPES.has(c.type) && !c.serverAt && !had.has(c.id)) c.serverAt = now.toISOString();
    }
}

// Sotuv menejeri bog'lanishdan oldingi bosqichdagi lidni "Sifatsiz"ga o'tkazmoqchi — oxirgi 24 soatda
// qo'ng'iroq qilingani (bazadagi tarixda) bo'lishi shart.
function assertCallBeforeSifatsiz(existing, incoming, role) {
    if (role !== 'sales_manager' || !existing || !incoming) return;
    const from = String(existing.status || ''), to = String(incoming.status || '');
    if (to !== 'sifatsiz-lidlar' || from === to || !PRE_CONTACT.has(from)) return;
    if (hasRecentCall(existing)) return;
    throw Object.assign(new Error('Avval shu lidga qoʻngʻiroq qilib koʻring — olmasa, keyin “Sifatsiz”ga oʻtkazasiz.'), { status: 409, code: 'CALL_FIRST' });
}

// "Keyinroq gaplashishni so'radi" (telefonni oldi): "follow-up-reminder" + callback: true (js/staleLeads.js bilan bir xil).
// Ko'pi bilan CALLBACK_MAX marta, CALLBACK_MAX_DAYS kun ichidagi vaqtga. Kelishilgan vaqtdan CALLBACK_GRACE_MS o'tib
// ham lid bog'lanishdan oldingi bosqichda tursa — u yana "qotgan" (qulf) hisoblanadi.
const CALLBACK_MAX = 2, CALLBACK_MAX_DAYS = 3, CALLBACK_GRACE_MS = 2 * 60 * 60 * 1000, DAY_MS = 24 * 60 * 60 * 1000;
const callbacksOf = lead => (Array.isArray(lead?.comments) ? lead.comments : [])
    .filter(c => c && c.type === 'follow-up-reminder' && c.callback && ts(c.reminderAt))
    .map(c => ({ id: c.id, t: ts(c.createdAt), at: ts(c.reminderAt) })).sort((a, b) => a.t - b.t);
// Qotgan lid holati: null — kelishuv yo'q (eski "kun" qoidasi), 'waiting' — vaqt hali kelmagan/imtiyozda, 'overdue' — qulf.
function callbackState(lead, now = Date.now()) {
    const a = callbacksOf(lead);
    if (!a.length) return null;
    return now - a[a.length - 1].at >= CALLBACK_GRACE_MS ? 'overdue' : 'waiting';
}
// Sotuv menejeri yangi "keyinroq" yozuvini qo'shmoqda — limit va muddat server vaqtida tekshiriladi.
function assertCallbackRules(existing, incoming, role, now = Date.now()) {
    if (role !== 'sales_manager' || !incoming || !Array.isArray(incoming.comments)) return;
    const had = new Set((Array.isArray(existing?.comments) ? existing.comments : []).map(c => c && c.id).filter(Boolean));
    const fresh = callbacksOf(incoming).filter(c => !had.has(c.id));
    if (!fresh.length) return;
    if (callbacksOf(incoming).length > CALLBACK_MAX)
        throw Object.assign(new Error(`Suhbat ${CALLBACK_MAX} martadan koʻp keyinga surilmaydi — natijani yozing (anketa yoki “Sifatsiz”).`), { status: 409, code: 'CALLBACK_LIMIT' });
    for (const c of fresh) {
        if (c.at > now + CALLBACK_MAX_DAYS * DAY_MS + 60 * 60 * 1000 || c.at < now - DAY_MS)
            throw Object.assign(new Error(`Qayta qoʻngʻiroq vaqti ${CALLBACK_MAX_DAYS} kun ichida boʻlsin.`), { status: 400, code: 'CALLBACK_RANGE' });
    }
}

module.exports = { DEFAULT_RULE, cleanRule, getRules, saveRules, hasRecentCall, stampCallEvidence, assertCallBeforeSifatsiz,
    CALLBACK_MAX, CALLBACK_MAX_DAYS, CALLBACK_GRACE_MS, callbacksOf, callbackState, assertCallbackRules };
