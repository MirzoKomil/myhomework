#!/usr/bin/env node
// Yo'qolgan lidlarni qayta tiklash skripti.
//
// Nima uchun kerak: `saveLeads` avval har bir saqlashda butun `leads`
// jadvalini o'chirib, klient yuborgan ro'yxatni qayta yozardi. Klientdagi
// kesh buzilgan bo'lsa (masalan tarmoq uzilishi sabab), bitta oddiy saqlash
// barcha lidlarni o'chirib yuborardi. Bu skript o'chib ketgan lidlarni
// ULARGA BOG'LIQ, omon qolgan yozuvlardan qayta quradi:
//   • students.lead_ref   — to'lovga yetgan lidlar (ism/telefon/til/menejer)
//   • book_roadmap.lead_ref — kitob yetkazish bosqichidagi lidlar
//   • json_data.archive   — CRM'dan qo'lda o'chirilgan lidlar (to'liq nusxa)
//
// Ishlatish:
//   node server/recover-leads.js          # faqat ko'rsatadi, YOZMAYDI
//   node server/recover-leads.js --apply  # haqiqatan tiklaydi
//
// MUHIM: skript faqat YETISHMAYOTGAN lidlarni qo'shadi. Mavjud lidlarga
// hech qachon tegmaydi va hech narsani o'chirmaydi.

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL topilmadi.');
    process.exit(1);
}

const APPLY = process.argv.includes('--apply');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

function parseMaybeJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return null; }
}

function normalizeLang(lang) {
    return lang === 'russian' ? 'russian' : 'english';
}

async function main() {
    const existing = await pool.query('SELECT id FROM leads');
    const existingIds = new Set(existing.rows.map(r => r.id));
    console.log(`Hozir bazada ${existingIds.size} ta lid bor.`);

    // id -> tiklanadigan lid. Sifati yuqoriroq manba keyingisini yozib ketadi.
    const candidates = new Map();

    // ── 1) Arxiv (eng to'liq manba — lidning to'liq nusxasi saqlangan) ──────
    const archiveRow = await pool.query(
        `SELECT data FROM json_data WHERE key = 'archive'`
    );
    const archive = parseMaybeJson(archiveRow.rows[0]?.data) || [];
    let fromArchive = 0;
    for (const rec of Array.isArray(archive) ? archive : []) {
        if (rec?.type !== 'lead' || !rec.item?.id) continue;
        if (existingIds.has(rec.item.id)) continue;
        candidates.set(rec.item.id, {
            lead: rec.item,
            lang: normalizeLang(rec.meta?.lang),
            source: 'arxiv',
            createdAt: rec.item.createdAt || rec.deletedAt || null
        });
        fromArchive++;
    }

    // ── 2) book_roadmap (ism/telefon/viloyat/menejer saqlangan) ─────────────
    const roadmap = await pool.query('SELECT * FROM book_roadmap');
    let fromRoadmap = 0;
    for (const r of roadmap.rows) {
        const ref = parseMaybeJson(r.lead_ref);
        if (!ref?.id || existingIds.has(ref.id) || candidates.has(ref.id)) continue;
        candidates.set(ref.id, {
            lead: {
                id: ref.id,
                name: r.name || 'Nomsiz lid',
                phone: r.phone || '',
                managerId: r.manager_id || '',
                status: 'tolov-yopildi',
                region: r.region || '',
                comments: parseMaybeJson(r.comments) || []
            },
            lang: normalizeLang(ref.lang || r.lang),
            source: 'kitob-yetkazish',
            createdAt: r.created_at || null
        });
        fromRoadmap++;
    }

    // ── 3) students (to'lovga yetgan lidlar) ────────────────────────────────
    const students = await pool.query('SELECT * FROM students');
    let fromStudents = 0;
    for (const s of students.rows) {
        const ref = parseMaybeJson(s.lead_ref);
        if (!ref?.id || existingIds.has(ref.id) || candidates.has(ref.id)) continue;
        candidates.set(ref.id, {
            lead: {
                id: ref.id,
                name: s.name || 'Nomsiz lid',
                phone: s.phone || '',
                managerId: s.manager_id || '',
                status: 'tolov-yopildi',
                serialCode: s.serial_code || undefined,
                comments: []
            },
            lang: normalizeLang(ref.lang || s.subject),
            source: "o'quvchilar",
            createdAt: s.created_at || null
        });
        fromStudents++;
    }

    console.log(
        `\nTiklash mumkin: ${candidates.size} ta lid ` +
        `(arxiv: ${fromArchive}, kitob-yetkazish: ${fromRoadmap}, o'quvchilar: ${fromStudents})`
    );

    if (!candidates.size) {
        console.log("\nTiklanadigan lid topilmadi. Agar lidlar hali ham yetishmasa, " +
                    "Railway'dagi PostgreSQL backup'idan tiklash yagona yo'l.");
        await pool.end();
        return;
    }

    console.log('\nRo\'yxat:');
    for (const [id, c] of candidates) {
        console.log(`  ${id}  ${c.lead.name}  (${c.lang}, manba: ${c.source})`);
    }

    if (!APPLY) {
        console.log('\n--- QURUQ ISHGA TUSHIRISH (hech narsa yozilmadi) ---');
        console.log('Haqiqatan tiklash uchun: node server/recover-leads.js --apply');
        await pool.end();
        return;
    }

    const client = await pool.connect();
    let inserted = 0;
    try {
        await client.query('BEGIN');
        for (const [id, c] of candidates) {
            const l = c.lead;
            const { id: _i, name: _n, phone: _p, phone2: _p2, email: _e,
                    managerId: _m, source: _s, date: _d, externalId: _x,
                    status: _st, leadType: _lt, comments: _c,
                    managerPhoto: _mp, attachments: _a, createdAt: _ca,
                    ...extra } = l;
            await client.query(
                `INSERT INTO leads (id, name, phone, phone2, email, manager_id, source, language,
                                    date, external_id, status, lead_type, comments, attachments,
                                    extra_data, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                 ON CONFLICT (id) DO NOTHING`,
                [id, l.name || '', l.phone || '', l.phone2 || '', l.email || '',
                 l.managerId || '', l.source || 'Organik', c.lang, l.date || '',
                 l.externalId || null, l.status || 'yangi-lidlar',
                 l.leadType === 'target' ? 'target' : 'organic',
                 JSON.stringify(l.comments || []), JSON.stringify([]),
                 JSON.stringify(extra),
                 c.createdAt ? new Date(c.createdAt) : new Date()]
            );
            inserted++;
        }
        await client.query('COMMIT');
        console.log(`\n✓ ${inserted} ta lid tiklandi.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\nXatolik — hech narsa o\'zgartirilmadi:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
