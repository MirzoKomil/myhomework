'use strict';
// Bot xabarlari uchun yagona uslub: HTML (qalin, mention), so'm, sana, iliq tilaklar.
// Har bir o'zgaruvchi qiymat esc() orqali o'tadi — ism yoki izohdagi "<" xabarni buzmaydi.
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const b = v => `<b>${esc(v)}</b>`;
const i = v => `<i>${esc(v)}</i>`;
const HTML = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const DAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const sum = n => new Intl.NumberFormat('uz-UZ').format(Math.round(Number(n) || 0)).replace(/[  ,]/g, ' ') + ' so‘m';
// Odam: Telegram'ga ulangan bo'lsa — bosiladigan mention (guruhda unga bildirishnoma boradi), aks holda qalin ism.
function who(name, telegramId) {
    const label = String(name || '').trim() || 'Nomsiz';
    return /^[1-9]\d{4,15}$/.test(String(telegramId || '')) ? `<a href="tg://user?id=${telegramId}">${esc(label)}</a>` : b(label);
}
const first = name => String(name || '').trim().split(/\s+/)[0] || '';
// "2026-10-30T18:00" (Toshkent mahalliy) yoki Date → "30-oktabr, payshanba · 18:00"
function when(value) {
    let y, mo, d, hm;
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(typeof value === 'string' ? value : '');
    if (m) { [y, mo, d, hm] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] || '']; }
    else {
        const t = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(t.getTime())) return esc(value || '—');
        const local = new Date(t.getTime() + 5 * 3600000);
        [y, mo, d] = [local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate()];
        hm = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
    }
    const day = DAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
    return `${d}-${MONTHS[mo - 1]}, ${day}${hm ? ' · ' + hm : ''}`;
}
const dateOnly = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${Number(m[3])}-${MONTHS[Number(m[2]) - 1]}` : esc(iso); };
// Bir xil kalit — bir xil tilak (qayta yuborilsa ham matn o'zgarmaydi), turli kalit — turli tilak.
function pick(list, seed) {
    let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return list[h % list.length];
}
const CHEERS = {
    sale: ['Shu tezlikda davom eting — reja yaqin! 💪', 'Zo‘r ish! Navbatdagisi ham shu kun bo‘lsin 🚀', 'Mijoz ishondi — demak, siz to‘g‘ri gapirdingiz 👏',
        'Bugun omadli kun — yana bittasini qo‘shamizmi? 😉', 'Har bir sotuv — kimningdir yangi imkoniyati. Rahmat! 🌱', 'Jamoa faxrlanadi! 🔥',
        'Ana bu natija! Davom etamiz 💼', 'Ajoyib! Reja sari yana bir qadam 📈', 'Qoyil! Qo‘ng‘iroqlar bejiz ketmayapti ☎️', 'Shunday ishlash kerak! 🏆',
        'Zo‘r yopildi! Endi o‘quvchini yaxshi kutib olamiz 🤝', 'Mana bu professionallik! 👌', 'Bir sotuv — bir g‘alaba. Tabriklaymiz! 🎯',
        'Kuchli! Bugun yana rekord bo‘lishi mumkin ⚡️', 'Mehnat natija beryapti — barakali bo‘lsin! 🙌'],
    pay: ['Rahmat, nazorat zo‘r! 👍', 'Qarz kamaydi — zo‘r ish! 💪', 'Ana shunday tartib kerak 👌', 'O‘z vaqtida — qoyil! ⏱'],
    win: ['Butun jamoa nomidan tabriklaymiz! 👏', 'Ertaga kim? 😉 Musobaqa davom etadi!', 'Siz bugun hammaga namuna bo‘ldingiz 🌟', 'Qoyil! Shu ruhda davom eting 🔥'],
    teacher: ['Omad, ustoz! 🌟', 'Samarali darslar tilaymiz! 📚', 'Yangi o‘quvchi — yangi natija. Omad! 🍀']
};
// 3500 belgidan uzun HTML xabar kesilsa teg yarmida qolib Telegram rad etadi — oddiy matnga o'tkaziladi.
function fit(text, extra = {}) {
    const value = String(text);
    if (value.length <= 3500 || extra.parse_mode !== 'HTML') return { text: value.slice(0, 3500), extra };
    const plain = value.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const { parse_mode, ...rest } = extra;
    return { text: plain.slice(0, 3500), extra: rest };
}
module.exports = { fit, esc, b, i, HTML, sum, who, first, when, dateOnly, pick, CHEERS, MONTHS };
