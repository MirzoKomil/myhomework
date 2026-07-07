import { COURSE_TOTAL_LESSONS, INTERVAL_SIZE } from '@/data/certificates';
import { GRAMMAR_POOL, MC_POOL, pickWindow, SENTENCE_POOL, SPEAKING_POOL } from '@/data/lessonContent';

export type ExamQuestion =
  | { kind: 'multipleChoice'; id: string; question: string; options: string[]; correctIndex: number }
  | { kind: 'sentenceBuild'; id: string; translation: string; words: string[]; answer: string[] }
  | { kind: 'fillBlank'; id: string; sentence: string; answer: string; options: string[] }
  | { kind: 'speaking'; id: string; sentence: string; translation: string };

export type Exam = {
  id: string;
  title: string;
  rangeLabel: string;
  requiredLessons: number;
  questions: ExamQuestion[];
  durationSeconds: number;
  breakAfterIndex: number | null; // shu savoldan keyin tanaffus (0-based), null bo'lsa tanaffus yo'q
  breakSeconds: number;
};

const INTERVAL_COUNT = COURSE_TOTAL_LESSONS / INTERVAL_SIZE;
const BREAK_THRESHOLD = 10;
const BREAK_SECONDS = 90;

function buildQuestions(offset: number, mcCount: number, sentenceCount: number, blankCount: number, speakingCount: number): ExamQuestion[] {
  const mc: ExamQuestion[] = pickWindow(MC_POOL, offset, mcCount).map((q) => ({
    kind: 'multipleChoice',
    id: `${q.id}-${offset}`,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
  }));
  const sentence: ExamQuestion[] = pickWindow(SENTENCE_POOL, offset, sentenceCount).map((q) => ({
    kind: 'sentenceBuild',
    id: `${q.id}-${offset}`,
    translation: q.translation,
    words: q.words,
    answer: q.answer,
  }));
  const blank: ExamQuestion[] = pickWindow(GRAMMAR_POOL, offset, blankCount).map((q) => ({
    kind: 'fillBlank',
    id: `${q.id}-${offset}`,
    sentence: q.sentence,
    answer: q.answer,
    options: q.options,
  }));
  const speaking: ExamQuestion[] = pickWindow(SPEAKING_POOL, offset, speakingCount).map((q) => ({
    kind: 'speaking',
    id: `${q.id}-${offset}`,
    sentence: q.sentence,
    translation: q.translation,
  }));
  return [...mc, ...blank, ...sentence, ...speaking];
}

function buildExam(
  id: string,
  title: string,
  rangeLabel: string,
  requiredLessons: number,
  offset: number,
  counts: { mc: number; sentence: number; blank: number; speaking: number }
): Exam {
  const questions = buildQuestions(offset, counts.mc, counts.sentence, counts.blank, counts.speaking);
  const durationSeconds = questions.length * 45;
  const breakAfterIndex = questions.length > BREAK_THRESHOLD ? Math.ceil(questions.length / 2) - 1 : null;
  return { id, title, rangeLabel, requiredLessons, questions, durationSeconds, breakAfterIndex, breakSeconds: BREAK_SECONDS };
}

function buildExams(): Exam[] {
  const list: Exam[] = [];
  for (let i = 0; i < INTERVAL_COUNT; i++) {
    const fromLesson = i * INTERVAL_SIZE + 1;
    const toLesson = fromLesson + INTERVAL_SIZE - 1;
    list.push(
      buildExam(
        `interval-${i + 1}`,
        `${fromLesson}–${toLesson}-darslar imtihoni`,
        `${fromLesson}–${toLesson}-darslar`,
        toLesson,
        i * 7,
        { mc: 4, sentence: 3, blank: 3, speaking: 2 }
      )
    );
  }
  list.push(
    buildExam(
      'final',
      'Yakunlovchi kurs imtihoni',
      `1–${COURSE_TOTAL_LESSONS} ta dars`,
      COURSE_TOTAL_LESSONS,
      INTERVAL_COUNT * 7,
      { mc: 6, sentence: 5, blank: 5, speaking: 4 }
    )
  );
  return list;
}

export const EXAMS: Exam[] = buildExams();
export const EXAM_PASS_PERCENT = 60;

export function getExam(examId: string): Exam | undefined {
  return EXAMS.find((e) => e.id === examId);
}
