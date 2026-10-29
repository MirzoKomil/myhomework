// Sozlamalar (UstozProfil, *SozProfil, UstozMaosh, YordamchiSozMaosh, *SozBildirish), bildirishnomalar
// paneli uchun server voqealari (UstozBildirishnoma) va Yo'riqnomalar (UstozYoriqnoma).
// Server: /api/staff/* (server/routes/staffSettings.js). Har xodim faqat o'z ma'lumotini oladi.
// js/app.js faqat bu modulni chaqiradi (renderProfileBody, renderMyGuides, openGuideArticle).
(function () {
    'use strict';
    const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const MON3 = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const monName = ym => cap(MON[Number(String(ym).slice(5, 7)) - 1] || '');
    const dmy = d => { const [y, m, day] = String(d).slice(0, 10).split('-'); return `${Number(day)}-${MON[Number(m) - 1]}${y ? ' ' + y : ''}`; };
    const dShort = d => { const [, m, day] = String(d).slice(0, 10).split('-'); return `${Number(day)}-${MON[Number(m) - 1].slice(0, 3)}`; };
    const tzDate = v => new Date(new Date(v).getTime() + 5 * 3600000).toISOString().slice(0, 10);
    const api = (path, opts = {}) => apiFetch('/api/staff' + path, { ...opts, ...(opts.body && typeof opts.body !== 'string' ? { body: JSON.stringify(opts.body) } : {}) });
    const toast = (m, ms) => (typeof showMiniToast === 'function' ? showMiniToast(m, ms) : console.log(m));
    const me = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || {};
    const isAdmin = u => ['admin', 'boshliq'].includes(u?.role);
    const ICON = {
        lock: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
        sync: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 01-15.5 6.2M3 12A9 9 0 0118.5 5.8"/><path d="M21 4v5h-5M3 20v-5h5"/></svg>',
        doc: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
        check: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>'
    };
    const head = (sub) => `<div class="profile-header-bar ss-head"><h1>Sozlamalar</h1><p>${esc(sub)}</p></div>`;
    const errBox = (e) => `<div class="ss-card ss-pad ss-err" role="alert">${esc(e?.message || e || 'Xatolik')}</div>`;
    // Bo'lim ma'lumoti kelguncha foydalanuvchi boshqa bo'limga o'tgan bo'lsa, eski javob yangi bo'limni bosib ketmasin.
    // app.js har renderProfileBody'da 'ss-body' klassini olib tashlaydi, render() esa qaytadan qo'yadi va token beradi.
    let renderSeq = 0;
    const guard = body => { const tok = body.dataset.ssTok; return () => body.isConnected && body.classList.contains('ss-body') && body.dataset.ssTok === tok; };

    // ── Profil ───────────────────────────────────────────────────────────────
    const VIS = {
        teacher: ['O\'quvchi ilovasida: ism, rasm, Telegram (dars havolasi uchun). Telefon raqamingiz o\'quvchiga ko\'rinmaydi.', 'Admin, ROP va hamkasblar: ism, rasm, telefon, Telegram.'],
        assistant: ['O\'quvchi ilovasida: ism, rasm va Telegram (aloqa uchun). Telefon raqamingiz o\'quvchiga ko\'rinmaydi.', 'Admin, ROP va hamkasblar: ism, rasm, telefon, Telegram.'],
        sales: ['O\'quvchi ilovasida ko\'rinmaysiz. O\'z sotgan o\'quvchilaringizning Telegram guruhida a\'zosiz — ism, rasm ko\'rinadi, telefon raqamingiz yo\'q.', 'Xodimlar (CRM, chat): ism, rasm, lavozim, telefon, Telegram.'],
        rop: ['O\'quvchi ilovasida ko\'rinmaysiz. Har bir o\'quvchi Telegram guruhida a\'zosiz — u yerda ism va rasmingiz ko\'rinadi.', 'Xodimlar (CRM, chat): ism, rasm, lavozim, telefon, Telegram.'],
        admin: ['O\'quvchi ilovasida ko\'rinmaysiz. Siz o\'quvchilarning Telegram guruhlariga a\'zo emassiz — kerak bo\'lsa Guruhlar sahifasidan qo\'shilasiz.', 'Xodimlar (CRM, chat): ism, rasm, lavozim, telefon, Telegram.'],
        other: ['O\'quvchi ilovasida ko\'rinmaysiz.', 'Xodimlar (CRM, chat): ism, rasm, lavozim, telefon, Telegram.']
    };
    const WORK_NOTE = { teacher: 'O\'zgartirish kerak bo\'lsa — Dars jadvali → Vaqtimni o\'zgartirish orqali so\'rov yuboring.', assistant: 'O\'quvchi biriktirish yoki olib tashlashni admin qiladi.' };
    // pending — tanlangan, lekin hali saqlanmagan avatar (personaj yo'li yoki yuklangan rasm data URL'i):
    // dizayn bo'yicha avatar "Shaxsiy ma'lumotlar" kartasidagi "Saqlash" bilan saqlanadi, "Bekor" qaytaradi.
    const P = { tab: 'preset', set: null, showAll: false, data: null, taken: [], pending: null };

    async function renderProfile(body) {
        const ok = guard(body);
        body.innerHTML = head('Profil · ism, login va lavozimni admin o\'zgartiradi') + '<div class="ss-col"><div class="ss-card ss-pad ss-muted">Yuklanmoqda…</div></div>';
        try {
            const [d, tk] = await Promise.all([api('/profile'), apiFetch('/api/school/avatars/taken').catch(() => ({ taken: [] }))]);
            if (!ok()) return;
            P.data = d; P.taken = tk.taken || []; P.pending = null;
            if (!P.set) P.set = /\/m\d\d\.webp$/.test(d.user.avatar) ? 'm' : /\/f\d\d\.webp$/.test(d.user.avatar) ? 'f' : (/^(m|male|erkak)/i.test(d.gender) ? 'm' : 'f');
            drawProfile(body);
        } catch (e) { if (ok()) body.innerHTML = head('Profil') + errBox(e); }
    }
    // Tug'ilgan kun (dizayn: "14-may"). Server formati: YYYY-MM-DD yoki MM-DD (services/staffSettings BDAY_RE).
    function bdayText(b) {
        const m = String(b || '').match(/^(?:(\d{4})-)?(\d{2})-(\d{2})$/);
        return m ? `${Number(m[3])}-${MON[Number(m[2]) - 1] || ''}` : '';
    }
    // "14-may", "14 may", "14.05", "14.05.1999", "1999-05-14" → server formati; bo'sh → ''; noto'g'ri → null.
    // Yil kiritilmasa va kun-oy o'zgarmagan bo'lsa, avvalgi yil saqlanib qoladi.
    function bdayParse(v, prev) {
        const t = String(v || '').trim().toLowerCase();
        if (!t) return '';
        let y = '', mo = 0, d = 0, m;
        if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [y, mo, d] = [m[1], +m[2], +m[3]];
        else if ((m = t.match(/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{4}))?$/))) [d, mo, y] = [+m[1], +m[2], m[3] || ''];
        else if ((m = t.match(/^(\d{1,2})[\s-]+([a-z'ʻ‘]+)(?:[\s-]+(\d{4}))?$/))) { d = +m[1]; y = m[3] || ''; const w = m[2].replace(/['ʻ‘]/g, ''); const c = MON.map((n, i) => [n.replace(/'/g, ''), i + 1]).filter(([n]) => w.length >= 3 && (n.startsWith(w) || w.startsWith(n))); mo = c.length === 1 ? c[0][1] : 0; }
        if (!mo || mo > 12 || !d || d > new Date(Date.UTC(2000, mo, 0)).getUTCDate()) return null;
        const md = `${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const pm = String(prev || '').match(/^(\d{4})-(\d{2}-\d{2})$/);
        if (!y && pm && pm[2] === md) y = pm[1];
        return y ? `${y}-${md}` : md;
    }
    function avatarImg(src, cls = '') { return src ? `<img class="${cls}" src="${esc(String(src).replace(/^\//, ''))}" alt="">` : ''; }
    function initials(n) { return esc(String(n || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()); }
    function drawProfile(body) {
        const d = P.data, u = d.user, x = d.extra, kind = d.kind, office = ['admin', 'rop', 'sales'].includes(kind);
        const cur = P.pending || u.avatar;
        // Tartib (UstozProfil, YordamchiSozProfil): to'plamdagi tabiiy tartib (01…36), band bo'lganlar o'z joyida "band" yozuvi bilan.
        // Joriy/tanlangan personaj birinchi 12 tadan keyin bo'lsa, 12-o'ringa chiqariladi — doim ko'rinib tursin.
        const all = Array.from({ length: 36 }, (_, i) => `/images/staff-avatars/${P.set}${String(i + 1).padStart(2, '0')}.webp`);
        let shown = P.showAll ? all : all.slice(0, 12);
        const keep = [cur, u.avatar].find(x => all.includes(x) && !shown.includes(x));
        if (keep) shown = [...shown.slice(0, 11), keep];
        const grid = shown.map(src => { const tk = P.taken.includes(src) && src !== u.avatar, on = src === cur, i = all.indexOf(src);
            return `<button type="button" class="ss-av${on ? ' on' : ''}${tk ? ' tk' : ''}" data-av="${esc(src)}" ${tk ? 'disabled aria-disabled="true" title="Band — boshqa xodim tanlagan"' : `aria-pressed="${on}" title="Tanlash"`} aria-label="Personaj ${i + 1}${tk ? ' · band' : ''}"><img src="${esc(src.slice(1))}" alt="" loading="lazy"></button>`; }).join('');
        const tabs = [['own', 'O\'z rasmim'], ['preset', 'Personaj tanlash'], ['auto', 'Avtomatik']];
        const lockF = (label, val, note, id) => `<label class="ss-f"><span>${esc(label)} <span aria-hidden="true">🔒</span></span><input id="${id}" value="${esc(val)}" disabled aria-describedby="${id}N"><small id="${id}N">${esc(note)}</small></label>`;
        const nameField = d.canEditName
            ? `<label class="ss-f"><span>Ism familiya</span><input id="ssName" value="${esc(u.name)}" maxlength="80" autocomplete="name"><small>boshqa admin bilan kelishib o'zgartiring</small></label>`
            : lockF('Ism familiya', u.name, 'admin o\'zgartiradi', 'ssName');
        const fourth = office
            ? `<label class="ss-f"><span>Ichki raqam</span><input id="ssExt" value="${esc(x.ext)}" inputmode="numeric" maxlength="6" placeholder="masalan 214"><small>ofis IP-telefoni</small></label>`
            : `<label class="ss-f"><span>Qisqacha o'zim haqimda</span><input id="ssBio" value="${esc(u.bio)}" maxlength="300" placeholder="masalan: IELTS 7.5 · 4 yillik tajriba"></label>`;
        const workBadge = office ? 'HR va admin belgilaydi' : 'admin belgilaydi';
        const vis = VIS[kind] || VIS.other;
        const pendingNote = P.pending ? '<span class="ss-mt ss-pend" role="status">tanlandi · quyidagi Saqlash bilan saqlanadi</span>' : '<span class="ss-mt">quyidagi Saqlash bilan saqlanadi</span>';
        body.innerHTML = head(kind === 'admin' ? 'Profil · Administrator' : 'Profil · ism, login va lavozimni admin o\'zgartiradi') + `<div class="ss-col">
          <section class="ss-card" aria-labelledby="ssAvH">
            <header class="ss-ch"><h3 id="ssAvH">Avatar</h3><span class="ss-mt">${kind === 'teacher' || kind === 'assistant' ? 'CRM, student app va xodimlar chatida bir xil ko\'rinadi' : 'CRM va xodimlar chatida bir xil ko\'rinadi'}</span></header>
            <div class="ss-avbar"><div class="ss-seg" role="tablist" aria-label="Avatar turi">${tabs.map(([k, l]) => `<button type="button" role="tab" data-avtab="${k}" aria-selected="${P.tab === k}">${l}</button>`).join('')}</div>
              ${P.tab !== 'own' ? `<div class="ss-seg" role="group" aria-label="To'plam"><button type="button" data-set="f" aria-pressed="${P.set === 'f'}">Ayollar · 36</button><button type="button" data-set="m" aria-pressed="${P.set === 'm'}">Erkaklar · 36</button></div>` : ''}</div>
            ${P.tab === 'preset' ? `<div class="ss-avg">${grid}${P.showAll ? '' : '<button type="button" class="ss-av ss-more" data-more aria-label="Yana 24 ta personajni ko\'rsatish">+24</button>'}</div>`
              : P.tab === 'auto' ? `<div class="ss-auto"><p>Tizim ${P.set === 'm' ? 'erkaklar' : 'ayollar'} to'plamidan band bo'lmagan birinchi personajni tanlaydi.</p><button type="button" class="ss-btn ss-btn--sm" data-auto>Avtomatik tanlash</button></div>`
              : `<div class="ss-auto"><div class="ss-avbig sm">${cur ? avatarImg(cur) : initials(u.name)}</div><div class="ss-acts"><button type="button" class="ss-btn ss-btn--sm" data-upload>Rasm tanlash</button>${u.avatar && !/staff-avatars/.test(u.avatar) && !P.pending ? '<button type="button" class="ss-btn ss-btn--sm ss-btn--ghost" data-avrm>Rasmni olib tashlash</button>' : ''}</div></div>`}
            <footer class="ss-cf"><span class="ss-mt">O'z rasmingiz: JPG/PNG, yuz aniq ko'rinsin · "Avtomatik" — tizim jinsingizga qarab band bo'lmagan personajni beradi</span>
              <div class="ss-acts ss-acts--c"><button type="button" class="ss-btn ss-btn--sm" data-upload-go>Rasm yuklash</button>${pendingNote}</div>
              <input type="file" id="ssAvFile" accept="image/jpeg,image/png,image/webp" hidden></footer>
          </section>
          <section class="ss-card" aria-labelledby="ssPiH">
            <header class="ss-ch"><h3 id="ssPiH">Shaxsiy ma'lumotlar</h3><div class="ss-acts"><button type="button" class="ss-btn ss-btn--sm" data-cancel>Bekor</button><button type="button" class="ss-btn ss-btn--sm ss-btn--pri" data-save>Saqlash</button></div></header>
            <div class="ss-pi">
              <div class="ss-pi-av"><div class="ss-avbig">${cur ? avatarImg(cur) : initials(u.name)}</div><small>${P.pending ? 'yangi avatar · saqlanmagan' : 'joriy avatar'}</small></div>
              <div class="ss-fg">
                ${nameField}
                <label class="ss-f"><span>Telefon</span><input id="ssPhone" type="tel" value="${esc(u.phone)}" placeholder="+998 90 123 45 67" autocomplete="tel"></label>
                ${lockF('Email (login)', u.email, kind === 'admin' ? 'login o\'zgarmaydi' : 'login — admin o\'zgartiradi', 'ssEmail')}
                <label class="ss-f"><span>Telegram</span><div class="ss-inp-pill"><input id="ssTg" value="${esc(x.telegram)}" placeholder="@username" autocomplete="off">${x.telegram ? '<i class="ss-pill ok">kiritilgan</i>' : ''}</div></label>
                <label class="ss-f"><span>Tug'ilgan kun</span><input id="ssBday" value="${esc(bdayText(x.birthday))}" placeholder="masalan 14-may" autocomplete="bday" inputmode="text"></label>
                ${fourth}
              </div>
              <p class="ss-msg" id="ssMsg" role="status"></p>
            </div>
          </section>
          <section class="ss-card" aria-labelledby="ssWH">
            <header class="ss-ch"><h3 id="ssWH">Ish ma'lumotlari</h3><span class="ss-badge">${workBadge}</span></header>
            <dl class="ss-dl">${d.work.map(r => `<dt>${esc(r.label)}</dt><dd>${esc(/^\d{4}-\d{2}-\d{2}$/.test(r.value) ? dmy(r.value) : r.value)}</dd>`).join('') || '<dt>Lavozim</dt><dd>—</dd>'}</dl>
            ${WORK_NOTE[kind] ? `<p class="ss-mt ss-wnote">${esc(WORK_NOTE[kind])}</p>` : ''}
          </section>
          <section class="ss-card" aria-labelledby="ssVH">
            <header class="ss-ch"><h3 id="ssVH">Boshqalarga nima ko'rinadi</h3></header>
            <p class="ss-mt ss-vis">${esc(vis[0])}<br>${esc(vis[1])}</p>
          </section></div>`;
        bindProfile(body);
    }
    function applyAvatar(avatar) {
        P.data.user.avatar = avatar;
        const cu = me(); if (cu && typeof setCurrentUser === 'function') { setCurrentUser({ ...cu, avatar }); if (typeof syncHeaderAvatar === 'function') syncHeaderAvatar(getCurrentUser()); if (typeof initUserUI === 'function') initUserUI(getCurrentUser()); }
    }
    // Tanlangan avatarni saqlash: personaj — PUT /api/school/me/avatar (band tekshiruvi serverda), o'z rasmi — apiUploadAvatar.
    async function savePendingAvatar() {
        const src = P.pending; if (!src || src === P.data.user.avatar) { P.pending = null; return; }
        if (src.startsWith('data:')) { const r = await apiUploadAvatar(src); applyAvatar(r?.user?.avatar || src); }
        else {
            try { const r = await apiFetch('/api/school/me/avatar', { method: 'PUT', body: JSON.stringify({ avatar: src }) }); applyAvatar(r.avatar); }
            catch (e) { if (e.status === 409) { P.taken.push(src); P.pending = null; } throw e; }
        }
        P.pending = null;
    }
    function bindProfile(body) {
        body.querySelectorAll('[data-avtab]').forEach(b => b.onclick = () => { P.tab = b.dataset.avtab; drawProfile(body); });
        body.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { P.set = b.dataset.set; drawProfile(body); });
        body.querySelector('[data-more]')?.addEventListener('click', () => { P.showAll = true; drawProfile(body); });
        body.querySelectorAll('.ss-av[data-av]:not(.tk)').forEach(b => b.onclick = () => { P.pending = b.dataset.av === P.data.user.avatar ? null : b.dataset.av; drawProfile(body); });
        body.querySelector('[data-auto]')?.addEventListener('click', () => {
            const free = Array.from({ length: 36 }, (_, i) => `/images/staff-avatars/${P.set}${String(i + 1).padStart(2, '0')}.webp`).find(s => !P.taken.includes(s) && s !== P.data.user.avatar);
            if (!free) return toast('Bu to\'plamda bo\'sh personaj qolmagan', 3000);
            P.pending = free; drawProfile(body);
        });
        const file = body.querySelector('#ssAvFile');
        body.querySelector('[data-upload-go]')?.addEventListener('click', () => file?.click());
        body.querySelector('[data-upload]')?.addEventListener('click', () => file?.click());
        file?.addEventListener('change', async () => {
            const f = file.files?.[0]; file.value = ''; if (!f) return;
            if (f.size > 20 * 1024 * 1024) return toast('Rasm hajmi 20 MB dan oshmasin', 3000);
            try {
                const dataUrl = typeof compressAvatarImage === 'function' ? await compressAvatarImage(f) : null;
                if (!dataUrl) throw new Error('Rasmni o\'qib bo\'lmadi');
                P.pending = dataUrl; P.tab = 'own'; drawProfile(body);
            } catch (e) { toast(e.message || 'Rasmni o\'qib bo\'lmadi', 4000); }
        });
        body.querySelector('[data-avrm]')?.addEventListener('click', async () => {
            try { await apiUpdateProfile({ avatar: '' }); applyAvatar(''); drawProfile(body); } catch (e) { toast(e.message, 4000); }
        });
        body.querySelector('[data-cancel]')?.addEventListener('click', () => { P.pending = null; drawProfile(body); });
        body.querySelector('[data-save]')?.addEventListener('click', async e => {
            const btn = e.currentTarget, msg = body.querySelector('#ssMsg');
            const v = id => body.querySelector('#' + id)?.value;
            const bd = bdayParse(v('ssBday'), P.data.extra.birthday);
            if (bd === null) { msg.textContent = 'Tug\'ilgan kun noto\'g\'ri — masalan 14-may yoki 14.05.1999'; msg.className = 'ss-msg bad'; return; }
            const payload = { phone: v('ssPhone'), telegram: v('ssTg'), birthday: bd };
            if (P.data.canEditName) payload.name = v('ssName');
            if (body.querySelector('#ssExt')) payload.ext = v('ssExt');
            if (body.querySelector('#ssBio')) payload.bio = v('ssBio');
            btn.disabled = true; msg.textContent = ''; msg.className = 'ss-msg';
            try {
                // Avval maydonlar (xato bo'lsa avatar ham saqlanmaydi), keyin tanlangan avatar.
                const d = await api('/profile', { method: 'PUT', body: payload });
                P.data = d;
                if (P.pending) await savePendingAvatar(); // applyAvatar d.user.avatar ni ham yangilaydi
                const cu = me(); if (cu && typeof setCurrentUser === 'function') setCurrentUser({ ...cu, name: d.user.name, phone: d.user.phone, bio: d.user.bio, avatar: d.user.avatar || cu.avatar });
                drawProfile(body); toast('Saqlandi');
            } catch (err) {
                if (err.status === 409) drawProfile(body); // band bo'lib qolgan personaj — to'r yangilanadi
                const m = body.querySelector('#ssMsg'); if (m) { m.textContent = err.message; m.className = 'ss-msg bad'; }
                const b = body.querySelector('[data-save]'); if (b) b.disabled = false;
            }
        });
    }

    // ── Mening maoshim ───────────────────────────────────────────────────────
    function stagesHtml(month, today, kind, prevState) {
        // Oy 1-sanada yopiladi → tekshiruv (e'tiroz 4-sanagacha) → 5-sanada to'lov. Ustoz va yordamchi uchun bir xil.
        const next = (() => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m, 1)); return d.toISOString().slice(0, 7); })();
        const prevMonth = (() => { const [y, m] = today.split('-').map(Number); return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7); })();
        const day = Number(today.slice(8, 10));
        // Joriy oy uchun bosqichlar; agar bugun 1–5 bo'lsa — o'tgan oy hali to'lanmagan bo'lishi mumkin.
        const target = day <= 5 ? prevMonth : month, payMonth = day <= 5 ? today.slice(0, 7) : next;
        const st = day <= 5 && prevState ? prevState : null;
        const steps = kind === 'assistant'
            ? [['Oy yopiladi', `1-${MON[Number(payMonth.slice(5)) - 1].slice(0, 3)} 00:00`], ['Dastlabki hisob', 'Moliya'], ['E\'tiroz', `4-${MON[Number(payMonth.slice(5)) - 1].slice(0, 3)}gacha`], ['Yakuniy', 'tasdiqlanadi'], ['To\'lov', `5-${MON[Number(payMonth.slice(5)) - 1].slice(0, 3)}`]]
            : [['Oy yopiladi', `1-${MON[Number(payMonth.slice(5)) - 1].slice(0, 3)}`], ['Tekshiruv', `1–4-${MON[Number(payMonth.slice(5)) - 1].slice(0, 3)}`], ['To\'lov', `5-${MON[Number(payMonth.slice(5)) - 1].slice(0, 3)}`]];
        let cur;
        if (day > 5) cur = 0; // joriy oy davom etmoqda — hali yopilmagan
        else if (kind === 'assistant') cur = st?.paidAt ? 5 : st?.finalAt ? 4 : st?.prelimAt ? (day <= 4 ? 2 : 3) : 1;
        else cur = day >= 5 ? 2 : 1;
        return `<section class="ss-card ss-pad ss-stages" aria-label="To'lov bosqichlari"><div class="ss-st-h"><b>${monName(target)} maoshi · to'lov bosqichlari</b><span class="ss-mt">${day > 5 ? `oy davom etmoqda · ${MON[Number(payMonth.slice(5)) - 1]} 5-sanada beriladi` : 'oy yopildi'}</span></div>
          <ol class="ss-steps">${steps.map(([t, s], i) => `<li class="${i < cur ? 'done' : i === cur && day <= 5 ? 'now' : ''}"><i>${i < cur ? ICON.check : i + 1}</i><b>${esc(t)}</b><span>${esc(s)}</span></li>`).join('')}</ol></section>`;
    }
    function lastPaid(d) {
        // 1–5-sana: yopilgan, hali to'lanmagan o'tgan oy (server /api/staff/salary → closed; Bosh/Davomat bilan bir summa).
        if (d.closed) {
            const nx = MON[Number(d.month.slice(5)) - 1];
            return `<div class="ss-kpi"><span>${monName(d.closed.month)} · yopildi</span><b>${num(d.closed.amount)} so'm</b><small>${d.kind === 'assistant' && d.closed.counted ? `${d.closed.counted} aloqa · ` : ''}5-${esc(nx.slice(0, 3))} to'lanadi${d.card4 ? ` · karta •••• ${esc(d.card4)}` : ''}</small></div>`;
        }
        const prev = (d.history || []).filter(h => h.month < d.month).sort((a, b) => b.month.localeCompare(a.month))[0];
        if (!prev) return `<div class="ss-kpi"><span>O'tgan oy</span><b>—</b><small>hali hisob yo'q</small></div>`;
        return `<div class="ss-kpi"><span>${monName(prev.month)} · ${prev.status === 'paid' ? 'berilgan' : 'hisoblangan'}</span><b>${num(prev.amount)} so'm</b><small>${d.assist?.prevCounted && prev.month === d.assist.prevMonth ? `${d.assist.prevCounted} aloqa · ` : ''}${prev.status === 'paid' && prev.paidAt ? dShort(tzDate(prev.paidAt)) : 'hali berilmagan'}${d.card4 ? `${d.kind === 'assistant' ? ' ' : ' · '}karta •••• ${esc(d.card4)}` : ''}</small></div>`;
    }
    function chartAndHistory(d, override = null) {
        const cur = override != null ? override : d.current ? Number(d.current.total) || 0 : null;
        const by = new Map(); for (const h of d.history || []) by.set(h.month, h);
        if (d.closed && !by.has(d.closed.month)) by.set(d.closed.month, { month: d.closed.month, amount: d.closed.amount, status: 'closed' });
        const months = Array.from({ length: 6 }, (_, i) => { const [y, m] = d.month.split('-').map(Number); return new Date(Date.UTC(y, m - 6 + i, 1)).toISOString().slice(0, 7); });
        const rows = months.map(k => k === d.month ? { k, amount: cur ?? by.get(k)?.amount ?? 0, st: 'cur' } : { k, amount: by.get(k)?.amount || 0, st: by.get(k)?.status || 'none' });
        const max = Math.max(1, ...rows.map(r => r.amount));
        const fmtM = n => (n / 1e6).toFixed(2);
        return `<div class="ss-two"><section class="ss-card" aria-labelledby="ssChH"><header class="ss-ch"><h3 id="ssChH">Oxirgi 6 oy · mln so'm</h3></header>
            <div class="ss-pad ss-chart">${rows.map(r => `<div class="ss-bar${r.st === 'cur' ? ' cur' : ''}" title="${monName(r.k)}: ${num(r.amount)} so'm"><em>${r.amount ? fmtM(r.amount) : '—'}</em><i style="height:${Math.max(3, Math.round(r.amount / max * 100))}%"></i><span>${MON3[Number(r.k.slice(5)) - 1]}</span></div>`).join('')}</div></section>
          <section class="ss-card" aria-labelledby="ssHiH"><header class="ss-ch"><h3 id="ssHiH">To'lov tarixi</h3></header>
            <ul class="ss-hist">${rows.slice().reverse().map(r => `<li><i class="ss-dot ${r.st === 'paid' ? 'ok' : r.st === 'cur' ? 'warn' : r.st === 'unpaid' || r.st === 'closed' ? 'info' : ''}"></i><span>${monName(r.k)} · ${r.st === 'paid' ? 'berilgan' : r.st === 'cur' ? 'hozirgacha' : r.st === 'unpaid' ? 'hisoblangan' : r.st === 'closed' ? 'yopildi · to\'lanmagan' : 'ma\'lumot yo\'q'}</span><b>${r.amount ? num(r.amount) : '—'}</b></li>`).join('')}</ul></section></div>`;
    }
    // Maosh bosqichlari (ustoz va yordamchi): oy 1-sanada yopiladi → 4-sanagacha tekshiruv/e'tiroz → 5-sanada to'lanadi.
    // Dizaynda alohida blok yo'q — jadval ostidagi izoh qatorida ko'rsatiladi.
    function payNote(month) {
        const nx = MON[Number(String(month).slice(5, 7)) % 12];
        return `Oy 1-${nx}da yopiladi → 4-${nx}gacha tekshiruv va e'tiroz → 5-${nx}da to'lanadi.`;
    }
    async function renderSalary(body) {
        const ok = guard(body);
        body.innerHTML = head('Mening maoshim') + '<div class="ss-col"><div class="ss-card ss-pad ss-muted">Yuklanmoqda…</div></div>';
        let d;
        try { d = await api('/salary'); } catch (e) { if (ok()) body.innerHTML = head('Mening maoshim') + errBox(e); return; }
        if (!ok()) return;
        if (!d.linked) { body.innerHTML = head('Mening maoshim') + `<div class="ss-card ss-pad">Hisobingiz HR ro'yxatidagi xodim yozuviga ulanmagan (login = email). Administratorga murojaat qiling.</div>`; return; }
        if (d.kind === 'assistant' && d.assist) return drawAssistSalary(body, d);
        if (d.kind === 'teacher') return drawTeacherSalary(body, d);
        // Sotuv / ROP / boshqalar — umumiy ko'rinish.
        const c = d.current || {};
        body.innerHTML = head('Mening maoshim') + `<div class="ss-col"><div class="ss-kpis">
            <div class="ss-kpi dark"><span>${monName(d.month)} · hozirgacha</span><b>${c.total != null ? num(c.total) + ' so\'m' : '—'}</b><small>${[c.fixed ? 'fiksa ' + num(c.fixed) : '', c.commission ? 'ulush ' + num(c.commission) : '', c.bonus ? 'bonus ' + num(c.bonus) : ''].filter(Boolean).join(' + ') || 'taxminiy'}</small></div>
            ${c.turnover != null ? `<div class="ss-kpi"><span>Aylanma</span><b>${num(c.turnover)} so'm</b><small>shu oy</small></div>` : ''}${lastPaid(d)}</div>
            ${stagesHtml(d.month, d.today, 'teacher', null)}${chartAndHistory(d)}</div>`;
    }
    function drawTeacherSalary(body, d) {
        const c = d.current || {}, m = d.main || { groups: [], total: 0, counted: 0 }, a = d.assist;
        // Jami va yordamchi qismi — Moliya hisobidan (payroll); u bo'lmasa aloqalar hisobidan.
        // Summa ham, aloqalar soni ham bitta manbadan — Moliya hisobi (payroll: assistantTotal / assistantLessons).
        const fromPay = !!a && c.assistantTotal != null;
        const assistAmt = a ? (fromPay ? Number(c.assistantTotal) || 0 : a.amount) : 0;
        const assistCnt = a ? (fromPay && c.assistantLessons != null ? Number(c.assistantLessons) || 0 : a.counted) : 0;
        const total = a ? m.total + assistAmt : c.total != null ? Number(c.total) : m.total;
        const miss = d.missed;
        const banner = miss && miss.open ? `<div class="ss-banner" role="note">${ICON.sync}<p><b>${miss.open} ta qoldirilgan dars hali qoplanmagan${miss.planned ? ` (${miss.planned} tasi rejada)` : ''}.</b> Oy tugashiga ${miss.daysLeft} kun. ${esc(miss.students.slice(0, 3).map(s => `${s.name} ${s.count} ta`).join(', '))}${miss.students.length > 3 ? `, yana ${miss.students.length - 3} ta` : ''}.</p><button type="button" class="ss-btn" data-go-makeup>Qoplash qo'yish</button></div>` : '';
        const rowsMain = m.groups.map(g => `<tr><td>${g.duration} daqiqalik</td><td class="ss-names">${esc(g.students.join(', '))}</td><td class="n">${g.expected}</td><td class="n">${g.counted}${g.review ? ` <i class="ss-pill teal">+${g.review} tekshiruvda</i>` : ''}</td><td class="n ss-mt">—</td></tr>`).join('')
            || '<tr><td colspan="5" class="ss-mt">Bu oy asosiy o\'quvchi yo\'q</td></tr>';
        const assistRows = a ? `<tr class="sec"><td colspan="5">Yordamchi ustozlik${a.pastOnly ? ' · o\'tgan aloqalar' : ''} · ${num(a.rate)} so'm × aloqa</td></tr>
            <tr><td>Yordamchi</td><td class="ss-names">${esc(a.students.map(s => s.name.split(' ')[0]).join(', ') || '—')}</td><td class="n">${a.cap} gacha</td><td class="n">${assistCnt}</td><td class="n">${num(assistAmt)}</td></tr>` : '';
        body.innerHTML = head('Profil, maosh va xavfsizlik') + `<div class="ss-col">
          <div class="ss-kpis">
            <div class="ss-kpi dark"><span>${monName(d.month)} · hozirgacha</span><b>${num(total)} so'm</b><small>${a ? `asosiy ${num(m.total)} + yordamchi ${num(assistAmt)}` : `${m.counted} dars hisobga o'tdi`}</small></div>
            <div class="ss-kpi"><span>Tekshiruvda</span><b class="teal">${d.reviewMakeups} qoplash</b><small>admin tasdiqlasa maoshga qo'shiladi</small></div>
            ${lastPaid(d)}</div>
          ${banner}
          <section class="ss-card" aria-labelledby="ssTbH"><header class="ss-ch"><h3 id="ssTbH">${monName(d.month)} hisobi · o'quvchilar bo'yicha</h3><span class="ss-mt">Belgilangan davomat bo'yicha · oy yopilganda Moliya tasdiqlaydi</span></header>
            <div class="ss-tw"><table class="ss-tbl ss-tbl--pay"><thead><tr><th scope="col">Dars turi</th><th scope="col">O'quvchilar</th><th scope="col" class="n">Rejada</th><th scope="col" class="n">Hisobga o'tdi</th><th scope="col" class="n">Summa</th></tr></thead>
            <tbody><tr class="sec"><td colspan="5">Asosiy ustozlik</td></tr>${rowsMain}
              <tr class="tot"><td colspan="3">Asosiy ustozlik jami</td><td class="n">${m.counted}</td><td class="n">${num(m.total)}</td></tr>${assistRows}</tbody>
            <tfoot><tr><td colspan="4">Jami · ${m.counted} tasdiqlangan dars${a ? ` + ${assistCnt} yordamchi aloqa` : ''}${d.reviewMakeups ? ` · +${d.reviewMakeups} qoplash tekshiruvda` : ''}</td><td class="n">${num(total)}</td></tr></tfoot></table></div>
            <p class="ss-note ss-mt">Dars turlari bo'yicha va har o'quvchi bo'yicha summa ko'rsatilmaydi — o'quvchi to'lovi ma'lumoti ustozga yopiq. ${esc(payNote(d.month))}</p></section>
          ${chartAndHistory(d, total)}</div>`;
        bindMakeupBtn(body, null);
        // Qoplanmagan darslar — Bosh sahifadagi "Bajarish kerak" bilan bir manba (js/ustozHome.js: missed, lossSum):
        // son, "N tasi rejada", taxminiy yo'qotish (ustozning o'z stavkasi bo'yicha) va o'quvchilar.
        const H = window.UstozHome, ok = guard(body);
        if (H?.missed) H.missed(me()).then(mm => { if (ok()) missedBanner(body, mm, d); }).catch(() => {});
    }
    function bindMakeupBtn(body, studentId) {
        body.querySelector('[data-go-makeup]')?.addEventListener('click', () => {
            const again = () => renderSalary(body);
            if (window.schoolSchedule?.makeupDrawer) window.schoolSchedule.makeupDrawer(again, studentId ? { studentId } : undefined);
            else if (typeof switchTab === 'function') switchTab('timetable');
        });
    }
    function missedBanner(body, mm, d) {
        const H = window.UstozHome, old = body.querySelector('.ss-banner');
        const rows = mm ? [...mm.by.values()].filter(x => x.open.length).sort((a, b) => b.open.length - a.open.length) : [];
        const open = rows.reduce((n, x) => n + x.open.length, 0), planned = mm ? [...mm.by.values()].reduce((n, x) => n + x.planned.length, 0) : 0;
        if (!open) { old?.remove(); return; }
        const loss = H.lossSum ? H.lossSum(me(), mm) : null;
        const [y, mo] = mm.month.split('-').map(Number), left = new Date(Date.UTC(y, mo, 0)).getUTCDate() - Number(mm.today.slice(8));
        const parts = rows.slice(0, 3).map((x, i) => {
            const pl = x.planned.filter(p => p.held).map(p => `${H.dm(p.missed)} → ${H.DAY[H.wd(p.held) - 1]} ${Number(p.held.slice(8))}`);
            return `${String(x.student.name || '').trim().split(/\s+/)[0]} ${x.open.length}${i === 0 ? ' ta' : ''}${pl.length ? ` (${pl.join(', ')} rejada)` : ''}`;
        });
        if (rows.length > 3) parts.push(`yana ${rows.length - 3} ta`);
        const html = `<div class="ss-banner" role="note">${ICON.sync}<p><b>${open} ta qoldirilgan dars hali qoplanmagan${planned ? ` (${planned} tasi rejada)` : ''}${loss ? ` — ≈ ${num(loss)} so'm` : ''}.</b> ${left > 0 ? `Oy tugashiga ${left} kun.` : 'Bugun oyning oxirgi kuni.'} ${esc(parts.join(', '))}.</p><button type="button" class="ss-btn" data-go-makeup>Qoplash qo'yish</button></div>`;
        const t = document.createElement('div'); t.innerHTML = html; const el = t.firstElementChild;
        if (old) old.replaceWith(el); else body.querySelector('.ss-kpis')?.after(el);
        bindMakeupBtn(body, rows[0]?.student.id);
    }
    // O'quvchi avatari — boshqa sahifalardagi kabi 3D personaj (schoolUI.studentAvatar: ilovadagi rasm yoki ID bo'yicha doimiy personaj).
    function stuAvatar(id, name) {
        let s = null;
        try { s = getItem(STORAGE_KEYS.students, []).find(x => x.id === id) || null; } catch { /* yo'q */ }
        const U = window.schoolUI;
        return U?.studentAvatar ? U.studentAvatar(s || { id, name }, 30) : '';
    }
    function drawAssistSalary(body, d) {
        const a = d.assist;
        const rows = a.students.map(s => {
            // Limitga yaqin — qolgan tavsiyalar bilan chegaradan oshadi (YordamchiBosh "13 ta limitga yaqinlar" bilan bir qoida).
            const near = s.counted + (s.adviceLeft || 0) > a.cap;
            const st = s.counted >= a.cap ? `<i class="ss-pill warn">limit to'ldi · ${a.cap + 1}-chi hisoblanmaydi</i>` : near ? `<i class="ss-pill warn">${a.cap} ga yaqin · ${a.cap + 1}-chi hisoblanmaydi</i>`
                : `<span class="ss-mt">${s.adviceLeft ? `yana ${s.adviceLeft} tavsiya` : 'bu oy tavsiya qolmadi'}</span>`;
            return `<tr><th scope="row"><span class="ss-stu"><span class="ss-sav">${stuAvatar(s.studentId, s.name) || initials(s.name)}</span><span><b>${esc(s.name)}</b><small>asosiy: ${esc(s.mainTeacher || '—')}</small></span></span></th>
              <td class="n"><b>${s.counted}</b> / ${a.cap}</td><td class="n">${num(s.amount)}</td><td>${st}</td></tr>`;
        }).join('') || '<tr><td colspan="4" class="ss-mt">Sizga hali o\'quvchi biriktirilmagan</td></tr>';
        body.innerHTML = head('Mening maoshim · aloqalar bo\'yicha') + `<div class="ss-col">
          <div class="ss-kpis ss-kpis--as">
            <div class="ss-kpi"><span>${monName(d.month)} · hozirgacha</span><b>${num(a.amount)} so'm</b><small>${a.counted} aloqa × ${num(a.rate)}</small></div>
            <div class="ss-kpi"><span>Oy oxirigacha ko'pi bilan</span><b>${num(a.possibleAmount ?? a.possible * a.rate)} so'm</b><small>${a.possible} aloqa · ${a.daysLeft} kun qoldi</small></div>
            ${lastPaid(d)}</div>
          <section class="ss-card" aria-labelledby="ssAsH"><header class="ss-ch"><h3 id="ssAsH">${monName(d.month)} · o'quvchilar bo'yicha</h3><span class="ss-mt">har o'quvchi bilan oyiga ${a.cap} tagacha · kamida 5 daqiqa</span></header>
            <div class="ss-tw"><table class="ss-tbl ss-tbl--as"><thead><tr><th scope="col">O'quvchi</th><th scope="col" class="n">Hisoblangan aloqa</th><th scope="col" class="n">Summa</th><th scope="col">Holat</th></tr></thead>
            <tbody>${rows}</tbody><tfoot><tr><td>Jami · ${a.students.length} o'quvchi</td><td class="n">${a.counted} / ${a.students.length * a.cap}</td><td class="n">${num(a.amount)}</td><td></td></tr></tfoot></table></div>
            <p class="ss-note ss-mt">Hisoblanmaydi: "javob bermadi", 5 daqiqadan qisqa, bir kundagi ikkinchi aloqa, haftadagi ikkinchi yozishma. Oy yopilganda Moliya tasdiqlaydi. ${esc(payNote(d.month))}</p></section></div>`;
    }

    // ── Bildirishnoma sozlamalari ────────────────────────────────────────────
    const NP = { data: null, editQuiet: false };
    async function renderNotifSettings(body) {
        const ok = guard(body);
        body.innerHTML = head('Bildirishnomalar · qaysi hodisa, qaysi kanal') + '<div class="ss-col"><div class="ss-card ss-pad ss-muted">Yuklanmoqda…</div></div>';
        try { NP.data = await api('/notify/prefs'); } catch (e) { if (ok()) body.innerHTML = head('Bildirishnomalar') + errBox(e); return; }
        if (ok()) drawNotif(body);
    }
    const tog = (key, ch, on, locked, label) => `<label class="ss-tog"><input type="checkbox" data-pref="${esc(key)}" data-ch="${ch}" ${on ? 'checked' : ''} ${locked ? 'disabled' : ''} aria-label="${esc(label)}"><i></i></label>`;
    function browserName() { const ua = navigator.userAgent; return /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Brauzer'; }
    // ── @Domworkuz_bot'ni ulash: bir martalik havola + QR, Telegramda Start, shu yerda tasdiqlash ──
    const TGL = { open: false, st: null, link: null, timer: null, seq: 0, err: '' };
    const tgApi = (path, body) => apiFetch('/api/domwork/staff-telegram' + path, body ? { method: 'POST', body: JSON.stringify(body) } : {});
    function tgStop() { clearInterval(TGL.timer); TGL.timer = null; TGL.link = null; TGL.st = null; TGL.err = ''; }
    function tgDraw(body) {
        const box = body.querySelector('#ssTgl'); if (!box) return tgStop();
        const req = TGL.st?.request, claimed = req && !req.expired && req.state === 'claimed' && req.telegram;
        const expired = !TGL.link || (req && (req.expired || req.state === 'cancelled'));
        const qr = TGL.link?.qr;
        box.innerHTML = `<div class="ss-tgl-in">
            ${qr && !expired ? `<svg class="ss-tgl-qr" viewBox="-2 -2 ${qr.size + 4} ${qr.size + 4}" shape-rendering="crispEdges" role="img" aria-label="@Domworkuz_bot ulash QR kodi"><rect x="-2" y="-2" width="${qr.size + 4}" height="${qr.size + 4}" fill="#fff"/><path d="${esc(qr.path)}" fill="#0B1220"/></svg>` : ''}
            <div class="ss-tgl-tx">
              <ol class="ss-tgl-steps"><li>Telefon kamerasi bilan QR'ni skanerlang yoki "Telegramda ochish"ni bosing</li><li>Botda <b>Start</b> tugmasini bosing</li><li>Shu yerda ismingiz chiqadi — tasdiqlang</li></ol>
              <p class="ss-mt">${TGL.err ? esc(TGL.err) : claimed ? `Telegram: <b>${esc(req.telegram.name || 'Nomsiz')}</b>${req.telegram.username ? ' · @' + esc(req.telegram.username) : ''}. Bu sizning hisobingizmi?` : expired ? 'Havola muddati tugadi (5 daqiqa).' : 'Telegramda Start bosilishi kutilmoqda…'}</p>
              <div class="ss-acts">${claimed
                ? '<button type="button" class="ss-btn ss-btn--sm ss-btn--pri" data-tgl-ok>Ha, bu mening Telegramim</button><button type="button" class="ss-btn ss-btn--sm" data-tgl-new>Yo\'q, qaytadan</button>'
                : expired ? '<button type="button" class="ss-btn ss-btn--sm ss-btn--pri" data-tgl-new>Yangi havola</button>'
                : `<a class="ss-btn ss-btn--sm ss-btn--pri" href="${esc(TGL.link.url)}" target="_blank" rel="noopener">Telegramda ochish</a>`}</div>
            </div></div>`;
        box.querySelector('[data-tgl-new]')?.addEventListener('click', () => tgCreate(body));
        box.querySelector('[data-tgl-ok]')?.addEventListener('click', async e => {
            e.currentTarget.disabled = true;
            try { await tgApi('/confirm', { requestId: req.id, telegramId: req.telegram.id }); tgStop(); TGL.open = false; NP.data = await api('/notify/prefs'); drawNotif(body); toast('Telegram ulandi — botda menyu ochildi'); }
            catch (err) { TGL.err = err.message; tgDraw(body); }
        });
    }
    async function tgPoll(body, seq) {
        try { const st = await tgApi(''); if (seq !== TGL.seq) return; TGL.st = st;
            if (st.linked) { tgStop(); TGL.open = false; NP.data = await api('/notify/prefs'); drawNotif(body); return; } }
        catch (e) { if (seq === TGL.seq) TGL.err = e.message; }
        if (seq === TGL.seq) tgDraw(body);
    }
    async function tgCreate(body) {
        const seq = ++TGL.seq; TGL.err = '';
        try { TGL.link = await tgApi('', {}); TGL.st = { request: TGL.link.request }; }
        catch (e) { TGL.link = null; TGL.err = e.message; }
        if (seq !== TGL.seq) return;
        tgDraw(body);
        clearInterval(TGL.timer);
        // Faqat panel ko'rinib turganda tekshiramiz; boshqa bo'limga o'tilsa #ssTgl yo'qoladi va to'xtaydi.
        TGL.timer = setInterval(() => { if (!document.getElementById('ssTgl')) return tgStop(); if (!document.hidden) tgPoll(body, seq); }, 3000);
    }
    function tgStart(body) { if (TGL.link && !TGL.err) tgDraw(body); else tgCreate(body); }
    function drawNotif(body) {
        const d = NP.data, q = d.quiet || { from: '22:00', to: '08:00' }, tg = d.channels.telegram;
        const hasSoon = d.groups.some(g => g.items.some(i => !i.live));
        const groups = d.groups.map(g => `<tr class="sec"><th colspan="3" scope="rowgroup">${esc(g.title)}</th></tr>` + g.items.map(i => { const p = d.prefs[i.key] || {};
            return `<tr><th scope="row"><b>${esc(i.label)}</b>${i.sub || !i.live ? `<small>${esc(i.sub)}${!i.live ? `${i.sub ? ' · ' : ''}<em class="ss-soon" title="Hozircha bu hodisa yuborilmaydi — tanlovingiz saqlanadi va manba ulanganda qo'llanadi">tez orada</em>` : ''}${i.locked ? ' · o\'chirib bo\'lmaydi' : ''}</small>` : ''}</th>
              <td>${tog(i.key, 'tg', p.tg, i.locked, i.label + ' — Telegram')}</td><td>${tog(i.key, 'web', p.web, i.locked, i.label + ' — Brauzer')}</td></tr>`; }).join('')).join('');
        const note = { teacher: 'Shoshilinch xabarlar (sinov tasdig\'i) tinch soatlarda ham keladi.', assistant: 'Tinch soatlarda faqat admin tuzatishi haqidagi xabar keladi.', sales: 'Ushlab turish tugashi haqidagi xabar o\'chirib bo\'lmaydi.',
            rop: 'Menejer so\'rovlari admin bilan birga keladi — kim birinchi hal qilsa, ikkinchisida yopiladi.', admin: 'Tinch soatlarda tasdiqlash so\'rovlari ovozsiz keladi.' }[d.kind] || '';
        body.innerHTML = head('Bildirishnomalar · qaysi hodisa, qaysi kanal') + `<div class="ss-col">
          <section class="ss-card" aria-labelledby="ssKH"><header class="ss-ch"><h3 id="ssKH">Kanallar</h3></header>
            <div class="ss-pad ss-chans">
              <div class="ss-chan"><b>Telegram bot</b>${tg.botLinked
                ? `<small>@Domworkuz_bot · CRM akkauntingizga ulangan</small><i class="ss-pill ok">${ICON.check} Ulangan</i><button type="button" class="ss-btn ss-btn--sm ss-btn--ghost" data-tg-unlink>Uzish</button>`
                : `<small>@Domworkuz_bot · telefon raqami mos kelishi shart emas</small><button type="button" class="ss-btn ss-btn--sm ss-btn--pri" data-tg-link aria-expanded="${TGL.open}">${TGL.open ? 'Yopish' : 'Ulash'}</button>`}</div>
              <div class="ss-chan"><b>Brauzer</b><small>${browserName()} · shu qurilma</small><i class="ss-pill ok">${ICON.check} Faol</i></div>
              <div class="ss-chan"><b>Tinch soatlar</b>${NP.editQuiet ? `<div class="ss-qt"><input type="time" id="ssQf" value="${esc(q.from)}" aria-label="Boshlanishi"> – <input type="time" id="ssQt" value="${esc(q.to)}" aria-label="Tugashi"></div>
                <div class="ss-acts"><button type="button" class="ss-btn ss-btn--sm" data-q-cancel>Bekor</button><button type="button" class="ss-btn ss-btn--sm ss-btn--pri" data-q-save>Saqlash</button></div>`
                : `<small>${esc(q.from)} – ${esc(q.to)} · faqat shoshilinch</small><button type="button" class="ss-btn ss-btn--sm" data-q-edit>O'zgartirish</button>`}</div>
            </div>${TGL.open && !tg.botLinked ? '<div class="ss-pad ss-tgl" id="ssTgl" aria-live="polite"></div>' : ''}</section>
          <section class="ss-card" aria-labelledby="ssNH"><header class="ss-ch"><h3 id="ssNH">Nimalar haqida xabar beriladi</h3><button type="button" class="ss-btn ss-btn--sm" data-reset>Standartga qaytarish</button></header>
            <div class="ss-tw"><table class="ss-tbl ss-tbl--np"><thead><tr><th scope="col">Hodisa</th><th scope="col">Telegram</th><th scope="col">Brauzer</th></tr></thead><tbody>${groups}</tbody></table></div>
            <p class="ss-note ss-mt">O'zgarish darhol saqlanadi. ${esc(note)} ${tg.botLinked ? 'Bot ulangan. Bildirishnomalarni Telegramga yuborish keyingi yangilanishda yoqiladi — tanlovlaringiz saqlanadi.' : 'Telegram tanlovi va tinch soatlar saqlanadi — botni ulang, yuborish yoqilganda qo\'llanadi.'}${hasSoon ? ' "Tez orada" — xabar manbasi keyingi yangilanishda ulanadi; kalit ishlaydi, tanlovingiz hozirdan saqlanadi.' : ''}</p></section></div>`;
        body.querySelectorAll('[data-pref]').forEach(inp => inp.addEventListener('change', async () => {
            const k = inp.dataset.pref, ch = inp.dataset.ch;
            try { NP.data = await api('/notify/prefs', { method: 'PUT', body: { types: { [k]: { [ch]: inp.checked } } } }); window.staffNotify?.refresh(); }
            catch (e) { inp.checked = !inp.checked; toast(e.message, 4000); }
        }));
        body.querySelector('[data-reset]')?.addEventListener('click', async () => {
            try { NP.data = await api('/notify/prefs', { method: 'PUT', body: { reset: true } }); drawNotif(body); toast('Standart sozlamalar tiklandi'); window.staffNotify?.refresh(); } catch (e) { toast(e.message, 4000); }
        });
        body.querySelector('[data-tg-link]')?.addEventListener('click', () => { TGL.open = !TGL.open; if (!TGL.open) tgStop(); drawNotif(body); });
        body.querySelector('[data-tg-unlink]')?.addEventListener('click', async () => {
            if (!confirm('Telegram botdan uzilsinmi? Qayta ulash uchun yana "Ulash" tugmasini bosasiz.')) return;
            try { await tgApi('/unlink', {}); NP.data = await api('/notify/prefs'); drawNotif(body); toast('Telegram uzildi'); } catch (e) { toast(e.message, 4000); }
        });
        if (TGL.open && !tg.botLinked) tgStart(body);
        body.querySelector('[data-q-edit]')?.addEventListener('click', () => { NP.editQuiet = true; drawNotif(body); });
        body.querySelector('[data-q-cancel]')?.addEventListener('click', () => { NP.editQuiet = false; drawNotif(body); });
        body.querySelector('[data-q-save]')?.addEventListener('click', async () => {
            try { NP.data = await api('/notify/prefs', { method: 'PUT', body: { quiet: { from: body.querySelector('#ssQf').value, to: body.querySelector('#ssQt').value } } }); NP.editQuiet = false; drawNotif(body); }
            catch (e) { toast(e.message, 4000); }
        });
    }

    // ── Yo'riqnomalar ────────────────────────────────────────────────────────
    const G = { q: '', sel: null, acks: null };
    function guideList() {
        const cu = me();
        const tags = typeof resolveGuideAudienceTags === 'function' ? resolveGuideAudienceTags(cu) : [];
        return (getItem(STORAGE_KEYS.guides, []) || []).filter(g => (g.targetRoles || []).some(t => tags.includes(t)))
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }
    const readMin = g => Math.max(1, Math.round(String(g.content || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 180));
    // Maqola matni: app.js renderScriptContentHtml bilan bir xil tozalash, lekin sarlavhalar (h2–h4) ham qoladi
    // (UstozYoriqnoma: "1. Alohida kunda", "Cheklovlar" — bo'lim sarlavhalari).
    const GUIDE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SPAN', 'DIV', 'BR', 'P', 'UL', 'OL', 'LI', 'FONT', 'H2', 'H3', 'H4']);
    const GUIDE_STYLE = new Set(['color', 'background-color', 'font-weight', 'font-style', 'text-decoration']);
    function guideHtml(content) {
        const raw = String(content || '');
        const html = /<[a-z][\s\S]*>/i.test(raw) ? raw : esc(raw).replace(/\n/g, '<br>');
        const root = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild;
        if (!root) return '';
        const walk = node => [...node.childNodes].forEach(ch => {
            if (ch.nodeType === 1) {
                walk(ch);
                if (!GUIDE_TAGS.has(ch.tagName)) { while (ch.firstChild) node.insertBefore(ch.firstChild, ch); ch.remove(); return; }
                [...ch.attributes].forEach(a => {
                    if (a.name === 'style') { const keep = [...ch.style].filter(p => GUIDE_STYLE.has(p)).map(p => `${p}:${ch.style.getPropertyValue(p)}`).join(';'); if (keep) ch.setAttribute('style', keep); else ch.removeAttribute('style'); }
                    else if (a.name !== 'color') ch.removeAttribute(a.name);
                });
            } else if (ch.nodeType !== 3) ch.remove();
        });
        walk(root);
        return root.innerHTML;
    }
    const AUTHOR_ROLE = { admin: 'admin', boshliq: 'rahbar', hr: 'HR', rop: 'ROP' };
    // Bo'lim (kategoriya): admin izoh (subtitle) yozmagan bo'lsa — kimga mo'ljallanganidan (UstozYoriqnoma: "Akademik · 27-okt · 3 daq o'qish").
    const CAT = [[['teacher_main', 'teacher_assistant', 'head_of_teachers'], 'Akademik', "Akademik bo'lim"], [['sales_manager', 'rop'], 'Sotuv', "Sotuv bo'limi"], [['hr'], 'HR', "HR bo'limi"], [['marketolog'], 'Marketing', "Marketing bo'limi"]];
    const catOf = (g, long = false) => { if (g?.subtitle) return g.subtitle; const c = CAT.find(([keys]) => (g?.targetRoles || []).some(t => keys.includes(t))); return c ? c[long ? 2 : 1] : ''; };
    function guidesRoot() {
        const sec = document.getElementById('tab-guides'); if (!sec) return null;
        let root = document.getElementById('sgGuides');
        if (!root) { root = document.createElement('div'); root.id = 'sgGuides'; root.className = 'sg-root'; sec.appendChild(root); }
        ['myGuidesListView', 'myGuideArticleView'].forEach(id => { const el = document.getElementById(id); if (el) { el.hidden = true; el.style.display = 'none'; } });
        return root;
    }
    async function renderGuides(openId) {
        const root = guidesRoot(); if (!root) return;
        if (openId) G.sel = openId;
        if (!G.acks) { G.acks = new Map(); api('/guides/acks/mine').then(r => { G.acks = new Map((r.acks || []).map(a => [a.guideId, a.ackedAt])); drawGuides(root); }).catch(() => {}); }
        drawGuides(root);
    }
    function drawGuides(root) {
        const all = guideList(), q = G.q.toLowerCase();
        const list = all.filter(g => !q || `${g.title} ${g.subtitle} ${String(g.content || '').replace(/<[^>]+>/g, ' ')}`.toLowerCase().includes(q));
        if (!G.sel || !all.some(g => g.id === G.sel)) G.sel = (all.find(g => !G.acks?.has(g.id)) || all[0])?.id || null;
        const g = all.find(x => x.id === G.sel);
        const content = g ? guideHtml(g.content) : '';
        const author = g?.createdBy ? `${g.createdBy}${AUTHOR_ROLE[g.createdByRole] ? ` (${AUTHOR_ROLE[g.createdByRole]})` : ''}` : '';
        const acked = g && G.acks?.get(g.id);
        root.innerHTML = `<div class="sg-head"><h1>Yo'riqnomalar</h1><p>Lavozimingizga tegishli qoidalar · yangilari tepada</p></div>
          ${all.length ? `<div class="sg-grid"><aside class="ss-card sg-list" aria-label="Yo'riqnomalar ro'yxati"><div class="sg-search"><label for="sgQ" class="sg-sr">Qidirish</label><input id="sgQ" type="search" placeholder="Qidirish…" value="${esc(G.q)}"></div>
            <ul>${list.map(x => { const done = G.acks?.has(x.id); return `<li><button type="button" class="sg-it${x.id === G.sel ? ' on' : ''}" data-g="${esc(x.id)}" aria-current="${x.id === G.sel}"><span class="sg-ic">${ICON.doc}</span><span class="sg-tx"><b>${esc(x.title || 'Nomsiz')}</b><small>${[catOf(x), x.createdAt ? dShort(tzDate(x.createdAt)) : '', done ? 'o\'qilgan' : readMin(x) + ' daq o\'qish'].filter(Boolean).map(esc).join(' · ')}</small></span>${done ? '' : '<i class="ss-pill info sg-new">Yangi</i>'}</button></li>`; }).join('') || '<li class="ss-mt sg-empty">Topilmadi</li>'}</ul></aside>
            <article class="ss-card sg-art" aria-labelledby="sgT">${g ? `<div class="sg-body"><h2 id="sgT">${esc(g.title || '')}</h2><p class="sg-meta">${[catOf(g, true), author, g.createdAt ? dmy(tzDate(g.createdAt)) : ''].filter(Boolean).map(esc).join(' · ')}</p>
              <div class="sg-content">${content}</div></div>
              <footer class="sg-foot"><span class="ss-mt">${acked ? `Tanishib chiqdingiz · ${esc(dmy(tzDate(acked)))}` : 'O\'qib chiqqaningizni tasdiqlang — admin ko\'radi'}</span>${acked ? `<i class="ss-pill ok">${ICON.check} Tanishib chiqdim</i>` : '<button type="button" class="ss-btn ss-btn--pri" data-ack>Tanishib chiqdim</button>'}</footer>` : ''}</article></div>`
            : (typeof teamEmptyState === 'function' ? teamEmptyState('Hozircha yoʻriqnoma yoʻq', 'Sizga tegishli yoʻriqnoma kiritilganda shu yerda chiqadi.', 'board') : '<div class="ss-card ss-pad">Hozircha yoʻriqnoma yoʻq</div>')}`;
        root.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { G.sel = b.dataset.g; drawGuides(root); if (innerWidth < 900) root.querySelector('.sg-art')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        const inp = root.querySelector('#sgQ');
        if (inp) inp.oninput = () => { G.q = inp.value; const pos = inp.selectionStart; drawGuides(root); const again = root.querySelector('#sgQ'); again.focus(); again.setSelectionRange(pos, pos); };
        root.querySelector('[data-ack]')?.addEventListener('click', async e => {
            e.currentTarget.disabled = true;
            try { const r = await api(`/guides/${encodeURIComponent(G.sel)}/ack`, { method: 'POST' }); G.acks.set(r.guideId, r.ackedAt); drawGuides(root); toast('Rahmat — admin ko\'radi'); window.staffNotify?.refresh(); }
            catch (err) { toast(err.message, 4000); e.currentTarget.disabled = false; }
        });
    }
    // Admin / HR: maqola ostida kim tanishgani.
    async function adminAcks(guideId, el) {
        if (!el) return;
        const box = document.createElement('section'); box.className = 'sg-acks'; box.innerHTML = '<h4>Tanishib chiqqanlar</h4><p class="ss-mt">Yuklanmoqda…</p>'; el.appendChild(box);
        try {
            const r = await api('/guides/acks?guideId=' + encodeURIComponent(guideId));
            const ROLE = { teacher: 'ustoz', sales_manager: 'sotuv', rop: 'ROP', hr: 'HR', admin: 'admin', employee: 'xodim' };
            box.innerHTML = `<h4>Tanishib chiqqanlar · ${r.acks.length}</h4>${r.acks.length ? `<ul>${r.acks.map(a => `<li><b>${esc(a.name)}</b><span>${esc(ROLE[a.role] || a.role)} · ${esc(new Date(a.ackedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span></li>`).join('')}</ul>` : '<p class="ss-mt">Hali hech kim "Tanishib chiqdim"ni bosmagan.</p>'}`;
        } catch (e) { box.innerHTML = `<h4>Tanishib chiqqanlar</h4><p class="ss-mt">${esc(e.message)}</p>`; }
    }

    // ── Bildirishnomalar paneli: server voqealari ────────────────────────────
    const NF = { events: [], cats: [], at: 0, busy: null, timer: null };
    const TONE_TYPE = { bad: 'danger', warn: 'warning', ok: 'success', info: 'info', mute: 'info' };
    const staffNotify = {
        items() { return NF.events.map(e => ({ id: 's:' + e.id, type: TONE_TYPE[e.tone] || 'info', tone: e.tone, etype: e.type, title: e.title, message: e.sub, time: Date.parse(e.at), tab: e.go?.tab || '', section: e.go?.section, guideId: e.go?.guideId, cat: e.cat, serverRead: !!e.read, server: true })); },
        cats() { return NF.cats; },
        async refresh() {
            if (NF.busy) return NF.busy;
            if (!me()?.role || me().role === 'student') return;
            NF.busy = api('/notify/feed').then(r => { NF.events = r.events || []; NF.cats = r.cats || []; NF.at = Date.now(); })
                .catch(() => { /* panel mahalliy bildirishnomalar bilan ishlayveradi */ })
                .finally(() => { NF.busy = null; if (typeof renderNotificationPanel === 'function') renderNotificationPanel();
                    // Sidebar son belgilari (js/staffSessions.js) shu voqealardan hisoblanadi.
                    window.dispatchEvent(new CustomEvent('staff:feed', { detail: { events: NF.events } })); });
            return NF.busy;
        },
        markRead(ids) {
            const raw = ids.filter(i => String(i).startsWith('s:')).map(i => String(i).slice(2));
            if (!raw.length) return;
            for (const e of NF.events) if (raw.includes(e.id)) e.read = true;
            api('/notify/read', { method: 'POST', body: { ids: raw } }).catch(() => {});
        },
        markAll() {
            const ids = NF.events.filter(e => !e.read).map(e => e.id);
            NF.events.forEach(e => { e.read = true; });
            api('/notify/read', { method: 'POST', body: { all: true, ids } }).catch(() => {});
        },
        start() {
            if (NF.timer) return;
            staffNotify.refresh();
            NF.timer = setInterval(() => { if (!document.hidden) staffNotify.refresh(); }, 120000);
        }
    };

    // ── Parol (UstozSozParol, YordamchiSozParol; Sotuv/ROP/Admin ham shu tuzilishda) ─────────────
    // Tekshiruv va saqlash app.js'dagi umumiy funksiyalar: _pwdChecks (xodimga kamida 8 belgi — server
    // services/authSecurity ham tekshiradi), bindProfilePasswordUi, handleProfilePasswordChange. Bu yerda faqat
    // dizayndagi karta tuzilishi; element id'lari o'sha funksiyalar kutganidek.
    function ago(v) {
        const days = Math.floor((Date.now() - Date.parse(v)) / 864e5);
        if (!Number.isFinite(days) || days < 0) return '';
        if (days < 1) return 'bugun';
        if (days < 31) return `${days} kun oldin`;
        const m = Math.floor(days / 30.4);
        return m < 12 ? `${m} oy oldin` : `${Math.floor(m / 12)} yil oldin`;
    }
    function renderSecurity(body) {
        const ok = guard(body);
        const checks = typeof _pwdChecks === 'function' ? _pwdChecks('', '') : [];
        body.innerHTML = head('Xavfsizlik · parol') + `<div class="ss-col">
          <section class="ss-card" aria-labelledby="szPwH"><header class="ss-ch"><h3 id="szPwH">Parolni o'zgartirish</h3><span class="ss-mt" id="szPwdChanged"></span></header>
            <div class="sz-pw">
              <div class="sz-pw-f">
                <div class="ss-f"><label for="profileCurrentPwd">Joriy parol</label><div class="sz-in"><input type="password" id="profileCurrentPwd" autocomplete="current-password"></div></div>
                <div class="ss-f"><label for="profileNewPwd">Yangi parol</label><div class="sz-in"><input type="password" id="profileNewPwd" autocomplete="new-password" aria-describedby="profilePwdRules"><button type="button" class="sz-show" data-pwd-show aria-pressed="false" aria-controls="profileNewPwd">ko'rsatish</button></div></div>
                <div class="ss-f"><label for="profileConfirmPwd">Yangi parolni takrorlang</label><div class="sz-in"><input type="password" id="profileConfirmPwd" autocomplete="new-password"><span class="pwd-match" id="profilePwdMatch" aria-live="polite"></span></div></div>
                <p class="pwd-err" id="profilePwdErr" role="alert"></p>
              </div>
              <div class="sz-req"><b>Talablar</b><ul class="pwd-rules" id="profilePwdRules">${checks.map(c => `<li class="${c.soft ? 'soft' : ''}">${esc(c.t)}</li>`).join('')}</ul>
                <div class="sz-str" aria-hidden="true"><i id="profilePwdMeter"></i></div><small class="pwd-strength" id="profilePwdStrength" aria-live="polite"></small></div>
            </div>
            <footer class="sz-pwf"><label class="sz-cb"><input type="checkbox" id="profilePwdOthers" checked><span>Boshqa qurilmalardan chiqarish</span></label><button type="button" class="ss-btn ss-btn--pri" id="profileChangePwdBtn">Parolni saqlash</button></footer>
          </section>
          <section class="ss-card" aria-labelledby="szFgH"><header class="ss-ch"><h3 id="szFgH">Parolni unutdingizmi?</h3></header>
            <p class="ss-mt ss-vis">Administrator vaqtinchalik parol beradi — u bilan kiring va shu yerda o'zingizning yangi parolingizni qo'ying. Telegram bot orqali tiklash bot ulanganda ishga tushadi.</p></section></div>`;
        if (typeof bindProfilePasswordUi === 'function') bindProfilePasswordUi();
        // Kuch ko'rsatkichi (dizayn: majburiy talablar bajarilsa — "Kuchli", 75%; katta harf bilan — 100%).
        // app.js tinglovchisidan keyin ishlaydi va uning qiymatini shu qoidaga almashtiradi.
        const nw = body.querySelector('#profileNewPwd'), cur = body.querySelector('#profileCurrentPwd');
        const meter = body.querySelector('#profilePwdMeter'), st = body.querySelector('#profilePwdStrength');
        const strength = () => {
            if (!nw.value || typeof _pwdChecks !== 'function') { meter.style.width = '0'; st.textContent = ''; return; }
            const c = _pwdChecks(nw.value, cur.value), req = c.filter(x => !x.soft), okReq = req.filter(x => x.ok).length, soft = c.filter(x => x.soft && x.ok).length;
            const lvl = okReq === req.length ? 'ok' : okReq === req.length - 1 ? 'mid' : 'low';
            meter.style.width = `${Math.round((okReq + soft) / c.length * 100)}%`; meter.dataset.level = lvl;
            st.textContent = lvl === 'ok' ? (soft ? 'Juda kuchli' : 'Kuchli') : lvl === 'mid' ? 'O\'rtacha' : 'Zaif';
        };
        [nw, cur, body.querySelector('#profileConfirmPwd')].forEach(el => el?.addEventListener('input', strength));
        body.querySelector('#profileChangePwdBtn')?.addEventListener('click', () => { if (typeof handleProfilePasswordChange === 'function') handleProfilePasswordChange(); });
        body.querySelector('#profileConfirmPwd')?.addEventListener('keydown', e => { if (e.key === 'Enter') body.querySelector('#profileChangePwdBtn')?.click(); });
        const changed = () => { if (typeof apiLoginHistory === 'function') apiLoginHistory().then(r => {
            const el = body.querySelector('#szPwdChanged'); const t = r?.passwordChangedAt ? ago(r.passwordChangedAt) : '';
            if (ok() && el && t) el.textContent = `oxirgi o'zgartirish: ${t}`;
        }).catch(() => {}); };
        changed();
        // Saqlangandan keyin (js/app.js handleProfilePasswordChange): yozuv va kuch ko'rsatkichi yangilanadi.
        const onChanged = () => { if (!ok()) { window.removeEventListener('profile:password-changed', onChanged); return; } strength(); changed(); };
        window.addEventListener('profile:password-changed', onChanged);
    }

    // ── app.js bilan bog'lanish ──────────────────────────────────────────────
    const SECTIONS = { edit: renderProfile, salary: renderSalary, notifications: renderNotifSettings, security: renderSecurity };
    function render(section, body) {
        body.classList.add('ss-body');
        body.dataset.ssTok = String(++renderSeq);
        return SECTIONS[section](body);
    }
    // Sozlamalar navigatsiyasi. Admin/boshliq nav'ida "Mening maoshim" yo'q (dizayn).
    // Ustoz va yordamchi (role=teacher) — dizayn bo'yicha (UstozProfil … YordamchiSozSessiya): "Sozlamalar" sarlavhasi
    // tepada, nav kartasi uning ostida chapda (css/sozlamalar.css, #profilePage.sz-on); TIZIM'da "Interfeys tili · O'zbek"
    // va "Tungi rejim"; ikkinchi "Bildirishnomalar" (ro'yxat) yo'q — u qo'ng'iroqcha panelida.
    // Barcha rollarda: bandlari yashirin guruh sarlavhasi (masalan MULOQOT, KUZATUV) ko'rinmaydi.
    const STAFF_HIDDEN = ['notif-list', 'archive', 'telegram-groups', 'support', 'peer-chats', 'activity'];
    function adjustNav(user, section) {
        const sal = document.querySelector('[data-profile-section="salary"]');
        if (sal) sal.style.display = isAdmin(user) ? 'none' : '';
        const staff = user?.role === 'teacher';
        document.getElementById('profilePage')?.classList.toggle('sz-on', staff);
        const nav = document.getElementById('profileNav');
        if (nav) {
            const nl = nav.querySelector('[data-profile-section="notif-list"]');
            if (nl) nl.style.display = staff ? 'none' : '';
            let th = nav.querySelector('[data-sz-theme]');
            if (staff && !th) {
                const lang = nav.querySelector('.profile-nav-static');
                th = document.createElement('button');
                th.type = 'button'; th.className = 'profile-nav-item sz-theme'; th.dataset.szTheme = '';
                th.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>Tungi rejim';
                th.addEventListener('click', () => { if (typeof toggleTheme === 'function') toggleTheme(); syncTheme(); });
                (lang?.parentElement || nav).insertBefore(th, lang ? lang.nextSibling : null);
            }
            if (th) th.style.display = staff ? '' : 'none';
            syncTheme();
            nav.querySelectorAll('.profile-nav-group').forEach(g => {
                const vis = [...g.querySelectorAll('.profile-nav-item')].some(i => i.style.display !== 'none' && !i.hidden);
                g.style.display = vis ? '' : 'none';
            });
        }
        if (isAdmin(user) && section === 'salary') return 'edit';
        if (staff && STAFF_HIDDEN.includes(section)) return 'edit';
        return section;
    }
    function syncTheme() {
        const th = document.querySelector('#profileNav [data-sz-theme]');
        if (th) th.setAttribute('aria-pressed', String((typeof getTheme === 'function' ? getTheme() : localStorage.getItem('mh_theme')) === 'dark'));
    }
    // Boshqa modul bo'lim qo'shadi (masalan js/staffSessions.js → 'sessions').
    const register = (name, fn) => { if (typeof fn === 'function') SECTIONS[name] = fn; };
    window.staffSettings = { handles: s => !!SECTIONS[s], render, adjustNav, register };
    window.staffGuides = { render: renderGuides, open: id => renderGuides(id), adminAcks };
    window.staffNotify = staffNotify;
    const boot = () => { if (document.getElementById('notifToggle') && typeof apiFetch === 'function' && localStorage.getItem('mh_token')) staffNotify.start(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
