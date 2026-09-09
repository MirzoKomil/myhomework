# HR Vakansiya boti — sozlash (18-vazifa)

@Homework_HR_bot orqali kelgan arizalar CRM'ning **HR → Vakansiya**
voronkasiga, "Kandidatlar" ustuniga tushadi.

Kod tayyor va deploy qilingan. Qoladigan ish — Railway'ga o'zgaruvchilarni
qo'yish va webhookni bir marta ulash.

---

## 1-qadam. Railway o'zgaruvchilari

Node servisi → **Variables** → har biri uchun **+ New Variable**:

| Name | Value | Majburiymi |
|---|---|---|
| `TELEGRAM_HR_BOT_TOKEN` | @BotFather bergan token | **Ha** |
| `TELEGRAM_HR_WEBHOOK_SECRET` | 64 belgili tasodifiy satr | **Ha** |
| `HR_BOT_CHANNEL_URL` | `https://t.me/homework_jobss` | Yo'q (standart shu) |
| `HR_BOT_CONTACT_USERNAME` | HR menejerining Telegram useri, `@` siz | Yo'q |
| `HR_BOT_ABOUT_VIDEO_URL` | "Biz haqimizda" video havolasi | Yo'q |

Tasodifiy satr yaratish:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Token va secret — parol bilan barobar. Ular faqat Railway Variables
> ichida turadi, kodga hech qachon yozilmaydi va logga tushmaydi.

O'zgaruvchilarni qo'ygach **Deploy** qiling.

## 2-qadam. Webhookni ulash

Deploy tugagach, CRM'ga admin sifatida kirgan holda **bir marta**:

```bash
curl -X POST https://myhomework.uz/api/hr/bot-webhook/setup \
  -H "Authorization: Bearer <CRM_TOKENINGIZ>"
```

`<CRM_TOKENINGIZ>` — brauzerda CRM ochiq holda F12 → Console →
`localStorage.getItem('mh_token')`.

Javob `{"ok":true,...}` bo'lsa — bot ishga tushdi.

Sozlanish holatini tekshirish (maxfiy qiymatlar ko'rsatilmaydi, faqat
bor/yo'q):

```bash
curl https://myhomework.uz/api/hr/bot-webhook/status \
  -H "Authorization: Bearer <CRM_TOKENINGIZ>"
```

## 3-qadam. Sinash

Telegram'da botni oching → `/start` → **Bo'sh ish o'rinlari** → istalgan
vakansiyani tanlab anketani to'ldiring.

Ariza yakunlangach CRM → **HR Bo'limi → Vakansiya** bo'limida "Kandidatlar"
ustunida kartochka paydo bo'lishi kerak.

Railway loglarida:

```
[hr-bot] ARIZA QABUL QILINDI  id=... vakansiya="Sotuv menejeri" ism="..."
```

---

## Voronka qanday ishlaydi

10 ta ustun (TZ bo'yicha):

```
Kandidatlar → 1-filtrdan o'tdi → Javob bermadi → Qayta aloqa →
Suhbat belgilandi → Suhbatga keldi → Test → Yakuniy suhbat →
Rad javobi berganlar → Filtrdan o'tmaganlar
```

- Kartochkani **sudrab** ustundan ustunga ko'chiring, yoki kartochkani
  ochib pastdagi "Bosqichni o'zgartirish" ro'yxatidan tanlang.
- Kartochkani bosganda to'liq anketa ochiladi: rasm ko'rinadi, ovozli
  xabar shu yerda eshitiladi, video ko'riladi.
- Yuqoridagi ro'yxatdan vakansiya bo'yicha filtrlash mumkin.

## Bot nima so'raydi

**Barcha vakansiyalar uchun (8 ta savol):** ism-familiya → Telegram raqami
(majburiy tugma orqali) → qo'shimcha raqam → manzil → tug'ilgan yil →
noutbuk bormi → ofisga tayyormi → fotosurat.

**Keyin vakansiyaga xos savollar** — Sotuv menejeri uchun 4 ta (ovozli
topshiriq bilan), ROP uchun 5 ta, o'qituvchilar uchun 4-5 ta va h.k.

Rezyume/CV so'ralmaydi. Majburiy obuna anketadan oldin qo'yilmaydi —
kanal havolasi faqat oxirgi ekranda beriladi.

## Muhim texnik qarorlar

**Media Postgres ichida saqlanadi.** Nomzodning rasmi/ovozi/videosi
diskka emas, bazaga yoziladi. Sabab: Railway konteyneri har deployda toza
holatda ko'tariladi va servisga volume ulanmagan bo'lsa diskdagi fayllar
yo'qoladi. HR kartochkasidagi rasm esa oylab kerak bo'lishi mumkin.
Har bir fayl uchun chegara — 20 MB.

**Anketa holati ham bazada.** Konteyner qayta ishga tushsa, nomzod yarim
to'ldirgan anketasini yo'qotmaydi — qayerda to'xtagan bo'lsa, o'sha
joydan davom etadi.

**Har bir savol faqat o'ziga mos javobni qabul qiladi.** Rasm o'rniga matn
kelsa savol qayta so'raladi. Telefon raqami faqat Telegram kontakt
tugmasi orqali olinadi va boshqa odamning kontakti rad etiladi.

---

## Bot boshqa serverda ishlasa

Agar botni alohida serverda yozadigan bo'lsangiz, CRM tayyor webhook
beradi. `HR_WEBHOOK_SECRET` o'zgaruvchisini qo'ying va:

```
POST https://myhomework.uz/api/hr/candidates
X-Webhook-Secret: <HR_WEBHOOK_SECRET>
Content-Type: application/json
```

Tana — TZ 5.2-bandidagi JSON (`full_name` majburiy):

```json
{
  "telegram_user_id": 987654321,
  "telegram_username": "nomzod_login",
  "full_name": "Ism Familiya",
  "telegram_phone": "+998901112233",
  "contact_phone": "+998974445566",
  "address": "Andijon shahri",
  "birth_year": "2001",
  "has_laptop": true,
  "ready_for_office": true,
  "vacancy_name": "Sotuv menejeri",
  "answers": { "sales_experience": "Ha, tajribam bor" },
  "utm_source": "target_instagram"
}
```

## Muammolar

| Belgi | Sabab | Yechim |
|---|---|---|
| Bot javob bermayapti | Token yo'q yoki webhook ulanmagan | 1- va 2-qadamni takrorlang |
| `503 TELEGRAM_HR_BOT_TOKEN o'rnatilmagan` | O'zgaruvchi qo'yilmagan | Railway Variables + deploy |
| Ariza keldi, lekin CRM'da yo'q | Sahifa eski | CRM'ni yangilang (Ctrl+Shift+R) |
| Rasm ko'rinmayapti | Telegram fayli yuklab olinmagan | Loglarda `[hr-bot] ... yuklab olinmadi` ni qidiring |
| "HR bilan aloqa" bo'sh javob beradi | `HR_BOT_CONTACT_USERNAME` qo'yilmagan | O'zgaruvchini qo'shing |
