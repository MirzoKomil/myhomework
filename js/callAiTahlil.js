// Qo'ng'iroq AI tahlili — 2-bosqich ekranlari.
// Kompyuter: Sotuv › Tahlil (Umumiy, Menejerlar, Qo'ng'iroqlar, Rivojlanish rejalari, Haftalik hisobot, Sozlamalar),
// sotuv menejeri "Mening tahlilim" (Umumiy, Rivojlanish rejam, Qo'ng'iroqlarim), Bosh sahifa bloklari,
// Marketing › Lid sifati (AI). Telefon: menejer (Tahlilim, Rejam), ROP (Tahlil, menejer, mini-reja), targetolog (Lid sifati).
// Dizayn: "CRM — barcha dizaynlar" › qongiroq-komp (QAT_K_*) va qongiroq-tel (QAT_T_*). Klasslar js/callAi.js dagi "qa-" bilan bir xil.
// Server: /api/call-ai/{stats,calls-table,manager/:id,me,plans,weekly,settings,lead-quality} (server/routes/callAi.js).
(function () {
    'use strict';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const P = {
        back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 18l6-6-6-6"/>', cal: '<path d="M3 9.5h18M5 4.5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2v-12a2 2 0 012-2z"/>',
        spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>', check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/>',
        phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',
        flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>', cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>', trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
        send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>', play: '<path d="M7 4l13 8-13 8z"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    };
    const ic = (k, s = 18, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k] || ''}</svg>`;
    const AXES = ['ochilish', 'ehtiyoj', 'ogriq', 'taqdimot', 'narx', 'etiroz', 'yopish'];
    const AX = { ochilish: 'Ochilish', ehtiyoj: 'Ehtiyoj', ogriq: 'Ogʻriq', taqdimot: 'Taqdimot', narx: 'Narx', etiroz: 'Eʼtiroz', yopish: 'Yopish' };
    const TYPES = { birinchi: ['1-qoʻngʻiroq', 'g-n'], qayta: ['Qayta', 'g-y'], sinovdan_keyin: ['Sinovdan keyin', 'g-p'], tolov: ['Toʻlov', 'g-o'], qarzdorlik: ['Qarzdorlik', 'g-z'], eslatma: ['Eslatma', 'g-n'] };
    const LOSTNOTE = 'Qoʻldan ketgan = qoida buzilgan va 7 kun ichida yopilmagan lidlar · paket narxi × AI sotuv ehtimoli';
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    const MON3 = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const AVC = [['#ECFDF3', '#067647'], ['#EAF3FF', '#0057B8'], ['#F1ECFE', '#5B30B5'], ['#FEF0C7', '#93370D'], ['#FEF3F2', '#B42318']];

    const api = (path, opts) => apiFetch('/api/call-ai' + path, opts);
    const user = () => { try { return typeof getCurrentUser === 'function' ? getCurrentUser() : null; } catch (e) { return null; } };
    const role = () => user()?.role || '';
    const isDirector = () => ['admin', 'boshliq'].includes(role());
    const canTeam = () => ['admin', 'boshliq', 'rop'].includes(role());
    const toast = m => { if (typeof showMiniToast === 'function') showMiniToast(m, 2600); };

    // ── Ko'rinish yordamchilari ──
    function grade(s) {
        if (s == null) return ['—', 'g-n', '#3A4456', '#EEF1F6'];
        if (s >= 90) return ['AʼLO', 'g-a', '#067647', '#ECFDF3'];
        if (s >= 80) return ['YAXSHI', 'g-y', '#0057B8', '#EAF3FF'];
        if (s >= 60) return ['OʻRTA', 'g-o', '#93370D', '#FEF0C7'];
        return ['ZAIF', 'g-z', '#B42318', '#FEF3F2'];
    }
    const scoreBox = (s, size = 64, fs = 24) => { const g = grade(s); return `<div class="qa-sc" style="width:${size}px;height:${size}px;background:${g[3]};color:${g[2]}"><b style="font-size:${fs}px">${s == null ? '—' : s}</b><small>${g[0]}</small></div>`; };
    const gtag = s => { if (s == null) return '<span class="qa-tg g-n">—</span>'; const g = grade(s); return `<span class="qa-tg ${g[1]}">${s} · ${g[0]}</span>`; };
    const typeTag = (t, w) => { const x = TYPES[t] || ['—', 'g-n']; return `<span class="qa-tg ${x[1]}"${w ? ` style="width:${w}px;justify-content:center"` : ''}>${x[0]}</span>`; };
    const comma = v => (v == null ? '—' : String(v).replace('.', ','));
    const one = v => (v == null ? '—' : comma(Math.round(v * 10) / 10));
    const delta = d => (d == null ? '' : `<b class="qt-dl" style="color:${d > 0 ? '#067647' : d < 0 ? '#B42318' : '#4B5563'};font-size:12px">${d > 0 ? '+' : ''}${d}</b>`);
    const mln = n => { n = Number(n) || 0; if (!n) return '0'; return n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '')} mln` : `${Math.round(n / 1000)} ming`; };
    const usd = n => (n == null ? '—' : '$' + Number(n).toFixed(2).replace('.', ','));
    const ini = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const hash = s => [...String(s || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    function av(name, size = 40, avatar = '', key = name) {
        const c = AVC[hash(key) % AVC.length];
        if (avatar) return `<span class="qa-av" style="width:${size}px;height:${size}px"><img src="${esc(avatar)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover"></span>`;
        return `<span class="qa-av" style="width:${size}px;height:${size}px;background:${c[0]};color:${c[1]};font-size:${Math.round(size * .38)}px;font-weight:800">${esc(ini(name))}</span>`;
    }
    const shortName = n => String(n || '').split(/\s+/)[0] || n;
    const shortLead = n => { const w = String(n || '').trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[1][0]}.` : (w[0] || 'Lid'); };
    const pad = n => String(n).padStart(2, '0');
    const tk = ms => new Date(Number(ms) + 5 * 3600000);
    const ddmm = ms => { const d = tk(ms); return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`; };
    function rangeLabel(from, to, short) {
        const a = tk(from), b = tk(to - 1);
        const m = short ? MON3 : MON;
        return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}–${b.getUTCDate()} ${m[b.getUTCMonth()]}` : `${a.getUTCDate()} ${m[a.getUTCMonth()]} – ${b.getUTCDate()} ${m[b.getUTCMonth()]}`;
    }
    function when(ms) {
        const d = tk(ms), now = tk(Date.now());
        const day = x => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
        const diff = Math.round((day(now) - day(d)) / 864e5), t = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
        return diff === 0 ? `Bugun ${t}` : diff === 1 ? `Kecha ${t}` : `${d.getUTCDate()}-${MON3[d.getUTCMonth()]} ${t}`;
    }
    const dur = s => { s = Math.round(Number(s) || 0); return s ? `${Math.floor(s / 60)}:${pad(s % 60)}` : '—'; };
    const st = (k, t, s) => `<div class="qa-st"><i class="${k}">${ic(k === 'ok' ? 'check' : k === 'no' ? 'x' : 'warn', 14, 2.6)}</i><div><b>${t}</b><span>${s}</span></div></div>`;
    P.clock = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
    P.x = '<path d="M6 6l12 12M18 6L6 18"/>';
    const empty = (t, s = '') => `<div class="qa-cd" style="align-items:center;text-align:center;padding:28px 18px;gap:6px">${ic('mic', 28)}<b style="font-size:15px">${t}</b>${s ? `<span class="qa-note">${s}</span>` : ''}</div>`;
    const loading = () => '<p class="qa-note" style="padding:24px 0;text-align:center">Yuklanmoqda…</p>';
    const err = e => `<div class="qa-al r"><span class="i">${ic('warn', 16)}</span><div>Maʼlumot olinmadi: ${esc(e?.message || e)}</div></div>`;

    // Radar (7 o'q, 0–10). cmp — solishtiruv (shtrix).
    function radar(vals, size = 220, { cmp = null, fs = 11, labels = true } = {}) {
        const n = AXES.length, W = size + (labels ? 70 : 0), cx = W / 2, cy = size / 2, R = size / 2 - (labels ? 30 : 6);
        const pt = (i, f) => { const a = -Math.PI / 2 + 2 * Math.PI * i / n; return [cx + R * f * Math.cos(a), cy + R * f * Math.sin(a)]; };
        const poly = arr => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        let g = '';
        [1 / 3, 2 / 3, 1].forEach(f => { g += `<polygon points="${poly(AXES.map((_, i) => pt(i, f)))}" fill="none" stroke="#E6EAF2"/>`; });
        AXES.forEach((_, i) => { const [x, y] = pt(i, 1); g += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#E6EAF2"/>`; });
        const v = AXES.map(k => Math.max(0, Math.min(10, Number(vals?.[k]) || 0)));
        const weakK = AXES.filter(k => vals?.[k] != null).sort((a, b) => vals[a] - vals[b])[0];
        if (cmp) g += `<polygon points="${poly(AXES.map((k, i) => pt(i, Math.max(0, Math.min(10, Number(cmp[k]) || 0)) / 10)))}" fill="none" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="4 3"/>`;
        g += `<polygon points="${poly(v.map((x, i) => pt(i, x / 10)))}" fill="rgba(0,87,184,.18)" stroke="#0057B8" stroke-width="2"/>`;
        v.forEach((x, i) => { const [px, py] = pt(i, x / 10); g += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="#0057B8"/>`; });
        if (labels) AXES.forEach((k, i) => {
            const [x, y] = pt(i, 1), dx = x - cx, anc = Math.abs(dx) < 8 ? 'middle' : dx > 0 ? 'start' : 'end';
            const lx = x + (dx > 8 ? 8 : dx < -8 ? -8 : 0), ly = y + (y < cy - 5 ? -8 : y > cy + 5 ? 14 : 4);
            const val = vals?.[k]; const low = val != null && k === weakK;
            g += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anc}" font-size="${fs}" font-weight="700" fill="${low ? '#B42318' : '#3A4456'}">${AX[k]} ${val == null ? '—' : comma(Math.round(val))}</text>`;
        });
        return `<svg width="${W}" height="${size}" viewBox="0 0 ${W} ${size}" role="img" aria-label="Bosqichlar boʻyicha baho" style="max-width:100%;height:auto">${g}</svg>`;
    }
    // Haftalik chiziq (2 qator: asosiy va jamoa — shtrix). Reja chegarasi chizig'i.
    function line(series, labels, { w = 520, h = 180, threshold = 70 } = {}) {
        const all = series.flat().filter(v => v != null);
        if (!all.length || !labels.length) return '<p class="qa-note" style="padding:24px 0;text-align:center">Hali haftalik maʼlumot yoʻq</p>';
        const ymin = Math.min(55, Math.floor((Math.min(...all) - 3) / 5) * 5), ymax = Math.max(90, Math.ceil((Math.max(...all) + 3) / 5) * 5);
        const pl = 34, pr = 14, pt = 12, pb = 26, W = w - pl - pr, H = h - pt - pb;
        const X = i => pl + (labels.length > 1 ? i * W / (labels.length - 1) : W / 2), Y = v => pt + H - (v - ymin) / (ymax - ymin) * H;
        let g = '';
        const step = h < 150 ? 20 : 10;
        for (let v = Math.ceil(ymin / step) * step; v <= ymax; v += step) g += `<line x1="${pl}" x2="${w - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#EEF1F6"/><text x="${pl - 6}" y="${(Y(v) + 4).toFixed(1)}" font-size="12" text-anchor="end" fill="#4B5563">${v}</text>`;
        labels.forEach((l, i) => { g += `<text x="${X(i).toFixed(1)}" y="${h - 8}" font-size="12" text-anchor="middle" fill="#4B5563">${esc(l)}</text>`; });
        g += `<line x1="${pl}" x2="${w - pr}" y1="${Y(threshold).toFixed(1)}" y2="${Y(threshold).toFixed(1)}" stroke="#B42318" stroke-dasharray="4 4"/><text x="${w - pr - 16}" text-anchor="end" y="${(Y(threshold) + 15).toFixed(1)}" font-size="12" fill="#B42318" font-weight="700" stroke="#fff" stroke-width="4" paint-order="stroke">reja chegarasi ${threshold}</text>`;
        const colors = ['#0057B8', '#94A3B8'];
        series.forEach((s, si) => {
            const pts = s.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
            if (!pts.length) return;
            g += `<polyline points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="none" stroke="${colors[si]}" stroke-width="2.5"${si ? ' stroke-dasharray="6 4"' : ''}/>`;
            const [x, y] = pts[pts.length - 1]; g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${colors[si]}"/>`;
        });
        return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block" role="img" aria-label="Haftalik ball dinamikasi">${g}</svg>`;
    }
    function spark(v, w = 90, h = 28) {
        const pts = (v || []).map((x, i) => [i, x]).filter(p => p[1] != null);
        if (pts.length < 2) return `<span class="qa-note" style="display:inline-block;width:${w}px">—</span>`;
        const mn = Math.min(...pts.map(p => p[1])), mx = Math.max(...pts.map(p => p[1])), r = mx - mn || 1, n = v.length - 1 || 1;
        const c = pts[pts.length - 1][1] >= pts[pts.length - 2][1] ? '#067647' : '#B42318';
        return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.map(([i, x]) => `${(i * w / n).toFixed(1)},${(h - 3 - (x - mn) / r * (h - 6)).toFixed(1)}`).join(' ')}" fill="none" stroke="${c}" stroke-width="2"/></svg>`;
    }
    const leg = (a, b) => `<div class="qa-row qa-note" style="gap:12px;justify-content:center"><span class="qa-row" style="gap:5px"><i style="width:12px;height:3px;background:#0057B8;display:block"></i>${esc(a)}</span><span class="qa-row" style="gap:5px"><i style="width:12px;border-top:2px dashed #94A3B8;display:block"></i>${esc(b)}</span></div>`;
    function heat(v) {
        if (v == null) return ['#F5F7FB', '#94A3B8'];
        if (v >= 8) return ['#ECFDF3', '#067647'];
        if (v >= 7) return ['#EAF3FF', '#0057B8'];
        if (v >= 5.5) return ['#FEF0C7', '#93370D'];
        return ['#FEE4E2', '#B42318'];
    }
    const bar = (pct, color, h = 8) => `<div class="qa-bar" style="flex:1;height:${h}px"><i style="height:${h}px;width:${Math.max(0, Math.min(100, pct || 0)).toFixed(0)}%;background:${color}"></i></div>`;
    const stageColor = p => (p >= 75 ? '#067647' : p >= 50 ? '#B54708' : '#B42318');
    const toneCls = { z: 'g-z', o: 'g-o', y: 'g-y', p: 'g-p', a: 'g-a', n: 'g-n' };
    const kpi = (b, s, { color = '', title = '', go = '', cls = '' } = {}) => `<${go ? 'button type="button"' : 'div'} class="qa-kpi qt-kpi ${cls}"${go ? ` data-qt-go="${go}"` : ''}${title ? ` title="${esc(title)}"` : ''}><b${color ? ` style="color:${color}"` : ''}>${b}</b><span>${s}</span></${go ? 'button' : 'div'}>`;

    function css() {
        window.callAiUI?.css?.();
        if (document.getElementById('qtStyle')) return;
        const s = document.createElement('style');
        s.id = 'qtStyle';
        s.textContent = `
.qt{display:flex;flex-direction:column;gap:14px;padding:4px 0 24px}
.qa .qa-av{flex:none;border-radius:50%;display:grid;place-items:center;font-weight:800;overflow:hidden}
.qt-kpi{flex:1;min-width:0;font:inherit;text-align:left;color:#0B1220;padding:12px 14px!important}
.qt-kpi b{font-size:24px!important}
button.qt-kpi{cursor:pointer}button.qt-kpi:hover{border-color:#0057B8}
.qt-kpis{display:flex;gap:12px}.qt-kpi b.qt-dl{font-size:13px!important}
.qt-sub{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.qt-sub .qa-chip .qa-tg{padding:0 6px;margin-left:2px}
.qt-per{position:relative;display:inline-flex}
.qt-per select{position:absolute;inset:0;opacity:0;cursor:pointer;font-size:16px}
.qt-g2{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px;align-items:start}
.qt-col{display:flex;flex-direction:column;gap:14px;min-width:0}
.qt-h{font-size:15px;font-weight:800}
.qt-heat{border-collapse:collapse;width:100%}
.qt-heat th{font-size:11px;color:#4B5563;font-weight:700;padding:0 3px 6px}
.qt-heat td{padding:3px}
.qt-heat .c{display:block;width:100%;border:0;border-radius:8px;text-align:center;padding:5px 0;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}
.qt-heat .nm{display:flex;gap:8px;align-items:center;background:none;border:0;padding:0;font:inherit;font-weight:700;font-size:13px;color:#0B1220;cursor:pointer;white-space:nowrap}
.qa-al{display:flex;gap:10px;align-items:flex-start;border-radius:16px;padding:12px;font-size:13px;line-height:1.4;color:#0B1220;text-align:left;font-family:inherit;border:0;width:100%}
.qa-al .i{flex:none;width:36px;height:36px;border-radius:10px;display:grid;place-items:center}
.qa-al.r{background:#FEF3F2}.qa-al.r .i{background:#FEE4E2;color:#B42318}
.qa-al.o{background:#FFFAEB}.qa-al.o .i{background:#FEF0C7;color:#93370D}
.qa-al.b{background:#EAF3FF}.qa-al.b .i{background:#D6E6FF;color:#0057B8}
.qa-al.p{background:#F4F0FF}.qa-al.p .i{background:#E9E2FD;color:#5B30B5}
button.qa-al{cursor:pointer}
.qt-fun{display:flex;align-items:center;gap:8px;font-size:13px}
.qt-alr{display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0;border:0;border-bottom:1px solid #EEF1F6;background:none;width:100%;text-align:left;font-family:inherit;color:#0B1220;cursor:pointer;min-height:36px}
.qt-alr:last-child{border-bottom:0}
.qt-alr>span:nth-child(2){white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.qt-tb{width:100%;border-collapse:collapse;font-size:13px}
.qt-tb th{text-align:left;font-size:11px;font-weight:700;color:#4B5563;text-transform:uppercase!important;letter-spacing:.3px;padding:10px;border-bottom:1px solid #E6EAF2;white-space:nowrap}
.qt-tb td:last-child,.qt-tb th:last-child{padding-right:14px}
.qt-tb td{padding:10px;border-bottom:1px solid #EEF1F6;vertical-align:middle}
.qt-tb tbody tr:last-child td{border-bottom:0}
.qt-tb tr.lk{cursor:pointer}.qt-tb tr.lk:hover td{background:#F8FAFD}
.qt-lnk{background:none;border:0;padding:0;font:inherit;color:#0057B8;font-weight:700;cursor:pointer;text-align:left}
.qt-tb .qa-tg{max-width:230px;overflow:hidden;text-overflow:ellipsis;display:inline-block;vertical-align:middle}
.qa .qa-btn.qa-pri,.qa .qa-pri{color:#fff}
.qt-mrow>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qt-tb th{text-transform:uppercase}
.qt-set label>span.l{line-height:1.3;min-height:32px}
.qt-in{position:relative;display:flex;align-items:center}.qt-in input{min-width:0}.qt-in i{position:absolute;right:12px;font-style:normal;font-size:13px;color:#4B5563;pointer-events:none}
.qt-plans{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.qt-weeks{display:flex;gap:10px}
.qt-week{flex:1;min-width:0;gap:4px!important;padding:12px!important}
.qt-week.done{background:#ECFDF3;border-color:#ABEFC6}.qt-week.failed{background:#FEF3F2;border-color:#FECDCA}.qt-week.current{background:#EAF3FF;border-color:#B2CCFF}
.qt-task{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #EEF1F6;font-size:13px}
.qt-task:last-child{border-bottom:0}
.qt-task .cb{flex:none;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;border:2px solid #CBD5E1;background:#fff;padding:0;cursor:pointer;color:#fff}
.qt-task .cb.on{background:#067647;border-color:#067647}.qt-task .cb:disabled{cursor:default}
.qt-task .tx{flex:1;min-width:0}
.qt-goal{display:flex;flex-direction:column;gap:5px}
.qt-set{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px 10px}
.qt-set label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:#4B5563}
.qt-me3{display:grid;grid-template-columns:330px minmax(0,1fr) 330px;gap:14px;align-items:start}
.qt-pr3{display:grid;grid-template-columns:330px minmax(0,1fr) 320px;gap:14px;align-items:start}
.qt-home{border-radius:20px;border:1.5px dashed #B54708;position:relative}.qt-new{position:absolute;top:-10px;right:18px;font-size:10px;font-weight:800;letter-spacing:.3px;padding:1px 7px;border-radius:999px;background:#FFFAEB;color:#93370D;border:1px dashed #B54708}.qt-tagw .qa-tg{white-space:normal;text-align:left;line-height:1.25;border-radius:10px}.qa .qa-kpi b.qt-dl,.qa .qt-kpi b.qt-dl{font-size:13px!important}
.qt-home3{display:grid;grid-template-columns:minmax(0,1fr) 280px 300px;gap:16px}
.qt-mrow{display:flex;gap:8px;align-items:center;padding:6px 0;border:0;border-bottom:1px solid #EEF1F6;background:none;width:100%;font:inherit;font-size:13px;color:#0B1220;cursor:pointer;text-align:left;min-height:40px}
.qt-planrow{display:flex;gap:8px;align-items:center;flex:1 1 0;min-width:0;background:#F5F7FB;border-radius:14px;padding:8px 10px;color:#0B1220;font-size:12px;border:0;font-family:inherit;text-align:left;cursor:pointer}
.qt-ph{display:flex;flex-direction:column;gap:11px;padding:0 0 16px}
.qt-ph .qt-kpi b{font-size:20px!important}
.qt-ph .qt-kpi{padding:10px!important}
@media (max-width:1280px){.qt-me3,.qt-pr3{grid-template-columns:300px minmax(0,1fr)}.qt-me3>:last-child,.qt-pr3>:last-child{grid-column:1/-1}.qt-home3{grid-template-columns:1fr 1fr}}
@media (max-width:1100px){.qt-g2{grid-template-columns:1fr}.qt-kpis{flex-wrap:wrap}.qt-kpis>*{flex:1 1 30%}.qt-plans{grid-template-columns:1fr}.qt-set{grid-template-columns:repeat(3,minmax(0,1fr))}.qt-weeks{flex-wrap:wrap}}
@media (max-width:760px){.qt-me3,.qt-pr3,.qt-home3{grid-template-columns:1fr}.qt-kpis>*{flex:1 1 45%}.qt-tbw{overflow-x:auto}}`;
        document.head.appendChild(s);
    }

    // ── Davr tanlash ──
    const PERIODS = [['', 'oʻtgan hafta'], ['today2', 'bugun va kecha'], ['week', 'shu hafta'], ['month', 'shu oy']];
    function perChip(state, data) {
        const pl = (PERIODS.find(p => p[0] === state.per) || PERIODS[0])[1];
        const lbl = state.per === 'today2' ? 'Bugun va kecha' : data?.from ? `${rangeLabel(data.from, data.to)} (${pl})` : 'Davr';
        return `<label class="qt-per"><span class="qa-chip">${ic('cal', 16)} ${esc(lbl)} ⌄</span><select data-qt-per aria-label="Davr">${PERIODS.map(([k, l]) => `<option value="${k}"${state.per === k ? ' selected' : ''}>${l[0].toUpperCase() + l.slice(1)}</option>`).join('')}</select></label>`;
    }
    const q = (state, extra = {}) => { const o = { per: state.per || '', lang: state.lang || '', ...extra }; return '?' + Object.entries(o).filter(([, v]) => v !== '' && v != null && v !== false).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'); };
    const curLang = () => { try { if (typeof _leadsLangFilter !== 'undefined' && (_leadsLangFilter === 'english' || _leadsLangFilter === 'russian')) return _leadsLangFilter; } catch (e) { /* yo'q */ } return ''; };

    // ── Qo'ng'iroq oynasi (callAi.js dagi bitta qo'ng'iroq ko'rinishi) ──
    async function openCall(id, { onClose } = {}) {
        const ui = window.callAiUI;
        if (!ui || typeof openModal !== 'function') return;
        let token = 0, timer = null;
        const body = () => document.getElementById('modalBody');
        const alive = t => t === token && document.getElementById('modalOverlay')?.style.display !== 'none';
        async function show() {
            const t = ++token; clearTimeout(timer);
            let d; try { d = await ui.loadCall(id); } catch (e) { body().innerHTML = `<div class="qa">${err(e)}</div>`; return; }
            if (t !== token) return;
            document.getElementById('modalTitle').textContent = d.leadName || d.lead?.name || 'Qoʻngʻiroq tahlili';
            body().innerHTML = ui.callView(d, { back: false });
            ui.bind(body(), { refresh: show, call: d, openLead: () => { closeModal(); if (typeof openLeadOverview === 'function' && d.leadId) openLeadOverview(d.lang, d.leadId); }, openAppeal: () => appeal(d) });
            if (ui.busy(d)) timer = setTimeout(function tick() { if (!alive(t)) return; if (ui.playing()) timer = setTimeout(tick, 20000); else show(); }, 20000);
        }
        function appeal(d) {
            ++token; clearTimeout(timer);
            body().innerHTML = ui.appealForm(d);
            ui.bind(body(), { back: show, call: d, afterAppeal: () => { toast('Eʼtiroz yuborildi — ROP 24 soat ichida hal qiladi'); show(); } });
        }
        openModal('Qoʻngʻiroq tahlili', `<div class="qa qa-call">${loading()}</div>`, '', { wide: true });
        document.getElementById('modalOverlay')?.addEventListener('crm:modal-closed', () => { ++token; clearTimeout(timer); ui.stopAll(); onClose && onClose(); }, { once: true });
        show();
    }

    // ═════════════ Sotuv › Tahlil (ROP / admin / boshliq) ═════════════
    const SUB = [['umumiy', 'Umumiy'], ['menejerlar', 'Menejerlar'], ['qongiroqlar', 'Qoʻngʻiroqlar'], ['rejalar', 'Rivojlanish rejalari'], ['hafta', 'Haftalik hisobot'], ['sozlama', 'Sozlamalar']];
    const S = { page: 'umumiy', per: '', lang: '', managerId: null, planId: null, f: { type: '', manager: '', appeal: false, violations: false, status: '', page: 0 }, week: '', root: null, counts: { appeals: 0, plans: 0 }, gen: 0 };

    function subnav(data) {
        return `<div class="qt-sub">${SUB.map(([k, l]) => {
            const n = k === 'rejalar' ? S.counts.plans : k === 'qongiroqlar' ? S.counts.appeals : 0;
            const badge = n ? ` <span class="qa-tg ${k === 'rejalar' ? 'g-o' : 'g-z'}" title="${k === 'rejalar' ? 'ROP tasdigʻini kutmoqda' : 'Eʼtiroz'}">${n}</span>` : '';
            return `<button type="button" class="qa-chip${S.page === k ? ' on' : ''}" data-qt-sub="${k}">${l}${badge}</button>`;
        }).join('')}<span style="flex:1"></span>${S.page === 'sozlama' || S.page === 'rejalar' ? '' : S.page === 'hafta' ? weekChip(data) : perChip(S, data)}</div>`;
    }
    function weekChip(data) {
        const weeks = data?.weeks || [];
        const cur = data?.report ? rangeLabel(data.report.weekStart, data.report.weekStart + 7 * 864e5) + (data.weeks?.[0]?.week === (S.week || data.weeks?.[0]?.week) ? ' (oʻtgan hafta)' : '') : 'Hisobot yoʻq';
        if (!weeks.length) return `<span class="qa-chip">${ic('cal', 16)} ${esc(cur)}</span>`;
        return `<label class="qt-per"><span class="qa-chip">${ic('cal', 16)} ${esc(cur)} ⌄</span><select data-qt-week aria-label="Hafta">${weeks.map(w => `<option value="${esc(w.week)}"${(S.week || weeks[0].week) === w.week ? ' selected' : ''}>${esc(rangeLabel(Date.parse(w.week + 'T00:00:00+05:00'), Date.parse(w.week + 'T00:00:00+05:00') + 7 * 864e5))}</option>`).join('')}</select></label>`;
    }

    async function renderSales(root, opts = {}) {
        if (!root) return;
        css();
        S.root = root;
        if (opts.page) S.page = opts.page;
        S.lang = curLang();
        const gen = ++S.gen;
        if (!root.querySelector('.qt')) root.innerHTML = `<div class="qa qt">${loading()}</div>`;
        const wrap = root.querySelector('.qt');
        let html = '';
        try {
            if (S.page === 'umumiy') html = await pUmumiy();
            else if (S.page === 'menejerlar') html = S.managerId ? await pManager(S.managerId) : await pMenejerlar();
            else if (S.page === 'qongiroqlar') html = await pCalls();
            else if (S.page === 'rejalar') html = S.planId ? await pPlan(S.planId) : await pPlans();
            else if (S.page === 'hafta') html = await pWeekly();
            else html = await pSettings();
        } catch (e) { html = subnav(null) + err(e); }
        if (gen !== S.gen) return;
        wrap.innerHTML = html;
        bindSales(wrap);
    }
    const rerender = () => renderSales(S.root);
    function go(page, extra = {}) { S.page = page; S.managerId = extra.managerId || null; S.planId = extra.planId || null; if (extra.f) S.f = { ...S.f, ...extra.f, page: 0 }; rerender(); S.root?.scrollIntoView?.({ block: 'start' }); }

    function bindSales(wrap) {
        wrap.onclick = async e => {
            const b = e.target.closest('[data-qt-sub],[data-qt-go],[data-qt-man],[data-qt-call],[data-qt-plan],[data-qt-act],[data-qt-f],[data-qt-pg],[data-qt-back],[data-qt-task],[data-qt-dec],[data-qt-run],[data-qt-save],[data-qt-lead]');
            if (!b) return;
            const d = b.dataset;
            if (d.qtSub) { if (d.qtSub === 'qongiroqlar' && S.page !== 'qongiroqlar' && !S.per) S.per = 'today2'; else if (d.qtSub !== 'qongiroqlar' && S.per === 'today2') S.per = ''; return go(d.qtSub, d.qtSub === 'qongiroqlar' ? { f: { type: '', manager: '', appeal: false, violations: false, status: '' } } : {}); }
            if (d.qtGo) { const [pg, k, v] = d.qtGo.split(':'); return go(pg, k ? { f: { [k]: v === '1' ? true : v } } : {}); }
            if (d.qtMan) return go('menejerlar', { managerId: d.qtMan });
            if (d.qtCall) return openCall(d.qtCall, { onClose: () => { if (S.page === 'qongiroqlar') rerender(); } });
            if (d.qtLead) { if (typeof openLeadOverview === 'function') openLeadOverview(d.qtLeadLang || S.lang || 'russian', d.qtLead); return; }
            if (d.qtPlan) return go('rejalar', { planId: d.qtPlan });
            if (d.qtBack) return go(d.qtBack);
            if (d.qtF) {
                const [k, v] = d.qtF.split(':');
                if (k === 'appeal' || k === 'violations') S.f[k] = !S.f[k]; else S.f[k] = v || '';
                S.f.page = 0; return rerender();
            }
            if (d.qtPg) { S.f.page = Math.max(0, S.f.page + Number(d.qtPg)); return rerender(); }
            if (d.qtAct) return planAct(d.qtActId, d.qtAct, b);
            if (d.qtTask) return planAct(d.qtTaskPlan, 'task', b, { taskId: d.qtTask, done: !b.classList.contains('on') });
            if (d.qtDec) return planAct(d.qtDecPlan, 'decision', b, { choice: d.qtDec });
            if (d.qtRun) {
                if (!confirm('Haftalik hisobot va rejalarni hozir qayta hisoblaymi? Claude Opus chaqiriladi.')) return;
                b.disabled = true;
                try { await api('/weekly/run', { method: 'POST' }); toast('Hisobot yangilandi'); } catch (x) { alert(x.message || x); }
                return rerender();
            }
            if (d.qtSave) return saveSettings(wrap, b);
        };
        wrap.onchange = e => {
            const p = e.target.closest('[data-qt-per]'); if (p) { S.per = p.value; return rerender(); }
            const w = e.target.closest('[data-qt-week]'); if (w) { S.week = w.value; return rerender(); }
            const m = e.target.closest('[data-qt-fman]'); if (m) { S.f.manager = m.value; S.f.page = 0; return rerender(); }
            const st2 = e.target.closest('[data-qt-fstatus]'); if (st2) { S.f.status = st2.value; S.f.page = 0; return rerender(); }
            const lm = e.target.closest('[data-qt-lineman]'); if (lm) { S.lineMan = lm.value; return rerender(); }
        };
    }

    async function planAct(id, action, btn, body = {}) {
        if (action === 'edit') return editPlan(id);
        if (action === 'note') { const text = prompt('1:1 izohi (menejer koʻradi):'); if (!text) return; body = { text }; }
        if (action === 'cancel' && !confirm('Rejani bekor qilamizmi?')) return;
        if (action === 'decision' && !confirm('Qaror qabul qilinsinmi?')) return;
        if (btn) btn.disabled = true;
        try {
            await api(`/plans/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify(body) });
            toast({ approve: 'Reja tasdiqlandi — menejerga chiqdi', remind: 'Menejerga eslatma yuborildi', note: 'Izoh saqlandi', cancel: 'Reja bekor qilindi', decision: 'Qaror saqlandi' }[action] || 'Saqlandi');
        } catch (x) { alert(x.message || x); }
        if (S.root?.isConnected) rerender();
        if (PH.root?.isConnected) PH.refresh?.();
    }
    async function editPlan(id) {
        let d; try { d = await api('/plans/' + encodeURIComponent(id), { fresh: true }); } catch (x) { return alert(x.message || x); }
        const p = d.plan;
        const weeks = p.weeks.map((w, i) => `<div class="qa-cd" style="gap:8px;padding:12px"><span class="qa-sec">${esc(w.label)}</span><input class="qa-in" data-w="${i}" data-k="title" value="${esc(w.title)}" aria-label="Hafta fokusi">${w.tasks.map((tk, j) => `<div class="qa-row" style="gap:8px"><select class="qa-in" style="width:120px" data-w="${i}" data-t="${j}" data-k="who" aria-label="Kim">${['Menejer', 'ROP', 'AI'].map(x => `<option${tk.who === x ? ' selected' : ''}>${x}</option>`).join('')}</select><input class="qa-in" data-w="${i}" data-t="${j}" data-k="text" value="${esc(tk.text)}" aria-label="Vazifa"></div>`).join('')}</div>`).join('');
        const goals = p.goals.map((g, i) => `<label class="qa-row" style="gap:8px;font-size:13px"><span style="flex:1">${esc(g.label)}</span><span class="qa-note">maqsad</span><input class="qa-in" style="width:90px" type="number" data-g="${i}" value="${esc(g.target)}" aria-label="Maqsad"></label>`).join('');
        openModal(`Rejani tahrirlash · ${p.managerName}`, `<div class="qa" style="display:flex;flex-direction:column;gap:12px"><div class="qa-cd" style="gap:8px;padding:12px"><span class="qa-sec">Maqsadlar</span>${goals}</div>${weeks}</div>`,
            `<button type="button" class="qa-btn" onclick="closeModal()">Bekor qilish</button><button type="button" class="qa-btn qa-pri" id="qtPlanSave">Saqlash</button>`, { wide: true });
        document.getElementById('qtPlanSave').onclick = async () => {
            const body = document.getElementById('modalBody');
            const W = p.weeks.map(w => ({ title: w.title, tasks: w.tasks.map(x => ({ ...x })) }));
            body.querySelectorAll('[data-w]').forEach(el => { const w = W[el.dataset.w]; if (el.dataset.t != null) w.tasks[el.dataset.t][el.dataset.k] = el.value; else w[el.dataset.k] = el.value; });
            const G = p.goals.map((g, i) => ({ ...g, target: Number(body.querySelector(`[data-g="${i}"]`)?.value) || g.target }));
            try { await api(`/plans/${encodeURIComponent(id)}/edit`, { method: 'POST', body: JSON.stringify({ weeks: W, goals: G }) }); closeModal(); toast('Reja saqlandi'); rerender(); if (PH.root?.isConnected) PH.refresh?.(); } catch (x) { alert(x.message || x); }
        };
    }

    // ── Umumiy ──
    async function pUmumiy() {
        const d = await api('/stats' + q(S));
        S.counts = { appeals: d.pendingAppeals || 0, plans: d.pendingPlans || 0 };
        const k = d.kpis;
        const kpis = `<div class="qt-kpis">${kpi(k.analyzed, 'Tahlil qilingan · roʻyxat →', { go: 'qongiroqlar' })}${kpi(`${k.score ?? '—'} ${k.scoreDelta != null ? `<small style="font-size:13px;color:${k.scoreDelta < 0 ? '#B42318' : '#067647'}">${k.scoreDelta >= 0 ? '+' : ''}${k.scoreDelta}</small>` : ''}`, `Jamoa bali · ${grade(k.score)[0]}`)}${kpi(k.trialPct != null ? k.trialPct + '%' : '—', '1-qoʻngʻiroqdan sinovga')}${kpi(`${k.sales.count} · ${mln(k.sales.amount)}`, 'Sotuv (qoʻngʻiroqli lidlar)')}${kpi(k.violations, 'Qoida buzilishi · roʻyxat →', { color: k.violations ? '#B42318' : '', go: 'qongiroqlar:violations:1' })}${kpi(k.lost ? '~' + mln(k.lost) : '0', 'Qoʻldan ketgan ⓘ', { color: k.lost ? '#B42318' : '', title: LOSTNOTE })}</div>`;
        if (!k.analyzed) return subnav(d) + kpis + empty('Bu davrda tahlil qilingan qoʻngʻiroq yoʻq', 'Menejerlar Jamoa ilovasi orqali qoʻngʻiroq qilganda yozuvlar avtomatik tahlil qilinadi.');
        const ta = d.teamAxes || {};
        const heatRows = d.heat.map(m => `<tr><td style="padding:3px 8px 3px 0"><button type="button" class="nm" data-qt-man="${esc(m.id)}">${av(m.name, 28, m.avatar, m.id)}${esc(shortName(m.name))}</button></td>${AXES.map(a => { const v = m.axes?.[a]; const c = heat(v); return `<td><button type="button" class="c" data-qt-man="${esc(m.id)}" style="background:${c[0]};color:${c[1]}" aria-label="${esc(m.name)} · ${AX[a]} ${v == null ? '—' : Math.round(v)}">${v == null ? '—' : Math.round(v)}</button></td>`; }).join('')}<td style="padding:3px 0 3px 8px">${gtag(m.score)}</td></tr>`).join('');
        const teamRow = `<tr><td style="font-size:12px;font-weight:800;color:#3A4456">Jamoa*</td>${AXES.map(a => `<td style="text-align:center;font-size:12px;font-weight:800;color:${heat(ta[a])[1]}">${one(ta[a])}</td>`).join('')}<td>${gtag(k.score)}</td></tr>`;
        const heatmap = `<table class="qt-heat"><thead><tr><th></th>${AXES.map(a => `<th>${AX[a]}</th>`).join('')}<th style="text-align:left;padding-left:8px">Ball</th></tr></thead><tbody>${heatRows}${teamRow}</tbody></table>`;
        const sm = d.summary || {};
        const summary = sm.weak?.length ? `<div class="qa-al b"><span class="i">${ic('spark', 16)}</span><div><b>AI xulosa:</b> jamoaning eng zaif bosqichlari — <b>${esc(sm.weak[0])}</b>${sm.weak[1] ? ` va <b>${esc(sm.weak[1])}</b>` : ''}.${sm.hiPct != null && sm.loPct != null ? ` Ball 80+ boʻlgan 1-qoʻngʻiroqlarda sinovga yozilish <b>${sm.hiPct}%</b>, 60 dan past boʻlganlarda — <b>${sm.loPct}%</b>.` : ''} <span class="qa-note">${LOSTNOTE}.</span></div></div>` : '';
        const vk = k.violationsByKind || [];
        const viol = `<div class="qa-cd" style="gap:8px;padding:12px 14px"><b class="qt-h">${k.violations} qoida buzilishi · turi boʻyicha</b>${vk.length ? `<div class="qa-row" style="gap:8px;flex-wrap:wrap">${vk.map((v, i) => `<button type="button" class="qa-tg ${i ? 'g-o' : 'g-z'}" style="font-size:12px;padding:5px 10px;border:0;cursor:pointer;min-height:32px" data-qt-go="qongiroqlar:violations:1">${esc(v.label)} · ${v.count}</button>`).join('')}</div>` : '<span class="qa-note">Bu davrda qoida buzilmadi.</span>'}</div>`;
        const mans = d.managers || [];
        const lm = mans.find(m => m.id === S.lineMan) || mans[mans.length - 1] || null;
        const series = [lm ? (d.weekly.byManager[lm.id] || []) : [], d.weekly.team];
        const lineCard = `<div class="qa-cd" style="gap:4px;padding:12px 14px"><div class="qa-row"><b class="qt-h" style="flex:1">Haftalik ball</b>${leg(lm ? shortName(lm.name) : '—', 'Jamoa')}<label class="qt-per" style="margin-left:8px"><span class="qa-chip" style="font-size:12px">Menejer ⌄</span><select data-qt-lineman aria-label="Menejer">${mans.map(m => `<option value="${esc(m.id)}"${lm && lm.id === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label></div>${line(series, d.weekly.labels, { w: 480, h: 150, threshold: d.settings?.planThreshold || 70 })}</div>`;
        const f = d.funnel, fun = [['1-qoʻngʻiroq qilindi', f.first, '#0057B8'], ['Sinovga yozildi', f.booked, '#2E7BD6'], ['Sinovga keldi', f.attended, '#5B30B5'], ['Toʻladi', f.paid, '#067647']];
        const funnel = `<div class="qa-cd" style="gap:6px;padding:10px 14px"><b class="qt-h">Voronka · 1-qoʻngʻiroqdan</b>${fun.map(([a, n, c], i) => `<div class="qt-fun"><span style="width:140px">${a}</span>${bar(f.first ? n / f.first * 100 : 0, c, 10)}<b style="width:26px;text-align:right">${n}</b><span class="qa-note" style="width:34px;text-align:right">${i && fun[i - 1][1] ? Math.round(n / fun[i - 1][1] * 100) + '%' : ''}</span></div>`).join('')}</div>`;
        const alerts = `<div class="qa-cd" style="gap:0;padding:8px 14px"><div class="qa-row" style="padding-bottom:4px"><b class="qt-h" style="flex:1">Hozir eʼtibor bering</b><span class="qa-tg ${d.alerts.length ? 'g-z' : 'g-a'}">${d.alerts.length}</span></div>${d.alerts.length ? d.alerts.slice(0, 6).map(alertRow).join('') : '<span class="qa-note" style="padding:8px 0">Hozircha shoshilinch holat yoʻq.</span>'}</div>`;
        return `${subnav(d)}${kpis}<div class="qt-g2"><div class="qt-col"><div class="qa-cd" style="gap:8px"><div class="qa-row"><b class="qt-h" style="flex:1">Menejer × bosqich (0–10)</b><span class="qa-note">Katakni bosing — menejer profili</span></div>${heatmap}<span class="qa-note" style="font-size:11px">Ball = 7 bosqich oʻrtachasi × 10. *Jamoa — qoʻngʻiroq soniga ogʻirlikli.</span></div>${summary}${viol}</div><div class="qt-col" style="gap:12px">${lineCard}${funnel}${alerts}</div></div>`;
    }
    function alertRow(a) {
        const attr = a.planId ? `data-qt-plan="${esc(a.planId)}"` : a.callId ? `data-qt-call="${esc(a.callId)}"` : '';
        return `<button type="button" class="qt-alr" ${attr}><span class="qa-tg ${toneCls[a.tone] || 'g-n'}" style="width:78px;justify-content:center">${esc(a.label)}</span><span style="flex:1">${esc(a.title)}${a.sub ? ' · ' + esc(a.sub) : ''}</span>${ic('chev', 16)}</button>`;
    }

    // ── Menejerlar ──
    const planTag = m => {
        const p = m.plan || m.planHint;
        if (!p) return '<span class="qa-tg g-a">Kerak emas</span>';
        const short = String(p.text).replace(/:[^·]*·/, ' ·');
        const tag = `<span class="qa-tg ${toneCls[p.tone] || 'g-n'}" title="${esc(p.text)}">${esc(short)}</span>`;
        return m.plan ? `<button type="button" class="qt-lnk qt-tagw" data-qt-plan="${esc(m.plan.id)}">${tag}</button>` : `<span class="qt-tagw">${tag}</span>`;
    };
    async function pMenejerlar() {
        const d = await api('/stats' + q(S));
        S.counts = { appeals: d.pendingAppeals || 0, plans: d.pendingPlans || 0 };
        const set = d.settings || {};
        const rows = d.managers.map((m, i) => `<tr class="lk" data-qt-man="${esc(m.id)}"><td><b style="font-size:16px;color:#4B5563">${i + 1}</b></td><td><span class="qa-row" style="gap:10px">${av(m.name, 34, m.avatar, m.id)}<b>${esc(m.name)}</b></span></td><td>${gtag(m.score)}</td><td>${delta(m.delta)}</td><td>${spark(m.spark)}</td><td>${m.analyzed}</td><td>${m.trialPct != null ? m.trialPct + '%' : '—'}</td><td style="white-space:nowrap">${m.sales.count} · ${mln(m.sales.amount)}</td><td style="font-weight:700;color:${m.violations >= (set.miniViolations || 5) ? '#B42318' : '#0B1220'}">${m.violations}</td><td>${m.weakest ? `<span class="qa-tg g-z">${esc(m.weakest.label)} ${Math.round(m.weakest.value)}</span>` : '—'}</td><td>${planTag(m)}</td></tr>`).join('');
        const table = d.managers.length ? `<div class="qa-cd qt-tbw" style="padding:6px 12px"><table class="qt-tb"><thead><tr><th>#</th><th>Menejer</th><th>Ball</th><th>Hafta</th><th>6 hafta</th><th>Tahlil</th><th>Sinovga</th><th title="Qoʻngʻiroqli lidlar">Sotuv (qoʻngʻ. lidlar)</th><th>Buzilish</th><th>Eng zaif</th><th>Rivojlanish rejasi</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('Bu davrda baholangan menejer yoʻq');
        return `${subnav(d)}${table}<div class="qt-g2" style="grid-template-columns:1fr 1fr"><div class="qa-cd" style="gap:4px"><b class="qt-h">Reja qachon ochiladi va yopiladi</b>${rulesBlock(set)}</div><div class="qa-cd" style="gap:8px"><b class="qt-h">Ball va daraja</b><span class="qa-note" style="font-size:13px">Har qoʻngʻiroq oʻz turi mezonlari boʻyicha 100 ballik. Menejer bali — hafta qoʻngʻiroqlarining 7 bosqich oʻrtachasi × 10. ${set.minSeconds || 30} soniyadan qisqa va yozuvi yoʻq qoʻngʻiroqlar kirmaydi; “skript muammosi” ballni tushirmaydi.</span><div class="qa-row" style="gap:6px;flex-wrap:wrap"><span class="qa-tg g-z">0–59 ZAIF</span><span class="qa-tg g-o">60–79 OʻRTA</span><span class="qa-tg g-y">80–89 YAXSHI</span><span class="qa-tg g-a">90+ AʼLO</span></div><button type="button" class="qa-btn" style="align-self:flex-start;min-height:44px" data-qt-sub="sozlama">Mezonlar va qoidalar</button></div></div>`;
    }
    const rulesBlock = s => st('hf', `Ball ${s.planThreshold || 70} dan past — ${s.consecutiveWeeks || 2} hafta ketma-ket`, `AI ${s.planWeeks || 3} haftalik reja tuzadi → ROP tasdiqlaydi → menejerga chiqadi`)
        + st('hf', `Haftasiga ${s.miniViolations || 5}+ qoida buzilishi`, `${s.miniWeeks || 1} haftalik mini-reja; faol reja boʻlsa, unga qoʻshiladi`)
        + st('ok', 'Reja yopiladi', `${s.exitWeeks || 2} hafta ketma-ket ball ≥ ${s.planThreshold || 70} va asosiy maqsad bajarilsa (yopish ≥ ${s.closeTarget || 60}%)`)
        + st('no', `${s.adminAfterCycle || 2}-tsikl ham natijasiz`, 'Admin qarori: yangi lidlar ulushi kamaytiriladi yoki qayta oʻqitish');

    // ── Menejer profili (ROP) ──
    function stageBars(stages, fs = 13, w = 200) {
        return stages.map(s => `<div class="qa-row" style="gap:10px;font-size:${fs}px"><span style="width:${w}px">${esc(s.label)}</span>${bar(s.pct, stageColor(s.pct ?? 0), 10)}<b style="width:38px;text-align:right">${s.pct == null ? '—' : s.pct + '%'}</b><span style="width:30px;text-align:right;font-size:12px;font-weight:700;color:${!s.delta ? '#4B5563' : s.delta > 0 ? '#067647' : '#B42318'}">${s.delta == null ? '' : (s.delta > 0 ? '+' : '') + s.delta}</span></div>`).join('');
    }
    const byTypeList = list => list.map(x => `<div class="qa-row" style="font-size:13px;padding:6px 0;border-bottom:1px solid #EEF1F6"><span style="flex:1">${esc(x.label)}${x.approximate ? '*' : ''}</span><span class="qa-note" style="width:44px">${x.count} ta</span>${gtag(x.score)}</div>`).join('');
    function issuesList(issues, { link = true } = {}) {
        if (!issues.length) return '<span class="qa-note">Takrorlanayotgan xato topilmadi.</span>';
        return issues.map(i => {
            const ex = i.example?.lead ? `misol: ${esc(i.example.lead)}${i.example.t ? ', ' + esc(i.example.t) : ''}` : '';
            const sub = [i.sub, ex].filter(Boolean).join(' · ');
            const tag = link && i.example?.callId ? 'button type="button"' : 'div';
            return `<${tag} class="qa-al ${i.tone}" style="padding:10px"${link && i.example?.callId ? ` data-qt-call="${esc(i.example.callId)}"` : ''}><span class="i"><b>${i.count}</b></span><div><b>${esc(i.title)}</b><br><span class="qa-note">${sub}</span></div></${tag.split(' ')[0]}>`;
        }).join('');
    }
    async function pManager(id) {
        const d = await api('/manager/' + encodeURIComponent(id) + q(S));
        const k = d.kpis;
        const head = `<div class="qa-cd" style="flex-direction:row;align-items:center;gap:16px;padding:12px 18px;flex-wrap:wrap"><button type="button" class="qa-ib" data-qt-back="menejerlar" aria-label="Orqaga">${ic('back', 20)}</button>${av(d.name, 50, d.avatar, d.id)}<div style="flex:1;min-width:180px"><b style="font-size:20px">${esc(d.name)}</b><div class="qa-note">Sotuv menejeri${d.rank ? ` · reytingda ${d.rank}/${d.of}` : ''}</div></div>${scoreBox(k.score, 66, 26)}<div class="qa-kpi" style="border:0;padding:0 8px"><b>${k.graded}</b><span>Tahlil</span></div><div class="qa-kpi" style="border:0;padding:0 8px"><b>${k.trialPct != null ? k.trialPct + '%' : '—'}</b><span>Sinovga</span></div><div class="qa-kpi" style="border:0;padding:0 8px"><b>${k.sales.count} · ${mln(k.sales.amount)}</b><span>Sotuv (qoʻngʻ. lidlar)</span></div><div class="qa-kpi" style="border:0;padding:0 8px"><b style="color:${k.violations ? '#B42318' : '#0B1220'}">${k.violations}</b><span>Buzilish</span></div>${d.plan ? `<button type="button" class="qa-btn qa-pri" data-qt-plan="${esc(d.plan.id)}">Rivojlanish rejasi</button>` : ''}</div>`;
        const left = `<div class="qa-cd" style="align-items:center;gap:4px;padding:10px 12px">${radar(k.axes, 230, { cmp: d.teamAxes, fs: 10.5 })}${leg(shortName(d.name), 'Jamoa')}<div style="width:100%;margin-top:4px">${byTypeList(d.byType)}</div>${d.byType.some(x => x.approximate) ? '<span class="qa-note" style="font-size:11px;align-self:flex-start">*Qarzdorlik — taxminiy (skript boʻlimi tasdiq kutmoqda)</span>' : ''}</div>`;
        const mid = `<div class="qt-col" style="gap:12px"><div class="qa-cd" style="gap:8px"><div class="qa-row"><b class="qt-h" style="flex:1">Skript bosqichlari bajarilishi</b><span class="qa-note">${S.per === 'month' ? 'oʻtgan oyga' : 'oʻtgan haftaga'} nisbatan</span></div>${stageBars(d.stages)}</div><div class="qa-cd" style="gap:2px;padding:12px 14px"><div class="qa-row"><b class="qt-h" style="flex:1">6 hafta</b>${leg(shortName(d.name), 'Jamoa')}</div>${line([d.weekly.me, d.weekly.team], d.weekly.labels, { w: 460, h: 200 })}</div></div>`;
        const best = d.best ? `<div class="qa-cd" style="gap:6px;background:#ECFDF3;border-color:#ABEFC6"><b style="font-size:14px">Eng yaxshi qoʻngʻirogʻi · ${d.best.score}</b><span class="qa-note">${esc(d.best.lead)} · ${esc(d.best.typeLabel)} · ${when(d.best.at)}${d.best.summary ? ' · ' + esc(d.best.summary) : ''}</span><button type="button" class="qa-btn" style="min-height:44px" data-qt-call="${esc(d.best.id)}">Tinglash</button></div>` : '';
        const recent = `<div class="qa-cd" style="gap:0;padding:6px 14px"><span class="qa-sec" style="padding-bottom:2px">Oxirgi qoʻngʻiroqlari</span>${d.recent.length ? d.recent.map(r => `<button type="button" class="qt-mrow" data-qt-call="${esc(r.id)}"><span style="flex:1">${esc(r.lead)} · ${when(r.at)}</span>${r.score != null ? gtag(r.score) : `<span class="qa-tg g-n">${esc(statusText(r))}</span>`}</button>`).join('') : '<span class="qa-note" style="padding:6px 0">Yoʻq</span>'}</div>`;
        const right = `<div class="qt-col" style="gap:12px"><div class="qa-cd" style="gap:8px"><b class="qt-h">Takrorlanayotgan xatolar</b>${issuesList(d.issues)}</div>${best}${recent}</div>`;
        return `${subnav(d)}${head}<div class="qt-pr3">${left}${mid}${right}</div>`;
    }
    const statusText = r => (r.status === 'skipped' ? 'Baholanmaydi' : ['queued', 'transcribing', 'scoring'].includes(r.status) ? 'Baholanmoqda…' : r.status === 'error' ? 'Xato' : '—');

    // ── Qo'ng'iroqlar ──
    async function pCalls() {
        const f = S.f;
        const d = await api('/calls-table' + q(S, { type: f.type, manager: f.manager, appeal: f.appeal ? 1 : '', violations: f.violations ? 1 : '', status: f.status, page: f.page || '' }));
        S.counts.appeals = d.pendingAppeals || 0;
        const chips = [['', 'Barcha turlar'], ...Object.entries(TYPES).map(([k, v]) => [k, k === 'eslatma' ? 'Eslatma · baholanmaydi' : v[0]])].map(([k, l]) => `<button type="button" class="qa-chip${f.type === k ? ' on' : ''}" style="font-size:12px" data-qt-f="type:${k}">${l}</button>`).join('');
        const sel = `<label class="qt-per"><span class="qa-chip" style="font-size:12px">${esc(d.managers.find(m => m.id === f.manager)?.name || 'Menejer')} ⌄</span><select data-qt-fman aria-label="Menejer"><option value="">Barcha menejerlar</option>${d.managers.map(m => `<option value="${esc(m.id)}"${f.manager === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>`
            + `<label class="qt-per"><span class="qa-chip" style="font-size:12px">${{ graded: 'Baholangan', pending: 'Baholanmoqda', skipped: 'Baholanmaydi' }[f.status] || 'Holat'} ⌄</span><select data-qt-fstatus aria-label="Holat"><option value="">Barcha holatlar</option><option value="graded"${f.status === 'graded' ? ' selected' : ''}>Baholangan</option><option value="pending"${f.status === 'pending' ? ' selected' : ''}>Baholanmoqda</option><option value="skipped"${f.status === 'skipped' ? ' selected' : ''}>Baholanmaydi</option></select></label>`
            + `<button type="button" class="qa-chip${f.appeal ? ' on' : ''}" style="font-size:12px;${f.appeal ? '' : 'color:#5B30B5'}" data-qt-f="appeal">Eʼtirozlar · ${d.pendingAppeals || 0}</button><button type="button" class="qa-chip${f.violations ? ' on' : ''}" style="font-size:12px" data-qt-f="violations">Faqat buzilish</button>`;
        const rows = d.rows.map(r => {
            let sc;
            if (r.score != null) sc = gtag(r.score) + (r.approximate ? ' <span class="qa-note">taxminiy</span>' : '');
            else if (['queued', 'transcribing', 'scoring'].includes(r.status)) sc = '<span class="qa-tg g-n"><i class="qa-dot"></i> Baholanmoqda…</span>';
            else if (r.status === 'skipped' && r.durationSec && r.durationSec < 30) sc = '<span class="qa-tg g-n">30 son. dan qisqa</span>';
            else if (r.status === 'error') sc = '<span class="qa-tg g-n" title="Tahlil bajarilmadi — qayta urinish mumkin">Tahlil xatosi</span>';
            else sc = '<span class="qa-tg g-n">Baholanmaydi</span>';
            const warns = [r.appeal === 'pending' ? `<span class="qa-tg g-p">Eʼtiroz · ROP ${r.appealLeft} soat</span>` : '', ...r.violations.map(v => `<span class="qa-tg g-z">${ic('warn', 12)} ${esc(v)}</span>`), r.monologue ? `<span class="qa-tg g-z">${ic('warn', 12)} Monolog ${Math.round((r.durationSec || 0) / 60)} daq</span>` : ''].filter(Boolean).join(' ');
            return `<tr class="lk" data-qt-call="${esc(r.id)}"><td class="qa-note" style="white-space:nowrap">${when(r.at)}</td><td><b>${esc(shortName(r.manager))}</b></td><td><b style="color:#0057B8">${esc(r.lead)}</b></td><td>${typeTag(r.type)}</td><td>${dur(r.durationSec)}</td><td>${sc}</td><td>${esc(r.outcome || '—')}</td><td>${r.probability != null ? r.probability + '%' : '—'}</td><td>${warns || '<span class="qa-note">—</span>'}</td></tr>`;
        }).join('');
        const from = d.page * d.size;
        const table = d.total ? `<div class="qa-cd qt-tbw" style="padding:4px 10px"><table class="qt-tb"><thead><tr><th>Vaqt</th><th>Menejer</th><th>Mijoz</th><th>Tur</th><th>Davom.</th><th>Ball</th><th>Natija / keyingi qadam</th><th>Ehtimol</th><th>Ogohlantirish / amal</th></tr></thead><tbody>${rows}</tbody></table><div class="qa-row" style="padding:10px 6px 4px"><span class="qa-note" style="flex:1">${from + 1}–${from + d.rows.length} / ${d.total} koʻrsatilmoqda${d.rows.some(r => r.approximate) ? ' · Qarzdorlik — taxminiy baho (skript boʻlimi tasdiq kutmoqda)' : ''}</span><button type="button" class="qa-btn" style="min-height:44px;font-size:13px" data-qt-pg="-1"${d.page ? '' : ' disabled'}>Oldingi</button><button type="button" class="qa-btn qa-pri" style="min-height:44px;font-size:13px" data-qt-pg="1"${from + d.rows.length < d.total ? '' : ' disabled'}>Keyingi</button></div></div>` : empty('Filtrga mos qoʻngʻiroq yoʻq');
        return `${subnav(d)}<div class="qa-row" style="gap:8px;flex-wrap:wrap">${chips}<span style="flex:1"></span>${sel}</div>${table}`;
    }

    // ── Rivojlanish rejalari ──
    const ACTIVE = ['pending', 'active', 'decision'];
    function planStatusTag(p) {
        if (p.status === 'pending') return '<span class="qa-tg g-o">ROP tasdigʻi kutilmoqda</span>';
        if (p.status === 'decision') return '<span class="qa-tg g-z">Admin qarori kerak</span>';
        if (p.status === 'closed') return '<span class="qa-tg g-a">Yopildi</span>';
        if (p.status === 'cancelled') return '<span class="qa-tg g-n">Bekor qilindi</span>';
        const failed = p.weeks.some(w => w.status === 'failed');
        const cur = p.weeks.find(w => w.status === 'current');
        return failed ? `<span class="qa-tg g-z">${p.weeks.filter(w => w.status === 'failed').length}-hafta bajarilmadi</span>` : `<span class="qa-tg g-y">${cur ? cur.i + 1 : p.weeks.length}/${p.weeks.length} hafta</span>`;
    }
    async function pPlans() {
        const d = await api('/plans' + q(S));
        const plans = d.plans;
        const act = plans.filter(p => ACTIVE.includes(p.status));
        S.counts.plans = plans.filter(p => p.status === 'pending').length;
        const watch = d.managers.filter(m => !m.plan && m.planHint);
        const closed = plans.filter(p => !ACTIVE.includes(p.status));
        const pills = `<div class="qa-row" style="gap:8px;flex-wrap:wrap"><span class="qa-tg g-y" style="font-size:13px;padding:6px 12px">${plans.filter(p => p.status === 'active').length} faol</span><span class="qa-tg g-o" style="font-size:13px;padding:6px 12px">${S.counts.plans} tasdiq kutmoqda</span>${plans.some(p => p.status === 'decision') ? `<span class="qa-tg g-z" style="font-size:13px;padding:6px 12px">${plans.filter(p => p.status === 'decision').length} admin qarori</span>` : ''}<span class="qa-tg g-n" style="font-size:13px;padding:6px 12px">${watch.length} kuzatuvda</span><span class="qa-tg g-a" style="font-size:13px;padding:6px 12px">${closed.filter(p => p.status === 'closed').length} yopilgan</span></div>`;
        const pend = plans.filter(p => p.status === 'pending').map(p => `<div class="qa-cd" style="flex-direction:row;align-items:center;gap:14px;background:#FFFAEB;border-color:#FEDF89;padding:12px 16px;flex-wrap:wrap"><span style="width:40px;height:40px;border-radius:12px;background:#FEF0C7;color:#93370D;display:grid;place-items:center;flex:none">${ic('spark', 18)}</span><div style="flex:1;min-width:240px;font-size:13px"><b>${esc(p.managerName)} uchun AI ${p.kind === 'mini' ? 'mini-reja' : 'rivojlanish rejasi'} taklif qildi:</b> ${esc(p.reason)}. ${esc(p.weeks.map(w => w.title).filter((x, i, a) => a.indexOf(x) === i).join(' → '))}.</div><button type="button" class="qa-btn" data-qt-act="edit" data-qt-act-id="${esc(p.id)}">Tahrirlash</button><button type="button" class="qa-btn qa-pri" data-qt-act="approve" data-qt-act-id="${esc(p.id)}">Tasdiqlash</button></div>`).join('');
        const cards = act.map(p => {
            const done = p.weeks.filter(w => w.status === 'done' || w.status === 'failed').length;
            const pct = p.status === 'pending' ? 0 : Math.round((done + (p.dayInWeek || 0) / 7) / p.weeks.length * 100);
            return `<button type="button" class="qa-cd" style="gap:8px;padding:12px;text-align:left;font:inherit;cursor:pointer" data-qt-plan="${esc(p.id)}"><div class="qa-row">${av(p.managerName, 36, p.managerAvatar, p.managerId)}<div style="flex:1;min-width:0"><b>${esc(p.managerName)}</b><div class="qa-note">${p.weeks.length ? esc(rangeLabel(p.weeks[0].start, p.weeks[p.weeks.length - 1].end, true)) : ''} · ${p.weeks.length} hafta</div></div>${gtag(d.managers.find(m => m.id === p.managerId)?.score ?? null)}</div><div class="qa-row" style="gap:8px"><span class="qa-sec" style="flex:1">${p.kind === 'mini' ? 'Mini-reja' : `${p.cycle || 1}-tsikl`} · ${esc(p.focusLabel)}</span>${planStatusTag(p)}</div><div class="qa-bar"><i style="width:${pct}%;background:#0057B8"></i></div></button>`;
        }).join('') + watch.map(m => `<button type="button" class="qa-cd" style="gap:8px;padding:12px;text-align:left;font:inherit;cursor:pointer" data-qt-man="${esc(m.id)}"><div class="qa-row">${av(m.name, 36, m.avatar, m.id)}<div style="flex:1"><b>${esc(m.name)}</b><div class="qa-note">Kuzatuvda</div></div>${gtag(m.score)}</div><div class="qa-row" style="gap:8px"><span class="qa-sec" style="flex:1">Reja yoʻq</span><span class="qa-tg g-n">${esc(m.planHint.text)}</span></div><div class="qa-bar"><i style="width:0"></i></div></button>`).join('');
        const hist = `<div class="qa-cd qt-tbw" style="padding:6px 12px"><b class="qt-h" style="padding:8px 0 0">Rejalar tarixi</b><table class="qt-tb"><thead><tr><th>Menejer</th><th>Davr · fokus</th><th>Ball</th><th>Natija</th></tr></thead><tbody>${closed.map(p => `<tr class="lk" data-qt-plan="${esc(p.id)}"><td>${esc(p.managerName)}</td><td>${p.weeks.length ? esc(rangeLabel(p.weeks[0].start, p.weeks[p.weeks.length - 1].end, true)) : ''} · ${esc(p.focusLabel)}</td><td>${(() => { const g = p.goals.find(x => x.key === 'score'); return g ? `${g.start ?? '—'} → ${g.cur ?? '—'}` : '—'; })()}</td><td>${planStatusTag(p)}${p.decision ? ` <span class="qa-note">${esc(DEC[p.decision.choice] || '')}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="qa-note">Hali yopilgan reja yoʻq</td></tr>'}</tbody></table></div>`;
        const body = act.length || watch.length || pend ? `${pend}<div class="qt-plans">${cards}</div>${hist}` : empty('Hozircha rivojlanish rejasi yoʻq', 'Har dushanba 09:00 da AI ball va qoida buzilishlarini tekshiradi; kerak boʻlsa reja taklif qiladi.') + hist;
        return `${subnav(null)}${pills}${body}`;
    }
    const DEC = { ulush: 'Lid ulushi kamaytirildi', qayta_oqitish: 'Qayta oʻqitish', yana_hafta: 'Yana 1 hafta' };
    function goalRow(g) {
        const cur = g.cur, target = g.target;
        const ok = cur != null && (g.lower ? cur <= target : cur >= target);
        const p = cur == null ? 0 : g.lower ? (g.start ? Math.max(0, Math.min(100, (g.start - cur) / Math.max(1, g.start - target) * 100)) : (ok ? 100 : 0)) : Math.min(100, target ? cur / target * 100 : 0);
        return `<div class="qt-goal"><div class="qa-row" style="font-size:13px;flex-wrap:wrap"><b style="flex:1">${esc(g.label)}</b><span class="qa-note">${g.start != null ? `reja boshida ${one(g.start)}${g.unit || ''} · ` : ''}hozir <b style="color:#0B1220">${cur == null ? '—' : one(cur) + (g.unit || '')}</b> · maqsad ${target}${g.unit || ''}</span></div><div class="qa-bar" style="height:10px"><i style="height:10px;width:${p.toFixed(0)}%;background:${ok ? '#067647' : '#0057B8'}"></i></div></div>`;
    }
    function taskRow(p, tk, { canRop, canMgr }) {
        const can = tk.who === 'AI' ? false : tk.who === 'ROP' ? canRop : (canRop || canMgr);
        const sub = tk.auto && tk.progress ? `${tk.sub} · bugun ${tk.progress}` : tk.sub;
        const listen = tk.callId ? ` <button type="button" class="qt-lnk" data-qt-call="${esc(tk.callId)}" style="font-size:12px">Tinglash</button>` : '';
        return `<div class="qt-task"><button type="button" class="cb${tk.done ? ' on' : ''}" data-qt-task="${esc(tk.id)}" data-qt-task-plan="${esc(p.id)}" aria-label="${tk.done ? 'Bajarildi' : 'Bajarilmadi'}: ${esc(tk.text)}" aria-pressed="${!!tk.done}"${can ? '' : ' disabled'}>${tk.done ? ic('check', 13, 3) : ''}</button><div class="tx"><b>${esc(tk.text)}</b><div class="qa-note">${esc(sub || '')}${listen}</div></div><span class="qa-tg g-n">${esc(tk.who)}</span></div>`;
    }
    function weekCards(p) {
        return `<div class="qt-weeks">${p.weeks.map(w => `<div class="qa-cd qt-week ${w.status}"><span class="qa-sec">${esc(w.label)}${w.status === 'current' ? ' · joriy' : ''}</span><b style="font-size:14px">${esc(w.title)}</b><span class="qa-note">${esc(w.result || (w.status === 'current' ? `${p.dayInWeek || 1}-kun` : w.status === 'future' ? (AX[w.focus] ? `Maqsad: ${AX[w.focus]} bosqichi (0–10) ≥ 7` : '') : ''))}</span></div>`).join('')}</div>`;
    }
    const goalTxt = p => { const g = p?.goals?.[0]; return g ? ` (${String(g.label).toLowerCase()} ${g.lower ? '≤' : '≥'} ${g.target}${g.key === 'close' ? '%' : ''})` : ''; };
    const alTitle = a => a.kind === 'reja' ? a.label + ' tasdiq kutmoqda' : a.kind === 'etiroz' ? a.label + ' · ' + String(a.title || '').split(' · ')[0] : a.label;
    const alSub = a => a.kind === 'etiroz' ? String(a.title || '').split(' · ').slice(1).join(' · ') : a.kind === 'reja' ? String(a.title || '').split(' · ')[0] : a.title;
    function planBody(p, { canRop, canMgr, settings = {}, extra = '', goalsTitle = '' }) {
        const cur = p.weeks.find(w => w.status === 'current') || p.weeks[p.weeks.length - 1];
        const notes = (p.notes || []).slice(-2).reverse().map(n => `<div class="qa-say" style="margin-top:10px"><b>1:1</b><span>ROP izohi (${esc(when(Date.parse(n.at)))}): “${esc(n.text)}”</span></div>`).join('');
        const calls = (p.current?.calls || []).slice().reverse().slice(0, 5);
        const callList = calls.length ? `<span class="qa-sec" style="padding:12px 0 2px">Shu hafta · ${esc(AX[cur?.focus] || 'fokus')}</span>${calls.map(c => `<button type="button" class="qt-mrow" data-qt-call="${esc(c.id)}"><span style="flex:1">${when(c.at)}</span><span class="qa-tg ${c.closed ? 'g-a' : 'g-z'}">${c.closed ? 'yopildi' + (c.next ? ' · ' + esc(c.next) : '') : 'yopilmadi'}</span></button>`).join('')}` : '';
        const tasks = `<div class="qa-cd" style="gap:0;padding:6px 16px"><div class="qa-row" style="padding:8px 0 2px"><span class="qa-sec" style="flex:1">Vazifalar · ${esc(cur ? cur.label : '')}</span><span class="qa-note">${p.current ? `${p.current.done}/${p.current.total} bajarildi` : ''}</span></div>${cur ? cur.tasks.map(tk => taskRow(p, tk, { canRop, canMgr })).join('') : ''}${notes}${extra}${callList}</div>`;
        const goals = `<div class="qa-cd" style="gap:12px"><b class="qt-h">${goalsTitle || `${esc(cur ? cur.label : '')} maqsadlari · AI har qoʻngʻiroqdan oʻlchaydi`}</b>${p.goals.map(goalRow).join('')}</div>`;
        const exit = `<div class="qa-cd" style="gap:6px"><b class="qt-h">Chiqish va oqibatlar</b>${st('ok', 'Reja yopiladi', `${settings.exitWeeks || 2} hafta ketma-ket ball ≥ ${settings.planThreshold || 70} va asosiy maqsad bajarilsa${goalTxt(p)}`)}${st('hf', 'Hafta bajarilmasa', 'ROP bilan qayta 1:1; keyingi hafta fokusi davom etadi; tsikl oxirida natija boʻlmasa — keyingi tsikl')}${st('no', `${settings.adminAfterCycle || 2}-tsikl ham natijasiz`, 'Admin qarori: yangi lidlar ulushi kamayadi yoki qayta oʻqitish')}</div>`;
        return { tasks, goals, exit };
    }
    async function pPlan(id) {
        const [d, set] = await Promise.all([api('/plans/' + encodeURIComponent(id) + q(S)), api('/settings').catch(() => ({}))]);
        const p = d.plan;
        const canRop = canTeam() && p.status === 'active';
        const b = planBody(p, { canRop, canMgr: false, settings: set });
        const acts = [];
        if (p.status === 'pending') acts.push(`<button type="button" class="qa-btn" data-qt-act="edit" data-qt-act-id="${esc(p.id)}">Tahrirlash</button><button type="button" class="qa-btn qa-pri" data-qt-act="approve" data-qt-act-id="${esc(p.id)}">Tasdiqlash</button>`);
        if (p.status === 'active') acts.push(`<button type="button" class="qa-btn" data-qt-act="note" data-qt-act-id="${esc(p.id)}">1:1 izohi</button><button type="button" class="qa-btn" data-qt-act="edit" data-qt-act-id="${esc(p.id)}">Tahrirlash</button><button type="button" class="qa-btn qa-pri" data-qt-act="remind" data-qt-act-id="${esc(p.id)}">${ic('send', 16)} Menejerga eslatish</button>`);
        const decision = p.status === 'decision' ? `<div class="qa-cd" style="gap:8px;padding:12px;background:#FFFAEB;border-color:#FEDF89"><b>${p.cycle || 2}-tsikl natijasiz — qaror kerak</b><span class="qa-note">${isDirector() ? 'Tanlang:' : 'Qarorni admin qabul qiladi.'}</span><div class="qa-row" style="gap:6px;flex-wrap:wrap">${Object.entries(DEC).map(([k, l]) => `<button type="button" class="qa-btn" style="flex:1;font-size:13px" data-qt-dec="${k}" data-qt-dec-plan="${esc(p.id)}"${isDirector() ? '' : ' disabled'}>${l}</button>`).join('')}</div></div>` : '';
        const by = [p.author === 'AI' ? `AI tuzdi ${when(Date.parse(p.createdAt))}` : '', p.approvedBy ? `${esc(p.approvedBy)} tasdiqladi` : '', `sabab: ${esc(p.reason)}`].filter(Boolean).join(' · ');
        const head = `<div class="qa-cd" style="flex-direction:row;align-items:center;gap:14px;padding:12px 16px;flex-wrap:wrap"><button type="button" class="qa-ib" data-qt-back="rejalar" aria-label="Orqaga">${ic('back', 20)}</button><button type="button" class="qt-lnk" data-qt-man="${esc(p.managerId)}" aria-label="Menejer profili">${av(p.managerName, 44, p.managerAvatar, p.managerId)}</button><div style="flex:1;min-width:240px"><b style="font-size:18px"><button type="button" class="qt-lnk" style="color:#0B1220;font-size:18px" data-qt-man="${esc(p.managerId)}">${esc(shortName(p.managerName))}</button> · ${p.kind === 'mini' ? 'Mini-reja' : `Rivojlanish rejasi (${p.cycle || 1}-tsikl)`}</b><div class="qa-note" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(p.reason)}">${p.weeks.length ? esc(rangeLabel(p.weeks[0].start, p.weeks[p.weeks.length - 1].end)) + ' · ' : ''}${by}</div></div>${planStatusTag(p)}${acts.join('')}</div>`;
        return `${subnav(null)}${head}${decision}${weekCards(p)}<div class="qt-g2" style="grid-template-columns:1fr 1.1fr"><div class="qt-col" style="gap:12px">${b.goals}${b.exit}${p.status === 'active' || p.status === 'pending' ? `<button type="button" class="qt-lnk" style="align-self:flex-start;color:#B42318;min-height:44px" data-qt-act="cancel" data-qt-act-id="${esc(p.id)}">Rejani bekor qilish</button>` : ''}</div>${b.tasks}</div>`;
    }

    // ── Haftalik hisobot ──
    async function pWeekly() {
        const d = await api('/weekly' + q(S, { week: S.week }));
        const r = d.report, t = d.team;
        const k = t.kpis; // hisobot haftasi bo'yicha, lidlar bilan (sinov, sotuv)
        const run = isDirector() ? `<button type="button" class="qa-btn" style="min-height:44px;font-size:13px" data-qt-run="1">Hozir qayta hisoblash</button>` : '';
        const kpis = `<div class="qt-kpis">${kpi(`${k.score ?? '—'}${t.kpis.scoreDelta != null ? ` <small style="font-size:13px;color:${t.kpis.scoreDelta < 0 ? '#B42318' : '#067647'}">${t.kpis.scoreDelta >= 0 ? '+' : ''}${t.kpis.scoreDelta}</small>` : ''}`, 'Jamoa bali')}${kpi(k.trialPct != null ? k.trialPct + '%' : '—', '1-qoʻngʻiroqdan sinovga')}${kpi(`${k.sales.count} · ${mln(k.sales.amount)}`, 'Sotuv (qoʻngʻ. lidlar)')}${kpi(k.lost ? '~' + mln(k.lost) : '0', 'Qoʻldan ketgan ⓘ', { color: k.lost ? '#B42318' : '', title: LOSTNOTE })}${kpi(usd(d.aiCostUsd), 'AI xarajati · hafta (taxminiy, keshlash bilan)')}</div>`;
        if (!r) return `${subnav(d)}${kpis}${empty('Haftalik hisobot hali tuzilmagan', 'Har dushanba 09:00 da oʻtgan hafta uchun Claude Opus hisobot tuzadi.')}${run ? `<div>${run}</div>` : ''}`;
        const tones = ['r', 'o', 'b'];
        const mistakes = (r.data.mistakes || []).slice(0, 3).map((m, i) => `<div class="qa-al ${tones[i]}" style="padding:10px"><span class="i"><b>${i + 1}</b></span><div><b>${esc(m.title)}${m.count ? ` — ${m.count} marta` : ''}</b><br><span class="qa-note" style="color:${['#7A271A', '#7A2E0E', '#0B3A75'][i]}">${esc(m.detail)}</span></div></div>`).join('') || '<span class="qa-note">Takrorlanayotgan xato topilmadi.</span>';
        const plans = d.plans.map(p => {
            const dec = p.status === 'decision';
            const row = `<button type="button" class="qt-mrow" style="gap:8px" data-qt-plan="${esc(p.id)}">${av(p.managerName, 28, p.managerAvatar, p.managerId)}<span style="flex:1">${esc(shortName(p.managerName))} — ${p.status === 'pending' ? `${p.kind === 'mini' ? 'mini-reja' : 'reja'} ROP tasdigʻini kutmoqda` : dec ? `${p.cycle || 2}-tsikl natijasiz · admin qarori kerak` : esc(p.weeks.filter(w => w.result).slice(-1)[0]?.result || `${p.current?.label || ''} davom etmoqda`)}</span>${ic('chev', 16)}</button>`;
            if (!dec) return row;
            return `<div class="qa-cd" style="gap:8px;padding:10px 12px;background:#FFFAEB;border-color:#FEDF89">${row}<div class="qa-row" style="gap:6px">${Object.entries(DEC).map(([k2, l]) => `<button type="button" class="qa-btn" style="flex:1;font-size:12px;padding:0 8px" data-qt-dec="${k2}" data-qt-dec-plan="${esc(p.id)}"${isDirector() ? '' : ' disabled'}>${l}</button>`).join('')}</div></div>`;
        }).join('') || '<span class="qa-note">Faol reja yoʻq.</span>';
        const issues = (r.data.scriptIssues || []).map(x => st('hf', esc(x.title), esc(x.detail))).join('') || '<span class="qa-note">Skript boʻyicha muammo qayd etilmadi.</span>';
        const mans = t.managers.map(m => `<button type="button" class="qt-mrow" style="padding:1px 0" data-qt-man="${esc(m.id)}">${av(m.name, 22, m.avatar, m.id)}<span style="flex:1">${esc(m.name)}</span>${delta(m.delta)}${gtag(m.score)}</button>`).join('');
        const model = r.model === 'hisob' ? 'Hisobdan (AI ulanmagan)' : esc(r.model.replace('claude-', 'Claude ').replace(/-(\d)-(\d)/, ' $1.$2'));
        return `${subnav(d)}${kpis}<div class="qt-g2" style="grid-template-columns:1.2fr 1fr"><div class="qa-cd" style="gap:6px"><div class="qa-row"><b class="qt-h" style="flex:1">Takrorlanayotgan xatolar · ${esc(rangeLabel(r.weekStart, r.weekStart + 7 * 864e5))}</b><span class="qa-note">${model} · ${when(Date.parse(r.createdAt))}</span></div>${mistakes}${r.data.summary ? `<div class="qa-say"><b>AI</b><span>${esc(r.data.summary)}</span></div>` : ''}<b class="qt-h" style="margin-top:2px">Rejalar natijasi</b>${plans}</div><div class="qa-cd" style="gap:8px"><div class="qa-row"><b class="qt-h" style="flex:1">Skript muammolari</b><span class="qa-tg g-o">Skript uchun · ballga taʼsir qilmaydi</span></div>${issues}<button type="button" class="qa-btn" data-qt-script="1" onclick="window.switchSalesSection&&switchSalesSection('scripts')">Skriptlar boʻlimiga taklif qilish</button><div style="display:flex;flex-direction:column;border-top:1px solid #EEF1F6;padding-top:6px;margin-top:auto"><span class="qa-sec">Menejerlar · hafta</span>${mans}</div>${run}</div></div>`;
    }

    // ── Sozlamalar ──
    const SETF = [['planThreshold', 'Reja chegarasi', ''], ['consecutiveWeeks', 'Ketma-ket', 'hafta'], ['planWeeks', 'Reja muddati', 'hafta'], ['exitWeeks', 'Chiqish ≥70', 'hafta'], ['miniViolations', 'Mini-reja', 'buzilish'], ['miniWeeks', 'Mini muddati', 'hafta'],
        ['adminAfterCycle', 'Admin qarori', 'tsikl'], ['minSeconds', 'Eng qisqa', 'soniya'], ['appealHours', 'Eʼtiroz menejer', 'soat'], ['ropHours', 'Eʼtiroz ROP', 'soat'], ['audioDays', 'Audio saqlash', 'kun'], ['goodFrom', 'YAXSHI dan', ''], ['closeTarget', 'Yopish maqsadi', '%']];
    async function pSettings() {
        const s = await api('/settings', { fresh: true });
        const types = [['1-qoʻngʻiroq', 'Yangi / Urinilmoqda', '1–8 bosqich', 'Ochilish 10 · Ehtiyoj 20 · Ogʻriq 15 · Taqdimot 15 · Narx 15 · Eʼtiroz 10 · Yopish 15'], ['Qayta', 'Bogʻlanildi, “oʻylab koʻraman”dan keyin', '9 + 7-bosqich', 'Vaqtida 15 · Eʼtiroz 35 · Sinovga olib chiqish 20 · Yopish 30'], ['Sinovdan keyin', 'Sinov darsi oʻtgan', '9-bosqich', 'Taassurot 15 · Ehtiyojga bogʻlash 25 · Narx 30 · Yopish 30'], ['Toʻlov', 'Toʻlov jarayonida', 'Yopish: toʻlov va zaklad', 'Muammo 25 · Usullar 20 · Nasiya/zaklad 25 · Aniq vaqt 30'], ['Qarzdorlik', 'Oʻquvchi, qarz > 0', 'Taklif · tasdiq kutilmoqda', 'Hozircha umumiy mezon → baho “taxminiy”']];
        const dir = isDirector();
        const fields = SETF.map(([k, l, u]) => `<label><span class="l" title="${l}${u ? ' · ' + u : ''}">${l}${u ? ` <span style="font-weight:500;color:#6B7280">· ${u}</span>` : ''}</span><span class="qt-in"><input class="qa-in" type="number" min="0" data-qt-set="${k}" value="${esc(s[k])}" aria-label="${l}${u ? ' (' + u + ')' : ''}"${dir ? '' : ' disabled'}></span></label>`).join('');
        return `${subnav(null)}<div class="qt-g2" style="grid-template-columns:1.6fr 1fr"><div class="qt-col"><div class="qa-cd qt-tbw" style="padding:6px 12px;gap:4px"><b class="qt-h" style="padding:8px 0 0">Qoʻngʻiroq turlari va mezonlar (100 ball)</b><table class="qt-tb"><thead><tr><th>Tur</th><th>Qachon (lid holati)</th><th>Skriptdan</th><th>Ogʻirliklar</th></tr></thead><tbody>${types.map(([a, b, c, d2]) => `<tr><td style="white-space:nowrap"><b>${a}</b></td><td class="qa-note">${b}</td><td>${c}</td><td class="qa-note">${d2}</td></tr>`).join('')}</tbody></table><span class="qa-note" style="padding:2px 0 6px">Mezonlar 7 bosqich oʻqiga moslanadi. Turni ROP oʻzgartirsa, ball qayta hisoblanadi.</span></div><div class="qa-cd" style="gap:6px;padding:10px 14px"><div class="qa-row"><b class="qt-h" style="flex:1">Chegaralar · faqat admin oʻzgartiradi</b>${dir ? '<button type="button" class="qa-btn qa-pri" style="min-height:44px" data-qt-save="1">Saqlash</button>' : ''}</div><div class="qt-set">${fields}</div>${s.updatedBy ? `<span class="qa-note">Oxirgi oʻzgartirish: ${esc(s.updatedBy)}${s.updatedAt ? ' · ' + esc(when(Date.parse(s.updatedAt))) : ''}</span>` : ''}</div></div><div class="qt-col"><div class="qa-cd" style="gap:4px"><b class="qt-h">Manba va modellar</b>${st('ok', 'Skript', 'Sotuv › Skriptlar › “Sotuv skripti” — tahrir ertangi qoʻngʻiroqlardan amal qiladi')}${st('ok', 'Modellar', 'Gemini (pullik, oʻqitishga ishlatilmaydi) → Claude Sonnet; hisobot Opus, dushanba 09:00')}${st('ok', 'Yozuv qaysi lidga', 'Jurnal: raqam + vaqt; 2 SIM; nomaʼlum → “Lidsiz”; ichki APK')}${st('ok', 'Mijozga xabar', 'Menejer boshida: “Suhbat sifat uchun yozib olinadi”')}</div><div class="qa-cd" style="gap:4px"><b class="qt-h">Qoidalar</b>${st('ok', 'Baholanmaydi', `${s.minSeconds} soniyadan qisqa · yozuv topilmagan · Eslatma; iPhone — faqat qoʻlda yuklash`)}${st('ok', 'Eʼtiroz', `Menejer ${s.appealHours} soat ichida yuboradi → ROP ${s.ropHours} soat ichida qabul/rad; qabul — qayta baholanadi`)}${st('ok', 'Kim nimani koʻradi', 'Menejer — oʻzini + namunaviy qoʻngʻiroqlar (mijoz yashirin); ROP — oʻz boʻlimi; admin — ikkala til; targetolog — faqat lid sifati')}</div></div></div>`;
    }
    async function saveSettings(wrap, btn) {
        const body = {};
        wrap.querySelectorAll('[data-qt-set]').forEach(el => { body[el.dataset.qtSet] = Number(el.value); });
        btn.disabled = true;
        try { await api('/settings', { method: 'POST', body: JSON.stringify(body) }); toast('Sozlamalar saqlandi'); rerender(); } catch (x) { alert(x.message || x); btn.disabled = false; }
    }

    // ═════════════ Sotuv menejeri: "Mening tahlilim" (kompyuter) ═════════════
    const ME = { tab: 'umumiy', per: '', root: null, gen: 0, callId: null };
    const MTABS = [['umumiy', 'Umumiy'], ['reja', 'Rivojlanish rejam'], ['calls', 'Qoʻngʻiroqlarim']];
    async function renderMe(root, opts = {}) {
        if (!root) return;
        css();
        ME.root = root;
        if (opts.tab) ME.tab = opts.tab;
        const gen = ++ME.gen;
        if (!root.querySelector('.qt')) root.innerHTML = `<div class="qa qt">${loading()}</div>`;
        const wrap = root.querySelector('.qt');
        let d, html;
        try { d = await api('/me' + q(ME)); } catch (e) { if (gen === ME.gen) wrap.innerHTML = err(e); return; }
        if (gen !== ME.gen) return;
        const tabs = `<div class="qt-sub">${MTABS.map(([k, l]) => `<button type="button" class="qa-chip${ME.tab === k ? ' on' : ''}" data-qm-tab="${k}">${l}</button>`).join('')}<span style="flex:1"></span>${ME.tab === 'reja' && d.plan?.current ? `<span class="qa-chip">${esc(d.plan.current.label)} · ${esc(d.plan.current.range)}</span>` : perChip(ME, d)}</div>`;
        if (ME.tab === 'reja') html = meReja(d);
        else if (ME.tab === 'calls') html = await meCalls(d);
        else html = meUmumiy(d);
        if (gen !== ME.gen) return;
        wrap.innerHTML = tabs + html;
        const sub = document.querySelector('#tab-call-ai-me .ca-me-head p');
        const LN = { russian: 'Rus tili', english: 'Ingliz tili' }[d.lang] || '';
        if (sub) sub.textContent = ME.tab === 'reja' ? ['Rivojlanish rejasi', d.plan?.approvedBy ? 'ROP ' + d.plan.approvedBy : ''].filter(Boolean).join(' · ') : ME.tab === 'calls' ? `Qoʻngʻiroqlarim · ${LN}` : `AI tahlili · ${LN}`;
        wrap.onclick = e => {
            const b = e.target.closest('[data-qm-tab],[data-qt-call],[data-qt-task],[data-qt-lead],[data-qm-go],[data-qm-pg]');
            if (!b) return;
            if (b.dataset.qmTab) { ME.tab = b.dataset.qmTab; ME.page = 0; return renderMe(root); }
            if (b.dataset.qmPg) { ME.page = Math.max(0, (ME.page || 0) + Number(b.dataset.qmPg)); return renderMe(root); }
            if (b.dataset.qmGo) { ME.tab = b.dataset.qmGo; return renderMe(root); }
            if (b.dataset.qtCall) return openCall(b.dataset.qtCall, { onClose: () => renderMe(root) });
            if (b.dataset.qtLead) { if (typeof openLeadOverview === 'function') openLeadOverview(d.lang, b.dataset.qtLead); return; }
            if (b.dataset.qtTask) return meTask(b.dataset.qtTaskPlan, b.dataset.qtTask, !b.classList.contains('on'), b, () => renderMe(root));
        };
        wrap.onchange = e => { const p = e.target.closest('[data-qt-per]'); if (p) { ME.per = p.value; ME.page = 0; renderMe(root); } };
    }
    async function meTask(planId, taskId, done, btn, after) {
        btn.disabled = true;
        try { await api(`/plans/${encodeURIComponent(planId)}/task`, { method: 'POST', body: JSON.stringify({ taskId, done }) }); } catch (x) { alert(x.message || x); }
        after();
    }
    const kp82 = (b, s, color = '') => `<div class="qa-kpi qt-kpi" style="min-height:82px;justify-content:center"><b${color ? ` style="color:${color}"` : ''}>${b}</b><span>${s}</span></div>`;
    function recentRows(list, { phone = false } = {}) {
        if (!list.length) return '<span class="qa-note" style="padding:6px 0">Hali qoʻngʻiroq yoʻq</span>';
        return list.map(r => `<button type="button" class="qt-mrow" style="min-height:44px" data-qt-call="${esc(r.id)}">${typeTag(r.type, 100)}<span style="flex:1;padding-left:4px">${esc(phone ? shortLead(r.lead) : r.lead)} · ${phone ? when(r.at).replace(/^Bugun /, '').replace(/^(\d+-\S+) \d\d:\d\d$/, '$1') : when(r.at)}</span>${r.score != null ? gtag(r.score) : `<span class="qa-tg g-n">${esc(statusText(r))}</span>`}</button>`).join('');
    }
    function planTeaser(p, cls = 'r', attr = 'data-qm-go="reja"') {
        if (!p) return '';
        const open = p.weeks.find(w => w.status === 'current')?.tasks.filter(t => !t.done && t.who !== 'AI').length || 0;
        return `<button type="button" class="qa-al ${cls}" ${attr}><span class="i">${ic('target', 18)}</span><div style="flex:1"><b>${open} ta ochiq vazifa</b><br><span class="qa-note" style="color:#7A271A">Rivojlanish rejasi · ${esc(p.current?.label || '')} · ${p.current ? `${p.current.done}/${p.current.total}` : ''}</span></div>${ic('chev', 18)}</button>`;
    }
    function meUmumiy(d) {
        const k = d.kpis;
        if (!k.analyzed) return empty('Bu davrda tahlil qilingan qoʻngʻiroq yoʻq', 'Jamoa ilovasidan qoʻngʻiroq qilsangiz, yozuv avtomatik lid kartasiga tushadi va AI baholaydi.');
        const w = d.weakest;
        const left = `<div class="qa-cd" style="align-items:center;gap:4px">${radar(k.axes, 230, { cmp: d.teamAxes, fs: 10.5 })}${leg('Siz', 'Jamoa')}${w ? `<div class="qa-al o" style="padding:10px;margin-top:6px"><span class="i">${ic('target', 16)}</span><div style="font-size:12px"><b>Eng zaif: ${esc(w.label)} ${Math.round(w.value)}</b><br>${d.plan ? 'Rejangiz aynan shu ustida' : 'Shu bosqichga eʼtibor bering'}</div></div>` : ''}<div style="width:100%;margin-top:6px">${byTypeList(d.byType)}</div></div>`;
        const issues = d.issues.slice(0, 2).map(i => `<div class="qa-al ${i.tone}" style="flex:1;padding:8px"><span class="i"><b>${i.count}</b></span><div style="font-size:12px"><b>${esc(i.title)}</b><br>${esc(i.sub || 'shu davrda')}</div></div>`).join('');
        const mid = `<div class="qa-cd" style="gap:8px"><b class="qt-h">Skript bosqichlari · siz</b>${stageBars(d.stages, 13, 190)}<div style="display:flex;flex-direction:column"><span class="qa-sec" style="padding:6px 0 2px">Soʻnggi qoʻngʻiroqlarim</span>${recentRows(d.recent.slice(0, 3))}</div>${issues ? `<div style="display:flex;gap:8px">${issues}</div>` : ''}${d.tip ? `<div class="qa-say" style="margin-top:4px"><b>AI</b><span>${esc(d.tip)}</span></div>` : ''}</div>`;
        const lq = d.lastQuote;
        const quote = lq ? `<div class="qa-qt"><div class="h">${esc(when(lq.at))} · ${esc(lq.lead)}${lq.t ? ' · ' + esc(lq.t) + ' da' : ''}</div><div class="s"><b>Siz dedingiz</b>“${esc(lq.said)}”</div><div class="k"><b>Shunday deyish kerak edi</b>“${esc(lq.should)}”</div></div><button type="button" class="qa-btn" data-qt-call="${esc(lq.callId)}">Qoʻngʻiroq tahlilini ochish</button>` : '';
        const right = `<div class="qt-col" style="gap:12px">${d.plan ? planTeaser(d.plan, 'r') : ''}${quote}<div class="qa-cd" style="gap:2px;padding:10px 12px"><b style="font-size:14px">6 hafta</b>${leg('Siz', 'Jamoa')}${line([d.weekly.me, d.weekly.team], d.weekly.labels, { w: 320, h: 170 })}</div></div>`;
        const kp = `<div class="qt-kpis" style="align-items:stretch"><div class="qa-kpi qt-kpi" style="flex-direction:row;align-items:center;gap:12px;min-height:82px">${scoreBox(k.score, 56, 22)}<span>Haftalik ball ${delta(k.scoreDelta)}<br><span class="qa-note">${d.rank ? `Reytingda ${d.rank}/${d.of}` : ''}</span></span></div>${kp82(k.graded, 'Tahlil qilingan')}${kp82(k.trialPct != null ? k.trialPct + '%' : '—', 'Sinovga yozildi')}${kp82(`${k.sales.count} · ${mln(k.sales.amount)}`, 'Sotuv (qoʻngʻ. lidlar)')}</div>`;
        const task = d.task ? `<button type="button" class="qa-al o" data-qt-lead="${esc(d.task.leadId)}"><span class="i">${ic('phone', 18)}</span><div style="flex:1"><b>ROP topshirigʻi: ${esc(d.task.lead)}</b><br><span class="qa-note" style="color:#7A2E0E">${esc(d.task.text)}</span></div>${ic('chev', 18)}</button>` : '';
        return `${kp}${task}<div class="qt-me3">${left}${mid}${right}</div>`;
    }
    function meReja(d) {
        const p = d.plan;
        if (!p) return `<div class="qa-cd" style="align-items:center;text-align:center;padding:28px;gap:8px">${ic('target', 28)}<b style="font-size:16px">Sizda faol rivojlanish rejasi yoʻq</b><span class="qa-note">Ball 2 hafta ketma-ket 70 dan past boʻlsa yoki haftasiga 5+ qoida buzilsa, AI reja tuzadi va ROP tasdiqlaydi. Hozircha zoʻr ishlayapsiz!</span></div>`;
        const sample = (p.weeks.find(w => w.status === 'current')?.tasks || []).find(t => t.callId);
        const play = sample ? `<button type="button" class="qa-row" style="gap:10px;margin-top:10px;background:#0B1220;border:0;border-radius:16px;padding:10px 12px;color:#fff;width:100%;text-align:left;font:inherit;cursor:pointer" data-qt-call="${esc(sample.callId)}"><span style="width:40px;height:40px;border-radius:50%;background:#fff;color:#0B1220;display:grid;place-items:center;flex:none">${ic('play', 16)}</span><div style="flex:1;font-size:13px"><b>Namunaviy qoʻngʻiroq</b><br><span style="color:#C9D3E3">Mijoz yashirin · jamoadagi eng yaxshi</span></div></button>` : '';
        const b = planBody(p, { canRop: false, canMgr: true, extra: play, goalsTitle: 'Maqsadlar · AI oʻzi oʻlchaydi' });
        return `${weekCards(p)}<div class="qt-g2" style="grid-template-columns:1.1fr 1fr">${b.tasks}<div class="qt-col" style="gap:12px">${b.goals}<div class="qa-cd" style="gap:6px"><b class="qt-h">Qachon tugaydi</b>${st('ok', 'Reja yopiladi', '2 hafta ketma-ket ball ≥ 70 va asosiy maqsad bajarilsa')}${st('hf', 'Hafta bajarilmasa', 'ROP bilan qayta 1:1; fokus keyingi haftada davom etadi')}</div><div class="qa-cd" style="gap:2px;padding:10px 14px"><div class="qa-row"><b style="flex:1;font-size:14px">6 hafta</b>${leg('Siz', 'Jamoa')}</div>${line([d.weekly.me, d.weekly.team], d.weekly.labels, { w: 560, h: 170 })}</div></div></div>`;
    }
    async function meCalls(d) {
        const c = await api('/me/calls' + q(ME, { page: ME.page || '' }));
        const list = c.rows;
        const appeal = d.appeal ? `<button type="button" class="qa-al p" data-qt-call="${esc(d.appeal.callId)}"><span class="i">${ic('flag', 18)}</span><div style="flex:1"><b>Eʼtirozingiz koʻrilmoqda</b><br><span class="qa-note">${esc(d.appeal.lead)} · ROP qaroriga ${d.appeal.left} soat</span></div>${ic('chev', 18)}</button>` : '';
        const rows = list.map(r => `<tr class="lk" data-qt-call="${esc(r.id)}"><td class="qa-note" style="white-space:nowrap">${when(r.at)}</td><td><b style="color:#0057B8">${esc(r.lead)}</b></td><td>${typeTag(r.type)}</td><td>${dur(r.durationSec)}</td><td>${r.score != null ? gtag(r.score) : `<span class="qa-tg g-n">${esc(statusText(r))}</span>`}</td><td>${esc(r.outcome || '—')}</td><td>${r.violations.map(v => `<span class="qa-tg g-z">${esc(v)}</span>`).join(' ') || (r.appeal === 'pending' ? '<span class="qa-tg g-p">Eʼtiroz</span>' : '<span class="qa-note">—</span>')}</td></tr>`).join('');
        const from = c.page * c.size;
        return `${appeal}${c.total ? `<div class="qa-cd qt-tbw" style="padding:4px 10px"><table class="qt-tb"><thead><tr><th>Vaqt</th><th>Mijoz</th><th>Tur</th><th>Davom.</th><th>Ball</th><th>Natija</th><th>Ogohlantirish</th></tr></thead><tbody>${rows}</tbody></table><div class="qa-row" style="padding:10px 6px 4px;flex-wrap:wrap"><span class="qa-note" style="flex:1;min-width:240px">${from + 1}–${from + list.length} / ${c.total} · qoʻngʻiroqni bosing — baho, matn, “nima deyish kerak edi” va eʼtiroz (48 soat ichida).</span><button type="button" class="qa-btn" style="min-height:44px;font-size:13px" data-qm-pg="-1"${c.page ? '' : ' disabled'}>Oldingi</button><button type="button" class="qa-btn qa-pri" style="min-height:44px;font-size:13px" data-qm-pg="1"${from + list.length < c.total ? '' : ' disabled'}>Keyingi</button></div></div>` : empty('Bu davrda qoʻngʻiroq yoʻq')}`;
    }

    // ═════════════ Bosh sahifa bloklari ═════════════
    // ROP/admin: "Qo'ng'iroqlar sifati" (admin — ikki til almashtirgich); menejer: "Qo'ng'iroqlarim sifati".
    const HOME = { lang: '', cache: null };
    // Bosh sahifa tez-tez qayta chiziladi — oxirgi blok 60 soniya qayta ishlatiladi (miltillamasin, so'rov kamaysin).
    async function home(el) {
        if (!el) return;
        css();
        const key = role() + '|' + (HOME.lang || curLang());
        if (HOME.cache && HOME.cache.key === key && Date.now() - HOME.cache.at < 60000) { el.innerHTML = HOME.cache.html; el.onclick = HOME.cache.onclick; return; }
        await homeFresh(el);
        if (el.isConnected) HOME.cache = { key, at: Date.now(), html: el.innerHTML, onclick: el.onclick };
    }
    async function homeFresh(el) {
        const r = role();
        if (r === 'sales_manager') return homeManager(el);
        if (!canTeam()) { el.remove(); return; }
        const lang = HOME.lang || curLang() || '';
        let d, other = null;
        try {
            d = await api('/stats' + q({ per: '', lang }));
            if (isDirector()) other = await api('/stats' + q({ per: '', lang: d.lang === 'russian' ? 'english' : 'russian' })).catch(() => null);
        } catch (e) { el.innerHTML = ''; return; }
        if (!el.isConnected) return;
        // Tanlangan tilda tahlil bo'lmasa — ma'lumoti bor tilni ko'rsatamiz.
        if (!HOME.lang && !d.kpis.analyzed && other?.kpis.analyzed) [d, other] = [other, d];
        const k = d.kpis;
        if (!k.analyzed && !(other && other.kpis.analyzed)) { el.innerHTML = ''; return; }
        const LN = { russian: 'Rus tili', english: 'Ingliz tili' };
        const sw = other ? `<div class="qa-row" style="gap:6px">${[d, other].sort((a, b) => (a.lang === 'english' ? -1 : 1) - (b.lang === 'english' ? -1 : 1)).map(x => `<button type="button" class="qa-chip${x.lang === d.lang ? ' on' : ''}" data-qh-lang="${x.lang}">${LN[x.lang]} · ball ${x.kpis.score ?? '—'} · ${x.kpis.analyzed} tahlil</button>`).join('')}</div>` : '';
        const ta = d.teamAxes || {};
        const weakK = AXES.filter(a => ta[a] != null).sort((a, b) => ta[a] - ta[b]);
        const mans = d.managers.map(m => `<button type="button" class="qt-mrow" data-qh-go="menejerlar:${esc(m.id)}">${av(m.name, 28, m.avatar, m.id)}<span style="flex:1">${esc(shortName(m.name))}</span>${spark(m.spark, 60, 20)}${gtag(m.score)}</button>`).join('');
        const f = d.funnel;
        const fun = [['1-qoʻngʻiroq qilindi', f.first, '#0057B8'], ['Sinovga yozildi', f.booked, '#2E7BD6'], ['Sinovga keldi', f.attended, '#5B30B5'], ['Toʻladi', f.paid, '#067647']].map(([a, n, c]) => `<div class="qt-fun" style="font-size:12px;gap:6px"><span style="width:120px">${a}</span>${bar(f.first ? n / f.first * 100 : 0, c)}<b style="width:22px;text-align:right">${n}</b></div>`).join('');
        const ALC = { tolov: ['r', 'cash'], etiroz: ['b', 'flag'], reja: ['o', 'target'], sovuq: ['o', 'trend'] };
        const al = d.alerts.slice(0, 4).map(a => `<button type="button" class="qa-al ${ALC[a.kind]?.[0] || 'b'}" style="padding:6px 9px" ${a.planId ? `data-qh-plan="${esc(a.planId)}"` : `data-qh-call="${esc(a.callId)}"`}><span class="i">${ic(ALC[a.kind]?.[1] || 'warn', 16)}</span><div style="font-size:12px;min-width:0;flex:1"><b>${esc(alTitle(a))}</b><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(a.title)}">${esc(String(alSub(a) || '').replace(/ · ROP qaroriga/, ' · ROP'))}</div></div></button>`).join('') || '<span class="qa-note">Shoshilinch holat yoʻq</span>';
        const plans = d.managers.filter(m => m.plan || m.planHint).slice(0, 4).map(m => `<button type="button" class="qt-planrow" ${m.plan ? `data-qh-plan="${esc(m.plan.id)}"` : `data-qh-go="menejerlar:${esc(m.id)}"`}>${av(m.name, 28, m.avatar, m.id)}<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>${esc(shortName(m.name))}</b><br><span class="qa-note">${esc((m.plan || m.planHint).text.split(' · ')[0].replace(/:\s*(\S+).*/, ' · $1'))}</span></span><span class="qa-tg ${toneCls[(m.plan || m.planHint).tone] || 'g-n'}">${esc((m.plan || m.planHint).text.split(' · ').slice(1).join(' · ') || 'faol')}</span></button>`).join('');
        el.innerHTML = `<div class="qa" style="margin-top:18px"><div class="qa-cd qt-home" style="gap:12px"><span class="qt-new">YANGI · Qoʻngʻiroqlar sifati</span>
<div class="qa-row" style="flex-wrap:wrap"><b style="flex:1;font-size:16px">Qoʻngʻiroqlar sifati · ${esc(rangeLabel(d.from, d.to))} (oʻtgan hafta)</b>${sw}<button type="button" class="qa-btn" style="min-height:44px;font-size:13px" data-qh-go="umumiy">Sotuv › Tahlil ${ic('chev', 14)}</button></div>
<div class="qt-kpis">${scoreBox(k.score, 64, 24)}${kp82(k.analyzed, 'Tahlil qilingan')}${kp82(k.trialPct != null ? k.trialPct + '%' : '—', '1-qoʻngʻiroqdan sinovga')}${kp82(`${k.sales.count} · ${mln(k.sales.amount)}`, 'Sotuv (qoʻngʻ. lidlar)')}<div class="qa-kpi qt-kpi" style="min-height:82px;justify-content:center" title="${esc(LOSTNOTE)}"><b style="color:${k.lost ? '#B42318' : '#0B1220'}">${k.lost ? '~' + mln(k.lost) : '0'}</b><span style="white-space:nowrap">Qoʻldan ketgan ⓘ</span></div>${kp82(weakK.length ? one(ta[weakK[0]]) : '—', `Eng zaif: ${weakK.slice(0, 2).map(a => AX[a]).join(' · ') || '—'}`, '#B42318')}</div>
<div class="qt-home3"><div style="min-width:0"><span class="qa-sec">Menejerlar · 6 hafta</span>${mans || '<p class="qa-note">Bu haftada baholangan menejer yoʻq</p>'}</div><div style="display:flex;flex-direction:column;gap:8px"><span class="qa-sec">Voronka</span>${fun}</div><div style="display:flex;flex-direction:column;gap:8px"><span class="qa-sec">Eʼtibor bering · ${d.alerts.length}</span>${al}</div></div>
${plans ? `<div class="qa-row" style="gap:8px;padding-top:4px;border-top:1px solid #EEF1F6;flex-wrap:wrap"><span class="qa-sec" style="width:140px">Rejalar holati</span>${plans}</div>` : ''}</div></div>`;
        el.onclick = e => {
            const b = e.target.closest('[data-qh-lang],[data-qh-go],[data-qh-plan],[data-qh-call]');
            if (!b) return;
            if (b.dataset.qhLang) { HOME.lang = b.dataset.qhLang; HOME.cache = null; return home(el); }
            if (b.dataset.qhCall) return openCall(b.dataset.qhCall);
            const opts = b.dataset.qhPlan ? { page: 'rejalar', planId: b.dataset.qhPlan } : (() => { const [pg, id] = b.dataset.qhGo.split(':'); return { page: pg, managerId: id || null }; })();
            S.lineMan = null;
            openSalesTahlil({ ...opts, lang: d.lang });
        };
    }
    async function homeManager(el) {
        let d; try { d = await api('/me'); } catch (e) { el.innerHTML = ''; return; }
        if (!el.isConnected) return;
        const k = d.kpis;
        if (!k.analyzed && !d.plan && !d.task) { el.innerHTML = ''; return; }
        const w = d.weakest;
        const cards = [d.plan ? planTeaser(d.plan, 'r', 'data-qh-me="reja"').replace('class="qa-al r"', 'class="qa-al r" style="flex:1"') : '',
            d.task ? `<button type="button" class="qa-al o" style="flex:1" data-qh-lead="${esc(d.task.leadId)}"><span class="i">${ic('phone', 18)}</span><div style="flex:1"><b>ROP topshirigʻi: ${esc(d.task.lead)}</b><br><span class="qa-note" style="color:#7A2E0E">${esc(d.task.text)}</span></div>${ic('chev', 18)}</button>` : '',
            d.appeal ? `<button type="button" class="qa-al b" style="flex:1" data-qh-call="${esc(d.appeal.callId)}"><span class="i">${ic('flag', 18)}</span><div style="flex:1"><b>Eʼtirozingiz koʻrilmoqda</b><br><span class="qa-note" style="color:#0B3A75">ROP qaroriga ${d.appeal.left} soat</span></div>${ic('chev', 18)}</button>` : ''].filter(Boolean).join('');
        el.innerHTML = `<div class="qa" style="margin-top:18px"><div class="qa-cd qt-home" style="gap:12px"><span class="qt-new">YANGI · Qoʻngʻiroqlarim sifati</span>
<div class="qa-row"><b style="flex:1;font-size:16px">Qoʻngʻiroqlarim sifati · ${esc(rangeLabel(d.from, d.to))} (oʻtgan hafta)</b><button type="button" class="qa-btn" style="font-size:13px" data-qh-me="umumiy">Mening tahlilim ${ic('chev', 14)}</button></div>
<div class="qt-kpis">${scoreBox(k.score, 64, 24)}${kp82(k.scoreDelta != null ? (k.scoreDelta > 0 ? '+' : '') + k.scoreDelta : '—', 'Oʻtgan haftaga')}${kp82(d.rank ? `${d.rank}/${d.of}` : '—', 'Reyting')}${kp82(k.graded, 'Tahlil qilingan')}${kp82(k.trialPct != null ? k.trialPct + '%' : '—', 'Sinovga yozildi')}${kp82(w ? Math.round(w.value) : '—', `Eng zaif: ${w ? esc(w.label) : '—'}`, '#B42318')}</div>
${cards ? `<div style="display:flex;gap:14px;flex-wrap:wrap">${cards}</div>` : ''}
<div class="qt-g2" style="grid-template-columns:1.6fr 1fr"><div class="qa-cd" style="gap:2px;padding:10px 14px"><div class="qa-row"><b style="flex:1;font-size:14px">6 hafta</b>${leg('Siz', 'Jamoa')}</div>${line([d.weekly.me, d.weekly.team], d.weekly.labels, { w: 700, h: 170 })}</div><div class="qa-cd" style="gap:0;padding:8px 14px"><span class="qa-sec" style="padding-bottom:2px">Soʻnggi qoʻngʻiroqlarim</span>${recentRows(d.recent.slice(0, 3))}</div></div></div></div>`;
        el.onclick = e => {
            const b = e.target.closest('[data-qh-me],[data-qh-call],[data-qt-call],[data-qh-lead]');
            if (!b) return;
            if (b.dataset.qhCall || b.dataset.qtCall) return openCall(b.dataset.qhCall || b.dataset.qtCall);
            if (b.dataset.qhLead) { if (typeof openLeadOverview === 'function') openLeadOverview(d.lang, b.dataset.qhLead); return; }
            openMe(b.dataset.qhMe);
        };
    }
    function openSalesTahlil(opts = {}) {
        S.page = opts.page || 'umumiy'; S.managerId = opts.managerId || null; S.planId = opts.planId || null;
        if (opts.lang && typeof _leadsLangFilter !== 'undefined' && document.body.classList.contains('lang-fixed') === false) { try { _leadsLangFilter = opts.lang; } catch (e) { /* */ } }
        if (document.getElementById('tab-sales')?.classList.contains('active') && typeof switchSalesSection === 'function') { switchSalesSection('call-ai'); window.ropDesk?.mark?.(); return; }
        if (window.ropDesk?.go && window.ropDesk.isDesk?.()) { window.ropDesk.go('tahlil'); return; }
        if (typeof switchTab === 'function') switchTab('sales', { salesSection: 'call-ai' });
    }
    function openMe(tab) {
        ME.tab = tab || 'umumiy';
        if (window.ropDesk?.go && window.ropDesk.isDesk?.()) { window.ropDesk.go('ai'); return; }
        if (typeof switchTab === 'function') switchTab('call-ai-me');
    }

    // ═════════════ Marketing › Lid sifati (AI) ═════════════
    const LQ = { per: '', lang: '' };
    const qColor = p => (p >= 50 ? '#067647' : p >= 35 ? '#0057B8' : '#B42318');
    const qCls = p => (p >= 50 ? 'g-a' : p >= 35 ? 'g-y' : 'g-z');
    // Maqsadli lid narxi (taxminiy): kunlik sarf pullik lidlar soniga teng taqsimlanadi — farqni maqsadli ulush beradi.
    const isPaid = s => !/^Organik/.test(s.name);
    function srcPrice(d, s) {
        if (d.adSpendUsd == null || !isPaid(s) || !s.targeted) return null;
        const paid = d.bySource.filter(isPaid).reduce((n, x) => n + x.leads, 0);
        return paid ? Math.round(d.adSpendUsd * s.leads / paid / s.targeted * 100) / 100 : null;
    }
    function lqAdvice(d) {
        const avgCost = d.costPerTargeted;
        const worst = d.bySource.filter(s => s.leads >= 5).sort((a, b) => b.youngPct - a.youngPct)[0];
        if (!worst || worst.youngPct < 30) return '';
        return `<b>${esc(worst.name.replace(/^Instagram · /, ''))}:</b> lidlarning ${worst.youngPct}% i 21 yoshdan kichik, maqsadli ulush ${worst.pct}%${avgCost ? ` (oʻrtacha maqsadli lid narxi ${usd(avgCost)})` : ''}. Auditoriyani 23+ ga toraytirishni koʻrib chiqing.`;
    }
    async function renderLeadQuality(root, { lang } = {}) {
        if (!root) return;
        css();
        LQ.lang = lang || LQ.lang || '';
        root.innerHTML = root.querySelector('.qt') ? root.innerHTML : `<div class="qa qt">${loading()}</div>`;
        const wrap = root.querySelector('.qt');
        let d; try { d = await api('/lead-quality' + q(LQ)); } catch (e) { wrap.innerHTML = err(e); return; }
        const head = `<div class="qa-row" style="flex-wrap:wrap">${perChip(LQ, d)}<span class="qa-note" style="flex:1;min-width:240px">AI 1-qoʻngʻiroqdan lid maqsadli yoki yoʻqligini aniqlaydi. Menejer ballari va Sotuv › Tahlil ${role() === 'targetolog' ? 'sizga koʻrinmaydi' : 'bu yerda koʻrsatilmaydi'}.</span></div>`;
        if (!d.total) { wrap.innerHTML = head + empty('Bu davrda 1-qoʻngʻiroq tahlili yoʻq', 'Menejerlar yangi lidlarga Jamoa ilovasidan qoʻngʻiroq qilganda AI lid sifatini belgilaydi.'); bindLq(root, wrap); return; }
        const kpis = `<div class="qt-kpis">${kpi(d.total, 'Lid · 1-qoʻngʻiroq tahlil qilindi')}${kpi(d.targetedPct + '%', `Maqsadli (AI) · ${d.targeted} ta`)}${kpi(usd(d.costPerTargeted), d.adSpendUsd != null ? `Maqsadli lid narxi · sarf ${usd(d.adSpendUsd)}` : 'Maqsadli lid narxi (sarf kiritilmagan)')}${kpi(d.youngPct != null ? d.youngPct + '%' : '—', `21 yoshgacha · ${d.young} ta`)}</div>`;
        const rows = d.bySource.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${s.leads}</td><td style="min-width:150px"><div class="qa-row" style="gap:8px"><span style="flex:1;min-width:80px;display:flex">${bar(s.pct, qColor(s.pct))}</span><b style="width:36px">${s.pct}%</b></div></td><td>${usd(srcPrice(d, s))}</td><td class="qa-note">${esc(s.note)}${s.youngPct >= 30 ? ` · 21 yoshgacha ${s.youngPct}%` : ''}</td></tr>`).join('');
        const days = (() => { const map = new Map(d.days.map(x => [x.day, x])); const out = []; for (let t = d.from; t < d.to && out.length < 14; t += 864e5) { const k = new Date(t + 5 * 3600e3).toISOString().slice(0, 10); out.push(map.get(k) || { day: k, leads: null, pct: null }); } return out; })();
        const daysT = days.length ? `<div class="qa-cd qt-tbw" style="padding:6px 12px"><b style="font-size:14px;padding:8px 0 0">Kunlar boʻyicha · maqsadli %</b><table class="qt-tb"><thead><tr><th>Kun</th>${days.map(x => `<th>${esc(x.day.slice(8).replace(/^0/, ''))}.${esc(x.day.slice(5, 7))}</th>`).join('')}</tr></thead><tbody><tr><td>Lid</td>${days.map(x => `<td>${x.leads ?? '—'}</td>`).join('')}</tr><tr><td>Maqsadli</td>${days.map(x => `<td><b>${x.pct == null ? '—' : x.pct + '%'}</b></td>`).join('')}</tr></tbody></table></div>` : '';
        const adv = lqAdvice(d);
        const reasons = d.reasons.length ? d.reasons.map(r => `<div class="qa-row"><span style="width:190px;font-size:13px">${esc(r.label)}</span>${bar(r.pct, '#B54708')}<b style="width:36px;text-align:right;font-size:13px">${r.pct}%</b></div>`).join('') : '<span class="qa-note">Hamma lid maqsadli.</span>';
        const quotes = d.quotes.length ? d.quotes.map(x => `<div class="qa-say"><b>“</b><span>“${esc(x.text)}” — ${x.count} qoʻngʻiroq</span></div>`).join('') : '<span class="qa-note">Mijozlar reklama haqida gapirmadi.</span>';
        const young = d.youngBySource.map(s => `<div class="qa-row"><span style="width:190px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name.replace(/^Instagram · /, ''))}</span>${bar(s.pct, '#B42318')}<b style="width:36px;text-align:right;font-size:13px">${s.pct}%</b></div>`).join('');
        wrap.innerHTML = `${head}${kpis}<div class="qt-g2" style="grid-template-columns:1.5fr 1fr"><div class="qt-col"><div class="qa-cd qt-tbw" style="padding:6px 10px;position:relative"><span class="qt-new" style="top:6px;right:10px">YANGI</span><table class="qt-tb"><thead><tr><th style="min-width:200px">Reklama / manba</th><th>Lid</th><th>Maqsadli</th><th title="Taxminiy: reklama sarfi pullik lidlar soniga teng taqsimlanadi">Narx (AI) ⓘ</th><th style="min-width:220px">AI izohi</th></tr></thead><tbody>${rows}</tbody></table></div>${adv ? `<div class="qa-al o"><span class="i">${ic('warn', 16)}</span><div>${adv}</div></div>` : ''}${daysT}</div><div class="qt-col"><div class="qa-cd" style="gap:8px"><b class="qt-h">Sifatsiz lid sabablari · ${d.badTotal} ta</b>${reasons}</div><div class="qa-cd" style="gap:8px"><b class="qt-h">Mijozlar reklama haqida</b>${quotes}</div><div class="qa-cd" style="gap:8px"><b class="qt-h">21 yoshgacha ulushi · reklama boʻyicha</b>${young}</div></div></div>`;
        bindLq(root, wrap);
    }
    function bindLq(root, wrap) { wrap.onchange = e => { const p = e.target.closest('[data-qt-per]'); if (p) { LQ.per = p.value; renderLeadQuality(root); } }; }

    // ═════════════ Telefon ekranlari ═════════════
    // PH.root — joriy telefon ekrani konteyneri; PH.refresh — qayta chizish (amaldan keyin).
    const PH = { root: null, refresh: null, per: '' };
    const phHdr = (t, s, back) => `<div class="qa-row"><button type="button" class="qa-ib" data-ph-back="${esc(back)}" aria-label="Orqaga">${ic('back', 20)}</button><div style="flex:1;min-width:0"><b style="font-size:17px">${t}</b><div class="qa-note">${s}</div></div></div>`;
    const phPer = (st0, d) => `<label class="qt-per"><span class="qa-chip">${esc(d?.from ? rangeLabel(d.from, d.to, true) : (PERIODS.find(p => p[0] === st0.per) || PERIODS[0])[1])} ⌄</span><select data-qt-per aria-label="Davr">${PERIODS.filter(([k]) => k !== 'today2').map(([k, l]) => `<option value="${k}"${st0.per === k ? ' selected' : ''}>${l[0].toUpperCase() + l.slice(1)}</option>`).join('')}</select></label>`;
    function phoneMount(root, render, { onBack } = {}) {
        css();
        PH.root = root;
        PH.refresh = render;
        root.onclick = e => {
            const b = e.target.closest('[data-ph-back],[data-qt-call],[data-qt-task],[data-ph-go],[data-qt-act],[data-qh-lead]');
            if (!b) return;
            const d = b.dataset;
            if (d.phBack) return onBack ? onBack(d.phBack) : null;
            if (d.qtCall) return PH.onCall ? PH.onCall(d.qtCall) : openCall(d.qtCall, { onClose: render });
            if (d.qhLead) return PH.onLead ? PH.onLead(d.qhLead) : null;
            if (d.qtTask) return meTask(d.qtTaskPlan, d.qtTask, !b.classList.contains('on'), b, render);
            if (d.qtAct) return planAct(d.qtActId, d.qtAct, b);
            if (d.phGo) return PH.nav?.(d.phGo);
        };
        root.onchange = e => { const p = e.target.closest('[data-qt-per]'); if (p) { PH.per = p.value; render(); } };
    }
    // Menejer: Tahlilim
    async function phoneMe(root, { nav, onCall, onLead } = {}) {
        PH.nav = nav; PH.onCall = onCall; PH.onLead = onLead;
        const render = async () => {
            if (!root.querySelector('.qt-ph')) root.innerHTML = `<div class="qa qt-ph">${loading()}</div>`;
            let d; try { d = await api('/me' + q(PH)); } catch (e) { root.innerHTML = `<div class="qa qt-ph">${err(e)}</div>`; return; }
            const k = d.kpis;
            const top = `<div class="qa-row"><b style="flex:1;font-size:22px">Mening tahlilim</b>${phPer(PH, d)}</div>`;
            if (!k.analyzed && !d.plan) { root.innerHTML = `<div class="qa qt-ph">${top}${empty('Hali tahlil qilingan qoʻngʻiroq yoʻq', 'Ilovadan qoʻngʻiroq qilsangiz, yozuv avtomatik lid kartasiga tushadi va AI baholaydi.')}</div>`; return; }
            const p = d.plan;
            const g0 = p?.goals?.[0];
            root.innerHTML = `<div class="qa qt-ph">${top}
<div class="qa-cd" style="align-items:center;gap:4px;padding:8px 6px;position:relative;margin-top:6px"><span class="qt-new">YANGI</span>${radar(k.axes, 200, { cmp: d.teamAxes, fs: 9.5 })}${leg('Siz', 'Jamoa')}</div>
<div class="qa-row" style="gap:8px"><div class="qa-kpi qt-kpi" style="flex-direction:row;align-items:center;gap:8px">${scoreBox(k.score, 46, 18)}<span style="font-size:11px">${delta(k.scoreDelta)}<br>${d.rank ? `${d.rank}/${d.of}` : ''}</span></div>${kpi(k.graded, 'Tahlil')}${kpi(k.trialPct != null ? k.trialPct + '%' : '—', 'Sinovga')}</div>
${p ? `<button type="button" class="qa-al r" data-ph-go="reja"><span class="i">${ic('target', 18)}</span><div style="flex:1"><b>Rivojlanish rejasi · ${esc(p.current?.label || '')}</b><br><span class="qa-note" style="color:#7A271A">${g0 ? `${esc(g0.label)} ${g0.cur ?? '—'}${g0.unit || ''} → maqsad ${g0.target}${g0.unit || ''} · ` : ''}${(p.current?.total || 0) - (p.current?.done || 0)} ochiq vazifa</span></div>${ic('chev', 18)}</button>` : ''}
${d.task ? `<button type="button" class="qa-al o" data-qh-lead="${esc(d.task.leadId)}"><span class="i">${ic('phone', 18)}</span><div style="flex:1"><b>Qayta qoʻngʻiroq: ${esc(d.task.lead)}</b><br><span class="qa-note" style="color:#7A2E0E">ROP topshirigʻi · ${esc(d.task.text)}</span></div>${ic('chev', 18)}</button>` : ''}
${d.appeal ? `<button type="button" class="qa-al p" data-qt-call="${esc(d.appeal.callId)}"><span class="i">${ic('flag', 18)}</span><div style="flex:1"><b>Eʼtirozingiz koʻrilmoqda</b><br><span class="qa-note">${esc(d.appeal.lead)} · ROP qaroriga ${d.appeal.left} soat</span></div>${ic('chev', 18)}</button>` : ''}
<div class="qa-cd" style="gap:0;padding:4px 14px"><span class="qa-sec" style="padding:8px 0 2px">Soʻnggi qoʻngʻiroqlar</span>${recentRows(d.recent.slice(0, 4), { phone: true })}</div>
${d.tip ? `<div class="qa-say"><b>AI</b><span>${esc(d.tip)}</span></div>` : ''}
${window.DomworkNative?.requestAudio ? `<button type="button" class="qt-lnk" style="min-height:44px;font-weight:700;color:#0057B8" onclick="try{DomworkNative.requestAudio()}catch(e){}">Qoʻngʻiroq yozuvi sozlamalari</button>` : '<span class="qa-note" style="text-align:center">Qoʻngʻiroq yozuvi sozlamalari — Jamoa ilovasida</span>'}</div>`;
        };
        phoneMount(root, render);
        await render();
    }
    // Menejer: Rivojlanish rejam (telefon)
    async function phoneReja(root, { nav, back = 'tahlil', onCall } = {}) {
        PH.nav = nav; PH.onCall = onCall;
        const render = async () => {
            if (!root.querySelector('.qt-ph')) root.innerHTML = `<div class="qa qt-ph">${loading()}</div>`;
            let d; try { d = await api('/me'); } catch (e) { root.innerHTML = `<div class="qa qt-ph">${err(e)}</div>`; return; }
            const p = d.plan;
            if (!p) { root.innerHTML = `<div class="qa qt-ph">${phHdr('Rivojlanish rejam', 'Faol reja yoʻq', back)}${empty('Sizda faol rivojlanish rejasi yoʻq', 'Ball 2 hafta 70 dan past boʻlsa yoki haftasiga 5+ qoida buzilsa, AI reja tuzadi va ROP tasdiqlaydi.')}</div>`; return; }
            const cur = p.weeks.find(w => w.status === 'current') || p.weeks[p.weeks.length - 1];
            const goals = p.goals.map(g => { const c = g.cur; const pct = c == null ? 0 : g.lower ? (c <= g.target ? 100 : Math.max(0, 100 - (c - g.target) * 20)) : Math.min(100, g.target ? c / g.target * 100 : 0); return `<div style="display:flex;flex-direction:column;gap:4px"><div class="qa-row" style="font-size:12px"><b style="flex:1">${esc(g.label)}</b><span class="qa-note">${c == null ? '—' : comma(c)}${g.unit || ''} / ${g.target}${g.unit || ''}</span></div>${bar(pct, '#0057B8')}</div>`; }).join('');
            root.innerHTML = `<div class="qa qt-ph">${phHdr('Rivojlanish rejam', `${esc(cur.i + 1)}-hafta · ${esc(rangeLabel(cur.start, cur.end))}${p.approvedBy ? ' · ROP ' + esc(p.approvedBy) : ''}`, back)}
<div class="qa-cd" style="gap:10px;padding:12px">${goals}</div>
<div class="qa-cd" style="gap:0;padding:2px 14px"><span class="qa-sec" style="padding:8px 0 0">Vazifalar · ${p.current?.done || 0}/${p.current?.total || 0}</span>${cur.tasks.map(tk => taskRow(p, tk, { canRop: false, canMgr: true })).join('')}</div>
${(p.notes || []).slice(-1).map(n => `<div class="qa-say"><b>1:1</b><span>${esc(n.text)}</span></div>`).join('')}
<span class="qa-note" style="text-align:center">Reja yopiladi: 2 hafta ketma-ket ball ≥ 70 va asosiy maqsad bajarilsa${goalTxt(d.plan)}</span></div>`;
        };
        phoneMount(root, render, { onBack: x => nav?.(x) });
        await render();
    }
    // Telefon Bosh sahifa bloki (menejer)
    const PHC = { at: 0, d: null };
    async function phoneHomeBlock(el, { nav, onLead } = {}) {
        if (!el) return;
        css();
        // Bosh ekran tez-tez qayta chiziladi — 60 soniya ichida oxirgi javob ishlatiladi (miltillamaydi).
        let d = Date.now() - PHC.at < 60000 ? PHC.d : null;
        if (!d) { try { d = await api('/me'); PHC.d = d; PHC.at = Date.now(); } catch (e) { el.innerHTML = ''; return; } }
        if (!el.isConnected) return;
        const k = d.kpis;
        if (!k.analyzed && !d.plan) { el.innerHTML = ''; return; }
        const w = d.weakest;
        const sp = d.weekly.me;
        el.innerHTML = `<div class="qa" style="display:flex;flex-direction:column;gap:11px"><button type="button" class="qa-cd qt-home" style="gap:10px;text-align:left;font:inherit;cursor:pointer;margin-top:8px" data-ph-go="tahlil"><span class="qt-new">YANGI</span><div class="qa-row"><b style="flex:1">Qoʻngʻiroqlarim sifati · ${esc((PERIODS[0][1]))}</b>${ic('chev', 18)}</div><div class="qa-row" style="gap:12px">${scoreBox(k.score, 56, 22)}<div style="flex:1;display:flex;flex-direction:column;gap:4px"><span class="qa-note">${delta(k.scoreDelta)}${d.rank ? ` · reyting ${d.rank}/${d.of}` : ''}</span>${w ? `<span class="qa-note">Eng zaif: <b style="color:#B42318">${esc(w.label)} ${Math.round(w.value)}</b></span>` : ''}</div>${spark(sp, 64, 26)}</div></button>
${d.plan ? planTeaser(d.plan, 'r', 'data-ph-go="reja"') : ''}
${d.task ? `<button type="button" class="qa-al o" data-qh-lead="${esc(d.task.leadId)}"><span class="i">${ic('phone', 18)}</span><div style="flex:1"><b>Qayta qoʻngʻiroq: ${esc(d.task.lead)}</b><br><span class="qa-note" style="color:#7A2E0E">ROP topshirigʻi · ${esc(d.task.text)}</span></div>${ic('chev', 18)}</button>` : ''}
${d.appeal ? `<button type="button" class="qa-al p" data-ph-go="tahlil"><span class="i">${ic('flag', 18)}</span><div style="flex:1"><b>Eʼtirozingiz koʻrilmoqda</b><br><span class="qa-note">${esc(d.appeal.lead)} · ROP qaroriga ${d.appeal.left} soat</span></div>${ic('chev', 18)}</button>` : ''}</div>`;
        el.onclick = e => {
            const b = e.target.closest('[data-ph-go],[data-qh-lead]');
            if (!b) return;
            if (b.dataset.qhLead) return onLead?.(b.dataset.qhLead);
            nav?.(b.dataset.phGo);
        };
    }
    // ROP: Tahlil (telefon) — jamoa, e'tibor, menejerlar; menejer profili; mini-reja/reja tasdiqlash.
    const RP = { view: 'list', managerId: null, planId: null };
    async function phoneRop(root, { onCall } = {}) {
        PH.onCall = onCall;
        const render = async () => {
            if (!root.querySelector('.qt-ph')) root.innerHTML = `<div class="qa qt-ph">${loading()}</div>`;
            let html;
            try { html = RP.view === 'man' ? await ropMan() : RP.view === 'plan' ? await ropPlan() : await ropList(); } catch (e) { html = err(e); }
            root.innerHTML = `<div class="qa qt-ph">${html}</div>`;
        };
        PH.nav = x => { const [v, id] = String(x).split(':'); RP.view = v; if (v === 'man') RP.managerId = id; if (v === 'plan') RP.planId = id; render(); root.scrollTop = 0; };
        phoneMount(root, render, { onBack: x => PH.nav(x) });
        await render();
    }
    async function ropList() {
        const d = await api('/stats' + q({ per: PH.per }));
        const k = d.kpis;
        const ALC = { tolov: ['r', 'cash'], etiroz: ['p', 'flag'], reja: ['b', 'target'], sovuq: ['o', 'trend'] };
        const al = d.alerts.slice(0, 5).map(a => `<button type="button" class="qa-al ${ALC[a.kind]?.[0] || 'b'}" style="padding:10px" ${a.planId ? `data-ph-go="plan:${esc(a.planId)}"` : `data-qt-call="${esc(a.callId)}"`}><span class="i">${ic(ALC[a.kind]?.[1] || 'warn', 16)}</span><div style="flex:1"><b>${esc(alTitle(a))}</b><br><span class="qa-note">${esc(alSub(a))}</span></div>${ic('chev', 16)}</button>`).join('');
        const mans = d.managers.map(m => `<button type="button" class="qt-mrow" style="padding:7px 0" data-ph-go="man:${esc(m.id)}">${av(m.name, 32, m.avatar, m.id)}<div style="flex:1;min-width:0"><b style="font-size:13px">${esc(shortName(m.name))}</b><div class="qa-note">${m.analyzed} tahlil · sinovga ${m.trialPct ?? '—'}%</div></div>${gtag(m.score)}</button>`).join('');
        return `<div class="qa-row"><b style="flex:1;font-size:22px">Tahlil</b>${phPer(PH, d)}</div>
<div class="qa-row" style="gap:8px">${kpi(k.score ?? '—', 'Jamoa bali')}${kpi(k.trialPct != null ? k.trialPct + '%' : '—', 'Sinovga')}${kpi(k.violations, 'Buzilish', { color: k.violations ? '#B42318' : '' })}</div>
${al ? `<div style="display:flex;flex-direction:column;gap:7px"><span class="qa-sec">Eʼtibor bering · ${d.alerts.length}</span>${al}</div>` : ''}
<div class="qa-cd" style="gap:0;padding:4px 14px"><span class="qa-sec" style="padding:8px 0 2px">Menejerlar</span>${mans || '<p class="qa-note">Bu davrda baholangan menejer yoʻq</p>'}</div>`;
    }
    async function ropMan() {
        const d = await api('/manager/' + encodeURIComponent(RP.managerId) + q({ per: PH.per }));
        const k = d.kpis, p = d.plan;
        const trend = (() => { const s = d.weekly.me.filter(v => v != null); if (s.length < 3) return ''; let n = 0; for (let i = s.length - 1; i > 0 && s[i] < s[i - 1]; i--) n++; return n >= 2 ? ` · ${n} hafta pasaymoqda` : ''; })();
        const planCard = p ? `<div class="qa-cd" style="gap:8px"><div class="qa-row"><button type="button" class="qt-lnk" style="flex:1;white-space:nowrap;font-weight:800;color:#0B1220;min-height:44px;text-align:left" data-ph-go="plan:${esc(p.id)}">${p.kind === 'mini' ? 'Mini-reja' : 'Reja'} · ${esc(p.current?.label || '')} ›</button>${planStatusTag(p)}</div>${p.goals.map(g => `<div class="qa-row" style="font-size:12px"><span style="flex:1">${esc(g.label)}</span><b>${g.cur == null ? '—' : comma(g.cur)}${g.unit || ''} / ${g.target}${g.unit || ''}</b></div>`).join('')}<div class="qa-row" style="font-size:12px"><span style="flex:0 0 auto">Vazifalar</span><b style="flex:1;text-align:right;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.current ? `${p.current.done}/${p.current.total}` : '—'}${(() => { const nx = (p.weeks.find(w => w.status === 'current')?.tasks || []).find(t => !t.done && t.who !== 'AI'); return nx ? ` · keyingi: ${esc(nx.text)}` : ''; })()}</b></div>${p.status === 'active' ? `<div class="qa-row"><button type="button" class="qa-btn" style="flex:1;min-height:44px" data-qt-act="edit" data-qt-act-id="${esc(p.id)}">Tahrirlash</button><button type="button" class="qa-btn qa-pri" style="flex:1;min-height:44px" data-qt-act="remind" data-qt-act-id="${esc(p.id)}">Eslatish</button></div>` : p.status === 'pending' ? `<button type="button" class="qa-btn qa-pri" style="min-height:44px" data-ph-go="plan:${esc(p.id)}">Koʻrib chiqish va tasdiqlash</button>` : ''}</div>` : '';
        const iss = d.issues[0];
        return `${phHdr(esc(d.name), `Sotuv menejeri${d.rank ? ` · reyting ${d.rank}/${d.of}` : ''}`, 'list')}
<div class="qa-cd" style="flex-direction:row;align-items:center;gap:4px;padding:8px">${radar(k.axes, 170, { cmp: d.teamAxes, fs: 10 })}<div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0">${scoreBox(k.score, 52, 20)}<span class="qa-note">${delta(k.scoreDelta)}${trend}</span></div></div>
<div class="qa-cd" style="padding:8px 10px">${line([d.weekly.me, d.weekly.team], d.weekly.labels, { w: 340, h: 120 })}${leg(shortName(d.name), 'Jamoa')}</div>
${planCard}
${iss ? `<button type="button" class="qa-al ${iss.tone}" style="padding:10px"${iss.example?.callId ? ` data-qt-call="${esc(iss.example.callId)}"` : ''}><span class="i"><b>${iss.count}</b></span><div style="flex:1"><b>${esc(iss.title)}</b><br><span class="qa-note">${[esc(iss.sub || ''), iss.example?.callId ? 'misolni ochish' : ''].filter(Boolean).join(' · ')}</span></div></button>` : ''}`;
    }
    async function ropPlan() {
        const d = await api('/plans/' + encodeURIComponent(RP.planId));
        const p = d.plan, m = d.manager;
        const cur = p.weeks.find(w => w.status === 'current') || p.weeks[0];
        const g0 = p.goals[0];
        const focus = p.kind === 'mini' && g0 ? `<div class="qa-row" style="font-size:13px"><b style="flex:1">${esc(g0.label)}</b><span class="qa-note">oʻtgan hafta ${g0.start ?? '—'} ta → maqsad ${g0.target}</span></div>` : '';
        const hist = d.history ? `<span class="qa-note">Oʻtgan mini-rejalar: ${d.history.pastMini || 'yoʻq'} · faol reja: ${d.history.activeFull ? 'bor' : 'yoʻq'}</span>` : '';
        const impact = p.kind === 'mini' && p.violKind && /chegirma/.test(p.violKind) && g0?.start ? `<div class="qa-cd" style="gap:6px;background:#FFFAEB;border-color:#FEDF89"><span class="qa-sec">Taʼsir</span><span style="font-size:13px">${g0.start} × ~600 ming = <b>~${mln(g0.start * 600000)}</b> xavf ostida edi (bir hafta)</span>${hist}</div>` : '';
        const steps = p.kind === 'mini' ? [['Maqsad', p.goals.map(g => `${g.label} ${g.lower ? '' : '≥ '}${g.target}`).join(' · ')], ...cur.tasks.filter(t => t.who !== 'AI' && !/1:1/.test(t.text)).slice(0, 2).map(t => [t.text, t.sub])] : p.weeks.map(w => [w.label, w.title]);
        return `${phHdr(`${p.kind === 'mini' ? 'Mini-reja' : 'Reja'} · ${esc(shortName(p.managerName))}`, `${p.author === 'AI' ? 'AI taklifi' : ''} · ${esc(when(Date.parse(p.createdAt)))}`, p.status === 'pending' ? 'list' : 'man:' + p.managerId)}
<div class="qa-cd" style="gap:8px"><div class="qa-row">${av(p.managerName, 40, p.managerAvatar, p.managerId)}<div style="flex:1;min-width:0"><b>${esc(p.managerName)}</b><div class="qa-note">Ball ${m.kpis.score ?? '—'} · buzilish ${m.kpis.violations}${p.kind === 'mini' ? ' (chegara 5+)' : ''}</div><div style="margin-top:4px">${planStatusTag(p)}</div></div></div><div class="qa-al o" style="padding:10px"><span class="i">${ic('warn', 16)}</span><div style="font-size:12px"><b>Sabab:</b> ${esc(p.reason)}.</div></div></div>
<div class="qa-cd" style="gap:6px"><span class="qa-sec">${esc(rangeLabel(p.weeks[0].start, p.weeks[p.weeks.length - 1].end))} · ${p.weeks.length} hafta</span>${focus}${steps.map(([a, b], i) => `<div class="qa-row" style="gap:10px;padding:7px 0;border-bottom:1px solid #EEF1F6;font-size:13px"><span class="qa-tg g-n" style="width:22px;justify-content:center">${i + 1}</span><div style="flex:1"><b>${esc(a)}</b><div class="qa-note">${esc(b || '')}</div></div></div>`).join('')}</div>
${p.status === 'pending' ? `<div class="qa-row"><button type="button" class="qa-btn" style="flex:1;min-height:46px" data-qt-act="edit" data-qt-act-id="${esc(p.id)}">Tahrirlash</button><button type="button" class="qa-btn qa-pri" style="flex:1;min-height:46px" data-qt-act="approve" data-qt-act-id="${esc(p.id)}">Tasdiqlash</button></div>${impact}<span class="qa-note" style="text-align:center">Tasdiqlansa menejerning “Rivojlanish rejam” boʻlimiga chiqadi</span>` : `<div class="qa-cd" style="gap:0;padding:2px 14px"><span class="qa-sec" style="padding:8px 0 0">Vazifalar · ${esc(cur.label)}</span>${cur.tasks.map(tk => taskRow(p, tk, { canRop: p.status === 'active', canMgr: false })).join('')}</div>`}`;
    }
    // Telefon ilovalari ekranni tez-tez qayta chizadi (polling). Ekran tugunini saqlab, qayta joylaymiz — qayta yuklanmaydi;
    // 60 soniyadan eski bo'lsa yoki ekran turi almashsa yangilanadi.
    const HOSTS = new Map();
    function phoneHost(host, key, fn, { force = false } = {}) {
        if (!host) return;
        let h = HOSTS.get(key);
        const fresh = !h || force || Date.now() - h.at > 60000;
        if (!h) { h = { el: document.createElement('div'), at: 0 }; HOSTS.set(key, h); }
        host.innerHTML = '';
        host.appendChild(h.el);
        if (fresh) { h.at = Date.now(); fn(h.el); }
    }
    // Targetolog: Lid sifati (telefon)
    async function phoneLeadQuality(root, { noTitle = false, backAttr = '' } = {}) {
        const render = async () => {
            if (!root.querySelector('.qt-ph')) root.innerHTML = `<div class="qa qt-ph">${loading()}</div>`;
            let d; try { d = await api('/lead-quality' + q({ per: PH.per })); } catch (e) { root.innerHTML = `<div class="qa qt-ph">${err(e)}</div>`; return; }
            const top = `<div class="qa-row">${backAttr ? `<button type="button" class="qa-ib" ${backAttr} aria-label="Orqaga">${ic('back', 20)}</button>` : ''}<b style="flex:1;font-size:${backAttr ? 18 : 22}px">Lid sifati (AI)</b>${phPer(PH, d)}</div>`;
            if (!d.total) { root.innerHTML = `<div class="qa qt-ph">${top}${empty('Bu davrda 1-qoʻngʻiroq tahlili yoʻq')}</div>`; return; }
            const adv = lqAdvice(d);
            root.innerHTML = `<div class="qa qt-ph">${top}
<div class="qa-row" style="gap:8px;position:relative;margin-top:6px"><span class="qt-new">YANGI</span>${kpi(d.total, 'Tahlil')}${kpi(d.targetedPct + '%', 'Maqsadli', { color: '#067647' })}${kpi(usd(d.costPerTargeted), '1 maqsadli lid')}</div>
<div class="qa-cd" style="gap:0;padding:4px 14px"><span class="qa-sec" style="padding:8px 0 2px">Reklama boʻyicha</span>${d.bySource.map(s => `<div style="padding:8px 0;border-bottom:1px solid #EEF1F6;display:flex;flex-direction:column;gap:5px"><div class="qa-row"><b style="flex:1;font-size:13px">${esc(s.name)}</b><span class="qa-tg ${qCls(s.pct)}">${s.pct}%</span></div>${bar(s.pct, qColor(s.pct))}<span class="qa-note">${[s.leads + ' lid', srcPrice(d, s) != null ? usd(srcPrice(d, s)) : '—', esc(s.note || '')].filter(Boolean).join(' · ')}</span></div>`).join('')}</div>
${adv ? `<div class="qa-al o"><span class="i">${ic('warn', 18)}</span><div style="font-size:12px">${adv}</div></div>` : ''}
<span class="qa-note" style="text-align:center">Menejer ballari sizga koʻrinmaydi</span></div>`;
        };
        phoneMount(root, render);
        await render();
    }

    // Navigatsiyadagi "YANGI" belgisi (Sotuv › Tahlil, Marketing › Lid sifati) — sahifa ochilmasdan ham ko'rinadi.
    (function navBadge() {
        if (document.getElementById('qtNavStyle')) return;
        const s = document.createElement('style');
        s.id = 'qtNavStyle';
        s.textContent = '.nav-new-badge{display:inline-flex;align-items:center;margin-left:6px;font-size:10px;font-weight:800;letter-spacing:.3px;padding:1px 6px;border-radius:999px;background:#FEF0C7;color:#93370D;vertical-align:middle;line-height:16px}'
            + '#tab-call-ai-me{padding:0 0 24px}#tab-call-ai-me .ca-me-head{margin-bottom:14px}#tab-call-ai-me .ca-me-head h1{margin:0;font-size:28px;font-weight:800;color:#0B1220}#tab-call-ai-me .ca-me-head p{margin:2px 0 0;font-size:13px;color:#4B5563}';
        document.head.appendChild(s);
    })();

    window.callAiTahlil = { renderSales, renderMe, home, renderLeadQuality, openSalesTahlil, openMe, openCall, phoneMe, phoneReja, phoneHomeBlock, phoneRop, phoneLeadQuality, phoneHost, css, _t: { grade, rangeLabel, radar, line } };
})();
