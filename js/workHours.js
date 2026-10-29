// Ish vaqti satri ("Du·Ch·Ju 12:00–20:00 · Se·Pa·Sh 10:00–20:00") — YAGONA formatlovchi.
// UstozJadval sarlavhasi (js/scheduleV2.js) va Profil "Ish vaqti" qatori (server/services/staffSettings.js) shu
// funksiyadan foydalanishi kerak. Bir kundagi ustma-ust / tutash oraliqlar birlashtiriladi (shablonda ikki yozuv bo'lsa ham
// ustoz bitta haqiqiy ish vaqtini ko'radi), keyin bir xil oraliqli kunlar guruhlanadi.
// hours: [{ weekday 1–7, start_min, end_min }] (school_teacher_hours qatorlari).
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.WorkHours = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const DAY = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    // weekday → [[start, end], ...] (birlashtirilgan, tartiblangan)
    function merged(hours) {
        const by = new Map();
        for (const h of hours || []) {
            const w = Number(h.weekday), a = Number(h.start_min ?? h.start), b = Number(h.end_min ?? h.end);
            if (!(w >= 1 && w <= 7) || !Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue;
            if (!by.has(w)) by.set(w, []);
            by.get(w).push([a, b]);
        }
        for (const [w, list] of by) {
            list.sort((x, y) => x[0] - y[0]);
            const out = [];
            for (const r of list) { const last = out[out.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else out.push([...r]); }
            by.set(w, out);
        }
        return by;
    }
    function text(hours) {
        const by = merged(hours), groups = new Map();
        for (const w of [...by.keys()].sort((a, b) => a - b)) {
            const k = by.get(w).map(([a, b]) => `${hm(a)}–${hm(b)}`).join(', ');
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(DAY[w - 1]);
        }
        return [...groups].map(([k, ds]) => `${ds.join('·')} ${k}`).join(' · ');
    }
    return Object.freeze({ merged, text });
});
