# Myhomework Student App

O'quv markaz o'quvchilari uchun mobil ilova (iOS + Android).

## Texnologiya tanlovi

**React Native (Expo)** — Flutter emas, lekin iOS va Android uchun bitta kod bazasi.

| Sabab | Tafsilot |
|-------|----------|
| Native UI | Flutter kabi Skia canvas emas — haqiqiy iOS/Android komponentlari |
| Silliq ishlash | React Native New Architecture (Fabric) — 60fps animatsiyalar |
| MacBook + iOS | `expo run:ios` yoki EAS Build orqali App Store build |
| Admin panel bilan mos | Mavjud loyiha JavaScript/Express — bir xil til ekotizimi |
| Video, AI, quiz | `expo-av`, streaming, navigatsiya uchun tayyor kutubxonalar |

## Ishga tushirish

```bash
cd student-app
npm install
npm start
```

- **Mobil veb ilova (tavsiya):** `npm run web` — brauzerda telefon ko'rinishida ochiladi
- **Production build:** `npm run build:web` — `dist/` papkasiga statik sayt yig'iladi
- **Server orqali:** loyiha ildizida `npm run student:build`, keyin `npm run dev` → `http://localhost:3000/student`
- **Android emulyator:** `npm run android`
- **iOS (MacBook):** `npm run ios`

Telefonda "Uygulamaga qo'shish" (PWA) orqali asosiy ekranga qo'shish mumkin.

## Navigatsiya tuzilmasi

```
(tabs)
├── Home          — uy ikonkasi
├── Homework      — school ikonkasi
│   ├── Kurslar ro'yxati
│   ├── Roadmap (zigzag dars yo'li)
│   └── Dars
│       ├── Video dars (video + matn)
│       ├── Speaking (talaffuz)
│       └── Quiz (o'yinlar/testlar)
├── Resources     — library ikonkasi
├── AI            — sparkles ikonkasi
└── Profile       — person ikonkasi
    ├── Jadval va davomat
    ├── Baholar
    ├── Sozlamalar
    └── To'lov tarixi
```

## Dizayn

Ranglar va tipografiya `myhomework.uz` admin panelidan olingan (`constants/theme.ts`):

- Asosiy: `#7B61FF` (purple)
- Fon: `#F0F2F8`
- Shrift: Plus Jakarta Sans

## Keyingi qadamlar

1. Backend API bilan integratsiya (`/api/state` yoki alohida student API)
2. Haqiqiy video player (`expo-av`)
3. AI chat — OpenAI/backend proxy
4. Push bildirishnomalar
