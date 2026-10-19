/** Grammatika mavzulari — CRM kutubxonasi (mc.library.grammar) + dars bog'lanishi. */
import { GRAMMAR_TOPICS, type GrammarTopic } from '@/data/grammarGuide';
import { fetchMobileContent, type MobileContent } from '@/services/contentApi';
import { getLessonProgress, loadLessonProgress } from '@/services/lessonProgressStore';

import { courseLessons, currentLesson, latestVideoLesson, titlesMatch, type LessonRef } from './shared';

/**
 * learned — mavzu o'tilgan barcha darslar videosi ko'rilgan; part — bir
 * qismi ko'rilgan (dizayndagi "Qisman oʻrganilgan" halqasi, 0..1).
 */
export type GrammarRow = { topic: GrammarTopic; code: string; lesson: LessonRef | null; lessons: LessonRef[]; learned: boolean; part: number; where: string };

export const topicCode = (i: number) => `G${String(i + 1).padStart(2, '0')}`;
// 72 dars ≈ 3 oy (haftasiga 3 dars × 2) → har oyga 24 dars.
export const lessonMonth = (n: number) => Math.min(3, Math.ceil(n / 24));

/** Mavzu nomiga mos keladigan barcha darslar (mavzuda darsga havola yo'q — nom bo'yicha). */
function lessonsForTitle(mc: MobileContent, title: string): LessonRef[] {
  return courseLessons(mc)
    .map((lesson, index) => ({ lesson, index, number: index + 1 }))
    .filter((r) => titlesMatch(title, r.lesson.name));
}

/**
 * O'ng tomondagi yorliq: 1–2 dars → "27, 29-dars"; ko'p dars bitta oyda →
 * "1-oy"; darsga bog'lanmagan mavzu → "umumiy".
 */
function whereLabel(ls: LessonRef[]) {
  if (!ls.length) return 'umumiy';
  const months = new Set(ls.map((l) => lessonMonth(l.number)));
  if (ls.length > 2 && months.size === 1) return `${[...months][0]}-oy`;
  return `${ls.map((l) => l.number).join(', ')}-dars`;
}

export async function loadGrammarRows() {
  const mc = await fetchMobileContent();
  await loadLessonProgress().catch(() => {});
  // Eski ekrandagi kabi: CRM ro'yxati bo'sh bo'lsa statik ro'yxat — lekin
  // u faqat ingliz tili uchun yozilgan, rus kursiga ko'rsatilmaydi.
  const topics = mc.library.grammar.length ? mc.library.grammar : mc.courseLang === 'russian' ? [] : GRAMMAR_TOPICS;
  const rows: GrammarRow[] = topics.map((topic, i) => {
    const lessons = lessonsForTitle(mc, topic.title);
    const watched = lessons.filter((l) => getLessonProgress(l.lesson.id).videoWatch).length;
    const learned = lessons.length > 0 && watched === lessons.length;
    return {
      topic,
      code: topicCode(i),
      lesson: lessons[0] ?? null,
      lessons,
      learned,
      part: !learned && watched > 0 ? watched / lessons.length : 0,
      where: whereLabel(lessons),
    };
  });
  const today = latestVideoLesson(mc, await currentLesson(mc));
  const related = today ? rows.find((r) => r.lessons.some((l) => l.lesson.id === today.lesson.id)) ?? null : null;
  return { rows, related, today };
}
