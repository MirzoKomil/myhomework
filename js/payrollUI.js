(function () {
    'use strict';
    const state = { period: null, mode: 'calendar', month: '', config: null, revision: null, result: null, seq: 0, lang: '', dirty: false };
    const labels = payrollEngine.ROLES;
    const money = value => Math.round(Number(value) || 0).toLocaleString('en-US').replaceAll(',', ' ') + ' so‘m';
    const esc = value => escapeHtml(String(value ?? ''));
    function currentPeriod() {
        if (!state.period) {
            const d = new Date(); state.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const end = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0)).toISOString().slice(0, 10);
            state.period = payrollEngine.period(state.month + '-01', end);
        }
        return state.period;
    }
    function inputBody() { return { ...currentPeriod(), language: _financeLang }; }
    function api(path, body, method = 'POST') { return apiFetch('/api/payroll/' + path, body ? { method, body: JSON.stringify(body) } : {}); }
    function rootFor(section) { return document.getElementById(section === 'kpi' ? 'payrollKpiRoot' : 'payrollRoot'); }
    function toolbar(root, section) {
        if (root.dataset.payrollMounted) return;
        root.dataset.payrollMounted = '1';
        const p = currentPeriod();
        root.innerHTML = `<div class="payroll-toolbar">
            <label>Davr turi<select data-payroll-mode class="form-control-sm"><option value="calendar">Kalendar oyi</option><option value="custom">Moslashuvchan davr</option></select></label>
            <label data-payroll-month-wrap>Oy<input type="month" data-payroll-month class="form-control-sm" value="${state.month}"></label>
            <label>Boshlanish<input type="date" data-payroll-start class="form-control-sm" value="${p.start}" disabled></label>
            <label>Tugash (shu kun ham)<input type="date" data-payroll-end class="form-control-sm" value="${p.end}" disabled></label>
            <button class="btn-secondary-sm" data-payroll-refresh>Yangilash</button>
        </div><p class="text-muted payroll-note">Maosh serverdagi to‘langan bitimlar, bonuslar va davomatdan hisoblanadi. Moslashuvchan davrda ikkala sana ham hisobga olinadi.</p>
        <div class="payroll-message" role="status"></div><div data-payroll-body></div>`;
        root.querySelector('[data-payroll-refresh]').onclick = () => load(section, true);
        root.querySelector('[data-payroll-mode]').onchange = event => {
            state.mode = event.target.value;
            root.querySelectorAll('[data-payroll-start],[data-payroll-end]').forEach(el => { el.disabled = state.mode !== 'custom'; });
            root.querySelector('[data-payroll-month-wrap]').hidden = state.mode !== 'calendar';
        };
        const changed = () => {
            try {
                if (state.mode === 'calendar') {
                    const month = root.querySelector('[data-payroll-month]').value;
                    if (!/^\d{4}-\d{2}$/.test(month)) throw Error('Oyni tanlang');
                    const [y, m] = month.split('-').map(Number);
                    state.month = month;
                    state.period = payrollEngine.period(month + '-01', new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10));
                    root.querySelector('[data-payroll-start]').value = state.period.start;
                    root.querySelector('[data-payroll-end]').value = state.period.end;
                } else state.period = payrollEngine.period(root.querySelector('[data-payroll-start]').value, root.querySelector('[data-payroll-end]').value);
                load(section, true);
            } catch (e) { message(root, e.message, true); }
        };
        root.querySelectorAll('[data-payroll-month],[data-payroll-start],[data-payroll-end]').forEach(el => { el.onchange = changed; });
    }
    function message(root, value, failed = false) {
        const el = root.querySelector('.payroll-message'); if (!el) return;
        el.textContent = value; el.classList.toggle('payroll-message--error', failed);
    }
    async function load(section, force = false) {
        const root = rootFor(section); if (!root) return;
        toolbar(root, section);
        const request = ++state.seq, lang = _financeLang;
        message(root, 'Hisoblanmoqda…');
        try {
            const p = currentPeriod(), query = new URLSearchParams({ start: p.start, end: p.end, language: lang });
            const [result, config] = await Promise.all([api('preview?' + query), api('settings?language=' + lang)]);
            if (request !== state.seq || lang !== _financeLang) return;
            state.result = result;
            // Polling must not replace fields/scroll position while the admin is reading or editing.
            if (section === 'kpi' && root.querySelector('form') && state.lang === lang && !force) {
                message(root, config.revision !== state.revision ? 'KPI sozlamalari yangilangan. Yangi qiymatlarni olish uchun Yangilash tugmasini bosing.' : result.warnings.join(' · '));
                return;
            }
            if (section !== 'kpi' || !state.dirty || state.lang !== lang || force) {
                state.config = config.data; state.revision = config.revision; state.lang = lang; state.dirty = false;
                if (section === 'kpi') renderSettings(root, config);
                else {
                    const fingerprint = JSON.stringify(result);
                    if (force || root.dataset.payrollFingerprint !== fingerprint) renderPayroll(root, result);
                    root.dataset.payrollFingerprint = fingerprint;
                }
            }
            message(root, result.warnings.length ? result.warnings.join(' · ') : 'Server ma’lumotlari yangilandi');
        } catch (e) { if (request === state.seq) message(root, e.message, true); }
    }
    function renderPayroll(root, result) {
        const body = root.querySelector('[data-payroll-body]');
        body.innerHTML = `<div class="payroll-heading"><h3>Maoshlar — ${esc(result.period.start)} – ${esc(result.period.end)}</h3>
            <button class="btn-primary-sm" data-payroll-accrue>Maoshlarni shakllantirish</button></div>
            <p class="payroll-note">Jami: <strong>${money(result.total)}</strong>. “Berildi” faqat pul haqiqatan berilgach belgilanadi. Bu tugma kassadan avtomatik pul yechmaydi.</p>
            <div class="payroll-table-wrap"><table class="payroll-table"><thead><tr><th>Xodim</th><th>Davr</th><th>Asosiy parametrlar</th><th>Bonus / qo‘shimcha</th><th>Jami</th><th>Holat</th></tr></thead><tbody>
            ${result.rows.map(row => `<tr>
                <td data-label="Xodim"><div class="payroll-person">${row.avatar ? `<img src="${esc(row.avatar)}" alt="">` : '<span class="payroll-avatar">👤</span>'}<div><strong>${esc(row.name)}</strong><small>${esc(row.roleLabel)}</small></div></div></td>
                <td data-label="Davr">${esc(result.period.start)}<br>${esc(result.period.end)}</td>
                <td data-label="Parametrlar">Fiksa: ${money(row.fixed)}<br>${row.role === 'sales' || row.role === 'rop' ? `Aylanma: ${money(row.turnover)}<br>Ulush: ${money(row.commission)}` : `${row.studentCount || 0} o‘quvchi · ${row.lessons || 0} dars`}
                    ${row.role === 'rop' ? `<br>Toza aylanma: ${money(row.cleanTurnover)}<br>Reja: ${Number(row.completion).toFixed(1)}% · ulush ${row.rate}%${row.blocked ? '<p class="payroll-alert">Reja tasdiqlanmagan</p>' : ''}` : ''}
                    ${row.breakdown?.length ? `<details><summary>O‘quvchilar bo‘yicha</summary>${row.breakdown.map(b => `<p>${esc(b.name)} · ${esc(b.month)}: ${b.lessons}/${b.expected} dars → ${money(b.earned)}</p>`).join('')}</details>` : ''}</td>
                <td data-label="Bonus">${money(row.bonus)}</td><td data-label="Jami"><strong>${money(row.total)}</strong>${row.frozen ? '<small>To‘langan hisob saqlangan</small>' : ''}</td>
                <td data-label="Holat"><span class="badge ${row.status === 'paid' ? 'badge-success' : ''}">${row.status === 'paid' ? 'Berildi' : 'Berilmadi'}</span>
                    ${row.status !== 'paid' ? `<button class="btn-secondary-sm" data-payroll-paid="${esc(row.transactionId || '')}" ${!row.transactionId || row.stale || row.blocked ? 'disabled' : ''}>Berildi deb belgilash</button>${row.stale ? '<small>Qayta shakllantirish kerak</small>' : ''}` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Mos xodimlar topilmadi</td></tr>'}
            </tbody></table></div>`;
        body.querySelector('[data-payroll-accrue]').onclick = event => action(root, event.currentTarget, async () => {
            await api('accrue', { ...inputBody(), sourceHash: result.sourceHash }); await load('maoshlar', true);
        });
        body.querySelectorAll('[data-payroll-paid]').forEach(button => { button.onclick = () => {
            if (!confirm('Pul xodimga haqiqatan berildimi? Hisob bundan keyin o‘zgarmaydi. Kassadan pul yechilmaydi.')) return;
            action(root, button, async () => { await api('transactions/' + encodeURIComponent(button.dataset.payrollPaid) + '/paid', {}); await load('maoshlar', true); });
        }; });
    }
    function numberInput(label, name, value, options = '') {
        const currency = label.includes('so‘m');
        const display = currency && Number.isFinite(Number(value)) ? money(value).replace(' so‘m', '') : value;
        return `<label>${esc(label)}<input class="form-control-sm" type="${currency ? 'text' : 'number'}" inputmode="decimal" min="0" step="any" name="${esc(name)}" value="${esc(display)}" ${options}></label>`;
    }
    function tierRows(config, role) {
        return config[role].tiers.map((t, i, all) => `<div class="payroll-tier" data-tier="${i}">
            ${numberInput(role === 'sales' ? 'Aylanma ≥ (so‘m)' : 'Reja ≤ (%)', 'tier-bound', role === 'sales' ? t.from : (t.upTo ?? ''), role === 'rop' && i === all.length - 1 ? 'disabled placeholder="Cheksiz"' : '')}
            ${numberInput(role === 'sales' ? 'Fiksa (so‘m)' : 'Ulush (%)', 'tier-value', role === 'sales' ? t.fixed : t.rate)}
            <button type="button" class="btn-danger-sm" data-remove-tier="${role}:${i}" ${all.length <= 1 || (role === 'rop' && i === all.length - 1) ? 'disabled' : ''}>O‘chirish</button></div>`).join('');
    }
    function renderSettings(root, config) {
        const result = state.result, c = config.data, body = root.querySelector('[data-payroll-body]');
        const bonusList = typeof _allBonusList === 'function' ? _allBonusList() : [];
        const bonuses = new Map(bonusList.map(b => [b.id, b.label]));
        Object.keys(c.bonusAmounts).forEach(id => { if (!bonuses.has(id)) bonuses.set(id, id); });
        body.innerHTML = `<form data-payroll-settings><div class="payroll-heading"><h3>KPI shablonlari</h3><button class="btn-primary-sm" type="submit">Sozlamalarni saqlash</button></div>
            <div class="payroll-config-grid">
            <section class="card payroll-config"><h3>${labels.sales}</h3>${numberInput('Shaxsiy sotuv ulushi (%)', 'sales.commission', c.sales.commission)}<div data-tiers="sales">${tierRows(c, 'sales')}</div><button type="button" class="btn-secondary-sm" data-add-tier="sales">+ Pog‘ona</button></section>
            <section class="card payroll-config"><h3>${labels.rop}</h3><label><input type="checkbox" name="rop.hasFixed" ${c.rop.hasFixed ? 'checked' : ''}> Fiksa mavjudmi?</label><div data-rop-fixed ${c.rop.hasFixed ? '' : 'hidden'}>${numberInput('Oylik fiksa (so‘m)', 'rop.fixed', c.rop.fixed)}</div>
                ${numberInput('Eng kam reja bajarilishi (%)', 'rop.minCompletion', c.rop.minCompletion)}<p class="payroll-note">Chegaradan yuqori natija keyingi pog‘onaga o‘tadi; oxirgi pog‘ona cheksiz.</p><div data-tiers="rop">${tierRows(c, 'rop')}</div><button type="button" class="btn-secondary-sm" data-add-tier="rop">+ Pog‘ona</button>
                <div class="payroll-plan">O‘rtacha sotuv rejasi: <strong>${result.plan.current == null ? 'Sotuv rejasi belgilanmagan' : money(result.plan.current)}</strong><br>${result.plan.confirmed ? 'Tasdiqlangan: ' + esc(result.plan.confirmation.actorName) : 'Tasdiqlanmagan / reja o‘zgargan'}<button type="button" class="btn-secondary-sm" data-confirm-plan ${!(result.plan.current > 0) ? 'disabled' : ''}>Rejani tasdiqlash</button><br>Toza aylanma: ${money(result.cleanTurnover)}</div></section>
            <section class="card payroll-config"><h3>${labels.teacher}</h3>${[15, 30, 60].map(d => numberInput(d + ' daqiqa — 1 o‘quvchi / oy (so‘m)', 'teacher.rates.' + d, c.teacher.rates[d])).join('')}${numberInput('Oylik dars chegarasi (0 = kalendar bo‘yicha)', 'teacher.maxLessons', c.teacher.maxLessons ?? 0)}<p class="payroll-note">Faqat tasdiqlangan davomat hisoblanadi. Tarif o‘quvchi dars davomiyligidan olinadi.</p></section>
            <section class="card payroll-config"><h3>${labels.assistant}</h3>${numberInput('1 o‘quvchi / oy (so‘m)', 'assistant.rate', c.assistant.rate)}${numberInput('Oylik dars chegarasi (0 = mavjud davomat normasi)', 'assistant.maxLessons', c.assistant.maxLessons ?? 0)}<p class="payroll-note">Asosiy ustoz tarifi bilan aralashtirilmaydi. Davomatdan qatnashilgan darslar olinadi.</p></section>
            <section class="card payroll-config"><h3>ROPdan chegiriladigan maosh</h3>${numberInput('Targetolog jami oylik maoshi (so‘m)', 'targetMonthlySalary', c.targetMonthlySalary)}<p class="payroll-note">Reklama byudjeti kiritilmaydi. Moslashuvchan davrda kalendar kunlariga mutanosib hisoblanadi.</p></section>
            <section class="card payroll-config"><h3>Pul bonuslari</h3><p class="payroll-note">Bonus olganlar ro‘yxatidan olinadi. Sovg‘a / dollar mukofotining so‘mdagi qiymatini o‘zingiz kiriting; avtomatik valyuta taxmini qilinmaydi.</p>${[...bonuses].map(([id, label]) => numberInput(label + ' (so‘m)', 'bonus.' + id, c.bonusAmounts[id] ?? 0)).join('')}</section>
            </div></form><details class="card payroll-audit"><summary>O‘zgarishlar tarixi (oxirgi 100 ta)</summary>${config.history.map(h => `<details><summary>${esc(h.actor_name)} · ${esc(new Date(h.created_at).toLocaleString())} · ${esc(h.action)} · ${esc(h.entity_id)}</summary><pre>${esc(JSON.stringify({ old: h.before_data, new: h.after_data }, null, 2))}</pre></details>`).join('') || '<p>O‘zgarishlar yo‘q</p>'}</details>`;
        const form = body.querySelector('form');
        form.addEventListener('input', () => { state.dirty = true; });
        form.querySelector('[name="rop.hasFixed"]').onchange = event => { form.querySelector('[data-rop-fixed]').hidden = !event.target.checked; state.dirty = true; };
        form.onsubmit = event => {
            event.preventDefault();
            action(root, form.querySelector('[type="submit"]'), async () => {
                const data = collectSettings(form, c);
                await api('settings', { language: _financeLang, data, revision: config.revision }, 'PUT');
                state.dirty = false; await load('kpi', true);
            });
        };
        const rerenderTiers = () => {
            for (const role of ['sales', 'rop']) form.querySelector(`[data-tiers="${role}"]`).innerHTML = tierRows(c, role);
            bindTierDelete();
        };
        const bindTierDelete = () => form.querySelectorAll('[data-remove-tier]').forEach(button => { button.onclick = () => {
            const [role, index] = button.dataset.removeTier.split(':');
            Object.assign(c, collectSettings(form, c, false)); c[role].tiers.splice(Number(index), 1); state.dirty = true; rerenderTiers();
        }; });
        bindTierDelete();
        form.querySelectorAll('[data-add-tier]').forEach(button => { button.onclick = () => {
            Object.assign(c, collectSettings(form, c, false)); const role = button.dataset.addTier, tiers = c[role].tiers;
            if (role === 'sales') tiers.push({ from: tiers.at(-1).from + 20000000, fixed: tiers.at(-1).fixed });
            else tiers.splice(tiers.length - 1, 0, { upTo: (tiers.at(-2)?.upTo || 0) + 10, rate: tiers.at(-1).rate });
            state.dirty = true; rerenderTiers();
        }; });
        body.querySelector('[data-confirm-plan]').onclick = event => {
            if (state.dirty) { message(root, 'Avval KPI sozlamalarini saqlang, keyin rejani tasdiqlang.', true); return; }
            action(root, event.currentTarget, async () => {
                await api('confirm-plan', { ...inputBody(), amount: result.plan.current }); await load('kpi', true);
            });
        };
    }
    function collectSettings(form, base, validate = true) {
        const c = JSON.parse(JSON.stringify(base));
        form.querySelectorAll('input[name]').forEach(input => {
            if (input.name.startsWith('tier-')) return;
            const keys = input.name.split('.'); let obj = c;
            if (keys[0] === 'bonus') { obj = c.bonusAmounts; keys.shift(); }
            while (keys.length > 1) obj = obj[keys.shift()];
            obj[keys[0]] = input.type === 'checkbox' ? input.checked : input.value.trim() === '' ? NaN : Number(input.value.replace(/[\s,]/g, ''));
        });
        for (const role of ['sales', 'rop']) c[role].tiers = [...form.querySelectorAll(`[data-tiers="${role}"] [data-tier]`)].map(row => {
            const bound = row.querySelector('[name="tier-bound"]'), value = row.querySelector('[name="tier-value"]');
            const threshold = bound.disabled ? null : bound.value.trim() === '' ? NaN : Number(bound.value.replace(/[\s,]/g, ''));
            const rate = value.value.trim() === '' ? NaN : Number(value.value.replace(/[\s,]/g, ''));
            return role === 'sales' ? { from: threshold, fixed: rate } : { upTo: threshold, rate };
        });
        return validate ? payrollEngine.validateSettings(c) : c;
    }
    async function action(root, button, fn) {
        button.disabled = true;
        try { await fn(); }
        catch (e) { message(root, e.message, true); }
        finally { if (button.isConnected) button.disabled = false; }
    }
    function employeeField(role, selected = '') {
        const matched = payrollEngine.role({ role });
        return `<div class="form-group" id="employeeKpiField" ${matched ? '' : 'hidden'}><label>KPI shabloni *</label><select class="form-control" id="employeeKpiTemplate">${matched ? `<option value="${matched}" selected>${esc(labels[matched])} KPI</option>` : '<option value="">Bu lavozim uchun KPI yo‘q</option>'}</select><small>Moliya → KPI dagi til va lavozim sozlamalari qo‘llanadi.</small></div>`;
    }
    function bindEmployee(roleInput) {
        const el = document.getElementById(roleInput); if (!el) return;
        el.addEventListener('change', () => {
            const old = document.getElementById('employeeKpiField');
            if (old) old.outerHTML = employeeField(el.value);
            if (el.value === 'buxgalter') {
                const department = document.getElementById(roleInput === 'editEmpRole' ? 'editEmpDepartment' : 'empDepartment');
                if (department) department.value = 'Moliya';
            }
        });
    }
    function render(section) {
        const root = rootFor(section); if (!root) return;
        root.dataset.payrollMounted = ''; toolbar(root, section);
        root.querySelector('[data-payroll-mode]').value = state.mode;
        root.querySelector('[data-payroll-month-wrap]').hidden = state.mode !== 'calendar';
        root.querySelectorAll('[data-payroll-start],[data-payroll-end]').forEach(el => { el.disabled = state.mode !== 'custom'; });
        load(section, true);
    }
    const income = { key: '', values: {}, loading: false, refreshed: 0 };
    function leaderboardPeriod(kind) {
        const d = new Date(); let end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        let start = end;
        if (kind === 'oylik') { start = end.slice(0, 7) + '-01'; end = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0)).toISOString().slice(0, 10); }
        if (kind === 'haftalik') { const a = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); a.setUTCDate(a.getUTCDate() - ((a.getUTCDay() + 6) % 7)); start = a.toISOString().slice(0, 10); }
        return { start, end };
    }
    function leaderboardIncome(lang, kind) {
        const p = leaderboardPeriod(kind), key = lang + ':' + p.start + ':' + p.end;
        if (income.key !== key) { income.key = key; income.values = {}; income.refreshed = 0; }
        if (!income.loading && Date.now() - income.refreshed > 30000) {
            income.loading = true;
            api('leaderboard?' + new URLSearchParams({ ...p, language: lang })).then(data => {
                if (income.key === key) { income.values = data.income; income.refreshed = Date.now();
                    if (document.getElementById('ratingLeaderboard')?.offsetParent) renderLeaderboardSection(); }
            }).catch(() => { income.refreshed = Date.now(); }).finally(() => { income.loading = false; });
        }
        return income.values;
    }
    setInterval(() => {
        if (document.hidden) return;
        const panel = document.querySelector('.finance-panel.active');
        if (panel?.offsetParent && ['maoshlar', 'kpi'].includes(panel.dataset.financePanel)) load(panel.dataset.financePanel);
        if (document.getElementById('ratingLeaderboard')?.offsetParent) renderLeaderboardSection();
    }, 30000);
    window.payrollUI = { render, employeeField, bindEmployee, leaderboardIncome, money, collectSettings };
}());
