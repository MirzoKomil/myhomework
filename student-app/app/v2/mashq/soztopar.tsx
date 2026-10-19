/**
 * v2 Soʻztopar (dizayn: 29 · WordSearch).
 *
 * Eski resources/games/word-search.tsx mantig'i: o'quvchi ochgan darslar
 * lug'atidan (yetmasa — zaxira) so'zlar, faqat chapdan o'ngga yoki
 * tepadan pastga joylashtiriladi. Dizayn bo'yicha 7×7 to'r va 6 so'z.
 * Tanlash: harflarni ketma-ket bosib (yoki barmoqni surib) borasiz —
 * tanlangan harflar so'zga to'g'ri kelsa, so'z o'z rangi bilan belgilanadi.
 * Holat qatori: o'yin boshlanganidan beri o'tgan vaqt va topilgan so'zlar.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, HandIcon, TimerIcon } from '@/components/v2/practice/icons';
import { GameHeader, displayRu, fmtTime, plainWord, reset, saveRecords, useCurrentLesson } from '@/components/v2/practice/shared';
import { GameResult } from '@/components/v2/practice/GameResult';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { addCoins } from '@/services/coinsStore';
import { playWinSound } from '@/services/gameSounds';
import { addLightning } from '@/services/lightningStore';
import { loadMixContext, pickMix, rememberShown, type MixContext } from '@/components/v2/practice/wordMix';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

const SIZE = 7;
const WORD_COUNT = 6;
const MIN_POOL = 3;
const FALLBACK_RU = ['ДОМ', 'КОТ', 'СОК', 'ЧАЙ', 'НОЖ', 'ДЕНЬ', 'УТРО', 'ОКНО', 'ХЛЕБ', 'РЫБА', 'ПТИЦА', 'ШКОЛА', 'ГОРОД'];
// Zaxira so'zlarning chipdagi urg'uli shakli (bir bo'g'inlilarga urg'u qo'yilmaydi).
const FALLBACK_RU_STRESS: Record<string, string> = {
  'УТРО': 'у́тро', 'ОКНО': 'окно́', 'РЫБА': 'ры́ба', 'ПТИЦА': 'пти́ца', 'ШКОЛА': 'шко́ла', 'ГОРОД': 'го́род',
};
const FALLBACK_EN = ['CAT', 'DOG', 'SUN', 'RAIN', 'BOOK', 'MILK', 'TEA', 'BREAD'];
// Topilgan so'zlar ranglari (dizayndagi tartibda), keyin takrorlanadi.
const FOUND_COLORS = [
  { bg: '#6A3CF0', fg: '#FFFFFF' },
  { bg: '#FFC93C', fg: '#0B1220' },
  { bg: '#087A4A', fg: '#FFFFFF' },
  { bg: '#FF7A1A', fg: '#FFFFFF' },
  { bg: '#2F5BFF', fg: '#FFFFFF' },
  { bg: '#D92D20', fg: '#FFFFFF' },
];

type Cell = { r: number; c: number };
type Placement = { word: string; cells: Cell[] };

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

const key = (p: Cell) => `${p.r}-${p.c}`;
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function WordSearchScreen() {
  const insets = useSafeAreaInsets();
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
    if (won) playWinSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found.length, board]);

  const colorOf = (cell: Cell) => {
    for (let i = found.length - 1; i >= 0; i--) {
      const pl = words.find((w) => w.word === found[i]);
      if (pl?.cells.some((p) => p.r === cell.r && p.c === cell.c)) return FOUND_COLORS[i % FOUND_COLORS.length];
    }
    return null;
  };

  const check = (next: Cell[]) => {
    if (!board) return;
    const text = next.map((p) => board.grid[p.r][p.c]).join('');
    const hit = words.find(
      (w) => !found.includes(w.word) && w.word === text && w.cells.every((p, i) => p.r === next[i].r && p.c === next[i].c),
    );
    if (hit) {
      setFound((f) => [...f, hit.word]);
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
        setTimeout(() => setFlash(false), 300);
      }
      return next;
    });
  };

  const total = words.length || WORD_COUNT;
  const selecting = board && path.length ? path.map((p) => board.grid[p.r][p.c]).join('') : '';

  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <GameHeader
          overline={lesson ? `${lesson.number}-dars · mavzu: ${lesson.name}` : 'Dars soʻzlari'}
          overlineColor="#5A2FD6"
          title="Soʻztopar"
          right={<View style={styles.countPill}><Text style={styles.countText}>{found.length} / {words.length || WORD_COUNT} topildi</Text></View>}
        />

        <View style={styles.gridPad}>
          <View
            accessibilityLabel="Harflar toʻri"
            style={styles.grid}
            onLayout={(e: LayoutChangeEvent) => { gridBox.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}
          >
            {board?.grid.map((row, r) => (
              <View key={r} style={styles.row}>
                {row.map((ch, c) => {
                  const fc = colorOf({ r, c });
                  const sel = path.some((p) => p.r === r && p.c === c);
                  return (
                    <Pressable
                      key={key({ r, c })}
                      accessibilityLabel={ch}
                      onPress={() => extend({ r, c })}
                      style={[
                        styles.cell,
                        fc && { backgroundColor: fc.bg },
                        sel && { backgroundColor: flash ? '#FDECEC' : '#D4DEFF' },
                      ]}
                    >
                      <Text style={[styles.cellText, fc && { color: fc.fg }, sel && { color: '#1E3FD1' }]}>{ch}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.findRow}>
            <Text style={styles.findLabel}>Topilishi kerak</Text>
            {won ? (
              <Pressable accessibilityRole="button" onPress={() => newBoard(poolRef.current)} style={styles.status}>
                <Text style={styles.statusText}>Hammasi topildi · Yangi oʻyin</Text>
              </Pressable>
            ) : selecting ? (
              <View accessibilityRole="text" style={styles.status}>
                <Text style={styles.statusText}>Tanlanmoqda: {selecting}…</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.chips}>
            {words.map((w) => {
              const i = found.indexOf(w.word);
              const word = displayRef.current[w.word] ?? w.word.toLowerCase();
              if (i < 0) {
                return (
                  <View key={w.word} style={styles.chipTodo}>
                    <Text style={styles.chipText}>{word}</Text>
                  </View>
                );
              }
              const col = FOUND_COLORS[i % FOUND_COLORS.length];
              return (
                <View key={w.word} accessibilityLabel={`${word} — topildi`} style={[styles.chipDone, { backgroundColor: col.bg }]}>
                  <CheckIcon size={14} color={col.fg} strokeWidth={3.4} />
                  <Text style={[styles.chipText, { color: col.fg, textDecorationLine: 'line-through' }]}>{word}</Text>
                </View>
              );
            })}
          </View>
          <View
            accessibilityRole="summary"
            accessibilityLabel={`Oʻyin holati: ${total} tadan ${found.length} ta soʻz topildi, ${Math.floor(seconds / 60)} daqiqa ${seconds % 60} soniya`}
            style={styles.state}
          >
            <View style={styles.stateTime}>
              <TimerIcon />
              <Text style={styles.stateTimeText}>{mmss(seconds)}</Text>
            </View>
            <View style={styles.stateTrack}>
              <View style={[styles.stateFill, { width: `${(found.length / total) * 100}%` }]} />
            </View>
            <Text style={styles.stateCount}>{found.length} / {total} soʻz</Text>
          </View>
          <View style={[styles.tip, { marginBottom: Math.max(insets.bottom, 34) }]}>
            <HandIcon />
            <Text style={styles.tipText}>Harflar ustidan barmoqni suring — soʻz chapdan oʻngga yoki tepadan pastga</Text>
          </View>
        </View>
      </View>
      <GameResult
        show={won}
        win
        title="Barakalla!"
        subtitle={`${words.length} ta soʻzning hammasi topildi`}
        stats={[
          { value: fmtTime(seconds), label: 'vaqt' },
          { value: `${words.length} / ${words.length}`, label: 'soʻz' },
        ]}
        coins={words.length}
        lightning={words.length}
        onAgain={() => newBoard(poolRef.current)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0EBFF' },
  column: { flex: 1, maxWidth: 480, alignSelf: 'center', width: '100%' },
  countPill: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  countText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#3B2A73', ...reset },

  gridPad: { paddingTop: 20, paddingHorizontal: 20 },
  grid: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 12, gap: 4 },
  row: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: displayRu, fontSize: 22, color: '#0B1220', ...reset },

  body: { flex: 1, paddingTop: 18, paddingHorizontal: 20, gap: 10 },
  findRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 },
  findLabel: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: '#3B2A73', ...reset },
  status: { height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: '#D4DEFF', flexDirection: 'row', alignItems: 'center' },
  statusText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#1E3FD1', ...reset },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipDone: { height: 40, paddingLeft: 10, paddingRight: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipTodo: { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 2, borderStyle: 'dashed', borderColor: '#C9B8FF', justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#0B1220', ...reset },
  state: { marginTop: 6, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  stateTime: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  stateTimeText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#3B2A73', fontVariant: ['tabular-nums'], ...reset },
  stateTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#E6DEFF', overflow: 'hidden' },
  stateFill: { height: 8, borderRadius: 4, backgroundColor: '#6A3CF0' },
  stateCount: { flexShrink: 0, fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#3B2A73', ...reset },
  tip: { marginTop: 'auto', backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  tipText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19, color: '#26304A', ...reset },
});
