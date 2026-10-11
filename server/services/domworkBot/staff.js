'use strict';
const policy = require('./policy');
const payroll = require('../payroll');
const groups = require('../domworkGroups');
const money = value => new Intl.NumberFormat('uz-UZ').format(Number(value) || 0).replace(/[\u00a0\u202f]/g,' ') + ' UZS';
const safe = value => String(value ?? '').slice(0,200);
const none = 'Hozircha ma’lumot yo‘q.';
function salary(row) {
    if (!row) return 'Xodim uchun KPI hisob-kitobi topilmadi. HRdagi KPI biriktirishni tekshiring.';
    return `Fiksa: ${money(row.fixed)}\nAylanma: ${money(row.turnover)}\n`
        + `Komissiya: ${money(row.commission)}\nBonus: ${money(row.bonus)}\n`
        + (row.mainTotal != null ? `Asosiy ustozlik: ${money(row.mainTotal)}\nYordamchi ustozlik: ${money(row.assistantTotal)}\n` : '')
        + `Jami: ${money(row.total)}${row.blocked ? '\nReja hali tasdiqlanmagan.' : ''}`;
}
async function action(db, identity, actionId) {
    policy.requireAction(identity, actionId);
    if (['salary','ranking','plan','bonuses','managers'].includes(actionId) && ['sales','rop','teacher','assistant'].includes(identity.role)) {
        const period = policy.monthPeriod();
        const calculation = await payroll.calculate(db, period, 'russian');
        const own = calculation.rows.find(r => r.employeeId === identity.employeeId || (identity.role === 'sales' && r.employeeId === identity.managerId));
        if (actionId === 'salary') return `Davr: ${period.start} — ${period.end}\n` + salary(own);
        if (actionId === 'ranking') {
            if (identity.role !== 'sales') {
                const main = (await db.query("SELECT data FROM json_data WHERE key='liveGrades'")).rows[0]?.data || {};
                const scores = Object.values(main).flat().filter(g => g.teacherId === identity.employeeId)
                    .map(g => Number(g.studentRatingOfTeacher?.overall)).filter(Number.isFinite);
                return scores.length ? `O‘quvchilar bahosi: ${(scores.reduce((s,n)=>s+n,0)/scores.length).toFixed(1)}\nBaholar soni: ${scores.length}` : none;
            }
            const ranked = calculation.rows.filter(r => r.role === 'sales').sort((a,b)=>b.turnover-a.turnover);
            const index = ranked.findIndex(r => r.employeeId === own?.employeeId);
            return index < 0 ? none : `O‘rningiz: ${index+1}/${ranked.length}\nAylanmangiz: ${money(own.turnover)}\nDaromadingiz: ${money(own.total)}`;
        }
        if (actionId === 'bonuses') return `Joriy oy hisoblangan bonus: ${money(own?.bonus)}\nBonuslar KPI modulidan olindi.`;
        if (actionId === 'managers') return calculation.rows.filter(r => r.role === 'sales').map(r => `${safe(r.name)}: ${money(r.turnover)} · Maosh: ${money(r.total)}`).join('\n') || none;
        if (actionId === 'plan') return `Bo‘lim rejasi: ${calculation.plan?.current == null ? 'Belgilanmagan' : money(calculation.plan.current)}\n`
            + `Shaxsiy aylanma: ${money(own?.turnover)}\nShaxsiy reja CRMda alohida kiritilmagan bo‘lsa taxmin qilinmaydi.`;
    }
    if (['students','assistant-duty','debtors'].includes(actionId)) {
        const teaching = ['teacher','assistant'].includes(identity.role);
        if (teaching) {
            if (!identity.employeeId) return none;
            const assistant = actionId === 'assistant-duty' || identity.role === 'assistant';
            const rows = (await db.query(`SELECT s.id,s.name,s.phone,s.group_name,s.lesson_time,h.name AS main_teacher
                FROM students s LEFT JOIN hr_employees h ON h.id=s.teacher_id
                WHERE s.subject='russian' AND ${assistant ? 's.assistant_teacher_id' : 's.teacher_id'}=$1 ORDER BY s.name LIMIT 100`, [identity.employeeId])).rows;
            return rows.map(r => `${safe(r.name)} · ${safe(r.phone)}\n${safe(r.group_name)} · ${safe(r.lesson_time)}${assistant ? '\nAsosiy ustoz: '+safe(r.main_teacher) : ''}`).join('\n\n') || none;
        }
        if (!['sales','rop'].includes(identity.role)) throw policy.error(403, 'Ruxsat yo‘q');
        const rows = (await db.query(`SELECT id,name,phone,extra_data FROM students WHERE subject='russian'
            AND ($1::boolean OR extra_data->>'managerId'=$2) ORDER BY name LIMIT 200`, [identity.role === 'rop',identity.managerId || ''])).rows;
        return rows.filter(r => actionId !== 'debtors' || Number(r.extra_data?.debtAmount)>0)
            .map(r => `${safe(r.name)} · ${safe(r.phone)}${actionId === 'debtors' ? '\nQarz: '+money(r.extra_data.debtAmount)+' · '+safe(r.extra_data.paymentDueDate) : ''}`).join('\n\n') || none;
    }
    if (actionId === 'groups' && identity.role === 'teacher') {
        const links = [];
        for (const type of ['trial','classroom']) {
            const group = await groups.defaultForTeacher(db,type,identity.employeeId);
            if (group) links.push(`${type === 'trial' ? 'Sinov' : 'Asosiy'}: ${group.inviteLink}`);
        }
        return links.join('\n') || none;
    }
    if (actionId === 'schedule' && ['teacher','assistant'].includes(identity.role)) {
        const rows = (await db.query('SELECT date,time FROM timetable WHERE teacher_id=$1 ORDER BY date,time LIMIT 100', [identity.employeeId || ''])).rows;
        return rows.map(r => `${safe(r.date)} · ${safe(r.time)}`).join('\n') || none;
    }
    if (actionId === 'trial-lessons' && ['teacher','rop'].includes(identity.role)) {
        const rows = (await db.query("SELECT name,extra_data FROM leads WHERE language='russian' AND status='sinov-darsida' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200")).rows;
        return rows.filter(r => identity.role === 'rop' || r.extra_data?.trialRequest?.teacherId === identity.employeeId)
            .map(r => `${safe(r.name)} · ${safe(r.extra_data?.trialRequest?.scheduledAt)} · ${safe(r.extra_data?.trialRequest?.state)}\nTasdiqlash/natija: CRM → Sinov darslari`).join('\n\n') || none;
    }
    if (['income','digest','daily','history','funnel','reports'].includes(actionId) && ['admin','rop','marketing'].includes(identity.role)) {
        const period = policy.monthPeriod();
        const totals = (await db.query(`SELECT COUNT(*) AS count,COALESCE(SUM(amount),0) AS amount FROM payment_records
            WHERE language='russian' AND paid_date BETWEEN $1 AND $2`, [actionId === 'daily' ? policy.today() : period.start,period.end])).rows[0];
        const counts = (await db.query("SELECT status,COUNT(*) AS count FROM leads WHERE language='russian' AND deleted_at IS NULL GROUP BY status ORDER BY status")).rows;
        return `Davr: ${actionId === 'daily' ? policy.today() : period.start} — ${period.end}\nKirim: ${money(totals.amount)}\nTranzaksiyalar: ${totals.count}\n`
            + counts.map(r => `${safe(r.status)}: ${r.count}`).join('\n');
    }
    if (actionId === 'budget' && identity.role === 'marketing') return 'Reklama sarfi uchun tasdiqlangan CRM manbasi hali ulanmagan. Byudjet yoki CPL taxmin qilinmaydi.';
    if (actionId === 'bindings' && identity.role === 'admin') return 'Guruhlarni boshqarish: https://myhomework.uz/index.html\nSozlamalar → Telegram guruhlari. Guruh nomi emas, aniq ustoz va chat_id bo‘yicha biriktiriladi.';
    if (actionId === 'configuration' && identity.role === 'admin') {
        const data = (await require('./store').settings(db)).data;
        return `Kunlik sotuv xabarlari: ${data.promotionsEnabled ? 'Yoqilgan' : 'O‘chiq'}\nGuruh xabarlari: ${data.groupNotificationsEnabled ? 'Yoqilgan' : 'O‘chiq'}\nSinov guruhidan chiqarish: ${data.trialRemovalEnabled ? 'Yoqilgan' : 'O‘chiq'}`;
    }
    if (actionId === 'leave-review' && identity.role === 'admin') {
        const rows = (await db.query(`SELECT h.name,l.id,l.reason,TO_CHAR(l.start_date,'YYYY-MM-DD') AS start,TO_CHAR(l.end_date,'YYYY-MM-DD') AS finish
            FROM domwork_bot_leave_requests l LEFT JOIN hr_employees h ON h.id=l.employee_id WHERE l.state='pending' ORDER BY l.created_at LIMIT 30`)).rows;
        return rows.map(r => `${safe(r.name)} · ${r.start} — ${r.finish}\n${safe(r.reason)}\nID: ${r.id}`).join('\n\n') || none;
    }
    return 'Bu funksiya hali ulanmagan. Hozircha CRM kabinetidan foydalaning.';
}
module.exports = { action, salary };
