import { getLessonContent, getLessonPossibleCoins } from '@/data/lessonContent';
import { courseEnrollment } from '@/data/mock';
import { firstWeekdayOnOrAfter, UZ_MONTHS } from '@/data/scheduleCalendar';

export type CertificateType = 'interval' | 'bonus' | 'course';

export type Certificate = {
  id: string;
  type: CertificateType;
  title: string;
  rangeLabel: string;
  requiredLessons: number;
  points: number;
  dateRangeLabel: string;
};

export const INTERVAL_SIZE = 12;
export const COURSE_TOTAL_LESSONS = 72;
export const BONUS_TOTAL_LESSONS = 18;

// Asosiy darslar Dushanbadan Shanbagacha (6 kun/hafta) o'tiladi, Yakshanba esa bonus darsga ajratilgan.
const FIRST_LESSON_DATE = firstWeekdayOnOrAfter(courseEnrollment.courseStartDate, 1);
const FIRST_BONUS_DATE = firstWeekdayOnOrAfter(courseEnrollment.courseStartDate, 0);

function mainLessonDate(index: number): Date {
  const week = Math.floor(index / 6);
  const dayInWeek = index % 6;
  const date = new Date(FIRST_LESSON_DATE);
  date.setDate(date.getDate() + week * 7 + dayInWeek);
  return date;
}

function bonusLessonDate(index: number): Date {
  const date = new Date(FIRST_BONUS_DATE);
  date.setDate(date.getDate() + index * 7);
  return date;
}

function formatShortDate(date: Date): string {
  return `${date.getDate()}-${UZ_MONTHS[date.getMonth()].toLowerCase()}`;
}

function formatDateRange(from: Date, to: Date): string {
  return `${formatShortDate(from)} – ${formatShortDate(to)}, ${to.getFullYear()}`;
}

function mainLessonPoints(index: number): number {
  return getLessonPossibleCoins(getLessonContent(String(index + 1), index));
}

function sumMainPoints(fromIndex: number, toIndex: number): number {
  let sum = 0;
  for (let i = fromIndex; i <= toIndex; i++) sum += mainLessonPoints(i);
  return sum;
}

function sumBonusPoints(): number {
  let sum = 0;
  for (let i = 0; i < BONUS_TOTAL_LESSONS; i++) {
    sum += getLessonPossibleCoins(getLessonContent(`bonus-${i + 1}`, 0));
  }
  return sum;
}

function buildCertificates(): Certificate[] {
  const list: Certificate[] = [];
  const intervalCount = COURSE_TOTAL_LESSONS / INTERVAL_SIZE;

  for (let i = 0; i < intervalCount; i++) {
    const fromIdx = i * INTERVAL_SIZE;
    const toIdx = fromIdx + INTERVAL_SIZE - 1;
    list.push({
      id: `interval-${i + 1}`,
      type: 'interval',
      title: `${fromIdx + 1}–${toIdx + 1}-darslar sertifikati`,
      rangeLabel: `${fromIdx + 1}–${toIdx + 1}-darslar`,
      requiredLessons: toIdx + 1,
      points: sumMainPoints(fromIdx, toIdx),
      dateRangeLabel: formatDateRange(mainLessonDate(fromIdx), mainLessonDate(toIdx)),
    });
  }

  list.push({
    id: 'bonus',
    type: 'bonus',
    title: 'Yakshanba darslari sertifikati',
    rangeLabel: `${BONUS_TOTAL_LESSONS} ta bonus dars`,
    requiredLessons: BONUS_TOTAL_LESSONS,
    points: sumBonusPoints(),
    dateRangeLabel: formatDateRange(bonusLessonDate(0), bonusLessonDate(BONUS_TOTAL_LESSONS - 1)),
  });

  list.push({
    id: 'course',
    type: 'course',
    title: "To'liq kurs sertifikati",
    rangeLabel: `${COURSE_TOTAL_LESSONS} ta dars`,
    requiredLessons: COURSE_TOTAL_LESSONS,
    points: sumMainPoints(0, COURSE_TOTAL_LESSONS - 1),
    dateRangeLabel: formatDateRange(mainLessonDate(0), mainLessonDate(COURSE_TOTAL_LESSONS - 1)),
  });

  return list;
}

export const CERTIFICATES: Certificate[] = buildCertificates();
