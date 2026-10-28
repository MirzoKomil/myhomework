// Akademik bo'lim → Elektron doska (UstozDoska / YordamchiDoska / Doska dizaynlari).
// Darsga bog'langan doskalar: bugungi har dars (yordamchida — aloqa) uchun bitta
// doska, shablonlar va erkin doskalar. Chizmalar vektor ko'rinishida
// (/api/academic/boards) avtomatik saqlanadi. Ustoz faqat o'z doskalarini
// ko'radi va yozadi; admin/boshliq/ROP — ustoz tanlab, faqat ko'radi.
(function () {
    'use strict';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const api = (p, o) => apiFetch(p, { timeout: 30000, ...(o || {}) });
    const toast = m => (typeof showMiniToast === 'function' ? showMiniToast(m, 2600) : null);
    const W = 1600, H = 1000;
    const COLORS = ['#0B1220', '#0065D6', '#D92D20', '#16A34A', '#E8740C'];
    const SIZES = [['Ingichka', 3], ["O'rta", 5], ['Qalin', 10]];
    const TEXT_SIZE = { 3: 30, 5: 44, 10: 68 };
    const MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const ic = p => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    const I = {
        pen: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>'),
        erase: ic('<path d="M20 20H9L4 15a2 2 0 010-2.8L13.2 3a2 2 0 012.8 0L21 8a2 2 0 010 2.8L12 20"/><path d="M6 11l7 7"/>'),
        line: ic('<path d="M5 19L19 5"/>'),
        rect: ic('<rect x="4" y="6" width="16" height="12" rx="1.5"/>'),
        text: ic('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
        ellipse: ic('<circle cx="12" cy="12" r="8"/>'),
        undo: ic('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>'),
        trash: ic('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
        check: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    };
    const TOOLS = [['pen', 'Qalam'], ['erase', "O'chirg'ich"]];
    const SHAPES = [['line', 'Chiziq'], ['rect', "To'rtburchak"], ['text', 'Matn'], ['ellipse', 'Doira']];

    const S = { el: null, lang: 'english', boards: [], canWrite: false, viewAll: false, teacherId: '', today: null, cur: null, items: [], undo: [],
        tool: 'pen', color: COLORS[0], size: 5, dirty: false, saving: false, saveTimer: null, savedAt: null, error: '', gen: 0, menu: false };
    const me = () => (typeof getCurrentUser === 'function' ? getCurrentUser() : null);
    const today = () => (window.LessonStart?.today ? window.LessonStart.today() : new Date().toISOString().slice(0, 10));
    const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
    const shortName = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || ''; };
    const dayLabel = d => { if (!d) return ''; if (d === today()) return 'bugun'; const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])}-${MON[Number(m[2]) - 1]}` : d; };
    const timeOf = iso => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)); } catch { return ''; } };
    const dateOfIso = iso => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); } catch { return ''; } };

    // ── Kirish nuqtasi ──────────────────────────────────────────────────────
    async function mount(container, ctx = {}) {
        if (S.el && S.el !== container) await flush();
        S.el = container;
        S.lang = ctx.lang === 'russian' ? 'russian' : 'english';
        const user = me();
        S.viewAll = user?.role !== 'teacher';
        const gen = ++S.gen;
        container.classList.add('wb-host');
        container.innerHTML = '<div class="wb"><div class="wb-skel"></div></div>';
        try {
            const [list, today] = await Promise.all([
                api(`/api/academic/boards?lang=${S.lang}`),
                !S.viewAll && window.LessonStart ? window.LessonStart.loadToday().catch(() => null) : null,
            ]);
            if (gen !== S.gen) return;
            S.boards = list.boards || [];
            S.canWrite = !!list.canWrite;
            S.today = today;
            if (S.viewAll && !S.teacherId) {
                // Doska (admin) dizayni: avval asosiy ustoz doskasi (eng so'nggi), bo'lmasa — istalgani.
                const own = S.boards.find(b => b.kind === 'board' && b.duty === 'main') || S.boards.find(b => b.kind === 'board');
                if (own) S.teacherId = own.ownerId;
            }
            if (S.viewAll && S.teacherId) await loadTeacherToday(S.teacherId);
        } catch (e) {
            container.innerHTML = `<div class="wb"><div class="lh-error"><b>Doskalarni yuklab bo'lmadi</b><span>${esc(e.message)}</span><button type="button" class="lh-btn" data-retry>Qayta urinish</button></div></div>`;
            container.querySelector('[data-retry]').onclick = () => mount(container, ctx);
            return;
        }
        const chips = chipList();
        const keep = S.cur && chips.find(c => c.key === S.cur.key);
        await select(keep || defaultChip(chips), { silent: true });
        draw();
    }

    // Admin/boshliq/ROP: tanlangan ustozning bugungi darslari (dars jadvali) — doska hali ochilmagan bo'lsa ham chip chiqadi
    // ("Malika · 22-dars · bugun 18:00 · hali bo'sh"). Faqat ko'rish; ma'lumot /api/school/schedule va next-lessons'dan.
    const adminToday = {};
    async function loadTeacherToday(teacherId) {
        const d = today();
        const key = `${teacherId}|${d}`;
        if (adminToday[key]) return adminToday[key];
        let items = [];
        try {
            const r = await api(`/api/school/schedule?from=${d}&to=${d}`);
            const v = (r.views || []).find(x => x.teacherId === teacherId && (!x.date || x.date === d));
            items = (v?.items || []).filter(i => i.studentId && (i.kind === 'lesson' || i.kind === 'makeup'))
                .map(i => ({ studentId: i.studentId, studentName: i.studentName || '', start: i.start, end: i.end })).sort((a, b) => a.start - b.start);
            const ids = [...new Set(items.map(i => i.studentId))].slice(0, 60);
            if (ids.length) {
                const nl = (await api(`/api/academic/next-lessons?ids=${encodeURIComponent(ids.join(','))}`).catch(() => ({}))).lessons || {};
                for (const it of items) {
                    const l = nl[it.studentId];
                    if (!l) continue;
                    // Yagona qoida — server (liveLessonPick: tarix + ilovadagi o'rin); bu yerda qayta hisoblanmaydi.
                    it.lessonNo = l.nextLive?.no || null;
                }
            }
        } catch { items = []; }
        adminToday[key] = { assistant: false, items };
        return adminToday[key];
    }
    // Chip izohi: doskaning nomi (mavzu), masalan "bugun 10:00 · to be".
    const boardTopic = b => { const t = String(b?.title || '').trim(); return t && !/^doska$/i.test(t) ? t : ''; };

    // Chiplar: bugungi darslar (bo'sh bo'lsa ham), qolgan doskalar, shablonlar.
    function chipList() {
        const out = [];
        const d = today();
        const boards = S.boards.filter(b => b.kind === 'board' && (!S.viewAll || !S.teacherId || b.ownerId === S.teacherId));
        const used = new Set();
        const todayData = S.viewAll ? (S.teacherId ? adminToday[`${S.teacherId}|${d}`] : null) : S.today;
        if (todayData) {
            // Yordamchi (YordamchiDoska dizayni): bajarilmagan aloqalar oldin, bajarilganlar keyin (eng so'nggisi birinchi).
            const its = todayData.assistant ? [...todayData.items].sort((a, b) => (!!a.done - !!b.done) || (a.done ? b.start - a.start : a.start - b.start)) : todayData.items;
            for (const it of its) {
                const b = boards.find(x => x.studentId === it.studentId && x.lessonDate === d);
                if (b) used.add(b.id);
                const assist = todayData.assistant;
                // Doska ochilgan bo'lsa — uning darsi (doska shu dars uchun ochilgan), aks holda jadvaldagi navbatdagi dars.
                const no = (!assist && b?.lessonNo) || it.lessonNo || null;
                out.push({ key: b ? b.id : `v:${it.studentId}`, board: b || null, virtual: !b, studentId: it.studentId, studentName: it.studentName,
                    lessonNo: no, lessonDate: d, start: it.start, assist,
                    name: `${firstName(it.studentName)} · ${assist ? 'aloqa' : no ? `${no}-dars` : 'dars'}`,
                    sub: `bugun ${hm(it.start)} · ${assist && it.done ? 'bajarildi' : assist && it.noAnswer ? 'javob bermadi' : b && b.itemCount ? (boardTopic(b) || 'saqlangan') : "hali bo'sh"}` });
            }
        }
        for (const b of boards) {
            if (used.has(b.id)) continue;
            out.push({ key: b.id, board: b, studentId: b.studentId, studentName: b.studentName, lessonNo: b.lessonNo, lessonDate: b.lessonDate,
                name: b.studentName ? `${firstName(b.studentName)}${b.duty === 'assistant' ? ' · aloqa' : b.lessonNo ? ` · ${b.lessonNo}-dars` : ''}` : b.title,
                sub: b.lessonDate ? `${dayLabel(b.lessonDate)}${b.itemCount ? '' : " · bo'sh"}` : `${dayLabel(dateOfIso(b.updatedAt))} · erkin` });
        }
        for (const t of S.boards.filter(b => b.kind === 'template')) {
            out.push({ key: t.id, board: t, template: true, name: t.title, sub: !S.viewAll && t.ownerId !== currentTeacherId() ? `${shortName(t.ownerName)} shabloni` : 'shablon' });
        }
        return out;
    }
    // Birinchi ochilishda: bugungi chiplardan eng so'nggi o'zgartirilgan doska (ustoz shu doskada ishlayotgan), bo'lmasa — birinchi chip.
    function defaultChip(chips) {
        const d = today();
        const withBoard = chips.filter(c => !c.template && c.board && c.lessonDate === d).sort((a, b) => String(b.board.updatedAt).localeCompare(String(a.board.updatedAt)));
        return withBoard[0] || chips[0] || null;
    }
    const currentTeacherId = () => me()?.linkedTeacherId || '';
    const canEditCur = () => !S.viewAll && S.canWrite && S.cur && (S.cur.virtual || S.cur.board?.ownerId === currentTeacherId());

    async function select(chip, { silent = false } = {}) {
        if (S.cur && chip && S.cur.key === chip.key && !silent) return;
        await flush();
        S.cur = chip;
        S.items = []; S.undo = []; S.savedAt = chip?.board?.updatedAt || null; S.error = '';
        if (chip?.board) {
            try {
                const r = await api(`/api/academic/boards/${encodeURIComponent(chip.board.id)}`);
                S.items = r.board.data?.items || [];
                S.cur.board = { ...chip.board, ...r.board };
            } catch (e) { S.error = e.message; }
        }
        if (!silent) draw();
    }

    // ── Chizish ─────────────────────────────────────────────────────────────
    function render(ctx, items, scale) {
        ctx.save();
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.clearRect(0, 0, W, H);
        for (const it of items) paint(ctx, it);
        ctx.restore();
    }
    function paint(ctx, it) {
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = it.c; ctx.fillStyle = it.c; ctx.lineWidth = it.w;
        if (it.t === 'pen' || it.t === 'erase') {
            if (it.t === 'erase') { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = it.w; }
            const p = it.p;
            ctx.beginPath();
            ctx.moveTo(p[0], p[1]);
            if (p.length === 2) ctx.lineTo(p[0] + 0.1, p[1]);
            for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
            ctx.stroke();
        } else if (it.t === 'line' || it.t === 'arrow') {
            ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke();
            if (it.t === 'arrow') { // saqlangan "arrow" elementlari (server qabul qiladi) — uchi bilan
                const a = Math.atan2(it.y2 - it.y1, it.x2 - it.x1), L = 10 + it.w * 3;
                ctx.beginPath(); ctx.moveTo(it.x2 - L * Math.cos(a - 0.5), it.y2 - L * Math.sin(a - 0.5)); ctx.lineTo(it.x2, it.y2);
                ctx.lineTo(it.x2 - L * Math.cos(a + 0.5), it.y2 - L * Math.sin(a + 0.5)); ctx.stroke();
            }
        } else if (it.t === 'rect') {
            const x = Math.min(it.x1, it.x2), y = Math.min(it.y1, it.y2), w = Math.abs(it.x2 - it.x1), h = Math.abs(it.y2 - it.y1);
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, w, h, 10); else ctx.rect(x, y, w, h);
            ctx.stroke();
        } else if (it.t === 'ellipse') {
            ctx.beginPath();
            ctx.ellipse((it.x1 + it.x2) / 2, (it.y1 + it.y2) / 2, Math.abs(it.x2 - it.x1) / 2, Math.abs(it.y2 - it.y1) / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (it.t === 'text') {
            ctx.font = `700 ${it.f}px "Plus Jakarta Sans", system-ui, sans-serif`;
            ctx.textBaseline = 'top';
            String(it.s).split('\n').forEach((ln, i) => ctx.fillText(ln, it.x, it.y + i * it.f * 1.2));
        }
        ctx.restore();
    }

    function draw() {
        const el = S.el;
        if (!el) return;
        const chips = chipList();
        const cur = S.cur;
        const ro = !canEditCur();
        const teachers = S.viewAll ? teacherOptions() : [];
        const linkTxt = linkText(cur);
        el.innerHTML = `
        <div class="wb">
            <div class="wb-bar">
                ${S.viewAll ? `<label class="wb-tsel"><span>Ustoz: ${esc((teachers.find(t => t.id === S.teacherId) || {}).name || '—')} ▾</span><select data-teacher aria-label="Ustoz">${teachers.map(t => `<option value="${esc(t.id)}"${t.id === S.teacherId ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}
                <div class="wb-chips" role="tablist" aria-label="Doskalar">
                    ${chips.map(c => `<button type="button" role="tab" class="wb-chip${cur && c.key === cur.key ? ' is-on' : ''}${c.template ? ' is-tpl' : ''}" data-chip="${esc(c.key)}" aria-selected="${!!cur && c.key === cur.key}"><b>${esc(c.name)}</b><small>${esc(c.sub)}</small></button>`).join('')}
                    ${!chips.length ? `<span class="wb-none">${S.viewAll ? "Bu ustozda hali doska yo'q" : "Bugun dars yo'q — yangi doska oching"}</span>` : ''}
                </div>
                ${!S.viewAll ? `<div class="wb-new"><button type="button" class="wb-newbtn" data-new aria-haspopup="true" aria-expanded="${S.menu}">+ Yangi doska</button>
                    <div class="wb-menu" role="menu"${S.menu ? '' : ' hidden'}>
                        <button type="button" role="menuitem" data-mk="blank">Toza doska</button>
                        ${S.boards.filter(b => b.kind === 'template').map(t => `<button type="button" role="menuitem" data-mk="tpl" data-tpl="${esc(t.id)}">Shablondan: ${esc(t.title)}</button>`).join('')}
                        <span class="wb-msep"></span>
                        <button type="button" role="menuitem" data-mk="save-tpl"${S.items.length ? '' : ' disabled'}>Joriy doskani shablon qilib saqlash</button>
                        ${cur?.board && cur.board.ownerId === currentTeacherId() ? `<button type="button" role="menuitem" data-mk="del" class="is-danger">${cur.template ? "Shablonni o'chirish" : "Doskani o'chirish"}</button>` : ''}
                    </div></div>` : ''}
            </div>
            <section class="wb-card${ro ? ' is-ro' : ''}">
                <div class="wb-tools" role="toolbar" aria-label="Doska asboblari">
                    <div class="wb-g">${TOOLS.map(([t, l]) => `<button type="button" class="wb-tb${S.tool === t ? ' is-on' : ''}" data-tool="${t}" title="${l}" aria-label="${l}" aria-pressed="${S.tool === t}"${ro ? ' disabled' : ''}>${I[t]}</button>`).join('')}</div>
                    <div class="wb-g">${SHAPES.map(([t, l]) => `<button type="button" class="wb-tb${S.tool === t ? ' is-on' : ''}" data-tool="${t}" title="${l}" aria-label="${l}" aria-pressed="${S.tool === t}"${ro ? ' disabled' : ''}>${I[t]}</button>`).join('')}</div>
                    <div class="wb-g">${COLORS.map(c => `<button type="button" class="wb-col${S.color === c ? ' is-on' : ''}" data-color="${c}" aria-label="Rang ${c}" aria-pressed="${S.color === c}"${ro ? ' disabled' : ''}><i style="background:${c}"></i></button>`).join('')}</div>
                    <div class="wb-g wb-sizes">${SIZES.map(([l, v]) => `<button type="button" class="wb-sz${S.size === v ? ' is-on' : ''}" data-size="${v}" aria-pressed="${S.size === v}"${ro ? ' disabled' : ''}>${l}</button>`).join('')}</div>
                    <div class="wb-g"><button type="button" class="wb-tb" data-act="undo" title="Ortga (Ctrl+Z)" aria-label="Ortga"${ro ? ' disabled' : ''}>${I.undo}</button><button type="button" class="wb-tb" data-act="clear" title="Doskani tozalash" aria-label="Doskani tozalash"${ro ? ' disabled' : ''}>${I.trash}</button></div>
                    <span class="wb-flex"></span>
                    ${ro ? `<span class="wb-ro">${S.viewAll ? "Faqat ko'rish · ustoz doskasi" : "Faqat ko'rish · boshqa ustoz shabloni"}</span>` : `<span class="wb-auto">${I.check} Avtomatik saqlanadi</span>`}
                </div>
                <div class="wb-stage">
                    ${cur ? '<canvas class="wb-canvas" aria-label="Elektron doska"></canvas><textarea class="wb-text" rows="1" hidden aria-label="Matn"></textarea>' : `<div class="wb-empty">${S.viewAll ? 'Ustozni tanlang' : "Doska tanlang yoki «+ Yangi doska»ni bosing"}</div>`}
                    ${S.error ? `<div class="wb-err">${esc(S.error)}</div>` : ''}
                </div>
                <footer class="wb-foot"><span>${linkTxt}</span>${cur && cur.studentId && !cur.template ? `<span aria-hidden="true">·</span><span>"Darsni boshlash" rejimida doska slaydlar yonida ham ochiladi</span>` : ''}<span class="wb-flex"></span><span class="wb-saved${S.viewAll ? ' is-view' : ''}" aria-live="polite">${savedText()}</span></footer>
            </section>
        </div>`;
        bind();
        if (cur) setupCanvas();
    }

    function teacherOptions() {
        const emps = typeof getItem === 'function' ? getItem(STORAGE_KEYS.hrEmployees, []) : [];
        const fits = e => ['ingliz-oqituvchi', 'rus-oqituvchi', 'oqituvchi', 'yordamchi'].includes(e.role) && e.status !== 'inactive'
            && (e.role === 'rus-oqituvchi' ? 'russian' : e.role === 'ingliz-oqituvchi' ? 'english' : (e.lang || 'english')) === S.lang;
        const counts = {};
        for (const b of S.boards) if (b.kind === 'board') counts[b.ownerId] = (counts[b.ownerId] || 0) + 1;
        const list = emps.filter(fits).map(e => ({ id: e.id, name: e.name, n: counts[e.id] || 0 }));
        for (const b of S.boards) if (b.kind === 'board' && !list.some(t => t.id === b.ownerId)) list.push({ id: b.ownerId, name: b.ownerName || b.ownerId, n: counts[b.ownerId] });
        list.sort((a, b) => (b.n > 0) - (a.n > 0) || a.name.localeCompare(b.name));
        if (!S.teacherId && list[0]) S.teacherId = list[0].id;
        return list;
    }

    function linkText(c) {
        if (!c) return '';
        if (c.template) return `<b>Shablon</b> · shu tildagi barcha ustozlar ishlata oladi${c.board?.ownerName ? ` · muallif: ${esc(c.board.ownerName)}` : ''}`;
        if (!c.studentId) return "Erkin doska — darsga bog'lanmagan";
        const st = c.start != null ? ` (${dayLabel(c.lessonDate)} ${hm(c.start)})` : c.lessonDate ? ` (${dayLabel(c.lessonDate)})` : '';
        const assist = c.assist || c.board?.duty === 'assistant';
        return assist
            ? `Mashg'ulotga bog'langan: <b>${esc(c.studentName || '')}${c.lessonDate ? ` · ${esc(dayLabel(c.lessonDate))}${c.start != null ? ' ' + hm(c.start) : ''}` : ''}${c.lessonNo ? ` · ${c.lessonNo}-dars mavzusi` : ''}</b>`
            : `Darsga bog'langan: <b>${esc(c.studentName || '')}${c.lessonNo ? ` · ${c.lessonNo}-dars · ${c.lessonNo % 2 === 0 ? 'jonli' : 'video'}` : ''}${st}</b>`;
    }
    function savedText() {
        if (S.viewAll) {
            const b = S.cur?.board;
            return b?.updatedAt ? `Oxirgi o'zgarish: ${esc(shortName(b.updatedByName || b.ownerName))}, ${esc(dayLabel(dateOfIso(b.updatedAt)))} ${esc(timeOf(b.updatedAt))}` : '';
        }
        if (S.error && S.dirty) return `<span class="wb-bad">Saqlanmadi — qayta urinilmoqda</span>`;
        if (S.saving || S.dirty) return 'Saqlanmoqda…';
        if (S.savedAt) return `Avtomatik saqlandi · ${esc(timeOf(S.savedAt))}`;
        return S.cur?.virtual ? 'Chizishni boshlang — o\'zi saqlanadi' : '';
    }
    const setSaved = () => { const x = S.el?.querySelector('.wb-saved'); if (x) x.innerHTML = savedText(); };

    function bind() {
        const el = S.el;
        el.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', async () => {
            const chip = chipList().find(c => c.key === b.dataset.chip);
            if (!chip) return;
            S.menu = false;
            await select(chip);
        }));
        el.querySelector('[data-teacher]')?.addEventListener('change', async e => { S.teacherId = e.target.value; S.cur = null; await loadTeacherToday(S.teacherId); await select(defaultChip(chipList()), { silent: true }); draw(); });
        el.querySelector('[data-new]')?.addEventListener('click', () => { S.menu = !S.menu; const m = el.querySelector('.wb-menu'); m.hidden = !S.menu; el.querySelector('[data-new]').setAttribute('aria-expanded', String(S.menu)); });
        el.querySelectorAll('[data-mk]').forEach(b => b.addEventListener('click', () => menuAction(b.dataset.mk, b.dataset.tpl)));
        el.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => { S.tool = b.dataset.tool; syncTools(); }));
        el.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => { S.color = b.dataset.color; if (S.tool === 'erase') S.tool = 'pen'; syncTools(); }));
        el.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { S.size = Number(b.dataset.size); syncTools(); }));
        el.querySelector('[data-act="undo"]')?.addEventListener('click', undo);
        el.querySelector('[data-act="clear"]')?.addEventListener('click', () => {
            if (!S.items.length || !confirm("Doskadagi hamma chizmalar o'chirilsinmi? (Ortga tugmasi bilan qaytarish mumkin)")) return;
            pushUndo(); S.items = []; changed();
        });
    }
    function syncTools() {
        const el = S.el;
        el.querySelectorAll('[data-tool]').forEach(b => { const on = b.dataset.tool === S.tool; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
        el.querySelectorAll('[data-color]').forEach(b => { const on = b.dataset.color === S.color; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
        el.querySelectorAll('[data-size]').forEach(b => { const on = Number(b.dataset.size) === S.size; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
        const cv = el.querySelector('.wb-canvas');
        if (cv) cv.style.cursor = S.tool === 'text' ? 'text' : 'crosshair';
    }

    async function menuAction(kind, tplId) {
        S.menu = false;
        S.el.querySelector('.wb-menu')?.setAttribute('hidden', '');
        try {
            if (kind === 'blank' || kind === 'tpl') {
                // Bo'sh bugungi doskaga shablon — shu doskaning o'ziga qo'llanadi.
                if (kind === 'tpl' && S.cur && !S.cur.template && canEditCur() && !S.items.length) {
                    const r = await api(`/api/academic/boards/${encodeURIComponent(tplId)}`);
                    pushUndo(); S.items = r.board.data?.items || []; changed(); draw();
                    return;
                }
                await flush();
                const d = today();
                const body = { title: `Doska · ${dayLabel(d) === 'bugun' ? `${Number(d.slice(8))}-${MON[Number(d.slice(5, 7)) - 1]}` : dayLabel(d)}` };
                if (kind === 'tpl') body.fromId = tplId;
                const r = await api('/api/academic/boards', { method: 'POST', body: JSON.stringify(body) });
                S.boards.unshift(r.board);
                S.cur = null;
                await select(chipList().find(c => c.key === r.board.id), {});
            } else if (kind === 'save-tpl') {
                const title = prompt('Shablon nomi (masalan: "To be · jadval")', S.cur?.name || 'Shablon');
                if (!title) return;
                const r = await api('/api/academic/boards', { method: 'POST', body: JSON.stringify({ kind: 'template', title, data: { items: S.items } }) });
                S.boards.push(r.board);
                toast('Shablon saqlandi');
                draw();
            } else if (kind === 'del') {
                const b = S.cur?.board;
                if (!b || !confirm(`${S.cur.template ? 'Shablon' : 'Doska'} o'chirilsinmi?`)) return;
                clearTimeout(S.saveTimer); S.dirty = false;
                await api(`/api/academic/boards/${encodeURIComponent(b.id)}`, { method: 'DELETE' });
                S.boards = S.boards.filter(x => x.id !== b.id);
                S.cur = null;
                const chips = chipList();
                await select(chips[0] || null, { silent: true });
                draw();
            }
        } catch (e) { toast(e.message); }
    }

    // ── Kanvas ──────────────────────────────────────────────────────────────
    let cv = null, cctx = null, scale = 1, drawing = null;
    function setupCanvas() {
        cv = S.el.querySelector('.wb-canvas');
        cctx = cv.getContext('2d');
        const resize = () => {
            const stage = S.el?.querySelector('.wb-stage');
            if (!stage || !cv.isConnected) return;
            const w = Math.max(280, stage.clientWidth);
            const h = Math.round(w * H / W);
            const dpr = window.devicePixelRatio || 1;
            cv.style.width = w + 'px'; cv.style.height = h + 'px';
            cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
            scale = cv.width / W;
            render(cctx, S.items, scale);
        };
        resize();
        if (!S._ro) {
            S._ro = new ResizeObserver(() => { if (cv?.isConnected) { const w = S.el.querySelector('.wb-stage')?.clientWidth; if (w && Math.abs(w - parseFloat(cv.style.width)) > 2) resize(); } });
        }
        S._ro.disconnect();
        S._ro.observe(S.el.querySelector('.wb-stage'));
        syncTools();
        if (!canEditCur()) { cv.style.cursor = 'default'; return; }
        const pos = e => { const r = cv.getBoundingClientRect(); return { x: Math.round((e.clientX - r.left) / r.width * W * 10) / 10, y: Math.round((e.clientY - r.top) / r.height * H * 10) / 10 }; };
        cv.addEventListener('pointerdown', e => {
            if (e.button && e.button !== 0) return;
            const p = pos(e);
            if (S.tool === 'text') { e.preventDefault(); openText(p); return; }
            e.preventDefault();
            cv.setPointerCapture(e.pointerId);
            if (S.tool === 'pen' || S.tool === 'erase') drawing = { t: S.tool, c: S.color, w: S.tool === 'erase' ? S.size * 5 : S.size, p: [p.x, p.y] };
            else drawing = { t: S.tool, c: S.color, w: S.size, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
            render(cctx, [...S.items, drawing], scale);
        });
        cv.addEventListener('pointermove', e => {
            if (!drawing) return;
            const p = pos(e);
            if (drawing.p) {
                const n = drawing.p.length;
                if (Math.hypot(p.x - drawing.p[n - 2], p.y - drawing.p[n - 1]) < 1.5) return;
                drawing.p.push(p.x, p.y);
            } else { drawing.x2 = p.x; drawing.y2 = p.y; }
            render(cctx, [...S.items, drawing], scale);
        });
        const end = () => {
            if (!drawing) return;
            const d = drawing; drawing = null;
            if (!d.p && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 4) { render(cctx, S.items, scale); return; }
            pushUndo(); S.items.push(d); changed();
        };
        cv.addEventListener('pointerup', end);
        cv.addEventListener('pointercancel', end);
    }
    function openText(p) {
        const ta = S.el.querySelector('.wb-text');
        const r = cv.getBoundingClientRect(), stage = S.el.querySelector('.wb-stage').getBoundingClientRect();
        const f = TEXT_SIZE[S.size] || 44;
        ta.hidden = false;
        ta.value = '';
        ta.style.left = (r.left - stage.left + p.x / W * r.width) + 'px';
        ta.style.top = (r.top - stage.top + p.y / H * r.height) + 'px';
        ta.style.fontSize = Math.max(12, f / W * r.width) + 'px';
        ta.style.color = S.color;
        ta.focus();
        const commit = () => {
            ta.removeEventListener('blur', commit);
            const s = ta.value.trim();
            ta.hidden = true;
            if (!s) return;
            pushUndo(); S.items.push({ t: 'text', c: S.color, w: S.size, x: p.x, y: p.y, s: s.slice(0, 300), f }); changed();
        };
        ta.onkeydown = e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ta.blur(); }
            else if (e.key === 'Escape') { ta.value = ''; ta.blur(); }
        };
        ta.addEventListener('blur', commit);
    }
    function pushUndo() { S.undo.push(S.items.slice()); if (S.undo.length > 60) S.undo.shift(); }
    function undo() { if (!S.undo.length || !canEditCur()) return; S.items = S.undo.pop(); changed(); }
    function changed() {
        if (cctx) render(cctx, S.items, scale);
        S.dirty = true;
        setSaved();
        clearTimeout(S.saveTimer);
        S.saveTimer = setTimeout(save, 1200);
        const menuTpl = S.el?.querySelector('[data-mk="save-tpl"]');
        if (menuTpl) menuTpl.disabled = !S.items.length;
    }

    // ── Saqlash ─────────────────────────────────────────────────────────────
    async function save() {
        clearTimeout(S.saveTimer);
        if (!S.dirty || S.saving || !S.cur || !canEditCur()) return;
        S.saving = true;
        const cur = S.cur, items = S.items.slice();
        try {
            if (cur.virtual) {
                const r = await api('/api/academic/boards', { method: 'POST', body: JSON.stringify({ studentId: cur.studentId, lessonDate: cur.lessonDate, lessonNo: cur.lessonNo, title: cur.name, data: { items } }) });
                cur.virtual = false; cur.board = r.board; cur.key = r.board.id;
                S.boards.unshift(r.board);
                S.savedAt = r.board.updatedAt;
                // Chip kalitini yangilaymiz (bosilsa qayta yuklamasin).
                const chip = S.el?.querySelector(`[data-chip="v:${CSS.escape(cur.studentId)}"]`);
                if (chip) { chip.dataset.chip = r.board.id; const sm = chip.querySelector('small'); if (sm) sm.textContent = sm.textContent.replace("hali bo'sh", 'saqlangan'); }
                if (S.cur === cur && S.items.length === items.length) S.dirty = false;
            } else {
                const r = await api(`/api/academic/boards/${encodeURIComponent(cur.board.id)}`, { method: 'PUT', body: JSON.stringify({ data: { items } }) });
                S.savedAt = r.updatedAt;
                const b = S.boards.find(x => x.id === cur.board.id); if (b) { b.updatedAt = r.updatedAt; b.itemCount = r.itemCount; }
                if (S.cur === cur && S.items.length === items.length && S.items.every((x, i) => x === items[i])) S.dirty = false;
            }
            S.error = '';
        } catch (e) {
            S.error = e.message;
            if (e.status === 403 || e.status === 413 || e.status === 400) { S.dirty = false; toast(e.message); }
        } finally {
            S.saving = false;
            setSaved();
            if (S.dirty) S.saveTimer = setTimeout(save, S.error ? 5000 : 800);
        }
    }
    async function flush() {
        if (!S.dirty) return;
        clearTimeout(S.saveTimer);
        for (let i = 0; i < 3 && (S.dirty || S.saving); i++) {
            if (S.saving) await new Promise(r => setTimeout(r, 300));
            else await save();
            if (S.error) break;
        }
    }
    window.addEventListener('beforeunload', e => { if (S.dirty) { save(); e.preventDefault(); e.returnValue = ''; } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && S.dirty) save(); });
    document.addEventListener('keydown', e => {
        if (!S.el?.isConnected || !S.el.offsetParent) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.closest?.('input,textarea,select')) { e.preventDefault(); undo(); }
    });

    // Sahifa sarlavhasi izohi: yordamchi ustozda "Elektron doska · yordamchi ustoz" (YordamchiDoska dizayni).
    (window.rdPageSubs ||= {}).whiteboard = () => (window.LessonStart?.isPureAssistant?.() ? 'Elektron doska · yordamchi ustoz' : null);

    window.Whiteboard = { mount, flush, render, _state: S };
})();
