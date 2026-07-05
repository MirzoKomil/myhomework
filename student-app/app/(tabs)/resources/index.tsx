import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

export default function ResourcesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Resurslar" />
      <View style={styles.wrap}>
        <Pressable onPress={() => router.push('/resources/library' as never)}>
          <LinearGradient colors={['#6FA8FF', '#4F8CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
            <Text style={styles.emoji}>📚</Text>
            <Text style={styles.title}>Kutubxona</Text>
            <Text style={styles.subtitle}>Grammatika, so'zlar, talaffuz va boshqa o'quv materiallari</Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={() => router.push('/resources/games' as never)}>
          <LinearGradient colors={['#F0807D', '#D65656']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
            <Text style={styles.emoji}>🎮</Text>
            <Text style={styles.title}>O'yinlar</Text>
            <Text style={styles.subtitle}>O'ynab, til ko'nikmalaringizni mashq qiling</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  wrap: { padding: 20, gap: 16 },
  card: {
    borderRadius: theme.radius.lg,
    padding: 24,
    minHeight: 140,
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  emoji: { fontSize: 32, marginBottom: 10 },
  title: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: '#fff', marginBottom: 6 },
  subtitle: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
});
