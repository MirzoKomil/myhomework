// Akademik bo'lim → Reyting (Reyting dizayni, 1:1): oy almashtirgichi, formula kartasi, top-3 (1-o'rin ko'k),
// "Barcha ustozlar" jadvali (progress barlar, avatarlar, ▲/▼ o'tgan oyga nisbatan) va Excel.
// Ma'lumot: GET /api/state/teacher-rating?type=&month= (server hisoblaydi, faqat yakuniy raqamlar).
(function () {
    'use strict';
    const MON = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const f1 = v => (Number(v) || 0).toFixed(1);
    const I = {
        prev: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
        next: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
        dl: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>'
    };
    const S = { type: 'asosiy', month: null, data: null, seq: 0 };
    const shift = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
    const label = key => { const [y, m] = String(key || '').split('-').map(Number); return m ? `${MON[m - 1]} ${y}` : ''; };
    const hrList = () => (typeof getItem === 'function' && typeof STORAGE_KEYS !== 'undefined' ? getItem(STORAGE_KEYS.hrEmployees, []) : []);
    function langOf(id) {
        const e = hrList().find(x => x.id === id); if (!e) return null;
        return e.role === 'rus-oqituvchi' ? 'russian' : e.role === 'ingliz-oqituvchi' ? 'english' : (e.lang === 'russian' ? 'russian' : 'english');
    }
    function av(id, name) {
        const e = hrList().find(x => x.id === id) || { id, name };
        const html = window.schoolUI?.staffAvatar ? window.schoolUI.staffAvatar(e, 36) : '';
        return `<span class="rtg-avp" title="${esc(name)}">${html}</span>`;
    }
    // ▲/▼ — o'tgan oyga nisbatan. O'tgan oy ma'lumoti yo'q (prevScore null) — "—", butun ball emas.
    function delta(r) {
        if (r.prevScore == null) return '<span class="rtg-dl is-none" title="O\'tgan oyda ma\'lumot yo\'q">—</span>';
        const d = Math.round((Number(r.score) - Number(r.prevScore)) * 10) / 10;
        const t = `O'tgan oy: ${r.prevRank != null ? r.prevRank + "-o'rin, " : ''}${f1(r.prevScore)} ball`;
        if (!d) return `<span class="rtg-dl is-none" title="${esc(t)}">—</span>`;
        return `<span class="rtg-dl ${d > 0 ? 'is-up' : 'is-dn'}" title="${esc(t)}">${d > 0 ? '▲' : '▼'} ${f1(Math.abs(d))}</span>`;
    }
    const pctTxt = v => v == null ? '—' : `${v}%`;
    const bar = v => `<div class="rtg-trk"><span style="width:${Math.max(0, Math.min(100, Number(v) || 0))}%"></span></div>`;

    function rowsFor(data, lang) {
        const rows = (data?.rows || []).filter(r => { const l = langOf(r.id); return !l || l === lang; }).map((r, i) => ({ ...r, rank: i + 1 }));
        // O'tgan oydagi o'rin shu til yo'nalishi ichida (title uchun).
        const prev = rows.filter(r => r.prevScore != null).sort((a, b) => b.prevScore - a.prevScore);
        rows.forEach(r => { r.prevRank = r.prevScore != null ? prev.indexOf(r) + 1 : null; });
        return rows;
    }

    function view(data, lang) {
        const rows = rowsFor(data, lang);
        const kind = S.type === 'yordamchi' ? 'Yordamchi' : 'Asosiy';
        const key = data.month, cur = data.currentMonth || key;
        const canPrev = !data.firstMonth || key > data.firstMonth;
        const canNext = key < cur;
        const prevName = (MON[Number(String(data.prevMonth || '').slice(5, 7)) - 1] || '').toLowerCase();
        const podium = rows.slice(0, 3).map((r, i) => `<section class="rtg-card rtg-pd${i === 0 ? ' is-first' : ''}" aria-label="${r.rank}-o'rin">
            <div class="rtg-row rtg-sb"><div class="rtg-who">${av(r.id, r.name)}<div><div class="rtg-nm">${esc(r.name)}</div><div class="rtg-mt">${kind}${r.students != null ? ` · ${r.students} o'quvchi` : ''}</div></div></div><span class="rtg-rk">${r.rank}</span></div>
            <div class="rtg-score">${f1(r.score)}<small>ball</small></div>
            <div class="rtg-two">
              <div><div class="rtg-ml"><span>Davomat</span><span>${pctTxt(r.davomatPct)}</span></div>${bar(r.davomatPct)}</div>
              <div><div class="rtg-ml"><span>O'zlashtirish</span><span>${pctTxt(r.learnPct)}</span></div>${bar(r.learnPct)}</div>
            </div></section>`).join('');
        const body = rows.map(r => `<tr><td class="rtg-nm">${r.rank}</td>
            <td><div class="rtg-who">${av(r.id, r.name)}<div><div class="rtg-nm">${esc(r.name)}</div><div class="rtg-mt">${r.completed != null && r.expected != null ? `${r.completed} / ${r.expected} dars` : '—'}</div></div></div></td>
            <td>${r.students ?? '—'}</td>
            <td><div class="rtg-mini">${bar(r.davomatPct)}<span class="rtg-nm">${pctTxt(r.davomatPct)}</span></div></td>
            <td><div class="rtg-mini"${r.learnPct != null ? ` title="${r.learnStudents} o'quvchining ilova ma'lumoti"` : ' title="Ilova ma\'lumoti yo\'q — ball faqat davomatdan"'}>${bar(r.learnPct)}<span class="rtg-nm">${pctTxt(r.learnPct)}</span></div></td>
            <td><span class="rtg-pts">${f1(r.score)}</span>${delta(r)}</td></tr>`).join('')
            || `<tr><td colspan="6" class="rtg-empty">${esc(label(key))} uchun reyting ma'lumoti yo'q</td></tr>`;
        return `<div class="rtg">
          <div class="rtg-row rtg-sb">
            <h2 class="rtg-big">Ustozlar reytingi</h2>
            <div class="rtg-row">
              <div class="rtg-seg" role="group" aria-label="Ustoz turi"><button type="button" data-rt-type="asosiy" aria-pressed="${S.type === 'asosiy'}">Asosiy ustozlar</button><button type="button" data-rt-type="yordamchi" aria-pressed="${S.type === 'yordamchi'}">Yordamchi ustozlar</button></div>
              <div class="rtg-mon" role="group" aria-label="Oy"><button type="button" data-rt-mon="-1" aria-label="Oldingi oy"${canPrev ? '' : ' disabled'}>${I.prev}</button><span>${esc(label(key))}</span><button type="button" data-rt-mon="1" aria-label="Keyingi oy"${canNext ? '' : ' disabled'}>${I.next}</button></div>
            </div>
          </div>
          <section class="rtg-card" aria-label="Reyting qanday hisoblanadi">
            <div class="rtg-formula">
              <span class="rtg-fx">Davomat <b>%</b> × <b>60%</b></span><span class="rtg-op">+</span>
              <span class="rtg-fx">O'quvchilar o'zlashtirishi — uy vazifasi, 1-urinish <b>%</b> × <b>40%</b></span><span class="rtg-op">=</span>
              <span class="rtg-fx is-res">Ball <b>/ 100</b></span>
            </div>
            <p class="rtg-mt rtg-fnote">Davomat — rejadagi darslardan nechtasi o'tildi. O'zlashtirish — o'quvchilar ilovada uy vazifasini birinchi urinishda necha foizga bajargani (ilova ma'lumoti). Asosiy va yordamchi ustozlar alohida solishtiriladi.</p>
          </section>
          ${podium ? `<div class="rtg-podium">${podium}</div>` : ''}
          <section class="rtg-card" aria-labelledby="rtgAllTitle">
            <div class="rtg-ch"><h3 class="rtg-ct" id="rtgAllTitle">Barcha ustozlar</h3><button type="button" class="rtg-btn" data-rt-excel${rows.length ? '' : ' disabled'}>${I.dl}Excel</button></div>
            <div class="rtg-scroll"><table class="rtg-tbl">
              <thead><tr><th scope="col">#</th><th scope="col">Ustoz</th><th scope="col">O'quvchilar</th><th scope="col">Davomat · 60%</th><th scope="col">O'zlashtirish · 40%</th><th scope="col">Ball · ${esc(prevName)}ga nisbatan</th></tr></thead>
              <tbody>${body}</tbody>
            </table></div>
          </section>
        </div>`;
    }

    async function exportExcel(rows, data) {
        try {
            const X = typeof loadXlsxLib === 'function' ? await loadXlsxLib() : window.XLSX;
            if (!X) throw new Error("Excel kutubxonasi yo'q");
            const list = rows.map(r => ({
                '#': r.rank, Ustoz: r.name, "O'quvchilar": r.students, 'Darslar (o\'tildi / reja)': `${r.completed} / ${r.expected}`,
                'Davomat %': r.davomatPct, "O'zlashtirish %": r.learnPct ?? '', Ball: Number(f1(r.score)),
                [`O'tgan oy (${label(data.prevMonth)})`]: r.prevScore == null ? '' : Number(f1(r.prevScore))
            }));
            const wb = X.utils.book_new();
            X.utils.book_append_sheet(wb, X.utils.json_to_sheet(list), 'Reyting');
            X.writeFile(wb, `reyting-${S.type}-${data.month}.xlsx`);
        } catch (e) { (window.showMiniToast || alert)(e.message || 'Excel yuklab bo\'lmadi'); }
    }

    async function render(container, { lang = 'english' } = {}) {
        if (!container) return;
        const seq = ++S.seq;
        if (!S.data) container.innerHTML = '<div class="rtg"><p class="rtg-mt">Reyting yuklanmoqda…</p></div>';
        let data;
        try {
            await Promise.resolve(window.schoolUI?.loadStaffAvatars?.()).catch(() => {});
            data = await apiFetch('/api/state/teacher-rating?type=' + encodeURIComponent(S.type) + (S.month ? '&month=' + encodeURIComponent(S.month) : ''));
        } catch (err) {
            if (seq !== S.seq) return;
            // Bitta xato naqshi (js/loadError.js): o'rinlar va ballar ko'rsatilmaydi, "Qayta urinish".
            container.innerHTML = `<div class="rtg">${window.LoadErr.html({ title: 'Reytingni yuklab bo\'lmadi', err })}</div>`;
            window.LoadErr.bind(container, () => render(container, { lang }));
            return;
        }
        if (seq !== S.seq) return;
        S.data = data;
        container.innerHTML = view(data, lang);
        const again = () => render(container, { lang });
        container.querySelectorAll('[data-rt-type]').forEach(b => b.addEventListener('click', () => { if (S.type === b.dataset.rtType) return; S.type = b.dataset.rtType; again(); }));
        container.querySelectorAll('[data-rt-mon]').forEach(b => b.addEventListener('click', () => {
            const k = shift(data.month, Number(b.dataset.rtMon));
            S.month = k >= (data.currentMonth || data.month) ? null : k; again();
        }));
        container.querySelector('[data-rt-excel]')?.addEventListener('click', () => exportExcel(rowsFor(data, lang), data));
    }

    window.ReytingUI = { render, delta, _rowsFor: rowsFor };
})();
