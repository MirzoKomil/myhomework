// Darslik markazi — prezentatsiya rejimi va kitob o'quvchi.
// Bitta to'liq ekran oyna: PDF sahifalari, rasm slaydlar, so'z kartochkalari
// yoki bo'sh doska. Har slayd ustida chizish qatlami (qalam, marker, o'chirg'ich,
// lazer ko'rsatkich) — chizilganlar shu sessiya davomida har slaydda saqlanadi.
(function () {
    'use strict';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const COLORS = ['#E5484D', '#2563EB', '#16A34A', '#F59E0B', '#111827', '#FFFFFF'];
    const pdfCache = new Map();

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

    // Manba (source) → slaydlar ro'yxati.
    async function expandSource(src) {
        if (src.type === 'pdf') {
            const doc = await loadPdf(src.url);
            return Array.from({ length: doc.numPages }, (_, i) => ({ type: 'pdf', url: src.url, page: i + 1, label: `${src.title} · ${i + 1}-bet` }));
        }
        if (src.type === 'images') return src.items.map((it, i) => ({ type: 'image', url: it.url, caption: it.caption || '', label: `${src.title} · ${i + 1}` }));
        if (src.type === 'words') return src.items.map((w, i) => ({ type: 'word', word: w, label: `So'z ${i + 1}/${src.items.length}` }));
        if (src.type === 'video') return [{ type: 'video', url: src.url, label: src.title }];
        return [{ type: 'blank', label: "Bo'sh doska" }];
    }

    function ytEmbed(url) {
        const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
        return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
    }

    // ── Prezentatsiya ───────────────────────────────────────────────────────
    function open({ sources, start = 0, startPage = 1, title = '' }) {
        const list = (sources || []).filter(Boolean);
        if (!list.find(s => s.type === 'blank')) list.push({ type: 'blank', title: "Bo'sh doska" });
        close();
        const root = document.createElement('div');
        root.className = 'lp';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Prezentatsiya');
        root.innerHTML = `
        <div class="lp-top">
            <div class="lp-title" title="${esc(title)}">${esc(title)}</div>
            <select class="lp-source" aria-label="Material">${list.map((s, i) => `<option value="${i}">${esc(s.title)}</option>`).join('')}</select>
            <div class="lp-timer" title="Dars vaqti (bosib to'xtatish)">00:00</div>
            <button type="button" class="lp-ic" data-act="full" title="To'liq ekran (F)">⛶</button>
            <button type="button" class="lp-ic" data-act="close" title="Yopish (Esc)">✕</button>
        </div>
        <div class="lp-stage">
            <div class="lp-slide"></div>
            <canvas class="lp-ink"></canvas>
            <div class="lp-laser"></div>
            <div class="lp-loading" hidden>Yuklanmoqda…</div>
        </div>
        <div class="lp-bar">
            <button type="button" class="lp-ic" data-act="prev" title="Oldingi (←)">‹</button>
            <span class="lp-count">1 / 1</span>
            <button type="button" class="lp-ic" data-act="next" title="Keyingi (→ yoki probel)">›</button>
            <span class="lp-sep"></span>
            <button type="button" class="lp-tool is-on" data-tool="none" title="Ko'rsatish (V)">🖐</button>
            <button type="button" class="lp-tool" data-tool="pen" title="Qalam (P)">✏️</button>
            <button type="button" class="lp-tool" data-tool="marker" title="Marker (M)">🖍</button>
            <button type="button" class="lp-tool" data-tool="eraser" title="O'chirg'ich (E)">🧽</button>
            <button type="button" class="lp-tool" data-tool="laser" title="Lazer (L)">🔴</button>
            <span class="lp-colors">${COLORS.map((c, i) => `<button type="button" class="lp-color${i === 0 ? ' is-on' : ''}" data-color="${c}" style="background:${c}" aria-label="Rang ${c}"></button>`).join('')}</span>
            <select class="lp-size" aria-label="Qalinlik"><option value="3">Ingichka</option><option value="6" selected>O'rtacha</option><option value="12">Qalin</option></select>
            <button type="button" class="lp-ic" data-act="undo" title="Ortga (Ctrl+Z)">↶</button>
            <button type="button" class="lp-ic" data-act="clear" title="Slayddagi chizmalarni tozalash">🗑</button>
            <span class="lp-sep"></span>
            <button type="button" class="lp-ic lp-wide" data-act="blank" title="Shu joyga bo'sh doska qo'shish (B)">＋ Doska</button>
            <button type="button" class="lp-ic lp-wide" data-act="reveal" title="So'z tarjimasini ko'rsatish (T)" hidden>Tarjima</button>
            <button type="button" class="lp-ic lp-wide" data-act="save" title="Joriy slaydni chizmalar bilan PNG qilib saqlash">⬇ PNG</button>
        </div>`;
        document.body.appendChild(root);
        document.body.classList.add('lp-open');

        const $ = sel => root.querySelector(sel);
        const stage = $('.lp-stage'), slideEl = $('.lp-slide'), ink = $('.lp-ink'), laser = $('.lp-laser');
        const ctx = ink.getContext('2d');
        const st = { slides: [], index: 0, tool: 'none', color: COLORS[0], size: 6, ink: new Map(), undo: [], revealed: false, renderToken: 0, srcIndex: start };
        const key = () => `${st.srcIndex}:${st.index}`;

        // Taymer
        let t0 = Date.now(), paused = 0, pausedAt = null;
        const timerEl = $('.lp-timer');
        const timer = setInterval(() => {
            const ms = (pausedAt || Date.now()) - t0 - paused;
            const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60;
            timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }, 500);
        timerEl.addEventListener('click', () => {
            if (pausedAt) { paused += Date.now() - pausedAt; pausedAt = null; timerEl.classList.remove('is-paused'); }
            else { pausedAt = Date.now(); timerEl.classList.add('is-paused'); }
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
            const data = st.ink.get(key());
            if (!data) return;
            const img = new Image();
            const k = key();
            img.onload = () => { if (k === key()) ctx.drawImage(img, 0, 0, ink.width, ink.height); };
            img.src = data;
        }

        async function renderSlide() {
            const token = ++st.renderToken;
            const s = st.slides[st.index];
            $('.lp-count').textContent = `${st.slides.length ? st.index + 1 : 0} / ${st.slides.length}`;
            $('[data-act="reveal"]').hidden = !s || s.type !== 'word';
            st.revealed = false;
            st.undo = [];
            slideEl.className = 'lp-slide';
            if (!s) { slideEl.innerHTML = '<div class="lp-empty">Material yo\'q</div>'; sizeInk(); return; }
            if (s.type === 'pdf') {
                $('.lp-loading').hidden = false;
                try {
                    const doc = await loadPdf(s.url);
                    const page = await doc.getPage(s.page);
                    if (token !== st.renderToken) return;
                    const sr = stage.getBoundingClientRect();
                    const base = page.getViewport({ scale: 1 });
                    const scale = Math.min((sr.width - 24) / base.width, (sr.height - 24) / base.height);
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

        async function loadSource(i) {
            saveInk();
            st.srcIndex = i;
            $('.lp-source').value = String(i);
            $('.lp-loading').hidden = false;
            try { st.slides = await expandSource(list[i]); }
            catch (e) { st.slides = []; slideEl.innerHTML = `<div class="lp-empty">${esc(e.message)}</div>`; }
            finally { $('.lp-loading').hidden = true; }
            st.index = 0;
            await renderSlide();
        }
        function go(delta) {
            if (!st.slides.length) return;
            const next = Math.max(0, Math.min(st.slides.length - 1, st.index + delta));
            if (next === st.index) return;
            saveInk();
            st.index = next;
            renderSlide();
        }
        function setTool(tool) {
            st.tool = tool;
            root.querySelectorAll('.lp-tool').forEach(b => b.classList.toggle('is-on', b.dataset.tool === tool));
            ink.style.pointerEvents = tool === 'none' ? 'none' : 'auto';
            stage.classList.toggle('is-laser', tool === 'laser');
            if (tool !== 'laser') laser.style.display = 'none';
        }
        function reveal() {
            st.revealed = !st.revealed;
            slideEl.querySelectorAll('.lp-trans,.lp-ex').forEach(el => { el.hidden = !st.revealed; });
        }

        // Chizish
        let drawing = false, last = null;
        const pos = e => {
            const r = ink.getBoundingClientRect(), dpr = ink.width / r.width;
            return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr, dpr };
        };
        ink.addEventListener('pointerdown', e => {
            if (st.tool === 'none') return;
            if (st.tool === 'laser') return;
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

        root.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.tool) return setTool(b.dataset.tool);
            if (b.dataset.color) {
                st.color = b.dataset.color;
                root.querySelectorAll('.lp-color').forEach(x => x.classList.toggle('is-on', x === b));
                if (st.tool === 'none' || st.tool === 'eraser' || st.tool === 'laser') setTool('pen');
                return;
            }
            const act = b.dataset.act;
            if (act === 'close') close();
            else if (act === 'prev') go(-1);
            else if (act === 'next') go(1);
            else if (act === 'undo') { const d = st.undo.pop(); if (d) { ctx.putImageData(d, 0, 0); saveInk(); } }
            else if (act === 'clear') { st.undo.push(ctx.getImageData(0, 0, ink.width, ink.height)); ctx.clearRect(0, 0, ink.width, ink.height); saveInk(); }
            else if (act === 'blank') {
                saveInk();
                // Keyingi slaydlarning chizmalari bir pog'ona suriladi.
                const shifted = new Map();
                for (const [k, v] of st.ink) {
                    const [si, idx] = k.split(':').map(Number);
                    shifted.set(si === st.srcIndex && idx > st.index ? `${si}:${idx + 1}` : k, v);
                }
                st.ink = shifted;
                st.slides.splice(st.index + 1, 0, { type: 'blank', label: "Bo'sh doska" });
                st.index += 1;
                renderSlide();
                setTool('pen');
            }
            else if (act === 'reveal') reveal();
            else if (act === 'save') savePng();
            else if (act === 'full') {
                if (document.fullscreenElement) document.exitFullscreen?.();
                else root.requestFullscreen?.().catch(() => {});
            }
        });
        $('.lp-source').addEventListener('change', e => loadSource(Number(e.target.value)));
        $('.lp-size').addEventListener('change', e => { st.size = Number(e.target.value) || 6; });
        const onKey = e => {
            if (e.target.closest && e.target.closest('select,input,textarea')) return;
            const k = e.key;
            if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); go(1); }
            else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(-1); }
            else if (k === 'Escape' && !document.fullscreenElement) close();
            else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); root.querySelector('[data-act="undo"]').click(); }
            else if (e.ctrlKey || e.metaKey || e.altKey) return;
            else if (k === 'b' || k === 'B') root.querySelector('[data-act="blank"]').click();
            else if (k === 'f' || k === 'F') root.querySelector('[data-act="full"]').click();
            else if (k === 't' || k === 'T') reveal();
            else if ('vpmel'.includes(k.toLowerCase()) && k.length === 1) setTool({ v: 'none', p: 'pen', m: 'marker', e: 'eraser', l: 'laser' }[k.toLowerCase()]);
        };
        const onResize = () => { saveInk(); renderSlide(); };
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', onResize);
        document.addEventListener('fullscreenchange', onResize);
        root._cleanup = () => {
            clearInterval(timer);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onResize);
            document.removeEventListener('fullscreenchange', onResize);
        };
        setTool('none');
        loadSource(Math.min(start, list.length - 1)).then(() => {
            if (startPage > 1 && st.slides.length) { st.index = Math.min(startPage - 1, st.slides.length - 1); renderSlide(); }
        });
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
    async function mountPdfReader(el, { url, page = 1, onPage } = {}) {
        el.innerHTML = `
        <div class="lp-reader">
            <div class="lp-rbar">
                <button type="button" class="lh-btn" data-r="prev" aria-label="Oldingi sahifa">‹</button>
                <label class="lp-rpage"><input type="number" min="1" value="${page}" aria-label="Sahifa"> / <span class="lp-rtotal">…</span></label>
                <button type="button" class="lh-btn" data-r="next" aria-label="Keyingi sahifa">›</button>
                <span class="lp-sep"></span>
                <button type="button" class="lh-btn" data-r="out" aria-label="Kichraytirish">−</button>
                <button type="button" class="lh-btn" data-r="fit">Moslash</button>
                <button type="button" class="lh-btn" data-r="in" aria-label="Kattalashtirish">＋</button>
                <a class="lh-btn" href="${esc(url)}" target="_blank" rel="noopener">Yangi oynada</a>
            </div>
            <div class="lp-rview"><div class="lp-rmsg">Kitob yuklanmoqda…</div></div>
        </div>`;
        const view = el.querySelector('.lp-rview'), input = el.querySelector('input');
        let doc, cur = page, zoom = null, token = 0;
        try { doc = await loadPdf(url); }
        catch (e) { view.innerHTML = `<div class="lp-rmsg">Kitobni ochib bo'lmadi: ${esc(e.message)}</div>`; return null; }
        el.querySelector('.lp-rtotal').textContent = doc.numPages;
        input.max = doc.numPages;
        async function render() {
            const my = ++token;
            cur = Math.max(1, Math.min(doc.numPages, cur));
            input.value = cur;
            const p = await doc.getPage(cur);
            if (my !== token) return;
            const base = p.getViewport({ scale: 1 });
            const fit = Math.max(0.3, (view.clientWidth - 24) / base.width);
            const scale = zoom || fit;
            const dpr = window.devicePixelRatio || 1;
            const vp = p.getViewport({ scale: scale * dpr });
            const c = document.createElement('canvas');
            c.width = vp.width; c.height = vp.height;
            c.style.width = (vp.width / dpr) + 'px';
            await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            if (my !== token) return;
            view.innerHTML = '';
            view.appendChild(c);
            onPage?.(cur, doc.numPages);
        }
        el.addEventListener('click', e => {
            const b = e.target.closest('[data-r]');
            if (!b) return;
            const r = b.dataset.r;
            if (r === 'prev') cur--;
            else if (r === 'next') cur++;
            else if (r === 'in') zoom = (zoom || 1) * 1.2;
            else if (r === 'out') zoom = Math.max(0.3, (zoom || 1) / 1.2);
            else if (r === 'fit') zoom = null;
            render();
        });
        input.addEventListener('change', () => { cur = Number(input.value) || 1; render(); });
        await render();
        return { goTo: n => { cur = n; return render(); }, pages: doc.numPages };
    }

    window.LessonPresenter = { open, close, mountPdfReader, loadPdf };
})();
