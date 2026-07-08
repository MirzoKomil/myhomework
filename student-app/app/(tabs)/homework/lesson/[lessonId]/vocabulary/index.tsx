import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { getResolvedLessonContent, LessonContent } from '@/data/lessonContent';
import { useLessonProgress } from '@/services/lessonProgressStore';

export default function VocabularySectionScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);
  const progress = useLessonProgress(String(lessonId));

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), 0).then(setContent);
  }, [lessonId]);

  if (!content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Yangi so'zlar" showBack />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  const items = [
    {
      id: 'list',
      title: "Yangi so'zlar ro'yxati",
      subtitle: `${content.vocabulary.length} ta so'z — rasm, tarjima, talaffuz`,
      icon: 'list-outline' as const,
      color: theme.colors.purple,
      bg: theme.colors.purpleLight,
      done: progress.vocabList,
      route: 'list',
    },
    {
      id: 'practice',
      title: "O'rganish, yodlash, takrorlash",
      subtitle: 'Tarjima tanlash, so\'z tuzish, talaffuz',
      icon: 'repeat-outline' as const,
      color: theme.colors.success,
      bg: theme.colors.successBg,
      done: progress.vocabPractice,
      route: 'practice',
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Yangi so'zlar" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <View key={item.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.dot, { backgroundColor: item.done ? theme.colors.success : item.color }]}>
                  <Ionicons name={item.done ? 'checkmark' : item.icon} size={14} color="#fff" />
                </View>
                {!isLast && <View style={styles.line} />}
              </View>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => router.push(`/homework/lesson/${lessonId}/vocabulary/${item.route}` as never)}>
                <Card style={styles.card}>
                  <View style={styles.row}>
                    <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
                      <Ionicons name={item.icon} size={22} color={item.color} />
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.title}>{item.title}</Text>
                      <Text style={styles.subtitle}>{item.subtitle}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                  </View>
                </Card>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  timelineItem: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  timelineLeft: { alignItems: 'center', width: 28 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: theme.colors.border, marginVertical: 4 },
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  title: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
});
