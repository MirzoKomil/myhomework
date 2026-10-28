// Sozlamalar → Sessiyalar (UstozSozSessiya, YordamchiSozSessiya, SotuvSozSessiya, RopSozSessiya, AdminSozSessiya).
// Faol sessiyalar · N (shu qurilma, boshqalarini chiqarish), noto'g'ri parol ogohlantirishi, kirishlar tarixi · 30 kun.
// Server: /api/auth/sessions, /api/auth/login-history (server/routes/auth.js) — har xodim faqat o'zinikini oladi.
// Joy (shahar): IP manzilni tashqi xizmatga yubormaymiz (maxfiylik) va serverda mahalliy GeoIP baza yo'q —
// shuning uchun shahar ko'rsatilmaydi, IP esa qisqartirib (84.54.xx.xx) chiqadi.
(function () {
    'use strict';
    const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const MON3 = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const toast = (m, ms) => (typeof showMiniToast === 'function' ? showMiniToast(m, ms) : console.log(m));
    const me = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || {};
    const ICON = {
        desk: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
        phone: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/></svg>',
        app: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10 7h4M10 11h4M11 18h2"/></svg>'
    };

    // ── Qurilmani user-agent'dan tanish ─────────────────────────────────────
    // Domwork Teacher (Android ilova) WebView UA oxiriga "DomworkTeacher/<versiya>" qo'shadi (android/.../MainActivity.java).
    // Telegram ichidagi brauzer (mini ilova) Android'da "Telegram-Android/<versiya>" qo'shadi; iPhone'da UA farq qilmaydi — Safari bo'lib chiqadi.
    function device(ua) {
        const s = String(ua || '');
        const os = /iPhone/i.test(s) ? 'iPhone' : /iPad/i.test(s) ? 'iPad' : /Android/i.test(s) ? 'Android' : /Windows/i.test(s) ? 'Windows'
            : /Mac OS X|Macintosh/i.test(s) ? 'macOS' : /CrOS/i.test(s) ? 'ChromeOS' : /Linux/i.test(s) ? 'Linux' : '';
        const mobile = ['iPhone', 'iPad', 'Android'].includes(os) || /Mobile/i.test(s);
        if (/DomworkTeacher\//i.test(s)) {
            const v = (s.match(/DomworkTeacher\/([\w.]+)/i) || [])[1];
            return { name: 'Domwork Teacher', os: os || 'Android', short: 'Domwork Teacher', icon: 'app', mobile: true, ver: v || '' };
        }
        if (/Telegram(-Android|Bot|-iOS)?\/|TelegramWebview|\bTelegram\b/i.test(s)) return { name: 'Telegram mini ilova', os: os || 'Noma\'lum', short: 'Telegram', icon: 'phone', mobile: true };
        const br = /Edg(e|A|iOS)?\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /YaBrowser/.test(s) ? 'Yandex' : /SamsungBrowser/.test(s) ? 'Samsung Internet'
            : /Firefox\/|FxiOS/.test(s) ? 'Firefox' : /CriOS|Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : '';
        if (!br && !os) return { name: 'Noma\'lum', os: '', short: 'Noma\'lum', icon: 'desk', mobile: false };
        return { name: br || 'Noma\'lum', os: os || 'Noma\'lum', short: br || 'Noma\'lum', icon: mobile ? 'phone' : 'desk', mobile };
    }
    const label = d => `${d.name}${d.os ? ' · ' + d.os : ''}`;
    const shortLabel = d => `${d.short}${d.os ? ' · ' + d.os : ''}`;
    // IP qisqartiriladi: 84.54.112.7 → 84.54.xx.xx; IPv6 — birinchi ikki guruh.
    function maskIp(ip) {
        const v = String(ip || '').trim().replace(/^::ffff:/i, '');
        if (!v) return '';
        if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) { const p = v.split('.'); return `${p[0]}.${p[1]}.xx.xx`; }
        if (v.includes(':')) return v.split(':').filter(Boolean).slice(0, 2).join(':') + ':…';
        return v;
    }
    const tzParts = v => { const d = new Date(new Date(v).getTime() + 5 * 3600000); return { day: d.toISOString().slice(0, 10), hm: d.toISOString().slice(11, 16), m: d.getUTCMonth(), dd: d.getUTCDate() }; };
    const todayTz = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
    const yesterdayTz = () => new Date(Date.now() + 5 * 3600000 - 864e5).toISOString().slice(0, 10);
    const dm = v => { const p = tzParts(v); return `${p.dd}-${MON3[p.m]} ${p.hm}`; };
    function when(v) {
        if (!v || Number.isNaN(Date.parse(v))) return '—';
        const p = tzParts(v);
        if (p.day === todayTz()) return `bugun ${p.hm}`;
        if (p.day === yesterdayTz()) return `kecha ${p.hm}`;
        return dm(v);
    }
    const head = () => '<div class="profile-header-bar ss-head"><h1>Sozlamalar</h1><p>Xavfsizlik · qurilmalar va kirishlar</p></div>';

    async function render(body) {
        // Javob kelguncha boshqa bo'limga o'tilgan bo'lsa chizilmaydi (js/staffSettings.js render tokeni).
        const tok = body.dataset.ssTok, ok = () => body.isConnected && body.classList.contains('ss-body') && body.dataset.ssTok === tok;
        body.innerHTML = head() + '<div class="ss-col"><div class="ss-card ss-pad ss-muted">Yuklanmoqda…</div></div>';
        let sessions = [], hist = null, err = null;
        await Promise.all([
            apiGetSessions().then(r => { sessions = r.sessions || []; }).catch(e => { err = e; }),
            (typeof apiLoginHistory === 'function' ? apiLoginHistory() : Promise.resolve(null)).then(r => { hist = r; }).catch(() => { hist = null; })
        ]);
        if (!ok()) return;
        if (err) { body.innerHTML = head() + `<div class="ss-col"><div class="ss-card ss-pad ss-err" role="alert">${esc(err.message || 'Xatolik')}</div></div>`; return; }
        draw(body, sessions, hist);
    }

    function draw(body, sessions, hist) {
        // Joriy sessiya birinchi, qolganlari oxirgi faollik bo'yicha.
        const list = [...sessions].sort((a, b) => (b.isCurrent - a.isCurrent) || (Date.parse(b.lastSeen || b.createdAt) || 0) - (Date.parse(a.lastSeen || a.createdAt) || 0));
        const others = list.filter(s => !s.isCurrent).length;
        const rows = list.map(s => {
            const d = device(s.userAgent), ip = maskIp(s.ip);
            const sub = [ip, s.isCurrent ? 'hozir faol' : when(s.lastSeen || s.createdAt)].filter(Boolean).join(' · ');
            return `<li class="tgs-ses" data-session-id="${esc(s.id)}"><span class="tgs-ic${d.icon === 'app' ? ' app' : ''}">${ICON[d.icon]}</span>
              <span class="tgs-sx"><b>${esc(label(d))}${s.isCurrent ? ' <i class="tgs-me">shu qurilma</i>' : ''}</b><small title="${esc(s.createdAt ? 'Kirgan: ' + dm(s.createdAt) : '')}">${esc(sub)}</small></span>
              ${s.isCurrent ? '' : `<button type="button" class="ss-btn ss-btn--sm" data-end="${esc(s.id)}" aria-label="${esc(label(d))} sessiyasini chiqarish">Chiqarish</button>`}</li>`;
        }).join('');
        const H = hist || {}, ev = H.events || [];
        // Bir IP dan 1 soat ichidagi ketma-ket noto'g'ri urinishlar bitta qatorga yig'iladi (× N).
        const groups = [];
        for (const e of ev) { const last = groups[groups.length - 1];
            if (last && !e.ok && !last.ok && last.ip === e.ip && Math.abs(new Date(last.at) - new Date(e.at)) < 3600e3) { last.n++; last.at = e.at; } else groups.push({ ...e, n: 1 }); }
        const recentFail = groups.find(g => !g.ok && Date.now() - new Date(g.at) < 7 * 864e5);
        const warn = recentFail ? `<div class="tgs-warn" role="alert"><p><b>${esc(dm(recentFail.at))} — ${recentFail.n} marta noto'g'ri parol${recentFail.ip ? ` (${esc(maskIp(recentFail.ip))})` : ''}.</b> Siz bo'lmasangiz parolni o'zgartiring.${H.failLimit ? ` ${H.failLimit} xatodan keyin kirish ${H.lockMinutes} daqiqaga bloklanadi.` : ''}</p>
            <button type="button" class="ss-btn ss-btn--sm" data-go-pwd>Parolni o'zgartirish</button></div>` : '';
        const histRows = groups.map(g => { const d = device(g.userAgent);
            return `<tr><td>${esc(dm(g.at))}</td><td>${esc(shortLabel(d))}</td><td class="tgs-ip">${esc(maskIp(g.ip) || '—')}</td><td>${g.ok ? '<i class="ss-pill ok">Kirdi</i>' : `<i class="ss-pill bad">Noto'g'ri parol${g.n > 1 ? ' × ' + g.n : ''}</i>`}</td></tr>`; }).join('');
        const admin = ['admin', 'boshliq'].includes(me().role);
        body.innerHTML = head() + `<div class="ss-col">
          <section class="ss-card" aria-labelledby="tgsSH"><header class="ss-ch"><h3 id="tgsSH">Faol sessiyalar · ${list.length}</h3>${others ? '<button type="button" class="ss-btn ss-btn--sm" data-end-all>Boshqa hammasidan chiqish</button>' : ''}</header>
            ${list.length ? `<ul class="tgs-sl">${rows}</ul>` : '<p class="ss-pad ss-mt">Faol sessiya topilmadi</p>'}</section>
          ${warn}
          <section class="ss-card" aria-labelledby="tgsHH"><header class="ss-ch"><h3 id="tgsHH">Kirishlar tarixi · 30 kun</h3></header>
            ${hist == null ? '<p class="ss-pad ss-mt">Tarixni yuklab bo\'lmadi</p>' : groups.length ? `<div class="ss-tw"><table class="ss-tbl tgs-ht"><thead><tr><th scope="col">Vaqt</th><th scope="col">Qurilma</th><th scope="col" title="Shahar ko'rsatilmaydi: IP manzil tashqi xizmatga yuborilmaydi. IP qisqartirilgan holda chiqadi.">IP</th><th scope="col">Natija</th></tr></thead><tbody>${histRows}</tbody></table></div>`
                : '<p class="ss-pad ss-mt">Hozircha yozuv yo\'q — tarix shu yangilanishdan keyin yig\'iladi.</p>'}</section>
          ${admin ? `<section class="ss-card" aria-labelledby="tgsAH"><header class="ss-ch"><h3 id="tgsAH">Xodimni tizimdan chiqarish</h3><span class="ss-badge">faqat admin</span></header>
            <p class="ss-pad ss-mt" style="margin:0">Xodim ishdan ketsa yoki qurilmasi yo'qolsa: HR bo'limi → xodim → "Ishdan bo'shatish" — login bloklanadi va barcha sessiyalari tugaydi. Har bir majburiy chiqarish tarixga yoziladi.</p></section>` : ''}
        </div>`;
        body.querySelectorAll('[data-end]').forEach(b => b.addEventListener('click', async () => {
            b.disabled = true;
            try { await apiDeleteSession(b.dataset.end); toast('Sessiya tugatildi'); render(body); }
            catch (e) { b.disabled = false; toast(e.message, 4000); }
        }));
        body.querySelector('[data-end-all]')?.addEventListener('click', async e => {
            const b = e.currentTarget; b.disabled = true;
            try { await apiDeleteOtherSessions(); toast('Boshqa qurilmalardan chiqildi'); render(body); }
            catch (err) { b.disabled = false; toast(err.message, 4000); }
        });
        body.querySelector('[data-go-pwd]')?.addEventListener('click', () => {
            if (typeof switchProfileSection === 'function') switchProfileSection('security');
            else document.querySelector('[data-profile-section="security"]')?.click();
        });
    }

    window.staffSessions = { render, device, maskIp };
    window.staffSettings?.register?.('sessions', render);
})();
