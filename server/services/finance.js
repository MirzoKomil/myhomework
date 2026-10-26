// Moliya bo'limi: hisob raqamlar, xarajat/qaytarish/kapital/qarz operatsiyalari, korxona
// qarzlari, tushumlarni hujjat asosida tuzatish, oy yopish (muzlatilgan nusxa) va hisobotlar.
//
// Qoidalar (ilova kodida ham, ma'lumotlar bazasida ham majburiy):
//  * Moliyaviy yozuvlar o'chirilmaydi va tahrirlanmaydi (bazadagi triggerlar UPDATE/DELETE'ni rad etadi).
//    Xato — storno yoki hujjatli tuzatish bilan yopiladi.
//  * Yopilgan davrga hech qanday yozuvchi (CRM tushumi, moliya, eski import) yozolmaydi — trigger.
//  * Yopilgan oyning hisobotlari muzlatilgan nusxadan olinadi; keyingi farqlar ochiq oyda
//    "o'tgan davr tuzatishi" bo'lib ko'rinadi.
//  * Har bir amal xesh-zanjirli audit jurnaliga yoziladi (o'zgartirilsa, zanjir uziladi).
//  * Vazifalar ajratilgan: oy yopish, sozlamalar, hisob raqamlar va katta summali bekor qilish —
//    faqat rahbar (admin/boshliq); kundalik kiritish — moliya xodimi.
const { randomUUID, createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
const F = require('../../js/financeEngine');
const ledger = require('../../js/paymentLedger');
const inflow = require('./inflow');

const error = (status, message) => Object.assign(new Error(message), { status });
const ENTITY_VALUES = ['english', 'russian', 'common'];
const DIRECTOR_ROLES = ['admin', 'boshliq'];
const EVIDENCE_RE = /^\/api\/finance\/evidence\/([0-9a-f-]{36})$/;
const toKey = v => v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : String(v).slice(0, 10);
const text = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const fmt = n => (Number(n) < 0 ? '-' : '') + String(Math.abs(Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function lockGuardSql(table, column) {
    return `
CREATE OR REPLACE FUNCTION fin_guard_${table}() RETURNS trigger AS $$
DECLARE closed TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(hashtext('fin-write'));
  SELECT MAX(month) INTO closed FROM fin_period_locks;
  IF closed IS NOT NULL AND TO_CHAR(NEW.${column},'YYYY-MM') <= closed THEN
    RAISE EXCEPTION 'FIN_PERIOD_CLOSED: % sanasi yopilgan davrga (% gacha) tushadi', NEW.${column}, closed USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fin_guard_${table} ON ${table};
CREATE TRIGGER fin_guard_${table} BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION fin_guard_${table}();`;
}
function immutableSql(table) {
    return `
DROP TRIGGER IF EXISTS fin_immutable_${table} ON ${table};
CREATE TRIGGER fin_immutable_${table} BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION fin_reject_change();`;
}
// Muhr bilan himoyalangan jadvallar va ularning kalit ustuni.
const SEALED_TABLES = { payment_records: 'id', fin_transactions: 'id', payment_record_voids: 'record_id', fin_account_checks: 'id', fin_asset_events: 'id',
    fin_accounts: 'id', fin_payables: 'id', fin_contract_values: 'record_id', fin_settings_history: 'id', fin_period_locks: 'month', fin_period_snapshots: 'month', salary_transactions: 'id', fin_student_log: 'id', fin_settings: 'id' };
const SCHEMA = `
CREATE TABLE IF NOT EXISTS fin_accounts (
 id TEXT PRIMARY KEY, entity TEXT NOT NULL CHECK(entity IN ('english','russian','common')), name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('cash','card','bank','clearing','wallet','suspense')), methods TEXT[] NOT NULL DEFAULT '{}',
 opening_balance BIGINT NOT NULL DEFAULT 0, opening_date DATE, active BOOLEAN NOT NULL DEFAULT TRUE, sort INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_accounts ADD COLUMN IF NOT EXISTS request_key TEXT UNIQUE;
CREATE TABLE IF NOT EXISTS fin_payables (
 id TEXT PRIMARY KEY, request_key TEXT UNIQUE, entity TEXT NOT NULL CHECK(entity IN ('english','russian','common')),
 kind TEXT NOT NULL CHECK(kind IN ('bill','loan','other')), counterparty TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 category_code TEXT NOT NULL, amount BIGINT NOT NULL CHECK(amount>0 AND amount<=9007199254740991), issue_date DATE NOT NULL, due_date DATE,
 document_url TEXT NOT NULL DEFAULT '', voided_at TIMESTAMPTZ, void_reason TEXT, voided_by TEXT,
 actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_transactions (
 id TEXT PRIMARY KEY, request_key TEXT UNIQUE, entity TEXT NOT NULL CHECK(entity IN ('english','russian','common')),
 txn_date DATE NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense','refund','capital','drawing','loan_in','loan_repay','transfer')),
 category_code TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES fin_accounts(id), to_account_id TEXT REFERENCES fin_accounts(id),
 amount BIGINT NOT NULL CHECK(amount>0 AND amount<=9007199254740991), counterparty TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
 receipt_url TEXT NOT NULL DEFAULT '', payable_id TEXT REFERENCES fin_payables(id), payment_record_id TEXT, salary_id TEXT,
 reverses_id TEXT UNIQUE REFERENCES fin_transactions(id), reversal_reason TEXT, legacy BOOLEAN NOT NULL DEFAULT FALSE,
 actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK((type='transfer') = (to_account_id IS NOT NULL)), CHECK(to_account_id IS NULL OR to_account_id<>account_id)
);
ALTER TABLE fin_transactions ADD COLUMN IF NOT EXISTS useful_life_months INTEGER;
ALTER TABLE fin_transactions ADD COLUMN IF NOT EXISTS non_salary BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS fin_transactions_salary ON fin_transactions(salary_id) WHERE salary_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fin_transactions_date ON fin_transactions(txn_date);
CREATE TABLE IF NOT EXISTS payment_record_voids (
 record_id TEXT PRIMARY KEY REFERENCES payment_records(id), void_date DATE NOT NULL, reason TEXT NOT NULL,
 evidence_url TEXT NOT NULL DEFAULT '', replaced_by TEXT, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_account_checks (
 id BIGSERIAL PRIMARY KEY, account_id TEXT NOT NULL REFERENCES fin_accounts(id), check_date DATE NOT NULL,
 actual_balance BIGINT NOT NULL, note TEXT NOT NULL DEFAULT '', actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_account_checks ADD COLUMN IF NOT EXISTS request_key TEXT UNIQUE;
CREATE TABLE IF NOT EXISTS fin_period_locks (
 month TEXT PRIMARY KEY CHECK(month ~ '^[0-9]{4}-[0-9]{2}$'), locked_by TEXT NOT NULL, locked_by_name TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_period_snapshots (month TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS fin_settings (id TEXT PRIMARY KEY, data JSONB NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS fin_audit (
 id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, entity_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL,
 before_data JSONB, after_data JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fin_audit ADD COLUMN IF NOT EXISTS prev_hash TEXT;
ALTER TABLE fin_audit ADD COLUMN IF NOT EXISTS hash TEXT;
CREATE TABLE IF NOT EXISTS fin_evidence (
 id TEXT PRIMARY KEY, file_name TEXT NOT NULL, original_name TEXT NOT NULL, mime TEXT NOT NULL, size BIGINT NOT NULL, sha256 TEXT NOT NULL,
 uploaded_by TEXT NOT NULL, uploaded_by_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fin_migrations (id TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE fin_transactions ADD COLUMN IF NOT EXISTS terminates BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE fin_payables ADD COLUMN IF NOT EXISTS void_date DATE;
ALTER TABLE fin_transactions ADD COLUMN IF NOT EXISTS service_start DATE;
ALTER TABLE fin_transactions ADD COLUMN IF NOT EXISTS service_end DATE;
ALTER TABLE fin_transactions ADD COLUMN IF NOT EXISTS asset_id TEXT;
ALTER TABLE fin_payables ADD COLUMN IF NOT EXISTS service_start DATE;
ALTER TABLE fin_payables ADD COLUMN IF NOT EXISTS service_end DATE;
-- Asosiy vosita hodisalari: sotish / hisobdan chiqarish (amount = tushum, 0 bo'lishi mumkin) va qadrsizlanish (amount = zarar).
CREATE TABLE IF NOT EXISTS fin_asset_events (
 id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES fin_transactions(id), kind TEXT NOT NULL CHECK(kind IN ('disposal','impairment')),
 event_date DATE NOT NULL, amount BIGINT NOT NULL CHECK(amount>=0), transaction_id TEXT REFERENCES fin_transactions(id), reason TEXT NOT NULL,
 evidence_url TEXT NOT NULL DEFAULT '', actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(asset_id, kind)
);
-- Muhr zanjiri: raqamlarga ta'sir qiluvchi har bir jadval qatorining har bir versiyasi (kiritish, o'zgartirish, o'chirish)
-- xeshlanib zanjirga qo'shiladi. Trigger o'chirilib qator o'zgartirilsa/o'chirilsa/qo'shilsa — tekshiruvda aniqlanadi.
DROP TABLE IF EXISTS fin_seals CASCADE;
CREATE TABLE IF NOT EXISTS fin_row_seals (
 seq BIGSERIAL PRIMARY KEY, table_name TEXT NOT NULL, row_id TEXT NOT NULL, op CHAR(1) NOT NULL CHECK(op IN ('I','U','D')),
 body_hash TEXT NOT NULL, prev_hash TEXT NOT NULL, row_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fin_row_seals_row ON fin_row_seals(table_name, row_id, seq);
-- O'quvchi holatining moliyaga ta'sir qiluvchi o'zgarishlari (muzlatish, tashlash, qarz, to'lov sanasi) jurnali:
-- CRM qayerdan o'zgartirmasin, baza triggeri yozib qo'yadi; jurnal o'zgarmas va muhrlangan.
CREATE TABLE IF NOT EXISTS fin_student_log (
 id BIGSERIAL PRIMARY KEY, student_id TEXT NOT NULL, state JSONB NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), db_user TEXT NOT NULL DEFAULT current_user, app_user TEXT
);
CREATE INDEX IF NOT EXISTS fin_student_log_student ON fin_student_log(student_id, id);
ALTER TABLE fin_period_locks ADD COLUMN IF NOT EXISTS snapshot_hashes JSONB;
ALTER TABLE fin_period_snapshots ADD COLUMN IF NOT EXISTS sha256 TEXT;
-- Sozlamalar tarixi: har bir o'zgarish kuchga kirgan sanasi bilan (o'zgarmas).
CREATE TABLE IF NOT EXISTS fin_settings_history (
 id BIGSERIAL PRIMARY KEY, effective_from DATE NOT NULL, data JSONB NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Shartnoma qiymati birinchi tushum paytida moliyaning o'z jadvalida muzlatiladi: lid kartasidagi narx keyin
-- o'zgartirilsa ham tarixiy tushum (IFRS 15) o'zgarmaydi.
CREATE TABLE IF NOT EXISTS fin_contract_values (
 record_id TEXT PRIMARY KEY REFERENCES payment_records(id), lead_id TEXT, value BIGINT, source TEXT NOT NULL, captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION fin_reject_change() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'FIN_IMMUTABLE: % jadvalidagi moliyaviy yozuvni o''zgartirib yoki o''chirib bo''lmaydi', TG_TABLE_NAME USING ERRCODE = 'P0001'; END $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION fin_payables_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.voided_at IS NOT NULL OR NEW.voided_at IS NULL
     OR NEW.void_date IS NULL
     OR (to_jsonb(NEW) - 'voided_at' - 'void_reason' - 'voided_by' - 'void_date') <> (to_jsonb(OLD) - 'voided_at' - 'void_reason' - 'voided_by' - 'void_date') THEN
    RAISE EXCEPTION 'FIN_IMMUTABLE: hisob-faktura faqat bir marta bekor qilinishi mumkin' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fin_payables_guard ON fin_payables;
CREATE TRIGGER fin_payables_guard BEFORE UPDATE OR DELETE ON fin_payables FOR EACH ROW EXECUTE FUNCTION fin_payables_guard();
CREATE OR REPLACE FUNCTION fin_payment_records_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'FIN_IMMUTABLE: tushum yozuvini o''chirib bo''lmaydi' USING ERRCODE = 'P0001'; END IF;
  IF (to_jsonb(NEW) - 'student_id' - 'account_id') <> (to_jsonb(OLD) - 'student_id' - 'account_id')
     OR (OLD.student_id IS NOT NULL AND NEW.student_id IS DISTINCT FROM OLD.student_id)
     OR (OLD.account_id IS NOT NULL AND NEW.account_id IS DISTINCT FROM OLD.account_id) THEN
    RAISE EXCEPTION 'FIN_IMMUTABLE: tushum yozuvini o''zgartirib bo''lmaydi — moliya bo''limida tuzating' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fin_payment_records_guard ON payment_records;
CREATE TRIGGER fin_payment_records_guard BEFORE UPDATE OR DELETE ON payment_records FOR EACH ROW EXECUTE FUNCTION fin_payment_records_guard();
-- Tushum yozilgan paytdagi hisob raqam saqlanadi: keyinchalik sozlama o'zgarsa ham tarix ko'chmaydi.
CREATE OR REPLACE FUNCTION fin_receipt_account() RETURNS trigger AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT id INTO NEW.account_id FROM fin_accounts WHERE active AND NEW.method = ANY(methods)
      ORDER BY (entity = NEW.language) DESC, (entity = 'common') DESC, sort LIMIT 1;
    IF NEW.account_id IS NULL THEN NEW.account_id := 'acc-suspense'; END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fin_receipt_account ON payment_records;
CREATE TRIGGER fin_receipt_account BEFORE INSERT ON payment_records FOR EACH ROW EXECUTE FUNCTION fin_receipt_account();
${lockGuardSql('payment_records', 'paid_date')}
${lockGuardSql('fin_transactions', 'txn_date')}
${lockGuardSql('fin_payables', 'issue_date')}
${lockGuardSql('payment_record_voids', 'void_date')}
${lockGuardSql('fin_account_checks', 'check_date')}
${lockGuardSql('fin_asset_events', 'event_date')}
-- Muhr matni: NULL maydonlar olib tashlanadi (keyin qo'shiladigan bo'sh ustun eski muhrlarni buzmaydi; yangi ustunlar
-- NULL standart qiymat bilan qo'shilishi shart). Vaqt zonasiga bog'liq va keyin bog'lanadigan (student_id) maydonlar kirmaydi.
CREATE OR REPLACE FUNCTION fin_row_text(t TEXT, j JSONB) RETURNS TEXT AS $$
  SELECT jsonb_strip_nulls(j - 'created_at' - 'paid_at' - 'updated_at' - 'locked_at' - 'voided_at' - 'captured_at' - 'confirmed_at')::text
$$ LANGUAGE sql IMMUTABLE;
-- TG_ARGV[0] — kalit ustun nomi.
CREATE OR REPLACE FUNCTION fin_seal_row() RETURNS trigger AS $$
DECLARE prev TEXT; body TEXT; rid TEXT; op CHAR(1); bh TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND fin_row_text(TG_TABLE_NAME, to_jsonb(NEW)) = fin_row_text(TG_TABLE_NAME, to_jsonb(OLD)) THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('fin-seal'));
  SELECT row_hash INTO prev FROM fin_row_seals ORDER BY seq DESC LIMIT 1;
  prev := COALESCE(prev, '');
  op := LEFT(TG_OP, 1);
  IF TG_OP = 'DELETE' THEN rid := to_jsonb(OLD)->>TG_ARGV[0]; bh := 'deleted';
  ELSE rid := to_jsonb(NEW)->>TG_ARGV[0]; bh := encode(sha256(convert_to(fin_row_text(TG_TABLE_NAME, to_jsonb(NEW)), 'UTF8')), 'hex'); END IF;
  INSERT INTO fin_row_seals(table_name,row_id,op,body_hash,prev_hash,row_hash)
    VALUES (TG_TABLE_NAME, rid, op, bh, prev, encode(sha256(convert_to(prev || '|' || TG_TABLE_NAME || '|' || rid || '|' || op || '|' || bh, 'UTF8')), 'hex'));
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;
${Object.entries(SEALED_TABLES).map(([t, k]) => `DO $do$ BEGIN IF to_regclass('${t}') IS NOT NULL THEN
  DROP TRIGGER IF EXISTS fin_seal_${t} ON ${t};
  CREATE TRIGGER fin_seal_${t} AFTER INSERT OR UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION fin_seal_row('${k}');
END IF; END $do$;`).join('\n')}
CREATE OR REPLACE FUNCTION fin_capture_contract_value() RETURNS trigger AS $$
DECLARE v TEXT;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN SELECT extra_data->'paymentSurvey'->>'totalAmount' INTO v FROM leads WHERE id = NEW.lead_id; END IF;
  INSERT INTO fin_contract_values(record_id, lead_id, value, source)
    VALUES (NEW.id, NEW.lead_id, CASE WHEN v ~ '^[0-9]{1,15}$' THEN v::BIGINT ELSE NULL END, 'insert') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fin_capture_contract_value ON payment_records;
CREATE TRIGGER fin_capture_contract_value AFTER INSERT ON payment_records FOR EACH ROW EXECUTE FUNCTION fin_capture_contract_value();
-- Yopilgan oyning nusxasi o'zgarmaydi va o'chirilmaydi (faqat oy qayta ochilgandan keyin).
CREATE OR REPLACE FUNCTION fin_snapshot_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR EXISTS (SELECT 1 FROM fin_period_locks WHERE month >= OLD.month) THEN
    RAISE EXCEPTION 'FIN_IMMUTABLE: yopilgan oyning muzlatilgan nusxasini o''zgartirib bo''lmaydi' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fin_snapshot_guard ON fin_period_snapshots;
CREATE TRIGGER fin_snapshot_guard BEFORE UPDATE OR DELETE ON fin_period_snapshots FOR EACH ROW EXECUTE FUNCTION fin_snapshot_guard();
-- Hisob raqam: harakat bo'lgan hisobning turi, egasi va boshlang'ich qoldig'i o'zgarmaydi; o'chirilmaydi.
CREATE OR REPLACE FUNCTION fin_accounts_guard() RETURNS trigger AS $$
DECLARE closed TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'FIN_IMMUTABLE: hisob raqamni o''chirib bo''lmaydi — faolsizlantiring' USING ERRCODE = 'P0001'; END IF;
  IF (NEW.opening_balance, NEW.opening_date, NEW.entity, NEW.kind) IS DISTINCT FROM (OLD.opening_balance, OLD.opening_date, OLD.entity, OLD.kind) THEN
    IF EXISTS (SELECT 1 FROM fin_transactions WHERE account_id = OLD.id OR to_account_id = OLD.id)
       OR EXISTS (SELECT 1 FROM payment_records WHERE account_id = OLD.id)
       OR EXISTS (SELECT 1 FROM fin_account_checks WHERE account_id = OLD.id) THEN
      RAISE EXCEPTION 'FIN_IMMUTABLE: harakat bo''lgan hisobning turi, egasi va boshlang''ich qoldig''i o''zgarmaydi' USING ERRCODE = 'P0001';
    END IF;
    SELECT MAX(month) INTO closed FROM fin_period_locks;
    IF closed IS NOT NULL AND ((OLD.opening_date IS NOT NULL AND TO_CHAR(OLD.opening_date,'YYYY-MM') <= closed) OR (NEW.opening_date IS NOT NULL AND TO_CHAR(NEW.opening_date,'YYYY-MM') <= closed)) THEN
      RAISE EXCEPTION 'FIN_PERIOD_CLOSED: boshlang''ich qoldiq sanasi yopilgan davrga tushadi' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fin_accounts_guard ON fin_accounts;
CREATE TRIGGER fin_accounts_guard BEFORE UPDATE OR DELETE ON fin_accounts FOR EACH ROW EXECUTE FUNCTION fin_accounts_guard();
-- Maosh hisoblari ham yopilgan davrga yozilmaydi (hisoblash usulidagi xarajat shu jadvaldan olinadi).
CREATE OR REPLACE FUNCTION fin_guard_salary() RETURNS trigger AS $$
DECLARE closed TEXT;
BEGIN
  SELECT MAX(month) INTO closed FROM fin_period_locks;
  IF closed IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'INSERT' AND TO_CHAR(NEW.period_end,'YYYY-MM') <= closed THEN
    RAISE EXCEPTION 'FIN_PERIOD_CLOSED: maosh davri (%) yopilgan moliyaviy davrga tushadi', NEW.period_end USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' AND TO_CHAR(OLD.period_end,'YYYY-MM') <= closed THEN
    RAISE EXCEPTION 'FIN_PERIOD_CLOSED: yopilgan davrdagi maoshni o''chirib bo''lmaydi' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.amount, NEW.period_start, NEW.period_end, NEW.language, NEW.employee_id) IS DISTINCT FROM (OLD.amount, OLD.period_start, OLD.period_end, OLD.language, OLD.employee_id)
     AND (TO_CHAR(OLD.period_end,'YYYY-MM') <= closed OR TO_CHAR(NEW.period_end,'YYYY-MM') <= closed) THEN
    RAISE EXCEPTION 'FIN_PERIOD_CLOSED: yopilgan davrdagi maosh summasini o''zgartirib bo''lmaydi' USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF to_regclass('salary_transactions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS fin_guard_salary ON salary_transactions;
    CREATE TRIGGER fin_guard_salary BEFORE INSERT OR UPDATE OR DELETE ON salary_transactions FOR EACH ROW EXECUTE FUNCTION fin_guard_salary();
  END IF;
END $$;
${['fin_transactions', 'payment_record_voids', 'fin_account_checks', 'fin_audit', 'fin_evidence', 'fin_period_snapshots', 'fin_settings_history', 'fin_contract_values', 'fin_payables', 'fin_period_locks', 'fin_asset_events', 'fin_row_seals', 'fin_accounts', 'fin_student_log']
    .map(t => `DROP TRIGGER IF EXISTS fin_no_truncate_${t} ON ${t};\nCREATE TRIGGER fin_no_truncate_${t} BEFORE TRUNCATE ON ${t} FOR EACH STATEMENT EXECUTE FUNCTION fin_reject_change();`).join('\n')}
CREATE OR REPLACE FUNCTION fin_student_state(x JSONB) RETURNS JSONB AS $$
  SELECT jsonb_build_object('frozen', COALESCE((x->>'frozen')::boolean, false), 'frozenAt', x->>'frozenAt', 'status', x->>'status',
    'inactiveAt', COALESCE(x->>'inactiveAt', x->>'leftAt'), 'debtAmount', x->>'debtAmount', 'paymentDueDate', x->>'paymentDueDate')
$$ LANGUAGE sql IMMUTABLE;
CREATE OR REPLACE FUNCTION fin_log_student() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR fin_student_state(COALESCE(NEW.extra_data,'{}'::jsonb)) IS DISTINCT FROM fin_student_state(COALESCE(OLD.extra_data,'{}'::jsonb)) THEN
    INSERT INTO fin_student_log(student_id, state, app_user) VALUES (NEW.id, fin_student_state(COALESCE(NEW.extra_data,'{}'::jsonb)), NULLIF(current_setting('app.user_id', true), ''));
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DO $do$ BEGIN IF to_regclass('students') IS NOT NULL THEN
  DROP TRIGGER IF EXISTS fin_log_student ON students;
  CREATE TRIGGER fin_log_student AFTER INSERT OR UPDATE ON students FOR EACH ROW EXECUTE FUNCTION fin_log_student();
END IF; END $do$;
${immutableSql('fin_student_log')}
${immutableSql('fin_settings_history')}
${immutableSql('fin_asset_events')}
${immutableSql('fin_row_seals')}
${immutableSql('fin_contract_values')}
${immutableSql('fin_transactions')}
${immutableSql('payment_record_voids')}
${immutableSql('fin_account_checks')}
${immutableSql('fin_audit')}
${immutableSql('fin_evidence')}
`;

async function initSchema(pool) {
    // Advisory lock va unlock bitta ulanishda bo'lishi shart.
    const db = typeof pool.connect === 'function' && !pool.release ? await pool.connect() : pool;
    try {
        await db.query("SELECT pg_advisory_lock(hashtext('fin-init'))");
        try {
            await db.query(SCHEMA);
            for (const [i, a] of F.DEFAULT_ACCOUNTS.entries()) {
                await db.query(`INSERT INTO fin_accounts(id,entity,name,kind,methods,sort) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`, [a.id, a.entity, a.name, a.kind, a.methods, i]);
            }
            await db.query(`INSERT INTO fin_settings(id,data) VALUES('main',$1) ON CONFLICT(id) DO NOTHING`, [JSON.stringify(F.DEFAULT_SETTINGS)]);
            if (!(await db.query("SELECT 1 FROM fin_migrations WHERE id='receipt-accounts-v1'")).rows.length) {
                // Mavjud tushumlar uchun hisob bir marta, hozirgi xaritaga ko'ra biriktiriladi.
                await db.query(`UPDATE payment_records r SET account_id=COALESCE((SELECT a.id FROM fin_accounts a WHERE a.active AND r.method = ANY(a.methods)
                    ORDER BY (a.entity=r.language) DESC,(a.entity='common') DESC,a.sort LIMIT 1),'acc-suspense') WHERE account_id IS NULL`);
                await db.query("INSERT INTO fin_migrations(id) VALUES('receipt-accounts-v1') ON CONFLICT DO NOTHING");
            }
            // Mavjud tushumlar uchun shartnoma qiymati bir marta (hozirgi lid narxi bo'yicha) muzlatiladi.
            await db.query(`INSERT INTO fin_contract_values(record_id,lead_id,value,source)
                SELECT r.id, r.lead_id, CASE WHEN l.extra_data->'paymentSurvey'->>'totalAmount' ~ '^[0-9]{1,15}$' THEN (l.extra_data->'paymentSurvey'->>'totalAmount')::BIGINT END, 'backfill'
                FROM payment_records r LEFT JOIN leads l ON l.id=r.lead_id ON CONFLICT DO NOTHING`);
            if (!(await db.query('SELECT 1 FROM fin_settings_history LIMIT 1')).rows.length) {
                const cur = (await db.query("SELECT data FROM fin_settings WHERE id='main'")).rows[0]?.data || F.DEFAULT_SETTINGS;
                await db.query("INSERT INTO fin_settings_history(effective_from,data,actor_id,actor_name) VALUES('1900-01-01',$1,'system','Boshlang‘ich sozlama')", [JSON.stringify(cur)]);
            }
            await migrateLegacyCash(db);
            if (!(await db.query("SELECT 1 FROM fin_migrations WHERE id='student-log-v1'")).rows.length) {
                await db.query("INSERT INTO fin_student_log(student_id,state) SELECT id, fin_student_state(COALESCE(extra_data,'{}'::jsonb)) FROM students s WHERE NOT EXISTS (SELECT 1 FROM fin_student_log l WHERE l.student_id=s.id)");
                await db.query("INSERT INTO fin_migrations(id) VALUES('student-log-v1') ON CONFLICT DO NOTHING");
            }
            await backfillSeals(db);
        } finally { await db.query("SELECT pg_advisory_unlock(hashtext('fin-init'))"); }
    } finally { if (db !== pool) db.release(); }
}

async function transaction(pool, fn) {
    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        // Barcha moliyaviy yozuvlar ketma-ket: qoldiq, oy yopish va limit tekshiruvlari poyga holatiga tushmaydi.
        await db.query("SELECT pg_advisory_xact_lock(hashtext('fin-write'))");
        const result = await fn(db);
        await db.query('COMMIT'); return result;
    } catch (e) {
        await db.query('ROLLBACK');
        if (/FIN_PERIOD_CLOSED|FIN_IMMUTABLE/.test(e.message || '')) throw error(409, e.message.replace(/^.*?(FIN_PERIOD_CLOSED|FIN_IMMUTABLE):\s*/, ''));
        throw e;
    } finally { db.release(); }
}
async function read(pool, fn) {
    const db = await pool.connect();
    try { await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const r = await fn(db); await db.query('COMMIT'); return r; }
    catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
async function access(db, actor, { director = false } = {}) {
    const user = await inflow.access(db, actor);
    if (!user.finance) throw error(403, 'Moliya bo‘limiga ruxsat yo‘q');
    user.director = DIRECTOR_ROLES.includes(user.role);
    if (director && !user.director) throw error(403, 'Bu amal faqat rahbar (admin/boshliq) uchun');
    return user;
}
function auditHash(prev, row) { return createHash('sha256').update(String(prev || '') + '|' + JSON.stringify(row)).digest('hex'); }
async function audit(db, user, action, entityId, before, after) {
    const prev = (await db.query('SELECT hash FROM fin_audit WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1')).rows[0]?.hash || '';
    const createdAt = new Date().toISOString();
    const row = { action, entityId, actorId: user.id || 'system', actorName: user.name || user.email || 'System', before: before ?? null, after: after ?? null, createdAt };
    await db.query('INSERT INTO fin_audit(action,entity_id,actor_id,actor_name,before_data,after_data,created_at,prev_hash,hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [action, entityId, row.actorId, row.actorName, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), createdAt, prev, auditHash(prev, sortKeys(canonical(row)))]);
}
function canonical(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
// Zanjir boshi (oxirgi yozuv xeshi) hisobot va oy nusxalariga yoziladi — tashqi "langar": chop etilgan
// hisobotdagi xesh bazadagi zanjirga mos kelmasa, jurnal oxiridan yozuv kesilgani ma'lum bo'ladi.
async function auditHead(db) {
    const r = (await db.query('SELECT id,hash FROM fin_audit WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1')).rows[0];
    return r ? { id: Number(r.id), hash: r.hash } : { id: 0, hash: '' };
}
const verified = { id: 0, hash: '', count: 0 };
// ---------- Muhr zanjiri (moliyaviy qatorlar) ----------
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
const sealHash = (prev, table, rowId, op, bodyHash) => sha(prev + '|' + table + '|' + rowId + '|' + op + '|' + bodyHash);
async function sealedTables(db) {
    const out = {};
    for (const [t, k] of Object.entries(SEALED_TABLES)) if ((await db.query('SELECT to_regclass($1) AS r', [t])).rows[0].r) out[t] = k;
    return out;
}
async function rowHashes(db, table, key) {
    return new Map((await db.query(`SELECT ${key}::text AS id, fin_row_text($1, to_jsonb(t)) AS body FROM ${table} t`, [table])).rows.map(r => [r.id, sha(r.body)]));
}
// Muhr qo'yilmagan mavjud qatorlar bir marta muhrlanadi (birinchi ishga tushirishda).
async function backfillSeals(db) {
    // Faqat bir marta: keyin muhrsiz qator paydo bo'lsa — bu buzilish, qayta ishga tushirish uni "oqlamaydi".
    if ((await db.query("SELECT 1 FROM fin_migrations WHERE id='row-seals-v1'")).rows.length) return;
    const tables = await sealedTables(db);
    let prev = (await db.query('SELECT row_hash FROM fin_row_seals ORDER BY seq DESC LIMIT 1')).rows[0]?.row_hash || '';
    for (const [table, key] of Object.entries(tables)) {
        const rows = (await db.query(`SELECT ${key}::text AS id, fin_row_text($1, to_jsonb(t)) AS body FROM ${table} t
            WHERE NOT EXISTS (SELECT 1 FROM fin_row_seals s WHERE s.table_name=$1 AND s.row_id=t.${key}::text) ORDER BY t.${key}`, [table])).rows;
        for (const r of rows) {
            const bh = sha(r.body), h = sealHash(prev, table, r.id, 'I', bh);
            await db.query('INSERT INTO fin_row_seals(table_name,row_id,op,body_hash,prev_hash,row_hash) VALUES($1,$2,$3,$4,$5,$6)', [table, r.id, 'I', bh, prev, h]);
            prev = h;
        }
    }
    await db.query("INSERT INTO fin_migrations(id) VALUES('row-seals-v1') ON CONFLICT DO NOTHING");
}
// Har bir muhrlangan jadvalda joriy qator xeshi oxirgi muhr bilan bazaning o'zida solishtiriladi (tez, to'liq).
async function rowIntegrity(db, tables) {
    for (const [t, key] of Object.entries(tables)) {
        const bad = (await db.query(`SELECT x.${key}::text AS id, l.op, l.body_hash IS NULL AS unsealed FROM ${t} x
            LEFT JOIN LATERAL (SELECT op, body_hash FROM fin_row_seals s WHERE s.table_name=$1 AND s.row_id=x.${key}::text ORDER BY seq DESC LIMIT 1) l ON TRUE
            WHERE l.body_hash IS NULL OR l.op='D' OR l.body_hash <> encode(sha256(convert_to(fin_row_text($1, to_jsonb(x)),'UTF8')),'hex') LIMIT 1`, [t])).rows[0];
        if (bad) return { ok: false, table: t, rowId: bad.id, reason: bad.unsealed ? 'muhrsiz qator (trigger chetlab o‘tilgan)' : bad.op === 'D' ? 'o‘chirilgan qator qayta paydo bo‘lgan' : 'qator yashirincha o‘zgartirilgan' };
        const gone = (await db.query(`SELECT l.row_id FROM (SELECT DISTINCT ON (row_id) row_id, op FROM fin_row_seals WHERE table_name=$1 ORDER BY row_id, seq DESC) l
            WHERE l.op<>'D' AND NOT EXISTS (SELECT 1 FROM ${t} x WHERE x.${key}::text=l.row_id) LIMIT 1`, [t])).rows[0];
        if (gone) return { ok: false, table: t, rowId: gone.row_id, reason: 'qator yashirincha o‘chirilgan' };
    }
    return { ok: true };
}
// Yopilgan oy nusxasining xeshi o'z qatorida ham, o'sha oyni yopgan qulf qatorida ham (muhrlangan) bo'lishi va mos kelishi shart.
async function snapshotIntegrity(db) {
    const rows = (await db.query(`SELECT s.month, s.sha256, encode(sha256(convert_to(s.data::text,'UTF8')),'hex') AS actual,
        (SELECT l.snapshot_hashes->>s.month FROM fin_period_locks l WHERE l.snapshot_hashes ? s.month ORDER BY l.month DESC LIMIT 1) AS anchored FROM fin_period_snapshots s`)).rows;
    return rows.filter(r => r.sha256 !== r.actual || (r.anchored != null && r.anchored !== r.actual) || r.anchored == null).map(r => r.month);
}
const chainCache = { seq: 0, hash: '' };
async function chainIntegrity(db, full) {
    let prev = '', from = 0;
    if (!full && chainCache.seq) {
        const anchor = (await db.query('SELECT row_hash FROM fin_row_seals WHERE seq=$1', [chainCache.seq])).rows[0];
        if (anchor && anchor.row_hash === chainCache.hash) { prev = chainCache.hash; from = chainCache.seq; }
    }
    const seals = (await db.query('SELECT seq,table_name,row_id,op,body_hash,prev_hash,row_hash FROM fin_row_seals WHERE seq>$1 ORDER BY seq', [from])).rows;
    for (const s of seals) {
        if (s.prev_hash !== prev || sealHash(prev, s.table_name, s.row_id, s.op, s.body_hash) !== s.row_hash) { chainCache.seq = 0; return { ok: false, brokenAt: Number(s.seq), table: s.table_name, rowId: s.row_id, reason: 'muhr zanjiri uzilgan' }; }
        prev = s.row_hash; chainCache.seq = Number(s.seq); chainCache.hash = s.row_hash;
    }
    return { ok: true, head: prev, count: Number((await db.query('SELECT COUNT(*) AS n FROM fin_row_seals')).rows[0].n) };
}
async function integrity(db, { full = false } = {}) {
    const tables = await sealedTables(db);
    const chain = await chainIntegrity(db, full);
    if (!chain.ok) return { ...chain, badSnapshots: [] };
    const rows = await rowIntegrity(db, tables);
    const badSnapshots = await snapshotIntegrity(db);
    if (!rows.ok) return { ...rows, badSnapshots, head: chain.head, count: chain.count };
    if (badSnapshots.length) return { ok: false, table: 'fin_period_snapshots', rowId: badSnapshots[0], reason: 'muzlatilgan oy nusxasi xeshga mos emas', badSnapshots, head: chain.head, count: chain.count };
    return { ok: true, badSnapshots: [], head: chain.head, count: chain.count, unsealed: 0 };
}
async function quickSeals(db) { return integrity(db, { full: false }); }
async function verifySeals(db) { return integrity(db, { full: true }); }
// full=false: oldin tekshirilgan qism (o'zgarmasligi trigger bilan himoyalangan) qayta hisoblanmaydi, faqat yangi yozuvlar.
async function verifyAuditChain(db, { full = true } = {}) {
    let prev = '', count = 0, from = 0;
    if (!full && verified.id) {
        const anchor = (await db.query('SELECT hash FROM fin_audit WHERE id=$1', [verified.id])).rows[0];
        if (anchor && anchor.hash === verified.hash) { prev = verified.hash; count = verified.count; from = verified.id; }
    }
    const rows = (await db.query('SELECT id,action,entity_id,actor_id,actor_name,before_data,after_data,created_at,prev_hash,hash FROM fin_audit WHERE id>$1 ORDER BY id', [from])).rows;
    for (const r of rows) {
        const row = { action: r.action, entityId: r.entity_id, actorId: r.actor_id, actorName: r.actor_name, before: canonical(r.before_data), after: canonical(r.after_data), createdAt: new Date(r.created_at).toISOString() };
        // JSONB kalitlar tartibini o'zgartiradi, shuning uchun xesh tartiblangan kanonik shakldan hisoblanadi.
        // Xeshsiz yozuv ham zanjir uzilishi hisoblanadi.
        if (!r.hash || (r.prev_hash || '') !== prev || auditHash(prev, sortKeys(row)) !== r.hash) { verified.id = 0; return { ok: false, brokenAt: Number(r.id), count }; }
        prev = r.hash; count++;
        verified.id = Number(r.id); verified.hash = r.hash; verified.count = count;
    }
    return { ok: true, count, head: { id: verified.id || from, hash: prev } };
}
function sortKeys(v) { return Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v; }
function evidenceDir() {
    const base = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '../../data');
    const dir = path.join(base, 'finance-evidence');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}
async function requireEvidence(db, url, { required = false, label = 'Asos hujjat' } = {}) {
    if (!url) { if (required) throw error(400, label + 'ni yuklang (chek, bank ko‘chirmasi yoki audit ro‘yxati)'); return ''; }
    const m = EVIDENCE_RE.exec(String(url));
    if (!m) throw error(400, label + ' moliya bo‘limi orqali yuklangan bo‘lishi kerak');
    const row = (await db.query('SELECT file_name FROM fin_evidence WHERE id=$1', [m[1]])).rows[0];
    if (!row || !fs.existsSync(path.join(evidenceDir(), row.file_name))) throw error(400, label + ' fayli topilmadi. Qayta yuklang');
    return url;
}
function requestKey(value) { if (!/^[a-zA-Z0-9-]{16,80}$/.test(value || '')) throw error(400, 'So‘rov identifikatori noto‘g‘ri'); return value; }
function entity(value, allowCommon = true) {
    if (!ENTITY_VALUES.includes(value) || (!allowCommon && value === 'common')) throw error(400, 'Yo‘nalishni tanlang');
    return value;
}
function amountOf(value) { const n = F.money(value); if (!n) throw error(400, 'Summa musbat butun son bo‘lishi kerak'); return n; }
function dateOf(value, label = 'Sana') {
    const d = F.date(value); if (!d) throw error(400, label + ' noto‘g‘ri');
    if (d > F.today()) throw error(400, label + ' kelajakda bo‘lishi mumkin emas');
    return d;
}
// Oy yopish kumulyativ: eng oxirgi yopilgan oy va undan oldingilar yopiq.
async function closedThrough(db) { return (await db.query('SELECT MAX(month) AS m FROM fin_period_locks')).rows[0].m || ''; }
async function isClosed(db, day) { const m = await closedThrough(db); return !!m && F.monthOf(day) <= m; }
async function assertOpen(db, day, label = 'Bu sana') {
    const m = await closedThrough(db);
    if (m && F.monthOf(day) <= m) throw error(409, `${label} yopilgan davrga (${m} gacha yopilgan) tushadi. Tuzatishni ochiq oy sanasi bilan kiriting`);
}
async function accountRow(db, id, label = 'Hisob raqam') {
    const row = (await db.query('SELECT * FROM fin_accounts WHERE id=$1', [id])).rows[0];
    if (!row || !row.active) throw error(400, label + ' topilmadi yoki faol emas');
    return row;
}
async function settingsRow(db) { const r = (await db.query("SELECT data,revision FROM fin_settings WHERE id='main'")).rows[0]; return { data: F.settingsOf({ settings: r?.data || {} }), revision: r?.revision || 1 }; }
// ---------- Vazifalar ajratilishi (rahbar tasdig'i) ----------
// Xavfli amallar (qaytarish, tushumni bekor qilish/qo'shish, ta'sischiga to'lov) bo'yicha limit har bir amalga,
// bitta so'rov jamiga, bitta o'quvchiga va xodimning bir kunlik jamiga qo'llanadi — bo'lib chetlab o'tib bo'lmaydi.
async function dailyControlled(db, userId) {
    return Number((await db.query(`SELECT COALESCE(SUM((after_data->>'controlledAmount')::BIGINT),0) AS n FROM fin_audit
        WHERE actor_id=$1 AND after_data ? 'controlledAmount' AND (created_at AT TIME ZONE 'Asia/Tashkent')::date = (NOW() AT TIME ZONE 'Asia/Tashkent')::date`, [userId])).rows[0].n);
}
async function requireApproval(db, user, settings, amount, what) {
    if (user.director) return;
    const limit = Number(settings.approvalLimit) || 0;
    if (amount > limit) throw error(403, `${what}: ${fmt(amount)} so‘m — ${fmt(limit)} so‘mdan katta, faqat rahbar tomonidan`);
    const today = await dailyControlled(db, user.id);
    if (today + amount > limit) throw error(403, `${what}: bugungi jami (${fmt(today + amount)} so‘m) ${fmt(limit)} so‘mlik kunlik chegaradan oshadi — rahbar tasdig‘i kerak`);
}
// Barcha chiqimlar (xarajat, qaytarish, maosh, qarz qaytarish, kirimni storno qilish) bo'yicha xodimning kunlik jami.
async function dailyOutflow(db, userId) {
    return Number((await db.query(`SELECT COALESCE(SUM((after_data->>'outflowAmount')::BIGINT),0) AS n FROM fin_audit
        WHERE actor_id=$1 AND after_data ? 'outflowAmount' AND (created_at AT TIME ZONE 'Asia/Tashkent')::date = (NOW() AT TIME ZONE 'Asia/Tashkent')::date`, [userId])).rows[0].n);
}
async function requireOutflowApproval(db, user, settings, amount, what) {
    if (user.director) return;
    const limit = Number(settings.approvalLimit) || 0, daily = Number(settings.dailyLimit) || limit * 3;
    if (amount > limit) throw error(403, `${what}: ${fmt(amount)} so‘m — ${fmt(limit)} so‘mdan katta, faqat rahbar tomonidan`);
    const today = await dailyOutflow(db, user.id);
    if (today + amount > daily) throw error(403, `${what}: bugungi chiqimlaringiz jami ${fmt(today + amount)} so‘m — ${fmt(daily)} so‘mlik kunlik chegaradan oshadi, rahbar tasdig‘i kerak`);
}
// Pul hisobi (naqd, karta, bank) manfiyga tushmasligi kerak: chiqim sanasida ham, bugun ham.
async function assertNoOverdraft(db, user, accountId, day, amount) {
    const acc = (await db.query('SELECT kind,name FROM fin_accounts WHERE id=$1', [accountId])).rows[0];
    if (!acc || !F.EQUIVALENT_KINDS.has(acc.kind) || user.director) return;
    const data = await load(db);
    const at = d => F.accountBalances(data, d).find(a => a.id === accountId)?.balance || 0;
    const low = Math.min(at(day), at(F.today()));
    if (low - amount < 0) throw error(403, `${acc.name} qoldig‘i manfiyga tushadi (${fmt(low - amount)} so‘m). Boshlang‘ich qoldiq yoki kiritilmagan tushumni tekshiring; zarurat bo‘lsa rahbar kiritadi`);
}
function sameRequest(prior, fields) {
    for (const [k, v] of Object.entries(fields)) if (String(prior[k] ?? '') !== String(v ?? '')) throw error(409, 'Bu so‘rov identifikatori boshqa ma’lumot bilan ishlatilgan. Sahifani yangilab qayta kiriting');
}
function servicePeriod(body) {
    if (!body.serviceStart && !body.serviceEnd) return [null, null];
    const a = F.date(body.serviceStart), b = F.date(body.serviceEnd);
    if (!a || !b || b < a) throw error(400, 'Xizmat davri noto‘g‘ri (boshlanish va tugash sanasi)');
    if (F.dayDiff(a, b) > 1830) throw error(400, 'Xizmat davri 5 yildan oshmasin');
    return [a, b];
}
async function sumPaid(db, where, params) {
    return Number((await db.query(`SELECT COALESCE(SUM(CASE WHEN reverses_id IS NULL THEN amount ELSE -amount END),0) AS n FROM fin_transactions WHERE ${where}`, params)).rows[0].n);
}

// ---------- Ma'lumotni yig'ish ----------
function salaryCategory(role) {
    const r = String(role || '').toLowerCase();
    if (['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy', 'yordamchi'].includes(r)) return 'COS_TEACHERS';
    if (['sotuv-menejeri', 'sotuv_menejeri', 'sotuv menejeri', 'sales_manager', 'rop'].includes(r)) return 'PAY_SALES';
    return 'PAY_ADMIN';
}
async function load(db) {
    const accounts = (await db.query('SELECT * FROM fin_accounts ORDER BY sort,name')).rows.map(a => ({ id: a.id, entity: a.entity, name: a.name, kind: a.kind,
        methods: a.methods || [], openingBalance: Number(a.opening_balance), openingDate: a.opening_date ? toKey(a.opening_date) : '', active: a.active }));
    const receiptRows = (await db.query(`SELECT r.id,r.lead_id,r.student_id,r.language,r.manager_id,TO_CHAR(r.paid_date,'YYYY-MM-DD') AS paid_date,r.amount,r.method,
        r.receipt_url,r.form,r.source_key,r.snapshot,r.legacy_review,r.account_id,r.debt_snapshot,TO_CHAR(v.void_date,'YYYY-MM-DD') AS void_date,v.reason AS void_reason,
        cv.value AS contract_total
        FROM payment_records r LEFT JOIN payment_record_voids v ON v.record_id=r.id LEFT JOIN fin_contract_values cv ON cv.record_id=r.id
        ORDER BY r.paid_date,r.created_at,r.id`)).rows;
    const receipts = receiptRows.map(r => ({ id: r.id, entity: r.language, date: r.paid_date, amount: Number(r.amount), method: r.method, accountId: r.account_id || null,
        receiptUrl: r.receipt_url, form: r.form, name: r.snapshot?.name || '', phone: r.snapshot?.phone || '', managerId: r.manager_id, managerName: r.snapshot?.managerName || '',
        leadId: r.lead_id, studentId: r.student_id, legacyReview: r.legacy_review, correction: String(r.source_key).startsWith('correction:'),
        voidDate: r.void_date || '', voidReason: r.void_reason || '', contractValue: F.money(r.contract_total) || 0,
        // CRM tushum paytida qolgan qarzni yozadi; eski import va tuzatishlarda bu ishonchli emas.
        debtAfter: !r.legacy_review && !String(r.source_key).startsWith('correction:') && r.debt_snapshot != null ? Number(r.debt_snapshot) : null }));
    const transactions = (await db.query(`SELECT *,TO_CHAR(txn_date,'YYYY-MM-DD') AS d FROM fin_transactions ORDER BY txn_date,created_at`)).rows.map(t => ({
        id: t.id, entity: t.entity, date: t.d, type: t.type, categoryCode: t.category_code, accountId: t.account_id, toAccountId: t.to_account_id,
        amount: Number(t.amount), counterparty: t.counterparty, description: t.description, receiptUrl: t.receipt_url, payableId: t.payable_id,
        paymentRecordId: t.payment_record_id, salaryId: t.salary_id, reversesId: t.reverses_id, reversalReason: t.reversal_reason, legacy: t.legacy,
        usefulLifeMonths: t.useful_life_months, nonSalary: t.non_salary, terminates: t.terminates,
        serviceStart: t.service_start ? toKey(t.service_start) : '', serviceEnd: t.service_end ? toKey(t.service_end) : '', assetId: t.asset_id || null, actorName: t.actor_name, createdAt: t.created_at }));
    const reversed = new Set(transactions.filter(t => t.reversesId).map(t => t.reversesId));
    for (const t of transactions) t.reversed = reversed.has(t.id);
    const payables = (await db.query(`SELECT *,TO_CHAR(issue_date,'YYYY-MM-DD') AS i,TO_CHAR(due_date,'YYYY-MM-DD') AS d,
        TO_CHAR(void_date,'YYYY-MM-DD') AS vd FROM fin_payables ORDER BY issue_date`)).rows.map(p => ({
        id: p.id, entity: p.entity, kind: p.kind, counterparty: p.counterparty, description: p.description, categoryCode: p.category_code,
        amount: Number(p.amount), issueDate: p.i, dueDate: p.d || '', documentUrl: p.document_url, voided: !!p.vd, voidDate: p.vd || '', voidReason: p.void_reason || '',
        serviceStart: p.service_start ? toKey(p.service_start) : '', serviceEnd: p.service_end ? toKey(p.service_end) : '' }));
    const assetEvents = (await db.query("SELECT id,asset_id,kind,TO_CHAR(event_date,'YYYY-MM-DD') AS d,amount,reason,actor_name FROM fin_asset_events ORDER BY event_date")).rows
        .map(e => ({ id: e.id, assetId: e.asset_id, kind: e.kind, date: e.d, amount: Number(e.amount), reason: e.reason, actorName: e.actor_name }));
    const salaryRows = (await db.query(`SELECT s.id,s.employee_id,s.language,s.amount,s.status,TO_CHAR(s.period_start,'YYYY-MM-DD') AS ps,TO_CHAR(s.period_end,'YYYY-MM-DD') AS pe,
        s.paid_at,he.name,he.role FROM salary_transactions s LEFT JOIN hr_employees he ON he.id=s.employee_id ORDER BY s.period_end`).catch(() => ({ rows: [] }))).rows;
    const salaries = salaryRows.map(s => ({ id: s.id, entity: s.language, employeeId: s.employee_id, employeeName: s.name || s.employee_id, role: s.role || '',
        amount: Number(s.amount), status: s.status, periodStart: s.ps, periodEnd: s.pe, accrualDate: s.pe, categoryCode: salaryCategory(s.role),
        paidAt: s.paid_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date(s.paid_at)) : '' }));
    const receivables = [], studentStatus = [], studentDebts = [];
    // Holat birinchi marta qachon yozilgan (orqaga sanalashni aniqlash uchun).
    const recorded = new Map((await db.query(`SELECT student_id, MIN(TO_CHAR((recorded_at AT TIME ZONE 'Asia/Tashkent')::date,'YYYY-MM-DD')) FILTER (WHERE (state->>'frozen')::boolean OR state->>'status'='inactive') AS d
        FROM fin_student_log GROUP BY student_id`).catch(() => ({ rows: [] }))).rows.map(r => [r.student_id, r.d]));
    for (const s of (await db.query(`SELECT id,name,phone,subject,extra_data FROM students`)).rows) {
        const x = s.extra_data || {};
        if (x.isStaffDemo || !['english', 'russian'].includes(s.subject)) continue;
        if (x.paymentLedgerManaged && F.money(x.debtAmount) != null) studentDebts.push({ studentId: s.id, leadId: x.leadRef?.id || '', debt: F.money(x.debtAmount) });
        if (x.frozen || x.status === 'inactive')
            studentStatus.push({ studentId: s.id, leadId: x.leadRef?.id || '', recordedAt: recorded.get(s.id) || null, frozenAt: x.frozen ? F.date(String(x.frozenAt || '').slice(0, 10)) : null,
                inactive: x.status === 'inactive', inactiveAt: x.status === 'inactive' ? F.date(String(x.inactiveAt || x.leftAt || '').slice(0, 10)) : null });
        const debt = F.money(x.debtAmount) || 0;
        if (debt <= 0) continue;
        receivables.push({ studentId: s.id, entity: s.subject, name: s.name, phone: s.phone, debt, dueDate: x.paymentDueDate || '', status: x.status || '', frozen: !!x.frozen,
            managerName: x.managerName || '', leadId: x.leadRef?.id || '' });
    }
    const accountChecks = (await db.query(`SELECT account_id,TO_CHAR(check_date,'YYYY-MM-DD') AS d,actual_balance,note,actor_name,created_at FROM fin_account_checks ORDER BY check_date,created_at`)).rows
        .map(c => ({ accountId: c.account_id, date: c.d, actualBalance: Number(c.actual_balance), note: c.note, actorName: c.actor_name, createdAt: c.created_at }));
    const s = await settingsRow(db);
    const locks = (await db.query("SELECT month,locked_by_name,note,locked_at FROM fin_period_locks ORDER BY month")).rows;
    // Xeshi mos kelmagan (bazada o'zgartirilgan) nusxa ishlatilmaydi — hisobot joriy ma'lumotdan tuziladi va ogohlantiriladi.
    const snapRows = (await db.query(`SELECT s.month, s.data, (s.sha256 IS NOT DISTINCT FROM encode(sha256(convert_to(s.data::text,'UTF8')),'hex')
        AND EXISTS (SELECT 1 FROM fin_period_locks l WHERE l.snapshot_hashes->>s.month = encode(sha256(convert_to(s.data::text,'UTF8')),'hex'))) AS intact FROM fin_period_snapshots s`)).rows;
    const snapshots = Object.fromEntries(snapRows.filter(r => r.intact).map(r => [r.month, r.data]));
    const snapshotIssues = snapRows.filter(r => !r.intact).map(r => r.month);
    const settingsHistory = (await db.query("SELECT TO_CHAR(effective_from,'YYYY-MM-DD') AS f,data FROM fin_settings_history ORDER BY effective_from,id")).rows.map(r => ({ from: r.f, data: r.data }));
    return { accounts, receipts, transactions, payables, salaries, receivables, studentStatus, studentDebts, settingsHistory, assetEvents, accountChecks, settings: s.data, settingsRevision: s.revision, locks,
        closedThrough: locks.map(l => l.month).sort().at(-1) || '', snapshots, snapshotIssues };
}
function period(q) {
    const end = F.date(q.end) || F.today();
    const start = F.date(q.start) || F.monthOf(end) + '-01';
    if (start > end) throw error(400, 'Boshlanish sanasi tugash sanasidan keyin bo‘lmasligi kerak');
    if (F.dayDiff(start, end) > 3700) throw error(400, 'Davr 10 yildan oshmasin');
    return { start, end, scope: ['english', 'russian', 'all'].includes(q.scope) ? q.scope : 'all', basis: q.basis === 'accrual' ? 'accrual' : 'cash' };
}

async function overview(pool, actor, q) {
    return read(pool, async db => {
        const user = await access(db, actor);
        const data = await load(db), p = period(q);
        const monthsStart = F.monthOf(F.addMonths(p.end, -5)) + '-01';
        const quality = F.dataQuality(data.receipts, data.settings);
        const scoped = r => p.scope === 'all' || r.entity === p.scope;
        const paidSalaryWithoutCash = data.salaries.filter(s => s.status === 'paid' && s.amount > 0
            && data.transactions.filter(t => t.salaryId === s.id).reduce((n, t) => n + (t.reversesId ? -1 : 1) * t.amount, 0) < s.amount);
        const firstDate = [...data.receipts.map(r => r.date), ...data.transactions.map(t => t.date)].filter(Boolean).sort()[0] || F.today();
        const nextMonth = data.closedThrough ? F.monthOf(F.addMonths(data.closedThrough + '-01', 1)) : F.monthOf(F.addMonths(F.monthOf(F.today()) + '-01', -1));
        return {
            period: p, user: { role: user.role, director: user.director },
            accounts: F.accountBalances(data, p.end, p.scope),
            balance: F.balanceSheet(data, p.end, 'all'),
            pnl: F.profitAndLoss(data, p),
            pnlOther: F.profitAndLoss(data, { ...p, basis: p.basis === 'cash' ? 'accrual' : 'cash' }),
            monthly: F.monthlyPnl(data, { start: monthsStart < p.start ? monthsStart : p.start, end: p.end, scope: p.scope, basis: p.basis }),
            cashflow: F.cashFlowStatement(data, p),
            receivables: F.receivablesAging(data.receivables, F.today(), p.scope),
            payables: F.payablesSummary(data, p.end, p.scope),
            kpis: F.kpis(data, p),
            quality: { ...quality, suspicious: quality.suspicious.filter(scoped), paidSalaryWithoutCash: paidSalaryWithoutCash.filter(scoped), voidedList: data.receipts.filter(r => r.voidDate && scoped(r)) },
            settings: data.settings, settingsRevision: data.settingsRevision, locks: data.locks, closedThrough: data.closedThrough, firstDate,
            closeCandidate: { month: nextMonth, issues: F.monthEnd(nextMonth) < F.today() ? closeReadiness(data, nextMonth) : null },
            contractDebtMismatches: F.contractDebtMismatches(data, p.end).slice(0, 200),
            studentChanges: (await db.query(`SELECT l.student_id, s.name, l.state, l.recorded_at, l.app_user FROM fin_student_log l LEFT JOIN students s ON s.id=l.student_id
                ORDER BY l.id DESC LIMIT 100`)).rows,
            assets: F.fixedAssets(data).filter(a => p.scope === 'all' || a.entity === p.scope || a.entity === 'common').map(a => ({ ...a, depreciation: F.depreciationAt(a, p.end), impairmentLoss: F.impairmentAt(a, p.end),
                nbv: a.disposedAt && a.disposedAt <= p.end ? 0 : F.netBookValue(a, p.end) })),
            auditChain: await verifyAuditChain(db, { full: false }), seals: await quickSeals(db), accountsList: data.accounts, categories: F.CATEGORIES
        };
    });
}
async function cashbook(pool, actor, q) {
    return read(pool, async db => {
        await access(db, actor);
        const data = await load(db), p = period(q);
        if (F.dayDiff(p.start, p.end) > 400) throw error(400, 'Kassa daftari uchun davr 400 kundan oshmasin');
        return F.cashbook(data, { start: p.start, end: p.end, account: text(q.account, 80), scope: p.scope });
    });
}
async function listTransactions(pool, actor, q) {
    return read(pool, async db => {
        await access(db, actor);
        const data = await load(db), p = period(q);
        const rows = data.transactions.filter(t => F.inRange(t.date, p.start, p.end) && (p.scope === 'all' || t.entity === p.scope));
        return { rows: rows.reverse(), accounts: data.accounts, payables: data.payables.filter(x => !x.voided), categories: F.CATEGORIES };
    });
}
async function auditLog(pool, actor, q) {
    return read(pool, async db => {
        await access(db, actor);
        const limit = Math.min(2000, Math.max(1, Number(q.limit) || 200));
        const params = [limit], where = [];
        if (q.action) { params.push(String(q.action)); where.push(`action=$${params.length}`); }
        const rows = (await db.query(`SELECT id,action,entity_id,actor_name,before_data,after_data,created_at FROM fin_audit ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT $1`, params)).rows;
        return { rows, chain: await verifyAuditChain(db), seals: await verifySeals(db) };
    });
}
async function people(pool, actor, q) {
    return read(pool, async db => {
        await access(db, actor);
        const lang = entity(q.entity, false), term = text(q.q, 80);
        if (term.length < 2) return { rows: [] };
        const digits = term.replace(/\D/g, '');
        const like = '%' + term.toLowerCase().replace(/[\\%_]/g, ch => '\\' + ch) + '%', phoneLike = digits.length >= 4 ? '%' + digits.slice(-9) + '%' : '__none__';
        const students = (await db.query(`SELECT id,name,phone,extra_data->'leadRef'->>'id' AS lead_id FROM students WHERE subject=$1 AND (LOWER(name) LIKE $2 OR REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') LIKE $3) LIMIT 15`, [lang, like, phoneLike])).rows;
        const leads = (await db.query(`SELECT id,name,phone,manager_id,status FROM leads WHERE language=$1 AND deleted_at IS NULL AND (LOWER(name) LIKE $2 OR REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') LIKE $3) LIMIT 15`, [lang, like, phoneLike])).rows;
        return { rows: [...students.map(s => ({ kind: 'student', studentId: s.id, leadId: s.lead_id || null, name: s.name, phone: s.phone })),
            ...leads.filter(l => !students.some(s => s.lead_id === l.id)).map(l => ({ kind: 'lead', leadId: l.id, studentId: null, name: l.name, phone: l.phone, managerId: l.manager_id, status: l.status }))] };
    });
}

// ---------- Hujjatlar (dalillar): faqat avtorizatsiya bilan o'qiladi ----------
async function storeEvidence(pool, actor, file) {
    if (!file || !file.buffer) throw error(400, 'Fayl tanlanmagan');
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(ext) || !/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.mimetype || '')) throw error(400, 'Faqat PDF yoki rasm (PNG, JPG, WEBP)');
    if (file.buffer.length > 15 * 1024 * 1024) throw error(400, 'Fayl 15 MB dan oshmasin');
    // Fayl mazmuni ham tekshiriladi (kengaytma va e'lon qilingan tur yetarli emas).
    const b = file.buffer, magic = { '.pdf': b.slice(0, 5).toString('latin1') === '%PDF-', '.png': b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        '.jpg': b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, '.jpeg': b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
        '.webp': b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' };
    if (!magic[ext]) throw error(400, 'Fayl mazmuni uning turiga mos emas');
    const sha = createHash('sha256').update(b).digest('hex');
    const id = randomUUID(), fileName = id + ext, dir = evidenceDir(), tmp = path.join(dir, '.' + fileName + '.tmp');
    fs.writeFileSync(tmp, b);
    try {
        return await transaction(pool, async db => {
            const user = await access(db, actor);
            await db.query('INSERT INTO fin_evidence(id,file_name,original_name,mime,size,sha256,uploaded_by,uploaded_by_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
                [id, fileName, text(file.originalname, 200), file.mimetype, b.length, sha, user.id, user.name]);
            await audit(db, user, 'evidence-upload', id, null, { name: text(file.originalname, 200), size: b.length, sha256: sha });
            // Fayl faqat yozuv saqlanganda doimiy nomini oladi: xatoda yetim fayl qolmaydi.
            fs.renameSync(tmp, path.join(dir, fileName));
            return { url: '/api/finance/evidence/' + id, sha256: sha };
        });
    } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
async function readEvidence(pool, actor, id) {
    return read(pool, async db => {
        await access(db, actor);
        const row = (await db.query('SELECT * FROM fin_evidence WHERE id=$1', [String(id)])).rows[0];
        if (!row) throw error(404, 'Hujjat topilmadi');
        const file = path.join(evidenceDir(), row.file_name);
        if (!fs.existsSync(file)) throw error(410, 'Hujjat fayli topilmadi');
        // Saqlangan xesh bilan solishtiriladi: diskda almashtirilgan fayl berilmaydi.
        if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== row.sha256) throw error(409, 'Hujjat fayli o‘zgartirilgan (xesh mos emas)');
        return { path: file, mime: row.mime, name: row.original_name };
    });
}

// ---------- Operatsiyalar ----------
async function createTransaction(pool, actor, body) {
    const key = requestKey(body.requestKey);
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const prior = (await db.query("SELECT id,type,amount,category_code,account_id,TO_CHAR(txn_date,'YYYY-MM-DD') AS d FROM fin_transactions WHERE request_key=$1", [key])).rows[0];
        if (prior) {
            sameRequest(prior, { type: body.type, amount: F.money(body.amount), category_code: body.categoryCode, account_id: body.accountId, d: F.date(body.date) });
            return { id: prior.id, duplicate: true };
        }
        const settings = (await settingsRow(db)).data;
        const type = body.type;
        if (body.categoryCode === 'ASSET_SALE') throw error(400, 'Asosiy vositani sotish “Asosiy vositalar” reestri orqali kiritiladi');
        if (!Object.hasOwn(F.TYPES, type)) throw error(400, 'Operatsiya turini tanlang');
        const cat = F.CATEGORY[body.categoryCode];
        if (!cat || cat.type !== type || body.categoryCode === 'TAX') throw error(400, 'Bu operatsiya turi uchun toifa noto‘g‘ri');
        let ent = entity(body.entity);
        const day = dateOf(body.date);
        await assertOpen(db, day);
        const amount = amountOf(body.amount);
        const account = await accountRow(db, body.accountId);
        let toAccount = null;
        if (type === 'transfer') toAccount = await accountRow(db, body.toAccountId, 'Qabul qiluvchi hisob');
        const counterparty = text(body.counterparty, 200), description = text(body.description, 1000);
        if (type !== 'transfer' && !counterparty) throw error(400, 'Kimga / kimdan ekanini yozing');
        const needEvidence = ['refund', 'drawing'].includes(type) || (type === 'expense' && amount >= 1000000);
        const receiptUrl = await requireEvidence(db, body.receiptUrl, { required: needEvidence, label: 'Chek yoki hujjat' });
        // Qaytarish va ta'sischiga to'lov hujjati bir marta ishlatiladi (bitta chek bilan ikki marta pul chiqarib bo'lmaydi).
        // Bitta hujjat bilan bir necha marta pul chiqarib bo'lmaydi (bitta hisob-fakturani bo'lib to'lash bundan mustasno).
        if (receiptUrl && ['expense', 'refund', 'drawing', 'loan_repay'].includes(type) && (await db.query(`SELECT 1 FROM fin_transactions t WHERE receipt_url=$1 AND type IN ('expense','refund','drawing','loan_repay')
            AND reverses_id IS NULL AND salary_id IS NULL AND (payable_id IS NULL OR payable_id IS DISTINCT FROM $2) AND request_key NOT LIKE '%-fee'
            AND NOT EXISTS (SELECT 1 FROM fin_transactions r WHERE r.reverses_id=t.id)`, [receiptUrl, body.payableId || null])).rows.length) throw error(409, 'Bu hujjat boshqa chiqim uchun ishlatilgan. Har bir pul chiqimi uchun alohida hujjat yuklang');
        const [serviceStart, serviceEnd] = type === 'expense' ? servicePeriod(body) : [null, null];
        let payableId = null, paymentRecordId = null, nonSalary = false;
        if (cat.payroll) {
            // Maosh "Maoshlar" bo'limida hisoblanadi; bu yerda qo'lda kiritish faqat ataylab belgilansa (ikki marta hisoblanmasligi uchun).
            if (!body.nonSalary) throw error(400, 'Maosh to‘lovlari “Maoshlar” bo‘limi orqali yuritiladi. Bir martalik to‘lov bo‘lsa, “maosh tizimidan tashqari” belgisini qo‘ying');
            nonSalary = true;
        }
        if (type === 'refund') {
            if (!body.paymentRecordId) throw error(400, 'Qaysi tushum qaytarilayotganini tanlang');
            const rec = (await db.query(`SELECT r.*,v.record_id AS voided FROM payment_records r LEFT JOIN payment_record_voids v ON v.record_id=r.id WHERE r.id=$1`, [body.paymentRecordId])).rows[0];
            if (!rec || rec.voided) throw error(400, 'Qaytariladigan tushum topilmadi');
            const refunded = await sumPaid(db, `payment_record_id=$1 AND type='refund'`, [rec.id]);
            if (refunded + amount > Number(rec.amount)) throw error(409, 'Qaytarish summasi tushumdan oshib ketdi');
            // Limit o'quvchi (shartnoma) bo'yicha jami qaytarishga ham qo'llanadi: bir nechta tushumga bo'lib chetlab o'tib bo'lmaydi.
            const studentRefunded = await sumPaid(db, `type='refund' AND payment_record_id IN (SELECT id FROM payment_records WHERE (lead_id IS NOT NULL AND lead_id=$1) OR (student_id IS NOT NULL AND student_id=$2))`, [rec.lead_id, rec.student_id]);
            if (studentRefunded + amount > settings.approvalLimit && !user.director) throw error(403, `Bu o‘quvchi bo‘yicha jami qaytarish ${fmt(studentRefunded + amount)} so‘m — ${fmt(settings.approvalLimit)} so‘mdan oshadi, faqat rahbar tomonidan`);
            if (!F.EQUIVALENT_KINDS.has(account.kind)) throw error(400, 'Qaytarish naqd, karta yoki bank hisobidan to‘lanadi (Uzum orqali bekor qilingan sotuv Uzum hisob-kitobida kamayadi)');
            if (typeof body.terminates !== 'boolean') throw error(400, 'Shartnoma tugatiladimi (o‘quvchi o‘qishni to‘xtatdimi) yoki faqat ortiqcha to‘lov qaytarilyaptimi — belgilang');
            paymentRecordId = rec.id; ent = rec.language;
        }
        if (type === 'loan_repay' || (body.payableId && type !== 'loan_in')) {
            const p = (await db.query('SELECT * FROM fin_payables WHERE id=$1', [body.payableId])).rows[0];
            if (!p || p.voided_at) throw error(400, 'Qarz / hisob-faktura topilmadi');
            if (type === 'loan_repay' && p.kind !== 'loan') throw error(400, 'Bu yozuv qarz emas');
            if (type === 'expense' && p.category_code !== cat.code) throw error(400, 'Toifa hisob-faktura toifasiga mos emas');
            const paid = await sumPaid(db, `payable_id=$1 AND type<>'loan_in'`, [p.id]);
            if (paid + amount > Number(p.amount)) throw error(409, `To‘lov qoldiqdan oshib ketdi (qoldiq: ${Number(p.amount) - paid})`);
            payableId = p.id; ent = p.entity;
        }
        let usefulLife = null;
        if (cat.code === 'CAPEX') { usefulLife = Number(body.usefulLifeMonths || settings.usefulLifeMonths); if (!Number.isInteger(usefulLife) || usefulLife < 1 || usefulLife > 240) throw error(400, 'Foydalanish muddati 1–240 oy'); }
        const fee = type === 'transfer' && body.feeAmount ? amountOf(body.feeAmount) : 0;
        // Uzum (kliring) hisob-kitobi qaysi maktab o'quvchilari uchun ekanini ko'rsatishi shart.
        if (type === 'transfer' && account.kind === 'clearing' && !['english', 'russian'].includes(ent)) throw error(400, 'Uzum to‘lovi qaysi maktab (ingliz / rus) o‘quvchilari uchun ekanini tanlang');
        // Kliring hisobiga pul o'tkazilmaydi (u faqat Uzum orqali sotuvdan to'ladi) va undan qarzdan ortiq yechilmaydi.
        if (type === 'transfer' && toAccount.kind === 'clearing') throw error(400, 'Uzum kliring hisobiga o‘tkazma qilinmaydi — u faqat Uzum orqali qilingan sotuvlardan to‘ladi');
        if (account.kind === 'clearing' && ['transfer', 'expense'].includes(type)) {
            const data = await load(db), entBal = d => F.accountBalances(data, d, ent).find(a => a.id === account.id)?.balance || 0;
            const owed = Math.min(entBal(day), entBal(F.today()));
            if (amount + fee > owed) throw error(409, `Uzum bu maktab uchun ${fmt(owed)} so‘m qarzdor — undan ko‘p hisob-kitob yozib bo‘lmaydi`);
        }
        // Vazifalar ajratilishi: katta chiqimlar, qarz olish va ta'sischiga to'lov — rahbar; xavfli amallar — kunlik jami ham.
        const isOutflow = ['expense', 'refund', 'drawing', 'loan_repay'].includes(type);
        if (type === 'transfer') await requireOutflowApproval(db, user, settings, amount + fee, 'O‘tkazma');
        if (['refund', 'drawing'].includes(type)) await requireApproval(db, user, settings, amount, type === 'refund' ? 'Qaytarish' : 'Ta’sischiga to‘lov');
        if (isOutflow) await requireOutflowApproval(db, user, settings, amount, F.TYPES[type]);
        else if (['loan_in', 'income', 'capital'].includes(type) && amount + fee > settings.approvalLimit && !user.director)
            throw error(403, `${F.TYPES[type]}: ${fmt(amount + fee)} so‘m — ${fmt(settings.approvalLimit)} so‘mdan katta, faqat rahbar tomonidan`);
        if (!['income', 'capital', 'loan_in'].includes(type)) await assertNoOverdraft(db, user, account.id, day, amount + fee);
        const id = randomUUID();
        if (type === 'loan_in') {
            payableId = randomUUID();
            await db.query(`INSERT INTO fin_payables(id,entity,kind,counterparty,description,category_code,amount,issue_date,due_date,document_url,actor_id,actor_name)
                VALUES($1,$2,'loan',$3,$4,'LOAN_REPAY',$5,$6,$7,$8,$9,$10)`, [payableId, ent, counterparty, description, amount, day, F.date(body.dueDate) || null, receiptUrl, user.id, user.name]);
        }
        await db.query(`INSERT INTO fin_transactions(id,request_key,entity,txn_date,type,category_code,account_id,to_account_id,amount,counterparty,description,receipt_url,
            payable_id,payment_record_id,useful_life_months,non_salary,terminates,service_start,service_end,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
            [id, key, ent, day, type, cat.code, account.id, toAccount?.id || null, amount, counterparty, description, receiptUrl, payableId, paymentRecordId, usefulLife, nonSalary,
                type === 'refund' && body.terminates === true, serviceStart, serviceEnd, user.id, user.name]);
        if (fee) {
            // Uzum / to'lov tizimi hisob-kitobi: bankka sof summa tushadi, komissiya kliring hisobidan xarajat bo'ladi.
            await db.query(`INSERT INTO fin_transactions(id,request_key,entity,txn_date,type,category_code,account_id,amount,counterparty,description,receipt_url,actor_id,actor_name)
                VALUES($1,$2,$3,$4,'expense','BANK_FEES',$5,$6,$7,$8,$9,$10,$11)`, [randomUUID(), key.slice(0, 70) + '-fee', ent, day, account.id, fee, account.name, 'Komissiya' + (description ? ': ' + description : ''), receiptUrl, user.id, user.name]);
        }
        await audit(db, user, 'transaction-create', id, null, { type, category: cat.code, entity: ent, date: day, amount, fee, terminates: type === 'refund' ? body.terminates === true : undefined,
            controlledAmount: ['refund', 'drawing'].includes(type) && !user.director ? amount : undefined, outflowAmount: (isOutflow || type === 'transfer') && !user.director ? amount + fee : undefined, serviceStart, serviceEnd, account: account.id, toAccount: toAccount?.id || null, payableId, paymentRecordId, counterparty, description, receiptUrl });
        return { id, duplicate: false };
    });
}
async function reverseTransaction(pool, actor, id, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const t = (await db.query("SELECT *,TO_CHAR(txn_date,'YYYY-MM-DD') AS d FROM fin_transactions WHERE id=$1", [id])).rows[0];
        if (!t) throw error(404, 'Operatsiya topilmadi');
        if (t.reverses_id) throw error(400, 'Storno yozuvini qayta storno qilib bo‘lmaydi');
        if ((await db.query('SELECT 1 FROM fin_transactions WHERE reverses_id=$1', [id])).rows.length) throw error(409, 'Bu operatsiya allaqachon bekor qilingan');
        const reason = text(body.reason, 500);
        if (reason.length < 5) throw error(400, 'Bekor qilish sababini yozing (kamida 5 belgi)');
        const day = dateOf(F.date(body.date) || (await isClosed(db, t.d) ? F.today() : t.d), 'Storno sanasi');
        if (day < t.d) throw error(400, 'Storno sanasi asl operatsiyadan oldin bo‘lmaydi');
        await assertOpen(db, day, 'Storno sanasi');
        const settings = (await settingsRow(db)).data;
        if (Number(t.amount) > settings.approvalLimit && !user.director) throw error(403, `${settings.approvalLimit} so‘mdan katta operatsiyani storno qilish faqat rahbar tomonidan`);
        if (t.category_code === 'ASSET_SALE') throw error(400, 'Asosiy vositani sotish storno qilinmaydi — kerak bo‘lsa rahbar bilan alohida tuzatish yozing');
        if (t.category_code === 'CAPEX' && (await db.query('SELECT 1 FROM fin_asset_events WHERE asset_id=$1', [t.id])).rows.length) throw error(409, 'Bu aktiv bo‘yicha sotish/qadrsizlanish yozilgan — xaridni storno qilib bo‘lmaydi');
        if (t.type === 'loan_in') {
            if (await sumPaid(db, `payable_id=$1 AND type='loan_repay'`, [t.payable_id]) > 0) throw error(409, 'Bu qarz bo‘yicha qaytarish bor. Avval qaytarishlarni bekor qiling');
            await db.query('UPDATE fin_payables SET voided_at=NOW(),void_reason=$2,voided_by=$3,void_date=$4 WHERE id=$1', [t.payable_id, 'Olingan qarz bekor qilindi: ' + reason, user.id, day]);
        }
        // Kirimni (tushum, kapital, qarz) storno qilish puldan chiqim — kunlik chegara va qoldiq tekshiriladi.
        const outflowReversal = ['income', 'capital', 'loan_in', 'transfer'].includes(t.type);
        if (outflowReversal) {
            await requireOutflowApproval(db, user, settings, Number(t.amount), t.type === 'transfer' ? 'O‘tkazmani storno qilish' : 'Kirimni storno qilish');
            await assertNoOverdraft(db, user, t.type === 'transfer' ? t.to_account_id : t.account_id, day, Number(t.amount));
        }
        const rid = randomUUID();
        await db.query(`INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,to_account_id,amount,counterparty,description,receipt_url,payable_id,
            payment_record_id,salary_id,reverses_id,reversal_reason,useful_life_months,non_salary,terminates,service_start,service_end,asset_id,actor_id,actor_name)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
            [rid, t.entity, day, t.type, t.category_code, t.account_id, t.to_account_id, t.amount, t.counterparty, 'STORNO: ' + reason, t.receipt_url,
                t.type === 'loan_in' ? null : t.payable_id, t.payment_record_id, t.salary_id, t.id, reason, t.useful_life_months, t.non_salary, t.terminates,
                t.service_start ? toKey(t.service_start) : null, t.service_end ? toKey(t.service_end) : null, t.asset_id, user.id, user.name]);
        // O'tkazma bilan birga yozilgan komissiya ham storno qilinadi.
        let feeReversal = null;
        if (t.type === 'transfer' && t.request_key) {
            const fee = (await db.query(`SELECT * FROM fin_transactions f WHERE request_key=$1 AND NOT EXISTS (SELECT 1 FROM fin_transactions r WHERE r.reverses_id=f.id)`, [t.request_key.slice(0, 70) + '-fee'])).rows[0];
            if (fee) {
                feeReversal = randomUUID();
                await db.query(`INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,amount,counterparty,description,receipt_url,reverses_id,reversal_reason,actor_id,actor_name)
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [feeReversal, fee.entity, day, fee.type, fee.category_code, fee.account_id, fee.amount, fee.counterparty, 'STORNO: ' + reason, fee.receipt_url, fee.id, reason, user.id, user.name]);
            }
        }
        await audit(db, user, 'transaction-reverse', t.id, { amount: Number(t.amount), date: t.d, type: t.type }, { reversalId: rid, feeReversalId: feeReversal, date: day, reason, outflowAmount: outflowReversal && !user.director ? Number(t.amount) : undefined });
        return { id: rid };
    });
}
async function createPayable(pool, actor, body) {
    const key = requestKey(body.requestKey);
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const prior = (await db.query("SELECT id,amount,counterparty,TO_CHAR(issue_date,'YYYY-MM-DD') AS i FROM fin_payables WHERE request_key=$1", [key])).rows[0];
        if (prior) { sameRequest(prior, { amount: F.money(body.amount), counterparty: text(body.counterparty, 200), i: F.date(body.issueDate) }); return { id: prior.id, duplicate: true }; }
        const kind = ['bill', 'other'].includes(body.kind) ? body.kind : 'bill';
        const [serviceStart, serviceEnd] = servicePeriod(body);
        const cat = F.CATEGORY[body.categoryCode];
        if (!cat || cat.type !== 'expense' || cat.payroll || cat.code === 'CAPEX' || body.categoryCode === 'TAX') throw error(400, 'Xarajat toifasini tanlang (maosh va kapital xarajat bu yerda kiritilmaydi)');
        const counterparty = text(body.counterparty, 200);
        if (!counterparty) throw error(400, 'Kimga qarzdorligimizni yozing');
        const issue = dateOf(body.issueDate, 'Hujjat sanasi');
        await assertOpen(db, issue, 'Hujjat sanasi');
        const due = body.dueDate ? F.date(body.dueDate) : null;
        if (body.dueDate && !due) throw error(400, 'To‘lov muddati noto‘g‘ri');
        if (due && due < issue) throw error(400, 'To‘lov muddati hujjat sanasidan oldin bo‘lmaydi');
        const id = randomUUID(), amount = amountOf(body.amount), ent = entity(body.entity);
        const settings = (await settingsRow(db)).data;
        if (amount > settings.approvalLimit && !user.director) throw error(403, `${fmt(settings.approvalLimit)} so‘mdan katta hisob-fakturani faqat rahbar kiritadi`);
        const documentUrl = await requireEvidence(db, body.documentUrl, { label: 'Hisob-faktura hujjati', required: amount >= 1000000 });
        await db.query(`INSERT INTO fin_payables(id,request_key,entity,kind,counterparty,description,category_code,amount,issue_date,due_date,document_url,service_start,service_end,actor_id,actor_name)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [id, key, ent, kind, counterparty, text(body.description, 1000), cat.code, amount, issue, due, documentUrl, serviceStart, serviceEnd, user.id, user.name]);
        await audit(db, user, 'payable-create', id, null, { kind, entity: ent, counterparty, category: cat.code, amount, issue, due, documentUrl, serviceStart, serviceEnd });
        return { id, duplicate: false };
    });
}
async function voidPayable(pool, actor, id, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const p = (await db.query("SELECT *,TO_CHAR(issue_date,'YYYY-MM-DD') AS i FROM fin_payables WHERE id=$1", [id])).rows[0];
        if (!p || p.voided_at) throw error(404, 'Yozuv topilmadi');
        if (p.kind === 'loan') throw error(400, 'Qarzni bekor qilish uchun olingan qarz operatsiyasini storno qiling');
        const reason = text(body.reason, 500); if (reason.length < 5) throw error(400, 'Sababini yozing');
        if (await sumPaid(db, `payable_id=$1 AND type<>'loan_in'`, [id]) > 0) throw error(409, 'Bu hujjat bo‘yicha to‘lov qilingan. Avval to‘lovni storno qiling');
        // Bekor qilish sanasi: ochiq davrda; hujjat sanasi yopiq bo'lsa — bugun (yopilgan oy o'zgarmaydi).
        const voidDate = dateOf(F.date(body.date) || (await isClosed(db, p.i) ? F.today() : p.i), 'Bekor qilish sanasi');
        if (voidDate < p.i) throw error(400, 'Bekor qilish sanasi hujjat sanasidan oldin bo‘lmaydi');
        await assertOpen(db, voidDate, 'Bekor qilish sanasi');
        await db.query('UPDATE fin_payables SET voided_at=NOW(),void_reason=$2,voided_by=$3,void_date=$4 WHERE id=$1', [id, reason, user.id, voidDate]);
        await audit(db, user, 'payable-void', id, { amount: Number(p.amount) }, { reason, voidDate });
        return { ok: true };
    });
}
async function recordSalaryPayment(pool, actor, salaryId, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const s = (await db.query(`SELECT s.*,he.name,he.role FROM salary_transactions s LEFT JOIN hr_employees he ON he.id=s.employee_id WHERE s.id=$1`, [salaryId])).rows[0];
        if (!s) throw error(404, 'Maosh hisobi topilmadi');
        if (s.status !== 'paid') throw error(409, 'Avval Maoshlar bo‘limida hisobni tasdiqlab, “To‘landi” deb belgilang');
        if (Number(s.amount) <= 0) throw error(400, 'Nol yoki manfiy maosh uchun chiqim yozilmaydi');
        const already = await sumPaid(db, 'salary_id=$1', [salaryId]);
        if (already >= Number(s.amount)) {
            const prior = (await db.query('SELECT id FROM fin_transactions WHERE salary_id=$1 AND reverses_id IS NULL ORDER BY created_at DESC LIMIT 1', [salaryId])).rows[0];
            return { id: prior?.id, duplicate: true };
        }
        const day = dateOf(body.date || (s.paid_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date(s.paid_at)) : F.today()));
        await assertOpen(db, day);
        const account = await accountRow(db, body.accountId);
        if (!F.EQUIVALENT_KINDS.has(account.kind)) throw error(400, 'Maosh naqd, karta yoki bank hisobidan to‘lanadi');
        // Ikki kishi nazorati: maoshni "to'landi" deb tasdiqlagan xodim kassadan chiqimni o'zi yozmaydi.
        if (!user.director && s.paid_by && s.paid_by === user.id) throw error(403, 'Maoshni tasdiqlagan xodim kassadan chiqimni o‘zi yoza olmaydi — boshqa moliya xodimi yoki rahbar');
        const pay = Number(s.amount) - already, settings = (await settingsRow(db)).data;
        await requireOutflowApproval(db, user, settings, pay, 'Maosh to‘lovi');
        await assertNoOverdraft(db, user, account.id, day, pay);
        const id = randomUUID();
        await db.query(`INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,amount,counterparty,description,salary_id,actor_id,actor_name)
            VALUES($1,$2,$3,'expense',$4,$5,$6,$7,$8,$9,$10,$11)`, [id, s.language, day, salaryCategory(s.role), account.id, Number(s.amount) - already, s.name || s.employee_id,
            `Maosh ${toKey(s.period_start)} — ${toKey(s.period_end)}`, salaryId, user.id, user.name]);
        await audit(db, user, 'salary-cash-out', id, null, { salaryId, amount: pay, date: day, account: account.id, outflowAmount: user.director ? undefined : pay });
        return { id, duplicate: false };
    });
}

// ---------- Tushumlar reyestrini hujjat asosida tuzatish ----------
async function voidReceipt(db, user, settings, recordId, { reason, evidenceUrl, date, replacedBy = null }) {
    const rec = (await db.query(`SELECT *,TO_CHAR(paid_date,'YYYY-MM-DD') AS d FROM payment_records WHERE id=$1`, [recordId])).rows[0];
    if (!rec) throw error(404, 'Tushum topilmadi');
    if ((await db.query('SELECT 1 FROM payment_record_voids WHERE record_id=$1', [recordId])).rows.length) throw error(409, 'Bu tushum allaqachon bekor qilingan');
    if (await sumPaid(db, 'payment_record_id=$1', [recordId]) > 0) throw error(409, 'Bu tushum bo‘yicha qaytarish yozilgan. Avval qaytarishni storno qiling');
    // Limit almashtirish (replace) orqali bekor qilishga ham qo'llanadi — chetlab o'tish yo'li yo'q.
    if (Number(rec.amount) > settings.approvalLimit && !user.director) throw error(403, `${settings.approvalLimit} so‘mdan katta tushumni bekor qilish yoki almashtirish faqat rahbar tomonidan`);
    const day = dateOf(F.date(date) || (await isClosed(db, rec.d) ? F.today() : rec.d), 'Bekor qilish sanasi');
    if (day < rec.d) throw error(400, 'Bekor qilish sanasi tushum sanasidan oldin bo‘lmaydi');
    await assertOpen(db, day, 'Bekor qilish sanasi');
    // Tushumni bekor qilish hisobdan pulni kamaytiradi — rahbar bo'lmasa, qoldiq manfiyga tushmasligi kerak.
    if (!replacedBy && rec.account_id) await assertNoOverdraft(db, user, rec.account_id, day, Number(rec.amount));
    await db.query(`INSERT INTO payment_record_voids(record_id,void_date,reason,evidence_url,replaced_by,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [recordId, day, reason, evidenceUrl, replacedBy, user.id, user.name]);
    await db.query('INSERT INTO payment_audit(record_id,action,actor_id,actor_name,data) VALUES($1,$2,$3,$4,$5)',
        [recordId, 'finance-void', user.id, user.name, JSON.stringify({ reason, evidenceUrl, voidDate: day, replacedBy })]);
    const student = await adjustStudentBalance(db, rec, -Number(rec.amount));
    await audit(db, user, 'receipt-void', recordId, { amount: Number(rec.amount), date: rec.d, name: rec.snapshot?.name || '' }, { reason, voidDate: day, replacedBy, evidenceUrl, student });
    return { recordId, voidDate: day };
}
// Bekor qilingan / hujjat bilan qo'shilgan tushum o'quvchi kartasidagi to'langan summa va qarzga ham aks etadi.
async function adjustStudentBalance(db, rec, delta) {
    let s = rec.student_id ? (await db.query('SELECT id,extra_data FROM students WHERE id=$1 FOR UPDATE', [rec.student_id])).rows[0] : null;
    if (!s && rec.lead_id) s = (await db.query("SELECT id,extra_data FROM students WHERE extra_data->'leadRef'->>'id'=$1 LIMIT 1 FOR UPDATE", [rec.lead_id])).rows[0];
    if (!s) return null;
    const x = s.extra_data || {}, paid = F.money(x.paidAmount) || 0, debt = F.money(x.debtAmount) || 0;
    const next = { paidAmount: Math.max(0, paid + delta), debtAmount: Math.max(0, debt - delta) };
    await db.query('UPDATE students SET extra_data=extra_data || $2::jsonb WHERE id=$1', [s.id, JSON.stringify(next)]);
    return { studentId: s.id, before: { paidAmount: paid, debtAmount: debt }, after: next };
}
async function insertCorrection(db, user, key, op, { reason, evidenceUrl, lang }) {
    const sourceKey = 'correction:' + key;
    const prior = (await db.query("SELECT id,amount,TO_CHAR(paid_date,'YYYY-MM-DD') AS d FROM payment_records WHERE source_key=$1", [sourceKey])).rows[0];
    if (prior) { sameRequest(prior, { amount: F.money(op.amount), d: F.date(op.date) }); return { id: prior.id, duplicate: true }; }
    const day = dateOf(op.date, 'To‘lov sanasi');
    await assertOpen(db, day, 'To‘lov sanasi');
    const amount = amountOf(op.amount);
    const limit = (await settingsRow(db)).data.approvalLimit;
    if (amount > limit && !user.director) throw error(403, `${limit} so‘mdan katta tushumni hujjat asosida kiritish faqat rahbar tomonidan`);
    let replaced = null;
    if (op.replacesId) {
        replaced = (await db.query('SELECT * FROM payment_records WHERE id=$1', [op.replacesId])).rows[0];
        if (!replaced) throw error(404, 'Tuzatiladigan tushum topilmadi');
        if (replaced.language !== lang) throw error(400, 'Tuzatish boshqa yo‘nalishga tegishli');
    }
    const method = ledger.method(op.method || replaced?.method);
    if (method === 'unknown') throw error(400, 'To‘lov usulini tanlang');
    const leadId = text(op.leadId, 120) || replaced?.lead_id || null, studentId = text(op.studentId, 120) || replaced?.student_id || null;
    // Yangi tushum faqat aniq o'quvchi yoki lidga bog'lanadi — aks holda sotuv va qarz hisoblari buziladi.
    if (!leadId && !studentId) throw error(400, 'Tushum qaysi o‘quvchi yoki lidga tegishli ekanini tanlang');
    let name = text(op.name, 200) || replaced?.snapshot?.name || '', phone = text(op.phone, 40) || replaced?.snapshot?.phone || '', managerId = text(op.managerId, 120) || replaced?.manager_id || '';
    if (!replaced) {
        const person = studentId ? (await db.query('SELECT name,phone,subject FROM students WHERE id=$1', [studentId])).rows[0] : null;
        const lead = leadId ? (await db.query('SELECT name,phone,manager_id,language FROM leads WHERE id=$1', [leadId])).rows[0] : null;
        if ((studentId && !person) || (leadId && !lead)) throw error(404, 'Tanlangan o‘quvchi yoki lid topilmadi');
        if ((person && person.subject !== lang) || (lead && lead.language !== lang)) throw error(400, 'O‘quvchi boshqa yo‘nalishga tegishli');
        name = name || person?.name || lead?.name || ''; phone = phone || person?.phone || lead?.phone || ''; managerId = managerId || lead?.manager_id || '';
    }
    const managerName = managerId ? (await db.query('SELECT name FROM hr_employees WHERE id=$1', [managerId])).rows[0]?.name || '' : '';
    const id = randomUUID();
    await db.query(`INSERT INTO payment_records(id,source_key,lead_id,student_id,language,manager_id,teacher_id,paid_date,amount,method,receipt_url,tariff,form,debt_snapshot,snapshot,legacy_review,actor_id)
        VALUES($1,$2,$3,$4,$5,$6,'',$7,$8,$9,$10,$11,$12,0,$13,FALSE,$14)`,
        [id, sourceKey, leadId, studentId, lang, managerId, day, amount, method, evidenceUrl, Number(op.tariff) || replaced?.tariff || null, op.form === 'full' ? 'full' : (replaced?.form || 'partial'),
            JSON.stringify({ name, phone, managerName, teacherName: '', nextPaymentDate: '', total: null, timeKnown: false, correction: true, reason }), user.id]);
    await db.query('INSERT INTO payment_audit(record_id,action,actor_id,actor_name,data) VALUES($1,$2,$3,$4,$5)',
        [id, 'finance-correction', user.id, user.name, JSON.stringify({ amount, date: day, method, reason, evidenceUrl, replacesId: replaced?.id || null })]);
    const student = await adjustStudentBalance(db, { student_id: studentId, lead_id: leadId }, amount);
    await audit(db, user, 'receipt-manual', id, replaced ? { id: replaced.id, amount: Number(replaced.amount), date: toKey(replaced.paid_date) } : null, { amount, date: day, name, phone, entity: lang, reason, evidenceUrl, leadId, studentId, student });
    return { id, duplicate: false, replaced };
}
// Bir nechta tuzatish bitta tranzaksiyada: yoki hammasi saqlanadi, yoki hech biri.
async function batchCorrections(pool, actor, body) {
    const key = requestKey(body.requestKey);
    const ops = Array.isArray(body.operations) ? body.operations : [];
    if (!ops.length || ops.length > 200) throw error(400, 'Tuzatishlar ro‘yxati bo‘sh yoki juda katta');
    const reason = text(body.reason, 500);
    if (reason.length < 5) throw error(400, 'Tuzatish sababini yozing (kamida 5 belgi)');
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const settings = (await settingsRow(db)).data;
        const lang = entity(body.entity, false);
        const evidenceUrl = await requireEvidence(db, body.evidenceUrl, { required: true });
        // To'plam jami: bekor qilinadigan va qo'shiladigan summalar yig'indisi limit va kunlik chegaraga qo'llanadi.
        const voidIds = ops.flatMap(op => op.kind === 'void' ? [String(op.recordId)] : op.kind === 'replace' ? [String(op.replacesId)] : []);
        const voidTotal = voidIds.length ? Number((await db.query('SELECT COALESCE(SUM(amount),0) AS n FROM payment_records WHERE id = ANY($1)', [voidIds])).rows[0].n) : 0;
        const addTotal = ops.reduce((n, op) => n + (op.kind === 'add' || op.kind === 'replace' ? F.money(op.amount) || 0 : 0), 0);
        const batchTotal = voidTotal + addTotal;
        // Takroriy yuborish faqat aynan shu tuzatishlar bilan: tarkibi xeshlanib solishtiriladi.
        const opsHash = createHash('sha256').update(JSON.stringify(sortKeys(ops.map(op => ({ kind: op.kind, recordId: op.recordId || null, replacesId: op.replacesId || null, date: op.date || null,
            amount: F.money(op.amount) || null, method: op.method || null, leadId: op.leadId || null, studentId: op.studentId || null }))))).digest('hex');
        const priorBatch = (await db.query("SELECT after_data FROM fin_audit WHERE action='receipt-batch' AND entity_id=$1", [key])).rows[0];
        if (priorBatch && priorBatch.after_data?.opsHash !== opsHash) throw error(409, 'Bu so‘rov identifikatori boshqa tuzatishlar bilan ishlatilgan. Sahifani yangilab qayta yuboring');
        const resubmitted = !!priorBatch;
        if (!resubmitted) await requireApproval(db, user, settings, batchTotal, 'Tuzatishlar to‘plami (bekor qilinadigan + qo‘shiladigan jami)');
        const results = [];
        for (const [i, op] of ops.entries()) {
            try {
                if (op.kind === 'void') {
                    const rec = (await db.query('SELECT language FROM payment_records WHERE id=$1', [op.recordId])).rows[0];
                    if (rec && rec.language !== lang) throw error(400, 'Tushum boshqa yo‘nalishga tegishli');
                    // Takroriy yuborish: shu to'plam (shu sabab va shu hujjat) allaqachon bekor qilgan bo'lsa.
                    const prior = (await db.query('SELECT 1 FROM payment_record_voids WHERE record_id=$1 AND reason=$2 AND evidence_url=$3', [op.recordId, reason, evidenceUrl])).rows[0];
                    if (prior) { results.push({ kind: 'void', recordId: op.recordId, duplicate: true }); continue; }
                    results.push({ kind: 'void', ...(await voidReceipt(db, user, settings, String(op.recordId), { reason, evidenceUrl, date: op.voidDate })) });
                } else if (op.kind === 'add' || op.kind === 'replace') {
                    if (op.kind === 'replace' && !op.replacesId) throw error(400, 'Tuzatiladigan tushum ko‘rsatilmagan');
                    const r = await insertCorrection(db, user, key.slice(0, 60) + '-' + i, op, { reason, evidenceUrl, lang });
                    if (op.kind === 'replace' && !r.duplicate) await voidReceipt(db, user, settings, op.replacesId, { reason: 'Tuzatildi: ' + reason, evidenceUrl, date: op.voidDate, replacedBy: r.id });
                    results.push({ kind: op.kind, id: r.id, duplicate: r.duplicate });
                } else throw error(400, 'Noma’lum tuzatish turi');
            } catch (e) { e.message = `${i + 1}-tuzatish: ${e.message}`; throw e; }
        }
        if (!resubmitted) await audit(db, user, 'receipt-batch', key, null, { count: ops.length, reason, evidenceUrl, total: batchTotal, opsHash, controlledAmount: user.director ? undefined : batchTotal });
        return { results };
    });
}
async function voidReceipts(pool, actor, body) {
    const ids = Array.isArray(body.recordIds) ? [...new Set(body.recordIds.map(String))] : [];
    if (!ids.length || ids.length > 200) throw error(400, 'Bekor qilinadigan tushumlarni tanlang');
    const reason = text(body.reason, 500);
    if (reason.length < 5) throw error(400, 'Bekor qilish sababini yozing (kamida 5 belgi)');
    return transaction(pool, async db => {
        const user = await access(db, actor);
        const settings = (await settingsRow(db)).data;
        const evidenceUrl = await requireEvidence(db, body.evidenceUrl, { required: true });
        const total = Number((await db.query('SELECT COALESCE(SUM(amount),0) AS n FROM payment_records WHERE id = ANY($1)', [ids])).rows[0].n);
        await requireApproval(db, user, settings, total, `${ids.length} ta tushumni bekor qilish (jami)`);
        const out = [];
        for (const id of ids) out.push(await voidReceipt(db, user, settings, id, { reason, evidenceUrl, date: body.date }));
        await audit(db, user, 'receipt-void-batch', ids.join(',').slice(0, 200), null, { count: ids.length, controlledAmount: user.director ? undefined : total, reason });
        return { voided: out };
    });
}
async function manualReceipt(pool, actor, body) {
    return batchCorrections(pool, actor, { requestKey: body.requestKey, entity: body.entity, reason: body.reason, evidenceUrl: body.evidenceUrl,
        operations: [{ ...body, kind: body.replacesId ? 'replace' : 'add' }] }).then(r => ({ id: r.results[0].id, duplicate: r.results[0].duplicate }));
}
async function reconcile(pool, actor, body) {
    return read(pool, async db => {
        await access(db, actor);
        const lang = entity(body.entity, false);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 3000) : [];
        if (!rows.length) throw error(400, 'Solishtirish uchun qatorlar yo‘q');
        const data = await load(db);
        return F.reconcile(rows, data.receipts.filter(r => r.entity === lang), { start: F.date(body.start), end: F.date(body.end), tolerance: Math.min(10, Math.max(0, Number(body.tolerance ?? 3))) });
    });
}

// ---------- Hisob raqamlar, tekshiruv, oy yopish, sozlamalar ----------
async function saveAccount(pool, actor, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor, { director: true });
        const name = text(body.name, 120); if (!name) throw error(400, 'Hisob nomini kiriting');
        if (!Object.hasOwn(F.ACCOUNT_KINDS, body.kind)) throw error(400, 'Hisob turini tanlang');
        const ent = entity(body.entity);
        const methods = (Array.isArray(body.methods) ? body.methods : []).filter(m => Object.hasOwn(ledger.METHODS, m));
        const opening = body.openingBalance === '' || body.openingBalance == null ? 0 : Number(body.openingBalance);
        if (!Number.isSafeInteger(opening)) throw error(400, 'Boshlang‘ich qoldiq butun son bo‘lishi kerak');
        const openingDate = body.openingDate ? F.date(body.openingDate) : null;
        if (body.openingDate && !openingDate) throw error(400, 'Boshlang‘ich qoldiq sanasi noto‘g‘ri');
        const existing = body.id ? (await db.query('SELECT * FROM fin_accounts WHERE id=$1', [body.id])).rows[0] : null;
        if (body.id && !existing) throw error(404, 'Hisob topilmadi');
        if (!existing && body.requestKey) {
            const prior = (await db.query('SELECT id FROM fin_accounts WHERE request_key=$1', [requestKey(body.requestKey)])).rows[0];
            if (prior) return { id: prior.id, duplicate: true };
        }
        const clash = (await db.query(`SELECT name FROM fin_accounts WHERE active AND id<>$1 AND entity=$2 AND methods && $3::text[]`, [existing?.id || '', ent, methods])).rows[0];
        if (clash && body.active !== false) throw error(409, `Tanlangan to‘lov usuli "${clash.name}" hisobiga biriktirilgan`);
        if (existing) {
            const prevDate = existing.opening_date ? toKey(existing.opening_date) : null;
            if (Number(existing.opening_balance) !== opening || prevDate !== openingDate) {
                const od = [openingDate, prevDate].filter(Boolean).sort()[0];
                if ((od && await isClosed(db, od)) || (!od && await closedThrough(db))) throw error(409, 'Boshlang‘ich qoldiq yopilgan oylarga ta’sir qiladi. Avval oylarni qayta oching');
            }
            if (existing.entity !== ent && (await db.query('SELECT 1 FROM payment_records WHERE account_id=$1 UNION ALL SELECT 1 FROM fin_transactions WHERE account_id=$1 OR to_account_id=$1 LIMIT 1', [existing.id])).rows.length)
                throw error(409, 'Harakati bor hisobning egasini o‘zgartirib bo‘lmaydi — yangi hisob oching');
            if (existing.kind !== body.kind && (await db.query('SELECT 1 FROM payment_records WHERE account_id=$1 UNION ALL SELECT 1 FROM fin_transactions WHERE account_id=$1 OR to_account_id=$1 LIMIT 1', [existing.id])).rows.length)
                throw error(409, 'Harakati bor hisobning turini o‘zgartirib bo‘lmaydi — hisobotlar tarixi o‘zgaradi');
            await db.query(`UPDATE fin_accounts SET name=$2,kind=$3,entity=$4,methods=$5,opening_balance=$6,opening_date=$7,active=$8,updated_at=NOW() WHERE id=$1`,
                [existing.id, name, body.kind, ent, methods, opening, openingDate, body.active !== false]);
            await audit(db, user, 'account-update', existing.id, { name: existing.name, opening: Number(existing.opening_balance), openingDate: prevDate, methods: existing.methods, active: existing.active },
                { name, opening, openingDate, methods, active: body.active !== false });
            return { id: existing.id };
        }
        if (openingDate && await isClosed(db, openingDate)) throw error(409, 'Boshlang‘ich qoldiq sanasi yopilgan davrda');
        const id = 'acc-' + randomUUID().slice(0, 8);
        await db.query(`INSERT INTO fin_accounts(id,entity,name,kind,methods,opening_balance,opening_date,sort,request_key) VALUES($1,$2,$3,$4,$5,$6,$7,100,$8)`,
            [id, ent, name, body.kind, methods, opening, openingDate, body.requestKey || null]);
        await audit(db, user, 'account-create', id, null, { name, kind: body.kind, entity: ent, methods, opening, openingDate });
        return { id };
    });
}
async function addAccountCheck(pool, actor, accountId, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor);
        if (body.requestKey) {
            const prior = (await db.query("SELECT id,account_id,actual_balance,TO_CHAR(check_date,'YYYY-MM-DD') AS d FROM fin_account_checks WHERE request_key=$1", [requestKey(body.requestKey)])).rows[0];
            if (prior) { sameRequest(prior, { account_id: accountId, actual_balance: Number(body.actualBalance), d: F.date(body.date) }); return { ok: true, duplicate: true }; }
        }
        await accountRow(db, accountId);
        const day = dateOf(body.date, 'Tekshiruv sanasi');
        await assertOpen(db, day, 'Tekshiruv sanasi');
        const actual = Number(body.actualBalance);
        if (!Number.isSafeInteger(actual)) throw error(400, 'Haqiqiy qoldiqni butun son bilan kiriting');
        await db.query('INSERT INTO fin_account_checks(account_id,check_date,actual_balance,note,actor_id,actor_name,request_key) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [accountId, day, actual, text(body.note, 500), user.id, user.name, body.requestKey || null]);
        await audit(db, user, 'account-check', accountId, null, { date: day, actual, note: text(body.note, 500) });
        return { ok: true };
    });
}
// Oy yopishdan oldingi majburiy nazorat: har bir pul hisobi oy oxirida (oxirgi 3 kun) haqiqiy qoldiq bilan
// solishtirilgan va farqi nol bo'lishi kerak. Aks holda rahbar sababini yozib, ongli ravishda yopadi.
function closeReadiness(data, month) {
    const end = F.monthEnd(month), issues = [], mv = F.movements(data);
    const balances = new Map(F.accountBalances(data, end).map(a => [a.id, a.balance]));
    for (const a of data.accounts) {
        // Pul hisoblari va Uzum kliring hisobi (Uzum ko'chirmasi bilan) tekshiriladi; faolsiz, lekin qoldig'i bor hisob ham.
        if (!F.EQUIVALENT_KINDS.has(a.kind) && a.kind !== 'clearing') continue;
        if (!a.active && !balances.get(a.id)) continue;
        const used = mv.some(m => m.account === a.id && m.date <= end) || (a.openingBalance && (!a.openingDate || a.openingDate <= end));
        if (!used) continue;
        const checks = (data.accountChecks || []).filter(c => c.accountId === a.id && c.date >= F.addDays(end, -3) && c.date <= end);
        const last = checks.at(-1);
        if (!last) { issues.push(`${a.name}: oy oxirida haqiqiy qoldiq kiritilmagan`); continue; }
        const book = F.accountBalances(data, last.date).find(x => x.id === a.id).balance;
        const actual = Number(last.actualBalance);
        if (book !== actual) issues.push(`${a.name}: kitobda ${fmt(book)} so‘m, haqiqiy ${fmt(actual)} so‘m (farq ${fmt(actual - book)} so‘m)`);
    }
    const suspense = F.accountBalances(data, end).find(a => a.kind === 'suspense');
    if (suspense && suspense.balance) issues.push(`To‘lov usuli aniqlanmagan ${fmt(suspense.balance)} so‘m “Aniqlanmagan” hisobida turibdi`);
    return issues;
}
async function closeStatus(pool, actor, q) {
    return read(pool, async db => {
        await access(db, actor);
        const data = await load(db), month = String(q.month || '');
        if (!/^\d{4}-\d{2}$/.test(month)) throw error(400, 'Oy noto‘g‘ri');
        return { month, issues: closeReadiness(data, month) };
    });
}
async function lockMonth(pool, actor, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor, { director: true });
        const month = String(body.month || '');
        if (!/^\d{4}-\d{2}$/.test(month) || !F.date(month + '-01')) throw error(400, 'Oy noto‘g‘ri');
        const through = await closedThrough(db);
        if (body.locked === false) {
            const reason = text(body.note, 500); if (reason.length < 5) throw error(400, 'Oyni qayta ochish sababini yozing');
            if (month !== through) throw error(409, through ? `Faqat oxirgi yopilgan oyni (${through}) qayta ochish mumkin` : 'Yopilgan oy yo‘q');
            // Avval qulf olinadi, keyin nusxa (trigger yopiq oyning nusxasini o'chirishga ruxsat bermaydi).
            const r = await db.query('DELETE FROM fin_period_locks WHERE month=$1 RETURNING month,locked_by_name,note', [month]);
            const snap = (await db.query('DELETE FROM fin_period_snapshots WHERE month=$1 RETURNING data', [month])).rows[0];
            await audit(db, user, 'period-unlock', month, { lock: r.rows[0] || null, snapshot: snap?.data ? { createdAt: snap.data.createdAt, netAssets: snap.data.balance?.netAssets } : null }, { reason });
            return { ok: true, closedThrough: await closedThrough(db) };
        }
        if (F.monthEnd(month) >= F.today()) throw error(400, 'Faqat tugagan oyni yopish mumkin');
        if (through && month <= through) return { ok: true, alreadyLocked: true, closedThrough: through };
        const data = await load(db);
        // Oy yopilishidan oldin barcha moliyaviy qatorlar muhri va audit zanjiri to'liq tekshiriladi.
        const seals = await verifySeals(db), chain = await verifyAuditChain(db);
        if (!seals.ok || !chain.ok) throw error(409, `Ma’lumot yaxlitligi buzilgan (${!seals.ok ? `${seals.table}: ${seals.reason}` : `audit jurnali #${chain.brokenAt}`}) — oyni yopib bo‘lmaydi`);
        const issues = closeReadiness(data, month);
        const note = text(body.note, 1000);
        if (issues.length && !(body.override === true && note.length >= 10))
            throw Object.assign(error(409, 'Oyni yopishdan oldin tuzating: ' + issues.join('; ') + '. Yoki sababini (kamida 10 belgi) yozib, ongli ravishda yoping'), { issues });
        // Hali yopilmagan barcha oylar (birinchi yozuvdan boshlab) uchun muzlatilgan nusxa olinadi.
        const first = [...data.receipts.map(r => r.date), ...data.transactions.map(t => t.date), ...data.payables.map(p => p.issueDate), ...data.salaries.map(s => s.accrualDate)].filter(Boolean).sort()[0] || month + '-01';
        const months = F.monthsBetween(first < month + '-01' ? first : month + '-01', month + '-01').filter(m => !through || m > through);
        // Oylar ketma-ket muzlatiladi: har bir oyning nusxasi undan oldingi yopilgan oylarni hisobga oladi
        // (o'tgan davr tuzatishlari birinchi ochiq oyga bir marta muzlatiladi).
        let state = data;
        const hashes = {};
        for (const m of months) {
            const snap = { ...F.snapshotMonth(state, m), auditHead: await auditHead(db) };
            const body = JSON.stringify(snap);
            await db.query('DELETE FROM fin_period_snapshots WHERE month=$1', [m]); // ochiq oyning eskirgan nusxasi (agar bo'lsa)
            // Xesh bazadagi kanonik JSONB matnidan olinadi va har o'qishda tekshiriladi.
            hashes[m] = (await db.query(`INSERT INTO fin_period_snapshots(month,data,sha256) VALUES($1,$2::jsonb,encode(sha256(convert_to($2::jsonb::text,'UTF8')),'hex')) RETURNING sha256`, [m, body])).rows[0].sha256;
            state = { ...state, closedThrough: m, snapshots: { ...state.snapshots, [m]: JSON.parse(body) } };
        }
        await db.query('INSERT INTO fin_period_locks(month,locked_by,locked_by_name,note,snapshot_hashes) VALUES($1,$2,$3,$4,$5)', [month, user.id, user.name, issues.length ? 'OGOHLANTIRISH BILAN: ' + note : note, JSON.stringify(hashes)]);
        await audit(db, user, 'period-lock', month, { closedThrough: through || null }, { closedThrough: month, note, overriddenIssues: issues, snapshotMonths: months, snapshotSha256: hashes });
        return { ok: true, closedThrough: month, snapshotMonths: months };
    });
}
// ---------- Asosiy vositalar: sotish, hisobdan chiqarish, qadrsizlanish (rahbar) ----------
async function assetRow(db, id) {
    const t = (await db.query("SELECT *,TO_CHAR(txn_date,'YYYY-MM-DD') AS d FROM fin_transactions WHERE id=$1 AND category_code='CAPEX' AND reverses_id IS NULL", [id])).rows[0];
    if (!t) throw error(404, 'Asosiy vosita topilmadi');
    if ((await db.query('SELECT 1 FROM fin_transactions WHERE reverses_id=$1', [id])).rows.length) throw error(409, 'Bu xarid storno qilingan');
    if ((await db.query("SELECT 1 FROM fin_asset_events WHERE asset_id=$1 AND kind='disposal'", [id])).rows.length) throw error(409, 'Bu aktiv allaqachon chiqarilgan');
    return t;
}
async function disposeAsset(pool, actor, id, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor, { director: true });
        const t = await assetRow(db, id);
        const day = dateOf(body.date, 'Chiqarish sanasi');
        if (day <= t.d) throw error(400, 'Chiqarish sanasi xarid sanasidan keyin bo‘lishi kerak');
        await assertOpen(db, day, 'Chiqarish sanasi');
        const reason = text(body.reason, 500); if (reason.length < 5) throw error(400, 'Sababini yozing');
        const proceeds = body.proceeds ? amountOf(body.proceeds) : 0;
        const evidenceUrl = await requireEvidence(db, body.evidenceUrl, { required: proceeds > 0, label: 'Sotish hujjati' });
        let txnId = null;
        if (proceeds) {
            const account = await accountRow(db, body.accountId);
            txnId = randomUUID();
            await db.query(`INSERT INTO fin_transactions(id,entity,txn_date,type,category_code,account_id,amount,counterparty,description,receipt_url,asset_id,actor_id,actor_name)
                VALUES($1,$2,$3,'income','ASSET_SALE',$4,$5,$6,$7,$8,$9,$10,$11)`, [txnId, t.entity, day, account.id, proceeds, text(body.counterparty, 200) || 'Xaridor', 'Sotildi: ' + (t.counterparty || t.description), evidenceUrl, t.id, user.id, user.name]);
        }
        const eid = randomUUID();
        await db.query('INSERT INTO fin_asset_events(id,asset_id,kind,event_date,amount,transaction_id,reason,evidence_url,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
            [eid, t.id, 'disposal', day, proceeds, txnId, reason, evidenceUrl, user.id, user.name]);
        await audit(db, user, 'asset-dispose', t.id, { cost: Number(t.amount), date: t.d }, { date: day, proceeds, reason, transactionId: txnId });
        return { id: eid, transactionId: txnId };
    });
}
async function impairAsset(pool, actor, id, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor, { director: true });
        const t = await assetRow(db, id);
        if ((await db.query("SELECT 1 FROM fin_asset_events WHERE asset_id=$1 AND kind='impairment'", [id])).rows.length) throw error(409, 'Bu aktiv bo‘yicha qadrsizlanish allaqachon yozilgan');
        const day = dateOf(body.date, 'Sana');
        if (day <= t.d) throw error(400, 'Sana xarid sanasidan keyin bo‘lishi kerak');
        await assertOpen(db, day, 'Sana');
        const reason = text(body.reason, 500); if (reason.length < 10) throw error(400, 'Qadrsizlanish sababini batafsil yozing (kamida 10 belgi)');
        const amount = amountOf(body.amount);
        const data = await load(db);
        const asset = F.fixedAssets(data).find(a => a.transactionId === t.id);
        const nbv = F.netBookValue(asset, F.addDays(day, -1));
        if (amount > nbv) throw error(400, `Qadrsizlanish qoldiq qiymatdan (${fmt(nbv)} so‘m) oshmasin`);
        const evidenceUrl = await requireEvidence(db, body.evidenceUrl, { required: true, label: 'Baholash hujjati' });
        const eid = randomUUID();
        await db.query('INSERT INTO fin_asset_events(id,asset_id,kind,event_date,amount,reason,evidence_url,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [eid, t.id, 'impairment', day, amount, reason, evidenceUrl, user.id, user.name]);
        await audit(db, user, 'asset-impair', t.id, { nbv }, { date: day, amount, reason });
        return { id: eid };
    });
}
async function saveSettings(pool, actor, body) {
    return transaction(pool, async db => {
        const user = await access(db, actor, { director: true });
        const row = (await db.query("SELECT data,revision FROM fin_settings WHERE id='main' FOR UPDATE")).rows[0];
        if (Number(body.revision) !== row.revision) throw error(409, 'Sozlamalarni boshqa foydalanuvchi o‘zgartirgan. Sahifani yangilang');
        const d = body.data || {}, cur = F.settingsOf({ settings: row.data });
        const int = (v, min, max, label) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) throw error(400, `${label}: ${min}–${max} oralig‘ida butun son`); return n; };
        const rates = {};
        for (const k of Object.keys(F.DEFAULT_SETTINGS.eclRates)) rates[k] = int(d.eclRates?.[k] ?? cur.eclRates[k], 0, 100, 'ECL stavkasi (%)');
        const data = { ...row.data,
            courseMonths: { english: int(d.courseMonths?.english ?? cur.courseMonths.english, 1, 24, 'Kurs davomiyligi'), russian: int(d.courseMonths?.russian ?? cur.courseMonths.russian, 1, 24, 'Kurs davomiyligi') },
            suspiciousMin: int(d.suspiciousMin ?? cur.suspiciousMin, 0, 1000000, 'Shubhali summa'), salaryDueDays: int(d.salaryDueDays ?? cur.salaryDueDays, 0, 60, 'Maosh to‘lash muddati'),
            usefulLifeMonths: int(d.usefulLifeMonths ?? cur.usefulLifeMonths, 1, 240, 'Foydalanish muddati'), approvalLimit: int(d.approvalLimit ?? cur.approvalLimit, 0, 1e12, 'Tasdiqlash chegarasi'), eclRates: rates,
            dailyLimit: int(d.dailyLimit ?? cur.dailyLimit ?? (Number(d.approvalLimit ?? cur.approvalLimit) * 3), 0, 1e13, 'Kunlik chiqim chegarasi'),
            turnoverTaxRate: (() => { const v = Number(d.turnoverTaxRate ?? cur.turnoverTaxRate ?? 0); if (!(v >= 0 && v <= 30) || Math.round(v * 100) !== v * 100) throw error(400, 'Aylanma soliq stavkasi 0–30% (ko‘pi bilan 2 kasr)'); return v; })() };
        // Taxmin o'zgarishi faqat bugundan kuchga kiradi (IAS 8): tarixiy hisoblar eski sozlama bilan qoladi.
        const from = F.today();
        await db.query("UPDATE fin_settings SET data=$1,revision=revision+1,updated_at=NOW() WHERE id='main'", [JSON.stringify(data)]);
        await db.query('INSERT INTO fin_settings_history(effective_from,data,actor_id,actor_name) VALUES($1,$2,$3,$4)', [from, JSON.stringify(data), user.id, user.name]);
        await audit(db, user, 'settings-update', 'main', row.data, { ...data, effectiveFrom: from });
        return { revision: row.revision + 1, effectiveFrom: from };
    });
}

// Eski "Cash Flow" (json) qo'lda kiritilgan yozuvlari bir marta, "ESKI YOZUV" belgisi bilan ko'chiriladi.
async function migrateLegacyCash(db) {
    if ((await db.query("SELECT 1 FROM fin_migrations WHERE id='legacy-cashflow-v1'")).rows.length) return;
    const manual = (await db.query("SELECT data FROM json_data WHERE key='cashFlow'").catch(() => ({ rows: [] }))).rows[0]?.data || [];
    const decisions = (await db.query('SELECT * FROM payment_cash_decisions').catch(() => ({ rows: [] }))).rows.map(r => ({ cashId: r.cash_id, recordId: r.record_id, decision: r.decision, snapshot: r.snapshot }));
    const records = (await db.query(`SELECT id,lead_id,student_id,language,amount,method,TO_CHAR(paid_date,'YYYY-MM-DD') AS paid_date FROM payment_records`)).rows
        .map(r => ({ id: r.id, leadId: r.lead_id, studentId: r.student_id, language: r.language, amount: Number(r.amount), method: r.method, paidDate: r.paid_date }));
    const rows = ledger.projectCash(Array.isArray(manual) ? manual : [], records, decisions).rows.filter(r => !r.ledgerGenerated);
    const accountOf = m => ({ 'Naqd pul': 'acc-cash', Karta: 'acc-card', Paylater: 'acc-card', 'Bank hisob raqami': 'acc-bank', 'Uzum Nasiya': 'acc-uzum' })[m] || 'acc-suspense';
    const closed = await closedThrough(db);
    for (const c of rows) {
        const amount = F.money(c.amount), day = F.date(c.date);
        if (!amount || !day || (closed && F.monthOf(day) <= closed)) continue;
        const purpose = String(c.purpose || '');
        let type, category;
        if (c.type === 'kirim') { if (c.category === 'investitsiya') { type = 'capital'; category = 'OWNER_IN'; } else { type = 'income'; category = 'REV_OTHER'; } }
        else if (/CEO|shaxsiy/i.test(purpose)) { type = 'drawing'; category = 'OWNER_OUT'; }
        else if (c.category === 'investitsiya') { type = 'expense'; category = /CRM/i.test(purpose) ? 'SOFTWARE' : 'CAPEX'; }
        else { type = 'expense'; category = /target/i.test(purpose) ? 'MKT_ADS' : /marketing/i.test(purpose) ? 'MKT_OTHER' : /CRM/i.test(purpose) ? 'SOFTWARE' : 'OTHER_EXP'; }
        const ent = c.lang === 'russian' || c.lang === 'english' ? c.lang : 'common';
        await db.query(`INSERT INTO fin_transactions(id,request_key,entity,txn_date,type,category_code,account_id,amount,counterparty,description,legacy,useful_life_months,actor_id,actor_name)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11,'system','Eski Cash Flow’dan ko‘chirildi') ON CONFLICT(request_key) DO NOTHING`,
            [randomUUID(), 'legacy-cf-' + String(c.id).slice(0, 60).padEnd(16, '0'), ent, day, type, category, accountOf(c.paymentMethod), amount,
                text(c.person, 200) || 'Noma’lum', text(['ESKI YOZUV', purpose, c.notes].filter(Boolean).join(' · '), 1000), category === 'CAPEX' ? 36 : null]);
    }
    await db.query("INSERT INTO fin_migrations(id) VALUES('legacy-cashflow-v1') ON CONFLICT DO NOTHING");
}

module.exports = { SCHEMA, initSchema, load, overview, cashbook, listTransactions, auditLog, people, storeEvidence, readEvidence, createTransaction, reverseTransaction,
    createPayable, voidPayable, recordSalaryPayment, voidReceipts, manualReceipt, batchCorrections, reconcile, saveAccount, addAccountCheck, closeStatus, lockMonth,
    saveSettings, assertOpen, verifyAuditChain, verifySeals, closeReadiness, disposeAsset, impairAsset };
