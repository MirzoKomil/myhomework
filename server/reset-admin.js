#!/usr/bin/env node
// Admin parolini qayta o'rnatish uchun bir martalik skript
// Serverda ishlatish: node server/reset-admin.js [yangi-parol]
// Misol: node server/reset-admin.js admin123

const bcrypt = require('bcryptjs');

const newPassword = process.argv[2] || 'admin123';
if (newPassword.length < 4) {
    console.error('Parol kamida 4 ta belgidan iborat bo\'lishi kerak');
    process.exit(1);
}

const { db } = require('./db');

const admin = db.prepare("SELECT * FROM users WHERE email = 'admin'").get();
if (!admin) {
    const { randomUUID } = require('crypto');
    db.prepare(
        'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
    ).run(randomUUID(), 'Asosiy Admin', 'admin', bcrypt.hashSync(newPassword, 10), 'admin');
    console.log(`Admin yaratildi. Login: admin | Parol: ${newPassword}`);
} else {
    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?')
        .run(bcrypt.hashSync(newPassword, 10), 'admin');
    console.log(`Admin paroli yangilandi. Login: admin | Parol: ${newPassword}`);
}

process.exit(0);
