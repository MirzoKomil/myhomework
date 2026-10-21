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
