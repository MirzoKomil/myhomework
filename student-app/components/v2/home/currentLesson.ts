/**
 * Joriy dars (bosh sahifa "Bugungi dars" kartasi va LiveNow oynasi uchun):
 * oxirgi ochilgan dars, bo'lmasa CRM'dagi faol dars, bo'lmasa 1-dars.
 */
import { getAudioTracks } from '@/components/v2/lessons/data';
import { getResolvedLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import { loadLessonProgress } from '@/services/lessonProgressStore';
import { getLastPosition } from '@/services/progressStore';

export type CurrentLesson = {
  id: string;
  name: string;
  number: number;
  isVideoDay: boolean;
  phrase: string;
  meta: string;
  /** lessonSteps uchun dars mazmuni (Lesson ekrani bilan bir xil 5 qadam). */
  content: LessonContent;
  /** Shu darsning audio dialoglari (getAudioTracks) — id'lari. */
  trackIds: string[];
  slidesCount: number;
};

export async function resolveCurrentLesson(): Promise<CurrentLesson | null> {
  const mc = await fetchMobileContent();
  const course = mc.courses[0];
  if (!course) return null;
  const lessons = mc.lessons.filter((l) => l.courseId === course.id);
  if (!lessons.length) return null;
  const last = await getLastPosition();
  let idx = last ? lessons.findIndex((l) => l.id === last.lessonId) : -1;
  if (idx < 0) idx = lessons.findIndex((l) => l.isActive);
  if (idx < 0) idx = 0;
  const lesson = lessons[idx];

  await loadLessonProgress();
  const content = await getResolvedLessonContent(lesson.id, idx);
  const isVideoDay = idx % 2 === 0;
  const tracks = getAudioTracks(mc, lesson.id);
  // Dizayndagi "8 soʻz · 3 audio · vazifa" qatori — darsdagi haqiqiy sonlar.
  const meta: string[] = [];
  if (content.vocabulary.length) meta.push(`${content.vocabulary.length} soʻz`);
  if (tracks.length) meta.push(`${tracks.length} audio`);
  if (content.homeworkParts.length) meta.push('vazifa');
  const first = content.vocabulary[0]?.english?.trim();
  return {
    id: lesson.id,
    name: lesson.name,
    number: idx + 1,
    isVideoDay,
    phrase: first ? `«${first}»` : '',
    meta: meta.join(' · '),
    content,
    trackIds: tracks.map((t) => t.id),
    slidesCount: content.slides.length,
  };
}
