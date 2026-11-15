#!/usr/bin/env node
// Moliya D dizayni — headless brauzer tutun testi (namuna ma'lumot bilan ishlayotgan serverga qarshi).
// Talab: Node 22+ (global WebSocket/fetch), google-chrome (yoki CHROME=...), seed-moliya-demo.js bilan to'ldirilgan baza.
//   BASE_URL=http://localhost:3000 ADMIN_LOGIN=admin ADMIN_PASSWORD=... INVESTOR_LOGIN=investor-demo INVESTOR_PASSWORD=demo1234 \
//   TSV=<DATA_DIR>/jadval-namuna.tsv OUT=/tmp/moliya-smoke node scripts/moliya-smoke.cjs
// Tekshiradi: 1) TSV joylash → Muammolar "Jadval bilan farq" → sahifa qayta yuklansa ham bor; 2) investor Oktabr "To'landi";
// 3) xodim oyligi oynasi; 4) xarajat qo'shish; 5) investor kabineti (kompyuter va telefon). Har qadamda skrinshot (OUT).
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.env.OUT || '/tmp/moliya-smoke';
const ADMIN = { login: process.env.ADMIN_LOGIN || 'admin', password: process.env.ADMIN_PASSWORD || 'adminpass' };
const INVESTOR = { login: process.env.INVESTOR_LOGIN || 'investor-demo', password: process.env.INVESTOR_PASSWORD || 'demo1234' };
const TSV = process.env.TSV ? fs.readFileSync(process.env.TSV, 'utf8') : '';
const CHROME = process.env.CHROME || 'google-chrome';
const PORT = 9300 + Math.floor(Math.random() * 500);
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

async function browser() {
    const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'moliya-smoke-'));
    const proc = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
    for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(250); } }
    return { proc, dir };
}
async function page() {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise(r => { ws.onopen = r; });
    let id = 0; const pend = new Map(); const errors = [];
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); };
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable');
    const p = {
        errors,
        size: (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 }),
        go: async url => { await send('Page.navigate', { url }); await sleep(2500); },
        eval: async expr => { const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval'); return r.result?.result?.value; },
        // Skrinshotdan oldin: yuklanish oynasi (#teamSplash) yoki "Hisob-kitob qilinmoqda…" ko'rinib tursa — qadam yiqiladi.
        shot: async name => {
            const bad = (await send('Runtime.evaluate', { expression: `(() => { const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.classList.contains('out');
                if (vis(document.getElementById('teamSplash'))) return 'yuklanish oynasi (#teamSplash) ko‘rinib turibdi';
                const l = [...document.querySelectorAll('.fin-loading')].find(vis); return l ? 'yuklanmoqda: ' + l.textContent.trim() : ''; })()`, returnByValue: true })).result?.result?.value;
            if (bad && !name.startsWith('XATO')) throw new Error(name + ': ' + bad);
            const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); },
        close: () => ws.close()
    };
    return p;
}
// Brauzer ichidagi yordamchilar: element kutish, matn kutish.
const H = `const wait = async (sel, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { const e = typeof sel === 'function' ? sel() : document.querySelector(sel); if (e) return e; await new Promise(r => setTimeout(r, 200)); } throw new Error('topilmadi: ' + sel); };
    // Ilova apostroflarni (‘ ’ ') oʻzbekcha belgiga (ʻ ʼ) almashtiradi — solishtirish normallashtirilgan matnda.
    const norm = t => String(t || '').replace(/[ʻʼ’‘']/g, "'").replace(/[\\s\\u00a0\\u202f]+/g, ' ');
    const has = (el, txt) => norm(el?.innerText).includes(norm(txt));
    const waitText = async (txt, ms = 30000) => wait(() => has(document.body, txt) ? document.body : null, ms);
    const pdf = () => { const dt = new DataTransfer(); dt.items.add(new File(['%PDF-1.4\\n%%EOF'], 'chek.pdf', { type: 'application/pdf' })); return dt.files; };`;

async function login(p, who) {
    // Har kirish toza sessiyadan (oldingi foydalanuvchi tokeni tozalanadi).
    await p.go(BASE + '/login.html');
    await p.eval(`localStorage.clear(); sessionStorage.clear();`);
    await p.go(BASE + '/login.html');
    await p.eval(`${H} (await wait('#loginUsername')).value = ${JSON.stringify(who.login)}; document.getElementById('loginPassword').value = ${JSON.stringify(who.password)}; document.getElementById('loginBtn').click();`);
    await sleep(4000);
    await p.eval(`${H} await wait(() => typeof switchTab === 'function' && document.querySelector('#tab-finance') ? 1 : null);`);
}
const steps = [];
let current = null; // xato bo'lsa skrinshot shu sahifadan
async function step(name, fn) {
    const t = Date.now();
    try { await fn(); steps.push({ name, ok: true, ms: Date.now() - t }); console.log('OK  ', name); }
    catch (e) {
        const msg = String(e.message || e).split('\n')[0];
        steps.push({ name, ok: false, error: msg }); console.log('FAIL', name, '—', msg);
        try { await current?.shot('XATO-' + name.slice(0, 24).replace(/[^\w-]+/g, '_')); } catch { /* skrinshot ixtiyoriy */ }
    }
}

(async () => {
    const b = await browser();
    try {
        const p = await page(); current = p;
        await p.size(1440, 900);
        await login(p, ADMIN);
        const fin = section => `document.querySelector('#modalOverlay')?.style.display === 'flex' && closeModal(); switchTab('finance'); await new Promise(r => setTimeout(r, 400)); document.querySelector('[data-finance-lang="russian"]')?.click(); switchFinanceSection(${JSON.stringify(section)}); await new Promise(r => setTimeout(r, 1500));`;

        await step('1. TSV joylash → Muammolar "Jadval bilan farq" → qayta yuklashdan keyin ham bor', async () => {
            if (!TSV) throw new Error('TSV o‘zgaruvchisi berilmagan (seed: <DATA_DIR>/jadval-namuna.tsv)');
            await p.eval(`${H} ${fin('solishtirish')} const t = await wait('[data-fin-recon-text]'); t.value = ${JSON.stringify(TSV)}; document.querySelector('[data-fin-recon-parse]').click();
                (await wait('[data-fin-recon-run]')).click(); await wait('[data-fin-recon-filter]', 20000);`);
            await sleep(1500);
            await p.eval(`${H} ${fin('muammolar')} await wait(() => [...document.querySelectorAll('#finRoot-muammolar .fin-prob')].find(c => has(c, 'Jadval bilan farq') && has(c, '377 000')));`);
            await p.shot('1a-muammolar');
            await p.go(BASE + '/index.html'); await sleep(3000);
            await p.eval(`${H} ${fin('muammolar')} const card = await wait(() => [...document.querySelectorAll('#finRoot-muammolar .fin-prob')].find(c => has(c, 'Jadval bilan farq')));
                card.querySelector('button').click(); await waitText('CRM’da yo‘q yozuvlar');`);
            await p.shot('1b-jadval-farqi-qayta-yuklangach');
        });
        await step('2. Investor — Oktabr "To‘landi deb belgilash" (naqd kassada pul yo‘q: ogohlantirish, bloklanmaydi, Muammolar "Hisob manfiy")', async () => {
            await p.eval(`${H} ${fin('investor')} await wait('#investorRoot [data-inv-month]'); if (!document.querySelector('[data-inv-pay="2026-10"]')) throw new Error('Oktabr uchun "To‘landi deb belgilash" yo‘q (allaqachon to‘langanmi? bazani qayta seed qiling)');
                const btn = document.querySelector('[data-inv-pay="2026-10"]'); btn.click(); const doc = await wait('#modalBody [name="doc"]'); doc.files = pdf();
                // Naqd kassada pul yo'q — ogohlantirish chiqadi, lekin to'lov bloklanmaydi.
                const sel = document.querySelector('#modalBody [name="accountId"]'); sel.value = 'acc-cash'; sel.dispatchEvent(new Event('change'));
                await wait(() => has(document.querySelector('[data-inv-overdraft]'), 'Kassada yetarli emas') ? 1 : null);`);
            await p.shot('2a-investor-ogohlantirish');
            await p.eval(`${H} document.querySelector('[data-inv-ok]').click(); await waitText('To‘landi · ', 20000);`);
            await p.shot('2b-investor-tolandi');
            await p.eval(`${H} ${fin('muammolar')} document.querySelector('[data-fin-prob-back]')?.click(); await wait(() => [...document.querySelectorAll('#finRoot-muammolar .fin-prob')].find(c => has(c, 'Hisob manfiy')));`);
            await p.shot('2c-muammolar-hisob-manfiy');
        });
        await step('3. Xodim oyligi oynasi (Akademik rahbar)', async () => {
            await p.eval(`${H} ${fin('umumiy')} document.querySelector('#finRoot-umumiy [data-fin-dview=""]')?.click(); await new Promise(r => setTimeout(r, 800)); (await wait('#finRoot-umumiy .fin-donly [data-fin-dview="oylik"]')).click(); (await wait('[data-fin-dfilter="academic"]')).click();
                (await wait('[data-fin-person]')).click(); await wait(() => has(document.getElementById('modalBody'), 'Hisoblangan') ? 1 : null);`);
            await p.shot('3-xodim-oyligi');
            await p.eval(`closeModal();`);
        });
        await step('4. Xarajat qo‘shish (650 000 dan farqli 123 000)', async () => {
            // Umumiy asosiy ko'rinishiga qaytish (oldingi qadamdagi Oyliklar ichki ekranidan).
            await p.eval(`${H} ${fin('umumiy')} document.querySelector('#finRoot-umumiy [data-fin-dview=""]')?.click(); await new Promise(r => setTimeout(r, 800)); (await wait('#finRoot-umumiy [data-fin-qexp]')).click(); const b = await wait('#modalBody [data-fin-txn]');
                const a = b.querySelector('[name="amount"]'); a.value = '123000'; a.dispatchEvent(new Event('input', { bubbles: true }));
                b.querySelector('[name="counterparty"]').value = 'Smoke test xarajati';
                document.querySelector('#modalFooter [data-fin-submit]').click();
                const open = () => document.getElementById('modalOverlay')?.style.display === 'flex';
                await wait(() => !open() || document.querySelector('#modalBody [data-fin-error]')?.textContent ? 1 : null, 20000);
                if (open()) throw new Error('Saqlanmadi: ' + document.querySelector('#modalBody [data-fin-error]')?.textContent);
                ${fin('umumiy')} (await wait('#finRoot-umumiy .fin-donly [data-fin-dview="xarajat"]')).click(); await waitText('Smoke test xarajati');`);
            await p.shot('4-xarajat-qoshildi');
        });
        await step('4b. Kengaytirilgan — sarlavha hisob usuliga bog‘liq (kassa / hisoblash)', async () => {
            await p.eval(`${H} ${fin('kengaytirilgan')} await wait(() => has(document.getElementById('finRoot-kengaytirilgan'), 'Kassa bo‘yicha qoldiq') ? 1 : null);`);
            await p.shot('4b-kengaytirilgan-kassa');
            await p.eval(`${H} (await wait('#finRoot-kengaytirilgan [data-fin-basis="accrual"]')).click(); await wait(() => has(document.getElementById('finRoot-kengaytirilgan'), 'Sof foyda (hisoblash usuli)') ? 1 : null);`);
            await p.shot('4c-kengaytirilgan-hisoblash');
            await p.eval(`${H} document.querySelector('#finRoot-kengaytirilgan [data-fin-basis="cash"]').click(); await waitText('Kassa bo‘yicha qoldiq');`);
        });
        p.close();
        for (const [w, h, tag] of [[1440, 900, 'kompyuter'], [390, 844, 'telefon']]) {
            await step(`5. Investor kabineti (${tag})`, async () => {
                const q = await page(); current = q; await q.size(w, h); await login(q, INVESTOR);
                await q.eval(`${H} await wait(() => [...document.querySelectorAll('.fin-invcab-h [role=heading]')].find(e => e.getClientRects().length && has(e, 'Investor kabineti')));
                    await wait(() => /faqat ko'rish/i.test(norm(document.body.innerText)) ? 1 : null); await waitText('1 170 000'); if (document.querySelector('[data-inv-pay]')) throw new Error('investor to‘lov tugmasini ko‘rmasligi kerak');`);
                await q.shot(`5-investor-kabineti-${tag}`);
                if (q.errors.length) throw new Error('JS xato: ' + q.errors[0].slice(0, 200));
                q.close();
            });
        }
        // 6. Telefon (390×844): asosiy T_* ekranlarining hammasi — har birida aniq matn kutiladi.
        const t = await page(); current = t; await t.size(390, 844); await login(t, ADMIN);
        const go = section => `document.querySelector('#modalOverlay')?.style.display === 'flex' && closeModal(); document.querySelector('.fin-psheet')?.remove();
            if (!document.body.classList.contains('adm-crm')) { (await wait(() => [...document.querySelectorAll('button, a')].find(b => b.getClientRects().length && b.getBoundingClientRect().top > innerHeight - 120 && norm(b.innerText).trim() === 'Moliya'))).click(); await wait(() => document.body.classList.contains('adm-crm') ? 1 : null); }
            await new Promise(r => setTimeout(r, 400)); switchFinanceSection(${JSON.stringify(section)}); await new Promise(r => setTimeout(r, 1200));`;
        const vis = `const vq = s => [...document.querySelectorAll(s)].find(e => e.getClientRects().length);`;
        const phone = [
            ['T_umumiy', `${go('umumiy')} document.querySelector('#finRoot-umumiy [data-fin-dview=""]')?.click(); await wait(() => has(document.getElementById('finRoot-umumiy'), 'Jami tushum') && has(document.getElementById('finRoot-umumiy'), 'Oyliklar') ? 1 : null);`],
            ['T_tolovlar', `${go('tolovlar')} await waitText('Tekshiruv');`],
            ['T_muammolar', `${go('muammolar')} document.querySelector('[data-fin-prob-back]')?.click(); await wait(() => [...document.querySelectorAll('#finRoot-muammolar .fin-prob')].find(c => has(c, 'Jadval bilan farq') && has(c, 'Hal qilish')));`],
            ['T_koproq', `${go('umumiy')} document.querySelector('[data-fin-more-toggle]').click(); await wait(() => { const m = document.querySelector('[data-fin-more-menu]'); return m && !m.hidden && has(m, 'Batafsil') && has(m, 'Investor') ? 1 : null; });`],
            ['T_oyliklar', `document.querySelector('[data-fin-more-close]')?.click(); ${go('umumiy')} document.querySelector('#finRoot-umumiy [data-fin-dview=""]')?.click(); await new Promise(r => setTimeout(r, 600)); ${vis} (await wait(() => vq('#finRoot-umumiy [data-fin-dview="oylik"]'))).click(); (await wait(() => vq('[data-fin-dfilter="academic"]'))).click(); await wait(() => vq('[data-fin-person]'));`],
            ['T_xodim-oyligi', `${vis} (await wait(() => vq('[data-fin-person]'))).click(); await wait(() => has(document.getElementById('modalBody'), 'Hisoblangan') ? 1 : null);`],
            ['T_xarajatlar', `${go('umumiy')} document.querySelector('#finRoot-umumiy [data-fin-dview=""]')?.click(); await new Promise(r => setTimeout(r, 600)); ${vis} (await wait(() => vq('#finRoot-umumiy [data-fin-dview="xarajat"]'))).click(); await waitText('Smoke test xarajati');`],
            ['T_jadval-farqi', `${go('muammolar')} const c = await wait(() => [...document.querySelectorAll('#finRoot-muammolar .fin-prob')].find(c => has(c, 'Jadval bilan farq'))); c.querySelector('button').click(); await waitText('CRM’da yo‘q yozuvlar');`],
            ['T_davr', `${go('umumiy')} ${vis} (await wait(() => vq('[data-fin-period-open]'))).click(); await wait(() => { const e = document.querySelector('.fin-psheet'); return e && has(e, 'Bu oy') && has(e, 'Oxirgi 3 oy') ? 1 : null; });`],
            ['T_batafsil', `${go('batafsil')} await wait(() => [...document.querySelectorAll('#finRoot-batafsil .fin-hubrow')].find(b => has(b, 'Hisobotlar')));`],
            ['T_kengaytirilgan', `${go('kengaytirilgan')} await wait(() => has(document.getElementById('finRoot-kengaytirilgan'), 'Kassa bo‘yicha qoldiq') && has(document.getElementById('finRoot-kengaytirilgan'), 'mln so‘m') ? 1 : null);`],
            ['T_hisobotlar', `${go('hisobotlar')} await waitText('Foyda va zarar');`],
            ['T_investor', `${go('investor')} await wait('#investorRoot [data-inv-month]'); await waitText('1 170 000');`],
        ];
        for (const [name, js] of phone) await step(`6. Telefon ${name}`, async () => { await t.eval(`${H} ${js}`); await sleep(500); await t.shot('6-' + name); });
        if (t.errors.length) await step('6. Telefon JS xatosiz', async () => { throw new Error('JS xato: ' + t.errors[0].slice(0, 200)); });
        t.close();
    } finally { b.proc.kill(); }
    fs.writeFileSync(path.join(OUT, 'natija.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), steps }, null, 2));
    const failed = steps.filter(s => !s.ok).length;
    console.log(`\n${steps.length - failed}/${steps.length} qadam o‘tdi · skrinshotlar: ${OUT}`);
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
