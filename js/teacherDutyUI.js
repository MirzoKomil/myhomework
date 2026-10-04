(function () {
    'use strict';
    let selected = 'main', busy = false, lastError = '';
    const esc = value => escapeHtml(String(value ?? ''));
    function employeeField(checked = false) {
        return `<div class="form-group" id="employeeDualRoleWrap"><label class="teacher-dual-toggle">
            <input type="checkbox" role="switch" id="employeeDualRole" ${checked ? 'checked' : ''}>
            <span>Yordamchi ustoz sifatida ham ko‘rsatilsin</span></label></div>`;
    }
    function bindEmployee(roleId) {
        const role = document.getElementById(roleId), wrap = document.getElementById('employeeDualRoleWrap');
        if (!role || !wrap) return;
        const sync = () => { wrap.hidden = !teacherRoles.isMain({ role: role.value }); };
        role.addEventListener('change', sync); sync();
    }
    function bindAssignment(main, assistant) {
        if (!main || !assistant) return;
        const sync = () => {
            for (const option of assistant.options) option.disabled = !!option.value && option.value === main.value;
            if (teacherRoles.conflict(main.value, assistant.value)) assistant.value = '';
        };
        if (!main.dataset.dualRoleBound) { main.addEventListener('change', sync); main.dataset.dualRoleBound = '1'; }
        assistant.addEventListener('change', sync); sync();
    }
    function render() {
        const root = document.getElementById('mainAttendanceContainer');
        if (!root) return;
        const id = getCurrentUser()?.linkedTeacherId;
        const employee = getItem(STORAGE_KEYS.hrEmployees, []).find(e => e.id === id);
        const isMain = teacherRoles.isMain(employee), all = getItem(STORAGE_KEYS.students, []);
        const hasAssistant = all.some(s => s.assistantTeacherId === id);
        if (!isMain || (!hasAssistant && selected === 'assistant')) selected = isMain ? 'main' : 'assistant';
        const monthInput = document.getElementById('mainAttMonth');
        if (!monthInput.value) monthInput.value = getMonthKey(new Date());
        monthInput.onchange = () => { if (!busy) render(); };
        for (const controlId of ['mainAttTeacher','mainAttPattern','mainAttDuration','mainAttSubjectTabs']) {
            const control = document.getElementById(controlId); if (control) control.hidden = true;
        }
        document.getElementById('mainAttSummary').innerHTML = '';
        document.getElementById('mainAttTitle').textContent = 'Mening davomatim';
        if (!id || !employee) { root.innerHTML = '<p role="alert">Ustoz akkaunti HR profiliga biriktirilmagan. Administratorga murojaat qiling.</p>'; return; }
        const month = monthInput.value;
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
        const field = selected === 'assistant' ? 'assistantTeacherId' : 'teacherId';
        const students = all.filter(s => s[field] === id && !s.frozen && s.status !== 'inactive');
        const store = getItem(selected === 'assistant' ? STORAGE_KEYS.assistantAttendance : STORAGE_KEYS.mainAttendance, {});
        const attendance = store[`${month}_${id}`] || {};
        const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
        const ownTeacher = resolveTeacherWithVirtual(id) || {};
        const scheduled = getLessonDaysInMonth(Number(month.slice(0, 4)), Number(month.slice(5)), ownTeacher.schedulePattern || 'mwf');
        const teachers = getItem(STORAGE_KEYS.teachers, []);
        root.innerHTML = `<div class="teacher-duty-tabs" role="tablist" aria-label="Ustozlik davomati">
            ${isMain ? `<button role="tab" data-duty="main" aria-selected="${selected === 'main'}">Asosiy ustozlik davomati</button>` : ''}
            ${(!isMain || hasAssistant) ? `<button role="tab" data-duty="assistant" aria-selected="${selected === 'assistant'}">Yordamchi ustozlik davomati</button>` : ''}
        </div><p class="text-muted">${selected === 'main' ? 'Qatnashdi belgisida jonli dars baholari kiritiladi.' : 'Qatnashdi yoki Kelmadi tugmasini bosing. Faqat yordamchi davomat saqlanadi.'}</p>
        <div class="teacher-duty-students" role="tabpanel">${students.map(s => `<article class="teacher-duty-card">
            <h4>${esc(s.name)}</h4><p>${esc(formatPhoneDisplay(s.phone))}</p>
            ${selected === 'assistant' ? `<p>Asosiy ustoz: ${esc(teachers.find(t => t.id === s.teacherId)?.name || '—')}</p>` : ''}
            <div class="teacher-duty-days">${Array.from({ length: days }, (_, i) => i + 1)
                .filter(day => selected === 'assistant' || scheduled.includes(day)).map(day => {
                    const value = attendance[s.id]?.[day];
                    return `<div class="teacher-duty-day"><time datetime="${month}-${String(day).padStart(2, '0')}">${day}</time>
                        <button data-duty-student="${esc(s.id)}" data-duty-day="${day}" data-present="true" aria-label="${day}-kun: Qatnashdi" aria-pressed="${value === 1 || value === true}">Qatnashdi</button>
                        <button data-duty-student="${esc(s.id)}" data-duty-day="${day}" data-present="false" aria-label="${day}-kun: Kelmadi" aria-pressed="${value === 0}">Kelmadi</button></div>`;
                }).join('')}</div></article>`).join('') || '<p>Bu rolda faol o‘quvchilar biriktirilmagan.</p>'}</div><p data-duty-error role="alert">${esc(lastError)}</p>`;
        root.querySelectorAll('[data-duty]').forEach(button => { button.onclick = () => { if (!busy) { selected = button.dataset.duty; lastError = ''; render(); } }; });
        root.querySelectorAll('[data-duty-student]').forEach(button => { button.onclick = () => {
            if (busy) return;
            const role = selected, student = students.find(s => s.id === button.dataset.dutyStudent);
            const date = `${month}-${String(button.dataset.dutyDay).padStart(2, '0')}`, present = button.dataset.present === 'true';
            const save = async grade => {
                if (busy) return;
                busy = true; lastError = ''; monthInput.disabled = true;
                root.querySelectorAll('button').forEach(b => { b.disabled = true; });
                try { await saveTeacherAttendanceChange({ teacherId: id, studentId: student.id, date, present, attendanceType: role, grade }); }
                catch (err) { lastError = err.message; }
                finally { busy = false; monthInput.disabled = false; }
                render();
            };
            if (role === 'main' && present) {
                busy = true; root.querySelectorAll('button').forEach(b => { b.disabled = true; });
                _openLiveGradeModal(student.name, date, _getSpeakingLessonOptions(teacherRoles.language(employee)),
                    grade => { busy = false; return save(grade); }, () => { busy = false; render(); });
            }
            else save();
        }; });
        if (busy) root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    }
    window.teacherDutyUI = { employeeField, bindEmployee, bindAssignment, render };
}());
