import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { GRAMMAR_LEVEL_COLORS, GRAMMAR_LEVEL_LABELS, GRAMMAR_TOPICS, GrammarTopic } from '@/data/grammarGuide';
import { fetchMobileContent } from '@/services/contentApi';

export default function GrammarTopicScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const [allTopics, setAllTopics] = useState<GrammarTopic[]>(GRAMMAR_TOPICS);

  useEffect(() => {
    fetchMobileContent()
      .then((mc) => { if (mc.library.grammar.length) setAllTopics(mc.library.grammar); })
      .catch(() => {});
  }, []);

  const topic = allTopics.find((t) => t.id === topicId);

  if (!topic) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Mavzu" showBack />
        <View style={styles.center}>
          <Text style={styles.emptyText}>Mavzu topilmadi</Text>
        </View>
      </SafeAreaView>
    );
  }

  const [accentColor] = GRAMMAR_LEVEL_COLORS[topic.level];
  const hasContent = !!(topic.description || topic.examples?.length);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={topic.title} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.levelPill, { backgroundColor: `${accentColor}1A` }]}>
          <Text style={[styles.levelPillText, { color: accentColor }]}>{GRAMMAR_LEVEL_LABELS[topic.level]}</Text>
        </View>

        <Text style={styles.title}>{topic.title}</Text>

        {!hasContent && (
          <View style={styles.comingSoon}>
            <Ionicons name="construct-outline" size={32} color={theme.colors.textMuted} />
            <Text style={styles.comingSoonText}>Bu mavzu tez orada to'liq qo'shiladi</Text>
          </View>
        )}

        {topic.formula && (
          <View style={[styles.formulaBox, { borderColor: accentColor }]}>
            <Text style={[styles.formulaLabel, { color: accentColor }]}>Formula</Text>
            <Text style={styles.formulaText}>{topic.formula}</Text>
          </View>
        )}

        {topic.description && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tushuntirish</Text>
            <Text style={styles.description}>{topic.description}</Text>
          </View>
        )}

        {topic.examples && topic.examples.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Misollar</Text>
            {topic.examples.map((ex, i) => (
              <View key={i} style={styles.exampleBox}>
                <Text style={styles.exampleEn}>{ex.en}</Text>
                <Text style={styles.exampleUz}>{ex.uz}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
  scroll: { padding: 20, paddingBottom: 40 },
  levelPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 10 },
  levelPillText: { fontFamily: theme.fonts.bold, fontSize: 11 },
  title: { fontFamily: theme.fonts.extraBold, fontSize: 24, color: theme.colors.text, marginBottom: 20 },

  comingSoon: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    marginBottom: 20,
    ...theme.shadow.card,
  },
  comingSoonText: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },

  formulaBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 20,
    ...theme.shadow.card,
  },
  formulaLabel: { fontFamily: theme.fonts.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  formulaText: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text, lineHeight: 22 },

  section: { marginBottom: 20 },
  sectionLabel: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  description: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.text, lineHeight: 23 },

  exampleBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 14,
    marginBottom: 10,
    ...theme.shadow.card,
  },
  exampleEn: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  exampleUz: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
});
