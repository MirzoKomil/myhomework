/**
 * Imtihon v2 — 5 bo'limli, savollar banki (har slotga 3 parallel variant),
 * umumiy taymer, belgilash, ilovadan chiqishni hisoblash, davom ettirish.
 *
 * Kontent: CRM `examContents[<id>].bankV2` (content/ru/exams-v2/*.json).
 * bankV2 bo'lmasa — eski `questions` bitta variantli bankka aylantiriladi,
 * shunday qilib imtihon har doim ochiladi.
 *
 * Qoidalar (dizayn: «Qoidalar va spetsifikatsiya» kartasi):
 *  - o'tish: to'g'ri javoblar ≥ ⌈passPercent·N/100⌉ VA har bo'limda ≥ sectionMinPercent;
 *  - javobsiz = xato; foiz 0,5 dan yuqoriga yaxlitlanadi;
 *  - taymer faqat bo'limlar orasidagi tanaffusda to'xtaydi, ilova yopiq bo'lsa ham yuradi;
 *  - qo'ng'iroq / 10 soniyadan qisqa chiqish hisoblanmaydi, 3-hisoblangan chiqishda topshiriladi;
 *  - qayta urinish — cooldownHours dan keyin.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchMobileContent, resolveMediaUrl } from '@/services/contentApi';

export type SectionKey = 'vocab' | 'grammar' | 'reading' | 'build' | 'listen';

export const SECTION_LABEL: Record<SectionKey, string> = {
  vocab: "Lug'at",
  grammar: 'Grammatika',
  reading: "O'qish",
  build: 'Gap tuzish',
  listen: 'Tinglash',
};

type Base = { id: string; section: SectionKey; slot: number; variant: number; lessonRef?: number };
export type BankQuestion = Base &
  (
    | { kind: 'multipleChoice'; question: string; options: string[]; correctIndex: number }
    | { kind: 'vocabImage'; question: string; image: string; imageAlt?: string; options: string[]; correctIndex: number }
    | { kind: 'reading'; passageId: string; passage: string; question: string; options: string[]; correctIndex: number }
    | { kind: 'fillBlank'; sentence: string; options: string[]; answer: string }
    | { kind: 'sentenceBuild'; words: string[]; answer: string[]; accepted?: string[][]; translation?: string; punct?: string }
    | {
        kind: 'listening';
        dialogId: string;
        audioUrl: string;
        playUntil?: number;
        durationSec?: number;
        maxPlays?: number;
        question: string;
        options: string[];
        correctIndex: number;
      }
  );

export type ExamBank = {
  id: string;
  lessons: [number, number];
  sections: { key: SectionKey; count: number }[];
  totalQuestions: number;
  durationSec: number;
  passPercent: number;
  sectionMinPercent: number;
  cooldownHours: number;
  bank: BankQuestion[];
};

/** Bitta urinishdagi savol: variant tanlangan, variantlar aralashtirilgan. */
export type AttemptQuestion = BankQuestion & { no: number; options?: string[]; shuffledWords?: string[] };

export type Answer = number | string[] | undefined; // variant indeksi | gap tuzish so'zlari

export type Session = {
  examId: string;
  startedAt: number;
  deadline: number; // ms — umumiy taymer tugaydigan vaqt
  pausedMs: number;
  questions: AttemptQuestion[];
  answers: Record<string, Answer>;
  flags: string[];
  index: number;
  leaves: number;
  plays: Record<string, number>; // dialogId → necha marta eshitildi
  breaksTaken: SectionKey[];
};

export type SectionScore = { key: SectionKey; correct: number; total: number; percent: number };
export type Mistake = { id: string; no: number; section: SectionKey; lessonRef?: number; question: string; yourAnswer: string; correctAnswer: string };
export type ExamOutcome = {
  examId: string;
  correct: number;
  total: number;
  percent: number;
  needed: number;
  passed: boolean;
  sections: SectionScore[];
  mistakes: Mistake[];
  answered: number;
  spentSec: number;
  finishedAt: number;
  reason: 'submit' | 'timeout' | 'left' | 'exit';
};

export const LEAVE_LIMIT = 3;
export const LEAVE_GRACE_MS = 10_000;
export const BREAK_SEC = 90;

const strip = (s: string) => s.replace(/́/g, '').toLowerCase().trim();
export const roundHalfUp = (x: number) => Math.floor(x + 0.5);

function rand(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Eski 40 savollik ro'yxatni bitta variantli bankka aylantirish (bankV2 hali yuklanmagan bo'lsa). */
function legacyBank(examId: string, raw: any): ExamBank | undefined {
  const qs: any[] = Array.isArray(raw?.questions) ? raw.questions : [];
  if (!qs.length) return undefined;
  const slots: Record<string, number> = {};
  const bank: BankQuestion[] = qs
    .filter((q) => ['multipleChoice', 'fillBlank', 'sentenceBuild'].includes(q.kind))
    .map((q) => {
      const section: SectionKey = q.kind === 'sentenceBuild' ? 'build' : 'grammar';
      const slot = (slots[section] = (slots[section] ?? -1) + 1);
      return { ...q, id: `${examId}-${section}-${slot}-v0`, section, slot, variant: 0 } as BankQuestion;
    });
  const count = (k: SectionKey) => bank.filter((q) => q.section === k).length;
  return {
    id: examId,
    lessons: [0, 0],
    sections: (['grammar', 'build'] as SectionKey[]).filter((k) => count(k)).map((k) => ({ key: k, count: count(k) })),
    totalQuestions: bank.length,
    durationSec: Math.max(20, bank.length) * 45,
    passPercent: 65,
    sectionMinPercent: 50,
    cooldownHours: 24,
    bank,
  };
}

export async function loadExamBank(examId: string): Promise<ExamBank | undefined> {
  const mc = await fetchMobileContent();
  const raw: any = mc.examContents?.[examId];
  const v2 = raw?.bankV2 as ExamBank | undefined;
  if (v2?.bank?.length) return v2;
  return legacyBank(examId, raw);
}

/** Har slot uchun tasodifiy variant; o'qish/tinglashda bitta matn/dialogning savollari birga qoladi. */
export function buildAttempt(exam: ExamBank, seed = Date.now()): AttemptQuestion[] {
  const rnd = rand(seed);
  const out: AttemptQuestion[] = [];
  for (const { key, count } of exam.sections) {
    const qs = exam.bank.filter((q) => q.section === key);
    // O'qish va tinglashda bitta urinish uchun bitta variant (matn/dialog guruhi butunligicha);
    // faqat barcha slotlari to'liq variantlar tanlanadi.
    const all = [...new Set(qs.map((q) => q.variant))];
    const full = all.filter((v) => new Set(qs.filter((q) => q.variant === v).map((q) => q.slot)).size >= count);
    const variants = full.length ? full : all;
    const groupVariant = variants[Math.floor(rnd() * variants.length)] ?? 0;
    const picked: BankQuestion[] = [];
    for (let slot = 0; slot < count; slot++) {
      const cand = qs.filter((q) => q.slot === slot);
      if (!cand.length) continue;
      // Lug'atda yarmi rasmli (juft slotlar), yarmi tarjima savoli bo'lsin.
      const wantImg = key === 'vocab' ? slot % 2 === 0 : undefined;
      const pref = wantImg === undefined ? cand : cand.filter((c) => (c.kind === 'vocabImage') === wantImg);
      const from = pref.length ? pref : cand;
      const q = key === 'reading' || key === 'listen' ? cand.find((c) => c.variant === groupVariant) ?? cand[0] : from[Math.floor(rnd() * from.length)];
      picked.push(q);
    }
    const ordered = key === 'reading' || key === 'listen' ? picked : shuffle(picked, rnd);
    for (const q of ordered) {
      const a: AttemptQuestion = { ...q, no: out.length + 1 };
      if ('options' in q && q.kind !== 'fillBlank') {
        const order = shuffle(q.options.map((_, i) => i), rnd);
        a.options = order.map((i) => q.options[i]);
        (a as any).correctIndex = order.indexOf((q as any).correctIndex);
      } else if (q.kind === 'fillBlank') {
        a.options = shuffle(q.options, rnd);
      } else if (q.kind === 'sentenceBuild') {
        a.shuffledWords = shuffle(q.words, rnd);
      }
      out.push(a);
    }
  }
  return out;
}

export function isAnswered(a: Answer) {
  return a !== undefined && (!Array.isArray(a) || a.length > 0);
}

export function correctText(q: AttemptQuestion): string {
  if (q.kind === 'fillBlank') return q.answer;
  if (q.kind === 'sentenceBuild') return q.answer.join(' ') + (q.punct ?? '');
  return (q.options ?? [])[(q as any).correctIndex] ?? '';
}

export function answerText(q: AttemptQuestion, a: Answer): string {
  if (!isAnswered(a)) return '';
  if (Array.isArray(a)) return a.join(' ');
  return (q.options ?? [])[a as number] ?? '';
}

export function isCorrect(q: AttemptQuestion, a: Answer): boolean {
  if (!isAnswered(a)) return false;
  if (q.kind === 'sentenceBuild') {
    const got = (a as string[]).map(strip).join(' ');
    const ok = [q.answer, ...(q.accepted ?? [])].map((x) => x.map(strip).join(' '));
    return ok.includes(got);
  }
  if (q.kind === 'fillBlank') return strip((q.options ?? [])[a as number] ?? '') === strip(q.answer);
  return a === (q as any).correctIndex;
}

export function questionText(q: AttemptQuestion): string {
  if (q.kind === 'fillBlank') return q.sentence;
  if (q.kind === 'sentenceBuild') return q.translation ?? '';
  return (q as any).question ?? '';
}

export function grade(exam: ExamBank, s: Session, reason: ExamOutcome['reason']): ExamOutcome {
  const total = s.questions.length;
  let correct = 0;
  const per: Record<string, SectionScore> = {};
  const mistakes: Mistake[] = [];
  for (const q of s.questions) {
    const a = s.answers[q.id];
    const ok = isCorrect(q, a);
    const sec = (per[q.section] ??= { key: q.section, correct: 0, total: 0, percent: 0 });
    sec.total++;
    if (ok) {
      correct++;
      sec.correct++;
    } else {
      mistakes.push({
        id: q.id,
        no: q.no,
        section: q.section,
        lessonRef: q.lessonRef,
        question: questionText(q),
        yourAnswer: answerText(q, a),
        correctAnswer: correctText(q),
      });
    }
  }
  const sections = exam.sections
    .map((x) => per[x.key])
    .filter(Boolean)
    .map((x) => ({ ...x, percent: x.total ? roundHalfUp((x.correct * 100) / x.total) : 0 }));
  const needed = Math.ceil((exam.passPercent * total) / 100 - 1e-9);
  const passed = correct >= needed && sections.every((x) => x.percent >= exam.sectionMinPercent);
  const now = Date.now();
  return {
    examId: exam.id,
    correct,
    total,
    percent: total ? roundHalfUp((correct * 100) / total) : 0,
    needed,
    passed,
    sections,
    mistakes,
    answered: s.questions.filter((q) => isAnswered(s.answers[q.id])).length,
    spentSec: Math.round((Math.min(now, s.deadline) - s.startedAt - s.pausedMs) / 1000),
    finishedAt: now,
    reason,
  };
}

// ── Saqlash: tugallanmagan urinish, oxirgi natija, kutish vaqti ──────────────
const SKEY = (id: string) => `mh_exam_v2_session_${id}`;
const RKEY = (id: string) => `mh_exam_v2_last_${id}`;

export async function saveSession(s: Session) {
  try {
    await AsyncStorage.setItem(SKEY(s.examId), JSON.stringify(s));
  } catch {}
}
export async function loadSession(examId: string): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(SKEY(examId));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export async function clearSession(examId: string) {
  try {
    await AsyncStorage.removeItem(SKEY(examId));
  } catch {}
}
export async function saveOutcome(o: ExamOutcome) {
  try {
    await AsyncStorage.setItem(RKEY(o.examId), JSON.stringify(o));
  } catch {}
}
export async function loadOutcome(examId: string): Promise<ExamOutcome | null> {
  try {
    const raw = await AsyncStorage.getItem(RKEY(examId));
    return raw ? (JSON.parse(raw) as ExamOutcome) : null;
  } catch {
    return null;
  }
}
/** Qayta urinishgacha qolgan ms (0 — ochiq). O'tgan imtihon qayta topshirilmaydi. */
export function cooldownLeft(exam: ExamBank, last: ExamOutcome | null, now = Date.now()) {
  if (!last || last.passed) return 0;
  return Math.max(0, last.finishedAt + exam.cooldownHours * 3600_000 - now);
}

export function mediaUrl(u?: string) {
  return resolveMediaUrl(u) ?? u;
}

/** Dars raqami → lessonId (o'quvchi kursidagi tartib bo'yicha). */
export async function lessonIdsByNo(): Promise<string[]> {
  try {
    const mc = await fetchMobileContent();
    return (mc.lessons ?? []).map((l: { id: string }) => l.id);
  } catch {
    return [];
  }
}
