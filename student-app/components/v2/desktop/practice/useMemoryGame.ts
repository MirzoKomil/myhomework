/**
 * Esla-mosla o'yini holati va qoidalari — telefon (app/v2/mashq/esla-mosla.tsx)
 * va kompyuter (DMemory) ekranlari uchun bitta manba.
 *
 * Sabab: juftlash qoidasi, vaqt, rekord, coin/chaqmoq va ovozlar ikkala
 * ko'rinishda aynan bir xil bo'lsin — mantiq telefon ekranidan o'zgarishsiz
 * ko'chirildi, joylashuv har ekranning o'zida.
 */
import type { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';

import { plainWord, saveRecords, useCurrentLesson, useRecords } from '@/components/v2/practice/shared';
import { loadMixContext, pickMix, rememberShown, type MixContext } from '@/components/v2/practice/wordMix';
import { useLang } from '@/i18n/LanguageContext';
import { addCoins } from '@/services/coinsStore';
import { addLightning } from '@/services/lightningStore';
import { playSfx, playSfxLater } from '@/services/sfx';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

type Icon = keyof typeof Ionicons.glyphMap;
export type MemoryWord = { word: string; translation: string; icon: Icon; imageUrl?: string };
export type MemoryCard = { id: string; pair: number; kind: 'img' | 'word' };

export const PAIRS = 6;

// Eski memory-match'dagi zaxira so'zlar (tarjimasi bilan).
const FALLBACK_RU: MemoryWord[] = [
  { word: 'дом', translation: 'uy', icon: 'home-outline' },
  { word: 'кни́га', translation: 'kitob', icon: 'book-outline' },
  { word: 'вода́', translation: 'suv', icon: 'water-outline' },
  { word: 'друг', translation: 'doʻst', icon: 'people-outline' },
  { word: 'телефо́н', translation: 'telefon', icon: 'phone-portrait-outline' },
  { word: 'учи́тель', translation: 'oʻqituvchi', icon: 'school-outline' },
  { word: 'соба́ка', translation: 'it', icon: 'paw-outline' },
  { word: 'пого́да', translation: 'ob-havo', icon: 'partly-sunny-outline' },
];
const FALLBACK_EN: MemoryWord[] = [
  { word: 'apple', translation: 'olma', icon: 'restaurant-outline' },
  { word: 'friend', translation: 'doʻst', icon: 'people-outline' },
  { word: 'travel', translation: 'sayohat', icon: 'airplane-outline' },
  { word: 'kitchen', translation: 'oshxona', icon: 'flame-outline' },
  { word: 'weather', translation: 'ob-havo', icon: 'partly-sunny-outline' },
  { word: 'teacher', translation: 'oʻqituvchi', icon: 'school-outline' },
  { word: 'book', translation: 'kitob', icon: 'book-outline' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tarjimadagi qavs ichidagi izohni olib tashlaymiz — karta kichik.
const shortTr = (t: string) => t.replace(/\s*\(.*?\)\s*/g, ' ').split('/')[0].trim();

function buildDeck(words: MemoryWord[]): MemoryCard[] {
  return shuffle(
    words.flatMap((_, i) => [
      { id: `i${i}`, pair: i, kind: 'img' as const },
      { id: `w${i}`, pair: i, kind: 'word' as const },
    ]),
  );
}

export function useMemoryGame() {
  const { courseLang } = useLang();
  const isRu = courseLang === 'russian';
  const lesson = useCurrentLesson();
  const { rec, reload } = useRecords();

  const [words, setWords] = useState<MemoryWord[] | null>(null);
  const [deck, setDeck] = useState<MemoryCard[]>([]);
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [last, setLast] = useState<MemoryCard | null>(null);
  const lockRef = useRef(false);

  // Butun so'z to'plami va aralash konteksti — "Qaytadan" har safar yangi so'zlar oladi.
  const poolRef = useRef<MemoryWord[]>([]);
  const mixRef = useRef<MixContext | null>(null);
  const dealWords = () => {
    const pool = poolRef.current;
    const picked = pickMix(pool, PAIRS, (w) => w.word, mixRef.current);
    const have = new Set(picked.map((w) => plainWord(w.word)));
    const fallback = (isRu ? FALLBACK_RU : FALLBACK_EN).filter((f) => !have.has(plainWord(f.word)));
    const all = [...picked, ...shuffle(fallback)].slice(0, PAIRS);
    rememberShown(picked.map((w) => w.word));
    setWords(all);
    setDeck(buildDeck(all));
  };

  useEffect(() => {
    let off = false;
    // Bitta so'z yoki ikki so'zli qisqa ibora (kartaga sig'adigan).
    const letterRe = isRu ? /^[а-яё]+( [а-яё]+)?$/i : /^[a-z]+( [a-z]+)?$/i;
    Promise.all([getAccumulatedVocabulary().catch(() => []), loadMixContext().catch(() => null)])
      .then(([vocab, ctx]) => {
        if (off) return;
        const uniq = new Map<string, MemoryWord>();
        for (const v of vocab) {
          // Kalit urg'usiz, kartada esa kontentdagi shakl (urg'u bilan bo'lsa — urg'u bilan).
          const orig = v.english.toLowerCase().replace(/[?!.,«»"]/g, '').trim();
          const k = plainWord(orig);
          if (letterRe.test(k) && k.length <= 12 && !uniq.has(k)) uniq.set(k, { word: orig, translation: shortTr(v.translation), icon: v.icon, imageUrl: v.imageUrl });
        }
        poolRef.current = [...uniq.values()];
        mixRef.current = ctx;
        dealWords();
      });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRu]);

  const won = !!words && matched.size === words.length;

  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  // Natija oynasidagi rekord: yutishdan oldingi eng yaxshi vaqt (saqlash uni o'zgartiradi).
  const [bestBefore, setBestBefore] = useState<number | null>(null);
  useEffect(() => {
    if (!won || !words) return;
    setBestBefore(rec.memorySeconds);
    playSfx('complete');
    addCoins(words.length);
    addLightning(words.length);
    if (rec.memorySeconds == null || seconds < rec.memorySeconds) saveRecords({ memorySeconds: seconds }).then(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const flip = (card: MemoryCard) => {
    if (lockRef.current || won || open.includes(card.id) || matched.has(card.pair)) return;
    if (!started) setStarted(true);
    setLast(card);
    playSfx('flip');
    const next = [...open, card.id];
    if (next.length < 2) return setOpen(next);
    setOpen(next);
    const a = deck.find((c) => c.id === next[0])!;
    if (a.pair === card.pair && a.kind !== card.kind) {
      setMatched((m) => new Set(m).add(card.pair));
      playSfxLater('match', 120);
      setOpen([]);
      return;
    }
    lockRef.current = true;
    setTimeout(() => {
      setOpen([]);
      lockRef.current = false;
    }, 800);
  };

  const restart = () => {
    if (!words) return;
    dealWords();
    setOpen([]);
    setMatched(new Set());
    setSeconds(0);
    setStarted(false);
    setLast(null);
  };

  const total = words?.length ?? PAIRS;
  const lastWord = last && words ? words[last.pair] : null;

  return { lesson, rec, words, deck, open, matched, seconds, last, won, bestBefore, flip, restart, total, lastWord };
}
