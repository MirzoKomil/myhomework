import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

export default function SpeakingScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Speaking</Text>
        <Text style={styles.progress}>2 / 5</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '40%' }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>So'zni talaffuz qiling</Text>

        <View style={styles.wordCard}>
          <View style={styles.illustration}>
            <Ionicons name="people" size={64} color={theme.colors.purple} />
          </View>
          <Text style={styles.word}>Mother</Text>
          <Text style={styles.phonetic}>/ˈmʌð.ər/</Text>
          <Pressable style={styles.speakerBtn}>
            <Ionicons name="volume-high" size={22} color={theme.colors.purple} />
          </Pressable>
        </View>

        <View style={styles.recordArea}>
          <View style={styles.waveform}>
            {[...Array(20)].map((_, i) => (
              <View key={i} style={[styles.waveBar, { height: 8 + (i % 5) * 6 }]} />
            ))}
          </View>
          <Pressable style={styles.micBtn}>
            <Ionicons name="mic" size={32} color="#fff" />
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.skipBtn} onPress={() => router.back()}>
        <Text style={styles.skipText}>O'tkazib yuborish</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  progress: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },
  progressBar: { height: 4, backgroundColor: theme.colors.border, marginHorizontal: 20 },
  progressFill: { height: 4, backgroundColor: theme.colors.purple, borderRadius: 2 },
  content: { flex: 1, padding: 20 },
  instruction: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
  wordCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 28,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  word: { fontFamily: theme.fonts.extraBold, fontSize: 32, color: theme.colors.text },
  phonetic: { fontFamily: theme.fonts.regular, fontSize: 16, color: theme.colors.textMuted, marginTop: 4 },
  speakerBtn: {
    marginTop: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordArea: {
    marginTop: 32,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 40, marginBottom: 20 },
  waveBar: { width: 4, backgroundColor: theme.colors.purpleLight, borderRadius: 2 },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: { padding: 20, alignItems: 'center' },
  skipText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
});
