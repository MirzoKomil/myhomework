// Qo'ng'iroq AI tahlili — lid oynasi (kompyuter), lid kartasi (sotuv telefon ilovasi) va bitta qo'ng'iroq tahlili.
// Dizayn manbasi: "CRM — barcha dizaynlar" kanvasi › qongiroq-komp (QAT_K_lid, QAT_K_tahlil, QAT_K_menTahlil)
// va qongiroq-tel (QAT_T_lid, QAT_T_tahlil, QAT_T_matn, QAT_T_etiroz). Klasslar dizayndagi bilan bir xil, "qa-" prefiksi bilan.
// Server: /api/call-ai (server/routes/callAi.js), yozuvlar: /api/state/call-recordings (+analysis).
(function () {
    'use strict';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const P = {
        play: '<path d="M7 4l13 8-13 8z"/>', pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z"/>',
        warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/>', back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 18l6-6-6-6"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', clip: '<path d="M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 7"/>',
        send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>', check: '<path d="M5 12.5l4.5 4.5L19 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
        phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',
        trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    };
    const ic = (k, s = 18, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k] || ''}</svg>`;
    const TYPES = { birinchi: ['1-qoʻngʻiroq', 'g-n'], qayta: ['Qayta', 'g-y'], sinovdan_keyin: ['Sinovdan keyin', 'g-p'], tolov: ['Toʻlov', 'g-o'], qarzdorlik: ['Qarzdorlik', 'g-z'], eslatma: ['Eslatma', 'g-n'] };
    const PENDING = new Set(['queued', 'transcribing', 'scoring']);
    const VIOL = { nasiyasiz_chegirma: 'Nasiyasiz chegirma', oylik_narx_oldindan: 'Oylik narx oldindan', boshida_chegirma: 'Boshida chegirma', ortiqcha_vada: 'Ortiqcha vaʼda' };

    function css() {
        if (document.getElementById('qaStyle')) return;
        const st = document.createElement('style');
        st.id = 'qaStyle';
        st.textContent = `
.qa{font-family:'DW Jakarta','Plus Jakarta Sans',system-ui,sans-serif;color:#0B1220;text-align:left}
.qa a{color:#0057B8;text-decoration:none}
.qa *{box-sizing:border-box}
.qa [hidden]{display:none!important}
.qa button{font-family:inherit}
.qa-cd{background:#fff;border:1px solid #E6EAF2;border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:10px;color:#0B1220}
.qa-note{font-size:12px;color:#4B5563;line-height:1.45}
.qa-sec{font-size:12px;font-weight:800;letter-spacing:.4px;color:#3A4456;text-transform:uppercase}
.qa-row{display:flex;gap:10px;align-items:center}
.qa-ib{flex:none;width:44px;height:44px;border-radius:12px;border:1px solid #E6EAF2;display:grid;place-items:center;color:#0B1220;background:#fff;cursor:pointer}
.qa-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #E6EAF2;background:#fff;border-radius:12px;padding:0 12px;min-height:44px;font-size:13px;font-weight:700;color:#0B1220;white-space:nowrap;cursor:pointer;text-align:left}
.qa-chip.on{background:#0B1220;color:#fff;border-color:#0B1220}
.qa-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:46px;padding:0 16px;border-radius:14px;font-weight:700;font-size:14px;border:1px solid #E6EAF2;background:#fff;color:#0B1220;white-space:nowrap;cursor:pointer}
.qa-btn:hover{border-color:#0057B8}.qa-btn:disabled{opacity:.5;cursor:default}
.qa-pri{background:#0057B8;border-color:#0057B8;color:#fff}.qa-pri:hover{background:#00428C;color:#fff}
.qa-tg{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap;line-height:16px}
.qa .g-a{background:#ECFDF3;color:#067647}.qa .g-y{background:#EAF3FF;color:#0057B8}.qa .g-o{background:#FEF0C7;color:#93370D}.qa .g-z{background:#FEF3F2;color:#B42318}.qa .g-n{background:#EEF1F6;color:#3A4456}.qa .g-p{background:#F1ECFE;color:#5B30B5}
.qa-sc{flex:none;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;line-height:1}
.qa-sc b{font-variant-numeric:tabular-nums;letter-spacing:-1px}.qa-sc small{font-size:10px;letter-spacing:.5px;margin-top:4px}
.qa-st{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #EEF1F6}.qa-st:last-child{border-bottom:0}
.qa-st i{flex:none;width:24px;height:24px;border-radius:8px;display:grid;place-items:center}
.qa .ok{background:#ECFDF3;color:#067647}.qa .no{background:#FEF3F2;color:#B42318}.qa .hf{background:#FEF0C7;color:#93370D}
.qa-st div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:13px}.qa-st div span{font-size:12px;color:#4B5563;line-height:1.4}
.qa-qt{border:1px solid #E6EAF2;border-radius:16px;overflow:hidden;font-size:13px;line-height:1.45}
.qa-qt .h{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#F5F7FB;font-size:12px;font-weight:700;color:#3A4456;cursor:pointer}
.qa-qt .s{padding:10px 12px;background:#FEF3F2;color:#7A271A}.qa-qt .k{padding:10px 12px;background:#ECFDF3;color:#05603A}
.qa-qt .s b,.qa-qt .k b{display:block;font-size:11px;letter-spacing:.3px;text-transform:uppercase;margin-bottom:2px}
.qa-pl{display:flex;align-items:center;gap:10px;background:#0B1220;border-radius:16px;padding:10px 12px;color:#fff}
.qa-pl .pb{flex:none;width:44px;height:44px;border-radius:50%;background:#fff;color:#0B1220;display:grid;place-items:center;border:0;cursor:pointer}
.qa-wv{flex:1;display:flex;align-items:center;justify-content:space-between;gap:2px;height:28px;cursor:pointer;overflow:hidden}
.qa-wv i{display:block;flex:1;max-width:3px;min-width:2px;border-radius:2px;background:#5A6B86}.qa-wv i.p{background:#5EA2FF}
.qa-pl .tm{font-size:12px;font-variant-numeric:tabular-nums;color:#C9D3E3;white-space:nowrap}
.qa-pl .sp{flex:none;background:#1E293B;border:0;border-radius:8px;color:#fff;font-size:12px;font-weight:800;padding:4px 8px;min-height:28px;cursor:pointer}
.qa-bar{height:8px;border-radius:999px;background:#E6EAF2;overflow:hidden}.qa-bar i{display:block;height:8px;border-radius:999px}
.qa-tab{min-height:44px;display:inline-flex;align-items:center;padding:0 2px;font-size:14px;font-weight:700;color:#4B5563;border:0;border-bottom:2px solid transparent;background:none;cursor:pointer}
.qa-tab.on{color:#0B1220;border-color:#0057B8}
.qa-seg{display:flex;background:#EEF1F6;border-radius:14px;padding:4px;gap:4px}
.qa-seg button{flex:1;min-height:44px;border-radius:10px;display:grid;place-items:center;font-size:13px;font-weight:700;color:#3A4456;background:none;border:0;cursor:pointer}
.qa-seg button.on{background:#fff;color:#0B1220;box-shadow:0 1px 3px rgba(11,18,32,.12)}
.qa-say{background:#F5F7FB;border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.45;display:flex;gap:8px}.qa-say>b{flex:none;color:#0057B8}
.qa-tr{display:flex;gap:10px;font-size:13px;line-height:1.5;cursor:pointer}
.qa-tr time{flex:none;width:40px;font-size:11px;color:#4B5563;padding-top:2px;font-variant-numeric:tabular-nums}
.qa-tr .w{flex:1;border-radius:12px;padding:8px 10px}
.qa-tr .m{background:#EAF3FF}.qa-tr .c{background:#fff;border:1px solid #E6EAF2}
.qa-tr .w b{display:block;font-size:11px;color:#3A4456;margin-bottom:2px}
.qa-tr .bad{outline:2px solid #F04438;outline-offset:-2px;background:#FEF3F2}
.qa-tr .good{outline:2px solid #12B76A;outline-offset:-2px;background:#ECFDF3}
.qa-tr.now .w{box-shadow:0 0 0 3px rgba(0,87,184,.25)}
.qa-in{min-height:44px;border:1px solid #E6EAF2;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;color:#0B1220;background:#fff;width:100%}
.qa-kpi{background:#fff;border:1px solid #E6EAF2;border-radius:20px;padding:10px;display:flex;flex-direction:column;gap:4px}
.qa-kpi b{font-size:20px;font-weight:800;letter-spacing:-.5px;font-variant-numeric:tabular-nums}.qa-kpi span{font-size:12px;color:#4B5563;font-weight:600}
.qa-rr{display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:14px;border:1px solid #E6EAF2;color:#0B1220;cursor:pointer;background:#fff;width:100%;font:inherit;text-align:left}
.qa-rr.on{background:#EAF3FF;border-color:#EAF3FF}.qa-rr.nof{cursor:default}
.qa-rr .pi{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;flex:none;border:0;cursor:pointer}
.qa-dot{width:10px;height:10px;border-radius:50%;background:#0057B8;animation:qaP 1.2s infinite;flex:none;display:inline-block}
@keyframes qaP{0%,100%{opacity:.25}50%{opacity:1}}
.qa-trlist{display:flex;flex-direction:column;gap:7px;overflow:auto;min-height:0}
.qa-pr{display:flex;gap:10px;align-items:center;padding:4px 0;min-height:44px;border:0;border-bottom:1px solid #EEF1F6;color:#0B1220;cursor:pointer;background:none;width:100%;font:inherit;text-align:left}
.qa-pr:last-child{border-bottom:0}
#modalOverlay .modal.modal--wide:has(.qa-lead){max-width:min(880px,calc(100vw - 32px))!important;width:min(880px,calc(100vw - 32px))!important}
#modalOverlay .modal.modal--wide:has(.qa-call){max-width:min(1180px,calc(100vw - 32px))!important;width:min(1180px,calc(100vw - 32px))!important}
.qa-call-g{display:grid;grid-template-columns:400px minmax(0,1fr);gap:14px;align-items:start}
.qa-call-r{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:12px;align-items:start}
@media (max-width:1100px){.qa-call-g{grid-template-columns:1fr}.qa-call-r{grid-template-columns:1fr}}
@media (max-width:640px){.qa-rr{flex-wrap:wrap}}`;
        document.head.appendChild(st);
    }

    // ── Yordamchilar ──
    const user = () => { try { return typeof getCurrentUser === 'function' ? getCurrentUser() : null; } catch (e) { return null; } };
    const isRop = () => ['admin', 'rop', 'boshliq'].includes(user()?.role);
    const isMgr = () => user()?.role === 'sales_manager';
    function grade(s) {
        if (s >= 90) return ['AʼLO', 'g-a', '#067647', '#ECFDF3'];
        if (s >= 80) return ['YAXSHI', 'g-y', '#0057B8', '#EAF3FF'];
        if (s >= 60) return ['OʻRTA', 'g-o', '#93370D', '#FEF0C7'];
        return ['ZAIF', 'g-z', '#B42318', '#FEF3F2'];
    }
    const scoreBox = (s, size = 64, fs = 24) => { const g = grade(s); return `<div class="qa-sc" style="width:${size}px;height:${size}px;background:${g[3]};color:${g[2]}"><b style="font-size:${fs}px">${s}</b><small>${g[0]}</small></div>`; };
    const gtag = s => { const g = grade(s); return `<span class="qa-tg ${g[1]}">${s} · ${g[0]}</span>`; };
    const typeOf = a => a?.result?.type || a?.type || '';
    // Ro'yxatdagi tur: AI aniqlagani; qisqa/jim qo'ng'iroqqa "Eslatma" yopishtirilmaydi.
    const shownType = a => (a?.result?.type) || (a && a.status !== 'skipped' ? a.type : '') || '';
    const typeTag = (t, extra = '', fallback = 'Qoʻngʻiroq') => { const x = TYPES[t] || [fallback, 'g-n']; return `<span class="qa-tg ${x[1]}"${extra}>${x[0]}</span>`; };
    const pad = n => String(n).padStart(2, '0');
    function when(iso) {
        const d = new Date(iso); if (isNaN(d)) return '';
        const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
        const diff = Math.round((day(new Date()) - day(d)) / 864e5);
        const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        if (diff === 0) return `Bugun ${t}`;
        if (diff === 1) return `Kecha ${t}`;
        const M = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
        return `${d.getDate()}-${M[d.getMonth()]} ${t}`;
    }
    const hm = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const mmss = s => { s = Math.round(Number(s) || 0); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
    const dur = s => { s = Math.round(Number(s) || 0); return s ? `${Math.floor(s / 60)}:${pad(s % 60)}` : ''; };
    const durLong = s => { s = Math.round(Number(s) || 0); return s ? `${Math.floor(s / 60)} daq ${s % 60} son` : ''; };
    const mln = n => { n = Number(n) || 0; if (!n) return '0'; return n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '')} mln` : `${Math.round(n / 1000)} ming`; };
    const tsec = t => { const m = String(t || '').match(/(\d+):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
    function outcomeText(r) {
        if (!r) return '';
        if (r.outcome === 'tolov') return 'Toʻlov qildi';
        if (r.outcome === 'sinov_darsi') return r.nextStepAt ? `Sinov darsiga yozildi · ${r.nextStepAt}` : 'Sinov darsiga yozildi';
        if (r.nextStepAt) return `Kelishildi: ${r.nextStepAt}`;
        return 'Vaqt kelishilmadi';
    }
    const noTime = r => r && !r.nextStepAt && !['tolov', 'sinov_darsi'].includes(r.outcome);
    function critbars(r, fs = 12) {
        return `<div style="display:flex;flex-direction:column;gap:7px">${(r.criteria || []).map(c => {
            const p = c.max ? c.got / c.max * 100 : 0; const col = p >= 80 ? '#067647' : p >= 55 ? '#B54708' : '#B42318';
            return `<div class="qa-row" style="gap:8px;font-size:${fs}px"><span style="flex:1">${esc(c.name)}</span><b style="width:44px;text-align:right">${c.got}/${c.max}</b></div><div class="qa-bar" style="margin-top:-4px"><i style="width:${p.toFixed(0)}%;background:${col}"></i></div>`;
        }).join('')}</div>`;
    }
    const st = (k, title, desc) => { const m = { ok: ['ok', 'check'], no: ['no', 'x'], hf: ['hf', 'warn'] }[k] || ['hf', 'warn']; return `<div class="qa-st"><i class="${m[0]}">${ic(m[1], 14, 2.6)}</i><div><b>${esc(title)}</b>${desc ? `<span>${esc(desc)}</span>` : ''}</div></div>`; };
    // Qabul qilingan e'tiroz: qayta baholanayotganda — "qayta baholanmoqda", tugagach — "61 → 68".
    const acceptedTxt = d => (PENDING.has(d.status) ? 'Qabul qilindi · qayta baholanmoqda…' : d.status === 'error' && d.appeal.scoreAfter == null ? 'Qabul qilindi · qayta baholashda xato' : `Qabul qilindi · ${d.appeal.scoreBefore ?? '?'} → ${d.appeal.scoreAfter ?? d.result?.score ?? '?'}`);
    function hoursLeft(iso) { const ms = Date.parse(iso) - Date.now(); return ms > 0 ? Math.ceil(ms / 3600e3) : 0; }

    // ── Pleer (dizayndagi qora pleer, to'lqin chizig'i, tezlik) ──
    function wave(seed, n) {
        let x = 0; for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
        let out = ''; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; out += `<i style="height:${5 + (x >>> 16) % 24}px"></i>`; }
        return out;
    }
    function player(id, url, total, { speed = true, bars = 40 } = {}) {
        bars = bars === 40 ? 64 : bars;
        return `<div class="qa-pl" data-qa-pl="${esc(id)}" data-src="${esc(url)}"><button type="button" class="pb" data-qa-play aria-label="Tinglash">${ic('play', 18)}</button><div style="flex:1;min-width:0;overflow:hidden"><div class="qa-wv" data-qa-wave>${wave(id, bars)}</div></div><span class="tm"><span data-qa-cur>00:00</span> / ${esc(mmss(total))}</span>${speed ? '<button type="button" class="sp" data-qa-speed>1×</button>' : ''}</div>`;
    }
    const audios = new Map();
    function stopAll(except) { audios.forEach((a, k) => { if (k !== except && !a.paused) a.pause(); }); }
    const rateTxt = r => `${String(r).replace('.', ',')}×`;
    function bindPlayers(root) {
        root.querySelectorAll('[data-qa-pl]').forEach(pl => {
            const id = pl.dataset.qaPl;
            let a = audios.get(id);
            if (!a || a._src !== pl.dataset.src) { a = new Audio(); a.preload = 'none'; a.src = pl.dataset.src; a._src = pl.dataset.src; audios.set(id, a); }
            const btn = pl.querySelector('[data-qa-play]'), cur = pl.querySelector('[data-qa-cur]'), wv = pl.querySelector('[data-qa-wave]'), sp = pl.querySelector('[data-qa-speed]');
            const bars = wv ? [...wv.children] : [];
            const box = root.querySelector(`[data-qa-tr="${CSS.escape(id)}"]`);
            const paint = () => {
                const f = a.duration ? a.currentTime / a.duration : 0;
                bars.forEach((b, i) => b.classList.toggle('p', i < Math.round(f * bars.length)));
                if (cur) cur.textContent = `${pad(Math.floor(a.currentTime / 60))}:${pad(Math.floor(a.currentTime % 60))}`;
                btn.innerHTML = ic(a.paused ? 'play' : 'pause', 18);
                if (box) { let now = null; box.querySelectorAll('[data-t]').forEach(r => { if (Number(r.dataset.t) <= a.currentTime) now = r; r.classList.remove('now'); }); if (now && !a.paused) now.classList.add('now'); }
            };
            a.ontimeupdate = paint; a.onplay = paint; a.onpause = paint; a.onended = paint;
            paint();
            btn.onclick = () => { if (a.paused) { stopAll(id); a.play().catch(() => {}); } else a.pause(); };
            if (wv) wv.onclick = e => { const r = wv.getBoundingClientRect(); const go = () => { if (a.duration) a.currentTime = (e.clientX - r.left) / r.width * a.duration; }; if (a.readyState < 1) { a.addEventListener('loadedmetadata', go, { once: true }); a.load(); } else go(); };
            if (sp) { sp.textContent = rateTxt(a.playbackRate); sp.onclick = () => { a.playbackRate = a.playbackRate === 1 ? 1.5 : a.playbackRate === 1.5 ? 2 : 1; sp.textContent = rateTxt(a.playbackRate); }; }
            // Matndagi gapni bossa — o'sha joydan tinglanadi
            if (box) box.querySelectorAll('[data-t]').forEach(row => {
                row.onclick = () => {
                    const go = () => { a.currentTime = Number(row.dataset.t) || 0; stopAll(id); a.play().catch(() => {}); };
                    if (a.readyState < 1) { a.addEventListener('loadedmetadata', go, { once: true }); a.load(); } else go();
                };
            });
        });
    }

    function transcriptHtml(id, segs, marks, me) {
        const mk = {}; (marks || []).forEach(m => { mk[m.t] = m.kind; });
        return `<div class="qa-trlist" data-qa-tr="${esc(id)}">${segs.map(s => `<div class="qa-tr" data-t="${tsec(s.t)}"><time>${esc(s.t)}</time><div class="w ${s.s === 'C' ? 'c' : 'm'} ${mk[s.t] || ''}"><b>${s.s === 'C' ? 'Mijoz' : esc(me)}</b>${esc(s.text)}</div></div>`).join('')}</div>`;
    }

    // ── Lid oynasi (kompyuter) — QAT_K_lid: "Qo'ng'iroq yozuvlari va AI tahlili" ──
    function latestDone(recs) { return recs.map(r => r.analysis).filter(a => a && a.status === 'done' && a.result).sort((x, y) => Date.parse(y.callAt) - Date.parse(x.callAt))[0] || null; }
    function statusLine(a) {
        if (!a) return 'Tahlil qilinmagan';
        if (PENDING.has(a.status)) return `<span class="qa-dot"></span> ${a.status === 'queued' ? 'Tahlil navbatda' : a.status === 'transcribing' ? 'Matnga aylantirilmoqda' : 'Skript boʻyicha baholanmoqda'}…`;
        if (a.status === 'nokey') return 'AI ulanmagan — yozuv saqlandi, ulangach baholanadi';
        if (a.status === 'skipped') return esc(a.error || 'Baholanmaydi');
        if (a.status === 'error') return `Xato: ${esc(a.error || '')}`;
        return esc(outcomeText(a.result));
    }
    function recRow(r, on, readOnly, canDel) {
        const a = r.analysis;
        const graded = a && a.status === 'done' && a.result;
        const ap = a?.appeal?.status === 'pending' ? `<span class="qa-tg g-p">${isRop() ? 'eʼtiroz kutmoqda' : 'eʼtiroz yuborildi'}</span>` : '';
        const right = ap + (graded ? gtag(a.result.score) : a && a.status === 'skipped' ? '<span class="qa-tg g-n">baholanmaydi</span>' : a && PENDING.has(a.status) ? '<span class="qa-tg g-y">tahlil…</span>' : '');
        const del = !readOnly && canDel ? `<button type="button" class="qa-ib" style="width:36px;height:36px;border:0;color:#94A3B8" data-qa-del="${esc(r.id)}" aria-label="Yozuvni oʻchirish" title="Yozuvni oʻchirish">${ic('trash', 15)}</button>` : '';
        const t = shownType(a);
        const at = a?.callAt || r.callAt || r.createdAt;
        const len = a?.durationSec || r.duration;
        return `<div class="qa-rr${on ? ' on' : ''}" ${a ? `data-qa-open="${esc(a.id)}" role="button" tabindex="0"` : ''}><button type="button" class="pi" style="background:#0B1220;color:#fff" data-qa-mini="${esc(r.id)}" data-src="${esc(r.url)}" aria-label="Tinglash">${ic('play', 13)}</button>${typeTag(t, ' style="width:104px;justify-content:center"', a && a.status === 'skipped' ? 'Qisqa' : 'Qoʻngʻiroq')}<span style="width:150px;font-size:13px">${esc(when(at))}${len ? ' · ' + esc(dur(len)) : ''}</span><span style="flex:1;min-width:0" class="qa-note">${statusLine(a)}</span>${right}${del}</div>`;
    }
    function leadSection(recs, missing, { readOnly = false, canDelete = () => false } = {}) {
        css();
        const last = latestDone(recs);
        const lr = last?.result;
        const top = lr ? `<div class="qa-row" style="gap:12px;align-items:stretch"><div style="display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;background:#F5F7FB;border-radius:14px;padding:10px 14px">${scoreBox(lr.score, 64, 24)}<span class="qa-note">Oxirgi</span></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:8px"><div class="qa-row" style="gap:6px;flex-wrap:wrap">${lr.saleProbability != null ? `<span class="qa-tg g-n">Sotuv ehtimoli ${lr.saleProbability}%</span>` : ''}${noTime(lr) ? `<span class="qa-tg g-z">${ic('warn', 12)} Vaqt kelishilmadi</span>` : ''}${(lr.violations || []).slice(0, 2).map(v => `<span class="qa-tg g-z">${esc(VIOL[v.kind] || v.text)}</span>`).join('')}${lr.approximate ? '<span class="qa-tg g-o">taxminiy</span>' : ''}</div>
            ${lr.aiTip || lr.nextLines?.[0] ? `<div class="qa-say"><b>AI</b><span>${esc(lr.aiTip || '')}${lr.nextLines?.[0] ? ` <b style="color:#0B1220">“${esc(lr.nextLines[0])}”</b>` : ''}</span></div>` : ''}</div></div>` : '';
        const rows = [];
        recs.forEach(r => rows.push({ at: r.analysis?.callAt || r.callAt || r.createdAt, html: recRow(r, last && r.analysis?.id === last.id, readOnly, canDelete(r)) }));
        (missing || []).forEach(m => rows.push({ at: m.callAt, html: `<div class="qa-rr nof"><span class="pi" style="background:#EEF1F6;color:#4B5563;cursor:default">${ic('warn', 13)}</span>${typeTag('', ' style="width:104px;justify-content:center"', 'Yozuvsiz')}<span style="width:150px;font-size:13px">${esc(when(m.callAt))}${m.durationSec ? ' · ' + esc(dur(m.durationSec)) : ''}</span><span style="flex:1;min-width:0" class="qa-note">Yozuv topilmadi — fayl boshqa papkada boʻlishi mumkin</span><span class="qa-tg g-n">baholanmaydi</span>${readOnly ? '' : ` <button type="button" class="qa-btn" style="min-height:44px;padding:0 10px;font-size:12px" data-qa-attach="${esc(m.id)}">Arxivga biriktirish</button>`}</div>` }));
        rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
        return `<div class="qa qa-lead" style="display:flex;flex-direction:column;gap:8px">
            <div class="qa-row"><b style="flex:1;font-size:15px">Qoʻngʻiroq yozuvlari va AI tahlili</b><span class="qa-note">Telefondan avtomatik</span>${readOnly ? '' : '<button type="button" class="qa-btn" style="min-height:44px;font-size:13px" data-qa-upload>+ Yozuv yuklash</button>'}</div>
            ${top}
            ${rows.length ? rows.map(x => x.html).join('') : '<p class="qa-note" style="margin:6px 0">Hozircha qoʻngʻiroq yozuvi yoʻq. Jamoa ilovasidan qoʻngʻiroq qilsangiz, telefon yozuvi shu yerga oʻzi tushadi va AI skript boʻyicha baholaydi.</p>'}
            <input type="file" accept="audio/*" data-qa-file hidden>
        </div>`;
    }

    // ── Bitta qo'ng'iroq (kompyuter) — QAT_K_tahlil (ROP) / QAT_K_menTahlil (menejer) ──
    function appealCard(d) {
        const ap = d.appeal;
        if (ap) {
            const pend = ap.status === 'pending';
            const late = pend && !hoursLeft(d.appealRopDeadline);
            const tag = pend ? (late ? '<span class="qa-tg g-z">ROP muddati oʻtdi</span>' : `<span class="qa-tg g-p">${isRop() ? `ROP qaroriga ${hoursLeft(d.appealRopDeadline)} soat` : `Yuborildi ${esc(hm(ap.at))} · ROP 24 soat ichida hal qiladi`}</span>`) : ap.status === 'accepted' ? `<span class="qa-tg g-a">${acceptedTxt(d)}</span>` : '<span class="qa-tg g-z">Rad etildi</span>';
            return `<div class="qa-cd" style="gap:8px;padding:12px;border-color:#D9CFFB;background:#FAF8FF"><div class="qa-row"><span class="qa-sec" style="flex:1">${isMgr() ? 'Bahoga eʼtirozingiz' : `Eʼtiroz · ${esc(ap.by || '')}`}</span>${isRop() ? tag : ''}</div><span style="font-size:13px"><b>${esc(ap.criterion)}:</b> “${esc(ap.text)}”</span>${isMgr() ? tag : ''}${ap.note ? `<span class="qa-note">ROP: ${esc(ap.note)}</span>` : ''}${pend && isRop() ? `<span class="qa-note">Qabul qilinsa — “${esc(ap.criterion)}” qayta baholanadi (AI matnni qayta tekshiradi).</span><div class="qa-row" data-qa-decbtns><button type="button" class="qa-btn" style="flex:1;min-height:44px" data-qa-rejopen>Rad etish</button><button type="button" class="qa-btn qa-pri" style="flex:1;min-height:44px" data-qa-decide="1">Qabul qilish</button></div><div data-qa-rejform hidden><textarea class="qa-in" rows="2" data-qa-rejnote placeholder="Rad etish sababi (menejer koʻradi)"></textarea><div class="qa-row" style="margin-top:8px"><button type="button" class="qa-btn" style="flex:1;min-height:44px" data-qa-rejcancel>Bekor</button><button type="button" class="qa-btn" style="flex:1;min-height:44px;color:#B42318;border-color:#FDA29B" data-qa-decide="0">Rad etish</button></div></div>` : ''}</div>`;
        }
        if (isMgr() && d.mine && d.status === 'done' && hoursLeft(d.appealDeadline) > 0) {
            return `<div class="qa-cd" style="gap:8px;padding:12px;border-color:#D9CFFB;background:#FAF8FF"><span class="qa-sec">Bahoga eʼtiroz</span><span class="qa-note">Baho notoʻgʻri boʻlsa, ${hoursLeft(d.appealDeadline)} soat ichida yuboring. ROP 24 soat ichida hal qiladi.</span><button type="button" class="qa-btn" style="min-height:44px;color:#5B30B5;border-color:#D9CFFB" data-qa-appeal>Eʼtiroz bildirish</button></div>`;
        }
        return '';
    }
    function taskCard(d) {
        const t = d.task;
        if (isRop()) {
            return `<div class="qa-cd" style="gap:8px;padding:12px"><div class="qa-row"><span class="qa-sec" style="flex:1">ROP topshirigʻi</span>${t ? `<span class="qa-tg g-a">Yuborildi ${esc(hm(t.at))}</span>` : ''}</div>
                <div data-qa-taskview ${t ? '' : 'hidden'}><span style="font-size:13px">${esc(t?.text || '')}</span><div class="qa-row" style="margin-top:8px"><span class="qa-note" style="flex:1">${t?.due ? `Muddat: ${esc(t.due)} · ` : ''}${t?.seenAt ? 'menejer koʻrdi' : 'menejer hali koʻrmadi'}</span><button type="button" class="qa-btn" style="min-height:44px" data-qa-taskedit>Tahrirlash</button></div></div>
                <div data-qa-taskform ${t ? 'hidden' : ''} style="flex-direction:column;gap:8px"><textarea class="qa-in" rows="3" data-qa-tasktext placeholder="Masalan: bugun 18:00 gacha qayta qoʻngʻiroq — nasiyani taklif qiling, aniq vaqt bilan yoping">${esc(t?.text || '')}</textarea><div class="qa-row" style="margin-top:8px"><input class="qa-in" data-qa-taskdue placeholder="Muddat: bugun 18:00" value="${esc(t?.due || '')}" style="flex:1"><button type="button" class="qa-btn qa-pri" style="min-height:44px" data-qa-tasksave>Yuborish</button></div></div></div>`;
        }
        if (t) return `<div class="qa-cd" style="gap:8px;padding:12px"><span class="qa-sec">ROP topshirigʻi</span><span style="font-size:13px">${esc(t.text)}</span>${t.due ? `<span class="qa-note">Muddat: ${esc(t.due)}</span>` : ''}${d.leadId ? `<button type="button" class="qa-btn qa-pri" style="min-height:44px" data-qa-lead="${esc(d.leadId)}">${ic('phone', 16, 2.2)} Lidni ochish</button>` : ''}</div>`;
        return '';
    }
    function callView(d, { back = true } = {}) {
        css();
        const r = d.result || {};
        const me = isMgr();
        const meName = me ? 'Siz' : 'Menejer';
        const segs = d.transcript || [];
        const lastBad = (r.marks || []).filter(m => m.kind === 'bad').map(m => m.t).pop();
        const head = `<div class="qa-row" style="flex-wrap:wrap">${back ? `<button type="button" class="qa-ib" data-qa-back aria-label="Orqaga">${ic('back', 20)}</button>` : ''}<div style="flex:1;min-width:240px"><b style="font-size:18px">${esc(d.leadName || 'Lid')} · ${esc(when(d.callAt))}${d.durationSec ? ' · ' + esc(durLong(d.durationSec)) : ''}</b><div class="qa-note">${esc(d.managerName || '')}${d.analyzedAt ? ' · tahlil ' + esc(hm(d.analyzedAt)) : ''} · skript: Sotuv › Skriptlar</div></div>
            ${isRop() ? `<label class="qa-chip" style="gap:4px">Tur: <select data-qa-type="${esc(d.id)}" aria-label="Qoʻngʻiroq turi" style="border:0;background:none;font:inherit;font-weight:700;cursor:pointer;color:inherit">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${typeOf(d) === k ? ' selected' : ''}>${v[0]}</option>`).join('')}</select></label><button type="button" class="qa-btn" style="min-height:44px" data-qa-retry="${esc(d.id)}">Qayta tahlil</button>` : typeTag(typeOf(d), ' style="font-size:13px;padding:8px 12px"')}
            ${d.leadId ? `<button type="button" class="qa-btn" style="min-height:44px" data-qa-lead="${esc(d.leadId)}">Lid kartasi</button>` : ''}</div>`;
        if (d.status !== 'done' || !d.result) {
            return `<div class="qa qa-call" style="display:flex;flex-direction:column;gap:14px">${head}<div class="qa-cd">${d.audioUrl ? player(d.id, d.audioUrl, d.durationSec) : ''}<div class="qa-row qa-note" style="font-size:13px">${statusLine(d)}</div>${segs.length ? transcriptHtml(d.id, segs, [], meName) : ''}</div></div>`;
        }
        const left = `<div class="qa-cd" style="gap:10px">${player(d.id, d.audioUrl, d.durationSec)}
            <div class="qa-row" style="gap:18px;border-bottom:1px solid #E6EAF2"><button type="button" class="qa-tab on" data-qa-ltab="matn">Matn</button><button type="button" class="qa-tab" data-qa-ltab="fakt">Faktlar (narx, vaʼdalar)</button></div>
            <div data-qa-lpane="matn" style="display:flex;flex-direction:column;gap:10px"><div class="qa-row qa-note" style="gap:12px;font-size:11px"><span class="qa-row" style="gap:5px"><i style="width:12px;height:12px;border-radius:3px;background:#EAF3FF;display:block"></i>${meName === 'Siz' ? 'Siz' : 'Menejer'}</span><span class="qa-row" style="gap:5px"><i style="width:12px;height:12px;border-radius:3px;border:1px solid #E6EAF2;display:block"></i>Mijoz</span><span class="qa-row" style="gap:5px"><i style="width:12px;height:12px;border-radius:3px;border:2px solid #12B76A;display:block"></i>Yaxshi</span><span class="qa-row" style="gap:5px"><i style="width:12px;height:12px;border-radius:3px;border:2px solid #F04438;display:block"></i>Xato</span></div>
            <div style="max-height:430px;display:flex;flex-direction:column">${transcriptHtml(d.id, segs, r.marks, meName)}</div>
            ${lastBad ? `<button type="button" class="qa-tg g-z" style="align-self:center;font-size:12px;padding:6px 12px;border:0;cursor:pointer" data-qa-jump="${esc(lastBad)}">↓ ${esc(lastBad)} xato · pastga aylantiring</button>` : ''}</div>
            <div data-qa-lpane="fakt" hidden>${(r.facts || []).length ? r.facts.map(f => st('ok', f.text, f.t)).join('') : '<span class="qa-note">Narx yoki vaʼda aytilmagan</span>'}</div>
            <span class="qa-note">Matnni AI yozgan — shubhali joyni tinglab tekshiring.</span></div>`;
        const kpis = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="qa-kpi"><b>${r.saleProbability ?? '—'}%</b><span>Sotuv ehtimoli</span></div>
            <div class="qa-kpi"><b style="${r.talkShareManager > 50 ? 'color:#B42318' : ''}">${r.talkShareManager ?? '—'}%</b><span>${me ? 'Siz gapirdingiz' : 'Menejer gapirdi'}</span></div>
            <div class="qa-kpi"><b style="${r.nameUses != null && r.nameUses < 5 ? 'color:#B42318' : ''}">${r.nameUses ?? '—'}</b><span>Mijoz ismi (meʼyor 5–6)</span></div>
            <div class="qa-kpi"><b style="${r.riskAmount ? 'color:#B42318' : ''}">${r.riskAmount ? mln(r.riskAmount) : '0'}</b><span>Xavf ostida</span></div></div>`;
        const TITLE = { birinchi: '1-qoʻngʻiroq mezoni', qayta: 'Qayta qoʻngʻiroq mezoni', sinovdan_keyin: 'Sinovdan keyingi qoʻngʻiroq mezoni', tolov: 'Toʻlov qoʻngʻirogʻi mezoni', qarzdorlik: 'Qarzdorlik qoʻngʻirogʻi mezoni' };
        const scoreCard = `<div class="qa-cd" style="flex-direction:row;align-items:center;gap:14px">${scoreBox(r.score, 76, 30)}<div style="flex:1;display:flex;flex-direction:column;gap:6px"><b style="font-size:14px">${esc(TITLE[r.type] || 'Qoʻngʻiroq mezoni')}${r.approximate ? ' · taxminiy' : ''}</b>${critbars(r)}</div></div>`;
        const quotes = (r.quotes || []).map(q => `<div class="qa-qt"><div class="h" data-qa-jump="${esc(q.t)}">${ic('clock', 14)} ${esc(q.t)}${q.criterion ? ' · ' + esc(q.criterion) : ''}</div><div class="s"><b>${me ? 'Siz dedingiz' : 'Menejer dedi'}</b>“${esc(q.said)}”</div><div class="k"><b>Shunday deyish kerak edi</b>“${esc(q.should)}”</div></div>`).join('');
        const lines = (r.nextLines || []).length ? `<div class="qa-cd" style="gap:7px;padding:12px"><span class="qa-sec">Keyingi qoʻngʻiroqda ayting</span>${r.nextLines.map((l, i) => `<div class="qa-say"><b>${i + 1}</b><span>“${esc(l)}”</span></div>`).join('')}</div>` : '';
        return `<div class="qa qa-call" style="display:flex;flex-direction:column;gap:14px">${head}
            <div class="qa-call-g">${left}<div class="qa-call-r">
                <div style="display:flex;flex-direction:column;gap:12px;min-width:0">${scoreCard}${quotes || st('ok', 'Jiddiy xato topilmadi', '')}${r.summary ? `<div class="qa-say"><b>AI</b><span>${esc(r.summary)}</span></div>` : ''}</div>
                <div style="display:flex;flex-direction:column;gap:10px">${kpis}${appealCard(d)}${taskCard(d)}${lines}</div></div></div></div>`;
    }

    // ── Sotuv telefon ilovasi — QAT_T_lid (karta + tarix) ──
    function phoneCard(recs, missing, { part = 'all', readOnly = false } = {}) {
        css();
        const last = latestDone(recs);
        const rec = last ? recs.find(r => r.analysis?.id === last.id) : null;
        const lr = last?.result;
        const pend = recs.find(r => r.analysis && PENDING.has(r.analysis.status));
        let card = '';
        if (lr) {
            card = `<div class="qa-cd" style="gap:10px"><div class="qa-row"><span class="qa-sec" style="flex:1">Qoʻngʻiroq yozuvlari · AI</span>${typeTag(lr.type)}</div>
            <div class="qa-row" style="align-items:flex-start">${scoreBox(lr.score, 58, 22)}<div style="flex:1;display:flex;flex-direction:column;gap:6px"><b style="font-size:14px">${esc(when(last.callAt))}${last.durationSec ? ' · ' + esc(dur(last.durationSec)) : ''}</b><div class="qa-row" style="gap:6px;flex-wrap:wrap">${noTime(lr) ? '<span class="qa-tg g-z">Vaqt kelishilmadi</span>' : `<span class="qa-tg g-a">${esc(outcomeText(lr))}</span>`}${lr.saleProbability != null ? `<span class="qa-tg g-n">Ehtimol ${lr.saleProbability}%</span>` : ''}</div></div></div>
            ${rec ? player(last.id, rec.url, last.durationSec, { speed: false, bars: 22 }) : ''}
            ${(lr.nextLines || []).length ? `<div style="display:flex;flex-direction:column;gap:7px"><span class="qa-sec">Hozir qayta qoʻngʻiroq qiling va ayting</span>${lr.nextLines.slice(0, 2).map((l, i) => `<div class="qa-say"><b>${i + 1}</b><span>“${esc(l)}”</span></div>`).join('')}</div>` : ''}
            ${last.task ? `<div class="qa-say" style="background:#FFFAEB"><b style="color:#93370D">ROP</b><span>${esc(last.task.text)}${last.task.due ? ` · <b>${esc(last.task.due)}</b>` : ''}</span></div>` : ''}
            <button type="button" class="qa-btn" style="width:100%" data-qa-open="${esc(last.id)}">Toʻliq tahlil ${ic('chev', 16)}</button></div>`;
        } else if (pend) {
            card = `<div class="qa-cd" style="gap:10px"><span class="qa-sec">Qoʻngʻiroq yozuvlari · AI</span><div class="qa-row qa-note" style="font-size:13px">${statusLine(pend.analysis)} <span style="color:#94A3B8">(1–3 daqiqa)</span></div></div>`;
        }
        const rows = [];
        recs.forEach(r => {
            const a = r.analysis;
            const graded = a && a.status === 'done' && a.result;
            const right = (a?.appeal?.status === 'pending' ? '<span class="qa-tg g-p" style="margin-right:4px">eʼtiroz</span>' : '') + (graded ? gtag(a.result.score) : `<span class="qa-note" style="font-size:11px">${a ? (PENDING.has(a.status) ? 'tahlil…' : a.status === 'skipped' ? 'baholanmaydi' : a.status === 'error' ? 'xato' : 'kutilmoqda') : 'baholanmaydi'}</span>`);
            rows.push({ at: a?.callAt || r.callAt || r.createdAt, html: `<button type="button" class="qa-pr" ${a ? `data-qa-open="${esc(a.id)}"` : ''}>${typeTag(shownType(a), ' style="width:100px;justify-content:center"', a && a.status === 'skipped' ? 'Qisqa' : 'Qoʻngʻiroq')}<span style="flex:1;font-size:13px;white-space:nowrap">${esc(when(a?.callAt || r.callAt || r.createdAt))}</span>${right}</button>` });
        });
        (missing || []).forEach(m => rows.push({ at: m.callAt, html: `<div class="qa-pr" style="cursor:default"><span class="qa-tg g-n" style="width:100px;justify-content:center">Yozuvsiz</span><span style="flex:1;font-size:13px;white-space:nowrap">${esc(when(m.callAt))}</span><span class="qa-note" style="font-size:11px">baholanmaydi</span>${readOnly ? '' : `<button type="button" class="qa-btn" style="min-height:44px;width:44px;padding:0;margin-left:6px" data-qa-attach="${esc(m.id)}" aria-label="Arxivga biriktirish">${ic('clip', 16)}</button>`}</div>` }));
        rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
        const hist = rows.length ? `<div class="qa-cd" style="gap:2px;padding:4px 14px"><span class="qa-sec" style="padding:8px 0 2px">Tarix</span>${rows.map(x => x.html).join('')}</div>` : '';
        if (part === 'card') return card ? `<div class="qa" style="display:flex;flex-direction:column;gap:11px">${card}</div>` : '';
        if (part === 'hist') return `<div class="qa" style="display:flex;flex-direction:column;gap:11px">${hist || '<p class="qa-note" style="margin:4px 0">Bu lid boʻyicha yozuv yoʻq. Jamoa ilovasidan qoʻngʻiroq qilsangiz, telefon yozuvi shu yerga oʻzi tushadi.</p>'}<input type="file" accept="audio/*" data-qa-file hidden></div>`;
        return `<div class="qa" style="display:flex;flex-direction:column;gap:11px">${card}${hist}<input type="file" accept="audio/*" data-qa-file hidden></div>`;
    }

    // ── Telefon: bitta qo'ng'iroq — QAT_T_tahlil (Baho) / QAT_T_matn (Matn) ──
    function phoneCall(d, tab) {
        css();
        const r = d.result || {};
        const me = isMgr();
        const hdr = `<div class="qa-row"><button type="button" class="qa-ib" data-qa-back aria-label="Orqaga">${ic('back', 20)}</button><div style="flex:1;min-width:0"><b style="font-size:17px">Qoʻngʻiroq tahlili</b><div class="qa-note">${esc(d.leadName || '')} · ${esc(when(d.callAt))}${d.durationSec ? ' · ' + esc(dur(d.durationSec)) : ''}</div></div></div>`;
        const seg = `<div class="qa-seg"><button type="button" class="${tab !== 'matn' ? 'on' : ''}" data-qa-ptab="baho">Baho</button><button type="button" class="${tab === 'matn' ? 'on' : ''}" data-qa-ptab="matn">Matn</button></div>`;
        if (d.status !== 'done' || !d.result) {
            return `<div class="qa" style="display:flex;flex-direction:column;gap:11px">${hdr}<div class="qa-cd"><div class="qa-row qa-note" style="font-size:13px">${statusLine(d)}</div></div>${d.audioUrl ? player(d.id, d.audioUrl, d.durationSec, { speed: false, bars: 22 }) : ''}${(d.transcript || []).length ? transcriptHtml(d.id, d.transcript, [], me ? 'Siz' : 'Menejer') : ''}</div>`;
        }
        if (tab === 'matn') {
            return `<div class="qa" style="display:flex;flex-direction:column;gap:11px">${hdr}${seg}${player(d.id, d.audioUrl, d.durationSec, { speed: false, bars: 22 })}
            <div class="qa-row qa-note" style="gap:12px"><span class="qa-row" style="gap:6px"><i style="width:12px;height:12px;border-radius:3px;border:2px solid #12B76A;display:block"></i>Yaxshi</span><span class="qa-row" style="gap:6px"><i style="width:12px;height:12px;border-radius:3px;border:2px solid #F04438;display:block"></i>Xato</span><span>Bossangiz — oʻsha joydan</span></div>
            ${transcriptHtml(d.id, d.transcript || [], r.marks, me ? 'Siz' : 'Menejer')}
            <span class="qa-note" style="text-align:center">Matnni AI yozgan — shubhali joyni tinglab tekshiring.</span></div>`;
        }
        const steps = (r.steps || []).length ? r.steps.map(s => st(s.status === 'ok' ? 'ok' : s.status === 'bad' ? 'no' : 'hf', s.title, [s.t, s.note].filter(Boolean).join(' · '))).join('')
            : (r.criteria || []).map(c => st(c.got >= c.max * .8 ? 'ok' : c.got >= c.max * .55 ? 'hf' : 'no', c.name, c.note || `${c.got}/${c.max}`)).join('');
        const canAppeal = me && d.mine && !d.appeal && hoursLeft(d.appealDeadline) > 0;
        const ap = d.appeal;
        return `<div class="qa" style="display:flex;flex-direction:column;gap:11px">${hdr}${seg}
            <div class="qa-cd" style="gap:10px"><div class="qa-row" style="gap:12px">${scoreBox(r.score, 62, 24)}<div style="flex:1;display:flex;flex-direction:column;gap:4px">${typeTag(r.type, ' style="align-self:flex-start"')}<span class="qa-note">${me ? 'Siz' : 'Menejer'} ${r.talkShareManager ?? '—'}% gapir${me ? 'dingiz' : 'di'} · ism ${r.nameUses ?? '—'} marta${r.approximate ? ' · taxminiy' : ''}</span></div></div>${critbars(r)}</div>
            ${steps ? `<div class="qa-cd" style="gap:0;padding:4px 14px"><span class="qa-sec" style="padding:8px 0 2px">Bosqichlar</span>${steps}</div>` : ''}
            ${d.task ? `<div class="qa-cd" style="gap:6px;padding:12px"><span class="qa-sec">ROP topshirigʻi</span><span style="font-size:13px">${esc(d.task.text)}</span>${d.task.due ? `<span class="qa-note">Muddat: ${esc(d.task.due)}</span>` : ''}</div>` : ''}
            ${ap ? `<div class="qa-cd" style="gap:6px;padding:12px;border-color:#D9CFFB;background:#FAF8FF"><span class="qa-sec">Bahoga eʼtirozingiz</span><span style="font-size:13px"><b>${esc(ap.criterion)}:</b> “${esc(ap.text)}”</span><span class="qa-tg ${ap.status === 'pending' ? 'g-p' : ap.status === 'accepted' ? 'g-a' : 'g-z'}" style="align-self:flex-start;white-space:normal">${ap.status === 'pending' ? `Yuborildi ${esc(hm(ap.at))} · ROP 24 soat ichida hal qiladi` : ap.status === 'accepted' ? acceptedTxt(d) : 'Rad etildi'}</span>${ap.note ? `<span class="qa-note">ROP: ${esc(ap.note)}</span>` : ''}</div>` : ''}
            ${canAppeal ? `<div class="qa-row"><button type="button" class="qa-btn" style="flex:1;min-height:44px;color:#5B30B5;border-color:#D9CFFB" data-qa-appeal>Eʼtiroz · ${hoursLeft(d.appealDeadline)} soat</button></div>` : ''}</div>`;
    }

    // ── Telefon: e'tiroz — QAT_T_etiroz ──
    function appealForm(d) {
        css();
        const r = d.result || {};
        const crits = (r.criteria || []).map(c => c.name);
        return `<div class="qa" style="display:flex;flex-direction:column;gap:11px">
            <div class="qa-row"><button type="button" class="qa-ib" data-qa-back aria-label="Orqaga">${ic('back', 20)}</button><div style="flex:1;min-width:0"><b style="font-size:17px">Eʼtiroz bildirish</b><div class="qa-note">${esc(d.leadName || '')} · ${esc(when(d.callAt))} · ball ${r.score ?? ''}</div></div></div>
            <div class="qa-cd" style="gap:10px"><span class="qa-sec">Qaysi baho notoʻgʻri?</span>${crits.map(c => `<button type="button" class="qa-chip" style="justify-content:flex-start" data-qa-crit="${esc(c)}">${esc(c)}</button>`).join('')}</div>
            <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#4B5563">Sabab<textarea class="qa-in" style="min-height:110px" data-qa-why placeholder="Masalan: mijoz oʻzi “ertaga oʻzim qoʻngʻiroq qilaman” dedi, vaqt aytmadi."></textarea></label>
            <div class="qa-say"><b>i</b><span>48 soatdan <b style="color:#0B1220">${hoursLeft(d.appealDeadline)} soat</b> qoldi. ROP 24 soat ichida qaror qiladi; qabul qilinsa, AI shu bosqichni qayta baholaydi.</span></div>
            <button type="button" class="qa-btn qa-pri" style="width:100%" data-qa-sendappeal>${ic('send', 16)} Yuborish</button></div>`;
    }

    const api = (path, opts) => apiFetch('/api/call-ai' + path, opts);
    const loadCall = id => apiFetch('/api/call-ai/' + encodeURIComponent(id) + '/transcript', { fresh: true });
    async function loadMissing(leadId) { try { const x = await apiFetch('/api/call-ai/missing?leadId=' + encodeURIComponent(leadId), { fresh: true }); return Array.isArray(x) ? x : []; } catch (e) { return []; } }

    // Umumiy tugmalar. ctx: { refresh, openCall(id), back(), openLead(id), openAppeal(), tab(name), call, upload(file), del(recId), afterAppeal() }
    function bind(root, ctx = {}) {
        if (!root) return;
        bindPlayers(root);
        const q = s => root.querySelectorAll(s);
        q('[data-qa-mini]').forEach(b => {
            b.onclick = e => {
                e.stopPropagation();
                const id = 'mini-' + b.dataset.qaMini; let a = audios.get(id);
                if (!a) { a = new Audio(b.dataset.src); audios.set(id, a); }
                a.onpause = a.onplay = a.onended = () => { b.innerHTML = ic(a.paused ? 'play' : 'pause', 13); };
                if (a.paused) { stopAll(id); a.play().catch(() => {}); } else a.pause();
            };
        });
        q('[data-qa-open]').forEach(el => {
            const go = e => { if (e.target.closest('[data-qa-mini],[data-qa-del],[data-qa-attach]')) return; stopAll(); ctx.openCall && ctx.openCall(el.dataset.qaOpen); };
            el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter') go(e); };
        });
        q('[data-qa-back]').forEach(b => { b.onclick = () => { stopAll(); ctx.back && ctx.back(); }; });
        q('[data-qa-lead]').forEach(b => { b.onclick = () => { stopAll(); ctx.openLead && ctx.openLead(b.dataset.qaLead); }; });
        q('[data-qa-ltab]').forEach(b => { b.onclick = () => { q('[data-qa-ltab]').forEach(x => x.classList.toggle('on', x === b)); q('[data-qa-lpane]').forEach(p => { p.hidden = p.dataset.qaLpane !== b.dataset.qaLtab; }); }; });
        q('[data-qa-jump]').forEach(b => {
            b.onclick = () => { const row = root.querySelector(`[data-t="${tsec(b.dataset.qaJump)}"]`); if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
        });
        q('[data-qa-ptab]').forEach(b => { b.onclick = () => { stopAll(); ctx.tab && ctx.tab(b.dataset.qaPtab); }; });
        q('[data-qa-appeal]').forEach(b => { b.onclick = () => ctx.openAppeal && ctx.openAppeal(); });
        q('[data-qa-crit]').forEach(b => { b.onclick = () => q('[data-qa-crit]').forEach(x => x.classList.toggle('on', x === b)); });
        q('[data-qa-sendappeal]').forEach(b => {
            b.onclick = async () => {
                const crit = root.querySelector('[data-qa-crit].on')?.dataset.qaCrit || '';
                const why = root.querySelector('[data-qa-why]')?.value || '';
                if (!crit || why.trim().length < 5) { alert('Qaysi baho notoʻgʻri ekanini tanlang va sababni yozing'); return; }
                b.disabled = true;
                try { await api('/' + encodeURIComponent(ctx.call.id) + '/appeal', { method: 'POST', body: JSON.stringify({ criterion: crit, text: why }) }); ctx.afterAppeal && ctx.afterAppeal(); } catch (e) { b.disabled = false; alert(e.message || 'Xatolik'); }
            };
        });
        q('[data-qa-decide]').forEach(b => {
            b.onclick = async () => {
                const accept = b.dataset.qaDecide === '1';
                const note = accept ? '' : (root.querySelector('[data-qa-rejnote]')?.value || '').trim();
                q('[data-qa-decide]').forEach(x => { x.disabled = true; });
                try { await api('/' + encodeURIComponent(ctx.call.id) + '/appeal/decide', { method: 'POST', body: JSON.stringify({ accept, note }) }); ctx.refresh && ctx.refresh(); } catch (e) { q('[data-qa-decide]').forEach(x => { x.disabled = false; }); alert(e.message || 'Xatolik'); }
            };
        });
        q('[data-qa-rejopen]').forEach(b => { b.onclick = () => { root.querySelector('[data-qa-decbtns]').hidden = true; root.querySelector('[data-qa-rejform]').hidden = false; root.querySelector('[data-qa-rejnote]')?.focus(); }; });
        q('[data-qa-rejcancel]').forEach(b => { b.onclick = () => { root.querySelector('[data-qa-decbtns]').hidden = false; root.querySelector('[data-qa-rejform]').hidden = true; }; });
        q('[data-qa-taskedit]').forEach(b => { b.onclick = () => { const v = root.querySelector('[data-qa-taskview]'), f = root.querySelector('[data-qa-taskform]'); if (v) v.hidden = true; if (f) f.hidden = false; }; });
        q('[data-qa-tasksave]').forEach(b => {
            b.onclick = async () => {
                b.disabled = true;
                try { await api('/' + encodeURIComponent(ctx.call.id) + '/task', { method: 'POST', body: JSON.stringify({ text: root.querySelector('[data-qa-tasktext]')?.value || '', due: root.querySelector('[data-qa-taskdue]')?.value || '' }) }); ctx.refresh && ctx.refresh(); } catch (e) { b.disabled = false; alert(e.message || 'Xatolik'); }
            };
        });
        q('[data-qa-type]').forEach(sel => {
            sel.onchange = async () => { sel.disabled = true; try { await api('/' + encodeURIComponent(sel.dataset.qaType) + '/type', { method: 'POST', body: JSON.stringify({ type: sel.value }) }); ctx.refresh && ctx.refresh(); } catch (e) { sel.disabled = false; alert(e.message || 'Xatolik'); } };
        });
        q('[data-qa-retry]').forEach(b => {
            b.onclick = async () => { if (!confirm('Qoʻngʻiroq qaytadan matnga aylantirilib baholanadi. Davom etilsinmi?')) return; b.disabled = true; try { await api('/' + encodeURIComponent(b.dataset.qaRetry) + '/retry', { method: 'POST' }); ctx.refresh && ctx.refresh(); } catch (e) { b.disabled = false; alert(e.message || 'Xatolik'); } };
        });
        // Fayl yuklash: "+ Yozuv yuklash" va "Arxivga biriktirish" (yozuv topilmagan qo'ng'iroq uchun)
        const file = root.querySelector('[data-qa-file]');
        let attachFor = '';
        q('[data-qa-upload]').forEach(b => { b.onclick = () => { attachFor = ''; file && file.click(); }; });
        q('[data-qa-attach]').forEach(b => { b.onclick = e => { e.stopPropagation(); attachFor = b.dataset.qaAttach; file && file.click(); }; });
        if (file) file.onchange = async () => {
            const f = file.files[0]; if (!f || !ctx.upload) return;
            q('[data-qa-upload],[data-qa-attach]').forEach(x => { x.disabled = true; });
            try { await ctx.upload(f, { missingId: attachFor }); ctx.refresh && ctx.refresh(); } catch (e) { q('[data-qa-upload],[data-qa-attach]').forEach(x => { x.disabled = false; }); alert('Yuklashda xatolik: ' + (e.message || e)); } finally { file.value = ''; }
        };
        q('[data-qa-del]').forEach(b => { b.onclick = e => { e.stopPropagation(); ctx.del && ctx.del(b.dataset.qaDel); }; });
    }

    const pending = list => (list || []).some(r => r && r.analysis && PENDING.has(r.analysis.status));
    const playing = () => [...audios.values()].some(a => !a.paused);
    const busy = d => d && PENDING.has(d.status);

    window.callAiUI = { leadSection, phoneCard, callView, phoneCall, appealForm, bind, pending, playing, busy, stopAll, loadCall, loadMissing, css, _t: { when, dur, mln, grade, outcomeText } };
})();
