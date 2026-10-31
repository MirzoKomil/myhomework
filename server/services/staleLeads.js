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

module.exports = { DEFAULT_RULE, cleanRule, getRules, saveRules, hasRecentCall, stampCallEvidence, assertCallBeforeSifatsiz };
