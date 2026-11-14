// 14-noy: Admin va akademik rahbar uchun "Tanishuv aloqalari" — yordamchi ustozlar yangi o'quvchilar bilan tanishdimi.
// Server: GET /api/school/assist/intros/board (services/school/assistIntro.js). Kompyuter va Jamoa ilovasida bir xil.
// Pastki chap burchakda "👋 Tanishuv · N kutilmoqda" tugmasi (kechikkan bo'lsa qizil); bosilsa — ro'yxat oynasi.
(function () {
    'use strict';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const role = () => (typeof getCurrentUser === 'function' && getCurrentUser()?.role) || '';
    const OK = ['admin', 'boshliq', 'akademik'];
    let data = [], tab = 'wait';
    const MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const dt = iso => { if (!iso) return ''; const d = new Date(new Date(iso).getTime() + 5 * 3600000); return `${d.getUTCDate()}-${MON[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
    const CK = { introduced: "o'zini tanishtirdi", number: 'raqamini qoldirdi', schedule: 'vaqtni kelishdi' };

    function css() {
        if (document.getElementById('aibStyle')) return;
        const st = document.createElement('style'); st.id = 'aibStyle';
        st.textContent = `.aib-pill{position:fixed;left:16px;bottom:16px;z-index:9998;border:0;border-radius:999px;padding:10px 14px;font:700 13px 'Plus Jakarta Sans',system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.15);background:#EAF3FF;color:#0057B8}
.aib-pill.late{background:#FEE4E2;color:#B42318}
.aib-ov{position:fixed;inset:0;z-index:100001;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:16px;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.aib-box{background:#fff;color:#0B1220;border-radius:20px;max-width:720px;width:100%;max-height:88vh;overflow:auto;padding:20px}
.aib-h{display:flex;justify-content:space-between;align-items:center;gap:10px}.aib-h h2{margin:0;font-size:19px;font-weight:800}
.aib-p{margin:4px 0 12px;font-size:13px;color:#475467;line-height:1.5}
.aib-seg{display:grid;grid-template-columns:1fr 1fr;background:#E9EEF6;border-radius:14px;padding:4px;margin-bottom:10px}.aib-seg button{height:38px;border:0;border-radius:11px;background:none;font:inherit;font-weight:700;font-size:13px;color:#475467;cursor:pointer}.aib-seg .on{background:#fff;color:#0B1220}
.aib-row{display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-top:1px solid #EEF1F6;font-size:13px}.aib-row:first-child{border-top:0}
.aib-av{width:36px;height:36px;border-radius:50%;background:#EAF3FF;color:#0057B8;display:grid;place-items:center;font-weight:800;font-size:12px;flex:none}
.aib-g{flex:1;min-width:0}.aib-g b{display:block;font-size:14px}.aib-s{color:#667085;line-height:1.45}
.aib-tag{font-size:11px;font-weight:800;padding:4px 9px;border-radius:999px;white-space:nowrap}.t-red{background:#FEE4E2;color:#B42318}.t-wa{background:#FEF0C7;color:#93370D}.t-ok{background:#ECFDF3;color:#067647}
.aib-x{border:1px solid #E6EAF2;background:#fff;border-radius:12px;height:40px;padding:0 14px;font:inherit;font-weight:700;cursor:pointer}`;
        document.head.appendChild(st);
    }
    const ini = n => String(n || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
    function rows(list) {
        if (!list.length) return `<p class="aib-p">${tab === 'wait' ? "Hamma yangi o'quvchilar bilan tanishilgan." : "Oxirgi 14 kunda tanishuv yo'q."}</p>`;
        return list.map(x => `<div class="aib-row"><span class="aib-av">${esc(ini(x.student))}</span><div class="aib-g"><b>${esc(x.student)}</b>
            <span class="aib-s">Yordamchi: ${esc(x.assistant)}${x.teacher ? ` · ustoz ${esc(x.teacher)}` : ''} · ${x.language === 'russian' ? 'Rus' : 'Ingliz'}<br>
            ${x.state === 'done' ? `Tanishdi: ${esc(dt(x.doneAt))}${x.channel ? ' · ' + esc(x.channel) : ''}${(x.checks || []).length ? ' · ' + x.checks.map(c => CK[c]).filter(Boolean).join(', ') : ''}${x.note ? `<br>«${esc(x.note)}»` : ''}`
                : `Biriktirildi: ${esc(dt(x.assignedAt))}${x.noAnswer ? ` · ${x.noAnswer} marta javob bermadi` : ''}`}</span></div>
            ${x.state === 'done' ? '<span class="aib-tag t-ok">Tanishdi</span>' : x.late ? '<span class="aib-tag t-red">Kechikdi</span>' : `<span class="aib-tag t-wa">${x.hoursLeft} soat qoldi</span>`}</div>`).join('');
    }
    function open() {
        document.getElementById('aibOv')?.remove();
        const wait = data.filter(x => x.state === 'pending'), done = data.filter(x => x.state === 'done');
        const ov = document.createElement('div'); ov.className = 'aib-ov'; ov.id = 'aibOv';
        ov.innerHTML = `<div class="aib-box" role="dialog" aria-modal="true" aria-labelledby="aibT"><div class="aib-h"><h2 id="aibT">Tanishuv aloqalari</h2><button type="button" class="aib-x" data-x>Yopish</button></div>
            <p class="aib-p">Yordamchi ustoz yangi o'quvchiga 24 soat ichida qo'ng'iroq qilib o'zini tanishtiradi. Davomatga va maoshga kirmaydi. Tanishsa — sotuv bo'limiga xabar boradi, kechiksa — akademik rahbarga.</p>
            <div class="aib-seg" role="tablist"><button type="button" role="tab" data-t="wait" class="${tab === 'wait' ? 'on' : ''}">Kutilmoqda · ${wait.length}</button><button type="button" role="tab" data-t="done" class="${tab === 'done' ? 'on' : ''}">Tanishdi · 14 kun · ${done.length}</button></div>
            <div>${rows(tab === 'wait' ? wait : done)}</div></div>`;
        document.body.appendChild(ov);
        ov.querySelector('[data-x]').onclick = () => ov.remove();
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        ov.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; open(); });
    }
    function pill() {
        css();
        let p = document.getElementById('aibPill');
        const wait = data.filter(x => x.state === 'pending'), late = wait.filter(x => x.late).length;
        if (!wait.length) { p?.remove(); return; }
        if (!p) { p = document.createElement('button'); p.type = 'button'; p.id = 'aibPill'; p.className = 'aib-pill'; p.onclick = open; document.body.appendChild(p); }
        p.classList.toggle('late', !!late);
        p.textContent = `👋 Tanishuv · ${wait.length} kutilmoqda${late ? ` · ${late} kechikkan` : ''}`;
    }
    async function poll() {
        if (!OK.includes(role())) { document.getElementById('aibPill')?.remove(); return; }
        try { data = (await apiFetch('/api/school/assist/intros/board', { fresh: true }))?.items || []; } catch { return; }
        pill();
    }
    function start() { setTimeout(poll, 5000); setInterval(poll, 300000); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.assistIntroBoard = { open: () => poll().then(open), poll };
})();
