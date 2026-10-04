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

Eski qo‘lda kiritilgan Cash Flow kirimini tarixiy reyestr yozuvi bilan tenglashtirish uchun faqat bir xil sana/summa yetarli emas. Aniq bog‘lanish (`paymentRecordId`) mavjud bo‘lsagina avtomatik dubl olib tashlanadi. Moliya oldingi qo‘lda kiritilgan kirimlarni solishtirishi kerak.

## API va ruxsat

- `GET /api/inflow?language=english|russian`: faqat moliya/admin, to‘lovlar va xatoliklar ro‘yxati; sana/ism/telefon/menejer/ustoz/tarif/usul/shakl filtrlari.
- `GET /api/inflow/students/:id`: moliya yoki tegishli sotuv menejeri/ROP, parol/hash qaytarilmaydi.
- `POST /api/inflow`: haqiqiy DBdagi rol, menejer biriktirishi va til tekshiriladi. Kreditlangan menejer/language mijoz body yoki JWT rolidan olinmaydi.
- Yangi tushum uchun serverda mavjud chek, musbat butun summa, haqiqiy (kelajak bo‘lmagan) sana majburiy. Sana Asia/Tashkent bo‘yicha talqin qilinadi; vaqt noma’lum bo‘lsa o‘ylab topilmaydi.

## Tekshiruv

`node --test scripts/inflow.test.cjs` — domen/KPI/filtrlar. `node scripts/run-payroll-postgres.cjs` — maosh va tushumlar uchun **ikkita alohida vaqtinchalik loopback baza**. Runner ishlab turgan `DATABASE_URL` ga ulanmaydi. Test fayllari diagnostika uchun saqlanadi; vaqtinchalik PostgreSQL to‘xtatiladi. Jonli serverda sinov to‘lovi kiritilmaydi.
