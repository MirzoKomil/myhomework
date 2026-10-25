// Akademik bo'lim → Darslik markazi (ustoz va admin uchun).
// 72 darslik reja, har dars: dars rejasi (Teacher's book), jonli dars va
// videodars slaydlari, grammatika, so'zlar, audio dialoglar, uy vazifasi
// (javoblari bilan) va shu dars bo'yicha o'quvchilar holati. Alohida bo'limlar:
// o'quvchilar progressi (vaqt, xatolar, 72 dars xaritasi), kitob PDF,
// Teacher's book va eski "Qo'shimcha materiallar".
// Ma'lumot /api/academic dan olinadi; server ustozni o'z tili va o'z
// o'quvchilari bilan cheklaydi.
(function () {
    'use strict';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const api = (path, opts) => apiFetch(path, { timeout: 30000, ...(opts || {}) });
    const toast = m => (typeof showMiniToast === 'function' ? showMiniToast(m, 2600) : alert(m));
    const plain = s => String(s ?? '').replace(/́/g, '');
    const LANG_LABEL = { english: 'Ingliz tili', russian: 'Rus tili' };

    const VIEWS = [
        { id: 'lessons', label: '72 dars' },
        { id: 'students', label: "O'quvchilar progressi" },
        { id: 'book', label: 'Kitob (PDF)' },
        { id: 'guide', label: "Teacher's book" },
        { id: 'extra', label: "Qo'shimcha materiallar" },
    ];
    const TABS = [
        { id: 'plan', label: 'Dars rejasi' },
        { id: 'live', label: 'Jonli dars slaydlari', kind: 'live_slides' },
        { id: 'video', label: 'Videodars', kind: 'video_slides' },
        { id: 'grammar', label: 'Grammatika', kind: 'grammar_slides' },
        { id: 'words', label: "So'zlar" },
        { id: 'dialogs', label: 'Audio dialoglar' },
        { id: 'homework', label: 'Uy vazifasi' },
        { id: 'class', label: "O'quvchilar" },
    ];
    const KIND_ICON = { live_slides: '🎥', video_slides: '▶️', grammar_slides: '📐', lesson_plan: '🗒', teacher_guide: '🧑‍🏫', extra: '📎', book: '📖', teacher_book: '📘', methodology: '🧭' };
    const DOT_KINDS = [['live_slides', 'Jonli dars slaydlari'], ['video_slides', 'Videodars slaydlari'], ['grammar_slides', 'Grammatika slaydlari'], ['teacher_guide', "Ustoz qo'llanmasi"]];
    const HW_KIND = { matching: 'Moslashtirish', fillBlank: "Bo'sh joy", multipleChoice: 'Test', sentenceBuild: 'Gap tuzish', reading: "O'qish va tarjima", creative: 'Ijodiy', record: 'Ovoz yozish', roleplay: 'Rolli o\'yin' };
    const SECTION_LABEL = { dars: 'Dars sahifasi', video: 'Videodars', slaydlar: 'Slaydlar', sozlar: "So'zlar", audio: 'Audio dialog', vazifa: 'Uy vazifasi', tekshiruv: 'Tekshiruv', xatolar: 'Xatolar ustida', bosh: 'Bosh sahifa', mashq: "O'yin mashqlar", lugat: "Lug'at", grammatika: 'Grammatika', imtihonlar: 'Imtihonlar', takrorlash: 'Takrorlash' };

    const S = {
        el: null, ctx: null, lang: 'english', view: 'lessons', hub: {}, lessonCache: {}, selected: {},
        tab: 'plan', search: '', filter: 'all', students: {}, studentDetail: {}, openStudent: null,
        studentSort: 'attention', duration: null, bookState: {}, reader: null,
    };

    function loadPrefs() {
        try {
            const p = JSON.parse(localStorage.getItem('mh_lesson_hub') || '{}');
            if (p.view) S.view = p.view;
            if (p.tab) S.tab = p.tab;
            if (p.selected) S.selected = p.selected;
            if (p.duration) S.duration = p.duration;
        } catch { /* maxfiy rejim */ }
    }
    function savePrefs() {
        try { localStorage.setItem('mh_lesson_hub', JSON.stringify({ view: S.view, tab: S.tab, selected: S.selected, duration: S.duration })); } catch { /* */ }
    }

    // ── Kirish nuqtasi ──────────────────────────────────────────────────────
    function mount(container, ctx) {
        if (!S.el) loadPrefs();
        S.el = container;
        S.ctx = ctx || {};
        S.lang = ctx.lang === 'russian' ? 'russian' : 'english';
        container.classList.add('lh-host');
        render();
        ensureHub().then(render).catch(err => renderError(err));
    }

    async function ensureHub(force) {
        if (S.hub[S.lang] && !force) return S.hub[S.lang];
        const data = await api(`/api/academic/hub?lang=${S.lang}`);
        if (data.lang !== S.lang) S.lang = data.lang; // ustoz — o'z tiliga majburlanadi
        S.hub[S.lang] = data;
        if (!S.selected[S.lang]) {
            const busiest = [...data.syllabus].sort((a, b) => b.studentsHere - a.studentsHere)[0];
            S.selected[S.lang] = busiest?.studentsHere ? busiest.no : 1;
        }
        if (!S.duration) S.duration = data.defaultDuration || 60;
        return data;
    }

    function renderError(err) {
        if (!S.el) return;
        S.el.innerHTML = `<div class="lh-error"><b>Darslik markazini yuklab bo'lmadi.</b><span>${esc(err?.message || err)}</span>
            <button type="button" class="lh-btn" data-lh-retry>Qayta urinish</button></div>`;
        S.el.querySelector('[data-lh-retry]').onclick = () => mount(S.el, S.ctx);
    }

    function render() {
        const el = S.el;
        if (!el) return;
        const hub = S.hub[S.lang];
        el.innerHTML = `
        <div class="lh">
            <div class="lh-top">
                <div class="lh-views" role="tablist" aria-label="Darslik bo'limlari">
                    ${VIEWS.map(v => `<button type="button" role="tab" class="lh-view${S.view === v.id ? ' is-on' : ''}" aria-selected="${S.view === v.id}" data-view="${v.id}">${esc(v.label)}</button>`).join('')}
                </div>
                <div class="lh-meta">${hub ? `${esc(LANG_LABEL[hub.lang])} · ${esc(hub.course?.name || 'kurs')} · 72 dars · ${hub.studentCount} o'quvchi` : 'Yuklanmoqda…'}</div>
            </div>
            <div class="lh-main" id="lhMain">${hub ? '' : skeleton()}</div>
        </div>`;
        el.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
            S.view = b.dataset.view; savePrefs(); render();
        }));
        if (!hub) return;
        const main = el.querySelector('#lhMain');
        if (S.view === 'lessons') renderLessonsView(main);
        else if (S.view === 'students') renderStudentsView(main);
        else if (S.view === 'book') renderBookView(main);
        else if (S.view === 'guide') renderGuideView(main);
        else renderExtraView(main);
    }

    const skeleton = () => `<div class="lh-skel"><div></div><div></div><div></div></div>`;

    // ── 72 dars ─────────────────────────────────────────────────────────────
    function renderLessonsView(main) {
        const hub = S.hub[S.lang];
        main.innerHTML = `
        <div class="lh-split">
            <aside class="lh-list" aria-label="72 dars ro'yxati">
                <div class="lh-list-tools">
                    <input type="search" class="lh-input" placeholder="Dars, mavzu yoki raqam…" value="${esc(S.search)}" aria-label="Darslarni qidirish">
                    <div class="lh-chips" role="group" aria-label="Dars turi">
                        ${[['all', 'Hammasi'], ['live', 'Jonli'], ['video', 'Video'], ['missing', 'Slaydsiz']].map(([k, l]) => `<button type="button" class="lh-chip${S.filter === k ? ' is-on' : ''}" data-filter="${k}">${l}</button>`).join('')}
                    </div>
                </div>
                <div class="lh-items"></div>
            </aside>
            <section class="lh-lesson" id="lhLesson" aria-live="polite"></section>
        </div>`;
        const items = main.querySelector('.lh-items');
        const drawList = () => { items.innerHTML = lessonListHtml(hub); bindList(items); };
        drawList();
        main.querySelector('.lh-input').addEventListener('input', e => { S.search = e.target.value; drawList(); });
        main.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
            S.filter = b.dataset.filter;
            main.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('is-on', x === b));
            drawList();
        }));
        openLesson(S.selected[S.lang] || 1, { scroll: true });
    }

    function lessonListHtml(hub) {
        const q = plain(S.search).trim().toLowerCase();
        const rows = hub.syllabus.filter(l => {
            if (S.filter === 'live' && l.type !== 'live') return false;
            if (S.filter === 'video' && l.type !== 'video') return false;
            if (S.filter === 'missing') {
                const hasSlides = l.type === 'live' ? l.materials.includes('live_slides')
                    : (l.materials.includes('video_slides') || l.counts.slides > 0);
                if (hasSlides) return false;
            }
            if (!q) return true;
            return String(l.no) === q || plain(`${l.name} ${l.topic} ${l.cando}`).toLowerCase().includes(q);
        });
        if (!rows.length) return '<div class="lh-empty-sm">Mos dars topilmadi</div>';
        let html = '', month = 0;
        for (const l of rows) {
            if (l.month !== month) {
                month = l.month;
                html += `<div class="lh-month">${month}-oy · ${(month - 1) * 24 + 1}–${month * 24}-darslar</div>`;
            }
            const sel = S.selected[S.lang] === l.no;
            const dots = DOT_KINDS.map(([k, label]) => {
                const has = l.materials.includes(k) || (k === 'video_slides' && l.counts.slides > 0);
                return `<i class="lh-dot${has ? ' is-on' : ''}" title="${esc(label)}: ${has ? 'bor' : "yo'q"}"></i>`;
            }).join('');
            html += `<button type="button" class="lh-item${sel ? ' is-on' : ''}" data-no="${l.no}" aria-current="${sel}">
                <span class="lh-num ${l.type}">${l.no}</span>
                <span class="lh-item-body">
                    <span class="lh-item-name">${esc(plain(l.name))}</span>
                    <span class="lh-item-meta"><span class="lh-type ${l.type}">${l.type === 'live' ? 'Jonli' : 'Video'}</span>${l.topic ? `<span>${esc(plain(l.topic))}</span>` : ''}</span>
                </span>
                <span class="lh-item-side">
                    <span class="lh-dots" aria-hidden="true">${dots}</span>
                    ${l.studentsHere ? `<span class="lh-here" title="Shu darsda turgan o'quvchilar">👥 ${l.studentsHere}</span>` : ''}
                </span>
            </button>`;
        }
        return html;
    }

    function bindList(items) {
        items.querySelectorAll('[data-no]').forEach(b => b.addEventListener('click', () => openLesson(Number(b.dataset.no))));
    }

    async function openLesson(no, { scroll = false } = {}) {
        S.selected[S.lang] = no;
        savePrefs();
        document.querySelectorAll('.lh-item').forEach(b => {
            const on = Number(b.dataset.no) === no;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-current', on);
            if (on && scroll) b.scrollIntoView({ block: 'center' });
        });
        const box = document.getElementById('lhLesson');
        if (!box) return;
        const key = `${S.lang}:${no}`;
        if (!S.lessonCache[key]) {
            box.innerHTML = skeleton();
            try { S.lessonCache[key] = await api(`/api/academic/lessons/${no}?lang=${S.lang}`); }
            catch (err) { box.innerHTML = `<div class="lh-error"><b>Darsni yuklab bo'lmadi</b><span>${esc(err.message)}</span></div>`; return; }
            if (S.selected[S.lang] !== no) return;
        }
        renderLesson(box, S.lessonCache[key]);
    }

    function lessonMaterials(data, kind) { return data.materials.filter(m => m.kind === kind); }

    function renderLesson(box, data) {
        const L = data.lesson;
        const book = data.book;
        const tabCount = {
            live: lessonMaterials(data, 'live_slides').length,
            video: lessonMaterials(data, 'video_slides').length + (L.slides.length ? 1 : 0) + (L.videoUrl ? 1 : 0),
            grammar: lessonMaterials(data, 'grammar_slides').length + (L.konspekt ? 1 : 0),
            words: L.vocabulary.length, dialogs: L.audioDialogs.length + (L.dialog ? 1 : 0) + (L.text ? 1 : 0),
            homework: L.homework.length, class: data.classStats.students.length,
        };
        if (!TABS.some(t => t.id === S.tab)) S.tab = 'plan';
        box.innerHTML = `
        <header class="lh-head">
            <div class="lh-head-row">
                <div>
                    <div class="lh-kicker"><span class="lh-type ${L.type}">${L.type === 'live' ? 'Jonli dars' : 'Videodars'}</span> ${L.no}-dars · ${L.month}-oy${L.active ? '' : ' · <span class="lh-warn">ilovada yopiq</span>'}</div>
                    <h2 class="lh-title">${esc(plain(L.name))}</h2>
                    ${L.titleRu ? `<div class="lh-sub">${esc(L.titleRu)}</div>` : ''}
                </div>
                <div class="lh-nav">
                    <button type="button" class="lh-btn" data-go="-1" ${L.no <= 1 ? 'disabled' : ''} aria-label="Oldingi dars">‹</button>
                    <button type="button" class="lh-btn" data-go="1" ${L.no >= 72 ? 'disabled' : ''} aria-label="Keyingi dars">›</button>
                </div>
            </div>
            ${L.cando ? `<p class="lh-goal"><b>Dars maqsadi:</b> ${esc(L.cando)}</p>` : ''}
            <div class="lh-actions">
                <button type="button" class="lh-btn lh-primary" data-act="present">▶ Darsni boshlash</button>
                <button type="button" class="lh-btn" data-act="board">✏️ Doska</button>
                ${book ? `<button type="button" class="lh-btn" data-act="book">📖 Kitobda ochish${book.page ? ` · ${book.page}-bet` : ''}</button>` : ''}
                <button type="button" class="lh-btn" data-act="print">🖨 Rejani chop etish</button>
            </div>
        </header>
        <div class="lh-tabs" role="tablist" aria-label="Dars bo'limlari">
            ${TABS.map(t => `<button type="button" role="tab" class="lh-tab${S.tab === t.id ? ' is-on' : ''}" aria-selected="${S.tab === t.id}" data-tab="${t.id}">${esc(t.label)}${tabCount[t.id] ? ` <span class="lh-count">${tabCount[t.id]}</span>` : ''}</button>`).join('')}
        </div>
        <div class="lh-panel" role="tabpanel"></div>`;
        box.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
            S.tab = b.dataset.tab; savePrefs();
            box.querySelectorAll('[data-tab]').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b); });
            renderTab(box.querySelector('.lh-panel'), data);
        }));
        box.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => openLesson(L.no + Number(b.dataset.go), { scroll: true })));
        box.querySelector('[data-act="present"]').addEventListener('click', () => present(data));
        box.querySelector('[data-act="board"]').addEventListener('click', () => present(data, { blank: true }));
        box.querySelector('[data-act="print"]').addEventListener('click', () => printPlan(data));
        box.querySelector('[data-act="book"]')?.addEventListener('click', () => {
            S.bookState[S.lang] = { id: book.id, page: book.page || 1 };
            S.view = 'book'; savePrefs(); render();
        });
        renderTab(box.querySelector('.lh-panel'), data);
    }

    function renderTab(panel, data) {
        const L = data.lesson;
        const t = S.tab;
        if (t === 'plan') return renderPlan(panel, data);
        if (t === 'live') {
            panel.innerHTML = materialSection(data, 'live_slides', 'Jonli dars slaydlari',
                L.type === 'live' ? "Darsda ko'rsatiladigan slaydlar. PDF formatda yuklang — prezentatsiya rejimida ustiga chizish mumkin." : "Bu videodars. Jonli dars slaydlari odatda keyingi (jonli) darsda bo'ladi.");
        } else if (t === 'video') {
            panel.innerHTML = `
                ${L.videoUrl ? `<div class="lh-card"><div class="lh-card-h"><b>Videodars</b><a class="lh-btn" href="${esc(L.videoUrl)}" target="_blank" rel="noopener">Ochish</a></div>${videoEmbed(L.videoUrl)}</div>` : ''}
                ${L.slides.length ? `<div class="lh-card"><div class="lh-card-h"><b>Ilovadagi slaydlar</b> <span class="lh-muted">${L.slides.length} ta · o'quvchi ilovada ko'radi</span>
                    <button type="button" class="lh-btn" data-present-src="app-slides">▶ Ko'rsatish</button></div>
                    <div class="lh-thumbs">${L.slides.map((s, i) => s.imageUrl ? `<button type="button" class="lh-thumb" data-slide="${i}" title="${esc(s.title)}"><img loading="lazy" src="${esc(s.imageUrl)}" alt="${esc(s.title || `${i + 1}-slayd`)}"><span>${i + 1}</span></button>`
                        : `<div class="lh-thumb is-text"><b>${esc(s.title)}</b><span>${esc(s.body).slice(0, 120)}</span></div>`).join('')}</div></div>` : ''}
                ${materialSection(data, 'video_slides', 'Videodars slaydlari (fayllar)', "Video darsning PDF slaydlari — o'quvchi videoni ko'rmagan bo'lsa jonli darsda tez o'tib ketish uchun.")}
                ${!L.videoUrl && !L.slides.length ? `<div class="lh-note">Bu dars uchun ilovada video yo'q — o'quvchi konspekt va slaydlar orqali o'rganadi.</div>` : ''}`;
            panel.querySelector('[data-present-src="app-slides"]')?.addEventListener('click', () => present(data, { prefer: 'app-slides' }));
            panel.querySelectorAll('[data-slide]').forEach(b => b.addEventListener('click', () => present(data, { prefer: 'app-slides', page: Number(b.dataset.slide) + 1 })));
        } else if (t === 'grammar') {
            panel.innerHTML = `
                ${L.konspekt ? `<div class="lh-card"><div class="lh-card-h"><b>Konspekt (grammatika)</b><span class="lh-muted">o'quvchi ilovada ko'radigan matn</span></div><div class="lh-konspekt">${konspektHtml(L.konspekt)}</div></div>` : '<div class="lh-note">Bu darsda konspekt kiritilmagan.</div>'}
                ${materialSection(data, 'grammar_slides', "Qo'shimcha grammatika slaydlari", 'Qoidani tushuntirish uchun alohida slaydlar (PDF).')}`;
        } else if (t === 'words') {
            panel.innerHTML = L.vocabulary.length ? `
                <div class="lh-card"><div class="lh-card-h"><b>Yangi so'zlar</b> <span class="lh-muted">${L.vocabulary.length} ta</span>
                    <button type="button" class="lh-btn" data-present-src="words">▶ Kartochkalarda ko'rsatish</button></div>
                <div class="lh-words">${L.vocabulary.map(w => `
                    <div class="lh-word">
                        ${w.imageUrl ? `<img loading="lazy" src="${esc(w.imageUrl)}" alt="">` : `<div class="lh-word-ic">${esc(w.icon || '🔤')}</div>`}
                        <div><b>${esc(w.word)}</b>${w.transcript ? ` <span class="lh-muted">${esc(w.transcript)}</span>` : ''}
                        <div>${esc(w.translation)}</div>${w.example ? `<div class="lh-ex">${esc(w.example)}</div>` : ''}</div>
                    </div>`).join('')}</div></div>` : '<div class="lh-note">Bu darsda so\'zlar kiritilmagan.</div>';
            panel.querySelector('[data-present-src="words"]')?.addEventListener('click', () => present(data, { prefer: 'words' }));
        } else if (t === 'dialogs') {
            const blocks = L.audioDialogs.map(d => `
                <div class="lh-card"><div class="lh-card-h"><b>🎧 ${esc(d.title)}</b>${d.bookPart ? `<span class="lh-muted">Kitob ${d.bookPart}-qism${d.trackNo ? `, ${d.trackNo}-trek` : ''}</span>` : ''}</div>
                ${d.audioUrl ? `<audio controls preload="none" src="${esc(d.audioUrl)}"></audio>` : ''}
                ${linesTable(d.lines)}</div>`);
            if (L.dialog) blocks.push(`<div class="lh-card"><div class="lh-card-h"><b>💬 Kitobdagi dialog${L.dialog.title ? `: ${esc(L.dialog.title)}` : ''}</b></div>${linesTable(L.dialog.lines)}</div>`);
            if (L.text) blocks.push(`<div class="lh-card"><div class="lh-card-h"><b>📄 O'qish matni${L.text.title ? `: ${esc(L.text.title)}` : ''}</b></div>
                <div class="lh-two"><div class="lh-ru">${esc(L.text.ru)}</div><div class="lh-muted">${esc(L.text.uz)}</div></div>
                ${L.text.questions.length ? `<ol class="lh-qa">${L.text.questions.map(q => `<li>${esc(q.q)} <span class="lh-ans">→ ${esc((q.opts || [])[q.a] ?? '')}</span></li>`).join('')}</ol>` : ''}</div>`);
            if (L.speaking.length) blocks.push(`<div class="lh-card"><div class="lh-card-h"><b>🗣 Gapirish iboralari</b></div>${linesTable(L.speaking.map(s => ({ ru: s.ru, uz: s.uz })))}</div>`);
            panel.innerHTML = blocks.join('') || '<div class="lh-note">Bu darsda audio dialog yoki matn yo\'q.</div>';
        } else if (t === 'homework') {
            renderHomework(panel, data);
        } else if (t === 'class') {
            renderClass(panel, data);
        }
        bindMaterialActions(panel, data);
    }

    function linesTable(lines) {
        if (!lines?.length) return '';
        return `<table class="lh-lines"><tbody>${lines.map(l => `<tr>${l.speaker ? `<th>${esc(l.speaker)}</th>` : ''}<td class="lh-ru">${esc(l.ru)}</td><td class="lh-muted">${esc(l.uz)}</td></tr>`).join('')}</tbody></table>`;
    }

    function konspektHtml(text) {
        const out = [];
        let list = false;
        for (const raw of String(text).split('\n')) {
            const line = raw.trim();
            if (/^\*|^•|^- /.test(line)) {
                if (!list) { out.push('<ul>'); list = true; }
                out.push(`<li>${esc(line.replace(/^[*•-]\s*/, ''))}</li>`);
                continue;
            }
            if (list) { out.push('</ul>'); list = false; }
            if (line === '---') out.push('<hr>');
            else if (line) out.push(`<p>${esc(line)}</p>`);
        }
        if (list) out.push('</ul>');
        return out.join('');
    }

    function videoEmbed(url) {
        const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
        if (m) return `<div class="lh-video"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${m[1]}" title="Videodars" allow="encrypted-media; fullscreen" allowfullscreen></iframe></div>`;
        if (/\.(mp4|webm)(\?|$)/i.test(url)) return `<div class="lh-video"><video controls preload="metadata" src="${esc(url)}"></video></div>`;
        return '';
    }

    // ── Dars rejasi (Teacher's book) ────────────────────────────────────────
    function planMinutes(blocks, duration) {
        let used = 0;
        return blocks.map((b, i) => {
            const m = i === blocks.length - 1 ? Math.max(1, duration - used) : Math.max(1, Math.round(b.share / 100 * duration));
            const from = used;
            used += m;
            return { ...b, minutes: m, from, to: used };
        });
    }
    const mmss = m => `${String(Math.floor(m)).padStart(2, '0')}:00`;

    function checklistKey(L) { return `mh_lh_check:${S.lang}:${L.no}`; }

    function renderPlan(panel, data) {
        const L = data.lesson, plan = L.plan;
        const duration = S.duration || 60;
        const blocks = planMinutes(plan.blocks, duration);
        let checks = {};
        try { checks = JSON.parse(localStorage.getItem(checklistKey(L)) || '{}'); } catch { /* */ }
        const missing = data.classStats.prevHomeworkMissing || [];
        const files = [...lessonMaterials(data, 'lesson_plan'), ...lessonMaterials(data, 'teacher_guide')];
        panel.innerHTML = `
        ${plan.mode === 'live' && missing.length ? `<div class="lh-alert"><b>Darsdan oldin:</b> oldingi darsni 50% dan kam bajarganlar (${missing.length}): ${missing.map(s => esc(s.name)).join(', ')}</div>` : ''}
        <div class="lh-card">
            <div class="lh-card-h"><b>${plan.mode === 'live' ? 'Jonli dars rejasi' : 'Videodars — ustoz uchun yo\'riqnoma'}</b>
                ${plan.mode === 'live' ? `<label class="lh-dur">Dars davomiyligi <select aria-label="Dars davomiyligi">${[15, 20, 30, 45, 60, 80, 90].map(d => `<option value="${d}"${d === duration ? ' selected' : ''}>${d} daqiqa</option>`).join('')}</select></label>` : ''}
            </div>
            <p class="lh-muted lh-summary">${esc(plan.summary)}</p>
            <ol class="lh-timeline">${blocks.map(b => `
                <li class="lh-block">
                    <div class="lh-block-time">${plan.mode === 'live' ? `<b>${b.minutes} daq</b><span>${mmss(b.from)}–${mmss(b.to)}</span>` : `<b>${b.share}%</b><span>ulush</span>`}</div>
                    <div class="lh-block-body">
                        <div class="lh-block-title">${esc(b.title)}</div>
                        ${b.items.length ? `<ul class="${b.items.some(i => String(i).length > 40) ? 'is-long' : ''}">${b.items.map(i => `<li>${esc(plain(i))}</li>`).join('')}</ul>` : ''}
                        ${b.tip ? `<div class="lh-tip">💡 ${esc(b.tip)}</div>` : ''}
                    </div>
                </li>`).join('')}</ol>
        </div>
        ${L.review.length ? `<div class="lh-card"><div class="lh-card-h"><b>O'tgan darsni eslash savollari</b><span class="lh-muted">videodars boshida o'quvchi ham ko'radi</span></div>
            <ol class="lh-qa">${L.review.map(r => `<li>${esc(r.q)}${r.a ? ` <span class="lh-ans">→ ${esc(r.a)}</span>` : ''}</li>`).join('')}</ol></div>` : ''}
        <div class="lh-card"><div class="lh-card-h"><b>Tayyorgarlik ro'yxati</b><span class="lh-muted">belgilar shu qurilmada saqlanadi</span></div>
            <ul class="lh-check">${plan.checklist.map((c, i) => `<li><label><input type="checkbox" data-check="${i}"${checks[i] ? ' checked' : ''}> ${esc(c)}</label></li>`).join('')}</ul></div>
        ${materialSection(data, 'lesson_plan', "Dars rejasi fayllari", "Metodist tayyorlagan rasmiy reja (PDF/Word) — bo'lsa, yuqoridagi avtomatik rejadan ustun turadi.", files.filter(f => f.kind === 'lesson_plan'))}
        ${materialSection(data, 'teacher_guide', "Ustoz qo'llanmasi (shu dars)", "Teacher's book'ning shu darsga tegishli sahifalari.", files.filter(f => f.kind === 'teacher_guide'))}`;
        panel.querySelector('.lh-dur select')?.addEventListener('change', e => {
            S.duration = Number(e.target.value); savePrefs(); renderPlan(panel, data); bindMaterialActions(panel, data);
        });
        panel.querySelectorAll('[data-check]').forEach(cb => cb.addEventListener('change', () => {
            checks[cb.dataset.check] = cb.checked;
            try { localStorage.setItem(checklistKey(L), JSON.stringify(checks)); } catch { /* */ }
        }));
    }

    function printPlan(data) {
        const L = data.lesson, plan = L.plan;
        const blocks = planMinutes(plan.blocks, S.duration || 60);
        const w = window.open('', '_blank');
        if (!w) return toast("Brauzer yangi oynani bloklab qo'ydi");
        w.document.write(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>${L.no}-dars rejasi</title>
            <style>body{font:14px/1.5 system-ui,sans-serif;margin:32px;color:#111}h1{font-size:20px;margin:0 0 4px}.m{color:#555}
            table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ccc;padding:8px;vertical-align:top;text-align:left}
            th{background:#f3f3f7;width:110px}ul{margin:4px 0 0 18px;padding:0}.tip{color:#555;font-size:12px;margin-top:4px}
            .words{columns:3;margin-top:8px}</style></head><body>
            <h1>${L.no}-dars · ${esc(plain(L.name))}</h1>
            <div class="m">${L.type === 'live' ? `Jonli dars · ${S.duration || 60} daqiqa` : 'Videodars'} · ${esc(LANG_LABEL[S.lang])}</div>
            ${L.cando ? `<p><b>Maqsad:</b> ${esc(L.cando)}</p>` : ''}
            <table>${blocks.map(b => `<tr><th>${L.type === 'live' ? `${mmss(b.from)}–${mmss(b.to)}<br>${b.minutes} daq` : `${b.share}%`}</th><td><b>${esc(b.title)}</b>
                ${b.items.length ? `<ul>${b.items.map(i => `<li>${esc(plain(i))}</li>`).join('')}</ul>` : ''}${b.tip ? `<div class="tip">${esc(b.tip)}</div>` : ''}</td></tr>`).join('')}</table>
            ${L.vocabulary.length ? `<h3>So'zlar</h3><div class="words">${L.vocabulary.map(v => `<div><b>${esc(v.word)}</b> — ${esc(v.translation)}</div>`).join('')}</div>` : ''}
            <script>window.onload=()=>window.print()<\/script></body></html>`);
        w.document.close();
    }

    // ── Uy vazifasi ─────────────────────────────────────────────────────────
    function renderHomework(panel, data) {
        const L = data.lesson, top = data.classStats.topMistakes || [];
        panel.innerHTML = `
        ${top.length ? `<div class="lh-card"><div class="lh-card-h"><b>Eng ko'p xato qilingan savollar</b><span class="lh-muted">sizning o'quvchilaringiz bo'yicha</span></div>
            <ol class="lh-mistakes">${top.map(m => `<li><span>${esc(m.question)}</span><b>${m.count} marta</b></li>`).join('')}</ol></div>` : ''}
        ${L.homework.length ? L.homework.map((h, i) => `
            <details class="lh-card lh-hw"${i === 0 ? ' open' : ''}>
                <summary><b>${esc(h.title || HW_KIND[h.kind] || h.kind)}</b>
                    <span class="lh-tag">${esc(HW_KIND[h.kind] || h.kind)}</span>
                    <span class="lh-muted">${h.questions} ta savol${h.teacherGraded ? ' · ustoz baholaydi' : ' · avtomatik tekshiriladi'}</span></summary>
                ${h.preview.length ? `<ol class="lh-qa">${h.preview.map(p => `<li>${esc(p.q)}${p.options?.length ? ` <span class="lh-muted">(${p.options.map(esc).join(' / ')})</span>` : ''}${p.a ? ` <span class="lh-ans">→ ${esc(p.a)}</span>` : ''}</li>`).join('')}</ol>` : '<div class="lh-muted">Savollar ro\'yxati yo\'q</div>'}
            </details>`).join('') : '<div class="lh-note">Bu darsda uy vazifasi yo\'q.</div>'}
        <div class="lh-muted lh-foot">Qism ${65}% dan yuqori bajarilganda o'tgan hisoblanadi. O'quvchilar natijasi — "O'quvchilar" yorlig'ida.</div>`;
    }

    // ── Shu dars bo'yicha o'quvchilar ───────────────────────────────────────
    function renderClass(panel, data) {
        const rows = data.classStats.students;
        if (!rows.length) {
            panel.innerHTML = `<div class="lh-note">${S.hub[S.lang]?.role === 'teacher' ? "Sizga hali o'quvchi biriktirilmagan." : "Bu yo'nalishda o'quvchi yo'q."}</div>`;
            return;
        }
        panel.innerHTML = `<div class="lh-card lh-table-wrap"><table class="lh-table">
            <thead><tr><th>O'quvchi</th><th>Bajarilgan</th><th>${data.lesson.type === 'live' ? 'Slaydlar' : 'Video'}</th><th>So'zlar</th><th>Uy vazifasi</th><th>Natija</th><th>Xatolar</th><th>Vaqt</th></tr></thead>
            <tbody>${rows.map(r => `<tr data-student="${esc(r.id)}" tabindex="0">
                <td><b>${esc(r.name)}</b></td>
                <td>${bar(r.percent)}</td>
                <td>${r.watch ? '✅' : '—'}</td><td>${r.vocab ? '✅' : '—'}</td>
                <td>${r.homeworkTotal ? `${r.homeworkDone}/${r.homeworkTotal}` : '—'}</td>
                <td>${r.bestPercent === null ? '—' : pct(r.bestPercent)}</td>
                <td>${r.mistakes || '—'}</td><td>${dur(r.seconds)}</td></tr>`).join('')}</tbody></table></div>
            <div class="lh-muted lh-foot">Qatorni bosing — o'quvchining to'liq kartasi ochiladi.</div>`;
        panel.querySelectorAll('[data-student]').forEach(tr => {
            const open = () => { S.view = 'students'; S.openStudent = tr.dataset.student; savePrefs(); render(); };
            tr.addEventListener('click', open);
            tr.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
        });
    }

    const bar = p => `<span class="lh-bar" title="${p}%"><i style="width:${Math.max(0, Math.min(100, p))}%" class="${p >= 100 ? 'ok' : p >= 50 ? 'mid' : 'low'}"></i></span><span class="lh-pct">${p}%</span>`;
    const pct = p => `<span class="lh-score ${p >= 85 ? 'ok' : p >= 65 ? 'mid' : 'low'}">${p}%</span>`;
    function dur(sec) {
        sec = Number(sec) || 0;
        if (!sec) return '—';
        const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
        return h ? `${h} soat ${m} daq` : `${Math.max(1, m)} daq`;
    }
    function ago(isoStr) {
        if (!isoStr) return 'hech qachon';
        const d = (Date.now() - new Date(isoStr)) / 86400000;
        if (d < 1 / 24) return 'hozirgina';
        if (d < 1) return `${Math.floor(d * 24)} soat oldin`;
        if (d < 2) return 'kecha';
        return `${Math.floor(d)} kun oldin`;
    }

    // ── Materiallar (fayl / havola) ─────────────────────────────────────────
    function materialSection(data, kind, title, hint, listOverride) {
        const list = listOverride || lessonMaterials(data, kind);
        const canEdit = S.hub[S.lang]?.canEdit;
        if (!list.length && !canEdit) return `<div class="lh-card is-empty"><div class="lh-card-h"><b>${esc(title)}</b></div><div class="lh-muted">Hali yuklanmagan. Admin yoki metodist qo'shadi.</div></div>`;
        return `<div class="lh-card"><div class="lh-card-h"><b>${esc(title)}</b>${canEdit ? `<span class="lh-gap"></span>
            <button type="button" class="lh-btn" data-add="${kind}" data-mode="file">＋ Fayl</button>
            <button type="button" class="lh-btn" data-add="${kind}" data-mode="link">＋ Havola</button>` : ''}</div>
            ${hint ? `<div class="lh-muted lh-hint">${esc(hint)}</div>` : ''}
            ${list.length ? `<div class="lh-files">${list.map(fileRow).join('')}</div>` : '<div class="lh-empty-sm">Hali material yo\'q</div>'}</div>`;
    }

    const isPdf = m => /\.pdf(\?|$)/i.test(m.url) || m.mime === 'application/pdf';
    function fileRow(m) {
        const canEdit = S.hub[S.lang]?.canEdit;
        const size = m.fileSize ? ` · ${(m.fileSize / 1048576).toFixed(1)} MB` : '';
        return `<div class="lh-file">
            <span class="lh-file-ic">${KIND_ICON[m.kind] || '📄'}</span>
            <span class="lh-file-body"><b>${esc(m.title)}</b><span class="lh-muted">${esc(m.fileName || m.url)}${size}${m.note ? ` · ${esc(m.note)}` : ''}</span></span>
            ${isPdf(m) ? `<button type="button" class="lh-btn" data-present-file="${esc(m.id)}">▶ Ko'rsatish</button>` : ''}
            <a class="lh-btn" href="${esc(m.url)}" target="_blank" rel="noopener">Ochish</a>
            ${canEdit ? `<button type="button" class="lh-btn lh-danger" data-del="${esc(m.id)}" aria-label="O'chirish">🗑</button>` : ''}
        </div>`;
    }

    function bindMaterialActions(panel, data) {
        panel.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () =>
            openMaterialForm({ kind: b.dataset.add, mode: b.dataset.mode, lessonNo: data?.lesson?.no ?? null })));
        panel.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteMaterial(b.dataset.del)));
        panel.querySelectorAll('[data-present-file]').forEach(b => b.addEventListener('click', () => {
            const all = [...(data?.materials || []), ...(S.hub[S.lang]?.courseMaterials || [])];
            const m = all.find(x => x.id === b.dataset.presentFile);
            if (!m) return;
            if (data?.lesson) present(data, { fileId: m.id });
            else LessonPresenter.open({ title: m.title, sources: [{ type: 'pdf', url: m.url, title: m.title }] });
        }));
    }

    function invalidate(lessonNo) {
        delete S.hub[S.lang];
        if (lessonNo) delete S.lessonCache[`${S.lang}:${lessonNo}`];
        else Object.keys(S.lessonCache).filter(k => k.startsWith(S.lang + ':')).forEach(k => delete S.lessonCache[k]);
    }

    async function deleteMaterial(id) {
        if (!confirm("Material o'chirilsinmi? (Arxivga o'tadi, fayl saqlanib qoladi)")) return;
        try {
            await api(`/api/academic/materials/${encodeURIComponent(id)}`, { method: 'DELETE' });
            invalidate();
            await ensureHub(true);
            toast("O'chirildi");
            render();
        } catch (e) { toast(e.message); }
    }

    function openMaterialForm({ kind, mode, lessonNo, existing }) {
        const hub = S.hub[S.lang];
        const label = hub.kinds.lesson[kind] || hub.kinds.course[kind] || kind;
        const isBook = kind === 'book';
        const wrap = document.createElement('div');
        wrap.className = 'lh-modal';
        wrap.innerHTML = `<form class="lh-dialog" role="dialog" aria-modal="true" aria-label="${esc(label)}">
            <h3>${esc(label)}${lessonNo ? ` · ${lessonNo}-dars` : ''}</h3>
            <label>Nomi<input name="title" required maxlength="200" class="lh-input" value="${esc(existing?.title || '')}" placeholder="${isBook ? "Masalan: Darslik 1-qism (1–24-darslar)" : 'Masalan: 12-dars slaydlari'}"></label>
            ${mode === 'file' ? `<label>Fayl (PDF tavsiya etiladi, 50 MB gacha)<input name="file" type="file" required accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.webp,.mp4,.mp3"></label>`
                : `<label>Havola (https://…, YouTube, Google Drive)<input name="url" type="url" required class="lh-input" placeholder="https://"></label>`}
            ${isBook ? `<div class="lh-row"><label>Qaysi darsdan<input name="lessonFrom" type="number" min="1" max="72" class="lh-input" value="1"></label>
                <label>Qaysi darsgacha<input name="lessonTo" type="number" min="1" max="72" class="lh-input" value="24"></label></div>
                <label>Darslar boshlanadigan sahifalar <span class="lh-muted">(ixtiyoriy: "1:5, 2:9, 3:14")</span><textarea name="pageMap" rows="3" class="lh-input" placeholder="1:5, 2:9, 3:14"></textarea></label>` : ''}
            <label>Izoh <span class="lh-muted">(ixtiyoriy)</span><input name="note" maxlength="300" class="lh-input"></label>
            <div class="lh-dialog-actions"><button type="button" class="lh-btn" data-cancel>Bekor qilish</button><button type="submit" class="lh-btn lh-primary">Saqlash</button></div>
            <div class="lh-progress" hidden>Yuklanmoqda…</div>
        </form>`;
        document.body.appendChild(wrap);
        const form = wrap.querySelector('form');
        const closeForm = () => wrap.remove();
        wrap.addEventListener('click', e => { if (e.target === wrap) closeForm(); });
        wrap.querySelector('[data-cancel]').onclick = closeForm;
        form.querySelector('input[name="title"]').focus();
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const fd = new FormData(form);
            const btn = form.querySelector('[type="submit"]');
            btn.disabled = true;
            form.querySelector('.lh-progress').hidden = false;
            try {
                let url = String(fd.get('url') || '').trim(), fileName = '', fileSize = 0, mime = '';
                const file = fd.get('file');
                if (mode === 'file') {
                    if (!file || !file.size) throw new Error('Fayl tanlang');
                    if (file.size > 50 * 1048576) throw new Error('Fayl 50 MB dan katta');
                    const up = await apiUploadFile(file);
                    url = up.url; fileName = up.fileName || file.name; fileSize = up.fileSize || file.size; mime = up.mimeType || file.type;
                }
                const meta = isBook ? { lessonFrom: fd.get('lessonFrom'), lessonTo: fd.get('lessonTo'), pageMap: String(fd.get('pageMap') || '') } : {};
                await api('/api/academic/materials', { method: 'POST', body: JSON.stringify({
                    language: S.lang, lessonNo, kind, title: String(fd.get('title') || '').trim(), url, fileName, fileSize, mime,
                    note: String(fd.get('note') || ''), meta,
                }) });
                closeForm();
                invalidate(lessonNo);
                await ensureHub(true);
                toast('Saqlandi');
                render();
            } catch (err) {
                btn.disabled = false;
                form.querySelector('.lh-progress').hidden = true;
                toast(err.message);
            }
        });
    }

    // ── Prezentatsiya manbalari ─────────────────────────────────────────────
    function present(data, opts = {}) {
        const L = data.lesson;
        const pdf = m => ({ type: 'pdf', url: m.url, title: `${m.kindLabel}: ${m.title}`, id: m.id });
        const sources = [];
        const live = lessonMaterials(data, 'live_slides').filter(isPdf).map(pdf);
        const vids = lessonMaterials(data, 'video_slides').filter(isPdf).map(pdf);
        const gram = lessonMaterials(data, 'grammar_slides').filter(isPdf).map(pdf);
        const appSlides = L.slides.filter(s => s.imageUrl).length
            ? { type: 'images', title: `Ilovadagi slaydlar (${L.slides.filter(s => s.imageUrl).length})`, key: 'app-slides', items: L.slides.filter(s => s.imageUrl).map(s => ({ url: s.imageUrl, caption: s.title })) } : null;
        const words = L.vocabulary.length ? { type: 'words', title: `So'z kartochkalari (${L.vocabulary.length})`, key: 'words', items: L.vocabulary } : null;
        const video = L.videoUrl ? { type: 'video', url: L.videoUrl, title: 'Videodars' } : null;
        if (L.type === 'live') sources.push(...live, words, ...gram, ...vids, appSlides, video);
        else sources.push(...vids, appSlides, video, words, ...gram, ...live);
        if (data.book) sources.push({ type: 'pdf', url: data.book.url, title: `Kitob: ${data.book.title}`, key: 'book' });
        const list = sources.filter(Boolean);
        list.push({ type: 'blank', title: "Bo'sh doska", key: 'blank' });
        let start = 0, startPage = opts.page || 1;
        if (opts.blank) start = list.length - 1;
        else if (opts.fileId) start = Math.max(0, list.findIndex(s => s.id === opts.fileId));
        else if (opts.prefer) start = Math.max(0, list.findIndex(s => s.key === opts.prefer));
        else if (list[0]?.key === 'book' && data.book.page) startPage = data.book.page;
        if (list[start]?.key === 'book' && !opts.page && data.book.page) startPage = data.book.page;
        LessonPresenter.open({ title: `${L.no}-dars · ${plain(L.name)}`, sources: list, start, startPage });
    }

    // ── O'quvchilar progressi ───────────────────────────────────────────────
    async function renderStudentsView(main) {
        main.innerHTML = skeleton();
        let data = S.students[S.lang];
        if (!data) {
            try { data = S.students[S.lang] = await api(`/api/academic/students?lang=${S.lang}`); }
            catch (e) { main.innerHTML = `<div class="lh-error"><b>Yuklab bo'lmadi</b><span>${esc(e.message)}</span></div>`; return; }
        }
        if (S.view !== 'students') return;
        const list = sortStudents(data.students);
        const idle = data.students.filter(s => s.flags.some(f => f.key === 'idle')).length;
        const struggling = data.students.filter(s => s.flags.some(f => f.key === 'struggling')).length;
        const behind = data.students.filter(s => s.flags.some(f => f.key === 'behind')).length;
        const weekTotal = data.students.reduce((a, s) => a + s.time.week, 0);
        const avgReached = data.students.length ? Math.round(data.students.reduce((a, s) => a + s.reached, 0) / data.students.length) : 0;
        main.innerHTML = `
        <div class="lh-kpis">
            <div class="lh-kpi"><span>O'quvchilar</span><b>${data.students.length}</b></div>
            <div class="lh-kpi"><span>O'rtacha dars</span><b>${avgReached || '—'}</b><small>72 dan</small></div>
            <div class="lh-kpi"><span>7 kunda ilovada</span><b>${dur(weekTotal)}</b><small>jami</small></div>
            <div class="lh-kpi ${idle ? 'is-warn' : ''}"><span>Faol emas (3+ kun)</span><b>${idle}</b></div>
            <div class="lh-kpi ${struggling ? 'is-warn' : ''}"><span>Uy vazifasida qiynalyapti</span><b>${struggling}</b></div>
            <div class="lh-kpi ${behind ? 'is-warn' : ''}"><span>Rejadan orqada</span><b>${behind}</b></div>
        </div>
        <div class="lh-note">Vaqt va xatolar yangi ilovadan ${data.trackingSince ? `${esc(fmtDate(data.trackingSince))} dan` : 'yangi versiya chiqqandan'} boshlab yig'iladi. Dars bosqichlari (video, so'zlar, uy vazifasi) — avvaldan saqlangan.</div>
        <div class="lh-card lh-table-wrap">
            <div class="lh-card-h"><b>Barcha o'quvchilar</b><span class="lh-gap"></span>
                <input type="search" class="lh-input lh-small" placeholder="Ism bo'yicha" aria-label="O'quvchini qidirish">
                <select class="lh-input lh-small" aria-label="Saralash">${[['attention', 'Avval e\'tibor kerak'], ['reached', 'Dars bo\'yicha'], ['time', 'Vaqt (7 kun)'], ['homework', 'Uy vazifasi natijasi'], ['name', 'Ism']].map(([k, l]) => `<option value="${k}"${S.studentSort === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
            </div>
            ${list.length ? `<table class="lh-table"><thead><tr><th>O'quvchi</th><th>Dars</th><th>O'rtacha bajarilish</th><th>Tugatgan</th><th>Uy vazifasi</th><th>Xatolar</th><th>Ilovada (7 kun / jami)</th><th>Faol kunlar</th><th>Oxirgi faollik</th><th>Holat</th></tr></thead>
            <tbody>${list.map(s => `<tr data-student="${esc(s.id)}" tabindex="0">
                <td><b>${esc(s.name)}</b>${s.group ? `<div class="lh-muted">${esc(s.group)}</div>` : ''}${s.role === 'assistant' ? '<div class="lh-tag">yordamchi</div>' : ''}</td>
                <td><b>${s.reached || '—'}</b>${s.expected ? `<div class="lh-muted">reja: ${s.expected}</div>` : ''}</td>
                <td>${bar(s.avgPercent)}</td><td>${s.completed}/72</td>
                <td>${s.homeworkAvg === null ? '—' : pct(s.homeworkAvg)}</td><td>${s.mistakes || '—'}</td>
                <td>${dur(s.time.week)} <span class="lh-muted">/ ${dur(s.time.total)}</span></td>
                <td>${s.activeDays7}/7</td><td>${esc(ago(s.lastActive))}</td>
                <td>${s.flags.length ? s.flags.map(f => `<span class="lh-flag ${f.key}">${esc(f.label)}</span>`).join('') : '<span class="lh-flag ok">Yaxshi</span>'}</td></tr>`).join('')}</tbody></table>`
                : `<div class="lh-empty-sm">${S.hub[S.lang]?.role === 'teacher' ? "Sizga hali o'quvchi biriktirilmagan" : "Bu yo'nalishda o'quvchi yo'q"}</div>`}
        </div>
        <div id="lhStudent"></div>`;
        const tbody = main.querySelector('tbody');
        main.querySelector('input[type="search"]').addEventListener('input', e => {
            const q = e.target.value.toLowerCase();
            tbody?.querySelectorAll('tr').forEach(tr => { tr.hidden = !tr.textContent.toLowerCase().includes(q); });
        });
        main.querySelector('select').addEventListener('change', e => { S.studentSort = e.target.value; renderStudentsView(main); });
        tbody?.querySelectorAll('[data-student]').forEach(tr => {
            tr.addEventListener('click', () => openStudent(tr.dataset.student));
            tr.addEventListener('keydown', e => { if (e.key === 'Enter') openStudent(tr.dataset.student); });
        });
        if (S.openStudent) openStudent(S.openStudent);
    }

    function sortStudents(list) {
        const arr = [...list];
        const by = {
            attention: (a, b) => b.flags.length - a.flags.length || (b.daysIdle ?? 999) - (a.daysIdle ?? 999),
            reached: (a, b) => b.reached - a.reached,
            time: (a, b) => b.time.week - a.time.week,
            homework: (a, b) => (a.homeworkAvg ?? 101) - (b.homeworkAvg ?? 101),
            name: (a, b) => a.name.localeCompare(b.name),
        }[S.studentSort] || (() => 0);
        return arr.sort(by);
    }
    const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const fmtDate = d => { const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])}-${UZ_MONTHS[Number(m[2]) - 1]}` : String(d); };

    async function openStudent(id) {
        S.openStudent = id;
        const host = document.getElementById('lhStudent');
        if (!host) return;
        host.innerHTML = `<div class="lh-drawer-bg"></div><aside class="lh-drawer" role="dialog" aria-modal="true" aria-label="O'quvchi kartasi">${skeleton()}</aside>`;
        const closeD = () => { S.openStudent = null; host.innerHTML = ''; document.removeEventListener('keydown', esc1); };
        const esc1 = e => { if (e.key === 'Escape') closeD(); };
        document.addEventListener('keydown', esc1);
        host.querySelector('.lh-drawer-bg').onclick = closeD;
        let d = S.studentDetail[id];
        if (!d) {
            try { d = S.studentDetail[id] = await api(`/api/academic/students/${encodeURIComponent(id)}`); }
            catch (e) { host.querySelector('.lh-drawer').innerHTML = `<div class="lh-error"><b>Yuklab bo'lmadi</b><span>${esc(e.message)}</span><button type="button" class="lh-btn" data-x>Yopish</button></div>`; host.querySelector('[data-x]').onclick = closeD; return; }
        }
        if (S.openStudent !== id) return;
        const s = d.student;
        const sel = { no: Math.max(1, s.reached || 1) };
        const drawer = host.querySelector('.lh-drawer');
        drawer.innerHTML = `
            <div class="lh-drawer-h"><div><h3>${esc(s.name)}</h3><div class="lh-muted">${s.group ? esc(s.group) + ' · ' : ''}oxirgi faollik: ${esc(ago(s.lastActive))}</div></div>
                <button type="button" class="lh-btn" data-x aria-label="Yopish">✕</button></div>
            ${s.flags.length ? `<div class="lh-flags">${s.flags.map(f => `<span class="lh-flag ${f.key}">${esc(f.label)}</span>`).join('')}</div>` : ''}
            <div class="lh-kpis is-small">
                <div class="lh-kpi"><span>Hozirgi dars</span><b>${s.reached || '—'}</b>${s.expected ? `<small>reja: ${s.expected}</small>` : ''}</div>
                <div class="lh-kpi"><span>Tugatgan darslar</span><b>${s.completed}</b><small>72 dan</small></div>
                <div class="lh-kpi"><span>Uy vazifasi o'rtacha</span><b>${s.homeworkAvg === null ? '—' : s.homeworkAvg + '%'}</b></div>
                <div class="lh-kpi"><span>Ilovada</span><b>${dur(s.time.total)}</b><small>bugun ${dur(s.time.today)} · 7 kun ${dur(s.time.week)}</small></div>
            </div>
            <div class="lh-card"><div class="lh-card-h"><b>72 dars xaritasi</b><span class="lh-muted">katakni bosing</span></div>
                <div class="lh-heat">${d.lessons.map(l => `<button type="button" class="lh-cell ${heatClass(l)}" data-cell="${l.no}" title="${l.no}-dars: ${l.percent}%">${l.no}</button>`).join('')}</div>
                <div class="lh-legend"><span class="lh-cell c0"></span>boshlanmagan <span class="lh-cell c1"></span>1–49% <span class="lh-cell c2"></span>50–99% <span class="lh-cell c3"></span>100%</div>
            </div>
            <div class="lh-card" id="lhCellDetail"></div>
            <div class="lh-card"><div class="lh-card-h"><b>Ilovadagi vaqt — oxirgi 30 kun</b></div>${timeChart(d.timeByDay)}
                ${Object.keys(d.timeBySection).length ? `<div class="lh-sections">${Object.entries(d.timeBySection).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span><b>${esc(SECTION_LABEL[k] || k)}</b> ${dur(v)}</span>`).join('')}</div>` : ''}
            </div>
            ${d.activity.length ? `<div class="lh-card"><div class="lh-card-h"><b>Faoliyat tarixi</b><span class="lh-muted">imtihon va mashqlar</span></div>
                <ul class="lh-activity">${d.activity.slice(0, 25).map(a => `<li><span>${esc(a.label)}</span>${typeof a.scorePercent === 'number' ? pct(a.scorePercent) : ''}<span class="lh-muted">${esc(ago(a.time))}</span>
                    ${(a.mistakes || []).length ? `<details><summary>${a.mistakes.length} ta xato</summary><ol class="lh-qa">${a.mistakes.map(m => `<li>${esc(m.question)} <span class="lh-bad">${esc(m.yourAnswer || '')}</span> <span class="lh-ans">→ ${esc(m.correctAnswer || '')}</span></li>`).join('')}</ol></details>` : ''}</li>`).join('')}</ul></div>` : ''}`;
        drawer.querySelector('[data-x]').onclick = closeD;
        const showCell = no => {
            sel.no = no;
            drawer.querySelectorAll('[data-cell]').forEach(c => c.classList.toggle('is-sel', Number(c.dataset.cell) === no));
            const l = d.lessons.find(x => x.no === no);
            const box = drawer.querySelector('#lhCellDetail');
            if (!l) { box.innerHTML = '<div class="lh-muted">Bu dars kursda yo\'q</div>'; return; }
            box.innerHTML = `<div class="lh-card-h"><b>${l.no}-dars · ${esc(plain(l.name))}</b><span class="lh-type ${l.type}">${l.type === 'live' ? 'Jonli' : 'Video'}</span><span class="lh-gap"></span>${bar(l.percent)}</div>
                <div class="lh-steps">
                    <span class="${l.steps.watch ? 'ok' : ''}">${l.steps.watch ? '✅' : '⬜'} ${l.type === 'live' ? 'Slaydlar' : 'Video'}</span>
                    <span class="${l.steps.vocabList ? 'ok' : ''}">${l.steps.vocabList ? '✅' : '⬜'} So'zlar ro'yxati</span>
                    <span class="${l.steps.vocabPractice ? 'ok' : ''}">${l.steps.vocabPractice ? '✅' : '⬜'} So'z mashqi</span>
                    <span>📝 Uy vazifasi ${l.steps.homeworkDone}/${l.steps.homeworkTotal}</span>
                    <span>⏱ ${dur(l.seconds)}</span>
                </div>
                ${l.results.length ? `<table class="lh-table is-compact"><thead><tr><th>Qism</th><th>Oxirgi</th><th>Eng yaxshi</th><th>Urinish</th><th>Xatolar</th></tr></thead><tbody>
                    ${l.results.map(r => `<tr><td>${esc(r.title || HW_KIND[r.kind] || r.kind)}</td><td>${r.correct}/${r.total}</td><td>${pct(r.bestPercent)}</td><td>${r.attempts}</td>
                    <td>${r.mistakes.length ? `<details><summary>${r.mistakes.length} ta</summary><ol class="lh-qa">${r.mistakes.map(m => `<li>${esc(m.question)}${m.yourAnswer ? ` <span class="lh-bad">${esc(m.yourAnswer)}</span>` : ''}${m.correctAnswer ? ` <span class="lh-ans">→ ${esc(m.correctAnswer)}</span>` : ''}</li>`).join('')}</ol></details>` : '—'}</td></tr>`).join('')}</tbody></table>`
                    : `<div class="lh-muted">${l.started ? "Uy vazifasi natijalari yangi ilovada yig'iladi." : 'Bu dars hali boshlanmagan.'}</div>`}`;
        };
        drawer.querySelectorAll('[data-cell]').forEach(c => c.addEventListener('click', () => showCell(Number(c.dataset.cell))));
        showCell(sel.no);
        drawer.querySelector('[data-x]').focus();
    }

    function heatClass(l) {
        if (!l.started && !l.percent) return 'c0';
        if (l.percent >= 100) return 'c3';
        if (l.percent >= 50) return 'c2';
        return 'c1';
    }

    function timeChart(byDay) {
        const days = [];
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            days.push({ k, v: byDay[k] || 0, label: d.getDate() });
        }
        const max = Math.max(...days.map(d => d.v), 600);
        const total = days.reduce((a, d) => a + d.v, 0);
        if (!total) return '<div class="lh-muted">Oxirgi 30 kunda vaqt qayd etilmagan.</div>';
        const W = 600, H = 120, bw = W / days.length;
        return `<svg class="lh-chart" viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="Kunlik vaqt, jami ${dur(total)}">
            ${days.map((d, i) => { const h = Math.round((d.v / max) * H); return `<rect x="${i * bw + 2}" y="${H - h}" width="${bw - 4}" height="${Math.max(h, d.v ? 2 : 0)}" rx="2"><title>${d.k}: ${dur(d.v)}</title></rect>${i % 5 === 4 ? `<text x="${i * bw + bw / 2}" y="${H + 14}" text-anchor="middle">${d.label}</text>` : ''}`; }).join('')}
        </svg><div class="lh-muted">Jami 30 kunda: ${dur(total)}</div>`;
    }

    // ── Kitob ───────────────────────────────────────────────────────────────
    function renderBookView(main) {
        const hub = S.hub[S.lang];
        const books = hub.courseMaterials.filter(m => m.kind === 'book').sort((a, b) => (a.meta.lessonFrom || 0) - (b.meta.lessonFrom || 0));
        const st = S.bookState[S.lang] || {};
        const current = books.find(b => b.id === st.id) || books[0];
        main.innerHTML = `
        <div class="lh-book">
            <aside class="lh-card lh-book-list">
                <div class="lh-card-h"><b>Darslik kitoblari</b>${hub.canEdit ? `<span class="lh-gap"></span><button type="button" class="lh-btn" data-add="book" data-mode="file">＋ Kitob</button>` : ''}</div>
                ${books.length ? books.map(b => `<div class="lh-file${current && b.id === current.id ? ' is-on' : ''}">
                    <button type="button" class="lh-file-body lh-linkish" data-book="${esc(b.id)}"><b>📖 ${esc(b.title)}</b><span class="lh-muted">${b.meta.lessonFrom || 1}–${b.meta.lessonTo || 72}-darslar${Object.keys(b.meta.pageMap || {}).length ? ' · sahifalar belgilangan' : ''}</span></button>
                    ${hub.canEdit ? `<button type="button" class="lh-btn lh-danger" data-del="${esc(b.id)}" aria-label="O'chirish">🗑</button>` : ''}
                </div>`).join('') : `<div class="lh-muted">Kitob PDF hali yuklanmagan.${hub.canEdit ? " «＋ Kitob» orqali 1, 2, 3-qismlarni yuklang va har biri qaysi darslarni qamrashini belgilang." : ''}</div>`}
                ${current ? `<label class="lh-jump">Darsga o'tish <select aria-label="Darsga o'tish"><option value="">—</option>${hub.syllabus.filter(l => l.no >= (current.meta.lessonFrom || 1) && l.no <= (current.meta.lessonTo || 72)).map(l => `<option value="${l.no}"${current.meta.pageMap?.[l.no] ? '' : ' disabled'}>${l.no}-dars${current.meta.pageMap?.[l.no] ? ` · ${current.meta.pageMap[l.no]}-bet` : ''}</option>`).join('')}</select></label>
                    <button type="button" class="lh-btn lh-primary" data-book-present>▶ Prezentatsiyada ochish</button>` : ''}
            </aside>
            <section class="lh-card lh-book-view" id="lhBookView">${current ? '' : '<div class="lh-empty-sm">Kitob tanlanmagan</div>'}</section>
        </div>`;
        bindMaterialActions(main, null);
        main.querySelectorAll('[data-book]').forEach(b => b.addEventListener('click', () => { S.bookState[S.lang] = { id: b.dataset.book, page: 1 }; renderBookView(main); }));
        if (!current) return;
        const page = st.id === current.id ? (st.page || 1) : 1;
        LessonPresenter.mountPdfReader(main.querySelector('#lhBookView'), {
            url: current.url, page,
            onPage: p => { S.bookState[S.lang] = { id: current.id, page: p }; },
        }).then(reader => {
            S.reader = reader;
            main.querySelector('.lh-jump select')?.addEventListener('change', e => {
                const p = current.meta.pageMap?.[e.target.value];
                if (p && reader) reader.goTo(p);
            });
        });
        main.querySelector('[data-book-present]').addEventListener('click', () => LessonPresenter.open({
            title: current.title, sources: [{ type: 'pdf', url: current.url, title: current.title }],
            startPage: S.bookState[S.lang]?.page || 1,
        }));
    }

    // ── Teacher's book ──────────────────────────────────────────────────────
    function renderGuideView(main) {
        const hub = S.hub[S.lang];
        const files = hub.courseMaterials.filter(m => m.kind === 'teacher_book' || m.kind === 'methodology');
        const fake = { materials: files, lesson: null };
        main.innerHTML = `
        <div class="lh-guide">
            <div class="lh-card"><div class="lh-card-h"><b>Kurs tuzilmasi</b></div>
                <ul class="lh-rules">
                    <li><b>72 dars · 3 oy</b> — har oy 24 dars. Toq raqamli darslar <span class="lh-type video">Video</span> (o'quvchi ilovada mustaqil), juft raqamlilar <span class="lh-type live">Jonli</span> (ustoz bilan).</li>
                    <li><b>Dars ochilishi:</b> videodars oldingi dars 50% bajarilganda ochiladi. Jonli dars — ustoz davomatni belgilaganda yoki oldingi dars 60% bajarilganda.</li>
                    <li><b>Dars bajarilishi</b> = (video yoki slaydlar + so'zlar + uy vazifasi) ÷ 3.</li>
                    <li><b>Uy vazifasi:</b> har qism ${65}% dan yuqori bo'lsa o'tadi. Ijodiy va o'qish vazifalarini ustoz baholaydi.</li>
                    <li><b>Imtihonlar:</b> har 12 darsdan keyin oraliq imtihon va kurs oxirida yakuniy imtihon (o'tish — 70%).</li>
                    <li><b>Davomat</b> darsdan keyin darhol belgilanadi — u jonli darsni ilovada ochadi va oylik hisobiga kiradi.</li>
                </ul></div>
            <div class="lh-card"><div class="lh-card-h"><b>Jonli darsni qanday o'tkazamiz</b></div>
                <ol class="lh-rules">
                    <li>Darsdan oldin: shu sahifada <b>Dars rejasi</b>ni oching, oldingi darsni bajarmaganlar ro'yxatiga qarang.</li>
                    <li><b>▶ Darsni boshlash</b> — slaydlar, so'z kartochkalari, kitob va bo'sh doska bitta oynada. Slayd ustiga chizish mumkin (P — qalam, M — marker, L — lazer, B — yangi doska).</li>
                    <li>O'quvchi ko'proq gapirsin: ustoz nutqi 30% dan oshmasin.</li>
                    <li>Darsdan keyin: davomat, ijodiy vazifalarni baholash, faol bo'lmaganlarga xabar.</li>
                    <li>Haftada bir marta: <b>O'quvchilar progressi</b>dagi "e'tibor kerak" ro'yxatini ko'rib chiqing.</li>
                </ol></div>
            ${materialSection(fake, 'teacher_book', "Teacher's book (to'liq qo'llanma)", 'Kurs bo\'yicha ustoz kitobi — PDF.', files.filter(f => f.kind === 'teacher_book'))}
            ${materialSection(fake, 'methodology', 'Metodika va standartlar', 'Baholash mezonlari, dars kuzatuv varaqasi va boshqa hujjatlar.', files.filter(f => f.kind === 'methodology'))}
            <div class="lh-card lh-table-wrap"><div class="lh-card-h"><b>72 darslik reja</b><span class="lh-gap"></span><button type="button" class="lh-btn" data-print-syllabus>🖨 Chop etish</button></div>
                <table class="lh-table is-compact"><thead><tr><th>№</th><th>Turi</th><th>Dars</th><th>Maqsad</th><th>So'z</th><th>Vazifa</th></tr></thead>
                <tbody>${hub.syllabus.map(l => `<tr data-open-lesson="${l.no}" tabindex="0"><td>${l.no}</td><td><span class="lh-type ${l.type}">${l.type === 'live' ? 'Jonli' : 'Video'}</span></td>
                    <td><b>${esc(plain(l.name))}</b>${l.topic ? `<div class="lh-muted">${esc(plain(l.topic))}</div>` : ''}</td><td class="lh-muted">${esc(l.cando)}</td><td>${l.counts.vocab || '—'}</td><td>${l.counts.homework ? `${l.counts.homework} qism` : '—'}</td></tr>`).join('')}</tbody></table></div>
        </div>`;
        // Kurs darajasidagi materiallar (lessonNo = null)
        main.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => openMaterialForm({ kind: b.dataset.add, mode: b.dataset.mode, lessonNo: null })));
        main.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteMaterial(b.dataset.del)));
        main.querySelectorAll('[data-present-file]').forEach(b => b.addEventListener('click', () => {
            const m = files.find(x => x.id === b.dataset.presentFile);
            if (m) LessonPresenter.open({ title: m.title, sources: [{ type: 'pdf', url: m.url, title: m.title }] });
        }));
        main.querySelectorAll('[data-open-lesson]').forEach(tr => {
            const go = () => { S.view = 'lessons'; S.selected[S.lang] = Number(tr.dataset.openLesson); savePrefs(); render(); };
            tr.addEventListener('click', go);
            tr.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
        });
        main.querySelector('[data-print-syllabus]').addEventListener('click', () => {
            const w = window.open('', '_blank');
            if (!w) return toast("Brauzer yangi oynani bloklab qo'ydi");
            w.document.write(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>72 darslik reja</title><style>body{font:12px/1.4 system-ui,sans-serif;margin:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:5px;text-align:left;vertical-align:top}th{background:#f3f3f7}</style></head><body>
                <h2>${esc(LANG_LABEL[S.lang])} · 72 darslik reja</h2><table><tr><th>№</th><th>Turi</th><th>Dars</th><th>Maqsad</th></tr>
                ${hub.syllabus.map(l => `<tr><td>${l.no}</td><td>${l.type === 'live' ? 'Jonli' : 'Video'}</td><td>${esc(plain(l.name))}</td><td>${esc(l.cando)}</td></tr>`).join('')}</table>
                <script>window.onload=()=>window.print()<\/script></body></html>`);
            w.document.close();
        });
    }

    // ── Eski "Qo'shimcha materiallar" (mobileContent.documents) ─────────────
    function renderExtraView(main) {
        main.innerHTML = '<div class="lh-legacy tp-textbook-legacy"></div>';
        if (typeof S.ctx.renderLegacy === 'function') S.ctx.renderLegacy(main.firstElementChild);
        else main.firstElementChild.innerHTML = '<div class="lh-muted">Mavjud emas</div>';
    }

    window.LessonHub = { mount, _state: S };
})();
