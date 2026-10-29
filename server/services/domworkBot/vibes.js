'use strict';
// Jamoa kayfiyati: motivatsiya, latifa, "qaynoq soat", Juma tabrigi, dushanba starti, oy oxiri sanog'i.
// Sozlama: teamVibesEnabled (Bot boshqaruvi). Har xabar kuniga bir marta (scheduler.once), yakshanba — dam.
const T = require('./tone');
const MORNING = [
    'Har bir qo‘ng‘iroq — kimningdir hayotini o‘zgartirish imkoniyati. Bugun shu imkoniyatlarni qo‘ldan boy bermaylik! 📞',
    'Kecha qancha bo‘lganini unutamiz — bugun yangi kun, yangi reja, yangi g‘alaba! 🚀',
    'Mijoz mahsulotni emas, ishonchni sotib oladi. Bugun ishonch uyg‘otamiz 🤝',
    '“Yo‘q” — bu hali “ha”ga yetib bormagan javob. Davom etamiz! 💪',
    'Eng yaxshi sotuvchi gapiradigan emas, eshitadigan odam. Bugun ko‘proq so‘raymiz, ko‘proq tinglaymiz 👂',
    'Reja — bu orzu emas, kunlik qadam. Bugungi qadamimiz qanday bo‘ladi? 🎯',
    'Har bir lid ortida o‘z maqsadi bor odam turibdi: ish, oila, kelajak. Biz unga yo‘l ko‘rsatamiz 🌱',
    'Kuchli ertalab — kuchli kun. Birinchi qo‘ng‘iroqni hoziroq qilamiz! ☕️📞',
    'Sotuv — bu raqamlar o‘yini. Qancha ko‘p suhbat, shuncha ko‘p natija 📈',
    'Bugun kamida bitta odamga “Domworkka yozilganim to‘g‘ri bo‘ldi” degan his beraylik ✨',
    'Muvaffaqiyat — har kuni qilinadigan kichik ishlarning yig‘indisi. Boshladik! 🔥',
    'E’tiroz — bu mijozning qiziqishi. Qiziqqan odam savol beradi 😉',
    'Bugun o‘zimizdan o‘zib ketamiz: kechagidan bitta ko‘proq qo‘ng‘iroq! 📞',
    'Ovozingizdagi tabassum telefon orqali ham eshitiladi. Jilmayib gaplashamiz 😊',
    'Biz shunchaki kurs sotmaymiz — odamlarga yangi imkoniyat eshigini ochamiz 🚪',
    'Kim ertalab boshlasa, kechqurun bayram qiladi. Oldinga! 🏁',
    'Har bir sinov darsi — kelajakdagi o‘quvchi. Sinovga yozilganlarni esdan chiqarmaylik 🧪',
    'Natija — mehnatning soyasi. Bugun soyamiz uzun bo‘lsin ☀️',
    'Qiyin mijoz — tajriba, oson mijoz — sovg‘a. Ikkalasi ham bizga foyda 🎁',
    'Bugun kimdir aynan sizning qo‘ng‘irog‘ingizni kutyapti. Uni topamiz! 🔎'
];
const EVENING = [
    '🔥 <b>Soat 18:00 — kunning eng qaynoq nuqtasi boshlandi!</b>\n\nOdamlar ishdan qaytdi, telefonga qarayapti, gaplashishga vaqti bor. Hozir har bir qo‘ng‘iroq kunduzgidan ikki barobar qimmat 📞\n\nBo‘shashmaymiz, jamoa! 💪',
    '⏰ <b>18:00 — oltin soatlar!</b>\n\nKunduzi “band edim” deganlarning hammasi hozir bo‘sh. Lidlar ro‘yxatini oching — bugungi rejani shu soatlarda yopamiz 🎯',
    '🚀 <b>Kechki marafon start oldi!</b>\n\nKun davomida qilgan mehnatimiz hozir hosil beradi. Qayta qo‘ng‘iroqlar, “o‘ylab ko‘raman”lar — hammasini hozir eslaymiz 🔔',
    '🌆 <b>Kech kirdi — sotuv vaqti!</b>\n\nEng ko‘p sotuv aynan 18:00–21:00 oralig‘ida yopiladi. Choy qo‘yib, naushnikni taqib, boshladik ☕️🎧',
    '💥 <b>Qaynoq soat boshlandi!</b>\n\nKim bugun hali sotuv qilmagan bo‘lsa — imkoniyat hozir. Kim qilgan bo‘lsa — yana bittasi uchun vaqt bor 😉',
    '🔥 <b>18:00! Hamma joyida?</b>\n\nHozir lidlar javob beradigan vaqt. Har bir “alo” — yangi imkoniyat. Ketdik, jamoa! 📞📞📞',
    '⚡️ <b>Kunning ikkinchi nafasi!</b>\n\nCharchoq — vaqtincha, natija — doimiy. Oxirgi 3 soatni eng kuchli soatga aylantiramiz 💪',
    '🎯 <b>Kechki fokus vaqti</b>\n\nTelegram, ijtimoiy tarmoqlar — keyin. Hozir faqat mijoz va qo‘ng‘iroq. 3 soat to‘liq diqqat = kunlik reja ✅'
];
// Latifalar — ish va sotuv haqida, hech kimni kamsitmaydigan.
const JOKES = [
    'Mijoz: “O‘ylab ko‘raman.”\nMenejer: “Albatta! Qancha vaqt o‘ylashingizni ham birga rejalashtirib qo‘yamizmi?” 😄',
    'Sotuvchidan so‘rashibdi: “Eng sevimli so‘zingiz qaysi?”\n— “Ha.”\n— “Eng yomon ko‘radigani-chi?”\n— “Keyinroq qo‘ng‘iroq qiling.” 😅',
    'Menejer kechasi tushida ham qo‘ng‘iroq qilibdi. Ertalab turib qarasa — tushdagi mijoz ham to‘lov qilmabdi 😂',
    '— Nega doim jilmayib gaplashasiz?\n— Mijoz ko‘rmaydi deb o‘ylaysizmi? Telefon ham sezadi! 😁',
    'Rus tilini o‘rganayotgan o‘quvchi: “Ustoz, ‘zdravstvuyte’ni qisqaroq aytsa bo‘lmaydimi?”\nUstoz: “Bo‘ladi — 90 kun o‘qisangiz, tez aytadigan bo‘lasiz!” 😄',
    'Sotuv menejerining ertalabki duosi: “Ilohim, bugun hamma telefonini ko‘tarsin, hech kim ‘o‘ylab ko‘raman’ demasin” 🙏😄',
    'Mijoz: “Qimmat ekan.”\nMenejer: “Bilim qimmatmi yoki bilimsizlik?” — mijoz o‘ylab qoldi, menejer to‘lov havolasini yubordi 😎',
    'Rejaning 99% bajarildi. Menejer: “Qolgan 1% — bu menga qolgan motivatsiya!” 💪😂',
    'Ofisda sukunat. Demak, hamma qo‘ng‘iroqda. Yoki hamma choy ichishga chiqdi ☕️😄',
    '— Bugun nechta qo‘ng‘iroq qildingiz?\n— 50 ta.\n— Natija?\n— 49 tasi “keyinroq”, bittasi “men allaqachon o‘qiyapman, Domworkda” 😂',
    'Migrant o‘quvchi: “Ustoz, brigadirga ruscha gapirgan edim, menga maoshni oshirib berdi!”\nUstoz: “Ana, kurs puli o‘zini oqladi!” 😄💰',
    'Menejer telefonini zaryadka qilmay qo‘ygan ekan. Telefon o‘zi qo‘ng‘iroq qilib: “Iltimos, meni ham dam oldiring” debdi 🔋😂',
    'Mijoz: “Men rus tilini maktabda o‘qiganman.”\nMenejer: “Ajoyib! Unda ‘privet’dan keyingi so‘zni birga eslaymiz” 😄',
    'Eng tez yuguruvchi — bu sinov darsiga kech qolayotgan o‘quvchi emas, unga eslatma yuborgan menejer 🏃‍♀️😄',
    'Sotuvchi bilan baliqchining farqi? Baliqchi baliq tutolmasa, “bugun omad yo‘q” deydi. Sotuvchi esa yana qo‘ng‘iroq qiladi 🎣📞',
    '— Nega rejani doim oy oxirida bajarasiz?\n— Chunki oy boshida reja hali uxlab yotgan bo‘ladi 😴😂',
    'Ustoz: “Ruschada ‘ha’ — ‘da’.”\nMenejer: “Mijozlarim faqat shu so‘zni o‘rgansa, men baxtliman!” 😄',
    'Menejer CRMga shunchalik ko‘p kiradiki, CRM ham uni “eng faol xodim” deb tanib qolgan 🤖😄',
    'Mijoz: “Menga chegirma bering.”\nMenejer: “Sizga bilim chegirmasiz beriladi — u bebaho!” 😉',
    '“Ertaga qo‘ng‘iroq qiling” degan mijozga ertaga qo‘ng‘iroq qilish — bu sotuvdagi eng kam uchraydigan sehr ✨😄'
];
const FRIDAY = [
    '🕌 <b>Juma muborak, aziz jamoa!</b>\n\nBu kun barchamizga baraka, xotirjamlik va ezgu ishlar olib kelsin. Haftaning so‘nggi ish kunlarini kuchli yakunlaymiz! 🤲',
    '🌙 <b>Juma ayyomingiz muborak bo‘lsin!</b>\n\nOilangizga tinchlik, ishimizga baraka, rizqimizga kenglik tilaymiz. Jamoamiz doim birdam bo‘lsin 🤝',
    '✨ <b>Muborak Juma!</b>\n\nHafta davomidagi mehnatingiz uchun rahmat. Duolaringiz ijobat, niyatlaringiz amalga oshsin 🤲',
    '🕊 <b>Juma muborak!</b>\n\nYaxshi niyat — yarim davlat. Bugun ham bir-birimizga yaxshi so‘z, mijozlarimizga yaxshi xizmat ulashamiz 🌸',
    '🌿 <b>Barakali Juma tilaymiz!</b>\n\nHar bir qilgan mehnatimiz savob va rizq bo‘lib qaytsin. Jamoa — oila! ❤️'
];
const dayIndex = date => Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
const rotate = (list, date, shift = 0) => list[(dayIndex(date) + shift) % list.length];
async function teamMonth(db, today) {
    const mgrs = (await db.query(`SELECT id FROM hr_employees WHERE role IN ('sotuv-menejeri','sotuv_menejeri','sotuv menejeri','sales_manager')
        AND lang='russian' AND COALESCE(status,'active') <> 'inactive'`)).rows.map(r => r.id);
    const month = today.slice(0, 7);
    const sum = Number((await db.query(`SELECT COALESCE(SUM(amount),0) AS s FROM payment_records WHERE language='russian' AND NOT legacy_review
        AND paid_date BETWEEN $1::date AND $2::date`, [month + '-01', today])).rows[0].s) || 0;
    const raw = (await db.query("SELECT data FROM json_data WHERE key='individualSalesPlans'")).rows[0]?.data;
    const plans = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
    const plan = mgrs.reduce((t, id) => t + (Number(require('./staff').personalPlan(plans, id, month)?.totalAmount) || 0), 0);
    return { sum, plan };
}
async function lastWeek(db, today) {
    const shift = n => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const from = shift(-7), to = shift(-1);
    const r = (await db.query(`SELECT COALESCE(SUM(p.amount),0) AS s, COUNT(DISTINCT p.lead_id) FILTER (WHERE p.source_key LIKE 'lead:%'
            AND NOT EXISTS(SELECT 1 FROM payment_records q WHERE q.lead_id=p.lead_id AND q.source_key LIKE 'lead:%' AND q.paid_date<$1::date)) AS sales,
        (SELECT h.name FROM payment_records x JOIN hr_employees h ON h.id=x.manager_id WHERE x.language='russian' AND NOT x.legacy_review
            AND x.paid_date BETWEEN $1::date AND $2::date GROUP BY h.id,h.name ORDER BY SUM(x.amount) DESC LIMIT 1) AS top
        FROM payment_records p WHERE p.language='russian' AND NOT p.legacy_review AND p.paid_date BETWEEN $1::date AND $2::date`, [from, to])).rows[0];
    return { sum: Number(r.s) || 0, sales: Number(r.sales) || 0, top: r.top || '' };
}
async function run(db, settings, clock, now, once) {
    if (!settings.teamVibesEnabled || !settings.groupNotificationsEnabled || clock.day === 7) return; // yakshanba — dam
    const events = require('./events');
    const at = (h, m) => clock.hour === h && clock.minute >= m && clock.minute < m + 2;
    const opts = { ...T.HTML, _setting: 'teamVibesEnabled', _expiresAt: new Date(now.getTime() + 3600000).toISOString() };
    const send = (key, type, text) => once(db, key, () => events.groupMessage(db, key, type, text, opts));
    // Juma tabrigi — butun jamoaga (Family guruhi).
    if (clock.day === 5 && at(9, 0)) await send('vibe-friday:' + clock.date, 'family', rotate(FRIDAY, clock.date));
    // Dushanba starti — o'tgan hafta natijasi bilan.
    if (clock.day === 1 && at(9, 30)) await once(db, 'vibe-monday:' + clock.date, async () => {
        const w = await lastWeek(db, clock.date);
        await events.groupMessage(db, 'vibe-monday:' + clock.date, 'sales', `☀️ <b>Yangi hafta — yangi imkoniyatlar!</b>\n\n📊 O‘tgan hafta: ${T.b(w.sales + ' ta yangi sotuv')} · ${T.b(T.sum(w.sum))}`
            + (w.top ? `\n🏆 Hafta yetakchisi: ${T.b(w.top)} — qoyil!` : '') + `\n\nBu hafta o‘tganidan kuchliroq bo‘ladi. Har kim o‘ziga bitta maqsad qo‘ysin 🎯\nOmad, jamoa! 💪`, opts);
    });
    // Ertalabki motivatsiya (dushanbadan tashqari — dushanba o'z starti bor).
    if (clock.day !== 1 && at(10, 0)) await send('vibe-morning:' + clock.date, 'sales', `☀️ <b>Xayrli tong, jamoa!</b>\n\n${T.esc(rotate(MORNING, clock.date))}`);
    // Tushlikdan keyin kulgi.
    if (at(13, 30)) await send('vibe-joke:' + clock.date, 'sales', `😄 <b>Kayfiyat uchun bir latifa</b>\n\n${T.esc(rotate(JOKES, clock.date))}`);
    // Oy oxiri sanog'i (oxirgi 3 kun, 11:00) — jamoa rejasi.
    const end = new Date(Date.UTC(Number(clock.date.slice(0, 4)), Number(clock.date.slice(5, 7)), 0)).getUTCDate();
    const left = end - Number(clock.date.slice(8));
    if (left <= 2 && left >= 0 && at(11, 0)) await once(db, 'vibe-monthend:' + clock.date, async () => {
        const m = await teamMonth(db, clock.date);
        const pct = m.plan > 0 ? Math.floor(m.sum / m.plan * 100) : null;
        await events.groupMessage(db, 'vibe-monthend:' + clock.date, 'sales', `⏳ <b>Oy tugashiga ${left === 0 ? 'bugun oxirgi kun' : left + ' kun'} qoldi!</b>\n\n💰 Jamoa tushumi: ${T.b(T.sum(m.sum))}`
            + (pct != null ? `\n🎯 Reja: ${T.b(pct + '%')}${m.plan > m.sum ? ` · qoldi ${T.b(T.sum(m.plan - m.sum))}` : ' — BAJARILDI! 🎉'}` : '')
            + `\n\n${left === 0 ? 'Oxirgi kun — oxirgi imkoniyat. Hamma “o‘ylab ko‘raman”larga bugun qo‘ng‘iroq! 📞🔥' : 'Har bir to‘lov hisobda. Qarzdorlar va “keyinroq”larni hozir eslaymiz 📞'}`, opts);
    });
    // 18:00 — qaynoq soat.
    if (at(18, 0)) await send('vibe-evening:' + clock.date, 'sales', rotate(EVENING, clock.date));
}
module.exports = { run, MORNING, EVENING, JOKES, FRIDAY };
