'use strict';
// Statistika: Telegram bot voronkasi (faqat o'qish). Manba: domwork_bot_visitors, davr start bosilgan kun bo'yicha (Toshkent).
const express = require('express');
const { authRequired } = require('../middleware/auth');
const { pool } = require('../db');
const ropScope = require('../services/ropScope');
const router = express.Router();
const ROLES = new Set(['admin', 'boshliq', 'rop', 'targetolog']);
const day = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const WHERE = "($1::date IS NULL OR (created_at AT TIME ZONE 'Asia/Tashkent')::date >= $1::date) AND ($2::date IS NULL OR (created_at AT TIME ZONE 'Asia/Tashkent')::date <= $2::date)";
router.get('/', authRequired, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        if (!ROLES.has(req.user.role)) return res.status(403).json({ error: 'Ruxsat yoʻq' });
        if (req.user.role === 'rop') {
            const langs = await ropScope.ropLangsFor(pool, req.user);
            if (Array.isArray(langs) && !langs.includes('russian')) return res.status(403).json({ error: 'Bot faqat rus tili uchun' });
        }
        if (!(await pool.query("SELECT to_regclass('domwork_bot_visitors') AS t")).rows[0]?.t) return res.json({ leadIds: [] });
        const params = [day(req.query.from), day(req.query.to)];
        const row = (await pool.query(`SELECT COUNT(*)::int AS start, COUNT(lesson_seen_at)::int AS lesson, COUNT(quiz_done_at)::int AS quiz,
            COUNT(guide_at)::int AS guide, COUNT(price_at)::int AS price, COUNT(*) FILTER (WHERE phone <> '')::int AS phone,
            COUNT(requested_at)::int AS request, COUNT(lead_id)::int AS lead, COUNT(*) FILTER (WHERE source <> 'organic')::int AS target,
            COUNT(*) FILTER (WHERE source = 'organic')::int AS organic, COUNT(*) FILTER (WHERE paused)::int AS paused,
            COUNT(blocked_at)::int AS blocked FROM domwork_bot_visitors WHERE ${WHERE}`, params)).rows[0];
        const ids = (await pool.query(`SELECT lead_id FROM domwork_bot_visitors WHERE lead_id IS NOT NULL AND ${WHERE}`, params)).rows.map(r => r.lead_id);
        res.json({ ...row, leadIds: ids });
    } catch (e) {
        console.error('[bot-funnel]', e);
        res.status(500).json({ error: 'Bot statistikasi yuklanmadi' });
    }
});
module.exports = router;
