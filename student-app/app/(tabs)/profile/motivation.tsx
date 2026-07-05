import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { getRankedLeaderboard, ME_LEADERBOARD_ID, profileStats } from '@/data/mock';

const BADGES = [
  { emoji: '🔥', label: '5 kunlik streak', earned: true },
  { emoji: '📚', label: '10 dars yakunlandi', earned: true },
  { emoji: '🏆', label: 'Top 10 reyting', earned: false },
  { emoji: '🎯', label: '30 kunlik streak', earned: false },
  { emoji: '💯', label: "100% Davomat", earned: false },
  { emoji: '⚔️', label: 'Speaking Battle g\'olibi', earned: true },
];

export default function MotivationScreen() {
  const ranked = getRankedLeaderboard('alltime', 'country');
  const me = ranked.find((e) => e.id === ME_LEADERBOARD_ID);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Motivatsiya tizimi" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{profileStats.streakDays}</Text>
            <Text style={styles.statLabel}>kunlik streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🪙</Text>
            <Text style={styles.statValue}>{profileStats.coins}</Text>
            <Text style={styles.statLabel}>coin</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🏆</Text>
            <Text style={styles.statValue}>{me ? `#${me.rank}` : '—'}</Text>
            <Text style={styles.statLabel}>reyting</Text>
          </View>
        </View>

        <Pressable style={styles.leaderboardBtn} onPress={() => router.push('/profile/leaderboard' as never)}>
          <Text style={styles.leaderboardBtnText}>Leaderboardni ko'rish →</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Yutuqlar</Text>
        <View style={styles.badgeGrid}>
          {BADGES.map((b) => (
            <View key={b.label} style={[styles.badgeCard, !b.earned && styles.badgeCardLocked]}>
              <Text style={[styles.badgeEmoji, !b.earned && styles.badgeEmojiLocked]}>{b.emoji}</Text>
              <Text style={[styles.badgeLabel, !b.earned && styles.badgeLabelLocked]}>{b.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 14,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  statEmoji: { fontSize: 22, marginBottom: 6 },
  statValue: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.text },
  statLabel: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  leaderboardBtn: {
    backgroundColor: theme.colors.purpleLight,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  leaderboardBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.purple },
  sectionTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, marginBottom: 12 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeCard: {
    width: '30%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 12,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  badgeCardLocked: { opacity: 0.4 },
  badgeEmoji: { fontSize: 28, marginBottom: 6 },
  badgeEmojiLocked: {},
  badgeLabel: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.text, textAlign: 'center' },
  badgeLabelLocked: { color: theme.colors.textMuted },
});
