// Domwork Team — telefonda (≤900px) Xush kelibsiz (W1–W5) va Kirish (K1–K6) oynalari.
// Kompyuterda (≥901px) login.html dagi eski forma (js/auth.js) o'zgarmay ishlaydi.
// Kirish so'rovi va sessiyani saqlash js/auth.js dagi mhAuthRequest / mhSaveSession orqali — bitta joyda.
(function () {
    'use strict';

    const MQ = window.matchMedia('(max-width: 900px)');
    const WELCOME_KEY = 'dwt_welcome_seen';      // W1–W5 bir marta ko'rsatiladi
    const REMEMBER_KEY = 'mh_remember';          // "Meni eslab qol": '1' | '0'
    const LIVE_KEY = 'mh_session_live';          // sessionStorage: shu oyna ochiq ekan sessiya tirik
    const AUTO_KEY = 'tl_auto_at';               // avtomatik o'tish halqasidan himoya
    const FAIL_LIMIT_DEFAULT = 5, LOCK_MIN_DEFAULT = 15;
    const ROLES = { admin: 'Administrator', boshliq: 'Rahbar', rop: 'ROP', sales_manager: 'Sotuv menejeri', teacher: 'Ustoz', targetolog: 'Targetolog', hr: 'HR menejer' };
    const MARK = 'images/app/mark.png', LOGO = 'images/app/icon-512.png';

    // Admin Telegram manzili: <meta name="dwt-admin-telegram"> yoki window.DWT_ADMIN_TG (bo'sh bo'lsa — faqat yo'riqnoma).
    function adminTg() {
        const v = window.DWT_ADMIN_TG ?? document.querySelector('meta[name="dwt-admin-telegram"]')?.content ?? '';
        return String(v).trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '');
    }

    const ls = {
        get(k) { try { return localStorage.getItem(k); } catch { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch { /* saqlab bo'lmasa ham ishlayveradi */ } },
        del(k) { try { localStorage.removeItem(k); } catch { /* */ } }
    };
    const ss = {
        get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
        set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* */ } },
        del(k) { try { sessionStorage.removeItem(k); } catch { /* */ } }
    };

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const targetFor = user => (user && user.role === 'teacher') ? '/teacher/' : 'index.html';

    // ── Login formatlash: telefon ko'rinishida bo'lsa chiroyli, aks holda o'zgarmaydi ──
    const PHONE_RE = /^\+?[\d\s()-]*$/;
    function group9(d) {
        const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
        return d.length > 9 ? p + ' ' + d.slice(9) : p;
    }
    function fmtLogin(v) {
        if (!v || !PHONE_RE.test(v)) return v;
        const plus = v.trim().startsWith('+');
        const d = v.replace(/\D/g, '');
        if (!d) return plus ? '+' : v;
        if (d.startsWith('998') && (plus || d.length > 9)) return (plus ? '+' : '') + '998' + (d.length > 3 ? ' ' + group9(d.slice(3)) : '');
        return (plus ? '+' : '') + group9(d);
    }
    // Ko'rsatish uchun: 9 xonali mahalliy raqam bo'lsa "+998" bilan (faqat ko'rinish).
    const showLogin = v => /^\d{9}$/.test(v) ? '+998 ' + group9(v) : fmtLogin(v);
    // Serverga foydalanuvchi yozgani yuboriladi; telefon ko'rinishida faqat biz qo'ygan bo'shliqlar olib tashlanadi.
    const rawLogin = v => PHONE_RE.test(v) ? v.replace(/\s/g, '') : v.trim();

    // ── Ikonkalar ──
    const ARROW = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    const INFO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0065D6" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex:none;margin-top:1px"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
    const ERRI = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></svg>';
    const BACK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
    const PHONE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>';
    const CHECK = (s, w) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`;
    const hex = (id, op) => `<svg class="hx" aria-hidden="true" width="100%" height="100%"${op ? ` style="opacity:${op}"` : ''}><defs><pattern id="${id}" width="48" height="41.6" patternUnits="userSpaceOnUse"><path d="M12 0h24l12 20.8-12 20.8H12L0 20.8z" fill="none" stroke="#FFFFFF" stroke-width="1.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/></svg>`;
    const brand = () => `<span class="tl-brand"><img src="${MARK}" alt="Domwork"><b>Jamoa</b></span>`;

    // ── Holat ──
    const st = { scr: '', slide: 0, login: '', pw: '', remember: ls.get(REMEMBER_KEY) !== '0', err: null, busy: false, lockUntil: 0, user: null, pushed: false };
    let root = null, lockTimer = 0, sheetOpen = false;

    // ═════ W1–W5 ═════
    const SLIDES = [
        {
            bg: '#0065D6', h: 'Jamoamiz uchun bitta ilova', p: 'Darslar, lidlar, sinovlar va natijalar — hammasi bir joyda, telefoningizda.',
            ill: `<div class="col pi sc" style="align-items:center;gap:18px;position:relative">
                <span class="f1" style="width:170px;height:170px;border-radius:44px;background:#FFFFFF;display:grid;place-items:center;box-shadow:0 24px 50px rgba(0,0,0,.25);overflow:hidden"><img src="${LOGO}" alt="Domwork" style="width:150px;height:150px;object-fit:contain"></span>
                <span style="color:#FFFFFF;font-size:15px;font-weight:700;letter-spacing:.2em;opacity:.9">TEAM</span></div>
              <div class="tl-mc f2" style="left:22px;top:36px"><span class="tl-cc" style="background:#12B76A">✓</span><b style="font-size:13px">Davomat</b></div>
              <div class="tl-mc f1" style="right:20px;top:90px;animation-delay:.6s"><span class="tl-cc" style="background:#7F56D9">L</span><b style="font-size:13px">Lidlar</b></div>
              <div class="tl-mc f2" style="left:34px;bottom:40px;animation-delay:1s"><span class="tl-cc" style="background:#F79009">%</span><b style="font-size:13px">Reyting</b></div>`
        },
        {
            bg: '#EAF3FF', h: "Kirasiz — kabinetingiz o'zi ochiladi", p: "Login va parolni kiritasiz, ilova lavozimingizni taniydi va faqat sizga kerakli bo'limlarni ko'rsatadi.",
            ill: `<div class="sc" style="display:flex;flex-direction:column;gap:12px;width:270px;position:relative">${[
                ['#0065D6', 'U', 'Ustoz', 'Darslar, davomat, sinov'], ['#12B76A', 'S', 'Sotuv menejeri', 'Lidlar, sinov, reja'],
                ['#7F56D9', 'R', 'ROP', 'Jamoa va nazorat'], ['#F79009', 'A', 'Admin', 'Butun tizim']
            ].map((r, i) => `<div class="tl-role pi" style="animation-delay:${(i * 0.15).toFixed(2)}s"><span style="background:${r[0]}">${r[1]}</span><div class="col g1"><b style="font-size:15px">${r[2]}</b><span class="s">${r[3]}</span></div></div>`).join('')}</div>`
        },
        {
            bg: '#F5F7FB', h: 'Kuningiz bir qarashda', p: "Bugun nima qilish kerak — hammasi tartib bilan ko'rinib turadi. Har ish bir-ikki bosishda bajariladi.",
            ill: `<div class="sc" style="background:#FFFFFF;border-radius:24px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 20px 44px rgba(11,18,32,.16);width:300px;position:relative">
                <b style="font-size:15px">Bugun</b>${[
                ['.05s', '#0065D6', '14', 'Dars · 14:00', 'jonli dars, 60 daq', 'inf', '8 daq'], ['.2s', '#12B76A', 'L', "Lidga qo'ng'iroq", 'kelishilgan vaqt 15:30', 'ok', 'Yangi'],
                ['.35s', '#7F56D9', 'S', 'Sinov darsi · 17:00', '30 daq', 'vio', 'Ertaga'], ['.5s', '#F79009', '!', 'Belgilash kerak', 'bitta bosishda', 'wa', '1']
            ].map(r => `<div class="row pi" style="animation-delay:${r[0]};background:#F5F7FB;border-radius:14px;padding:10px"><span class="tl-cc" style="background:${r[1]}">${r[2]}</span><div class="col g1"><b style="font-size:14px">${r[3]}</b><span class="xs">${r[4]}</span></div><span class="tl-pill ${r[5]}">${r[6]}</span></div>`).join('')}</div>`
        },
        {
            bg: '#F4EBFF', h: 'Hech narsa yodingizdan chiqmaydi', p: "Muhim narsalar haqida o'z vaqtida xabar keladi. Har bir yutug'ingiz uchun esa tabrik.",
            ill: `<div class="sc" style="position:relative;width:300px;height:300px">
                <div class="tl-mc pi" style="left:0;right:0;top:20px;animation-delay:.1s"><span class="tl-cc" style="background:#12B76A;width:40px;height:40px;border-radius:12px">L</span><div class="col g1"><b style="font-size:14px">Yangi lid biriktirildi</b><span class="xs">ROP sizga topshirdi</span></div></div>
                <div class="tl-mc pi" style="left:14px;right:-6px;top:104px;animation-delay:.3s"><span class="tl-cc" style="background:#0065D6;width:40px;height:40px;border-radius:12px">10</span><div class="col g1"><b style="font-size:14px">10 daqiqadan keyin</b><span class="xs">dars yoki sinov boshlanadi</span></div></div>
                <div class="tl-mc pi" style="left:-6px;right:14px;top:188px;animation-delay:.5s;background:#0B1220;color:#FFFFFF"><span class="tl-cc" style="background:#12B76A;width:40px;height:40px;border-radius:12px">✓</span><div class="col g1"><b style="font-size:14px">Barakalla!</b><span style="font-size:12px;color:#6CE9A6;font-weight:700">bugungi reja bajarildi</span></div></div>
                <span class="f1" style="position:absolute;right:6px;top:-6px;width:14px;height:20px;border-radius:3px;background:#FDB022;transform:rotate(20deg)"></span>
                <span class="f2" style="position:absolute;left:10px;bottom:4px;width:12px;height:18px;border-radius:3px;background:#12B76A"></span>
                <span class="f1" style="position:absolute;right:40px;bottom:-2px;width:10px;height:14px;border-radius:3px;background:#F04438;animation-delay:.8s"></span></div>`
        },
        {
            bg: '#0B1220', h: "Mehnatingiz ko'rinib turadi", p: "Natija, reyting va maosh har kuni yangilanadi. Bildirishnomalarga ruxsat bering — muhim xabarni o'tkazib yubormaysiz.",
            ill: `<div class="col sc" style="align-items:center;gap:16px;position:relative">
                <div style="position:relative;width:170px;height:170px">
                  <svg width="170" height="170" viewBox="0 0 84 84" role="img" aria-label="Oylik natija halqasi"><circle cx="42" cy="42" r="36" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="8"/><circle class="ring" cx="42" cy="42" r="36" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-dasharray="226" stroke-dashoffset="60" transform="rotate(-90 42 42)"/></svg>
                  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#FFFFFF"><strong style="font-size:30px;font-weight:800">86%</strong><span style="font-size:13px;font-weight:700;opacity:.85">oylik natija</span></div></div>
                <div class="tl-mc f1" style="position:relative;gap:12px"><span class="tl-cc" style="background:#FDB022;color:#0B1220">1</span><b style="font-size:14px">Jamoa reytingi</b></div></div>`
        }
    ];

    function renderWelcome() {
        st.scr = 'w';
        root.innerHTML = `<div class="tl-wl" role="region" aria-roledescription="karusel" aria-label="Xush kelibsiz">
          <div class="tl-top">${brand()}<a href="#" class="tl-skip" data-skip>O'tkazib yuborish</a></div>
          <div class="tl-track" data-track><div class="tl-rail" data-rail>${SLIDES.map((s, i) => `
            <section class="tl-slide" aria-roledescription="sahifa" aria-label="${i + 1} / ${SLIDES.length}" aria-hidden="true">
              <div class="tl-ill" style="background:${s.bg}">${hex('tlHx' + i)}${s.ill}</div>
              <div class="tl-tx"><h1>${s.h}</h1><p>${s.p}</p></div>
            </section>`).join('')}</div></div>
          <div class="tl-dots" data-dots>${SLIDES.map(() => '<i></i>').join('')}</div>
          <button type="button" class="tl-nx" data-next></button>
        </div>`;
        const rail = root.querySelector('[data-rail]'), track = root.querySelector('[data-track]');
        const go = i => {
            st.slide = Math.max(0, Math.min(SLIDES.length - 1, i));
            rail.style.transform = `translateX(${-st.slide * 100}%)`;
            rail.querySelectorAll('.tl-slide').forEach((el, k) => { el.classList.toggle('on', k === st.slide); el.setAttribute('aria-hidden', k === st.slide ? 'false' : 'true'); });
            root.querySelectorAll('[data-dots] i').forEach((el, k) => el.classList.toggle('on', k === st.slide));
            root.querySelector('[data-dots]').setAttribute('aria-label', `${st.slide + 1} / ${SLIDES.length}`);
            const last = st.slide === SLIDES.length - 1;
            root.querySelector('[data-skip]').hidden = last;
            root.querySelector('[data-next]').innerHTML = (last ? 'Boshlash' : 'Keyingi') + ARROW;
        };
        go(st.slide);
        root.querySelector('[data-next]').onclick = () => st.slide < SLIDES.length - 1 ? go(st.slide + 1) : finishWelcome();
        // Dizayn bo'yicha "O'tkazib yuborish" oxirgi sahifaga (W5) olib boradi — u yerdan "Boshlash".
        root.querySelector('[data-skip]').onclick = e => { e.preventDefault(); go(SLIDES.length - 1); };
        // Surish (swipe)
        let x0 = 0, y0 = 0, dx = 0, drag = false, id = null;
        track.addEventListener('pointerdown', e => { id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0; drag = false; });
        track.addEventListener('pointermove', e => {
            if (id !== e.pointerId) return;
            const mx = e.clientX - x0, my = e.clientY - y0;
            if (!drag && Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) { drag = true; rail.classList.add('drag'); try { track.setPointerCapture(id); } catch { /* */ } }
            if (!drag) return;
            dx = mx;
            const edge = (st.slide === 0 && dx > 0) || (st.slide === SLIDES.length - 1 && dx < 0);
            rail.style.transform = `translateX(calc(${-st.slide * 100}% + ${edge ? dx / 3 : dx}px))`;
        });
        const end = e => {
            if (id !== e.pointerId) return;
            id = null; rail.classList.remove('drag');
            if (drag && Math.abs(dx) > Math.min(60, track.clientWidth * .18)) go(st.slide + (dx < 0 ? 1 : -1)); else go(st.slide);
            drag = false;
        };
        track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
        root.querySelector('.tl-wl').addEventListener('keydown', e => {
            if (e.key === 'ArrowRight') go(st.slide + 1);
            if (e.key === 'ArrowLeft') go(st.slide - 1);
        });
    }
    function finishWelcome() { ls.set(WELCOME_KEY, '1'); renderK1(); }

    // ═════ K1 — login ═════
    function renderK1() {
        st.scr = 'k1'; st.err = st.err && st.err.k1 ? st.err : null;
        const e = st.err;
        root.innerHTML = `<form class="tl-kw" data-f novalidate>
          <div class="tl-top">${brand()}</div>
          <div class="tl-hero u1">${hex('tlKHx')}<span class="lg fl"><img src="${LOGO}" alt=""></span><h1>Kirish</h1><p>Jamoadagi rolingiz kirgandan keyin o'zi aniqlanadi.</p></div>
          <div class="col u2" style="gap:8px">
            <label class="tl-lb" for="tlLogin">Login — telefon raqamingiz yoki loginingiz</label>
            <div class="tl-fld"><span class="pre" data-pre aria-hidden="true">+998</span><input id="tlLogin" name="username" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="90 123 45 67" value="${esc(fmtLogin(st.login))}"></div>
            ${e ? `<span class="tl-err" role="alert">${ERRI}${esc(e.msg)}</span>` : ''}
          </div>
          <div class="tl-hint u3">${INFO}<span>Login va parolni administrator beradi. Hali olmagan bo'lsangiz, unga murojaat qiling.</span></div>
          <button type="submit" class="tl-cta" style="margin-top:auto" data-go>Davom etish${ARROW}</button>
        </form>`;
        const inp = root.querySelector('#tlLogin'), btn = root.querySelector('[data-go]');
        let prev = inp.value;
        const pre = root.querySelector('[data-pre]');
        // "+998" — faqat ko'rinish uchun ishora (mahalliy raqam yozilayotganda); serverga qo'shilmaydi, server o'zi oxirgi 9 raqam bo'yicha topadi.
        const sync = () => {
            btn.disabled = !rawLogin(inp.value);
            const v = inp.value.trim();
            pre.hidden = !(PHONE_RE.test(v) && !v.startsWith('+') && !/^998\d/.test(v.replace(/\D/g, '')));
        };
        inp.addEventListener('input', ev => {
            let v = inp.value, caret = inp.selectionStart ?? v.length;
            if (PHONE_RE.test(v)) {
                let f = fmtLogin(v);
                // Bo'shliqni o'chirmoqchi bo'lsa — undan oldingi raqamni o'chiramiz.
                if (f === prev && /^delete/.test(ev.inputType || '') && v.length < prev.length) {
                    const before = v.slice(0, caret).replace(/\d(?=\D*$)/, '');
                    v = before + v.slice(caret); caret = before.length; f = fmtLogin(v);
                }
                const nd = v.slice(0, caret).replace(/\D/g, '').length;
                let pos = 0, seen = 0;
                while (pos < f.length && seen < nd) { if (/\d/.test(f[pos])) seen++; pos++; }
                if (nd === 0 && f.startsWith('+')) pos = Math.min(caret, 1);
                inp.value = f;
                try { inp.setSelectionRange(pos, pos); } catch { /* */ }
            }
            prev = inp.value; st.login = rawLogin(inp.value); sync();
        });
        sync();
        root.querySelector('[data-f]').onsubmit = ev => {
            ev.preventDefault();
            st.login = rawLogin(inp.value);
            if (!st.login) return;
            st.err = null; st.pw = '';
            if (!st.pushed) { try { history.pushState({ tl: 'k2' }, ''); st.pushed = true; } catch { /* */ } }
            renderK2(true);
        };
    }

    // ═════ K2 — parol (K3 — xato holati shu oynaning o'zida) ═════
    function renderK2(focus) {
        st.scr = 'k2';
        const e = st.err, wrong = e && e.kind === 'wrong';
        const limit = wrong ? (e.failLimit || FAIL_LIMIT_DEFAULT) : 0, used = wrong && e.attemptsLeft != null ? Math.max(0, limit - e.attemptsLeft) : 0;
        root.innerHTML = `<form class="tl-kw" data-f novalidate>
          <div class="tl-top"><button type="button" class="tl-bk" aria-label="Orqaga" data-back>${BACK}</button>${brand()}<span style="width:44px"></span></div>
          <div class="col${e ? '' : ' u1'}" style="gap:6px;padding-top:6px"><h1 class="tl-h">Parolni kiriting</h1><span class="s" style="font-size:15px">Har safar emas — telefon eslab qoladi.</span></div>
          <div class="tl-usr u1"><span class="ic">${PHONE}</span><div class="col g1"><span class="xs b">Login</span><b>${esc(showLogin(st.login))}</b></div><button type="button" data-back>O'zgartirish</button></div>
          <input type="text" name="username" autocomplete="username" value="${esc(st.login)}" hidden>
          <div class="col${e ? '' : ' u2'}" style="gap:8px">
            <label class="tl-lb" for="tlPw">Parol</label>
            <div class="tl-fld${wrong ? ' er shk' : ''}"><input id="tlPw" name="password" type="password" autocomplete="current-password" enterkeyhint="go" value="${esc(st.pw)}"${wrong ? ' aria-invalid="true" aria-describedby="tlErr"' : ''}><button type="button" class="tl-sw" data-show aria-pressed="false">Ko'rsatish</button></div>
            ${e ? `<span class="tl-err" id="tlErr" role="alert">${ERRI}${esc(e.msg)}</span>` : ''}
            ${wrong && e.attemptsLeft != null ? `<div class="tl-att" aria-hidden="true">${Array.from({ length: limit }, (_, i) => `<i${i < used ? ' class="u"' : ''}></i>`).join('')}</div>
            <span class="xs">${limit} marta xato bo'lsa, kirish ${LOCK_MIN_DEFAULT} daqiqaga yopiladi.</span>` : ''}
          </div>
          ${wrong ? `<div class="tl-hint">${INFO}<span>Katta-kichik harf farq qiladi. <b>Ko'rsatish</b> ni bosib tekshirib ko'ring.</span></div>` : `
          <div class="row u3" style="justify-content:space-between">
            <label class="tl-rem"><input type="checkbox" data-rem${st.remember ? ' checked' : ''}><span class="bx">${CHECK(14, 3.2)}</span>Meni eslab qol</label>
            <button type="button" class="tl-fg" data-forgot>Parolni unutdim?</button></div>`}
          <button type="submit" class="tl-cta" style="margin-top:auto" data-go>${e ? 'Qayta urinish' : 'Kirish'}${ARROW}</button>
          ${wrong ? '<button type="button" class="tl-lnk" data-forgot>Parolni unutdim?</button>' : ''}
        </form>`;
        const pw = root.querySelector('#tlPw'), btn = root.querySelector('[data-go]'), show = root.querySelector('[data-show]');
        const sync = () => { btn.disabled = !pw.value || st.busy; };
        pw.addEventListener('input', () => { st.pw = pw.value; sync(); root.querySelector('.tl-fld').classList.remove('shk'); });
        sync();
        show.onclick = () => {
            const vis = pw.type === 'password';
            pw.type = vis ? 'text' : 'password';
            show.textContent = vis ? 'Yashirish' : "Ko'rsatish";
            show.setAttribute('aria-pressed', String(vis));
        };
        const rem = root.querySelector('[data-rem]');
        if (rem) rem.onchange = () => { st.remember = rem.checked; };
        root.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { if (st.pushed) history.back(); else toK1(); });
        root.querySelectorAll('[data-forgot]').forEach(b => b.onclick = openForgot);
        root.querySelector('[data-f]').onsubmit = ev => { ev.preventDefault(); submit(); };
        if (focus) setTimeout(() => pw.focus(), 60);
    }
    function toK1() { st.err = null; st.pw = ''; st.pushed = false; renderK1(); }

    async function submit() {
        if (st.busy || !st.pw || !st.login) return;
        st.busy = true;
        const btn = root.querySelector('[data-go]');
        if (btn) { btn.disabled = true; btn.classList.add('busy'); btn.textContent = 'Kirilmoqda…'; }
        let out;
        try {
            const { res, data } = await window.mhAuthRequest(st.login, st.pw);
            out = { status: res.status, ok: res.ok, data };
        } catch {
            out = { status: 0, ok: false, data: {} };
        }
        st.busy = false;
        const d = out.data || {};
        if (out.ok && d.token) {
            window.mhSaveSession(d);
            ls.set(REMEMBER_KEY, st.remember ? '1' : '0');
            ss.set(LIVE_KEY, '1'); ss.del(AUTO_KEY);
            st.pw = '';
            renderK6(d.user || {});
            return;
        }
        if (out.status === 429 && d.locked) {
            st.lockUntil = Date.now() + Math.max(1, Number(d.retryAfterSec) || LOCK_MIN_DEFAULT * 60) * 1000;
            st.err = null; st.pw = '';
            renderK4();
            return;
        }
        if (out.status === 401) {
            const left = d.attemptsLeft != null ? Number(d.attemptsLeft) : null;
            st.err = { kind: 'wrong', attemptsLeft: left, failLimit: Number(d.failLimit) || FAIL_LIMIT_DEFAULT,
                msg: left != null ? `Parol noto'g'ri. Yana ${left} ta urinish qoldi.` : (d.error || "Login yoki parol noto'g'ri") };
        } else if (out.status === 0) {
            st.err = { kind: 'net', msg: "Internetga ulanib bo'lmadi. Aloqani tekshirib, qayta urinib ko'ring." };
        } else {
            st.err = { kind: 'other', msg: d.error || "Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring." };
        }
        renderK2(false);
    }

    // ═════ K4 — qulf ═════
    function renderK4() {
        st.scr = 'k4';
        const left = () => Math.max(0, Math.ceil((st.lockUntil - Date.now()) / 1000));
        const mins = Math.max(1, Math.ceil(left() / 60));
        root.innerHTML = `<div class="tl-kw">
          <div class="tl-top">${brand()}</div>
          <div class="col" style="flex:1;align-items:center;justify-content:center;text-align:center;gap:14px">
            <div class="tl-lock pp"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3M12 15v2"/></svg></div>
            <h1 style="font-size:26px;font-weight:800;letter-spacing:-.02em">Kirish ${mins} daqiqaga yopildi</h1>
            <p class="s" style="font-size:15px;line-height:1.5;max-width:300px">${FAIL_LIMIT_DEFAULT} marta noto'g'ri parol kiritildi. Bu akkauntingizni begonalardan himoya qiladi.</p>
            <div class="tl-timer" role="timer" aria-live="off"><span>QAYTA URINISH</span><strong data-t></strong></div>
            <div class="tl-hint" style="text-align:left;margin-top:8px">${INFO}<span>Bu siz bo'lmasangiz — administratorga xabar bering. Barcha urinishlar Profil → Xavfsizlik → Kirish tarixida ko'rinadi.</span></div>
          </div>
          <button type="button" class="tl-cta ghost" data-forgot>Parolni unutdim — adminga yozish</button>
        </div>`;
        root.querySelector('[data-forgot]').onclick = openForgot;
        const t = root.querySelector('[data-t]');
        const tick = () => {
            const s = left();
            t.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
            if (s <= 0) { clearInterval(lockTimer); lockTimer = 0; st.err = null; if (st.scr === 'k4') renderK2(true); }
        };
        clearInterval(lockTimer); tick(); lockTimer = setInterval(tick, 1000);
    }

    // ═════ K5 — parolni unutdim (pastki oyna) ═════
    function openForgot() {
        if (sheetOpen) return;
        sheetOpen = true;
        const tg = adminTg(), login = fmtLogin(st.login);
        const text = `Assalomu alaykum! Jamoa ilovasiga kirish parolimni unutdim.${login ? ' Login: ' + login : ''}`;
        const href = tg ? `https://t.me/${encodeURIComponent(tg)}?text=${encodeURIComponent(text)}` : '';
        const wrap = document.createElement('div');
        wrap.innerHTML = `<div class="tl-scrim" data-close></div>
          <section class="tl-sheet" role="dialog" aria-modal="true" aria-labelledby="tlK5">
            <span class="tl-grab" aria-hidden="true"></span>
            <div class="ki fl"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/></svg></div>
            <div class="col" style="gap:6px"><h2 id="tlK5" style="font-size:21px;font-weight:800">Parolni unutdingizmi?</h2><span class="s" style="font-size:15px;line-height:1.5">Administrator sizga vaqtinchalik parol beradi. Kirgandan keyin uni Profilda o'zingizga qulay parolga almashtirasiz.</span></div>
            <div class="col" style="gap:10px">
              <div class="tl-step"><span>1</span><span>${tg ? "Adminga yozing — login avtomatik qo'shiladi" : "Administratorga murojaat qiling va loginingizni ayting"}</span></div>
              <div class="tl-step"><span>2</span><span>Vaqtinchalik parol bilan kiring</span></div>
              <div class="tl-step"><span>3</span><span>Profilda o'zingizga yangi parol qo'ying</span></div>
            </div>
            ${tg ? `<a class="tl-cta" href="${esc(href)}" target="_blank" rel="noopener"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/></svg>Telegramda adminga yozish</a>`
                : `<div class="tl-hint">${INFO}<span>Administrator raqami yoki Telegram manzilini jamoa guruhidan oling.</span></div>`}
            <button type="button" class="tl-lnk" data-close>Esladim, qaytish</button>
          </section>`;
        root.appendChild(wrap);
        const prevFocus = document.activeElement;
        const sheet = wrap.querySelector('.tl-sheet');
        const close = () => {
            if (!sheetOpen) return;
            sheetOpen = false;
            document.removeEventListener('keydown', onKey);
            wrap.querySelectorAll('.tl-scrim,.tl-sheet').forEach(el => el.classList.add('out'));
            const rm = () => { wrap.remove(); try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch { /* */ } };
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) rm(); else setTimeout(rm, 220);
        };
        const onKey = e => {
            if (e.key === 'Escape') close();
            if (e.key === 'Tab') {
                const f = [...sheet.querySelectorAll('a,button')];
                if (!f.length) return;
                if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
                else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
            }
        };
        document.addEventListener('keydown', onKey);
        wrap.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
        // Pastga surib yopish
        let y0 = null;
        sheet.addEventListener('touchstart', e => { y0 = sheet.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
        sheet.addEventListener('touchend', e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 80) close(); y0 = null; });
        setTimeout(() => (sheet.querySelector('a.tl-cta') || sheet.querySelector('button')).focus({ preventScroll: true }), 50);
    }

    // ═════ K6 — xush kelibsiz ═════
    function renderK6(user) {
        st.scr = 'k6'; st.user = user;
        clearInterval(lockTimer);
        const target = targetFor(user);
        const name = String(user.name || '').trim().split(/\s+/)[0] || '';
        const role = ROLES[user.role] || '';
        const initial = (name[0] || 'D').toUpperCase();
        const CF = [['8%', '#FDB022', .1, 8, 14], ['20%', '#12B76A', .4, 7, 7], ['33%', '#2E90FA', .2, 9, 12], ['47%', '#F04438', .55, 6, 10], ['60%', '#FDB022', .3, 8, 8], ['72%', '#9E77ED', .05, 7, 13], ['84%', '#12B76A', .45, 9, 9], ['92%', '#2E90FA', .25, 6, 12]];
        root.innerHTML = `<div class="tl-kw" role="status" aria-live="polite">
          <div class="tl-cf" aria-hidden="true">${CF.map(c => `<i style="left:${c[0]};background:${c[1]};animation-delay:${c[2]}s;width:${c[3]}px;height:${c[4]}px"></i>`).join('')}</div>
          <div class="col" style="flex:1;align-items:center;justify-content:center;text-align:center;gap:16px;position:relative">
            <div style="position:relative;width:132px;height:132px">
              <span class="tl-av pp">${user.avatar ? `<img src="${esc(user.avatar)}" alt="" data-av>` : `<b>${esc(initial)}</b>`}</span>
              <span class="tl-ok pp" style="animation-delay:.35s">${CHECK(18, 3.2)}</span></div>
            <div class="col u2" style="gap:6px;align-items:center"><h1 style="font-size:30px;font-weight:800;letter-spacing:-.02em">${name ? `Salom, ${esc(name)}!` : 'Xush kelibsiz!'}</h1>${role ? `<span class="tl-badge">${esc(role)}</span>` : ''}</div>
            <p class="s u3" style="font-size:15px;line-height:1.5;max-width:290px">Kabinetingiz ochilmoqda. Bir soniya…</p>
            <div class="tl-ld u3"><i></i></div>
          </div>
          <a href="${target}" class="xs" style="text-align:center;min-height:44px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#4B5563">1,5 soniyada o'zi ochiladi</a>
        </div>`;
        const av = root.querySelector('[data-av]');
        if (av) av.onerror = () => { av.outerHTML = `<b>${esc(initial)}</b>`; };
        setTimeout(() => { location.replace(target); }, 1500);
    }

    // ── Boshlash ──
    // Sessiya bor bo'lsa (PWA start_url "/" shu sahifa) — kirish oynasini qayta ko'rsatmay, kabinetga o'tkazamiz.
    // "Meni eslab qol" belgilanmagan bo'lsa, sessiya faqat shu oyna (sessionStorage) yashaguncha — yangi ochilishda chiqariladi.
    function existingSession() {
        let user = null;
        try { user = JSON.parse(ls.get('mh_currentUser') || 'null'); } catch { user = null; }
        if (!ls.get('mh_token') || !user) return null;
        if (ls.get(REMEMBER_KEY) === '0' && !ss.get(LIVE_KEY)) {
            ls.del('mh_token'); ls.del('mh_currentUser');
            return null;
        }
        return user;
    }

    let started = false;
    function start() {
        if (started) return;
        started = true;
        root = document.getElementById('teamLogin');
        if (!root) return;
        const back = typeof window.mhBackMessage === 'function' ? window.mhBackMessage() : '';
        if (!back) {
            const user = existingSession();
            const last = Number(ss.get(AUTO_KEY)) || 0;
            if (user && Date.now() - last > 10000) { ss.set(AUTO_KEY, String(Date.now())); location.replace(targetFor(user)); return; }
        }
        if (back) { st.err = { k1: true, msg: back }; renderK1(); }
        else if (ls.get(WELCOME_KEY) === '1') renderK1();
        else renderWelcome();
        window.addEventListener('popstate', () => {
            if (st.scr === 'k2' && st.pushed) { st.pushed = false; toK1(); }
        });
    }

    function apply() {
        document.body.classList.toggle('tl-on', MQ.matches);
        if (MQ.matches) start();
    }
    if (MQ.addEventListener) MQ.addEventListener('change', apply); else if (MQ.addListener) MQ.addListener(apply);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
