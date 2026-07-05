import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { GRAMMAR_LEVEL_COLORS, GRAMMAR_LEVEL_LABELS, GRAMMAR_LEVELS_ORDER, getGrammarTopicsByLevel } from '@/data/grammarGuide';

export default function GrammarGuideScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Grammatik qo'llanma" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>A1 darajadan B1 darajagacha mavzular</Text>

        {GRAMMAR_LEVELS_ORDER.map((level, levelIndex) => {
          const topics = getGrammarTopicsByLevel(level);
          const [iconColor] = GRAMMAR_LEVEL_COLORS[level];
          return (
            <View key={level}>
              {levelIndex > 0 && <View style={styles.divider} />}
              <Text style={styles.levelLabel}>{GRAMMAR_LEVEL_LABELS[level]}</Text>
              <View style={styles.topicList}>
                {topics.map((topic, topicIndex) => (
                  <Pressable
                    key={topic.id}
                    style={[styles.row, topicIndex === topics.length - 1 && styles.rowLast]}
                    onPress={() => router.push(`/resources/library/grammar/${topic.id}` as never)}>
                    <View style={[styles.iconWrap, { backgroundColor: iconColor }]}>
                      <Ionicons name="text-outline" size={18} color="#fff" />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {topic.title}
                      </Text>
                      {topic.formula && (
                        <Text style={styles.rowSubtitle} numberOfLines={1}>
                          {topic.formula}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 20 },
  levelLabel: { fontFamily: theme.fonts.extraBold, fontSize: 15, color: theme.colors.text, marginBottom: 10 },
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
  iconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowInfo: { flex: 1 },
  rowTitle: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  rowSubtitle: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
});
