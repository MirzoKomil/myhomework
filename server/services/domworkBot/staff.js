'use strict';
const policy = require('./policy');
const payroll = require('../payroll');
const groups = require('../domworkGroups');
const reports = require('./reports');
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
async function json(db,key,fallback={}) { return (await db.query('SELECT data FROM json_data WHERE key=$1',[key])).rows[0]?.data || fallback; }
function personalPlan(raw,id,month) {
    const item=raw?.[id] || {};
    if(item[month]) return item[month];
    if(typeof item.totalAmount==='number' || typeof item.dealsCount==='number') return item;
    const prior=Object.keys(item).filter(k=>/^\d{4}-\d{2}$/.test(k) && k<=month).sort().pop();
    return prior?item[prior]:null;
}
async function action(db, identity, actionId, options={}) {
    policy.requireAction(identity, actionId);
    if (identity.role==='marketing' && actionId==='history') return reports.marketingHistory(db,options.now);
    if(actionId==='ranking' && ['teacher','assistant'].includes(identity.role)) {
        if(identity.role==='assistant') return 'Yordamchi ustoz reytingi uchun eski haftalik baholarda ustoz IDsi saqlanmagan. Ular hozirgi ustozga taxminan biriktirilmaydi. Asosiy ustoz reytingi yordamchi reytingi sifatida ko‘rsatilmaydi.';
        const main=await json(db,'liveGrades');
        const russianIds=new Set((await db.query("SELECT id FROM students WHERE subject='russian'")).rows.map(r=>r.id));
        const scores=Object.entries(main).filter(([id])=>russianIds.has(id)).flatMap(([,entries])=>Array.isArray(entries)?entries:[])
            .filter(g=>g.teacherId===identity.employeeId && typeof g.studentRatingOfTeacher?.overall==='number')
            .map(g=>g.studentRatingOfTeacher.overall).filter(n=>Number.isFinite(n) && n>=1 && n<=5);
        return scores.length?`O‘quvchilar bahosi: ${(scores.reduce((s,n)=>s+n,0)/scores.length).toFixed(1)}\nBaholar soni: ${scores.length}`:none;
    }
    if(actionId==='reports' && identity.role==='rop' && options.comparison) return comparison(db,options.now || new Date());
    if (['salary','ranking','plan','bonuses','managers'].includes(actionId) && ['sales','rop','teacher','assistant'].includes(identity.role)) {
        const period = policy.monthPeriod(options.now);
        const calculation = await payroll.calculate(db, period, 'russian');
        const own = calculation.rows.find(r => r.employeeId === identity.employeeId || (identity.role === 'sales' && r.employeeId === identity.managerId));
        if (actionId === 'salary') return `Davr: ${period.start} — ${period.end}\n` + salary(own);
        if (actionId === 'ranking') {
            const ranked = calculation.rows.filter(r => r.role === 'sales').sort((a,b)=>b.turnover-a.turnover);
            const index = ranked.findIndex(r => r.employeeId === own?.employeeId);
            return index < 0 ? none : `O‘rningiz: ${index+1}/${ranked.length}\nAylanmangiz: ${money(own.turnover)}\nDaromadingiz: ${money(own.total)}`;
        }
        if (actionId === 'bonuses') {
            const history=await json(db,'bonusHistory',[]), config=await json(db,'bonusData');
            const settings=(await db.query("SELECT data FROM salary_kpi_settings WHERE language='russian'")).rows[0]?.data || {};
            const ids=identity.role==='rop'?new Set(calculation.rows.filter(r=>r.role==='sales').map(r=>r.employeeId)):new Set([identity.managerId]);
            const rows=history.filter(b=>ids.has(b.managerId) && !b.cancelled && b.date>=period.start && b.date<=period.end);
            return `Joriy oy hisoblangan bonus: ${money(own?.bonus)}\n`+rows.map(b=>`${safe(b.date)} · ${safe(b.bonusId)} · ${b.amount ?? config[b.bonusId]?.amount ?? settings.bonusAmounts?.[b.bonusId] ?? 'Summasi belgilanmagan'} · ${safe(b.note)}`).join('\n');
        }
        if (actionId === 'managers') return calculation.rows.filter(r => r.role === 'sales').map(r => `${safe(r.name)}: ${money(r.turnover)} · Maosh: ${money(r.total)}`).join('\n') || none;
        if (actionId === 'plan') {
            const plan=personalPlan(await json(db,'individualSalesPlans'),identity.managerId,period.start.slice(0,7));
            const amount=Number(plan?.totalAmount) || 0, actual=Number(own?.turnover) || 0;
            return `Shaxsiy reja: ${amount>0?money(amount):'Belgilanmagan'}\nShaxsiy aylanma: ${money(actual)}\n`
                +(amount>0?`Bajarildi: ${(actual/amount*100).toFixed(1)}%\nQoldi: ${money(Math.max(0,amount-actual))}`:'');
        }
    }
    if (['students','assistant-duty','debtors'].includes(actionId)) {
        const teaching = ['teacher','assistant'].includes(identity.role);
        if (teaching) {
            if (!identity.employeeId) return none;
            const assistant = actionId === 'assistant-duty' || identity.role === 'assistant';
            const rows = (await db.query(`SELECT s.id,s.name,s.phone,s.group_name,s.lesson_time,h.name AS main_teacher
                FROM students s LEFT JOIN hr_employees h ON h.id=s.teacher_id
                WHERE s.subject='russian' AND ${assistant ? 's.assistant_teacher_id' : 's.teacher_id'}=$1 ORDER BY s.name LIMIT 100`, [identity.employeeId])).rows;
            let output=rows.map(r => `${safe(r.name)} · ${safe(r.phone)}\n${safe(r.group_name)} · ${safe(r.lesson_time)}${assistant ? '\nAsosiy ustoz: '+safe(r.main_teacher) : ''}`).join('\n\n') || none;
            if(actionId==='assistant-duty') {
                const period=policy.monthPeriod(options.now), calculation=await payroll.calculate(db,period,'russian');
                const own=calculation.rows.find(r=>r.employeeId===identity.employeeId);
                const attendance=(await db.query(`SELECT student_id,day,present FROM assistant_attendance WHERE att_key=$1 AND student_id=ANY($2::text[]) ORDER BY day`,
                    [period.start.slice(0,7)+'_'+identity.employeeId,rows.map(r=>r.id)])).rows;
                output+=`\n\nYordamchi ustozlik daromadi: ${money(own?.assistantTotal)}\n`+attendance.map(r=>`${safe(rows.find(s=>s.id===r.student_id)?.name)} · ${r.day}-kun · ${r.present===1?'Qatnashdi':'Kelmadi'}`).join('\n');
            }
            return output;
        }
        if (!['sales','rop'].includes(identity.role)) throw policy.error(403, 'Ruxsat yo‘q');
        const rows = (await db.query(`SELECT id,name,phone,extra_data FROM students WHERE subject='russian'
            AND ($1::boolean OR extra_data->>'managerId'=$2) ORDER BY name LIMIT 200`, [identity.role === 'rop',identity.managerId || ''])).rows;
        return rows.filter(r => actionId !== 'debtors' || Number(r.extra_data?.debtAmount)>0)
            .map(r => `${safe(r.name)} · ${safe(r.phone)}${actionId === 'debtors' ? '\nQarz: '+money(r.extra_data.debtAmount)+' · '+safe(r.extra_data.paymentDueDate) : ''}`).join('\n\n') || none;
    }
    if (actionId === 'groups' && identity.role === 'teacher') {
        const rows=(await db.query(`SELECT name,type,invite_link FROM domwork_learning_groups
            WHERE teacher_id=$1 AND NOT archived ORDER BY type,name,id`,[identity.employeeId])).rows;
        const links=rows.map(g=>`${g.type==='trial'?'Sinov':'Asosiy'} — ${safe(g.name)}: ${g.invite_link || 'Guruh havolasini admin kiritadi'}`);
        return links.join('\n') || none;
    }
    if (actionId === 'schedule' && ['teacher','assistant'].includes(identity.role)) {
        return require('./schedule').ownSchedule(db,identity,options.now);
    }
    if (actionId === 'trial-lessons' && ['teacher','rop'].includes(identity.role)) {
        const rows = (await db.query("SELECT name,extra_data FROM leads WHERE language='russian' AND status='sinov-darsida' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200")).rows;
        return rows.filter(r => identity.role === 'rop' || r.extra_data?.trialRequest?.teacherId === identity.employeeId)
            .map(r => `${safe(r.name)} · ${safe(r.extra_data?.trialRequest?.scheduledAt)} · ${safe(r.extra_data?.trialRequest?.state)}\nTasdiqlash/natija: CRM → Sinov darslari`).join('\n\n') || none;
    }
    if (['income','digest','daily','history','funnel','reports'].includes(actionId) && ['admin','rop','marketing'].includes(identity.role)) {
        const period = policy.monthPeriod(options.now), today=policy.today(options.now);
        const start=options.daily || actionId==='daily'?today:period.start, end=options.daily || actionId==='daily'?today:period.end;
        const totals = (await db.query(`SELECT COUNT(*) AS count,COALESCE(SUM(amount),0) AS amount FROM payment_records
            WHERE language='russian' AND paid_date BETWEEN $1 AND $2`, [start,end])).rows[0];
        const counts = (await db.query("SELECT status,COUNT(*) AS count FROM leads WHERE language='russian' AND deleted_at IS NULL GROUP BY status ORDER BY status")).rows;
        let output=`Davr: ${start} — ${end}\nKirim: ${money(totals.amount)}\nTranzaksiyalar: ${totals.count}\n`+counts.map(r => `${safe(r.status)}: ${r.count}`).join('\n');
        const debt=(await db.query("SELECT extra_data FROM students WHERE subject='russian'")).rows.reduce((sum,r)=>sum+Math.max(0,Number(r.extra_data?.debtAmount)||0),0);
        output+=`\nQoldiq qarz: ${money(debt)}`;
        if(identity.role==='admin' && actionId==='digest') {
            output+='\n\n'+await reports.academicDigest(db,start,end);
            const confirmed=(await db.query(`SELECT amount FROM salary_plan_confirmations WHERE language='russian'
                AND period_start=$1::date AND period_end=$2::date`,[period.start,period.end])).rows[0];
            const monthTotal=(await db.query(`SELECT COALESCE(SUM(amount),0) AS amount FROM payment_records
                WHERE language='russian' AND paid_date BETWEEN $1::date AND $2::date`,[period.start,today])).rows[0];
            const currentPlan=require('../../../js/payrollEngine').salesPlan({salesPlan:await json(db,'salesPlan')},'russian',
                {...period,days:Number(period.end.slice(8))});
            const plan=Number(confirmed?.amount)===currentPlan?Number(currentPlan)||0:0, actual=Number(monthTotal.amount)||0;
            output+=`\n\nOylik tasdiqlangan sotuv rejasi: ${plan>0?money(plan):'Tasdiqlanmagan'}\nOylik kirim: ${money(actual)}`
                +(plan>0?`\nReja bajarilishi: ${(actual/plan*100).toFixed(1)}%\nReja qoldig‘i: ${money(Math.max(0,plan-actual))}`:'');
        }
        if(actionId==='reports') {
            const rows=(await db.query(`SELECT h.id,h.name,
                (SELECT COUNT(*) FROM leads l WHERE l.language='russian' AND l.manager_id=h.id AND l.deleted_at IS NULL AND (l.created_at AT TIME ZONE 'Asia/Tashkent')::date BETWEEN $1::date AND $2::date) AS new_leads,
                (SELECT COUNT(DISTINCT a.lead_id) FROM lead_audit a JOIN leads l ON l.id=a.lead_id WHERE l.language='russian' AND l.manager_id=h.id AND a.actor_id IN (SELECT u.id FROM users u LEFT JOIN user_sales_manager_links m ON m.user_id=u.id WHERE m.manager_id=h.id OR LOWER(TRIM(u.email))=LOWER(TRIM(h.login))) AND (a.created_at AT TIME ZONE 'Asia/Tashkent')::date BETWEEN $1::date AND $2::date) AS processed,
                (SELECT COUNT(*) FROM leads l WHERE l.language='russian' AND l.manager_id=h.id AND l.status='sinov-darsida' AND l.deleted_at IS NULL) AS trial,
                (SELECT COUNT(*) FROM leads l WHERE l.language='russian' AND l.manager_id=h.id AND l.status='tolov-yopildi' AND l.deleted_at IS NULL) AS won,
                (SELECT COALESCE(SUM(amount),0) FROM payment_records p WHERE p.language='russian' AND p.manager_id=h.id AND p.paid_date BETWEEN $1::date AND $2::date) AS receipts
                FROM hr_employees h WHERE h.role IN ('sotuv-menejeri','sotuv_menejeri','sotuv menejeri','sales_manager') AND h.lang='russian' AND COALESCE(h.status,'active')<>'inactive' ORDER BY h.name`,[start,end])).rows;
            output+='\n\n'+rows.map(r=>`${safe(r.name)} · Yangi: ${r.new_leads} · Ishlangan: ${r.processed} · Hozir sinovda: ${r.trial} · Hozir yopilgan: ${r.won} · Tushum: ${money(r.receipts)}`).join('\n');
        }
        if(identity.role==='marketing') output+='\n'+await marketing(db,start,end);
        return output;
    }
    if (actionId === 'budget' && identity.role === 'marketing') { const p=policy.monthPeriod(options.now);return marketing(db,p.start,p.end); }
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
async function comparison(db,now) {
    const end=now.toISOString(),start=new Date(now.getTime()-24*3600000).toISOString();
    const rows=(await db.query(`WITH activity AS (
        SELECT a.*,COALESCE(a.snapshot->'after',a.snapshot) AS after_data,a.snapshot->'before' AS before_data
        FROM lead_audit a JOIN leads l ON l.id=a.lead_id
        WHERE l.language='russian' AND a.created_at>$1::timestamptz AND a.created_at<=$2::timestamptz
    ) SELECT h.id,h.name,
        (SELECT COUNT(DISTINCT a.lead_id) FROM activity a JOIN leads l ON l.id=a.lead_id WHERE a.after_data->>'managerId'=h.id
            AND COALESCE(a.before_data->>'managerId','')<>h.id AND l.created_at>$1::timestamptz) AS new_assigned,
        (SELECT COUNT(DISTINCT a.lead_id) FROM activity a JOIN leads l ON l.id=a.lead_id WHERE a.after_data->>'managerId'=h.id
            AND COALESCE(a.before_data->>'managerId','')<>h.id AND l.created_at<=$1::timestamptz) AS old_assigned,
        (SELECT COUNT(DISTINCT a.lead_id) FROM activity a WHERE a.actor_id IN
            (SELECT u.id FROM users u LEFT JOIN user_sales_manager_links m ON m.user_id=u.id
             WHERE m.manager_id=h.id OR (m.manager_id IS NULL AND LOWER(TRIM(u.email))=LOWER(TRIM(h.login))))) AS processed,
        (SELECT COUNT(DISTINCT a.lead_id) FROM activity a WHERE a.after_data->>'managerId'=h.id
            AND a.after_data->>'status'='sinov-darsida' AND COALESCE(a.before_data->>'status','')<>'sinov-darsida') AS trial,
        (SELECT COUNT(DISTINCT a.lead_id) FROM activity a WHERE a.after_data->>'managerId'=h.id
            AND a.after_data->>'status'='tolov-yopildi' AND COALESCE(a.before_data->>'status','')<>'tolov-yopildi') AS won,
        (SELECT COALESCE(SUM(p.amount),0) FROM payment_records p WHERE p.language='russian' AND p.manager_id=h.id
            AND p.paid_at>$1::timestamptz AND p.paid_at<=$2::timestamptz) AS receipts
        FROM hr_employees h WHERE h.role IN ('sotuv-menejeri','sotuv_menejeri','sotuv menejeri','sales_manager')
        AND h.lang='russian' AND COALESCE(h.status,'active')<>'inactive' ORDER BY h.name`,[start,end])).rows;
    const date=value=>new Date(value).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'});
    return `Davr: ${date(start)} — ${date(end)}\n`+rows.map(r=>`${safe(r.name)}\nYangi biriktirilgan: ${r.new_assigned} · Eski biriktirilgan: ${r.old_assigned}\nIshlangan: ${r.processed} · Sinovga yozilgan: ${r.trial} · Yopilgan: ${r.won}\nVaqti aniq tushum: ${money(r.receipts)}`).join('\n\n')
        +'\nAudit tarixi yoki to‘lov vaqti yo‘q bo‘lgan eski yozuvlar 24 soatlik hisobotga taxminan qo‘shilmaydi.';
}
async function marketing(db,start,end) {
    const raw=await json(db,'targetDailyAdSpend'), plans=await json(db,'targetMonitoringPlan');
    const languageScoped=!!raw.russian, data=raw.russian || raw;
    let total=0, known=false;
    for(const [month,days] of Object.entries(data)) for(const [day,item] of Object.entries(days || {})) {
        const date=/^\d{4}-\d{2}-\d{2}$/.test(day)?day:month+'-'+String(day).padStart(2,'0');
        if(date>=start && date<=end && Number.isFinite(Number(item?.budget))) {total+=Number(item.budget);known=true;}
    }
    const leads=Number((await db.query(`SELECT COUNT(*) AS count FROM leads WHERE language='russian' AND lead_type='target' AND deleted_at IS NULL
        AND (created_at AT TIME ZONE 'Asia/Tashkent')::date BETWEEN $1::date AND $2::date`,[start,end])).rows[0].count);
    const plan=(plans.russian || plans)[start.slice(0,7)];
    return `Target lidlar: ${leads}\n${languageScoped?'Rus tili':'CRM umumiy'} reklama sarfi: ${known?total.toFixed(2)+' USD':'Kiritilmagan'}\n`
        +`Reklama rejasi: ${plan?.budget!=null?Number(plan.budget).toFixed(2)+' USD':'Belgilanmagan'}\n`
        +`Rus tili CPL: ${languageScoped && known && leads?(total/leads).toFixed(2)+' USD':'Sarf til bo‘yicha ajratilmaguncha taxmin qilinmaydi'}`;
}
module.exports = { action, salary, personalPlan, marketing, comparison };
