/**
 * v2 Yangi so'zlar (dizayn: 09 Vocab) — so'z kartasi.
 *
 * So'zlar eski vocabulary/list.tsx'dagi kabi getResolvedLessonContent'dan.
 * Ekran ochilganda eski ro'yxat ekrani kabi markDone('vocabList') qo'yiladi.
 * Ochilgan har karta qurilmada "ko'rildi" deb belgilanadi (markWordSeen);
 * darsning hamma so'zi ko'rilgach so'zlar qadami bajariladi (vocabPractice) —
 * yangi dizaynda alohida mashq ekrani yo'q, "Keyingi so'z" bilan aylanadi.
 * ?w=<raqam> — ro'yxatda bosilgan so'zdan boshlash.
 * So'z turkumi/rod va misol tarjimasi serverda yo'q — ko'rsatilmaydi.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedFill, FadeInUp } from '@/components/v2/motion';
import { playSfx } from '@/services/sfx';

import { learnedWordIds, markWordSeen, useSeenWords } from '@/components/v2/lessons/data';
import { ArrowRight, SpeakerIcon } from '@/components/v2/lessons/icons';
import { BottomBar, Center, Column, HeaderButton } from '@/components/v2/lessons/parts';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type LessonContent, type VocabWord } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import { getCategoryProgress, markDone, useLessonProgress } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';
import { DVocab } from '@/components/v2/desktop/lessons/DVocab';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

// Kompyuterda (keng web oyna) — DVocab dizayni; telefonda mobil ekran o'zgarishsiz.
export default function VocabScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  return useIsDesktop() ? <DVocab id={String(lessonId)} /> : <VocabScreenMobile />;
}

function VocabScreenMobile() {
  const insets = useSafeAreaInsets();
  const { lessonId, w } = useLocalSearchParams<{ lessonId: string; w?: string }>();
  const id = String(lessonId);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [number, setNumber] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [idx, setIdx] = useState(() => Math.max(0, Number(w) || 0));
  const seen = useSeenWords(id);
  useLessonProgress(id); // so'zlar qadami bajarilsa qayta chiziladi

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then(async (mc) => {
        const lesson = mc.lessons.find((l) => l.id === id);
        const i = lesson ? mc.lessons.filter((l) => l.courseId === lesson.courseId).findIndex((l) => l.id === id) : 0;
        const c = await getResolvedLessonContent(id, Math.max(0, i));
        if (cancelled) return;
        setNumber(i + 1);
        setContent(c);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    markDone(id, 'vocabList');
    saveLastPosition({ lessonId: id, section: 'vocabulary/list', label: "So'zlar" });
  }, [id]);

  const words = content?.vocabulary ?? [];
  const total = words.length;
  const cur = total ? Math.min(idx, total - 1) : 0;
  const word: VocabWord | undefined = words[cur];
  const learned = learnedWordIds(id, words.map((x) => x.id), seen);
  const reviewing = getCategoryProgress(id, 'vocabulary') >= 100;
  const position = total ? cur + 1 : 0;
  const speechLang = content?.lang === 'russian' ? 'ru-RU' : 'en-US';
  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: speechLang, rate: 0.9 });
  };

  // Karta ochildi — "ko'rildi"; hammasi ko'rilsa so'zlar qadami bajariladi.
  useEffect(() => {
    if (!word) return;
    markWordSeen(id, word.id);
    const all = new Set([...seen, word.id]);
    if (total && words.every((x) => all.has(x.id)) && getCategoryProgress(id, 'vocabulary') < 100) {
      markDone(id, 'vocabPractice');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word?.id, id]);

  const nextIdx = total ? (cur + 1) % total : 0;

  const header = (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
      <HeaderButton kind="close" label="Yopish" fallback={R.wordList(id)} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.headRow}>
          <Text style={styles.headText}>Yangi soʻzlar{number ? ` · ${number}-dars` : ''}</Text>
          <Text style={[styles.headText, { color: '#087A4A' }]}>{position} / {total}{reviewing ? ' · takrorlash' : ''}</Text>
        </View>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel={`Takrorlash: ${total} tadan ${position}-soʻz`}
          accessibilityValue={{ min: 0, max: total, now: position }}
        >
          <AnimatedFill pct={total ? (position / total) * 100 : 0} color="#12A06B" height={8} radius={4} />
        </View>
      </View>
    </View>
  );

  if (!content || !word) {
    return (
      <View style={styles.screen}>
        <Column>
          {header}
          <Center>
            <Text style={styles.muted}>
              {error ? 'Soʻzlarni yuklab boʻlmadi.' : content ? 'Bu darsga hali soʻz qoʻshilmagan.' : 'Yuklanmoqda…'}
            </Text>
          </Center>
        </Column>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Column>
        {header}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FadeInUp key={idx} distance={8} duration={260} style={{ flex: 1 }}>
          <View style={styles.card}>
            <View style={styles.imgCircle}>
              {word.imageUrl ? (
                <Image source={{ uri: word.imageUrl }} style={{ width: 168, height: 168 }} resizeMode="contain" accessibilityLabel={word.translation} />
              ) : (
                <Ionicons name={word.icon} size={96} color="#FF7A1A" accessibilityElementsHidden />
              )}
            </View>
            <View style={styles.wordRow}>
              <Text style={styles.word} adjustsFontSizeToFit numberOfLines={2}>{word.english}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Talaffuzni tinglash" onPress={() => speak(word.english)} style={({ pressed }) => [styles.speak, pressed && { opacity: 0.8 }]}>
                <SpeakerIcon />
              </Pressable>
            </View>
            {!!word.transcript && <Text style={styles.transcript}>{word.transcript}</Text>}
            <Text style={styles.translation}>{word.translation}</Text>
            {!!word.exampleSentence && (
              <View style={styles.example}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.exampleRu}>{word.exampleSentence}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Misolni tinglash" onPress={() => speak(word.exampleSentence!)} style={({ pressed }) => [styles.exampleBtn, pressed && { opacity: 0.8 }]}>
                  <SpeakerIcon size={20} />
                </Pressable>
              </View>
            )}
          </View>
          </FadeInUp>
          <View accessibilityLabel={`${number ?? ''}-dars soʻzlari: ${learned.size} / ${total} oʻrganilgan`} style={styles.chips}>
            {words.map((x, i) => {
              const isCur = i === cur;
              const isKnown = learned.has(x.id);
              return (
                <View key={x.id} style={[styles.chip, { backgroundColor: isCur ? '#7C4DFF' : isKnown ? '#E3F7EE' : '#E7EBF3' }]}>
                  <Text style={[styles.chipText, { color: isCur ? '#FFFFFF' : isKnown ? '#075E3A' : '#4A5468' }]} numberOfLines={1}>{x.english}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
        <BottomBar style={styles.btns}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Keyingi soʻz: ${words[nextIdx]?.english ?? ''}`}
            onPress={() => {
              playSfx('flip');
              setIdx(nextIdx);
            }}
            style={({ pressed }) => [styles.again, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.againText}>Keyingi soʻz</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push(R.audioDialog(id) as Href)} style={({ pressed }) => [styles.know, pressed && { backgroundColor: '#1E3FD1' }]}>
            <Text style={styles.knowText}>Dialoglarga</Text>
            <ArrowRight />
          </Pressable>
        </BottomBar>
      </Column>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between' },
  headText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E2E6EE', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#12A06B' },
  muted: { fontFamily: fonts.body, fontSize: 14, color: '#4A5468', textAlign: 'center' },
  content: { flexGrow: 1, paddingTop: 18, paddingHorizontal: 20, gap: 14 },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: '0 10px 30px rgba(11,18,32,0.06)',
  } as object,
  imgCircle: { width: 210, height: 210, borderRadius: 105, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center' },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, maxWidth: '100%' },
  word: { fontFamily: fonts.bodyHeavy, fontSize: 46, lineHeight: 50, letterSpacing: -0.46, color: '#0B1220', fontWeight: 'normal', flexShrink: 1, textAlign: 'center' },
  speak: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  transcript: { fontFamily: fonts.bodyBold, fontSize: 17, color: '#4A5468', fontWeight: 'normal' },
  translation: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: '#5A2FD6', fontWeight: 'normal', textAlign: 'center' },
  example: { marginTop: 10, width: '100%', backgroundColor: '#F4F6FA', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exampleRu: { fontFamily: fonts.bodyHeavy, fontSize: 17, lineHeight: 23, color: '#0B1220', fontWeight: 'normal' },
  exampleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: { height: 28, paddingHorizontal: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 3 },
  chipText: { fontFamily: fonts.bodyHeavy, fontSize: 12, fontWeight: 'normal' },
  btns: { paddingTop: 14, flexDirection: 'row', gap: 10 },
  // Dizayndagi <button> brauzerning standart 6px yon paddingi bilan chiziladi (eni 158 : 182) — shu aynan takrorlanadi.
  again: { flexGrow: 1, flexBasis: 12, paddingHorizontal: 6, height: 56, borderRadius: 18, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  againText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#0B1220', fontWeight: 'normal' },
  know: { flexGrow: 1.25, flexBasis: 0, height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 5px 0 #1E3FD1' } as object,
  knowText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#FFFFFF', fontWeight: 'normal' },
});
