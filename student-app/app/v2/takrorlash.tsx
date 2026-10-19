/**
 * v2 So'z takrorlash (dizayn: WordReview.dc.html, "07 · Soʻz takrorlash").
 *
 * So'zlar — o'quvchi ochgan darslarning umumiy lug'ati (getAccumulatedVocabulary,
 * so'z o'yinlari bilan bir xil manba). Takrorlash jadvali serverda yo'q —
 * natija qurilmada (reviewStore): "Takrorlayman" — ertaga yana, "Bilaman" —
 * 7 kundan keyin. Bugun chiqishi kerak bo'lgan so'zlardan bir seansda
 * dizayndagidek 12 tagacha olinadi. Har bir javob uchun +2 chaqmoq (addLightning).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoltIcon, CloseIcon, ReviewClockIcon, SpeakerIcon } from '@/components/v2/home/icons';
import { buildSession, daysAgo, loadReviews, saveReview, type ReviewRecord } from '@/components/v2/home/reviewStore';
import { displayFont } from '@/components/v2/home/shared';
import { Loading } from '@/components/v2/states/Loading';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import type { VocabWord } from '@/data/lessonContent';
import { useLang } from '@/i18n/LanguageContext';
import { addLightning } from '@/services/lightningStore';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

/** Har bir so'z uchun chaqmoq (dizayndagi "+2 har soʻz"). */
const LIGHTNING_PER_WORD = 2;

type Item = { word: VocabWord; record?: ReviewRecord };

export default function V2WordReview() {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState(0);
  const [again, setAgain] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAccumulatedVocabulary(), loadReviews()])
      .then(([words, reviews]) => {
        if (cancelled) return;
        setItems(buildSession(words, reviews));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => (router.canGoBack() ? router.back() : router.replace(R.home as Href));
  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: courseLang === 'russian' ? 'ru-RU' : 'en-US', rate: 0.9 });
  };

  if (!items && !failed) return <Loading withNav={false} />;

  const list = items ?? [];
  const total = list.length;
  const done = known + again;
  const item = list[index];
  const position = total ? Math.min(total, done + 1) : 0;
  const left = total - done;

  const answer = async (didKnow: boolean) => {
    if (!item || busy) return;
    setBusy(true);
    await saveReview(item.word.english, didKnow);
    void addLightning(LIGHTNING_PER_WORD);
    if (didKnow) setKnown((k) => k + 1);
    else setAgain((a) => a + 1);
    setIndex((i) => i + 1);
    setBusy(false);
  };

  // Uzun so'z karta kengligiga sig'ishi uchun (webda adjustsFontSizeToFit ishlamaydi):
  // 44px — dizayn o'lchami; eng uzun so'z ~250px kenglikka sig'guncha kichrayadi.
  const longest = item ? Math.max(...item.word.english.split(/\s+/).map((w) => w.replace(/\u0301/g, '').length)) : 0;
  const wordSize = Math.max(24, Math.min(44, Math.floor(250 / (Math.max(1, longest) * 0.64))));

  const ago = item?.record ? daysAgo(item.record.lastSeen) : null;
  const sourceLabel = ago === null ? 'Lugʻatimdan' : `Lugʻatimdan · ${ago === 0 ? 'bugun' : `${ago} kun oldin`}`;

  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
          <Pressable accessibilityRole="link" accessibilityLabel="Yopish" onPress={close} style={styles.close}>
            <CloseIcon />
          </Pressable>
          <View style={styles.headBody}>
            <View style={styles.headRow}>
              <Text style={styles.headText}>Takrorlash · {position} / {total}</Text>
              <View style={styles.reward}>
                <BoltIcon size={16} />
                <Text style={[styles.headText, { color: '#6A3CF0' }]}>+{LIGHTNING_PER_WORD} har soʻz</Text>
              </View>
            </View>
            <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: position }}>
              <View style={[styles.fill, { width: `${total ? (position / total) * 100 : 0}%` }]} />
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <ScrollView style={styles.cardScroll} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            <View accessibilityLabel="Soʻz kartasi" style={styles.card}>
              {item ? (
                <>
                  <View style={styles.source}>
                    <ReviewClockIcon />
                    <Text style={styles.sourceText}>{sourceLabel}</Text>
                  </View>
                  <View style={styles.imgCircle}>
                    {item.word.imageUrl ? (
                      <Image source={{ uri: item.word.imageUrl }} style={styles.img} resizeMode="contain" accessibilityLabel={item.word.translation} />
                    ) : (
                      <Ionicons name={item.word.icon} size={88} color="#2F5BFF" accessibilityElementsHidden importantForAccessibility="no" />
                    )}
                  </View>
                  <View style={styles.wordRow}>
                    <Text style={[styles.word, { fontSize: wordSize, lineHeight: wordSize, letterSpacing: -wordSize / 100 }]} numberOfLines={3}>{item.word.english}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Talaffuzni tinglash" onPress={() => speak(item.word.english)} style={({ pressed }) => [styles.speak, pressed && { opacity: 0.8 }]}>
                      <SpeakerIcon />
                    </Pressable>
                  </View>
                  {!!item.word.transcript && <Text style={styles.transcript}>{item.word.transcript}</Text>}
                  <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.dividerText}>Javob</Text>
                    <View style={styles.line} />
                  </View>
                  <Text style={[styles.translation, { fontFamily: displayFont(item.word.translation) }]}>{item.word.translation}</Text>
                  {!!item.word.exampleSentence && (
                    <View style={styles.example}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.exampleText}>{item.word.exampleSentence}</Text>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel="Misolni tinglash" onPress={() => speak(item.word.exampleSentence!)} style={({ pressed }) => [styles.exampleBtn, pressed && { opacity: 0.8 }]}>
                        <SpeakerIcon size={20} />
                      </Pressable>
                    </View>
                  )}
                </>
              ) : (
                // Bo'sh holat: lug'at bo'sh, yuklab bo'lmadi yoki bugungi so'zlar tugadi.
                <Text style={styles.muted}>
                  {failed
                    ? 'Soʻzlarni yuklab boʻlmadi.'
                    : total
                      ? 'Bugungi takrorlash tugadi.'
                      : 'Hozircha takrorlanadigan soʻz yoʻq.'}
                </Text>
              )}
            </View>
          </ScrollView>

          <View accessibilityLabel="Takrorlash holati" style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: '#E3F7EE' }]}>
              <Text style={[styles.statNum, { color: '#075E3A' }]}>{known}</Text>
              <Text style={[styles.statLabel, { color: '#075E3A' }]}>bilaman</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: '#FFF1E6' }]}>
              <Text style={[styles.statNum, { color: '#9A3D00' }]}>{again}</Text>
              <Text style={[styles.statLabel, { color: '#9A3D00' }]}>takrorlayman</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: '#FFFFFF' }]}>
              <Text style={[styles.statNum, { color: '#0B1220' }]}>{left}</Text>
              <Text style={[styles.statLabel, { color: '#4A5468' }]}>qoldi</Text>
            </View>
          </View>
        </View>

        <View style={[styles.actions, { paddingBottom: Math.max(34, insets.bottom + 14) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Takrorlayman — ertaga yana chiqadi"
            accessibilityState={{ disabled: !item }}
            disabled={!item}
            onPress={() => answer(false)}
            style={({ pressed }) => [styles.btn, styles.again, pressed && { backgroundColor: '#FFF1E6' }, !item && styles.disabled]}
          >
            <Text style={[styles.btnText, { color: '#9A3D00' }]}>Takrorlayman</Text>
            <Text style={[styles.btnSub, { color: '#9A3D00' }]}>ertaga yana</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bilaman — 7 kundan keyin"
            accessibilityState={{ disabled: !item }}
            disabled={!item}
            onPress={() => answer(true)}
            style={({ pressed }) => [styles.btn, styles.know, pressed && { backgroundColor: '#075E3A' }, !item && styles.disabled]}
          >
            <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Bilaman</Text>
            <Text style={[styles.btnSub, { color: '#E3F7EE' }]}>7 kundan keyin</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headBody: { flex: 1, gap: 6 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between' },
  headText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E2E6EE', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#7C4DFF' },
  body: { flex: 1, paddingTop: 16, paddingHorizontal: 20, gap: 12 },
  cardScroll: { flex: 1, borderRadius: 28 },
  card: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 10px 30px rgba(11,18,32,0.06)',
  } as object,
  source: {
    position: 'absolute',
    left: 16,
    top: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF1E6',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  sourceText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#9A3D00', fontWeight: 'normal' },
  imgCircle: { width: 176, height: 176, borderRadius: 88, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  img: { width: 144, height: 144 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2, maxWidth: '100%' },
  word: { fontFamily: fonts.bodyHeavy, fontSize: 44, lineHeight: 48, letterSpacing: -0.44, color: '#0B1220', fontWeight: 'normal', flexShrink: 1, textAlign: 'center' },
  speak: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  transcript: { fontFamily: fonts.bodyBold, fontSize: 17, color: '#4A5468', fontWeight: 'normal' },
  divider: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: '#E2E6EE' },
  dividerText: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: '#5B6478', fontWeight: 'normal' },
  translation: { fontSize: 26, lineHeight: 26, color: '#5A2FD6', textAlign: 'center', fontWeight: 'normal' },
  example: { marginTop: 4, width: '100%', backgroundColor: '#F4F6FA', borderRadius: 18, paddingVertical: 11, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exampleText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#0B1220', fontWeight: 'normal' },
  exampleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  muted: { fontFamily: fonts.body, fontSize: 15, color: '#4A5468', textAlign: 'center', fontWeight: 'normal' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, gap: 1 },
  statNum: { fontFamily: fonts.bodyHeavy, fontSize: 18, fontWeight: 'normal' },
  statLabel: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: 'normal' },
  actions: { paddingTop: 14, paddingHorizontal: 20, flexDirection: 'row', gap: 10 },
  btn: { flex: 1, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 1 },
  again: { borderWidth: 2, borderColor: '#FFD2B0', backgroundColor: '#FFFFFF' },
  know: { backgroundColor: '#087A4A', boxShadow: '0 5px 0 #075E3A' } as object,
  disabled: { opacity: 0.5 },
  btnText: { fontFamily: fonts.bodyHeavy, fontSize: 16, lineHeight: 17.6, fontWeight: 'normal' },
  btnSub: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 13.2, fontWeight: 'normal' },
});
