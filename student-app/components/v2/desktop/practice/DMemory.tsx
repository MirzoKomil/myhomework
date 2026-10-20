/**
 * Kompyuter: Esla-mosla (dizayn: D_Memory).
 *
 * Mantiq telefon bilan bitta (useMemoryGame): 6 juft = 12 karta (rasm + so'z),
 * vaqt, rekord, coin/chaqmoq, GameResult. O'ngdagi maslahat kartasi telefondagi
 * kabi faqat karta ochilgandan keyin chiqadi.
 * Klaviatura: ← → ↑ ↓ — karta tanlash, Enter — ochish, Esc — chiqish.
 * Tanlangan karta atrofida ingichka ramka (faqat klaviatura ishlatilganda).
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { FocusFrame } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { GameResult } from '@/components/v2/practice/GameResult';
import { fmtTime } from '@/components/v2/practice/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

import { ICheck, IHouse, IStopwatch, K, T, web } from './ui';
import { PAIRS, useMemoryGame, type MemoryWord } from './useMemoryGame';

const COLS = 4;

function WordImage({ w, size }: { w: MemoryWord; size: number }) {
  if (w.imageUrl) return <Image source={{ uri: w.imageUrl }} style={{ width: size, height: size }} resizeMode="contain" />;
  return <Ionicons name={w.icon} size={size * 0.62} color="#2F5BFF" />;
}

// Karta ichki kengligi ~176px: uzun so'z kesilmasin — shrift 36 → 18 gacha kichrayadi.
function fitWord(word: string) {
  const longest = Math.max(...word.split(/\s+/).map((t) => t.replace(/́/g, '').length), 1);
  const size = Math.max(18, Math.min(36, Math.floor(176 / (longest * 0.66))));
  return { fontSize: size, lineHeight: Math.round(size * 1.36) };
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function DMemory() {
  const { lesson, rec, words, deck, open, matched, seconds, last, won, bestBefore, flip, restart, total, lastWord } = useMemoryGame();
  const [cursor, setCursor] = useState(0);
  const [keyboard, setKeyboard] = useState(false);

  const move = (d: number) => () => {
    setKeyboard(true);
    setCursor((c) => Math.min(Math.max(c + d, 0), Math.max(deck.length - 1, 0)));
  };
  useDesktopKeys({
    ArrowLeft: move(-1),
    ArrowRight: move(1),
    ArrowUp: move(-COLS),
    ArrowDown: move(COLS),
    Enter: () => {
      if (won) return restart();
      const c = deck[cursor];
      if (c) {
        setKeyboard(true);
        flip(c);
      }
    },
  });

  const showHint = won || (last && lastWord && !matched.has(last.pair));
  const best = rec.memorySeconds;

  const center = (
    <View style={{ width: 440, gap: 7 }}>
      <View style={s.between}>
        <T w={800} size={13} color="#34405A" lh={18}>
          Rasm va soʻzni juftlang
        </T>
        <T w={700} size={13} color="#B34700" lh={18}>
          {matched.size} / {total} juft
        </T>
      </View>
      <View accessibilityLabel={`Topilgan juftlar: ${matched.size} / ${total}`} style={{ flexDirection: 'row', gap: 5 }}>
        {Array.from({ length: total || PAIRS }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < matched.size ? '#FF7A1A' : '#E2E6EE' }} />
        ))}
      </View>
    </View>
  );

  const right = (
    <View accessibilityRole="timer" accessibilityLabel={`${seconds} soniya oʻtdi`} style={s.timer}>
      <IStopwatch size={20} color="#0B1220" sw={2.3} />
      <T w={800} size={18} lh={25}>
        {fmtTime(seconds)}
      </T>
    </View>
  );

  return (
    <FocusFrame
      closeTo={R.practice}
      title="Esla-mosla"
      subtitle={lesson ? `${lesson.number}-dars · ${lesson.name} soʻzlari` : 'Dars soʻzlari'}
      center={center}
      right={right}
      bg="#FFF4EA"
    >
      <View style={s.body}>
        <View style={s.wrap}>
          <View style={s.grid}>
            {words &&
              deck.map((card, idx) => {
                const w = words[card.pair];
                const isMatched = matched.has(card.pair);
                const isOpen = open.includes(card.id);
                const ring = keyboard && idx === cursor ? web({ outline: '3px solid #9DB2FF', outlineOffset: 3 }) : null;
                if (!isMatched && !isOpen) {
                  return (
                    <Pressable
                      key={card.id}
                      accessibilityRole="button"
                      accessibilityLabel="Yopiq karta"
                      onPress={() => {
                        setCursor(idx);
                        flip(card);
                      }}
                      style={[s.card, s.closed, web({ backgroundImage: 'linear-gradient(145deg, #FF9A45, #FF7A1A)', boxShadow: '0 5px 0 #D45F08' }), ring]}
                    >
                      <View style={s.closedInner}>
                        <IHouse />
                      </View>
                    </Pressable>
                  );
                }
                const border = isMatched ? '#087A4A' : '#2F5BFF';
                const shadow = isMatched ? '#CDEBDD' : '#C3D0FF';
                return (
                  <View
                    key={card.id}
                    accessibilityLabel={`${cap(w.translation)} — ${isMatched ? 'topildi' : 'ochiq'}`}
                    style={[
                      s.card,
                      { borderWidth: 3, borderColor: border, backgroundColor: card.kind === 'word' && isMatched ? '#E3F7EE' : '#FFFFFF' },
                      web({ boxShadow: `0 5px 0 ${shadow}` }),
                      ring,
                    ]}
                  >
                    {card.kind === 'img' ? (
                      <WordImage w={w} size={isMatched ? 140 : 150} />
                    ) : (
                      <View style={{ alignItems: 'center', gap: 4, paddingHorizontal: 8 }}>
                        <Text style={[s.cardWord, fitWord(w.word), !isMatched && { color: '#0B1220' }]} numberOfLines={2}>
                          {w.word}
                        </Text>
                        <T w={700} size={16} color={isMatched ? '#075E3A' : '#4A5468'} lh={22} lines={2} style={{ textAlign: 'center' }}>
                          {w.translation}
                        </T>
                      </View>
                    )}
                    {isMatched && (
                      <View style={s.badge}>
                        <ICheck />
                      </View>
                    )}
                  </View>
                );
              })}
          </View>

          <View style={{ width: 232, gap: 16 }}>
            {showHint && (
              <Pressable accessibilityRole={won ? 'button' : undefined} disabled={!won} onPress={restart} style={s.hint}>
                {won ? (
                  <T w={700} size={17} color="#1E3FD1" lh={24} style={{ textAlign: 'center' }}>
                    Hammasi topildi — {fmtTime(seconds)}! <Text style={{ fontFamily: fonts.bodyHeavy }}>Qaytadan oʻynash</Text>
                  </T>
                ) : lastWord ? (
                  <>
                    <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
                      <WordImage w={lastWord} size={120} />
                    </View>
                    <T w={700} size={17} color="#1E3FD1" lh={24} style={{ textAlign: 'center' }}>
                      {cap(lastWord.translation)} ochildi — endi <Text style={{ fontFamily: fonts.bodyHeavy }}>«{lastWord.word}»</Text>{' '}
                      {last?.kind === 'img' ? 'soʻzini' : 'rasmini'} toping
                    </T>
                  </>
                ) : null}
              </Pressable>
            )}
            <View style={s.stats}>
              {[
                ['Juftlar', `${matched.size} / ${total}`, '#B34700'],
                ['Vaqt', fmtTime(seconds), '#0B1220'],
                ['Rekord', best == null ? '0:00' : fmtTime(best), '#0B1220'],
              ].map(([l, v, c]) => (
                <View key={l} style={s.statRow}>
                  <T w={700} size={14} color="#4A5468" lh={19}>
                    {l}
                  </T>
                  <T w={800} size={18} color={c} lh={25}>
                    {v}
                  </T>
                </View>
              ))}
            </View>
            <View style={{ gap: 10, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                {['←', '→', '↑', '↓'].map((k) => (
                  <K key={k}>{k}</K>
                ))}
                <T w={700} size={13} color="#4A5468" lh={18} style={{ marginLeft: 3 }}>
                  tanlash
                </T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <K>Enter</K>
                <T w={700} size={13} color="#4A5468" lh={18}>
                  kartani ochish
                </T>
              </View>
            </View>
          </View>
        </View>
      </View>
      <GameResult
        show={won}
        win
        title="Barakalla!"
        subtitle={`Hammasi topildi — ${total} juft`}
        stats={[
          { value: fmtTime(seconds), label: 'vaqt' },
          { value: bestBefore == null ? fmtTime(seconds) : fmtTime(Math.min(bestBefore, seconds)), label: 'eng yaxshi' },
        ]}
        coins={total}
        lightning={total}
        newRecord={bestBefore != null && seconds < bestBefore}
        onAgain={restart}
      />
    </FocusFrame>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timer: { height: 46, paddingHorizontal: 16, borderRadius: 15, backgroundColor: '#FFF1E6', flexDirection: 'row', alignItems: 'center', gap: 8 },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  // To'r (854) + 36 + 232 = 1122 > 1100: dizayndagi kabi chapdan boshlanadi (o'ngga 22px chiqadi).
  wrap: { width: 1100, maxWidth: '100%', flexDirection: 'row', gap: 36, alignItems: 'center', justifyContent: 'flex-start' },
  grid: { width: 4 * 200 + 3 * 18, flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 20 },
  card: { width: 200, height: 206, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  closed: { backgroundColor: '#FF7A1A', padding: 9 },
  closedInner: { alignSelf: 'stretch', flex: 1, borderRadius: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  cardWord: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', color: '#075E3A', textAlign: 'center' },
  badge: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: '#087A4A', alignItems: 'center', justifyContent: 'center' },

  hint: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, alignItems: 'center', gap: 10 },
  stats: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, gap: 12 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
