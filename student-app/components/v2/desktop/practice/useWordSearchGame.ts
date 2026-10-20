/**
 * So'ztopar o'yini holati va qoidalari — telefon (app/v2/mashq/soztopar.tsx)
 * va kompyuter (DWordSearch) ekranlari uchun bitta manba.
 *
 * Sabab: to'r yasash, tanlash qoidasi (faqat o'ngga yoki pastga), coin/chaqmoq
 * va ovozlar ikkala ko'rinishda aynan bir xil — mantiq telefon ekranidan
 * o'zgarishsiz ko'chirildi, joylashuv har ekranning o'zida.
 */
import { useEffect, useRef, useState } from 'react';

import { plainWord, saveRecords, useCurrentLesson } from '@/components/v2/practice/shared';
import { loadMixContext, pickMix, rememberShown, type MixContext } from '@/components/v2/practice/wordMix';
import { useLang } from '@/i18n/LanguageContext';
import { addCoins } from '@/services/coinsStore';
import { addLightning } from '@/services/lightningStore';
import { playSfx } from '@/services/sfx';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

export const SIZE = 7;
export const WORD_COUNT = 6;
const MIN_POOL = 3;
const FALLBACK_RU = ['ДОМ', 'КОТ', 'СОК', 'ЧАЙ', 'НОЖ', 'ДЕНЬ', 'УТРО', 'ОКНО', 'ХЛЕБ', 'РЫБА', 'ПТИЦА', 'ШКОЛА', 'ГОРОД'];
// Zaxira so'zlarning chipdagi urg'uli shakli (bir bo'g'inlilarga urg'u qo'yilmaydi).
const FALLBACK_RU_STRESS: Record<string, string> = {
  'УТРО': 'у́тро', 'ОКНО': 'окно́', 'РЫБА': 'ры́ба', 'ПТИЦА': 'пти́ца', 'ШКОЛА': 'шко́ла', 'ГОРОД': 'го́род',
};
const FALLBACK_EN = ['CAT', 'DOG', 'SUN', 'RAIN', 'BOOK', 'MILK', 'TEA', 'BREAD'];

export type Cell = { r: number; c: number };
export type Placement = { word: string; cells: Cell[] };

function buildGrid(words: string[], filler: string) {
  const grid: string[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(''));
  const placed: Placement[] = [];
  for (const word of words) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const down = Math.random() < 0.5;
      const maxR = down ? SIZE - word.length : SIZE - 1;
      const maxC = down ? SIZE - 1 : SIZE - word.length;
      if (maxR < 0 || maxC < 0) break;
      const r0 = Math.floor(Math.random() * (maxR + 1));
      const c0 = Math.floor(Math.random() * (maxC + 1));
      const cells = [...word].map((_, i) => ({ r: r0 + (down ? i : 0), c: c0 + (down ? 0 : i) }));
      if (!cells.every((p, i) => !grid[p.r][p.c] || grid[p.r][p.c] === word[i])) continue;
      cells.forEach((p, i) => { grid[p.r][p.c] = word[i]; });
      placed.push({ word, cells });
      break;
    }
  }
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (!grid[r][c]) grid[r][c] = filler[Math.floor(Math.random() * filler.length)];
  return { grid, placed };
}

export const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function useWordSearchGame() {
  const { courseLang } = useLang();
  const isRu = courseLang === 'russian';
  const lesson = useCurrentLesson();

  const [board, setBoard] = useState<{ grid: string[][]; placed: Placement[] } | null>(null);
  const [path, setPath] = useState<Cell[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);
  const gridBox = useRef({ w: 0, h: 0 });
  const [seconds, setSeconds] = useState(0);
  // Urg'usiz katta harfli so'z → chipda ko'rsatiladigan asl shakl (urg'u bilan).
  const displayRef = useRef<Record<string, string>>({});

  const mixRef = useRef<MixContext | null>(null);
  const newBoard = (pool: string[]) => {
    // Aqlli aralash: joriy dars, takrorlash kerak bo'lganlar, eski darslar.
    const picked = pickMix(pool, WORD_COUNT, (w) => w, mixRef.current).sort((a, b) => b.length - a.length);
    rememberShown(picked);
    setBoard(buildGrid(picked, isRu ? 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ' : 'ETAOINSHRDLUCMFWYPVBGK'));
    setPath([]);
    setFound([]);
    setSeconds(0);
  };
  const poolRef = useRef<string[]>([]);

  useEffect(() => {
    const re = isRu ? /^[А-ЯЁ]+$/ : /^[A-Z]+$/;
    Promise.all([getAccumulatedVocabulary().catch(() => []), loadMixContext().catch(() => null)])
      .then(([vocab, ctx]) => {
        mixRef.current = ctx;
        const disp: Record<string, string> = { ...FALLBACK_RU_STRESS };
        for (const w of vocab) disp[plainWord(w.english).toUpperCase()] = w.english.toLowerCase();
        displayRef.current = disp;
        const pool = Array.from(new Set(vocab.map((w) => plainWord(w.english).toUpperCase()).filter((w) => re.test(w) && w.length >= 3 && w.length <= SIZE)));
        const fb = isRu ? FALLBACK_RU : FALLBACK_EN;
        // Zaxira so'zlar faqat o'tilgan so'zlar taxtaga yetmaganda qo'shiladi.
        poolRef.current = pool.length >= WORD_COUNT ? pool : pool.length >= MIN_POOL ? [...pool, ...fb.filter((f) => !pool.includes(f))] : fb;
        newBoard(poolRef.current);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRu]);

  const words = board?.placed ?? [];
  const won = words.length > 0 && found.length === words.length;

  // O'yin vaqti: taxta tayyor bo'lgach boshlanadi, hammasi topilganda to'xtaydi.
  useEffect(() => {
    if (!board || won) return;
    const id = setInterval(() => setSeconds((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [board, won]);

  useEffect(() => {
    if (!board) return;
    saveRecords({ wordSearch: { found: found.length, total: words.length } });
    if (won) playSfx('complete');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found.length, board]);

  /** Topilgan so'z katagi — nechanchi bo'lib topilgani (rang tartibi uchun) yoki -1. */
  const foundIndexOf = (cell: Cell) => {
    for (let i = found.length - 1; i >= 0; i--) {
      const pl = words.find((w) => w.word === found[i]);
      if (pl?.cells.some((p) => p.r === cell.r && p.c === cell.c)) return i;
    }
    return -1;
  };

  const check = (next: Cell[]) => {
    if (!board) return;
    const text = next.map((p) => board.grid[p.r][p.c]).join('');
    const hit = words.find(
      (w) => !found.includes(w.word) && w.word === text && w.cells.every((p, i) => p.r === next[i].r && p.c === next[i].c),
    );
    if (hit) {
      setFound((f) => [...f, hit.word]);
      playSfx('match');
      setPath([]);
      addCoins(1);
      addLightning(1);
    }
  };

  // Keyingi harf faqat shu chiziq davomida (o'ngga yoki pastga) qo'shiladi.
  const extend = (cell: Cell) => {
    if (won || !board) return;
    setPath((cur) => {
      if (cur.some((p) => p.r === cell.r && p.c === cell.c)) {
        // Shu harfni qayta bosish — tanlovni shu joygacha qisqartiradi.
        const idx = cur.findIndex((p) => p.r === cell.r && p.c === cell.c);
        return idx === 0 && cur.length === 1 ? [] : cur.slice(0, idx + 1);
      }
      const lastCell = cur[cur.length - 1];
      let next: Cell[];
      if (!lastCell) next = [cell];
      else {
        const dr = cell.r - lastCell.r;
        const dc = cell.c - lastCell.c;
        const dir = cur.length >= 2 ? { r: cur[1].r - cur[0].r, c: cur[1].c - cur[0].c } : null;
        const okStep = (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
        if (okStep && (!dir || (dir.r === dr && dir.c === dc))) next = [...cur, cell];
        else next = [cell];
      }
      setTimeout(() => check(next), 0);
      if (next.length > 1 && !words.some((w) => !found.includes(w.word) && w.word.startsWith(next.map((p) => board.grid[p.r][p.c]).join('')))) {
        setFlash(true);
        playSfx('wrong');
        setTimeout(() => setFlash(false), 300);
      } else playSfx('pop');
      return next;
    });
  };

  const total = words.length || WORD_COUNT;
  const selecting = board && path.length ? path.map((p) => board.grid[p.r][p.c]).join('') : '';

  return { isRu, lesson, board, path, found, flash, gridBox, seconds, displayRef, newBoard, poolRef, words, won, foundIndexOf, extend, total, selecting };
}
