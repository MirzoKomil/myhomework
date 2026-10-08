// Synthetic UI fixture only. Never imports server/db.js or connects to a database.
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { functionSource, constant } = require('./helpers/lead-workflow-fixture.cjs');
const root = path.resolve(__dirname, '..'), app = express();
app.use('/js', express.static(path.join(root, 'js')));
app.get('/', (_req, res) => {
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const from = index.indexOf('<div class="sales-panel active" data-teachers-panel="attendance"');
    const to = index.indexOf('<div class="sales-panel" data-teachers-panel="trial"', from);
    const css = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8').replace(/^@import[^\r\n]*(?:\r?\n|$)/, '');
    const functions = ['openModal', 'closeModal', '_openLiveGradeModal', 'applyTeacherAttendanceResult'].map(n => functionSource('js/app.js', n)).join('\n');
    res.type('html').send(`<!doctype html><html lang="uz"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teacher attendance — isolated QA</title><style>${css}
    body { padding:16px; } .fixture-shell { max-width:1100px; margin:auto; } .fixture-note { margin:0 0 12px; font-size:12px; color:var(--text-muted); } @media(max-width:600px){body{padding:8px}}
    </style></head><body><div class="fixture-shell"><p class="fixture-note">Izolyatsiyalangan test — haqiqiy o‘quvchilar va server ulanmagan</p>${index.slice(from, to)}</div>
    <div class="modal-overlay" id="modalOverlay" style="display:none"><div class="modal"><div class="modal-header"><h3 id="modalTitle"></h3><button class="modal-close" id="modalClose">&times;</button></div><div class="modal-body" id="modalBody"></div><div class="modal-footer" id="modalFooter"></div></div></div>
    <script src="/js/teacherRoles.js"></script><script src="/js/teacherAttendanceCalendar.js"></script><script>
    const STORAGE_KEYS={students:'students',teachers:'teachers',hrEmployees:'employees',mainAttendance:'main',assistantAttendance:'assistant',liveGrades:'grades'};
    const fixture = {students:[{id:'s1',name:'Aziza Testova',phone:'+998901234567',teacherId:'a',lessonDayOfWeek:2},{id:'s2',name:'Juda uzun ismli ikkinchi o‘quvchi Testov',phone:'+998909876543',teacherId:'a'}, {id:'s3',name:'Yordamchi o‘quvchi',phone:'+998901231234',teacherId:'b',assistantTeacherId:'a'},{id:'foreign',name:'BEGONA O‘QUVCHI',teacherId:'b'}],teachers:[{id:'a',name:'A ustoz',schedulePattern:'mwf'},{id:'b',name:'B ustoz'}],employees:[{id:'a',name:'A ustoz',role:'ingliz-oqituvchi',lang:'english',dualRole:true}],main:{'2026-10_a':{s1:{2:1}}},assistant:{'2026-10_a':{s3:{1:1,2:0}}},grades:{s1:[{teacherId:'a',date:'2026-10-02',lessonId:'speaking',scores:{attendance:5,activity:4,speaking:3,understanding:2,discipline:1}}]}};
    const getItem=(k,d)=>fixture[k]||d,setCachedItem=(k,v)=>{fixture[k]=v;};
    const getCurrentUser=()=>({role:'teacher',linkedTeacherId:'a'}),getMonthKey=()=> '2026-10';
    const resolveTeacherWithVirtual=id=>fixture.teachers.find(t=>t.id===id),formatPhoneDisplay=p=>p||'—';
    const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const _getSpeakingLessonOptions=()=>[{id:'speaking',label:'2-dars — jonli dars'}];
    ${constant('LIVE_GRADE_CRITERIA')}
    ${functions}
    const fixtureCalls=[];let fixtureFail=false;
    async function saveTeacherAttendanceChange(payload) {
        fixtureCalls.push(payload); await new Promise(resolve=>setTimeout(resolve,80));
        if(fixtureFail) throw Error('Test: server bilan aloqa yo‘q');
        const result={...payload,attendanceKey:payload.date.slice(0,7)+'_'+payload.teacherId,day:Number(payload.date.slice(8)),grade:payload.grade?{...payload.grade,date:payload.date,teacherId:payload.teacherId}:null};
        applyTeacherAttendanceResult(result); return result;
    }
    </script><script src="/js/teacherDutyUI.js"></script><script>teacherDutyUI.render();</script></body></html>`);
});
app.listen(8787, '127.0.0.1', () => process.stdout.write('Isolated teacher attendance QA: http://127.0.0.1:8787\n'));
