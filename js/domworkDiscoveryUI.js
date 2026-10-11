(function(){
    'use strict';
    const esc=v=>escapeHtml(String(v??''));
    const api=(path,body)=>apiFetch('/api/domwork/bot/'+path,body?{method:'POST',body:JSON.stringify(body),timeout:60000}:{});
    const labels={pending:'Navbatda',scanning:'Tekshirilmoqda',ready:'Tekshirildi',error:'Tekshiruv xatosi'};
    function mount(root,onSaved){
        const state={groups:[],teachers:[],candidates:[],students:[],busy:false,seq:0};
        root.innerHTML=`<section class="dg-card dg-discovery"><h4>Bot topgan guruhlar</h4>
            <p class="dg-note">Botni guruhga admin qilib qo‘shing. Bot guruh administratorlari orasidagi ro‘yxatdan o‘tgan rus tili ustozlarini aniqlaydi.
            Bitta ustoz topilsa taklif qilinadi; noma’lum yoki bir nechta ustoz bo‘lsa tanlang. Guruh turi va ustozni tekshirib tasdiqlang. Eski guruhlar almashtirilmaydi.</p>
            <div class="dg-actions"><button type="button" data-dd-scan>Avtomatik tekshiruvni boshlash</button><button type="button" data-dd-refresh>Ro‘yxatlarni yangilash</button></div>
            <p role="status" aria-live="polite" data-dd-message></p>
            <label>Guruh qidirish<input class="form-control" type="search" data-dd-query autocomplete="off" placeholder="Guruh nomi"></label>
            <label class="dg-checkbox"><input type="checkbox" data-dd-all> Ko‘rinayotgan tayyor guruhlarni tanlash</label>
            <div class="dg-list" data-dd-groups></div><button type="button" data-dd-confirm>Tanlangan guruhlarni tasdiqlash</button>
        </section><section class="dg-card dg-discovery"><h4>O‘quvchilarni o‘z guruhiga biriktirish</h4>
            <p class="dg-note">Botda ro‘yxatdan o‘tgan o‘quvchining aynan qaysi guruhlarga a’zoligi tekshiriladi. Bir nechta guruh bo‘lsa taxmin qilinmaydi.
            Botda ro‘yxatdan o‘tmagan o‘quvchini ham qo‘lda tanlash mumkin. Faqat o‘z asosiy ustozining guruhlariga biriktiriladi.</p>
            <div class="dg-fields"><label>Ism yoki telefon<input class="form-control" type="search" data-ds-query autocomplete="off"></label>
            <label>Ustoz<select class="form-control" data-ds-teacher></select></label>
            <label>Bog‘lanish<select class="form-control" data-ds-status><option value="unassigned">Hali biriktirilmaganlar</option><option value="all">Barcha o‘quvchilar</option></select></label></div>
            <label class="dg-checkbox"><input type="checkbox" data-ds-all> Ko‘rinayotgan tanlangan guruhli o‘quvchilarni belgilash</label>
            <p data-ds-count></p><div class="dg-list" data-ds-list></div><button type="button" data-ds-confirm>Tanlangan o‘quvchilarni biriktirish</button>
        </section>`;
        const $=s=>root.querySelector(s);
        function message(text,failed=false){$('[data-dd-message]').textContent=text;$('[data-dd-message]').classList.toggle('dg-error',failed);}
        function busy(value){state.busy=value;root.querySelectorAll('button').forEach(b=>b.disabled=value);}
        function teachers(value){return '<option value="">Ustozni tanlang</option>'+state.teachers.map(t=>`<option value="${esc(t.id)}" ${t.id===value?'selected':''}>${esc(t.name)}</option>`).join('');}
        function renderGroups(){
            const q=$('[data-dd-query]').value.toLocaleLowerCase().trim();
            $('[data-dd-all]').checked=false;
            $('[data-dd-groups]').innerHTML=state.candidates.filter(c=>(c.title+' '+c.chatId).toLocaleLowerCase().includes(q)).map(c=>{
                const options=c.evidence?.teachers||[],proposal=options.length===1?options[0].id:'';
                return `<article class="dg-card" data-dd-row="${esc(c.chatId)}"><label class="dg-checkbox"><input type="checkbox" data-dd-select ${c.state!=='ready'?'disabled':''}> ${esc(c.title||c.chatId)}</label>
                    <p>${esc(labels[c.state]||c.state)} · ${esc(c.chatId)}</p><p>${esc(c.lastError|| (options.length===1?'Ustoz avtomatik aniqlandi':options.length?'Bir nechta ustoz: '+options.map(t=>t.name).join(', '):'Ustoz aniqlanmadi — qo‘lda tanlang'))}</p>
                    <label>Dars turi<select class="form-control" data-dd-type><option value="classroom">Asosiy dars</option><option value="trial">Sinov darsi</option></select></label>
                    <label>Ustoz<select class="form-control" data-dd-teacher>${teachers(proposal)}</select></label>
                    <label>Guruh havolasi — ixtiyoriy<input class="form-control" data-dd-invite type="url" value="${esc(c.evidence?.inviteLink||'')}" placeholder="https://t.me/+..."></label>
                    <p class="dg-note">Havola topilmasa bo‘sh qolishi mumkin; keyin kiritasiz. Guruh nomidan ustoz taxmin qilinmaydi.</p></article>`;
            }).join('')||'<p>Yangi topilgan guruhlar yo‘q. Bot yangi guruhga admin qilib qo‘shilganda shu yerda chiqadi.</p>';
        }
        function renderStudents(){
            const q=$('[data-ds-query]').value.toLocaleLowerCase().trim(),digits=q.replace(/\D/g,''),teacher=$('[data-ds-teacher]').value;
            const rows=state.students.filter(s=>(!teacher||s.teacherId===teacher)&&($('[data-ds-status]').value==='all'||!s.groupId)
                &&(!q||s.name.toLocaleLowerCase().includes(q)||(digits&&String(s.phone||'').replace(/\D/g,'').includes(digits))));
            $('[data-ds-count]').textContent=`${rows.length} ta o‘quvchi · dastlabki 100 tasi ko‘rsatilmoqda. Qidiruv yoki ustoz filtridan foydalaning.`;
            $('[data-ds-all]').checked=false;
            $('[data-ds-list]').innerHTML=rows.slice(0,100).map(s=>{
                const candidates=s.discovery?.groups||[],proposal=s.groupId || (candidates.length===1?candidates[0].id:'');
                const own=state.groups.filter(g=>g.type==='classroom'&&!g.archived&&g.teacherId===s.teacherId);
                const existing=state.groups.find(g=>g.id===s.groupId);
                return `<article class="dg-card" data-ds-row="${esc(s.id)}"><label class="dg-checkbox"><input type="checkbox" data-ds-select> ${esc(s.name)}</label>
                    <p>${esc(s.phone)} · ${esc(s.teacherName||'Ustoz belgilanmagan')}</p>
                    <p>${esc(s.groupId?'Hozirgi guruh: '+(existing?.name||'Arxivdagi guruh'):s.discovery?.state==='ready'?(candidates.length===1?'Bitta guruhda a’zoligi aniqlandi':candidates.length?'Bir nechta guruhga a’zo — tanlang':s.discovery.reason==='not-registered'?'Botda ro‘yxatdan o‘tmagan':'Mos guruh topilmadi'):labels[s.discovery?.state]||'Tekshiruvni boshlang')}</p>
                    <label>O‘quvchining guruhi<select class="form-control" data-ds-group><option value="">Guruhni tanlang</option>${own.map(g=>`<option value="${esc(g.id)}" ${g.id===proposal?'selected':''}>${esc(g.name)}${g.botVerified?'':' (bot tekshirilmagan)'}</option>`).join('')}</select></label></article>`;
            }).join('')||'<p>Tanlangan filtr bo‘yicha o‘quvchilar yo‘q.</p>';
        }
        async function load(){
            const seq=++state.seq;
            const [data,candidates,students]=await Promise.all([apiFetch('/api/domwork/groups'),api('discovery'),api('student-groups')]);
            if(seq!==state.seq||getCurrentUser()?.role!=='admin')return;
            Object.assign(state,{groups:data.groups,teachers:data.teachers,candidates:candidates.candidates,students:students.students});
            const current=$('[data-ds-teacher]').value;
            $('[data-ds-teacher]').innerHTML='<option value="">Barcha ustozlar</option>'+state.teachers.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
            $('[data-ds-teacher]').value=current;
            renderGroups();renderStudents();
        }
        async function run(fn){if(state.busy)return;busy(true);try{await fn();}catch(e){message(e.message,true);}finally{busy(false);}}
        $('[data-dd-query]').oninput=()=>{if(!state.busy)renderGroups();};
        $('[data-ds-query]').oninput=()=>{if(!state.busy)renderStudents();};
        root.querySelectorAll('[data-ds-teacher],[data-ds-status]').forEach(el=>el.onchange=()=>{if(!state.busy)renderStudents();});
        $('[data-dd-all]').onchange=e=>root.querySelectorAll('[data-dd-row]').forEach(row=>{const cb=row.querySelector('[data-dd-select]');if(!cb.disabled&&row.querySelector('[data-dd-teacher]').value)cb.checked=e.target.checked;});
        $('[data-ds-all]').onchange=e=>root.querySelectorAll('[data-ds-row]').forEach(row=>{if(row.querySelector('[data-ds-group]').value)row.querySelector('[data-ds-select]').checked=e.target.checked;});
        $('[data-dd-refresh]').onclick=()=>run(async()=>{await load();message('Ro‘yxatlar yangilandi.');});
        $('[data-dd-scan]').onclick=()=>run(async()=>{await api('discovery/rescan',{});await load();message('Tekshiruv navbatga qo‘yildi. Bot guruhlarni va o‘quvchi a’zoligini fonda tekshiradi. Keyin “Ro‘yxatlarni yangilash”ni bosing.');});
        $('[data-dd-confirm]').onclick=()=>run(async()=>{
            const items=[...root.querySelectorAll('[data-dd-row]')].filter(r=>r.querySelector('[data-dd-select]').checked).map(row=>{
                const c=state.candidates.find(c=>c.chatId===row.dataset.ddRow);
                return {chatId:c.chatId,name:(c.evidence?.title||c.title).slice(0,120),revision:c.revision,type:row.querySelector('[data-dd-type]').value,
                    teacherId:row.querySelector('[data-dd-teacher]').value,inviteLink:row.querySelector('[data-dd-invite]').value.trim()};
            });
            if(!items.length||items.length>50||items.some(i=>!i.teacherId))throw Error('1–50 ta guruhni tanlang va har biriga ustoz belgilang.');
            if(!confirm(`${items.length} ta guruhni shu dars turi va ustozlarga bog‘laysizmi?\n`+items.map(i=>`${i.name} — ${i.type==='trial'?'Sinov':'Asosiy'} — ${state.teachers.find(t=>t.id===i.teacherId)?.name}`).join('\n')+'\nEski guruhlar o‘zgarmaydi. Xabar tarqatish yoqilmaydi.'))return;
            await api('discovery/confirm',{items});await load();await onSaved?.();message('Guruhlar tasdiqlandi. O‘quvchi a’zoligini tekshirish navbatga qo‘yildi.');
        });
        $('[data-ds-confirm]').onclick=()=>run(async()=>{
            const items=[...root.querySelectorAll('[data-ds-row]')].filter(r=>r.querySelector('[data-ds-select]').checked).map(row=>{
                const s=state.students.find(s=>s.id===row.dataset.dsRow);return{studentId:s.id,revision:s.revision,groupId:row.querySelector('[data-ds-group]').value};
            });
            if(!items.length||items.some(i=>!i.groupId))throw Error('O‘quvchilarni tanlang va har biriga guruh belgilang.');
            const changes=items.filter(i=>state.students.find(s=>s.id===i.studentId)?.groupId);
            if(!confirm(`${items.length} ta o‘quvchini tanlangan guruhlarga biriktirasizmi?${changes.length?'\nDiqqat: '+changes.length+' ta mavjud yangi guruh bog‘lanishi almashtiriladi.':''}\n`+items.map(i=>`${state.students.find(s=>s.id===i.studentId)?.name} → ${state.groups.find(g=>g.id===i.groupId)?.name}`).join('\n')+'\nEski o‘quvchi kartochkasi va tarixiy havolalari o‘zgarmaydi.'))return;
            await api('student-groups/confirm',{items});await load();message('O‘quvchilar guruhlarga biriktirildi. Eski CRM yozuvlari o‘zgarmadi.');
        });
        run(load);
    }
    window.domworkDiscoveryUI={mount};
}());
