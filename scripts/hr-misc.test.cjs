const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const hrRoutes = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'hr.js'), 'utf8');
const hrCandidatesService = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'hrCandidates.js'), 'utf8');

test('user text is escaped in KPI summary, salary table and debt edit form', () => {
    for (const raw of ["<span>${ps.name} — ", '<td><strong>${teacher.name}</strong>', '<p class="text-muted">${ps.name}: ',
        "resize:vertical\">${s.comment || ''}</textarea>", "resize:vertical\">${s.note || ''}</textarea>"]) {
        assert.ok(!app.includes(raw), 'unescaped: ' + raw);
    }
});

test('HR card uses Uzbek status and month names', () => {
    const start = app.indexOf('function renderHrEmployeeCard(');
    const body = app.slice(start, app.indexOf('const TEACHER_ROLES', start));
    assert.ok(body.includes("'Faol' : 'Faol emas'"));
    assert.ok(body.includes('UZ_MONTHS_SHORT'));
});

test('Nomzod sahifasi: modal o\'rniga to\'liq sahifa (Vakansiya ro\'yxati bilan almashtiriladi)', () => {
    assert.match(html, /<div id="hrVacBoardView">/);
    assert.match(html, /<div id="hrVacDetailView" class="rd-nomzod-view">/);
    assert.match(html, /<button type="button" id="hrVacDetailBack" class="rd-nomzod-crumb-link">Vakansiya<\/button>/);
    assert.match(html, /<button type="button" class="btn-outline-sm" id="hrVacRejectBtn">Rad etish…<\/button>/);
    assert.match(html, /<button type="button" class="btn-primary-sm" id="hrVacNextStageBtn"><\/button>/);
    assert.match(app, /function openHrVacDetail\(id\) \{/);
    assert.match(app, /function closeHrVacDetail\(\) \{/);
    assert.match(app, /function renderHrVacDetail\(\) \{/);
});

test('Nomzod: telefon qisman yashiriladi, "Ko\'rsatish" bosilganda jurnalga (izohlarga) yoziladi', () => {
    assert.match(app, /function hrVacMaskPhone\(phone\) \{/);
    const fn = app.slice(app.indexOf('function hrVacMaskPhone('), app.indexOf('function openHrVacDetail('));
    assert.match(fn, /const tail = digits\.slice\(-2\);/);
    const revealFn = app.slice(app.indexOf('async function hrVacRevealPhone('), app.indexOf('async function hrVacAddComment('));
    assert.match(revealFn, /text: 'Telefon raqami ko\\'rsatildi'/);
    assert.match(revealFn, /type: 'system'/);
    assert.match(revealFn, /method: 'PATCH'/);
});

test('Nomzod: "Keyingi bosqich" voronkadagi keyingi ustunga, "Rad etish" rad-javobi bosqichiga o\'tkazadi', () => {
    const fn = app.slice(app.indexOf('function renderHrVacDetail('), app.indexOf('async function hrVacSaveInterview('));
    assert.match(fn, /const idx = _hrVacStages\.findIndex\(s => s\.id === c\.stage\);/);
    assert.match(fn, /const next = idx >= 0 \? _hrVacStages\[idx \+ 1\] : null;/);
    assert.match(fn, /await hrVacMove\(c\.id, next\.id\)/);
    assert.match(fn, /await hrVacMove\(c\.id, 'rad-javobi'\)/);
    assert.match(fn, /if \(!confirm\(`\$\{c\.fullName\} rad etilsinmi\?`\)\) return;/);
});

test('Nomzod: suhbat vaqti/joyi PATCH orqali saqlanadi (interviewAt/interviewLocation)', () => {
    const fn = app.slice(app.indexOf('async function hrVacSaveInterview('), app.indexOf('async function hrVacRevealPhone('));
    assert.match(fn, /interviewAt: atInput \? new Date\(atInput\)\.toISOString\(\) : null,/);
    assert.match(fn, /interviewLocation: loc,/);
    // Backend: ustunlar mavjud productionga ALTER ... ADD COLUMN IF NOT EXISTS bilan qo'shiladi
    assert.match(hrCandidatesService, /ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS interview_at TIMESTAMPTZ/);
    assert.match(hrCandidatesService, /ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS interview_location TEXT DEFAULT ''/);
    assert.match(hrCandidatesService, /interviewAt: \(v\) => \['interview_at', v \? new Date\(v\) : null\],/);
    assert.match(hrCandidatesService, /interviewLocation: \(v\) => \['interview_location', String\(v \|\| ''\)\],/);
});

test('Nomzod: server bosqich/suhbat o\'zgarganda "Izohlar va tarix"ga avtomatik tizim yozuvi qo\'shadi', () => {
    assert.match(hrRoutes, /function systemComment\(text, author\) \{/);
    const patchFn = hrRoutes.slice(hrRoutes.indexOf("router.patch('/candidates/:id'"), hrRoutes.indexOf("router.delete('/candidates/:id'"));
    assert.match(patchFn, /Bosqich o'zgardi: \$\{fromLabel\} → \$\{toLabel\}/);
    assert.match(patchFn, /Suhbat vaqti belgilandi: \$\{whenStr\}/);
    assert.match(patchFn, /Suhbat vaqti bekor qilindi/);
});
