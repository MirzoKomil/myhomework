import { useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { VOCAB_TOPICS, VocabTopic } from '@/data/vocabularyLibrary';
import { fetchMobileContent } from '@/services/contentApi';

export default function WordsTopicScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const [allTopics, setAllTopics] = useState<VocabTopic[]>(VOCAB_TOPICS);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchMobileContent()
      .then((mc) => { if (mc.library.words.length) setAllTopics(mc.library.words); })
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

  const handlePress = (index: number, en: string) => {
    setRevealed((prev) => ({ ...prev, [index]: true }));
    Speech.speak(en, { language: 'en-US', rate: 0.9 });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={topic.title} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Rasmga bosing — tarjima va talaffuzni eshiting</Text>
        <View style={styles.grid}>
          {topic.words.map((word, i) => {
            const isRevealed = !!revealed[i];
            return (
              <Pressable key={i} style={styles.card} onPress={() => handlePress(i, word.en)}>
                <Text style={styles.emoji}>{word.emoji}</Text>
                <Text style={styles.english} numberOfLines={1}>
                  {word.en}
                </Text>
                {isRevealed && (
                  <Text style={styles.translation} numberOfLines={1}>
                    {word.uz}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
  scroll: { padding: 20, paddingBottom: 40 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  card: {
    width: '31%',
    aspectRatio: 0.85,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    gap: 6,
    ...theme.shadow.card,
  },
  emoji: { fontSize: 40 },
  english: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.text, textAlign: 'center' },
  translation: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.purple, textAlign: 'center' },
});
