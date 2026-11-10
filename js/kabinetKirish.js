// Kabinetga kirish — admin/boshliq xodim kabinetini parolsiz ochadi va admin'ga qaytadi (11-noyabr, direktor).
// Server: POST /api/auth/impersonate {login} → {token, user, imp}. Admin tokeni mh_token_admin'da saqlanadi;
// kabinet ichida tepada qora chiziq: "<Ism> kabinetidasiz · Admin'ga qaytish". index.html va /teacher/ ikkalasida ulanadi.
(function () {
    'use strict';
    const K = { token: 'mh_token', user: 'mh_currentUser', adminToken: 'mh_token_admin', adminUser: 'mh_currentUser_admin', imp: 'mh_imp' };
    const ls = {
        get(k) { try { return localStorage.getItem(k); } catch { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch { /* yozib bo'lmadi */ } },
        del(k) { try { localStorage.removeItem(k); } catch { /* yo'q */ } },
    };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const json = v => { try { return JSON.parse(v || 'null'); } catch { return null; } };
    const first = n => String(n || '').trim().split(/\s+/)[0] || '';
    const targetFor = u => (u && u.role === 'teacher') ? '/teacher/' : '/index.html';
    const ROLES_OK = new Set(['admin', 'boshliq']);

    function css() {
        if (document.getElementById('kkStyle')) return;
        const st = document.createElement('style'); st.id = 'kkStyle';
        st.textContent = `
.kk-band{position:fixed;left:0;right:0;top:0;z-index:2147483000;background:#0B1220;color:#fff;font:600 13px/1.3 'Plus Jakarta Sans',system-ui,sans-serif;display:flex;align-items:center;gap:10px;padding:8px 12px;padding-top:max(8px,env(safe-area-inset-top));box-sizing:border-box;min-height:48px}
.kk-band b{font-weight:800}.kk-band span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kk-band button{margin-left:auto;flex:none;background:#fff;color:#0B1220;border:0;border-radius:10px;height:36px;padding:0 12px;font:inherit;font-weight:700;cursor:pointer}
body.kk-on{padding-top:48px!important}
.kk-ov{position:fixed;inset:0;z-index:2147483001;background:rgba(11,18,32,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.kk-dlg{background:#fff;color:#0B1220;border-radius:20px;max-width:420px;width:100%;padding:20px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;box-sizing:border-box}
.kk-dlg h3{margin:0 0 6px;font-size:18px;font-weight:800}.kk-dlg p{margin:0;font-size:14px;color:#4B5563;line-height:1.45}
.kk-warn{background:#FFFAEB;border:1px solid #FEDF89;color:#93370D;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.45;margin-top:12px}
.kk-err{color:#B42318;font-size:13px;margin-top:10px;min-height:1em}
.kk-dlg button{width:100%;height:46px;border-radius:14px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;margin-top:10px}
.kk-pri{background:#0057B8;color:#fff;border:0}.kk-pri[disabled]{opacity:.6;cursor:default}
.kk-ghost{background:#fff;color:#0B1220;border:1px solid #E6EAF2}
.kk-open{width:100%;height:44px;margin-top:12px;border-radius:14px;background:#fff;color:#0057B8;border:1.5px solid #0057B8;font:inherit;font-size:14px;font-weight:700;cursor:pointer}`;
        document.head.appendChild(st);
    }

    function active() { return !!(ls.get(K.adminToken) && ls.get(K.imp)); }

    function band() {
        if (!active() || document.getElementById('kkBand')) return;
        const info = json(ls.get(K.imp)) || {};
        css();
        const b = document.createElement('div');
        b.id = 'kkBand'; b.className = 'kk-band'; b.setAttribute('role', 'status');
        b.innerHTML = `<span aria-hidden="true">👁</span><span><b>${esc(first(info.name))}</b> kabinetidasiz${info.roleLabel ? ` · ${esc(info.roleLabel)}` : ''}</span><button type="button" data-kk-back>Admin'ga qaytish</button>`;
        b.querySelector('[data-kk-back]').addEventListener('click', back);
        document.body.appendChild(b);
        document.body.classList.add('kk-on');
    }

    async function back() {
        const tok = ls.get(K.token);
        // Kabinet sessiyasi serverda yopiladi (jurnal: sessiya tugadi); xato bo'lsa ham admin'ga qaytiladi.
        if (tok) await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + tok } }).catch(() => {});
        const at = ls.get(K.adminToken), au = ls.get(K.adminUser);
        if (at) ls.set(K.token, at); else ls.del(K.token);
        if (au) ls.set(K.user, au); else ls.del(K.user);
        ls.del(K.adminToken); ls.del(K.adminUser); ls.del(K.imp);
        location.replace('/index.html');
    }

    function canStart() {
        const u = json(ls.get(K.user));
        return !!(u && ROLES_OK.has(u.role) && !active());
    }

    // Xodim kartasi (Xodimlar) uchun tugma HTML'i — faqat admin/boshliqda, login'i bor faol xodimda.
    function buttonHtml(emp) {
        if (!canStart() || !emp || !emp.email || emp.offboardedAt) return '';
        return `<button type="button" class="kk-open" data-kk-open="${esc(emp.email)}" data-kk-name="${esc(emp.name || '')}" data-kk-role="${esc(emp.roleLabel || '')}">Kabinetiga kirish</button>`;
    }

    function open(login, name, roleLabel) {
        if (!canStart()) return;
        css();
        const ov = document.createElement('div');
        ov.className = 'kk-ov';
        ov.innerHTML = `<div class="kk-dlg" role="dialog" aria-modal="true" aria-labelledby="kkTitle">
            <h3 id="kkTitle">${esc(first(name) || login)} kabinetiga kirasizmi?</h3>
            <p>Siz uning ko'zi bilan ko'rasiz: menyular, o'quvchilar, davomat. Ko'rish va tekshirish uchun.</p>
            <div class="kk-warn">Kirish jurnalga yoziladi: kim, qachon, kimning kabinetiga. Sessiya 4 soatda o'zi tugaydi. Bu rejimda parol, profil va sessiyalarni o'zgartirib bo'lmaydi.</div>
            <div class="kk-err" data-kk-err></div>
            <button type="button" class="kk-pri" data-kk-go>Kirish</button>
            <button type="button" class="kk-ghost" data-kk-cancel>Bekor</button></div>`;
        const close = () => ov.remove();
        ov.addEventListener('click', e => { if (e.target === ov) close(); });
        ov.querySelector('[data-kk-cancel]').addEventListener('click', close);
        ov.querySelector('[data-kk-go]').addEventListener('click', async e => {
            const btn = e.currentTarget, err = ov.querySelector('[data-kk-err]');
            btn.disabled = true; btn.textContent = 'Kirilmoqda…'; err.textContent = '';
            try {
                const res = await fetch('/api/auth/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (ls.get(K.token) || '') }, body: JSON.stringify({ login }) });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.token) throw new Error(data.error || 'Kirib boʻlmadi');
                ls.set(K.adminToken, ls.get(K.token) || ''); ls.set(K.adminUser, ls.get(K.user) || '');
                ls.set(K.token, data.token); ls.set(K.user, JSON.stringify(data.user));
                ls.set(K.imp, JSON.stringify({ name: data.user?.name || name, roleLabel: roleLabel || '', by: data.imp?.by?.name || '', at: Date.now() }));
                location.replace(targetFor(data.user));
            } catch (x) {
                err.textContent = x.message || 'Xatolik'; btn.disabled = false; btn.textContent = 'Kirish';
            }
        });
        document.body.appendChild(ov);
        ov.querySelector('[data-kk-go]').focus();
    }

    document.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('[data-kk-open]');
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        open(b.dataset.kkOpen, b.dataset.kkName, b.dataset.kkRole);
    }, true);

    // Kabinet sessiyasi tugasa (4 soat) — admin'ga qaytish chizig'i baribir turadi; server 401 qaytarganda ham qaytish ishlaydi.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', band); else band();
    window.kabinetKirish = { buttonHtml, open, back, active };
})();
