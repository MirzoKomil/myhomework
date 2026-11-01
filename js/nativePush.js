// "Domwork Team" Android ilovasi: push bildirishnomalar (FCM).
// Faqat ilova ichida ishlaydi (window.DomworkNative — MainActivity ko'prigi); brauzerda hech narsa qilmaydi.
// 1) Telefon tokeni login qilgan xodimga bog'lanadi: POST /api/staff/push/register (kuniga bir marta yangilanadi).
// 2) Sozlash oynasi: bildirishnoma ruxsati, batareya "cheklovsiz", Xiaomi/Realme/Vivo… avtozapusk — hammasi
//    yoqilmaguncha (12 soatda bir) chiqadi. Qo'lda ochish: window.dwPushSetup().
// 3) Bildirishnoma bosilsa (?notif=…&lead=…) — sotuvchi ilovasida lid kartasi ochiladi.
(function () {
    'use strict';
    const N = window.DomworkNative;
    if (!N) return;
    const REG = 'dw_push_reg', SNOOZE = 'dw_push_snooze', AUTO = 'dw_push_autostart';
    const ls = {
        get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* xotira yopiq */ } }
    };
    const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
    const token = () => ls.get('mh_token') || '';
    const user = () => safe(() => JSON.parse(ls.get('mh_currentUser') || 'null'), null) || {};
    const staff = () => !!token() && user().id && user().role && user().role !== 'student';
    const AUTOSTART_BRANDS = /xiaomi|redmi|poco|oppo|realme|oneplus|vivo|iqoo|huawei|honor|meizu|tecno|infinix|itel/;
    const brand = () => safe(() => N.manufacturer(), '');
    const needsAutostart = () => AUTOSTART_BRANDS.test(brand());

    async function api(path, body) {
        const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify(body || {}) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Xatolik');
        return j;
    }

    // ---------- token ----------
    let regBusy = false;
    async function register() {
        if (regBusy || !staff()) return;
        const t = safe(() => N.pushToken(), '');
        if (!t) { safe(() => N.refresh()); return; }
        const key = `${user().id}|${t}`, prev = safe(() => JSON.parse(ls.get(REG) || 'null'), null);
        if (prev && prev.key === key && Date.now() - prev.at < 86400000) return;
        regBusy = true;
        try {
            await api('/api/staff/push/register', { token: t, platform: 'android', appVersion: safe(() => N.appVersion(), ''), device: safe(() => N.device(), '') });
            ls.set(REG, JSON.stringify({ key, at: Date.now() }));
        } catch (e) { /* keyingi safar */ } finally { regBusy = false; }
    }

    // ---------- sozlash oynasi ----------
    const css = `
.dwp-ov{position:fixed;inset:0;z-index:99990;background:rgba(11,18,32,.48);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .22s}
.dwp-ov.on{opacity:1}
.dwp-sh{width:100%;max-width:480px;background:#fff;border-radius:24px 24px 0 0;padding:10px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px rgba(11,18,32,.18);transform:translateY(40px);transition:transform .28s cubic-bezier(.2,.9,.3,1.2);font-family:inherit;color:#0B1220}
.dwp-ov.on .dwp-sh{transform:none}
.dwp-grab{width:40px;height:5px;border-radius:3px;background:#D0D5DD;margin:0 auto 14px}
.dwp-hero{display:flex;gap:14px;align-items:center;margin-bottom:14px}
.dwp-bell{width:56px;height:56px;border-radius:18px;background:linear-gradient(135deg,#0065D6,#3B8BFF);color:#fff;display:flex;align-items:center;justify-content:center;flex:none;animation:dwpRing 2.4s ease-in-out infinite}
@keyframes dwpRing{0%,70%,100%{transform:rotate(0)}75%{transform:rotate(-12deg)}80%{transform:rotate(10deg)}85%{transform:rotate(-6deg)}90%{transform:rotate(4deg)}}
.dwp-h{font-size:19px;font-weight:800;margin:0 0 3px;letter-spacing:-.2px}
.dwp-p{font-size:13.5px;color:#475467;margin:0;line-height:1.45}
.dwp-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #EAECF0}
.dwp-n{width:28px;height:28px;border-radius:50%;background:#EEF4FF;color:#0065D6;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex:none;transition:background .2s}
.dwp-row.ok .dwp-n{background:#ECFDF3;color:#067647}
.dwp-t{flex:1;min-width:0}
.dwp-t b{display:block;font-size:14.5px;font-weight:700}
.dwp-t span{display:block;font-size:12.5px;color:#667085;line-height:1.35;margin-top:2px}
.dwp-b{border:0;border-radius:12px;min-height:38px;padding:0 14px;font:inherit;font-weight:700;font-size:13.5px;background:#0065D6;color:#fff;flex:none}
.dwp-b:active{transform:scale(.97)}
.dwp-row.ok .dwp-b{background:#ECFDF3;color:#067647;pointer-events:none}
.dwp-acts{display:flex;gap:10px;margin-top:14px}
.dwp-acts button{flex:1;min-height:48px;border-radius:14px;border:0;font:inherit;font-weight:800;font-size:15px}
.dwp-later{background:#F2F4F7;color:#344054}
.dwp-test{background:#0065D6;color:#fff}
.dwp-test:disabled{opacity:.5}
.dwp-msg{font-size:13px;text-align:center;margin-top:10px;min-height:18px;color:#475467}
.dwp-msg.ok{color:#067647}.dwp-msg.bad{color:#B42318}`;
    const BELL = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg>';
    const CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';

    function steps() {
        const list = [
            { id: 'notif', ok: safe(() => N.notifGranted(), true), title: 'Bildirishnomalar', sub: 'Yangi lid, sinov darsi va eslatmalar telefonga keladi', btn: 'Yoqish', act: () => N.requestNotif() },
            { id: 'battery', ok: !safe(() => N.batteryRestricted(), false), title: 'Batareya: cheklovsiz', sub: 'Ilova yopiq bo\'lsa ham xabar kechikmasin', btn: 'Sozlash', act: () => N.openBattery() }
        ];
        if (needsAutostart()) list.push({ id: 'auto', ok: ls.get(AUTO) === '1', title: 'Avtozapusk', sub: 'Ochilgan oynada "Domwork Team"ni yoqing, so\'ng qaytib "Bajarildi"ni bosing',
            btn: 'Ochish', act: () => { N.openAutostart(); autoOpened = true; } });
        return list;
    }
    let ov = null, autoOpened = false;
    function render() {
        if (!ov) return;
        const s = steps();
        ov.querySelector('.dwp-list').innerHTML = s.map((x, i) => `<div class="dwp-row${x.ok ? ' ok' : ''}" data-id="${x.id}">
            <div class="dwp-n">${x.ok ? CHECK : i + 1}</div>
            <div class="dwp-t"><b>${x.title}</b><span>${x.sub}</span></div>
            <button class="dwp-b" type="button">${x.ok ? 'Tayyor' : (x.id === 'auto' && autoOpened ? 'Bajarildi' : x.btn)}</button></div>`).join('');
        ov.querySelectorAll('.dwp-row').forEach(row => row.querySelector('.dwp-b').onclick = () => {
            const x = s.find(y => y.id === row.dataset.id);
            if (!x || x.ok) return;
            if (x.id === 'auto' && autoOpened) { ls.set(AUTO, '1'); render(); return; }
            safe(x.act);
            setTimeout(render, 400);
        });
        ov.querySelector('.dwp-test').disabled = !s[0].ok;
    }
    function close(snooze) {
        if (!ov) return;
        if (snooze) ls.set(SNOOZE, String(Date.now()));
        const o = ov; ov = null; o.classList.remove('on');
        setTimeout(() => o.remove(), 250);
    }
    function open() {
        if (ov || !staff()) return;
        if (!document.getElementById('dwp-css')) { const st = document.createElement('style'); st.id = 'dwp-css'; st.textContent = css; document.head.appendChild(st); }
        ov = document.createElement('div');
        ov.className = 'dwp-ov';
        ov.innerHTML = `<div class="dwp-sh" role="dialog" aria-modal="true"><div class="dwp-grab"></div>
            <div class="dwp-hero"><div class="dwp-bell">${BELL}</div><div><h3 class="dwp-h">Xabarlarni o'tkazib yubormang</h3>
            <p class="dwp-p">Ilova yopiq bo'lsa ham muhim xabarlar telefoningizga kelishi uchun ${needsAutostart() ? '3' : '2'} ta sozlamani yoqing.</p></div></div>
            <div class="dwp-list"></div>
            <div class="dwp-acts"><button class="dwp-later" type="button">Keyinroq</button><button class="dwp-test" type="button">Sinov xabari</button></div>
            <div class="dwp-msg" aria-live="polite"></div></div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) close(true); });
        ov.querySelector('.dwp-later').onclick = () => close(true);
        ov.querySelector('.dwp-test').onclick = async () => {
            const b = ov.querySelector('.dwp-test'), m = ov.querySelector('.dwp-msg');
            b.disabled = true; m.className = 'dwp-msg'; m.textContent = 'Yuborilmoqda…';
            try {
                ls.set(REG, ''); await register();
                await api('/api/staff/push/test');
                m.className = 'dwp-msg ok'; m.textContent = 'Yuborildi — bir necha soniyada telefoningizga keladi';
            } catch (e) {
                // Server hali sozlanmagan bo'lsa ham telefon tomoni tekshiriladi.
                safe(() => N.testLocal());
                m.className = 'dwp-msg bad'; m.textContent = e.message || 'Yuborilmadi';
            } finally { if (ov) b.disabled = false; }
        };
        render();
        requestAnimationFrame(() => ov && ov.classList.add('on'));
    }
    const allOk = () => steps().every(s => s.ok);
    function maybeOpen() {
        if (!staff() || allOk()) return;
        if (Date.now() - Number(ls.get(SNOOZE) || 0) < 12 * 3600000) return;
        open();
    }

    // ---------- bildirishnoma bosilganda ----------
    function deepLink() {
        const q = new URLSearchParams(location.search);
        if (!q.has('notif')) return;
        const lead = q.get('lead');
        try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* */ }
        if (!lead) return;
        let n = 0;
        const t = setInterval(() => {
            n++;
            const s = window.sotuvApp;
            const ready = s && typeof s.openLead === 'function' && typeof window.getLeadById === 'function'
                && safe(() => !!window.getLeadById(user().linkedManagerLang || 'russian', lead), false);
            if (ready) { clearInterval(t); safe(() => s.openLead(lead)); }
            else if (n > 40) clearInterval(t);
        }, 500);
    }

    // Ilova ko'prigi chaqiradi: ruxsat berildi, sozlamalardan qaytdi, token yangilandi.
    window.dwNativeChanged = () => { register(); render(); };
    window.dwPushSetup = () => { ls.set(SNOOZE, ''); open(); };

    function boot() {
        deepLink();
        register();
        setTimeout(maybeOpen, 2500);
        // Login sahifadan keyin (SPA) — token paydo bo'lganini kuzatish.
        let was = staff();
        setInterval(() => {
            const now = staff();
            if (now && !was) { register(); setTimeout(maybeOpen, 2000); }
            if (now) register();
            was = now;
        }, 15000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
