/**
 * Savol-javobli qismlar (bo'sh joy, test, moslash, gap tuzish) uchun umumiy
 * oqim — eski homework/[part].tsx mantig'i: har to'g'ri javob +1 coin +1
 * chaqmoq, oxirida kamida 65% bo'lsa markHomeworkPartDone + reportActivity,
 * aks holda qayta urinish. Qo'shimcha: natija scoreStore'ga yoziladi
 * (dizayndagi "4 / 10", "+18 coin" uchun) va chala qism davom ettiriladi.
 * Qism avval topshirilgan bo'lsa — "takrorlash rejimi": coin qo'shilmaydi.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { playSfx } from '@/services/sfx';
import { resetPraiseRun, speak } from '@/services/voicePraise';

import { R } from '@/constants/v2/routes';
import type { HomeworkPart } from '@/data/lessonContent';
import { reportActivity } from '@/services/activitySync';
import { addCoins } from '@/services/coinsStore';
import { getLessonProgress, loadLessonProgress, markHomeworkPartDone } from '@/services/lessonProgressStore';
import { addLightning } from '@/services/lightningStore';

import { isTeacherGraded, PASS_THRESHOLD } from './lib';
import { getLessonScores, getPartScore, loadScores, savePartScore, type PartScore } from './scoreStore';

export type PartRun = {
  ready: boolean;
  index: number;
  correct: number;
  replay: boolean;
  /** Takrorlash rejimida ko'rsatiladigan avvalgi coin / jami. */
  replayCoins: number;
  tooLow: number | null;
  /** Shu urinishdagi har savol natijasi (davom ettirilganda saqlangandan tiklanadi). */
  results: boolean[];
  answer: (isCorrect: boolean, mistake?: string, countAsAnswered?: boolean, pick?: string) => void;
  next: () => void;
  retry: () => void;
  /** Moslashtirishda aniqlik boshqacha hisoblanadi — to'g'ridan-to'g'ri yakunlash. */
  finish: (finalCorrect: number) => Promise<void>;
};

const ACTIVITY_LABEL: Partial<Record<HomeworkPart['kind'], string>> = {
  matching: 'Moslashtirish',
  fillBlank: "Bo'sh joy to'ldirish",
  multipleChoice: 'Testlar',
  sentenceBuild: 'Gap tuzish',
};

export function usePartRun(lessonId: string, part: HomeworkPart, total: number, allParts: HomeworkPart[]): PartRun {
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [replay, setReplay] = useState(false);
  const [replayCoins, setReplayCoins] = useState(0);
  const [tooLow, setTooLow] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const score = useRef<PartScore>({ answered: 0, correct: 0, total, coins: 0, mistakes: [], finished: false });

  useEffect(() => {
    resetPraiseRun();
    let cancelled = false;
    Promise.all([loadScores(), loadLessonProgress()]).then(() => {
      if (cancelled) return;
      const done = !!getLessonProgress(lessonId).homeworkParts[part.id];
      const saved = getPartScore(lessonId, part.id);
      if (done) {
        setReplay(true);
        setReplayCoins(saved?.coins ?? 0);
      } else if (saved && !saved.finished && saved.answered < total) {
        // Chala qolgan qism — to'xtagan joydan davom etamiz.
        score.current = { ...saved, total };
        setIndex(saved.answered);
        setCorrect(saved.correct);
        setResults((saved.results ?? []).slice(0, saved.answered));
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [lessonId, part.id, total]);

  const answer = (isCorrect: boolean, mistake?: string, countAsAnswered = true, pick?: string) => {
    if (countAsAnswered) setResults((r) => [...r, isCorrect]);
    if (replay) {
      if (isCorrect) setCorrect((c) => c + 1);
      return;
    }
    const sc = score.current;
    const at = sc.answered;
    const withAt = <T,>(arr: T[] | undefined, v: T, fill: T) => {
      const a = [...(arr ?? [])];
      while (a.length < at) a.push(fill);
      a[at] = v;
      return a;
    };
    score.current = {
      ...sc,
      answered: sc.answered + (countAsAnswered ? 1 : 0),
      correct: sc.correct + (isCorrect ? 1 : 0),
      coins: sc.coins + (isCorrect ? 1 : 0),
      mistakes: !isCorrect && mistake ? [...sc.mistakes, mistake] : sc.mistakes,
      ...(countAsAnswered ? { results: withAt(sc.results, isCorrect, true), picks: withAt(sc.picks, pick ?? '', '') } : null),
    };
    if (isCorrect) {
      setCorrect((c) => c + 1);
      addCoins(1, lessonId);
      addLightning(1);
    }
    void savePartScore(lessonId, part.id, score.current);
  };

  const finish = async (finalCorrect: number) => {
    const accuracy = total ? finalCorrect / total : 0;
    if (replay) {
      router.replace(R.homework(lessonId) as Href);
      return;
    }
    if (accuracy < PASS_THRESHOLD) {
      playSfx('lose');
      speak('retry', 900);
      setTooLow(Math.round(accuracy * 100));
      return;
    }
    score.current = { ...score.current, finished: true };
    await savePartScore(lessonId, part.id, score.current);
    await markHomeworkPartDone(lessonId, part.id);
    reportActivity({ type: 'homework', label: `${lessonId} - ${ACTIVITY_LABEL[part.kind] ?? part.title}`, scorePercent: Math.round(accuracy * 100) });
    // Barcha avtomatik qismlar tugagan bo'lsa — "Vazifa tekshirildi" oynasi bilan qaytamiz.
    const progress = getLessonProgress(lessonId);
    const scores = getLessonScores(lessonId);
    const allDone = allParts.filter((p) => !isTeacherGraded(p)).every((p) => progress.homeworkParts[p.id] || scores[p.id]?.finished);
    // Hammasi tugagan bo'lsa "Vazifa tekshirildi" oynasi o'z ovozini chaladi.
    if (!allDone) {
      playSfx('complete');
      speak('correct', 1550);
    }
    router.replace((allDone ? `${R.homework(lessonId)}?yuborildi=1` : `${R.homework(lessonId)}?bajarildi=1`) as Href);
  };

  const next = () => {
    if (index + 1 >= total) {
      void finish(correct);
      return;
    }
    setIndex(index + 1);
  };

  const retry = () => {
    score.current = { answered: 0, correct: 0, total, coins: score.current.coins, mistakes: [], finished: false, results: [], picks: [] };
    void savePartScore(lessonId, part.id, score.current);
    setIndex(0);
    setCorrect(0);
    setResults([]);
    setTooLow(null);
  };

  return { ready, index, correct, replay, replayCoins, tooLow, results, answer, next, retry, finish };
}
