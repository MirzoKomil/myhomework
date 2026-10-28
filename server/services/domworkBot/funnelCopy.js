'use strict';
// @Domworkuz_bot lid voronkasi — barcha matnlar shu yerda (docs: "Domwork bot — lid voronkasi").
// Qoidalar: chatda narx yo'q; "bepul" kam; "90 kunda erkin" va'dasi yo'q; maosh haqida raqamli da'vo yo'q;
// migrantlarga kitob tilga olinmaydi; o'quvchi fikrlari faqat @domwork_natijalari'dagi haqiqiy postlar.

const SEGMENTS = {
    career: { label: '💼 Ish va kareyera', track: 'B' },
    russia: { label: '🇷🇺 Rossiyada ishlash/yashash', track: 'A' },
    daily: { label: '🗣 Kundalik suhbat', track: 'B' },
    abroad: { label: '🌍 Boshqa davlatda', track: 'A' }
};
// Landing (domwork.uz) maqsadlari → segment.
const LANDING_GOALS = { 'Ish va karyera': 'career', 'Rossiyada ishlash/yashash': 'russia', 'Erkin muloqot': 'daily', 'Sertifikat': 'career' };

const FIELDS = {
    bank: { label: '🏦 Bank va moliya', track: 'B', promise: 'bank vaziyatlarini: mijozga xizmatni tushuntirish, hujjat bo‘yicha savolga javob berish, yig‘ilishda gapirish' },
    med: { label: '🩺 Tibbiyot', track: 'B', promise: 'tibbiy vaziyatlarni: bemordan shikoyatini so‘rash, tavsiya berish, hamkasb bilan gaplashish' },
    gov: { label: '🏛 Davlat xizmati', track: 'B', promise: 'xizmat vaziyatlarini: fuqaroga tushuntirish, rasmiy suhbat, yig‘ilishda chiqish' },
    sales: { label: '🛒 Savdo va mijozlar', track: 'B', promise: 'savdo vaziyatlarini: mahsulotni tanishtirish, narx va shartlar haqida gaplashish, e’tirozga javob' },
    office: { label: '💻 Ofis va IT', track: 'B', promise: 'ish vaziyatlarini: ish suhbati, rahbarga hisobot, yig‘ilish va yozishma' },
    daily: { label: '🗣 Kundalik suhbat', track: 'B', promise: 'kundalik vaziyatlarni: tanishish, do‘kon, transport, telefonda gaplashish' },
    smena: { label: '🧱 Ish va smena', track: 'A', promise: 'ishdagi vaziyatlarni: brigadir bilan gaplashish, ish haqi va smena haqida so‘rash' },
    hujjat: { label: '📄 Hujjat va patent', track: 'A', promise: 'hujjat topshirish vaziyatlarini: o‘zingizni tanishtirish, savollarga javob berish (axborot uchun)' },
    kundalik: { label: '🏥 Shifokor, politsiya, transport', track: 'A', promise: 'kundalik vaziyatlarni: shifokorga shikoyat aytish, politsiya bilan xotirjam gaplashish, yo‘l so‘rash' }
};
const FIELD_CHOICES = { career: ['bank', 'med', 'gov', 'sales', 'office'], daily: ['daily'], russia: ['smena', 'hujjat', 'kundalik'], abroad: ['smena', 'kundalik'] };

// 1-dars mini-testi: o'zingizni tanishtirish (ism, yosh, ish). 1-dars videosi shu mavzuda yoziladi.
const QUIZ = [
    { q: '1/3. «Меня зовут Анвар» qanday tarjima qilinadi?',
      options: [['a', 'Mening ismim Anvar'], ['b', 'Men Anvarni chaqiraman'], ['c', 'Anvar meni chaqiradi']], correct: 'a',
      topic: 'Ismingizni aytish',
      hint: '«Меня зовут…» so‘zma-so‘z «meni chaqirishadi», lekin ma’nosi — «mening ismim…».' },
    { q: '2/3. «Men 30 yoshdaman» — qaysi biri to‘g‘ri?',
      options: [['a', 'Я 30 лет'], ['b', 'Мне 30 лет'], ['c', 'Меня 30 лет']], correct: 'b',
      topic: 'Yoshingizni aytish',
      hint: 'Rus tilida yosh «я» bilan emas, «мне» bilan aytiladi: «Мне 30 лет».' },
    { q: '3/3. «Men bankda ishlayman» — qaysi biri to‘g‘ri?',
      options: [['a', 'Я работаю в банке'], ['b', 'Я работаю банк'], ['c', 'Я работать в банке']], correct: 'a',
      topic: 'Qayerda ishlashingizni aytish',
      hint: 'Joy ma’nosida so‘z oxiri o‘zgaradi: «банк» → «в банке».' }
];

const KEYBOARD = { contact: '📞 Menejer bilan bog‘lanish', guides: '🎁 Qo‘llanmalar', faq: '❓ Savollar' };

const FAQ = {
    price: ['Narxi qancha?', 'Narx tarifga bog‘liq — jonli dars 15, 30 yoki 60 daqiqa. Menejerimiz sizga shaxsan yozib, aniq raqamni aytadi.'],
    plan: ['Kurs qanday o‘tadi?', '72 dars, taxminan 3 oy: video darslar + ustoz bilan jonli individual darslar + har kuni 20 daqiqa ilovada mashq. Yordamchi ustoz uy vazifangizni kuzatib boradi.'],
    try: ['Avval sinab ko‘rsam bo‘ladimi?', 'Ha. Menejer bilan gaplashgach, sizni ustoz bilan jonli sinov darsiga yozib qo‘yadi — darajangizni ko‘rasiz, ustoz bilan tanishasiz.'],
    time: ['Vaqtim yo‘q / smenada ishlayman', 'Kuniga 20–30 daqiqa yetadi. Jonli dars vaqtini o‘zingiz tanlaysiz — kechqurun va dam olish kunlari ham bo‘ladi. Video darslarni istalgan vaqtda ko‘rasiz.'],
    install: ['Bo‘lib to‘lash bormi?', 'Ha — O‘zbekistonda Uzum Nasiya va Paylater orqali. Shartlarini menejer tushuntiradi.'],
    russia: ['Rossiyadan qanday to‘layman?', 'Karta o‘tkazmasi orqali. Shartnoma tuziladi — to‘lov va majburiyatlar yozma ko‘rinishda.'],
    book: ['Kitob bormi?', 'O‘zbekistonda o‘qiyotganlarga bosma kitob uyiga yetkaziladi. Chet eldagilar uchun kitob mazmuni ilova va video darslarda — qo‘shimcha narsa kerak emas.'],
    missed: ['Darsni o‘tkazib yuborsam?', 'Jonli darsni ustoz bilan boshqa vaqtga ko‘chirasiz. Yordamchi ustoz eslatib turadi, dars yo‘qolmaydi.'],
    shy: ['Gapirishga uyalaman', 'Darslar individual — faqat siz va ustoz. Hech kim kulmaydi, hech kim shoshirmaydi. Xato qilish — o‘rganishning bir qismi.'],
    when: ['Qachon gapira boshlayman?', 'Birinchi jonli darsdanoq gapirasiz — darslar suhbat asosida. Qanchalik ravon gapirishingiz har kungi mashqqa bog‘liq.'],
    age: ['Yoshim katta, o‘rgana olamanmi?', 'O‘quvchilarimizning aksariyati 25 yoshdan katta. Individual darsda o‘z tezligingizda o‘rganasiz.'],
    before: ['Oldin o‘qiganman, natija bo‘lmadi', 'Bu safar guruh emas: shaxsiy ustoz, har kungi ilova mashqi va yordamchi ustoz nazorati. O‘quvchilarimiz natijalari — @domwork_natijalari kanalida.'],
    online: ['Onlayn haqiqatan ishlaydimi?', 'Ha — darslar Zoom orqali ustoz bilan yuzma-yuz. Shartnoma tuziladi. O‘quvchilarimiz fikrlari: @domwork_natijalari.'],
    free: ['Bu bepulmi?', 'Sovg‘a va 1-dars — sizga. Kursning o‘zi pullik va individual. Sizga mosligini menejer bilan gaplashib bilib olasiz — suhbat sizni hech narsaga majburlamaydi.'],
    career: ['Kareyeramga qanday yordam beradi?', 'Darslar ishdagi real vaziyatlar asosida: yig‘ilish, mijoz, ish suhbati, hujjat. Jonli darslar sohangizga moslashtiriladi.']
};
const FAQ_ORDER = { B: ['price', 'plan', 'try', 'install', 'time', 'career', 'book', 'missed', 'shy', 'when', 'age', 'before', 'online', 'free'],
    A: ['price', 'plan', 'try', 'russia', 'time', 'book', 'missed', 'shy', 'when', 'age', 'before', 'online', 'free'] };

const WHEN = { now: 'Hozir', eve: 'Bugun kechqurun', morn: 'Ertaga ertalab', aft: 'Ertaga tushdan keyin', wknd: 'Dam olish kuni' };

const text = {
    greeting: (name, landing) => landing
        ? `Assalomu alaykum, ${name}! Arizangiz qabul qilindi ✅\n\nDomwork — rus tilini shaxsiy ustoz bilan o‘rgatadigan onlayn maktab. Pastda tugmalar bor — istalgan payt menejer bilan bog‘lanishingiz mumkin.`
        : `Assalomu alaykum, ${name}! 👋\n\nDomwork — rus tilini shaxsiy ustoz bilan o‘rgatadigan onlayn maktab. Pastda tugmalar bor — istalgan payt menejer bilan bog‘lanishingiz mumkin.`,
    gift: 'Va’da qilingan sovg‘a — «40 ta eng kerakli gap» 🎁\nAudiosini tinglab, talaffuzni ham takrorlang.',
    giftNext: 'Endi rus tilida o‘zingizni tanishtirishni o‘rganamiz 👇',
    segment: 'Sizga mos materiallarni tanlashim uchun bitta savol: rus tili sizga nima uchun kerak?',
    field: 'Qaysi soha bo‘yicha qo‘llanma yuboray?',
    later: 'Keyinroq',
    promise: field => `Domworkda 3 oy davomida ustozingiz bilan ${field.promise}ni mashq qilasiz. Darslar sohangizga moslashtiriladi.`,
    guide: f => `${f.label} — qo‘llanma 📘\nPDF + talaffuz audiosi. Saqlab qo‘ying, ishda kerak bo‘ladi.`,
    lessonAsk: '1-darsni yuboraman 🎬\n\nDarsga mos qo‘llanmalar va eslatmalarni yuborishim uchun raqamingizni tasdiqlang — pastdagi tugmani bosing (raqam yozish shart emas).',
    contactButton: '📱 Raqamni tasdiqlash',
    cancel: 'Bekor qilish',
    lesson1: '«72 darsdan 1-dars»: rus tilida o‘zingizni tanishtirish — ism, yosh, ish.\n5–6 daqiqa. Ko‘rib bo‘lgach, pastdagi tugmani bosing 👇',
    lesson2: '1-darsning davomi 👇',
    lessonMore: '▶️ Davomini ko‘rish',
    lessonSeen: '✅ Ko‘rdim — testni boshlash',
    lessonWatch: '▶️ 1-darsni ko‘rish (5 daq)',
    lessonMissing: '1-dars tez orada shu yerga keladi. Hozircha menejerimiz sizga kurs qanday o‘tishini tushuntirib beradi 👇',
    quizIntro: 'Kichik test: 3 ta savol, 30 soniya ⏱',
    quizSummary(right, wrong) {
        if (!wrong.length) return 'Asoslar yaxshi! 🎉 3/3.\nYozuvda bilish va og‘zaki gapirish — ikki xil narsa. Og‘zaki gapirishni ustoz bilan jonli darsda mashq qilamiz.';
        if (!right.length) return 'Hech qisi yo‘q 🙂 Individual ustoz aynan shu uchun: noldan, sizning tezligingizda boshlaymiz.\n\nEng muhim qoida: ' + wrong[0].hint;
        return `✅ ${right.map(q => q.topic).join(', ')} — barakalla!\n\nBitta nozik joy: ${wrong[0].hint}\nKo‘pchilik shu yerda adashadi — shaxsiy ustoz bilan bu tez tuzaladi.`;
    },
    cta: (seg, discount) => `Keyingi qadam — menejerimiz bilan 5–10 daqiqalik suhbat.\n\nSuhbatdan keyin shu botga keladi: darajangiz, ${seg === 'A' ? 'ishingiz va hayotingiz' : 'sohangiz'} bo‘yicha 3 ta asosiy mavzu va haftasiga nechta jonli dars kerakligi. Xohlasangiz, ustoz bilan jonli sinov darsiga ham yozib qo‘yadi.`
        + (discount ? `\n\n🎁 Bot orqali kelganlar uchun ${discount.percent}% chegirma — ${discount.until}gacha.` : ''),
    ctaCall: '📞 Qo‘ng‘iroq qiling',
    ctaTelegram: '💬 Telegramda yozishaylik',
    ctaInfo: 'ℹ️ Batafsil',
    testimonial: url => `O‘quvchimiz fikri: ${url}`,
    callConfirm: masked => `Shu raqamga qo‘ng‘iroq qilaylikmi?\n${masked}`,
    yes: 'Ha',
    otherNumber: 'Boshqa raqam',
    callAsk: 'Qaysi raqamga qo‘ng‘iroq qilaylik? Pastdagi tugmani bosing.',
    whenAsk: 'Qachon qulay?',
    done: {
        nowIn: (min) => `Rahmat! Menejerimiz ${min} daqiqa ichida bog‘lanadi ✅`,
        later: (when) => `Rahmat! Menejerimiz ${when.toLowerCase()} bog‘lanadi ✅`,
        offHours: (from) => `Rahmat! Hozir ish vaqti tugagan — ertaga ${from} dan bog‘lanamiz ✅`,
        telegram: ' Shu chatga yozamiz.',
        andLesson: '\n\nUngacha 1-darsni ko‘rib qo‘ying 👇'
    },
    info: (company) => `Domwork — pullik individual onlayn kurs: 72 dars, taxminan 3 oy, shaxsiy ustoz, ilova va yordamchi ustoz.\n\nShartnoma tuziladi.${company ? '\n' + company : ''}\nO‘quvchilar fikrlari: @domwork_natijalari`,
    faqTitle: 'Savolingizni tanlang 👇',
    priceDone: 'Menejerimizga xabar berdim — tez orada shu yerda yoki telefonda aniq narxni aytadi.',
    freeText: (inHours, min) => inHours ? `Rahmat! Savolingizni menejerga yubordim — ${min} daqiqa ichida javob beradi.` : 'Rahmat! Savolingizni menejerga yubordim — ertalab birinchi bo‘lib javob beradi.',
    askManager: 'Savollaringiz bo‘lsa — menejerimiz 5–10 daqiqada hammasini tushuntiradi 👇',
    paused: 'Avtomatik xabarlar to‘xtatildi. Qaytish uchun /start bosing.',
    contactSaved: 'Rahmat, raqamingiz tasdiqlandi ✅'
};

module.exports = { SEGMENTS, LANDING_GOALS, FIELDS, FIELD_CHOICES, QUIZ, KEYBOARD, FAQ, FAQ_ORDER, WHEN, text };
