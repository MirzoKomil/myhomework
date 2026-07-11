export type ScheduleDayType = 'live' | 'video' | 'bonus';

export type ScheduleDay = {
  dayNumber: number;
  date: Date;
  type: ScheduleDayType;
  topic: string;
  isPast: boolean;
  isToday: boolean;
  missed: boolean;
};

export const SCHEDULE_TYPE_LABELS: Record<ScheduleDayType, string> = {
  live: 'Jonli dars',
  video: 'Videodars',
  bonus: 'Bonus dars',
};

export const SCHEDULE_TYPE_COLORS: Record<ScheduleDayType, string> = {
  live: '#4F8CFF',
  video: '#7B61FF',
  bonus: '#FBBF24',
};

export const SCHEDULE_MISSED_COLOR = '#F87171';

export const UZ_WEEKDAY_LABELS = ['Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha', 'Yak'];
export const UZ_WEEKDAY_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
export const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

const TOTAL_DAYS = 90;
const LIVE_TOPICS = [
  'Present Simple', 'Vocabulary: Family', 'Listening Practice', 'Speaking Club', 'Grammar Review',
  'Past Simple', 'Pronunciation Practice', 'Reading Comprehension', 'Vocabulary: Travel', 'Writing Skills',
];
const VIDEO_TOPICS = ['Video dars: Grammatika', 'Video dars: Suhbat', 'Video dars: Talaffuz', 'Video dars: Yozish'];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// Berilgan ISO sanadan boshlab, ko'rsatilgan hafta kunига (0=Yakshanba, 1=Dushanba, ...) to'g'ri keladigan birinchi sanani topadi.
export function firstWeekdayOnOrAfter(isoDate: string, targetDow: number): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  date.setDate(date.getDate() + ((targetDow - dow + 7) % 7));
  return date;
}

export function generateScheduleDays(referenceDate: Date = new Date()): ScheduleDay[] {
  const today = startOfDay(referenceDate);
  const courseStart = startOfDay(today);
  courseStart.setDate(courseStart.getDate() - 23);

  const days: ScheduleDay[] = [];
  let liveIdx = 0;
  let videoIdx = 0;

  for (let i = 0; i < TOTAL_DAYS; i++) {
    const date = new Date(courseStart);
    date.setDate(courseStart.getDate() + i);
    const dow = date.getDay();

    let type: ScheduleDayType;
    let topic: string;
    if (dow === 0) {
      type = 'bonus';
      topic = 'Bonus dars';
    } else if (dow === 6) {
      type = 'video';
      topic = VIDEO_TOPICS[videoIdx % VIDEO_TOPICS.length];
      videoIdx += 1;
    } else {
      type = 'live';
      topic = LIVE_TOPICS[liveIdx % LIVE_TOPICS.length];
      liveIdx += 1;
    }

    const dayNumber = i + 1;
    const isPast = date.getTime() < today.getTime();
    const isToday = date.getTime() === today.getTime();
    const missed = isPast && ((type === 'live' && dayNumber % 11 === 0) || (type === 'bonus' && dayNumber % 13 === 0));

    days.push({ dayNumber, date, type, topic, isPast, isToday, missed });
  }

  return days;
}

// O'quvchining asosiy ustozi haftaning qaysi 3 kunida dars o'tishini
// bildiradi (CRM'dagi SCHEDULE_PATTERNS bilan bir xil, ISO hafta kuni: 1=Du..7=Yak).
export const SCHEDULE_PATTERN_DAYS: Record<'mwf' | 'tts', number[]> = {
  mwf: [1, 3, 5],
  tts: [2, 4, 6],
};

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toIsoDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoWeekday(d: Date): number {
  const dow = d.getDay();
  return dow === 0 ? 7 : dow;
}

// 123-ish: o'quvchining HAQIQIY o'qish boshlagan kuni (courseStartDate) va
// asosiy ustozining haftalik dars kunlari patterniga (mwf/tts) qurilgan
// jadval — har hafta shu 3 kunda video/jonli darslar navbat bilan almashadi,
// yakshanbalar bonus dars kuni hisoblanadi. "Qoldirilgan" (missed) holati
// haqiqiy davomat ma'lumotlaridan (attendedDates — liveGrades'dagi sanalar)
// aniqlanadi — faqat "jonli dars" kunlari uchun, chunki faqat ular uchun
// ustoz tomonidan davomat tasdiqlanadi.
export function generateRealScheduleDays(
  courseStartDate: string,
  schedulePattern: 'mwf' | 'tts',
  attendedDates: Set<string>,
  attendedTopics: Map<string, string>,
  referenceDate: Date = new Date()
): ScheduleDay[] {
  const today = startOfDay(referenceDate);
  const start = startOfDay(parseIsoDate(courseStartDate));
  const end = new Date(today);
  end.setDate(end.getDate() + 60);

  const patternDays = SCHEDULE_PATTERN_DAYS[schedulePattern] || SCHEDULE_PATTERN_DAYS.mwf;

  const days: ScheduleDay[] = [];
  let lessonIdx = 0;
  let dayNumber = 0;
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    const date = new Date(cursor);
    const dow = isoWeekday(date);
    dayNumber += 1;

    let type: ScheduleDayType | null = null;
    let topic = '';
    if (dow === 7) {
      type = 'bonus';
      topic = 'Bonus dars';
    } else if (patternDays.includes(dow)) {
      type = lessonIdx % 2 === 0 ? 'video' : 'live';
      const isoKey = toIsoDateKey(date);
      topic =
        type === 'live'
          ? attendedTopics.get(isoKey) ?? LIVE_TOPICS[Math.floor(lessonIdx / 2) % LIVE_TOPICS.length]
          : VIDEO_TOPICS[Math.floor(lessonIdx / 2) % VIDEO_TOPICS.length];
      lessonIdx += 1;
    }

    if (type) {
      const isPast = date.getTime() < today.getTime();
      const isToday = date.getTime() === today.getTime();
      const missed = isPast && type === 'live' && !attendedDates.has(toIsoDateKey(date));
      days.push({ dayNumber, date, type, topic, isPast, isToday, missed });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export function getMonthMatrix(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
