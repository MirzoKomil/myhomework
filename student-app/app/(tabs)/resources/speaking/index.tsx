import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import {
  SpeakingLevel,
  SPEAKING_LEVEL_COLORS,
  SPEAKING_LEVEL_LABELS,
  SPEAKING_LEVELS_ORDER,
  getSpeakingTopicsByLevel,
} from '@/data/speakingTopics';

export default function SpeakingLevelScreen() {
  const [level, setLevel] = useState<SpeakingLevel>('easy');
  const topics = getSpeakingTopicsByLevel(level);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Speaking mavzular" showBack />
      <View style={styles.tabs}>
        {SPEAKING_LEVELS_ORDER.map((lv) => {
          const active = lv === level;
          const accent = SPEAKING_LEVEL_COLORS[lv];
          return (
            <Pressable
              key={lv}
              style={[styles.tab, active && { backgroundColor: accent }]}
              onPress={() => setLevel(lv)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{SPEAKING_LEVEL_LABELS[lv]}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{topics.length} ta mavzu</Text>
        <View style={styles.grid}>
          {topics.map((t) => (
            <Pressable
              key={t.id}
              style={styles.cardWrap}
              onPress={() => router.push(`/resources/speaking/${t.id}` as never)}>
              <LinearGradient colors={t.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
                <Text style={styles.cardEmoji}>{t.emoji}</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {t.title}
                </Text>
              </LinearGradient>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  cardWrap: { width: '48%' },
  card: {
    borderRadius: theme.radius.md,
    aspectRatio: 1.1,
    padding: 16,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  cardEmoji: { fontSize: 34, marginBottom: 8 },
  cardTitle: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff', lineHeight: 18 },
});
