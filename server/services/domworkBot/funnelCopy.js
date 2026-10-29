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

// 30-okt: birinchi savol — qayerdasiz (aloqa usuli shunga bog'liq).
const LOCATIONS = { uz: '🇺🇿 O‘zbekistondaman', ru: '🇷🇺 Rossiyadaman', other: '🌍 Boshqa davlatdaman' };
// Rossiyadagilar uchun qisqa anketa — menejer qo'ng'iroqsiz, shu bot orqali yozadi (Rossiyada qo'ng'iroq ishlamaydi).
const RU_FORM = [
    ['city', '1/4. Rossiyaning qaysi shahridasiz?', [['msk', 'Moskva'], ['spb', 'Sankt-Peterburg'], ['other', 'Boshqa shahar']]],
    ['job', '2/4. Qanday ishda ishlaysiz?', [['build', '🧱 Qurilish / smena'], ['service', '🛒 Savdo, kafe, xizmat'], ['drive', '🚕 Haydovchi / kuryer'], ['other', 'Boshqa']]],
    ['level', '3/4. Rus tilini qanchalik bilasiz?', [['zero', 'Umuman bilmayman'], ['little', 'Ozgina tushunaman'], ['speak', 'Gapiraman, lekin xatolar ko‘p']]],
    ['when', '4/4. Menejer qachon yozsa qulay?', [['morn', 'Ertalab'], ['day', 'Tushdan keyin'], ['eve', 'Kechqurun'], ['wknd', 'Dam olish kuni']]]
];
const KEYBOARD = { contact: '📞 Menejer bilan bog‘lanish', guides: '🎁 Qo‘llanmalar', faq: '❓ Savollar' };

const FAQ = {
    price: ['Narxi qancha?', 'Narx tarifga bog‘liq — jonli dars 15, 30 yoki 60 daqiqa. Menejerimiz sizga shaxsan yozib, aniq raqamni aytadi.'],
    plan: ['Kurs qanday o‘tadi?', '72 dars, taxminan 3 oy:\n• haftada 3 kun — ustoz bilan jonli individual dars (Zoom);\n• haftada 3 kun — platformada video dars va topshiriqlar;\n• kun ora — yordamchi ustoz vazifalarni tekshiradi;\n• yakshanba — qo‘shimcha bonus video darslar;\n• har 12 darsdan keyin oraliq imtihon, oxirida sertifikat.\nGuruh darslari yo‘q — hammasi individual.'],
    start: ['Darslar qachon boshlanadi?', 'To‘lovdan keyin uzog‘i bilan 3 ish kuni ichida. Menejer ustoz va dars vaqtini siz bilan kelishadi.'],
    freeze: ['Kasal bo‘lsam yoki safarga ketsam?', 'Kursni muzlatib turish mumkin: 3 oy ichida 2 martagacha, har biri 14 kungacha. Darslar yo‘qolmaydi.'],
    refund: ['Natija bo‘lmasa-chi?', 'Shartnomada natija kafolati bor: barcha shartlarni bajarsangiz (jonli darslarning hammasiga qatnashish, video darslar va vazifalarni to‘liq bajarish, imtihonlarni topshirish), lekin muloqot natijasiga chiqmasangiz — tekshiruvdan so‘ng to‘langan pul to‘liq qaytariladi.\nO‘z xohishingiz bilan to‘xtatsangiz, pul qaytarilmaydi — buning o‘rniga kursni muzlatish mumkin.'],
    try: ['Avval sinab ko‘rsam bo‘ladimi?', 'Ha. Menejer bilan gaplashgach, sizni ustoz bilan jonli sinov darsiga yozib qo‘yadi — darajangizni ko‘rasiz, ustoz bilan tanishasiz.'],
    time: ['Vaqtim yo‘q / smenada ishlayman', 'Kuniga 20–30 daqiqa yetadi. Jonli dars vaqtini o‘zingiz tanlaysiz — kechqurun va dam olish kunlari ham bo‘ladi. Video darslarni istalgan vaqtda ko‘rasiz.'],
    install: ['Bo‘lib to‘lash bormi?', 'Ha — O‘zbekistonda Uzum Nasiya va Paylater orqali. Shartlarini menejer tushuntiradi.'],
    russia: ['Rossiyadan qanday to‘layman?', 'Karta o‘tkazmasi orqali. Shartnoma tuziladi — to‘lov va majburiyatlar yozma ko‘rinishda.'],
    book: ['Kitob bormi?', 'Ha — kurs bilan bosma kitoblar to‘plami sovg‘a qilinadi (300 ming so‘mlik). O‘zbekistonda eng yaqin BTS pochta punktiga yuboriladi, pochta xizmatini o‘zingiz to‘laysiz. Chet eldagilar uchun kitob mazmuni ilova va video darslarda.'],
    missed: ['Darsni o‘tkazib yuborsam?', 'Jonli darsni ustoz bilan boshqa vaqtga ko‘chirasiz. Yordamchi ustoz eslatib turadi, dars yo‘qolmaydi.'],
    shy: ['Gapirishga uyalaman', 'Darslar individual — faqat siz va ustoz. Hech kim kulmaydi, hech kim shoshirmaydi. Xato qilish — o‘rganishning bir qismi.'],
    when: ['Qachon gapira boshlayman?', 'Birinchi jonli darsdanoq gapirasiz — darslar suhbat asosida. Qanchalik ravon gapirishingiz har kungi mashqqa bog‘liq.'],
    age: ['Yoshim katta, o‘rgana olamanmi?', 'O‘quvchilarimizning aksariyati 25 yoshdan katta. Individual darsda o‘z tezligingizda o‘rganasiz.'],
    before: ['Oldin o‘qiganman, natija bo‘lmadi', 'Bu safar guruh emas: shaxsiy ustoz, har kungi ilova mashqi va yordamchi ustoz nazorati. O‘quvchilarimiz natijalari — @domwork_natijalari kanalida.'],
    online: ['Onlayn haqiqatan ishlaydimi?', 'Ha — darslar Zoom orqali ustoz bilan yuzma-yuz. Shartnoma tuziladi. O‘quvchilarimiz fikrlari: @domwork_natijalari.'],
    free: ['Bu bepulmi?', 'Sovg‘a va 1-dars — sizga. Kursning o‘zi pullik va individual. Sizga mosligini menejer bilan gaplashib bilib olasiz — suhbat sizni hech narsaga majburlamaydi.'],
    career: ['Kareyeramga qanday yordam beradi?', 'Darslar ishdagi real vaziyatlar asosida: yig‘ilish, mijoz, ish suhbati, hujjat. Jonli darslar sohangizga moslashtiriladi.']
};
const FAQ_ORDER = { B: ['price', 'plan', 'try', 'install', 'refund', 'start', 'time', 'career', 'book', 'missed', 'freeze', 'shy', 'when', 'age', 'before', 'online', 'free'],
    A: ['price', 'plan', 'try', 'russia', 'refund', 'start', 'time', 'book', 'missed', 'freeze', 'shy', 'when', 'age', 'before', 'online', 'free'] };

const WHEN = { now: 'Hozir', eve: 'Bugun kechqurun', morn: 'Ertaga ertalab', aft: 'Ertaga tushdan keyin', wknd: 'Dam olish kuni' };

const text = {
    greeting: (name, landing) => landing
        ? `Assalomu alaykum, <b>${name}</b>! 👋\nArizangiz qabul qilindi ✅\n\n<b>Domwork</b> — rus tilini <b>shaxsiy ustoz bilan</b> o‘rgatadigan onlayn maktab. Guruh yo‘q, shoshilish yo‘q — faqat siz va ustozingiz.\n\nVa’da qilingan sovg‘a 👇`
        : `Assalomu alaykum, <b>${name}</b>! 👋\nDomwork botiga xush kelibsiz.\n\n<b>Domwork</b> — rus tilini <b>shaxsiy ustoz bilan</b> o‘rgatadigan onlayn maktab. Bu yerda foydali qo‘llanmalar bor, savollaringizga esa menejerimiz javob beradi.\n\nBirinchi sovg‘angiz 👇`,
    gift: '🎁 <b>«40 ta eng kerakli gap»</b>\n\nSalomlashish, tanishuv, do‘kon, transport, telefon — har bir gapning o‘qilishi va tarjimasi bilan.\n\n💡 Kuniga 5 tasini ovoz chiqarib ayting — bir haftada 40 tasi ham tilingizda bo‘ladi.',
    location: 'Sizga mos materiallarni yuborishim uchun 👇\n\n<b>Hozir qayerda yashaysiz?</b>',
    goalUz: '<b>Rus tili sizga nima uchun kerak?</b>',
    ruNote: '🇷🇺 Tushunarli! Rossiyaga qo‘ng‘iroqlar ko‘pincha ulanmaydi — shuning uchun menejerimiz siz bilan <b>shu yerda, Telegramda</b> yozishadi. Telefon raqam shart emas.\n\nMenejer sizga mos reja tuzishi uchun 4 ta qisqa savol 👇',
    abroadNote: '🌍 Tushunarli! Menejerimiz siz bilan <b>shu yerda, Telegramda</b> yozishadi — qo‘ng‘iroqsiz, sizga qulay vaqtda.',
    ruDone: when => `Rahmat! ✅ Ma’lumotlaringiz menejerga yuborildi.\n\n👩‍💼 Menejerimiz <b>${when}</b> shu chatga yozadi: darajangiz, sizga mos jonli dars vaqti va kurs qanday o‘tishini tushuntiradi.\n\nUngacha sohangizga mos qo‘llanmani oling 👇`,
    matchAsk: 'Arizangizni topib, menejeringizni ulab qo‘yishim uchun raqamingizni tasdiqlang — pastdagi tugmani bosing (yozish shart emas) 👇',
    matched: manager => `Rahmat, arizangiz topildi ✅${manager ? `\nMenejeringiz — ${manager}. U siz bilan bog‘lanadi, savollaringizni shu yerga ham yozishingiz mumkin.` : '\nMenejerimiz tez orada bog‘lanadi.'}`,
    matchAskRu: 'Formadagi arizangiz bilan bog‘lab qo‘yishim uchun raqamni bir bosishda tasdiqlang (ixtiyoriy) — yoki «Keyinroq»ni bosing, savollarga o‘tamiz 👇',
    matchNew: 'Rahmat, raqamingiz saqlandi ✅ Menejerimiz siz bilan bog‘lanadi.',
    giftNext: 'Endi rus tilida o‘zingizni tanishtirishni o‘rganamiz 👇',
    segment: '<b>Rus tili sizga nima uchun kerak?</b>',
    field: '<b>Qaysi soha bo‘yicha qo‘llanma yuboray?</b>\nIshda eng ko‘p kerak bo‘ladigan iboralar va namuna dialoglar bilan 📘',
    later: 'Keyinroq',
    promise: field => `🎯 Domworkda 3 oy davomida ustozingiz bilan aynan <b>${field.promise}</b>ni mashq qilasiz — darslar sohangizga moslashtiriladi.`,
    guide: f => `${f.label} — <b>qo‘llanma</b> 📘\n\nIboralar o‘qilishi va tarjimasi bilan, 2 ta namuna dialog. Saqlab qo‘ying — kerak bo‘ladi.`,
    lessonAsk: '1-darsni yuboraman 🎬\n\nDarsga mos qo‘llanmalar va eslatmalarni yuborishim uchun raqamingizni tasdiqlang — pastdagi tugmani bosing (raqam yozish shart emas).',
    contactButton: '📱 Raqamni tasdiqlash',
    cancel: 'Bekor qilish',
    lesson1: '«72 darsdan 1-dars»: rus tilida o‘zingizni tanishtirish — ism, yosh, ish.\n5–6 daqiqa. Ko‘rib bo‘lgach, pastdagi tugmani bosing 👇',
    lesson2: '1-darsning davomi 👇',
    lessonMore: '▶️ Davomini ko‘rish',
    lessonSeen: '✅ Ko‘rdim — testni boshlash',
    lessonWatch: '▶️ 1-darsni ko‘rish (5 daq)',
    lessonMissing: '🎬 1-dars videosi tayyorlanmoqda — tayyor bo‘lishi bilan shu yerga yuboraman. Hozircha menejerimiz kurs qanday o‘tishini 5 daqiqada tushuntirib beradi 👇',
    quizIntro: 'Kichik test: 3 ta savol, 30 soniya ⏱',
    quizSummary(right, wrong) {
        if (!wrong.length) return 'Asoslar yaxshi! 🎉 3/3.\nYozuvda bilish va og‘zaki gapirish — ikki xil narsa. Og‘zaki gapirishni ustoz bilan jonli darsda mashq qilamiz.';
        if (!right.length) return 'Hech qisi yo‘q 🙂 Individual ustoz aynan shu uchun: noldan, sizning tezligingizda boshlaymiz.\n\nEng muhim qoida: ' + wrong[0].hint;
        return `✅ ${right.map(q => q.topic).join(', ')} — barakalla!\n\nBitta nozik joy: ${wrong[0].hint}\nKo‘pchilik shu yerda adashadi — shaxsiy ustoz bilan bu tez tuzaladi.`;
    },
    cta: (seg, discount) => `📞 <b>Keyingi qadam — menejer bilan ${seg === 'A' ? 'qisqa yozishma (shu yerda, Telegramda)' : '5–10 daqiqalik suhbat'}</b>\n\nBilib olasiz:\n• darajangiz qanday;\n• ${seg === 'A' ? 'ishingiz va hayotingiz' : 'sohangiz'} bo‘yicha qaysi 3 mavzudan boshlash kerak;\n• haftasiga nechta jonli dars sizga mos.\n\nXohlasangiz, ustoz bilan <b>jonli sinov darsi</b>ga ham yozib qo‘yamiz. Suhbat sizni hech narsaga majburlamaydi.`
        + (discount ? `\n\n🎁 <b>Bot orqali kelganlar uchun ${discount.percent}% chegirma</b> — ${discount.until} gacha.` : ''),
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
    info: (company) => `Domwork — pullik individual onlayn kurs: 72 dars, taxminan 3 oy, shaxsiy ustoz, ilova va yordamchi ustoz.\n\n📄 Ommaviy oferta shartnomasi asosida ishlaymiz: darslar to‘lovdan keyin 3 ish kunida boshlanadi, kursni 2 martagacha muzlatish mumkin, shartnomada natija kafolati bor.\n🏢 ${company || '“Homework” MCHJ — “Domwork” ta’lim loyihasi. To‘lov: Click / Payme («Homework»), bo‘lib to‘lash — Uzum Nasiya, PayLater.'}\n⭐ O‘quvchilar natijalari: @domwork_natijalari`,
    faqTitle: 'Savolingizni tanlang 👇',
    priceDone: 'Menejerimizga xabar berdim — tez orada shu yerda yoki telefonda aniq narxni aytadi.',
    freeText: (inHours, min) => inHours ? `Rahmat! Savolingizni menejerga yubordim — ${min} daqiqa ichida javob beradi.` : 'Rahmat! Savolingizni menejerga yubordim — ertalab birinchi bo‘lib javob beradi.',
    askManager: 'Savollaringiz bo‘lsa — menejerimiz 5–10 daqiqada hammasini tushuntiradi 👇',
    paused: 'Avtomatik xabarlar to‘xtatildi. Qaytish uchun /start bosing.',
    contactSaved: 'Rahmat, raqamingiz tasdiqlandi ✅',
    commandHint: 'Pastdagi tugmalardan foydalaning 👇 Savolingiz bo‘lsa — oddiy matn bilan yozing, menejer javob beradi.',
    afterGuide: t => t === 'A'
        ? 'Qo‘llanma foydali bo‘ldimi? 🙂\nSizga mos reja kerak bo‘lsa — menejerimiz shu yerda, Telegramda yozadi: darajangiz va qaysi vaqtda dars qilish qulayligini aniqlaymiz.'
        : 'Qo‘llanma foydali bo‘ldimi? 🙂\nKeyingi qadam — menejer bilan 5–10 daqiqa: darajangizni bilib olasiz va sizga mos reja tuziladi. Hech narsaga majburlamaydi.'
};

// ── Isitish (drip) — so'rov qoldirmaganlar; hujjatdagi jadval bo'yicha ──
const PHRASES = {
    meeting: ['Yig‘ilishda kerak 5 ibora 🗣', [['Можно вопрос?', 'Savol bersam bo‘ladimi?'], ['Я согласен. / Я не согласен.', 'Qo‘shilaman. / Qo‘shilmayman.'],
        ['Давайте уточним.', 'Keling, aniqlashtiraylik.'], ['Я подготовлю отчёт.', 'Hisobot tayyorlayman.'], ['Когда дедлайн?', 'Muddat qachon?']]],
    smena: ['Smenada kerak 5 gap 🧱', [['Где мне работать сегодня?', 'Bugun qayerda ishlayman?'], ['Сколько часов смена?', 'Smena necha soat?'],
        ['Когда будет зарплата?', 'Maosh qachon bo‘ladi?'], ['Мне нужен выходной.', 'Menga dam olish kuni kerak.'], ['Повторите, пожалуйста, медленнее.', 'Iltimos, sekinroq takrorlang.']]]
};
// Haftalik "hafta iborasi" (10-kundan keyin) — har biri kundalik/ish uchun foydali.
const WEEKLY = [
    ['Как дела на работе?', 'Ishlaring qalay?', 'Hamkasb bilan suhbatni boshlashning eng oson yo‘li.'],
    ['Извините, я не понял.', 'Kechirasiz, tushunmadim.', 'Uyalmang — bu gap suhbatni to‘xtatmaydi, aksincha davom ettiradi.'],
    ['Можно по-медленнее?', 'Sekinroq gapira olasizmi?', 'Telefonda ham, yuzma-yuz ham ishlaydi.'],
    ['Я перезвоню вам позже.', 'Sizga keyinroq qo‘ng‘iroq qilaman.', 'Ishda eng ko‘p ishlatiladigan iboralardan biri.'],
    ['Сколько это стоит?', 'Bu qancha turadi?', 'Do‘konda, bozorda, xizmatda.'],
    ['Мне нужна помощь.', 'Menga yordam kerak.', 'Shifokorda, idorada, ko‘chada.'],
    ['Я живу в Ташкенте.', 'Men Toshkentda yashayman.', '«в Ташкенте» — joy ma’nosida so‘z oxiri o‘zgaradi.'],
    ['Спасибо за помощь!', 'Yordamingiz uchun rahmat!', 'Har qanday suhbatni chiroyli yakunlaydi.']
];
// Oylik iboralar (haftaliklardan farqli).
const MONTHLY = [
    ['Давайте договоримся.', 'Keling, kelishib olaylik.', 'Ishda ham, kundalik hayotda ham kelishuvni boshlaydi.'],
    ['Я в этом разбираюсь.', 'Men bu ishni yaxshi bilaman.', 'Ish suhbatida tajribangizni ta’kidlash uchun.'],
    ['Можно записаться на приём?', 'Qabulga yozilsam bo‘ladimi?', 'Shifokor, idora, xizmat — hamma joyda kerak.']
];
const POLL = { speak: ['🗣 Gapirish', 'Gapirish — eng ko‘p uchraydigan to‘siq. Sababi oddiy: mashq qiladigan suhbatdosh yo‘q. Jonli individual darsda har darsda gapirasiz, ustoz xatoni darhol tuzatadi.'],
    listen: ['👂 Tushunish', 'Tez gapirilgan nutqni tushunish — quloq mashqi. Video darslar va ilovadagi audiolar shu uchun: har kuni 10 daqiqa tinglash bir oyda sezilarli farq beradi.'],
    grammar: ['📐 Grammatika', 'Grammatikani jadval bilan emas, gap ichida o‘rganamiz: har darsda bitta qoida va uni darhol suhbatda ishlatasiz.'],
    words: ['📚 So‘z boyligi', 'So‘zlarni ro‘yxatdan emas, vaziyatdan o‘rganish tezroq: ilovadagi o‘yinlar va sohangizga mos iboralar shu uchun.'] };

const drip = {
    lessonNudge: name => `${name}, 1-dars atigi 5 daqiqa: ish suhbatida o‘zingizni tanishtirishni o‘rganasiz 👇`,
    phrases: key => { const [title, list] = PHRASES[key]; return `${title}\n\n${list.map(([ru, uz], i) => `${i + 1}. ${ru}\n   ${uz}`).join('\n')}\n\nOvoz chiqarib 2 marta ayting — shunda esda qoladi.`; },
    testimonial: url => `O‘quvchimiz natijasi 👇${url ? '\n' + url : ''}\n\nBoshqa natijalar: @domwork_natijalari`,
    bonus: channel => `🎁 Bonus: «Ishda kerak 50 ibora» qo‘llanmasi — yig‘ilish, rahbar, mijoz, telefon.\nOlish uchun ${channel} kanaliga obuna bo‘ling, keyin «Obuna bo‘ldim»ni bosing.`,
    bonusJoin: '📢 Kanalga o‘tish',
    bonusCheck: '✅ Obuna bo‘ldim',
    bonusOk: 'Rahmat! Mana bonus 🎁',
    bonusNo: 'Hali obuna ko‘rinmayapti. Kanalga obuna bo‘lib, qayta bosing.',
    bonusFail: 'Hozir tekshirib bo‘lmadi — birozdan keyin qayta bosing.',
    poll: 'Rus tilida siz uchun eng qiyini qaysi?',
    lessonHow: 'Dars qanday o‘tadi?\n\n1) Video dars — yangi mavzu, 15–20 daqiqa, istalgan vaqtda.\n2) Jonli dars — ustoz bilan yuzma-yuz (Zoom), shu mavzuni gapirib mashq qilasiz.\n3) Ilova — har kuni 20 daqiqa: so‘zlar, o‘yinlar, AI bilan suhbat.\n4) Yordamchi ustoz — vazifalaringizni kuzatib, eslatib turadi.',
    whereB: 'Ishda rus tili kerak bo‘ladigan 3 vaziyat:\n\n1) Rusiyzabon mijoz keldi — «Чем могу помочь?» (Qanday yordam bera olaman?)\n2) Yig‘ilishda rahbar ruscha so‘radi — «Можно уточнить?» (Aniqlashtirsam bo‘ladimi?)\n3) Ish suhbati ruscha boshlandi — «Меня зовут…, я работаю…»\n\nShu vaziyatlarni ustoz bilan jonli darsda mashq qilasiz.',
    whereA: 'Rossiyada rus tili bilan nima o‘zgaradi — 3 vaziyat:\n\n1) Brigadir bilan maosh haqida — «Когда будет зарплата?»\n2) Shifokorda — «У меня болит…» (… og‘riyapti)\n3) Hujjat topshirganda — «Меня зовут…, я из Узбекистана»\n\nSmenadan keyin ham o‘qiysiz — jonli dars vaqtini o‘zingiz tanlaysiz.',
    discount: (percent, until) => `🎁 Eslatma: bot orqali kelganlar uchun ${percent}% chegirma — ${until}gacha.\nShartlarini menejerimiz 5–10 daqiqada tushuntiradi.`,
    goodbye: 'Sizni ko‘p bezovta qilmaymiz 🙂 Endi haftada bir marta bitta foydali ibora yuboramiz.\nTo‘xtatish uchun — /stop',
    weekly: ([ru, uz, note]) => `📌 Hafta iborasi\n\n${ru}\n${uz}\n\n${note}`,
    reactivate: 'Foydali iboralarni oyiga bir marta yuborishda davom etaylikmi?',
    reactYes: 'Ha, oyiga bir marta', reactNo: 'Yo‘q, rahmat',
    reactBye: 'Tushunarli, boshqa yubormaymiz. Kerak bo‘lsa — /start bosing 👋',
    // Menejer bilan gaplashgandan keyin (rad sababi bo'yicha)
    priceB: 'Kurs narxini qulay qilishning ikki yo‘li bor:\n• Bo‘lib to‘lash — Uzum Nasiya va Paylater orqali, oyma-oy.\n• Bot orqali kelganlar uchun chegirma.\n\nKursga nima kiradi: shaxsiy ustoz bilan jonli darslar, 72 dars, ilova, bosma kitob, yordamchi ustoz nazorati.',
    priceA: 'To‘lov — karta o‘tkazmasi orqali, shartnoma bilan.\n\nKursga nima kiradi: shaxsiy ustoz bilan jonli darslar, 72 dars, ilova (so‘zlar, o‘yinlar, AI suhbat), yordamchi ustoz nazorati.',
    timePlan: 'Vaqt kam bo‘lsa — kuniga 15–20 daqiqalik reja:\n• Ertalab 5 daqiqa: ilovada so‘zlar\n• Tushlikda 5 daqiqa: video darsning bir qismi\n• Kechqurun 10 daqiqa: mashq\n\nJonli dars — haftasiga o‘zingiz tanlagan vaqtda.',
    timeEvening: 'Jonli darslar kechqurun va dam olish kunlari ham bo‘ladi — ish jadvalingizga moslab tanlaysiz.',
    think: 'Savollaringiz qoldimi? Menejerimiz qisqa javob beradi — hech narsaga majbur qilmaydi.',
    noAnswer: name => `${name} sizga qo‘ng‘iroq qildi, lekin ulanmadi. Qachon qulay?`
};

module.exports = { LOCATIONS, RU_FORM, PHRASES, WEEKLY, MONTHLY, POLL, drip, SEGMENTS, LANDING_GOALS, FIELDS, FIELD_CHOICES, QUIZ, KEYBOARD, FAQ, FAQ_ORDER, WHEN, text };
