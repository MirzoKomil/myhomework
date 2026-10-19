/**
 * Natijalar ekranidagi "Imtihonga tayyorgarlik" kartasi uchun hisob.
 * Keyingi topshirilmagan oraliq imtihon (examStore), uning darslar
 * oralig'idagi o'tilgan darslar so'zlari soni va tayyorlik foizi —
 * getSkillsProgress bilan bir xil qoida: so'z mashqi (vocabPractice)
 * bajarilgan darsda VOCAB_PRACTICE_SIZE tagacha so'z "o'rganilgan".
 */
import { CERTIFICATES, COURSE_TOTAL_LESSONS, INTERVAL_SIZE } from '@/data/certificates';
import { getLessonContent, mergeLessonContent, VOCAB_PRACTICE_SIZE } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import type { ExamResult } from '@/services/examStore';
import { getLessonProgress, loadLessonProgress } from '@/services/lessonProgressStore';

export type ExamPrep = { index: number; from: number; to: number; words: number; percent: number };

export async function getExamPrep(examResults: Record<string, ExamResult>, lessonsDone: number): Promise<ExamPrep | null> {
  const intervals = CERTIFICATES.filter((c) => c.type === 'interval');
  const idx = intervals.findIndex((c) => !examResults[c.id]?.passed);
  if (idx < 0) return null;
  const from = idx * INTERVAL_SIZE + 1;
  const to = Math.min(COURSE_TOTAL_LESSONS, from + INTERVAL_SIZE - 1);

  const mc = await fetchMobileContent();
  const course = mc.courses[0];
  if (!course) return { index: idx, from, to, words: 0, percent: 0 };
  await loadLessonProgress();
  const lessons = mc.lessons.filter((l) => l.courseId === course.id);
  const lang: 'english' | 'russian' = course.lang === 'russian' ? 'russian' : 'english';

  let total = 0;
  let reached = 0;
  let learned = 0;
  for (let i = from - 1; i < to; i++) {
    const id = lessons[i]?.id ?? String(i + 1);
    const n = mergeLessonContent(getLessonContent(id, i, lang), mc.lessonContents[id]).vocabulary.length;
    total += n;
    if (i < lessonsDone) reached += n;
    if (n > 0 && getLessonProgress(id).vocabPractice) learned += Math.min(VOCAB_PRACTICE_SIZE, n);
  }
  return { index: idx, from, to, words: reached, percent: total > 0 ? Math.round((learned / total) * 100) : 0 };
}
