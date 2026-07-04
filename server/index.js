require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const stateRoutes = require('./routes/state');
const leadsRoutes = require('./routes/leads');
const { router: uploadsRouter, UPLOADS_DIR } = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

// ── Xavfsizlik middleware'lari ────────────────────────────────────────────────

// Muhim xavfsizlik headerlari: CSP, HSTS, X-Frame-Options, X-Content-Type va h.k.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],   // vanilla JS uchun
            // Helmet standart bo'yicha scriptSrcAttr'ni 'none' qilib qo'yadi (scriptSrc'dan mustaqil
            // ravishda), bu esa butun ilova bo'ylab ishlatiladigan onclick="..." kabi inline
            // atributlarni block qilib qo'yardi (masalan, Skriptlar bo'limida "Tahrirlash" tugmasi).
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
        }
    },
    crossOriginEmbedderPolicy: false,  // rasm/media uchun
}));

// CORS: faqat ruxsat berilgan manzillar
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://myhomework.uz,http://localhost:3000')
    .split(',').map(o => o.trim());

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: ${origin} ruxsat etilmagan`));
    },
    credentials: true
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────

// Login: daqiqada 10 urinish — brute-force oldini oladi
const loginLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Juda ko\'p urinish. 1 daqiqa kutib qayta urining.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,  // muvaffaqiyatli loginlar hisoblanmaydi
});

// API umumiy: minutiga 200 so'rov
const apiLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { error: 'So\'rovlar haddan oshdi. Biroz kuting.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Webhook: minutiga 60 so'rov (lead import uchun)
const webhookLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Webhook so\'rovlar haddan oshdi.' },
});

app.use(express.json({ limit: '6mb' }));

// ── API routes ────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Myhomework.uz API', version: '1.0.0' });
});

app.use('/api/auth/login', loginLimit);
app.use('/api/leads', webhookLimit);
app.use('/api', apiLimit);

app.use('/api/auth', authRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/upload', uploadsRouter);

// ── Static files ──────────────────────────────────────────────────────────────

// ── Uploaded files ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(UPLOADS_DIR, {
    setHeaders: (res, filePath) => {
        // PDF va boshqa hujjatlar brauzerda ko'rinsin (yuklanmasin)
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
}));

const studentWebDist = path.join(ROOT, 'student-app', 'dist');
app.use('/student', express.static(studentWebDist, {
    extensions: ['html'], index: 'index.html', redirect: false
}));
app.get(['/student', '/student/*'], (req, res, next) => {
    if (path.extname(req.path)) return next();
    res.sendFile(path.join(studentWebDist, 'index.html'), err => {
        if (err) res.status(404).send('O\'quvchi ilovasi topilmadi.');
    });
});

app.use(express.static(ROOT, { index: false, extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'login.html')));

// Catch-all: faqat .html fayllar, path traversal himoyasi
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API topilmadi' });
    }
    // /.. yoki boshqa traversal urinishlarni bloklash
    const safePath = req.path.replace(/\.\./g, '').replace(/\/+/g, '/');
    const file = path.join(ROOT, safePath.endsWith('.html') ? safePath : safePath + '.html');
    // ROOT dan tashqariga chiqishga ruxsat bermaslik
    if (!file.startsWith(ROOT)) return res.status(403).send('Ruxsat yo\'q');
    res.sendFile(file, err => {
        if (err) res.status(404).send('Sahifa topilmadi');
    });
});

app.use((err, req, res, next) => {
    if (err.message?.startsWith('CORS:')) {
        return res.status(403).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Server xatoligi' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const { init } = require('./db');

// Ishga tushishda default secretlar haqida ogohlantirish
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'myhomework-dev-secret-change-in-production') {
    console.warn('[XAVFSIZLIK] JWT_SECRET .env da o\'rnatilmagan! Ishlab chiqarish uchun o\'zgartiring.');
}
if (!process.env.LEADS_WEBHOOK_SECRET || process.env.LEADS_WEBHOOK_SECRET === 'myhomework-leads-dev-secret') {
    console.warn('[XAVFSIZLIK] LEADS_WEBHOOK_SECRET .env da o\'rnatilmagan!');
}

init().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Myhomework.uz server: port ${PORT}`);
    });
}).catch(err => {
    console.error('Server ishga tushmadi:', err.message);
    process.exit(1);
});
