// Xodimlar davomati (Face ID + lokatsiya) — CRM interfeysi.
//  • Xodim: header'dagi "Davomat" tugmasi → kamera (3x4 ramka) + GPS → Keldim/Ketdim
//  • HR → Davomat: bugungi jadval, oylik hisobot, ustozlar darsi, xodimlar va grafik, sozlamalar
// Server: /api/staff-attendance (server/routes/staffAttendance.js)
(function () {
    'use strict';
    const API = '/api/staff-attendance';
    const DAYS = [['1', 'Du'], ['2', 'Se'], ['3', 'Ch'], ['4', 'Pa'], ['5', 'Ju'], ['6', 'Sh'], ['7', 'Ya']];
    const STATUS = {
        on_time: ['Vaqtida', 'ok'], late: ['Kechikdi', 'warn'], absent: ['Kelmadi', 'bad'], waiting: ['Kutilmoqda', 'idle'],
        upcoming: ['Ish boshlanmagan', 'idle'], off: ['Dam olish', 'idle'], before: ['Hisob boshlanmagan', 'idle'],
        not_ready: ['Yuz namunasi tasdiqlanmagan', 'idle'], extra: ['Dam olish kuni keldi', 'info'],
        leave: ['Ta’tilda', 'info'], excused: ['Sababli', 'info'], present: ['Keldi (qo‘lda)', 'ok'],
    };
    const LESSON = {
        on_time: ['Vaqtida', 'ok'], live: ['Hozir efirda', 'info'], late_start: ['Kech boshladi', 'warn'], early_end: ['Erta tugatdi', 'warn'],
        late_and_early: ['Kech boshlab, erta tugatdi', 'bad'], not_held: ['Dars bo‘lmadi', 'bad'], pending: ['Vaqti kelmagan', 'idle'],
        marked: ['Davomat vaqtida', 'ok'], marked_late: ['Davomat kech belgilandi', 'warn'], marked_early: ['Davomat darsdan oldin', 'warn'],
        not_marked: ['Davomat belgilanmagan', 'bad'],
    };
    const FACE = { none: ['Namuna yo‘q', 'idle'], pending: ['Tasdiq kutmoqda', 'warn'], approved: ['Tasdiqlangan', 'ok'], rejected: ['Rad etilgan', 'bad'], reset: ['Qayta olinishi kerak', 'warn'] };
    const MANAGE = new Set(['admin', 'boshliq', 'hr']);

    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => { try { return typeof getCurrentUser === 'function' ? getCurrentUser() : null; } catch { return null; } };
    const canManage = () => MANAGE.has(user()?.role);
    const pill = (map, key, extra = '') => { const [label, tone] = map[key] || [key || '—', 'idle']; return `<span class="satt-pill satt-${tone}">${esc(label)}${extra}</span>`; };
    const tashkentToday = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
    const api = (path, body, method) => apiFetch(API + path, body !== undefined
        ? { method: method || 'POST', body: JSON.stringify(body), timeout: 90000 } : { method: method || 'GET', timeout: 30000 });
    const mins = m => m >= 60 ? `${Math.floor(m / 60)} soat ${m % 60 ? (m % 60) + ' daq' : ''}`.trim() : `${m} daq`;

    // ── Rasmlar (token bilan olinadi, <img> o'zi sarlavha yubora olmaydi) ─────
    const photoCache = new Map();
    async function photoUrl(id) {
        if (!id) return '';
        if (photoCache.has(id)) return photoCache.get(id);
        const promise = fetch(`${API}/photos/${encodeURIComponent(id)}`, { headers: { Authorization: 'Bearer ' + getToken() } })
            .then(r => (r.ok ? r.blob() : null)).then(b => (b ? URL.createObjectURL(b) : ''));
        photoCache.set(id, promise);
        return promise;
    }
    function hydratePhotos(root) {
        root.querySelectorAll('img[data-satt-photo]').forEach(async img => {
            const url = await photoUrl(img.dataset.sattPhoto);
            if (url) img.src = url; else img.replaceWith(Object.assign(document.createElement('span'), { className: 'satt-muted', textContent: 'Rasm o‘chirilgan' }));
        });
    }

    // ── Oyna (modal) ─────────────────────────────────────────────────────────
    let overlay = null, onCloseHook = null;
    function openSheet(title, html, { wide = false, onClose } = {}) {
        closeSheet();
        overlay = document.createElement('div');
        overlay.className = 'satt-overlay';
        overlay.innerHTML = `<div class="satt-sheet${wide ? ' satt-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="sattSheetTitle">
            <header class="satt-sheet-head"><h3 id="sattSheetTitle">${esc(title)}</h3>
            <button type="button" class="satt-close" aria-label="Yopish">&times;</button></header>
            <div class="satt-sheet-body">${html}</div></div>`;
        document.body.appendChild(overlay);
        onCloseHook = onClose || null;
        overlay.querySelector('.satt-close').onclick = closeSheet;
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) closeSheet(); });
        document.addEventListener('keydown', escClose);
        return overlay.querySelector('.satt-sheet-body');
    }
    function escClose(e) { if (e.key === 'Escape') closeSheet(); }
    function closeSheet() {
        document.removeEventListener('keydown', escClose);
        if (onCloseHook) { const fn = onCloseHook; onCloseHook = null; fn(); }
        overlay?.remove(); overlay = null;
    }

    // ── Kamera ───────────────────────────────────────────────────────────────
    const CAPTURE_W = 360, CAPTURE_H = 480; // 3x4
    function cameraStage(note) {
        return `<div class="satt-stage">
            <video class="satt-video" playsinline muted autoplay></video>
            <svg class="satt-guide" viewBox="0 0 300 400" aria-hidden="true"><defs><mask id="sattMask"><rect width="300" height="400" fill="#fff"/>
            <ellipse cx="150" cy="185" rx="104" ry="138" fill="#000"/></mask></defs>
            <rect width="300" height="400" fill="rgba(12,10,24,.55)" mask="url(#sattMask)"/>
            <ellipse class="satt-oval" cx="150" cy="185" rx="104" ry="138" fill="none" stroke-width="3"/></svg>
            <div class="satt-count" aria-live="assertive"></div>
            <div class="satt-turn" hidden aria-hidden="true"></div>
        </div><p class="satt-prompt" aria-live="polite">${esc(note)}</p>`;
    }
    async function startCamera(root) {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Bu brauzer kamerani qo‘llab-quvvatlamaydi. Chrome yoki Safari’ning yangi versiyasidan foydalaning.');
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } } });
        } catch (e) {
            if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw new Error('Kameraga ruxsat berilmagan. Brauzer manzil satridagi qulf belgisidan kameraga ruxsat bering.');
            if (e && e.name === 'NotFoundError') throw new Error('Qurilmada kamera topilmadi.');
            throw new Error('Kamerani ochib bo‘lmadi. Boshqa ilova kamerani band qilmaganini tekshiring.');
        }
        const video = root.querySelector('.satt-video');
        video.srcObject = stream;
        await new Promise(resolve => { if (video.readyState >= 2) resolve(); else video.onloadeddata = resolve; setTimeout(resolve, 3000); });
        await video.play().catch(() => {});
        return { video, stop: () => stream.getTracks().forEach(tr => tr.stop()) };
    }
    function grab(video) {
        const canvas = document.createElement('canvas');
        canvas.width = CAPTURE_W; canvas.height = CAPTURE_H;
        const vw = video.videoWidth || 640, vh = video.videoHeight || 480, ratio = CAPTURE_W / CAPTURE_H;
        let sw = vw, sh = vh, sx = 0, sy = 0;
        if (vw / vh > ratio) { sw = vh * ratio; sx = (vw - sw) / 2; } else { sh = vw / ratio; sy = (vh - sh) / 2; }
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CAPTURE_W, CAPTURE_H);
        return canvas.toDataURL('image/png');
    }
    const wait = ms => new Promise(r => setTimeout(r, ms));
    async function countdown(root, seconds, prompt) {
        const count = root.querySelector('.satt-count'), p = root.querySelector('.satt-prompt');
        if (prompt) p.textContent = prompt;
        for (let s = seconds; s > 0; s--) { count.textContent = s; count.classList.remove('satt-tick'); void count.offsetWidth; count.classList.add('satt-tick'); await wait(1000); }
        count.textContent = '';
        root.querySelector('.satt-stage').classList.add('satt-flash');
        setTimeout(() => root.querySelector('.satt-stage')?.classList.remove('satt-flash'), 250);
    }
    function locate() {
        return new Promise(resolve => {
            if (!navigator.geolocation) return resolve({ error: 'Brauzer joylashuvni aniqlay olmaydi.' });
            navigator.geolocation.getCurrentPosition(
                p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
                e => resolve({ error: e.code === 1 ? 'Joylashuvga ruxsat berilmagan. Brauzer sozlamalarida bu saytga joylashuv ruxsatini yoqing.' : 'Joylashuvni aniqlab bo‘lmadi. GPS yoqilganini tekshiring.' }),
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        });
    }

    // ── Xodim: header tugmasi ────────────────────────────────────────────────
    let me = null;
    async function refreshMe() {
        try { me = await api('/me'); } catch { me = null; }
        renderHeaderButton();
        return me;
    }
    function renderHeaderButton() {
        let btn = document.getElementById('staffAttBtn');
        if (!me?.tracked) { btn?.remove(); return; }
        if (!btn) {
            const host = document.querySelector('.header-actions');
            if (!host) return;
            btn = document.createElement('button');
            btn.type = 'button'; btn.id = 'staffAttBtn'; btn.className = 'satt-header-btn';
            btn.addEventListener('click', openCheckSheet);
            host.insertBefore(btn, host.firstChild);
        }
        const today = me.today || {};
        let label = 'Keldim', state = 'todo';
        if (me.face !== 'approved') { label = 'Davomat'; state = 'setup'; }
        else if (today.outClock) { label = `Ketdi ${today.outClock}`; state = 'done'; }
        else if (today.inClock) { label = `Keldi ${today.inClock}`; state = 'in'; }
        else if (today.status === 'off') { label = 'Davomat'; state = 'done'; }
        btn.dataset.state = state;
        btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2"/><circle cx="12" cy="11" r="3.2"/><path d="M7.5 17.5c1-2 2.6-3 4.5-3s3.5 1 4.5 3"/></svg><span>${esc(label)}</span>`;
        btn.title = 'Ishga kelish-ketishni belgilash';
    }

    function todaySummary(t) {
        if (!t) return '';
        const parts = [];
        if (t.scheduled) parts.push(`<div><span class="satt-muted">Bugungi ish vaqti</span><b class="satt-num">${esc(t.start)}–${esc(t.end)}</b></div>`);
        else parts.push('<div><span class="satt-muted">Bugun</span><b>Dam olish kuni</b></div>');
        parts.push(`<div><span class="satt-muted">Keldi</span><b class="satt-num">${esc(t.inClock || '—')}</b></div>`);
        parts.push(`<div><span class="satt-muted">Ketdi</span><b class="satt-num">${esc(t.outClock || '—')}</b></div>`);
        return `<div class="satt-today">${parts.join('')}</div>
            <div class="satt-today-status">${pill(STATUS, t.status, t.lateMinutes ? ` · ${t.lateMinutes} daq` : '')}</div>`;
    }

    async function openCheckSheet() {
        const body = openSheet('Davomat', '<div class="satt-loading">Yuklanmoqda…</div>');
        const data = await refreshMe();
        if (!overlay) return;
        if (!data?.tracked) { body.innerHTML = '<p>Sizga davomat belgilash yoqilmagan. Savollar bo‘lsa HR’ga murojaat qiling.</p>'; return; }
        if (['none', 'rejected', 'reset'].includes(data.face)) return enrollView(body, data);
        if (data.face === 'pending') {
            body.innerHTML = `${todaySummary(data.today)}<div class="satt-note">Yuz namunangiz HR’ga yuborilgan. Tasdiqlangach shu yerda “Keldim” tugmasi chiqadi.</div>`;
            return;
        }
        const kind = data.nextAction;
        const done = !!data.today?.outClock;
        body.innerHTML = `${todaySummary(data.today)}
            <ul class="satt-steps"><li>Ofis hududida bo‘ling (${esc(data.office?.name || 'ofis')}, ${data.office?.radius || ''} m)</li>
            <li>Yuzingizni ramkaga joylang — 3 soniyada rasm olinadi</li><li>So‘ng boshingizni sekin yonga buring</li></ul>
            <button type="button" class="satt-cta" data-kind="${kind}">${kind === 'in' ? 'Kelishni belgilash' : done ? 'Ketishni qayta belgilash' : 'Ketishni belgilash'}</button>
            <p class="satt-muted satt-small">Bugun yana ${data.attemptsLeft} ta urinish qoldi. Rasm faqat davomat uchun, ${data.photoDays || 90} kun saqlanadi; ofisdan tashqaridagi joylashuvingiz saqlanmaydi.</p>`;
        body.querySelector('.satt-cta').onclick = () => checkFlow(body, kind);
    }

    // Bekor qilish: oyna yopilsa jarayon to'xtaydi, kamera o'chadi va serverga hech narsa yuborilmaydi.
    function session() {
        const state = { cancelled: false, cam: null };
        onCloseHook = () => { state.cancelled = true; state.cam?.stop(); };
        state.alive = () => { if (state.cancelled || !overlay) { state.cam?.stop(); throw Object.assign(new Error('cancelled'), { cancelled: true }); } };
        return state;
    }

    async function checkFlow(body, kind) {
        body.innerHTML = '<div class="satt-loading"><span class="satt-spinner"></span>Tayyorlanmoqda…</div>';
        const st = session();
        try {
            body.innerHTML = cameraStage('Yuzingizni ramka ichiga joylang');
            const geo = locate();
            st.cam = await startCamera(body);
            st.alive();
            // Topshiriq kamera ochilgandan keyin olinadi — ruxsat so'rash vaqti uning muddatiga kirmaydi.
            const ch = await api('/me/challenge', {});
            st.alive();
            await countdown(body, 3, 'Kameraga to‘g‘ri qarang');
            st.alive();
            const front = grab(st.cam.video);
            // Ekrandagi ko'rinish ko'zgudek: xodimning chap tomoni ekranning chap tomonida.
            const turn = body.querySelector('.satt-turn');
            turn.hidden = false; turn.dataset.dir = ch.direction; turn.textContent = ch.direction === 'left' ? '⟵' : '⟶';
            await countdown(body, 2, ch.direction === 'left' ? 'Endi boshingizni sekin CHAPGA buring' : 'Endi boshingizni sekin O‘NGGA buring');
            st.alive();
            const turned = grab(st.cam.video);
            st.cam.stop(); st.cam = null;
            body.innerHTML = '<div class="satt-loading"><span class="satt-spinner"></span>Joylashuv aniqlanmoqda…</div>';
            const location = await geo;
            st.alive();
            body.innerHTML = '<div class="satt-loading"><span class="satt-spinner"></span>Yuz tekshirilmoqda — bu 10–20 soniya olishi mumkin</div>';
            const payload = { kind, challenge: ch.id, frame: front, turned, location: location.error ? null : location };
            let res;
            // Navbat band bo'lsa (503) — xuddi shu rasmlar bilan bir necha soniyadan keyin avtomatik qayta yuboriladi.
            for (let tryNo = 0; ; tryNo++) {
                try { res = await api('/me/check', payload); break; }
                catch (e) {
                    if (e.status !== 503 || tryNo >= 4) throw e;
                    body.innerHTML = '<div class="satt-loading"><span class="satt-spinner"></span>Hozir navbat band — bir necha soniyada qayta tekshiriladi…</div>';
                    await wait(5000 + tryNo * 3000);
                    st.alive();
                }
            }
            if (!overlay) return;
            if (res.ok) {
                const t = res.today || {};
                body.innerHTML = `<div class="satt-result satt-result-ok"><div class="satt-big-check" aria-hidden="true">✓</div>
                    <h4>${kind === 'in' ? 'Kelish belgilandi' : 'Ketish belgilandi'}</h4><p class="satt-num satt-clock">${esc(res.clock)}</p>
                    ${kind === 'in' && t.lateMinutes ? `<p class="satt-warn-text">Ish ${esc(t.start)} da boshlanadi — ${t.lateMinutes} daqiqa kechikdingiz.</p>` : ''}
                    ${kind === 'out' && t.earlyMinutes ? `<p class="satt-warn-text">Ish ${esc(t.end)} da tugaydi — ${t.earlyMinutes} daqiqa erta ketyapsiz.</p>` : ''}
                    <button type="button" class="satt-cta satt-cta-quiet">Yopish</button></div>`;
                body.querySelector('button').onclick = closeSheet;
                refreshMe();
            } else {
                const extra = res.reason === 'outside' && res.distance ? ` Ofisgacha taxminan ${res.distance} m.`
                    : res.reason === 'no_location' && location.error ? ' ' + location.error : '';
                failView(body, res.message + extra, kind);
            }
        } catch (e) {
            st.cam?.stop();
            if (e.cancelled || !overlay) return;
            failView(body, e.message, kind);
        }
    }
    function failView(body, message, kind) {
        body.innerHTML = `<div class="satt-result satt-result-bad"><div class="satt-big-check" aria-hidden="true">!</div>
            <h4>Belgilanmadi</h4><p>${esc(message)}</p>
            <button type="button" class="satt-cta">Qayta urinish</button></div>`;
        body.querySelector('button').onclick = () => checkFlow(body, kind);
    }

    // Yuz namunasi: 2 ta to'g'ri qaragan rasm. self=true — xodimning o'zi (HR tasdiqlaydi).
    function enrollView(body, data, target) {
        const self = !target;
        body.innerHTML = `${self ? todaySummary(data?.today) : ''}
            <div class="satt-note">${self
                ? (data?.face === 'rejected' ? 'Avvalgi namunangiz rad etildi. Yorug‘ joyda, ko‘zoynaksiz va bosh kiyimsiz qayta yuboring.'
                    : data?.face === 'reset' ? 'HR yuz namunangizni yangilashni so‘radi. Yangi namuna yuboring — tasdiqlangach davomat yana ishlaydi.'
                    : 'Davomatni boshlash uchun avval yuz namunangizni yuboring. HR tasdiqlagach har kuni shu namuna bilan tekshiriladi.')
                : `<b>${esc(target.name)}</b> uchun yuz namunasi olinadi. Xodim kameraga to‘g‘ri qarab tursin.`}</div>
            <ul class="satt-steps"><li>Yorug‘ joyda turing, yuz to‘liq ko‘rinsin</li><li>Kameraga to‘g‘ri qarang — 2 ta rasm olinadi</li></ul>
            <button type="button" class="satt-cta">Rasmga olish</button>`;
        body.querySelector('.satt-cta').onclick = async () => {
            body.innerHTML = cameraStage('Yuzingizni ramka ichiga joylang');
            const st = session();
            try {
                st.cam = await startCamera(body);
                st.alive();
                await countdown(body, 3, 'Kameraga to‘g‘ri qarang');
                st.alive();
                const a = grab(st.cam.video);
                await countdown(body, 2, 'Yana bir marta, qimirlamang');
                st.alive();
                const b = grab(st.cam.video);
                st.cam.stop(); st.cam = null;
                body.innerHTML = '<div class="satt-loading"><span class="satt-spinner"></span>Rasmlar tekshirilmoqda…</div>';
                const res = await api(self ? '/me/face' : `/employees/${encodeURIComponent(target.id)}/face`, { frames: [a, b] });
                if (!overlay) return;
                body.innerHTML = `<div class="satt-result satt-result-ok"><div class="satt-big-check" aria-hidden="true">✓</div>
                    <h4>${res.state === 'approved' ? 'Namuna saqlandi va tasdiqlandi' : 'Namuna HR’ga yuborildi'}</h4>
                    <p>${res.state === 'approved' ? 'Endi xodim davomat belgilay oladi.' : 'Tasdiqlangach “Keldim” tugmasi bilan belgilaysiz.'}</p>
                    <button type="button" class="satt-cta satt-cta-quiet">Yopish</button></div>`;
                body.querySelector('button').onclick = closeSheet;
                if (self) refreshMe(); else if (hrState.section === 'xodimlar') renderHrSection();
            } catch (e) {
                st.cam?.stop();
                if (e.cancelled || !overlay) return;
                body.innerHTML = `<div class="satt-result satt-result-bad"><div class="satt-big-check" aria-hidden="true">!</div><h4>Saqlanmadi</h4><p>${esc(e.message)}</p>
                    <button type="button" class="satt-cta">Qayta urinish</button></div>`;
                body.querySelector('button').onclick = () => enrollView(body, data, target);
            }
        };
    }

    // ── HR → Davomat ─────────────────────────────────────────────────────────
    const hrState = { section: 'bugun', date: tashkentToday(), month: tashkentToday().slice(0, 7), lessonDate: tashkentToday(), employees: null, settings: null };
    const SECTIONS = [['bugun', 'Bugun'], ['oylik', 'Oylik hisobot'], ['ustozlar', 'Ustozlar darsi'], ['xodimlar', 'Xodimlar va grafik'], ['sozlamalar', 'Sozlamalar']];

    function renderHr() {
        const panel = document.getElementById('hrPanel-davomat');
        if (!panel) return;
        if (!panel.dataset.sattMounted) {
            panel.dataset.sattMounted = '1';
            panel.innerHTML = `<div class="satt-hr"><nav class="satt-tabs" role="tablist" aria-label="Davomat bo‘limlari">
                ${SECTIONS.map(([id, label]) => `<button type="button" role="tab" data-satt-section="${id}">${label}</button>`).join('')}
                </nav><div class="satt-hr-body" data-satt-body></div></div>`;
            panel.querySelectorAll('[data-satt-section]').forEach(b => { b.onclick = () => { hrState.section = b.dataset.sattSection; renderHrSection(); }; });
        }
        renderHrSection();
    }
    function hrBody() { return document.querySelector('#hrPanel-davomat [data-satt-body]'); }
    function setTabs() {
        document.querySelectorAll('#hrPanel-davomat [data-satt-section]').forEach(b => {
            const on = b.dataset.sattSection === hrState.section;
            b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
            b.hidden = b.dataset.sattSection === 'sozlamalar' && !canManage();
        });
    }
    async function renderHrSection() {
        setTabs();
        const body = hrBody();
        if (!body) return;
        body.innerHTML = '<div class="satt-loading"><span class="satt-spinner"></span>Yuklanmoqda…</div>';
        try {
            if (hrState.section === 'bugun') await renderDaily(body);
            else if (hrState.section === 'oylik') await renderMonthly(body);
            else if (hrState.section === 'ustozlar') await renderLessons(body);
            else if (hrState.section === 'xodimlar') await renderEmployees(body);
            else await renderSettings(body);
        } catch (e) {
            body.innerHTML = `<div class="satt-error">${esc(e.message || 'Ma’lumotni yuklab bo‘lmadi')}</div>`;
        }
    }

    async function renderDaily(body) {
        const data = await api(`/daily?date=${hrState.date}`);
        const s = data.summary || {};
        const chip = (key, label) => `<div class="satt-stat satt-${(STATUS[key] || [0, 'idle'])[1]}"><b>${s[key] || 0}</b><span>${label}</span></div>`;
        body.innerHTML = `<div class="satt-toolbar"><label>Sana <input type="date" class="form-control-sm" value="${hrState.date}" max="${tashkentToday()}" data-satt-date></label>
            <button type="button" class="btn-secondary-sm" data-satt-refresh>Yangilash</button></div>
            ${data.rows.length ? `<div class="satt-stats">${chip('on_time', 'vaqtida')}${chip('late', 'kechikdi')}${chip('absent', 'kelmadi')}${chip('waiting', 'kutilmoqda')}${chip('leave', 'ta’tilda')}</div>
            <div class="satt-table-wrap"><table class="satt-table"><thead><tr><th>Xodim</th><th>Ish vaqti</th><th>Keldi</th><th>Ketdi</th><th>Holat</th><th>Urinishlar</th><th></th></tr></thead><tbody>
            ${data.rows.map(r => `<tr><td class="satt-name"><b>${esc(r.name)}</b></td><td class="satt-num" data-label="Ish vaqti">${r.scheduled ? `${esc(r.start)}–${esc(r.end)}` : '<span class="satt-muted">dam olish</span>'}</td>
                <td class="satt-num" data-label="Keldi">${esc(r.inClock || '—')}</td><td class="satt-num" data-label="Ketdi">${esc(r.outClock || '—')}${r.earlyMinutes ? `<div class="satt-warn-text">${r.earlyMinutes} daq erta</div>` : ''}${r.noCheckout ? '<div class="satt-muted satt-small">ketish belgilanmagan</div>' : ''}</td>
                <td data-label="Holat">${pill(STATUS, r.status, r.lateMinutes ? ` · ${r.lateMinutes} daq` : '')}${r.note ? `<div class="satt-muted satt-small">${esc(r.note)}</div>` : ''}</td>
                <td data-label="Urinishlar"><span>${r.attempts.length ? `${r.attempts.length} ta${r.rejected ? ` <span class="satt-bad-text">(${r.rejected} rad)</span>` : ''}` : '<span class="satt-muted">—</span>'}</span></td>
                <td class="satt-actions"><button type="button" class="btn-secondary-sm" data-satt-detail="${esc(r.employeeId)}">Batafsil</button></td></tr>`).join('')}
            </tbody></table></div>` : emptyState('Hali hech kimga davomat yoqilmagan', 'Xodimlar va grafik bo‘limida xodimga ish vaqtini kiriting — shundan keyin u kabinetida “Keldim” tugmasini ko‘radi.', 'xodimlar')}`;
        body.querySelector('[data-satt-date]').onchange = e => { hrState.date = e.target.value || tashkentToday(); renderHrSection(); };
        body.querySelector('[data-satt-refresh]').onclick = renderHrSection;
        body.querySelectorAll('[data-satt-detail]').forEach(b => { b.onclick = () => openDayDetail(data.rows.find(r => r.employeeId === b.dataset.sattDetail), data); });
        bindGo(body);
    }
    function emptyState(title, text, go) {
        return `<div class="satt-empty"><h4>${esc(title)}</h4><p>${esc(text)}</p>${go && canManage() ? `<button type="button" class="btn-primary-sm" data-satt-go="${go}">Xodimlar va grafik</button>` : ''}</div>`;
    }
    function bindGo(body) { body.querySelectorAll('[data-satt-go]').forEach(b => { b.onclick = () => { hrState.section = b.dataset.sattGo; renderHrSection(); }; }); }

    function openDayDetail(row, data) {
        const office = data.office;
        const html = `<div class="satt-detail-head">${pill(STATUS, row.status, row.lateMinutes ? ` · ${row.lateMinutes} daq` : '')}
            <span class="satt-num">${esc(row.scheduled ? `${row.start}–${row.end}` : 'Dam olish kuni')}</span>${row.workedMinutes ? `<span class="satt-muted">Ishladi: ${mins(row.workedMinutes)}</span>` : ''}</div>
            ${row.attempts.length ? `<div class="satt-attempts">${row.attempts.map(a => `<article class="satt-attempt ${a.ok ? '' : 'satt-attempt-bad'}">
                ${a.photoId ? `<img data-satt-photo="${esc(a.photoId)}" alt="${esc(row.name)} — ${esc(a.clock)}">` : '<div class="satt-nophoto">Rasm saqlanmagan<br><span class="satt-small">ofis hududidan tashqarida</span></div>'}
                <div><b class="satt-num">${esc(a.clock)}</b> · ${a.kind === 'in' ? 'kelish' : 'ketish'}<br>
                ${a.ok ? '<span class="satt-ok-text">Tasdiqlandi</span>' : `<span class="satt-bad-text">${esc(a.message)}</span>`}<br>
                <span class="satt-muted satt-small">${a.method === 'ip' ? 'Ofis interneti orqali' : a.distance != null ? `Ofisdan ${a.distance} m` : 'Lokatsiya yo‘q'}${a.method !== 'ip' && a.accuracy ? ` (±${a.accuracy} m)` : ''}${a.faceDistance != null ? ` · yuz farqi ${Number(a.faceDistance).toFixed(2)}` : ''}</span>
                ${a.lat != null ? `<br><a href="https://yandex.uz/maps/?pt=${a.lng},${a.lat}&z=17&l=map" target="_blank" rel="noopener">Xaritada ko‘rish</a>` : ''}</div></article>`).join('')}</div>`
            : '<p class="satt-muted">Bu kuni belgilash urinishlari yo‘q.</p>'}
            ${canManage() ? `<form class="satt-override" data-satt-override><h4>Holatni qo‘lda belgilash</h4>
                <div class="satt-row"><select class="form-control-sm" name="status"><option value="">Avtomatik (tizim hisoblaydi)</option>
                <option value="excused">Sababli (shifokor, topshiriq…)</option><option value="present">Keldi deb hisoblash</option>
                <option value="leave">Ta’til</option><option value="absent">Kelmadi deb hisoblash</option></select>
                <input class="form-control-sm" name="note" maxlength="300" placeholder="Izoh (majburiy emas)" value="${esc(row.note || '')}">
                <button class="btn-primary-sm" type="submit">Saqlash</button></div><p class="satt-form-msg" role="status"></p></form>` : ''}
            <p class="satt-muted satt-small">Ofis: ${esc(office.name)} · ruxsat etilgan radius ${office.radius} m</p>`;
        const body = openSheet(`${row.name} — ${hrState.date}`, html, { wide: true });
        hydratePhotos(body);
        const form = body.querySelector('[data-satt-override]');
        if (form) {
            if (row.overridden) form.status.value = row.status;
            form.onsubmit = async e => {
                e.preventDefault();
                const msg = form.querySelector('.satt-form-msg');
                try {
                    await api('/override', { employeeId: row.employeeId, date: hrState.date, status: form.status.value || null, note: form.note.value }, 'PUT');
                    closeSheet(); renderHrSection();
                } catch (err) { msg.textContent = err.message; }
            };
        }
    }

    const CELL = { on_time: ['✓', 'ok'], present: ['✓', 'ok'], late: ['K', 'warn'], absent: ['✗', 'bad'], leave: ['T', 'info'], excused: ['S', 'info'],
        extra: ['+', 'info'], waiting: ['…', 'idle'], off: ['', 'off'], upcoming: ['', 'off'], before: ['', 'off'], not_ready: ['', 'off'] };
    async function renderMonthly(body) {
        const data = await api(`/monthly?month=${hrState.month}`);
        const dayNo = d => Number(d.slice(8));
        const wd = d => new Date(d + 'T00:00:00Z').getUTCDay() || 7;
        body.innerHTML = `<div class="satt-toolbar"><label>Oy <input type="month" class="form-control-sm" value="${hrState.month}" data-satt-month></label>
            ${data.rows.length ? '<button type="button" class="btn-secondary-sm" data-satt-xlsx>Excel’ga yuklab olish</button>' : ''}
            <span class="satt-legend"><i class="satt-ok">✓</i> vaqtida <i class="satt-warn">K</i> kechikdi <i class="satt-bad">✗</i> kelmadi <i class="satt-info">T</i> ta’til <i class="satt-info">S</i> sababli</span></div>
            ${data.rows.length ? `<div class="satt-table-wrap"><table class="satt-month"><thead><tr><th class="satt-sticky">Xodim</th>
            ${data.dates.map(d => `<th class="${wd(d) === 7 ? 'satt-sun' : ''}">${dayNo(d)}</th>`).join('')}
            <th>Kech</th><th>Kech (daq)</th><th>Kelmadi</th><th>Ishlangan</th></tr></thead><tbody>
            ${data.rows.map(r => `<tr><th class="satt-sticky">${esc(r.name)}</th>${r.days.map(d => { const [sym, tone] = CELL[d.status] || ['?', 'idle'];
                return `<td class="satt-cell satt-${tone}" title="${esc(`${d.date}: ${(STATUS[d.status] || [d.status])[0]}${d.lateMinutes ? `, ${d.lateMinutes} daq kech` : ''}${d.inClock ? `, keldi ${d.inClock}` : ''}${d.outClock ? `, ketdi ${d.outClock}` : ''}`)}">${sym}</td>`; }).join('')}
            <td class="satt-num">${r.totals.late}</td><td class="satt-num">${r.totals.lateMinutes}</td><td class="satt-num">${r.totals.absent}</td><td class="satt-num">${Math.round(r.totals.workedMinutes / 60)} soat</td></tr>`).join('')}
            </tbody></table></div>` : emptyState('Hisobot uchun ma’lumot yo‘q', 'Davomat yoqilgan xodimlar bo‘lganda oylik jadval shu yerda chiqadi.', 'xodimlar')}`;
        body.querySelector('[data-satt-month]').onchange = e => { hrState.month = e.target.value || tashkentToday().slice(0, 7); renderHrSection(); };
        const x = body.querySelector('[data-satt-xlsx]');
        if (x) x.onclick = async () => {
            try { if (!window.XLSX && typeof loadXlsxLib === 'function') await loadXlsxLib(); } catch { /* pastda tekshiriladi */ }
            if (!window.XLSX) { x.textContent = 'Excel kutubxonasi yuklanmadi'; return; }
            const rows = data.rows.map(r => {
                const o = { Xodim: r.name };
                r.days.forEach(d => { o[d.date.slice(8)] = (STATUS[d.status] || [d.status])[0] + (d.lateMinutes ? ` (${d.lateMinutes})` : ''); });
                Object.assign(o, { 'Kechikish (marta)': r.totals.late, 'Kechikish (daq)': r.totals.lateMinutes, 'Kelmadi': r.totals.absent, 'Erta ketish (daq)': r.totals.earlyMinutes, 'Ishlangan (soat)': Math.round(r.totals.workedMinutes / 6) / 10 });
                return o;
            });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Davomat');
            XLSX.writeFile(wb, `davomat-${hrState.month}.xlsx`);
        };
        bindGo(body);
    }

    async function renderLessons(body) {
        const data = await api(`/lessons?date=${hrState.lessonDate}`);
        body.innerHTML = `<div class="satt-toolbar"><label>Sana <input type="date" class="form-control-sm" value="${hrState.lessonDate}" max="${tashkentToday()}" data-satt-ldate></label>
            <p class="satt-muted satt-small">Ustozlar hech narsa bosmaydi. Telegram guruhi bog‘langan ustozda video chat vaqti, qolganlarida dars vaqtida davomat qachon belgilangani tekshiriladi.</p></div>
            ${data.rows.length ? `<div class="satt-lessons">${data.rows.map(r => `<section class="satt-teacher">
                <header><h4>${esc(r.name)}</h4><span class="satt-source">${r.source === 'telegram' ? 'Telegram video chat' : 'Davomat vaqti'}</span>
                <span class="satt-muted">${r.lessons} ta dars</span>${r.problems ? `<span class="satt-bad-text">${r.problems} ta muammo</span>` : ''}</header>
                <ol class="satt-blocks">${r.blocks.map(b => `<li><span class="satt-num satt-block-time">${esc(b.start)}–${esc(b.end)}</span>
                    ${pill(LESSON, b.status, [b.lateStartMinutes ? ` · ${b.lateStartMinutes} daq kech` : '', b.earlyEndMinutes ? ` · ${b.earlyEndMinutes} daq erta` : ''].join(''))}
                    <span class="satt-muted satt-small">${b.lessons} ta dars${b.startedClock ? ` · efir ${esc(b.startedClock)}${b.endedClock ? `–${esc(b.endedClock)}` : ' dan'}` : ''}</span>
                    ${b.slots ? `<details><summary>O‘quvchilar</summary><ul>${b.slots.map(s => `<li><span class="satt-num">${esc(s.start)}</span> ${esc(s.student)} — ${pill(LESSON, s.status)}${s.markedClock ? ` <span class="satt-muted satt-small">${esc(s.markedClock)}</span>` : ''}</li>`).join('')}</ul></details>`
                    : `<span class="satt-muted satt-small satt-students">${b.students.map(esc).join(', ')}</span>`}</li>`).join('')}</ol></section>`).join('')}</div>`
            : '<div class="satt-empty"><h4>Bu kunda rejalashtirilgan dars yo‘q</h4><p>Dars jadvali o‘quvchilarning dars kuni va vaqtidan olinadi.</p></div>'}`;
        body.querySelector('[data-satt-ldate]').onchange = e => { hrState.lessonDate = e.target.value || tashkentToday(); renderHrSection(); };
    }

    function scheduleSummary(days) {
        const keys = Object.keys(days || {});
        if (!keys.length) return '<span class="satt-muted">kiritilmagan</span>';
        const groups = {};
        for (const k of keys) { const v = `${days[k].start}–${days[k].end}`; (groups[v] ||= []).push(DAYS.find(d => d[0] === k)[1]); }
        return Object.entries(groups).map(([time, ds]) => `<span class="satt-num">${ds.join(', ')} ${time}</span>`).join('<br>');
    }
    async function renderEmployees(body) {
        const list = await api('/employees');
        hrState.employees = list;
        const manage = canManage();
        const staff = list.filter(e => !e.isTeacher), teachers = list.filter(e => e.isTeacher);
        const pendingCount = list.filter(e => e.face === 'pending').length;
        const row = e => `<tr><td class="satt-name"><b>${esc(e.name)}</b><div class="satt-muted satt-small">${esc(e.role)}${e.hasLogin ? '' : ' · CRM logini yo‘q'}</div></td>
            <td data-label="Ish vaqti">${e.tracked ? scheduleSummary(e.days) : '<span class="satt-muted">o‘chirilgan</span>'}</td>
            <td data-label="Yuz namunasi">${pill(FACE, e.face)}</td>
            <td class="satt-actions">${manage ? `<button type="button" class="btn-secondary-sm" data-satt-schedule="${esc(e.id)}">Grafik</button>
                ${e.face === 'pending' ? `<button type="button" class="btn-primary-sm" data-satt-review="${esc(e.id)}">Tekshirish</button>` : ''}
                <button type="button" class="btn-secondary-sm" data-satt-enroll="${esc(e.id)}">${e.face === 'approved' ? 'Yuzni yangilash' : 'Yuzni olish'}</button>` : ''}</td></tr>`;
        body.innerHTML = `${pendingCount && manage ? `<div class="satt-note">${pendingCount} ta xodim yuz namunasini yubordi — “Tekshirish” tugmasi orqali tasdiqlang.</div>` : ''}
            <div class="satt-table-wrap"><table class="satt-table"><thead><tr><th>Xodim</th><th>Ish vaqti</th><th>Yuz namunasi</th><th></th></tr></thead>
            <tbody>${staff.map(row).join('') || '<tr><td colspan="4" class="satt-muted">Xodimlar topilmadi</td></tr>'}</tbody></table></div>
            ${teachers.length ? `<details class="satt-teachers-fold"><summary>Ustozlar (${teachers.length}) — kamera talab qilinmaydi, darslari avtomatik nazorat qilinadi</summary>
            <div class="satt-table-wrap"><table class="satt-table"><tbody>${teachers.map(row).join('')}</tbody></table></div></details>` : ''}`;
        body.querySelectorAll('[data-satt-schedule]').forEach(b => { b.onclick = () => openSchedule(list.find(e => e.id === b.dataset.sattSchedule)); });
        body.querySelectorAll('[data-satt-enroll]').forEach(b => { b.onclick = () => { const e = list.find(x => x.id === b.dataset.sattEnroll); enrollView(openSheet('Yuz namunasi', ''), null, e); }; });
        body.querySelectorAll('[data-satt-review]').forEach(b => { b.onclick = () => openReview(list.find(e => e.id === b.dataset.sattReview)); });
    }

    function openSchedule(emp) {
        const days = emp.days || {};
        const html = `<form class="satt-schedule" data-satt-form>
            <label class="satt-switch"><input type="checkbox" name="tracked" ${emp.tracked || !Object.keys(days).length ? 'checked' : ''}> Davomat belgilash yoqilgan</label>
            <div class="satt-presets"><span class="satt-muted satt-small">Tez to‘ldirish:</span>
            <button type="button" class="btn-secondary-sm" data-preset="5">Du–Ju 09:00–18:00</button><button type="button" class="btn-secondary-sm" data-preset="6">Du–Sh 09:00–18:00</button></div>
            <div class="satt-days">${DAYS.map(([k, label]) => `<div class="satt-day" data-day="${k}"><label><input type="checkbox" name="on${k}" ${days[k] ? 'checked' : ''}> ${label}</label>
                <input type="time" class="form-control-sm" name="s${k}" value="${esc(days[k]?.start || '09:00')}" aria-label="${label} boshlanishi">
                <span>–</span><input type="time" class="form-control-sm" name="e${k}" value="${esc(days[k]?.end || '18:00')}" aria-label="${label} tugashi"></div>`).join('')}</div>
            <p class="satt-form-msg" role="status"></p>
            <div class="satt-row satt-end"><button type="button" class="btn-secondary-sm" data-cancel>Bekor qilish</button><button type="submit" class="btn-primary-sm">Saqlash</button></div></form>`;
        const body = openSheet(`${emp.name} — ish vaqti`, html);
        const form = body.querySelector('[data-satt-form]');
        const sync = () => DAYS.forEach(([k]) => { const on = form['on' + k].checked; form['s' + k].disabled = !on; form['e' + k].disabled = !on; });
        sync();
        form.addEventListener('change', sync);
        form.querySelectorAll('[data-preset]').forEach(b => { b.onclick = () => { const n = Number(b.dataset.preset); DAYS.forEach(([k], i) => { form['on' + k].checked = i < n; form['s' + k].value = '09:00'; form['e' + k].value = '18:00'; }); sync(); }; });
        form.querySelector('[data-cancel]').onclick = closeSheet;
        form.onsubmit = async e => {
            e.preventDefault();
            const out = {};
            DAYS.forEach(([k]) => { if (form['on' + k].checked) out[k] = { start: form['s' + k].value, end: form['e' + k].value }; });
            try {
                await api(`/employees/${encodeURIComponent(emp.id)}/schedule`, { tracked: form.tracked.checked, days: out }, 'PUT');
                closeSheet(); renderHrSection();
            } catch (err) { form.querySelector('.satt-form-msg').textContent = err.message; }
        };
    }

    function openReview(emp) {
        const body = openSheet(`${emp.name} — yuz namunasi`, `<div class="satt-review"><img data-satt-photo="${esc(emp.facePhotoId)}" alt="${esc(emp.name)} yuz namunasi">
            <p>Rasmdagi odam haqiqatan <b>${esc(emp.name)}</b> ekanini tekshiring. Tasdiqlangach har kuni shu yuz bilan solishtiriladi.</p>
            <p class="satt-form-msg" role="status"></p>
            <div class="satt-row satt-end"><button type="button" class="btn-danger-sm" data-decision="reject">Rad etish</button><button type="button" class="btn-primary-sm" data-decision="approve">Tasdiqlash</button></div></div>`);
        hydratePhotos(body);
        body.querySelectorAll('[data-decision]').forEach(b => { b.onclick = async () => {
            try { await api(`/employees/${encodeURIComponent(emp.id)}/face/review`, { decision: b.dataset.decision, photoId: emp.facePhotoId }); closeSheet(); renderHrSection(); }
            catch (err) { body.querySelector('.satt-form-msg').textContent = err.message; }
        }; });
    }

    async function renderSettings(body) {
        const s = await api('/settings');
        body.innerHTML = `<form class="satt-settings" data-satt-settings>
            <fieldset><legend>Ofis joylashuvi</legend>
            <label>Nomi<input class="form-control-sm" name="name" value="${esc(s.office.name)}" maxlength="120"></label>
            <div class="satt-grid"><label>Kenglik (lat)<input class="form-control-sm" name="lat" inputmode="decimal" value="${s.office.lat}"></label>
            <label>Uzunlik (lng)<input class="form-control-sm" name="lng" inputmode="decimal" value="${s.office.lng}"></label>
            <label>Radius, metr<input class="form-control-sm" type="number" name="radius" min="30" max="2000" value="${s.office.radius}"></label></div>
            <div class="satt-row"><button type="button" class="btn-secondary-sm" data-satt-here>Hozirgi joylashuvimni olish</button>
            <a href="https://yandex.uz/maps/?pt=${s.office.lng},${s.office.lat}&z=17&l=map" target="_blank" rel="noopener" data-satt-map>Xaritada tekshirish</a></div>
            <label>Ofis internetining IP manzillari (kompyuterdan belgilash uchun, vergul bilan)
            <input class="form-control-sm" name="officeIps" value="${esc((s.officeIps || []).join(', '))}" placeholder="masalan: 213.230.100.10"></label>
            <p class="satt-muted satt-small">Kompyuterlarda GPS yo‘q. Ofis Wi-Fi’sining tashqi IP manzili kiritilsa, shu internetdan kelgan belgilash ofisda deb hisoblanadi.${s.yourIp ? ` Hozirgi IP manzilingiz: <b>${esc(s.yourIp)}</b> — ofisda bo‘lsangiz shuni kiriting.` : ''}</p></fieldset>
            <fieldset><legend>Qoidalar</legend><div class="satt-grid">
            <label>Kechikishga imtiyoz, daq<input class="form-control-sm" type="number" name="graceMinutes" min="0" max="120" value="${s.graceMinutes}"></label>
            <label>“Kelmadi” deb hisoblash, ish boshlanib necha daq o‘tgach<input class="form-control-sm" type="number" name="absentAfterMinutes" min="15" max="720" value="${s.absentAfterMinutes}"></label>
            <label>Erta ketishga imtiyoz, daq<input class="form-control-sm" type="number" name="earlyLeaveGraceMinutes" min="0" max="120" value="${s.earlyLeaveGraceMinutes}"></label>
            <label>GPS aniqligi chegarasi, m<input class="form-control-sm" type="number" name="maxAccuracyMeters" min="20" max="2000" value="${s.maxAccuracyMeters}"></label>
            <label>Belgilash rasmlarini saqlash, kun<input class="form-control-sm" type="number" name="photoRetentionDays" min="7" max="365" value="${s.photoRetentionDays}"></label></div>
            <label class="satt-switch"><input type="checkbox" name="checkTurnDirection" ${s.checkTurnDirection ? 'checked' : ''}> Bosh aynan ko‘rsatilgan tomonga (chap/o‘ng) burilishini tekshirish</label>
            <label class="satt-switch"><input type="checkbox" name="notifyTelegram" ${s.notifyTelegram ? 'checked' : ''}> Kechikish va kelmaslik haqida Telegram’da xabar berish (direktor va ROP)</label>
            <p class="satt-muted satt-small">Xabar @Domworkuz_bot orqali keladi — buning uchun direktor va ROP botga o‘z Telegram akkauntini ulagan bo‘lishi kerak.</p></fieldset>
            <p class="satt-form-msg" role="status"></p><div class="satt-row satt-end"><button type="submit" class="btn-primary-sm">Saqlash</button></div></form>`;
        const form = body.querySelector('[data-satt-settings]');
        form.querySelector('[data-satt-here]').onclick = async () => {
            const msg = form.querySelector('.satt-form-msg');
            msg.textContent = 'Joylashuv aniqlanmoqda…';
            const loc = await locate();
            if (loc.error) { msg.textContent = loc.error; return; }
            form.lat.value = loc.lat.toFixed(6); form.lng.value = loc.lng.toFixed(6);
            msg.textContent = `Joylashuv olindi (aniqlik ±${Math.round(loc.accuracy)} m). Saqlashni unutmang.`;
        };
        form.onsubmit = async e => {
            e.preventDefault();
            const msg = form.querySelector('.satt-form-msg');
            const n = name => Number(String(form[name].value).replace(',', '.'));
            try {
                const saved = await api('/settings', { office: { name: form.name.value, lat: n('lat'), lng: n('lng'), radius: n('radius') },
                    graceMinutes: n('graceMinutes'), absentAfterMinutes: n('absentAfterMinutes'), earlyLeaveGraceMinutes: n('earlyLeaveGraceMinutes'),
                    maxAccuracyMeters: n('maxAccuracyMeters'), photoRetentionDays: n('photoRetentionDays'), notifyTelegram: form.notifyTelegram.checked,
                    officeIps: form.officeIps.value, checkTurnDirection: form.checkTurnDirection.checked }, 'PUT');
                form.officeIps.value = saved.officeIps.join(', ');
                msg.textContent = 'Saqlandi.';
                form.querySelector('[data-satt-map]').href = `https://yandex.uz/maps/?pt=${saved.office.lng},${saved.office.lat}&z=17&l=map`;
            } catch (err) { msg.textContent = err.message; }
        };
    }

    // ── Xodim qo'shish: Davomat (yuz + joylashuv) bo'limi (HrAddStaff / HrAdminAdd) ─────────
    // Ofisda ishlaydiganlar: sotuv, ROP, HR, akademik rahbar, yordamchi ustoz. Xodim saqlangach:
    // grafik -> PUT /employees/:id/schedule, 3x4 rasm -> POST /employees/:id/face (HR tasdiqlagan namuna).
    const TRACKED_ROLES = new Set(['sotuv-menejeri', 'sotuv_menejeri', 'rop', 'hr', 'head-of-teachers', 'yordamchi']);
    const addState = { frames: null, days: null, office: null };
    const defaultDays = () => ({ 1: { start: '09:00', end: '18:00' }, 2: { start: '09:00', end: '18:00' }, 3: { start: '09:00', end: '18:00' }, 4: { start: '09:00', end: '18:00' }, 5: { start: '09:00', end: '18:00' }, 6: { start: '10:00', end: '15:00' } });
    function daysText(days) {
        const g = {};
        for (const [k, l] of DAYS) if (days[k]) (g[`${days[k].start}–${days[k].end}`] ||= []).push(l);
        return Object.entries(g).map(([v, ds]) => `${ds.length > 2 ? ds[0] + '–' + ds[ds.length - 1] : ds.join(', ')} ${v}`).join(' · ') || 'kiritilmagan';
    }
    function addEmployeeField() {
        if (!canManage()) return '';
        addState.frames = null; addState.days = defaultDays();
        return `<div class="satt-add" id="sattAddWrap" hidden>
            <div class="satt-add-h"><div><b>Davomat (yuz + joylashuv)</b><span class="satt-muted satt-small">Ofisda ishlaydiganlar: sotuv, ROP, HR, akademik rahbar, yordamchi ustoz</span></div>
              <label class="satt-switch"><input type="checkbox" id="sattAddTracked" checked> Davomat kuzatiladi</label></div>
            <div class="satt-add-body" id="sattAddBody">
              <div class="satt-add-photo"><div class="satt-add-thumb" id="sattAddThumb" role="img" aria-label="3×4 rasm hali yoʻq">3×4</div>
                <div class="satt-add-btns"><span class="satt-small"><b>3×4 yuz rasmi *</b></span>
                  <button type="button" class="btn-primary-sm" id="sattAddCam">Kamerada olish</button>
                  <label class="btn-secondary-sm satt-file">Fayldan yuklash<input type="file" accept="image/*" id="sattAddFile" hidden></label></div></div>
              <p class="satt-muted satt-small">Yuz toʻgʻridan, yorugʻ joyda, koʻzoynaksiz. Har kungi selfie shu rasm bilan solishtiriladi.</p>
              <button type="button" class="satt-add-row" id="sattAddSched"><span><span class="satt-small"><b>Ish grafigi *</b></span><b id="sattAddSchedTxt">${esc(daysText(addState.days))}</b></span><span class="satt-link">Oʻzgartirish</span></button>
              <label class="satt-small"><b>Ofis *</b><select class="form-control" id="sattAddOffice"><option>Asosiy ofis</option></select></label>
              <p class="satt-muted satt-small">Ofis manzili va radiusini admin belgilaydi</p>
            </div></div>`;
    }
    function setThumb(dataUrl) {
        const t = document.getElementById('sattAddThumb'); if (!t) return;
        t.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="3×4 yuz rasmi">` : '3×4';
    }
    function fileToFrame(file) {
        return new Promise((resolve, reject) => {
            const img = new Image(), url = URL.createObjectURL(file);
            img.onload = () => {
                const c = document.createElement('canvas'); c.width = CAPTURE_W; c.height = CAPTURE_H;
                const ratio = CAPTURE_W / CAPTURE_H, iw = img.naturalWidth, ih = img.naturalHeight;
                let sw = iw, sh = ih, sx = 0, sy = 0;
                if (iw / ih > ratio) { sw = ih * ratio; sx = (iw - sw) / 2; } else { sh = iw / ratio; sy = (ih - sh) / 2; }
                c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, CAPTURE_W, CAPTURE_H);
                URL.revokeObjectURL(url); resolve(c.toDataURL('image/png'));
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Rasmni ochib boʻlmadi')); };
            img.src = url;
        });
    }
    function bindAddEmployee(roleSelectId) {
        const wrap = document.getElementById('sattAddWrap'), role = document.getElementById(roleSelectId);
        if (!wrap || !role) return;
        const sync = () => { wrap.hidden = !TRACKED_ROLES.has(role.value); };
        role.addEventListener('change', sync); sync();
        const tr = document.getElementById('sattAddTracked');
        tr.onchange = () => { document.getElementById('sattAddBody').hidden = !tr.checked; };
        api('/settings').then(s => { const sel = document.getElementById('sattAddOffice'); if (sel) sel.innerHTML = `<option>${esc(s.office.name || 'Asosiy ofis')} · ${s.office.radius} m</option>`; }).catch(() => {});
        document.getElementById('sattAddFile').onchange = async e => {
            const f = e.target.files?.[0]; if (!f) return;
            try { const fr = await fileToFrame(f); addState.frames = [fr, fr]; setThumb(fr); } catch (err) { alert(err.message); }
        };
        document.getElementById('sattAddCam').onclick = () => {
            // Alohida qatlam: asosiy "Xodim qo'shish" modali yopilmaydi.
            const ov = document.createElement('div'); ov.className = 'satt-overlay satt-overlay-top';
            ov.innerHTML = `<div class="satt-sheet" role="dialog" aria-modal="true" aria-label="3×4 rasm"><header class="satt-sheet-head"><h3>3×4 yuz rasmi</h3><button type="button" class="satt-close" aria-label="Yopish">&times;</button></header><div class="satt-sheet-body">${cameraStage('Yuzni ramka ichiga joylang')}</div></div>`;
            document.body.appendChild(ov);
            let cam = null, dead = false;
            const close = () => { dead = true; cam?.stop(); ov.remove(); };
            ov.querySelector('.satt-close').onclick = close;
            (async () => {
                try {
                    const body = ov.querySelector('.satt-sheet-body');
                    cam = await startCamera(body); if (dead) return cam.stop();
                    await countdown(body, 3, 'Kameraga toʻgʻri qarasin'); if (dead) return;
                    const a = grab(cam.video);
                    await countdown(body, 2, 'Yana bir marta, qimirlamasin'); if (dead) return;
                    const b = grab(cam.video);
                    addState.frames = [a, b]; setThumb(a); close();
                } catch (err) { if (!dead) { alert(err.message); close(); } }
            })();
        };
        document.getElementById('sattAddSched').onclick = () => {
            const days = addState.days;
            const ov = document.createElement('div'); ov.className = 'satt-overlay satt-overlay-top';
            ov.innerHTML = `<div class="satt-sheet" role="dialog" aria-modal="true" aria-label="Ish grafigi"><header class="satt-sheet-head"><h3>Ish grafigi</h3><button type="button" class="satt-close" aria-label="Yopish">&times;</button></header>
                <div class="satt-sheet-body"><form class="satt-schedule"><div class="satt-days">${DAYS.map(([k, label]) => `<div class="satt-day"><label><input type="checkbox" name="on${k}" ${days[k] ? 'checked' : ''}> ${label}</label>
                <input type="time" class="form-control-sm" name="s${k}" value="${esc(days[k]?.start || '09:00')}" aria-label="${label} boshlanishi"><span>–</span><input type="time" class="form-control-sm" name="e${k}" value="${esc(days[k]?.end || '18:00')}" aria-label="${label} tugashi"></div>`).join('')}</div>
                <p class="satt-muted satt-small">10 daqiqadan ortiq kechiksa — direktor va rahbariga Telegram xabar</p>
                <div class="satt-row satt-end"><button type="submit" class="btn-primary-sm">Saqlash</button></div></form></div></div>`;
            document.body.appendChild(ov);
            ov.querySelector('.satt-close').onclick = () => ov.remove();
            ov.querySelector('form').onsubmit = e => {
                e.preventDefault(); const f = e.target, out = {};
                DAYS.forEach(([k]) => { if (f['on' + k].checked) out[k] = { start: f['s' + k].value, end: f['e' + k].value }; });
                if (!Object.keys(out).length) { alert('Kamida bitta ish kuni kiriting'); return; }
                addState.days = out; document.getElementById('sattAddSchedTxt').textContent = daysText(out); ov.remove();
            };
        };
    }
    // Saqlashdan oldin: xato matni yoki ''.
    function validateAddEmployee(role) {
        if (!canManage() || !TRACKED_ROLES.has(role) || !document.getElementById('sattAddTracked')?.checked) return '';
        if (!addState.frames) return '3×4 yuz rasmini oling yoki yuklang (Davomat boʻlimi)';
        return '';
    }
    // Xodim va login yaratilgach: grafik va yuz namunasi. Xato bo'lsa xodim saqlangan qoladi — HR keyin "Davomat" bo'limida to'ldiradi.
    async function afterCreateEmployee(empId, role) {
        if (!canManage() || !TRACKED_ROLES.has(role) || !document.getElementById('sattAddTracked')) return '';
        const tracked = document.getElementById('sattAddTracked').checked;
        const errors = [];
        await new Promise(r => setTimeout(r, 1200)); // hr_employees serverga yozilishini kutamiz (state sinxroni)
        for (let i = 0; i < 3; i++) {
            try { await api(`/employees/${encodeURIComponent(empId)}/schedule`, { tracked, days: addState.days || defaultDays() }, 'PUT'); break; }
            catch (e) { if (e.status !== 404 || i === 2) { errors.push('grafik: ' + e.message); break; } await new Promise(r => setTimeout(r, 1500)); }
        }
        if (tracked && addState.frames) {
            try { await api(`/employees/${encodeURIComponent(empId)}/face`, { frames: addState.frames }); }
            catch (e) { errors.push('yuz rasmi: ' + e.message); }
        }
        addState.frames = null;
        return errors.length ? `Davomat toʻliq saqlanmadi (${errors.join('; ')}). HR → Davomat → Xodimlar va grafik boʻlimida toʻldiring.` : '';
    }

    function init() {
        refreshMe();
        // Kun davomida holat yangilanib tursin (masalan, ertalab ochib qo'yilgan sahifa).
        setInterval(() => { if (document.visibilityState === 'visible' && !overlay) refreshMe(); }, 10 * 60 * 1000);
    }

    window.staffAttendanceUI = { init, renderHr, openCheckSheet, refreshMe, addEmployeeField, bindAddEmployee, validateAddEmployee, afterCreateEmployee };
})();
