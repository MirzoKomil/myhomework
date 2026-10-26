'use strict';
// So'rov konteksti: kim amal bajaryapti. Arxivga yozuv tushganda "kim
// o'chirdi" ma'lumoti har bir DB funksiyasiga actor uzatmasdan ham shu
// yerdan olinadi. index.js har bir so'rovni run() ichida boshlaydi,
// authRequired esa token tekshirilgach setActor() chaqiradi.
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

function middleware(req, res, next) {
    als.run({ actor: null, ip: req.ip || '' }, next);
}

function setActor(user) {
    const store = als.getStore();
    if (store && user) store.actor = { id: String(user.id || ''), role: String(user.role || ''), email: String(user.email || '') };
}

function currentActor() {
    return als.getStore()?.actor || null;
}

// Tizim ishlari (cron, bot, migratsiya) uchun aniq actor bilan ishga tushirish.
function runAs(actor, fn) {
    return als.run({ actor: actor ? { id: String(actor.id || ''), role: String(actor.role || ''), email: String(actor.email || '') } : null }, fn);
}

module.exports = { middleware, setActor, currentActor, runAs };
