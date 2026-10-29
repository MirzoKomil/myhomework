// Yuklash xatosi — ustoz va yordamchi sahifalari uchun BITTA naqsh (ustoz Davomatidagi xato kartasi asosida).
// Qoida: xato bo'lgan blok soxta raqam (0 so'm, 0/13, "Belgilanmagan") ko'rsatmaydi — aniq xabar va "Qayta urinish";
// sahifaning boshqa bloklari (o'z ma'lumoti kelgan bo'lsa) ishlayveradi.
(function () {
    'use strict';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const dot = s => (/[.!?…]$/.test(s) ? s : s + '.');
    // Xato sababi — foydalanuvchiga tushunarli qisqa matn.
    function reason(err) {
        if (!err) return '';
        if (err.status === 429) return 'Juda ko\'p so\'rov — biroz kutib, qayta urining';
        if (err.status >= 500) return dot(err.message && !/^HTTP \d+$/.test(err.message) ? err.message : 'Server xatosi').replace(/\.$/, '') + ' — birozdan so\'ng qayta urining';
        if (err.name === 'TypeError' || /Failed to fetch|NetworkError/i.test(err.message || '')) return 'Internet yoki server bilan aloqa yo\'q';
        return String(err.message || err);
    }
    // html({ title, err, note, compact, cls, attr }) — xato kartasi; "Qayta urinish" tugmasi [data-lerr-retry].
    function html({ title = 'Ma\'lumotni yuklab bo\'lmadi.', err = null, note = 'Raqamlar to\'liq bo\'lmasligi mumkin, shuning uchun ko\'rsatilmadi.', compact = false, cls = '', attr = '' } = {}) {
        const r = reason(err);
        return `<div class="mh-lerr${compact ? ' is-compact' : ''}${cls ? ' ' + cls : ''}" role="alert"${attr ? ' ' + attr : ''}><p><b>${esc(dot(title))}</b>${r ? ' ' + esc(dot(r)) : ''}${note ? ' ' + esc(note) : ''}</p>`
            + `<button type="button" class="mh-lerr-btn" data-lerr-retry>Qayta urinish</button></div>`;
    }
    // bind(root, fn) — root ichidagi barcha [data-lerr-retry] tugmalariga qayta yuklashni ulaydi (bosilganda o'chadi).
    function bind(root, fn) {
        (root?.querySelectorAll ? root.querySelectorAll('[data-lerr-retry]') : []).forEach(b => {
            b.onclick = async e => {
                e.stopPropagation();
                if (b.disabled) return;
                b.disabled = true; b.textContent = 'Yuklanmoqda…';
                try { await fn(); } catch (err) { console.warn('[LoadErr] qayta urinish', err?.message); }
                finally { if (b.isConnected) { b.disabled = false; b.textContent = 'Qayta urinish'; } }
            };
        });
    }
    // settle(promise) → { ok, value, err } — xatoni yutmasdan, blok bo'yicha ajratish uchun.
    const settle = p => Promise.resolve(p).then(value => ({ ok: true, value, err: null }), err => ({ ok: false, value: null, err }));
    window.LoadErr = { html, bind, reason, settle, esc };
})();
