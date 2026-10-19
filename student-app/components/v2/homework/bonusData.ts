/**
 * Bonus darslar ro'yxati (Bonus va BonusPlayer ekranlari uchun umumiy).
 * Qoidalar eski homework/bonus.tsx bilan bir xil: 18 ta bonus, turi
 * BONUS_CATEGORIES'dan, sanasi — kurs boshlanganidan keyingi har yakshanba,
 * ochilganlar soni UNLOCKED_COUNT.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { BONUS_CATEGORIES } from '@/data/lessonContent';
import { courseEnrollment } from '@/data/mock';
import { firstWeekdayOnOrAfter } from '@/data/scheduleCalendar';

export const TOTAL = 18;
export const UNLOCKED_COUNT = 1;
const FIRST_BONUS_DATE = firstWeekdayOnOrAfter(courseEnrollment.courseStartDate, 0);
const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const pad = (n: number) => String(n).padStart(2, '0');

export const BONUS_LESSONS = Array.from({ length: TOTAL }, (_, i) => {
  const date = new Date(FIRST_BONUS_DATE);
  date.setDate(date.getDate() + i * 7);
  return { id: `bonus-${i + 1}`, index: i, number: i + 1, category: BONUS_CATEGORIES[i % BONUS_CATEGORIES.length], date };
});

export const short = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;

const dayDiff = (d: Date) => {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((day(d) - day(new Date())) / 86400000);
};

export function whenLabel(d: Date) {
  const diff = dayDiff(d);
  const rel = diff === 0 ? 'Bugun, ' : diff === 1 ? 'Ertaga, ' : '';
  const wd = WEEKDAYS[d.getDay()];
  return `${rel}${rel ? wd : wd[0].toUpperCase() + wd.slice(1)} ${short(d)}`;
}

/** "Yakshanba, 11.10" — BonusPlayer sarlavhasi uchun. */
export function weekdayDate(d: Date) {
  const wd = WEEKDAYS[d.getDay()];
  return `${wd[0].toUpperCase() + wd.slice(1)}, ${short(d)}`;
}

export const isPast = (d: Date) => dayDiff(d) < 0;

// Bonus eslatmasi — faqat shu qurilmadagi tanlov (serverda bunday sozlama yo'q).
const REMINDER_KEY = 'mh_v2_bonus_reminder';

export function useBonusReminder(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(REMINDER_KEY)
      .then((v) => v !== null && setOn(v === '1'))
      .catch(() => {});
  }, []);
  const set = (v: boolean) => {
    setOn(v);
    AsyncStorage.setItem(REMINDER_KEY, v ? '1' : '0').catch(() => {});
  };
  return [on, set];
}
