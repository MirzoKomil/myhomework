// Myhomework.uz — Admin Panel

const TAB_TITLES = {
    dashboard: 'Bosh sahifa',
    timetable: 'Dars jadvali',
    'main-attendance': 'Asosiy ustozlar davomati',
    'assistant-attendance': 'Yordamchi ustoz davomati',
    'teacher-cabinet': 'Ustozlarga kabinet',
    salary: 'Ustozlar maoshi',
    students: "O'quvchilar",
    payments: "To'lovlar",
    leads: "Sotuv bo'limi",
    placeholder: 'Bo\'lim'
};

const PLACEHOLDER_TITLES = {
    curriculum: "O'quv rejasi",
    'sales-salary': 'Sotuv menejerlari maoshi',
    'other-salary': 'Boshqa maoshlar',
    'hr-employees': "Xodimlar ro'yxati",
    'hr-guides': "Yo'riqnomalar",
    'hr-contracts': 'Shartnomalar',
    'mobile-videos': 'Videodarslar'
};

let _tabContext = { subject: null, placeholder: null };

function initUserUI(currentUser) {
    const initials = currentUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('welcomeName').textContent = `Xush kelibsiz, ${currentUser.name.split(' ')[0]}!`;

    const headerDateEl = document.getElementById('headerDate');
    if (headerDateEl) {
        headerDateEl.textContent = new Date().toLocaleDateString('uz-UZ', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    document.getElementById('userAvatar').addEventListener('click', () => {
        if (confirm('Tizimdan chiqasizmi?')) {
            setCurrentUser(null);
            window.location.href = 'login.html';
        }
    });
}

async function bootApp() {
    const currentUser = getCurrentUser();
    if (!currentUser || !getToken()) {
        window.location.href = 'login.html';
        return;
    }

    try {
        await initStorage();
    } catch (err) {
        if (err.status === 401) {
            setCurrentUser(null);
            window.location.href = 'login.html';
            return;
        }
        const main = document.querySelector('.content-main') || document.body;
        main.innerHTML = `<div class="card" style="margin:40px;text-align:center;padding:40px">
            <h2>Server bilan ulanish yo'q</h2>
            <p class="text-muted">Terminalda <code>npm install</code> va <code>npm run dev</code> buyruqlarini ishga tushiring.</p>
            <p class="text-muted">${err.message}</p>
            <a href="login.html" class="btn-primary-sm" style="display:inline-block;margin-top:16px;text-decoration:none">Login sahifasi</a>
        </div>`;
        return;
    }

    initUserUI(currentUser);
    renderDashboard();
    renderCalendarWidget();
    startLeadsPolling();
}

let _leadsPollTimer = null;

function startLeadsPolling() {
    if (_leadsPollTimer) return;
    _leadsPollTimer = setInterval(async () => {
        try {
            const prev = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
            const prevCount = prev.english.length + prev.russian.length;
            const leads = await refreshLeadsFromApi();
            const newCount = leads.english.length + leads.russian.length;
            if (newCount > prevCount) {
                if (typeof syncNotifications === 'function') syncNotifications();
                if (document.getElementById('tab-leads')?.classList.contains('active')) renderLeads();
                if (document.getElementById('tab-dashboard')?.classList.contains('active')) renderDashboard();
                if (typeof renderNotificationPanel === 'function') renderNotificationPanel();
            }
        } catch {
            /* polling xatosini jim o'tkazamiz */
        }
    }, 30000);
}

function isMenuItemActive(el, tab, ctx) {
    if (el.dataset.tab !== tab) return false;
    if (tab === 'placeholder') return el.dataset.placeholder === ctx.placeholder;
    if (el.dataset.subject) return el.dataset.subject === (ctx.subject || '');
    if (ctx.subject && ['leads', 'students', 'timetable'].includes(tab)) return false;
    return true;
}

function updateSidebarActiveState(tab, ctx) {
    document.querySelectorAll('.menu-item, .menu-sub-item').forEach(el => {
        el.classList.toggle('active', isMenuItemActive(el, tab, ctx));
    });
    document.querySelectorAll('.menu-group').forEach(group => {
        const hasActive = group.querySelector('.menu-sub-item.active');
        if (hasActive) group.classList.add('open');
    });
}

function switchTab(tab, ctx = {}) {
    _tabContext = {
        subject: ctx.subject || null,
        placeholder: ctx.placeholder || null
    };

    updateSidebarActiveState(tab, _tabContext);

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const el = document.getElementById(`tab-${tab}`);
    if (el) el.classList.add('active');
    document.getElementById('rightPanel').classList.toggle('hidden', tab !== 'dashboard');
    renderTab(tab);
}

function initSidebarMenu() {
    document.querySelectorAll('.menu-group-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.closest('.menu-group');
            const isOpen = group.classList.toggle('open');
            btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    });

    document.querySelectorAll('.menu-item, .menu-sub-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            switchTab(item.dataset.tab, {
                subject: item.dataset.subject || null,
                placeholder: item.dataset.placeholder || null
            });
        });
    });
}

initSidebarMenu();

document.querySelectorAll('[data-goto]').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        switchTab(link.dataset.goto, {
            subject: link.dataset.subject || null
        });
    });
});

function renderTab(tab) {
    switch (tab) {
        case 'dashboard': renderDashboard(); break;
        case 'timetable': renderTimetable(); break;
        case 'main-attendance': renderMainAttendance(); break;
        case 'assistant-attendance': renderAssistantAttendance(); break;
        case 'teacher-cabinet': renderTeacherCabinet(); break;
        case 'salary': renderSalary(); break;
        case 'students': renderStudents(); break;
        case 'payments': renderPayments(); break;
        case 'leads': renderLeads(); break;
        case 'placeholder': renderPlaceholder(); break;
    }
    if (typeof renderNotificationPanel === 'function') renderNotificationPanel();
}

function renderPlaceholder() {
    const key = _tabContext.placeholder || 'curriculum';
    const title = PLACEHOLDER_TITLES[key] || 'Bo\'lim';
    document.getElementById('placeholderTitle').textContent = title;
    document.getElementById('placeholderHeading').textContent = title;
}

// --- Modal ---
function openModal(title, bodyHtml, footerHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml || '';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') closeModal();
});

// --- Dashboard ---
function renderDashboard() {
    const students = getItem(STORAGE_KEYS.students, []);
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
    document.getElementById('statStudents').textContent = students.length;
    document.getElementById('statTeachers').textContent = teachers.length;
    document.getElementById('statLeads').textContent = leads.english.length + leads.russian.length;

    renderTeacherCards(teachers, students);
    renderMiniSchedule();
    renderCalendarWidget();
    renderHwProgress(students);
}

function renderTeacherCards(teachers, students) {
    const colors = ['purple', 'yellow', 'pink'];
    const emojis = ['👩‍🏫', '👨‍🏫', '📚'];
    const container = document.getElementById('teacherCourseCards');
    if (!container) return;

    container.innerHTML = teachers.slice(0, 3).map((t, i) => {
        const count = students.filter(s => s.teacherId === t.id).length;
        const pct = count > 0 ? Math.min(100, count * 20) : 0;
        return `<div class="course-card">
            <div class="course-card-top ${colors[i % 3]}">${emojis[i % 3]}</div>
            <div class="course-card-body">
                <h4>${t.name}</h4>
                <p>${t.type === 'asosiy' ? 'Asosiy ustoz' : 'Yordamchi ustoz'}</p>
                <div class="course-meta"><span>👨‍🎓 ${count} o'quvchi</span></div>
                <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
                <div class="progress-text"><span>To'ldirilgan: ${pct}%</span><span>${count} ta</span></div>
            </div>
        </div>`;
    }).join('');
}

function renderMiniSchedule() {
    const container = document.getElementById('miniSchedule');
    if (!container) return;

    const days = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
    const times = ['08:00', '10:00', '12:00', '14:00'];
    const today = new Date().getDay();
    const events = [
        { day: 1, time: 0, label: 'Ingliz tili', color: 'yellow' },
        { day: 2, time: 1, label: 'Rus tili', color: 'blue' },
        { day: 3, time: 2, label: 'Matematika', color: 'green' },
        { day: 5, time: 3, label: 'Ingliz tili', color: 'pink' },
        { day: 1, time: 2, label: 'Grammatika', color: 'blue' }
    ];

    let html = '<div class="schedule-grid">';
    html += '<div></div>';
    days.forEach((d, i) => {
        html += `<div class="day-header ${i === today ? 'today' : ''}">${d}</div>`;
    });

    times.forEach((time, ti) => {
        html += `<div class="time-label">${time}</div>`;
        for (let di = 0; di < 7; di++) {
            const ev = events.find(e => e.day === di && e.time === ti);
            if (ev) {
                html += `<div class="schedule-event ${ev.color}">${ev.label}</div>`;
            } else {
                html += '<div class="schedule-event empty"></div>';
            }
        }
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderCalendarWidget() {
    const container = document.getElementById('calWeek');
    const title = document.getElementById('calMonthTitle');
    if (!container) return;

    const now = new Date();
    const monthNames = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
    if (title) title.textContent = monthNames[now.getMonth()] + ' ' + now.getFullYear();

    const dayNames = ['Yak','Dush','Sesh','Chor','Pay','Jum','Shan'];
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());

    let html = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const isToday = d.toDateString() === now.toDateString();
        html += `<div class="cal-day ${isToday ? 'active' : ''}">
            <div class="day-name">${dayNames[i]}</div>
            <div class="day-num">${String(d.getDate()).padStart(2,'0')}</div>
        </div>`;
    }
    container.innerHTML = html;

    const pct = Math.min(99, 40 + getItem(STORAGE_KEYS.students, []).length * 8);
    const ring = document.getElementById('growthPct');
    if (ring) ring.textContent = pct + '%';
}

function renderHwProgress(students) {
    const container = document.getElementById('hwProgress');
    if (!container) return;

    const tasks = [
        { title: 'Davomat to\'ldirish', desc: 'Oylik davomat jadvali', pct: students.length > 0 ? 66 : 33 },
        { title: 'To\'lovlarni kiritish', desc: 'Platforma va kitob to\'lovlari', pct: 99 },
        { title: 'Timetable yangilash', desc: 'Haftalik dars jadvali', pct: 45 }
    ];

    container.innerHTML = tasks.map(t => {
        const filled = Math.round(t.pct / 33);
        const segs = [0,1,2].map(i => {
            if (i < filled) return '<div class="hw-seg filled"></div>';
            if (i === filled && t.pct % 33 > 0) return '<div class="hw-seg partial"></div>';
            return '<div class="hw-seg"></div>';
        }).join('');
        return `<div class="hw-item"><h5>${t.title}</h5><p>${t.desc}</p><div class="hw-segments">${segs}</div><div class="hw-pct">${t.pct}%</div></div>`;
    }).join('');
}

// --- Timetable ---
function initTimetableControls() {
    const ttDate = document.getElementById('ttDate');
    const ttView = document.getElementById('ttView');
    const savedView = ttView.value;
    if (!ttDate.value) ttDate.value = new Date().toISOString().split('T')[0];

    const teachers = getItem(STORAGE_KEYS.teachers, []);
    ttView.innerHTML = '<option value="individual">Individual</option>';
    teachers.forEach(t => {
        ttView.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
    if (savedView && [...ttView.options].some(o => o.value === savedView)) {
        ttView.value = savedView;
    }

    if (!ttDate.dataset.bound) {
        ttDate.dataset.bound = '1';
        ttDate.onchange = renderTimetable;
        ttView.onchange = renderTimetable;
    }
}

function renderTimetable() {
    initTimetableControls();
    const subject = _tabContext.subject;
    const titleEl = document.getElementById('timetablePageTitle');
    if (titleEl) {
        titleEl.textContent = subject
            ? `Dars jadvali — ${SUBJECTS[subject]?.label || subject} (probniy)`
            : 'Dars jadvali — Probniy darslar';
    }

    const date = document.getElementById('ttDate').value;
    const view = document.getElementById('ttView').value;
    let teachers = getItem(STORAGE_KEYS.teachers, []);
    let students = getItem(STORAGE_KEYS.students, []);
    if (subject) {
        teachers = teachers.filter(t => (t.subject || 'english') === subject);
        students = students.filter(s => (s.subject || 'english') === subject);
    }
    const salesManagers = getItem(STORAGE_KEYS.salesManagers, []);
    const timetable = getItem(STORAGE_KEYS.timetable, {});
    const slots = generateTimeSlots().filter((_, i) => i % 2 === 0);

    let html = '<table class="table timetable-table"><thead><tr>';
    html += '<th>Vaqt</th><th>Ustoz</th><th>Sotuv menejeri</th><th>O\'quvchi</th><th>Probniy status</th>';
    html += '</tr></thead><tbody>';

    slots.forEach(time => {
        const key = slotKey(date, time, view);
        const entry = timetable[key] || {};
        const teacherFilter = view !== 'individual' ? view : '';
        if (teacherFilter && !entry.teacherId) entry.teacherId = teacherFilter;

        html += `<tr class="tt-row">
            <td class="tt-time">${time}</td>
            <td><select class="form-control-sm tt-teacher" data-key="${key}" data-field="teacherId" ${teacherFilter ? 'disabled' : ''}>
                <option value="">—</option>
                ${teachers.map(t => `<option value="${t.id}" ${(teacherFilter === t.id || entry.teacherId === t.id) ? 'selected' : ''}>${t.name}</option>`).join('')}
            </select></td>
            <td><select class="form-control-sm tt-sales" data-key="${key}" data-field="salesManagerId">
                <option value="">—</option>
                ${salesManagers.map(s => `<option value="${s.id}" ${entry.salesManagerId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select></td>
            <td><select class="form-control-sm tt-student" data-key="${key}" data-field="studentId">
                <option value="">—</option>
                ${students.map(s => `<option value="${s.id}" ${entry.studentId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select></td>
            <td class="tt-status-cell">
                <label class="checkbox-label">
                    <input type="checkbox" class="tt-status" data-key="${key}" data-field="completed" ${entry.completed ? 'checked' : ''}>
                    <span class="badge badge-probniy">${entry.completed ? 'O\'tdi (bepul)' : 'Rejalashtirilgan'}</span>
                </label>
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('timetableContainer').innerHTML = html;

    document.querySelectorAll('#timetableContainer select').forEach(sel => {
        sel.addEventListener('change', saveTimetableEntry);
    });
    document.querySelectorAll('#timetableContainer .tt-status').forEach(cb => {
        cb.addEventListener('change', saveTimetableEntry);
    });
}

function saveTimetableEntry(e) {
    const el = e.target;
    const key = el.dataset.key;
    const field = el.dataset.field;
    const view = document.getElementById('ttView').value;
    const timetable = getItem(STORAGE_KEYS.timetable, {});
    if (!timetable[key]) timetable[key] = { isProbniy: true };
    if (view !== 'individual') timetable[key].teacherId = view;
    if (field === 'completed') {
        timetable[key].completed = el.checked;
    } else {
        timetable[key][field] = el.value;
    }
    setItem(STORAGE_KEYS.timetable, timetable);
    renderTimetable();
}

function renderKpiSummary(containerId, kpi, teacherName) {
    const el = document.getElementById(containerId);
    if (!el) return;
    let breakdown = '';
    if (kpi.perStudent && kpi.perStudent.length) {
        breakdown = `<div class="kpi-breakdown">
            <div class="kpi-breakdown-title">Har bir o'quvchi bo'yicha (max ${formatMoney(kpi.monthlyBase)} / oy)</div>
            ${kpi.perStudent.map(ps => `
                <div class="kpi-breakdown-row">
                    <span>${ps.name} — <strong>${ps.lessons}</strong>/${kpi.expected} dars</span>
                    <span>${formatMoney(ps.earned)}</span>
                </div>
            `).join('')}
        </div>`;
    }
    el.innerHTML = `
        <div class="kpi-stat"><div class="kpi-num">${kpi.studentCount}</div><div class="kpi-lbl">O'quvchilar</div></div>
        <div class="kpi-stat"><div class="kpi-num">${kpi.expected}</div><div class="kpi-lbl">Reja (har o'quvchi)</div></div>
        <div class="kpi-stat"><div class="kpi-num">${kpi.completed}</div><div class="kpi-lbl">Jami o'tilgan darslar</div></div>
        <div class="kpi-stat"><div class="kpi-num">${formatMoney(Math.round(kpi.perLesson))}</div><div class="kpi-lbl">1 dars narxi</div></div>
        <div class="kpi-stat"><div class="kpi-num">${kpi.kpiPercent}%</div><div class="kpi-lbl">KPI</div></div>
        <div class="kpi-stat"><div class="kpi-num" style="color:var(--success)">${formatMoney(kpi.total)}</div><div class="kpi-lbl">${teacherName || 'Jami'} maoshi</div></div>
        ${breakdown}
    `;
}

function syncTeacherSettings(teacherId, patternSel, durationSel, rerender) {
    const teacher = getItem(STORAGE_KEYS.teachers, []).find(t => t.id === teacherId);
    if (!teacher) return null;
    if (patternSel) {
        patternSel.value = teacher.schedulePattern || 'mwf';
        patternSel.onchange = () => {
            updateTeacher(teacherId, { schedulePattern: patternSel.value });
            rerender();
        };
    }
    if (durationSel) {
        durationSel.value = String(teacher.lessonDuration || 15);
        durationSel.onchange = () => {
            updateTeacher(teacherId, { lessonDuration: parseInt(durationSel.value) });
            rerender();
        };
    }
    return teacher;
}

// --- Fan filtri (Ingliz / Rus) ---
function getSelectedSubject(tabsId) {
    const active = document.querySelector(`#${tabsId} .subject-tab.active`);
    return active?.dataset.subject || 'english';
}

function initSubjectTabs(tabsId, onChange) {
    document.querySelectorAll(`#${tabsId} .subject-tab`).forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            document.querySelectorAll(`#${tabsId} .subject-tab`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onChange();
        });
    });
}

function updateAttSectionTitle(titleId, subject) {
    const el = document.getElementById(titleId);
    if (el) el.textContent = `${SUBJECTS[subject]?.label || subject} — oylik davomat`;
}

// --- Asosiy ustozlar davomati (o'quvchi davomati) ---
function initMainAttControls() {
    initSubjectTabs('mainAttSubjectTabs', renderMainAttendance);
    const subject = getSelectedSubject('mainAttSubjectTabs');
    const teachers = filterTeachersByTypeAndSubject('asosiy', subject);
    const sel = document.getElementById('mainAttTeacher');
    const month = document.getElementById('mainAttMonth');
    if (!month.value) month.value = getMonthKey(new Date());

    const prev = sel.value;
    sel.innerHTML = teachers.length
        ? teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
        : '<option value="">— Ustoz yo\'q —</option>';
    if (prev && teachers.some(t => t.id === prev)) sel.value = prev;
    else if (teachers.length) sel.value = teachers[0].id;

    sel.onchange = renderMainAttendance;
    month.onchange = renderMainAttendance;
    updateAttSectionTitle('mainAttTitle', subject);
}

function renderMainAttendance() {
    initMainAttControls();
    const subject = getSelectedSubject('mainAttSubjectTabs');
    const teacherId = document.getElementById('mainAttTeacher').value;
    if (!teacherId) {
        document.getElementById('mainAttendanceContainer').innerHTML =
            `<p class="text-muted">${getSubjectLabel(subject)} bo'yicha asosiy ustozlar yo'q.</p>`;
        document.getElementById('mainAttSummary').innerHTML = '';
        return;
    }
    const monthVal = document.getElementById('mainAttMonth').value;
    const patternSel = document.getElementById('mainAttPattern');
    const durationSel = document.getElementById('mainAttDuration');
    const teacher = syncTeacherSettings(teacherId, patternSel, durationSel, renderMainAttendance);
    if (!teacher) return;

    const [year, month] = monthVal.split('-').map(Number);
    const days = getDaysInMonth(year, month);
    const pattern = teacher.schedulePattern || 'mwf';
    const lessonDays = getLessonDaysInMonth(year, month, pattern);
    const students = getItem(STORAGE_KEYS.students, []).filter(s =>
        s.teacherId === teacherId && (s.subject || 'english') === subject
    );
    const attendance = getItem(STORAGE_KEYS.mainAttendance, {});
    const attKey = `${monthVal}_${teacherId}`;
    if (!attendance[attKey]) attendance[attKey] = {};

    let html = '<table class="table attendance-table"><thead><tr>';
    html += '<th class="sticky-col">№</th><th class="sticky-col-2">O\'quvchi</th><th>Telefon</th><th>Darslar</th>';
    for (let d = 1; d <= days; d++) {
        const isLesson = isLessonDay(year, month, d, pattern);
        html += `<th class="att-day ${isLesson ? 'lesson-day-col' : ''}" title="${isLesson ? 'Dars kuni' : ''}">${d}</th>`;
    }
    html += '</tr></thead><tbody>';

    if (!students.length) {
        html += `<tr><td colspan="${days + 4}" class="text-muted">${getSubjectLabel(subject)} — bu ustozga biriktirilgan o'quvchilar yo'q.</td></tr>`;
    }

    students.forEach((s, i) => {
        if (!attendance[attKey][s.id]) attendance[attKey][s.id] = {};
        html += `<tr><td class="sticky-col">${i + 1}</td><td class="sticky-col-2">${s.name}</td><td>${s.phone || '—'}</td><td class="lesson-count" data-student="${s.id}">0</td>`;
        for (let d = 1; d <= days; d++) {
            const marked = attendance[attKey][s.id][d];
            const isLesson = isLessonDay(year, month, d, pattern);
            const disabled = !isLesson ? 'disabled' : '';
            html += `<td class="att-cell ${isLesson ? 'lesson-day-col' : ''} ${marked ? 'att-present' : ''}">
                <input type="checkbox" class="att-check" data-att-key="${attKey}" data-student="${s.id}" data-day="${d}" ${marked ? 'checked' : ''} ${disabled}>
            </td>`;
        }
        html += '</tr>';
    });

    html += '</tbody></table>';
    setItem(STORAGE_KEYS.mainAttendance, attendance);
    document.getElementById('mainAttendanceContainer').innerHTML = html;

    const kpi = calculateKpiSalary(teacher, monthVal, attendance, students);
    renderKpiSummary('mainAttSummary', kpi, teacher.name);

    document.querySelectorAll('.att-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const att = getItem(STORAGE_KEYS.mainAttendance, {});
            const k = cb.dataset.attKey;
            const sid = cb.dataset.student;
            const day = cb.dataset.day;
            if (!att[k]) att[k] = {};
            if (!att[k][sid]) att[k][sid] = {};
            if (cb.checked) att[k][sid][day] = 1;
            else delete att[k][sid][day];
            setItem(STORAGE_KEYS.mainAttendance, att);
            renderMainAttendance();
        });
    });

    document.querySelectorAll('.lesson-count').forEach(cell => {
        const sid = cell.dataset.student;
        const att = getItem(STORAGE_KEYS.mainAttendance, {})[attKey]?.[sid] || {};
        const count = lessonDays.filter(d => att[d]).length;
        cell.textContent = count;
    });
}

// --- Yordamchi ustoz davomati ---
function initAsstAttControls() {
    initSubjectTabs('asstAttSubjectTabs', renderAssistantAttendance);
    const subject = getSelectedSubject('asstAttSubjectTabs');
    const teachers = filterTeachersByTypeAndSubject('yordamchi', subject);
    const sel = document.getElementById('asstAttTeacher');
    const month = document.getElementById('asstAttMonth');
    if (!month.value) month.value = getMonthKey(new Date());

    const prev = sel.value;
    sel.innerHTML = teachers.length
        ? teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
        : '<option value="">— Ustoz yo\'q —</option>';
    if (prev && teachers.some(t => t.id === prev)) sel.value = prev;
    else if (teachers.length) sel.value = teachers[0].id;

    sel.onchange = renderAssistantAttendance;
    month.onchange = renderAssistantAttendance;
    updateAttSectionTitle('asstAttTitle', subject);
}

function renderAssistantAttendance() {
    initAsstAttControls();
    const subject = getSelectedSubject('asstAttSubjectTabs');
    const teacherId = document.getElementById('asstAttTeacher').value;
    if (!teacherId) {
        document.getElementById('assistantAttendanceContainer').innerHTML =
            `<p class="text-muted">${getSubjectLabel(subject)} bo'yicha yordamchi ustozlar yo'q. "Ustoz qo'shish" tugmasini bosing.</p>`;
        document.getElementById('asstAttSummary').innerHTML = '';
        return;
    }

    const monthVal = document.getElementById('asstAttMonth').value;
    const patternSel = document.getElementById('asstAttPattern');
    const durationSel = document.getElementById('asstAttDuration');
    const teacher = syncTeacherSettings(teacherId, patternSel, durationSel, renderAssistantAttendance);
    if (!teacher) return;

    const [year, month] = monthVal.split('-').map(Number);
    const days = getDaysInMonth(year, month);
    const pattern = teacher.schedulePattern || 'mwf';
    const lessonDays = getLessonDaysInMonth(year, month, pattern);
    const students = getItem(STORAGE_KEYS.students, []).filter(s =>
        s.assistantTeacherId === teacherId && (s.subject || 'english') === subject
    );
    const attendance = getItem(STORAGE_KEYS.assistantAttendance, {});
    const attKey = `${monthVal}_${teacherId}`;
    if (!attendance[attKey]) attendance[attKey] = {};

    let html = '<table class="table attendance-table"><thead><tr>';
    html += '<th class="sticky-col">№</th><th class="sticky-col-2">O\'quvchi</th><th>Telefon</th><th>Darslar</th>';
    for (let d = 1; d <= days; d++) {
        const isLesson = isLessonDay(year, month, d, pattern);
        html += `<th class="att-day ${isLesson ? 'lesson-day-col' : ''}">${d}</th>`;
    }
    html += '</tr></thead><tbody>';

    if (!students.length) {
        html += `<tr><td colspan="${days + 4}" class="text-muted">${getSubjectLabel(subject)} — bu yordamchi ustozga biriktirilgan o'quvchilar yo'q.</td></tr>`;
    }

    students.forEach((s, i) => {
        if (!attendance[attKey][s.id]) attendance[attKey][s.id] = {};
        html += `<tr><td class="sticky-col">${i + 1}</td><td class="sticky-col-2">${s.name}</td><td>${s.phone || '—'}</td><td class="asst-lesson-count" data-student="${s.id}">0</td>`;
        for (let d = 1; d <= days; d++) {
            const marked = attendance[attKey][s.id][d];
            const isLesson = isLessonDay(year, month, d, pattern);
            html += `<td class="att-cell ${isLesson ? 'lesson-day-col' : ''} ${marked ? 'att-present' : ''}">
                <input type="checkbox" class="asst-att-check" data-att-key="${attKey}" data-student="${s.id}" data-day="${d}" ${marked ? 'checked' : ''} ${!isLesson ? 'disabled' : ''}>
            </td>`;
        }
        html += '</tr>';
    });

    html += '</tbody></table>';
    setItem(STORAGE_KEYS.assistantAttendance, attendance);
    document.getElementById('assistantAttendanceContainer').innerHTML = html;

    const kpi = calculateKpiSalary(teacher, monthVal, attendance, students);
    renderKpiSummary('asstAttSummary', kpi, teacher.name);

    document.querySelectorAll('.asst-att-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const att = getItem(STORAGE_KEYS.assistantAttendance, {});
            const k = cb.dataset.attKey;
            const sid = cb.dataset.student;
            const day = cb.dataset.day;
            if (!att[k]) att[k] = {};
            if (!att[k][sid]) att[k][sid] = {};
            if (cb.checked) att[k][sid][day] = 1;
            else delete att[k][sid][day];
            setItem(STORAGE_KEYS.assistantAttendance, att);
            renderAssistantAttendance();
        });
    });

    document.querySelectorAll('.asst-lesson-count').forEach(cell => {
        const sid = cell.dataset.student;
        const att = getItem(STORAGE_KEYS.assistantAttendance, {})[attKey]?.[sid] || {};
        cell.textContent = lessonDays.filter(d => att[d]).length;
    });
}

document.getElementById('addAsstTeacher').addEventListener('click', () => {
    const currentSubject = getSelectedSubject('asstAttSubjectTabs');
    openModal("Yordamchi ustoz qo'shish",
        `<div class="form-group"><label>Ism familiya</label><input id="mAsstName" class="form-control"></div>
         <div class="form-group"><label>Telefon</label><input id="mAsstPhone" class="form-control"></div>
         <div class="form-group"><label>Fan</label>
            <select id="mAsstSubject" class="form-select">
                <option value="english" ${currentSubject === 'english' ? 'selected' : ''}>🇬🇧 Ingliz tili</option>
                <option value="russian" ${currentSubject === 'russian' ? 'selected' : ''}>🇷🇺 Rus tili</option>
            </select>
         </div>
         <div class="form-group"><label>Dars kunlari</label>
            <select id="mAsstPattern" class="form-select">
                <option value="mwf">Dushanba, Chorshanba, Juma</option>
                <option value="tts">Seshanba, Payshanba, Shanba</option>
            </select>
         </div>
         <div class="form-group"><label>Dars davomiyligi</label>
            <select id="mAsstDuration" class="form-select">
                <option value="15">15 daqiqa (75,000/oy)</option>
                <option value="30">30 daqiqa (150,000/oy)</option>
                <option value="60">60 daqiqa (300,000/oy)</option>
            </select>
         </div>`,
        `<button class="btn-primary-sm" id="saveAsstTeacher">Saqlash</button>`
    );
    document.getElementById('saveAsstTeacher').onclick = () => {
        const name = document.getElementById('mAsstName').value.trim();
        if (!name) return;
        const teachers = getItem(STORAGE_KEYS.teachers, []);
        teachers.push({
            id: 't' + Date.now(),
            name,
            type: 'yordamchi',
            subject: document.getElementById('mAsstSubject').value,
            phone: document.getElementById('mAsstPhone').value.trim(),
            schedulePattern: document.getElementById('mAsstPattern').value,
            lessonDuration: parseInt(document.getElementById('mAsstDuration').value)
        });
        setItem(STORAGE_KEYS.teachers, teachers);
        closeModal();
        const subj = document.getElementById('mAsstSubject').value;
        document.querySelectorAll('#asstAttSubjectTabs .subject-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.subject === subj);
        });
        renderAssistantAttendance();
    };
});

// --- Ustozlarga kabinet ---
function renderTeacherCabinet() {
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const sel = document.getElementById('cabinetTeacher');
    sel.innerHTML = teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    sel.onchange = () => renderTeacherCabinetContent(sel.value);
    if (teachers.length) renderTeacherCabinetContent(teachers[0].id);
}

function renderTeacherCabinetContent(teacherId) {
    const teacher = getItem(STORAGE_KEYS.teachers, []).find(t => t.id === teacherId);
    const students = getItem(STORAGE_KEYS.students, []).filter(s => s.teacherId === teacherId || s.assistantTeacherId === teacherId);
    const timetable = getItem(STORAGE_KEYS.timetable, {});
    const today = new Date().toISOString().split('T')[0];
    const todayProbniy = Object.entries(timetable).filter(([k, v]) => k.startsWith(today) && v.teacherId === teacherId);
    const monthVal = getMonthKey(new Date());
    const isAsosiy = teacher?.type === 'asosiy';
    const attStore = isAsosiy ? getItem(STORAGE_KEYS.mainAttendance, {}) : getItem(STORAGE_KEYS.assistantAttendance, {});
    const kpi = teacher ? calculateKpiSalary(teacher, monthVal, attStore) : null;

    let html = `<div class="grid-2">
        <div class="mini-card"><strong>Ustoz:</strong> ${teacher?.name || '—'}<br><small>${teacher?.type === 'asosiy' ? 'Asosiy' : 'Yordamchi'}</small></div>
        <div class="mini-card"><strong>O'quvchilar:</strong> ${students.length} ta</div>
    </div>`;

    if (kpi) {
        html += `<div class="kpi-summary" style="margin-top:16px">
            <div class="kpi-stat"><div class="kpi-num">${kpi.expected}</div><div class="kpi-lbl">Oy rejasi</div></div>
            <div class="kpi-stat"><div class="kpi-num">${kpi.completed}</div><div class="kpi-lbl">O'tilgan</div></div>
            <div class="kpi-stat"><div class="kpi-num">${formatMoney(kpi.total)}</div><div class="kpi-lbl">Bu oy maoshi</div></div>
        </div>
        <div class="kpi-progress-wrap"><div class="kpi-progress-bar" style="width:${kpi.kpiPercent}%"></div></div>`;
    }

    html += `<h4 style="margin:20px 0 10px">Bugungi probniy darslar <span class="badge badge-probniy">bepul</span></h4>`;
    if (todayProbniy.length === 0) {
        html += '<p class="text-muted">Bugun probniy darslar yo\'q.</p>';
    } else {
        html += '<table class="table"><thead><tr><th>Vaqt</th><th>O\'quvchi</th><th>Status</th></tr></thead><tbody>';
        const allStudents = getItem(STORAGE_KEYS.students, []);
        todayProbniy.forEach(([key, entry]) => {
            const time = key.split('_')[1];
            const student = allStudents.find(s => s.id === entry.studentId);
            html += `<tr><td>${time}</td><td>${student?.name || '—'}</td><td>${entry.completed ? '<span class="badge badge-probniy">O\'tdi</span>' : '<span class="badge">Kutilmoqda</span>'}</td></tr>`;
        });
        html += '</tbody></table>';
    }

    html += `<h4 style="margin:20px 0 10px">Mening o'quvchilarim</h4>
    <table class="table"><thead><tr><th>Ism</th><th>Telefon</th><th>Guruh</th></tr></thead><tbody>`;
    students.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.phone || '—'}</td><td>${s.group || '—'}</td></tr>`;
    });
    if (!students.length) html += '<tr><td colspan="3" class="text-muted">O\'quvchilar yo\'q</td></tr>';
    html += '</tbody></table>';

    document.getElementById('teacherCabinetContent').innerHTML = html;
}

// --- Maosh hisob-kitobi ---
function renderSalary() {
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const sel = document.getElementById('salaryTeacher');
    const month = document.getElementById('salaryMonth');
    if (!month.value) month.value = getMonthKey(new Date());

    sel.innerHTML = '<option value="all">Barcha ustozlar</option>' +
        teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    sel.onchange = renderSalaryContent;
    month.onchange = renderSalaryContent;
    renderSalaryContent();
}

function renderSalaryContent() {
    const teacherId = document.getElementById('salaryTeacher').value;
    const monthVal = document.getElementById('salaryMonth').value;
    const [year, month] = monthVal.split('-').map(Number);
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const filteredTeachers = teacherId === 'all' ? teachers : teachers.filter(t => t.id === teacherId);
    const mainAtt = getItem(STORAGE_KEYS.mainAttendance, {});
    const asstAtt = getItem(STORAGE_KEYS.assistantAttendance, {});

    const monthNames = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
    document.getElementById('salaryMonthInfo').innerHTML = `
        <div class="kpi-stat"><div class="kpi-num">${monthNames[month - 1]} ${year}</div><div class="kpi-lbl">Hisobot oyi</div></div>
        <div class="kpi-stat"><div class="kpi-num" style="font-size:14px">Davomat asosida</div><div class="kpi-lbl">Timetable (probniy) hisobga olinmaydi</div></div>
    `;

    let html = '<table class="table"><thead><tr>';
    html += '<th>Ustoz</th><th>Turi</th><th>O\'quvchilar</th><th>Reja</th><th>Jami darslar</th><th>1 dars</th><th>KPI</th><th>Maosh</th>';
    html += '</tr></thead><tbody>';

    let grandTotal = 0;

    filteredTeachers.forEach(teacher => {
        const attStore = teacher.type === 'yordamchi' ? asstAtt : mainAtt;
        const kpi = calculateKpiSalary(teacher, monthVal, attStore);
        grandTotal += kpi.total;
        const durLabel = kpi.duration + ' daq';
        html += `<tr>
            <td><strong>${teacher.name}</strong><br><small>${getSubjectLabel(teacher.subject || 'english')}</small></td>
            <td>${teacher.type === 'asosiy' ? 'Asosiy' : 'Yordamchi'}</td>
            <td>${kpi.studentCount} ta</td>
            <td>${kpi.expected} dars<br><small>${formatMoney(kpi.monthlyBase)}/o'quvchi</small></td>
            <td><strong>${kpi.completed}</strong></td>
            <td>${formatMoney(Math.round(kpi.perLesson))}</td>
            <td><span class="badge ${kpi.kpiPercent >= 100 ? 'badge-success' : ''}">${kpi.kpiPercent}%</span></td>
            <td><strong>${formatMoney(kpi.total)}</strong></td>
        </tr>`;
    });

    if (!filteredTeachers.length) {
        html += '<tr><td colspan="8" class="text-muted">Ustozlar topilmadi</td></tr>';
    }

    html += '</tbody></table>';
    html += `<div class="salary-total"><strong>Umumiy jami: ${formatMoney(grandTotal)}</strong></div>`;

    if (filteredTeachers.length === 1) {
        const kpi = calculateKpiSalary(filteredTeachers[0], monthVal,
            filteredTeachers[0].type === 'yordamchi' ? asstAtt : mainAtt);
        html += `<div class="card" style="margin-top:16px;padding:16px">
            <p class="text-muted" style="margin-bottom:12px"><strong>Hisoblash:</strong> Har o'quvchi uchun ${formatMoney(kpi.monthlyBase)} ÷ ${kpi.expected} dars = ${formatMoney(Math.round(kpi.perLesson))} / dars</p>`;
        if (kpi.perStudent.length) {
            kpi.perStudent.forEach(ps => {
                html += `<p class="text-muted">${ps.name}: ${ps.lessons} dars × ${formatMoney(Math.round(kpi.perLesson))} = <strong>${formatMoney(ps.earned)}</strong></p>`;
            });
        } else {
            html += `<p class="text-muted">O'quvchilar yo'q</p>`;
        }
        html += `<p style="margin-top:12px;font-weight:700">Jami: ${formatMoney(kpi.total)} (max mumkin: ${formatMoney(kpi.maxPossible)})</p>
            <div class="kpi-progress-wrap"><div class="kpi-progress-bar" style="width:${kpi.kpiPercent}%"></div></div>
        </div>`;
    }

    document.getElementById('salaryContent').innerHTML = html;
}

// --- O'quvchilar ---
function renderStudents() {
    const subject = _tabContext.subject;
    const titleEl = document.getElementById('studentsPageTitle');
    if (titleEl) {
        titleEl.textContent = subject
            ? `O'quvchilar — ${SUBJECTS[subject]?.label || subject}`
            : "O'quvchilar ma'lumotlari";
    }

    let students = getItem(STORAGE_KEYS.students, []);
    if (subject) {
        students = students.filter(s => (s.subject || 'english') === subject);
    }
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const tbody = document.getElementById('studentsBody');
    tbody.innerHTML = students.map((s, i) => {
        const teacher = teachers.find(t => t.id === s.teacherId);
        const asst = teachers.find(t => t.id === s.assistantTeacherId);
        return `<tr>
            <td>${i + 1}</td>
            <td>${s.name}</td>
            <td>${s.phone || '—'}</td>
            <td>${getSubjectLabel(s.subject || 'english')}</td>
            <td>${s.group || '—'}</td>
            <td>${teacher?.name || '—'}${asst ? '<br><small>Yordamchi: ' + asst.name + '</small>' : ''}</td>
            <td><button class="btn-danger-sm" data-delete-student="${s.id}">O'chirish</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" class="text-muted">O\'quvchilar yo\'q</td></tr>';

    document.querySelectorAll('[data-delete-student]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!confirm('O\'chirishni tasdiqlaysizmi?')) return;
            const id = btn.dataset.deleteStudent;
            setItem(STORAGE_KEYS.students, getItem(STORAGE_KEYS.students, []).filter(s => s.id !== id));
            renderStudents();
        });
    });
}

function fillStudentTeacherOptions(subject) {
    const asosiy = filterTeachersByTypeAndSubject('asosiy', subject);
    const yordamchi = filterTeachersByTypeAndSubject('yordamchi', subject);
    const tSel = document.getElementById('mStTeacher');
    const aSel = document.getElementById('mStAsstTeacher');
    if (tSel) {
        tSel.innerHTML = asosiy.length
            ? asosiy.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
            : '<option value="">— Ustoz yo\'q —</option>';
    }
    if (aSel) {
        aSel.innerHTML = '<option value="">— Tanlanmagan —</option>' +
            yordamchi.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }
}

document.getElementById('addStudentBtn').addEventListener('click', () => {
    openModal("O'quvchi qo'shish",
        `<div class="form-group"><label>Ism familiya</label><input id="mStName" class="form-control"></div>
         <div class="form-group"><label>Telefon</label><input id="mStPhone" class="form-control"></div>
         <div class="form-group"><label>Fan</label>
            <select id="mStSubject" class="form-select">
                <option value="english">🇬🇧 Ingliz tili</option>
                <option value="russian">🇷🇺 Rus tili</option>
            </select>
         </div>
         <div class="form-group"><label>Guruh</label><input id="mStGroup" class="form-control"></div>
         <div class="form-group"><label>Asosiy ustoz</label>
            <select id="mStTeacher" class="form-select"></select>
         </div>
         <div class="form-group"><label>Yordamchi ustoz (ixtiyoriy)</label>
            <select id="mStAsstTeacher" class="form-select"></select>
         </div>`,
        `<button class="btn-primary-sm" id="saveStudent">Saqlash</button>`
    );
    fillStudentTeacherOptions('english');
    document.getElementById('mStSubject').addEventListener('change', e => {
        fillStudentTeacherOptions(e.target.value);
    });
    document.getElementById('saveStudent').onclick = () => {
        const name = document.getElementById('mStName').value.trim();
        if (!name) return;
        const teacherId = document.getElementById('mStTeacher').value;
        if (!teacherId) { alert('Asosiy ustozni tanlang.'); return; }
        const students = getItem(STORAGE_KEYS.students, []);
        const asstId = document.getElementById('mStAsstTeacher').value;
        const subject = document.getElementById('mStSubject').value;
        students.push({
            id: 's' + Date.now(),
            name,
            phone: document.getElementById('mStPhone').value.trim(),
            group: document.getElementById('mStGroup').value.trim(),
            subject,
            teacherId,
            assistantTeacherId: asstId || null
        });
        setItem(STORAGE_KEYS.students, students);
        closeModal();
        renderStudents();
    };
});

// --- To'lovlar ---
function renderPayments() {
    const payments = getItem(STORAGE_KEYS.payments, []);
    const students = getItem(STORAGE_KEYS.students, []);
    const tbody = document.getElementById('paymentsBody');

    tbody.innerHTML = payments.map(p => {
        const student = students.find(s => s.id === p.studentId);
        return `<tr>
            <td>${student?.name || '—'}</td>
            <td>${formatMoney(p.platform || 0)}</td>
            <td>${formatMoney(p.book || 0)}</td>
            <td>${formatMoney(p.paid || 0)}</td>
            <td><span class="badge ${p.debt > 0 ? 'badge-danger' : 'badge-success'}">${formatMoney(p.debt || 0)}</span></td>
            <td>${p.date || '—'}</td>
            <td><button class="btn-danger-sm" data-delete-payment="${p.id}">O'chirish</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" class="text-muted">To\'lovlar yo\'q</td></tr>';

    document.querySelectorAll('[data-delete-payment]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.deletePayment;
            setItem(STORAGE_KEYS.payments, getItem(STORAGE_KEYS.payments, []).filter(p => p.id !== id));
            renderPayments();
        });
    });
}

document.getElementById('addPaymentBtn').addEventListener('click', () => {
    const students = getItem(STORAGE_KEYS.students, []);
    if (!students.length) { alert('Avval o\'quvchi qo\'shing.'); return; }
    openModal("To'lov qo'shish",
        `<div class="form-group"><label>O'quvchi</label>
            <select id="mPayStudent" class="form-select">${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
         </div>
         <div class="form-group"><label>Platforma to'lovi (so'm)</label><input type="number" id="mPayPlatform" class="form-control" value="0"></div>
         <div class="form-group"><label>Kitob to'lovi (so'm)</label><input type="number" id="mPayBook" class="form-control" value="0"></div>
         <div class="form-group"><label>To'langan (so'm)</label><input type="number" id="mPayPaid" class="form-control" value="0"></div>
         <div class="form-group"><label>Sana</label><input type="date" id="mPayDate" class="form-control" value="${new Date().toISOString().split('T')[0]}"></div>`,
        `<button class="btn-primary-sm" id="savePayment">Saqlash</button>`
    );
    document.getElementById('savePayment').onclick = () => {
        const platform = parseInt(document.getElementById('mPayPlatform').value) || 0;
        const book = parseInt(document.getElementById('mPayBook').value) || 0;
        const paid = parseInt(document.getElementById('mPayPaid').value) || 0;
        const total = platform + book;
        const payments = getItem(STORAGE_KEYS.payments, []);
        payments.push({
            id: 'p' + Date.now(),
            studentId: document.getElementById('mPayStudent').value,
            platform, book, paid,
            debt: Math.max(0, total - paid),
            date: document.getElementById('mPayDate').value
        });
        setItem(STORAGE_KEYS.payments, payments);
        closeModal();
        renderPayments();
    };
});

// --- Organik lidlar ---
function renderLeads() {
    const subject = _tabContext.subject;
    const titleEl = document.getElementById('leadsPageTitle');
    const enCard = document.getElementById('leadsCardEnglish');
    const ruCard = document.getElementById('leadsCardRussian');
    const grid = document.getElementById('leadsGrid');

    if (subject === 'english') {
        if (titleEl) titleEl.textContent = "Sotuv bo'limi — Ingliz tili kursi";
        if (enCard) enCard.style.display = '';
        if (ruCard) ruCard.style.display = 'none';
        if (grid) grid.classList.remove('grid-2');
    } else if (subject === 'russian') {
        if (titleEl) titleEl.textContent = "Sotuv bo'limi — Rus tili kursi";
        if (enCard) enCard.style.display = 'none';
        if (ruCard) ruCard.style.display = '';
        if (grid) grid.classList.remove('grid-2');
    } else {
        if (titleEl) titleEl.textContent = "Sotuv bo'limi — organik lidlar";
        if (enCard) enCard.style.display = '';
        if (ruCard) ruCard.style.display = '';
        if (grid) grid.classList.add('grid-2');
    }

    const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
    renderLeadTable('leadsEnglish', leads.english, 'english');
    renderLeadTable('leadsRussian', leads.russian, 'russian');
}

function leadSourceLabel(source) {
    const s = (source || '').toLowerCase();
    if (s.includes('domwork')) return '<span class="lead-badge lead-badge-domwork">Domwork</span>';
    if (s.includes('homework')) return '<span class="lead-badge lead-badge-homework">Homework</span>';
    return source || 'Organik';
}

function renderLeadTable(tbodyId, items, lang) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = items.map(l => `<tr>
        <td>${l.name}</td><td>${l.phone}</td><td>${leadSourceLabel(l.source)}</td><td>${l.date}</td>
        <td><button class="btn-danger-sm" data-delete-lead="${lang}" data-lead-id="${l.id}">×</button></td>
    </tr>`).join('') || '<tr><td colspan="5" class="text-muted">Lidlar yo\'q</td></tr>';

    tbody.querySelectorAll('[data-delete-lead]').forEach(btn => {
        btn.addEventListener('click', () => {
            const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
            const langKey = btn.dataset.deleteLead;
            leads[langKey] = leads[langKey].filter(l => l.id !== btn.dataset.leadId);
            setItem(STORAGE_KEYS.leads, leads);
            renderLeads();
        });
    });
}

document.querySelectorAll('[data-lead-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.dataset.leadLang;
        const title = lang === 'english' ? 'Ingliz tili — yangi lid' : 'Rus tili — yangi lid';
        openModal(title,
            `<div class="form-group"><label>Ism</label><input id="mLeadName" class="form-control"></div>
             <div class="form-group"><label>Telefon</label><input id="mLeadPhone" class="form-control"></div>
             <div class="form-group"><label>Manba</label><input id="mLeadSource" class="form-control" value="Organik"></div>`,
            `<button class="btn-primary-sm" id="saveLead">Saqlash</button>`
        );
        document.getElementById('saveLead').onclick = () => {
            const name = document.getElementById('mLeadName').value.trim();
            if (!name) return;
            const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
            leads[lang].push({
                id: 'l' + Date.now(),
                name,
                phone: document.getElementById('mLeadPhone').value.trim(),
                source: document.getElementById('mLeadSource').value.trim(),
                date: new Date().toLocaleDateString('uz-UZ')
            });
            setItem(STORAGE_KEYS.leads, leads);
            closeModal();
            renderLeads();
        };
    });
});

bootApp();
