// 14-noy: Yangi o'quvchi guruhi qulfi (server: services/domworkBot/groupGate.js).
// Guruh tayyor bo'lmaguncha (bot to'liq admin, rahbar/akademik rahbar/yordamchi ustoz admin):
//  • ROP — yopib bo'lmaydigan oyna, to'liq ro'yxat bilan (nima yetishmayotgani);
//  • sotuv menejeri — yopib bo'lmaydigan qisqa oyna: «ROPga murojaat qiling» (texnik qadamlar yo'q);
//  • admin — bloklanmaydi; pastki burchakda «N ta guruh tayyor emas» va sabab bilan qulfni ochish.
// Kompyuter va Jamoa ilovasi (shu sahifa) uchun bir xil. Har 60 soniyada tekshiriladi.
(function () {
    'use strict';
    const API = '/api/domwork/group-gate';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const role = () => (typeof getCurrentUser === 'function' && getCurrentUser()?.role) || '';
    let timer = null, last = '';

    function css() {
        if (document.getElementById('ggStyle')) return;
        const st = document.createElement('style'); st.id = 'ggStyle';
        st.textContent = `.gg-ov{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.gg-box{background:#fff;color:#0f172a;border-radius:20px;max-width:440px;width:100%;max-height:88vh;overflow:auto;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.gg-h{display:flex;gap:10px;align-items:center;margin-bottom:6px}.gg-ic{width:38px;height:38px;border-radius:50%;background:#FAEEDA;color:#854F0B;display:flex;align-items:center;justify-content:center;font-size:18px;flex:none}
.gg-t{margin:0;font-size:17px;font-weight:800}.gg-p{margin:0 0 12px;font-size:13px;color:#475569;line-height:1.5}
.gg-card{background:#F5F7FB;border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:13px}.gg-card b{font-weight:700}
.gg-row{display:flex;gap:8px;padding:6px 0;border-top:1px solid #E2E8F0;font-size:13px;line-height:1.4}.gg-row:first-of-type{border-top:0}
.gg-btns{display:flex;gap:8px;margin-top:12px}.gg-btn{flex:1;border:1px solid #CBD5E1;background:#fff;border-radius:12px;padding:10px;font-weight:700;font-size:13px;cursor:pointer;color:#0f172a;text-align:center;text-decoration:none}
.gg-btn--p{background:#1E5EFF;border-color:#1E5EFF;color:#fff}.gg-pill{position:fixed;right:16px;bottom:16px;z-index:9999;background:#FAEEDA;color:#854F0B;border:0;border-radius:999px;padding:10px 14px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.15)}
.gg-ta{width:100%;box-sizing:border-box;border:1px solid #CBD5E1;border-radius:10px;padding:8px;font:inherit;font-size:13px;margin-top:6px}`;
        document.head.appendChild(st);
    }
    function close() { document.getElementById('ggOverlay')?.remove(); }

    function ropView(items) {
        return items.map(g => `<div class="gg-card"><b>${esc(g.leadName)}</b> to'lov qildi${g.managerName ? ` · menejer ${esc(g.managerName)}` : ''}<br>
            <span style="color:#475569">Guruh: ${esc(g.groupName)}</span>${g.groupLink ? ` · <a href="${esc(g.groupLink)}" target="_blank" rel="noopener">ochish</a>` : ''}
            ${ropSteps(g.items)}</div>`).join('');
    }
    // Qadamlar: 1) bot va guruh nomi, 2) kimlarni qo'shish kerak — har biri holati bilan.
    function ropSteps(list) {
        if (!list?.length) return `<div style="margin-top:8px" class="gg-row"><span>⏳</span><span>Bot hali tekshirmadi — bir daqiqa kuting</span></div>`;
        const row = i => `<div class="gg-row"><span>${i.ok ? '✅' : '❌'}</span><span>${esc(i.text)}</span></div>`;
        const bot = list.filter(i => i.kind !== 'person'), ppl = list.filter(i => i.kind === 'person');
        const head = (n, t, ok) => `<div style="margin-top:10px;font-weight:800;font-size:12px;color:${ok ? '#0F6E56' : '#0f172a'}">${n}. ${t}</div>`;
        return head(1, 'Botni guruhga admin qiling', bot.every(i => i.ok)) + bot.map(row).join('')
            + (ppl.length ? head(2, `Guruhga qo'shing (${ppl.filter(i => i.ok).length}/${ppl.length} tayyor)`, ppl.every(i => i.ok)) + ppl.map(row).join('') : '');
    }
    function render(items) {
        css();
        const key = role() + JSON.stringify(items);
        if (key === last && document.getElementById('ggOverlay')) return;
        last = key; close();
        const ov = document.createElement('div'); ov.className = 'gg-ov'; ov.id = 'ggOverlay';
        const isRop = role() === 'rop';
        ov.innerHTML = `<div class="gg-box" role="dialog" aria-modal="true">
            <div class="gg-h"><div class="gg-ic">🔒</div><p class="gg-t">${isRop ? 'Guruhni tayyorlang' : 'Kabinet vaqtincha qulflangan'}</p></div>
            ${isRop
                ? `<p class="gg-p">Tizim mustahkam ishlashi uchun yangi o'quvchi guruhi tayyor bo'lmaguncha kabinet qulflangan. Quyidagi qadamlarni bajaring — odamlarni qo'shsangiz, bot ularni o'zi admin qiladi. Har daqiqada avtomatik tekshiriladi.</p>${ropView(items)}`
                : `<p class="gg-p">Tizim mustahkam ishlashi uchun yangi o'quvchingizning Telegram guruhi to'liq tayyor bo'lishi kerak. Guruh tayyor bo'lgach, kabinet o'zi ochiladi.</p>
                   ${items.map(g => `<div class="gg-card"><b>${esc(g.leadName)}</b><br><span style="color:#475569">Guruh: ${esc(g.groupName)}</span></div>`).join('')}
                   <p class="gg-p" style="font-weight:700;color:#0f172a">👉 Bu bo'yicha sotuv bo'limi rahbari (ROP)ga murojaat qiling. Guruh sozlamalarini o'zingiz o'zgartirmang.</p>
                   <p class="gg-p">Agar guruh nomini CRMda Telegramdagidan boshqacha yozgan bo'lsangiz — ROPga ayting, u to'g'rilaydi.</p>`}
            <div class="gg-btns"><button class="gg-btn gg-btn--p" id="ggRe">🔄 Tekshirish</button><button class="gg-btn" id="ggOut">Chiqish</button></div></div>`;
        document.body.appendChild(ov);
        ov.querySelector('#ggRe').onclick = async () => { try { await apiFetch(API + '/recheck', { method: 'POST', body: '{}' }); } catch { } setTimeout(poll, 15000); showMini('Tekshirilmoqda — bir daqiqa ichida yangilanadi'); };
        ov.querySelector('#ggOut').onclick = () => { if (typeof doLogout === 'function') doLogout(); else location.href = '/login.html'; };
    }
    function showMini(t) { if (typeof showMiniToast === 'function') showMiniToast(t, 3000); }

    function adminPill(items) {
        css();
        let pill = document.getElementById('ggPill');
        if (!items.length) { pill?.remove(); return; }
        if (!pill) { pill = document.createElement('button'); pill.className = 'gg-pill'; pill.id = 'ggPill'; document.body.appendChild(pill); }
        pill.textContent = `🔒 ${items.length} ta guruh tayyor emas`;
        pill.onclick = () => {
            close();
            const ov = document.createElement('div'); ov.className = 'gg-ov'; ov.id = 'ggOverlay';
            ov.innerHTML = `<div class="gg-box"><div class="gg-h"><div class="gg-ic">🔒</div><p class="gg-t">Tayyor bo'lmagan guruhlar</p></div>
                <p class="gg-p">Bu lidlar sababli ROP va menejer kabineti qulflangan. Zarurat bo'lsa, sabab yozib qulfni ochishingiz mumkin.</p>
                ${items.map(g => `<div class="gg-card"><b>${esc(g.leadName)}</b> · ${esc(g.groupName)}
                    <div style="margin-top:6px">${(g.items || []).map(i => `<div class="gg-row"><span>${i.ok ? '✅' : '❌'}</span><span>${esc(i.text)}</span></div>`).join('')}</div>
                    <textarea class="gg-ta" data-reason="${esc(g.leadId)}" placeholder="Qulfni ochish sababi"></textarea>
                    <button class="gg-btn" style="margin-top:6px;width:100%" data-open="${esc(g.leadId)}">Qulfni ochish</button></div>`).join('')}
                <div class="gg-btns"><button class="gg-btn" id="ggClose">Yopish</button></div></div>`;
            document.body.appendChild(ov);
            ov.querySelector('#ggClose').onclick = close;
            ov.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => {
                const id = b.dataset.open, reason = ov.querySelector(`[data-reason="${CSS.escape(id)}"]`).value.trim();
                if (reason.length < 3) { showMini('Sababini yozing'); return; }
                try { await apiFetch(API + '/' + encodeURIComponent(id) + '/override', { method: 'POST', body: JSON.stringify({ reason }) }); showMini('Qulf ochildi'); close(); poll(); }
                catch (e) { showMini(e.message || 'Xatolik'); }
            });
        };
    }

    async function poll() {
        const r = role();
        if (!['rop', 'sales_manager', 'admin'].includes(r)) { close(); return; }
        let data;
        try { data = await apiFetch(API + (r === 'admin' ? '/admin' : '/mine'), { fresh: true }); } catch { return; }
        const items = data?.items || [];
        if (r === 'admin') { adminPill(items); return; }
        if (items.length) render(items); else { last = ''; close(); }
    }
    function start() {
        if (timer) return;
        timer = setInterval(poll, 60000);
        setTimeout(poll, 4000);
    }
    // ── 15-noy: ROP/admin — Telegramdan avtomatik biriktirilgan lidlar (kabinetga kirganda bir marta) ──
    let claimsShown = false;
    async function claims() {
        if (claimsShown || !['rop', 'admin'].includes(role()) || document.getElementById('ggOverlay')) return;
        let data; try { data = await apiFetch(API + '/claims', { fresh: true }); } catch { return; }
        const items = data?.items || [];
        if (!items.length) return;
        claimsShown = true; css();
        const by = {}; for (const i of items) (by[i.manager || '—'] ||= []).push(i);
        const cnt = {}; for (const i of items) cnt[i.how] = (cnt[i.how] || 0) + 1;
        const ini = n => String(n).split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
        const t = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' }); };
        const tag = (txt, bg, fg) => `<span style="font-size:11px;font-weight:700;border-radius:999px;padding:3px 8px;background:${bg};color:${fg};white-space:nowrap">${esc(txt)}</span>`;
        const ov = document.createElement('div'); ov.className = 'gg-ov'; ov.id = 'ggClaims';
        ov.innerHTML = `<div class="gg-box" role="dialog" aria-modal="true" style="max-width:560px">
            <div class="gg-h"><div class="gg-ic" style="background:#E6F1FB;color:#1E5EFF">🤖</div><div><p class="gg-t">Telegramdan ${items.length} ta lid avtomatik biriktirildi</p>
            <p class="gg-p" style="margin:2px 0 0">Oxirgi kirganingizdan beri · menejerlar Sotuv guruhida o‘zi bog‘langan</p></div></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">${Object.entries(cnt).map(([k, n]) => `<span style="background:#F5F7FB;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700">${esc(k)} — ${n}</span>`).join('')}</div>
            ${Object.entries(by).map(([m, list]) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 0 6px"><div style="width:30px;height:30px;border-radius:50%;background:#DBE7FF;color:#1E5EFF;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center">${esc(ini(m))}</div>
                <div style="font-weight:800;font-size:14px;flex:1">${esc(m)}</div><div style="font-size:12px;color:#64748B;font-weight:700">${list.length} ta lid</div></div>
                ${list.map(i => `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border-radius:12px;background:#F8FAFC;margin-bottom:6px;font-size:13px">
                    <span style="font-weight:700;flex:1;min-width:120px">${esc(i.name)}<br><span style="font-size:11px;color:#64748B;font-weight:500">${esc([i.target ? 'Target' : 'Organik', i.source, t(i.at), i.ru ? '🇷🇺 Rossiyada' : ''].filter(Boolean).join(' · '))}</span></span>
                    ${tag(i.how, '#E1F5EE', '#0F6E56')}${i.moved ? tag('Yangi → Bog‘lanildi', '#EEEDFE', '#3C3489') : tag('Bosqich o‘zgarmadi', '#F1F5F9', '#475569')}
                    <a href="#" data-claim-open="${esc(i.id)}" style="color:#1E5EFF;font-weight:700;font-size:12px;text-decoration:none">Ochish</a></div>`).join('')}`).join('')}
            <div class="gg-btns"><button type="button" class="gg-btn" data-claim-leads>Lidlar sahifasida ko‘rish</button><button type="button" class="gg-btn gg-btn--p" data-claim-ok>Tushundim</button></div></div>`;
        document.body.appendChild(ov);
        const done = async () => { ov.remove(); try { await apiFetch(API + '/claims/seen', { method: 'POST', body: '{}' }); } catch {} };
        ov.querySelector('[data-claim-ok]').onclick = done;
        ov.querySelector('[data-claim-leads]').onclick = () => { done(); document.querySelector('#sidebarMenu .menu-item[data-tab="sales"]:not([data-nav-sales])')?.click(); };
        ov.querySelectorAll('[data-claim-open]').forEach(a => a.onclick = e => { e.preventDefault(); done(); if (typeof openLeadCommentsModal === 'function') openLeadCommentsModal('russian', a.dataset.claimOpen); });
    }
    const startClaims = () => setTimeout(claims, 6000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startClaims); else startClaims();
    window.groupGate = { poll };
})();
