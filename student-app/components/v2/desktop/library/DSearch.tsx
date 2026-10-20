/**
 * Kompyuter: Qidiruv (dizayn: D_SearchEmpty.dc.html — "natija yo'q" holati).
 *
 * Qidiruv indeksi mobil qidiruv.tsx bilan aynan bir xil (kutubxona grammatikasi,
 * podkastlar, hikoyalar, so'z to'plamlari, dars lug'ati, shaxsiy lug'at).
 * Natija bo'lmasa dizayndagi holat; natija bo'lsa o'sha katta kartada ro'yxat.
 * Oxirgi qidiruvlar qurilmada; "lug'atga qo'shish" so'zni qo'shib Lug'atni ochadi.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { addMyWord, getMyWords, getRecentSearches, pushRecentSearch, type RecentSearch } from '@/components/v2/practice/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchMobileContent } from '@/services/contentApi';
import { stripRichText } from '@/services/richText';
import { getAccumulatedVocabulary } from '@/services/vocabProgress';

import { DesktopPage } from '../Shell';
import { IChevron, IClock, IClose, IHeadphones, IPlus, ISearch, Over, T } from './ui';

type Item = { title: string; sub: string; meta: string; href: string; hay: string };

const norm = (x: string) =>
  stripRichText(x)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ'`‘’]/g, '')
    .trim();

export function DSearch() {
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
          items.push({
            title: g.title,
            sub: stripRichText(g.formula ?? ''),
            meta: `Grammatika · G${i + 1}`,
            href: R.grammar(g.id),
            hay: norm(`${g.title} ${g.formula ?? ''} ${g.description ?? ''}`),
          }),
        );
        lib.podcasts.forEach((p) =>
          items.push({ title: p.title, sub: '', meta: 'Audio', href: R.audioList, hay: norm(`${p.title} ${p.lines.map((l) => `${l.en} ${l.uz}`).join(' ')}`) }),
        );
        lib.books.forEach((b) => items.push({ title: b.title, sub: stripRichText(b.description), meta: 'Hikoya', href: R.book(b.id), hay: norm(`${b.title} ${b.description}`) }));
        lib.words.forEach((t) => t.words.forEach((w) => items.push({ title: w.en, sub: w.uz, meta: `Soʻzlar · ${t.title}`, href: R.grammarList, hay: norm(`${w.en} ${w.uz}`) })));
        const course = mc.courses[0];
        const lessons = course ? mc.lessons.filter((l) => l.courseId === course.id) : [];
        const vocab = await getAccumulatedVocabulary().catch(() => []);
        const lessonOf = new Map<string, number>();
        lessons.forEach((l, i) => (mc.lessonContents[l.id]?.vocabulary ?? []).forEach((v) => lessonOf.set(v.id, i)));
        vocab.forEach((v) => {
          const li = lessonOf.get(v.id) ?? 0;
          const lid = lessons[li]?.id;
          items.push({ title: v.english, sub: v.translation, meta: `Lugʻat · ${li + 1}-dars`, href: lid ? R.vocab(lid) : R.path, hay: norm(`${v.english} ${v.translation}`) });
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

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!q) return;
    saveTimer.current = setTimeout(() => {
      const first = results[0];
      pushRecentSearch({ query: query.trim(), meta: first ? first.meta : 'Natija yoʻq', href: first ? first.href : R.search }).then(() => getRecentSearches().then(setRecent));
    }, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, results.length]);

  const go = (href: string) => router.push(href as Href);
  const noResults = !!q && results.length === 0;
  const addWord = async () => {
    await addMyWord({ word: query.trim() }, 'search');
    go(R.lugat);
  };

  return (
    <DesktopPage
      title="Qidiruv"
      subtitle="Grammatika, audio va hikoyalar"
      back={R.practice}
      actions={
        <View style={s.field}>
          <ISearch />
          <TextInput
            accessibilityLabel="Mashqdan qidirish"
            value={query}
            onChangeText={setQuery}
            placeholder="Qidirish"
            placeholderTextColor="#9AA4BC"
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
            style={s.input}
          />
          {!!query && (
            <Pressable accessibilityRole="button" accessibilityLabel="Tozalash" onPress={() => setQuery('')} style={s.clear}>
              <IClose size={14} color="#34405A" sw={2.6} />
            </Pressable>
          )}
        </View>
      }
      scroll={false}
      contentStyle={{ paddingBottom: 32 }}
    >
      <View style={{ flex: 1, minHeight: 0, gap: 20 }}>
        {noResults ? (
          <View style={s.main}>
            <View style={s.mascot}>
              <Image
                source={designImages['cc0d95446730f059d25d989e2c9845ad']}
                style={{ width: 214, height: 214 }}
                resizeMode="contain"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>
            <View style={{ gap: 14, flexShrink: 1 }}>
              <T f="display" size={40} lh={48} ls={-0.8} accessibilityRole="header">
                Hech narsa topilmadi
              </T>
              <T w={600} size={18} lh={27.9} color="#4A5468" style={{ maxWidth: 560 }}>
                «{query.trim()}» boʻyicha grammatika, audio va hikoyalarda natija yoʻq. Imloni tekshiring yoki boshqa soʻz bilan qidiring.
              </T>
            </View>
          </View>
        ) : results.length > 0 ? (
          <View style={s.results}>
            <View style={{ paddingHorizontal: 16, height: 22, justifyContent: 'center' }}>
              <Over>Natijalar · {results.length}</Over>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {results.map((r, i) => (
                <Pressable
                  key={`${r.meta}-${r.title}-${i}`}
                  accessibilityRole="link"
                  onPress={() => go(r.href)}
                  style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.row, i < results.length - 1 && s.divider, hovered && { backgroundColor: '#F7F9FF' }]}
                >
                  <ISearch color="#5B6478" sw={2.2} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T size={18} lines={1}>
                      {r.title}
                    </T>
                    {!!r.sub && (
                      <T w={600} size={14} color="#4A5468" lines={1}>
                        {r.sub}
                      </T>
                    )}
                  </View>
                  <T w={700} size={14} color="#4A5468" lines={1}>
                    {r.meta}
                  </T>
                  <IChevron color="#5B6478" sw={2.4} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'stretch' }}>
          <View style={s.suggest}>
            <Over>Balki shular kerakdir</Over>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                accessibilityRole="link"
                onPress={() => go(R.grammarList)}
                style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.chip, hovered && { borderColor: '#D4DEFF' }]}
              >
                <T size={18} color="#2F5BFF">
                  Аа
                </T>
                <T size={16}>Grammatika</T>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={() => go(R.audioList)}
                style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.chip, hovered && { borderColor: '#D4DEFF' }]}
              >
                <IHeadphones />
                <T size={16}>Audiolar</T>
              </Pressable>
            </View>
            {noResults && (
              <Pressable accessibilityRole="link" onPress={addWord} style={({ pressed }) => [s.add, pressed && { backgroundColor: '#1E3FD1' }]}>
                <IPlus />
                <T size={16} color="#FFFFFF" lines={1} style={{ flexShrink: 1 }}>
                  «{query.trim()}» soʻzini lugʻatga qoʻshish
                </T>
              </Pressable>
            )}
          </View>
          {recent.length > 0 && (
            <View style={s.recent}>
              <View style={{ paddingHorizontal: 16, height: 22, justifyContent: 'center' }}>
                <Over>Oxirgi qidiruvlar</Over>
              </View>
              <View>
                {recent.slice(0, 2).map((r, i, arr) => (
                  <Pressable
                    key={r.query}
                    accessibilityRole="link"
                    onPress={() => (r.href === R.search ? setQuery(r.query) : go(r.href))}
                    style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.recentRow, i < arr.length - 1 && s.divider, hovered && { backgroundColor: '#F7F9FF' }]}
                  >
                    <IClock />
                    <T size={18} lines={1} style={{ flex: 1, minWidth: 0 }}>
                      {r.query}
                    </T>
                    <T w={700} size={14} color="#4A5468" lines={1}>
                      {r.meta}
                    </T>
                    <IChevron color="#5B6478" sw={2.4} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </DesktopPage>
  );
}

const s = StyleSheet.create({
  field: {
    width: 480,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2F5BFF',
    boxShadow: '0 0 0 4px #DCE5FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 8,
    marginRight: 6,
  } as object,
  input: { flex: 1, minWidth: 0, height: 44, padding: 0, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, color: '#0B1220', outlineStyle: 'none' } as object,
  clear: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  main: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 56,
  },
  mascot: { width: 260, height: 260, borderRadius: 130, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  results: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF', borderRadius: 28, paddingTop: 22, paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  row: { height: 70, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  suggest: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 26, paddingVertical: 22, paddingHorizontal: 26, gap: 16 },
  chip: {
    height: 54,
    paddingHorizontal: 22,
    borderRadius: 27,
    backgroundColor: '#F4F6FA',
    borderWidth: 2,
    borderColor: '#E2E6EE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  add: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 18,
    backgroundColor: '#2F5BFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 5px 0 #1E3FD1',
  } as object,
  recent: { width: 500, flexShrink: 0, backgroundColor: '#FFFFFF', borderRadius: 26, paddingTop: 22, paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  recentRow: { height: 70, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
});
