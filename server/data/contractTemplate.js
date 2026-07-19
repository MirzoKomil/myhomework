// 6-vazifa: Mijoz bilan shartnoma PDF shabloni matni. Amaldagi namuna
// shartnomadan olingan, faqat maxsus tipografik belgilar (o'ziga xos
// apostrof, tirnoqlar) oddiy ASCII belgilarga almashtirilgan — sababi:
// PDF generatorda ishlatiladigan standart shriftlar (Helvetica) bu
// belgilarni chizolmaydi va o'rniga bo'sh katakcha chiqarib qo'yadi.
// Bu almashtirish kodning boshqa joylarida ham (js/app.js) allaqachon
// qabul qilingan konvensiya bilan bir xil.

const CONTRACT_TITLE = '"HOMEWORK" ONLAYN KURSLARI UCHUN TA\'LIM XIZMATLARI\nKO\'RSATISH BO\'YICHA SHARTNOMA';

const CONTRACT_PREAMBLE = [
    'Mazkur Shartnoma "Homework" onlayn ta\'lim platformasi orqali ingliz tilini chet tili sifatida o\'rganish bo\'yicha ta\'lim xizmatlarini ko\'rsatish doirasida tuziladi. Shartnoma Bajaruvchi va Buyurtmachi o\'rtasidagi o\'zaro huquq va majburiyatlarni, xizmat ko\'rsatish shartlari, muddati, to\'lov tartibi, javobgarlik va boshqa yuridik jihatlarni belgilaydi.',
    'Mazkur Shartnoma Buyurtmachi tomonidan to\'ldirilganidan va rozilik bildirilganidan so\'ng yuridik kuchga ega hisoblanadi.'
];

const CONTRACT_SECTIONS = [
    {
        heading: '1. UMUMIY QOIDALAR',
        paragraphs: [
            '1.1. Ushbu shartnoma ingliz tilini chet tili sifatida o\'rgatishga ixtisoslashgan Homework online maktabi (keyingi o\'rinlarda - "Bajaruvchi") bilan kursga ro\'yxatdan o\'tgan o\'quvchi (keyingi o\'rinlarda - "Buyurtmachi") o\'rtasidagi o\'zaro huquqiy munosabatlarni tartibga soladi.',
            '1.2. Buyurtmachi kursga ro\'yxatdan o\'tish orqali ushbu shartnoma shartlariga rozilik bildirgan hisoblanadi.',
            '1.3. Ushbu shartnoma quyidagi harakatlardan biri sodir bo\'lgan vaqtdan boshlab kuchga kiradi:\n- Buyurtmachi tomonidan "Roziman" yoki "Shartnoma shartlariga roziman" degan ibora yozilishi; yoki\n- Buyurtmachi tomonidan kurs uchun to\'lov amalga oshirilishi.\nMazkur harakatlar Buyurtmachining shartnoma shartlariga to\'liq rozilik bildirganini anglatadi. Shartnoma kurs yakunigacha yoki taraflarning barcha majburiyatlari to\'liq bajarilguniga qadar amalda bo\'ladi.'
        ]
    },
    {
        heading: '2. SHARTNOMA PREDMETI',
        paragraphs: [
            '2.1. Mazkur shartnomaga muvofiq, Bajaruvchi Buyurtmachiga Homework online maktabi kurslari doirasida ingliz tilini chet tili sifatida o\'rganish bo\'yicha ta\'lim xizmatlarini ko\'rsatadi. Buyurtmachi esa ushbu xizmatlar uchun to\'lovni belgilangan tartibda amalga oshirish va kursda faol ishtirok etish majburiyatini oladi.',
            '2.2. Bajaruvchi tomonidan ko\'rsatiladigan ta\'lim xizmatlari quyidagilardan iborat:\n- O\'quv materiallariga kirish huquqi: Buyurtmachiga video darsliklar, audio fayllar, yozma topshiriqlar, lug\'atlar va boshqa ta\'limiy materiallar maxsus Telegram kanali orqali taqdim etiladi.\n- Onlayn darslar: Buyurtmachiga haftasiga 6 marotaba, jonli dars 3 marotaba 60 daqiqadan iborat tanlagan tarifiga qarab 5 kishilik guruhda yoki individual jonli darslar o\'tkaziladi. Darslar kurs boshida kelishilgan jadval asosida Telegram qo\'ng\'iroqlari orqali amalga oshiriladi va yozib olinadi.\n- Uy vazifalari va nazorat ishlari: Har bir mavzudan so\'ng uy vazifalari va yoki testlar beriladi. Buyurtmachi ularni belgilangan muddatda topshiradi, Bajaruvchi esa tekshiradi va fikr bildiradi.\n- Assistent yoki o\'qituvchi bilan maslahatlar: Buyurtmachi o\'quv jarayonida yuzaga kelgan savollar yuzasidan Telegram orqali aloqaga chiqib, maslahat olish huquqiga ega.\n- Motivatsion va metodik yordam: Kurs davomida Buyurtmachiga o\'z vaqtida davom etishga undovchi eslatmalar, maslahatlar va metodik ko\'rsatmalar taqdim etiladi.\n- Kursdagi barcha xizmatlar yagona ta\'lim paketining tarkibiy qismi hisoblanadi. Ulardan alohida, qisman yoki bo\'laklab foydalanish, faqat ayrim qismlariga alohida to\'lov qilish mumkin emas.'
        ]
    },
    {
        heading: '3. TOMONLARNING HUQUQ VA MAJBURIYATLARI',
        paragraphs: [
            '3.1. Bajaruvchining huquqlari va majburiyatlari:\n- Kurs davomida barcha zaruriy o\'quv materiallarini Buyurtmachiga Telegram kanali orqali taqdim etish.\n- Individual darslarni haftasiga 3 marotaba, jonli darslarni har biri 60 daqiqa davomida, kurs boshida kelishilgan kun va soatlarda Telegram orqali o\'tkazish.\n- Buyurtmachining o\'rganish jarayonini sifatli tashkil etish, savollariga o\'z vaqtida va mazmunli javob berish.\n- Uy vazifalarini tekshirib, fikr-mulohaza (feedback) taqdim etish.\n- Zarurat tug\'ilganda, Buyurtmachi bilan alohida maslahatlashuvlar o\'tkazish.',
            '3.2. Buyurtmachining majburiyatlari:\n- Kurs uchun belgilangan to\'lovni muddatida to\'liq yoki bo\'lib-bo\'lib amalga oshirish.\n- Telegram kanalidagi o\'quv materiallarini muntazam o\'rganish va amalda qo\'llash.\n- Individual darslarga belgilangan vaqtda qatnashish. Agar belgilangan vaqtda qatnashilmasa, dars kuydirilgan (o\'tkazib yuborilgan) hisoblanadi va aynan bu dars qayta o\'tkazilmaydi.\n- Uy vazifalarini belgilangan muddatda bajarib topshirish.\n- Kurs jarayonida odob-axloq me\'yorlariga qat\'iy rioya qilish.\n- Kursni vaqtincha to\'xtatgan (muzlatgan) taqdirda, davom ettirish uchun amaldagi (yangilangan) narx asosida to\'lovni amalga oshirish.\n- Kurs davom ettirilmasa yoki butunlay tark etilsa, ilgari amalga oshirilgan to\'lovlar qaytarilmasligini qabul qilish.\n- Buyurtmachi istalgan vaqtda kursda ishtirok etishni to\'xtatishi mumkin, biroq bu holat xizmatdan voz kechish sifatida baholanadi va to\'lovni qaytarish asosini yaratmaydi.'
        ]
    },
    {
        heading: '4. XIZMATLAR NARXI VA TO\'LOV TARTIBI',
        paragraphs: [
            '4.1. Ta\'lim xizmatlari uchun belgilangan narx Bajaruvchining amaldagi tasdiqlangan narxlar ro\'yxatiga (prais-list) muvofiq belgilanadi. Bajaruvchi narxlarni o\'zgartirish huquqiga ega bo\'lib, bu haqda Buyurtmachiga oldindan xabar berishga majburdir.',
            '4.2. To\'lov quyidagi shakllarda amalga oshiriladi:\n- kurs uchun to\'liq (bir martalik) to\'lov asosida; yoki\n- Bajaruvchi tomonidan belgilangan jadval asosida bo\'lib-bo\'lib to\'lash shaklida.',
            '4.3. To\'lovlar faqat Bajaruvchi tomonidan ko\'rsatilgan rasmiy to\'lov tizimlari orqali, jumladan Uzum Bank, Paylater yoki boshqa qonuniy platformalar orqali amalga oshiriladi.',
            '4.4. Uchinchi shaxslar orqali yoki norasmiy yo\'llar bilan amalga oshirilgan to\'lovlar yaroqsiz hisoblanadi. Bunday holatlarda Bajaruvchi hech qanday moliyaviy yoki huquqiy javobgarlikni zimmasiga olmaydi.',
            '4.5. Kurs uchun to\'lov amalga oshirilgan kundan boshlab xizmatlar ko\'rsatilgan deb hisoblanadi. Shu kundan boshlab Buyurtmachining to\'liq to\'lov majburiyati kuchga kiradi va kursdan voz kechish holatlari to\'lovni qaytarish asosini yaratmaydi.'
        ]
    },
    {
        heading: '5. TOMONLARNING JAVOBGARLIGI',
        paragraphs: [
            '5.1. Bajaruvchi texnik nosozliklar, internet uzilishlari yoki Buyurtmachining qurilmasi, aloqa vositasi, ilovalari yoki boshqa shaxsiy sabablari bilan bog\'liq uzilishlar tufayli ta\'lim jarayoni to\'xtagan holatlar uchun javobgar emas.',
            '5.2. Kurs davomida taqdim etilgan barcha materiallar faqat Buyurtmachining shaxsiy o\'rganish maqsadida foydalanilishi uchun mo\'ljallangan. Ularni uchinchi shaxslarga tarqatish, ko\'chirish, nusxalash, ommaga ulashish yoki tijorat maqsadida foydalanish qat\'iyan man etiladi.',
            '5.3. Agar Buyurtmachi tomonidan kurs qoidalariga zid harakatlar (shu jumladan o\'qituvchiga yoki boshqa ishtirokchilarga nisbatan hurmatsizlik, haqorat, tahdid, yolg\'on axborot tarqatish va h.k.) sodir etilsa, Bajaruvchi Buyurtmachining kursdagi ishtirokini ogohlantirishsiz to\'xtatish huquqiga ega. Bunday holatda amalga oshirilgan to\'lov qaytarilmaydi.',
            '5.4. Buyurtmachi tomonidan to\'lov belgilangan muddatlarda amalga oshirilmagan taqdirda, Bajaruvchi xizmat ko\'rsatishni vaqtincha to\'xtatish, dars jadvalini bekor qilish yoki Buyurtmachining kursdagi ishtirokini to\'liq bekor qilish huquqiga ega. Xizmatlar to\'lov to\'liq tiklangandan keyin qayta faollashtiriladi.',
            '5.5. Buyurtmachi tomonidan kurs davomida boshqa ishtirokchilarning osoyishtaligiga tahdid soluvchi yoki bezovta qiluvchi harakatlar aniqlangan taqdirda, Bajaruvchi Buyurtmachining ishtirokini ogohlantirishsiz to\'xtatish huquqiga ega. Bu holatda ham to\'lov qaytarilmaydi.',
            '5.6. Kurs davomida taqdim etilgan barcha o\'quv materiallari, metodik tavsiyalar, audio va video yozuvlar Bajaruvchining mualliflik mulki hisoblanadi. Ularni ruxsatsiz tarqatish, nusxalash yoki tijorat maqsadida foydalanish qonunbuzarlik sifatida qaraladi va qonunchilik asosida javobgarlikka sabab bo\'ladi.'
        ]
    },
    {
        heading: '6. SHARTNOMANING BEKOR QILINISHI',
        paragraphs: [
            '6.1. Shartnoma tomonlarning o\'zaro roziligi asosida istalgan vaqtda bekor qilinishi mumkin. Bunday hollarda hisob-kitoblar 10 ish kuni ichida amalga oshiriladi.',
            '6.2. Agar Buyurtmachi kursni boshlagan bo\'lsa (ya\'ni dars jadvali tuzilgan, o\'quv materiallariga kirish taqdim etilgan yoki ilk dars tayinlangan bo\'lsa), kursni davom ettirmagan yoki yakunlamagan taqdirda ham to\'lov to\'liq saqlab qolinadi. To\'lov qisman yoki to\'liq qaytarilmaydi. Kursning boshlanishi xizmat ko\'rsatishning boshlanishi sifatida baholanadi. Buyurtmachi ushbu shartnoma shartlarini qabul qilish orqali kurs narxini to\'liq to\'lash majburiyatini olganini tan oladi.',
            '6.3. Agar Buyurtmachi tomonidan kurs boshlangandan so\'ng ketma-ket 3 kalendar kuni davomida darslarda qatnashilmasa va hech qanday aloqa o\'rnatilmasa, Bajaruvchi ushbu shartnomani bir tomonlama bekor qilish huquqiga ega. Bunday holatda to\'lov qaytarilmaydi.',
            '6.4. Agar to\'lov "Uzum Nasiya" orqali amalga oshirilgan bo\'lsa, Buyurtmachi shartnomani to\'lov sanasidan boshlab 1 kalendar kuni ichida bekor qilish huquqiga ega. 1 kundan keyin bekor qilish imkoniyati mavjud emas.',
            '6.5. Kursni vaqtincha to\'xtatish (muzlatish) faqat bir marta va eng ko\'pi bilan 14 kalendar kun muddatga ruxsat etiladi. Belgilangan muddatdan ortiq cho\'zilgan hollarda kurs avtomatik ravishda bekor qilingan deb hisoblanadi va to\'lov qaytarilmaydi.'
        ]
    },
    {
        heading: '7. MAXFIYLIK',
        paragraphs: [
            '7.1. Kurs davomida Buyurtmachiga taqdim etiladigan barcha o\'quv materiallari (shu jumladan video darslar, audio yozuvlar, matnli fayllar, lug\'atlar, testlar va metodik tavsiyalar) intellektual mulk hisoblanadi va Bajaruvchiga tegishli bo\'ladi.',
            '7.2. Buyurtmachi mazkur materiallardan faqat shaxsiy o\'rganish maqsadida foydalanish huquqiga ega. Ularni uchinchi shaxslarga berish, ko\'chirish, nusxalash, tarqatish, ommaga ulashish yoki tijorat maqsadlarida foydalanish qat\'iyan man etiladi.',
            '7.3. Kurs davomida o\'qituvchilar, assistentlar yoki boshqa o\'quvchilar bilan yozishmalar, ovozli yoki yozma muloqotlar, maslahatlar va dars jarayoniga oid barcha axborotlar ham maxfiy ma\'lumot sifatida e\'tirof etiladi.',
            '7.4. Maxfiylik qoidalari buzilgan taqdirda, Bajaruvchi Buyurtmachining kursdagi ishtirokini ogohlantirishsiz to\'xtatish hamda zarur hollarda huquqiy choralar ko\'rish huquqiga ega. Ushbu holatda amalga oshirilgan to\'lovlar qaytarilmaydi.',
            '7.5. Buyurtmachiga kurs materiallarining ekran yozuvini olish, skrinshot qilish, uchinchi qurilma orqali suratga olish yoki boshqa har qanday texnik vosita orqali qayta yozib olish qat\'iyan man etiladi.',
            '7.6. To\'lov miqdori, chegirmalar, individual kelishuvlar va boshqa tijorat axborotlari ham maxfiy hisoblanadi va uchinchi shaxslarga oshkor qilinmasligi lozim.',
            '7.7. Maxfiylikka oid ushbu shartnoma bandlari kurs yakunlangandan so\'ng ham muddatsiz amal qiladi.'
        ]
    },
    {
        heading: '8. NATIJAGA ERISHISH',
        paragraphs: [
            '8.1. Buyurtmachi quyidagi shartlarga to\'liq rioya qilgan taqdirda, ta\'lim xizmatining samaradorligi yuzasidan da\'vo bildirish yoki to\'lovni qaytarishni talab qilish huquqiga ega bo\'ladi:\n- Kurs davomida barcha video darslarni to\'liq tomosha qilish;\n- Uy vazifalarini belgilangan muddatda va to\'liq bajargan holda topshirish;\n- Telegram orqali o\'tkaziladigan individual jonli darslarda haftasiga 3 marotaba qatnashish;\n- Kurs davomida kamida 100% jonli darslarda qatnashish;\n- Kursni uzluksiz ravishda 3 oy davomida to\'liq yakunlash.',
            '8.2. Bajaruvchi quyidagi majburiyatlarni zimmasiga oladi:\n- Kurs davomida tizimli va sifatli o\'quv materiallarini taqdim etish;\n- Individual darslar va maslahatlar orqali Buyurtmachini muntazam qo\'llab-quvvatlash;\n- Uy vazifalari yuzasidan fikr-mulohazalar (feedback) taqdim etish;\n- Buyurtmachi faol qatnashgan taqdirda, ta\'lim samaradorligini ta\'minlash uchun barcha zaruriy metodik vositalardan foydalanish.',
            '8.3. Buyurtmachi mazkur banddagi barcha shartlarga to\'liq rioya qilgan bo\'lsa-yu, lekin kurs yakunida belgilangan natijaga erisha olmaganini asoslab bera olsa, to\'lov qisman yoki to\'liq qaytarilishi mumkin.',
            '8.4. Agar Buyurtmachi ushbu bo\'limda belgilangan majburiyatlarning birortasini bajarmagan bo\'lsa, u holda ta\'lim natijasiga oid hech qanday da\'vo qabul qilinmaydi va to\'lov qaytarilmaydi.',
            '8.5. Ushbu shartnomada "natijaga erishish" tushunchasi ostida quyidagilar nazarda tutiladi: Buyurtmachi kurs yakunida kundalik mavzularda muloqotda ishtirok eta olish, savollarga javob bera olish, fikrini tushunarli tarzda ifodalash va asosiy gap tuzilmalarini to\'g\'ri qo\'llay olish darajasiga yetadi.',
            '8.6. Natija kafolati faqat Buyurtmachining shaxsiy ishtiroki asosida baholanadi. Agar boshqa shaxs Buyurtmachi o\'rniga darslarda qatnashgan yoki topshiriqlarni bajargan bo\'lsa, ushbu kafolatlar o\'z kuchini yo\'qotadi.'
        ]
    },
    {
        heading: '9. YAKUNIY QOIDALAR',
        paragraphs: [
            '9.1. Shartnoma bo\'yicha yuzaga kelishi mumkin bo\'lgan har qanday nizolar va kelishmovchiliklar, birinchi navbatda tomonlar o\'rtasida muzokaralar orqali hal etiladi. Agar muzokaralar samara bermasa, nizolar O\'zbekiston Respublikasining amaldagi qonunchiligiga muvofiq sud tartibida ko\'rib chiqiladi.',
            '9.2. Ushbu shartnoma quyidagi holatlardan biri sodir bo\'lgan kundan boshlab kuchga kiradi:\n- Buyurtmachi tomonidan "Roziman" yoki "Shartnoma shartlariga roziman" degan ibora yozilishi; yoki\n- Buyurtmachi tomonidan kurs uchun to\'lov amalga oshirilishi.\nMazkur harakatlar Buyurtmachining ushbu shartnoma shartlariga to\'liq rozilik bildirganini anglatadi. Shartnoma kurs yakunigacha yoki tomonlarning barcha majburiyatlari to\'liq bajarilguniga qadar amalda bo\'ladi.',
            '9.3. Ushbu shartnoma elektron shaklda tuzilgan bo\'lib, tomonlar uchun yuridik kuchga ega hisoblanadi va qog\'oz shaklida imzolanishi shart emas.',
            '9.4. Buyurtmachi ushbu shartnoma mazmuni bilan to\'liq tanishganini, barcha bandlarini to\'g\'ri tushunganini va ularga hech qanday bosim ostida bo\'lmasdan, o\'z ixtiyori bilan rozilik bildirganini tasdiqlaydi.'
        ]
    }
];

module.exports = { CONTRACT_TITLE, CONTRACT_PREAMBLE, CONTRACT_SECTIONS };
