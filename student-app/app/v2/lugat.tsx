/**
 * v2 Lug'atim (dizayn: 48 · Lugʻatim) — o'quvchining saqlangan so'zlari.
 *
 * So'zlar — Mashq sahifasidagi "Lugʻatim" plitkasi bilan bir xil manba:
 * shu qurilmadagi shaxsiy lug'at (getMyWords — Tarjimon va Qidiruvdan
 * qo'shilgan so'zlar, eng yangisi tepada). Har bir so'z dars lug'atlari
 * (mobile-content → getResolvedLessonContent) bilan solishtiriladi: topilsa
 * transkripsiya, rasm va "N-dars" belgisi chiqadi; Tarjimondan qo'shilgan
 * (tarjimasi bor) so'zga "Tarjimon" belgisi.
 * Xatolar soni — useMistakeCount (uyga vazifa natijalari). Takrorlash
 * jadvali saqlanmaydi — "bugun 0 tasi takrorlanadi", tugmada 0.
 * Manba belgisi: source 'story' → "Audiohikoya".
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMyWords, loadCurrentLesson, plainWord, useMistakeCount, type MyWord } from '@/components/v2/practice/shared';
import { BackIcon, ChevronThinIcon, MistakeRepeatIcon, ReviewIcon, SearchIcon, SpeakerIcon } from '@/components/v2/rewards/icons';
import { goBack } from '@/components/v2/rewards/parts';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type VocabWord } from '@/data/lessonContent';
import { useLang } from '@/i18n/LanguageContext';
import { fetchMobileContent } from '@/services/contentApi';

// Takrorlash jadvali saqlanmaydi — 0 holat.
const DUE_TODAY = 0;

// Rasm qutisi fonlari — dizayndagi ranglar navbat bilan.
const BOX_BG = ['#FFF4D1', '#E8EEFF', '#FFF1E6', '#E3F7EE'];

type LessonWord = { lesson: number; word: VocabWord };

/** Kurs darslaridagi barcha so'zlar: urg'usiz, kichik harfli shakl → dars raqami va so'z. */
async function loadLessonIndex(): Promise<Map<string, LessonWord>> {
  const mc = await fetchMobileContent();
  const course = mc.courses[0];
  const lessons = course ? mc.lessons.filter((l) => l.courseId === course.id) : [];
  const contents = await Promise.all(lessons.map((l, i) => getResolvedLessonContent(l.id, i).catch(() => null)));
  const map = new Map<string, LessonWord>();
  contents.forEach((c, i) => {
    c?.vocabulary.forEach((w) => {
      const key = plainWord(w.english).trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, { lesson: i + 1, word: w });
    });
  });
  return map;
}

type Row = { key: string; word: string; transcript?: string; translation?: string; chip?: 'lesson' | 'translator' | 'story'; lesson?: number; image?: string; icon?: VocabWord['icon'] };

export default function V2Lugat() {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  // Xatolar soni — uyga vazifa natijalaridan (Mashq plitkasi bilan bir xil manba).
  const MISTAKES = useMistakeCount();
  const [words, setWords] = useState<MyWord[]>([]);
  const [index, setIndex] = useState<Map<string, LessonWord>>(new Map());
  const [tab, setTab] = useState<'words' | 'mistakes'>('words');
  const [query, setQuery] = useState('');
  const [lessonId, setLessonId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getMyWords().then(setWords);
    }, []),
  );
  useEffect(() => {
    loadLessonIndex().then(setIndex).catch(() => {});
    loadCurrentLesson()
      .then((l) => setLessonId(l?.id ?? null))
      .catch(() => {});
  }, []);

  const rows: Row[] = useMemo(
    () =>
      words.map((w) => {
        const m = index.get(plainWord(w.word).trim().toLowerCase());
        // Manba (ixtiyoriy, eski yozuvlarda yo'q): 'story' — Hikoyalardan saqlangan.
        const source = w.source;
        return {
          key: w.word,
          // Dars lug'atidagi shakl (urg'u belgisi bilan), bo'lmasa saqlangani.
          word: m?.word.english ?? w.word,
          transcript: m?.word.transcript,
          translation: w.translation ?? m?.word.translation,
          chip: source === 'story' ? 'story' : m ? 'lesson' : source === 'translator' || w.translation ? 'translator' : undefined,
          lesson: m?.lesson,
          image: m?.word.imageUrl,
          icon: m?.word.icon,
        };
      }),
    [words, index],
  );

  const q = query.trim().toLowerCase();
  const visible = tab === 'words' && q ? rows.filter((r) => plainWord(r.word).toLowerCase().includes(q) || (r.translation ?? '').toLowerCase().includes(q)) : rows;

  // Xatolar ro'yxati — "Xatolar ustida ishlash" ekranida (joriy dars); bu yerda alohida ro'yxat yo'q.
  const openMistakes = () => router.push((lessonId ? R.mistakes(lessonId) : R.path) as never);

  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(plainWord(text), { language: courseLang === 'russian' ? 'ru-RU' : 'en-US', rate: 0.9 });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <View style={[styles.column, { gap: 12 }]}>
          <View style={styles.headRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" onPress={() => goBack(R.practice)} style={({ pressed }) => [styles.back, pressed && { opacity: 0.75 }]}>
              <BackIcon />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text accessibilityRole="header" style={styles.h1}>Lugʻatim</Text>
              <Text style={styles.sub} numberOfLines={1}>Saqlangan soʻzlar · bugun {DUE_TODAY} tasi takrorlanadi</Text>
            </View>
          </View>

          <View accessibilityRole="tablist" accessibilityLabel="Lugʻat boʻlimlari" style={styles.tabs}>
            {(['words', 'mistakes'] as const).map((t) => {
              const active = tab === t;
              return (
                <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => (t === 'mistakes' ? openMistakes() : setTab(t))} style={[styles.tab, active && styles.tabActive]}>
                  <Text style={[styles.tabText, active && { color: '#0B1220' }]}>{t === 'words' ? 'Soʻzlarim' : 'Xatolarim'}</Text>
                  <View style={[styles.count, t === 'words' ? { backgroundColor: '#2F5BFF' } : { backgroundColor: '#FDECEC' }]}>
                    <Text style={[styles.countText, { color: t === 'words' ? '#FFFFFF' : '#B42318' }]}>{t === 'words' ? words.length : MISTAKES}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.search}>
            <SearchIcon />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Soʻz yoki tarjima qidirish"
              placeholderTextColor="#6B7489"
              accessibilityLabel="Lugʻatdan qidirish"
              style={styles.searchInput}
            />
          </View>

          <Pressable
            accessibilityRole="link"
            onPress={openMistakes}
            style={({ pressed }) => [styles.mistake, pressed && { opacity: 0.85 }]}
          >
            <MistakeRepeatIcon />
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <Text style={styles.mistakeTitle}>Bugungi {MISTAKES} ta xatoni takrorlash</Text>
              <Text style={styles.mistakeSub}>Vazifa tugagach xatolar soni yangilanadi</Text>
            </View>
            <ChevronThinIcon color="#B42318" />
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView contentContainerStyle={styles.listWrap} showsVerticalScrollIndicator={false}>
          <View style={[styles.column, { gap: 8 }]}>
            <View style={styles.listHead}>
              <Text accessibilityRole="header" style={styles.listTitle}>{tab === 'words' ? 'Oxirgi qoʻshilganlar' : 'Xatolarim'}</Text>
              <Text style={styles.listCount}>{tab === 'words' ? visible.length : MISTAKES} ta</Text>
            </View>
            <View style={styles.card}>
              {visible.length === 0 ? (
                <Text style={styles.empty}>
                  {q ? 'Hech narsa topilmadi.' : 'Hali soʻz saqlanmagan. Tarjimon yoki qidiruvdan soʻzni lugʻatga qoʻshing.'}
                </Text>
              ) : (
                visible.map((r, i) => (
                  <View key={r.key} style={[styles.row, i < visible.length - 1 && styles.rowBorder]}>
                    <View style={[styles.box, { backgroundColor: BOX_BG[i % BOX_BG.length] }]}>
                      {r.image ? (
                        <Image source={{ uri: r.image }} style={{ width: 44, height: 44 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
                      ) : (
                        <Ionicons name={r.icon ?? 'book-outline'} size={24} color="#1E3FD1" />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <View style={styles.wordLine}>
                        <Text style={styles.word} numberOfLines={1}>{r.word}</Text>
                        {!!r.transcript && <Text style={styles.tr} numberOfLines={1}>[{r.transcript.replace(/^\[|\]$/g, '')}]</Text>}
                      </View>
                      <View style={styles.transLine}>
                        {!!r.translation && <Text style={styles.trans} numberOfLines={1}>{r.translation}</Text>}
                        {r.chip === 'lesson' ? (
                          <Text style={[styles.chip, { color: '#1E3FD1', backgroundColor: '#E8EEFF' }]}>{r.lesson}-dars</Text>
                        ) : r.chip === 'story' ? (
                          <Text style={[styles.chip, { color: '#7A5300', backgroundColor: '#FFF4D1' }]}>Audiohikoya</Text>
                        ) : r.chip === 'translator' ? (
                          <Text style={[styles.chip, { color: '#5B2FD6', backgroundColor: '#F0EBFF' }]}>Tarjimon</Text>
                        ) : null}
                      </View>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Tinglash: ${plainWord(r.word)}`} onPress={() => speak(r.word)} style={({ pressed }) => [styles.speak, pressed && { opacity: 0.75 }]}>
                      <SpeakerIcon />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>
        <LinearGradient colors={['rgba(244,246,250,0)', '#F4F6FA']} style={styles.fade} pointerEvents="none" />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 34 }]}>
        <View style={styles.column}>
          <Pressable accessibilityRole="link" onPress={() => router.push(R.wordReview as never)} style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
            <ReviewIcon />
            <Text style={styles.ctaText}>Takrorlashni boshlash · {DUE_TODAY}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  top: { paddingHorizontal: 20 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 26, lineHeight: 28.6, letterSpacing: -0.52, color: '#0B1220' },
  sub: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  tabs: { backgroundColor: '#E7EBF3', borderRadius: 16, padding: 4, flexDirection: 'row', gap: 4 },
  tab: { flex: 1, height: 44, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabActive: { backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(11,18,32,0.10)' },
  tabText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, color: '#4A5468' },
  count: { paddingVertical: 1, paddingHorizontal: 7, borderRadius: 8 },
  countText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16 },
  search: { height: 48, borderRadius: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  searchInput: { flex: 1, minWidth: 0, height: 44, padding: 0, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 15, color: '#0B1220', outlineStyle: 'none' } as never,
  mistake: { minHeight: 48, borderRadius: 16, backgroundColor: '#FDECEC', paddingVertical: 7, paddingLeft: 14, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mistakeTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, lineHeight: 19, color: '#0B1220' },
  mistakeSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#6B3A36' },
  listWrap: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 36 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  listTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, letterSpacing: 0.96, textTransform: 'uppercase', color: '#4A5468' },
  listCount: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20 },
  empty: { padding: 18, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 20, color: '#4A5468', textAlign: 'center' },
  row: { minHeight: 64, paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  box: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  wordLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6, minWidth: 0 },
  word: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#0B1220', flexShrink: 0, maxWidth: '100%' },
  tr: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, color: '#5B6478', flexShrink: 1 },
  transLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  trans: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, color: '#4A5468', flexShrink: 1 },
  chip: { flexShrink: 0, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' },
  speak: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 36 },
  bottom: { paddingTop: 10, paddingHorizontal: 20, backgroundColor: '#F4F6FA' },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 16px rgba(47, 91, 255, 0.30)' },
  ctaText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, color: '#FFFFFF' },
});
