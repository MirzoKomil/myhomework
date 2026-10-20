/**
 * Sirli so'z o'yini holati va qoidalari — telefon (app/v2/mashq/sirli-soz.tsx)
 * va kompyuter (DMystery) ekranlari uchun bitta manba.
 *
 * Sabab: harf baholash, urinishlar, maslahat narxi, coin/chaqmoq, ovozlar va
 * jismoniy klaviatura (Enter / Backspace / harflar) ikkala ko'rinishda aynan
 * bir xil — mantiq telefon ekranidan o'zgarishsiz ko'chirildi.
 */
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { plainWord, saveRecords, useCurrentLesson } from '@/components/v2/practice/shared';
import { loadMixContext, markMistake, pickMix, rememberShown, type MixContext } from '@/components/v2/practice/wordMix';
import { useLang } from '@/i18n/LanguageContext';
import { addCoins, getTotalCoins } from '@/services/coinsStore';
import { addLightning } from '@/services/lightningStore';
import { playSfx } from '@/services/sfx';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

export const LEN = 5;
export const MAX_TRIES = 6;
export const HINT_PRICE = 10;
const MIN_POOL = 3;
const FALLBACK_RU = ['время', 'слово', 'книга', 'земля', 'белый', 'синий', 'осень', 'улица', 'дверь', 'жизнь', 'ответ', 'парта'];
const FALLBACK_EN = ['apple', 'grape', 'house', 'water', 'plant', 'chair', 'brave', 'smile', 'dance', 'light'];

export type St = 'correct' | 'present' | 'absent';

function evaluate(guess: string, answer: string): St[] {
  const res: St[] = Array(LEN).fill('absent');
  const used = Array(LEN).fill(false);
  for (let i = 0; i < LEN; i++) if (guess[i] === answer[i]) { res[i] = 'correct'; used[i] = true; }
  for (let i = 0; i < LEN; i++) {
    if (res[i] === 'correct') continue;
    const j = [...answer].findIndex((l, k) => l === guess[i] && !used[k]);
    if (j >= 0) { res[i] = 'present'; used[j] = true; }
  }
  return res;
}

export const ST_LABEL: Record<St, string> = { correct: 'oʻz joyida', present: 'bor, joyi boshqa', absent: 'yoʻq' };

export function useMysteryGame() {
  const { courseLang } = useLang();
  const isRu = courseLang === 'russian';
  const lesson = useCurrentLesson();

  const [pool, setPool] = useState<string[] | null>(null);
  const [answer, setAnswer] = useState('');
  const [guesses, setGuesses] = useState<{ word: string; st: St[] }[]>([]);
  const [cur, setCur] = useState('');
  const [hints, setHints] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [over, setOver] = useState<'won' | 'lost' | null>(null);

  const re = isRu ? /^[а-яё]+$/ : /^[a-z]+$/;
  // Aqlli aralash: avval joriy dars / takrorlash kerak bo'lgan so'z.
  const mixRef = useRef<MixContext | null>(null);
  const origRef = useRef<Record<string, string>>({});
  const nextAnswer = (p: string[]) => {
    const a = pickMix(p, 1, (w) => w, mixRef.current)[0] ?? p[Math.floor(Math.random() * p.length)];
    rememberShown([a]);
    return a;
  };

  useEffect(() => {
    Promise.all([getAccumulatedVocabulary().catch(() => []), loadMixContext().catch(() => null)])
      .then(([words, ctx]) => {
        mixRef.current = ctx;
        for (const w of words) origRef.current[plainWord(w.english).toLowerCase()] = w.english;
        const p = Array.from(new Set(words.map((w) => plainWord(w.english).toLowerCase()).filter((w) => w.length === LEN && re.test(w))));
        const final = p.length >= MIN_POOL ? p : isRu ? FALLBACK_RU : FALLBACK_EN;
        setPool(final);
        setAnswer(nextAnswer(final));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRu]);

  const keyState: Record<string, St> = {};
  for (const g of guesses)
    g.st.forEach((s, i) => {
      const l = g.word[i];
      const prev = keyState[l];
      if (prev === 'correct' || (prev === 'present' && s === 'absent')) return;
      keyState[l] = s;
    });

  const type = (l: string) => {
    if (over || cur.length >= LEN) return;
    setCur((c) => c + l);
    playSfx('tap');
    setMsg(null);
  };
  const back = () => {
    if (over) return;
    setCur((c) => c.slice(0, -1));
    playSfx('tap');
  };

  const submit = () => {
    if (over || !answer) return;
    if (cur.length !== LEN) {
      playSfx('wrong');
      return setMsg(`${LEN} harfli soʻz kiriting`);
    }
    const st = evaluate(cur, answer);
    const next = [...guesses, { word: cur, st }];
    setGuesses(next);
    if (cur !== answer && next.length < MAX_TRIES) playSfx('flip');
    setCur('');
    setMsg(null);
    if (cur === answer) {
      addCoins(1);
      addLightning(1);
      setOver('won');
      playSfx('complete');
      saveRecords({ mystery: { tries: next.length, max: MAX_TRIES } });
    } else if (next.length >= MAX_TRIES) {
      setOver('lost');
      playSfx('lose');
      // Topilmagan so'z — "So'z takrorlash"da ertaga chiqadi.
      if (origRef.current[answer]) markMistake(origRef.current[answer]);
      saveRecords({ mystery: { tries: next.length, max: MAX_TRIES } });
    }
  };

  // Webda jismoniy klaviatura ham ishlasin.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') submit();
      else if (e.key === 'Backspace') back();
      else if (e.key.length === 1 && re.test(e.key.toLowerCase())) type(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const hint = async () => {
    if (over || !answer) return;
    const free = [...Array(LEN).keys()].filter((i) => !(i in hints));
    if (!free.length) return;
    if (getTotalCoins() < HINT_PRICE) return setMsg(`Maslahat uchun ${HINT_PRICE} coin kerak`);
    await addCoins(-HINT_PRICE);
    const i = free[Math.floor(Math.random() * free.length)];
    setHints((h) => ({ ...h, [i]: answer[i] }));
  };

  const restart = () => {
    if (!pool) return;
    setAnswer(nextAnswer(pool));
    setGuesses([]);
    setCur('');
    setHints({});
    setMsg(null);
    setOver(null);
  };

  const attempt = Math.min(guesses.length + (over ? 0 : 1), MAX_TRIES);

  return { isRu, lesson, answer, guesses, cur, hints, msg, over, keyState, type, back, submit, hint, restart, attempt };
}
