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
    'Bugun kimdir aynan sizning qo‘ng‘irog‘ingizni kutyapti. Uni topamiz! 🔎',
    "Bugun “yo‘q” deganlar soni emas, “ha” deganlar soni muhim. Ularni topguncha qo‘ng‘iroq qilamiz! 📞",
    "Sotuvda sehr yo‘q — tizim, intizom va samimiyat bor. Uchalasi ham bugun biz bilan 💼",
    "Har bir mijozga birinchi qo‘ng‘iroqdek, har bir kunga birinchi ish kunidek yondashamiz 🌅",
    "Siz bugun gaplashadigan odamlardan biri bir yildan keyin ruscha erkin gapiradi. Bunga sizning hissangiz bor 🙌",
    "Rejani bajarish — marafon. Bugun yana bir necha kilometr yuguramiz 🏃‍♂️",
    "Mijozni ishontirish uchun avval o‘zingiz ishoning. Domwork — haqiqatan kuchli kurs 💪",
    "Ertalabki birinchi soat — eng samarali soat. Eng qiyin qo‘ng‘iroqlarni hozir qilamiz 🧠",
    "Kuchli sotuvchi narx haqida emas, natija haqida gapiradi. Bugun natijani ko‘rsatamiz 🎯",
    "Har “keyinroq” — bu eslatma qo‘yish uchun sabab. CRMdagi eslatmalarni tekshiramiz 🔔",
    "Bir kun — bir kichik g‘alaba. Bugungi g‘alabamiz qanday bo‘ladi? 🏅",
    "Odamlar biz bilan ishlashni xohlashadi, agar bizga ishonishsa. Ishonch — har qo‘ng‘iroqda quriladi 🧱",
    "Bugun o‘tgan haftadagi eng yaxshi kunimizdan yaxshiroq bo‘lsin! 📈",
    "Professional — bu kayfiyat bo‘lmaganda ham natija beradigan odam. Biz professionalmiz 😎",
    "Mijoz qo‘rqadi: vaqt ketadi, pul ketadi, natija bo‘lmaydi. Biz bu qo‘rquvlarga javob beramiz ✅",
    "Eng yaxshi reklama — mamnun o‘quvchi. Bugun yangi mamnun o‘quvchilar topamiz 😊",
    "Sinov darsiga yozilgan har bir odam — 50% sotuv. Ularni yaxshi kuzatamiz 🧪",
    "Tayyorgarlik — sotuvning yarmi. Skriptni bir ko‘zdan kechirib, keyin boshlaymiz 📋",
    "Bugun har bir suhbatdan bitta yangi narsa o‘rganamiz — ertaga undan foydalanamiz 📚",
    "Biz uchun eng qadrli resurs — vaqt. Bugun uni qo‘ng‘iroqlarga sarflaymiz ⏳",
    "Muvaffaqiyatli kunni ertalab rejalashtiriladi: bugun kimga qo‘ng‘iroq qilasiz? 🗒",
    "Qiyinchilik — sotuvchini kuchaytiradi. Bugun yana bir oz kuchliroq bo‘lamiz 🏋️",
    "Mijozning ismini aytib murojaat qiling — bu kichik detal, lekin katta ta’sir 🤝",
    "Har bir to‘lov — bizga bildirilgan ishonch. Ishonchni oqlaymiz 🙏",
    "Bugun ham “bir qo‘ng‘iroq ko‘proq” qoidasi amalda! ☎️",
    "Sotuv — bu yordam berish. Biz odamlarga til o‘rganishda yordam beramiz 🌍",
    "Kayfiyat yuqumli bo‘ladi. Bugun yaxshi kayfiyatni mijozlarga yuqtiramiz 😄",
    "Kichik qadamlarni mensimang: bitta qo‘ng‘iroq — bitta sinov — bitta o‘quvchi 👣",
    "Rejaning har 1% — kimningdir yangi boshlanishi. Hisobni ochamiz! 📊",
    "Bugun “o‘ylab ko‘raman” deganlarga yangi sabab topamiz — chegirma emas, natija 💡",
    "Ertalabki choy tayyor bo‘lsa, demak, birinchi qo‘ng‘iroq ham tayyor ☕️📞",
    "Siz jamoaning yuragisiz — sotuv bo‘lmasa, kurs ham bo‘lmaydi. Rahmat sizga! ❤️",
    "Har kim o‘z rekordini yangilasin — boshqalar bilan emas, kechagi o‘zingiz bilan musobaqa 🥇",
    "Mijoz bilan bahslashmang — uni tushuning. Tushunilgan mijoz sotib oladi 👂",
    "Bugun hech bo‘lmaganda bitta eski lidni tiriltiramiz. Ular hali ham kutyapti! 🔄",
    "Natija bir kunda kelmaydi, lekin har kuni yaqinlashadi. Davom etamiz 🚶‍♀️",
    "Qo‘ng‘iroqdan oldin chuqur nafas oling, jilmaying va boshlang 😌📞",
    "Siz sotayotgan narsa — yangi ish, yuqori maosh, ishonch. Bu juda qimmatli! 💎",
    "Bugungi maqsad: har bir mijoz suhbatdan keyin o‘zini yaxshiroq his qilsin 🌟",
    "Eng ko‘p sotadiganlar — eng ko‘p so‘raydiganlar. Savol bering, ehtiyojni toping 🔍",
    "Ertaga emas — bugun. Keyinroq emas — hozir. Ketdik! 🚀"
];
const EVENING = [
    '🔥 <b>Soat 18:00 — kunning eng qaynoq nuqtasi boshlandi!</b>\n\nOdamlar ishdan qaytdi, telefonga qarayapti, gaplashishga vaqti bor. Hozir har bir qo‘ng‘iroq kunduzgidan ikki barobar qimmat 📞\n\nBo‘shashmaymiz, jamoa! 💪',
    '⏰ <b>18:00 — oltin soatlar!</b>\n\nKunduzi “band edim” deganlarning hammasi hozir bo‘sh. Lidlar ro‘yxatini oching — bugungi rejani shu soatlarda yopamiz 🎯',
    '🚀 <b>Kechki marafon start oldi!</b>\n\nKun davomida qilgan mehnatimiz hozir hosil beradi. Qayta qo‘ng‘iroqlar, “o‘ylab ko‘raman”lar — hammasini hozir eslaymiz 🔔',
    '🌆 <b>Kech kirdi — sotuv vaqti!</b>\n\nEng ko‘p sotuv aynan 18:00–21:00 oralig‘ida yopiladi. Choy qo‘yib, naushnikni taqib, boshladik ☕️🎧',
    '💥 <b>Qaynoq soat boshlandi!</b>\n\nKim bugun hali sotuv qilmagan bo‘lsa — imkoniyat hozir. Kim qilgan bo‘lsa — yana bittasi uchun vaqt bor 😉',
    '🔥 <b>18:00! Hamma joyida?</b>\n\nHozir lidlar javob beradigan vaqt. Har bir “alo” — yangi imkoniyat. Ketdik, jamoa! 📞📞📞',
    '⚡️ <b>Kunning ikkinchi nafasi!</b>\n\nCharchoq — vaqtincha, natija — doimiy. Oxirgi 3 soatni eng kuchli soatga aylantiramiz 💪',
    '🎯 <b>Kechki fokus vaqti</b>\n\nTelegram, ijtimoiy tarmoqlar — keyin. Hozir faqat mijoz va qo‘ng‘iroq. 3 soat to‘liq diqqat = kunlik reja ✅',
    "🔥 <b>18:00 — start!</b>\n\nKunduzgi mehnat — urug‘, kechki soatlar — hosil. Hozir yig‘ib olish vaqti 🌾",
    "📞 <b>Kechki qo‘ng‘iroqlar soati</b>\n\nMijozlar uyda, xotirjam, o‘ylashga vaqti bor. Ular bilan samimiy gaplashamiz 🏠",
    "🏁 <b>Oxirgi to‘g‘ri chiziq!</b>\n\nKunning oxirgi 3 soati butun kunning natijasini hal qiladi. Tezlikni oshiramiz! 💨",
    "🌙 <b>Kechki smena — kuchli smena!</b>\n\n“Ishdan keyin qo‘ng‘iroq qiling” deganlarning vaqti keldi. Ro‘yxatni ochamiz 📋",
    "💪 <b>Charchadingizmi? Bu yaxshi belgi!</b>\n\nDemak, kun bekor ketmadi. Endi oxirgi kuchni eng muhim qo‘ng‘iroqlarga sarflaymiz 🔋",
    "🎯 <b>18:00 — maqsad aniq!</b>\n\nBugungi rejaga qancha qoldi? Shuni bilib, har bir qo‘ng‘iroqni shu maqsadga yo‘naltiramiz 📈",
    "⏳ <b>Kun tugashiga 3 soat bor</b>\n\nKim bugun birinchi sotuvni qilsa — o‘sha kun qahramoni bo‘ladi! 🏆",
    "☕️ <b>Choy, naushnik, ro‘yxat — tayyor?</b>\n\nKechki marafonga start beramiz! Eng yaxshi natijalar aynan hozir yoziladi ✍️",
    "🚀 <b>Raketa uchmoqda!</b>\n\nSotuvning eng faol vaqti — hozir. Har bir menejer kamida 10 ta sifatli qo‘ng‘iroq! 📞",
    "🔔 <b>“O‘ylab ko‘raman” deganlarni eslang!</b>\n\nUlar o‘ylab bo‘lishdi. Endi javob eshitish vaqti 😉",
    "🌆 <b>Shahar uyga qaytdi — biz ishdamiz!</b>\n\nMijozlar telefonini qo‘lga oldi. Bizning qo‘ng‘iroq ularni kutmoqda 📱",
    "⚡️ <b>Energiya rejimi: MAKSIMUM</b>\n\nKechki 3 soat = ertalabki 6 soat. Bu matematikadan foydalanamiz 🧮",
    "🏆 <b>Bugungi chempion hali aniqlanmadi!</b>\n\nKim bo‘ladi? Javob keyingi 3 soat ichida 🔥",
    "📈 <b>Grafik yuqoriga qarab!</b>\n\nKechki soatlarda konversiya eng yuqori. Har bir lid — imkoniyat, har bir imkoniyat — natija 💼",
    "🤝 <b>Jamoa, birga kuchlimiz!</b>\n\nKimdadir qiyin mijoz bo‘lsa — hamkasbdan maslahat so‘rang. Bugun hammamiz g‘alaba qilamiz! 💪",
    "🔥 <b>Issiq lidlar — issiq soatda!</b>\n\nSinovdan o‘tganlar, qiziqqanlar, “narxni yuboring” deganlar — hammasiga hozir qo‘ng‘iroq 📞",
    "🌟 <b>Kechki 18:00 — yulduzlar vaqti</b>\n\nHar kuni kimdir yulduzga aylanadi. Bugun siz bo‘lishingiz mumkin ✨",
    "🧭 <b>Yo‘nalish: reja!</b>\n\nOy rejasi kunlik qadamlardan iborat. Bugungi qadamni to‘liq bosamiz 👣",
    "💡 <b>Kechki maslahat</b>\n\nCharchoqni ovozingizda bildirmang — jilmayib gapiring. Mijoz energiyani sezadi 😊📞",
    "🎉 <b>Oxirgi soatlar — eng shirin soatlar!</b>\n\nKun yakunida “bugun yaxshi ishladim” deyish uchun hozir harakat qilamiz 💪",
    "📣 <b>Diqqat, jamoa!</b>\n\nHozirdan 21:00 gacha — eng ko‘p sotuv yopiladigan vaqt. Telefonlar tayyor! 📱🔥",
    "🥇 <b>Kim birinchi?</b>\n\nKechki soatdagi birinchi sotuv uchun guruhda alohida tabrik! Boshladik 🚀"
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
    '“Ertaga qo‘ng‘iroq qiling” degan mijozga ertaga qo‘ng‘iroq qilish — bu sotuvdagi eng kam uchraydigan sehr ✨😄',
    "Menejer mijozga: “Kursimizdan keyin ruscha tush ko‘rasiz!”\nMijoz: “Hozir ham ko‘raman, lekin tarjimasiz tushunmayman” 😄",
    "— Ishingiz qiyinmi?\n— Yo‘q, faqat 100 ta odamni 1 ta “ha” degan so‘zga ishontirish kerak 😅",
    "Menejerning telefoni shunchalik ko‘p jiringlaydiki, uyda ham eshik qo‘ng‘irog‘iga “Domwork, eshitaman!” deb javob beradi 😂",
    "Mijoz: “Men juda bandman.”\nMenejer: “Ajoyib! Darslar 15 daqiqa — hatto bandlar ham ulguradi” ⏱😄",
    "O‘quvchi: “Ustoz, ruscha ‘nichego’ nima degani?”\nUstoz: “Bu ‘hech narsa’ degani.”\nO‘quvchi: “Unda nega hamma uni har gapda ishlatadi?” 😄",
    "Sotuv bo‘limidagi eng mashhur sport turi — “qo‘ng‘iroqqa yugurish” 🏃‍♀️📞",
    "Menejer 3 soat gaplashib, mijozni ko‘ndiribdi. Oxirida mijoz: “Shuni boshidan aytmaysizmi?” 😂",
    "Ofisdagi sukunat ikki xil bo‘ladi: hamma ishlayapti yoki ROP xonaga kirdi 😄",
    "Mijoz: “Sizlarda chegirma bormi?”\nMenejer: “Bor — bugun yozilsangiz, ertangi kunni yo‘qotmaysiz!” 😉",
    "Ustoz o‘quvchiga: “Ruschada 6 ta kelishik bor.”\nO‘quvchi: “Bizda 6 ta kelishik, menda 6 ta bahona” 😂",
    "Sotuvchi tushida reja bajarilganini ko‘ribdi. Uyg‘onib qarasa — hali oy boshi ekan 😴📅",
    "Mijoz: “Men o‘ylab ko‘rib, o‘zim qo‘ng‘iroq qilaman.”\nMenejer ichida: “Bu gapni 2019-yildan beri kutyapman” 😅",
    "Eng tez o‘sadigan narsa — bu menejerning “keyinroq qo‘ng‘iroq qilish” ro‘yxati 📈😄",
    "Domworkdagi eng qisqa dars — 15 daqiqa. Eng uzun suhbat — menejer va “o‘ylab ko‘raman” degan mijoz o‘rtasida 😂",
    "Migrant o‘quvchi: “Ustoz, politsiya to‘xtatdi, ruscha gapirdim — hayron qolib, qo‘yib yubordi!” 😄🚓",
    "Menejerdan so‘rashibdi: “Hayotdagi eng katta qo‘rquvingiz?”\n— “Telefon zaryadi 1% bo‘lib, mijoz ‘ha’ deyishga tayyor turgani” 🔋😱",
    "ROP: “Bugun nechta sotuv?”\nMenejer: “Hali kun tugamadi!”\nSoat: 20:55 😅",
    "O‘quvchi: “Ustoz, ruscha ‘da net’ nima degani?”\nUstoz: “Ha, yo‘q.”\nO‘quvchi: “Mijozlar aynan shunday javob beradi-ku!” 😂",
    "Sotuvchining kalendari: Dushanba — reja. Seshanba — reja. Chorshanba — reja. Payshanba — “reja qayerda?!” 😄",
    "Mijoz: “Qancha turadi?”\nMenejer: “Siz hozir bilimga qancha vaqt sarflamoqchisiz?”\nMijoz: “Savolimga savol bilan javob beryapsiz-ku!”\nMenejer: “Bu ham ruscha uslub” 😉",
    "Ustoz: “Uy vazifasini bajardingizmi?”\nO‘quvchi: “Bajardim, lekin mushugim ruschani tushunmay, yirtib tashladi” 🐈😄",
    "Menejer yangi mijozga shunchalik yaxshi tushuntiribdiki, mijozning onasi ham kursga yozilibdi 👩‍👦😄",
    "Bir menejer “Bugun dam olaman” deb uyda qolibdi. Kechqurun qarasa — 2 ta sotuv qilib qo‘yibdi 😂",
    "Ofisdagi eng ko‘p ishlatiladigan so‘z: “Alo?” Ikkinchi o‘rinda: “Eshityapsizmi?” 📞😄",
    "O‘quvchi: “Ustoz, 90 kunda gaplashib ketamanmi?”\nUstoz: “Har kuni 15 daqiqa qilsangiz — gapirishdan to‘xtamaysiz!” 😄",
    "Menejer: “Bu kurs hayotingizni o‘zgartiradi!”\nMijoz: “Xotinim ham shunday degan edi, keyin to‘y bo‘ldi” 💍😂",
    "Eng qiyin savol: “Sizlar kimsizlar?” Eng oson javob: “Sizning kelajakdagi ruschangiz!” 😎",
    "Sotuvchi va mijoz suhbati 40 daqiqa davom etibdi. Oxirida mijoz: “Xo‘sh, qaysi tilni o‘rgatasizlar?” 😅",
    "Ustoz: “Ruschada ‘ты’ va ‘вы’ bor.”\nO‘quvchi: “Bizda ham bor: ‘sen’ — do‘st, ‘siz’ — mijoz” 😄",
    "Menejer o‘g‘liga: “Uy vazifangni qildingmi?”\nO‘g‘il: “O‘ylab ko‘raman”\nMenejer: “Qachon qo‘ng‘iroq qilay?” 😂",
    "CRM: “Bugun 50 ta vazifa.”\nMenejer: “Men 1 ta odamman.”\nCRM: “Shuning uchun 50 ta, 100 ta emas” 🤖😄",
    "Mijoz: “Men umuman ruscha bilmayman.”\nMenejer: “Ajoyib! Demak, eng ko‘p natijani siz ko‘rasiz” 📈😉",
    "Brigadir: “Ruscha bilasanmi?”\nO‘quvchi: “Da!”\nBrigadir: “Yana nima bilasan?”\nO‘quvchi: “Hozircha shu, lekin 90 kundan keyin ko‘rasiz!” 💪😄",
    "Menejer chorshanba kuni “juma qachon?” deb so‘rabdi. Kalendar javob beribdi: “Reja bajarilgandan keyin” 📅😂",
    "Sotuvdagi eng tez sehr: mijoz “qimmat” deganda “bo‘lib to‘lash bor” deyish ✨😄",
    "Ustoz: “Ertaga test bo‘ladi.”\nO‘quvchilar: “Ruschami?”\nUstoz: “Yo‘q, sabr testi” 😄",
    "Menejer mijozning ismini to‘g‘ri aytibdi — mijoz shu zahoti yozilibdi. Kichik detal, katta natija! 😉",
    "Telefon: 2% zaryad. Mijoz: “Xo‘p, to‘lovni qayerga qilay?” Menejer: *zaryadkaga qarab yuguradi* 🏃‍♂️🔌😂",
    "Eng yaxshi sinov darsi — o‘quvchi “yana bitta dars bormi?” deb so‘ragan dars 😄🧪",
    "ROPning sevimli qo‘shig‘i: “Reja, reja, reja…” Menejerlarniki: “Bonus, bonus, bonus…” 🎶😂"
];
const FRIDAY = [
    '🕌 <b>Juma muborak, aziz jamoa!</b>\n\nBu kun barchamizga baraka, xotirjamlik va ezgu ishlar olib kelsin. Haftaning so‘nggi ish kunlarini kuchli yakunlaymiz! 🤲',
    '🌙 <b>Juma ayyomingiz muborak bo‘lsin!</b>\n\nOilangizga tinchlik, ishimizga baraka, rizqimizga kenglik tilaymiz. Jamoamiz doim birdam bo‘lsin 🤝',
    '✨ <b>Muborak Juma!</b>\n\nHafta davomidagi mehnatingiz uchun rahmat. Duolaringiz ijobat, niyatlaringiz amalga oshsin 🤲',
    '🕊 <b>Juma muborak!</b>\n\nYaxshi niyat — yarim davlat. Bugun ham bir-birimizga yaxshi so‘z, mijozlarimizga yaxshi xizmat ulashamiz 🌸',
    '🌿 <b>Barakali Juma tilaymiz!</b>\n\nHar bir qilgan mehnatimiz savob va rizq bo‘lib qaytsin. Jamoa — oila! ❤️',
    "🤲 <b>Juma muborak!</b>\n\nAlloh barchamizning duolarimizni ijobat qilsin, rizqimizni keng, oilalarimizni tinch qilsin. Barakali kun tilaymiz! 🌸",
    "🌙 <b>Muborak Juma kuni bilan!</b>\n\nBugun bir-birimizga yaxshi so‘z aytaylik — bu ham sadaqa. Jamoamizga tinchlik va omad! 🤝",
    "✨ <b>Juma ayyomi muborak!</b>\n\nHafta yakuniga yetdik — barcha mehnatlaringiz uchun katta rahmat. Dam olish kunlari ham yaqin 😊",
    "🕌 <b>Juma muborak, azizlar!</b>\n\nNiyatlarimiz xolis, ishlarimiz barakali bo‘lsin. Bugungi duolaringizda jamoamizni ham unutmang 🤲",
    "🌿 <b>Juma — haftaning eng muborak kuni</b>\n\nShu kunning barakasi ishimizga, oilamizga, sog‘ligimizga yetsin. Juma muborak! ❤️",
    "🌸 <b>Assalomu alaykum, Juma muborak!</b>\n\nYaxshi kayfiyat, xotirjam qalb va mo‘l rizq tilaymiz. Birdamligimiz bardavom bo‘lsin! 🤝",
    "☀️ <b>Nurli Juma tilaymiz!</b>\n\nHar bir qilgan ezgu ishimiz o‘zimizga qaytadi. Bugun ham mijozlarimizga, hamkasblarimizga mehr ulashamiz 💛",
    "🕊 <b>Juma muborak bo‘lsin!</b>\n\nOta-onalarimizning duosi, farzandlarimizning kulgisi, ishimizning barakasi — hammasi bizga nasib etsin 🤲",
    "🌟 <b>Muborak Juma!</b>\n\nHafta davomida qancha odamga yo‘l ko‘rsatdik, qancha o‘quvchiga bilim berdik — bu katta savob. Rahmat sizlarga! 🙏",
    "💐 <b>Juma ayyomingiz qutlug‘ bo‘lsin!</b>\n\nUyingizga fayz, dasturxoningizga baraka, qalbingizga xotirjamlik tilaymiz 🏡"
];
const dayIndex = date => Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
const rotate = (list, date, shift = 0) => list[(dayIndex(date) + shift) % list.length];
async function teamMonth(db, today) {
    const mgrs = (await db.query(`SELECT id FROM hr_employees WHERE role IN ('sotuv-menejeri','sotuv_menejeri','sotuv menejeri','sales_manager')
        AND lang='russian' AND COALESCE(status,'active') <> 'inactive'`)).rows.map(r => r.id);
    const month = today.slice(0, 7);
    const sum = Number((await db.query(`SELECT COALESCE(SUM(amount),0) AS s FROM payment_records p WHERE language='russian' AND ${await require('./dailyReports').validReceipt(db,'p')}
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
        (SELECT h.name FROM payment_records x JOIN hr_employees h ON h.id=x.manager_id WHERE x.language='russian' AND ${await require('./dailyReports').validReceipt(db,'x')}
            AND x.paid_date BETWEEN $1::date AND $2::date GROUP BY h.id,h.name ORDER BY SUM(x.amount) DESC LIMIT 1) AS top
        FROM payment_records p WHERE p.language='russian' AND ${await require('./dailyReports').validReceipt(db,'p')} AND p.paid_date BETWEEN $1::date AND $2::date`, [from, to])).rows[0];
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
