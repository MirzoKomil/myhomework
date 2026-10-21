'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const staff = require('../server/services/domworkBot/staff');

test('ustoz botda o‘quvchilar ro‘yxatida telefon ko‘rmaydi', async () => {
    const queries = [];
    const db = { query: async (sql, params) => { queries.push(sql); return { rows: [{ id: 's1', name: 'Ali Valiyev', phone: '+998901234567', group_name: 'B-1', lesson_time: '18:30', main_teacher: 'Ustoz' }] }; } };
    const out = await staff.action(db, { role: 'teacher', employeeId: 't1' }, 'students');
    assert.match(out, /Ali Valiyev/);
    assert.doesNotMatch(out, /998|1234567/);
    assert.doesNotMatch(queries[0], /s\.phone/);
});

test('botda parolning o‘zi chatga yozilmaydi', () => {
    const src = fs.readFileSync(path.join(__dirname, '../server/services/domworkBot/handlers.js'), 'utf8');
    assert.doesNotMatch(src, /Parol: \$\{last4\}/);
});

test('kunlik hisobotda bosqichlar "hozirgi holat" deb ko‘rsatiladi va o‘zbekcha nomda', async () => {
    const db = { query: async sql => {
        if (/COUNT\(\*\) AS count,COALESCE\(SUM\(amount\)/.test(sql)) return { rows: [{ count: 2, amount: 3000000 }] };
        if (/GROUP BY status/.test(sql)) return { rows: [{ status: 'sinov-darsida', count: 4 }] };
        if (/FROM leads WHERE language='russian' AND deleted_at IS NULL\s+AND \(created_at/.test(sql)) return { rows: [{ count: 7 }] };
        if (/FROM students/.test(sql)) return { rows: [] };
        return { rows: [] };
    } };
    const out = await staff.action(db, { role: 'rop' }, 'income', { now: new Date('2026-10-21T10:00:00Z'), daily: true });
    assert.match(out, /Shu davrda kelgan lidlar: 7/);
    assert.match(out, /Lidlar hozir qaysi bosqichda \(barchasi\):\nSinov darsida: 4/);
});
