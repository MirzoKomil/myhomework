# Homework / Domwork → Myhomework CRM

Ikkita MUSTAQIL Netlify loyiha tayyor:

- `domwork`: domwork.uz → rus tili → Yangi lidlar → Organic.
- `homework`: homeworkuz.uz → ingliz tili → Yangi lidlar → Organic.

Har biri `public/index.html`, `public/crm-lead.js`, `netlify/functions/lead.mjs`,
`netlify/lib/lead-handler.mjs`, `netlify.toml` fayllaridan iborat.
Rasmlar/CSS/matnlar/gift/Telegram havolalari asl HTMLdan saqlangan.
Faqat formaning CRM yuborish kodi almashtirilgan. Downloads'dagi asl fayllarga tegilmagan.

## Muhim: bitta HTMLni drag-and-drop qilish yetarli emas

CRM kaliti brauzerga chiqarilmasligi uchun Netlify Function ishlatiladi.
Faqat `public` papkani oddiy drag-and-drop qilsangiz funksiya joylanmaydi;
forma 404 qaytaradi va muvaffaqiyat xabarini KO'RSATMAYDI.
Git orqali Netlify build yoki Netlify CLI orqali static + functions birga deploy qilinsin.

## 1. Server kalitini sozlash

Har bir mavjud Netlify loyihada Environment variables bo'limiga
`LEADS_WEBHOOK_SECRET` qo'shing: qiymati Railway → myhomework xizmatidagi
amaldagi `LEADS_WEBHOOK_SECRET` ro'yxatidan BITTA faol kalit bilan aynan bir xil bo'lsin.
Vergul bilan ajratilgan butun ro'yxatni kiritmang; standart dev kalit ishlatilmaydi.
Runtime uchun Functions scope va deploy qilayotgan kontekst (Production) faol bo'lsin.
Kalitni HTML/JS/netlify.toml/GitHub/chatga yozmang. Bot tokeni kerak EMAS.
Mavjud kalit faol va xavfsiz bo'lsa Railway serverini deploy qilish talab qilinmaydi.
Yangi kalit qo'shilsa, eski kalitlarni saqlab Railway ro'yxatiga qo'shing va
faqat myhomework xizmatini joriy kod versiyasida qayta deploy qiling.
Kalitni o'zgartirsangiz Netlify funksiyalarini qayta deploy qiling.

Netlify hujjati: https://docs.netlify.com/build/functions/environment-variables/

## 2. Mavjud Netlify saytiga joylash

Kerakli loyiha papkasida terminal oching (`domwork` yoki `homework`, `public` emas):

```powershell
npx netlify-cli login
npx netlify-cli link
npx netlify-cli status
```

`link`da YANGI SAYT YARATMANG: mavjud saytingizni tanlang.
Domwork papkasini domwork.uz ulangan loyihaga, Homework papkasini
homeworkuz.uz ulangan loyihaga bog'lang. `status` orqali loyiha mosligini tekshiring.
Production'ga chiqarish:

```powershell
npx netlify-cli deploy --prod --context production --dir public --functions netlify/functions --no-build
```

CLI hujjati: https://cli.netlify.com/commands/deploy/
Git bilan deploy qilsangiz loyiha rootida shu `netlify.toml` bo'lsin;
publish directory `public`, functions directory `netlify/functions`.
Boshqa mavjud konfiguratsiya bo'lsa, uni o'chirmasdan shu qiymatlarni moslashtiring.

GitHub'dagi `myhomework` repozitoriysidan Netlify build qilinsa, Base directory:

- Domwork: `integrations/netlify-landings/domwork`.
- Homework: `integrations/netlify-landings/homework`.

Har birining Publish directory qiymati `public`, Functions directory qiymati
`netlify/functions`. Kalit faqat Netlify Environment variables'da saqlanadi.
GitHub'ga kod yuklanishi Netlify'da Git ulanishini avtomatik sozlamaydi;
mavjud saytlardagi domen va deploy sozlamalari alohida saqlanadi.

Bu paket berilgan HTML fayllaridagi kontentdan tuzilgan. Mavjud Netlify saytida
qo'shimcha PDF/audio/_redirects/_headers yoki boshqa sahifalar bo'lsa, avval ularni
ham `public` ichiga saqlab ko'chiring: deploy faqat paketdagi fayllarni chiqaradi.
Gift URL maydonlari asl fayldagidek bo'sh; mavjud Telegram admin fallback saqlangan.
Oldingi deployni Netlify orqali qayta publish qilish mumkin; asl HTML nusxasi ham saqlansin.

## 3. Tekshirish

- Deploy → Functions ichida `lead` ko'rinsin.
- `https://domwork.uz/.netlify/functions/lead` GET so'rovida 405 kutiladi: bu funksiya borligini ko'rsatadi.
- Homework uchun ham shu endpoint 405 bo'lsin.
- Haqiqiy, rozilik bergan arizani yuboring; muvaffaqiyat faqat CRM `ok:true` va ID qaytarsa chiqadi.
- CRMda mos til → Yangi lidlar ichida Organic yozuv, ism, to'liq telefon,
  qulay vaqt/maqsad/Telegram izohi ko'rinsin.
- Xatoda forma tozalanmaydi, tugma qayta ishlaydi. O'sha formani qayta yuborishda
  bir xil externalId ishlatiladi; CRMning mavjud dublikat tekshiruvi qo'llanadi.
  Sahifa qayta yuklansa yangi ariza IDsi yaratiladi; umumiy telefon bo'yicha dublikatlarni
  birlashtirish va eski yozuvlarni o'zgartirish qilinmagan.
- UTM bo'lsa ham bu ikki forma foydalanuvchi talabiga muvofiq Organic qoladi.
- `+7` uchun 10 ta milliy raqam kesilmaydi. Davlat kodli to'liq raqamni paste
  qilsangiz kod ikki marta qo'shilmaydi. Yuboriladigan xalqaro raqam jami 7–15 xonali.

Netlify Forms avvalgi kabi ikkinchi nusxa uchun ishlatiladi, lekin faqat CRM
tasdiqlagach best-effort yuboriladi; bu nusxa kafolatlanmagan. CRM'ga qo'shimcha
Netlify Forms webhook ulanmang, aks holda ikki xil integratsiya dublikat yaratishi mumkin.
Platformaning mavjud CRM rate-limit'i saqlangan; Netlify funksiya uchun ham IP bo'yicha
10 so'rov/minut limiti belgilangan. Honeypot va origin tekshiruvi to'liq CAPTCHA emas.

## Lokal tekshiruv (haqiqiy lid yubormaydi)

Repo rootidan:

```powershell
node --test scripts/netlify-landings.test.cjs
node scripts/preview-netlify-landings.cjs
```

QA sahifalari: http://127.0.0.1:8791/domwork/ va http://127.0.0.1:8791/homework/.
Bu preview helper haqiqiy CRMga UMUMAN ulanmaydi.

2026-10-14 lokal tekshiruv: 12 ta test o'tdi. Chrome'da 390px mobile va 1440px
desktopda gorizontal overflow yo'q. Domwork xato → forma saqlanishi → qayta
urinish → aynan bir xil ID bilan muvaffaqiyat, Homework UTM bor holda ham English/Organic
oqimi tekshirildi. Asl HTMLning scriptgacha bo'lgan markup/CSS/rasmlari byte-for-byte
bir xil; asl Downloads fayllari o'zgartirilmagan. Transport faqat mock ishlatgan.

## 2026-10-14 production deploy

Ikkala mavjud Netlify sayti yangilandi. Railway myhomework xizmatiga yangi
maxfiy kalit eski kalitni o'chirmasdan qo'shildi; boshqa 21 ta o'zgaruvchi
saqlandi. CRM aynan joriy commit bilan qayta deploy qilindi.
Lokal deploy IDlari va tekshiruv holati `production-backup/deploy-checkpoint.json`da.
`production-backup`, `production-build`, ZIP paketlar va brauzer boshqaruv
yordamchilari GitHub'ga kiritilmaydi; ular deploy uchun shart emas.
Kalit qiymatlari hech qaysi paket, source yoki qayd fayliga yozilmagan.

`node scripts/verify-netlify-landings.cjs` jonli domenlarning sahifa/script,
GET 405, noto'g'ri payload 400, begona origin 403 va CRM ulanishini tekshiradi.
Ulanish probe'i CRMga faqat bo'sh ism yuboradi; CRM buni yozuv yaratishdan
oldin rad etishi shart. Haqiqiy/test lid yaratilmadi, eski CRM yozuvlari
o'zgartirilmadi. Haqiqiy arizaning CRMda paydo bo'lishini alohida, rozilik
bergan ariza bilan kuzatish mumkin.

2026-10-15: ikkala jonli saytdan bittadan TEST ariza yuborildi. Domwork rus tili,
Homework ingliz tili bo'limiga `organic` va `yangi-lidlar` sifatida tushdi.
Tekshiruvdan keyin faqat shu ikki test lid CRMning odatiy o'chirish amali bilan
arxivga o'tkazildi. Qolgan 4 210 ta faol lid o'zgarmagani solishtirib tekshirildi.

## Railway'ga ko'chirish (domwork) — Netlify o'rniga

`domwork` papkasida `server.mjs` + `package.json` bor: bu kichik Node server
`public/` papkani beradi va `/.netlify/functions/lead` manziliga kelgan formani
avvalgidek `lead-handler.mjs` orqali CRM'ga uzatadi. Qo'shimcha paket kerak emas.

1. Railway → comfortable-balance → **+ Create → GitHub Repo → MirzoKomil/myhomework**.
2. Yangi servis → Settings → **Root Directory**: `integrations/netlify-landings/domwork`.
3. Variables: `LEADS_WEBHOOK_SECRET` = myhomework servisidagi ro'yxatdan BITTA faol kalit.
4. Settings → Networking → **Generate Domain** → `*.up.railway.app` manzilida sinab ko'ring
   (bu manzildan ham forma ishlaydi).
5. Settings → Networking → **Custom Domain** → `domwork.uz` (va `www.domwork.uz`).
   Railway ko'rsatgan CNAME/TXT yozuvlarini domen DNS'iga qo'shing.
   Ildiz domen (`domwork.uz`) uchun DNS provayder CNAME flattening/ALIAS'ni
   qo'llashi kerak (masalan Cloudflare). DNS almashguncha Netlify'dagi sayt
   ishlab turadi — uzilish bo'lmaydi.
6. `www.domwork.uz` → `domwork.uz`ga avtomatik yo'naltiriladi.

Mahalliy sinov: `PORT=8799 LOCAL_DEV_ORIGIN=http://localhost:8799 node server.mjs`
