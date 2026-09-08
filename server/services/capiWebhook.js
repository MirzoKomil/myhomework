// CAPI.uz — CHIQUVCHI integratsiya: bu tizimdagi lid yaratilganda yoki
// bosqichi o'zgarganda CAPI.uz'ga POST yuboradi, u esa buni Facebook (Meta)
// Conversions API'ga o'giradi — shu orqali reklama qaysi lid pulga
// aylanganini bilib, optimizatsiya qiladi.
//
// MUHIM: CAPI_UZ_TOKEN — parol bilan barobar maxfiy kalit (hujjatga qarang:
// "DOMEWORK-webhook-integratsiya.md"). Faqat shu yerda, serverning o'z
// muhitida (.env / Railway Variables) saqlanadi — hech qachon js/app.js
// yoki boshqa client-side kodga chiqarilmaydi, logga yozilmaydi.
const { normalizeLeadStatus } = require('./leadStages');

const CAPI_UZ_URL = process.env.CAPI_UZ_URL || 'https://capi.uz/api/inbound';
const CAPI_UZ_TOKEN = process.env.CAPI_UZ_TOKEN || '';

if (!CAPI_UZ_TOKEN) {
    console.warn(
        '[capi] OGOHLANTIRISH: CAPI_UZ_TOKEN o\'rnatilmagan — lidlar Meta Conversions API\'ga yuborilmaydi. ' +
        'Railway Variables\'da o\'rnating.'
    );
}

// ── CRM maydonlari → CAPI maydonlari ─────────────────────────────────────────
// Dastlab bu yerdan atigi bir nechta maydon ketardi (externalId, stage va
// atributsiya belgilari). Amalda ko'pchilik lidda fbclid/utm_* umuman
// bo'lmaydi (ular faqat Meta'dan kelgan lidlarda bor) — natijada CAPI'ga
// deyarli bo'sh lid borardi va targetologlar kabinetda hech narsa
// ko'rmasdi. Endi CAPI hujjatida ("DOMEWORK-webhook-integratsiya.md",
// 3-bo'lim) sanab o'tilgan HAMMA maydon, CRM'da mavjud bo'lsa, yuboriladi.
//
// Muhim: bo'sh maydon yuborilmaydi. CAPI qoidasi (hujjat, 6-bo'lim, 2-band)
// bo'yicha yuborilmagan maydonga tegilmaydi — oldin kelgan qiymati saqlanib
// qoladi. Agar bo'sh satr yuborsak, avval to'g'ri kelgan telefon/utm'ni
// bo'sh qiymat bilan bosib yuborgan bo'lardik.

// "1 500 000", "1500000", 1500000 — hammasi 1500000 bo'ladi.
// CAPI `value` ni RAQAM sifatida kutadi ("value must be a number"),
// shuning uchun satrni tozalab, faqat musbat son qaytariladi.
function toAmount(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
}

// Meta odamni telefon bo'yicha topadi — raqam qanchalik standart bo'lsa,
// moslashtirish (match rate) shuncha yaxshi. CRM'da raqamlar har xil
// ko'rinishda saqlanadi: "+998901234567", "901234567", "90 123 45 67".
function toE164(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 9) return `+998${digits}`;
    if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
    return trimmed.startsWith('+') ? `+${digits}` : `+${digits}`;
}

function uniqNonEmpty(list) {
    return [...new Set(list.filter(Boolean))];
}

// Lidning "To'lov yopildi" summasi. Analitika bo'limi (js/app.js —
// getDashboardLeadRevenue / anLeadRevenue) aynan shu tartibda o'qiydi,
// shuning uchun CAPI'ga ham bir xil raqam ketishi kerak — aks holda
// CRM'dagi tushum va Facebook'dagi Purchase summasi bir-biriga to'g'ri
// kelmay qoladi.
function resolveValue(lead) {
    return toAmount(lead.paymentClosedSurvey?.actualAmount)
        ?? toAmount(lead.paymentClosedSurvey?.totalAmount)
        ?? toAmount(lead.paymentSurvey?.paidAmount)
        ?? toAmount(lead.paymentSurvey?.totalAmount)
        ?? null;
}

// So'rovnomalardagi ma'lumot CAPI'da alohida maydon sifatida yo'q, lekin
// teglar orqali yuborilsa targetolog kabinetda auditoriyani bo'lib
// tahlil qila oladi (qaysi tarif, qaysi maqsad, qaysi yosh sotib olyapti).
function buildTags(lead) {
    const survey = lead.connectedSurvey || {};
    const tags = [
        lead.source && `manba:${lead.source}`,
        lead.leadType && `tur:${lead.leadType}`,
        lead.language && `kurs:${lead.language === 'russian' ? 'rus' : 'ingliz'}`,
        lead.paymentSurvey?.tariff && `tarif:${lead.paymentSurvey.tariff}`,
        survey.languageLevel && `daraja:${survey.languageLevel}`,
        survey.learningGoal && `maqsad:${survey.learningGoal}`,
        survey.studyReason && `sabab:${survey.studyReason}`,
        Number(survey.age) > 0 && `yosh:${Number(survey.age)}`,
    ];
    // Muvaffaqiyatsiz lidlarda "nega yo'qotdik" sababi — target sifatini
    // baholash uchun eng qimmatli ma'lumotlardan biri.
    if (Array.isArray(lead.contactFailReasons)) {
        lead.contactFailReasons.forEach(r => r && tags.push(`sabab-yoq:${r}`));
    }
    return uniqNonEmpty(tags).map(t => String(t).slice(0, 190));
}

// CRM'da 'female' / 'male', Meta esa 'f' / 'm' kutadi.
function toMetaGender(raw) {
    const g = String(raw || '').trim().toLowerCase();
    if (g === 'female' || g === 'ayol') return 'f';
    if (g === 'male' || g === 'erkak') return 'm';
    return '';
}

function buildPayload(lead) {
    const survey = lead.connectedSurvey || {};

    const payload = {
        externalId: String(lead.id),
        stage: normalizeLeadStatus(lead.status),
    };

    // ── Shaxsni aniqlash (Meta matching) ────────────────────────────────
    const phone = toE164(lead.phone);
    const phone2 = toE164(lead.phone2);
    if (phone) payload.phone = phone;
    const phones = uniqNonEmpty([phone, phone2]);
    if (phones.length > 1) payload.phones = phones;

    if (lead.email) payload.email = lead.email;

    const gender = toMetaGender(survey.gender || lead.gender);
    if (gender) payload.gender = gender;

    // Hudud: avval so'rovnomadagi javob, bo'lmasa lidning o'z maydoni.
    // CAPI'da `city` va `region` alohida, lekin CRM'da bitta "hudud"
    // tanlovi bor (Toshkent shahri / viloyat / chet el) — shuning uchun
    // ikkalasiga ham bir xil qiymat beriladi, Meta qaysi biri bo'yicha
    // moslasha olsa o'shanisini ishlatadi.
    const region = String(survey.region || lead.region || '').trim();
    if (region) {
        payload.region = region;
        payload.city = region;
    }
    // `dob` ATAYIN yuborilmaydi: CRM'da faqat yosh (son) bor, tug'ilgan
    // sana yo'q. Yoshdan taxminiy sana "o'ylab topilsa" Meta uni xato
    // moslashtirib, natijani yaxshilash o'rniga buzadi. Yosh esa teg
    // sifatida ketadi (buildTags).

    // ── Bitim ───────────────────────────────────────────────────────────
    if (lead.name) payload.name = lead.name;
    const contactName = lead.fullName || lead.name;
    if (contactName) payload.contactName = contactName;

    const value = resolveValue(lead);
    if (value !== null) payload.value = value;

    // Ikki kurs — ikki alohida voronka. CAPI kabinetida bosqichlar shu
    // bo'yicha ajratilib tahlil qilinadi.
    payload.pipeline = lead.language === 'russian' ? 'Domwork (Rus tili)' : 'Homework (Ingliz tili)';

    if (lead.managerId) payload.responsibleUserId = String(lead.managerId);

    const tags = buildTags(lead);
    if (tags.length) payload.tags = tags;

    // ── Atributsiya belgilari (eng qimmatlisi) ──────────────────────────
    if (lead.fbclid) payload.fbclid = lead.fbclid;
    if (lead.fbLeadId) payload.fbLeadId = lead.fbLeadId;
    if (lead.ctwaClid) payload.ctwaClid = lead.ctwaClid;
    if (lead.igUsername) payload.igUsername = lead.igUsername;
    if (lead.utmSource) payload.utmSource = lead.utmSource;
    if (lead.utmCampaign) payload.utmCampaign = lead.utmCampaign;
    if (lead.utmContent) payload.utmContent = lead.utmContent;

    // ── Vaqtlar ─────────────────────────────────────────────────────────
    if (lead.createdAt) payload.createdAt = lead.createdAt;
    if (lead.updatedAt) payload.updatedAt = lead.updatedAt;

    return payload;
}

// Hech qachon xato tashlamaydi (throw qilmaydi) — CAPI.uz sekin ishlasa
// yoki butunlay o'chib qolsa ham, bu CRM'ning asosiy oqimini (lid
// yaratish/saqlash) buzmasligi kerak. Chaqiruvchi await qilmasdan
// "otib yuborishi" (fire-and-forget) mumkin.
async function sendLeadToCapi(lead) {
    if (!CAPI_UZ_TOKEN) return;
    if (!lead || !lead.id) return;

    const payload = buildPayload(lead);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(CAPI_UZ_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CAPI_UZ_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            console.error(`[capi] RAD ETILDI  lid=${lead.id} HTTP=${response.status}`, data?.message || data);
            return;
        }
        if (Array.isArray(data.rejected) && data.rejected.length) {
            console.warn(`[capi] QISMAN QABUL  lid=${lead.id}`, data.rejected);
        } else {
            console.log(`[capi] YUBORILDI  lid=${lead.id} bosqich=${payload.stage}`);
        }
    } catch (err) {
        const reason = err.name === 'AbortError' ? 'javob vaqti tugadi' : err.message;
        console.error(`[capi] XATOLIK  lid=${lead.id}  ${reason}`);
    } finally {
        clearTimeout(timer);
    }
}

// buildPayload testlar uchun ham eksport qilinadi — CRM maydonlari CAPI
// maydonlariga to'g'ri o'girilayotganini tarmoqqa chiqmasdan tekshirish uchun.
module.exports = { sendLeadToCapi, buildPayload };
