'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/shell.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

test('yangi ko‘rinish html.rd bilan yoqiladi va oxirgi stil bo‘lib ulanadi', () => {
    assert.match(html, /<html lang="uz" class="rd">/);
    const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
    assert.match(links.at(-1), /^css\/shell\.css\?v=/);
});

test('shell.css dagi har bir qoida html.rd ostida (olib tashlansa eski ko‘rinish qaytadi)', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]+\{/g, '');
    const selectors = [];
    const re = /([^{}@]+)\{/g; let m;
    while ((m = re.exec(body))) {
        const sel = m[1].trim();
        if (!sel || /^(from|to|\d+%)$/.test(sel)) continue;
        selectors.push(...sel.split(',').map(s => s.trim()).filter(Boolean));
    }
    assert.ok(selectors.length > 40);
    for (const sel of selectors) assert.match(sel, /^html\.rd/, sel);
});

test('lid kartasida takroriy ikkinchi raqam ko‘rsatilmaydi', () => {
    const fn = app.slice(app.indexOf('function renderLeadCard('), app.indexOf('function renderLeadCard(') + 600);
    const line = fn.split('\n').find(l => l.includes('const phone2 ='));
    const phone2 = new Function('phone2Raw', 'normalized', line.replace('const phone2 =', 'return'));
    assert.strictEqual(phone2('+998 77 044 17 25', { phone: '+998770441725', phone2: '998 77 044 17 25' }), '');
    assert.strictEqual(phone2('+998 90 111 22 33', { phone: '+998770441725', phone2: '+998901112233' }), '+998 90 111 22 33');
    assert.strictEqual(phone2('', { phone: '+998770441725', phone2: '' }), '');
});

test('kanban ustuni rang nuqtasi uchun --col-accent beriladi', () => {
    assert.match(app, /data-status="\$\{col\.id\}" style="[^"]*--col-accent:\$\{col\.count\}"/);
});

test('admin bosh sahifasi: raqamlar mavjud hisoblardan, soxta vidjetlar olib tashlangan', () => {
    assert.doesNotMatch(html, /O'sish ko'rsatkichi|Vazifalar progressi/);
    assert.match(app, /function computeAdminHome\(/);
    assert.match(app, /isAdminHomeUser\(currentUser\)\) \{\n\s+container\.innerHTML = renderAdminHome/);
    assert.match(app, /const ADMIN_HOME_ROLES = new Set\(\['admin', 'boshliq'\]\)/);
});

test('sahifa sarlavhasi va foydalanuvchi nomi: matn textContent orqali (XSS yo‘q)', () => {
    const fn = app.slice(app.indexOf('function updateRdPageHead('), app.indexOf("document.addEventListener('click', e => {\n    if (e.target.closest?.('.sales-pinned"));
    assert.doesNotMatch(fn.replace("head.innerHTML = '<h1></h1><p></p>'", ''), /innerHTML/);
    assert.match(html, /id="userMeta" hidden/);
    assert.match(app, /meta\.querySelector\('b'\)\.textContent = user\.name/);
});

test('Reyting oylik: Oy liderlari (o‘rin puli sharti) va Bugungi obed, faqat oylik ko‘rinishda', () => {
    assert.match(app, /function renderRatingMonthBlocks\(ranked\)/);
    assert.match(app, /const need = monthTarget > 0 \? Math\.round\(monthTarget \* \(Number\(b\.pct\) \|\| 0\) \/ 100\)/);
    assert.match(app, /const monthly = _ratingView === 'normal' && _ratingPeriod === 'oylik';/);
});

test('sotuv menejeri bosh sahifasi: faqat o‘z lidlari, maosh o‘z endpointidan', () => {
    const fn = app.slice(app.indexOf('function computeManagerHome('), app.indexOf('function renderManagerHome('));
    assert.match(fn, /\.filter\(l => l\.managerId === managerId\)/);
    assert.match(app, /apiFetch\('\/api\/payroll\/me'\)\.then/);
    assert.match(app, /if \(currentUser\?\.role === 'sales_manager' && managerId\) \{\n\s+container\.innerHTML = renderManagerHome/);
});

test('ROP bosh sahifasi: faqat o‘z til yo‘nalishi', () => {
    const fn = app.slice(app.indexOf('function computeRopHome('), app.indexOf('function renderRopHome('));
    assert.match(fn, /const lang = user\?\.linkedRopLang \|\| 'english'/);
    assert.match(fn, /\(leads\[lang\] \|\| \[\]\)/);
    assert.match(fn, /\(s\.subject \|\| 'english'\) === lang/);
});

test('ustoz bosh sahifasi: telefon/to‘lov ko‘rsatilmaydi, faqat o‘z o‘quvchilari', () => {
    const fn = app.slice(app.indexOf('function teacherHomeStats('), app.indexOf('function bindAdminHome('));
    assert.doesNotMatch(fn, /\.phone|debtAmount|paymentDueDate/);
    assert.match(fn, /ids\.has\(String\(s\.teacherId \|\| ''\)\)/);
});

test('lid kartasi: bosqich o‘zgartirish kanban bilan bir xil yo‘ldan (so‘rovnomalar o‘tkazib yuborilmaydi)', () => {
    assert.match(app, /function requestLeadStageChange\(lang, leadId, toStatus\)/);
    assert.match(app, /requestLeadStageChange\(btn\.dataset\.leadMenuMove, btn\.dataset\.leadId, btn\.dataset\.moveTo\)/);
    assert.match(app, /if \(to\) requestLeadStageChange\(lang, leadId, to\);/);
    const fn = app.slice(app.indexOf('function requestLeadStageChange('), app.indexOf('function openLeadOverview('));
    for (const f of ['needsContactFailPrompt', 'needsSifatsizLidPrompt', 'needsPaymentClosedPrompt', 'needsFailedSalePrompt']) assert.match(fn, new RegExp(f));
});

test('lid kartasi: izoh karta ichida yoziladi (faqat yozish huquqi bo‘lsa)', () => {
    assert.match(app, /\$\{canEdit \? `<form class="lov-note" data-lov-note>/);
    assert.match(app, /createLeadComment\(\{ text, author: user\?\.name \|\| 'Admin', type: 'manual' \}\)/);
});

test('HR Xodimlar: jadval + tanlangan xodim paneli (mavjud karta, amallar o‘sha joyda)', () => {
    assert.match(app, /let _hrSelectedEmpId = null;/);
    assert.match(app, /<aside class="hrx-side" aria-label="Tanlangan xodim">\$\{selected \? renderHrEmployeeCard\(selected\) : ''\}<\/aside>/);
});

test('to‘lov oqimi: 3 qadam ko‘rsatkichi, mantiq o‘zgarmagan', () => {
    assert.match(app, /paymentStepsHtml\(1\) \+ bodyHtml/);
    assert.match(app, /paymentStepsHtml\(2\) \+ bodyHtml/);
    assert.match(app, /paymentStepsHtml\(3\) \+ bodyHtml/);
});

test('Dars jadvali: hafta ko‘rinishi bitta ustoz uchun, yon panel orqali band qilish/ko‘chirish/olib tashlash', () => {
    assert.match(app, /function getTimetableWeekDays\(anchor\)/);
    assert.match(app, /function renderTimetableWeekGrid\(teacher, entries, days\)/);
    assert.match(app, /function renderTtAside\(teacher\)/);
    // "Barcha ustozlar" hafta ko'rinishida tanlanmaydi - birinchi ustoz avtomatik tanlanadi
    assert.match(app, /if \(teacherId === 'all' \|\| !teachers\.some\(t => t\.id === teacherId\)\) teacherId = teachers\[0\]\.id;/);
    // Band qilish/ko'chirish eski funksiyalar bilan BIR XIL tekshiruvdan o'tadi
    const assignFn = app.slice(app.indexOf('function wireTtAssignPanel('), app.indexOf('function wireTtSelectedPanel('));
    assert.match(assignFn, /canFitWeeklyLesson\(getTeacherBusyWeeklySlots\(teacher\.id, studentId\), sel\.dow, sel\.time, dur\)/);
    assert.match(assignFn, /updateStudent\(studentId, \{ lessonDayOfWeek: sel\.dow, lessonTime: sel\.time, lessonDuration: dur \}\)/);
    const moveFn = app.slice(app.indexOf('function performTtMove('), app.indexOf('function wireTtGridCells('));
    assert.match(moveFn, /canFitWeeklyLesson\(getTeacherBusyWeeklySlots\(teacher\.id, studentId\), dow, time, duration\)/);
    // "Oy" rejimi eski (o'zgarmagan) oylik jadvalga tayanadi
    assert.match(app, /if \(_ttViewMode === 'month'\) \{\n\s+toggleTtChrome\(false\);/);
    // Mobil: kun tablari + bitta kunlik jadval
    assert.match(app, /function renderTtDayTabs\(weekDays, teacher\)/);
    assert.match(html, /<div class="rd-tt-day-tabs" id="ttDayTabs">/);
    assert.match(html, /<aside class="rd-tt-aside" id="ttAside">/);
});

test('Sozlamalar: Arxiv/Bildirishnomalar/Telegram guruhlari Profil sahifasining "Tizim" guruhiga ko‘chirildi', () => {
    // Alohida "Sozlamalar" tabi olib tashlangan, Sozlamalar tugmasi Profilga ochadi
    assert.doesNotMatch(html, /<section id="tab-settings"/);
    assert.match(html, /id="settingsToggle"[^>]*data-open-tab="profile"/);
    assert.match(app, /document\.getElementById\('settingsToggle'\)\?\.classList\.toggle\('active', tab === 'profile'\)/);
    // Uchala panel endi profil sahifasi ichida, alohida .profile-system-panel sifatida
    assert.match(html, /<div class="profile-body profile-system-panel" data-settings-panel="archive" id="settingsPanel-archive">/);
    assert.match(html, /<div class="profile-body profile-system-panel" data-settings-panel="telegram-groups" id="settingsPanel-telegram-groups">/);
    assert.match(html, /<div class="profile-body profile-system-panel" data-settings-panel="notifications" id="settingsPanel-notifications">/);
    // "Tizim" nav guruhi va uchta tugma
    assert.match(html, /<div class="profile-nav-group" id="profileNavSystemGroup">/);
    assert.match(html, /data-profile-section="archive"/);
    assert.match(html, /data-profile-section="notif-list"/);
    assert.match(html, /data-profile-section="telegram-groups"[^>]*id="profileNavTelegramGroups"/);
    // renderProfileBody uchta yangi bo'limni eski panel funksiyalariga (o'zgarmagan) yo'naltiradi
    assert.match(app, /const PROFILE_SYSTEM_SECTIONS = new Set\(\['archive', 'notif-list', 'telegram-groups'\]\);/);
    const panelFn = app.slice(app.indexOf('function renderProfileSystemPanel('), app.indexOf('function renderProfileBody('));
    assert.match(panelFn, /if \(section === 'archive'\) renderSettingsArchivePanel\(\);/);
    assert.match(panelFn, /renderNotificationPanel\(\);/);
    assert.match(panelFn, /domworkGroupsUI\.render\(\);/);
    // Telegram guruhlari faqat admin uchun ko'rinadi (avvalgi Sozlamalar sahifasidagi kabi)
    const navFn = app.slice(app.indexOf("const telegramNavBtn = document.getElementById('profileNavTelegramGroups');"), app.indexOf('switchProfileSection(_profileSection);'));
    assert.match(navFn, /const isAdmin = _profileUser\?\.role === 'admin';/);
    assert.match(navFn, /telegramNavBtn\.style\.display = isAdmin \? '' : 'none';/);
});
