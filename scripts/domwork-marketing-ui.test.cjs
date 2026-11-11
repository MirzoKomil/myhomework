// Marketing → "Target lidlar": kunlik sarf va oylik reja oynalari endi js/targetMonitorUI.js'da
// (avval js/app.js'dagi openTargetDailyAdSpendModal/openTargetPlanModal edi). Ikkala til ham
// revisiyali /api/target-ads orqali saqlanadi; eski localStorage (targetDailyAdSpend) yozilmaydi.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/targetMonitorUI.js'),'utf8');
const exportLine='window.targetMonitorUI = { render, allowedLangs };';
assert.ok(source.includes(exportLine),'targetMonitorUI eksport qatori o‘zgargan — testni yangilang');
// Faqat test uchun: ichki oynalarni va holatni tashqariga chiqaramiz (mantiq o'zgarmaydi).
const testSource=source.replace(exportLine,'window.targetMonitorUI = { render, allowedLangs, __test: { state, openDay, openPlan } };');

function fixture(language='russian',fetchImpl=null) {
    const nodes={},calls=[],writes=[],toasts=[];
    let closed=0;
    const node=(value='')=>({value,isConnected:true,disabled:false,hidden:true,textContent:'',innerHTML:'',addEventListener(){},focus(){}});
    const window={TargetSheet:{diffLevel:()=>null}};
    const context=vm.createContext({window,Number,String,Date,Math,getCurrentUser:()=>null,
        getItem:()=>{throw Error('eski localStorage o‘qilmasligi kerak');},setItem:(key,value)=>writes.push({key,value}),
        document:{getElementById:id=>nodes[id] || (nodes[id]=node())},
        openModal(title,body){for(const match of body.matchAll(/id="([^"]+)"[^>]*value="([^"]*)"/g))nodes[match[1]]=node(match[2]);},
        closeModal(){closed++;},showMiniToast:t=>toasts.push(t),monthKeyLabel:value=>value,
        apiFetch:async(url,options)=>{calls.push({url,...options});if(fetchImpl)return fetchImpl(url,options);return {ok:true};}});
    vm.runInContext(testSource,context);
    const t=window.targetMonitorUI.__test;
    t.state.lang=language;t.state.month='2026-10';
    t.state.data={month:'2026-10',language,days:{'2026-10-13':{budget:12,leadCount:2,revision:3}},plan:{revision:4,budget:100,lidSoni:20,kvalLidSoni:15}};
    const sh={days:[]};
    return {nodes,calls,writes,toasts,openDay:key=>t.openDay({},key,sh),openPlan:()=>t.openPlan({}),get closed(){return closed;}};
}

for (const language of ['russian','english']) {
    test(`${language}: daily and monthly modals read API entries and save via revisioned API, never legacy state`,async()=>{
        const f=fixture(language);f.openDay('2026-10-13');assert.equal(f.nodes.tsxBudget.value,'12');assert.equal(f.nodes.tsxLeads.value,'2');
        f.nodes.tsxBudget.value='0';await f.nodes.tsxSave.onclick();
        assert.equal(f.calls[0].url,'/api/target-ads');assert.equal(f.calls[0].method,'PUT');
        assert.deepEqual(JSON.parse(f.calls[0].body),{language,kind:'day',date:'2026-10-13',revision:3,data:{budget:0,leadCount:2,kvalLeadCount:null,note:''}});
        f.openPlan();assert.equal(f.nodes.tsxPBudget.value,'100');await f.nodes.tsxPSave.onclick();
        assert.deepEqual(JSON.parse(f.calls[1].body),{language,kind:'plan',date:'2026-10',revision:4,
            data:{budget:100,fixed:0,lidSoni:20,kvalLidSoni:15,usdRate:null,targetCpa:null,targetRoas:null}});
        assert.equal(f.writes.length,0);assert.equal(f.closed,2);assert.deepEqual(f.toasts,['Saqlandi','Reja saqlandi']);
    });
}
test('failed save keeps modal open and restores button; a new day does not invent values',async()=>{
    const fail=()=>{throw Error('Ma’lumot o‘zgargan');};
    const f=fixture('russian',fail);f.openDay('2026-10-13');await f.nodes.tsxSave.onclick();
    assert.equal(f.closed,0);assert.equal(f.nodes.tsxSave.disabled,false);
    assert.equal(f.nodes.tsxError.textContent,'Ma’lumot o‘zgargan');assert.equal(f.nodes.tsxError.hidden,false);assert.equal(f.writes.length,0);
    const n=fixture();n.openDay('2026-10-20');assert.equal(n.nodes.tsxBudget.value,'');assert.equal(n.nodes.tsxLeads.value,'');
    n.nodes.tsxBudget.value='5';n.nodes.tsxLeads.value='1';await n.nodes.tsxSave.onclick();
    assert.equal(JSON.parse(n.calls[0].body).revision,0,'yangi kun uchun revisiya 0');
});
test('blank fields do not silently become a known zero spend or plan',async()=>{
    const f=fixture();f.openDay('2026-10-13');f.nodes.tsxBudget.value='';await f.nodes.tsxSave.onclick();
    assert.match(f.nodes.tsxError.textContent,/Nol boʻlsa 0 yozing/);
    f.openPlan();f.nodes.tsxPLeads.value='';await f.nodes.tsxPSave.onclick();
    assert.match(f.nodes.tsxPError.textContent,/Nol boʻlsa 0 yozing/);
    assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);assert.equal(f.closed,0);
});

