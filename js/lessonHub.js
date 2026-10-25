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
    const RULES = window.AcademicRules || { PASS_PERCENT: 65, UNLOCK_PERCENT: 50, LIVE_AUTO_UNLOCK: 60, EXAM_INTERVAL: 12, EXAM_PASS_PERCENT: 70, LESSONS_PER_WEEK: 6, SECTIONS: {} };
    const CACHE_MS = 3 * 60000;
    // Faqat o'z serverimizdagi yoki https havolalar href/src'ga tushadi.
    const safeUrl = u => (/^(https:\/\/|\/(?!\/))/i.test(String(u || '').trim()) ? String(u).trim() : '');
    const isLocalFile = u => /^\/uploads\//.test(String(u || ''));

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
    const SECTION_LABEL = RULES.SECTIONS || {};

    const S = {
        el: null, ctx: null, lang: 'english', view: 'lessons', hub: {}, lessonCache: {}, selected: {},
        tab: 'plan', search: '', filter: 'all', students: {}, studentDetail: {}, openStudent: null,
        studentSort: 'attention', duration: null, bookState: {}, reader: null, group: '', nearOnly: true, loadedAt: {},
    };
    const fresh = key => S.loadedAt[key] && Date.now() - S.loadedAt[key] < CACHE_MS;
    const stamp = key => { S.loadedAt[key] = Date.now(); };
    function refreshAll() {
        S.hub = {}; S.lessonCache = {}; S.students = {}; S.studentDetail = {}; S.loadedAt = {};
        ensureHub().then(render).catch(renderError);
    }

    function loadPrefs() {
        try {
            const p = JSON.parse(localStorage.getItem('mh_lesson_hub') || '{}');
            if (p.view) S.view = p.view;
            if (p.tab) S.tab = p.tab;
            if (p.selected) S.selected = p.selected;
            if (p.duration) S.duration = p.duration;
            if (typeof p.group === 'string') S.group = p.group;
            if (typeof p.nearOnly === 'boolean') S.nearOnly = p.nearOnly;
        } catch { /* maxfiy rejim */ }
    }
    function savePrefs() {
        try { localStorage.setItem('mh_lesson_hub', JSON.stringify({ view: S.view, tab: S.tab, selected: S.selected, duration: S.duration, group: S.group, nearOnly: S.nearOnly })); } catch { /* */ }
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
        if (S.hub[S.lang] && !force && fresh('hub:' + S.lang)) return S.hub[S.lang];
        const data = await api(`/api/academic/hub?lang=${S.lang}`);
        stamp('hub:' + data.lang);
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
                    ${VIEWS.map(v => `<button type="button" role="tab" tabindex="${S.view === v.id ? 0 : -1}" class="lh-view${S.view === v.id ? ' is-on' : ''}" aria-selected="${S.view === v.id}" data-view="${v.id}">${esc(v.label)}</button>`).join('')}
                </div>
                <div class="lh-meta">${hub ? `${esc(LANG_LABEL[hub.lang])} · ${esc(hub.course?.name || 'kurs')} · 72 dars · ${hub.studentCount} o'quvchi` : 'Yuklanmoqda…'}
                    <button type="button" class="lh-btn lh-icon" data-lh-refresh title="Ma'lumotlarni yangilash" aria-label="Ma'lumotlarni yangilash">⟳</button></div>
            </div>
            <div class="lh-main" id="lhMain">${hub ? '' : skeleton()}</div>
        </div>`;
        el.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
            S.view = b.dataset.view; savePrefs(); render();
        }));
        bindTablistKeys(el.querySelector('.lh-views'));
        el.querySelector('[data-lh-refresh]')?.addEventListener('click', refreshAll);
        if (!hub) return;
        const main = el.querySelector('#lhMain');
        if (S.view === 'lessons') renderLessonsView(main);
        else if (S.view === 'students') renderStudentsView(main);
        else if (S.view === 'book') renderBookView(main);
        else if (S.view === 'guide') renderGuideView(main);
        else renderExtraView(main);
    }

    // Yorliqlar: ←/→, Home/End bilan o'tish (WAI-ARIA tabs).
    function bindTablistKeys(list) {
        if (!list || list.dataset.keys) return;
        list.dataset.keys = '1';
        list.addEventListener('keydown', e => {
            const tabs = [...list.querySelectorAll('[role="tab"]')];
            const i = tabs.indexOf(document.activeElement);
            if (i < 0) return;
            const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
            if (next === undefined) return;
            e.preventDefault();
            const t = tabs[(next + tabs.length) % tabs.length];
            t.focus();
            t.click();
        });
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
        if (!S.lessonCache[key] || !fresh('lesson:' + key)) {
            box.innerHTML = skeleton();
            try { S.lessonCache[key] = await api(`/api/academic/lessons/${no}?lang=${S.lang}`); stamp('lesson:' + key); }
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
                ${L.type === 'live' && typeof window.switchTeachersSection === 'function' ? '<button type="button" class="lh-btn" data-act="attendance">✓ Davomat</button>' : ''}
            </div>
        </header>
        <div class="lh-tabs" role="tablist" aria-label="Dars bo'limlari">
            ${TABS.map(t => `<button type="button" role="tab" id="lhTab-${t.id}" aria-controls="lhPanel" tabindex="${S.tab === t.id ? 0 : -1}" class="lh-tab${S.tab === t.id ? ' is-on' : ''}" aria-selected="${S.tab === t.id}" data-tab="${t.id}">${esc(t.label)}${tabCount[t.id] ? ` <span class="lh-count">${tabCount[t.id]}</span>` : ''}</button>`).join('')}
        </div>
        <div class="lh-panel" role="tabpanel" id="lhPanel" aria-labelledby="lhTab-${S.tab}"></div>`;
        box.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
            S.tab = b.dataset.tab; savePrefs();
            box.querySelectorAll('[data-tab]').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b); x.tabIndex = x === b ? 0 : -1; });
            box.querySelector('.lh-panel').setAttribute('aria-labelledby', b.id);
            renderTab(box.querySelector('.lh-panel'), data);
        }));
        box.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => openLesson(L.no + Number(b.dataset.go), { scroll: true })));
        box.querySelector('[data-act="present"]').addEventListener('click', () => present(data));
        box.querySelector('[data-act="board"]').addEventListener('click', () => present(data, { blank: true }));
        box.querySelector('[data-act="print"]').addEventListener('click', () => printPlan(data));
        box.querySelector('[data-act="attendance"]')?.addEventListener('click', () => window.switchTeachersSection('attendance'));
        bindTablistKeys(box.querySelector('.lh-tabs'));
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
                ${safeUrl(L.videoUrl) ? `<div class="lh-card"><div class="lh-card-h"><b>Videodars</b><a class="lh-btn" href="${esc(safeUrl(L.videoUrl))}" target="_blank" rel="noopener">Ochish</a></div>${videoEmbed(safeUrl(L.videoUrl))}</div>` : ''}
                ${L.slides.length ? `<div class="lh-card"><div class="lh-card-h"><b>Ilovadagi slaydlar</b> <span class="lh-muted">${L.slides.length} ta · o'quvchi ilovada ko'radi</span>
                    <button type="button" class="lh-btn" data-present-src="app-slides">▶ Ko'rsatish</button></div>
                    <div class="lh-thumbs">${L.slides.map((s, i) => s.imageUrl ? `<button type="button" class="lh-thumb" data-slide="${i}" title="${esc(s.title)}"><img loading="lazy" src="${esc(safeUrl(s.imageUrl))}" alt="${esc(s.title || `${i + 1}-slayd`)}"><span>${i + 1}</span></button>`
                        : `<div class="lh-thumb is-text"><b>${esc(s.title)}</b><span>${esc(String(s.body).slice(0, 120))}</span></div>`).join('')}</div></div>` : ''}
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
                        ${safeUrl(w.imageUrl) ? `<img loading="lazy" src="${esc(safeUrl(w.imageUrl))}" alt="">` : `<div class="lh-word-ic">${esc(w.icon || '🔤')}</div>`}
                        <div><b>${esc(w.word)}</b>${w.transcript ? ` <span class="lh-muted">${esc(w.transcript)}</span>` : ''}
                        <div>${esc(w.translation)}</div>${w.example ? `<div class="lh-ex">${esc(w.example)}</div>` : ''}</div>
                    </div>`).join('')}</div></div>` : '<div class="lh-note">Bu darsda so\'zlar kiritilmagan.</div>';
            panel.querySelector('[data-present-src="words"]')?.addEventListener('click', () => present(data, { prefer: 'words' }));
        } else if (t === 'dialogs') {
            const blocks = L.audioDialogs.map(d => `
                <div class="lh-card"><div class="lh-card-h"><b>🎧 ${esc(d.title)}</b>${d.bookPart ? `<span class="lh-muted">Kitob ${d.bookPart}-qism${d.trackNo ? `, ${d.trackNo}-trek` : ''}</span>` : ''}</div>
                ${safeUrl(d.audioUrl) ? `<audio controls preload="none" src="${esc(safeUrl(d.audioUrl))}"></audio>` : ''}
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

    const isShort = d => d <= 20;
    function planBlocks(plan, duration) {
        if (plan.mode !== 'live') return plan.blocks;
        return planMinutes(isShort(duration) && plan.shortBlocks ? plan.shortBlocks : plan.blocks, duration);
    }
    const blockList = items => (items.length ? `<ul class="${items.some(i => String(i).length > 40) ? 'is-long' : ''}">${items.map(i => `<li>${esc(plain(i))}</li>`).join('')}</ul>` : '');

    function renderPlan(panel, data) {
        const L = data.lesson, plan = L.plan;
        const duration = S.duration || 60;
        const blocks = planBlocks(plan, duration);
        const durations = [...new Set([15, 20, 30, 45, 60, 80, 90, S.hub[S.lang]?.defaultDuration, duration].filter(Boolean))].sort((a, b) => a - b);
        let checks = {};
        try { checks = JSON.parse(localStorage.getItem(checklistKey(L)) || '{}'); } catch { /* */ }
        const missing = data.classStats.prevHomeworkMissing || [];
        const files = [...lessonMaterials(data, 'lesson_plan'), ...lessonMaterials(data, 'teacher_guide')];
        panel.innerHTML = `
        ${plan.mode === 'live' && missing.length ? `<div class="lh-alert" role="status"><b>Darsdan oldin:</b> shu darsga kelayotgan, lekin oldingi darsni ${RULES.UNLOCK_PERCENT}% dan kam bajarganlar (${missing.length}): ${missing.map(s => esc(s.name)).join(', ')}</div>` : ''}
        <div class="lh-card">
            <div class="lh-card-h"><b>${plan.mode === 'live' ? 'Jonli dars rejasi' : "Videodars — ustoz uchun yo'riqnoma"}</b>
                ${plan.mode === 'live' ? `<label class="lh-dur">Dars davomiyligi <select>${durations.map(d => `<option value="${d}"${d === duration ? ' selected' : ''}>${d} daqiqa</option>`).join('')}</select></label>` : ''}
            </div>
            <p class="lh-muted lh-summary">${esc(plan.summary)}${plan.mode === 'live' && isShort(duration) ? " · Qisqa (individual) dars shabloni." : ''}</p>
            <ol class="lh-timeline">${blocks.map(b => `
                <li class="lh-block">
                    <div class="lh-block-time">${plan.mode === 'live' ? `<b>${b.minutes} daq</b><span>${mmss(b.from)}–${mmss(b.to)}</span>` : `<b class="lh-when">${esc(b.when || '')}</b>`}</div>
                    <div class="lh-block-body">
                        <div class="lh-block-title">${esc(b.title)}</div>
                        ${blockList(b.items)}
                        ${b.tip ? `<div class="lh-tip">💡 ${esc(b.tip)}</div>` : ''}
                    </div>
                </li>`).join('')}</ol>
        </div>
        ${plan.anticipated?.length ? `<div class="lh-two-cards">
            <div class="lh-card"><div class="lh-card-h"><b>Kutiladigan qiyinchiliklar</b></div><ul class="lh-rules">${plan.anticipated.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
            <div class="lh-card"><div class="lh-card-h"><b>Turli darajadagi o'quvchilar</b></div><ul class="lh-rules">${(plan.differentiation || []).map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
        </div>` : ''}
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
        const duration = S.duration || 60;
        const blocks = planBlocks(plan, duration);
        const w = window.open('', '_blank');
        if (!w) return toast("Brauzer yangi oynani bloklab qo'ydi");
        w.document.write(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>${L.no}-dars rejasi</title>
            <style>body{font:14px/1.5 system-ui,sans-serif;margin:32px;color:#111}h1{font-size:20px;margin:0 0 4px}.m{color:#555}
            table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ccc;padding:8px;vertical-align:top;text-align:left}
            th{background:#f3f3f7;width:120px}ul{margin:4px 0 0 18px;padding:0}.tip{color:#555;font-size:12px;margin-top:4px}
            .words{columns:3;margin-top:8px}</style></head><body>
            <h1>${L.no}-dars · ${esc(plain(L.name))}</h1>
            <div class="m">${L.type === 'live' ? `Jonli dars · ${duration} daqiqa` : 'Videodars'} · ${esc(LANG_LABEL[S.lang])}</div>
            ${L.cando ? `<p><b>Maqsad:</b> ${esc(L.cando)}</p>` : ''}
            <table>${blocks.map(b => `<tr><th>${L.type === 'live' ? `${mmss(b.from)}–${mmss(b.to)}<br>${b.minutes} daq` : esc(b.when || '')}</th><td><b>${esc(b.title)}</b>
                ${b.items.length ? `<ul>${b.items.map(i => `<li>${esc(plain(i))}</li>`).join('')}</ul>` : ''}${b.tip ? `<div class="tip">${esc(b.tip)}</div>` : ''}</td></tr>`).join('')}</table>
            ${plan.anticipated?.length ? `<h3>Kutiladigan qiyinchiliklar</h3><ul>${plan.anticipated.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
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
        <div class="lh-muted lh-foot">Qism ${RULES.PASS_PERCENT}% dan yuqori bajarilganda o'tgan hisoblanadi. O'quvchilar natijasi — "O'quvchilar" yorlig'ida.</div>`;
    }

    // ── Shu dars bo'yicha o'quvchilar ───────────────────────────────────────
    const groupSelect = groups => (groups.length ? `<select class="lh-input lh-small" data-group aria-label="Guruh">
        <option value="">Barcha guruhlar</option>${groups.map(g => `<option value="${esc(g)}"${S.group === g ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select>` : '');
    const yesNo = (v, label) => (v ? `<span class="lh-yes" aria-label="${esc(label)}: bajarilgan" title="Bajarilgan">✓</span>` : `<span class="lh-no" aria-label="${esc(label)}: bajarilmagan" title="Bajarilmagan">—</span>`);

    function renderClass(panel, data) {
        const all = data.classStats.students;
        const no = data.lesson.no;
        if (!all.length) {
            panel.innerHTML = `<div class="lh-note">${S.hub[S.lang]?.role === 'teacher' ? "Sizga hali o'quvchi biriktirilmagan." : "Bu yo'nalishda o'quvchi yo'q."}</div>`;
            return;
        }
        const groups = [...new Set(all.map(r => r.group).filter(Boolean))].sort();
        const rows = all.filter(r => (!S.group || r.group === S.group) && (!S.nearOnly || (r.reached >= no - 2 && r.reached <= no + 2)));
        panel.innerHTML = `<div class="lh-card lh-table-wrap">
            <div class="lh-card-h"><b>${no}-dars bo'yicha holat</b><span class="lh-gap"></span>${groupSelect(groups)}
                <label class="lh-toggle"><input type="checkbox" data-near${S.nearOnly ? ' checked' : ''}> Faqat shu darsga yaqinlar (${no - 2 > 0 ? no - 2 : 0}–${Math.min(72, no + 2)})</label></div>
            ${rows.length ? `<table class="lh-table">
            <thead><tr><th>O'quvchi</th><th>Hozirgi dars</th><th>Bajarilgan</th><th>${data.lesson.type === 'live' ? 'Slaydlar' : 'Video'}</th><th>So'zlar</th><th>Uy vazifasi</th><th>1-urinish / eng yaxshi</th><th>Xatolar</th><th>Faol vaqt</th></tr></thead>
            <tbody>${rows.map(r => `<tr data-student="${esc(r.id)}" tabindex="0">
                <td><b>${esc(r.name)}</b>${r.group ? `<div class="lh-muted">${esc(r.group)}</div>` : ''}${r.frozen ? '<span class="lh-flag frozen">Muzlatilgan</span>' : ''}</td>
                <td>${r.reached || '—'}</td>
                <td>${bar(r.percent)}</td>
                <td>${yesNo(r.watch, data.lesson.type === 'live' ? 'Slaydlar' : 'Video')}</td><td>${yesNo(r.vocab, "So'zlar")}</td>
                <td>${r.homeworkTotal ? `${r.homeworkDone}/${r.homeworkTotal}` : '—'}</td>
                <td>${r.bestPercent === null ? '—' : `${pct(r.firstPercent)} / ${pct(r.bestPercent)}`}</td>
                <td>${r.mistakes || '—'}</td><td>${dur(r.seconds)}</td></tr>`).join('')}</tbody></table>`
            : `<div class="lh-empty-sm">Tanlangan filtr bo'yicha o'quvchi yo'q. ${S.nearOnly ? "«Faqat shu darsga yaqinlar»ni o'chirib ko'ring." : ''}</div>`}</div>
            <div class="lh-muted lh-foot">Qatorni bosing — o'quvchining to'liq kartasi ochiladi. Faol vaqt — ilova ochiq va o'quvchi ishlayotgan vaqt.</div>`;
        panel.querySelector('[data-group]')?.addEventListener('change', e => { S.group = e.target.value; savePrefs(); renderClass(panel, data); });
        panel.querySelector('[data-near]').addEventListener('change', e => { S.nearOnly = e.target.checked; savePrefs(); renderClass(panel, data); });
        panel.querySelectorAll('[data-student]').forEach(tr => {
            const open = () => { S.view = 'students'; S.openStudent = tr.dataset.student; savePrefs(); render(); };
            tr.addEventListener('click', open);
            tr.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
        });
    }

    const bar = p => `<span class="lh-bar" title="${p}%"><i style="width:${Math.max(0, Math.min(100, p))}%" class="${p >= 100 ? 'ok' : p >= 50 ? 'mid' : 'low'}"></i></span><span class="lh-pct">${p}%</span>`;
    const pct = p => (p === null || p === undefined ? '—' : `<span class="lh-score ${p >= 85 ? 'ok' : p >= RULES.PASS_PERCENT ? 'mid' : 'low'}">${p}%</span>`);
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
    // pdf.js faqat o'z serverimizdagi faylni ocha oladi (tashqi saytlar CORS bilan to'sadi).
    const canPresent = m => isPdf(m) && isLocalFile(m.url);
    function fileRow(m) {
        const canEdit = S.hub[S.lang]?.canEdit;
        const size = m.fileSize ? ` · ${(m.fileSize / 1048576).toFixed(1)} MB` : '';
        const range = m.kind === 'book' ? ` · ${m.meta.lessonFrom || 1}–${m.meta.lessonTo || 72}-darslar` : '';
        return `<div class="lh-file">
            <span class="lh-file-ic" aria-hidden="true">${KIND_ICON[m.kind] || '📄'}</span>
            <span class="lh-file-body"><b>${esc(m.title)}</b><span class="lh-muted">${esc(m.fileName || m.url)}${size}${range}${m.note ? ` · ${esc(m.note)}` : ''}</span></span>
            ${canPresent(m) ? `<button type="button" class="lh-btn" data-present-file="${esc(m.id)}">▶ Ko'rsatish</button>` : ''}
            ${safeUrl(m.url) ? `<a class="lh-btn" href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener">Ochish</a>` : ''}
            ${canEdit ? `<button type="button" class="lh-btn" data-edit="${esc(m.id)}" aria-label="Tahrirlash: ${esc(m.title)}">✎</button>
                <button type="button" class="lh-btn lh-danger" data-del="${esc(m.id)}" aria-label="O'chirish: ${esc(m.title)}">🗑</button>` : ''}
        </div>`;
    }

    function allMaterials(data) {
        return [...(data?.materials || []), ...(S.hub[S.lang]?.courseMaterials || [])];
    }

    function bindMaterialActions(panel, data) {
        panel.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () =>
            openMaterialForm({ kind: b.dataset.add, mode: b.dataset.mode, lessonNo: data?.lesson?.no ?? null })));
        panel.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteMaterial(b.dataset.del)));
        panel.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
            const m = allMaterials(data).find(x => x.id === b.dataset.edit);
            if (m) openMaterialForm({ kind: m.kind, mode: 'edit', lessonNo: m.lessonNo, existing: m });
        }));
        panel.querySelectorAll('[data-present-file]').forEach(b => b.addEventListener('click', () => {
            const m = allMaterials(data).find(x => x.id === b.dataset.presentFile);
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

    // Modal: Esc yopadi, Tab fokus ichida aylanadi, yopilganda fokus qaytadi.
    function trapModal(wrap, onClose, { keep = false } = {}) {
        const back = document.activeElement;
        const close = () => { document.removeEventListener('keydown', onKey, true); if (!keep) wrap.remove(); onClose?.(); back?.focus?.(); };
        const onKey = e => {
            if (e.key === 'Escape') { e.preventDefault(); close(); return; }
            if (e.key !== 'Tab') return;
            const f = [...wrap.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey, true);
        return close;
    }

    const LARGE_KINDS = new Set(['book', 'teacher_book', 'methodology']);
    function openMaterialForm({ kind, mode, lessonNo, existing }) {
        const hub = S.hub[S.lang];
        const label = hub.kinds.lesson[kind] || hub.kinds.course[kind] || kind;
        const isBook = kind === 'book';
        const large = LARGE_KINDS.has(kind);
        const editing = mode === 'edit';
        const pm = existing?.meta?.pageMap ? Object.entries(existing.meta.pageMap).map(([k, v]) => `${k}:${v}`).join(', ') : '';
        const wrap = document.createElement('div');
        wrap.className = 'lh-modal';
        wrap.innerHTML = `<form class="lh-dialog" role="dialog" aria-modal="true" aria-labelledby="lhDlgTitle">
            <h3 id="lhDlgTitle">${editing ? 'Tahrirlash: ' : ''}${esc(label)}${lessonNo ? ` · ${lessonNo}-dars` : ''}</h3>
            <label>Nomi<input name="title" required maxlength="200" class="lh-input" value="${esc(existing?.title || '')}" placeholder="${isBook ? 'Masalan: Darslik 1-qism (1–24-darslar)' : 'Masalan: 12-dars slaydlari'}"></label>
            ${mode === 'file' ? `<label>Fayl (${large ? 'PDF, 300 MB gacha' : 'PDF tavsiya etiladi — prezentatsiyada ochiladi; 50 MB gacha'})<input name="file" type="file" required accept="${large ? '.pdf' : '.pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.webp,.mp4,.mp3'}"></label>`
                : mode === 'link' ? `<label>Havola (https://…)<input name="url" type="url" required class="lh-input" placeholder="https://"><span class="lh-muted">Havola yangi oynada ochiladi. Prezentatsiyada ko'rsatish uchun PDF faylni yuklang.</span></label>` : ''}
            ${isBook ? `<div class="lh-row"><label>Qaysi darsdan<input name="lessonFrom" type="number" min="1" max="72" class="lh-input" value="${existing?.meta?.lessonFrom || 1}"></label>
                <label>Qaysi darsgacha<input name="lessonTo" type="number" min="1" max="72" class="lh-input" value="${existing?.meta?.lessonTo || 24}"></label></div>
                <label>Darslar boshlanadigan sahifalar <span class="lh-muted">(ixtiyoriy: "1:5, 2:9, 3:14")</span><textarea name="pageMap" rows="3" class="lh-input" placeholder="1:5, 2:9, 3:14">${esc(pm)}</textarea></label>` : ''}
            <label>Izoh <span class="lh-muted">(ixtiyoriy)</span><input name="note" maxlength="300" class="lh-input" value="${esc(existing?.note || '')}"></label>
            <div class="lh-dialog-actions"><button type="button" class="lh-btn" data-cancel>Bekor qilish</button><button type="submit" class="lh-btn lh-primary">Saqlash</button></div>
            <div class="lh-progress" role="status" hidden>Yuklanmoqda…</div>
        </form>`;
        document.body.appendChild(wrap);
        const form = wrap.querySelector('form');
        const closeForm = trapModal(wrap);
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
                const body = { language: S.lang, lessonNo, kind, title: String(fd.get('title') || '').trim(), note: String(fd.get('note') || '') };
                if (isBook) body.meta = { lessonFrom: fd.get('lessonFrom'), lessonTo: fd.get('lessonTo'), pageMap: String(fd.get('pageMap') || '') };
                if (mode === 'link') body.url = String(fd.get('url') || '').trim();
                if (mode === 'file') {
                    const file = fd.get('file');
                    if (!file || !file.size) throw new Error('Fayl tanlang');
                    const limit = large ? 300 : 50;
                    if (file.size > limit * 1048576) throw new Error(`Fayl ${limit} MB dan katta`);
                    const up = large ? await uploadLargePdf(file) : await apiUploadFile(file);
                    Object.assign(body, { url: up.url, fileName: up.fileName || file.name, fileSize: up.fileSize || file.size, mime: up.mimeType || file.type });
                }
                if (editing) await api(`/api/academic/materials/${encodeURIComponent(existing.id)}`, { method: 'PUT', body: JSON.stringify(body) });
                else await api('/api/academic/materials', { method: 'POST', body: JSON.stringify(body) });
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

    async function uploadLargePdf(file) {
        const fd = new FormData();
        fd.append('file', file);
        const token = typeof getToken === 'function' ? getToken() : null;
        const res = await fetch('/api/upload/large-pdf', { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Yuklash xatoligi');
        return data;
    }

    // ── Prezentatsiya manbalari ─────────────────────────────────────────────
    function present(data, opts = {}) {
        const L = data.lesson;
        const pdf = m => ({ type: 'pdf', url: m.url, title: `${m.kindLabel}: ${m.title}`, id: m.id });
        const sources = [];
        const live = lessonMaterials(data, 'live_slides').filter(canPresent).map(pdf);
        const vids = lessonMaterials(data, 'video_slides').filter(canPresent).map(pdf);
        const gram = lessonMaterials(data, 'grammar_slides').filter(canPresent).map(pdf);
        const imgs = L.slides.filter(s => safeUrl(s.imageUrl));
        const appSlides = imgs.length
            ? { type: 'images', title: `Ilovadagi slaydlar (${imgs.length})`, key: 'app-slides', items: imgs.map(s => ({ url: safeUrl(s.imageUrl), caption: s.title })) } : null;
        const words = L.vocabulary.length ? { type: 'words', title: `So'z kartochkalari (${L.vocabulary.length})`, key: 'words', items: L.vocabulary.map(w => ({ ...w, imageUrl: safeUrl(w.imageUrl) })) } : null;
        const video = safeUrl(L.videoUrl) ? { type: 'video', url: safeUrl(L.videoUrl), title: 'Videodars' } : null;
        if (L.type === 'live') sources.push(...live, words, ...gram, ...vids, appSlides, video);
        else sources.push(...vids, appSlides, video, words, ...gram, ...live);
        if (data.book && isLocalFile(data.book.url)) sources.push({ type: 'pdf', url: data.book.url, title: `Kitob: ${data.book.title}`, key: 'book' });
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
        if (!data || !fresh('students:' + S.lang)) {
            try { data = S.students[S.lang] = await api(`/api/academic/students?lang=${S.lang}`); stamp('students:' + S.lang); }
            catch (e) { main.innerHTML = `<div class="lh-error"><b>Yuklab bo'lmadi</b><span>${esc(e.message)}</span></div>`; return; }
        }
        if (S.view !== 'students') return;
        const groups = [...new Set(data.students.map(s => s.group).filter(Boolean))].sort();
        if (S.group && !groups.includes(S.group)) S.group = '';
        const scoped = data.students.filter(s => !S.group || s.group === S.group);
        const active = scoped.filter(s => !s.frozen);
        const list = sortStudents(scoped);
        const count = key => active.filter(s => s.flags.some(f => f.key === key)).length;
        const weekTotal = active.reduce((a, s) => a + s.time.week, 0);
        const avgReached = active.length ? Math.round(active.reduce((a, s) => a + s.reached, 0) / active.length) : 0;
        main.innerHTML = `
        <div class="lh-kpis">
            <div class="lh-kpi"><span>O'quvchilar</span><b>${active.length}</b>${scoped.length > active.length ? `<small>+${scoped.length - active.length} muzlatilgan</small>` : ''}</div>
            <div class="lh-kpi"><span>O'rtacha joriy dars</span><b>${avgReached || '—'}</b><small>72 dan</small></div>
            <div class="lh-kpi"><span>7 kunda faol vaqt</span><b>${dur(weekTotal)}</b><small>hammasi bo'lib</small></div>
            <div class="lh-kpi ${count('idle') ? 'is-warn' : ''}"><span>Faol emas (3+ kun)</span><b>${count('idle')}</b></div>
            <div class="lh-kpi ${count('struggling') ? 'is-warn' : ''}"><span>Uy vazifasida qiynalyapti</span><b>${count('struggling')}</b></div>
            <div class="lh-kpi ${count('behind') ? 'is-warn' : ''}"><span>Rejadan orqada</span><b>${count('behind')}</b></div>
        </div>
        <div class="lh-note">Faol vaqt — ilova ochiq va o'quvchi ishlayotgan vaqt (2 daqiqa harakatsizlikdan keyin to'xtaydi; video va audio ko'rishda — 25 daqiqa). Vaqt va xatolar yangi ilovadan ${data.trackingSince ? `${esc(fmtDate(data.trackingSince))} dan` : 'yangi versiya chiqqandan'} boshlab yig'iladi; dars bosqichlari — avvaldan. "Qiynalyapti" — uy vazifasini birinchi urinishda ${RULES.PASS_PERCENT}% dan past bajarsa yoki o'rtacha 2,5+ urinish qilsa. "Rejadan orqada" — haftasiga ${RULES.LESSONS_PER_WEEK || 6} dars hisobidan 1 haftadan ko'p orqada.</div>
        <div class="lh-card lh-table-wrap">
            <div class="lh-card-h"><b>O'quvchilar</b><span class="lh-gap"></span>
                ${groupSelect(groups)}
                <input type="search" class="lh-input lh-small" placeholder="Ism bo'yicha" aria-label="O'quvchini qidirish">
                <select class="lh-input lh-small" data-sort aria-label="Saralash">${[['attention', "Avval e'tibor kerak"], ['reached', "Dars bo'yicha"], ['time', 'Faol vaqt (7 kun)'], ['homework', 'Uy vazifasi natijasi'], ['name', 'Ism']].map(([k, l]) => `<option value="${k}"${S.studentSort === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
                <button type="button" class="lh-btn" data-csv>⬇ CSV</button>
            </div>
            ${list.length ? `<table class="lh-table"><thead><tr><th>O'quvchi</th><th>Joriy dars</th><th>O'rtacha bajarilish</th><th>Tugatgan</th><th>Uy vazifasi<br><span class="lh-muted">1-urinish / eng yaxshi</span></th><th>Xatolar</th><th>Faol vaqt<br><span class="lh-muted">7 kun / jami</span></th><th>Faol kunlar</th><th>Oxirgi faollik</th><th>Holat</th></tr></thead>
            <tbody>${list.map(s => `<tr data-student="${esc(s.id)}" tabindex="0">
                <td><b>${esc(s.name)}</b>${s.group ? `<div class="lh-muted">${esc(s.group)}</div>` : ''}${s.role === 'assistant' ? '<div class="lh-tag">yordamchi</div>' : ''}</td>
                <td><b>${s.reached || '—'}</b>${s.expected ? `<div class="lh-muted">reja: ${s.expected}</div>` : ''}</td>
                <td>${bar(s.avgPercent)}</td><td>${s.completed}/72</td>
                <td>${s.homeworkAvg === null ? '—' : `${pct(s.firstTryAvg)} / ${pct(s.homeworkAvg)}`}</td><td>${s.mistakes || '—'}</td>
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
        main.querySelector('[data-sort]').addEventListener('change', e => { S.studentSort = e.target.value; renderStudentsView(main); });
        main.querySelector('[data-group]')?.addEventListener('change', e => { S.group = e.target.value; savePrefs(); renderStudentsView(main); });
        main.querySelector('[data-csv]').addEventListener('click', () => exportCsv(list));
        tbody?.querySelectorAll('[data-student]').forEach(tr => {
            tr.addEventListener('click', () => openStudent(tr.dataset.student));
            tr.addEventListener('keydown', e => { if (e.key === 'Enter') openStudent(tr.dataset.student); });
        });
        if (S.openStudent) openStudent(S.openStudent);
    }

    function exportCsv(list) {
        const head = ["O'quvchi", 'Guruh', 'Joriy dars', 'Reja', "O'rtacha %", 'Tugatgan', '1-urinish %', 'Eng yaxshi %', 'Xatolar', 'Faol vaqt 7 kun (daq)', 'Faol vaqt jami (daq)', 'Faol kunlar (7)', 'Oxirgi faollik', 'Holat'];
        const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = list.map(s => [s.name, s.group, s.reached, s.expected ?? '', s.avgPercent, s.completed, s.firstTryAvg ?? '', s.homeworkAvg ?? '',
            s.mistakes, Math.round(s.time.week / 60), Math.round(s.time.total / 60), s.activeDays7, s.lastActive ? s.lastActive.slice(0, 10) : '', s.flags.map(f => f.label).join('; ')]);
        const csv = '﻿' + [head, ...rows].map(r => r.map(q).join(';')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `oquvchilar-progressi-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    function sortStudents(list) {
        const arr = [...list];
        const by = {
            attention: (a, b) => (a.frozen - b.frozen) || b.flags.length - a.flags.length || (b.daysIdle ?? 999) - (a.daysIdle ?? 999),
            reached: (a, b) => b.reached - a.reached,
            time: (a, b) => b.time.week - a.time.week,
            homework: (a, b) => (a.firstTryAvg ?? 101) - (b.firstTryAvg ?? 101),
            name: (a, b) => a.name.localeCompare(b.name),
        }[S.studentSort] || (() => 0);
        return arr.sort(by);
    }
    const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const fmtDate = d => { const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])}-${UZ_MONTHS[Number(m[2]) - 1]}` : String(d); };
    const mistakeLi = m => `<li>${esc(m.question)}${m.yourAnswer ? ` <span class="lh-bad" title="O'quvchi javobi">${esc(m.yourAnswer)}</span>` : ''}${m.correctAnswer ? ` <span class="lh-ans">→ ${esc(m.correctAnswer)}</span>` : ''}${m.count > 1 ? ` <span class="lh-tag">${m.count} marta</span>` : ''}</li>`;

    async function openStudent(id) {
        S.openStudent = id;
        const host = document.getElementById('lhStudent');
        if (!host) return;
        const back = document.activeElement;
        host.innerHTML = `<div class="lh-drawer-bg"></div><aside class="lh-drawer" role="dialog" aria-modal="true" aria-label="O'quvchi kartasi" tabindex="-1">${skeleton()}</aside>`;
        const drawer = host.querySelector('.lh-drawer');
        const closeD = trapModal(drawer, () => { S.openStudent = null; host.innerHTML = ''; back?.focus?.(); }, { keep: true });
        host.querySelector('.lh-drawer-bg').onclick = closeD;
        drawer.focus();
        let d = S.studentDetail[id];
        if (!d || !fresh('student:' + id)) {
            try { d = S.studentDetail[id] = await api(`/api/academic/students/${encodeURIComponent(id)}`); stamp('student:' + id); }
            catch (e) { drawer.innerHTML = `<div class="lh-error"><b>Yuklab bo'lmadi</b><span>${esc(e.message)}</span><button type="button" class="lh-btn" data-x>Yopish</button></div>`; drawer.querySelector('[data-x]').onclick = closeD; return; }
        }
        if (S.openStudent !== id) return;
        const s = d.student;
        const sel = { no: Math.max(1, s.reached || 1) };
        const att = d.attendance || { rows: [], present: 0, absent: 0 };
        drawer.innerHTML = `
            <div class="lh-drawer-h"><div><h3>${esc(s.name)}</h3><div class="lh-muted">${s.group ? esc(s.group) + ' · ' : ''}oxirgi faollik: ${esc(ago(s.lastActive))}${s.startDate ? ` · boshlagan: ${esc(fmtDate(s.startDate))}` : ''}</div></div>
                <button type="button" class="lh-btn" data-x aria-label="Yopish">✕</button></div>
            ${s.flags.length ? `<div class="lh-flags">${s.flags.map(f => `<span class="lh-flag ${f.key}">${esc(f.label)}</span>`).join('')}</div>` : ''}
            <div class="lh-kpis is-small">
                <div class="lh-kpi"><span>Joriy dars</span><b>${s.reached || '—'}</b>${s.expected ? `<small>reja: ${s.expected}</small>` : ''}</div>
                <div class="lh-kpi"><span>Tugatgan darslar</span><b>${s.completed}</b><small>72 dan</small></div>
                <div class="lh-kpi"><span>Uy vazifasi</span><b>${s.homeworkAvg === null ? '—' : s.homeworkAvg + '%'}</b><small>${s.firstTryAvg === null ? '' : `1-urinish ${s.firstTryAvg}% · ${s.avgAttempts} urinish`}</small></div>
                <div class="lh-kpi"><span>Faol vaqt</span><b>${dur(s.time.total)}</b><small>bugun ${dur(s.time.today)} · 7 kun ${dur(s.time.week)}</small></div>
                <div class="lh-kpi"><span>Davomat</span><b>${att.present}/${att.present + att.absent}</b><small>jonli darslar</small></div>
            </div>
            <div class="lh-card"><div class="lh-card-h"><b>72 dars xaritasi</b><span class="lh-muted">katakni bosing</span></div>
                <div class="lh-heat">${d.lessons.map(l => `<button type="button" class="lh-cell ${heatClass(l)}${l.grades.length ? ' has-grade' : ''}" data-cell="${l.no}" aria-label="${l.no}-dars: ${l.percent}%${l.grades.length ? ', jonli darsda baholangan' : ''}">${l.no}</button>`).join('')}</div>
                <div class="lh-legend"><span class="lh-cell c0"></span>boshlanmagan <span class="lh-cell c1"></span>1–49% <span class="lh-cell c2"></span>50–99% <span class="lh-cell c3"></span>100% <span class="lh-cell c0 has-grade"></span>jonli darsda baho bor</div>
            </div>
            <div class="lh-card" id="lhCellDetail" aria-live="polite"></div>
            <div class="lh-card"><div class="lh-card-h"><b>Faol vaqt — oxirgi 30 kun</b></div>${timeChart(d.timeByDay)}
                ${Object.keys(d.timeBySection).length ? `<div class="lh-muted">Bo'limlar bo'yicha (oxirgi ${d.sectionPeriodDays || 60} kun):</div><div class="lh-sections">${Object.entries(d.timeBySection).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span><b>${esc(SECTION_LABEL[k] || k)}</b> ${dur(v)}</span>`).join('')}</div>` : ''}
            </div>
            <div class="lh-two-cards">
                <div class="lh-card"><div class="lh-card-h"><b>Jonli dars davomati</b></div>
                    ${att.rows.length ? `<ul class="lh-att">${att.rows.slice(0, 20).map(a => `<li><span>${esc(fmtDate(a.date))}</span>${a.present ? '<span class="lh-flag ok">keldi</span>' : '<span class="lh-flag struggling">kelmadi</span>'}${a.kind === 'assistant' ? '<span class="lh-tag">yordamchi</span>' : ''}</li>`).join('')}</ul>` : '<div class="lh-muted">Davomat hali belgilanmagan</div>'}</div>
                <div class="lh-card"><div class="lh-card-h"><b>Jonli dars baholari</b></div>
                    ${d.grades?.length ? `<ul class="lh-att">${d.grades.slice(0, 15).map(g => `<li><span>${esc(fmtDate(g.date))}${g.lessonNo ? ` · ${g.lessonNo}-dars` : ''}</span>${g.average !== null ? `<b>${g.average}</b>` : ''}${g.comment ? `<span class="lh-muted">${esc(g.comment)}</span>` : ''}</li>`).join('')}</ul>` : '<div class="lh-muted">Baho qo\'yilmagan</div>'}</div>
            </div>
            ${d.exams?.length ? `<div class="lh-card"><div class="lh-card-h"><b>Imtihonlar</b></div>
                <ul class="lh-activity">${d.exams.map(a => `<li><span>${esc(a.label)}</span>${typeof a.scorePercent === 'number' ? pct(a.scorePercent) : ''}${a.passed === true ? '<span class="lh-flag ok">o\'tdi</span>' : a.passed === false ? '<span class="lh-flag struggling">o\'tmadi</span>' : ''}<span class="lh-muted">${esc(ago(a.time))}</span>
                    ${(a.mistakes || []).length ? `<details><summary>${a.mistakes.length} ta xato</summary><ol class="lh-qa">${a.mistakes.map(mistakeLi).join('')}</ol></details>` : ''}</li>`).join('')}</ul></div>` : ''}
            ${d.activity.filter(a => a.type !== 'exam').length ? `<div class="lh-card"><div class="lh-card-h"><b>Faoliyat tarixi</b></div>
                <ul class="lh-activity">${d.activity.filter(a => a.type !== 'exam').slice(0, 20).map(a => `<li><span>${esc(a.label)}</span>${typeof a.scorePercent === 'number' ? pct(a.scorePercent) : ''}<span class="lh-muted">${esc(ago(a.time))}</span>
                    ${(a.mistakes || []).length ? `<details><summary>${a.mistakes.length} ta xato</summary><ol class="lh-qa">${a.mistakes.map(mistakeLi).join('')}</ol></details>` : ''}</li>`).join('')}</ul></div>` : ''}`;
        drawer.querySelector('[data-x]').onclick = closeD;
        const showCell = no => {
            sel.no = no;
            drawer.querySelectorAll('[data-cell]').forEach(c => { const on = Number(c.dataset.cell) === no; c.classList.toggle('is-sel', on); c.setAttribute('aria-pressed', on); });
            const l = d.lessons.find(x => x.no === no);
            const box = drawer.querySelector('#lhCellDetail');
            if (!l) { box.innerHTML = '<div class="lh-muted">Bu dars kursda yo\'q</div>'; return; }
            box.innerHTML = `<div class="lh-card-h"><b>${l.no}-dars · ${esc(plain(l.name))}</b><span class="lh-type ${l.type}">${l.type === 'live' ? 'Jonli' : 'Video'}</span><span class="lh-gap"></span>${bar(l.percent)}</div>
                <div class="lh-steps">
                    <span class="${l.steps.watch ? 'ok' : ''}">${l.steps.watch ? '✓' : '○'} ${l.type === 'live' ? 'Slaydlar' : 'Video'}</span>
                    <span class="${l.steps.vocabList ? 'ok' : ''}">${l.steps.vocabList ? '✓' : '○'} So'zlar ro'yxati</span>
                    <span class="${l.steps.vocabPractice ? 'ok' : ''}">${l.steps.vocabPractice ? '✓' : '○'} So'z mashqi</span>
                    <span>Uy vazifasi ${l.steps.homeworkDone}/${l.steps.homeworkTotal}</span>
                    <span>Faol vaqt: ${dur(l.seconds)}</span>
                    ${l.grades.map(g => `<span>Jonli dars bahosi: <b>${g.average ?? '—'}</b></span>`).join('')}
                </div>
                ${l.results.length ? `<table class="lh-table is-compact"><thead><tr><th>Qism</th><th>Oxirgi</th><th>1-urinish</th><th>Eng yaxshi</th><th>Urinish</th><th>Xatolar</th></tr></thead><tbody>
                    ${l.results.map(r => `<tr><td>${esc(r.title || HW_KIND[r.kind] || r.kind)}</td><td>${r.correct}/${r.total}</td><td>${pct(r.firstPercent)}</td><td>${pct(r.bestPercent)}</td><td>${r.attempts}</td>
                    <td>${r.mistakes.length ? `<details><summary>${r.mistakes.length} ta</summary><ol class="lh-qa">${r.mistakes.map(mistakeLi).join('')}</ol></details>` : '—'}</td></tr>`).join('')}</tbody></table>`
                    : `<div class="lh-muted">${l.started ? "Uy vazifasi natijalari yangi ilovadan yig'iladi." : 'Bu dars hali boshlanmagan.'}</div>`}`;
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
                    ${hub.canEdit ? `<button type="button" class="lh-btn" data-edit="${esc(b.id)}" aria-label="Tahrirlash: ${esc(b.title)}">✎</button><button type="button" class="lh-btn lh-danger" data-del="${esc(b.id)}" aria-label="O'chirish: ${esc(b.title)}">🗑</button>` : ''}
                </div>`).join('') : `<div class="lh-muted">Kitob PDF hali yuklanmagan.${hub.canEdit ? " «＋ Kitob» orqali 1, 2, 3-qismlarni yuklang va har biri qaysi darslarni qamrashini belgilang." : ''}</div>`}
                ${current ? `<label class="lh-jump">Darsga o'tish <select aria-label="Darsga o'tish"><option value="">—</option>${hub.syllabus.filter(l => l.no >= (current.meta.lessonFrom || 1) && l.no <= (current.meta.lessonTo || 72)).map(l => `<option value="${l.no}"${current.meta.pageMap?.[l.no] ? '' : ' disabled'}>${l.no}-dars${current.meta.pageMap?.[l.no] ? ` · ${current.meta.pageMap[l.no]}-bet` : ''}</option>`).join('')}</select></label>
                    ${isLocalFile(current.url) ? '<button type="button" class="lh-btn lh-primary" data-book-present>▶ Prezentatsiyada ochish</button>' : ''}
                    ${hub.canEdit && !Object.keys(current.meta.pageMap || {}).length ? '<div class="lh-muted">Darslar sahifasini belgilash uchun ✎ tugmasini bosing ("1:5, 2:9").</div>' : ''}` : ''}
            </aside>
            <section class="lh-card lh-book-view" id="lhBookView">${current ? '' : '<div class="lh-empty-sm">Kitob tanlanmagan</div>'}</section>
        </div>`;
        bindMaterialActions(main, null);
        main.querySelectorAll('[data-book]').forEach(b => b.addEventListener('click', () => { S.bookState[S.lang] = { id: b.dataset.book, page: 1 }; renderBookView(main); }));
        if (!current) return;
        if (!isLocalFile(current.url)) {
            main.querySelector('#lhBookView').innerHTML = `<div class="lh-empty-sm">Bu kitob tashqi havola — saytda ochib bo'lmaydi. ${safeUrl(current.url) ? `<a class="lh-btn" href="${esc(safeUrl(current.url))}" target="_blank" rel="noopener">Yangi oynada ochish</a>` : ''}</div>`;
            return;
        }
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
        main.querySelector('[data-book-present]')?.addEventListener('click', () => LessonPresenter.open({
            title: current.title, sources: [{ type: 'pdf', url: current.url, title: current.title }],
            startPage: S.bookState[S.lang]?.page || 1,
        }));
    }

    // ── Teacher's book ──────────────────────────────────────────────────────
    function renderGuideView(main) {
        const hub = S.hub[S.lang];
        const R = { ...RULES, ...(hub.rules ? { PASS_PERCENT: hub.rules.passPercent, UNLOCK_PERCENT: hub.rules.unlockPercent, LIVE_AUTO_UNLOCK: hub.rules.liveAutoUnlock, EXAM_INTERVAL: hub.rules.examInterval, EXAM_PASS_PERCENT: hub.rules.examPassPercent } : {}) };
        const files = hub.courseMaterials.filter(m => m.kind === 'teacher_book' || m.kind === 'methodology');
        const fake = { materials: files, lesson: null };
        const oral = hub.oralExams;
        const oralKeys = oral ? Object.keys(oral).filter(k => /^interval-\d+$|^final$/.test(k)) : [];
        main.innerHTML = `
        <div class="lh-guide">
            <div class="lh-two-cards">
                <div class="lh-card"><div class="lh-card-h"><b>Kurs tuzilmasi va qoidalar</b></div>
                    <ul class="lh-rules">
                        <li><b>72 dars · 3 oy</b> — har oy 24 dars. Toq raqamli darslar <span class="lh-type video">Video</span> (o'quvchi ilovada mustaqil), juft raqamlilar <span class="lh-type live">Jonli</span> (ustoz bilan).</li>
                        <li><b>Dars ochilishi:</b> videodars oldingi dars ${R.UNLOCK_PERCENT}% bajarilganda ochiladi. Jonli dars — ustoz davomatni belgilaganda (oldingi dars ${R.UNLOCK_PERCENT}%) yoki oldingi dars ${R.LIVE_AUTO_UNLOCK}% bajarilganda. Admin ayrim darsga boshqa chegara qo'yishi mumkin.</li>
                        <li><b>Dars bajarilishi</b> = (video yoki slaydlar + so'zlar + uy vazifasi) ÷ 3. Uy vazifasi bo'lmagan dars 100% ga yetmaydi — bu ilovada ham shunday.</li>
                        <li><b>Uy vazifasi:</b> har qism ${R.PASS_PERCENT}% dan yuqori bo'lsa o'tadi. Ijodiy vazifani ustoz baholaydi, qolganlari avtomatik tekshiriladi.</li>
                        <li><b>Imtihonlar:</b> har ${R.EXAM_INTERVAL} darsdan keyin oraliq imtihon va kurs oxirida yakuniy imtihon (o'tish — ${R.EXAM_PASS_PERCENT}%).</li>
                        <li><b>Davomat</b> darsdan keyin darhol belgilanadi — u jonli darsni ilovada ochadi va oylik hisobiga kiradi.</li>
                    </ul></div>
                <div class="lh-card"><div class="lh-card-h"><b>Jonli darsni qanday o'tkazamiz</b></div>
                    <ol class="lh-rules">
                        <li>Darsdan oldin: <b>Dars rejasi</b>ni oching, "Darsdan oldin" ro'yxatiga va eng ko'p xato qilingan savollarga qarang.</li>
                        <li><b>▶ Darsni boshlash</b> — slaydlar, so'z kartochkalari, kitob va bo'sh doska bitta oynada. Klavishlar: ←/→ slayd, P qalam, M marker, E o'chirg'ich, L lazer, B yangi doska, T tarjima, F to'liq ekran.</li>
                        <li>Qoidani o'zingiz aytmang — misollardan o'quvchi topsin; keyin 2 ta tekshiruv savoli (CCQ).</li>
                        <li>O'quvchi kamida 70% vaqt gapirsin. Xatolarni yozib boring va dars oxirida birga tuzating.</li>
                        <li>Darsdan keyin: davomat, ijodiy vazifalarni baholash, faol bo'lmaganlarga xabar.</li>
                        <li>Haftada bir marta: <b>O'quvchilar progressi</b>dagi "e'tibor kerak" ro'yxati.</li>
                    </ol></div>
            </div>
            ${materialSection(fake, 'teacher_book', "Teacher's book (to'liq qo'llanma)", "Kurs bo'yicha ustoz kitobi — PDF (300 MB gacha).", files.filter(f => f.kind === 'teacher_book'))}
            ${materialSection(fake, 'methodology', 'Metodika va standartlar', 'Baholash mezonlari, dars kuzatuv varaqasi va boshqa hujjatlar.', files.filter(f => f.kind === 'methodology'))}
            ${oralKeys.length ? `<div class="lh-card"><div class="lh-card-h"><b>Og'zaki imtihonlar (ustoz uchun)</b><span class="lh-muted">ilova testi bilan birga o'tkaziladi</span></div>
                ${oral.grading_uz ? `<div class="lh-note lh-pre">${esc(oral.grading_uz)}</div>` : ''}
                ${oralKeys.map(k => oralExamHtml(k, oral[k])).join('')}
                ${oral.rubric?.criteria?.length ? `<details class="lh-hw"><summary><b>Baholash mezonlari (rubrika)</b><span class="lh-muted">${esc(oral.rubric.scale || '')}</span></summary>
                    <div class="lh-table-wrap"><table class="lh-table is-compact"><thead><tr><th>Mezon</th>${[5, 4, 3, 2, 1, 0].map(n => `<th>${n}</th>`).join('')}</tr></thead>
                    <tbody>${oral.rubric.criteria.map(c => `<tr><td><b>${esc(c.name_uz || c.id)}</b></td>${[5, 4, 3, 2, 1, 0].map(n => `<td class="lh-muted">${esc(c.levels?.[n] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>` : ''}
            </div>` : ''}
            <div class="lh-card lh-table-wrap"><div class="lh-card-h"><b>72 darslik reja</b><span class="lh-gap"></span><button type="button" class="lh-btn" data-print-syllabus>🖨 Chop etish</button></div>
                <table class="lh-table is-compact"><thead><tr><th>№</th><th>Turi</th><th>Dars</th><th>Maqsad</th><th>So'z</th><th>Vazifa</th></tr></thead>
                <tbody>${hub.syllabus.map(l => `<tr data-open-lesson="${l.no}" tabindex="0"><td>${l.no}</td><td><span class="lh-type ${l.type}">${l.type === 'live' ? 'Jonli' : 'Video'}</span></td>
                    <td><b>${esc(plain(l.name))}</b>${l.topic ? `<div class="lh-muted">${esc(plain(l.topic))}</div>` : ''}</td><td class="lh-muted">${esc(l.cando)}</td><td>${l.counts.vocab || '—'}</td><td>${l.counts.homework ? `${l.counts.homework} qism` : '—'}</td></tr>`).join('')}</tbody></table></div>
        </div>`;
        bindMaterialActions(main, fake);
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

    function oralExamHtml(key, x) {
        if (!x) return '';
        const title = key === 'final' ? 'Yakuniy imtihon' : `${key.split('-')[1]}-oraliq imtihon`;
        const list = (arr, cls = 'lh-rules') => (arr?.length ? `<ul class="${cls}">${arr.map(i => `<li>${esc(typeof i === 'string' ? i : (i.ru ? `${i.ru}${i.uz ? ` — ${i.uz}` : ''}` : i.q ? `${i.q}${i.a ? ` → ${i.a}` : ''}` : ''))}</li>`).join('')}</ul>` : '');
        const sp = (x.speaking || []).map(t => `<div class="lh-oral-task"><b>${esc(t.title_uz || t.type)}</b>${t.time_min ? ` <span class="lh-tag">${esc(t.time_min)} daq</span>` : ''}
            ${t.task_uz ? `<div>${esc(t.task_uz)}</div>` : ''}${t.situation_uz ? `<div>${esc(t.situation_uz)}</div>` : ''}
            ${t.teacher_card_uz ? `<div class="lh-muted"><b>Ustoz kartasi:</b> ${esc(t.teacher_card_uz)}</div>` : ''}
            ${t.student_must_uz ? `<div class="lh-muted"><b>O'quvchi bajarishi kerak:</b></div>${list(t.student_must_uz)}` : ''}
            ${t.plan_uz ? list(t.plan_uz) : ''}${t.teacher_lines_ru ? `<div class="lh-muted"><b>Ustoz replikalari:</b></div>${list(t.teacher_lines_ru)}` : ''}
            ${t.questions ? list(t.questions) : ''}${t.useful_ru ? `<div class="lh-muted">Foydali iboralar: ${esc(t.useful_ru.join(' · '))}</div>` : ''}</div>`).join('');
        const w = x.writing ? `<div class="lh-oral-task"><b>Yozish</b>${x.writing.time_min ? ` <span class="lh-tag">${esc(x.writing.time_min)} daq</span>` : ''}<div>${esc(x.writing.task_uz || '')}</div>${list(x.writing.plan_uz)}
            ${x.writing.model_ru ? `<div class="lh-muted"><b>Namuna:</b> ${esc(x.writing.model_ru)}</div>` : ''}</div>` : '';
        const l = (x.listening || []).map((t, i) => `<div class="lh-oral-task"><b>Tinglash ${i + 1}</b> <span class="lh-tag">${esc(t.dialog || '')} · ${t.plays || 2} marta</span>${list(t.questions)}</div>`).join('');
        return `<details class="lh-hw"><summary><b>${esc(title)}</b><span class="lh-muted">${esc(x.covers || '')}</span></summary><div class="lh-oral">${sp}${w}${l}</div></details>`;
    }

    // ── Eski "Qo'shimcha materiallar" (mobileContent.documents) ─────────────
    function renderExtraView(main) {
        main.innerHTML = '<div class="lh-legacy tp-textbook-legacy"></div>';
        if (typeof S.ctx.renderLegacy === 'function') S.ctx.renderLegacy(main.firstElementChild);
        else main.firstElementChild.innerHTML = '<div class="lh-muted">Mavjud emas</div>';
    }

    window.LessonHub = { mount, _state: S };
})();
