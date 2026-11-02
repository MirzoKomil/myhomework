'use strict';
// Domwork 1-dars mini ilovasi (Telegram WebApp). Server: /api/miniapp (server/routes/miniapp.js).
(function () {
  const L = window.LESSON;
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || '';
  const $app = document.getElementById('app');
  const IMG = k => `img/${k}.webp`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const noStress = s => String(s).replace(/́/g, '');
  const haptic = kind => { try { kind === 'ok' || kind === 'bad' ? tg?.HapticFeedback?.notificationOccurred(kind === 'ok' ? 'success' : 'error') : tg?.HapticFeedback?.impactOccurred('light'); } catch { /* eski Telegram */ } };

  // ── Holat ──────────────────────────────────────────────────────────────
  let S = null; // serverdagi holat (view)
  const local = load();
  function load() { try { return JSON.parse(localStorage.getItem('dw1') || '{}'); } catch { return {}; } }
  function save() { try { localStorage.setItem('dw1', JSON.stringify(local)); } catch { /* saqlash ixtiyoriy */ } }
  const ageN = () => local.age || S?.answers?.homework?.age || 30;

  // ── API ────────────────────────────────────────────────────────────────
  async function api(path, body, { raw, query = '' } = {}) {
    const headers = { 'X-Telegram-Init-Data': initData };
    if (!raw) headers['Content-Type'] = 'application/json';
    else headers['Content-Type'] = raw.type || 'audio/webm';
    let res;
    try { res = await fetch('/api/miniapp' + path + query, { method: 'POST', headers, body: raw || JSON.stringify(body || {}) }); }
    catch { throw Object.assign(Error('offline'), { offline: true }); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(Error(data.error || 'Xatolik'), { status: res.status });
    return data;
  }
  async function track(type, data) {
    try { const st = await api('/event', { type, data }); S = { ...S, ...st }; return st; }
    catch (e) { if (e.offline) queueEvent(type, data); return null; }
  }
  // Internet uzilsa — hodisa navbatga, aloqa tiklanganda yuboriladi (natija yo'qolmaydi).
  function queueEvent(type, data) { local.pending = [...(local.pending || []), { type, data }].slice(-20); save(); }
  async function flush() {
    const list = local.pending || []; local.pending = []; save();
    for (const e of list) await track(e.type, e.data);
  }

  // ── Ovoz (ustoz namunasi) ──────────────────────────────────────────────
  let ruVoice = null;
  function pickVoice() { try { ruVoice = speechSynthesis.getVoices().find(v => /^ru/i.test(v.lang)) || null; } catch { ruVoice = null; } }
  try { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } catch { /* yo'q */ }
  function say(text, key) {
    const file = key && L.AUDIO[key];
    if (file) { new Audio('audio/' + file).play().catch(() => tts(text)); return; }
    tts(text);
  }
  function tts(text) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(noStress(text));
      u.lang = 'ru-RU'; u.rate = 0.85; if (ruVoice) u.voice = ruVoice;
      speechSynthesis.speak(u);
    } catch { /* ovoz yo'q — matn baribir ko'rinib turadi */ }
  }
  const canSpeak = () => { try { return 'speechSynthesis' in window && (!!ruVoice || Object.keys(L.AUDIO).length > 0 || speechSynthesis.getVoices().length === 0); } catch { return false; } };

  // ── Navigatsiya (Telegram BackButton) ──────────────────────────────────
  const stack = [];
  function go(name, args = {}, { replace = false } = {}) {
    stopTimers();
    if (replace) stack.pop();
    stack.push({ name, args });
    render();
  }
  function back() { stopTimers(); if (stack.length > 1) { stack.pop(); render(); } }
  function home() { stopTimers(); stack.length = 0; stack.push({ name: 'hub', args: {} }); render(); }
  try { tg?.BackButton?.onClick(back); } catch { /* */ }
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const every = (fn, ms) => timers.push(setInterval(fn, ms));
  function stopTimers() { timers.forEach(t => { if (t && t.off) return t.off(); clearTimeout(t); clearInterval(t); }); timers = []; recorder.stop(true); try { speechSynthesis.cancel(); } catch { /* */ } }

  function render() {
    const cur = stack[stack.length - 1];
    try { stack.length > 1 && cur.name !== 'splash' ? tg?.BackButton?.show() : tg?.BackButton?.hide(); } catch { /* */ }
    $app.innerHTML = '';
    const el = document.createElement('section');
    el.className = 'screen';
    $app.appendChild(el);
    SCREENS[cur.name](el, cur.args);
    window.scrollTo(0, 0);
  }
  // Brauzerda (Telegram tashqarisida) orqaga tugmasi.
  const backLink = () => (!tg?.initData && stack.length > 1) ? `<button class="backlink" data-back>‹ Orqaga</button>` : '';
  function wire(el, handlers) {
    el.querySelectorAll('[data-back]').forEach(b => b.onclick = back);
    for (const [sel, fn] of Object.entries(handlers)) el.querySelectorAll(sel).forEach(b => b.addEventListener('click', e => fn(e, b)));
  }

  // ── Kichik bo'laklar ───────────────────────────────────────────────────
  const ICON = {
    check: (c = '#087A4A', s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`,
    cross: (c = '#B34700', s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
    play: (c = '#fff', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill="${c}"/></svg>`,
    pause: (c = '#fff', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" fill="${c}"/><rect x="14" y="4" width="4" height="16" rx="1" fill="${c}"/></svg>`,
    spk: (c = '#2F5BFF') => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>`,
    lock: (c = '#5B6478', s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
    chev: (c = '#5B6478') => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`,
    phone: (c = '#fff') => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>`,
    clock: (c = '#5A2FD6', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    mic: (c = '#fff', s = 40) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`,
    stop: (s = 34) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="3" fill="#fff"/></svg>`,
    video: (c = '#2F5BFF') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3"/></svg>`,
    hw: (c = '#2F5BFF') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h10v16H5V8z"/><path d="M9 4v4H5M9 13l2 2 4-4"/></svg>`,
    game: (c = '#5A2FD6') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M16 12h.01M18 14h.01"/></svg>`,
    star: (c = '#F5B70A', s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="${c}"/></svg>`
  };
  const domik = (k, size, alt = '') => `<img class="domik" src="${IMG(k)}" width="${size}" height="${size}" ${alt ? `alt="${esc(alt)}"` : 'alt="" aria-hidden="true"'}>`;
  const bar = (inner) => `<div class="bar">${inner}</div>`;
  const top = (label, cur, tot) => `<div class="top"><div class="row"><span>${esc(label)}</span><span>${cur} / ${tot}</span></div><div class="prog" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${cur}" aria-valuemin="0" aria-valuemax="${tot}"><i style="width:${Math.round(cur * 100 / tot)}%"></i></div></div>`;
  const spkBtn = (text, label = '') => canSpeak() ? `<button class="spk" data-say="${esc(text)}" aria-label="Tinglash: ${esc(noStress(text))}">${ICON.spk()}${label}</button>` : '';
  function wireSay(el) { el.querySelectorAll('[data-say]').forEach(b => b.onclick = e => { e.stopPropagation(); haptic(); say(b.dataset.say); }); }
  function confetti(el) {
    const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
    const colors = ['#2F5BFF', '#087A4A', '#F5B70A', '#5A2FD6', '#D0342C'];
    for (let i = 0; i < 36; i++) { const c = document.createElement('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = colors[i % 5]; c.style.animationDelay = Math.random() * .6 + 's'; box.appendChild(c); }
    el.style.position = 'relative'; el.appendChild(box); setTimeout(() => box.remove(), 2600);
  }
  const managerName = () => S?.manager?.name || '';
  const advisor = () => managerName() ? `Menejer ${esc(managerName())}` : 'Domwork oʻquv maslahatchisi';
  const firstName = () => esc(S?.name || '');
  function nextStep() {
    const st = S?.steps || {};
    return ['video', 'homework', 'game', 'voice'].find(k => !st[k]) || null;
  }
  const STEP_SCREEN = { video: 'video', homework: 'hw', game: 'dialog', voice: 'speak' };
  const STEP_TITLE = { video: 'Video dars', homework: 'Uy vazifasi', game: 'Oʻyinlar', voice: 'Oʻzingiz gapiring' };

  // ── Ekranlar ───────────────────────────────────────────────────────────
  const SCREENS = {};

  SCREENS.splash = el => {
    el.innerHTML = `<div class="body center">${domik('wave', 150, 'Domik qoʻl silkitmoqda')}<div class="spinner" role="status" aria-label="Yuklanmoqda"></div><p class="h2">Darsingiz tayyorlanmoqda…</p><p class="lead">Roʻyxatdan oʻtish shart emas — Telegram orqali kirdingiz</p></div>`;
  };

  SCREENS.outside = el => {
    el.innerHTML = `<div class="body center">${domik('phones', 150)}<p class="h2">Telegram orqali oching</p><p class="lead">1-dars @Domworkuz_bot ichida ochiladi.</p><a class="btn" href="https://t.me/Domworkuz_bot">Botni ochish</a></div>`;
  };

  SCREENS.error = (el, { retry, offline = true, message = '' }) => {
    el.innerHTML = `<div class="body center">${domik(offline ? 'offline' : 'sad', 150)}<p class="h2">${offline ? 'Internet uzildi' : 'Nimadir xato ketdi'}</p><p class="lead">${offline ? 'Xavotir olmang — natijalaringiz saqlangan. Aloqa tiklangach, toʻxtagan joyingizdan davom etasiz.' : esc(message || 'Birozdan keyin qayta urinib koʻring.')}</p></div>${bar('<button class="btn" data-retry>Qayta urinish</button>')}`;
    wire(el, { '[data-retry]': () => retry ? retry() : start() });
  };

  SCREENS.main = el => {
    const p = L.phrases(S.name, ageN(), S.field);
    const learn = [['Как вас зову́т? — Меня́ зову́т…', 'Ismingiz nima? — Mening ismim…'], ['Мне 32 го́да. / Мне 30 лет.', 'Men 32 / 30 yoshdaman.'], [p[2].ru, p[2].uz]];
    el.innerHTML = `<div class="body">
      <div class="row">${domik('wave', 96, 'Domik salomlashmoqda')}<div class="grow"><div class="kicker b">72 DARSLIK KURSDAN NAMUNA DARS</div><p class="h1">Assalomu alaykum${S.name ? ', ' + firstName() : ''}!</p></div></div>
      <p class="lead">Rus tilida oʻzingizni tanishtiring · <b>≈15 daqiqa</b></p>
      <div class="card"><div class="kicker">BUGUN OʻRGANASIZ</div>${learn.map(([r, u]) => `<div><div lang="ru" class="ru">${r}</div><div class="sub">${esc(u)}</div></div>`).join('')}</div>
      <div class="card" style="background:var(--yellowl)"><div class="row">${domik('talk', 48)}<p class="lead" style="color:var(--ink)">Oxirida shu 3 gapni <b>oʻz ovozingiz bilan</b> aytasiz — birinchi ruscha tanishuvingiz!</p></div></div>
    </div>${bar('<button class="btn" data-start>Darsni boshlash</button>')}`;
    wire(el, { '[data-start]': () => { local.seenMain = true; save(); go('video', {}, { replace: true }); } });
  };

  SCREENS.hub = el => {
    const st = S.steps, next = nextStep(), done = Object.values(st).filter(Boolean).length;
    const a = S.answers || {}, hw = a.homework || {}, g = a.game || {};
    const row = (k, n, title, sub, ic, bg) => {
      const state = st[k] ? 'done' : next === k ? 'now' : '';
      return `<button class="step ${state}" data-step="${k}"><span class="n">${n}</span><span class="ic" style="background:${st[k] ? 'var(--greenl)' : bg}">${st[k] ? ICON.check('#087A4A', 22) : ic}</span><span class="grow"><span class="t" style="display:block">${title}</span><span class="s">${esc(sub)}</span></span>${state === 'now' ? '<span class="chip">Hozir</span>' : ICON.chev()}</button>`;
    };
    const finished = S.finished;
    el.innerHTML = `<div class="body">
      <div class="row" style="justify-content:space-between"><div><div class="kicker b">${finished ? 'NAMUNA DARS TUGATILDI' : '72 DARSLIK KURSDAN NAMUNA DARS'}</div><p class="h2">${finished ? 'Xush kelibsiz' + (S.name ? ', ' + firstName() : '') + '!' : 'Oʻzingizni tanishtiring'}</p></div><span class="chip ${finished ? 'green' : ''}">${done}/4</span></div>
      ${S.requested ? `<div class="card" style="background:var(--greenl)"><div class="row">${ICON.phone('#087A4A')}<span class="sub" style="color:var(--greend)">Soʻrovingiz qabul qilindi · ${advisor()} bogʻlanadi</span></div></div>` : ''}
      ${row('video', 1, 'Video dars', st.video ? `Koʻrildi${a.videoPercent ? ' ' + a.videoPercent + '%' : ''}` : 'Ustoz bilan tanishuv', ICON.video(), 'var(--bluel)')}
      ${row('homework', 2, 'Uy vazifasi', st.homework ? `${hw.correct ?? 5} / ${hw.total ?? 5}` : '5 ta mashq · ≈3 daq', ICON.hw(), 'var(--bluel)')}
      ${row('game', 3, '2 ta oʻyin', st.game ? `Ish suhbati ${g.dialog ?? 4}/4 · juftlar ${g.pairs ?? 6}/6` : 'Ish suhbati + juftlar · ≈3 daq', ICON.game(), 'var(--violetl)')}
      ${row('voice', 4, st.voice ? 'Oʻzingiz gapirdingiz' : 'Oʻzingiz gapiring', st.voice ? (a.voice?.score != null ? a.voice.score + '% aniq' : 'ovoz yozildi') : 'Ovozingizni yozasiz · ≈1 daq', ICON.mic('#B34700', 22), 'var(--orangel)')}
      <button class="step ${finished ? '' : 'lock'}" data-result><span class="n">★</span><span class="ic" style="background:${finished ? 'var(--yellowl)' : '#EEF1F7'}">${finished ? ICON.star() : ICON.lock()}</span><span class="grow"><span class="t" style="display:block">Natija va ovozingiz</span><span class="s">${finished ? 'Ochiq · natijangizni koʻring' : '4 qadamdan keyin ochiladi'}</span></span>${finished ? ICON.chev() : ''}</button>
      <button class="step" data-res><span class="n"></span><span class="ic" style="background:var(--yellowl)">${domik('read', 40)}</span><span class="grow"><span class="t" style="display:block">Foydali materiallar</span><span class="s">40 gap audio, qoʻllanmalar</span></span>${ICON.chev()}</button>
      <div class="kicker" style="margin-top:4px">KURSDA SIZNI KUTMOQDA · YANA 71 DARS</div>
      <div class="teasers">${L.TEASERS.map(t => `<button class="teaser" data-lock="${t.n}"><span class="row" style="gap:6px">${ICON.lock('#5B6478', 14)}<span class="sub">${t.n}-dars</span></span><span style="font-size:14px;font-weight:800">${esc(t.title)}</span></button>`).join('')}</div>
    </div>${bar((next ? `<button class="btn" data-next>Davom etish: ${STEP_TITLE[next]}</button>` : `<button class="btn" data-result>Natijamni koʻrish</button>`) + (S.requested ? '' : '<button class="btn sec" data-contact>Menejer bilan bogʻlanish</button>'))}`;
    wire(el, {
      '[data-step]': (e, b) => go(STEP_SCREEN[b.dataset.step]),
      '[data-next]': () => go(STEP_SCREEN[next]),
      '[data-result]': () => finished || !next ? go('result') : haptic(),
      '[data-res]': () => go('resources'),
      '[data-lock]': (e, b) => go('locked', { n: Number(b.dataset.lock) }),
      '[data-contact]': () => go('contact')
    });
  };

  // Video — namuna dars, 2 qism (YouTube). Har qism uchun ko'rilgan foiz alohida; jami foiz — o'rtachasi.
  const ytId = u => (/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/.exec(u || '') || [])[1] || '';
  SCREENS.video = (el, { part = null }) => {
    const parts = (S.videos || []).filter(v => v && v.url);
    const seen = (local.videoSeen = (local.videoSeen || []).slice(0, parts.length));
    parts.forEach((_, i) => { seen[i] = seen[i] || 0; });
    const total = () => parts.length ? Math.round(seen.reduce((a, b) => a + b, 0) / parts.length) : 0;
    let cur = part ?? (seen[0] >= 95 && parts.length > 1 ? 1 : 0), sent = S.steps.video;
    const tabs = () => parts.length > 1 ? `<div class="row" role="tablist" style="gap:8px">${parts.map((p, i) => `<button role="tab" aria-selected="${i === cur}" class="step ${i === cur ? 'now' : ''}" style="padding:8px 10px;gap:8px" data-part="${i}"><span class="ic" style="width:36px;height:36px;border-radius:12px;background:${seen[i] >= 80 ? 'var(--greenl)' : 'var(--bluel)'}">${seen[i] >= 80 ? ICON.check('#087A4A', 18) : ICON.play('#2F5BFF', 14)}</span><span class="grow"><span class="t" style="display:block;font-size:14px">${i + 1}-qism${p.dur ? ' · ' + esc(p.dur) : ''}</span><span class="s">${esc(p.title || '')}${seen[i] ? ' · ' + seen[i] + '%' : ''}</span></span></button>`).join('')}</div>` : '';
    const player = () => {
      const p = parts[cur], yt = p && ytId(p.url);
      if (!p) return `<div class="placeholder">${domik('teacher', 72)}<b>Video tez orada joylanadi</b><span class="sub" style="color:#C8CFDC">Hozircha quyidagi konspektni oʻqib, iboralarni tinglang</span></div>`;
      return yt ? `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(location.origin)}" title="Namuna dars, ${cur + 1}-qism" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen style="width:100%;height:100%;border:0;display:block"></iframe>`
        : `<video src="${esc(p.url)}" controls playsinline preload="metadata"></video>`;
    };
    const note = () => !parts.length || S.steps.video || sent ? '' : cur === 0 && seen[0] >= 95 && parts.length > 1 ? '1-qism tugadi — endi 2-qismni koʻring 👆' : 'Videoni oxirigacha koʻring — mashqlar shunga tayanadi';
    el.innerHTML = `<div class="body">${backLink()}
      <div class="row" style="justify-content:space-between"><div><div class="kicker b">NAMUNA DARS · VIDEO</div><p class="h2" lang="ru">Меня́ зову́т…</p></div><span class="chip ${S.steps.video ? 'green' : ''}">${S.steps.video ? 'Koʻrildi ✓' : parts.length > 1 ? parts.length + ' qism' : 'Video'}</span></div>
      <div class="video" data-player>${player()}</div>
      <div data-tabs>${tabs()}</div>
      <div class="card konspekt"><div class="row" style="justify-content:space-between"><b>Konspekt</b><span class="sub">4 ibora${canSpeak() ? ' · audio' : ''}</span></div>
        ${L.KONSPEKT.map(k => `<div class="item"><div class="grow"><div lang="ru" style="font-size:16px;font-weight:800">${k.ru}</div><div class="sub">${esc(k.uz)}</div></div>${spkBtn(k.ru)}</div>`).join('')}</div>
      <div class="card"><div class="kicker">SOʻZLAR · BOSING — TINGLANG</div><div class="words">${L.VOCAB.map(([r, u]) => `<button class="word" style="font-size:15px;min-height:44px;display:flex;flex-direction:column;justify-content:center" data-say="${esc(r)}"><span lang="ru">${r}</span><span class="sub" style="font-size:12px">${esc(u)}</span></button>`).join('')}</div></div>
    </div>${bar(`<div class="note" data-vnote>${note()}</div><button class="btn" data-next>Vazifaga oʻtish</button>`)}`;
    wireSay(el); wire(el, {});
    const redrawTabs = () => {
      el.querySelector('[data-tabs]').innerHTML = tabs();
      el.querySelectorAll('[data-part]').forEach(b => b.onclick = () => { const i = Number(b.dataset.part); if (i === cur) return; cur = i; haptic(); el.querySelector('[data-player]').innerHTML = player(); hook(); redrawTabs(); });
      const n = el.querySelector('[data-vnote]'); if (n) n.textContent = sent || S.steps.video ? 'Video koʻrildi ✓' : note();
    };
    let lastSave = 0, ytDur = 0;
    const progress = (t, dur) => {
      if (!dur) return;
      const p = Math.min(100, Math.round(t / dur * 100)), before = seen[cur];
      if (p > seen[cur] && p - seen[cur] < 15) seen[cur] = p; // oldinga sakrash hisoblanmaydi
      if (seen[cur] !== before && (Date.now() - lastSave > 3000 || seen[cur] >= 95)) { lastSave = Date.now(); save(); redrawTabs(); }
      if (!sent && total() >= 80) { sent = true; save(); track('video', { percent: total() }); haptic('ok'); redrawTabs(); }
    };
    let unhook = null;
    function hook() {
      if (unhook) unhook(); ytDur = 0;
      const v = el.querySelector('[data-player] video'), frame = el.querySelector('[data-player] iframe');
      if (v) { const f = () => progress(v.currentTime, v.duration); v.addEventListener('timeupdate', f); unhook = () => v.removeEventListener('timeupdate', f); }
      if (frame) {
        // YouTube pleyeri postMessage orqali vaqtni yuboradi (iframe_api skriptisiz).
        const listen = () => { try { frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch { /* */ } };
        frame.addEventListener('load', listen); const iv = setInterval(listen, 3000);
        const onMsg = e => {
          if (e.source !== frame.contentWindow || !/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
          let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
          const info = d && d.info; if (!info) return;
          if (info.duration) ytDur = info.duration;
          if (typeof info.currentTime === 'number') progress(info.currentTime, ytDur);
        };
        window.addEventListener('message', onMsg);
        unhook = () => { clearInterval(iv); window.removeEventListener('message', onMsg); };
      }
    }
    hook(); redrawTabs();
    timers.push({ off: () => unhook && unhook() });
    el.querySelector('[data-next]').onclick = async () => {
      if (!parts.length && !S.steps.video) await track('video', { percent: 100, noVideo: true });
      else if (parts.length && !sent && total() > 0) track('video', { percent: total() });
      go('hw', {}, { replace: true });
    };
  };

  // Uy vazifasi — 5 mashq
  SCREENS.hw = (el, { i = 0, results = [] }) => {
    const list = L.homework(S.field), ex = list[i];
    let chosen = null, built = [];
    const draw = () => {
      let task = '';
      if (ex.kind === 'pick') {
        task = `<div class="card">${ex.prompt.ru ? `<div class="row"><div lang="ru" class="ru grow" style="font-size:22px">${ex.prompt.ru}</div>${spkBtn(ex.prompt.ru)}</div>` : `<div style="font-size:20px;font-weight:800">${esc(ex.prompt.uz)}</div>`}</div>
          <div class="opts" role="radiogroup">${ex.options.map((o, k) => optHtml(o, k, ex.ruOptions)).join('')}</div>`;
      } else if (ex.kind === 'gap') {
        const fill = chosen === null ? '<span class="gap">&nbsp;</span>' : `<span class="gap">${ex.options[chosen]}</span>`;
        task = `<div class="card"><div lang="ru" style="font-size:22px;font-weight:800">${ex.before}${fill}${ex.after}</div><div class="sub">${esc(ex.uz)}</div></div>
          <div class="opts" role="radiogroup">${ex.options.map((o, k) => optHtml(o, k, true)).join('')}</div>`;
      } else {
        const pool = ex.words.map((w, k) => `<button class="word ${built.includes(k) ? 'used' : ''}" lang="ru" data-w="${k}" ${chosen !== null ? 'disabled' : ''}>${w}</button>`).join('');
        task = `<div class="card"><div style="font-size:17px;font-weight:800">${esc(ex.uz)}</div></div>
          <div class="slot" aria-label="Sizning gapingiz">${built.length ? built.map((k, j) => `<button class="word" lang="ru" data-u="${j}" ${chosen !== null ? 'disabled' : ''}>${ex.words[k]}</button>`).join('') : '<span class="sub">Soʻzlarni bosing</span>'}</div>
          <div class="words">${pool}</div>`;
      }
      const ok = chosen !== null && isRight();
      el.innerHTML = `${top('Uy vazifasi · ' + ['test', 'boʻsh joy', 'test', 'boʻsh joy', 'gap tuzish'][i], i + 1, list.length)}<div class="body">${backLink()}<p class="h2">${esc(ex.title)}</p>${task}</div>
        ${chosen === null ? (ex.kind === 'build' ? bar(`<button class="btn" data-check ${built.length ? '' : 'disabled'}>Tekshirish</button>`) : '') : sheet(ok, ok ? ex.ok : ex.bad, ok ? 'Davom etish' : 'Tushundim, davom etish')}`;
      wireSay(el); wire(el, {
        '[data-opt]': (e, b) => { if (chosen !== null) return; chosen = Number(b.dataset.opt); answered(); },
        '[data-w]': (e, b) => { built.push(Number(b.dataset.w)); haptic(); draw(); },
        '[data-u]': (e, b) => { built.splice(Number(b.dataset.u), 1); draw(); },
        '[data-check]': () => { chosen = 0; answered(); },
        '[data-cont]': () => {
          const r = [...results, { ok: isRight(), topic: ex.topic || '', skill: ex.skill || '' }];
          if (i + 1 < list.length) go('hw', { i: i + 1, results: r }, { replace: true });
          else finishHw(r);
        }
      });
    };
    const isRight = () => ex.kind === 'build' ? built.map(k => ex.words[k]).join(' ') === ex.answer.join(' ') : chosen === ex.answer;
    const answered = () => { haptic(isRight() ? 'ok' : 'bad'); draw(); };
    function optHtml(o, k, ru) {
      let cls = '', mark = '';
      if (chosen !== null) {
        if (k === chosen) { cls = isRight() ? 'ok' : 'bad'; mark = isRight() ? ICON.check() : ICON.cross(); }
        else if (k === ex.answer && !isRight()) { cls = 'hint'; mark = '<span class="sub" style="color:var(--greend)">toʻgʻrisi</span>'; }
      }
      return `<button class="opt ${cls}" role="radio" aria-checked="${k === chosen}" data-opt="${k}" ${chosen !== null ? 'disabled' : ''}><span class="grow" ${ru ? 'lang="ru"' : ''}>${ru ? o : esc(o)}</span>${mark}</button>`;
    }
    draw();
  };
  function sheet(ok, [title, why], btn) {
    return `<section class="sheet ${ok ? 'ok' : 'bad'}" role="status"><div class="row">${domik(ok ? 'check' : 'think', 60, ok ? 'Domik: toʻgʻri' : 'Domik oʻylanmoqda')}<div class="grow"><div class="title">${title}</div><div class="sub" style="color:inherit">${ok ? 'Toʻgʻri javob' : 'Toʻgʻri javobni eslab qoling'}</div></div></div><div class="why">${why}</div><button class="btn" data-cont>${btn}</button></section>`;
  }
  async function finishHw(results) {
    const correct = results.filter(r => r.ok).length, wrong = results.filter(r => !r.ok && r.topic).map(r => ({ topic: r.topic, skill: r.skill }));
    local.hwWrong = wrong; save();
    await track('homework', { done: true, correct, total: results.length });
    go('hwDone', { correct, total: results.length, wrong }, { replace: true });
  }
  SCREENS.hwDone = (el, { correct, total, wrong }) => {
    el.innerHTML = `<div class="body center">${domik(correct >= 4 ? 'trophy' : 'check', 150, 'Domik')}<p class="h1">Uy vazifasi bajarildi!</p>
      <p class="lead">${total} ta mashqdan <b style="color:var(--greend)">${correct} tasi toʻgʻri</b></p>
      ${wrong.length ? `<div class="card" style="text-align:left"><span class="sub">${wrong.length} ta xato: ${wrong.map(w => `<b lang="ru">${w.topic}</b>`).join(', ')} — natijada eslatamiz</span></div>` : ''}
      <p class="lead">Keyingisi — oʻyinlar! Birinchisida haqiqiy ish suhbatidan oʻtasiz.</p></div>${bar('<button class="btn" data-next>Oʻyinlarga oʻtish</button>')}`;
    if (correct >= 4) confetti(el);
    wire(el, { '[data-next]': () => go('dialog', {}, { replace: true }) });
  };

  // O'yin 1 — ish suhbati
  SCREENS.dialog = (el, { i = 0, log = [], firstTry = 0, textMode = false }) => {
    const D = L.dialog(S.name, ageN(), S.field), q = D.questions[i], LIMIT = 25;
    let left = LIMIT, chosen = null, outcome = null, tries = 0;
    const hist = log.map(h => `<div class="hr"><div class="av">${domik('brief', 30)}</div><div class="bub"><span lang="ru" style="font-size:16px;font-weight:800">${h.q}</span></div></div><div class="me" lang="ru">${h.a} ${ICON.check('#fff', 14)}</div>`).join('');
    const voiceQ = q.voice && !textMode && recorder.supported();
    const draw = () => {
      const opts = voiceQ ? '' : `<div class="opts">${q.options.map((o, k) => {
        let cls = ''; if (chosen === k) cls = outcome === 'ok' ? 'ok' : 'bad'; if (outcome === 'timeout' && k === q.answer) cls = 'hint';
        return `<button class="opt ${cls}" style="min-height:52px;font-size:17px" data-o="${k}" ${outcome === 'ok' || outcome === 'timeout' ? 'disabled' : ''}><span lang="ru" class="grow">${o}</span>${cls === 'ok' ? ICON.check() : cls === 'bad' ? ICON.cross() : ''}</button>`;
      }).join('')}</div>`;
      const voiceBox = voiceQ ? `<div class="card" style="align-items:center;text-align:center"><div lang="ru" class="ru">${q.voice.ru}</div><div class="sub" style="color:var(--blued)">${esc(q.voice.lat)}</div>
        <button class="mic ${recorder.active ? 'rec' : ''}" data-rec aria-label="${recorder.active ? 'Toʻxtatish' : 'Bosing va ayting'}">${recorder.active ? ICON.stop() : ICON.mic()}</button>
        <span class="sub">${recorder.active ? 'Yozilmoqda… yana bosib toʻxtating' : 'Bosing va ayting · yana bosib toʻxtating'}</span>
        <button class="btn ghost" data-text>Matn bilan javob berish</button></div>` : '';
      let footer = '';
      if (outcome === 'near' || outcome === 'bad') footer = sheet(false, [outcome === 'near' ? 'Deyarli!' : 'Hech qisi yoʻq!', (outcome === 'near' ? 'HR sizni tushundi, lekin bitta harf yetmadi. ' : '') + q.why], 'Qayta javob berish');
      else if (outcome === 'timeout') footer = sheet(false, ['Vaqt tugadi', 'Toʻgʻri javob belgilandi: <span lang="ru">' + q.options[q.answer] + '</span>'], 'Davom etish');
      el.innerHTML = `<div class="top"><div class="kicker v">OʻYIN 1 · ISH SUHBATI</div><div class="row" style="justify-content:space-between"><span class="sub">Savol ${i + 1}/4${voiceQ ? ' · endi ovoz bilan!' : ''}</span>${voiceQ ? '' : `<span class="timer ${left <= 8 ? 'low' : ''}" role="timer" aria-label="${left} soniya qoldi">${ICON.clock(left <= 8 ? '#8A3600' : '#5A2FD6')}${left} s</span>`}</div></div>
        <div class="body">${backLink()}<div class="sub">HR-menejer · ${esc(D.hr)}</div><div class="chat">${hist}
          <div class="hr"><div class="av">${domik('brief', 30)}</div><div class="bub"><span lang="ru" style="font-size:16px;font-weight:800">${q.q}</span><span class="sub" style="font-weight:600">${esc(q.uz)}</span></div>${spkBtn(q.q)}</div></div>
          ${voiceBox}${opts}</div>${footer}`;
      wireSay(el); wire(el, {
        '[data-o]': (e, b) => { if (outcome === 'ok' || outcome === 'timeout') return; pick(Number(b.dataset.o)); },
        '[data-cont]': () => outcome === 'timeout' ? advance(q.options[q.answer], false) : (outcome = null, chosen = null, draw()),
        '[data-text]': () => go('dialog', { i, log, firstTry, textMode: true }, { replace: true }),
        '[data-rec]': () => recordAnswer()
      });
    };
    function pick(k) {
      chosen = k; tries++;
      if (k === q.answer) { outcome = 'ok'; haptic('ok'); draw(); later(() => advance(q.options[k], tries === 1), 650); }
      else { outcome = k === q.near ? 'near' : 'bad'; haptic('bad'); draw(); }
    }
    function advance(answer, first) {
      const nlog = [...log, { q: q.q, a: answer }], nfirst = firstTry + (first ? 1 : 0);
      if (i + 1 < D.questions.length) go('dialog', { i: i + 1, log: nlog, firstTry: nfirst }, { replace: true });
      else { local.dialog = nfirst; save(); go('pairs', {}, { replace: true }); }
    }
    async function recordAnswer() {
      if (!recorder.active) {
        const r = await recorder.start(12000, () => draw());
        if (r === 'denied' || r === 'unsupported') return go('dialog', { i, log, firstTry, textMode: true }, { replace: true });
        return draw();
      }
      const blob = await recorder.stop();
      el.innerHTML = `<div class="body center">${domik('think', 120)}<p class="h2">Domik tinglayapti…</p></div>`;
      const res = await sendVoice(blob, q.voice.ru, { practice: true });
      if (res && res.level !== 'retry') { haptic('ok'); advance(q.voice.ru, true); }
      else go('voiceFail', { retry: () => go('dialog', { i, log, firstTry }, { replace: true }), text: () => go('dialog', { i, log, firstTry, textMode: true }, { replace: true }), phrase: q.voice });
    }
    if (!voiceQ) every(() => {
      if (outcome === 'ok' || outcome === 'timeout' || outcome === 'near' || outcome === 'bad') return;
      left--; if (left <= 0) { outcome = 'timeout'; haptic('bad'); } draw();
    }, 1000);
    draw();
  };
  SCREENS.voiceFail = (el, { retry, text, phrase }) => {
    el.innerHTML = `<div class="body center">${domik('sad', 130, 'Domik')}<p class="h2">Ovozingiz eshitilmadi</p><p class="lead">Mikrofon yopiq yoki juda past. Muammo yoʻq — javobni tanlab ham berishingiz mumkin, ball saqlanadi.</p>
      <div class="card"><div lang="ru" class="ru">${phrase.ru}</div><div class="sub" style="color:var(--blued)">${esc(phrase.lat)}</div></div></div>${bar('<button class="btn" data-text>Matn bilan javob berish</button><button class="btn sec" data-retry>Qayta gapirish</button>')}`;
    wire(el, { '[data-text]': text, '[data-retry]': retry });
  };

  // O'yin 2 — juftlar (60 s)
  SCREENS.pairs = (el, { untimed = false }) => {
    const LIMIT = 60, pairs = L.PAIRS;
    const tiles = shuffle(pairs.flatMap((p, k) => [{ k, side: 'ru', text: p.ru, audio: !!p.audio }, { k, side: 'uz', text: p.uz }]));
    let sel = null, found = new Set(), just = null, combo = 0, best = 0, left = LIMIT, startedAt = Date.now(), over = false, feedback = '';
    const draw = () => {
      el.innerHTML = `<div class="top"><div class="kicker v">OʻYIN 2 · ${untimed ? 'VAQTSIZ' : '1 DAQIQA'}</div><div class="row" style="gap:12px"><div class="prog green grow" role="progressbar" aria-label="${pairs.length} juftlikdan ${found.size} tasi topildi" aria-valuenow="${found.size}" aria-valuemin="0" aria-valuemax="${pairs.length}" style="height:12px"><i style="width:${Math.round(found.size * 100 / pairs.length)}%"></i></div>${untimed ? '' : `<span class="timer ${left <= 10 ? 'low' : ''}" role="timer">${ICON.clock(left <= 10 ? '#8A3600' : '#5A2FD6')}0:${String(left).padStart(2, '0')}</span>`}</div></div>
        <div class="body">${backLink()}<div class="row" style="justify-content:space-between"><p class="h2">Juftlarini toping</p>${combo > 1 ? `<span class="chip violet">kombo ×${combo}</span>` : ''}</div>
        <div class="grid">${tiles.map((t, idx) => {
          const st = found.has(t.k) ? (just === t.k ? 'just' : 'done') : sel === idx ? 'sel' : '';
          if (t.audio && !found.has(t.k)) return `<button class="tile audio ${st}" data-t="${idx}" aria-label="Audio karta: tinglang va tarjimasini toping">${ICON.spk()}tinglang</button>`;
          return `<button class="tile ${st}" data-t="${idx}" ${t.side === 'ru' ? 'lang="ru"' : ''} ${found.has(t.k) ? 'disabled' : ''}>${t.side === 'ru' ? t.text : esc(t.text)}${found.has(t.k) ? ' ✓' : ''}</button>`;
        }).join('')}</div>
        ${feedback ? `<div class="card" style="background:var(--greenl)"><span class="sub" style="color:var(--greend)">${feedback}</span></div>` : '<div class="sub" style="text-align:center">Koʻk karta — faqat ovoz: tinglab, tarjimasini toping.</div>'}
        </div>${bar('<button class="btn ghost" data-skip>Oʻtkazib yuborish</button>')}`;
      wire(el, { '[data-t]': (e, b) => tap(Number(b.dataset.t), b), '[data-skip]': () => end(false) });
    };
    function tap(idx, b) {
      if (over) return;
      const t = tiles[idx]; if (found.has(t.k)) return;
      if (t.audio) say(t.text);
      if (sel === null || tiles[sel].side === t.side) { sel = idx; haptic(); draw(); return; }
      const a = tiles[sel];
      if (a.k === t.k) {
        found.add(t.k); just = t.k; combo++; best = Math.max(best, combo); sel = null; haptic('ok');
        const p = pairs[t.k]; feedback = `«${['Zoʻr!', 'Qoyil!', 'Barakalla!'][found.size % 3]}» <span lang="ru">${p.ru}</span> — ${esc(p.uz)}`;
        if (!p.audio) say(p.ru);
        draw(); if (found.size === pairs.length) later(() => end(true), 700);
      } else {
        combo = 0; sel = null; haptic('bad'); b.classList.add('shake'); later(draw, 360);
      }
    }
    function end(won) {
      if (over) return; over = true; stopTimers();
      const time = Math.round((Date.now() - startedAt) / 1000);
      const result = { pairs: found.size, total: pairs.length, time, combo: best, won };
      local.pairs = result; save();
      track('game', { done: true, score: (local.dialog ?? 0) + found.size, time, won });
      if (won || untimed) go('gameWin', result, { replace: true });
      else go('gameTimeout', { ...result, missing: pairs.filter((p, k) => !found.has(k)) }, { replace: true });
    }
    if (!untimed) every(() => { left--; if (left <= 0) end(false); else draw(); }, 1000);
    draw();
  };
  SCREENS.gameWin = (el, r) => {
    el.innerHTML = `<div class="body center">${domik('party', 150, 'Domik bayram qilmoqda')}<p class="h1">Qoyil!</p><p class="lead">Ikkala oʻyin ham bajarildi</p>
      <div class="tiles" style="grid-template-columns:1fr 1fr;width:100%"><div class="stat"><span class="sub">Ish suhbati</span><b>${local.dialog ?? 0} / 4</b><span class="sub">birinchi urinishda</span></div><div class="stat"><span class="sub">Juftlar</span><b>${r.pairs} / ${r.total}</b><span class="sub">${r.time} soniyada${r.combo > 1 ? ' · kombo ×' + r.combo : ''}</span></div></div></div>
      ${bar('<button class="btn" data-next>Endi oʻzingiz gapiring</button><button class="btn sec" data-again>Qayta oʻynash</button>')}`;
    confetti(el); say('Отли́чно! Молоде́ц!');
    wire(el, { '[data-next]': () => go('speak', {}, { replace: true }), '[data-again]': () => go('dialog', {}, { replace: true }) });
  };
  SCREENS.gameTimeout = (el, r) => {
    el.innerHTML = `<div class="body center">${domik('think', 140, 'Domik')}<p class="h1">Vaqt tugadi</p><p class="lead">${r.total} juftlikdan <b>${r.pairs} tasini</b> topdingiz — yomon emas!</p>
      <div class="card" style="text-align:left;width:100%"><div class="kicker">TOPILMAGANLAR</div>${r.missing.map(p => `<div class="row"><span lang="ru" class="ru grow">${p.ru}</span><span class="sub">— ${esc(p.uz)}</span>${spkBtn(p.ru)}</div>`).join('')}</div></div>
      ${bar('<button class="btn" data-next>Keyingi qadam</button><button class="btn sec" data-again>Vaqtsiz qayta oʻynash</button>')}`;
    wireSay(el); wire(el, { '[data-next]': () => go('speak', {}, { replace: true }), '[data-again]': () => go('pairs', { untimed: true }, { replace: true }) });
  };

  // O'zingiz gapiring
  SCREENS.speak = el => {
    const draw = () => {
      const p = L.phrases(S.name, ageN(), S.field);
      el.innerHTML = `<div class="body">${backLink()}<div class="row">${domik('talk', 64)}<div class="grow"><p class="h2">Endi oʻzingiz ayting!</p><p class="lead">${recorder.active ? 'Ekrandagi 3 gapni ovoz chiqarib oʻqing' : 'Avval ustozni tinglang, keyin 3 gapni ayting'}</p></div></div>
        ${spkBtn(p.map(x => x.ru).join(' '), 'Ustoz namunasi') ? `<div>${spkBtn(p.map(x => x.ru).join(' '), 'Ustoz namunasi')}</div>` : ''}
        ${p.map(x => `<div class="phr"><span lang="ru" style="font-size:19px;font-weight:800">${x.ru}</span><span class="lat">${esc(x.lat)}</span><span class="uz">${esc(x.uz)}</span></div>`).join('')}
        ${recorder.active ? '' : `<div class="row" style="justify-content:center;gap:8px"><span class="sub">Yoshingiz:</span><button class="spk" data-age="-1" aria-label="Yoshni kamaytirish">−</button><b style="min-width:28px;text-align:center">${ageN()}</b><button class="spk" data-age="1" aria-label="Yoshni oshirish">+</button></div>`}
        <button class="mic ${recorder.active ? 'rec' : ''}" data-rec aria-label="${recorder.active ? 'Toʻxtatish' : 'Bosing va gapiring'}">${recorder.active ? ICON.stop() : ICON.mic()}</button>
        <div class="note">${recorder.active ? `Yozilmoqda · <span data-sec>0:00</span> · yana bosib toʻxtating` : 'Bosing, gapiring, yana bosib toʻxtating.'}<br>Yozuv sizga va menejeringizga eshitiladi.</div>
      </div>`;
      wireSay(el); wire(el, {
        '[data-age]': (e, b) => { local.age = Math.max(16, Math.min(80, ageN() + Number(b.dataset.age))); save(); haptic(); draw(); },
        '[data-rec]': toggle
      });
    };
    async function toggle() {
      if (!recorder.active) {
        const r = await recorder.start(25000, () => toggle());
        if (r === 'denied' || r === 'unsupported') return go('micDenied', { reason: r }, { replace: true });
        const t0 = Date.now(); every(() => { const s = Math.floor((Date.now() - t0) / 1000); const n = el.querySelector('[data-sec]'); if (n) n.textContent = `0:${String(s).padStart(2, '0')}`; }, 500);
        return draw();
      }
      const blob = await recorder.stop();
      if (!blob || !blob.size) return go('speakRetry', {}, { replace: true });
      go('speakCheck', { blob }, { replace: true });
    }
    draw();
  };
  SCREENS.speakCheck = async (el, { blob }) => {
    el.innerHTML = `<div class="body center">${domik('think', 140, 'Domik tinglayapti')}<p class="h2 listen">Domik tinglayapti…</p><p class="lead">3 ta gapingiz tekshirilmoqda. Odatda 2–5 soniya.</p></div>`;
    const p = L.phrases(S.name, ageN(), S.field);
    const res = await sendVoice(blob, p.map(x => x.ru).join(' '), { skip: [L.cyr(S.name)] });
    if (!res) return go('error', { retry: () => go('speakCheck', { blob }, { replace: true }) }, { replace: true });
    if (res.level === 'retry') return go('speakRetry', {}, { replace: true });
    try { if (voiceUrl) URL.revokeObjectURL(voiceUrl); } catch { /* */ }
    voiceUrl = URL.createObjectURL(blob); local.voiceResult = { score: res.score, level: res.level, words: res.words }; save();
    go('speakDone', { res, phrases: p }, { replace: true });
  };
  let voiceUrl = null; // o'z ovozi — faqat shu sessiyada (blob URL saqlanmaydi)
  async function sendVoice(blob, expected, { practice = false, skip = [] } = {}) {
    const q = '?expected=' + encodeURIComponent(expected) + skip.filter(Boolean).map(s => '&skip=' + encodeURIComponent(s)).join('') + (practice ? '&practice=1' : '');
    try { const r = await api('/voice', null, { raw: blob, query: q }); if (r.state) S = { ...S, ...r.state }; return r; }
    catch { return null; }
  }
  SCREENS.speakRetry = el => {
    el.innerHTML = `<div class="body center">${domik('sad', 140, 'Domik')}<p class="h2">Ovozingiz eshitilmadi</p><p class="lead">Telefonni ogʻzingizga yaqinroq tuting va 3 gapni balandroq, shoshilmasdan ayting.</p><div class="card"><span class="sub">Maslahat: avval «Ustoz namunasi»ni tinglang, keyin takrorlang.</span></div></div>${bar('<button class="btn" data-again>Qayta yozish</button>')}`;
    wire(el, { '[data-again]': () => go('speak', {}, { replace: true }) });
  };
  SCREENS.speakDone = (el, { res, phrases }) => {
    const scored = res.level !== 'unscored';
    const words = res.words || [], norm = s => noStress(s).toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
    const status = phrases.map(ph => {
      const ws = norm(ph.ru).map(w => words.find(x => x.word === w)).filter(Boolean);
      const miss = ws.filter(x => !x.ok);
      return { ph, ok: miss.length === 0, miss: miss.map(m => m.word) };
    });
    const okCount = status.filter(s => s.ok).length;
    el.innerHTML = `<div class="body center">${domik('party', 130, 'Domik bayram qilmoqda')}<p class="h1">Siz rus tilida gapirdingiz!</p>
      <p class="lead">${scored ? (okCount === 3 ? 'Uchala gap ham aniq eshitildi!' : `${okCount} tasi aniq, ${3 - okCount} tasida soʻz aniq eshitilmadi`) : 'Ovozingiz saqlandi — tinglab koʻring'}</p>
      ${scored ? status.map(s => `<div class="phr ${s.ok ? 'ok' : 'warn'}" style="width:100%;text-align:left"><span class="row"><span lang="ru" class="ru grow">${s.ph.ru}</span>${s.ok ? ICON.check('#087A4A', 18) : '!'}</span>${s.ok ? '' : `<span class="sub" style="color:#7A5300">«<span lang="ru">${s.miss.join(', ')}</span>» aniq eshitilmadi — sekinroq qayta ayting</span>`}</div>`).join('') : ''}
      ${playerHtml('Sizning ovozingiz', 'my')}</div>
      ${bar('<button class="btn" data-next>Natijamni koʻrish</button><button class="btn sec" data-again>Qayta yozish</button>')}`;
    confetti(el); haptic('ok');
    wirePlayer(el, 'my', voiceUrl);
    wire(el, { '[data-next]': () => go('result', {}, { replace: true }), '[data-again]': () => go('speak', {}, { replace: true }) });
  };
  SCREENS.micDenied = (el, { reason }) => {
    const p = L.phrases(S.name, ageN(), S.field);
    el.innerHTML = `<div class="body">${domik('shield', 110)}<p class="h2">${reason === 'unsupported' ? 'Bu qurilmada yozib boʻlmadi' : 'Mikrofon yopiq'}</p>
      <p class="lead">${reason === 'unsupported' ? 'Telegram ilovasini yangilang yoki' : 'Telegram mikrofonga ruxsat soʻradi, lekin ruxsat berilmadi. Muammo yoʻq —'} 3 gapni botga <b>ovozli xabar</b> qilib yuboring, menejer tinglaydi.</p>
      <div class="card"><div class="kicker">AYTADIGAN GAPLARINGIZ</div><div lang="ru" style="font-size:16px;font-weight:800;line-height:1.6">${p.map(x => x.ru).join('<br>')}</div></div>
      <p class="sub">iPhone: Sozlamalar → Telegram → Mikrofon · Android: Sozlamalar → Ilovalar → Telegram → Ruxsatlar.</p></div>
      ${bar('<button class="btn" data-bot>Botga ovozli xabar yuborish</button><button class="btn sec" data-again>Qayta urinish</button><button class="btn ghost" data-result>Natijaga oʻtish</button>')}`;
    wire(el, { '[data-bot]': () => { try { tg.close(); } catch { location.href = 'https://t.me/Domworkuz_bot'; } }, '[data-again]': () => go('speak', {}, { replace: true }), '[data-result]': () => go('result', {}, { replace: true }) });
  };

  // Natija
  SCREENS.result = el => {
    const a = S.answers || {}, hw = a.homework || {}, pr = local.pairs, vr = local.voiceResult || a.voice;
    const wrong = local.hwWrong || [];
    const strong = ['ism va yosh'];
    const work = (vr?.words || []).filter(w => !w.ok).map(w => '«<span lang="ru">' + w.word + '</span>»');
    const discount = S.discount ? `<div class="chip orange" style="align-self:center">${ICON.star('#B34700', 14)} Bot orqali kelganlarga −${S.discount.percent}% · ${new Date(S.discount.until).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' })}gacha</div>` : '';
    el.innerHTML = `<div class="body">${backLink()}<div class="row">${domik('trophy', 84, 'Domik kubok bilan')}<div class="grow"><p class="h1">${S.name ? firstName() + ', ' : ''}namuna dars tugadi!</p></div></div>
      <p class="lead">${S.steps.voice ? '3 ta gapni ovoz bilan aytdingiz' + (vr?.score != null ? ` — ${vr.score}% aniq` : '') : 'Ovozli mashq hali qoldi — xohlasangiz qayta urinib koʻring'}</p>
      <div class="tiles"><div class="stat"><b>${hw.correct ?? '—'}/${hw.total ?? 5}</b><span class="sub">vazifa</span></div><div class="stat"><b>${local.dialog ?? (S.steps.game ? '✓' : '—')}${local.dialog != null ? '/4' : ''}</b><span class="sub">ish suhbati</span></div><div class="stat"><b>${pr ? pr.pairs + '/' + pr.total : (S.steps.game ? '✓' : '—')}</b><span class="sub">juftlar${pr ? ' · ' + pr.time + ' s' : ''}</span></div></div>
      ${voiceUrl ? `<div class="card"><b>Sizning birinchi ruscha tanishuvingiz</b>${playerHtml('Sizning ovozingiz', 'my')}</div>` : ''}
      <div class="card"><span style="font-size:14px;font-weight:600;line-height:1.5"><b style="color:var(--greend)">Kuchli tomonlaringiz:</b> ${strong.join(', ')} — xatosiz.<br>
        ${wrong.length || work.length ? `<b style="color:var(--oranged)">Ustoz bilan ishlaymiz:</b> ${[...[...new Map(wrong.map(w => [w.skill, w])).values()].map(w => esc(w.skill) + ' (<span lang="ru">' + w.topic + '</span>)'), ...(work.length ? [work.slice(0, 2).join(', ') + 'ni aniq aytish'] : [])].join(' va ')}.` : '<b style="color:var(--greend)">Ajoyib boshlanish!</b> Keyingi darslarda tezroq gapirishni oʻrganasiz.'}</span>
        <span class="sub">Aniq darajangizni menejer suhbatda aytadi.</span></div>
      <div class="card" style="background:var(--bluel)"><div class="row">${domik('teacher', 56)}<div class="grow"><b>Keyingi qadam — jonli suhbat</b><div class="sub">Shaxsiy ustoz bilan shu suhbatni jonli gapirasiz — talaffuzni oʻsha zahoti tuzatadi.</div></div></div></div>
      ${discount}
    </div>${bar(S.requested ? '<button class="btn" data-home>Dars yoʻliga qaytish</button>' : `<button class="btn" data-call>${ICON.phone()}Menejer qoʻngʻiroq qilsin</button><button class="btn sec" data-tg>Telegramda yozishaylik</button>`)}`;
    if (voiceUrl) wirePlayer(el, 'my', voiceUrl);
    wire(el, { '[data-call]': () => go('contact'), '[data-tg]': () => sendRequest('telegram', 'now'), '[data-home]': home });
  };

  // Qo'ng'iroq so'rovi
  const promiseMin = () => Math.max(10, Number(S?.sales?.slaMinutes) || 10);
  SCREENS.contact = el => {
    const open = S.sales?.open;
    el.innerHTML = `<div class="body">${backLink()}<div class="row">${domik('phones', 80)}<div class="grow"><p class="h2">${advisor()}</p><p class="lead">sizga shaxsan qoʻngʻiroq qiladi</p></div></div>
      <div class="card"><span class="sub">5–10 daqiqalik suhbatda bilib olasiz:</span>${['Aniq darajangizni', 'Sohangiz uchun 3 ta asosiy mavzu', 'Sizga mos oʻqish rejasini'].map(t => `<div class="row">${ICON.check('#087A4A', 18)}<b>${t}</b></div>`).join('')}</div>
      <div class="card"><b>${S.hasPhone ? 'Shu raqamga qoʻngʻiroq qilaylikmi?' : 'Telegramdagi raqamingizni ulashing'}</b>${S.hasPhone ? `<div class="ru">${esc(S.phoneMasked)}</div>` : '<span class="sub">Bitta tugma — raqam Telegram orqali tasdiqlanadi.</span>'}
        <span class="sub">${open ? `~${promiseMin()} daqiqa ichida qoʻngʻiroq qilamiz` : 'Hozir ish vaqti emas — keyingi ish kunida qoʻngʻiroq qilamiz yoki vaqtni tanlang'}</span></div>
    </div>${bar(`<button class="btn green" data-yes>${ICON.phone()}${S.hasPhone ? 'Ha, qoʻngʻiroq qiling' : 'Raqamni ulashish va soʻrov'}</button><button class="btn sec" data-later>Boshqa vaqtda</button><button class="btn ghost" data-tg>Faqat Telegramda yozishaylik</button>`)}`;
    wire(el, { '[data-yes]': () => sendRequest('call', open ? 'now' : 'morn'), '[data-later]': () => go('later'), '[data-tg]': () => sendRequest('telegram', 'now') });
  };
  const WHEN = [['eve', 'Bugun kechqurun'], ['morn', 'Ertaga ertalab'], ['aft', 'Ertaga tushdan keyin'], ['wknd', 'Dam olish kuni']];
  SCREENS.later = el => {
    let pick = null;
    const draw = () => {
      el.innerHTML = `<div class="body">${backLink()}${domik('cal', 80)}<p class="h2">Qachon qoʻngʻiroq qilaylik?</p>
        <div class="opts">${WHEN.map(([k, l]) => `<button class="opt ${pick === k ? 'ok' : ''}" data-w="${k}" style="font-size:16px"><span class="grow">${l}</span>${pick === k ? ICON.check() : ''}</button>`).join('')}</div>
        <span class="sub">Tanlagan vaqtingizda qoʻngʻiroq qilamiz.</span></div>${bar(`<button class="btn" data-ok ${pick ? '' : 'disabled'}>${pick ? esc(WHEN.find(w => w[0] === pick)[1]) + ' — tasdiqlash' : 'Vaqtni tanlang'}</button>`)}`;
      wire(el, { '[data-w]': (e, b) => { pick = b.dataset.w; haptic(); draw(); }, '[data-ok]': () => pick && sendRequest('call', pick) });
    };
    draw();
  };
  let busy = false;
  async function sendRequest(method, when) {
    if (busy) return; busy = true;
    try {
      let r = await api('/request', { method, when });
      if (r.needPhone) {
        const shared = await askContact();
        if (!shared) { busy = false; S = { ...S, ...r.state }; return go('contact', {}, { replace: true }); }
        r = await waitPhoneAndRetry(method, when);
      }
      S = { ...S, ...r.state }; haptic('ok');
      go('done', { method, when }, { replace: true });
    } catch (e) {
      go('error', { offline: !!e.offline, message: e.message, retry: () => { stack.pop(); render(); } });
    } finally { busy = false; }
  }
  // Telegram raqamni botga yuboradi — bot uni qayta ishlagach (1–3 s) so'rovni takrorlaymiz.
  function askContact() {
    return new Promise(resolve => {
      try { if (!tg?.requestContact) return resolve(false); tg.requestContact(ok => resolve(!!ok)); }
      catch { resolve(false); }
    });
  }
  async function waitPhoneAndRetry(method, when) {
    for (let k = 0; k < 8; k++) {
      await new Promise(r => setTimeout(r, 1000));
      const st = await api('/state').catch(() => null);
      if (st?.hasPhone) return api('/request', { method, when });
    }
    return api('/request', { method, when });
  }
  SCREENS.done = (el, { method, when }) => {
    const label = (WHEN.find(w => w[0] === when) || [])[1];
    const tgOnly = method === 'telegram';
    el.innerHTML = `<div class="body center">${domik(tgOnly ? 'bubbles' : when === 'now' ? 'bell' : 'cal', 140, 'Domik')}<p class="h1">${when === 'now' ? 'Soʻrovingiz qabul qilindi!' : 'Kelishdik!'}</p>
      <p class="lead">${tgOnly ? `${advisor()} sizga shu Telegram chatida yozadi.` : when === 'now' && S.sales?.open ? `${advisor()} <b>~${promiseMin()} daqiqa</b> ichida ${S.phoneMasked ? esc(S.phoneMasked) + ' raqamiga' : 'sizga'} qoʻngʻiroq qiladi.` : `${advisor()} <b>${esc((label || 'ish vaqtida').toLowerCase())}</b> ${S.phoneMasked ? esc(S.phoneMasked) + ' raqamiga' : 'sizga'} qoʻngʻiroq qiladi.`}</p>
      <div class="card"><span class="sub">Menejer natijalaringizni koʻrib turadi. Suhbatdan keyin xohlasangiz, sizni ustoz bilan jonli sinov darsiga yozadi.</span></div></div>
      ${bar('<button class="btn" data-home>Darsga qaytish</button><button class="btn sec" data-res>Kutayotganda: foydali materiallar</button>')}`;
    confetti(el);
    wire(el, { '[data-home]': home, '[data-res]': () => go('resources') });
  };

  SCREENS.locked = (el, { n }) => {
    const t = L.TEASERS.find(x => x.n === n) || L.TEASERS[1];
    track('locked', {});
    el.innerHTML = `<div class="body">${backLink()}<div class="card" style="align-items:center;text-align:center">${ICON.lock('#5B6478', 28)}${t.ru ? `<div lang="ru" class="h2">${t.ru}</div>` : ''}<span class="chip">Kursda ochiladi</span></div>
      <div class="kicker b">72 DARSDAN ${t.n}-DARS</div><p class="h2">${esc(t.title)}</p>${t.result ? `<p class="lead">Natija: ${esc(t.result)}</p>` : ''}
      ${t.items ? `<div class="card"><div class="kicker">BU DARSDA</div>${t.items.map(x => `<div class="row">${ICON.check('#087A4A', 18)}<b>${esc(x)}</b></div>`).join('')}</div>` : ''}
      <div class="card"><span class="sub">Kurs: 72 dars, taxminan 3 oy — video darslar, shaxsiy ustoz bilan jonli darslar va har kuni ilovada mashq.</span></div></div>
      ${bar(`${S.requested ? '' : '<button class="btn" data-contact>Kurs haqida menejerdan bilish</button>'}<button class="btn sec" data-home>Darsga qaytish</button>`)}`;
    wire(el, { '[data-contact]': () => go('contact'), '[data-home]': home });
  };

  SCREENS.resources = el => {
    const item = (id, title, sub, ic) => `<div class="card"><div class="row">${domik(ic, 48)}<div class="grow"><b>${title}</b><div class="sub">${sub}</div></div></div><button class="btn sec" style="min-height:44px" data-send="${id}">${local['sent_' + id] ? 'Yuborildi ✓' : 'Botga yuborish'}</button></div>`;
    el.innerHTML = `<div class="body">${backLink()}<p class="h2">Foydali materiallar</p>
      ${item('sovga', '40 ta eng kerakli gap', 'Sovgʻangiz · PDF + audio', 'box')}
      ${item('qollanma', 'Sohangiz uchun qoʻllanma', 'Ishda kerak iboralar', 'brief')}
      <div class="card"><div class="kicker">OʻQUVCHILARIMIZ NATIJALARI</div><div class="row">${domik('crown', 48)}<div class="grow"><b>@domwork_natijalari</b><div class="sub">Telegram kanal · haqiqiy fikrlar</div></div><button class="btn sec" style="width:auto;min-height:44px" data-ch>Ochish</button></div></div>
    </div>${bar('<button class="btn" data-home>Darsga qaytish</button>')}`;
    wire(el, {
      '[data-send]': async (e, b) => {
        const id = b.dataset.send; b.disabled = true; b.textContent = 'Yuborilmoqda…';
        const r = await track('resource', { id, send: true });
        if (r?.sent) { local['sent_' + id] = true; save(); b.textContent = 'Yuborildi ✓'; haptic('ok'); }
        else { b.disabled = false; b.textContent = r ? 'Hozircha yoʻq' : 'Qayta urinish'; }
      },
      '[data-ch]': () => { track('resource', { id: 'channel' }); try { tg.openTelegramLink('https://t.me/domwork_natijalari'); } catch { location.href = 'https://t.me/domwork_natijalari'; } },
      '[data-home]': home
    });
  };

  // ── Audio pleyer (o'z ovozi) ───────────────────────────────────────────
  const playerHtml = (label, id) => `<div class="player" style="width:100%"><button class="pb" data-play="${id}" aria-label="Tinglash: ${esc(label)}">${ICON.play()}</button><div class="grow" style="display:flex;flex-direction:column;gap:5px;text-align:left"><b style="font-size:14px">${esc(label)}</b><div class="track"><i data-trk="${id}"></i></div></div><span class="sub" data-dur="${id}"></span></div>`;
  function wirePlayer(el, id, url) {
    const b = el.querySelector(`[data-play="${id}"]`); if (!b || !url) return;
    const a = new Audio(url), trk = el.querySelector(`[data-trk="${id}"]`), dur = el.querySelector(`[data-dur="${id}"]`);
    const fmt = s => isFinite(s) ? `0:${String(Math.round(s)).padStart(2, '0')}` : '';
    a.onloadedmetadata = () => { dur.textContent = fmt(a.duration); };
    a.ontimeupdate = () => { if (a.duration) trk.style.width = (a.currentTime / a.duration * 100) + '%'; };
    a.onended = () => { b.innerHTML = ICON.play(); trk.style.width = '0'; };
    b.onclick = () => { if (a.paused) { a.play().catch(() => { }); b.innerHTML = ICON.pause(); } else { a.pause(); b.innerHTML = ICON.play(); } };
  }

  // ── Ovoz yozish ────────────────────────────────────────────────────────
  const recorder = {
    active: false, rec: null, chunks: [], stream: null, timeout: null, resolveStop: null,
    supported: () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder),
    async start(maxMs, onAuto) {
      if (!this.supported()) return 'unsupported';
      try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (e) { return e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'unsupported'; }
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } });
      this.rec = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
      this.chunks = []; this.rec.ondataavailable = e => e.data.size && this.chunks.push(e.data);
      this.rec.start(); this.active = true; haptic();
      this.timeout = setTimeout(() => onAuto && onAuto(), maxMs);
      return 'ok';
    },
    stop(discard = false) {
      clearTimeout(this.timeout);
      if (!this.active || !this.rec) { this.active = false; return Promise.resolve(null); }
      return new Promise(resolve => {
        this.rec.onstop = () => {
          this.stream?.getTracks().forEach(t => t.stop());
          const type = (this.rec.mimeType || 'audio/webm').split(';')[0];
          resolve(discard ? null : new Blob(this.chunks, { type }));
        };
        this.active = false; this.rec.stop();
      });
    }
  };

  function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ── Ishga tushirish ────────────────────────────────────────────────────
  async function start() {
    try { tg?.ready(); tg?.expand(); tg?.disableVerticalSwipes?.(); tg?.setHeaderColor?.('#F4F6FA'); tg?.setBackgroundColor?.('#F4F6FA'); tg?.setBottomBarColor?.('#FFFFFF'); } catch { /* eski Telegram */ }
    if (!initData) { stack.length = 0; stack.push({ name: 'outside', args: {} }); return render(); }
    stack.length = 0; stack.push({ name: 'splash', args: {} }); render();
    try {
      S = await api('/open');
      await flush();
      stack.length = 0;
      const first = !Object.values(S.steps).some(Boolean) && !local.seenMain;
      stack.push({ name: first ? 'main' : 'hub', args: {} });
      // Botdagi "Davom ettirish" tugmasi: start_param=next → to'g'ridan-to'g'ri keyingi qadam.
      const sp = tg?.initDataUnsafe?.start_param || '';
      if (!first && (/next/.test(sp) || new URLSearchParams(location.search).has('next')) && nextStep()) stack.push({ name: STEP_SCREEN[nextStep()], args: {} });
      render();
    } catch (e) {
      go('error', { offline: !!e.offline, message: e.message, retry: start }, { replace: true });
    }
  }
  window.addEventListener('online', () => flush());
  start();
})();
