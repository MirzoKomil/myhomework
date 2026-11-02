# Jarimalar va ragʻbat (2026-11, dizayn "Jarimalar" J01–J09, mantiq J06)

## Kimlarga
Admin'dan tashqari hamma rol: sotuv, ROP, HR, akademik rahbar, yordamchi ustoz, asosiy ustoz, targetolog.
Har rolga o'z qoidalari; summalarni faqat admin belgilaydi (CRM → Moliya → Jarimalar).

## Qanday yoziladi
- **Davomat jarimalari** (ofis rollari) — avtomatik, davomat kun natijasidan (`server/services/fines` tick, har 5 daq):
  kechikish pog'onalari (imtiyozdan keyin), 3 kun ketma-ket kechikish, ruxsatsiz erta ketish, ketish belgilanmagan, sababsiz kelmaslik.
  Kechikish — kelgan zahoti; kelmaslik/erta ketish/ketish yo'q — kun tugagach. Takror yozilmaydi (`ref` kaliti).
- Tasdiqlangan javob so'rovi (Sababli), ta'til, "Kutilmoqda" — jarima yo'q. Oyning 1-kechikishi — faqat ogohlantirish (0 so'm).
- **Ish jarimalarini** rahbar yozadi (sabab ≥10 belgi va dalil majburiy): ROP — o'z tilidagi sotuv menejerlariga,
  akademik rahbar — o'z tilidagi ustoz va yordamchilarga, admin — hammaga.
- Yozilganda: bot xabari + push, ilovada popup (J04).

## Diktatura emas
- Imtiyoz 5 daq, oylik chegara — maoshning 10% (hisoblangan maosh bo'lsa), "Toza oy" bonusi.
- Faqat egasi, uning rahbari va admin ko'radi; reytingda yo'q.
- E'tiroz — 3 kun ichida; rahbar/admin qabul qilsa jarima bekor, rad etsa (sabab bilan) — o'z holida.

## Yuvish
Qo'shimcha soat (yuz bilan "ketdim" — grafik oxiridan keyingi vaqt), yakshanba navbatchiligi, rahbar vazifasi (summani rahbar belgilaydi),
o'rganish (oyiga 1 marta) — rahbar tasdig'i bilan; 10 ish kuni ketma-ket vaqtida — eng kichik jarima o'zi yuviladi.
Yuvish summasi eng kichik jarimadan boshlab taqsimlanadi. Sababsiz kelmaslik ko'pi bilan 50%. Muddat — keyingi oyning 4-sanasi (maosh 5-sanada).

## Sozlamalar
Admin saqlagan o'zgarish **keyingi oyning 1-sanasidan** kuchga kiradi (`staff_fine_settings.effective`) — o'tgan va joriy oy jarimalari
o'zgarmaydi. Har o'zgarish tarixga yoziladi (`staff_fine_changes`).

## Maosh bilan bog'lanish
- Xodim: Mening jarimalarim — hisoblangan (shakllantirilgan `salary_transactions`) − jarimalar (chegara bilan) + bonus = qo'lga tegadi.
- Admin: Moliya → Maoshlar jadvalida har xodim ostida oy jarimasi va qo'lga tegadigan summa (`POST /api/fines/admin/totals`).
- **Maosh hisobi (payrollEngine, salary_transactions) o'zgartirilmadi** — to'lov paytida admin ayiradi. Avtomatik ayirish keyingi bosqich
  (payroll `accrue` ga `fines.monthTotals` natijasini qo'shish).

## Fayllar
`server/services/fines/{rules,index}.js`, `server/routes/fines.js` (`/api/fines`), `js/jarimaApp.js` (telefon), `js/jarimaAdmin.js` (admin),
`css/jarimaApp.css`. Testlar: `node --test scripts/jarimalar.test.cjs`; Postgres bilan `scripts/jarimalar-postgres.test.cjs`.
