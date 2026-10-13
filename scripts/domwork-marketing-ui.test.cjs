const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
const modalCode=source.slice(source.indexOf('function openTargetDailyAdSpendModal('),source.indexOf('// --- Moliya Bo'));
function fixture(language='russian') {
    const nodes={},calls=[],writes=[],alerts=[],legacy={spend:{'2026-10':{'2026-10-13':{budget:999,leadCount:9}}},plan:{'2026-10':{budget:9999}}};
    let closed=0,rendered=0;
    const context=vm.createContext({_marketingLang:language,_domworkAdsMonth:{month:'2026-10',days:{'2026-10-13':{budget:12,leadCount:2,revision:3}},plan:{revision:4,data:{budget:100,lidSoni:20,kvalLidSoni:15,kvalLidPct:75}}},
        STORAGE_KEYS:{targetDailyAdSpend:'spend',targetMonitoringPlan:'plan'},getItem:key=>structuredClone(legacy[key]),setItem:(key,value)=>writes.push({key,value}),
        document:{getElementById:id=>nodes[id] || (nodes[id]={value:'',isConnected:true,disabled:false,addEventListener(){}})},
        openModal(title,body){for(const match of body.matchAll(/id="([^"]+)"[^>]*value="([^"]*)"/g))nodes[match[1]]={value:match[2],isConnected:true,disabled:false,addEventListener(){}};},
        closeModal(){closed++;},async renderMarketingTargetPanel(){rendered++;},showMiniToast(){},alert:value=>alerts.push(value),
        monthKeyLabel:value=>value,apiFetch:async(url,options)=>{calls.push({url,...options});return {ok:true};}});
    vm.runInContext(modalCode,context);
    return {context,nodes,calls,writes,alerts,legacy,get closed(){return closed;},get rendered(){return rendered;}};
}
test('Russian daily and monthly modals read only Russian entries and save via revisioned API, never legacy state',async()=>{
    const f=fixture();f.context.openTargetDailyAdSpendModal('2026-10-13');assert.equal(f.nodes.tmAdSpendBudget.value,'12');
    f.nodes.tmAdSpendBudget.value='0';await f.nodes.tmAdSpendSave.onclick();
    assert.deepEqual(JSON.parse(f.calls[0].body),{kind:'day',date:'2026-10-13',revision:3,data:{budget:0,leadCount:2}});
    f.context.openTargetPlanModal('2026-10');assert.equal(f.nodes.tmPlanBudget.value,'100');await f.nodes.tmPlanSave.onclick();
    assert.deepEqual(JSON.parse(f.calls[1].body),{kind:'plan',date:'2026-10',revision:4,data:{budget:100,lidSoni:20,kvalLidSoni:15,kvalLidPct:75}});
    assert.equal(f.writes.length,0);assert.equal(f.closed,2);assert.equal(f.rendered,2);assert.equal(f.alerts.length,0);
});
test('Russian failed save keeps modal open and restores button; unloaded/stale month does not invent values',async()=>{
    const f=fixture();f.context.apiFetch=async()=>{throw Error('Ma’lumot o‘zgargan');};f.context.openTargetDailyAdSpendModal('2026-10-13');await f.nodes.tmAdSpendSave.onclick();
    assert.equal(f.closed,0);assert.equal(f.nodes.tmAdSpendSave.disabled,false);assert.deepEqual(f.alerts,['Ma’lumot o‘zgargan']);assert.equal(f.writes.length,0);
    const n=Object.keys(f.nodes).length;f.context.openTargetDailyAdSpendModal('2026-11-01');assert.equal(Object.keys(f.nodes).length,n);
});
test('English marketing writes retain existing behavior; no Russian API calls or changes to other months',async()=>{
    const f=fixture('english');f.context.openTargetDailyAdSpendModal('2026-10-13');assert.equal(f.nodes.tmAdSpendBudget.value,'999');await f.nodes.tmAdSpendSave.onclick();
    f.context.openTargetPlanModal('2026-10');assert.equal(f.nodes.tmPlanBudget.value,'9999');await f.nodes.tmPlanSave.onclick();
    assert.equal(f.calls.length,0);assert.equal(f.writes.length,2);assert.equal(f.writes[0].key,'spend');assert.equal(f.writes[1].key,'plan');
});
test('blank Russian fields do not silently become a known zero spend or plan',async()=>{
    const f=fixture();f.context.openTargetDailyAdSpendModal('2026-10-13');f.nodes.tmAdSpendBudget.value='';await f.nodes.tmAdSpendSave.onclick();
    f.context.openTargetPlanModal('2026-10');f.nodes.tmPlanLidSoni.value='';await f.nodes.tmPlanSave.onclick();
    assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);assert.equal(f.closed,0);assert.equal(f.alerts.length,2);
});
