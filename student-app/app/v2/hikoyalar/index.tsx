/**
 * v2 Audiohikoyalar (dizayn: 35 StoryList).
 *
 * Hikoyalar — CRM kutubxonasidagi kitoblar (mc.library.books, eski
 * resources/books bilan bir xil manba). Daraja: a1 → Oson, a2 → O'rta,
 * b1 → Qiyin. Davomiylik — matn hajmidan taxminiy. Foiz — Book
 * ekranida saqlangan tinglash joyi.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getStoryPositions } from '@/components/v2/library/data';
import { LEVEL_CHIP, storyMinutes } from '@/components/v2/library/stories';
import { BackButton, Column, Display, FilterTabs, go, T } from '@/components/v2/library/shared';
import { R } from '@/constants/v2/routes';
import type { BookLevel, BookStory } from '@/data/bookStories';
import { fetchMobileContent } from '@/services/contentApi';

type Story = BookStory & { coverUrl?: string };
type Filter = 'all' | BookLevel;
const TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'a1', label: 'Oson' },
  { key: 'a2', label: 'Oʻrta' },
  { key: 'b1', label: 'Qiyin' },
];

export default function StoryListScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [stories, setStories] = useState<Story[]>([]);
  const [pos, setPos] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchMobileContent()
        .then((mc) => alive && setStories(mc.library.books))
        .catch(() => {});
      getStoryPositions().then((p) => alive && setPos(p));
      return () => {
        alive = false;
      };
    }, []),
  );

  const shown = stories.filter((s) => filter === 'all' || s.level === filter);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(insets.top, 44) + 10, paddingBottom: insets.bottom + 34 }} showsVerticalScrollIndicator={false}>
      <Column>
        <View style={styles.header}>
          <BackButton fallback={R.practice} />
          <View style={{ flex: 1 }}>
            <Display size={26}>Audiohikoyalar</Display>
            <T w={700} size={13} color="#4A5468">{stories.length} ta hikoya · soʻzma-soʻz oʻqish</T>
          </View>
        </View>

        <FilterTabs
          tabs={TABS}
          value={filter}
          onChange={setFilter}
          label="Qiyinlik"
          style={{ paddingTop: 14, paddingHorizontal: 20 }}
          look={{ height: 40, padX: 16, gap: 8, inactiveBorder: '#E4E8F0', inactiveColor: '#4A5468', inactiveWeight: 800 }}
        />

        <View style={styles.grid}>
          {shown.map((s) => {
            const p = Math.round((pos[s.id] ?? 0) * 100);
            const chip = LEVEL_CHIP[s.level];
            return (
              <Pressable key={s.id} accessibilityRole="link" onPress={() => go(R.book(s.id))} style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}>
                <View style={[styles.cover, { backgroundColor: s.colors?.[0] ?? '#E8EEFF' }]}>
                  {s.coverUrl ? (
                    <Image source={{ uri: s.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                  ) : (
                    <Text style={styles.emoji}>{s.emoji}</Text>
                  )}
                  {p > 0 && p < 100 && (
                    <>
                      <View style={styles.coverTrack}>
                        <View style={[styles.coverFill, { width: `${p}%` }]} />
                      </View>
                      <View style={styles.pct}>
                        <T w={800} size={11} color="#FFFFFF">{p}%</T>
                      </View>
                    </>
                  )}
                </View>
                <T w={800} size={15} lh={1.25} style={styles.title}>{s.title}</T>
                <View style={styles.meta}>
                  <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                    <T w={800} size={12} color={chip.fg}>{chip.label}</T>
                  </View>
                  <T w={700} size={12} color="#4A5468">{storyMinutes(s)} daq</T>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Column>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FA' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  grid: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexBasis: '40%', flexGrow: 1, maxWidth: '50%', backgroundColor: '#FFFFFF', borderRadius: 22, paddingTop: 8, paddingHorizontal: 8, paddingBottom: 12, gap: 8 },
  cover: { height: 124, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 44 },
  coverTrack: { position: 'absolute', left: 8, right: 8, bottom: 8, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.9)', overflow: 'hidden' },
  coverFill: { height: 6, backgroundColor: '#2F5BFF', borderRadius: 3 },
  pct: { position: 'absolute', top: 8, right: 8, backgroundColor: '#2F5BFF', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7 },
  title: { paddingHorizontal: 4, minHeight: 38 },
  meta: { paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 7 },
});
