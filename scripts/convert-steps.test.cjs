// SotuvKonversiya qadamlari (js/convertUI.js): bajarilmagan qadam "✓" bo'lmaydi (audit: to'g'ridan-to'g'ri
// openPaymentOnboardingModal chaqirilsa 3–4-qadamlar ✓ ko'rinardi).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function load() {
    const window = {};
    const ctx = vm.createContext({ window, document: { getElementById: () => null }, console });
    window.leadHasTeacherSchedule = lead => Boolean(lead?.paymentOnboarding?.teacherId && lead.paymentOnboarding.lessonDayOfWeek != null && lead.paymentOnboarding.lessonTime && !lead.paymentOnboarding.isTrial);
    ctx.leadHasTeacherSchedule = window.leadHasTeacherSchedule;
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/convertUI.js'), 'utf8'), ctx);
    return window.convertUI;
}
const done = html => [...html.matchAll(/class="cv-chip is-done"[^>]*>✓ ([^<]+)</g)].map(m => m[1].replace(/&#39;/g, "'"));

test('bajarilmagan 3–5-qadamlar ✓ emas', () => {
    const cv = load();
    const lead = { trialRequest: { state: 'completed', attended: true, teacherId: 't1', scheduledAt: '2026-10-27T10:30:00Z' }, paymentOnboarding: { teacherId: 't1', isTrial: true } };
    assert.deepEqual(done(cv.steps(6, lead)), ['Sinov', 'Natija']);
    assert.deepEqual(done(cv.steps(5, lead)), ['Sinov', 'Natija']);
});

test('haqiqatan bajarilgan qadamlar ✓', () => {
    const cv = load();
    const lead = { trialRequest: { state: 'completed', attended: true, teacherId: 't1', scheduledAt: '2026-10-27T10:30:00Z' },
        paymentOnboarding: { teacherId: 't1', lessonDayOfWeek: 1, lessonTime: '18:00', telegramGroupLink: 'https://t.me/+abcdefgh', telegramGroupName: 'C40' }, paymentSurvey: { paidAmount: 300000 } };
    assert.deepEqual(done(cv.steps(6, lead)), ['Sinov', 'Natija', 'Tarif va jadval', 'To\'lov', 'Telegram guruh']);
    const noPay = { ...lead, paymentSurvey: undefined };
    assert.deepEqual(done(cv.steps(6, noPay)), ['Sinov', 'Natija', 'Tarif va jadval', 'Telegram guruh']);
});
