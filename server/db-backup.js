#!/usr/bin/env node
// Ma'lumotlar bazasini zaxiralash (backup) skripti
// Ishlatish: node server/db-backup.js [backup-papka]
// Cron misoli (har kuni soat 03:00): 0 3 * * * node /app/server/db-backup.js

const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(__dirname, '..', 'data', 'myhomework.db');

const BACKUP_DIR = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(path.dirname(DB_PATH), 'backups');

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

if (!fs.existsSync(DB_PATH)) {
    console.error(`DB topilmadi: ${DB_PATH}`);
    process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const time = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
const backupName = `myhomework-${date}-${time}.db`;
const backupPath = path.join(BACKUP_DIR, backupName);

fs.copyFileSync(DB_PATH, backupPath);
console.log(`Backup saqlandi: ${backupPath}`);

// Eski backuplarni tozalash (30 kundan ko'proq)
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30', 10);
const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('myhomework-') && f.endsWith('.db'))
    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

if (files.length > MAX_BACKUPS) {
    files.slice(MAX_BACKUPS).forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f.name));
        console.log(`O'chirildi (eski backup): ${f.name}`);
    });
}
