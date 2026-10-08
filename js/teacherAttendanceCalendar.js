(function (root, factory) {
    const calendar = factory();
    if (typeof module === 'object' && module.exports) module.exports = calendar;
    else root.teacherAttendanceCalendar = calendar;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    function weekdays(student, teacher, duty) {
        const day = Number(student?.lessonDayOfWeek);
        if (duty === 'main' && student?.lessonDayOfWeek != null && day >= 1 && day <= 7) {
            return [1, 3, 5].includes(day) ? [1, 3, 5] : [2, 4, 6].includes(day) ? [2, 4, 6] : [7];
        }
        return teacher?.schedulePattern === 'tts' ? [2, 4, 6] : [1, 3, 5];
    }
    function cells(month, scheduledWeekdays) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
        const [year, number] = month.split('-').map(Number);
        const start = new Date(`${month}-01T00:00:00Z`);
        const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
        const result = Array((start.getUTCDay() + 6) % 7).fill(null);
        for (let day = 1; day <= count; day++) {
            const date = `${month}-${String(day).padStart(2, '0')}`;
            result.push({ day, date, scheduled: scheduledWeekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay() || 7) });
        }
        return result;
    }
    function status(value) { return value === true || value === 1 ? 'present' : value === false || value === 0 ? 'absent' : 'empty'; }
    return { weekdays, cells, status };
}));
