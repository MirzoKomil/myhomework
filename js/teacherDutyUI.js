(function () {
    'use strict';
    let selected = 'main', expanded = '', busy = false, lastError = '';
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
        monthInput.setAttribute('aria-label', 'Davomat oyi');
        monthInput.onchange = () => { if (!busy) { lastError = ''; render(); } };
        root.closest('.card')?.classList.add('teacher-owned-attendance');
        root.closest('#tpAttendance')?.classList.add('teacher-owned-panel');
        document.getElementById('demoStudentSelect')?.closest('.card')?.classList.add('teacher-duty-hidden');
        for (const controlId of ['mainAttTeacher','mainAttPattern','mainAttDuration','mainAttSubjectTabs']) {
            const control = document.getElementById(controlId); if (control) { control.hidden = true; control.classList.add('teacher-duty-hidden'); }
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
        const ownTeacher = resolveTeacherWithVirtual(id) || {};
        const calendar = teacherAttendanceCalendar;
        if (!students.some(s => s.id === expanded)) expanded = students[0]?.id || '';
        const teachers = getItem(STORAGE_KEYS.teachers, []);
        root.innerHTML = `<div class="teacher-duty-tabs" role="tablist" aria-label="Ustozlik davomati">
            ${isMain ? `<button role="tab" data-duty="main" aria-selected="${selected === 'main'}">Asosiy ustozlik davomati</button>` : ''}
            ${(!isMain || hasAssistant) ? `<button role="tab" data-duty="assistant" aria-selected="${selected === 'assistant'}">Yordamchi ustozlik davomati</button>` : ''}
        </div><div class="teacher-duty-help"><p>Istalgan kunni bosib davomat qo‘ying. Belgilangan kunni qayta bosib o‘zgartiring yoki olib tashlang.</p>
        <div class="teacher-duty-legend"><span><i class="duty-planned"></i>Rejadagi kun</span><span><i class="duty-present">✓</i>Qatnashdi</span>${selected === 'assistant' ? '<span><i class="duty-absent">−</i>Kelmadi</span>' : ''}</div></div>
        <div class="teacher-duty-students" role="tabpanel">${students.map((s, index) => {
            const entries = attendance[s.id] || {}, panelId = `teacherDutyCalendar${index}`;
            const count = Object.values(entries).filter(v => calendar.status(v) === 'present').length;
            return `<article class="teacher-duty-card">
            <button type="button" class="teacher-duty-student" data-duty-expand="${esc(s.id)}" aria-expanded="${expanded === s.id}" aria-controls="${panelId}">
                <span><strong>${esc(s.name)}</strong><small>${esc(formatPhoneDisplay(s.phone))}</small></span>
                <span class="teacher-duty-count">${count} dars <span aria-hidden="true">${expanded === s.id ? '⌃' : '⌄'}</span></span>
            </button><div id="${panelId}" class="teacher-duty-calendar" ${expanded !== s.id ? 'hidden' : ''}>
            ${selected === 'assistant' ? `<p class="teacher-duty-primary">Asosiy ustoz: ${esc(teachers.find(t => t.id === s.teacherId)?.name || '—')}</p>` : ''}
            <div class="teacher-duty-weekdays" aria-hidden="true">${['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map(day => `<span>${day}</span>`).join('')}</div>
            <div class="teacher-duty-days">${calendar.cells(month, calendar.weekdays(s, ownTeacher, selected)).map(cell => {
                if (!cell) return '<span aria-hidden="true"></span>';
                const state = calendar.status(entries[cell.day]);
                const label = state === 'present' ? 'Qatnashdi' : state === 'absent' ? 'Kelmadi' : 'Belgilanmagan';
                return `<button type="button" class="teacher-duty-day${cell.scheduled ? ' duty-scheduled' : ''}" data-duty-student="${esc(s.id)}" data-duty-day="${cell.day}" data-status="${state}" aria-label="${cell.date}: ${label}${cell.scheduled ? ', rejadagi kun' : ''}" aria-pressed="${state === 'present'}"><time datetime="${cell.date}">${cell.day}</time><span aria-hidden="true">${state === 'present' ? '✓' : state === 'absent' ? '−' : ''}</span></button>`;
            }).join('')}</div></div></article>`;
        }).join('') || '<p class="teacher-duty-empty">Bu rolda faol o‘quvchilar biriktirilmagan.</p>'}</div><p data-duty-error role="alert">${esc(lastError)}</p>`;
        root.querySelectorAll('[data-duty]').forEach(button => { button.onclick = () => { if (!busy) { selected = button.dataset.duty; lastError = ''; render(); } }; });
        root.querySelectorAll('[data-duty-expand]').forEach(button => { button.onclick = () => {
            if (busy) return;
            const opened = button.getAttribute('aria-expanded') !== 'true';
            expanded = opened ? button.dataset.dutyExpand : '';
            root.querySelectorAll('[data-duty-expand]').forEach(b => {
                const active = opened && b === button;
                b.setAttribute('aria-expanded', String(active));
                document.getElementById(b.getAttribute('aria-controls')).hidden = !active;
                b.querySelector('[aria-hidden]').textContent = active ? '⌃' : '⌄';
            });
        }; });
        root.querySelectorAll('[data-duty-student]').forEach(button => { button.onclick = () => {
            if (busy) return;
            const role = selected, student = students.find(s => s.id === button.dataset.dutyStudent);
            const date = `${month}-${String(button.dataset.dutyDay).padStart(2, '0')}`;
            const save = async (present, grade) => {
                if (busy) return;
                busy = true; lastError = ''; monthInput.disabled = true;
                root.querySelectorAll('button').forEach(b => { b.disabled = true; });
                try { await saveTeacherAttendanceChange({ teacherId: id, studentId: student.id, date, present, attendanceType: role, grade }); }
                catch (err) { lastError = err.message; }
                finally { busy = false; monthInput.disabled = false; }
                render();
            };
            const edit = () => {
                const previous = getItem(STORAGE_KEYS.liveGrades, {})[student.id]?.find(g => g.date === date && g.teacherId === id);
                _openLiveGradeModal(student.name, date, _getSpeakingLessonOptions(teacherRoles.language(employee)),
                    grade => save(true, grade), () => {}, previous);
            };
            if (role === 'main' && button.dataset.status === 'empty') { edit(); return; }
            openModal(`${student.name} — ${date}`, `<p>Shu kundagi davomatni tanlang.</p>`,
                `<div class="teacher-duty-actions"><button type="button" class="btn-primary-sm" id="dutyPresent">${role === 'main' && button.dataset.status === 'present' ? 'Baholarni o‘zgartirish' : 'Qatnashdi'}</button>
                ${role === 'assistant' ? '<button type="button" class="btn-ghost" id="dutyAbsent">Kelmadi</button>' : ''}
                ${button.dataset.status !== 'empty' ? '<button type="button" class="btn-ghost teacher-duty-remove" id="dutyRemove">Belgini olib tashlash</button>' : ''}
                <button type="button" class="btn-ghost" id="dutyCancel">Bekor qilish</button></div>`);
            document.getElementById('dutyPresent').onclick = () => { closeModal(); if (role === 'main') edit(); else save(true); };
            const absent = document.getElementById('dutyAbsent'), remove = document.getElementById('dutyRemove');
            if (absent) absent.onclick = () => { closeModal(); save(false); };
            if (remove) remove.onclick = () => { closeModal(); save(null); };
            document.getElementById('dutyCancel').onclick = closeModal;
        }; });
        if (busy) root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    }
    window.teacherDutyUI = { employeeField, bindEmployee, bindAssignment, render };
}());
