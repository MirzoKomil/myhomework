'use strict';
// Sinov darsi vaqti botda CRM'dagi bilan bir xil chiqishi kerak.
// CRM vaqtni toISOString() (UTC, "…Z") qilib saqlaydi — bot uni Toshkent vaqtiga o'girishi shart.
const assert = require('node:assert/strict');
const T = require('../server/services/domworkBot/tone');

// Menejer 15:00 ni tanladi → CRM "2026-10-31T10:00:00.000Z" saqlaydi.
assert.equal(T.when('2026-10-31T10:00:00.000Z'), '31-oktyabr, shanba · 15:00');
assert.equal(T.when('2026-10-31T10:00:00Z'), '31-oktyabr, shanba · 15:00');
assert.equal(T.when('2026-10-31T15:00:00+05:00'), '31-oktyabr, shanba · 15:00');
assert.equal(T.when('2026-10-31T15:00:00+0500'), '31-oktyabr, shanba · 15:00');
// Kech sinov — kun ham Toshkent bo'yicha almashadi.
assert.equal(T.when('2026-10-31T19:30:00.000Z'), '1-noyabr, yakshanba · 00:30');
// Zonasiz qiymat avvalgidek Toshkent mahalliy vaqti deb o'qiladi.
assert.equal(T.when('2026-10-31T15:00'), '31-oktyabr, shanba · 15:00');
assert.equal(T.when('2026-10-31 15:00'), '31-oktyabr, shanba · 15:00');
assert.equal(T.when('2026-10-31'), '31-oktyabr, shanba');
assert.equal(T.when(new Date('2026-10-31T10:00:00Z')), '31-oktyabr, shanba · 15:00');

console.log('domwork-bot-trial-time: OK');
