/**
 * Kompyuter: So'zlarni takrorlash (dizayn: D_WordReview). Menyusiz fokus ekran.
 * Mantiq mobil ekran (app/v2/takrorlash.tsx) bilan aynan bir xil: lug'at —
 * getAccumulatedVocabulary, seans — buildSession (ko'pi bilan 12 ta), natija
 * qurilmada (saveReview), har javobga +2 chaqmoq, tovush effektlari.
 * Klaviatura: Space — tinglash, 1 — Takrorlayman, 2 — Bilaman, Esc — yopish.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View, type TextStyle } from 'react-native';

import { FocusFrame, FocusProgress, Kbd, KbdHint } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { buildSession, daysAgo, loadReviews, saveReview, type ReviewRecord } from '@/components/v2/home/reviewStore';
import { Loading } from '@/components/v2/states/Loading';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import type { VocabWord } from '@/data/lessonContent';
import { useLang } from '@/i18n/LanguageContext';
import { addLightning } from '@/services/lightningStore';
import { playSfx } from '@/services/sfx';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

import { BoltIcon, ClockIcon, SpeakerIcon } from './icons';

/** Har bir so'z uchun chaqmoq (dizayndagi "+2 har soʻz") — mobil bilan bir xil. */
const LIGHTNING_PER_WORD = 2;

type Item = { word: VocabWord; record?: ReviewRecord };

export function DWordReview() {
  const { courseLang } = useLang();
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState(0);
  const [again, setAgain] = useState(0);
  const [busy, setBusy] = useState(false);
  // Sarlavhadagi progress: dizaynda 460px; tor oynada o'rtadagi bo'sh joyga sig'adi
  // (FocusFrame: chekka 2×32, yopish 46, nom 300, o'ng blok 360, oraliqlar 3×16).
  const { width: winW } = useWindowDimensions();
  const progW = Math.max(160, Math.min(460, winW - 64 - 46 - 300 - 360 - 48 - 16));

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAccumulatedVocabulary(), loadReviews()])
      .then(([words, reviews]) => {
        if (!cancelled) setItems(buildSession(words, reviews));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: courseLang === 'russian' ? 'ru-RU' : 'en-US', rate: 0.9 });
  };

  const list = items ?? [];
  const total = list.length;
  const done = known + again;
  const item = list[index];
  const position = total ? Math.min(total, done + 1) : 0;
  const left = total - done;

  const answer = async (didKnow: boolean) => {
    if (!item || busy) return;
    playSfx(didKnow ? 'correct' : 'flip');
    setBusy(true);
    await saveReview(item.word.english, didKnow);
    void addLightning(LIGHTNING_PER_WORD);
    if (didKnow) setKnown((k) => k + 1);
    else setAgain((a) => a + 1);
    setIndex((i) => i + 1);
    setBusy(false);
  };

  useDesktopKeys({
    ' ': () => item && speak(item.word.english),
    '1': () => void answer(false),
    '2': () => void answer(true),
  });

  if (!items && !failed) return <Loading withNav={false} />;

  // Uzun so'z kartaga sig'ishi uchun: 84px — dizayn o'lchami, ~360px kenglikka sig'guncha kichrayadi.
  const longest = item ? Math.max(...item.word.english.split(/\s+/).map((w) => w.replace(/́/g, '').length)) : 0;
  const wordSize = Math.max(36, Math.min(84, Math.floor(360 / (Math.max(1, longest) * 0.62))));
  const ago = item?.record ? daysAgo(item.record.lastSeen) : null;
  const sourceLabel = ago === null ? 'Lugʻatimdan' : `Lugʻatimdan · ${ago === 0 ? 'bugun' : `${ago} kun oldin`}`;
  const segments = Array.from({ length: total }, (_, i) => (i < done ? '#7C4DFF' : i === done ? '#C9B8FF' : '#E2E6EE'));

  return (
    <FocusFrame
      closeTo={R.home}
      title="Soʻzlarni takrorlash"
      subtitle={`Lugʻatimdan · bugun ${total} ta soʻz`}
      center={
        total > 0 ? (
          <FocusProgress
            left={`Takrorlash · ${position} / ${total}`}
            right={`${known} bilaman · ${left} qoldi`}
            segments={segments}
            label={`${total} soʻzdan ${position}-si`}
            width={progW}
          />
        ) : null
      }
      right={
        <View style={s.reward}>
          <BoltIcon size={18} />
          <Text style={s.rewardText}>+{LIGHTNING_PER_WORD} har soʻz</Text>
        </View>
      }
      footerWidth={960}
      footer={
        <>
          <KbdHint keys={['Space']} label="tinglash" />
          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Takrorlayman — ertaga yana chiqadi"
            aria-keyshortcuts="1"
            accessibilityState={{ disabled: !item }}
            disabled={!item}
            onPress={() => answer(false)}
            style={({ pressed }) => [s.btn, s.again, pressed && { backgroundColor: '#FFF1E6' }, !item && s.disabled]}
          >
            <View>
              <Text style={[s.btnText, { color: '#B34700' }]}>Takrorlayman</Text>
              <Text style={[s.btnSub, { color: '#B34700' }]}>ertaga yana</Text>
            </View>
            <Kbd>1</Kbd>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bilaman — 7 kundan keyin"
            aria-keyshortcuts="2"
            accessibilityState={{ disabled: !item }}
            disabled={!item}
            onPress={() => answer(true)}
            style={({ pressed }) => [s.btn, s.know, pressed && { backgroundColor: '#075E3A' }, !item && s.disabled]}
          >
            <View>
              <Text style={[s.btnText, { color: '#FFFFFF' }]}>Bilaman</Text>
              <Text style={[s.btnSub, { color: '#D6F5E5' }]}>7 kundan keyin</Text>
            </View>
            <View style={s.kbdGreen}>
              <Text style={s.kbdGreenText}>2</Text>
            </View>
          </Pressable>
        </>
      }
    >
      <View style={s.body}>
        <View style={s.column}>
          <View accessibilityLabel="Soʻz kartasi" style={s.card}>
            {item ? (
              <>
                <View style={s.imgCircle}>
                  {item.word.imageUrl ? (
                    <Image source={{ uri: item.word.imageUrl }} style={{ width: 336, height: 336 }} resizeMode="contain" accessibilityLabel={item.word.translation} />
                  ) : (
                    <Ionicons name={item.word.icon} size={160} color="#2F5BFF" accessibilityElementsHidden importantForAccessibility="no" />
                  )}
                </View>
                <View style={s.info}>
                  <View style={s.source}>
                    <ClockIcon size={16} color="#B34700" strokeWidth={2.4} />
                    <Text style={s.sourceText}>{sourceLabel}</Text>
                  </View>
                  <View style={s.wordRow}>
                    <Text style={[s.word, { fontSize: wordSize, lineHeight: wordSize, letterSpacing: -wordSize * 0.02 }]}>{item.word.english}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Talaffuzni tinglash (Space)"
                      aria-keyshortcuts="Space"
                      onPress={() => speak(item.word.english)}
                      style={({ pressed }) => [s.speak, pressed && { opacity: 0.8 }]}
                    >
                      <SpeakerIcon size={24} />
                    </Pressable>
                  </View>
                  {!!item.word.transcript && <Text style={s.transcript}>{item.word.transcript}</Text>}
                  <View style={s.divider}>
                    <View style={{ height: 1, width: 28, backgroundColor: '#E2E6EE' }} />
                    <Text style={s.dividerText}>Javob</Text>
                    <View style={{ height: 1, flex: 1, backgroundColor: '#E2E6EE' }} />
                  </View>
                  <Text style={s.translation}>{item.word.translation}</Text>
                  {/* Misol tarjimasi serverda yo'q — faqat ruscha gap (mobil ekrandagidek). */}
                  {!!item.word.exampleSentence && (
                    <View style={s.example}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={s.exampleText}>{item.word.exampleSentence}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Misol gapni tinglash"
                        onPress={() => speak(item.word.exampleSentence!)}
                        style={({ pressed }) => [s.exampleBtn, pressed && { opacity: 0.8 }]}
                      >
                        <SpeakerIcon size={20} />
                      </Pressable>
                    </View>
                  )}
                </View>
              </>
            ) : (
              // Bo'sh holat: lug'at bo'sh, yuklab bo'lmadi yoki bugungi so'zlar tugadi.
              <Text style={s.muted}>
                {failed ? 'Soʻzlarni yuklab boʻlmadi.' : total ? 'Bugungi takrorlash tugadi.' : 'Hozircha takrorlanadigan soʻz yoʻq.'}
              </Text>
            )}
          </View>
          <View accessibilityLabel="Takrorlash holati" style={s.stats}>
            <View style={[s.stat, { backgroundColor: '#E3F7EE' }]}>
              <Text style={[s.statNum, { color: '#075E3A' }]}>{known}</Text>
              <Text style={[s.statLabel, { color: '#075E3A' }]}>bilaman</Text>
            </View>
            <View style={[s.stat, { backgroundColor: '#FFF1E6' }]}>
              <Text style={[s.statNum, { color: '#B34700' }]}>{again}</Text>
              <Text style={[s.statLabel, { color: '#B34700' }]}>takrorlayman</Text>
            </View>
            <View style={[s.stat, { backgroundColor: '#FFFFFF' }]}>
              <Text style={[s.statNum, { color: '#34405A' }]}>{left}</Text>
              <Text style={[s.statLabel, { color: '#34405A' }]}>qoldi</Text>
            </View>
          </View>
        </View>
      </View>
    </FocusFrame>
  );
}

const T = (f: string, size: number, extra?: TextStyle): TextStyle => ({ fontFamily: f, fontWeight: 'normal', fontSize: size, ...extra });

const s = StyleSheet.create({
  reward: { height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#F0EBFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  rewardText: T(fonts.bodyHeavy, 15, { color: '#6A3CF0' }),
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  column: { width: 960, maxWidth: '100%', gap: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 34, flexDirection: 'row', alignItems: 'center', gap: 40, minHeight: 488 },
  imgCircle: { width: 420, height: 420, borderRadius: 210, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, minWidth: 0, gap: 14 },
  source: { alignSelf: 'flex-start', height: 32, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FFF1E6', flexDirection: 'row', alignItems: 'center', gap: 7 },
  sourceText: T(fonts.bodyHeavy, 14, { color: '#B34700' }),
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  word: T(fonts.display, 84, { color: '#0B1220', flexShrink: 1 }),
  speak: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  transcript: T(fonts.bodyBold, 20, { color: '#4A5468', marginTop: -6 }),
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerText: T(fonts.bodyHeavy, 12, { letterSpacing: 0.96, textTransform: 'uppercase', color: '#4A5468' }),
  translation: T(fonts.bodyHeavy, 34, { lineHeight: 37.4, color: '#6A3CF0' }),
  example: { marginTop: 4, backgroundColor: '#F4F6FA', borderRadius: 18, paddingVertical: 14, paddingRight: 14, paddingLeft: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  exampleText: T(fonts.bodyHeavy, 19, { color: '#0B1220' }),
  exampleBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  muted: T(fonts.body, 17, { flex: 1, color: '#4A5468', textAlign: 'center' }),
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  statNum: T(fonts.bodyHeavy, 26),
  statLabel: T(fonts.bodyBold, 15),
  btn: { height: 62, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  again: { paddingLeft: 24, paddingRight: 20, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#FFC9A3', boxShadow: '0 4px 0 #FFC9A3' },
  know: { paddingLeft: 26, paddingRight: 20, backgroundColor: '#087A4A', boxShadow: '0 5px 0 #075E3A' },
  disabled: { opacity: 0.5 },
  btnText: T(fonts.bodyHeavy, 17, { lineHeight: 19.55 }),
  btnSub: T(fonts.bodyBold, 13, { lineHeight: 14.95 }),
  kbdGreen: { height: 24, paddingHorizontal: 7, borderRadius: 7, backgroundColor: '#075E3A', justifyContent: 'center' },
  kbdGreenText: T(fonts.bodyHeavy, 12, { color: '#CFF2E0' }),
});
