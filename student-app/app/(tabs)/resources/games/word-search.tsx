import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { addCoins } from '@/services/coinsStore';
import { addLightning } from '@/services/lightningStore';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

const MIN_GRID_SIZE = 8;
const WORD_COUNT = 5;
const MIN_POOL_SIZE = 3;
// O'quvchining lug'atida mos so'z yetarli topilmasa ishlatiladigan zaxira.
const FALLBACK_WORDS = ['CAT', 'DOG', 'SUN', 'RAIN', 'BOOK'];

type Placement = { word: string; row: number; col: number; dir: [number, number] };
type Cell = { row: number; col: number };

const DIRECTIONS: [number, number][] = [
  [0, 1], // o'ngga
  [1, 0], // pastga
];

// Berilgan so'zlar ro'yxatidan haqiqiy grid (harflar jadvali) va har bir
// so'zning joylashuvini quradi — tasodifiy joy/yo'nalish tanlab, band
// katakchalarga to'qnashsa qayta urinib ko'radi. Joylashtirib bo'lmagan
// so'zlar (kamdan-kam, joy yetishmasa) o'yindan chetlab o'tiladi.
function buildGrid(words: string[]): { grid: string[][]; placed: Placement[] } {
  const longest = Math.max(...words.map((w) => w.length), 0);
  const size = Math.max(MIN_GRID_SIZE, longest);
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const placed: Placement[] = [];

  const canPlace = (word: string, row: number, col: number, dir: [number, number]) => {
    for (let i = 0; i < word.length; i++) {
      const r = row + dir[0] * i;
      const c = col + dir[1] * i;
      if (r >= size || c >= size) return false;
      const existing = grid[r][c];
      if (existing && existing !== word[i]) return false;
    }
    return true;
  };

  for (const word of words) {
    let ok = false;
    for (let attempt = 0; attempt < 60 && !ok; attempt++) {
      const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const maxRow = dir[0] === 1 ? size - word.length : size - 1;
      const maxCol = dir[1] === 1 ? size - word.length : size - 1;
      if (maxRow < 0 || maxCol < 0) continue;
      const row = Math.floor(Math.random() * (maxRow + 1));
      const col = Math.floor(Math.random() * (maxCol + 1));
      if (!canPlace(word, row, col, dir)) continue;
      for (let i = 0; i < word.length; i++) {
        grid[row + dir[0] * i][col + dir[1] * i] = word[i];
      }
      placed.push({ word, row, col, dir });
      ok = true;
    }
  }

  const filler = 'ETAOINSHRDLUCMFWYPVBGKJQXZ';
  let fi = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r][c]) {
        grid[r][c] = filler[fi % filler.length];
        fi++;
      }
    }
  }
  return { grid, placed };
}

function getPath(a: Cell, b: Cell): Cell[] | null {
  const dr = b.row - a.row;
  const dc = b.col - a.col;
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  if (steps === 0) return null;
  const stepR = Math.sign(dr);
  const stepC = Math.sign(dc);
  const path: Cell[] = [];
  for (let i = 0; i <= steps; i++) {
    path.push({ row: a.row + stepR * i, col: a.col + stepC * i });
  }
  return path;
}

function cellKey(c: Cell) {
  return `${c.row}-${c.col}`;
}

export default function WordSearchGame() {
  const [board, setBoard] = useState<{ grid: string[][]; words: string[] } | null>(null);
  const [selection, setSelection] = useState<Cell | null>(null);
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getAccumulatedVocabulary().then((vocab) => {
      if (cancelled) return;
      const pool = Array.from(
        new Set(
          vocab
            .map((w) => w.english.toUpperCase())
            .filter((w) => /^[A-Z]+$/.test(w) && w.length >= 3 && w.length <= 8)
        )
      );
      const source = pool.length >= MIN_POOL_SIZE ? pool : FALLBACK_WORDS;
      const shuffled = [...source].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, WORD_COUNT).sort((a, b) => b.length - a.length);
      const { grid, placed } = buildGrid(picked);
      setBoard({ grid, words: placed.map((p) => p.word) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const grid = board?.grid ?? [];
  const WORDS_TO_FIND = board?.words ?? [];
  const won = board !== null && foundWords.size === WORDS_TO_FIND.length;

  const handleTap = (cell: Cell) => {
    if (won) return;
    if (!selection) {
      setSelection(cell);
      return;
    }
    if (selection.row === cell.row && selection.col === cell.col) {
      setSelection(null);
      return;
    }
    const path = getPath(selection, cell);
    setSelection(null);
    if (!path) return;

    const forward = path.map((p) => grid[p.row][p.col]).join('');
    const backward = forward.split('').reverse().join('');
    const match = WORDS_TO_FIND.find((w) => (w === forward || w === backward) && !foundWords.has(w));

    if (match) {
      addCoins(1);
      addLightning(1);
      setFoundWords((s) => new Set(s).add(match));
      setFoundCells((s) => {
        const next = new Set(s);
        path.forEach((p) => next.add(cellKey(p)));
        return next;
      });
    } else {
      const keys = new Set(path.map(cellKey));
      setFlash(keys);
      setTimeout(() => setFlash(new Set()), 400);
    }
  };

  const restart = () => {
    setSelection(null);
    setFoundCells(new Set());
    setFoundWords(new Set());
    setFlash(new Set());
  };

  if (!board) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="So'ztopar" showBack />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="So'ztopar" showBack />

      <View style={styles.wordsRow}>
        {WORDS_TO_FIND.map((w) => (
          <View key={w} style={[styles.wordChip, foundWords.has(w) && styles.wordChipFound]}>
            <Text style={[styles.wordChipText, foundWords.has(w) && styles.wordChipTextFound]}>{w}</Text>
          </View>
        ))}
      </View>

      {won ? (
        <View style={styles.resultWrap}>
          <Text style={styles.resultEmoji}>🎉</Text>
          <Text style={styles.resultTitle}>Barcha so'zlar topildi!</Text>
          <Pressable style={styles.restartBtn} onPress={restart}>
            <Text style={styles.restartText}>Qaytadan o'ynash</Text>
          </Pressable>
          <CelebrationOverlay visible={won} />
        </View>
      ) : (
        <View style={styles.grid}>
          {grid.map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((letter, ci) => {
                const key = `${ri}-${ci}`;
                const isSelected = selection?.row === ri && selection?.col === ci;
                const isFound = foundCells.has(key);
                const isFlash = flash.has(key);
                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.cell,
                      isSelected && styles.cellSelected,
                      isFound && styles.cellFound,
                      isFlash && styles.cellFlash,
                    ]}
                    onPress={() => handleTap({ row: ri, col: ci })}>
                    <Text style={[styles.cellText, isFound && styles.cellTextFound]}>{letter}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const CELL_SIZE = 38;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  wordChip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    ...theme.shadow.card,
  },
  wordChipFound: { backgroundColor: theme.colors.successBg },
  wordChipText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted },
  wordChipTextFound: { color: theme.colors.success, textDecorationLine: 'line-through' },
  grid: { alignItems: 'center', gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4 },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  cellSelected: { backgroundColor: theme.colors.purpleLight },
  cellFound: { backgroundColor: theme.colors.success },
  cellFlash: { backgroundColor: theme.colors.dangerBg },
  cellText: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text },
  cellTextFound: { color: '#fff' },
  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  resultEmoji: { fontSize: 56, marginBottom: 14 },
  resultTitle: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text, marginBottom: 24, textAlign: 'center' },
  restartBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  restartText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
