# Meta (Facebook/Instagram) Lead Ads → myhomework.uz

Reklamadagi formani to'ldirgan odam bir necha soniyada CRM'ning "Yangi lidlar"
ustunida paydo bo'lishi uchun sozlanadi.

**Kod tomonida hamma narsa tayyor** (`server/routes/meta.js`). Faqat quyidagi
to'rtta o'zgaruvchini Railway'ga qo'yish va Meta tomonida webhook'ni ulash
kerak.

| O'zgaruvchi | Nima |
|---|---|
| `META_APP_SECRET` | Ilova maxfiy kaliti — kelgan xabar haqiqatan Meta'dan ekanini tekshiradi |
| `META_WEBHOOK_VERIFY_TOKEN` | Siz o'ylab topadigan parol — Meta ulanishni tasdiqlaganda ishlatiladi |
| `META_PAGE_ACCESS_TOKEN` | Sahifa tokeni — lid ma'lumotini o'qish uchun |
| `META_PAGE_ID` | Facebook sahifangiz raqami |

> **Bu qiymatlarni hech kimga yubormang** — na chatga, na xabarga. Ular faqat
> Railway → Variables ichida turishi kerak. Ular bilan sizning sahifangiz
> nomidan ish qilish mumkin.

---

## 1. Ilova yaratish (agar yo'q bo'lsa)

1. https://developers.facebook.com/apps → **Create App**
2. Turi: **Business**
3. Nomi: masalan `Homework CRM`

## 2. META_APP_SECRET

App ichida: **App settings → Basic** → `App Secret` qatoridagi **Show**.

Nusxa oling. Bu birinchi qiymat.

## 3. META_WEBHOOK_VERIFY_TOKEN

Buni hech qayerdan olmaysiz — **o'zingiz o'ylab topasiz**. Uzun va tasodifiy
bo'lsin, masalan:

```
hw-meta-2026-x7k2p9qm4t
```

Yozib qo'ying — 5-qadamda aynan shu matn kerak bo'ladi.

## 4. META_PAGE_ID

Facebook sahifangizga kiring → **About** (Ma'lumot) → pastda **Page ID**.

Yoki: https://business.facebook.com/settings/pages → sahifa nomi ostida raqam.

## 5. META_PAGE_ACCESS_TOKEN (muddatsiz)

Eng chalkash qadam shu. Oddiy token 1–2 soatda tugaydi, shuning uchun
**muddatsiz** variantini olish kerak.

### 5.1. Vaqtinchalik token

https://developers.facebook.com/tools/explorer

- **Meta App**: yangi yaratgan ilovangiz
- **User or Page**: `User Token`
- **Permissions** — uchtasini belgilang:
  - `pages_show_list`
  - `pages_manage_metadata`
  - `leads_retrieval`
- **Generate Access Token** → Facebook oynasida ruxsat bering

### 5.2. Uzoq muddatli foydalanuvchi tokeni

Explorer'ning yuqorisidagi manzil qatoriga (GET so'rovi):

```
/oauth/access_token?grant_type=fb_exchange_token&client_id=IIOVA_ID&client_secret=APP_SECRET&fb_exchange_token=5.1_DAGI_TOKEN
```

Javobdagi `access_token` — 60 kunlik foydalanuvchi tokeni.

### 5.3. Muddatsiz sahifa tokeni

5.2 dagi tokenni Explorer'ga qo'yib:

```
/me/accounts
```

Javobda sahifalaringiz ro'yxati keladi. O'z sahifangizni topib, uning
`access_token` qiymatini oling. **Bu muddatsiz** — 5.2 uzoq muddatli
token orqali olingani uchun.

### 5.4. Tekshirish

Explorer'da shu tokenni qo'yib `/me?fields=id,name` so'rang — sahifangiz nomi
chiqishi kerak.

---

## 6. Railway'ga qo'yish

Railway → loyihangiz → **Variables** → to'rtta qatorni qo'shing:

```
META_APP_SECRET            = 2-qadamdagi qiymat
META_WEBHOOK_VERIFY_TOKEN  = 3-qadamda o'ylab topganingiz
META_PAGE_ACCESS_TOKEN     = 5.3 dagi sahifa tokeni
META_PAGE_ID               = 4-qadamdagi raqam
```

**Deploy tugashini kuting** (~2 daqiqa). Bu shart: 7-qadamda Meta serverga
murojaat qiladi, o'zgaruvchilar bo'lmasa `503` oladi.

Tekshirish — CRM'ga kirgan holda brauzer konsolida (F12):

```js
fetch('/api/meta/status',{headers:{Authorization:'Bearer '+localStorage.getItem('mh_token')}}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))
```

`"tayyor": true` va `"sahifa": { "ok": true, "nomi": "..." }` chiqishi kerak.
Chiqmasa, 7-qadamga o'tmang — avval xatoni tuzating.

---

## 7. Webhook'ni ulash

developers.facebook.com → App → **Webhooks** (chap menyu) → yuqoridagi
ro'yxatdan **Page** ni tanlang → **Subscribe to this object**:

- **Callback URL**: `https://myhomework.uz/api/meta/webhook`
- **Verify Token**: 3-qadamda o'ylab topgan matn — **aynan bir xil**, bo'sh
  joysiz
- **Verify and Save**

Meta shu zahoti serverga murojaat qiladi. Muvaffaqiyatli bo'lsa Railway
loglarida:

```
[meta] Webhook TASDIQLANDI
```

Xato chiqsa loglarda sababi ko'rinadi (`verify token mos kelmadi` yoki
`SOZLANMAGAN`).

Keyin maydonlar ro'yxatidan **`leadgen`** yonidagi **Subscribe** ni bosing.

## 8. Sahifani ilovaga obuna qilish

O'sha Webhooks sahifasining pastida sahifangizni tanlab **Subscribe**.

Tekshirish — 6-qadamdagi konsol buyrug'ini qayta ishga tushiring:

```json
"obuna": { "leadgenBor": true }
```

---

## 9. Sinov

Meta'da: **Lead Ads Testing Tool**
(https://developers.facebook.com/tools/lead-ads-testing) → sahifa va formani
tanlab **Create Lead**.

Railway loglarida ko'rinishi kerak:

```
[meta] Webhook KELDI  entry=1 leadgen=1
[meta] LID YARATILDI  leadgen=... id=...
```

CRM → Sotuv bo'limi → Lidlar → **Yangi lidlar** ustunida yangi kartochka
paydo bo'ladi.

---

## Ixtiyoriy: formalarni tilga ajratish

Rus va ingliz formalarini alohida tilga biriktirish uchun (forma ID'lari
vergul bilan):

```
META_RUSSIAN_FORM_IDS = 1234567890,2345678901
META_ENGLISH_FORM_IDS = 3456789012
META_DEFAULT_LANGUAGE = english
```

Qo'ymasangiz, hamma lid `META_DEFAULT_LANGUAGE` bo'yicha (standart: ingliz)
tushadi.

Forma ID'larini `GET /api/meta/recovery/preview` orqali yoki Meta'ning
**Instant Forms** bo'limidan ko'rasiz.

---

## Nima noto'g'ri ketishi mumkin

| Belgi | Sabab |
|---|---|
| `503 Meta webhook sozlanmagan` | Railway o'zgaruvchilari yo'q yoki deploy tugamagan |
| Verify Token xatosi | 3 va 7-qadamdagi matn bir xil emas (ko'pincha ortiqcha bo'sh joy) |
| `[meta] RAD: imzo mos kelmadi` | `META_APP_SECRET` noto'g'ri yoki boshqa ilovadan |
| `"sahifa": { "ok": false }` | Page token muddati tugagan yoki ruxsatlar yetmaydi |
| Loglar jim, hech narsa yo'q | Sahifa ilovaga obuna qilinmagan (8-qadam) yoki `leadgen` belgilanmagan |
| Lid keladi, lekin tili noto'g'ri | Forma ID'lari `META_*_FORM_IDS` ga qo'yilmagan |

## Muhim eslatmalar

- **Ilova "Development" rejimida bo'lsa ham ishlaydi** — agar siz o'sha
  sahifaning administratori bo'lsangiz. Boshqa xodimlar uchun ochilishi kerak
  bo'lsa, App Review'dan `leads_retrieval` uchun ruxsat olinadi.
- **Token muddati.** 5.3 yo'li bilan olingan sahifa tokeni muddatsiz, lekin
  parolni o'zgartirsangiz yoki ruxsatni bekor qilsangiz yaroqsiz bo'ladi.
  O'shanda `/api/meta/status` da `"sahifa": { "ok": false }` chiqadi.
- **Dublikat bo'lmaydi.** Har bir lid Meta'ning `leadgen_id` si bilan
  saqlanadi; Meta xabarni qayta yuborsa ham ikkinchi marta qo'shilmaydi.
