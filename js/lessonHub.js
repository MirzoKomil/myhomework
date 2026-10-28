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
    const RULES = window.AcademicRules || { allocateMinutes: null, PASS_PERCENT: 65, UNLOCK_PERCENT: 50, LIVE_AUTO_UNLOCK: 60, EXAM_INTERVAL: 12, EXAM_PASS_PERCENT: 70, LESSONS_PER_WEEK: 6, SECTIONS: {} };
    const CACHE_MS = 3 * 60000;
    // Faqat o'z serverimizdagi yoki https havolalar href/src'ga tushadi.
    const safeUrl = u => (/^(https:\/\/|\/(?!\/))/i.test(String(u || '').trim()) ? String(u).trim() : '');
    const isLocalFile = u => /^\/uploads\//.test(String(u || ''));

    // Ustoz/yordamchi: 72 dars · Kitoblar · Qo'shimcha materiallar (o'quvchilar
    // holati — "O'quvchini tekshirish" bo'limida va dars sahifasidagi progress
    // qatorida). Admin/boshliq/ROP: + O'quvchilar progressi.
    const VIEWS = [
        { id: 'lessons', label: '72 dars' },
        { id: 'students', label: "O'quvchilar progressi", staff: true },
        { id: 'books', label: 'Kitoblar' },
        { id: 'extra', label: "Qo'shimcha materiallar" },
    ];
    const OLD_VIEW = { book: 'books', guide: 'books' };
    const TABS = [
        { id: 'plan', label: 'Reja' },
        { id: 'slides', label: 'Slaydlar' },
        { id: 'video', label: 'Videodars' },
        { id: 'grammar', label: 'Grammatika' },
        { id: 'words', label: "So'zlar" },
        { id: 'dialogs', label: 'Audio' },
        { id: 'homework', label: 'Vazifa' },
    ];
    const OLD_TAB = { live: 'slides' };
    const ICO = {
        book: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/></svg>',
        tbook: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
        assist: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0114 0M19 8v6M16 11h6"/></svg>',
        print: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/></svg>',
        screen: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
        play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
        warn: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
        search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
        upload: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/></svg>',
        check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
        prev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
        next: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
        download: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>',
        plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    };
    // Ustoz kitobi orasida yordamchi qo'llanmasi (ommaviy yuklashda "YORDAMCHI" sarlavhali PDF).
    const isAssistGuide = m => /yordamchi|assistant/i.test(`${m.title} ${m.fileName || ''}`);
    const KIND_ICON = { live_slides: '🎥', video_slides: '▶️', grammar_slides: '📐', lesson_plan: '🗒', teacher_guide: '🧑‍🏫', extra: '📎', book: '📖', teacher_book: '📘', methodology: '🧭' };
    const HW_KIND = { matching: 'Moslashtirish', fillBlank: "Bo'sh joy", multipleChoice: 'Test', sentenceBuild: 'Gap tuzish', reading: "O'qish va tarjima", creative: 'Ijodiy', record: 'Ovoz yozish', roleplay: 'Rolli o\'yin' };
    const SECTION_LABEL = RULES.SECTIONS || {};

    const S = {
        el: null, ctx: null, lang: 'english', view: 'lessons', hub: {}, lessonCache: {}, selected: {},
        tab: 'plan', search: '', filter: 'all', students: {}, studentDetail: {}, openStudent: null,
        studentSort: 'attention', duration: null, bookState: {}, reader: null, group: '', nearOnly: true, loadedAt: {},
        bookKind: 'book', extraFilter: 'all', extraPage: 0, today: null,
    };
    const isStaffView = () => S.hub[S.lang]?.role && S.hub[S.lang].role !== 'teacher';
    const isAssistant = () => !isStaffView() && !!window.LessonStart?.isPureAssistant?.();
    const views = () => VIEWS.filter(v => !v.staff || isStaffView());
    const fresh = key => S.loadedAt[key] && Date.now() - S.loadedAt[key] < CACHE_MS;
    const stamp = key => { S.loadedAt[key] = Date.now(); };
    function refreshAll() {
        S.hub = {}; S.lessonCache = {}; S.students = {}; S.studentDetail = {}; S.loadedAt = {};
        ensureHub().then(render).catch(renderError);
    }

    function loadPrefs() {
        try {
            const p = JSON.parse(localStorage.getItem('mh_lesson_hub') || '{}');
            if (p.view) S.view = OLD_VIEW[p.view] || p.view;
            if (p.tab) S.tab = OLD_TAB[p.tab] || p.tab;
            if (p.bookKind) S.bookKind = p.bookKind;
            if (p.selected) S.selected = p.selected;
            if (p.duration) S.duration = p.duration;
            if (typeof p.group === 'string') S.group = p.group;
            if (typeof p.nearOnly === 'boolean') S.nearOnly = p.nearOnly;
        } catch { /* maxfiy rejim */ }
    }
    function savePrefs() {
        try { localStorage.setItem('mh_lesson_hub', JSON.stringify({ view: S.view, tab: S.tab, selected: S.selected, duration: S.duration, group: S.group, nearOnly: S.nearOnly, bookKind: S.bookKind })); } catch { /* */ }
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
        // Darslik dizayni: birinchi ochilishda 1-dars tanlangan (keyin oxirgi tanlov eslab qolinadi).
        if (!S.selected[S.lang]) S.selected[S.lang] = 1;
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
        if (hub && !views().some(v => v.id === S.view)) S.view = 'lessons';
        const meta = !hub ? 'Yuklanmoqda…' : isStaffView() ? `72 dars · ${hub.studentCount} o'quvchi`
            : isAssistant() ? `Siz yordam beradigan o'quvchilar: ${hub.studentCount}` : `Sizning o'quvchilaringiz: ${hub.studentCount}`;
        el.innerHTML = `
        <div class="lh">
            <div class="lh-banner-slot" data-lh-banner hidden></div>
            <div class="lh-top">
                <div class="lh-views" role="tablist" aria-label="Darslik bo'limlari">
                    ${(hub ? views() : VIEWS.filter(v => !v.staff)).map(v => `<button type="button" role="tab" tabindex="${S.view === v.id ? 0 : -1}" class="lh-view${S.view === v.id ? ' is-on' : ''}" aria-selected="${S.view === v.id}" data-view="${v.id}">${esc(v.label)}</button>`).join('')}
                </div>
                <div class="lh-meta"><span>${esc(meta)}</span>
                    ${hub?.canEdit && window.LessonImport ? `<button type="button" class="lh-btn" data-lh-import>${ICO.upload} Ommaviy yuklash</button>` : ''}</div>
            </div>
            <div class="lh-main" id="lhMain">${hub ? '' : skeleton()}</div>
            <div id="lhStudent"></div>
        </div>`;
        if (hub) drawBanner(el.querySelector('[data-lh-banner]'));
        el.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
            S.view = b.dataset.view; savePrefs(); render();
        }));
        if (typeof updateRdPageHead === 'function') updateRdPageHead();
        bindTablistKeys(el.querySelector('.lh-views'));
        el.querySelector('[data-lh-import]')?.addEventListener('click', async () => {
            let existing = [];
            try { existing = (await api(`/api/academic/materials?lang=${S.lang}`)).materials || []; } catch { /* takrorni tekshirmasdan davom */ }
            window.LessonImport.open({ lang: S.lang, existing, onDone: refreshAll });
        });
        if (!hub) return;
        const main = el.querySelector('#lhMain');
        if (S.view === 'lessons') renderLessonsView(main);
        else if (S.view === 'students') renderStudentsView(main);
        else if (S.view === 'books') renderBooksView(main);
        else renderExtraView(main);
    }

    // ── "Bugun · Darsni boshlash" banneri (faqat ustoz va yordamchi) ────────
    async function drawBanner(slot) {
        const LS = window.LessonStart;
        if (!slot || !LS || isStaffView()) return;
        let t;
        try { t = await LS.loadToday(); } catch { return; }
        S.today = t;
        if (!t?.next || !slot.isConnected) return;
        const n = t.next;
        const name = n.studentName || n.studentId;
        let facts = null;
        if (n.lessonNo) { try { facts = LS.lessonFacts(await LS.loadLesson(n.lessonNo, n.lang || S.lang)); } catch { /* */ } }
        if (!slot.isConnected) return;
        const when = `BUGUN · ${LS.hm(n.start)}`;
        if (t.assistant) {
            const desc = [facts?.topic || (facts && facts.name !== `${facts.no}-dars` ? facts.name : ''), facts?.teacherBook, n.lessonNo ? `${n.lessonNo}-dars xatolari` : ''].filter(Boolean).join(' · ');
            slot.innerHTML = `<div class="lh-banner"><span class="lh-bn-when">${esc(when)}</span>
                <b class="lh-bn-t">${esc(name)} · aloqa${n.lessonNo ? ` · ${n.lessonNo}-dars mavzusi` : ''}</b>
                ${desc ? `<span class="lh-bn-d">${esc(desc)}</span>` : ''}
                <button type="button" class="lh-bn-btn" data-bn-student>O'quvchi natijasi</button></div>`;
            slot.querySelector('[data-bn-student]').onclick = () => openStudent(n.studentId);
        } else {
            const desc = `Slaydlar, doska va ${facts?.teacherBook ? facts.teacherBook.replace('Ustoz kitobi', 'ustoz kitobi') : 'dars rejasi'} bitta oynada`;
            slot.innerHTML = `<div class="lh-banner"><span class="lh-bn-when">${esc(when)}</span>
                <b class="lh-bn-t">${esc(name)}${n.lessonNo ? ` · ${n.lessonNo}-dars · ${n.lessonNo % 2 === 0 ? 'jonli' : 'video'}` : ''}</b>
                <span class="lh-bn-d">${esc(desc)}</span>
                <button type="button" class="lh-bn-btn" data-bn-start>${ICO.play} Darsni boshlash</button></div>`;
            slot.querySelector('[data-bn-start]').onclick = () => LS.start({ studentId: n.studentId, studentName: name, lessonNo: n.lessonNo, lessonId: n.lessonId, lang: n.lang || S.lang, duration: n.end - n.start });
        }
        slot.hidden = false;
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
        const staff = isStaffView();
        const gaps = hub.syllabus.filter(l => !lessonReady(l)).length;
        const chips = [['all', 'Hammasi'], ['live', 'Jonli'], ['video', 'Video'], staff ? ['missing', `Kamchilik bor · ${gaps}`] : ['missing', 'Slaydsiz']];
        main.innerHTML = `
        <div class="lh-split">
            <aside class="lh-list" aria-label="72 dars ro'yxati">
                <div class="lh-list-tools">
                    <label class="lh-search">${ICO.search}<input type="search" class="lh-input" placeholder="Dars, mavzu yoki raqam" value="${esc(S.search)}" aria-label="Darslarni qidirish"></label>
                    <div class="lh-chips" role="group" aria-label="Dars turi">
                        ${chips.map(([k, l]) => `<button type="button" class="lh-chip${S.filter === k ? ' is-on' : ''}" data-filter="${k}" aria-pressed="${S.filter === k}">${esc(l)}</button>`).join('')}
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
            main.querySelectorAll('[data-filter]').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
            drawList();
        }));
        openLesson(S.selected[S.lang] || 1, { scroll: true });
    }

    // Dars tayyor: ilovada bor, slaydlar (jonli — PDF, video — PDF yoki ilova slaydlari) va uy vazifasi bor.
    const hasSlides = l => (l.type === 'live' ? l.materials.includes('live_slides') : (l.materials.includes('video_slides') || l.counts.slides > 0));
    function lessonGaps(l) {
        const g = [];
        if (!l.exists) g.push("ilovada yo'q");
        if (!hasSlides(l)) g.push('slayd yo\'q');
        if (!l.counts.homework) g.push("vazifa yo'q");
        return g;
    }
    const lessonReady = l => !lessonGaps(l).length;

    function lessonListHtml(hub) {
        const q = plain(S.search).trim().toLowerCase();
        const staff = isStaffView();
        const rows = hub.syllabus.filter(l => {
            if (S.filter === 'live' && l.type !== 'live') return false;
            if (S.filter === 'video' && l.type !== 'video') return false;
            if (S.filter === 'missing' && (staff ? lessonReady(l) : hasSlides(l))) return false;
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
            const gaps = staff ? lessonGaps(l) : [];
            const nm = plain(l.name), extra = nm && nm !== `${l.no}-dars` ? nm : plain(l.topic || '');
            html += `<button type="button" class="lh-item${sel ? ' is-on' : ''}" data-no="${l.no}" aria-current="${sel}">
                <span class="lh-num">${l.no}</span>
                <span class="lh-item-body">
                    <span class="lh-item-name">${l.no}-dars</span>
                    <span class="lh-item-meta"><span class="lh-type ${l.type}">${l.type === 'live' ? 'Jonli' : 'Video'}</span>${extra ? `<span>${esc(extra)}</span>` : ''}</span>
                </span>
                <span class="lh-item-side">
                    ${staff ? `<span class="lh-ready ${gaps.length ? 'is-gap' : 'is-ok'}" title="${esc(gaps.join(', ') || 'Slaydlar, so\'zlar va vazifa bor')}">${gaps.length ? 'Kamchilik' : 'Tayyor'}</span>` : ''}
                    ${l.studentsHere ? `<span class="lh-here" title="Shu darsda turgan o'quvchilar">${l.studentsHere} o'q.</span>` : ''}
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
            // Faqat ro'yxat ichida aylantiriladi — sahifa (sarlavha, tablar) joyida qoladi.
            const box = on && scroll ? b.closest('.lh-items') : null;
            if (box) box.scrollTop += b.getBoundingClientRect().top - box.getBoundingClientRect().top - (box.clientHeight - b.offsetHeight) / 2;
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
        const staff = isStaffView();
        const appSlides = L.slides.length;
        const tabCount = {
            slides: lessonMaterials(data, 'live_slides').length + lessonMaterials(data, 'video_slides').length + appSlides,
            video: L.videoUrl ? 1 : 0,
            grammar: lessonMaterials(data, 'grammar_slides').length + (L.konspekt ? 1 : 0),
            words: L.vocabulary.length, dialogs: L.audioDialogs.length + (L.dialog ? 1 : 0) + (L.text ? 1 : 0),
            homework: L.homework.length,
        };
        if (S.tab !== 'class' && !TABS.some(t => t.id === S.tab)) S.tab = 'plan';
        // Shu dars bo'yicha o'quvchilar: tugatgan / jarayonda.
        const cls = data.classStats.students.filter(r => !r.frozen);
        const done = cls.filter(r => r.percent >= 100 || r.reached > L.no).length;
        const inWork = cls.filter(r => r.reached === L.no && r.percent < 100).length;
        const progSub = !cls.length ? '' : done === cls.length ? "hammasi o'tgan · ko'rish" : inWork ? `${inWork} tasi jarayonda · ko'rish` : `${cls.length - done} tasi hali yetib kelmagan · ko'rish`;
        const who = staff ? "o'quvchi" : "o'quvchingiz";
        const tb = (data.guides || []).find(g => g.kind === 'teacher_book' && !isAssistGuide(g));
        const ab = (data.guides || []).find(g => g.kind === 'teacher_book' && isAssistGuide(g));
        const other = (data.guides || []).filter(g => g !== tb && g !== ab);
        const resCard = (attrs, icon, label, sub, off) => `<button type="button" class="lh-res${off ? ' is-off' : ''}" ${attrs}${off ? ' aria-disabled="true"' : ''}><span class="lh-res-ic">${icon}</span><span><span class="lh-rtl">${esc(label)}</span><br><span class="lh-rtp">${esc(sub)}</span></span></button>`;
        const live = L.type === 'live';
        const canStart = live && !staff && !isAssistant();
        const nm = plain(L.name);
        box.innerHTML = `
        <header class="lh-head">
            <div class="lh-head-row">
                <h2 class="lh-title" id="lhLessonTitle">${L.no}-dars</h2>
                <span class="lh-type lh-type--lg ${L.type}">${live ? 'Jonli dars · ustoz bilan' : 'Videodars · mustaqil'}</span>
                <span class="lh-kicker">${L.month}-oy${book ? ` · ${esc(bookShort(book))}` : ''}${L.active ? '' : ' · <span class="lh-warn">ilovada yopiq</span>'}</span>
                <div class="lh-nav">
                    <button type="button" class="lh-btn lh-sq" data-go="-1" ${L.no <= 1 ? 'disabled' : ''} aria-label="Oldingi dars">${ICO.prev}</button>
                    <button type="button" class="lh-btn lh-sq" data-go="1" ${L.no >= 72 ? 'disabled' : ''} aria-label="Keyingi dars">${ICO.next}</button>
                </div>
            </div>
            ${nm && nm !== `${L.no}-dars` ? `<div class="lh-sub">${esc(nm)}${L.titleRu ? ` · ${esc(L.titleRu)}` : ''}</div>` : ''}
            <div class="lh-acts">
                ${canStart ? `<button type="button" class="lh-btn lh-primary lh-lg" data-act="present">${ICO.play} Darsni boshlash</button><span class="lh-pill-info">Slaydlar, doska va dars rejasi bitta oynada</span>`
                    : live ? `<button type="button" class="lh-btn lh-primary lh-lg" data-act="present">${ICO.screen} Slaydlarni ko'rsatish</button><span class="lh-pill-info">${isAssistant() ? "Faqat ko'rish va ko'rsatish" : 'Jonli dars — ustoz bilan'}</span>`
                    : `<button type="button" class="lh-btn lh-primary lh-lg" data-act="present">${ICO.screen} O'quvchi ko'rinishida ochish</button><span class="lh-pill-info">Video dars — ustoz ishtirokisiz</span>`}
                ${cls.length ? `<button type="button" class="lh-prog" data-act="class" aria-pressed="${S.tab === 'class'}"><span><b>${done} / ${cls.length} ${who} tugatdi</b><small>${esc(progSub)}</small></span>
                    <span class="lh-prog-trk"><i style="width:${Math.round(done / cls.length * 100)}%"></i></span>${ICO.next}</button>` : ''}
            </div>
            ${L.cando ? `<p class="lh-goal"><b>Dars maqsadi:</b> ${esc(L.cando)}</p>` : ''}
            <div class="lh-rlab">Shu dars sahifalari</div>
            <div class="lh-ress">
                ${resCard('data-act="book"', ICO.book, 'Kitob', book ? (book.page ? `${book.page}-bet` : 'sahifa belgilanmagan') : 'yuklanmagan', !book)}
                ${resCard(tb ? `data-guide="${esc(tb.id)}"` : '', ICO.tbook, 'Ustoz kitobi', tb ? `${tb.page}-bet` : 'yuklanmagan', !tb)}
                ${resCard(ab ? `data-guide="${esc(ab.id)}"` : '', ICO.assist, "Yordamchi qo'llanma", ab ? `${ab.page}-bet` : 'yuklanmagan', !ab)}
                ${resCard('data-act="print"', ICO.print, 'Rejani chop etish', 'PDF, A4', false)}
                ${other.map(g => resCard(`data-guide="${esc(g.id)}"`, ICO.tbook, g.title, `${g.page}-bet`, false)).join('')}
                ${[...lessonMaterials(data, 'lesson_plan'), ...lessonMaterials(data, 'teacher_guide')].filter(m => safeUrl(m.url)).map(m => resCard(`data-file="${esc(m.id)}"`, ICO.tbook, m.title, m.kind === 'lesson_plan' ? 'Dars rejasi' : "Ustoz qo'llanmasi", false)).join('')}
            </div>
        </header>
        <div class="lh-tabs" role="tablist" aria-label="Dars bo'limlari">
            ${TABS.map(t => `<button type="button" role="tab" id="lhTab-${t.id}" aria-controls="lhPanel" tabindex="${S.tab === t.id ? 0 : -1}" class="lh-tab${S.tab === t.id ? ' is-on' : ''}" aria-selected="${S.tab === t.id}" data-tab="${t.id}">${esc(t.label)}${tabCount[t.id] ? ` <span class="lh-count">${tabCount[t.id]}</span>` : ''}</button>`).join('')}
        </div>
        <div class="lh-panel" role="tabpanel" id="lhPanel" aria-labelledby="lhTab-${S.tab === 'class' ? 'plan' : S.tab}"></div>`;
        const selectTab = id => {
            S.tab = id; savePrefs();
            box.querySelectorAll('[data-tab]').forEach(x => { const on = x.dataset.tab === id; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
            box.querySelector('[data-act="class"]')?.setAttribute('aria-pressed', String(id === 'class'));
            if (id !== 'class') box.querySelector('.lh-panel').setAttribute('aria-labelledby', 'lhTab-' + id);
            renderTab(box.querySelector('.lh-panel'), data);
        };
        box.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.tab)));
        box.querySelector('[data-act="class"]')?.addEventListener('click', () => selectTab(S.tab === 'class' ? 'plan' : 'class'));
        box.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => openLesson(L.no + Number(b.dataset.go), { scroll: true })));
        box.querySelector('[data-act="present"]').addEventListener('click', () => present(data));
        box.querySelector('[data-act="print"]').addEventListener('click', () => printPlan(data));
        box.querySelectorAll('.lh-ress [data-guide]').forEach(b => b.addEventListener('click', () => openGuide(data, b.dataset.guide)));
        box.querySelectorAll('.lh-ress [data-file]').forEach(b => b.addEventListener('click', () => {
            const m = data.materials.find(x => x.id === b.dataset.file);
            if (!m) return;
            if (canPresent(m)) LessonPresenter.open({ title: `${data.lesson.no}-dars · ${m.title}`, sources: [{ type: 'pdf', url: m.url, title: m.title }] });
            else window.open(safeUrl(m.url), '_blank', 'noopener');
        }));
        bindTablistKeys(box.querySelector('.lh-tabs'));
        box.querySelector('[data-act="book"]')?.addEventListener('click', () => {
            if (!book) return;
            S.bookState[S.lang] = { id: book.id, page: book.page || 1 };
            S.bookKind = 'book';
            S.view = 'books'; savePrefs(); render();
        });
        renderTab(box.querySelector('.lh-panel'), data);
    }
    const bookShort = b => { const m = String(b.title || '').match(/(\d+)\s*-?\s*(qism|kitob|part)/i); return m ? `${m[1]}-kitob` : 'kitob'; };

    function renderTab(panel, data) {
        const L = data.lesson;
        const t = S.tab;
        if (t === 'plan') return renderPlan(panel, data);
        if (t === 'slides') {
            panel.innerHTML = `
                ${L.slides.length ? `<div class="lh-card"><div class="lh-card-h"><b>Ilovadagi slaydlar</b> <span class="lh-muted">${L.slides.length} ta · o'quvchi ilovada ko'radi</span><span class="lh-gap"></span>
                    <button type="button" class="lh-btn" data-present-src="app-slides">${ICO.play} Ko'rsatish</button></div>
                    <div class="lh-thumbs">${L.slides.map((s, i) => s.imageUrl ? `<button type="button" class="lh-thumb" data-slide="${i}" title="${esc(s.title)}"><img loading="lazy" src="${esc(safeUrl(s.imageUrl))}" alt="${esc(s.title || `${i + 1}-slayd`)}"><span>${i + 1}</span></button>`
                        : `<div class="lh-thumb is-text"><b>${esc(s.title)}</b><span>${esc(String(s.body).slice(0, 120))}</span></div>`).join('')}</div></div>` : ''}
                ${materialSection(data, 'live_slides', 'Jonli dars slaydlari',
                    L.type === 'live' ? "Darsda ko'rsatiladigan slaydlar. PDF formatda yuklang — prezentatsiya rejimida ustiga chizish mumkin." : "Bu videodars. Jonli dars slaydlari odatda keyingi (jonli) darsda bo'ladi.")}
                ${materialSection(data, 'video_slides', 'Videodars slaydlari (fayllar)', "Video darsning PDF slaydlari — o'quvchi videoni ko'rmagan bo'lsa jonli darsda tez o'tib ketish uchun.")}
                ${S.hub[S.lang]?.canEdit ? `${materialSection(data, 'lesson_plan', 'Dars rejasi fayllari', "Metodist tayyorlagan rasmiy reja (PDF/Word). Ustozga \"Shu dars sahifalari\" qatorida ko'rinadi.")}
                ${materialSection(data, 'teacher_guide', "Ustoz qo'llanmasi (shu dars)", "Ustozga \"Shu dars sahifalari\" qatorida ko'rinadi.")}` : ''}`;
            panel.querySelector('[data-present-src="app-slides"]')?.addEventListener('click', () => present(data, { prefer: 'app-slides' }));
            panel.querySelectorAll('[data-slide]').forEach(b => b.addEventListener('click', () => present(data, { prefer: 'app-slides', page: Number(b.dataset.slide) + 1 })));
        } else if (t === 'video') {
            panel.innerHTML = safeUrl(L.videoUrl)
                ? `<div class="lh-card"><div class="lh-card-h"><b>Videodars</b><span class="lh-gap"></span><a class="lh-btn" href="${esc(safeUrl(L.videoUrl))}" target="_blank" rel="noopener">Yangi oynada</a></div>${videoEmbed(safeUrl(L.videoUrl))}</div>`
                : `<div class="lh-note">Bu dars uchun ilovada video yo'q${L.slides.length ? " — o'quvchi konspekt va slaydlar orqali o'rganadi (\"Slaydlar\" yorlig'i)" : ''}.</div>`;
        } else if (t === 'grammar') {
            panel.innerHTML = `
                ${L.konspekt ? `<div class="lh-card"><div class="lh-card-h"><b>Konspekt (grammatika)</b><span class="lh-muted">o'quvchi ilovada ko'radigan matn</span></div><div class="lh-konspekt">${konspektHtml(L.konspekt)}</div></div>` : '<div class="lh-note">Bu darsda konspekt kiritilmagan.</div>'}
                ${materialSection(data, 'grammar_slides', "Qo'shimcha grammatika slaydlari", 'Qoidani tushuntirish uchun alohida slaydlar (PDF).')}`;
        } else if (t === 'words') {
            panel.innerHTML = L.vocabulary.length ? `
                <div class="lh-card"><div class="lh-card-h"><b>Yangi so'zlar</b> <span class="lh-muted">${L.vocabulary.length} ta</span><span class="lh-gap"></span>
                    <button type="button" class="lh-btn" data-present-src="words">${ICO.play} Kartochkalarda ko'rsatish</button></div>
                <div class="lh-words">${L.vocabulary.map(w => `
                    <div class="lh-word">
                        ${safeUrl(w.imageUrl) ? `<img loading="lazy" src="${esc(safeUrl(w.imageUrl))}" alt="">` : `<div class="lh-word-ic">${esc(w.icon || '🔤')}</div>`}
                        <div><b>${esc(w.word)}</b>${w.transcript ? ` <span class="lh-muted">${esc(w.transcript)}</span>` : ''}
                        <div>${esc(w.translation)}</div>${w.example ? `<div class="lh-ex">${esc(w.example)}</div>` : ''}</div>
                    </div>`).join('')}</div></div>` : '<div class="lh-note">Bu darsda so\'zlar kiritilmagan.</div>';
            panel.querySelector('[data-present-src="words"]')?.addEventListener('click', () => present(data, { prefer: 'words' }));
        } else if (t === 'dialogs') {
            const blocks = L.audioDialogs.map(d => `
                <div class="lh-card"><div class="lh-card-h"><b>${esc(d.title)}</b>${d.bookPart ? `<span class="lh-muted">Kitob ${d.bookPart}-qism${d.trackNo ? `, ${d.trackNo}-trek` : ''}</span>` : ''}</div>
                ${safeUrl(d.audioUrl) ? `<audio controls preload="none" src="${esc(safeUrl(d.audioUrl))}"></audio>` : ''}
                ${linesTable(d.lines)}</div>`);
            if (L.dialog) blocks.push(`<div class="lh-card"><div class="lh-card-h"><b>Kitobdagi dialog${L.dialog.title ? `: ${esc(L.dialog.title)}` : ''}</b></div>${linesTable(L.dialog.lines)}</div>`);
            if (L.text) blocks.push(`<div class="lh-card"><div class="lh-card-h"><b>O'qish matni${L.text.title ? `: ${esc(L.text.title)}` : ''}</b></div>
                <div class="lh-two"><div class="lh-ru">${esc(L.text.ru)}</div><div class="lh-muted">${esc(L.text.uz)}</div></div>
                ${L.text.questions.length ? `<ol class="lh-qa">${L.text.questions.map(q => `<li>${esc(q.q)} <span class="lh-ans">→ ${esc((q.opts || [])[q.a] ?? '')}</span></li>`).join('')}</ol>` : ''}</div>`);
            if (L.speaking.length) blocks.push(`<div class="lh-card"><div class="lh-card-h"><b>Gapirish iboralari</b></div>${linesTable(L.speaking.map(s => ({ ru: s.ru, uz: s.uz })))}</div>`);
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
    // Umumiy algoritm (js/academicRules.js) — server bilan aynan bir xil.
    const allocateMinutes = (blocks, duration) => (RULES.allocateMinutes
        ? RULES.allocateMinutes(blocks, duration)
        : blocks.map(b => Math.max(1, Math.round((b.share / 100) * duration))));
    function planMinutes(blocks, duration) {
        const mins = allocateMinutes(blocks, duration);
        let used = 0;
        return blocks.map((b, i) => { const from = used; used += mins[i]; return { ...b, minutes: mins[i], from, to: used }; });
    }
    const mmss = m => `${String(Math.floor(m)).padStart(2, '0')}:00`;

    const isShort = d => d <= 20;
    const isMedium = d => d > 20 && d <= 35;
    function planBlocks(plan, duration) {
        if (plan.mode !== 'live') return plan.blocks;
        const set = isShort(duration) && plan.shortBlocks ? plan.shortBlocks : isMedium(duration) && plan.mediumBlocks ? plan.mediumBlocks : plan.blocks;
        return planMinutes(set, duration);
    }
    const blockList = items => (items.length ? `<ul class="${items.some(i => String(i).length > 40) ? 'is-long' : ''}">${items.map(i => `<li>${esc(plain(i))}</li>`).join('')}</ul>` : '');

    function renderPlan(panel, data) {
        const L = data.lesson, plan = L.plan;
        const duration = S.duration || 60;
        const blocks = planBlocks(plan, duration);
        const durations = [...new Set([15, 20, 30, 45, 60, 80, 90, S.hub[S.lang]?.defaultDuration, duration].filter(Boolean))].sort((a, b) => a - b);
        const missing = data.classStats.prevHomeworkMissing || [];
        const live = plan.mode === 'live';
        // Videodars: o'quvchi ilovada nima qiladi — sonlar bilan.
        const studentItems = () => {
            const it = [];
            if (L.slides.length || L.konspekt) it.push(['Slaydlar va konspekt', L.slides.length ? `${L.slides.length} ta` : '']);
            if (L.vocabulary.length) it.push(["Yangi so'zlar: ro'yxat + mashq", `${L.vocabulary.length} ta`]);
            if (L.text) it.push([`O'qish: ${L.text.title || 'matn'}`, L.text.questions.length ? `${L.text.questions.length} savol` : '']);
            for (const h of L.homework) it.push([h.title || HW_KIND[h.kind] || h.kind, `${h.questions} savol`]);
            return it;
        };
        const graded = L.homework.some(h => h.teacherGraded);
        const WHO = { student: ["O'QUVCHI", 'Ilovada', 'dars kunigacha'], before: ['USTOZ', 'Dars kuni', '10–15 daqiqa'], after: ['USTOZ', 'Keyingi jonli dars', '3–5 daqiqa'] };
        const videoBlock = b => {
            const w = WHO[b.key] || ['', b.when || '', ''];
            const body = b.key === 'student'
                ? `<div class="lh-its">${studentItems().map(([t, n]) => `<div class="lh-it"><span>${esc(t)}</span>${n ? `<b>${esc(n)}</b>` : ''}</div>`).join('')}
                    ${L.homework.length ? `<div class="lh-it is-info">${graded ? 'Ijodiy vazifani ustoz baholaydi, qolgani avtomatik' : 'Hammasi avtomatik tekshiriladi'}</div>` : ''}</div>`
                : `<ul class="lh-chk">${b.items.map(i => `<li>${ICO.check}<span>${esc(plain(i))}</span></li>`).join('')}</ul>`;
            return `<li class="lh-blk"><div class="lh-who"><span class="lh-wl">${esc(w[0])}</span><b>${esc(w[1])}</b><small>${esc(w[2])}</small></div>
                <div class="lh-blk-b"><h3>${esc(b.title)}</h3>${body}${b.tip ? `<p class="lh-tip">${esc(b.tip)}</p>` : ''}</div></li>`;
        };
        const liveBlock = (b, i) => `<li class="lh-blk"><div class="lh-who"><span class="lh-wl">${i + 1}-QISM</span><b>${b.minutes} daqiqa</b><small>${mmss(b.from)}–${mmss(b.to)}</small></div>
            <div class="lh-blk-b"><h3>${esc(b.title)}</h3>${blockList(b.items)}${b.tip ? `<p class="lh-tip">${esc(b.tip)}</p>` : ''}</div></li>`;
        panel.innerHTML = `
        ${live
            ? (missing.length ? `<div class="lh-alert" role="status">${ICO.warn}<div><b>Darsdan oldin:</b> shu darsga kelayotgan, lekin oldingi darsni ${RULES.UNLOCK_PERCENT}% dan kam bajarganlar (${missing.length}): ${missing.map(s => esc(s.name)).join(', ')}</div></div>` : '')
            : `<div class="lh-alert" role="note">${ICO.warn}<div><b>Darsdan oldin:</b> videodars o'quvchi ilovasida mustaqil o'rganiladi. Ustozning ishi — darsdan oldin tayyorlash, kuzatish va keyingi jonli darsda mustahkamlash.</div></div>`}
        ${live ? `<div class="lh-plan-h"><p class="lh-muted lh-summary">${esc(plan.summary)}${isShort(duration) ? ' · Qisqa (individual) dars shabloni.' : isMedium(duration) ? " · O'rta (30 daqiqalik) dars shabloni: dialog va qoida birlashtirilgan." : ''}</p>
            <label class="lh-dur">Dars davomiyligi <select>${durations.map(d => `<option value="${d}"${d === duration ? ' selected' : ''}>${d} daqiqa</option>`).join('')}</select></label></div>` : ''}
        <ol class="lh-blks">${live ? blocks.map(liveBlock).join('') : blocks.map(videoBlock).join('')}</ol>
        ${plan.anticipated?.length ? `<div class="lh-two-cards">
            <div class="lh-card"><div class="lh-card-h"><b>Kutiladigan qiyinchiliklar</b></div><ul class="lh-rules">${plan.anticipated.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
            <div class="lh-card"><div class="lh-card-h"><b>Turli darajadagi o'quvchilar</b></div><ul class="lh-rules">${(plan.differentiation || []).map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
        </div>` : ''}
        ${L.review.length ? `<div class="lh-card"><div class="lh-card-h"><b>O'tgan darsni eslash savollari</b><span class="lh-muted">videodars boshida o'quvchi ham ko'radi</span></div>
            <ol class="lh-qa">${L.review.map(r => `<li>${esc(r.q)}${r.a ? ` <span class="lh-ans">→ ${esc(r.a)}</span>` : ''}</li>`).join('')}</ol></div>` : ''}
`;
        panel.querySelector('.lh-dur select')?.addEventListener('change', e => {
            S.duration = Number(e.target.value); savePrefs(); renderPlan(panel, data); bindMaterialActions(panel, data);
        });
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
            const open = () => openStudent(tr.dataset.student);
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
    // Qo'shimcha material: PDF sahifalar soni yoki audio davomiyligi (aniqlanmasa — null, faqat hajm ko'rsatiladi).
    async function fileInfo(file) {
        try {
            if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) {
                if (!window.pdfjsLib) return null;
                const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
                const pages = doc.numPages; doc.destroy?.();
                return pages ? { pages } : null;
            }
            if (/^audio\//i.test(file.type) || /\.(mp3|m4a|wav|ogg)$/i.test(file.name)) {
                const url = URL.createObjectURL(file);
                const sec = await new Promise(res => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(0); a.src = url; setTimeout(() => res(0), 5000); });
                URL.revokeObjectURL(url);
                return Number.isFinite(sec) && sec > 0 ? { durationSec: Math.round(sec) } : null;
            }
        } catch { /* ma'lumot ixtiyoriy */ }
        return null;
    }

    function openMaterialForm({ kind, mode, lessonNo, existing }) {
        const hub = S.hub[S.lang];
        const label = hub.kinds.lesson[kind] || hub.kinds.course[kind] || kind;
        const isBook = kind === 'book';
        const large = LARGE_KINDS.has(kind);
        const hasPages = large;
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
                <label>Qaysi darsgacha<input name="lessonTo" type="number" min="1" max="72" class="lh-input" value="${existing?.meta?.lessonTo || 24}"></label></div>` : ''}
            ${hasPages ? `<label>Darslar boshlanadigan sahifalar <span class="lh-muted">(ixtiyoriy: "1:5, 2:9, 3:14")</span><textarea name="pageMap" rows="3" class="lh-input" placeholder="1:5, 2:9, 3:14">${esc(pm)}</textarea></label>` : ''}
            <label>Izoh <span class="lh-muted">(ixtiyoriy)</span><input name="note" maxlength="300" class="lh-input" value="${esc(existing?.note || '')}"></label>
            <div class="lh-dialog-actions">${editing ? `<button type="button" class="lh-btn lh-danger" data-del-in>O'chirish</button><span class="lh-gap"></span>` : ''}<button type="button" class="lh-btn" data-cancel>Bekor qilish</button><button type="submit" class="lh-btn lh-primary">Saqlash</button></div>
            <div class="lh-progress" role="status" hidden>Yuklanmoqda…</div>
        </form>`;
        document.body.appendChild(wrap);
        const form = wrap.querySelector('form');
        const closeForm = trapModal(wrap);
        wrap.addEventListener('click', e => { if (e.target === wrap) closeForm(); });
        wrap.querySelector('[data-cancel]').onclick = closeForm;
        wrap.querySelector('[data-del-in]')?.addEventListener('click', () => { closeForm(); deleteMaterial(existing.id); });
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
                else if (hasPages) body.meta = { pageMap: String(fd.get('pageMap') || '') };
                if (mode === 'link') body.url = String(fd.get('url') || '').trim();
                if (mode === 'file') {
                    const file = fd.get('file');
                    if (!file || !file.size) throw new Error('Fayl tanlang');
                    const limit = large ? 300 : 50;
                    if (file.size > limit * 1048576) throw new Error(`Fayl ${limit} MB dan katta`);
                    const up = large ? await uploadLargePdf(file) : await apiUploadFile(file);
                    Object.assign(body, { url: up.url, fileName: up.fileName || file.name, fileSize: up.fileSize || file.size, mime: up.mimeType || file.type });
                    // DarslikMaterial: "2 bet · 340 KB" / "1:42" — faylning o'zidan (PDF sahifalari, audio davomiyligi).
                    if (!large) { const info = await fileInfo(file); if (info) body.meta = { ...(body.meta || {}), ...info }; }
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

    // Teacher's book / qo'llanmani shu darsning sahifasida ochish (o'qish rejimi).
    function openGuide(data, id) {
        const g = (data.guides || []).find(x => x.id === id);
        if (!g) return;
        if (!isLocalFile(g.url)) { const u = safeUrl(g.url); if (u) window.open(u, '_blank', 'noopener'); return; }
        LessonPresenter.open({ title: `${data.lesson.no}-dars · ${g.title}`, sources: [{ type: 'pdf', url: g.url, title: g.title }], startPage: g.page });
    }

    // ── Prezentatsiya manbalari ─────────────────────────────────────────────
    // Darslik va "Darsni boshlash" (js/lessonStart.js) uchun umumiy ro'yxat.
    function buildSources(data) {
        const L = data.lesson;
        const mats = kind => (data.materials || []).filter(m => m.kind === kind);
        const pdf = m => ({ type: 'pdf', url: m.url, title: `${m.kindLabel}: ${m.title}`, id: m.id });
        const sources = [];
        const live = mats('live_slides').filter(canPresent).map(pdf);
        const vids = mats('video_slides').filter(canPresent).map(pdf);
        const gram = mats('grammar_slides').filter(canPresent).map(pdf);
        const imgs = L.slides.filter(s => safeUrl(s.imageUrl));
        const appSlides = imgs.length
            ? { type: 'images', title: `Ilovadagi slaydlar (${imgs.length})`, key: 'app-slides', items: imgs.map(s => ({ url: safeUrl(s.imageUrl), caption: s.title })) } : null;
        const words = L.vocabulary.length ? { type: 'words', title: `So'z kartochkalari (${L.vocabulary.length})`, key: 'words', items: L.vocabulary.map(w => ({ ...w, imageUrl: safeUrl(w.imageUrl) })) } : null;
        const video = safeUrl(L.videoUrl) ? { type: 'video', url: safeUrl(L.videoUrl), title: 'Videodars' } : null;
        if (L.type === 'live') sources.push(...live, words, ...gram, ...vids, appSlides, video);
        else sources.push(...vids, appSlides, video, words, ...gram, ...live);
        if (data.book && isLocalFile(data.book.url)) sources.push({ type: 'pdf', url: data.book.url, title: `Kitob: ${data.book.title}`, key: 'book', page: data.book.page || 1 });
        for (const g of data.guides || []) if (isLocalFile(g.url)) sources.push({ type: 'pdf', url: g.url, title: `${g.title} · ${g.page}-bet`, key: 'guide', id: g.id, page: g.page });
        const list = sources.filter(Boolean);
        list.push({ type: 'blank', title: "Toza doska", key: 'blank' });
        return list;
    }

    function present(data, opts = {}) {
        const L = data.lesson;
        const list = buildSources(data);
        let start = 0, startPage = opts.page || 1;
        if (opts.blank) start = list.length - 1;
        else if (opts.fileId) start = Math.max(0, list.findIndex(s => s.id === opts.fileId));
        else if (opts.prefer) start = Math.max(0, list.findIndex(s => s.key === opts.prefer));
        if (list[start]?.key === 'book' && !opts.page && data.book?.page) startPage = data.book.page;
        // Jonli dars (asosiy ustoz): reja paneli va "Darsni tugatish → Keldi".
        const main = L.type === 'live' && !isStaffView() && !isAssistant() && window.LessonStart;
        let finish = null, subtitle = '';
        const duration = S.duration || S.hub[S.lang]?.defaultDuration || 60;
        if (main) {
            const next = S.today?.next && S.today.next.lessonNo === L.no ? S.today.next : null;
            subtitle = [next?.studentName, `${duration} daq`, data.book ? `${bookShort(data.book)}${data.book.page ? ` ${data.book.page}-bet` : ''}` : ''].filter(Boolean).join(' · ');
            finish = { label: 'Darsni tugatish', onFinish: ctx => window.LessonStart._finish({ ...ctx, studentId: next?.studentId || '', studentName: next?.studentName || '', lessonNo: L.no, lessonId: next?.lessonId || '' }) };
        }
        LessonPresenter.open({
            title: `${L.no}-dars · ${L.type === 'live' ? 'Jonli dars' : 'Videodars'}`, subtitle: subtitle || plain(L.name),
            sources: list, start, startPage, lesson: data, duration, finish,
            presence: main && S.today?.next?.lessonNo === L.no && S.today.next.studentId ? { studentId: S.today.next.studentId, name: S.today.next.studentName } : null,
        });
    }

    // ── O'quvchilar progressi ───────────────────────────────────────────────
    // O'quvchilar progressi (DarslikProgress dizayni): 6 ta KPI, "O'quvchilar" jadvali (ustoz filtri, saralash, CSV),
    // sahifalash va izoh pastda. Qator bosilsa — o'quvchining batafsil sahifasi.
    const PROG_PAGE = 7; // DarslikProgress dizayni: sahifada 7 o'quvchi
    const SORTS = [['attention', "Avval e'tibor kerak"], ['reached', "Joriy dars bo'yicha"], ['time', 'Faol vaqt (7 kun)'], ['homework', 'Uy vazifasi natijasi'], ['name', 'Ism']];
    const FLAG_PILL = { idle: ['Faol emas', 'warn'], struggling: ['Qiynalyapti', 'warn'], behind: ['Rejadan orqada', 'bad'], frozen: ['Muzlatilgan', 'mute'] };
    const shortName = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || ''; };
    const teacherNameOf = id => (id && window.schoolUI?.teacherName ? window.schoolUI.teacherName(id) : '') || '';
    // "Bugun 17:05" / "Kecha" / "N kun oldin" (Toshkent vaqti).
    function lastSeen(isoStr) {
        if (!isoStr) return 'hech qachon';
        const tz = d => new Date(new Date(d).getTime() + 5 * 3600e3);
        const t = tz(isoStr), n = tz(Date.now());
        const day = d => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        const diff = Math.round((day(n) - day(t)) / 86400000);
        if (diff <= 0) return `Bugun ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
        if (diff === 1) return 'Kecha';
        return `${diff} kun oldin`;
    }
    function durP(sec) {
        sec = Number(sec) || 0;
        if (!sec) return '—';
        const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
        return h ? `${h} soat ${String(m).padStart(2, '0')} daq` : `${Math.max(1, m)} daq`;
    }

    async function renderStudentsView(main) {
        main.innerHTML = skeleton();
        let data = S.students[S.lang];
        if (!data || !fresh('students:' + S.lang)) {
            try { data = S.students[S.lang] = await api(`/api/academic/students?lang=${S.lang}`); stamp('students:' + S.lang); }
            catch (e) { main.innerHTML = `<div class="lh-error"><b>Yuklab bo'lmadi</b><span>${esc(e.message)}</span></div>`; return; }
        }
        if (S.view !== 'students') return;
        try { await window.schoolUI?.loadStaffAvatars?.(); } catch { /* ism kerak, avatar emas */ }
        if (S.view !== 'students') return;
        const teachers = [...new Set(data.students.map(s => s.teacherId).filter(Boolean))]
            .map(id => ({ id, name: teacherNameOf(id) || id })).sort((a, b) => a.name.localeCompare(b.name));
        if (S.teacher && !teachers.some(t => t.id === S.teacher)) S.teacher = '';
        const scoped = data.students.filter(s => !S.teacher || s.teacherId === S.teacher);
        const active = scoped.filter(s => !s.frozen);
        const count = key => active.filter(s => shownFlags(s).some(f => f.key === key));
        const weekTotal = active.reduce((a, s) => a + s.time.week, 0);
        const avg = (arr, f) => (arr.length ? Math.round(arr.reduce((a, s) => a + f(s), 0) / arr.length) : 0);
        const avgReached = avg(active, s => s.reached);
        const withPlan = active.filter(s => s.expected);
        const avgPlan = avg(withPlan, s => s.expected);
        // Qatorda "/ N reja" faqat o'quvchining rejasi ko'pchilikdan farq qilsa (masalan, keyinroq qo'shilgan yoki orqada qolgan).
        const planCount = {}; withPlan.forEach(s => { planCount[s.expected] = (planCount[s.expected] || 0) + 1; });
        const commonPlan = Number(Object.entries(planCount).sort((a, b) => b[1] - a[1])[0]?.[0]) || null;
        const active7 = active.filter(s => s.time.week > 0 || s.activeDays7 > 0).length;
        const hours = Math.round(weekTotal / 3600);
        const per = active.length ? weekTotal / active.length : 0;
        const perTxt = per >= 3600 ? `~${Math.round(per / 3600)} soat` : `~${Math.max(1, Math.round(per / 60))} daq`;
        const names = arr => arr.slice(0, 2).map(s => shortName(s.name)).join(', ') + (arr.length > 2 ? ` +${arr.length - 2}` : '');
        const idle = count('idle'), strug = count('struggling'), behind = count('behind');
        const q = plain(S.studentQuery || '').trim().toLowerCase();
        const list = sortStudents(scoped).filter(s => !q || plain(s.name).toLowerCase().includes(q));
        const pages = Math.max(1, Math.ceil(list.length / PROG_PAGE));
        S.studentPage = Math.min(S.studentPage || 0, pages - 1);
        const from = S.studentPage * PROG_PAGE, rows = list.slice(from, from + PROG_PAGE);
        const sortLabel = (SORTS.find(x => x[0] === S.studentSort) || SORTS[0])[1].toLowerCase();
        const kpi = (l, v, d, warn) => `<div class="lh-pk${warn ? ' is-warn' : ''}"><span class="lh-pk-l">${l}</span><span class="lh-pk-v">${v}</span><span class="lh-pk-d">${d}</span></div>`;
        const hw = s => (s.firstTryAvg === null || s.firstTryAvg === undefined ? '<span class="lh-muted">—</span>'
            : `<div class="lh-pmini" title="Eng yaxshi natija: ${s.homeworkAvg ?? '—'}%"><div class="lh-ptrk"><span class="${s.firstTryAvg < RULES.PASS_PERCENT ? 'lo' : ''}" style="width:${Math.max(0, Math.min(100, s.firstTryAvg))}%"></span></div><b class="${s.firstTryAvg < RULES.PASS_PERCENT ? 'is-lo' : ''}">${s.firstTryAvg}%</b></div>`);
        const pills = s => { const f = shownFlags(s).filter(x => FLAG_PILL[x.key]); return f.length ? `<div class="lh-pfl">${f.map(x => `<span class="lh-ppill is-${FLAG_PILL[x.key][1]}" title="${esc(x.label)}">${esc(x.key === 'idle' && s.daysIdle === null ? "Ilovaga kirmagan" : FLAG_PILL[x.key][0])}</span>`).join('')}</div>` : '<span class="lh-muted">—</span>'; };
        main.innerHTML = `
        <div class="lh-pk6">
            ${kpi("O'quvchilar", active.length, `7 kunda ilovada faol: ${active7}${scoped.length > active.length ? ` · +${scoped.length - active.length} muzlatilgan` : ''}`)}
            ${kpi("O'rtacha joriy dars", `${avgReached || '—'} <small>/ 72</small>`, withPlan.length ? `reja bo'yicha ${avgPlan}-dars` : 'reja belgilanmagan')}
            ${kpi('Faol vaqt · 7 kun', hours >= 1 ? `${hours} <small>soat</small>` : `${Math.round(weekTotal / 60)} <small>daq</small>`, `jami ${active.length} o'quvchi · boshiga ${perTxt}`)}
            ${kpi('Faol emas · 3+ kun', idle.length, idle.length ? esc(names(idle)) : "hammasi faol", idle.length)}
            ${kpi('Qiynalyapti', strug.length, `1-urinish ${RULES.PASS_PERCENT}% dan past · faol o'quvchilar`, strug.length)}
            ${kpi('Rejadan orqada', behind.length, `${RULES.LESSONS_PER_WEEK + 1}+ dars orqada${behind.length ? ` · ${esc(names(behind))}` : ''}`, behind.length)}
        </div>
        <section class="lh-card lh-pcard" aria-labelledby="lhProgTitle">
            <div class="lh-pch"><h3 class="lh-pct-t" id="lhProgTitle">O'quvchilar</h3>
                <div class="lh-prow">
                    <label class="lh-pinp">${ICO.search}<input type="search" placeholder="Ism bo'yicha" aria-label="O'quvchi qidirish" value="${esc(S.studentQuery || '')}"></label>
                    <select class="lh-psel" data-teacher aria-label="Ustoz"><option value="">Barcha ustozlar</option>${teachers.map(t => `<option value="${esc(t.id)}"${S.teacher === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
                    <select class="lh-psel" data-sort aria-label="Saralash">${SORTS.map(([k, l]) => `<option value="${k}"${S.studentSort === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
                    <button type="button" class="lh-pbtn" data-csv>${ICO.download}CSV</button>
                </div>
            </div>
            ${rows.length ? `<div class="lh-pscroll"><table class="lh-ptbl"><thead><tr><th scope="col">O'quvchi</th><th scope="col">Joriy dars</th><th scope="col">Tugatgan</th><th scope="col">Uy vazifasi · 1-urinish</th><th scope="col">Xatolar</th><th scope="col">Faol vaqt · 7 kun</th><th scope="col">Oxirgi faollik</th><th scope="col">Holat</th></tr></thead>
            <tbody>${rows.map(s => `<tr data-student="${esc(s.id)}" tabindex="0">
                <td><div class="lh-pnm">${esc(s.name)}</div><div class="lh-pmt">${esc(teacherNameOf(s.teacherId) || '—')}</div></td>
                <td><b>${s.reached || '—'}</b>${s.expected && s.expected !== commonPlan ? ` <span class="lh-pmt is-in">/ ${s.expected} reja</span>` : ''}</td>
                <td>${s.completed}</td><td>${hw(s)}</td><td>${s.mistakes || '—'}</td>
                <td>${esc(durP(s.time.week))}</td><td>${esc(lastSeen(s.lastActive))}</td><td>${pills(s)}</td></tr>`).join('')}</tbody></table></div>`
                : `<div class="lh-empty-sm">${list.length !== scoped.length ? "Qidiruvga mos o'quvchi yo'q" : "Bu yo'nalishda o'quvchi yo'q"}</div>`}
            <div class="lh-pfoot2">${list.length ? `<b>${from + 1}–${from + rows.length} / ${list.length}</b> · ${esc(S.studentSort === 'attention' ? "avval e'tibor kerak bo'lganlar" : sortLabel)}${S.studentPage > 0 ? ' · <button type="button" class="lh-linkbtn" data-pp="-1">oldingi sahifa</button>' : ''}${S.studentPage < pages - 1 ? ' · <button type="button" class="lh-linkbtn" data-pp="1">keyingi sahifa</button>' : ''}<br>` : ''}Faol vaqt — ilova ochiq va o'quvchi ishlayotgan vaqt (2 daqiqa harakatsizlikdan keyin to'xtaydi). 1-urinish — uy vazifasining birinchi urinishdagi natijasi. Qatorni bosing — o'quvchining batafsil sahifasi ochiladi.</div>
        </section>`;
        const tbody = main.querySelector('tbody');
        const search = main.querySelector('.lh-pinp input');
        search.addEventListener('input', e => {
            S.studentQuery = e.target.value; S.studentPage = 0;
            const pos = e.target.selectionStart;
            renderStudentsView(main).then(() => { const i = main.querySelector('.lh-pinp input'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch { /* */ } } });
        });
        main.querySelector('[data-sort]').addEventListener('change', e => { S.studentSort = e.target.value; S.studentPage = 0; renderStudentsView(main); });
        main.querySelector('[data-teacher]').addEventListener('change', e => { S.teacher = e.target.value; S.studentPage = 0; renderStudentsView(main); });
        main.querySelectorAll('[data-pp]').forEach(b => b.addEventListener('click', () => { S.studentPage += Number(b.dataset.pp); renderStudentsView(main); }));
        main.querySelector('[data-csv]').addEventListener('click', () => exportCsv(list));
        tbody?.querySelectorAll('[data-student]').forEach(tr => {
            tr.addEventListener('click', () => openStudent(tr.dataset.student));
            tr.addEventListener('keydown', e => { if (e.key === 'Enter') openStudent(tr.dataset.student); });
        });
        if (S.openStudent) openStudent(S.openStudent);
    }

    function exportCsv(list) {
        const head = ["O'quvchi", 'Ustoz', 'Joriy dars', 'Reja', "O'rtacha %", 'Tugatgan', '1-urinish %', 'Eng yaxshi %', 'Xatolar', 'Faol vaqt 7 kun (daq)', 'Faol vaqt jami (daq)', 'Faol kunlar (7)', 'Oxirgi faollik', 'Holat'];
        // Excel formulasi bo'lib ketmasin (=, +, -, @ bilan boshlanadigan matnlar).
        const q = v => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
        const rows = list.map(s => [s.name, teacherNameOf(s.teacherId), s.reached, s.expected ?? '', s.avgPercent, s.completed, s.firstTryAvg ?? '', s.homeworkAvg ?? '',
            s.mistakes, Math.round(s.time.week / 60), Math.round(s.time.total / 60), s.activeDays7, s.lastActive ? s.lastActive.slice(0, 10) : '', s.flags.map(f => f.label).join('; ')]);
        const csv = '﻿' + [head, ...rows].map(r => r.map(q).join(';')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `oquvchilar-progressi-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    // Holat belgilari (DarslikProgress dizayni): faol bo'lmagan o'quvchida "Qiynalyapti" ko'rsatilmaydi —
    // 1-urinish natijasi faqat faol o'quvchilar bo'yicha baholanadi ("Qiynalyapti · faol o'quvchilar").
    const shownFlags = s => { const idle = s.flags.some(f => f.key === 'idle'); return s.flags.filter(f => !(idle && f.key === 'struggling')); };
    const FLAG_RANK = { behind: 3, idle: 2, struggling: 1 };
    const flagRank = s => shownFlags(s).reduce((m, f) => Math.max(m, FLAG_RANK[f.key] || 0), 0);
    function sortStudents(list) {
        const arr = [...list];
        const by = {
            // Avval e'tibor kerak: belgilar soni → og'irligi → 1-urinish natijasi (pastroq oldin) → joriy dars.
            attention: (a, b) => (a.frozen - b.frozen) || shownFlags(b).length - shownFlags(a).length || flagRank(b) - flagRank(a)
                || (a.firstTryAvg ?? 101) - (b.firstTryAvg ?? 101) || a.reached - b.reached,
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
                <div class="lh-kpi"><span>Jonli darsga keldi</span><b>${att.expected ? `${Math.min(att.present, att.expected)}/${att.expected}` : att.present}</b><small>${att.expected ? `jadval bo'yicha · ${att.rate}%` : 'marta (jadval kiritilmagan)'}${att.expected && att.present > att.expected ? ` · +${att.present - att.expected} qo'shimcha` : ''}${att.assistantPresent ? ` · yordamchi: ${att.assistantPresent}` : ''}</small></div>
            </div>
            <div class="lh-card"><div class="lh-card-h"><b>72 dars xaritasi</b><span class="lh-muted">katakni bosing</span></div>
                <div class="lh-heat">${d.lessons.map(l => `<button type="button" class="lh-cell ${heatClass(l)}${l.grades.length ? ' has-grade' : ''}" data-cell="${l.no}" aria-label="${l.no}-dars: ${l.percent}%${l.grades.length ? ', jonli darsda baholangan' : ''}">${l.no}</button>`).join('')}</div>
                <div class="lh-legend"><span class="lh-cell c0"></span>boshlanmagan <span class="lh-cell c1"></span>1–49% <span class="lh-cell c2"></span>50–99% <span class="lh-cell c3"></span>100% <span class="lh-cell c0 has-grade"></span>jonli darsda baho bor</div>
            </div>
            <div class="lh-card" id="lhCellDetail" aria-live="polite"></div>
            <div class="lh-card"><div class="lh-card-h"><b>Faol vaqt — oxirgi 30 kun</b></div>${timeChart(d.timeByDay, d.days30)}
                ${Object.keys(d.timeBySection).length ? `<div class="lh-muted">Bo'limlar bo'yicha (oxirgi ${d.sectionPeriodDays || 60} kun):</div><div class="lh-sections">${Object.entries(d.timeBySection).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span><b>${esc(SECTION_LABEL[k] || k)}</b> ${dur(v)}</span>`).join('')}</div>` : ''}
            </div>
            <div class="lh-two-cards">
                <div class="lh-card"><div class="lh-card-h"><b>Jonli dars davomati</b></div>
                    ${att.rows.length ? `<ul class="lh-att">${att.rows.slice(0, 20).map(a => `<li><span>${esc(fmtDate(a.date))}</span>${a.present ? '<span class="lh-flag ok">keldi</span>' : '<span class="lh-flag struggling">kelmadi</span>'}${a.kind === 'assistant' ? '<span class="lh-tag">yordamchi</span>' : ''}</li>`).join('')}</ul>` : '<div class="lh-muted">Davomat hali belgilanmagan</div>'}
                    <div class="lh-muted">Ro'yxatda faqat belgilangan kunlar. ${att.expected ? `Jadval bo'yicha ${att.expected} ta jonli dars bo'lishi kerak edi.` : ''}</div></div>
                <div class="lh-card"><div class="lh-card-h"><b>Jonli dars baholari</b></div>
                    ${d.grades?.length ? `<ul class="lh-att">${d.grades.slice(0, 15).map(g => `<li><span>${esc(fmtDate(g.date))}${g.lessonNo ? ` · ${g.lessonNo}-dars` : ''}</span>${g.average !== null ? `<b>${g.average}</b>` : ''}${g.comment ? `<span class="lh-muted">${esc(g.comment)}</span>` : ''}</li>`).join('')}</ul>` : '<div class="lh-muted">Baho qo\'yilmagan</div>'}</div>
            </div>
            ${d.exams?.length ? `<div class="lh-card"><div class="lh-card-h"><b>Imtihonlar</b></div>
                <ul class="lh-activity">${d.exams.map(a => `<li><span>${esc(a.label)}</span>${typeof a.scorePercent === 'number' ? pct(a.scorePercent) : ''}${a.bestPercent !== undefined ? `<span class="lh-muted">eng yaxshi ${a.bestPercent}% · ${a.attempts} urinish</span>` : ''}${a.passed === true ? '<span class="lh-flag ok">o\'tdi</span>' : a.passed === false ? '<span class="lh-flag struggling">o\'tmadi</span>' : ''}<span class="lh-muted">${esc(ago(a.time))}</span>
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

    function timeChart(byDay, keys) {
        // Kunlar serverdan (Toshkent vaqti) keladi; bo'lmasa brauzer sanasi.
        const now = new Date();
        const list = keys?.length ? keys : Array.from({ length: 30 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29 + i);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        });
        const days = list.map(k => ({ k, v: byDay[k] || 0, label: Number(k.slice(8)) }));
        const max = Math.max(...days.map(d => d.v), 600);
        const total = days.reduce((a, d) => a + d.v, 0);
        if (!total) return '<div class="lh-muted">Oxirgi 30 kunda vaqt qayd etilmagan.</div>';
        const W = 600, H = 120, bw = W / days.length;
        return `<svg class="lh-chart" viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="Kunlik vaqt, jami ${dur(total)}">
            ${days.map((d, i) => { const h = Math.round((d.v / max) * H); return `<rect x="${i * bw + 2}" y="${H - h}" width="${bw - 4}" height="${Math.max(h, d.v ? 2 : 0)}" rx="2"><title>${d.k}: ${dur(d.v)}</title></rect>${i % 5 === 4 ? `<text x="${i * bw + bw / 2}" y="${H + 14}" text-anchor="middle">${d.label}</text>` : ''}`; }).join('')}
        </svg><div class="lh-muted">Jami 30 kunda: ${dur(total)}</div>`;
    }

    // ── Kitoblar: o'quvchi kitobi, ustoz kitobi, yordamchi qo'llanmasi ──────
    const BOOK_KINDS = [
        { id: 'book', label: "O'quvchi kitobi", add: 'book', pick: m => m.kind === 'book' },
        { id: 'teacher', label: 'Ustoz kitobi', add: 'teacher_book', pick: m => (m.kind === 'teacher_book' && !isAssistGuide(m)) || m.kind === 'methodology' },
        { id: 'assist', label: 'Yordamchi', add: 'teacher_book', pick: m => m.kind === 'teacher_book' && isAssistGuide(m) },
    ];
    function bookRange(m) {
        if (m.kind === 'book' || m.meta.lessonFrom) return `${m.meta.lessonFrom || 1}–${m.meta.lessonTo || 72}-darslar`;
        const nos = Object.keys(m.meta.pageMap || {}).map(Number).filter(Boolean);
        return nos.length ? `${Math.min(...nos)}–${Math.max(...nos)}-darslar` : (m.kind === 'methodology' ? 'metodika' : 'butun kurs');
    }
    const bookChipName = (m, i) => { const n = String(m.title).match(/(\d+)\s*-?\s*(qism|kitob|part)/i); return n ? `${n[1]}-kitob` : m.kind === 'book' ? `${i + 1}-kitob` : m.title; };

    function renderBooksView(main) {
        const hub = S.hub[S.lang];
        const kind = BOOK_KINDS.find(k => k.id === S.bookKind) || BOOK_KINDS[0];
        const files = hub.courseMaterials.filter(kind.pick).sort((a, b) => (a.meta.lessonFrom || 0) - (b.meta.lessonFrom || 0) || String(a.title).localeCompare(b.title));
        const st = S.bookState[S.lang] || {};
        const current = files.find(b => b.id === st.id) || files[0];
        const pm = current?.meta?.pageMap || {};
        const map = Object.entries(pm).map(([no, p]) => ({ no: Number(no), page: Number(p) })).sort((a, b) => a.no - b.no);
        main.innerHTML = `
        <div class="lh-book">
            <aside class="lh-card lh-book-list">
                <div class="lh-bk-pad">
                    <div class="lh-seg" role="tablist" aria-label="Kitob turi">${BOOK_KINDS.map(k => `<button type="button" role="tab" aria-selected="${k.id === kind.id}" data-bkind="${k.id}">${esc(k.label)}</button>`).join('')}</div>
                    ${files.length ? `<div class="lh-bchips">
                        ${files.map((b, i) => { const on = !!current && b.id === current.id; return `<button type="button" class="lh-bchip${on ? ' is-on' : ''}" data-book="${esc(b.id)}" aria-pressed="${on}" title="${esc(b.title)} · ${esc(bookRange(b))}"><b>${esc(bookChipName(b, i))}</b><small>${esc(on ? bookRange(b) : bookRange(b).replace(/-darslar$/, ''))}</small></button>`; }).join('')}
                    </div>` : `<div class="lh-empty-sm">${esc(kind.label)} hali yuklanmagan.${hub.canEdit ? ' "Ommaviy yuklash" orqali PDF yuklang — sahifalar avtomatik topiladi.' : ' Admin yuklaganda shu yerda chiqadi.'}</div>`}
                </div>
                ${current ? `<div class="lh-bk-grp"><span>Dars → sahifa</span>${hub.canEdit ? `<span class="lh-bk-ed"><button type="button" class="lh-bk-ic" data-edit="${esc(current.id)}" title="Kitobni tahrirlash yoki o\'chirish (nomi, darslar sahifasi)" aria-label="Tahrirlash: ${esc(current.title)}">✎</button></span>` : ''}</div>
                    ${map.length ? `<div class="lh-pmap">${map.map(r => `<button type="button" class="lh-pm" data-pm="${r.page}" data-pmno="${r.no}"><span class="lh-pm-n">${r.no}</span><b>${r.no}-dars</b><small>${r.page}-bet</small></button>`).join('')}</div>
                        <p class="lh-muted lh-pfoot">Sahifalar ommaviy yuklashda PDF ichidan avtomatik topilgan</p>`
                        : `<p class="lh-muted lh-pfoot">Darslar sahifasi belgilanmagan.${hub.canEdit ? ' ✎ tugmasi orqali kiriting ("1:5, 2:9").' : ''}</p>`}` : ''}
            </aside>
            <section class="lh-card lh-book-view" id="lhBookView">${current ? '' : '<div class="lh-empty-sm">Kitob tanlanmagan</div>'}</section>
        </div>
        ${kind.id === 'teacher' ? '<div id="lhGuideMore"></div>' : ''}`;
        bindMaterialActions(main, null);
        main.querySelectorAll('[data-bkind]').forEach(b => b.addEventListener('click', () => { S.bookKind = b.dataset.bkind; savePrefs(); renderBooksView(main); }));
        main.querySelectorAll('[data-book]').forEach(b => b.addEventListener('click', () => { S.bookState[S.lang] = { id: b.dataset.book, page: 1 }; renderBooksView(main); }));
        if (kind.id === 'teacher') renderGuideView(main.querySelector('#lhGuideMore'));
        if (!current) return;
        const view = main.querySelector('#lhBookView');
        if (!isLocalFile(current.url)) {
            view.innerHTML = `<div class="lh-empty-sm">Bu fayl tashqi havola — saytda ochib bo'lmaydi. ${safeUrl(current.url) ? `<a class="lh-btn" href="${esc(safeUrl(current.url))}" target="_blank" rel="noopener">Yangi oynada ochish</a>` : ''}</div>`;
            return;
        }
        const lessonAt = p => { let hit = null; for (const r of map) if (r.page <= p) hit = r; return hit; };
        const titleFor = p => {
            const r = lessonAt(p), idx = r ? map.indexOf(r) : -1;
            const to = idx >= 0 && map[idx + 1] ? map[idx + 1].page - 1 : null;
            return `<b>${esc(bookChipName(current, files.indexOf(current)))}${r ? ` · ${r.no}-dars` : ''}</b>${r ? `<span class="lh-pill-info">${r.page}${to && to > r.page ? `–${to}` : ''}-betlar</span>` : ''}`;
        };
        const page = st.id === current.id ? (st.page || 1) : (map[0]?.page || 1);
        LessonPresenter.mountPdfReader(view, {
            url: current.url, page, spread: true, title: titleFor(page),
            onPage: p => {
                S.bookState[S.lang] = { id: current.id, page: p };
                const t = view.querySelector('.lp-rttl'); if (t) t.innerHTML = titleFor(p);
                const r = lessonAt(p);
                main.querySelectorAll('[data-pmno]').forEach(x => x.classList.toggle('is-on', !!r && Number(x.dataset.pmno) === r.no));
            },
        }).then(reader => {
            S.reader = reader;
            main.querySelectorAll('[data-pm]').forEach(b => b.addEventListener('click', () => reader?.goTo(Number(b.dataset.pm))));
        });
    }

    // ── Ustoz kitobi: kurs qoidalari, og'zaki imtihonlar, 72 darslik reja ──
    function renderGuideView(main) {
        if (!main) return;        const hub = S.hub[S.lang];

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

    // ── Qo'shimcha materiallar (academic_materials, kind = extra) ───────────
    const EXTRA_PAGE = 8;
    function extraType(m) {
        const u = String(m.url || ''), mime = String(m.mime || '');
        if (/\.pdf(\?|$)/i.test(u) || mime === 'application/pdf') return { id: 'pdf', label: 'PDF', badge: 'PDF' };
        if (/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i.test(u) || mime.startsWith('audio/')) return { id: 'audio', label: 'Audio', badge: 'MP3' };
        if (!isLocalFile(u)) return { id: 'link', label: 'Havola', badge: 'URL' };
        if (/\.(mp4|webm|mov)(\?|$)/i.test(u) || mime.startsWith('video/')) return { id: 'other', label: 'Video', badge: 'MP4' };
        return { id: 'other', label: 'Fayl', badge: (u.split('.').pop() || 'FAYL').slice(0, 4).toUpperCase() };
    }
    const shortDate = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])}-${UZ_MONTHS[Number(m[2]) - 1].slice(0, 3)}` : '—'; };
    const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

    async function renderExtraView(main) {
        const hub = S.hub[S.lang];
        main.innerHTML = skeleton();
        let all;
        try { all = (await api(`/api/academic/materials?lang=${S.lang}`)).materials || []; }
        catch (e) { main.innerHTML = `<div class="lh-error"><b>Yuklab bo'lmadi</b><span>${esc(e.message)}</span></div>`; return; }
        if (S.view !== 'extra') return;
        // Eski "ilova hujjatlari" (mobile_content.documents) — shu jadvalda o'qish uchun qatorlar (js/app.js tpLegacyTextbookDocs).
        let legacy = [];
        try { legacy = typeof S.ctx.legacyDocs === 'function' ? S.ctx.legacyDocs(S.lang) || [] : []; } catch { legacy = []; }
        const list = [...all.filter(m => m.kind === 'extra'), ...legacy].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        const cnt = id => list.filter(m => extraType(m).id === id).length;
        const filters = [['all', 'Hammasi', list.length], ['pdf', 'PDF', cnt('pdf')], ['audio', 'Audio', cnt('audio')], ['link', 'Havola', cnt('link')]];
        if (cnt('other')) filters.push(['other', 'Boshqa', cnt('other')]);
        if (!filters.some(f => f[0] === S.extraFilter)) S.extraFilter = 'all';
        const shown = list.filter(m => S.extraFilter === 'all' || extraType(m).id === S.extraFilter);
        const pages = Math.max(1, Math.ceil(shown.length / EXTRA_PAGE));
        S.extraPage = Math.min(S.extraPage, pages - 1);
        const from = S.extraPage * EXTRA_PAGE, rows = shown.slice(from, from + EXTRA_PAGE);
        main.innerHTML = `
        <section class="lh-card lh-xm">
            <header class="lh-xm-h"><h3>Qo'shimcha materiallar</h3><span class="lh-gap"></span>
                <div class="lh-seg" role="group" aria-label="Turi">${filters.map(([k, l, n]) => `<button type="button" data-xf="${k}" aria-pressed="${S.extraFilter === k}">${esc(l)} ${n}</button>`).join('')}</div>
                ${hub.canEdit ? `<button type="button" class="lh-btn lh-primary" data-xadd>${ICO.plus} Material qo'shish</button>` : ''}</header>
            ${rows.length ? `<div class="lh-table-wrap"><table class="lh-table lh-xt"><thead><tr><th>Material</th><th>Turi</th><th>Qaysi darsga</th><th>Izoh</th><th>Yangilangan</th><th><span class="lh-sr">Amal</span></th></tr></thead><tbody>
                ${rows.map(m => { const t = extraType(m); const kb = m.fileSize ? `${m.fileSize >= 1048576 ? (m.fileSize / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(m.fileSize / 1024)) + ' KB'}` : '';
                    const dur = Number(m.meta?.durationSec) > 0 ? `${Math.floor(m.meta.durationSec / 60)}:${String(m.meta.durationSec % 60).padStart(2, '0')}` : '';
                    const size = t.id === 'audio' && dur ? dur : [Number(m.meta?.pages) > 0 ? `${m.meta.pages} bet` : '', kb].filter(Boolean).join(' · ');
                    return `<tr><td><span class="lh-xn"><span class="lh-xb is-${t.id}">${esc(t.badge)}</span><span><b>${esc(m.title)}</b><small>${esc(t.id === 'link' ? hostOf(m.url) : size || m.fileName || '')}</small></span></span></td>
                    <td>${esc(t.label)}</td><td>${m.lessonNo ? `${m.lessonNo}-dars` : 'Barcha darslar'}</td><td class="lh-muted">${esc(m.note || '—')}</td><td>${esc(shortDate(m.updatedAt))}</td>
                    <td class="lh-xa">${hub.canEdit && !m.legacy ? `<button type="button" class="lh-btn" data-edit="${esc(m.id)}">Tahrirlash</button>`
                        : safeUrl(m.url) ? (canPresent(m) ? `<button type="button" class="lh-btn" data-present-file="${esc(m.id)}"${m.legacy && hub.canEdit ? ' title="Ilova hujjati — Mobil ilova bo\'limida tahrirlanadi"' : ''}>Ochish</button>` : `<a class="lh-btn" href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener">Ochish</a>`) : ''}</td></tr>`; }).join('')}
            </tbody></table></div>` : `<div class="lh-empty-sm">${list.length ? "Bu turda material yo'q" : `Hali qo'shimcha material yo'q.${hub.canEdit ? " «Material qo'shish» orqali fayl yoki havola qo'shing." : ''}`}</div>`}
            <footer class="lh-xm-f">${shown.length ? `<span>${from + 1}–${from + rows.length} / ${shown.length}</span>` : ''}
                ${S.extraPage > 0 ? '<button type="button" class="lh-linkbtn" data-xp="-1">← oldingi</button>' : ''}${S.extraPage < pages - 1 ? '<button type="button" class="lh-linkbtn" data-xp="1">keyingi sahifa →</button>' : ''}
                <span class="lh-muted">· Kitoblar, ustoz kitobi va dars slaydlari "Ommaviy yuklash" orqali qo'shiladi — bu yerda faqat qo'shimcha materiallar.</span></footer>
        </section>`;
        const fake = { materials: list, lesson: null };
        bindMaterialActions(main, fake);
        main.querySelectorAll('[data-xf]').forEach(b => b.addEventListener('click', () => { S.extraFilter = b.dataset.xf; S.extraPage = 0; renderExtraView(main); }));
        main.querySelectorAll('[data-xp]').forEach(b => b.addEventListener('click', () => { S.extraPage += Number(b.dataset.xp); renderExtraView(main); }));
        main.querySelector('[data-xadd]')?.addEventListener('click', () => openExtraForm(() => renderExtraView(main)));
    }

    // Yangi qo'shimcha material: dars (yoki barcha darslar), fayl yoki havola.
    function openExtraForm(done) {
        const wrap = document.createElement('div');
        wrap.className = 'lh-modal';
        wrap.innerHTML = `<form class="lh-dialog" role="dialog" aria-modal="true" aria-labelledby="lhXTitle">
            <h3 id="lhXTitle">Qo'shimcha material</h3>
            <label>Nomi<input name="title" required maxlength="200" class="lh-input" placeholder="Masalan: To be — qo'shimcha mashqlar"></label>
            <label>Qaysi darsga<select name="lesson" class="lh-input"><option value="">Barcha darslar</option>${Array.from({ length: 72 }, (_, i) => `<option value="${i + 1}">${i + 1}-dars</option>`).join('')}</select></label>
            <div class="lh-seg" role="radiogroup" aria-label="Manba"><button type="button" data-xm="file" aria-pressed="true">Fayl</button><button type="button" data-xm="link" aria-pressed="false">Havola</button></div>
            <label data-xfile>Fayl (PDF, audio, rasm — 50 MB gacha)<input name="file" type="file" accept=".pdf,.mp3,.m4a,.wav,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,.mp4"></label>
            <label data-xlink hidden>Havola (https://…)<input name="url" type="url" class="lh-input" placeholder="https://"></label>
            <label>Izoh <span class="lh-muted">(ixtiyoriy)</span><input name="note" maxlength="300" class="lh-input" placeholder="Masalan: Jonli darsdan oldin"></label>
            <div class="lh-dialog-actions"><button type="button" class="lh-btn" data-cancel>Bekor qilish</button><button type="submit" class="lh-btn lh-primary">Saqlash</button></div>
            <div class="lh-progress" role="status" hidden>Yuklanmoqda…</div>
        </form>`;
        document.body.appendChild(wrap);
        const form = wrap.querySelector('form');
        const closeForm = trapModal(wrap);
        let mode = 'file';
        wrap.addEventListener('click', e => { if (e.target === wrap) closeForm(); });
        wrap.querySelector('[data-cancel]').onclick = closeForm;
        wrap.querySelectorAll('[data-xm]').forEach(b => b.onclick = () => {
            mode = b.dataset.xm;
            wrap.querySelectorAll('[data-xm]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            wrap.querySelector('[data-xfile]').hidden = mode !== 'file';
            wrap.querySelector('[data-xlink]').hidden = mode !== 'link';
        });
        form.querySelector('input[name="title"]').focus();
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const fd = new FormData(form);
            const btn = form.querySelector('[type="submit"]');
            btn.disabled = true;
            form.querySelector('.lh-progress').hidden = false;
            try {
                const lessonNo = fd.get('lesson') ? Number(fd.get('lesson')) : null;
                const body = { language: S.lang, lessonNo, kind: 'extra', title: String(fd.get('title') || '').trim(), note: String(fd.get('note') || '') };
                if (mode === 'link') {
                    body.url = String(fd.get('url') || '').trim();
                    if (!body.url) throw new Error('Havolani kiriting');
                } else {
                    const file = fd.get('file');
                    if (!file || !file.size) throw new Error('Fayl tanlang');
                    if (file.size > 50 * 1048576) throw new Error('Fayl 50 MB dan katta');
                    const up = await apiUploadFile(file);
                    Object.assign(body, { url: up.url, fileName: up.fileName || file.name, fileSize: up.fileSize || file.size, mime: up.mimeType || file.type });
                }
                await api('/api/academic/materials', { method: 'POST', body: JSON.stringify(body) });
                closeForm();
                invalidate(lessonNo);
                toast('Saqlandi');
                done?.();
            } catch (err) {
                btn.disabled = false;
                form.querySelector('.lh-progress').hidden = true;
                toast(err.message);
            }
        });
    }

    // Sahifa sarlavhasi izohi (Darslik / DarslikKitob / DarslikMaterial / DarslikProgress / YordamchiDarslik dizaynlari).
    (window.rdPageSubs ||= {}).textbook = ({ langLabel }) => {
        if (window.LessonStart?.isPureAssistant?.()) return "Darslik · yordamchi ustoz · faqat ko'rish va ko'rsatish";
        const v = VIEWS.find(x => x.id === S.view);
        return v && v.id !== 'lessons' && langLabel ? `Darslik · ${v.label} · ${langLabel}` : null;
    };

    window.LessonHub = { mount, buildSources, _state: S };

})();
