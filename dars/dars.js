// Video dars sahifasi (LiveKit) — 1-bosqich, pilot.
//  /d/<kod>           — o'quvchi yoki sinov darsi lidi (login shart emas, shaxsiy havola)
//  /dars/?s=<id>      — ustoz (o'z o'quvchisi) yoki admin/akademik (kuzatuvchi), CRM tokeni (localStorage mh_token)
// Dizayn: "CRM — barcha dizaynlar" → Video dars (VD_G0–G5, VD_S3, VD_T3, VD_T6, VD_T12).
(function () {
    'use strict';
    const LK = window.LivekitClient;
    const $app = document.getElementById('app');
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const ICO = {
        mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
        micoff: '<path d="M3 3l18 18"/><path d="M9 9v2a3 3 0 005 2.2M15 9.3V6a3 3 0 00-5.7-1.3"/><path d="M5 11a7 7 0 0011.6 5.3M19 11a7 7 0 01-.6 2.8M12 18v3"/>',
        cam: '<path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
        camoff: '<path d="M3 3l18 18"/><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2M10 5h4a2 2 0 012 2v3.3l7-5V17"/>',
        flip: '<path d="M20 7h-3.2l-1.6-2.4A1 1 0 0014.4 4H9.6a1 1 0 00-.8.6L7.2 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M9 13.5a3 3 0 005.6 1.5M15 12.5a3 3 0 00-5.6-1.5"/>',
        screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
        end: '<path d="M3.6 14.2a2 2 0 01-.5-2.1C4.9 8.6 8.2 7 12 7s7.1 1.6 8.9 5.1a2 2 0 01-.5 2.1l-1.6 1.5a1.5 1.5 0 01-2 .1l-1.9-1.4a1.5 1.5 0 01-.6-1.3V11a10 10 0 00-4.6 0v2.1a1.5 1.5 0 01-.6 1.3l-1.9 1.4a1.5 1.5 0 01-2-.1z"/>',
        link: '<path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
        shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
        wifi: '<path d="M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5h.01"/>',
        tg: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l12-9"/>',
    };
    const ic = (k, n = 22, sw = 2) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
    const hm = iso => { const d = new Date(new Date(iso).getTime() + 5 * 3600000); return d.toISOString().slice(11, 16); };
    const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const brand = '<div class="brand"><i>D</i><span><b>Domwork</b><span class="xs mut">Rus tili · onlayn maktab</span></span></div>';
    function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2600); }

    // ── Rejim ────────────────────────────────────────────────────────────────
    const m = location.pathname.match(/^\/d\/([A-Za-z0-9-]{8,9})\/?$/);
    const CODE = m ? m[1].toUpperCase() : null;
    const params = new URLSearchParams(location.search);
    const STUDENT = params.get('s');
    const TICKET = params.get('k');
    // Jamoa ilovasi (Android WebView) kamera bilan birga mikrofonni bermaydi — video dars Chrome'da ochiladi.
    const IN_TEAM_APP = /DomworkTeam\//.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const chromeUrl = u => 'googlechrome://navigate?url=' + encodeURIComponent(u);
    const staffToken = () => { try { return localStorage.getItem('mh_token'); } catch { return null; } };
    const deviceId = (() => { try { let d = localStorage.getItem('dw_video_device'); if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('dw_video_device', d); } return d; } catch { return 'x' + Date.now(); } })();

    async function api(path, opts = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (opts.auth) { if (TICKET) headers['X-Video-Ticket'] = TICKET; else headers.Authorization = 'Bearer ' + staffToken(); }
        const r = await fetch('/api/video' + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
        let data = {}; try { data = await r.json(); } catch { /* bo'sh */ }
        if (!r.ok) { const e = new Error(data.error || 'Xatolik'); e.status = r.status; throw e; }
        return data;
    }

    // ── Holat ekranlari ──────────────────────────────────────────────────────
    function screenMsg({ icon = 'clock', tone = '#FFF4D1', color = '#7A5300', title, text, actions = '' }) {
        $app.innerHTML = `<div class="pad">${brand}<div class="pad center" style="padding:30px 4px"><span class="big-ic" style="background:${tone};color:${color}">${ic(icon, 40)}</span>
            <h1 class="dsp" style="font-size:26px;margin:0">${esc(title)}</h1><p class="mut" style="margin:0;line-height:1.5">${text}</p></div>${actions}</div>`;
    }
    const helpBtns = `<a class="btnp" href="https://t.me/Domworkru_bot" target="_blank" rel="noopener">${ic('tg', 18)}Telegramda yozish</a>`;

    // ── Havola rejimi (/d/<kod>) ─────────────────────────────────────────────
    let info = null, timerId = null;
    async function startLink() {
        try { info = await api('/link/' + CODE); } catch (e) {
            return screenMsg({ icon: 'clock', title: 'Havola topilmadi', text: "Havolani to'liq nusxalaganingizni tekshiring yoki menejerga yozing.", actions: helpBtns });
        }
        if (!info.configured) return screenMsg({ title: 'Video dars hali ishga tushmagan', text: 'Iltimos, menejerga yozing.', actions: helpBtns });
        if (info.state === 'expired') return screenMsg({ title: 'Bu havola endi ishlamaydi', text: `Bu havola ${esc(hm(info.startsAt))} dagi dars uchun edi. Yangi dars bo'lsa, havolasi alohida keladi — eng oxirgi xabarni oching.`, actions: helpBtns });
        if (info.state === 'early') return earlyScreen();
        prejoin();
    }
    function earlyScreen() {
        const opens = new Date(info.opensAt).getTime();
        $app.innerHTML = `<div class="pad">${brand}${lessonCard()}<div class="card" style="align-items:center;text-align:center;gap:8px;padding:22px">
            <span class="big-ic" style="width:72px;height:72px;background:#F0F3FF;color:#1E3FD1">${ic('clock', 34)}</span><b style="font-size:17px">Xona ${esc(hm(info.opensAt))} da ochiladi</b>
            <span class="timer" id="cd">--:--</span><span class="sm mut">Sahifani yopmasangiz ham bo'ladi — vaqt kelganda shu yerdan kirasiz.</span></div>
            <span style="flex:1"></span><button class="btnp" disabled>${ic('cam', 20)}Darsga kirish · ${esc(hm(info.opensAt))} dan</button></div>`;
        const tick = () => {
            const left = opens - Date.now();
            if (left <= 0) { clearInterval(timerId); return startLink(); }
            const s = Math.floor(left / 1000), h = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
            const el = document.getElementById('cd'); if (el) el.textContent = (h ? h + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0');
        };
        tick(); timerId = setInterval(tick, 1000);
    }
    function lessonCard() {
        const lead = info.kind === 'trial';
        return `<div class="card"><span class="over">${lead ? 'Bepul sinov darsi' : 'Jonli dars'} · ${esc(hm(info.startsAt))}</span>
            <span class="dsp" style="font-size:24px">Salom${info.name ? ', ' + esc(info.name.split(' ')[0]) : ''}!</span>
            <span class="sm mut">${info.teacherName ? 'Ustoz ' + esc(info.teacherName.split(' ')[0]) + ' · ' : ''}${esc(info.durationMin)} daqiqa</span></div>`;
    }

    // ── Kirishdan oldin (kamera/mikrofon tekshiruvi) ─────────────────────────
    let preview = null, wantCam = true, wantMic = true;
    async function prejoin(opts = {}) {
        const staff = opts.staff;
        $app.innerHTML = `<div class="pad">${staff ? '' : brand}${staff ? staffCard(staff) : lessonCard()}
            <div class="prev"><video id="pv" autoplay playsinline muted></video><span class="gp lbl" id="pvl">Kamera yoqilmoqda…</span>
              <div class="tg"><button class="tgl" id="tm" aria-label="Mikrofon">${ic('mic')}</button><button class="tgl" id="tc" aria-label="Kamera">${ic('cam')}</button></div></div>
            ${staff ? '' : `<div class="fld"><label for="nm">Ismingiz</label><input id="nm" maxlength="60" value="${esc(info.name || '')}"></div>`}
            <span style="flex:1"></span>
            <button class="btnp" id="go">${ic('cam', 20)}Darsga kirish</button>
            <button class="btns" id="go2">${ic('mic', 18)}Faqat ovoz bilan kirish</button>
            <span class="xs mut" style="text-align:center;display:flex;gap:6px;justify-content:center">${ic('shield', 14)}Ilova va login shart emas</span></div>`;
        const pv = document.getElementById('pv'), lbl = document.getElementById('pvl');
        try {
            preview = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
            pv.srcObject = preview; lbl.textContent = 'Siz · kamera yoqiq';
        } catch (e) {
            if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) return deniedScreen(opts);
            lbl.textContent = 'Kamera topilmadi'; wantCam = false;
        }
        const tm = document.getElementById('tm'), tc = document.getElementById('tc');
        const sync = () => {
            tm.className = 'tgl' + (wantMic ? '' : ' off'); tm.innerHTML = ic(wantMic ? 'mic' : 'micoff');
            tc.className = 'tgl' + (wantCam ? '' : ' off'); tc.innerHTML = ic(wantCam ? 'cam' : 'camoff');
            preview?.getAudioTracks().forEach(t => { t.enabled = wantMic; });
            preview?.getVideoTracks().forEach(t => { t.enabled = wantCam; });
            lbl.textContent = wantCam ? 'Siz · kamera yoqiq' : 'Kamera o\'chiq';
        };
        tm.onclick = () => { wantMic = !wantMic; sync(); };
        tc.onclick = () => { wantCam = !wantCam; sync(); };
        sync();
        document.getElementById('go').onclick = () => join(opts, true);
        document.getElementById('go2').onclick = () => { wantCam = false; join(opts, false); };
    }
    function deniedScreen(opts) {
        // Android'da ko'pincha sabab — havola Telegram/boshqa ilova ichidagi brauzerda ochilgan: ular kamera so'ramaydi ham.
        screenMsg({ icon: 'camoff', tone: '#FDECEC', color: '#B42318', title: 'Brauzer kamera va mikrofonga ruxsat bermadi',
            text: isAndroid ? "Havola Telegram yoki boshqa ilova ichida ochilgan bo'lishi mumkin — ular kamerani bermaydi. «Chrome'da ochish» tugmasini bosing."
                + " Chrome'da ham chiqsa: manzil satridagi qulf belgisi → «Kamera» va «Mikrofon» → «Ruxsat berish»."
                : "Manzil satridagi qulf belgisini bosing → «Kamera» va «Mikrofon» → «Ruxsat berish». Keyin sahifani yangilang.",
            actions: `${isAndroid ? `<button class="btnp" id="toChrome">${ic('cam', 20)}Chrome'da ochish</button>` : ''}<button class="${isAndroid ? 'btns' : 'btnp'}" onclick="location.reload()">Sahifani yangilash</button>${opts.staff ? '' : helpBtns.replace('btnp', 'btns')}` });
        const b = document.getElementById('toChrome');
        if (b) b.onclick = () => openInChrome(b);
    }
    // Shu darsni Chrome'da ochish. Xodim uchun — qisqa muddatli chipta (Chrome'da login yo'q), o'quvchi havolasi — o'zi.
    async function openInChrome(btn) {
        let url = location.href;
        if (STUDENT && !TICKET) {
            if (btn) { btn.disabled = true; btn.textContent = 'Tayyorlanmoqda…'; }
            try { url = (await api('/teacher/' + encodeURIComponent(STUDENT) + '/ticket', { method: 'POST', auth: true })).url; }
            catch (e) { if (btn) { btn.disabled = false; btn.textContent = "Chrome'da ochish"; } return toast(e.message); }
        }
        location.href = chromeUrl(url);
        setTimeout(() => {
            screenMsg({ icon: 'cam', tone: '#F0F3FF', color: '#1E3FD1', title: "Chrome ochilmadimi?",
                text: 'Ochilgan bo\'lsa — darsni Chrome\'da davom ettiring. Ochilmagan bo\'lsa, havolani nusxalab Chrome brauzeriga qo\'ying (havola 3 soat ishlaydi).',
                actions: `<button class="btnp" id="cpy">Havolani nusxalash</button><button class="btns" id="again">Chrome'da qayta urinish</button>` });
            document.getElementById('cpy').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Nusxalandi'); } catch { prompt('Havolani nusxalang:', url); } };
            document.getElementById('again').onclick = () => { location.href = chromeUrl(url); };
        }, 1800);
    }
    function teamAppScreen() {
        screenMsg({ icon: 'cam', tone: '#F0F3FF', color: '#1E3FD1', title: "Video dars Chrome'da ochiladi",
            text: "Jamoa ilovasi ichida kamera va mikrofon ishlamaydi. Tugmani bosing — dars Chrome'da ochiladi, qayta login shart emas.",
            actions: `<button class="btnp" id="toChrome">${ic('cam', 20)}Chrome'da ochish</button><a class="btns" href="/teacher/">Ilovaga qaytish</a>` });
        document.getElementById('toChrome').onclick = e => openInChrome(e.currentTarget);
    }
    function staffCard(st) {
        return `<div class="card"><span class="over" style="color:#1E3FD1">${st.role === 'teacher' ? 'Video xona' : 'Kuzatuvchi'} · ${esc(hm(st.startsAt))}</span>
            <span class="dsp" style="font-size:22px">${esc(st.studentName)}</span><span class="sm mut">${esc(st.durationMin)} daqiqa${st.role === 'watcher' ? ' · siz ko\'rinmaysiz va eshitilmaysiz' : ''}</span></div>`;
    }

    // ── Xonaga kirish ────────────────────────────────────────────────────────
    let room = null, session = null, startedAt = null, beat = null;
    async function join(opts, withCam) {
        const btn = document.getElementById('go'); if (btn) { btn.disabled = true; btn.textContent = 'Ulanmoqda…'; }
        try {
            if (opts.staff) session = opts.staff;
            else {
                const name = (document.getElementById('nm')?.value || '').trim();
                session = await api('/link/' + CODE + '/join', { method: 'POST', body: { deviceId, name, takeover: !!opts.takeover } });
            }
        } catch (e) {
            if (e.status === 409) return otherDevice(opts);
            if (e.status === 410) return startLink();
            if (e.status === 425) return startLink();
            if (btn) { btn.disabled = false; btn.innerHTML = ic('cam', 20) + 'Darsga kirish'; }
            return toast(e.message);
        }
        preview?.getTracks().forEach(t => t.stop()); preview = null;
        room = new LK.Room({ adaptiveStream: true, dynacast: true });
        bindRoom();
        try {
            await room.connect(session.url, session.token);
        } catch (e) { toast("Ulanib bo'lmadi: internetni tekshiring"); console.error(e); return; }
        const canPublish = session.role !== 'watcher';
        if (canPublish) {
            try { await room.localParticipant.setMicrophoneEnabled(wantMic); } catch (e) { console.warn(e); }
            if (withCam && wantCam) { try { await room.localParticipant.setCameraEnabled(true); } catch (e) { console.warn(e); } }
        }
        startedAt = Date.now();
        presence('join');
        beat = setInterval(() => presence('beat'), 60000);
        window.addEventListener('pagehide', () => presence('leave', true));
        renderCall();
    }
    function otherDevice(opts) {
        $app.innerHTML = `<div class="pad">${brand}${lessonCard()}<div class="card"><b>Bu havola boshqa qurilmada ochiq</b><span class="sm mut">Havola bir vaqtda faqat bitta qurilmada ishlaydi.</span></div>
            <span style="flex:1"></span><button class="btnp" id="mv">Shu qurilmaga o'tkazish</button><span class="xs mut" style="text-align:center">O'tkazsangiz, boshqa qurilmadagi oyna yopiladi</span></div>`;
        document.getElementById('mv').onclick = () => { prejoin({ ...opts, takeover: true }); };
    }
    function presence(kind, beacon) {
        if (!session) return;
        const body = JSON.stringify({ token: session.token, kind });
        if (beacon && navigator.sendBeacon) { navigator.sendBeacon('/api/video/presence', new Blob([body], { type: 'application/json' })); return; }
        fetch('/api/video/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
    }

    // ── Qo'ng'iroq ekrani ────────────────────────────────────────────────────
    let banner = '', facing = 'user';
    const remoteName = () => { const p = [...(room?.remoteParticipants?.values() || [])].find(x => !String(x.identity).startsWith('w:')); return p ? p.name || 'Ishtirokchi' : null; };
    function bindRoom() {
        const E = LK.RoomEvent;
        room.on(E.TrackSubscribed, () => renderStage());
        room.on(E.TrackUnsubscribed, () => renderStage());
        room.on(E.ParticipantConnected, p => { if (!String(p.identity).startsWith('w:')) { banner = ''; toast(`${p.name || 'Ishtirokchi'} kirdi`); } renderStage(); });
        room.on(E.ParticipantDisconnected, p => { if (!String(p.identity).startsWith('w:')) banner = `${p.name || 'Ishtirokchi'} chiqib ketdi. Qayta ulanishini kuting.`; renderStage(); });
        room.on(E.LocalTrackPublished, () => { renderPip(); renderCtl(); });
        room.on(E.LocalTrackUnpublished, () => { renderPip(); renderCtl(); });
        room.on(E.TrackMuted, () => { renderStage(); renderPip(); });
        room.on(E.TrackUnmuted, () => { renderStage(); renderPip(); });
        room.on(E.Reconnecting, () => { banner = 'Aloqa uzildi, qayta ulanmoqda…'; renderBanner(); });
        room.on(E.Reconnected, () => { banner = ''; renderBanner(); });
        room.on(E.ConnectionQualityChanged, (q, p) => {
            if (p !== room.localParticipant) return;
            if (q === LK.ConnectionQuality.Poor) { banner = 'Internet sust. Kamerani o\'chirsangiz, ovoz yaxshiroq eshitiladi.'; renderBanner(); }
            else if (banner.startsWith('Internet')) { banner = ''; renderBanner(); }
        });
        room.on(E.Disconnected, () => { clearInterval(beat); presence('leave'); ended(); });
    }
    function renderCall() {
        $app.className = 'app wide';
        $app.innerHTML = `<div class="call"><div class="stwrap"><div class="stage" id="stage"></div><div class="pip" id="pip" hidden></div></div>
            <div class="top"><span class="gp" id="tmr"><span class="dot"></span><span>00:00</span></span><span style="flex:1"></span>${session.role === 'teacher' ? `<button class="gp" id="lnk" style="border:0;color:#FFF">${ic('link', 16)}Havola</button>` : ''}</div>
            <div class="banner" id="bn" hidden></div><div class="ctl" id="ctl"></div></div>`;
        renderStage(); renderPip(); renderCtl(); renderBanner();
        const lnk = document.getElementById('lnk'); if (lnk) lnk.onclick = shareLink;
        setInterval(tickTimer, 1000); tickTimer();
    }
    function tickTimer() {
        const el = document.getElementById('tmr'); if (!el || !session) return;
        const start = new Date(session.startsAt).getTime(), dur = (Number(session.durationMin) || 30) * 60000, now = Date.now();
        const passed = Math.max(0, now - start), left = Math.max(0, start + dur - now);
        const f = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
        el.innerHTML = now < start ? `<span class="dot" style="background:#FFC93C"></span>Dars ${esc(hm(session.startsAt))} da` : `<span class="dot"></span><span>${f(passed)}</span><span style="color:#B8C1D6">o'tdi · ${Math.ceil(left / 60000)} daq qoldi</span>`;
    }
    function renderBanner() { const el = document.getElementById('bn'); if (!el) return; el.hidden = !banner; el.innerHTML = banner ? `<span style="display:flex;gap:8px">${ic('wifi', 18)}<span>${esc(banner)}</span></span>` : ''; }
    function renderStage() {
        const el = document.getElementById('stage'); if (!el) return;
        renderBanner();
        const parts = [...room.remoteParticipants.values()].filter(p => !String(p.identity).startsWith('w:'));
        let shown = null;
        for (const p of parts) for (const pub of p.trackPublications.values()) {
            if (pub.track && pub.kind === 'video' && !pub.isMuted && (pub.source === LK.Track.Source.ScreenShare || !shown)) shown = pub.track;
        }
        for (const p of parts) for (const pub of p.trackPublications.values()) if (pub.track && pub.kind === 'audio' && !pub.track.attachedElements.length) document.body.appendChild(pub.track.attach());
        el.innerHTML = '';
        if (shown) { const v = shown.attach(); v.playsInline = true; el.appendChild(v); return; }
        const p = parts[0];
        el.innerHTML = p ? `<div class="ph"><span class="ava">${esc(initials(p.name))}</span><b>${esc(p.name || '')}</b><span class="sm" style="color:#B8C1D6">kamerasi o'chiq</span></div>`
            : `<div class="ph"><span class="ava" style="background:#26304A;color:#C7D2E3">…</span><b style="font-size:19px">${session.role === 'teacher' ? esc(session.studentName) + ' hali kirmadi' : 'Ustoz hali kirmadi'}</b>
               <span class="sm" style="color:#B8C1D6">${session.role === 'teacher' ? "Havolani yuborish uchun tepadagi «Havola» tugmasini bosing" : 'Ustoz kelguncha shu yerda kuting — u kirishi bilan dars boshlanadi'}</span></div>`;
    }
    function renderPip() {
        const el = document.getElementById('pip'); if (!el || !room) return;
        const pub = room.localParticipant.getTrackPublication(LK.Track.Source.Camera);
        if (!pub || !pub.track || pub.isMuted) { el.hidden = session.role === 'watcher'; el.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:#B8C1D6">${ic('camoff', 26)}</div><span class="s">Siz</span>`; return; }
        el.hidden = false; el.innerHTML = ''; const v = pub.track.attach(); v.muted = true; el.appendChild(v);
        el.insertAdjacentHTML('beforeend', '<span class="s">Siz</span>');
    }
    function renderCtl() {
        const el = document.getElementById('ctl'); if (!el || !room) return;
        const lp = room.localParticipant, mic = lp.isMicrophoneEnabled, cam = lp.isCameraEnabled, scr = lp.isScreenShareEnabled;
        const b = (id, cls, icon, label) => `<button id="${id}" aria-label="${label}"><span class="c ${cls}">${ic(icon, 24)}</span>${label}</button>`;
        el.innerHTML = session.role === 'watcher' ? b('bx', 'red', 'end', 'Chiqish')
            : b('bm', mic ? '' : 'off', mic ? 'mic' : 'micoff', 'Mikrofon') + b('bc', cam ? '' : 'off', cam ? 'cam' : 'camoff', 'Kamera')
              + (isMobile ? b('bf', '', 'flip', 'Almashtirish') : '')
              + (session.role === 'teacher' && !isMobile ? b('bs', scr ? 'on' : '', 'screen', scr ? 'Ulashilmoqda' : 'Ekran') : '')
              + b('bx', 'red', 'end', session.role === 'teacher' ? 'Tugatish' : 'Chiqish');
        const on = (id, fn) => { const x = document.getElementById(id); if (x) x.onclick = fn; };
        on('bm', async () => { await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled); renderCtl(); });
        on('bc', async () => { try { await lp.setCameraEnabled(!lp.isCameraEnabled); } catch { toast('Kamerani yoqib bo\'lmadi'); } renderCtl(); renderPip(); });
        on('bf', async () => { const pub = lp.getTrackPublication(LK.Track.Source.Camera); if (!pub?.track) return; facing = facing === 'user' ? 'environment' : 'user'; try { await pub.track.restartTrack({ facingMode: facing }); } catch { toast('Kamerani almashtirib bo\'lmadi'); } });
        on('bs', async () => { try { await lp.setScreenShareEnabled(!lp.isScreenShareEnabled); } catch { toast("Ekranni ulashib bo'lmadi"); } renderCtl(); });
        on('bx', confirmLeave);
    }
    function confirmLeave() {
        const teacher = session.role === 'teacher';
        const bg = document.createElement('div'); bg.className = 'sheet-bg';
        bg.innerHTML = `<div class="sheet" role="dialog"><b class="dsp" style="font-size:22px">${teacher ? 'Darsni tugatasizmi?' : 'Darsdan chiqasizmi?'}</b>
            <span class="mut" style="line-height:1.45">${teacher ? "Keyin Jamoa ilovasida davomatni belgilang (Keldi yoki Kelmadi)." : 'Chiqsangiz ham, shu havola orqali dars tugaguncha qayta kirasiz.'}</span>
            <button class="btnp" id="stay">${teacher ? 'Davom etish' : 'Darsda qolish'}</button><button class="btns" id="out" style="color:#B42318;background:#FDECEC;border-color:#FDECEC">${teacher ? 'Tugatish' : 'Chiqish'}</button></div>`;
        document.body.appendChild(bg);
        bg.querySelector('#stay').onclick = () => bg.remove();
        bg.querySelector('#out').onclick = () => { bg.remove(); room.disconnect(); };
    }
    async function shareLink() {
        try {
            const r = await api('/teacher/' + encodeURIComponent(STUDENT) + '/link', { method: 'POST', auth: true });
            const bg = document.createElement('div'); bg.className = 'sheet-bg';
            bg.innerHTML = `<div class="sheet" role="dialog"><b class="dsp" style="font-size:22px">Darsga havola</b><span class="sm mut">${esc(session.studentName)} · ilovasiz, brauzerda ochiladi</span>
                <div class="fld"><input id="lv" readonly value="${esc(r.link)}"></div>
                <button class="btnp" id="cp">Nusxa olish</button><a class="btns" href="https://t.me/share/url?url=${encodeURIComponent(r.link)}" target="_blank" rel="noopener">${ic('tg', 18)}Telegram</a>
                <div class="note i">Havola faqat shu dars uchun: ${esc(hm(r.opensAt))} dan ochiq, ${esc(hm(r.endsAt))} da o'chadi. Bir vaqtda bitta qurilmada ishlaydi.</div>
                <button class="btns" id="cl">Yopish</button></div>`;
            document.body.appendChild(bg);
            bg.querySelector('#cp').onclick = async () => { try { await navigator.clipboard.writeText(r.link); toast('Nusxa olindi'); } catch { bg.querySelector('#lv').select(); } };
            bg.querySelector('#cl').onclick = () => bg.remove();
        } catch (e) { toast(e.message); }
    }
    function ended() {
        $app.className = 'app';
        const teacher = session?.role === 'teacher', lead = session?.kind === 'trial';
        const mins = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 60000)) : 0;
        $app.innerHTML = `<div class="pad"><div class="pad center" style="padding-top:60px"><span class="big-ic" style="background:#E3F7EE;color:#0FA968">${ic('check', 44, 3)}</span>
            <h1 class="dsp" style="font-size:28px;margin:0">${lead ? 'Sinov darsi tugadi' : teacher ? 'Siz xonadan chiqdingiz' : 'Darsdan chiqdingiz'}</h1>
            <p class="mut" style="margin:0">${mins ? mins + ' daqiqa xonada bo\'ldingiz' : ''}</p></div>
            ${teacher ? `${TICKET ? '<p class="mut" style="text-align:center;margin:0">Davomatni Jamoa ilovasida belgilang.</p>' : '<a class="btnp" href="/teacher/#davomat">Davomatni belgilash</a>'}<a class="btns" href="/dars/${esc(location.search)}">Qayta kirish</a>`
              : `<a class="btnp" href="${esc(location.pathname)}">Qayta kirish</a>${lead ? helpBtns.replace('btnp', 'btns') : '<a class="btns" href="/student/v2">Ilovaga qaytish</a>'}`}</div>`;
    }

    // ── Ishga tushirish ──────────────────────────────────────────────────────
    async function startStaff() {
        if (IN_TEAM_APP && !TICKET) return teamAppScreen();
        if (!staffToken() && !TICKET) return screenMsg({ title: 'Avval tizimga kiring', text: 'Jamoa ilovasiga kirib, darsni o\'sha yerdan oching.', actions: '<a class="btnp" href="/teacher/">Jamoa ilovasi</a>' });
        try {
            const st = await api('/teacher/' + encodeURIComponent(STUDENT) + '/join', { method: 'POST', auth: true });
            if (st.role === 'watcher') { session = st; wantCam = false; wantMic = false; return join({ staff: st }, false); }
            prejoin({ staff: st });
        } catch (e) { screenMsg({ title: 'Video xonani ochib bo\'lmadi', text: esc(e.message), actions: '<a class="btnp" href="/teacher/">Jamoa ilovasiga qaytish</a>' }); }
    }
    if (!LK) screenMsg({ title: 'Sahifa to\'liq yuklanmadi', text: 'Internetni tekshirib, sahifani yangilang.', actions: '<button class="btnp" onclick="location.reload()">Yangilash</button>' });
    else if (CODE) startLink();
    else if (STUDENT) startStaff();
    else screenMsg({ title: 'Havola noto\'g\'ri', text: 'Darsga havola orqali kiring.', actions: helpBtns });
})();
