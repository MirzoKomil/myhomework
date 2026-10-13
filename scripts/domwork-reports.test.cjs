const {test}=require('node:test');
const assert=require('node:assert/strict');
const reports=require('../server/services/domworkBot/reports');
const schedule=require('../server/services/domworkBot/schedule');
test('history uses Tashkent dates, Monday weeks and partial current month, including leap/year boundary',()=>{
    const p=reports.periods(new Date('2026-01-01T00:00:00Z'));
    assert.deepEqual(p.weeks.at(-1),{start:'2025-12-29',end:'2026-01-01'});
    assert.deepEqual(p.months[0],{start:'2025-11-01',end:'2025-11-30'});
    assert.deepEqual(p.months.at(-1),{start:'2026-01-01',end:'2026-01-01'});
    assert.equal(reports.shift('2024-03-01',-1),'2024-02-29');
    assert.equal(reports.periods(new Date('2026-10-11T19:01:00Z')).weeks.at(-1).start,'2026-10-12');
});
test('free intervals merge overlaps and require the entire lesson duration',()=>{
    const slots=[[600,630],[615,645],[645,660],[700,715]];
    assert.deepEqual(schedule.merge(slots),[[600,660],[700,715]]);
    assert.deepEqual(schedule.free(slots,60,600,780),[[715,780]]);
    assert.deepEqual(slots,[[600,630],[615,645],[645,660],[700,715]]);
    assert.equal(schedule.minutes('99:00'),null);
});
const fixture=()=>({employeeId:'t',teacher:{schedule_pattern:'mwf',lesson_duration:30},now:new Date('2026-10-12T04:00:00Z'),
    students:[{teacher_id:'t',lesson_day_of_week:1,lesson_time:'10:00',lesson_duration:60,extra_data:{}}],slots:[],leads:[]});
test('own recurring classes occupy all three weekdays; other primary teachers are not borrowed for assistants',()=>{
    const input=fixture();input.students.push({teacher_id:'other',assistant_teacher_id:'t',lesson_day_of_week:1,lesson_time:'12:00',lesson_duration:60});
    const rows=schedule.calendar(input);
    assert.deepEqual(rows[0].busy,[[600,660]]);assert.deepEqual(rows[2].busy,[[600,660]]);
    assert.equal(rows[1].free,null);assert.equal(rows[0].free[0][0],540);
    assert.equal(rows[0].free.at(-1)[1],1440);
});
test('dated timetable/trial reservations block exact future dates and multi-day trials do not recur forever',()=>{
    const input=fixture();input.students=[];
    input.slots=[{date:'2026-10-13',time:'11:00',student_id:'s',completed:0}];
    input.leads=[{id:'l',status:'sinov-darsida',extra_data:{trialLessonAt:'2026-10-12T12:00:00+05:00',trialRequest:{id:'r',teacherId:'t',scheduledAt:'2026-10-12T12:00:00+05:00',daysCount:2,state:'accepted'},paymentOnboarding:{teacherId:'t',trialDaysCount:2,lessonDuration:15}}}];
    const rows=schedule.calendar(input);
    assert.deepEqual(rows[0].busy,[[720,735]]);assert.deepEqual(rows[1].busy,[[660,690]]);
    assert.deepEqual(rows[2].busy,[[720,735]]);assert.deepEqual(rows[4].busy,[]);
    input.leads[0].extra_data.trialRequest.state='rejected';assert.deepEqual(schedule.calendar(input)[0].busy,[]);
});
test('invalid/incomplete reservations do not grant false free time, and frozen/future students are ignored',()=>{
    const input=fixture();input.students[0].lesson_time='broken';
    assert.equal(schedule.calendar(input)[0].free,null);
    input.students[0].extra_data={frozen:true};assert.deepEqual(schedule.calendar(input)[0].busy,[]);
    input.students[0].extra_data={startDate:'2026-11-01'};assert.deepEqual(schedule.calendar(input)[0].busy,[]);
    input.students[0].extra_data={};input.students[0].lesson_day_of_week=null;
    assert.ok(schedule.calendar(input).every(r=>r.free===null));
    input.students[0].lesson_day_of_week=0;assert.ok(schedule.calendar(input).every(r=>r.free===null));
});
test('payment onboarding reservations block their weekly pattern before the student is created',()=>{
    const input=fixture();input.students=[];
    input.leads=[{id:'paid',status:'tolov-jarayonida',extra_data:{paymentOnboarding:{teacherId:'t',lessonDayOfWeek:1,lessonTime:'09:30',lessonDuration:60}}}];
    const rows=schedule.calendar(input);assert.deepEqual(rows[0].busy,[[570,630]]);assert.deepEqual(rows[2].busy,[[570,630]]);
});
test('new staff views remain forbidden to students and assistants cannot request schoolwide reports',async()=>{
    const staff=require('../server/services/domworkBot/staff');
    for(const [role,action] of [['student','history'],['teacher','digest'],['assistant','digest']])
        await assert.rejects(staff.action({query(){throw Error('must not query');}},{role},action),e=>e.status===403);
});
test('assistant ratings never borrow primary teacher scores; Russian primary scores require explicit owner and finite 1–5 values',async()=>{
    const staff=require('../server/services/domworkBot/staff');
    const unavailable=await staff.action({async query(sql,params){assert.ok(sql.includes('domwork_assistant_ratings'));assert.deepEqual(params,['t']);return {rows:[]};}},{role:'assistant',employeeId:'t'},'ranking');
    assert.ok(unavailable.includes('ustoz IDsi yo‘q'));
    const db={async query(sql){return {rows:sql.includes('json_data')?[{data:{s:[{teacherId:'t',studentRatingOfTeacher:{overall:4}},
        {teacherId:'other',studentRatingOfTeacher:{overall:1}},{teacherId:'t',studentRatingOfTeacher:{overall:null}},
        {teacherId:'t',studentRatingOfTeacher:{overall:999}}],english:[{teacherId:'t',studentRatingOfTeacher:{overall:1}}]}}]:[{id:'s'}]};}};
    assert.equal(await staff.action(db,{role:'teacher',employeeId:'t'},'ranking'),'O‘quvchilar bahosi: 4.0\nBaholar soni: 1');
});
