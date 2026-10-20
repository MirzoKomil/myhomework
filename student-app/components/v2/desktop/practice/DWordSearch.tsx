/**
 * Kompyuter: Soʻztopar (dizayn: D_WordSearch).
 *
 * Mantiq telefon bilan bitta (useWordSearchGame): 7×7 to'r, 6 so'z, faqat
 * o'ngga yoki pastga, coin/chaqmoq, GameResult. Kompyuterda sichqoncha bilan
 * harflar ustidan tortib tanlanadi (bosish — telefondagi kabi ham ishlaydi).
 * Klaviatura: Esc — chiqish.
 */
import { useEffect, useRef } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { FocusFrame } from '@/components/v2/desktop/Shell';
import { GameResult } from '@/components/v2/practice/GameResult';
import { fmtTime } from '@/components/v2/practice/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

import { H, ICheck, IMouse, IStopwatch, KeyHints, T, useAvail } from './ui';
import { mmss, useWordSearchGame, type Cell } from './useWordSearchGame';

const img = (id: string) => (designImages as Record<string, ImageSourcePropType>)[id];
// Topilgan so'zlar ranglari (D_WordSearch tartibida), keyin telefondagi qolganlari.
const FOUND_COLORS = [
  { bg: '#7C4DFF', fg: '#FFFFFF' },
  { bg: '#FFC93C', fg: '#0B1220' },
  { bg: '#087A4A', fg: '#FFFFFF' },
  { bg: '#FF7A1A', fg: '#FFFFFF' },
  { bg: '#2F5BFF', fg: '#FFFFFF' },
  { bg: '#D92D20', fg: '#FFFFFF' },
];
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function DWordSearch() {
  const { lesson, board, path, found, flash, seconds, displayRef, newBoard, poolRef, words, won, foundIndexOf, extend, total, selecting } = useWordSearchGame();

  // Sichqoncha bosilgan holda harf ustiga o'tilsa — tanlov davom etadi.
  const dragging = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // To'r: 1440 da 660px (katak 82px); tor oynada o'ng ustun (400) sig'ishi uchun kichrayadi.
  const gridW = Math.min(660, useAvail(1100) - 40 - 400);
  const k = gridW / 660;
  const n = lesson?.number;
  const center = (
    <View accessibilityLabel={`Oʻyin holati: ${total} tadan ${found.length} ta soʻz topildi, ${Math.floor(seconds / 60)} daqiqa ${seconds % 60} soniya`} style={{ width: 440, gap: 7 }}>
      <View style={s.between}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <IStopwatch color="#6A3CF0" />
          <T w={800} size={13} color="#34405A" lh={18}>
            {mmss(seconds)}
          </T>
        </View>
        <T w={800} size={13} color="#6A3CF0" lh={18}>
          {found.length} / {total} soʻz
        </T>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${(found.length / total) * 100}%` }]} />
      </View>
    </View>
  );

  const right = (
    <View style={s.countPill}>
      <T w={800} size={16} color="#4B2BB8" lh={22}>
        {found.length} / {total} topildi
      </T>
    </View>
  );

  const cellAt = (c: Cell) => () => extend(c);

  return (
    <FocusFrame
      closeTo={R.practice}
      title="Soʻztopar"
      subtitle={lesson ? `${n}-dars · mavzu: ${lesson.name}` : 'Dars soʻzlari'}
      center={center}
      right={right}
      bg="#F3EFFF"
    >
      <View style={s.body}>
        <View style={s.wrap}>
          <View accessibilityLabel="Harflar toʻri" style={[s.grid, { width: gridW, padding: Math.round(24 * k) }]}>
            {board?.grid.map((row, r) => (
              <View key={r} style={s.row}>
                {row.map((ch, c) => {
                  const fi = foundIndexOf({ r, c });
                  const fc = fi < 0 ? null : FOUND_COLORS[fi % FOUND_COLORS.length];
                  const sel = path.some((p) => p.r === r && p.c === c);
                  return (
                    <Pressable
                      key={`${r}-${c}`}
                      accessibilityLabel={ch}
                      onPressIn={() => {
                        dragging.current = true;
                        cellAt({ r, c })();
                      }}
                      onHoverIn={() => {
                        if (dragging.current) cellAt({ r, c })();
                      }}
                      style={[s.cell, { height: Math.round(82 * k) }, fc && { backgroundColor: fc.bg }, sel && { backgroundColor: flash ? '#FDECEC' : '#D4DEFF' }, Platform.OS === 'web' && ({ userSelect: 'none' } as object)]}
                    >
                      <Text style={[s.cellText, { fontSize: Math.round(36 * k), lineHeight: Math.round(49 * k) }, fc && { color: fc.fg }, sel && { color: '#1E3FD1' }]}>{ch}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={{ width: 400, gap: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={s.gameIcon}>
                <Image source={img('6e82364b2d0800a1b04099cc5d172f63')} style={{ width: 64, height: 64 }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <H size={28} lh={34}>
                  Soʻzlarni toping
                </H>
                <T w={600} size={15} color="#4A5468" lh={20}>
                  {lesson ? `${cap(lesson.name)} mavzusidagi ${total} ta soʻz` : `Dars soʻzlaridan ${total} ta soʻz`}
                </T>
              </View>
            </View>

            <View style={s.card}>
              <View style={s.between}>
                <T w={800} size={11} color="#34405A" lh={15} style={{ letterSpacing: 0.88, textTransform: 'uppercase' }}>
                  Topilishi kerak
                </T>
                <T w={800} size={14} color="#6A3CF0" lh={19}>
                  {found.length} / {total} soʻz
                </T>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {words.map((w) => {
                  const i = found.indexOf(w.word);
                  const word = displayRef.current[w.word] ?? w.word.toLowerCase();
                  if (i < 0) {
                    return (
                      <View key={w.word} style={s.chipTodo}>
                        <Text style={s.chipText}>{word}</Text>
                      </View>
                    );
                  }
                  const col = FOUND_COLORS[i % FOUND_COLORS.length];
                  return (
                    <View key={w.word} accessibilityLabel={`${word} — topildi`} style={[s.chipDone, { backgroundColor: col.bg }]}>
                      <ICheck size={18} color={col.fg} />
                      <Text style={[s.chipText, { color: col.fg, textDecorationLine: 'line-through' }]}>{word}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {won ? (
              <Pressable accessibilityRole="button" onPress={() => newBoard(poolRef.current)} style={s.status}>
                <T w={800} size={18} color="#1E3FD1" lh={25}>
                  Hammasi topildi · Yangi oʻyin
                </T>
              </Pressable>
            ) : (
              <View accessibilityRole="text" style={s.status}>
                <T w={800} size={18} color="#1E3FD1" lh={25}>
                  Tanlanmoqda: {selecting ? `${selecting}…` : '—'}
                </T>
              </View>
            )}

            <View style={s.tip}>
              <IMouse />
              <T w={700} size={15} color="#34405A" lh={21} style={{ flex: 1 }}>
                Sichqonchani bosib, harflar ustidan torting — soʻz chapdan oʻngga yoki tepadan pastga
              </T>
            </View>
            <View style={{ paddingHorizontal: 4 }}>
              <KeyHints items={[[['Esc'], 'oʻyindan chiqish']]} />
            </View>
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
    </FocusFrame>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E6E0FA', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#7C4DFF' },
  countPill: { height: 46, paddingHorizontal: 18, borderRadius: 15, backgroundColor: '#F0EBFF', justifyContent: 'center' },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 32 },
  wrap: { width: 1100, maxWidth: '100%', flexDirection: 'row', gap: 40, alignItems: 'center' },
  grid: { width: 660, backgroundColor: '#FFFFFF', borderRadius: 30, padding: 24, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, height: 82, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 36, lineHeight: 49, color: '#0B1220' },

  gameIcon: { width: 76, height: 76, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 26, paddingVertical: 22, paddingHorizontal: 24, gap: 16 },
  chipDone: { height: 50, paddingHorizontal: 18, borderRadius: 25, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipTodo: { height: 50, paddingHorizontal: 20, borderRadius: 25, backgroundColor: '#FFFFFF', borderWidth: 2, borderStyle: 'dashed', borderColor: '#C9B8FF', justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 20, lineHeight: 27, color: '#0B1220' },
  status: { height: 58, borderRadius: 18, backgroundColor: '#E8EEFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 20 },
});
