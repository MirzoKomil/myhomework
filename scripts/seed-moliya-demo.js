#!/usr/bin/env node
// Moliya D dizayni uchun namuna ma'lumot (FAQAT sinov bazasi!): dizayndagi raqamlarga mos tushum, qarz, xarajat va investor.
//   DATABASE_URL=postgres://...@127.0.0.1/crm_demo DATABASE_SSL=false DATA_DIR=/tmp/demo node scripts/seed-moliya-demo.js
// Natija (Rus tili, 1–15 noyabr): Jami tushum 17 513 000 = Yangi sotuvlar 15 763 000 (20 ta) + Qarzdorlardan 1 750 000 (4 ta);
// Xarajatlar 2 150 000 (ijara 1 500 000, reklama 650 000); Jami ochiq qarz 92 054 700, muddati o'tgan 51 018 000,
// davr sotuvlaridan 22 687 000 (muddati o'tgan — bugun 2026-11-15 holatiga); oktabr yopilgan (investor ulushi 1 170 000);
// investor kabineti: investor-demo / demo1234; investor "Davron Aliyev" 30%, 2026-09 dan 18 oy.
// Oyliklar: sotuv va ustozlar maoshi Maoshlar hisob-kitobidan (davomat, sotuv) — bu yerda faqat "Boshqalar" (HR) va
// akademik rahbar uchun hisoblangan maosh yoziladi; qolgan guruhlar haqiqiy hisobga bog'liq.
'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const finCtx = require('../server/services/finCtx');
const finance = require('../server/services/finance');
const payroll = require('../server/services/payroll');
const investor = require('../server/services/investor');

const url = process.env.DATABASE_URL || '';
if (!/127\.0\.0\.1|localhost/.test(url)) { console.error('Faqat mahalliy sinov bazasi (127.0.0.1/localhost) uchun'); process.exit(1); }
const pool = new Pool({ connectionString: url, ssl: process.env.DATABASE_SSL === 'false' ? false : undefined });
const today = new Date().toISOString().slice(0, 10);

// CRM nomidan (imzolangan kontekst) — o'quvchi holati jurnali "ilovadan tashqari" deb belgilanmaydi.
async function crm(fn) {
    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        await db.query("SELECT set_config('fin.ctx', $1, true)", [finCtx.token('crm')]);
        await fn(db);
        const xid = (await db.query('SELECT pg_current_xact_id()::text AS x')).rows[0].x;
        await db.query('COMMIT');
        await finCtx.signXid(pool, xid);
    } catch (e) { await db.query('ROLLBACK').catch(() => {}); throw e; } finally { db.release(); }
}
const NEW = [ // 20 ta yangi sotuv (1–15 noyabr): [ism, to'lov, qolgan qarz]
    ['Rustamova Nozima', 500000, 1000000], ['Saida Sodiqova', 1127000, 500000], ['Akramov Ibrohim', 900000, 0], ['Karimova Dilnoza', 800000, 1200000],
    ['Toshmatov Bekzod', 750000, 1250000], ['Nazarova Malika', 1000000, 1000000], ['Yusupov Sardor', 600000, 1400000], ['Ergasheva Zarina', 900000, 1100000],
    ['Rahimov Jasur', 700000, 1300000], ['Olimova Shahnoza', 850000, 1150000], ['Qodirov Aziz', 500000, 1500000], ['Saidova Kamola', 1000000, 1000000],
    ['Mirzayev Otabek', 650000, 1350000], ['Xolmatova Feruza', 800000, 1200000], ['Abdullayev Umid', 760000, 1240000], ['Sobirova Gulnoza', 900000, 1100000],
    ['Hasanov Doniyor', 576000, 1424000], ['Ismoilova Madina', 750000, 1250000], ['Tursunov Behruz', 700000, 1352000], ['Jurayeva Muhabbat', 1000000, 1371000]
];
const DEBTORS = [ // oktabrda sotilgan, noyabrda qarzni to'lagan 4 ta: [ism, okt to'lov, noy to'lov, qolgan qarz, muddat]
    ['Valiyeva Sevara', 1000000, 500000, 9000000, '2026-10-20'], ['Ortiqov Shoxrux', 900000, 350000, 10500000, '2026-10-25'],
    ['Rasulova Nigora', 1200000, 400000, 8000000, '2026-11-10'], ['Komilov Farrux', 800000, 500000, 7000000, '2026-12-01']
];
const OLD = [ // to'lov qilmagan eski qarzdorlar: [ism, qarz, muddat]
    ['Hamidova Lola', 11518000, '2026-09-30'], ['Yoqubov Anvar', 12000000, '2026-10-15'], ['Murodova Ziyoda', 6500000, '2026-12-01'],
    ['Sultonov Ravshan', 3000000, '2026-11-20'], ['Ahmedova Dildora', 1662700, '2026-12-05'], ['Bakirov Islom', 187000, '2026-12-10']
];

(async () => {
    await finance.initSchema(pool); await finance.initProblemLog(pool); await investor.initSchema(pool);
    const admin = (await pool.query("SELECT id FROM users WHERE role='admin' ORDER BY email='admin' DESC LIMIT 1")).rows[0];
    if (!admin) throw new Error('Admin foydalanuvchi yo‘q (node server/reset-admin.js)');
    const actor = { id: admin.id };
    const ev = async n => (await finance.storeEvidence(pool, actor, { originalname: n + '.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% demo ' + n + '\n%%EOF') })).url;
    const key = () => 'demo-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
    const st = (i, name, debt, due) => ({ id: 'demo-s' + i, name, phone: '+99890' + String(1000000 + i).slice(-7), extra: { debtAmount: debt, paymentDueDate: due, paymentLedgerManaged: true, status: 'active', managerName: i % 2 ? 'Kamola Shahobiddinova' : 'Bexruz Zuhriddinov' } });
    const all = [...NEW.map((x, i) => st(i, x[0], x[2], '2026-12-15')), ...DEBTORS.map((x, i) => st(100 + i, x[0], x[3], x[4])), ...OLD.map((x, i) => st(200 + i, x[0], x[1], x[2]))];
    await crm(async db => {
        for (const s of all) await db.query(`INSERT INTO students(id,name,phone,subject,extra_data) VALUES($1,$2,$3,'russian',$4) ON CONFLICT(id) DO NOTHING`, [s.id, s.name, s.phone, JSON.stringify(s.extra)]);
    });
    const receipt = async (sid, date, amount) => finance.manualReceipt(pool, actor, { requestKey: key(), entity: 'russian', reason: 'Namuna ma’lumot (demo)', evidenceUrl: await ev(sid + date), date, amount, method: 'card', studentId: sid });
    await finance.createTransaction(pool, actor, { requestKey: key(), entity: 'common', type: 'capital', categoryCode: 'OWNER_IN', accountId: 'acc-bank', amount: 30000000, date: '2026-10-01', counterparty: 'Ta’sischi' });
    for (const [i, d] of DEBTORS.entries()) await receipt('demo-s' + (100 + i), '2026-10-0' + (i + 2), d[1]);
    for (const [i, d] of NEW.entries()) await receipt('demo-s' + i, '2026-11-' + String(1 + (i % 14)).padStart(2, '0'), d[1]);
    for (const [i, d] of DEBTORS.entries()) await receipt('demo-s' + (100 + i), '2026-11-' + String(3 + i * 3).padStart(2, '0'), d[2]);
    // Tushum kiritilganda CRM qarzi kamayadi — dizayndagi qoldiq qarzlar oxirida qayta o'rnatiladi.
    await crm(async db => { for (const s of all) await db.query(`UPDATE students SET extra_data=extra_data || $2::jsonb WHERE id=$1`, [s.id, JSON.stringify({ debtAmount: s.extra.debtAmount, paymentDueDate: s.extra.paymentDueDate })]); });
    await finance.createTransaction(pool, actor, { requestKey: key(), entity: 'common', type: 'expense', categoryCode: 'RENT', accountId: 'acc-bank', amount: 1500000, date: '2026-11-05', counterparty: 'Ofis ijarasi', receiptUrl: await ev('rent') });
    await finance.createTransaction(pool, actor, { requestKey: key(), entity: 'russian', type: 'expense', categoryCode: 'MKT_ADS', accountId: 'acc-card', amount: 650000, date: '2026-11-09', counterparty: 'Meta Ads' });
    // Hisoblangan maosh (Maoshlar hisob-kitobiga kirmaydigan rollar): HR (Boshqalar) va akademik rahbar (Akademik).
    await pool.query(`INSERT INTO hr_employees(id,name,role,status) VALUES('demo-hr','HR xodimi','hr','active'),('demo-ak','Akademik rahbar','head-of-teachers','active') ON CONFLICT(id) DO NOTHING`);
    await payroll.transaction(pool, async db => {
        for (const [id, emp, amount, calc] of [['demo-sal-hr', 'demo-hr', 600000, { fixed: 600000 }], ['demo-sal-ak', 'demo-ak', 1200000, { fixed: 1000000, bonus: 200000 }]])
            await db.query(`INSERT INTO salary_transactions(id,employee_id,language,period_start,period_end,amount,calculation,source_hash) VALUES($1,$2,'russian','2026-11-01','2026-11-15',$3,$4,'demo') ON CONFLICT DO NOTHING`, [id, emp, amount, JSON.stringify(calc)]);
    });
    await pool.query(`UPDATE investors SET name='Davron Aliyev', share_pct=30, start_month='2026-09', term_months=18, basis='before_tax', entity='russian', revision=revision+1 WHERE id='main' AND name=''`);
    // Oktabr yopiladi (investor natijasi shu paytda muzlatiladi) — "To'landi deb belgilash" sinab ko'rilsin.
    await finance.lockMonth(pool, actor, { month: '2026-10', override: true, note: 'Namuna ma’lumot: oktabr oyi yopildi (demo)' });
    // Investor kabineti uchun kirish: login investor-demo, parol demo1234.
    await investor.saveAccount(pool, actor, { name: 'Davron Aliyev', login: 'investor-demo', password: 'demo1234' });
    // "Jadval bilan farq" namunasi: Google Sheet eksporti (24 ta CRM to'lovi + CRM'da yo'q 2 ta: 250 000 + 127 000 = 377 000).
    // Batafsil › Solishtirish'da faylni yuklang yoki matnini joylashtiring → Muammolar › Jadval bilan farq.
    const lines = [...NEW.map((x, i) => [`2026-11-${String(1 + (i % 14)).padStart(2, '0')}`, x[0], 'demo-s' + i, x[1]]),
        ...DEBTORS.map((x, i) => [`2026-11-${String(3 + i * 3).padStart(2, '0')}`, x[0], 'demo-s' + (100 + i), x[2]])]
        .map(([d, n, sid, a]) => `${d.split('-').reverse().join('.')}\t${n}\t${all.find(s => s.id === sid).phone}\t${a}`);
    lines.push('13.11.2026\tO‘quvchi A\t+998931112233\t250000', '14.11.2026\tO‘quvchi B\t+998941112233\t127000');
    require('fs').writeFileSync(require('path').join(process.env.DATA_DIR || '.', 'jadval-namuna.tsv'), lines.join('\n') + '\n');
    console.log('Jadval namunasi: ' + require('path').join(process.env.DATA_DIR || '.', 'jadval-namuna.tsv'));
    console.log('Namuna ma’lumot yozildi (' + today + ').');
    await pool.end();
})().catch(async e => { console.error(e.message); await pool.end().catch(() => {}); process.exit(1); });
