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
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, HandIcon, TimerIcon } from '@/components/v2/practice/icons';
import { GameHeader, displayRu, fmtTime, reset } from '@/components/v2/practice/shared';
import { GameResult } from '@/components/v2/practice/GameResult';
import { fonts } from '@/constants/v2/tokens';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { DWordSearch } from '@/components/v2/desktop/practice/DWordSearch';
// O'yin mantig'i (to'r, tanlash qoidasi) — telefon va kompyuter uchun bitta hook'da.
import { mmss, useWordSearchGame, WORD_COUNT, type Cell } from '@/components/v2/desktop/practice/useWordSearchGame';

// Topilgan so'zlar ranglari (dizayndagi tartibda), keyin takrorlanadi.
const FOUND_COLORS = [
  { bg: '#6A3CF0', fg: '#FFFFFF' },
  { bg: '#FFC93C', fg: '#0B1220' },
  { bg: '#087A4A', fg: '#FFFFFF' },
  { bg: '#FF7A1A', fg: '#FFFFFF' },
  { bg: '#2F5BFF', fg: '#FFFFFF' },
  { bg: '#D92D20', fg: '#FFFFFF' },
];

const key = (p: Cell) => `${p.r}-${p.c}`;

export default function WordSearchScreen() {
  return useIsDesktop() ? <DWordSearch /> : <WordSearchMobile />;
}

function WordSearchMobile() {
  const insets = useSafeAreaInsets();
  const { lesson, board, path, found, flash, gridBox, seconds, displayRef, newBoard, poolRef, words, won, foundIndexOf, extend, total, selecting } = useWordSearchGame();

  const colorOf = (cell: Cell) => {
    const i = foundIndexOf(cell);
    return i < 0 ? null : FOUND_COLORS[i % FOUND_COLORS.length];
  };

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
