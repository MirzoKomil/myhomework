# Xodimlar davomati (Face ID + lokatsiya) — reja va holat

## Qarorlar (direktor bilan kelishilgan)
- Barcha ofis xodimlari ofisga keladi; ofis bitta: Mavr School, Andijon — 40.789035, 72.346787, radius 150 m (HR sozlamasida o'zgaradi).
- Ish vaqti har xodimga alohida (HR'da hafta kunlari bo'yicha grafik).
- Kechikish/kelmaslik haqida Telegram: direktor (admin/boshliq) + ROP.
- Telefon kamerasi orqali (alohida Face ID qurilma yo'q).
- USTOZLAR kamera bilan belgilamaydi. Ular uchun avtomatik nazorat (variant "c"):
  Telegram guruhdagi video chat boshlanish/tugash vaqti (bot guruhlarda admin) + boshqa platformada
  o'tadiganlar uchun dars vaqtida o'quvchi davomati belgilangan vaqt. Ustoz hech narsa bosmaydi.

## Texnik yechim
- Yuz tekshiruvi SERVERDA: `vendor/face-api` (vladmandic/face-api 1.7.15, MIT) brauzer to'plami Node'da
  tfjs cpu backend bilan, npm paketsiz. `server/services/staffAttendance/face.js`, PNG dekoder `png.js`.
  O'lchov: 360x480 kadr ~4-5 s (yuz+descriptor), faqat burilish kadri ~3 s. Bir xil odam masofasi ~0.2, boshqa ~0.6+; chegara 0.5.
- Tiriklik: 2 kadr — to'g'ri va bosh burilgan; |yaw farqi| >= 0.12, ikkinchi kadrdagi yuz o'lchami mos bo'lishi kerak.
- Lokatsiya: haversine, masofa <= radius + min(aniqlik, 50 m); aniqlik > 200 m bo'lsa rad.
- Vaqt — server vaqti (Asia/Tashkent, UTC+5).
- Rasmlar Postgres'da (bytea, JPEG ~25 KB), 90 kundan keyin o'chiriladi (namuna rasmlar qoladi) — Railway diskiga bog'liq emas.
- Mavjud `domwork_bot_face_logs` ga ham yoziladi (botdagi "Ish jadvali / Face ID" menyusi shuni ko'rsatadi).

## Standart qiymatlar (o'zim tanladim, keyin o'zgartirsa bo'ladi)
- Kechikish imtiyozi 10 daq; boshlanishdan 2 soat o'tib belgilamasa — "kelmadi".
- Yuz namunasi: xodim o'zi yuboradi -> HR tasdiqlaydi (yoki HR o'zi oladi).
- Kirish: admin/boshliq/hr — hammasi; rop — kunlik/oylik jadval faqat ko'rish.

## Qolgan ishlar
1. Jadvallar: staff_att_settings, staff_att_faces, staff_att_schedules, staff_att_events, staff_att_overrides.
2. API `/api/staff-attendance` (me, check, enroll, admin: settings, schedules, daily, monthly, photo, override).
3. Xodim kabineti: header'da "Davomat" tugmasi + modal (kamera 3x4 ramka, burilish, GPS), teamApp'da ham.
4. HR > Davomat paneli (hozir bo'sh joy): kunlik/oylik jadval, grafik, namuna tasdiqlash, sozlamalar.
5. Telegram xabarlar (kechikdi, kelmadi, yuz mos emas) + har 5 daqiqalik tekshiruv.
6. Ustozlar: video chat hodisalari (handlers.js message update: video_chat_started/ended) + davomat vaqti.
7. Testlar (node --test), mahalliy Postgres 16 bilan integratsiya, mustaqil agent baholashi, bitta PR.
