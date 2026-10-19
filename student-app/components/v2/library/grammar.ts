/** Grammatika mavzulari — CRM kutubxonasi (mc.library.grammar) + dars bog'lanishi. */
import { GRAMMAR_TOPICS, type GrammarTopic } from '@/data/grammarGuide';
import { fetchMobileContent } from '@/services/contentApi';
import { getLessonProgress, loadLessonProgress } from '@/services/lessonProgressStore';

import { currentLesson, findLessonForTitle, latestVideoLesson, type LessonRef } from './shared';

export type GrammarRow = { topic: GrammarTopic; code: string; lesson: LessonRef | null; learned: boolean };

export const topicCode = (i: number) => `G${String(i + 1).padStart(2, '0')}`;
// 72 dars ≈ 3 oy (haftasiga 3 dars × 2) → har oyga 24 dars.
export const lessonMonth = (n: number) => Math.min(3, Math.ceil(n / 24));

export async function loadGrammarRows() {
  const mc = await fetchMobileContent();
  await loadLessonProgress().catch(() => {});
  // Eski ekrandagi kabi: CRM ro'yxati bo'sh bo'lsa statik ro'yxat — lekin
  // u faqat ingliz tili uchun yozilgan, rus kursiga ko'rsatilmaydi.
  const topics = mc.library.grammar.length ? mc.library.grammar : mc.courseLang === 'russian' ? [] : GRAMMAR_TOPICS;
  const rows: GrammarRow[] = topics.map((topic, i) => {
    const lesson = findLessonForTitle(mc, topic.title);
    return { topic, code: topicCode(i), lesson, learned: !!lesson && getLessonProgress(lesson.lesson.id).videoWatch };
  });
  const today = latestVideoLesson(mc, await currentLesson(mc));
  const related = today ? rows.find((r) => r.lesson?.lesson.id === today.lesson.id) ?? null : null;
  return { rows, related };
}

