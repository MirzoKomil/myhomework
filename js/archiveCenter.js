// Arxiv markazi — Sozlamalar → Arxiv. Server arxividan (/api/archive) o'qiydi:
// o'chirilgan lid, o'quvchi, xodim, kitob yetkazish, HR nomzod, skript,
// yo'riqnoma, bonus, pul oqimi yozuvi, izoh/post va boshqalar. Har bir
// yozuvda kim, qachon o'chirgani; nusxani ko'rish va bir tugma bilan tiklash.
(function (root) {
    'use strict';

    const TYPE_ORDER = ['lead', 'student', 'employee', 'offboarding', 'bookRoadmap', 'candidate', 'cashTx', 'bonus',
        'script', 'guide', 'shopOrder', 'notification', 'communityPost', 'communityComment', 'contentComment', 'callRecording', 'orgNode', 'teacher'];
    const TYPE_META = {
        lead: { label: 'Lidlar', icon: '🎯' },
        student: { label: "O'quvchilar", icon: '🎓' },
        employee: { label: 'Xodimlar', icon: '👤' },
        offboarding: { label: "Ishdan bo'shatishlar", icon: '🚪' },
        bookRoadmap: { label: 'Kitob yetkazish', icon: '📦' },
        candidate: { label: 'HR nomzodlar', icon: '🧾' },
        cashTx: { label: 'Pul oqimi', icon: '💵' },
        bonus: { label: 'Bonuslar', icon: '🏅' },
        script: { label: 'Sotuv skriptlari', icon: '📜' },
        guide: { label: "Yo'riqnomalar", icon: '📘' },
        shopOrder: { label: "Do'kon buyurtmalari", icon: '🛒' },
        notification: { label: 'Bildirishnomalar', icon: '🔔' },
        communityPost: { label: 'Hamjamiyat postlari', icon: '💬' },
        communityComment: { label: 'Hamjamiyat izohlari', icon: '💭' },
        contentComment: { label: 'Dars izohlari', icon: '📝' },
        callRecording: { label: "Qo'ng'iroq yozuvlari", icon: '🎧' },
        orgNode: { label: 'Tashkiliy tuzilma', icon: '🏢' },
        teacher: { label: 'Ustozlar (eski)', icon: '🧑‍🏫' }
    };
    const FIELD_LABELS = {
        name: 'Ism', full_name: 'Ism', phone: 'Telefon', phone2: 'Telefon 2', contact_phone: 'Telefon', email: 'Email',
        role: 'Lavozim', department: "Bo'lim", status: 'Holat', lang: 'Til', language: 'Til', subject: 'Til',
        group_name: 'Guruh', group: 'Guruh', login: 'Login', region: 'Viloyat', address: 'Manzil', source: 'Manba',
        manager_id: 'Menejer', managerId: 'Menejer', teacher_id: 'Ustoz', teacherId: 'Ustoz', created_at: 'Yaratilgan',
        createdAt: 'Yaratilgan', join_date: 'Ishga kirgan', start_date: 'Boshlagan', end_date: 'Oxirgi kun',
        amount: 'Summa', category: 'Turkum', date: 'Sana', type: 'Turi', title: 'Sarlavha', text: 'Matn',
        vacancy_name: 'Vakansiya', offboard_reason: 'Sabab', paidAmount: "To'langan", debtAmount: 'Qarz'
    };
    const HIDDEN_FIELDS = new Set(['password', 'password_hash', 'passwordHash', 'bytes', 'stageHistory', 'comments',
        'attachments', 'trialHistory', 'card_number', 'cardNumber', 'passport_series', 'passportSeries', 'pinfl',
        'dual_role', 'dualRole', 'kpi_template_id', 'kpiTemplateId', 'trial_group_link', 'offboarded_by', 'deleted_by',
        'leadPaymentSyncKey', 'autoProvisionedFromLead', 'paymentLedgerManaged', 'external_id', 'lead_type']);
    const STATUS_LABELS = { active: 'Faol', inactive: 'Faol emas' };
    function prettyValue(key, value) {
        const v = String(value);
        if (['lang', 'language', 'subject'].includes(key)) return langLabel(v) || v;
        if (key === 'status') {
            if (STATUS_LABELS[v]) return STATUS_LABELS[v];
            if (typeof LEAD_COLUMNS !== 'undefined') return LEAD_COLUMNS.find(c => c.id === v)?.label || v;
            return v;
        }
        if (key === 'role' && typeof HR_ROLE_MAP !== 'undefined' && HR_ROLE_MAP[v]) return HR_ROLE_MAP[v];
        if (typeof value === 'boolean') return value ? 'Ha' : "Yo'q";
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return fmtTime(v);
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('.');
        return v;
    }

    const state = { type: '', q: '', from: '', to: '', status: 'deleted', lang: '', items: [], total: 0, counts: {}, offset: 0, loading: false };
    let host = null;
    let searchTimer = null;

    const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
    const fmtTime = v => {
        const d = v ? new Date(v) : null;
        if (!d || Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    const langLabel = l => (l === 'russian' ? 'Rus' : l === 'english' ? 'Ingliz' : l === 'both' ? 'Ingliz + Rus' : '');
    const typeMeta = t => TYPE_META[t] || { label: t, icon: '🗂️' };
    const toast = m => { if (typeof showMiniToast === 'function') showMiniToast(m); };
    const notifyError = (t, m) => (typeof showNotification === 'function' ? showNotification(t, m, 'error') : toast(m));

    function query(extra = {}) {
        const p = new URLSearchParams();
        const s = { ...state, ...extra };
        if (s.type) p.set('type', s.type);
        if (s.q) p.set('q', s.q);
        if (s.from) p.set('from', s.from);
        if (s.to) p.set('to', s.to);
        if (s.status) p.set('status', s.status);
        if (s.lang) p.set('lang', s.lang);
        p.set('limit', '50');
        p.set('offset', String(s.offset || 0));
        return p.toString();
    }

    async function load({ append = false } = {}) {
        if (!host) return;
        state.loading = true;
        if (!append) { state.offset = 0; renderList(true); }
        try {
            const data = await apiFetch('/api/archive?' + query());
            state.items = append ? [...state.items, ...data.items] : data.items;
            state.total = data.total;
            state.counts = data.counts || {};
            state.error = '';
        } catch (err) {
            state.error = err.message || 'Arxivni yuklab bo‘lmadi';
            if (!append) state.items = [];
        } finally {
            state.loading = false;
            renderChips();
            renderList(false);
        }
    }

    function renderChips() {
        const box = host?.querySelector('[data-arx-chips]');
        if (!box) return;
        const types = TYPE_ORDER.filter(t => state.counts[t] !== undefined);
        const total = types.reduce((a, t) => a + (state.counts[t] || 0), 0);
        box.innerHTML = [`<button type="button" class="arx-chip${state.type ? '' : ' is-on'}" data-arx-type="">Hammasi <b>${total}</b></button>`]
            .concat(types.map(t => `<button type="button" class="arx-chip${state.type === t ? ' is-on' : ''}" data-arx-type="${t}">${typeMeta(t).icon} ${esc(typeMeta(t).label)} <b>${state.counts[t] || 0}</b></button>`))
            .join('');
        box.querySelectorAll('[data-arx-type]').forEach(btn => btn.onclick = () => { state.type = btn.dataset.arxType; load(); });
    }

    function renderList(loading) {
        const list = host?.querySelector('[data-arx-list]');
        if (!list) return;
        if (loading && !state.items.length) { list.innerHTML = '<p class="arx-empty">Yuklanmoqda…</p>'; return; }
        if (state.error) { list.innerHTML = `<p class="arx-empty arx-error">${esc(state.error)}</p>`; return; }
        if (!state.items.length) {
            list.innerHTML = `<p class="arx-empty">${state.status === 'restored' ? 'Tiklangan yozuv yo‘q' : 'Bu filtr bo‘yicha o‘chirilgan yozuv yo‘q'}</p>`;
            return;
        }
        list.innerHTML = state.items.map(rowHtml).join('') + (state.items.length < state.total
            ? `<button type="button" class="btn-ghost arx-more" data-arx-more>Yana yuklash (${state.total - state.items.length} ta qoldi)</button>` : '');
        list.querySelectorAll('[data-arx-view]').forEach(b => b.onclick = () => openDetails(b.dataset.arxView));
        list.querySelectorAll('[data-arx-restore]').forEach(b => b.onclick = () => confirmRestore(b.dataset.arxRestore));
        const more = list.querySelector('[data-arx-more]');
        if (more) more.onclick = () => { state.offset = state.items.length; load({ append: true }); };
    }

    function rowHtml(it) {
        const m = typeMeta(it.type);
        const restored = it.restoredAt ? `<span class="arx-tag is-ok">Tiklangan · ${esc(fmtTime(it.restoredAt))}${it.restoredBy ? ' · ' + esc(it.restoredBy) : ''}</span>` : '';
        return `<article class="arx-row${it.restoredAt ? ' is-restored' : ''}">
            <span class="arx-ico" aria-hidden="true">${m.icon}</span>
            <div class="arx-main">
                <div class="arx-title"><b>${esc(it.title || 'Nomsiz yozuv')}</b><span class="arx-tag">${esc(it.typeLabel || m.label)}</span>${it.lang ? `<span class="arx-tag">${esc(langLabel(it.lang))}</span>` : ''}${restored}</div>
                ${it.subtitle ? `<div class="arx-sub">${esc(prettySubtitle(it))}</div>` : ''}
                <div class="arx-meta">${esc(it.type === 'offboarding' ? 'Bajardi' : "O'chirdi")}: <b>${esc(it.deletedBy || 'Tizim')}</b> · <time>${esc(fmtTime(it.deletedAt))}</time>${it.reason ? ` · ${esc(it.reason)}` : ''}</div>
            </div>
            <div class="arx-actions">
                <button type="button" class="btn-ghost" data-arx-view="${esc(it.id)}">Ko'rish</button>
                ${it.restorable && canRestore(it.type) ? `<button type="button" class="btn-primary-sm" data-arx-restore="${esc(it.id)}">Tiklash</button>` : ''}
            </div>
        </article>`;
    }

    // Lid bosqichi slug'i o'rniga ekrandagi nomi (LEAD_COLUMNS app.js'da).
    function prettySubtitle(it) {
        if (it.type !== 'lead' || typeof LEAD_COLUMNS === 'undefined') return it.subtitle;
        return String(it.subtitle).split(' · ').map(part => (LEAD_COLUMNS.find(c => c.id === part)?.label) || part).join(' · ');
    }

    function canRestore(type) {
        const role = (typeof getCurrentUser === 'function' ? getCurrentUser() : null)?.role;
        if (role === 'admin' || role === 'boshliq') return type !== 'offboarding';
        return role === 'rop' && ['lead', 'student', 'bookRoadmap', 'script', 'bonus'].includes(type);
    }

    function flatten(snapshot) {
        const src = snapshot?.row || snapshot?.item || snapshot?.legacyItem || snapshot?.employee || snapshot || {};
        const out = [];
        const add = (k, v) => {
            if (HIDDEN_FIELDS.has(k) || v === null || v === undefined || v === '') return;
            if (typeof v === 'object') return;
            out.push([FIELD_LABELS[k] || k, prettyValue(k, v)]);
        };
        Object.entries(src).forEach(([k, v]) => {
            if (k === 'extra_data' && v && typeof v === 'object') Object.entries(v).forEach(([k2, v2]) => add(k2, v2));
            else add(k, v);
        });
        const known = out.filter(([k]) => Object.values(FIELD_LABELS).includes(k));
        const rest = out.filter(([k]) => !Object.values(FIELD_LABELS).includes(k));
        return [...known, ...rest].slice(0, 60);
    }

    async function openDetails(id) {
        let rec;
        try { rec = await apiFetch('/api/archive/' + encodeURIComponent(id)); }
        catch (err) { toast(err.message); return; }
        const fields = flatten(rec.snapshot);
        const result = rec.snapshot?.result;
        const summary = result ? `<div class="arx-detail-note">
            <b>Natija:</b> ${result.reassigned || 0} ta ochiq lid berildi${result.unassigned ? `, ${result.unassigned} tasi taqsimlanmaganlarga qaytdi` : ''};
            ${result.accountsBlocked || 0} ta akkaunt bloklandi, ${result.sessionsClosed || 0} ta sessiya yopildi.
            ${(result.byTarget || []).length ? `<br>${result.byTarget.map(t => `${esc(t.name)} — ${t.leads} ta`).join(', ')}` : ''}</div>` : '';
        openModal(`${typeMeta(rec.type).icon} ${rec.title || "Yozuv"}`, `
            <div class="arx-detail">
                <p class="arx-sub">${esc(rec.typeLabel || '')} · ${esc(rec.type === 'offboarding' ? 'Bajardi' : "O'chirdi")}: <b>${esc(rec.deletedBy || 'Tizim')}</b> · ${esc(fmtTime(rec.deletedAt))}${rec.reason ? ' · ' + esc(rec.reason) : ''}</p>
                ${summary}
                ${fields.length ? `<dl class="arx-fields">${fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v.length > 300 ? v.slice(0, 300) + '…' : v)}</dd>`).join('')}</dl>` : '<p class="arx-empty">Nusxada ko‘rsatiladigan maydon yo‘q</p>'}
                <p class="arx-note">Parol, karta va pasport ma'lumotlari bu yerda ko'rsatilmaydi, lekin tiklashda joyiga qaytadi.</p>
            </div>`,
            `<button type="button" class="btn-ghost" id="arxDetailClose">Yopish</button>${rec.restorable && canRestore(rec.type) ? `<button type="button" class="btn-primary-sm" id="arxDetailRestore">Tiklash</button>` : ''}`,
            { wide: true });
        document.getElementById('arxDetailClose').onclick = () => closeModal();
        const r = document.getElementById('arxDetailRestore');
        if (r) r.onclick = () => { closeModal(); confirmRestore(id); };
    }

    function confirmRestore(id) {
        const it = state.items.find(x => x.id === id) || { id, title: '' };
        openModal('Tiklash', `<p style="margin:0 0 8px"><b>${esc(it.title || 'Yozuv')}</b> o'z joyiga qaytariladi.</p>
            <p class="arx-sub" style="margin:0">Arxivda "tiklangan" belgisi bilan iz qoladi. Shu ID bilan yangi yozuv yaratilgan bo'lsa, ustidan yozilmaydi.</p>`,
            `<button type="button" class="btn-ghost" id="arxCancel">Bekor qilish</button><button type="button" class="btn-primary-sm" id="arxOk">Ha, tiklash</button>`, { wide: false });
        document.getElementById('arxCancel').onclick = () => closeModal();
        document.getElementById('arxOk').onclick = async ev => {
            ev.target.disabled = true;
            try {
                await apiFetch('/api/archive/' + encodeURIComponent(id) + '/restore', { method: 'POST', body: '{}' });
                closeModal();
                await refreshAfterChange();
                toast(`${it.title || 'Yozuv'} tiklandi`);
                load();
            } catch (err) {
                ev.target.disabled = false;
                notifyError('Tiklab bo‘lmadi', err.message);
            }
        };
    }

    async function refreshAfterChange() {
        try { await reloadStateFromApi(); } catch (e) { console.warn('Holatni yangilab bo‘lmadi:', e.message); }
        try { if (typeof refreshLeadsFromApi === 'function') await refreshLeadsFromApi(); } catch (e) { /* lid huquqi bo'lmasligi mumkin */ }
        ['renderLeads', 'renderStudents', 'renderHrEmployees', 'renderBookRoadmap'].forEach(fn => {
            try { if (typeof root[fn] === 'function') root[fn](); } catch (e) { console.warn(fn, e.message); }
        });
    }

    function mount(container) {
        host = container;
        if (!host) return;
        host.innerHTML = `<section class="arx" aria-label="Arxiv">
            <div class="arx-head">
                <div><h3>Arxiv</h3><p>O'chirilgan har qanday ma'lumot shu yerda saqlanadi — kim, qachon o'chirgani bilan. Kerakli yozuvni bir tugma bilan joyiga qaytaring.</p></div>
            </div>
            <div class="arx-chips" data-arx-chips></div>
            <div class="arx-filters">
                <input type="search" class="form-control" placeholder="Ism, telefon yoki ID" data-arx-q value="${esc(state.q)}" aria-label="Qidirish">
                <select class="form-control" data-arx-status aria-label="Holat">
                    <option value="deleted">O'chirilganlar</option><option value="restored">Tiklanganlar</option><option value="all">Hammasi</option>
                </select>
                <select class="form-control" data-arx-lang aria-label="Til"><option value="">Barcha tillar</option><option value="english">Ingliz</option><option value="russian">Rus</option></select>
                <label class="arx-date"><span>dan</span><input type="date" class="form-control" data-arx-from value="${esc(state.from)}"></label>
                <label class="arx-date"><span>gacha</span><input type="date" class="form-control" data-arx-to value="${esc(state.to)}"></label>
            </div>
            <div class="arx-list" data-arx-list></div>
        </section>`;
        host.querySelector('[data-arx-status]').value = state.status;
        host.querySelector('[data-arx-lang]').value = state.lang;
        host.querySelector('[data-arx-q]').oninput = e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.q = e.target.value.trim(); load(); }, 300); };
        host.querySelector('[data-arx-status]').onchange = e => { state.status = e.target.value; load(); };
        host.querySelector('[data-arx-lang]').onchange = e => { state.lang = e.target.value; load(); };
        host.querySelector('[data-arx-from]').onchange = e => { state.from = e.target.value; load(); };
        host.querySelector('[data-arx-to]').onchange = e => { state.to = e.target.value; load(); };
        load();
    }

    root.archiveCenter = { mount, reload: () => load(), refreshAfterChange, _flatten: flatten };
}(typeof window !== 'undefined' ? window : globalThis));
