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
    const missed = type === 'live' && isPast && dayNumber % 11 === 0;

    days.push({ dayNumber, date, type, topic, isPast, isToday, missed });
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
