// Sinov darslari — UstozSinov, Sinov (admin Akademik → Sinov darsi + "Ustoz biriktirish") va
// RopSinov dizaynlari. Holatlar nomi bitta manbadan: js/trialWorkflow.js (PHASES).
// Ustoz faqat /api/trial-lessons (o'ziga biriktirilganlar) bilan ishlaydi; admin/ROP lidlarni
// umumiy holatdan (state) o'qiydi, ROP faqat o'z tili. Ustozga telefon/to'lov/sotuv natijasi ko'rsatilmaydi.
(function () {
    const W = () => window.trialWorkflow;
    const U = () => window.schoolUI || {};
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const TZ = 5 * 3600000;
    const DAY = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const DAY_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const MON_S = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
    const p2 = n => String(n).padStart(2, '0');
    const hm = m => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
    function local(iso) {
        const ms = Date.parse(iso || '');
        if (!Number.isFinite(ms)) return null;
        const d = new Date(ms + TZ);
        return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), ms };
    }
    const today = () => new Date(Date.now() + TZ).toISOString().slice(0, 10);
    const nowMin = () => { const d = new Date(Date.now() + TZ); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
    const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const wd = d => { const x = new Date(d + 'T00:00:00Z').getUTCDay(); return x === 0 ? 7 : x; };
    const dShort = d => `${Number(d.slice(8))}-${MON_S[Number(d.slice(5, 7)) - 1]}`;
    const rel = d => { const t = today(); return d === t ? 'Bugun' : d === addDays(t, 1) ? 'Ertaga' : d === addDays(t, -1) ? 'Kecha' : ''; };
    const relOr = d => rel(d) || dShort(d);
    // Toshkent sana+daqiqa → ISO (UTC)
    const isoOf = (date, min) => new Date(Date.parse(date + 'T00:00:00Z') + min * 60000 - TZ).toISOString();
    const langLabel = l => (l === 'russian' ? 'Rus tili' : 'Ingliz tili');
    const shortName = n => { const p = String(n || '').trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') : '—'; };
    const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
    const phaseInfo = ph => W().PHASES[ph] || { label: ph, tone: 'mute' };
    const pill = (ph, label, dot) => `<span class="sc-pill sc-pill--${phaseInfo(ph).tone}">${dot ? '<i class="tl-dot" aria-hidden="true"></i>' : ''}${esc(label || phaseInfo(ph).label)}</span>`;
    const hr = () => (typeof getItem === 'function' && typeof STORAGE_KEYS !== 'undefined' ? getItem(STORAGE_KEYS.hrEmployees, []) : []);
    const person = id => hr().find(e => String(e.id) === String(id)) || null;
    const staffAv = (id, size) => (U().staffAvatar ? U().staffAvatar(person(id) || { id }, size) : '');
    const leadAv = (l, size) => (U().studentAvatar ? U().studentAvatar({ id: l.id, name: l.name }, size) : '');
    const toast = m => (typeof showMiniToast === 'function' ? showMiniToast(m) : console.log(m));
    const api = (path, opts) => apiFetch(path, opts);
    const monthLabel = m => `${cap(MON[Number(m.slice(5, 7)) - 1])} ${m.slice(0, 4)}`;
    const shiftMonth = (m, n) => { const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
    const hoursAgo = ms => { const h = (Date.now() - ms) / 3600000; return h >= 48 ? `${Math.round(h / 24)} kun` : h < 1 ? `${Math.max(1, Math.round(h * 60))} daq` : `${(Math.round(h * 2) / 2).toString().replace('.', ',')} soat`; };

    // ════════════════════════════════════════════════════════════════════════
    // USTOZ · Sinov darslari (UstozSinov)
    // ════════════════════════════════════════════════════════════════════════
    const T = { tab: 'active', lessons: null, history: [], err: '', reject: null, result: {}, slots: null, slotsErr: '', busy: false, root: null };
    const tPhase = l => W().phase(l.trialRequest, { leadStatus: 'sinov-darsida', durationMin: l.durationMin });
    const mgrOf = l => l.managerName || (l.comments || []).filter(c => c.type === 'trial-lesson').slice(-1)[0]?.author || '';

    async function renderTeacher(container, opts = {}) {
        if (!container) return;
        T.root = container;
        // Ustoz yozayotgan bo'lsa (natija izohi, rad etish oynasi) — 30 soniyalik yangilanish matnni o'chirib yubormasin.
        if (opts.refresh && (T.busy || T.reject || container.contains(document.activeElement) && document.activeElement?.matches('textarea,input'))) return;
        if (!T.lessons) container.innerHTML = '<div class="sc-root tl-root"><p class="sc-mt">Sinov darslari yuklanmoqda…</p></div>';
        try {
            const [cur, hist] = await Promise.all([api('/api/trial-lessons'), api('/api/trial-lessons/history').catch(() => ({ history: [] }))]);
            T.lessons = cur.lessons || []; T.history = hist.history || []; T.err = '';
        } catch (e) { T.err = e.message || 'Sinov darslari yuklanmadi'; }
        if (T.busy || T.reject && opts.refresh) return;
        drawTeacher();
    }
    function teacherBadge(n) {
        const item = document.getElementById('menuItemTrialLessons');
        if (!item) return;
        let b = item.querySelector('.tl-navcnt');
        if (!n) { b?.remove(); return; }
        if (!b) { b = document.createElement('span'); b.className = 'tl-navcnt'; item.appendChild(b); }
        b.textContent = n; b.setAttribute('aria-label', `${n} ta amal kerak`);
    }
    function whenMeta(l) {
        const at = local(l.trialRequest?.scheduledAt), r = l.trialRequest || {};
        const parts = [];
        if (at) parts.push(`${dShort(at.date)}, ${DAY_FULL[wd(at.date) - 1]}`);
        parts.push(`${l.durationMin || 30} daq`);
        if (r.daysCount > 1) parts.push(`${r.daysCount} kunlik`);
        parts.push(langLabel(l.language));
        const m = mgrOf(l); if (m) parts.push(`menejer ${esc(firstName(m))}`);
        return parts.join(' · ');
    }
    const tmBox = (l, cls = '') => { const at = local(l.trialRequest?.scheduledAt); return `<span class="tl-tm ${cls}">${at ? `${esc(relOr(at.date))}<br><b>${hm(at.min)}</b>` : '—'}</span>`; };
    function resultForm(l, ph) {
        const st = T.result[l.id] || (T.result[l.id] = { attended: true, reasonId: 'student-missed', note: '' });
        const reasons = W().REASONS.filter(r => r.id !== 'teacher-late');
        return `<div class="tl-form">
            ${ph === 'overdue' ? `<div class="tl-warn" role="note"><b>Tasdiqlanmay qolgan.</b> Sinov vaqti o'tib ketdi — dars bo'lgan-bo'lmaganini yozing, aks holda menejer lidni kuta qoladi.</div>` : ''}
            <div><span class="tl-ml">Dars bo'ldimi?</span><div class="tl-opt" role="group" aria-label="Dars bo'ldimi?">
                <button type="button" class="tl-ob" data-res-att="1" data-id="${esc(l.id)}" aria-pressed="${st.attended}">O'tkazildi</button>
                <button type="button" class="tl-ob" data-res-att="0" data-id="${esc(l.id)}" aria-pressed="${!st.attended}">Lid kelmadi</button></div></div>
            ${st.attended ? '' : `<div><span class="tl-ml">Sabab</span><div class="tl-opt tl-wrap" role="group" aria-label="Sabab">${reasons.map(r => `<button type="button" class="tl-ob" data-res-reason="${r.id}" data-id="${esc(l.id)}" aria-pressed="${st.reasonId === r.id}">${esc(r.label)}</button>`).join('')}</div></div>`}
            <label class="tl-fl"><span class="tl-ml">Menejer uchun izoh</span><textarea rows="3" maxlength="1000" data-res-note="${esc(l.id)}" placeholder="Daraja, qiziqishi, qaysi vaqt va tarif mos keladi…">${esc(st.note)}</textarea></label>
        </div>`;
    }
    function rejectPanel() {
        const r = T.reject; if (!r) return '';
        const l = (T.lessons || []).find(x => x.id === r.id); if (!l) return '';
        const at = local(l.trialRequest.scheduledAt);
        const slots = T.slots;
        return `<section class="sc-card tl-reject" aria-labelledby="tlRjTitle">
            <header class="sc-ch"><h2 id="tlRjTitle">Vaqt to'g'ri kelmaydi · sabab va taklif</h2><span class="sc-pill sc-pill--info">${esc(firstName(l.name))} · ochiq</span></header>
            <div class="tl-rjb">
              <div class="tl-strong">${esc(l.name)}${at ? ` · ${esc(dShort(at.date))} ${hm(at.min)}` : ''} · sabab</div>
              <div class="tl-opt tl-wrap" role="group" aria-label="Sabab">${W().REJECT_REASONS.map(x => `<button type="button" class="tl-ob" data-rj-reason="${x.id}" aria-pressed="${r.reasonId === x.id}">${esc(x.label)}</button>`).join('')}</div>
              ${r.reasonId === 'teacher-other' ? `<label class="tl-fl"><span class="tl-ml">Izoh</span><textarea rows="2" maxlength="500" data-rj-note placeholder="Qisqacha sabab">${esc(r.note || '')}</textarea></label>` : ''}
              <div class="tl-strong">Menejerga boshqa vaqt taklif qiling (o'z bo'sh vaqtlaringiz):</div>
              ${slots == null ? '<p class="sc-mt">Bo\'sh vaqtlaringiz yuklanmoqda…</p>'
                : slots.length ? `<div class="tl-opt tl-wrap" role="group" aria-label="Taklif qilinadigan vaqtlar">${slots.map(s => `<button type="button" class="tl-ob" data-rj-slot="${esc(s.iso)}" aria-pressed="${r.picks.includes(s.iso)}">${DAY[wd(s.date) - 1]} ${Number(s.date.slice(8))} · ${hm(s.min)}</button>`).join('')}</div>
                   <p class="sc-mt">Ko'pi bilan ${W().MAX_PROPOSALS} ta · ixtiyoriy</p>`
                : `<p class="sc-mt">${esc(T.slotsErr || "Keyingi kunlarda sinovga ochiq bo'sh vaqtingiz topilmadi")} — sababni yuboring, menejer o'zi kelishadi.</p>`}
              <div class="tl-acts"><button type="button" class="sc-btn" data-rj-cancel>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-rj-send>Menejerga yuborish</button></div>
              <p class="sc-mt">${esc(firstName(l.name))}ning ${at ? hm(at.min) + ' dagi ' : ''}joyi darhol bo'shaydi; menejer yangi vaqtni lid bilan kelishadi.</p>
            </div></section>`;
    }
    function histRow(h) {
        const r = h.trialRequest || {}, at = local(r.scheduledAt);
        const sub = h.phase === 'done' ? `O'tkazildi${r.resultNote ? ' · ' + esc(r.resultNote.slice(0, 80)) : ''}`
            : h.phase === 'noshow' ? `Lid kelmadi${r.reasonLabel ? ' · ' + esc(r.reasonLabel) : ''}`
            : h.phase === 'rejected' ? `Siz rad etdingiz${r.reasonLabel ? ' · ' + esc(r.reasonLabel) : ''}`
            : h.phase === 'rebooked' ? 'Menejer qayta qo\'ydi' : 'Natijasiz yopildi';
        const ph = h.phase === 'rejected' ? 'rejected' : h.phase;
        return `<div class="tl-ls"><span class="tl-tm ${h.phase === 'done' ? 'done' : ''}">${at ? esc(dShort(at.date)) : '—'}</span>
            <div class="tl-inf"><div class="tl-nm">${esc(h.name)}</div><div class="sc-mt">${sub}${h.managerName ? ` · ${esc(firstName(h.managerName))}` : ''}</div></div>${pill(ph, h.phase === 'rebooked' ? 'Qayta' : null)}</div>`;
    }
    function drawTeacher() {
        const root = T.root; if (!root) return;
        const lessons = T.lessons || [];
        const withPh = lessons.map(l => ({ l, ph: tPhase(l) }));
        const by = ph => withPh.filter(x => ph.includes(x.ph)).sort((a, b) => String(a.l.trialRequest.scheduledAt).localeCompare(String(b.l.trialRequest.scheduledAt)));
        const need = by(['pending']), results = by(['overdue', 'result']), upcoming = by(['accepted', 'rejected']);
        const completedNow = withPh.filter(x => x.l.trialRequest?.state === 'completed').map(x => ({ id: x.l.id, name: x.l.name, managerName: mgrOf(x.l), phase: x.l.trialRequest.attended ? 'done' : 'noshow', trialRequest: x.l.trialRequest }));
        const allHist = [...completedNow, ...T.history.filter(h => !completedNow.some(c => c.id === h.leadId && c.trialRequest.id === h.trialRequest.id))]
            .sort((a, b) => String(b.trialRequest.scheduledAt).localeCompare(String(a.trialRequest.scheduledAt)));
        teacherBadge(need.length + results.length);
        const month = today().slice(0, 7);
        const inMonth = allHist.filter(h => String(local(h.trialRequest.scheduledAt)?.date || '').startsWith(month));
        const monthOpen = withPh.filter(x => ['overdue', 'result', 'pending', 'accepted', 'rejected'].includes(x.ph) && local(x.l.trialRequest.scheduledAt)?.date.startsWith(month));
        const cnt = ph => inMonth.filter(h => h.phase === ph).length + monthOpen.filter(x => x.ph === ph).length;
        const waiting = results.length;
        const summary = `${cap(MON[Number(month.slice(5)) - 1])}: ${inMonth.length + monthOpen.length} sinov · ${cnt('done')} o'tkazildi · ${cnt('noshow')} lid kelmadi${waiting ? ` · ${waiting} natija kutilmoqda` : ''}`;
        const head = `<div class="sc-head"><div><h1>Sinov darslari</h1><p class="sc-sub">Sizga biriktirilgan sinov darslari · vaqt Toshkent bo'yicha</p></div>
            <div class="sc-seg" role="group" aria-label="Davr"><button type="button" data-tl-tab="active" aria-pressed="${T.tab === 'active'}">Faol</button><button type="button" data-tl-tab="history" aria-pressed="${T.tab === 'history'}">Tarix</button></div></div>`;
        if (T.err && !T.lessons?.length) {
            root.innerHTML = `<div class="sc-root tl-root">${head}<div class="sc-card sc-pad"><p class="sc-mt">${esc(T.err)}</p><button type="button" class="sc-btn sc-mtop" data-tl-retry>Qayta urinish</button></div></div>`;
            bindTeacher(); return;
        }
        let body = '';
        if (T.tab === 'history') {
            const groups = {};
            allHist.forEach(h => { const m = (local(h.trialRequest.scheduledAt)?.date || '').slice(0, 7); (groups[m] ||= []).push(h); });
            const k = cnt;
            body =`<div class="sc-kpis"><div class="sc-kpi"><small>${cap(MON[Number(month.slice(5)) - 1])}</small><b>${inMonth.length + monthOpen.length}</b><span>sinov</span></div>
                <div class="sc-kpi"><small>O'tkazildi</small><b>${k('done')}</b><span>${k('noshow')} lid kelmadi</span></div>
                <div class="sc-kpi"><small>Rad etildi</small><b>${k('rejected')}</b><span>vaqt to'g'ri kelmadi</span></div>
                <div class="sc-kpi sc-kpi--warn"><small>Natija kutilmoqda</small><b>${waiting}</b><span>dars o'tgan, natija yozilmagan</span></div></div>
                ${Object.keys(groups).sort().reverse().map(m => `<section class="sc-card"><header class="sc-ch"><h2>${esc(monthLabel(m))}</h2><span class="sc-mt">${groups[m].length} ta</span></header>${groups[m].map(histRow).join('')}</section>`).join('')
                    || '<div class="sc-card tl-empty"><b>Tarix hozircha bo\'sh</b><span>Natija yozgan sinovlaringiz shu yerda saqlanadi.</span></div>'}
                <p class="sc-mt">Oxirgi 4 oy. Sotuv natijasi va to'lov ma'lumotlari ustozga ko'rsatilmaydi.</p>`;
        } else {
            const needCard = need.length ? `<section class="sc-card" aria-labelledby="tlNeed"><header class="sc-ch"><h2 id="tlNeed">Tasdiqlashingiz kerak</h2><span class="sc-pill sc-pill--warn">${need.length}</span></header>
                ${need.map(({ l }) => `<div class="tl-tr">${tmBox(l, 'warn')}<div class="tl-inf"><div class="tl-nm">${esc(l.name)}</div><div class="sc-mt">${whenMeta(l)}</div></div>
                  <div class="tl-acts"><button type="button" class="sc-btn sc-btn--pri" data-tl-accept="${esc(l.id)}">Tasdiqlash</button><button type="button" class="sc-btn" data-tl-reject="${esc(l.id)}"${T.reject?.id === l.id ? ' aria-expanded="true"' : ''}>Vaqt to'g'ri kelmaydi</button></div></div>`).join('')}</section>` : '';
            const resCard = results.length ? `<section class="sc-card" aria-labelledby="tlRes"><header class="sc-ch"><h2 id="tlRes">Dars o'tdi — natijani belgilang</h2><span class="sc-mt">Natija sotuv menejeriga boradi</span></header>
                ${results.map(({ l, ph }) => `<div class="tl-tr tl-top">${tmBox(l, ph === 'overdue' ? 'bad' : 'done')}<div class="tl-inf"><div class="tl-nm">${esc(l.name)} ${ph === 'overdue' ? pill('overdue') : ''}</div><div class="sc-mt">${whenMeta(l)}</div>${resultForm(l, ph)}</div>
                  <div class="tl-acts"><button type="button" class="sc-btn sc-btn--pri" data-tl-save="${esc(l.id)}">Saqlash</button></div></div>`).join('')}</section>` : '';
            const upCard = upcoming.length ? `<section class="sc-card" aria-labelledby="tlUp"><header class="sc-ch"><h2 id="tlUp">Yaqin sinovlar</h2></header>
                ${upcoming.map(({ l, ph }) => `<div class="tl-tr">${tmBox(l)}<div class="tl-inf"><div class="tl-nm">${esc(l.name)}</div><div class="sc-mt">${whenMeta(l)}${ph === 'rejected' && l.trialRequest.proposals?.length ? ` · taklifingiz: ${l.trialRequest.proposals.map(p => { const a = local(p); return a ? `${DAY[wd(a.date) - 1]} ${hm(a.min)}` : ''; }).join(', ')}` : ''}</div></div>
                  ${ph === 'rejected' ? pill('rejected', 'Rad etildi · menejer yangi vaqt kelishadi') : pill('accepted')}</div>`).join('')}</section>` : '';
            const recent = allHist.slice(0, 5);
            const lastCard = `<section class="sc-card" aria-labelledby="tlLast"><header class="sc-ch"><h2 id="tlLast">Oxirgi natijalar · ${esc(MON[Number(month.slice(5)) - 1])}</h2><button type="button" class="tl-link" data-tl-tab="history">Tarix →</button></header>
                ${recent.map(histRow).join('') || '<p class="sc-mt sc-pad">Hali natija yozilmagan.</p>'}
                <p class="sc-mt tl-foot">${esc(summary)}</p></section>`;
            const empty = !need.length && !results.length && !upcoming.length
                ? `<div class="sc-card tl-empty"><img class="team-ill" src="images/empty/calendar.webp" alt="" width="96" height="96" loading="lazy"><b>Hozircha faol sinov darsi yo'q</b><span>Sotuv bo'limi sizga sinov darsini biriktirsa, shu yerda vaqti bilan chiqadi va bildirishnoma keladi.</span><button type="button" class="sc-btn sc-btn--sm" data-tl-retry>Yangilash</button></div>` : '';
            body = `${needCard}${resCard}${upCard}${empty}<div class="tl-g2${T.reject ? '' : ' tl-g2--one'}">${rejectPanel()}${lastCard}</div>`;
        }
        root.innerHTML = `<div class="sc-root tl-root">${head}${body}</div>`;
        bindTeacher();
    }
    async function loadSlots(l) {
        T.slots = null; T.slotsErr = '';
        const at = local(l.trialRequest.scheduledAt);
        const from = today(), to = addDays(from, 6), dur = l.durationMin || 30;
        try {
            const r = await (U().api ? U().api(`/schedule?from=${from}&to=${to}`) : api(`/api/school/schedule?from=${from}&to=${to}`));
            const nm = nowMin(), want = at ? at.min : 16 * 60, cand = [];
            for (const v of r.views || []) {
                const opts = [];
                for (const f of v.trialFree || []) for (let t = Math.ceil(f.start / 30) * 30; t + dur <= f.end; t += 30) {
                    if (v.date === from && t <= nm + 30) continue;
                    if (at && v.date === at.date && t === at.min) continue;
                    opts.push(t);
                }
                opts.sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
                opts.slice(0, 1).forEach(t => cand.push({ date: v.date, min: t, iso: isoOf(v.date, t) }));
            }
            T.slots = cand.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
        } catch (e) { T.slots = []; T.slotsErr = e.message; }
        if (T.reject?.id === l.id) drawTeacher();
    }
    async function teacherSend(id, payload, btn) {
        const l = (T.lessons || []).find(x => x.id === id); if (!l?.trialRequest) return false;
        T.busy = true; if (btn) { btn.disabled = true; btn.dataset.label ||= btn.textContent; btn.textContent = 'Saqlanmoqda…'; }
        try {
            const r = await api(`/api/trial-lessons/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ requestId: l.trialRequest.id, ...payload }) });
            const i = T.lessons.findIndex(x => x.id === id); if (i >= 0 && r.lesson) T.lessons[i] = r.lesson;
            toast(payload.action === 'accept' ? 'Sinov tasdiqlandi' : payload.action === 'reject' ? 'Menejerga yuborildi' : 'Natija yozildi — menejerga bordi');
            return true;
        } catch (e) { toast(e.message || 'Saqlashda xatolik'); return false; }
        finally { T.busy = false; if (btn?.isConnected) { btn.disabled = false; btn.textContent = btn.dataset.label; } }
    }
    function bindTeacher() {
        const root = T.root;
        root.querySelectorAll('[data-tl-tab]').forEach(b => b.onclick = () => { T.tab = b.dataset.tlTab; drawTeacher(); root.querySelector('.tl-root')?.scrollIntoView?.({ block: 'start' }); });
        root.querySelectorAll('[data-tl-retry]').forEach(b => b.onclick = () => renderTeacher(root));
        root.querySelectorAll('[data-tl-accept]').forEach(b => b.onclick = async () => { if (await teacherSend(b.dataset.tlAccept, { action: 'accept' }, b)) { if (T.reject?.id === b.dataset.tlAccept) T.reject = null; drawTeacher(); } });
        root.querySelectorAll('[data-tl-reject]').forEach(b => b.onclick = () => {
            const l = T.lessons.find(x => x.id === b.dataset.tlReject); if (!l) return;
            T.reject = { id: l.id, reasonId: 'teacher-busy', picks: [], note: '' }; T.slots = null;
            drawTeacher(); loadSlots(l);
            root.querySelector('.tl-reject')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        });
        root.querySelectorAll('[data-rj-reason]').forEach(b => b.onclick = () => { T.reject.reasonId = b.dataset.rjReason; drawTeacher(); });
        root.querySelector('[data-rj-note]')?.addEventListener('input', e => { T.reject.note = e.target.value; });
        root.querySelectorAll('[data-rj-slot]').forEach(b => b.onclick = () => {
            const v = b.dataset.rjSlot, picks = T.reject.picks;
            if (picks.includes(v)) picks.splice(picks.indexOf(v), 1);
            else { if (picks.length >= W().MAX_PROPOSALS) { toast(`Ko'pi bilan ${W().MAX_PROPOSALS} ta vaqt`); return; } picks.push(v); }
            b.setAttribute('aria-pressed', String(picks.includes(v)));
        });
        root.querySelector('[data-rj-cancel]')?.addEventListener('click', () => { T.reject = null; drawTeacher(); });
        root.querySelector('[data-rj-send]')?.addEventListener('click', async e => {
            const r = T.reject;
            if (r.reasonId === 'teacher-other' && !String(r.note || '').trim()) { toast('Sababni qisqacha yozing'); root.querySelector('[data-rj-note]')?.focus(); return; }
            const ok = await teacherSend(r.id, { action: 'reject', reasonId: r.reasonId, proposals: r.picks, note: r.note || '' }, e.currentTarget);
            if (ok) { T.reject = null; drawTeacher(); }
        });
        root.querySelectorAll('[data-res-att]').forEach(b => b.onclick = () => { T.result[b.dataset.id].attended = b.dataset.resAtt === '1'; drawTeacher(); });
        root.querySelectorAll('[data-res-reason]').forEach(b => b.onclick = () => { T.result[b.dataset.id].reasonId = b.dataset.resReason; drawTeacher(); });
        root.querySelectorAll('[data-res-note]').forEach(t => t.addEventListener('input', () => { T.result[t.dataset.resNote].note = t.value; }));
        root.querySelectorAll('[data-tl-save]').forEach(b => b.onclick = async () => {
            const id = b.dataset.tlSave, st = T.result[id] || { attended: true };
            const payload = { action: 'outcome', attended: !!st.attended, note: st.note || '' };
            if (!st.attended) { payload.reasonId = st.reasonId; payload.attended = st.reasonId === 'attended-wants-other-teacher'; }
            if (await teacherSend(id, payload, b)) {
                delete T.result[id];
                api('/api/trial-lessons/history').then(h => { T.history = h.history || []; if (!T.busy && !T.reject) drawTeacher(); }).catch(() => {});
                drawTeacher();
            }
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Admin / ROP uchun umumiy: lidlar (state) → sinov yozuvlari
    // ════════════════════════════════════════════════════════════════════════
    function stateLeads(lang) {
        const all = typeof getItem === 'function' ? getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) : { english: [], russian: [] };
        return (all[lang] || []).filter(l => !l.deletedAt).map(l => ({ ...l, _lang: lang }));
    }
    // Har lid uchun joriy so'rov (+ ixtiyoriy arxiv). Sinov bosqichidan tashqaridagi lidlardan faqat haqiqiy so'rovi borlari.
    function trialRows(lang, withArchive = false) {
        const out = [];
        for (const l of stateLeads(lang)) {
            const inTrial = l.status === 'sinov-darsida';
            const req = inTrial ? W().request(l) : (l.trialRequest?.id ? l.trialRequest : null);
            const dur = W().durationOf(l);
            if (req || inTrial) out.push({ lead: l, req: req || { teacherId: '', scheduledAt: l.trialLessonAt || '' }, archived: false,
                ph: W().phase(req || {}, { leadStatus: l.status, durationMin: dur }), dur });
            if (withArchive) for (const a of Array.isArray(l.trialHistory) ? l.trialHistory : []) {
                if (a && a.scheduledAt) out.push({ lead: l, req: a, archived: true, ph: W().phase(a, { archived: true, durationMin: dur }), dur });
            }
        }
        return out;
    }
    const OPEN = new Set(['unassigned', 'rejected', 'pending', 'overdue', 'accepted', 'result']);
    const needsTeacher = ph => ph === 'unassigned' || ph === 'rejected';
    const mgrName = l => person(l.managerId)?.name || '';
    function timeCell(x) {
        const at = local(x.req.scheduledAt);
        if (!at) return '<div class="tl-nm">—</div><div class="sc-mt">vaqt tanlanmagan</div>';
        const r = rel(at.date);
        const main = `${r || `${dShort(at.date)}`}, ${hm(at.min)}`;
        const sub = needsTeacher(x.ph) ? (x.ph === 'rejected' ? 'ustoz rad etdi' : 'lid tanlagan vaqt')
            : ['result', 'overdue'].includes(x.ph) ? `o'tdi · ${x.dur} daq` : ['done', 'sold'].includes(x.ph) ? "o'tkazildi" : x.ph === 'noshow' ? 'lid kelmadi' : `${x.dur} daq`;
        return `<div class="tl-nm">${esc(main)}</div><div class="sc-mt">${esc(sub)}</div>`;
    }
    function openLead(lang, id) { if (typeof openLeadOverview === 'function') openLeadOverview(lang, id); }

    // ════════════════════════════════════════════════════════════════════════
    // ADMIN · Akademik bo'lim → Sinov darsi (Sinov)
    // ════════════════════════════════════════════════════════════════════════
    const A = { period: 'week', filter: 'all', root: null, lang: 'english', load: null, loadFor: '' };
    const FILTERS = [['all', 'Hammasi'], ['teacher', 'Ustoz biriktirilmagan'], ['pending', 'Tasdiq kutilmoqda'], ['overdue', "Muddati o'tdi"], ['accepted', 'Tasdiqlandi'], ['result', 'Natija kutilmoqda'], ['done', "O'tkazildi"], ['noshow', 'Lid kelmadi']];
    const matchFilter = (x, f) => f === 'all' || (f === 'teacher' ? needsTeacher(x.ph) : f === 'done' ? ['done', 'sold'].includes(x.ph) : x.ph === f);
    function renderAdmin(container, opts = {}) {
        if (!container) return;
        A.root = container; A.lang = opts.lang === 'russian' ? 'russian' : 'english';
        drawAdmin();
        loadTeacherLoad();
    }
    function inPeriod(x, period) {
        const at = local(x.req.scheduledAt), t = today();
        if (period === 'today') return at?.date === t;
        if (period === 'month') return at?.date.slice(0, 7) === t.slice(0, 7);
        if (OPEN.has(x.ph)) return true;
        return !!at && at.date >= addDays(t, -7) && at.date <= t;
    }
    function drawAdmin() {
        const root = A.root; if (!root) return;
        const rows = trialRows(A.lang).filter(x => x.ph !== 'closed' || inPeriod(x, 'today'));
        const t = today();
        const week = rows.filter(x => inPeriod(x, 'week')), todayRows = rows.filter(x => inPeriod(x, 'today')), monthRows = rows.filter(x => inPeriod(x, 'month'));
        const list = A.period === 'today' ? todayRows : A.period === 'month' ? monthRows : week;
        const shown = list.filter(x => matchFilter(x, A.filter)).sort((a, b) => {
            const o = ph => (needsTeacher(ph) ? 0 : ['overdue', 'result'].includes(ph) ? 1 : ph === 'pending' ? 2 : ph === 'accepted' ? 3 : 4);
            return o(a.ph) - o(b.ph) || String(a.req.scheduledAt).localeCompare(String(b.req.scheduledAt));
        });
        const openN = week.filter(x => OPEN.has(x.ph)).length;
        const noTeacher = rows.filter(x => needsTeacher(x.ph));
        const waiting = rows.filter(x => ['result', 'overdue'].includes(x.ph));
        const todaySub = todayRows.slice().sort((a, b) => String(a.req.scheduledAt).localeCompare(String(b.req.scheduledAt))).slice(0, 3)
            .map(x => `${hm(local(x.req.scheduledAt).min)} ${needsTeacher(x.ph) ? 'ustozsiz' : ['result', 'overdue', 'done', 'noshow', 'sold'].includes(x.ph) ? "o'tdi" : x.ph === 'pending' ? 'tasdiqsiz' : 'tasdiqlangan'}`).join(' · ');
        const chips = FILTERS.filter(([f]) => f === 'all' || !['overdue', 'noshow'].includes(f) || list.some(x => matchFilter(x, f)))
            .map(([f, label]) => `<button type="button" class="tl-chip" data-a-filter="${f}" aria-pressed="${A.filter === f}">${esc(label)} <b>${list.filter(x => matchFilter(x, f)).length}</b></button>`).join('');
        const tr = x => {
            const l = x.lead, tId = x.req.teacherId;
            const teacherCell = needsTeacher(x.ph)
                ? `${x.ph === 'rejected' && tId ? `<div class="sc-mt">rad etdi: ${esc(shortName(person(tId)?.name))}</div>` : ''}<button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-a-assign="${esc(l.id)}">Ustoz biriktirish</button>`
                : `<span class="tl-who">${staffAv(tId, 28)}${esc(person(tId)?.name || '—')}</span>`;
            return `<tr><td><div class="tl-who">${leadAv(l, 36)}<div><button type="button" class="tl-namebtn" data-a-open="${esc(l.id)}">${esc(l.name || '—')}</button><div class="sc-mt">${esc(l.phone || '')}${mgrName(l) ? `<br>menejer ${esc(firstName(mgrName(l)))}` : ''}</div></div></div></td>
                <td>${teacherCell}</td><td>${timeCell(x)}</td><td>${pill(x.ph, null, true)}</td></tr>`;
        };
        const todayCard = todayRows.length ? todayRows.slice().sort((a, b) => String(a.req.scheduledAt).localeCompare(String(b.req.scheduledAt))).map(x => {
            const at = local(x.req.scheduledAt);
            const nowOn = at && !['done', 'noshow', 'sold', 'result', 'overdue'].includes(x.ph) && at.min >= nowMin();
            return `<div class="tl-slot"><span class="tl-tm${nowOn ? ' now' : ''}"><b>${hm(at.min)}</b></span><div class="tl-inf"><div class="tl-nm">${esc(x.lead.name)}</div>
                <div class="sc-mt"${needsTeacher(x.ph) ? ' style="color:var(--kb-warn-fg);font-weight:700"' : ''}>${needsTeacher(x.ph) ? esc(phaseInfo(x.ph).label) : esc(person(x.req.teacherId)?.name || '—')}</div></div>
                ${needsTeacher(x.ph) ? `<button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-a-assign="${esc(x.lead.id)}">Biriktirish</button>` : pill(x.ph)}</div>`;
        }).join('') : '<p class="sc-mt sc-pad">Bugun sinov darsi yo\'q.</p>';
        const d = new Date(Date.now() + TZ);
        root.innerHTML = `<div class="sc-root tl-root tl-admin">
            <div class="sc-kpis tl-kpis">
              <div class="sc-kpi"><small>Ro'yxatda</small><b>${week.length}</b><span>${openN} faol · ${week.length - openN} ta oxirgi 7 kunda yakunlangan</span></div>
              <div class="sc-kpi"><small>Bugungi sinovlar</small><b>${todayRows.length}</b><span>${esc(todaySub || '—')}</span></div>
              <div class="sc-kpi${noTeacher.length ? ' sc-kpi--warn' : ''}"><small>Ustoz biriktirilmagan</small><b>${noTeacher.length}</b><span>Biriktirilmaguncha dars bo'lmaydi</span></div>
              <div class="sc-kpi"><small>Natija kutilmoqda</small><b>${waiting.length}</b><span>${(() => { const od = waiting.filter(x => x.ph === 'overdue').length; return od ? `Dars o'tdi, natija yozilmagan · shundan ${od} tasi "Muddati o'tdi"` : 'Dars o\'tdi, ustoz natijani yozmagan'; })()}</span></div>
            </div>
            <div class="tl-split">
              <section class="sc-card" aria-labelledby="tlAT">
                <header class="sc-ch"><h2 id="tlAT">Sinov darsidagi lidlar</h2>
                  <div class="sc-seg" role="group" aria-label="Davr"><button type="button" data-a-period="today" aria-pressed="${A.period === 'today'}">Bugun</button><button type="button" data-a-period="week" aria-pressed="${A.period === 'week'}">Faol + 7 kun</button><button type="button" data-a-period="month" aria-pressed="${A.period === 'month'}">Oy · ${monthRows.length}</button></div></header>
                <div class="tl-chips" role="group" aria-label="Holat bo'yicha filtr">${chips}</div>
                <div class="tl-scroll"><table class="tl-table"><thead><tr><th scope="col">Lid</th><th scope="col">Ustoz</th><th scope="col">Vaqt</th><th scope="col">Holat</th></tr></thead>
                  <tbody>${shown.map(tr).join('') || `<tr><td colspan="4" class="tl-none">Bu filtrda sinov darsi yo'q</td></tr>`}</tbody></table></div>
                <div class="tl-flow" aria-label="Sinov darsi jarayoni">
                  <div class="tl-fs"><span class="tl-fn">1</span><div><b>Menejer bo'sh vaqtni band qiladi</b><div class="sc-mt">Umumiy jadvaldan · sinovga ochiq vaqt</div></div></div>
                  <div class="tl-fs"><span class="tl-fn">2</span><div><b>Ustoz tasdiqlaydi</b><div class="sc-mt">Bo'sh vaqt bo'lmasa — admin biriktiradi</div></div></div>
                  <div class="tl-fs"><span class="tl-fn">3</span><div><b>Ustoz darsni o'tadi</b><div class="sc-mt">"Sinov darslari" kabinetida</div></div></div>
                  <div class="tl-fs"><span class="tl-fn">4</span><div><b>Natija yoziladi → vaqt bo'shaydi</b><div class="sc-mt">Menejer sotuvni yakunlaydi</div></div></div>
                </div>
              </section>
              <div class="tl-side">
                <section class="sc-card" aria-labelledby="tlAToday"><header class="sc-ch"><h2 id="tlAToday">Bugun</h2><span class="sc-mt">${DAY_FULL[wd(t) - 1]}, ${d.getUTCDate()}-${MON[d.getUTCMonth()]}</span></header>${todayCard}</section>
                <section class="sc-card" aria-labelledby="tlALoad"><header class="sc-ch"><h2 id="tlALoad">Sinovga ochiq vaqt · bugun qolgani</h2></header><div class="tl-load" data-a-load>${loadHtml()}</div></section>
              </div>
            </div></div>`;
        root.querySelectorAll('[data-a-period]').forEach(b => b.onclick = () => { A.period = b.dataset.aPeriod; drawAdmin(); });
        root.querySelectorAll('[data-a-filter]').forEach(b => b.onclick = () => { A.filter = b.dataset.aFilter; drawAdmin(); });
        root.querySelectorAll('[data-a-assign]').forEach(b => b.onclick = () => openAssign(A.lang, b.dataset.aAssign, () => drawAdmin()));
        root.querySelectorAll('[data-a-open]').forEach(b => b.onclick = () => openLead(A.lang, b.dataset.aOpen));
        const ld = root.querySelector('[data-a-load]'); if (ld) window.LoadErr.bind(ld, () => loadTeacherLoad());
    }
    // Ustozlarning bugungi yuklamasi (umumiy jadvaldan).
    async function loadTeacherLoad() {
        const key = A.lang + today();
        if (A.loadFor === key && A.load) return;
        A.loadFor = key; A.load = null;
        try {
            const t = today();
            const r = await api(`/api/school/schedule?from=${t}&to=${t}&lang=${A.lang}`);
            const nm = nowMin();
            const names = new Map((r.teachers || []).map(x => [x.id, x.name]));
            A.load = (r.views || []).filter(v => names.has(v.teacherId) && (v.work || []).length).map(v => {
                const work = (v.work || []).reduce((s, w) => s + (w.end - w.start), 0);
                const lessons = (v.items || []).filter(i => i.kind === 'lesson').length, trials = (v.items || []).filter(i => i.kind === 'trial').length;
                const busy = (v.items || []).filter(i => ['lesson', 'trial', 'makeup'].includes(i.kind)).reduce((s, i) => s + (i.end - i.start), 0);
                const left = (v.trialFree || []).map(f => ({ start: Math.max(f.start, Math.ceil(nm / 30) * 30), end: f.end })).filter(f => f.end - f.start >= 30);
                return { id: v.teacherId, name: names.get(v.teacherId), lessons, trials, left, pct: work ? Math.min(100, Math.round(busy / work * 100)) : 0 };
            }).sort((a, b) => b.left.length - a.left.length || a.name.localeCompare(b.name));
        } catch (e) { A.load = { err: e }; A.loadFor = ''; }
        const el = A.root?.querySelector('[data-a-load]'); if (el) { el.innerHTML = loadHtml(); window.LoadErr.bind(el, () => loadTeacherLoad()); }
    }
    function loadHtml() {
        if (!A.load) return '<p class="sc-mt">Yuklanmoqda…</p>';
        if (A.load.err) return window.LoadErr.html({ title: 'Ustozlar yuklamasini yuklab bo\'lmadi', err: A.load.err, note: 'Bo\'sh vaqtlar ko\'rsatilmadi.', compact: true });
        if (!A.load.length) return '<p class="sc-mt">Bugun ish vaqti belgilangan ustoz yo\'q.</p>';
        return A.load.map(x => `<div><div class="tl-bl"><span>${esc(x.name)}</span><span>${x.lessons} dars${x.trials ? ` + ${x.trials} sinov` : ''} · qolgan: ${x.left.length ? x.left.map(f => `${hm(f.start)}–${hm(f.end)}`).join(', ') : "yo'q"}</span></div>
            <div class="tl-bar" role="img" aria-label="Band ${x.pct}%"><span style="width:${x.pct}%"></span></div></div>`).join('');
    }

    // ── "Ustoz biriktirish" oynasi (Oynalar: ADMIN · SINOV DARSI → USTOZ BIRIKTIRISH) ──
    async function openAssign(lang, leadId, done) {
        const lead = stateLeads(lang).find(l => l.id === leadId);
        if (!lead || !U().openDrawer) return;
        const req = W().request(lead) || { scheduledAt: lead.trialLessonAt };
        const dur = W().durationOf(lead);
        const base = local(req.scheduledAt);
        const times = [];
        if (base) times.push({ date: base.date, min: base.min, src: 'lead' });
        (req.proposals || []).forEach(p => { const a = local(p); if (a) times.push({ date: a.date, min: a.min, src: 'teacher' }); });
        const st = { time: times.find(x => x.date > today() || (x.date === today() && x.min > nowMin())) || times[0] || { date: today(), min: Math.ceil((nowMin() + 60) / 30) * 30, src: 'custom' }, teacherId: '', views: null, err: '' };
        const rejectedBy = req.state === 'rejected' ? String(req.teacherId || '') : '';
        const whenTxt = t => `${(rel(t.date) || dShort(t.date)).toLowerCase()}, ${hm(t.min)}`;
        // Markazdagi oyna (Oynalar dizayni) — js/schoolUI.js openDialog, css/oquvchilar.css (.oqm-*).
        const drw = U().openDialog({ title: 'Ustoz biriktirish', sub: esc(`${lead.name} · ${base ? whenTxt(base) : 'vaqt yo\'q'} · ${dur} daq · ${langLabel(lang)}`), body: '<div data-as-body class="oqm-db" style="padding:0"><p class="oqm-mt">Yuklanmoqda…</p></div>',
            foot: '<button type="button" class="oqm-btn" data-close>Bekor</button><button type="button" class="oqm-btn is-pri" data-as-save disabled>Biriktirish</button>' });
        const body = drw.querySelector('[data-as-body]'), save = drw.querySelector('[data-as-save]');
        U().loadStaffAvatars?.().then(() => { if (st.views) draw(); });
        async function load() {
            st.views = null; draw();
            try {
                const r = await api(`/api/school/schedule?from=${st.time.date}&to=${st.time.date}&lang=${lang}`);
                st.teachers = (r.teachers || []).filter(t => ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi'].includes(t.role));
                st.views = r.views || []; st.err = '';
            } catch (e) { st.err = e; st.views = []; }
            draw();
        }
        function statusOf(t) {
            const v = st.views.find(x => x.teacherId === t.id);
            const a = st.time.min, b = st.time.min + dur;
            if (!v || !(v.work || []).some(w => w.start <= a && b <= w.end)) return { ok: false, why: 'ish vaqti emas' };
            const clash = (v.items || []).find(i => i.start < b && a < i.end && !['reserved'].includes(i.kind));
            if (clash) return { ok: false, why: `${hm(clash.start)}–${hm(clash.end)} ${clash.kind === 'trial' ? 'boshqa sinovda' : clash.kind === 'close' || clash.kind === 'leave' ? 'yopiq' : clash.studentName ? `${firstName(clash.studentName)} bilan darsda` : 'darsda'}` };
            if (!(v.trialFree || []).some(f => f.start <= a && b <= f.end)) return { ok: false, why: 'sinovga yopiq' };
            return { ok: true, v };
        }
        function draw() {
            const past = Date.parse(isoOf(st.time.date, st.time.min)) <= Date.now();
            let list = '<p class="oqm-mt">Ustozlar yuklanmoqda…</p>';
            if (st.views) {
                const rowsT = (st.teachers || []).map(t => ({ t, s: statusOf(t), rej: rejectedBy === t.id && base && st.time.date === base.date && st.time.min === base.min }))
                    // Ustoz taklif qilgan vaqt tanlansa — o'sha ustoz birinchi va oldindan tanlangan.
                    .sort((x, y) => (y.s.ok && !y.rej) - (x.s.ok && !x.rej) || (st.time.src === 'teacher') * ((y.t.id === rejectedBy) - (x.t.id === rejectedBy)) || x.t.name.localeCompare(y.t.name));
                if (st.time.src === 'teacher' && !st.teacherId && rowsT.some(r => r.t.id === rejectedBy && r.s.ok)) st.teacherId = rejectedBy;
                // Birinchi bo'sh ustoz oldindan tanlanadi (Oynalar dizayni); admin boshqasini tanlashi mumkin.
                if (!st.teacherId) { const f = rowsT.find(r => r.s.ok && !r.rej); if (f) st.teacherId = f.t.id; }
                list = st.err ? window.LoadErr.html({ title: 'Ustozlar jadvalini yuklab bo\'lmadi', err: st.err, note: 'Bo\'sh vaqtlar ko\'rsatilmadi.', compact: true }) : rowsT.map(({ t, s, rej }) => {
                    const v = st.views.find(x => x.teacherId === t.id);
                    const lessons = (v?.items || []).filter(i => i.kind === 'lesson').length;
                    // Tanlangan vaqtni o'z ichiga olgan ochiq oraliq (dizayndagidek: "17:30–19:00 sinovga ochiq").
                    const fr = (v?.trialFree || []).find(f => f.start <= st.time.min && st.time.min + dur <= f.end);
                    const open = fr ? `${hm(fr.start)}–${hm(fr.end)}` : (v?.trialFree || []).map(f => `${hm(f.start)}–${hm(f.end)}`).slice(0, 2).join(', ');
                    const ok = s.ok && !rej;
                    return `<label class="oqm-opt${ok ? '' : ' is-off'}"><input type="radio" name="tlAsT" value="${esc(t.id)}"${ok ? '' : ' disabled'}${st.teacherId === t.id ? ' checked' : ''}><span class="oqm-radio" aria-hidden="true"></span>
                        <span class="oqm-av">${U().staffAvatar ? U().staffAvatar({ id: t.id, avatar: t.avatar || person(t.id)?.avatar }, 36) : ''}</span><span class="oqm-tx"><span class="oqm-nm">${esc(t.name)}</span><span class="oqm-mt">${ok || !s.why ? `${(rel(st.time.date) || dShort(st.time.date)).toLowerCase()} ${lessons} dars${open ? ` · ${open} sinovga ochiq` : ''}` : esc(s.why)}</span></span>
                        ${rej ? '<span class="oqm-pill is-mute">Rad etgan</span>' : ok ? `<span class="oqm-pill is-ok">${hm(st.time.min)} ochiq</span>` : '<span class="oqm-pill is-no">Band</span>'}</label>`;
                }).join('') || '<p class="oqm-mt">Bu tilda faol ustoz topilmadi.</p>';
            }
            body.innerHTML = `<div class="oqm-box">Lid tanlagan vaqt: <b>${base ? esc(whenTxt(base)) : '—'}</b>. ${times.some(t => t.src === 'teacher') ? 'Rad etgan ustoz boshqa vaqtlarni ham taklif qilgan. ' : ''}Bu vaqtda sinovga ochiq ustozlar tepada (umumiy jadvaldan).</div>
                ${times.length > 1 ? `<div class="oqm-chips" role="group" aria-label="Vaqt">${times.map((t, i) => `<button type="button" class="oqm-chip" data-as-time="${i}" aria-pressed="${t.date === st.time.date && t.min === st.time.min}">${esc(whenTxt(t))}${t.src === 'teacher' ? ' · ustoz taklifi' : ''}</button>`).join('')}</div>` : ''}
                ${past ? '<div class="oqm-err" role="alert">Bu vaqt o\'tib ketgan — boshqa vaqt tanlang (lid bilan kelishilgan).</div>' : ''}
                ${st.time.src === 'lead' ? '' : `<div class="oqm-fl">${esc(whenTxt(st.time))} · ${dur} daq</div>`}<div class="oqm-db" style="padding:0" role="radiogroup" aria-label="Ustoz">${list}</div>
                <details class="oqm-more"${st.time.src === 'custom' ? ' open' : ''}><summary>Boshqa vaqt</summary><div class="oqm-row"><input type="date" data-as-date value="${st.time.date}" min="${today()}" aria-label="Sana"><input type="time" data-as-tm step="1800" value="${hm(st.time.min)}" aria-label="Vaqt"><button type="button" class="oqm-btn" data-as-apply>Ko'rish</button></div></details>
                <div class="oqm-rule">Ustoz o'z kabinetida tasdiqlaydi. Tasdiqlamaguncha holat "Tasdiq kutilmoqda", vaqt boshqalarga band ko'rinadi.${(Number(lead.paymentOnboarding?.trialDaysCount) || 1) > 1 ? ` ${lead.paymentOnboarding.trialDaysCount} kunlik sinov — keyingi kunlar ham shu ustozda tekshiriladi.` : ''}</div>`;
            save.disabled = past || !st.teacherId || !st.views || !(st.teachers || []).some(t => t.id === st.teacherId && statusOf(t).ok);
            body.querySelectorAll('[data-as-time]').forEach(b => b.onclick = () => { st.time = times[Number(b.dataset.asTime)]; st.teacherId = ''; load(); });
            body.querySelectorAll('input[name=tlAsT]').forEach(i => i.onchange = () => { st.teacherId = i.value; save.disabled = past; });
            window.LoadErr.bind(body, () => load());
            body.querySelector('[data-as-apply]').onclick = () => {
                const dt = body.querySelector('[data-as-date]').value, tm = body.querySelector('[data-as-tm]').value;
                const m = /^(\d{1,2}):(\d{2})$/.exec(tm || '');
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dt) || !m) { toast('Sana va vaqtni tanlang'); return; }
                st.time = { date: dt, min: Number(m[1]) * 60 + Number(m[2]), src: 'custom' }; st.teacherId = ''; load();
            };
        }
        save.onclick = () => {
            const t = (st.teachers || []).find(x => x.id === st.teacherId); if (!t) return;
            const at = isoOf(st.time.date, st.time.min);
            const rev = globalThis.crypto?.randomUUID?.() || 'trial-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            const days = Number(lead.paymentOnboarding?.trialDaysCount) || Number(req.daysCount) || 1;
            const text = [`Ustoz biriktirildi (${user?.role === 'rop' ? 'ROP' : 'admin'}):`, ...(rejectedBy ? [`• Avvalgi ustoz rad etgan: ${req.reasonLabel || '—'}`] : []),
                `• O'qituvchi: ${t.name}`, `• Kuni: ${st.time.date.split('-').reverse().join('.')}, ${DAY_FULL[wd(st.time.date) - 1]}, ${hm(st.time.min)}`, `• Davomiyligi: ${days} kun`].join('\n');
            const saved = typeof updateLeadInStorage === 'function' && updateLeadInStorage(lang, leadId, l => ({ ...l, status: 'sinov-darsida',
                paymentOnboarding: { ...(l.paymentOnboarding || {}), teacherId: t.id, lessonDayOfWeek: wd(st.time.date), lessonTime: hm(st.time.min), trialDaysCount: days, isTrial: true },
                trialLessonAt: at, trialScheduleRevision: rev,
                trialRequest: { id: rev, teacherId: t.id, scheduledAt: at, daysCount: days, state: 'pending', requestedAt: new Date().toISOString() },
                comments: [...(Array.isArray(l.comments) ? l.comments : []), typeof createLeadComment === 'function'
                    ? createLeadComment({ type: 'trial-lesson', text, author: user?.name || 'Admin' })
                    : { id: 'c' + Date.now(), type: 'trial-lesson', text, author: user?.name || 'Admin', createdAt: new Date().toISOString() }] }));
            if (!saved) { toast('Saqlab bo\'lmadi'); return; }
            U().closeDrawer(); toast(`${t.name} biriktirildi — ustoz tasdig'i kutilmoqda`); done?.();
        };
        load();
    }

    // ════════════════════════════════════════════════════════════════════════
    // ROP · Sinov darslari nazorati (RopSinov) — faqat o'z til yo'nalishi
    // ════════════════════════════════════════════════════════════════════════
    const R = { month: today().slice(0, 7), lang: null, root: null, hints: {} };
    function ropLangs() {
        const u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (['admin', 'boshliq'].includes(u?.role)) return ['english', 'russian'];
        return [u?.linkedRopLang === 'russian' ? 'russian' : 'english'];
    }
    function renderRop(container) {
        if (!container) return;
        R.root = container;
        const langs = ropLangs();
        if (!langs.includes(R.lang)) {
            let last = null; try { last = localStorage.getItem('mh_lastLang'); } catch (_) {}
            R.lang = langs.includes(last) ? last : langs[0];
        }
        drawRop();
    }
    function drawRop() {
        const root = R.root; if (!root) return;
        const langs = ropLangs(), lang = R.lang, month = R.month, t = today();
        const all = trialRows(lang, true);
        const rows = all.filter(x => (local(x.req.scheduledAt)?.date || '').startsWith(month));
        const cur = rows.filter(x => !x.archived);
        const n = f => rows.filter(f).length;
        const done = n(x => ['done', 'sold'].includes(x.ph)), noshow = n(x => x.ph === 'noshow'), sold = n(x => x.ph === 'sold');
        const waiting = n(x => ['result', 'overdue'].includes(x.ph));
        const upcoming = n(x => ['pending', 'accepted'].includes(x.ph));
        const noTeacher = all.filter(x => !x.archived && needsTeacher(x.ph));
        const mgrs = new Map(), tch = new Map();
        for (const x of rows) {
            const m = String(x.lead.managerId || ''), k = String(x.req.teacherId || '');
            const mm = mgrs.get(m) || { put: 0, done: 0, noshow: 0, sold: 0 }; mgrs.set(m, mm);
            mm.put++; if (['done', 'sold'].includes(x.ph)) mm.done++; if (x.ph === 'noshow') mm.noshow++; if (x.ph === 'sold') mm.sold++;
            const key = needsTeacher(x.ph) && !x.archived ? '__none' : k;
            const tt = tch.get(key) || { n: 0, done: 0, sold: 0, waits: [] }; tch.set(key, tt);
            tt.n++; if (['done', 'sold'].includes(x.ph)) tt.done++; if (x.ph === 'sold') tt.sold++;
            const a = Date.parse(x.req.acceptedAt), q = Date.parse(x.req.requestedAt);
            if (Number.isFinite(a) && Number.isFinite(q) && a >= q) tt.waits.push(a - q);
        }
        const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
        const speed = w => { if (!w.length) return '—'; const s = w.slice().sort((a, b) => a - b)[Math.floor(w.length / 2)] / 60000; const txt = s < 60 ? `~${Math.max(1, Math.round(s))} daq` : `~${Math.round(s / 60)} soat`; return s > 180 ? `<span class="sc-pill sc-pill--warn">${txt.slice(1)}</span>` : txt; };
        const mgrRows = [...mgrs.entries()].sort((a, b) => b[1].put - a[1].put).map(([id, v]) => `<tr><td><span class="tl-who">${id ? staffAv(id, 28) : ''}${esc(person(id)?.name || (id ? 'Menejer' : 'Menejersiz'))}</span></td><td class="r">${v.put}</td><td class="r">${v.done}</td><td class="r">${v.noshow}</td><td class="r">${v.sold}</td>
            <td class="r"><span class="sc-pill sc-pill--${pct(v.sold, v.done) >= 50 ? 'ok' : 'warn'}">${pct(v.sold, v.done)}%</span></td></tr>`).join('');
        const tRows = [...tch.entries()].filter(([k]) => k !== '__none').sort((a, b) => b[1].n - a[1].n).map(([id, v]) => `<tr><td><span class="tl-who">${staffAv(id, 28)}${esc(person(id)?.name || '—')}</span></td><td class="r">${v.n}</td><td class="r">${v.done}</td><td class="r">${v.sold}</td><td class="r">${speed(v.waits)}</td></tr>`).join('')
            + (tch.get('__none') ? `<tr><td><span class="sc-pill sc-pill--warn">Ustoz biriktirilmagan</span></td><td class="r">${tch.get('__none').n}</td><td class="r">—</td><td class="r">—</td><td class="r">—</td></tr>` : '');
        // Bugun e'tibor kerak: ustozsiz (bugun/ertaga va undan keyin), natija yozilmagan.
        const att = [
            ...noTeacher.filter(x => { const a = local(x.req.scheduledAt); return !a || a.date <= addDays(t, 1) || x.ph === 'rejected'; }),
            ...all.filter(x => !x.archived && ['result', 'overdue'].includes(x.ph))
        ].sort((a, b) => String(a.req.scheduledAt).localeCompare(String(b.req.scheduledAt)));
        const attRow = x => {
            const a = local(x.req.scheduledAt), mgr = firstName(mgrName(x.lead));
            const near = a && Math.abs(Date.parse(a.date) - Date.parse(t)) <= 6 * 86400000;
            const tm = a ? (a.date === t ? hm(a.min) : near ? `${DAY[wd(a.date) - 1]} ${hm(a.min)}` : `${dShort(a.date)} ${hm(a.min)}`) : '—';
            if (needsTeacher(x.ph)) {
                const hint = R.hints[x.lead.id];
                const sub = x.ph === 'rejected' ? `${esc(shortName(person(x.req.teacherId)?.name))} rad etdi · ${esc(x.req.reasonLabel || '')}${x.req.proposals?.length ? ` · taklif: ${x.req.proposals.map(p => { const q = local(p); return q ? `${DAY[wd(q.date) - 1]} ${hm(q.min)}` : ''; }).join(', ')}` : ''}`
                    : `ustoz biriktirilmagan${hint ? ' · ' + esc(hint) : ''}`;
                return `<div class="tl-li2"><span class="tl-tm2 w">${tm}</span><div class="tl-inf"><div class="tl-nm">${esc(x.lead.name)}${mgr ? ' · ' + esc(mgr) : ''}</div><div class="sc-mt">${sub}</div></div><button type="button" class="sc-btn sc-btn--pri" data-r-assign="${esc(x.lead.id)}">Ustoz biriktirish</button></div>`;
            }
            const end = Date.parse(x.req.scheduledAt) + x.dur * 60000;
            return `<div class="tl-li2"><span class="tl-tm2">${tm}</span><div class="tl-inf"><div class="tl-nm">${esc(x.lead.name)}${mgr ? ' · ' + esc(mgr) : ''}</div><div class="sc-mt">${x.ph === 'overdue' ? `ustoz tasdiqlamagan, vaqti o'tdi · ${esc(shortName(person(x.req.teacherId)?.name))} natijani yozmagan` : `dars o'tdi · ${esc(shortName(person(x.req.teacherId)?.name))} natijani yozmagan`} (${hoursAgo(end)})</div></div>${pill(x.ph)}</div>`;
        };
        const curMonth = t.slice(0, 7);
        root.innerHTML = `<div class="sc-root tl-root tl-rop">
            <div class="sc-head"><div><h1>Sinov darslari · nazorat</h1><p class="sc-sub">Barcha menejerlar va ustozlar · ${esc(monthLabel(month).toLowerCase())} · ${esc(langLabel(lang))} yo'nalishi</p></div>
              <div class="tl-tb">${langs.length > 1 ? `<div class="sc-seg" role="group" aria-label="Til" data-lang-group="1"><button type="button" data-r-lang="english" aria-pressed="${lang === 'english'}">Ingliz</button><button type="button" data-r-lang="russian" aria-pressed="${lang === 'russian'}">Rus</button></div>` : ''}
                <div class="tl-mon" role="group" aria-label="Oy"><button type="button" data-r-mon="-1" aria-label="Oldingi oy">‹</button><span>${esc(monthLabel(month))}</span><button type="button" data-r-mon="1" aria-label="Keyingi oy"${month >= curMonth ? ' disabled' : ''}>›</button></div>
                <button type="button" class="sc-btn" data-r-jadval>Dars jadvali</button></div></div>
            <div class="tl-kpis5">
              <div class="sc-kpi"><small>Sinovlar</small><b>${rows.length}</b><span>${mgrs.size} menejer · ${[...tch.keys()].filter(k => k && k !== '__none').length} ustoz · ${upcoming} kelgusi</span></div>
              <div class="sc-kpi"><small><i class="tl-dot tl-dot--ok"></i>O'tkazildi</small><b>${done}</b><span>${waiting ? `+${waiting} natija kutilmoqda` : 'natija yozilgan'}</span></div>
              <div class="sc-kpi"><small><i class="tl-dot tl-dot--bad"></i>Lid kelmadi</small><b>${noshow}</b><span>${pct(noshow, done + noshow)}%</span></div>
              <div class="sc-kpi"><small><i class="tl-dot tl-dot--info"></i>Sotildi</small><b>${sold}</b><span>konversiya ${pct(sold, done)}% (${sold} / ${done})</span></div>
              <div class="sc-kpi${noTeacher.length ? ' sc-kpi--warn' : ''}"><small><i class="tl-dot tl-dot--warn"></i>Ustozsiz</small><b>${noTeacher.length}</b><span>${esc(noTeacher.slice(0, 2).map(x => { const a = local(x.req.scheduledAt); return a ? `${(rel(a.date) || dShort(a.date)).toLowerCase()} ${hm(a.min)}` : ''; }).filter(Boolean).join(' · ') || "hammasi biriktirilgan")}</span></div>
            </div>
            <div class="tl-g2r">
              <section class="sc-card"><header class="sc-ch"><h2>Menejerlar bo'yicha</h2></header><div class="tl-scroll"><table class="tl-table tl-rt"><thead><tr><th>Menejer</th><th class="r">Qo'ydi</th><th class="r">O'tdi</th><th class="r">Kelmadi</th><th class="r">Sotildi</th><th class="r">Konv.</th></tr></thead>
                <tbody>${mgrRows || '<tr><td colspan="6" class="tl-none">Bu oyda sinov yo\'q</td></tr>'}</tbody>
                <tfoot><tr><td>Jami</td><td class="r">${rows.length}</td><td class="r">${done}</td><td class="r">${noshow}</td><td class="r">${sold}</td><td class="r">${pct(sold, done)}%</td></tr></tfoot></table></div></section>
              <section class="sc-card"><header class="sc-ch"><h2>Ustozlar bo'yicha</h2><span class="sc-mt">sinovdan keyin sotilish</span></header><div class="tl-scroll"><table class="tl-table tl-rt"><thead><tr><th>Ustoz</th><th class="r">Sinov</th><th class="r">O'tkazdi</th><th class="r">Sotildi</th><th class="r">Tasdiq tezligi</th></tr></thead>
                <tbody>${tRows || '<tr><td colspan="5" class="tl-none">Bu oyda sinov yo\'q</td></tr>'}</tbody></table></div></section>
            </div>
            <section class="sc-card"><header class="sc-ch"><h2>Bugun e'tibor kerak · ${att.length}</h2></header>${att.map(attRow).join('') || '<p class="sc-mt sc-pad">Hammasi joyida — ustozsiz yoki natijasiz sinov yo\'q.</p>'}</section>
            <p class="sc-mt">"Qo'ydi" — shu oyga qo'yilgan barcha sinovlar (qayta qo'yilganlari ham). Konversiya = sotildi / o'tkazildi.</p>
          </div>`;
        root.querySelectorAll('[data-r-lang]').forEach(b => b.onclick = () => { R.lang = b.dataset.rLang; drawRop(); });
        root.querySelectorAll('[data-r-mon]').forEach(b => b.onclick = () => { R.month = shiftMonth(R.month, Number(b.dataset.rMon)); drawRop(); });
        root.querySelector('[data-r-jadval]').onclick = () => typeof switchTab === 'function' && switchTab('timetable');
        root.querySelectorAll('[data-r-assign]').forEach(b => b.onclick = () => openAssign(R.lang, b.dataset.rAssign, () => drawRop()));
        ropHints(noTeacher.filter(x => x.ph === 'unassigned'));
    }
    // Ustozsiz sinov uchun: shu kun sinovga ochiq eng yaqin vaqt (umumiy jadvaldan).
    async function ropHints(list) {
        const miss = list.filter(x => !(x.lead.id in R.hints) && local(x.req.scheduledAt)).slice(0, 5);
        if (!miss.length) return;
        for (const x of miss) {
            R.hints[x.lead.id] = '';
            const a = local(x.req.scheduledAt);
            try {
                const r = await api(`/api/school/schedule/free?from=${a.date}&to=${a.date}&duration=${x.dur}&lang=${R.lang}`);
                const best = (r.slots || []).map(s => ({ ...s, d: Math.abs((Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3))) - a.min) })).sort((p, q) => p.d - q.d)[0];
                R.hints[x.lead.id] = best ? (best.d === 0 ? `${shortName(person(best.teacherId)?.name)} ${best.time} sinovga ochiq` : `${hm(a.min)} da ochiq ustoz yo'q · eng yaqini ${best.time} ${shortName(person(best.teacherId)?.name)}`) : "shu kuni sinovga ochiq ustoz yo'q";
            } catch (_) { /* maslahat ixtiyoriy */ }
        }
        if (R.root?.isConnected) drawRop();
    }

    window.trialUI = { renderTeacher, renderAdmin, renderRop, openAssign, _state: { T, A, R } };
})();
