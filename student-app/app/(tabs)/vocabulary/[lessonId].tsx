import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { getResolvedLessonContent, LessonContent } from '@/data/lessonContent';

export default function VocabularyFolderScreen() {
  const { lessonId, name } = useLocalSearchParams<{ lessonId: string; name?: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), 0).then(setContent);
  }, [lessonId]);

  if (!content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={name ? decodeURIComponent(name) : "So'zlar"} showBack />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={name ? decodeURIComponent(name) : 'So\'zlar'} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{content.vocabulary.length} ta so'z</Text>
        {content.vocabulary.map((word) => (
          <Card key={word.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name={word.icon} size={26} color={theme.colors.purple} />
              </View>
              <View style={styles.info}>
                <View style={styles.headRow}>
                  <Text style={styles.english}>{word.english}</Text>
                  <Ionicons name="volume-medium-outline" size={16} color={theme.colors.textLight} />
                </View>
                <Text style={styles.transcript}>{word.transcript}</Text>
                <Text style={styles.translation}>{word.translation}</Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40, gap: 10 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  english: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  transcript: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textLight, marginTop: 1 },
  translation: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.purple, marginTop: 2 },
});
