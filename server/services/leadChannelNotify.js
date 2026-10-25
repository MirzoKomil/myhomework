// Saytdan (domwork.uz) kelgan organik lidlarni CRM'ga yozilgandan keyin
// Telegram kanal/guruhga ham nusxa sifatida yuboradi (@Domworkru_bot orqali).
//
// Sozlash (Railway → myhomework → Variables):
//   DOMWORK_LEADS_CHANNEL_BOT_TOKEN — @Domworkru_bot tokeni (BotFather)
//   DOMWORK_LEADS_CHANNEL_CHAT_ID   — kanal/guruh ID'si (masalan -100...)
// Ikkalasi bo'lmasa hech narsa yuborilmaydi. Xato bo'lsa faqat logga yoziladi:
// lid baribir CRM'da saqlangan bo'ladi, kanal faqat qo'shimcha nusxa.

const SEND_TIMEOUT_MS = 8000;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function channelConfig(env = process.env) {
    const token = String(env.DOMWORK_LEADS_CHANNEL_BOT_TOKEN || '').trim();
    const chatId = String(env.DOMWORK_LEADS_CHANNEL_CHAT_ID || '').trim();
    return token && chatId ? { token, chatId } : null;
}

// contactTime landingdan "09:00–12:00 | Maqsad: ... | Telegram: ... | Sayt: ..."
// ko'rinishida keladi — har bir bo'lakni alohida qatorga chiqaramiz.
function buildLeadChannelMessage({ id, name, phone, contactTime, utmSource, utmCampaign, utmContent }) {
    const lines = ['🌐 <b>Yangi lid — domwork.uz</b> (Organic)', ''];
    lines.push(`👤 Ism: ${escapeHtml(name)}`);
    if (phone) lines.push(`📞 Telefon: ${escapeHtml(phone)}`);
    const parts = String(contactTime || '').split('|').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
        const m = /^([^\d:][^:]*):\s*(.*)$/.exec(part);
        if (!m) { lines.push(`🕒 Qulay vaqt: ${escapeHtml(part)}`); continue; }
        const label = m[1].trim();
        if (/^sayt$/i.test(label)) continue;
        const icon = /maqsad/i.test(label) ? '🎯' : /telegram/i.test(label) ? '✈️' : '•';
        lines.push(`${icon} ${escapeHtml(label)}: ${escapeHtml(m[2])}`);
    }
    const utm = [utmSource, utmCampaign, utmContent].filter(Boolean).join(' / ');
    if (utm) lines.push(`📣 UTM: ${escapeHtml(utm)}`);
    const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });
    lines.push('', `📅 ${escapeHtml(now)}${id ? ` · CRM #${escapeHtml(String(id).slice(0, 8))}` : ''}`);
    return lines.join('\n');
}

async function notifyLeadChannel(lead, { env = process.env, fetcher = (...a) => fetch(...a) } = {}) {
    const config = channelConfig(env);
    if (!config) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
        const response = await fetcher(`https://api.telegram.org/bot${config.token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                chat_id: config.chatId,
                text: buildLeadChannelMessage(lead),
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) {
            console.warn(`[lead-channel] YUBORILMADI status=${response.status} ${result?.description || ''}`);
            return false;
        }
        console.log(`[lead-channel] KANALGA YUBORILDI id=${lead.id || '-'}`);
        return true;
    } catch (err) {
        console.warn('[lead-channel] XATO:', err.message);
        return false;
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { notifyLeadChannel, buildLeadChannelMessage, channelConfig };
