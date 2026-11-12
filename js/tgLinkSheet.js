// Telefon ilovalari uchun @Domworkuz_bot ulash / uzish oynasi (12-noy, direktor: "teldan ham qilsa bo'ladigan").
// Kompyuterdagi Sozlamalar → Bildirishnomalar → Telegram bot bilan bir xil API va qadamlar (/api/domwork/staff-telegram):
//   Ulash: bir martalik havola → Telegramda Start → shu yerda "Ha, bu mening Telegramim" (tasdiq). Uzish: tasdiq bilan.
// Ishlatish: window.tgLink.open({ onChange }) — onChange ulanish holati o'zgarganda chaqiriladi.
(function () {
    'use strict';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const tok = () => { try { return localStorage.getItem('mh_token') || ''; } catch { return ''; } };
    async function api(path = '', body) {
        const r = await fetch('/api/domwork/staff-telegram' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok() }, body: body ? JSON.stringify(body) : undefined });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Xatolik');
        return d;
    }
    function css() {
        if (document.getElementById('tglCss')) return;
        const st = document.createElement('style'); st.id = 'tglCss';
        st.textContent = `.tgl-ov{position:fixed;inset:0;z-index:2147482000;background:rgba(11,18,32,.45);display:flex;align-items:flex-end;justify-content:center}
.tgl-sh{background:#fff;color:#0B1220;width:100%;max-width:480px;border-radius:24px 24px 0 0;padding:10px 16px calc(18px + env(safe-area-inset-bottom));font-family:'Plus Jakarta Sans',system-ui,sans-serif;box-sizing:border-box;max-height:88vh;overflow:auto}
.tgl-grab{width:40px;height:4px;border-radius:2px;background:#E2E8F0;margin:0 auto 12px}
.tgl-h{display:flex;align-items:center;justify-content:space-between;gap:12px}.tgl-h strong{font-size:19px;font-weight:800}
.tgl-x{width:40px;height:40px;border-radius:12px;border:1px solid #E6EAF2;background:#fff;font-size:20px;line-height:1;color:#0B1220}
.tgl-p{font-size:14px;color:#4B5563;line-height:1.5;margin:10px 0 0}
.tgl-card{border:1px solid #E6EAF2;border-radius:16px;padding:12px 14px;margin-top:12px;display:flex;align-items:center;gap:12px}
.tgl-card b{display:block;font-size:15px}.tgl-card small{font-size:13px;color:#4B5563}
.tgl-ok{margin-left:auto;font-size:12px;font-weight:700;color:#067647;background:#ECFDF3;border-radius:999px;padding:4px 10px}
.tgl-steps{margin:12px 0 0;padding-left:20px;font-size:14px;line-height:1.6;color:#0B1220}
.tgl-err{color:#B42318;font-size:13px;margin-top:10px}
.tgl-b{display:flex;align-items:center;justify-content:center;width:100%;height:52px;border-radius:14px;font:inherit;font-size:15px;font-weight:700;margin-top:12px;text-decoration:none;box-sizing:border-box;cursor:pointer}
.tgl-pri{background:#0057B8;color:#fff;border:0}.tgl-pri[disabled]{opacity:.6}
.tgl-out{background:#fff;color:#0B1220;border:1px solid #CBD5E1}.tgl-red{background:#fff;color:#B42318;border:1px solid #FECDCA}`;
        document.head.appendChild(st);
    }
    let cur = null;
    function close() { if (!cur) return; clearInterval(cur.timer); cur.ov.remove(); cur = null; }
    function open({ onChange } = {}) {
        close(); css();
        const ov = document.createElement('div'); ov.className = 'tgl-ov';
        ov.innerHTML = '<div class="tgl-sh" role="dialog" aria-modal="true" aria-labelledby="tglT"><div class="tgl-grab"></div><div class="tgl-h"><strong id="tglT">Telegram bot</strong><button type="button" class="tgl-x" aria-label="Yopish" data-x>×</button></div><div data-b><p class="tgl-p">Yuklanmoqda…</p></div></div>';
        document.body.appendChild(ov);
        const S = cur = { ov, timer: null, link: null, st: null, err: '', confirmUnlink: false, seq: 0 };
        const box = ov.querySelector('[data-b]');
        ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-x]')) close(); });
        const changed = () => { try { onChange && onChange(); } catch { /* chaqiruvchi xatosi oynani buzmasin */ } };
        const draw = () => {
            if (cur !== S) return;
            const st = S.st || {};
            if (st.linked) {
                const t = st.telegram || {};
                box.innerHTML = `<div class="tgl-card"><span><b>${esc(t.name || 'Telegram')}</b><small>${t.username ? '@' + esc(t.username) + ' · ' : ''}@Domworkuz_bot</small></span><span class="tgl-ok">Ulangan</span></div>
                    <p class="tgl-p">Bildirishnomalar shu Telegramga keladi. Boshqa Telegram ulash uchun avval uzing.</p>
                    ${S.err ? `<p class="tgl-err">${esc(S.err)}</p>` : ''}
                    ${S.confirmUnlink ? '<p class="tgl-p"><b>Rostdan uzilsinmi?</b> Qayta ulash uchun "Ulash" tugmasini bosasiz.</p><button type="button" class="tgl-b tgl-red" data-un2>Ha, uzish</button><button type="button" class="tgl-b tgl-out" data-no>Bekor</button>'
                        : '<button type="button" class="tgl-b tgl-red" data-un>Uzish</button>'}`;
                return;
            }
            const req = st.request, claimed = req && !req.expired && req.state === 'claimed' && req.telegram;
            const expired = !S.link || (req && (req.expired || req.state === 'cancelled'));
            if (!S.link && !S.err) {
                box.innerHTML = `<p class="tgl-p">Telegram ulanmagan. Ulansa, ish bo'yicha bildirishnomalar va bot menyusi Telegramda bo'ladi.</p><button type="button" class="tgl-b tgl-pri" data-new>Ulash</button>`;
                return;
            }
            box.innerHTML = claimed
                ? `<p class="tgl-p">Telegram: <b>${esc(req.telegram.name || 'Nomsiz')}</b>${req.telegram.username ? ' · @' + esc(req.telegram.username) : ''}. Bu sizning ish Telegramingizmi?</p>${S.err ? `<p class="tgl-err">${esc(S.err)}</p>` : ''}
                    <button type="button" class="tgl-b tgl-pri" data-ok>Ha, bu mening Telegramim</button><button type="button" class="tgl-b tgl-out" data-new>Yo'q, qaytadan</button>`
                : expired || !S.link
                    ? `<p class="tgl-p">${esc(S.err || 'Havola muddati tugadi (5 daqiqa).')}</p><button type="button" class="tgl-b tgl-pri" data-new>Yangi havola</button>`
                    : `<ol class="tgl-steps"><li>"Telegramda ochish" tugmasini bosing</li><li>Botda <b>Start</b> ni bosing</li><li>Shu yerga qayting — Telegram ismingiz chiqadi, tasdiqlaysiz</li></ol>
                        <a class="tgl-b tgl-pri" href="${esc(S.link.url)}" target="_blank" rel="noopener">Telegramda ochish</a><p class="tgl-p" style="text-align:center">Kutilmoqda… havola 5 daqiqa amal qiladi</p>`;
        };
        const load = async () => { try { S.st = await api(''); S.err = ''; } catch (e) { S.err = e.message; } draw(); };
        const poll = async seq => {
            if (cur !== S || seq !== S.seq || document.hidden) return;
            try { const st = await api(''); if (seq !== S.seq) return; S.st = st; if (st.linked) { clearInterval(S.timer); S.link = null; changed(); } }
            catch (e) { if (seq === S.seq) S.err = e.message; }
            draw();
        };
        const create = async () => {
            const seq = ++S.seq; S.err = ''; S.confirmUnlink = false;
            box.innerHTML = '<p class="tgl-p">Havola tayyorlanmoqda…</p>';
            try { S.link = await api('', {}); S.st = { request: S.link.request }; } catch (e) { S.link = null; S.err = e.message; }
            if (seq !== S.seq) return;
            draw(); clearInterval(S.timer); S.timer = setInterval(() => poll(seq), 3000);
        };
        box.addEventListener('click', async e => {
            const b = e.target.closest('button'); if (!b) return;
            if (b.hasAttribute('data-new')) return create();
            if (b.hasAttribute('data-un')) { S.confirmUnlink = true; return draw(); }
            if (b.hasAttribute('data-no')) { S.confirmUnlink = false; return draw(); }
            if (b.hasAttribute('data-un2')) {
                b.disabled = true;
                try { await api('/unlink', {}); S.confirmUnlink = false; S.link = null; await load(); changed(); } catch (x) { S.err = x.message; b.disabled = false; draw(); }
                return;
            }
            if (b.hasAttribute('data-ok')) {
                const req = S.st?.request; b.disabled = true;
                try { await api('/confirm', { requestId: req.id, telegramId: req.telegram.id }); clearInterval(S.timer); S.link = null; await load(); changed(); }
                catch (x) { S.err = x.message; b.disabled = false; draw(); }
            }
        });
        load();
    }
    window.tgLink = { open, close };
})();
