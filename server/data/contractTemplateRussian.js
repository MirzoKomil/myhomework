// 14-vazifa: "Domwork" (rus tili) kursi uchun YANGI shartnoma matni — faqat
// rus tili kursidagi o'quvchilarga ko'rsatiladi. Ingliz tili kursi hali
// ham eski contractTemplate.js'dan foydalanadi (o'zgarishsiz). Matn
// foydalanuvchi yuborgan PDF hujjatdan ("DOMWORK_ommaviy_oferta_shartnoma")
// so'zma-so'z olingan, faqat maxsus tipografik belgilar (o'ziga xos
// apostrof/tirnoq) contractTemplate.js'dagi bilan bir xil konvensiyaga
// ko'ra oddiy ASCII belgilarga almashtirilgan (Helvetica shrifti ular bilan
// bo'sh katakcha chizadi).

const CONTRACT_TITLE_RU = '"DOMWORK" ONLAYN TA\'LIM PLATFORMASI UCHUN TA\'LIM XIZMATLARI\nKO\'RSATISH BO\'YICHA SHARTNOMA\n(OMMAVIY OFERTA)';

const CONTRACT_SECTIONS_RU = [
    {
        heading: '1. UMUMIY QOIDALAR VA AKSEPT TARTIBI',
        paragraphs: [
            '1.1. Mazkur shartnoma "Domwork" loyihasi doirasida rus tilini so\'zlashuv va muloqot tili sifatida 90 kunlik yaxlit dastur asosida o\'rgatish bo\'yicha ta\'lim xizmatlarini ko\'rsatish tartibi va shartlarini belgilaydi.',
            '1.2. Ushbu shartnoma O\'zbekiston Respublikasi Fuqarolik kodeksiga muvofiq ommaviy oferta hisoblanadi.',
            '1.3. Mazkur shartnoma onlayn va avtomatik tarzda tuziladi. Shartnomada Buyurtmachi tomonidan jismoniy imzo qo\'yilishi talab etilmaydi; Buyurtmachining o\'z ism-familiyasini kiritishi hamda quyidagi harakatlardan birini amalga oshirishi shartnomani to\'liq va so\'zsiz aksept (qabul) qilish deb hisoblanadi:\n- Kurs uchun to\'liq, qisman (joy band qilish — zaklad) yoki muddatli to\'lov (nasiya) asosida to\'lovni amalga oshirish;\n- Elektron ro\'yxatdan o\'tish shaklida "Roziman" yoki "Shartnomaga roziman" tasdig\'ini bildirish;\n- Ta\'lim platformasiga (veb-ilova) kirish yoki o\'quv jarayoniga qo\'shilish.'
        ]
    },
    {
        heading: '2. SHARTNOMA PREDMETI VA O\'QUV TIZIMI',
        paragraphs: [
            '2.1. Bajaruvchi Buyurtmachiga "Domwork" metodikasi asosida rus tili bo\'yicha ta\'lim xizmatlarini ko\'rsatadi, Buyurtmachi esa to\'lovni to\'lash va ta\'lim intizomiga qat\'iy amal qilish majburiyatini oladi.',
            '2.2. Ta\'lim formati va darslarning borishi:\n- Darslarning boshlanishi: Kurs uchun to\'lov (to\'liq, qisman yoki nasiya) amalga oshirilgach, darslar uzog\'i bilan 3 (uch) ish kuni ichida boshlanadi.\n- 100% Individual darslar: Kursda guruhli darslar mavjud emas; jonli darslar asosiy ustoz bilan yakkama-yakka (individual) tarzda olib boriladi va yozib olinadi.\n- Haftalik ta\'lim grafigi: Haftada 3 kun — asosiy ustoz bilan jonli individual dars; haftada 3 kun — platformadagi videodarslarni ko\'rib o\'rganish va topshiriqlarni bajarish; kun ora — yordamchi ustoz (kurator) bilan aloqa va vazifalar nazorati; yakshanba kunlari — qo\'shimcha mustahkamlovchi bonus videodarslar.\n- Veb-ilova platformasi: Ta\'lim tizimi, videodarslar, so\'z yodlash mashqlari va testlar Buyurtmachiga maxsus veb-ilova (web application) ko\'rinishida taqdim etiladi.\n- Nazorat va Sertifikat: Har 12 ta darsdan so\'ng oraliq imtihon o\'tkaziladi. Kursni to\'liq va muvaffaqiyatli tamomlagan o\'quvchiga rag\'batlantiruvchi sertifikat beriladi.'
        ]
    },
    {
        heading: '3. O\'QUV MATERIALLARI VA 300,000 SO\'MLIK KITOB SOVG\'ASI',
        paragraphs: [
            '3.1. Kurs doirasida Buyurtmachiga umumiy qiymati 300,000 (uch yuz ming) so\'m bo\'lgan bosma o\'quv kitoblari to\'plami bepul sovg\'a sifatida taqdim etiladi.',
            '3.2. Kitoblar Buyurtmachiga eng yaqin "BTS" pochta punkti orqali jo\'natiladi. Yetkazib berish (pochta) xarajatlarini Buyurtmachining o\'zi to\'laydi.'
        ]
    },
    {
        heading: '4. TARIFLAR VA NARXLARNING O\'ZGARUVCHANLIGI',
        paragraphs: [
            '4.1. Kursning bazaviy tariflari quyidagicha belgilangan:\n- Start: Jonli dars davomiyligi 15 daqiqa (haftada 3 kun) — Bazaviy narxi: 1,800,000 so\'m;\n- Standard: Jonli dars davomiyligi 30 daqiqa (haftada 3 kun) — Bazaviy narxi: 2,100,000 so\'m;\n- VIP: Jonli dars davomiyligi 60 daqiqa (haftada 3 kun) — Bazaviy narxi: 6,000,000 so\'m.',
            '4.2. Shartnomada ko\'rsatilgan narxlar joriy vaqt, mavsumiy talab, aksiyalar va o\'quv kursidagi yangilanishlar hisobiga Bajaruvchi tomonidan o\'zgartirilishi (pasaytirilishi yoki oshirilishi) mumkin. To\'lov vaqtida rasmiylashtirilgan summa qat\'iy hisoblanadi.'
        ]
    },
    {
        heading: '5. TO\'LOV TARTIBI, NASIYA (PAYLATER / UZUM NASIYA) VA QARZDORLIK',
        paragraphs: [
            '5.1. To\'lovlar to\'liq (naqd/karta), hisob raqamga (Payme/Click — "Homework") yoki rasmiy hamkorlar (PayLater va Uzum Nasiya) orqali muddatli to\'lov (nasiya) shaklida amalga oshiriladi.',
            '5.2. To\'lov PayLater yoki Uzum Nasiya orqali rasmiylashtirilganda ham naqd to\'lovdagi qat\'iy shartlar to\'liq amal qiladi. Nasiya rasmiylashtirilgach, shartnomani bekor qilish yoki to\'lovni to\'xtatish mumkin emas.',
            '5.3. Buyurtmachi muddatli to\'lov (nasiya) asosida kursga yozilib, keyinchalik darslarda qatnashmagan taqdirda ham to\'liq summa bo\'yicha qarzdor hisoblanadi.',
            '5.4. Agar qarzdor to\'lovlarni o\'z vaqtida to\'lamasa, u qonuniy tartibda javobgarga aylanadi va qarzlar O\'zbekiston Respublikasi qonunchiligiga muvofiq majburiy tartibda undiriladi.'
        ]
    },
    {
        heading: '6. SHARTNOMANING BEKOR QILINISHI VA TO\'LOVNING QAYTARILMASLIGI',
        paragraphs: [
            '6.1. Kursga to\'liq yoki qisman (zaklad) to\'lov qilingan paytdan boshlab ta\'lim xizmati ko\'rsatish boshlangan hisoblanadi.',
            '6.2. To\'lov qabul qilingandan so\'ng, shartnoma Buyurtmachi tashabbusi bilan bekor qilinsa, to\'langan pul (to\'liq yoki zaklad) mutlaqo qaytarilmaydi.'
        ]
    },
    {
        heading: '7. KURSNI MUZLATISH (FREEZE) TARTIBI',
        paragraphs: [
            '7.1. Buyurtmachi 90 kunlik davr ichida asosli sabablar bilan ko\'pi bilan 2 martagacha kursni vaqtincha muzlatib turishi mumkin.',
            '7.2. Har bir muzlatish muddati uzog\'i bilan 2 hafta (14 kalendar kun) bo\'lishi mumkin.',
            '7.3. Agar Buyurtmachi 2 haftadan so\'ng darslarga qaytmasa yoki 2 martadan ortiq yana muzlatish so\'rasa, to\'langan pulga Buyurtmachi kuyadi va mablag\' qaytarilmaydi.'
        ]
    },
    {
        heading: '8. 90 KUNLIK NATIJA KAFOLATI VA PULNI QAYTARISH SHARTI',
        paragraphs: [
            '8.1. Bajaruvchi shartnoma talablariga to\'liq amal qilgan Buyurtmachiga 90 kunda rus tilida muloqot natijasiga chiqishni kafolatlaydi.',
            '8.2. Agar Buyurtmachi barcha shartlarni (jonli darslarning 100%iga qatnashish, videodarslarni ko\'rib vazifalarni to\'liq bajarish, imtihonlarni topshirish) to\'liq bajarsa-yu, aytilgan natijaga chiqa olmasa, holat tizim orqali tekshirilib, to\'langan pul 100% to\'liq qaytarib beriladi.'
        ]
    },
    {
        heading: '9. MAXFIYLIK VA INTELLEKTUAL MULK',
        paragraphs: [
            '9.1. Barcha videodarslar, metodikalar va veb-ilova materiallari intellektual mulk bo\'lib, ularni tarqatish yoki nusxalash qat\'iyan man etiladi.'
        ]
    }
];

module.exports = { CONTRACT_TITLE_RU, CONTRACT_SECTIONS_RU };
