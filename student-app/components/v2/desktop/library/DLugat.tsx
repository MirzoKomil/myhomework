/**
 * Kompyuter: Lugʻatim (dizayn: D_Lugat.dc.html).
 *
 * Ma'lumot mobil lugat.tsx bilan aynan bir xil: shaxsiy lug'at (getMyWords —
 * Tarjimon, Qidiruv va Audiohikoyadan qo'shilgan so'zlar), dars lug'atlari bilan
 * solishtirish (transkripsiya, rasm, "N-dars"), xatolar soni — useMistakeCount.
 * Takrorlash jadvali saqlanmaydi — "bugun 0 tasi", "Bugun 0 ta soʻz", tugmada 0.
 * Avval 9 ta so'z, qolgani "Yana N ta soʻz" bosilganda. Klaviatura: "/" — qidiruv.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { getMyWords, loadCurrentLesson, plainWord, useMistakeCount, type MyWord } from '@/components/v2/practice/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getResolvedLessonContent, type VocabWord } from '@/data/lessonContent';
import { useLang } from '@/i18n/LanguageContext';
import { fetchMobileContent } from '@/services/contentApi';

import { DesktopPage, Kbd } from '../Shell';
import { useDesktopKeys } from '../useDesktop';
import { IChevron, IRepeat, ISearch, ISpeaker, Over, T } from './ui';

// Takrorlash jadvali saqlanmaydi — 0 holat (mobil bilan bir xil).
const DUE_TODAY = 0;
const BOX_BG = ['#FFF4D1', '#E8EEFF', '#FFF1E6', '#E3F7EE'];
const FIRST = 9;

type LessonWord = { lesson: number; word: VocabWord };
type Row = {
  key: string;
  word: string;
  transcript?: string;
  translation?: string;
  chip?: 'lesson' | 'translator' | 'story';
  lesson?: number;
  image?: string;
  icon?: VocabWord['icon'];
};

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

export function DLugat() {
  const { courseLang } = useLang();
  const MISTAKES = useMistakeCount();
  const [words, setWords] = useState<MyWord[]>([]);
  const [index, setIndex] = useState<Map<string, LessonWord>>(new Map());
  const [query, setQuery] = useState('');
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const searchRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      getMyWords().then(setWords);
    }, []),
  );
  useEffect(() => {
    loadLessonIndex()
      .then(setIndex)
      .catch(() => {});
    loadCurrentLesson()
      .then((l) => setLessonId(l?.id ?? null))
      .catch(() => {});
  }, []);

  const rows: Row[] = useMemo(
    () =>
      words.map((w) => {
        const m = index.get(plainWord(w.word).trim().toLowerCase());
        const source = w.source;
        return {
          key: w.word,
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
  const visible = q ? rows.filter((r) => plainWord(r.word).toLowerCase().includes(q) || (r.translation ?? '').toLowerCase().includes(q)) : rows;
  const shown = all || q ? visible : visible.slice(0, FIRST);
  const more = visible.length - shown.length;

  const openMistakes = () => router.push((lessonId ? R.mistakes(lessonId) : R.path) as never);
  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(plainWord(text), { language: courseLang === 'russian' ? 'ru-RU' : 'en-US', rate: 0.9 });
  };

  useDesktopKeys({ '/': () => searchRef.current?.focus() });

  return (
    <DesktopPage title="Lugʻatim" subtitle={`Saqlangan soʻzlar · bugun ${DUE_TODAY} tasi takrorlanadi`} back={R.practice} scroll={false} contentStyle={{ paddingBottom: 32 }}>
      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: 24 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View accessibilityRole="tablist" accessibilityLabel="Lugʻat boʻlimlari" style={s.tabs}>
              <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={[s.tab, s.tabOn]}>
                <T size={15}>Soʻzlarim</T>
                <View style={[s.count, { backgroundColor: '#2F5BFF' }]}>
                  <T size={13} color="#FFFFFF">
                    {words.length}
                  </T>
                </View>
              </View>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: false }} onPress={openMistakes} style={s.tab}>
                <T w={700} size={15} color="#34405A">
                  Xatolarim
                </T>
                <View style={[s.count, { backgroundColor: '#FDECEC' }]}>
                  <T size={13} color="#B42318">
                    {MISTAKES}
                  </T>
                </View>
              </Pressable>
            </View>
            <View style={s.search}>
              <ISearch color="#4A5468" sw={2.3} />
              <TextInput
                ref={searchRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Soʻz yoki tarjima qidirish"
                placeholderTextColor="#6B7489"
                accessibilityLabel="Lugʻatdan qidirish"
                style={s.searchInput}
              />
              <Kbd>/</Kbd>
            </View>
          </View>

          <Pressable accessibilityRole="link" onPress={openMistakes} style={({ pressed }) => [s.mistake, pressed && { opacity: 0.85 }]}>
            <View style={s.mistakeIcon}>
              <IRepeat />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <T size={16}>Bugungi {MISTAKES} ta xatoni takrorlash</T>
              <T w={600} size={14} color="#8A1C12">
                Vazifa tugagach xatolar soni yangilanadi
              </T>
            </View>
            <IChevron size={18} color="#B42318" />
          </Pressable>

          <View style={s.listHead}>
            <Over>Oxirgi qoʻshilganlar</Over>
            <T size={14} color="#34405A">
              {visible.length} ta
            </T>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
            {visible.length === 0 ? (
              <View style={s.empty}>
                <T w={600} size={15} color="#4A5468" style={{ textAlign: 'center' }}>
                  {q ? 'Hech narsa topilmadi.' : 'Hali soʻz saqlanmagan. Tarjimon yoki qidiruvdan soʻzni lugʻatga qoʻshing.'}
                </T>
              </View>
            ) : (
              shown.map((r, i) => (
                <View key={r.key} style={s.card}>
                  <View style={[s.box, { backgroundColor: BOX_BG[i % BOX_BG.length] }]}>
                    {r.image ? (
                      <Image source={{ uri: r.image }} style={{ width: 62, height: 62 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
                    ) : (
                      <Ionicons name={r.icon ?? 'book-outline'} size={32} color="#1E3FD1" />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
                      <T size={18} lines={1} style={{ flexShrink: 0, maxWidth: '100%' }}>
                        {r.word}
                      </T>
                      {!!r.transcript && (
                        <T w={600} size={14} color="#4A5468" lines={1} style={{ flexShrink: 1 }}>
                          [{r.transcript.replace(/^\[|\]$/g, '')}]
                        </T>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {!!r.translation && (
                        <T w={600} size={14} color="#34405A" lines={1} style={{ flexShrink: 1 }}>
                          {r.translation}
                        </T>
                      )}
                      {r.chip === 'lesson' ? (
                        <Chip bg="#E8EEFF" fg="#1E3FD1">{`${r.lesson}-dars`}</Chip>
                      ) : r.chip === 'story' ? (
                        <Chip bg="#FFF4D1" fg="#7A5300">
                          Audiohikoya
                        </Chip>
                      ) : r.chip === 'translator' ? (
                        <Chip bg="#F0EBFF" fg="#6A3CF0">
                          Tarjimon
                        </Chip>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Tinglash: ${plainWord(r.word)}`}
                    onPress={() => speak(r.word)}
                    style={({ pressed }) => [s.speak, pressed && { opacity: 0.75 }]}
                  >
                    <ISpeaker size={19} color="#2F5BFF" />
                  </Pressable>
                </View>
              ))
            )}
            {more > 0 && (
              <Pressable accessibilityRole="button" onPress={() => setAll(true)} style={s.more}>
                <T size={15} color="#4A5468">
                  Yana {more} ta soʻz
                </T>
              </Pressable>
            )}
            {shown.length > 0 && (shown.length + (more > 0 ? 1 : 0)) % 2 === 1 && <View style={[s.card, { height: 0, backgroundColor: 'transparent' }]} />}
          </ScrollView>
        </View>

        <View style={{ width: 320, flexShrink: 0, gap: 16 }}>
          <View style={s.review}>
            <View pointerEvents="none" style={s.reviewCircle} />
            <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={designImages['f7ed25f8b468b4cb6172a58adcd09f1f']}
                style={{ width: 170, height: 170 }}
                resizeMode="contain"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>
            <View style={{ gap: 4 }}>
              <T f="display" size={26} lh={28.6} ls={-0.52} color="#FFFFFF">
                Bugun {DUE_TODAY} ta soʻz
              </T>
              <T w={700} size={15} color="#FFFFFF">
                Unutmaslik uchun takrorlash vaqti keldi
              </T>
            </View>
            <Pressable accessibilityRole="link" onPress={() => router.push(R.wordReview as never)} style={({ pressed }) => [s.reviewBtn, pressed && { opacity: 0.9 }]}>
              <IRepeat size={19} color="#1E3FD1" />
              <T size={16} color="#1E3FD1">
                Takrorlashni boshlash · {DUE_TODAY}
              </T>
            </Pressable>
          </View>
          <View style={s.sources}>
            <Over color="#4A5468">Soʻzlar qayerdan qoʻshiladi</Over>
            {(
              [
                ['#2F5BFF', 'Darslar', 'Har darsning yangi soʻzlari'],
                ['#F5B70A', 'Audiohikoya', 'Matndagi soʻzga bosing'],
                ['#7C4DFF', 'Tarjimon', 'Tarjima natijasidan'],
              ] as const
            ).map(([c, t, d]) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />
                <View style={{ flex: 1 }}>
                  <T size={15}>{t}</T>
                  <T w={600} size={13} color="#4A5468">
                    {d}
                  </T>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </DesktopPage>
  );
}

function Chip({ bg, fg, children }: { bg: string; fg: string; children: string }) {
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <T size={12} color={fg} lines={1}>
        {children}
      </T>
    </View>
  );
}

const s = StyleSheet.create({
  tabs: { width: 340, flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: '#E6EAF2', flexShrink: 0 },
  tab: { flex: 1, height: 42, paddingHorizontal: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tabOn: { backgroundColor: '#FFFFFF', boxShadow: '0 2px 6px rgba(11,18,32,0.08)' } as object,
  count: { height: 24, minWidth: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  search: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 14,
  },
  searchInput: { flex: 1, minWidth: 0, height: 44, padding: 0, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 15, color: '#0B1220', outlineStyle: 'none' } as object,
  mistake: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FDECEC', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 18 },
  mistakeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 4, paddingHorizontal: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 0,
    height: 96,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  box: { width: 68, height: 68, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  chip: { height: 22, paddingHorizontal: 8, borderRadius: 7, justifyContent: 'center', flexShrink: 0 },
  speak: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  more: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 0,
    height: 96,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D5DBE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
  review: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#2F5BFF', borderRadius: 26, padding: 24, gap: 14 },
  reviewCircle: { position: 'absolute', right: -50, top: -50, width: 230, height: 230, borderRadius: 115, backgroundColor: '#4A70FF' },
  reviewBtn: {
    height: 54,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    boxShadow: '0 5px 0 #1E3FD1',
  } as object,
  sources: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 20, gap: 14 },
});
