/**
 * Uyga vazifa ekranlari uchun umumiy yordamchilar: qism harfi (A/B/C/D),
 * turiga qarab rang va qisqa nom, savollar soni, dars raqami.
 */
import { getLessonContent, mergeLessonContent, type HomeworkPart, type LessonContent } from '@/data/lessonContent';
import { fetchMobileContent, type AdminLesson } from '@/services/contentApi';

export const PASS_THRESHOLD = 0.65;

/** Ustoz tekshiradigan qismlar — "Avtomatik tekshiriladi" hisobiga kirmaydi. */
export const isTeacherGraded = (p: HomeworkPart) => p.kind === 'creative' || p.kind === 'reading';

/**
 * Dizayndagi harflar: A · Moslash, B · Bo'sh joy, C · Test, D · Gap tuzish —
 * eski [part].tsx'dagi "PART A/B/C/D" bo'linishi bilan bir xil (speaking
 * kunlari: A — ovozli javob, B — suhbat, C — talaffuz). "O'qish" va ijodiy
 * vazifa dizaynda harfsiz.
 */
const KIND_LETTER: Partial<Record<HomeworkPart['kind'], string>> = {
  matching: 'A',
  fillBlank: 'B',
  multipleChoice: 'C',
  sentenceBuild: 'D',
  record: 'A',
  roleplay: 'B',
  pronunciation: 'C',
};

// Harflar (A/B/C/D) endi ko'rsatilmaydi — qismlar o'z nomi va ikonkasi bilan
// chiqadi (Abdulloh: "PART A, B…" professional ko'rinmaydi). Jadval qoldirildi,
// kerak bo'lsa qaytarish oson.
void KIND_LETTER;
export const partLetter = (_p: HomeworkPart): string | undefined => undefined;

/** "B · Bo'sh joyni to'ldiring" yoki harfsiz bo'lsa faqat nom. */
export const partLabel = (p: HomeworkPart, short = false): string => {
  const l = partLetter(p);
  const name = short ? KIND_SHORT[p.kind] : p.title;
  return l ? `${l} · ${name}` : name;
};

export function partQuestionCount(part: HomeworkPart): number {
  switch (part.kind) {
    case 'matching':
      return part.pairs.length;
    case 'fillBlank':
      return part.blanks.length;
    case 'multipleChoice':
      return part.questions.length;
    case 'sentenceBuild':
      return part.items.length;
    case 'record':
    case 'pronunciation':
      return part.prompts.length;
    case 'roleplay':
      return part.scenario.lines.length;
    case 'reading':
      return 1 + part.sentences.length;
    case 'creative':
      return 1;
  }
}

/** Kartadagi ikkinchi qator ("10 savol · grammatika") uchun tur tavsifi. */
export const KIND_SUB: Record<HomeworkPart['kind'], string> = {
  fillBlank: 'grammatika',
  multipleChoice: 'toʻgʻri javobni tanlang',
  matching: 'juftlarini toping',
  sentenceBuild: 'gap tuzing',
  reading: 'oʻqing va tarjima qiling',
  record: 'ovozli javob',
  roleplay: 'suhbat',
  pronunciation: 'talaffuz',
  creative: 'ustoz tekshiradi',
};

/** Takrorlash tugmalaridagi qisqa nom ("A · Moslash"). */
export const KIND_SHORT: Record<HomeworkPart['kind'], string> = {
  fillBlank: 'Boʻsh joy',
  multipleChoice: 'Test',
  matching: 'Moslash',
  sentenceBuild: 'Gap tuzish',
  reading: 'Oʻqish',
  record: 'Ovozli javob',
  roleplay: 'Suhbat',
  pronunciation: 'Talaffuz',
  creative: 'Ijodiy vazifa',
};

/** Harf plitkasining ranglari (dizayn: B — ko'k, C — binafsha). */
export const KIND_TILE: Record<HomeworkPart['kind'], { bg: string; fg: string; bar: string }> = {
  fillBlank: { bg: '#E8EEFF', fg: '#1E3FD1', bar: '#2F5BFF' },
  multipleChoice: { bg: '#F0EBFF', fg: '#5A2FD6', bar: '#7C4DFF' },
  matching: { bg: '#E3F7EE', fg: '#075E3A', bar: '#087A4A' },
  sentenceBuild: { bg: '#E8EEFF', fg: '#1E3FD1', bar: '#2F5BFF' },
  reading: { bg: '#FFF4D1', fg: '#7A5300', bar: '#F5B70A' },
  record: { bg: '#FFF1E6', fg: '#9A3D00', bar: '#FF7A1A' },
  roleplay: { bg: '#FFF1E6', fg: '#9A3D00', bar: '#FF7A1A' },
  pronunciation: { bg: '#FFF1E6', fg: '#9A3D00', bar: '#FF7A1A' },
  creative: { bg: '#FFF4D1', fg: '#7A5300', bar: '#F5B70A' },
};

export type LessonInfo = {
  lesson: AdminLesson | undefined;
  number: number;
  name: string;
  content: LessonContent;
  prev: { id: string; number: number; content: LessonContent } | null;
};

/** Dars nomi "32-dars" ko'rinishida bo'lsa, sarlavhada takrorlanmasin. */
export function lessonLabel(number: number, name: string): string {
  return !name || name.trim() === `${number}-dars` ? `${number}-dars` : `${number}-dars · ${name}`;
}

/** Eski homework/index.tsx bilan bir xil: kontent fetchMobileContent'dan olinadi. */
export async function loadLessonInfo(lessonId: string): Promise<LessonInfo> {
  const mc = await fetchMobileContent();
  const lesson = mc.lessons.find((l) => l.id === lessonId);
  const courseLessons = lesson ? mc.lessons.filter((l) => l.courseId === lesson.courseId) : [];
  const idx = Math.max(0, courseLessons.findIndex((l) => l.id === lessonId));
  const course = lesson ? mc.courses.find((c) => c.id === lesson.courseId) : undefined;
  const lang: 'english' | 'russian' = (course?.lang || mc.courseLang) === 'russian' ? 'russian' : 'english';
  const build = (id: string, i: number) => mergeLessonContent(getLessonContent(id, i, lang), mc.lessonContents[id]);
  const prevLesson = idx > 0 ? courseLessons[idx - 1] : undefined;
  return {
    lesson,
    number: idx + 1,
    name: lesson?.name ?? '',
    content: build(lessonId, idx),
    prev: prevLesson ? { id: prevLesson.id, number: idx, content: build(prevLesson.id, idx - 1) } : null,
  };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
