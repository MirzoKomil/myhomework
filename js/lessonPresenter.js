// Darslik markazi — "Darsni boshlash" (prezentatsiya) oynasi va kitob o'quvchi.
// Bitta to'liq ekran oyna: PDF sahifalari, rasm slaydlar, so'z kartochkalari,
// kitob sahifasi yoki toza doska. Har slayd ustida chizish qatlami (qalam,
// marker, o'chirg'ich, lazer) — sessiya davomida har slaydda saqlanadi.
// Dars ma'lumoti berilsa (lesson): o'ngda dars rejasi (daqiqalar bilan, joriy
// blok vaqt bo'yicha belgilanadi), ustoz kitobi va so'zlar paneli; yuqorida
// "Darsni tugatish" (finish.onFinish — js/lessonStart.js davomatga "Keldi" qo'yadi).
(function () {
    'use strict';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const plain = s => String(s ?? '').replace(/́/g, '');
    const COLORS = ['#E5484D', '#0065D6', '#16A34A', '#F59E0B', '#111827', '#FFFFFF'];
    const pdfCache = new Map();
    const I = {
        back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
        next: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
        dots: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
        hand: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l7 17 2-7 7-2z"/></svg>',
        pen: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
        marker: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l-6 6v3h9l3-3"/><path d="M22 12l-4.6 4.6a2 2 0 01-2.8 0l-5.2-5.2a2 2 0 010-2.8L14 4"/></svg>',
        eraser: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20H9L4 15a2 2 0 010-2.8L13.2 3a2 2 0 012.8 0L21 8a2 2 0 010 2.8L12 20"/><path d="M6 11l7 7"/></svg>',
        laser: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
        undo: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/></svg>',
        trash: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
        book: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/></svg>',
    };

    async function loadPdf(url) {
        if (!pdfCache.has(url)) {
            pdfCache.set(url, (async () => {
                if (typeof _ensurePdfJsLoaded === 'function') await _ensurePdfJsLoaded();
                if (!window.pdfjsLib) throw new Error("PDF kutubxonasi yuklanmadi");
                return window.pdfjsLib.getDocument({ url, isEvalSupported: false }).promise;
            })());
        }
        try { return await pdfCache.get(url); }
        catch (e) { pdfCache.delete(url); throw e; }
    }

    // PDF/fayl xatosi → foydalanuvchiga o'zbekcha sabab (pdf.js "Missing PDF …" kabi xom inglizcha matn ko'rsatilmaydi).
    function fileErr(e) {
        const m = String(e?.message || ''), st = Number(e?.status) || 0;
        if (st === 404 || /Missing PDF|404/i.test(m)) return { message: 'Fayl serverda topilmadi — administratorga xabar bering' };
        if (st >= 500) return { status: st, message: 'Server xatosi' };
        if (/Invalid PDF|corrupt|FormatError/i.test(m)) return { message: 'Fayl buzilgan yoki PDF emas' };
        if (/PDF kutubxonasi/.test(m)) return { message: m };
        if (e?.name === 'TypeError' || /Failed to fetch|NetworkError|Unexpected server response \(0\)/i.test(m)) return { name: 'TypeError', message: m };
        return { message: 'Faylni ochib bo\'lmadi' };
    }
    const errCard = (title, e) => (window.LoadErr ? window.LoadErr.html({ title, err: fileErr(e), note: '', cls: 'lp-lerr' })
        : `<div class="lp-empty">${esc(title)}</div>`);

    // Manba (source) → slaydlar ro'yxati.
    async function expandSource(src) {
        if (src.type === 'pdf') {
            const doc = await loadPdf(src.url);
            return Array.from({ length: doc.numPages }, (_, i) => ({ type: 'pdf', url: src.url, page: i + 1, label: `${src.title} · ${i + 1}-bet` }));
        }
        if (src.type === 'images') return src.items.map((it, i) => ({ type: 'image', url: it.url, caption: it.caption || '', label: `${src.title} · ${i + 1}` }));
        if (src.type === 'words') return src.items.map((w, i) => ({ type: 'word', word: w, label: `So'z ${i + 1}/${src.items.length}` }));
        if (src.type === 'video') return [{ type: 'video', url: src.url, label: src.title }];
        return [{ type: 'blank', label: "Toza doska" }];
    }

    function ytEmbed(url) {
        const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
        return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
    }
    const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

    // Dars rejasi bloklari (daqiqalar bilan) — lessonHub bilan bir xil algoritm.
    function planBlocks(lesson, duration) {
        const plan = lesson?.plan;
        if (!plan?.blocks) return [];
        if (plan.mode !== 'live') return plan.blocks.map(b => ({ ...b, minutes: null }));
        const set = duration <= 20 && plan.shortBlocks ? plan.shortBlocks : duration <= 35 && plan.mediumBlocks ? plan.mediumBlocks : plan.blocks;
        const R = window.AcademicRules;
        const mins = R?.allocateMinutes ? R.allocateMinutes(set, duration) : set.map(b => Math.max(1, Math.round((b.share / 100) * duration)));
        let used = 0;
        return set.map((b, i) => { const from = used; used += mins[i]; return { ...b, minutes: mins[i], from, to: used }; });
    }

    // ── Prezentatsiya ───────────────────────────────────────────────────────
    function open({ sources, start = 0, startPage = 1, title = '', subtitle = '', lesson = null, duration = 0, finish = null, presence = null }) {
        const list = (sources || []).filter(Boolean);
        if (!list.find(s => s.type === 'blank')) list.push({ type: 'blank', title: "Toza doska", key: 'blank' });
        close();
        const data = lesson && lesson.lesson ? lesson : null;
        const L = data?.lesson || null;
        const blocks = planBlocks(L, duration || 60);
        const hasSide = !!L;
        const blankIdx = list.findIndex(s => s.type === 'blank');
        const bookIdx = list.findIndex(s => s.key === 'book');
        const slideIdx = Math.max(0, list.findIndex(s => s.type !== 'blank' && s.key !== 'book' && s.key !== 'guide'));
        const guides = (data?.guides || []);
        const root = document.createElement('div');
        root.className = 'lp' + (hasSide ? ' has-side' : '');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', title || 'Prezentatsiya');
        root.innerHTML = `
        <header class="lp-top">
            <button type="button" class="lp-back" data-act="close" title="Yopish (Esc)">${I.back}<span>Darslik</span></button>
            <div class="lp-ttl"><b title="${esc(title)}">${esc(title)}</b>${subtitle ? `<span>${esc(subtitle)}</span>` : ''}</div>
            ${presence?.studentId ? '<span class="lp-pres" role="status" hidden></span>' : ''}
            <button type="button" class="lp-timer" title="Dars vaqti (bosib to'xtatish)"><b>00:00</b>${duration ? `<span>/ ${String(duration).padStart(2, '0')}:00</span>` : ''}</button>
            <span class="lp-flex"></span>
            <div class="lp-seg" role="group" aria-label="Ko'rinish">
                <button type="button" data-mode="slide" aria-pressed="true">Slayd</button>
                <button type="button" data-mode="blank" aria-pressed="false">Toza doska</button>
                <button type="button" data-mode="book" aria-pressed="false"${bookIdx < 0 ? ' disabled title="Kitob PDF yuklanmagan"' : ''}>Kitob sahifasi</button>
            </div>
            <div class="lp-more-wrap">
                <button type="button" class="lp-sq" data-act="more" aria-haspopup="true" aria-expanded="false" aria-label="Yana">${I.dots}</button>
                <div class="lp-menu" hidden role="menu">
                    <label class="lp-menu-l">Material<select class="lp-source" aria-label="Material">${list.map((s, i) => `<option value="${i}">${esc(s.title)}</option>`).join('')}</select></label>
                    <button type="button" role="menuitem" data-act="full">To'liq ekran (F)</button>
                    <button type="button" role="menuitem" data-act="reveal" hidden>Tarjimani ko'rsatish (T)</button>
                    <button type="button" role="menuitem" data-act="addblank">Shu joyga toza doska qo'shish (B)</button>
                    <button type="button" role="menuitem" data-act="save">Slaydni PNG qilib saqlash</button>
                    ${hasSide ? '<button type="button" role="menuitem" data-act="side">Dars rejasi panelini yashirish</button>' : ''}
                    <label class="lp-menu-l">Qalinlik<select class="lp-size" aria-label="Qalinlik"><option value="3">Ingichka</option><option value="6" selected>O'rta</option><option value="12">Qalin</option></select></label>
                </div>
            </div>
            ${finish ? `<button type="button" class="lp-finish" data-act="finish">${esc(finish.label || 'Darsni tugatish')}</button>` : '<button type="button" class="lp-finish is-ghost" data-act="close">Yopish</button>'}
        </header>
        <div class="lp-body">
            <div class="lp-main">
                <div class="lp-rail" role="toolbar" aria-label="Chizish asboblari">
                    <button type="button" class="lp-tool is-on" data-tool="none" title="Ko'rsatish (V)" aria-label="Ko'rsatish">${I.hand}</button>
                    <button type="button" class="lp-tool" data-tool="pen" title="Qalam (P)" aria-label="Qalam">${I.pen}</button>
                    <button type="button" class="lp-tool" data-tool="marker" title="Marker (M)" aria-label="Marker">${I.marker}</button>
                    <button type="button" class="lp-tool" data-tool="eraser" title="O'chirg'ich (E)" aria-label="O'chirg'ich">${I.eraser}</button>
                    <button type="button" class="lp-tool" data-tool="laser" title="Lazer (L)" aria-label="Lazer">${I.laser}</button>
                    <span class="lp-rsep"></span>
                    <button type="button" class="lp-colorbtn" data-act="color" title="Rang" aria-label="Rang"><i style="background:${COLORS[0]}"></i></button>
                    <div class="lp-colors" hidden>${COLORS.map((c, i) => `<button type="button" class="lp-color${i === 0 ? ' is-on' : ''}" data-color="${c}" style="background:${c}" aria-label="Rang ${c}"></button>`).join('')}</div>
                    <button type="button" class="lp-tool" data-act="undo" title="Ortga (Ctrl+Z)" aria-label="Ortga">${I.undo}</button>
                    <button type="button" class="lp-tool" data-act="clear" title="Slayddagi chizmalarni tozalash" aria-label="Tozalash">${I.trash}</button>
                </div>
                <div class="lp-stage">
                    <div class="lp-slide"></div>
                    <canvas class="lp-ink"></canvas>
                    <div class="lp-laser"></div>
                    <div class="lp-loading" hidden>Yuklanmoqda…</div>
                </div>
                <div class="lp-foot">
                    <button type="button" class="lp-sq" data-act="prev" title="Oldingi (←)" aria-label="Oldingi">${I.back}</button>
                    <span class="lp-count">1 / 1</span>
                    <button type="button" class="lp-sq" data-act="next" title="Keyingi (→)" aria-label="Keyingi">${I.next}</button>
                    <div class="lp-thumbs" aria-label="Slaydlar"></div>
                </div>
            </div>
            ${hasSide ? `<aside class="lp-side" aria-label="Dars rejasi">
                <div class="lp-stabs" role="tablist">
                    <button type="button" role="tab" data-stab="plan" aria-selected="true">Dars rejasi</button>
                    <button type="button" role="tab" data-stab="guide" aria-selected="false">Ustoz kitobi</button>
                    <button type="button" role="tab" data-stab="words" aria-selected="false">So'zlar</button>
                </div>
                <div class="lp-spanel"></div>
            </aside>` : ''}
        </div>`;
        document.body.appendChild(root);
        document.body.classList.add('lp-open');

        const $ = sel => root.querySelector(sel);
        const stage = $('.lp-stage'), slideEl = $('.lp-slide'), ink = $('.lp-ink'), laser = $('.lp-laser');
        const ctx = ink.getContext('2d');
        const st = { slides: [], index: 0, tool: 'none', color: COLORS[0], size: 6, ink: new Map(), undo: [], revealed: false, renderToken: 0, srcIndex: start, stab: 'plan' };
        const key = () => `${st.srcIndex}:${st.index}`;

        // Taymer
        const startedAt = Date.now();
        let paused = 0, pausedAt = null;
        const timerEl = $('.lp-timer');
        const elapsed = () => (pausedAt || Date.now()) - startedAt - paused;
        let lastBlock = -1;
        const timer = setInterval(() => {
            timerEl.querySelector('b').textContent = mmss(elapsed());
            if (hasSide && st.stab === 'plan') {
                const b = currentBlock();
                if (b !== lastBlock) { lastBlock = b; drawSide(); }
            }
        }, 500);
        timerEl.addEventListener('click', () => {
            if (pausedAt) { paused += Date.now() - pausedAt; pausedAt = null; timerEl.classList.remove('is-paused'); }
            else { pausedAt = Date.now(); timerEl.classList.add('is-paused'); }
        });
        function currentBlock() {
            const m = elapsed() / 60000;
            const i = blocks.findIndex(b => b.minutes != null && m >= b.from && m < b.to);
            return i < 0 && blocks.length && blocks[0].minutes != null && m >= blocks[blocks.length - 1].to ? blocks.length - 1 : i;
        }

        // ── O'ng panel ──
        function drawSide() {
            const panel = $('.lp-spanel');
            if (!panel) return;
            root.querySelectorAll('[data-stab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.stab === st.stab)));
            if (st.stab === 'plan') {
                const cur = currentBlock();
                const tb = guides.find(g => g.kind === 'teacher_book' && !/yordamchi|assistant/i.test(g.title));
                panel.innerHTML = `${tb ? `<button type="button" class="lp-src" data-guide="${esc(tb.id)}">${I.book}<span>Ustoz kitobi · ${tb.page}-bet</span></button>` : ''}
                    ${L.cando ? `<p class="lp-goal"><b>Maqsad:</b> ${esc(L.cando)}</p>` : ''}
                    <ol class="lp-blocks">${blocks.map((b, i) => `<li class="lp-blk${i === cur ? ' is-now' : ''}">
                        <b class="lp-bmin">${b.minutes != null ? `${b.minutes} daq` : esc(b.when || '')}</b>
                        <div><b>${esc(b.title)}</b>${(b.items || []).length ? `<span>${esc(b.items.slice(0, 3).map(plain).join(' · '))}</span>` : ''}
                        ${i === cur && b.tip ? `<em>${esc(b.tip)}</em>` : ''}</div></li>`).join('')}</ol>`;
            } else if (st.stab === 'guide') {
                panel.innerHTML = guides.length ? `<div class="lp-glist">${guides.map(g => `<button type="button" class="lp-src" data-guide="${esc(g.id)}">${I.book}<span>${esc(g.title)} · ${g.page}-bet</span></button>`).join('')}</div>
                    ${(L.plan?.anticipated || []).length ? `<h4 class="lp-sh">Kutiladigan qiyinchiliklar</h4><ul class="lp-ul">${L.plan.anticipated.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}`
                    : `<p class="lp-empty-s">Ustoz kitobi shu darsga bog'lanmagan. Admin "Ommaviy yuklash" orqali qo'shadi.</p>
                    ${(L.plan?.anticipated || []).length ? `<h4 class="lp-sh">Kutiladigan qiyinchiliklar</h4><ul class="lp-ul">${L.plan.anticipated.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}`;
            } else {
                const words = L.vocabulary || [];
                panel.innerHTML = words.length ? `<ul class="lp-words">${words.map((w, i) => `<li><button type="button" data-word="${i}"><b>${esc(w.word)}</b><span>${esc(w.translation)}</span></button></li>`).join('')}</ul>`
                    : '<p class="lp-empty-s">Bu darsda so\'zlar kiritilmagan.</p>';
            }
        }
        root.querySelectorAll('[data-stab]').forEach(b => b.addEventListener('click', () => { st.stab = b.dataset.stab; drawSide(); }));
        $('.lp-spanel')?.addEventListener('click', e => {
            const g = e.target.closest('[data-guide]');
            if (g) {
                const gd = guides.find(x => x.id === g.dataset.guide);
                const i = list.findIndex(s => s.key === 'guide' && s.id === g.dataset.guide);
                if (gd && i >= 0) loadSource(i, gd.page);
                else if (gd?.url) window.open(gd.url, '_blank', 'noopener');
                return;
            }
            const w = e.target.closest('[data-word]');
            if (w) { const i = list.findIndex(s => s.key === 'words'); if (i >= 0) loadSource(i, Number(w.dataset.word) + 1); }
        });

        function sizeInk() {
            const r = slideEl.getBoundingClientRect(), sr = stage.getBoundingClientRect();
            const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
            ink.style.left = (r.left - sr.left) + 'px';
            ink.style.top = (r.top - sr.top) + 'px';
            ink.style.width = w + 'px';
            ink.style.height = h + 'px';
            const dpr = window.devicePixelRatio || 1;
            if (ink.width !== Math.round(w * dpr) || ink.height !== Math.round(h * dpr)) {
                ink.width = Math.round(w * dpr);
                ink.height = Math.round(h * dpr);
            }
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            restoreInk();
        }
        function saveInk() {
            if (!ink.width) return;
            st.ink.set(key(), ink.toDataURL('image/png'));
        }
        function restoreInk() {
            ctx.clearRect(0, 0, ink.width, ink.height);
            const d = st.ink.get(key());
            if (!d) return;
            const img = new Image();
            const k = key();
            img.onload = () => { if (k === key()) ctx.drawImage(img, 0, 0, ink.width, ink.height); };
            img.src = d;
        }

        function drawThumbs() {
            const box = $('.lp-thumbs');
            const max = 150;
            const items = st.slides.slice(0, max);
            box.innerHTML = items.map((s, i) => `<button type="button" class="lp-th${i === st.index ? ' is-on' : ''}" data-th="${i}" aria-label="${i + 1}-slayd"${i === st.index ? ' aria-current="true"' : ''}>
                ${s.type === 'image' ? `<img src="${esc(s.url)}" alt="" loading="lazy">` : s.type === 'word' ? `<em>${esc(s.word.word)}</em>` : '<i></i><i></i>'}<span>${i + 1}</span></button>`).join('');
            box.querySelector('.is-on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
        }
        function syncSeg() {
            const s = list[st.srcIndex];
            const mode = s?.type === 'blank' ? 'blank' : s?.key === 'book' ? 'book' : 'slide';
            root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
        }

        async function renderSlide() {
            const token = ++st.renderToken;
            const s = st.slides[st.index];
            $('.lp-count').textContent = `${st.slides.length ? st.index + 1 : 0} / ${st.slides.length}`;
            $('[data-act="reveal"]').hidden = !s || s.type !== 'word';
            root.querySelectorAll('.lp-th').forEach((b, i) => { b.classList.toggle('is-on', i === st.index); if (i === st.index) { b.setAttribute('aria-current', 'true'); b.scrollIntoView({ block: 'nearest', inline: 'center' }); } else b.removeAttribute('aria-current'); });
            st.revealed = false;
            st.undo = [];
            slideEl.className = 'lp-slide';
            // Manba yuklanmadi (masalan, fayl 404) — bo'sh holat ("Material yo'q 0/0") emas, xato kartasi + "Qayta urinish".
            if (!s && st.loadErr) {
                slideEl.innerHTML = errCard('Materialni ochib bo\'lmadi', st.loadErr);
                $('.lp-count').textContent = '—';
                const at = st.srcIndex;
                window.LoadErr?.bind(slideEl, () => loadSource(at, 1));
                sizeInk(); return;
            }
            if (!s) { slideEl.innerHTML = '<div class="lp-empty">Material yo\'q</div>'; sizeInk(); return; }
            if (s.type === 'pdf') {
                $('.lp-loading').hidden = false;
                try {
                    const doc = await loadPdf(s.url);
                    const page = await doc.getPage(s.page);
                    if (token !== st.renderToken) return;
                    const sr = stage.getBoundingClientRect();
                    const base = page.getViewport({ scale: 1 });
                    const scale = Math.min((sr.width - 40) / base.width, (sr.height - 40) / base.height);
                    const dpr = window.devicePixelRatio || 1;
                    const vp = page.getViewport({ scale: scale * dpr });
                    const c = document.createElement('canvas');
                    c.width = vp.width; c.height = vp.height;
                    c.style.width = (vp.width / dpr) + 'px';
                    c.style.height = (vp.height / dpr) + 'px';
                    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
                    if (token !== st.renderToken) return;
                    slideEl.innerHTML = '';
                    slideEl.appendChild(c);
                } catch (e) {
                    slideEl.innerHTML = `<div class="lp-empty">PDF ochilmadi: ${esc(e.message)}</div>`;
                } finally { $('.lp-loading').hidden = true; }
            } else if (s.type === 'image') {
                slideEl.innerHTML = `<img src="${esc(s.url)}" alt="${esc(s.caption || s.label)}">${s.caption ? `<div class="lp-caption">${esc(s.caption)}</div>` : ''}`;
                const img = slideEl.querySelector('img');
                await new Promise(r => { if (img.complete) r(); else { img.onload = r; img.onerror = r; } });
                if (token !== st.renderToken) return;
            } else if (s.type === 'word') {
                const w = s.word;
                slideEl.classList.add('is-card');
                slideEl.innerHTML = `
                    ${w.imageUrl ? `<img class="lp-wimg" src="${esc(w.imageUrl)}" alt="">` : (w.icon ? `<div class="lp-wicon">${esc(w.icon)}</div>` : '')}
                    <div class="lp-word">${esc(w.word)}</div>
                    ${w.transcript ? `<div class="lp-tr">${esc(w.transcript)}</div>` : ''}
                    <div class="lp-trans" hidden>${esc(w.translation)}</div>
                    ${w.example ? `<div class="lp-ex" hidden>${esc(w.example)}</div>` : ''}`;
            } else if (s.type === 'video') {
                const yt = ytEmbed(s.url);
                slideEl.classList.add('is-video');
                slideEl.innerHTML = yt ? `<iframe src="${esc(yt)}" title="Video" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`
                    : `<video src="${esc(s.url)}" controls></video>`;
            } else {
                slideEl.classList.add('is-blank');
                slideEl.innerHTML = '';
            }
            requestAnimationFrame(sizeInk);
        }

        async function loadSource(i, page = 1) {
            saveInk();
            st.srcIndex = i;
            $('.lp-source').value = String(i);
            $('.lp-loading').hidden = false;
            st.loadErr = null;
            try { st.slides = await expandSource(list[i]); }
            catch (e) { st.slides = []; st.loadErr = e; }
            finally { $('.lp-loading').hidden = true; }
            st.index = Math.max(0, Math.min(st.slides.length - 1, (page || 1) - 1));
            syncSeg();
            drawThumbs();
            if (list[i]?.type === 'blank' && st.tool === 'none') setTool('pen');
            await renderSlide();
        }
        function go(delta) { goTo(st.index + delta); }
        function goTo(n) {
            if (!st.slides.length) return;
            const next = Math.max(0, Math.min(st.slides.length - 1, n));
            if (next === st.index) return;
            saveInk();
            st.index = next;
            renderSlide();
        }
        function setTool(tool) {
            st.tool = tool;
            root.querySelectorAll('.lp-tool[data-tool]').forEach(b => { const on = b.dataset.tool === tool; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
            ink.style.pointerEvents = tool === 'none' ? 'none' : 'auto';
            stage.classList.toggle('is-laser', tool === 'laser');
            if (tool !== 'laser') laser.style.display = 'none';
        }
        function reveal() {
            st.revealed = !st.revealed;
            slideEl.querySelectorAll('.lp-trans,.lp-ex').forEach(el => { el.hidden = !st.revealed; });
        }
        function setMode(mode) {
            if (mode === 'blank' && blankIdx >= 0) return loadSource(blankIdx);
            if (mode === 'book' && bookIdx >= 0) return loadSource(bookIdx, list[bookIdx].page || 1);
            if (mode === 'slide') return loadSource(slideIdx);
        }

        // Chizish
        let drawing = false, last = null;
        const pos = e => {
            const r = ink.getBoundingClientRect(), dpr = ink.width / r.width;
            return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr, dpr };
        };
        ink.addEventListener('pointerdown', e => {
            if (st.tool === 'none' || st.tool === 'laser') return;
            e.preventDefault();
            ink.setPointerCapture(e.pointerId);
            st.undo.push(ctx.getImageData(0, 0, ink.width, ink.height));
            if (st.undo.length > 30) st.undo.shift();
            drawing = true;
            last = pos(e);
        });
        ink.addEventListener('pointermove', e => {
            if (st.tool === 'laser') {
                const sr = stage.getBoundingClientRect();
                laser.style.display = 'block';
                laser.style.left = (e.clientX - sr.left) + 'px';
                laser.style.top = (e.clientY - sr.top) + 'px';
                return;
            }
            if (!drawing) return;
            const p = pos(e);
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (st.tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = st.size * 4 * p.dpr;
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = st.color;
                ctx.globalAlpha = st.tool === 'marker' ? 0.35 : 1;
                ctx.lineWidth = (st.tool === 'marker' ? st.size * 3 : st.size) * p.dpr;
            }
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ctx.restore();
            last = p;
        });
        const endDraw = () => { if (drawing) { drawing = false; saveInk(); } };
        ink.addEventListener('pointerup', endDraw);
        ink.addEventListener('pointercancel', endDraw);
        ink.addEventListener('pointerleave', () => { if (st.tool === 'laser') laser.style.display = 'none'; });

        function savePng() {
            const out = document.createElement('canvas');
            out.width = ink.width; out.height = ink.height;
            const o = out.getContext('2d');
            o.fillStyle = '#fff';
            o.fillRect(0, 0, out.width, out.height);
            const base = slideEl.querySelector('canvas, img');
            try { if (base) o.drawImage(base, 0, 0, out.width, out.height); } catch { /* boshqa domendagi rasm */ }
            o.drawImage(ink, 0, 0);
            const a = document.createElement('a');
            a.download = `slayd-${st.index + 1}.png`;
            try { a.href = out.toDataURL('image/png'); a.click(); }
            catch { if (typeof showMiniToast === 'function') showMiniToast("Bu slaydni saqlab bo'lmadi (tashqi rasm)"); }
        }
        const menu = $('.lp-menu'), moreBtn = $('[data-act="more"]');
        const setMenu = on => { menu.hidden = !on; moreBtn.setAttribute('aria-expanded', String(on)); };

        root.addEventListener('click', e => {
            if (!e.target.closest('.lp-more-wrap')) setMenu(false);
            if (!e.target.closest('.lp-colors,[data-act="color"]')) $('.lp-colors').hidden = true;
            const b = e.target.closest('button');
            if (!b || b.disabled) return;
            if (b.dataset.th !== undefined) return goTo(Number(b.dataset.th));
            if (b.dataset.mode) return setMode(b.dataset.mode);
            if (b.dataset.tool) return setTool(b.dataset.tool);
            if (b.dataset.color) {
                st.color = b.dataset.color;
                root.querySelectorAll('.lp-color').forEach(x => x.classList.toggle('is-on', x === b));
                $('.lp-colorbtn i').style.background = st.color;
                $('.lp-colors').hidden = true;
                if (st.tool === 'none' || st.tool === 'eraser' || st.tool === 'laser') setTool('pen');
                return;
            }
            const act = b.dataset.act;
            if (act === 'close') close();
            else if (act === 'more') setMenu(menu.hidden);
            else if (act === 'color') $('.lp-colors').hidden = !$('.lp-colors').hidden;
            else if (act === 'prev') go(-1);
            else if (act === 'next') go(1);
            else if (act === 'undo') { const d = st.undo.pop(); if (d) { ctx.putImageData(d, 0, 0); saveInk(); } }
            else if (act === 'clear') { st.undo.push(ctx.getImageData(0, 0, ink.width, ink.height)); ctx.clearRect(0, 0, ink.width, ink.height); saveInk(); }
            else if (act === 'addblank') {
                setMenu(false);
                saveInk();
                // Keyingi slaydlarning chizmalari bir pog'ona suriladi.
                const shifted = new Map();
                for (const [k, v] of st.ink) {
                    const [si, idx] = k.split(':').map(Number);
                    shifted.set(si === st.srcIndex && idx > st.index ? `${si}:${idx + 1}` : k, v);
                }
                st.ink = shifted;
                st.slides.splice(st.index + 1, 0, { type: 'blank', label: "Toza doska" });
                st.index += 1;
                drawThumbs();
                renderSlide();
                setTool('pen');
            }
            else if (act === 'reveal') reveal();
            else if (act === 'save') { setMenu(false); savePng(); }
            else if (act === 'side') {
                setMenu(false);
                root.classList.toggle('side-off');
                b.textContent = root.classList.contains('side-off') ? "Dars rejasi panelini ko'rsatish" : 'Dars rejasi panelini yashirish';
                setTimeout(() => { saveInk(); renderSlide(); }, 30);
            }
            else if (act === 'full') {
                setMenu(false);
                if (document.fullscreenElement) document.exitFullscreen?.();
                else root.requestFullscreen?.().catch(() => {});
            }
            else if (act === 'finish' && finish?.onFinish) finish.onFinish({ startedAt, root, close });
        });
        $('.lp-source').addEventListener('change', e => { setMenu(false); loadSource(Number(e.target.value)); });
        $('.lp-size').addEventListener('change', e => { st.size = Number(e.target.value) || 6; });
        const onKey = e => {
            if (root.querySelector('.lp-dlg-bg')) { if (e.key === 'Escape') root.querySelector('.lp-dlg-bg').remove(); return; }
            if (e.target.closest && e.target.closest('select,input,textarea')) return;
            const k = e.key;
            if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); go(1); }
            else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(-1); }
            else if (k === 'Escape' && !menu.hidden) setMenu(false);
            else if (k === 'Escape' && !document.fullscreenElement) close();
            else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); root.querySelector('[data-act="undo"]').click(); }
            else if (e.ctrlKey || e.metaKey || e.altKey) return;
            else if (k === 'b' || k === 'B') root.querySelector('[data-act="addblank"]').click();
            else if (k === 'f' || k === 'F') root.querySelector('[data-act="full"]').click();
            else if (k === 't' || k === 'T') reveal();
            else if ('vpmel'.includes(k.toLowerCase()) && k.length === 1) setTool({ v: 'none', p: 'pen', m: 'marker', e: 'eraser', l: 'laser' }[k.toLowerCase()]);
        };
        const onResize = () => { saveInk(); renderSlide(); };
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', onResize);
        document.addEventListener('fullscreenchange', onResize);
        // O'quvchi holati (DarsBoshlash dizayni, "● Malika onlayn"): ilovadagi so'nggi faollik — sessiya, o'qish vaqti
        // yoki vazifa natijasi (/api/academic/students/:id/presence). 3 daqiqadan yangi bo'lsa — yashil "ilovada".
        // Video aloqa (Meet/Zoom) holatini tizim bilmaydi — shuning uchun u ko'rsatilmaydi.
        let presTimer = null;
        const presEl = root.querySelector('.lp-pres');
        if (presEl) {
            const first = String(presence.name || '').trim().split(/\s+/)[0] || "O'quvchi";
            const show = r => {
                const at = r?.lastActive ? new Date(r.lastActive) : null;
                const min = at ? Math.max(0, Math.round((Date.now() - at) / 60000)) : null;
                let txt, on = false;
                if (min === null) txt = `${first} ilovaga hali kirmagan`;
                else if (min <= 3) { txt = `● ${first} ilovada`; on = true; }
                else if (min < 60) txt = `${first} ilovada edi · ${min} daq oldin`;
                else if (min < 24 * 60) txt = `${first} ilovada edi · ${Math.round(min / 60)} soat oldin`;
                else txt = `${first} ilovada edi · ${Math.round(min / 1440)} kun oldin`;
                presEl.textContent = txt;
                presEl.title = at ? `Ilovadagi so'nggi faollik: ${at.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : "O'quvchi ilovasida faollik yo'q";
                presEl.classList.toggle('is-on', on);
                presEl.hidden = false;
            };
            const load = () => apiFetch(`/api/academic/students/${encodeURIComponent(presence.studentId)}/presence`).then(show).catch(() => { presEl.hidden = true; });
            load();
            presTimer = setInterval(load, 60000);
        }
        root._cleanup = () => {
            clearInterval(timer);
            clearInterval(presTimer);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onResize);
            document.removeEventListener('fullscreenchange', onResize);
        };
        setTool('none');
        if (hasSide) drawSide();
        loadSource(Math.min(start, list.length - 1), startPage);
        root.querySelector('[data-act="next"]').focus();
    }

    function close() {
        const root = document.querySelector('.lp');
        if (!root) return;
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        root._cleanup?.();
        root.remove();
        document.body.classList.remove('lp-open');
    }

    // ── Kitob / PDF o'quvchi (sahifada, modal emas) ─────────────────────────
    // spread: keng ekranda ikki sahifa yonma-yon (kitob ochilgandek).
    async function mountPdfReader(el, { url, page = 1, onPage, spread = false, title = '' } = {}) {
        el.innerHTML = `
        <div class="lp-reader">
            <div class="lp-rbar">
                ${title ? `<div class="lp-rttl">${title}</div>` : ''}
                <span class="lp-flex"></span>
                <button type="button" class="lh-btn lh-sq" data-r="prev" aria-label="Oldingi sahifa"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
                <label class="lp-rpage"><input type="number" min="1" value="${page}" aria-label="Sahifa"> / <span class="lp-rtotal">…</span></label>
                <button type="button" class="lh-btn lh-sq" data-r="next" aria-label="Keyingi sahifa"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button>
                <span class="lp-sep"></span>
                <button type="button" class="lh-btn lh-sq" data-r="out" aria-label="Kichraytirish">−</button>
                <span class="lp-zoom">100%</span>
                <button type="button" class="lh-btn lh-sq" data-r="in" aria-label="Kattalashtirish">+</button>
                <span class="lp-sep"></span>
                <button type="button" class="lh-btn" data-r="full"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>To'liq ekran</button>
            </div>
            <div class="lp-rview"><div class="lp-rmsg">Kitob yuklanmoqda…</div></div>
        </div>`;
        const view = el.querySelector('.lp-rview'), input = el.querySelector('input');
        let doc, cur = page, zoom = 1, token = 0;
        try { doc = await loadPdf(url); }
        catch (e) {
            // Kitob PDF'i ochilmadi — o'zbekcha xato kartasi + "Qayta urinish" (o'quvchi oynasi qayta quriladi).
            view.innerHTML = `<div class="lp-rmsg">${errCard('Kitobni ochib bo\'lmadi', e)}</div>`;
            el.querySelector('.lp-rtotal').textContent = '—';
            window.LoadErr?.bind(view, () => mountPdfReader(el, { url, page, onPage, spread, title }));
            return null;
        }
        el.querySelector('.lp-rtotal').textContent = doc.numPages;
        input.max = doc.numPages;
        const two = () => spread && view.clientWidth > 680 && doc.numPages > 1;
        async function renderPage(n, fitW) {
            const p = await doc.getPage(n);
            const base = p.getViewport({ scale: 1 });
            const scale = Math.max(0.3, fitW / base.width) * zoom;
            const dpr = window.devicePixelRatio || 1;
            const vp = p.getViewport({ scale: scale * dpr });
            const c = document.createElement('canvas');
            c.width = vp.width; c.height = vp.height;
            c.style.width = (vp.width / dpr) + 'px';
            await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            return c;
        }
        async function render() {
            const my = ++token;
            cur = Math.max(1, Math.min(doc.numPages, cur));
            input.value = cur;
            el.querySelector('.lp-zoom').textContent = `${Math.round(zoom * 100)}%`;
            const pair = two() && cur < doc.numPages;
            const fitW = pair ? (view.clientWidth - 64) / 2 : Math.min(view.clientWidth - 48, 900);
            const pages = await Promise.all([renderPage(cur, fitW), pair ? renderPage(cur + 1, fitW) : null]);
            if (my !== token) return;
            view.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'lp-rpages';
            pages.filter(Boolean).forEach(c => wrap.appendChild(c));
            view.appendChild(wrap);
            onPage?.(cur, doc.numPages);
        }
        el.addEventListener('click', e => {
            const b = e.target.closest('[data-r]');
            if (!b) return;
            const r = b.dataset.r;
            const step = two() ? 2 : 1;
            if (r === 'prev') cur -= step;
            else if (r === 'next') cur += step;
            else if (r === 'in') zoom = Math.min(3, zoom * 1.2);
            else if (r === 'out') zoom = Math.max(0.4, zoom / 1.2);
            else if (r === 'full') { open({ title: el.querySelector('.lp-rttl')?.textContent || 'Kitob', sources: [{ type: 'pdf', url, title: 'Kitob' }], startPage: cur }); return; }
            render();
        });
        input.addEventListener('change', () => { cur = Number(input.value) || 1; render(); });
        await render();
        return { goTo: n => { cur = n; return render(); }, pages: doc.numPages };
    }

    window.LessonPresenter = { open, close, mountPdfReader, loadPdf, planBlocks };
})();
