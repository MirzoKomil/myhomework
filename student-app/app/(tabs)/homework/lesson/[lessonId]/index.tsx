import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { fetchMobileContent, AdminModule } from '@/services/contentApi';

type ModuleVM = AdminModule & { hasContent: boolean };

const typeConfig: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  video:  { icon: 'play-circle',    color: theme.colors.blue,    bg: theme.colors.blueLight },
  pdf:    { icon: 'document-text',  color: '#e11d48',            bg: '#ffe4e6' },
  word:   { icon: 'document',       color: '#2563eb',            bg: '#dbeafe' },
  image:  { icon: 'image',          color: '#d97706',            bg: '#fef3c7' },
  text:   { icon: 'text',           color: theme.colors.success, bg: theme.colors.successBg },
  quiz:   { icon: 'game-controller', color: theme.colors.success, bg: theme.colors.successBg },
};

export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [modules, setModules] = useState<ModuleVM[]>([]);
  const [lessonName, setLessonName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMobileContent().then((mc) => {
      const lesson = mc.lessons.find((l) => l.id === lessonId);
      setLessonName(lesson?.name ?? `Dars`);
      const mods = mc.modules.filter((m) => m.lessonId === lessonId);
      const vms: ModuleVM[] = mods.map((m) => ({
        ...m,
        hasContent: mc.moduleContents.some((c) => c.moduleId === m.id),
      }));
      setModules(vms);
    }).finally(() => setLoading(false));
  }, [lessonId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={lessonName || 'Dars'} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Barcha bo'limlarni ketma-ket bajaring</Text>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.purple} />
          </View>
        )}

        {!loading && modules.length === 0 && (
          <View style={styles.center}>
            <Ionicons name="file-tray-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Hali modullar qo'shilmagan</Text>
          </View>
        )}

        {modules.map((mod, index) => {
          const cfg = typeConfig[mod.type ?? 'text'] ?? typeConfig.text;
          const isLast = index === modules.length - 1;
          return (
            <View key={mod.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.dot, { backgroundColor: cfg.color }]}>
                  <Ionicons name={cfg.icon} size={14} color="#fff" />
                </View>
                {!isLast && <View style={styles.line} />}
              </View>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => router.push(`/homework/lesson/${lessonId}/module/${mod.id}`)}>
                <Card style={[styles.activityCard]}>
                  <View style={styles.activityRow}>
                    <View style={[styles.activityIcon, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon} size={24} color={cfg.color} />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle}>{mod.name}</Text>
                      <Text style={styles.activityDuration}>
                        {mod.duration ? mod.duration + ' daq' : mod.hasContent ? 'Kontent mavjud' : 'Hali kontent yo\'q'}
                      </Text>
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
  scroll: { padding: 20, paddingBottom: 40 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 20 },
  timelineItem: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  timelineLeft: { alignItems: 'center', width: 28 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: theme.colors.border, marginVertical: 4 },
  activityCard: { marginBottom: 8 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  activityIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  activityInfo: { flex: 1 },
  activityTitle: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text },
  activityDuration: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
});
