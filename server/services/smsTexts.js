'use strict';
// Avtomatik SMS matnlari — BITTA joyda.
//
// MUHIM: Eskiz har bir matnni moderatsiyadagi nusxa bilan HARFMA-HARF solishtiradi
// (o'zgaruvchi joylar — ism, sana, havola — moderator maska qo'ygan joylar).
// Bu yerdagi matnni o'zgartirsangiz, o'sha matnni my.eskiz.uz → SMS → Mening matnlarim
// orqali QAYTA moderatsiyaga yuborish shart, aks holda Eskiz "Этот смс текст еще не прошёл
// модерацию" deb rad etadi va SMS ketmaydi.
//
// Qoidalar: faqat oddiy apostrof (') — ‘ ’ ʻ belgilari SMS'ni Unicode qiladi (70 belgi,
// narx 2 barobar); bitta SMS = 160 belgigacha; reklama so'zlari (chegirma, aksiya)
// matnni "reklama" tarifiga o'tkazadi.

// Lid ismi: birinchi so'z, faqat harflar (lotin/kirill), bosh harf katta.
// Yaroqsiz bo'lsa ('.', emoji, raqam) — '' qaytadi va ismsiz variant ishlatiladi.
function cleanName(raw) {
    const first = String(raw || '').normalize('NFC').trim().split(/\s+/)[0] || '';
    const word = first.replace(/[^A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ'`ʻʼ‘’-]/g, '').replace(/[`ʻʼ‘’]/g, "'").replace(/^['-]+|['-]+$/g, '');
    const letters = word.replace(/['-]/g, '');
    if (letters.length < 2 || letters.length > 20) return '';
    // Aralash yozuv ("Jasurбек") yoki hammasi bir xil harf — yaroqsiz
    if (/[A-Za-z]/.test(letters) && /[А-Яа-яЁё]/.test(letters)) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

// Toshkent vaqti (UTC+5) bo'yicha sana qismlari
function tashkentParts(dateLike) {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return null;
    const t = new Date(d.getTime() + 5 * 3600000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), hh: String(t.getUTCHours()).padStart(2, '0'), mm: String(t.getUTCMinutes()).padStart(2, '0') };
}
function dayKey(p) { return `${p.y}-${p.m}-${p.d}`; }

// "20-noyabr"
function uzDate(dateLike) {
    const p = tashkentParts(dateLike);
    return p ? `${p.d}-${UZ_MONTHS[p.m]}` : '';
}
// "19:00"
function uzTime(dateLike) {
    const p = tashkentParts(dateLike);
    return p ? `${p.hh}:${p.mm}` : '';
}
// "bugun 19:00" / "ertaga 10:00" / "20-noyabr 10:00"
function uzWhen(dateLike, now = new Date()) {
    const p = tashkentParts(dateLike);
    if (!p) return '';
    const today = tashkentParts(now);
    const tomorrow = tashkentParts(now.getTime() + 24 * 3600000);
    const day = dayKey(p) === dayKey(today) ? 'bugun' : dayKey(p) === dayKey(tomorrow) ? 'ertaga' : `${p.d}-${UZ_MONTHS[p.m]}`;
    return `${day} ${p.hh}:${p.mm}`;
}

const ADMIN = 't.me/domwork_admin';
const APP_URL = 'myhomework.uz/student/v2';
// Lidning sotuv menejeri bo'lmasa yoki HR kartasida telefoni yo'q bo'lsa — maktab raqami.
const SCHOOL_CONTACT = { name: 'Domwork', phone: '+998907681295' };

// Har bir matn: (v) => string. v: { ism, menejer, tel, link, when, time, date, login, password }
// {menejer}, {tel} — lidga biriktirilgan sotuv menejerining ismi va telefoni (HR kartasidan).
// Ism yaroqsiz bo'lsa withoutName varianti ishlatiladi (ikkalasi ham moderatsiyada bo'lishi kerak).
const TEXTS = {
    // ── Bog'lanishga urinilmoqda (bosqichga o'tganda) ──
    'boglanishga-urinilmoqda': {
        withName: v => `Assalomu alaykum, ${v.ism}! Domwork rus tili kursidan qo'ng'iroq qildik, bog'lana olmadik. Qulay vaqtda qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
        withoutName: v => `Assalomu alaykum! Domwork rus tili kursidan qo'ng'iroq qildik, bog'lana olmadik. Qulay vaqtda qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
    },
    // ── Bog'lanildi ──
    'boglanildi': {
        withName: v => `${v.ism}, suhbat uchun rahmat! Domwork kursi yoki sinov darsi bo'yicha savollaringiz bo'lsa, qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
        withoutName: v => `Suhbat uchun rahmat! Domwork kursi yoki sinov darsi bo'yicha savollaringiz bo'lsa, qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
    },
    // ── Sinov darsida: qo'yilganda (vaqt yoki ustoz o'zgarsa ham), 1 soat oldin, boshlanganda ──
    'sinov-qoyildi': {
        withName: v => `${v.ism}, Domwork sinov darsingiz ${v.date} kuni soat ${v.time} da, ustoz bilan yakkama-yakka bo'ladi. Havolani saqlab qo'ying: ${v.link}`,
        withoutName: v => `Domwork sinov darsingiz ${v.date} kuni soat ${v.time} da, ustoz bilan yakkama-yakka bo'ladi. Havolani saqlab qo'ying: ${v.link}`,
    },
    'sinov-1h': {
        withName: v => `${v.ism}, Domwork sinov darsingiz 1 soatdan keyin, soat ${v.time} da boshlanadi. Vaqtida quloqchin bilan tinch joydan kiring: ${v.link}`,
        withoutName: v => `Domwork sinov darsingiz 1 soatdan keyin, soat ${v.time} da boshlanadi. Vaqtida quloqchin bilan tinch joydan kiring: ${v.link}`,
    },
    'sinov-start': {
        withName: v => `${v.ism}, Domwork sinov darsingiz boshlanmoqda, ustoz sizni kutmoqda. Hoziroq kiring: ${v.link}`,
        withoutName: v => `Domwork sinov darsingiz boshlanmoqda, ustoz sizni kutmoqda. Hoziroq kiring: ${v.link}`,
    },
    // Ustoz natija yozganda
    'sinov-otdi': {
        withName: v => `${v.ism}, Domwork sinov darsida qatnashganingiz uchun rahmat! Kurs bo'yicha savollaringiz bo'lsa, qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
        withoutName: v => `Domwork sinov darsida qatnashganingiz uchun rahmat! Kurs bo'yicha savollaringiz bo'lsa, qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
    },
    'sinov-kelmadi': {
        withName: v => `${v.ism}, Domwork sinov darsida sizni ko'rmadik. Darsni qulay vaqtga ko'chirish uchun qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
        withoutName: v => `Domwork sinov darsida sizni ko'rmadik. Darsni qulay vaqtga ko'chirish uchun qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
    },
    // ── Qaror jarayonida ──
    'qaror-jarayonida': {
        withName: v => `${v.ism}, Domwork kursi bo'yicha dars jadvali, ustoz yoki bo'lib to'lash haqida savollaringiz bo'lsa, qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
        withoutName: v => `Domwork kursi bo'yicha dars jadvali, ustoz yoki bo'lib to'lash haqida savollaringiz bo'lsa, qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
    },
    // ── Keyin sotib olmoqchi: lid aytgan sana kuni ertalab ──
    'keyin-sotib-olmoqchi': {
        withName: v => `${v.ism}, Domwork kursi bo'yicha bugun qayta gaplashishga kelishgan edik. Qulay vaqtda qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
        withoutName: v => `Domwork kursi bo'yicha bugun qayta gaplashishga kelishgan edik. Qulay vaqtda qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
    },
    // ── To'lov jarayonida ──
    'tolov-toliq': {
        withName: v => `${v.ism}, to'lovingiz qabul qilindi, Domworkka xush kelibsiz! Yordamchi ustozingiz tez orada siz bilan bog'lanib, tanishib oladi.`,
        withoutName: v => `To'lovingiz qabul qilindi, Domworkka xush kelibsiz! Yordamchi ustozingiz tez orada siz bilan bog'lanib, tanishib oladi.`,
    },
    'tolov-qisman': {
        withName: v => `${v.ism}, boshlang'ich to'lovingiz qabul qilindi, Domworkka xush kelibsiz! Qolgan qismini to'lash muddati: ${v.date} kuni. Menejer: ${v.menejer} ${v.tel}`,
        withoutName: v => `Boshlang'ich to'lovingiz qabul qilindi, Domworkka xush kelibsiz! Qolgan qismini to'lash muddati: ${v.date} kuni. Menejer: ${v.menejer} ${v.tel}`,
    },
    'ilova-login': {
        withName: v => `${v.ism}, Domwork ilovasiga kirish:\nhttps://${APP_URL}\nLogin: ${v.login}\nParol: ${v.password}\nParolni hech kimga bermang.`,
        withoutName: v => `Domwork ilovasiga kirish:\nhttps://${APP_URL}\nLogin: ${v.login}\nParol: ${v.password}\nParolni hech kimga bermang.`,
    },
    // ── Qarzdor: navbatdagi to'lovdan 1 kun oldin va muddat o'tgan kuni ertasiga ──
    'qarz-eslatma': {
        withName: v => `${v.ism}, eslatma: Domwork kursi bo'yicha navbatdagi to'lov muddati ertaga, ${v.date}. Savol bo'lsa, qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
        withoutName: v => `Eslatma: Domwork kursi bo'yicha navbatdagi to'lov muddati ertaga, ${v.date}. Savol bo'lsa, qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
    },
    'qarz-otdi': {
        withName: v => `${v.ism}, Domwork kursi bo'yicha to'lov muddati ${v.date} kuni tugadi. To'lov bo'yicha kelishish uchun qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
        withoutName: v => `Domwork kursi bo'yicha to'lov muddati ${v.date} kuni tugadi. To'lov bo'yicha kelishish uchun qo'ng'iroq qiling. Menejer: ${v.menejer} ${v.tel}`,
    },
    // ── To'lov yopildi ──
    'tolov-yopildi': {
        withName: v => `${v.ism}, Domwork kursi to'lovi to'liq yopildi. Ishonchingiz uchun rahmat, darslaringizda omad tilaymiz!`,
        withoutName: v => `Domwork kursi to'lovi to'liq yopildi. Ishonchingiz uchun rahmat, darslaringizda omad tilaymiz!`,
    },
};

// Menejer telefoni: faqat O'zbekiston raqami, +998XXXXXXXXX ko'rinishida; yaroqsiz bo'lsa ''.
function formatPhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.length === 9) d = '998' + d;
    return /^998\d{9}$/.test(d) ? '+' + d : '';
}

function render(key, vars = {}) {
    const t = TEXTS[key];
    if (!t) return '';
    const ism = cleanName(vars.name);
    const menejer = cleanName(vars.managerName) || SCHOOL_CONTACT.name;
    const tel = formatPhone(vars.managerPhone) || SCHOOL_CONTACT.phone;
    const v = { ...vars, ism, menejer: tel === SCHOOL_CONTACT.phone ? SCHOOL_CONTACT.name : menejer, tel };
    // Juda uzun ism 160 belgidan oshirib yuborsa — ismsiz variant (bitta SMS bo'lib qolsin)
    let text = ism ? t.withName(v) : t.withoutName(v);
    if (text.length > 160 && ism) text = t.withoutName(v);
    return text.replace(/[‘’ʻʼ`]/g, "'");
}

module.exports = { TEXTS, render, cleanName, formatPhone, uzDate, uzTime, uzWhen, ADMIN, APP_URL, SCHOOL_CONTACT };
