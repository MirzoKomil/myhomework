'use strict';
// @Domworkuz_bot ichidagi "1-dars" mini ilovasi (Telegram WebApp) — server qismi.
// Dizayn: Design canvas "Domwork 1-dars mini app" + loyiha hujjati claude/miniapp_1dars_ux.md.
// Qoidalar: ball bitta qadam uchun bir marta beriladi; mehmon ma'lumoti faqat Telegram imzosi (initData) bilan;
// ovoz CRMda saqlanadi (≤1 MB), talaffuz baholanmaydi — faqat so'zlar mosligi (Gemini; zaxira ElevenLabs).
const { createHmac, timingSafeEqual } = require('node:crypto');
const funnel = require('./funnel');

// Ball jadvali (UX hujjati bilan bir xil). Qo'ng'iroq so'rovi balli funnel.finishRequest orqali emas, shu yerda beriladi.
const POINTS = { open: 2, video: 3, homework: 2, game: 2, voice: 3, locked: 1, request: 5 };
// 3 qadam (2026-11-03, mutaxassis tavsiyasi bilan qisqartirildi): ovoz — ish suhbatining oxirgi savoli (qo'shimcha ball, majburiy emas).
const STEPS = ['video', 'homework', 'game'];
// Namuna dars videosi — 2 qism (probniy_dars_video/namuna_dars_ssenariy.md). Bot boshqaruvida miniappVideos (2 ta https havola) bilan almashtiriladi.
const DEFAULT_VIDEOS = [{ url: 'https://youtu.be/_Og0fZEwwDo', title: 'Namuna dars', dur: '' }]; // 2 qism bitta videoga birlashtirildi
const httpsUrl = u => /^https:\/\/[^\s"'<>]{8,500}$/.test(u || '');
const MAX_VOICE_BYTES = 1024 * 1024;
const VOICE_MIME = /^audio\/(ogg|webm|mp4|mpeg|wav|x-m4a|aac)(;.*)?$/;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS domwork_miniapp_progress (
    telegram_id TEXT PRIMARY KEY,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    opens INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    steps JSONB NOT NULL DEFAULT '{}',
    answers JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS domwork_miniapp_voice (
    id BIGSERIAL PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    mime TEXT NOT NULL,
    bytes BYTEA NOT NULL,
    expected TEXT NOT NULL DEFAULT '',
    stt JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS domwork_miniapp_voice_tid ON domwork_miniapp_voice(telegram_id, created_at DESC);
CREATE TABLE IF NOT EXISTS domwork_miniapp_tts (
    hash TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    mime TEXT NOT NULL,
    bytes BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;
async function init(db) {
    await db.query(SCHEMA);
    await db.query('ALTER TABLE domwork_bot_visitors ADD COLUMN IF NOT EXISTS sla_alert_at TIMESTAMPTZ');
}

const httpError = (status, message) => Object.assign(Error(message), { status });

// ── Telegram initData imzosi ──────────────────────────────────────────────
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData, token, { now = Date.now(), maxAgeSec = 24 * 3600 } = {}) {
    if (!token) throw httpError(503, 'Mini ilova sozlanmagan');
    const raw = String(initData || '');
    if (!raw || raw.length > 8192) throw httpError(401, 'Telegram orqali oching');
    const params = new URLSearchParams(raw);
    const hash = params.get('hash') || '';
    if (!/^[a-f0-9]{64}$/.test(hash)) throw httpError(401, 'Telegram orqali oching');
    params.delete('hash');
    const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    const expected = createHmac('sha256', secret).update(check).digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) throw httpError(401, 'Telegram imzosi noto‘g‘ri');
    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSec) throw httpError(401, 'Sessiya eskirgan — mini ilovani qayta oching');
    let user; try { user = JSON.parse(params.get('user') || 'null'); } catch { user = null; }
    if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) throw httpError(401, 'Telegram foydalanuvchisi topilmadi');
    return { user, authDate, startParam: params.get('start_param') || '' };
}

// ── Nutqni tekshirish (so'zlar darajasida) ────────────────────────────────
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/́/g, '').normalize('NFC')
    .replace(/ё/g, 'е').replace(/[^а-яa-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
// Bir xil o'zak, faqat oxiri farq qiladi (банк/банке, работаю/работают) — kelishik/qo'shimcha xatosi.
function near(a, b) {
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i >= 3 && i >= Math.min(a.length, b.length) - 1 && Math.abs(a.length - b.length) <= 2;
}
// expected — mijoz o'zi yig'gan gaplar (ism, yosh, ish joyi). Ism (bosh harfli, 1-gapdan keyin) baholanmaydi.
function matchSpeech(expected, heard, { skip = [] } = {}) {
    const ignore = new Set(skip.flatMap(norm));
    const want = norm(expected).filter(w => !ignore.has(w));
    const got = norm(heard);
    const pool = [...got], words = [];
    for (const w of want) {
        const i = pool.findIndex(g => g === w || near(g, w));
        const exact = i >= 0 && pool[i] === w;
        if (i >= 0) pool.splice(i, 1);
        words.push({ word: w, ok: exact, near: i >= 0 && !exact });
    }
    const hit = words.filter(x => x.ok).length + words.filter(x => x.near).length * 0.5;
    const score = want.length ? Math.round((hit / want.length) * 100) : 0;
    return { score, level: score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'retry', words };
}

// Ovoz → matn. Asosiy: Gemini (GEMINI_API_KEY, model GEMINI_STT_MODEL). Zaxira: ElevenLabs Scribe (ELEVENLABS_API_KEY).
// Kalit yo'q yoki xizmat javob bermasa — null ("baholanmadi" ekrani, lid aybdor bo'lmaydi).
async function transcribe(buffer, mime, { env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        if (env.GEMINI_API_KEY) return await gemini(buffer, mime, env, fetchImpl, controller.signal);
        if (env.ELEVENLABS_API_KEY) return await elevenlabs(buffer, mime, env, fetchImpl, controller.signal);
        return null;
    } catch { return null; } finally { clearTimeout(timer); }
}
const GEMINI_PROMPT = 'Transcribe this Russian speech exactly as spoken, in Cyrillic. Do not correct grammar or word endings. '
    + 'Output only the transcript text. If there is no speech, output nothing.';
async function gemini(buffer, mime, env, fetchImpl, signal) {
    const model = /^[a-z0-9.-]{3,60}$/.test(env.GEMINI_STT_MODEL || '') ? env.GEMINI_STT_MODEL : 'gemini-3.5-flash-lite';
    const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: GEMINI_PROMPT }, { inline_data: { mime_type: mime, data: Buffer.from(buffer).toString('base64') } }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 200 } })
    });
    if (!res.ok) { console.error('[miniapp] gemini stt status', res.status); return null; }
    const body = await res.json();
    const text = (body.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(' ').trim();
    return { text: text.slice(0, 500), provider: 'gemini' };
}
async function elevenlabs(buffer, mime, env, fetchImpl, signal) {
    const form = new FormData();
    form.append('model_id', 'scribe_v1');
    form.append('language_code', 'rus');
    form.append('file', new Blob([buffer], { type: mime }), 'voice.' + (mime.split('/')[1] || 'ogg').split(';')[0]);
    const res = await fetchImpl('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY }, body: form, signal });
    if (!res.ok) return null;
    const body = await res.json();
    return { text: String(body.text || '').slice(0, 500), provider: 'elevenlabs' };
}

// ── Ustoz ovozi (Gemini TTS) ───────────────────────────────────────────────
// Ruscha gap bir marta yaratiladi va bazada saqlanadi — keyingi lidlarga tayyor holda beriladi.
// Model nomlari o'zgarib turadi: GEMINI_TTS_MODEL, keyin ro'yxatdagilar ketma-ket sinab ko'riladi.
const TTS_MODELS = ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
// Faqat ruscha gapning o'zi yuboriladi: matnga qo'shilgan har qanday yo'riqnomani model ovoz chiqarib o'qib yuboradi.
// Keshdagi eski yozuvlar (yo'riqnoma bilan yozilganlar) TTS_VERSION orqali yaroqsiz qilinadi.
const TTS_VERSION = 'v2';
const ttsText = t => String(t || '').normalize('NFC').replace(/\u0301/g, '').replace(/[·•]/g, ',').replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
function wav(pcm, rate = 24000) {
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
    h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
}
let ttsModelOk = null;
async function synthesize(text, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
    if (!env.GEMINI_API_KEY) return null;
    const voice = /^[A-Za-z]{2,20}$/.test(env.GEMINI_TTS_VOICE || '') ? env.GEMINI_TTS_VOICE : 'Kore';
    const models = [...new Set([env.GEMINI_TTS_MODEL, ttsModelOk, ...TTS_MODELS].filter(m => /^[a-z0-9.-]{3,60}$/.test(m || '')))];
    for (const model of models) {
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25000);
        try {
            const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
                body: JSON.stringify({ contents: [{ parts: [{ text }] }],
                    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } })
            });
            if (res.status === 404 || res.status === 400) continue; // bu model yo'q — keyingisi
            if (!res.ok) { console.error('[miniapp] tts status', res.status); return null; }
            const part = ((await res.json()).candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data);
            if (!part) continue;
            ttsModelOk = model;
            const mime = String(part.inlineData.mimeType || '');
            const raw = Buffer.from(part.inlineData.data, 'base64');
            if (/wav|mpeg|mp3|ogg/.test(mime)) return { mime: mime.split(';')[0], bytes: raw };
            const rate = Number((/rate=(\d+)/.exec(mime) || [])[1]) || 24000;
            return { mime: 'audio/wav', bytes: wav(raw, rate) };
        } catch { return null; } finally { clearTimeout(timer); }
    }
    return null;
}
// Faqat kirill matn (ruscha gap), 2–160 belgi. Yangi gap yaratish — kuniga cheklangan (keshdagilar cheksiz).
async function ttsCached(db, text) {
    const t = ttsText(text);
    if (t.length < 2 || t.length > 160 || !/[а-яё]/i.test(t) || /[^а-яёА-ЯЁ0-9\s.,!?:;—–\-()…'’]/.test(t)) throw httpError(400, 'Matn noto‘g‘ri');
    const hash = require('node:crypto').createHash('sha256').update(TTS_VERSION + '|' + t).digest('hex').slice(0, 40);
    return { hash, text: t, row: (await db.query('SELECT mime,bytes FROM domwork_miniapp_tts WHERE hash=$1', [hash])).rows[0] || null };
}
async function ttsDailyCount(db) { return (await db.query("SELECT COUNT(*)::int AS n FROM domwork_miniapp_tts WHERE created_at>NOW()-INTERVAL '1 day'")).rows[0].n; }
async function ttsStore(db, hash, text, audio) {
    await db.query('INSERT INTO domwork_miniapp_tts(hash,text,mime,bytes) VALUES($1,$2,$3,$4) ON CONFLICT(hash) DO NOTHING', [hash, text, audio.mime, audio.bytes]);
}

// ── Holat ─────────────────────────────────────────────────────────────────
async function ensureVisitor(db, user, startParam) {
    const tid = String(user.id);
    let v = await funnel.visitor(db, tid);
    if (!v) v = await funnel.upsertVisitor(db, user, { source: /^[a-z0-9_]{1,40}$/i.test(startParam) ? 'miniapp:' + startParam : 'organic' });
    return v;
}
async function progress(db, tid) {
    return (await db.query('SELECT * FROM domwork_miniapp_progress WHERE telegram_id=$1 FOR UPDATE', [tid])).rows[0] || null;
}
async function manager(db, leadId) {
    if (!leadId) return null;
    const row = (await db.query("SELECT h.name FROM leads l JOIN hr_employees h ON h.id=l.manager_id WHERE l.id=$1 AND COALESCE(l.manager_id,'')<>''", [leadId])).rows[0];
    // Biriktirilmagan lid ekranlarida — "Domwork o'quv maslahatchisi".
    return row ? { name: String(row.name).split(' ')[0] } : null;
}
function view(v, p, mgr, s, now = new Date()) {
    const discount = v.discount_until && new Date(v.discount_until) > now ? { percent: Number(s.discountPercent) || 0, until: v.discount_until } : null;
    return {
        name: String(v.first_name || '').split(' ')[0],
        field: v.field || '',
        steps: Object.fromEntries([...STEPS, 'voice'].map(k => [k, !!p?.steps?.[k]])),
        answers: p?.answers || {},
        finished: !!p?.finished_at,
        points: p?.points || 0,
        manager: mgr,
        requested: !!v.requested_at,
        hasPhone: !!v.phone,
        phoneMasked: v.phone ? funnel.mask(v.phone) : '',
        // 1-dars videosi — veb pleyer uchun https manzil (Bot boshqaruvi sozlamasi). Yo'q bo'lsa — konspekt rejimi.
        videos: Array.isArray(s.miniappVideos) && s.miniappVideos.length && s.miniappVideos.every(httpsUrl)
            ? s.miniappVideos.slice(0, 3).map((url, i) => ({ url, title: DEFAULT_VIDEOS[i]?.title || `${i + 1}-qism`, dur: DEFAULT_VIDEOS[i]?.dur || '' })) : DEFAULT_VIDEOS,
        sales: { open: funnel.inHours(s, now), slaMinutes: funnel.sla(s) },
        discount
    };
}

async function open(db, auth) {
    const v = await ensureVisitor(db, auth.user, auth.startParam);
    const tid = v.telegram_id;
    const first = !(await progress(db, tid));
    await db.query(`INSERT INTO domwork_miniapp_progress(telegram_id,opens) VALUES($1,1)
        ON CONFLICT(telegram_id) DO UPDATE SET opens=domwork_miniapp_progress.opens+1,last_seen_at=NOW()`, [tid]);
    if (first) await award(db, v, 'open', 'mini ilovada 1-darsni ochdi');
    await funnel.patch(db, tid, { last_seen_at: new Date() });
    await funnel.event(db, tid, 'miniapp_open', { first });
    return state(db, auth);
}
async function state(db, auth) {
    const tid = String(auth.user.id);
    const v = await funnel.visitor(db, tid);
    if (!v) throw httpError(404, 'Avval botda /start bosing');
    const [p, mgr, s] = [await progress(db, tid), await manager(db, v.lead_id), await funnel.settings(db)];
    return view(v, p, mgr, s);
}

// Ball bitta qadam uchun bir marta: steps JSONB'dagi kalit "qulf" vazifasini bajaradi (qator FOR UPDATE bilan).
async function award(db, v, key, reason) {
    const p = await progress(db, v.telegram_id);
    if (p?.steps?.['pt_' + key]) return false;
    const n = POINTS[key] || 0;
    await db.query(`UPDATE domwork_miniapp_progress SET steps=steps||$2::jsonb,points=points+$3,last_seen_at=NOW() WHERE telegram_id=$1`,
        [v.telegram_id, JSON.stringify({ ['pt_' + key]: new Date().toISOString() }), n]);
    if (n) await funnel.addScore(db, v, n, 'Mini ilova: ' + reason);
    return true;
}

const EVENTS = {
    // Video: mijoz ≥80% ko'rganda ball (pleyer progressini mijoz yuboradi).
    // Video hali joylanmagan bo'lsa (videoUrl yo'q) mijoz konspektni o'qiydi — noVideo belgisi bilan.
    video: (d) => ({ done: Number(d.percent) >= 80, save: { videoPercent: Math.max(0, Math.min(100, Math.round(Number(d.percent) || 0))), ...(d.noVideo === true ? { videoMode: 'konspekt' } : {}) }, reason: d.noVideo === true ? 'dars konspektini o‘qidi' : 'videoni ko‘rdi' }),
    // Uy vazifasi: 5 mashq; javoblar menejer suhbati uchun saqlanadi (ism, yosh, ish joyi).
    homework: (d) => ({ done: d.done === true, save: { homework: pick(d, ['correct', 'total', 'age', 'work', 'name']) }, reason: 'uy vazifasini bajardi' }),
    game: (d) => ({ done: d.done === true, save: { game: pick(d, ['score', 'time', 'won']) }, reason: 'o‘yinni o‘ynadi' }),
    locked: () => ({ done: true, save: {}, reason: 'yopiq 2-darsga qiziqdi', key: 'locked' }),
    resource: (d) => ({ done: false, save: {}, log: { id: String(d.id || '').slice(0, 40) }, send: ['sovga', 'qollanma'].includes(d.id) && d.send === true ? d.id : '' })
};
function pick(d, keys) {
    const out = {};
    for (const k of keys) if (d[k] !== undefined) out[k] = typeof d[k] === 'number' ? d[k] : String(d[k]).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 60);
    return out;
}

async function track(db, auth, { type, data = {} } = {}) {
    const rule = EVENTS[type];
    if (!rule || typeof data !== 'object' || Array.isArray(data)) throw httpError(400, 'Noma’lum hodisa');
    const tid = String(auth.user.id);
    const v = await funnel.visitor(db, tid);
    if (!v || !(await progress(db, tid))) throw httpError(409, 'Mini ilovani qayta oching');
    const r = rule(data);
    if (Object.keys(r.save).length) await db.query('UPDATE domwork_miniapp_progress SET answers=answers||$2::jsonb,last_seen_at=NOW() WHERE telegram_id=$1', [tid, JSON.stringify(r.save)]);
    if (r.done) {
        const key = r.key || type;
        if (STEPS.includes(key)) await db.query('UPDATE domwork_miniapp_progress SET steps=steps||$2::jsonb WHERE telegram_id=$1', [tid, JSON.stringify({ [key]: true })]);
        await award(db, v, key, r.reason);
    }
    let sent = null;
    if (r.send) sent = await funnel.sendMaterial(db, tid, r.send, v.field || '');
    await funnel.event(db, tid, 'miniapp_' + type, r.log || r.save);
    await maybeFinish(db, v);
    return { ...(await state(db, auth)), ...(sent === null ? {} : { sent }) };
}

// Hamma 4 qadam tugasa — CRM lidiga bitta xulosa izohi (lid bo'lsa) va extra_data.miniapp.
async function maybeFinish(db, v) {
    const p = await progress(db, v.telegram_id);
    if (!p || p.finished_at || !STEPS.every(k => p.steps[k])) return;
    await db.query('UPDATE domwork_miniapp_progress SET finished_at=NOW() WHERE telegram_id=$1', [v.telegram_id]);
    await funnel.event(db, v.telegram_id, 'miniapp_finished', { points: p.points });
    await summarize(db, v);
}
// CRM lidiga xulosa — lid bo'lsa darhol, bo'lmasa lid paydo bo'lganda (so'rov paytida). Bir marta.
async function summarize(db, v) {
    const p = await progress(db, v.telegram_id);
    if (!p?.finished_at || p.steps.pt_summary || !v.lead_id) return;
    await db.query('UPDATE domwork_miniapp_progress SET steps=steps||$2::jsonb WHERE telegram_id=$1', [v.telegram_id, JSON.stringify({ pt_summary: new Date().toISOString() })]);
    const a = p.answers || {};
    const hw = a.homework || {}, voice = a.voice || {};
    await funnel.leadComment(db, v.lead_id, `🎓 Mini ilova: namuna darsni to‘liq o‘tdi. Video ${a.videoPercent ?? '—'}% · vazifa ${hw.correct ?? '—'}/${hw.total ?? 3}`
        + ` · ish suhbati ${a.game?.score ?? '—'}/4 · ovoz ${voice.score != null ? voice.score + '%' : 'baholanmadi'}. Ball ${v.score}.`
        + (hw.work ? ` Ish joyi: ${hw.work}.` : '') + (hw.age ? ` Yoshi: ${hw.age}.` : ''));
    await db.query(`UPDATE leads SET extra_data=COALESCE(extra_data,'{}'::jsonb)||jsonb_build_object('miniapp',$2::jsonb),updated_at=NOW() WHERE id=$1`,
        [v.lead_id, JSON.stringify({ finishedAt: new Date().toISOString(), points: p.points, ...a })]);
}

// ── Ovoz ──────────────────────────────────────────────────────────────────
// 1-qadam (tranzaksiya ichida): saqlash. 2-qadam (tashqarida): STT. 3-qadam (tranzaksiya): natija va ball.
async function saveVoice(db, auth, buffer, mime, expected) {
    if (!VOICE_MIME.test(String(mime))) throw httpError(415, 'Ovoz formati qo‘llanmaydi');
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw httpError(400, 'Ovoz yozilmadi');
    if (buffer.length > MAX_VOICE_BYTES) throw httpError(413, 'Ovoz juda uzun — 20 soniyagacha yozing');
    const text = String(expected || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 200);
    const tid = String(auth.user.id);
    if (!(await progress(db, tid))) throw httpError(409, 'Mini ilovani qayta oching');
    const recent = (await db.query("SELECT COUNT(*)::int AS n FROM domwork_miniapp_voice WHERE telegram_id=$1 AND created_at>NOW()-INTERVAL '1 hour'", [tid])).rows[0].n;
    if (recent >= 20) throw httpError(429, 'Bir soatda 20 martagacha yozish mumkin');
    const row = (await db.query('INSERT INTO domwork_miniapp_voice(telegram_id,mime,bytes,expected) VALUES($1,$2,$3,$4) RETURNING id', [tid, String(mime).split(';')[0], buffer, text])).rows[0];
    return { id: row.id, expected: text };
}
// practice=true — o'yindagi ovozli javob: faqat baho, qadam/ball yo'q.
async function scoreVoice(db, auth, id, stt, { skip = [], practice = false } = {}) {
    const tid = String(auth.user.id);
    const row = (await db.query('SELECT id,expected FROM domwork_miniapp_voice WHERE id=$1 AND telegram_id=$2 FOR UPDATE', [id, tid])).rows[0];
    if (!row) throw httpError(404, 'Ovoz topilmadi');
    const result = stt ? { heard: stt.text, ...matchSpeech(row.expected, stt.text, { skip }) } : { heard: null, score: null, level: 'unscored', words: [] };
    await db.query('UPDATE domwork_miniapp_voice SET stt=$2 WHERE id=$1', [id, JSON.stringify(result)]);
    // Qadam "bajarildi" — baholanmagan bo'lsa ham (mijoz aybi emas); "retry" bo'lsa mijoz qayta yozadi.
    if (!practice && result.level !== 'retry') {
        const v = await funnel.visitor(db, tid);
        await db.query('UPDATE domwork_miniapp_progress SET steps=steps||$2::jsonb,answers=answers||$3::jsonb WHERE telegram_id=$1',
            [tid, JSON.stringify({ voice: true }), JSON.stringify({ voice: { id, score: result.score, level: result.level } })]);
        await award(db, v, 'voice', 'ovozli mashqni yozdi');
        await funnel.event(db, tid, 'miniapp_voice', { score: result.score, level: result.level });
        await maybeFinish(db, v);
    }
    return { id, ...result, state: await state(db, auth) };
}

// CRM (xodim) uchun: ovozni tinglash. Ruxsat — admin/rop/boshliq yoki lidga biriktirilgan menejer.
async function voiceForStaff(db, id, user, salesManagerId) {
    const row = (await db.query(`SELECT mv.mime,mv.bytes,l.manager_id FROM domwork_miniapp_voice mv
        JOIN domwork_bot_visitors v ON v.telegram_id=mv.telegram_id LEFT JOIN leads l ON l.id=v.lead_id WHERE mv.id=$1`, [id])).rows[0];
    if (!row) throw httpError(404, 'Ovoz topilmadi');
    const boss = ['admin', 'rop', 'boshliq'].includes(user?.role);
    if (!boss && !(user?.role === 'sales_manager' && salesManagerId && row.manager_id === salesManagerId)) throw httpError(403, 'Ruxsat yo‘q');
    return { mime: row.mime, bytes: row.bytes };
}

// ── Menejer bilan bog'lanish so'rovi ──────────────────────────────────────
// Bot voronkasining finishRequest'idan foydalanadi: CRM izohi, sotuv guruhiga xabar va botda tasdiq xabari bir xil bo'ladi.
async function request(db, auth, { method = 'call', when = 'now' } = {}) {
    const tid = String(auth.user.id);
    if (!['call', 'telegram'].includes(method) || !funnel.WHEN_KEYS.includes(when)) throw httpError(400, 'Noto‘g‘ri so‘rov');
    const v = await funnel.visitor(db, tid);
    if (!v || !(await progress(db, tid))) throw httpError(409, 'Mini ilovani qayta oching');
    let n = 0; const c = { db, tid, key: () => `ma:${tid}:req:${Date.now()}:${n++}` };
    v.request = { ...(v.request || {}), method };
    await funnel.patch(db, tid, { request: { ...(v.request || {}), method, when } });
    // Telefon yo'q → bot raqam so'raydi (askContact); mini ilova Telegram.WebApp.requestContact() ni ochadi.
    if (method === 'call' && !v.phone) {
        await funnel.finishRequest(c, v, when); // bot raqam so'raydi (zaxira: mini ilova yopilsa ham botda tugma qoladi)
        await funnel.patch(db, tid, { awaiting: 'miniapp' });
        return { needPhone: true, state: await state(db, auth) };
    }
    await funnel.finishRequest(c, v, when);
    await award(db, v, 'request', 'menejer bilan bog‘lanishni so‘radi');
    await summarize(db, await funnel.visitor(db, tid));
    await funnel.event(db, tid, 'miniapp_request', { method, when });
    return { needPhone: false, state: await state(db, auth) };
}

// ── Qaytarish xabari (dizayn: BotReturn) ──────────────────────────────────
// Darsni ochib, 2 soatdan beri qaytmagan lidga — bitta eslatma (10:00–20:00, nazorat guruhi va so'rov qoldirganlarga yo'q).
const STEP_MIN = { video: 6, homework: 1, game: 2 };
async function nudge(db, now = new Date()) {
    const s = await funnel.settings(db);
    if (s.funnelEnabled !== true || !funnel.miniappOn(s)) return 0;
    const local = new Date(now.getTime() + 5 * 3600000).getUTCHours();
    if (local < 10 || local >= 20) return 0;
    const rows = (await db.query(`SELECT p.telegram_id,p.steps,v.first_name FROM domwork_miniapp_progress p JOIN domwork_bot_visitors v USING(telegram_id)
        WHERE p.finished_at IS NULL AND NOT (p.steps ? 'pt_nudge') AND p.last_seen_at<$1::timestamptz-INTERVAL '2 hours' AND p.last_seen_at>$1::timestamptz-INTERVAL '48 hours'
          AND NOT v.paused AND v.blocked_at IS NULL AND NOT v.holdout AND v.requested_at IS NULL
        ORDER BY p.last_seen_at LIMIT 30 FOR UPDATE OF p SKIP LOCKED`, [now])).rows;
    for (const r of rows) {
        await db.query('UPDATE domwork_miniapp_progress SET steps=steps||$2::jsonb WHERE telegram_id=$1', [r.telegram_id, JSON.stringify({ pt_nudge: now.toISOString() })]);
        const left = STEPS.filter(k => !r.steps[k]), mins = left.reduce((a, k) => a + STEP_MIN[k], 0);
        const name = String(r.first_name || '').split(' ')[0] || 'Assalomu alaykum';
        const text = left.length === STEPS.length
            ? `${name}, namuna dars sizni kutyapti — ≈${mins} daqiqa. Oxirida ish suhbatida rus tilida o‘zingiz javob berasiz!`
            : `${name}, namuna darsning yarmidasiz — <b>${left.length} qadam qoldi (≈${mins} daqiqa)</b>. ` + 'Eng qiziq joyi oldinda: ish suhbati — HR savoliga o‘z ovozingiz bilan javob berasiz!';
        await funnel.say({ db, tid: r.telegram_id, key: () => `ma:${r.telegram_id}:nudge` }, text,
            funnel.inline([[['▶️ Davom ettirish', 'webapp:' + funnel.MINIAPP_URL + '?next=1']]]), { html: true, automation: true });
        await funnel.event(db, r.telegram_id, 'miniapp_nudge', { left: left.length });
    }
    return rows.length;
}

// ── Va'da vaqti o'tdi (dizayn: StaffSla / RopSla) ─────────────────────────
// «Hozir qo'ng'iroq qiling» so'rovi va'da qilingan vaqtda natijasiz qolsa — sotuv guruhi (ROP) va menejerga bitta eslatma.
// Lidga uzr yuborilmaydi: menejer qo'ng'iroq qilib, tugmani bosmagan bo'lishi mumkin.
async function salesSla(db, now = new Date()) {
    const s = await funnel.settings(db);
    if (s.funnelEnabled !== true || !funnel.inHours(s, now)) return 0;
    const min = funnel.promiseMinutes(s);
    const rows = (await db.query(`SELECT * FROM domwork_bot_visitors WHERE requested_at IS NOT NULL AND outcome IS NULL AND sla_alert_at IS NULL
          AND request->>'method'='call' AND request->>'when'='now' AND requested_at<$1::timestamptz-make_interval(mins=>$2::int) AND requested_at>$1::timestamptz-INTERVAL '6 hours'
        ORDER BY requested_at LIMIT 20 FOR UPDATE SKIP LOCKED`, [now, min])).rows;
    for (const v of rows) {
        await funnel.patch(db, v.telegram_id, { sla_alert_at: now });
        const late = Math.round((now - new Date(v.requested_at)) / 60000);
        await funnel.notifySales(db, 'sla:' + v.telegram_id + ':' + new Date(v.requested_at).toISOString(),
            `⏰ Va'da vaqti o‘tdi — lid ${late} daqiqadan beri qo‘ng‘iroqni kutyapti (so‘rov ${funnel.hhmm(new Date(v.requested_at))} da)`, v,
            'Qo‘ng‘iroq qilgan bo‘lsangiz — natijani pastdagi tugma bilan belgilang. ROP: menejer javob bermasa, boshqasiga bering.', { buttons: true });
        await funnel.event(db, v.telegram_id, 'sales_sla', { late });
    }
    return rows.length;
}

module.exports = { synthesize, ttsCached, ttsDailyCount, ttsStore, wav, init, nudge, salesSla, SCHEMA, POINTS, STEPS, verifyInitData, matchSpeech, transcribe, open, state, track, saveVoice, scoreVoice, voiceForStaff, request };
