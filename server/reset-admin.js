#!/usr/bin/env node
// Admin parolini qayta o'rnatish
// Ishlatish: node server/reset-admin.js [yangi-parol]
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const newPassword = process.argv[2] || 'admin123';
if (newPassword.length < 4) { console.error('Parol kamida 4 belgi'); process.exit(1); }

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

(async () => {
    const { rows } = await pool.query("SELECT id FROM users WHERE email = 'admin'");
    const hash = bcrypt.hashSync(newPassword, 10);
    if (rows.length) {
        await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'admin']);
        console.log(`Admin paroli yangilandi: admin / ${newPassword}`);
    } else {
        const { randomUUID } = require('crypto');
        await pool.query(
            'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
            [randomUUID(), 'Asosiy Admin', 'admin', hash, 'admin']
        );
        console.log(`Admin yaratildi: admin / ${newPassword}`);
    }
    await pool.end();
})().catch(err => { console.error(err.message); process.exit(1); });
