# To‘lovlar reyestri (8-vazifa)

`payment_records` qabul qilingan tushumlarning yagona server manbasi. Bitta zaklad va keyingi to‘lov ikkita alohida yozuv. Narx, kredit arizasi yoki bosqichning o‘zi tushum hisoblanmaydi. Tashqi to‘lov provayderlari ulanmagan.

## Ishlash tartibi

- Zaklad: «To‘lov jarayonida» so‘rovida sana, haqiqiy summa, usul va chek kiritiladi. Lid/o‘quvchi/reyestr bitta tranzaksiyada saqlanadi.
- Yakunlashdagi summa **jami, oldingi to‘lovlar bilan** kiritiladi. Server ilgari yozilgan tushumlarni ayirib, faqat yangi qoldiqni yozadi.
- «Qarzdorlar» kartochkasi → «To‘lov qabul qilish»: joriy qarz serverdan olinadi; menejer sana, summa, usul va chekni kiritadi. To‘lovdan keyin o‘quvchi aktivlashadi, mavjud ustoz/guruh biriktirishi saqlanadi.
- Idempotency key, qarz versiyasi va qator blokirovkalari takroriy/parallel so‘rovlarning ortiqcha kirim yaratishini to‘sadi. Tushum va audit birgalikda yoziladi; audit ishlamasa hammasi rollback.
- Summa/sanani oddiy kartochka tahriri bilan qayta yozib bo‘lmaydi. Mavjud tushum cheki o‘chirilmaydi. Keyingi moliyaviy tuzatish haqiqiy qaytarim va moliya tasdig‘i bilan amalga oshirilishi kerak.

## Integratsiyalar

KPI har bir tushumni qabul qilingan **sanasidagi** davr va yozuvdagi menejerga hisoblaydi, shu jumladan zakladlarni. Eski yopilgan bitim summasi bunga qayta qo‘shilmaydi. Oldin berilgan maoshlar/basis o‘zgarmaydi; eski basis eski hisoblash qoidasini saqlaydi. Qaytarimlar Cash Flowdagi aniq qaytarim voqeasi bo‘yicha bir marta chegiriladi.

Cash Flow reyestrdan read-only `inflow:<id>` kirimlarini oladi. Ular generic JSON saqlashga ko‘chirilmaydi va tahrir/o‘chirish tugmalari yo‘q. Payme/Click bank hisobiga, naqd/karta/nasiya alohida hisoblarga tushadi; usuli noma’lum eski tushum «Aniqlanmagan» hisobida qoladi. Kassa balansini yangilash uchun sahifa serverdan ma’lumot olishi shart; xatolik ko‘rsatiladi.

## Eski yozuvlar

`legacy-v1` migratsiya bir marta, atomik va parallel deploylardan himoyalangan holda ishlaydi. Aniq qisman to‘lov + yopilgan jami summa bo‘lsa, farq ikkinchi tushum hisoblanadi. Faqat summa va aniq kun isbotlangan yozuvlar kiritiladi. Chek/usul yetishmasa «Eski ma’lumot — tekshirish kerak». Sana/summa yetishmasa yoki o‘quvchining akademik to‘lovi lid yozuvi bilan takrorlanishi mumkin bo‘lsa, `payment_migration_issues` ga yoziladi va panelda birinchi 100 ta manba/sabab ko‘rinadi. Jamlangan eski balansdan sanali tushum to‘qib chiqarilmaydi; undan keyingi yangi to‘lovda eski boshlang‘ich balans alohida saqlanadi.

Eski qo‘lda kiritilgan Cash Flow kirimi va reyestr tushumi summa, sana, hisob turi, ma’lum bo‘lsa til/lid/o‘quvchi bo‘yicha mos kelsa, panelda **Eski kirimlarni solishtirish** oynasi chiqadi. Moslik avtomatik ravishda «dubl» degani emas. Shubhali qo‘lda kiritilgan qator moliya tasdig‘igacha balans va Cash Flow eksportining jami summasiga qo‘shilmaydi; balans vaqtinchalik ekani yoziladi. Moliya haqiqiy manbani tekshirib «Reyestrdagi tushumning nusxasi» (qaysi tushum ekanini tanlab) yoki «Boshqa, alohida kirim» qarorini beradi.

Qaror `payment_cash_decisions` jadvalida va auditda atomik saqlanadi; asl Cash Flow yozuvi o‘chirilmaydi. Nusxa bo‘lsa faqat reyestr tushumi sanaladi, alohida kirim bo‘lsa ikkala tushum ham sanaladi. Oldingi qarorni stale snapshot bilan o‘zgartirish/o‘chirish mumkin emas. Bir xil so‘rovni takrorlash dubl yaratmaydi. Moliya qaroridan keyin tasdiqlangan manba va bog‘lanish saqlanadi.

O‘quvchi kartochkasi va mobil ilovadagi to‘lov tarixi `payment_records` dan olinadi: zaklad va keyingi tushum alohida. Migratsiya qilingan akademik yozuv qayta qo‘shilmaydi. Ko‘chirilmagan eski yozuvlar CRMda **Tekshirilmagan eski arxiv** sifatida alohida, jami summadan tashqarida ko‘rsatiladi. Joriy qarz — o‘quvchining joriy balansi, tarixdagi qarz esa har bir tushum paytidagi qiymat. Oylik tarif zaklad summasidan taxmin qilinmaydi.

Eski umumiy «To‘lovlar» oynasi yangi Moliya reyestriga yo‘naltiriladi. Eski `payments` jadvaliga generic PATCH orqali yangi to‘lov yozish/o‘chirish bloklangan; asl arxiv o‘z joyida qoladi. Yangi tushum faqat chek va usul bilan reyestr endpointiga qabul qilinadi.

## API va ruxsat

- `GET /api/inflow?language=english|russian`: faqat moliya/admin, to‘lovlar va xatoliklar ro‘yxati; sana/ism/telefon/menejer/ustoz/tarif/usul/shakl filtrlari.
- `GET /api/inflow/students/:id`: moliya yoki tegishli sotuv menejeri/ROP, parol/hash qaytarilmaydi.
- `GET /api/inflow/students/:id/history`: o‘sha ruxsatlar bilan reyestr tarixi, alohida tekshirilmagan arxiv va joriy qarz.
- `GET/POST /api/inflow/cash-reconciliation`: faqat DB roliga ko‘ra moliya/admin; manba snapshoti o‘zgargan bo‘lsa tasdiqlash rad etiladi.
- `POST /api/inflow`: haqiqiy DBdagi rol, menejer biriktirishi va til tekshiriladi. Kreditlangan menejer/language mijoz body yoki JWT rolidan olinmaydi.
- Yangi tushum uchun serverda mavjud chek, musbat butun summa, haqiqiy (kelajak bo‘lmagan) sana majburiy. Sana Asia/Tashkent bo‘yicha talqin qilinadi; vaqt noma’lum bo‘lsa o‘ylab topilmaydi.

## Dizayn va read-only aniqlashtirish (2026-10-05)

CRM `--surface`/`--text` ranglari, 44px tugmalar, ekran ichiga sig‘adigan jadval, ustun orqali saralash va filtrga o‘tish qo‘llanadi. Mobil qo‘shimcha filtrlar yig‘iladigan panelda; jami doim ekran pastida. Sana oraliği noto‘g‘ri bo‘lsa, noto‘g‘ri 0 jami yoki eksport berilmaydi. Excelda pul raqamligicha qoladi, ko‘rinish formati bo‘shliq bilan ajratilgan UZS.

Qarzi 0 bo‘lgan qatorlarda keyingi to‘lov sanasi **faqat ko‘rinishda** yashiriladi, eski snapshot o‘zgartirilmaydi. Migratsiya muammolari til va manbadagi ma’lum sanaga bog‘lab o‘qiladi; sanasi noma’lum manbalar ochiq belgilangan holda qoladi, tili noma’lumlari alohida hisoblanadi. Reference sana tushum isboti emas. Asl `payment_records`, `payments`, `students`, `leads` va migration issue yozuvlari bu GET orqali o‘zgarmaydi.

Menejeri noma’lum tushumlar «Menejer biriktirilmagan» filtri va tekshirish panelida summa bilan ko‘rsatiladi. Kassadan o‘chirilmaydi, menejerga taxminan taqsimlanmaydi. Chek/usul yo‘qligi ham faqat ogohlantirish, yangi chek yoki sana to‘qilmaydi. Tarixiy ma’lumotlarni tuzatish uchun haqiqiy manba va alohida moliya qarori zarur.

`node scripts/preview-inflow.cjs` — 127.0.0.1:8786 da DB/auth ulanmagan, faqat sun’iy ma’lumotli UI QA. Eksport ushbu fixture ichida xotirada tekshiriladi; jonli ma’lumot yozilmaydi.

## Tekshiruv

`node --test scripts/inflow.test.cjs` — domen/KPI/filtrlar, tarix va kirimlarni solishtirish. `node scripts/run-payroll-postgres.cjs` — maosh, tushum va dual-role uchun uchta alohida vaqtinchalik loopback baza. Runner ishlab turgan `DATABASE_URL` ga ulanmaydi. Test fayllari diagnostika uchun saqlanadi; vaqtinchalik PostgreSQL to‘xtatiladi. Jonli serverda sinov to‘lovi kiritilmaydi.
