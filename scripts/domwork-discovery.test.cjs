const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const discovery=require('../server/services/domworkBot/discovery');
test('membership proposals exclude left/kicked/restricted non-members',()=>{
    for(const status of ['member','administrator','creator'])assert.equal(discovery.memberPresent({status}),true);
    assert.equal(discovery.memberPresent({status:'restricted',is_member:true}),true);
    for(const value of [{status:'left'},{status:'kicked'},{status:'restricted',is_member:false},undefined])assert.equal(discovery.memberPresent(value),false);
});
test('bulk discovery input rejects duplicates, oversized batches and unsafe IDs/URLs',()=>{
    const row={chatId:'-10012345678',type:'classroom',name:'Group',teacherId:'a',revision:1,inviteLink:''};
    assert.equal(discovery.selection([row])[0].isDefault,false);
    for(const input of [[],[row,row],Array(51).fill(row),[{...row,chatId:'1234567'}],[{...row,revision:0}],[{...row,type:'sales'}],[{...row,inviteLink:'javascript:alert(1)'}]])assert.throws(()=>discovery.selection(input));
});
test('actual student schedule API uses explicit per-student group without rewriting legacy data (both schedule branches)',async()=>{
    // Extract ONLY this pure read adapter: never import or start production server/db.js.
    const source=fs.readFileSync(require('node:path').join(__dirname,'../server/db.js'),'utf8');
    const functionSource=source.slice(source.indexOf('async function getDemoStudentSchedule('),source.indexOf('// 39-vazifa: mobil ilovaning'));
    const legacy={id:'s',subject:'russian',extra_data:{telegramGroupLink:'https://t.me/+LegacyPersonalLink'}};
    for(const time of ['', '10:00']){
        const reads=[];
        const context={q1:async()=>legacy,resolveStudentId:async id=>id,pool:{fixture:true},
            rowToStudent:()=>({teacherId:'',telegramGroupLink:legacy.extra_data.telegramGroupLink,lessonTime:time,lessonDayOfWeek:1,lessonDuration:30}),
            computeNextWeeklyOccurrence:()=> '2026-10-12T05:00:00.000Z',require:id=>{
                assert.equal(id,'./services/domworkGroups');return{studentInvite:async(db,id,lang,old)=>{reads.push({id,lang,old});return'https://t.me/+ApprovedOwnGroup';}};
            }};
        vm.createContext(context);vm.runInContext(functionSource+'\nglobalThis.schedule=getDemoStudentSchedule;',context);
        const result=await context.schedule('s');assert.equal(result.telegramGroupLink,'https://t.me/+ApprovedOwnGroup');
        assert.equal(reads[0].id,'s');assert.equal(reads[0].lang,'russian');assert.equal(legacy.extra_data.telegramGroupLink,'https://t.me/+LegacyPersonalLink');
    }
});
