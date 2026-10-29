(function(){
    'use strict';
    const esc=v=>escapeHtml(String(v ?? ''));
    const types={sales:'Sotuv',marketing:'Marketing',teachers:'Ustozlar',family:'Family',beacon:'Mayoq'};
    const roles={all:'Barchaga',trial:'Sinov o‘quvchilari',student:'Faol o‘quvchilar',sales:'Sotuv menejerlari',teacher:'Asosiy ustozlar',assistant:'Yordamchi ustozlar',rop:'ROP',marketing:'Targetolog',admin:'Admin',groups:'Tanlangan guruhlar'};
    const switches={teamVibesEnabled:'Jamoa kayfiyati: 10:00 motivatsiya, 13:30 latifa, 18:00 “qaynoq soat”, Juma tabrigi, dushanba starti, oy oxiri sanog‘i (Sotuv va Family guruhlari)',staffNotifyEnabled:'Xodim bildirishnomalari Telegramga (CRM panelidagi, har xodimning o‘z tanlovi bo‘yicha)',eventsEnabled:'CRM voqealari xabarlari',remindersEnabled:'Dars va davomat eslatmalari',reportsEnabled:'23:00 kun yakuni hisobotlari (sotuv, marketing, rahbar) va 23:05 ROP taqqoslamasi',groupNotificationsEnabled:'Guruhlarga xabar yuborish',promotionsEnabled:'Sinov o‘quvchilariga kuniga bir xabar',trialRemovalEnabled:'O‘tilgan sinov darsidan keyin guruhdan chiqarish',milestonesEnabled:'20 / 40 / 60 mln sof tushum pog‘onalari tabrigi',dailyAwardsEnabled:'Kun sotuvchisi va kun ustozi',weeklyAwardsEnabled:'Hafta yetakchisi',monthlyAwardsEnabled:'Oy yetakchisi',employeeWelcomeEnabled:'Yangi rus tili xodimiga jamoa tabrigi',releaseNotesEnabled:'Jamoaga CRM yangilanishlari'};
    const texts={courseText:'Kurs haqida',platformText:'Platforma haqida',resultsText:'Natijalar',promotionText:'Kunlik sotuv xabari',familyText:'Jamoa xabari',methodicalText:'Haftalik ustozlar posti'};
    let generation=0;
    const api=(path,body,method='POST')=>apiFetch('/api/domwork/bot'+path,body?{method,body:JSON.stringify(body)}:{});
    async function render(el){
        if(!el || getCurrentUser()?.role!=='admin') return;
        const seq=++generation;
        el.innerHTML='<p>Bot boshqaruvi yuklanmoqda…</p>';
        let settings,bindings,observed,status,requests,deliveries,learning,funnel,act,sact;
        try { [settings,bindings,observed,status,requests,deliveries,learning,funnel,act,sact]=await Promise.all([
            api('/settings'),api('/bindings'),api('/observed-chats'),api('/status'),api('/leave-requests'),api('/delivery-status'),apiFetch('/api/domwork/groups'),
            api('/funnel/report').catch(()=>null),api('/staff-activation').catch(()=>null),api('/student-activation').catch(()=>null)]); }
        catch(error){if(seq===generation)el.textContent=error.message;return;}
        if(seq!==generation || getCurrentUser()?.role!=='admin')return;
        const groups=[...bindings.groups.filter(g=>g.active).map(g=>({id:g.id,name:types[g.type]+' · '+g.title})),
            ...learning.groups.filter(g=>!g.archived && g.botVerified).map(g=>({id:g.id,name:g.name}))];
        el.innerHTML=`<div class="domwork-groups"><h3>@Domworkuz_bot — boshqaruv</h3>
            <p>Holat: ${esc(status.state)} · Redis: ${status.redisReady?'Ulangan':'Hozir ulanmagan'} · Faqat rus tili</p>
            <button class="btn-secondary-sm" data-db-webhook type="button" ${status.state==='ready'?'':'disabled'}>Bot webhookini ulash</button>
            <p class="dg-note">Webhook faqat token va Redis serverda tekshirilgandan keyin ulanadi. Boshqa mavjud webhook tasdiqsiz almashtirilmaydi.</p>
            <p class="dg-note">Guruhni botdagi «Guruhlarni bog‘lash» orqali tanlang, keyin bu yerda bo‘limga biriktiring. Nom bo‘yicha avtomatik bog‘lanmaydi. Saqlash Telegramdagi yozishmalarni o‘chirmaydi.</p>
            <div role="status" aria-live="polite" data-db-message></div>
            <details open><summary>Bo‘lim guruhlari</summary><div class="dg-list">${Object.entries(types).map(([type,label])=>{
                const row=bindings.groups.find(g=>g.type===type);
                return `<form data-db-binding="${type}" data-revision="${row?.revision || 0}" class="dg-card"><h4>${esc(label)}</h4>
                    <label>Kuzatilgan guruh<select class="form-control" name="observed"><option value="">Qo‘lda chat_id kiritish</option>${observed.chats.map(c=>`<option value="${esc(c.chat_id)}">${esc(c.title)} · ${esc(c.chat_id)}</option>`).join('')}</select></label>
                    <label>chat_id<input class="form-control" name="chatId" value="${esc(row?.chat_id)}" required placeholder="-100..."></label>
                    <label>Havola<input class="form-control" type="url" name="inviteLink" value="${esc(row?.invite_link)}" placeholder="https://t.me/+..."></label>
                    <label class="dg-checkbox"><input type="checkbox" name="active" ${row?.active?'checked':''}>Faol bog‘lanish</label>
                    <button class="btn-primary" type="submit">Tekshirish va saqlash</button></form>`;
            }).join('')}</div></details>
            <details><summary>Avtomatika va materiallar</summary><form data-db-settings>
                <div class="dg-fields">${Object.entries(switches).map(([key,label])=>`<label class="dg-checkbox"><input type="checkbox" name="${key}" ${settings.data[key]?'checked':''}>${esc(label)}</label>`).join('')}
                <label>Kunlik sotuv xabari vaqti<input class="form-control" type="time" name="promotionTime" value="${esc(settings.data.promotionTime || '10:00')}"></label>
                <label>Jamoa xabari vaqti<input class="form-control" type="time" name="familyTime" value="${esc(settings.data.familyTime || '10:00')}"></label>
                <label>G‘oliblar xabari vaqti (Toshkent)<input class="form-control" type="time" name="awardsTime" value="${esc(settings.data.awardsTime || '23:00')}"></label>
                ${['weekly','monthly'].map(p=>`<label>${p==='weekly'?'Haftalik':'Oylik'} mukofot mezoni<select class="form-control" name="${p}AwardCriterion">${[['','Tanlanmagan'],['sales','Sof sotuv tushumi (menejerlar)'],['lessons','Tasdiqlangan darslar, teng bo‘lsa baho (asosiy ustozlar)']].map(([v,label])=>`<option value="${v}" ${settings.data[p+'AwardCriterion']===v?'selected':''}>${label}</option>`).join('')}</select></label>`).join('')}
                <label>Rasmiy kanal<input class="form-control" name="officialChannel" type="url" value="${esc(settings.data.officialChannel)}"></label></div>
                ${Object.entries(texts).map(([key,label])=>`<label>${esc(label)}<textarea class="form-control" name="${key}" maxlength="3500" rows="3">${esc(settings.data[key])}</textarea></label>`).join('')}
                <p class="dg-note">Yangi xabarlar o‘chiq. Kun sotuvchisi sof tushumdan, kun ustozi tasdiqlangan darslar va shu davr baholaridan olinadi. Teng natijada barcha g‘oliblar ko‘rsatiladi. Bog‘lanmagan refundlar bo‘lsa sotuv g‘olibi e’lon qilinmaydi. Haftalik/oylik mukofot mezoni tanlanishi shart. Tab­riklar uchun CRM voqealari va guruh xabarlari ham yoqilgan bo‘lishi kerak. Eski voqealar qayta yuborilmaydi.</p>
                <button class="btn-primary" type="submit">Sozlamalarni saqlash</button></form>
                <button type="button" class="btn-secondary-sm" data-db-awards>Bugungi g‘oliblarni xabar yubormasdan ko‘rish</button><div data-db-awards-preview></div></details>
            <details><summary>Lid voronkasi (yangi odamlar)</summary><form data-db-funnel>
                <p class="dg-note">Yoqilganda botga kelgan yangi odam (CRMda yo‘q) sovg‘a, 1-dars va menejer bilan bog‘lanishga yo‘naltiriladi; landing "Rahmat" sahifasi shaxsiy bot havolasini beradi. So‘rovlar "Sotuv" guruhiga keladi (yuqorida biriktiring). Materiallarni botga fayl qilib yuboring, izohga: <b>#voronka sovga</b>, <b>#voronka dars1</b>, <b>#voronka menejer</b>, <b>#voronka qollanma_bank</b> … Ro‘yxat: botga <b>#voronka</b> deb yozing.</p>
                <p>Yuklangan materiallar: ${esc(Object.keys(settings.data.funnelMedia || {}).join(', ') || 'yo‘q')}</p>
                <div class="dg-fields"><label class="dg-checkbox"><input type="checkbox" name="funnelEnabled" ${settings.data.funnelEnabled?'checked':''}>Voronka yoqilgan</label>
                <label class="dg-checkbox"><input type="checkbox" name="dripEnabled" ${settings.data.dripEnabled?'checked':''}>Isitish xabarlari (kuniga 1, 19:30–21:30)</label>
                <label>Bonus kanali (bot kanalda admin bo‘lsin)<input class="form-control" name="bonusChannel" placeholder="@domwork" value="${esc(settings.data.bonusChannel)}"></label>
                <label>Chegirma, %<input class="form-control" type="number" min="0" max="50" name="discountPercent" value="${esc(settings.data.discountPercent ?? 15)}"></label>
                <label>Chegirma muddati, soat<input class="form-control" type="number" min="1" max="336" name="discountHours" value="${esc(settings.data.discountHours ?? 72)}"></label>
                <label>Menejer javob beradi, daqiqa<input class="form-control" type="number" min="5" max="240" name="salesSlaMinutes" value="${esc(settings.data.salesSlaMinutes ?? 30)}"></label>
                <label>Sotuv ish vaqti (Toshkent)<input class="form-control" name="salesHours" placeholder="09:00-21:00" value="${esc(settings.data.salesHours || '09:00-21:00')}"></label>
                <label>O‘quvchi fikri — O‘zbekiston (post havolasi)<input class="form-control" type="url" name="testimonialB" placeholder="https://t.me/domwork_natijalari/123" value="${esc(settings.data.funnelTestimonials?.B)}"></label>
                <label>O‘quvchi fikri — migrant (post havolasi)<input class="form-control" type="url" name="testimonialA" placeholder="https://t.me/domwork_natijalari/124" value="${esc(settings.data.funnelTestimonials?.A)}"></label></div>
                <label>Kompaniya ma’lumoti ("Batafsil" ichida: MCHJ, STIR)<textarea class="form-control" name="companyInfo" maxlength="300" rows="2">${esc(settings.data.companyInfo)}</textarea></label>
                <button class="btn-primary" type="submit">Voronkani saqlash</button></form>
                ${funnel?`<p>So‘nggi ${funnel.days} kun (odamlar): ${funnel.steps.map(s=>`${esc({start:'Start',gift:'Sovg‘a',segment:'Segment',guide:'Qo‘llanma',lesson_part:'1-dars ochdi',lesson_seen:'Ko‘rdi',quiz:'Test',cta:'Taklif',contact:'Raqam',request:'So‘rov'}[s.event])}: ${s.people}`).join(' → ')} · Savollar: ${funnel.faq} · Yozganlar: ${funnel.freeText} · Kanal bonusi: ${funnel.bonus||0} · Menejer javoblari: ${funnel.relays||0}</p>
                ${(funnel.drips||[]).length?`<p>Isitish: ${funnel.drips.map(d=>`${esc(d.item)}: ${d.sent} ta${d.blocked?` · blok ${d.blockRate}%`:''}${d.alert?' ⚠️':''}`).join(' · ')}</p>`:''}`:''}</details>
            ${act?(()=>{const roleName={admin:'Admin',rop:'ROP',sales:'Sotuv',marketing:'Marketing',teacher:'Ustoz',assistant:'Yordamchi'};
                const done=act.people.filter(p=>p.acknowledged).length, linked=act.people.filter(p=>p.linked).length;
                return `<details ${act.required?'open':''}><summary>Xodimlarni botga ulash (qayta ishga tushirish) — ${done}/${act.people.length} tayyor</summary>
                <p class="dg-note">«Qayta ishga tushirish» bosilganda: ulangan xodimlarga botdan yangi xush kelibsiz xabari, yangi menyu va «✅ Tayyorman» tugmasi boradi. CRM va ustoz ilovasida mos xodimlarga (rus tili bo‘limi va adminlar) yopilmaydigan oyna chiqadi: ulanmagan — botni ulaydi, ulangan — «Tayyorman»ni bosadi. Bot xabar qabul qilmay qolsa (webhook/Redis), oyna o‘zi chiqmay qoladi. Siz (admin) «Keyinroq» bosishingiz mumkin. Telegrami yo‘q yoki ulay olmayotgan xodimni «Tayyor deb belgilash» bilan ozod qiling.</p>
                <p>Holat: ${act.required?'<b>Majburiy rejim yoqilgan</b>':'o‘chiq'} · Ulangan: ${linked} · Tayyor: ${done} · Jami: ${act.people.length}</p>
                <button type="button" class="btn-primary" data-act-relaunch ${status.state==='ready'?'':'disabled'}>${act.campaign?'Yana qayta ishga tushirish':'Qayta ishga tushirish'}</button>
                ${act.required?'<button type="button" class="btn-secondary-sm" data-act-stop>Majburiy oynani o‘chirish</button>':''}
                <table class="dg-table"><thead><tr><th>Xodim</th><th>Rol</th><th>Telegram</th><th>Tayyor</th><th></th></tr></thead><tbody>${act.people
                    .sort((a,b)=>(a.acknowledged-b.acknowledged)||(a.linked-b.linked)||String(a.name).localeCompare(String(b.name)))
                    .map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(roleName[p.role]||p.role)}</td><td>${p.linked?'✅ ulangan':'— ulanmagan'}</td><td>${p.exempt?'✅ admin belgiladi':p.acknowledged?'✅':'⏳'}</td><td>${act.required&&!p.acknowledged?`<button type="button" class="btn-secondary-sm" data-act-exempt="${esc(p.id)}">Tayyor deb belgilash</button>`:''}</td></tr>`).join('')}</tbody></table></details>`;})():''}
            ${sact?`<details ${sact.required?'open':''}><summary>O‘quvchilarni botga ulash — ${sact.linked}/${sact.total} ulangan</summary>
                <p class="dg-note">«Ishga tushirish» bosilganda: ulangan o‘quvchilarga botdan yangi menyu va xush kelibsiz xabari boradi; ulanmagan faol rus tili o‘quvchilariga yangi ilovada (student/v2) yopilmaydigan oyna chiqadi — «Botni ochish» → Telegramda Start → tamom, oyna o‘zi yopiladi. Bot xabar qabul qilmay qolsa, oyna chiqmaydi.</p>
                <p>Holat: ${sact.required?'<b>Majburiy rejim yoqilgan</b>':'o‘chiq'} · Ulangan: ${sact.linked} · Faol o‘quvchilar: ${sact.total}${sact.total?` (${Math.round(sact.linked/sact.total*100)}%)`:''}</p>
                <button type="button" class="btn-primary" data-sact-relaunch ${status.state==='ready'?'':'disabled'}>${sact.campaign?'Yana ishga tushirish':'Ishga tushirish'}</button>
                ${sact.required?'<button type="button" class="btn-secondary-sm" data-sact-stop>Majburiy oynani o‘chirish</button>':''}</details>`:''}
            <details><summary>Xabar tarqatish</summary><p>Rasm, video va ovozni botning admin menyusi orqali yuborish mumkin. Bu yerda matnli xabarni tayyorlang.</p>
                <form data-db-broadcast><label>Auditoriya<select class="form-control" name="segment">${Object.entries(roles).map(([id,label])=>`<option value="${id}">${esc(label)}</option>`).join('')}</select></label>
                    <fieldset><legend>Guruhlar — «Tanlangan guruhlar» uchun</legend>${groups.map(g=>`<label class="dg-checkbox"><input type="checkbox" name="group" value="${esc(g.id)}">${esc(g.name)}</label>`).join('') || '<p>Tekshirilgan guruh yo‘q.</p>'}</fieldset>
                    <label>Matn<textarea class="form-control" name="text" maxlength="3500" required rows="4"></textarea></label>
                    <label>Vaqt — bo‘sh bo‘lsa hozir (Toshkent)<input class="form-control" type="datetime-local" name="time"></label>
                    <button class="btn-primary" type="submit">Ko‘rib chiqish</button></form><div data-db-preview></div></details>
            <details><summary>Ruxsat arizalari</summary><div class="dg-list">${requests.requests.map(r=>`<article class="dg-card"><h4>${esc(r.name)}</h4><p>${esc(r.reason)}</p><p>${esc(String(r.start_date).slice(0,10))} — ${esc(String(r.end_date).slice(0,10))}</p><p>${esc(r.state)}</p>${r.state==='pending'?`<button class="btn-primary" data-db-review="${esc(r.id)}" data-state="approved">Tasdiqlash</button> <button class="btn-secondary-sm" data-db-review="${esc(r.id)}" data-state="rejected">Rad etish</button>`:''}</article>`).join('') || '<p>Arizalar yo‘q.</p>'}</div></details>
            <details><summary>Xabarlar monitoringi</summary><p>${deliveries.counts.map(r=>`${esc(r.state)}: ${esc(r.count)}`).join(' · ') || 'Xabarlar yo‘q.'}</p>
                <p class="dg-note">«uncertain» — Telegram yuborgan bo‘lishi mumkin. Takror yuborish avtomatik bajarilmaydi.</p>
                ${deliveries.failures.map(r=>`<p>${esc(r.state)} · ${esc(r.last_error)} · ${esc(r.id)}</p>`).join('')}</details>
            <button class="btn-secondary-sm" data-db-refresh type="button">Yangilash</button></div>`;
        let busy=false;
        const notify=(value,failed=false)=>{const node=el.querySelector('[data-db-message]');node.textContent=value;node.classList.toggle('dg-error',failed);};
        async function work(fn){if(busy)return;busy=true;const states=[...el.querySelectorAll('button')].map(b=>[b,b.disabled]);states.forEach(([b])=>b.disabled=true);try{await fn();}catch(e){notify(e.message,true);}finally{busy=false;states.forEach(([b,disabled])=>{if(b.isConnected)b.disabled=disabled;});}}
        el.querySelector('[data-db-webhook]').onclick=()=>work(async()=>{
            if(!confirm('@Domworkuz_bot uchun CRM webhookini ulaysizmi?'))return;
            await api('/webhook/setup',{replace:false});notify('Bot webhooki ulandi. Avtomatik xabarlar sozlamalar orqali alohida yoqiladi.');
        });
        el.querySelectorAll('[data-db-binding]').forEach(form=>{
            form.elements.observed.onchange=()=>{if(form.elements.observed.value)form.elements.chatId.value=form.elements.observed.value;};
            form.onsubmit=e=>{e.preventDefault();work(async()=>{
                await api('/bindings',{type:form.dataset.dbBinding,revision:Number(form.dataset.revision),chatId:form.elements.chatId.value,
                    inviteLink:form.elements.inviteLink.value,active:form.elements.active.checked},'PUT');await render(el);
            });};
        });
        el.querySelector('[data-db-settings]').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;work(async()=>{
            const body={revision:settings.revision};for(const key of Object.keys(switches))body[key]=form.elements[key].checked;
            for(const key of [...Object.keys(texts),'promotionTime','familyTime','awardsTime','weeklyAwardCriterion','monthlyAwardCriterion','officialChannel'])body[key]=form.elements[key].value;
            const saved=await api('/settings',body,'PUT');settings=saved;notify('Sozlamalar serverga saqlandi.');
        });};
        el.querySelector('[data-db-funnel]').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;work(async()=>{
            const saved=await api('/settings',{revision:settings.revision,funnelEnabled:f.elements.funnelEnabled.checked,dripEnabled:f.elements.dripEnabled.checked,bonusChannel:f.elements.bonusChannel.value.trim(),
                discountPercent:Number(f.elements.discountPercent.value),discountHours:Number(f.elements.discountHours.value),
                salesSlaMinutes:Number(f.elements.salesSlaMinutes.value),salesHours:f.elements.salesHours.value.trim(),companyInfo:f.elements.companyInfo.value,
                funnelTestimonials:{A:f.elements.testimonialA.value.trim(),B:f.elements.testimonialB.value.trim()}},'PUT');
            settings=saved;notify('Voronka sozlamalari saqlandi.');
        });};
        el.querySelector('[data-db-awards]').onclick=()=>work(async()=>{
            const value=await api('/awards/preview');el.querySelector('[data-db-awards-preview]').innerHTML=
                [value.sales,value.teachers].map(v=>`<p style="white-space:pre-wrap">${esc(v.text)}</p>`).join('');
        });
        el.querySelector('[data-db-broadcast]').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;work(async()=>{
            const preview=await api('/broadcasts/preview',{segment:form.elements.segment.value,content:{method:'sendMessage',text:form.elements.text.value},
                groupIds:[...form.querySelectorAll('[name="group"]:checked')].map(n=>n.value),scheduledAt:form.elements.time.value?form.elements.time.value+':00+05:00':undefined});
            const pane=el.querySelector('[data-db-preview]');pane.innerHTML=`<article class="dg-card"><h4>Yuborishdan oldin tekshiring</h4><p style="white-space:pre-wrap">${esc(preview.content.payload.text)}</p><p>${preview.count} ta manzil · ${esc(new Date(preview.scheduledAt).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'}))}</p><button class="btn-primary" data-confirm>Tasdiqlash va yuborish</button> <button class="btn-secondary-sm" data-cancel>Bekor qilish</button></article>`;
            for(const cancel of [false,true])pane.querySelector(cancel?'[data-cancel]':'[data-confirm]').onclick=()=>work(async()=>{
                await api('/broadcasts/'+encodeURIComponent(preview.id)+(cancel?'/cancel':'/confirm'),{fingerprint:preview.fingerprint});pane.textContent=cancel?'Bekor qilindi.':'Xabarlar navbatga qo‘shildi.';
            });
        });};
        el.querySelectorAll('[data-db-review]').forEach(button=>{button.onclick=()=>work(async()=>{
            if(!confirm('Ariza bo‘yicha qarorni saqlaysizmi?'))return;
            await api('/leave-requests/'+encodeURIComponent(button.dataset.dbReview)+'/review',{state:button.dataset.state});await render(el);
        });});
        el.querySelector('[data-db-refresh]').onclick=()=>render(el);
        const relaunch=el.querySelector('[data-act-relaunch]');
        if(relaunch)relaunch.onclick=()=>work(async()=>{
            if(!confirm('Hamma ulangan xodimlarga botdan yangi xabar boradi va CRMda majburiy ulash oynasi yoqiladi. Davom etasizmi?'))return;
            const r=await api('/staff-activation/relaunch',{});notify(`Ishga tushirildi: ${r.sent} ta xodimga xabar yuborildi. Qolganlar CRMga kirganda ulaydi.`);await render(el);
        });
        el.querySelectorAll('[data-act-exempt]').forEach(b=>{b.onclick=()=>work(async()=>{
            if(!confirm('Bu xodimga majburiy oyna boshqa chiqmaydi (shu ishga tushirish uchun). Belgilaysizmi?'))return;
            await api('/staff-activation/exempt',{userId:b.dataset.actExempt});await render(el);
        });});
        const sRel=el.querySelector('[data-sact-relaunch]');
        if(sRel)sRel.onclick=()=>work(async()=>{
            if(!confirm('Ulangan o‘quvchilarga botdan yangi xabar boradi va ilovada majburiy ulash oynasi yoqiladi. Davom etasizmi?'))return;
            const r=await api('/student-activation/relaunch',{});notify(`Ishga tushirildi: ${r.sent} ta o‘quvchiga xabar yuborildi. Qolganlar ilovaga kirganda ulaydi.`);await render(el);
        });
        const sStop=el.querySelector('[data-sact-stop]');
        if(sStop)sStop.onclick=()=>work(async()=>{
            if(!confirm('O‘quvchilar uchun majburiy oynani o‘chirasizmi?'))return;
            await api('/student-activation/stop',{});await render(el);
        });
        const stopAct=el.querySelector('[data-act-stop]');
        if(stopAct)stopAct.onclick=()=>work(async()=>{
            if(!confirm('Majburiy oynani o‘chirasizmi? Ulanmaganlar endi CRMdan bemalol foydalanadi.'))return;
            await api('/staff-activation/stop',{});await render(el);
        });
    }
    window.domworkBotUI={render};
}());
