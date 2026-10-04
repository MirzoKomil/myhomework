(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.teacherRoles = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const MAIN = new Set(['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi', 'asosiy']);
    const isMain = employee => MAIN.has(employee?.role);
    const language = employee => employee?.role === 'rus-oqituvchi' ? 'russian'
        : employee?.role === 'ingliz-oqituvchi' ? 'english'
        : employee?.lang === 'russian' || employee?.subject === 'russian' ? 'russian' : 'english';
    const eligible = (employee, type, subject) => employee?.status !== 'inactive'
        && language(employee) === subject && (type === 'asosiy' ? isMain(employee)
            : employee?.role === 'yordamchi' || (isMain(employee) && employee.dualRole === true));
    function pool(employees, teachers, type, subject) {
        return employees.filter(e => eligible(e, type, subject)).map(e => ({
            ...(teachers.find(t => t.id === e.id) || {}), id: e.id, name: e.name,
            type, subject, phone: e.phone || '', login: e.login || '',
            dualRole: isMain(e) && e.dualRole === true, _fromHr: true
        }));
    }
    function conflict(teacherId, assistantTeacherId) {
        return !!teacherId && !!assistantTeacherId && String(teacherId) === String(assistantTeacherId);
    }
    return { isMain, language, eligible, pool, conflict };
}));
