// Akademik rahbar roli (2026-11): rol ro'yxatlari, /api/state cheklovi va kabinet qoidalarining sof yordamchilari.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const H = require('../server/services/academicHead');

test('akademik roli server va mijozda ro‘yxatdan o‘tgan', () => {
    assert.strictEqual((read('server/routes/auth.js').match(/'hr', 'akademik'\]/g) || []).length, 2);
    assert.match(read('server/routes/state.js'), /'targetolog', 'hr', 'akademik'\]\.includes\(req\.user\?\.role\)/);
    assert.match(read('server/routes/state.js'), /isLead = \['admin', 'rop', 'boshliq'\]\.includes\(role\) \|\| role === 'akademik'/);
    assert.doesNotMatch(read('server/middleware/readOnlyRoles.js'), /akademik/, 'akademik faqat-o‘qish roli emas');
    assert.match(read('js/teamLogin.js'), /akademik: 'Akademik rahbar'/);
    assert.match(read('js/teamApp.js'), /akademik: \[\s*\{ id: 'home'/);
    const app = read('js/app.js');
    assert.ok((app.match(/=== 'head-of-teachers' \? 'akademik'/g) || []).length >= 3, 'uchta rol xaritasida head-of-teachers → akademik');
    assert.match(app, /akademik: +\['dashboard', 'students', 'teachers-section', 'timetable', 'guides'\]/);
    assert.match(app, /if \(role === 'akademik'\) return \['head_of_teachers'\]/);
    assert.match(read('server/index.js'), /routes\/academicHead/);
    assert.match(read('server/index.js'), /services\/academicHead'\)\.initSchema/);
    assert.match(read('server/services/staffNotify.js'), /r === 'akademik' \? 'akademik'/);
    const sn = require('../server/services/staffNotify');
    const keys = sn.catalogFor({ kind: 'other', user: { role: 'akademik' } }).flatMap(g => g.items.map(i => i.key));
    for (const k of ['acad_problem_overdue', 'acad_teacher_locked', 'acad_trial_rejected', 'acad_late_contact', 'acad_makeup_new', 'acad_break', 'acad_risk_new'])
        assert.ok(keys.includes(k), k);
    assert.match(read('server/services/school/studentOps.js'), /TEACHER_CHANGE_ROLES = new Set\(\[\.\.\.APPROVER_ROLES, 'akademik'\]\)/);
});

test('akademik uchun state: telefon qoladi, to‘lov/kassa/bonus kesiladi, xodim maxfiy maydonlari maskalanadi', () => {
    const { scopeState } = require('../server/services/stateScope');
    const state = { students: [{ id: 's1', phone: '+998901112233', name: 'A' }], payments: [{ id: 'p' }], cashFlow: [{ id: 'c' }], bookRoadmap: [{ id: 'b' }],
        bonusData: { x: 1 }, bonusHistory: [{ id: 1 }], individualSalesPlans: { a: 1 }, hrEmployees: [{ id: 'e', login: 'x', cardNumber: '8600', passportSeries: 'AA1' }] };
    const out = scopeState(state, { role: 'akademik', email: 'ak@x' }, {});
    assert.strictEqual(out.students[0].phone, '+998901112233');
    assert.deepStrictEqual([out.payments, out.cashFlow, out.bookRoadmap, out.bonusHistory], [[], [], [], []]);
    assert.deepStrictEqual([out.bonusData, out.individualSalesPlans], [{}, {}]);
    assert.ok(!out.hrEmployees[0].cardNumber && !out.hrEmployees[0].passportSeries);
});

test('til: HR yozuvidan; ustoz mosligi', () => {
    assert.deepStrictEqual(H.langsFromHr('both'), ['english', 'russian']);
    assert.deepStrictEqual(H.langsFromHr('russian'), ['russian']);
    assert.deepStrictEqual(H.langsFromHr(''), []);
    assert.strictEqual(H.teacherFits({ role: 'rus-oqituvchi', lang: 'english' }, ['russian']), true, 'lavozim tildan ustun');
    assert.strictEqual(H.teacherFits({ role: 'ingliz-oqituvchi' }, ['russian']), false);
    assert.strictEqual(H.teacherFits({ role: 'yordamchi', lang: 'both' }, ['english']), true);
    assert.strictEqual(H.teacherFits({ role: 'yordamchi', lang: 'russian' }, null), true, 'admin — cheklovsiz');
});

test('reja: 3 tadan ko‘p orqada emas — rejada', () => {
    assert.strictEqual(H.isOnPlan(10, 7), true);
    assert.strictEqual(H.isOnPlan(10, 6), false);
    assert.strictEqual(H.isOnPlan(null, 0), true, 'kurs boshlanmagan / muzlatilgan');
    assert.strictEqual(H.behindBy(5, 9), 0);
    assert.strictEqual(H.onPlanPct([{ onPlan: true }, { onPlan: false }, { onPlan: true }, { onPlan: true }]), 75);
    assert.strictEqual(H.onPlanPct([]), null);
});

test('xavf sababi: noapp > absent > behind, bittasi', () => {
    assert.strictEqual(H.riskReason({ daysIdle: null }).reason, 'noapp');
    assert.strictEqual(H.riskReason({ daysIdle: 3, streak: 4, behind: 9 }).reason, 'noapp');
    assert.strictEqual(H.riskReason({ daysIdle: 1, streak: 2, behind: 9 }).reason, 'absent');
    assert.strictEqual(H.riskReason({ daysIdle: 0, streak: 1, behind: 6 }).reason, 'behind');
    assert.strictEqual(H.riskReason({ daysIdle: 0, streak: 1, behind: 5 }), null);
    assert.strictEqual(H.riskReason({ daysIdle: null, frozen: true }), null);
    assert.strictEqual(H.absentStreak([{ date: '2026-10-01', status: 'missed' }, { date: '2026-10-03', status: 'came' }, { date: '2026-10-06', status: 'missed' },
        { date: '2026-10-08', status: null }, { date: '2026-10-10', status: 'missed' }]), 2);
});

test('qoplashni rad etish oynasi: shu oy yoki keyingi oyning 4-sanasigacha', () => {
    assert.deepStrictEqual(H.makeupRejectWindow('2026-10-20', '2026-11-04'), { deadline: '2026-11-04', canReject: true });
    assert.strictEqual(H.makeupRejectWindow('2026-10-20', '2026-11-05').canReject, false);
    assert.strictEqual(H.makeupRejectWindow('2026-11-02', '2026-11-30').canReject, true);
    assert.strictEqual(H.makeupRejectWindow('2026-12-15', '2027-01-03').deadline, '2027-01-04');
    assert.strictEqual(H.makeupRejectWindow('', '2026-11-01').canReject, false);
});

test('kechikkan aloqa qoidasi: joriy oy, qo‘ng‘iroq ≥5 daqiqa, yozishma haftasiga 1', () => {
    const today = '2026-11-10';
    assert.strictEqual(H.lateRuleCheck({ kind: 'call', minutes: 6, day: '2026-11-08', today }).ok, true);
    assert.strictEqual(H.lateRuleCheck({ kind: 'call', minutes: 4, day: '2026-11-08', today }).ok, false);
    assert.strictEqual(H.lateRuleCheck({ kind: 'call', minutes: 10, day: '2026-10-30', today }).ok, false, 'o‘tgan oy');
    assert.strictEqual(H.lateRuleCheck({ kind: 'call', minutes: 10, day: '2026-11-08', today, countedThatDay: true }).ok, false, 'kuniga 1');
    assert.strictEqual(H.lateRuleCheck({ kind: 'message', minutes: 0, day: '2026-11-08', today }).ok, true);
    assert.strictEqual(H.lateRuleCheck({ kind: 'message', day: '2026-11-08', today, textThisWeek: true }).ok, false, 'haftasiga 1');
});

test('jadval matni', () => {
    assert.strictEqual(H.scheduleText(2, '20:00'), 'juft kunlar 20:00');
    assert.strictEqual(H.scheduleText(5, '09:00'), 'toq kunlar 09:00');
});

// ── Ko'rib chiqishdan keyingi qoidalar ──
const fakeDb = handler => ({ query: async (sql, params) => handler(String(sql), params || []) });

test('qulf oynasi: max(QULF_FROM, oy boshi) .. kecha (teacher/v2/davomat.js bilan bir xil)', () => {
    assert.match(read('teacher/v2/davomat.js'), new RegExp(`QULF_FROM = '${H.QULF_FROM}'`));
    assert.strictEqual(H.lockWindow('2026-11-10'), null, '18-noyabrgacha qulf yoʻq');
    assert.strictEqual(H.lockWindow('2026-11-18'), null, 'kecha QULF_FROM dan oldin');
    assert.deepStrictEqual(H.lockWindow('2026-11-20'), { from: '2026-11-18', to: '2026-11-19' });
    assert.deepStrictEqual(H.lockWindow('2026-12-05'), { from: '2026-12-01', to: '2026-12-04' });
    assert.strictEqual(H.lockWindow('2026-12-01'), null, 'oyning 1-kuni — oʻtgan oy qulfga kirmaydi');
});

test('yangi oʻquvchi (3 kundan kam) "ilovaga kirmagan" deb belgilanmaydi', () => {
    assert.strictEqual(H.riskReason({ daysIdle: null, startedDays: 1 }), null);
    assert.strictEqual(H.riskReason({ daysIdle: null, startedDays: 3 }).reason, 'noapp');
    assert.strictEqual(H.riskReason({ daysIdle: null, startedDays: 1, streak: 2 }).reason, 'absent');
});

test('ustoz almashtirish: oʻtgan sanadan — 400 (soʻrov orqali emas)', async () => {
    // bcryptjs (studentOps vaqtinchalik parol uchun) — node_modules o'rnatilmagan muhitda ham sof tekshiruv ishlasin.
    try { require.resolve('bcryptjs'); } catch { require('node:module').prototype.require = (orig => function (id) { return id === 'bcryptjs' ? {} : orig.apply(this, arguments); })(require('node:module').prototype.require); }
    const O = require('../server/services/school/studentOps');
    const db = fakeDb(() => { throw new Error('bazaga yetib bormasligi kerak'); });
    const now = new Date('2026-11-02T07:00:00Z');
    await assert.rejects(O.changeTeacher(db, { id: 'u', role: 'akademik' }, 's1', { teacherId: 't2', effectiveFrom: '2026-11-01', reason: 'test' }, { now }),
        e => e.status === 400 && /Oʻtgan sanadan/.test(e.message));
    await assert.rejects(O.changeTeacher(db, { id: 'u', role: 'sales_manager' }, 's1', { teacherId: 't2', reason: 'test' }, { now }), e => e.status === 403);
});

test('adminCorrect: akademik faqat decideLate (viaHead) orqali', async () => {
    const A = require('../server/services/school/assist');
    const ak = { id: 'u', role: 'akademik' };
    const db = fakeDb(() => { throw Object.assign(new Error('stop'), { status: 599 }); });
    await assert.rejects(A.adminCorrect(db, ak, { requestId: 'r1', reason: 'tasdiqlandi' }), e => e.status === 403, 'ochiq /assist/corrections');
    await assert.rejects(A.adminCorrect(db, ak, { removeId: 'c1', reason: 'xxxxx' }, new Date(), { viaHead: true }), e => e.status === 403);
    await assert.rejects(A.adminCorrect(db, ak, { requestId: 'r1', reason: 'tasdiqlandi' }, new Date(), { viaHead: true }), e => e.status === 599, 'ruxsat oʻtdi — bazaga yetdi');
    assert.match(read('server/services/academicHead.js'), /A\.adminCorrect\(db, user, \{ requestId: r\.id[\s\S]{0,400}?\}, now, \{ viaHead: true \}\);/);
    assert.doesNotMatch(read('server/routes/school.js'), /viaHead/);
});

test('yopilgan muammoga izoh — 409; masʼul boshqa tilda — 403', async () => {
    const closed = { id: 'p1', lang: 'russian', stage: 'closed' };
    const db = fakeDb(sql => /FROM hr_employees WHERE LOWER/.test(sql) ? { rows: [{ id: 'h', lang: 'russian' }] }
        : /FROM academic_problems/.test(sql) ? { rows: [closed] }
        : /FROM hr_employees WHERE id=/.test(sql) ? { rows: [{ id: 't-en', name: 'John', role: 'ingliz-oqituvchi', lang: 'english' }] } : { rows: [] });
    const ak = { id: 'u', role: 'akademik', name: 'G', email: 'ak@x' };
    await assert.rejects(H.problemEvent(db, ak, 'p1', { kind: 'comment', text: 'salom' }), e => e.status === 409);
    closed.stage = 'assigned';
    await assert.rejects(H.patchProblem(db, ak, 'p1', { ownerId: 't-en' }), e => e.status === 403 && /boshqa til/.test(e.message));
    assert.strictEqual(H.ownerFits({ role: 'rop', lang: 'both' }, ['russian']), true);
    assert.strictEqual(H.ownerFits({ role: 'hr', lang: '' }, ['russian']), true, 'umumiy xodim');
    assert.strictEqual(H.ownerFits({ role: 'yordamchi', lang: 'english' }, ['russian']), false);
});

test('Darslik markazi: akademik faqat oʻz tilida', async () => {
    const hub = require('../server/services/academicHub');
    const access = { role: 'akademik', teacher: null, lang: 'russian', langs: ['russian'] };
    assert.strictEqual(hub.pickLang(access, undefined), 'russian');
    assert.throws(() => hub.pickLang(access, 'english'), e => e.status === 403);
    assert.throws(() => hub.pickLang({ ...access, lang: null, langs: [] }, 'russian'), e => e.status === 403);
    assert.strictEqual(hub.pickLang({ ...access, lang: null, langs: ['english', 'russian'] }, 'english'), 'english');
});

test('bildirishnomalar: eslatma hisobi faqat taymerda, follow-up va student_moved katalogda', () => {
    const sn = read('server/services/staffNotify.js');
    assert.doesNotMatch(sn, /UPDATE academic_problems/, 'lenta faqat oʻqiydi');
    assert.match(read('server/services/academicHead.js'), /async function remindOverdue/);
    assert.match(read('server/index.js'), /remindOverdue/);
    const N = require('../server/services/staffNotify');
    const keys = me => N.catalogFor(me).flatMap(g => g.items.map(i => i.key));
    assert.ok(keys({ kind: 'other', user: { role: 'akademik' } }).includes('acad_problem_followup'));
    assert.ok(keys({ kind: 'teacher', user: { role: 'teacher' } }).includes('student_moved'));
    assert.match(sn, /id: `acadfu:\$\{p\.id\}`/);
});
