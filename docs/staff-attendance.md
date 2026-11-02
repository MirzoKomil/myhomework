# Xodimlar davomati (Face ID + lokatsiya) va ustozlar dars nazorati

## Qanday ishlaydi
**Ofis xodimi** (sotuv menejeri, administrator, marketolog…) — telefon yoki kompyuterdagi CRM kabineti:
1. HR → Davomat → "Xodimlar va grafik" da xodimga ish vaqti kiritiladi (har kunga alohida).
2. Xodim kabinetida header'da **"Davomat"** tugmasi chiqadi → birinchi marta yuz namunasini yuboradi
   (2 ta rasm) → HR "Tekshirish" orqali tasdiqlaydi. HR o'zi ham "Yuzni olish" bilan olishi mumkin.
3. Har kuni **"Keldim"/"Ketdim"**: server tasodifiy yo'nalish beradi (chapga/o'ngga, bir martalik, 2 daqiqa);
   kamera 3x4 ramkada to'g'ri qaragan rasm, keyin shu tomonga burilgan rasm oladi, GPS bilan yuboriladi.
4. Server tekshiradi: ofis radiusi (yoki ofis IP) → yuz namunaga mosmi → oldin yuborilgan rasm emasmi →
   bosh aynan aytilgan tomonga burildimi va burilgan yuz ham o'shami. HR ko'radigan rasm — aynan
   tekshirilgan kadrning o'zi.
   Vaqt — server vaqti (Toshkent).
5. Holat: vaqtida / kechikdi (X daq) / kelmadi / erta ketdi / ta'til / sababli (HR qo'lda).

**Ustozlar** kamera bilan belgilamaydi va hech narsa bosmaydi:
- Telegram guruhi CRM'ga bog'langan ustoz — guruhdagi **video chat** boshlangan/tugagan vaqt dars
  jadvali bilan solishtiriladi: vaqtida / kech boshladi / erta tugatdi / dars bo'lmadi.
- Guruhi bog'lanmagan ustoz — dars vaqtida o'quvchi davomati **qachon belgilangani** bo'yicha.
- Ketma-ket darslar (tanaffus ≤10 daq) bitta blok sifatida baholanadi.

**Telegram xabarlari** (@Domworkuz_bot orqali, direktor va ROP'ga): kechikdi, kelmadi, erta ketdi,
yuz mos kelmadi, yangi yuz namunasi. Buning uchun ular botga o'z akkauntini ulagan bo'lishi kerak.

## Davomat v2 — Jamoa ilovasi (2026-11, dizayn "Davomat" D00–D18)
- **Kim belgilaydi:** sotuv menejeri, ROP, HR, akademik rahbar (`head-of-teachers`), yordamchi ustoz.
  Asosiy ustoz, targetolog, admin — yo'q (`rules.roleTracked`). Xodimdagi "Davomat kuzatiladi" + grafik baribir shart.
- **Ish vaqtidan tashqari** ilova erkin; bosh kartada "Ofisdaman — hozir belgilash" (erta kelish yoziladi, keyin so'ralmaydi).
- **Ish boshlanganda** to'liq qulf (D02) → kamera (D01) → tabrik (D03, ketma-ket vaqtida kunlar). Holat: `rules.phase`.
- **Ruxsat bilan kech kelish** (tasdiqlangan "Kech qolaman"): ruxsat vaqtigacha qulf yo'q, kechikish yozilmaydi (kun "Sababli").
- **Ofisda emasman** (D05): sabab + selfie, aniq koordinata saqlanmaydi (faqat masofa), holat "Kutilmoqda".
  Rad etilsa — o'sha belgi hisobga olinmaydi, odatdagi qoida (ofisga kelib qayta belgilaydi).
- **Ish tugaganda** ketish oynasi (D06), "Hali ishlayapman" — 30 daqiqa; sotuvda faqat yangi lid harakatlari yopiladi.
- **Javob so'rash** (`staff_att_requests`): kech qolaman / kelmayman / erta ketaman, sabab majburiy.
  Kim tasdiqlaydi: sotuv → o'z tilidagi ROP, yordamchi → o'z tilidagi akademik rahbar, ROP/HR/akademik → direktor.
  Shu tilda ROP / akademik rahbar bo'lmasa — direktorga. Rad etish — sabab majburiy.
  Telegram: tasdiqlovchiga "Tasdiqlash / Rad etish" tugmalari (rad → bot sabab so'raydi), xodimga javob.
- **Push** (Jamoa APK): ishdan 10 daq oldin, boshlanganda belgilanmagan bo'lsa, tugaganda, so'rov javobi; dam olish kunida yo'q.
  Imtiyoz (10 daq) o'tib ham belgilanmasa — o'z rahbariga va direktorga Telegram (`att:notyet`).
- **Ekranlar:** Mening davomatim (D07), Xodimlar / Yordamchilar davomati (D08), kun yozuvi (D09), So'rovlar (D12/D13),
  Ofis joylashuvi (D15, admin). Fayllar: `js/davomatApp.js`, `css/davomatApp.css`.
- **APK 1.1:** kamera va joylashuv ruxsatlari faqat myhomework.uz uchun; birinchi ochilishda ruxsatlar ekrani (D00).
- API: `/me/month`, `/me/day`, `/me/requests` (+ `/:id/cancel`), `/requests`, `/requests/:id/decide`, `/team`, `/team/:id/day`, `/settings/office`.
- Testlar: `node --test scripts/davomat-faceid.test.cjs` (sof qoidalar).
- Tasdiqlovchilar ro'yxati (kim ROP / akademik rahbar, qaysi tilda) `/me` uchun 60 soniya keshlanadi: HR lavozim yoki tilni
  o'zgartirsa, ilovadagi "So'rov boradi" yozuvi ko'pi bilan 1 daqiqa eski ko'rinishi mumkin. Telegram xabari va so'rov
  yo'nalishi saqlash paytida keshsiz hisoblanadi; HR xodimlar ro'yxatini saqlaganda kesh tozalanadi (`clearApproverCache`).
- Javob so'rash va kelish/ketish bitta xodim qulfi ostida (`staff_att:<id>`) — bugungi "kech qolaman" kelish bilan poygaga kirmaydi.

## Qarorlar
- Ofis: Mavr School, Andijon — 40.789035, 72.346787, radius 150 m (HR → Davomat → Sozlamalar).
- Kechikishga imtiyoz 10 daq; ish boshlanib 2 soat o'tib belgilamasa — "kelmadi"; erta ketish imtiyozi 10 daq.
- Hisob grafik yoqilgan va yuz namunasi birinchi tasdiqlangan kundan boshlanadi; o'sha birinchi kuni
  belgilamasa "kelmadi" hisoblanmaydi (o'tgan kunlar orqaga qarab jarimalanmaydi).
- Kirish: admin/boshliq/hr — HR → Davomat bo'limi; ROP — Telegram xabarlari (HR bo'limi CRM'da ROP uchun
  avvaldan yopiq); xodim — faqat o'zini.
- Kompyuterda GPS yo'q: Sozlamalarda ofis internetining tashqi IP manzili kiritilsa, shu internetdan
  belgilash ham qabul qilinadi (IP kiritilmaguncha — telefondan).
- Belgilash rasmlari 90 kun saqlanadi (Postgres'da, Railway diskiga bog'liq emas), keyin o'chiriladi.
  Ofis hududidan tashqaridagi urinishda rasm ham, aniq koordinata ham saqlanmaydi (faqat masofa).
  Ishdan ketgan (nofaol) xodimning yuz namunasi va rasmlari avtomatik o'chiriladi.
- Tugagan kunlar natijasi muzlatiladi: keyin grafik yoki sozlama o'zgarsa ham o'tgan oy raqamlari o'zgarmaydi.
- Erta ketish xabari kun oxirida (oxirgi "ketdim" bo'yicha); "kelmadi"dan keyin kelsa — tuzatish xabari.
- Kuniga 12 ta urinish chegarasi.

## Texnik
- Yuz tekshiruvi serverda: `vendor/face-api` (vladmandic/face-api 1.7.15, MIT) Node'da tfjs cpu bilan,
  npm paketsiz, **alohida worker oqimida** (CRM sekinlashmaydi). Kadr ~3-5 s.
  Bir odam masofasi ~0.2, boshqa odam 0.6+; chegara 0.5 (`STAFF_FACE_THRESHOLD`).
- Fayllar: `server/services/staffAttendance/` (index, rules, time, face, png, notify, lessons),
  `server/routes/staffAttendance.js` (`/api/staff-attendance`), `js/staffAttendanceUI.js`, `css/staffAttendance.css`.
- Jadvallar: `staff_att_*` (server ishga tushganda o'zi yaratadi). Botdagi "Ish jadvali / Face ID"
  menyusi uchun `domwork_bot_face_logs` ga ham yoziladi.
- Testlar: `node --test scripts/staff-attendance.test.cjs`; Postgres bilan:
  `scripts/staff-attendance-postgres.test.cjs` (`scripts/run-payroll-postgres.cjs` orqali).

## Cheklovlar (halol)
- Android'dagi "soxta GPS" ilovalarini 100% ushlab bo'lmaydi; GPS aniqligi va har urinish rasmi
  HR'ga ko'rinadi.
- Tiriklik tekshiruvi qog'ozdagi/ekrandagi suratni va qayta yuborilgan rasmni ushlaydi; tayyorlab
  qo'yilgan chap/o'ng videoni to'liq ushlamaydi.
- "Bosh burilish yo'nalishi" tekshiruvi real telefonlarda birinchi kunlari kuzatilishi kerak: agar
  ko'pchilik "ko'rsatilgan tomonga buring" xatosini olsa, Sozlamalarda bu katakni o'chirish mumkin.
- Ustozlar uchun video chat nazorati faqat bot admin bo'lgan (CRM'ga bog'langan) Telegram guruhlarda ishlaydi.
- Yuz rasmi biometrik ma'lumot — xodimlardan yozma rozilik olinishi kerak.
