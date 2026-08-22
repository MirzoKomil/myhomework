const { Pool } = require('pg');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const webpush = require('web-push');
const { generateContractPdfBuffer } = require('./services/contractPdf');
const eskiz = require('./services/eskiz');

// 142-ish qayta ish 8: ilova yopiq bo'lsa ham (haqiqiy OS/brauzer darajasidagi)
// bildirishnoma yetkazish uchun Web Push VAPID kalitlari — .env orqali
// almashtirish mumkin, lekin qo'shimcha sozlashsiz ham ishlashi uchun bir
// martalik generatsiya qilingan qiymatlar standart sifatida ishlatiladi.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
    || 'BLKXuHiH8pcCr1YMhQ9xTCSz6pCam_ntLlckzdK1nZH335qYIh99Q4yvtQJfDPrDqZoYouMcTxdrdw7_KHIXBpk';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
    || 'kaNy2-IlX42QM4etyHidLD3PidQUcNUxo-3Vh0T2mvY';
webpush.setVapidDetails('mailto:support@myhomework.uz', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Kutubxona (Grammatika/So'zlar/Talaffuz/Speaking/Podkastlar/Kitoblar) — appning
// statik ma'lumotlaridan bir martalik ko'chirilgan boshlang'ich to'plam. CRM
// tahrirlari bu massivlarga yozilmaydi — ular faqat pastdagi libraryOverrides
// bilan qo'shib o'qiladi (lessonContents'dagi kabi override-pattern).
const LIBRARY_DEFAULTS = require('./data/libraryDefaults.json');

// 41-qism: Rus tili kursi uchun Kutubxonaning boshlang'ich to'plami — ataylab
// bo'sh, chunki LIBRARY_DEFAULTS ingliz tili lug'ati/grammatikasi (masalan
// {"en":"Bee","uz":"Asalari"}) va rus tili uchun soxta tarjima o'ylab
// topilmaydi — admin CRM'ning "Rus tili" tabidan haqiqiy kontentni qo'shadi.
const LIBRARY_DEFAULTS_RU = require('./data/libraryDefaultsRussian.json');

// Homework Shop'ning boshlang'ich mahsulot to'plami — xuddi LIBRARY_DEFAULTS
// kabi bir martalik ko'chirilgan baza, CRM tahrirlari faqat shopOverrides
// orqali qo'shib o'qiladi.
const SHOP_PRODUCTS_DEFAULTS = require('./data/shopProductsDefaults.json');

// ── Connection ───────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
    console.error('[DB] DATABASE_URL muhit o\'zgaruvchisi topilmadi!');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false'
        ? false
        : { rejectUnauthorized: false }
});

pool.on('error', (err) => console.error('[DB] Pool xatoligi:', err.message));

// Fayllar uchun (avatarlar)
const DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Query helpers ────────────────────────────────────────────────────────────

async function q(text, params = []) {
    const { rows } = await pool.query(text, params);
    return rows;
}

async function q1(text, params = []) {
    const { rows } = await pool.query(text, params);
    return rows[0] || null;
}

async function tx(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await fn(client);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// ── Schema ───────────────────────────────────────────────────────────────────

async function initSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            phone TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            location TEXT DEFAULT '',
            avatar TEXT DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            jti TEXT UNIQUE NOT NULL,
            user_agent TEXT DEFAULT '',
            ip TEXT DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            last_seen TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS teachers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            subject TEXT NOT NULL DEFAULT 'english',
            phone TEXT DEFAULT '',
            schedule_pattern TEXT DEFAULT 'mwf',
            lesson_duration INTEGER DEFAULT 15
        );

        CREATE TABLE IF NOT EXISTS sales_managers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            group_name TEXT DEFAULT '',
            subject TEXT NOT NULL DEFAULT 'english',
            teacher_id TEXT,
            assistant_teacher_id TEXT,
            lesson_day_of_week INTEGER,
            lesson_time TEXT DEFAULT '',
            lesson_duration INTEGER DEFAULT 15
        );

        CREATE TABLE IF NOT EXISTS timetable (
            slot_key TEXT PRIMARY KEY,
            date TEXT,
            time TEXT,
            view_key TEXT,
            teacher_id TEXT,
            sales_manager_id TEXT,
            student_id TEXT,
            completed INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS main_attendance (
            att_key TEXT NOT NULL,
            student_id TEXT NOT NULL,
            day INTEGER NOT NULL,
            present INTEGER DEFAULT 1,
            PRIMARY KEY (att_key, student_id, day)
        );

        CREATE TABLE IF NOT EXISTS assistant_attendance (
            att_key TEXT NOT NULL,
            student_id TEXT NOT NULL,
            day INTEGER NOT NULL,
            present INTEGER DEFAULT 1,
            PRIMARY KEY (att_key, student_id, day)
        );

        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            student_id TEXT,
            platform INTEGER DEFAULT 0,
            book INTEGER DEFAULT 0,
            paid INTEGER DEFAULT 0,
            debt INTEGER DEFAULT 0,
            date TEXT
        );

        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            phone2 TEXT DEFAULT '',
            email TEXT DEFAULT '',
            manager_id TEXT DEFAULT '',
            source TEXT DEFAULT 'Organik',
            language TEXT NOT NULL,
            date TEXT,
            external_id TEXT,
            status TEXT DEFAULT 'new',
            lead_type TEXT DEFAULT 'organic',
            comments TEXT DEFAULT '[]',
            attachments TEXT DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            deleted_by TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS lead_audit (
            id BIGSERIAL PRIMARY KEY,
            lead_id TEXT NOT NULL,
            action TEXT NOT NULL,
            actor_id TEXT DEFAULT '',
            actor_name TEXT DEFAULT '',
            snapshot JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS hr_employees (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            first_name TEXT DEFAULT '',
            last_name TEXT DEFAULT '',
            role TEXT NOT NULL DEFAULT 'employee',
            login TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            department TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            join_date TEXT DEFAULT '',
            gender TEXT DEFAULT '',
            birth_date TEXT DEFAULT '',
            start_date TEXT DEFAULT '',
            card_number TEXT DEFAULT '',
            passport_series TEXT DEFAULT '',
            pinfl TEXT DEFAULT '',
            address TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS user_sales_manager_links (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            manager_id TEXT NOT NULL UNIQUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS book_roadmap (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            student_id TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            region TEXT DEFAULT '',
            manager_id TEXT DEFAULT '',
            kind TEXT DEFAULT 'organik',
            status TEXT DEFAULT 'yangi-oquvchi',
            date TEXT DEFAULT '',
            lang TEXT DEFAULT 'english',
            lead_ref TEXT DEFAULT NULL,
            comments TEXT DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS mobile_content (
            singleton INTEGER PRIMARY KEY DEFAULT 1,
            data JSONB NOT NULL DEFAULT '{"videos":[],"documents":[],"courses":[],"lessons":[]}'
        );

        CREATE TABLE IF NOT EXISTS mobile_content_backups (
            id SERIAL PRIMARY KEY,
            reason TEXT NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS json_data (
            key TEXT PRIMARY KEY,
            data JSONB NOT NULL DEFAULT '[]'
        );
    `);

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_external
        ON leads(source, external_id)
        WHERE external_id IS NOT NULL
    `).catch(() => {});
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_lead_audit_lead_created
        ON lead_audit(lead_id, created_at DESC)
    `).catch(() => {});

    // Migration: book_roadmap jadvaliga yangi ustunlar qo'shish
    await pool.query(`ALTER TABLE book_roadmap ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'english'`).catch(() => {});
    await pool.query(`ALTER TABLE book_roadmap ADD COLUMN IF NOT EXISTS lead_ref TEXT DEFAULT NULL`).catch(() => {});
    // 124-ish: haqiqiy yetkazib berish manzili va bosqich sanalarini saqlash uchun
    await pool.query(`ALTER TABLE book_roadmap ADD COLUMN IF NOT EXISTS address TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE book_roadmap ADD COLUMN IF NOT EXISTS dispatched_at TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE book_roadmap ADD COLUMN IF NOT EXISTS delivered_at TEXT DEFAULT ''`).catch(() => {});

    // Migration: hr_employees jadvaliga yangi ustunlar qo'shish
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS birth_date TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS start_date TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS card_number TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS passport_series TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS pinfl TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS address TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'english'`).catch(() => {});
    // 24-vazifa: asosiy o'qituvchining sinov darsi Telegram guruhi havolasi
    await pool.query(`ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS trial_group_link TEXT DEFAULT ''`).catch(() => {});

    // Migration: leads va students jadvallariga extra_data qo'shish
    await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'`).catch(() => {});
    // 200+ lid yo'qolgan hodisadan keyingi himoya: lidlar endi hard-delete
    // qilinmaydi va har bir row-level o'zgarish audit tarixiga yoziladi.
    await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`).catch(() => {});
    await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`).catch(() => {});
    await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'`).catch(() => {});

    // Mavjud sotuv-menejeri loginlarini bir marta barqaror manager ID bilan
    // bog'laymiz. Keyingi profil nomi o'zgarishi authorization'ga ta'sir
    // qilmaydi. Bir xil ismli xodimlar avtomatik bog'lanmaydi (fail closed).
    await pool.query(`
        INSERT INTO user_sales_manager_links (user_id, manager_id)
        SELECT u.id, managers.id
        FROM users u
        JOIN (
            SELECT MIN(id) AS id, LOWER(TRIM(name)) AS name_key
            FROM hr_employees
            WHERE LOWER(REPLACE(REPLACE(TRIM(role), '_', '-'), ' ', '-'))
                  IN ('sotuv-menejeri', 'sales-manager')
            GROUP BY LOWER(TRIM(name))
            HAVING COUNT(*) = 1
        ) managers ON managers.name_key = LOWER(TRIM(u.name))
        WHERE u.role = 'sales_manager'
        ON CONFLICT DO NOTHING
    `).catch(() => {});
    await pool.query(`
        INSERT INTO user_sales_manager_links (user_id, manager_id)
        SELECT u.id, managers.id
        FROM users u
        JOIN (
            SELECT MIN(id) AS id, LOWER(TRIM(name)) AS name_key
            FROM sales_managers
            GROUP BY LOWER(TRIM(name))
            HAVING COUNT(*) = 1
        ) managers ON managers.name_key = LOWER(TRIM(u.name))
        WHERE u.role = 'sales_manager'
          AND NOT EXISTS (
              SELECT 1 FROM user_sales_manager_links link WHERE link.user_id = u.id
          )
        ON CONFLICT DO NOTHING
    `).catch(() => {});

    // Boshlang'ich mobile_content qatori
    await pool.query(
        `INSERT INTO mobile_content (singleton, data) VALUES (1, $1) ON CONFLICT (singleton) DO NOTHING`,
        [JSON.stringify({ videos: [], documents: [], courses: [], lessons: [], modules: [], moduleContents: [] })]
    );

    // Boshlang'ich hamjamiyat (community) postlari — ilgari appda faqat
    // qurilma xotirasida (AsyncStorage) yashagan namuna postlar endi
    // serverda saqlanadi, shunda CRM ham ularni ko'rib, o'chira oladi.
    await pool.query(
        `INSERT INTO json_data (key, data) VALUES ('communityPosts', $1) ON CONFLICT (key) DO NOTHING`,
        [JSON.stringify(COMMUNITY_SEED_POSTS())]
    );
}

function COMMUNITY_SEED_POSTS() {
    const now = Date.now();
    const day = 1000 * 60 * 60 * 24;
    return [
        {
            id: 'p0', authorName: "Homework.uz jamoasi", authorEmoji: '📢',
            createdAt: now - day * 1,
            text: "Assalomu alaykum, aziz o'quvchilar! Yangi 'Speaking Battle' rejimi ilovaga qo'shildi — endi boshqa o'quvchilar bilan jonli musobaqalasha olasiz. Sinab ko'ring! 🏆",
            imageUri: null, likeCount: 42, likedByMe: false, shareCount: 5, viewCount: 310,
            comments: [], official: true,
        },
        {
            id: 'p1', authorName: 'Azizbek', authorEmoji: '🧑',
            createdAt: now - day * 2,
            text: "Bugun Present Perfect mavzusini yakunladim! Dastlab juda chalkash tuyulgan edi, lekin videodarslardagi misollar juda yordam berdi 💪",
            imageUri: null, likeCount: 14, likedByMe: false, shareCount: 1, viewCount: 86,
            comments: [
                { id: 'c1', postId: 'p1', parentId: null, authorName: 'Zarina', authorEmoji: '👩', createdAt: now - 1000 * 60 * 60 * 20, text: "Zo'r! Menga ham shu mavzu ancha qiyin bo'lgandi 😄", likeCount: 3, likedByMe: false },
                { id: 'c2', postId: 'p1', parentId: 'c1', authorName: 'Azizbek', authorEmoji: '🧑', createdAt: now - 1000 * 60 * 60 * 18, text: 'Rahmat! Ha, mashq qilgan sari osonlashadi', likeCount: 1, likedByMe: false },
            ],
        },
        {
            id: 'p2', authorName: 'Madina', authorEmoji: '👩‍🦱',
            createdAt: now - day * 4,
            text: "So'zlar ro'yxatidagi yangi 20 ta so'zni yodladim. Kim menga hamroh bo'lib, birga mashq qilishni xohlaydi? 📚",
            imageUri: null, likeCount: 9, likedByMe: false, shareCount: 0, viewCount: 54,
            comments: [
                { id: 'c3', postId: 'p2', parentId: null, authorName: 'Diyor', authorEmoji: '🧑‍🦰', createdAt: now - day * 3, text: "Men ham qo'shilaman!", likeCount: 2, likedByMe: false },
            ],
        },
        {
            id: 'p3', authorName: 'Sardor', authorEmoji: '🧔',
            createdAt: now - day * 7,
            text: "Speaking Battle'da birinchi marta g'alaba qozondim! Juda qiziqarli o'yin ekan 🏆",
            imageUri: null, likeCount: 21, likedByMe: false, shareCount: 2, viewCount: 130,
            comments: [
                { id: 'c4', postId: 'p3', parentId: null, authorName: 'Gulnoza', authorEmoji: '🧕', createdAt: now - day * 6, text: 'Tabriklayman! 🎉', likeCount: 4, likedByMe: false },
                { id: 'c5', postId: 'p3', parentId: null, authorName: 'Kamila', authorEmoji: '👱‍♀️', createdAt: now - day * 5, text: 'Men ham urinib ko\'raman', likeCount: 1, likedByMe: false },
            ],
        },
    ];
}

// ── Seed & migrate ───────────────────────────────────────────────────────────

async function migrateAdminPassword() {
    const admin = await q1("SELECT * FROM users WHERE email = 'admin'");
    if (!admin) return;
    const target = process.env.ADMIN_INIT_PASSWORD || 'admin123';
    const needsMigrate = bcrypt.compareSync('123456', admin.password_hash);
    const forceReset = !!process.env.ADMIN_INIT_PASSWORD && !bcrypt.compareSync(target, admin.password_hash);
    if (needsMigrate || forceReset) {
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2',
            [bcrypt.hashSync(target, 10), admin.id]);
        console.log('[DB] Admin paroli yangilandi');
    }
}

// CRM'da "To'g'ri variant raqami (0 dan boshlab)" maydoni oddiy son kiritish
// edi — odamlar tabiiy ravishda 1-variantni "1" deb yozgan (0 emas), shu
// sabab deyarli barcha mavjud test savollarida to'g'ri javob sifatida
// haqiqiy to'g'ri variantdan BITTA KEYINGI variant belgilangan edi (o'quvchi
// to'g'ri javobni tanlasa ham "noto'g'ri" chiqardi). CRM maydoni endi variant
// matnini tanlash uchun select'ga almashtirildi (yangi savollarda bu xato
// mumkin emas), bu funksiya esa MAVJUD saqlangan savollarni bir martalik
// tuzatadi: correctIndex >= 1 bo'lgan har bir savolda 1 ga kamaytiriladi
// (correctIndex === 0 bo'lganlar — ehtimol allaqachon to'g'ri kiritilgan —
// tegilmaydi, chunki ularni kamaytirish -1 kabi noto'g'ri holatga olib
// keladi). Tuzatishdan oldin butun mobile_content qatori
// mobile_content_backups'ga saqlanadi, shunda xato bo'lsa qaytarish mumkin.
async function migrateMultipleChoiceCorrectIndex() {
    const row = await q1('SELECT data FROM mobile_content WHERE singleton = 1');
    if (!row) return;
    const mc = row.data;
    if (mc._correctIndexFixedAt) return; // bir marta ishlaydi

    let fixedCount = 0;
    let leftAtZeroCount = 0;
    let outOfRangeCount = 0;

    function fixQuestions(questions) {
        (questions || []).forEach(q => {
            const optCount = (q.options || []).length;
            if (typeof q.correctIndex !== 'number' || !optCount) return;
            if (q.correctIndex < 0 || q.correctIndex >= optCount) { outOfRangeCount++; return; }
            if (q.correctIndex === 0) { leftAtZeroCount++; return; }
            q.correctIndex -= 1;
            fixedCount++;
        });
    }

    for (const store of [mc.lessonContents, mc.examContents]) {
        if (!store) continue;
        for (const content of Object.values(store)) {
            (content.homeworkParts || []).forEach(part => {
                if (part.kind === 'multipleChoice') fixQuestions(part.questions);
            });
            if (Array.isArray(content.questions)) {
                fixQuestions(content.questions.filter(q => q.kind === 'multipleChoice'));
            }
        }
    }

    if (fixedCount === 0 && leftAtZeroCount === 0 && outOfRangeCount === 0) {
        mc._correctIndexFixedAt = new Date().toISOString();
        await saveMobileContentData(pool, mc);
        return;
    }

    await pool.query(
        `INSERT INTO mobile_content_backups (reason, data) VALUES ($1, $2)`,
        ['pre-correctIndex-fix', JSON.stringify(row.data)]
    );

    mc._correctIndexFixedAt = new Date().toISOString();
    mc._correctIndexFixStats = { fixedCount, leftAtZeroCount, outOfRangeCount };
    await saveMobileContentData(pool, mc);
    console.log(`[DB] Test javoblarini tuzatish: ${fixedCount} ta tuzatildi, ${leftAtZeroCount} ta 0-indeks holida qoldirildi (qo'lda tekshiring), ${outOfRangeCount} ta noto'g'ri (variantlar sonidan tashqarida) topildi. Zaxira: mobile_content_backups jadvali.`);
}

// migrateMultipleChoiceCorrectIndex avtomatik hal qila olmagan (correctIndex
// === 0 yoki variantlar sonidan tashqarida) 27 ta savol qo'lda (ruscha/
// inglizcha grammatikasini har birini alohida tekshirib) tasdiqlangan
// to'g'ri javob bilan bir martalik moslashtiriladi. Har bir yozuv
// (contentId, partId, variantlar ro'yxati, hozirgi noto'g'ri correctIndex)
// bo'yicha aniq mos kelgan holatdagina qo'llaniladi — mos kelmasa
// (ma'lumot allaqachon boshqacha tuzatilgan bo'lsa) o'sha yozuv o'tkazib
// yuboriladi, hech narsa noto'g'ri bosilib yozilmaydi.
const MC_MANUAL_FIXES = [
    { contentId: 'l1782765128275', partId: 'C', options: ['Important', 'Improve', 'Idea', 'Income'], oldIndex: 0, newIndex: 0 },
    { contentId: 'l1782765128275', partId: 'C', options: ['plays', 'play', 'playing', 'played'], oldIndex: 0, newIndex: 1 },
    { contentId: 'l1782765128275', partId: 'C', options: ['Weak', 'Strong', 'Soft', 'Slow'], oldIndex: 0, newIndex: 1 },
    { contentId: 'l1782765128275', partId: 'C', options: ['has', 'have', 'having', 'had'], oldIndex: 0, newIndex: 1 },
    { contentId: 'l1783004411232', partId: 'multipleChoice-1786963272697', options: ['Привет', 'Меня', 'Как', 'Добрый'], oldIndex: 4, newIndex: 3 },
    { contentId: 'l1783004411232', partId: 'multipleChoice-1786963272697', options: ['[мужчина]', '[мучина]', '[мужкина]', '[мущина]'], oldIndex: 4, newIndex: 3 },
    { contentId: 'l1784055280406-1', partId: 'multipleChoice-1786954734196', options: ['учитесь', 'живёте', 'читаете', 'зовут'], oldIndex: 0, newIndex: 1 },
    { contentId: 'l1784055280406-1', partId: 'multipleChoice-1786954734196', options: ['машына', 'жызнь', 'машина', 'кныга'], oldIndex: 4, newIndex: 2 },
    { contentId: 'l1784055280406-1', partId: 'multipleChoice-1786954734196', options: ['год', 'года', 'лет', 'зовут'], oldIndex: 4, newIndex: 2 },
    { contentId: 'l1784055280406-2', partId: 'multipleChoice-1786955819445', options: ['Ты', 'Я', 'Он', 'Мы'], oldIndex: 0, newIndex: 1 },
    { contentId: 'l1784055280406-2', partId: 'multipleChoice-1786955819445', options: ['Она', 'Ты', 'Они', 'Я'], oldIndex: 4, newIndex: 2 },
    { contentId: 'l1784055280406-2', partId: 'multipleChoice-1786955819445', options: ['Мы', 'Они', 'Вы', 'Он'], oldIndex: 4, newIndex: 2 },
    { contentId: 'l1784055280406-2', partId: 'multipleChoice-1786955819445', options: ['У нас', 'У них', 'У него', 'У тебя'], oldIndex: 4, newIndex: 2 },
    { contentId: 'l1784055280406-2', partId: 'multipleChoice-1786955819445', options: ['У меня', 'У тебя', 'У вас', 'У неё'], oldIndex: 4, newIndex: 2 },
    { contentId: 'l1784055280406-2', partId: 'multipleChoice-1786956477307', options: ['у тебя', 'я', 'у меня'], oldIndex: 3, newIndex: 2 },
    { contentId: 'l1784055280406-2', partId: 'multipleChoice-1786956477307', options: ['у вас', 'мы', 'у нас'], oldIndex: 3, newIndex: 2 },
    { contentId: 'l1784055280406-3', partId: 'multipleChoice-1786954734196', options: ['я', 'тебя', 'него', 'меня'], oldIndex: 4, newIndex: 3 },
    { contentId: 'l1784055280406-3', partId: 'multipleChoice-1786954734196', options: ['книга', 'машина', 'собака', 'ноутбук'], oldIndex: 4, newIndex: 3 },
    { contentId: 'l1784055280406-4', partId: 'multipleChoice-1786962004202', options: ['понимаешь', 'понимаю', 'понимаете'], oldIndex: 3, newIndex: 2 },
    { contentId: 'l1784055280406-4', partId: 'multipleChoice-1786962004202', options: ['играет', 'играешь', 'играют'], oldIndex: 3, newIndex: 2 },
    { contentId: 'l1784055280406-4', partId: 'multipleChoice-1786962004202', options: ['гуляешь', 'гуляют', 'гуляете'], oldIndex: 3, newIndex: 2 },
    { contentId: 'l1784055280406-5', partId: 'multipleChoice-1786954734196', options: ['работаем', 'работают', 'работаешь', 'работает'], oldIndex: 4, newIndex: 3 },
    { contentId: 'l1784055280406-5', partId: 'multipleChoice-1786954734196', options: ['думаешь', 'думают', 'думаю', 'думает'], oldIndex: 4, newIndex: 3 },
    { contentId: 'l1784055280406-5', partId: 'multipleChoice-1786954734196', options: ['отдыхают', 'отдыхаешь', 'отдыхаем', 'отдыхаете'], oldIndex: 4, newIndex: 3 },
    { contentId: 'l1784055280406-5', partId: 'multipleChoice-1786954734196', options: ['я', 'мы', 'она', 'он'], oldIndex: 4, newIndex: 3 },
    { contentId: 'l1784055280406-5', partId: 'multipleChoice-1786965601889', options: ['работаем', 'работают', 'работаешь', 'работает'], oldIndex: 4, newIndex: 3 },
    { contentId: 'l1784055280406-5', partId: 'multipleChoice-1786965601889', options: ['гуляешь', 'гуляют', 'гуляю', 'гуляете'], oldIndex: 4, newIndex: 3 },
    { contentId: 'l1784055280406-5', partId: 'multipleChoice-1786965601889', options: ['думаешь', 'думают', 'думаю', 'думает'], oldIndex: 4, newIndex: 3 },
];

async function migrateMultipleChoiceManualFixes() {
    const row = await q1('SELECT data FROM mobile_content WHERE singleton = 1');
    if (!row) return;
    const mc = row.data;
    if (mc._correctIndexManualFixedAt) return; // bir marta ishlaydi

    let appliedCount = 0;
    let skippedCount = 0;

    function applyTo(contentId, partId, questions) {
        (questions || []).forEach(q => {
            const match = MC_MANUAL_FIXES.find(fx =>
                fx.contentId === contentId && fx.partId === partId &&
                q.correctIndex === fx.oldIndex &&
                Array.isArray(q.options) && q.options.length === fx.options.length &&
                q.options.every((opt, i) => opt === fx.options[i])
            );
            if (!match) return;
            q.correctIndex = match.newIndex;
            appliedCount++;
        });
    }

    for (const store of [mc.lessonContents, mc.examContents]) {
        if (!store) continue;
        for (const [contentId, content] of Object.entries(store)) {
            (content.homeworkParts || []).forEach(part => {
                if (part.kind === 'multipleChoice') applyTo(contentId, part.id, part.questions);
            });
            if (Array.isArray(content.questions)) {
                applyTo(contentId, null, content.questions.filter(q => q.kind === 'multipleChoice'));
            }
        }
    }
    skippedCount = MC_MANUAL_FIXES.length - appliedCount;

    await pool.query(
        `INSERT INTO mobile_content_backups (reason, data) VALUES ($1, $2)`,
        ['pre-correctIndex-manual-fix', JSON.stringify(row.data)]
    );

    mc._correctIndexManualFixedAt = new Date().toISOString();
    mc._correctIndexManualFixStats = { appliedCount, skippedCount };
    await saveMobileContentData(pool, mc);
    console.log(`[DB] Qo'lda tasdiqlangan test javoblari: ${appliedCount} ta qo'llandi, ${skippedCount} ta mos kelmadi (o'tkazib yuborildi).`);
}

// 1-vazifa: CRM'da tasodifiy/joyni to'ldirish uchun kiritilgan kurs nomi
// ("Kdkslamdnc") to'g'ri nomga bir martalik almashtiriladi.
async function migrateRenameGarbledCourse() {
    const row = await q1('SELECT data FROM mobile_content WHERE singleton = 1');
    if (!row) return;
    const mc = row.data;
    if (mc._courseRenameFixedAt) return; // bir marta ishlaydi

    const course = (mc.courses || []).find(c => c.lang === 'russian' && c.name === 'Kdkslamdnc');
    if (course) {
        course.name = "Rus tilida 90 kunda gapiring";
        mc._courseRenameFixedAt = new Date().toISOString();
        await saveMobileContentData(pool, mc);
        console.log('[DB] Kurs nomi tuzatildi: "Kdkslamdnc" -> "Rus tilida 90 kunda gapiring"');
    } else {
        mc._courseRenameFixedAt = new Date().toISOString();
        await saveMobileContentData(pool, mc);
        console.log('[DB] Kurs nomi tuzatish: "Kdkslamdnc" topilmadi (ehtimol allaqachon o\'zgartirilgan).');
    }
}

async function seedIfEmpty() {
    const row = await q1('SELECT COUNT(*) AS c FROM users');
    const count = parseInt(row.c, 10);
    if (count > 0) {
        await migrateAdminPassword();
        await cleanExpiredSessions();
        return;
    }
    console.log('[DB] Boshlang\'ich ma\'lumotlar yaratilmoqda...');
    await tx(async (client) => {
        await client.query(
            'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
            [randomUUID(), 'Asosiy Admin', 'admin', bcrypt.hashSync('admin123', 10), 'admin']
        );
        const teachers = [
            ['t1', 'Saida Rustamaliyeva', 'asosiy', 'english', '', 'mwf', 15],
            ['t2', 'Zulayho Majitova', 'asosiy', 'english', '', 'tts', 15],
            ['t3', 'Zokir', 'asosiy', 'russian', '', 'mwf', 30],
            ['t4', 'Yordamchi (Ingliz)', 'yordamchi', 'english', '', 'tts', 15],
            ['t5', 'Yordamchi (Rus)', 'yordamchi', 'russian', '', 'mwf', 15],
        ];
        for (const t of teachers) {
            await client.query(
                'INSERT INTO teachers (id, name, type, subject, phone, schedule_pattern, lesson_duration) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                t
            );
        }
        const students = [
            ['s1', 'Eliboy', '93978310191', 'English', 'english', 't2', null, 2, '10:00', 15],
            ['s2', 'Umar', '93697373263', 'English', 'english', 't2', null, 4, '11:00', 30],
            ['s3', 'Aziz', '901234567', 'Russian', 'russian', 't3', null, 1, '09:00', 30],
        ];
        for (const s of students) {
            await client.query(
                'INSERT INTO students (id, name, phone, group_name, subject, teacher_id, assistant_teacher_id, lesson_day_of_week, lesson_time, lesson_duration) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
                s
            );
        }
    });
    console.log('[DB] Boshlang\'ich ma\'lumotlar yaratildi. Login: admin | Parol: admin123');
}

// ── Row mappers ──────────────────────────────────────────────────────────────

function rowToTeacher(r) {
    return {
        id: r.id, name: r.name, type: r.type, subject: r.subject,
        phone: r.phone || '', schedulePattern: r.schedule_pattern,
        lessonDuration: r.lesson_duration
    };
}

function rowToStudent(r) {
    let extra = {};
    try {
        if (r.extra_data) {
            extra = typeof r.extra_data === 'object' ? r.extra_data : JSON.parse(r.extra_data);
        }
    } catch {}
    return {
        ...extra,
        id: r.id, name: r.name, phone: r.phone || '', group: r.group_name || '',
        subject: r.subject, teacherId: r.teacher_id || null,
        assistantTeacherId: r.assistant_teacher_id || null,
        lessonDayOfWeek: r.lesson_day_of_week != null ? r.lesson_day_of_week : null,
        lessonTime: r.lesson_time || '', lessonDuration: r.lesson_duration || 15
    };
}

function rowToPayment(r) {
    return {
        id: r.id, studentId: r.student_id,
        platform: r.platform, book: r.book, paid: r.paid, debt: r.debt, date: r.date
    };
}

function parseJsonArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
}

function rowToLead(r) {
    const attachments = parseJsonArray(r.attachments);
    let extra = {};
    try {
        if (r.extra_data) {
            extra = typeof r.extra_data === 'object' ? r.extra_data : JSON.parse(r.extra_data);
        }
    } catch {}
    return {
        ...extra,
        id: r.id, name: r.name, phone: r.phone || '', phone2: r.phone2 || '',
        email: r.email || '', managerId: r.manager_id || '',
        source: r.source || 'Organik', date: r.date || '',
        status: r.status || 'new', leadType: r.lead_type || 'organic',
        comments: parseJsonArray(r.comments), attachments,
        managerPhoto: attachments[0] || null,
        externalId: r.external_id || null, createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
        language: r.language === 'russian' ? 'russian' : 'english',
        deletedAt: r.deleted_at || null, deletedBy: r.deleted_by || ''
    };
}

// ── State ────────────────────────────────────────────────────────────────────

async function buildAttendanceObject(tableName) {
    const rows = await q(`SELECT att_key, student_id, day FROM ${tableName} WHERE present = 1`);
    const out = {};
    rows.forEach(r => {
        if (!out[r.att_key]) out[r.att_key] = {};
        if (!out[r.att_key][r.student_id]) out[r.att_key][r.student_id] = {};
        out[r.att_key][r.student_id][r.day] = 1;
    });
    return out;
}

async function getLeads(options = {}) {
    const managerId = String(options.managerId || '').trim();
    const rows = managerId
        ? await q(
            'SELECT * FROM leads WHERE deleted_at IS NULL AND manager_id = $1 ORDER BY created_at DESC, date DESC',
            [managerId]
        )
        : await q('SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC, date DESC');
    const leads = { english: [], russian: [] };
    rows.forEach(r => {
        const item = rowToLead(r);
        if (r.language === 'russian') leads.russian.push(item);
        else leads.english.push(item);
    });
    return leads;
}

function rowToBookRoadmap(r) {
    let leadRef = null;
    try { leadRef = r.lead_ref ? JSON.parse(r.lead_ref) : null; } catch { leadRef = null; }
    return {
        id: r.id, name: r.name, studentId: r.student_id || '',
        phone: r.phone || '', region: r.region || '',
        managerId: r.manager_id || '', kind: r.kind || 'organik',
        status: r.status || 'yangi-oquvchi', date: r.date || '',
        lang: r.lang || 'english', leadRef,
        address: r.address || '', dispatchedAt: r.dispatched_at || '', deliveredAt: r.delivered_at || '',
        comments: parseJsonArray(r.comments), createdAt: r.created_at || null
    };
}

async function getBookRoadmap() {
    const rows = await q('SELECT * FROM book_roadmap ORDER BY created_at DESC');
    return rows.map(rowToBookRoadmap);
}

async function saveBookRoadmap(client, items) {
    if (!isUsableList(items, 'saveBookRoadmap')) return;
    await guardBulkDelete(client, 'book_roadmap', 'Kitob yetkazish', items);
    await client.query('DELETE FROM book_roadmap');
    for (const r of items) {
        await client.query(
            `INSERT INTO book_roadmap (id, name, student_id, phone, region, manager_id, kind, status, date, lang, lead_ref, comments, address, dispatched_at, delivered_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [r.id, r.name || '', r.studentId || '', r.phone || '',
             r.region || '', r.managerId || '', r.kind || 'organik',
             r.status || 'yangi-oquvchi', r.date || '',
             r.lang || 'english',
             r.leadRef ? JSON.stringify(r.leadRef) : null,
             JSON.stringify(r.comments || []),
             r.address || '', r.dispatchedAt || '', r.deliveredAt || '']
        );
    }
}

async function getHrEmployeesData() {
    const rows = await q(`
        SELECT he.*,
               COALESCE(
                   (SELECT u.avatar FROM users u
                    WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(he.login))
                    LIMIT 1),
               '') AS avatar
        FROM hr_employees he
        ORDER BY he.name
    `);
    return rows.map(r => ({
        id: r.id, name: r.name,
        avatar: r.avatar || '',
        firstName: r.first_name || '', lastName: r.last_name || '',
        role: r.role, login: r.login || '',
        phone: r.phone || '', email: r.email || '',
        department: r.department || '', status: r.status || 'active',
        joinDate: r.join_date || '', gender: r.gender || '',
        birthDate: r.birth_date || '', startDate: r.start_date || '',
        cardNumber: r.card_number || '', passportSeries: r.passport_series || '',
        pinfl: r.pinfl || '', address: r.address || '',
        lang: r.lang || 'english',
        trialGroupLink: r.trial_group_link || ''
    }));
}

async function getHrEmployeeById(id) {
    if (!id) return null;
    return q1('SELECT id, name, login, phone FROM hr_employees WHERE id = $1', [id]);
}

async function setHrEmployeeLogin(id, login) {
    if (!id) return false;
    const result = await pool.query('UPDATE hr_employees SET login = $2 WHERE id = $1', [id, login]);
    return result.rowCount > 0;
}

// Har bir speaking (juft) darsning "attendanceTaken" holati har o'qishda
// real liveGrades'dan qayta hisoblanadi — CRM'da saqlangan qiymatga hech
// qachon ishonilmaydi (admin uni qo'lda "soxta" o'zgartira olmasligi kerak,
// faqat ustoz o'z kabinetidan haqiqiy davomat olgandagina o'zgaradi).
function applyComputedLessonAttendance(mc, liveGrades, demoStudentId) {
    if (!demoStudentId) return mc;
    const attendedIds = new Set((liveGrades[demoStudentId] || []).map(g => g.lessonId));
    (mc.courses || []).forEach(course => {
        (mc.lessons || [])
            .filter(l => l.courseId === course.id)
            .forEach((l, i) => {
                if (i % 2 !== 0) l.attendanceTaken = attendedIds.has(l.id);
            });
    });
    return mc;
}

// 41-qism: mc.libraryOverrides ilgari yassi ({grammar:{...}, words:{...}})
// edi — CRM endi Ingliz/Rus tili uchun alohida tahrir qilishi kerak bo'lgani
// sabab, uni { english:{...}, russian:{...} } shakliga o'tkazamiz. Eski
// yassi ma'lumot yo'qolib ketmasligi uchun "english" bo'limiga o'raladi —
// bu shakl faqat xotirada hisoblanadi, keyingi har qanday CRM saqlashida
// tabiiy ravishda saqlangan holatga ham yoziladi (xuddi mc.library/mc.shop
// computed maydonlari kabi).
function normalizeLibraryOverrides(mc) {
    const root = mc.libraryOverrides || {};
    if (root.english || root.russian) return root;
    mc.libraryOverrides = { english: root, russian: {} };
    return mc.libraryOverrides;
}

// Kutubxonaning 6 kategoriyasini (grammar/words/pronunciation/speaking/podcasts/
// books) berilgan til uchun statik default (LIBRARY_DEFAULTS/LIBRARY_DEFAULTS_RU)
// bilan o'sha tilning override'larini birlashtiradi. Overridedagi
// { _deleted: true } — o'sha id'ni ro'yxatdan chiqarib tashlaydi; default'da
// yo'q id'lar (CRM'da "+ Qo'shish" bilan qo'shilgan yangi elementlar)
// to'g'ridan-to'g'ri qo'shiladi.
function buildLibraryForLang(overridesByLang, lang) {
    const defaults = lang === 'russian' ? LIBRARY_DEFAULTS_RU : LIBRARY_DEFAULTS;
    const langOverrides = overridesByLang[lang] || {};
    const library = {};
    for (const cat of Object.keys(defaults)) {
        const catOverrides = langOverrides[cat] || {};
        const defaultIds = new Set();
        const merged = defaults[cat].map(item => {
            defaultIds.add(item.id);
            const patch = catOverrides[item.id];
            if (patch && patch._deleted) return null;
            return patch ? { ...item, ...patch } : item;
        }).filter(Boolean);
        Object.keys(catOverrides).forEach(id => {
            if (!defaultIds.has(id) && !catOverrides[id]._deleted) merged.push({ id, ...catOverrides[id] });
        });
        library[cat] = merged;
    }
    return library;
}

// `lang` berilsa ('english'/'russian') — mc.library o'sha tilning yassi
// to'plami bo'ladi (public/o'quvchi so'rovi uchun, bugungi shaklga mos).
// `lang` berilmasa (CRM to'liq holat so'rovi) — mc.library ikkala tilni
// birdek o'z ichiga oladi ({ english:{...}, russian:{...} }), chunki admin
// _mobileLang tugmasi orqali istalgan vaqt ikkalasini ham tahrirlaydi.
function applyLibraryOverrides(mc, lang) {
    const overridesByLang = normalizeLibraryOverrides(mc);
    mc.library = (lang === 'english' || lang === 'russian')
        ? buildLibraryForLang(overridesByLang, lang)
        : { english: buildLibraryForLang(overridesByLang, 'english'), russian: buildLibraryForLang(overridesByLang, 'russian') };
    return mc;
}

// Homework Shop'ning haqiqiy mahsulotlari — SHOP_PRODUCTS_DEFAULTS bilan
// CRM'da kiritilgan mc.shopOverrides'ni applyLibraryOverrides bilan bir xil
// naqsh bo'yicha birlashtirib, mc.shop'ga yozadi.
function applyShopOverrides(mc) {
    const overrides = mc.shopOverrides || {};
    const defaultIds = new Set();
    const merged = SHOP_PRODUCTS_DEFAULTS.map(item => {
        defaultIds.add(item.id);
        const patch = overrides[item.id];
        if (patch && patch._deleted) return null;
        return patch ? { ...item, ...patch } : item;
    }).filter(Boolean);
    Object.keys(overrides).forEach(id => {
        if (!defaultIds.has(id) && !overrides[id]._deleted) merged.push({ id, ...overrides[id] });
    });
    mc.shop = merged;
    return mc;
}

// 41-qism: berilgan o'quvchining haqiqiy kurs yo'nalishini ('english'/'russian')
// students.subject ustunidan aniqlaydi — getDemoStudentProfile'dagi bilan
// bir xil mantiq, shu yerga chiqarilib, ikkalasida ham qayta ishlatiladi.
async function resolveStudentSubjectLang(studentId) {
    if (!studentId) return 'english';
    const rows = await q('SELECT subject FROM students WHERE id = $1', [studentId]);
    return rows[0] && rows[0].subject === 'russian' ? 'russian' : 'english';
}

const BONUS_ID_RE = /^bonus-\d+$/;
const EXAM_ID_RE = /^interval-\d+$|^final$/;

// 41-qism: Bonus darslar/Imtihonlar global (kursga bog'liq bo'lmagan) sobit
// slotlar bo'lgani uchun, CRM ularning rus tili variantini "<id>-russian"
// prefiksi bilan alohida saqlaydi (mc.lessonContents/mc.examContents ichida,
// ingliz tili kaliti o'zgarishsiz qoladi). Bu funksiya faqat rus tili
// kursidagi o'quvchiga (public/bitta-o'quvchi rejimida) mo'ljallangan javobda
// shu "-russian" kalitlarni oddiy nomga almashtiradi — shunday qilib
// student-app hech qanday o'zgarishsiz, doim bir xil (suffixsiz) kalitlarni
// so'raydi va to'g'ri tildagi kontentni oladi. Oddiy (kursga tegishli,
// noyob lessonId'li) darslar bu bilan ishlamaydi — ular allaqachon
// course.lang orqali to'g'ri ajratilgan.
function resolveLangScopedContent(mc, studentLang) {
    for (const store of [mc.lessonContents, mc.examContents]) {
        if (!store) continue;
        const baseIds = new Set(
            Object.keys(store)
                .map(key => key.endsWith('-russian') ? key.slice(0, -'-russian'.length) : key)
                .filter(key => BONUS_ID_RE.test(key) || EXAM_ID_RE.test(key))
        );
        for (const baseId of baseIds) {
            const ruKey = `${baseId}-russian`;
            if (studentLang === 'russian') {
                if (store[ruKey]) store[baseId] = store[ruKey];
                else delete store[baseId];
            }
            // Tilga bog'langan ichki kalit public javobda hech qachon qolmaydi.
            delete store[ruKey];
        }
    }
}

// O'quvchi ilovasiga faqat uning kurs tilidagi dars sozlamalari beriladi.
// CRM esa `crmMode` orqali ikkala tildagi kontentni bir vaqtda ko'rishda
// davom etadi. Bu qatlam kurslar ro'yxatini emas, dars/modul/fayl va saqlangan
// lesson contentni ham kesib tashlaydi — boshqa til materialiga URL orqali
// tasodifan kirib qolishning oldi olinadi.
function scopeMobileContentToStudentLanguage(mc, studentLang) {
    const lang = studentLang === 'russian' ? 'russian' : 'english';
    const matchesLang = item => (item?.lang || 'english') === lang;

    const courses = (mc.courses || []).filter(matchesLang);
    const courseIds = new Set(courses.map(c => c.id));
    const lessons = (mc.lessons || []).filter(l => courseIds.has(l.courseId));
    const lessonIds = new Set(lessons.map(l => l.id));
    const modules = (mc.modules || []).filter(m => lessonIds.has(m.lessonId));
    const moduleIds = new Set(modules.map(m => m.id));

    mc.courses = courses;
    mc.lessons = lessons;
    mc.modules = modules;
    mc.moduleContents = (mc.moduleContents || []).filter(c => moduleIds.has(c.moduleId));
    mc.lessonContents = Object.fromEntries(
        Object.entries(mc.lessonContents || {}).filter(([id]) => lessonIds.has(id) || BONUS_ID_RE.test(id))
    );
    mc.examContents = Object.fromEntries(
        Object.entries(mc.examContents || {}).filter(([id]) => EXAM_ID_RE.test(id))
    );
    mc.videos = (mc.videos || []).filter(matchesLang);
    mc.documents = (mc.documents || []).filter(matchesLang);
    return mc;
}

async function getMobileContentData(studentId, { crmMode = false } = {}) {
    const row = await q1('SELECT data FROM mobile_content WHERE singleton = 1');
    const mc = row ? row.data : { videos: [], documents: [], courses: [], lessons: [] };
    const [liveGrades, demoStudentId] = await Promise.all([
        getJsonData('liveGrades'),
        resolveStudentId(studentId),
    ]);
    applyComputedLessonAttendance(mc, liveGrades, demoStudentId);
    const studentLang = crmMode ? undefined : await resolveStudentSubjectLang(demoStudentId);
    applyLibraryOverrides(mc, studentLang);
    if (!crmMode) {
        resolveLangScopedContent(mc, studentLang);
        scopeMobileContentToStudentLanguage(mc, studentLang);
    }
    return applyShopOverrides(mc);
}

async function saveMobileContentData(client, data) {
    await client.query(
        `INSERT INTO mobile_content (singleton, data) VALUES (1, $1)
         ON CONFLICT (singleton) DO UPDATE SET data = EXCLUDED.data`,
        [JSON.stringify(data)]
    );
}

async function getFullState() {
    const [teacherRows, smRows, studentRows, ttRows, paymentRows,
        mainAtt, assistAtt, leads, hrEmployees, bookRoadmap, mobileContent,
        scripts, bonusHistory, bonusData, salesPlan, cashFlow, orgChart, manualMetrics,
        liveGrades, demoStudentId, studentMessages, peerMessages, studentActivity, shopOrders, guides, individualSalesPlans, targetMonitoringPlan, targetDailyAdSpend, archive] = await Promise.all([
        q('SELECT * FROM teachers ORDER BY name'),
        q(`SELECT sm.id, sm.name, COALESCE(u.avatar,'') AS avatar
           FROM sales_managers sm
           LEFT JOIN users u ON LOWER(TRIM(u.name)) = LOWER(TRIM(sm.name))`),
        q('SELECT * FROM students ORDER BY name'),
        q('SELECT * FROM timetable'),
        q('SELECT * FROM payments ORDER BY date DESC'),
        buildAttendanceObject('main_attendance'),
        buildAttendanceObject('assistant_attendance'),
        getLeads(),
        getHrEmployeesData(),
        getBookRoadmap(),
        getMobileContentData(undefined, { crmMode: true }),
        getJsonData('scripts'),
        getJsonData('bonusHistory'),
        getJsonData('bonusData'),
        getJsonData('salesPlan'),
        getJsonData('cashFlow'),
        getJsonData('orgChart'),
        getJsonData('manualMetrics'),
        getJsonData('liveGrades'),
        getJsonData('demoStudentId'),
        getJsonData('studentMessages'),
        getJsonData('peerMessages'),
        getJsonData('studentActivity'),
        getJsonData('shopOrders'),
        getJsonData('guides'),
        getJsonData('individualSalesPlans'),
        getJsonData('targetMonitoringPlan'),
        getJsonData('targetDailyAdSpend'),
        getJsonData('archive'),
    ]);
    const timetable = {};
    ttRows.forEach(r => {
        timetable[r.slot_key] = {
            teacherId: r.teacher_id || '', salesManagerId: r.sales_manager_id || '',
            studentId: r.student_id || '', completed: !!r.completed, isProbniy: true
        };
    });
    return {
        teachers: teacherRows.map(rowToTeacher),
        salesManagers: smRows.map(r => ({ id: r.id, name: r.name, avatar: r.avatar || '' })),
        students: studentRows.map(rowToStudent),
        timetable,
        mainAttendance: mainAtt,
        assistantAttendance: assistAtt,
        payments: paymentRows.map(rowToPayment),
        leads, hrEmployees, bookRoadmap, mobileContent,
        scripts, bonusHistory, bonusData, salesPlan, cashFlow, orgChart, manualMetrics,
        liveGrades, demoStudentId, studentMessages, peerMessages, studentActivity, shopOrders, guides, individualSalesPlans, targetMonitoringPlan, targetDailyAdSpend, archive
    };
}

// ── Save functions (used in patchState) ─────────────────────────────────────

// ── Ommaviy o'chirishdan himoya ──────────────────────────────────────────────
// Quyidagi barcha `save*` funksiyalari "avval hammasini o'chir, so'ng klient
// yuborgan ro'yxatni yoz" tamoyilida ishlaydi. Klientdagi kesh buzilgan yoki
// eskirgan bo'lsa, bu butun jadvalni yo'q qilib yuborishi mumkin — 2026-08-01
// da 200+ lid aynan shu sababdan yo'qolgan. Quyidagi ikki yordamchi har bir
// saqlashdan oldin (1) payload haqiqiy massiv ekanini va (2) nechta yozuv
// yo'qolishini tekshiradi; chegaradan oshsa amal butunlay rad etiladi.
const MAX_BULK_DELETIONS_PER_PATCH = 3;

function isUsableList(value, label) {
    if (Array.isArray(value)) return true;
    console.warn(`[DB] ${label}: yaroqli ro'yxat kelmadi — hech narsa o'zgartirilmadi`);
    return false;
}

async function guardBulkDelete(client, table, label, incoming) {
    const incomingIds = new Set();
    for (const item of incoming) if (item?.id) incomingIds.add(item.id);
    const { rows } = await client.query(`SELECT id FROM ${table}`);
    const removed = rows.filter(r => !incomingIds.has(r.id));
    if (removed.length > MAX_BULK_DELETIONS_PER_PATCH) {
        const err = new Error(
            `Xavfsizlik to'sig'i: bitta so'rovda "${label}" bo'limidan ${removed.length} ta yozuv ` +
            `o'chib ketishi mumkin edi — amal rad etildi. Sahifani yangilab, qaytadan urinib ko'ring.`
        );
        err.code = 'BULK_DELETE_BLOCKED';
        throw err;
    }
}

async function saveTeachers(client, teachers) {
    if (!isUsableList(teachers, 'saveTeachers')) return;
    await guardBulkDelete(client, 'teachers', 'Ustozlar', teachers);
    await client.query('DELETE FROM teachers');
    for (const t of teachers) {
        await client.query(
            'INSERT INTO teachers (id, name, type, subject, phone, schedule_pattern, lesson_duration) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [t.id, t.name, t.type, t.subject || 'english', t.phone || '', t.schedulePattern || 'mwf', t.lessonDuration || 15]
        );
    }
}

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;

async function saveStudents(client, students) {
    if (!isUsableList(students, 'saveStudents')) return;
    await guardBulkDelete(client, 'students', "O'quvchilar", students);
    await client.query('DELETE FROM students');
    for (const s of students) {
        const { id, name, phone, group, subject, teacherId, assistantTeacherId,
                lessonDayOfWeek, lessonTime, lessonDuration, password, ...extra } = s;
        // 150-ish: parol endi hech qachon oddiy matn holida saqlanmaydi —
        // CRM formasi yuborgan (yangi kiritilgan) parolni bcrypt bilan
        // shifrlab, faqat hash'ni `extra_data.passwordHash`'ga yozamiz.
        // Forma bo'sh qoldirilgan bo'lsa (`password` yo'q), mavjud hash
        // `extra` ichida allaqachon bor va o'zgarishsiz qoladi.
        if (password) {
            extra.passwordHash = BCRYPT_HASH_RE.test(password) ? password : bcrypt.hashSync(password, 10);
        }
        await client.query(
            `INSERT INTO students (id, name, phone, group_name, subject, teacher_id, assistant_teacher_id, lesson_day_of_week, lesson_time, lesson_duration, extra_data)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [s.id, s.name || '', s.phone || '', s.group || '', s.subject || 'english',
             s.teacherId || null, s.assistantTeacherId || null,
             s.lessonDayOfWeek != null ? s.lessonDayOfWeek : null,
             s.lessonTime || '', s.lessonDuration || 15,
             JSON.stringify(extra)]
        );
    }
}

async function saveSalesManagers(client, list) {
    if (!isUsableList(list, 'saveSalesManagers')) return;
    await guardBulkDelete(client, 'sales_managers', 'Sotuv menejerlari', list);
    await client.query('DELETE FROM sales_managers');
    for (const s of list) {
        await client.query('INSERT INTO sales_managers (id, name) VALUES ($1,$2)', [s.id, s.name]);
    }
}

// Timetable va davomat massiv emas, obyekt-xarita ko'rinishida keladi va
// ularda ko'p yozuvning yo'qolishi QONUNIY bo'lishi mumkin (masalan ustoz
// bir oylik davomat belgilarini olib tashlasa). Shu sabab bu yerda faqat
// eng aniq buzilish holati — "bor edi, butunlay yo'q bo'ldi" — to'siladi.
async function guardTotalWipe(client, table, label, incomingCount) {
    if (incomingCount > 0) return;
    const { rows } = await client.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
    if (rows[0].c > MAX_BULK_DELETIONS_PER_PATCH) {
        const err = new Error(
            `Xavfsizlik to'sig'i: "${label}" bo'limidagi ${rows[0].c} ta yozuvning hammasi ` +
            `o'chib ketishi mumkin edi — amal rad etildi. Sahifani yangilab, qaytadan urinib ko'ring.`
        );
        err.code = 'BULK_DELETE_BLOCKED';
        throw err;
    }
}

async function saveTimetable(client, timetable) {
    if (!timetable || typeof timetable !== 'object' || Array.isArray(timetable)) {
        console.warn("[DB] saveTimetable: yaroqli jadval kelmadi — hech narsa o'zgartirilmadi");
        return;
    }
    await guardTotalWipe(client, 'timetable', 'Dars jadvali', Object.keys(timetable).length);
    await client.query('DELETE FROM timetable');
    for (const [key, e] of Object.entries(timetable || {})) {
        const parts = key.split('_');
        await client.query(
            'INSERT INTO timetable (slot_key, date, time, view_key, teacher_id, sales_manager_id, student_id, completed) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
            [key, parts[0] || '', parts[1] || '', parts[2] || 'all',
             e.teacherId || null, e.salesManagerId || null, e.studentId || null, e.completed ? 1 : 0]
        );
    }
}

async function saveAttendanceTable(client, tableName, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        console.warn(`[DB] saveAttendanceTable(${tableName}): yaroqli ma'lumot kelmadi — o'zgartirilmadi`);
        return;
    }
    await guardTotalWipe(client, tableName, 'Davomat', Object.keys(data).length);
    await client.query(`DELETE FROM ${tableName}`);
    for (const [attKey, students] of Object.entries(data || {})) {
        for (const [studentId, days] of Object.entries(students || {})) {
            for (const [day, val] of Object.entries(days || {})) {
                if (val) {
                    await client.query(
                        `INSERT INTO ${tableName} (att_key, student_id, day, present) VALUES ($1,$2,$3,1)`,
                        [attKey, studentId, parseInt(day, 10)]
                    );
                }
            }
        }
    }
}

async function savePayments(client, payments) {
    if (!isUsableList(payments, 'savePayments')) return;
    await guardBulkDelete(client, 'payments', "To'lovlar", payments);
    await client.query('DELETE FROM payments');
    for (const p of payments) {
        await client.query(
            'INSERT INTO payments (id, student_id, platform, book, paid, debt, date) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [p.id, p.studentId, p.platform || 0, p.book || 0, p.paid || 0, p.debt || 0, p.date || '']
        );
    }
}

function resolveLeadCreatedAt(existingValue, rawCreatedAt) {
    if (existingValue) return existingValue;
    if (rawCreatedAt) {
        const d = new Date(rawCreatedAt);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
}

async function getDeletedLeads() {
    const rows = await q('SELECT * FROM leads WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
    return rows.map(rowToLead);
}

async function getLeadById(id) {
    const row = await q1('SELECT * FROM leads WHERE id = $1', [id]);
    return row ? rowToLead(row) : null;
}

async function getSalesManagerIdForUser(userId) {
    const row = await q1(
        `SELECT manager_id
         FROM user_sales_manager_links
         WHERE user_id = $1`,
        [userId]
    );
    return row?.manager_id || '';
}

async function setSalesManagerUserLink(userId, managerId) {
    const normalizedManagerId = String(managerId || '').trim();
    if (!normalizedManagerId) {
        await pool.query('DELETE FROM user_sales_manager_links WHERE user_id = $1', [userId]);
        return '';
    }
    await pool.query(
        `INSERT INTO user_sales_manager_links (user_id, manager_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET manager_id = EXCLUDED.manager_id`,
        [userId, normalizedManagerId]
    );
    return normalizedManagerId;
}

function normalizeStoredLeadLanguage(value) {
    return value === 'russian' ? 'russian' : 'english';
}

function leadDbPayload(lead, language, existingCreatedAt = null) {
    const l = lead || {};
    const attachments = Array.isArray(l.attachments) ? l.attachments.filter(Boolean) : [];
    if (l.managerPhoto && !attachments.includes(l.managerPhoto)) attachments.unshift(l.managerPhoto);
    const {
        id, name, phone, phone2, email, managerId, source, date,
        externalId, status, leadType, comments, managerPhoto,
        createdAt, updatedAt, deletedAt, deletedBy, language: _language,
        attachments: _attachments, ...extra
    } = l;
    return {
        id: String(id || '').trim(),
        name: name || '',
        phone: phone || '',
        phone2: phone2 || '',
        email: email || '',
        managerId: managerId || '',
        source: source || 'Organik',
        language: normalizeStoredLeadLanguage(language || _language),
        date: date || '',
        externalId: externalId || null,
        status: status || 'yangi-lidlar',
        leadType: leadType === 'target' ? 'target' : 'organic',
        comments: Array.isArray(comments) ? comments : [],
        attachments,
        extra,
        createdAt: resolveLeadCreatedAt(existingCreatedAt, createdAt)
    };
}

async function appendLeadAudit(client, leadId, action, actor, snapshot) {
    await client.query(
        `INSERT INTO lead_audit (lead_id, action, actor_id, actor_name, snapshot)
         VALUES ($1,$2,$3,$4,$5)`,
        [leadId, action, actor?.id || '', actor?.name || actor?.email || '', JSON.stringify(snapshot || {})]
    );
}

async function upsertLeadWithClient(client, lead, language, options = {}) {
    if (!lead?.id) throw new Error('Lid ID yuborilishi shart');
    const existing = await client.query('SELECT * FROM leads WHERE id = $1 FOR UPDATE', [lead.id]);
    const existingRow = existing.rows[0] || null;
    const before = existingRow ? rowToLead(existingRow) : null;

    // Bir xil lid ikki eski tabdan bir paytda tahrir qilinsa, kech kelgan
    // eski snapshot yangi ma'lumotni bosib yubormaydi.
    if (existingRow && options.requireVersion !== false) {
        const expected = lead.updatedAt ? new Date(lead.updatedAt).getTime() : NaN;
        const actual = existingRow.updated_at ? new Date(existingRow.updated_at).getTime() : NaN;
        if (!Number.isFinite(expected) || expected !== actual) {
            const err = new Error("Bu lid boshqa oynada yangilangan. Sahifa yangilandi; o'zgarishni qayta kiriting.");
            err.code = 'LEAD_VERSION_CONFLICT';
            err.status = 409;
            throw err;
        }
    }

    // PATCH qisman obyekt yuborsa ham mavjud maydonlar bo'shab ketmasin.
    const merged = existingRow ? { ...before, ...lead, id: existingRow.id } : lead;

    // Biriktirilgan vaqtni server ham boshqaradi: API/import orqali menejer
    // o'zgarsa, statistika hech qachon lid yaratilgan yoki yangilangan sanaga
    // tayanmaydi. Menejer olib tashlansa, faol biriktirish sanasi ham tozalanadi.
    if (existingRow && String(before?.managerId || '') !== String(merged.managerId || '')) {
        merged.managerAssignedAt = merged.managerId ? new Date().toISOString() : null;
    } else if (!existingRow && merged.managerId && !merged.managerAssignedAt) {
        merged.managerAssignedAt = new Date().toISOString();
    }

    // Telegram/CSV kabi tarixiy manbadan tiklangan lidlar eski sanasi bilan
    // import qilinadi. Avvalgi menejer va etap noma'lum paytda ularga SLA
    // yuborilmaydi (`recoveryPending=true`). Foydalanuvchi menejer biriktirsa
    // yoki import qilingan etapni o'zgartirsa, tiklash holati yakunlangan deb
    // olinadi va SLA aynan shu real harakat vaqtidan qayta boshlanadi.
    const recoveryPending = before?.recoveryPending === true
        || String(before?.recoveryPending || '').toLowerCase() === 'true';
    if (existingRow && recoveryPending) {
        const importedStatus = String(before.recoveryImportedStatus || before.status || 'yangi-lidlar');
        const managerAssigned = !String(before.managerId || '').trim()
            && Boolean(String(merged.managerId || '').trim());
        const statusChanged = String(merged.status || 'yangi-lidlar') !== importedStatus;
        if (managerAssigned || statusChanged) {
            const reviewedAt = new Date().toISOString();
            merged.recoveryPending = false;
            merged.recoveryReviewedAt = reviewedAt;
            merged.recoveryReviewedReason = managerAssigned ? 'manager-assigned' : 'status-changed';
            merged.slaStageEnteredAt = reviewedAt;
            merged.statusChangedAt = reviewedAt;
        }
    }
    const p = leadDbPayload(merged, language, existingRow?.created_at);
    if (!p.name.trim()) throw new Error('Lid ismi bo\'sh bo\'lmasligi kerak');

    let rows;
    if (existingRow) {
        ({ rows } = await client.query(
            `UPDATE leads SET
                name=$2, phone=$3, phone2=$4, email=$5, manager_id=$6,
                source=$7, language=$8, date=$9, external_id=$10,
                status=$11, lead_type=$12, comments=$13, attachments=$14,
                extra_data=$15, updated_at=NOW(), deleted_at=NULL, deleted_by=''
             WHERE id=$1 RETURNING *`,
            [p.id, p.name, p.phone, p.phone2, p.email, p.managerId, p.source,
             p.language, p.date, p.externalId, p.status, p.leadType,
             JSON.stringify(p.comments), JSON.stringify(p.attachments), JSON.stringify(p.extra)]
        ));
    } else {
        ({ rows } = await client.query(
            `INSERT INTO leads
                (id, name, phone, phone2, email, manager_id, source, language, date,
                 external_id, status, lead_type, comments, attachments, extra_data,
                 created_at, updated_at, deleted_at, deleted_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NULL,'')
             RETURNING *`,
            [p.id, p.name, p.phone, p.phone2, p.email, p.managerId, p.source,
             p.language, p.date, p.externalId, p.status, p.leadType,
             JSON.stringify(p.comments), JSON.stringify(p.attachments),
             JSON.stringify(p.extra), p.createdAt]
        ));
    }
    const saved = { ...rowToLead(rows[0]), language: rows[0].language };
    if (options.audit !== false) {
        await appendLeadAudit(
            client,
            p.id,
            existingRow ? 'updated' : 'created',
            options.actor,
            { before, after: saved }
        );
    }
    return saved;
}

// Legacy brauzerlar hali ham /api/state orqali butun snapshot yuborishi
// mumkin. Muhim qoida: payload ichida yo'q lidlar HECH QACHON o'chirilmaydi.
// Shu tariqa eski/yarim yuklangan tab 200+ lidni yana yo'q qila olmaydi.
async function saveLeads(client, leads) {
    const langs = ['english', 'russian'].filter(lang => Array.isArray(leads?.[lang]));
    if (!langs.length) {
        console.warn("[DB] saveLeads: yaroqli lidlar ro'yxati kelmadi — hech narsa o'zgartirilmadi");
        return;
    }
    for (const lang of langs) {
        for (const lead of leads[lang]) {
            if (!lead?.id) continue;
            // Bu faqat server ichidagi eski moslik yo'li. Public /api/state
            // leads kalitini qabul qilmaydi; shu sabab versionsiz upsert faqat
            // boshqa qatorlarni o'chirmaydigan legacy import uchun qoladi.
            await upsertLeadWithClient(client, lead, lang, { audit: false, requireVersion: false });
        }
    }
}

async function upsertLead(lead, language, actor = {}) {
    let saved;
    await tx(async client => { saved = await upsertLeadWithClient(client, lead, language, { actor }); });
    return saved;
}

async function softDeleteLead(id, actor = {}) {
    let deleted = null;
    await tx(async client => {
        const existing = await client.query('SELECT * FROM leads WHERE id = $1 FOR UPDATE', [id]);
        if (!existing.rows[0] || existing.rows[0].deleted_at) return;
        const before = rowToLead(existing.rows[0]);
        const { rows } = await client.query(
            `UPDATE leads
             SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING *`,
            [id, actor?.name || actor?.email || '']
        );
        if (!rows[0]) return;
        deleted = { ...rowToLead(rows[0]), language: rows[0].language };
        await appendLeadAudit(client, id, 'deleted', actor, { before, after: deleted });
    });
    return deleted;
}

async function restoreLead(id, actor = {}) {
    let restored = null;
    await tx(async client => {
        const existing = await client.query('SELECT * FROM leads WHERE id = $1 FOR UPDATE', [id]);
        if (!existing.rows[0]) return;
        const before = rowToLead(existing.rows[0]);
        const { rows } = await client.query(
            `UPDATE leads
             SET deleted_at = NULL, deleted_by = '', updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        restored = rowToLead(rows[0]);
        if (before.deletedAt) {
            await appendLeadAudit(client, id, 'restored', actor, { before, after: restored });
        }
    });
    return restored;
}

async function saveHrEmployeesData(client, employees) {
    if (!isUsableList(employees, 'saveHrEmployeesData')) return;
    await guardBulkDelete(client, 'hr_employees', 'Xodimlar', employees);
    await client.query('DELETE FROM hr_employees');
    for (const e of (employees || [])) {
        await client.query(
            `INSERT INTO hr_employees
                (id, name, first_name, last_name, role, login, phone, email,
                 department, status, join_date, gender, birth_date, start_date,
                 card_number, passport_series, pinfl, address, lang, trial_group_link)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
            [e.id, e.name, e.firstName || '', e.lastName || '',
             e.role || 'employee', e.login || '', e.phone || '', e.email || '',
             e.department || '', e.status || 'active', e.joinDate || '',
             e.gender || '', e.birthDate || '', e.startDate || '',
             e.cardNumber || '', e.passportSeries || '', e.pinfl || '', e.address || '',
             e.lang || 'english', e.trialGroupLink || '']
        );
    }
}

async function getJsonData(key) {
    const row = await q1('SELECT data FROM json_data WHERE key = $1', [key]);
    if (!row) {
        if (key === 'demoStudentId') return '';
        return (key === 'bonusData' || key === 'salesPlan' || key === 'liveGrades' || key === 'studentMessages' || key === 'peerMessages' || key === 'studentActivity' || key === 'notificationRules' || key === 'absenceReasons' || key === 'homeworkRadioSchedule' || key === 'creativeSubmissions' || key === 'individualSalesPlans' || key === 'trialSmsReminders' || key === 'targetMonitoringPlan' || key === 'targetDailyAdSpend' || key === 'studentProgress' || key === 'studentProgressHistory' || key === 'assistantWeeklyRatings') ? {} : [];
    }
    return row.data;
}

// 150-ish: barcha "demo o'quvchi"ga asoslangan funksiyalar uchun umumiy —
// agar haqiqiy tizimga kirgan o'quvchi ID'si berilgan bo'lsa o'shani, aks
// holda CRM'da belgilangan eski "Namuna o'quvchi" ID'sini qaytaradi. Shu
// bitta funksiya orqali token yo'q/eskicha so'rovlar uchun hozirgi
// xatti-harakat 100% saqlanib qoladi.
async function resolveStudentId(studentId) {
    return studentId || await getJsonData('demoStudentId');
}

// Faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta o'quvchining jonli
// dars baholarini qaytaradi — boshqa barcha o'quvchilarning ma'lumotlari
// public endpoint orqali hech qachon oshkor qilinmaydi. Ustozning umumiy
// reytingi esa BARCHA o'quvchilarning "overall" bahosi o'rtachasi sifatida
// hisoblanadi — bu faqat bitta agregat son, hech kimning shaxsiy bahosini
// oshkor qilmaydi.
async function getDemoStudentGrades(studentId) {
    const liveGrades = await getJsonData('liveGrades');
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) return { grades: [], teacherRating: null };
    const grades = liveGrades[demoStudentId] || [];

    const lastTeacherId = grades.length ? grades[grades.length - 1].teacherId : null;
    let teacherRating = null;
    if (lastTeacherId) {
        const overalls = [];
        Object.values(liveGrades).forEach((entries) => {
            (entries || []).forEach((e) => {
                if (e.teacherId === lastTeacherId && e.studentRatingOfTeacher && typeof e.studentRatingOfTeacher.overall === 'number') {
                    overalls.push(e.studentRatingOfTeacher.overall);
                }
            });
        });
        if (overalls.length) teacherRating = Math.round((overalls.reduce((a, b) => a + b, 0) / overalls.length) * 10) / 10;
    }
    return { grades, teacherRating };
}

// Faqat "Namuna o'quvchi" uchun — bitta jonli dars sanasiga ustozni baholash
// natijasini qo'shadi. Boshqa hech qanday o'quvchi ma'lumotini yozib
// bo'lmaydi, chunki studentId har doim serverda demoStudentId'dan olinadi
// (mijozdan kelgan qiymatga ishonilmaydi).
async function submitDemoStudentTeacherRating(date, ratings, studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");
    const liveGrades = await getJsonData('liveGrades');
    const entries = liveGrades[demoStudentId] || [];
    const entry = entries.find((e) => e.date === date);
    if (!entry) throw new Error('Mos dars topilmadi');
    entry.studentRatingOfTeacher = ratings;
    await tx(async (client) => {
        await saveJsonData(client, 'liveGrades', liveGrades);
    });
}

const ASSISTANT_RATING_KEYS = ['contact', 'speed', 'help', 'motivation', 'overall'];

// 40-vazifa: "Yordamchi ustozni haftalik baholash" bo'limi ilgari to'liq
// o'ylab topilgan (sinov uchun tasodifiy, hafta raqamidan hosil qilingan)
// tarixni ko'rsatardi, yangi yuborilgan baho esa hech qachon serverga
// saqlanmasdi (faqat mahalliy holatda, ilova qayta ochilganda yo'qolib
// ketardi). Endi haqiqiy o'quvchi uchun (assistantWeeklyRatings json_data
// kaliti: { [studentId]: { "YYYY-MM-DD" (hafta Dushanbasi): {...} } }).
async function getDemoStudentAssistantRatings(studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) return {};
    const all = await getJsonData('assistantWeeklyRatings');
    return all[demoStudentId] || {};
}

async function submitDemoStudentAssistantRating(weekKey, ratings, studentId) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(weekKey || ''))) throw new Error("Noto'g'ri hafta");
    if (!ASSISTANT_RATING_KEYS.every((k) => Number.isFinite(Number(ratings?.[k])) && ratings[k] >= 1 && ratings[k] <= 5)) {
        throw new Error("Barcha mezonlar bo'yicha 1-5 baho kerak");
    }
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");
    const all = await getJsonData('assistantWeeklyRatings');
    if (!all[demoStudentId]) all[demoStudentId] = {};
    const clean = {};
    ASSISTANT_RATING_KEYS.forEach((k) => { clean[k] = Number(ratings[k]); });
    all[demoStudentId][weekKey] = clean;
    await tx(async (client) => {
        await saveJsonData(client, 'assistantWeeklyRatings', all);
    });
    return clean;
}

// Tashkentda (UTC+5, DST yo'q) berilgan haftalik qolip (1=MWF, 2=TTS) va
// soatdan kelib chiqib, ENG YAQIN sodir bo'lish vaqtini hisoblaydi — qolip
// kunlarining barchasi (masalan Dushanba/Chorshanba/Juma) hisobga olinadi,
// faqat birinchisi emas (o'quvchining lessonDayOfWeek maydoni haqiqatda
// BITTA kun emas, balki shu qolip belgisi — expandLessonPatternDays'ga
// qarang, xuddi Dars jadvali/Davomat hisob-kitoblarida ishlatilgani kabi).
// Agar bugun aynan shu qolip kunlaridan biri bo'lsa-yu, dars (davomiyligi
// bilan) hali tugamagan bo'lsa, bugungi vaqt qaytariladi — aks holda
// navbatdagi mos kunga o'tkaziladi.
function computeNextWeeklyOccurrence(dayOfWeek, timeStr, durationMinutes) {
    const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
    const [hh, mm] = String(timeStr).split(':').map(Number);
    const nowUtcMs = Date.now();
    const nowTashkent = new Date(nowUtcMs + TASHKENT_OFFSET_MS);
    const nowDow = nowTashkent.getUTCDay() === 0 ? 7 : nowTashkent.getUTCDay();
    const durMs = (durationMinutes || 0) * 60 * 1000;

    let bestUtcMs = null;
    expandLessonPatternDays(dayOfWeek).forEach((pd) => {
        const dayDiff = (pd - nowDow + 7) % 7;
        const candidateTashkentMs = Date.UTC(
            nowTashkent.getUTCFullYear(), nowTashkent.getUTCMonth(), nowTashkent.getUTCDate() + dayDiff,
            hh || 0, mm || 0, 0, 0
        );
        let candidateUtcMs = candidateTashkentMs - TASHKENT_OFFSET_MS;
        if (candidateUtcMs + durMs <= nowUtcMs) candidateUtcMs += 7 * 24 * 60 * 60 * 1000;
        if (bestUtcMs === null || candidateUtcMs < bestUtcMs) bestUtcMs = candidateUtcMs;
    });
    return new Date(bestUtcMs).toISOString();
}

// 150-ish: parol endi bcrypt bilan shifrlanadi (o'zgarmas hash), shuning
// uchun uni ilovaga qaytarib ko'rsatishning iloji yo'q.
// 40-vazifa: appning Bosh sahifa/Profil ekranlari ilgari real ma'lumot
// o'rniga hardcode qilingan namuna ("Shahzoda Mavlonova") ismini
// ko'rsatardi — chunki hech qanday real endpoint ism/ID qaytarmasdi. Endi
// bu funksiya xavfsiz (parolga aloqasi yo'q) maydonlarni qaytaradi.
// 35-vazifa: mobil ilovaning "Profil" ekranidagi "Davomat" va "Vaqt"
// kartochkalari ilgari doim qattiq yozilgan namuna qiymatlarni (92%,
// 24.5 soat) ko'rsatardi. Endi ikkalasi ham haqiqiy davomat yozuvlaridan
// (main_attendance/assistant_attendance) hisoblanadi: "kutilgan" darslar
// soni o'quvchining o'z jadvali (lessonDayOfWeek/lessonTime) bo'yicha
// ro'yxatdan o'tgan kunidan (startDate) bugungacha bo'lgan haqiqiy dars
// kunlari, "bajarilgan" esa shu kunlardan haqiqatan "kelgan" deb
// belgilanganlari. Vaqt = bajarilgan darslar soni * dars davomiyligi.
function expandLessonPatternDays(day) {
    const d = Number(day);
    if ([1, 3, 5].includes(d)) return [1, 3, 5];
    if ([2, 4, 6].includes(d)) return [2, 4, 6];
    return [d];
}

async function getDemoStudentAttendanceStats(studentId) {
    const empty = { attendanceRate: 0, hoursSpent: 0, lessonsCompleted: 0 };
    const id = await resolveStudentId(studentId);
    if (!id) return empty;
    const row = await q1('SELECT * FROM students WHERE id = $1', [id]);
    if (!row) return empty;
    const student = rowToStudent(row);
    if (student.lessonDayOfWeek == null || !student.lessonTime) return empty;

    const patternDays = expandLessonPatternDays(student.lessonDayOfWeek);
    const duration = student.lessonDuration || 15;

    const [mainRows, assistRows] = await Promise.all([
        q('SELECT att_key, day FROM main_attendance WHERE student_id = $1 AND present = 1', [id]),
        q('SELECT att_key, day FROM assistant_attendance WHERE student_id = $1 AND present = 1', [id]),
    ]);
    const presentDaysByMonth = {};
    [...mainRows, ...assistRows].forEach(r => {
        const monthKey = String(r.att_key || '').slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
        if (!presentDaysByMonth[monthKey]) presentDaysByMonth[monthKey] = new Set();
        presentDaysByMonth[monthKey].add(r.day);
    });

    let startDate = student.startDate ? new Date(student.startDate) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) {
        const earliestMonth = Object.keys(presentDaysByMonth).sort()[0];
        startDate = earliestMonth ? new Date(`${earliestMonth}-01`) : null;
    }
    if (!startDate || Number.isNaN(startDate.getTime())) return empty;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    if (cursor > today) return empty;

    let expected = 0;
    let completed = 0;
    let guard = 0;
    while (cursor <= today && guard < 3660) {
        guard++;
        if (patternDays.includes(cursor.getDay())) {
            expected++;
            const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
            if (presentDaysByMonth[monthKey]?.has(cursor.getDate())) completed++;
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return {
        attendanceRate: expected > 0 ? Math.round((completed / expected) * 100) : 0,
        hoursSpent: +((completed * duration) / 60).toFixed(1),
        lessonsCompleted: completed,
    };
}

// 36-vazifa: Leaderboard ilgari to'liq o'ylab topilgan (fake) o'quvchilar
// ro'yxati edi. Endi haqiqiy o'quvchilarning haqiqiy tanga/chaqmoq
// yig'indisidan (mobil ilova syncStudentProgress orqali serverga yuborgan)
// tuziladi — hali hech qanday tanga/chaqmoq to'plamagan (hech qachon
// sinxronlanmagan) o'quvchilar ro'yxatda ko'rinmaydi.
//
// 37-vazifa: Kunlik/Haftalik/Oylik reyting uchun har bir kunda QANCHA
// tanga/chaqmoq TO'PLANGANI (delta) alohida, kun bo'yicha saqlanadi
// (studentProgressHistory: { [studentId]: { "YYYY-MM-DD": {coins,
// lightning} } }) — "Doimiy" uchun esa hamon studentProgress'dagi umumiy
// (all-time) summa ishlatiladi.
function tashkentDateKey(tashkentDate) {
    return `${tashkentDate.getUTCFullYear()}-${String(tashkentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(tashkentDate.getUTCDate()).padStart(2, '0')}`;
}

async function syncStudentProgress(studentId, { coins, lightning, coinsDelta, lightningDelta } = {}) {
    const id = await resolveStudentId(studentId);
    if (!id) return;
    // 37-vazifa: server (Railway) UTC vaqt zonasida ishlaydi, lekin barcha
    // o'quvchilar O'zbekistonda (UTC+5) — shu sabab "bugungi kun" har doim
    // tashkentNow() orqali Toshkent vaqtiga qarab hisoblanadi, aks holda
    // tunda (23:00-05:00 UTC oralig'ida) to'plangan tanga/chaqmoq noto'g'ri
    // (bir kun oldingi) kunga yozilib qolardi.
    const todayKey = tashkentDateKey(tashkentNow());

    const [all, history] = await Promise.all([
        getJsonData('studentProgress'),
        getJsonData('studentProgressHistory'),
    ]);

    const existing = all[id] || { coins: 0, lightning: 0 };
    all[id] = {
        coins: coins != null ? Math.max(0, Math.round(Number(coins) || 0)) : existing.coins,
        lightning: lightning != null ? Math.max(0, Math.round(Number(lightning) || 0)) : existing.lightning,
        updatedAt: new Date().toISOString(),
    };

    const cDelta = Math.max(0, Math.round(Number(coinsDelta) || 0));
    const lDelta = Math.max(0, Math.round(Number(lightningDelta) || 0));
    if (cDelta || lDelta) {
        if (!history[id]) history[id] = {};
        const day = history[id][todayKey] || { coins: 0, lightning: 0 };
        history[id][todayKey] = { coins: day.coins + cDelta, lightning: day.lightning + lDelta };
    }

    await tx(async (client) => {
        await saveJsonData(client, 'studentProgress', all);
        if (cDelta || lDelta) await saveJsonData(client, 'studentProgressHistory', history);
    });
}

const LEADERBOARD_PERIODS = ['daily', 'weekly', 'monthly', 'alltime'];

function sumProgressHistoryInRange(entries, fromKey, toKey) {
    let coins = 0;
    let lightning = 0;
    Object.entries(entries || {}).forEach(([dateKey, v]) => {
        if (dateKey >= fromKey && dateKey <= toKey) {
            coins += v.coins || 0;
            lightning += v.lightning || 0;
        }
    });
    return { coins, lightning };
}

// Davr oynasini hisoblaydi — "daily" bugungi kun, "weekly" joriy hafta
// (Dushanbadan boshlab), "monthly" joriy taqvim oyi — hammasi Toshkent
// vaqtiga (UTC+5) qarab, server qaysi vaqt zonasida ishlashidan qat'iy
// nazar. "alltime" uchun null qaytadi (chunki u alohida, studentProgress'
// dagi umumiy summadan olinadi).
function getLeaderboardPeriodRange(period) {
    const nowTashkent = tashkentNow();
    const todayKey = tashkentDateKey(nowTashkent);
    if (period === 'daily') return { from: todayKey, to: todayKey };
    if (period === 'weekly') {
        const dow = nowTashkent.getUTCDay(); // 0=Yakshanba..6=Shanba
        const diffToMonday = dow === 0 ? 6 : dow - 1;
        const monday = new Date(Date.UTC(nowTashkent.getUTCFullYear(), nowTashkent.getUTCMonth(), nowTashkent.getUTCDate() - diffToMonday));
        return { from: tashkentDateKey(monday), to: todayKey };
    }
    if (period === 'monthly') {
        const first = `${nowTashkent.getUTCFullYear()}-${String(nowTashkent.getUTCMonth() + 1).padStart(2, '0')}-01`;
        return { from: first, to: todayKey };
    }
    return null;
}

async function getRealLeaderboard(studentId, scope, period = 'alltime') {
    const id = await resolveStudentId(studentId);
    const safePeriod = LEADERBOARD_PERIODS.includes(period) ? period : 'alltime';
    const range = getLeaderboardPeriodRange(safePeriod);

    const [progress, history, studentRows] = await Promise.all([
        getJsonData('studentProgress'),
        range ? getJsonData('studentProgressHistory') : Promise.resolve({}),
        q('SELECT * FROM students'),
    ]);
    const me = id ? studentRows.find((r) => r.id === id) : null;
    const meRegion = me ? (rowToStudent(me).region || '').trim().toLowerCase() : '';

    const candidates = [];
    studentRows.forEach((row) => {
        let coins = 0;
        let lightning = 0;
        if (range) {
            const sums = sumProgressHistoryInRange(history[row.id], range.from, range.to);
            coins = sums.coins;
            lightning = sums.lightning;
        } else {
            const p = progress[row.id];
            if (!p) return;
            coins = p.coins || 0;
            lightning = p.lightning || 0;
        }
        if (!coins && !lightning) return;
        if (scope === 'region' && meRegion) {
            const region = (rowToStudent(row).region || '').trim().toLowerCase();
            if (region !== meRegion) return;
        }
        candidates.push({ row, coins, lightning });
    });

    const entries = await Promise.all(candidates.map(async ({ row, coins, lightning }) => {
        const s = rowToStudent(row);
        const stats = await getDemoStudentAttendanceStats(row.id);
        return {
            id: row.id,
            name: s.name || '',
            coins,
            lightning,
            lessonsCompleted: stats.lessonsCompleted,
            isMe: row.id === id,
            avatarUrl: s.avatarUrl || '',
        };
    }));

    entries.sort((a, b) => b.lightning - a.lightning);
    return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}

// CRM'dagi Student Detail panelidagi (js/app.js) calculateAge bilan bir xil hisoblash.
function calculateAgeFromBirthDate(birthDate) {
    if (!birthDate) return null;
    const b = new Date(birthDate);
    if (isNaN(b.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age > 0 ? age : null;
}

async function getDemoStudentProfile(studentId) {
    const id = await resolveStudentId(studentId);
    if (!id) return {};
    const rows = await q('SELECT * FROM students WHERE id = $1', [id]);
    const student = rows[0] ? rowToStudent(rows[0]) : null;
    if (!student) return {};
    const { attendanceRate, hoursSpent } = await getDemoStudentAttendanceStats(id);
    // 13-vazifa: "Mening ustozim" ekrani ilgari doim hardcode qilingan
    // namuna ustoz ismlarini ko'rsatardi — endi o'quvchiga CRM'da
    // haqiqatan biriktirilgan asosiy/yordamchi ustozning ismi (va telefoni,
    // "Yordam" tugmasi uchun) qaytariladi.
    const teacherIds = [student.teacherId, student.assistantTeacherId].filter(Boolean);
    const teacherRows = teacherIds.length
        ? await q('SELECT id, name, phone FROM teachers WHERE id = ANY($1)', [teacherIds])
        : [];
    const mainTeacher = teacherRows.find(t => t.id === student.teacherId);
    const assistantTeacher = teacherRows.find(t => t.id === student.assistantTeacherId);
    return {
        mainTeacherName: mainTeacher?.name || '',
        mainTeacherPhone: mainTeacher?.phone || '',
        assistantTeacherName: assistantTeacher?.name || '',
        assistantTeacherPhone: assistantTeacher?.phone || '',
        name: student.name || '',
        // CRM jadvalidagi "ID" ustuni bilan aynan bir xil ko'rinadigan ID.
        // Texnik `students.id` (masalan s178...) hech qachon ilovaga uzatilmaydi.
        studentId: await getStudentPublicId(student),
        lang: await resolveStudentSubjectLang(id),
        attendanceRate,
        hoursSpent,
        // 11-vazifa: "Mening profilim" ekrani ilgari doim hardcode qilingan
        // namuna ma'lumot (yosh/jins/manzil/telefon) ko'rsatardi — endi CRM'da
        // haqiqatan saqlangan qiymatlar qaytariladi.
        phone: student.phone || '',
        age: student.age || calculateAgeFromBirthDate(student.birthDate),
        gender: student.gender || '',
        address: student.address || '',
        avatarUrl: student.avatarUrl || '',
    };
}

// 12-vazifa: o'quvchi ilovadan o'zi profil rasmini qo'yganda, bu server
// tomonda saqlanadi — shu bilan boshqa o'quvchilar (masalan Leaderboard'da)
// ham uning haqiqiy rasmini ko'ra oladi (avval faqat qurilma xotirasida
// saqlanardi, boshqa hech kim ko'ra olmasdi).
async function setDemoStudentAvatarUrl(studentId, avatarUrl) {
    const realId = await resolveStudentId(studentId);
    if (!realId) throw new Error("O'quvchi aniqlanmadi");
    const row = await q1('SELECT extra_data FROM students WHERE id = $1', [realId]);
    if (!row) throw new Error("O'quvchi topilmadi");
    let extra = {};
    try {
        extra = typeof row.extra_data === 'object' ? row.extra_data : JSON.parse(row.extra_data || '{}');
    } catch { extra = {}; }
    extra = { ...extra, avatarUrl: String(avatarUrl || '').slice(0, 500) };
    await q1('UPDATE students SET extra_data = $1 WHERE id = $2', [JSON.stringify(extra), realId]);
}

function isCanonicalStudentSerial(value) {
    return /^[A-Z]{2}\d{3}$/.test(String(value || '').trim().toUpperCase());
}

// Eski yozuvlarda serialCode texnik `s...` ID bo'lib qolgan bo'lishi mumkin.
// Avval sotuvdagi bog'langan lidning haqiqiy serialini olamiz; topilmasa CRM
// jadvalidagi avvaldan ishlatilgan 6 belgili fallbackni saqlaymiz.
async function getStudentPublicId(student) {
    const ownSerial = String(student?.serialCode || '').trim().toUpperCase();
    if (isCanonicalStudentSerial(ownSerial)) return ownSerial;

    let linkedSerial = '';
    const linkedLeadId = student?.leadRef?.id;
    if (linkedLeadId) {
        const leadRow = await q1('SELECT * FROM leads WHERE id = $1', [linkedLeadId]);
        if (leadRow) {
            const lead = rowToLead(leadRow);
            const serial = String(lead.serialCode || '').trim().toUpperCase();
            if (isCanonicalStudentSerial(serial)) linkedSerial = serial;
        }
    }

    const publicId = linkedSerial || String(student?.id || '').slice(-6);
    if (publicId && student?.id && student.serialCode !== publicId) {
        const extra = { ...student, serialCode: publicId };
        delete extra.id; delete extra.name; delete extra.phone; delete extra.group;
        delete extra.subject; delete extra.teacherId; delete extra.assistantTeacherId;
        delete extra.lessonDayOfWeek; delete extra.lessonTime; delete extra.lessonDuration;
        await q1('UPDATE students SET extra_data = $1 WHERE id = $2', [JSON.stringify(extra), student.id]);
    }
    return publicId;
}

// 6-vazifa: lid to'lov jarayonida o'quvchiga aylanganda unga avtomatik
// shartnoma raqami beriladi — sotuv bo'limi endi buni qo'lda kiritmaydi.
// json_data'dagi 'contractCounter' kalitini bitta SQL amali orqali (INSERT
// ... ON CONFLICT ... DO UPDATE) atomik ravishda oshiramiz, shu bilan bir
// nechta admin bir vaqtda konvertatsiya qilsa ham raqam takrorlanmaydi.
async function getNextContractNumber() {
    const year = new Date().getFullYear();
    const row = await q1(
        `INSERT INTO json_data (key, data) VALUES ('contractCounter', '1'::jsonb)
         ON CONFLICT (key) DO UPDATE SET data = to_jsonb((json_data.data)::text::int + 1)
         RETURNING data`
    );
    const seq = parseInt(row.data, 10) || 1;
    const high = String(Math.floor((seq - 1) / 1000)).padStart(3, '0');
    const low = String((seq - 1) % 1000).padStart(3, '0');
    return `${year}/${high}-${low}`;
}

// Shartnoma ma'lumoti odatda promoteStudentFromOnboarding orqali (CRM'da
// lid o'quvchiga aylanayotganda) o'quvchi yozuviga qo'shiladi. Agar biror
// sababga ko'ra topilmasa (masalan, funksiya chiqishidan oldin qo'shilgan
// eski/demo o'quvchi), shu yerda birinchi so'rovda avtomatik yaratib,
// o'quvchi yozuviga darhol yozib qo'yamiz — shartnoma PDF hech qachon
// "topilmadi" holatiga tushmasligi uchun.
async function getOrCreateStudentContract(studentId) {
    const realId = await resolveStudentId(studentId);
    if (!realId) return null;
    const row = await q1('SELECT * FROM students WHERE id = $1', [realId]);
    if (!row) return null;
    let extra = {};
    try {
        extra = typeof row.extra_data === 'object' ? row.extra_data : JSON.parse(row.extra_data || '{}');
    } catch { extra = {}; }
    if (extra.contract && extra.contract.number) {
        return { number: extra.contract.number, date: extra.contract.date, studentName: row.name };
    }
    const contract = { number: await getNextContractNumber(), date: new Date().toISOString().slice(0, 10) };
    extra = { ...extra, contract };
    await q1('UPDATE students SET extra_data = $1 WHERE id = $2', [JSON.stringify(extra), realId]);
    return { number: contract.number, date: contract.date, studentName: row.name };
}

// Mobil ilovaning "To'lovlar" ekranidagi "Shartnoma faylini ko'rish (PDF)"
// tugmasi shu yerga chiqadi — namuna shartnoma matnini haqiqiy o'quvchi
// ismi va shartnoma raqami/sanasi bilan qayta generatsiya qiladi.
async function getStudentContractPdf(studentId) {
    const contract = await getOrCreateStudentContract(studentId);
    if (!contract) return null;
    const buffer = await generateContractPdfBuffer({
        contractNumber: contract.number,
        studentFullName: contract.studentName || "O'quvchi",
        contractDate: contract.date
    });
    return { buffer, filename: `shartnoma-${contract.number.replace(/[^\w-]/g, '')}.pdf` };
}

// Public endpoint uchun — faqat CRM'da "Namuna o'quvchi" deb belgilangan
// bitta o'quvchining Telegram guruh havolasi va navbatdagi speaking dars
// vaqtini qaytaradi. StudentId har doim serverda demoStudentId'dan olinadi.
async function getDemoStudentSchedule(studentId) {
    const empty = {
        telegramGroupLink: '', topic: '', startsAt: null,
        courseStartDate: null, schedulePattern: 'mwf', lessonDayOfWeek: null, lessonTime: ''
    };
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) return empty;
    const row = await q1('SELECT * FROM students WHERE id = $1', [demoStudentId]);
    if (!row) return empty;
    const student = rowToStudent(row);

    // 123-ish: "Jadval va davomat" ekrani o'quvchining haqiqiy o'qish
    // boshlagan kuni va o'zining asosiy ustozining haftalik dars kunlari
    // patterni (mwf/tts) asosida quriladi — shuning uchun ular ham
    // qaytariladi.
    let schedulePattern = 'mwf';
    if (student.teacherId) {
        const teacherRow = await q1('SELECT schedule_pattern FROM teachers WHERE id = $1', [student.teacherId]);
        if (teacherRow?.schedule_pattern) schedulePattern = teacherRow.schedule_pattern;
    }
    const courseStartDate = student.startDate || null;

    if (student.lessonDayOfWeek == null || !student.lessonTime) {
        return {
            telegramGroupLink: student.telegramGroupLink || '', topic: '', startsAt: null,
            courseStartDate, schedulePattern, lessonDayOfWeek: null, lessonTime: ''
        };
    }
    const startsAt = computeNextWeeklyOccurrence(student.lessonDayOfWeek, student.lessonTime, student.lessonDuration);
    const topic = student.group ? `Speaking Club: ${student.group}` : 'Speaking Club';
    return {
        telegramGroupLink: student.telegramGroupLink || '', topic, startsAt,
        courseStartDate, schedulePattern,
        lessonDayOfWeek: student.lessonDayOfWeek, lessonTime: student.lessonTime
    };
}

// 39-vazifa: mobil ilovaning "To'lovlar" ekrani ilgari to'liq namuna
// (fake) ma'lumot ko'rsatardi. Endi haqiqiy ma'lumotdan tuziladi:
// - Qarzdorlik/to'lov sanasi — Sotuv bo'limi bilan bir xil (student.
//   debtAmount/paymentDueDate, xuddi CRM'dagi "Qarzdorlar" ro'yxati
//   bilan bir xil manba - 5-vazifa/task 39'da tuzatilgan sinxronizatsiya).
// - "To'lov tarixi" — CRM Moliya bo'limida admin/buxgalter tomonidan
//   kiritilgan haqiqiy oylik to'lov yozuvlari (payments jadvali).
async function getDemoStudentPayments(studentId) {
    const empty = {
        tariffLabel: 'Standard', lessonDuration: 15, monthlyAmount: 0,
        courseStartDate: null, salesManagerName: '',
        debtAmount: 0, paymentDueDate: null, history: [],
    };
    const id = await resolveStudentId(studentId);
    if (!id) return empty;
    const row = await q1('SELECT * FROM students WHERE id = $1', [id]);
    if (!row) return empty;
    const student = rowToStudent(row);

    let salesManagerName = '';
    if (student.managerId) {
        const mgrRow = await q1('SELECT name FROM hr_employees WHERE id = $1', [student.managerId]);
        salesManagerName = mgrRow?.name || '';
    }

    const paymentRows = await q('SELECT * FROM payments WHERE student_id = $1 ORDER BY date DESC', [id]);
    const tariffRaw = String(student.tariff || 'standard');
    const tariffLabel = tariffRaw.charAt(0).toUpperCase() + tariffRaw.slice(1);
    const history = paymentRows.map((p) => ({
        id: p.id,
        date: p.date || '',
        amount: (p.platform || 0) + (p.book || 0),
        paid: p.paid || 0,
        debt: p.debt || 0,
        tariffLabel,
    }));

    return {
        tariffLabel,
        lessonDuration: student.lessonDuration || 15,
        monthlyAmount: history[0]?.amount || 0,
        courseStartDate: student.startDate || null,
        salesManagerName,
        debtAmount: Number(student.debtAmount) || 0,
        paymentDueDate: student.paymentDueDate || null,
        history,
    };
}

const DEMO_MESSAGE_THREAD_IDS = ['support', 'main-teacher', 'assistant-teacher'];

// Public endpoint uchun — faqat CRM'da "Namuna o'quvchi" deb belgilangan
// bitta o'quvchining uchta suhbat (Qo'llab-quvvatlash / Asosiy ustoz /
// Yordamchi ustoz) xabarlarini qaytaradi. StudentId har doim serverda
// demoStudentId'dan olinadi — mijozdan kelgan qiymatga ishonilmaydi.
async function getDemoStudentMessages(studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) return { support: [], mainTeacher: [], assistantTeacher: [] };
    const all = await getJsonData('studentMessages');
    const byThread = all[demoStudentId] || {};
    return {
        support: byThread['support'] || [],
        mainTeacher: byThread['main-teacher'] || [],
        assistantTeacher: byThread['assistant-teacher'] || [],
    };
}

// Namuna o'quvchi ilovadan xabar yozganda shu yerga yuboradi. StudentId
// har doim serverda demoStudentId'dan olinadi, shuning uchun bu boshqa
// hech bir o'quvchi ma'lumotini yoza olmaydi.
async function sendDemoStudentMessage(threadId, text, studentId) {
    if (!DEMO_MESSAGE_THREAD_IDS.includes(threadId)) throw new Error("Noto'g'ri suhbat");
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error("Xabar matni bo'sh bo'lishi mumkin emas");
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");

    const all = await getJsonData('studentMessages');
    if (!all[demoStudentId]) all[demoStudentId] = {};
    if (!all[demoStudentId][threadId]) all[demoStudentId][threadId] = [];
    const message = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        threadId, sender: 'student', type: 'text', text: trimmed,
        time: new Date().toISOString(),
    };
    all[demoStudentId][threadId].push(message);
    await tx(async (client) => {
        await saveJsonData(client, 'studentMessages', all);
    });
    return message;
}

// Appdagi "Maqsaddoshlar" (hamkurs) suhbatlari uchun bir martalik urinish —
// hamkurs ismi (masalan "Madina") CRM'dagi haqiqiy o'quvchilar ro'yxatidagi
// ismning birinchi so'zi bilan mos kelsa, shu haqiqiy o'quvchi ID'siga
// bog'lab qo'yiladi (faqat ma'lumot uchun, CRM administratorga qaysi haqiqiy
// o'quvchi nazarda tutilganini ko'rsatish uchun) — topilmasa, baribir suhbat
// real/saqlanadigan bo'lib qoladi, faqat bog'lanish bo'sh qoladi.
// 150-ish: o'quvchi real login orqali ilovaga kirganda ishlatiladi. `login`
// va `passwordHash` haqiqiy ustunlar emas, `extra_data` JSONB ichida
// saqlanadi, shuning uchun indekslab bo'lmaydi — `findRealStudentIdByFirstName`
// bilan bir xil to'liq skanerlash patterni.
async function findStudentByLogin(login) {
    const trimmed = String(login || '').trim().toLowerCase();
    if (!trimmed) return null;
    const rows = await q('SELECT * FROM students');
    const match = rows.map(rowToStudent).find(s => String(s.login || '').trim().toLowerCase() === trimmed);
    return match || null;
}

async function findRealStudentIdByFirstName(name) {
    if (!name) return null;
    const target = String(name).trim().split(/\s+/)[0].toLowerCase();
    if (!target) return null;
    const rows = await q('SELECT id, name FROM students');
    const match = rows.find(r => String(r.name || '').trim().split(/\s+/)[0].toLowerCase() === target);
    return match ? match.id : null;
}

// Public endpoint uchun — faqat CRM'da "Namuna o'quvchi" deb belgilangan
// bitta o'quvchining barcha "hamkurs" (Maqsaddoshlar) suhbatlarini qaytaradi.
async function getDemoStudentPeerMessages(studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) return {};
    const all = await getJsonData('peerMessages');
    return all[demoStudentId] || {};
}

// Namuna o'quvchi ilovadan hamkursiga xabar yozganda shu yerga yuboradi.
// StudentId har doim serverda demoStudentId'dan olinadi.
async function sendDemoStudentPeerMessage(peerId, peerName, text, studentId) {
    const trimmedId = String(peerId || '').trim();
    if (!trimmedId) throw new Error("Hamkurs aniqlanmadi");
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error("Xabar matni bo'sh bo'lishi mumkin emas");
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");

    const all = await getJsonData('peerMessages');
    if (!all[demoStudentId]) all[demoStudentId] = {};
    if (!all[demoStudentId][trimmedId]) {
        const linkedStudentId = await findRealStudentIdByFirstName(peerName);
        all[demoStudentId][trimmedId] = { peerName: peerName || trimmedId, linkedStudentId, messages: [] };
    }
    const message = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        sender: 'student', type: 'text', text: trimmed,
        time: new Date().toISOString(),
    };
    all[demoStudentId][trimmedId].messages.push(message);
    await tx(async (client) => {
        await saveJsonData(client, 'peerMessages', all);
    });
    return message;
}

// 140-ish: "Afsonalar" (Legends) — namuna o'quvchining AI-personajlar bilan
// suhbatlari. peerMessages bilan bir xil { [studentId]: { [personaId]: {...} } }
// naqshi, lekin real o'quvchiga bog'lash (linkedStudentId) kerak emas va
// sender aniq ko'rsatiladi ('student'/'persona'), chunki personajning "javobi"
// mijoz tomonida generatsiya qilinadi, boshqa qurilmadan kelmaydi.
async function getDemoStudentPersonaMessages(studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) return {};
    const all = await getJsonData('personaMessages');
    return all[demoStudentId] || {};
}

async function sendDemoStudentPersonaMessage(personaId, personaName, text, sender, studentId) {
    const trimmedId = String(personaId || '').trim();
    if (!trimmedId) throw new Error("Personaj aniqlanmadi");
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error("Xabar matni bo'sh bo'lishi mumkin emas");
    const senderVal = sender === 'persona' ? 'persona' : 'student';
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");

    const all = await getJsonData('personaMessages');
    if (!all[demoStudentId]) all[demoStudentId] = {};
    if (!all[demoStudentId][trimmedId]) {
        all[demoStudentId][trimmedId] = { personaName: personaName || trimmedId, messages: [] };
    }
    const message = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        sender: senderVal, type: 'text', text: trimmed,
        time: new Date().toISOString(),
    };
    all[demoStudentId][trimmedId].messages.push(message);
    await tx(async (client) => {
        await saveJsonData(client, 'personaMessages', all);
    });
    return message;
}

// ── Bildirishnomalar (Notifications) — 141/142-ish ───────────────────────────
// Uch manba bir ro'yxatga birlashtiriladi: (1) "avtomatik/computed" — CRM'da
// yoqilgan qoidalar asosida haqiqiy ma'lumotdan (dars jadvali, to'lov qarzi,
// uyga vazifa va h.k.) har so'rovda qayta hisoblanadigan, hozir "to'g'ri"
// bo'lgan-bo'lmaganligiga qarab ko'rinadigan/yo'qoladigan shartlar;
// (2) "tizim voqealari" — muayyan lahzada sodir bo'lgan va bir marta
// qayd etiladigan hodisalar (imtihondan o'tish, yetkazib berish holati,
// Ma'muriyatdan xabar, hamjamiyatdagi "yurakcha"), `systemNotifications`da
// saqlanadi; (3) "qo'lda" — admin CRM'dan yozib yuborgan xabarlar, saqlanadi.
const DEFAULT_NOTIFICATION_RULES = {
    lessonReminder120: { enabled: true, title: '2 soatdan keyin darsingiz bor', message: "{course} darsi bugun soat {time} da boshlanadi — 2 soat qoldi." },
    lessonReminder60: { enabled: true, title: '1 soatdan keyin darsingiz bor', message: "{course} darsi soat {time} da boshlanadi — 1 soat qoldi." },
    lessonReminder30: { enabled: true, title: '30 daqiqadan keyin darsingiz bor', message: "{course} darsi soat {time} da boshlanadi — 30 daqiqa qoldi." },
    lessonReminder15: { enabled: true, title: '15 daqiqadan keyin darsingiz bor', message: "{course} darsi soat {time} da boshlanadi — 15 daqiqa qoldi." },
    lessonReminder10: { enabled: true, title: '10 daqiqadan keyin darsingiz bor', message: "{course} darsi soat {time} da boshlanadi — 10 daqiqa qoldi." },
    lessonReminder5: { enabled: true, title: '5 daqiqadan keyin darsingiz bor', message: "{course} darsi soat {time} da boshlanadi — 5 daqiqa qoldi." },
    lessonReminder0: { enabled: true, title: 'Darsingiz boshlandi!', message: "{course} darsi hozir boshlandi. Guruhga qo'shiling!" },
    teacherRatingPrompt: { enabled: true, title: 'Ustozingizni baholang', message: "So'nggi darsingiz uchun ustozingizni baholashingiz kutilmoqda." },
    videoLessonMorning: { enabled: true, title: 'Bugun videodars kuni', message: "Bugungi videodarsni ko'rishni unutmang!" },
    // 142-ish qayta ish 8: soat 09:00'dagi yagona eslatmadan tashqari, kun
    // davomida yana 3 ta nazorat nuqtasi (12:00/18:00/21:00) — faqat hali
    // ko'rilmagan bo'lsa yuboriladi (VIDEO_REMINDER_CHECKPOINTS'ga qarang).
    videoLessonNoon: { enabled: true, title: 'Bugun videodars kuni', message: "Hali videodarsni ko'rmadingiz — soat 12:00 bo'ldi, unutmang!" },
    videoLessonEvening: { enabled: true, title: 'Bugun videodars kuni', message: "Hali videodarsni ko'rmadingiz — kun tugayapti, unutmang!" },
    videoLessonNight: { enabled: true, title: 'Bugun videodars kuni', message: "Bugun videodarsni ko'rishni unutmang, vaqt kam qoldi!" },
    homeworkIncomplete: { enabled: true, title: 'Uyga vazifa tugallanmagan', message: "Bugungi uyga vazifangizni hali to'liq bajarmadingiz." },
    bonusLessonSunday: { enabled: true, title: 'Yakshanba bonus darsi', message: "Bugun soat 12:00 dan bonus darsni ko'rishingiz mumkin!" },
    paymentDebt: { enabled: true, title: "To'lov bo'yicha eslatma", message: "Hisobingizda qarzdorlik mavjud. Iltimos, to'lovni amalga oshiring." },
    absenceSurvey: { enabled: true, title: 'Darsni nega qoldirdingiz?', message: "So'nggi darsingizda ishtirok etmadingiz — sababini bizga ayting." },
    examPassed: { enabled: true, title: "Tabriklaymiz! Imtihondan o'tdingiz", message: "{label} imtihonidan muvaffaqiyatli o'tdingiz." },
    deliveryUpdated: { enabled: true, title: 'Yetkazib berish holati yangilandi', message: "Buyurtmangiz holati o'zgardi: {stage}." },
    muloqotMessage: { enabled: true, title: 'Yangi xabar keldi', message: "Sizga Muloqot bo'limida yangi xabar yozildi." },
    communityLike: { enabled: true, title: 'Postingiz yoqtirildi', message: 'Hamjamiyatdagi postingizga yurakcha bosishdi ❤️' },
    // 142-ish qayta ish 8: mijoz (student-app) tomonidan aniqlanib, maxsus
    // /api/state/notifications/level-up va /leaderboard-climb orqali qo'lda
    // qo'zg'atiladigan voqealar — chaqmoq/reyting butunlay qurilmada
    // (AsyncStorage) saqlangani sababli serverda o'zi hisoblab bo'lmaydi.
    levelUp: { enabled: true, title: 'Tabriklaymiz! Yangi darajaga chiqdingiz', message: 'Siz endi "{level}" darajasidasiz! Shunday davom eting 🎉' },
    leaderboardClimb: { enabled: true, title: "Reytingda ko'tarildingiz!", message: "Siz reytingda 10 pog'ona yuqoriga chiqdingiz — zo'r natija! 🏆" },
};

const LESSON_COUNTDOWN_RULES = [
    { id: 'lessonReminder120', minutes: 120 },
    { id: 'lessonReminder60', minutes: 60 },
    { id: 'lessonReminder30', minutes: 30 },
    { id: 'lessonReminder15', minutes: 15 },
    { id: 'lessonReminder10', minutes: 10 },
    { id: 'lessonReminder5', minutes: 5 },
    { id: 'lessonReminder0', minutes: 0 },
];
const COUNTDOWN_TOLERANCE_MINUTES = 3;

// 142-ish qayta ish 8: kun davomidagi 4 ta "hali ko'rmadingizmi" nazorat
// nuqtasi — soat kelganda va bugun hali video darsga oid faoliyat (mashqlar
// yakunlangani) qayd etilmagan bo'lsagina yuboriladi.
const VIDEO_REMINDER_CHECKPOINTS = [
    { id: 'videoLessonMorning', hour: 9 },
    { id: 'videoLessonNoon', hour: 12 },
    { id: 'videoLessonEvening', hour: 18 },
    { id: 'videoLessonNight', hour: 21 },
];

// js/storage.js'dagi SCHEDULE_PATTERNS bilan bir xil (mwf/tts, JS Date.getDay()
// konventsiyasi: 0=Yakshanba..6=Shanba).
const NOTIF_SCHEDULE_PATTERNS = {
    mwf: [1, 3, 5],
    tts: [2, 4, 6],
};

async function getNotificationRules() {
    const rules = await getJsonData('notificationRules');
    return { ...DEFAULT_NOTIFICATION_RULES, ...rules };
}

async function saveNotificationRules(rules) {
    await tx(async (client) => {
        await saveJsonData(client, 'notificationRules', rules || {});
    });
    return getNotificationRules();
}

async function getManualNotifications() {
    return getJsonData('manualNotifications');
}

async function addManualNotification(title, text, sentBy) {
    const trimmedTitle = String(title || '').trim();
    const trimmed = String(text || '').trim();
    if (!trimmedTitle || !trimmed) throw new Error("Sarlavha va matn to'ldirilishi shart");

    const all = await getJsonData('manualNotifications');
    const notification = {
        id: 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        title: trimmedTitle, message: trimmed,
        createdAt: new Date().toISOString(), sentBy: sentBy || 'Admin',
    };
    all.unshift(notification);
    await tx(async (client) => {
        await saveJsonData(client, 'manualNotifications', all);
    });
    sendPushToAll(notification.title, notification.message).catch(() => {});
    return notification;
}

async function deleteManualNotification(id) {
    const all = await getJsonData('manualNotifications');
    const filtered = all.filter(n => n.id !== id);
    await tx(async (client) => {
        await saveJsonData(client, 'manualNotifications', filtered);
    });
}

// Tizim voqealari — muayyan lahzada sodir bo'lgan hodisalar uchun (imtihondan
// o'tish, yetkazib berish, Ma'muriyat xabari, hamjamiyat yurakchasi). Qoida
// matni voqea sodir bo'lgan lahzada "suratga olinadi" — keyinroq qoida
// tahrirlansa ham, eski yozuvlar o'zgarmaydi.
async function addSystemNotification(ruleId, vars) {
    const rules = await getNotificationRules();
    const rule = rules[ruleId];
    if (!rule?.enabled) return null;
    const all = await getJsonData('systemNotifications');
    const notification = {
        id: 'sys-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        ruleId,
        title: fillNotificationTemplate(rule.title, vars || {}),
        message: fillNotificationTemplate(rule.message, vars || {}),
        createdAt: new Date().toISOString(),
    };
    all.unshift(notification);
    if (all.length > 100) all.length = 100;
    await tx(async (client) => {
        await saveJsonData(client, 'systemNotifications', all);
    });
    sendPushToAll(notification.title, notification.message).catch(() => {});
    return notification;
}

function fillNotificationTemplate(template, vars) {
    return String(template || '').replace(/\{(\w+)\}/g, (match, key) => (vars[key] != null ? vars[key] : match));
}

// ── Web Push obunalari — 142-ish qayta ish 8 ("appdan tashqarida" keladigan
// haqiqiy bildirishnomalar) ────────────────────────────────────────────────
// Bitta "namuna o'quvchi" arxitekturasiga mos — barcha obunalar bitta ro'yxatda
// saqlanadi va har bir tizim/hisoblangan voqeada BARCHASIGA yuboriladi
// (masalan bir nechta qurilmada ochilgan bo'lsa — telefon + kompyuter).
async function getPushSubscriptions() {
    return getJsonData('pushSubscriptions');
}

async function addPushSubscription(subscription) {
    if (!subscription?.endpoint) throw new Error("Noto'g'ri obuna ma'lumoti");
    const all = await getJsonData('pushSubscriptions');
    const filtered = all.filter(s => s.endpoint !== subscription.endpoint);
    filtered.push({ ...subscription, addedAt: new Date().toISOString() });
    await tx(async (client) => {
        await saveJsonData(client, 'pushSubscriptions', filtered);
    });
    return { ok: true };
}

async function removePushSubscription(endpoint) {
    const all = await getJsonData('pushSubscriptions');
    const filtered = all.filter(s => s.endpoint !== endpoint);
    await tx(async (client) => {
        await saveJsonData(client, 'pushSubscriptions', filtered);
    });
}

// Yaroqsiz bo'lib qolgan obunalarni (404/410 — foydalanuvchi ruxsatni bekor
// qilgan yoki brauzer obunani eskirtirgan) jimgina ro'yxatdan olib tashlaydi.
async function sendPushToAll(title, message, url) {
    const subs = await getPushSubscriptions();
    if (!subs.length) return;
    const payload = JSON.stringify({ title, body: message, url: url || '/student/notifications' });
    const stale = [];
    await Promise.all(subs.map(async (sub) => {
        try {
            await webpush.sendNotification(sub, payload);
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) stale.push(sub.endpoint);
        }
    }));
    if (stale.length) {
        const remaining = subs.filter(s => !stale.includes(s.endpoint));
        await tx(async (client) => {
            await saveJsonData(client, 'pushSubscriptions', remaining);
        });
    }
}

async function getDemoStudent(studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) return null;
    const row = await q1('SELECT * FROM students WHERE id = $1', [demoStudentId]);
    if (!row) return null;
    return rowToStudent(row);
}

// Bugun (Toshkent vaqti) darsning "kim uchun" video kuni ekanligini
// aniqlaydi — o'quvchining jonli (speaking) kunlari mwf/tts patternidan
// biri bo'lsa, video (grammar) kunlari QARAMA-QARSHI pattern kunlariga to'g'ri
// keladi (kurs strukturasi har kuni navbatma-navbat grammar/speaking darsi
// bo'yicha qurilgan — 72 dars, haftada 6 kun).
function isVideoLessonDayToday(livePattern) {
    const videoPattern = livePattern === 'tts' ? 'mwf' : 'tts';
    const nowTashkent = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const dow = nowTashkent.getUTCDay();
    return NOTIF_SCHEDULE_PATTERNS[videoPattern].includes(dow);
}

function tashkentNow() {
    return new Date(Date.now() + 5 * 60 * 60 * 1000);
}

// O'quvchining eng so'nggi o'tgan (bugungidan oldingi, oxirgi 7 kun ichidagi)
// jonli dars kunini topadi va o'sha kunda davomat belgilanganmi (main_attendance
// jadvalida qator bormi) tekshiradi. `att_key`/`day` formati CRM'ning
// davomat jadvali bilan bir xil (js/app.js renderMainAttendance): "YYYY-MM_teacherId" + kalendar kun raqami.
async function findRecentUnexplainedAbsence(student) {
    if (!student?.teacherId || student.lessonDayOfWeek == null) return null;
    const teacherRow = await q1('SELECT schedule_pattern FROM teachers WHERE id = $1', [student.teacherId]);
    const pattern = NOTIF_SCHEDULE_PATTERNS[teacherRow?.schedule_pattern] ? teacherRow.schedule_pattern : 'mwf';
    const liveDows = NOTIF_SCHEDULE_PATTERNS[pattern];

    const nowTashkent = tashkentNow();
    for (let back = 1; back <= 7; back++) {
        const d = new Date(Date.UTC(nowTashkent.getUTCFullYear(), nowTashkent.getUTCMonth(), nowTashkent.getUTCDate() - back));
        if (!liveDows.includes(d.getUTCDay())) continue;
        const year = d.getUTCFullYear(), month = d.getUTCMonth() + 1, day = d.getUTCDate();
        const monthVal = `${year}-${String(month).padStart(2, '0')}`;
        const dateStr = `${monthVal}-${String(day).padStart(2, '0')}`;
        const attKey = `${monthVal}_${student.teacherId}`;

        const presentRow = await q1(
            'SELECT 1 FROM main_attendance WHERE att_key = $1 AND student_id = $2 AND day = $3',
            [attKey, student.id, day]
        );
        if (presentRow) return null; // eng so'nggi jonli kunda qatnashgan — so'rovnoma kerak emas

        const reasons = await getJsonData('absenceReasons');
        if (reasons[student.id]?.[dateStr]) return null; // sababi allaqachon berilgan

        return dateStr; // qatnashmagan va sababi hali berilmagan
    }
    return null;
}

// Namuna o'quvchi appdagi "Darsni nega qoldirdingiz?" so'rovnomasiga javob
// berganda shu yerga yoziladi — shu sana uchun `findRecentUnexplainedAbsence`
// endi qayta so'ramaydi.
// 150-ish: avval bu global `absenceReasons[dateStr]` kalitida saqlanardi —
// haqiqiy ko'p o'quvchi bilan bu bitta o'quvchining sababini boshqa
// o'quvchiga ham "berilgan" deb ko'rsatib qo'yardi. Endi o'quvchi bo'yicha
// ichma-ich joylashtirilgan.
async function submitAbsenceReason(lessonDate, reason, studentId) {
    const dateStr = String(lessonDate || '').trim();
    const trimmedReason = String(reason || '').trim();
    if (!dateStr || !trimmedReason) throw new Error("Sana va sabab yuborilishi shart");
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");
    const reasons = await getJsonData('absenceReasons');
    if (!reasons[demoStudentId]) reasons[demoStudentId] = {};
    reasons[demoStudentId][dateStr] = trimmedReason;
    await tx(async (client) => {
        await saveJsonData(client, 'absenceReasons', reasons);
    });
}

// Namuna o'quvchi (va CRM'ning oldindan ko'rish oynasi) uchun haqiqiy,
// birlashtirilgan bildirishnomalar ro'yxatini qaytaradi.
async function getComputedDemoNotifications(studentId) {
    const rules = await getNotificationRules();
    const notifications = [];
    const student = await getDemoStudent(studentId);

    // ── Jonli dars sanog'i (7 ta chegara) ───────────────────────────────────
    const schedule = await getDemoStudentSchedule(studentId);
    if (schedule.startsAt) {
        const minutesUntil = (new Date(schedule.startsAt).getTime() - Date.now()) / 60000;
        for (const { id, minutes } of LESSON_COUNTDOWN_RULES) {
            const rule = rules[id];
            if (!rule?.enabled) continue;
            const windowLow = minutes === 0 ? -COUNTDOWN_TOLERANCE_MINUTES : minutes - COUNTDOWN_TOLERANCE_MINUTES;
            const windowHigh = minutes === 0 ? COUNTDOWN_TOLERANCE_MINUTES : minutes;
            if (minutesUntil >= windowLow && minutesUntil <= windowHigh) {
                const vars = {
                    course: schedule.topic || 'Dars',
                    time: new Date(schedule.startsAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
                };
                notifications.push({
                    id: 'auto-' + id + '-' + schedule.startsAt,
                    category: 'lessons', source: 'auto',
                    title: fillNotificationTemplate(rule.title, vars),
                    message: fillNotificationTemplate(rule.message, vars),
                    date: new Date().toISOString(),
                    unread: true,
                });
                break; // faqat eng yaqin chegara ko'rsatiladi, bir vaqtda bir nechtasi emas
            }
        }
    }

    // ── Ustozni baholash (dars tugagach) ────────────────────────────────────
    if (rules.teacherRatingPrompt?.enabled) {
        const { grades } = await getDemoStudentGrades(studentId);
        const unrated = grades.find(g => !g.studentRatingOfTeacher);
        if (unrated) {
            notifications.push({
                id: 'auto-teacherRatingPrompt-' + unrated.date,
                category: 'lessons', source: 'auto',
                title: rules.teacherRatingPrompt.title,
                message: rules.teacherRatingPrompt.message,
                date: new Date().toISOString(),
                unread: true,
                interactive: 'rate-teacher',
            });
        }
    }

    // ── Bugun videodars kuni (09:00/12:00/18:00/21:00 nazorat nuqtalari) ────
    if (student?.lessonDayOfWeek != null && VIDEO_REMINDER_CHECKPOINTS.some(cp => rules[cp.id]?.enabled)) {
        const teacherRow = await q1('SELECT schedule_pattern FROM teachers WHERE id = $1', [student.teacherId]);
        const livePattern = teacherRow?.schedule_pattern || 'mwf';
        const now = tashkentNow();
        if (isVideoLessonDayToday(livePattern)) {
            const todayStr = now.toISOString().slice(0, 10);
            // Video mashqlari yakunlangani — videoni ko'rib chiqqanining eng
            // yaqin serverda kuzatiladigan belgisi (mashqlarni bajarish uchun
            // avval video ko'rilishi kerak).
            const activity = await getDemoStudentActivity();
            const watchedToday = activity.some(a => a.type === 'video' && a.time.slice(0, 10) === todayStr);
            if (!watchedToday) {
                const nowHour = now.getUTCHours();
                // Faqat eng yaqin (o'tib bo'lgan) nazorat nuqtasi ko'rsatiladi —
                // bir vaqtda bir nechtasi emas (LESSON_COUNTDOWN_RULES'dagi kabi).
                const dueCheckpoint = [...VIDEO_REMINDER_CHECKPOINTS].reverse().find(cp => rules[cp.id]?.enabled && nowHour >= cp.hour);
                if (dueCheckpoint) {
                    notifications.push({
                        id: 'auto-' + dueCheckpoint.id + '-' + todayStr,
                        category: 'lessons', source: 'auto',
                        title: rules[dueCheckpoint.id].title,
                        message: rules[dueCheckpoint.id].message,
                        date: new Date().toISOString(),
                        unread: true,
                    });
                }
            }
        }
    }

    // ── Uyga vazifa tugallanmagan (09:00-22:00) ─────────────────────────────
    if (rules.homeworkIncomplete?.enabled) {
        const now = tashkentNow();
        if (now.getUTCHours() >= 9 && now.getUTCHours() < 22) {
            const todayStr = now.toISOString().slice(0, 10);
            const activity = await getDemoStudentActivity();
            const todaysHomework = activity.filter(a => a.type === 'homework' && a.time.slice(0, 10) === todayStr);
            const completedToday = todaysHomework.some(a => (a.scorePercent || 0) >= 100);
            if (!completedToday) {
                notifications.push({
                    id: 'auto-homeworkIncomplete-' + todayStr,
                    category: 'lessons', source: 'auto',
                    title: rules.homeworkIncomplete.title,
                    message: rules.homeworkIncomplete.message,
                    date: new Date().toISOString(),
                    unread: true,
                });
            }
        }
    }

    // ── Yakshanba bonus dars taklifi (12:00 dan) ────────────────────────────
    if (rules.bonusLessonSunday?.enabled) {
        const now = tashkentNow();
        if (now.getUTCDay() === 0 && now.getUTCHours() >= 12) {
            notifications.push({
                id: 'auto-bonusLessonSunday-' + now.toISOString().slice(0, 10),
                category: 'news', source: 'auto',
                title: rules.bonusLessonSunday.title,
                message: rules.bonusLessonSunday.message,
                date: new Date().toISOString(),
                unread: true,
            });
        }
    }

    // ── To'lov qarzdorligi ───────────────────────────────────────────────────
    if (rules.paymentDebt?.enabled && student) {
        const debtRow = await q1('SELECT COALESCE(SUM(debt),0) AS total FROM payments WHERE student_id = $1', [student.id]);
        if (debtRow && Number(debtRow.total) > 0) {
            notifications.push({
                id: 'auto-paymentDebt-' + student.id,
                category: 'news', source: 'auto',
                title: rules.paymentDebt.title,
                message: rules.paymentDebt.message,
                date: new Date().toISOString(),
                unread: true,
            });
        }
    }

    // ── Dars qoldirish sababi so'rovnomasi ──────────────────────────────────
    if (rules.absenceSurvey?.enabled && student) {
        const absenceDate = await findRecentUnexplainedAbsence(student);
        if (absenceDate) {
            notifications.push({
                id: 'auto-absenceSurvey-' + absenceDate,
                category: 'lessons', source: 'auto',
                title: rules.absenceSurvey.title,
                message: rules.absenceSurvey.message,
                date: new Date().toISOString(),
                unread: true,
                interactive: 'attendance',
                lessonDate: absenceDate,
            });
        }
    }

    // ── Tizim voqealari + qo'lda yuborilgan xabarlar ────────────────────────
    const system = await getJsonData('systemNotifications');
    for (const n of system) {
        notifications.push({
            id: n.id, category: 'news', source: 'system',
            title: n.title, message: n.message,
            date: n.createdAt, unread: true,
        });
    }

    const manual = await getManualNotifications();
    for (const n of manual) {
        notifications.push({
            id: n.id, category: 'news', source: 'manual',
            title: n.title, message: n.message,
            date: n.createdAt, unread: true,
        });
    }

    notifications.sort((a, b) => new Date(b.date) - new Date(a.date));
    return notifications;
}

// ── Hamjamiyat (Community) ───────────────────────────────────────────────────
// Bitta umumiy lenta — namuna o'quvchi ilovadan ko'radigan va CRM
// administratori nazorat qiladigan bir xil ma'lumot. "likedByMe"/"me"
// maydonlari yagona haqiqiy foydalanuvchi — namuna o'quvchi — nuqtai
// nazaridan yoziladi.

async function getCommunityPosts() {
    return await getJsonData('communityPosts');
}

async function addCommunityPost(text, authorName, authorEmoji, imageUri) {
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error("Post matni bo'sh bo'lishi mumkin emas");
    const posts = await getJsonData('communityPosts');
    const post = {
        id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        authorName: authorName || "O'quvchi",
        authorEmoji: authorEmoji || '🙂',
        createdAt: Date.now(),
        text: trimmed,
        imageUri: imageUri || null,
        likeCount: 0, likedByMe: false, shareCount: 0, viewCount: 0,
        comments: [], me: true,
    };
    posts.unshift(post);
    await tx(async (client) => { await saveJsonData(client, 'communityPosts', posts); });
    return post;
}

async function toggleCommunityPostLike(postId) {
    const posts = await getJsonData('communityPosts');
    const post = posts.find(p => p.id === postId);
    if (!post) throw new Error('Post topilmadi');
    post.likedByMe = !post.likedByMe;
    post.likeCount = Math.max(0, (post.likeCount || 0) + (post.likedByMe ? 1 : -1));
    await tx(async (client) => { await saveJsonData(client, 'communityPosts', posts); });
    if (post.likedByMe) {
        await addSystemNotification('communityLike', {});
    }
    return post;
}

async function addCommunityComment(postId, text, parentId, authorName, authorEmoji) {
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error("Izoh matni bo'sh bo'lishi mumkin emas");
    const posts = await getJsonData('communityPosts');
    const post = posts.find(p => p.id === postId);
    if (!post) throw new Error('Post topilmadi');
    const comment = {
        id: 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        postId, parentId: parentId || null,
        authorName: authorName || "O'quvchi",
        authorEmoji: authorEmoji || '🙂',
        createdAt: Date.now(),
        text: trimmed, likeCount: 0, likedByMe: false, me: true,
    };
    post.comments.push(comment);
    await tx(async (client) => { await saveJsonData(client, 'communityPosts', posts); });
    return comment;
}

async function toggleCommunityCommentLike(postId, commentId) {
    const posts = await getJsonData('communityPosts');
    const post = posts.find(p => p.id === postId);
    if (!post) throw new Error('Post topilmadi');
    const comment = post.comments.find(c => c.id === commentId);
    if (!comment) throw new Error('Izoh topilmadi');
    comment.likedByMe = !comment.likedByMe;
    comment.likeCount = Math.max(0, (comment.likeCount || 0) + (comment.likedByMe ? 1 : -1));
    await tx(async (client) => { await saveJsonData(client, 'communityPosts', posts); });
    return comment;
}

// Faqat admin (CRM) uchun — istalgan postni yoki izohni butunlay o'chiradi.
async function deleteCommunityPost(postId) {
    const posts = await getJsonData('communityPosts');
    const next = posts.filter(p => p.id !== postId);
    await tx(async (client) => { await saveJsonData(client, 'communityPosts', next); });
}

async function deleteCommunityComment(postId, commentId) {
    const posts = await getJsonData('communityPosts');
    const post = posts.find(p => p.id === postId);
    if (!post) throw new Error('Post topilmadi');
    post.comments = post.comments.filter(c => c.id !== commentId);
    await tx(async (client) => { await saveJsonData(client, 'communityPosts', posts); });
}

// ── "Homework Radio" jadvali — 144-ish ───────────────────────────────────────
// CRM'da yuklangan audio kliplarni haqiqiy kalendar sanasi + soat oralig'iga
// bog'laydi: { "2026-07-14": [{id,title,startTime,endTime,audioUrl}, ...] }.
// Takrorlanadigan haftalik shablon emas — haqiqiy, doimiy o'sib boradigan
// dastur jadvali (CRM'ning davomat jadvali kabi haqiqiy sanalar bilan
// ishlaydi). Appdagi pleer shu yerdan o'qib, hozirgi vaqtga to'g'ri keladigan
// klipni topib qo'yadi — mos kelmasa radio jim turadi.
async function getHomeworkRadioSchedule() {
    return getJsonData('homeworkRadioSchedule');
}

async function saveHomeworkRadioDay(dateStr, blocks) {
    const trimmedDate = String(dateStr || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) throw new Error("Sana formati noto'g'ri");
    const schedule = await getJsonData('homeworkRadioSchedule');
    if (Array.isArray(blocks) && blocks.length) {
        schedule[trimmedDate] = blocks;
    } else {
        delete schedule[trimmedDate];
    }
    await tx(async (client) => {
        await saveJsonData(client, 'homeworkRadioSchedule', schedule);
    });
    return schedule[trimmedDate] || [];
}

// ── "Izohlar" (Comments) — 145-ish ───────────────────────────────────────────
// Bitta umumiy, tekis massiv — turli kontent turlari (hozircha faqat radio,
// keyinroq video/speaking/bonus/ustoz ham qo'shilishi mumkin) uchun bir xil
// shaklda: { id, category, itemId, itemLabel, authorName, text, createdAt,
// parentId, isAdmin, adminName? }. `parentId` orqali istalgan izohga javob
// yozish mumkin (Hamjamiyat'dagi addCommunityComment bilan bir xil naqsh) —
// izoh muallifi o'quvchimi yoki CRM adminmi, `isAdmin` bilan ajratiladi.
async function getContentComments() {
    return getJsonData('contentComments');
}

async function addContentComment(category, itemId, itemLabel, authorName, text, parentId) {
    const trimmedCategory = String(category || '').trim();
    const trimmedItemId = String(itemId || '').trim();
    const trimmed = String(text || '').trim();
    if (!trimmedCategory || !trimmedItemId) throw new Error("Kontent aniqlanmadi");
    if (!trimmed) throw new Error("Izoh matni bo'sh bo'lishi mumkin emas");

    const all = await getJsonData('contentComments');
    const comment = {
        id: 'cc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        category: trimmedCategory, itemId: trimmedItemId,
        itemLabel: itemLabel || trimmedItemId,
        authorName: authorName || "O'quvchi",
        text: trimmed,
        createdAt: new Date().toISOString(),
        parentId: parentId || null,
        isAdmin: false,
    };
    all.push(comment);
    await tx(async (client) => { await saveJsonData(client, 'contentComments', all); });
    return comment;
}

// Faqat CRM admin — istalgan izohga (o'quvchiniki yoki boshqa adminniki)
// javob yozadi. category/itemId/itemLabel javob yozilayotgan izohdan
// avtomatik olinadi (mijozdan so'ralmaydi).
async function addAdminContentReply(commentId, text, adminName) {
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error("Javob matni bo'sh bo'lishi mumkin emas");
    const all = await getJsonData('contentComments');
    const parent = all.find(c => c.id === commentId);
    if (!parent) throw new Error('Izoh topilmadi');

    const reply = {
        id: 'cc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        category: parent.category, itemId: parent.itemId, itemLabel: parent.itemLabel,
        authorName: adminName || 'Admin',
        text: trimmed,
        createdAt: new Date().toISOString(),
        parentId: commentId,
        isAdmin: true,
    };
    all.push(reply);
    await tx(async (client) => { await saveJsonData(client, 'contentComments', all); });
    return reply;
}

// Faqat CRM admin — izohni (va agar bor bo'lsa, unga yozilgan barcha
// javoblarni ham) butunlay o'chiradi.
async function deleteContentComment(commentId) {
    const all = await getJsonData('contentComments');
    // Faqat to'g'ridan-to'g'ri javoblar emas, balki javobga yozilgan javoblar
    // ham (butun zanjir) o'chiriladi — aks holda "yetim" yozuvlar qolib ketadi.
    const toDelete = new Set([commentId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const c of all) {
            if (c.parentId && toDelete.has(c.parentId) && !toDelete.has(c.id)) {
                toDelete.add(c.id);
                changed = true;
            }
        }
    }
    const filtered = all.filter(c => !toDelete.has(c.id));
    await tx(async (client) => { await saveJsonData(client, 'contentComments', filtered); });
}

// ── "Zapis" (qo'ng'iroq yozuvlari) — 45-vazifa ───────────────────────────────
// Bitta umumiy, tekis massiv: { id, lang, leadId, url, fileName, duration,
// source ('manual'|'beeline'), uploadedBy, createdAt }. `lang`+`leadId`
// juftligi qaysi lidga tegishli ekanini bildiradi (js/app.js'dagi
// getLeadById(lang, leadId) bilan bir xil naqsh — Sotuv bo'limidagi
// Ingliz/Rus tili filtri). Hozircha faqat "manual" (CRM'dan qo'lda
// yuklangan) manba ishlaydi. Beeline IP Telefoniyasi hali ulanmagan (hisob
// yo'q, API hujjatlari yo'q) — pastdagi handleBeelineWebhook shu sabab hali
// faqat logga yozadi, haqiqiy integratsiya hisob ochilib API ko'rilgach
// yakunlanadi.
async function getCallRecordings(lang, leadId) {
    const trimmedLang = lang === 'russian' ? 'russian' : 'english';
    const trimmedLeadId = String(leadId || '').trim();
    if (!trimmedLeadId) return [];
    const all = await getJsonData('callRecordings');
    return all
        .filter(r => r.lang === trimmedLang && r.leadId === trimmedLeadId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Kanban kartochkalaridagi mikrofon belgisi uchun barcha lidlarning zapis
// sonini bir so'rovda qaytaradi. Kalit: "lang:leadId".
async function getCallRecordingCounts() {
    const all = await getJsonData('callRecordings');
    return all.reduce((counts, recording) => {
        const lang = recording.lang === 'russian' ? 'russian' : 'english';
        const leadId = String(recording.leadId || '').trim();
        if (!leadId) return counts;
        const key = `${lang}:${leadId}`;
        counts[key] = (counts[key] || 0) + 1;
        return counts;
    }, {});
}

async function addCallRecording({ lang, leadId, url, fileName, duration, uploadedBy, source }) {
    const trimmedLang = lang === 'russian' ? 'russian' : 'english';
    const trimmedLeadId = String(leadId || '').trim();
    const trimmedUrl = String(url || '').trim();
    if (!trimmedLeadId) throw new Error('Lid aniqlanmadi');
    if (!trimmedUrl) throw new Error('Fayl havolasi topilmadi');

    const all = await getJsonData('callRecordings');
    const recording = {
        id: 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        lang: trimmedLang,
        leadId: trimmedLeadId,
        url: trimmedUrl,
        fileName: fileName || '',
        duration: Number(duration) || 0,
        source: source === 'beeline' ? 'beeline' : 'manual',
        uploadedBy: uploadedBy || '',
        createdAt: new Date().toISOString(),
    };
    all.push(recording);
    await tx(async (client) => { await saveJsonData(client, 'callRecordings', all); });
    return recording;
}

// Noto'g'ri yuklangan zapisni o'chirish. Bir martada faqat bitta yozuv
// o'chiriladi — ommaviy o'chirish yo'li ataylab qo'yilmagan.
async function deleteCallRecording(id) {
    const trimmedId = String(id || '').trim();
    if (!trimmedId) throw new Error('Zapis aniqlanmadi');

    const all = await getJsonData('callRecordings');
    const recording = all.find(r => r.id === trimmedId);
    if (!recording) throw new Error('Zapis topilmadi');

    const qolgan = all.filter(r => r.id !== trimmedId);
    await tx(async (client) => { await saveJsonData(client, 'callRecordings', qolgan); });
    return recording;
}

// SMS rassilka tarixi — Eskiz.uz orqali yuborilgan har bir SMS uchun bitta
// yozuv (natijasi muvaffaqiyatli yoki xatolik bo'lishidan qat'i nazar, shu
// yerda saqlanadi — hisobot/tekshiruv uchun).
async function getSmsHistory(limit) {
    const all = await getJsonData('smsHistory');
    const sorted = [...all].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    return limit ? sorted.slice(0, limit) : sorted;
}

async function addSmsHistoryEntries(entries) {
    const all = await getJsonData('smsHistory');
    const withIds = entries.map(e => ({
        id: 'sms-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        sentAt: new Date().toISOString(),
        ...e,
    }));
    all.push(...withIds);
    await tx(async (client) => { await saveJsonData(client, 'smsHistory', all); });
    return withIds;
}

// Beeline IP Telefoniyasi hisobi hali ochilmagan va API hujjatlari
// ko'rilmagan — shu sabab bu funksiya HAQIQIY integratsiya EMAS, faqat
// kelgan so'rovni Railway loglariga yozib, 200 qaytaradi. Hisob ochilib
// sinov qo'ng'irog'i qilinganda, shu loglardan Beeline'ning haqiqiy payload
// shaklini ko'rib, quyidagi TODO qadamlarni yakunlash kerak:
//   1) payload'dan qo'ng'iroq qilingan raqamni aniqlash va shu raqam
//      bo'yicha tegishli lidni (lang+leadId) topish (masalan leads jadvalida
//      telefon raqami bo'yicha qidiruv orqali),
//   2) audio fayl havolasini olish (Beeline to'g'ridan-to'g'ri URL bersa —
//      shuni ishlatish, aks holda faylni yuklab olib /uploads'ga saqlash),
//   3) addCallRecording({ lang, leadId, url, source: 'beeline', ... })
//      chaqirish.
async function handleBeelineWebhook(payload) {
    console.log('[beeline-webhook] Hali integratsiya yozilmagan — kelgan payload:', JSON.stringify(payload));
    return { ok: true, note: 'logged, integration pending' };
}

// 124-ish: CRM'ning Sotuv bo'limidagi "Kitob yetkazish" kanban-bosqichlarini
// appning 4 bosqichli ko'rsatkichiga (Tayyorlanmoqda/Jo'natildi/Yo'lda/
// Yetkazib berildi) moslashtiradi.
const BOOK_ROADMAP_STAGE_MAP = {
    'yangi-oquvchi': 'preparing',
    'manzil-olindi': 'preparing',
    'pochtaga-tayyorlandi': 'preparing',
    'pochtaga-topshirildi': 'dispatched',
    'pochta-yetib-bordi': 'in_transit',
    'mijoz-qabul-qildi': 'delivered',
};

// Public endpoint uchun — faqat CRM'da "Namuna o'quvchi" deb belgilangan
// bitta o'quvchining haqiqiy kitob yetkazib berish holatini qaytaradi.
// bookRoadmap yozuvi studentga to'g'ridan-to'g'ri bog'lanmagani uchun
// (CRM'da bu maydon to'ldirilmaydi), avval student.leadRef orqali (ishonchli),
// topilmasa ism bo'yicha (best-effort) moslashtiriladi.
async function getDemoStudentBookDelivery(studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) return null;
    const studentRow = await q1('SELECT * FROM students WHERE id = $1', [demoStudentId]);
    if (!studentRow) return null;
    const student = rowToStudent(studentRow);

    const studentLang = await resolveStudentSubjectLang(demoStudentId);
    const studentDisplayId = String(student.serialCode || String(student.id || '').slice(-6)).trim().toLowerCase();
    const bookRoadmap = await getBookRoadmap();
    let entry = null;
    // Eng ishonchli bog'lanish — Sotuv bo'limidagi Student ID. Til ham
    // tekshiriladi, shunda bir xil ismli ingliz/rus o'quvchilar aralashmaydi.
    if (studentDisplayId) {
        entry = bookRoadmap.find(b =>
            b.lang === studentLang && String(b.studentId || '').trim().toLowerCase() === studentDisplayId
        );
    }
    if (!entry && student.leadRef?.id) {
        entry = bookRoadmap.find(b =>
            b.lang === studentLang && b.leadRef && b.leadRef.id === student.leadRef.id &&
            b.leadRef.lang === student.leadRef.lang
        );
    }
    if (!entry && student.name) {
        const target = student.name.trim().toLowerCase();
        entry = bookRoadmap.find(b =>
            b.lang === studentLang && b.name && b.name.trim().toLowerCase() === target
        );
    }
    if (!entry) return null;

    return {
        address: entry.address || '',
        stage: BOOK_ROADMAP_STAGE_MAP[entry.status] || 'preparing',
        dispatchedDate: entry.dispatchedAt || null,
        deliveredDate: entry.deliveredAt || null,
        lang: studentLang,
        studentId: studentDisplayId,
    };
}

// 139-ish: Homework Shop'dan sotib olingan mahsulotlarning yetkazib berish
// holati — CRM'ning "Yetkazib berish" kanban'i bilan bir xil 4 bosqichli
// DeliveryStage (preparing/dispatched/in_transit/delivered) ishlatiladi,
// kitob yetkazishdagi kabi murakkab lead-bosqichlar kerak emas, chunki
// mahsulot allaqachon ro'yxatdan o'tgan o'quvchi tomonidan sotib olinadi.

// Namuna o'quvchi ilovadan mahsulot sotib olganda shu yerga yozadi.
// StudentId har doim serverda demoStudentId'dan olinadi.
async function addDemoShopOrder(productId, productName, category, price, studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    let studentName = '';
    if (demoStudentId) {
        const row = await q1('SELECT name FROM students WHERE id = $1', [demoStudentId]);
        studentName = row?.name || '';
    }
    const orders = await getJsonData('shopOrders');
    const order = {
        id: 'order-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        studentId: demoStudentId || null,
        studentName,
        productId: productId || '',
        productName: productName || "Noma'lum mahsulot",
        category: category || '',
        price: Number(price) || 0,
        stage: 'preparing',
        createdAt: Date.now(),
        dispatchedAt: null,
        deliveredAt: null,
    };
    orders.unshift(order);
    await tx(async (client) => { await saveJsonData(client, 'shopOrders', orders); });
    return order;
}

// Public endpoint uchun — faqat CRM'da "Namuna o'quvchi" deb belgilangan
// bitta o'quvchining o'z buyurtmalarini qaytaradi (appning "Yetkazib
// berish" ekranidagi StageTimeline shu yerdan real vaqtda o'qiydi).
async function getDemoShopOrders(studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) return [];
    const orders = await getJsonData('shopOrders');
    return orders.filter(o => o.studentId === demoStudentId);
}

const ACTIVITY_TYPES = ['exam', 'homework', 'video', 'vocab'];
const MAX_ACTIVITY_ENTRIES = 50;

// 125-ish: appda o'quvchi imtihon/uyga vazifa/video/lug'at mashqlarini
// bajarganda haqiqiy natijasini (ball, to'g'ri/adashgan) shu yerga yozadi —
// ustoz o'z kabinetidan va admin profilidan bularni kuzatib turishi uchun.
// Faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta o'quvchi uchun.
async function getDemoStudentActivity(studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) return [];
    const all = await getJsonData('studentActivity');
    return all[demoStudentId] || [];
}

async function addDemoStudentActivity(entry, studentId) {
    const type = String(entry?.type || '').trim();
    if (!ACTIVITY_TYPES.includes(type)) throw new Error("Noto'g'ri faoliyat turi");
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");

    const all = await getJsonData('studentActivity');
    if (!all[demoStudentId]) all[demoStudentId] = [];
    const record = {
        id: 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        type,
        label: String(entry.label || '').slice(0, 200),
        scorePercent: typeof entry.scorePercent === 'number' ? entry.scorePercent : null,
        passed: typeof entry.passed === 'boolean' ? entry.passed : null,
        wrongAttempts: typeof entry.wrongAttempts === 'number' ? entry.wrongAttempts : null,
        mistakes: Array.isArray(entry.mistakes)
            ? entry.mistakes.slice(0, 20).map(m => ({
                question: String(m?.question || '').slice(0, 300),
                yourAnswer: String(m?.yourAnswer || '').slice(0, 300),
                correctAnswer: String(m?.correctAnswer || '').slice(0, 300),
            }))
            : [],
        time: new Date().toISOString(),
    };
    all[demoStudentId].unshift(record);
    if (all[demoStudentId].length > MAX_ACTIVITY_ENTRIES) all[demoStudentId].length = MAX_ACTIVITY_ENTRIES;
    await tx(async (client) => {
        await saveJsonData(client, 'studentActivity', all);
    });
    if (type === 'exam' && record.passed === true) {
        await addSystemNotification('examPassed', { label: record.label || 'Imtihon' });
    }
    return record;
}

// 148-ish: video/speaking darslardagi "Ijodiy vazifa" — o'quvchi matn/audio/
// rasm yuborgach "kutilmoqda" holatida turadi, ustoz kabinetidan qabul
// qilinmaguncha darsning umumiy progressiga 100% sifatida qo'shilmaydi.
// Bir darsda faqat bitta faol topshiriq bo'ladi — qayta yuborilsa (masalan
// "Tahrirlash va qayta yuborish"), oldingi yozuv shu lessonId bo'yicha
// almashtiriladi. Faqat "Namuna o'quvchi" uchun (studentActivity bilan bir
// xil cheklov).
async function getDemoCreativeSubmissions(studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) return {};
    const all = await getJsonData('creativeSubmissions');
    return all[demoStudentId] || {};
}

async function submitDemoCreativeSubmission(entry, studentId) {
    const lessonId = String(entry?.lessonId || '').trim();
    if (!lessonId) throw new Error("Dars belgilanmagan");
    // 54-vazifa: "O'qib tarjima qilish mashqi" ham shu xuddi shu (pending/
    // graded) tekshiruv oqimidan foydalanadi, faqat 'reading' kategoriyasi
    // bilan va lessonId o'rniga composite kalit (submissionKey) ostida.
    const category = ['video', 'speaking', 'reading'].includes(entry?.category) ? entry.category : 'video';
    const mediaType = entry?.mediaType === 'audio' ? 'audio' : 'text';
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");

    const all = await getJsonData('creativeSubmissions');
    if (!all[demoStudentId]) all[demoStudentId] = {};
    const record = {
        lessonId,
        lessonTitle: String(entry.lessonTitle || '').slice(0, 200),
        category,
        mediaType,
        text: mediaType === 'text' ? String(entry.text || '').slice(0, 4000) : '',
        imageUrl: entry.imageUrl ? String(entry.imageUrl).slice(0, 500) : null,
        audioUrl: mediaType === 'audio' && entry.audioUrl ? String(entry.audioUrl).slice(0, 500) : null,
        status: 'pending',
        scorePercent: null,
        feedback: null,
        submittedAt: new Date().toISOString(),
        gradedAt: null,
    };
    all[demoStudentId][lessonId] = record;
    await tx(async (client) => {
        await saveJsonData(client, 'creativeSubmissions', all);
    });
    return record;
}

// 4-vazifa: ustoz kabinetidan endi HAR BIR haqiqiy o'quvchining ijodiy
// vazifasini baholay olishi kerak, faqat "Namuna o'quvchi"ni emas —
// shuning uchun studentId (berilsa) shu orqali resolveStudentId bilan
// aniqlanadi, berilmasa eskicha demoStudentId'ga tushadi (orqaga
// mos kelish uchun).
async function gradeDemoCreativeSubmission(lessonId, { scorePercent, feedback } = {}, studentId) {
    const demoStudentId = await resolveStudentId(studentId);
    if (!demoStudentId) throw new Error("Namuna o'quvchi belgilanmagan");
    const all = await getJsonData('creativeSubmissions');
    const record = all[demoStudentId] && all[demoStudentId][lessonId];
    if (!record) throw new Error("Ijodiy vazifa topilmadi");
    record.status = 'graded';
    record.scorePercent = typeof scorePercent === 'number' ? Math.max(0, Math.min(100, Math.round(scorePercent))) : 100;
    record.feedback = String(feedback || "Juda yaxshi bajarilgan, davom eting!").slice(0, 500);
    record.gradedAt = new Date().toISOString();
    await tx(async (client) => {
        await saveJsonData(client, 'creativeSubmissions', all);
    });
    return record;
}

async function saveJsonData(client, key, data) {
    await client.query(
        `INSERT INTO json_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`,
        [key, JSON.stringify(data)]
    );
}

// 142-ish: patchState orqali kelayotgan studentMessages/shopOrders'ni
// yozishdan OLDIN eski holat bilan solishtirib, "Ma'muriyatdan xabar" va
// "Yetkazib berish holati yangilandi" tizim voqealarini aniqlaydi. Bu yerda
// aniqlanadi, chunki bu ikkalasi ham CRM'ning umumiy `setItem` -> generic
// PATCH oqimi orqali yoziladi (dedicated endpoint yo'q) — yagona real tutash
// nuqta shu.
async function detectPatchStateNotificationEvents(partial) {
    const demoStudentId = await getJsonData('demoStudentId');
    if (!demoStudentId) return;

    if (partial.studentMessages !== undefined) {
        const oldAll = await getJsonData('studentMessages');
        const oldThreads = oldAll[demoStudentId] || {};
        const newThreads = partial.studentMessages[demoStudentId] || {};
        for (const threadId of Object.keys(newThreads)) {
            const oldMsgs = oldThreads[threadId] || [];
            const oldIds = new Set(oldMsgs.map(m => m.id));
            const newMsgs = newThreads[threadId] || [];
            const hasNewAdminMsg = newMsgs.some(m => !oldIds.has(m.id) && m.sender !== 'student');
            if (hasNewAdminMsg) {
                await addSystemNotification('muloqotMessage', {});
                break;
            }
        }
    }

    if (partial.shopOrders !== undefined) {
        const oldOrders = await getJsonData('shopOrders');
        const oldStageById = new Map(oldOrders.map(o => [o.id, o.stage]));
        for (const order of partial.shopOrders) {
            if (order.studentId !== demoStudentId) continue;
            const oldStage = oldStageById.get(order.id);
            if (oldStage !== undefined && oldStage !== order.stage) {
                await addSystemNotification('deliveryUpdated', { stage: SHOP_ORDER_STAGE_LABELS[order.stage] || order.stage });
            }
        }
    }
}

const SHOP_ORDER_STAGE_LABELS = {
    preparing: 'Tayyorlanmoqda',
    dispatched: "Jo'natildi",
    in_transit: "Yo'lda",
    delivered: 'Yetkazildi',
};

async function patchState(partial) {
    await detectPatchStateNotificationEvents(partial);
    await tx(async (client) => {
        if (partial.teachers)           await saveTeachers(client, partial.teachers);
        if (partial.students)           await saveStudents(client, partial.students);
        if (partial.salesManagers)      await saveSalesManagers(client, partial.salesManagers);
        if (partial.timetable)          await saveTimetable(client, partial.timetable);
        if (partial.mainAttendance)     await saveAttendanceTable(client, 'main_attendance', partial.mainAttendance);
        if (partial.assistantAttendance) await saveAttendanceTable(client, 'assistant_attendance', partial.assistantAttendance);
        if (partial.payments)           await savePayments(client, partial.payments);
        if (partial.leads)              await saveLeads(client, partial.leads);
        if (partial.hrEmployees)        await saveHrEmployeesData(client, partial.hrEmployees);
        if (partial.bookRoadmap)        await saveBookRoadmap(client, partial.bookRoadmap);
        if (partial.mobileContent)      await saveMobileContentData(client, partial.mobileContent);
        if (partial.scripts !== undefined)     await saveJsonData(client, 'scripts', partial.scripts);
        if (partial.bonusHistory !== undefined) await saveJsonData(client, 'bonusHistory', partial.bonusHistory);
        if (partial.bonusData !== undefined)   await saveJsonData(client, 'bonusData', partial.bonusData);
        if (partial.salesPlan !== undefined)   await saveJsonData(client, 'salesPlan', partial.salesPlan);
        if (partial.cashFlow !== undefined)    await saveJsonData(client, 'cashFlow', partial.cashFlow);
        if (partial.orgChart !== undefined)    await saveJsonData(client, 'orgChart', partial.orgChart);
        if (partial.manualMetrics !== undefined) await saveJsonData(client, 'manualMetrics', partial.manualMetrics);
        if (partial.liveGrades !== undefined)    await saveJsonData(client, 'liveGrades', partial.liveGrades);
        if (partial.demoStudentId !== undefined) await saveJsonData(client, 'demoStudentId', partial.demoStudentId);
        if (partial.studentMessages !== undefined) await saveJsonData(client, 'studentMessages', partial.studentMessages);
        if (partial.peerMessages !== undefined) await saveJsonData(client, 'peerMessages', partial.peerMessages);
        // 139-ish: Homework Shop buyurtmalarining yetkazib berish bosqichi —
        // CRM'ning "Yetkazib berish" kanban'i shu yerdan o'qiydi/yozadi
        // (bookRoadmap'dagi kabi, lekin oddiyroq JSON-massiv sifatida).
        if (partial.shopOrders !== undefined) await saveJsonData(client, 'shopOrders', partial.shopOrders);
        if (partial.guides !== undefined)      await saveJsonData(client, 'guides', partial.guides);
        if (partial.individualSalesPlans !== undefined) await saveJsonData(client, 'individualSalesPlans', partial.individualSalesPlans);
        if (partial.targetMonitoringPlan !== undefined) await saveJsonData(client, 'targetMonitoringPlan', partial.targetMonitoringPlan);
        if (partial.targetDailyAdSpend !== undefined) await saveJsonData(client, 'targetDailyAdSpend', partial.targetDailyAdSpend);
        if (partial.archive !== undefined) await saveJsonData(client, 'archive', partial.archive);
    });
}

// Ustozning bitta o'quvchi/bitta jonli dars uchun davomatini saqlash.
// Bu umumiy state snapshotini o'chirib-qayta yozmaydi: faqat kerakli qatordan
// UPSERT qiladi va ustoz faqat o'ziga biriktirilgan o'quvchini baholay oladi.
async function recordTeacherAttendance({ actor, teacherId, studentId, date, present, grade }) {
    const safeTeacherId = String(teacherId || '').trim();
    const safeStudentId = String(studentId || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
    if (!safeTeacherId || !safeStudentId || !match) {
        throw new Error("Ustoz, o'quvchi va to'g'ri sana yuborilishi shart");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const asDate = new Date(`${date}T00:00:00Z`);
    if (month < 1 || month > 12 || day < 1 || day > 31 || Number.isNaN(asDate.getTime()) ||
        asDate.getUTCFullYear() !== year || asDate.getUTCMonth() + 1 !== month || asDate.getUTCDate() !== day) {
        throw new Error("Davomat sanasi noto'g'ri");
    }

    const isStaffWithFullAccess = ['admin', 'rop', 'boshliq'].includes(actor?.role);
    let savedGrade = null;
    let result = null;
    await tx(async (client) => {
        const teacherResult = await client.query(
            `SELECT t.id, t.name, t.type, t.subject
             FROM teachers t WHERE t.id = $1
             UNION ALL
             SELECT he.id, he.name,
                    CASE WHEN he.role = 'yordamchi' THEN 'yordamchi' ELSE 'asosiy' END AS type,
                    CASE WHEN he.role = 'rus-oqituvchi' THEN 'russian'
                         WHEN he.role = 'ingliz-oqituvchi' THEN 'english'
                         ELSE COALESCE(NULLIF(he.lang, ''), 'english')
                    END AS subject
             FROM hr_employees he
             WHERE he.id = $1
               AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.id = he.id)
             LIMIT 1`,
            [safeTeacherId]
        );
        const teacher = teacherResult.rows[0];
        if (!teacher) throw new Error('Ustoz yozuvi topilmadi');

        if (!isStaffWithFullAccess) {
            // Teacher akkaunti HR loginiga biriktirilgan bo'lishi kerak. Eski
            // yozuvlarda login bo'sh qolgan bo'lsa, faqat o'z ismiga mos
            // yozuvni fallback sifatida qabul qilamiz.
            const owner = await client.query(
                `SELECT 1
                 FROM users u
                 JOIN hr_employees he ON (
                     LOWER(TRIM(COALESCE(he.login, ''))) = LOWER(TRIM(u.email))
                     OR (COALESCE(TRIM(he.login), '') = '' AND LOWER(TRIM(he.name)) = LOWER(TRIM(u.name)))
                 )
                 WHERE u.id = $1 AND he.id = $2
                 LIMIT 1`,
                [actor.id, safeTeacherId]
            );
            if (!owner.rowCount) {
                throw new Error("Siz faqat o'zingizga biriktirilgan ustoz davomatini belgilashingiz mumkin");
            }
        }

        const assignmentColumn = teacher.type === 'yordamchi' ? 'assistant_teacher_id' : 'teacher_id';
        const studentResult = await client.query(
            `SELECT id, subject FROM students WHERE id = $1 AND ${assignmentColumn} = $2`,
            [safeStudentId, safeTeacherId]
        );
        const student = studentResult.rows[0];
        if (!student) {
            throw new Error("Bu o'quvchi ushbu ustozga biriktirilmagan");
        }
        if ((teacher.subject || 'english') !== (student.subject || 'english')) {
            throw new Error("O'quvchi va ustoz fan yo'nalishi mos emas");
        }

        const tableName = teacher.type === 'yordamchi' ? 'assistant_attendance' : 'main_attendance';
        const attendanceKey = `${match[1]}-${match[2]}_${safeTeacherId}`;

        if (present) {
            if (!grade || typeof grade !== 'object' || !grade.lessonId || !grade.scores) {
                throw new Error("Qatnashuv uchun jonli dars va barcha baholar talab qilinadi");
            }
            const criteria = ['attendance', 'activity', 'speaking', 'understanding', 'discipline'];
            for (const key of criteria) {
                const score = Number(grade.scores[key]);
                if (!Number.isInteger(score) || score < 1 || score > 5) {
                    throw new Error("Barcha baholar 1 dan 5 gacha bo'lishi shart");
                }
            }

            const contentResult = await client.query('SELECT data FROM mobile_content WHERE singleton = 1');
            const mobileContent = contentResult.rows[0]?.data || {};
            const course = (mobileContent.courses || []).find(c => c.id === (mobileContent.lessons || []).find(l => l.id === grade.lessonId)?.courseId);
            const courseLessons = course ? (mobileContent.lessons || []).filter(l => l.courseId === course.id) : [];
            const lessonIndex = courseLessons.findIndex(l => l.id === grade.lessonId);
            if (!course || lessonIndex < 0 || lessonIndex % 2 === 0 || (course.lang || 'english') !== (student.subject || 'english')) {
                throw new Error("Tanlangan jonli dars o'quvchi faniga tegishli emas");
            }

            await client.query(
                `INSERT INTO ${tableName} (att_key, student_id, day, present)
                 VALUES ($1, $2, $3, 1)
                 ON CONFLICT (att_key, student_id, day) DO UPDATE SET present = 1`,
                [attendanceKey, safeStudentId, day]
            );

            const gradesResult = await client.query("SELECT data FROM json_data WHERE key = 'liveGrades' FOR UPDATE");
            const allGrades = gradesResult.rows[0]?.data && typeof gradesResult.rows[0].data === 'object'
                ? gradesResult.rows[0].data
                : {};
            const entry = {
                date: String(date), teacherId: safeTeacherId,
                lessonId: String(grade.lessonId), lessonName: String(grade.lessonName || ''),
                scores: Object.fromEntries(criteria.map(key => [key, Number(grade.scores[key])]))
            };
            allGrades[safeStudentId] = (allGrades[safeStudentId] || []).filter(item => item.date !== date);
            allGrades[safeStudentId].push(entry);
            await saveJsonData(client, 'liveGrades', allGrades);
            savedGrade = entry;
        } else {
            await client.query(
                `DELETE FROM ${tableName} WHERE att_key = $1 AND student_id = $2 AND day = $3`,
                [attendanceKey, safeStudentId, day]
            );
            const gradesResult = await client.query("SELECT data FROM json_data WHERE key = 'liveGrades' FOR UPDATE");
            const allGrades = gradesResult.rows[0]?.data && typeof gradesResult.rows[0].data === 'object'
                ? gradesResult.rows[0].data
                : {};
            if (allGrades[safeStudentId]) {
                allGrades[safeStudentId] = allGrades[safeStudentId].filter(item => item.date !== date);
                await saveJsonData(client, 'liveGrades', allGrades);
            }
        }

        result = {
            attendanceKey, attendanceType: teacher.type === 'yordamchi' ? 'assistant' : 'main',
            studentId: safeStudentId, date: String(date), day, present: Boolean(present), grade: savedGrade
        };
    });
    return result;
}

// ── Leads insert (webhook) ───────────────────────────────────────────────────

function normalizeLeadLanguage(val) {
    if (!val) return 'english';
    const v = String(val).toLowerCase();
    if (v.includes('rus') || v === 'ru' || v === 'russian') return 'russian';
    return 'english';
}
function languageForSource(source, fallback) {
    const s = String(source || '').toLowerCase();
    if (s.includes('domwork')) return 'russian';
    if (s.includes('homework')) return 'english';
    return normalizeLeadLanguage(fallback);
}
function normalizeLeadSource(val) {
    const v = String(val || '').toLowerCase();
    if (v.includes('domwork')) return 'Domwork';
    if (v.includes('homework')) return 'Homework';
    if (!val) return 'Organik';
    return val;
}

async function insertLead({
    name, phone, phone2, email, language, source, externalId, date, status, leadType, contactTime, note, createdAt,
    // CAPI.uz (Meta Conversions API) atributsiyasi uchun — lid qaysi
    // reklamadan kelganini bildiradi. Bo'lmasa ham lid yaratilaveradi,
    // faqat keyinchalik CAPI orqali reklama optimizatsiyasi sifatliroq
    // ishlamaydi (faqat telefon/email bo'yicha moslashtirishga tushadi).
    utmSource, utmCampaign, utmContent, fbclid, fbLeadId, ctwaClid, igUsername,
}) {
    const src = normalizeLeadSource(source);
    const lang = languageForSource(src, language);
    const extId = externalId ? String(externalId) : null;
    const leadTypeNorm = String(leadType || '').toLowerCase() === 'target' ? 'target' : 'organic';
    const statusNorm = status || 'yangi-lidlar';

    if (extId) {
        const existing = await q1(
            'SELECT id, deleted_at FROM leads WHERE source = $1 AND external_id = $2',
            [src, extId]
        );
        if (existing) {
            if (existing.deleted_at) {
                await restoreLead(existing.id, { name: 'Meta tiklash' });
            }
            return { id: existing.id, duplicate: true, restored: Boolean(existing.deleted_at) };
        }
    }

    const id = randomUUID();
    const dateStr = date || new Date().toLocaleDateString('uz-UZ');

    // 3-ish: Bog'lanish uchun qulay vaqt — dastlabki izoh sifatida
    const initialComments = [];
    if (contactTime) {
        initialComments.push({
            id: randomUUID(),
            type: 'contact-time',
            text: `Bog'lanish uchun qulay vaqt: ${contactTime}`,
            author: 'Tizim',
            ts: Date.now(),
            date: dateStr
        });
    }
    // 48-vazifa: Telegram orqali kelgan lidlar uchun forma/manba haqida
    // qisqa izoh (masalan qaysi reklama formasi, Instagram/Facebook)
    // dastlabki izoh sifatida qo'shiladi — sotuv menejeri lidning qayerdan
    // kelganini darhol ko'radi.
    if (note) {
        initialComments.push({
            id: randomUUID(),
            type: 'note',
            text: note,
            author: 'Tizim',
            ts: Date.now(),
            date: dateStr
        });
    }

    const created = createdAt && !Number.isNaN(new Date(createdAt).getTime())
        ? new Date(createdAt)
        : new Date();

    // Faqat haqiqatan berilgan atributsiya maydonlari saqlanadi — bo'sh
    // qiymatlar bilan extra_data'ni "iflos" qilib qo'ymaslik uchun.
    const extra = {};
    if (utmSource) extra.utmSource = String(utmSource).slice(0, 255);
    if (utmCampaign) extra.utmCampaign = String(utmCampaign).slice(0, 255);
    if (utmContent) extra.utmContent = String(utmContent).slice(0, 255);
    if (fbclid) extra.fbclid = String(fbclid).slice(0, 500);
    if (fbLeadId) extra.fbLeadId = String(fbLeadId).slice(0, 255);
    if (ctwaClid) extra.ctwaClid = String(ctwaClid).slice(0, 500);
    if (igUsername) extra.igUsername = String(igUsername).slice(0, 255);

    const lead = {
        id, name, phone: phone || '', phone2: phone2 || '', email: email || '', source: src,
        language: lang, date: dateStr, externalId: extId,
        status: statusNorm, leadType: leadTypeNorm, comments: initialComments,
        attachments: [], createdAt: created, ...extra
    };
    await tx(async client => {
        await client.query(
            `INSERT INTO leads
                (id, name, phone, phone2, email, source, language, date, external_id,
                 status, lead_type, comments, attachments, created_at, updated_at, extra_data)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),$15)`,
            [id, name, phone || '', phone2 || '', email || '', src, lang, dateStr, extId,
             statusNorm, leadTypeNorm, JSON.stringify(initialComments), '[]', created,
             JSON.stringify(extra)]
        );
        await appendLeadAudit(client, id, 'created', { name: 'Tizim' }, lead);
    });
    return { id, duplicate: false, lead };
}

// ── Users ────────────────────────────────────────────────────────────────────

async function findUserByEmail(email) {
    const login = String(email || '').trim();
    const inputDigits = /^[+\d\s().-]+$/.test(login) ? login.replace(/\D/g, '') : '';
    const phoneDigits = inputDigits.length >= 9 ? inputDigits.slice(-9) : '';
    const whereClause = phoneDigits
        ? `u.email ~ '^[+0-9 ().-]+$'
           AND RIGHT(REGEXP_REPLACE(u.email, '[^0-9]', '', 'g'), 9) = $1`
        : `LOWER(TRIM(u.email)) = LOWER($1)`;
    const matches = await q(
        `SELECT u.*, link.manager_id AS sales_manager_id
         FROM users u
         LEFT JOIN user_sales_manager_links link ON link.user_id = u.id
         WHERE ${whereClause}
         ORDER BY u.created_at, u.id`,
        [phoneDigits || login]
    );
    if (matches.length > 1) {
        const error = new Error('Bu login bir nechta akkauntga bog\'langan. Admin dublikatlarni tekshirishi kerak.');
        error.code = 'AMBIGUOUS_LOGIN';
        throw error;
    }
    return matches[0] || null;
}

async function findUserById(id) {
    return q1(
        `SELECT u.*, link.manager_id AS sales_manager_id
         FROM users u
         LEFT JOIN user_sales_manager_links link ON link.user_id = u.id
         WHERE u.id = $1`,
        [id]
    );
}

// Xodimlar o'rtasidagi muloqotda ism va avatar aynan login akkauntidan
// olinishi uchun faqat kerakli rollarning xavfsiz katalogi.
async function listUsersByRoles(roles = []) {
    const allowed = Array.isArray(roles) ? roles.filter(Boolean) : [];
    if (!allowed.length) return [];
    return q('SELECT id, name, email, role, phone, bio, location, avatar, created_at FROM users WHERE role = ANY($1::text[]) ORDER BY name', [allowed]);
}

async function createUser({ name, email, passwordHash, role }) {
    const id = randomUUID();
    await pool.query(
        'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
        [id, name, email, passwordHash, role || 'admin']
    );
    return findUserById(id);
}

// Yangi xodim va uning kirish hisobini bitta tranzaksiyada yaratadi.
// Shunda users yozuvi yaralib, hr_employees yozuvi saqlanmay qolishi (yoki
// aksincha) mumkin emas.
async function createHrUserAccount({ employee, login, passwordHash, userRole, salesManagerId }) {
    const accountId = randomUUID();
    await tx(async client => {
        await client.query(
            'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
            [accountId, employee.name, login, passwordHash, userRole]
        );

        if (userRole === 'sales_manager' && String(salesManagerId || '').trim()) {
            await client.query(
                `INSERT INTO user_sales_manager_links (user_id, manager_id)
                 VALUES ($1, $2)`,
                [accountId, String(salesManagerId).trim()]
            );
        }

        await client.query(
            `INSERT INTO hr_employees
                (id, name, first_name, last_name, role, login, phone, email,
                 department, status, join_date, gender, birth_date, start_date,
                 card_number, passport_series, pinfl, address, lang, trial_group_link)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
            [employee.id, employee.name, employee.firstName || '', employee.lastName || '',
             employee.role || 'employee', login, employee.phone || '', employee.email || '',
             employee.department || '', employee.status || 'active', employee.joinDate || '',
             employee.gender || '', employee.birthDate || '', employee.startDate || '',
             employee.cardNumber || '', employee.passportSeries || '', employee.pinfl || '',
             employee.address || '', employee.lang || 'english', employee.trialGroupLink || '']
        );
    });
    return findUserById(accountId);
}

async function updateUser(id, fields) {
    const allowed = ['name', 'email', 'phone', 'bio', 'location', 'avatar', 'role'];
    const sets = [];
    const vals = [];
    let idx = 1;
    for (const key of allowed) {
        if (fields[key] !== undefined) {
            sets.push(`${key} = $${idx++}`);
            vals.push(fields[key]);
        }
    }
    if (fields.passwordHash !== undefined) {
        sets.push(`password_hash = $${idx++}`);
        vals.push(fields.passwordHash);
    }
    if (!sets.length) return findUserById(id);
    vals.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    return findUserById(id);
}

// Mavjud HR xodimining login/parolini bitta tranzaksiyada yangilaydi.
// Users yangilanib, HR login eski holatda qolib ketishi mumkin emas.
async function resetHrUserAccount({ userId, employeeId, name, login, passwordHash, role, salesManagerId }) {
    const accountId = userId || randomUUID();
    await tx(async client => {
        const employeeResult = await client.query(
            'SELECT id FROM hr_employees WHERE id = $1 FOR UPDATE',
            [employeeId]
        );
        if (employeeResult.rowCount !== 1) {
            const error = new Error('Xodim yozuvi topilmadi');
            error.code = 'HR_EMPLOYEE_NOT_FOUND';
            throw error;
        }

        if (userId) {
            const userResult = await client.query(
                `UPDATE users
                 SET name = $2, email = $3, password_hash = $4, role = $5
                 WHERE id = $1`,
                [accountId, name, login, passwordHash, role]
            );
            if (userResult.rowCount !== 1) throw new Error('Kirish hisobi topilmadi');
        } else {
            await client.query(
                'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
                [accountId, name, login, passwordHash, role]
            );
        }

        if (role === 'sales_manager' && String(salesManagerId || '').trim()) {
            await client.query(
                `INSERT INTO user_sales_manager_links (user_id, manager_id)
                 VALUES ($1, $2)
                 ON CONFLICT (user_id) DO UPDATE SET manager_id = EXCLUDED.manager_id`,
                [accountId, String(salesManagerId).trim()]
            );
        } else {
            await client.query('DELETE FROM user_sales_manager_links WHERE user_id = $1', [accountId]);
        }

        const hrResult = await client.query(
            'UPDATE hr_employees SET login = $2 WHERE id = $1',
            [employeeId, login]
        );
        if (hrResult.rowCount !== 1) throw new Error('Xodim logini yangilanmadi');
    });
    return findUserById(accountId);
}

function publicUser(user) {
    return {
        id: user.id, name: user.name, email: user.email, role: user.role,
        phone: user.phone || '', bio: user.bio || '',
        location: user.location || '', avatar: user.avatar || '',
        createdAt: user.created_at || '',
        linkedManagerId: user.sales_manager_id || ''
    };
}

// ── Sessions ─────────────────────────────────────────────────────────────────

async function createSession({ userId, jti, userAgent, ip }) {
    await pool.query(
        'INSERT INTO sessions (id, user_id, jti, user_agent, ip) VALUES ($1,$2,$3,$4,$5)',
        [randomUUID(), userId, jti, userAgent || '', ip || '']
    );
}

async function findSessionByJti(jti) {
    if (!jti) return null;
    return q1('SELECT * FROM sessions WHERE jti = $1', [jti]);
}

async function getSessionById(id) {
    return q1('SELECT * FROM sessions WHERE id = $1', [id]);
}

async function getSessionsByUserId(userId) {
    return q('SELECT * FROM sessions WHERE user_id = $1 ORDER BY last_seen DESC', [userId]);
}

async function touchSession(jti) {
    await pool.query('UPDATE sessions SET last_seen = NOW() WHERE jti = $1', [jti]);
}

async function deleteSession(id) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
}

async function deleteSessionByJti(jti) {
    await pool.query('DELETE FROM sessions WHERE jti = $1', [jti]);
}

async function deleteOtherSessions(userId, currentJti) {
    await pool.query('DELETE FROM sessions WHERE user_id = $1 AND jti != $2', [userId, currentJti]);
}

async function cleanExpiredSessions() {
    await pool.query("DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '7 days'");
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
    try {
        await pool.query('SELECT 1');
        console.log('[DB] PostgreSQL ulanish muvaffaqiyatli');
    } catch (err) {
        console.error('[DB] PostgreSQL ulanmadi:', err.message);
        process.exit(1);
    }
    await initSchema();
    await seedIfEmpty();
    await migrateMultipleChoiceCorrectIndex().catch(err => console.error('[DB] correctIndex tuzatishda xatolik:', err.message));
    await migrateMultipleChoiceManualFixes().catch(err => console.error('[DB] correctIndex qo\'lda tuzatishda xatolik:', err.message));
    await migrateRenameGarbledCourse().catch(err => console.error('[DB] Kurs nomini tuzatishda xatolik:', err.message));
}

// ── "Hisoblangan" (computed/auto) eslatmalarni push orqali yetkazish ────────
// 142-ish qayta ish 8: jonli dars sanog'i, videodars nazorat nuqtalari,
// uyga vazifa, to'lov qarzi va h.k. — bular tizim voqealaridan farqli, hech
// qayerda saqlanmaydi, har so'rovda "hozir to'g'rimi" deb qayta hisoblanadi.
// Shu sabab ularni push qilish uchun vaqti-vaqti bilan o'zimiz tekshirib,
// avval yuborilmagan (id bo'yicha) yangilarini push qilamiz. Xotiradagi Set
// server qayta ishga tushganda tozalanadi — bu qabul qilinadi (eng yomon
// holatda qayta ishga tushgandan keyingi birinchi tsiklda bir nechta eslatma
// qayta yuborilishi mumkin, lekin cheksiz takrorlanmaydi).
let _pushedComputedIds = new Set();
async function _checkAndPushComputedNotifications() {
    try {
        const subs = await getPushSubscriptions();
        if (!subs.length) return; // hech kim obuna bo'lmagan bo'lsa, hisoblashning hojati yo'q
        const notifications = await getComputedDemoNotifications();
        for (const n of notifications) {
            if (n.source !== 'auto' || _pushedComputedIds.has(n.id)) continue;
            _pushedComputedIds.add(n.id);
            await sendPushToAll(n.title, n.message);
        }
        if (_pushedComputedIds.size > 500) {
            _pushedComputedIds = new Set(Array.from(_pushedComputedIds).slice(-200));
        }
    } catch (err) {
        console.error('[push] hisoblangan eslatmalarni tekshirishda xatolik:', err.message);
    }
}
const PUSH_CHECK_INTERVAL_MS = 60 * 1000;
setInterval(_checkAndPushComputedNotifications, PUSH_CHECK_INTERVAL_MS);

// ── 26-vazifa: sinov darsi vaqtiga qarab avtomatik SMS eslatmalari ──────────
// Faqat vaqtga bog'liq (1 soat/30 daqiqa/10 daqiqa/boshlandi) qismi shu
// yerda — bosqichga o'tilgan zahoti yuboriladigan SMS'lar (bog'lanishga
// urinilmoqda, ma'lumot berildi va h.k.) CRM tomonida (js/app.js,
// updateLeadInStorage) yuboriladi, chunki ular ADMIN harakatiga bog'liq va
// o'sha vaqtdagi to'liq lid ma'lumoti (onboarding/paymentSurvey) faqat
// brauzerda darhol mavjud. Vaqt bo'yicha eslatmalar esa hech kim CRM'ni
// ochib o'tirmasa ham aniq daqiqada yuborilishi kerak — shu sabab bu
// server tomonidagi mustaqil vazifa.
const TRIAL_SMS_REMINDER_RULES = [
    { id: '1h', minutes: 60 },
    { id: '30m', minutes: 30 },
    { id: '10m', minutes: 10 },
    { id: 'start', minutes: 0 },
];
const TRIAL_SMS_TOLERANCE_MIN = 2; // tekshiruv har 60s da ishga tushadi — zaxira

async function getActiveTrialLeads() {
    const rows = await q(
        `SELECT * FROM leads WHERE status = 'sinov-darsida' AND deleted_at IS NULL`
    );
    return rows.map(r => ({ ...rowToLead(r), language: r.language }));
}

async function getTeacherTrialLinksMap() {
    const rows = await q(
        `SELECT id, trial_group_link FROM hr_employees WHERE COALESCE(trial_group_link,'') <> ''`
    );
    return new Map(rows.map(r => [r.id, r.trial_group_link]));
}

function buildTrialReminderSmsText(ruleId, lead, link) {
    const ism = lead.name || 'Hurmatli mijoz';
    switch (ruleId) {
        case '1h':
            return `Eslatib o'tamiz sizga bitta bepul rus tili darsi belgilangan, dars bu yerda bo'ladi: ${link}`;
        case '30m':
            return `Atigi 30 daqiqa qoldi, va siz "90 kunda rus tilida gapiring" nomli kursimizdan tatib ko'rasiz. ${link}`;
        case '10m':
            return `Biz sizni sabrsizlik bilan kutmoqdamiz, yana 10 daqiqa va siz haqiqiy dastur guvohi bo'lasiz: ${link}`;
        case 'start':
            return `${ism}! Dars boshlandi, sizni bo'lajak ustozingiz kutmoqda, darsga bu yerdan kiring: ${link}`;
        default:
            return '';
    }
}

async function _checkAndSendTrialSmsReminders() {
    try {
        const leads = await getActiveTrialLeads();
        if (!leads.length) return;

        const teacherLinks = await getTeacherTrialLinksMap();
        const dedupe = await getJsonData('trialSmsReminders');
        const historyEntries = [];
        let changed = false;

        for (const lead of leads) {
            // Shablonlar aynan Domwork (rus tili) brendi uchun yozilgan.
            if (lead.language !== 'russian') continue;
            if (!lead.phone || !lead.trialLessonAt) continue;

            const trialAtMs = new Date(lead.trialLessonAt).getTime();
            if (Number.isNaN(trialAtMs)) continue;
            const minutesUntil = (trialAtMs - Date.now()) / 60000;

            const prev = dedupe[lead.id];
            const entry = (prev && prev.trialLessonAt === lead.trialLessonAt)
                ? prev
                : { trialLessonAt: lead.trialLessonAt, sent: [] }; // reja o'zgargan bo'lsa qaytadan boshlanadi

            const link = teacherLinks.get(lead.paymentOnboarding?.teacherId || '') || '';

            for (const rule of TRIAL_SMS_REMINDER_RULES) {
                if (entry.sent.includes(rule.id)) continue;
                const low = rule.minutes === 0 ? -TRIAL_SMS_TOLERANCE_MIN : rule.minutes - TRIAL_SMS_TOLERANCE_MIN;
                const high = rule.minutes === 0 ? TRIAL_SMS_TOLERANCE_MIN : rule.minutes + TRIAL_SMS_TOLERANCE_MIN;
                if (minutesUntil < low || minutesUntil > high) continue;

                if (!link) {
                    console.warn(`[trial-sms] ustoz guruh havolasi topilmadi — leadId=${lead.id} teacherId=${lead.paymentOnboarding?.teacherId || '(yoq)'}`);
                    entry.sent.push(rule.id);
                    changed = true;
                    continue;
                }

                const text = buildTrialReminderSmsText(rule.id, lead, link);
                try {
                    const resp = await eskiz.sendSms(lead.phone, text);
                    historyEntries.push({
                        phone: lead.phone, name: lead.name, status: 'sent',
                        eskizId: resp?.id || null, message: text,
                        recipientId: lead.id, recipientType: 'lead',
                        audience: 'auto-sinov-' + rule.id, sentBy: 'system',
                    });
                } catch (err) {
                    console.warn(`[trial-sms] yuborilmadi — leadId=${lead.id} rule=${rule.id}:`, err.message);
                    historyEntries.push({
                        phone: lead.phone, name: lead.name, status: 'error',
                        error: err.message, message: text,
                        recipientId: lead.id, recipientType: 'lead',
                        audience: 'auto-sinov-' + rule.id, sentBy: 'system',
                    });
                }
                entry.sent.push(rule.id);
                changed = true;
            }
            dedupe[lead.id] = entry;
        }

        // Endi sinov-darsida bo'lmagan lidlarning dedupe yozuvlarini tozalash
        const activeIds = new Set(leads.map(l => l.id));
        for (const id of Object.keys(dedupe)) {
            if (!activeIds.has(id)) { delete dedupe[id]; changed = true; }
        }

        if (changed) await tx(async client => { await saveJsonData(client, 'trialSmsReminders', dedupe); });
        if (historyEntries.length) await addSmsHistoryEntries(historyEntries);
    } catch (err) {
        console.error('[trial-sms] eslatmalarni tekshirishda xatolik:', err.message);
    }
}
const TRIAL_SMS_CHECK_INTERVAL_MS = 60 * 1000;
setInterval(_checkAndSendTrialSmsReminders, TRIAL_SMS_CHECK_INTERVAL_MS);

module.exports = {
    pool, DATA_DIR,
    getFullState, getLeads, getDeletedLeads, getLeadById, getSalesManagerIdForUser, setSalesManagerUserLink,
    insertLead, upsertLead, softDeleteLead, restoreLead, patchState, recordTeacherAttendance,
    findUserByEmail, findUserById, listUsersByRoles, createUser, createHrUserAccount, updateUser, resetHrUserAccount, publicUser,
    getHrEmployeesData, getHrEmployeeById, setHrEmployeeLogin, getMobileContentData, findStudentByLogin, getStudentPublicId, getDemoStudentGrades, submitDemoStudentTeacherRating,
    getDemoStudentSchedule, getDemoStudentProfile, setDemoStudentAvatarUrl, getDemoStudentPayments,
    getDemoStudentAssistantRatings, submitDemoStudentAssistantRating,
    getDemoStudentMessages, sendDemoStudentMessage,
    getDemoStudentPeerMessages, sendDemoStudentPeerMessage,
    getDemoStudentPersonaMessages, sendDemoStudentPersonaMessage,
    getNotificationRules, saveNotificationRules,
    getManualNotifications, addManualNotification, deleteManualNotification,
    addSystemNotification, submitAbsenceReason,
    getPushSubscriptions, addPushSubscription, removePushSubscription, sendPushToAll, VAPID_PUBLIC_KEY,
    getHomeworkRadioSchedule, saveHomeworkRadioDay,
    getContentComments, addContentComment, addAdminContentReply, deleteContentComment,
    getCallRecordings, getCallRecordingCounts, addCallRecording, deleteCallRecording, handleBeelineWebhook,
    getSmsHistory, addSmsHistoryEntries,
    getComputedDemoNotifications,
    getDemoStudentBookDelivery,
    getNextContractNumber, getOrCreateStudentContract, getStudentContractPdf,
    addDemoShopOrder, getDemoShopOrders,
    getDemoStudentActivity, addDemoStudentActivity,
    syncStudentProgress, getRealLeaderboard,
    getDemoCreativeSubmissions, submitDemoCreativeSubmission, gradeDemoCreativeSubmission,
    getCommunityPosts, addCommunityPost, toggleCommunityPostLike,
    addCommunityComment, toggleCommunityCommentLike,
    deleteCommunityPost, deleteCommunityComment,
    createSession, findSessionByJti, getSessionById, getSessionsByUserId,
    touchSession, deleteSession, deleteSessionByJti, deleteOtherSessions,
    init
};
