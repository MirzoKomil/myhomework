# KPI / Payroll

Hisob-kitobning manbasi server, brauzer emas. `js/payrollEngine.js` sof hisoblash qoidalarini,
`server/services/payroll.js` esa manba o‘qish, saqlash, audit va to‘lov holatini boshqaradi.

## Ishlatish

1. HR kartochkasida lavozimga mos KPI shabloni va ish boshlagan sanani belgilang.
2. Moliya → KPI da tilni tanlab foizlar, fiksa pog‘onalari, ustoz tariflari, targetologning
   **shu yo‘nalishga ajratilgan** jami oylik maoshi va pul bonuslarini sozlang.
3. Oylik yoki moslashuvchan davrni tanlang. Boshlanish/tugash sanalari **ikkalasi ham** hisobga olinadi.
   Bir oylik 15-dan boshlangan davr uchun keyingi oyning 14-kunini tugash qilib tanlang.
4. ROP uchun Sotuv rejasi sahifasining o‘rtacha konversiya rejasidan hisoblangan summani tasdiqlang.
   Reja o‘zgarsa, tasdiq qayta talab qilinadi; rejasiz komissiya to‘lanmaydi.
5. Moliya → Maoshlar oynasida hisobni tekshirib, **Maoshlarni shakllantirish** tugmasini bosing.
   Server qayta hisoblaydi, eski preview bilan mosligini tekshiradi va `salary_transactions`ga yozadi.
6. Pul haqiqatan berilgandan keyingina **Berildi deb belgilash**ni bosing. Eskirgan hisobni oldin qayta
   shakllantirish kerak. To‘langan hisoblar o‘zgarmaydi; takroriy bosish qayta to‘lov yaratmaydi.

## Hisoblash siyosati

- Sotuv menejeri: aylanma pog‘onasi bo‘yicha fiksa, ishga qabul qilingan kundan kunlik proporsiya,
  alohida sotuv foizi va bonuslar. ROP fiksa ham kunlarga proporsional.
- Moslashuvchan davr fiksa: har bir kalendar oyidagi ulush alohida hisoblanib yig‘iladi.
- ROP reja bajarilishi jami to‘langan aylanma/reja bilan hisoblanadi. Komissiya bazasi esa
  aylanmadan menejerlarning jami maoshi va targetolog maoshini ayirish orqali olinadi. Reklama byudjeti olinmaydi.
- ROP oralig‘i uzluksiz: masalan 30% birinchi pog‘ona, 30%dan katta natija ikkinchi pog‘ona.
  1%dan kam natijada boshlang‘ich sozlama bo‘yicha komissiya yo‘q.
- Asosiy ustoz tarifi har bir o‘quvchining dars davomiyligidan olinadi. Tasdiqlangan davomat,
  biriktirilgan ustoz/til va ish boshlagan sana tekshiriladi. Asosiy ustoz haqiqiy haftalik jadvaldan
  foydalanadi (ayrim oylarda 14 kun chiqishi mumkin). Oylik dars chegarasi KPI da tahrirlanadi;
  `0` — kalendar normasi. Yordamchi uchun mavjud erkin davomatning oylik normasi saqlangan.
- Yordamchi ustoz mustaqil tarifdan foydalanadi (boshlang‘ich qiymat 50 000), asosiy ustoz stavkasidan emas.
- Pul bonuslari `bonusHistory`dagi aniq summa yoki bonus shablonidan olinadi. Sovg‘a/valyuta mukofoti
  so‘mga taxminan aylantirilmaydi; uning so‘mdagi qiymatini admin kiritadi. Sovg‘aning 0 qiymati pul bonusiga kirmaydi.
- Refundni Cash Flow oynasida bitim yoki menejer va til bilan bog‘lang. Eski aniqlanmagan refundlarda
  ogohlantirish chiqadi; ular qaysi xodimga tegishli ekanini taxmin qilib bo‘lmaydi. Bitimdagi refund
  va unga bog‘langan Cash Flow yozuvi ikki marta chegirilmaydi. Keyingi davrda qaytarilgan pul shu davr
  aylanmasi/komissiyasidan chegiriladi. To‘langan davrga keyinchalik tuzatish zarur bo‘lsa, hisobni
  o‘zgartirish emas, kelgusi alohida tuzatish tranzaksiyasi kerak (hozirgi modulda avtomatik clawback yo‘q).

## Saqlash / xavfsizlik

`salary_kpi_settings`, `salary_plan_confirmations`, `salary_transactions`, `salary_audit`
jadvallari va HRdagi `kpi_template_id` ustuni server schema migratsiyasida qo‘shiladi.
Migration mavjud darslar, lidlar, davomat yoki maosh ma’lumotlarini o‘chirmaydi.

Sozlamalar revision bilan, hisoblar server hash bilan tekshiriladi. Mutatsiya va audit bir
tranzaksiyada bajariladi. Payroll tranzaksiyalari advisory lock bilan ketma-ket bajariladi;
snapshot isolation/deadlock xatolari cheklangan marta qayta uriniladi. PostgreSQL JSONB kalit
tartibi o‘zgarsa ham hisob yolg‘ondan eskirgan deb hisoblanmaydi.

Admin/Boshliq va Moliya bo‘limiga HR login orqali bog‘langan xodimlar kiradi. ROP/menejer
faqat o‘z tilidagi reyting daromadini o‘qiy oladi; KPI sozlamalarini o‘zgartira olmaydi.

`Berildi` kassa balansidan pul yechmaydi. `cash_expense_id` kelgusi xarajat tranzaksiyasi bilan
bir-biriga bog‘lash uchun tayyor, takroriy xarajatga yo‘l qo‘ymaslik uchun UNIQUE.
To‘langan kesishuvchi davrni qayta hisoblash/to‘lash bloklanadi. Muqobil oylik/custom davrlarning
to‘lanmagan previewlarini bir vaqtda qarzdorlik jami sifatida qo‘shib hisoblamang.

## Tekshiruv

`node --test scripts/payroll.test.cjs` — formulalar va transaction/auth/audit xatti-harakati
izolyatsiya qilingan ma’lumotlar va DB test adapteri bilan tekshiriladi. Brauzer QA ham test fixture bilan;
haqiqiy o‘quvchi yoki xodim yozuvlarini o‘zgartirmaydi.

Ishlab turgan PostgreSQLda yangi migration va endpointlar deploy bosqichida alohida tekshirilishi kerak.
Bu testlar haqiqiy DB migration sinovining o‘rnini bosmaydi.
