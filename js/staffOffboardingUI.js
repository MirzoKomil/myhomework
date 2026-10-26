// Xodimni ishdan bo'shatish oynasi (HR → xodim kartasi → "Ishdan bo'shatish").
// Server /api/staff-lifecycle hamma ishni bitta tranzaksiyada qiladi; bu oyna
// faqat tanlovlarni yig'adi va natijani ko'rsatadi.
(function (root) {
    'use strict';

    const REASONS = ["O'z xohishi bilan", "Sinov muddatidan o'tmadi", 'Intizom buzilishi', 'Reja bajarilmadi', 'Shtat qisqarishi'];
    const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? ''));
    const toast = m => { if (typeof showMiniToast === 'function') showMiniToast(m, 3500); };
    const langLabel = l => (l === 'russian' ? 'Rus' : l === 'both' ? 'Ingliz + Rus' : 'Ingliz');
    const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    function canManage() {
        const role = (typeof getCurrentUser === 'function' ? getCurrentUser() : null)?.role;
        return role === 'admin' || role === 'boshliq';
    }

    async function open(employeeId) {
        if (!canManage()) { toast('Faqat admin yoki boshliq ishdan bo‘shata oladi'); return; }
        openModal("Ishdan bo'shatish", '<p class="arx-empty">Ma’lumot yuklanmoqda…</p>', '', { wide: true });
        let p;
        try { p = await apiFetch(`/api/staff-lifecycle/${encodeURIComponent(employeeId)}/preview`); }
        catch (err) { document.getElementById('modalBody').innerHTML = `<p class="arx-empty arx-error">${esc(err.message)}</p>`; return; }
        render(p);
    }

    function leadsBlock(p) {
        if (!p.isSalesManager || !p.leads) return '';
        const L = p.leads;
        const byLang = Object.entries(L.byLanguage || {}).map(([k, n]) => `${langLabel(k)}: ${n}`).join(' · ');
        if (!L.open) {
            return `<div class="off-box"><b>Lidlar</b><p>Ochiq lid yo'q. ${L.closed ? `${L.closed} ta yopilgan sotuv tarixda shu menejer nomida qoladi.` : ''}</p></div>`;
        }
        const targets = p.targets || [];
        return `<div class="off-box">
            <b>Ochiq lidlar: ${L.open} ta</b> <span class="off-muted">${esc(byLang)}${L.paying ? ` · shundan ${L.paying} tasi to'lov jarayonida` : ''}</span>
            <p class="off-muted">Qilingan sotuvlar (${L.closed} ta yopilgan${L.paying ? ` va ${L.paying} ta qisman to'langan` : ''}) shu menejer nomida qoladi — lid kimga berilmasin, reyting va maoshda sotuv uni qilgan odamga yoziladi.</p>
            <fieldset class="off-modes">
                <legend>Ochiq lidlarni nima qilamiz?</legend>
                <label><input type="radio" name="offMode" value="split" ${targets.length ? 'checked' : 'disabled'}> Tanlangan menejerlarga teng bo'lish <small>(eng kam yuklanganiga birinchi)</small></label>
                <label><input type="radio" name="offMode" value="unassigned" ${targets.length ? '' : 'checked'}> Taqsimlanmaganlarga qaytarish <small>(ROP o'zi taqsimlaydi)</small></label>
            </fieldset>
            <div class="off-targets" data-off-targets>
                ${targets.length ? targets.map(t => `<label class="off-target"><input type="checkbox" value="${esc(t.id)}" data-lang="${esc(t.lang)}" ${(L.byLanguage || {})[t.lang] ? 'checked' : ''}>
                    <span><b>${esc(t.name)}</b><small>${esc(langLabel(t.lang))} · hozir ${t.openLeads} ta ochiq lid</small></span></label>`).join('')
                : '<p class="off-muted">Boshqa faol sotuv menejeri yo‘q.</p>'}
            </div>
        </div>`;
    }

    function studentsBlock(p) {
        const S = p.managedStudents;
        if (!S || !S.total) return '';
        const targets = p.targets || [];
        const byLang = Object.entries(S.byLanguage || {}).map(([k, n]) => `${langLabel(k)}: ${n}`).join(' · ');
        return `<div class="off-box"><b>Kuzatayotgan o'quvchilari: ${S.total} ta</b> <span class="off-muted">${esc(byLang)}</span>
            <p class="off-muted">Qarz, keyingi to'lov va aloqa uchun mas'ul menejer almashadi. Sotuv krediti o'zgarmaydi.</p>
            <label class="off-select"><span>Kimga beriladi</span>
                <select class="form-control" id="offStudentsTarget">
                    <option value="">Avtomatik — lid olgan menejerlarga, til bo'yicha teng</option>
                    ${targets.map(t => `<option value="${esc(t.id)}">${esc(t.name)} · ${esc(langLabel(t.lang))}</option>`).join('')}
                </select></label></div>`;
    }

    function teacherBlock(p) {
        const T = p.teacherStudents;
        if (!T || (!T.main.length && !T.assistant.length)) return '';
        const names = [...T.main, ...T.assistant].slice(0, 12).map(s => esc(s.name)).join(', ');
        return `<div class="off-box off-warn"><b>Biriktirilgan o'quvchilar: ${T.main.length + T.assistant.length} ta</b>
            <p>Avval ularni O'quvchilar bo'limida boshqa ustozga o'tkazing — dars jadvali va davomat to'g'ri ko'chadi. Keyin ishdan bo'shatish ochiladi.</p>
            <p class="off-muted">${names}${T.main.length + T.assistant.length > 12 ? '…' : ''}</p></div>`;
    }

    function render(p) {
        const e = p.employee;
        const blocked = !!(p.teacherStudents && (p.teacherStudents.main.length || p.teacherStudents.assistant.length));
        const acc = p.accounts || [];
        document.getElementById('modalBody').innerHTML = `<div class="off">
            <div class="off-who"><b>${esc(e.name)}</b><span>${esc((typeof HR_ROLE_MAP !== 'undefined' && HR_ROLE_MAP[e.role]) || e.role)} · ${esc(langLabel(e.lang))}</span></div>
            <div class="off-grid">
                <label><span>Oxirgi ish kuni</span><input type="date" class="form-control" id="offEndDate" value="${today()}" max="${today()}"></label>
                <label><span>Sabab <span class="off-req" aria-hidden="true">*</span></span><input type="text" class="form-control" id="offReason" maxlength="500" placeholder="Masalan: o'z xohishi bilan" list="offReasons"></label>
                <datalist id="offReasons">${REASONS.map(r => `<option value="${esc(r)}">`).join('')}</datalist>
            </div>
            <div class="off-chips">${REASONS.map(r => `<button type="button" class="arx-chip" data-off-reason="${esc(r)}">${esc(r)}</button>`).join('')}</div>
            ${leadsBlock(p)}
            ${studentsBlock(p)}
            ${teacherBlock(p)}
            <div class="off-box"><b>Akkaunt</b>
                <p>${acc.length ? `Login (${acc.map(a => esc(a.login)).join(', ')}) bloklanadi va ${acc.reduce((n, a) => n + (a.sessions || 0), 0)} ta ochiq sessiya darhol yopiladi.` : 'Bog‘langan login akkaunt topilmadi.'}
                Xodim lid taqsimoti, reyting va tanlov ro'yxatlaridan chiqadi; tarixiy hisobotlarda ismi "(ishdan ketgan)" belgisi bilan qoladi. Maosh oxirgi ish kunigacha hisoblanadi.</p></div>
            ${(p.warnings || []).filter(w => !/o.quvchilar biriktirilgan/i.test(w)).map(w => `<p class="off-muted">⚠️ ${esc(w)}</p>`).join('')}
            <p class="arx-sub">Xato bo'lsa — HR'da "Qayta ishga olish" bilan akkaunt qayta ochiladi. Hammasi Arxiv → "Ishdan bo'shatishlar"da qoladi.</p>
        </div>`;
        document.getElementById('modalFooter').innerHTML = `<button type="button" class="btn-ghost" id="offCancel">Bekor qilish</button>
            <button type="button" class="btn-primary-sm off-danger" id="offSubmit" ${blocked ? 'disabled' : ''}>Ishdan bo'shatish</button>`;
        document.getElementById('offCancel').onclick = () => closeModal();
        document.querySelectorAll('[data-off-reason]').forEach(b => b.onclick = () => { document.getElementById('offReason').value = b.dataset.offReason; });
        const syncTargets = () => {
            const mode = document.querySelector('input[name="offMode"]:checked')?.value;
            const box = document.querySelector('[data-off-targets]');
            if (box) box.classList.toggle('is-off', mode !== 'split');
        };
        document.querySelectorAll('input[name="offMode"]').forEach(r => r.onchange = syncTargets);
        syncTargets();
        document.getElementById('offSubmit').onclick = ev => submit(ev.target, p);
    }

    async function submit(btn, p) {
        const reason = document.getElementById('offReason').value.trim();
        const endDate = document.getElementById('offEndDate').value;
        if (!reason) { toast('Sababni yozing'); document.getElementById('offReason').focus(); return; }
        const body = { employeeId: p.employee.id, reason, endDate };
        const stTarget = document.getElementById('offStudentsTarget')?.value;
        if (stTarget) body.studentsTargetId = stTarget;
        if (p.isSalesManager) {
            const mode = document.querySelector('input[name="offMode"]:checked')?.value || 'unassigned';
            body.mode = (p.leads && p.leads.open) ? mode : 'unassigned';
            if (body.mode === 'split') {
                body.targetIds = [...document.querySelectorAll('[data-off-targets] input:checked')].map(i => i.value);
                if (!body.targetIds.length) { toast('Kamida bitta menejerni tanlang'); return; }
            }
        }
        btn.disabled = true;
        btn.textContent = 'Bajarilmoqda…';
        try {
            const r = await apiFetch('/api/staff-lifecycle/offboard', { method: 'POST', body: JSON.stringify(body), timeout: 30000 });
            document.getElementById('modalBody').innerHTML = `<div class="off off-done">
                <p><b>${esc(r.name)}</b> ishdan bo'shatildi (oxirgi ish kuni ${esc(String(r.endDate).split('-').reverse().join('.'))}).</p>
                <ul>
                    ${p.isSalesManager ? `<li>${r.reassigned} ta ochiq lid berildi${r.unassigned ? `, ${r.unassigned} tasi taqsimlanmaganlarga qaytdi` : ''}${(r.byTarget || []).length ? `: ${r.byTarget.map(t => `${esc(t.name)} — ${t.leads}`).join(', ')}` : ''}.</li>` : ''}
                    ${r.bookRoadmap ? `<li>${r.bookRoadmap} ta yetkazilmagan kitob yangi menejerga o'tdi.</li>` : ''}
                    ${r.studentsMoved ? `<li>${r.studentsMoved} ta o'quvchining mas'ul menejeri almashtirildi.</li>` : ''}
                    <li>${r.accountsBlocked} ta akkaunt bloklandi, ${r.sessionsClosed} ta sessiya yopildi.</li>
                    <li>Qilingan sotuvlar uning nomida qoldi.</li>
                </ul></div>`;
            document.getElementById('modalFooter').innerHTML = '<button type="button" class="btn-primary-sm" id="offDone">Yopish</button>';
            document.getElementById('offDone').onclick = () => closeModal();
            if (root.archiveCenter) await root.archiveCenter.refreshAfterChange();
        } catch (err) {
            btn.disabled = false;
            btn.textContent = "Ishdan bo'shatish";
            toast(err.message);
        }
    }

    async function reinstate(employeeId, name) {
        if (!canManage()) return;
        openModal('Qayta ishga olish', `<p style="margin:0 0 8px"><b>${esc(name || '')}</b> faol holatga qaytadi va login akkaunti ochiladi.</p>
            <p class="arx-sub" style="margin:0">Avval boshqalarga berilgan lidlar avtomatik qaytmaydi — kerak bo'lsa ROP qayta biriktiradi.</p>`,
            `<button type="button" class="btn-ghost" id="reiCancel">Bekor qilish</button><button type="button" class="btn-primary-sm" id="reiOk">Qayta ishga olish</button>`);
        document.getElementById('reiCancel').onclick = () => closeModal();
        document.getElementById('reiOk').onclick = async ev => {
            ev.target.disabled = true;
            try {
                await apiFetch('/api/staff-lifecycle/reinstate', { method: 'POST', body: JSON.stringify({ employeeId }) });
                closeModal();
                if (root.archiveCenter) await root.archiveCenter.refreshAfterChange();
                toast(`${name || 'Xodim'} qayta ishga olindi`);
            } catch (err) { ev.target.disabled = false; toast(err.message); }
        };
    }

    root.staffOffboardingUI = { open, reinstate, canManage };
}(typeof window !== 'undefined' ? window : globalThis));
