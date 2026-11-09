'use strict';
// Statistika: davrdagi to'lovlar lid bo'yicha jamlangan (faqat o'qish). Eski lidlarning qarz to'lovlarini Tushumga qo'shish uchun.
// Bekor qilingan va tekshiruvdagi yozuvlar kirmaydi; to'lov ro'yxati ochilmaydi.
const express = require('express');
const { authRequired } = require('../middleware/auth');
const { pool } = require('../db');
const ropScope = require('../services/ropScope');
const router = express.Router();
const ROLES = new Set(['admin', 'boshliq', 'rop', 'targetolog', 'sales_manager']);
const day = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
router.get('/', authRequired, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        if (!ROLES.has(req.user.role)) return res.status(403).json({ error: 'Ruxsat yoʻq' });
        const langs = req.user.role === 'rop' ? await ropScope.ropLangsFor(pool, req.user) : null;
        let manager = null;
        if (req.user.role === 'sales_manager') {
            const u = (await pool.query('SELECT COALESCE(link.manager_id,he.id) AS manager_id FROM users u LEFT JOIN hr_employees he ON LOWER(TRIM(he.login))=LOWER(TRIM(u.email)) LEFT JOIN user_sales_manager_links link ON link.user_id=u.id WHERE u.id=$1', [req.user.id])).rows[0];
            if (!u || !u.manager_id) return res.json({ rows: [] });
            manager = String(u.manager_id);
        }
        const rows = (await pool.query(
            'SELECT r.lead_id, SUM(r.amount)::bigint AS amount FROM payment_records r WHERE r.lead_id IS NOT NULL AND NOT r.legacy_review AND NOT EXISTS (SELECT 1 FROM payment_record_voids v WHERE v.record_id=r.id) AND ($1::date IS NULL OR r.paid_date >= $1::date) AND ($2::date IS NULL OR r.paid_date <= $2::date) AND ($3::text[] IS NULL OR r.language = ANY($3::text[])) AND ($4::text IS NULL OR r.manager_id = $4::text) GROUP BY r.lead_id',
            [day(req.query.from), day(req.query.to), Array.isArray(langs) ? langs : null, manager]
        )).rows;
        res.json({ rows: rows.map(r => ({ leadId: r.lead_id, amount: Number(r.amount) })) });
    } catch (e) {
        console.error('[sales-cash]', e.message);
        res.status(500).json({ error: 'Tushumni yuklab boʻlmadi' });
    }
});
module.exports = router;
