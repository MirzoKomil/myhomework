(function () {
    'use strict';
    const state = { groups: [], teachers: [], editing: null, busy: false, seq: 0 };
    const types = { trial: 'Sinov darsi', classroom: 'Asosiy dars' };
    const esc = value => escapeHtml(String(value ?? ''));
    const api = (path = '', body, method = 'POST') => apiFetch('/api/domwork/groups' + path,
        body ? { method, body: JSON.stringify(body) } : {});
    const root = () => document.getElementById('settingsPanel-telegram-groups');
    function message(text, failed = false) {
        const el = root()?.querySelector('[data-dg-message]');
        if (el) { el.textContent = text; el.classList.toggle('dg-error', failed); }
    }
    function busy(value) {
        state.busy = value;
        root()?.querySelectorAll('button,input,select').forEach(el => { el.disabled = value; });
    }
    function cards() {
        const el = root(); if (!el) return;
        const query = el.querySelector('[data-dg-search]').value.trim().toLocaleLowerCase();
        const type = el.querySelector('[data-dg-type]').value;
        const archived = el.querySelector('[data-dg-status]').value;
        const rows = state.groups.filter(g => (!type || type === g.type)
            && (archived === 'all' || g.archived === (archived === 'archived'))
            && (!query || (g.name + ' ' + g.teacherName).toLocaleLowerCase().includes(query)));
        el.querySelector('[data-dg-list]').innerHTML = rows.length ? rows.map(g => `<article class="dg-card">
            <div class="dg-card-heading"><h4>${esc(g.name)}</h4><span class="dg-tag">${esc(types[g.type])}</span></div>
            <p>Ustoz: ${esc(g.teacherName || 'CRMdagi ustoz yozuvi topilmadi')}</p>
            <a href="${esc(g.inviteLink)}" target="_blank" rel="noopener noreferrer">${esc(g.inviteLink)}</a>
            <p class="dg-state">${g.archived ? 'Arxivda' : g.isDefault ? 'Standart guruh' : 'Qo‘shimcha guruh'} · ${g.botVerified ? 'Bot bog‘lanishi tekshirilgan' : 'Bot bog‘lanishi hali tekshirilmagan'}</p>
            <div class="dg-actions">${!g.archived ? `<button type="button" class="btn-secondary-sm" data-dg-edit="${esc(g.id)}">Tahrirlash</button>` : ''}
            <button type="button" class="btn-secondary-sm" data-dg-archive="${esc(g.id)}">${g.archived ? 'Arxivdan qaytarish' : 'Arxivlash'}</button></div>
        </article>`).join('') : '<p class="dg-empty">Tanlangan filtr bo‘yicha guruhlar yo‘q.</p>';
        el.querySelector('[data-dg-count]').textContent = `${rows.length} ta guruh`;
    }
    function teacherOptions() {
        const select = root().querySelector('[name="teacherId"]');
        const value = select.value;
        select.innerHTML = '<option value="">Ustozni tanlang</option>' + state.teachers.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
        if (state.teachers.some(t => t.id === value)) select.value = value;
    }
    async function load() {
        const seq = ++state.seq;
        try {
            const data = await api();
            if (seq !== state.seq || getCurrentUser()?.role !== 'admin') return;
            state.groups = data.groups; state.teachers = data.teachers;
            teacherOptions(); cards();
            return true;
        } catch (error) { if (seq === state.seq) message(error.message, true); return false; }
    }
    function edit(group = null) {
        const el = root(), form = el.querySelector('form');
        state.editing = group ? { id: group.id, revision: group.revision } : null;
        form.reset();
        el.querySelector('[data-dg-form-title]').textContent = group ? 'Guruhni tahrirlash' : 'Yangi guruh';
        form.elements.type.value = group?.type || 'trial';
        form.elements.name.value = group?.name || '';
        form.elements.teacherId.value = group?.teacherId || '';
        form.elements.inviteLink.value = group?.inviteLink || '';
        form.elements.chatId.value = group?.chatId || '';
        form.elements.isDefault.checked = group?.isDefault || false;
        el.querySelector('[data-dg-form]').hidden = false;
        form.elements.name.focus();
    }
    function mount(el) {
        if (el.dataset.dgMounted) return;
        el.dataset.dgMounted = '1';
        el.innerHTML = `<div class="domwork-groups">
            <header class="dg-header"><div><h3>Domwork — Telegram guruhlari</h3><p>Rus tili · sinov va asosiy dars guruhlari</p></div>
                <button type="button" class="btn-primary" data-dg-add>+ Guruh qo‘shish</button></header>
            <p class="dg-note">Bir ustozga bir nechta guruh qo‘shish mumkin. Har bir dars turi uchun standart guruhni belgilang.
                Havolani saqlash botni guruhga avtomatik bog‘lamaydi: chat_id va bot ruxsatlari alohida tekshiriladi. Bu oynadan xabar yuborilmaydi.</p>
            <div role="status" aria-live="polite" data-dg-message></div>
            <section class="dg-form-wrap" data-dg-form hidden><h4 data-dg-form-title>Yangi guruh</h4>
                <form autocomplete="off"><div class="dg-fields">
                    <label>Guruh nomi<input class="form-control" name="name" maxlength="120" required placeholder="Sinov darsi | Ustoz ismi"></label>
                    <label>Dars turi<select class="form-control" name="type"><option value="trial">Sinov darsi</option><option value="classroom">Asosiy dars</option></select></label>
                    <label>Rus tili ustozi<select class="form-control" name="teacherId" required><option value="">Ustozni tanlang</option></select></label>
                    <label>Telegram guruh havolasi<input class="form-control" name="inviteLink" type="url" maxlength="300" required placeholder="https://t.me/+..."></label>
                </div><details class="dg-advanced"><summary>Bot bog‘lanishi — ixtiyoriy chat_id</summary>
                    <label>Telegram chat_id<input class="form-control" name="chatId" inputmode="text" placeholder="-100..."></label>
                    <p>Bilmasangiz bo‘sh qoldiring. Havoladan chat_id avtomatik aniqlanmaydi. Keyin bot integratsiyasi orqali tekshiriladi.</p></details>
                <label class="dg-checkbox"><input type="checkbox" name="isDefault"> Ushbu ustoz va dars turi uchun standart guruh</label>
                <p class="dg-note">Standart guruh almashsa, avvalgi guruh saqlanadi. Eski o‘quvchi ma’lumotlari va HRdagi havolalar o‘zgartirilmaydi.</p>
                <div class="dg-actions"><button type="submit" class="btn-primary">Saqlash</button>
                    <button type="button" class="btn-secondary-sm" data-dg-cancel>Bekor qilish</button></div></form></section>
            <div class="dg-filters"><label>Qidirish<input class="form-control" data-dg-search type="search" placeholder="Guruh yoki ustoz nomi" autocomplete="off"></label>
                <label>Dars turi<select class="form-control" data-dg-type><option value="">Barcha turlar</option><option value="trial">Sinov darsi</option><option value="classroom">Asosiy dars</option></select></label>
                <label>Holat<select class="form-control" data-dg-status><option value="active">Faol</option><option value="archived">Arxivda</option><option value="all">Barchasi</option></select></label>
                <button type="button" class="btn-secondary-sm" data-dg-refresh>Yangilash</button></div>
            <p data-dg-count></p><div class="dg-list" data-dg-list></div></div>`;
        el.querySelector('[data-dg-add]').onclick = () => edit();
        el.querySelector('[data-dg-cancel]').onclick = () => { el.querySelector('[data-dg-form]').hidden = true; state.editing = null; };
        el.querySelector('[data-dg-search]').oninput = cards;
        el.querySelectorAll('[data-dg-type],[data-dg-status]').forEach(node => { node.onchange = cards; });
        el.querySelector('[data-dg-refresh]').onclick = async () => {
            if (state.busy) return; busy(true);
            try { if (await load()) message('Ro‘yxat yangilandi.'); } finally { busy(false); }
        };
        el.querySelector('form').onsubmit = async event => {
            event.preventDefault(); if (state.busy) return;
            const form = event.currentTarget, editing = state.editing;
            const body = { type: form.elements.type.value, name: form.elements.name.value,
                teacherId: form.elements.teacherId.value, inviteLink: form.elements.inviteLink.value,
                chatId: form.elements.chatId.value, isDefault: form.elements.isDefault.checked,
                ...(editing ? { revision: editing.revision } : {}) };
            busy(true); message('Saqlanmoqda…');
            try {
                await api(editing ? '/' + encodeURIComponent(editing.id) : '', body, editing ? 'PUT' : 'POST');
                el.querySelector('[data-dg-form]').hidden = true; state.editing = null;
                if (await load()) message('Guruh serverga saqlandi.');
                else message('Guruh saqlandi, lekin ro‘yxatni yangilash amalga oshmadi. Yangilash tugmasini bosing.', true);
            } catch (error) { message(error.message, true); }
            finally { busy(false); }
        };
        el.querySelector('[data-dg-list]').onclick = async event => {
            if (state.busy) return;
            const button = event.target.closest('[data-dg-edit],[data-dg-archive]'); if (!button) return;
            const group = state.groups.find(g => g.id === (button.dataset.dgEdit || button.dataset.dgArchive)); if (!group) return;
            if (button.dataset.dgEdit) { edit(group); return; }
            if (!confirm(group.archived ? 'Guruhni arxivdan qaytarasizmi? Standart guruh alohida belgilanadi.' : 'Guruhni arxivlaysizmi? Guruh, o‘quvchilar va yozishmalar o‘chirilmaydi.')) return;
            busy(true);
            try { await api('/' + encodeURIComponent(group.id) + '/archive', { archived: !group.archived, revision: group.revision });
                if (state.editing?.id === group.id) { el.querySelector('[data-dg-form]').hidden = true; state.editing = null; }
                if (await load()) message(group.archived ? 'Guruh arxivdan qaytarildi.' : 'Guruh arxivlandi.');
            } catch (error) { message(error.message, true); }
            finally { busy(false); }
        };
    }
    async function render() {
        const el = root(); if (!el) return;
        if (getCurrentUser()?.role !== 'admin') {
            ++state.seq; el.innerHTML = '<p>Guruhlarni faqat CRM administratori boshqaradi.</p>'; delete el.dataset.dgMounted; return;
        }
        mount(el); busy(true); message('Guruhlar yuklanmoqda…');
        try { if (await load()) message(''); } finally { busy(false); }
    }
    window.domworkGroupsUI = { render };
}());
