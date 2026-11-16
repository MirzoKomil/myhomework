// Qo'ng'iroqlarni AI tahlili (2026-11-16, dizayn: "CRM — barcha dizaynlar" › qongiroq-tel / qongiroq-komp).
//
// Oqim: yozuv (Jamoa ilovasi avtomatik yoki CRM'dan qo'lda) → navbat → Gemini matnga aylantiradi
// (so'zma-so'z, MENEJER/MIJOZ, vaqt belgilari) → Claude Sonnet CRM'dagi Sotuv › Skriptlar bo'yicha
// baholaydi (100 ball, 7 o'q, mezonlar, iqtiboslar, sotuv ehtimoli, keyingi gaplar, ogohlantirishlar)
// → natija `callAnalyses` (json_data) da saqlanadi va lid kartasidagi yozuvlar ro'yxatiga qo'shib beriladi.
//
// Kalitlar (Railway → Variables): GEMINI_API_KEY, ANTHROPIC_API_KEY. Ixtiyoriy: GEMINI_CALL_MODEL,
// CALL_AI_MODEL (Claude). Kalit bo'lmasa — yozuv saqlanadi, tahlil "kutilmoqda: kalit yo'q" bo'lib turadi.
// Qoidalar: 30 soniyadan qisqa va "Eslatma" qo'ng'iroqlari baholanmaydi; Qarzdorlik — "taxminiy".

const fs = require('fs');
const path = require('path');

const KEY = 'callAnalyses';
const TKEY = 'callTranscript:';
const MIN_SECONDS = 30;
const APPEAL_HOURS = 48;
const APPEAL_ROP_HOURS = 24;
const MAX_INLINE_BYTES = 14 * 1024 * 1024; // base64 dan keyin ~19 MB — Gemini inline chegarasi 20 MB
const GEMINI_MODELS = ['gemini-3.1-pro-preview', 'gemini-2.5-pro'];
const CLAUDE_MODEL_DEFAULT = 'claude-sonnet-5-5';

const TYPES = {
    birinchi: { label: '1-qoʻngʻiroq', weights: 'Ochilish 10 · Ehtiyoj 20 · Ogʻriq 15 · Taqdimot 15 · Narx 15 · Eʼtiroz 10 · Yopish 15' },
    qayta: { label: 'Qayta', weights: 'Kelishilgan vaqtda qilindi 15 · Haqiqiy eʼtirozni ochish va javob 35 · Sinov darsiga olib chiqish 20 · Aniq vaqt bilan yopish 30' },
    sinovdan_keyin: { label: 'Sinovdan keyin', weights: 'Taassurot soʻraldi 15 · Sinovdagi ehtiyojga bogʻlash 25 · Narx va chegirma zinapoyasi 30 · Aniq vaqt bilan yopish 30' },
    tolov: { label: 'Toʻlov', weights: 'Muammoni aniqlash 25 · Toʻlov usullari 20 · Nasiya/zaklad taklifi 25 · Aniq toʻlov vaqti 30' },
    qarzdorlik: { label: 'Qarzdorlik', weights: 'Xushmuomala ochilish 15 · Oʻqishdagi natijani eslatish 15 · Qarz summasi va muddati aniq 20 · Sababni aniqlash 15 · Toʻlov rejasi / aniq sana 25 · Bosimsiz ohang 10 (skriptda boʻlim yoʻq — baho taxminiy)' },
    eslatma: { label: 'Eslatma', weights: 'baholanmaydi' },
};
const AXES = ['ochilish', 'ehtiyoj', 'ogriq', 'taqdimot', 'narx', 'etiroz', 'yopish'];

function gradeOf(score) {
    const s = Number(score) || 0;
    if (s >= 90) return { key: 'alo', label: 'AʼLO' };
    if (s >= 80) return { key: 'yaxshi', label: 'YAXSHI' };
    if (s >= 60) return { key: 'orta', label: 'OʻRTA' };
    return { key: 'zaif', label: 'ZAIF' };
}

// CRM holatidan taxminiy tur (AI suhbat mazmunidan tasdiqlaydi yoki o'zgartiradi).
function typeHintFromStatus(status, hadEarlierCalls) {
    const s = String(status || '');
    if (s === 'tolov-jarayonida') return 'tolov';
    if (s === 'tolov-yopildi') return 'qarzdorlik';
    if (s === 'sinov-darsida') return 'sinovdan_keyin';
    if (!s || s === 'new' || s === 'yangi-lidlar' || s === 'boglanishga-urinilmoqda') return hadEarlierCalls ? 'qayta' : 'birinchi';
    return 'qayta';
}

// ── Saqlash ─────────────────────────────────────────────────────────────────
function createStore(db) {
    let chain = Promise.resolve();
    // Ketma-ket va qulf bilan (o'qish→o'zgartirish→yozish poygasi bo'lmasin). Bitta xato zanjirni buzmaydi.
    const mutate = fn => {
        const run = chain.then(async () => {
            if (db.mutateJsonData) return db.mutateJsonData(KEY, list => fn(list));
            const all = await db.getJsonData(KEY);
            const list = Array.isArray(all) ? all : [];
            const out = await fn(list);
            await db.tx(async client => { await db.saveJsonData(client, KEY, list); });
            return out;
        });
        chain = run.catch(err => console.error('[callAi] store', err.message));
        return run;
    };
    return {
        async all() { const a = await db.getJsonData(KEY); return Array.isArray(a) ? a : []; },
        mutate,
        async patch(id, fields) {
            return mutate(list => {
                const it = list.find(x => x.id === id);
                if (it) Object.assign(it, fields, { updatedAt: new Date().toISOString() });
                return it || null;
            });
        },
    };
}

// ── Gemini: ovoz → matn ─────────────────────────────────────────────────────
const TRANSCRIBE_PROMPT = `Bu — Oʻzbekistondagi onlayn rus tili maktabi (Domwork) sotuv menejerining telefon suhbati yozuvi.
Suhbatni SOʻZMA-SOʻZ yozib ber: hech narsani tuzatma, qisqartirma, umumlashtirma. Oʻzbekcha gaplar lotinda, ruscha gaplar kirillda.
Har bir gap uchun: vaqt (mm:ss, yozuv boshidan), kim gapirdi — "M" (menejer, maktab xodimi) yoki "C" (mijoz), matn.
Eshitilmagan joyga [noaniq] yoz. Ohang muhim boʻlsa qavsda qisqa izoh (masalan: (kuladi), (jahl bilan)).
Faqat JSON qaytar: {"segments":[{"t":"00:05","s":"M","text":"..."}],"durationSec":123}`;

async function transcribe(buffer, mime, { env = process.env, fetchImpl = globalThis.fetch, onUsage = null } = {}) {
    if (!env.GEMINI_API_KEY) throw Object.assign(new Error('GEMINI_API_KEY yoʻq'), { code: 'nokey' });
    // Katta fayl (14 MB dan ortiq) — Gemini Files API orqali yuklanadi, keyin havola bilan yuboriladi.
    const media = buffer.length > MAX_INLINE_BYTES ? { file_data: { mime_type: mime, file_uri: await geminiUpload(buffer, mime, env, fetchImpl) } }
        : { inline_data: { mime_type: mime, data: buffer.toString('base64') } };
    const models = [...new Set([env.GEMINI_CALL_MODEL, ...GEMINI_MODELS].filter(m => /^[a-z0-9.-]{3,60}$/.test(m || '')))];
    let lastErr = null;
    for (const model of models) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 240000);
        try {
            const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                method: 'POST', signal: controller.signal,
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: TRANSCRIBE_PROMPT }, media] }],
                    generationConfig: { temperature: 0, maxOutputTokens: 32000, responseMimeType: 'application/json' },
                }),
            });
            if (res.status === 404) { lastErr = new Error('Gemini modeli topilmadi: ' + model); continue; }
            if (!res.ok) {
                const t = await res.text().catch(() => '');
                lastErr = new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
                if (res.status >= 500) continue; // keyingi model
                throw lastErr;
            }
            const body = await res.json();
            // Narx: javob kelgan bo'lsa pul yechilgan — matn buzilgan bo'lsa ham hisobga olinadi.
            if (onUsage) await Promise.resolve(onUsage({ provider: 'gemini', model, usage: body.usageMetadata })).catch(() => {});
            const text = (body.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
            const parsed = parseJsonLoose(text);
            const segments = (Array.isArray(parsed?.segments) ? parsed.segments : [])
                .map(x => ({ t: String(x.t || '').slice(0, 8), s: x.s === 'C' ? 'C' : 'M', text: String(x.text || '').slice(0, 2000) }))
                .filter(x => x.text);
            return { model, segments, durationSec: Number(parsed?.durationSec) || 0 };
        } catch (err) {
            lastErr = err.name === 'AbortError' ? new Error('Gemini javob bermadi (vaqt tugadi)') : err;
            if (/Gemini [45]\d\d/.test(lastErr.message) && !/Gemini 5/.test(lastErr.message)) break;
        } finally { clearTimeout(timer); }
    }
    throw lastErr || new Error('Gemini xatosi');
}

async function geminiUpload(buffer, mime, env, fetchImpl) {
    const start = await fetchImpl('https://generativelanguage.googleapis.com/upload/v1beta/files', {
        method: 'POST',
        headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Header-Content-Length': String(buffer.length), 'X-Goog-Upload-Header-Content-Type': mime, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: { display_name: 'call' } }),
    });
    const url = start.headers?.get?.('x-goog-upload-url');
    if (!start.ok || !url) throw new Error(`Gemini fayl yuklash ${start.status}`);
    const up = await fetchImpl(url, { method: 'POST', headers: { 'Content-Length': String(buffer.length), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: buffer });
    if (!up.ok) throw new Error(`Gemini fayl yuklash ${up.status}`);
    let file = (await up.json()).file;
    for (let i = 0; i < 30 && file?.state === 'PROCESSING'; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const g = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
        if (g.ok) file = await g.json();
    }
    if (!file?.uri || file.state === 'FAILED') throw new Error('Gemini faylni qabul qilmadi');
    return file.uri;
}

function parseJsonLoose(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch { /* pastda */ }
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* */ } }
    return null;
}

// ── Claude: skript bo'yicha baholash ────────────────────────────────────────
const SCORE_TOOL = {
    name: 'call_score',
    description: 'Sotuv qoʻngʻirogʻining tahlili va bahosi',
    input_schema: {
        type: 'object',
        properties: {
            type: { type: 'string', enum: ['birinchi', 'qayta', 'sinovdan_keyin', 'tolov', 'qarzdorlik', 'eslatma'] },
            gradable: { type: 'boolean', description: 'false — eslatma, javob berilmagan, avtojavob, notoʻgʻri raqam, suhbat yoʻq' },
            notGradableReason: { type: 'string' },
            score: { type: 'integer', minimum: 0, maximum: 100 },
            axes: {
                type: 'object', description: '7 bosqich oʻqi, har biri 0–10. Bu turdagi qoʻngʻiroqda boʻlmagan bosqich — null',
                properties: Object.fromEntries(AXES.map(a => [a, { type: ['integer', 'null'], minimum: 0, maximum: 10 }])),
            },
            criteria: {
                type: 'array', description: 'Shu tur mezonlari (ogʻirliklar yigʻindisi 100)',
                items: { type: 'object', properties: { name: { type: 'string' }, max: { type: 'integer' }, got: { type: 'integer' }, note: { type: 'string' } }, required: ['name', 'max', 'got'] },
            },
            quotes: {
                type: 'array', description: 'Eng muhim 2–4 xato: vaqt, menejer aynan nima dedi, skript boʻyicha nima deyish kerak edi',
                items: { type: 'object', properties: { t: { type: 'string' }, criterion: { type: 'string' }, said: { type: 'string' }, should: { type: 'string' } }, required: ['t', 'said', 'should'] },
            },
            good: { type: 'array', items: { type: 'object', properties: { t: { type: 'string' }, text: { type: 'string' } } } },
            steps: {
                type: 'array', description: 'Skript bosqichlari ketma-ket: ok — bajarildi, warn — chala, bad — bajarilmadi/buzildi. title qisqa (masalan "Taassurot soʻraldi"), t — vaqt, note — qisqa izoh (iqtibos bilan)',
                items: { type: 'object', properties: { status: { type: 'string', enum: ['ok', 'warn', 'bad'] }, title: { type: 'string' }, t: { type: 'string' }, note: { type: 'string' } }, required: ['status', 'title'] },
            },
            marks: {
                type: 'array', description: 'Transkriptdagi eng muhim gaplar: good — skript boʻyicha zoʻr, bad — xato. t — segment vaqti aynan transkriptdagidek',
                items: { type: 'object', properties: { t: { type: 'string' }, kind: { type: 'string', enum: ['good', 'bad'] } }, required: ['t', 'kind'] },
            },
            facts: {
                type: 'array', description: 'Suhbatdagi faktlar: aytilgan narxlar, chegirmalar, vaʼdalar, kelishilgan vaqtlar',
                items: { type: 'object', properties: { t: { type: 'string' }, text: { type: 'string' } }, required: ['text'] },
            },
            riskAmount: { type: 'integer', description: 'Xato tufayli xavf ostidagi taxminiy summa (soʻm), boʻlmasa 0' },
            aiTip: { type: 'string', description: 'Lid kartasi uchun bitta gap: mijoz nima dedi va hozir nima qilish kerak (oʻzbekcha)' },
            violations: {
                type: 'array', description: 'Skript qoidasi buzilishi: nasiyasiz_chegirma, oylik_narx_oldindan, boshida_chegirma, ortiqcha_vada',
                items: { type: 'object', properties: { kind: { type: 'string' }, t: { type: 'string' }, text: { type: 'string' } }, required: ['kind', 'text'] },
            },
            outcome: { type: 'string', enum: ['tolov', 'sinov_darsi', 'tolov_vadasi', 'qayta_qongiroq', 'hech_narsa'] },
            nextStepAt: { type: 'string', description: 'Kelishilgan aniq keyingi qadam vaqti (boʻlsa), masalan "ertaga 12:00"' },
            saleProbability: { type: 'integer', minimum: 0, maximum: 100 },
            summary: { type: 'string', description: 'Oʻzbekcha, 2–3 gap: nima boʻldi va asosiy xato' },
            nextLines: { type: 'array', items: { type: 'string' }, description: 'Keyingi qoʻngʻiroq uchun tayyor 2–3 gap (menejer qaysi tilda gaplashgan boʻlsa oʻsha tilda)' },
            alerts: {
                type: 'array', description: 'ROPga: sovuyapti, tolov_vadasi, qoida, shikoyat',
                items: { type: 'object', properties: { kind: { type: 'string' }, text: { type: 'string' } }, required: ['kind', 'text'] },
            },
            scriptIssues: { type: 'array', items: { type: 'string' }, description: 'Xato skriptning oʻzidagi kamchilikdan boʻlsa (menejer balidan ayirilmaydi)' },
            talkShareManager: { type: 'integer', minimum: 0, maximum: 100 },
            nameUses: { type: 'integer', minimum: 0 },
            leadQuality: {
                type: 'object',
                description: 'Faqat 1-qoʻngʻiroqda (targetolog uchun): lid maqsadli mijozmi. reason: maqsadli, yosh_talaba (yoshi kichik/talaba), tasodifan (reklamani tasodifan bosgan), bepul_deb (bepul deb oʻylagan), rossiya_nasiya (Rossiyada, nasiya mos emas), notogri_raqam, boshqa. adQuote — mijoz reklama haqida aytgan gap (boʻlsa, qisqa, oʻzbekcha)',
                properties: {
                    targeted: { type: 'boolean' },
                    reason: { type: 'string', enum: ['maqsadli', 'yosh_talaba', 'tasodifan', 'bepul_deb', 'rossiya_nasiya', 'notogri_raqam', 'boshqa'] },
                    age: { type: ['integer', 'null'], description: 'Suhbatdan maʼlum boʻlsa yoshi' },
                    adQuote: { type: 'string' },
                },
            },
        },
        required: ['type', 'gradable', 'summary'],
    },
};

function systemPrompt() {
    return `Sen Domwork (onlayn rus tili maktabi, Oʻzbekiston) sotuv boʻlimining qatʼiy, adolatli sifat nazoratchisisan.
Vazifa: sotuv menejerining telefon suhbatini maktabning SOTUV SKRIPTI boʻyicha baholash va menejerga aniq, amaliy yordam berish.

Qoʻngʻiroq turlari va mezonlar (har tur 100 ball):
${Object.entries(TYPES).map(([k, v]) => `- ${k} (${v.label}): ${v.weights}`).join('\n')}

Qoidalar:
- Tur: CRM taxmini berilgan, lekin suhbat mazmuniga qarab yakuniy turni oʻzing aniqla.
- "eslatma" (faqat dars/vaqtni eslatish), javob berilmagan, notoʻgʻri raqam, suhbat yoʻq → gradable=false, ball qoʻyma.
- Narxlar (tasdiqlangan): VIP 6,0 mln, Standard 2,1 mln, Start 1,8 mln (3 oylik paket). Chegirma zinapoyasi: avval bir yoʻla, keyin NASIYA (Uzum Nasiya/Paylater, 6 oy, ustamasiz), keyin ZAKLAD, eng oxiri chegirma faqat bugungi toʻlov sharti bilan. Nasiya va zakladsiz chegirma = qoida buzilishi. Oylik narxni mijoz soʻramasdan aytish = qoida buzilishi.
- Har qoʻngʻiroq aniq keyingi qadam (vaqt) bilan tugashi shart.
- Iqtiboslar transkriptdagi haqiqiy gaplardan boʻlsin (vaqti bilan). "should" — skriptdagi toʻgʻri javob, qisqa.
- Transkriptni AI yozgan: spikerlar adashgan yoki boʻlak tushib qolgan boʻlishi mumkin — shubhali joy uchun menejerni jazolama.
- Xato skriptning oʻzidagi kamchilikdan boʻlsa — scriptIssues ga yoz.
- Qarzdorlik turida skript boʻlimi yoʻq — umumiy mezon bilan bahola.
- summary, criteria.note, alerts — oʻzbek tilida (lotin). Qisqa va aniq yoz.
Natijani faqat call_score vositasi orqali qaytar.`;
}

function htmlToText(html) {
    return String(html || '').replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

async function scriptText(db, lang) {
    const all = await db.getJsonData('scripts');
    const list = (Array.isArray(all) ? all : []).filter(s => (s.lang || 'english') === lang);
    // "Sotuv skripti" birinchi; qolganlari (e'tirozlar va h.k.) keyin.
    list.sort((a, b) => (/sotuv skript/i.test(b.title || '') ? 1 : 0) - (/sotuv skript/i.test(a.title || '') ? 1 : 0));
    let out = '';
    for (const s of list) {
        const part = `### ${s.title || 'Skript'}\n${htmlToText(s.content)}\n\n`;
        if (out.length + part.length > 60000) break;
        out += part;
    }
    return out.trim();
}

async function score({ transcript, scriptBody, typeHint, forcedType, appealNote, lead, managerName }, { env = process.env, fetchImpl = globalThis.fetch, onUsage = null } = {}) {
    if (!env.ANTHROPIC_API_KEY) throw Object.assign(new Error('ANTHROPIC_API_KEY yoʻq'), { code: 'nokey' });
    const model = /^[a-z0-9.-]{3,60}$/.test(env.CALL_AI_MODEL || '') ? env.CALL_AI_MODEL : CLAUDE_MODEL_DEFAULT;
    const lines = transcript.segments.map(x => `[${x.t}] ${x.s === 'C' ? 'MIJOZ' : 'MENEJER'}: ${x.text}`).join('\n');
    const user = `SOTUV SKRIPTI (CRM › Sotuv › Skriptlar):\n${scriptBody || '(skript topilmadi — umumiy sotuv standartlari bilan bahola)'}\n\n`
        + `CRM maʼlumoti: lid "${lead?.name || ''}", holati: ${lead?.status || 'nomaʼlum'}, menejer: ${managerName || 'nomaʼlum'}. ${forcedType ? `Tur ROP tomonidan belgilangan: ${forcedType} — shu tur mezonlari bilan bahola.` : `CRM taxmini boʻyicha tur: ${typeHint}.`}\n\n`
        + (appealNote ? `ROP QABUL QILGAN EʼTIROZ (shu mezonni transkript asosida qayta koʻrib chiq, adolatli boʻl): ${appealNote}\n\n` : '')
        + `SUHBAT TRANSKRIPTI:\n${lines}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180000);
    try {
        const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
            method: 'POST', signal: controller.signal,
            headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
                model, max_tokens: 6000,
                system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
                tools: [SCORE_TOOL], tool_choice: { type: 'tool', name: 'call_score' },
                messages: [{ role: 'user', content: user }],
            }),
        });
        if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`Claude ${res.status}: ${t.slice(0, 200)}`); }
        const body = await res.json();
        if (onUsage) await Promise.resolve(onUsage({ provider: 'claude', model, usage: body.usage })).catch(() => {});
        const block = (body.content || []).find(c => c.type === 'tool_use');
        if (!block?.input) throw new Error('Claude natija qaytarmadi');
        const result = normalizeResult(forcedType ? { ...block.input, type: forcedType } : block.input);
        return { model, result };
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('Claude javob bermadi (vaqt tugadi)');
        throw err;
    } finally { clearTimeout(timer); }
}

function normalizeResult(r) {
    const type = TYPES[r.type] ? r.type : 'qayta';
    const gradable = r.gradable !== false && type !== 'eslatma';
    const arr = v => (Array.isArray(v) ? v : []);
    const criteria = arr(r.criteria).map(c => ({ name: String(c.name || ''), max: Math.max(0, Number(c.max) || 0), got: Math.max(0, Math.min(Number(c.max) || 0, Number(c.got) || 0)), note: String(c.note || '') }));
    let total = Number.isFinite(Number(r.score)) ? Math.round(Number(r.score)) : null;
    const critMax = criteria.reduce((a, c) => a + c.max, 0);
    if (critMax === 100) total = criteria.reduce((a, c) => a + c.got, 0); // mezonlar yig'indisi — yagona manba
    if (total == null && critMax > 0) total = Math.round(criteria.reduce((a, c) => a + c.got, 0) / critMax * 100);
    if (total != null) total = Math.max(0, Math.min(100, total));
    const axes = {};
    AXES.forEach(a => { const v = r.axes?.[a]; axes[a] = v == null || v === '' ? null : Math.max(0, Math.min(10, Math.round(Number(v)))); });
    return {
        type, typeLabel: TYPES[type].label, gradable,
        approximate: type === 'qarzdorlik',
        notGradableReason: gradable ? '' : String(r.notGradableReason || (type === 'eslatma' ? 'Eslatma qoʻngʻirogʻi' : 'Suhbat yoʻq')),
        score: gradable ? (total == null ? 0 : total) : null,
        grade: gradable && total != null ? gradeOf(total) : null,
        axes: gradable ? axes : null,
        criteria: gradable ? criteria : [],
        quotes: arr(r.quotes).slice(0, 6).map(q => ({ t: String(q.t || ''), criterion: String(q.criterion || ''), said: String(q.said || ''), should: String(q.should || '') })),
        good: arr(r.good).slice(0, 4).map(g => ({ t: String(g.t || ''), text: String(g.text || '') })),
        steps: arr(r.steps).slice(0, 12).map(x => ({ status: ['ok', 'warn', 'bad'].includes(x.status) ? x.status : 'warn', title: String(x.title || ''), t: String(x.t || ''), note: String(x.note || '') })),
        marks: arr(r.marks).slice(0, 30).map(x => ({ t: String(x.t || ''), kind: x.kind === 'good' ? 'good' : 'bad' })),
        facts: arr(r.facts).slice(0, 15).map(x => ({ t: String(x.t || ''), text: String(x.text || '') })),
        riskAmount: Math.max(0, Math.round(Number(r.riskAmount) || 0)),
        aiTip: String(r.aiTip || ''),
        violations: arr(r.violations).slice(0, 8).map(v => ({ kind: String(v.kind || ''), t: String(v.t || ''), text: String(v.text || '') })),
        outcome: String(r.outcome || 'hech_narsa'),
        nextStepAt: String(r.nextStepAt || ''),
        saleProbability: Number.isFinite(Number(r.saleProbability)) ? Math.max(0, Math.min(100, Math.round(Number(r.saleProbability)))) : null,
        summary: String(r.summary || ''),
        nextLines: arr(r.nextLines).slice(0, 4).map(String),
        alerts: arr(r.alerts).slice(0, 5).map(a => ({ kind: String(a.kind || ''), text: String(a.text || '') })),
        scriptIssues: arr(r.scriptIssues).slice(0, 5).map(String),
        talkShareManager: Number.isFinite(Number(r.talkShareManager)) ? Math.round(Number(r.talkShareManager)) : null,
        nameUses: Number.isFinite(Number(r.nameUses)) ? Math.round(Number(r.nameUses)) : null,
        leadQuality: r.leadQuality && typeof r.leadQuality === 'object' ? {
            targeted: r.leadQuality.targeted !== false && (r.leadQuality.reason || 'maqsadli') === 'maqsadli',
            reason: ['maqsadli', 'yosh_talaba', 'tasodifan', 'bepul_deb', 'rossiya_nasiya', 'notogri_raqam', 'boshqa'].includes(r.leadQuality.reason) ? r.leadQuality.reason : (r.leadQuality.targeted === false ? 'boshqa' : 'maqsadli'),
            age: Number.isFinite(Number(r.leadQuality.age)) && Number(r.leadQuality.age) > 0 ? Math.round(Number(r.leadQuality.age)) : null,
            adQuote: String(r.leadQuality.adQuote || '').slice(0, 300),
        } : null,
    };
}

function mimeOf(file) {
    const ext = path.extname(file).toLowerCase();
    return ({ '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.amr': 'audio/amr', '.3gp': 'audio/3gpp', '.webm': 'audio/webm', '.flac': 'audio/flac' })[ext] || 'audio/mpeg';
}

// E'tiroz qabul qilingach: eski natijadan faqat e'tiroz qilingan mezon yangisiga almashtiriladi, ball qayta yig'iladi.
function mergeAppeal(oldR, newR, criterion) {
    if (!oldR?.criteria?.length || !newR?.criteria?.length) return null;
    const norm = x => String(x || '').toLowerCase().replace(/[ʻʼ'`]/g, '').trim();
    const fresh = newR.criteria.find(c => norm(c.name) === norm(criterion));
    const i = oldR.criteria.findIndex(c => norm(c.name) === norm(criterion));
    if (!fresh || i < 0) return null;
    const criteria = oldR.criteria.map((c, k) => (k === i ? { ...c, got: Math.min(c.max, fresh.got), note: fresh.note || c.note } : c));
    const max = criteria.reduce((a, c) => a + c.max, 0);
    const got = criteria.reduce((a, c) => a + c.got, 0);
    const score = max === 100 ? got : Math.round(got / (max || 1) * 100);
    const crit = norm(criterion);
    const keep = arr => (arr || []).filter(q => norm(q.criterion) !== crit);
    return { ...oldR, criteria, score, grade: gradeOf(score), quotes: keep(oldR.quotes).concat((newR.quotes || []).filter(q => norm(q.criterion) === crit)) };
}

// ── Navbat ──────────────────────────────────────────────────────────────────
function createCallAi({ db, uploadsDir, env = process.env, fetchImpl = globalThis.fetch, log = console, onCost = null } = {}) {
    const store = createStore(db);
    const queue = [];
    let running = false;

    async function enqueue(recording, meta = {}) {
        if (!recording?.id) return null;
        const item = await store.mutate(list => {
            let it = list.find(x => x.recordingId === recording.id);
            if (!it) {
                it = {
                    id: 'ca-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                    recordingId: recording.id, lang: recording.lang, leadId: recording.leadId,
                    managerId: meta.managerId || '', managerName: meta.managerName || recording.uploadedBy || '',
                    callAt: meta.callAt || recording.createdAt, durationSec: Number(recording.duration) || 0,
                    source: recording.source || 'manual', status: 'queued', createdAt: new Date().toISOString(),
                };
                list.push(it);
            } else if (meta.force) {
                Object.assign(it, { status: 'queued', error: '', result: null });
            }
            return { ...it };
        });
        if (item.status === 'queued') push(item.id);
        return item;
    }

    function push(id) { if (!queue.includes(id)) queue.push(id); kick(); }

    function kick() {
        if (running) return;
        running = true;
        (async () => {
            while (queue.length) {
                const id = queue.shift();
                try { await processOne(id); } catch (err) { log.error('[callAi] process', id, err.message); }
            }
        })().finally(() => { running = false; if (queue.length) kick(); });
    }

    async function processOne(id) {
        const item = (await store.all()).find(x => x.id === id);
        if (!item || item.status !== 'queued') return;
        const rev = item.rev || 0;
        // Vaqtinchalik xato (429/5xx/vaqt tugadi) — 1, 2, 3 daqiqadan keyin o'zi qayta uriniladi.
        const failed = async err => {
            const transient = /\b(429|5\d\d)\b|vaqt tugadi|fetch failed|ECONN|ETIMEDOUT/i.test(err.message || '');
            const attempts = (item.attempts || 0) + 1;
            if (transient && attempts <= 3) {
                const ok = await save({ status: 'queued', attempts, error: `Qayta urinish (${attempts}/3): ${err.message}` });
                if (ok) setTimeout(() => push(id), 60e3 * attempts).unref?.();
                return;
            }
            await save({ status: 'error', attempts, error: err.message });
        };
        // Ish davomida ROP turini o'zgartirsa yoki qayta tahlil bossa (rev oshadi) — eski natija yozilmaydi.
        const save = fields => store.mutate(list => {
            const it = list.find(x => x.id === id);
            if (!it || (it.rev || 0) !== rev) return false;
            Object.assign(it, fields, { updatedAt: new Date().toISOString() });
            return true;
        });
        // Har bir AI chaqiruvi narxi (token × narx) Moliya'ga — server/services/aiCostFinance.js.
        const onUsage = onCost ? u => Promise.resolve(onCost({ analysisId: id, lang: item.lang, ...u })).catch(err => log.error('[callAi] narx', err.message)) : null;
        const recs = await db.getJsonData('callRecordings');
        const rec = (Array.isArray(recs) ? recs : []).find(r => r.id === item.recordingId);
        if (!rec) { await save({ status: 'error', error: 'Yozuv topilmadi (oʻchirilgan)' }); return; }
        const file = rec.url && rec.url.startsWith('/uploads/') ? path.join(uploadsDir, path.basename(rec.url)) : '';
        if (!file || !fs.existsSync(file)) { await save({ status: 'error', error: 'Audio fayl serverda topilmadi' }); return; }
        if (!env.GEMINI_API_KEY || !env.ANTHROPIC_API_KEY) { await save({ status: 'nokey', error: 'AI kalitlari ulanmagan' }); return; }

        // Tur o'zgarsa yoki e'tiroz qabul qilinsa — tayyor matn qayta ishlatiladi (faqat baho qayta).
        let transcript = item.hasTranscript ? await loadTranscript(id) : null;
        if (transcript && !transcript.segments?.length) transcript = null;
        if (!transcript) {
            await save({ status: 'transcribing', error: '' });
            try {
                transcript = await transcribe(fs.readFileSync(file), mimeOf(file), { env, fetchImpl, onUsage });
            } catch (err) { await failed(err); return; }
            // Matn alohida kalitda (ro'yxat yengil bo'lsin); ish davomida tur o'zgargan bo'lsa ham matn saqlanadi.
            await db.tx(async c => { await db.saveJsonData(c, TKEY + id, transcript); });
            await store.mutate(list => { const x = list.find(y => y.id === id); if (x) x.hasTranscript = true; });
            const nowRev = ((await store.all()).find(x => x.id === id) || {}).rev || 0;
            if (nowRev !== rev) return; // ROP turini o'zgartirdi — yangi navbat baholaydi, Claude chaqirilmaydi
        }
        const dur = item.durationSec || transcript.durationSec || 0; // telefon aytgan davomiylik ishonchliroq
        if (!transcript.segments.length || (dur && dur < MIN_SECONDS)) {
            await save({ status: 'skipped', durationSec: dur, error: dur && dur < MIN_SECONDS ? '30 soniyadan qisqa' : 'Suhbat eshitilmadi' });
            return;
        }

        await save({ status: 'scoring', durationSec: dur, transcribeModel: transcript.model || item.transcribeModel || '' });
        try {
            const lead = await db.getLeadById(item.leadId).catch(() => null);
            const earlier = (await store.all()).some(x => x.leadId === item.leadId && x.lang === item.lang && x.id !== id && x.status === 'done' && new Date(x.callAt) < new Date(item.callAt));
            const typeHint = typeHintFromStatus(lead?.status, earlier);
            const scriptBody = await scriptText(db, item.lang);
            const appealNote = item.appeal?.status === 'accepted' ? `mezon "${item.appeal.criterion}": ${item.appeal.text}` : '';
            const { model, result } = await score({ transcript, scriptBody, typeHint, forcedType: item.forcedType || '', appealNote, lead, managerName: item.managerName }, { env, fetchImpl, onUsage });
            let final = result;
            let appealUpd = {};
            if (item.appeal?.status === 'accepted' && (item.appeal.scoreAfter == null || item.appeal.mergedResult)) {
                // E'tiroz: faqat shu mezon qayta baholanadi, qolganlari o'zgarmaydi (AI natijasi har safar biroz farq qilishi mumkin).
                // Birinchi qabulda: eski natijaga faqat shu mezon qo'shiladi. Keyingi qayta tahlilda (ROP "Qayta tahlil"/tur):
                // yangi natijaga ROP tasdiqlagan mezon bahosi qaytariladi — qabul qilingan tuzatish yo'qolmaydi.
                final = item.appeal.scoreAfter == null
                    ? (mergeAppeal(item.result, result, item.appeal.criterion) || result)
                    : (mergeAppeal(result, item.appeal.mergedResult, item.appeal.criterion) || result);
                const kept = (final.criteria || []).find(c => c.name === item.appeal.criterion) || null;
                appealUpd = { appeal: { ...item.appeal, scoreAfter: final.score, mergedResult: kept ? { criteria: [kept], quotes: (final.quotes || []).filter(q => q.criterion === item.appeal.criterion) } : null } };
            }
            await save({ ...appealUpd, firstAnalyzedAt: item.firstAnalyzedAt || new Date().toISOString(), attempts: 0, status: final.gradable ? 'done' : 'skipped', result: final, scoreModel: model, typeHint, analyzedAt: new Date().toISOString(), error: final.gradable ? '' : final.notGradableReason });
        } catch (err) {
            await failed(err);
        }
    }

    // Server qayta ishga tushganda chala qolganlar navbatga qaytadi.
    async function resume() {
        const all = await store.all();
        all.filter(x => ['queued', 'transcribing', 'scoring'].includes(x.status) || (x.status === 'nokey' && env.GEMINI_API_KEY && env.ANTHROPIC_API_KEY))
            .forEach(x => { x.status = 'queued'; });
        const ids = all.filter(x => x.status === 'queued').map(x => x.id);
        if (!ids.length) return;
        await store.mutate(list => { list.forEach(x => { if (ids.includes(x.id)) x.status = 'queued'; }); });
        log.log(`[callAi] navbatga qaytdi: ${ids.length}`);
        ids.forEach(push);
    }

    async function retry(id) {
        const it = await store.mutate(list => {
            const x = list.find(y => y.id === id);
            if (x) Object.assign(x, { status: 'queued', error: '', attempts: 0, hasTranscript: false, rev: (x.rev || 0) + 1, updatedAt: new Date().toISOString() });
            return x ? { ...x } : null;
        });
        if (it) push(id);
        return it;
    }

    async function setType(id, type, by) {
        if (!TYPES[type]) throw new Error('Notoʻgʻri tur');
        const it = await store.mutate(list => {
            const x = list.find(y => y.id === id);
            if (x) Object.assign(x, { forcedType: type, typeChangedBy: by || '', status: 'queued', error: '', attempts: 0, rev: (x.rev || 0) + 1, updatedAt: new Date().toISOString() });
            return x ? { ...x } : null;
        });
        if (it) push(id);
        return it;
    }

    // Bir qatorni qulflab o'zgartirish; requeue=true — qayta tahlilga (rev oshadi).
    async function update(id, fn, requeue = false) {
        const it = await store.mutate(list => {
            const x = list.find(y => y.id === id);
            if (!x) return null;
            fn(x);
            x.updatedAt = new Date().toISOString();
            if (requeue) Object.assign(x, { status: 'queued', error: '', attempts: 0, rev: (x.rev || 0) + 1 });
            return { ...x };
        });
        if (it && requeue) push(id);
        return it;
    }

    // E'tiroz: menejer tahlildan keyin 48 soat ichida, bitta mezon bo'yicha, bir marta.
    // Tekshiruvlar qulf ichida (ikki marta bosilsa ikki e'tiroz/qaror bo'lmaydi).
    async function appeal(id, { criterion, text, by }) {
        const crit = String(criterion || '').slice(0, 120), why = String(text || '').trim().slice(0, 1000);
        if (!crit || why.length < 5) throw new Error('Mezon va sababni yozing');
        return update(id, x => {
            if (x.status !== 'done') throw new Error('Tahlil tugamagan');
            if (x.appeal) throw new Error('Eʼtiroz allaqachon yuborilgan');
            if (Date.now() - Date.parse(x.firstAnalyzedAt || x.analyzedAt || x.createdAt) > APPEAL_HOURS * 3600e3) throw new Error('48 soatlik muddat tugagan');
            if (!(x.result?.criteria || []).some(c => c.name === crit)) throw new Error('Bunday mezon yoʻq');
            x.appeal = { criterion: crit, text: why, by: by || '', at: new Date().toISOString(), status: 'pending', scoreBefore: x.result?.score ?? null };
        });
    }

    async function decideAppeal(id, { accept, note, by }) {
        return update(id, x => {
            if (!x.appeal || x.appeal.status !== 'pending') throw new Error('Kutilayotgan eʼtiroz yoʻq');
            Object.assign(x.appeal, { status: accept ? 'accepted' : 'rejected', decidedBy: by || '', decidedAt: new Date().toISOString(), note: String(note || '').slice(0, 500) });
        }, !!accept);
    }

    async function removeByRecording(recordingId) {
        const gone = await store.mutate(list => { const i = list.findIndex(x => x.recordingId === recordingId); return i >= 0 ? list.splice(i, 1)[0] : null; });
        if (gone?.hasTranscript && db.pool) await db.pool.query('DELETE FROM json_data WHERE key = $1', [TKEY + gone.id]).catch(() => {});
        return gone;
    }

    async function setTask(id, { text, due, by }) {
        const t = String(text || '').trim().slice(0, 600);
        if (t.length < 3) throw new Error('Topshiriq matnini yozing');
        return update(id, x => { x.task = { text: t, due: String(due || '').slice(0, 40), by: by || '', at: (x.task?.at) || new Date().toISOString(), editedAt: x.task ? new Date().toISOString() : null, seenAt: null }; });
    }

    async function taskSeen(id) { return update(id, x => { if (x.task && !x.task.seenAt) x.task.seenAt = new Date().toISOString(); }); }

    async function loadTranscript(id) {
        const t = await db.getJsonData(TKEY + id);
        return t && !Array.isArray(t) ? t : (Array.isArray(t) ? null : t);
    }

    async function byRecordingIds(ids) {
        const set = new Set(ids);
        const map = {};
        (await store.all()).forEach(x => { if (set.has(x.recordingId)) map[x.recordingId] = x; });
        return map;
    }

    return { enqueue, resume, retry, setType, appeal, decideAppeal, setTask, taskSeen, removeByRecording, byRecordingIds, loadTranscript, all: () => store.all(), store };
}

// Javobga chiqadigan qism (transkript alohida so'raladi — ro'yxat yengil bo'lsin).
function publicView(a, { withTranscript = false } = {}) {
    if (!a) return null;
    const out = {
        id: a.id, status: a.status, error: a.error || '', type: a.result?.type || a.typeHint || '',
        callAt: a.callAt, durationSec: a.durationSec || 0, managerId: a.managerId, managerName: a.managerName,
        result: a.result || null, analyzedAt: a.analyzedAt || null,
        scored: !!(a.firstAnalyzedAt || a.result), appeal: a.appeal || null, task: a.task || null, typeChangedBy: a.typeChangedBy || '',
        appealDeadline: (a.firstAnalyzedAt || a.analyzedAt) ? new Date(Date.parse(a.firstAnalyzedAt || a.analyzedAt) + APPEAL_HOURS * 3600e3).toISOString() : null,
        appealRopDeadline: a.appeal?.at ? new Date(Date.parse(a.appeal.at) + APPEAL_ROP_HOURS * 3600e3).toISOString() : null,
    };
    if (withTranscript) out.transcript = (withTranscript === true ? a.transcript : withTranscript)?.segments || [];
    return out;
}

module.exports = { createCallAi, publicView, gradeOf, mergeAppeal, typeHintFromStatus, normalizeResult, TYPES, AXES, MIN_SECONDS, APPEAL_HOURS, _test: { parseJsonLoose, htmlToText, transcribe, score } };
