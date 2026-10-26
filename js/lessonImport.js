// Darslik markazi — ommaviy yuklash (faqat admin/boshliq).
// Bir martada ko'p fayl yoki butun papka tanlanadi. Tizim:
//  • PDF ichidan har sahifaning sarlavhasini o'qib, "N-DARS · VIDEODARS/JONLI DARS"
//    yoki "N–M-DARSLAR · YORDAMCHI USTOZ" belgilaridan darslar sahifa xaritasini
//    tuzadi va faylni kitob / Teacher's book / qo'llanma deb taniydi;
//  • slayd fayllarini nomidagi (yoki papka nomidagi) raqam bo'yicha darsga
//    biriktiradi, turini nomidan yoki dars juft/toqligidan aniqlaydi;
//  • yuklashdan oldin jadvalda ko'rsatadi — har qatorni tuzatish mumkin;
//  • allaqachon yuklangan (shu dars + tur + fayl nomi) faylni takrorlamaydi.
(function () {
    'use strict';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const LESSON_KINDS = { live_slides: 'Jonli dars slaydlari', video_slides: 'Videodars slaydlari', grammar_slides: 'Grammatika slaydlari', lesson_plan: 'Dars rejasi (ustoz)', teacher_guide: "Ustoz qo'llanmasi", extra: "Qo'shimcha material" };
    const COURSE_KINDS = { book: 'Darslik kitobi (PDF)', teacher_book: "Teacher's book", methodology: 'Metodika / qo\'llanma' };
    const LARGE = new Set(['book', 'teacher_book', 'methodology']);
    const ACCEPT = '.pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.mp4';

    // ── Fayl nomidan dars raqami va turi ───────────────────────────────────
    const COURSE_WORDS = /xarita|ma.?lumotnoma|malumotnoma|qo.?llanma|qollanma|guide|teacher|ustoz.?kitob|mundarija|metodika|darslik|qism/i;
    function guessFromName(path) {
        const base = String(path).split(/[\\/]/).pop().replace(/\.[^.]+$/, '').replace(/^[0-9a-f]{8}-/, '');
        const full = String(path).replace(/\.[^.]+$/, '').toLowerCase();
        const pats = [/(\d{1,2})\s*[-_. ]?\s*dars/i, /dars\s*[-_. ]?\s*(\d{1,2})/i, /\bl\s*[-_]?(\d{1,2})\b/i, /lesson\s*[-_ ]?(\d{1,2})/i, /урок\s*[-_ ]?(\d{1,2})/i];
        let no = null;
        for (const src of [base, full]) {
            for (const re of pats) { const m = src.match(re); if (m) { no = Number(m[1]); break; } }
            if (no) break;
        }
        if (!no) { const m = base.match(/(?:^|\D)(\d{1,2})(?:\D|$)/); if (m) no = Number(m[1]); }
        if (!(no >= 1 && no <= 72) || (COURSE_WORDS.test(base) && !/slayd|slide/i.test(base))) no = null;
        let kind = null;
        if (/grammat|грамматик/.test(full)) kind = 'grammar_slides';
        else if (/video|видео/.test(full)) kind = 'video_slides';
        else if (/jonli|live|жив/.test(full)) kind = 'live_slides';
        else if (/reja|plan/.test(full)) kind = 'lesson_plan';
        else if (no) kind = no % 2 === 0 ? 'live_slides' : 'video_slides';
        return { no, kind, base };
    }

    // Avval fayl nomi, keyin PDF ichidagi belgi (scan) hal qiladi.
    function guessCourseKind(name, scan) {
        const n = name.toLowerCase();
        if (/teacher|ustoz.?kitob|yordamchi|qo.?llanma|qollanma|guide/.test(n)) return 'teacher_book';
        if (/qism|darslik|book|kitob/.test(n)) return scan?.pageMap && Object.keys(scan.pageMap).length ? 'book' : 'methodology';
        if (scan && Object.keys(scan.pageMap).length >= 3) return scan.looksTeacher ? 'teacher_book' : 'book';
        return 'methodology';
    }

    // ── PDF sarlavhalaridan darslar sahifa xaritasi (pdf.js) ────────────────
    async function scanPdf(file, onProgress) {
        if (typeof _ensurePdfJsLoaded === 'function') await _ensurePdfJsLoaded();
        const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
        const map = {}, kinds = new Set();
        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p);
            const tc = await page.getTextContent();
            // Yuqoridagi qatorlar: y koordinatasi bo'yicha eng yuqori elementlar.
            const items = tc.items.filter(i => i.str && i.str.trim());
            const top = items.length ? Math.max(...items.map(i => i.transform[5])) : 0;
            const head = items.filter(i => i.transform[5] >= top - 40).map(i => i.str).join('').replace(/\s+/g, '');
            let m = head.match(/(\d{1,2})-DARS[·.•]?(VIDEODARS|JONLIDARS)/i);
            // Ustoz kitobida sarlavha "…Videoni yozib olish ssenariysi" yoki "…60 daqiqa · asosiy ustoz".
            if (m) { const n = Number(m[1]); if (n >= 1 && n <= 72 && !map[n]) map[n] = p; kinds.add(/ssenariy|\d+daqiqa·asosiy/i.test(head) ? 'teacher' : 'book'); }
            m = head.match(/(\d{1,2})[–-](\d{1,2})-DARSLAR[·.•]?YORDAMCHI/i);
            if (m) { for (let n = Number(m[1]); n <= Number(m[2]); n++) if (n >= 1 && n <= 72 && !map[n]) map[n] = p; kinds.add('assistant'); }
            onProgress?.(p, doc.numPages);
        }
        const nos = Object.keys(map).map(Number);
        return { pages: doc.numPages, pageMap: map, from: nos.length ? Math.min(...nos) : null, to: nos.length ? Math.max(...nos) : null,
            looksTeacher: kinds.has('teacher') || kinds.has('assistant'), looksBook: kinds.has('book') && !kinds.has('teacher') };
    }

    // ── Oyna ────────────────────────────────────────────────────────────────
    function open({ lang, existing = [], onDone }) {
        const wrap = document.createElement('div');
        wrap.className = 'lh-modal';
        wrap.innerHTML = `<div class="lh-dialog lh-import" role="dialog" aria-modal="true" aria-labelledby="liTitle">
            <h3 id="liTitle">Ommaviy yuklash · ${lang === 'russian' ? 'Rus tili' : 'Ingliz tili'}</h3>
            <p class="lh-muted">Kitoblar, Teacher's book, qo'llanmalar va slaydlarni bir martada tanlang. Tizim har birini o'zi taniydi, kitoblarda darslar sahifasini o'zi topadi. Yuklashdan oldin jadvalni tekshiring.</p>
            <div class="lh-row">
                <label class="lh-btn lh-primary li-pick">📄 Fayllarni tanlash<input type="file" multiple accept="${ACCEPT}" data-files hidden></label>
                <label class="lh-btn li-pick">📁 Butun papkani tanlash<input type="file" webkitdirectory multiple data-dir hidden></label>
            </div>
            <div class="li-status lh-muted" role="status"></div>
            <div class="li-table lh-table-wrap"></div>
            <div class="lh-dialog-actions"><button type="button" class="lh-btn" data-close>Yopish</button><button type="button" class="lh-btn lh-primary" data-go disabled>Yuklash</button></div>
        </div>`;
        document.body.appendChild(wrap);
        const $ = s => wrap.querySelector(s);
        const rows = [];
        let busy = false;
        const close = () => { if (busy && !confirm("Yuklash davom etyapti. Baribir yopilsinmi?")) return; document.removeEventListener('keydown', onKey, true); wrap.remove(); };
        const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
        document.addEventListener('keydown', onKey, true);
        $('[data-close]').onclick = close;
        const status = t => { $('.li-status').textContent = t; };

        async function addFiles(list) {
            const files = [...list].filter(f => /\.(pdf|pptx?|png|jpe?g|webp|mp4)$/i.test(f.name) && f.size > 0);
            if (!files.length) return status("Mos fayl topilmadi (PDF, PPT, rasm yoki MP4 kerak).");
            busy = true;
            for (const [i, file] of files.entries()) {
                const path = file.webkitRelativePath || file.name;
                const g = guessFromName(path);
                const row = { file, path, include: true, lessonNo: g.no, kind: g.kind, title: '', meta: {}, note: '', state: 'kutilmoqda' };
                const isPdf = /\.pdf$/i.test(file.name);
                // Slayd fayllari (nomida "slayd"/"slide" va dars raqami) tekshirilmaydi — tez.
                const slideByName = g.no && /slayd|slide|слайд/i.test(g.base) && file.size < 60 * 1048576;
                if (isPdf && !slideByName) {
                    status(`PDF tekshirilmoqda: ${file.name} (${i + 1}/${files.length})…`);
                    try {
                        const info = await scanPdf(file, (p, n) => { if (p % 20 === 0) status(`PDF tekshirilmoqda: ${file.name} — ${p}/${n}-bet`); });
                        const lessons = Object.keys(info.pageMap).length;
                        if (lessons >= 3) {
                            row.lessonNo = null;
                            row.kind = guessCourseKind(file.name, info);
                            row.meta = { pageMap: info.pageMap, lessonFrom: info.from, lessonTo: info.to };
                            row.note = `${lessons} ta dars sahifasi topildi (${info.from}–${info.to})`;
                        } else if (!g.no || file.size > 60 * 1048576) {
                            row.lessonNo = null;
                            row.kind = guessCourseKind(file.name, null);
                            row.note = 'Darslar sahifasi topilmadi — umumiy qo\'llanma sifatida';
                        }
                    } catch (e) { row.note = 'PDF o\'qilmadi: ' + e.message; }
                }
                if (!row.kind) { row.kind = row.lessonNo ? 'extra' : guessCourseKind(file.name, null); }
                row.title = defaultTitle(row, g.base);
                const dup = existing.find(m => m.fileName === file.name && m.kind === row.kind && (m.lessonNo ?? null) === (row.lessonNo ?? null));
                if (dup) { row.include = false; row.note = (row.note ? row.note + ' · ' : '') + 'allaqachon yuklangan'; }
                rows.push(row);
            }
            rows.sort((a, b) => (a.lessonNo ?? 0) - (b.lessonNo ?? 0) || a.path.localeCompare(b.path));
            busy = false;
            status(`${rows.length} ta fayl. Jadvalni tekshiring va «Yuklash»ni bosing.`);
            draw();
        }

        function defaultTitle(row, base) {
            if (row.kind === 'book') {
                const part = base.match(/(\d)\s*-?\s*qism/i);
                return `Darslik${part ? ` ${part[1]}-qism` : ''} (${row.meta.lessonFrom || 1}–${row.meta.lessonTo || 72}-darslar)`;
            }
            if (!row.lessonNo) { const t = base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); }
            return `${row.lessonNo}-dars · ${(LESSON_KINDS[row.kind] || '').toLowerCase()}`;
        }

        function kindOptions(row) {
            const all = row.lessonNo ? LESSON_KINDS : COURSE_KINDS;
            return Object.entries(all).map(([k, l]) => `<option value="${k}"${row.kind === k ? ' selected' : ''}>${esc(l)}</option>`).join('');
        }

        function draw() {
            const ok = rows.filter(r => r.include && validRow(r)).length;
            $('[data-go]').disabled = !ok || busy;
            $('[data-go]').textContent = ok ? `Yuklash (${ok})` : 'Yuklash';
            $('.li-table').innerHTML = rows.length ? `<table class="lh-table is-compact"><thead><tr><th></th><th>Fayl</th><th>Dars</th><th>Turi</th><th>Nomi</th><th>Holat</th></tr></thead><tbody>
                ${rows.map((r, i) => `<tr class="${validRow(r) ? '' : 'li-bad'}">
                    <td><input type="checkbox" data-i="${i}" data-f="include"${r.include ? ' checked' : ''} aria-label="Yuklansin"${busy ? ' disabled' : ''}></td>
                    <td><b>${esc(r.file.name)}</b><div class="lh-muted">${(r.file.size / 1048576).toFixed(1)} MB${r.note ? ' · ' + esc(r.note) : ''}</div></td>
                    <td><select class="lh-input lh-small" data-i="${i}" data-f="lessonNo"${busy ? ' disabled' : ''}><option value="">Kurs bo'yicha</option>${Array.from({ length: 72 }, (_, k) => `<option value="${k + 1}"${r.lessonNo === k + 1 ? ' selected' : ''}>${k + 1}-dars</option>`).join('')}</select></td>
                    <td><select class="lh-input lh-small" data-i="${i}" data-f="kind"${busy ? ' disabled' : ''}>${kindOptions(r)}</select></td>
                    <td><input class="lh-input lh-small" data-i="${i}" data-f="title" value="${esc(r.title)}"${busy ? ' disabled' : ''}></td>
                    <td>${esc(r.state)}</td></tr>`).join('')}</tbody></table>` : '';
            wrap.querySelectorAll('[data-i]').forEach(el => el.addEventListener('change', () => {
                const r = rows[Number(el.dataset.i)];
                const f = el.dataset.f;
                if (f === 'include') r.include = el.checked;
                else if (f === 'lessonNo') {
                    r.lessonNo = el.value ? Number(el.value) : null;
                    if (r.lessonNo && !LESSON_KINDS[r.kind]) r.kind = r.lessonNo % 2 === 0 ? 'live_slides' : 'video_slides';
                    if (!r.lessonNo && !COURSE_KINDS[r.kind]) r.kind = 'methodology';
                } else if (f === 'kind') r.kind = el.value;
                else r.title = el.value;
                draw();
            }));
        }

        const validRow = r => r.title.trim() && (r.lessonNo ? LESSON_KINDS[r.kind] : COURSE_KINDS[r.kind]) && (!LARGE.has(r.kind) || /\.pdf$/i.test(r.file.name));

        async function upload(file, large) {
            const fd = new FormData();
            fd.append('file', file);
            const token = typeof getToken === 'function' ? getToken() : null;
            const res = await fetch(large ? '/api/upload/large-pdf' : '/api/upload', { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Yuklash xatoligi (${res.status})`);
            return data;
        }

        $('[data-go]').onclick = async () => {
            busy = true;
            draw();
            let done = 0, failed = 0;
            const todo = rows.filter(r => r.include && validRow(r) && r.state !== 'yuklandi ✓');
            for (const r of todo) {
                r.state = 'yuklanmoqda…'; draw();
                try {
                    const large = LARGE.has(r.kind) || r.file.size > 50 * 1048576;
                    if (r.file.size > (large ? 300 : 50) * 1048576) throw new Error(`Fayl ${large ? 300 : 50} MB dan katta`);
                    const up = await upload(r.file, large && /\.pdf$/i.test(r.file.name));
                    await apiFetch('/api/academic/materials', { method: 'POST', timeout: 30000, body: JSON.stringify({
                        language: lang, lessonNo: r.lessonNo, kind: r.kind, title: r.title.trim(), url: up.url,
                        fileName: up.fileName || r.file.name, fileSize: up.fileSize || r.file.size, mime: up.mimeType || r.file.type,
                        note: '', meta: LARGE.has(r.kind) ? r.meta : {},
                    }) });
                    r.state = 'yuklandi ✓'; r.include = false; done++;
                } catch (e) { r.state = 'xato: ' + e.message; failed++; }
                status(`Yuklandi: ${done}/${todo.length}${failed ? ` · xato: ${failed}` : ''}`);
                draw();
            }
            busy = false;
            draw();
            status(`Tayyor: ${done} ta yuklandi${failed ? `, ${failed} ta xato (qatorni tekshirib qayta bosing)` : ''}.`);
            if (done) onDone?.();
        };
        $('[data-files]').addEventListener('change', e => addFiles(e.target.files));
        $('[data-dir]').addEventListener('change', e => addFiles(e.target.files));
        $('.li-pick').focus?.();
    }

    window.LessonImport = { open, guessFromName, scanPdf };
})();
