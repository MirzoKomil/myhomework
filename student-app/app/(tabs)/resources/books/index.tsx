import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import {
  BookLevel,
  BOOK_LEVEL_COLORS,
  BOOK_LEVEL_LABELS,
  BOOK_LEVELS_ORDER,
  getBookStoriesByLevel,
} from '@/data/bookStories';

export default function BooksLevelScreen() {
  const [level, setLevel] = useState<BookLevel>('a1');
  const stories = getBookStoriesByLevel(level);
  const accent = BOOK_LEVEL_COLORS[level];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Kitoblar" showBack />
      <View style={styles.tabs}>
        {BOOK_LEVELS_ORDER.map((lv) => {
          const active = lv === level;
          return (
            <Pressable
              key={lv}
              style={[styles.tab, active && { backgroundColor: BOOK_LEVEL_COLORS[lv] }]}
              onPress={() => setLevel(lv)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{BOOK_LEVEL_LABELS[lv]}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{stories.length} ta audio-hikoya</Text>
        <View style={styles.grid}>
          {stories.map((s) => (
            <Pressable key={s.id} style={styles.cardWrap} onPress={() => router.push(`/resources/books/${s.id}` as never)}>
              <LinearGradient colors={s.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
                <View style={[styles.levelBadge, { backgroundColor: accent }]}>
                  <Text style={styles.levelBadgeText}>{BOOK_LEVEL_LABELS[level]}</Text>
                </View>
                <Text style={styles.cardEmoji}>{s.emoji}</Text>
              </LinearGradient>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {s.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 4,
    ...theme.shadow.card,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.sm, alignItems: 'center' },
  tabText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.textMuted },
  tabTextActive: { color: '#fff' },
  scroll: { padding: 20, paddingBottom: 40 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  cardWrap: { width: '18%' },
  card: {
    borderRadius: theme.radius.sm,
    aspectRatio: 0.85,
    padding: 6,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  levelBadge: { position: 'absolute', top: 5, left: 5, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  levelBadgeText: { fontFamily: theme.fonts.bold, fontSize: 7, color: '#fff' },
  cardEmoji: { fontSize: 22 },
  cardTitle: { fontFamily: theme.fonts.semiBold, fontSize: 9, color: theme.colors.text, textAlign: 'center', marginTop: 4, lineHeight: 11 },
});
