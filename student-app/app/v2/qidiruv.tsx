/**
 * v2 Qidiruv (dizayn: 38 · SearchEmpty — "natija yo'q" holati).
 *
 * Eski ilovada qidirish mumkin bo'lgan narsalar bo'yicha qidiradi:
 * kutubxona (grammatika mavzulari, so'z to'plamlari, audio/podkastlar,
 * hikoyalar) va o'quvchi ochgan darslar lug'ati. Natija bo'lmasa dizayndagi
 * holat aynan ko'rsatiladi. Oxirgi qidiruvlar va "lug'atga qo'shish"
 * shu qurilmada saqlanadi (serverda joy yo'q); qo'shgach Lug'at ekrani ochiladi.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon, ClockIcon, CloseIcon, HeadphonesIcon, PlusIcon, SearchIcon } from '@/components/v2/practice/icons';
import {
  addMyWord,
  getMyWords,
  getRecentSearches,
  goBack,
  pushRecentSearch,
  reset,
  type RecentSearch,
} from '@/components/v2/practice/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchMobileContent } from '@/services/contentApi';
import { stripRichText } from '@/services/richText';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';
import { DSearch } from '@/components/v2/desktop/library/DSearch';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

type Item = { title: string; sub: string; meta: string; href: string; hay: string };

// Admin matnidagi belgilar (**, {qizil}…) qidiruvga xalaqit bermasin.
const norm = (s: string) => stripRichText(s).toLowerCase().replace(/ё/g, 'е').replace(/[ʻʼ'`‘’]/g, '').trim();

// Kompyuterda (keng oyna) — dizayndagi D_ versiya; telefonda mobil ekran o'zgarmaydi.
export default function SearchScreen() {
  return useIsDesktop() ? <DSearch /> : <SearchScreenMobile />;
}

function SearchScreenMobile() {
  const insets = useSafeAreaInsets();
  // ?q= — boshqa ekrandan tayyor so'rov bilan ochish uchun.
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [index, setIndex] = useState<Item[]>([]);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getRecentSearches().then(setRecent);
    (async () => {
      const items: Item[] = [];
      try {
        const mc = await fetchMobileContent();
        const lib = mc.library;
        lib.grammar.forEach((g, i) =>
          items.push({ title: g.title, sub: stripRichText(g.formula ?? ''), meta: `Grammatika · G${i + 1}`, href: R.grammar(g.id), hay: norm(`${g.title} ${g.formula ?? ''} ${g.description ?? ''}`) }),
        );
        lib.podcasts.forEach((p) =>
          items.push({ title: p.title, sub: '', meta: 'Audio', href: R.audioList, hay: norm(`${p.title} ${p.lines.map((l) => `${l.en} ${l.uz}`).join(' ')}`) }),
        );
        lib.books.forEach((b) =>
          items.push({ title: b.title, sub: stripRichText(b.description), meta: 'Hikoya', href: R.book(b.id), hay: norm(`${b.title} ${b.description}`) }),
        );
        lib.words.forEach((t) =>
          t.words.forEach((w) =>
            items.push({ title: w.en, sub: w.uz, meta: `Soʻzlar · ${t.title}`, href: R.grammarList, hay: norm(`${w.en} ${w.uz}`) }),
          ),
        );
        // Dars lug'ati: qaysi darsda kelgani bilan.
        const course = mc.courses[0];
        const lessons = course ? mc.lessons.filter((l) => l.courseId === course.id) : [];
        const vocab = await getAccumulatedVocabulary().catch(() => []);
        const lessonOf = new Map<string, number>();
        lessons.forEach((l, i) => (mc.lessonContents[l.id]?.vocabulary ?? []).forEach((v) => lessonOf.set(v.id, i)));
        vocab.forEach((v) => {
          const li = lessonOf.get(v.id) ?? 0;
          const lid = lessons[li]?.id;
          items.push({
            title: v.english,
            sub: v.translation,
            meta: `Lugʻat · ${li + 1}-dars`,
            href: lid ? R.vocab(lid) : R.path,
            hay: norm(`${v.english} ${v.translation}`),
          });
        });
      } catch {
        // Tarmoq bo'lmasa ham shaxsiy lug'at bo'yicha qidiriladi.
      }
      (await getMyWords()).forEach((w) =>
        items.push({ title: w.word, sub: w.translation ?? '', meta: 'Mening lugʻatim', href: R.search, hay: norm(`${w.word} ${w.translation ?? ''}`) }),
      );
      setIndex(items);
    })();
  }, []);

  const q = norm(query);
  const results = useMemo(() => (q ? index.filter((it) => it.hay.includes(q)).slice(0, 40) : []), [q, index]);

  // Yozish to'xtagach so'rov "oxirgi qidiruvlar"ga tushadi.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!q) return;
    saveTimer.current = setTimeout(() => {
      const first = results[0];
      pushRecentSearch({ query: query.trim(), meta: first ? first.meta : 'Natija yoʻq', href: first ? first.href : R.search }).then(() =>
        getRecentSearches().then(setRecent),
      );
    }, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, results.length]);

  const go = (href: string) => router.push(href as Href);
  const noResults = !!q && results.length === 0;

  // Yangi dizaynda bu — Lug'atga havola: so'z qo'shiladi va Lug'at ochiladi.
  const addWord = async () => {
    await addMyWord({ word: query.trim() }, 'search');
    go(R.lugat);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <View style={styles.headRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" onPress={() => goBack()} style={styles.back}>
            <BackIcon />
          </Pressable>
          <View style={styles.field}>
            <SearchIcon size={20} color="#2F5BFF" strokeWidth={2.2} />
            <TextInput
              accessibilityLabel="Mashqdan qidirish"
              value={query}
              onChangeText={setQuery}
              placeholder="Qidirish"
              placeholderTextColor="#9AA4BC"
              autoFocus={Platform.OS === 'web'}
              autoCapitalize="none"
              returnKeyType="search"
              style={styles.input}
            />
            {!!query && (
              <Pressable accessibilityRole="button" accessibilityLabel="Tozalash" onPress={() => setQuery('')} style={styles.clear}>
                <View style={styles.clearDot}>
                  <CloseIcon size={12} color="#4A5468" strokeWidth={3.4} />
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 24) }]} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          {q && results.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.h2}>NATIJALAR · {results.length}</Text>
              <View style={styles.list}>
                {results.map((r, i) => (
                  <Pressable
                    key={`${r.meta}-${r.title}-${i}`}
                    accessibilityRole="link"
                    onPress={() => go(r.href)}
                    style={[styles.row, i < results.length - 1 && styles.divider]}
                  >
                    <SearchIcon size={18} color="#5B6478" strokeWidth={2.2} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{r.title}</Text>
                      {!!r.sub && <Text style={styles.rowMeta} numberOfLines={1}>{r.sub}</Text>}
                    </View>
                    <Text style={styles.rowMeta} numberOfLines={1}>{r.meta}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <>
              {noResults && (
                <View style={styles.empty}>
                  <View style={styles.mascotRing}>
                    <Image
                      source={(designImages as Record<string, ImageSourcePropType>)['cc0d95446730f059d25d989e2c9845ad']}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      style={styles.mascot}
                      resizeMode="contain"
                    />
                  </View>
                  <Text accessibilityRole="header" style={styles.h1}>Hech narsa topilmadi</Text>
                  <Text style={styles.p}>
                    «{query.trim()}» boʻyicha grammatika, audio va hikoyalarda natija yoʻq. Imloni tekshiring yoki boshqa soʻz bilan qidiring.
                  </Text>
                </View>
              )}

              {/* Dizaynda ustun gap 12 + margin-top 20 = 32 */}
              <View style={[styles.block, { marginTop: noResults ? 32 : 0 }]}>
                <Text accessibilityRole="header" style={styles.h2}>BALKI SHULAR KERAKDIR</Text>
                <View style={styles.chips}>
                  <Pressable accessibilityRole="link" onPress={() => go(R.grammarList)} style={styles.chip}>
                    <Text style={styles.aa}>Аа</Text>
                    <Text style={styles.chipText}>Grammatika</Text>
                  </Pressable>
                  <Pressable accessibilityRole="link" onPress={() => go(R.audioList)} style={styles.chip}>
                    <HeadphonesIcon />
                    <Text style={styles.chipText}>Audiolar</Text>
                  </Pressable>
                  {noResults && (
                    <Pressable accessibilityRole="link" onPress={addWord} style={styles.addChip}>
                      <PlusIcon />
                      <Text style={[styles.chipText, { color: '#FFFFFF', flexShrink: 1 }]}>
                        {`«${query.trim()}» soʻzini lugʻatga qoʻshish`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {recent.length > 0 && (
                <View style={[styles.block, { marginTop: 30 }]}>
                  <Text accessibilityRole="header" style={styles.h2}>OXIRGI QIDIRUVLAR</Text>
                  <View style={styles.list}>
                    {recent.map((r, i) => (
                      <Pressable
                        key={r.query}
                        accessibilityRole="link"
                        onPress={() => (r.href === R.search ? setQuery(r.query) : go(r.href))}
                        style={[styles.row, i < recent.length - 1 && styles.divider]}
                      >
                        <ClockIcon />
                        <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>{r.query}</Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>{r.meta}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  header: { paddingHorizontal: 20 },
  headRow: { maxWidth: 480, alignSelf: 'center', width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  field: {
    flex: 1,
    minWidth: 0,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2F5BFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 4,
  },
  input: { flex: 1, minWidth: 0, height: 44, padding: 0, fontFamily: fonts.bodyBold, fontSize: 16, color: '#0B1220', outlineStyle: 'none' } as object,
  clear: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  clearDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E4E8F0', alignItems: 'center', justifyContent: 'center' },

  body: { paddingTop: 40, paddingHorizontal: 20 },
  column: { maxWidth: 480, alignSelf: 'center', width: '100%' },
  empty: { alignItems: 'center', gap: 12 },
  mascotRing: { width: 176, height: 176, borderRadius: 88, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  mascot: { width: 140, height: 140 },
  h1: { marginTop: 8, fontFamily: fonts.display, fontSize: 26, lineHeight: 31, letterSpacing: -0.52, color: '#0B1220', textAlign: 'center', ...reset },
  p: { maxWidth: 310, fontFamily: fonts.body, fontSize: 15, lineHeight: 22.5, color: '#4A5468', textAlign: 'center', ...reset },

  block: { gap: 10 },
  h2: { marginLeft: 4, fontFamily: fonts.bodyHeavy, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, color: '#4A5468', ...reset },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D5DBE7', flexDirection: 'row', alignItems: 'center', gap: 8 },
  aa: { fontFamily: Platform.OS === 'web' ? fonts.display : fonts.displayCyrillic, fontSize: 14, color: '#2F5BFF', ...reset },
  chipText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', ...reset },
  addChip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },

  list: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  row: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#0B1220', ...reset },
  rowMeta: { flexShrink: 1, maxWidth: 170, fontFamily: fonts.bodyBold, fontSize: 12, color: '#5B6478', ...reset },
});
