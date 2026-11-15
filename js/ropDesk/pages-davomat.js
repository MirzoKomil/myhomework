// ROP kompyuter — "Davomat" (dizayn OBD_K_rop / OBD_K_ropRad, 15-noy): o'z jamoasining bugungi davomati va
// "Hozir" holati (ofisda / obedda / tashqarida / kech qaytmoqda) hamda davomat so'rovlarini tasdiqlash.
// Ma'lumot: /api/staff-attendance/team (telefondagi "Xodimlar davomati" bilan bir xil) va /requests.
// Faqat role=rop kompyuterda (pages-common.js). Telefon (js/davomatApp.js) o'zgarmaydi.
(function () {
    'use strict';
    const P = window.ropDeskPages; if (!P) return;
    const U = P.U, esc = U.esc;
    const API = '/api/staff-attendance';
    const tk = () => { const d = new Date(Date.now() + 5 * 3600000); return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
    const pm = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); return m ? +m[1] * 60 + +m[2] : null; };
    const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const durL = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? `${h} soat${r ? ' ' + r + ' daq' : ''}` : `${r} daq`; };
    async function api(path, body) {
        let token = ''; try { token = localStorage.getItem('mh_token') || ''; } catch (e) { /* */ }
        const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Xatolik');
        return j;
    }
    const ST = { on_time: ['Vaqtida', 'grn'], present: ['Vaqtida', 'grn'], late: ['Kechikdi', 'amber'], absent: ['Kelmadi', 'red'], excused: ['Sababli', ''], leave: ['Taʼtilda', ''],
        pending: ['Kutilmoqda', ''], waiting: ['Kutilmoqda', ''], upcoming: ['Hali erta', ''], off: ['Dam olish', ''], before: ['Hisob boshlanmagan', ''], not_ready: ['Yuz tasdiqlanmagan', ''] };
    const pill = (t, tone) => `<span class="rdp-pill${tone ? ' rdp-pill--' + tone : ''}">${esc(t)}</span>`;
    function nowPill(r) {
        const b = r.openBreak, now = tk().min, due = pm(b?.untilClock);
        if (r.now === 'lunch') return pill(`Obedda · ${durL(due - now)} qoldi`, 'amber');
        if (r.now === 'out') return pill(`Tashqarida · ${b?.untilClock || ''} gacha`, '');
        if (r.now === 'lunch_late') return pill(`Obeddan kech · ${now - due} daq`, 'red');
        if (r.now === 'step_late') return pill(`Ruxsatdan kech · ${now - due} daq`, 'red');
        if (r.now === 'office') return r.unverifiedReturn ? pill('Ofisda · tasdiqlanmagan', 'amber') : pill('Ofisda', 'grn');
        if (r.now === 'left') return pill(`Ketdi ${r.outClock || ''}`, '');
        if (r.now === 'not_in') return pill('Kelmagan', '');
        return '<span class="rdp-mt">—</span>';
    }
    const brk = (r, kind) => {
        const list = (r.breaks || []).filter(b => b.kind === kind);
        if (!list.length) return r.notReturned === kind ? '<span class="rdp-red">qaytmadi</span>' : '<span class="rdp-mt">—</span>';
        return list.map(b => `${esc(b.outClock)}–${esc(b.inClock || '…')}${b.open ? ` <small class="rdp-mt">(${esc(b.untilClock)})</small>` : ` · ${b.minutes} daq`}${b.late ? ` <span class="rdp-red">${b.overMinutes} daq kech</span>` : ''}`).join('<br>');
    };
    const S = { data: null, reqs: null, err: '', loading: false };

    async function load(host) {
        S.loading = true;
        try {
            const date = tk().date;
            const [team, inbox] = await Promise.all([api(`/team?date=${date}`), api('/requests?tab=pending').catch(() => ({ rows: [] }))]);
            S.data = team; S.reqs = inbox.rows || []; S.err = '';
        } catch (e) { S.err = e.message; }
        S.loading = false;
        draw(host);
    }
    function render(host) { draw(host); load(host); }

    function draw(host) {
        if (!host) return;
        const head = U.headHtml({ title: 'Davomat', sub: `Bugun · ${hm(tk().min)} holati · faqat oʻz menejerlaringiz`, right: '<button type="button" class="rdp-btn" data-dv-refresh>Yangilash</button>', chipRight: true });
        if (S.err) { host.innerHTML = `${head}<div class="rdp-errbox">${esc(S.err)}</div>`; bind(host); return; }
        if (!S.data) { host.innerHTML = `${head}<div class="rdp-sk"></div><div class="rdp-sk"></div>`; bind(host); return; }
        const v = S.data, s = v.summary || {}, n = v.nowSummary || {};
        const kpi = (label, val, sub, tone) => `<div class="rdp-kpi${tone ? ' rdp-kpi--' + tone : ''}"><small>${label}</small><b>${val}</b><span>${sub}</span></div>`;
        const rows = v.rows || [];
        const table = rows.length ? `<table class="rdp-dv-tbl"><thead><tr><th>Xodim</th><th>Keldi</th><th>Holat</th><th>Obed</th><th>Tashqarida</th><th>Hozir</th><th></th></tr></thead><tbody>
            ${rows.map(r => { const st = ST[r.status] || [r.status, '']; return `<tr><td><span class="rdp-who">${U.av(r.employeeId, r.name, 28)}<b>${esc(r.name)}</b></span></td>
              <td>${esc(r.inClock || '—')}</td><td>${pill(r.status === 'late' && r.lateMinutes ? `Kechikdi ${r.lateMinutes} daq` : st[0], st[1])}</td>
              <td>${brk(r, 'lunch')}</td><td>${brk(r, 'step')}</td><td>${nowPill(r)}</td>
              <td><button type="button" class="rdp-btn" data-dv-day="${esc(r.employeeId)}">Batafsil</button></td></tr>`; }).join('')}</tbody></table>`
            : '<div class="rdp-empty">Kuzatiladigan menejer yoʻq — HR grafik va “Davomat kuzatiladi”ni yoqqanda shu yerda chiqadi.</div>';
        const reqs = S.reqs || [];
        const reqHtml = reqs.length ? reqs.map(r => `<article class="rdp-dv-req"><div class="rdp-dv-req-h">${U.av(r.employeeId, r.name, 30)}<span><b>${esc(r.name)}</b><small>${esc(r.typeLabel)} · ${esc(r.day)}${r.time ? ' ' + esc(r.time) + (r.until ? '–' + esc(r.until) : '') : ''}</small></span></div>
            <p>${esc(r.reason)}${r.comment ? ` · «${esc(r.comment)}»` : ''}</p>
            <div class="rdp-dv-req-a"><button type="button" class="rdp-btn" data-dv-reject="${esc(r.id)}">Rad etish</button><button type="button" class="rdp-btn rdp-btn--pri" data-dv-approve="${esc(r.id)}">Tasdiqlash</button></div></article>`).join('')
            : '<p class="rdp-mt">Kutayotgan soʻrov yoʻq.</p>';
        host.innerHTML = `${head}
          <div class="rdp-kpis">${kpi('Vaqtida', (s.on_time || 0) + (s.present || 0), 'bugun', '')}${kpi('Kechikdi', s.late || 0, 'ertalab', 'amber')}${kpi('Kelmadi', s.absent || 0, 'bugun', 'red')}${kpi('Kutilmoqda', (s.waiting || 0) + (s.pending || 0), 'soʻrov / hali kelmagan', '')}</div>
          <div class="rdp-kpis">${kpi('Hozir ofisda', n.office || 0, 'ishda', '')}${kpi('Obedda', n.lunch || 0, 'taymer ketmoqda', 'amber')}${kpi('Tashqarida', n.out || 0, 'ruxsat bilan', '')}${kpi('Kech qaytmoqda', (n.lunch_late || 0) + (n.step_late || 0), 'obed / ruxsatdan', 'red')}</div>
          <div class="rdp-dv-grid"><div class="rdp-card">${table}</div>
            <aside class="rdp-card"><div class="rdp-card-h"><h2>Davomat soʻrovlari</h2><span class="rdp-cnt">${reqs.length}</span></div>${reqHtml}</aside></div>
          <p class="rdp-mt">Muddatdan 5 daqiqadan koʻp kech qaytsa — «kech» va jarima. Tuzatishni faqat HR va direktor qiladi.</p>`;
        bind(host);
    }

    function bind(host) {
        host.querySelector('[data-dv-refresh]')?.addEventListener('click', () => load(host));
        host.querySelectorAll('[data-dv-approve]').forEach(b => { b.onclick = () => decide(host, b.dataset.dvApprove, 'approve', '', b); });
        host.querySelectorAll('[data-dv-reject]').forEach(b => { b.onclick = () => rejectModal(host, b.dataset.dvReject); });
        host.querySelectorAll('[data-dv-day]').forEach(b => { b.onclick = () => dayModal(b.dataset.dvDay); });
    }
    async function decide(host, id, decision, reason, btn) {
        if (btn) btn.disabled = true;
        try { await api(`/requests/${encodeURIComponent(id)}/decide`, { decision, reason }); U.toast(decision === 'approve' ? 'Tasdiqlandi — xodimga xabar ketdi' : 'Rad etildi — xodimga xabar ketdi', 3000); closeModal(); load(host); }
        catch (e) { if (btn) btn.disabled = false; const er = document.querySelector('.rdp-dv-modal [data-err]'); if (er) er.textContent = e.message; else U.toast(e.message, 4000); }
    }
    function modal(html) {
        closeModal();
        const m = document.createElement('div'); m.className = 'rdp-dv-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
        m.innerHTML = `<div class="rdp-dv-box">${html}</div>`;
        m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) closeModal(); });
        document.addEventListener('keydown', escClose);
        document.body.appendChild(m);
        return m;
    }
    function escClose(e) { if (e.key === 'Escape') closeModal(); }
    function closeModal() { document.querySelectorAll('.rdp-dv-modal').forEach(x => x.remove()); document.removeEventListener('keydown', escClose); }
    const REJ = ['Bugun ish koʻp', 'Oldindan aytilmadi', 'Boshqa'];
    function rejectModal(host, id) {
        const r = (S.reqs || []).find(x => x.id === id); if (!r) return;
        const m = modal(`<div class="rdp-card-h"><h2>Rad etish · ${esc(U.firstName(r.name))}</h2><button type="button" class="rdp-btn rdp-btn--ic" data-close aria-label="Yopish">✕</button></div>
            <p class="rdp-mt">${esc(r.typeLabel)} · ${esc(r.day)}${r.time ? ' ' + esc(r.time) + (r.until ? '–' + esc(r.until) : '') : ''} · ${esc(r.reason)}</p>
            <div class="rdp-fchips">${REJ.map((x, i) => `<button type="button" class="rdp-fchip${i === 0 ? ' is-on' : ''}" data-rj="${esc(x)}">${esc(x)}</button>`).join('')}</div>
            <label class="rdp-fld">Sabab (majburiy)<input type="text" maxlength="120" value="${esc(REJ[0])}" data-rjin></label>
            <p class="rdp-red" data-err></p>
            <div class="rdp-dv-req-a"><button type="button" class="rdp-btn" data-close>Bekor qilish</button><button type="button" class="rdp-btn rdp-btn--pri rdp-dv-dan" data-rjsend>Rad etish</button></div>
            <p class="rdp-mt">Sababsiz rad etib boʻlmaydi. Xodimga push va Telegram orqali boradi.</p>`);
        const inp = m.querySelector('[data-rjin]');
        m.querySelectorAll('[data-rj]').forEach(b => { b.onclick = () => { m.querySelectorAll('[data-rj]').forEach(x => x.classList.toggle('is-on', x === b)); inp.value = b.dataset.rj === 'Boshqa' ? '' : b.dataset.rj; inp.focus(); }; });
        m.querySelector('[data-rjsend]').onclick = e => { const v = inp.value.trim(); if (!v) { m.querySelector('[data-err]').textContent = 'Sababni yozing'; return; } decide(host, id, 'reject', v, e.currentTarget); };
        inp.focus();
    }
    async function dayModal(empId) {
        const m = modal('<div class="rdp-sk"></div>');
        let r;
        try { r = await api(`/team/${encodeURIComponent(empId)}/day?date=${tk().date}`); }
        catch (e) { m.querySelector('.rdp-dv-box').innerHTML = `<p class="rdp-red">${esc(e.message)}</p><button type="button" class="rdp-btn" data-close>Yopish</button>`; return; }
        const KIND = { in: 'Keldi', out: 'Ketdi', break_out: 'Chiqdi', break_in: 'Qaytdi' };
        const ev = (r.attempts || []).filter(a => a.ok).map(a => `<div class="rdp-dv-ev"><b>${esc(a.clock)}</b><span>${KIND[a.kind] || a.kind}${a.breakKind ? ` (${a.breakKind === 'step' ? 'ruxsat' : 'obed'}${a.until ? ', ' + esc(a.until) + ' gacha' : ''})` : ''}${a.unverified ? ' · selfiesiz, tasdiqlanmagan' : ''}</span>${a.photoId ? '<small class="rdp-mt">selfie ✓</small>' : ''}</div>`).join('') || '<p class="rdp-mt">Bugun belgilash yoʻq.</p>';
        m.querySelector('.rdp-dv-box').innerHTML = `<div class="rdp-card-h"><h2>${esc(r.name)} · bugun</h2><button type="button" class="rdp-btn rdp-btn--ic" data-close aria-label="Yopish">✕</button></div>
            <div class="rdp-kpis">${[['Ishladi', r.workedMinutes ? durL(r.workedMinutes) : '—'], ['Obed', r.lunchMinutes ? durL(r.lunchMinutes) : '—'], ['Tashqarida', r.stepMinutes ? durL(r.stepMinutes) : '—']].map(([a, b]) => `<div class="rdp-kpi"><small>${a}</small><b>${b}</b></div>`).join('')}</div>
            ${ev}<p class="rdp-mt">Tuzatishni faqat HR va direktor qiladi.</p>`;
    }

    P.register('davomat', { tab: 'rdp-davomat', render });
})();
