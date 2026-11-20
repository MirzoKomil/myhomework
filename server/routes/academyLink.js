// Domwork Academy (alohida ilova, o'z Railway servisi) bilan bog'lanish.
//
// Academy xodimni CRM login/paroli bilan kiritadi (/api/auth/login), keyin
// shu yerdan server-to-server so'raydi. Kalit: ACADEMY_LINK_KEY (X-Api-Key yoki
// Bearer). Kalit o'rnatilmagan bo'lsa — endpointlar butunlay yopiq (fail-closed).
//
//   GET  /api/academy-link/top-calls?month=YYYY-MM&lang=russian
//        Oyning eng yaxshi 10 ta (AI baholagan) qo'ng'irog'i. Mijoz ismi/telefoni
//        BERILMAYDI — faqat menejer, ball, bosqichlar, audio va transkript.
//   GET  /api/academy-link/status            — barcha xodimlarning Academy holati
//   POST /api/academy-link/status            — { userId, stage, track, score, examLeadIds, note }
//        stage: learning | exam | ready | update_pending
//
// "Ishga ruxsat" (darvoza): ACADEMY_GATE=1 bo'lsa, Academy'da ro'yxatda turgan
// va stage !== 'ready' bo'lgan sotuv menejeriga yangi lid biriktirib bo'lmaydi
// (imtihon uchun ROP bergan lid — examLeadIds — bundan mustasno). Academy'da
// umuman yo'q eski xodimlarga hech qanday ta'sir yo'q.
const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();
const KEY = process.env.ACADEMY_LINK_KEY || '';
const STATUS_KEY = 'academyStatus';
const STAGES = ['learning', 'exam', 'ready', 'update_pending'];

if (!KEY) console.warn('[academy-link] ACADEMY_LINK_KEY o\'rnatilmagan — /api/academy-link yopiq.');

function keyRequired(req, res, next) {
    const auth = req.headers.authorization || '';
    const given = String(req.headers['x-api-key'] || (auth.startsWith('Bearer ') ? auth.slice(7) : ''));
    const a = Buffer.from(given), b = Buffer.from(KEY);
    if (!KEY || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'Academy kaliti noto\'g\'ri' });
    }
    next();
}
router.use(keyRequired);

function monthRange(m) {
    const ok = /^\d{4}-\d{2}$/.test(String(m || ''));
    const now = new Date();
    const y = ok ? Number(m.slice(0, 4)) : now.getUTCFullYear();
    const mo = ok ? Number(m.slice(5, 7)) - 1 : now.getUTCMonth();
    return { from: Date.UTC(y, mo, 1), to: Date.UTC(y, mo + 1, 1), month: `${y}-${String(mo + 1).padStart(2, '0')}` };
}

router.get('/top-calls', async (req, res) => {
    try {
        const { getCallAi } = require('./callAi');
        const { from, to, month } = monthRange(req.query.month);
        const lang = ['russian', 'english'].includes(req.query.lang) ? req.query.lang : null;
        const min = Math.max(0, Math.min(100, Number(req.query.min) || 0));
        const all = await getCallAi().all();
        const picked = all.filter(a => {
            const t = Date.parse(a.callAt) || 0;
            return a.result && a.result.gradable && a.result.score != null && a.result.score >= min
                && t >= from && t < to && (!lang || a.lang === lang);
        }).sort((x, y) => y.result.score - x.result.score || (y.durationSec || 0) - (x.durationSec || 0));
        // Bitta menejerdan ko'pi bilan 3 ta — top-10 xilma-xil bo'lsin.
        const per = new Map(); const top = [];
        for (const a of picked) {
            const n = per.get(a.managerId) || 0;
            if (n >= 3) continue;
            per.set(a.managerId, n + 1); top.push(a);
            if (top.length >= 10) break;
        }
        const recs = await db.getJsonData('callRecordings');
        const recMap = new Map((Array.isArray(recs) ? recs : []).map(r => [r.id, r]));
        const out = [];
        for (const a of top) {
            const tr = await getCallAi().loadTranscript(a.id).catch(() => null);
            const r = a.result;
            out.push({
                id: a.id, callAt: a.callAt, durationSec: a.durationSec || 0, lang: a.lang,
                managerId: a.managerId, managerName: a.managerName || '',
                type: r.type, typeLabel: r.typeLabel, score: r.score, grade: r.grade,
                criteria: r.criteria, good: r.good, steps: r.steps, quotes: r.quotes,
                audioUrl: recMap.get(a.recordingId)?.url || '',
                transcript: (tr?.segments || []).slice(0, 400),
            });
        }
        res.json({ month, count: out.length, calls: out });
    } catch (err) {
        console.error('GET /api/academy-link/top-calls', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

router.get('/status', async (req, res) => {
    try {
        const list = await db.getJsonData(STATUS_KEY);
        res.json({ list: Array.isArray(list) ? list : [] });
    } catch (err) { res.status(500).json({ error: 'Xatolik' }); }
});

router.post('/status', async (req, res) => {
    try {
        const b = req.body || {};
        const userId = String(b.userId || '').trim();
        if (!userId) return res.status(400).json({ error: 'userId kerak' });
        if (!STAGES.includes(b.stage)) return res.status(400).json({ error: 'stage noto\'g\'ri' });
        const user = await db.findUserById(userId);
        if (!user) return res.status(404).json({ error: 'Xodim topilmadi' });
        const salesManagerId = user.role === 'sales_manager' ? (await db.getSalesManagerIdForUser(userId)) || '' : '';
        const saved = await db.mutateJsonData(STATUS_KEY, list => {
            const i = list.findIndex(x => x.userId === userId);
            const prev = i >= 0 ? list[i] : {};
            const next = {
                ...prev, userId, name: user.name, role: user.role, salesManagerId,
                track: String(b.track || prev.track || ''), stage: b.stage,
                score: b.score == null ? (prev.score ?? null) : Number(b.score),
                examLeadIds: Array.isArray(b.examLeadIds) ? b.examLeadIds.map(String).slice(0, 5) : (prev.examLeadIds || []),
                note: String(b.note || '').slice(0, 300),
                readyAt: b.stage === 'ready' ? (prev.stage === 'ready' ? prev.readyAt : new Date().toISOString()) : (prev.readyAt || null),
                updatedAt: new Date().toISOString(),
            };
            if (i >= 0) list[i] = next; else list.push(next);
            return next;
        });
        res.json({ ok: true, status: saved });
    } catch (err) {
        console.error('POST /api/academy-link/status', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// leads.js PATCH chaqiradi: lidni shu menejerga berish mumkinmi?
async function assertLeadAllowed(prevLead, lead) {
    if (process.env.ACADEMY_GATE !== '1') return;
    const mid = String(lead?.managerId || '');
    if (!mid || mid === String(prevLead?.managerId || '')) return;
    const list = await db.getJsonData(STATUS_KEY).catch(() => []);
    const st = (Array.isArray(list) ? list : []).find(x => x.salesManagerId === mid);
    if (!st || st.stage === 'ready') return;
    if ((st.examLeadIds || []).includes(String(lead.id || prevLead?.id || ''))) return;
    const why = st.stage === 'update_pending' ? 'yangilanish testini topshirmagan' : 'Academy imtihonidan hali o\'tmagan';
    const err = new Error(`${st.name || 'Bu menejer'} ${why} — unga lid berib bo'lmaydi.`);
    err.status = 409; err.code = 'ACADEMY_GATE';
    throw err;
}

module.exports = { router, assertLeadAllowed };
