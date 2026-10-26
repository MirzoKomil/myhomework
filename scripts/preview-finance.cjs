// Moliya bo'limini izolyatsiyalangan sinov bazasida ko'rish (faqat lokal QA uchun).
// Ishga tushirish: PAYROLL_TEST_DATABASE_URL=postgres://...@127.0.0.1/payroll_test_xxx node scripts/preview-finance.cjs
// Haqiqiy CRM bazasiga hech qachon ulanmaydi: faqat payroll_test_* nomli lokal bazaga ruxsat beriladi.
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Pool } = require('pg');
const url = process.env.PAYROLL_TEST_DATABASE_URL;
if (!url || new URL(url).hostname !== '127.0.0.1' || !/^\/payroll_test_[a-z0-9]+$/.test(new URL(url).pathname)) throw Error('Only a disposable local test DB is allowed');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-preview-'));
fs.mkdirSync(path.join(process.env.DATA_DIR, 'uploads'));
const inflow = require('../server/services/inflow');
const cash = require('../server/services/paymentCash');
const finance = require('../server/services/finance');
const root = path.resolve(__dirname, '..');
const pool = new Pool({ connectionString: url });
const actor = { id: 'admin' };

async function seed() {
    await pool.query(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,avatar TEXT);
    CREATE TABLE IF NOT EXISTS hr_employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,lang TEXT,login TEXT,department TEXT,status TEXT,start_date TEXT,join_date TEXT);
    CREATE TABLE IF NOT EXISTS user_sales_manager_links(user_id TEXT PRIMARY KEY,manager_id TEXT);
    CREATE TABLE IF NOT EXISTS teachers(id TEXT PRIMARY KEY,name TEXT);
    CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY,name TEXT,phone TEXT,subject TEXT,group_name TEXT,teacher_id TEXT,lesson_duration INTEGER,extra_data JSONB);
    CREATE TABLE IF NOT EXISTS leads(id TEXT PRIMARY KEY,name TEXT,phone TEXT,manager_id TEXT,status TEXT,language TEXT,deleted_at TIMESTAMPTZ,extra_data JSONB,comments TEXT DEFAULT '[]',updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,student_id TEXT,paid INTEGER,debt INTEGER,date TEXT);
    CREATE TABLE IF NOT EXISTS json_data(key TEXT PRIMARY KEY,data JSONB);
    CREATE TABLE IF NOT EXISTS salary_transactions(id TEXT PRIMARY KEY,employee_id TEXT,language TEXT,period_start DATE,period_end DATE,amount BIGINT,status TEXT,paid_at TIMESTAMPTZ,cash_expense_id TEXT);
    INSERT INTO users VALUES('admin','Abdulloh','admin','admin','') ON CONFLICT DO NOTHING;
    INSERT INTO hr_employees(id,name,role,lang,login,status) VALUES('m1','Hamidaxon Boymirzayeva','sotuv-menejeri','russian','m1','active'),('m2','Kamola Shahobiddinova','sotuv-menejeri','russian','m2','active'),
      ('t1','Hoshimova Gulhayoxon','rus-oqituvchi','russian','t1','active'),('t2','Azimova Mohinur','rus-oqituvchi','russian','t2','active') ON CONFLICT DO NOTHING;`);
    await inflow.initSchema(pool); await cash.initSchema(pool); await finance.initSchema(pool);
    if ((await pool.query('SELECT COUNT(*) AS n FROM payment_records')).rows[0].n !== '0') return;
    await finance.saveAccount(pool, actor, { id: 'acc-card', name: 'Karta (P2P / terminal)', kind: 'card', entity: 'common', methods: ['card', 'payme', 'click', 'paylater'], openingBalance: 2000000, openingDate: '2026-08-01' });
    const csv = fs.readFileSync(path.join(__dirname, 'fixtures/finance-preview.csv'), 'utf8').trim().split('\n').slice(1);
    let i = 0;
    for (const line of csv) {
        const [date, name, phone, amount, method, form, manager] = line.split(',');
        i++;
        await pool.query(`INSERT INTO payment_records(id,source_key,lead_id,language,manager_id,paid_date,amount,method,receipt_url,form,debt_snapshot,snapshot,legacy_review,actor_id)
            VALUES($1,$2,$3,'russian',$4,$5,$6,$7,'',$8,0,$9,$10,'system')`, ['p' + i, 'preview:' + i, 'lead-' + phone, manager, date, Number(amount), method, form,
            JSON.stringify({ name, phone: '+998' + phone, managerName: manager === 'm1' ? 'Hamidaxon Boymirzayeva' : manager === 'm2' ? 'Kamola Shahobiddinova' : '' }), method === 'unknown']);
    }
    const students = [['s1', 'Mamatov Kamoliddin', '332800826', 1900000, '2026-10-08'], ['s2', 'Sultonova Xafiza', '883139309', 1600000, '2026-10-15'], ['s3', 'Bobojonova Xosila', '902443056', 1500000, '2026-10-23'],
        ['s4', 'Raximov Abdumo‘min', '977039102', 1600000, '2026-08-17'], ['s5', 'Qosimjonov Sherzod', '978161313', 1400000, '2026-11-19'], ['s6', 'Akramov Ibrohim', '932200141', 900000, '2026-10-31']];
    for (const [id, name, phone, debt, due] of students) await pool.query(`INSERT INTO students VALUES($1,$2,$3,'russian','g',NULL,30,$4)`, [id, name, '+998' + phone, JSON.stringify({ debtAmount: debt, paymentDueDate: due })]);
    await pool.query(`INSERT INTO salary_transactions VALUES('sal-sep-t1','t1','russian','2026-09-01','2026-09-30',3200000,'paid',NOW(),NULL),('sal-sep-m1','m1','russian','2026-09-01','2026-09-30',2600000,'paid',NOW(),NULL),
        ('sal-oct-t1','t1','russian','2026-10-01','2026-10-15',1700000,'unpaid',NULL,NULL)`);
    // Demo hujjat moliyaning yopiq omboriga yuklanadi (PNG imzosi bilan 1x1 rasm).
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    let pn = 0;
    // Har bir chiqim uchun alohida hujjat (bitta chek bilan ikki marta pul chiqarib bo'lmaydi).
    const newProof = async () => (await finance.storeEvidence(pool, actor, { originalname: 'chek-demo-' + (++pn) + '.png', mimetype: 'image/png', buffer: Buffer.concat([png, Buffer.from(String(pn))]) })).url;
    let k = 0;
    const tx = (o) => finance.createTransaction(pool, actor, { requestKey: 'preview-seed-key-' + String(++k).padStart(4, '0'), entity: 'russian', accountId: 'acc-card', ...o });
    await tx({ type: 'expense', categoryCode: 'MKT_ADS', amount: 4200000, date: '2026-09-05', counterparty: 'Meta Ads', description: 'Sentyabr target', receiptUrl: await newProof() });
    await tx({ type: 'expense', categoryCode: 'MKT_ADS', amount: 3800000, date: '2026-10-04', counterparty: 'Meta Ads', description: 'Oktyabr target', receiptUrl: await newProof() });
    await tx({ type: 'expense', categoryCode: 'RENT', amount: 2500000, date: '2026-10-01', entity: 'common', counterparty: 'Ofis ijarasi', receiptUrl: await newProof() });
    await tx({ type: 'expense', categoryCode: 'SOFTWARE', amount: 650000, date: '2026-10-02', entity: 'common', counterparty: 'Railway, Eskiz SMS' });
    await tx({ type: 'refund', categoryCode: 'REFUND', amount: 300000, date: '2026-10-09', paymentRecordId: 'p40', counterparty: 'Qaytarish', description: 'Kurs boshlanmasdan voz kechdi', receiptUrl: await newProof(), terminates: true });
    await tx({ type: 'capital', categoryCode: 'OWNER_IN', amount: 5000000, date: '2026-09-01', entity: 'common', accountId: 'acc-bank', counterparty: 'Ta’sischi' });
    await tx({ type: 'expense', categoryCode: 'CAPEX', amount: 7200000, date: '2026-08-20', entity: 'common', accountId: 'acc-bank', counterparty: 'Noutbuk va proyektor', usefulLifeMonths: 36, receiptUrl: await newProof() });
    await tx({ type: 'expense', categoryCode: 'SOFTWARE', amount: 2400000, date: '2026-09-01', entity: 'common', accountId: 'acc-bank', counterparty: 'CRM yillik obuna', serviceStart: '2026-09-01', serviceEnd: '2027-08-31', receiptUrl: await newProof() });
    await finance.recordSalaryPayment(pool, actor, 'sal-sep-t1', { accountId: 'acc-card', date: '2026-10-03' });
    await finance.createPayable(pool, actor, { requestKey: 'preview-payable-0001', kind: 'bill', entity: 'russian', counterparty: 'Bloger reklama', categoryCode: 'MKT_OTHER', amount: 1500000, issueDate: '2026-10-10', dueDate: '2026-10-20' });
    await finance.addAccountCheck(pool, actor, 'acc-card', { date: '2026-10-20', actualBalance: 21000000, note: 'Bank ilovasi' });
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
async function body(req) { let s = ''; for await (const c of req) s += c; try { return JSON.parse(s || '{}'); } catch { return {}; } }
const routes = [
    ['GET', /^\/api\/finance\/overview/, (q) => finance.overview(pool, actor, q)],
    ['GET', /^\/api\/finance\/cashbook/, (q) => finance.cashbook(pool, actor, q)],
    ['GET', /^\/api\/finance\/transactions/, (q) => finance.listTransactions(pool, actor, q)],
    ['GET', /^\/api\/finance\/audit/, (q) => finance.auditLog(pool, actor, q)],
    ['POST', /^\/api\/finance\/transactions$/, (q, b) => finance.createTransaction(pool, actor, b)],
    ['POST', /^\/api\/finance\/transactions\/([^/]+)\/reverse$/, (q, b, m) => finance.reverseTransaction(pool, actor, m[1], b)],
    ['POST', /^\/api\/finance\/payables$/, (q, b) => finance.createPayable(pool, actor, b)],
    ['POST', /^\/api\/finance\/payables\/([^/]+)\/void$/, (q, b, m) => finance.voidPayable(pool, actor, m[1], b)],
    ['POST', /^\/api\/finance\/salaries\/([^/]+)\/cash-out$/, (q, b, m) => finance.recordSalaryPayment(pool, actor, m[1], b)],
    ['POST', /^\/api\/finance\/receipts\/void$/, (q, b) => finance.voidReceipts(pool, actor, b)],
    ['POST', /^\/api\/finance\/receipts\/manual$/, (q, b) => finance.manualReceipt(pool, actor, b)],
    ['GET', /^\/api\/finance\/people/, (q) => finance.people(pool, actor, q)],
    ['GET', /^\/api\/finance\/close-status/, (q) => finance.closeStatus(pool, actor, q)],
    ['POST', /^\/api\/finance\/receipts\/batch$/, (q, b) => finance.batchCorrections(pool, actor, b)],
    ['POST', /^\/api\/finance\/reconcile$/, (q, b) => finance.reconcile(pool, actor, b)],
    ['POST', /^\/api\/finance\/accounts$/, (q, b) => finance.saveAccount(pool, actor, b)],
    ['POST', /^\/api\/finance\/accounts\/([^/]+)\/checks$/, (q, b, m) => finance.addAccountCheck(pool, actor, m[1], b)],
    ['POST', /^\/api\/finance\/assets\/([^/]+)\/dispose$/, (q, b, m) => finance.disposeAsset(pool, actor, m[1], b)],
    ['POST', /^\/api\/finance\/assets\/([^/]+)\/impair$/, (q, b, m) => finance.impairAsset(pool, actor, m[1], b)],
    ['POST', /^\/api\/finance\/periods$/, (q, b) => finance.lockMonth(pool, actor, b)],
    ['PUT', /^\/api\/finance\/settings$/, (q, b) => finance.saveSettings(pool, actor, b)],
    ['GET', /^\/api\/inflow\/cash-reconciliation/, () => ({ manual: [], decisions: [], pending: [] })],
    ['GET', /^\/api\/inflow(\?|$)/, (q) => inflow.list(pool, actor, q)]
];
http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) {
        if (req.method === 'POST' && u.pathname === '/api/finance/evidence') {
            // Oddiy multipart o'quvchi (faqat preview uchun): bitta "file" qismi.
            const chunks = []; for await (const c of req) chunks.push(c);
            const raw = Buffer.concat(chunks), boundary = '--' + /boundary=(.+)$/.exec(req.headers['content-type'] || '')[1];
            const start = raw.indexOf('\r\n\r\n') + 4, end = raw.indexOf('\r\n' + boundary, start);
            const headerText = raw.slice(0, start).toString();
            const file = { originalname: (/filename="([^"]*)"/.exec(headerText) || [])[1] || 'file', mimetype: (/Content-Type: ([^\r\n]+)/i.exec(headerText) || [])[1] || '', buffer: raw.slice(start, end) };
            res.setHeader('Content-Type', 'application/json');
            try { return res.end(JSON.stringify(await finance.storeEvidence(pool, actor, file))); }
            catch (e) { res.statusCode = e.status || 500; return res.end(JSON.stringify({ error: e.message })); }
        }
        const ev = /^\/api\/finance\/evidence\/([^/]+)$/.exec(u.pathname);
        if (req.method === 'GET' && ev) {
            try { const f = await finance.readEvidence(pool, actor, ev[1]); res.setHeader('Content-Type', f.mime); return fs.createReadStream(f.path).pipe(res); }
            catch (e) { res.statusCode = e.status || 500; return res.end(JSON.stringify({ error: e.message })); }
        }
        const r = routes.find(([m, re]) => m === req.method && re.test(u.pathname + (u.search ? '?' : '')));
        res.setHeader('Content-Type', 'application/json');
        if (!r) return res.end(u.pathname === '/api/state' ? JSON.stringify({}) : '{}');
        try { res.end(JSON.stringify(await r[2](Object.fromEntries(u.searchParams), req.method === 'GET' ? {} : await body(req), u.pathname.match(r[1])))); }
        catch (e) { res.statusCode = e.status || 500; res.end(JSON.stringify({ error: e.message })); }
        return;
    }
    const file = path.join(root, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT || 8790), '127.0.0.1', async () => {
    await seed();
    process.stdout.write('Finance preview ready on http://127.0.0.1:' + (process.env.PORT || 8790) + '\n');
});
