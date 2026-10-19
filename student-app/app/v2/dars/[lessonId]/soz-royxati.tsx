/**
 * v2 Darsning so'zlari (dizayn: 14 · WordList).
 *
 * So'zlar — Vocab ekranidagi kabi getResolvedLessonContent'dan; rasm —
 * CRM'dagi imageUrl, bo'lmasa so'z ikonkasi. "O'rganildi" belgisi: so'zlar
 * qadami bajarilgan bo'lsa hammasi, aks holda kartasi ochilgan so'zlar
 * (learnedWordIds). So'zga bosilsa — shu so'zdan kartalar (Vocab ?w=).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { learnedWordIds, useSeenWords } from '@/components/v2/lessons/data';
import { CheckAlt, SpeakerSmallIcon } from '@/components/v2/lessons/icons';
import { BottomBar, Center, Column, HeaderButton } from '@/components/v2/lessons/parts';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type LessonContent } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import { useLessonProgress } from '@/services/lessonProgressStore';

// Kartochka rasm foni — dizayndagi tartibda aylanadi.
const TILE_BG = ['#E8EEFF', '#FFF4D1', '#F0EBFF', '#FFF1E6', '#E3F7EE', '#FDECEC'];

// Ikki ustunli to'r: [[0,1],[2,3],...].
const pairs = (n: number) => Array.from({ length: Math.ceil(n / 2) }, (_, r) => (r * 2 + 1 < n ? [r * 2, r * 2 + 1] : [r * 2]));

export default function WordListScreen() {
  const insets = useSafeAreaInsets();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const id = String(lessonId);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [info, setInfo] = useState<{ number: number; isVideo: boolean } | null>(null);
  const [error, setError] = useState(false);
  const seen = useSeenWords(id);
  useLessonProgress(id); // so'zlar qadami o'zgarsa qayta chiziladi

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then(async (mc) => {
        const l = mc.lessons.find((x) => x.id === id);
        const idx = l ? mc.lessons.filter((x) => x.courseId === l.courseId).findIndex((x) => x.id === id) : 0;
        const c = await getResolvedLessonContent(id, Math.max(0, idx));
        if (cancelled) return;
        setInfo({ number: idx + 1, isVideo: idx % 2 === 0 });
        setContent(c);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const words = content?.vocabulary ?? [];
  const learned = learnedWordIds(
    id,
    words.map((w) => w.id),
    seen,
  );
  const open = (i: number) => router.push(`${R.vocab(id)}?w=${i}` as Href);

  return (
    <View style={styles.screen}>
      <Column>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
          <HeaderButton kind="back" label="Orqaga" fallback={R.lesson(id)} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.over}>{info ? `${info.number}-dars · ${info.isVideo ? 'Videodars' : 'Jonli dars'}` : ' '}</Text>
            <Text accessibilityRole="header" style={styles.h1}>
              Yangi soʻzlar
            </Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {learned.size} / {words.length} oʻrganildi
            </Text>
          </View>
        </View>
        <Text style={styles.hint}>Soʻzga bosing — rasm, talaffuz va misol gap bilan karta ochiladi.</Text>
        {!content || !words.length ? (
          <Center>
            <Text style={styles.muted}>{error ? 'Soʻzlarni yuklab boʻlmadi.' : content ? 'Bu darsga hali soʻz qoʻshilmagan.' : 'Yuklanmoqda…'}</Text>
          </Center>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {pairs(words.length).map((row) => (
              <View key={row[0]} style={styles.gridRow}>
                {row.map((i) => {
                  const w = words[i];
                  return (
                    <Pressable
                      key={w.id}
                      accessibilityRole="link"
                      accessibilityLabel={`${w.english} — ${w.translation}${learned.has(w.id) ? ', oʻrganildi' : ''}`}
                      onPress={() => open(i)}
                      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
                    >
                      <View style={[styles.img, { backgroundColor: TILE_BG[i % TILE_BG.length] }]}>
                        {w.imageUrl ? (
                          <Image source={{ uri: w.imageUrl }} style={{ width: 78, height: 78 }} resizeMode="contain" />
                        ) : (
                          <Ionicons name={w.icon} size={48} color="#FF7A1A" accessibilityElementsHidden />
                        )}
                      </View>
                      {learned.has(w.id) && (
                        <View style={styles.badge}>
                          <CheckAlt size={12} strokeWidth={3.4} />
                        </View>
                      )}
                      <View style={styles.row}>
                        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                          <Text style={styles.word} numberOfLines={1}>
                            {w.english}
                          </Text>
                          <Text style={styles.tr}>{w.translation}</Text>
                        </View>
                        <View style={styles.speak} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                          <SpeakerSmallIcon />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
                {row.length === 1 && <View style={{ flex: 1 }} />}
              </View>
            ))}
          </ScrollView>
        )}
        <BottomBar style={styles.btns}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(R.wordReview as Href)}
            style={({ pressed }) => [styles.second, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.secondText}>Takrorlash</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => open(0)} style={({ pressed }) => [styles.primary, pressed && { backgroundColor: '#1E3FD1' }]}>
            <Text style={styles.primaryText}>Kartalarni ochish</Text>
          </Pressable>
        </BottomBar>
      </Column>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  over: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 17.8, color: '#4A5468', fontWeight: 'normal' },
  h1: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28.8, letterSpacing: -0.48, color: '#0B1220', fontWeight: 'normal' },
  pill: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#E3F7EE', justifyContent: 'center' },
  pillText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#075E3A', fontWeight: 'normal' },
  hint: { paddingTop: 12, paddingHorizontal: 20, fontFamily: fonts.body, fontSize: 14, lineHeight: 19.6, color: '#4A5468', fontWeight: 'normal' },
  muted: { fontFamily: fonts.body, fontSize: 14, color: '#4A5468', textAlign: 'center' },
  grid: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, minWidth: 0, position: 'relative', backgroundColor: '#FFFFFF', borderRadius: 20, paddingTop: 8, paddingHorizontal: 8, paddingBottom: 10, gap: 6 },
  img: { height: 92, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 12, top: 12, width: 20, height: 20, borderRadius: 10, backgroundColor: '#087A4A', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  word: { fontFamily: fonts.bodyHeavy, fontSize: 17, lineHeight: 23, color: '#0B1220', fontWeight: 'normal' },
  tr: { fontFamily: fonts.body, fontSize: 13, lineHeight: 16.25, color: '#4A5468', fontWeight: 'normal' },
  speak: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  btns: { flexDirection: 'row', gap: 10, backgroundColor: '#F4F6FA' },
  second: { flex: 1, height: 56, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  secondText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#0B1220', fontWeight: 'normal' },
  primary: { flex: 1, height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 0 #1E3FD1' } as object,
  primaryText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#FFFFFF', fontWeight: 'normal' },
});
