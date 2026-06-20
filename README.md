# Myhomework.uz — Admin Panel

Ta'lim markazi boshqaruv paneli: ustozlar, o'quvchilar, davomat, maosh (KPI), timetable, to'lovlar va organik lidlar.

## Ishga tushirish

```bash
npm install
cp .env.example .env
npm run dev
```

Brauzer: [http://localhost:3000/login.html](http://localhost:3000/login.html)

**Standart login:** `admin` / `123456` (productionda o'zgartiring)

## Texnologiyalar

- Frontend: HTML, CSS, JavaScript
- Backend: Express.js + SQLite
- Auth: JWT

## API

| Endpoint | Tavsif |
|----------|--------|
| `GET /api/health` | Server holati |
| `POST /api/auth/login` | Kirish |
| `GET /api/state` | Barcha ma'lumotlar |
| `PATCH /api/state` | Ma'lumotlarni saqlash |
| `POST /api/leads` | Domwork/Homework lid webhook |

## Lidlar

- **Domwork** → Rus tili
- **Homework** → Ingliz tili

Integratsiya: `integrations/mh-lead-webhook.js`

## Environment

```
PORT=3000
JWT_SECRET=...
LEADS_WEBHOOK_SECRET=...
```
