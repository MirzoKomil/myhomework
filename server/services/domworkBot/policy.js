'use strict';
const { timingSafeEqual } = require('node:crypto');
const ROLES = ['admin', 'rop', 'sales', 'marketing', 'teacher', 'assistant', 'student', 'trial'];
const GROUP_TYPES = ['trial', 'classroom', 'sales', 'marketing', 'teachers', 'family', 'beacon'];
const MENUS = {
    trial: [['trial-group','👥 Sinov darsi guruhi'],['course','📚 Kurs haqida ma’lumot'],['platform','💻 Platforma haqida ma’lumot'],['contact','📞 Bog‘lanish'],['results','🏆 Natijalar']],
    student: [['credentials','🔑 Login & Parol'],['grades','📊 Natijalari & Baholari'],['groups','👥 Guruh va Kanallar'],['schedule','📅 Dars jadvali'],['payments','💳 Mening to‘lovim'],['contract','📄 Shartnoma'],['book','📦 Kitobim qayerda?'],['attendance','✅ Attendance (Davomat)']],
    sales: [['salary','💰 Mening maoshim'],['ranking','🏆 Reytingim'],['plan','🎯 Sotuv rejasi'],['work','⏰ Ish jadvali / Face ID'],['leave','📝 Ruxsat so‘rash'],['students','👥 Mening o‘quvchilarim'],['debtors','⏳ Qarzdorlarim'],['bonuses','🎁 Bonuslar ro‘yxati']],
    teacher: [['students','🎓 O‘quvchilarim ro‘yxati'],['salary','💵 Maoshim'],['ranking','⭐️ Reytingim'],['trial-lessons','🧪 Sinov darsi'],['schedule','🕒 Dars vaqtlari'],['groups','📚 Dars guruhlari'],['work','⏰ Face ID davomat'],['leave','📝 Ruxsat so‘rash']],
    assistant: [['students','👥 O‘quvchilarim ro‘yxati'],['salary','💵 Maoshim'],['ranking','⭐️ Reyting'],['schedule','🕒 Bo‘sh vaqtlar'],['work','⏰ Face ID'],['leave','📝 Ruxsat so‘rash']],
    rop: [['salary','💼 Maosh & Reja'],['managers','👥 Menejerlar ro‘yxati'],['reports','📊 Har bir menejer hisoboti'],['debtors','📉 Qarzdorlar umumiy ro‘yxati'],['income','💰 Umumiy tushum — Qarz balansi'],['trial-lessons','🧪 Sinov darslari monitoringi'],['bonuses','🎁 Bonuslar ro‘yxati'],['work','⏰ Face ID']],
    marketing: [['funnel','🌪 Sotuv voronkasi'],['daily','📈 Kunlik statistika'],['history','📅 Tarix (Haftalik / Oylik)'],['budget','💵 Byudjet va Sarf']],
    admin: [['broadcast','📣 Xabar tarqatish'],['bindings','🔗 Guruhlarni bog‘lash'],['leave-review','📝 Ruxsat arizalari'],['digest','📊 Umumiy hisobot'],['configuration','⚙️ Bot sozlamalari']]
};
function error(status, message) { return Object.assign(new Error(message), { status }); }
function phone(raw) {
    const source = String(raw || '').trim();
    if (!/^\+?[0-9\s().-]+$/.test(source)) return '';
    let value = source.replace(/\D/g, '');
    if (value.length === 9 && !String(raw).trim().startsWith('+')) value = '998' + value;
    return /^[1-9]\d{6,14}$/.test(value) ? value : '';
}
function telegramId(raw) {
    const value = String(raw ?? '');
    return /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value)) ? value : '';
}
function contactIdentity(message) {
    const id = telegramId(message?.from?.id);
    if (!id || message.chat?.type !== 'private' || String(message.chat.id) !== id
        || telegramId(message.contact?.user_id) !== id || message.forward_origin) {
        throw error(400, 'Faqat o‘zingizning kontaktingizni maxsus tugma orqali yuboring');
    }
    const number = phone(message.contact.phone_number);
    if (!number) throw error(400, 'Telefon raqami noto‘g‘ri');
    return { telegramId: id, phone: number };
}
function staffRole(row) {
    if (!row || row.employee_status === 'inactive') return null;
    if (row.role === 'admin') return 'admin';
    if (row.role === 'rop') return 'rop';
    if (row.role === 'sales_manager') return 'sales';
    if (row.role === 'targetolog') return 'marketing';
    if (row.role === 'teacher') return row.employee_role === 'yordamchi' ? 'assistant'
        : ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi'].includes(row.employee_role) ? 'teacher' : null;
    return null;
}
function activeStudent(row) {
    const data = row?.extra_data || {};
    return !!row && !!data.passwordHash && Number(data.paidAmount) > 0
        && data.isStaffDemo !== true && data.frozen !== true && data.status !== 'inactive';
}
function choose(candidates) {
    const valid = candidates.filter(c => ROLES.includes(c.role));
    if (!valid.length) throw error(404, 'Faol CRM akkaunti topilmadi. @domwork_admin bilan bog‘laning');
    const best = Math.min(...valid.map(c => ROLES.indexOf(c.role)));
    const preferred = valid.filter(c => ROLES.indexOf(c.role) === best);
    // Two real CRM identities sharing a phone must be resolved by an administrator.
    const distinct = new Map(preferred.map(c => [c.kind + ':' + c.id, c]));
    if (distinct.size !== 1) throw error(409, 'Telefon bir nechta akkauntga bog‘langan. Administrator tekshirsin');
    return [...distinct.values()][0];
}
function menu(identity) {
    const rows = [...(MENUS[identity?.role] || [])];
    // 29-okt: asosiy ustoz yordamchi bo'la olmaydi — "Yordamchi ustozlik" menyusi (ikkilamchi rol) o'chirildi.
    return rows;
}
function requireAction(identity, action) {
    if (!menu(identity).some(([id]) => id === action)) throw error(403, 'Bu bo‘limga ruxsat yo‘q');
}
function secretMatches(expected, actual) {
    if (typeof expected !== 'string' || expected.length < 32 || typeof actual !== 'string') return false;
    const a = Buffer.from(expected), b = Buffer.from(actual);
    return a.length === b.length && timingSafeEqual(a, b);
}
function today(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = key => parts.find(p => p.type === key).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}
function monthPeriod(now = new Date()) {
    const start = today(now).slice(0, 7) + '-01';
    const [y,m] = start.split('-').map(Number);
    return { start, end: `${start.slice(0,7)}-${new Date(Date.UTC(y,m,0)).getUTCDate()}` };
}
module.exports = { ROLES, GROUP_TYPES, MENUS, error, phone, telegramId, contactIdentity, staffRole, activeStudent, choose, menu, requireAction, secretMatches, today, monthPeriod };
