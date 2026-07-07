import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { getLessonContent, LessonContent } from '@/data/lessonContent';
import { getCategoryProgress, useLessonProgress } from '@/services/lessonProgressStore';

export default function BonusLessonHubScreen() {
  const { bonusId } = useLocalSearchParams<{ bonusId: string }>();
  const [content] = useState<LessonContent>(() => getLessonContent(String(bonusId), 0));
  const progress = useLessonProgress(String(bonusId));

  const rows = [
    {
      key: 'video',
      title: 'Videodars',
      subtitle: 'Video, konspekt va izohlar',
      icon: 'play-circle' as const,
      pct: progress.videoWatch ? 100 : 0,
      route: 'video/watch',
    },
    {
      key: 'vocabulary',
      title: "Yangi so'zlar",
      subtitle: `${content.vocabulary.length} ta yangi so'z`,
      icon: 'book-outline' as const,
      pct: getCategoryProgress(String(bonusId), 'vocabulary'),
      route: 'vocabulary',
    },
    {
      key: 'homework',
      title: 'Uyga vazifani bajarish',
      subtitle: `${content.homeworkParts.length} ta avtomatik tekshiriladigan qism`,
      icon: 'create-outline' as const,
      pct: getCategoryProgress(String(bonusId), 'homework', content.homeworkParts.length),
      route: 'homework',
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={content.unitTitle} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <Text style={styles.bannerEmoji}>🎁</Text>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTag}>Yakshanba bonus darsi</Text>
            <Text style={styles.bannerTitle}>{content.unitTitle}</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>Barcha bo'limlarni ketma-ket bajaring</Text>

        {rows.map((row) => (
          <Pressable key={row.key} onPress={() => router.push(`/homework/lesson/${bonusId}/${row.route}` as never)}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Ionicons name={row.icon} size={26} color="#B45309" />
                </View>
                <View style={styles.info}>
                  <Text style={styles.title}>{row.title}</Text>
                  <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
                  <View style={styles.progressRow}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${row.pct}%` }]} />
                    </View>
                    <Text style={styles.pctText}>{row.pct}%</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: theme.radius.md,
    padding: 16,
  },
  bannerEmoji: { fontSize: 34 },
  bannerInfo: { flex: 1 },
  bannerTag: { fontFamily: theme.fonts.bold, fontSize: 12, color: '#B45309', marginBottom: 2 },
  bannerTitle: { fontFamily: theme.fonts.extraBold, fontSize: 17, color: theme.colors.text },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, gap: 3 },
  title: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  rowSubtitle: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  progressBarBg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.colors.border },
  progressBarFill: { height: 5, borderRadius: 3, backgroundColor: '#D97706' },
  pctText: { fontFamily: theme.fonts.bold, fontSize: 12, minWidth: 30, textAlign: 'right', color: '#D97706' },
});
