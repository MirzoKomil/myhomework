'use strict';
const policy = require('./policy');
const { shift } = require('./reports');
const workflow = require('../../../js/trialWorkflow');
const DAYS = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
function minutes(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null;
    return Number(value.slice(0,2))*60+Number(value.slice(3));
}
const time = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
function days(value) { const n=Number(value); return [1,3,5].includes(n)?[1,3,5]:[2,4,6].includes(n)?[2,4,6]:[n]; }
function merge(intervals) {
    const result=[];
    for (const [start,end] of intervals.slice().sort((a,b)=>a[0]-b[0])) {
        const last=result.at(-1);
        if(last && start<=last[1]) last[1]=Math.max(last[1],end); else result.push([start,end]);
    }
    return result;
}
function free(intervals, duration, earliest=480, latest=1440) {
    let cursor=Math.max(480,earliest), result=[];
    for(const [start,end] of merge(intervals)) {
        const boundary=Math.min(latest,start);
        if(boundary-cursor>=duration) result.push([cursor,boundary]);
        cursor=Math.max(cursor,end);
    }
    if(latest-cursor>=duration) result.push([cursor,latest]);
    return result;
}
function calendar({students,slots,leads,teacher,employeeId,now=new Date()}) {
    const today=policy.today(now), offset=new Date(now.getTime()+5*3600000);
    const defaultDuration=Number(teacher?.lesson_duration), pattern={mwf:[1,3,5],tts:[2,4,6]}[teacher?.schedule_pattern];
    const dates=Array.from({length:7},(_,i)=>shift(today,i));
    const rows=dates.map(date=>({date,day:new Date(date+'T12:00:00Z').getUTCDay(),busy:[],incomplete:false}));
    const add=(row,at,duration)=>{
        const start=minutes(at), span=Number(duration);
        if(start===null || ![15,30,60].includes(span) || start+span>1440) {row.incomplete=true;return;}
        row.busy.push([start,start+span]);
    };
    // A pupil's primary lesson time is NOT their assistant lesson time.
    for(const student of students) {
        if(student.teacher_id!==employeeId || student.extra_data?.frozen===true || student.extra_data?.status==='inactive') continue;
        if(student.lesson_day_of_week==null || !Number.isInteger(Number(student.lesson_day_of_week))
            || Number(student.lesson_day_of_week)<1 || Number(student.lesson_day_of_week)>7) {rows.forEach(r=>{r.incomplete=true;});continue;}
        for(const row of rows) if(days(student.lesson_day_of_week).includes(row.day || 7)
            && (!student.extra_data?.startDate || student.extra_data.startDate<=row.date)) add(row,student.lesson_time,student.lesson_duration);
    }
    for(const slot of slots) {
        const row=rows.find(r=>r.date===slot.date);
        if(row && slot.student_id) add(row,slot.time,defaultDuration);
    }
    for(const lead of leads) {
        if(['tolov-jarayonida','tolov-yopildi'].includes(lead.status)) {
            const ob=lead.extra_data?.paymentOnboarding;
            if(ob?.teacherId!==employeeId || ob.isTrial===true) continue;
            const dow=Number(ob.lessonDayOfWeek);
            if(ob.lessonDayOfWeek==null || !Number.isInteger(dow) || dow<1 || dow>7) {rows.forEach(r=>{r.incomplete=true;});continue;}
            for(const row of rows) if(days(dow).includes(row.day || 7)) add(row,ob.lessonTime,ob.lessonDuration || defaultDuration);
            continue;
        }
        const booking=workflow.request({...lead.extra_data,id:lead.id,status:lead.status});
        if(!booking || booking.teacherId!==employeeId || !['pending','accepted'].includes(booking.state)) continue;
        const at=new Date(booking.scheduledAt);
        if(!Number.isFinite(at.getTime())) {rows.forEach(r=>{r.incomplete=true;});continue;}
        const shifted=new Date(at.getTime()+5*3600000), first=policy.today(at);
        const trialTime=time(shifted.getUTCHours()*60+shifted.getUTCMinutes());
        const duration=Number(lead.extra_data?.paymentOnboarding?.lessonDuration)||defaultDuration;
        const count=Number(booking.daysCount)||1;
        if(!Number.isInteger(count) || count<1 || count>30) {rows.forEach(r=>{r.incomplete=true;});continue;}
        // First booking date is exact; subsequent trial dates follow its weekly pattern.
        const dow=shifted.getUTCDay()||7, trialDays=[first];
        for(let i=1;i<=90 && trialDays.length<count;i++) {
            const date=shift(first,i), day=new Date(date+'T12:00:00Z').getUTCDay()||7;
            if(days(dow).includes(day))trialDays.push(date);
        }
        for(const row of rows) if(trialDays.includes(row.date)) add(row,trialTime,duration);
    }
    return rows.map(row=>{
        const earliest=row.date===today?Math.ceil((offset.getUTCHours()*60+offset.getUTCMinutes())/15)*15:480;
        const available=!row.incomplete && pattern?.includes(row.day) && [15,30,60].includes(defaultDuration)
            ?free(row.busy,defaultDuration,earliest):null;
        return {...row,busy:merge(row.busy),free:available};
    });
}
async function ownSchedule(db, identity, now = new Date()) {
    if(!identity.employeeId || !['teacher','assistant'].includes(identity.role)) throw policy.error(403,'Ustoz kabineti talab qilinadi');
    const start=policy.today(now), end=shift(start,6);
    const teacher=(await db.query('SELECT schedule_pattern,lesson_duration FROM teachers WHERE id=$1',[identity.employeeId])).rows[0];
    // Other-language reservations block free time, but reveal no names or contact details.
    const students=(await db.query('SELECT teacher_id,lesson_day_of_week,lesson_time,lesson_duration,extra_data FROM students WHERE teacher_id=$1',[identity.employeeId])).rows;
    const slots=(await db.query('SELECT date,time,student_id,completed FROM timetable WHERE teacher_id=$1 AND date BETWEEN $2 AND $3',[identity.employeeId,start,end])).rows;
    const leads=(await db.query(`SELECT id,status,extra_data FROM leads WHERE status IN ('sinov-darsida','tolov-jarayonida','tolov-yopildi') AND deleted_at IS NULL
        AND (extra_data->'paymentOnboarding'->>'teacherId'=$1 OR extra_data->'trialRequest'->>'teacherId'=$1)`,[identity.employeeId])).rows;
    const rows=calendar({students,slots,leads,teacher,employeeId:identity.employeeId,now});
    const ranges=values=>values.map(([a,b])=>`${time(a)}–${time(b)}`).join(', ') || 'Yo‘q';
    return `Keyingi 7 kun — Toshkent vaqti\n`+rows.map(r=>`${r.date} (${DAYS[r.day]})\nBand: ${ranges(r.busy)}\n`
        +`Jadvalda bo‘sh: ${r.free===null?'Ish kuni/davomiyligi yoki band dars ma’lumoti to‘liq emas':ranges(r.free)}`).join('\n\n')
        +'\nBo‘sh oraliqlar CRMning 08:00–24:00 oynasi va ustozning toq/juft kun sozlamasi bo‘yicha, kelajak vaqtlar uchun. Bu darsni avtomatik bron qilmaydi. Yordamchi dars uchun asosiy ustoz dars vaqti ko‘chirilmaydi.';
}
module.exports = {minutes,time,days,merge,free,calendar,ownSchedule};
