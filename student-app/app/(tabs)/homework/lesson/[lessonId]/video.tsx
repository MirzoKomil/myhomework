import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

export default function VideoLessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Video dars</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.videoPlaceholder}>
          <View style={styles.playBtn}>
            <Ionicons name="play" size={36} color="#fff" />
          </View>
          <Text style={styles.videoDuration}>12:08</Text>
        </View>

        <Text style={styles.unitTitle}>Unit 1. Present Simple</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Formula</Text>
          <Text style={styles.formula}>Subject + V1 (+ s/es for he/she/it)</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tavsif</Text>
          <Text style={styles.body}>
            Present Simple zamon doimiy harakatlar, odatlar va umumiy haqiqatlarni ifodalash uchun
            ishlatiladi. Har kuni takrorlanadigan ishlar yoki odatlar uchun mos keladi.
          </Text>
        </View>
      </ScrollView>

      <Pressable style={styles.doneBtn} onPress={() => router.back()}>
        <Text style={styles.doneText}>Ko'rdim</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  scroll: { padding: 20, paddingBottom: 100 },
  videoPlaceholder: {
    height: 200,
    backgroundColor: theme.colors.text,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoDuration: { fontFamily: theme.fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  unitTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text, marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionLabel: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple, marginBottom: 6 },
  formula: {
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.purpleLight,
    padding: 14,
    borderRadius: theme.radius.sm,
  },
  body: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.textMuted, lineHeight: 24 },
  doneBtn: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneText: { fontFamily: theme.fonts.bold, fontSize: 16, color: '#fff' },
});
