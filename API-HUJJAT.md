# CRM API — tashqi tomon uchun

CRM'ning barcha bo'limlarini va ustunlarini tashqi tizimga (BI, hisobot,
Google Sheets, o'z platformangiz) **faqat o'qish** tartibida beradigan API.

Hech qanday yozish/o'zgartirish endpointi **yo'q** — bu API orqali CRM'dagi
biror narsani o'zgartirib bo'lmaydi.

Kod: [`server/routes/publicCrmApi.js`](server/routes/publicCrmApi.js)

---

## 1. Kalit o'rnatish

Railway → Variables (yoki `.env`) ga qo'shing:

```
PUBLIC_CRM_API_KEY=<openssl rand -hex 32 natijasi>
```

O'rnatilmasa API butunlay yopiq qoladi (`503 API hali sozlanmagan`) —
zaxira/standart kalit **yo'q**, atayin.

> **Bu ikkinchi, alohida kalit.** Sotuv voronkasi API'si (`/api/public/sales/*`)
> hamon eski `PUBLIC_SALES_API_KEY` bilan ishlaydi. Reklama tahlil vositasiga
> berilgan sotuv kaliti sizib chiqsa, u butun CRM'ni ocholmasligi kerak.

## 2. So'rov yuborish

Kalit har bir so'rovda sarlavhada yuboriladi — ikkala usul ham ishlaydi:

```bash
curl -H "X-Api-Key: SIZNING_KALIT" https://myhomework.uz/api/public/crm/sections
```

```bash
curl -H "Authorization: Bearer SIZNING_KALIT" https://myhomework.uz/api/public/crm/students
```

Cheklov: **daqiqasiga 30 so'rov** (barcha `/api/public/*` uchun umumiy).

---

## 3. Katalog: `GET /api/public/crm/sections`

Avval shuni o'qing — u barcha bo'limlar va ularning ustunlari ro'yxatini beradi.
Shundan keyin kerakli bo'limni so'raysiz.

```json
{
  "generatedAt": "2026-09-08T09:00:00.000Z",
  "sectionCount": 25,
  "sections": [
    {
      "id": "students",
      "label": "O'quvchilar",
      "crmPath": "O'quvchilar",
      "source": "students",
      "path": "/api/public/crm/students",
      "columnsSource": "fixed",
      "columnCount": 9,
      "columns": [
        { "name": "id",   "type": "string", "label": "ID" },
        { "name": "name", "type": "string", "label": "Ism" }
      ],
      "filters": { "lang": true, "dateRange": null, "ids": true },
      "hiddenFields": ["phone"]
    }
  ],
  "excludedGroups": [ ... ]
}
```

`?counts=1` qo'shsangiz har bir bo'limdagi qatorlar soni (`rowCount`) ham
qo'shiladi — lekin sekinroq, chunki hamma bo'lim yuklanadi.

**`columnsSource`:**

| Qiymat | Ma'nosi |
|---|---|
| `fixed` | SQL jadvali — ustunlar doim bir xil, o'zgarmaydi |
| `derived` | CRM erkin shaklda saqlaydigan bo'lim — ustunlar haqiqiy ma'lumotdan chiqariladi. Bo'lim hali bo'sh bo'lsa `columns` ham bo'sh bo'ladi (bu xato emas) |

---

## 4. Ma'lumot olish: `GET /api/public/crm/<id>`

Har bir bo'lim **bir xil "jadval" shaklida** qaytadi — shuning uchun tashqi
tomon bitta universal parser yozsa, 25 ta bo'limning hammasini o'qiy oladi:

```json
{
  "generatedAt": "2026-09-08T09:00:00.000Z",
  "section": "payments",
  "label": "To'lovlar",
  "crmPath": "Moliya → To'lovlar",
  "source": "payments",
  "columnsSource": "fixed",
  "hiddenFields": [],
  "filters": { "lang": "all", "dateRange": null, "ids": null },
  "total": 1240,
  "page": 1,
  "pageSize": 100,
  "pageCount": 13,
  "columns": [ { "name": "id", "type": "string", "label": "ID" } ],
  "rows":    [ { "id": "p1", "studentId": "s1", "paid": 150000 } ]
}
```

### Filtrlar (hammasi ixtiyoriy)

| Parametr | Misol | Tavsif |
|---|---|---|
| `page` | `?page=3` | Sahifa raqami (1 dan) |
| `pageSize` | `?pageSize=250` | Sahifadagi qatorlar. Standart 100, **maksimum 500** |
| `lang` | `?lang=russian` | `english` yoki `russian`. Faqat kurs tili bor bo'limlarda |
| `from` / `to` | `?from=2026-08-01&to=2026-08-31` | Sana oralig'i (`YYYY-MM-DD`). Faqat biri berilsa — bitta kunlik filtr |
| `ids` | `?ids=s1,s2` | Faqat shu ID'lar |
| `fields` | `?fields=id,name,paid` | Faqat kerakli ustunlar — javob hajmini kamaytiradi |

Qaysi bo'limda qaysi filtr ishlashini `/sections` javobidagi `filters` maydoni
aytadi.

### Misollar

Avgust oyidagi rus tili lidlari:

```bash
curl -H "X-Api-Key: $KEY" \
  "https://myhomework.uz/api/public/crm/leads?lang=russian&from=2026-08-01&to=2026-08-31"
```

Barcha to'lovlarni sahifama-sahifa yig'ish:

```bash
curl -H "X-Api-Key: $KEY" \
  "https://myhomework.uz/api/public/crm/payments?pageSize=500&page=1"
```

Faqat kerakli ustunlar:

```bash
curl -H "X-Api-Key: $KEY" \
  "https://myhomework.uz/api/public/crm/students?fields=id,name,group,teacherId"
```

---

## 5. Bo'limlar ro'yxati (25 ta)

| `id` | Bo'lim | CRM'dagi joyi | Manba |
|---|---|---|---|
| `students` | O'quvchilar | O'quvchilar | `students` |
| `teachers` | Ustozlar | Akademik bo'lim | `teachers` |
| `timetable` | Dars jadvali | Dars jadvali | `timetable` |
| `attendance-main` | Davomat — asosiy ustoz | Akademik → Davomat | `main_attendance` |
| `attendance-assistant` | Davomat — yordamchi ustoz | Akademik → Davomat | `assistant_attendance` |
| `live-grades` | Baholar (jonli) | Akademik → Reyting | `json_data:liveGrades` |
| `sales-managers` | Sotuv menejerlari | Sotuv bo'limi | `sales_managers` |
| `leads` | Lidlar | Sotuv → Lidlar | `leads` |
| `book-roadmap` | Kitob yetkazish | Sotuv → Kitob yetkazish | `book_roadmap` |
| `scripts` | Skriptlar | Sotuv → Skriptlar | `json_data:scripts` |
| `sales-plan` | Sotuv rejasi (jamoaviy) | Sotuv → Sotuv rejasi | `json_data:salesPlan` |
| `individual-sales-plans` | Sotuv rejasi (individual) | Sotuv → Sotuv rejasi | `json_data:individualSalesPlans` |
| `bonus-history` | Berilgan bonuslar tarixi | Sotuv → Reyting | `json_data:bonusHistory` |
| `bonus-data` | Bonus ta'riflari | Sotuv → Reyting | `json_data:bonusData` |
| `target-monitoring-plan` | Target monitoringi rejasi | Marketing → Target | `json_data:targetMonitoringPlan` |
| `target-daily-ad-spend` | Kunlik reklama xarajati | Marketing → Target | `json_data:targetDailyAdSpend` |
| `payments` | To'lovlar | Moliya → To'lovlar | `payments` |
| `cash-flow` | Cash Flow | Moliya → Cash Flow | `json_data:cashFlow` |
| `manual-metrics` | Qo'lda kiritilgan ko'rsatkichlar | Analitika → Xodimlar | `json_data:manualMetrics` |
| `hr-employees` | Xodimlar | HR → Xodimlar | `hr_employees` |
| `org-chart` | Org struktura | HR → Org Struktura | `json_data:orgChart` |
| `guides` | Yo'riqnomalar | Yo'riqnomalar | `json_data:guides` |
| `shop-orders` | Do'kon buyurtmalari | Mobil ilova → Do'kon | `json_data:shopOrders` |
| `mobile-content` | Mobil ilova kontenti (guruhlar va soni) | Mobil ilova → Tahrirlash | `mobile_content` |
| `archive` | Arxiv | Sozlamalar → Arxiv | `json_data:archive` |

---

## 6. Maxfiylik — nima CHIQMAYDI

Bu qasddan qilingan cheklov. Har bir javobda `hiddenFields` maydoni
o'sha bo'limda nima olib tashlanganini aniq aytib turadi.

| Bo'lim | Chiqarilmaydigan ustunlar |
|---|---|
| `hr-employees` | `phone`, `email`, `login`, `avatar`, `birthDate`, `cardNumber`, `passportSeries`, `pinfl`, `address` |
| `students` | `phone` |
| `teachers` | `phone` |
| `book-roadmap` | `phone`, `address` |

**Cash Flow — maosh tranzaksiyalari.** `purpose` qiymati
`"Oylik (xodim maoshi)"` bo'lgan qatorlarda `employeeId` va `person`
tozalanadi va `salaryRecipientHidden: true` belgisi qo'yiladi. Ya'ni
kompaniyaning maoshga ketgan umumiy chiqimi ko'rinadi, lekin **"kim qancha
maosh oldi"** bog'lanishi ko'rinmaydi.

**Butunlay ochilmaydigan guruhlar** (`/sections` javobidagi `excludedGroups`):

| Guruh | Sabab |
|---|---|
| `studentMessages` | O'quvchi ↔ ustoz shaxsiy yozishmalari |
| `peerMessages` | O'quvchilarning o'zaro shaxsiy yozishmalari |
| `studentActivity` | O'quvchining ilovadagi shaxsiy faoliyat jurnali |

> **Lid telefonlari chiqadi.** `leads` bo'limida `phone`/`phone2` bor —
> bu mavjud `/api/public/sales/leads` bilan bir xil xatti-harakat, aniq
> so'rov bo'yicha shunday qilingan.

### Bu ro'yxatni o'zgartirish

Hammasi bitta joyda — [`server/routes/publicCrmApi.js`](server/routes/publicCrmApi.js)
faylining boshidagi `HIDDEN_FIELDS` obyekti. Masalan kitob yetkazish manzili
kerak bo'lsa, `'book-roadmap'` qatoridan `'address'` ni olib tashlash kifoya;
boshqa hech qayerga tegish shart emas.

---

## 7. Xatoliklar

| Kod | Ma'nosi |
|---|---|
| `401` | Kalit yo'q yoki noto'g'ri |
| `404` | Bunday bo'lim yo'q — javobda mavjud `id`lar ro'yxati (`available`) keladi |
| `429` | Daqiqasiga 30 so'rov chegarasidan oshdi |
| `503` | `PUBLIC_CRM_API_KEY` serverda hali o'rnatilmagan |

Har bir qabul qilingan va rad etilgan urinish server loglariga yoziladi
(`[public-api:crm] QABUL QILINDI` / `RAD ETILDI`). Kalitning o'zi hech qachon
logga tushmaydi — faqat uzunligi, IP va manba.

---

## 8. Eski Sotuv API'si

`/api/public/sales/*` o'zgarmadi, avvalgidek ishlaydi:

| Endpoint | Tavsif |
|---|---|
| `GET /api/public/sales/funnel` | Sotuv voronkasi statistikasi |
| `GET /api/public/sales/leads` | Lidlar ro'yxati |
| `GET /api/public/sales/managers` | Menejerlar ro'yxati |

Kalit: `PUBLIC_SALES_API_KEY` (yangi CRM kalitidan alohida).
