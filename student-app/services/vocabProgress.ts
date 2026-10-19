import { getResolvedLessonContent, lessonLockState, VocabWord } from '@/data/lessonContent';

import { fetchMobileContent } from './contentApi';
import { getCategoryProgress, loadLessonProgress, ProgressCategory } from './lessonProgressStore';

const TOTAL_LESSONS = 72;

// O'quvchi hozirgacha ochib ulgurgan darslarning (1-darsdan joriy darsigacha)
// birlashtirilgan lug'ati — so'z o'yinlari (word-chain, word-search,
// mystery-word, memory-match, battle) shu so'zlardan foydalanadi, shunda
// o'quvchi darslarda o'rganayotgan so'zlarini o'yin orqali qayta-qayta
// takrorlaydi. Qulflanish mantig'i homework/roadmap/[courseId].tsx'dagi
// recomputeLessons bilan bir xil — u yerdagi haqiqiy manba, bu yerda alohida
// hisoblanadi, chunki o'yinlar courseId route parametrisiz ochiladi.
//
// MUHIM: barcha 72 slot bo'ylab to'liq aylanish shart — CRM'da qo'lda
// qulflangan darslar (lock.enabled) ketma-ket emas, har biri o'zining
// alohida shart (davomat/foiz)i bilan qulflanadi, shuning uchun oldingi
// dars qulflangan bo'lsa ham keyingisi qayta ochiq bo'lishi mumkin —
// birinchi qulflangan darsda to'xtab qolish (early-break) xato natija beradi.
export async function getAccumulatedVocabulary(): Promise<VocabWord[]> {
  await loadLessonProgress();
  const mc = await fetchMobileContent();
  const course = mc.courses[0];
  const adminLessons = course ? mc.lessons.filter((l) => l.courseId === course.id) : [];

  let prevPercent = 100;
  const seen = new Set<string>();
  const words: VocabWord[] = [];

  for (let i = 0; i < TOTAL_LESSONS; i++) {
    const l = adminLessons[i];
    const id = l?.id ?? String(i + 1);
    const isVideoDay = i % 2 === 0;

    // Yo'ldagi qulf bilan aynan bir xil qoida (lessonLockState).
    const locked = lessonLockState(i, l, prevPercent).locked;

    const content = await getResolvedLessonContent(id, i);
    if (!locked) {
      for (const w of content.vocabulary) {
        const key = w.english.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          words.push(w);
        }
      }
    }

    const videoCategory: ProgressCategory = isVideoDay ? 'video' : 'speaking';
    const percent = Math.round(
      (getCategoryProgress(id, videoCategory) +
        getCategoryProgress(id, 'vocabulary') +
        getCategoryProgress(id, 'homework', content.homeworkParts.length)) /
        3
    );
    prevPercent = percent;
  }

  return words;
}
