// ROP kompyuter kabineti — Lidlar (dizayn RK02 "RopKLeadsC", 9.5) va ichki oynalar (RK02.*).
// FAQAT ropDesk.isRop() (role = rop, ekran > 900px). Sotuv menejeri / admin kanbani o'zgarmaydi.
// Qoida: hech bir funksiya yo'qolmaydi. Karta prod renderLeadCard natijasidan quriladi — undagi barcha tugmalar
// (data-lead-open, -comments, -recording, -notify, -manager-photo, menyu: menejer / bosqich / SMS / Telegram,
// belgilash checkbox'i) o'sha elementlar, faqat dizayn tartibida joylashtiriladi; renderLeads ulagan
// ishlov beruvchilar va drag&drop o'zgarmaydi. Ustunlar, filtrlar, ommaviy amallar — mavjud kod.
// Oynalar (lid kartasi, izohlar, Zapis, bildirishnomalar) — mavjud openModal oynalari; ROPda o'ng tomondagi
// drawer ko'rinishi va tablari bilan (logika o'sha funksiyalarda).
(function () {
    'use strict';
    const RD = window.ropDesk = window.ropDesk || {};
    const on = () => !!RD.isRop?.();
    const g = n => (typeof window[n] === 'function' ? window[n] : null);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ixtiyoriy */ } } };
    const MIN = 60000, HOUR = 3600000, DAY = 86400000;
    const st = l => (g('normalizeLeadStatus') ? normalizeLeadStatus(l?.status) : l?.status);
    const parseT = v => { const t = Date.parse(v || ''); return Number.isFinite(t) ? t : null; };
    const SVG = (d, w = 13, sw = 2.2) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
    const P = {
        phone: 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z',
        bell: 'M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0', com: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
        mic: 'M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zM5 10a7 7 0 0014 0M12 17v5', lock: 'M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z', clock: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2',
        chevL: 'M15 6l-6 6 6 6', box: 'M3 7h18v13H3zM3 7l3-4h12l3 4M9 12h6'
    };
    const COLOR = { 'yangi-lidlar': '#2563EB', 'boglanishga-urinilmoqda': '#7C3AED', boglanildi: '#0891B2', 'sinov-darsida': '#16A34A', 'qaror-jarayonida': '#EA580C', 'keyin-sotib-olmoqchi': '#4F46E5', 'tolov-jarayonida': '#D97706', 'tolov-yopildi': '#059669', 'muvaffaqiyatsiz-sotuv': '#DC2626', 'sifatsiz-lidlar': '#64748B' };
    const OPEN = new Set(['yangi-lidlar', 'boglanishga-urinilmoqda', 'boglanildi', 'sinov-darsida', 'qaror-jarayonida', 'keyin-sotib-olmoqchi', 'tolov-jarayonida']);
    const CLOSED = new Set(['tolov-yopildi', 'muvaffaqiyatsiz-sotuv', 'sifatsiz-lidlar']);
    const AV = ['#0E7490', '#C2410C', '#5B21B6', '#166534', '#1D4ED8', '#9D174D', '#93370D', '#3730A3'];
    const avColor = id => { let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
    const shortName = n => { const p = String(n || '').trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') : ''; };
    const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();

    // ---------- yosh (option B: prod shkalasi hamma ochiq ustunda) ----------
    // _leadAgeChip bilan bir xil: <1 kun yashil, 1–3 kun sariq, 3+ qizil; matn: daq / soat / kun.
    const AGE_OPEN = new Set(['yangi-lidlar', 'boglanishga-urinilmoqda', 'boglanildi', 'sinov-darsida', 'qaror-jarayonida', 'tolov-jarayonida']);
    function ageOf(l) {
        if (!AGE_OPEN.has(st(l))) return null;
        const t = parseT(l.statusChangedAt || l.updatedAt || l.createdAt);
        if (!t) return null;
        const h = Math.max(0, (Date.now() - t) / HOUR);
        const label = h < 1 ? `${Math.max(1, Math.round(h * 60))} daq` : h < 24 ? `${Math.round(h)} soat` : `${Math.floor(h / 24)} kun`;
        return { label, lvl: h < 24 ? 'ok' : h < 72 ? 'warn' : 'late', h };
    }
    const waitMin = l => { const t = parseT(l.createdAt); return t ? (Date.now() - t) / MIN : 0; };
    const dur = ms => { const m = Math.max(1, Math.round(ms / MIN)); if (m < 60) return `${m} daq`; const h = Math.floor(m / 60); if (h < 48) return `${h} soat${m % 60 ? ' ' + (m % 60) + ' daq' : ''}`; return `${Math.floor(h / 24)} kun`; };

    // ---------- qotgan lid (staleLeads qoidasi bilan bir xil) ----------
    const AFTER = new Set(['boglanildi', 'malumot-berildi', 'sinov-darsida', 'qaror-jarayonida', 'keyin-sotib-olmoqchi', 'tolov-jarayonida', 'tolov-yopildi']);
    let rulesAsked = false;
    function staleOf(l, lang) {
        if (!l.managerId || st(l) !== 'boglanishga-urinilmoqda') return null;
        if ((Array.isArray(l.stageHistory) && l.stageHistory.some(h => h && AFTER.has(h.to))) || (l.connectedSurvey && Object.keys(l.connectedSurvey).length)) return null;
        const all = window.staleLeads?.rules?.();
        if (!all && !rulesAsked && window.staleLeads?.loadRules) { rulesAsked = true; window.staleLeads.loadRules(false).then(() => { if (on()) window.renderLeads?.(); }).catch(() => {}); }
        const r = (all && all[lang === 'english' ? 'english' : 'russian']) || { warnDays: 3, lockDays: 5 };
        const t = parseT(l.managerAssignedAt) || parseT(l.createdAt); if (!t) return null;
        const d = Math.floor((Date.now() - t) / DAY);
        if (d >= r.lockDays) return { k: 'lock', t: 'qulf', tip: `Qotgan lid: ${d}-kun — qulflangan` };
        if (d >= r.warnDays && d === r.lockDays - 1) return { k: 'lock', t: 'ertaga', tip: `Qotgan lid: ${d}-kun — ertaga qulflanadi` };
        if (d >= r.warnDays) return { k: 'warn', t: 'ogoh.', tip: `${d}-kun: menejer ogohlantirildi` };
        return null;
    }

    // Kelgan vaqt (dizayn): bugun — 00:30, kecha — "Kecha 18:20", oldin — "27-okt". To'liq sana title'da.
    const MONS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    function shortTime(l) {
        const t = parseT(l.createdAt); if (!t) return g('formatLeadTime') ? formatLeadTime(l) : '';
        const d = new Date(t), n = new Date();
        const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const diff = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / DAY);
        return diff === 0 ? hm : diff === 1 ? `Kecha ${hm}` : `${d.getDate()}-${MONS[d.getMonth()]}`;
    }

    // ---------- karta ----------
    const pick = (root, sel) => { const el = root.querySelector(sel); if (el) el.remove(); return el; };
    function card(origHtml, lead, langKey) {
        const tpl = document.createElement('template');
        tpl.innerHTML = origHtml.trim();
        const art = tpl.content.firstElementChild;
        if (!art) return origHtml;
        const l = g('normalizeLeadExtras') ? normalizeLeadExtras(lead) : lead;
        const s = st(l);
        const age = ageOf(l);
        const stale = staleOf(l, langKey);
        const fu = g('getLeadNextFollowUp') ? getLeadNextFollowUp(l) : null;
        const mgr = (g('getItem') ? getItem(STORAGE_KEYS.salesManagers, []) : []).find(m => m.id === l.managerId);
        const kind = g('getLeadKind') ? getLeadKind(l) : (l.kind || 'organic');
        const isTarget = kind === 'target';
        const phones = [l.phone, l.phone2].filter(Boolean).map(p => (g('formatPhoneDisplay') ? formatPhoneDisplay(p) : p) || String(p));
        if (phones[1] && String(l.phone2).replace(/\D/g, '').slice(-9) === String(l.phone).replace(/\D/g, '').slice(-9)) phones.pop();
        const comN = Array.isArray(l.comments) ? l.comments.length : 0;
        const stripe = age ? { ok: '#12B76A', warn: '#F79009', late: '#F04438' }[age.lvl] : '#CBD5E1';
        // Prod qismlari (mantig'i o'zgarmasin): checkbox, menyu, bildirishnoma (o'qilmaganlar), sabab, sinov holati, qatnashdi, kechiktirilgan sanalar.
        const cb = pick(art, '.lead-bulk-checkbox');
        const menu = pick(art, '.lead-card-menu-wrap');
        const notify = pick(art, '[data-lead-notify]');
        const reason = pick(art, '.lead-contact-reason-badge, .lead-card-contact-reason, [class*="contact-reason"]');
        const trial = pick(art, '.lead-card-trial-status');
        const attended = pick(art, '.lead-trial-attended');
        const deferred = pick(art, '.lead-deferred-dates, .lead-card-deferred, [class*="deferred"]');
        const mgrBtn = pick(art, '[data-lead-manager-photo]');
        const comBtn = pick(art, '[data-lead-comments]');
        const recBtn = pick(art, '[data-lead-recording]');
        const nameBtn = pick(art, '[data-lead-open]');
        const unread = notify?.classList.contains('has-unread') ? (Number(notify.querySelector('.lead-card-notify-badge')?.textContent.replace('+', '')) || 1) : 0;
        const unreadTxt = notify?.querySelector('.lead-card-notify-badge')?.textContent || '';

        art.className = `lead-card rk-card${cb?.checked ? ' is-sel' : ''}`;
        art.setAttribute('tabindex', '0');
        art.dataset.rkStatus = s;
        if (!l.managerId) art.dataset.rkUn = '1';
        const risks = [];
        if (s === 'yangi-lidlar' && !l.managerId && waitMin(l) >= 30) risks.push('late30');
        if (stale) risks.push(stale.k);
        if (fu?.overdue) risks.push('late');
        if (risks.length) art.dataset.rkRisk = risks.join(' ');
        art.style.setProperty('--rk-stripe', stripe);
        art.setAttribute('aria-describedby', 'rkCardHelp');
        art.setAttribute('aria-keyshortcuts', 'Enter F2 Space Shift+Space M S');
        art.setAttribute('aria-label', [l.name, (LEAD_COLUMNS.find(c => c.id === s) || {}).label, age?.label, mgr ? shortName(mgr.name) : 'menejersiz', stale?.k === 'lock' ? 'qulflangan' : stale ? 'ogohlantirilgan' : '', fu?.overdue ? 'qoʻngʻiroq muddati oʻtdi' : '', unread ? unread + ' ta bildirishnoma' : ''].filter(Boolean).join(', '));

        if (nameBtn) { nameBtn.className = 'rk-nm lead-card-name-btn'; nameBtn.setAttribute('aria-haspopup', 'dialog'); nameBtn.title = 'Lid kartasini ochish: ' + (l.name || ''); }
        const r1 = `<div class="rk-r1">${cb ? '<label class="rk-cbx" title="Belgilash (Space)"></label>' : ''}<span class="rk-nm-slot"></span>${attended ? '<span class="rk-att" role="img" aria-label="Sinov darsida qatnashdi" title="Sinov darsida qatnashdi">✓</span>' : ''}<span class="rk-menu-slot"></span></div>`;
        const meta = `<div class="rk-meta">${age ? `<span class="rk-chip rk-lvl-${age.lvl}" title="Shu bosqichda kutmoqda (<1 kun yashil, 1–3 kun sariq, 3+ qizil)">${esc(age.label)}</span>` : ''}${stale ? `<span class="rk-chip rk-stale-${stale.k}" title="${esc(stale.tip)}">${SVG(P.lock, 11, 2.6)}${esc(stale.t)}</span>` : ''}<span class="rk-src" title="Manba"><i style="background:${isTarget ? '#2563EB' : '#12B76A'}"></i>${isTarget ? 'Target' : 'Organik'}</span>${l.serialCode ? `<span class="rk-ser" title="Oʻquvchi ID">#${esc(l.serialCode)}</span>` : ''}${l.managerId && !mgr ? '<span class="rk-chip rk-mute">Menejeri ketgan</span>' : ''}</div>`;
        const tel = p => 'tel:' + String(p).replace(/[^\d+]/g, '');
        const r3 = `<div class="rk-r3">${phones[0] ? `<a class="rk-ph" href="${esc(tel(phones[0]))}" title="Qoʻngʻiroq qilish">${SVG(P.phone, 13, 2)}${esc(phones[0])}</a><button type="button" class="rk-cp" data-rk-copy="${esc(phones.join(', '))}" aria-label="${esc((l.name || '') + ' raqamidan nusxa olish')}" title="Raqamdan nusxa olish">⧉</button>` : '<span class="rk-ph rk-mut">Raqam yoʻq</span>'}${phones[1] ? `<button type="button" class="rk-p2" data-rk-ph2 aria-expanded="false" title="${esc(phones[1])}" aria-label="${esc('Ikkinchi raqam: ' + phones[1])}">+1</button>` : ''}<span class="rk-tm" title="Lid kelgan vaqt: ${esc(g('formatLeadTime') ? formatLeadTime(l) : '')}">${esc(shortTime(l))}</span></div>${phones[1] ? `<div class="rk-r3 rk-ph2" hidden><a class="rk-ph" href="${esc(tel(phones[1]))}" title="Qoʻngʻiroq qilish">${SVG(P.phone, 13, 2)}${esc(phones[1])}</a></div>` : ''}`;
        const next = fu && !CLOSED.has(s) ? `<span class="rk-chip ${fu.overdue ? 'rk-next-late' : 'rk-next'}" title="${fu.overdue ? 'Qoʻngʻiroq vaqti oʻtdi' : 'Keyingi qoʻngʻiroq'}">${SVG(P.clock, 11, 2.6)}${fu.overdue ? 'Qoʻngʻiroq vaqti oʻtdi' : 'Qoʻngʻiroq'} · ${esc(g('formatLeadFollowUpWhen') ? formatLeadFollowUpWhen(fu.at) : '')}</span>` : '';
        const r4 = (reason || trial || next) ? `<div class="rk-r4"><span class="rk-reason-slot"></span><span class="rk-trial-slot"></span>${next}</div>` : '';
        const ft = `<div class="rk-ft"><span class="rk-mgr-slot"></span><span class="rk-sp"></span><span class="rk-bell-slot"></span><span class="rk-com-slot"></span><span class="rk-rec-slot"></span></div>`;
        art.innerHTML = r1 + meta + r3 + r4 + '<span class="rk-def-slot"></span>' + ft;
        const put = (sel, el) => { const slot = art.querySelector(sel); if (!slot) return; if (el) slot.replaceWith(el); else slot.remove(); };
        if (cb) { cb.setAttribute('aria-label', (l.name || '') + ' — belgilash'); art.querySelector('.rk-cbx').appendChild(cb); }
        put('.rk-nm-slot', nameBtn);
        if (menu) {
            const t = menu.querySelector('[data-lead-menu-toggle]');
            if (t) { t.classList.add('rk-ic'); t.title = 'Boshqa amallar (S)'; t.setAttribute('aria-haspopup', 'menu'); }
            const mm = menu.querySelector('[data-lead-menu-manager]'); if (mm && !mm.querySelector('.rk-kb')) mm.insertAdjacentHTML('beforeend', '<span class="rk-kb">M</span>');
            const tg = menu.querySelector('[data-lead-telegram]'); if (tg && !tg.querySelector('.rk-kb')) tg.insertAdjacentHTML('beforeend', '<span class="rk-kb" aria-hidden="true" title="Telegram ilovasi ochiladi">↗</span>');
            // Bosqichlar: joriy bosqich "hozir", keyingi oyna turi (prod oqimi).
            menu.querySelectorAll('[data-lead-menu-move]').forEach(b => {
                const to = b.dataset.moveTo; const cur = to === s;
                if (cur) { b.setAttribute('aria-disabled', 'true'); b.disabled = true; }
                const note = cur ? 'hozir' : to === 'boglanildi' ? 'anketa' : to === 'sinov-darsida' ? 'jadval' : (to === 'tolov-jarayonida' || to === 'tolov-yopildi') ? 'oʻquvchiga aylantirish' : to === 'keyin-sotib-olmoqchi' ? 'sanalar' : (to === 'muvaffaqiyatsiz-sotuv' || to === 'sifatsiz-lidlar' || (s === 'yangi-lidlar' && to === 'boglanishga-urinilmoqda')) ? 'sabab' : to === 'qaror-jarayonida' ? 'anketa' : '';
                if (note && !b.querySelector('.rk-kb')) b.insertAdjacentHTML('beforeend', `<span class="rk-kb">${note}</span>`);
            });
        }
        put('.rk-menu-slot', menu);
        put('.rk-reason-slot', reason ? Object.assign(reason, { className: 'rk-chip rk-mute rk-reason', title: 'Bogʻlanish sababi' }) : null);
        if (trial) { const tone = trial.dataset.tone || 'mute'; trial.className = `rk-chip rk-tone-${tone}`; }
        put('.rk-trial-slot', trial);
        put('.rk-def-slot', deferred ? (deferred.classList.add('rk-dfr'), deferred) : null);
        if (mgrBtn) {
            mgrBtn.className = `rk-fb rk-mg${mgr ? '' : ' is-empty'}`;
            mgrBtn.setAttribute('aria-haspopup', 'dialog');
            const lab = mgr ? `Menejer: ${mgr.name} — oʻzgartirish (M)` : 'Menejer biriktirish (M)';
            mgrBtn.title = lab; mgrBtn.setAttribute('aria-label', lab);
            mgrBtn.innerHTML = `<span class="rk-av" aria-hidden="true"${mgr ? ` style="background:${avColor(mgr.id)}"` : ''}>${mgr ? (mgr.avatar ? `<img src="${esc(mgr.avatar)}" alt="">` : esc(initials(mgr.name))) : '+'}</span><b>${esc(mgr ? shortName(mgr.name) : 'Biriktirish')}</b>`;
        }
        put('.rk-mgr-slot', mgrBtn);
        if (notify) {
            notify.className = `rk-fb${unread ? ' rk-bell-on' : ' z'}`;
            const lab = unread ? `${unreadTxt} ta oʻqilmagan bildirishnoma` : 'Bildirishnomalar tarixi';
            notify.title = lab; notify.setAttribute('aria-label', lab); notify.setAttribute('aria-haspopup', 'dialog');
            notify.innerHTML = SVG(P.bell) + (unread ? esc(unreadTxt) : '');
        }
        put('.rk-bell-slot', notify);
        if (comBtn) {
            comBtn.className = `rk-fb${comN ? '' : ' z'}`;
            comBtn.title = 'Izohlar'; comBtn.setAttribute('aria-label', `Izohlar: ${comN} ta`); comBtn.setAttribute('aria-haspopup', 'dialog');
            comBtn.innerHTML = SVG(P.com) + (comN ? `<span>${comN}</span>` : '');
        }
        put('.rk-com-slot', comBtn);
        if (recBtn) {
            recBtn.className = 'rk-fb rk-rec z';
            recBtn.title = 'Zapis — suhbatlar yozib olinadi'; recBtn.setAttribute('aria-label', 'Zapis'); recBtn.setAttribute('aria-haspopup', 'dialog');
            recBtn.innerHTML = SVG(P.mic);
        }
        put('.rk-rec-slot', recBtn);
        return art.outerHTML;
    }

    // Zapis soni (refreshLeadRecordingCounts .lead-recording-count qo'shadi) — 0 bo'lsa xira, bor bo'lsa yashil.
    function paintRec(root = document) {
        root.querySelectorAll('#leadsKanban .rk-rec').forEach(b => {
            const n = Number(b.querySelector('.lead-recording-count')?.textContent) || 0;
            b.classList.toggle('z', !n); b.classList.toggle('rk-rec-on', !!n);
            b.setAttribute('aria-label', `Zapis: ${n} ta yozuv`);
        });
    }

    // ---------- ustunlar ----------
    const shutSet = () => { try { return new Set(JSON.parse(ls.get('rk_cols_shut') || '[]')); } catch (e) { return new Set(); } };
    const saveShut = s => ls.set('rk_cols_shut', JSON.stringify([...s]));
    const R = { risk: '' }; // "ustun:tur" — ustun ichidagi xavf filtri (sessiya)
    const RISK = {
        'yangi-lidlar': [['late30', n => `30+ daq · ${n}`, 'Menejersiz 30 daqiqadan oshgan yangi lidlar (SLA)', 'bad']],
        'boglanishga-urinilmoqda': [['lock', n => String(n), 'Qulf yoki ertaga qulf', 'bad', true], ['warn', n => `Ogoh. ${n}`, '3-kun ogohlantirilgan', 'warn']],
        'qaror-jarayonida': [['late', n => `Kechikdi · ${n}`, 'Qoʻngʻiroq muddati oʻtgan', 'bad']]
    };
    function columnLeads(colId) {
        const lang = typeof _leadsLangFilter !== 'undefined' && _leadsLangFilter === 'russian' ? 'russian' : 'english';
        const all = (g('getItem') ? getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) : {})[lang] || [];
        const list = all.filter(l => !l.deletedAt && st(l) === colId);
        return g('filterLeadsByDateAndSource') && typeof _leadsSourceFilter !== 'undefined'
            ? list.filter(l => { const { from, to } = _leadsDateFilter; if (!from && !to) return true; const k = g('getLeadDateKey') ? getLeadDateKey(l) : null; return k && (!from || k >= from) && (!to || k <= to); })
            : list;
    }
    function decorateColumns(board) {
        const shut = shutSet();
        const tTag = new Date(Date.now() + 5 * HOUR).toISOString().slice(0, 10);
        board.querySelectorAll('.lead-column').forEach(col => {
            const id = col.dataset.status, color = COLOR[id] || '#64748B';
            col.classList.add('rk-col');
            col.style.setProperty('--rk-col', color);
            col.removeAttribute('style'); col.style.setProperty('--rk-col', color);
            const head = col.querySelector('.lead-column-header'); if (!head) return;
            head.removeAttribute('style');
            const title = head.querySelector('.lead-column-title'), count = head.querySelector('.lead-column-count');
            title?.removeAttribute('style'); count?.removeAttribute('style');
            const shown = Number(count?.textContent) || 0;
            const total = columnLeads(id).length;
            const filtered = shown !== total;
            if (count) { count.textContent = filtered ? `${shown} / ${total}` : String(shown); count.title = filtered ? `Filtrga mos: ${shown} ta, jami ${total} ta` : `${shown} ta lid`; }
            const cards = [...col.querySelectorAll('.lead-card')];
            // 1-qator: nuqta · nom · son · yig'ish
            const r1 = document.createElement('div'); r1.className = 'rk-ch1';
            r1.innerHTML = '<span class="rk-dot" aria-hidden="true"></span>';
            if (title) r1.appendChild(title);
            if (count) r1.appendChild(count);
            r1.insertAdjacentHTML('beforeend', `<button type="button" class="rk-ic rk-colx" data-rk-shut="${id}" aria-expanded="true" aria-label="${esc((title?.textContent || '') + ' ustunini yigʻish')}" title="Ustunni yigʻish">${SVG(P.chevL, 14, 2.6)}</button>`);
            // 2-qator: biriktirilmagan · xavf chiplari · xulosa
            const r2 = document.createElement('div'); r2.className = 'rk-ch2';
            const pk = head.querySelector('.lead-col-pick'); if (pk) { pk.textContent = pk.textContent.replace(/\s+/g, ' ').trim(); r2.appendChild(pk); }
            const pre = cards;
            (RISK[id] || []).forEach(([k, txt, tip, tone, lock]) => {
                const n = pre.filter(c => (c.dataset.rkRisk || '').split(' ').includes(k)).length;
                const act = R.risk === `${id}:${k}`;
                if (!n && !act) return;
                r2.insertAdjacentHTML('beforeend', `<button type="button" class="rk-rk rk-rk-${tone}" data-rk-risk="${id}:${k}" aria-pressed="${act}" title="${esc(tip + ': ' + n + ' ta — bosib filtrlash')}" aria-label="${esc(tip + ': ' + n + ' ta — bosib filtrlash')}">${lock ? SVG(P.lock, 11, 2.6) : ''}${esc(txt(n))}</button>`);
            });
            let sum = '';
            if (id === 'yangi-lidlar') { const old = cards.map(c => getLeadById(c.dataset.leadLang, c.dataset.leadId)).filter(Boolean).reduce((m, l) => Math.min(m, parseT(l.createdAt) || Date.now()), Date.now()); if (cards.length) sum = 'eskisi ' + dur(Date.now() - old); }
            if (id === 'sinov-darsida') { const n = cards.map(c => getLeadById(c.dataset.leadLang, c.dataset.leadId)).filter(l => { const t = parseT(l?.trialRequest?.scheduledAt || l?.trialLessonAt); return t && new Date(t + 5 * HOUR).toISOString().slice(0, 10) === tTag; }).length; if (n) sum = `bugun ${n} ta sinov`; }
            if (id === 'tolov-yopildi' && typeof _leadsDateFilter !== 'undefined' && _leadsDateFilter.preset === 'month') sum = 'joriy oy';
            if (sum) r2.insertAdjacentHTML('beforeend', `<span class="rk-sum" title="${esc(sum)}">${esc(sum)}</span>`);
            // Ustundagi prod filtrlari (Bog'lanish sababi, Sinov qatnashuvi) o'sha elementlar — dizayn joyida.
            const cfb = head.querySelector('#leadContactFilterButton'), cfp = head.querySelector('#leadContactFilterPanel');
            const tfa = head.querySelector('.trial-attendance-filter');
            [...head.children].forEach(ch => { if (ch !== r1 && ch !== r2 && ch !== cfb && ch !== cfp && ch !== tfa) r2.appendChild(ch); });
            head.prepend(r2); head.prepend(r1);
            if (cfb) {
                const rf = document.createElement('div'); rf.className = 'rk-rf';
                const sel = g('getLeadContactReasonFilter') ? getLeadContactReasonFilter(typeof _leadsLangFilter !== 'undefined' && _leadsLangFilter === 'russian' ? 'russian' : 'english') : [];
                const lab = !sel.length ? 'Hammasi' : sel.length === 1 ? ((LEAD_CONTACT_FAIL_REASONS.find(r => r.id === sel[0]) || {}).label || '1 ta') : `${sel.length} ta sabab`;
                cfb.innerHTML = `${SVG('M3 5h18l-7 8v5l-4 2v-7z', 13)}<span>Sabab: ${esc(lab)}</span><span class="rk-rf-n">${cards.length}</span>`;
                cfb.setAttribute('aria-haspopup', 'dialog');
                rf.appendChild(cfb); if (cfp) rf.appendChild(cfp);
                head.appendChild(rf);
            }
            if (tfa) { tfa.classList.add('rk-seg3'); head.appendChild(tfa); }
            head.classList.add('rk-ch');
            // Xavf filtri (sessiya): faqat shu turdagi kartalar.
            if (R.risk.startsWith(id + ':')) {
                const k = R.risk.split(':')[1];
                let vis = 0;
                cards.forEach(c => { const ok = (c.dataset.rkRisk || '').split(' ').includes(k); c.hidden = !ok; if (ok) vis++; });
                if (!vis) col.querySelector('.lead-column-cards')?.insertAdjacentHTML('afterbegin', `<div class="lead-column-empty rk-empty">${SVG(P.box, 22, 2)}Filtr boʻyicha lid yoʻq<button type="button" class="rk-btn2" data-rk-risk="${id}:${k}">Filtrni olib tashlash</button></div>`);
            }
            // Bo'sh ustun — dizayn ko'rinishi.
            const emp = col.querySelector('.lead-column-cards > .lead-column-empty:not(.rk-empty)');
            if (emp) { emp.classList.add('rk-empty'); emp.innerHTML = SVG(P.box, 22, 2) + esc(emp.textContent.replace("Lidlar yo'q", 'Lidlar yoʻq')); }
            // Yig'ilgan ustun: tor vertikal ustun, drop zonasi ishlayveradi.
            const isShut = shut.has(id) && !(typeof _leadSearchQuery !== 'undefined' && _leadSearchQuery);
            col.classList.toggle('rk-shut', isShut);
            if (isShut) {
                const mini = document.createElement('button');
                mini.type = 'button'; mini.className = 'rk-mini'; mini.dataset.rkShut = id; mini.setAttribute('aria-expanded', 'false');
                const lab = `${title?.textContent || ''} ustunini ochish (${total} ta lid)`;
                mini.setAttribute('aria-label', lab); mini.title = lab;
                mini.innerHTML = `<span class="rk-dot" aria-hidden="true"></span><span class="lead-column-count">${shown}</span><span class="rk-vt">${esc(title?.textContent || '')}</span>`;
                col.prepend(mini);
            }
        });
    }

    // ---------- Lidlar sahifasi tepasi ----------
    function toolbar() {
        const layout = document.querySelector('#tab-sales .sales-header-layout'); if (!layout) return;
        if (!layout.querySelector('.rk-h1')) layout.insertAdjacentHTML('afterbegin', '<h1 class="rk-h1">Lidlar</h1>');
        const nav = document.getElementById('salesSectionNav');
        if (nav) { nav.setAttribute('role', 'tablist'); nav.querySelectorAll('[data-sales-section]').forEach(b => { const sel = b.classList.contains('active'); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(sel)); if (b.dataset.salesSection === 'book-roadmap') b.title = 'Kitob yetkazish — alohida sahifa'; }); }
        const bar = document.getElementById('leadsFiltersBar'); if (!bar) return;
        const vb = !!B.saved;
        // Faol filtr belgisi (standartdan farqli) va vaqtinchalik "Biriktirilmagan" (badge) holati.
        const boxM = document.getElementById('leadsManagerFilter')?.closest('.leads-filter-box');
        const boxC = document.getElementById('leadsColumnsFilterBtn')?.closest('.leads-filter-box');
        const boxD = document.getElementById('leadsDateFilterBtn')?.closest('.leads-filter-box');
        const boxS = document.getElementById('leadsSourceFilter')?.closest('.leads-filter-box');
        const defCols = g('getDefaultVisibleColumnIds') ? getDefaultVisibleColumnIds() : [];
        const colsDef = typeof _leadsVisibleColumns !== 'undefined' && _leadsVisibleColumns.size === defCols.length && defCols.every(c => _leadsVisibleColumns.has(c));
        const mAct = typeof _leadsManagerFilter !== 'undefined' && _leadsManagerFilter !== 'all';
        const dAct = typeof _leadsDateFilter !== 'undefined' && _leadsDateFilter.preset !== 'month';
        const sAct = typeof _leadsSourceFilter !== 'undefined' && _leadsSourceFilter !== 'all';
        [[boxM, mAct], [boxC, !colsDef], [boxD, dAct], [boxS, sAct]].forEach(([b, a]) => { if (!b) return; b.classList.toggle('rk-act', !vb && a); b.classList.toggle('rk-vb', vb && b !== boxS); });
        const disp = document.getElementById('leadsManagerFilterDisplay');
        if (disp && vb) disp.textContent = `Biriktirilmagan · barcha vaqt · ochiq bosqichlar · ${RD.unassignedCount?.() ?? ''}`;
        let chip = bar.querySelector('.rk-vb-x');
        if (vb && !chip) { boxM?.insertAdjacentHTML('afterend', '<button type="button" class="rk-vb-x" aria-label="Biriktirilmagan filtrini olib tashlash" title="Filtrni olib tashlash">✕</button>'); bar.querySelector('.rk-vb-x').onclick = () => clearBadgeFilter(); }
        else if (!vb && chip) chip.remove();
        let clr = bar.querySelector('.rk-clear');
        const any = !vb && (mAct || dAct || sAct || !colsDef);
        if (any && !clr) { bar.insertAdjacentHTML('beforeend', '<button type="button" class="rk-clear" title="Filtrlar standartga qaytadi (Barcha menejerlar · Joriy oy · Manba: hammasi · standart ustunlar)">Tozalash</button>'); bar.querySelector('.rk-clear').onclick = resetFilters; }
        else if (!any && clr) clr.remove();
        // "← N" / "N →" — ekrandan tashqaridagi ustunlar; jami son.
        const add = document.getElementById('addLeadBtn');
        let tot = document.querySelector('#tab-sales .rk-total');
        if (add && !tot) { add.insertAdjacentHTML('beforebegin', '<span class="rk-hid rk-hid-l" hidden></span><span class="rk-hid rk-hid-r" hidden></span><span class="rk-total"></span>'); tot = document.querySelector('#tab-sales .rk-total'); wireHidden(); }
        if (tot) {
            const q = typeof _leadSearchQuery !== 'undefined' && _leadSearchQuery;
            const n = [...document.querySelectorAll('#leadsKanban .lead-column:not(.rk-shut) .lead-column-count, #leadsKanban .rk-mini .lead-column-count')].reduce((a, c) => a + (Number(String(c.textContent).split('/')[0]) || 0), 0);
            tot.innerHTML = `${q ? 'Topildi' : 'Jami'} <strong>${n}</strong>`;
        }
        hiddenCols();
        // Doska ekran balandligini to'ldiradi, ustunlar ichida skroll (dizayn 1440×960).
        const board = document.getElementById('leadsKanban');
        if (board) board.style.setProperty('--rk-top', Math.max(0, Math.round(board.getBoundingClientRect().top + window.scrollY)) + 'px');
    }
    function resetFilters() {
        if (typeof _leadsManagerFilter !== 'undefined') _leadsManagerFilter = 'all';
        if (typeof _leadsSourceFilter !== 'undefined') _leadsSourceFilter = 'all';
        if (typeof _leadsDateFilter !== 'undefined' && g('_leadsMonthRange')) _leadsDateFilter = { preset: 'month', ..._leadsMonthRange(0) };
        if (typeof _leadsVisibleColumns !== 'undefined' && g('getDefaultVisibleColumnIds')) { _leadsVisibleColumns = new Set(getDefaultVisibleColumnIds()); g('saveVisibleColumns') && saveVisibleColumns(); }
        const src = document.getElementById('leadsSourceFilter'); if (src) src.value = 'all';
        const sd = document.getElementById('leadsSourceFilterDisplay'); if (sd) sd.textContent = 'Manba: Hammasi';
        R.risk = '';
        g('updateLeadsDateFilterLabel') && updateLeadsDateFilterLabel();
        renderLeads();
    }
    function hiddenCols() {
        const board = document.getElementById('leadsKanban'); if (!board) return;
        const cols = [...board.querySelectorAll(':scope > .lead-column')];
        const br = board.getBoundingClientRect();
        const left = cols.filter(c => c.getBoundingClientRect().right <= br.left + 20);
        const right = cols.filter(c => c.getBoundingClientRect().left >= br.right - 20);
        const name = c => c.querySelector('.lead-column-title')?.textContent || '';
        const L = document.querySelector('#tab-sales .rk-hid-l'), Rr = document.querySelector('#tab-sales .rk-hid-r');
        if (L) { L.hidden = !left.length; L.innerHTML = left.length ? `<button type="button" aria-label="${esc(left.map(name).join(', '))} — doskani chapga surish" title="${esc(left.map(name).join(', '))}">← ${left.length}</button>` : ''; }
        if (Rr) { Rr.hidden = !right.length; Rr.innerHTML = right.length ? `<button type="button" aria-label="${esc(right.map(name).join(', '))} — doskani oʻngga surish" title="Doskani oʻngga surish (Shift + gʻildirak ham ishlaydi)">${right.length} →</button>` : ''; }
    }
    function wireHidden() {
        document.querySelector('#tab-sales .rk-hid-l')?.addEventListener('click', () => { const b = document.getElementById('leadsKanban'); b?.scrollBy({ left: -560, behavior: 'smooth' }); });
        document.querySelector('#tab-sales .rk-hid-r')?.addEventListener('click', () => { const b = document.getElementById('leadsKanban'); b?.scrollBy({ left: 560, behavior: 'smooth' }); });
    }

    // ---------- Sidebar badge → vaqtinchalik "Biriktirilmagan" filtri ----------
    // Menejer = Biriktirilmagan, Sana = Barcha vaqt, Ustunlar = ochiq bosqichlar. Global filtrga yozilmaydi:
    // ✕ bosilsa yoki Lidlardan chiqilsa oldingi holat qaytadi.
    const B = { saved: null };
    function openUnassigned() {
        if (!B.saved && typeof _leadsManagerFilter !== 'undefined') B.saved = { m: _leadsManagerFilter, d: { ..._leadsDateFilter }, c: new Set(_leadsVisibleColumns) };
        _leadsManagerFilter = 'unassigned';
        _leadsDateFilter = { preset: 'all', from: '', to: '' };
        _leadsVisibleColumns = new Set([...OPEN]);
        document.body.classList.add('rk-vb-on');
        if (document.getElementById('tab-sales')?.classList.contains('active') && _tabContext.salesSection === 'leads') renderLeads();
        else switchTab('sales', { salesSection: 'leads' });
        g('updateLeadsDateFilterLabel') && updateLeadsDateFilterLabel();
        const sel = document.getElementById('leadsManagerFilter'); if (sel) sel.value = 'unassigned';
    }
    function clearBadgeFilter(opts = {}) {
        if (!B.saved) return;
        _leadsManagerFilter = B.saved.m; _leadsDateFilter = B.saved.d; _leadsVisibleColumns = B.saved.c;
        B.saved = null;
        document.body.classList.remove('rk-vb-on');
        document.getElementById('rkAllDone')?.remove();
        const sel = document.getElementById('leadsManagerFilter'); if (sel) sel.value = _leadsManagerFilter;
        g('updateManagerFilterDisplay') && updateManagerFilterDisplay();
        g('updateLeadsDateFilterLabel') && updateLeadsDateFilterLabel();
        if (!opts.silent && document.getElementById('tab-sales')?.classList.contains('active')) renderLeads();
    }
    function allDone(board) {
        document.getElementById('rkAllDone')?.remove();
        if (!B.saved || board.querySelector('.lead-card')) return;
        board.insertAdjacentHTML('beforeend', `<div id="rkAllDone" class="rk-alldone" role="status"><span aria-hidden="true">✓</span><strong>Hammasi biriktirildi</strong><span>Menejersiz ochiq lid qolmadi</span><button type="button" class="rk-btnp">Doskaga qaytish</button></div>`);
        board.querySelector('#rkAllDone button').onclick = () => clearBadgeFilter();
    }
    RD.leads = { openUnassigned, clearBadgeFilter };

    // ---------- belgilash, klaviatura ----------
    const S = { last: null };
    function setPicked(cb, v) { if (!cb || cb.checked === v) return; cb.checked = v; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    function togglePick(cardEl, shift) {
        const cb = cardEl.querySelector('.lead-bulk-checkbox'); if (!cb) return;
        const col = cardEl.closest('.lead-column');
        if (shift && S.last && S.last.col === col?.dataset.status) {
            const cards = [...col.querySelectorAll('.lead-card:not([hidden])')];
            const a = cards.findIndex(c => c.dataset.leadId === S.last.id), b = cards.indexOf(cardEl);
            if (a >= 0 && b >= 0) { const [lo, hi] = a < b ? [a, b] : [b, a]; for (let i = lo; i <= hi; i++) setPicked(cards[i].querySelector('.lead-bulk-checkbox'), true); S.last = { id: cardEl.dataset.leadId, col: col.dataset.status }; return; }
        }
        setPicked(cb, !cb.checked);
        S.last = { id: cardEl.dataset.leadId, col: col?.dataset.status };
    }
    function bindBoard(board) {
        if (board.dataset.rkBound) return;
        board.dataset.rkBound = '1';
        board.addEventListener('click', e => {
            if (!on()) return;
            const shut = e.target.closest('[data-rk-shut]');
            if (shut) { e.stopPropagation(); const s = shutSet(), id = shut.dataset.rkShut; if (s.has(id)) s.delete(id); else s.add(id); saveShut(s); renderLeads(); return; }
            const rk = e.target.closest('button[data-rk-risk]');
            if (rk) { e.stopPropagation(); const v = rk.dataset.rkRisk; R.risk = R.risk === v ? '' : v; if (R.risk && typeof _leadColumnLimits !== 'undefined') _leadColumnLimits[v.split(':')[0]] = 100000; renderLeads(); return; }
            const cp = e.target.closest('[data-rk-copy]');
            if (cp) { e.stopPropagation(); try { navigator.clipboard?.writeText(cp.dataset.rkCopy); } catch (er) { /* ruxsat yo'q */ } g('showMiniToast') && showMiniToast('Raqam nusxalandi'); return; }
            const p2 = e.target.closest('[data-rk-ph2]');
            if (p2) { e.stopPropagation(); const row = p2.closest('.lead-card')?.querySelector('.rk-ph2'); if (row) { row.hidden = !row.hidden; p2.setAttribute('aria-expanded', String(!row.hidden)); } return; }
            const c = e.target.closest('.lead-card.rk-card');
            if (!c || e.target.closest('button,a,input,label,select,[role=menu],.lead-card-menu-dropdown')) return;
            togglePick(c, e.shiftKey);
        });
        board.addEventListener('change', e => {
            const cb = e.target.closest?.('.lead-bulk-checkbox'); if (!cb) return;
            cb.closest('.lead-card')?.classList.toggle('is-sel', cb.checked);
            if (!e.isTrusted) return;
            const c = cb.closest('.lead-card'); S.last = { id: c?.dataset.leadId, col: c?.closest('.lead-column')?.dataset.status };
        });
        board.addEventListener('keydown', e => {
            if (!on()) return;
            const c = e.target.closest?.('.lead-card.rk-card');
            if (!c) return;
            if (e.key === 'Escape' && c.classList.contains('rk-kin')) { c.classList.remove('rk-kin'); c.focus(); return; }
            if (e.target !== c) return;
            const K = e.key;
            if (K === 'Enter') { e.preventDefault(); c.querySelector('[data-lead-open]')?.click(); }
            else if (K === 'F2') { e.preventDefault(); c.classList.add('rk-kin'); c.querySelector('button, a')?.focus(); }
            else if (K === ' ') { e.preventDefault(); togglePick(c, e.shiftKey); }
            else if (K === 'm' || K === 'M') { e.preventDefault(); (c.querySelector('[data-lead-menu-manager]') || c.querySelector('[data-lead-manager-photo]'))?.click(); }
            else if (K === 's' || K === 'S' || K === 'ContextMenu') { e.preventDefault(); c.querySelector('[data-lead-menu-toggle]')?.click(); }
            else if (K.startsWith('Arrow')) {
                e.preventDefault();
                const col = c.closest('.lead-column');
                const inCol = [...col.querySelectorAll('.lead-card:not([hidden])')];
                const i = inCol.indexOf(c);
                let t = null;
                if (K === 'ArrowDown') t = inCol[i + 1];
                if (K === 'ArrowUp') t = inCol[i - 1];
                if (K === 'ArrowRight' || K === 'ArrowLeft') {
                    const cols = [...board.querySelectorAll(':scope > .lead-column:not(.rk-shut)')];
                    const j = cols.indexOf(col);
                    const step = K === 'ArrowRight' ? 1 : -1;
                    for (let k = j + step; k >= 0 && k < cols.length && !t; k += step) t = cols[k].querySelector('.lead-card:not([hidden])');
                }
                if (t) { t.focus(); t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
            }
        });
        board.addEventListener('focusout', e => { const c = e.target.closest?.('.lead-card.rk-kin'); if (c && !c.contains(e.relatedTarget)) c.classList.remove('rk-kin'); });
        board.addEventListener('scroll', () => { if (on()) hiddenCols(); }, { passive: true });
        // Shift + g'ildirak — gorizontal surish (brauzer o'zi ham qiladi); oddiy g'ildirak ustun ichida.
        if (!document.getElementById('rkCardHelp')) document.body.insertAdjacentHTML('beforeend', '<span id="rkCardHelp" class="sr-only">Enter — lid kartasini ochish. F2 — karta tugmalariga kirish. Space — belgilash, Shift+Space — oraliq. M — menejer. S — amallar menyusi.</span>');
    }
    // Ommaviy panel: "N ta lid tanlandi" + 30 tadan ko'p bo'lsa ogohlantirish (prod confirm saqlanadi).
    function bulkBar() {
        const bar = document.getElementById('bulkActionsBar'); if (!bar) return;
        bar.classList.add('rk-bulk');
        const sel = document.getElementById('bulkManagerSelect');
        if (sel && !sel.dataset.rkLoad) {
            sel.dataset.rkLoad = '1';
            // Menejer yonida ochiq lidlar soni (yuklama) — tanlash oson bo'lsin.
            new MutationObserver(() => decorateMgrOptions(sel)).observe(sel, { childList: true });
            decorateMgrOptions(sel);
        }
    }
    function decorateMgrOptions(sel) {
        const lang = typeof _leadsLangFilter !== 'undefined' && _leadsLangFilter === 'russian' ? 'russian' : 'english';
        const all = (g('getItem') ? getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) : {})[lang] || [];
        [...sel.options].forEach(o => {
            if (!o.value || o.dataset.rkN) return;
            const n = all.filter(l => !l.deletedAt && String(l.managerId) === String(o.value) && OPEN.has(st(l))).length;
            o.dataset.rkN = '1'; o.textContent = `${o.textContent} · ${n} ochiq`;
        });
    }

    // ---------- lid kartasi drawer'i (A3, C1/C2, D1, F1) ----------
    // Mavjud 4 oyna (openLeadOverview, openLeadCommentsModal, openLeadRecordingModal, openLeadNotifyModal) o'z
    // mantig'i bilan ochiladi; ROPda ular o'ng tomondagi 520px drawer va umumiy tablar bilan ko'rsatiladi.
    const TABS = [['main', 'Asosiy', 'openLeadOverview'], ['com', 'Izohlar', 'openLeadCommentsModal'], ['rec', 'Zapis', 'openLeadRecordingModal'], ['not', 'Bildirishnomalar', 'openLeadNotifyModal']];
    const ORIG = {};
    function drawer(tab, lang, leadId) {
        const ov = document.getElementById('modalOverlay'); const modal = ov?.querySelector('.modal'); if (!modal) return;
        const lead = g('getLeadById') ? getLeadById(lang, leadId) : null; if (!lead) return;
        ov.classList.add('rk-drw-on'); modal.classList.add('rk-drw');
        const s = st(lead);
        const mgr = (g('getItem') ? getItem(STORAGE_KEYS.salesManagers, []) : []).find(m => m.id === lead.managerId);
        const hdr = modal.querySelector('.modal-header');
        modal.querySelector('.rk-drw-h')?.remove(); modal.querySelector('.rk-dtabs')?.remove();
        const comN = Array.isArray(lead.comments) ? lead.comments.length : 0;
        let unread = 0; try { unread = g('getUnreadLeadSlaAlerts') ? getUnreadLeadSlaAlerts(g('normalizeLeadExtras') ? normalizeLeadExtras(lead) : lead, lang).length : 0; } catch (e) { unread = 0; }
        const recN = Number(document.querySelector(`#leadsKanban [data-lead-recording="${lang}"][data-lead-id="${CSS.escape(String(leadId))}"] .lead-recording-count`)?.textContent) || 0;
        const N = { com: comN, rec: recN, not: unread };
        const sub = [g('formatPhoneDisplay') ? formatPhoneDisplay(lead.phone) : lead.phone, lang === 'russian' ? 'Rus tili' : 'Ingliz tili', mgr ? 'menejer ' + shortName(mgr.name) : 'menejersiz'].filter(Boolean).join(' · ');
        hdr?.insertAdjacentHTML('afterbegin', `<div class="rk-drw-h"><span class="rk-stage" style="--rk-col:${COLOR[s] || '#0065D6'}">${esc((LEAD_COLUMNS.find(c => c.id === s) || {}).label || '')}</span><span class="rk-drw-sub">${esc(sub)}</span></div>`);
        const title = document.getElementById('modalTitle'); if (title) title.textContent = lead.name || 'Lid kartasi';
        const close = document.getElementById('modalClose'); if (close) close.setAttribute('aria-label', 'Lid kartasini yopish');
        hdr?.insertAdjacentHTML('afterend', `<div class="rk-dtabs" role="tablist" aria-label="Lid kartasi boʻlimlari">${TABS.map(([k, l]) => `<button type="button" role="tab" data-rk-tab="${k}" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}">${l}${N[k] ? `<span class="rk-tn${k === 'not' ? ' is-red' : ''}">${N[k]}</span>` : ''}</button>`).join('')}</div>`);
        const bar = modal.querySelector('.rk-dtabs');
        bar.addEventListener('click', e => { const b = e.target.closest('[data-rk-tab]'); if (!b || b.getAttribute('aria-selected') === 'true') return; const fn = TABS.find(t => t[0] === b.dataset.rkTab)[2]; window[fn]?.(lang, leadId); bar.isConnected || document.querySelector('.rk-dtabs [aria-selected="true"]')?.focus(); setTimeout(() => document.querySelector('.rk-dtabs [aria-selected="true"]')?.focus(), 0); });
        bar.addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); const bs = [...bar.querySelectorAll('[role=tab]')]; const i = bs.indexOf(document.activeElement); const j = e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length; bs[j].click(); });
    }
    function undrawer() {
        const ov = document.getElementById('modalOverlay'); if (!ov) return;
        ov.classList.remove('rk-drw-on');
        const modal = ov.querySelector('.modal'); modal?.classList.remove('rk-drw');
        modal?.querySelector('.rk-drw-h')?.remove(); modal?.querySelector('.rk-dtabs')?.remove();
    }

    // ---------- app.js funksiyalariga ulanish ----------
    function wrapFn(name, make) { const orig = window[name]; if (typeof orig !== 'function' || orig.__rkl) return; const fn = make(orig); fn.__rkl = true; window[name] = fn; ORIG[name] = orig; }
    wrapFn('renderLeadCard', orig => function (lead, langKey) { const html = orig.apply(this, arguments); if (!on()) return html; try { return card(html, lead, langKey); } catch (e) { console.warn('[ropDesk] karta', e.message); return html; } });
    wrapFn('renderLeads', orig => function () {
        const r = orig.apply(this, arguments);
        const board = document.getElementById('leadsKanban');
        if (board) board.classList.toggle('rk-board', on());
        if (!on() || !board) return r;
        try { bindBoard(board); decorateColumns(board); toolbar(); bulkBar(); allDone(board); paintRec(); RD.refreshBadges?.(); } catch (e) { console.warn('[ropDesk] lidlar', e.message); }
        return r;
    });
    // #ID qidiruv (dizayn: "Lid: ism, telefon yoki #ID") — faqat ROPda qo'shimcha moslik.
    wrapFn('leadMatchesSearch', orig => function (lead, query) {
        if (orig.apply(this, arguments)) return true;
        if (!on()) return false;
        const q = String(query ?? (typeof _leadSearchQuery !== 'undefined' ? _leadSearchQuery : '')).trim().replace(/^#/, '').toLowerCase();
        return !!q && !!lead?.serialCode && String(lead.serialCode).toLowerCase().includes(q);
    });
    wrapFn('apiFetchCallRecordingCounts', orig => function () { const p = orig.apply(this, arguments); if (on() && p?.then) p.then(() => setTimeout(() => paintRec(), 0)).catch(() => {}); return p; });
    // Har qanday boshqa oyna ochilsa — drawer ko'rinishi olib tashlanadi; 4 ta lid oynasi uni qayta qo'yadi.
    wrapFn('openModal', orig => function () { if (on()) undrawer(); return orig.apply(this, arguments); });
    TABS.forEach(([k, , name]) => wrapFn(name, orig => function (lang, leadId) { const r = orig.apply(this, arguments); if (on()) { try { drawer(k, lang, leadId); } catch (e) { console.warn('[ropDesk] drawer', e.message); } } return r; }));
    document.getElementById('modalOverlay')?.addEventListener('crm:modal-closed', () => undrawer());
    // Lidlardan chiqilsa — vaqtinchalik badge filtri bekor.
    const sw = window.switchTab;
    if (typeof sw === 'function' && !sw.__rkl) {
        const fn = function (t, ctx) { if (B.saved && !(t === 'sales' && (!ctx || !ctx.salesSection || ctx.salesSection === 'leads'))) clearBadgeFilter({ silent: true }); return sw.apply(this, arguments); };
        fn.__rkl = true; window.switchTab = fn;
    }
    const sss = window.switchSalesSection;
    if (typeof sss === 'function' && !sss.__rkl) {
        const fn = function (sec) { if (B.saved && sec !== 'leads') clearBadgeFilter({ silent: true }); const r = sss.apply(this, arguments); if (on()) toolbar(); return r; };
        fn.__rkl = true; window.switchSalesSection = fn;
    }
    window.addEventListener('resize', () => { if (on()) hiddenCols(); });
})();
