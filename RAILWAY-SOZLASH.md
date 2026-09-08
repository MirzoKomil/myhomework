# Railway sozlash — tashqi API'ni ishga tushirish

`/api/public/crm/*` API'sini jonli saytda yoqish uchun Railway'da
qilinadigan ishlar. Qo'shiladigan **bitta majburiy o'zgaruvchi**:
`PUBLIC_CRM_API_KEY`.

To'liq API hujjati: [API-HUJJAT.md](API-HUJJAT.md)

---

## 1-qadam. To'g'ri servisni toping

1. https://railway.app → **Login**
2. Loyihani oching (`myhomework`)
3. Ichkarida odatda ikkita blok bor:
   - **Node servisi** — ilovaning o'zi (GitHub'ga ulangan)
   - **Postgres** — baza

Kerakli blok — **Node servisi**. Postgres'ning ham Variables bo'limi bor,
lekin unga tegilmaydi.

## 2-qadam. Deploy bo'lganini tekshiring

Node servisi → **Deployments** tabi. Eng yuqoridagi deploy oxirgi commit
bilan va **Success** holatida bo'lishi kerak.

- `Building` bo'lsa — 1–2 daqiqa kuting.
- Yangi deploy umuman yo'q bo'lsa: **Settings → Source** da repozitoriya
  `MirzoKomil/myhomework`, branch `main` ekanini tekshiring.

## 3-qadam. Kalitni qo'shing

Node servisi → **Variables** → **+ New Variable**:

| Katak | Qiymat |
|---|---|
| Name | `PUBLIC_CRM_API_KEY` |
| Value | 64 belgili tasodifiy satr |

Kalitni yaratish:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Yoki:

```bash
openssl rand -hex 32
```

> Bu kalit parol bilan barobar. Chatga/Telegramga tashlamang, skrinshotga
> tushirmang. Faqat Railway Variables ichida va API'dan foydalanadigan
> tizim sozlamalarida tursin.

## 4-qadam. Qayta deploy

Railway odatda o'zgaruvchi saqlangach avtomatik qayta deploy qiladi. Agar
**"Apply changes"** yoki **"Deploy"** tugmasi chiqsa — bosing.

Qayta deploy **shart**: kalit server ishga tushganda bir marta o'qiladi.

## 5-qadam. Tekshiring

```bash
curl -H "X-Api-Key: SIZNING_KALIT" https://myhomework.uz/api/public/crm/sections
```

Kutilgan natija: `"sectionCount": 25` bilan JSON.

Kalitsiz so'rov **401** qaytarishi kerak:

```bash
curl -i https://myhomework.uz/api/public/crm/sections
```

---

## Mavjud o'zgaruvchilar — bularga TEGMANG

| O'zgaruvchi | O'zgartirsangiz nima bo'ladi |
|---|---|
| `DATABASE_URL` | Ilova butunlay ishlamay qoladi |
| `JWT_SECRET` | **Hamma tizimdan chiqib ketadi** — adminlar ham, o'quvchilar ham qayta login qilishga majbur |
| `LEADS_WEBHOOK_SECRET` | Landing sahifalardagi formalar lid yubormay qo'yadi |
| `PUBLIC_SALES_API_KEY` | Reklama tahlil vositasi ma'lumot ololmaydi |
| `CAPI_UZ_TOKEN` | Lidlar Meta Conversions API'ga yuborilmay qoladi |
| `META_*` | Facebook/Instagram lidlari tushmay qoladi |
| `VAPID_*` | Push bildirishnomalar bormay qoladi |

## Koddagi barcha o'zgaruvchilar

**Majburiy:** `DATABASE_URL` (Railway Postgres avtomatik beradi), `JWT_SECRET`

**API kalitlari:** `PUBLIC_CRM_API_KEY`, `PUBLIC_SALES_API_KEY`,
`LEADS_WEBHOOK_SECRET`, `CAPI_UZ_TOKEN`

**Ixtiyoriy:**

| O'zgaruvchi | Nima uchun |
|---|---|
| `ALLOWED_ORIGINS` | CORS. Qo'yilmasa `https://myhomework.uz` |
| `DATABASE_SSL` | Faqat `false` qiymati SSL'ni o'chiradi — Railway'da qo'ymang |
| `PORT` | Railway o'zi beradi — **qo'lda qo'ymang** |
| `DATA_DIR` | Avatar/fayllar papkasi |
| `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_SENDER_NICKNAME` | SMS rassilka |
| `META_APP_SECRET`, `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `META_RUSSIAN_FORM_IDS`, `META_ENGLISH_FORM_IDS`, `META_DEFAULT_LANGUAGE`, `META_GRAPH_API_VERSION` | Meta Lead Ads ([META-SOZLASH.md](META-SOZLASH.md)) |
| `TELEGRAM_LEAD_BOT_TOKEN`, `TELEGRAM_LEAD_WEBHOOK_SECRET`, `TELEGRAM_LEAD_GROUP_CHAT_ID` | Telegram bot orqali lid |
| `CAPI_UZ_URL` | Standart `https://capi.uz/api/inbound` — odatda o'zgartirilmaydi |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Push bildirishnomalar |
| `ADMIN_INIT_PASSWORD` | Admin parolini bir marta tiklash — ishlatgach **darhol o'chiring** |

> `.env.example` da `META_APP_ID` bor, lekin kod uni hech qayerda
> ishlatmaydi — Railway'da bo'lmasa ham muammo yo'q.

---

## Muammolar

| Belgi | Sabab | Yechim |
|---|---|---|
| `503 "API hali sozlanmagan"` | Kalit yo'q yoki bo'sh | 3-qadamni takrorlang + qayta deploy |
| `401 "API kaliti noto'g'ri yoki yo'q"` | Kalit xato yoki sarlavha yuborilmagan | `X-Api-Key` sarlavhasini, kalitda ortiqcha bo'sh joy yo'qligini tekshiring |
| `429` | Daqiqasiga 30 so'rov chegarasi | `pageSize` ni oshirib, kamroq so'rov yuboring |
| `404` + `available` ro'yxati | Bo'lim `id` si xato | Javobdagi `available` dan to'g'risini oling |
| Yangi kod ko'rinmayapti | Deploy bo'lmagan | **Deployments** da oxirgi commit va `Success` ni tekshiring |

Loglar: Node servisi → **Deployments** → oxirgi deploy → **View Logs**.

```
[public-api:crm] QABUL QILINDI  yol=GET /api/public/crm/sections ...
[public-api:crm] RAD ETILDI     yol=GET /api/public/crm/students ... kalit=bor(12 belgi)
[capi] YUBORILDI  lid=<id> bosqich=tolov-yopildi
```

Kalitning o'zi hech qachon logga tushmaydi — faqat uzunligi, IP va manba.

---

## Kalitni almashtirish

1. Yangi kalit yarating (3-qadam)
2. Railway Variables'da `PUBLIC_CRM_API_KEY` qiymatini almashtiring
3. Qayta deploy bo'lishini kuting
4. Yangi kalitni API'dan foydalanadigan tizimga kiriting

Eski kalit shu zahoti ishlamay qoladi. `PUBLIC_SALES_API_KEY` va boshqa
integratsiyalarga ta'sir qilmaydi — kalitlar alohida.
