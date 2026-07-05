import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { getLessonContent, LessonContent } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import { getCategoryProgress, ProgressCategory, useLessonProgress } from '@/services/lessonProgressStore';

type CategoryDef = {
  key: ProgressCategory;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  route: string;
};

export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [lessonName, setLessonName] = useState('Dars');
  const [content, setContent] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then((mc) => {
        if (cancelled) return;
        const lesson = mc.lessons.find((l) => l.id === lessonId);
        setLessonName(lesson?.name ?? 'Dars');
        const courseLessons = lesson ? mc.lessons.filter((l) => l.courseId === lesson.courseId) : [];
        const dayIndex = Math.max(0, courseLessons.findIndex((l) => l.id === lessonId));
        setContent(getLessonContent(String(lessonId), dayIndex));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // Re-renders this screen whenever lesson progress changes elsewhere.
  useLessonProgress(String(lessonId));

  if (loading || !content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Dars" showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  const categories: CategoryDef[] =
    content.dayType === 'grammar'
      ? [
          {
            key: 'video',
            title: 'Videodars',
            subtitle: 'Video, konspekt va grammatika mashqlari',
            icon: 'play-circle',
            color: theme.colors.blue,
            bg: theme.colors.blueLight,
            route: 'video',
          },
          {
            key: 'vocabulary',
            title: "Yangi so'zlar",
            subtitle: `${content.vocabulary.length} ta yangi so'z`,
            icon: 'book-outline',
            color: theme.colors.purple,
            bg: theme.colors.purpleLight,
            route: 'vocabulary',
          },
          {
            key: 'homework',
            title: 'Uyga vazifa',
            subtitle: `${content.homeworkParts.length} ta qism`,
            icon: 'create-outline',
            color: theme.colors.success,
            bg: theme.colors.successBg,
            route: 'homework',
          },
        ]
      : [
          {
            key: 'speaking',
            title: "Speaking ko'rgazmalari",
            subtitle: 'Slaydlar va speaking mashqlari',
            icon: 'easel-outline',
            color: theme.colors.pink,
            bg: theme.colors.pinkBg,
            route: 'speaking',
          },
          {
            key: 'vocabulary',
            title: "Yangi so'zlar",
            subtitle: `${content.vocabulary.length} ta yangi so'z`,
            icon: 'book-outline',
            color: theme.colors.purple,
            bg: theme.colors.purpleLight,
            route: 'vocabulary',
          },
          {
            key: 'homework',
            title: 'Uyga vazifa',
            subtitle: `${content.homeworkParts.length} ta qism`,
            icon: 'create-outline',
            color: theme.colors.success,
            bg: theme.colors.successBg,
            route: 'homework',
          },
        ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={lessonName} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Barcha bo'limlarni ketma-ket bajaring</Text>

        {categories.map((cat) => {
          const pct = getCategoryProgress(String(lessonId), cat.key, content.homeworkParts.length);
          return (
            <Pressable key={cat.key} onPress={() => router.push(`/homework/lesson/${lessonId}/${cat.route}` as never)}>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <View style={[styles.iconWrap, { backgroundColor: cat.bg }]}>
                    <Ionicons name={cat.icon} size={26} color={cat.color} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.title}>{cat.title}</Text>
                    <Text style={styles.subtitleSmall}>{cat.subtitle}</Text>
                    <View style={styles.progressRow}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
                      </View>
                      <Text style={[styles.pctText, { color: cat.color }]}>{pct}%</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 8 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, gap: 3 },
  title: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  subtitleSmall: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  progressBarBg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.colors.border },
  progressBarFill: { height: 5, borderRadius: 3 },
  pctText: { fontFamily: theme.fonts.bold, fontSize: 12, minWidth: 30, textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
