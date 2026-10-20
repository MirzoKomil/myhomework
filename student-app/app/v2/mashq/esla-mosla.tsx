/**
 * v2 Esla-mosla (dizayn: 28 · Memory).
 *
 * So'zlar eski resources/games/memory-match.tsx'dagi kabi: o'quvchi
 * ochgan darslar lug'ati (yetmasa — zaxira so'zlar). Dizayn bo'yicha
 * klassik juftlash: 6 juft = 12 yopiq karta (rasm kartasi + so'z kartasi).
 * Rasm — so'zning CRM'dagi rasmi (imageUrl), bo'lmasa uning ikonkasi.
 * Eng yaxshi vaqt qurilmada rekord sifatida saqlanadi.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, HouseCardIcon, StopwatchIcon } from '@/components/v2/practice/icons';
import { GameHeader, fmtTime, reset } from '@/components/v2/practice/shared';
import { GameResult } from '@/components/v2/practice/GameResult';
import { fonts } from '@/constants/v2/tokens';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';
import { DMemory } from '@/components/v2/desktop/practice/DMemory';
// O'yin mantig'i (juftlash, vaqt, rekord) — telefon va kompyuter uchun bitta hook'da.
import { useMemoryGame, type MemoryWord as Word } from '@/components/v2/desktop/practice/useMemoryGame';

function WordImage({ w, size }: { w: Word; size: number }) {
  if (w.imageUrl) return <Image source={{ uri: w.imageUrl }} style={{ width: size, height: size }} resizeMode="contain" />;
  return <Ionicons name={w.icon} size={size * 0.62} color="#2F5BFF" />;
}

export default function MemoryScreen() {
  return useIsDesktop() ? <DMemory /> : <MemoryMobile />;
}

function MemoryMobile() {
  const insets = useSafeAreaInsets();
  const { lesson, words, deck, open, matched, seconds, last, won, bestBefore, flip, restart, total, lastWord } = useMemoryGame();

  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <GameHeader
          overline={lesson ? `${lesson.number}-dars · ${lesson.name}` : 'Dars soʻzlari'}
          overlineColor="#8A3A00"
          title="Esla-mosla"
          right={
            <View accessibilityLabel={`${seconds} soniya oʻtdi`} style={styles.timer}>
              <StopwatchIcon size={16} color="#0B1220" strokeWidth={2.2} />
              <Text style={styles.timerText}>{fmtTime(seconds)}</Text>
            </View>
          }
        />

        <View style={styles.progressWrap}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Rasm va soʻzni juftlang</Text>
            <Text style={[styles.progressLabel, { color: '#8A3A00' }]}>{matched.size} / {total} juft</Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Topilgan juftlar"
            accessibilityValue={{ min: 0, max: total, now: matched.size }}
            style={styles.track}
          >
            <View style={[styles.fill, { width: `${(matched.size / total) * 100}%` }]} />
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
          {words &&
            deck.map((card) => {
              const w = words[card.pair];
              const isMatched = matched.has(card.pair);
              const isOpen = open.includes(card.id);
              if (!isMatched && !isOpen) {
                return (
                  <Pressable key={card.id} accessibilityRole="button" accessibilityLabel="Yopiq karta" onPress={() => flip(card)} style={styles.cell}>
                    <View style={[styles.card, styles.closed]}>
                      <HouseCardIcon />
                    </View>
                  </Pressable>
                );
              }
              const tone = isMatched ? styles.ok : styles.openRing;
              return (
                <View
                  key={card.id}
                  accessibilityLabel={`${w.translation} — ${isMatched ? 'topildi' : 'ochiq'}`}
                  style={styles.cell}
                >
                  <View style={[styles.card, tone, card.kind === 'word' && isMatched && { backgroundColor: '#E3F7EE' }]}>
                    {card.kind === 'img' ? (
                      <WordImage w={w} size={84} />
                    ) : (
                      <>
                        <Text style={[styles.cardWord, fitWord(w.word), !isMatched && { color: '#0B1220' }]} numberOfLines={2}>{w.word}</Text>
                        <Text style={[styles.cardTr, !isMatched && { color: '#4A5468' }]} numberOfLines={2}>{w.translation}</Text>
                      </>
                    )}
                    {isMatched && (
                      <View style={styles.badge}>
                        <CheckIcon />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
        </ScrollView>

        {/* Dizaynda maslahat kartasi faqat karta ochilgandan keyin bor — boshida bo'sh joy. */}
        {won || (last && lastWord && !matched.has(last.pair)) ? (
        <Pressable
          disabled={!won}
          onPress={restart}
          style={[styles.hint, { marginBottom: Math.max(insets.bottom, 34) }]}
        >
          {lastWord && last?.kind === 'img' && !won ? (
            <View style={styles.hintImg}><WordImage w={lastWord} size={40} /></View>
          ) : null}
          <Text style={styles.hintText}>
            {won ? (
              <>Hammasi topildi — {fmtTime(seconds)}! <Text style={styles.hintStrong}>Qaytadan oʻynash</Text></>
            ) : lastWord ? (
              <>
                {cap(lastWord.translation)} ochildi — endi <Text style={styles.hintStrong}>«{lastWord.word}»</Text>{' '}
                {last?.kind === 'img' ? 'soʻzini' : 'rasmini'} toping
              </>
            ) : null}
          </Text>
        </Pressable>
        ) : (
          <View style={{ height: Math.max(insets.bottom, 34) }} />
        )}
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
    </View>
  );
}

// Karta ichki kengligi ~96px: uzun so'z ("знакомство") kesilib qolmasin —
// shrift eng uzun bo'lak uzunligiga qarab kichrayadi (21 → 13), ibora 2 qatorga o'tadi.
function fitWord(word: string) {
  const longest = Math.max(...word.split(/\s+/).map((t) => t.replace(/\u0301/g, '').length), 1);
  const size = Math.max(13, Math.min(21, Math.floor(96 / (longest * 0.64))));
  return { fontSize: size, lineHeight: Math.round(size * 1.3), textAlign: 'center' as const };
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF1E6' },
  column: { flex: 1, maxWidth: 480, alignSelf: 'center', width: '100%' },
  timer: { height: 44, paddingHorizontal: 12, borderRadius: 15, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#0B1220', fontVariant: ['tabular-nums'], ...reset },

  progressWrap: { paddingTop: 16, paddingHorizontal: 20, gap: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontFamily: fonts.bodyHeavy, fontSize: 14, lineHeight: 19, color: '#0B1220', ...reset },
  track: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#FF7A1A' },

  grid: { paddingTop: 16, paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 12, paddingBottom: 12 },
  cell: { width: '31.4%', flexGrow: 1, height: 122 },
  card: { flex: 1, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 2 },
  closed: {
    backgroundImage: 'radial-gradient(circle at 30% 22%, #FFA45F 0, #FF7A1A 52%, #EE5E06 100%)',
    backgroundColor: '#FF7A1A',
    boxShadow: 'inset 0 0 0 6px #FF7A1A, inset 0 0 0 8px rgba(255,255,255,0.6), 0 4px 0 #C94F05',
  } as object,
  ok: { boxShadow: 'inset 0 0 0 3px #087A4A, 0 4px 0 #CDEFDD' } as object,
  openRing: { boxShadow: 'inset 0 0 0 3px #2F5BFF, 0 4px 0 #C9D6FF' } as object,
  cardWord: { fontFamily: fonts.bodyHeavy, fontSize: 21, lineHeight: 29, color: '#075E3A', paddingHorizontal: 6, ...reset },
  cardTr: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 15, color: '#075E3A', paddingHorizontal: 6, textAlign: 'center', ...reset },
  badge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#087A4A', alignItems: 'center', justifyContent: 'center' },

  hint: { marginHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  hintImg: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hintText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18.9, color: '#26304A', ...reset },
  hintStrong: { fontFamily: fonts.bodyHeavy, color: '#0B1220' },
});
