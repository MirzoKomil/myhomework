// Jarimalar — admin sozlamalari (dizayn J05 · JarAdmin). CRM → Moliya → Jarimalar (kompyuter va telefon).
// Har rol uchun qoidalar (summa, 1-marta ogohlantirish, faol), yangi qoida, yumshoq qoidalar, yuvish narxlari,
// o'zgarishlar tarixi. Saqlash keyingi oyning 1-sanasidan kuchga kiradi — orqaga qarab ishlamaydi. API: /api/fines/admin/config
(function () {
    'use strict';
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const dG = d => `${Number(d.slice(8))}-${MON[Number(d.slice(5, 7)) - 1]}`;
    const S = { data: null, draft: null, role: 'sales', msg: '', bad: false, busy: false };
    const stamp = v => { const d = new Date(new Date(v).getTime() + 5 * 3600000); return `${d.getUTCDate()}-${MON[d.getUTCMonth()].slice(0, 3)}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
    const sw = (attrs, on, label) => `<label class="jra-sw"><input type="checkbox" ${attrs} ${on ? 'checked' : ''} aria-label="${esc(label)}"><span aria-hidden="true"></span></label>`;
    const SOFT = [['graceMinutes', 'Imtiyoz daqiqalari', 'Shu vaqtgacha kechikish hisoblanmaydi', 'daq'], ['capPercent', 'Oylik jarima chegarasi', 'Maoshning ulushi — undan oshmaydi', '%'],
        ['cleanMonthBonus', '“Toza oy” bonusi', 'Oy davomida bitta ham jarima yoʻq', 'soʻm'], ['appealDays', 'Eʼtiroz muddati', 'Xodim shu muddatda eʼtiroz yozadi', 'kun']];
    const WASH = [['washHour', '1 soat qoʻshimcha ish', 'Yuz bilan belgilangan vaqt', 'soʻm'], ['washSunday', 'Yakshanba navbatchiligi (4 soat)', '', 'soʻm'],
        ['washStreakCount', '10 ish kuni ketma-ket vaqtida', 'Avtomatik yuviladi', 'jarima'], ['washLearning', 'Oʻrganish (skript + test)', 'Oyiga 1 marta', 'soʻm'],
        ['absentWashPercent', 'Sababsiz kelmaslik — yuvish limiti', '', '%']];

    function root() { return document.getElementById('jarimaAdminRoot'); }
    async function load() {
        const el = root(); if (!el) return;
        el.innerHTML = '<div class="jra"><div class="fin-skel" style="height:240px;border-radius:20px;background:var(--bg-secondary,#EEF2F8)"></div></div>';
        try {
            S.data = await apiFetch('/api/fines/admin/config', { fresh: true });
            S.draft = JSON.parse(JSON.stringify(S.data.draft));
            S.msg = ''; paint();
        } catch (e) { el.innerHTML = `<div class="jra"><div class="jra-card"><strong>Yuklab boʻlmadi</strong><p>${esc(e.message)}</p><button type="button" class="jra-save" data-jra-reload>Qayta urinish</button></div></div>`; }
    }
    function paint() {
        const el = root(); if (!el || !S.draft) return;
        const d = S.draft, labels = S.data.labels, rules = d.roles[S.role] || [];
        el.innerHTML = `<div class="jra">
          <div class="jra-head"><div><small>Admin · Sozlamalar</small><h1>Jarima va ragʻbat</h1><p>Summalar hamma kabinetdagi “Jarimalar roʻyxati”ga chiqadi. Oʻzgarishlar orqaga qarab ishlamaydi.${S.data.hasPending ? ` <b>${dG(S.data.effectiveFrom)}dan kuchga kiradigan saqlangan oʻzgarish bor.</b>` : ''}</p></div>
            <button type="button" class="jra-save" data-jra-save ${S.busy ? 'disabled' : ''}>Saqlash · ${dG(S.data.effectiveFrom)}dan kuchga kiradi</button></div>
          ${S.msg ? `<p class="jra-msg${S.bad ? ' is-bad' : ''}" role="status">${esc(S.msg)}</p>` : ''}
          <div class="jra-grid"><div class="jra-card">
            <div class="jra-tabs" role="tablist" aria-label="Rol">${S.data.roles.map(r => `<button type="button" role="tab" aria-selected="${r === S.role}" class="${r === S.role ? 'is-on' : ''}" data-jra-role="${r}">${esc(labels[r])}</button>`).join('')}</div>
            <table class="jra-table"><thead><tr><th>Qoida · ${esc(labels[S.role].toUpperCase())}</th><th>Summa</th><th>1-marta ogohlantirish</th><th>Faol</th></tr></thead><tbody>
              ${rules.map((r, i) => `<tr><td>${r.kind && r.kind !== 'work' ? `<strong>${esc(r.label)}</strong>` : `<input type="text" value="${esc(r.label)}" maxlength="120" data-jra-label="${i}" aria-label="Qoida nomi">`}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</td>
                <td><input type="number" min="0" step="1000" value="${r.amount}" data-jra-amount="${i}" aria-label="${esc(r.label)} summasi"><span class="jra-unit">soʻm</span></td>
                <td>${r.kind === 'late' ? sw(`data-jra-warn="${i}"`, r.warnFirst, '1-marta ogohlantirish') : '<small>—</small>'}</td>
                <td>${sw(`data-jra-active="${i}"`, r.active, 'Faol')}</td></tr>`).join('')}
            </tbody></table>
            <button type="button" class="jra-add" data-jra-add>+ Qoida qoʻshish</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:18px">
            <div class="jra-card"><h2>Yumshoq qoidalar</h2><div class="jra-soft">${SOFT.map(([k, t, s, u]) => `<div><span><strong>${t}</strong>${s ? `<small>${s}</small>` : ''}</span><span>${k === 'cleanMonthBonus' ? sw('data-jra-clean', d.soft.cleanMonthOn, '“Toza oy” yoqilgan') : ''}<input class="jra-num" type="number" min="0" value="${d.soft[k]}" data-jra-soft="${k}" aria-label="${esc(t)}"><span class="jra-unit">${u}</span></span></div>`).join('')}</div></div>
            <div class="jra-card"><h2>Jarima yuvish narxlari</h2><div class="jra-soft">${WASH.map(([k, t, s, u]) => `<div><span><strong>${t}</strong>${s ? `<small>${s}</small>` : ''}</span><span><input class="jra-num" type="number" min="0" value="${d.soft[k]}" data-jra-soft="${k}" aria-label="${esc(t)}"><span class="jra-unit">${u}</span></span></div>`).join('')}</div></div>
            <div class="jra-card"><h2>Oʻzgarishlar tarixi</h2>${S.data.history.length ? `<ul class="jra-hist">${S.data.history.map(h => `<li>${esc(h.actor_name || 'Admin')} · ${esc(h.text)}<small>${esc(stamp(h.created_at))} · ${dG(h.effective)}dan</small></li>`).join('')}</ul>` : '<small>Hali oʻzgarish yoʻq</small>'}</div>
          </div></div></div>`;
    }
    function onEvent(e) {
        const el = root(); if (!el || !el.contains(e.target)) return;
        const t = e.target, d = t.dataset, rules = S.draft?.roles[S.role];
        if (e.type === 'click') {
            const b = t.closest('button'); if (!b) return;
            if ('jraReload' in b.dataset) return load();
            if ('jraRole' in b.dataset) { S.role = b.dataset.jraRole; return paint(); }
            if ('jraAdd' in b.dataset) { rules.push({ code: 'custom_' + Date.now().toString(36), kind: 'work', label: 'Yangi qoida', sub: '', amount: 10000, active: true, warnFirst: false }); return paint(); }
            if ('jraSave' in b.dataset) return save();
            return;
        }
        if ('jraAmount' in d) rules[d.jraAmount].amount = Number(t.value) || 0;
        if ('jraLabel' in d) rules[d.jraLabel].label = t.value;
        if ('jraWarn' in d) rules[d.jraWarn].warnFirst = t.checked;
        if ('jraActive' in d) rules[d.jraActive].active = t.checked;
        if ('jraSoft' in d) S.draft.soft[d.jraSoft] = Number(t.value) || 0;
        if ('jraClean' in d) S.draft.soft.cleanMonthOn = t.checked;
    }
    async function save() {
        S.busy = true; paint();
        try {
            const r = await apiFetch('/api/fines/admin/config', { method: 'PUT', body: JSON.stringify(S.draft) });
            S.busy = false;
            if (!r.saved) { S.msg = 'Oʻzgarish yoʻq'; S.bad = false; paint(); return; }
            await load();
            S.msg = `Saqlandi — ${dG(r.effective)}dan kuchga kiradi (${r.changes.length} ta oʻzgarish)`; S.bad = false; paint();
        } catch (e) { S.busy = false; S.msg = e.message; S.bad = true; paint(); }
    }
    document.addEventListener('click', onEvent);
    document.addEventListener('change', onEvent);
    window.jarimaAdmin = { render: load };
})();
