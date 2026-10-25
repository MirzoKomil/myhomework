// Marketing → "Target lidlar" oynasi.
// Ma'lumot: /api/target-ads (targetolog kiritgani + oylik reja) va CRM lidlari
// (faqat "Target" manbali). Hisob-kitob js/targetSheet.js'da.
(function () {
    'use strict';
    const S = () => window.TargetSheet;
    const state = { month: null, lang: 'english', data: null, gen: 0, view: 'days' };
    const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

    const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? ''));
    const usd = v => (v == null || !Number.isFinite(v) ? '—' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: v >= 100 ? 0 : 2, maximumFractionDigits: 2 }));
    const int = v => (v == null ? '—' : Number(v).toLocaleString('uz-UZ'));
    const pct = v => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(1).replace('.', ',') + '%');
    const dayLabel = key => `${Number(key.slice(8))}-${MONTHS[Number(key.slice(5, 7)) - 1]}`;

    function tashkentToday() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    }

    // Foydalanuvchi ko'ra oladigan til yo'nalishlari (server ham alohida tekshiradi)
    function allowedLangs(user = getCurrentUser()) {
        if (!user) return [];
        if (['admin', 'boshliq'].includes(user.role)) return ['english', 'russian'];
        if (user.role === 'rop') return [user.linkedRopLang === 'russian' ? 'russian' : 'english'];
        if (user.role === 'targetolog') return user.linkedTargetLangs?.length ? user.linkedTargetLangs : ['english'];
        return [];
    }

    function responsibleName(lang) {
        const list = (typeof getHrEmployees === 'function' ? getHrEmployees() : []) || [];
        const names = list.filter(e => e.role === 'targetolog' && e.status !== 'inactive' && (e.lang === lang || e.lang === 'both'
            || (!e.lang && lang === 'english'))).map(e => e.name).filter(Boolean);
        return names.length ? names.join(', ') : 'Targetolog';
    }

    function crmLeads(lang) {
        const all = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
        return (all[lang] || []).map(l => ({
            kind: getLeadKind(l),
            status: normalizeLeadStatus(l.status),
            dayKey: leadTashkentDayKey(l.createdAt || l.date),
            trial: !!l.trialLessonAt
        }));
    }

    async function load(month, lang) {
        return apiFetch(`/api/target-ads?language=${encodeURIComponent(lang)}&month=${encodeURIComponent(month)}`);
    }

    function monthOptions(selected) {
        const set = new Set([selected, currentMonthKey()]);
        const d = new Date(); d.setDate(1);
        for (let i = -12; i <= 1; i++) { const x = new Date(d); x.setMonth(d.getMonth() + i); set.add(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
        return [...set].sort().reverse().map(k => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(monthKeyLabel(k))}${k === currentMonthKey() ? ' (joriy)' : ''}</option>`).join('');
    }

    function canEditDay(key) {
        const p = state.data?.permissions;
        if (!p?.canEditDays || key > p.editTo) return false;
        return !p.editFrom || key >= p.editFrom;
    }

    const cls = g => (g ? ` tsx-${g}` : '');
    function ratio(fakt, plan, g) {
        if (fakt == null || !plan) return `<td class="tsx-pct">—</td>`;
        return `<td class="tsx-pct${cls(g)}">${pct(fakt / plan * 100)}</td>`;
    }

    function kpis(sh) {
        const t = sh.totals, p = sh.plan || {}, g = sh.grades;
        const card = (label, fakt, plan, gr, sub) => `<div class="tsx-kpi${cls(gr)}">
            <span class="tsx-kpi-label">${label}</span>
            <b class="tsx-kpi-val">${fakt}</b>
            <span class="tsx-kpi-sub">Reja: ${plan}${sub ? ' · ' + sub : ''}</span></div>`;
        return `<div class="tsx-kpis">
            ${card('Reklama sarfi', usd(t.budget), usd(p.budget), g.budget, sh.paceDays && p.budget ? 'kutilgan ' + usd(p.budget * sh.pace) : '')}
            ${card('Lid soni · CRM', int(t.crm.leads), int(p.lidSoni), g.crmLeads, 'kabinetda ' + int(t.adLeads))}
            ${card('Lid narxi · CRM', usd(t.crmCpl), usd(p.lidNarxi), g.crmCpl, 'kabinetda ' + usd(t.adCpl))}
            ${card('Sifatli lid · CRM', int(t.crm.qualified), int(p.kvalLidSoni), g.crmKval, t.crm.pending ? int(t.crm.pending) + ' ta hali ishlanmagan' : 'hammasi ishlangan')}
            ${card('Sifatli lid narxi · CRM', usd(t.crmKvalCpl), usd(p.kvalNarxi), g.crmKvalCpl, '')}
            ${card('Sifat % · CRM', pct(t.crmKvalPct), pct(p.kvalPct), g.crmKvalPct, 'ishlangan lidlar ichida')}
        </div>`;
    }

    function sheetTable(sh) {
        const t = sh.totals, p = sh.plan || {}, g = sh.grades;
        const owner = esc(responsibleName(state.lang));
        const days = sh.days;
        const head = days.map(d => {
            const edit = canEditDay(d.key);
            const mark = d.missing ? ' tsx-missing' : '';
            return `<th class="tsx-day${d.isToday ? ' tsx-today' : ''}${d.isFuture ? ' tsx-future' : ''}${mark}" scope="col">
                ${edit ? `<button type="button" class="tsx-day-btn" data-tsx-day="${d.key}" title="${esc(dayLabel(d.key))} — kiritish/tahrirlash">` : '<span class="tsx-day-btn is-static">'}
                <span>${String(d.day).padStart(2, '0')}.${d.key.slice(5, 7)}</span><small>${d.weekday}${d.missing ? ' · ⚠' : ''}</small>
                ${edit ? '</button>' : '</span>'}</th>`;
        }).join('');
        const cell = (v, fmt, extra = '') => `<td class="tsx-num${extra}">${v == null ? '<span class="tsx-dash">—</span>' : fmt(v)}</td>`;
        const row = (label, who, plan, fakt, pctCell, perDay, opts = {}) => `<tr class="${opts.cls || ''}">
            <th scope="row" class="tsx-sticky tsx-c1">${label}</th>
            <td class="tsx-sticky tsx-c2">${who}</td>
            <td class="tsx-sticky tsx-c3 tsx-num">${plan}</td>
            <td class="tsx-sticky tsx-c4 tsx-num tsx-fakt">${fakt}</td>
            ${pctCell}
            ${days.map(perDay).join('')}</tr>`;
        const lock = '<span class="tsx-lock" title="CRM avtomatik hisoblaydi — o‘zgartirib bo‘lmaydi">🔒 CRM</span>';
        const group = (title, note) => `<tr class="tsx-group"><th colspan="5" class="tsx-sticky tsx-group-cell">${title}<small>${note}</small></th>${days.map(() => '<td></td>').join('')}</tr>`;
        return `<div class="tsx-table-wrap" tabindex="0" aria-label="Target lidlar kunlik jadvali">
        <table class="tsx-table">
            <thead><tr>
                <th class="tsx-sticky tsx-c1" scope="col">Koʻrsatkich</th>
                <th class="tsx-sticky tsx-c2" scope="col">Masʼul</th>
                <th class="tsx-sticky tsx-c3" scope="col">Reja (oylik)</th>
                <th class="tsx-sticky tsx-c4" scope="col">Fakt</th>
                <th class="tsx-sticky tsx-c5" scope="col">%</th>
                ${head}
            </tr></thead>
            <tbody>
                ${group('Targetolog kiritadi', 'reklama kabinetidagi maʼlumot')}
                ${row('Reklama sarfi', owner, usd(p.budget), usd(t.budget), ratio(t.budget, p.budget, g.budget), d => cell(d.budget, usd, d.missing ? ' tsx-missing' : ''))}
                ${row('Fixed (doimiy)', 'Admin', usd(p.fixed || null), usd(t.fixed), '<td class="tsx-pct">—</td>', d => cell(d.fixed || null, usd))}
                ${row('Lid soni (kabinet)', owner, int(p.lidSoni), int(t.adLeads), ratio(t.adLeads, p.lidSoni, g.adLeads), d => cell(d.adLeads, int, d.missing ? ' tsx-missing' : ''))}
                ${row('Lid narxi (kabinet)', owner, usd(p.lidNarxi), usd(t.adCpl), ratio(t.adCpl, p.lidNarxi, g.adCpl), d => cell(d.adCpl, usd))}
                ${row('Sifatli lid (targetolog)', owner, int(p.kvalLidSoni), int(t.adKval), ratio(t.adKval, p.kvalLidSoni, g.adKval), d => cell(d.adKval, int))}
                ${row('Sifatli lid narxi (targetolog)', owner, usd(p.kvalNarxi), usd(t.adKvalCpl), ratio(t.adKvalCpl, p.kvalNarxi, g.adKvalCpl), d => cell(d.adKvalCpl, usd))}
                ${row('Lid → Sifatli % (targetolog)', owner, pct(p.kvalPct), pct(t.adKvalPct), ratio(t.adKvalPct, p.kvalPct, g.adKvalPct), d => cell(d.adKvalPct, pct))}
                ${group('CRM avtomatik hisoblaydi', 'Sotuv boʻlimidagi “Target” lidlar · oʻzgartirib boʻlmaydi')}
                ${row('Lid soni (CRM)', lock, int(p.lidSoni), int(t.crm.leads), ratio(t.crm.leads, p.lidSoni, g.crmLeads), d => cell(d.isFuture ? null : d.crm.leads, int), { cls: 'tsx-crm' })}
                ${row('Farq: kabinet − CRM', lock, '—', t.diff == null ? '—' : (t.diff > 0 ? '+' : '') + t.diff, '<td class="tsx-pct">—</td>',
                    d => { const lv = S().diffLevel(d.diff, d.crm.leads); return cell(d.diff, v => (v > 0 ? '+' : '') + v, lv ? ' tsx-' + lv : ''); }, { cls: 'tsx-crm' })}
                ${row('Sifatli lid (CRM)', lock, int(p.kvalLidSoni), int(t.crm.qualified), ratio(t.crm.qualified, p.kvalLidSoni, g.crmKval), d => cell(d.isFuture ? null : d.crm.qualified, int), { cls: 'tsx-crm' })}
                ${row('Sifatsiz (CRM)', lock, '—', int(t.crm.unqualified), '<td class="tsx-pct">—</td>', d => cell(d.isFuture ? null : d.crm.unqualified, int), { cls: 'tsx-crm' })}
                ${row('Hali ishlanmagan (CRM)', lock, '—', int(t.crm.pending), '<td class="tsx-pct">—</td>', d => cell(d.isFuture ? null : d.crm.pending, int, d.crm.pending ? ' tsx-warn' : ''), { cls: 'tsx-crm' })}
                ${row('Lid narxi (CRM)', lock, usd(p.lidNarxi), usd(t.crmCpl), ratio(t.crmCpl, p.lidNarxi, g.crmCpl), d => cell(d.crmCpl, usd), { cls: 'tsx-crm' })}
                ${row('Sifatli lid narxi (CRM)', lock, usd(p.kvalNarxi), usd(t.crmKvalCpl), ratio(t.crmKvalCpl, p.kvalNarxi, g.crmKvalCpl), d => cell(d.crmKvalCpl, usd), { cls: 'tsx-crm' })}
                ${row('Sifat % (CRM, ishlanganlar ichida)', lock, pct(p.kvalPct), pct(t.crmKvalPct), ratio(t.crmKvalPct, p.kvalPct, g.crmKvalPct), d => cell(d.crmKvalPct, pct), { cls: 'tsx-crm' })}
                ${row('Sinovga yozilgan (CRM)', lock, '—', int(t.crm.trial), '<td class="tsx-pct">—</td>', d => cell(d.isFuture ? null : d.crm.trial, int), { cls: 'tsx-crm' })}
                ${row('Sotuv (CRM)', lock, '—', int(t.crm.sold), '<td class="tsx-pct">—</td>', d => cell(d.isFuture ? null : d.crm.sold, int), { cls: 'tsx-crm' })}
            </tbody>
        </table></div>`;
    }

    function managersTable(lang, monthKey) {
        if (typeof computeTargetManagerStats !== 'function' || typeof getSalesManagers !== 'function') return '';
        const all = getItem(STORAGE_KEYS.leads, { english: [], russian: [] })[lang] || [];
        const managers = getSalesManagers(lang).filter(m => m.login).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uz'));
        if (!managers.length) return '';
        const rows = managers.map(m => {
            const leadsCount = all.filter(l => getLeadKind(l) === 'target' && l.managerId === m.id && (l.createdAt || l.date)
                && leadTashkentDayKey(l.createdAt || l.date)?.slice(0, 7) === monthKey).length;
            const s = computeTargetManagerStats(m.id, all, monthKey);
            return `<tr><th scope="row">${esc(m.name)}</th><td>${int(leadsCount)}</td><td>${int(s.kval)}</td><td>${int(s.sinov)}</td>
                <td>${int(s.sotuv)}${s.planSotuv != null ? ` <small>/ ${int(s.planSotuv)}</small>` : ''}</td><td>${s.summaM ? s.summaM + ' mln' : '—'}</td><td>${s.kvalPct ? pct(s.kvalPct) : '—'}</td></tr>`;
        }).join('');
        return `<details class="tsx-managers"><summary>Sotuv menejerlari · faqat target lidlar natijasi</summary>
            <div class="tsx-table-wrap"><table class="tsx-mini">
            <thead><tr><th>Menejer</th><th>Target lid</th><th>Sifatli</th><th>Sinov</th><th>Sotuv / reja</th><th>Summa</th><th>Sifatli → sotuv</th></tr></thead>
            <tbody>${rows}</tbody></table></div></details>`;
    }

    function alerts(sh) {
        const out = [];
        const p = state.data?.permissions || {};
        const y = sh.yesterday;
        if (y.slice(0, 7) === sh.monthKey && !state.data.days[y]) {
            out.push(`<div class="tsx-alert is-warn">⚠ Kecha (${esc(dayLabel(y))}) uchun reklama maʼlumoti kiritilmagan.
                ${p.canEditDays && canEditDay(y) ? `<button type="button" class="btn-primary-sm" data-tsx-day="${y}">Hozir kiritish</button>` : ''}</div>`);
        }
        const missing = sh.totals.missingDays.filter(k => k !== y);
        if (missing.length) out.push(`<div class="tsx-alert">Kiritilmagan kunlar: ${missing.map(k => Number(k.slice(8))).join(', ')}. Bu kunlarning CRM lidlari narx hisobiga qoʻshilmaydi.</div>`);
        if (!sh.plan) out.push(`<div class="tsx-alert">Bu oy uchun reja kiritilmagan — % ustuni boʻsh qoladi.${p.canEditPlan ? ' <button type="button" class="btn-ghost" data-tsx-plan>Rejani kiritish</button>' : ''}</div>`);
        const bigDiff = sh.days.filter(d => S().diffLevel(d.diff, d.crm.leads) === 'bad');
        if (bigDiff.length) out.push(`<div class="tsx-alert is-bad">Kabinet va CRM lid soni sezilarli farq qilgan kunlar: ${bigDiff.map(d => `${d.day} (${d.diff > 0 ? '+' : ''}${d.diff})`).join(', ')}. Lidlar CRM'ga yetib kelmayotgan yoki ikki marta sanalgan boʻlishi mumkin.</div>`);
        return out.join('');
    }

    function legend() {
        return `<details class="tsx-legend"><summary>Qanday hisoblanadi?</summary><ul>
            <li><b>Targetolog kiritadi</b> — har kuni kechagi kun uchun: reklama sarfi ($), reklama kabinetidagi lid soni, oʻzi sanagan sifatli lid soni. Targetolog faqat oxirgi 7 kunni kirita/tuzata oladi, eski kunlarni admin tuzatadi. Har bir oʻzgarish tarixga yoziladi.</li>
            <li><b>🔒 CRM</b> — shu kuni CRM'ga tushgan “Target” manbali lidlar (Tashkent vaqti bilan). Organik lidlar kirmaydi. Bu qatorlarni hech kim qoʻlda oʻzgartira olmaydi.</li>
            <li><b>Sifatli lid (CRM)</b> — “Bogʻlanildi” va undan keyingi bosqichdagi lidlar (sinov, qaror, toʻlov, muvaffaqiyatsiz sotuv ham). <b>Sifatsiz</b> — “Sifatsiz lidlar” ustuni. <b>Hali ishlanmagan</b> — “Yangi lidlar” va “Bogʻlanishga urinilmoqda”; ular ishlanganda sifat raqamlari oʻzgaradi.</li>
            <li><b>Lid narxi</b> = reklama sarfi ÷ lid soni. CRM narxida faqat sarfi kiritilgan kunlarning lidlari olinadi. Fixed narxga qoʻshilmaydi.</li>
            <li><b>Rang</b>: sarf va soni — oyning <i>kechagacha</i> oʻtgan qismiga nisbatan kutilgan temp (yashil ≥100%, sariq ≥80%; sarfda ±10% yashil, ±25% sariq); narx — rejadan past/teng yashil, 15% gacha qimmat sariq; foiz — rejaga nisbatan.</li>
            <li><b>Farq</b> = kabinetdagi lid soni − CRM'dagi target lid soni. 2 tadan va 10% dan ortiq farq qizil.</li>
        </ul></details>`;
    }

    async function render(el, lang) {
        if (!el || !window.TargetSheet) return;
        const langs = allowedLangs();
        if (!langs.length) { el.innerHTML = '<div class="tsx-empty">Bu boʻlimga ruxsat yoʻq</div>'; return; }
        state.lang = langs.includes(lang) ? lang : langs[0];
        if (!MONTH_KEY_RE.test(String(state.month || ''))) state.month = currentMonthKey();
        const gen = ++state.gen, month = state.month, selLang = state.lang;
        if (!state.data || state.data.month !== month || state.data.language !== selLang) el.innerHTML = '<div class="tsx-empty">Yuklanmoqda…</div>';
        let data;
        try { data = await load(month, selLang); }
        catch (e) { if (gen === state.gen) el.innerHTML = `<div class="tsx-empty is-bad">${esc(e.message || 'Maʼlumotni yuklab boʻlmadi')}</div>`; return; }
        if (gen !== state.gen) return;
        state.data = data;
        const sh = S().buildSheet({ monthKey: month, today: data.today || tashkentToday(), entries: data.days || {}, plan: data.plan, leads: crmLeads(selLang) });
        const p = data.permissions || {};
        const y = sh.yesterday;
        el.innerHTML = `<div class="tsx-wrap">
            <div class="tsx-toolbar">
                <div class="tsx-toolbar-left">
                    <select id="tsxMonth" class="form-control-sm" aria-label="Oy">${monthOptions(month)}</select>
                    <span class="tsx-meta">${sh.lastEntered ? 'Oxirgi kiritilgan: ' + esc(dayLabel(sh.lastEntered)) : 'Bu oyda hali kiritilmagan'} · ${sh.totals.enteredDays}/${sh.paceDays || 0} kun</span>
                </div>
                <div class="tsx-toolbar-right">
                    ${p.canEditDays && y.slice(0, 7) === month && canEditDay(y) ? `<button type="button" class="btn-primary-sm" data-tsx-day="${y}">${data.days[y] ? 'Kechagini tahrirlash' : '+ Kechagi kunni kiritish'}</button>` : ''}
                    ${p.canEditPlan ? '<button type="button" class="btn-ghost" data-tsx-plan>Oylik reja</button>' : ''}
                </div>
            </div>
            ${alerts(sh)}
            ${kpis(sh)}
            ${sheetTable(sh)}
            ${legend()}
            ${managersTable(selLang, month)}
        </div>`;
        el.querySelector('#tsxMonth')?.addEventListener('change', e => { state.month = e.target.value; render(el, state.lang); });
        el.querySelectorAll('[data-tsx-day]').forEach(b => b.addEventListener('click', () => openDay(el, b.dataset.tsxDay, sh)));
        el.querySelectorAll('[data-tsx-plan]').forEach(b => b.addEventListener('click', () => openPlan(el)));
        // Bugungi kun ustuniga avtomatik surish
        const wrap = el.querySelector('.tsx-table-wrap');
        const todayTh = el.querySelector('.tsx-today') || el.querySelector(`[data-tsx-day="${y}"]`)?.closest('th');
        if (wrap && todayTh) wrap.scrollLeft = Math.max(0, todayTh.offsetLeft - wrap.clientWidth * 0.6);
    }

    function openDay(el, key, sh) {
        const e = state.data.days[key] || {};
        const d = sh.days.find(x => x.key === key);
        const c = d?.crm || { leads: 0, qualified: 0, unqualified: 0, pending: 0 };
        const changed = e.updatedAt ? `<p class="tsx-modal-note">Oxirgi oʻzgartirgan: ${esc(e.updatedBy || '—')}, ${esc(new Date(e.updatedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }))}</p>` : '';
        openModal(`${dayLabel(key)} — target maʼlumoti`, `
            <div class="tsx-modal">
                <div class="tsx-modal-form">
                    <label class="form-group"><span>Reklama sarfi ($)</span><input type="number" id="tsxBudget" class="form-control" min="0" step="0.01" inputmode="decimal" value="${e.budget ?? ''}"></label>
                    <label class="form-group"><span>Reklama kabinetidagi lid soni</span><input type="number" id="tsxLeads" class="form-control" min="0" step="1" inputmode="numeric" value="${e.leadCount ?? ''}"></label>
                    <label class="form-group"><span>Siz sanagan sifatli lid soni <small>(ixtiyoriy)</small></span><input type="number" id="tsxKval" class="form-control" min="0" step="1" inputmode="numeric" value="${e.kvalLeadCount ?? ''}"></label>
                    <label class="form-group"><span>Izoh <small>(ixtiyoriy)</small></span><input type="text" id="tsxNote" class="form-control" maxlength="300" value="${esc(e.note || '')}" placeholder="masalan: yangi kreativ ishga tushdi"></label>
                    <div class="tsx-preview" id="tsxPreview"></div>
                    ${changed}
                </div>
                <aside class="tsx-crm-box" aria-label="CRM maʼlumoti">
                    <b>🔒 CRM shu kuni</b>
                    <dl>
                        <div><dt>Target lidlar</dt><dd>${int(c.leads)}</dd></div>
                        <div><dt>Sifatli</dt><dd>${int(c.qualified)}</dd></div>
                        <div><dt>Sifatsiz</dt><dd>${int(c.unqualified)}</dd></div>
                        <div><dt>Hali ishlanmagan</dt><dd>${int(c.pending)}</dd></div>
                    </dl>
                    <small>Bu raqamlar Sotuv boʻlimidan avtomatik olinadi va oʻzgarmaydi.</small>
                </aside>
            </div>`,
            `<button type="button" class="btn-ghost" id="tsxCancel">Bekor qilish</button>
             <button type="button" class="btn-primary-sm" id="tsxSave">Saqlash</button>`, { wide: true });
        const val = id => document.getElementById(id).value.trim();
        const preview = () => {
            const b = Number(val('tsxBudget')), n = Number(val('tsxLeads')), k = val('tsxKval') === '' ? null : Number(val('tsxKval'));
            const parts = [];
            if (val('tsxBudget') !== '' && n > 0) parts.push(`Lid narxi: <b>${usd(b / n)}</b>`);
            if (val('tsxBudget') !== '' && c.leads > 0) parts.push(`CRM boʻyicha: <b>${usd(b / c.leads)}</b>`);
            if (val('tsxLeads') !== '') {
                const diff = n - c.leads, lv = S().diffLevel(diff, c.leads);
                parts.push(`<span class="${lv ? 'tsx-' + lv : ''}">Farq (kabinet − CRM): <b>${diff > 0 ? '+' : ''}${diff}</b></span>`);
            }
            if (k != null && val('tsxLeads') !== '' && k > n) parts.push('<span class="tsx-bad">Sifatli lid jami liddan koʻp boʻlishi mumkin emas</span>');
            document.getElementById('tsxPreview').innerHTML = parts.join(' · ');
        };
        ['tsxBudget', 'tsxLeads', 'tsxKval'].forEach(id => document.getElementById(id).addEventListener('input', preview));
        preview();
        document.getElementById('tsxBudget').focus();
        document.getElementById('tsxCancel').onclick = closeModal;
        document.getElementById('tsxSave').onclick = async () => {
            if (val('tsxBudget') === '' || val('tsxLeads') === '') { alert('Reklama sarfi va lid sonini kiriting. Nol boʻlsa 0 yozing.'); return; }
            const body = { language: state.lang, kind: 'day', date: key, revision: e.revision || 0,
                data: { budget: Number(val('tsxBudget')), leadCount: Number(val('tsxLeads')), kvalLeadCount: val('tsxKval') === '' ? null : Number(val('tsxKval')), note: val('tsxNote') } };
            const btn = document.getElementById('tsxSave'); btn.disabled = true;
            try {
                await apiFetch('/api/target-ads', { method: 'PUT', body: JSON.stringify(body) });
                closeModal(); showMiniToast('Saqlandi'); render(el, state.lang);
            } catch (err) { alert(err.message); if (btn.isConnected) btn.disabled = false; }
        };
    }

    function openPlan(el) {
        const p = state.data.plan || {};
        openModal(`Oylik reja — ${monthKeyLabel(state.month)} · ${state.lang === 'russian' ? 'Rus tili' : 'Ingliz tili'}`, `
            <div style="display:flex;flex-direction:column;gap:12px">
                <label class="form-group"><span>Reklama byudjeti ($)</span><input type="number" id="tsxPBudget" class="form-control" min="0" step="0.01" value="${p.budget ?? ''}"></label>
                <label class="form-group"><span>Fixed — doimiy oylik xarajat ($) <small>(masalan, targetolog xizmati)</small></span><input type="number" id="tsxPFixed" class="form-control" min="0" step="0.01" value="${p.fixed ?? ''}"></label>
                <label class="form-group"><span>Lid soni</span><input type="number" id="tsxPLeads" class="form-control" min="0" step="1" value="${p.lidSoni ?? ''}"></label>
                <label class="form-group"><span>Sifatli lid soni</span><input type="number" id="tsxPKval" class="form-control" min="0" step="1" value="${p.kvalLidSoni ?? ''}"></label>
                <div class="tsx-preview" id="tsxPPreview"></div>
                ${p.updatedAt ? `<p class="tsx-modal-note">Oxirgi oʻzgartirgan: ${esc(p.updatedBy || '—')}, ${esc(new Date(p.updatedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }))}</p>` : ''}
            </div>`,
            `<button type="button" class="btn-ghost" id="tsxPCancel">Bekor qilish</button><button type="button" class="btn-primary-sm" id="tsxPSave">Saqlash</button>`);
        const v = id => document.getElementById(id).value.trim();
        const preview = () => {
            const b = Number(v('tsxPBudget')), n = Number(v('tsxPLeads')), k = Number(v('tsxPKval'));
            document.getElementById('tsxPPreview').innerHTML = [
                n ? `Lid narxi: <b>${usd(b / n)}</b>` : '', k ? `Sifatli lid narxi: <b>${usd(b / k)}</b>` : '', n ? `Sifat %: <b>${pct(k / n * 100)}</b>` : ''
            ].filter(Boolean).join(' · ');
        };
        ['tsxPBudget', 'tsxPLeads', 'tsxPKval'].forEach(id => document.getElementById(id).addEventListener('input', preview));
        preview();
        document.getElementById('tsxPCancel').onclick = closeModal;
        document.getElementById('tsxPSave').onclick = async () => {
            if (['tsxPBudget', 'tsxPLeads', 'tsxPKval'].some(id => v(id) === '')) { alert('Byudjet, lid soni va sifatli lid sonini kiriting. Nol boʻlsa 0 yozing.'); return; }
            const body = { language: state.lang, kind: 'plan', date: state.month, revision: p.revision || 0,
                data: { budget: Number(v('tsxPBudget')), fixed: v('tsxPFixed') === '' ? 0 : Number(v('tsxPFixed')), lidSoni: Number(v('tsxPLeads')), kvalLidSoni: Number(v('tsxPKval')) } };
            const btn = document.getElementById('tsxPSave'); btn.disabled = true;
            try {
                await apiFetch('/api/target-ads', { method: 'PUT', body: JSON.stringify(body) });
                closeModal(); showMiniToast('Reja saqlandi'); render(el, state.lang);
            } catch (err) { alert(err.message); if (btn.isConnected) btn.disabled = false; }
        };
    }

    window.targetMonitorUI = { render, allowedLangs };
})();
