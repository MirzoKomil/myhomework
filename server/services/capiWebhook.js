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

function buildPayload(lead) {
    const payload = {
        externalId: String(lead.id),
        stage: normalizeLeadStatus(lead.status),
    };
    if (lead.name) payload.name = lead.name;
    if (lead.phone) payload.phone = lead.phone;
    if (lead.email) payload.email = lead.email;
    if (lead.fbclid) payload.fbclid = lead.fbclid;
    if (lead.fbLeadId) payload.fbLeadId = lead.fbLeadId;
    if (lead.ctwaClid) payload.ctwaClid = lead.ctwaClid;
    if (lead.igUsername) payload.igUsername = lead.igUsername;
    if (lead.utmSource) payload.utmSource = lead.utmSource;
    if (lead.utmCampaign) payload.utmCampaign = lead.utmCampaign;
    if (lead.utmContent) payload.utmContent = lead.utmContent;
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

module.exports = { sendLeadToCapi };
