import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { VocabLevel, VOCAB_LEVEL_LABELS, VOCAB_LEVELS_ORDER, VOCAB_TOPICS, VocabTopic } from '@/data/vocabularyLibrary';
import { fetchMobileContent } from '@/services/contentApi';

export default function WordsLevelScreen() {
  const [level, setLevel] = useState<VocabLevel>('beginner');
  const [allTopics, setAllTopics] = useState<VocabTopic[]>(VOCAB_TOPICS);

  useEffect(() => {
    fetchMobileContent()
      .then((mc) => { if (mc.library.words.length) setAllTopics(mc.library.words); })
      .catch(() => {});
  }, []);

  const topics = allTopics.filter((t) => t.level === level);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="So'zlar ro'yxati" showBack />
      <View style={styles.tabs}>
        {VOCAB_LEVELS_ORDER.map((lv) => {
          const active = lv === level;
          return (
            <Pressable key={lv} style={[styles.tab, active && styles.tabActive]} onPress={() => setLevel(lv)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{VOCAB_LEVEL_LABELS[lv]}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{topics.length} ta mavzu</Text>
        <View style={styles.topicList}>
          {topics.map((t, i) => (
            <Pressable
              key={t.id}
              style={[styles.row, i === topics.length - 1 && styles.rowLast]}
              onPress={() => router.push(`/resources/library/words/${t.id}` as never)}>
              <View style={styles.iconWrap}>
                <Text style={styles.iconEmoji}>{t.icon}</Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {t.title}
                </Text>
                <Text style={styles.rowSubtitle}>{t.words.length} ta so'z</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
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
  tabActive: { backgroundColor: theme.colors.purple },
  tabText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.textMuted },
  tabTextActive: { color: '#fff' },
  scroll: { padding: 20, paddingBottom: 40 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 12 },
  topicList: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 20 },
  rowInfo: { flex: 1 },
  rowTitle: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  rowSubtitle: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
});
