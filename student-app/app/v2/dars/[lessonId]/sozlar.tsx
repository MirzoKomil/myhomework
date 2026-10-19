/**
 * v2 Yangi so'zlar (dizayn: 09 Vocab) — kartochkalar.
 *
 * So'zlar eski vocabulary/list.tsx'dagi kabi getResolvedLessonContent'dan.
 * Ekran ochilganda eski ro'yxat ekrani kabi markDone('vocabList') qo'yiladi.
 * "Bildim" — keyingi so'z; "Yana ko'rsat" — so'z navbat oxiriga qaytadi.
 * Hamma so'z bilingach eski 3 bosqichli mashqqa (vocabulary/practice)
 * o'tiladi — vocabPractice belgisi faqat o'sha yerda qo'yiladi (eski ilova bilan bir xil).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowRight, SpeakerIcon } from '@/components/v2/lessons/icons';
import { BottomBar, Center, Column, HeaderButton } from '@/components/v2/lessons/parts';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type LessonContent, type VocabWord } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import { markDone } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';

export default function VocabScreen() {
  const insets = useSafeAreaInsets();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const id = String(lessonId);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [number, setNumber] = useState<number | null>(null);
  const [error, setError] = useState(false);
  // Navbat: hali "bildim" deyilmagan so'zlar (indekslar).
  const [queue, setQueue] = useState<number[]>([]);
  const [known, setKnown] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then(async (mc) => {
        const lesson = mc.lessons.find((l) => l.id === id);
        const idx = lesson ? mc.lessons.filter((l) => l.courseId === lesson.courseId).findIndex((l) => l.id === id) : 0;
        const c = await getResolvedLessonContent(id, Math.max(0, idx));
        if (cancelled) return;
        setNumber(idx + 1);
        setContent(c);
        setQueue(c.vocabulary.map((_, i) => i));
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
  const curIdx = queue[0];
  const word: VocabWord | undefined = curIdx !== undefined ? words[curIdx] : undefined;
  const position = Math.min(total, known.size + 1);
  const speechLang = content?.lang === 'russian' ? 'ru-RU' : 'en-US';
  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: speechLang, rate: 0.9 });
  };

  // Pastdagi so'zlar qatori: joriy so'z atrofidagi 4 ta so'z va "…".
  const chips = useMemo(() => {
    if (!total || curIdx === undefined) return [] as number[];
    const start = Math.max(0, Math.min(curIdx - 2, total - 4));
    return Array.from({ length: Math.min(4, total) }, (_, k) => start + k);
  }, [curIdx, total]);

  const next = (didKnow: boolean) => {
    if (curIdx === undefined) return;
    const rest = queue.slice(1);
    if (didKnow) {
      const k = new Set(known);
      k.add(curIdx);
      setKnown(k);
      if (!rest.length) {
        // Hamma so'z ko'rildi — eski mashq ekraniga (vocabPractice o'sha yerda belgilanadi).
        router.replace(`/homework/lesson/${id}/vocabulary/practice` as Href);
        return;
      }
      setQueue(rest);
    } else {
      setQueue(rest.length ? [...rest, curIdx] : [curIdx]);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <HeaderButton kind="close" label="Yopish" fallback={R.lesson(id)} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.headRow}>
          <Text style={styles.headText}>Yangi soʻzlar{number ? ` · ${number}-dars` : ''}</Text>
          <Text style={styles.headText}>{total ? `${position} / ${total}` : '0 / 0'}</Text>
        </View>
        <View style={styles.track} accessibilityLabel={`${position} / ${total}`}>
          <View style={[styles.fill, { width: `${total ? (position / total) * 100 : 0}%` }]} />
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
          <View accessibilityLabel="Soʻzlar" style={styles.chips}>
            {chips.map((i) => {
              const isCur = i === curIdx;
              const isKnown = known.has(i);
              return (
                <View key={i} style={[styles.chip, { backgroundColor: isCur ? '#7C4DFF' : isKnown ? '#E3F7EE' : '#E7EBF3' }]}>
                  <Text style={[styles.chipText, { color: isCur ? '#FFFFFF' : isKnown ? '#075E3A' : '#4A5468' }]} numberOfLines={1}>{words[i].english}</Text>
                </View>
              );
            })}
            {total > chips.length && (
              <View style={[styles.chip, { backgroundColor: '#E7EBF3' }]}>
                <Text style={[styles.chipText, { color: '#4A5468' }]}>…</Text>
              </View>
            )}
          </View>
        </ScrollView>
        <BottomBar style={styles.btns}>
          <Pressable accessibilityRole="button" onPress={() => next(false)} style={({ pressed }) => [styles.again, pressed && { opacity: 0.85 }]}>
            <Text style={styles.againText}>Yana koʻrsat</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => next(true)} style={({ pressed }) => [styles.know, pressed && { backgroundColor: '#5A2FD6' }]}>
            <Text style={styles.knowText}>Bildim</Text>
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
  fill: { height: 8, borderRadius: 4, backgroundColor: '#7C4DFF' },
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
  chips: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  chip: { height: 28, paddingHorizontal: 9, borderRadius: 10, justifyContent: 'center', flexShrink: 1 },
  chipText: { fontFamily: fonts.bodyHeavy, fontSize: 12, fontWeight: 'normal' },
  btns: { paddingTop: 14, flexDirection: 'row', gap: 10 },
  again: { flex: 1, height: 56, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  againText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#0B1220', fontWeight: 'normal' },
  know: { flex: 1, height: 56, borderRadius: 18, backgroundColor: '#7C4DFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 5px 0 #5A2FD6' } as object,
  knowText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#FFFFFF', fontWeight: 'normal' },
});
