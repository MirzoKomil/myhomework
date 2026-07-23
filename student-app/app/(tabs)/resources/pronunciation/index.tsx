import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { PRONUNCIATION_TOPICS, PronunciationTopic, getPronunciationTopicPracticeCount } from '@/data/pronunciationTopics';
import { fetchMobileContent } from '@/services/contentApi';

export default function PronunciationListScreen() {
  const { t } = useLang();
  const [topics, setTopics] = useState<PronunciationTopic[]>(PRONUNCIATION_TOPICS);

  useEffect(() => {
    fetchMobileContent()
      .then((mc) => { if (mc.library.pronunciation.length) setTopics(mc.library.pronunciation); })
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('res_pronunciation_title')} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{t('res_topic_count').replace('{n}', String(topics.length))}</Text>
        <View style={styles.topicList}>
          {topics.map((topic, i) => (
            <Pressable
              key={topic.id}
              style={[styles.row, i === topics.length - 1 && styles.rowLast]}
              onPress={() => router.push(`/resources/pronunciation/${topic.id}` as never)}>
              <View style={[styles.iconWrap, { backgroundColor: topic.bg }]}>
                <Ionicons name={topic.icon} size={20} color={topic.color} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {topic.title}
                </Text>
                <Text style={styles.rowSubtitle}>{t('res_exercise_count').replace('{n}', String(getPronunciationTopicPracticeCount(topic)))}</Text>
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
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowInfo: { flex: 1 },
  rowTitle: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  rowSubtitle: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
});
