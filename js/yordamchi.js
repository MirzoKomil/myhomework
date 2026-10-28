// Yordamchi ustoz kabineti — to'liq dizayn (YordamchiDavomat, YordamchiOquvchilar, YordamchiOyYopildi,
// YordamchiBosh) va ustozning "O'quvchilar" sahifasi (UstozOquvchiList).
// js/schoolTeacher.js dan keyin yuklanadi va window.schoolTeacher dagi shu funksiyalarni almashtiradi:
//   renderContacts, markDrawer, renderMyStudents, assistantHome (+ financeDrawer, callStudent).
// "Aloqani belgilash" oynasi hamma joyda bitta: Bosh sahifa, Davomat (aloqalar), Dars jadvali v2
// (tavsiya bloki), O'quvchilarim va o'quvchi kartasi ("Qo'ng'iroq").
// Maosh hisobi o'zgarmaydi — hammasi serverdagi contacts-v1 (assist.js countMonth) natijasidan.
// Ustoz/yordamchiga to'lov, tarif, qarz va sotuv ma'lumoti ko'rsatilmaydi.
(function () {
    'use strict';
    const base = window.schoolTeacher || {};
    const U = () => window.schoolUI;
    const me = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || {};
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const MON_S = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const mName = m => MON[Number(String(m).slice(5, 7)) - 1] || '';
    const cap1 = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
    const dS = d => (d ? `${Number(d.slice(8, 10))}-${MON_S[Number(d.slice(5, 7)) - 1]}` : '—');
    const dG = d => (d ? `${Number(d.slice(8, 10))}-${MON[Number(d.slice(5, 7)) - 1]}` : '—');
    const ddmm = d => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : '');
    const ddmmyy = d => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const money = n => (typeof formatMoney === 'function' ? formatMoney(n) : num(n) + ' so\'m');
    const first = n => String(n || '').trim().split(/\s+/)[0] || '';
    const patternDays = d => ([1, 3, 5].includes(Number(d)) ? [1, 3, 5] : [2, 4, 6].includes(Number(d)) ? [2, 4, 6] : Number(d) >= 1 && Number(d) <= 7 ? [Number(d)] : []);
    // assist.js / time.js adviceDays bilan bir xil.
    const advDays = s => { const p = patternDays(s.lessonDayOfWeek); return p.join() === '1,3,5' ? [2, 4, 6] : p.join() === '2,4,6' ? [1, 3, 5] : [1, 2, 3, 4, 5, 6].filter(d => !p.includes(d)); };
    // Zaxira: haqiqiy narx serverdan (rep.rate — Moliya → KPI sozlamalari, yordamchi tarifi ÷ 13; 29-okt: 40 000 → 3 077).
    const RATE = 3077, CAP = 13;
    // Usullar dizayndagidek guruhlangan (Ovozli / Video / Yozma).
    const CHG = [['Ovozli', [['phone', '☎ Telefon qo\'ng\'iroq']]],
        ['Video', [['zoom', 'Zoom'], ['meet', 'Google Meet'], ['tg_video', 'Telegram video qo\'ng\'iroq'], ['tg_group', 'Telegram guruhda videodars']]],
        ['Yozma', [['tg_text', '✉ Telegram yozishma']]]];
    const CHI = { phone: ['☎', 'Telefon'], zoom: ['Z', 'Zoom'], meet: ['M', 'Google Meet'], tg_video: ['▶', 'Telegram video'], tg_group: ['▶', 'Telegram guruh'], tg_text: ['✉', 'Telegram yozishma'] };
    const NOT_COUNTED = { short: '5 daqiqadan qisqa', same_day: 'shu kuni 2-chi', extra_text: 'haftadagi 2-yozishma', over_cap: '13 dan ortiq' };
    const PHONE_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';
    const TG_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M21.5 4.3 2.9 11.5c-1.3.5-1.2 1.3-.2 1.6l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.5Z"/></svg>';
    const LOCK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
    const students = () => (typeof getItem === 'function' ? getItem(STORAGE_KEYS.students, []) : []) || [];

    // Telegram guruh havolasi (my-groups) — sahifalar orasida qisqa kesh.
    let _grp = null, _grpAt = 0;
    async function groupsMap() {
        if (_grp && Date.now() - _grpAt < 60000) return _grp;
        const r = await U().api('/my-groups').catch(() => ({ groups: [] }));
        _grp = new Map((r.groups || []).map(g => [g.student_id, g])); _grpAt = Date.now();
        return _grp;
    }
    const tgLink = g => g?.tg_link || g?.link || '';
    const tgIcon = g => (tgLink(g) ? `<a class="yd-ic yd-ic--tg" href="${U().esc(tgLink(g))}" target="_blank" rel="noopener" title="Telegram guruh: ${U().esc(g.name || '')}" aria-label="Telegram guruhni ochish">${TG_SVG}</a>`
        : `<span class="yd-ic yd-ic--off" title="Telegram guruh havolasi yo'q" aria-label="Telegram guruh havolasi yo'q">${TG_SVG}</span>`);
    const callIcon = id => `<button type="button" class="yd-ic yd-ic--call" data-call="${U().esc(id)}" title="Qo'ng'iroq — Telegram guruh va aloqani belgilash" aria-label="Qo'ng'iroq">${PHONE_SVG}</button>`;

    // ☎ Qo'ng'iroq: o'quvchining Telegram guruhini ochadi (telefon raqami yashirin) va aloqani belgilash oynasini ko'rsatadi.
    async function callStudent(s, done, mark = markDrawer) {
        if (!s) return;
        const g = (await groupsMap()).get(s.id);
        if (tgLink(g)) window.open(tgLink(g), '_blank', 'noopener');
        else U().toast('Telegram guruh havolasi yo\'q — admin qo\'shadi. Aloqani belgilashingiz mumkin', 3500);
        mark(s, done);
    }

    // ── Aloqani belgilash (bitta oyna — hamma joyda) ─────────────────────────
    function adviceLine(s) {
        const { today, addDays, wd, DAY, toMin, nowMin } = U();
        const td = today(), days = advDays(s), t = s.lessonTime || '';
        if (days.includes(wd(td))) {
            const m = toMin(t), diff = m == null ? null : m - nowMin();
            const rel = diff == null ? '' : diff > 0 ? ` · ${diff >= 60 ? Math.floor(diff / 60) + ' soat ' : ''}${diff % 60} daqiqadan keyin` : diff > -15 ? ' · hozir' : ' · vaqti o\'tdi, bugun istalgan vaqt hisoblanadi';
            return `tavsiya: bugun${t ? ' ' + t : ''}${rel}`;
        }
        for (let i = 1; i <= 7; i++) { const d = addDays(td, i); if (days.includes(wd(d))) return `tavsiya: ${DAY[wd(d) - 1]} ${dS(d)}${t ? ' ' + t : ''} · bugun ham hisoblanadi`; }
        return 'bugungi istalgan vaqt hisoblanadi';
    }
    // opts.inline — element: oyna o'rniga sahifa ichidagi karta (YordamchiDavomat dizayni); opts.onClose — "Bekor".
    function markDrawer(s, done, opts = {}) {
        if (!s) return;
        const { openDrawer, esc, today, weekStart } = U();
        const inline = opts.inline || null;
        const chipsHtml = CHG.map(([g, list]) => `<div class="yd-chg"><span class="yd-chg-l">${g}</span><div class="yd-chg-b" role="radiogroup" aria-label="${g}">${list.map(([v, l]) => `<label class="yd-opt"><input type="radio" name="ch" value="${v}"><span>${esc(l)}</span></label>`).join('')}
            ${g === 'Yozma' ? `<small class="sc-mt" data-txt>haftasiga 1 tagacha hisoblanadi · ${esc(first(s.name))}da bu hafta …</small>` : ''}</div></div>`).join('');
        const drawerOpts = { title: `Aloqani belgilash · ${s.name}`, wide: true, sub: `<span class="sc-pill sc-pill--info">${esc(adviceLine(s))}</span>`, body: `
            <div class="yd-mark">
              <p class="yd-cap">Qanday bog'lanildi?</p>${chipsHtml}
              <p class="yd-cap">Davomiyligi</p>
              <div class="yd-min"><input name="min" type="number" inputmode="numeric" min="1" max="180" placeholder="—" aria-label="Davomiylik, daqiqa"><span class="sc-mt">daqiqa</span>
                ${[5, 10, 15, 20].map(n => `<button type="button" class="yd-mb" data-min="${n}">${n}</button>`).join('')}</div>
              <small class="yd-hint" data-minhint>5 daqiqadan kam bo'lsa hisoblanmaydi</small>
              <p class="yd-cap">Nima qilindi? (ixtiyoriy)</p>
              <textarea name="note" rows="2" placeholder="masalan: 20-dars so'zlari, &quot;My family&quot; haqida gaplar" aria-label="Nima qilindi"></textarea>
              <div class="sc-note" data-will hidden></div>
            </div>`,
            foot: `<button type="button" class="sc-btn" data-na>✕ Javob bermadi</button><span class="sc-grow"></span><button type="button" class="sc-btn" data-close>Bekor</button>
              <span class="sc-mt yd-foothint">usul va daqiqani tanlang · bugungi istalgan vaqt hisoblanadi</span><button type="button" class="sc-btn sc-btn--pri" data-save>Shug'ullanildi · saqlash</button>` };
        let box;
        if (inline) {
            inline.innerHTML = `<section class="sc-card ydm-card" aria-labelledby="ydmTitle"><header class="sc-ch"><h2 id="ydmTitle">${esc(drawerOpts.title)}</h2>${drawerOpts.sub}</header>
              <form class="sc-db ydm-frm" novalidate>${drawerOpts.body}<div class="ydm-foot"><span class="ydm-fl">${drawerOpts.foot.split('<span class="sc-grow"></span>')[0]}</span><span class="ydm-fr">${drawerOpts.foot.split('<span class="sc-grow"></span>')[1]}</span></div></form></section>`;
            box = inline.firstElementChild;
            box.querySelector('form').onsubmit = e => e.preventDefault();
            box.querySelector('[data-close]').onclick = () => opts.onClose?.();
        } else box = openDrawer(drawerOpts);
        const close = () => { if (!inline) U().closeDrawer(); };
        const td = today(), ws = weekStart(td);
        let items = null;
        const minEl = box.querySelector('[name=min]'), will = box.querySelector('[data-will]');
        const ch = () => box.querySelector('[name=ch]:checked')?.value || '';
        const sync = () => {
            const c = ch(), m = Number(minEl.value) || 0;
            box.querySelectorAll('[data-min]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.min) === m)));
            box.querySelector('[data-minhint]').textContent = c === 'tg_text' ? 'Yozishmada daqiqa shart emas' : '5 daqiqadan kam bo\'lsa hisoblanmaydi';
            // Saqlashdan oldin ogohlantirish — hisob baribir serverda (contacts-v1).
            const why = [];
            if (c && c !== 'tg_text' && m > 0 && m < 5) why.push('5 daqiqadan qisqa');
            if (items) {
                if (items.some(i => i.day === td && i.status === 'counted')) why.push('bugun bu o\'quvchi bilan aloqa allaqachon hisoblangan');
                if (c === 'tg_text' && items.some(i => i.day >= ws && i.channel === 'tg_text' && i.status === 'counted')) why.push('bu haftadagi yozishma allaqachon hisoblangan');
                if (items.filter(i => i.status === 'counted').length >= CAP) why.push(`oylik ${CAP} ta limit to'lgan`);
            }
            will.hidden = !why.length;
            will.textContent = why.length ? `Saqlanadi, lekin maoshga hisoblanmaydi: ${why.join(' · ')}.` : '';
        };
        box.querySelectorAll('[name=ch]').forEach(i => i.onchange = sync);
        minEl.oninput = sync;
        box.querySelectorAll('[data-min]').forEach(b => b.onclick = () => { minEl.value = b.dataset.min; sync(); });
        U().api(`/assist/month?month=${td.slice(0, 7)}`).then(rep => {
            items = (rep.students || []).find(x => x.studentId === s.id)?.items || [];
            const n = items.filter(i => i.day >= ws && i.channel === 'tg_text' && i.status === 'counted').length;
            const el = box.querySelector('[data-txt]'); if (el) el.textContent = `haftasiga 1 tagacha hisoblanadi · ${first(s.name)}da bu hafta ${n}`;
            sync();
        }).catch(() => { const el = box.querySelector('[data-txt]'); if (el) el.textContent = 'haftasiga 1 tagacha hisoblanadi'; });
        const send = async (btn, body) => {
            U().busy(btn, true);
            try { await U().post('/assist/contacts', { studentId: s.id, ...body }); U().toast(body.outcome === 'no_answer' ? 'Javob bermadi — yozildi' : 'Aloqa saqlandi'); close(); done?.(); }
            catch (err) { U().busy(btn, false); U().errBox(box, err.message); }
        };
        box.querySelector('[data-save]').onclick = e => {
            const c = ch(), m = Number(minEl.value) || 0;
            if (!c) return U().errBox(box, 'Aloqa usulini tanlang');
            if (c !== 'tg_text' && !m) { minEl.focus(); return U().errBox(box, 'Davomiylikni daqiqada kiriting'); }
            send(e.target, { channel: c, minutes: m, note: box.querySelector('[name=note]').value });
        };
        box.querySelector('[data-na]').onclick = e => send(e.target, { outcome: 'no_answer', channel: ch() || 'phone', note: box.querySelector('[name=note]').value });
        if (opts.channel) { const r = box.querySelector(`[name=ch][value="${opts.channel}"]`); if (r) { r.checked = true; sync(); } }
    }

    // ── Kechikib belgilash so'rovi (admin orqali) — eski oyna, usullar guruhlangan ──
    function lateDrawer(list, done) {
        const { openDrawer, field, esc, today, addDays } = U();
        const box = openDrawer({ title: 'Kechikib belgilash so\'rovi', sub: 'Admin tasdiqlasa hisobga qo\'shiladi', body: `
            ${field('O\'quvchi', `<select name="st">${list.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>`)}
            <div class="sc-g2">${field('Sana', `<input type="date" name="day" max="${addDays(today(), -1)}" min="${today().slice(0, 7)}-01">`)}${field('Usul', `<select name="ch">${CHG.map(([g, l]) => `<optgroup label="${g}">${l.map(([v, t]) => `<option value="${v}">${esc(t.replace(/^[☎✉] /, ''))}</option>`).join('')}</optgroup>`).join('')}</select>`)}${field('Davomiylik, daqiqa', '<input name="min" inputmode="numeric">')}</div>
            ${field('Nega o\'z vaqtida belgilanmadi', '<textarea name="reason" rows="2"></textarea>')}`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Yuborish</button>' });
        box.querySelector('[data-save]').onclick = async e => {
            const v = n => box.querySelector(`[name=${n}]`).value;
            U().busy(e.target, true);
            try { await U().post('/assist/late-requests', { studentId: v('st'), day: v('day'), channel: v('ch'), minutes: Number(v('min')) || 0, reason: v('reason') }); U().toast('So\'rov yuborildi'); U().closeDrawer(); done?.(); }
            catch (err) { U().busy(e.target, false); U().errBox(box, err.message); }
        };
    }

    // ── Moliyaga murojaat (yopilgan oy bo'yicha) — admin "So'rovlar"da ko'radi va javob beradi ──
    const FIN = [['missing', 'Aloqa ro\'yxatda yo\'q'], ['not_counted', 'Aloqa hisoblanmagan'], ['wrong_sum', 'Summa noto\'g\'ri'], ['other', 'Boshqa']];
    function financeDrawer(month, rep, done) {
        const { openDrawer, field, esc } = U();
        const all = students();
        const ids = new Set([...(rep?.students || []).map(x => x.studentId), ...all.filter(s => s.assistantTeacherId === me().linkedTeacherId).map(s => s.id)]);
        const opts = [...ids].map(id => all.find(s => s.id === id) || { id, name: id }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const { from, to } = { from: month + '-01', to: U().addDays(U().addDays(month + '-01', 32).slice(0, 7) + '-01', -1) };
        const box = openDrawer({ title: 'Moliyaga murojaat', sub: `${cap1(mName(month))} · yopilgan oy · to'lovdan oldin ko'rib chiqiladi`, body: `
            <div class="sc-sec"><h3>Nima noto'g'ri?</h3><div class="sc-chips" role="radiogroup">${FIN.map(([v, l], i) => `<label class="sc-chip"><input type="radio" name="kind" value="${v}"${i ? '' : ' checked'}><span>${esc(l)}</span></label>`).join('')}</div></div>
            <div class="sc-g2">${field('O\'quvchi', `<select name="st"><option value="">— umumiy (o'quvchisiz) —</option>${opts.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>`)}
              ${field('Kun', `<input type="date" name="day" min="${from}" max="${to}">`, 'ixtiyoriy')}</div>
            ${field('Izoh', '<textarea name="reason" rows="3" placeholder="Masalan: 26-oktabr 18:10 da Bekzod bilan Telefonda 8 daqiqa gaplashdim, ro\'yxatda yo\'q"></textarea>', 'Kamida 5 belgi')}
            ${field('Isbot', '<input name="proof" placeholder="Skrinshot havolasi yoki qo\'ng\'iroqlar tarixidagi vaqt">', 'ixtiyoriy · admin tekshiradi')}
            <div class="sc-note">Murojaat admin/Moliyaga boradi. Hisob faqat admin tuzatsa o'zgaradi — tuzatish sababi bilan tarixda qoladi. Yakuniy tasdiqdan keyin murojaat qabul qilinmaydi.</div>`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Yuborish</button>' });
        box.querySelector('[data-save]').onclick = async e => {
            const v = n => box.querySelector(`[name=${n}]`).value;
            if (v('reason').trim().length < 5) return U().errBox(box, 'Nima noto\'g\'ri ekanini yozing');
            U().busy(e.target, true);
            try {
                await U().post('/requests', { type: 'assist_finance', month, kind: box.querySelector('[name=kind]:checked')?.value || 'other', studentId: v('st') || undefined, day: v('day') || undefined, reason: v('reason'), proof: v('proof') });
                U().toast('Murojaat Moliyaga yuborildi'); U().closeDrawer(); done?.();
            } catch (err) { U().busy(e.target, false); U().errBox(box, err.message); }
        };
    }

    // Yuborilgan murojaatlar va admin javobi (yordamchi o'zi ko'radi).
    function finList(fin) {
        const { esc } = U();
        if (!fin.length) return '';
        const K = Object.fromEntries(FIN);
        return `<ul class="yd-fin">${fin.map(r => { const p = r.payload || {};
            const st = r.status === 'new' ? ['ko\'rib chiqilmoqda', 'warn'] : r.status === 'approved' ? ['ko\'rib chiqildi', 'ok'] : ['rad etildi', 'bad'];
            return `<li><span class="sc-pill sc-pill--${st[1]}">${st[0]}</span><span><b>${esc(K[p.kind] || 'Boshqa')}</b>${p.studentName ? ' · ' + esc(p.studentName) : ''}${p.day ? ' · ' + esc(dS(p.day)) : ''} — "${esc(r.reason)}"${r.decision_note ? `<small class="sc-mt yd-blk">Javob (${esc(r.decided_by_name || 'admin')}): ${esc(r.decision_note)}</small>` : ''}</span></li>`; }).join('')}</ul>`;
    }

    // ── Umumiy hisob: bu hafta, qayta urinish ───────────────────────────────
    // items: [{ day, status, outcome, channel, at }] (bir o'quvchi).
    function retryOf(items, ws, pendingReq) {
        const wk = items.filter(i => i.day >= ws).sort((a, b) => a.day.localeCompare(b.day) || (a.at ?? 0) - (b.at ?? 0));
        const lastNa = [...wk].reverse().find(i => i.outcome === 'no_answer');
        const after = lastNa && wk.some(i => i.outcome !== 'no_answer' && (i.day > lastNa.day || (i.day === lastNa.day && (i.at ?? 0) >= (lastNa.at ?? 0))));
        if (lastNa && !after) return { day: lastNa.day, req: !!pendingReq };
        if (pendingReq) return { day: null, req: true };
        return null;
    }
    const retryNote = (s, r, td) => `${first(s.name)}${r.day ? ` (${r.day === td ? 'bugun' : U().DAY[U().wd(r.day) - 1]})` : ''}${r.req ? ' — so\'rov adminda' : ''}`;

    // ── Yopilgan oy jadvali (Aloqalar va Bosh sahifa) ───────────────────────
    function closedTable(month, rep, changes, opts = {}) {
        const { esc, studentAvatar, teacherName, DAY, wd } = U();
        const all = students(), byId = new Map(all.map(s => [s.id, s]));
        const left = new Map((changes || []).filter(c => c.kind === 'left').map(c => [c.studentId, c]));
        const rows = [...(rep.students || [])].map(r => ({ r, s: byId.get(r.studentId) || { id: r.studentId, name: r.studentId } }));
        for (const s of opts.extra || []) if (!rows.some(x => x.s.id === s.id)) rows.push({ r: { studentId: s.id, counted: 0, noAnswer: 0, overCap: 0, short: 0, sameDay: 0, extraText: 0, items: [], amount: 0 }, s });
        rows.sort((a, b) => !!left.get(a.s.id) - !!left.get(b.s.id) || String(a.s.name).localeCompare(String(b.s.name)));
        const izoh = (r, s) => {
            const out = [];
            const cor = (r.items || []).filter(i => i.corrected);
            if (cor.length) out.push(`<span class="sc-pill sc-pill--info">+${cor.length} admin tuzatishi · ${esc(DAY[wd(cor[0].day) - 1])} ${esc(dS(cor[0].day))}${cor.every(i => i.status !== 'counted') ? ' · hisoblanmadi' : ''}</span>`);
            if (r.noAnswer) out.push(`<span class="sc-mt">${r.noAnswer} javob bermadi</span>`);
            if (r.overCap) out.push(`<span class="sc-mt">${r.overCap} ta limitdan ortiq</span>`);
            const rule = (r.short || 0) + (r.sameDay || 0) + (r.extraText || 0);
            if (rule) out.push(`<span class="sc-mt">${rule} ta qoida bo'yicha hisoblanmadi</span>`);
            const l = left.get(s.id);
            if (l) out.push(`<span class="sc-pill sc-pill--mute">${esc(dS(l.from))} chiqib ketgan · o'qigan davri hisoblanadi</span>`);
            return out.join(' ') || '—';
        };
        const total = rows.reduce((n, x) => n + (x.r.counted || 0), 0), amount = rows.reduce((n, x) => n + (x.r.amount || (x.r.counted || 0) * (rep.rate || RATE)), 0);
        return `<section class="sc-card yd-closed"><header class="sc-ch"><h2>${esc(cap1(mName(month)))} · o'quvchilar bo'yicha yakun</h2><span class="sc-mt">yopilgan hisob · o'zgarmaydi</span></header>
          <div class="yd-tw"><table class="sc-table"><thead><tr><th>O'quvchi</th><th class="r">Hisoblangan</th><th class="r">Summa, so'm</th><th>Izoh</th></tr></thead><tbody>
          ${rows.map(({ r, s }) => { const l = left.get(s.id); return `<tr class="${l ? 'yd-gone' : ''}"><td><span class="sc-row">${studentAvatar(s, 28)}<span class="yd-who"><b>${esc(s.name)}</b><small class="sc-mt">asosiy: ${esc(teacherName(s.teacherId, true))}${l ? ` · 1–${esc(dS(U().addDays(l.from, -1)))}` : ''}</small></span></span></td>
            <td class="r"><b>${r.counted || 0}</b> / ${rep.cap || CAP}</td><td class="r">${num(r.amount ?? (r.counted || 0) * (rep.rate || RATE))}</td><td><div class="yd-izoh">${izoh(r, s)}</div></td></tr>`; }).join('') || `<tr><td colspan="4" class="sc-mt">Bu oyda aloqa yo'q</td></tr>`}
          </tbody><tfoot><tr><td>Jami · ${rows.length} o'quvchi</td><td class="r">${total}</td><td class="r">${num(amount)}</td><td></td></tr></tfoot></table></div></section>`;
    }
    // Vaqt belgisi Toshkent vaqtida, boshqa sahifalardagi dG() bilan bir xil: "2-noyabr 11:20".
    function dT(iso) {
        if (!iso) return '';
        const t = new Date(new Date(iso).getTime() + 5 * 3600000).toISOString();
        return `${dG(t.slice(0, 10))} ${t.slice(11, 16)}`;
    }
    // card4 — xodimning o'z kartasi oxirgi 4 raqami (/api/staff/salary, faqat o'ziniki).
    function paySteps(month, rep, card4 = '') {
        const st = rep.state || {}, nx = U().addDays(month + '-01', 32).slice(0, 7);
        const card = card4 ? ` · karta •••• ${card4}` : '';
        const steps = [['Oy yopildi', true, `1-${MON[Number(nx.slice(5)) - 1]} 00:00 · avtomatik`],
            ['Hisob tayyor', true, st.locked_at ? `${dT(st.locked_at)} · ${rep.counted} aloqa` : `${rep.counted} hisoblangan aloqa`],
            ['Dastlabki tasdiq', !!st.prelim_at, st.prelim_at ? dT(st.prelim_at) + ' · Moliya' : 'kutilmoqda'],
            ['E\'tiroz muddati', !!st.final_at, st.objection_until ? `${dG(String(st.objection_until).slice(0, 10))} gacha · keyin yakuniy` : '4-sanagacha · keyin yakuniy'],
            ['To\'lov', !!st.paid_at, st.paid_at ? `${dT(st.paid_at)} · to'landi${card}` : `5-${MON[Number(nx.slice(5)) - 1]}${card}`]];
        const cur = steps.findIndex(s => !s[1]);
        return { steps, cur, last: steps.filter(s => s[1]).pop()?.[0] || 'Oy yopildi' };
    }
    function stepsHtml(month, rep, prev2, card4 = '') {
        const { esc } = U();
        const p = paySteps(month, rep, card4);
        return `<section class="sc-card yd-pay"><header class="sc-ch"><h2>To'lov holati</h2><span class="sc-pill sc-pill--info">${esc(p.last)}</span></header>
          <ol class="yd-steps">${p.steps.map(([n, ok, sub], i) => `<li class="${ok ? 'ok' : i === p.cur ? 'cur' : ''}"><i>${ok ? '✓' : i + 1}</i><span><b>${esc(n)}</b><small>${esc(sub)}</small></span></li>`).join('')}</ol>
          ${prev2 && prev2.amount ? `<p class="sc-mt yd-pad">${esc(cap1(mName(prev2.month)))}: ${esc(money(prev2.amount))}${prev2.counted ? ` · ${prev2.counted} aloqa` : ''}${prev2.state?.paid_at ? ' · to\'langan' : ''}</p>` : ''}</section>`;
    }

    // ── Davomat · aloqalar (YordamchiDavomat) ───────────────────────────────
    // mark: '' — avtomatik (keyingi tavsiya), null — yopilgan, id — tanlangan o'quvchi.
    let conState = { filter: 'all', mark: '' };
    async function renderContacts(root) {
        if (!root) return;
        const { api, esc, today, studentAvatar, teacherName, wd, weekStart, addDays, DAY, DAY_FULL, pattern, toMin, nowMin } = U();
        await U().loadStaffAvatars();
        const td = today(), month = root.dataset.month || td.slice(0, 7), cur = td.slice(0, 7);
        const closed = month < cur, future = month > cur;
        const ws = weekStart(td), we = addDays(ws, 6);
        if (!root.dataset.yd) root.innerHTML = '<div class="sc-skel"></div>';
        root.dataset.yd = '1';
        let rep, gm, plan = null, reqs = [], changes = null;
        try {
            [rep, gm, plan, reqs, changes] = await Promise.all([api(`/assist/month?month=${month}`), groupsMap(),
                !closed && !future ? api(`/assist/plan?from=${ws}&to=${we}`).catch(() => null) : null,
                api('/requests').then(r => r.requests || []).catch(() => []),
                closed ? api(`/assist/changes?month=${month}`).then(r => r.changes).catch(() => []) : null]);
        } catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const tid = me().linkedTeacherId;
        const mine = students().filter(s => s.assistantTeacherId === tid && !s.isStaffDemo);
        // Faol — js/attendanceRules.js (muzlatilgan "Hammasi"/oy rejasiga kirmaydi; O'quvchilar sahifasi bilan bir xil).
        const active = mine.filter(s => AttendanceRules.isActiveStudent(s));
        const by = new Map((rep.students || []).map(s => [s.studentId, s]));
        const embedded = root.dataset.embedded === '1';
        const head = embedded ? '' : `<div class="sc-head"><div><h1>Aloqalar</h1><p class="sc-sub">Yordamchi ustoz · har o'quvchi bilan haftasiga 3 ta aloqa, kamida 5 daqiqa · faqat shu kuni belgilanadi</p></div>
            <div class="sc-row"><input type="month" value="${esc(month)}" max="${esc(cur)}" data-month aria-label="Oy"></div></div>`;
        const re = () => renderContacts(root);
        const bindMonth = () => { const m = root.querySelector('[data-month]'); if (m) m.onchange = e => { root.dataset.month = e.target.value; re(); }; };
        const myReqs = reqs.filter(r => r.teacher_id === tid);

        if (closed) {
            const st = rep.state || {}, fin = myReqs.filter(r => r.type === 'assist_finance' && r.payload?.month === month);
            const pend = fin.filter(r => r.status === 'new').length;
            root.innerHTML = `${head}
              <div class="sc-note yd-lock">${LOCK_SVG}<span><b>${esc(cap1(mName(month)))} yopilgan — faqat ko'rish uchun.</b> Aloqani qo'shish yoki o'zgartirish mumkin emas. Xato bo'lsa, ${st.objection_until ? esc(dG(String(st.objection_until).slice(0, 10))) + 'gacha' : 'e\'tiroz muddatigacha'} Moliyaga murojaat qiling.${fin.length ? ` <b>Murojaatlar: ${fin.length}${pend ? ` · ${pend} ko'rib chiqilmoqda` : ''}</b>` : ''}</span>
                ${st.final_at ? '' : '<button type="button" class="sc-btn sc-btn--sm" data-fin>Moliyaga murojaat</button>'}</div>
              ${finList(fin)}
              <div class="sc-kpis"><div class="sc-kpi"><small>Oy maoshi · yakuniy</small><b>${esc(money(rep.amount))}</b><span>${rep.counted} aloqa × ${esc(money(rep.rate))}</span></div>
                <div class="sc-kpi"><small>Hisoblanmadi</small><b>${rep.noAnswer}</b><span>javob bermadi</span></div><div class="sc-kpi"><small>Limitdan ortiq</small><b>${rep.overCap}</b><span>13 tadan ortig'i</span></div>
                <div class="sc-kpi"><small>Admin tuzatishi</small><b>${rep.corrections ? '+' + rep.corrections : 0}</b><span>sabab bilan, tarixda</span></div>
                <div class="sc-kpi"><small>To'lov holati</small><b class="sc-small">${esc(paySteps(month, rep).last)}</b><span>${esc(paySteps(month, rep).steps[paySteps(month, rep).cur]?.[2] || 'to\'langan')}</span></div></div>
              ${closedTable(month, rep, changes)}`;
            bindMonth();
            root.querySelector('[data-fin]')?.addEventListener('click', () => financeDrawer(month, rep, re));
            return;
        }
        if (future) { root.innerHTML = `${head}<div class="sc-note">${esc(cap1(mName(month)))} hali boshlanmagan — aloqalar shu oyda belgilanadi.</div>`; bindMonth(); return; }

        // Bu hafta: plan (#135) bo'lsa — undan (oy chegarasidan qat'i nazar), aks holda oy hisobidan.
        const weekItems = new Map();
        const addW = (sid, it) => { if (!weekItems.has(sid)) weekItems.set(sid, []); weekItems.get(sid).push(it); };
        if (plan) for (const i of plan.items.filter(i => i.kind === 'contact')) addW(i.studentId, { day: i.date, at: i.start, status: i.status, outcome: i.outcome, channel: i.channel, minutes: i.minutes });
        else for (const r of rep.students || []) for (const i of r.items.filter(i => i.day >= ws)) addW(r.studentId, i);
        const wItems = s => weekItems.get(s.id) || [];
        const weekCounted = s => wItems(s).filter(i => i.status === 'counted').length;
        const pendLate = new Set(myReqs.filter(r => r.type === 'assist_late' && r.status === 'new').map(r => r.payload?.studentId));
        const retry = s => retryOf(wItems(s), ws, pendLate.has(s.id));
        const advToday = new Set(plan ? plan.items.filter(i => i.kind === 'advice' && i.date === td).map(i => i.studentId) : active.filter(s => !s.frozen && advDays(s).includes(wd(td))).map(s => s.id));
        const todayC = s => wItems(s).filter(i => i.day === td);
        // Bugun: tavsiya qilinganlar + bugun bog'langanlar (tavsiya kuni bo'lmasa ham hisoblanadi).
        const isAdv = s => advToday.has(s.id) || (todayC(s).length && advDays(s).includes(wd(td)));
        const tKey = s => (isAdv(s) ? toMin(s.lessonTime) : null) ?? todayC(s)[0]?.at ?? 1440;
        const todayList = active.filter(s => isAdv(s) || todayC(s).length).sort((a, b) => tKey(a) - tKey(b));
        const okOf = s => todayC(s).some(i => i.outcome !== 'no_answer');
        const naOf = s => !okOf(s) && todayC(s).some(i => i.outcome === 'no_answer');
        const nDone = todayList.filter(okOf).length, nNa = todayList.filter(naOf).length, nLeft = todayList.filter(s => !todayC(s).length).length;
        const nowM = nowMin();
        const nextId = todayList.find(s => !todayC(s).length && (toMin(s.lessonTime) ?? 0) >= nowM - 30)?.id || todayList.find(s => !todayC(s).length)?.id;
        const todayRow = s => {
            const c = todayC(s), last = c[c.length - 1], ok = okOf(s), na = naOf(s);
            const okIt = c.find(i => i.status === 'counted') || [...c].reverse().find(i => i.outcome !== 'no_answer');
            const sub = [isAdv(s) ? `tavsiya ${esc(s.lessonTime || '—')}` : 'tavsiyadan tashqari', okIt ? `bog'landi ${U().hm(okIt.at ?? 0)}` : na ? `urinildi ${U().hm(last.at ?? 0)}` : '',
                `asosiy: ${esc(teacherName(s.teacherId, true))}`, `bu hafta ${weekCounted(s)}/3`].filter(Boolean).join(' · ');
            const pill = ok ? `<span class="sc-pill ${okIt.status === 'counted' ? 'sc-pill--ok' : 'sc-pill--mute'}">${CHI[okIt.channel]?.[0] || ''} ${esc(CHI[okIt.channel]?.[1] || '')}${okIt.minutes ? ' · ' + okIt.minutes + ' daq' : ''}${okIt.status !== 'counted' ? ' · ' + esc(NOT_COUNTED[okIt.status] || 'hisoblanmadi') : ''}</span>`
                : na ? '<span class="sc-pill sc-pill--bad">✕ Javob bermadi</span>' : '';
            const btn = ok ? '' : na ? `<button type="button" class="sc-btn sc-btn--sm" data-mark="${esc(s.id)}">Qayta urinish</button>`
                : `<button type="button" class="sc-btn sc-btn--sm${s.id === nextId ? ' sc-btn--pri' : ''}" data-mark="${esc(s.id)}">Belgilash</button>`;
            return `<li class="yd-tr${ok ? ' is-ok' : na ? ' is-na' : ''}" data-sid="${esc(s.id)}"><b class="yd-time">${esc(isAdv(s) ? s.lessonTime || '—' : U().hm(c[0]?.at ?? 0))}</b>${studentAvatar(s, 36)}
              <span class="yd-who"><button type="button" class="sc-link yd-nm" data-card="${esc(s.id)}">${esc(s.name)}</button><small class="sc-mt">${sub}</small></span>
              <span class="yd-tr-r">${callIcon(s.id)}${pill}${btn}</span></li>`;
        };
        // Hafta ustuni: tavsiya kunlari (bajarildi / javob bermadi / rejada) + tavsiyadan tashqari kun.
        const weekChips = s => {
            if (s.frozen) return '<span class="sc-pill sc-pill--info">muzlatilgan</span>';
            const days = advDays(s), it = wItems(s);
            const extra = [...new Set(it.filter(i => !days.includes(wd(i.day))).map(i => wd(i.day)))];
            return `<span class="yd-wk">${[...days, ...extra].sort().map(d => {
                const date = addDays(ws, d - 1), xs = it.filter(i => i.day === date);
                const cls = xs.some(i => i.status === 'counted') ? 'ok' : xs.some(i => i.outcome !== 'no_answer') ? 'un' : xs.length ? 'na' : date < td ? 'miss' : '';
                return `<i class="${cls}${date === td ? ' td' : ''}${days.includes(d) ? '' : ' ex'}" title="${esc(DAY_FULL[d - 1])} ${esc(dS(date))}${cls === 'ok' ? ' · bajarildi' : cls === 'na' ? ' · javob bermadi' : cls === 'un' ? ' · hisoblanmadi' : cls === 'miss' ? ' · o\'tib ketdi' : ' · rejada'}">${DAY[d - 1]}</i>`; }).join('')}</span>`;
        };
        const rows = mine.filter(s => AttendanceRules.isActiveStudent(s) || (by.get(s.id)?.items || []).length)
            .sort((a, b) => (a.status === 'inactive') - (b.status === 'inactive') || String(a.lessonDayOfWeek % 2).localeCompare(String(b.lessonDayOfWeek % 2)) || (toMin(a.lessonTime) ?? 0) - (toMin(b.lessonTime) ?? 0));
        const retryRows = rows.filter(s => s.status !== 'inactive' && retry(s));
        if (conState.filter === 'retry' && !retryRows.length) conState.filter = 'all';
        const shown = conState.filter === 'retry' ? retryRows : rows;
        const wkTotal = active.reduce((n, s) => n + weekCounted(s), 0), wkPlan = active.filter(s => !s.frozen).length * 3;
        const possible = active.length * CAP;
        const mLbl = cap1(mName(month));
        root.innerHTML = `${head}
          <div class="yd-top"><section class="sc-card yd-today"><header class="sc-ch"><h2>Bugun · ${esc(DAY_FULL[wd(td) - 1])} · tavsiya ${todayList.filter(isAdv).length}</h2>
              <span class="sc-row sc-wrap"><span class="sc-pill sc-pill--ok">${nDone} bajarildi</span>${nNa ? `<span class="sc-pill sc-pill--bad">${nNa} javob bermadi</span>` : ''}<span class="sc-pill sc-pill--mute">${nLeft} qoldi</span></span></header>
              ${todayList.length ? `<ul class="yd-tl">${todayList.map(todayRow).join('')}</ul>` : '<p class="sc-mt yd-pad">Bugun tavsiya qilingan aloqa yo\'q — aloqani istalgan kuni qilish mumkin.</p>'}
              <p class="sc-mt yd-foot">Tavsiya — asosiy darslar orasidagi kun va o'quvchining qulay vaqti. Boshqa vaqtda bog'lansangiz ham hisoblanadi.</p></section>
            <aside class="sc-card yd-side"><header class="yd-sh"><h2>Bu hafta</h2><span class="sc-mt">${esc(dS(ws))} – ${esc(dS(we))}</span></header>
              <div class="yd-sk"><span>Aloqalar</span><b>${wkTotal} / ${wkPlan}</b></div><i class="yd-bar" role="img" aria-label="${wkTotal} / ${wkPlan}"><i style="width:${wkPlan ? Math.min(100, wkTotal / wkPlan * 100) : 0}%"></i></i>
              <div class="yd-sk"><span>${esc(mLbl)}</span><b>${rep.counted} / ${possible}</b></div>
              <div class="yd-sk"><span>Maosh · hozirgacha</span><b class="yd-money">${esc(money(rep.amount))}</b></div>
              <ul class="yd-rules"><li>Kamida 5 daqiqa</li><li>Haftasiga 3 marta, 1 tasigacha yozishma</li><li>Bir kunda ikki aloqa — bitta</li><li>Shu kuni belgilanadi</li><li>Oyiga 13 tagacha maoshga</li></ul>
              <p class="sc-mt ydm-late">O'tgan kunni belgilamay qoldingizmi? <button type="button" class="sc-link" data-late>Admin orqali so'rov</button></p></aside></div>
          <div class="ydm-slot" data-mark-slot></div>
          <section class="sc-card yd-week"><header class="sc-ch"><h2>Bu hafta · o'quvchilar bo'yicha</h2>
              <div class="sc-seg" role="group" aria-label="Filtr"><button type="button" data-f="all" aria-pressed="${conState.filter === 'all'}">Hammasi ${rows.length}</button><button type="button" data-f="retry" aria-pressed="${conState.filter === 'retry'}"${retryRows.length ? '' : ' disabled'}>Qayta urinish kerak ${retryRows.length}</button></div></header>
            <div class="yd-tw"><table class="sc-table yd-wt"><thead><tr><th>O'quvchi</th><th>Asosiy darslari</th><th>Tavsiya</th><th>Hafta</th><th class="r">Bajarildi</th><th class="r">${esc(mLbl)}</th></tr></thead><tbody>
            ${shown.map(s => { const r = by.get(s.id) || { counted: 0, noAnswer: 0 }, gone = s.status === 'inactive', rt = retry(s);
              return `<tr class="${gone ? 'yd-gone' : ''}"><td><span class="sc-row">${studentAvatar(s, 34)}<span class="yd-who"><button type="button" class="sc-link yd-nm" data-card="${esc(s.id)}">${esc(s.name)}</button><small class="sc-mt">asosiy: ${esc(teacherName(s.teacherId, true))}${rt && rt.req ? ' · <span class="yd-bad">so\'rov adminda</span>' : ''}</small></span>${tgIcon(gm.get(s.id))}${gone || s.frozen ? '' : callIcon(s.id)}</span></td>
                <td>${esc(pattern(s.lessonDayOfWeek))}</td><td>${esc(advDays(s).map(d => DAY[d - 1]).join('·'))}${s.lessonTime ? ' · ' + esc(s.lessonTime) : ''}</td>
                <td>${gone ? '<span class="sc-pill sc-pill--bad">chiqib ketgan</span>' : weekChips(s)}</td><td class="r"><b>${weekCounted(s)}</b> / 3</td>
                <td class="r">${r.counted} / ${CAP}</td></tr>`; }).join('') || `<tr><td colspan="6" class="sc-mt">${conState.filter === 'retry' ? 'Qayta urinish kerak o\'quvchi yo\'q' : 'Sizga yordamchi sifatida o\'quvchi biriktirilmagan'}</td></tr>`}
            </tbody><tfoot><tr><td colspan="4">Jami · ${shown.length} o'quvchi</td><td class="r">${shown.reduce((n, s) => n + weekCounted(s), 0)} / ${shown.filter(s => AttendanceRules.isActiveStudent(s)).length * 3}</td><td class="r">${shown.reduce((n, s) => n + (by.get(s.id)?.counted || 0), 0)} / ${shown.filter(s => AttendanceRules.isActiveStudent(s)).length * CAP}</td></tr></tfoot></table></div>
            <div class="yd-legend"><span><i class="ok"></i>bajarildi</span><span><i class="na"></i>javob bermadi</span>${shown.some(s => wItems(s).some(i => i.outcome !== 'no_answer' && i.status !== 'counted')) ? '<span><i class="un"></i>hisoblanmadi (qoida)</span>' : ''}<span><i></i>rejada</span></div></section>`;
        bindMonth();
        const find = id => mine.find(s => s.id === id);
        // "Aloqani belgilash" — dizayndagidek sahifa ichida (Bugun ostida); ochilganda keyingi tavsiya qilingan o'quvchi.
        const slot = root.querySelector('[data-mark-slot]');
        const afterSave = () => { conState.mark = ''; re(); };
        const openMark = (s, focus) => {
            if (!s || !slot) return;
            conState.mark = s.id;
            markDrawer(s, afterSave, { inline: slot, onClose: () => { conState.mark = null; slot.innerHTML = ''; root.querySelectorAll('.yd-tr.is-sel').forEach(li => li.classList.remove('is-sel')); } });
            root.querySelectorAll('.yd-tr').forEach(li => li.classList.toggle('is-sel', li.dataset.sid === s.id));
            if (focus) { slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); slot.querySelector('input[name=ch]')?.focus({ preventScroll: true }); }
        };
        const markId = conState.mark === null ? null : conState.mark && find(conState.mark) && !okOf(find(conState.mark)) ? conState.mark : nextId;
        if (markId) openMark(find(markId), false);
        root.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => openMark(find(b.dataset.mark), true));
        root.querySelectorAll('[data-call]').forEach(b => b.onclick = () => callStudent(find(b.dataset.call), afterSave, st => openMark(st, true)));
        root.querySelectorAll('[data-card]').forEach(b => b.onclick = () => U().openStudent(b.dataset.card));
        root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { conState.filter = b.dataset.f; re(); });
        root.querySelector('[data-late]')?.addEventListener('click', () => lateDrawer(active, re));
    }

    // ── O'quvchilar: ustoz (UstozOquvchiList) va yordamchi (YordamchiOquvchilar) — css/oquvchilar.css (.oq-*) ──
    // Faqat o'z o'quvchilari (state serverda kesilgan); to'lov, tarif, qarz va sotuv ma'lumoti ko'rsatilmaydi.
    let myState = { q: '', sel: '', f: 'all', closed: false };
    let _inact = null, _inactAt = 0;
    async function inactiveList() {
        if (_inact && Date.now() - _inactAt < 60000) return _inact;
        const r = await U().api('/inactive').catch(() => ({ students: [] }));
        _inact = r.students || []; _inactAt = Date.now();
        return _inact;
    }
    // "Tugatgan" holati (kursni tugatganlar): server /inactive javobida state==='finished'.
    const isFinished = x => x && (x.status === 'finished' || x.state === 'finished' || x.finished === true);
    // Kurs oxiri: boshlanishdan 90 kalendar kun (AcademicRules.COURSE_DAYS) — schoolUI.courseEnd bilan bir qoida.
    function courseEnd(s) {
        if (!s.startDate) return null;
        return U().addDays(String(s.startDate).slice(0, 10), (window.AcademicRules?.COURSE_DAYS || 90) - 1);
    }
    // 1-urinish rangi (ro'yxat va panelda bir xil).
    const pctCls = v => (v == null ? '' : v < 65 ? 'lo' : v < 75 ? 'mid' : 'hi');
    const OQ_SEARCH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
    const OQ_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    const OQ_TG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5z"/></svg>';
    const OQ_PH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';
    const OQ_LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';
    const oqAv = (s, n) => `<span class="oq-av" style="width:${n}px;height:${n}px">${U().studentAvatar(s, n)}</span>`;
    const oqTg = g => { const esc = U().esc; return tgLink(g) ? `<a class="oq-tgb" href="${esc(tgLink(g))}" target="_blank" rel="noopener" title="${esc(g.name || 'Telegram guruh')} — Telegram guruhni ochish" aria-label="Telegram guruh: ${esc(g.name || '')}">${OQ_TG}</a>`
        : `<span class="oq-tgb is-off" title="Telegram guruh havolasi yo'q — admin qo'shadi" aria-label="Telegram guruh havolasi yo'q">${OQ_TG}</span>`; };
    const oqCall = s => `<button type="button" class="oq-clb" data-call="${U().esc(s.id)}" title="Qo'ng'iroq qilish — raqam yashirin, Telegram guruh orqali" aria-label="${U().esc(s.name)}ga qo'ng'iroq qilish">${OQ_PH}</button>`;
    async function renderMyStudents(root) {
        if (!root) return;
        const { api, esc, today, teacherName, pattern, DAY, addDays, weekStart, wd } = U();
        await U().loadStaffAvatars();
        const tid = me().linkedTeacherId;
        const td = today(), month = td.slice(0, 7), ws = weekStart(td);
        const all = students().filter(s => AttendanceRules.isActiveStudent(s));
        const mine = all.filter(s => s.teacherId === tid), helped = all.filter(s => s.assistantTeacherId === tid && s.teacherId !== tid);
        const emp = (typeof getItem === 'function' ? getItem(STORAGE_KEYS.hrEmployees, []) : []).find(e => e.id === tid);
        const pure = !mine.length && (helped.length > 0 || emp?.role === 'yordamchi');
        if (!root.dataset.loaded) root.innerHTML = '<div class="oq"><div class="oq-skel"></div></div>';
        const lang = (typeof getUserOwnLang === 'function' && getUserOwnLang()) || 'english';
        const [acad, gm, mks, rep, inact, abs] = await Promise.all([
            apiFetch(`/api/academic/students?lang=${lang}`).catch(() => ({ students: [] })),
            groupsMap(),
            pure ? { makeups: [] } : api('/makeups').catch(() => ({ makeups: [] })),
            helped.length ? api(`/assist/month?month=${month}`).catch(() => null) : null,
            inactiveList(),
            // "Kelmadi" belgilari serverda (school_absences) — main_attendance faqat "Keldi"ni saqlaydi.
            pure ? { absences: [] } : api(`/attendance/absences?month=${month}`).catch(() => ({ absences: [] }))
        ]);
        root.dataset.loaded = '1';
        const ac = new Map((acad.students || []).map(x => [x.id, x]));
        const cnt = new Map((rep?.students || []).map(x => [x.studentId, x]));
        const weekOf = s => (cnt.get(s.id)?.items || []).filter(i => i.day >= ws && i.status === 'counted').length;
        const finished = inact.filter(isFinished), notActive = inact.filter(x => !isFinished(x));
        const q = myState.q.trim().toLowerCase();
        const match = s => !q || String(s.name || '').toLowerCase().includes(q) || String(s.serialCode || s.id || '').toLowerCase().includes(q);
        const advTxt = s => advDays(s).map(d => DAY[d - 1]).join('·');
        const nextAdv = s => { const days = advDays(s); for (let i = 0; i <= 7; i++) { const d = addDays(td, i); if (days.includes(wd(d)) && (i || (U().toMin(s.lessonTime) ?? 1440) >= U().nowMin())) return `${DAY[wd(d) - 1]} ${Number(d.slice(8))}${s.lessonTime ? ', ' + s.lessonTime : ''}`; } return ''; };
        const re = () => renderMyStudents(root);
        const openArchive = state => base.openInactive(root, { active: pure ? helped.length : mine.length + helped.length,
            title: pure ? 'O\'quvchilar' : 'Mening o\'quvchilarim', page: pure ? 'assistant' : 'teacher', state, tab: state, onBack: re });
        const mL = MON_S[Number(month.slice(5)) - 1];
        const head = (h1, sub, ph) => `<div class="oq-head"><div><h1 class="oq-h1">${h1}</h1><p class="oq-sub">${sub}</p></div>
            <label class="oq-srch">${OQ_SEARCH}<input type="search" placeholder="${ph}" value="${esc(myState.q)}" data-q aria-label="${ph}" autocomplete="off"></label></div>`;
        const bindCommon = list => {
            const qi = root.querySelector('[data-q]');
            qi.oninput = () => { myState.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => renderMyStudents(root).then(() => { const n = root.querySelector('[data-q]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }), 200); };
            root.querySelectorAll('[data-ms]').forEach(tr => { tr.onclick = e => { if (e.target.closest('a,button')) return; myState.sel = tr.dataset.ms; myState.closed = false; re(); }; tr.onkeydown = e => { if (e.key === 'Enter') tr.click(); }; });
            root.querySelectorAll('[data-call]').forEach(b => b.onclick = e => { e.stopPropagation(); callStudent(list.find(s => s.id === b.dataset.call), re); });
            root.querySelector('[data-inactive]')?.addEventListener('click', () => openArchive('inactive'));
            root.querySelector('[data-finished]')?.addEventListener('click', () => openArchive('finished'));
            root.querySelector('[data-open-card]')?.addEventListener('click', e => U().openStudent(e.currentTarget.dataset.openCard));
            root.querySelector('[data-close-detail]')?.addEventListener('click', () => { myState.closed = true; re(); });
        };
        // Yordamchi paneli: keyingi aloqa tavsiyasi va ilovadagi oxirgi xatolar (keyin to'ldiriladi).
        const fillProgress = sel => {
            const box = root.querySelector('[data-prog]'); if (!box || !sel) return;
            api(`/students/${encodeURIComponent(sel.id)}/progress`).then(r => {
                if (!box.isConnected) return;
                const d = r.detail, A = U().acad;
                if (!d) { box.innerHTML = '<p class="oq-capm">Ilova ma\'lumoti hali yo\'q</p>'; return; }
                const tp = A.topic(d), keys = new Set((d.student.flags || []).map(f => f.key));
                const tip = tp ? `Ko'p xato: <b>${esc(tp.name)}</b>${tp.part ? ` (${esc(tp.part)})` : ''}. Shu mavzudagi gaplarni og'zaki mashq qiling.`
                    : keys.has('idle') ? 'Ilovaga kirmayapti — sababini so\'rang va bugungi dars so\'zlarini birga takrorlang.'
                    : `Rejada. Ilovadagi ${d.student.reached || 1}-dars so'zlarini og'zaki takrorlang.`;
                const ms = A.mistakes(d, 2);
                box.innerHTML = `<div class="oq-tip3"><b>Keyingi aloqada nima qilish kerak${nextAdv(sel) ? ' · ' + esc(nextAdv(sel)) : ''}</b><span>${tip}</span></div>
                  <p class="oq-cap">Oxirgi xatolar</p>${ms.length ? ms.map(m => `<div class="oq-err"><div class="oq-mt" style="margin:0">${m.no}-dars${m.part ? ' · ' + esc(m.part) : ''} · ${m.attempts} urinish</div><div class="q">${esc(m.q)}</div><div>O'quvchi: <span class="a">"${esc(m.your)}"</span> · To'g'risi: <span class="r">"${esc(m.right)}"</span></div></div>`).join('') : '<p class="oq-capm">Xato yo\'q</p>'}`;
            }).catch(() => { box.innerHTML = ''; });
        };
        // Yordamchi sifatidagi o'quvchi paneli (YordamchiOquvchilar dizayni).
        const helpDetail = (sel, closable) => {
            const x = ac.get(sel.id), c = cnt.get(sel.id);
            return `<div class="oq-dh2">${oqAv(sel, 48)}<div><div class="oq-nm" id="oqDn">${esc(sel.name)}</div><div class="oq-mt">asosiy ${esc(teacherName(sel.teacherId, true))} · ${esc(pattern(sel.lessonDayOfWeek))} ${esc(sel.lessonTime || '')} · tavsiya ${esc(advTxt(sel))} ${esc(sel.lessonTime || '')}</div></div>
                ${closable ? `<button type="button" class="oq-icb" data-close-detail aria-label="Yopish">${OQ_X}</button>` : ''}</div>
              <div class="oq-kv"><div><small>Ilovada</small><b>${x ? x.reached + ' / 72' : '—'}</b></div><div><small>1-urinish</small><b class="oq-pc ${pctCls(x?.firstTryAvg)}">${x?.firstTryAvg != null ? x.firstTryAvg + '%' : '—'}</b></div>
                <div><small>Aloqalar · ${esc(mL)}</small><b>${c?.counted || 0} / ${CAP}</b></div><div><small>Bu hafta</small><b>${weekOf(sel)} / 3</b></div></div>
              <div data-prog><div class="oq-skel" style="height:96px;margin:0 20px 14px"></div></div>
              <div class="oq-acts2"><button type="button" class="oq-clb is-big" data-call="${esc(sel.id)}">${OQ_PH} Qo'ng'iroq</button><button type="button" class="oq-btn" data-open-card="${esc(sel.id)}">To'liq kartani ochish →</button>${closable ? '<button type="button" class="oq-btn" data-go-contacts>Aloqani belgilash</button>' : ''}</div>
              <div class="oq-hid" style="padding-top:12px">Telefon raqami yashirin — ☎ tugmasi o'quvchining Telegram guruhini ochadi va aloqani belgilaysiz. To'lov va sotuv ma'lumotlari ko'rinmaydi. Savol bo'lsa — asosiy ustozga yozing (xodimlar chati).</div>`;
        };

        if (pure) {
            // ── YordamchiOquvchilar ──
            const flags = s => new Set((ac.get(s.id)?.flags || []).map(f => f.key));
            const F = { all: helped, hard: helped.filter(s => flags(s).has('struggling')), zero: helped.filter(s => !weekOf(s)) };
            if (!F[myState.f]) myState.f = 'all';
            const list = F[myState.f].filter(match);
            if (!myState.sel || !helped.some(s => s.id === myState.sel)) myState.sel = list[0]?.id || '';
            const sel = helped.find(s => s.id === myState.sel);
            root.innerHTML = `<div class="oq">${head('O\'quvchilarim', 'Siz bog\'lanadigan o\'quvchilar · natijalar o\'quvchi ilovasidan · faqat ko\'rish', 'Ism bo\'yicha qidirish')}
              <div class="oq-lay${sel ? '' : ' is-solo'}"><section class="oq-card is-clip" aria-labelledby="oqLt"><div class="oq-ch"><h2 class="oq-ct" id="oqLt">${helped.length} o'quvchi</h2>
                  <div class="oq-seg" role="group" aria-label="Filtr"><button type="button" data-f="all" aria-pressed="${myState.f === 'all'}">Hammasi</button><button type="button" data-f="hard" aria-pressed="${myState.f === 'hard'}">Qiynalyapti ${F.hard.length}</button><button type="button" data-f="zero" aria-pressed="${myState.f === 'zero'}">Bu hafta 0 aloqa ${F.zero.length}</button><button type="button" data-inactive aria-pressed="false">Faol emas ${notActive.length}</button></div></div>
                <div class="oq-tw"><table class="oq-t is-y"><thead><tr><th scope="col">O'quvchi</th><th scope="col">Aloqa tavsiyasi</th><th scope="col">Ilovada · 1-urinish</th><th scope="col">Bu hafta</th><th scope="col">${esc(cap1(mName(month)))}</th></tr></thead><tbody>
                ${list.map(s => { const x = ac.get(s.id), c = cnt.get(s.id);
                  return `<tr${myState.sel === s.id ? ' class="is-sel" aria-selected="true"' : ''} data-ms="${esc(s.id)}" tabindex="0"><td><div class="oq-who">${oqAv(s, 34)}<div><div class="oq-nm">${esc(s.name)}</div><div class="oq-mt">asosiy: ${esc(teacherName(s.teacherId, true))}</div></div>${oqTg(gm.get(s.id))}${oqCall(s)}</div></td>
                    <td>${esc(advTxt(s))}${s.lessonTime ? ' · ' + esc(s.lessonTime) : ''}<div class="oq-mt" style="margin:2px 0 0">asosiy darslari ${esc(pattern(s.lessonDayOfWeek))}</div></td>
                    <td>${x ? `<b>${x.reached}</b> / 72${x.firstTryAvg != null ? ` · <span class="oq-pc ${pctCls(x.firstTryAvg)}">${x.firstTryAvg}%</span>` : ''}` : '<span class="oq-mt">—</span>'}</td>
                    <td><b>${weekOf(s)}</b> / 3</td><td>${c?.counted || 0} / ${CAP}</td></tr>`; }).join('') || `<tr><td colspan="5" class="oq-empty">${q || myState.f !== 'all' ? 'Hech kim topilmadi' : 'Sizga hali o\'quvchi biriktirilmagan'}</td></tr>`}
                </tbody></table></div><p class="oq-foot">1-urinish — ilovadagi mashqlarni birinchi urinishda to'g'ri bajarish ulushi (baho emas).</p></section>
                ${sel ? `<aside class="oq-card oq-dp" aria-labelledby="oqDn">${helpDetail(sel, false)}</aside>` : ''}</div></div>`;
            bindCommon(helped);
            root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { myState.f = b.dataset.f; re(); });
            fillProgress(sel);
            return;
        }

        // ── UstozOquvchiList ──
        const att = getItem(STORAGE_KEYS.mainAttendance, {})[`${month}_${tid}`] || {};
        const absent = new Set((abs.absences || []).map(a => `${a.studentId}|${a.day}`));
        const cal = window.teacherAttendanceCalendar;
        const own = (typeof resolveTeacherWithVirtual === 'function' && resolveTeacherWithVirtual(tid)) || {};
        const myMk = (mks.makeups || []).filter(m => m.teacher_id === tid);
        const day10 = v => String(v || '').slice(0, 10);
        const attOf = s => {
            const entries = att[s.id] || {};
            const cells = cal ? cal.cells(month, cal.weekdays(s, own, 'main')).filter(Boolean) : [];
            const sched = cells.filter(c => c.scheduled);
            const isP = c => cal.status(entries[c.day]) === 'present', isA = c => !isP(c) && absent.has(`${s.id}|${c.date}`);
            const days = new Set(sched.filter(isP).map(c => c.day));
            let n = days.size;
            const mkM = myMk.filter(m => m.student_id === s.id && day10(m.held_date).slice(0, 7) === month);
            for (const m of mkM.filter(m => m.status === 'approved')) {
                const d = Number(day10(m.held_date).slice(8, 10));
                if (m.kind === 'double') n++; else if (!days.has(d)) { days.add(d); n++; }
            }
            const cov = new Map(myMk.filter(m => m.student_id === s.id && ['planned', 'review', 'approved'].includes(m.status)).map(m => [day10(m.missed_date), m]));
            const absentC = cells.filter(isA);
            const strip = sched.map(c => ({ day: c.day, st: isP(c) ? '' : isA(c) ? (cov.has(c.date) ? 'q' : 'x') : 'f', label: isP(c) ? 'keldi' : isA(c) ? (cov.has(c.date) ? 'kelmadi, qoplangan' : 'kelmadi') : c.date > td ? 'reja' : 'belgilanmagan' }));
            return { counted: Math.min(n, sched.length), plan: sched.length, absent: absentC.length,
                openMissed: absentC.filter(c => !cov.has(c.date) && c.date <= td).map(c => c.day),
                coveredN: absentC.filter(c => ['approved', 'planned'].includes(cov.get(c.date)?.status)).length,
                reviewN: absentC.filter(c => cov.get(c.date)?.status === 'review').length,
                review: mkM.filter(m => m.status === 'review').length, present: sched.filter(isP).length,
                planLeft: sched.filter(c => c.date > td).length, unmarked: sched.filter(c => c.date <= td && !isP(c) && !isA(c)).length, strip };
        };
        const statusOf = (a, x) => {
            const f = new Set((x?.flags || []).map(f => f.key));
            // Qoplanmagan 3+ dars — qoplangan/rejalashtirilgan kelmaganlar hisobga olinmaydi.
            if (a.strip.filter(c => c.st === 'x').length >= 3) return ['Ko\'p kelmayapti', 'is-warn'];
            if (f.has('struggling')) return ['Qiynalyapti', 'is-warn'];
            if (f.has('idle')) return [x.flags.find(f => f.key === 'idle').label, 'is-warn'];
            if (f.has('behind')) return ['Rejadan orqada', 'is-warn'];
            return ['Rejada', 'is-ok'];
        };
        const row = (s, kind) => {
            const x = ac.get(s.id), a = kind === 'main' ? attOf(s) : null, c = cnt.get(s.id);
            const st = kind === 'main' ? statusOf(a, x) : ['Yordamchi', 'is-mute'];
            const on = !myState.closed && myState.sel === s.id;
            return `<tr${on ? ' class="is-sel" aria-selected="true"' : ''} data-ms="${esc(s.id)}" tabindex="0"><td><div class="oq-who">${oqAv(s, 36)}<div><div class="oq-nm">${esc(s.name)}</div><div class="oq-mt">${kind === 'main' ? (s.serialCode ? '#' + esc(s.serialCode) : '&nbsp;') : 'asosiy: ' + esc(teacherName(s.teacherId, true))}</div></div>${oqTg(gm.get(s.id))}${kind === 'main' ? '' : oqCall(s)}</div></td>
              <td>${kind === 'main' ? `${esc(pattern(s.lessonDayOfWeek))} ${esc(s.lessonTime || '')}<div class="oq-cb">${Number(s.lessonDuration) || 15} daq</div>` : `tavsiya ${esc(advTxt(s))}${s.lessonTime ? ' ' + esc(s.lessonTime) : ''}<div class="oq-cb">darslari ${esc(pattern(s.lessonDayOfWeek))} ${esc(s.lessonTime || '')}</div>`}</td>
              <td>${x ? `<b>${x.reached || 0}</b> / 72` : '<span class="oq-mt">—</span>'}</td>
              <td>${kind === 'main' ? `<b>${a.counted}</b> / ${a.plan}${a.review ? ` <span class="oq-plus">+${a.review}</span>` : ''}` : `<b>${c?.counted || 0}</b> / ${CAP}`}</td>
              <td><span class="oq-pill ${st[1]}">${esc(st[0])}</span></td></tr>`;
        };
        // UstozOquvchiList: avval e'tibor kerak bo'lganlar (Holat ≠ "Rejada"), keyin qolganlari — har guruhda dars vaqti bo'yicha.
        const tOf = s => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s.lessonTime || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : 9999; };
        const needs = new Map(mine.map(s => [s.id, statusOf(attOf(s), ac.get(s.id))[1] !== 'is-ok']));
        const mainRows = mine.filter(match).sort((a, b) => (needs.get(b.id) - needs.get(a.id)) || tOf(a) - tOf(b) || String(a.name).localeCompare(String(b.name))),
            helpRows = helped.filter(match);
        if (!myState.sel || ![...mine, ...helped].some(s => s.id === myState.sel)) myState.sel = (mainRows[0] || helpRows[0])?.id || '';
        const sel = myState.closed ? null : [...mine, ...helped].find(s => s.id === myState.sel);
        const mainDetail = () => {
            const x = ac.get(sel.id), a = attOf(sel);
            const subj = (sel.subject || lang) === 'russian' ? 'Rus tili' : 'Ingliz tili';
            const start = sel.startDate ? String(sel.startDate).slice(0, 10) : null, end = courseEnd(sel);
            const dayN = start && start <= td ? Math.round((Date.parse(td) - Date.parse(start)) / 86400000) + 1 : null;
            const phone = sel.phone ? (typeof formatPhoneDisplay === 'function' ? formatPhoneDisplay(sel.phone) : sel.phone) : '';
            const MonL = cap1(mName(month));
            const parts = [a.coveredN && `${a.coveredN} qoplandi`, a.reviewN && `${a.reviewN} tekshiruvda`].filter(Boolean).join(', ');
            const sumTxt = `${a.present} keldi · ${a.absent} kelmadi${parts ? ` (${parts})` : ''}${a.unmarked ? ` · ${a.unmarked} belgilanmagan` : ''} · ${a.planLeft} reja`;
            return `<div class="oq-dh2">${oqAv(sel, 36)}<div><div class="oq-nm" id="oqDn">${esc(sel.name)}</div><div class="oq-mt">${esc(subj)} · asosiy o'quvchingiz${sel.serialCode ? ' · #' + esc(sel.serialCode) : ''}</div></div><button type="button" class="oq-icb" data-close-detail aria-label="Yopish">${OQ_X}</button></div>
              <div class="oq-kv"><div><small>Ilovada</small><b>${x ? x.reached + ' / 72 dars' : '—'}</b></div><div><small>1-urinish</small><b>${x?.firstTryAvg != null ? x.firstTryAvg + '%' : '—'}</b></div>
                <div><small>Davomat · ${esc(mName(month))}</small><b>${a.counted} / ${a.plan}${a.review ? ' · +' + a.review : ''}</b></div>
                <div><small>Kurs</small><b>${dayN ? `${dayN}-kun · ${esc(ddmm(start))}${end ? ' → ' + esc(ddmm(end)) : ''}` : start ? `${esc(ddmm(start))} dan` : '—'}</b></div></div>
              ${a.strip.length ? `<p class="oq-cap">${esc(MonL)} davomati</p><div class="oq-cal2" style="grid-template-columns:repeat(${Math.max(a.strip.length, 1)},1fr)" role="img" aria-label="${esc(MonL)}: ${esc(sumTxt)}">${a.strip.map(c => `<span${c.st ? ` class="${c.st}"` : ''} title="${c.day}-${esc(mL)} · ${c.label}"></span>`).join('')}</div>
                <p class="oq-capm">${esc(sumTxt)}</p>` : ''}
              <dl class="oq-dl2"><dt>Jadval</dt><dd>${esc(pattern(sel.lessonDayOfWeek))} ${esc(sel.lessonTime || '')} · ${Number(sel.lessonDuration) || 15} daq</dd>
                <dt>Kurs</dt><dd>${start ? `${esc(ddmmyy(start))}${end ? ' → ' + esc(ddmmyy(end)) : ''}` : '—'}</dd>
                <dt>Yordamchi ustoz</dt><dd>${sel.assistantTeacherId ? esc(teacherName(sel.assistantTeacherId)) : '—'}</dd>
                <dt>Telefon</dt><dd>${phone ? `<a href="tel:${esc(String(sel.phone).replace(/[^\d+]/g, ''))}">${esc(phone)}</a>` : '—'}</dd>
                <dt>Qoplash mumkin</dt><dd${a.openMissed.length ? ' class="is-teal"' : ''}>${a.openMissed.length ? `${a.openMissed.length} dars · ${a.openMissed.join(' va ')}-${esc(mL)}` : 'qoplanmagan dars yo\'q'}</dd></dl>
              <div class="oq-dact"><button type="button" class="oq-btn is-pri" data-open-card="${esc(sel.id)}">O'quvchi kartasini ochish</button>
                ${sel.status !== 'inactive' && !sel.frozen ? '<button type="button" class="oq-btn" data-makeup>Qoplash darsi qo\'yish</button>' : ''}<button type="button" class="oq-btn" data-req>Adminga so'rov: jadval o'zgarishi</button></div>
              <div class="oq-hid">${OQ_LOCK}<span>Ustoz almashtirish, muzlatish va to'lovlar — admin bo'limida. Siz so'rov yuborasiz, admin hal qiladi.</span></div>`;
        };
        const isMainSel = sel && sel.teacherId === tid;
        root.innerHTML = `<div class="oq">${head('O\'quvchilar', 'Sizga biriktirilgan o\'quvchilar · to\'lov va sotuv ma\'lumotlari ustozga ko\'rsatilmaydi', 'Ism yoki ID bo\'yicha qidirish')}
          <div class="oq-lay${sel ? '' : ' is-solo'}"><section class="oq-card is-clip" aria-labelledby="oqLt"><div class="oq-ch"><h2 class="oq-ct" id="oqLt">Mening o'quvchilarim</h2>
              <div class="oq-seg" role="group" aria-label="Holat"><button type="button" aria-pressed="true">Faol <b>${mine.length}${helped.length ? ' + ' + helped.length : ''}</b></button><button type="button" data-inactive aria-pressed="false">Faol emas <b>${notActive.length}</b></button><button type="button" data-finished aria-pressed="false">Tugatgan <b>${finished.length}</b></button></div></div>
            <div class="oq-tw"><table class="oq-t"><thead><tr><th scope="col">O'quvchi</th><th scope="col">Jadval</th><th scope="col">Ilovada</th><th scope="col">Davomat · ${esc(mL)}</th><th scope="col">Holat</th></tr></thead><tbody>
            ${mine.length ? `<tr><td colspan="5" class="oq-sec">ASOSIY USTOZLIGINGIZDA · ${mainRows.length}</td></tr>${mainRows.map(s => row(s, 'main')).join('')}` : ''}
            ${helped.length ? `<tr><td colspan="5" class="oq-sec">YORDAMCHI SIFATIDA · ${helpRows.length} · haftasiga 3 aloqa, kamida 5 daqiqa</td></tr>${helpRows.map(s => row(s, 'help')).join('')}` : ''}
            ${!mainRows.length && !helpRows.length ? `<tr><td colspan="5" class="oq-empty">${q ? 'Hech kim topilmadi' : 'Sizga hali o\'quvchi biriktirilmagan'}</td></tr>` : ''}
          </tbody></table></div></section>
          ${sel ? `<aside class="oq-card oq-dp" aria-labelledby="oqDn">${isMainSel ? mainDetail() : helpDetail(sel, true)}</aside>` : ''}</div></div>`;
        bindCommon([...mine, ...helped]);
        root.querySelector('[data-makeup]')?.addEventListener('click', () => {
            if (window.schoolSchedule?.makeupDrawer) return window.schoolSchedule.makeupDrawer(re, { studentId: sel.id });
            switchTab('timetable');
        });
        root.querySelector('[data-req]')?.addEventListener('click', () => {
            if (U().studentRequestDrawer) return U().studentRequestDrawer({ id: sel.id, name: sel.name }, 'schedule');
            U().openStudent(sel.id);
        });
        root.querySelector('[data-go-contacts]')?.addEventListener('click', () => markDrawer(sel, re));
        if (sel && !isMainSel) fillProgress(sel);
    }

    // Aloqalar dizaynda alohida sahifa emas: Akademik bo'lim → Davomat (yopilgan oy uchun — o'sha oy tanlangan holda).
    function goDavomat(month) {
        const mi = document.getElementById('mainAttMonth');
        if (mi && /^\d{4}-\d{2}$/.test(String(month || ''))) mi.value = month;
        else if (mi) mi.value = U().today().slice(0, 7);
        if (typeof switchTab === 'function') switchTab('teachers-section', { teachersSection: 'attendance' });
    }

    // ── Yordamchi bosh sahifasi (YordamchiBosh + YordamchiOyYopildi) ─────────
    let homeMode = null; // 'closed' | 'now' — foydalanuvchi tanlovi (sessiya ichida)
    async function assistantHome(container, user) {
        const u = U(); if (!u || !container) return;
        const { api, esc, today, weekStart, wd, DAY, DAY_FULL, studentAvatar, teacherName, pattern, addDays } = u;
        await u.loadStaffAvatars();
        const tid = user.linkedTeacherId, td = today(), month = td.slice(0, 7), wdNow = wd(td), ws = weekStart(td);
        const prevMonth = addDays(month + '-01', -1).slice(0, 7), prev2Month = addDays(prevMonth + '-01', -1).slice(0, 7);
        const allMine = students().filter(s => !s.isStaffDemo && s.assistantTeacherId === tid);
        // Faol o'quvchilar — js/attendanceRules.js (muzlatilgan va chiqib ketgan kirmaydi; O'quvchilar sahifasi bilan bir xil).
        const list = allMine.filter(s => AttendanceRules.isActiveStudent(s));
        const lang = (typeof getUserOwnLang === 'function' && getUserOwnLang()) || 'english';
        const early = Number(td.slice(8)) <= 6;
        const [rep, prev, gm, acad, reqs, chNow] = await Promise.all([
            api(`/assist/month?month=${month}`).catch(() => null),
            early ? api(`/assist/month?month=${prevMonth}`).catch(() => null) : null,
            groupsMap(),
            apiFetch(`/api/academic/students?lang=${lang}`).catch(() => ({ students: [] })),
            api('/requests').then(r => r.requests || []).catch(() => []),
            early ? api(`/assist/changes?month=${month}`).then(r => r.changes).catch(() => []) : null
        ]);
        if (!container.isConnected) return;
        const by = new Map((rep?.students || []).map(x => [x.studentId, x]));
        const ac = new Map((acad.students || []).map(x => [x.id, x]));
        const rate = rep?.rate || RATE, cap = rep?.cap || CAP;
        const items = s => by.get(s.id)?.items || [];
        const todayOf = s => items(s).filter(i => i.day === td);
        const weekOf = s => items(s).filter(i => i.day >= ws && i.status === 'counted').length;
        const nowMin = u.nowMin();
        const tmin = s => u.toMin(s.lessonTime) ?? 24 * 60;
        const advised = list.filter(s => !s.frozen && advDays(s).includes(wdNow)).sort((a, b) => tmin(a) - tmin(b));
        const done = s => todayOf(s).some(i => i.outcome === 'contacted');
        const noAns = s => todayOf(s).length && !done(s);
        const counted = rep?.counted || 0, amount = rep?.amount || 0;
        const possible = list.length * cap;
        // "Oy oxirigacha ko'pi bilan" — server hisobi (assist.possibleLeft; Sozlamalar → Mening maoshim bilan bitta manba).
        const maxLeft = rep?.possible != null ? rep.possible : null;
        const leftOf = s => rep?.left?.[s.id]?.adviceLeft || 0;
        const mains = new Set(list.map(s => s.teacherId).filter(Boolean)).size;
        const next = advised.find(s => !done(s) && tmin(s) >= nowMin) || advised.find(s => !done(s));
        const myReqs = reqs.filter(r => r.teacher_id === tid);
        const pendLate = new Set(myReqs.filter(r => r.type === 'assist_late' && r.status === 'new').map(r => r.payload?.studentId));
        const retry = list.map(s => [s, retryOf(items(s), ws, pendLate.has(s.id))]).filter(([, r]) => r);
        // Limitga yaqinlar: qolgan tavsiyalar bilan 13 dan oshib ketadiganlar (yoki limit to'lganlar) — Mening maoshim bilan bir qoida.
        const nearCap = list.map(s => [s, by.get(s.id)?.counted || 0]).filter(([s, n]) => n >= cap || n + leftOf(s) > cap).sort((a, b) => b[1] - a[1]);
        const hour = Number(new Date(Date.now() + 5 * 3600000).getUTCHours());
        const greet = hour < 11 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
        const pst = prev?.state || {};
        const closedAvail = !!(prev && (prev.counted || pst.locked_at) && !pst.paid_at);
        const mode = closedAvail ? (homeMode || (pst.final_at ? 'now' : 'closed')) : 'now';
        const headSub = `${esc(DAY_FULL[wd(td) - 1])}, ${esc(dG(td))} · yordamchi ustoz · ${list.length} o'quvchi · ${mains} asosiy ustoz bilan`;
        const sw = closedAvail ? `<div class="sc-seg" role="group" aria-label="Oy"><button type="button" data-mode="closed" aria-pressed="${mode === 'closed'}">${esc(cap1(mName(prevMonth)))} · yopilgan</button><button type="button" data-mode="now" aria-pressed="${mode === 'now'}">${esc(cap1(mName(month)))} · joriy</button></div>`
            : '<span class="sc-pill sc-pill--info">Har o\'quvchi bilan haftasiga 3 aloqa · kamida 5 daqiqa</span>';
        const refresh = () => assistantHome(container, user);
        const find = id => allMine.find(x => x.id === id);
        const bind = () => {
            container.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => { const s = find(b.dataset.mark); if (s) markDrawer(s, refresh); });
            container.querySelectorAll('[data-call]').forEach(b => b.onclick = () => callStudent(find(b.dataset.call), refresh));
            container.querySelectorAll('[data-card]').forEach(b => b.onclick = () => u.openStudent(b.dataset.card));
            container.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { homeMode = b.dataset.mode; refresh(); });
            container.querySelectorAll('[data-go-plan]').forEach(b => b.onclick = () => switchTab('timetable'));
            container.querySelectorAll('[data-go-contacts]').forEach(b => b.onclick = () => goDavomat(b.dataset.goContacts));
        };

        if (mode === 'closed') {
            // O'tgan oydan oldingi oy ("Sentyabr: … · to'langan") — maosh tarixidan (Sozlamalar → Mening maoshim bilan bitta manba); karta oxirgi 4 raqami ham shu javobdan.
            const [ch, sal] = await Promise.all([api(`/assist/changes?month=${prevMonth}`).then(r => r.changes).catch(() => []),
                apiFetch('/api/staff/salary', { timeout: 30000 }).catch(() => null)]);
            const h2 = (sal?.history || []).find(x => x.month === prev2Month);
            const prev2 = h2 ? { month: prev2Month, amount: h2.amount, counted: h2.lessons, state: { paid_at: h2.status === 'paid' ? h2.paidAt || true : null } } : null;
            const card4 = sal?.card4 || '';
            if (!container.isConnected) return;
            const leftIds = new Set(ch.filter(c => c.kind === 'left').map(c => c.studentId));
            const pr = prev.students || [];
            const cLeft = pr.filter(x => leftIds.has(x.studentId)).reduce((n, x) => n + x.counted, 0), cAct = prev.counted - cLeft;
            const nAct = list.length, nLeft = [...leftIds].filter(id => pr.some(x => x.studentId === id)).length;
            const possibleP = nAct * cap;
            const cors = pr.flatMap(x => (x.items || []).filter(i => i.corrected).map(i => ({ ...i, sid: x.studentId })));
            const fin = myReqs.filter(r => r.type === 'assist_finance' && r.payload?.month === prevMonth);
            const until = pst.objection_until ? dG(String(pst.objection_until).slice(0, 10)) : `4-${MON[Number(month.slice(5)) - 1]}`;
            const advN = advised.length, doneN = advised.filter(done).length;
            const chLine = c => {
                const nm = `<b>${esc(c.name)}</b>`;
                if (c.kind === 'frozen') return ['❄', `${nm} ${esc(c.to ? `${Number(c.from.slice(8))}–${dG(c.to)}` : dG(c.from) + 'dan')} muzlatilgan — bu kunlarda tavsiya chiqmaydi, aloqa belgilanmaydi · chegara ${cap} va har aloqa ${num(rate)} so'm o'zgarmaydi`];
                if (c.kind === 'restored') return ['↺', `${nm} ${esc(dG(c.from))}dan ${c.from > td ? 'qaytadi' : 'qaytdi'}${c.from > td ? ` — birinchi aloqa ${esc(dG(c.from))}dan keyin` : ''}`];
                if (c.kind === 'left') return ['✕', `${nm} ${esc(dG(c.from))}dan chiqib ketgan — o'qigan davridagi aloqalar hisoblanadi`];
                return ['⇄', `${nm} — ${esc(dG(c.from))}dan asosiy ustoz ${esc(u.shortName(c.teacherName))} · aloqalaringizni endi u ko'radi`];
            };
            container.innerHTML = `<div class="ahx-head mhx-head yd-hh"><div><h1>${greet}, ${esc(first(user.name))}</h1><p>${headSub}</p></div>${sw}</div>
              <div class="sc-note yd-lock">${LOCK_SVG}<span><b>${esc(cap1(mName(prevMonth)))} yopildi — endi faqat ko'rish uchun.</b> Aloqani qo'shish, o'chirish yoki tuzatish mumkin emas. Xato ko'rsangiz, ${esc(until)}gacha Moliyaga murojaat yuboring — to'lovdan oldin ko'rib chiqiladi.${fin.length ? ` <b>Yuborilgan: ${fin.length}${fin.some(r => r.status === 'new') ? ' · ko\'rib chiqilmoqda' : ''}</b>` : ''}</span>
                ${pst.final_at ? '' : '<button type="button" class="sc-btn sc-btn--sm" data-fin>Moliyaga murojaat</button>'}</div>
              ${finList(fin)}
              <div class="yd-ctop"><section class="card kbx-plan"><div class="kbx-plan-top"><div class="kbx-plan-main">
                  <div class="kbx-plan-h"><h2>${esc(cap1(mName(prevMonth)))} maoshi · yakuniy</h2><button type="button" class="ahx-link" data-go-contacts="${prevMonth}">Batafsil →</button></div>
                  <div class="kbx-plan-num"><b>${esc(num(prev.amount))}</b><span>so'm</span></div>
                  <span class="kbx-sub">${prev.counted} hisoblangan aloqa × ${esc(money(rate))} · ${nAct} faol${nLeft ? ` + ${nLeft} chiqib ketgan` : ''}</span></div></div>
                  <div class="kbx-bar is-ok" role="img" aria-label="${cAct} / ${possibleP}"><i style="width:${possibleP ? Math.min(100, cAct / possibleP * 100) : 0}%"></i></div>
                  <div class="kbx-bar-foot"><span><strong>${cAct}</strong> / ${possibleP} faollar${cLeft ? ` · <strong>+${cLeft}</strong> chiqib ketgan` : ''}</span><span>${prev.corrections ? `+${prev.corrections} tuzatish` : ''}</span></div>
                  <div class="kbx-tiles"><div><span>Hisoblanmadi</span><b>${prev.noAnswer}</b><small>javob bermadi</small></div>
                    <div><span>Limitdan ortiq</span><b>${prev.overCap}</b><small>13 tadan ortig'i hisobga kirmaydi</small></div>
                    <div><span>Admin tuzatishi</span><b>${prev.corrections ? '+' + prev.corrections : 0}</b><small>${cors.length ? esc(cors.slice(0, 2).map(c => `${first(find(c.sid)?.name || '')} · ${DAY[wd(c.day) - 1]} ${dS(c.day)}`).join(', ')) : 'yo\'q'}</small></div></div></section>
                ${stepsHtml(prevMonth, prev, prev2, card4)}</div>
              ${closedTable(prevMonth, prev, ch)}
              <section class="sc-card yd-nov"><header class="sc-ch"><h2>${esc(cap1(mName(month)))} boshlandi</h2><button type="button" class="ahx-link" data-mode="now">Bugungi aloqalar →</button></header>
                <div class="yd-nov-b"><div class="yd-nov-k"><small>${esc(cap1(mName(month)))} · hozirgacha</small><b>${counted} aloqa</b><span class="sc-mt">bugun ${advN} tavsiya · ${doneN} bajarildi · ${list.length} o'quvchi</span></div>
                  <ul class="yd-chl">${(chNow || []).map(chLine).map(([i, t]) => `<li><span class="yd-chi" aria-hidden="true">${i}</span><span>${t}</span></li>`).join('') || '<li class="sc-mt">O\'quvchilaringizda o\'zgarish yo\'q — tavsiya jadvali avvalgidek.</li>'}</ul></div></section>`;
            bind();
            container.querySelector('[data-fin]')?.addEventListener('click', () => financeDrawer(prevMonth, prev, refresh));
            return;
        }

        const prevBlock = closedAvail ? `<section class="card ahx-card ya-prev"><div class="ahx-card-h"><h3>🔒 ${esc(mName(prevMonth))} yopildi — faqat ko'rish</h3><button type="button" class="ahx-link" data-mode="closed">Batafsil →</button></div>
            <p><b class="ya-big">${esc(money(prev.amount))}</b> · ${prev.counted} hisoblangan aloqa × ${esc(money(rate))} · ${esc(paySteps(prevMonth, prev).last)}</p></section>` : '';
        const doneN = advised.filter(done).length;
        const nx = next ? (() => { const x = ac.get(next.id), r = by.get(next.id);
            const mins = tmin(next) - nowMin;
            return `<section class="kbx-next" aria-labelledby="yaNext"><span class="kbx-eyebrow">KEYINGI ALOQA · TAVSIYA ${esc(next.lessonTime || '')}${mins > 0 && mins < 24 * 60 ? ` · ${mins >= 60 ? Math.floor(mins / 60) + ' SOAT ' : ''}${mins % 60} DAQIQADAN KEYIN` : ''}</span>
              <h2 id="yaNext">${esc(next.name)}</h2><span class="kbx-dsub">asosiy ustoz ${esc(teacherName(next.teacherId, true))} · darslari ${esc(pattern(next.lessonDayOfWeek))} · bu hafta ${weekOf(next) ? '' : 'hali '}${weekOf(next)}/3</span>
              <div class="kbx-dchips">${x ? `<span class="kbx-dchip">Ilovada ${x.reached}-dars</span>${x.firstTryAvg != null ? `<span class="kbx-dchip">1-urinish ${x.firstTryAvg}%</span>` : ''}` : ''}<span class="kbx-dchip">${r?.counted || 0} / ${cap} aloqa</span></div>
              <div class="yd-nbar"><span>Bugun</span><i><i style="width:${advised.length ? doneN / advised.length * 100 : 0}%"></i></i><span>${doneN} / ${advised.length}</span></div>
              <div class="kbx-next-actions"><button type="button" class="kbx-ghost yd-ncall" data-call="${esc(next.id)}">${PHONE_SVG}Qo'ng'iroq</button><button type="button" class="kbx-call" data-mark="${esc(next.id)}">Aloqani belgilash</button><button type="button" class="kbx-ghost" data-card="${esc(next.id)}">Karta</button></div></section>`; })()
            : `<section class="kbx-next"><span class="kbx-eyebrow">BUGUNGI ALOQALAR</span><h2>${advised.length ? 'Hammasi belgilandi' : 'Bugun tavsiya yo\'q'}</h2><span class="kbx-dsub">${advised.length ? `${doneN} / ${advised.length} aloqa` : 'Aloqani istalgan kuni qilish mumkin'}</span>
              <div class="kbx-next-actions"><button type="button" class="kbx-call" data-go-contacts="${month}">Aloqalar</button></div></section>`;
        // YordamchiBosh (.tl2): ☎ + holat pill'i; alohida tugma yo'q. Bajarilmagan qatorda pill bosiladi → aloqani belgilash.
        const rowHtml = s => {
            const t = todayOf(s), okIt = t.find(i => i.status === 'counted') || [...t].reverse().find(i => i.outcome === 'contacted'), last = t[t.length - 1];
            const markPill = (cls, txt) => `<button type="button" class="sc-pill ${cls} ya-mk" data-mark="${esc(s.id)}" title="Aloqani belgilash" aria-label="${esc(s.name)} — aloqani belgilash (${esc(txt)})">${esc(txt)}</button>`;
            const st = okIt ? `<span class="sc-pill ${okIt.status === 'counted' ? 'sc-pill--ok' : 'sc-pill--mute'}">${CHI[okIt.channel]?.[0] || ''} ${okIt.minutes ? okIt.minutes + ' daq' : ''}</span>`
                : last ? markPill('sc-pill--bad', 'Javob bermadi')
                : tmin(s) < nowMin ? markPill('sc-pill--warn', 'Belgilanmagan') : markPill('sc-pill--mute', 'Rejada');
            const dot = okIt ? 'ok' : last ? 'na' : tmin(s) < nowMin ? 'late' : '';
            const sub = [`tavsiya ${esc(s.lessonTime || '—')}`, okIt ? `bog'landi ${u.hm(okIt.at ?? 0)}` : last ? `urinildi ${u.hm(last.at ?? 0)}` : '', `asosiy ${esc(teacherName(s.teacherId, true))}`, `bu hafta ${weekOf(s)}/3`].filter(Boolean).join(' · ');
            return `<li class="ya-row"><b class="ya-time">${esc(s.lessonTime || '—')}</b><i class="yd-dot ${dot}" aria-hidden="true"></i>${studentAvatar(s, 32)}<div class="ya-who"><strong>${esc(s.name)}</strong>
              <span class="mot-prize-note">${sub}</span></div><span class="ya-acts">${callIcon(s.id)}${st}</span></li>`;
        };
        container.innerHTML = `<div class="ahx-head mhx-head yd-hh"><div><h1>${greet}, ${esc(first(user.name))}</h1><p>${headSub}</p></div>${sw}</div>
          ${prevBlock}
          <div class="kbx-top"><section class="card kbx-plan" aria-labelledby="yaPlan"><div class="kbx-plan-top"><div class="kbx-plan-main">
              <div class="kbx-plan-h"><h2 id="yaPlan">Hisoblangan maosh · ${esc(mName(month))}</h2><button type="button" class="ahx-link" data-go-contacts="${month}">Aloqalar →</button></div>
              <div class="kbx-plan-num"><b>${esc(num(amount))}</b><span>so'm · hozirgacha</span></div>
              <span class="kbx-sub">${counted} hisoblangan aloqa × ${esc(money(rate))} · har o'quvchi bilan oyiga ${cap} tagacha</span></div></div>
              <div class="kbx-bar is-ok" role="img" aria-label="${counted} / ${possible}"><i style="width:${possible ? Math.min(100, counted / possible * 100) : 0}%"></i></div>
              <div class="kbx-bar-foot"><span><strong>${counted}</strong> / ${possible} mumkin bo'lgan aloqa</span><span>${maxLeft != null ? `oy oxirigacha ko'pi bilan ${esc(num(maxLeft * rate))}` : ''}</span></div>
              <div class="kbx-tiles"><div><span>Bugun</span><b>${doneN} / ${advised.length} aloqa</b><small>${advised.filter(noAns).length ? advised.filter(noAns).length + ' javob bermadi · ' : ''}${advised.filter(s => !done(s) && !noAns(s)).length} qoldi</small></div>
                <div><span>Bu hafta</span><b>${list.reduce((n, s) => n + weekOf(s), 0)} / ${list.filter(s => !s.frozen).length * 3}</b><small>tavsiya jadvali bo'yicha</small></div>
                <div><span>Qayta urinish</span><b>${retry.length}</b><small class="${retry.length ? 'yd-bad' : ''}">${retry.length ? esc(retry.map(([s, r]) => retryNote(s, r, td)).join(' · ')) : 'yo\'q'}</small></div></div></section>${nx}</div>
          <div class="thx-grid"><div class="thx-main"><section class="card dashboard-panel"><div class="dashboard-panel-head"><h3>Bugungi tavsiya · ${advised.length} o'quvchi</h3><button type="button" class="ahx-link" data-go-plan>Tavsiya jadvali →</button></div>
              ${advised.length ? `<ul class="ya-list">${advised.map(rowHtml).join('')}</ul>` : `<p class="dashboard-empty">Bugun (${esc(DAY[wdNow - 1])}) tavsiya qilingan aloqa yo'q</p>`}</section></div>
            <aside class="thx-side">${nearCap.length ? `<section class="card ahx-card ya-sc"><div class="ahx-card-h"><h3>${cap} ta limitga yaqinlar</h3></div>
                <ul class="ya-lim">${nearCap.map(([s, n]) => `<li><div><b>${esc(s.name)}</b><small>${n >= cap ? 'limit to\'ldi — keyingisi hisoblanmaydi' : `oyda yana ${leftOf(s)} tavsiya → ${cap + 1}-chisi hisoblanmaydi`}</small></div><span class="sc-pill sc-pill--warn">${n}/${cap}</span></li>`).join('')}</ul>
                <p class="ya-fx">Limitdan ortiq aloqa qilish mumkin, lekin maoshga qo'shilmaydi.</p></section>` : ''}
              <section class="card ahx-card ya-sc"><div class="ahx-card-h"><h3>Qoidalar</h3></div><ul class="ya-rules"><li>Ovozli yoki video — kamida 5 daqiqa</li><li>Telegram yozishma — haftasiga 1 tagacha</li><li>"Javob bermadi" yoziladi, lekin hisoblanmaydi</li><li>Bir kunda ikki aloqa — bitta</li><li>Shu kuni belgilanadi, keyin faqat admin</li></ul></section></aside></div>`;
        bind();
    }

    window.schoolTeacher = Object.assign(base, { renderContacts, markDrawer, renderMyStudents, assistantHome, financeDrawer, callStudent, lateDrawer, goDavomat });
})();
