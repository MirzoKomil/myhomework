// Majburiy bot faollashtirish oynasi (CRM va Domwork Teacher ilovasi).
// Admin Bot boshqaruvida "Qayta ishga tushirish"ni bosgandan keyin mos xodim (rus tili bo'limi va adminlar)
// botni ulamaguncha / botda "✅ Tayyorman"ni bosmaguncha CRMdan foydalana olmaydi.
// Xavfsizlik to'ri: server javob bermasa, bot tayyor bo'lmasa yoki xodim mos bo'lmasa — oyna chiqmaydi.
(function () {
    'use strict';
    if (window.__dwActivation || /login\.html$/.test(location.pathname)) return;
    window.__dwActivation = true;
    const BASE = '/api/domwork/staff-telegram';
    const LATER = 'dw_activation_later';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const S = { st: null, link: null, req: null, err: '', busy: false, poll: null, root: null, seq: 0, tok: null, sig: '', sent: 0 };
    const tokenNow = () => { try { return localStorage.getItem('mh_token') || ''; } catch { return ''; } };
    const laterKey = () => tokenNow().slice(-24);
    async function call(path, body) {
        const token = localStorage.getItem('mh_token');
        if (!token) throw Object.assign(Error('no-token'), { silent: true });
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
        try {
            const res = await fetch(BASE + path, { method: body ? 'POST' : 'GET', signal: ctl.signal,
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw Object.assign(Error(data.error || 'Xatolik'), { status: res.status });
            return data;
        } finally { clearTimeout(t); }
    }
    function css() {
        if (document.getElementById('dwActCss')) return;
        const st = document.createElement('style'); st.id = 'dwActCss';
        st.textContent = `.dwact{position:fixed;inset:0;z-index:2147483000;background:rgba(11,18,32,.62);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}
.dwact-card{background:#fff;color:#0B1220;border-radius:18px;max-width:440px;width:100%;max-height:calc(100vh - 32px);overflow:auto;box-shadow:0 24px 60px rgba(0,0,0,.28);padding:24px}
.dwact-ic{width:52px;height:52px;border-radius:14px;background:#229ED9;display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.dwact h2{font-size:20px;line-height:1.25;margin:0 0 8px;font-weight:700}
.dwact p{font-size:14px;line-height:1.5;margin:0 0 12px;color:#334155}
.dwact ol{margin:0 0 14px;padding-left:20px;font-size:14px;line-height:1.55;color:#334155}
.dwact-qr{display:block;width:180px;height:180px;margin:4px auto 14px;border-radius:10px;border:1px solid #E2E8F0}
.dwact-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;box-sizing:border-box;border:0;border-radius:12px;padding:13px 16px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;margin-top:8px;font-family:inherit}
.dwact-pri{background:#229ED9;color:#fff}.dwact-pri:hover{background:#1B8BC0}
.dwact-sec{background:#F1F5F9;color:#0B1220}.dwact-sec:hover{background:#E2E8F0}
.dwact-link{background:none;color:#64748B;font-weight:500;font-size:13px;padding:8px}
.dwact-btn[disabled]{opacity:.6;cursor:default}
.dwact-who{background:#F0F9FF;border:1px solid #BAE6FD;border-radius:12px;padding:12px;font-size:14px;margin-bottom:6px}
.dwact-err{color:#B91C1C;font-size:13px;margin:8px 0 0}
.dwact-wait{display:flex;align-items:center;gap:8px;font-size:13px;color:#64748B;margin-top:10px}
.dwact-dot{width:8px;height:8px;border-radius:50%;background:#229ED9;animation:dwactp 1.2s infinite}
@keyframes dwactp{0%,100%{opacity:.3}50%{opacity:1}}
@media (prefers-color-scheme:dark){.dwact-card{background:#0F172A;color:#F1F5F9}.dwact p,.dwact ol{color:#CBD5E1}.dwact-sec{background:#1E293B;color:#F1F5F9}.dwact-who{background:#0C2A3D;border-color:#155E75}}`;
        document.head.appendChild(st);
    }
    const PLANE = '<svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2 1.8 11.7c-1-.3-1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.3z"/></svg>';
    function close() {
        clearInterval(S.poll); S.poll = null; S.link = null; S.req = null; S.err = ''; S.sig = ''; S.sent = 0;
        if (S.root) { S.root.remove(); S.root = null; document.documentElement.style.overflow = ''; }
    }
    function startPoll() {
        clearInterval(S.poll);
        S.poll = setInterval(() => { if (!document.hidden && !S.busy) refresh(); }, 3500);
    }
    function draw() {
        const st = S.st; if (!st?.required) return close();
        // Faqat holat o'zgarganda qayta chizamiz (bosish/fokus yo'qolmasin).
        const sig = JSON.stringify([st, S.link?.url, S.req?.state, S.req?.expired, S.req?.telegram, S.err, S.sent > Date.now()]);
        if (S.root && sig === S.sig) return;
        S.sig = sig;
        css();
        if (!S.root) {
            S.root = document.createElement('div'); S.root.className = 'dwact'; S.root.setAttribute('role', 'dialog'); S.root.setAttribute('aria-modal', 'true');
            S.root.setAttribute('aria-labelledby', 'dwActT'); document.body.appendChild(S.root); document.documentElement.style.overflow = 'hidden';
            startPoll();
        }
        const first = esc(String(st.name || '').split(' ')[0]);
        let body;
        if (st.linked) {
            body = `<h2 id="dwActT">${first ? first + ', b' : 'B'}ot yangilandi — tasdiqlang</h2>
<p>Domwork Yordamchisi to‘liq ishga tushdi. Bot sizga Telegramda xabar va yangi menyu yubordi.</p>
<ol><li>Telegramda <b>@Domworkuz_bot</b>ni oching</li><li>Xabar ostidagi <b>✅ Tayyorman</b> tugmasini bosing</li></ol>
<a class="dwact-btn dwact-pri" href="https://t.me/Domworkuz_bot" target="_blank" rel="noopener">${PLANE.replace(/28/g, '20')} Botni ochish</a>
<button type="button" class="dwact-btn dwact-sec" data-act="resend" ${S.sent > Date.now() ? 'disabled' : ''}>${S.sent > Date.now() ? 'Yuborildi — Telegramni tekshiring' : 'Xabar kelmadimi? Qayta yuborish'}</button>
<div class="dwact-wait"><span class="dwact-dot"></span>“Tayyorman” bosilishi kutilmoqda — oyna o‘zi yopiladi</div>`;
        } else {
            const req = S.req, claimed = req && !req.expired && req.state === 'claimed' && req.telegram;
            const expired = S.link && req && (req.expired || req.state === 'cancelled');
            const qr = S.link?.qr;
            body = `<h2 id="dwActT">Telegram botni ulang</h2>
<p>Domwork Yordamchisi endi to‘liq ishlayapti: maosh, reyting, jadval, ruxsat so‘rash va CRM bildirishnomalari — hammasi Telegramda. Davom etish uchun botni ulang (1 daqiqa).</p>`
            + (claimed ? `<div class="dwact-who">Telegram: <b>${esc(req.telegram.name || 'Nomsiz')}</b>${req.telegram.username ? ' · @' + esc(req.telegram.username) : ''}<br>Bu sizning hisobingizmi?</div>
<button type="button" class="dwact-btn dwact-pri" data-act="confirm">Ha, bu mening Telegramim</button>
<button type="button" class="dwact-btn dwact-sec" data-act="new">Yo‘q, qaytadan</button>`
            : S.link && !expired ? `${qr ? `<svg class="dwact-qr" viewBox="-2 -2 ${qr.size + 4} ${qr.size + 4}" shape-rendering="crispEdges" role="img" aria-label="Bot QR kodi"><rect x="-2" y="-2" width="${qr.size + 4}" height="${qr.size + 4}" fill="#fff"/><path d="${esc(qr.path)}" fill="#0B1220"/></svg>` : ''}
<ol><li>“Telegramda ochish”ni bosing (yoki QR’ni telefon kamerasi bilan skanerlang)</li><li>Botda <b>Start</b> tugmasini bosing</li><li>Shu yerga qayting va tasdiqlang</li></ol>
<a class="dwact-btn dwact-pri" href="${esc(S.link.url)}" target="_blank" rel="noopener">${PLANE.replace(/28/g, '20')} Telegramda ochish</a>
<div class="dwact-wait"><span class="dwact-dot"></span>Start bosilishi kutilmoqda…</div>`
            : `${expired ? '<p>Havola muddati tugadi (5 daqiqa).</p>' : ''}<button type="button" class="dwact-btn dwact-pri" data-act="new">${PLANE.replace(/28/g, '20')} Botni ulash</button>`);
        }
        S.root.innerHTML = `<div class="dwact-card"><div class="dwact-ic">${PLANE}</div>${body}
${S.err ? `<p class="dwact-err">${esc(S.err)}</p>` : ''}
${st.admin ? '<button type="button" class="dwact-btn dwact-link" data-act="later">Keyinroq (faqat admin)</button>' : ''}</div>`;
        S.root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act, b)));
    }
    async function act(name, btn) {
        if (S.busy) return;
        S.busy = true; S.err = ''; if (btn) btn.disabled = true;
        try {
            if (name === 'later') { try { sessionStorage.setItem(LATER, laterKey()); } catch { } close(); return; }
            if (name === 'new') { S.link = await call('', {}); S.req = S.link.request; }
            if (name === 'confirm') { await call('/confirm', { requestId: S.req.id, telegramId: S.req.telegram.id }); S.link = null; S.req = null; }
            if (name === 'resend') { await call('/activation/resend', {}); S.sent = Date.now() + 30000; }
        } catch (e) {
            if (e.status === 401 || e.silent) { S.busy = false; return close(); }
            S.err = e.message + (e.status === 409 && name !== 'resend' ? ' Administratorga murojaat qiling — u sizni «Tayyor» deb belgilay oladi.' : '');
            if (e.status === 409 && name === 'new') S.link = null;
        }
        finally { S.busy = false; }
        await refresh();
        if (S.root && btn?.isConnected) btn.disabled = false;
    }
    async function refresh() {
        const tok = tokenNow();
        // Boshqa akkauntga kirildi / chiqildi — eski havola va holat tashlanadi.
        if (tok !== S.tok) { S.tok = tok; close(); S.st = null; }
        if (!tok) return close();
        const seq = ++S.seq;
        let st;
        try { st = await call('/activation'); }
        catch (e) { if (seq === S.seq && (e.status === 401 || e.silent)) close(); return; } // boshqa xato — CRMni bloklamaymiz, joriy holat qoladi
        if (seq !== S.seq || tokenNow() !== tok) return;
        try { if (st.admin && sessionStorage.getItem(LATER) === laterKey()) st = { required: false }; } catch { }
        S.st = st;
        if (st.required && !st.linked && S.link) {
            try { const link = await call(''); if (seq !== S.seq) return; S.req = link.request; } catch { }
        }
        draw();
    }
    function boot() {
        refresh();
        // Admin kun davomida "Qayta ishga tushirish"ni bossa ham ochiq oynalarda chiqadi; ustoz ilovasida sahifa yangilanmasdan kirish ham kuzatiladi.
        setInterval(() => { if (document.hidden || S.root) return; if (tokenNow() !== S.tok) refresh(); }, 5000);
        setInterval(() => { if (!document.hidden && !S.root) refresh(); }, 5 * 60000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 1200));
    else setTimeout(boot, 1200);
})();
